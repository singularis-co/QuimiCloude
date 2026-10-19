# QC-288 — entrega-sin-pedido · design.md

> Zona fullstack · Complejidad high · Requisitos en `requirements.md` (R1–R57, decisiones D1–D15,
> preguntas abiertas P1–P4). Sin dependencias nuevas (R57): todo sale de `zod`, Prisma, la aritmética
> `BigInt` de `inventario` y los primitivos de UI que ya usan `/pedidos` y `/inventario`.

## Lo que ya existe

Busqué los términos `sin pedido`, `excedente`, `mostrador`, `direct`, `entrega`/`delivery` en los
tres sitios. **El MCP del grafo no se consultó en esta tanda**: usé Grep y Read sobre el worktree.

- **Board** (`feature_list.json`): «sin pedido» solo aparece en esta ficha. «excedente» aparece
  también en QC-290 `empaque-con-excedente` (`pending`). Esa ficha trata de empacar más envases de
  los pedidos: no es una entrega y no se solapa. Su interacción con el cálculo se anota en §12.
  QC-223 lista «Entregar sin pedido» en «Lo que NO entra» y QC-282 también: esta ficha es ese
  pendiente.
- **Specs**: ningún spec define una entrega sin pedido. Los que esta ficha enmienda:
  - QC-223 R31: el asiento de entrega exige pedido. Se conserva tal cual con un tipo de asiento
    nuevo (§1).
  - QC-225 R7 y R36: la ficha no tenía controles de escritura.
  - QC-224 R18 y QC-223 R29: las claves y la entrega de otro tipo.

  Las enmiendas están en §11.
- **Código** (Grep y Read):
  - `order_deliveries.order_id` es `NOT NULL` (`db/schema.prisma:872`).
  - `order_delivery_lines.order_presentation_line_id` es `NOT NULL` (`:899`).
  - El CHECK `inventory_movements_order_id_matches_kind` exige `order_id` en `delivery` y
    `delivery_void` (migraciones `20261008150100_order_deliveries` y
    `20261009120100_order_delivery_voids`).
  - `InventoryMovementKind` tiene seis valores (`:424`).
  - El listado de producto terminado (`finished-stock-table.tsx`) agrupa por pedido, y cada producto
    de un grupo lleva `ProductRowActions` (Lotes, Editar, Borrar).
  - La cabecera de la ficha (`finished-product-header.tsx`) usa `PageHeader`, que ya tiene el hueco
    `actions`.

**Lo que se reutiliza:**

| Pieza | Dónde | Para qué |
|---|---|---|
| Tablas de entrega y anulación | `order_deliveries`, `order_delivery_lines`, `order_delivery_voids`, `order_delivery_void_lines` | la entrega sin pedido es una fila más, sin pedido y con producto (§1) |
| Reglas de bloque y suma por lote | `checkDeliveryBlocks`, `flattenBlocks`, `packagesLeftInBatch`, `batchesOverAvailable`, `remainingPackages`, `DELIVERY_MAX_ALLOCATIONS` (`pedidos/domain/order-delivery.ts`) | sheet y servidor (R23) |
| Envases que cuentan | `effectivePackages` (`pedidos/domain/packing-count.ts`) | «faltan» de cada pedido, igual que `deliverOrder` |
| Cliente vivo | `requireAliveCustomer`, `CustomerCatalog` | R31 |
| Salida y devolución de lotes | `dispatchFinishedGoods` y `returnFinishedGoods` (`inventario/.../product-prisma.ts`), agregadas por lote (QC-282 §2.3) | R34, R37, R50 |
| Envases de un lote | `wholePackagesIn` (`inventario/domain/finished-goods-dispatch.ts`) | envases en stock y disponibles |
| Repositorio de anulaciones | `OrderDeliveryVoidRepository` (`findByKey`, `findDelivery`, `findDeliveryLines`, `create`, `addLines`) | anulación sin pedido |
| Tab Entregas | `FinishedDeliveryDirectory.listDeliveryLines` / `summarizeDelivered`, `list-finished-product-deliveries.ts`, `finished-product-deliveries-table.tsx` | las líneas sin pedido salen solas por `batchId IN` (R52, R53) |
| Unicidad e idempotencia | `order_deliveries_company_key_unique`, `order_delivery_voids_company_key_unique`, `order_delivery_void_lines_delivery_line_unique` | R38, R51 |

### UI: catálogo consultado y regla de decisión

Tableros aprobados (D15), que este diseño implementa:
- `docs/diseno/canvas/EntregaSinPedido.dc.html` (escritorio: cabecera de la ficha, menú de la fila del
  listado, sheet, diálogo de anular, tab Entregas, historial del lote);
- `docs/diseno/canvas/EntregaSinPedidoTablet.dc.html`;
- `docs/diseno/canvas/EntregaSinPedidoMovil.dc.html` (teléfono y ficha: Reutiliza, Librerías,
  Animación, «Por confirmar: Ninguna»).

Los tres tableros cubren escritorio, tablet y teléfono: se cumple la regla multiplataforma.

Filas de `components/shared/CATALOGO.md` consultadas: `Sheet`, `AsyncAutocomplete` (vía
`OrderCustomerPicker`), `Checkbox`, `ConfirmDialog` (`ConfirmDialogFrame`, `ConfirmDialogBody`),
`StatusBadge`, `FieldError`, `ErrorAlert`, `Notice`, `RowActionsMenu`, `Textarea`, `Button` (variante
`outline-dashed`), `Card`, `Skeleton`, `touchTarget`, `EMPTY_MARK`.

| Pieza | Paso | Por qué |
|---|---|---|
| `Sheet`, `StatusBadge`, `FieldError`, `ErrorAlert`, `Notice`, `Textarea`, `Checkbox`, `ConfirmDialog`, `RowActionsMenu`, `PageHeader` (`actions`) | 1 Reutiliza | ya existen y cubren el caso |
| `OrderDeliveryCustomerBlock` y `OrderDeliveryAddCustomer` (`order-delivery-customer-block.tsx`), `OrderCustomerPicker` (`order-customer-picker.tsx`) y `order-customer-label.ts` | 1 Reutiliza **y suben a `components/shared/`** | los necesita una segunda ruta (`/inventario`), con la misma API. El bloque admite una sola presentación sin cambios: se le pasa una con `presentationLineId` = id del producto. Ganan fila en el catálogo (§7.1) |
| `ProductRowActions` (`app/(private)/inventario/components/product-row-actions.tsx`) | 2 Extiende | prop opcional `directDelivery`; sin ella, el catálogo no cambia (§7.4) |
| `FinishedProductHeader` | 2 Extiende | prop opcional `actions` que pasa a `PageHeader` (§7.3) |
| `FinishedProductDeliveriesTable` | 2 Extiende | prop opcional `canVoidDirect`; marca «Sin pedido», nota y columna de acciones (§7.5) |
| `DirectDeliverySheet` (`app/(private)/inventario/components/direct-delivery-sheet.tsx`) | 3 Compone | `Sheet` + los bloques subidos + `Textarea` + avisos. Se compone y no se extiende `order-delivery-sheet.tsx` (A8) |
| `DirectDeliverySurplusCard` (`.../direct-delivery-surplus-card.tsx`) | 3 Compone | tarjeta «Excedente» del tablero: `dl`, `details` nativo y `StatusBadge` |
| `DirectDeliveryButton` (`.../direct-delivery-button.tsx`) | 3 Compone | `Button` de la cabecera, que monta el sheet solo mientras está abierto |
| `DirectDeliveryVoidDialog` (`app/(private)/inventario/producto-terminado/[id]/components/direct-delivery-void-dialog.tsx`) | 3 Compone | `ConfirmDialogFrame`/`ConfirmDialogBody` + `Checkbox` + `Textarea` + `ErrorAlert`, con el molde de `delivery-void-dialog.tsx`. No se extiende ese diálogo (A9) |

**Dónde vive el sheet.** Lo usan dos sitios de `/inventario`: el listado (`app/(private)/inventario/components/`) y la ficha, que es subruta.
- Va en el `components/` de `/inventario`, y la ficha lo importa de su barrel, como ya hace con
  `movementReasonLabel` (QC-225 §6.2).
- No sube a `shared`: no hay una segunda ruta fuera de `/inventario`.
- Lo que sí cruza de ruta son los bloques de `/pedidos`, y por eso suben ellos.

Animaciones: las del tablero, todas del sistema (`fade` al entrar un bloque, la del sheet y la del
diálogo). Ninguna nueva.

## 1. Modelo de datos (R36, R37, R40, R41, R42)

**Decisión: la entrega sin pedido es una fila de `order_deliveries` con `order_id` nulo y
`product_id` propio. Sus asientos son de dos tipos nuevos, `direct_delivery` y
`direct_delivery_void`. Las demás tablas se reutilizan.**

Por qué:
1. **Una sola fuente de entregas.** El tab Entregas pagina líneas de `order_delivery_lines` por
   `batch_id IN` (QC-282 §2.7) y el total suma esa misma tabla. Con la entrega sin pedido en la misma
   tabla, las dos cosas la incluyen sin tocar su consulta. Con tablas aparte habría que paginar una
   unión (A1; es el problema de QC-282 A5).
2. **La anulación ya existe.** `order_delivery_voids` y `order_delivery_void_lines` anulan por línea
   de entrega, con su clave y su único por línea. Sirven igual sin pedido.
