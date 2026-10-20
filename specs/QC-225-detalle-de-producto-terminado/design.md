# QC-225 — detalle-de-producto-terminado · design.md

> Zona fullstack · Complejidad medium · Requisitos en `requirements.md` (R1–R36; P1 y P2
> cerradas el 2026-10-13; enmienda 2026-10-13 tras la revisión: antes decía «P1 abierta»). Solo lectura: sin tablas, sin migraciones y sin dependencias
> nuevas (R32). Todo sale de Prisma, la aritmética `BigInt` que ya usa `inventario` y los primitivos de
> UI que ya están en el repo.
>
> Grafo de código: no usé el MCP `codebase-memory-mcp` en esta tanda. Exploré con Grep/Read; las rutas
> citadas están verificadas a mano.
>
> **Enmienda 2026-10-13.** QC-224 (`anular-entrega`) ya está en `dev` y en esta rama (merge
> `753635f7`). El humano cerró P2. Cambian §Lo que ya existe, §2.1–§2.4, §2.6, §3, §4.2, §4.3, §6.2,
> §9 (A5, más A9 y A10), §10 y §11. El diseño se apoya en el código real de QC-224, citado abajo.

## Lo que ya existe

Busqué los términos `ficha`, `detalle de producto`, `producto terminado`, `kardex`, `historial`,
`movimiento` y `costo de producción` en tres sitios.

- **Board** (`feature_list.json`): solo esta ficha pide una ficha de producto. QC-223 (`done`) la
  desgajó de sí misma. QC-224 (`anular-entrega`) anuncia en su `requirements.md:13` y en su
  `design.md:14,572` que «QC-225 reutiliza la lista de entregas de este spec»
  (`list-order-deliveries.ts` y `order-delivery-list.tsx`). Ya está mergeada en `dev`. Esta ficha
  usa su modelo de datos, pero no su lista (§9, A5).
- **Specs** (`grep -ril` en `specs/`): ningún spec define una página de detalle de producto. QC-150
  fija el costo unitario guardado en el lote (R14, R42, R43). QC-223 fija el contenido de envase por
  lote (D13) y el asiento `delivery` con `orderDeliveryId`.
- **Código**:
  - No hay ruta `app/(private)/inventario/[...]` de detalle ni helper de ruta de producto en
    `lib/shared/routes.ts`.
  - `createGetProduct` (`inventario/domain/get-product.ts:24`) lee un producto vivo de cualquier
    tipo y no filtra `FINISHED_PRODUCT`.
  - `createListProductBatches` (`list-product-batches.ts:17`) devuelve todos los lotes sin paginar,
    sin pedido de origen y con lista vacía para el producto ajeno, en vez de `product_not_found`.
  - `createListBatchMovements` (`list-batch-movements.ts:43`) es el historial de UN lote, une el
    libro físico con el de reservas y no pagina.
  - `createListFinishedStock` (`list-finished-stock.ts:84`) agrupa por pedido para la pestaña de
    /inventario.
  - En pedidos, `createGetOrderDelivery` (`pedidos/domain/get-order-delivery.ts`) lee lo que falta
    entregar de UN pedido `TERMINADO` y exige `entregas.modificar`.
  - **Lo que trajo QC-224** (verificado en esta rama):
    - Tablas `order_delivery_voids` (con `reason`, `created_by`, `created_at`) y
      `order_delivery_void_lines`. Esta última tiene una fila por línea de entrega anulada, con
      `delivery_line_id` único (`db/migrations/20261009120100_order_delivery_voids/migration.sql:45-63`).
      En Prisma: `OrderDeliveryLine.voidLine → OrderDeliveryVoidLine.void → OrderDeliveryVoid`
      (`db/schema.prisma:831`, `:871-884`). Las dos tablas son `@module pedidos`.
    - `delivery_void` en el tipo de asiento: `InventoryMovementView['kind']`
      (`inventario/domain/inventory-movement.ts:5`). El asiento es positivo (CHECK
      `inventory_movements_delivery_void_quantity_positive`), lleva `orderId` y
      `orderDeliveryVoidId`, no lleva `orderDeliveryId`, y hay uno por lote y anulación
      (`returnFinishedGoods`, `product-prisma.ts:1418-1479`).
    - `OrderDeliveryHistoryReader.listByOrder` (`pedidos/ports/order-delivery-void-repository.ts:62`),
      implementado en `order-delivery-void-prisma.ts:122-160`. Lee las entregas de UN pedido, con
      `voidLine.void` por línea. No se publica en el barrel de `pedidos`.
    - `createListOrderDeliveries` (`pedidos/domain/list-order-deliveries.ts:154`): es por pedido,
      exige `pedidos.consultar` y agrupa por presentación.
    - La etiqueta «Anulación de entrega» ya existe en `KIND_LABELS` de
      `app/(private)/inventario/components/batch-history.tsx:40`, que es el historial de un lote.

  Ninguno resuelve la ficha tal cual: o no filtra el tipo, o no pagina, o mira un lote o un pedido
  en vez de un producto, o exige otro permiso.

**Lo que se reutiliza:**

| Pieza | Dónde | Para qué |
|---|---|---|
| Permiso | `requirePermission` de `inventario/domain/actor.ts` | `inventario.consultar` como primera sentencia |
| Error de producto | `ProductNotFoundError` (`inventario/domain/errors.ts`), código `product_not_found` | R5 |
| Número visible de pedido | `OrderNumberDirectory` (`inventario/domain/reservation.ts:77`), implementado por `findOrderNumberTextsByIds` (`pedidos/adapters/driven/persistence/order-number-directory-prisma.ts:16`) y cableado en `lib/composition/index.ts:914` | pedido de origen y pedido de cada asiento, incluidos borrados (R14) |
| Envases enteros | `wholePackagesIn` (`inventario/domain/finished-goods-dispatch.ts:19`) | R12, R13, R15, R17 |
| Suma decimal | `addQuantities`, `compareQuantities` (`inventario/domain/decimal-quantity.ts`) | R11, R12 |
| Clientes | `CustomerCatalog.findRefsIncludingDeleted` (`clientes/domain/customer-catalog.ts:33`, publicado en el barrel de `clientes`) | nombre del cliente, dado de baja incluido (R20) |
| Unidades | `UnitCatalog.findRefs` (barrel de `unidades`, que `inventario` ya importa) | etiqueta de la unidad base y de la presentación (R10) |
| Paginación | `toOffsetLimit` y `buildPage` (`lib/shared/pagination.ts`), `Page<T>` (`inventario/domain/page.ts`) | R23 |
| Ámbito de empresa | `company-scope.ts` de `inventario` y de `pedidos` | R25 |
| Patrón de página de detalle | `app/(private)/proveedores/[id]/page.tsx` y `supplier-not-found.tsx` | R1, R6 |
| Tabla | `DataTable` y su paginación (`components/shared/data-table/`) | R23, R24 |
| Tabs | `components/ui/tabs.tsx` (lo usa `product-type-tabs.tsx`); se usó `UrlTabs` (`components/shared/url-tabs.tsx`), que lo envuelve y sincroniza la pestaña con la dirección (enmienda 2026-10-13) | R8, R9 |
| Imagen | `EntityImage` (lo usa `finished-stock-columns.tsx:134`) | R10 |
| Etiqueta del motivo | `movementReasonLabel`; al escribir el spec vivía en `app/(private)/inventario/components/batch-history.tsx:47`. Enmienda 2026-10-13: se movió, sin cambiar nombre ni salida, a `app/(private)/inventario/components/movement-reason-label.ts` (módulo sin `'use client'`), porque la sección de la ficha es de servidor | R16, R17 |

## 1. Encaje en módulos

