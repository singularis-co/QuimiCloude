# QC-225 — detalle-de-producto-terminado · design.md

> Zona fullstack · Complejidad medium · Requisitos en `requirements.md` (R1–R32; P1 y P2 abiertas, no
> bloquean). Solo lectura: sin tablas, sin migraciones y sin dependencias nuevas (R32). Todo sale de
> Prisma, la aritmética `BigInt` que ya usa `inventario` y los primitivos de UI que ya están en el repo.
>
> Grafo de código: no usé el MCP `codebase-memory-mcp` en esta tanda. Exploré con Grep/Read; las rutas
> citadas están verificadas a mano.

## Lo que ya existe

Busqué los términos `ficha`, `detalle de producto`, `producto terminado`, `kardex`, `historial`,
`movimiento` y `costo de producción` en tres sitios.

- **Board** (`feature_list.json`): solo esta ficha pide una ficha de producto. QC-223 (`done`) la
  desgajó de sí misma. QC-224 (`anular-entrega`, `in_progress`, mismo assignee) anuncia en su
  `requirements.md:13` y en su `design.md:14,572` que «QC-225 reutiliza la lista de entregas de este
  spec» (`list-order-deliveries.ts` y `order-delivery-list.tsx`). No está mergeada en `dev` y no es
  una dependencia de esta ficha. Ver P2 y §9, A5.
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
| Tabs | `components/ui/tabs.tsx` (lo usa `product-type-tabs.tsx`) | R8, R9 |
| Imagen | `EntityImage` (lo usa `finished-stock-columns.tsx:134`) | R10 |
| Etiqueta del motivo | `movementReasonLabel` (`app/(private)/inventario/components/batch-history.tsx:47`) | R16, R17 |

## 1. Encaje en módulos

**Decisión: `inventario` es el dueño de la ficha.** Los casos de uso, el puerto de lectura y su
adaptador viven en `inventario`. Lo que no es suyo entra por puertos o contratos que ya existen o que
`inventario` declara:

- **Número del pedido** → `OrderNumberDirectory` (ya existe). `inventario` no puede importar
  `pedidos`: `pedidos` ya importa `inventario` y se cerraría un ciclo.
- **Cliente y envases de cada entrega** → `FinishedDeliveryDirectory`, un hueco nuevo que
  `inventario` declara en su dominio con el mismo patrón que `OrderNumberDirectory`. Lo implementa un
  adaptador driven de `pedidos` y lo cablea `lib/composition`. Las tablas `order_deliveries` y
  `order_delivery_lines` son de `pedidos`.
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

/** El tipo de asiento tal como está en el libro. */
export type FinishedProductMovementKind = 'opening' | 'adjustment' | 'consumption' | 'production' | 'delivery';

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

/** Hueco para `pedidos`: cliente y envases de las entregas. Sin permisos: autoriza quien llama. */
export interface FinishedDeliveryDirectory {
  findDeliveryDetails(
    companyId: string,
    deliveryIds: readonly string[],
  ): Promise<ReadonlyMap<string, {
    readonly customerId: string;
    readonly packagesByBatch: ReadonlyMap<string, number>;
  }>>;
}
```

`FinishedProductMovementKind` es un `Record` exhaustivo en la UI. Si QC-224 mergea antes y añade
`delivery_void`, el `typecheck` obliga a etiquetarlo al sincronizar (§11).

### 2.2 Puerto: `inventario/ports/finished-product-detail-repository.ts`

```ts
export type FinishedProductRecord = {
  readonly id: string;
  readonly name: string;
  readonly imagePath: string | null;
  readonly qtyAlert: string | null;
  readonly unitId: string | null;
  readonly presentation: { readonly id: string; readonly name: string; readonly content: string | null; readonly unitId: string | null } | null;
  readonly batches: readonly { readonly stock: string; readonly packageContent: string | null }[];
};

export type PageRequest = { readonly page: number; readonly pageSize?: number };

