'use server';

import { identity, observabilidad, pedidos } from '@/lib/composition';
import {
  createErrorStateTranslator,
  type ErrorCode,
  type ErrorState,
} from '@/lib/modules/errores';
import {
  IncompatibleUnitsError,
  InsufficientMaterialError,
  OrderDistributionExceedsQuantityError,
  OrderNotFoundError,
  OrderPresentationLineNotEditableError,
  OrderWithoutUnitError,
  OrderUnitNotConvertibleError,
  OrderWouldBlockError,
  PedidosError,
  PresentationNotFoundError,
  PresentationWithoutContentError,
  ProductNotFoundError,
  UnitNotFoundError,
  ValidationError,
  linePositionsOf,
  requirePermission,
  updateOrderDistributionSchema,
  type Actor,
  type DeliverOrderResult,
  type DeliveryAllocation,
  type OrderCostQuote,
  type OrderCustomer,
  type OrderCustomerSearchPurpose,
  type OrderDeliveryView,
  type OrderDeliveryHistoryView,
  type OrderPresentationAvailabilityNext,
  type OrderSummary,
  type OrderView,
  type Page,
  type VoidDeliveryResult,
  type DeliverDirectResult,
  type DirectDeliveryView,
  type DirectDeliveryVoidView,
  type VoidDirectDeliveryResult,
} from '@/lib/modules/pedidos';
import { runInRequestScope } from '@/lib/shared/request-scope';

// Solo el TIPO, del contrato publico de `inventario`: la arista `pedidos -> inventario` ya
// existe.
import type { OrderCoverage } from '@/lib/modules/inventario';

/**
 * Server Actions del pedido (T15, R5, R54, R56, `design.md > 9`). Copia en forma de
 * `lib/modules/proveedores/adapters/driving/supplier-actions.ts`, que a su vez copia la de
 * `inventario`: la action se prueba contra dobles y nunca contra la sesion real.
 *
 * FORMA DE ENTRADA, decidida por operacion (decision cerrada 19, R54):
 * - `create`/`update` reciben el pedido entero como `input: unknown`: varias recetas, cada una
 *   con su reparto, son una estructura anidada que el panel arma y esta action entrega tal cual.
 *   `cancel`/`delete` salen de un dialogo y reciben `FormData`. Los esquemas viven en el CASO DE
 *   USO y esta action NO los repite.
 * - `get`/`list` son consultas que invoca un Server Component con datos que YA tiene tipados
 *   (un `id` de la URL, o una consulta de lista que quien llama ya construyo): no hay
 *   formulario del que leer. `listOrdersAction` recibe `query: unknown` porque quien valida
 *   su forma es `createListQuerySchema()`, dentro del caso de uso (QC-57 R30).
 *   `listOrdersSchema` YA NO EXISTE: el estado y la prioridad dejaron de ser parametros
 *   propios y entran como filtros `select` del contrato generico (QC-57 R25).
 *
 * LA CANTIDAD NO SE CONVIERTE AQUI: `quantity` viaja como CADENA decimal
 * hasta el adaptador driven (`design.md > 7.1`). Pasarlos por `Number` seria el redondeo
 * binario que `docs/architecture.md > Anti-patrones` prohibe, y ademas destruiria la
 * validacion de forma que hace `zod` sobre el texto.
 *
 * EL ACTOR sale de `identity.getSessionUser()` via `@/lib/composition` (R5, decision cerrada
 * 18): ningun caso de uso lee sesion, cookie ni cabecera por su cuenta. Sin cookie de sesion
 * valida `getSessionUser` devuelve `null`, y entonces el actor que llega al caso de uso es
 * `null`: el caso de uso lo rechaza igual que un actor sin el permiso, falla cerrado.
 *
 * LA ACTION NO DECIDE NADA (R5): no repite `requirePermission` -ya es la primera linea de los seis
 * casos de uso-, no comprueba estados, no evalua transiciones y no aplica ninguna otra regla.
 * Solo traduce `FormData`/argumentos a la entrada del caso de uso, y el resultado o el error
 * a un estado serializable.
 *
 * ERRORES (R56, y QC-70 R10-R14): las clases de `PedidosError` se traducen a
 * `{ status: 'error', code, message }` con el `code` ESTABLE de la clase -NUNCA el texto del
 * mensaje-, y el mensaje sale del CATALOGO. La traduccion no se escribe aqui: es
 * `createErrorStateTranslator`, la unica implementacion del repositorio.
 *
 * QC-70 CAMBIA el trato del error AJENO: antes se RELANZABA -y reventaba la pantalla con la
 * pagina de error del framework, a veces con un mensaje de Prisma dentro-. Ahora se devuelve
 * como `unexpected` con mensaje neutro y el error original se entrega al registro del servidor,
 * que es el unico sitio donde ese detalle aparece (R12, R13, R14). Sigue sin haber ningun
 * `catch` vacio (`docs/conventions.md`): el error no se traga, se registra.
 *
 * SIN `revalidatePath` y SIN ningun route handler (`design.md > 9`, R54): esta ficha no crea
 * ninguna pantalla (R57), asi que no hay ruta que revalidar y adivinar la de QC-35 seria
 * inventarla. QC-35 decide que revalida. Tampoco hay `fetch` a ninguna ruta propia.
 */

