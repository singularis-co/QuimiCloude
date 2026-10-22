// La migracion `db/migrations/*_customer_phone_numbers/` contra Postgres REAL.
//
// AISLAMIENTO — mismo patron que `customers-phone-migration.int.test.ts`: cada `it` corre dentro de
// `prisma.$transaction` interactiva y termina lanzando `RollbackSignal`. Lo que se espera que falle
// va en su propio `SAVEPOINT` (`expectRejectedByDatabase`). El SQL se lee del archivo: el DDL de
// Postgres es transaccional, asi que UP y DOWN se deshacen con el ROLLBACK.
import { randomUUID } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { Prisma } from '@prisma/client'
import { afterAll, describe, expect, it } from 'vitest'

import { normalizeCompanyName } from '@/lib/modules/identity'
import { prisma } from '@/lib/shared/db/prisma'

class RollbackSignal extends Error {
  constructor() {
    super('rollback de aislamiento del test')
    this.name = 'RollbackSignal'
  }
}

async function inRolledBackTransaction(
  body: (tx: Prisma.TransactionClient) => Promise<void>,
): Promise<void> {
  try {
    await prisma.$transaction(
      async (tx) => {
        await body(tx)
        throw new RollbackSignal()
      },
      { maxWait: 10_000, timeout: 60_000 },
    )
  } catch (error) {
    if (!(error instanceof RollbackSignal)) throw error
  }
}

const CHECK_VIOLATION = '23514'
const UNIQUE_VIOLATION = '23505'
const FOREIGN_KEY_VIOLATION = '23503'
let savepointSeq = 0

function sqlStateOf(error: unknown): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const meta: unknown = error.meta
    if (typeof meta === 'object' && meta !== null && 'code' in meta) {
      const code: unknown = (meta as { code: unknown }).code
      if (typeof code === 'string') return code
    }
    return error.code
  }
  return error instanceof Error ? error.message : String(error)
}

async function expectRejectedByDatabase(
  tx: Prisma.TransactionClient,
  run: () => Promise<unknown>,
  what: string,
): Promise<string> {
  savepointSeq += 1
  const savepoint = `qc239_sp_${String(savepointSeq)}`
  await tx.$executeRawUnsafe(`SAVEPOINT ${savepoint}`)
  try {
    await run()
  } catch (error) {
    await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${savepoint}`)
    return sqlStateOf(error)
  }
  await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${savepoint}`)
  throw new Error(`se esperaba que la base rechazara la operacion, pero la acepto: ${what}`)
}

function asUuid(id: string): Prisma.Sql {
  return Prisma.sql`CAST(${id} AS uuid)`
}

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

function locateMigrationDir(): string {
  const migrationsDir = join(findRepoRoot(dirname(fileURLToPath(import.meta.url))), 'db', 'migrations')
  const carpetas = readdirSync(migrationsDir).filter((name) => /^\d{14}_customer_phone_numbers$/.test(name))
  expect(carpetas, 'debe existir exactamente una migracion *_customer_phone_numbers').toHaveLength(1)
  return join(migrationsDir, carpetas[0] as string)
}

function statementsOf(sql: string): readonly string[] {
  return sql
    .replace(/\r\n/g, '\n')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .map((line) => line.replace(/--.*$/, ''))
    .join('\n')
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0)
}

const migrationDir = locateMigrationDir()
const UP_STATEMENTS = statementsOf(readFileSync(join(migrationDir, 'migration.sql'), 'utf8'))
const DOWN_STATEMENTS = statementsOf(readFileSync(join(migrationDir, 'down.sql'), 'utf8'))

async function applyStatements(tx: Prisma.TransactionClient, statements: readonly string[]): Promise<void> {
  for (const statement of statements) {
    await tx.$executeRawUnsafe(statement)
  }
}

const NEW_TABLES = ['phone_numbers', 'customer_phone_numbers'] as const
const TOUCHED_TABLES = [...NEW_TABLES, 'customers', 'whatsapp_contacts'] as const

