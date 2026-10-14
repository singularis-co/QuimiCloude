/**
 * El adaptador `company-prisma.ts` y las restricciones de `companies` y `company_events` contra
 * Postgres real.
 *
 * AISLAMIENTO — `transaccion`: cada `it` corre en una `prisma.$transaction` interactiva que termina
 * lanzando `RollbackSignal`, y el repositorio se construye sobre esa `tx`. Lo que se espera que la
 * base rechace por SQL crudo va bajo `SAVEPOINT`. Las escrituras del adaptador abren su propio
 * `SAVEPOINT` dentro de la transaccion del test, asi que un choque deja la transaccion usable y el
 * caso puede comprobar que no quedo nada. Cada caso solo mira las filas que el mismo crea: sus
 * nombres llevan una marca aleatoria y la lista se consulta buscando esa marca.
 */
import { randomUUID } from 'node:crypto'

import { Prisma } from '@prisma/client'
import { describe, expect, it } from 'vitest'

import { normalizeCompanyName } from '@/lib/modules/identity'
import { createCompanyRepository } from '@/lib/modules/identity/adapters/driven/persistence/company-prisma'
import { normalizeTaxId } from '@/lib/modules/identity/domain/company-input'
import { NO_CREDENTIAL_SENTINEL } from '@/lib/modules/identity/domain/credential-setup-link'
import { DOCUMENT_TYPE_CC } from '@/lib/modules/identity/domain/document-type'
import { ROLE_ADMINISTRADOR, ROLE_MAESTRO, ROLE_OPERADOR } from '@/lib/modules/identity/domain/roles'
import { prisma } from '@/lib/shared/db/prisma'

import type { UserAccountStatus } from '@/lib/modules/identity/domain/account-status'
import type { ListQuery } from '@/lib/modules/identity/domain/list-query'
import type {
  CompanyRepository,
  CompanyWrite,
  NewAdministrator,
} from '@/lib/modules/identity/ports/company-repository'

type Tx = Prisma.TransactionClient

class RollbackSignal extends Error {
  constructor() {
    super('rollback de aislamiento del test')
    this.name = 'RollbackSignal'
  }
}

