/**
 * El adaptador `company-addons-prisma.ts` contra Postgres real: los interruptores de añadidos de
 * una empresa y sus eventos en `company_events`.
 *
 * AISLAMIENTO — `transaccion`: cada `it` corre en una `prisma.$transaction` interactiva que termina
 * lanzando `RollbackSignal`, y los repositorios se construyen sobre esa `tx`. La escritura del
 * adaptador abre su propio `SAVEPOINT` dentro de la transaccion del test, asi que un fallo deja la
 * transaccion usable y el caso puede comprobar que no quedo nada.
 *
 * La lectura de sesion (`findActiveSessionUserById`) usa el cliente global. Para releer con ella
 * dentro de la misma transaccion, el cliente se sustituye por un proxy que, mientras corre un caso,
 * delega en su `tx`: la lectura es la de produccion y ve lo que el caso escribio sin confirmarlo.
 */
import { randomUUID } from 'node:crypto'

import { Prisma } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'

const enCurso = vi.hoisted(() => ({ tx: null as unknown }))

vi.mock('@/lib/shared/db/prisma', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/shared/db/prisma')>()
  const proxy = new Proxy(real.prisma, {
    get(target, prop) {
      const source = (enCurso.tx ?? target) as object
      const value: unknown = Reflect.get(source, prop)
      return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(source) : value
    },
  })
  return { ...real, prisma: proxy }
})

import { ADDONS, effectiveAddons, effectivePermissions, normalizeCompanyName } from '@/lib/modules/identity'
import { createCompanyAddonRepository } from '@/lib/modules/identity/adapters/driven/persistence/company-addons-prisma'
import { createCompanyRepository } from '@/lib/modules/identity/adapters/driven/persistence/company-prisma'
import { findActiveSessionUserById } from '@/lib/modules/identity/adapters/driven/persistence/session-user-prisma'
import { NO_CREDENTIAL_SENTINEL } from '@/lib/modules/identity/domain/credential-setup-link'
import { DOCUMENT_TYPE_CC } from '@/lib/modules/identity/domain/document-type'
import { createIsCompanyAddonActive } from '@/lib/modules/identity/domain/is-company-addon-active'
import { ROLE_ADMINISTRADOR, ROLE_MAESTRO } from '@/lib/modules/identity/domain/roles'
import { prisma } from '@/lib/shared/db/prisma'

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
        enCurso.tx = tx
        try {
          await body(tx)
        } finally {
          enCurso.tx = null
        }
        throw new RollbackSignal()
      },
      { maxWait: 10_000, timeout: 60_000 },
    )
  } catch (error) {
    if (!(error instanceof RollbackSignal)) throw error
  }
}

function tag(): string {
  return randomUUID().replaceAll('-', '')
}

const NOW = new Date('2026-10-15T12:00:00.000Z')

function at(minutes: number): Date {
  return new Date(NOW.getTime() + minutes * 60_000)
}

async function roleId(tx: Tx, name: string): Promise<string> {
  const role = await tx.role.findUniqueOrThrow({ where: { name }, select: { id: true } })
  return role.id
}

async function createUser(tx: Tx, role: string, companyId: string | null): Promise<string> {
  const marca = tag()
  const user = await tx.user.create({
    data: {
      firstNames: 'Ana',
      lastNames: 'Prueba',
      birthDate: new Date('1990-01-01T00:00:00.000Z'),
      email: `qc277.${marca}@example.test`,
      phone: '000000000',
      documentTypeCode: DOCUMENT_TYPE_CC,
      documentNumber: marca.slice(0, 20),
      username: `qc277.${marca}`,
      passwordHash: NO_CREDENTIAL_SENTINEL,
      roleId: await roleId(tx, role),
      companyId,
      accountStatus: 'active',
    },
    select: { id: true },
  })
  return user.id
}

function createMaestro(tx: Tx): Promise<string> {
  return createUser(tx, ROLE_MAESTRO, null)
}

