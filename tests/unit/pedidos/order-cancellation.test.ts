// La cancelacion por encargo de otro modulo y la definicion unica de «cancelable» en `pedidos`.
//
// `createCancelAliveOrder` corre el MISMO cuerpo que `cancelOrder` dentro de su unidad de
// trabajo: aqui se prueba con el doble compartido, que corre el trabajo sin transaccion real.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import { ORDER_STATUS_VALUES, createCancelAliveOrder } from '@/lib/modules/pedidos'
import { isCancellableStatus } from '@/lib/modules/pedidos/domain/order-cancellation'

import { fakeOrderRow, fakeUnitOfWork, orderLineOf } from '@/tests/helpers/order-unit-of-work-double'

import type { OrderStatus } from '@/lib/modules/pedidos'
import type { OrderLineStatus } from '@/lib/modules/pedidos/domain/order-classification'

const ORDER_ID = '11111111-1111-4111-8111-111111111111'
const COMPANY_ID = '33333333-3333-4333-8333-333333333333'
const ACTOR_ID = 'operador-1'
const AHORA = new Date('2026-10-06T12:00:00.000Z')
const MOTIVO = 'El cliente ya no lo quiere'

const repoRoot = process.cwd()
const pedidosDir = join(repoRoot, 'lib', 'modules', 'pedidos')

function fuentesDe(dir: string): readonly string[] {
  const salida: string[] = []
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre)
    if (statSync(ruta).isDirectory()) salida.push(...fuentesDe(ruta))
    else if (/\.tsx?$/.test(nombre)) salida.push(ruta)
  }
  return salida.sort()
}

function etiqueta(ruta: string): string {
  return relative(repoRoot, ruta).split(sep).join('/')
}

/** Codigo sin comentarios: la prosa puede nombrar `cancelAlive` sin que cuente como llamada. */
function sinComentarios(texto: string): string {
  return texto
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .map((linea) => linea.replace(/\/\/.*$/, ''))
    .join('\n')
}

const LINEA_ID = '0e0e0e0e-0e0e-4e0e-8e0e-0e0e0e0e0e0e'

function dobles(opciones: { estado?: OrderLineStatus | null; cancelacion?: 'ok' | 'not_found' } = {}) {
  const estado = opciones.estado === undefined ? 'PENDIENTE' : opciones.estado
  const lockAliveLines = vi.fn(async (id: string, scope: { companyId: string }) => {
    void [id, scope]
    if (estado === null) return null
    const order = fakeOrderRow({ status: estado })
    return { order, lines: [orderLineOf(order)] }
  })
  const cancelLine = vi.fn(
    async (id: string, lineId: string, reason: string, actorId: string | null, when: Date, scope: { companyId: string }) => {
      void [id, lineId, reason, actorId, when, scope]
      return opciones.cancelacion ?? 'ok'
    },
  )
  const setLineReservedAt = vi.fn(async (id: string, lineId: string, reservedAt: Date | null, scope: { companyId: string }) => {
    void [id, lineId, reservedAt, scope]
  })
  const refreshStatus = vi.fn(async () => 'CANCELADO' as const)
  const mirrorFirstLine = vi.fn(async () => undefined)
  const releaseForLine = vi.fn(async (input: unknown) => {
    void input
  })
  const { unitOfWork, orders } = fakeUnitOfWork({
    orders: { lockAliveLines, cancelLine, setLineReservedAt, refreshStatus, mirrorFirstLine },
    reservations: { releaseForLine },
  })
  return { unitOfWork, orders, lockAliveLines, cancelLine, setLineReservedAt, refreshStatus, mirrorFirstLine, releaseForLine }
}

