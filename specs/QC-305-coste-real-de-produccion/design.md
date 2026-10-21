# QC-305 — coste-real-de-produccion · design.md

> Requisitos: `requirements.md` R1–R26. Preguntas abiertas P1–P3: el diseño va con su posición por
> defecto; si el humano cambia alguna, se toca la sección citada.

## Lo que ya existe

Buscado en el board (`feature_list.json`, todos los estados), en `specs/` y en el código con
`coste real`, `costo real`, `ponderad`, `weighted`, `actual_cost`, `actualCost`.

| Qué apareció | Dónde | Qué se hace |
|---|---|---|
| QC-123 (`done`): el estimado, promedio simple (D4), guardado al escribir (D8) | `lib/modules/pedidos/domain/order-cost.ts`, `resolve-ingredients-cost.ts` | **Se conserva** para el estimado. Su ficha dejó fuera «guardar qué lotes se usaron»: esta ficha no lo guarda tampoco, lo lee de los asientos |
| QC-151 (`done`): la cotización del formulario | `app/(private)/pedidos/components/use-order-cost-quote.ts`, `order-cost-quote.tsx` | **Se reutiliza**; solo se congela para un pedido en `EN_CURSO` (R15) |
| QC-178 (`pending`): precisión de `unit_cost` | board | **No entra** (Alcance). El real usa `unit_cost` tal como está |
| QC-197 (`pending`): lote real elegido por el operador | board | **No entra** (Alcance). El cálculo lee el `batch_id` del asiento, así que QC-197 no lo toca (R3) |
| Asientos `consumption` con `order_id` | `inventario/adapters/driven/persistence/product-prisma.ts > consumeBatchStock` (único escritor de `kind: 'consumption'`, cantidad en negativo y en la unidad del lote) | **Se reutilizan** como fuente del real. Los escriben `consumeForOrder` (ingredientes al pasar a `POR_EMPACAR`, `transition-order.ts:94`) y `settlePackagingForOrder` / `consumeForOrder` (envases al Terminar, `order-packing.ts > settlePackaging`) |
| Reparto del coste entre lotes de producto terminado | `order-packing.ts > unitCostByPresentationUnit`, `divideCost` (QC-281 R21, QC-290 R10) | **Se reutiliza sin cambio**: cambia solo el total que recibe (R16) |
| Coste del lote sin estimado guardado | `resolve-ingredients-cost.ts > resolveLotCost` | **Se retira** si queda sin llamadores (§2.3) |
| Celda de importe del listado | `order-columns.tsx > ProductionCost` con `formatMoneyDisplay` / `exactDecimalTitle` (`lib/shared/ui/decimal-display.ts`) y `MissingValue` | **Se reutiliza** para la columna nueva (R19–R21) |
| Tab «Costo de producción» del detalle de producto terminado | `inventario/producto-terminado/[id]/components/finished-product-costs-table.tsx`, `inventario/domain/list-finished-product-costs.ts` | **No cambia**: ya pinta `unitCost` / `totalCost` del lote y guion si `null` (R22) |
| E2E de empaque con conteo real | `e2e/envases-reales-empaque.spec.ts` | **No se amplía**: spec propio (§7) para no mezclar flujos |

Nada en el board ni en `specs/` resuelve el coste real: no es duplicado.

### UI: catálogo consultado y regla de decisión

Filas de `components/shared/CATALOGO.md` consultadas: `DataTable` (fila 65), `formatDecimalDisplay`
(`lib/shared/ui/decimal-display.ts`, fila 120, donde viven `formatMoneyDisplay` y
`exactDecimalTitle`), `EMPTY_MARK` (fila 121), `cardFieldLabel` (fila 55, tarjeta del listado).

| Pieza | Paso de la regla | Por qué |
|---|---|---|
| Columna «Costo real» del listado | 1 · reutiliza | Es una entrada más de `buildOrderColumns` con la misma celda que «Costo de producción» (`DataTable`, `formatMoneyDisplay`, `exactDecimalTitle`, `MissingValue`). Sin componente nuevo |
| Rótulo «Costo de producción» → «Costo estimado» | 1 · reutiliza | Cambio de texto de una columna existente (P3) |
| Bloque de coste del formulario en `EN_CURSO` | 1 · reutiliza | `OrderCostQuote` no cambia; cambia cuándo pide cotización el hook (R15) |
| Tab «Costo de producción» de producto terminado | — | Sin cambio de UI |

