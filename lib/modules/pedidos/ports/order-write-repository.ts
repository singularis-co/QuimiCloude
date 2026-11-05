import type { OrderLineStatus, OrderStatus } from '../domain/order-classification';
import type { StoredOrderCost } from '../domain/order-cost';
import type { OrderScope } from '../domain/order-scope';
import type { PackedLineCount } from '../domain/packing-count';
import type {
  NewOrder,
  OrderHeaderEdit,
  OrderLineRow,
  OrderPresentationLineWrite,
  OrderRow,
} from '../domain/order-view';

/** La fila que bloquea `lockAliveById`, con `reservedAt`: quien vuelve a comprobar el plazo bajo
 *  el candado -el proceso diario- lo necesita sin pedir una segunda lectura. */
export type LockedOrderRow = OrderRow & { readonly reservedAt: Date | null };

/** El pedido bloqueado y sus lineas vivas -canceladas incluidas-, bloqueadas despues por
 *  `position`. */
export type LockedOrderLines = {
  readonly order: LockedOrderRow;
  readonly lines: readonly OrderLineRow[];
};

/** El pedido bloqueado y una de sus lineas vivas, bloqueada despues. */
export type LockedOrderLine = {
  readonly order: LockedOrderRow;
  readonly line: OrderLineRow;
};

/** Lo que se escribe de una linea en un alta o una edicion. `originalRecipeId` es la original de
 *  `recipeId`, o ella misma: con ella la base rechaza dos lineas activas de la misma receta. */
export type OrderLineWrite = {
  readonly recipeId: string;
  readonly originalRecipeId: string;
  readonly quantity: string;
  readonly unitId: string;
  /** Precio de venta de la linea. `null` = sin precio. */
  readonly salePrice: string | null;
  /** El reparto de la linea, ya resuelto; reemplaza entero al guardado. */
  readonly presentationLines: readonly OrderPresentationLineWrite[];
};

/** Una linea nueva: nace sin cancelar y con su coste, o `null` si no se pudo calcular. */
export type NewOrderLine = OrderLineWrite & {
  readonly status: Exclude<OrderLineStatus, 'CANCELADO'>;
  readonly cost: StoredOrderCost | null;
};

/** Una linea guardada que cambia. Con `'keep'` su coste no se toca. */
export type OrderLineEditWrite = {
  readonly lineId: string;
  readonly line: OrderLineWrite;
  readonly cost: StoredOrderCost | null | 'keep';
};

/** Lo que una escritura de lineas cambia en el pedido: quitar, editar y anadir. */
export type OrderLineChanges = {
  readonly removedIds: readonly string[];
  readonly edited: readonly OrderLineEditWrite[];
  readonly added: readonly NewOrderLine[];
};

/** Lo que una etapa escribe en la linea junto con su estado: quien empaca o quien acondiciona. Lo
 *  que no se nombra se conserva. */
export type LineStageStamp = {
  readonly packedBy?: string;
  readonly conditionedBy?: string;
};

/** Una linea del reparto tal como Terminar el empaque la necesita: la presentacion,
 *  sus envases y el contenido copiado -`null` hace que Terminar recurra al vigente, y sin el
 *  rechace; solo alcanzable con una fila escrita fuera de la aplicacion-. */
export type FinishPackingLine = {
  readonly id: string;
  readonly presentationId: string;
  readonly packages: number;
  readonly presentationContent: string | null;
  /** `null` en una linea antigua, sin envase. */
  readonly packagingProductId: string | null;
  /** `null` = todavia sin contar. */
  readonly packedPackages: number | null;
  /** Envases del conteo real que el pedido no espera; 0 sin contar o sin excedente. */
  readonly packedSurplusPackages: number;
  /** La linea del pedido de la que es este reparto; `null` en un pedido sin lineas. */
  readonly orderLineId: string | null;
};

/** El conteo de una linea con los envases que, de ese conteo, quedan libres en el lote. */
export type RecordedPackedLine = PackedLineCount & { readonly packedSurplusPackages: number };

/**
 * Puerto de escritura del pedido DENTRO de una transaccion compartida con `inventario`
 * (`OrderUnitOfWork`, `ports/order-unit-of-work.ts`). No reemplaza a `OrderRepository`: ese
 * sigue siendo quien lee y lista; este solo escribe, y lo hace sobre el cliente -global o
 * transaccional- que le dio la fabrica que lo construyo.
 *
 * Mismo criterio de ambito que `OrderRepository`: `scope: OrderScope` es SIEMPRE el ultimo
 * parametro (`tests/guards/guard-ambito-empresa-pedidos.test.ts`), y «de otra empresa» vuelve
 * como `null` o `'not_found'`, igual que «no existe».
 */