// `addons` siembra excepciones prendidas y `off` excepciones apagadas, las dos sin autor, como las
// deja la migracion.
async function seedCompany(
  tx: Tx,
  fields: { addons?: readonly string[]; off?: readonly string[]; deleted?: boolean } = {},
): Promise<string> {
  const name = `Anadidos ${tag()}`
  const company = await tx.company.create({
    data: {
      name,
      nameNormalized: normalizeCompanyName(name),
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: fields.deleted === true ? NOW : null,
      addonOverrides: {
        create: [
          ...(fields.addons ?? []).map((addonKey) => ({ addonKey, enabled: true, createdAt: NOW })),
          ...(fields.off ?? []).map((addonKey) => ({ addonKey, enabled: false, createdAt: NOW })),
        ],
      },
    },
    select: { id: true },
  })
  return company.id
}

function readCompany(tx: Tx, id: string) {
  return tx.company.findUniqueOrThrow({
    where: { id },
    select: { id: true, name: true, createdAt: true, updatedAt: true, deletedAt: true },
  })
}

function overridesOf(tx: Tx, companyId: string) {
  return tx.companyAddonOverride.findMany({
    where: { companyId },
    select: { addonKey: true, enabled: true, source: true, createdBy: true, createdAt: true },
    orderBy: { addonKey: 'asc' },
  })
}

async function enabledOf(tx: Tx, companyId: string): Promise<string[]> {
  const rows = await overridesOf(tx, companyId)
  const on = new Set(rows.filter((row) => row.enabled).map((row) => row.addonKey))
  return ADDONS.filter((addon) => on.has(addon))
}

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

// Una sentencia rechazada aborta la transaccion del test: el SAVEPOINT la deja usable despues.
async function rejectedByDatabase(tx: Tx, run: () => Promise<unknown>): Promise<string> {
  await tx.$executeRawUnsafe('SAVEPOINT sp_addons_test')
  try {
    await run()
  } catch (error) {
    await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT sp_addons_test')
    return sqlStateOf(error)
  }
  await tx.$executeRawUnsafe('RELEASE SAVEPOINT sp_addons_test')
  throw new Error('se esperaba que la base rechazara la escritura, pero la acepto')
}

// El cliente del repositorio con `companyEvent.create` fallando en la llamada numero `failAt`: un
// fallo del evento a mitad, despues de que las excepciones ya se escribieron.
function failingEventsOn(tx: Tx, failAt: number): Tx {
  let calls = 0
  const companyEvent = new Proxy(tx.companyEvent, {
    get(target, prop) {
      if (prop === 'create') {
        return async (args: Prisma.CompanyEventCreateArgs) => {
          calls += 1
          if (calls === failAt) throw new Error('fallo simulado del evento')
          return target.create(args)
        }
      }
      const value: unknown = Reflect.get(target, prop)
      return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(target) : value
    },
  })
  return new Proxy(tx, {
    get(target, prop) {
      if (prop === 'companyEvent') return companyEvent
      const value: unknown = Reflect.get(target, prop)
      return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(target) : value
    },
  })
}

function eventsOf(tx: Tx, companyId: string) {
  return tx.companyEvent.findMany({
    where: { companyId },
    select: { kind: true, actorId: true, occurredAt: true, details: true },
    orderBy: [{ occurredAt: 'asc' }, { id: 'asc' }],
  })
}

// ---------------------------------------------------------------------------------------------