3. **Los invariantes de QC-223 R31 y QC-224 R32 siguen literales** porque el asiento es de otro tipo:
   - `inventory_movements_order_id_matches_kind` no cambia de texto. Sigue exigiendo pedido a
     `delivery` y `delivery_void` y, como los tipos nuevos no están en su lista, les **prohíbe**
     llevarlo.
   - Lo que cambia es la lista de tipos que llevan referencia a entrega o a anulación (§1.2).
   - Si se relajara el CHECK para admitir `delivery` sin pedido, la base dejaría de rechazar un
     asiento de entrega de pedido sin pedido (A2).
4. **Etiquetas exhaustivas.** Un tipo propio obliga a los `Record` de etiquetas (`batch-history.tsx`,
   `finished-product-movements-table.tsx`) a darle su texto del tablero (R54, R55); `typecheck` lo
   exige.

Alternativas en §10 (A1 tablas nuevas, A2 relajar el CHECK, A3 pedido sintético, A4 `inventario`
dueño).

### 1.1 Migración `<ts>_inventory_movement_kind_direct_delivery`

Aparte, por el 55P04 de Postgres (un valor nuevo de enum no se usa en la misma transacción); es el
precedente de QC-223 §3.1 y QC-224 §3.1.

```sql
ALTER TYPE "InventoryMovementKind" ADD VALUE 'direct_delivery';
ALTER TYPE "InventoryMovementKind" ADD VALUE 'direct_delivery_void';
```

`[POR VERIFICAR]` B1 comprueba que dos `ADD VALUE` en el mismo archivo funcionan con el runner de
Prisma y la versión de Postgres del proyecto. Si no, son dos migraciones.

`down.sql`: el molde de `20261009120000_inventory_movement_kind_delivery_void/down.sql`.
1. `RAISE EXCEPTION` si hay asientos de cualquiera de los dos tipos.
2. Quita los CHECK que dependen del tipo.
3. Recrea el tipo sin los dos valores.
4. Repone los CHECK.

### 1.2 Migración `<ts>_direct_deliveries`

Los timestamps son orientativos. Van detrás de la última de `origin/dev`, hoy
`20261016120000_products_last_batch_at`.

```sql
-- pedidos: la entrega puede ser de un pedido o de un producto terminado, nunca de los dos
ALTER TABLE "order_deliveries" ALTER COLUMN "order_id" DROP NOT NULL;
ALTER TABLE "order_deliveries" ADD COLUMN "product_id" UUID;
ALTER TABLE "order_deliveries" ADD COLUMN "note" TEXT;
ALTER TABLE "order_deliveries" ADD CONSTRAINT "order_deliveries_order_xor_product"
  CHECK (("order_id" IS NULL) <> ("product_id" IS NULL));
ALTER TABLE "order_deliveries" ADD CONSTRAINT "order_deliveries_note_only_direct"
  CHECK ("note" IS NULL OR ("order_id" IS NULL AND length(btrim("note")) BETWEEN 1 AND 500));
ALTER TABLE "order_deliveries" ADD CONSTRAINT "order_deliveries_product_id_fkey"
  FOREIGN KEY ("company_id", "product_id") REFERENCES "products"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "order_deliveries_product_id_idx" ON "order_deliveries"("company_id", "product_id");

-- pedidos: la línea de una entrega sin pedido no tiene línea del reparto
ALTER TABLE "order_delivery_lines" ALTER COLUMN "order_presentation_line_id" DROP NOT NULL;

CREATE FUNCTION "order_delivery_lines_check_origin"() RETURNS trigger AS $$
DECLARE d RECORD;
BEGIN
  SELECT "order_id", "product_id" INTO d FROM "order_deliveries"
   WHERE "id" = NEW."delivery_id" AND "company_id" = NEW."company_id";
  IF d."order_id" IS NULL THEN
    IF NEW."order_presentation_line_id" IS NOT NULL
       OR NOT EXISTS (SELECT 1 FROM "product_batches" b
                       WHERE b."id" = NEW."batch_id" AND b."company_id" = NEW."company_id"
                         AND b."product_id" = d."product_id") THEN
      RAISE EXCEPTION 'order_delivery_lines: linea de entrega sin pedido incoherente' USING ERRCODE = '23514';
    END IF;
  ELSIF NEW."order_presentation_line_id" IS NULL THEN
    RAISE EXCEPTION 'order_delivery_lines: linea de entrega de pedido sin linea del reparto' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER "order_delivery_lines_check_origin" BEFORE INSERT OR UPDATE ON "order_delivery_lines"
  FOR EACH ROW EXECUTE FUNCTION "order_delivery_lines_check_origin"();

-- inventario: los asientos de entrega sin pedido y de su anulación
ALTER TABLE "inventory_movements" DROP CONSTRAINT "inventory_movements_order_delivery_id_matches_kind";
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_order_delivery_id_matches_kind"
  CHECK (("kind"::text IN ('delivery', 'direct_delivery')) = ("order_delivery_id" IS NOT NULL));
ALTER TABLE "inventory_movements" DROP CONSTRAINT "inventory_movements_delivery_quantity_negative";
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_delivery_quantity_negative"
  CHECK ("kind"::text NOT IN ('delivery', 'direct_delivery') OR "quantity" < 0);
ALTER TABLE "inventory_movements" DROP CONSTRAINT "inventory_movements_order_delivery_void_id_matches_kind";
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_order_delivery_void_id_matches_kind"
  CHECK (("kind"::text IN ('delivery_void', 'direct_delivery_void')) = ("order_delivery_void_id" IS NOT NULL));
ALTER TABLE "inventory_movements" DROP CONSTRAINT "inventory_movements_delivery_void_quantity_positive";
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_delivery_void_quantity_positive"
  CHECK ("kind"::text NOT IN ('delivery_void', 'direct_delivery_void') OR "quantity" > 0);
ALTER TABLE "inventory_movements" DROP CONSTRAINT "inventory_movements_reason_matches_kind";
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_reason_matches_kind"
  CHECK (("kind"::text = 'adjustment' AND "reason" IS NOT NULL)
      OR ("kind"::text IN ('opening', 'consumption', 'production', 'delivery', 'delivery_void',
                           'direct_delivery', 'direct_delivery_void') AND "reason" IS NULL));
-- "inventory_movements_order_id_matches_kind" NO cambia: los dos tipos nuevos, al no estar en su
-- lista, quedan obligados a "order_id" NULL.

-- El tipo del asiento tiene que coincidir con el de la entrega a la que apunta.
CREATE FUNCTION "inventory_movements_check_delivery_origin"() RETURNS trigger AS $$
DECLARE without_order BOOLEAN;
BEGIN
  IF NEW."order_delivery_id" IS NOT NULL THEN
    SELECT "order_id" IS NULL INTO without_order FROM "order_deliveries" WHERE "id" = NEW."order_delivery_id";
    IF without_order <> (NEW."kind"::text = 'direct_delivery') THEN
      RAISE EXCEPTION 'inventory_movements: tipo de asiento y entrega no coinciden' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF NEW."order_delivery_void_id" IS NOT NULL THEN
    SELECT d."order_id" IS NULL INTO without_order
      FROM "order_delivery_voids" v JOIN "order_deliveries" d ON d."id" = v."delivery_id"
     WHERE v."id" = NEW."order_delivery_void_id";
    IF without_order <> (NEW."kind"::text = 'direct_delivery_void') THEN
      RAISE EXCEPTION 'inventory_movements: tipo de asiento y anulacion no coinciden' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER "inventory_movements_check_delivery_origin" BEFORE INSERT OR UPDATE ON "inventory_movements"
  FOR EACH ROW EXECUTE FUNCTION "inventory_movements_check_delivery_origin"();
```

**Antes de escribir el SQL**, B1 verifica en la base:
- el texto vigente de los cinco CHECK que se reescriben. La referencia es QC-224 §3.2; alguna
  migración posterior pudo reescribirlos;
- que la clave `products_company_id_id_key` es `(company_id, id)` (`schema.prisma:367`);
- que los índices parciales de un asiento por (entrega, lote) y por (anulación, lote) no necesitan
  cambios: su predicado es `IS NOT NULL` sobre la columna, así que cubren también los tipos nuevos.

**El `kind::text IN (...)`** va en CHECK y en disparador, nunca en el predicado de un índice: por el
42P17 que QC-223 ya encontró.

**`down.sql`**, en orden inverso (R42):
1. `RAISE EXCEPTION` si existe alguna fila de `order_deliveries` con `order_id` nulo, `product_id` o
   `note` (no se puede volver a «toda entrega tiene pedido» sin perder datos).
2. Quita los dos disparadores y sus funciones.
3. Repone los cinco CHECK con su texto previo.
4. `SET NOT NULL` en `order_delivery_lines.order_presentation_line_id` y en
   `order_deliveries.order_id`.
5. Quita el índice, la FK, los dos CHECK y las columnas `note` y `product_id`.

**Empresa (R40, [A]).**
- La FK del producto es compuesta con `company_id`: una entrega no puede apuntar al producto de otra
  empresa.
- El disparador de líneas exige que el lote sea del producto de la entrega y de la empresa de la
  línea.
- Las demás FK compuestas (cliente, lote, autor, anulación) no cambian.

**RLS.** No hay tabla nueva; las cuatro ya tienen `ENABLE` y `FORCE`.

**Solo inserción (R41, D11).** Ninguna tabla gana `updated_at` ni `deleted_at`. Los disparadores
cubren también `UPDATE` como respaldo, aunque ningún adaptador lo declare. El barrido de
`tests/unit/pedidos/order-delivery-append-only.test.ts` sigue igual y cubre los adaptadores nuevos
(§9).

### 1.3 `db/schema.prisma`

