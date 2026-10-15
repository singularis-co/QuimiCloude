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

async function seedCompany(
  tx: Tx,
  fields: { addons?: string[]; deleted?: boolean } = {},
): Promise<string> {
  const name = `Anadidos ${tag()}`
  const company = await tx.company.create({
    data: {
      name,
      nameNormalized: normalizeCompanyName(name),
      addons: fields.addons ?? [],
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: fields.deleted === true ? NOW : null,
    },
    select: { id: true },
  })
  return company.id
}

function readCompany(tx: Tx, id: string) {
  return tx.company.findUniqueOrThrow({
    where: { id },
    select: { id: true, name: true, addons: true, createdAt: true, updatedAt: true, deletedAt: true },
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
      expect(fila.addons).toEqual(['dashboard', 'proveedores', 'integraciones'])
      expect(fila.updatedAt).toEqual(at(5))
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

  it('R33: apagar escribe addon.disabled; las claves desconocidas se conservan al final', async () => {
    await inRolledBackTransaction(async (tx) => {
      const repo = createCompanyAddonRepository(tx)
      const actorId = await createMaestro(tx)
      const companyId = await seedCompany(tx, { addons: ['futuro', 'lectura_pdf', 'dashboard'] })

      const result = await repo.apply({ companyId, disable: ['lectura_pdf'], actorId, now: at(1) })

      expect(result).toEqual({ stored: ['dashboard', 'futuro'], changed: [{ addon: 'lectura_pdf', enabled: false }] })
      expect((await readCompany(tx, companyId)).addons).toEqual(['dashboard', 'futuro'])
      expect(await eventsOf(tx, companyId)).toEqual([
        { kind: 'addon.disabled', actorId, occurredAt: at(1), details: { addon: 'lectura_pdf' } },
      ])
    })
  })

  it('R33: sin cambios no escribe: ni updated_at ni evento', async () => {
    await inRolledBackTransaction(async (tx) => {
      const repo = createCompanyAddonRepository(tx)
      const actorId = await createMaestro(tx)
      const companyId = await seedCompany(tx, { addons: ['dashboard'] })
      const antes = await readCompany(tx, companyId)

      const result = await repo.apply({
        companyId,
        enable: ['dashboard'],
        disable: ['proveedores'],
        actorId,
        now: at(9),
      })

      expect(result).toEqual({ stored: ['dashboard'], changed: [] })
      expect(await readCompany(tx, companyId)).toEqual(antes)
      expect(await eventsOf(tx, companyId)).toEqual([])
    })
  })

  it('R29, R33: si un evento no se puede escribir (autor inexistente), la fila tampoco cambia', async () => {
    await inRolledBackTransaction(async (tx) => {
      const repo = createCompanyAddonRepository(tx)
      const companyId = await seedCompany(tx)
      const antes = await readCompany(tx, companyId)

      await expect(
        repo.apply({ companyId, enable: [...ADDONS], actorId: randomUUID(), now: at(1) }),
      ).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError)

      expect(await readCompany(tx, companyId)).toEqual(antes)
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
      expect((await readCompany(tx, companyId)).addons).toEqual([])
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

      expect((await readCompany(tx, created.companyId)).addons).toEqual([])
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