/** Lo que la migracion define o cambia, leido del catalogo y en orden estable. */
async function schemaSnapshot(tx: Prisma.TransactionClient) {
  const tables = [...TOUCHED_TABLES]
  const columns = await tx.$queryRaw<
    { table_name: string; column_name: string; data_type: string; is_nullable: string; column_default: string | null }[]
  >`
    SELECT table_name, column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ANY(${tables})
    ORDER BY table_name, column_name`
  const indexes = await tx.$queryRaw<{ tablename: string; indexname: string; indexdef: string }[]>`
    SELECT tablename, indexname, indexdef FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = ANY(${tables})
    ORDER BY tablename, indexname`
  const constraints = await tx.$queryRaw<{ relname: string; conname: string; def: string }[]>`
    SELECT t.relname, c.conname, pg_get_constraintdef(c.oid) AS def
    FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = ANY(${tables}) AND t.relnamespace = 'public'::regnamespace
    ORDER BY t.relname, c.conname`
  const rls = await tx.$queryRaw<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }[]>`
    SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
    WHERE relname = ANY(${tables}) AND relnamespace = 'public'::regnamespace
    ORDER BY relname`
  return { columns, indexes, constraints, rls }
}

async function tableExists(tx: Prisma.TransactionClient, table: string): Promise<boolean> {
  const rows = await tx.$queryRaw<{ n: bigint }[]>`
    SELECT count(*) AS n FROM pg_tables WHERE schemaname = 'public' AND tablename = ${table}`
  return Number(rows[0]?.n ?? 0) === 1
}

async function indexExists(tx: Prisma.TransactionClient, index: string): Promise<boolean> {
  const rows = await tx.$queryRaw<{ n: bigint }[]>`
    SELECT count(*) AS n FROM pg_indexes WHERE schemaname = 'public' AND indexname = ${index}`
  return Number(rows[0]?.n ?? 0) === 1
}

async function createCompany(tx: Prisma.TransactionClient): Promise<string> {
  const name = `Empresa ${randomUUID().replace(/-/gu, '')}`
  const company = await tx.company.create({
    data: { name, nameNormalized: normalizeCompanyName(name) },
    select: { id: true },
  })
  return company.id
}

type CustomerValues = {
  readonly phone?: string | null
  readonly phoneCountry?: string | null
  readonly phoneE164?: string | null
  readonly phoneIssue?: string | null
  readonly deletedAt?: Date | null
  readonly createdAt?: Date
}

async function insertCustomer(
  tx: Prisma.TransactionClient,
  companyId: string,
  values: CustomerValues,
): Promise<string> {
  const id = randomUUID()
  await tx.$executeRaw`
    INSERT INTO "customers"
      (id, first_names, last_names, city, first_names_normalized, last_names_normalized,
       city_normalized, phone, phone_country, phone_e164, phone_issue, company_id, deleted_at,
       created_at, updated_at)
    VALUES
      (${asUuid(id)}, 'Ana', 'Ruiz', 'Cali', 'ana', 'ruiz', 'cali', ${values.phone ?? null},
       ${values.phoneCountry ?? null}, ${values.phoneE164 ?? null}, ${values.phoneIssue ?? null},
       ${asUuid(companyId)}, ${values.deletedAt ?? null}, ${values.createdAt ?? new Date()},
       CURRENT_TIMESTAMP)`
  return id
}

function withNumber(e164: string): CustomerValues {
  return { phone: `+${e164}`, phoneCountry: 'CO', phoneE164: e164 }
}

async function insertPhoneNumber(tx: Prisma.TransactionClient, companyId: string, e164: string): Promise<string> {
  const id = randomUUID()
  await tx.$executeRaw`
    INSERT INTO "phone_numbers" (id, company_id, e164, updated_at)
    VALUES (${asUuid(id)}, ${asUuid(companyId)}, ${e164}, CURRENT_TIMESTAMP)`
  return id
}

async function insertLink(
  tx: Prisma.TransactionClient,
  values: {
    readonly companyId: string
    readonly customerId: string
    readonly phoneNumberId: string
    readonly main: boolean
    readonly deletedAt?: Date | null
  },
): Promise<string> {
  const id = randomUUID()
  await tx.$executeRaw`
    INSERT INTO "customer_phone_numbers"
      (id, company_id, customer_id, phone_number_id, main, deleted_at, updated_at)
    VALUES (${asUuid(id)}, ${asUuid(values.companyId)}, ${asUuid(values.customerId)},
            ${asUuid(values.phoneNumberId)}, ${values.main}, ${values.deletedAt ?? null}, CURRENT_TIMESTAMP)`
  return id
}