async function inRolledBackTransaction(body: (tx: Tx) => Promise<void>): Promise<void> {
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

const UNIQUE_VIOLATION = '23505'
const CHECK_VIOLATION = '23514'

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

async function expectRejectedByDatabase(tx: Tx, run: () => Promise<unknown>, what: string): Promise<string> {
  savepointSeq += 1
  const savepoint = `qc162_sp_${String(savepointSeq)}`
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

/** Captura el error de Prisma de una operacion que debe fallar, sin abortar la transaccion. */
async function prismaErrorOf(tx: Tx, run: () => Promise<unknown>): Promise<Prisma.PrismaClientKnownRequestError> {
  savepointSeq += 1
  const savepoint = `qc162_sp_${String(savepointSeq)}`
  await tx.$executeRawUnsafe(`SAVEPOINT ${savepoint}`)
  try {
    await run()
  } catch (error) {
    await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${savepoint}`)
    if (error instanceof Prisma.PrismaClientKnownRequestError) return error
    throw error
  }
  throw new Error('se esperaba un error de Prisma')
}

function tag(): string {
  return randomUUID().replaceAll('-', '')
}

function documentNumberFrom(marca: string): string {
  return marca.slice(0, 20)
}

const NOW = new Date('2026-10-14T12:00:00.000Z')

function at(minutes: number): Date {
  return new Date(NOW.getTime() + minutes * 60_000)
}

function write(name: string, fields: Partial<Omit<CompanyWrite, 'name' | 'nameNormalized' | 'taxIdNormalized'>> = {}): CompanyWrite {
  const taxId = fields.taxId ?? null
  return {
    name,
    nameNormalized: normalizeCompanyName(name),
    taxId,
    taxIdNormalized: taxId === null ? null : normalizeTaxId(taxId),
    contactEmail: fields.contactEmail ?? null,
    contactPhone: fields.contactPhone ?? null,
  }
}

function administrator(overrides: Partial<NewAdministrator> = {}): NewAdministrator {
  const marca = tag()
  return {
    firstNames: 'Ana',
    lastNames: 'Admin',
    birthDate: new Date('1990-01-01T00:00:00.000Z'),
    email: `qc162.admin.${marca}@example.test`,
    phone: '3001112233',
    documentTypeCode: DOCUMENT_TYPE_CC,
    documentNumber: documentNumberFrom(marca),
    username: `qc162.admin.${marca}`,
    ...overrides,
  }
}

async function roleId(tx: Tx, name: string): Promise<string> {
  const role = await tx.role.findUniqueOrThrow({ where: { name }, select: { id: true } })
  return role.id
}

/** Un Maestro propio de la transaccion: es el autor de los eventos. */
async function createMaestro(tx: Tx, username = `qc162.maestro.${tag()}`): Promise<string> {
  const marca = tag()
  const user = await tx.user.create({
    data: {
      firstNames: 'Mara',
      lastNames: 'Maestro',
      birthDate: new Date('1985-01-01T00:00:00.000Z'),
      email: `qc162.maestro.${marca}@example.test`,
      phone: '000000000',
      documentTypeCode: DOCUMENT_TYPE_CC,
      documentNumber: documentNumberFrom(marca),
      username,
      passwordHash: NO_CREDENTIAL_SENTINEL,
      roleId: await roleId(tx, ROLE_MAESTRO),
      companyId: null,
      accountStatus: 'active',
    },
    select: { id: true },
  })
  return user.id
}

async function seedUser(
  tx: Tx,
  companyId: string,
  fields: { accountStatus?: UserAccountStatus; deleted?: boolean } = {},
): Promise<string> {
  const marca = tag()
  const user = await tx.user.create({
    data: {
      firstNames: 'Olga',
      lastNames: 'Operadora',
      birthDate: new Date('1992-01-01T00:00:00.000Z'),
      email: `qc162.user.${marca}@example.test`,
      phone: '000000000',
      documentTypeCode: DOCUMENT_TYPE_CC,
      documentNumber: documentNumberFrom(marca),
      username: `qc162.user.${marca}`,
      passwordHash: NO_CREDENTIAL_SENTINEL,
      roleId: await roleId(tx, ROLE_OPERADOR),
      companyId,
      accountStatus: fields.accountStatus ?? 'active',
      deletedAt: fields.deleted === true ? NOW : null,
    },
    select: { id: true },
  })
  return user.id
}

/** Empresa sembrada directamente, sin pasar por el adaptador. */
async function seedCompany(
  tx: Tx,
  name: string,
  fields: { taxId?: string | null; deleted?: boolean; createdAt?: Date; country?: string } = {},
): Promise<string> {
  const data = write(name, { taxId: fields.taxId ?? null })
  const company = await tx.company.create({
    data: {
      ...data,
      country: fields.country ?? null,
      createdAt: fields.createdAt ?? NOW,
      deletedAt: fields.deleted === true ? NOW : null,
    },
    select: { id: true },
  })
  return company.id
}

async function createViaAdapter(
  repo: CompanyRepository,
  actorId: string,
  data: CompanyWrite,
  admin: NewAdministrator = administrator(),
): Promise<{ companyId: string; administratorId: string }> {
  const result = await repo.createWithAdministrator({ company: data, administrator: admin, actorId, now: NOW })
  if (typeof result === 'string') throw new Error(`el alta no debia fallar, y devolvio \`${result}\``)
  return result
}

const COMPANY_COLUMNS = {
  id: true,
  name: true,
  nameNormalized: true,
  taxId: true,
  taxIdNormalized: true,
  contactEmail: true,
  contactPhone: true,
  country: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
} satisfies Prisma.CompanySelect

function readCompany(tx: Tx, id: string) {
  return tx.company.findUniqueOrThrow({ where: { id }, select: COMPANY_COLUMNS })
}

const USER_COLUMNS = {
  id: true,
  companyId: true,
  roleId: true,
  accountStatus: true,
  accountStatusChangedAt: true,
  accountStatusChangedBy: true,
  mustChangeCredential: true,
  passwordHash: true,
  updatedAt: true,
  deletedAt: true,
} satisfies Prisma.UserSelect

function readUsersOf(tx: Tx, companyId: string) {
  return tx.user.findMany({ where: { companyId }, select: USER_COLUMNS, orderBy: { id: 'asc' } })
}

function eventsOf(tx: Tx, companyId: string) {
  return tx.companyEvent.findMany({
    where: { companyId },
    select: { kind: true, actorId: true, occurredAt: true, details: true },
    orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
  })
}

function listQuery(overrides: Partial<ListQuery> = {}): ListQuery {
  return { page: 1, sort: null, filters: {}, search: '', ...overrides }
}

async function seedOrder(tx: Tx, companyId: string): Promise<string> {
  const marca = tag()
  const recipe = await tx.recipe.create({
    data: { name: `Receta ${marca}`, nameNormalized: `receta${marca}`, companyId },
    select: { id: true },
  })
  const id = randomUUID()
  await tx.$executeRawUnsafe(
    `INSERT INTO "orders" ("id","company_id","order_year","order_sequence","recipe_id","quantity","updated_at")
     VALUES ($1::uuid, $2::uuid, 2026, $3, $4::uuid, 10, CURRENT_TIMESTAMP)`,
    id,
    companyId,
    900_000 + Math.floor(Math.random() * 90_000),
    recipe.id,
  )
  return id
}

function readOrder(tx: Tx, id: string) {
  return tx.$queryRaw<unknown[]>`SELECT * FROM orders WHERE id = ${id}::uuid`
}

// ---------------------------------------------------------------------------------------------

describe('restricciones de companies y company_events contra Postgres', () => {
  it('R10: la base rechaza por SQL crudo una segunda empresa viva con la misma identificacion normalizada', async () => {
    await inRolledBackTransaction(async (tx) => {
      const marca = tag()
      await tx.$executeRaw`INSERT INTO companies (name, name_normalized, tax_id, tax_id_normalized, updated_at)
        VALUES (${`a ${marca}`}, ${`a${marca}`}, ${`T-${marca}`}, ${`t${marca}`}, now())`

      const sqlState = await expectRejectedByDatabase(
        tx,
        () => tx.$executeRaw`INSERT INTO companies (name, name_normalized, tax_id, tax_id_normalized, updated_at)
          VALUES (${`b ${marca}`}, ${`b${marca}`}, ${`t${marca}`}, ${`t${marca}`}, now())`,
        'identificacion repetida entre vivas',
      )
      expect(sqlState).toBe(UNIQUE_VIOLATION)
    })
  })

  it('R10: la base rechaza una identificacion sin su forma normalizada, o al reves, o con otro formato', async () => {
    await inRolledBackTransaction(async (tx) => {
      const casos = [
        { taxId: 'X-1', normalized: null },
        { taxId: null, normalized: 'x1' },
        { taxId: 'X-1', normalized: 'X1' },
        { taxId: 'X-1', normalized: 'x-1' },
      ]
      for (const caso of casos) {
        const marca = tag()
        const sqlState = await expectRejectedByDatabase(
          tx,
          () => tx.$executeRaw`INSERT INTO companies (name, name_normalized, tax_id, tax_id_normalized, updated_at)
            VALUES (${`c ${marca}`}, ${`c${marca}`}, ${caso.taxId}, ${caso.normalized}, now())`,
          JSON.stringify(caso),
        )
        expect(sqlState, JSON.stringify(caso)).toBe(CHECK_VIOLATION)
      }
    })
  })

  it('R10, R25: la misma identificacion en una empresa viva y en otra de baja se admite', async () => {
    await inRolledBackTransaction(async (tx) => {
      const marca = tag()
      await seedCompany(tx, `Baja ${marca}`, { taxId: `NIT ${marca}`, deleted: true })

      const viva = await seedCompany(tx, `Viva ${marca}`, { taxId: `nit-${marca}` })

      expect((await readCompany(tx, viva)).taxIdNormalized).toBe(`nit${marca}`)
    })
  })

  it('R39: la base admite un tipo de evento nuevo con forma <ambito>.<accion> y rechaza el que no la tiene', async () => {
    await inRolledBackTransaction(async (tx) => {
      const companyId = await seedCompany(tx, `Eventos ${tag()}`)
      const actorId = await createMaestro(tx)

      await tx.$executeRaw`INSERT INTO company_events (company_id, kind, actor_id, occurred_at)
        VALUES (${companyId}::uuid, 'module.enabled', ${actorId}::uuid, now())`

      for (const kind of ['Bad Kind', 'company', 'company.', '.created', 'Company.created', 'company.created2']) {
        const sqlState = await expectRejectedByDatabase(
          tx,
          () => tx.$executeRaw`INSERT INTO company_events (company_id, kind, actor_id, occurred_at)
            VALUES (${companyId}::uuid, ${kind}, ${actorId}::uuid, now())`,
          kind,
        )
        expect(sqlState, kind).toBe(CHECK_VIOLATION)
      }
      expect((await eventsOf(tx, companyId)).map((event) => event.kind)).toEqual(['module.enabled'])
    })
  })

  it('R8, R9: Prisma anuncia en meta.target la columna de cada indice unico de companies (lo que traduce el adaptador)', async () => {
    await inRolledBackTransaction(async (tx) => {
      const marca = tag()
      await seedCompany(tx, `Medida ${marca}`, { taxId: `M-${marca}` })

      const porIdentificacion = await prismaErrorOf(tx, () =>
        tx.company.create({ data: write(`Otra ${marca}`, { taxId: `m${marca}` }) }),
      )
      const porNombre = await prismaErrorOf(tx, () => tx.company.create({ data: write(`MEDIDA-${marca}`) }))

      expect(porIdentificacion.code).toBe('P2002')
      expect(porIdentificacion.meta?.target).toEqual(['tax_id_normalized'])
      expect(porNombre.code).toBe('P2002')
      expect(porNombre.meta?.target).toEqual(['lower(name_normalized)'])
    })
  })
})

describe('createWithAdministrator', () => {
  it('R11, R12, R34: crea empresa viva sin pais, su Administrador pendiente sin credencial y el evento company.created', async () => {
    await inRolledBackTransaction(async (tx) => {
      const repo = createCompanyRepository(tx)
      const actorId = await createMaestro(tx)
      const marca = tag()
      const admin = administrator()

      const { companyId, administratorId } = await createViaAdapter(
        repo,
        actorId,
        write(`Alta ${marca}`, { taxId: `900.${marca}`, contactEmail: 'Contacto@Example.test', contactPhone: '+57 1' }),
        admin,
      )

      expect(await readCompany(tx, companyId)).toEqual({
        id: companyId,
        name: `Alta ${marca}`,
        nameNormalized: `alta${marca}`,
        taxId: `900.${marca}`,
        taxIdNormalized: `900${marca}`,
        contactEmail: 'Contacto@Example.test',
        contactPhone: '+57 1',
        country: null,
        createdAt: NOW,
        updatedAt: NOW,
        deletedAt: null,
      })

      const fila = await tx.user.findUniqueOrThrow({
        where: { id: administratorId },
        select: {
          ...USER_COLUMNS,
          role: { select: { name: true } },
          firstNames: true,
          lastNames: true,
          birthDate: true,
          email: true,
          phone: true,
          documentTypeCode: true,
          documentNumber: true,
          username: true,
          createdAt: true,
        },
      })
      expect(fila).toMatchObject({
        companyId,
        role: { name: ROLE_ADMINISTRADOR },
        accountStatus: 'pending',
        accountStatusChangedAt: NOW,
        accountStatusChangedBy: null,
        mustChangeCredential: true,
        passwordHash: NO_CREDENTIAL_SENTINEL,
        createdAt: NOW,
        updatedAt: NOW,
        deletedAt: null,
        ...admin,
      })

      expect(await eventsOf(tx, companyId)).toEqual([
        { kind: 'company.created', actorId, occurredAt: NOW, details: null },
      ])
    })
  })

  it('R8, R9, R14: nombre o identificacion que choca en forma normalizada → duplicado, sin empresa, usuario ni evento', async () => {
    await inRolledBackTransaction(async (tx) => {
      const repo = createCompanyRepository(tx)
      const actorId = await createMaestro(tx)
      const marca = tag()
      await seedCompany(tx, `QuimiCloud ${marca}`, { taxId: `900.123.456-7${marca}` })

      const casos = [
        { data: write(`QUIMI-cloud-${marca}`), esperado: 'duplicate_name' },
        { data: write(`Otro nombre ${marca}`, { taxId: `9001234567${marca}` }), esperado: 'duplicate_tax_id' },
      ] as const
      for (const caso of casos) {
        const admin = administrator()
        const result = await repo.createWithAdministrator({ company: caso.data, administrator: admin, actorId, now: NOW })

        expect(result, caso.esperado).toBe(caso.esperado)
        expect(await tx.company.count({ where: { name: caso.data.name } })).toBe(0)
        expect(await tx.user.count({ where: { username: admin.username } })).toBe(0)
      }
      expect(await tx.companyEvent.count({ where: { actorId } })).toBe(0)
    })
  })

  it('R9: dos empresas sin identificacion fiscal conviven', async () => {
    await inRolledBackTransaction(async (tx) => {
      const repo = createCompanyRepository(tx)
      const actorId = await createMaestro(tx)
      const marca = tag()

      const a = await createViaAdapter(repo, actorId, write(`Sin nit A ${marca}`))
      const b = await createViaAdapter(repo, actorId, write(`Sin nit B ${marca}`))

      expect((await readCompany(tx, a.companyId)).taxIdNormalized).toBeNull()
      expect((await readCompany(tx, b.companyId)).taxIdNormalized).toBeNull()
    })
  })

  it('R13, R14: el usuario del Maestro (sin distinguir mayusculas) → username, sin empresa ni evento', async () => {
    await inRolledBackTransaction(async (tx) => {
      const repo = createCompanyRepository(tx)
      const username = `qc162.maestro.${tag()}`
      const actorId = await createMaestro(tx, username)
      const data = write(`Choque usuario ${tag()}`)

      const result = await repo.createWithAdministrator({
        company: data,
        administrator: administrator({ username: username.toUpperCase() }),
        actorId,
        now: NOW,
      })

      expect(result).toBe('username')
      expect(await tx.company.count({ where: { name: data.name } })).toBe(0)
      expect(await tx.companyEvent.count({ where: { actorId } })).toBe(0)
    })
  })

  it('R13, R14: tipo de documento inexistente → invalid_document_type, sin empresa, usuario ni evento', async () => {
    await inRolledBackTransaction(async (tx) => {
      const repo = createCompanyRepository(tx)
      const actorId = await createMaestro(tx)
      const data = write(`Choque documento ${tag()}`)
      const admin = administrator({ documentTypeCode: 'NO-EXISTE' })

      const result = await repo.createWithAdministrator({ company: data, administrator: admin, actorId, now: NOW })

      expect(result).toBe('invalid_document_type')
      expect(await tx.company.count({ where: { name: data.name } })).toBe(0)
      expect(await tx.user.count({ where: { username: admin.username } })).toBe(0)
      expect(await tx.companyEvent.count({ where: { actorId } })).toBe(0)
    })
  })

  it('R25: con una empresa de baja, otra viva toma su nombre y su identificacion', async () => {
    await inRolledBackTransaction(async (tx) => {
      const repo = createCompanyRepository(tx)
      const actorId = await createMaestro(tx)
      const marca = tag()
      await seedCompany(tx, `Reusada ${marca}`, { taxId: `R-${marca}`, deleted: true })

      const { companyId } = await createViaAdapter(repo, actorId, write(`REUSADA ${marca}`, { taxId: `r${marca}` }))

      expect((await readCompany(tx, companyId)).deletedAt).toBeNull()
    })
  })
})

describe('update', () => {
  it('R16, R34, R35: guarda los cuatro datos sin tocar pais, alta, baja ni usuarios; el evento nombra los campos sin valores', async () => {
    await inRolledBackTransaction(async (tx) => {
      const repo = createCompanyRepository(tx)
      const actorId = await createMaestro(tx)
      const marca = tag()
      const companyId = await seedCompany(tx, `Editable ${marca}`, { country: 'CO', createdAt: at(-60) })
      await seedUser(tx, companyId)
      const antes = await readCompany(tx, companyId)
      const usuariosAntes = await readUsersOf(tx, companyId)

      const data = write(`Editada ${marca}`, { contactEmail: 'nuevo@example.test' })
      const outcome = await repo.update({ companyId, data, actorId, now: at(1) })

      expect(outcome).toBe('ok')
      expect(await readCompany(tx, companyId)).toEqual({
        ...antes,
        ...data,
        updatedAt: at(1),
      })
      expect(await readUsersOf(tx, companyId)).toEqual(usuariosAntes)
      const eventos = await eventsOf(tx, companyId)
      expect(eventos).toEqual([
        { kind: 'company.updated', actorId, occurredAt: at(1), details: { fields: ['name', 'contactEmail'] } },
      ])
      expect(JSON.stringify(eventos)).not.toContain(marca)
    })
  })

  it('R17: una empresa de baja se edita aunque su nombre e identificacion los use una viva, y sigue de baja', async () => {
    await inRolledBackTransaction(async (tx) => {
      const repo = createCompanyRepository(tx)
      const actorId = await createMaestro(tx)
      const marca = tag()
      await seedCompany(tx, `Ocupado ${marca}`, { taxId: `O-${marca}` })
      const deBaja = await seedCompany(tx, `De baja ${marca}`, { deleted: true })

      const outcome = await repo.update({
        companyId: deBaja,
        data: write(`ocupado ${marca}`, { taxId: `o${marca}` }),
        actorId,
        now: at(1),
      })

      expect(outcome).toBe('ok')
      const despues = await readCompany(tx, deBaja)
      expect(despues.nameNormalized).toBe(`ocupado${marca}`)
      expect(despues.deletedAt).toEqual(NOW)
    })
  })

  it('R18: sin cambios → unchanged, sin tocar updated_at ni escribir evento', async () => {
    await inRolledBackTransaction(async (tx) => {
      const repo = createCompanyRepository(tx)
      const actorId = await createMaestro(tx)
      const name = `Igual ${tag()}`
      const companyId = await seedCompany(tx, name)
      const antes = await readCompany(tx, companyId)

      const outcome = await repo.update({ companyId, data: write(name), actorId, now: at(5) })

      expect(outcome).toBe('unchanged')
      expect(await readCompany(tx, companyId)).toEqual(antes)
      expect(await eventsOf(tx, companyId)).toEqual([])
    })
  })

  it('R19: empresa inexistente → not_found', async () => {
    await inRolledBackTransaction(async (tx) => {
      const repo = createCompanyRepository(tx)
      const actorId = await createMaestro(tx)

      const outcome = await repo.update({ companyId: randomUUID(), data: write(`Nadie ${tag()}`), actorId, now: NOW })

      expect(outcome).toBe('not_found')
    })
  })

  it('R8, R9: editar una viva con el nombre o la identificacion de otra viva → duplicado, sin escribir', async () => {
    await inRolledBackTransaction(async (tx) => {
      const repo = createCompanyRepository(tx)
      const actorId = await createMaestro(tx)
      const marca = tag()
      await seedCompany(tx, `Primera ${marca}`, { taxId: `P-${marca}` })
      const segunda = await seedCompany(tx, `Segunda ${marca}`)
      const antes = await readCompany(tx, segunda)

      expect(await repo.update({ companyId: segunda, data: write(`PRIMERA ${marca}`), actorId, now: at(1) })).toBe(
        'duplicate_name',
      )
      expect(
        await repo.update({ companyId: segunda, data: write(`Segunda ${marca}`, { taxId: `p${marca}` }), actorId, now: at(1) }),
      ).toBe('duplicate_tax_id')

      expect(await readCompany(tx, segunda)).toEqual(antes)
      expect(await eventsOf(tx, segunda)).toEqual([])
    })
  })

  it('R34: si el evento no se puede escribir (autor inexistente), la edicion tampoco queda', async () => {
    await inRolledBackTransaction(async (tx) => {
      const repo = createCompanyRepository(tx)
      const companyId = await seedCompany(tx, `Atomica ${tag()}`)
      const antes = await readCompany(tx, companyId)

      await expect(
        repo.update({ companyId, data: write(`Cambiada ${tag()}`), actorId: randomUUID(), now: at(1) }),
      ).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError)

      expect(await readCompany(tx, companyId)).toEqual(antes)
      expect(await eventsOf(tx, companyId)).toEqual([])
    })
  })
})

describe('countLiveUsersOfAlive', () => {
  it('R20: cuenta los usuarios vivos de la empresa, sin los de baja ni los de otra empresa', async () => {
    await inRolledBackTransaction(async (tx) => {
      const repo = createCompanyRepository(tx)
      const companyId = await seedCompany(tx, `Impacto ${tag()}`)
      const otra = await seedCompany(tx, `Otra ${tag()}`)
      await seedUser(tx, companyId, { accountStatus: 'active' })
      await seedUser(tx, companyId, { accountStatus: 'pending' })
      await seedUser(tx, companyId, { deleted: true })
      await seedUser(tx, otra)

      expect(await repo.countLiveUsersOfAlive(companyId)).toBe(2)
      expect(await repo.countLiveUsersOfAlive(otra)).toBe(1)
    })
  })

  it('R20: empresa de baja o inexistente → not_found', async () => {
    await inRolledBackTransaction(async (tx) => {
      const repo = createCompanyRepository(tx)
      const deBaja = await seedCompany(tx, `Impacto baja ${tag()}`, { deleted: true })

      expect(await repo.countLiveUsersOfAlive(deBaja)).toBe('not_found')
      expect(await repo.countLiveUsersOfAlive(randomUUID())).toBe('not_found')
    })
  })
})

describe('softDelete', () => {
  it('R21, R24, R34: la confirmacion normalizada da de baja, sin tocar datos, usuarios ni pedidos; la sesion ve la marca', async () => {
    await inRolledBackTransaction(async (tx) => {
      const repo = createCompanyRepository(tx)
      const actorId = await createMaestro(tx)
      const marca = tag()
      const companyId = await seedCompany(tx, `Quimi Cloud ${marca}`, { taxId: `B-${marca}`, country: 'PE' })
      const userId = await seedUser(tx, companyId)
      const orderId = await seedOrder(tx, companyId)
      const antes = await readCompany(tx, companyId)
      const usuariosAntes = await readUsersOf(tx, companyId)
      const pedidoAntes = await readOrder(tx, orderId)

      const outcome = await repo.softDelete({
        companyId,
        confirmationNormalized: normalizeCompanyName(`quimi cloud ${marca}`),
        actorId,
        now: at(2),
      })

      expect(outcome).toBe('ok')
      expect(await readCompany(tx, companyId)).toEqual({ ...antes, deletedAt: at(2), updatedAt: at(2) })
      expect(await readUsersOf(tx, companyId)).toEqual(usuariosAntes)
      expect(await readOrder(tx, orderId)).toEqual(pedidoAntes)
      expect(await eventsOf(tx, companyId)).toEqual([
        { kind: 'company.deleted', actorId, occurredAt: at(2), details: null },
      ])

      // La misma seleccion que la lectura de sesion: la marca de la empresa llega con el usuario.
      const sesion = await tx.user.findFirst({
        where: { id: userId, deletedAt: null },
        select: { id: true, companyId: true, company: { select: { deletedAt: true } } },
      })
      expect(sesion?.company?.deletedAt).toEqual(at(2))
    })
  })

  it('R22: una confirmacion que no coincide → name_mismatch, sin escribir', async () => {
    await inRolledBackTransaction(async (tx) => {
      const repo = createCompanyRepository(tx)
      const actorId = await createMaestro(tx)
      const companyId = await seedCompany(tx, `Confirmar ${tag()}`)
      const antes = await readCompany(tx, companyId)

      const outcome = await repo.softDelete({ companyId, confirmationNormalized: 'otra', actorId, now: at(2) })

      expect(outcome).toBe('name_mismatch')
      expect(await readCompany(tx, companyId)).toEqual(antes)
      expect(await eventsOf(tx, companyId)).toEqual([])
    })
  })

  it('R23: empresa ya de baja o inexistente → not_found, sin escribir', async () => {
    await inRolledBackTransaction(async (tx) => {
      const repo = createCompanyRepository(tx)
      const actorId = await createMaestro(tx)
      const name = `Ya baja ${tag()}`
      const deBaja = await seedCompany(tx, name, { deleted: true })
      const antes = await readCompany(tx, deBaja)

      expect(
        await repo.softDelete({ companyId: deBaja, confirmationNormalized: normalizeCompanyName(name), actorId, now: at(2) }),
      ).toBe('not_found')
      expect(
        await repo.softDelete({ companyId: randomUUID(), confirmationNormalized: 'x', actorId, now: at(2) }),
      ).toBe('not_found')
      expect(await readCompany(tx, deBaja)).toEqual(antes)
      expect(await eventsOf(tx, deBaja)).toEqual([])
    })
  })

  it('R34: si el evento no se puede escribir, la baja tampoco queda', async () => {
    await inRolledBackTransaction(async (tx) => {
      const repo = createCompanyRepository(tx)
      const name = `Baja atomica ${tag()}`
      const companyId = await seedCompany(tx, name)
      const antes = await readCompany(tx, companyId)

      await expect(
        repo.softDelete({ companyId, confirmationNormalized: normalizeCompanyName(name), actorId: randomUUID(), now: at(2) }),
      ).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError)

      expect(await readCompany(tx, companyId)).toEqual(antes)
    })
  })
})