describe('apply', () => {
  it('R33: prende varios en una transaccion, con un evento por cambio, su autor, su instante y details.addon', async () => {
    await inRolledBackTransaction(async (tx) => {
      const repo = createCompanyAddonRepository(tx)
      const actorId = await createMaestro(tx)
      const companyId = await seedCompany(tx, { addons: ['dashboard'] })

      const result = await repo.apply({
        companyId,
        enable: ['dashboard', 'integraciones', 'proveedores'],
        actorId,
        now: at(5),
      })

      expect(result).toEqual({
        stored: ['dashboard', 'proveedores', 'integraciones'],
        changed: [
          { addon: 'proveedores', enabled: true },
          { addon: 'integraciones', enabled: true },
        ],
      })
      const fila = await readCompany(tx, companyId)
      expect(fila.updatedAt).toEqual(at(5))
      // La excepcion que ya estaba prendida no se reescribe: conserva su autor vacio.
      expect(await overridesOf(tx, companyId)).toEqual([
        { addonKey: 'dashboard', enabled: true, source: 'manual', createdBy: null, createdAt: NOW },
        { addonKey: 'integraciones', enabled: true, source: 'manual', createdBy: actorId, createdAt: at(5) },
        { addonKey: 'proveedores', enabled: true, source: 'manual', createdBy: actorId, createdAt: at(5) },
      ])
      // Mismo instante: el orden entre los dos eventos no esta definido.
      const eventos = await eventsOf(tx, companyId)
      expect(eventos).toHaveLength(2)
      expect(eventos).toEqual(
        expect.arrayContaining([
          { kind: 'addon.enabled', actorId, occurredAt: at(5), details: { addon: 'proveedores' } },
          { kind: 'addon.enabled', actorId, occurredAt: at(5), details: { addon: 'integraciones' } },
        ]),
      )
    })
  })

  it('R33: apagar escribe enabled = false sin borrar la fila, con el actor como autor, y addon.disabled', async () => {
    await inRolledBackTransaction(async (tx) => {
      const repo = createCompanyAddonRepository(tx)
      const actorId = await createMaestro(tx)
      const companyId = await seedCompany(tx, { addons: ['lectura_pdf', 'dashboard'] })

      const result = await repo.apply({ companyId, disable: ['lectura_pdf'], actorId, now: at(1) })

      expect(result).toEqual({ stored: ['dashboard'], changed: [{ addon: 'lectura_pdf', enabled: false }] })
      expect(await overridesOf(tx, companyId)).toEqual([
        { addonKey: 'dashboard', enabled: true, source: 'manual', createdBy: null, createdAt: NOW },
        { addonKey: 'lectura_pdf', enabled: false, source: 'manual', createdBy: actorId, createdAt: at(1) },
      ])
      expect(await eventsOf(tx, companyId)).toEqual([
        { kind: 'addon.disabled', actorId, occurredAt: at(1), details: { addon: 'lectura_pdf' } },
      ])
    })
  })

  it('R33: volver a prender una excepcion apagada la reescribe a true con el nuevo autor e instante', async () => {
    await inRolledBackTransaction(async (tx) => {
      const repo = createCompanyAddonRepository(tx)
      const actorId = await createMaestro(tx)
      const companyId = await seedCompany(tx, { off: ['proveedores'] })

      const result = await repo.apply({ companyId, enable: ['proveedores'], actorId, now: at(2) })

      expect(result).toEqual({ stored: ['proveedores'], changed: [{ addon: 'proveedores', enabled: true }] })
      expect(await overridesOf(tx, companyId)).toEqual([
        { addonKey: 'proveedores', enabled: true, source: 'manual', createdBy: actorId, createdAt: at(2) },
      ])
    })
  })

  it('R33: sin cambios no escribe: ni excepcion ni updated_at ni evento; apagar sin fila no crea fila', async () => {
    await inRolledBackTransaction(async (tx) => {
      const repo = createCompanyAddonRepository(tx)
      const actorId = await createMaestro(tx)
      const companyId = await seedCompany(tx, { addons: ['dashboard'], off: ['lectura_pdf'] })
      const antes = await readCompany(tx, companyId)
      const excepcionesAntes = await overridesOf(tx, companyId)

      const result = await repo.apply({
        companyId,
        enable: ['dashboard'],
        disable: ['proveedores', 'lectura_pdf'],
        actorId,
        now: at(9),
      })

      expect(result).toEqual({ stored: ['dashboard'], changed: [] })
      expect(await readCompany(tx, companyId)).toEqual(antes)
      expect(await overridesOf(tx, companyId)).toEqual(excepcionesAntes)
      expect(await eventsOf(tx, companyId)).toEqual([])
    })
  })

  it('R29, R33: apagar todos con todos prendidos escribe una fila false y un evento por añadido', async () => {
    await inRolledBackTransaction(async (tx) => {
      const repo = createCompanyAddonRepository(tx)
      const actorId = await createMaestro(tx)
      const companyId = await seedCompany(tx, { addons: [...ADDONS] })

      const result = await repo.apply({ companyId, disable: [...ADDONS], actorId, now: at(3) })

      expect(result).toEqual({ stored: [], changed: ADDONS.map((addon) => ({ addon, enabled: false })) })
      const filas = await overridesOf(tx, companyId)
      expect(filas).toHaveLength(ADDONS.length)
      for (const fila of filas) {
        expect(fila, fila.addonKey).toMatchObject({ enabled: false, createdBy: actorId, createdAt: at(3) })
      }
      const eventos = await eventsOf(tx, companyId)
      expect(eventos).toHaveLength(ADDONS.length)
      expect(eventos.map((e) => (e.details as { addon: string }).addon).sort()).toEqual([...ADDONS].sort())
      for (const evento of eventos) expect(evento).toMatchObject({ kind: 'addon.disabled', actorId, occurredAt: at(3) })
      expect((await readCompany(tx, companyId)).updatedAt).toEqual(at(3))
    })
  })

  it('R29, R33: si falla un evento a mitad de apagar todos, todas las excepciones y updated_at quedan como estaban', async () => {
    await inRolledBackTransaction(async (tx) => {
      const actorId = await createMaestro(tx)
      const companyId = await seedCompany(tx, { addons: [...ADDONS] })
      const antes = await readCompany(tx, companyId)
      const excepcionesAntes = await overridesOf(tx, companyId)
      const repo = createCompanyAddonRepository(failingEventsOn(tx, 5))

      await expect(repo.apply({ companyId, disable: [...ADDONS], actorId, now: at(1) })).rejects.toThrow(
        'fallo simulado del evento',
      )

      expect(await overridesOf(tx, companyId)).toEqual(excepcionesAntes)
      expect(await enabledOf(tx, companyId)).toEqual([...ADDONS])
      expect(await readCompany(tx, companyId)).toEqual(antes)
      expect(await eventsOf(tx, companyId)).toEqual([])
    })
  })

  it('R29, R33: si el autor no existe, la base rechaza la escritura y no queda nada', async () => {
    await inRolledBackTransaction(async (tx) => {
      const repo = createCompanyAddonRepository(tx)
      const companyId = await seedCompany(tx)
      const antes = await readCompany(tx, companyId)

      await expect(
        repo.apply({ companyId, enable: [...ADDONS], actorId: randomUUID(), now: at(1) }),
      ).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError)

      expect(await readCompany(tx, companyId)).toEqual(antes)
      expect(await overridesOf(tx, companyId)).toEqual([])
      expect(await eventsOf(tx, companyId)).toEqual([])
    })
  })

  it('R31: empresa de baja o inexistente → not_found, sin escribir; la lectura ve la de baja', async () => {
    await inRolledBackTransaction(async (tx) => {
      const repo = createCompanyAddonRepository(tx)
      const actorId = await createMaestro(tx)
      const deBaja = await seedCompany(tx, { addons: ['dashboard'], deleted: true })
      const antes = await readCompany(tx, deBaja)

      expect(await repo.apply({ companyId: deBaja, enable: [...ADDONS], actorId, now: at(1) })).toBe('not_found')
      expect(await repo.apply({ companyId: randomUUID(), enable: ['dashboard'], actorId, now: at(1) })).toBe(
        'not_found',
      )

      expect(await readCompany(tx, deBaja)).toEqual(antes)
      expect(await eventsOf(tx, deBaja)).toEqual([])
      expect(await repo.findByCompany(deBaja)).toEqual({ stored: ['dashboard'], alive: false })
      expect(await repo.findByCompany(randomUUID())).toBeNull()
    })
  })

  it('R33: findByCompany devuelve solo las excepciones prendidas, en el orden del catalogo', async () => {
    await inRolledBackTransaction(async (tx) => {
      const repo = createCompanyAddonRepository(tx)
      const companyId = await seedCompany(tx, {
        addons: ['integraciones', 'dashboard', 'importacion_excel'],
        off: ['proveedores'],
      })

      expect(await repo.findByCompany(companyId)).toEqual({
        stored: ['dashboard', 'importacion_excel', 'integraciones'],
        alive: true,
      })
    })
  })

  it('R34: listEvents devuelve la clave del añadido en sus eventos y null en el resto', async () => {
    await inRolledBackTransaction(async (tx) => {
      const repo = createCompanyAddonRepository(tx)
      const actorId = await createMaestro(tx)
      const companyId = await seedCompany(tx)
      await tx.companyEvent.create({
        data: { companyId, kind: 'company.created', actorId, occurredAt: NOW },
      })
      await repo.apply({ companyId, enable: ['dashboard'], actorId, now: at(1) })

      const page = await createCompanyRepository(tx).listEvents(companyId, {})
      if (page === 'not_found') throw new Error('la empresa existe')
      expect(page.items.map((evento) => [evento.kind, evento.addon, evento.fields])).toEqual([
        ['addon.enabled', 'dashboard', []],
        ['company.created', null, []],
      ])
    })
  })
})

