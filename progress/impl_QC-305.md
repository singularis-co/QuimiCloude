# impl QC-305 — coste-real-de-produccion

## Tanda 1 (backend_dev): T1, T2, T3 — 2026-10-21

### T0 (lectura)

- Grafo: el MCP `codebase-memory-mcp` responde, pero no hay proyecto indexado para este worktree
  (`list_projects` no lo lista). Exploracion con Grep/Read.
- Sin diferencias con `design.md > Lo que ya existe` en lo que toca esta tanda: el unico escritor de
  `kind: 'consumption'` es `product-prisma.ts > consumeBatchStock`, cantidad en negativo y con
  `order_id` (CHECK `inventory_movements_order_id_matches_kind`).

### Archivos

Creados:
- `db/migrations/20261021140000_orders_actual_cost/migration.sql`
- `db/migrations/20261021140000_orders_actual_cost/down.sql`
- `lib/modules/inventario/domain/order-consumption.ts` (`ConsumedLot`, `OrderConsumptionLedger`)
- `lib/modules/inventario/adapters/driven/persistence/order-consumption-prisma.ts` (`createOrderConsumptionLedger(tx)`)
- `lib/modules/pedidos/domain/actual-order-cost.ts` (`calculateActualOrderCost`)
- `tests/unit/pedidos/schema/orders-actual-cost-migration.test.ts`
- `tests/unit/pedidos/actual-order-cost.test.ts`
- `tests/integration/inventario/order-consumption-ledger.int.test.ts`

Modificados:
- `db/schema.prisma` (`Order.actualCost`)
- `lib/modules/inventario/index.ts` (export de tipos de `order-consumption`)
- `tests/integration/aislamiento.json` (el int test nuevo en `transaccion`)
- `tests/guards/guard-identificador-de-request.test.ts` (`MIGRACIONES_ESPERADAS` gana la migracion, como hizo cada ficha anterior)
- `tests/unit/pedidos/schema/pedidos-schema.test.ts`, `tests/integration/pedidos/pedidos-constraints.int.test.ts`,
  `tests/integration/pedidos/order-conditioning-states-rollback.int.test.ts` (ver «Ajustes»)

### Migracion

- `db:migrate:create` NO se corrio: `progress/deudas.md` (D3) lo prohibe sobre la Postgres local
  compartida (pide un `reset` destructivo). Carpeta a mano, como QC-290. Instante
  `20261021140000`: posterior a `20261020180000_whatsapp_variable_keys` (ultima de `origin/dev`) y a
  `20261021120001_conditioning_steps` (la mas reciente de otro worktree).
- Aplicada en la plantilla de test (`qct_tpl_72483b261127`, construida por la corrida de integracion;
  el paso 5/6 confirma el esquema al dia con `schema.prisma`).
- Ciclo up -> down -> up sobre una copia desechable de la plantilla (script en el scratchpad, base
  borrada al final): columna `numeric(14,4)` anulable sin default y los dos CHECK presentes; tras
  `down.sql` ni columna ni CHECK y el resto de restricciones de `orders` intacto (22 -> 20); tras
  reaplicar, forma identica a la inicial.
- La base de desarrollo no se toco.
- Nota: el comentario de `actualCost` en `schema.prisma` no lleva la referencia a la ficha que
  traia el borrador de `design.md §1.1` (regla de comentarios).

### Mapa R -> test (esta tanda)

| R | Test |
|---|---|
| R1 | `tests/unit/pedidos/actual-order-cost.test.ts` («R1: pondera por cantidad: 8 x 10 + 2 x 20 = 120.0000…», «R1: redondea una sola vez al final…», «R1: el redondeo es mitad arriba») |
| R2 | `actual-order-cost.test.ts` («R2: suma todos los lotes…»); `order-consumption-ledger.int.test.ts` («R2: devuelve, neto y por lote, el ingrediente de dos lotes y los envases con su excedente», «R2: un lote cuyo neto queda en 0 no se devuelve») |
| R3 | `order-consumption-ledger.int.test.ts` («R3: cuenta el lote del asiento aunque el pedido no lo tuviera apartado») |
| R4 | `order-consumption-ledger.int.test.ts` («R4: deja fuera los asientos de otro pedido y los que no son de consumo», «R4: con la empresa equivocada…») |
| R7 | `actual-order-cost.test.ts` (sin lotes, lote sin coste, desborde, tope tras redondear); `orders-actual-cost-migration.test.ts` (CHECK no negativo); `order-consumption-ledger.int.test.ts` (lote sin coste -> `unitCost: null`, pedido sin asientos -> `[]`) |
| R9 (parcial: lectura) | `order-consumption-ledger.int.test.ts` («R9: lee el unit_cost del lote en el instante de leerlo») — el resto de R9 es de T4 |
| R10 | `orders-actual-cost-migration.test.ts` (CHECK de estado, sin relleno) |
| R23 | `actual-order-cost.test.ts` (4 decimales, sin `number`/`parseFloat`); `orders-actual-cost-migration.test.ts` (campo `Decimal(14,4)`) |
| R25 | `orders-actual-cost-migration.test.ts` (columna opcional en `orders`, sin tabla nueva, `down.sql` exacto, borrado logico y marcas conservados) |

