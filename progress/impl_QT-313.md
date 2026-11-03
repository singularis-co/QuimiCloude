# impl QT-313 — pedido-con-varias-recetas-backend

## Fase 1 — Modelo (backend_dev, 2026-11-03)

Hechas: **T0** y **T1**. **T2 bloqueada** (ver abajo). Commit de la tanda: lo hace el implementer.

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
| R8 | pendiente: T2 bloqueada |

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

### Bloqueo de T2

`order_line_id NOT NULL` en las seis tablas hijas rompe el codigo de hoy, que sigue escribiendo
esas filas sin linea hasta T7/T8/T14a, y los pedidos nuevos no tienen linea hasta T8/T9
(`order-prisma.ts` inserta `order_presentation_lines` en crudo; `reservation-prisma.ts`,
`batch-movement-prisma.ts`, `execution-log-prisma.ts`, `step-evidence-prisma.ts`,
`conditioning-team-prisma.ts` crean sin `orderLineId`; ~70 archivos de test siembran esas tablas).
El gate no queda verde al cerrar la fase 1 como pide `tasks.md`. Hace falta decision humana.

Veredicto: T0 y T1 en verde; T2 bloqueada a la espera de decision.
