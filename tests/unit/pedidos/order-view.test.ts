// T6 — Los tipos de salida y el puerto de `pedidos` (QC-34 R24, R26, R40, R46, R47).
//
// Esto es un TEST DE TIPOS: lo que se afirma no lo comprueba `expect`, lo comprueba el
// compilador. Cada `@ts-expect-error` es una asercion en positivo -si la linea de debajo
// dejara de ser un error, el `typecheck` FALLA por el `@ts-expect-error` no utilizado-, que es
// lo que convierte «no se puede escribir CANCELADO desde la edicion» en algo verificable y no
// en una promesa del comentario.
//
// Es la PRIMERA de las cuatro capas de `design.md > 8`. Las otras tres -`zod`, la tabla de
// transiciones y el `CHECK` de la base- tienen sus propios tests.

import { describe, expect, it } from 'vitest'

import type { AssignedOrderSummary } from '@/lib/modules/pedidos/domain/order-catalog'
import type {
  NewOrder,
  OrderLineRow,
  OrderLineView,
  OrderRow,
  OrderSummary,
  OrderView,
} from '@/lib/modules/pedidos/domain/order-view'
import { ORDER_QUERYABLE } from '@/lib/modules/pedidos/domain/order-queryable'
import type { OrderRepository } from '@/lib/modules/pedidos/ports/order-repository'
import type { OrderLineWrite } from '@/lib/modules/pedidos/ports/order-write-repository'

const NEW_ORDER: NewOrder = {
  priority: 'ALTA',
  status: 'EN_CURSO',
  customerId: null,
}

const LINE_WRITE: OrderLineWrite = {
  recipeId: '11111111-1111-4111-8111-111111111111',
  originalRecipeId: '11111111-1111-4111-8111-111111111111',
  quantity: '12.5000',
  unitId: '33333333-3333-4333-8333-333333333333',
  salePrice: null,
  presentationLines: [],
}

/** `true` si el tipo declara esa clave. Se evalua en COMPILACION; el `expect` de abajo solo
 *  hace visible el resultado en el informe del test. */
type Declara<T, K extends string> = K extends keyof T ? true : false

describe('pedidos — NewOrder no puede expresar una cancelacion (R24, R26)', () => {
  it('acepta los tres estados editables', () => {
    const pendiente: NewOrder = { ...NEW_ORDER, status: 'PENDIENTE' }
    const enCurso: NewOrder = { ...NEW_ORDER, status: 'EN_CURSO' }
    const entregado: NewOrder = { ...NEW_ORDER, status: 'ENTREGADO' }
    expect([pendiente.status, enCurso.status, entregado.status]).toEqual([
      'PENDIENTE',
      'EN_CURSO',
      'ENTREGADO',
    ])
  })

  it('NO acepta el estado CANCELADO: el typecheck lo rechaza', () => {
    // `status` es `EditableOrderStatus`, no `OrderStatus`. Ni `create` ni `updateAlive` pueden
    // formular una cancelacion, y el unico camino es `cancelAlive` (el unico con `reason`).
    // @ts-expect-error CANCELADO no pertenece a EditableOrderStatus (R24)
    const cancelado: NewOrder = { ...NEW_ORDER, status: 'CANCELADO' }
    expect(cancelado.status).toBe('CANCELADO')
  })

  it('NO declara cancellationReason: el motivo no viaja por la edicion', () => {
    // @ts-expect-error NewOrder no tiene cancellationReason (R24, R26)
    const conMotivo: NewOrder = { ...NEW_ORDER, cancellationReason: 'me arrepenti' }
    expect(conMotivo).toBeTruthy()

    const declara: Declara<NewOrder, 'cancellationReason'> = false
    expect(declara).toBe(false)
  })

  it('tampoco declara el correlativo, las fechas ni los autores: los pone el sistema', () => {
    // R6, R9, R11: el estado de alta, el numero y los dos autores no salen de la entrada.
    const correlativo: Declara<NewOrder, 'orderYear'> = false
    const autor: Declara<NewOrder, 'createdBy'> = false
    const fecha: Declara<NewOrder, 'createdAt'> = false
    expect([correlativo, autor, fecha]).toEqual([false, false, false])
  })
})