**Pase `/design`.** No hay componente nuevo ni pieza visual nueva: solo una columna más que compone
piezas catalogadas, como QC-284 con su `Notice`. El spec se acoge a la excepción de
`docs/perfil-agentes.md > Pase de diseño`. Queda escrito como **P3** para que el humano lo confirme
al aprobar; si pide tablero, T7 espera a él.

## 1. Modelo de datos

### 1.1 Columna nueva en `orders`

```prisma
/// Coste real de produccion: suma de (cantidad consumida x coste unitario del lote) de los
/// asientos `consumption` del pedido, calculada UNA vez al Terminar el empaque. NULL = sin
/// terminar, terminado antes de QC-305 o sin calculo posible; nunca 0. No lo recalcula nada.
actualCost          Decimal?      @map("actual_cost") @db.Decimal(14, 4)
```

Va junto a `ingredientsCost` / `packagingCost`, que **no cambian** (R6). Un solo campo, el total: ninguna
decisión pide la parte de envases del real (alternativa B, §8).

### 1.2 Migración `db/migrations/<ts>_orders_actual_cost/`

`migration.sql`:

```sql
ALTER TABLE "orders" ADD COLUMN "actual_cost" DECIMAL(14,4);

ALTER TABLE "orders" ADD CONSTRAINT "orders_actual_cost_non_negative"
  CHECK ("actual_cost" IS NULL OR "actual_cost" >= 0);

-- Solo un pedido que ya paso por Terminar el empaque puede tenerlo.
ALTER TABLE "orders" ADD CONSTRAINT "orders_actual_cost_requires_packed"
  CHECK ("actual_cost" IS NULL OR "status" IN
    ('POR_ACONDICIONAR', 'EN_ACONDICIONAMIENTO', 'TERMINADO', 'ENTREGADO'));
```

`down.sql`: quita las dos restricciones y la columna, en orden inverso. **Sin backfill** (R10): los
pedidos existentes quedan en `NULL`. `<ts>` lo pone `pnpm run db:migrate:create`, posterior a la
última migración de `dev` al implementar.

### 1.3 RLS y autorización

No hay tabla nueva: `orders` ya tiene RLS con `FORCE` y la columna la hereda. La frontera real es el
service (`docs/architecture.md > Acceso a datos y autorizacion`): el real sale por `getOrder` /
`listOrders`, que ya exigen `pedidos.consultar` (R24). `asignaciones` no lee `OrderView`: sus
salidas no llevan ningún importe hoy y no se les añade (test de R24).

## 2. Dominio

### 2.1 `inventario`: lectura de los asientos de consumo de un pedido (R2–R4)

`pedidos` no puede leer tablas de `inventario`. Nace un contrato público, en
`lib/modules/inventario/domain/order-consumption.ts`:

```ts
/** Un lote consumido por un pedido, ya neto: lo que salio de el por asientos `consumption`. */
export type ConsumedLot = {
  readonly batchId: string;
  /** Cadena decimal positiva, en la unidad del lote: -SUM(quantity) de sus asientos. */
  readonly quantity: string;
  /** `unit_cost` del lote al leerlo; `null` = el lote no tiene coste. */
  readonly unitCost: string | null;
};

/** Lectura DENTRO de la transaccion de quien llama. */
export interface OrderConsumptionLedger {
  findConsumedLots(input: { readonly orderId: string; readonly companyId: string }): Promise<readonly ConsumedLot[]>;
}
```

Adaptador `inventario/adapters/driven/persistence/order-consumption-prisma.ts`
(`createOrderConsumptionLedger(tx)`): `inventoryMovement.groupBy` por `batchId` con
`where: { companyId, orderId, kind: 'consumption' }` y `_sum.quantity`, y un `productBatch.findMany`
de esos lotes con `where: { id: { in }, companyId }` para su `unitCost`. Un lote con suma neta 0 no
se devuelve. Se exporta desde `inventario/index.ts`.

El `unit_cost` se lee **al Terminar**, no al consumir: es el valor del lote en ese instante. Hoy un
lote solo cambia de coste editándolo; si eso pasa entre consumir y Terminar, manda el de Terminar.
Después ya no cuenta (R9).

### 2.2 `pedidos`: el cálculo, puro (R1, R7)

`lib/modules/pedidos/domain/actual-order-cost.ts`:

```ts
/** Suma ponderada exacta de los lotes consumidos, redondeada UNA vez a 4 decimales mitad arriba.
 *  `null` si no hay lotes, si alguno no tiene coste (P1) o si no cabe en decimal(14,4). */
export function calculateActualOrderCost(lots: readonly ConsumedLot[]): string | null;
```