/**
 * El error del alta y de la edicion: el estado del catalogo y, ademas, las posiciones en `lines` de
 * la entrada de las recetas que fallaron (vacio si el error no es de receta). Se extiende aqui el
 * estado ya traducido, para que `ErrorState` siga siendo el mismo para todos los modulos.
 */
export type OrderLinesErrorState = ErrorState & { readonly linePositions: readonly number[] };

/** Estado del alta: unico caso que devuelve datos ademas de exito/fracaso (el pedido creado
 *  con su correlativo, R8). */
export type CreateOrderFormState =
  | { status: 'idle' }
  | { status: 'success'; id: string; numberText: string }
  | OrderLinesErrorState;

export type UpdateOrderFormState =
  | { status: 'idle' }
  | { status: 'success' }
  | OrderLinesErrorState;

/** Estado compartido por las mutaciones que no devuelven datos ni posiciones de receta. */
export type OrderMutationFormState =
  | { status: 'idle' }
  | { status: 'success' }
  | ErrorState;

export type OrderQueryResult =
  | { status: 'success'; data: OrderView }
  | ErrorState;

export type OrderListResult =
  | { status: 'success'; data: Page<OrderSummary> }
  | ErrorState;

/** La cotizacion de coste no persiste nada, asi que su resultado no necesita un
 *  estado `idle` -no hay ningun formulario que la dispare-. */
export type OrderCostQuoteResult =
  | { status: 'success'; data: OrderCostQuote }
  | ErrorState;

// NO se exporta ninguna constante `INITIAL_STATE`: un archivo con `'use server'` solo puede
// exportar funciones async (restriccion real de Next.js). Quien consuma estas actions (QC-35)
// construye el literal `{ status: 'idle' }` con el tipo exportado arriba.

/** Copy provisional, en una constante para que ningun test dependa del literal. */
const MISSING_ID_ERROR = 'Falta el identificador del pedido.';

/**
 * `code` de la entrada que ni siquiera llega a formarse. Es el MISMO codigo que publica
 * `ValidationError` del dominio, y no una segunda taxonomia: quien consuma estas actions
 * decide por el `code` y no puede tener que conocer dos para el mismo caso.
 *
 * QC-70 (R21): sale del CATALOGO -tipado `ErrorCode`- en vez de ser un literal escrito aqui,
 * asi que renombrarlo en el catalogo rompe el typecheck en vez de dejar esta linea mintiendo.
 * El MENSAJE que lo acompana (`MISSING_ID_ERROR`) es de esta action, no del catalogo: es su
 * propia comprobacion de entrada, y R31 no la migra.
 */
const INVALID_INPUT_CODE = 'invalid_input' satisfies ErrorCode;

