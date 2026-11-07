// QT-314 T5 — `cancelOrderLineAction`: la Server Action de cancelar UNA receta del pedido.
// Mockea `@/lib/composition` igual que `order-actions.test.ts`: la action se prueba contra
// dobles, nunca contra el dominio real ni contra la sesion real.
//
// El doble de `cancelOrderLine` hace lo que hace el caso de uso en su borde -primero
// `requirePermission(actor, 'pedidos.modificar')`, despues `cancelOrderLineSchema`- con las piezas
// REALES del dominio: asi el motivo invalido y la falta de permiso se miden hasta el `code` que ve
// el dialogo, sin que la action repita ninguna de las dos comprobaciones.

import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  NotCancellableError,
  OrderNotFoundError,
  ValidationError,
  requirePermission,
} from '@/lib/modules/pedidos'
import {
  cancelOrderLineAction,
  type OrderMutationFormState,
} from '@/lib/modules/pedidos/adapters/driving/order-actions'
import { cancelOrderLineSchema } from '@/lib/modules/pedidos/domain/order-input'

import type { Actor } from '@/lib/modules/pedidos'

const { cancelOrderLineMock, getSessionUserMock, getSessionContextMock, REQUEST_ID } = vi.hoisted(() => ({
  cancelOrderLineMock: vi.fn(),
  getSessionUserMock: vi.fn(),
  getSessionContextMock: vi.fn(),
  REQUEST_ID: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
}))

vi.mock('@/lib/composition', () => ({
  observabilidad: { readRequestIdHeader: vi.fn(async () => REQUEST_ID) },
  identity: { getSessionUser: getSessionUserMock, getSessionContext: getSessionContextMock },
  pedidos: { cancelOrderLine: cancelOrderLineMock },
}))

const SESSION_USER = {
  id: 'user-admin-1',
  username: 'ana.perez',
  displayName: 'Ana Perez',
  roleName: 'Administrador',
  permissions: ['pedidos.consultar', 'pedidos.modificar'],
}
const COMPANY_ID = '33333333-3333-4333-8333-333333333333'
const EXPECTED_ACTOR = { id: SESSION_USER.id, companyId: COMPANY_ID, permissions: SESSION_USER.permissions }

const ORDER_ID = '11111111-1111-4111-8111-111111111111'
const LINE_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const IDLE: OrderMutationFormState = { status: 'idle' }

function formDataOf(fields: Record<string, string>): FormData {
  const formData = new FormData()
  for (const [name, value] of Object.entries(fields)) formData.set(name, value)
  return formData
}

/** El borde del caso de uso real: permiso primero, motivo despues. */
async function bordeDelCasoDeUso(
  _orderId: string,
  _lineId: string,
  input: unknown,
  actor: Actor | null | undefined,
): Promise<void> {
  requirePermission(actor, 'pedidos.modificar')
  if (!cancelOrderLineSchema.safeParse(input).success) throw new ValidationError()
}

beforeEach(() => {
  vi.clearAllMocks()
  cancelOrderLineMock.mockReset()
  cancelOrderLineMock.mockImplementation(bordeDelCasoDeUso)
  getSessionUserMock.mockResolvedValue(SESSION_USER)
  getSessionContextMock.mockResolvedValue({ companyId: COMPANY_ID })
})

describe('QT-314 T5 — cancelOrderLineAction', () => {
  it('R29: cancela la receta con el pedido, la receta y el motivo tal cual, y responde exito', async () => {
    const result = await cancelOrderLineAction(
      IDLE,
      formDataOf({ id: ORDER_ID, lineId: LINE_ID, reason: '  sin material  ' }),
    )

    expect(result).toEqual({ status: 'success' })
    expect(cancelOrderLineMock).toHaveBeenCalledTimes(1)
    // El motivo viaja sin recortar: el recorte es del esquema, dentro del caso de uso.
    expect(cancelOrderLineMock).toHaveBeenCalledWith(ORDER_ID, LINE_ID, { reason: '  sin material  ' }, EXPECTED_ACTOR)
  })

  it('R29: una receta que ya no se puede cancelar responde not_cancellable con el mensaje del catalogo', async () => {
    const error = new NotCancellableError()
    cancelOrderLineMock.mockRejectedValueOnce(error)

    const result = await cancelOrderLineAction(IDLE, formDataOf({ id: ORDER_ID, lineId: LINE_ID, reason: 'sin material' }))

    expect(result).toEqual({ status: 'error', code: 'not_cancellable', message: error.message })
  })

  it('R29: una receta de otro pedido o quitada responde order_not_found', async () => {
    const error = new OrderNotFoundError()
    cancelOrderLineMock.mockRejectedValueOnce(error)

    const result = await cancelOrderLineAction(IDLE, formDataOf({ id: ORDER_ID, lineId: LINE_ID, reason: 'sin material' }))

    expect(result).toEqual({ status: 'error', code: 'order_not_found', message: error.message })
  })

  it.each([
    ['vacio', ''],
    ['en blanco', '   '],
    ['de 501 caracteres', 'x'.repeat(501)],
  ])('R29: un motivo %s responde invalid_input', async (_caso, reason) => {
    const result = await cancelOrderLineAction(IDLE, formDataOf({ id: ORDER_ID, lineId: LINE_ID, reason }))

    expect(result).toEqual({ status: 'error', code: 'invalid_input', message: expect.any(String) })
    expect(cancelOrderLineMock).toHaveBeenCalledTimes(1)
  })

  it('R29: un motivo de 500 caracteres se acepta', async () => {
    const result = await cancelOrderLineAction(
      IDLE,
      formDataOf({ id: ORDER_ID, lineId: LINE_ID, reason: 'x'.repeat(500) }),
    )

    expect(result).toEqual({ status: 'success' })
  })

  it.each([
    ['sin id', { lineId: LINE_ID, reason: 'sin material' }],
    ['con id vacio', { id: '', lineId: LINE_ID, reason: 'sin material' }],
    ['sin lineId', { id: ORDER_ID, reason: 'sin material' }],
    ['con lineId vacio', { id: ORDER_ID, lineId: '', reason: 'sin material' }],
  ])('R29: %s responde invalid_input sin llamar al caso de uso ni leer la sesion', async (_caso, fields) => {
    const result = await cancelOrderLineAction(IDLE, formDataOf(fields))

    expect(result).toEqual({ status: 'error', code: 'invalid_input', message: expect.any(String) })
    expect(cancelOrderLineMock).not.toHaveBeenCalled()
    expect(getSessionUserMock).not.toHaveBeenCalled()
  })

  it('R42: sin pedidos.modificar responde unauthorized', async () => {
    getSessionUserMock.mockResolvedValue({ ...SESSION_USER, permissions: ['pedidos.consultar'] })

    const result = await cancelOrderLineAction(IDLE, formDataOf({ id: ORDER_ID, lineId: LINE_ID, reason: 'sin material' }))

    expect(result).toEqual({ status: 'error', code: 'unauthorized', message: expect.any(String) })
  })

  it('R42: sin sesion el actor llega null y responde unauthorized', async () => {
    getSessionUserMock.mockResolvedValue(null)

    const result = await cancelOrderLineAction(IDLE, formDataOf({ id: ORDER_ID, lineId: LINE_ID, reason: 'sin material' }))

    expect(result).toEqual({ status: 'error', code: 'unauthorized', message: expect.any(String) })
    expect(cancelOrderLineMock).toHaveBeenCalledWith(ORDER_ID, LINE_ID, { reason: 'sin material' }, null)
  })
})