describe('reactivate', () => {
  it('R26, R34: quita la marca de baja y deja datos y usuarios con su estado de cuenta intactos', async () => {
    await inRolledBackTransaction(async (tx) => {
      const repo = createCompanyRepository(tx)
      const actorId = await createMaestro(tx)
      const marca = tag()
      const companyId = await seedCompany(tx, `Vuelve ${marca}`, { taxId: `V-${marca}`, deleted: true, country: 'MX' })
      await seedUser(tx, companyId, { accountStatus: 'active' })
      await seedUser(tx, companyId, { accountStatus: 'pending' })
      const antes = await readCompany(tx, companyId)
      const usuariosAntes = await readUsersOf(tx, companyId)

      const outcome = await repo.reactivate({ companyId, actorId, now: at(3) })

      expect(outcome).toBe('ok')
      expect(await readCompany(tx, companyId)).toEqual({ ...antes, deletedAt: null, updatedAt: at(3) })
      expect(await readUsersOf(tx, companyId)).toEqual(usuariosAntes)
      expect(await eventsOf(tx, companyId)).toEqual([
        { kind: 'company.reactivated', actorId, occurredAt: at(3), details: null },
      ])
    })
  })

  it('R27: nombre o identificacion tomados por una viva → duplicado, y sigue de baja sin evento', async () => {
    await inRolledBackTransaction(async (tx) => {
      const repo = createCompanyRepository(tx)
      const actorId = await createMaestro(tx)
      const marca = tag()
      const porNombre = await seedCompany(tx, `Tomado ${marca}`, { deleted: true })
      await seedCompany(tx, `TOMADO-${marca}`)
      const porNit = await seedCompany(tx, `Libre ${marca}`, { taxId: `N-${marca}`, deleted: true })
      await seedCompany(tx, `Otra ${marca}`, { taxId: `n${marca}` })

      expect(await repo.reactivate({ companyId: porNombre, actorId, now: at(3) })).toBe('duplicate_name')
      expect(await repo.reactivate({ companyId: porNit, actorId, now: at(3) })).toBe('duplicate_tax_id')

      expect((await readCompany(tx, porNombre)).deletedAt).toEqual(NOW)
      expect((await readCompany(tx, porNit)).deletedAt).toEqual(NOW)
      expect(await eventsOf(tx, porNombre)).toEqual([])
      expect(await eventsOf(tx, porNit)).toEqual([])
    })
  })

  it('R28: viva → not_deleted; inexistente → not_found; sin escribir', async () => {
    await inRolledBackTransaction(async (tx) => {
      const repo = createCompanyRepository(tx)
      const actorId = await createMaestro(tx)
      const viva = await seedCompany(tx, `Viva ${tag()}`)
      const antes = await readCompany(tx, viva)

      expect(await repo.reactivate({ companyId: viva, actorId, now: at(3) })).toBe('not_deleted')
      expect(await repo.reactivate({ companyId: randomUUID(), actorId, now: at(3) })).toBe('not_found')
      expect(await readCompany(tx, viva)).toEqual(antes)
      expect(await eventsOf(tx, viva)).toEqual([])
    })
  })

  it('R34: si el evento no se puede escribir, la reactivacion tampoco queda', async () => {
    await inRolledBackTransaction(async (tx) => {
      const repo = createCompanyRepository(tx)
      const companyId = await seedCompany(tx, `Reactivar atomica ${tag()}`, { deleted: true })

      await expect(repo.reactivate({ companyId, actorId: randomUUID(), now: at(3) })).rejects.toBeInstanceOf(
        Prisma.PrismaClientKnownRequestError,
      )

      expect((await readCompany(tx, companyId)).deletedAt).toEqual(NOW)
    })
  })
})

