// QC-289 — Orden POR DEFECTO de los listados paginados: los mas nuevos primero.
//
// Cuando el usuario no elige columna (`sort === null`), cada adaptador traduce el orden por
// defecto a `created_at DESC` con el desempate estable por `id ASC`. Pedidos es la excepcion
// declarada: la prioridad manda primero (QC-33 R16) y, dentro de ella, los mas nuevos primero.
//
// HONESTIDAD: este archivo NO toca Postgres. Comprueba la FORMA del `orderBy` que sale de cada
// adaptador; que Postgres devuelva las filas en ese orden lo cubren los `list-query-*.int.test.ts`
// de cada modulo. El cliente Prisma se sustituye por un doble para que importar los adaptadores
// no abra conexion.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaDouble = vi.hoisted(() => ({
  unit: { findMany: vi.fn() },
}))

vi.mock('@/lib/shared/db/prisma', () => ({ prisma: prismaDouble }))

import { customerOrderBy } from '@/lib/modules/clientes/adapters/driven/persistence/customer-prisma'
import { userOrderBy } from '@/lib/modules/identity/adapters/driven/persistence/user-admin-prisma'
import { workGroupOrderBy } from '@/lib/modules/identity/adapters/driven/persistence/work-group-prisma'
import { presentationOrderBy } from '@/lib/modules/inventario/adapters/driven/persistence/presentation-prisma'
import { orderOrderBy } from '@/lib/modules/pedidos/adapters/driven/persistence/order-prisma'
import { catalogLineOrderBy } from '@/lib/modules/proveedores/adapters/driven/persistence/supplier-catalog-line-prisma'
import { supplierOrderBy } from '@/lib/modules/proveedores/adapters/driven/persistence/supplier-prisma'
import { recipeOrderBy } from '@/lib/modules/recetas/adapters/driven/persistence/recipe-prisma'
import { listUnits, unitOrderBy } from '@/lib/modules/unidades/adapters/driven/persistence/unit-prisma'

const MAS_NUEVOS_PRIMERO = [{ createdAt: 'desc' }, { id: 'asc' }]

describe('QC-289 — sin columna elegida, los listados paginados van mas nuevos primero', () => {
  it.each([
    ['presentaciones', () => presentationOrderBy(null)],
    ['unidades (pagina)', () => unitOrderBy(null)],
    ['recetas', () => recipeOrderBy(null)],
    ['proveedores', () => supplierOrderBy(null)],
    ['catalogo de un proveedor (antes created_at ASC)', () => catalogLineOrderBy(null)],
    ['grupos de trabajo', () => workGroupOrderBy(null)],
    ['usuarios', () => userOrderBy(null)],
    ['clientes', () => customerOrderBy(null)],
  ])('%s: `created_at DESC, id ASC`', (_listado, ordenPorDefecto) => {
    expect(ordenPorDefecto()).toEqual(MAS_NUEVOS_PRIMERO)
  })

  it('cada llamada devuelve un array NUEVO: un llamante no puede mutar el orden de los demas', () => {
    const uno = recipeOrderBy(null)
    const otro = recipeOrderBy(null)
    expect(uno).not.toBe(otro)
  })

  it('una columna elegida por el usuario NO se toca: sigue mandando ella, con el desempate por id', () => {
    expect(recipeOrderBy({ columnId: 'name', direction: 'asc' })).toEqual([
      { name: 'asc' },
      { id: 'asc' },
    ])
    expect(supplierOrderBy({ columnId: 'name', direction: 'desc' })).toEqual([
      { name: 'desc' },
      { id: 'asc' },
    ])
  })

  it('una columna no declarada cae al orden por defecto nuevo, no al alfabetico de antes', () => {
    expect(customerOrderBy({ columnId: 'noExiste', direction: 'asc' })).toEqual(MAS_NUEVOS_PRIMERO)
    expect(userOrderBy({ columnId: 'noExiste', direction: 'asc' })).toEqual(MAS_NUEVOS_PRIMERO)
  })
})

describe('QC-289 — pedidos: la prioridad primero (QC-33 R16), luego los mas nuevos', () => {
  it('sin columna elegida: `priority DESC, created_at DESC, order_year DESC, order_sequence DESC, id ASC`', () => {
    expect(orderOrderBy(null)).toEqual([
      { priority: 'desc' },
      { createdAt: 'desc' },
      { orderYear: 'desc' },
      { orderSequence: 'desc' },
      { id: 'asc' },
    ])
  })

  it('la prioridad sigue siendo el PRIMER criterio', () => {
    expect(orderOrderBy(null)[0]).toEqual({ priority: 'desc' })
  })
})

describe('QC-289 — el catalogo entero de unidades (selectores) sigue alfabetico', () => {
  beforeEach(() => {
    prismaDouble.unit.findMany.mockReset()
    prismaDouble.unit.findMany.mockResolvedValue([])
  })

  it('sin `sort`, `listUnits` ordena por `name ASC, id ASC`, no por fecha de alta', async () => {
    await listUnits(10, { page: 1, sort: null, filters: {}, search: '' }, { companyId: 'c' })

    const args = prismaDouble.unit.findMany.mock.calls[0]?.[0] as { orderBy?: unknown }
    expect(args.orderBy).toEqual([{ name: 'asc' }, { id: 'asc' }])
  })

  it('con `sort`, `listUnits` respeta la columna pedida', async () => {
    await listUnits(
      10,
      { page: 1, sort: { columnId: 'name', direction: 'desc' }, filters: {}, search: '' },
      { companyId: 'c' },
    )

    const args = prismaDouble.unit.findMany.mock.calls[0]?.[0] as { orderBy?: unknown }
    expect(args.orderBy).toEqual([{ name: 'desc' }, { id: 'asc' }])
  })
})
