# QC-305 — coste-real-de-produccion · tasks.md

> Orden: T0 → T1 → (T2 ∥ T3 ∥ T5) → T4 → (T6 ∥ T7) → T8 → T9. Cada task cierra con
> `pnpm run typecheck`, `pnpm run lint` y `pnpm exec vitest related --run <archivos tocados>`; las que
> tocan esquema o contratos de módulo, además `pnpm exec vitest run guard`. Si el humano cambia P1,
> P2 o P3 al aprobar, se ajustan T2, T4 o T7 según `design.md` §2.2, §2.3 y §5.1.

## Tasks

- [x] **T0 — Lo heredado que ya está montado** (lectura, sin cambio). Base de R1–R4, R16, R21, R22.
  - Asientos `consumption` con `order_id` y `batch_id`, en la unidad del lote:
    `inventario/adapters/driven/persistence/product-prisma.ts > consumeBatchStock`, llamado por
    `consumeForOrder` (ingredientes, `transition-order.ts`) y `settlePackagingForOrder` (envases al
    Terminar, `order-packing.ts > settlePackaging`).
  - Conteo real y excedente al Terminar (QC-281, QC-290): `packing-count.ts`, `recordPackedCounts`.
  - Reparto del coste entre lotes: `order-packing.ts > unitCostByPresentationUnit`, `divideCost`.
  - Formato de importe: `lib/shared/ui/decimal-display.ts > formatMoneyDisplay`, `exactDecimalTitle`;
    celda `order-columns.tsx > ProductionCost`.
  - Tab «Costo de producción» de producto terminado con guion para `unitCost: null`
    (`list-finished-product-costs.ts`, `finished-product-costs-table.tsx`).
  - Hecho: nada que hacer; el implementer lo confirma con el grafo antes de T1 y anota en
    `progress/impl_QC-305.md` cualquier diferencia con `design.md > Lo que ya existe`.

- [x] **T1 — Migración y esquema** (backend). R10, R25.
  - `pnpm run db:migrate:create` → `<ts>_orders_actual_cost` con `migration.sql` y `down.sql` de
    design §1.2; `actualCost` en `db/schema.prisma > Order`.
  - Test `tests/unit/pedidos/schema/orders-actual-cost-migration.test.ts`: columna anulable
    `DECIMAL(14,4)`, los dos CHECK, ningún `UPDATE` de backfill, `down.sql` revierte exactamente.
  - Hecho: la migración aplica y revierte sobre la base de test; test de esquema y guardias verdes.

- [x] **T2 [P] — Cálculo puro del real** (backend). Depende de T0. R1, R7, R23.
  - `lib/modules/pedidos/domain/actual-order-cost.ts > calculateActualOrderCost` (design §2.2).
  - Tests `tests/unit/pedidos/actual-order-cost.test.ts`: 8×10 + 2×20 = `120.0000` (no `150.0000`);
    sin lotes → `null`; un lote con `unitCost: null` → `null` (P1); suma que no cabe en
    `Decimal(14,4)` → `null`; redondeo único mitad arriba (dos lotes cuyo redondeo por separado
    daría otro resultado); salida siempre con 4 decimales.
  - Hecho: tests verdes; sin `number` ni `parseFloat` en el archivo.

- [x] **T3 [P] — Lectura de los asientos en `inventario`** (backend). Depende de T0. R2, R3, R4.
  - `inventario/domain/order-consumption.ts` (`ConsumedLot`, `OrderConsumptionLedger`),
    `inventario/adapters/driven/persistence/order-consumption-prisma.ts`
    (`createOrderConsumptionLedger`), export en `inventario/index.ts` (design §2.1).
  - Test `tests/integration/inventario/order-consumption-ledger.int.test.ts`: ingrediente de dos
    lotes + envases + excedente; asiento en un lote que el pedido no tenía apartado (cuenta ese lote);
    asientos de otro pedido, de otra empresa y de otros `kind` fuera; lote con neto 0 fuera; lote sin
    coste → `unitCost: null`.
  - Hecho: test verde; guardia de fronteras de módulo verde.