describe('pedidos — la salida de las consultas (R40, R46, R47)', () => {
  it('OrderView NO tiene campo total, ni subtotal, ni nada calculado', () => {
    // R47 y pregunta abierta 3: el total no se persiste (QC-33 R10) y esta salida tampoco lo
    // calcula. Devolverlo obligaria a multiplicar dos decimales de 14 digitos, que no se puede
    // hacer con `number` y hoy no tiene aritmetica aprobada (`design.md > 13`).
    const total: Declara<OrderView, 'total'> = false
    const subtotal: Declara<OrderView, 'subtotal'> = false
    const enLaFila: Declara<OrderSummary, 'total'> = false
    expect([total, subtotal, enLaFila]).toEqual([false, false, false])
  })

  it('OrderView y OrderRow NO devuelven deletedAt', () => {
    // R40: ninguna consulta devuelve borrados, asi que el campo seria siempre `null` y solo
    // invitaria a filtrar en memoria lo que ya filtro el puerto.
    const enLaVista: Declara<OrderView, 'deletedAt'> = false
    const enLaFila: Declara<OrderRow, 'deletedAt'> = false
    expect([enLaVista, enLaFila]).toEqual([false, false])
  })

  it('los dos autores son identificadores, no nombres', () => {
    // R46: resolver el nombre del autor es de QC-35; este modulo no consulta el modelo `User`.
    const nombreDeAutor: Declara<OrderView, 'createdByName'> = false
    expect(nombreDeAutor).toBe(false)

    const autor: OrderView['createdBy'] = null
    expect(autor).toBeNull()
  })

  it('OrderRow NO trae los nombres de receta y unidad: los resuelve el caso de uso', () => {
    // R43, R45: los nombres llegan por los contratos publicos de `recetas` y `unidades`, con
    // UNA consulta a cada uno por pagina. Si el puerto los trajera, saldrian de `orders`.
    const nombreDeReceta: Declara<OrderRow, 'recipeName'> = false
    const nombreDeUnidad: Declara<OrderRow, 'unitName'> = false
    expect([nombreDeReceta, nombreDeUnidad]).toEqual([false, false])

    // Y en cada receta de la vista SI esta, anulable: la fila sigue apareciendo aunque el id no
    // vuelva. El pedido no lo copia (QT-314 R24).
    const enLaLinea: Declara<OrderLineView, 'recipeName'> = true
    const enElPedido: Declara<OrderView, 'recipeName'> = false
    expect([enLaLinea, enElPedido]).toEqual([true, false])
  })

  it('los filtros del listado son estado, prioridad, fecha y cliente, y la busqueda ya se abrio (R11, R23, R24, R26)', () => {
    // R38/R39 heredados, dichos sobre la forma NUEVA. QC-57 (R25) borro `OrderFilters`: estado
    // y prioridad dejaron de ser parametros propios del listado y son filtros `select` del
    // contrato generico. Lo que aquel tipo garantizaba lo garantiza ahora la lista blanca, y se
    // afirma sobre ella -no sobre un tipo que ya no existe-.
    expect(Object.keys(ORDER_QUERYABLE.filterable).sort()).toEqual([
      'createdAt',
      'customerId',
      'customerPresence',
      'priority',
      'status',
    ])
    expect(ORDER_QUERYABLE.filterable.status).toBe('select')
    expect(ORDER_QUERYABLE.filterable.priority).toBe('select')
    // QC-156: el cliente filtra por id y «sin cliente» va en su propio campo; no ordena.
    expect(ORDER_QUERYABLE.filterable.customerId).toBe('select')
    expect(ORDER_QUERYABLE.filterable.customerPresence).toBe('select')
    expect(ORDER_QUERYABLE.sortable).toEqual(['orderNumber', 'priority', 'status', 'createdAt', 'quantity'])

    // Nota fechada 2026-09-18: `orders` no tiene columna `name` propia, pero desde QC-68 la
    // busqueda casa por el nombre de la receta del pedido, resuelta antes de llegar al puerto.
    // Ya no es cierto que sea la unica de las siete que no busca.
    expect(ORDER_QUERYABLE.searchable).toBe(true)

    // Y no hay filtro por el numero correlativo (R39): no esta declarado.
    expect(Object.keys(ORDER_QUERYABLE.filterable)).not.toContain('orderNumber')
  })
})

