# QC-282 — entrega-a-varios-clientes · design.md

> Zona fullstack · Complejidad high · Requisitos en `requirements.md` (R1–R48, decisiones D1–D18,
> preguntas P1 y P2). Sin dependencias nuevas (R48): todo sale de `zod`, Prisma, la aritmética
> `BigInt` que ya usa `inventario` y los primitivos de UI que ya usa `/pedidos`.

## Lo que ya existe

Busqué `varios clientes`, `repartir`, `multi cliente`, `bloque por cliente`, `entrega`/`delivery` y
`customer_id` en los tres sitios. **El MCP del grafo no se consultó en esta tanda**: usé Grep y Read
sobre el worktree.

- **Board** (`feature_list.json`): solo esta ficha habla de repartir una entrega. Las demás
  coincidencias son QC-223 `entregar-producto-terminado`, QC-224 `anular-entrega` y QC-225
  `detalle-de-producto-terminado` (las tres `done`), que esta ficha enmienda y no duplica.
- **Specs**: ningún spec define una entrega con varios clientes. QC-223 D4 fija «un cliente por
  entrega», QC-224 D2 anula «por presentación» y QC-225 R19 lista «cada lote de cada entrega». Las
  enmiendas están en §10.
- **Código** (Grep): el cliente vive en `order_deliveries.customer_id`
  (`db/schema.prisma:823`). Lo leen o escriben:
  - `pedidos/domain/deliver-order.ts` y `order-delivery-prisma.ts` (alta);
  - `order-delivery-void-prisma.ts` (`listByOrder`, la lista de QC-224);
  - `order-delivery-directory-prisma.ts` (`findDeliveryDetails`, el tab Entregas de QC-225).
  - `order_delivery_lines` tiene `UNIQUE (delivery_id, batch_id)`, y `inventory_movements` tiene un
    índice único de un asiento de entrega por lote y entrega (`inventory_movements_one_delivery_per_batch`)
    y otro de un asiento de anulación por lote y anulación. Con varios clientes, dos líneas de la
    misma entrega pueden compartir lote: el primero tiene que cambiar y los otros dos se conservan
    agregando por lote (§3).

**Lo que se reutiliza:**

| Pieza | Dónde | Para qué |
|---|---|---|
| Caso de uso de entrega | `pedidos/domain/deliver-order.ts` | se amplía: varios clientes, mismo orden de validación, mismo bloqueo e idempotencia |
| Función pura de topes | `checkDelivery` / `remainingPackages` (`pedidos/domain/order-delivery.ts`) | ya suma por línea y por lote sobre todas las asignaciones: se le pasan las de todos los clientes |
| Salida y devolución de lotes | `dispatchFinishedGoods` y `returnFinishedGoods` (`inventario/.../product-prisma.ts:1314`, `:1426`) | se agregan por lote (§3) |
| Anulación | `pedidos/domain/void-delivery.ts`, `OrderDeliveryVoidRepository` | la unidad pasa de presentación a par cliente-presentación |
| Lista de entregas | `list-order-deliveries.ts`, `order-delivery-list.tsx`, `order-deliveries-sheet.tsx` | se agrupa por cliente |
| Tab Entregas | `list-finished-product-deliveries.ts`, `FinishedDeliveryDirectory`, `finished-product-deliveries-table.tsx` | una fila por línea de entrega |
| Borrador | `order-delivery-draft.ts`, `use-order-delivery-draft.ts` | versión 2 con bloques |
| Clientes | `requireAliveCustomer`, `CustomerCatalog`, `OrderCustomerPicker` con `purpose="deliver"` | validar y elegir cada cliente |

### UI: catálogo consultado y regla de decisión

Tableros aprobados (D18), que este diseño implementa:
- `docs/diseno/canvas/EntregaVariosClientes.dc.html` (escritorio: sheet, diálogo, lista, tab Entregas);
- `docs/diseno/canvas/EntregaVariosClientesTablet.dc.html`;
- `docs/diseno/canvas/EntregaVariosClientesMovil.dc.html` (teléfono y ficha: Reutiliza, Nuevo,
  Librerías, Validación).

*Nota:* la ficha del tablero dice que se reutiliza «el sheet Entregar de QC-223
(`order-deliveries-sheet`)». El sheet de entregar es `order-delivery-sheet.tsx`;
`order-deliveries-sheet.tsx` es el de la lista de entregas (QC-224). Los dos se tocan.

Filas de `components/shared/CATALOGO.md` consultadas: `Sheet`, `AsyncAutocomplete` (vía
`OrderCustomerPicker`), `Checkbox`, `ConfirmDialog`, `StatusBadge`, `FieldError`, `ErrorAlert`,
`Input`, `Skeleton`, `touchTarget`; y `Button` (`components/ui/button.tsx`), que ya tiene la variante
`outline-dashed` para «Añadir cliente».

