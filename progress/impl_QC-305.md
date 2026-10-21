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

## T6 — el real llega a las salidas de `pedidos.consultar` y no a `asignaciones` (R24)

Solo tests; ningun cambio de codigo: `getOrder`/`listOrders` ya copian `actualCost` de la fila tras
`requirePermission(actor, 'pedidos.consultar')`, y las vistas de `asignaciones` no lo declaran ni lo copian.

Archivos modificados (solo tests):
- `tests/unit/pedidos/get-order.test.ts` (+4 casos; importa `UnauthorizedError`).
- `tests/unit/pedidos/list-orders.test.ts` (+3 casos).
- `tests/unit/asignaciones/get-assigned-order-execution.test.ts` (+2 casos).
- `tests/unit/asignaciones/list-assigned-orders.test.ts` (+2 casos).
Los cuatro archivos que pedia `tasks.md` existian; no hizo falta buscar equivalentes.

Mapa R24 -> test:
- `get-order.test.ts` «QC-305 — getOrder: el coste real y quien lo ve (R24)»:
  «R24: con pedidos.consultar la ficha trae actualCost como cadena de 4 decimales, tal como viene de la fila»;
  «R24: un pedido sin coste real sale con actualCost null, no "0.0000" ni ausente»;
  «R24: un actor sin pedidos.consultar se rechaza como hoy, sin llegar al repositorio ni a los catalogos»;
  «R24: un actor ausente se rechaza como hoy, sin llegar al repositorio ni a los catalogos».
- `list-orders.test.ts` «QC-305 — listOrders: el coste real y quien lo ve (R24)»:
  «R24: con pedidos.consultar cada fila trae actualCost como cadena de 4 decimales o null»;
  «R24: rechaza al Operador como hoy, sin llegar al repositorio ni a los catalogos»;
  «R24: rechaza al actor ausente como hoy, sin llegar al repositorio ni a los catalogos».
- `get-assigned-order-execution.test.ts` «QC-305 — la pantalla de ejecucion no lleva el coste real (R24)»:
  «R24: ninguna clave de importe (actualCost, ingredientsCost, packagingCost...) en toda la vista, aunque el resumen las traiga»
  (recorrido recursivo con `/cost|coste|importe|price|precio|amount/i`, resumen con los tres importes colados);
  «R24: el contrato de la vista no declara actualCost (comprobacion de tipo)».
- `list-assigned-orders.test.ts` «QC-305 — la lista de pedidos asignados no lleva el coste real (R24)»:
  «R24: ninguna clave de importe (actualCost, ingredientsCost, packagingCost...) en ninguna fila, aunque el resumen las traiga»;
  «R24: el contrato del resumen asignado no declara actualCost (comprobacion de tipo)».
Nota: `list-assigned-orders.test.ts` y `get-assigned-order-execution.test.ts` ya tenian titulos «R24: ...» de
otra feature (presentacion / insumo sin unidad); los de QC-305 se distinguen por su `describe` «QC-305 — ...».

Verificacion (salida real):
- `pnpm run typecheck`: `tsc --noEmit`, exit 0.
- `pnpm run lint`: `✖ 10 problems (0 errors, 10 warnings)` (los mismos 10 preexistentes); eslint de los 4 tocados: limpio.
- `pnpm exec vitest run <los 4 archivos>`: `Test Files 4 passed (4)`, `Tests 168 passed (168)`.
- `pnpm exec vitest run guard`: primera pasada `1 failed | 84 passed (85)`, `2 failed` (con el frontend_dev editando
  `app/(private)/pedidos/**` en paralelo; no se identifico cual); tercera pasada `Test Files 85 passed (85)`,
  `Tests 1255 passed | 22 skipped (1277)`.

Veredicto T6: R24 cubierto en los cuatro archivos, verde, sin tocar codigo de produccion.

## T7 (frontend_dev) — UI: columnas del listado y formulario en `EN_CURSO` — 2026-10-21

Archivos de produccion:
- `app/(private)/pedidos/components/order-columns.tsx`: `PRODUCTION_COST_COLUMN_ID` rotula «Costo estimado» (id
  `productionCost` sin cambio); nace `ACTUAL_COST_COLUMN_ID = 'actualCost'` justo despues, «Costo real», `align: 'end'`,
  `tabular: true`, sin `sortable` ni `filter`, testid `order-actual-cost` (`ACTUAL_COST_TESTID`). `ProductionCost` pasa a
  `CostCell({ value, field })` (el testid sale de `field`). Cabecera del modulo: CATORCE columnas.
- `app/(private)/pedidos/components/use-order-cost-quote.ts`: cuarto argumento `{ frozen }` (`OrderCostQuoteOptions`);
  con `frozen` los cuatro manejadores no hacen nada y el estado se queda en el importe inicial.
- `app/(private)/pedidos/components/order-form.tsx`: pasa `frozen: order !== undefined && STARTED_ORDER_STATUSES.includes(order.status)`.
- `app/(private)/pedidos/components/order-list-skeleton.tsx`: `ORDER_SKELETON_COLUMN_COUNT` 13 -> 14 (un test lo ata a
  `ORDER_COLUMNS.length`).
- `app/(private)/pedidos/components/index.ts`: reexporta `ACTUAL_COST_COLUMN_ID`, `ACTUAL_COST_TESTID`, `OrderCostQuoteOptions`.
- `lib/modules/pedidos/index.ts`: **una linea**, reexporta `STARTED_ORDER_STATUSES`. La UI no puede importar `domain/`
  (guard-arquitectura-modulos R13) y el barrel no lo exportaba; es la unica via publica. Fuera del alcance estricto de
  frontend: lo revisa el leader.