- `OrderDelivery`:
  - `orderId String?` y `order Order?`;
  - `productId String? @map("product_id") @db.Uuid`, sin `@relation`, porque `Product` es de
    `inventario` (drift);
  - `note String?`;
  - `@@index([companyId, productId], map: "order_deliveries_product_id_idx")`.
- `OrderDeliveryLine`: `orderPresentationLineId String?` y `presentationLine OrderPresentationLine?`.
- `InventoryMovementKind` gana `direct_delivery` y `direct_delivery_void`, al final y sin reordenar.
- Los comentarios de los modelos que se tocan se reescriben sin citar fichas. Los CHECK y los
  disparadores son drift, como el resto.

## 2. Contrato (lo publica T0)

### 2.1 Funciones puras: `pedidos/domain/direct-delivery.ts` (R9–R11, R18, R23, R33)

Sin servidor, sin reloj y sin Prisma. Se publica en el barrel de `pedidos` (lo importa el sheet).

```ts
export const DIRECT_DELIVERY_NOTE_MAX_LENGTH = 500;

/** Una línea del reparto de un pedido TERMINADO de la misma receta y presentación. */
export type WaitingOrderLine = {
  readonly orderId: string;
  readonly numberText: string;
  readonly orderedPackages: number;    // effectivePackages(line)
  readonly deliveredPackages: number;  // sin las líneas anuladas
};

export type WaitingOrder = { readonly orderId: string; readonly numberText: string; readonly missingPackages: number };

/** Los pedidos a los que les faltan envases (missing > 0), por numberText ascendente. */
export function waitingOrders(lines: readonly WaitingOrderLine[]): readonly WaitingOrder[];

/** max(0, stockPackages - suma de missingPackages). */
export function surplusPackages(stockPackages: number, waiting: readonly WaitingOrder[]): number;

/** Recorta; '' -> null. No valida el tope (lo hace zod en el servidor y R20 en el sheet). */
export function normalizeDeliveryNote(note: string | null): string | null;

/** Asignaciones de una entrega sin pedido en la forma de QC-223: `presentationLineId` es el id del
 *  producto, la única «línea» de la entrega. Así `checkDeliveryBlocks`, `flattenBlocks`,
 *  `packagesLeftInBatch` y `batchesOverAvailable` se reutilizan sin cambios (R23). */
export function directAllocations(
  productId: string,
  allocations: readonly { readonly batchId: string; readonly packages: number }[],
): readonly DeliveryAllocation[];

export type DirectDeliveryCheck =
  | { readonly kind: 'ok' }
  | { readonly kind: 'empty' }
  | { readonly kind: 'exceeds_surplus'; readonly surplus: number }
  | { readonly kind: 'exceeds_batch'; readonly batchIds: readonly string[] };

/** En este orden: empty, exceeds_surplus, exceeds_batch. Con `batches` en null no se mira el lote:
 *  lo hace quien tiene el lote bloqueado (`inventario`). */
export function checkDirectDelivery(
  surplus: number,
  batches: readonly DeliveryBatchState[] | null,
  allocations: readonly DeliveryAllocation[],
): DirectDeliveryCheck;
```

### 2.2 `inventario`: servicio de la entrega sin pedido (`domain/finished-goods-dispatch.ts`)

Se amplía el archivo que ya existe, con una sentencia `export { … }` propia y sin `type …Deps`, para
que la guardia de fábricas de `inventario-schema.test.ts` no lo cuente como caso de uso (QC-223
§2.2).

```ts
/** Lectura fuera de transacción. */
export type FinishedProductForDelivery = {
  readonly productId: string;
  readonly name: string;
  readonly recipeId: string | null;
  readonly presentationId: string | null;
  readonly presentationName: string | null;
  readonly stockPackages: number;                  // R9: suma de wholePackagesIn de los lotes con contenido
  readonly batches: readonly DeliverableBatch[];   // lotes entregables, mismo orden que QC-223 §2.2
};

export type FinishedProductSurplusBase = {
  readonly productId: string;
  readonly recipeId: string | null;
  readonly presentationId: string | null;
  readonly stockPackages: number;
};

export interface FinishedProductDeliveryCatalog {
  /** Vivo, `FINISHED_PRODUCT` y de la empresa; si no, null. */
  findForDelivery(productId: string, companyId: string): Promise<FinishedProductForDelivery | null>;
  /** Una consulta para todos: los ids que no son productos terminados vivos de la empresa no vuelven. */
  findSurplusBases(productIds: readonly string[], companyId: string): Promise<readonly FinishedProductSurplusBase[]>;
}

/** Sobre la transacción de quien llama. */
export interface FinishedGoodsDirectDispatch {
  /** `FOR NO KEY UPDATE` sobre el producto terminado vivo; null si no lo es. Lee sus lotes ya con el
   *  producto bloqueado. */
  lockForDirectDelivery(productId: string, companyId: string): Promise<{
    readonly recipeId: string | null;
    readonly presentationId: string | null;
    readonly stockPackages: number;
  } | null>;
  dispatchDirect(input: {
    readonly companyId: string;
    readonly productId: string;
    readonly orderDeliveryId: string;
    /** Puede repetir `batchId` (uno por cliente): se agrega por lote (QC-282 §2.3). */
    readonly allocations: readonly { readonly batchId: string; readonly packages: number }[];
    readonly actorId: string;
    readonly now: Date;
  }): Promise<FinishedGoodsDispatchOutcome>;   // el tipo de QC-223, sin cambios
}
```

`FinishedGoodsReturnInput.orderId` pasa a `string | null`: con `null`, el asiento es
`direct_delivery_void`. Es un ensanchamiento: los llamadores actuales no cambian.

`NewInventoryMovement['kind']`, `InventoryMovementView['kind']`, `BatchHistoryEntry['kind']` y
`FinishedProductMovementKind` ganan `'direct_delivery' | 'direct_delivery_void'`.

### 2.3 `inventario`: historial del lote (R54)

`domain/reservation.ts`: `BatchHistoryEntry` gana
`readonly customerNames: readonly string[] | null`. Lleva los clientes del asiento en orden
alfabético, y solo en los dos tipos nuevos; `null` en el resto.

Hueco nuevo en `inventario/domain/list-batch-movements.ts`, con el molde de `OrderNumberDirectory`:

```ts
/** Para `pedidos`: las líneas de entrega son suyas. Sin permisos: autoriza quien llama. */
export interface DeliveryCustomerDirectory {
  /** Por id de asiento, los clientes de las líneas de esa entrega (o de las líneas anuladas por esa
   *  anulación) en ese lote. Una consulta por tipo de referencia, nunca una por asiento. */
  findCustomerIds(
    companyId: string,
    refs: readonly { readonly movementId: string; readonly batchId: string; readonly deliveryId: string | null; readonly voidId: string | null }[],
  ): Promise<ReadonlyMap<string, readonly string[]>>;
}
```

`ListBatchMovementsDeps` gana `deliveryCustomers: DeliveryCustomerDirectory` y
`customers: Pick<CustomerCatalog, 'findRefsIncludingDeleted'>`. La arista `inventario → clientes` ya
existe (QC-225 §1).

### 2.4 `inventario`: tab Entregas (R52, R53)

`domain/finished-product-detail.ts`, cambios aditivos:
- `FinishedDeliveryLineRecord.orderId: string | null` y `+ readonly note: string | null`;
- `FinishedProductDeliveryRow` gana `readonly withoutOrder: boolean` y `readonly note: string | null`.

`createListFinishedProductDeliveries` solo pide números de pedido para los `orderId` no nulos. Una
fila sin pedido sale con `orderNumberText: null`, `withoutOrder: true` y su `note`. `summarizeDelivered` no cambia: ya
suma todas las líneas no anuladas de los lotes (R53).

### 2.5 Puertos de `pedidos`

`ports/direct-delivery-repository.ts` (nuevo):

```ts
export type NewDirectDelivery = {
  readonly deliveryKey: string;
  readonly productId: string;
  readonly note: string | null;   // ya normalizada
  readonly actorId: string;
  readonly now: Date;
};

export type NewDirectDeliveryLine = {
  readonly customerId: string;
  readonly batchId: string;
  readonly packages: number;
  readonly quantity: string;
};

/** La entrega con esa clave, de pedido o sin pedido. */
export type RegisteredDelivery = { readonly id: string; readonly orderId: string | null };

export interface DirectDeliveryRepository {
  findByKey(deliveryKey: string, scope: OrderScope): Promise<RegisteredDelivery | null>;
  create(delivery: NewDirectDelivery, scope: OrderScope):
    Promise<{ readonly kind: 'created'; readonly id: string } | { readonly kind: 'duplicate_key' }>;
  addLines(deliveryId: string, lines: readonly NewDirectDeliveryLine[], scope: OrderScope): Promise<void>;
}

/** Líneas del reparto de los pedidos vivos de la empresa en TERMINADO con esa receta y presentación,
 *  con sus envases entregados sin las líneas anuladas. Una consulta para todos los pares. */
export interface WaitingOrdersReader {
  listWaitingLines(
    pairs: readonly { readonly recipeId: string; readonly presentationId: string }[],
    scope: OrderScope,
  ): Promise<readonly (WaitingOrderLine & { readonly recipeId: string; readonly presentationId: string })[]>;
}
```

`ports/direct-delivery-unit-of-work.ts` (nuevo):