**Decisión: `inventario` es el dueño de la ficha.** Los casos de uso, el puerto de lectura y su
adaptador viven en `inventario`. Lo que no es suyo entra por puertos o contratos que ya existen o que
`inventario` declara:

- **Número del pedido** → `OrderNumberDirectory` (ya existe). `inventario` no puede importar
  `pedidos`: `pedidos` ya importa `inventario` y se cerraría un ciclo.
- **Cliente, envases, anulación de cada entrega y total entregado** → `FinishedDeliveryDirectory`,
  un hueco nuevo que `inventario` declara en su dominio con el mismo patrón que
  `OrderNumberDirectory`. Lo implementa un adaptador driven de `pedidos` y lo cablea
  `lib/composition`. Las tablas `order_deliveries`, `order_delivery_lines`, `order_delivery_voids` y
  `order_delivery_void_lines` son de `pedidos`.
- **Nombre del cliente** → `CustomerCatalog` del barrel de `clientes`. Es una arista nueva
  `inventario → clientes`. No cierra ciclo: `clientes` solo importa `identity` y `errores`
  (verificado con Grep en `lib/modules/clientes/**`).
- **Unidad** → `UnitCatalog` de `unidades`; la arista ya existe.

El adaptador de `inventario` lee solo tablas de `inventario`: `products`, `product_batches`,
`inventory_movements` y `presentations`. La excepción de `finished-stock-prisma.ts:18`, que lee
`orders` y `recipes`, vale solo para `listStockGroups` y aquí no se amplía.

**Por eso el General no lleva el nombre de la receta.** `recetas` importa `inventario`
(`recetas/domain/get-recipe.ts` y cinco archivos más), así que leerla exigiría otro hueco cableado.
Ninguna decisión pide la receta en el General, y el nombre del producto terminado ya la identifica.
Si el humano la quiere, se añade con un `RecipeNameDirectory` del mismo molde.

## 2. Contrato (lo publica T0)

### 2.1 Tipos y funciones puras: `inventario/domain/finished-product-detail.ts`

Sin servidor, sin reloj y sin Prisma. Se publica en el barrel con una sentencia `export { … }` propia
y sin ningún `type …Deps`, para que la guardia de fábricas de
`tests/unit/inventario/schema/inventario-schema.test.ts:741` no lo cuente como caso de uso.

```ts
export const FINISHED_PRODUCT_MOVEMENT_DIRECTIONS = ['in', 'out'] as const;
export type FinishedProductMovementDirection = (typeof FINISHED_PRODUCT_MOVEMENT_DIRECTIONS)[number];

/** Envases enteros y resto de una cantidad positiva con el contenido de su lote. */
export type PackagedQuantity = {
  readonly packages: number;          // entero >= 0
  readonly remainder: string | null;  // unidad base, sin ceros sobrantes; null si es cero
};

/** `null` si `packageContent` es null o <= 0. Usa `wholePackagesIn`. */
export function packagedQuantityOf(quantity: string, packageContent: string | null): PackagedQuantity | null;

export type FinishedStockSummary = {
  readonly total: string;                          // decimal(14,4), unidad base (R11)
  readonly byPackageContent: readonly {            // ordenado por contenido ascendente (R12)
    readonly packageContent: string;
    readonly packages: number;
    readonly remainder: string | null;
  }[];
  readonly withoutPackage: string | null;          // existencia de lotes sin contenido; null si es cero
};

/** R11, R12. Ignora los lotes con stock 0. */
export function summarizeFinishedStock(
  batches: readonly { readonly stock: string; readonly packageContent: string | null }[],
): FinishedStockSummary;

/** R21. unitCost × quantity, BigInt, redondeo mitad arriba a 4 decimales. */
export function productionCostTotal(unitCost: string, quantity: string): string;

export type FinishedProductDetail = {
  readonly id: string;
  readonly name: string;
  readonly imagePath: string | null;
  readonly qtyAlert: string | null;
  readonly unit: { readonly id: string; readonly name: string; readonly symbol: string | null } | null;
  readonly presentation: {
    readonly id: string;
    readonly name: string;
    readonly content: string | null;
    readonly unit: { readonly id: string; readonly name: string; readonly symbol: string | null } | null;
  } | null;
  readonly stock: FinishedStockSummary;
};

export type FinishedProductBatchRow = {
  readonly id: string;
  readonly lot: string;
  readonly orderNumberText: string | null;   // null = «Sin pedido» (R13)
  readonly purchaseDate: string;             // YYYY-MM-DD
  readonly productionDate: string | null;
  readonly expiryDate: string | null;
  readonly packageContent: string | null;
  readonly stock: string;
  readonly packagedStock: PackagedQuantity | null;
  readonly createdAt: string;                // ISO
};

/** El tipo de asiento tal como está en el libro. Es `InventoryMovementView['kind']`. */
export type FinishedProductMovementKind = InventoryMovementView['kind'];
// = 'opening' | 'adjustment' | 'consumption' | 'production' | 'delivery' | 'delivery_void'

export type FinishedProductMovementRow = {
  readonly id: string;
  readonly kind: FinishedProductMovementKind;
  readonly batchId: string;
  readonly lot: string;
  readonly quantity: string;                  // valor absoluto (R17)
  readonly packaged: PackagedQuantity | null;
  readonly orderNumberText: string | null;
  readonly reason: MovementReason | null;
  readonly createdAt: string;
};

export type FinishedProductDeliveryRow = {
  readonly movementId: string;
  readonly orderDeliveryId: string;
  readonly createdAt: string;
  readonly customer: CustomerRef | null;      // de `clientes`: nombres, apellidos, isDeleted (R20)
  readonly orderNumberText: string | null;
  readonly batchId: string;
  readonly lot: string;
  readonly packages: number | null;           // null si la línea de entrega no vuelve del directorio
  readonly quantity: string;                  // valor absoluto
  readonly void: { readonly reason: string } | null;  // null: no anulada, o la línea no volvió (R33)
};

/** Total entregado del producto: solo las líneas no anuladas, de todas sus entregas (R34). */
export type DeliveredTotal = {
  readonly quantity: string;                  // decimal(14,4), unidad base; '0.0000' si no hay
  readonly packages: number;                  // entero >= 0
};

export type FinishedProductDeliveriesPage = Page<FinishedProductDeliveryRow> & {
  readonly delivered: DeliveredTotal;
};

export type FinishedProductCostRow = {
  readonly batchId: string;
  readonly lot: string;
  readonly orderNumberText: string | null;
  readonly quantity: string;                  // la del asiento production
  readonly packaged: PackagedQuantity | null;
  readonly unitCost: string | null;           // null solo en datos anteriores a R43 de QC-150
  readonly totalCost: string | null;          // null si unitCost es null
  readonly createdAt: string;
};

export type ProducedProductLink = {
  readonly orderId: string;
  readonly presentationId: string;
  readonly productId: string;
};

/** Hueco para `pedidos`: cliente, envases y anulación de las entregas, y el total entregado.
 *  Sin permisos: autoriza quien llama. */
export interface FinishedDeliveryDirectory {
  findDeliveryDetails(
    companyId: string,
    deliveryIds: readonly string[],
  ): Promise<ReadonlyMap<string, {
    readonly customerId: string;
    /** Clave: batchId. `(delivery_id, batch_id)` es único en `order_delivery_lines`. */
    readonly linesByBatch: ReadonlyMap<string, {
      readonly packages: number;
      readonly void: { readonly reason: string } | null;
    }>;
  }>>;
  /** Suma de cantidad y envases de las líneas de entrega de esos lotes SIN línea de anulación. */
  summarizeDelivered(companyId: string, batchIds: readonly string[]): Promise<DeliveredTotal>;
}
```

