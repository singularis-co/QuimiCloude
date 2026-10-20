// Contrato ESTATICO de `db/migrations/*_customer_phone_numbers`: dos tablas nuevas con empresa, sus
// indices parciales, sus FK compuestas, la copia de los telefonos actuales dentro del parentesis de
// RLS, la retirada del indice unico de `customers.phone_e164` y tres columnas en `whatsapp_contacts`.
//
// PATRON: predicados sobre el texto SQL, aplicados al archivo real y a una copia mutada en memoria.
// Mismo patron que `customers-phone-migration.test.ts`.

import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

function findRepoRoot(startDir: string): string {
  let dir = startDir
  for (;;) {
    try {
      readFileSync(join(dir, 'package.json'))
      return dir
    } catch {
      const parent = dirname(dir)
      if (parent === dir) throw new Error(`no se encontro package.json subiendo desde ${startDir}`)
      dir = parent
    }
  }
}

const repoRoot = findRepoRoot(dirname(fileURLToPath(import.meta.url)))
const migrationsDir = join(repoRoot, 'db', 'migrations')

function onlyMigration(pattern: RegExp, what: string): string {
  const dirs = readdirSync(migrationsDir).filter((name) => pattern.test(name))
  expect(dirs, `debe existir exactamente una migracion ${what}`).toHaveLength(1)
  return join(migrationsDir, dirs[0] as string)
}

const migrationDir = onlyMigration(/^\d{14}_customer_phone_numbers$/, '*_customer_phone_numbers')
const phoneE164Dir = onlyMigration(/^\d{14}_customers_phone_e164$/, '*_customers_phone_e164')

const upSource = readFileSync(join(migrationDir, 'migration.sql'), 'utf8')
const downSource = readFileSync(join(migrationDir, 'down.sql'), 'utf8')
const phoneE164UpSource = readFileSync(join(phoneE164Dir, 'migration.sql'), 'utf8')
const schemaSource = readFileSync(join(repoRoot, 'db', 'schema.prisma'), 'utf8')

function stripSqlComments(sql: string): string {
  return sql
    .replace(/\r\n/g, '\n')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n')
}

function statements(sql: string): readonly string[] {
  return stripSqlComments(sql)
    .split(';')
    .map((statement) => statement.replace(/\s+/g, ' ').replace(/\( /g, '(').replace(/ \)/g, ')').trim())
    .filter((statement) => statement.length > 0)
}

function indexOfStatement(sql: string, statement: string): number {
  return statements(sql).indexOf(statement)
}

const CHECK_E164 =
  'ALTER TABLE "phone_numbers" ADD CONSTRAINT "phone_numbers_e164_format_check" CHECK ("e164" ~ \'^[1-9][0-9]{6,14}$\')'
const UNIQUE_COMPANY_E164 =
  'CREATE UNIQUE INDEX "phone_numbers_company_id_e164_key" ON "phone_numbers"("company_id", "e164")'
const UNIQUE_CUSTOMER_PHONE =
  'CREATE UNIQUE INDEX "customer_phone_numbers_customer_phone_key" ON "customer_phone_numbers" ("customer_id", "phone_number_id") WHERE "deleted_at" IS NULL'
const UNIQUE_CUSTOMER_MAIN =
  'CREATE UNIQUE INDEX "customer_phone_numbers_customer_main_key" ON "customer_phone_numbers" ("customer_id") WHERE "main" AND "deleted_at" IS NULL'

const FK_LINK_CUSTOMER =
  'ALTER TABLE "customer_phone_numbers" ADD CONSTRAINT "customer_phone_numbers_company_customer_fkey" FOREIGN KEY ("company_id", "customer_id") REFERENCES "customers"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE'
const FK_LINK_PHONE =
  'ALTER TABLE "customer_phone_numbers" ADD CONSTRAINT "customer_phone_numbers_company_phone_number_fkey" FOREIGN KEY ("company_id", "phone_number_id") REFERENCES "phone_numbers"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE'
const FK_CONTACT_CUSTOMER =
  'ALTER TABLE "whatsapp_contacts" ADD CONSTRAINT "whatsapp_contacts_company_customer_fkey" FOREIGN KEY ("company_id", "customer_id") REFERENCES "customers"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE'

const NO_FORCE_CUSTOMERS = 'ALTER TABLE "customers" NO FORCE ROW LEVEL SECURITY'
const FORCE_CUSTOMERS = 'ALTER TABLE "customers" FORCE ROW LEVEL SECURITY'
const DROP_PHONE_INDEX = 'DROP INDEX "customers_company_phone_e164_key"'