| Pieza | Paso | Por qué |
|---|---|---|
| Sheet, buscador de cliente, campo de envases, `FieldError`, `ErrorAlert`, `StatusBadge`, `ConfirmDialog` | 1 Reutiliza | ya existen y cubren el caso |
| `Checkbox` con `indeterminate` | 2 Extiende | la fila del catálogo dice «sin icono propio de indeterminado»; la casilla de grupo lo necesita (R37). Prop opcional: los usos actuales no cambian. Se anota en su fila |
| `OrderDeliveryCustomerBlock` (`app/(private)/pedidos/components/order-delivery-customer-block.tsx`) | 3 Compone | tarjeta del bloque: título, `OrderCustomerPicker`, `Button` «Quitar», `FieldError` y las listas de lotes. Solo la usa `/pedidos`: no sube a `shared` |
| `OrderDeliverySummary` (`.../order-delivery-summary.tsx`) | 3 Compone | resumen «Por entregar» con `StatusBadge` por presentación |
| Grupo por cliente del diálogo | 3 Compone | dentro de `delivery-void-dialog.tsx`, con `Checkbox`; no merece archivo |

Animaciones: las del tablero, todas del sistema (`fade` al entrar un bloque, `qc-err` en el error,
transición de color de `sb` en la marca del resumen). Ninguna nueva.

## 1. Modelo de datos (R25, R30, R31, R32)

**Decisión: el cliente pasa de la entrega a la línea.** `order_delivery_lines` gana `customer_id`;
`order_deliveries` lo pierde. Un «bloque» no se guarda: es el conjunto de líneas de un cliente en una
entrega. Alternativas en §11 (A1 tabla de bloques, A2 conservar el cliente en la entrega).

Por qué:
1. Sin tabla de bloques no puede existir un cliente sin líneas: D15 se cumple por construcción en la
   base y no solo en el caso de uso.
2. El par cliente-presentación que se anula (D5) es un filtro sobre las líneas: no hace falta otra
   entidad.
3. Un solo camino de lectura (D11): toda lectura del cliente sale de las líneas.

### 1.1 Migración `<ts>_order_delivery_lines_customer`

Una sola migración, de esquema y datos. El timestamp se fija al crearla, detrás de la última de
`origin/dev` (hoy `20261014200000_product_batches_lot_per_presentation`).

```sql
-- Toda entrega tiene líneas (las escribe la misma transacción). Si no, no se puede saber a qué
-- cliente pertenecerían: se aborta en vez de perder el dato.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "order_deliveries" d
              WHERE NOT EXISTS (SELECT 1 FROM "order_delivery_lines" l WHERE l."delivery_id" = d."id")) THEN
    RAISE EXCEPTION 'order_delivery_lines_customer: hay entregas sin lineas';
  END IF;
END $$;

ALTER TABLE "order_delivery_lines" ADD COLUMN "customer_id" UUID;
UPDATE "order_delivery_lines" AS l
   SET "customer_id" = d."customer_id"
  FROM "order_deliveries" AS d
 WHERE d."id" = l."delivery_id" AND d."company_id" = l."company_id";
ALTER TABLE "order_delivery_lines" ALTER COLUMN "customer_id" SET NOT NULL;
ALTER TABLE "order_delivery_lines" ADD CONSTRAINT "order_delivery_lines_customer_id_fkey"
  FOREIGN KEY ("company_id", "customer_id") REFERENCES "customers"("company_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "order_delivery_lines_customer_id_idx" ON "order_delivery_lines"("company_id", "customer_id");

ALTER TABLE "order_delivery_lines" DROP CONSTRAINT "order_delivery_lines_delivery_batch_unique";
ALTER TABLE "order_delivery_lines" ADD CONSTRAINT "order_delivery_lines_delivery_customer_batch_unique"
  UNIQUE ("delivery_id", "customer_id", "batch_id");

DROP INDEX "order_deliveries_customer_id_idx";
ALTER TABLE "order_deliveries" DROP CONSTRAINT "order_deliveries_customer_id_fkey";
ALTER TABLE "order_deliveries" DROP COLUMN "customer_id";
```

**Antes de escribir el SQL** hay que verificar en la base: el nombre real de la clave de `customers`
que usa la FK de QC-223 (`customers_company_id_id_key` según `schema.prisma`) y que ninguna migración
posterior a `20261008150100` cambió el nombre de `order_delivery_lines_delivery_batch_unique`.

El `UPDATE` sobre `order_delivery_lines` es de la migración, no de la aplicación: QC-223 R32 (ningún
camino de aplicación modifica una línea) sigue en pie. TC comprueba que el barrido de
`order-delivery-append-only.test.ts` no mira `db/migrations`; si lo mirara, se enmienda con una nota.

**`down.sql`** (R32), en orden inverso:
1. `RAISE EXCEPTION` si alguna entrega tiene líneas de más de un cliente (no se puede volver a un
   cliente por entrega sin perder datos) o si alguna no tiene líneas.
2. `ADD COLUMN "customer_id"` en `order_deliveries`, rellenada con el único cliente de sus líneas,
   `SET NOT NULL`, su FK compuesta y su índice con los nombres de QC-223.
3. Quita `order_delivery_lines_delivery_customer_batch_unique` y repone
   `order_delivery_lines_delivery_batch_unique` (no choca: con un cliente por entrega, un lote sale
   una vez por entrega).
