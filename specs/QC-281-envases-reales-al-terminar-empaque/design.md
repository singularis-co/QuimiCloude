# QC-281 — Envases reales al terminar el empaque · design

## Lo que ya existe

**Búsqueda de duplicados** (`docs/specs.md > Antes de especificar`). El leader la hizo antes de
lanzar el spec: board (`feature_list.json`), `specs/` y grafo, con «envases reales», «conteo de
envases», «motivo de diferencia» y «terminar empaque»: **nada** que resuelva esta feature. Al
escribir el spec se buscó también en el grafo `finishPackingAliveById`, `packedPackages`,
`real_packages`, `packing count`: nada. Lo que aparece es código a **reutilizar**, no a re-crear:

| Pieza existente | Dónde | Uso en QC-281 |
|---|---|---|
| `createFinishPacking` (Terminar en `pedidos`) | `lib/modules/pedidos/domain/order-packing.ts` | Se extiende: recibe el conteo, valida, guarda y usa lo real. Hoy usa `line.packages` tal cual (líneas 93, 153, 246). |
| `createFinishPacking` (caso de uso en `asignaciones`) | `lib/modules/asignaciones/domain/finish-packing.ts` | Se extiende la entrada zod con `lines`; permiso y comprobación de empacador intactos (QC-168). |
| **La conversión del reparto (D15)** | `sumInOrderUnit` y `validateDistribution`, `lib/modules/pedidos/domain/order-distribution.ts:108-165` | Es **la** conversión que pidió el humano: «La comparten el guardado del reparto y Terminar el empaque para que el total con el que se valida y el total con el que se reparte el coste no puedan divergir». El tope (R8, R15) y el coste (R21) la llaman con los envases reales. |
| Reparto del coste por unidad del pedido | `unitCostByPresentationUnit` + `divideCost`, `order-packing.ts:114-168` | Se reutiliza con envases reales (R21). |
| Libro de reservas | `MaterialReservations` (`lib/modules/inventario/domain/reservation.ts`), `reservation-prisma.ts` (`consumeForOrder`, `planReservation`, `netReservedByBatch`, `consumeBatchStock`) | Se añade **un** método que liquida los envases con el conteo real reutilizando esas piezas internas (ver § 4). |
| Disponible libre de un envase | `PackagingCatalog.findRefs(...).available` (sin `excludeOrderId` descuenta todo lo apartado) | Alimenta «quedan L libres» del diálogo (R9, R10). |
| Motivos | `MOVEMENT_REASONS`, `STOCK_INCREASE_REASONS` (`lib/modules/inventario/domain/movement-reason.ts`); `movementReasonLabel` (`app/(private)/inventario/components/movement-reason-label.ts`) | Fuente de la lista (D7). `STOCK_INCREASE_REASONS` se exporta por el barrel de `inventario` (hoy no lo está). |
| Tope de texto libre | `z.string().trim().min(1).max(500)` en `order-input.ts:177` y `void-delivery.ts:44` | Mismo tope para «Otro» (pregunta abierta 3). |
| Detalle de producto terminado (QC-225) | `app/(private)/inventario/producto-terminado/[id]/` + `list-finished-product-*.ts` | Tab 8.ª calcada de «Entregas»: misma sección, mismo `DataTable`, mismo patrón de directorio hacia `pedidos` (`FinishedDeliveryDirectory` ↔ `order-delivery-directory-prisma.ts`). |
| Bloqueo de acondicionamiento por datos de lote | `missingBatchDataLines`, `lib/modules/asignaciones/domain/conditioning-batch-data.ts` | Se ajusta para que una línea en 0 no bloquee (R23). |
| Tope de entrega por línea | `orderedPackages: line.packages` en `deliver-order.ts:118` y `get-order-delivery.ts:75` | Pasa a los envases reales (R24). |

### Componentes (`components/shared/CATALOGO.md`)

