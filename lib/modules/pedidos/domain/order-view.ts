import type { OrderLineStatus, OrderPriority, OrderStatus } from './order-classification';
import type { EditableOrderStatus } from './order-input';
import type { OrderCustomer } from './order-customer';
import type { OrderNumber } from './order-number';
import type { OrderDeliveryState } from './order-pending-delivery';
import type { OrderProgress } from './order-totals';

/**
 * Contratos de entrada y salida del pedido (`design.md > 7.3`). Viven en `domain/` -no en
 * `ports/`- porque describen el QUE se dice, no el COMO se habla con el mundo, y es lo unico
 * que el contrato publico (`index.ts`) puede reexportar.
 *
 * La cantidad viaja como CADENA decimal en las dos direcciones, nunca `number`
 * (`docs/architecture.md > Anti-patrones`): el adaptador driven la devuelve con `.toFixed(4)`.
 *
 * Desde 2026-09-07 el precio unitario y la unidad salieron del pedido; el precio **unitario**
 * sigue fuera -el precio del pedido entero es `salePrice`-.
 * Devuelve la UNIDAD (`unitId`), porque la cantidad se interpreta siempre en ella,
 * con o sin reparto, y el reparto en si mismo -`presentationLines`- sustituye a la presentacion
 * unica.
 *
 * El coste de los ingredientes y el precio de venta son de cada linea; el precio lo escribe el
 * usuario y no se deriva del coste.
 */

/**
 * Una linea del reparto ya resuelta y lista para el puerto de escritura: la presentacion, los
 * envases enteros y el contenido que se le copia en este instante (`null` = la
 * presentacion no lo tiene).
 */
export type OrderPresentationLineWrite = {
  readonly presentationId: string;
  readonly packages: number;
  readonly content: string | null;
  /** `null` = linea antigua que se conserva sin envase. */
  readonly packagingProductId: string | null;
};

/** Una linea del reparto tal como la lee el puerto, con el contenido copiado al guardarla: la
 *  ficha y el listado lo pintan junto al envase («Envase 2 · 300 ml»). */
export type OrderPresentationLineRow = {
  readonly presentationId: string;
  readonly packages: number;
  /** Cadena decimal copiada al guardar la linea; `null` = sin copia, vale la de la presentacion. */
  readonly presentationContent: string | null;
  /** `null` en una linea anterior a que el reparto nombrara su envase. */
  readonly packagingProductId: string | null;
};

/** Una linea del reparto en la ficha y el listado. */
export type OrderPresentationLineView = {
  readonly presentationId: string;
  /** `null` solo si la presentacion no vuelve del catalogo. */
  readonly presentationName: string | null;
  readonly packages: number;
  /** `null` en una linea anterior a que el reparto nombrara su envase. */
  readonly packagingProductId: string | null;
  /** `null` en esa linea antigua, o si el envase no vuelve del catalogo. */
  readonly packagingName: string | null;
  /** Cadena decimal: el contenido copiado en la linea o, sin copia, el vigente de la
   *  presentacion. `null` = ninguno de los dos: la etiqueta no pinta el volumen. */
  readonly presentationContent: string | null;
  /** Simbolo (o nombre) de la unidad de la PRESENTACION, en la que se expresa el contenido;
   *  `null` si la presentacion o su unidad no vuelven del catalogo. */
  readonly presentationUnitLabel: string | null;
};

/**
 * Datos de negocio de un pedido, ya validados por `order-input.ts` y listos para el puerto.
 *
 * `status` es `EditableOrderStatus`, NO `OrderStatus`: este tipo no puede EXPRESAR
 * `'CANCELADO'`, y tampoco lleva `cancellationReason`. Es la primera de las cuatro capas de
 * `design.md > 8`: `updateOrder` no puede ni siquiera formular una cancelacion, y quien lo
 * intente rompe el `typecheck` en vez de descubrirlo en produccion. El unico camino hacia
 * `CANCELADO` es `cancelAlive`, que es el unico metodo del puerto con `reason` (R24, R26).
 *
 * En el ALTA el estado es siempre `PENDIENTE` (R9) y lo pone el caso de uso; el correlativo lo
 * entrega la secuencia de la base (R11) y los dos autores salen de la sesion (R6), asi que
 * ninguno de los tres esta aqui.
 */