```ts
export type DirectDeliveryTransactionScope = {
  readonly deliveries: DirectDeliveryRepository;
  readonly waiting: WaitingOrdersReader;
  readonly finishedGoods: FinishedGoodsDirectDispatch;
};
export interface DirectDeliveryUnitOfWork {
  run<T>(work: (scope: DirectDeliveryTransactionScope) => Promise<T>): Promise<T>;
}

export type DirectDeliveryVoidTransactionScope = {
  readonly voids: OrderDeliveryVoidRepository;
  readonly finishedGoods: FinishedGoodsReturn;
};
export interface DirectDeliveryVoidUnitOfWork {
  run<T>(work: (scope: DirectDeliveryVoidTransactionScope) => Promise<T>): Promise<T>;
}
```

Son puertos aparte por el mismo motivo que QC-223 §2.3: no obligan a los dobles que ya construyen
`OrderDeliveryTransactionScope` a cambiar. Las dos unidades de trabajo usan `withOrderTransaction`.

Cambios en puertos existentes (los recoge `typecheck`):
- `RegisteredOrderDelivery.orderId` y `RegisteredDeliveryVoid.orderId` pasan a `string | null`.
- `DeliveryForVoid` pasa a `{ id; orderId: string | null; productId: string | null; createdAt: Date }`.
- `DeliveryLineForVoid.presentationLineId` pasa a `string | null`.

`scope: OrderScope` va siempre último (`guard-ambito-empresa-pedidos`).

### 2.6 Casos de uso de `pedidos`

Los cinco empiezan con `requirePermission` como primera sentencia (R2, R3).

| Archivo | Factoría | Permiso | Firma |
|---|---|---|---|
| `get-direct-delivery.ts` | `createGetDirectDelivery` | `entregas.modificar` | `(productId, actor) => Promise<DirectDeliveryView>` |
| `list-direct-delivery-surplus.ts` | `createListDirectDeliverySurplus` | `entregas.modificar` | `(productIds: unknown, actor) => Promise<ReadonlyMap<string, number>>` |
| `deliver-direct.ts` | `createDeliverDirect` | `entregas.modificar` | `(input: unknown, actor) => Promise<DeliverDirectResult>` |
| `get-direct-delivery-for-void.ts` | `createGetDirectDeliveryForVoid` | `entregas.anular` | `(deliveryId, actor) => Promise<DirectDeliveryVoidView>` |
| `void-direct-delivery.ts` | `createVoidDirectDelivery` | `entregas.anular` | `(input: unknown, actor) => Promise<VoidDirectDeliveryResult>` |

```ts
export type DirectDeliveryView = {
  readonly productId: string;
  readonly productName: string;
  readonly presentationName: string | null;
  readonly stockPackages: number;
  readonly waiting: readonly WaitingOrder[];
  readonly waitingPackages: number;
  readonly surplusPackages: number;
  readonly batches: readonly DeliverableBatch[];
};

export type DeliverDirectResult = { readonly status: 'delivered' | 'already_registered' };
export type VoidDirectDeliveryResult = { readonly status: 'voided' | 'already_registered' };

export type DirectDeliveryVoidView = {
  readonly deliveryId: string;
  readonly createdAt: string;               // ISO
  readonly presentationName: string | null;
  /** Solo los clientes con su parte sin anular, por nombre ascendente y luego id. */
  readonly customers: readonly { readonly customerId: string; readonly customerName: string; readonly packages: number }[];
};
```

**`getDirectDelivery`** (R9, R10, R13):
1. `productId` con forma de uuid; si no, `DirectDeliveryProductNotFoundError`.
2. `catalog.findForDelivery`; `null` → el mismo error.
3. Si `recipeId` y `presentationId` no son nulos, `waiting.listWaitingLines` sobre el cliente global;
   si alguno es nulo, ningún pedido puede esperarlo y `waiting = []`.
4. `waitingOrders`, `surplusPackages`.

**`listDirectDeliverySurplus`** (R5, R6, R8):
1. `z.array(z.string().uuid()).max(DIRECT_DELIVERY_SURPLUS_MAX_PRODUCTS)` con
   `DIRECT_DELIVERY_SURPLUS_MAX_PRODUCTS = 200`; si falla, `ValidationError`. Los ids repetidos se
   deduplican.
2. Con la lista vacía devuelve un mapa vacío sin consultar.
3. `catalog.findSurplusBases(ids)`: una consulta.
4. `waiting.listWaitingLines(pares distintos)`: una consulta.
5. Mapa `productId → surplus`; un id que no vuelve en el paso 3 no aparece.

Son dos lecturas por página, sea cual sea el número de filas (R8).

**`deliverDirect`** (R29–R39). Esquema:

```ts
const deliverDirectSchema = z.strictObject({
  productId: z.string(),                              // la forma la decide el paso 3 (R29)
  deliveryKey: z.string().uuid(),
  note: z.string().nullable(),                        // recortada; > 500 -> invalid_input
  customers: z.array(z.strictObject({
    customerId: z.string(),                           // la forma la decide requireAliveCustomer
    allocations: z.array(z.strictObject({
      batchId: z.string().uuid(),
      packages: z.number().int().min(1),
    })).min(1),
  })).min(1),
}); // + refine: total de asignaciones <= DELIVERY_MAX_ALLOCATIONS; customerId sin repetir (en
    //   minúsculas, como deliverOrder); batchId sin repetir dentro de cada cliente; nota recortada <= 500.
```

Orden fuera de la transacción:
1. `requirePermission(actor, 'entregas.modificar')` (R2).
2. `safeParse` → `ValidationError`. Después, `checkDeliveryBlocks` sobre `directAllocations`; un
   problema también es `ValidationError` (R29).
3. `productId` sin forma de uuid → `DirectDeliveryProductNotFoundError` (R29, R30).
4. `deliveries.findByKey`. Con `orderId` nulo responde `already_registered`; con pedido, `ValidationError`
   (R38).
5. `requireAliveCustomer` por cliente, en orden (R31).
6. `unitOfWork.run` (§3).

Fuera, la señal de clave repetida se resuelve como en QC-223 §4.1: se relee la clave y se responde
según el paso 4.

**`voidDirectDelivery`** (R47–R51). Esquema:

```ts
const voidDirectDeliverySchema = z.strictObject({
  deliveryId: z.string().uuid(),
  voidKey: z.string().uuid(),
  customerIds: z.array(z.string().uuid()).min(1).max(DELIVERY_MAX_ALLOCATIONS),
  reason: z.string().trim().min(1).max(500),
}); // + refine: customerIds sin repetir (en minúsculas)
```

Orden:
1. Permiso.
2. `safeParse`.
3. `voids.findByKey`. Si la clave es de la anulación de una entrega sin pedido, `already_registered`;
   si es de una de pedido, `ValidationError`.
4. `voids.findDelivery`. Si es `null` o tiene `orderId`, `DeliveryNotFoundError` (R48).
5. `unitOfWork.run` (§4).

**`getDirectDeliveryForVoid`** (R44):
1. Permiso.
2. Uuid.
3. `voids.findDelivery`: `null` o de pedido → `DeliveryNotFoundError`.
4. `voids.findDeliveryLines`, `catalog.findForDelivery` (solo el nombre de la presentación; si el
   producto está dado de baja, `presentationName: null`) y
   `customerCatalog.findRefsIncludingDeleted`, en un `Promise.all`.
5. Agrupa por cliente y omite los clientes con todas sus líneas anuladas.

**Enmiendas a los casos de uso de QC-223/224** (R38, R48):
- `deliverOrder`: si `findByKey` devuelve `orderId: null`, `ValidationError`, antes y después de la
  transacción.
- `voidDelivery`:
  - `findDelivery` con `orderId: null` → `DeliveryNotFoundError`;
  - `findByKey` con `orderId: null` → `ValidationError`;
  - `pairKey` sobre `presentationLineId: string` (las líneas de pedido nunca lo traen nulo, lo
    garantiza el disparador de §1.2).

### 2.7 Server Actions (`pedidos/adapters/driving/order-actions.ts`)

En el archivo que ya existe: un solo archivo `'use server'` en `pedidos`, por `module-contract.test.ts`
(QC-223 §2.5).

```ts
export type DirectDeliveryResult = { status: 'success'; data: DirectDeliveryView } | ErrorState;
export async function getDirectDeliveryAction(productId: string): Promise<DirectDeliveryResult>;

/** Plano y serializable: `productId -> envases de excedente`. */
export type DirectDeliverySurplusResult = { status: 'success'; data: Readonly<Record<string, number>> } | ErrorState;
export async function listDirectDeliverySurplusAction(productIds: readonly string[]): Promise<DirectDeliverySurplusResult>;

export type DeliverDirectInput = {
  readonly productId: string;
  readonly deliveryKey: string;
  readonly note: string | null;
  readonly customers: readonly { readonly customerId: string; readonly allocations: readonly { readonly batchId: string; readonly packages: number }[] }[];
};
export type DeliverDirectActionResult = { status: 'success'; data: DeliverDirectResult } | ErrorState;
export async function deliverDirectAction(input: unknown): Promise<DeliverDirectActionResult>;

export type DirectDeliveryVoidViewResult = { status: 'success'; data: DirectDeliveryVoidView } | ErrorState;
export async function getDirectDeliveryForVoidAction(deliveryId: string): Promise<DirectDeliveryVoidViewResult>;

export type VoidDirectDeliveryInput = {
  readonly deliveryId: string;
  readonly voidKey: string;
  readonly customerIds: readonly string[];
  readonly reason: string;
};
export type VoidDirectDeliveryActionResult = { status: 'success'; data: VoidDirectDeliveryResult } | ErrorState;
export async function voidDirectDeliveryAction(input: unknown): Promise<VoidDirectDeliveryActionResult>;
```

Cada una resuelve el actor con `identity.getSessionUser()` una vez por petición. Los errores pasan
por `createErrorStateTranslator`.

### 2.8 Códigos de error