/**
 * QC-70 (R10): la UNICA implementacion del traductor vive en `@/lib/modules/errores`. Aqui
 * solo se ata a la clase base de ESTE modulo, igual que QC-54 parametriza `requireAdmin` por
 * el `UnauthorizedError` de cada modulo. La copia que este archivo llevaba -una de siete
 * identicas, byte a byte- desaparecio con esta ficha.
 */
const toErrorState = createErrorStateTranslator(PedidosError, observabilidad.readRequestIdHeader);

/**
 * El actor: se resuelve UNA vez por invocacion, nunca dentro del dominio.
 *
 * Usuario y contexto de empresa salen de la sesion del servidor, en paralelo; si falta cualquiera
 * de los dos devuelve `null` y el caso de uso rechaza antes de tocar ningun puerto. La empresa
 * jamas sale de la entrada del llamante: si no, elegirla seria escribir otro uuid en el formulario.
 */
async function currentActor(): Promise<Actor | null> {
  // El ambito envuelve solo este `Promise.all`: las dos caras comparten una lectura de sesion.
  const [sessionUser, sessionContext] = await runInRequestScope(() =>
    Promise.all([identity.getSessionUser(), identity.getSessionContext()]),
  );
  if (sessionUser === null || sessionContext === null) return null;
  return {
    id: sessionUser.id,
    companyId: sessionContext.companyId,
    permissions: sessionUser.permissions,
  };
}

function readFormString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value : '';
}

async function toOrderLinesErrorState(error: unknown): Promise<OrderLinesErrorState> {
  return { ...(await toErrorState(error)), linePositions: linePositionsOf(error) };
}

/**
 * Alta de pedido. `input` es el pedido con todas sus recetas, tal como lo arma el panel: se entrega
 * sin tocar al caso de uso, que lo valida despues de comprobar el permiso. Devuelve el id y el numero
 * visible ya compuesto.
 */
export async function createOrderAction(input: unknown): Promise<CreateOrderFormState> {
  const actor = await currentActor();

  try {
    const created = await pedidos.createOrder(input, actor);
    return { status: 'success', id: created.id, numberText: created.numberText };
  } catch (error) {
    return toOrderLinesErrorState(error);
  }
}

/** Edicion de pedido: reemplazo completo, con todas sus recetas, entregado sin tocar al caso de uso.
 *  El `id` es ARGUMENTO y no campo de la entrada, como en `proveedores`. */
export async function updateOrderAction(id: string, input: unknown): Promise<UpdateOrderFormState> {
  const actor = await currentActor();

  try {
    await pedidos.updateOrder(id, input, actor);
    return { status: 'success' };
  } catch (error) {
    return toOrderLinesErrorState(error);
  }
}

/**
 * Cancelacion de pedido. El `id` viaja como campo oculto del formulario,
 * igual que en el borrado, porque quien cancela lo hace desde un boton de la fila.
 *
 * El motivo se entrega TAL CUAL: el recorte, el minimo y el tope de 500 son de
 * `cancelOrderSchema`, dentro del caso de uso. Aqui no se recorta ni se mide nada.
 */
export async function cancelOrderAction(
  prevState: OrderMutationFormState,
  formData: FormData,
): Promise<OrderMutationFormState> {
  void prevState;

  const id = readFormString(formData, 'id');
  if (id === '') {
    return { status: 'error', code: INVALID_INPUT_CODE, message: MISSING_ID_ERROR };
  }

  const actor = await currentActor();

  try {
    await pedidos.cancelOrder(id, { reason: readFormString(formData, 'reason') }, actor);
    return { status: 'success' };
  } catch (error) {
    return toErrorState(error);
  }
}

/** Copy provisional, en una constante para que ningun test dependa del literal. */
const MISSING_LINE_ID_ERROR = 'Falta el identificador de la receta.';