4. Quita el índice, la FK y la columna `customer_id` de `order_delivery_lines`.

**Empresa (R30).** La FK nueva es compuesta con `company_id`, igual que la que se va: una línea no
puede apuntar al cliente de otra empresa.

**RLS.** No hay tabla nueva; las dos tablas ya tienen `ENABLE` y `FORCE`.

**`db/schema.prisma`:**
- `OrderDelivery` pierde `customerId` y `@@index([companyId, customerId], map: "order_deliveries_customer_id_idx")`.
- `OrderDeliveryLine` gana `customerId String @map("customer_id") @db.Uuid`, sin `@relation`
  (`Customer` es de `clientes`; la FK es drift, como la que tenía la entrega), y
  `@@index([companyId, customerId], map: "order_delivery_lines_customer_id_idx")`. El
  `@@unique([deliveryId, batchId])` pasa a `@@unique([deliveryId, customerId, batchId], map: "order_delivery_lines_delivery_customer_batch_unique")`.
- Los comentarios de los dos modelos se reescriben sin citar fichas.

## 2. Contrato (lo publica T0)

### 2.1 Funciones puras: `pedidos/domain/order-delivery.ts` (R12–R20, R23)

Se amplía el archivo que ya existe. `checkDelivery` y `remainingPackages` **no cambian**: ya suman
por línea y por lote todas las asignaciones que reciben, así que el sheet y el servidor les pasan las
de todos los clientes juntas (`flattenBlocks`).

```ts
export type DeliveryCustomerBlock = {
  /** `null` solo en el sheet: el bloque aún no tiene cliente. */
  readonly customerId: string | null;
  readonly allocations: readonly DeliveryAllocation[];
};

export type DeliveryBlockIssue = 'missing_customer' | 'duplicate_customer' | 'no_packages';

/** Por índice de bloque, el primer problema en el orden missing_customer, duplicate_customer
 *  (frente a un bloque anterior), no_packages. Los bloques sin problema no aparecen. */
export function checkDeliveryBlocks(
  blocks: readonly DeliveryCustomerBlock[],
): ReadonlyMap<number, DeliveryBlockIssue>;

export function flattenBlocks(blocks: readonly DeliveryCustomerBlock[]): readonly DeliveryAllocation[];

/** max(0, available - suma de `allocations` en `batchId`). Con las de todos los bloques da los
 *  «Disponibles» (R13); con las de los demás bloques, el tope del campo (R14). */
export function packagesLeftInBatch(
  availablePackages: number,
  allocations: readonly DeliveryAllocation[],
  batchId: string,
): number;
```

`DELIVERY_MAX_ALLOCATIONS` (200) pasa a contar las asignaciones de todos los clientes juntos.

### 2.2 Puertos

`ports/order-delivery-repository.ts`:

```ts
export type NewOrderDelivery = {        // pierde customerId
  readonly deliveryKey: string;
  readonly orderId: string;
  readonly actorId: string;
  readonly now: Date;
};

export type NewOrderDeliveryLine = {    // gana customerId
  readonly customerId: string;
  readonly presentationLineId: string;
  readonly batchId: string;
  readonly packages: number;
  readonly quantity: string;
};
```

`findByKey`, `create`, `addLines` y `sumDeliveredPackages` conservan su firma.

`ports/order-delivery-void-repository.ts`:
- `DeliveryLineForVoid` gana `readonly customerId: string`.
- `DeliveryHistoryRow` pierde `customerId`; cada elemento de `lines` gana `customerId`.

### 2.3 `inventario`: salida y devolución agregadas por lote (R24, R26, R42)

`FinishedGoodsDispatchInput.allocations` **puede repetir `batchId`** (una vez por cliente). El
contrato de la salida queda así:
- valida y bloquea como hoy;
- descuenta **una vez por lote** la suma de sus envases × contenido, con el mismo decremento
  condicional (`stock >= cantidad`);
- si no alcanza, devuelve `insufficient` con los envases enteros que quedan;
- escribe **un asiento por lote** con la suma en negativo;
- devuelve `lines` **una por asignación de entrada, en el mismo orden**, con su `quantity`
  (`packages × packageContent`, exacta).

Así la suma de las líneas de un lote es el asiento, sin redondeos (los dos salen de la misma
multiplicación exacta).

`FinishedGoodsReturnInput.lines` **puede repetir `batchId`**. La devolución suma por lote, hace un
`increment` y escribe **un asiento `delivery_void` por lote** con la suma.

Los índices únicos de asientos por (entrega, lote) y por (anulación, lote) no cambian. Ninguna
firma exportada de `inventario` cambia: cambia lo que admite la entrada.

### 2.4 Casos de uso de `pedidos`

`domain/deliver-order.ts` (R2, R21–R29):