Uno nuevo en `lib/modules/errores/domain/error-codes.ts`, con su comentario «Distinto de…», su clave
en `ERROR_MESSAGE_KEY` y su texto en `ERROR_MESSAGES_ES`. Las clases van en
`lib/modules/pedidos/domain/errors.ts`.

| Situación | Código | Clase | Nuevo / reusado | Mensaje |
|---|---|---|---|---|
| Más envases que el excedente (R33) | `delivery_exceeds_surplus` | `DeliveryExceedsSurplusError` | **nuevo** | `La entrega supera el excedente: hay pedidos terminados esperando esos envases.` |
| Producto ausente, dado de baja, no terminado o ajeno (R30) | `product_not_found` | `DirectDeliveryProductNotFoundError` | código reusado | catálogo |
| Lote (R32, R34) | `batch_not_found`, `delivery_batch_insufficient` | las de QC-223 | reusado | catálogo |
| Cliente (R31) | `customer_not_found` | `CustomerNotFoundError` | reusado | catálogo |
| Entrega ausente, ajena o de otro tipo (R48) | `delivery_not_found` | `DeliveryNotFoundError` | reusado | catálogo |
| Ya anulada (R49) | `delivery_already_voided` | `DeliveryAlreadyVoidedError` | reusado | catálogo |
| Forma (R29, R38, R47) | `invalid_input` | `ValidationError` | reusado | catálogo |
| Permiso (R2, R3) | `unauthorized` | `UnauthorizedError` | reusado | catálogo |

T0 comprueba que `pedidos/domain/errors.ts` no tenga ya una clase con `product_not_found`. Si la
tiene, se reutiliza.

### 2.9 Fixtures y stub de T0

- `tests/fixtures/direct-delivery.ts` incluye:
  - `directDeliveryView(overrides)`: 20 envases en stock, dos pedidos que esperan 5 y 3, excedente
    12 y dos lotes, como el tablero;
  - `directDeliveryVoidView(overrides)`;
  - `DIRECT_DELIVERY_RESULTS`;
  - `DIRECT_DELIVERY_ERROR_STATES`, un `ErrorState` por código de §2.8;
  - `deliverDirectInput(overrides)`.
- T0 deja los cinco casos de uso con su firma, el permiso primero y un cuerpo que lanza
  `ActionNotAllowedError`, más las cinco actions cableadas. `composition` publica las claves con
  dobles mínimos donde aún no hay adaptador.

## 3. Escritura de la entrega: transacción y concurrencia (R33–R39)

Dentro de `unitOfWork.run` (`withOrderTransaction`):

1. `finishedGoods.lockForDirectDelivery(productId)`: `FOR NO KEY UPDATE` sobre el producto vivo.
   - `null` → `DirectDeliveryProductNotFoundError`.
   - Con el producto bloqueado, lee sus lotes y calcula `stockPackages`.
2. `deliveries.findByKey(deliveryKey)`. Si ya está, se lanza la señal de clave repetida. La clave va
   antes que el tope, por la misma decisión del humano que QC-223 §4 nota 5.
3. Si la receta y la presentación no son nulas, `waiting.listWaitingLines([{ recipeId, presentationId }])`
   sobre `tx`, y `surplus = surplusPackages(stockPackages, waitingOrders(lines))`. Si no, `surplus = stockPackages`.
4. `checkDirectDelivery(surplus, null, allocations)`. `exceeds_surplus` →
   `DeliveryExceedsSurplusError` (R33).
5. `deliveries.create({ deliveryKey, productId, note, actorId, now })`. `duplicate_key` → la señal.
6. `finishedGoods.dispatchDirect(...)` con las asignaciones de todos los clientes, en el orden
   cliente → asignación:
   - `batch_not_found` → `DeliveryBatchNotFoundError` (R32);
   - `insufficient` → `DeliveryBatchInsufficientError` (R34).
7. `deliveries.addLines` con una línea por asignación, su `customerId` y la `quantity` que devolvió
   `inventario` en la misma posición.
8. Devuelve `{ status: 'delivered' }`.

Cualquier fallo deshace todo (R39).

**Por qué basta con bloquear el producto (R35).** El excedente depende de dos cosas: la existencia de
los lotes del producto y lo que les falta a los pedidos `TERMINADO` de su receta y presentación.
Toda transacción que cambia una de las dos bloquea antes ese mismo producto:

| Operación | Qué cambia | Bloquea el producto |
|---|---|---|
| Entrega de pedido (QC-223/282) | existencia y faltan, por igual | sí, `dispatchFinishedGoods` |
| Anulación de entrega de pedido (QC-224/282) | existencia y faltan, por igual | sí, `returnFinishedGoods` |
| Ajuste de lote | existencia | sí (producto y luego lote) |
| Entrega y anulación sin pedido | existencia | sí, paso 1 y `returnFinishedGoods` |
| Terminar el empaque (`receiveFromOrder`) | existencia | sí, `receiveFinishedGoods` |
| Terminar el acondicionamiento (`EN_ACONDICIONAMIENTO → TERMINADO`) | faltan (el pedido empieza a esperar) | `[POR VERIFICAR]` |

- **Primera fila de la tabla.** Una vez que la entrega sin pedido tiene el producto, las demás
  esperan. Leer en sentencias nuevas (READ COMMITTED) le da el estado confirmado de las que
  terminaron antes.
- **Orden de bloqueo.** Es producto y luego lote, un sufijo del orden global pedido → producto →
  lote. No hay ciclo nuevo.
- **Acondicionamiento.** T0 comprueba si `finishConditioningAlive` toca el producto. Si lo toca, no
  hace falta nada. Si no lo toca, ese paso puede convertir a un pedido en «esperando» en paralelo con
  una entrega sin pedido. Se cierra con un **paso 0**, antes del paso 1: leer con `FOR SHARE`,
  ordenados por `id`, los pedidos vivos de la receta en `TERMINADO` o `EN_ACONDICIONAMIENTO` que
  tienen línea de esa presentación.
  - Así el `UPDATE` de estado del acondicionamiento (que bloquea su pedido) espera o es esperado.
  - El orden queda pedidos → producto → lote, el mismo que la entrega de pedido. Bloquear los pedidos
    *después* del producto abriría un ciclo con una entrega de pedido (pedido A → producto frente a
    producto → pedido A), por eso va antes.
  - Esos pedidos solo se bloquean: el cálculo del paso 3 sigue contando solo los `TERMINADO`, leídos
    otra vez ya con el producto bloqueado.
  - T0 lo anota en `progress/features/QC-288.md` antes de seguir. Va ligado a P4.

El `CHECK stock >= 0` sigue siendo el respaldo, y el decremento condicional de QC-223 §4.2 también.

### 3.1 `dispatchFinishedGoods` y el bloqueo en `product-prisma.ts`

- `dispatchFinishedGoods(tx, input)` pasa a recibir el origen como unión discriminada:
  - `{ origin: 'order', orderId, recipeId, presentationId }`, el de hoy;
  - `{ origin: 'direct', productId }`.
- Con `'direct'`, bloquea el producto por `id` (vivo, `FINISHED_PRODUCT`, empresa) y escribe el
  asiento con `kind: 'direct_delivery'`, `orderId: null` y `orderDeliveryId`. Lo demás no cambia:
  la agregación por lote, el decremento condicional y `recalculateProductStock`.
- `lockFinishedProductForDelivery(tx, productId, scope)` es una función nueva **de lectura con
  bloqueo**, sin escritura, junto al bloqueo que ya usa `dispatchFinishedGoods`. Devuelve receta,
  presentación y lotes.
- `returnFinishedGoods`: con `orderId` nulo, el asiento es `direct_delivery_void`. No filtra por
  `deleted_at`, como hoy (R50, QC-224 R31).

No aparece ningún camino nuevo de escritura de `product_batches`: los censos de
`guard-libro-de-inventario`, `qc121-alcance` y `qc91-alcance` siguen contando los mismos. TC lo
verifica.

`finished-goods-dispatch-prisma.ts` gana `createFinishedGoodsDirectDispatch(tx)`, con el molde de
`createFinishedGoodsDispatch`.

## 4. Anulación sin pedido: transacción (R47–R51)

Dentro de `unitOfWork.run`:
1. `voids.findByKey(voidKey)`: si ya está, la señal.
2. `voids.findDeliveryLines(deliveryId)`. Se seleccionan las líneas de los `customerIds` pedidos:
   - un cliente sin líneas → `ValidationError` (R47);
   - alguna seleccionada anulada → `DeliveryAlreadyVoidedError` (R49).
3. `voids.create` (`duplicate_key` → la señal).
4. `voids.addLines`. `already_voided` → `DeliveryAlreadyVoidedError`: es el respaldo del único de
   la base ante dos anulaciones a la vez (R51).
5. `finishedGoods.returnForDeliveryVoid({ …, orderId: null, lines })`. `inventario` agrega por lote
   y escribe un asiento por lote. `batch_not_found` → `Error` interno.
6. Devuelve `{ status: 'voided' }`.

No hay pedido que bloquear ni estado que mover. La serialización entre dos anulaciones la dan el
único de `order_delivery_void_lines` y el bloqueo del producto en `returnFinishedGoods`.

## 5. Lecturas: adaptadores driven

- **`inventario/adapters/driven/persistence/deliverable-batches-prisma.ts`** gana `findForDelivery`
  y `findSurplusBases`:
  - `findForDelivery`: el producto vivo `FINISHED_PRODUCT` de la empresa con su presentación (segunda
    consulta a `presentations`, como `findAliveFinished`) y sus lotes con `package_content`.
  - `findSurplusBases`: un `findMany` de productos con `id IN` y sus lotes con contenido.
  - Las dos con los envoltorios de `company-scope.ts`. Los envases salen de `wholePackagesIn`.