Filas consultadas: `ConfirmDialog`, `DataTable`, `EmptyState`, `ErrorAlert`, `ErrorState`,
`FieldError`, `Notice`, `OrderDistributionLabel`, `SelectField`, `StatusBadge`, `TableSkeleton`,
`TextField`, `UrlTabs`.

| Pieza | Paso de la regla de decisión | Justificación |
|---|---|---|
| `PackingFinishDialog` (nuevo, `app/(private)/asignacion/empaque/[id]/components/packing-finish-dialog.tsx`) | **3. Compone** | Sustituye al `ConfirmDialog` de Terminar: `ConfirmDialog` no cubre un cuerpo con campos. Compone `ui/dialog`, `ui/button` (`touch`), `ui/input` (`inputMode="numeric"`), `SelectField`, `TextField`, `FieldError`, `StatusBadge`, `orderDistributionLineText`, `ui/sonner`. Pieza de UNA ruta: se queda en `components/` de la ruta. Tablero aprobado: `EmpaqueTerminar*.dc.html`. |
| `FinishedProductDistributionTable` (nuevo, `app/(private)/inventario/producto-terminado/[id]/components/finished-product-distribution-table.tsx`) | **3. Compone** | Igual que las otras tablas de la ficha: `DataTable`, `StatusBadge`, `movementReasonLabel`; los estados los pone `FinishedProductListSection` (`TableSkeleton`, `EmptyState`, `ErrorState`). Tablero: `ProductoTerminadoReparto*.dc.html`. |
| `PackingOrderScreen` | **1. Reutiliza** (cambio visual) | Quita «Envases:» y abre el diálogo nuevo. Tablero: `Empaque*.dc.html`. |
| `packing-orders-columns` | **1. Reutiliza** (cambio visual) | Quita la columna «Envases». Tablero: `Asignacion*.dc.html`. |
| `FinishedProductTabs` | **1. Reutiliza** | Una entrada más en la lista de tabs. Tablero: `ProductoTerminado*.dc.html`. |

Ninguna pieza sube a `components/shared`: cada una la usa una sola ruta.

### Tableros `/design` aprobados (2026-10-14, commit `3848e0d9`)

- `docs/diseno/canvas/EmpaqueTerminar.dc.html`, `EmpaqueTerminarTablet.dc.html`,
  `EmpaqueTerminarMovil.dc.html` (ficha) y `EmpaqueTerminarEstados.dc.html`: el diálogo, sus 7
  estados (`igual`, `diferencia`, `otro`, `tope`, `stock`, `cero`, `sinMotivo`), textos y animaciones.
- `docs/diseno/canvas/Empaque.dc.html`, `EmpaqueTablet.dc.html`, `EmpaqueMovil.dc.html`: pantalla de
  empaque sin «Envases:»; Terminar abre el diálogo nuevo.
- `docs/diseno/canvas/Asignacion.dc.html`, `AsignacionTablet.dc.html`, `AsignacionMovil.dc.html`:
  «Por empacar» sin columna «Envases».
- `docs/diseno/canvas/ModalesOperario.dc.html`: modales del operario con el diálogo nuevo.
- `docs/diseno/canvas/ProductoTerminado.dc.html`, `ProductoTerminadoTablet.dc.html`,
  `ProductoTerminadoMovil.dc.html`: la 8.ª tab «Reparto».
- `docs/diseno/canvas/ProductoTerminadoReparto.dc.html`, `ProductoTerminadoRepartoTablet.dc.html`,
  `ProductoTerminadoRepartoMovil.dc.html` (ficha): la tab, sus estados de fila y de tab.

Lo que fijan las fichas y el implementer debe respetar:
- **Diálogo** — escritorio y tablet 720 px centrado, cabecera fija, filas con scroll propio, pie
  fijo; teléfono a pantalla completa (`full-m`), el −/+ en su propia fila, motivo y texto a todo el
  ancho, pie con `safe-area-inset-bottom` y Terminar al doble de ancho que Cancelar. Controles de
  44/48 px.