describe('pedidos — el coste de ingredientes en la salida', () => {
  it('la salida del pedido no declara precio por unidad ni total (R1)', () => {
    // El precio del pedido entero SI existe (`salePrice`, abajo); lo que sigue sin
    // existir es un precio por unidad, un `price` generico o un total derivado.
    const precio: Declara<OrderView, 'price'> = false
    const precioUnitario: Declara<OrderView, 'unitPrice'> = false
    const total: Declara<OrderView, 'total'> = false
    expect([precio, precioUnitario, total]).toEqual([false, false, false])
  })

  it('QT-313 R1, QT-314 R24: el coste va en la linea y en su vista, no en la fila ni en la vista del pedido', () => {
    const enLaFila: Declara<OrderRow, 'ingredientsCost'> = false
    const enLaLinea: Declara<OrderLineRow, 'ingredientsCost'> = true
    const enLaVista: Declara<OrderLineView, 'ingredientsCost'> = true
    const enElPedido: Declara<OrderView, 'ingredientsCost'> = false
    expect([enLaFila, enLaLinea, enLaVista, enElPedido]).toEqual([false, true, true, false])
  })

  it('QT-313 R1, QT-314 R24: la parte de envases del importe va en la linea y en su vista, no en el pedido', () => {
    const enLaFila: Declara<OrderRow, 'packagingCost'> = false
    const enLaLinea: Declara<OrderLineRow, 'packagingCost'> = true
    const enLaVista: Declara<OrderLineView, 'packagingCost'> = true
    const enElPedido: Declara<OrderView, 'packagingCost'> = false
    const sinCoste: OrderLineView['packagingCost'] = null
    expect([enLaFila, enLaLinea, enLaVista, enElPedido, sinCoste]).toEqual([false, true, true, false, null])
  })

  it('ingredientsCost en null no se vuelve "0.0000"', () => {
    const sinCoste: OrderLineView['ingredientsCost'] = null
    expect(sinCoste).toBeNull()
    expect(sinCoste).not.toBe('0.0000')
  })

  it('la salida no tiene ningun campo de moneda', () => {
    const moneda: Declara<OrderView, 'currency'> = false
    const codigoDeMoneda: Declara<OrderView, 'currencyCode'> = false
    expect([moneda, codigoDeMoneda]).toEqual([false, false])
  })
})

describe('QC-307 — el precio de venta del pedido entero en el contrato', () => {
  it('R1, R2, QT-313 R1, QT-314 R24: la escritura, la fila y la vista de la linea declaran salePrice como cadena o null; el pedido no', () => {
    const enLaEscritura: Declara<OrderLineWrite, 'salePrice'> = true
    const enLaLinea: Declara<OrderLineRow, 'salePrice'> = true
    const enLaVistaDeLinea: Declara<OrderLineView, 'salePrice'> = true
    const enElAlta: Declara<NewOrder, 'salePrice'> = false
    const enLaFila: Declara<OrderRow, 'salePrice'> = false
    const enLaVista: Declara<OrderView, 'salePrice'> = false
    const enElListado: Declara<OrderSummary, 'salePrice'> = false
    expect([enLaEscritura, enLaLinea, enLaVistaDeLinea, enElAlta, enLaFila, enLaVista, enElListado]).toEqual([
      true,
      true,
      true,
      false,
      false,
      false,
      false,
    ])

    // Cadena decimal, nunca `number`.
    const conPrecio: OrderLineWrite = { ...LINE_WRITE, salePrice: '1250.5000' }
    const sinPrecio: OrderLineView['salePrice'] = null
    // @ts-expect-error salePrice no admite number
    const comoNumero: OrderLineWrite = { ...LINE_WRITE, salePrice: 1250.5 }
    expect([conPrecio.salePrice, sinPrecio, comoNumero.salePrice]).toEqual(['1250.5000', null, 1250.5])
  })

  it('R1, R2: salePrice es obligatorio en la escritura de la linea, no opcional', () => {
    const sinLaClave: Omit<OrderLineWrite, 'salePrice'> = {
      recipeId: LINE_WRITE.recipeId,
      originalRecipeId: LINE_WRITE.originalRecipeId,
      quantity: LINE_WRITE.quantity,
      unitId: LINE_WRITE.unitId,
      presentationLines: LINE_WRITE.presentationLines,
    }
    // @ts-expect-error OrderLineWrite exige salePrice: la ausencia se escribe `null`, no se omite
    const incompleto: OrderLineWrite = sinLaClave
    expect(incompleto).not.toHaveProperty('salePrice')
  })

  it('R17: AssignedOrderSummary, lo que recibe asignaciones, NO declara salePrice', () => {
    const enLoAsignado: Declara<AssignedOrderSummary, 'salePrice'> = false
    expect(enLoAsignado).toBe(false)
  })

  it('R23: OrderView no declara nada derivado del precio: ni margin ni profit', () => {
    const margen: Declara<OrderView, 'margin'> = false
    const beneficio: Declara<OrderView, 'profit'> = false
    expect([margen, beneficio]).toEqual([false, false])
  })
})