type LinkRow = { customer_id: string; e164: string; main: boolean; deleted_at: Date | null }

async function linksOf(tx: Prisma.TransactionClient, customerIds: readonly string[]): Promise<LinkRow[]> {
  return tx.$queryRaw<LinkRow[]>`
    SELECT l.customer_id::text AS customer_id, p.e164, l.main, l.deleted_at
    FROM customer_phone_numbers l JOIN phone_numbers p ON p.id = l.phone_number_id
    WHERE l.customer_id::text = ANY(${[...customerIds]})
    ORDER BY l.customer_id, p.e164`
}

type PhoneRow = { id: string; phone: string | null; phone_e164: string | null; phone_issue: string | null }

async function phoneOf(tx: Prisma.TransactionClient, id: string): Promise<PhoneRow> {
  const rows = await tx.$queryRaw<PhoneRow[]>`
    SELECT id::text AS id, phone, phone_e164, phone_issue FROM customers WHERE id = ${asUuid(id)}`
  const row = rows[0]
  if (row === undefined) throw new Error(`no existe el cliente ${id}`)
  return row
}

/** Una conexion viva y un contacto suyo, en la empresa dada. El usuario creador sale de la semilla. */
async function insertContact(tx: Prisma.TransactionClient, companyId: string): Promise<string> {
  const users = await tx.$queryRaw<{ id: string }[]>`SELECT id::text AS id FROM users LIMIT 1`
  const userId = users[0]?.id
  if (userId === undefined) throw new Error('la base de test no tiene ningun usuario sembrado')
  const connectionId = randomUUID()
  const marker = randomUUID().replace(/-/gu, '')
  await tx.$executeRaw`
    INSERT INTO "whatsapp_connections"
      (id, company_id, display_name, waba_id, phone_number_id, access_token_enc, app_secret_enc,
       verify_token_hash, created_by, updated_at)
    VALUES (${asUuid(connectionId)}, ${asUuid(companyId)}, 'Ventas', ${`waba-${marker}`},
            ${`phone-${marker}`}, 'v1:x', 'v1:y', ${'a'.repeat(64)}, ${asUuid(userId)}, CURRENT_TIMESTAMP)`
  const contactId = randomUUID()
  await tx.$executeRaw`
    INSERT INTO "whatsapp_contacts" (id, company_id, connection_id, wa_id, updated_at)
    VALUES (${asUuid(contactId)}, ${asUuid(companyId)}, ${asUuid(connectionId)}, '573001234567', CURRENT_TIMESTAMP)`
  return contactId
}

afterAll(async () => {
  await prisma.$disconnect()
})