- **Animación** — zoom desde 96 % (300 ms al abrir, 150 ms al cerrar); bloque de motivo y texto de
  «Otro» se despliegan con `grid-template-rows` 0 → auto + subida de 10 px en 200 ms; errores con
  `qc-err` (150 ms); la insignia cambia de tono en 200 ms; lista del Select 200/150 ms; respeta
  `prefers-reduced-motion`.
- **Tab** — tabla de 6 columnas, números a la derecha en mono; tablet y teléfono con scroll
  horizontal (no pasa a tarjetas); la fila de tabs se desplaza en horizontal en teléfono.
- **Librerías** — ninguna nueva: `@base-ui/react` (Dialog, Select, Tabs), `lucide-react`, `sonner`,
  `@tanstack/react-table` vía `DataTable`.

## 1. Modelo de datos

### Tabla `order_presentation_lines` (módulo `pedidos`) — 3 columnas nuevas

| Columna | Tipo | Nulo | Significado |
|---|---|---|---|
| `packed_packages` | `INTEGER` | sí | Envases reales contados al Terminar. `NULL` = la línea no se ha terminado de empacar **o** se empacó antes de QC-281 (D16). |
| `packed_reason` | `TEXT` | sí | Motivo de la diferencia: `merma`, `rotura`, `conteo_fisico`, `error_de_carga` u `otro`. |
| `packed_reason_other` | `TEXT` | sí | Texto de «Otro», ya recortado. |

Prisma (`db/schema.prisma`, `model OrderPresentationLine`): `packedPackages Int? @map("packed_packages")`,
`packedReason String? @map("packed_reason")`, `packedReasonOther String? @map("packed_reason_other")`.
`reason` va como `TEXT` + `CHECK`, el mismo criterio que `inventory_movements.reason` (un enum de
Postgres obliga a recrear el tipo al añadir valores).

`CHECK` escritos a mano en la migración (defensa en profundidad; la validación manda en el dominio):

```sql
ALTER TABLE "order_presentation_lines"
  ADD CONSTRAINT "order_presentation_lines_packed_packages_non_negative"
  CHECK ("packed_packages" IS NULL OR "packed_packages" >= 0);

ALTER TABLE "order_presentation_lines"
  ADD CONSTRAINT "order_presentation_lines_packed_reason_in_catalog"
  CHECK ("packed_reason" IS NULL
         OR "packed_reason" IN ('merma', 'rotura', 'conteo_fisico', 'error_de_carga', 'otro'));

-- Motivo si y solo si hay diferencia, y del sentido correcto.
ALTER TABLE "order_presentation_lines"
  ADD CONSTRAINT "order_presentation_lines_packed_reason_matches_count"
  CHECK (
       ("packed_packages" IS NULL AND "packed_reason" IS NULL)
    OR ("packed_packages" = "packages" AND "packed_reason" IS NULL)
    OR ("packed_packages" < "packages" AND "packed_reason" IS NOT NULL)
    OR ("packed_packages" > "packages" AND "packed_reason" IN ('conteo_fisico', 'error_de_carga', 'otro'))
  );

-- Texto si y solo si el motivo es «Otro», y nunca vacío.
ALTER TABLE "order_presentation_lines"
  ADD CONSTRAINT "order_presentation_lines_packed_reason_other_matches"
  CHECK (
       ("packed_reason" = 'otro' AND "packed_reason_other" IS NOT NULL AND btrim("packed_reason_other") <> '')
    OR ("packed_reason" IS DISTINCT FROM 'otro' AND "packed_reason_other" IS NULL)
  );
```

- **Sin backfill** (R25): las líneas existentes quedan con `NULL`, que se lee como «real = plan, sin
  motivo». Guardar el plan en ellas haría indistinguible un pedido antiguo de uno nuevo sin
  diferencias, y la tab necesita la nota «Empacado antes de QC-281».
- `packages > 0` (`order_presentation_lines_packages_positive`) **no cambia**: el plan sigue siendo
  positivo; el 0 vive solo en `packed_packages`.
