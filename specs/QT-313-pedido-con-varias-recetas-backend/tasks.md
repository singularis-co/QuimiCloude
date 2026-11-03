# QT-313 — pedido-con-varias-recetas-backend · tasks.md

> Escrito por `spec_author` (F1.2, 2026-11-03) y revisado en F1.4 (2026-11-03) con las decisiones
> P1–P13. `[P]` = paralelizable con las otras `[P]` de su misma fase. Cada task cierra con
> `pnpm run typecheck`, `pnpm run lint` y `pnpm exec vitest related --run <archivos tocados>` en
> verde, y un commit `feat(QT-313): …`. No queda ninguna pregunta abierta.
>
> Orden por fases: el modelo nuevo convive con las columnas viejas de `orders` hasta la fase 5;
> la migración que las borra (T15) va la **última**, cuando ya nadie las lee. Así cada fase deja
> el gate en verde.

## Fase 1 — Modelo (convive con las columnas viejas)

- [x] **T0 — Valor `PARCIAL` del enum.** Migración `20261103115900_order_status_partial` escrita a
  mano con `ADD VALUE 'PARCIAL' BEFORE 'PENDIENTE'` (`migration.sql` + `down.sql` que aborta si hay
  pedidos `PARCIAL` y recrea el tipo con los diez valores de hoy), `db/schema.prisma` con
  `PARCIAL` el primero del enum, `ORDER_STATUS_VALUES` con `'PARCIAL'` el primero (y su comentario
  corregido, design § 2.2.2), tipo `OrderLineStatus`, los mapas de línea retipados
  (`order-transitions.ts`, `order-cancellation.ts`, `asignaciones/domain/order-state.ts`,
  `count-evidence-locking-orders.ts`), «Parcial» con tono `progress` en
  `lib/shared/ui/order-status.ts` y «en preparación» en
  `integraciones/domain/whatsapp-chat-context.ts` (R53); `ORDER_STATUS_FLOW` con `PARCIAL` el
  primero (R52); `PARCIAL` fuera de `ORDER_STATUSES_NOT_IN_PROGRESS` (R50).
  *Hecho:* `module-contract.test.ts` verde con la lista nueva; test de migración: sube, el enum
  queda con `PARCIAL` delante de `PENDIENTE`, baja sin pedidos `PARCIAL` y se niega con uno; tests
  de R50, R52 (`ORDER_STATUS_FLOW[0]`) y R53 (etiqueta, tono y texto de WhatsApp).
- [x] **T1 — Tabla `order_lines` y relleno.** `db/schema.prisma` (modelo `OrderLine`, `/// @module
  pedidos`) y migración `20261103120000_order_lines` con `migration.sql` + `down.sql`, RLS
  `ENABLE` + `FORCE`, CHECK (incluido `status <> 'PARCIAL'`), único parcial `(order_id,
  original_recipe_id) WHERE deleted_at IS NULL AND status <> 'CANCELADO'`, índice de caducidad,
  índice `(order_id, status) WHERE deleted_at IS NULL` para el filtro de R49, FK compuestas (design § 1.1, § 1.4). Relleno: una línea por pedido, borrados incluidos, con
  `reserved_at` y `original_recipe_id`.
  *Hecho:* test de integración de migración: N pedidos → N líneas con los once valores iguales,
  `NULL` incluidos, y el estado de cada pedido sin cambiar (R7); la base rechaza línea de otra
  empresa (R2), cantidad 0, precio negativo (R15), línea `PARCIAL` (R48) y dos líneas activas con
  la misma original, también original + versión (R5); las admite si una está cancelada o quitada
  (R5); `down.sql` deja el esquema como antes. Depende de T0.
- [ ] **T2 — `order_line_id` en las tablas hijas.** Migración `20261103120100_order_lines_references`
  (design § 1.3): reparto, reservas, movimientos de inventario, registro de ejecución, evidencias y
  equipo de acondicionamiento; relleno, `NOT NULL`, FK `(order_line_id, order_id)`, únicos nuevos y
  bloque `DO` que aborta si queda una fila sin línea. Schema de los seis modelos.
  *Hecho:* test de integración: conteos iguales antes y después en las seis tablas y cada fila
  apunta a la línea de su pedido (R8); la FK rechaza una línea de otro pedido; `down.sql` revierte.
  Depende de T1.