```ts
const allocationSchema = z.strictObject({
  presentationLineId: z.string().uuid(),
  batchId: z.string().uuid(),
  packages: z.number().int().min(1),
});

const deliverOrderSchema = z.strictObject({
  orderId: z.string().uuid(),
  deliveryKey: z.string().uuid(),
  customers: z.array(z.strictObject({
    customerId: z.string(),              // la forma la decide requireAliveCustomer (R22)
    allocations: z.array(allocationSchema).min(1),   // R21: sin envases → invalid_input
  })).min(1),
}); // + refine: total de asignaciones <= DELIVERY_MAX_ALLOCATIONS; customerId sin repetir;
    //   (presentationLineId, batchId) sin repetir dentro de cada cliente.
```

`customerId` se reemplaza por `customers`: la forma vieja responde `invalid_input` (campo de más y
campo ausente). El sheet es el único llamador (§7).

Orden, sin cambios salvo los pasos marcados:
1. `requirePermission(actor, 'entregas.modificar')` (R2).
2. `safeParse`; después `checkDeliveryBlocks` sobre la entrada, y cualquier problema es
   `ValidationError` (R20, R21).
3. `deliveries.findByKey` → `already_registered` (R28).
4. **Nuevo:** `requireAliveCustomer` por cada cliente, en el orden de la entrada; el primero que falla
   lanza `CustomerNotFoundError` (R22).
5. `assertTransition('TERMINADO', 'ENTREGADO')` y `unitOfWork.run` (§4).

`DeliverOrderResult` no cambia.

`domain/void-delivery.ts` (R3, R39–R42):

```ts
const voidDeliverySchema = z.strictObject({
  deliveryId: z.string().uuid(),
  voidKey: z.string().uuid(),
  items: z.array(z.strictObject({
    customerId: z.string().uuid(),
    presentationLineId: z.string().uuid(),
  })).min(1).max(DELIVERY_MAX_ALLOCATIONS),
  reason: z.string().trim().min(1).max(500),
}); // + refine: pares (customerId, presentationLineId) sin repetir (R39)
```

`presentationLineIds` se reemplaza por `items`. `linesToVoid` filtra por el par: un par sin líneas en
la entrega es `ValidationError` (R39); una línea del par ya anulada es `DeliveryAlreadyVoidedError`
(R40). El resto del flujo de QC-224 §4 no cambia.

`domain/list-order-deliveries.ts` (R33, R34): `OrderDeliveryHistoryView.deliveries[]` cambia:

```ts
readonly deliveries: readonly {
  readonly id: string;
  readonly createdAt: string;
  readonly authorName: string;
  readonly packages: number;            // todas sus líneas, anuladas incluidas (tablero, «Envases»)
  readonly customers: readonly {
    readonly customerId: string;
    readonly customerName: string;      // aunque esté dado de baja
    readonly presentations: readonly {  // misma forma que hoy, por cliente
      readonly presentationLineId: string;
      readonly presentationName: string;
      readonly packages: number;
      readonly batches: readonly { readonly batchId: string; readonly lot: string; readonly packages: number }[];
      readonly void: { readonly reason: string; readonly authorName: string; readonly createdAt: string } | null;
    }[];
  }[];
}[];
```

Los clientes van por nombre ascendente y, a igualdad, por `customerId`. Las presentaciones, en el
orden de las líneas del reparto, como hoy. El número de clientes es `customers.length`.

`domain/get-order-delivery.ts`: no cambia. Su `customer` sigue siendo el del pedido y lo usa la
precarga (R4, R5). `DeliverableBatch.expiryDate` se sigue devolviendo; el sheet deja de pintarlo (R7).

### 2.5 Server Actions (`pedidos/adapters/driving/order-actions.ts`)

```ts
export type DeliverOrderInput = {
  readonly orderId: string;
  readonly deliveryKey: string;
  readonly customers: readonly { readonly customerId: string; readonly allocations: readonly DeliveryAllocation[] }[];
};

export type VoidDeliveryInput = {
  readonly deliveryId: string;
  readonly voidKey: string;
  readonly items: readonly { readonly customerId: string; readonly presentationLineId: string }[];
  readonly reason: string;
};
```

Nombres, actor por petición y traductor de errores, como hoy.

### 2.6 Códigos de error

Ninguno nuevo. `invalid_input`, `customer_not_found`, `delivery_exceeds_remaining`,
`delivery_batch_insufficient`, `delivery_already_voided` y `unauthorized` cubren todos los casos. Los
textos de los errores de bloque (R16–R18) y el aviso de stock (R15) son de la pantalla, no del
catálogo (los copia el sheet del tablero).

### 2.7 `inventario`: tab Entregas (R43, R44)

La fila del tab pasa de **asiento** a **línea de entrega**. Hoy el tab pagina asientos de entrega y
los completa con `findDeliveryDetails`, indexado por lote; con varios clientes, un asiento son varias
filas y la página dejaría de tener el tamaño pedido (A5).

`inventario/domain/finished-product-detail.ts`:

