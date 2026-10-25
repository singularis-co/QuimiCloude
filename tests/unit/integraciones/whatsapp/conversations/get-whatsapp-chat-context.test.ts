import { describe, expect, it, vi } from 'vitest'

import type { PresentationCatalog, PresentationRef } from '@/lib/modules/inventario'
import { WHATSAPP_READ_PERMISSION, type Actor } from '@/lib/modules/integraciones/domain/actor'
import {
  LinkedCustomerNotFoundError,
  UnauthorizedError,
  ValidationError,
  WhatsappContactNotFoundError,
  WhatsappOrderNotFoundError,
} from '@/lib/modules/integraciones/domain/errors'
import { createGetWhatsappChatContext } from '@/lib/modules/integraciones/domain/get-whatsapp-chat-context'
import { WHATSAPP_SYSTEM_CONSTANT_KEYS } from '@/lib/modules/integraciones/domain/whatsapp-chat-context'
import { CUSTOMER_ORDERS_LIMIT } from '@/lib/modules/integraciones/domain/whatsapp-conversation-input'
import type { CompanyNameLookup } from '@/lib/modules/integraciones/ports/company-name-lookup'
import {
  ORDER_STATUSES_NOT_IN_PROGRESS,
  type CustomerOrderDirectory,
  type CustomerOrderSummary,
  type OrderCatalog,
  type OrderDeliveryProgress,
  type OrderDeliveryProgressLine,
} from '@/lib/modules/pedidos'
import type { RecipeCatalog, RecipeRef } from '@/lib/modules/recetas'

import {
  COMPANY_ID,
  CONTACT_ID,
  CUSTOMER_ID,
  NEW_CONNECTION_ID,
  OTHER_COMPANY_ID,
  OTHER_CUSTOMER_ID,
  admin,
  conversationContact,
  conversationMessage,
  customerRef,
  makeConversationRepository,
  makeCustomerCatalog,
  makeRepository,
  makeVariableKeyRepository,
  storedConnection,
  storedVariableKey,
  type ConversationDoubleContact,
} from '../whatsapp-doubles'

const RECIPE_ID = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d'
const OTHER_RECIPE_ID = '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4e'
const BIDON = '11111111-1111-4111-8111-111111111111'
const GARRAFA = '22222222-2222-4222-8222-222222222222'
const UNKNOWN_ORDER_ID = '99999999-9999-4999-8999-999999999999'

function orderId(n: number): string {
  return `6f1c2b8e-3d4a-4c5b-9e6f-${String(n).padStart(12, '0')}`
}

function reader(overrides: Partial<Actor> = {}): Actor {
  return admin({ permissions: [WHATSAPP_READ_PERMISSION], ...overrides })
}

type StoredOrder = CustomerOrderSummary & {
  readonly companyId: string
  readonly customerId: string
  readonly deleted?: boolean
}

function storedOrder(n: number, overrides: Partial<StoredOrder> = {}): StoredOrder {
  return {
    id: orderId(n),
    companyId: COMPANY_ID,
    customerId: CUSTOMER_ID,
    number: { year: 2026, sequence: 100 + n },
    status: 'EN_CURSO',
    recipeId: RECIPE_ID,
    createdAt: new Date(Date.UTC(2026, 9, 10 + n, 15, 0)),
    ...overrides,
  }
}

function progressLine(overrides: Partial<OrderDeliveryProgressLine> = {}): OrderDeliveryProgressLine {
  return {
    presentationId: BIDON,
    packages: 10,
    packedPackages: null,
    packedSurplusPackages: 0,
    deliveredPackages: 0,
    ...overrides,
  }
}

/** Directorio con las reglas del adaptador: empresa, cliente, vivos, estados excluidos, orden y límite. */
function makeOrderDirectory(orders: readonly StoredOrder[]) {
  const listAliveOfCustomer = vi.fn<CustomerOrderDirectory['listAliveOfCustomer']>(
    async (companyId, customerId, excludedStatuses, limit) =>
      orders
        .filter(
          (row) =>
            row.companyId === companyId &&
            row.customerId === customerId &&
            row.deleted !== true &&
            !excludedStatuses.includes(row.status),
        )
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : -1))
        .slice(0, limit)
        .map((row) => ({ id: row.id, number: row.number, status: row.status, recipeId: row.recipeId, createdAt: row.createdAt })),
  )
  return { customerOrders: { listAliveOfCustomer }, listAliveOfCustomer }
}