BigInt sobre escala 8 (cantidad escala 4 × coste escala 4), sin coma flotante ni dependencia nueva
(R23), con los mismos ayudantes de decimales que `order-cost.ts` si están exportados o, si no, con un
`parseUnsigned` local como el de `order-packing.ts`. El tope: 10 dígitos enteros (`Decimal(14,4)`);
lo que lo supere da `null`, como QC-123 D17.

### 2.3 Terminar: `pedidos/domain/order-packing.ts` (R5, R6, R8, R16, R17)

Dentro del mismo `unitOfWork.run`, **después** de `settlePackaging` (los asientos de envases ya
están escritos en la transacción):

1. `const lots = await scope.consumption.findConsumedLots({ orderId: id, companyId })`.
2. `const actualCost = calculateActualOrderCost(lots)`.
3. `await scope.orders.setActualCost(id, actualCost, { companyId })`.
4. Hoy hay dos salidas tempranas: sin reparto (`lines.length === 0`) y todas las líneas en 0
   (`packedLines.length === 0`). La primera va **antes** de `settlePackaging`: se reordena para que
   los pasos 1–3 corran también en los dos casos (R8). Sin reparto no hay envases que liquidar, así
   que solo cuentan los asientos de ingredientes.
5. `lotCost` deja de salir de `updated.ingredientsCost ?? resolveLotCost(...)`: es `actualCost`
   (R16). Si es `null`, cada lote nace con `unitCost: null` (R17, P2); si no,
   `unitCostByPresentationUnit(actualCost, …)` como hoy.

Consecuencias:

- `FinishPackingDeps.products` y `.packaging` solo servían a `resolveLotCost`. Se retiran del tipo y
  del cableado, y `resolveLotCost` (con `calculateLotPackagingCost` si queda sin uso) se borra de
  `resolve-ingredients-cost.ts`. El implementer confirma con el grafo que no tienen otros llamadores
  antes de borrar.
- `inventario > FinishedGoodsIntake.receiveFromOrder` pasa `unitCost: string` → `string | null`.
  **Corrección (2026-10-21, al implementar T4):** la columna `product_batches.unit_cost` es anulable,
  pero el CHECK `product_batches_package_content_requires_unit_cost`
  (`20260924190100_finished_products_and_content_copies`) exigía coste a todo lote con
  `package_content`, es decir, a todo lote de producto terminado. Una migración nueva con `down.sql`
  lo quita (`product_batches_unit_cost_positive` se queda; el `down.sql` lo recrea y falla si ya hay
  lotes de PT sin coste). Todo lector de lotes de producto terminado trata `unit_cost` NULL como
  «sin coste» (guion), nunca como 0; `list-finished-product-costs.ts` ya lo hacía (R22).
- Ningún paso de Terminar escribe `ingredients_cost` ni `packaging_cost` (R6): `finishPackingAlive`
  no los toca hoy y `setActualCost` solo escribe `actual_cost`.

### 2.4 El estimado congelado (R11–R14)

| Caso de uso | Hoy | Con QC-305 |
|---|---|---|
| `update-order.ts` (edición general) en `EN_CURSO` | recalcula con `resolveStoredOrderCost` (L145) y lo escribe en `updateAlive` (L210) | **no recalcula**: con `row.status === 'EN_CURSO'` no llama a `resolveStoredOrderCost` y `updateAlive` recibe «conservar» (§3) |
| `update-order.ts` en `PENDIENTE` / `BLOQUEADO` | recalcula | igual (R11) |
| `update-order-presentation-lines.ts` en `EN_CURSO` / `POR_EMPACAR` | recalcula (`resolveStoredOrderCost` o `packedOrderCost`, L206–217) | **no escribe** el estimado: ni `setIngredientsCost` ni `packedOrderCost` en esos estados |
| `update-order-presentation-lines.ts` en `PENDIENTE` / `BLOQUEADO` | recalcula | igual (R11) |
| `create-order.ts`, `review-blocked-orders.ts` | antes de Comenzar | igual |

La rama `insufficient` de los dos casos de uso en un estado comenzado ya lanza
(`InsufficientMaterialError`) antes de tocar el importe: no cambia.

`packedOrderCost` (L236) queda sin llamadores: se borra.

R14 se fija con un test que recorre los escritores del estimado (`setIngredientsCost`,
`updateAlive` con importe, `create`) y exige que ninguno se llame con un pedido comenzado. Los
estados se toman de una constante nueva `STARTED_ORDER_STATUSES` en
`pedidos/domain/order-classification.ts`, para que dominio y UI usen la misma lista.

### 2.5 Lo que se devuelve (R23, R24)

