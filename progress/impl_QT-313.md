# impl QT-313 — pedido-con-varias-recetas-backend

## Fase 1 — Modelo (backend_dev, 2026-11-03)

Hechas: **T0** y **T1** (commit 8b79a3328) y **T2** tras la enmienda df0c5c21f (paso 1 de 2: `order_line_id` nullable).

### Archivos

Creados:
- `db/migrations/20261103115900_order_status_partial/migration.sql` + `down.sql`
- `db/migrations/20261103120000_order_lines/migration.sql` + `down.sql`
- `tests/helpers/migration-script.ts` (ejecutar migration/down reales en transaccion con ROLLBACK)
- `tests/unit/pedidos/order-classification.test.ts`
- `tests/unit/integraciones/whatsapp-chat-context.test.ts`
- `tests/integration/pedidos/order-status-partial-migration.int.test.ts`
- `tests/integration/pedidos/order-lines-migration.int.test.ts`

Modificados (produccion):
- `db/schema.prisma` — `PARCIAL` primero en `OrderStatus`; modelo `OrderLine` (`@module pedidos`); `Order.lines`
- `lib/modules/pedidos/domain/order-classification.ts` — `PARCIAL` primero en `ORDER_STATUS_VALUES` y `ORDER_STATUS_FLOW`; `OrderLineStatus`; comentario corregido
- `lib/modules/pedidos/index.ts` — exporta `OrderLineStatus`
- `lib/modules/pedidos/domain/order-transitions.ts`, `order-cancellation.ts` — mapas `Record<OrderLineStatus,…>`; `PARCIAL` nunca transiciona ni se cancela como estado
- `lib/modules/asignaciones/domain/order-state.ts`, `count-evidence-locking-orders.ts` — mapas `OrderLineStatus`
- `lib/modules/pedidos/domain/set-order-customer.ts` — `PARCIAL` admite cambio de cliente
- `lib/shared/ui/order-status.ts` — «Parcial», tono `progress`
- `lib/modules/integraciones/domain/whatsapp-chat-context.ts` — `PARCIAL` → «en preparación»
- `app/(private)/pedidos/components/order-row-actions.tsx`, `order-delivery-list.tsx` — clave `PARCIAL` en los mapas totales
- `scripts/seed-demo/data.ts` — `PARCIAL` en `UNREACHABLE_ORDER_STATUSES`

Tests existentes ajustados: lista al final de `tasks.md > Archivos esperados`.

### Mapa R<n> → test (fase 1)

| R | Test |
|---|---|
| R2 | `order-lines-migration.int.test.ts` › «R2: la base rechaza una linea cuya empresa no es la de su pedido», «R2: order_lines tiene RLS activada y forzada» |
| R5 | `order-lines-migration.int.test.ts` › «R5: la base rechaza dos lineas activas con la misma original, y tambien original + version», «R5: la base admite la misma original si una de las dos esta cancelada o quitada» |
| R6 | `order-lines-migration.int.test.ts` › «R6: la base rechaza dos lineas con la misma posicion en un pedido» (parcial: el orden de lectura es T8/T13) |
| R7 | `order-lines-migration.int.test.ts` › «R7: cada pedido, borrados incluidos, queda con exactamente una linea…», «R7: la bajada quita la tabla y deja orders como estaba» |
| R15 | `order-lines-migration.int.test.ts` › «R15: la base rechaza cantidad 0 y precio de linea negativo, y admite precio 0» |
| R48 | `order-lines-migration.int.test.ts` › «R48: la base rechaza una linea PARCIAL»; `order-classification.test.ts` › «R48: PARCIAL no es origen ni destino…» |
| R50 | `order-classification.test.ts` › «R50: PARCIAL no esta entre los estados que dejan de estar en curso»; `tests/unit/integraciones/whatsapp-chat-context.test.ts` › «R50: un pedido PARCIAL cuenta como abierto…» |
| R52 | `order-classification.test.ts` › «R52: PARCIAL es el primero de la lista…», «R52: PARCIAL va delante de PENDIENTE…»; `order-status-partial-migration.int.test.ts` › los cuatro casos R52 (enum, orden asc/desc, bajada que aborta, bajada limpia) |
| R53 | `tests/unit/shared-ui/order-status.test.ts` › «R53 — se nombra «Parcial» con el tono progress»; `tests/unit/integraciones/whatsapp-chat-context.test.ts` › «R53: un pedido PARCIAL se lee «en preparación»» |
| R8 | `tests/integration/pedidos/order-lines-references-migration.int.test.ts` › «R8, R37: los conteos de las seis tablas no cambian y toda fila de un pedido de una linea apunta a ella, delivery_void con la misma linea que su delivery», «R8: un pedido creado sin linea antes de la migracion la recibe…», «R8: la bajada se niega si una fila con linea es de un pedido de varias lineas…» y otros cinco R8 |
| R37 (base, paso 1) | mismo archivo › «R37: la base rechaza linea en un asiento opening o adjustment y la admite en los cuatro tipos con pedido» |