`FinishedProductMovementKind` se deriva de `InventoryMovementView['kind']` en vez de repetir la
lista: un tipo de asiento nuevo entra solo, y la UI lo etiqueta con un `Record` exhaustivo, así que el
`typecheck` obliga a ponerle etiqueta. `delivery_void` ya está en ese tipo desde QC-224.

`void` solo lleva el motivo porque es lo que pide la decisión del 2026-10-13. La fecha y el autor de la
anulación están en la tabla, pero la ficha no los muestra.

### 2.2 Puerto: `inventario/ports/finished-product-detail-repository.ts`

```ts
export type FinishedProductRecord = {
  readonly id: string;
  readonly name: string;
  readonly imagePath: string | null;
  readonly qtyAlert: string | null;
  readonly unitId: string | null;
  readonly presentation: { readonly id: string; readonly name: string; readonly content: string | null; readonly unitId: string | null } | null;
  readonly batches: readonly { readonly id: string; readonly stock: string; readonly packageContent: string | null }[];
};

export type PageRequest = { readonly page: number; readonly pageSize?: number };

export interface FinishedProductDetailRepository {
  /** Vivo, de la empresa y FINISHED_PRODUCT; si no, null (R5). */
  findAliveFinished(id: string, scope: InventoryScope): Promise<FinishedProductRecord | null>;
  /** `orderId` del asiento production, o null. Orden created_at desc, id desc. */
  listBatches(productId: string, page: PageRequest, scope: InventoryScope):
    Promise<Page<Omit<FinishedProductBatchRow, 'orderNumberText' | 'packagedStock'> & { readonly orderId: string | null }>>;
  /** 'in': quantity > 0; 'out': quantity < 0 (R18). quantity con signo. 'in' incluye delivery_void (R35). */
  listMovements(productId: string, direction: FinishedProductMovementDirection, page: PageRequest, scope: InventoryScope):
    Promise<Page<{ id; kind; batchId; lot; quantity; packageContent; orderId; reason; createdAt }>>;
  /** Asientos 'delivery' (orderDeliveryId no nulo), anulados o no. */
  listDeliveryMovements(productId: string, page: PageRequest, scope: InventoryScope):
    Promise<Page<{ id; orderDeliveryId; orderId; batchId; lot; quantity; createdAt }>>;
  /** Asientos 'production' con el unitCost y el packageContent de su lote. */
  listProductionCosts(productId: string, page: PageRequest, scope: InventoryScope):
    Promise<Page<{ batchId; lot; orderId; quantity; packageContent; unitCost; createdAt }>>;
  /** Por los asientos production de esos pedidos: (orderId, batch.presentationId, productId) con
   *  producto vivo FINISHED_PRODUCT. Distintos. */
  findProducedProducts(orderIds: readonly string[], scope: InventoryScope): Promise<readonly ProducedProductLink[]>;
}
```

(Los tipos de las filas en bruto se escriben completos en el archivo; aquí se abrevian.)

`scope` va siempre como último parámetro, como el resto del módulo.

### 2.3 Casos de uso (`inventario/domain/`)

Hay seis factorías. Las seis empiezan con `requirePermission(actor, 'inventario.consultar')` (R2, R3).
Las cinco de la ficha siguen con:

1. `id` con forma de uuid; si no, `ProductNotFoundError` (R5).
2. `products.findAliveFinished(id, scope)`; si devuelve `null`, `ProductNotFoundError` (R5).
3. Si es un listado, `pageSchema.safeParse(input)`; si falla, `ValidationError` (R23).

El paso 2 se repite en los listados, así que un listado nunca devuelve una página vacía para un
producto ajeno o borrado: responde lo mismo que General (R5, R25). Cuesta una consulta por clave
primaria.

| Archivo | Factoría | Firma | Dependencias |
|---|---|---|---|
| `get-finished-product.ts` | `createGetFinishedProduct` | `(id, actor) => Promise<FinishedProductDetail>` | `products`, `units: Pick<UnitCatalog,'findRefs'>` |
| `list-finished-product-batches.ts` | `createListFinishedProductBatches` | `(id, input, actor) => Promise<Page<FinishedProductBatchRow>>` | `products`, `orders: OrderNumberDirectory` |
| `list-finished-product-movements.ts` | `createListFinishedProductMovements` | `(id, input, actor) => Promise<Page<FinishedProductMovementRow>>`; `input` lleva `direction` | `products`, `orders` |
| `list-finished-product-deliveries.ts` | `createListFinishedProductDeliveries` | `(id, input, actor) => Promise<FinishedProductDeliveriesPage>` | `products`, `orders`, `deliveries: FinishedDeliveryDirectory`, `customers: Pick<CustomerCatalog,'findRefsIncludingDeleted'>` |
| `list-finished-product-costs.ts` | `createListFinishedProductCosts` | `(id, input, actor) => Promise<Page<FinishedProductCostRow>>` | `products`, `orders` |
| `list-produced-products.ts` | `createListProducedProducts` | `(orderIds: unknown, actor) => Promise<readonly ProducedProductLink[]>` | `products` |

Esquema de página, dentro de cada listado (el dominio no importa `lib/shared`):

```ts
z.strictObject({ page: z.number().int().min(1).default(1), pageSize: z.number().int().min(1).optional() })
// movimientos: .extend({ direction: z.enum(FINISHED_PRODUCT_MOVEMENT_DIRECTIONS) })
```

El adaptador aplica el defecto de 10 y el tope de 25 con `toOffsetLimit`, como los demás listados.

**Cómo se resuelven los nombres.** Mismo molde que `list-batch-movements.ts:60-93`: ids
deduplicados y una llamada por directorio y por página, nunca una por fila. Si un id no vuelve del
directorio, el número de pedido sale como `null` (marcador de ausencia) y la fila no desaparece.

**Entregas anuladas y total (R33, R34, R36).** `createListFinishedProductDeliveries`, después del
paso 3:
1. lee la página de `listDeliveryMovements`;
2. con la página, en un mismo `Promise.all`:
   - `deliveries.summarizeDelivered(companyId, record.batches.map((b) => b.id))`, con los lotes que
     ya trajo `findAliveFinished`. El total no depende de la página;
   - `deliveries.findDeliveryDetails`, una vez, con los ids de entrega de la página;
   - `orders.findNumberTexts`, una vez, con los ids de pedido de la página;
3. con los detalles, `customers.findRefsIncludingDeleted`, una vez, con los clientes de esas
   entregas.

> Enmienda 2026-10-13 (decisión del leader): esta sección decía a la vez que `summarizeDelivered` iba
> en paralelo con la página y que no se llamaba cuando la página trae `total: 0`. Las dos cosas no
> caben juntas; manda la segunda, que es lo que implementó B3. La página va primero y el resto sale
> de ella.

Cada fila
toma `packages` y `void` de `linesByBatch.get(batchId)`. Si la entrega o la línea no vuelve, salen
`packages: null` y `void: null` y la fila no desaparece. El caso de uso no filtra ni reordena por
`void`: una fila anulada ocupa su lugar en la página (R33). No hay más permiso que el del paso 0
(R36).

Si `listDeliveryMovements` devuelve `total: 0`, no se llama a `summarizeDelivered`: el tab muestra su
vacío (R24) y `delivered` vale `{ quantity: '0.0000', packages: 0 }`.

**`createListProducedProducts`** (R27–R29). `orderIds` se valida como
`z.array(z.string().uuid()).max(25)`, porque `MAX_PAGE_SIZE` es el tope de una página de pedidos.
Devuelve los enlaces de `findProducedProducts`. Si un `(orderId, presentationId)` aparece con más de
un `productId`, se omite: no se adivina cuál es el bueno. No mira el estado del pedido; ese filtro es
de quien llama, que es el único que lo conoce (§6.3).

