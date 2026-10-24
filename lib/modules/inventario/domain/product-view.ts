import type { UnitId } from '@/lib/modules/unidades';

import type { PackagingSubtype } from './packaging-subtype';
import type { ProductType } from './product-type';

/**
 * Contratos de entrada y salida de producto (`design.md > 6.1`, `> 3`). Viven en
 * `domain/` -no en `ports/`- porque describen el QUE se dice, no el COMO se habla con el
 * mundo: eso es dominio, y es lo que el contrato publico (`index.ts`) puede reexportar
 * (solo reexporta de `./domain`).
 */

export type { ProductType } from './product-type';

/**
 * Datos de negocio de un producto, ya validados por `product-input.ts` (`design.md >
 * 6.1`, `7`).
 *
 * QC-52 (R1, R2): sin `cost`, `minPurchase` ni `deliveryTime` -son del catalogo del
 * proveedor-. 2026-09-09: sin `presentationId` -la presentacion se mudo al lote
 * (`ProductBatch`)-. La existencia se quito: se escribe unicamente en el lote que crea el
 * alta. Lo que queda es lo que la cosa ES (`name`), su alerta (`qtyAlert`), su tipo (`type`)
 * y, en el insumo, la unidad en que se cuenta (`unitId`).
 */
export type NewProduct = {
  readonly name: string;
  readonly qtyAlert?: string | null;
  readonly type?: ProductType;
  /** Sin ella, la unidad sale de la presentacion del lote o del envase. */
  readonly unitId?: string;
  /** Ruta en el almacenamiento. Ausente en la edicion = la columna no se toca; `null` = se vacia. */
  readonly imagePath?: string | null;
};

/**
 * Salida de una consulta de producto (`design.md > 6.1`). Sin `createdBy`/`updatedBy` ni
 * `presentationId`/`presentationName` desde el 2026-09-09: la autoria y la presentacion se
 * mudaron a `ProductBatch` (el lote), asi que el producto -catalogo- ya no expone quien lo
 * creo/edito ni en que presentacion viene.
 */
export type ProductView = {
  readonly id: string;
  readonly name: string;
  /**
   * Ruta guardada en `products.image_path`, o `null` si no tiene. Es una ruta del bucket, no
   * una URL servible: para pintar esta `imageUrl`.
   *
   * Sin orden ni filtro (`PRODUCT_QUERYABLE`): no se ordena por una ruta de archivo.
   */
  readonly imagePath: string | null;
  /**
   * URL publica de `imagePath`. La rellenan `getProduct` y `listProducts` cuando tienen el
   * almacenamiento cableado; el adaptador de persistencia no la conoce.
   */
  readonly imageUrl?: string | null;
  /** Existencia guardada en `products.stock`: la suma de los lotes en la unidad del producto,
   *  con sus cuatro decimales. */
  readonly stock: string;
  /** Unidad guardada en `products.unit_id`, o `null` si el producto todavia no tiene lotes. */
  readonly unitId: UnitId | null;
  readonly qtyAlert: string | null;
  /** Tipo del producto: PRODUCT, MACHINE o PACKAGING. */
  readonly type: ProductType;
  /** `null` en lo que no es empaque. Las lecturas de la base siempre lo traen. */
  readonly packagingSubtype?: PackagingSubtype | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  /** Suma de lo apartado en los lotes vivos del producto. Opcional: solo lo rellena
   *  `listAliveProducts`, con una consulta agregada por pagina; las demas lecturas no la traen. */
  readonly reserved?: string;
  /** Suma de lo disponible en los lotes vivos del producto. Misma condicion que `reserved`. */
  readonly available?: string;
  /** Vencimiento mas proximo: el minimo `expiry_date` de los lotes con existencia > 0 del producto
   *  vivo, como fecha de calendario `YYYY-MM-DD`. NO coincide a proposito con `reserved`/`available`,
   *  que suman todos los lotes. `null` si ningun lote con existencia tiene fecha. Solo lo rellena
   *  `listAliveProducts`. */
  readonly nextExpiryDate?: string | null;
  /** Costo unitario medio ponderado por existencia (`weightedAverageUnitCost`) de los lotes con
   *  existencia > 0 y costo, en cadena decimal de cuatro decimales. `null` si ningun lote cumple
   *  las dos. Solo lo rellena `listAliveProducts`, con una consulta por pagina, y solo cuando el
   *  caso de uso le pide costos (`canViewUnitCosts`); sin ese permiso la clave no viaja. */
  readonly averageUnitCost?: string | null;
  /** Presentacion fija del producto; `null` si no la tiene (un envase anterior a tenerla). */
  readonly presentationId?: string | null;
  readonly presentationName?: string | null;
  /** Contenido de un envase, en `presentationUnitId`. */
  readonly presentationContent?: string | null;
  readonly presentationUnitId?: UnitId | null;
};

/** Lo que fija el alta de un empaque: su presentacion (solo el envase la lleva), la unidad en que
 *  se cuenta su existencia y su subtipo, que sin indicar es envase. */
export type PackagingIdentity = {
  readonly presentationId: string | null;
  readonly unitId: UnitId;
  readonly packagingSubtype?: PackagingSubtype;
};