R5, R6, R8, R11–R22, R24, R26: tasks T4–T8, fuera de esta tanda.

### Ajustes a tests existentes que la columna nueva rompia (esperado)

- `tests/unit/pedidos/schema/pedidos-schema.test.ts`: la lista cerrada de columnas de `Order` y la
  de decimales ganan `actualCost`; caso nuevo «R23, R25: orders gana actualCost…».
- `tests/integration/pedidos/pedidos-constraints.int.test.ts`: la lista real de columnas gana `actual_cost`.
- `tests/integration/pedidos/order-conditioning-states-rollback.int.test.ts`: aplica antes el
  `down.sql` de `orders_actual_cost`, como haria una reversion real (su CHECK nombra `TERMINADO`).

### Desvio menor del SQL de design §1.2 (anotado)

El CHECK de estado compara `"status"::text IN (...)` en vez de `"status" IN (...)`. Sin el cast,
los `down.sql` antiguos que recrean el enum `OrderStatus` (probados en
`order-status-blocked-rollback` y `order-conditioning-states-rollback`) fallan con 42883
(`"OrderStatus" = "OrderStatus_old"`). Todos los CHECK de `orders` sobre `status` del repo usan ya
`::text` por lo mismo. Misma semantica.

### Verificacion (salida real)

- `pnpm run typecheck`: exit 0.
- `pnpm run lint`: `0 errors, 10 warnings` (los 10 en archivos que esta tanda no toca); eslint de los
  archivos tocados: limpio.
- `pnpm exec vitest run guard`: 85 archivos pasan, 1254 tests pasan, 22 omitidos.
- `pnpm exec vitest related --run` sobre los tres fuentes nuevos: 2 archivos, 19 tests, todos verdes.
- Archivos de test de la tanda y los ajustados (pasan/fallan):
  - `tests/unit/pedidos/actual-order-cost.test.ts` 11/0
  - `tests/unit/pedidos/schema/orders-actual-cost-migration.test.ts` 8/0
  - `tests/unit/pedidos/schema/pedidos-schema.test.ts` 34/0
  - `tests/integration/inventario/order-consumption-ledger.int.test.ts` 8/0
  - `tests/integration/pedidos/pedidos-constraints.int.test.ts` 34/0
  - `tests/integration/pedidos/order-conditioning-states-rollback.int.test.ts` 2/0
  - `tests/integration/pedidos/order-status-blocked-rollback.int.test.ts` 2/0
  - `tests/integration/pedidos/order-packing-states-rollback.int.test.ts` 2/0

Veredicto: T1, T2 y T3 hechas y en verde; T4 puede montarse encima.

## T4 (backend_dev): Terminar guarda el real y reparte el real — 2026-10-21

Grafo: este worktree sigue sin indexar; todo con Grep/Read.

### Archivos

Produccion:
- `lib/modules/pedidos/ports/order-unit-of-work.ts` (`OrderTransactionScope.consumption`)
- `lib/composition/index.ts` (`orderTransactionScopeOn` cabla `createOrderConsumptionLedger(tx)`; las dos llamadas a `createFinishPacking` sin `products` ni `packaging`)
- `lib/modules/pedidos/ports/order-write-repository.ts` (`setActualCost`; `FinishPackingOrderRow` pierde `ingredientsCost`, que solo leia `resolveLotCost`)
- `lib/modules/pedidos/adapters/driven/persistence/order-prisma.ts` (`actualCost` en `ORDER_SELECT`/`toOrderRow`/alta; `setActualCost` por `$executeRaw`, sin mover `updated_at`; `finishPackingAlive` ya no relee el estimado)
- `lib/modules/pedidos/domain/order-view.ts`, `get-order.ts` (`actualCost` en `OrderRow`/`OrderView`)
- `lib/modules/pedidos/domain/order-packing.ts` (`saveActualCost` tras `settlePackaging`, tambien sin reparto y con todo en 0; `unitCost` = reparto del real o `null`; `FinishPackingDeps` sin `products` ni `packaging`)
- `lib/modules/pedidos/domain/resolve-ingredients-cost.ts` (fuera `resolveLotCost` y `resolveLotIngredientsCost`, sin llamadores)
- `lib/modules/pedidos/domain/order-cost.ts` (fuera `calculateLotIngredientsCost` y `calculateLotPackagingCost`, sin llamadores; `calculatePackagingLineCost` pierde el parametro `requireCoverage`, que siempre era `true`)
- `lib/modules/inventario/domain/finished-goods.ts`, `adapters/driven/persistence/product-prisma.ts` (`receiveFromOrder` / `receiveFinishedGoods` / `planFinishedGoodsLine` aceptan `unitCost: string | null`; `finished-goods-prisma.ts` lo pasa tal cual, sin cambio)