### 2.4 Server Actions: `inventario/adapters/driving/finished-product-actions.ts` (nuevo)

Es un archivo `'use server'` nuevo. Va aparte de `product-actions.ts` para no crecer un archivo que ya
censan otras guardias.

```ts
export type FinishedProductResult = { status: 'success'; data: FinishedProductDetail } | ErrorState;
export async function getFinishedProductAction(id: string): Promise<FinishedProductResult>;
export async function listFinishedProductBatchesAction(id: string, input: unknown): Promise<PageResult<FinishedProductBatchRow>>;
export async function listFinishedProductMovementsAction(id: string, input: unknown): Promise<PageResult<FinishedProductMovementRow>>;
export async function listFinishedProductDeliveriesAction(id: string, input: unknown): Promise<{ status: 'success'; data: FinishedProductDeliveriesPage } | ErrorState>;
export async function listFinishedProductCostsAction(id: string, input: unknown): Promise<PageResult<FinishedProductCostRow>>;
export async function listProducedProductsAction(orderIds: readonly string[]): Promise<{ status: 'success'; data: readonly ProducedProductLink[] } | ErrorState>;
```

Cada una resuelve el actor con `identity.getSessionUser()` una sola vez por petición. Los errores
pasan por `createErrorStateTranslator`, como en `product-actions.ts`.

### 2.5 Códigos de error

No hay códigos nuevos. Se reusan `product_not_found` (R5), `unauthorized` (R2) e `invalid_input`
(R23).

### 2.6 Fixtures (T0)

`tests/fixtures/finished-product-detail.ts` incluye:
- `finishedProductDetail(overrides)`, con dos contenidos de envase y un lote sin contenido;
- una fila de muestra de cada tipo, con una de movimiento `delivery_void` y una fila de entrega
  anulada (`void: { reason }`) junto a otra no anulada de la misma entrega;
- `finishedProductDeliveriesPage(overrides)`, con su `delivered`;
- `FINISHED_PRODUCT_ERROR_STATES`, con `product_not_found`, `unauthorized` e `invalid_input`.

## 3. Modelo de datos, RLS y migraciones

- **Tablas:** ninguna nueva. **Columnas:** ninguna. **Migraciones:** ninguna (R32, decisión
  [Lote→orden] «sin migración nueva»).
- **RLS:** sin cambios. Las tablas que se leen ya tienen `ENABLE` y `FORCE`. La frontera es el permiso
  en el caso de uso más el ámbito de empresa en cada consulta (`docs/architecture.md > Acceso a datos
  y autorizacion`).
- **Índices que usan las consultas**, todos existentes (`db/schema.prisma`):
  - `product_batches_product_id_idx`;
  - `inventory_movements_batch_id_idx`;
  - `inventory_movements_order_id_idx`, para `findProducedProducts`;
  - `order_delivery_lines_delivery_batch_unique` y `order_deliveries_id_company_id_key`, para el
    directorio de entregas;
  - `order_delivery_void_lines_delivery_line_unique`, para saber si una línea está anulada (la
    relación `voidLine` es uno a uno), y `order_delivery_lines_batch_id_idx`, para
    `summarizeDelivered`. Los dos ya están en `db/schema.prisma` (`:876` y `:837`).

  No hace falta uno nuevo para el volumen actual. Si el plan de consulta del test de integración
  mostrara un barrido secuencial sobre `inventory_movements`, se anota como hallazgo y no se crea en
  esta ficha (R32).

## 4. Adaptadores driven

### 4.1 `inventario/adapters/driven/persistence/finished-product-detail-prisma.ts` (nuevo)

Solo lectura y sobre el cliente global. Usa los envoltorios de `company-scope.ts` (`productCompanyScope`,
`batchCompanyScope` y `movementCompanyScope`) en cada tabla, y nunca escribe
`companyId: scope.companyId` a mano. Eso lo vigila `tests/unit/inventario/company-scope.test.ts:123`.

- `findAliveFinished`: `product.findFirst` con `id`, `deletedAt: null`, `type: 'FINISHED_PRODUCT'` y
  la empresa. Selecciona la presentación fija (`presentationId`, con su nombre, contenido y unidad
  por una segunda consulta a `presentation` en la misma empresa, porque `Product` no tiene
  `@relation` con `Presentation`) y `stock` y `packageContent` de todos sus lotes.
- `listBatches`: `productBatch.findMany` del producto, en la empresa, con `orderBy [{createdAt:'desc'},{id:'desc'}]`
  y `skip`/`take` de `toOffsetLimit`, más un `count`. El `orderId` sale de su asiento `production`
  (`movements: { where: { kind: 'production' }, select: { orderId }, take: 1 }`). Enmienda 2026-10-13, tras la revisión: con
  `orderBy: [{ createdAt: 'asc' }, { id: 'asc' }]`, porque un solo asiento `production` por lote es
  un invariante de la escritura y no una restricción de la base; así el resultado es determinista.
- `listMovements`: `inventoryMovement.findMany` con `batch: { productId, …empresa }`,
  `quantity: { gt: 0 }` o `{ lt: 0 }` según `direction` (R18), el mismo orden y `count`. El lote, su
  `lot` y su `packageContent` salen por la relación `batch`, que es del mismo módulo.
- `listDeliveryMovements`: igual, con `orderDeliveryId: { not: null }`. El CHECK
  `inventory_movements_order_delivery_id_matches_kind` ata esa columna a `kind = 'delivery'`.
- `listProductionCosts`: igual, con `kind: 'production'`, y `unitCost` y `packageContent` del lote.
- `findProducedProducts`: `inventoryMovement.findMany` con `kind: 'production'`,
  `orderId in (…)`, en la empresa, y `batch.product` vivo y `FINISHED_PRODUCT`. Proyecta
  `(orderId, batch.presentationId, batch.productId)` sin repetidos. El lote de producción lleva la
  presentación de su línea (QC-150 R13), y `(order_id, presentation_id)` es único en
  `order_presentation_lines` (`schema.prisma:774`). Así que la clave identifica la línea sin leer
  tablas de `pedidos`.

Las cantidades salen con `toFixed(4)` en el adaptador, como `toBatchView`. El dominio solo ve texto.

### 4.2 `pedidos/adapters/driven/persistence/order-delivery-directory-prisma.ts` (nuevo)

Implementa `FinishedDeliveryDirectory` con el molde de `order-number-directory-prisma.ts`:

```ts
export async function findDeliveryDetailsByIds(companyId: string, deliveryIds: readonly string[]):
  Promise<ReadonlyMap<string, { customerId: string; linesByBatch: ReadonlyMap<string, { packages: number; void: { reason: string } | null }> }>>;
export async function summarizeDeliveredByBatchIds(companyId: string, batchIds: readonly string[]):
  Promise<DeliveredTotal>;
```

- `findDeliveryDetailsByIds` hace un `orderDelivery.findMany` con `id in (…)` y la empresa, y
  `lines: { where: columnas, select: { batchId, packages, voidLine: { select: { void: { select: { reason } } } } } }`.
  Es la misma relación y el mismo filtro que ya usa `listOrderDeliveryHistory`
  (`order-delivery-void-prisma.ts:135-141`), sin `createdBy` ni `createdAt` del `void`. Si no recibe
  ids, no consulta.
- `summarizeDeliveredByBatchIds` hace un `orderDeliveryLine.aggregate` con `batchId in (…)`, la
  empresa, `voidLine: { is: null }` y `_sum: { quantity, packages }`. Devuelve
  `quantity.toFixed(4)` y `packages`, y un `null` del `_sum` vale cero. Si no recibe lotes, devuelve
  `{ quantity: '0.0000', packages: 0 }` sin consultar.