- **Empresa**: la tabla ya tiene `company_id` (copia de la del pedido); no hay tabla nueva, así que
  `guard-empresa-en-esquema` no cambia.
- **RLS**: la tabla ya tiene RLS + `FORCE` desde `20260927120000_order_presentation_lines`. Añadir
  columnas no cambia las policies. Recordatorio (`docs/architecture.md > Acceso a datos`): la
  autorización y el ámbito se prueban en el service, no en la policy.
- **Migración**: `db/migrations/<timestamp>_order_presentation_lines_packed_count/` (timestamp lo
  pone `pnpm run db:migrate:create`), con `migration.sql` (lo anterior) y `down.sql` que hace
  `DROP CONSTRAINT` de los cuatro `CHECK` y `DROP COLUMN` de las tres columnas, en orden inverso.
- No hay cambio en `inventory_movements` ni en `reservation_movements`: el envase se consume y se
  libera con los `kind` que ya existen (`consumption` / `consume` / `release`). El conteo NO va en el
  movimiento (D13).

### Constantes de dominio (`lib/modules/pedidos/domain/packing-count.ts`, nuevo, puro)

```ts
export const PACKING_DIFFERENCE_REASONS = [...MOVEMENT_REASONS, 'otro'] as const;      // menos
export const PACKING_INCREASE_REASONS = [...STOCK_INCREASE_REASONS, 'otro'] as const;  // más
export type PackingDifferenceReason = (typeof PACKING_DIFFERENCE_REASONS)[number];
export const PACKING_REASON_OTHER_MAX = 500;
```

Un test compara estas listas con las del `CHECK` de la migración (mismo patrón que
`guard-motivos-de-ajuste.test.ts`, pero como test unitario de esta feature, no como guardia nueva).

## 2. Contratos

### 2.1 Server Action `finishPackingAction` (sin cambio de firma)

`lib/modules/asignaciones/adapters/driving/order-packing-actions.ts`. El `FormData` lleva, además de
`orderId`, un campo `lines` con JSON:

```ts
type FinishPackingInput = {
  orderId: string;                  // uuid
  lines: Array<{
    lineId: string;                 // uuid de order_presentation_lines
    packedPackages: number;         // entero >= 0
    reason: PackingDifferenceReason | null;
    reasonOther: string | null;     // trim, 1..500, solo con reason === 'otro'
  }>;
};
```

`orderIdFromFormData` pasa a `finishPackingInputFromFormData`: lee `orderId` y hace `JSON.parse`
de `lines` (un JSON roto → `lines: undefined` → `ValidationError` del zod). Se usa JSON y no campos
indexados porque la entrada es una lista de objetos y el zod del dominio ya valida su forma: la
capa driving solo traduce, no decide.

Camino feliz: igual que hoy, `redirect` a «Por empacar» con el número del pedido.

### 2.2 Caso de uso `asignaciones.finishPacking(actor, input)`

`lib/modules/asignaciones/domain/finish-packing.ts`, en este orden (el de hoy, con un paso más):

1. `requirePermission(actor, 'empaque.modificar')` — antes de todo (R14).
2. zod `strictObject({ orderId: uuid, lines: array(strictObject({...})).min(1) })` con la forma de
   2.1 (R13: tipos, entero ≥ 0, `reasonOther` 1..500 tras `trim`). Que el array sea exactamente el
   conjunto de líneas del pedido lo comprueba `pedidos` (§ 3, paso 3), que es quien las lee.
3. Lee el pedido y comprueba fotos, como hoy.
4. `transaction.run` → `packing.finishPackingAliveById(orderId, companyId, actorId, now, counts)`.
5. Traduce los resultados nuevos a errores de `asignaciones`:

| Resultado de `pedidos` | Error de `asignaciones` | Código (`lib/modules/errores`) |
|---|---|---|
| `'invalid_packing_count'` | `ValidationError` | el de validación existente |
| `'packed_exceeds_quantity'` | `PackedExceedsQuantityError` (nuevo) | `packed_exceeds_quantity` (nuevo) |
| `'packaging_stock_insufficient'` | `PackagingStockInsufficientError` (nuevo) | `packaging_stock_insufficient` (nuevo) |