describe('lo que no cambia al apagar', () => {
  it('R24: apagar los cinco no toca recetas, proveedores, lineas de catalogo, lotes ni la conexion de IA', async () => {
    await inRolledBackTransaction(async (tx) => {
      const repo = createCompanyAddonRepository(tx)
      const actorId = await createMaestro(tx)
      const companyId = await seedCompany(tx, { addons: [...ADDONS] })
      const marca = tag()

      await tx.recipe.create({ data: { name: `Receta ${marca}`, nameNormalized: `receta${marca}`, companyId } })
      const unit = await tx.unit.create({
        data: { name: `Unidad ${marca}`, nameNormalized: `unidad${marca}`, companyId },
        select: { id: true },
      })
      const presentation = await tx.presentation.create({
        data: { name: `Envase ${marca}`, nameNormalized: `envase${marca}`, unitId: unit.id, companyId },
        select: { id: true },
      })
      const supplier = await tx.supplier.create({
        data: { name: `Proveedor ${marca}`, nameNormalized: `proveedor${marca}`, phone: '3001112233', companyId },
        select: { id: true },
      })
      await tx.supplierCatalogLine.create({
        data: {
          supplierId: supplier.id,
          name: `Linea ${marca}`,
          nameNormalized: `linea${marca}`,
          presentationId: presentation.id,
          cost: new Prisma.Decimal('12.5'),
          companyId,
        },
      })
      const product = await tx.product.create({
        data: { name: `Producto ${marca}`, nameNormalized: `producto${marca}`, unitId: unit.id, companyId },
        select: { id: true },
      })
      await tx.productBatch.create({
        data: {
          productId: product.id,
          stock: new Prisma.Decimal('3'),
          lot: `L-${marca}`,
          purchaseDate: new Date('2026-10-01T00:00:00.000Z'),
          companyId,
        },
      })
      await tx.aiProviderConnection.create({
        data: {
          id: randomUUID(),
          companyId,
          provider: 'GOOGLE',
          apiKeyEnc: 'cifrada',
          keyUpdatedAt: NOW,
          createdById: actorId,
          updatedById: actorId,
        },
      })

      const foto = () =>
        tx.$queryRaw<Array<{ tabla: string; filas: unknown }>>`
          SELECT 'recipes' AS tabla, (SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id) FROM recipes r WHERE r.company_id = ${companyId}::uuid) AS filas
          UNION ALL SELECT 'suppliers', (SELECT jsonb_agg(to_jsonb(s) ORDER BY s.id) FROM suppliers s WHERE s.company_id = ${companyId}::uuid)
          UNION ALL SELECT 'supplier_catalog_lines', (SELECT jsonb_agg(to_jsonb(l) ORDER BY l.id) FROM supplier_catalog_lines l WHERE l.company_id = ${companyId}::uuid)
          UNION ALL SELECT 'product_batches', (SELECT jsonb_agg(to_jsonb(b) ORDER BY b.id) FROM product_batches b WHERE b.company_id = ${companyId}::uuid)
          UNION ALL SELECT 'ai_provider_connections', (SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM ai_provider_connections a WHERE a.company_id = ${companyId}::uuid)`
      const antes = await foto()
      for (const { tabla, filas } of antes) expect(Array.isArray(filas) && filas.length === 1, tabla).toBe(true)

      const result = await repo.apply({ companyId, disable: [...ADDONS], actorId, now: at(1) })

      expect(result).not.toBe('not_found')
      expect(await enabledOf(tx, companyId)).toEqual([])
      expect(await foto()).toEqual(antes)
    })
  })
})