Las dos leen solo tablas de `pedidos` (`order_deliveries`, `order_delivery_lines`,
`order_delivery_void_lines`, `order_delivery_voids`). Los ids de lote llegan como valores, sin JOIN a
`product_batches`. El ámbito sale de `pedidos/.../company-scope.ts` (`companyScopeColumns`).

La anulación es por línea de entrega, y cada fila de Entregas es una línea (un lote de una entrega).
Por eso la marca se resuelve fila a fila sin agrupar por presentación, y una entrega con una
presentación anulada y otra no muestra filas de los dos tipos (R33).

### 4.3 `lib/composition/index.ts`

- `const finishedDeliveryDirectory: FinishedDeliveryDirectory = { findDeliveryDetails: findDeliveryDetailsByIds, summarizeDelivered: summarizeDeliveredByBatchIds }`,
  declarado antes de la fachada de `inventario`, junto a `orderNumberDirectory`. El motivo es el
  mismo que explica el comentario de `index.ts:910-913`.
- `const finishedProductDetailRepository: FinishedProductDetailRepository = { … }`.
- La fachada `inventario` gana seis claves al final: `getFinishedProduct`,
  `listFinishedProductBatches`, `listFinishedProductMovements`, `listFinishedProductDeliveries`,
  `listFinishedProductCosts` y `listProducedProducts`.
- `customers` se cablea como en `index.ts:2223`:
  `(ids, companyId) => findCustomerRefsIncludingDeleted(ids, { companyId })`. `units` se cablea con
  `findUnitRefs`. Los dos ya se importan en `composition` (`index.ts:163`, `:539`).

## 5. Rutas

- `lib/shared/routes.ts` gana `finishedProductDetailRoute(id: string): string` →
  `` `${INVENTORY_ROUTE}/producto-terminado/${id}` `` (R30). `PRIVATE_ROUTE_PREFIXES` no cambia,
  porque `INVENTORY_ROUTE` ya cubre el subcamino por segmentos. El segmento `producto-terminado` es
  estático y no choca con `importar`.
- La página es `app/(private)/inventario/producto-terminado/[id]/page.tsx`.
- **Estado en la dirección (R9):** `?tab=<general|stock|lotes|entradas|salidas|entregas|costo>&page=N&pageSize=M`.
  Lo parsea `finished-product-params.ts`. Un `tab` desconocido o ausente vale `general`. `page` y
  `pageSize` solo se leen en los tabs de listado, y su saneo es el de `product-list-params.ts`: un
  valor que no es entero cae al defecto en la pantalla. Al cambiar de tab, el enlace se construye
  sin `page`.
- **Enmienda 2026-10-16 (R37; `b0eaa866`, `6a665e3f`).** La página calcula `canViewUnitCosts` con la
  sesión y lo baja como `canViewCosts` a `FinishedProductTabs`; sin él, el tab `costo` no se pinta y
  `resolveFinishedProductTab` lo cambia por `general` antes de pedir datos. `listFinishedProductCosts`
  exige `canViewUnitCosts` además de `inventario.consultar` y responde `unauthorized` sin tocar
  puertos. Es presentación más autorización en el caso de uso: el permiso decide, no el rol.

## 6. UI