export interface OrderWriteRepository {
  /** `SELECT ... FOR UPDATE` del pedido vivo: `null` si no existe, esta borrado o es de otra
   *  empresa. El dominio repite su comprobacion de transicion sobre la fila que esto devuelve,
   *  nunca sobre la que leyo antes de abrir la transaccion. */
  lockAliveById(id: string, scope: OrderScope): Promise<LockedOrderRow | null>;

  /** El id de la unica linea viva del pedido, o `null` si no tiene ninguna -pedido creado sin
   *  lineas- o es de otra empresa. Lanza si tiene mas de una: quien opera un pedido de varias
   *  lineas ya conoce la suya y no debe preguntar por «la unica». */
  findOnlyLineId(orderId: string, scope: OrderScope): Promise<string | null>;

  /** `FOR UPDATE` del pedido vivo y despues de sus lineas vivas por `position`, siempre en ese
   *  orden para no cruzar candados. `null` si el pedido no existe, esta borrado o es de otra
   *  empresa. */
  lockAliveLines(orderId: string, scope: OrderScope): Promise<LockedOrderLines | null>;

  /** `FOR UPDATE` del pedido vivo y despues de una de sus lineas. `null` si la linea es de otro
   *  pedido, de otra empresa o esta quitada, igual que si el pedido no existe. */
  lockAliveLine(orderId: string, lineId: string, scope: OrderScope): Promise<LockedOrderLine | null>;

  /**
   * Escribe en el pedido, bajo su candado, primero las bajas, despues las ediciones y por ultimo
   * las altas: asi quitar una receta y volver a anadirla en la misma edicion no choca con el unico
   * de receta activa. Las altas toman `position` a continuacion de la mayor del pedido, quitadas
   * incluidas. Devuelve las lineas anadidas, en el orden de `changes.added`; `null` si el pedido o
   * alguna de las lineas nombradas no es suya, en cuyo caso quien llama aborta la transaccion.
   * Lanza `DuplicateOrderRecipeError` si la base rechaza dos lineas activas de la misma receta.
   */
  writeLines(
    orderId: string,
    changes: OrderLineChanges,
    actorId: string,
    now: Date,
    scope: OrderScope,
  ): Promise<readonly OrderLineRow[] | null>;

  /** Escribe `CANCELADO` y el motivo de la linea en la misma sentencia. No toca `reserved_at`. */
  cancelLine(
    orderId: string,
    lineId: string,
    reason: string,
    actorId: string | null,
    now: Date,
    scope: OrderScope,
  ): Promise<'ok' | 'not_found'>;

  /** `UPDATE` condicional `WHERE status = from` de la linea: `'stale'` si sigue viva en otro
   *  estado. No escribe `CANCELADO`: eso es `cancelLine`, que lleva motivo. */
  setLineStatus(
    orderId: string,
    lineId: string,
    from: OrderLineStatus,
    to: Exclude<OrderLineStatus, 'CANCELADO'>,
    actorId: string | null,
    now: Date,
    scope: OrderScope,
  ): Promise<'ok' | 'not_found' | 'stale'>;

  /** Sustituye el coste de la linea, tambien por `null`, sin tocar sus datos ni su estado. */
  setLineIngredientsCost(
    orderId: string,
    lineId: string,
    cost: StoredOrderCost | null,
    actorId: string | null,
    now: Date,
    scope: OrderScope,
  ): Promise<'ok' | 'not_found'>;

  /** Escribe `reserved_at` de la linea sin mover su `updated_at`. */
  setLineReservedAt(orderId: string, lineId: string, reservedAt: Date | null, scope: OrderScope): Promise<void>;

  /**
   * Vuelve a derivar el estado del pedido de sus lineas vivas y lo escribe si cambio. El motivo de
   * cancelacion del pedido es el de su ultima linea cancelada cuando el estado queda `CANCELADO`, y
   * ninguno en cualquier otro. Devuelve el estado derivado, o `null` si el pedido no es suyo.
   */
  refreshStatus(orderId: string, actorId: string | null, now: Date, scope: OrderScope): Promise<OrderStatus | null>;

  /** Alta dentro de la transaccion ya abierta. El choque del correlativo (indice unico
   *  `orders_company_year_sequence_key`) se deja SUBIR: la transaccion entera ya quedo
   *  abortada, y quien reintenta con una transaccion nueva es `OrderUnitOfWork`. */
  create(
    data: NewOrder,
    year: number,
    actorId: string,
    now: Date,
    cost: StoredOrderCost | null,
    scope: OrderScope,
  ): Promise<OrderRow>;