```ts
/** Hueco para `pedidos`: las tablas de entregas son suyas. Sin permisos: autoriza quien llama. */
export interface FinishedDeliveryDirectory {
  /** Líneas de entrega de esos lotes, anuladas o no, en orden createdAt desc de la entrega y id desc
   *  de la línea; con el tope y el defecto de tamaño de QC-225 R23. */
  listDeliveryLines(
    companyId: string,
    batchIds: readonly string[],
    page: PageRequest,
  ): Promise<Page<FinishedDeliveryLineRecord>>;
  summarizeDelivered(companyId: string, batchIds: readonly string[]): Promise<DeliveredTotal>; // sin cambio
}

export type FinishedDeliveryLineRecord = {
  readonly id: string;
  readonly orderDeliveryId: string;
  readonly orderId: string;
  readonly createdAt: string;
  readonly customerId: string;
  readonly batchId: string;
  readonly packages: number;
  readonly quantity: string;            // positiva
  readonly void: { readonly reason: string } | null;
};

export type FinishedProductDeliveryRow = {
  readonly deliveryLineId: string;      // era movementId
  readonly orderDeliveryId: string;
  readonly createdAt: string;
  readonly customer: CustomerRef | null;
  readonly orderNumberText: string | null;
  readonly presentationName: string | null; // nuevo (R43)
  readonly batchId: string;
  readonly lot: string;
  readonly packages: number;            // ya no puede faltar: la fila es la línea
  readonly quantity: string;
  readonly void: { readonly reason: string } | null;
};
```

- `findDeliveryDetails` desaparece (sus dos usos los sustituye `listDeliveryLines`).
- `FinishedProductDetailRepository.listDeliveryMovements` desaparece, con su adaptador.
- El lote sale de `record.batches` y la presentación de `record.presentation?.name`: todos los lotes
  de un producto terminado son de su presentación (QC-150, un producto por receta y presentación).
  *Observación para el humano, sin reabrir D12:* dentro de la ficha de un producto, la columna
  «Presentación» repite siempre el mismo nombre.
- El total entregado (`summarizeDelivered`) no cambia (R44).

## 3. Por qué un asiento por lote y no por línea

El asiento es el movimiento físico del lote; el reparto entre clientes es un dato comercial de
`pedidos`. Mantener un asiento por (entrega, lote) y por (anulación, lote):
- conserva los dos índices únicos del libro y los censos de `inventario` sin tocar;
- deja el tab Salidas de QC-225 igual (una salida por lote y entrega);
- la cuadratura es exacta: la suma de las líneas de un lote en una entrega es su asiento, y lo
  comprueba `ledger-cuadre.int.test.ts` (R26).

Alternativa en §11 (A3).

## 4. Escritura: flujo de la transacción (R23–R29)

Igual que QC-223 §4, con estos cambios:

2. Cada `presentationLineId` de todos los clientes tiene que estar en las líneas del reparto; si no,
   `ValidationError` (R21).
3. `deliveries.create` sin cliente.
5. `checkDelivery(lines, null, flattenBlocks(customers))`: el tope por presentación sobre la suma
   (R23).
6. Por cada línea del reparto, `dispatchForDelivery` con las asignaciones de **todos** los clientes
   para esa línea, en el orden cliente → asignación. `inventario` agrega por lote (§2.3). `insufficient`
   lanza `DeliveryBatchInsufficientError` (R24).
7. `addLines` con una línea por asignación, cada una con su `customerId` y la `quantity` que devolvió
   `inventario` en la misma posición.

El orden de bloqueo (pedido, producto, lote) no cambia: R28 de QC-223 (concurrencia) sigue cubierto
por los mismos tests, ampliados con un caso de dos clientes.

## 5. Anulación (R39–R42)

- `findDeliveryLines` devuelve `customerId` en cada línea.
- `linesToVoid(lines, items)`: selecciona las líneas cuyo par está en `items`; si un par no selecciona
  ninguna línea, `ValidationError`; si alguna seleccionada ya está anulada, `DeliveryAlreadyVoidedError`.
- `returnForDeliveryVoid` recibe una entrada por línea; `inventario` agrega por lote (§2.3).
- Sigue igual: una anulación por envío, su motivo, su clave, `ENTREGADO → TERMINADO`, el bloqueo y el
  rechazo concurrente por el único de `order_delivery_void_lines`.

## 6. Lecturas (R33–R35, R43, R44)

- `listByOrder` (`order-delivery-void-prisma.ts`) deja de seleccionar `customerId` de la entrega y lo
  toma de cada línea.
- `createListOrderDeliveries` agrupa por cliente y, dentro, por línea del reparto. Una presentación de
  un cliente está anulada si lo están sus líneas (se anulan juntas, R41); basta con mirar la primera.
- `listDeliveryLines` (`order-delivery-directory-prisma.ts`) hace `findMany` sobre
  `order_delivery_lines` de la empresa con `batchId IN`, con la entrega (fecha, pedido) y la línea de
  anulación, y un `count` con el mismo filtro.

## 7. UI

### 7.1 Sheet «Entregar» (`order-delivery-sheet.tsx`, R4–R19)

- **Estado:** el borrador v2 (§8) con `blocks: { key, customer, packages }[]`.
- **Derivados en cada render**, todos con las funciones de §2.1 sobre los valores parseados:
  - `checkDelivery(view.lines, lotes, flattenBlocks(...))` para el resumen y R12;
  - `packagesLeftInBatch` por lote para «Disponibles» (R13) y por lote y bloque para el tope (R14);
  - lotes con lo escrito > disponibles → `stockOver` (R15);
  - `checkDeliveryBlocks` para los errores de bloque, que se pintan solo tras pulsar «Entregar»
    (R16–R18).