function makeDeliveryProgress(byOrder: Record<string, readonly OrderDeliveryProgressLine[]>, recipeOf: (id: string) => string) {
  const listDeliveryProgressByIdsIncludingDeleted = vi.fn<OrderCatalog['listDeliveryProgressByIdsIncludingDeleted']>(
    async (companyId, ids) =>
      companyId !== COMPANY_ID
        ? []
        : ids.flatMap((id): OrderDeliveryProgress[] =>
            byOrder[id] === undefined ? [] : [{ id, recipeId: recipeOf(id), lines: byOrder[id] }],
          ),
  )
  return { deliveryProgress: { listDeliveryProgressByIdsIncludingDeleted }, listDeliveryProgressByIdsIncludingDeleted }
}

function makePresentations(names: Record<string, string>) {
  const findRefs = vi.fn<PresentationCatalog['findRefs']>(async (ids, companyId) =>
    companyId !== COMPANY_ID
      ? []
      : ids.flatMap((id): PresentationRef[] =>
          names[id] === undefined ? [] : [{ id, name: names[id], content: null, unitId: 'unidad' }],
        ),
  )
  return { presentations: { findRefs }, findRefs }
}

function makeRecipes(names: Record<string, string>) {
  const findRefsIncludingDeleted = vi.fn<RecipeCatalog['findRefsIncludingDeleted']>(async (ids, companyId) =>
    companyId !== COMPANY_ID
      ? []
      : ids.flatMap((id): RecipeRef[] =>
          names[id] === undefined ? [] : [
            { id, name: names[id], ownName: names[id], isDeleted: false, isUnderReview: false, original: null, imageUrl: null },
          ],
        ),
  )
  return { recipes: { findRefsIncludingDeleted }, findRefsIncludingDeleted }
}

function setup(
  options: {
    contacts?: readonly ConversationDoubleContact[]
    connected?: boolean
    refs?: Parameters<typeof makeCustomerCatalog>[0]
    orders?: readonly StoredOrder[]
    progress?: Record<string, readonly OrderDeliveryProgressLine[]>
    companyName?: string | null
    variables?: Parameters<typeof makeVariableKeyRepository>[0]
  } = {},
) {
  const orders = options.orders ?? [storedOrder(1)]
  const repo = makeRepository(options.connected === false ? [] : [storedConnection(() => 'cifrado', { status: 'ACTIVE' })])
  const conv = makeConversationRepository(options.contacts ?? [conversationContact()], [conversationMessage()])
  const catalog = makeCustomerCatalog(options.refs)
  const directory = makeOrderDirectory(orders)
  const delivery = makeDeliveryProgress(
    options.progress ?? { [orderId(1)]: [progressLine({ deliveredPackages: 6 })] },
    (id) => orders.find((row) => row.id === id)?.recipeId ?? RECIPE_ID,
  )
  const presentations = makePresentations({ [BIDON]: 'Bidón 20 L', [GARRAFA]: 'Garrafa 5 L' })
  const recipes = makeRecipes({ [RECIPE_ID]: 'Cloro · Concentrado', [OTHER_RECIPE_ID]: 'Jabón líquido' })
  const companyName = vi.fn<CompanyNameLookup>(async (companyId) =>
    companyId === COMPANY_ID ? (options.companyName === undefined ? 'Agua Pura' : options.companyName) : null,
  )
  const keys = makeVariableKeyRepository(options.variables ?? [storedVariableKey()])
  const getContext = createGetWhatsappChatContext({
    connections: repo.connections,
    conversations: conv.conversations,
    customers: catalog.customers,
    customerOrders: directory.customerOrders,
    deliveryProgress: delivery.deliveryProgress,
    presentations: presentations.presentations,
    recipes: recipes.recipes,
    companyName,
    variableKeys: keys.variableKeys,
  })
  const readSpies = [
    repo.findLive,
    repo.findLiveById,
    ...conv.allSpies(),
    catalog.findAliveRefById,
    catalog.findRefsIncludingDeleted,
    directory.listAliveOfCustomer,
    delivery.listDeliveryProgressByIdsIncludingDeleted,
    presentations.findRefs,
    recipes.findRefsIncludingDeleted,
    companyName,
    keys.listAll,
  ]
  const writeSpies = [
    repo.create,
    repo.update,
    repo.recordWebhookHandshake,
    conv.advanceLastRead,
    keys.create,
    keys.update,
    keys.delete,
  ]
  return { getContext, repo, conv, catalog, directory, delivery, presentations, recipes, companyName, keys, readSpies, writeSpies }
}