- **`pedidos/adapters/driven/persistence/direct-delivery-prisma.ts`** (nuevo):
  - `findByKey`, `create` (P2002 → `duplicate_key`) y `addLines` (`createMany`);
  - `listWaitingLines`: un `orderPresentationLine.findMany` con `order: { status: 'TERMINADO',
    deletedAt: null, companyId, OR: pares }`. Para lo entregado, un `groupBy` de
    `order_delivery_lines` sin anular sobre esas líneas;
  - `numberText` con el formateador de número que ya usa `pedidos` (`[POR VERIFICAR]` T0 localiza
    cuál usa `OrderNumberDirectory`);
  - lee solo tablas de `pedidos`, con `companyScopeColumns`.
- **`order-delivery-void-prisma.ts`**: `findDelivery` devuelve también `productId` y `createdAt`;
  `findDeliveryLines` admite `presentationLineId` nulo.
- **`order-delivery-prisma.ts`**: `findByKey` devuelve `orderId` nulo si la entrega es sin pedido.
- **`order-delivery-directory-prisma.ts`**:
  - `listDeliveryLines` selecciona `delivery.orderId` (puede ser nulo) y `delivery.note`;
  - gana `findCustomerIdsForMovements`, que implementa `DeliveryCustomerDirectory`: un `findMany`
    de líneas por `(deliveryId, batchId)` y otro de líneas de anulación por `(voidId, batchId)`. Si
    no recibe referencias, no consulta.
- **`batch-movement-prisma.ts`**: selecciona `orderDeliveryId` y `orderDeliveryVoidId` de cada asiento
  (los necesita `list-batch-movements` para el hueco de §2.3).

## 6. Composición (`lib/composition/index.ts`)

- Se cablean los dos casos de uso de escritura:
  - `deliverDirect`: con `withOrderTransaction` y un `DirectDeliveryTransactionScope` sobre `tx`
    (`createDirectDeliveryRepository(tx)`, `createWaitingOrdersReader(tx)`,
    `createFinishedGoodsDirectDispatch(tx)`);
  - `voidDirectDelivery`: con `createOrderDeliveryVoidRepository(tx)` y
    `createFinishedGoodsReturn(tx)`.
- Las tres lecturas van sobre el cliente global.
- La fachada `pedidos` gana cinco claves al final. La de `inventario`, en `listBatchMovements`,
  recibe `deliveryCustomers` y `customers`.
- `finishedDeliveryDirectory` no cambia de forma. `deliveryCustomerDirectory` se declara junto a él,
  antes de la fachada de `inventario`, por el mismo motivo que `orderNumberDirectory`.

## 7. UI

### 7.1 Piezas que suben a `components/shared/`

Las mueve F1, sin cambiar su API:
- `app/(private)/pedidos/components/order-customer-label.ts` → `components/shared/order-customer-label.ts`;
- `order-customer-picker.tsx` → `components/shared/order-customer-picker.tsx`;
- `order-delivery-customer-block.tsx` → `components/shared/order-delivery-customer-block.tsx`.

`app/(private)/pedidos/components/index.ts` las sigue reexportando desde `shared`. Así los
consumidores de `/pedidos` que importan del barrel no cambian, y los que importan por ruta relativa
pasan a `@/components/shared/…`. Sus tests no cambian de aserciones.

Cada pieza gana su fila en `CATALOGO.md`, y la celda `Diseño` cita su tablero:
- el bloque: `EntregaVariosClientes.dc.html` y `EntregaSinPedido.dc.html`;
- el buscador y la etiqueta: `EntregaSinPedido.dc.html` y, si su fila de origen tenía otro tablero,
  también ese.

`OrderCustomerPicker` importa `searchOrderCustomersAction` de `pedidos`. Tiene precedente en
`shared`: `document-upload` importa las actions de `documentos`.

### 7.2 `DirectDeliverySheet` (`app/(private)/inventario/components/direct-delivery-sheet.tsx`, R10–R28)

- **Apertura:** `getDirectDeliveryAction(productId)`. Mientras espera, esqueleto. Si falla,
  `direct-delivery-error` con el mensaje del catálogo.
- **Composición (tablero):**
  - cabecera «Entregar sin pedido» con «<producto> · <presentación>»;
  - aviso de borrador ajustado;
  - `DirectDeliverySurplusCard`;
  - un `OrderDeliveryCustomerBlock` por bloque, con una sola presentación;
  - `OrderDeliveryAddCustomer`;
  - `Textarea` «Nota (opcional)» con su ayuda «Se ve en el tab Entregas del producto.»;
  - los dos avisos (excedente, lote);
  - pie «Cancelar» / «Entregar».
  Con excedente cero, el estado «No hay envases libres…» en lugar de los bloques (R21).
- **Derivados en cada render**, con las funciones de §2.1 y de `order-delivery.ts`:
  - `packagesLeftInBatch` para «Disponibles» y el tope del campo (R16);
  - `batchesOverAvailable` para «Solo hay N» y el aviso de lote (R17);
  - escritos > excedente para el aviso del excedente (R18);
  - `checkDeliveryBlocks` al pulsar «Entregar» (R19).
  «Entregar» está `disabled` con excedente cero, si se pasa del excedente o con un lote pasado.
- **Envío:** `deliverDirectAction` con `note` normalizada (R22).
- **Respuesta:**
  - éxito o `already_registered`: borra el borrador, cierra, toast «Entrega sin pedido registrada» y
    `router.refresh()` (R24);
  - `delivery_exceeds_surplus` o `delivery_batch_insufficient`: `direct-delivery-rejected`, relee y
    ajusta el borrador (R25);
  - cualquier otro error: `direct-delivery-error` (R26).
- **Etiquetas del bloque:** las de QC-282, salvo `no_packages`, que usa el texto de este tablero:
  «Este cliente no lleva envases: indica al menos uno.».
- **Test ids:** `direct-delivery-sheet`, `direct-delivery-surplus`, `direct-delivery-counter`,
  `direct-delivery-waiting`, `direct-delivery-no-surplus`, `direct-delivery-note`,
  `direct-delivery-note-error`, `direct-delivery-over-surplus`, `direct-delivery-stock-over`,
  `direct-delivery-submit`, `direct-delivery-cancel`, `direct-delivery-draft-adjusted`,
  `direct-delivery-rejected`, `direct-delivery-error`. Los de bloque y lote son los de
  `order-delivery-customer-block`.

`DirectDeliverySurplusCard` (R10, R11) muestra:
- un `dl` con «En stock», «Esperan pedidos terminados» (−M) y «Se puede entregar»;
- un `details`/`summary` nativo «Ver los pedidos que esperan»;
- «Entregas N de M» con un `StatusBadge`: tono `muted` para «Sin envases», `success` para «Quedan K
  libres» y `danger` para «Sobran K», como el tablero.

**Ojo con `product-route-contract.test.ts`.** Prohíbe en `app/(private)/inventario/**` (salvo
`importar/` y `producto-terminado/`) textos como `filter(`, `toFixed(` y `orderBy`. Los archivos
nuevos de `app/(private)/inventario/components/` los evitan: las listas se derivan con las funciones
de `pedidos` o con `flatMap`/`reduce`. Si un caso lo hace imposible, TC lo enmienda con una nota
fechada y se dice por qué.

### 7.3 Borrador (`direct-delivery-draft.ts`, `use-direct-delivery-draft.ts`, R27, R28)

- Clave: `qc.direct-delivery-draft.<productId>`.
- Forma, versionada:
  `{ v: 1, productId, deliveryKey, blocks: { key, customer: OrderCustomer | null, packages: Record<batchId, string> }[], note: string }`.
- Si no hay borrador, se crea uno con un bloque vacío, la nota vacía y `crypto.randomUUID()` (R12).
- El ajuste contra un `DirectDeliveryView` quita los lotes que ya no se ofrecen y devuelve
  `adjusted` (R28).
- El hook guarda en cada cambio y borra al cancelar y al aplicar.
- Si `localStorage` no está disponible, el sheet funciona sin guardar (QC-223 §6.3).

### 7.4 Entradas (R5–R8)

- **Ficha** (`page.tsx`):
  - tras `getFinishedProductAction`, si `hasPermission(user, 'entregas.modificar')`, llama a
    `listDirectDeliverySurplusAction([product.id])`;
  - con un excedente mayor que cero, pasa a `FinishedProductHeader` el prop nuevo
    `actions={<DirectDeliveryButton productId=… />}`, que va al hueco `actions` de `PageHeader`;
  - sin permiso, con error o con cero, no pasa nada y el botón no existe (R5);
  - va en la cabecera, fuera de los tabs: visible en todos.
- **Listado** (`finished-stock-list-section.tsx`):
  - con el permiso, junta los `product.id` distintos de todas las líneas de la página y llama una
    vez a `listDirectDeliverySurplusAction` (en tandas de 200 si hubiera más);
  - un error deja el mapa vacío (falla cerrado, R6);
  - pasa `surplusByProduct` a `FinishedStockTable`, que da a cada `ProductRowActions` el prop
    `directDelivery={{ productId }}` solo si su excedente es mayor que cero.
- **`ProductRowActions`:** con `directDelivery`, añade el ítem «Entregar»
  (`product-action-direct-delivery`, icono `TruckIcon` de `lucide-react`, ya en el repo) y monta
  `DirectDeliverySheet` solo mientras está abierto. Sin el prop, los ítems y el orden de hoy no
  cambian (catálogo y tests actuales).