describe('alta y lectura de sistema', () => {
  it('R5: una empresa dada de alta con createWithAdministrator nace sin ningun añadido', async () => {
    await inRolledBackTransaction(async (tx) => {
      const actorId = await createMaestro(tx)
      const marca = tag()
      const name = `Nueva ${marca}`
      const created = await createCompanyRepository(tx).createWithAdministrator({
        company: {
          name,
          nameNormalized: normalizeCompanyName(name),
          taxId: null,
          taxIdNormalized: null,
          contactEmail: null,
          contactPhone: null,
        },
        administrator: {
          firstNames: 'Ana',
          lastNames: 'Admin',
          birthDate: new Date('1990-01-01T00:00:00.000Z'),
          email: `qc277.admin.${marca}@example.test`,
          phone: '3001112233',
          documentTypeCode: DOCUMENT_TYPE_CC,
          documentNumber: marca.slice(0, 20),
          username: `qc277.admin.${marca}`,
        },
        actorId,
        now: NOW,
      })
      if (typeof created === 'string') throw new Error(`el alta no debia fallar: ${created}`)

      expect(await overridesOf(tx, created.companyId)).toEqual([])
      expect(await createCompanyAddonRepository(tx).findByCompany(created.companyId)).toEqual({
        stored: [],
        alive: true,
      })
    })
  })

  it('R4, R22: isCompanyAddonActive sobre el adaptador real: dependencia, empresa de baja e inexistente', async () => {
    await inRolledBackTransaction(async (tx) => {
      const isActive = createIsCompanyAddonActive({ addons: createCompanyAddonRepository(tx) })
      const sinIntegraciones = await seedCompany(tx, { addons: ['lectura_pdf'] })
      const conTodo = await seedCompany(tx, { addons: [...ADDONS] })
      const deBaja = await seedCompany(tx, { addons: [...ADDONS], deleted: true })

      expect(await isActive(sinIntegraciones, 'lectura_pdf')).toBe(false)
      expect(await isActive(conTodo, 'lectura_pdf')).toBe(true)
      expect(await isActive(deBaja, 'lectura_pdf')).toBe(false)
      expect(await isActive(randomUUID(), 'lectura_pdf')).toBe(false)
    })
  })
})