## Fase 2 — Dominio puro `[P]`

- [ ] **T3 [P] — Estado derivado.** `domain/order-status-derivation.ts`: `deriveOrderStatus(lines)`
  con la regla de design § 2.2 (todas canceladas → `CANCELADO`; activas iguales → ese estado;
  distintas → `PARCIAL`).
  *Hecho:* test unitario con todos los pares de estados de línea, `TERMINADO` + `ENTREGADO` y
  `PENDIENTE` + `BLOQUEADO` (→ `PARCIAL`), canceladas mezcladas, todas canceladas, una línea
  (= su estado) (R34). Depende de T0.
- [ ] **T4 [P] — Totales y resumen.** `domain/order-totals.ts`: `sumDecimal4`, precio total con
  `linesWithoutPrice`, coste estimado y real totales, `progress`.
  *Hecho:* tests unitarios de R16, R18 y R33: canceladas fuera de sumas, total y terminadas;
  `TERMINADO` y `ENTREGADO` cuentan como terminadas; 0, vacíos y sumas de más de 10 dígitos
  enteros; sin `number` en el cálculo.
- [ ] **T5 [P] — Diff de líneas y reglas por línea.** `domain/order-line-diff.ts` (editar / añadir /
  quitar a partir de la entrada y las líneas vivas, R20), `domain/order-line-removal.ts`
  (quitables `PENDIENTE` y `BLOQUEADO`, R22, R23), comprobación de receta duplicada sobre la
  **original** contra la entrada y las líneas activas (R4), y la regla «línea no editable con
  cambios» (R24).
  *Hecho:* tests unitarios de R4 (dos originales iguales, original + versión, dos versiones de la
  misma original, receta de una línea cancelada que se vuelve a añadir → admitida), R20, R22,
  R23 (quitar `EN_CURSO` → rechazo; quitar `BLOQUEADO` → admitido) y R24.
- [ ] **T6 [P] — Esquemas de entrada y errores.** `order-input.ts` con `lines[]` (design § 4.1),
  `cancelOrderLineSchema`, `lineId` en la edición acotada; `DuplicateOrderRecipeError` y
  `OrderLineNotRemovableError` en `domain/errors.ts` y sus códigos en el catálogo de `errores`.
  *Hecho:* tests de esquema: sin líneas → `invalid_input` (R3), línea con `id` en el alta →
  `invalid_input`, precio por línea con las reglas de QC-307 (R15), `priority`/`customerId` dentro
  de una línea se descartan (R42).

## Fase 3 — Reserva y consumo por línea (`inventario`)

- [ ] **T7 — `MaterialReservations` por línea.** `inventario/domain/reservation.ts`,
  `reservation-ledger.ts`, `movement-ledger.ts`, `order-consumption.ts` y sus adaptadores
  (`reservation-prisma.ts`, `order-consumption-prisma.ts`, `batch-movement-prisma.ts`): la clave
  pasa a `(orderId, orderLineId)`, métodos renombrados `…ForLine` (design § 3). Los llamantes de
  `pedidos` pasan la única línea del pedido mientras el resto de fases no exista.
  *Hecho:* tests de integración de `reservation.int.test.ts` y `order-consumption-ledger` ampliados:
  dos líneas que comparten insumo aparta en orden (R12), liberar una no toca la otra (R27),
  consumir una consume solo lo suyo (R36), el libro de consumo filtra por línea (R38), todo
  asiento de pedido lleva su línea (R37). Depende de T2.

## Fase 4 — Casos de uso de `pedidos`