Los dos códigos nuevos entran en `error-codes.ts` y `error-catalog.ts` con su texto para el usuario
(`guard-catalogo-de-errores` lo exige). Textos: «Lo envasado supera la cantidad del pedido.» y «No
alcanza el stock del envase.» (el tablero solo fija los textos por línea; estos son los del
`ErrorAlert` de la pantalla si el servidor rechaza, p. ej. porque otro pedido apartó el envase
entre abrir el diálogo y Terminar).

### 2.3 `OrderCatalog['finishPackingAliveById']` (pedidos)

Firma con un parámetro más y tres resultados más:

```ts
finishPackingAliveById(
  id: string, companyId: string, packerId: string, now: Date,
  counts: readonly PackedLineCount[],     // { lineId, packedPackages, reason, reasonOther }
): Promise<
  | { kind: 'ok'; finishedGoods: readonly FinishedGoodsReceipt[] }
  | 'not_packer' | 'not_packable' | 'not_found' | 'recipe_not_found'
  | 'presentation_without_content' | 'incompatible_units' | 'order_without_unit'
  | 'insufficient_material'
  | 'invalid_packing_count'          // nuevo: faltan/sobran líneas, motivo incoherente (R13)
  | 'packed_exceeds_quantity'        // nuevo (R15)
  | 'packaging_stock_insufficient'   // nuevo (R18)
>;
```

### 2.4 Vista del pedido de empaque (`PackingOrderDetail`)

`lib/modules/asignaciones/domain/packing-order-view.ts` / `get-packing-order.ts`:

- **Fuera**: `packages` de `PackingOrderRow` y la llamada a `findFinishedGoodsReceipts` de esta
  vista (solo alimentaba «Envases:» y la columna, R12). La columna «Envases» de acondicionamiento
  NO se toca.
- **Dentro** (`PackingOrderDetail.finish`, solo cuando el pedido está `EN_EMPAQUE` a nombre del
  actor; `null` en otro caso):

```ts
type PackingFinishView = {
  orderQuantity: string;                         // decimal
  orderUnit: UnitConversion;                     // id, baseUnitId, factor
  orderUnitLabel: string;
  lines: Array<{
    lineId: string;
    label: string;                               // orderDistributionLineText
    plan: number;
    content: string | null;                      // copiado o vigente
    unit: UnitConversion;                        // de la presentación
    packaging: { productId: string; name: string; freePackages: number } | null; // null = línea antigua
  }>;
};
```

`freePackages` = parte entera de `PackagingCatalog.findRefs(ids, companyId).available` (sin
`excludeOrderId`: libre = existencia − todo lo apartado). Si dos líneas comparten envase, el libre
se reparte entre ellas: el diálogo suma los excesos por `productId` antes de comparar (R9).

Para esto `AssignedOrderPresentationLine` (contrato de `pedidos`) gana `id` y `packedPackages:
number | null`; `OrderDistributionLineView` (asignaciones) gana `lineId` y `packedPackages`.

### 2.5 Tab «Reparto»

- `FINISHED_PRODUCT_TABS` gana `'reparto'` al final; etiqueta «Reparto».
- Server Action nueva `listFinishedProductDistributionAction(id, paging)` en
  `lib/modules/inventario/adapters/driving/finished-product-actions.ts`, calcada de la de entregas.
- Caso de uso `createListFinishedProductDistribution` (`inventario/domain/list-finished-product-distribution.ts`):
  `requirePermission(actor, 'inventario.consultar')` → uuid → `products.findAliveFinished(id, scope)`
  (otra empresa o borrado → `ProductNotFoundError`, R29) → `distribution.listPackedLines(companyId,
  { recipeId, presentationId }, paging)`.