describe('el catalogo en la base', () => {
  it('R2: la tabla addons de la base tiene exactamente las claves de ADDONS', async () => {
    await inRolledBackTransaction(async (tx) => {
      const filas = await tx.addon.findMany({ select: { key: true } })
      expect(filas.map((fila) => fila.key).sort()).toEqual([...ADDONS].sort())
    })
  })

  it('R2: una excepcion con una clave que el catalogo no conoce la rechaza la FK con 23503', async () => {
    await inRolledBackTransaction(async (tx) => {
      const companyId = await seedCompany(tx)

      const sqlState = await rejectedByDatabase(
        tx,
        () => tx.$executeRaw`
          INSERT INTO company_addon_overrides (company_id, addon_key, enabled)
          VALUES (${companyId}::uuid, 'futuro', true)`,
      )

      expect(sqlState).toBe('23503')
      expect(await overridesOf(tx, companyId)).toEqual([])
    })
  })
})

describe('la sesion ve el cambio en la siguiente lectura', () => {
  it('R9: apagar con apply y releer con la lectura de sesion → permisos recortados, sin emitir sesion', async () => {
    await inRolledBackTransaction(async (tx) => {
      const repo = createCompanyAddonRepository(tx)
      const actorId = await createMaestro(tx)
      const companyId = await seedCompany(tx, { addons: [...ADDONS] })
      const userId = await createUser(tx, ROLE_ADMINISTRADOR, companyId)
      const sesionesAntes = await tx.revokedSession.count({ where: { userId } })

      const permisosDe = async (): Promise<readonly string[]> => {
        const record = await findActiveSessionUserById(userId, randomUUID())
        if (record === null) throw new Error('el usuario esta vivo')
        return effectivePermissions(record.permissions, effectiveAddons(record.companyAddons))
      }

      const antes = await permisosDe()
      expect(antes).toEqual(expect.arrayContaining(['dashboard.consultar', 'proveedores.consultar']))

      await repo.apply({ companyId, disable: [...ADDONS], actorId, now: at(1) })

      const despues = await permisosDe()
      for (const quitado of [
        'dashboard.consultar',
        'proveedores.consultar',
        'proveedores.modificar',
        'documentos.consultar',
        'documentos.modificar',
        'integraciones.modificar',
      ]) {
        expect(despues, quitado).not.toContain(quitado)
      }
      expect(despues).toEqual(expect.arrayContaining(['inventario.consultar', 'pedidos.consultar']))
      expect(await tx.revokedSession.count({ where: { userId } })).toBe(sesionesAntes)
    })
  })
})