- **Composición (tablero):** cabecera; aviso de borrador ajustado (si aplica); `OrderDeliverySummary`;
  un `OrderDeliveryCustomerBlock` por bloque; botón `outline-dashed` «Añadir cliente»; aviso de stock;
  pie con «Cancelar» y «Entregar» (`disabled` si `stockOver`).
- **Lista de lotes**: columnas «Lote · Disponibles · Entrada (campo)». Se quita «Vence» (R7). La fecha
  de entrada del lote queda a la espera de P1.
- **Envío:** `deliverOrderAction({ orderId, deliveryKey, customers })` con un elemento por bloque y,
  dentro, solo las asignaciones mayores que cero.
- **Respuesta:** como QC-223 §6.2 (R33 y R34 de QC-223 siguen vigentes). `customer_not_found` se
  muestra con el error genérico del sheet, como hoy.
- **Test ids nuevos:** `order-delivery-summary`, `order-delivery-summary-line` (con
  `data-presentation-line-id`), `order-delivery-block` (con `data-block-index`),
  `order-delivery-block-remove`, `order-delivery-block-error`, `order-delivery-add-customer`,
  `order-delivery-batch-over` y `order-delivery-stock-over`. Desaparecen
  `order-delivery-customer-error`, `order-delivery-empty-error` y `order-delivery-batch-exceeds`
  (los sustituyen los de bloque y «Solo hay N»). `order-delivery-line-exceeds` pasa a la marca
  «Sobran N» del resumen.

### 7.2 Lista de entregas (`order-delivery-list.tsx`, R33–R35)

Tarjeta por entrega con «Fecha · Clientes · Envases · Entregó» y un `section` por cliente
(`order-delivery-entry-customer`, con `aria-label` = nombre), como el tablero. La marca «Anulada»
(`StatusBadge`) va por presentación dentro del subbloque.

### 7.3 Diálogo (`delivery-void-dialog.tsx`, R36–R38)

- Estado `checked: ReadonlySet<"<customerId>:<presentationLineId>">`, **vacío al abrir**.
- Un `fieldset` por cliente con su casilla de grupo (`delivery-void-group-toggle`, `Checkbox` con
  `checked` = todos e `indeterminate` = algunos) y una casilla por par (`delivery-void-presentation`,
  con `data-customer-id` y `data-presentation-line-id`).
- Envía `items` con los pares marcados.

### 7.4 `Checkbox` (`components/ui/checkbox.tsx`)

Prop opcional `indeterminate?: boolean`, que se pasa a la raíz de Base UI (que ya emite
`aria-checked="mixed"`), y un indicador con un guion en ese estado. Sin la prop, nada cambia. La fila
del catálogo gana el punto de extensión.

### 7.5 Tab Entregas (`finished-product-deliveries-table.tsx`, R43)

Columna «Presentación» entre «Pedido» y «Lote», con `EMPTY_MARK` si es `null`. La clave de fila pasa a
`deliveryLineId`.

## 8. Borrador (R45, R46)

`order-delivery-draft.ts`, versión 2:

```ts
type OrderDeliveryDraftV2 = {
  readonly v: 2;
  readonly orderId: string;
  readonly deliveryKey: string;
  readonly blocks: readonly {
    readonly key: string;                               // id local del bloque, para React
    readonly customer: OrderCustomer | null;
    readonly packages: Readonly<Record<string, string>>; // "<lineId>:<batchId>" → texto escrito
  }[];
};
```

- La clave de `localStorage` no cambia (`qc.order-delivery-draft.<orderId>`).
- Un borrador **v1** guardado antes del despliegue se lee como un solo bloque con su cliente y sus
  envases: así nadie pierde una entrega a medias. Uno corrupto o de otra versión se descarta, como
  hoy.
- El borrador nuevo sale de `get-order-delivery` según R4 y R5.
- El ajuste recorre todos los bloques y quita los envases de lotes que ya no se ofrecen; `adjusted`
  solo es `true` en ese caso (R46).
- `use-order-delivery-draft.ts` gana `addBlock`, `removeBlock(key)`, `setCustomer(key, …)` y
  `setPackages(key, …)`; guarda en cada cambio (R45). Borrar al cancelar y al aplicar no cambia.

## 9. Censos, guardias y llamadores afectados

Cada enmienda conserva las aserciones previas y lleva una nota fechada 2026-10-15.