- Hueco declarado en `inventario` (no puede importar `pedidos`: ciclo), junto a
  `FinishedDeliveryDirectory` en `finished-product-detail.ts`:

```ts
export interface FinishedDistributionDirectory {
  listPackedLines(
    companyId: string,
    combination: { readonly recipeId: string; readonly presentationId: string },
    paging: { readonly page: number; readonly pageSize?: number },
  ): Promise<Page<{
    readonly lineId: string;
    readonly orderNumberText: string;
    readonly plan: number;
    readonly packedPackages: number | null;      // null = antes de QC-281
    readonly reason: PackingReasonView | null;   // MovementReason | 'otro'
    readonly reasonOther: string | null;
  }>>;
}
```

  Lo implementa `pedidos` (`adapters/driven/persistence/packed-lines-directory-prisma.ts`) y lo
  cablea `lib/composition/index.ts`, como `order-delivery-directory-prisma.ts`. Consulta:
  `order_presentation_lines` ⨝ `orders` por `(order_id, company_id)`, `orders.company_id = $1`,
  `orders.deleted_at IS NULL`, `orders.recipe_id = $recipe`, `line.presentation_id = $presentation`,
  `orders.status IN ('POR_ACONDICIONAR','EN_ACONDICIONAMIENTO','TERMINADO','ENTREGADO')`, orden
  `order_year DESC, order_sequence DESC` (pregunta abierta 4), paginación con el defecto y tope de
  `lib/shared/pagination`.
- La fila de la UI (`FinishedProductDistributionRow`) añade la presentación (la del producto, una
  sola para toda la tab) y calcula la diferencia en pantalla (R27).

## 3. Terminar en `pedidos`: el flujo nuevo

`createFinishPacking` en `order-packing.ts`, dentro de la misma `OrderUnitOfWork` de hoy:

1. `finishPackingAlive(...)` — estado y empacador, como hoy (R14, R30).
2. `findPresentationLinesForFinish` — las líneas del pedido.
3. **`checkPackingCounts(lines, counts)`** (puro, `packing-count.ts`): mismo conjunto de `lineId`
   que las líneas, entero ≥ 0, motivo si y solo si difiere y del sentido correcto, «Otro» con texto.
   Fallo → `'invalid_packing_count'` (R13). El cliente usa la **misma** función para R3–R6, para que
   la regla no pueda divergir entre diálogo y servidor.
4. **Tope** (R15): `validateDistribution(updated.quantity, orderUnit, linesWithReal)` donde cada
   `DistributionLine` lleva `packages = packedPackages`. `exceeds_quantity` →
   `'packed_exceeds_quantity'`. `DistributionLine.packages` pasa a documentarse como «entero ≥ 0»
   (`multiplyByPackages` ya es correcto con 0).
5. `scope.orders.recordPackedCounts(id, counts, { companyId })` — puerto nuevo de
   `OrderWriteRepository`: un `UPDATE` por línea con `WHERE id = $line AND order_id = $order AND
   company_id = $company` (R16, R29).
6. **Envases** (§ 4) con los envases reales. `insufficient` → `'packaging_stock_insufficient'` (R18).
7. Coste: `lotCost` como hoy; `unitCostByPresentationUnit` con `packages = packedPackages` (R21).
   Si el total real es 0 no hay lotes y el coste no se reparte (pregunta abierta 1).
8. Por cada línea con `packedPackages > 0`, `finishedGoods.receiveFromOrder({ ..., packages:
   packedPackages })` (R20); las de 0 se saltan (R19).

Cualquier `throw` deshace la transacción entera (R22). Los errores nuevos se mapean en el `catch`
como los de hoy.

## 4. Liquidar los envases con el conteo real

Hoy Terminar llama a `reservations.consumeForOrder({ productIds: envases, fallbackRequirement })`,
que consume **todo** lo apartado de esos productos. Con conteo real hace falta, por envase:

- `real < apartado` → consumir `real` y **liberar** el resto (asiento `release`) (R17, R19).
- `real = apartado` → consumir todo (lo de hoy).
- `real > apartado` → consumir lo apartado y el exceso de lotes con disponible **no apartado por
  ningún otro pedido**; si no alcanza → `insufficient` y todo se deshace (R18).

Método nuevo en `MaterialReservations` (`inventario/domain/reservation.ts`):

```ts
settlePackagingForOrder(input: {
  orderId: string; companyId: string;
  requirement: readonly ReservationRequirementLine[];   // envases reales por producto (envases)
  actorId: string; now: Date;
}): Promise<ConsumptionOutcome>;
```

Implementación en `reservation-prisma.ts`, solo con piezas que ya están ahí: `lockProductsAscending`,
`netReservedByBatch` (apartado propio por lote), `planReservation` sobre los lotes propios para
decidir qué se consume (más antiguos primero, el mismo orden que el apartado) y sobre los lotes con
disponible ajeno descontado (`toCandidateBatches`) para el exceso, `consumeBatchStock` y
`recalculateProductStock`. Asientos: `consume` por lo consumido de lo apartado, `release` por lo
apartado que sobra, `consumption` en `inventory_movements` por todo lo consumido (lo hace
`consumeBatchStock`). La merma sobre un lote apartado se cubre como hoy en `consumeForOrder`.

**Envase que también es ingrediente de la receta** — se conserva lo de hoy: ese producto ya se
consumió con la receta al pasar a `POR_EMPACAR`, y Terminar solo consume lo que siga apartado de él
(`order-packing.ts:198-210`). Esos productos NO entran en `settlePackagingForOrder`; siguen por
`consumeForOrder` con `productIds` acotado a ellos. Su conteo real sí se guarda y cuenta para lote
y coste. Es un caso de borde: el implementer lo cubre con un test de integración.

`requirement` se construye con `packagingLinesOf` + `buildOrderRequirement` como hoy, pero con
`packages = packedPackages`; una línea en 0 aporta 0 (su envase se libera entero).

## 5. Después de Terminar

- **Lectura efectiva**: `effectivePackages(line) = line.packedPackages ?? line.packages`
  (`packing-count.ts`), que es R25 en una línea. La usan:
  - `deliver-order.ts` y `get-order-delivery.ts` para `orderedPackages` (R24);
  - `asignaciones/domain/order-distribution-view.ts` y `conditioning-order-view.ts` para pintar
    envases (R23);
  - `missingBatchDataLines` y `finish-conditioning.ts`: una línea con efectivo 0 no cuenta como
    «sin datos de lote» (R23). Así una línea en 0, que no tiene lote, no deja el pedido bloqueado
    para siempre en acondicionamiento.
- `FinishPackingLine` (puerto) y `AssignedOrderPresentationLine` (contrato) ganan
  `packedPackages: number | null`; `order-prisma.ts` lo lee en `findPresentationLinesForFinishOrder`
  y `order-catalog-prisma.ts` en las líneas de los resúmenes de asignación (además de `id`).

## 6. Diálogo en el cliente

`PackingFinishDialog` recibe `PackingFinishView` y el `formAction`; estado local por línea `{ value,
reason, reasonOther }` inicializado con el plan (R1). En cada render calcula, con funciones **puras
del contrato de `pedidos`** (cliente-seguras: el barrel no arrastra servidor):

- `checkPackingCounts` → errores de motivo (R3–R6);
- `packedTotalInOrderUnit(orderUnit, lines)` (envoltorio de `sumInOrderUnit`, nuevo export) → pie
  (R7) y tope (R8); el «máximo en esta línea» se busca con la misma función (entero mayor que no
  supera la cantidad con las demás líneas fijas);
- exceso por envase vs `freePackages` → R9 y textos de R10.

Al pulsar «Terminar» sin errores serializa `lines` en el campo oculto y hace `requestSubmit()` del
`<form>` de hoy (mismos testids `packing-order-finish-form`, `packing-order-finish-confirm`). Todos
los textos salen de una constante `PACKING_FINISH_DIALOG_TEXTS` copiada del tablero (D18). Con pasos
con foto, la descripción se ajusta según la pregunta abierta 5.