describe('isCancellableStatus — una sola definicion de «cancelable» (R29, R43)', () => {
  const ESPERADO: Readonly<Record<OrderStatus, boolean>> = {
    PARCIAL: false,
    PENDIENTE: true,
    EN_CURSO: true,
    BLOQUEADO: true,
    POR_EMPACAR: false,
    EN_EMPAQUE: false,
    POR_ACONDICIONAR: false,
    EN_ACONDICIONAMIENTO: false,
    TERMINADO: false,
    ENTREGADO: false,
    CANCELADO: false,
  }

  it('R29: clasifica los once estados de OrderStatus, ni uno mas ni uno menos', () => {
    expect([...ORDER_STATUS_VALUES].sort()).toEqual(Object.keys(ESPERADO).sort())
  })

  for (const [estado, cancelable] of Object.entries(ESPERADO) as [OrderStatus, boolean][]) {
    it(`R29, R43: ${estado} ${cancelable ? 'se cancela' : 'no se cancela'}`, () => {
      expect(isCancellableStatus(estado)).toBe(cancelable)
    })
  }
})

describe('createCancelAliveOrder — cancelar por encargo, por el camino unico (R29, R43)', () => {
  it('R29: un pedido cancelable devuelve ok, y cancela su linea, libera con el autor recibido, vacia su plazo y deriva el pedido, en ese orden', async () => {
    const d = dobles({ estado: 'EN_CURSO' })

    const resultado = await createCancelAliveOrder({ unitOfWork: d.unitOfWork })(
      ORDER_ID,
      COMPANY_ID,
      MOTIVO,
      ACTOR_ID,
      AHORA,
    )

    expect(resultado).toBe('ok')
    expect(d.lockAliveLines).toHaveBeenCalledWith(ORDER_ID, { companyId: COMPANY_ID })
    expect(d.cancelLine.mock.calls).toEqual([[ORDER_ID, LINEA_ID, MOTIVO, ACTOR_ID, AHORA, { companyId: COMPANY_ID }]])
    expect(d.releaseForLine.mock.calls).toEqual([
      [{ orderId: ORDER_ID, orderLineId: LINEA_ID, companyId: COMPANY_ID, reason: 'release', actorId: ACTOR_ID, now: AHORA }],
    ])
    expect(d.setLineReservedAt.mock.calls).toEqual([[ORDER_ID, LINEA_ID, null, { companyId: COMPANY_ID }]])
    expect(d.refreshStatus).toHaveBeenCalledWith(ORDER_ID, ACTOR_ID, AHORA, { companyId: COMPANY_ID })

    const orden = [
      d.lockAliveLines.mock.invocationCallOrder[0],
      d.cancelLine.mock.invocationCallOrder[0],
      d.releaseForLine.mock.invocationCallOrder[0],
      d.setLineReservedAt.mock.invocationCallOrder[0],
      d.refreshStatus.mock.invocationCallOrder[0],
      d.mirrorFirstLine.mock.invocationCallOrder[0],
    ]
    expect(orden).toEqual([...orden].sort((a, b) => (a ?? 0) - (b ?? 0)))
    // QT-313 R29: el estado del pedido no se escribe, se deriva.
    expect(d.orders.cancelAlive).not.toHaveBeenCalled()
    expect(d.orders.setReservedAt).not.toHaveBeenCalled()
  })

  it('R29: un BLOQUEADO tambien se cancela por encargo', async () => {
    const d = dobles({ estado: 'BLOQUEADO' })

    const resultado = await createCancelAliveOrder({ unitOfWork: d.unitOfWork })(
      ORDER_ID,
      COMPANY_ID,
      MOTIVO,
      ACTOR_ID,
      AHORA,
    )

    expect(resultado).toBe('ok')
    expect(d.cancelLine).toHaveBeenCalledTimes(1)
  })

  it('R29: un pedido que no existe (o es de otra empresa) es not_found, sin cancelar ni liberar', async () => {
    const d = dobles({ estado: null })

    const resultado = await createCancelAliveOrder({ unitOfWork: d.unitOfWork })(
      ORDER_ID,
      COMPANY_ID,
      MOTIVO,
      ACTOR_ID,
      AHORA,
    )

    expect(resultado).toBe('not_found')
    expect(d.cancelLine).not.toHaveBeenCalled()
    expect(d.releaseForLine).not.toHaveBeenCalled()
    expect(d.setLineReservedAt).not.toHaveBeenCalled()
  })

  it('R29: si la linea bloqueada no se puede escribir, lanza order_not_found sin liberar', async () => {
    const d = dobles({ estado: 'PENDIENTE', cancelacion: 'not_found' })

    await expect(
      createCancelAliveOrder({ unitOfWork: d.unitOfWork })(ORDER_ID, COMPANY_ID, MOTIVO, ACTOR_ID, AHORA),
    ).rejects.toMatchObject({ code: 'order_not_found' })
    expect(d.releaseForLine).not.toHaveBeenCalled()
    expect(d.setLineReservedAt).not.toHaveBeenCalled()
  })

  for (const estado of ['POR_EMPACAR', 'EN_EMPAQUE', 'ENTREGADO', 'CANCELADO'] as const) {
    it(`R29, R43: un pedido ${estado} es not_cancellable (no not_found), sin cancelar ni liberar`, async () => {
      const d = dobles({ estado })

      const resultado = await createCancelAliveOrder({ unitOfWork: d.unitOfWork })(
        ORDER_ID,
        COMPANY_ID,
        MOTIVO,
        ACTOR_ID,
        AHORA,
      )

      expect(resultado).toBe('not_cancellable')
      expect(d.cancelLine).not.toHaveBeenCalled()
      expect(d.releaseForLine).not.toHaveBeenCalled()
      expect(d.setLineReservedAt).not.toHaveBeenCalled()
    })
  }

  for (const estado of ['POR_ACONDICIONAR', 'EN_ACONDICIONAMIENTO', 'TERMINADO'] as const) {
    it(`R18: un pedido ${estado} es not_cancellable, sin cancelar ni liberar`, async () => {
      const d = dobles({ estado })

      const resultado = await createCancelAliveOrder({ unitOfWork: d.unitOfWork })(
        ORDER_ID,
        COMPANY_ID,
        MOTIVO,
        ACTOR_ID,
        AHORA,
      )

      expect(resultado).toBe('not_cancellable')
      expect(d.cancelLine).not.toHaveBeenCalled()
      expect(d.releaseForLine).not.toHaveBeenCalled()
      expect(d.setLineReservedAt).not.toHaveBeenCalled()
    })
  }
})