/**
 * Cancelacion de UNA receta del pedido. `id`, `lineId` y el motivo viajan como
 * campos ocultos del dialogo, el mismo patron que `cancelOrderAction`.
 *
 * El motivo se entrega TAL CUAL: lo valida `cancelOrderLineSchema` dentro de `cancelOrderLine`,
 * despues de su comprobacion de `pedidos.modificar`. Aqui solo se comprueba que el pedido y la
 * receta vengan, porque sin ellos no hay a quien llamar.
 */
export async function cancelOrderLineAction(
  prevState: OrderMutationFormState,
  formData: FormData,
): Promise<OrderMutationFormState> {
  void prevState;

  const id = readFormString(formData, 'id');
  if (id === '') {
    return { status: 'error', code: INVALID_INPUT_CODE, message: MISSING_ID_ERROR };
  }
  const lineId = readFormString(formData, 'lineId');
  if (lineId === '') {
    return { status: 'error', code: INVALID_INPUT_CODE, message: MISSING_LINE_ID_ERROR };
  }

  const actor = await currentActor();

  try {
    await pedidos.cancelOrderLine(id, lineId, { reason: readFormString(formData, 'reason') }, actor);
    return { status: 'success' };
  } catch (error) {
    return toErrorState(error);
  }
}

/** Borrado LOGICO del pedido (R31, R32, R33). El `id` viaja como campo oculto del formulario. */
export async function deleteOrderAction(
  prevState: OrderMutationFormState,
  formData: FormData,
): Promise<OrderMutationFormState> {
  void prevState;

  const id = readFormString(formData, 'id');
  if (id === '') {
    return { status: 'error', code: INVALID_INPUT_CODE, message: MISSING_ID_ERROR };
  }

  const actor = await currentActor();

  try {
    await pedidos.deleteOrder(id, actor);
    return { status: 'success' };
  } catch (error) {
    return toErrorState(error);
  }
}

/** Ficha del pedido (R42, R43). Consulta: argumento tipado, no `FormData`. */
export async function getOrderAction(id: string): Promise<OrderQueryResult> {
  const actor = await currentActor();

  try {
    const data = await pedidos.getOrder(id, actor);
    return { status: 'success', data };
  } catch (error) {
    return toErrorState(error);
  }
}

/**
 * Lista paginada de pedidos (R34-R41, R45). Consulta: argumento tipado -quien llama ya tiene
 * la consulta de lista, con el estado y la prioridad como filtros `select` (QC-57 R25)-.
 * `query` es `unknown` porque la cadena entera vive dentro del caso de uso (QC-57 R30):
 * `createListQuerySchema()` valida la forma, `sanitizeListQuery` poda contra
 * `ORDER_QUERYABLE` -y `list-orders.ts` poda ademas los valores de los dos `select`
 * cerrados-, el caso de uso registra lo omitido por el puerto `ListQueryLog` y el
 * repositorio recibe la consulta ya saneada. Esta action no repite nada de eso ni conoce el
 * defecto de 10 ni el tope de 25.
 */
export async function listOrdersAction(query: unknown): Promise<OrderListResult> {
  const actor = await currentActor();

  try {
    const data = await pedidos.listOrders(query, actor);
    return { status: 'success', data };
  } catch (error) {
    return toErrorState(error);
  }
}

// ---------------------------------------------------------------------------------------------
// La cobertura de VARIOS pedidos a la vez, UNA consulta por pagina. Bloque nuevo al final: no
// reordena ni reformatea nada de arriba.
// ---------------------------------------------------------------------------------------------

/** Una entrada del array plano: un `Map` no cruza el borde de una Server Action tan bien como un
 *  array serializable, mismo criterio que `OrderResponsiblesEntry` de `asignaciones`. */
export type OrderCoverageEntry = { readonly orderId: string; readonly coverage: OrderCoverage };

export type OrderCoverageBatchResult =
  | { status: 'success'; data: readonly OrderCoverageEntry[] }
  | ErrorState;

/**
 * La cobertura de la pagina entera: argumento ya tipado, no `FormData` -no viene de un
 * `<form>`-. Ningun permiso se comprueba aqui: la frontera es `requirePermission(actor,
 * 'pedidos.consultar')` en la primera linea del caso de uso.
 */