| Archivo | Qué censa | Cambio | Task |
|---|---|---|---|
| `tests/guards/guard-identificador-de-request.test.ts` | `MIGRACIONES_ESPERADAS`, `E2E_ESPERADOS` | + la migración; + `entrega-a-varios-clientes.spec.ts` | B1, TI |
| `tests/unit/clientes/scope.test.ts:540` | migraciones que tocan `customers` | + la migración (crea una FK hacia `customers`) | B1 |
| `tests/unit/pedidos/schema/pedidos-schema.test.ts` | referencias sin `@relation` | − `OrderDelivery.customerId`, + `OrderDeliveryLine.customerId` | B1 |
| `tests/unit/pedidos/order-delivery-append-only.test.ts` | caminos que modifican entregas | verificar que no barre `db/migrations` (el `UPDATE` es de la migración) | TC |
| `tests/integration/pedidos/order-delivery-constraints.int.test.ts` | restricciones de QC-223 R31 | el caso «dos líneas del mismo lote» pasa a «mismo cliente y lote»; + R30 | B1 |
| `tests/integration/inventario/ledger-cuadre.int.test.ts` | cuadre libro ↔ líneas | + caso de dos clientes en un lote | B2 |
| `tests/helpers/order-delivery-seed.ts` | siembra de entregas | `customer_id` pasa a las líneas | B1 |
| `tests/integration/aislamiento.json` | modo de cada `.int.test.ts` | + cada suite nueva | B1, B3 |
| `e2e/entregar-producto-terminado.spec.ts`, `e2e/anular-entrega.spec.ts`, `e2e/detalle-de-producto-terminado.spec.ts` | SQL y pasos de QC-223/224/225 | `customer_id` desde las líneas; el diálogo abre sin nada marcado | TI |
| `components/shared/CATALOGO.md` | fila de `Checkbox` | punto de extensión `indeterminate` | F3 |
| `lib/composition/index.ts` | atado de puertos | `deliveries` de QC-225 con `listDeliveryLines` | B4 |

Llamadores de tipos que cambian (todos en `typecheck`): `NewOrderDelivery`, `NewOrderDeliveryLine`,
`DeliverOrderInput`, `VoidDeliveryInput`, `DeliveryHistoryRow`, `OrderDeliveryHistoryView`,
`FinishedDeliveryDirectory`, `FinishedProductDeliveryRow`, y sus fixtures
(`tests/fixtures/order-delivery.ts`, `order-delivery-void.ts`, `finished-product-detail.ts`).

Sin cambio, verificado: el catálogo de permisos (R1), el enum `InventoryMovementKind`, los caminos de
escritura de `product_batches` (`guard-libro-de-inventario`: `dispatchFinishedGoods` y
`returnFinishedGoods` siguen siendo los mismos caminos) y las rutas (`guard-pantallas-exigen-permiso`).

## 10. Enmiendas a specs anteriores

Las aprueba el humano con este spec.

| Spec | Requisito | Queda así |
|---|---|---|
| QC-223 | R6 | sustituido por el resumen de R11 (pendiente de P2) |
| QC-223 | R7 | sin vencimiento (R7); fecha de entrada pendiente de P1 |
| QC-223 | R9, R10, R14 | por bloque (R4, R5, R10, R16) |
| QC-223 | R11, R12 | R12 y R15 (el exceso por lote ya no avisa: limita y deshabilita) |
| QC-223 | R13, R15 | el campo solo admite dígitos (R14); «nada que entregar» pasa a «este cliente no lleva envases» (R18) |
| QC-223 | R16 | R20 |
| QC-223 | R21, R22, R25 | R21, R22, R25 (el cliente va en cada línea) |
| QC-223 | R24, R31 | un asiento por lote con la suma (R26); el único de líneas pasa a (entrega, cliente, lote) (R30) |
| QC-223 | R35, R37 | R45, R46 |
| QC-224 | R7, R9, R10 | R33, R34, R35 |
| QC-224 | R11 | R36, R37 (sin nada marcado; por cliente) |
| QC-224 | R17, R20, R21, R22, R24 | R39, R40, R41, R42 |
| QC-225 | R19, R33 | R43, R44 (fila por línea de entrega, columna «Presentación») |

## 11. Alternativas descartadas

- **A1 — Tabla `order_delivery_customers` (un bloque por fila) con las líneas colgando de ella.**
  Daría un id estable a cada bloque y un único `(delivery_id, customer_id)` explícito. Se descarta:
  - permite un bloque sin líneas, que D15 prohíbe, y la base no lo impide sin un disparador diferido;
  - añade una tabla, dos FK compuestas y otra migración de datos;
  - ningún requisito lee el id del bloque: anular, listar y el tab Entregas filtran por cliente.
- **A2 — Conservar `order_deliveries.customer_id` como «primer cliente» y añadir el cliente a las
  líneas.** Ahorra la migración de datos, pero deja dos caminos de lectura del cliente, y D11 pide uno
  solo.
- **A3 — Un asiento por línea (por cliente y lote).** Haría coincidir una fila de Entregas con un
  asiento, pero obliga a quitar los dos índices únicos del libro o a añadir una columna de línea en
  `inventory_movements`. Además partiría en varias salidas un único movimiento físico del lote, y el
  libro es de `inventario`, que no sabe de clientes.
- **A4 — Una entrega por cliente agrupadas por una «clave de grupo».** Reutilizaría QC-223 tal cual,
  pero D2 pide una sola entrega; la idempotencia y el paso a `ENTREGADO` tendrían que coordinar varias
  filas.
- **A5 — Seguir paginando el tab Entregas por asientos y expandir cada uno en sus líneas.** Rompe el
  tamaño de página de QC-225 R23: una página de 10 asientos podría dar 25 filas.