export type NewOrder = {
  readonly priority: OrderPriority;
  readonly status: EditableOrderStatus;
  /** `null` = pedido sin cliente. */
  readonly customerId: string | null;
};

/**
 * Datos de negocio de una EDICION: lo mismo que `NewOrder` sin `status`. La edicion ya no
 * puede ni EXPRESAR un cambio de estado -ni siquiera `PENDIENTE` a `PENDIENTE`-, asi que quien
 * decide si el pedido sigue siendo editable es `assertTransition(row.status, row.status)` en
 * `update-order.ts`, contra el estado ya leido de la fila.
 */
export type OrderEdit = Omit<NewOrder, 'status'>;

/** Lo que una edicion escribe en el pedido mismo: lo de cada receta va en su linea. */
export type OrderHeaderEdit = OrderEdit;

/**
 * La fila tal como la devuelve el puerto: lo que vive en `orders` y nada mas. Lo de cada receta
 * viene en sus lineas (`OrderLineRow`).
 *
 * `deletedAt` NO sale: ninguna consulta devuelve borrados (R40), asi que seria siempre `null`
 * y solo invitaria a filtrar en memoria lo que ya filtro el puerto.
 */
export type OrderRow = {
  readonly id: string;
  readonly number: OrderNumber;
  readonly priority: OrderPriority;
  readonly status: OrderStatus;
  readonly cancellationReason: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  /** Solo el id: el nombre lo resuelve el caso de uso con el catalogo de clientes. */
  readonly customerId: string | null;
};

/** Una receta del pedido tal como la devuelve el puerto. `recipeId` es la receta que se fabrica (la
 *  version, si se eligio una) y `originalRecipeId`, su original. */
export type OrderLineRow = {
  readonly id: string;
  readonly orderId: string;
  readonly position: number;
  readonly recipeId: string;
  readonly originalRecipeId: string;
  readonly quantity: string;
  /** `null` solo en lineas migradas de pedidos antiguos sin unidad. */
  readonly unitId: string | null;
  readonly status: OrderLineStatus;
  readonly cancellationReason: string | null;
  readonly ingredientsCost: string | null;
  readonly packagingCost: string | null;
  readonly actualCost: string | null;
  readonly salePrice: string | null;
  readonly reservedAt: Date | null;
  readonly finishedAt: Date | null;
  readonly packedBy: string | null;
  readonly conditionedBy: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  /** El reparto de esta linea, en orden de alta. */
  readonly presentationLines: readonly OrderPresentationLineRow[];
};

/**
 * Salida de la consulta de la ficha (R42). `numberText` lo compone `formatOrderNumber`, que es
 * la UNICA definicion del formato (R14, QC-33 R24); no se persiste ni se vuelve a formatear en
 * ningun otro sitio.
 *
 * `recipeName` es `string | null`: `null` solo si el id no vuelve del catalogo
 * -una receta borrada FISICAMENTE por consola, que las FK `RESTRICT` de QC-33 hacen casi
 * imposible-. La fila SIGUE apareciendo (mismo criterio que QC-25 R18 y QC-43 R37). Una receta
 * dada de BAJA si vuelve, con su nombre (R44).
 *
 * `createdBy`/`updatedBy` son IDENTIFICADORES, no nombres (R46): este modulo no consulta el
 * modelo `User`. Resolverlos es de QC-35.
 *
 * Los campos planos de receta, cantidad, unidad, reparto, precio y coste estimado son los de la
 * primera linea (`lines[0]`), los que la pantalla de una receta ya pinta. `actualCost` es la suma
 * de las lineas activas, igual que `actualCostTotal`. Esta salida no tiene moneda.
 */