- [ ] **T8 — Puertos y persistencia de línea.** `ports/order-write-repository.ts`,
  `ports/order-repository.ts`, `order-prisma.ts`, `order-unit-of-work-prisma.ts`: crear, leer,
  bloquear (`FOR UPDATE`, pedido y luego líneas por `position`), actualizar, cancelar y dar de baja
  líneas; `reserved_at` por línea; escribir `orders.status` derivado; traducir la violación del
  único parcial a `duplicate_order_recipe`; `scope` último parámetro.
  *Hecho:* tests de integración: una línea de otra empresa o de otro pedido vuelve como `null` /
  `not_found` (R43); orden por `position` (R6); carrera de dos altas de la misma receta → una
  `duplicate_order_recipe` (R5). Depende de T2, T3.
- [ ] **T9 — Alta con líneas.** `create-order.ts`, `order-recipe.ts`, `resolve-ingredients-cost.ts`,
  `order-requirement.ts`: validar por línea con posición (R11), receta original de cada línea
  (R4), costear cada una (R17), una transacción (R10), apartar en orden (R12), bloqueo por línea
  (R13, R14), `reserved_at` por línea (R41), estado derivado (R34).
  *Hecho:* tests unitarios con dobles y uno de integración: alta de 2 líneas, alta con una línea
  que no alcanza con y sin confirmación, fallo de la segunda línea no deja nada escrito, original
  + versión → `duplicate_order_recipe`, sin permiso → `unauthorized` sin tocar puertos (R30).
  Depende de T5, T6, T7, T8.
- [ ] **T10 — Edición con líneas.** `update-order.ts`, `order-edit-change.ts`,
  `update-order-presentation-lines.ts`, `quote-order-cost.ts`, `order-presentation-availability.ts`:
  diff (R20), añadir con otras en producción (R21), quitar `PENDIENTE` o `BLOQUEADO` y liberar
  (R22), rechazar quitar en otro estado (R23), edición de línea no editable (R24), solo las
  cambiadas recalculan coste, apartado y plazo (R17, R25, R41), edición acotada por línea (R26).
  *Hecho:* un test por requisito; el coste, lo apartado y `reserved_at` de las líneas no tocadas
  son idénticos antes y después; re-añadir la receta de una línea cancelada funciona (R4).
  Depende de T9.
- [ ] **T11 — Cancelar línea, cancelar pedido, baja.** `cancel-order.ts`, `order-cancellation.ts`
  (+ `cancelOrderLine` nuevo, `domain/cancel-order-line.ts`), `delete-order.ts`.
  *Hecho:* tests de R27, R28, R29, R30 y R47: cancelar una libera solo lo suyo, no mueve las otras
  y deja el pedido `PARCIAL` o en el estado común; cancelar el pedido con una línea `POR_EMPACAR`
  la deja intacta; ninguna cancelable → `not_cancellable`; todas canceladas → pedido `CANCELADO`
  con motivo; baja con una línea consumida → rechazo. Depende de T8.
- [ ] **T12 — Entrega, anulación, bloqueados y caducidad.** `deliver-order.ts`, `void-delivery.ts`,
  `order-pending-delivery.ts`, `review-blocked-orders.ts`, `expire-stale-orders.ts`,
  `order-expiry.ts`, `order-expiry-cron-route.ts`.
  *Hecho:* tests de R39 (entregar completa solo la línea cuyo reparto se completa; anular la
  devuelve), R40 (dos líneas bloqueadas, entra material para una; la que pasa a `PENDIENTE`
  estrena plazo) y R51 (dos líneas `PENDIENTE` con plazos distintos: el proceso cancela solo la
  vencida y libera solo su material; el pedido queda `PARCIAL`). Depende de T8, T7.