const NEW_TABLES = ['phone_numbers', 'customer_phone_numbers'] as const

/** El `CREATE TABLE` de una tabla, en una sola linea. */
function createTable(sql: string, table: string): string {
  const found = statements(sql).find((statement) => statement.startsWith(`CREATE TABLE "${table}"`))
  if (found === undefined) throw new Error(`no se encontro CREATE TABLE "${table}"`)
  return found
}

/** Cada tabla nueva: `company_id` obligatoria, fechas, y RLS activada y forzada despues de la copia. */
export function tablaNuevaCompleta(sql: string, table: string): boolean {
  const create = createTable(sql, table)
  if (!create.includes('"company_id" UUID NOT NULL')) return false
  if (!create.includes('"created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP')) return false
  if (!create.includes('"updated_at" TIMESTAMPTZ(6) NOT NULL')) return false
  const enable = indexOfStatement(sql, `ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`)
  const force = indexOfStatement(sql, `ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`)
  const lastInsert = statements(sql).findLastIndex((statement) => statement.startsWith('INSERT INTO'))
  return enable >= 0 && force > enable && enable > lastInsert
}

/** La copia va entre `NO FORCE` y `FORCE` de `customers`, solo de vivos con numero, y como principal. */
export function copiaEnElParentesis(sql: string): boolean {
  const list = statements(sql)
  const noForce = list.indexOf(NO_FORCE_CUSTOMERS)
  const force = list.indexOf(FORCE_CUSTOMERS)
  const inserts = list
    .map((statement, i) => ({ statement, i }))
    .filter(({ statement }) => statement.startsWith('INSERT INTO'))
  if (noForce < 0 || force <= noForce || inserts.length !== 2) return false
  if (!inserts.every(({ i }) => i > noForce && i < force)) return false
  const [phones, links] = inserts.map(({ statement }) => statement) as [string, string]
  const vivosConNumero = /WHERE (c\.)?"deleted_at" IS NULL AND (c\.)?"phone_e164" IS NOT NULL$/
  return (
    phones.startsWith('INSERT INTO "phone_numbers"') &&
    phones.includes('SELECT DISTINCT "company_id", "phone_e164"') &&
    vivosConNumero.test(phones) &&
    links.startsWith('INSERT INTO "customer_phone_numbers"') &&
    links.includes('p."id", true,') &&
    links.includes('p."company_id" = c."company_id" AND p."e164" = c."phone_e164"') &&
    vivosConNumero.test(links)
  )
}

/** El DOWN deshace los repetidos ANTES de recrear el indice, con el desempate del relleno. */
export function downDeshaceRepetidosAntesDelIndice(sql: string): boolean {
  const list = statements(sql)
  const update = list.findIndex((statement) => statement.startsWith('UPDATE "customers"'))
  const index = list.findIndex((statement) => statement.startsWith('CREATE UNIQUE INDEX "customers_company_phone_e164_key"'))
  const noForce = list.indexOf(NO_FORCE_CUSTOMERS)
  const force = list.indexOf(FORCE_CUSTOMERS)
  if (update < 0 || index < 0 || !(noForce < update && update < force && update < index)) return false
  const text = list[update] as string
  return (
    text.includes('SET "phone_e164" = NULL, "phone_issue" = \'duplicate\'') &&
    text.includes('PARTITION BY "company_id", "phone_e164" ORDER BY "created_at" DESC, "id" DESC') &&
    text.includes('WHERE "deleted_at" IS NULL AND "phone_e164" IS NOT NULL') &&
    text.endsWith('d."rn" > 1')
  )
}

/** Orden inverso al UP: primero `whatsapp_contacts`, al final las dos tablas, puente antes que numeros. */
export function downEnOrdenInverso(sql: string): boolean {
  const list = statements(sql)
  const firstWhatsapp = list.findIndex((statement) => statement.startsWith('ALTER TABLE "whatsapp_contacts"'))
  const lastWhatsapp = list.findLastIndex((statement) => statement.startsWith('ALTER TABLE "whatsapp_contacts"'))
  const update = list.findIndex((statement) => statement.startsWith('UPDATE "customers"'))
  const dropLinks = list.indexOf('DROP TABLE "customer_phone_numbers"')
  const dropPhones = list.indexOf('DROP TABLE "phone_numbers"')
  return (
    firstWhatsapp === 0 &&
    lastWhatsapp < update &&
    dropLinks > update &&
    dropPhones === list.length - 1 &&
    dropLinks === list.length - 2
  )
}