describe('pedidos — una sola definicion de «cancelable» y un solo cuerpo de cancelacion (R29)', () => {
  const fuentes = fuentesDe(pedidosDir).map((ruta) => ({
    ruta: etiqueta(ruta),
    codigo: sinComentarios(readFileSync(ruta, 'utf8')),
  }))

  it('R29: cancel-order.ts ya no declara su propia lista de estados cancelables', () => {
    const cancelOrder = fuentes.find((f) => f.ruta === 'lib/modules/pedidos/domain/cancel-order.ts')
    expect(cancelOrder).toBeDefined()
    expect(cancelOrder?.codigo).not.toMatch(/\bCANCELABLES?\b/)
    expect(cancelOrder?.codigo).not.toMatch(/'PENDIENTE'|'EN_CURSO'|'BLOQUEADO'/)
    expect(cancelOrder?.codigo).toMatch(/\bcancelInsideTransaction\s*\(/)
  })

  it('R29: el modulo tiene UNA sola definicion de «cancelable»', () => {
    const definiciones = fuentes
      .filter((f) => /\b(?:function|const|let)\s+(?:isCancellable\w*|CANCEL+ABLES?|cancel+ables?)\b/i.test(f.codigo))
      .map((f) => f.ruta)
    expect(definiciones).toEqual(['lib/modules/pedidos/domain/order-cancellation.ts'])
  })

  it('QT-313 R27, R29, R51: ninguna operacion del modulo escribe el estado del pedido con cancelAlive; cancelLine solo lo llama el cuerpo unico', () => {
    const llamadas = (patron: RegExp) =>
      fuentes.flatMap((f) => [...f.codigo.matchAll(patron)].map(() => f.ruta)).filter((ruta) => ruta.includes('/domain/'))
    expect(llamadas(/\.cancelAlive\s*\(/g)).toEqual([])
    expect([...new Set(llamadas(/\.cancelLine\s*\(/g))]).toEqual(['lib/modules/pedidos/domain/order-cancellation.ts'])
  })
})