- [ ] **T13 — Lecturas.** `get-order.ts`, `list-orders.ts`, `order-view.ts`, `order-queryable.ts`,
  `list-order-summaries.ts`, `list-query-sql.ts`, `order-catalog-prisma.ts`: `OrderView.lines`,
  totales y `progress` (design § 4.3); filtro por estado de `orderFilterWhere` en
  `order-prisma.ts` con el `OR` de design § 2.2.1, en su propio término del `AND`.
  *Hecho:* tests de R6, R16, R18, R33, R34 en la salida; R49 en integración: filtrar por
  `EN_CURSO` devuelve los `EN_CURSO` y los `PARCIAL` con una línea activa en curso, no los
  `PARCIAL` cuya única línea en curso está cancelada; filtrar por `PARCIAL` devuelve solo los
  parciales; filtrar por `EN_CURSO` y `PENDIENTE` a la vez no repite pedidos y `total` coincide;
  el filtro nunca trae pedidos de otra empresa; R52: ordenar por estado ascendente pone los
  `PARCIAL` antes que los `PENDIENTE`. Depende de T3, T4, T8.

## Fase 5 — Consumidores y puente

- [ ] **T14a [P] — `asignaciones` por línea.** `pedidos/domain/order-catalog.ts`,
  `transition-order.ts`, `order-packing.ts`, `order-conditioning.ts`; en `asignaciones`: los casos
  de uso de abrir, finalizar, empaque y acondicionamiento, `compose-order-rows.ts`,
  `evidence-target.ts`, `count-evidence-locking-orders.ts`, `list-execution-traces.ts`,
  `list-company-orders.ts`, y los adaptadores `execution-log-prisma.ts`, `step-evidence-prisma.ts`,
  `conditioning-team-prisma.ts` y sus Server Actions (pasan la única línea del pedido; las
  pantallas por línea son de QT-315, design § 5).
  *Hecho:* tests de R31, R32, R35, R36, R37, R38; R19: ninguna salida de `asignaciones` lleva
  precio; R45: con una línea, las salidas son iguales a las de hoy más `lineId`. Depende de T8, T7.
- [ ] **T14b [P] — Otros lectores.** `inventario/.../finished-stock-prisma.ts`,
  `deliverable-batches-prisma.ts`, `finished-goods-dispatch.ts`; `pedidos/.../direct-delivery-prisma.ts`,
  `packed-lines-directory-prisma.ts`, `customer-order-directory-prisma.ts`,
  `list-direct-delivery-surplus.ts`; `integraciones/domain/get-whatsapp-chat-context.ts`.
  *Hecho:* tests de integración de cada lector con un pedido de una línea dan lo mismo que hoy
  (R45) y ninguno lee las columnas de `orders` que se van. Depende de T8.
- [ ] **T14c [P] — Puente del formulario actual.** `pedidos/adapters/driving/order-actions.ts`
  (design § 7).
  *Hecho:* test de la acción: el `FormData` de hoy crea un pedido de una línea y la lectura del
  formulario devuelve los campos planos de hoy (R44); editar un pedido de dos líneas desde el
  puente → `invalid_input` sin escribir. Depende de T9, T10, T13.

## Fase 6 — Contrato y cierre

- [ ] **T15 — Quitar las columnas de `orders`.** Migración `20261103120200_orders_drop_line_columns`
  y `db/schema.prisma` (design § 1.2), `reserved_at` incluido. `down.sql` aborta si hay pedidos con
  más de una línea viva.
  *Hecho:* test de integración de la migración: sube y baja con pedidos de una línea dejando los
  valores como antes; con un pedido de dos líneas, la bajada falla, nombra cuántos y no cambia
  nada (R9); grep sin lecturas de `recipeId`/`quantity`/`salePrice`/`reservedAt` de `orders`
  fuera de la línea (R1). Depende de T14a, T14b, T14c.
- [ ] **T16 — Recorridos.** `e2e/pedido-con-varias-recetas.spec.ts` (pedido de una línea por la
  pantalla actual: alta, abrir y finalizar como operador; apartado, consumo y lote de producto
  terminado iguales a hoy) y `tests/integration/pedidos/order-lines-flow.int.test.ts` (dos líneas
  con insumo compartido: alta, cancelar una, finalizar la otra, lote a lote). El E2E de dos recetas
  por pantalla es de QT-315.
  *Hecho:* los dos en verde (R46). Depende de T15.