Tests:
- Nuevo `tests/integration/pedidos/actual-order-cost.int.test.ts` (+ entrada `commit` en `tests/integration/aislamiento.json`)
- `tests/unit/pedidos/order-packing.test.ts` (dobles sin catalogos de coste, `consumidos`; bloque nuevo «createFinishPacking guarda el coste real de lo consumido»; fuera los casos de `resolveLotCost`)
- `tests/integration/pedidos/finish-with-finished-goods.int.test.ts` (los dos casos que fijaban el reparto del estimado pasan a fijar el real; dos titulos de «R18 — el coste del lote» reescritos), `order-packing.int.test.ts` (cableado), `order-ingredients-cost.int.test.ts` y `tests/unit/pedidos/order-cost.test.ts`, `resolve-ingredients-cost.test.ts` (fuera los casos de las funciones borradas)
- `tests/helpers/order-unit-of-work-double.ts` (`setActualCost`, `fakeOrderConsumptionLedger`, `consumption`, `actualCost: null`), `tests/helpers/order-scope-readers.ts` (`consumption`)
- `tests/guards/guard-ambito-empresa-pedidos.test.ts` (cableado de `createFinishPacking` y el ambito con siete miembros)
- `actualCost: null` en las fixtures de `OrderRow`/`OrderView`/`OrderSummary` de 45 archivos de `tests/unit/**` (sin cambio de comportamiento)

### Mapa R -> test (T4)

| R | Test |
|---|---|
| R5 | `order-packing.test.ts` («R5: lee los consumos del pedido en la transaccion y guarda el real ponderado…», «R5: el real se lee despues de liquidar los envases y se guarda antes de dar de alta los lotes», «R5: un Terminar rechazado antes del calculo no guarda ningun real», «R5: un rechazo despues de guardar el real deshace la transaccion entera…»); `actual-order-cost.int.test.ts` («R1, R5, R6, R16, R22: …») |
| R6 | `order-packing.test.ts` («R6: Terminar no escribe el estimado del pedido»); `actual-order-cost.int.test.ts` («R1, R5, R6, R16, R22»: estimado 155.0000 intacto frente a real 145.0000); `finish-with-finished-goods.int.test.ts` («QC-305 R16, R6: …», dos casos) |
| R7 | `order-packing.test.ts` («R7, R8: un pedido sin ningun consumo guarda el real sin importe…») |
| R8 | `order-packing.test.ts` («R8: sin reparto calcula y guarda el real…», «R8: con todas las lineas en 0…»); `actual-order-cost.int.test.ts` («R8: con todas las lineas en 0 guarda el real y no nace ningun lote») |
| R9 | `actual-order-cost.int.test.ts` («R9: un ajuste de existencia, un cambio del coste de un lote, una entrega y su anulacion posteriores no cambian el real») |
| R16 | `order-packing.test.ts` («R16: deriva un unico coste unitario del coste real…», «R16: los lotes llevan el real entre lo envasado…», «R16: el coste real se reparte entre los 12 L envasados…», «R16: el coste real se reparte entre lo envasado de verdad…»); `actual-order-cost.int.test.ts` («R1, R5, R6, R16, R22», «R16, R18: un segundo Terminar…») |
| R17 | `order-packing.test.ts` («R17: si un lote consumido no tiene coste…», «R17: un pedido con reparto y sin ningun consumo…») — verdes; el de integracion («R7, R17, R22») esta ROJO, ver Bloqueo |
| R18 | `actual-order-cost.int.test.ts` («R16, R18: un segundo Terminar…», «R18: un lote de producto terminado nacido con el estimado, antes de esta ficha, conserva su coste…») |
| R22 | `actual-order-cost.int.test.ts` («R1, R5, R6, R16, R22»: la tab devuelve `unitCost` 14.5000 y `totalCost` 145.0000); la mitad «guion sin real» es el caso rojo de R17 |