export interface FinishedProductDetailRepository {
  /** Vivo, de la empresa y FINISHED_PRODUCT; si no, null (R5). */
  findAliveFinished(id: string, scope: InventoryScope): Promise<FinishedProductRecord | null>;
  /** `orderId` del asiento production, o null. Orden created_at desc, id desc. */
  listBatches(productId: string, page: PageRequest, scope: InventoryScope):
    Promise<Page<Omit<FinishedProductBatchRow, 'orderNumberText' | 'packagedStock'> & { readonly orderId: string | null }>>;
  /** 'in': quantity > 0; 'out': quantity < 0 (R18). quantity con signo. */
  listMovements(productId: string, direction: FinishedProductMovementDirection, page: PageRequest, scope: InventoryScope):
    Promise<Page<{ id; kind; batchId; lot; quantity; packageContent; orderId; reason; createdAt }>>;
  /** Asientos 'delivery' (orderDeliveryId no nulo). */
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
| `list-finished-product-deliveries.ts` | `createListFinishedProductDeliveries` | `(id, input, actor) => Promise<Page<FinishedProductDeliveryRow>>` | `products`, `orders`, `deliveries: FinishedDeliveryDirectory`, `customers: Pick<CustomerCatalog,'findRefsIncludingDeleted'>` |
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
export async function listFinishedProductDeliveriesAction(id: string, input: unknown): Promise<PageResult<FinishedProductDeliveryRow>>;
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
- una fila de muestra de cada tipo;
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
    directorio de entregas.

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
  (`movements: { where: { kind: 'production' }, select: { orderId }, take: 1 }`).
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
  Promise<ReadonlyMap<string, { customerId: string; packagesByBatch: ReadonlyMap<string, number> }>>;
```

Hace un `orderDelivery.findMany` con `id in (…)` y la empresa, con `lines: { select: { batchId, packages } }`.
Si no recibe ids, no consulta. El ámbito sale de `pedidos/.../company-scope.ts` (`companyScopeColumns`).

### 4.3 `lib/composition/index.ts`

- `const finishedDeliveryDirectory: FinishedDeliveryDirectory = { findDeliveryDetails: findDeliveryDetailsByIds }`,
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

## 6. UI

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
| `finished-product-tabs.tsx` | Cliente. `Tabs` con los siete disparadores en orden, que navegan cambiando `tab` en la dirección (R8, R9) | `finished-product-tab-<tab>` |
| `finished-product-general.tsx` | R10 | `finished-product-general` |
| `finished-product-stock.tsx` | R11, R12 | `finished-product-stock-total`, `finished-product-stock-packages`, `finished-product-stock-unpackaged` |
| `finished-product-list-section.tsx` | Servidor. Pide el listado del tab activo y despacha a vacío (R24), error o tabla | `finished-product-<tab>-empty`, `finished-product-<tab>-error` |
| `finished-product-batches-table.tsx` | Lotes (R13) | `finished-product-batch-row` |
| `finished-product-movements-table.tsx` | Entradas o Salidas según `direction` (R15–R17); etiqueta del origen con un `Record<FinishedProductMovementKind, string>` exhaustivo | `finished-product-movement-row`, `finished-product-movement-origin` |
| `finished-product-deliveries-table.tsx` | Entregas (R19, R20) | `finished-product-delivery-row`, `finished-product-delivery-customer` |
| `finished-product-costs-table.tsx` | Costo de producción (R21) | `finished-product-cost-row` |
| `finished-product-params.ts` | Parseo y enlaces de tab y página (R9) | — |
| `index.ts` | Barrel de la ruta | — |

Etiquetas de origen (R16, R17):
- `production`: «Producción», con el número de pedido;
- `opening`: «Apertura (alta o importación)»;
- `adjustment`: «Ajuste», con `movementReasonLabel(reason)`;
- `delivery`: «Entrega a cliente»;
- `consumption`: «Consumo».

`movementReasonLabel` vive en `app/(private)/inventario/components/batch-history.tsx`. Ya está
exportado en el barrel de esa ruta (`components/index.ts:7`), y se importa de ahí.

Las tablas usan `DataTable` con paginación por servidor, con el molde de `finished-stock-table.tsx`.
Sin filtros ni orden: el orden es fijo (R23). Las cantidades y los importes se muestran con
`trimDecimal` (`lib/shared/ui/decimal-display`), sin pasar por `number`.

**Sin escritura (R7):** ningún archivo de la ruta importa `product-actions.ts`, `batch-actions.ts` ni
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

## 7. Censos, guardias y llamadores afectados

Cada enmienda conserva las aserciones previas y lleva una nota fechada.

| Archivo | Qué censa | Cambio | Task |
|---|---|---|---|
| `tests/unit/inventario/schema/inventario-schema.test.ts:744` | factorías del barrel (18) | + las seis de §2.3 → 24 | T0 |
| `tests/unit/inventario/product-route-contract.test.ts:111` | todos los fuentes bajo `app/(private)/inventario` salvo `importar/` | excluye también el prefijo `producto-terminado/`, que tiene su contrato propio (como `importar/`). Hace falta porque las prohibiciones de ese archivo (`toFixed(`, `filter(`, `'cost'`) son de la pantalla de catálogo | F1 |
| `tests/unit/inventario/producto-terminado/finished-product-route-contract.test.ts` (nuevo) | contrato de la ruta nueva | `requirePagePermission('inventario.consultar')` como primera línea (R1); ningún import de action de escritura (R7); ninguna URL literal (R30); sin `main`/layout propio; componentes por el barrel | F1 |
| `tests/guards/guard-pantallas-exigen-permiso.test.ts:261` | `RUTAS_ESPERADAS_HOY` (25) | + `/inventario/producto-terminado/[id]` → 26, con nota fechada | F1 |
| `tests/guards/guard-identificador-de-request.test.ts:57` | `E2E_ESPERADOS` | + `detalle-de-producto-terminado.spec.ts` | TI |
| `tests/unit/identity/session-once-per-request-actions.test.ts:165` | `ACCIONES`, una fila por archivo driving | + fila de `finished-product-actions.ts` (`getFinishedProductAction`) | B3 |
| `tests/integration/aislamiento.json` | modo de aislamiento por suite | + cada `.int.test.ts` nueva | B1, B2 |
| `tests/unit/inventario/company-scope.test.ts` | ámbito por envoltorio | verificar con el adaptador nuevo; enmendar solo si un caso lo exige | B1 |
| `tests/guards/guard-arquitectura-modulos.test.ts` (bloque 15) | ciclos entre módulos | sin cambio: la arista `inventario → clientes` no cierra ciclo (verificar) | TC |
| `tests/guards/guard-pantalla-pedidos-se-amplia.test.ts` | anclas del barrel de /pedidos | sin cambio: solo se añaden exportaciones (verificar) | TC |
| `tests/guards/guard-dependencias-aprobadas.test.ts` | `package.json` | sin cambio (R32) | TC |

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
  `order-delivery-list.tsx`).**
  - No está en `dev`.
  - Es por pedido y exige `pedidos.consultar`. La decisión [Permiso] de esta ficha dice que Entregas
    no exige `pedidos.consultar`.
  - Agrupa por entrega con acción «Anular», y esta ficha es de solo consulta.

  Reutilizarla haría depender a QC-225 de QC-224 sin que el board lo diga. Ver P2.
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
| R4 | u `list-finished-product-deliveries.test.ts` y `list-finished-product-costs.test.ts` (actor solo con `inventario.consultar`) |
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

## 11. Dependencias, integraciones y choques en vuelo

- **Dependencias:** ninguna (R32). `next/link`, `Tabs`, `Popover` y `DataTable` ya están en el repo.
- **Integraciones externas:** ninguna.
- **Choque de archivos con QC-224 (in_progress, mismo assignee).** Los dos tocan
  `lib/modules/inventario/index.ts`, `lib/composition/index.ts`,
  `app/(private)/pedidos/components/{order-columns,order-table,order-list-section,index}.ts(x)`,
  `tests/unit/inventario/schema/inventario-schema.test.ts`,
  `tests/unit/identity/session-once-per-request-actions.test.ts`,
  `tests/guards/guard-identificador-de-request.test.ts` y `tests/integration/aislamiento.json`.
  `scripts/archivos-en-vuelo.mjs` lo va a marcar en F2.0, y lo decide el leader. Si QC-224 mergea
  antes, al sincronizar (F2.3) hay que:
  - añadir `delivery_void` a `FinishedProductMovementKind` y a su etiqueta;
  - resolver P2.