describe('list', () => {
  it('R29, R30: cada fila trae sus columnas y los usuarios vivos; por defecto solo vivas', async () => {
    await inRolledBackTransaction(async (tx) => {
      const repo = createCompanyRepository(tx)
      const marca = tag()
      const viva = await seedCompany(tx, `Lista viva ${marca}`, { taxId: `L-${marca}`, country: 'CO', createdAt: at(-5) })
      await seedCompany(tx, `Lista baja ${marca}`, { deleted: true })
      await seedUser(tx, viva)
      await seedUser(tx, viva, { accountStatus: 'pending' })
      await seedUser(tx, viva, { deleted: true })

      const page = await repo.list(listQuery({ search: marca }))

      expect(page.items).toEqual([
        {
          id: viva,
          name: `Lista viva ${marca}`,
          taxId: `L-${marca}`,
          country: 'CO',
          liveUserCount: 2,
          createdAt: at(-5),
          status: 'active',
        },
      ])
      expect(page).toMatchObject({ total: 1, page: 1, pageSize: 10, totalPages: 1 })
    })
  })

  it('R30: con el filtro de estado trae las de baja, o las dos; un valor desconocido se ignora', async () => {
    await inRolledBackTransaction(async (tx) => {
      const repo = createCompanyRepository(tx)
      const marca = tag()
      const viva = await seedCompany(tx, `Estado a ${marca}`)
      const deBaja = await seedCompany(tx, `Estado b ${marca}`, { deleted: true })
      const search = marca
      const ids = async (values: string[]) =>
        (await repo.list(listQuery({ search, filters: { status: { kind: 'select', values } } }))).items.map(
          (row) => [row.id, row.status],
        )

      expect(await ids(['deleted'])).toEqual([[deBaja, 'deleted']])
      expect(await ids(['active', 'deleted'])).toEqual([
        [viva, 'active'],
        [deBaja, 'deleted'],
      ])
      expect(await ids(['otro'])).toEqual([[viva, 'active']])
      expect(await ids([])).toEqual([[viva, 'active']])
    })
  })

  it('R31: busca por nombre o identificacion en forma normalizada, sin acentos ni mayusculas', async () => {
    await inRolledBackTransaction(async (tx) => {
      const repo = createCompanyRepository(tx)
      const marca = tag()
      const nandu = await seedCompany(tx, `Ñandú ${marca}`)
      const conNit = await seedCompany(tx, `Sin relacion ${tag()}`, { taxId: `NIT.${marca}.9` })

      const porNombre = await repo.list(listQuery({ search: `NANDU ${marca}` }))
      const porNit = await repo.list(listQuery({ search: `nit-${marca}` }))
      const ambos = await repo.list(listQuery({ search: marca }))

      expect(porNombre.items.map((row) => row.id)).toEqual([nandu])
      expect(porNit.items.map((row) => row.id)).toEqual([conNit])
      expect(ambos.items.map((row) => row.id).sort()).toEqual([nandu, conNit].sort())
    })
  })

  it('R32: orden por nombre ascendente por defecto, desempate por id, y por fecha de alta si se pide', async () => {
    await inRolledBackTransaction(async (tx) => {
      const repo = createCompanyRepository(tx)
      const marca = tag()
      const c = await seedCompany(tx, `Orden c ${marca}`, { createdAt: at(-1) })
      const a = await seedCompany(tx, `Orden a ${marca}`, { createdAt: at(-3) })
      const b1 = await seedCompany(tx, `Orden b ${marca}`, { createdAt: at(-2), deleted: true })
      const b2 = await seedCompany(tx, `ORDEN-B ${marca}`, { createdAt: at(-4) })
      const search = marca
      const both = { status: { kind: 'select', values: ['active', 'deleted'] } } as const
      const [bPrimero, bSegundo] = [b1, b2].sort()

      const porNombre = await repo.list(listQuery({ search, filters: both }))
      const porFecha = await repo.list(
        listQuery({ search, filters: both, sort: { columnId: 'createdAt', direction: 'desc' } }),
      )
      const porNombreDesc = await repo.list(
        listQuery({ search, filters: both, sort: { columnId: 'name', direction: 'desc' } }),
      )
      const columnaNoDeclarada = await repo.list(
        listQuery({ search, filters: both, sort: { columnId: 'country', direction: 'asc' } }),
      )

      expect(porNombre.items.map((row) => row.id)).toEqual([a, bPrimero, bSegundo, c])
      expect(porFecha.items.map((row) => row.id)).toEqual([c, b1, a, b2])
      expect(porNombreDesc.items.map((row) => row.id)).toEqual([c, bPrimero, bSegundo, a])
      expect(columnaNoDeclarada.items.map((row) => row.id)).toEqual([a, bPrimero, bSegundo, c])
    })
  })

  it('R32: 10 filas por defecto y tope de 25', async () => {
    await inRolledBackTransaction(async (tx) => {
      const repo = createCompanyRepository(tx)
      const marca = tag()
      for (let i = 0; i < 27; i += 1) {
        await seedCompany(tx, `Tope ${marca} ${String(i).padStart(2, '0')}`)
      }
      const search = `tope ${marca}`

      const porDefecto = await repo.list(listQuery({ search }))
      const pedidoGrande = await repo.list(listQuery({ search, pageSize: 100 }))
      const segunda = await repo.list(listQuery({ search, pageSize: 25, page: 2 }))

      expect(porDefecto).toMatchObject({ total: 27, pageSize: 10, totalPages: 3 })
      expect(porDefecto.items).toHaveLength(10)
      expect(pedidoGrande).toMatchObject({ total: 27, pageSize: 25, totalPages: 2 })
      expect(pedidoGrande.items).toHaveLength(25)
      expect(segunda.items.map((row) => row.name)).toEqual([`Tope ${marca} 25`, `Tope ${marca} 26`])
    })
  })
})