### Verificacion (salida real)

- `pnpm run typecheck` → exit 0 (tras `pnpm exec next typegen`; sin el, `LayoutProps` falta, error de entorno conocido)
- `pnpm run lint` → 0 errores, 10 warnings, ninguno en archivos de esta tanda
- `pnpm exec vitest related --run --project node --project ui <archivos de T0>` → primera corrida 5 archivos rojos por listas de estados escritas a mano (ajustados); los 5 vueltos a correr: `Test Files 5 passed (5)`, `Tests 322 passed (322)`. Corrida completa del related: `Test Files 5 failed | 532 passed (537)` antes del ajuste.
- Unit de T0: `Test Files 9 passed (9)`, `Tests 272 passed (272)`
- `vitest related` de los ultimos cambios (`set-order-customer.ts`, `seed-demo/data.ts`, `order-row-actions.tsx`): `Test Files 506 passed (506)`, `Tests 9545 passed | 2 skipped`
- `eslint` sobre los archivos tocados: 0 errores
- Integracion (base efimera, plantilla reconstruida con las migraciones nuevas): `order-status-partial-migration`, `order-lines-migration`, `order-status-blocked-rollback`, `order-conditioning-states-rollback` → `Test Files 4 passed (4)`, `Tests 17 passed (17)`
- Integracion de todos los `.int` que leen un `down.sql` (56 archivos): 1 rojo (`pedidos/company-scope`, la FK nueva colgaba de `orders_id_company_id_key`), ajustado y vuelto a correr: `Tests 12 passed (12)`
- `pnpm exec vitest run guard` → `Test Files 87 passed (87)`, `Tests 1327 passed | 22 skipped`

### T2 (2026-11-03, tras la enmienda)

Archivos: `db/migrations/20261103120100_order_lines_references/{migration.sql,down.sql}` (nuevos),
`tests/integration/pedidos/order-lines-references-migration.int.test.ts` (nuevo), `db/schema.prisma`
(`orderLineId String?` + indice en los seis modelos), `tests/guards/guard-identificador-de-request.test.ts`,
`tests/integration/aislamiento.json`.

Verificacion (salida real):
- `pnpm run typecheck` → sin errores; `pnpm run lint` → 0 errores
- `order-lines-references-migration.int` → `Test Files 1 passed (1)`, `Tests 8 passed (8)` (plantilla reconstruida)
- 16 `.int` que bajan o tocan estas tablas/migraciones → `Test Files 16 passed (16)`, `Tests 133 passed (133)`
- `pnpm exec vitest run guard` → `Test Files 87 passed (87)`, `Tests 1327 passed | 22 skipped`
- Pendiente de CI: que ningun `.int` no corrido compare filas enteras de las seis tablas con `toEqual` (ahora llevan `orderLineId: null`).

El bloqueo original de T2 lo resolvio la enmienda del spec (T2 en dos pasos; el paso 2 es T14e).

## Decisiones del humano (2026-11-03) sobre lo hecho fuera del spec en T3–T6

- Todas las lineas canceladas: costes totales `"0.0000"`, precio total `null`. Se queda; lo fija un test en `order-totals.test.ts`.
- Quitar la linea X y anadir otra X en la misma edicion: admitido; el adaptador escribe bajas antes que altas por el indice unico parcial. Test de integracion en T10.
- Aceptadas tal cual: `id` repetido en una edicion → `invalid_input`; `id` de linea cancelada sin cambios pasa, con cambios → `invalid_transition`; `deriveOrderStatus([])` lanza error de programacion; textos «El pedido ya tiene esa fórmula.» y «Esa fórmula ya no se puede quitar del pedido.».
- Nombres de los esquemas de T6 provisionales: T9, T10 y T14c los renombran a los del design y borran los planos.

## Fase 2 — Dominio puro (T3–T6, 2026-11-03)

Archivos: `lib/modules/pedidos/domain/{order-status-derivation,order-totals,order-line-diff,order-line-removal}.ts` (nuevos), `order-input.ts`, `order-edit-change.ts`, `errors.ts`, `lib/modules/errores/domain/{error-codes,error-catalog}.ts`; tests `tests/unit/pedidos/{order-status-derivation,order-totals,order-line-diff,order-input-lines}.test.ts` (nuevos), `tests/unit/errores/catalogo.test.ts`, `tests/unit/pedidos/module-contract.test.ts`.

Mapa R → test:
| R | Test |
|---|---|
| R3, R15, R42 | `order-input-lines.test.ts` |
| R4, R20, R22, R23, R24 | `order-line-diff.test.ts` (p. ej. «R4: la original y una version suya son la misma receta», «R23: quitar una EN_CURSO rechaza con order_line_not_removable…», «R24: una linea en estado no editable con cambios rechaza con invalid_transition») |
| R16, R18, R33 | `order-totals.test.ts` (incl. «R16, R18: todas canceladas: costes 0.0000 y precio null», «R33: TERMINADO y ENTREGADO cuentan como terminadas») |
| R34 | `order-status-derivation.test.ts` |