- [x] **T4 — Terminar guarda el real y reparte el real** (backend). Depende de T1, T2, T3. R5, R6,
  R8, R9, R16, R17, R18.
  - `OrderTransactionScope.consumption` y cableado en `lib/composition/index.ts`; doble en
    `tests/helpers/order-unit-of-work-double.ts` (design §3).
  - `OrderWriteRepository.setActualCost` y su implementación en `order-prisma.ts`; `actualCost` en
    `OrderRow` / `OrderView` y en `get-order.ts` (design §2.5).
  - `order-packing.ts` según design §2.3: real tras `settlePackaging`, también sin reparto y con todo
    en 0; `lotCost = actualCost`; `unitCost: null` sin real. `FinishedGoodsIntake.receiveFromOrder`
    acepta `unitCost: string | null` (dominio y adaptador de `inventario`).
  - Migración `<ts>_finished_goods_lot_cost_optional` con `down.sql`: quita el CHECK
    `product_batches_package_content_requires_unit_cost` (decisión 2026-10-21, R17); los lectores de
    lotes de producto terminado tratan `unit_cost` NULL como «sin coste», con un test por cada uno que
    cambie. El test de QC-150 «un ingrediente con material pero sin costo cuenta cero…» se reescribe
    para afirmar P1.
  - Retirar `resolveLotCost` y lo que quede sin llamadores (`FinishPackingDeps.products`,
    `.packaging`), comprobado con el grafo.
  - Tests: `tests/unit/pedidos/order-packing.test.ts` (real guardado; estimado intacto; rechazo no
    guarda; sin reparto y todo en 0 guardan real; lotes con real ÷ envasado; sin real → lotes sin
    coste); `tests/integration/pedidos/actual-order-cost.int.test.ts` (de punta a punta contra la
    base, R9 con ajuste, entrega, anulación y cambio de `unit_cost` posteriores; R18 con un lote
    anterior); ajustar `tests/integration/pedidos/finish-with-finished-goods.int.test.ts` donde fije el
    reparto del estimado.
  - Hecho: tests verdes; `grep resolveLotCost lib/` sin resultados.

- [x] **T5 [P] — Estimado congelado desde Comenzar** (backend). Depende de T0. R11, R12, R13, R14.
  - `STARTED_ORDER_STATUSES` en `pedidos/domain/order-classification.ts`.
  - `update-order.ts`: en `EN_CURSO`, sin `resolveStoredOrderCost` y `updateAlive(…, 'keep', …)`;
    `updateAlive` acepta `'keep'` en el puerto y en `order-prisma.ts` (design §2.4, §3).
  - `update-order-presentation-lines.ts`: en `EN_CURSO` / `POR_EMPACAR`, sin `setIngredientsCost`;
    borrar `packedOrderCost`.
  - Tests: `tests/unit/pedidos/update-order.test.ts` (`PENDIENTE` y `BLOQUEADO` recalculan;
    `EN_CURSO` con otra receta, cantidad o reparto no cambia el estimado y sí el resto);
    `tests/unit/pedidos/update-order-presentation-lines.test.ts` (`EN_CURSO` y `POR_EMPACAR` no
    escriben el estimado); R14 con el test de escritores de design §2.4.
  - Hecho: tests verdes; los de QC-123, QC-151 y QC-141 en `PENDIENTE` siguen verdes sin tocarlos.

- [x] **T6 [P] — El real llega a las salidas y no a `asignaciones`** (backend). Depende de T4. R24.
  - Tests: `tests/unit/pedidos/get-order.test.ts` y `tests/unit/pedidos/list-orders.test.ts`
    (`actualCost` presente con `pedidos.consultar`; sin permiso, rechazo como hoy);
    `tests/unit/asignaciones/get-assigned-order-execution.test.ts` y
    `tests/unit/asignaciones/list-assigned-orders.test.ts` (ninguna clave de importe).
  - Hecho: tests verdes.

- [x] **T7 — UI: columnas del listado y formulario en `EN_CURSO`** (frontend). Depende de T4, T5.
  **Si el humano pide tablero en P3, espera a él.** R15, R19, R20, R21, R22.
  - `order-columns.tsx` según design §5.1 («Costo estimado» + «Costo real», `CostCell`).
  - `use-order-cost-quote.ts` con `frozen` y `order-form.tsx` que lo pasa (design §5.2).
  - Tests: `tests/unit/pedidos-ui/order-columns.test.tsx` (orden y rótulos; guion con «Sin dato» sin
    real; `$120.00` (sin espacio, `formatMoneyDisplay`) sin `title`; `$12,752.55` con `title` `12752.5512`; no ordenables ni
    filtrables); `tests/unit/pedidos-ui/use-order-cost-quote.test.ts` y
    `tests/unit/pedidos-ui/order-form-quote.test.tsx` (en `EN_CURSO` no se pide cotización y se ve el
    guardado; en `PENDIENTE`, como hoy).
  - Hecho: tests verdes; capturas del listado en escritorio y teléfono en `progress/impl_QC-305.md`.