export type OrderView = {
  readonly id: string;
  readonly number: OrderNumber;
  readonly numberText: string;
  readonly recipeId: string;
  /** El nombre mostrado: «Original · Version» si `recipeId` es una version. */
  readonly recipeName: string | null;
  /** `null` si la receta es una original o no vuelve del catalogo. */
  readonly recipeVersion: {
    readonly originalId: string;
    readonly originalName: string;
    readonly versionName: string;
  } | null;
  /** URL publica de la imagen de la receta; la de la original si `recipeId` es una version.
   *  Llega con la misma lectura del catalogo que `recipeName`, sin consulta por fila. `null` =
   *  sin imagen, o receta que no vuelve del catalogo. */
  readonly recipeImageUrl: string | null;
  readonly quantity: string;
  readonly priority: OrderPriority;
  readonly status: OrderStatus;
  readonly cancellationReason: string | null;
  readonly ingredientsCost: string | null;
  /** La parte de envases que ya va dentro de `ingredientsCost`, no un sumando aparte. `null` si y
   *  solo si `ingredientsCost` lo es. */
  readonly packagingCost: string | null;
  /** Coste real de lo consumido, fijado al Terminar el empaque; `null` sin terminar o sin
   *  calculo posible, nunca `0`. Va aparte del estimado y no lo sustituye. */
  readonly actualCost: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly createdBy: string | null;
  readonly updatedBy: string | null;
  /** El reparto en orden de alta; `[]` = sin reparto. Cada linea lleva lo que
   *  `presentationLinesSchema` acepta, asi que la edicion lo precarga tal cual. */
  readonly presentationLines: readonly OrderPresentationLineView[];
  /** La unidad en que se expresa `quantity`; `null` en los pedidos que no la
   *  tienen todavia. */
  readonly unitId: string | null;
  /** El simbolo de la unidad, o su nombre si no tiene simbolo; `null` cuando `unitId`
   *  es `null`, nunca cuando el id no vuelve del catalogo -la FK con `RESTRICT` hace ese caso
   *  imposible por construccion-. */
  readonly unitLabel: string | null;
  /** `null` = pedido sin cliente. Un cliente dado de baja vuelve con `isDeleted: true`. */
  readonly customer: OrderCustomer | null;
  /** Precio de venta del pedido entero; `null` = sin precio, distinto de `'0.0000'`. */
  readonly salePrice: string | null;
  /** Las recetas vivas del pedido, canceladas incluidas, por `position`. */
  readonly lines: readonly OrderLineView[];
  /** Lineas activas y cuantas de ellas estan en `TERMINADO` o `ENTREGADO`. */
  readonly progress: OrderProgress;
  /** Suma de los precios de las lineas activas que lo tienen; `null` si ninguna lo tiene. */
  readonly salePriceTotal: string | null;
  readonly linesWithoutPrice: number;
  /** `null` si alguna linea activa no tiene coste: una suma con huecos no es el coste. */
  readonly ingredientsCostTotal: string | null;
  readonly actualCostTotal: string | null;
};

/** Una receta del pedido en la ficha y el listado. Las sumas del pedido salen de estas lineas y no
 *  se guardan. */
export type OrderLineView = {
  readonly id: string;
  readonly position: number;
  readonly recipeId: string;
  /** El nombre mostrado; `null` si la receta no vuelve del catalogo. */
  readonly recipeName: string | null;
  readonly quantity: string;
  readonly unitId: string | null;
  readonly status: OrderLineStatus;
  readonly cancellationReason: string | null;
  readonly presentationLines: readonly OrderPresentationLineView[];
  readonly salePrice: string | null;
  readonly ingredientsCost: string | null;
  readonly packagingCost: string | null;
  readonly actualCost: string | null;
  readonly finishedAt: Date | null;
  readonly reservedAt: Date | null;
};

/**
 * Cada fila del listado lleva lo mismo que la ficha mas lo que falta por entregar. Se declara
 * sobre `OrderView` y no como una copia para que las dos salidas no puedan diverger.
 */
export type OrderSummary = OrderView & {
  /** Si hay algo empacado, si queda por entregar y que (`deliveryStateOf`). */
  readonly pendingDelivery: OrderDeliveryState;
};