### Bloqueo: R17 choca con un CHECK de la base

`db/migrations/20260924190100_finished_products_and_content_copies/migration.sql` crea
`product_batches_package_content_requires_unit_cost` = `CHECK ("package_content" IS NULL OR "unit_cost" IS NOT NULL)`.
Todo lote de producto terminado lleva `package_content`, asi que un lote sin coste unitario (R17, P2)
no se puede escribir: el `INSERT` de `receiveFinishedGoods` falla con 23514 y Terminar entero se
deshace (error 500, no un rechazo de dominio). `design.md §2.3` da por hecho que la columna admite
`NULL` para estos lotes; no es asi.

Efecto hoy, con el codigo de T4: cualquier pedido con reparto que consuma un lote sin `unit_cost`
(p. ej. un ingrediente MACHINE sin coste) ya no puede Terminar. Lo muestran en rojo:
- `actual-order-cost.int.test.ts` > «R7, R17, R22: un lote consumido sin coste deja el real sin importe…»
- `finish-with-finished-goods.int.test.ts` > «un ingrediente con material pero sin costo cuenta cero…» (QC-150; fija el comportamiento retirado y no se toca hasta decidir)

Pregunta al humano (sin decidir aqui): (a) migracion nueva que retire o relaje ese CHECK, con su
`down.sql`, y revisar quien lee lotes de producto terminado suponiendo coste; (b) cambiar P2/R17:
sin real, el lote nace a `0.0000` (lo admite `product_batches_unit_cost_positive` con
`package_content`), lo que contradice «nunca 0»; (c) otra regla.

### Verificacion (salida real)

- `pnpm run typecheck`: exit 0.
- `pnpm run lint`: `0 errors, 10 warnings` (los mismos 10 de antes, en archivos que T4 no toca; `eslint` de los tocados, limpio).
- `pnpm exec vitest run guard`: 85 archivos pasan, 1255 tests pasan, 22 omitidos.
- Unitarios: los 47 archivos de `tests/unit` tocados mas `asignaciones/finish-packing`, `authorization`, `acondicionamiento-authorization`, `start-packing`, `pedidos/actual-order-cost`, `qc145-estado-solo-planta`: 53 archivos, 1690 tests, todos verdes (`order-packing.test.ts` 69/0, `order-cost.test.ts` 37/0, `resolve-ingredients-cost.test.ts` 8/0).
- Integracion (base efimera): `actual-order-cost` 5/1, `finish-with-finished-goods` 32/1, `order-packing`, `asignaciones/finished-orders`, `order-ingredients-cost`, `order-unit-of-work`, `inventario/order-consumption-ledger` verdes; 86 pasan, 2 fallan (los dos del Bloqueo).
- `grep resolveLotCost lib/`: sin resultados.

Veredicto: T4 montada y verde salvo R17 en la base, que choca con un CHECK existente; para hasta que el humano decida.

### T4b — CHECK de unit_cost (2026-10-21)

Decision humana 2026-10-21: opcion (a), P2 se mantiene: sin real, el lote de producto terminado
nace con `unit_cost` NULL; nunca 0 ni el estimado.

Migracion (a mano, deuda D3): `db/migrations/20261021150000_finished_goods_lot_cost_optional/`.
- `migration.sql`: `DROP CONSTRAINT "product_batches_package_content_requires_unit_cost"`, nada mas.
  `product_batches_unit_cost_positive` intacto (un NULL lo pasa).
- `down.sql`: lo recrea exacto como `20260924190100`; comentario AVISO: falla (23514) si ya hay
  lotes con `package_content` y `unit_cost` NULL, y no los rellena.
- Ciclo up -> down -> up sobre una copia desechable de la plantilla `qct_tpl_06ae9a5f7969` (script en
  el scratchpad, base borrada al final): migracion aplicada en la plantilla; 13 restricciones en
  `product_batches` sin el CHECK, 14 tras `down.sql` (solo el suyo), 13 e identicas tras reaplicar.
  El fallo del `down.sql` con datos no se pudo probar: la plantilla no tiene lotes.
- Base de desarrollo sin tocar. `schema.prisma` sin cambio (`unitCost Decimal?` ya era opcional).