export async function listOrderCoverageAction(
  orderIds: readonly string[],
): Promise<OrderCoverageBatchResult> {
  const actor = await currentActor();

  try {
    const coverage = await pedidos.findCoverage(orderIds, actor);
    return { status: 'success', data: [...coverage].map(([orderId, value]) => ({ orderId, coverage: value })) };
  } catch (error) {
    return toErrorState(error);
  }
}

/**
 * Cotizacion del coste de ingredientes. Consulta: argumento tipado, no `FormData` -no
 * hay formulario que enviar, es un efecto del teclado-. No escribe nada: sin
 * `revalidatePath`.
 */
export async function quoteOrderCostAction(input: unknown): Promise<OrderCostQuoteResult> {
  const actor = await currentActor();

  try {
    const data = await pedidos.quoteOrderCost(input, actor);
    return { status: 'success', data };
  } catch (error) {
    return toErrorState(error);
  }
}

// ---------------------------------------------------------------------------------------------
// «Cuanto queda disponible», de solo lectura.
// ---------------------------------------------------------------------------------------------

export type OrderPresentationAvailabilityResult =
  | { status: 'success'; data: OrderPresentationAvailabilityNext }
  | ErrorState;

/**
 * El disponible en vivo del formulario de reparto, en la unidad del pedido -mismo patron que
 * `quoteOrderCostAction` para el coste-. Argumento tipado, no `FormData`: no hay `<form>` que
 * enviar, se recalcula con cada tecla. Nunca rechaza por el reparto: `data.kind` puede ser
 * `'exceeds_quantity'` con `available` negativo (el aviso), y sigue siendo un `'success'`
 * -el rechazo lo hace el guardado, no esta consulta.
 */
export async function quoteOrderPresentationAvailabilityAction(
  input: unknown,
): Promise<OrderPresentationAvailabilityResult> {
  const actor = await currentActor();

  try {
    const data = await pedidos.quoteOrderPresentationAvailability(input, actor);
    return { status: 'success', data };
  } catch (error) {
    return toErrorState(error);
  }
}

// ---------------------------------------------------------------------------------------------
// La edicion ACOTADA «Reparto y unidad» en `POR_EMPACAR`.
// ---------------------------------------------------------------------------------------------

/**
 * `updateOrderPresentationLines` NO comprueba el permiso: su unico llamador es esta
 * action, y por eso -a diferencia de las diez de arriba, que no repiten `requirePermission`
 * porque su caso de uso ya es la primera linea que lo hace- esta SI lo llama, aqui, antes de
 * `zod` y antes de tocar la fachada.
 */
export async function updateOrderDistributionAction(
  id: string,
  input: unknown,
): Promise<OrderMutationFormState> {
  const actor = await currentActor();

  try {
    requirePermission(actor, 'pedidos.modificar');

    const parsed = updateOrderDistributionSchema.safeParse(input);
    if (!parsed.success) throw new ValidationError();

    const result = await pedidos.updateOrderPresentationLines(id, actor, {
      lineId: parsed.data.lineId,
      unitId: parsed.data.unitId,
      lines: parsed.data.presentationLines,
      confirmBlocked: parsed.data.confirmBlocked,
    });

    switch (result) {
      case 'ok':
        return { status: 'success' };
      case 'not_found':
        throw new OrderNotFoundError();
      case 'not_editable':
        throw new OrderPresentationLineNotEditableError();
      case 'unit_not_found':
        throw new UnitNotFoundError();
      case 'without_unit':
        throw new OrderWithoutUnitError();
      case 'presentation_not_found':
        throw new PresentationNotFoundError();
      case 'packaging_not_found':
        throw new ProductNotFoundError();
      case 'invalid_lines':
        throw new ValidationError();
      case 'presentation_without_content':
        throw new PresentationWithoutContentError();
      case 'incompatible_units':
        throw new IncompatibleUnitsError();
      case 'exceeds_quantity':
        throw new OrderDistributionExceedsQuantityError();
      case 'would_block':
        throw new OrderWouldBlockError();
      case 'insufficient_material':
        throw new InsufficientMaterialError();
      case 'unit_not_convertible':
        throw new OrderUnitNotConvertibleError();
    }
  } catch (error) {
    return toErrorState(error);
  }
}

