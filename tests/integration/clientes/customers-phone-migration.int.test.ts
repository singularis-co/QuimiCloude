// La migracion `db/migrations/*_customers_phone_e164/` contra Postgres REAL.
//
// AISLAMIENTO — mismo patron que `customers-search-migration.int.test.ts`: cada `it` corre dentro de
// `prisma.$transaction` interactiva y termina lanzando `RollbackSignal`. Lo que se espera que falle
// va en su propio `SAVEPOINT` (`expectRejectedByDatabase`). El SQL se lee del archivo.
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
      { maxWait: 10_000, timeout: 30_000 },
    )
  } catch (error) {
    if (!(error instanceof RollbackSignal)) throw error
  }
}

const CHECK_VIOLATION = '23514'
/** `string_data_right_truncation`: `VARCHAR(2)` corta un valor mas largo antes de que el CHECK
 *  llegue a mirarlo. Tambien es un rechazo de R15. */
const STRING_TOO_LONG = '22001'
const UNIQUE_VIOLATION = '23505'
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
  const savepoint = `qc236_sp_${String(savepointSeq)}`
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

async function createCompany(tx: Prisma.TransactionClient): Promise<string> {
  const name = `Empresa ${randomUUID().replace(/-/gu, '')}`
  const company = await tx.company.create({
    data: { name, nameNormalized: normalizeCompanyName(name) },
    select: { id: true },
  })
  return company.id
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
  const carpetas = readdirSync(migrationsDir).filter((name) => /^\d{14}_customers_phone_e164$/.test(name))
  expect(carpetas, 'debe existir exactamente una migracion *_customers_phone_e164').toHaveLength(1)
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

async function phoneColumns(tx: Prisma.TransactionClient): Promise<readonly string[]> {
  const rows = await tx.$queryRaw<{ column_name: string }[]>`
    SELECT column_name FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name LIKE 'phone%'
    ORDER BY column_name`
  return rows.map((row) => row.column_name)
}

/** Fila cruda con solo las columnas obligatorias mas `phone` y las tres nuevas que se pidan. */
async function insertCustomer(
  tx: Prisma.TransactionClient,
  companyId: string,
  values: {
    readonly phone?: string | null
    readonly phoneCountry?: string | null
    readonly phoneE164?: string | null
    readonly phoneIssue?: string | null
    readonly deletedAt?: Date | null
  },
): Promise<string> {
  const id = randomUUID()
  await tx.$executeRaw`
    INSERT INTO "customers"
      (id, first_names, last_names, city, first_names_normalized, last_names_normalized,
       city_normalized, phone, phone_country, phone_e164, phone_issue, company_id, deleted_at,
       updated_at)
    VALUES
      (${asUuid(id)}, 'Ana', 'Ruiz', 'Cali', 'ana', 'ruiz', 'cali', ${values.phone ?? null},
       ${values.phoneCountry ?? null}, ${values.phoneE164 ?? null}, ${values.phoneIssue ?? null},
       ${asUuid(companyId)}, ${values.deletedAt ?? null}, CURRENT_TIMESTAMP)`
  return id
}

afterAll(async () => {
  await prisma.$disconnect()
})

describe('migracion customers_phone_e164 contra Postgres real', () => {
  it('R23: UP, DOWN y UP otra vez funcionan, y el DOWN deja intacto `phone`', async () => {
    await inRolledBackTransaction(async (tx) => {
      const companyId = await createCompany(tx)
      const id = await insertCustomer(tx, companyId, {
        phone: '300 123 4567',
        phoneCountry: 'CO',
        phoneE164: '573001234567',
      })

      expect(await phoneColumns(tx)).toEqual(['phone', 'phone_country', 'phone_e164', 'phone_issue'])

      await applyStatements(tx, DOWN_STATEMENTS)
      expect(await phoneColumns(tx)).toEqual(['phone'])
      const trasDown = await tx.$queryRaw<{ phone: string | null }[]>`
        SELECT phone FROM customers WHERE id = ${asUuid(id)}`
      expect(trasDown).toEqual([{ phone: '300 123 4567' }])

      await applyStatements(tx, UP_STATEMENTS)
      expect(await phoneColumns(tx)).toEqual(['phone', 'phone_country', 'phone_e164', 'phone_issue'])
      const trasUp = await tx.$queryRaw<
        { phone: string | null; phone_country: string | null; phone_e164: string | null; phone_issue: string | null }[]
      >`SELECT phone, phone_country, phone_e164, phone_issue FROM customers WHERE id = ${asUuid(id)}`
      expect(trasUp).toEqual([{ phone: '300 123 4567', phone_country: null, phone_e164: null, phone_issue: null }])
    })
  })

  it('R15: la base rechaza un phone_country que no son dos letras mayusculas', async () => {
    await inRolledBackTransaction(async (tx) => {
      const companyId = await createCompany(tx)
      // Mas de dos caracteres: lo para la longitud de la columna. De dos caracteres invalidos: el CHECK.
      for (const valor of ['col', 'COL']) {
        const sqlState = await expectRejectedByDatabase(
          tx,
          () => insertCustomer(tx, companyId, { phone: '1', phoneCountry: valor }),
          `phone_country=${valor}`,
        )
        expect(sqlState).toBe(STRING_TOO_LONG)
      }
      for (const valor of ['co', 'C1', 'c', 'C-']) {
        const sqlState = await expectRejectedByDatabase(
          tx,
          () => insertCustomer(tx, companyId, { phone: '1', phoneCountry: valor }),
          `phone_country=${valor}`,
        )
        expect(sqlState).toBe(CHECK_VIOLATION)
      }
    })
  })

  it('R16: la base rechaza un phone_e164 con +, espacios, corto, largo o que empieza por 0', async () => {
    await inRolledBackTransaction(async (tx) => {
      const companyId = await createCompany(tx)
      for (const valor of ['+573001234567', '57 3001234567', '123456', '0573001234567']) {
        const sqlState = await expectRejectedByDatabase(
          tx,
          () => insertCustomer(tx, companyId, { phone: 'x', phoneCountry: 'CO', phoneE164: valor }),
          `phone_e164=${valor}`,
        )
        expect(sqlState).toBe(CHECK_VIOLATION)
      }
    })
  })

  it('R16: la base rechaza un phone_e164 sin phone_country', async () => {
    await inRolledBackTransaction(async (tx) => {
      const companyId = await createCompany(tx)
      const sqlState = await expectRejectedByDatabase(
        tx,
        () => insertCustomer(tx, companyId, { phone: 'x', phoneE164: '573001234567' }),
        'phone_e164 sin phone_country',
      )
      expect(sqlState).toBe(CHECK_VIOLATION)
    })
  })

  it('R23: la base rechaza un phone_issue fuera de la lista o junto a un phone_e164', async () => {
    await inRolledBackTransaction(async (tx) => {
      const companyId = await createCompany(tx)
      expect(
        await expectRejectedByDatabase(
          tx,
          () => insertCustomer(tx, companyId, { phone: 'x', phoneCountry: 'CO', phoneIssue: 'otro' }),
          'phone_issue fuera de la lista',
        ),
      ).toBe(CHECK_VIOLATION)
      expect(
        await expectRejectedByDatabase(
          tx,
          () =>
            insertCustomer(tx, companyId, {
              phone: 'x',
              phoneCountry: 'CO',
              phoneE164: '573001234567',
              phoneIssue: 'duplicate',
            }),
          'phone_issue junto a phone_e164',
        ),
      ).toBe(CHECK_VIOLATION)
      expect(
        await expectRejectedByDatabase(
          tx,
          () => insertCustomer(tx, companyId, { phoneCountry: 'CO', phoneIssue: 'invalid_format' }),
          'phone_issue sin phone',
        ),
      ).toBe(CHECK_VIOLATION)
    })
  })

  it('R14: el indice parcial rechaza el mismo phone_e164 entre vivos de la misma empresa y admite baja u otra empresa', async () => {
    await inRolledBackTransaction(async (tx) => {
      const companyId = await createCompany(tx)
      const otraEmpresa = await createCompany(tx)
      const numero = { phone: '+57 300 123 4567', phoneCountry: 'CO', phoneE164: '573001234567' }

      await insertCustomer(tx, companyId, numero)
      expect(
        await expectRejectedByDatabase(tx, () => insertCustomer(tx, companyId, numero), 'duplicado vivo'),
      ).toBe(UNIQUE_VIOLATION)

      await insertCustomer(tx, companyId, { ...numero, deletedAt: new Date() })
      await insertCustomer(tx, otraEmpresa, numero)
    })
  })
})