- **A6 — Excluir del buscador los clientes ya elegidos en otros bloques.** Evitaría R17, pero el
  tablero aprobado muestra el error de cliente repetido; y un borrador restaurado puede traer
  repetidos igualmente.

## 12. Trazabilidad prevista (R → test)

Rutas abreviadas:
- **u:** `tests/unit/pedidos/` (o `inventario/`, `identity/`)
- **ui:** `tests/unit/pedidos-ui/` (o `inventario-ui/`, `shared-ui/`)
- **int:** `tests/integration/pedidos/` (o `inventario/`)
- **mig:** `tests/integration/pedidos/order-delivery-lines-customer-migration.int.test.ts`
- **e2e:** `e2e/entrega-a-varios-clientes.spec.ts`

| R | Test previsto |
|---|---|
| R1 | u `identity/permissions.test.ts` (catálogo exacto sin cambios) + `tests/guards/guard-permisos-sembrados.test.ts` |
| R2 | u `deliver-order.test.ts` (forma nueva, puertos sin llamar) |
| R3 | u `void-delivery.test.ts` (forma nueva, puertos sin llamar) |
| R4, R5 | ui `order-delivery-sheet.test.tsx` |
| R6, R7 | ui `order-delivery-sheet.test.tsx` (sin «Vence» en tabla ni en tarjetas) |
| R8, R9 | ui `order-delivery-sheet.test.tsx` |
| R10 | u `search-order-customer-options.test.ts` (sin cambio, se re-ejecuta) |
| R11, R12 | ui `order-delivery-summary.test.tsx` + `order-delivery-sheet.test.tsx` (la action no se llama) |
| R13, R14, R15 | u `order-delivery.test.ts` (`packagesLeftInBatch`) + ui `order-delivery-sheet.test.tsx` |
| R16, R17, R18 | u `order-delivery.test.ts` (`checkDeliveryBlocks`) + ui `order-delivery-sheet.test.tsx` |
| R19 | ui `order-delivery-sheet.test.tsx` (payload exacto de la action) |
| R20 | u `order-delivery.test.ts`: caso que lee las fuentes del sheet y de `deliver-order.ts` y exige que importen `checkDelivery`, `checkDeliveryBlocks` y `packagesLeftInBatch` del barrel |
| R21 | u `deliver-order.test.ts` (tabla de formas); int `order-delivery.int.test.ts` |
| R22 | u `deliver-order.test.ts`; int `order-delivery.int.test.ts` (segundo cliente de B o dado de baja) |
| R23 | u `deliver-order.test.ts`; int `order-delivery.int.test.ts` (suma de dos clientes) |
| R24 | u `inventario/finished-goods-dispatch-prisma.test.ts`; int `inventario/finished-goods-dispatch.int.test.ts` (lote repetido entre clientes) |
| R25 | int `order-delivery.int.test.ts` (una entrega, líneas por cliente, `orders.customer_id` intacto) |
| R26 | int `inventario/finished-goods-dispatch.int.test.ts`; int `inventario/ledger-cuadre.int.test.ts` |
| R27 | u `deliver-order.test.ts`; int `order-delivery.int.test.ts` |
| R28 | u `deliver-order.test.ts`; int `order-delivery.int.test.ts` (misma clave dos veces) |
| R29 | int `order-delivery.int.test.ts` (lote insuficiente en el segundo cliente: nada escrito) |
| R30 | int `order-delivery-constraints.int.test.ts` (`INSERT` crudos) |
| R31, R32 | mig (up sobre datos de QC-223 y QC-224; up abortado sin líneas; down con un cliente; down abortado con dos) + u `pedidos/schema/order-delivery-lines-customer-migration.test.ts` (texto del SQL) |
| R33, R34 | u `list-order-deliveries.test.ts`; ui `order-delivery-list.test.tsx` |
| R35 | ui `order-delivery-list.test.tsx` |
| R36, R37, R38 | ui `delivery-void-dialog.test.tsx`; ui `tests/unit/shared-ui/checkbox-indeterminate.test.tsx` (`indeterminate` → `aria-checked="mixed"`; sin la prop, igual que hoy) |
| R39, R40, R41 | u `void-delivery.test.ts`; int `order-delivery-void.int.test.ts` |
| R42 | int `inventario/finished-goods-return.int.test.ts` (lote repetido entre clientes); int `order-delivery-void.int.test.ts` |
| R43, R44 | u `inventario/list-finished-product-deliveries.test.ts`; int `order-delivery-directory.int.test.ts`; ui `inventario-ui/finished-product-tables.test.tsx` |
| R45, R46 | ui `order-delivery-draft.test.ts` (v2, lectura de v1, ajuste) + `order-delivery-sheet.test.tsx` |
| R47 | e2e |
| R48 | `tests/guards/guard-dependencias-aprobadas.test.ts` |

## 13. Dependencias e integraciones

- **Dependencias:** ninguna (R48). `Checkbox` ya es de `@base-ui/react`; los iconos, de `lucide-react`.
- **Integraciones externas:** ninguna.