Tests:
- `tests/unit/pedidos-ui/order-columns.test.tsx` (79): lista de ids y no ordenables ampliadas con `actualCost`, 13 -> 14;
  bloque «las columnas «Costo estimado» y «Costo real»» sustituye al de «Costo de producción».
- `tests/unit/pedidos-ui/use-order-cost-quote.test.ts` (6): bloque «estimado congelado».
- `tests/unit/pedidos-ui/order-form-quote.test.tsx` (27): bloque «R15 — en EN_CURSO el estimado esta congelado»; el
  pedido por defecto del archivo pasa de `EN_CURSO` a `PENDIENTE` (los casos de R12/R65 son de un pedido no comenzado).
- Ajustados: `tests/unit/marca/tablas-marca.test.tsx` (rotulos tabulares «Costo estimado», «Costo real»),
  `tests/unit/pedidos-ui/pedidos-viewport.test.tsx` (13 -> 14), snapshot de `tests/unit/paridad/pedidos-paridad.test.tsx`
  (`-u`; el diff es solo el rotulo nuevo, la cabecera «Costo real» y la celda `order-missing-actualCost`).

Mapa R -> test:
- R15: `use-order-cost-quote.test.ts` «R15: con frozen ningun manejador pide cotizacion y queda el importe inicial»,
  «R15: con frozen y sin importe guardado queda el guion, no 0», «R15: sin frozen se cotiza como hoy»;
  `order-form-quote.test.tsx` «R15: se ve el guardado y cambiar cantidad, receta o unidad no pide cotizacion»,
  «R15: sin estimado guardado se ve el guion y tampoco se cotiza», «R15: en PENDIENTE la edicion sigue cotizando como hoy».
- R19: `order-columns.test.tsx` «R19: son contiguas, en ese orden, justo antes de las acciones», «R19: se rotulan «Costo
  estimado» y «Costo real», y el rotulo viejo ya no esta», «R19: el estimado conserva su id para no perder preferencias
  guardadas», «R19: ninguna de las dos ordena ni filtra», «R19: las dos alinean al final y en cifras tabulares». La
  tarjeta sale de las mismas columnas (snapshot de paridad).
- R20: `order-columns.test.tsx` «R20: sin coste real pinta el guion con el rotulo «Sin dato», nunca 0 ni vacio», «R20:
  sin estimado pinta el guion con el rotulo «Sin dato», como hoy», «R20: el real no cae al estimado cuando falta».
- R21: `order-columns.test.tsx` «R21: un importe exacto a dos decimales no lleva `title`», «R21: un importe que se
  redondea expone el exacto en el `title`», «R21: el real se pinta de `actualCost` y no del estimado». **Abierto**: ver
  bloqueo de formato abajo; los asserts de texto miran `120.00` / `12,752.55` sin fijar el prefijo.
- R22: sin cambio de UI (design §5.3); se cubre en integracion/E2E (T8).

Bloqueo de formato (R21 contra design §5.1): R21 y tasks piden `$ 120.00` / `$ 12,752.55` (con espacio), y design
§5.1 dice `formatMoneyDisplay`, que pinta `$120.00` sin espacio (`MONEY_SYMBOL` + cifra; el estimado hoy se ve `$1,234.57`
y su test lo fija). El formato con espacio ya existe en la ruta: `order-amount.ts > formatOrderAmount` (bloque de coste
del formulario). Se dejo `formatMoneyDisplay` (lo que dice el design, y las dos columnas iguales). Decide el humano:
(a) R21 se lee sin espacio y se corrige el texto de R21/tasks; o (b) las dos columnas pasan a `formatOrderAmount`
(cambia tambien como se ve el estimado y su test).

Preferencia de columnas guardada: `DataTable` solo persiste el **fijado** (`use-pinned-columns.ts`, `localStorage`,
`{ left, right }` de ids; los ids que ya no existen se descartan). No hay preferencia de visibilidad ni de orden
(`columnVisibilityFeature`/`columnOrderingFeature` no se activan). Una preferencia vieja **no esconde** «Costo real»:
nace sin fijar y visible. Unico efecto: quien tenga `productionCost` fijada a un borde la ve en ese borde y «Costo real»
queda en su sitio, asi que para esa persona dejan de verse contiguas hasta que desfije. No se cambia `DataTable`.

Capturas: no se levanto servidor; quedan para el E2E (T8).

Verificacion (salida real):
- `pnpm run typecheck`: `tsc --noEmit`, exit 0.
- `pnpm run lint`: `✖ 10 problems (0 errors, 10 warnings)`, todos en archivos no tocados (step-evidence.tsx,
  list-execution-traces, confirm-catalog-import, order-service.test).
- `pnpm exec vitest run` de order-columns, use-order-cost-quote, order-form-quote, pedidos-viewport, tablas-marca,
  pedidos-paridad: `Test Files 6 passed (6)`, `Tests 160 passed (160)`.
- `pnpm exec vitest run` de order-form, order-form-customer, order-form-leftover, order-form-image-paridad, order-cards,
  order-table, order-list-section, order-list-section-produced, order-row-wiring, read-only, pedidos-convenciones,
  a11y-tactil (+ paridad antes del `-u`): `12 passed`, solo los 2 snapshots de paridad en rojo, luego actualizados.
- `pnpm exec vitest run guard-arquitectura guard-catalogo`: `Test Files 4 passed (4)`, `Tests 163 passed (163)`.

Veredicto T7: R15, R19, R20 verdes; R21 verde salvo el prefijo `$ ` pendiente de decision; R22 sin UI.