`OrderRow` y `OrderView` ganan `actualCost: string | null` (cadena con 4 decimales, `.toFixed(4)` en el
adaptador, como `ingredientsCost`). `get-order.ts` lo copia de la fila. `OrderSummary` lo hereda.

## 3. Puertos y adaptadores

- `pedidos/ports/order-unit-of-work.ts > OrderTransactionScope` gana
  `readonly consumption: OrderConsumptionLedger`. `lib/composition/index.ts > orderTransactionScopeOn`
  lo cabla con `createOrderConsumptionLedger(tx)`. El doble `tests/helpers/order-unit-of-work-double.ts`
  lo añade.
- `pedidos/ports/order-write-repository.ts`:
  - `setActualCost(id: string, cost: string | null, scope: OrderScope): Promise<void>`, sin mover
    `updated_at` (ya lo movió `finishPackingAlive` en la misma transacción).
  - `updateAlive(…, cost: StoredOrderCost | null | 'keep', …)`: con `'keep'` el `UPDATE` no incluye
    `ingredients_cost` ni `packaging_cost`.
- `pedidos/adapters/driven/persistence/order-prisma.ts`: selecciona y mapea `actualCost`; implementa
  `setActualCost` y la rama `'keep'` de `updateAlive`.

## 4. Server Actions y rutas

Ninguna nueva. `listOrders` / `getOrder` ya devuelven `OrderView`: el campo viaja solo. La acción de
cotización (`quoteOrderCostAction`) no cambia: es la UI la que deja de llamarla en `EN_CURSO`.

## 5. UI

### 5.1 Listado de pedidos (R19–R21)

`app/(private)/pedidos/components/order-columns.tsx`:

- La columna `PRODUCTION_COST_COLUMN_ID` cambia su rótulo a «Costo estimado» (P3). Su id no cambia,
  para no perder la preferencia de columnas guardada de nadie.
- Nace `ACTUAL_COST_COLUMN_ID = 'actualCost'` justo después, rótulo «Costo real», `align: 'end'`,
  `tabular: true`, sin `sortable` ni `filter`, `data-testid` `order-actual-cost`. Celda: la de
  `ProductionCost` generalizada a un `CostCell({ value, field })`, con `MissingValue` sin importe y
  `formatMoneyDisplay` + `exactDecimalTitle` con importe.
- La tarjeta del listado sale de las columnas de `DataTable`: no se toca aparte.

El implementer comprueba que una preferencia de columnas guardada antes de esta ficha no esconde la
columna nueva. Si la esconde, lo anota en `progress/impl_QC-305.md`; no se cambia `DataTable` en
esta ficha.

### 5.2 Formulario en `EN_CURSO` (R15)

`useOrderCostQuote(initialAmount, orderId, initialLines, { frozen })`: con `frozen: true` los
manejadores (`onRecipeChange`, `onQuantityChange`, `onUnitChange`, `onDistributionChange`) no piden nada y el
estado se queda en el importe inicial. `order-form.tsx` pasa
`frozen: order !== undefined && STARTED_ORDER_STATUSES.includes(order.status)`. `OrderCostQuote` no
cambia.

### 5.3 Detalle de producto terminado (R22)

Sin cambio de código: la tab ya pinta el `unitCost` del lote y su total, o guion. Lo que cambia es
el número que nace en el lote (§2.3). Se fija con un test de integración y con el E2E.

## 6. Seguridad, aislamiento y rendimiento

- Aislamiento (R4): las dos lecturas de §2.1 filtran por `companyId`; el pedido ya está bloqueado por
  `finishPackingAlive` en la misma transacción.
- Rendimiento: un `groupBy` sobre `inventory_movements` por `order_id` (índice
  `inventory_movements_order_id_idx`) y un `findMany` por id, una vez por Terminar. Sin N+1.
- El listado no hace ninguna consulta nueva: la columna viene en la misma fila.

## 7. E2E (R26)

`e2e/coste-real-de-produccion.spec.ts`, nuevo, Chromium y WebKit, con el seed de E2E: un ingrediente
con dos lotes de coste distinto, con la existencia del primero por debajo de lo que pide el pedido,
para que el consumo tome de los dos. Recorrido: alta → Comenzar → edición de cantidad en `EN_CURSO`
(el bloque de coste y el listado siguen con el estimado de antes) → finalizar → Comenzar y Terminar el
empaque con un conteo distinto del plan → listado: «Costo estimado» y «Costo real» lado a lado, con
el real igual a la suma ponderada leída de la base → detalle de producto terminado: coste unitario
del lote = real ÷ envasado.