> 2026-10-13: pase /design aprobado por el humano. Los tableros aprobados, copiados a la rama de la
> ficha (`docs/diseno/README.md > Flujo /design`, pasos 4 y 5), son la referencia visual de esta
> sección (canvas https://claude.ai/artifact/Voiri77bod5p5EuzCUkPaq):
> - ficha de producto terminado (§6.1–§6.3): `docs/diseno/canvas/ProductoTerminado.dc.html`,
>   `docs/diseno/canvas/ProductoTerminadoTablet.dc.html` y
>   `docs/diseno/canvas/ProductoTerminadoMovil.dc.html`;
> - presentaciones producidas en /pedidos (§6.4): `docs/diseno/canvas/PedidosPresentaciones.dc.html`,
>   `docs/diseno/canvas/PedidosPresentacionesTablet.dc.html` y
>   `docs/diseno/canvas/PedidosPresentacionesMovil.dc.html`.
>
> La aprobación cubre también los puntos «Por confirmar» de los tableros tal como están
> implementados: no hay cambios de UI. Ninguna pieza de esta feature entra en
> `components/shared/CATALOGO.md`: todas viven en `app/` (ruta de la ficha y
> `app/(private)/pedidos/components/`), fuera de las tres tablas del catálogo, así que el paso 6 del
> flujo no aplica.

### 6.1 Página `app/(private)/inventario/producto-terminado/[id]/page.tsx`

Es un Server Component con el molde de `proveedores/[id]/page.tsx`:

1. `await requirePagePermission('inventario.consultar')` es la primera línea (R1).
2. Resuelve `params` y `searchParams` y llama a `getFinishedProductAction(id)`.
3. Despacha:
   - `product_not_found` (comparado con `'product_not_found' satisfies ErrorCode`, como
     `guard-catalogo-de-errores` exige) → `FinishedProductNotFound`;
   - otro error → `ErrorState` sin datos (R6);
   - éxito → cabecera con el nombre, `FinishedProductTabs` y, dentro del tab activo, su contenido.
4. General y Stock se pintan con el `FinishedProductDetail` ya leído. Los tabs de listado montan, bajo
   `<Suspense>`, una sección de servidor que pide SOLO el listado del tab activo.

El contenedor exterior es un `div` sin `main` (R5 de QC-11).

### 6.2 Componentes (`app/(private)/inventario/producto-terminado/[id]/components/`)

| Archivo | Qué hace | `data-testid` principales |
|---|---|---|
| `finished-product-not-found.tsx` | Estado «producto no encontrado», con enlace a `productListHref` con el filtro de tipo `FINISHED_PRODUCT` (R6) | `finished-product-not-found`, `finished-product-back` |
| `finished-product-header.tsx` | Nombre e imagen | `finished-product-name` |
| `finished-product-tabs.tsx` | `UrlTabs` con los siete disparadores en orden, que navegan cambiando `tab` en la dirección (R8, R9). Enmienda 2026-10-13: decía «Cliente. `Tabs`»; el catálogo remite a `UrlTabs` para sincronizar con la URL | `finished-product-tab-<tab>` |
| `finished-product-general.tsx` | R10 | `finished-product-general` |
| `finished-product-stock.tsx` | R11, R12 | `finished-product-stock-total`, `finished-product-stock-packages`, `finished-product-stock-unpackaged` |
| `finished-product-list-section.tsx` | Servidor. Pide el listado del tab activo y despacha a vacío (R24), error o tabla | `finished-product-<tab>-empty`, `finished-product-<tab>-error` |
| `finished-product-batches-table.tsx` | Lotes (R13) | `finished-product-batch-row` |
| `finished-product-movements-table.tsx` | Entradas o Salidas según `direction` (R15–R17); etiqueta del origen con un `Record<FinishedProductMovementKind, string>` exhaustivo | `finished-product-movement-row`, `finished-product-movement-origin` |
| `finished-product-deliveries-table.tsx` | Entregas (R19, R20). Una fila anulada lleva la marca «Anulada» y su motivo, y `data-voided="true"` (R33). Encima de la tabla, el total entregado de `delivered`, en unidad base y en envases (R34) | `finished-product-delivery-row`, `finished-product-delivery-customer`, `finished-product-delivery-void`, `finished-product-deliveries-total` |
| `finished-product-costs-table.tsx` | Costo de producción (R21) | `finished-product-cost-row` |
| `finished-product-params.ts` | Parseo y enlaces de tab y página (R9) | — |
| `index.ts` | Barrel de la ruta | — |

Etiquetas de origen (R16, R17):
- `production`: «Producción», con el número de pedido;
- `opening`: «Apertura (alta o importación)»;
- `adjustment`: «Ajuste», con `movementReasonLabel(reason)`;
- `delivery`: «Entrega a cliente»;
- `delivery_void`: «Anulación de entrega», con el número de pedido (R35). Es el mismo texto que
  `KIND_LABELS` de `batch-history.tsx:40`;
- `consumption`: «Consumo».

El `Record` de etiquetas es propio de la tabla y no reutiliza `movementKindLabel` de
`batch-history.tsx`: su dominio es `BatchHistoryEntry['kind']`, que mezcla el libro de reservas, y sus
textos de `opening` («Apertura») y `consumption` («Salida por entrega») no son los de R16.

`movementReasonLabel` se importa del barrel de `app/(private)/inventario/components/`
(`index.ts`). Enmienda 2026-10-13: vivía en `batch-history.tsx`, un módulo `'use client'`, y la
sección de la ficha, que es de servidor, no podía llamarla; pasó a
`app/(private)/inventario/components/movement-reason-label.ts`, con el mismo nombre y la misma
salida, y `batch-history.tsx` y `adjust-batch-dialog.tsx` solo cambian el import.

Las tablas usan `DataTable` con paginación por servidor, con el molde de `finished-stock-table.tsx`.
Sin filtros ni orden: el orden es fijo (R23). Las cantidades y los importes se muestran con
`trimDecimal` (`lib/shared/ui/decimal-display`), sin pasar por `number`.

**Sin escritura (R7, R36):** ningún archivo de la ruta importa `product-actions.ts`,
`batch-actions.ts`, `pedidos/adapters/driving/order-actions.ts` (donde vive `voidDeliveryAction`) ni
ninguna action de escritura. Lo vigila el contrato de §7.

### 6.3 Enlace desde /inventario (R26)

`app/(private)/inventario/components/finished-stock-columns.tsx:162`: el `span`
`finished-stock-line-name` pasa a ser un `Link` de `next/link` a
`finishedProductDetailRoute(item.line.product.id)`, con `data-testid="finished-stock-line-link"`.
La fila de grupo (`finished-stock-name`) no cambia, porque nombra un pedido o un grupo y no un
producto.

### 6.4 Enlace desde /pedidos (R27–R29)

- `order-list-section.tsx`: después de `listOrdersAction`, y en el mismo `Promise.all` que
  responsables y cobertura, hace `loadProducedProducts(ids)` con los ids de los pedidos de la página
  en `TERMINADO` o `ENTREGADO`. Si no hay ninguno, no llama. Llama a `listProducedProductsAction`; si
  responde error (`unauthorized` incluido), devuelve `{}` y la lista se pinta igual (R29). Baja a la
  tabla un `Record<orderId, Record<presentationId, productId>>` plano y serializable.
- `order-table.tsx` y `order-columns.tsx` pasan el prop `producedProductsByOrder` (opcional, `{}` por
  defecto).
- En la columna «Presentación» (`order-columns.tsx:255`): si el pedido está `TERMINADO` o `ENTREGADO`
  y tiene alguna entrada en el mapa, la celda pinta `OrderProducedPresentations`. Si no, sigue
  pintando `OrderDistributionLabel` sin cambios (R28). Así no se toca el componente compartido, que
  también usa `/asignacion`.
- `order-produced-presentations.tsx` (nuevo, cliente): misma forma visual que
  `OrderDistributionLabel`, es decir, la primera línea y «+N».
  - Cada nombre con producto en el mapa es un `Link` a `finishedProductDetailRoute(productId)`
    (`data-testid="order-produced-product-link"`, `data-presentation-id`).
  - «+N» es el disparador de un `Popover` (`components/ui/popover.tsx`) que lista todas las líneas,
    con sus enlaces (R27).
  - Los nombres sin producto se pintan como texto.

**Regla de decisión (enmienda 2026-10-13, tras la revisión).** `OrderProducedPresentations` aplica el
**paso 3, componer**: arma la celda con `OrderDistributionLabel` (para el reparto vacío),
`orderDistributionLineText`, `Link`, `Button` y `Popover`, sin copiar su lógica.

Por qué no el paso 2 (extender `OrderDistributionLabel` con una prop opcional): el spec solo daba
«así no se toca el componente compartido», y eso no basta, porque el paso 2 permite tocarlo si los
consumidores no cambian. Lo que el código muestra:
- `components/shared/order-distribution-label.tsx` no lleva `'use client'`, y el `Popover` del «+N» lo
  necesita: la extensión convertiría en módulo de cliente la etiqueta que también pintan
  `/asignacion` (`assignment-list-parts.tsx`, `order-distribution-full.tsx`) y
  `/asignacion/[id]` (`order-execution-screen.tsx`);
- su fila de `components/shared/CATALOGO.md` dice «No cubre: la lista desplegada».

**Cerrado (2026-10-13, decisión del humano con el pase /design de esta celda):** se acepta el paso 3
(componer `OrderProducedPresentations`) en lugar de extender `OrderDistributionLabel`, porque la
etiqueta es un componente de servidor que usan tres archivos de /asignacion y su fila del catálogo
dice «No cubre: la lista desplegada». Tablero de la celda:
`docs/diseno/canvas/PedidosPresentaciones.dc.html` (más sus variantes `Tablet` y `Movil`).

## 7. Censos, guardias y llamadores afectados

Cada enmienda conserva las aserciones previas y lleva una nota fechada.

| Archivo | Qué censa | Cambio | Task |
|---|---|---|---|
| `tests/unit/inventario/schema/inventario-schema.test.ts:744` | factorías del barrel (18) | + las seis de §2.3 → 24 | T0 |
| `tests/unit/inventario/product-route-contract.test.ts:111` | todos los fuentes bajo `app/(private)/inventario` salvo `importar/` | excluye también el prefijo `producto-terminado/`, que tiene su contrato propio (como `importar/`). Hace falta porque las prohibiciones de ese archivo (`toFixed(`, `filter(`, `'cost'`) son de la pantalla de catálogo | F1 |
| `tests/unit/inventario/producto-terminado/finished-product-route-contract.test.ts` (nuevo) | contrato de la ruta nueva | `requirePagePermission('inventario.consultar')` como primera línea (R1); ningún import de action de escritura, `order-actions` incluido (R7, R36); ninguna URL literal (R30); sin `main`/layout propio; componentes por el barrel | F1 |
| `tests/guards/guard-pantallas-exigen-permiso.test.ts:261` | `RUTAS_ESPERADAS_HOY` (25) | + `/inventario/producto-terminado/[id]` → 26, con nota fechada | F1 |
| `tests/guards/guard-identificador-de-request.test.ts:57` | `E2E_ESPERADOS` | + `detalle-de-producto-terminado.spec.ts` | TI |
| `tests/unit/identity/session-once-per-request-actions.test.ts:165` | `ACCIONES`, una fila por archivo driving | + fila de `finished-product-actions.ts` (`getFinishedProductAction`) | B3 |
| `tests/integration/aislamiento.json` | modo de aislamiento por suite | + cada `.int.test.ts` nueva | B1, B2 |
| `tests/unit/inventario/company-scope.test.ts` | ámbito por envoltorio | verificar con el adaptador nuevo; enmendar solo si un caso lo exige | B1 |
| `tests/guards/guard-arquitectura-modulos.test.ts` (bloque 15) | ciclos entre módulos | sin cambio: la arista `inventario → clientes` no cierra ciclo (verificar) | TC |
| `tests/guards/guard-pantalla-pedidos-se-amplia.test.ts` | anclas del barrel de /pedidos | sin cambio: solo se añaden exportaciones (verificar) | TC |
| `tests/guards/guard-dependencias-aprobadas.test.ts` | `package.json` | sin cambio (R32) | TC |

Enmienda 2026-10-13, tras la revisión: censos que la implementación tocó y que esta tabla no preveía.

| Archivo | Qué censa | Cambio | Task |
|---|---|---|---|
| `tests/unit/inventario/schema/inventory-movements-migration.test.ts` | operaciones de Prisma sobre `inventoryMovement` (solo altas y lecturas) | + `count`, de lectura, para paginar (R23); la intención sigue: ninguna operación que modifique | revisión |
| `tests/unit/pedidos/order-delivery-append-only.test.ts` | ningún nombre exportado que anule o edite entregas | sin cambio en el censo: la constante de la marca «Anulada» se llama `DELIVERY_VOIDED_LABEL` para no casar con el patrón | revisión |
| `tests/unit/inventario/scope.test.ts` | pantallas de catálogo de presentaciones y lista de specs E2E | excluye por nombre `order-produced-presentations.tsx`; + el E2E nuevo | TC, TI |
| `tests/unit/recetas-ui/recipe-route-contract.test.ts` | lista exacta de exportaciones de `lib/shared/routes.ts` | + `finishedProductDetailRoute` | TC |
| `tests/unit/clientes/scope.test.ts` | lista cerrada de E2E que siembran clientes con la normalización de `@/lib/modules/clientes` | + `detalle-de-producto-terminado.spec.ts` | TI |
| `tests/unit/shared/data-table-alcance.test.ts` | E2E que usan `data-table-row-` | + `detalle-de-producto-terminado.spec.ts` | TI |
| `tests/unit/pedidos/module-contract.test.ts` | quién abre el cliente Prisma en `pedidos` | + `order-delivery-directory-prisma.ts` | B2 |
| `tests/unit/pedidos-ui/order-list-section.test.tsx`, `tests/unit/pedidos-ui/pedidos-viewport.test.tsx`, `tests/unit/pedidos-ui/order-sheet.test.tsx`, `tests/unit/paridad/pedidos-paridad.test.tsx` | suites de /pedidos con `@/lib/composition` sustituido por un doble que solo trae `identity` | + un doble de `finished-product-actions` (`listProducedProductsAction` sin enlaces), porque esa action lee `observabilidad` al cargarse | F4 |

Llamadores de tipos que cambian: ninguno. Todos los tipos son nuevos, y `OrderView` y `ProductView`
no cambian.

## 8. Seguridad y rendimiento

- **Oráculo de existencia:** las cinco lecturas de la ficha responden `product_not_found` igual para
  ajeno, borrado, inexistente, no terminado o id sin forma de uuid (R5). Es el criterio de
  `get-product.ts:17-22`.
- **N+1:** cada listado hace una consulta de página más un `count`, y una llamada por directorio y
  página. /pedidos añade una sola llamada por página, con 25 ids como máximo.

## 9. Alternativas descartadas

- **A1 — Reutilizar `createGetProduct` y `createListProductBatches`.** `getProduct` no filtra por
  tipo, así que la ficha abriría insumos, en contra de «Lo que NO entra» y de R5. Añadirle un filtro
  cambiaría su contrato para el panel de /inventario. `listProductBatches` devuelve lista vacía para
  el producto ajeno (contrario a R5), no pagina (R23) y no trae el pedido de origen (R13).
- **A2 — Un solo caso de uso que devuelva la ficha entera con los siete tabs.** Leería cinco
  historiales en cada visita, sin paginar cada uno por separado, y una página de un tab arrastraría
  las de los demás. Con un listado por tab, cada carga paga solo lo que se ve.
- **A3 — Leer `order_deliveries`, `orders` y `customers` con JOIN desde el adaptador de
  `inventario`.** Sería una segunda excepción a «cada módulo lee sus tablas». La primera se aprobó
  solo para `listStockGroups` (`finished-stock-prisma.ts:18-23`), porque allí se ordena y se busca
  por columnas de otros módulos. Aquí el orden es por fecha del asiento, que es de `inventario`, así
  que los directorios por página bastan.
- **A4 — Resolver el enlace de /pedidos dentro de `listOrders`.** Añadiría una dependencia
  obligatoria a `ListOrdersDeps`. Tests que la construyen: 12 archivos, 55 llamadas a
  `createListOrders` (Grep). Además, el enlace dependería de `pedidos.consultar` y no de
  `inventario.consultar`. Compuesto en la pantalla, con el mismo patrón que responsables y cobertura
  (`order-list-section.tsx:153-194`), el permiso lo aporta el caso de uso de `inventario` (R29) y
  `pedidos` no cambia.
- **A5 — Reutilizar la lista de entregas de QC-224 (`list-order-deliveries.ts`,
  `order-delivery-list.tsx`).** *(Revisada el 2026-10-13 con QC-224 en `dev`: sigue descartada.)*
  - `createListOrderDeliveries` exige `pedidos.consultar` (`list-order-deliveries.ts:160`). La decisión
    [Permiso] y R4/R36 dicen que Entregas no lo exige.
  - Es por pedido: recibe UN `orderId`. La ficha cruza todos los pedidos que entregaron el producto, y
    tendría que llamarla una vez por pedido, sin paginar y leyendo las entregas de otros productos.
  - Agrupa por presentación y suma envases. La ficha muestra una fila por lote (R19).
  - `inventario` no puede importar `pedidos`, porque se cerraría el ciclo (§1). Además
    `OrderDeliveryHistoryReader` no está en el barrel de `pedidos`, y su único método es `listByOrder`.
  - `order-delivery-list.tsx` lleva la acción «Anular». La ficha es de solo consulta (R7, R36).

  **Lo que sí se reutiliza de QC-224:** su modelo de datos y la forma de leerlo. El adaptador de
  `pedidos` de §4.2 lee la anulación por la misma relación `voidLine.void` que
  `listOrderDeliveryHistory`, dentro de `pedidos`. Lo más barato habría sido añadir un método por ids
  a `OrderDeliveryHistoryReader`. No sale más barato: haría falta el mismo adaptador nuevo, y ese
  puerto quedaría con dos formas de fila para dos pantallas. El hueco `FinishedDeliveryDirectory` ya
  estaba en el diseño y crece en un campo y un método.
- **A9 — Saber si una fila está anulada por el libro de `inventario`.** Se buscaría un asiento
  `delivery_void` del mismo lote. No se puede hacer bien:
  - el asiento `delivery_void` no lleva `orderDeliveryId`, solo `orderDeliveryVoidId`
    (CHECK `inventory_movements_order_delivery_void_id_matches_kind`);
  - atarlo a su entrega exige leer `order_delivery_voids.delivery_id`, una tabla de `pedidos`, desde el
    adaptador de `inventario`, que es la excepción que A3 descarta;
  - emparejar por `(orderId, batchId)` falla cuando un pedido tiene dos entregas del mismo lote y solo
    una se anula;
  - el motivo solo vive en `order_delivery_voids.reason`, porque el asiento lleva `reason: null`.
- **A10 — Total entregado como `|Σ delivery| − Σ delivery_void` sobre `inventory_movements`.** Daría la
  cantidad sin salir de `inventario`, pero no los envases, que están solo en `order_delivery_lines`.
  Habría dos fuentes para un mismo hecho («qué está anulado»): el libro para el total y
  `order_delivery_void_lines` para la marca. Una fila marcada y un total que no la descuenta podrían
  divergir. Con `summarizeDelivered` las dos cosas salen de la misma tabla.
- **A6 — Clasificar Entradas y Salidas por tipo de asiento.** Una lista de tipos por tab se rompería
  con cada tipo nuevo (`delivery_void` de QC-224) y con el ajuste, que puede ir en los dos sentidos.
  El signo es lo que la decisión dice: «lo que sumó» y «lo que restó» (R18).
- **A7 — Ruta `/inventario/[id]`.** Abriría la puerta a fichas de cualquier tipo, que es lo que «Lo
  que NO entra» excluye, y compartiría nivel con el estático `importar`. `producto-terminado/[id]`
  dice lo que es.
- **A8 — Pedir el nombre de la receta en General.** Ver §1: `recetas → inventario` ya existe, y lo
  exigiría un hueco más. Ninguna decisión lo pide.

## 10. Trazabilidad prevista (R → test)

Rutas abreviadas:
- **u:** `tests/unit/inventario/`
- **ui:** `tests/unit/inventario-ui/`
- **pui:** `tests/unit/pedidos-ui/`
- **int:** `tests/integration/inventario/` (o `pedidos/`)
- **e2e:** `e2e/detalle-de-producto-terminado.spec.ts`

| R | Test previsto |
|---|---|
| R1 | u `producto-terminado/finished-product-route-contract.test.ts`; e2e (usuario sin permiso → 404) |
| R2, R3 | u de cada caso de uso (`get-finished-product.test.ts`, `list-finished-product-*.test.ts`, `list-produced-products.test.ts`): sin permiso, ningún puerto se llama; actor con el permiso y otro rol, aceptado; Administrador sin él, rechazado |
| R4 | u `list-finished-product-deliveries.test.ts` (actor solo con `inventario.consultar`); u `list-finished-product-costs.test.ts` › «R4: con inventario.consultar y canViewUnitCosts, sin recetas ni pedidos, ve el costo y el pedido» (enmendado el 2026-10-16) |
| R37 (2026-10-16) | u `list-finished-product-costs.test.ts` › «solo el Administrador ve costos: con inventario.consultar sin canViewUnitCosts responde unauthorized y no llama a ningun puerto»; u `unit-cost-visibility.test.ts` › «canViewUnitCosts: quien ve los costos unitarios»; ui `finished-product-tabs.test.tsx` › «sin `canViewCosts` (cualquier rol que no sea el Administrador) falta «Costo de produccion»» |
| R8/R9, enmienda 2026-10-16 | ui `finished-product-tabs.test.tsx` › ««costo» sin permiso abre el tab por defecto; con permiso, el propio» y «el resto de tabs no dependen del permiso de costos»; ui `finished-product-page.test.tsx` › «el tab «Costo de produccion» lo ve el Administrador y lo abre con `?tab=costo`» y «sin permiso de costos falta el tab, y `?tab=costo` cae al tab por defecto sin pedir costos» |
| R5 | u de cada caso de uso (id sin uuid, `null` del puerto); int `finished-product-detail.int.test.ts` (borrado, empresa B, insumo) |
| R6 | ui `finished-product-page.test.tsx` |
| R7 | u `producto-terminado/finished-product-route-contract.test.ts` |
| R8, R9 | ui `finished-product-tabs.test.tsx`, `finished-product-params.test.ts` |
| R10 | u `get-finished-product.test.ts`; ui `finished-product-page.test.tsx` |
| R11, R12 | u `finished-product-detail.test.ts` (`summarizeFinishedStock`, tabla de casos); ui `finished-product-page.test.tsx` |
| R13, R14 | u `list-finished-product-batches.test.ts`; int `finished-product-detail.int.test.ts` (lote con y sin asiento production, pedido borrado) |
| R15–R18 | u `list-finished-product-movements.test.ts`; int `finished-product-detail.int.test.ts` (ajuste +/−, apertura, producción, entrega); ui `finished-product-tables.test.tsx` |
| R19, R20 | u `list-finished-product-deliveries.test.ts`; int `pedidos/order-delivery-directory.int.test.ts`; ui `finished-product-tables.test.tsx` |
| R21, R22 | u `finished-product-detail.test.ts` (`productionCostTotal`); u `list-finished-product-costs.test.ts`; int `finished-product-detail.int.test.ts` |
| R23 | u de cada listado (`invalid_input`); int `finished-product-detail.int.test.ts` (orden, defecto 10, tope 25) |
| R24 | ui `finished-product-tables.test.tsx` |
| R25 | int `finished-product-detail.int.test.ts` y `pedidos/order-delivery-directory.int.test.ts` (empresa B) |
| R26 | u `finished-stock-table.test.tsx` |
| R27, R28 | u `list-produced-products.test.ts`; int `finished-product-detail.int.test.ts` (`findProducedProducts`); pui `order-produced-presentations.test.tsx`, `order-columns.test.tsx` |
| R29 | pui `order-list-section-produced.test.tsx` (action en error → sin enlaces, lista intacta) |
| R30 | u `producto-terminado/finished-product-route-contract.test.ts`; u `product-route-contract.test.ts` (el literal de ruta solo vive en `routes.ts`) |
| R31 | e2e |
| R32 | `tests/guards/guard-dependencias-aprobadas.test.ts`; `tests/guards/guard-identificador-de-request.test.ts` (`MIGRACIONES_ESPERADAS` sin cambios) |
| R33 | u `list-finished-product-deliveries.test.ts` (el `void` del directorio llega a la fila; la fila anulada no se filtra ni se mueve); int `pedidos/order-delivery-directory.int.test.ts` (entrega con una presentación anulada y otra no); ui `finished-product-tables.test.tsx` |
| R34 | u `list-finished-product-deliveries.test.ts` (`summarizeDelivered` con todos los lotes del producto, sea cual sea la página; sin filas no se llama); int `pedidos/order-delivery-directory.int.test.ts` (excluye las líneas anuladas, todas anuladas → cero, lotes vacíos → sin consulta, empresa B); ui `finished-product-tables.test.tsx` |
| R35 | u `list-finished-product-movements.test.ts` (`delivery_void` con su pedido en `in`); int `finished-product-detail.int.test.ts` (el `delivery_void` sale en Entradas y la entrega sigue en Salidas); ui `finished-product-tables.test.tsx` (etiqueta «Anulación de entrega») |
| R36 | u `list-finished-product-deliveries.test.ts` (actor solo con `inventario.consultar` recibe `void` y `delivered`); u `producto-terminado/finished-product-route-contract.test.ts` (ningún import de `order-actions`) |

## 11. Dependencias, integraciones y choques en vuelo

- **Dependencias:** ninguna (R32). `next/link`, `Tabs`, `Popover` y `DataTable` ya están en el repo.
- **Integraciones externas:** ninguna.
- **Choque de archivos con QC-224: ya no aplica (2026-10-13).** QC-224 está mergeada en `dev`, y esta
  rama la trae (merge `753635f7`). Ya no está en vuelo, así que `scripts/archivos-en-vuelo.mjs` no la
  cuenta. Los archivos compartidos se editan sobre el estado que dejó QC-224. Lo que pedía la
  sincronización ya está en este spec:
  - `delivery_void` entra en `FinishedProductMovementKind` por derivación, con su etiqueta (§2.1, §6.2);
  - P2 está cerrada (R33–R36).
- **Censos que QC-224 pudo mover:** la guardia de fábricas de `inventario-schema.test.ts` sigue en 18
  en esta rama (QC-224 no publicó fábricas en `inventario`), así que el salto a 24 de §7 vale. Las
  cuentas de `RUTAS_ESPERADAS_HOY`, `E2E_ESPERADOS`, `ACCIONES` y `aislamiento.json` se toman de esta
  rama al editar, no de las cifras de este documento.