// ---------------------------------------------------------------------------------------------
// El cliente del pedido.
// ---------------------------------------------------------------------------------------------

export type OrderCustomerOptionsResult = { status: 'success'; data: Page<OrderCustomer> } | ErrorState;

export type OrderCustomerFilterOptionResult = { status: 'success'; data: OrderCustomer | null } | ErrorState;

/** Cambio de cliente. Argumentos tipados, sin `FormData`: el dialogo no es un `<form>` de varios
 *  campos. `input` = `{ customerId: string | null }`. */
export async function setOrderCustomerAction(id: string, input: unknown): Promise<OrderMutationFormState> {
  const actor = await currentActor();

  try {
    await pedidos.setOrderCustomer(id, input, actor);
    return { status: 'success' };
  } catch (error) {
    return toErrorState(error);
  }
}

/** Opciones del selector. `purpose` decide el permiso y si entran los dados de baja.
 *  `query` = `{ search: string; page: number; pageSize?: number }`. */
export async function searchOrderCustomersAction(
  query: unknown,
  purpose: OrderCustomerSearchPurpose,
): Promise<OrderCustomerOptionsResult> {
  const actor = await currentActor();

  try {
    const data = await pedidos.searchOrderCustomers(query, purpose, actor);
    return { status: 'success', data };
  } catch (error) {
    return toErrorState(error);
  }
}

/** El cliente que trae la direccion del filtro. `null` = descartar el filtro. */
export async function getOrderCustomerFilterOptionAction(id: string): Promise<OrderCustomerFilterOptionResult> {
  const actor = await currentActor();

  try {
    const data = await pedidos.getOrderCustomerFilterOption(id, actor);
    return { status: 'success', data };
  } catch (error) {
    return toErrorState(error);
  }
}

// ---------------------------------------------------------------------------------------------
// La entrega de producto terminado.
// ---------------------------------------------------------------------------------------------

export type OrderDeliveryResult = { status: 'success'; data: OrderDeliveryView } | ErrorState;

/** Lo que el sheet de entrega pinta de una receta `TERMINADO` del pedido. */
export async function getOrderDeliveryAction(orderId: string, lineId: string): Promise<OrderDeliveryResult> {
  const actor = await currentActor();

  try {
    const data = await pedidos.getOrderDelivery(orderId, lineId, actor);
    return { status: 'success', data };
  } catch (error) {
    return toErrorState(error);
  }
}

export type DeliverOrderInput = {
  readonly orderId: string;
  readonly deliveryKey: string;
  readonly customers: readonly { readonly customerId: string; readonly allocations: readonly DeliveryAllocation[] }[];
};

export type DeliverOrderActionResult = { status: 'success'; data: DeliverOrderResult } | ErrorState;

/** Registra una entrega. `input` tiene la forma de `DeliverOrderInput`; la valida el caso de uso. */
export async function deliverOrderAction(input: unknown): Promise<DeliverOrderActionResult> {
  const actor = await currentActor();

  try {
    const data = await pedidos.deliverOrder(input, actor);
    return { status: 'success', data };
  } catch (error) {
    return toErrorState(error);
  }
}

// ---------------------------------------------------------------------------------------------
// La anulacion de entregas.
// ---------------------------------------------------------------------------------------------

export type OrderDeliveriesResult = { status: 'success'; data: OrderDeliveryHistoryView } | ErrorState;

/** Las entregas de una receta del pedido, con lo anulado de cada una. */
export async function listOrderDeliveriesAction(orderId: string, lineId: string): Promise<OrderDeliveriesResult> {
  const actor = await currentActor();

  try {
    const data = await pedidos.listOrderDeliveries(orderId, lineId, actor);
    return { status: 'success', data };
  } catch (error) {
    return toErrorState(error);
  }
}