function model(schema: string, name: string): string {
  const match = new RegExp(`model ${name} \\{[\\s\\S]*?\\n\\}`).exec(schema.replace(/\r\n/g, '\n'))
  if (match === null) throw new Error(`no se encontro el modelo ${name} en db/schema.prisma`)
  return match[0]
}

function modelLines(name: string): readonly string[] {
  return model(schemaSource, name)
    .split('\n')
    .map((line) => line.trim().replace(/\s+/g, ' '))
}

function docBlockOf(name: string): string {
  const lines = schemaSource.replace(/\r\n/g, '\n').split('\n')
  const at = lines.findIndex((line) => line.startsWith(`model ${name} {`))
  const doc: string[] = []
  for (let i = at - 1; i >= 0 && (lines[i] as string).startsWith('///'); i -= 1) doc.unshift(lines[i] as string)
  return doc.join('\n')
}

describe('customer_phone_numbers — tablas nuevas (R1, R48)', () => {
  it('R1: phone_numbers guarda solo digitos con el mismo CHECK que customers.phone_e164, uno por numero y empresa', () => {
    expect(statements(upSource)).toContain(CHECK_E164)
    expect(phoneE164UpSource).toContain("'^[1-9][0-9]{6,14}$'")
    expect(statements(upSource)).toContain(UNIQUE_COMPANY_E164)
    expect(createTable(upSource, 'phone_numbers')).toContain('"e164" VARCHAR(15) NOT NULL')
  })

  it('R1: la tabla puente une cliente y numero con la marca main y borrado logico', () => {
    const create = createTable(upSource, 'customer_phone_numbers')
    expect(create).toContain('"customer_id" UUID NOT NULL')
    expect(create).toContain('"phone_number_id" UUID NOT NULL')
    expect(create).toContain('"main" BOOLEAN NOT NULL DEFAULT false')
    expect(create).toContain('"deleted_at" TIMESTAMPTZ(6)')
    expect(create).not.toContain('"deleted_at" TIMESTAMPTZ(6) NOT NULL')
  })

  it('R1, R48: las dos tablas llevan company_id, created_at/updated_at, y RLS activada y forzada tras la copia', () => {
    for (const table of NEW_TABLES) expect(tablaNuevaCompleta(upSource, table), table).toBe(true)
  })

  it('R48: el detector muerde -sin FORCE, o el FORCE antes de la copia, dan rojo-', () => {
    const sinForce = upSource.replace('ALTER TABLE "phone_numbers" FORCE ROW LEVEL SECURITY;', '')
    expect(sinForce, 'la mutacion no se aplico').not.toBe(upSource)
    expect(tablaNuevaCompleta(sinForce, 'phone_numbers')).toBe(false)

    const forceAntes = `ALTER TABLE "customer_phone_numbers" ENABLE ROW LEVEL SECURITY;\nALTER TABLE "customer_phone_numbers" FORCE ROW LEVEL SECURITY;\n${upSource.replace(
      /ALTER TABLE "customer_phone_numbers" (ENABLE|FORCE) ROW LEVEL SECURITY;/g,
      '',
    )}`
    expect(tablaNuevaCompleta(forceAntes, 'customer_phone_numbers')).toBe(false)
  })

  it('R48: identificadores en ingles en las tablas nuevas', () => {
    const identifiers = NEW_TABLES.flatMap((table) =>
      [...createTable(upSource, table).matchAll(/"(\w+)"/g)].map((m) => m[1] as string),
    )
    expect(identifiers).toEqual(
      expect.arrayContaining(['phone_numbers', 'customer_phone_numbers', 'e164', 'main', 'phone_number_id']),
    )
    for (const id of identifiers) expect(id).not.toMatch(/telefono|cliente|empresa|numero|principal/)
  })

  it('R1, R48: los dos modelos del esquema tienen su @module clientes, sus columnas y sus fechas', () => {
    expect(docBlockOf('PhoneNumber')).toContain('/// @module clientes')
    expect(docBlockOf('CustomerPhoneNumber')).toContain('/// @module clientes')
    const phone = modelLines('PhoneNumber')
    expect(phone).toContain('companyId String @map("company_id") @db.Uuid')
    expect(phone).toContain('e164 String @db.VarChar(15)')
    expect(phone).toContain('createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)')
    expect(phone).toContain('updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)')
    expect(phone).toContain('@@unique([companyId, e164], map: "phone_numbers_company_id_e164_key")')
    expect(phone).toContain('@@map("phone_numbers")')
    const link = modelLines('CustomerPhoneNumber')
    expect(link).toContain('companyId String @map("company_id") @db.Uuid')
    expect(link).toContain('customerId String @map("customer_id") @db.Uuid')
    expect(link).toContain('phoneNumberId String @map("phone_number_id") @db.Uuid')
    expect(link).toContain('main Boolean @default(false)')
    expect(link).toContain('deletedAt DateTime? @map("deleted_at") @db.Timestamptz(6)')
    expect(link).toContain('@@map("customer_phone_numbers")')
    expect(model(schemaSource, 'CustomerPhoneNumber')).not.toMatch(/@relation/)
    expect(model(schemaSource, 'PhoneNumber')).not.toMatch(/@relation/)
  })
})