describe('pedidos — el puerto declara sus metodos de LECTURA: los dos de design.md > 5.3 y findBlockedIds', () => {
  it('un doble que implementa la interfaz completa compila', () => {
    // No se ejecuta ninguna operacion: lo que se comprueba es la FORMA del puerto. Si algun dia
    // se le anadiera un tercer metodo, este doble dejaria de compilar y habria que decidirlo.
    // La escritura salio entera hacia `OrderWriteRepository`, dentro de la transaccion
    // compartida con `inventario`; este puerto ya solo lee.
    const doble: OrderRepository = {
      findAliveById: async () => null,
      // QT-313: las lineas del pedido, por `position`.
      findAliveLines: async () => [],
      findAliveLinesByOrderIds: async () => [],
      // `listAlive` devuelve una `Page` ya armada, no `{ rows, total }`: la firma se corrigio
      // el 2026-09-04 (nota al final de `design.md > 7.4`, aprobada por el leader) para que el
      // caso de uso no tenga que calcular el `offset`, que es la reimplementacion que R37
      // prohibe. Quien pagina es el adaptador driven con `lib/shared/pagination`.
      listAlive: async () => ({ items: [], total: 0, page: 1, pageSize: 10, totalPages: 0 }),
      // QC-138: los bloqueados de la empresa, para la revision que los desbloquea.
      findBlockedIds: async () => [],
    }
    expect(Object.keys(doble).sort()).toEqual(['findAliveById', 'findAliveLines', 'findAliveLinesByOrderIds', 'findBlockedIds', 'listAlive'])
  })

  it('no existe ningun metodo de restaurar ni de listar borrados', () => {
    // R31: lo que no se puede expresar no se puede hacer por descuido.
    const restaurar: Declara<OrderRepository, 'restore'> = false
    const listarBorrados: Declara<OrderRepository, 'listDeleted'> = false
    expect([restaurar, listarBorrados]).toEqual([false, false])
  })
})

describe('QT-314 — la vista del pedido no copia la primera receta', () => {
  it('R24: OrderView y OrderSummary no declaran ninguno de los campos planos de la primera receta', () => {
    const enLaVista = [
      false satisfies Declara<OrderView, 'recipeId'>,
      false satisfies Declara<OrderView, 'recipeName'>,
      false satisfies Declara<OrderView, 'recipeVersion'>,
      false satisfies Declara<OrderView, 'recipeImageUrl'>,
      false satisfies Declara<OrderView, 'quantity'>,
      false satisfies Declara<OrderView, 'unitId'>,
      false satisfies Declara<OrderView, 'unitLabel'>,
      false satisfies Declara<OrderView, 'presentationLines'>,
      false satisfies Declara<OrderView, 'salePrice'>,
      false satisfies Declara<OrderView, 'ingredientsCost'>,
      false satisfies Declara<OrderView, 'packagingCost'>,
      false satisfies Declara<OrderView, 'actualCost'>,
    ]
    const enElListado = [
      false satisfies Declara<OrderSummary, 'recipeName'>,
      false satisfies Declara<OrderSummary, 'quantity'>,
      false satisfies Declara<OrderSummary, 'presentationLines'>,
    ]
    expect([...enLaVista, ...enElListado].every((declara) => declara === false)).toBe(true)

    // El motivo de cancelacion del pedido entero se queda.
    const motivo: Declara<OrderView, 'cancellationReason'> = true
    expect(motivo).toBe(true)
  })
})