  /** La prioridad y el cliente del pedido; lo de cada receta lo escribe `writeLines`. No puede
   *  escribir estado ni motivo. */
  updateAlive(
    id: string,
    data: OrderHeaderEdit,
    actorId: string,
    now: Date,
    scope: OrderScope,
  ): Promise<'ok' | 'not_found'>;

  /** Copia en `orders` la receta, cantidad, unidad, precio, coste y `reserved_at` de su linea viva
   *  de menor `position`, sin mover `updated_at`: los lectores que aun leen esas columnas del
   *  pedido ven los datos de su linea hasta que dejen de leerlas. */
  mirrorFirstLine(orderId: string, scope: OrderScope): Promise<void>;

  /** Escribe `CANCELADO` y el motivo en el pedido, no en sus lineas: cancelar, caducar y cancelar
   *  por encargo cancelan cada linea con `cancelLine` y derivan el pedido con `refreshStatus`. */
  cancelAlive(
    id: string,
    reason: string,
    actorId: string | null,
    now: Date,
    scope: OrderScope,
  ): Promise<'ok' | 'not_found'>;

  /** Borrado logico del pedido y de todas sus lineas vivas: marca `deleted_at`, jamas borra la
   *  fila ni libera el correlativo. */
  softDeleteAlive(id: string, actorId: string, now: Date, scope: OrderScope): Promise<'ok' | 'not_found'>;

  /** `UPDATE` condicional `WHERE status = from`: `'stale'` si la fila sigue viva pero ya no
   *  esta en `from` -otra operacion la movio entre el bloqueo y esta escritura-. `actorId`
   *  admite `null` para los cambios que hace el sistema, como el desbloqueo al entrar material. */
  setStatus(
    id: string,
    from: OrderStatus,
    to: OrderStatus,
    actorId: string | null,
    now: Date,
    scope: OrderScope,
  ): Promise<'ok' | 'not_found' | 'stale'>;

  /** Sustituye el importe y su parte de envases, tambien por `null`, y sella
   *  `updated_at`/`updated_by` sin tocar los datos de negocio ni el estado. */
  setIngredientsCost(
    id: string,
    cost: StoredOrderCost | null,
    actorId: string | null,
    now: Date,
    scope: OrderScope,
  ): Promise<'ok' | 'not_found'>;



  /** Escribe `reserved_at` SIN mover `updated_at`: apartar o liberar material no es una edicion
   *  que el usuario deba ver en esa columna. */
  setReservedAt(id: string, reservedAt: Date | null, scope: OrderScope): Promise<void>;

  /** Escribe SOLO `customer_id`, `updated_by` y `updated_at` del pedido vivo: ni el estado, ni el
   *  coste, ni la cantidad, ni lo apartado. `customerId` `null` quita el cliente. */
  setCustomerAlive(
    id: string,
    customerId: string | null,
    actorId: string,
    now: Date,
    scope: OrderScope,
  ): Promise<'ok' | 'not_found'>;

  /** `UPDATE` condicional `WHERE status = from` de la linea que escribe a la vez el sello de la
   *  etapa: los CHECK de la linea exigen quien empaca o quien acondiciona en la misma sentencia que
   *  el estado. `'stale'` si sigue viva en otro estado. */
  stampLineStatus(
    orderId: string,
    lineId: string,
    from: OrderLineStatus,
    to: Exclude<OrderLineStatus, 'CANCELADO'>,
    stamp: LineStageStamp,
    actorId: string,
    now: Date,
    scope: OrderScope,
  ): Promise<'ok' | 'not_found' | 'stale'>;

  /** Escribe SOLO `actual_cost` de la linea, sin mover `updated_at`. `null` = sin importe, nunca `0`. */
  setLineActualCost(orderId: string, lineId: string, cost: string | null, scope: OrderScope): Promise<void>;

  /** Las filas del reparto de un pedido, `FOR SHARE`, en el orden de alta: la MISMA transaccion
   *  que mueve la linea, para que un fallo tras leerlas deshaga tambien ese cambio. */
  findPresentationLinesForFinish(id: string, scope: OrderScope): Promise<readonly FinishPackingLine[]>;

  /** Escribe el conteo y los libres de cada linea sin tocar `packages`. Una linea que no sea de
   *  ese pedido y esa empresa no se escribe; quien llama ya comprobo los conteos contra las
   *  lineas leidas. */
  recordPackedCounts(id: string, counts: readonly RecordedPackedLine[], scope: OrderScope): Promise<void>;
}