describe('customer_phone_numbers — rechazos en la base (R3, R47)', () => {
  it('R3: los dos indices unicos parciales, por nombre: mismo numero dos veces y dos principales vivos', () => {
    expect(statements(upSource)).toContain(UNIQUE_CUSTOMER_PHONE)
    expect(statements(upSource)).toContain(UNIQUE_CUSTOMER_MAIN)
  })

  it('R3: el detector muerde -un indice sin el filtro de vivos da rojo-', () => {
    const sinWhere = upSource.replace(
      '("customer_id") WHERE "main" AND "deleted_at" IS NULL;',
      '("customer_id") WHERE "main";',
    )
    expect(sinWhere, 'la mutacion no se aplico').not.toBe(upSource)
    expect(statements(sinWhere)).not.toContain(UNIQUE_CUSTOMER_MAIN)
  })

  it('R47: FK compuestas con company_id del vinculo al cliente y al numero, y del contacto al cliente', () => {
    expect(statements(upSource)).toContain(FK_LINK_CUSTOMER)
    expect(statements(upSource)).toContain(FK_LINK_PHONE)
    expect(statements(upSource)).toContain(FK_CONTACT_CUSTOMER)
    expect(statements(upSource)).toContain(
      'CREATE UNIQUE INDEX "phone_numbers_company_id_id_key" ON "phone_numbers"("company_id", "id")',
    )
  })

  it('R47: ninguna FK de las tablas nuevas o del contacto hacia customers es simple (sin company_id)', () => {
    expect(stripSqlComments(upSource)).not.toMatch(/FOREIGN KEY \("customer_id"\)/)
    expect(stripSqlComments(upSource)).not.toMatch(/FOREIGN KEY \("phone_number_id"\)/)
  })
})

describe('customer_phone_numbers — copia y retirada del indice (R5)', () => {
  it('R5: copia vivos con phone_e164 como principal, dentro del parentesis NO FORCE / FORCE de customers', () => {
    expect(copiaEnElParentesis(upSource)).toBe(true)
  })

  it('R5: el detector muerde -copia fuera del parentesis, sin filtrar bajas o sin main dan rojo-', () => {
    const fuera = upSource.replace('ALTER TABLE "customers" NO FORCE ROW LEVEL SECURITY;', '')
    expect(fuera, 'la mutacion no se aplico').not.toBe(upSource)
    expect(copiaEnElParentesis(fuera)).toBe(false)

    const conBajas = upSource.replace(
      'WHERE c."deleted_at" IS NULL AND c."phone_e164" IS NOT NULL',
      'WHERE c."phone_e164" IS NOT NULL',
    )
    expect(conBajas, 'la mutacion no se aplico').not.toBe(upSource)
    expect(copiaEnElParentesis(conBajas)).toBe(false)

    const sinMain = upSource.replace('p."id", true,', 'p."id", false,')
    expect(sinMain, 'la mutacion no se aplico').not.toBe(upSource)
    expect(copiaEnElParentesis(sinMain)).toBe(false)
  })

  it('R5, R7: el indice unico de customers.phone_e164 se retira despues de la copia', () => {
    const list = statements(upSource)
    expect(list).toContain(DROP_PHONE_INDEX)
    expect(list.indexOf(DROP_PHONE_INDEX)).toBeGreaterThan(list.indexOf(FORCE_CUSTOMERS))
  })

  it('R48: whatsapp_contacts gana customer_linked_by, blocked_at y blocked_by nulas, en ingles, con sus dos CHECK', () => {
    const list = statements(upSource)
    expect(list).toContain('ALTER TABLE "whatsapp_contacts" ADD COLUMN "customer_linked_by" UUID')
    expect(list).toContain('ALTER TABLE "whatsapp_contacts" ADD COLUMN "blocked_at" TIMESTAMPTZ(6)')
    expect(list).toContain('ALTER TABLE "whatsapp_contacts" ADD COLUMN "blocked_by" UUID')
    expect(list).toContain(
      'ALTER TABLE "whatsapp_contacts" ADD CONSTRAINT "whatsapp_contacts_customer_link_check" CHECK ("customer_linked_by" IS NULL OR "customer_id" IS NOT NULL)',
    )
    expect(list).toContain(
      'ALTER TABLE "whatsapp_contacts" ADD CONSTRAINT "whatsapp_contacts_blocked_check" CHECK (("blocked_at" IS NULL) = ("blocked_by" IS NULL))',
    )
    const contact = modelLines('WhatsappContact')
    expect(contact).toContain('customerLinkedBy String? @map("customer_linked_by") @db.Uuid')
    expect(contact).toContain('blockedAt DateTime? @map("blocked_at") @db.Timestamptz(6)')
    expect(contact).toContain('blockedBy String? @map("blocked_by") @db.Uuid')
  })

  it('R7: el comentario del modelo Customer ya no dice que phone_e164 es unico', () => {
    expect(docBlockOf('Customer')).not.toMatch(/no se repite/)
  })
})