describe('findById', () => {
  it('R33: devuelve la ficha de una empresa viva y de una de baja; inexistente → null', async () => {
    await inRolledBackTransaction(async (tx) => {
      const repo = createCompanyRepository(tx)
      const marca = tag()
      const viva = await seedCompany(tx, `Ficha ${marca}`, { taxId: `F-${marca}`, country: 'CO', createdAt: at(-9) })
      await tx.company.update({ where: { id: viva }, data: { contactEmail: 'c@example.test', contactPhone: '123' } })
      const deBaja = await seedCompany(tx, `Ficha baja ${marca}`, { deleted: true })

      expect(await repo.findById(viva)).toEqual({
        id: viva,
        name: `Ficha ${marca}`,
        taxId: `F-${marca}`,
        contactEmail: 'c@example.test',
        contactPhone: '123',
        country: 'CO',
        createdAt: at(-9),
        status: 'active',
        deletedAt: null,
      })
      expect(await repo.findById(deBaja)).toMatchObject({ id: deBaja, status: 'deleted', deletedAt: NOW })
      expect(await repo.findById(randomUUID())).toBeNull()
    })
  })
})

describe('listEvents', () => {
  it('R34, R37: un evento por operacion, del mas reciente al mas antiguo, con autor y campos; un tipo desconocido sale tal cual', async () => {
    await inRolledBackTransaction(async (tx) => {
      const repo = createCompanyRepository(tx)
      const actorId = await createMaestro(tx)
      const marca = tag()
      const { companyId } = await createViaAdapter(repo, actorId, write(`Historial ${marca}`))
      expect(await repo.update({ companyId, data: write(`Historial ${marca}`, { contactPhone: '1' }), actorId, now: at(1) })).toBe('ok')
      expect(
        await repo.softDelete({ companyId, confirmationNormalized: `historial${marca}`, actorId, now: at(2) }),
      ).toBe('ok')
      expect(await repo.reactivate({ companyId, actorId, now: at(3) })).toBe('ok')
      await tx.$executeRaw`INSERT INTO company_events (company_id, kind, actor_id, occurred_at, details)
        VALUES (${companyId}::uuid, 'module.enabled', ${actorId}::uuid, ${at(4)}, '{"module":"inventario"}'::jsonb)`

      const primera = await repo.listEvents(companyId, { pageSize: 2 })
      const ultima = await repo.listEvents(companyId, { page: 3, pageSize: 2 })

      const actor = { id: actorId, firstNames: 'Mara', lastNames: 'Maestro' }
      if (primera === 'not_found' || ultima === 'not_found') throw new Error('la empresa existe')
      expect(primera).toMatchObject({ total: 5, page: 1, pageSize: 2, totalPages: 3 })
      expect(primera.items).toEqual([
        { id: expect.any(String), kind: 'module.enabled', occurredAt: at(4), actor, fields: [] },
        { id: expect.any(String), kind: 'company.reactivated', occurredAt: at(3), actor, fields: [] },
      ])
      expect(ultima.items).toEqual([
        { id: expect.any(String), kind: 'company.created', occurredAt: NOW, actor, fields: [] },
      ])
      const segunda = await repo.listEvents(companyId, { page: 2, pageSize: 2 })
      if (segunda === 'not_found') throw new Error('la empresa existe')
      expect(segunda.items.map((event) => [event.kind, event.fields])).toEqual([
        ['company.deleted', []],
        ['company.updated', ['contactPhone']],
      ])
    })
  })

  it('R37: mismo instante → desempate por id descendente; detalles que no son campos conocidos → []', async () => {
    await inRolledBackTransaction(async (tx) => {
      const repo = createCompanyRepository(tx)
      const actorId = await createMaestro(tx)
      const companyId = await seedCompany(tx, `Empate ${tag()}`)
      const ids = [randomUUID(), randomUUID(), randomUUID()]
      const details = ['{"fields":["name","otro"]}', '{"fields":"name"}', '[1,2]']
      for (const [i, id] of ids.entries()) {
        await tx.$executeRaw`INSERT INTO company_events (id, company_id, kind, actor_id, occurred_at, details)
          VALUES (${id}::uuid, ${companyId}::uuid, 'company.updated', ${actorId}::uuid, ${NOW}, ${details[i]}::jsonb)`
      }

      const page = await repo.listEvents(companyId, {})

      if (page === 'not_found') throw new Error('la empresa existe')
      expect(page.items.map((event) => event.id)).toEqual([...ids].sort().reverse())
      expect(page.items.map((event) => event.fields)).toEqual([[], [], []])
    })
  })

  it('R37: 10 por defecto, tope de 25; empresa de baja se lee; inexistente → not_found', async () => {
    await inRolledBackTransaction(async (tx) => {
      const repo = createCompanyRepository(tx)
      const actorId = await createMaestro(tx)
      const companyId = await seedCompany(tx, `Muchos ${tag()}`, { deleted: true })
      for (let i = 0; i < 27; i += 1) {
        await tx.$executeRaw`INSERT INTO company_events (company_id, kind, actor_id, occurred_at)
          VALUES (${companyId}::uuid, 'company.updated', ${actorId}::uuid, ${at(i)})`
      }

      const porDefecto = await repo.listEvents(companyId, {})
      const grande = await repo.listEvents(companyId, { pageSize: 100 })

      expect(porDefecto).toMatchObject({ total: 27, pageSize: 10, totalPages: 3 })
      expect(grande).toMatchObject({ total: 27, pageSize: 25, totalPages: 2 })
      if (porDefecto === 'not_found' || grande === 'not_found') throw new Error('la empresa existe')
      expect(porDefecto.items).toHaveLength(10)
      expect(grande.items).toHaveLength(25)
      expect(await repo.listEvents(randomUUID(), {})).toBe('not_found')
    })
  })
})