Lectores de lotes de producto terminado revisados:
- Ya correctos, sin cambio de codigo:
  - Tab «Costo de produccion»: `list-finished-product-costs.ts:72-73` (`totalCost` null si `unitCost` null);
    adaptador `finished-product-detail-prisma.ts:241` (`decimalOrNull`). Prueba:
    `list-finished-product-costs.test.ts:164-168` y `actual-order-cost.int.test.ts` «R7, R17, R22».
  - Lista de lotes del producto y de lotes de un pedido: `product-prisma.ts` `toBatchView` (null -> null),
    `list-product-batches.ts`, `list-order-batches.ts`. Prueba nueva en «R7, R17, R22»
    (`inventario.listProductBatches` devuelve `unitCost: null`).
  - Columna «Costo» del listado (medio ponderado): `unit-cost.ts:123` salta el lote sin coste y
    `findAverageUnitCostByProduct` filtra `unitCost: { not: null }`; sin lotes con coste, `null`.
    Prueba: `weighted-average-unit-cost.test.ts` (casos con `unitCost: null`, lineas 39, 59, 75).
  - Costeo de recetas (estimado): `product-catalog-prisma.ts` filtra `unitCost: { not: null }`;
    `toCostingBatch` lanza con null. Prueba: `product-catalog-costing.test.ts:188`.
  - Consumos del pedido: `order-consumption-prisma.ts:42` (null -> null). Prueba:
    `order-consumption-ledger.int.test.ts:261-270`.
  - Entregas/despachos y existencias PT (`finished-stock-prisma.ts`, `product-prisma.ts` ajustes y
    raw SQL): no leen `unit_cost`.
  - Importacion: sigue exigiendo costo por regla propia; solo se corrige el comentario de
    `import-finished-goods.ts`, que decia que lo exigia la base.
- UI (no tocada; ya pinta el vacio con null): `finished-product-costs-table.tsx:20-21`
  (`amountText` -> `EMPTY_MARK`), `product-columns.tsx:306` (`unitCostCell`). Nada pendiente para frontend_dev.
- No hay en `lib/` valoracion de inventario ni exportaciones con costo de lotes PT.

Tests:
- Nuevo `tests/unit/inventario/schema/finished-goods-lot-cost-optional-migration.test.ts` (5).
- `tests/guards/guard-identificador-de-request.test.ts`: la migracion entra en `MIGRACIONES_ESPERADAS`.
- `finish-with-finished-goods.int.test.ts`: el caso de QC-150 pasa a «QC-305 P1 / R7, R17: un ingrediente
  con material pero sin costo deja el pedido sin coste real y su lote de producto terminado sin coste
  unitario» (`actualCost` null, lote con `package_content` y `unit_cost` null).
- `actual-order-cost.int.test.ts` «R7, R17, R22»: verde; anade la lista de lotes.
- `tests/unit/inventario/schema/inventory-movements-migration.test.ts`: el censo R15(b) estaba ROJO desde
  T3 (`inventoryMovement.groupBy` de `order-consumption-prisma.ts`, de solo lectura); se admite `groupBy`.
- El test estatico de `finished-products-and-content-copies` sigue fijando el ADD original (correcto: esa
  migracion no cambia).

Mapa R -> test (T4b): R17 -> `finished-goods-lot-cost-optional-migration.test.ts`, `actual-order-cost.int`
«R7, R17, R22», `finish-with-finished-goods.int` «QC-305 P1 / R7, R17»; R7 -> los dos ultimos; R22 -> «R7, R17, R22».

Verificacion (salida real):
- `pnpm run typecheck`: exit 0. `pnpm run lint`: `0 errors, 10 warnings` (los mismos 10); eslint de los tocados: limpio.
- `pnpm exec vitest run guard`: 85 archivos, 1255 pasan, 22 omitidos.
- Unitarios: `tests/unit/inventario/schema/` + `tests/unit/pedidos/schema/` + vecinos: 45 archivos, 615/0
  (`finished-goods-lot-cost-optional-migration` 5/0, `inventory-movements-migration` 9/0,
  `finished-products-and-content-copies-migration` 24/0, `list-finished-product-costs` 10/0,
  `weighted-average-unit-cost` 8/0, `order-packing` 69/0, `orders-actual-cost-migration` 8/0).
- Integracion: 12 archivos, 118/0 (`actual-order-cost` 6/0, `finish-with-finished-goods` 33/0,
  `order-packing` 15/0, `order-conditioning-states-rollback` 2/0, `inventario/finished-goods` 10/0,
  `finished-goods-receipts` 6/0, `finished-product-detail` 13/0, `inventory-import-finished-goods` 3/0,
  `order-batches` 6/0, `order-consumption-ledger` 8/0, `finished-goods-dispatch` 12/0, `deliverable-batches` 4/0).
  Nota: a mitad de la tanda el Postgres local estuvo ~1 min en recuperacion (57P03); se reintento.

Veredicto T4b: CHECK retirado con su down, P1/R17 verde en la base, lectores ya trataban NULL como «sin coste»; T4 desbloqueada.