const BY_CONTACT = { target: { contactId: CONTACT_ID } }
const BY_CUSTOMER = { target: { customerId: CUSTOMER_ID } }

describe('getWhatsappChatContext', () => {
  describe('permiso y entrada', () => {
    it.each<[string, Actor | null]>([
      ['sin whatsapp.consultar', reader({ permissions: ['whatsapp.enviar', 'pedidos.ver'] })],
      ['sin empresa', reader({ companyId: '' })],
      ['sin actor', null],
    ])('R50: %s responde unauthorized sin validar ni tocar un puerto', async (_, actor) => {
      const ctx = setup()

      await expect(ctx.getContext({ target: 'x' }, actor)).rejects.toBeInstanceOf(UnauthorizedError)
      for (const spy of [...ctx.readSpies, ...ctx.writeSpies]) expect(spy).not.toHaveBeenCalled()
    })

    it.each<[string, unknown]>([
      ['contacto que no es uuid', { target: { contactId: 'no-uuid' } }],
      ['los dos destinos', { target: { contactId: CONTACT_ID, customerId: CUSTOMER_ID } }],
      ['sin destino', {}],
      ['orderId que no es uuid', { ...BY_CUSTOMER, orderId: '42' }],
      ['campo de más', { ...BY_CUSTOMER, extra: true }],
    ])('R50: %s responde invalid_input sin tocar un puerto', async (_, input) => {
      const ctx = setup()

      await expect(ctx.getContext(input, reader())).rejects.toBeInstanceOf(ValidationError)
      for (const spy of [...ctx.readSpies, ...ctx.writeSpies]) expect(spy).not.toHaveBeenCalled()
    })
  })

  describe('existencia', () => {
    it.each<[string, Parameters<typeof setup>[0]]>([
      ['inexistente', { contacts: [] }],
      ['de otra empresa', { contacts: [conversationContact({ companyId: OTHER_COMPANY_ID })] }],
      ['de otra conexión', { contacts: [conversationContact({ connectionId: NEW_CONNECTION_ID })] }],
      ['sin cliente', { contacts: [conversationContact({ customerId: null })] }],
      ['con el cliente dado de baja', { refs: { [COMPANY_ID]: [customerRef({ isDeleted: true })] } }],
      ['sin conexión viva', { connected: false }],
    ])('R50, R57: un contacto %s da whatsapp_contact_not_found sin leer pedidos', async (_, options) => {
      const ctx = setup(options)

      await expect(ctx.getContext(BY_CONTACT, reader())).rejects.toBeInstanceOf(WhatsappContactNotFoundError)
      expect(ctx.directory.listAliveOfCustomer).not.toHaveBeenCalled()
    })

    it.each<[string, Parameters<typeof setup>[0]]>([
      ['inexistente', { refs: { [COMPANY_ID]: [] } }],
      ['dado de baja', { refs: { [COMPANY_ID]: [customerRef({ isDeleted: true })] } }],
      ['de otra empresa', { refs: { [OTHER_COMPANY_ID]: [customerRef()] } }],
    ])('R50, R57: un cliente %s da customer_not_found sin leer pedidos', async (_, options) => {
      const ctx = setup(options)

      await expect(ctx.getContext(BY_CUSTOMER, reader())).rejects.toBeInstanceOf(LinkedCustomerNotFoundError)
      expect(ctx.directory.listAliveOfCustomer).not.toHaveBeenCalled()
    })

    it('R50: por cliente no mira la conexión y responde aunque no haya WhatsApp conectado', async () => {
      const ctx = setup({ connected: false })

      const context = await ctx.getContext(BY_CUSTOMER, reader())

      expect(ctx.repo.findLive).not.toHaveBeenCalled()
      expect(ctx.conv.findLatestContactOfCustomer).not.toHaveBeenCalled()
      expect(context.customer).toEqual({ id: CUSTOMER_ID, name: 'Laura Gómez' })
      expect(context.orders).toHaveLength(1)
    })

    it('R50: por contacto toma el cliente vinculado al contacto', async () => {
      const ctx = setup()

      const context = await ctx.getContext(BY_CONTACT, reader())

      expect(ctx.conv.findContact).toHaveBeenCalledWith(CONTACT_ID, expect.any(String), { companyId: COMPANY_ID })
      expect(context.customer).toEqual({ id: CUSTOMER_ID, name: 'Laura Gómez' })
    })
  })

  describe('pedidos', () => {
    it('R51, R52, R53: devuelve cada pedido abierto con sus líneas, envases como Pedidos y total nulo', async () => {
      const ctx = setup({
        progress: {
          [orderId(1)]: [
            progressLine({ presentationId: BIDON, packages: 10, deliveredPackages: 6 }),
            progressLine({ presentationId: GARRAFA, packages: 5, packedPackages: 7, packedSurplusPackages: 2, deliveredPackages: 8 }),
          ],
        },
      })

      const context = await ctx.getContext(BY_CUSTOMER, reader())

      expect(context.orders).toEqual([
        {
          id: orderId(1),
          number: '2026-0000101',
          status: 'EN_CURSO',
          requestedAt: '2026-10-11T15:00:00.000Z',
          total: null,
          productName: 'Cloro · Concentrado',
          lines: [
            { presentationId: BIDON, presentationName: 'Bidón 20 L', ordered: 10, delivered: 6, pending: 4 },
            { presentationId: GARRAFA, presentationName: 'Garrafa 5 L', ordered: 5, delivered: 8, pending: 0 },
          ],
        },
      ])
      expect(Object.keys(context.orders[0])).not.toContain('deliveredAt')
    })

    it('R51: un pedido sin progreso sale sin líneas y uno con presentación o receta desconocida sale con nombre nulo', async () => {
      const unknownPresentation = '44444444-4444-4444-8444-444444444444'
      const unknownRecipe = '0a1b2c3d-4e5f-4a6b-8c7d-000000000000'
      const ctx = setup({
        orders: [storedOrder(1), storedOrder(2, { recipeId: unknownRecipe })],
        progress: { [orderId(2)]: [progressLine({ presentationId: unknownPresentation })] },
      })

      const context = await ctx.getContext(BY_CUSTOMER, reader())

      expect(context.orders.map((order) => [order.id, order.productName, order.lines])).toEqual([
        [orderId(2), null, [{ presentationId: unknownPresentation, presentationName: null, ordered: 10, delivered: 0, pending: 10 }]],
        [orderId(1), 'Cloro · Concentrado', []],
      ])
    })

    it('R54: el directorio se pide con los estados no en curso excluidos, el límite de 20 y la empresa del actor', async () => {
      const ctx = setup()

      await ctx.getContext(BY_CUSTOMER, reader())

      expect(ctx.directory.listAliveOfCustomer).toHaveBeenCalledTimes(1)
      expect(ctx.directory.listAliveOfCustomer).toHaveBeenCalledWith(
        COMPANY_ID,
        CUSTOMER_ID,
        ORDER_STATUSES_NOT_IN_PROGRESS,
        CUSTOMER_ORDERS_LIMIT,
      )
      expect(CUSTOMER_ORDERS_LIMIT).toBe(20)
    })

    it('R51, R54: solo salen los abiertos del cliente, el más reciente primero, sin entregados, cancelados, de baja ni ajenos', async () => {
      const ctx = setup({
        orders: [
          storedOrder(1),
          storedOrder(2, { status: 'PENDIENTE' }),
          storedOrder(3, { status: 'ENTREGADO' }),
          storedOrder(4, { status: 'CANCELADO' }),
          storedOrder(5, { deleted: true }),
          storedOrder(6, { customerId: OTHER_CUSTOMER_ID }),
          storedOrder(7, { companyId: OTHER_COMPANY_ID }),
        ],
        progress: {},
      })

      const context = await ctx.getContext(BY_CUSTOMER, reader())

      expect(context.orders.map((order) => order.id)).toEqual([orderId(2), orderId(1)])
      expect(context.selectedOrderId).toBe(orderId(2))
    })

    it('R54: tres lecturas por lote para todos los pedidos, ninguna por pedido', async () => {
      const ctx = setup({
        orders: [storedOrder(1), storedOrder(2, { recipeId: OTHER_RECIPE_ID }), storedOrder(3)],
        progress: {
          [orderId(1)]: [progressLine({ presentationId: BIDON })],
          [orderId(2)]: [progressLine({ presentationId: BIDON }), progressLine({ presentationId: GARRAFA })],
          [orderId(3)]: [progressLine({ presentationId: GARRAFA })],
        },
      })

      const context = await ctx.getContext(BY_CUSTOMER, reader())

      expect(context.orders).toHaveLength(3)
      expect(ctx.delivery.listDeliveryProgressByIdsIncludingDeleted).toHaveBeenCalledTimes(1)
      expect(ctx.delivery.listDeliveryProgressByIdsIncludingDeleted).toHaveBeenCalledWith(COMPANY_ID, [
        orderId(3),
        orderId(2),
        orderId(1),
      ])
      expect(ctx.presentations.findRefs).toHaveBeenCalledTimes(1)
      expect(ctx.presentations.findRefs).toHaveBeenCalledWith([GARRAFA, BIDON], COMPANY_ID)
      expect(ctx.recipes.findRefsIncludingDeleted).toHaveBeenCalledTimes(1)
      expect(ctx.recipes.findRefsIncludingDeleted).toHaveBeenCalledWith([RECIPE_ID, OTHER_RECIPE_ID], COMPANY_ID)
    })

    it('R54: sin pedidos abiertos no lee progreso, presentaciones ni recetas', async () => {
      const ctx = setup({ orders: [storedOrder(1, { status: 'ENTREGADO' })] })

      const context = await ctx.getContext(BY_CUSTOMER, reader())

      expect(context.orders).toEqual([])
      expect(context.selectedOrderId).toBeNull()
      expect(ctx.delivery.listDeliveryProgressByIdsIncludingDeleted).not.toHaveBeenCalled()
      expect(ctx.presentations.findRefs).not.toHaveBeenCalled()
      expect(ctx.recipes.findRefsIncludingDeleted).not.toHaveBeenCalled()
    })
  })

  describe('pedido elegido', () => {
    const THREE = [storedOrder(1), storedOrder(2), storedOrder(3)]

    it('R54: sin orderId el elegido es el abierto más reciente', async () => {
      const ctx = setup({ orders: THREE })

      const context = await ctx.getContext(BY_CUSTOMER, reader())

      expect(context.selectedOrderId).toBe(orderId(3))
      expect(context.values['pedido.numero']).toBe('2026-0000103')
    })

    it('R54: con orderId de un pedido abierto del cliente, ese es el elegido', async () => {
      const ctx = setup({ orders: THREE })

      const context = await ctx.getContext({ ...BY_CONTACT, orderId: orderId(1) }, reader())

      expect(context.selectedOrderId).toBe(orderId(1))
      expect(context.values['pedido.numero']).toBe('2026-0000101')
      expect(context.orders).toHaveLength(3)
    })

    it.each<[string, readonly StoredOrder[], string]>([
      ['inexistente', [storedOrder(1)], UNKNOWN_ORDER_ID],
      ['de otro cliente', [storedOrder(1), storedOrder(2, { customerId: OTHER_CUSTOMER_ID })], orderId(2)],
      ['de otra empresa', [storedOrder(1), storedOrder(2, { companyId: OTHER_COMPANY_ID })], orderId(2)],
      ['dado de baja', [storedOrder(1), storedOrder(2, { deleted: true })], orderId(2)],
      ['entregado', [storedOrder(1), storedOrder(2, { status: 'ENTREGADO' })], orderId(2)],
      ['cancelado', [storedOrder(1), storedOrder(2, { status: 'CANCELADO' })], orderId(2)],
      [
        'fuera de los 20',
        Array.from({ length: 21 }, (_, i) => storedOrder(i + 1)),
        orderId(1),
      ],
      ['sin ningún pedido abierto', [], UNKNOWN_ORDER_ID],
    ])('R54, R57: orderId %s da order_not_found sin leer el detalle', async (_, orders, id) => {
      const ctx = setup({ orders, progress: {} })

      await expect(ctx.getContext({ ...BY_CUSTOMER, orderId: id }, reader())).rejects.toBeInstanceOf(
        WhatsappOrderNotFoundError,
      )
      expect(ctx.delivery.listDeliveryProgressByIdsIncludingDeleted).not.toHaveBeenCalled()
      expect(ctx.companyName).not.toHaveBeenCalled()
      expect(ctx.keys.listAll).not.toHaveBeenCalled()
    })
  })

  describe('valores', () => {
    it('R55, R56: trae las siete constantes del pedido elegido y cada variable propia por su clave', async () => {
      const ctx = setup({
        progress: {
          [orderId(1)]: [
            progressLine({ presentationId: BIDON, packages: 10, deliveredPackages: 6 }),
            progressLine({ presentationId: GARRAFA, packages: 5, deliveredPackages: 4 }),
          ],
        },
        variables: [
          storedVariableKey(),
          storedVariableKey({ id: '00000000-0000-4000-8000-000000000202', key: 'horario', value: 'L-V 9 a 18' }),
        ],
      })

      const context = await ctx.getContext(BY_CUSTOMER, reader())

      expect(context.values).toEqual({
        'cliente.nombre': 'Laura Gómez',
        'empresa.nombre': 'Agua Pura',
        'pedido.numero': '2026-0000101',
        'pedido.estado': 'en preparación',
        'pedido.fecha_solicitud': '11/10/2026',
        'pedido.total': null,
        'pedido.detalle': '10 × Bidón 20 L (entregado 6, faltan 4); 5 × Garrafa 5 L (entregado 4, falta 1)',
        cuenta_numero: '123-456',
        horario: 'L-V 9 a 18',
      })
      expect(ctx.companyName).toHaveBeenCalledWith(COMPANY_ID)
      expect(ctx.keys.listAll).toHaveBeenCalledWith({ companyId: COMPANY_ID })
    })

    it('R54, R56: sin pedidos abiertos el elegido es nulo y todas las pedido.* son nulas, el resto sigue', async () => {
      const ctx = setup({ orders: [] })

      const context = await ctx.getContext(BY_CUSTOMER, reader())

      expect(context.selectedOrderId).toBeNull()
      for (const key of WHATSAPP_SYSTEM_CONSTANT_KEYS.filter((k) => k.startsWith('pedido.'))) {
        expect(context.values).toHaveProperty([key], null)
      }
      expect(context.values['cliente.nombre']).toBe('Laura Gómez')
      expect(context.values['empresa.nombre']).toBe('Agua Pura')
    })

    it('R55, R56: un valor que no se resuelve sale nulo, nunca omitido ni cadena vacía', async () => {
      const ctx = setup({ companyName: null, variables: [storedVariableKey({ value: '' })] })

      const context = await ctx.getContext(BY_CUSTOMER, reader())

      for (const key of WHATSAPP_SYSTEM_CONSTANT_KEYS) expect(Object.keys(context.values)).toContain(key)
      expect(context.values['empresa.nombre']).toBeNull()
      expect(context.values.cuenta_numero).toBeNull()
      expect(Object.values(context.values)).not.toContain('')
      for (const value of Object.values(context.values)) expect(value === null || typeof value === 'string').toBe(true)
    })
  })

  it('R57: pedir el contexto no llama a ningún método que escriba ni mueve la marca de lectura', async () => {
    const ctx = setup()
    const before = ctx.conv.contact(CONTACT_ID)

    await ctx.getContext({ ...BY_CONTACT, orderId: orderId(1) }, reader())
    await ctx.getContext(BY_CUSTOMER, reader())

    for (const spy of ctx.writeSpies) expect(spy).not.toHaveBeenCalled()
    expect(ctx.conv.contact(CONTACT_ID)).toEqual(before)
  })

  it('R63: con whatsapp.consultar y ningún permiso de Pedidos recibe los pedidos y los valores pedido.*', async () => {
    const actor = reader({ permissions: [WHATSAPP_READ_PERMISSION] })
    expect(actor.permissions.some((permission) => permission.startsWith('pedidos.'))).toBe(false)
    const ctx = setup()

    const context = await ctx.getContext(BY_CONTACT, actor)

    expect(context.orders).toHaveLength(1)
    expect(context.selectedOrderId).toBe(orderId(1))
    expect(context.values['pedido.numero']).toBe('2026-0000101')
    expect(context.values['pedido.detalle']).toBe('10 × Bidón 20 L (entregado 6, faltan 4)')
  })
})