## 8. Alternativas descartadas

- **A. Calcular el real al leer** (sumar los asientos en cada `listOrders`). Descartada: la decisión
  pide calcularlo una sola vez al Terminar, y un ajuste o un cambio de `unit_cost` posterior lo
  cambiaría (R9). Además mete un `groupBy` por página en el listado.
- **B. Guardar el real en dos columnas (ingredientes y envases) como el estimado.** Descartada:
  ninguna decisión pide ver la parte de envases del real, y un envase que también es ingrediente se
  consume por la vía de la receta, así que el corte no es limpio. Si hace falta, se añade después
  sin migrar datos: los asientos siguen ahí.
- **C. Guardar una foto por lote (tabla `order_cost_lots`).** Descartada: duplica lo que ya dicen
  `inventory_movements` y `product_batches`, y QC-123 ya dejó fuera guardar qué lotes se usaron.
- **D. Calcular el real con el plan de reserva (los lotes que el pedido tenía apartados).**
  Descartada: el apartado no es lo consumido (merma, faltante tomado de otro lote, excedente de
  envases de QC-290). La decisión manda leer los asientos (R3).
- **E. Congelar el estimado por omisión en el adaptador (ignorar el importe en `updateAlive` según
  el estado).** Descartada: esconde una regla de negocio en la persistencia. El caso de uso decide
  con `'keep'` y el test de dominio lo ve.
- **F. Sin real, repartir el estimado en los lotes de producto terminado.** Descartada por defecto
  (P2): contradice la enmienda de D20 y pinta un número que no es el real.

## 9. Enmiendas a specs anteriores

- **QC-281 D20 / R21** y **QC-290 R10**: el total que se reparte entre los lotes es el coste real, no
  el estimado (decisión cerrada de esta ficha). El reparto por cantidad (QC-281 D9) no cambia.
- **QC-123 D8** y **QC-151 R12**: desde Comenzar, editar no recalcula el estimado ni recotiza (R12–R15).
- **QC-170**: la edición de reparto y unidad en `EN_CURSO` / `POR_EMPACAR` deja de recalcular el
  importe (R13).

El implementer añade una nota de una línea con la referencia a QC-305 al pie de los
`requirements.md` de QC-281, QC-290 y QC-151, sin reescribir sus requisitos.

## 10. Dependencias

Ninguna nueva (R23). BigInt nativo y Prisma `Decimal` como ya usa el módulo.

## 11. Trazabilidad prevista (R → test)

| R | Test |
|---|---|
| R1, R7 | `tests/unit/pedidos/actual-order-cost.test.ts` (8×10 + 2×20 = 120, no 150; sin lotes, lote sin coste, desbordamiento → `null`; redondeo único) |
| R2, R3, R4 | `tests/integration/inventario/order-consumption-ledger.int.test.ts` (ingredientes + envases + excedente; asiento a un lote no apartado; otro pedido, otra empresa y otros `kind` fuera) |
| R5, R6, R8, R16, R17 | `tests/unit/pedidos/order-packing.test.ts` y `tests/integration/pedidos/actual-order-cost.int.test.ts` |
| R9 | `tests/integration/pedidos/actual-order-cost.int.test.ts` (ajuste, entrega, anulación y cambio de `unit_cost` posteriores no lo cambian) |
| R10, R25 | `tests/unit/pedidos/schema/orders-actual-cost-migration.test.ts` (columna, CHECK, sin backfill, `down.sql`) |
| R11, R12, R14 | `tests/unit/pedidos/update-order.test.ts` |
| R13, R14 | `tests/unit/pedidos/update-order-presentation-lines.test.ts` |
| R15 | `tests/unit/pedidos-ui/use-order-cost-quote.test.ts`, `tests/unit/pedidos-ui/order-form-quote.test.tsx` |
| R18 | `tests/integration/pedidos/actual-order-cost.int.test.ts` (lote anterior sin cambio) |
| R19, R20, R21 | `tests/unit/pedidos-ui/order-columns.test.tsx` |
| R22 | `tests/integration/pedidos/actual-order-cost.int.test.ts` + R26 |
| R23 | `actual-order-cost.test.ts` (cadena con 4 decimales) y el gate de dependencias |
| R24 | `tests/unit/pedidos/get-order.test.ts`, `tests/unit/pedidos/list-orders.test.ts`, `tests/unit/asignaciones/get-assigned-order-execution.test.ts`, `tests/unit/asignaciones/list-assigned-orders.test.ts` |
| R26 | `e2e/coste-real-de-produccion.spec.ts` |
