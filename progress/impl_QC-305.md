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