describe('customer_phone_numbers — down.sql (R6)', () => {
  it('R6: deshace los repetidos con el desempate del relleno, dentro del parentesis de RLS, antes del indice', () => {
    expect(downDeshaceRepetidosAntesDelIndice(downSource)).toBe(true)
  })

  it('R6: recrea el indice unico exactamente como lo creo la migracion de phone_e164', () => {
    const original = statements(phoneE164UpSource).find((s) => s.startsWith('CREATE UNIQUE INDEX'))
    expect(original).toBeDefined()
    expect(statements(downSource)).toContain(original)
  })

  it('R6: revierte en orden inverso y quita todo lo que el UP anade', () => {
    expect(downEnOrdenInverso(downSource)).toBe(true)
    const list = statements(downSource)
    for (const expected of [
      'ALTER TABLE "whatsapp_contacts" DROP CONSTRAINT "whatsapp_contacts_company_customer_fkey"',
      'ALTER TABLE "whatsapp_contacts" DROP CONSTRAINT "whatsapp_contacts_blocked_check"',
      'ALTER TABLE "whatsapp_contacts" DROP CONSTRAINT "whatsapp_contacts_customer_link_check"',
      'ALTER TABLE "whatsapp_contacts" DROP COLUMN "blocked_by"',
      'ALTER TABLE "whatsapp_contacts" DROP COLUMN "blocked_at"',
      'ALTER TABLE "whatsapp_contacts" DROP COLUMN "customer_linked_by"',
    ]) {
      expect(list).toContain(expected)
    }
  })

  it('R6: el detector muerde -indice antes del UPDATE, desempate al reves u orden de DROP invertido dan rojo-', () => {
    const list = statements(downSource)
    const update = list.find((s) => s.startsWith('UPDATE "customers"')) as string
    const index = list.find((s) => s.startsWith('CREATE UNIQUE INDEX')) as string
    const indiceAntes = list
      .filter((s) => s !== index)
      .flatMap((s) => (s === update ? [index, s] : [s]))
      .join(';\n')
    expect(downDeshaceRepetidosAntesDelIndice(indiceAntes)).toBe(false)

    const alReves = downSource.replace('ORDER BY "created_at" DESC, "id" DESC', 'ORDER BY "created_at" ASC, "id" ASC')
    expect(alReves, 'la mutacion no se aplico').not.toBe(downSource)
    expect(downDeshaceRepetidosAntesDelIndice(alReves)).toBe(false)

    const dropsAlReves = downSource
      .replace('DROP TABLE "customer_phone_numbers";', 'DROP TABLE "__x__";')
      .replace('DROP TABLE "phone_numbers";', 'DROP TABLE "customer_phone_numbers";')
      .replace('DROP TABLE "__x__";', 'DROP TABLE "phone_numbers";')
    expect(downEnOrdenInverso(dropsAlReves)).toBe(false)
  })
})

describe('sin citas ni acentos', () => {
  it('ni migration.sql ni down.sql citan fichas o requisitos, ni llevan acentos', () => {
    for (const fuente of [upSource, downSource]) {
      expect(fuente).not.toMatch(/\bR\d+\b/)
      expect(fuente).not.toMatch(/\bQC-\d+\b/)
      expect(fuente).not.toMatch(/design\.md/)
      expect(fuente).not.toMatch(/[áéíóúñÁÉÍÓÚÑ]/)
    }
  })
})