- [ ] **T17 [P] — Documentación del perfil.** `docs/architecture.md`, «Preguntas abiertas del
  dominio», punto 4: el precio de venta y el coste pasan a ser **de cada receta del pedido** y el
  pedido muestra la suma (enmienda de QC-307, decisión «¿Dónde va el precio de venta?»); y punto 2:
  la reserva elige lote **por receta del pedido**, con su propio plazo de caducidad.
  *Hecho:* el texto ya no dice «del pedido entero». Depende de T15.
- [ ] **T18 — Trazabilidad.** `progress/impl_QT-313.md` con el mapa `R1…R53 → test`.
  *Hecho:* cada `R<n>` tiene al menos un test con `R<n>` en el nombre. Depende de T16.

## Archivos esperados

- `db/schema.prisma`
- `db/migrations/20261103115900_order_status_partial/migration.sql`
- `db/migrations/20261103115900_order_status_partial/down.sql`
- `db/migrations/20261103120000_order_lines/migration.sql`
- `db/migrations/20261103120000_order_lines/down.sql`
- `db/migrations/20261103120100_order_lines_references/migration.sql`
- `db/migrations/20261103120100_order_lines_references/down.sql`
- `db/migrations/20261103120200_orders_drop_line_columns/migration.sql`
- `db/migrations/20261103120200_orders_drop_line_columns/down.sql`
- `lib/shared/ui/order-status.ts`
- `lib/modules/pedidos/index.ts`
- `lib/modules/pedidos/domain/order-classification.ts`
- `lib/modules/pedidos/domain/order-transitions.ts`
- `lib/modules/pedidos/domain/order-status-derivation.ts`
- `lib/modules/pedidos/domain/order-totals.ts`
- `lib/modules/pedidos/domain/order-line-diff.ts`
- `lib/modules/pedidos/domain/order-line-removal.ts`
- `lib/modules/pedidos/domain/cancel-order-line.ts`
- `lib/modules/pedidos/domain/order-input.ts`
- `lib/modules/pedidos/domain/order-queryable.ts`
- `lib/modules/pedidos/domain/errors.ts`
- `lib/modules/pedidos/domain/create-order.ts`
- `lib/modules/pedidos/domain/update-order.ts`
- `lib/modules/pedidos/domain/order-edit-change.ts`
- `lib/modules/pedidos/domain/update-order-presentation-lines.ts`
- `lib/modules/pedidos/domain/quote-order-cost.ts`
- `lib/modules/pedidos/domain/order-presentation-availability.ts`
- `lib/modules/pedidos/domain/resolve-ingredients-cost.ts`
- `lib/modules/pedidos/domain/order-requirement.ts`
- `lib/modules/pedidos/domain/order-recipe.ts`
- `lib/modules/pedidos/domain/cancel-order.ts`
- `lib/modules/pedidos/domain/order-cancellation.ts`
- `lib/modules/pedidos/domain/delete-order.ts`
- `lib/modules/pedidos/domain/deliver-order.ts`
- `lib/modules/pedidos/domain/void-delivery.ts`
- `lib/modules/pedidos/domain/order-pending-delivery.ts`
- `lib/modules/pedidos/domain/review-blocked-orders.ts`
- `lib/modules/pedidos/domain/expire-stale-orders.ts`
- `lib/modules/pedidos/domain/order-expiry.ts`
- `lib/modules/pedidos/domain/get-order.ts`
- `lib/modules/pedidos/domain/list-orders.ts`
- `lib/modules/pedidos/domain/order-view.ts`
- `lib/modules/pedidos/domain/list-order-summaries.ts`
- `lib/modules/pedidos/domain/order-catalog.ts`
- `lib/modules/pedidos/domain/transition-order.ts`
- `lib/modules/pedidos/domain/order-packing.ts`
- `lib/modules/pedidos/domain/order-conditioning.ts`
- `lib/modules/pedidos/domain/list-direct-delivery-surplus.ts`
- `lib/modules/pedidos/domain/get-order-delivery.ts`
- `lib/modules/pedidos/ports/order-write-repository.ts`
- `lib/modules/pedidos/ports/order-repository.ts`
- `lib/modules/pedidos/ports/order-unit-of-work.ts`
- `lib/modules/pedidos/adapters/driven/persistence/order-prisma.ts`
- `lib/modules/pedidos/adapters/driven/persistence/order-unit-of-work-prisma.ts`
- `lib/modules/pedidos/adapters/driven/persistence/order-catalog-prisma.ts`
- `lib/modules/pedidos/adapters/driven/persistence/order-company-stats-prisma.ts`
- `lib/modules/pedidos/adapters/driven/persistence/list-query-sql.ts`
- `lib/modules/pedidos/adapters/driven/persistence/direct-delivery-prisma.ts`
- `lib/modules/pedidos/adapters/driven/persistence/packed-lines-directory-prisma.ts`
- `lib/modules/pedidos/adapters/driven/persistence/customer-order-directory-prisma.ts`
- `lib/modules/pedidos/adapters/driven/persistence/order-delivery-prisma.ts`
- `lib/modules/pedidos/adapters/driving/order-actions.ts`
- `lib/modules/pedidos/adapters/driving/order-expiry-cron-route.ts`
- `lib/modules/inventario/index.ts`
- `lib/modules/inventario/domain/reservation.ts`
- `lib/modules/inventario/domain/reservation-ledger.ts`
- `lib/modules/inventario/domain/movement-ledger.ts`
- `lib/modules/inventario/domain/order-consumption.ts`
- `lib/modules/inventario/domain/finished-goods-dispatch.ts`
- `lib/modules/inventario/adapters/driven/persistence/reservation-prisma.ts`
- `lib/modules/inventario/adapters/driven/persistence/order-consumption-prisma.ts`
- `lib/modules/inventario/adapters/driven/persistence/batch-movement-prisma.ts`
- `lib/modules/inventario/adapters/driven/persistence/finished-stock-prisma.ts`
- `lib/modules/inventario/adapters/driven/persistence/deliverable-batches-prisma.ts`
- `lib/modules/inventario/adapters/driven/persistence/finished-goods-dispatch-prisma.ts`
- `lib/modules/asignaciones/domain/order-state.ts`
- `lib/modules/asignaciones/domain/compose-order-rows.ts`
- `lib/modules/asignaciones/domain/evidence-target.ts`
- `lib/modules/asignaciones/domain/count-evidence-locking-orders.ts`
- `lib/modules/asignaciones/domain/list-execution-traces.ts`
- `lib/modules/asignaciones/domain/list-company-orders.ts`
- `lib/modules/asignaciones/domain/open-assigned-order.ts`
- `lib/modules/asignaciones/domain/start-assigned-order.ts`
- `lib/modules/asignaciones/domain/finish-assigned-order.ts`
- `lib/modules/asignaciones/domain/start-packing.ts`
- `lib/modules/asignaciones/domain/finish-packing.ts`
- `lib/modules/asignaciones/domain/start-conditioning.ts`
- `lib/modules/asignaciones/domain/finish-conditioning.ts`
- `lib/modules/asignaciones/domain/record-step-move.ts`
- `lib/modules/asignaciones/domain/record-conditioning-step.ts`
- `lib/modules/asignaciones/domain/get-assigned-order-execution.ts`
- `lib/modules/asignaciones/domain/get-packing-order.ts`
- `lib/modules/asignaciones/domain/get-conditioning-order.ts`
- `lib/modules/asignaciones/adapters/driven/persistence/execution-log-prisma.ts`
- `lib/modules/asignaciones/adapters/driven/persistence/step-evidence-prisma.ts`
- `lib/modules/asignaciones/adapters/driven/persistence/conditioning-team-prisma.ts`
- `lib/modules/asignaciones/adapters/driving/order-execution-actions.ts`
- `lib/modules/asignaciones/adapters/driving/order-packing-actions.ts`
- `lib/modules/asignaciones/adapters/driving/order-conditioning-actions.ts`
- `lib/modules/asignaciones/adapters/driving/step-evidence-actions.ts`
- `lib/modules/integraciones/domain/get-whatsapp-chat-context.ts`
- `lib/modules/integraciones/domain/whatsapp-chat-context.ts`
- `lib/modules/errores/domain/error-codes.ts`
- `lib/modules/errores/domain/error-catalog.ts`
- `lib/composition/index.ts`
- `tests/unit/pedidos/order-status-derivation.test.ts`
- `tests/unit/pedidos/order-totals.test.ts`
- `tests/unit/pedidos/order-line-diff.test.ts`
- `tests/unit/pedidos/order-input-lines.test.ts`
- `tests/unit/pedidos/create-order-lines.test.ts`
- `tests/unit/pedidos/update-order-lines.test.ts`
- `tests/unit/pedidos/cancel-order-line.test.ts`
- `tests/unit/pedidos/expire-stale-order-lines.test.ts`
- `tests/unit/pedidos/order-actions-bridge.test.ts`
- `tests/unit/shared-ui/order-status.test.ts`
- `tests/unit/pedidos/module-contract.test.ts`
- `tests/unit/pedidos/order-classification.test.ts`
- `tests/unit/integraciones/whatsapp-chat-context.test.ts`
- `tests/integration/pedidos/order-status-partial-migration.int.test.ts`
- `tests/integration/pedidos/order-lines-migration.int.test.ts`
- `tests/integration/pedidos/order-lines-references-migration.int.test.ts`
- `tests/integration/pedidos/orders-drop-line-columns-migration.int.test.ts`
- `tests/integration/pedidos/order-lines-repository.int.test.ts`
- `tests/integration/pedidos/order-lines-flow.int.test.ts`
- `tests/integration/pedidos/list-query-orders.int.test.ts`
- `tests/integration/inventario/reservation.int.test.ts`
- `tests/integration/inventario/order-consumption-ledger.int.test.ts`
- `tests/integration/asignaciones/order-lines-execution.int.test.ts`
- `e2e/pedido-con-varias-recetas.spec.ts`
- `docs/architecture.md`
- `progress/impl_QT-313.md`