- **Permiso:** se calcula con el mismo `hasPermission` que `order-list-section.tsx`. Es
  presentación, no autorización: el servidor revalida (R2).

### 7.5 Tab Entregas y diálogo (R43–R46, R52)

- **`finished-product-list-section.tsx`:** en el tab `entregas`, calcula
  `canVoidDirect = hasPermission(user, 'entregas.anular')` con el `getSessionUser` que ya usa, y lo
  pasa a la tabla.
- **`FinishedProductDeliveriesTable`:**
  - con `row.withoutOrder`, la celda Pedido pinta `StatusBadge` tono `info` «Sin pedido»
    (`finished-product-delivery-direct`) y, debajo, la nota en tono apagado
    (`finished-product-delivery-note`);
  - con `canVoidDirect`, añade la columna de acciones (cabecera solo para lectores de pantalla). La
    celda pinta «Anular» (`finished-product-delivery-direct-void`, 44 px en teléfono) solo si
    `withoutOrder && void === null`, con `aria-label` «Anular la entrega sin pedido del <fecha>»;
  - sin el prop, la tabla es la de hoy;
  - las tarjetas de teléfono siguen el tablero.
- **`DirectDeliveryVoidDialog`:**
  - al abrir, `getDirectDeliveryForVoidAction(deliveryId)` con esqueleto;
  - `voidKey = crypto.randomUUID()` al montarse;
  - una casilla por cliente (`direct-delivery-void-customer`, `data-customer-id`), todas sin marcar;
  - el motivo, con las validaciones y los test ids de `delivery-void-dialog.tsx` bajo el prefijo
    `direct-delivery-void-`;
  - envía `voidDirectDeliveryAction`;
  - respuesta como R46: `router.refresh()` en éxito; con `delivery_already_voided`, relee la vista.

### 7.6 Historial del lote y tabs de movimientos (R54, R55)

- `batch-history.tsx`:
  - `KIND_LABELS.direct_delivery = 'Entrega sin pedido'` y
    `KIND_LABELS.direct_delivery_void = 'Anulación de entrega sin pedido'`;
  - en esos tipos, la columna del pedido pinta `customerNames.join(', ')` (P3); si viene vacío,
    `EMPTY_MARK`;
  - las insignias usan los tonos del tablero (`info` y `muted`).
- `finished-product-movements-table.tsx`: el `Record` de origen gana los dos textos, sin número de
  pedido.

## 8. Seguridad, aislamiento y rendimiento

- **Permiso en el caso de uso** (R2–R4). Es la primera sentencia de los cinco. Cada uno tiene sus
  tests de actor sin permiso, de rol distinto con permiso y de Administrador sin permiso.
- **Empresa** ([A]). Todas las consultas filtran por la empresa del actor:
  - producto, lote, cliente y entrega de la empresa B responden como inexistentes (R30–R32, R48);
  - la base lo respalda con las FK compuestas y los disparadores de §1.2;
  - los tests de integración llevan un caso de empresa B por cada lectura y escritura.
- **Sin N+1** (R8). El listado hace dos lecturas por página (§2.6). La ficha hace una llamada con un
  id. El historial, una consulta por tipo de referencia.
- **Índices.** `order_deliveries_product_id_idx` es nuevo. Las demás consultas usan
  `order_delivery_lines_batch_id_idx`, `order_presentation_lines_order_id_presentation_id_key`,
  `orders_recipe_id_idx` y `order_delivery_void_lines_delivery_line_unique`, que ya existen.

## 9. Censos, guardias y llamadores afectados

Cada enmienda conserva las aserciones previas y lleva una nota fechada 2026-10-16.

| Archivo | Qué censa | Cambio | Task |
|---|---|---|---|
| `tests/guards/guard-identificador-de-request.test.ts` | `MIGRACIONES_ESPERADAS`, `E2E_ESPERADOS` | + las dos migraciones; + `entrega-sin-pedido.spec.ts` | B1, TI |
| `tests/unit/inventario/schema/inventario-schema.test.ts` | enum `InventoryMovementKind`; fábricas del barrel | + dos valores; fábricas sin cambio (§2.2) | B1, T0 |
| `tests/unit/pedidos/schema/pedidos-schema.test.ts` | referencias sin `@relation`, modelos | + `OrderDelivery.productId` | B1 |
| `tests/integration/pedidos/order-delivery-constraints.int.test.ts` y `order-delivery-void-constraints.int.test.ts` | QC-223 R31 y QC-224 R32 | siguen verdes sin cambio; los casos nuevos (R40) van en un archivo propio | B1 |
| `tests/unit/clientes/scope.test.ts` | migraciones que tocan `customers` | sin cambio (la migración no toca `customers`); verificar | B1 |
| `tests/unit/inventario/*` (scope y `company-scope.test.ts`) | migraciones y consultas que tocan `products` | + la migración (FK hacia `products`), si el censo existe | B1 |
| `tests/guards/guard-libro-de-inventario.test.ts`, `tests/unit/inventario/qc121-alcance.test.ts`, `qc91-alcance.test.ts` | caminos de escritura de `product_batches` | sin camino nuevo (§3.1); verificar | TC |
| `tests/unit/pedidos/order-delivery-append-only.test.ts` | caminos que modifican entregas | + que `direct-delivery-prisma.ts` no declara `update`/`delete`/`upsert` | TC |
| `tests/unit/pedidos/module-contract.test.ts` | un solo archivo driving | sin cambio (las actions van en `order-actions.ts`) | B5 |
| `tests/unit/identity/session-once-per-request-actions.test.ts` | `ACCIONES` | + las cinco actions | B5 |
| `tests/unit/inventario/producto-terminado/finished-product-route-contract.test.ts` | QC-225 R7: ninguna action de escritura en la ruta | admite exactamente `deliverDirectAction` (vía el sheet) y `voidDirectDeliveryAction`; sigue prohibiendo `voidDeliveryAction` y las de producto y lote | F4 |
| `tests/unit/inventario/product-route-contract.test.ts` | textos prohibidos en `/inventario` | los archivos nuevos cumplen (§7.2) | F2, F3 |
| `tests/guards/guard-catalogo-de-componentes.test.ts` + `components/shared/CATALOGO.md` | piezas de `shared` con fila | + tres filas (§7.1) | F1 |
| `tests/integration/aislamiento.json` | modo de cada `.int.test.ts` | + cada suite nueva | B1–B4 |
| `tests/unit/errores/*` | textos únicos | + `delivery_exceeds_surplus` | T0 |

Llamadores de tipos que cambian (todos en `typecheck`):
- `RegisteredOrderDelivery`, `RegisteredDeliveryVoid`, `DeliveryForVoid`, `DeliveryLineForVoid`;
- `FinishedGoodsReturnInput`, `FinishedDeliveryLineRecord`, `FinishedProductDeliveryRow`;
- `BatchHistoryEntry`, `InventoryMovementView`, `NewInventoryMovement`, `FinishedProductMovementKind`,
  `ListBatchMovementsDeps`;
- sus fixtures (`tests/fixtures/order-delivery*.ts`, `finished-product-detail.ts`,
  `adjust-batch-stock.ts`).

Sin cambio, verificado:
- el catálogo de permisos (R1);
- las rutas (`guard-pantallas-exigen-permiso`): no hay página nueva;
- `sumDeliveredPackages` y `listByOrder`: filtran por pedido, y una entrega sin pedido no tiene.

## 10. Alternativas descartadas

- **A1 — Tablas nuevas `direct_deliveries`, `direct_delivery_lines`, `direct_delivery_voids` y
  `direct_delivery_void_lines`.** Dejaría intactas las tablas de pedido, pero:
  - el tab Entregas tendría que paginar la unión de dos tablas con orden común, que es el problema
    que QC-282 A5 ya descartó;
  - el total entregado sumaría dos fuentes;
  - la anulación duplicaría tablas, único, repositorio y FK;
  - las claves de entrega quedarían en dos espacios, y una clave de una podría reaparecer en la otra
    sin que la base lo viera.
  El coste son cuatro tablas, ocho FK y otra ruta de lectura para el mismo concepto.
- **A2 — Reutilizar `delivery` y `delivery_void` con `order_id` nulo.** Ahorra la migración del enum,
  pero obliga a quitar `delivery` y `delivery_void` de `inventory_movements_order_id_matches_kind`.
  La base dejaría de rechazar un asiento de entrega de pedido sin pedido (QC-223 R31 y QC-224 R32),
  y las etiquetas del historial tendrían que bifurcar por un nulo en vez de por el tipo.
- **A3 — Un pedido sintético `TERMINADO` por cada entrega sin pedido.** Reutilizaría todo QC-223,
  pero:
  - inventa un pedido que nadie pidió, con número, receta y reparto;
  - aparecería en `/pedidos`;
  - contaría en «esperan» de otras entregas sin pedido.
  Los datos dirían algo falso.
- **A4 — `inventario` dueño de la entrega sin pedido.** El producto y los lotes son suyos, pero el
  tope necesita los pedidos `TERMINADO` y lo entregado (de `pedidos`). Además, las reglas de bloque,
  el cliente y las tablas de entrega y anulación también son de `pedidos`. Como `pedidos` ya importa
  `inventario`, la otra dirección cerraría un ciclo de barriles (QC-223 A1).
- **A5 — Comprobar el excedente solo en el sheet.** Dos usuarios a la vez, o una entrega de pedido en
  paralelo, lo superarían. D3 pide el tope también en el servidor, y la regla [A] lo exige.