- [x] **T8 — E2E** (frontend/backend). Depende de T4, T5, T7. R26 (y R1, R12, R16, R19, R22 de
  punta a punta).
  - `e2e/coste-real-de-produccion.spec.ts` según design §7, con los datos que necesite en el seed de
    E2E.
  - Hecho: `pnpm exec playwright test e2e/coste-real-de-produccion.spec.ts` verde en Chromium y
    WebKit.

- [x] **T9 — Cierre de tanda**. Depende de todo.
  - Mapa `R<n> → test` en `progress/impl_QC-305.md` (design §11), R23 incluido con el gate de
    dependencias.
  - Nota de enmienda con referencia a QC-305 al pie de los `requirements.md` de QC-281, QC-290 y
    QC-151 (design §9).
  - Hecho: `./init.sh` verde; ningún `R<n>` sin test.

## Archivos esperados

- `db/schema.prisma`
- `db/migrations/<ts>_orders_actual_cost/migration.sql`
- `db/migrations/<ts>_orders_actual_cost/down.sql`
- `lib/modules/inventario/domain/order-consumption.ts`
- `lib/modules/inventario/domain/finished-goods.ts`
- `lib/modules/inventario/adapters/driven/persistence/order-consumption-prisma.ts`
- `lib/modules/inventario/adapters/driven/persistence/finished-goods-prisma.ts`
- `lib/modules/inventario/index.ts`
- `lib/modules/pedidos/domain/actual-order-cost.ts`
- `lib/modules/pedidos/domain/order-classification.ts`
- `lib/modules/pedidos/domain/order-packing.ts`
- `lib/modules/pedidos/domain/order-view.ts`
- `lib/modules/pedidos/domain/get-order.ts`
- `lib/modules/pedidos/domain/update-order.ts`
- `lib/modules/pedidos/domain/update-order-presentation-lines.ts`
- `lib/modules/pedidos/domain/resolve-ingredients-cost.ts`
- `lib/modules/pedidos/ports/order-unit-of-work.ts`
- `lib/modules/pedidos/ports/order-write-repository.ts`
- `lib/modules/pedidos/adapters/driven/persistence/order-prisma.ts`
- `lib/composition/index.ts`
- `app/(private)/pedidos/components/order-columns.tsx`
- `app/(private)/pedidos/components/order-form.tsx`
- `app/(private)/pedidos/components/use-order-cost-quote.ts`
- `tests/helpers/order-unit-of-work-double.ts`
- `tests/unit/pedidos/actual-order-cost.test.ts`
- `tests/unit/pedidos/order-packing.test.ts`
- `tests/unit/pedidos/update-order.test.ts`
- `tests/unit/pedidos/update-order-presentation-lines.test.ts`
- `tests/unit/pedidos/get-order.test.ts`
- `tests/unit/pedidos/list-orders.test.ts`
- `tests/unit/pedidos/schema/orders-actual-cost-migration.test.ts`
- `tests/unit/asignaciones/get-assigned-order-execution.test.ts`
- `tests/unit/asignaciones/list-assigned-orders.test.ts`
- `tests/unit/pedidos-ui/order-columns.test.tsx`
- `tests/unit/pedidos-ui/use-order-cost-quote.test.ts`
- `tests/unit/pedidos-ui/order-form-quote.test.tsx`
- `tests/integration/inventario/order-consumption-ledger.int.test.ts`
- `tests/integration/pedidos/actual-order-cost.int.test.ts`
- `tests/integration/pedidos/finish-with-finished-goods.int.test.ts`
- `e2e/coste-real-de-produccion.spec.ts`
- `specs/QC-281-envases-reales-al-terminar-empaque/requirements.md`
- `specs/QC-290-empaque-con-excedente/requirements.md`
- `specs/QC-151-cotizacion-del-coste-en-el-pedido/requirements.md`
- `progress/impl_QC-305.md`