export type VoidDeliveryInput = {
  readonly deliveryId: string;
  readonly voidKey: string;
  readonly items: readonly { readonly customerId: string; readonly presentationLineId: string }[];
  readonly reason: string;
};

export type VoidDeliveryActionResult = { status: 'success'; data: VoidDeliveryResult } | ErrorState;

/** Anula pares cliente-presentacion de una entrega. `input` tiene la forma de `VoidDeliveryInput`; la valida el caso de uso. */
export async function voidDeliveryAction(input: unknown): Promise<VoidDeliveryActionResult> {
  const actor = await currentActor();

  try {
    const data = await pedidos.voidDelivery(input, actor);
    return { status: 'success', data };
  } catch (error) {
    return toErrorState(error);
  }
}

// ---------------------------------------------------------------------------------------------
// La entrega sin pedido y su anulacion.
// ---------------------------------------------------------------------------------------------

export type DirectDeliveryResult = { status: 'success'; data: DirectDeliveryView } | ErrorState;

/** Lo que el sheet de entrega sin pedido pinta de un producto terminado. */
export async function getDirectDeliveryAction(productId: string): Promise<DirectDeliveryResult> {
  const actor = await currentActor();

  try {
    const data = await pedidos.getDirectDelivery(productId, actor);
    return { status: 'success', data };
  } catch (error) {
    return toErrorState(error);
  }
}

/** Plano y serializable: `productId -> envases de excedente`. */
export type DirectDeliverySurplusResult = { status: 'success'; data: Readonly<Record<string, number>> } | ErrorState;

export async function listDirectDeliverySurplusAction(
  productIds: readonly string[],
): Promise<DirectDeliverySurplusResult> {
  const actor = await currentActor();

  try {
    const surplus = await pedidos.listDirectDeliverySurplus(productIds, actor);
    return { status: 'success', data: Object.fromEntries(surplus) };
  } catch (error) {
    return toErrorState(error);
  }
}

export type DeliverDirectInput = {
  readonly productId: string;
  readonly deliveryKey: string;
  readonly note: string | null;
  readonly customers: readonly {
    readonly customerId: string;
    readonly allocations: readonly { readonly batchId: string; readonly packages: number }[];
  }[];
};

export type DeliverDirectActionResult = { status: 'success'; data: DeliverDirectResult } | ErrorState;

/** Registra una entrega sin pedido. `input` tiene la forma de `DeliverDirectInput`; la valida el caso de uso. */
export async function deliverDirectAction(input: unknown): Promise<DeliverDirectActionResult> {
  const actor = await currentActor();

  try {
    const data = await pedidos.deliverDirect(input, actor);
    return { status: 'success', data };
  } catch (error) {
    return toErrorState(error);
  }
}

export type DirectDeliveryVoidViewResult = { status: 'success'; data: DirectDeliveryVoidView } | ErrorState;

/** Lo que el dialogo de anular pinta de una entrega sin pedido. */
export async function getDirectDeliveryForVoidAction(deliveryId: string): Promise<DirectDeliveryVoidViewResult> {
  const actor = await currentActor();

  try {
    const data = await pedidos.getDirectDeliveryForVoid(deliveryId, actor);
    return { status: 'success', data };
  } catch (error) {
    return toErrorState(error);
  }
}

export type VoidDirectDeliveryInput = {
  readonly deliveryId: string;
  readonly voidKey: string;
  readonly customerIds: readonly string[];
  readonly reason: string;
};

export type VoidDirectDeliveryActionResult = { status: 'success'; data: VoidDirectDeliveryResult } | ErrorState;

/** Anula la parte de unos clientes de una entrega sin pedido. `input` tiene la forma de `VoidDirectDeliveryInput`. */
export async function voidDirectDeliveryAction(input: unknown): Promise<VoidDirectDeliveryActionResult> {
  const actor = await currentActor();

  try {
    const data = await pedidos.voidDirectDelivery(input, actor);
    return { status: 'success', data };
  } catch (error) {
    return toErrorState(error);
  }
}