- **A6 — Bloquear solo los pedidos `TERMINADO`, sin el producto.** No serializa los ajustes ni las
  entradas del empaque, que cambian la existencia sin tocar esos pedidos. El conjunto de pedidos
  también cambia mientras se lee. El bloqueo del producto ya serializa todas las operaciones que
  mueven la existencia o lo que falta (§3). Los pedidos solo se bloquean, y antes del producto, si T0
  encuentra que el acondicionamiento no toca el producto.
- **A7 — Pedir el excedente fila a fila en el listado.** Es una llamada por producto (N+1) en una
  página que puede tener decenas. Una llamada con todos los ids da dos consultas fijas.
- **A8 — Un modo «sin pedido» en `order-delivery-sheet.tsx`.** Ese sheet está atado al pedido:
  `getOrderDeliveryAction`, el resumen por presentación, el borrador por `orderId` y el paso a
  `ENTREGADO`. Un modo pondría condicionales en cada parte. Componer las mismas piezas da el mismo
  aspecto sin tocar su comportamiento.
- **A9 — Extender `DeliveryVoidDialog`.** Su unidad es el par cliente-presentación con casilla de
  grupo, y vive en `/pedidos`. La anulación sin pedido es por cliente, con una casilla y sin grupo.
  Una prop opcional bifurcaría todo el cuerpo. Se compone con el mismo marco (`ConfirmDialog`).

## 11. Enmiendas a specs anteriores

Las aprueba el humano con este spec.

| Spec | Requisito | Queda así |
|---|---|---|
| QC-223 | R25, «guardarla con el pedido» | una entrega es de un pedido o, sin pedido, de un producto (R36). Las de pedido siguen igual |
| QC-223 | R29 | + una clave de entrega sin pedido responde `invalid_input` (R38) |
| QC-223 | R31 | se mantiene tal cual para `delivery`; + los casos de R40 |
| QC-224 | R18 | + una entrega sin pedido responde `delivery_not_found` a la anulación de pedido (R48) |
| QC-224 | R32 | se mantiene tal cual para `delivery_void`; + los casos de R40 |
| QC-225 | R7 | la ficha ofrece «Entregar» (R5) y, en Entregas, «Anular» en filas sin pedido (R43). Su ruta importa solo `deliverDirectAction` y `voidDirectDeliveryAction` |
| QC-225 | R19 | las filas de entrega sin pedido muestran «Sin pedido» en lugar del número (R52) |
| QC-225 | R16, R17 | + los orígenes «Entrega sin pedido» y «Anulación de entrega sin pedido» (R55) |
| QC-225 | R36 | la ficha no ofrece control de anular para entregas de pedido; sí para las sin pedido, con `entregas.anular` (R43) |
| QC-223 / QC-224 | R38 / R35 | sin cambio para sus tipos; los nuevos tipos van en R54 |

## 12. Dependencias, integraciones y relacionadas

- **Dependencias:** ninguna (R57). El icono sale de `lucide-react`; `details`/`summary` son HTML
  nativo; `crypto.randomUUID()` es del navegador.
- **Integraciones externas:** ninguna. La entrega sin pedido solo resta existencia: no dispara
  `StockIncreaseListener`. La anulación tampoco, como QC-224 §4.2.
- **QC-290 `empaque-con-excedente` (pending).** «Faltan» usa `effectivePackages`, es decir, los
  envases contados al empacar. Si QC-290 deja contar más envases que los pedidos, ese conteo sumaría
  a lo que «esperan» y el excedente de empaque no sería entregable sin pedido. Es decisión del spec de
  QC-290: se le deja anotado aquí y en su ficha cuando se tome.

## 13. Trazabilidad prevista (R → test)

Rutas abreviadas:
- **u:** `tests/unit/pedidos/` (o `inventario/`, `identity/`)
- **ui:** `tests/unit/inventario-ui/` (o `pedidos-ui/`, `shared-ui/`)
- **int:** `tests/integration/pedidos/` (o `inventario/`)
- **mig:** `tests/integration/pedidos/direct-deliveries-migration.int.test.ts`
- **e2e:** `e2e/entrega-sin-pedido.spec.ts`

| R | Test previsto |
|---|---|
| R1 | u `identity/permissions.test.ts` (catálogo exacto sin cambios) + `tests/guards/guard-permisos-sembrados.test.ts` |
| R2, R3, R4 | u `get-direct-delivery.test.ts`, `list-direct-delivery-surplus.test.ts`, `deliver-direct.test.ts`, `get-direct-delivery-for-void.test.ts`, `void-direct-delivery.test.ts` (puertos sin llamar; rol distinto con permiso; Administrador sin él) |
| R5 | ui `finished-product-header.test.tsx` + u `inventario/producto-terminado/finished-product-page.test.tsx` (sin permiso, error y cero: no hay botón ni llamada) |
| R6 | ui `product-row-actions.test.tsx` (con y sin `directDelivery`; los ítems de hoy intactos) + ui `finished-stock-table.test.tsx` |
| R7 | ui `direct-delivery-button.test.tsx` + `product-row-actions.test.tsx` (abren `DirectDeliverySheet` con el mismo `productId`) |
| R8 | u `list-direct-delivery-surplus.test.ts` (dos llamadas a puertos con 1 y con 30 productos) + ui `finished-stock-list-section.test.tsx` (una llamada a la action por página) |
| R9 | u `direct-delivery.test.ts` (`surplusPackages`, `waitingOrders`); int `direct-delivery-repository.int.test.ts` (`listWaitingLines`: otra receta, otra presentación, otro estado, borrado, empresa B, líneas anuladas); int `inventario/deliverable-batches.int.test.ts` (lote sin contenido) |
| R10, R11 | ui `direct-delivery-surplus-card.test.tsx` |
| R12, R13, R14, R15 | ui `direct-delivery-sheet.test.tsx` (R15: `OrderCustomerPicker` con `purpose="deliver"`, cuyo filtro cubre `search-order-customer-options.test.ts`) |
| R16, R17, R18, R19, R20, R21 | ui `direct-delivery-sheet.test.tsx` (la action no se llama) |
| R22 | ui `direct-delivery-sheet.test.tsx` (payload exacto) |
| R23 | u `direct-delivery.test.ts`: caso que lee las fuentes del sheet y de `deliver-direct.ts` y exige que importen `checkDeliveryBlocks`, `packagesLeftInBatch`, `surplusPackages` y `checkDirectDelivery`, sin aritmética de tope propia |
| R24, R25, R26 | ui `direct-delivery-sheet.test.tsx` |
| R27, R28 | ui `direct-delivery-draft.test.ts` + `direct-delivery-sheet.test.tsx` |
| R29 | u `deliver-direct.test.ts` (tabla de formas) |
| R30, R31, R32 | u `deliver-direct.test.ts`; int `direct-delivery.int.test.ts` (empresa B, dado de baja, lote de otro producto) |
| R33 | u `deliver-direct.test.ts`; int `direct-delivery.int.test.ts` (20 en stock, 8 esperan: 12 pasa, 13 rechaza) |
| R34 | int `inventario/finished-goods-dispatch.int.test.ts` (origen `direct`, lote repetido entre clientes) |
| R35 | int `direct-delivery-concurrency.int.test.ts` (dos sin pedido juntas; sin pedido + entrega de pedido; sin pedido + ajuste) |
| R36, R37 | int `direct-delivery.int.test.ts`; int `inventario/ledger-cuadre.int.test.ts` (+ caso sin pedido) |
| R38 | u `deliver-direct.test.ts`, `deliver-order.test.ts`; int `direct-delivery.int.test.ts` (misma clave dos veces; clave cruzada en los dos sentidos) |
| R39 | int `direct-delivery.int.test.ts` (lote insuficiente en el segundo cliente: nada escrito) |
| R40 | int `direct-delivery-constraints.int.test.ts` (`INSERT` crudos por cada caso) + las suites de QC-223/224 sin cambio |
| R41 | u `order-delivery-append-only.test.ts` (barrido ampliado); u `pedidos/schema/direct-deliveries-migration.test.ts` (nombres en inglés) |
| R42 | mig (up sobre datos de QC-223/224/282 intactos; down con y sin entregas sin pedido) + u `pedidos/schema/direct-deliveries-migration.test.ts` (texto del SQL) |
| R43 | ui `finished-product-tables.test.tsx` (con y sin `canVoidDirect`; filas de pedido sin control) |
| R44, R45, R46 | ui `direct-delivery-void-dialog.test.tsx` |
| R47, R48, R49 | u `void-direct-delivery.test.ts`, `void-delivery.test.ts` (entrega sin pedido → `delivery_not_found`); int `direct-delivery-void.int.test.ts` (empresa B) |
| R50 | int `direct-delivery-void.int.test.ts`; int `inventario/finished-goods-return.int.test.ts` (`orderId` nulo, producto dado de baja) |
| R51 | u `void-direct-delivery.test.ts`; int `direct-delivery-void-concurrency.int.test.ts` |
| R52, R53 | u `inventario/list-finished-product-deliveries.test.ts`; int `order-delivery-directory.int.test.ts` (mezcla, orden, total); ui `finished-product-tables.test.tsx` |
| R54 | u `inventario/list-batch-movements.test.ts` (nombres por asiento, una llamada por directorio); int `order-delivery-directory.int.test.ts` (`findCustomerIdsForMovements`); u `inventario/batch-history.test.tsx` |
| R55 | ui `finished-product-tables.test.tsx` (orígenes nuevos); int `inventario/finished-product-detail.int.test.ts` (fila de Entregas con su salida) |
| R56 | e2e |
| R57 | `tests/guards/guard-dependencias-aprobadas.test.ts` |