Verificacion (salida real, backend_dev de cierre):
- `pnpm run typecheck` → exit 0; `pnpm run lint` → 0 errores
- `vitest related --run` (node + ui + integration, base efimera) → 1184 archivos / 19939 tests en verde (node 576, ui 362, integration 246)
- `pnpm exec vitest run guard` → 87 archivos en verde

## Fase 3 — Reserva y consumo por linea (T7, 2026-11-03)

Archivos de produccion: `lib/modules/inventario/domain/{reservation,order-consumption,inventory-movement}.ts`, `lib/modules/inventario/index.ts`, `lib/modules/inventario/adapters/driven/persistence/{reservation-prisma,order-consumption-prisma,batch-movement-prisma,product-prisma}.ts` (en `product-prisma.ts` solo `consumeBatchStock`), `lib/modules/pedidos/ports/order-write-repository.ts` y `adapters/driven/persistence/order-prisma.ts` (`findOnlyLineId`), y los llamantes de `pedidos`: `create-order`, `delete-order`, `expire-stale-orders`, `order-cancellation`, `order-packing`, `order-requirement`, `review-blocked-orders`, `transition-order`, `update-order-presentation-lines`, `update-order`.
Tests: nuevo `tests/integration/pedidos/order-lines-repository.int.test.ts`; ampliados `tests/integration/inventario/{reservation,order-consumption-ledger}.int.test.ts`; ajustados los listados en `tasks.md > Archivos esperados` (bloque de la fase 3).

Mapa R → test:
| R | Test |
|---|---|
| R12 | `reservation.int` › «QT-313 R12, R37: dos lineas que comparten insumo apartan en orden; la segunda ve lo que aparto la primera» |
| R27 | `reservation.int` › «QT-313 R27, R37: liberar una linea asienta solo su release y deja intacto lo de la otra» |
| R36 | `reservation.int` › «QT-313 R36, R37: consumir una linea consume solo lo suyo y el asiento consumption lleva su linea» |
| R37 (reserva y consumption) | `reservation.int` › los tres de arriba, «QT-313 R37: liquidar los envases de una linea…», «QT-313 R37: con orderLineId null el pedido aparta, libera y consume como hoy…»; `order-lines-repository.int` › cuatro de `findOnlyLineId` (una linea, ninguna, otra empresa, quitada/dos vivas) |
| R38 | `order-consumption-ledger.int` › «QT-313 R38: lee solo los asientos consumption de la linea pedida; con null, solo los del pedido sin linea» |

Verificacion (salida real):
- backend_dev: `pnpm run typecheck` exit 0, `pnpm run lint` 0 errores, guardias en verde, los 3 `.int` de «Hecho» `Tests 46 passed (46)`, unit tocados en verde. Su `vitest related` completo murio por memoria.
- implementer, integracion en tandas con `--maxWorkers=1` (base efimera):
  - `settle-packaging`, `qc195-packaging-catalog`, `qc195-packaging-list`, `order-unit-of-work`, `order-unit-conversion`, `qc195-packaging-reservation` → `Test Files 6 passed (6)`, `Tests 45 passed (45)`
  - `order-reservation`, `order-reservation-concurrency`, `order-reservation-tools`, `order-crud`, `order-expiry`, `review-blocked-orders`, `order-packing`, `order-conditioning`, `order-repository`, `order-cost-quote`, `order-ingredients-cost`, `actual-order-cost` → `Test Files 12 passed (12)`, `Tests 142 passed (142)`
  - `company-scope`, `company-scope-queries`, `finish-with-finished-goods`, `order-customer`, `order-sale-price`, `order-content-copy`, `order-delivery-repository`, `order-delivery-void`, `direct-delivery-void`, `order-packed-counts`, `pedidos-constraints`, `order-lines-repository`, `order-finished-at`, `order-duplicate-number` → `Test Files 14 passed (14)`, `Tests 193 passed (193)`
- Base huerfana `qct_qt313pedidoc_db1ee7f3_mw15rf1o_pew`: ya no existia al consultarla (`pg_database` sin `qct_qt313%`); la barrio la corrida siguiente.

Desviaciones aceptadas por el humano (2026-11-03):
- `inventory-movement.ts` tocado (anadido a Archivos esperados).
- `findOnlyLineId` lanza si hay mas de una linea viva: valido porque antes de T9 no hay pedidos de varias lineas. **T14e lo elimina junto con el `orderLineId: null`.**
- **Para revisar en T8–T13:** (1) `findReservedAndAvailableByBatch` y `findCoverageByOrderIds` siguen agrupando por pedido, no por linea; (2) el doble `tests/helpers/order-unit-of-work-double.ts` devuelve `null` en `findOnlyLineId`.