describe('migracion customer_phone_numbers contra Postgres real', () => {
  it('R6, R48: UP, DOWN y UP otra vez dejan exactamente el mismo esquema, y el DOWN lo deja como antes', async () => {
    await inRolledBackTransaction(async (tx) => {
      const despuesDelUp = await schemaSnapshot(tx)
      expect(await indexExists(tx, 'customers_company_phone_e164_key')).toBe(false)

      await applyStatements(tx, DOWN_STATEMENTS)
      for (const table of NEW_TABLES) expect(await tableExists(tx, table), table).toBe(false)
      expect(await indexExists(tx, 'customers_company_phone_e164_key')).toBe(true)
      const contactColumns = await tx.$queryRaw<{ column_name: string }[]>`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'whatsapp_contacts'
          AND column_name IN ('customer_linked_by', 'blocked_at', 'blocked_by')`
      expect(contactColumns).toEqual([])
      const contactFk = await tx.$queryRaw<{ conname: string }[]>`
        SELECT conname FROM pg_constraint WHERE conname = 'whatsapp_contacts_company_customer_fkey'`
      expect(contactFk).toEqual([])

      await applyStatements(tx, UP_STATEMENTS)
      expect(await schemaSnapshot(tx)).toEqual(despuesDelUp)
    })
  })

  it('R48: las dos tablas nuevas tienen RLS activada y forzada, y created_at/updated_at', async () => {
    await inRolledBackTransaction(async (tx) => {
      const rls = await tx.$queryRaw<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }[]>`
        SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class
        WHERE relname = ANY(${[...NEW_TABLES]}) AND relnamespace = 'public'::regnamespace
        ORDER BY relname`
      expect(rls).toEqual([
        { relname: 'customer_phone_numbers', relrowsecurity: true, relforcerowsecurity: true },
        { relname: 'phone_numbers', relrowsecurity: true, relforcerowsecurity: true },
      ])
      const customersRls = await tx.$queryRaw<{ relforcerowsecurity: boolean }[]>`
        SELECT relforcerowsecurity FROM pg_class
        WHERE relname = 'customers' AND relnamespace = 'public'::regnamespace`
      expect(customersRls).toEqual([{ relforcerowsecurity: true }])
      for (const table of NEW_TABLES) {
        const dates = await tx.$queryRaw<{ column_name: string; is_nullable: string }[]>`
          SELECT column_name, is_nullable FROM information_schema.columns
          WHERE table_name = ${table} AND column_name IN ('created_at', 'updated_at', 'company_id')
          ORDER BY column_name`
        expect(dates, table).toEqual([
          { column_name: 'company_id', is_nullable: 'NO' },
          { column_name: 'created_at', is_nullable: 'NO' },
          { column_name: 'updated_at', is_nullable: 'NO' },
        ])
      }
    })
  })

  it('R5: la copia crea el numero y el vinculo principal de cada vivo con phone_e164; con aviso, pendiente, sin telefono o de baja, nada', async () => {
    await inRolledBackTransaction(async (tx) => {
      await applyStatements(tx, DOWN_STATEMENTS)

      const companyId = await createCompany(tx)
      const otherCompanyId = await createCompany(tx)
      const conNumero = await insertCustomer(tx, companyId, withNumber('573001234567'))
      const otroConNumero = await insertCustomer(tx, companyId, withNumber('573009876543'))
      const mismaCifraOtraEmpresa = await insertCustomer(tx, otherCompanyId, withNumber('573001234567'))
      const conAviso = await insertCustomer(tx, companyId, {
        phone: '300 123',
        phoneCountry: 'CO',
        phoneIssue: 'invalid_format',
      })
      const duplicado = await insertCustomer(tx, companyId, {
        phone: '300 123 4567',
        phoneCountry: 'CO',
        phoneIssue: 'duplicate',
      })
      const pendiente = await insertCustomer(tx, companyId, { phone: '300 555 0000' })
      const sinTelefono = await insertCustomer(tx, companyId, {})
      const deBaja = await insertCustomer(tx, companyId, {
        ...withNumber('573005550000'),
        deletedAt: new Date(),
      })

      await applyStatements(tx, UP_STATEMENTS)

      expect(
        await linksOf(tx, [conNumero, otroConNumero, mismaCifraOtraEmpresa, conAviso, duplicado, pendiente, sinTelefono, deBaja]),
      ).toEqual(
        [
          { customer_id: conNumero, e164: '573001234567', main: true, deleted_at: null },
          { customer_id: otroConNumero, e164: '573009876543', main: true, deleted_at: null },
          { customer_id: mismaCifraOtraEmpresa, e164: '573001234567', main: true, deleted_at: null },
        ].sort((a, b) => (a.customer_id < b.customer_id ? -1 : a.customer_id > b.customer_id ? 1 : 0)),
      )

      const numbers = await tx.$queryRaw<{ company_id: string; e164: string }[]>`
        SELECT company_id::text AS company_id, e164 FROM phone_numbers
        WHERE company_id::text = ANY(${[companyId, otherCompanyId]})
        ORDER BY company_id, e164`
      expect(numbers).toEqual(
        [
          { company_id: companyId, e164: '573001234567' },
          { company_id: companyId, e164: '573009876543' },
          { company_id: otherCompanyId, e164: '573001234567' },
        ].sort((a, b) =>
          a.company_id === b.company_id ? a.e164.localeCompare(b.e164) : a.company_id < b.company_id ? -1 : 1,
        ),
      )

      // Las columnas de customers no cambian con la copia.
      expect(await phoneOf(tx, conNumero)).toEqual({
        id: conNumero,
        phone: '+573001234567',
        phone_e164: '573001234567',
        phone_issue: null,
      })
      expect((await phoneOf(tx, conAviso)).phone_issue).toBe('invalid_format')
    })
  })

  it('R6: tras el UP dos clientes vivos comparten numero; el DOWN deja el numero al mas reciente y al otro duplicate, y el UP vuelve a funcionar', async () => {
    await inRolledBackTransaction(async (tx) => {
      const companyId = await createCompany(tx)
      const otherCompanyId = await createCompany(tx)
      const numero = '573001234567'
      const antiguo = await insertCustomer(tx, companyId, {
        ...withNumber(numero),
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      })
      const reciente = await insertCustomer(tx, companyId, {
        ...withNumber(numero),
        createdAt: new Date('2026-06-01T00:00:00.000Z'),
      })
      const deOtraEmpresa = await insertCustomer(tx, otherCompanyId, {
        ...withNumber(numero),
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
      })
      const deBaja = await insertCustomer(tx, companyId, {
        ...withNumber(numero),
        createdAt: new Date('2027-01-01T00:00:00.000Z'),
        deletedAt: new Date(),
      })

      await applyStatements(tx, DOWN_STATEMENTS)

      expect(await phoneOf(tx, reciente)).toEqual({
        id: reciente,
        phone: `+${numero}`,
        phone_e164: numero,
        phone_issue: null,
      })
      expect(await phoneOf(tx, antiguo)).toEqual({
        id: antiguo,
        phone: `+${numero}`,
        phone_e164: null,
        phone_issue: 'duplicate',
      })
      expect((await phoneOf(tx, deOtraEmpresa)).phone_e164).toBe(numero)
      expect((await phoneOf(tx, deBaja)).phone_e164).toBe(numero)
      expect(await indexExists(tx, 'customers_company_phone_e164_key')).toBe(true)

      await applyStatements(tx, UP_STATEMENTS)

      expect(await linksOf(tx, [antiguo, reciente])).toEqual([
        { customer_id: reciente, e164: numero, main: true, deleted_at: null },
      ])
    })
  })

  it('R6: empate de fecha: se queda el numero el de id mayor', async () => {
    await inRolledBackTransaction(async (tx) => {
      const companyId = await createCompany(tx)
      const createdAt = new Date('2026-03-03T00:00:00.000Z')
      const a = await insertCustomer(tx, companyId, { ...withNumber('573001112233'), createdAt })
      const b = await insertCustomer(tx, companyId, { ...withNumber('573001112233'), createdAt })
      const [menor, mayor] = a < b ? [a, b] : [b, a]

      await applyStatements(tx, DOWN_STATEMENTS)

      expect((await phoneOf(tx, mayor)).phone_e164).toBe('573001112233')
      expect(await phoneOf(tx, menor)).toMatchObject({ phone_e164: null, phone_issue: 'duplicate' })
    })
  })

  it('R1: phone_numbers solo admite digitos, de 7 a 15, sin empezar por 0, y un numero por empresa', async () => {
    await inRolledBackTransaction(async (tx) => {
      const companyId = await createCompany(tx)
      for (const valor of ['+573001234567', '57 3001234567', '123456', '0573001234567']) {
        expect(
          await expectRejectedByDatabase(tx, () => insertPhoneNumber(tx, companyId, valor), `e164=${valor}`),
        ).toBe(CHECK_VIOLATION)
      }
      await insertPhoneNumber(tx, companyId, '573001234567')
      expect(
        await expectRejectedByDatabase(
          tx,
          () => insertPhoneNumber(tx, companyId, '573001234567'),
          'mismo numero dos veces en la empresa',
        ),
      ).toBe(UNIQUE_VIOLATION)
      await insertPhoneNumber(tx, await createCompany(tx), '573001234567')
    })
  })

  it('R3: la base rechaza el mismo numero vivo dos veces en un cliente y un segundo principal vivo; un vinculo quitado no cuenta', async () => {
    await inRolledBackTransaction(async (tx) => {
      const companyId = await createCompany(tx)
      const customerId = await insertCustomer(tx, companyId, {})
      const a = await insertPhoneNumber(tx, companyId, '573001234567')
      const b = await insertPhoneNumber(tx, companyId, '573009876543')

      await insertLink(tx, { companyId, customerId, phoneNumberId: a, main: true })
      expect(
        await expectRejectedByDatabase(
          tx,
          () => insertLink(tx, { companyId, customerId, phoneNumberId: a, main: false }),
          'mismo numero vivo dos veces',
        ),
      ).toBe(UNIQUE_VIOLATION)
      expect(
        await expectRejectedByDatabase(
          tx,
          () => insertLink(tx, { companyId, customerId, phoneNumberId: b, main: true }),
          'dos principales vivos',
        ),
      ).toBe(UNIQUE_VIOLATION)

      await insertLink(tx, { companyId, customerId, phoneNumberId: b, main: true, deletedAt: new Date() })
      await insertLink(tx, { companyId, customerId, phoneNumberId: a, main: false, deletedAt: new Date() })
      await insertLink(tx, { companyId, customerId, phoneNumberId: b, main: false })
    })
  })

  it('R47: la base rechaza un vinculo entre un cliente y un numero de empresas distintas', async () => {
    await inRolledBackTransaction(async (tx) => {
      const companyId = await createCompany(tx)
      const otherCompanyId = await createCompany(tx)
      const customerId = await insertCustomer(tx, companyId, {})
      const ajeno = await insertPhoneNumber(tx, otherCompanyId, '573001234567')
      const propio = await insertPhoneNumber(tx, companyId, '573001234567')

      expect(
        await expectRejectedByDatabase(
          tx,
          () => insertLink(tx, { companyId, customerId, phoneNumberId: ajeno, main: true }),
          'numero de otra empresa',
        ),
      ).toBe(FOREIGN_KEY_VIOLATION)
      expect(
        await expectRejectedByDatabase(
          tx,
          () => insertLink(tx, { companyId: otherCompanyId, customerId, phoneNumberId: ajeno, main: true }),
          'cliente de otra empresa',
        ),
      ).toBe(FOREIGN_KEY_VIOLATION)
      await insertLink(tx, { companyId, customerId, phoneNumberId: propio, main: true })
    })
  })

  it('R47: la base rechaza que un contacto apunte a un cliente de otra empresa, y acepta uno de la suya', async () => {
    await inRolledBackTransaction(async (tx) => {
      const companyId = await createCompany(tx)
      const otherCompanyId = await createCompany(tx)
      const contactId = await insertContact(tx, companyId)
      const ajeno = await insertCustomer(tx, otherCompanyId, {})
      const propio = await insertCustomer(tx, companyId, {})

      expect(
        await expectRejectedByDatabase(
          tx,
          () => tx.$executeRaw`UPDATE whatsapp_contacts SET customer_id = ${asUuid(ajeno)} WHERE id = ${asUuid(contactId)}`,
          'contacto con cliente de otra empresa',
        ),
      ).toBe(FOREIGN_KEY_VIOLATION)
      await tx.$executeRaw`UPDATE whatsapp_contacts SET customer_id = ${asUuid(propio)} WHERE id = ${asUuid(contactId)}`
    })
  })

  it('R48: los CHECK del contacto: marca manual solo con cliente, y fecha y usuario del bloqueo juntos', async () => {
    await inRolledBackTransaction(async (tx) => {
      const companyId = await createCompany(tx)
      const contactId = await insertContact(tx, companyId)
      const userId = randomUUID()

      expect(
        await expectRejectedByDatabase(
          tx,
          () =>
            tx.$executeRaw`UPDATE whatsapp_contacts SET customer_linked_by = ${asUuid(userId)} WHERE id = ${asUuid(contactId)}`,
          'marca manual sin cliente',
        ),
      ).toBe(CHECK_VIOLATION)
      expect(
        await expectRejectedByDatabase(
          tx,
          () => tx.$executeRaw`UPDATE whatsapp_contacts SET blocked_at = now() WHERE id = ${asUuid(contactId)}`,
          'bloqueo sin usuario',
        ),
      ).toBe(CHECK_VIOLATION)
      expect(
        await expectRejectedByDatabase(
          tx,
          () => tx.$executeRaw`UPDATE whatsapp_contacts SET blocked_by = ${asUuid(userId)} WHERE id = ${asUuid(contactId)}`,
          'usuario sin fecha de bloqueo',
        ),
      ).toBe(CHECK_VIOLATION)
      await tx.$executeRaw`
        UPDATE whatsapp_contacts SET blocked_at = now(), blocked_by = ${asUuid(userId)} WHERE id = ${asUuid(contactId)}`
    })
  })
})