## 7. Autorización y empresa (R14, R29)

- Terminar: `empaque.modificar` en `asignaciones` antes de validar; `finishPackingAlive` sigue
  exigiendo `packed_by = actor` y `status = EN_EMPAQUE` en el mismo `UPDATE` condicional
  (`not_packer` / `not_packable`). Ningún permiso nuevo (`guard-permisos-sembrados` sin cambios).
- Todas las escrituras nuevas filtran por `company_id`: `recordPackedCounts` por línea + pedido +
  empresa; `settlePackagingForOrder` con el mismo ámbito que `consumeForOrder`.
- Tab: `inventario.consultar` en el caso de uso; el directorio filtra por empresa; el producto se
  comprueba antes (otra empresa = no existe).
- Si `tests/integration/aislamiento.json` registra las lecturas por empresa, el directorio nuevo se
  añade ahí.

## 8. Alternativas descartadas

1. **Guardar el conteo en el movimiento del envase o en una tabla nueva `order_packing_counts`.**
   Descartada por D13 (el humano lo fijó en la línea) y porque la relación es 1:1 con la línea: una
   tabla aparte añade un JOIN, una FK compuesta y su `company_id` sin aportar nada; en el movimiento
   no cabe el texto de «Otro» y una línea en 0 no tendría movimiento donde guardarlo.
2. **Sobrescribir `packages` con el real.** Pierde el plan (la tab no podría mostrar la diferencia),
   choca con `packages > 0` en las líneas en 0 y rompe la lectura «antes de QC-281».
3. **`syncForOrder(real)` + `consumeForOrder` en vez de un método nuevo.** Funciona en el caso
   simple, pero `syncForOrder` re-planifica **todo** lo apartado del pedido y, si el exceso no
   alcanza, libera también lo que sí estaba apartado antes de que la transacción falle; y con un
   envase que es también ingrediente reservaría de nuevo lo que la receta ya consumió (doble
   consumo). Un método dedicado con las mismas piezas internas deja la regla explícita y testeable.
4. **Validar el tope y el stock solo en el cliente.** El servidor es la frontera
   (`docs/architecture.md > Acceso a datos`): otro pedido puede apartar el envase entre abrir el
   diálogo y Terminar. El cliente valida para guiar; el servidor decide.
5. **Backfill `packed_packages = packages` en la migración.** Haría indistinguibles los pedidos
   antiguos (nota «Empacado antes de QC-281») de los nuevos sin diferencia (R25, R27).

## 9. Dependencias

Ninguna nueva (D12, R31). Se usa lo que ya está en `docs/dependencias.md`: `zod`, `@base-ui/react`,
`lucide-react`, `sonner`, `@tanstack/react-table`, Prisma.

## 10. Riesgos

- **Cambio de firma de `finishPackingAliveById`**: lo usan `asignaciones` (`execution-transaction.ts`,
  `finish-packing.ts`), `lib/composition/index.ts` y los dobles de test
  (`tests/helpers/order-unit-of-work-double.ts`, `tests/helpers/execution-transaction-on-client.ts`).
- **E2E existentes** que pulsan Terminar con `ConfirmDialog` (`e2e/empaque.spec.ts`,
  `e2e/pedido-en-varias-presentaciones.spec.ts`, `e2e/envases-del-pedido.spec.ts`,
  `e2e/pasos-de-envasado.spec.ts`, `e2e/operario-rediseno.spec.ts`, `e2e/helpers/confirm-dialog.ts`):
  conservar los testids del botón de confirmar evita reescribirlos; los que miran «Envases:» o la
  columna se actualizan.
- **Paridad visual** (`tests/unit/paridad/confirmaciones-paridad.test.tsx` y su snapshot): el
  diálogo de Terminar deja de ser un `ConfirmDialog`; el snapshot se actualiza a propósito.