Los tests existentes de `tests/unit/pedidos/`, `tests/unit/asignaciones/`, `tests/unit/inventario/`,
`tests/integration/pedidos/` y `tests/integration/asignaciones/` que construyen pedidos con
`recipeId` en `orders` se ajustarán al modelo nuevo en la task que rompa cada uno; el implementer
añade su ruta aquí cuando lo toque.

Tocados en la fase 1 (T0, T1) para que el modelo nuevo no los rompa:

- `app/(private)/pedidos/components/order-row-actions.tsx`
- `app/(private)/pedidos/components/order-delivery-list.tsx`
- `lib/modules/pedidos/domain/set-order-customer.ts`
- `lib/modules/asignaciones/domain/order-state.ts`
- `lib/modules/asignaciones/domain/count-evidence-locking-orders.ts`
- `lib/modules/pedidos/domain/order-cancellation.ts`
- `scripts/seed-demo/data.ts`
- `tests/helpers/migration-script.ts`
- `tests/integration/aislamiento.json`
- `tests/guards/guard-identificador-de-request.test.ts`
- `tests/integration/pedidos/company-scope.int.test.ts`
- `tests/integration/pedidos/order-status-blocked-rollback.int.test.ts`
- `tests/integration/pedidos/order-conditioning-states-rollback.int.test.ts`
- `tests/unit/pedidos/order-transitions.test.ts`
- `tests/unit/pedidos/order-cancellation.test.ts`
- `tests/unit/pedidos/set-order-customer.test.ts`
- `tests/unit/pedidos-ui/order-status-badges.test.tsx`
- `tests/unit/pedidos-ui/order-row-actions.test.tsx`
- `tests/unit/asignaciones/list-company-orders.test.ts`
- `tests/unit/asignaciones/list-order-responsibles.test.ts`
- `tests/unit/integraciones/whatsapp/conversations/whatsapp-chat-context.test.ts`
- `tests/unit/scripts/seed-demo-run.test.ts`
