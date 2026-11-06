# QT-313 — pedido-con-varias-recetas-backend · tasks.md

> Escrito por `spec_author` (F1.2, 2026-11-03) y revisado en F1.4 (2026-11-03) con las decisiones
> P1–P13. `[P]` = paralelizable con las otras `[P]` de su misma fase. Cada task cierra con
> `pnpm run typecheck`, `pnpm run lint` y `pnpm exec vitest related --run <archivos tocados>` en
> verde, y un commit `feat(QT-313): …`. Enmendado en F2.1 (2026-11-03): T2 pasa a ser el paso 1
> de 2 de `order_line_id` y el paso 2 es T14e; T14d aplica la decisión P14 (R55). No queda ninguna
> pregunta abierta. T0 y T1 están hechas (commit 8b79a3328) y no cambian. Enmendado otra vez el
> 2026-11-04 con los andamios de transición (design § 4.1.1): T0–T8 están hechas (`06a691cab`) y
> no cambian; T9–T15 dicen qué andamio ponen o quitan. Enmendado el 2026-11-06 (F2.1, decisión
> «Reintento de reserva al editar»): añade T16b (R56) y T18 pasa a cubrir `R1…R56`.
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
- [x] **T2 — `order_line_id` nullable en las tablas hijas (paso 1 de 2).** Migración
  `20261103120100_order_lines_references` (design § 1.4, punto 2): columna **nullable** e índice
  simple en reparto, reservas, movimientos de inventario, registro de ejecución, evidencias y equipo
  de acondicionamiento; CHECK suave de `inventory_movements` (solo los cuatro tipos con pedido
  pueden llevar línea); el **relleno** de design § 1.4 (crea la línea de los pedidos que no la
  tienen y asigna la única línea a cada fila hija). Sin `NOT NULL`, FK ni cambio de únicos o PK.
  Schema de los seis modelos con `orderLineId String?`.
  *Hecho:* test de integración de la migración: conteos iguales antes y después en las seis tablas
  y cada fila de un pedido de una línea apunta a ella, `delivery_void` incluido, con la misma línea
  que su `delivery` (R8, R37); un pedido creado sin línea antes de la migración la recibe y la
  migración no aborta (R8); la base rechaza línea en un asiento `opening` o `adjustment`; `down.sql`
  revierte y se niega si hay filas de un pedido de varias líneas. El gate completo sigue verde con
  el código de hoy escribiendo sin línea. Depende de T1.

## Fase 2 — Dominio puro `[P]`

- [x] **T3 [P] — Estado derivado.** `domain/order-status-derivation.ts`: `deriveOrderStatus(lines)`
  con la regla de design § 2.2 (todas canceladas → `CANCELADO`; activas iguales → ese estado;
  distintas → `PARCIAL`).
  *Hecho:* test unitario con todos los pares de estados de línea, `TERMINADO` + `ENTREGADO` y
  `PENDIENTE` + `BLOQUEADO` (→ `PARCIAL`), canceladas mezcladas, todas canceladas, una línea
  (= su estado) (R34). Depende de T0.
- [x] **T4 [P] — Totales y resumen.** `domain/order-totals.ts`: `sumDecimal4`, precio total con
  `linesWithoutPrice`, coste estimado y real totales, `progress`.
  *Hecho:* tests unitarios de R16, R18 y R33: canceladas fuera de sumas, total y terminadas;
  `TERMINADO` y `ENTREGADO` cuentan como terminadas; 0, vacíos y sumas de más de 10 dígitos
  enteros; sin `number` en el cálculo.
- [x] **T5 [P] — Diff de líneas y reglas por línea.** `domain/order-line-diff.ts` (editar / añadir /
  quitar a partir de la entrada y las líneas vivas, R20), `domain/order-line-removal.ts`
  (quitables `PENDIENTE` y `BLOQUEADO`, R22, R23), comprobación de receta duplicada sobre la
  **original** contra la entrada y las líneas activas (R4), y la regla «línea no editable con
  cambios» (R24).
  *Hecho:* tests unitarios de R4 (dos originales iguales, original + versión, dos versiones de la
  misma original, receta de una línea cancelada que se vuelve a añadir → admitida), R20, R22,
  R23 (quitar `EN_CURSO` → rechazo; quitar `BLOQUEADO` → admitido) y R24.
- [x] **T6 [P] — Esquemas de entrada y errores.** `order-input.ts` con `lines[]` (design § 4.1),
  `cancelOrderLineSchema`, `lineId` en la edición acotada; `DuplicateOrderRecipeError` y
  `OrderLineNotRemovableError` en `domain/errors.ts` y sus códigos en el catálogo de `errores`.
  *Hecho:* tests de esquema: sin líneas → `invalid_input` (R3), línea con `id` en el alta →
  `invalid_input`, precio por línea con las reglas de QC-307 (R15), `priority`/`customerId` dentro
  de una línea se descartan (R42).

## Fase 3 — Reserva y consumo por línea (`inventario`)

- [x] **T7 — `MaterialReservations` por línea.** `inventario/domain/reservation.ts`,
  `reservation-ledger.ts`, `movement-ledger.ts`, `order-consumption.ts` y sus adaptadores
  (`reservation-prisma.ts`, `order-consumption-prisma.ts`, `batch-movement-prisma.ts`): la clave
  pasa a `(orderId, orderLineId)` con **`orderLineId: string | null`** (design § 3.1), métodos
  renombrados `…ForLine` (design § 3). Añade el lector `findOnlyLineId(orderId, scope)` en
  `pedidos/ports/order-write-repository.ts` y `order-prisma.ts` (archivos de T8), y los llamantes
  de `pedidos` pasan lo que devuelve: la única línea, o `null` en un pedido sin línea.
  *Hecho:* tests de integración de `reservation.int.test.ts` y `order-consumption-ledger` ampliados:
  dos líneas que comparten insumo aparta en orden (R12), liberar una no toca la otra (R27),
  consumir una consume solo lo suyo (R36), el libro de consumo filtra por línea (R38), los
  asientos de reserva y los `consumption` llevan su línea (R37, solo esos tipos); con `null`, un
  pedido sin línea aparta, libera y consume como hoy y no lee ni toca filas con línea; test del
  lector: una línea → su id, ninguna → `null`, otra empresa → `null`. Depende de T2.

## Fase 4 — Casos de uso de `pedidos`

- [x] **T8 — Puertos y persistencia de línea.** `ports/order-write-repository.ts`,
  `ports/order-repository.ts`, `order-prisma.ts`, `order-unit-of-work-prisma.ts`: crear, leer,
  bloquear (`FOR UPDATE`, pedido y luego líneas por `position`), actualizar, cancelar y dar de baja
  líneas; `reserved_at` por línea; escribir `orders.status` derivado; traducir la violación del
  único parcial a `duplicate_order_recipe`; `scope` último parámetro.
  *Hecho:* tests de integración: una línea de otra empresa o de otro pedido vuelve como `null` /
  `not_found` (R43); orden por `position` (R6); carrera de dos altas de la misma receta → una
  `duplicate_order_recipe` (R5). Depende de T2, T3.
- [x] **T9 — Alta con líneas.** `create-order.ts`, `order-recipe.ts`, `resolve-ingredients-cost.ts`,
  `order-requirement.ts`, y el puente de alta en `order-actions.ts` (design § 4.1.1): el caso de
  uso valida con `createOrderWithLinesSchema` y el puente traduce el formulario plano. Validar por
  línea con la posición en el diagnóstico (R11), receta original de cada línea (R4), costear cada
  una (R17), una transacción (R10), apartar en orden (R12), bloqueo por línea con las posiciones en
  el diagnóstico (R13, R14), `reserved_at` por línea (R41), estado derivado (R34), espejo en
  `orders` de la línea de menor `position` (design § 4.1.1, punto 3).
  *Hecho:* tests unitarios con dobles y uno de integración: alta de 2 líneas, alta con una línea
  que no alcanza con y sin confirmación, fallo de la segunda línea no deja nada escrito, original
  + versión → `duplicate_order_recipe`, sin permiso → `unauthorized` sin tocar puertos (R30); la
  respuesta de R11 y R13 tiene los mismos campos que hoy y la posición sale en el diagnóstico;
  `orders.recipe_id`/`quantity`/`unit_id`/`sale_price`/costes/`reserved_at` iguales a los de la
  línea de menor `position`; la pantalla y sus tests sin cambios. Depende de T5, T6, T7, T8.
- [x] **T10 — Edición con líneas.** `update-order.ts`, `order-edit-change.ts`,
  `update-order-presentation-lines.ts`, `quote-order-cost.ts`, `order-presentation-availability.ts`:
  diff (R20), añadir con otras en producción (R21), quitar `PENDIENTE` o `BLOQUEADO` y liberar
  (R22), rechazar quitar en otro estado (R23), edición de línea no editable (R24), solo las
  cambiadas recalculan coste, apartado y plazo (R17, R25, R41), edición acotada por línea (R26).
  Los casos de uso usan `updateOrderWithLinesSchema` y `updateOrderLineDistributionSchema`; el
  puente de edición en `order-actions.ts` traduce (design § 4.1.1). `updateAlive` deja de
  reemplazar el reparto por `order_id` y el espejo de `orders` se reescribe en cada edición. La
  cotización en edición pasa `excludeOrderLineId` a `findCostingBatches` de producto y de envase
  (`inventario/domain/product-catalog.ts`, `packaging-catalog.ts`, `product-catalog-prisma.ts`).
  *Hecho:* un test por requisito; el coste, lo apartado y `reserved_at` de las líneas no tocadas
  son idénticos antes y después; re-añadir la receta de una línea cancelada funciona (R4); test de
  integración de `findCostingBatches` con `excludeOrderLineId`: lo apartado por esa línea cuenta
  como disponible y lo de otra línea del mismo pedido no; el reparto de una línea no toca el de
  otra; la pantalla y sus tests sin cambios. Depende de T9.
- [x] **T11 — Cancelar línea, cancelar pedido, baja.** `cancel-order.ts`, `order-cancellation.ts`
  (+ `cancelOrderLine` nuevo, `domain/cancel-order-line.ts`), `delete-order.ts`. Cancelar y dar de
  baja pasan a escribir por línea y derivar el pedido: se **quita la copia** de estado pedido →
  línea de `cancelAlive` y `softDeleteAlive` (design § 4.1.1, punto 2).
  *Hecho:* ninguna copia de estado pedido → línea queda en esos dos métodos (test que lo fija); tests de R27, R28, R29, R30 y R47: cancelar una libera solo lo suyo, no mueve las otras
  y deja el pedido `PARCIAL` o en el estado común; cancelar el pedido con una línea `POR_EMPACAR`
  la deja intacta; ninguna cancelable → `not_cancellable`; todas canceladas → pedido `CANCELADO`
  con motivo; baja con una línea consumida → rechazo. Depende de T8.
- [x] **T12 — Entrega, anulación, bloqueados y caducidad.** `deliver-order.ts`, `void-delivery.ts`,
  `order-pending-delivery.ts`, `review-blocked-orders.ts`, `expire-stale-orders.ts`,
  `order-expiry.ts`, `order-expiry-cron-route.ts`, y las escrituras de los asientos `delivery` y
  `delivery_void` en `lib/modules/inventario/adapters/driven/persistence/product-prisma.ts`
  (~línea 1587 y ~1667) con `orderLineId: string | null` (design § 3.1). Entrega, anulación,
  desbloqueo y caducidad pasan a escribir el estado por línea y derivar el pedido: se **quita la
  copia** de estado pedido → línea de esas operaciones (design § 4.1.1, punto 2).
  *Hecho:* ninguna copia de estado pedido → línea queda en esas operaciones; tests de R39 (entregar completa solo la línea cuyo reparto se completa; anular la
  devuelve), R37 para `delivery` y `delivery_void` (la entrega escribe la línea de su línea del
  reparto; la anulación, la del `delivery` que anula; un pedido sin línea escribe `null` en los
  dos), R40 (dos
  líneas bloqueadas, entra material para una; la que pasa a `PENDIENTE`
  estrena plazo) y R51 (dos líneas `PENDIENTE` con plazos distintos: el proceso cancela solo la
  vencida y libera solo su material; el pedido queda `PENDIENTE`, porque por R34 la línea
  cancelada no cuenta y la única activa sigue `PENDIENTE`). Depende de T8, T7.
- [x] **T13 — Lecturas.** `get-order.ts`, `list-orders.ts`, `order-view.ts`, `order-queryable.ts`,
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

- [x] **T14a [P] — `asignaciones` por línea.** `pedidos/domain/order-catalog.ts`,
  `transition-order.ts`, `order-packing.ts`, `order-conditioning.ts`; en `asignaciones`: los casos
  de uso de abrir, finalizar, empaque y acondicionamiento, `compose-order-rows.ts`,
  `evidence-target.ts`, `count-evidence-locking-orders.ts`, `list-execution-traces.ts`,
  `list-company-orders.ts`, y los adaptadores `execution-log-prisma.ts`, `step-evidence-prisma.ts`,
  `conditioning-team-prisma.ts` y sus Server Actions (pasan la única línea del pedido; las
  pantallas por línea son de QT-315, design § 5); y la escritura del asiento `production` en
  `lib/modules/inventario/adapters/driven/persistence/product-prisma.ts` (~línea 1418), que
  recibe la línea de la línea del reparto. Abrir, finalizar, empaque y acondicionamiento pasan a
  escribir el estado por línea y derivar el pedido: se **quita la última copia** de estado pedido
  → línea (`setStatus`, `finishPackingAlive` y los de acondicionamiento; design § 4.1.1, punto 2).
  En el mismo cambio, `refreshStatus` y `mirrorFirstLine` amplían el espejo de `orders` con
  `packed_by`, `conditioned_by`, `finished_at` y `actual_cost` según la tabla de design § 4.1.1,
  punto 3b.
  *Hecho:* ya no queda ninguna copia de estado pedido → línea en el adaptador (grep y test); un
  test de integración por CHECK de `orders`, recorriendo el pedido por la vía nueva hasta el estado
  que lo dispara: `orders_packed_by_matches_status` (`EN_EMPAQUE`, y `PARCIAL` con una línea en
  empaque → NULL), `orders_conditioned_by_matches_status` (`EN_ACONDICIONAMIENTO`),
  `orders_finished_requires_finished_at` (`TERMINADO`, con dos líneas: el mayor `finished_at`),
  `orders_finished_at_requires_delivered` (`PARCIAL` con una línea `TERMINADO` → NULL) y
  `orders_actual_cost_requires_packed` (`POR_ACONDICIONAR`: suma de R18; `PARCIAL` → NULL);
  `OrderView.actualCost` de un pedido de una línea igual que hoy (R44, R45);
  tests de R31, R32, R35, R36, R38; R37 para `production`, registro de ejecución,
  evidencias y equipo de acondicionamiento (cada uno lleva la línea del reparto o de la línea que se
  opera); R19: ninguna salida de `asignaciones` lleva precio; R45: con una línea, las salidas son
  iguales a las de hoy más `lineId`. Depende de T8, T7.
- [x] **T14b [P] — Otros lectores.** `inventario/.../finished-stock-prisma.ts`,
  `deliverable-batches-prisma.ts`, `finished-goods-dispatch.ts`; `pedidos/.../direct-delivery-prisma.ts`,
  `packed-lines-directory-prisma.ts`, `customer-order-directory-prisma.ts`,
  `list-direct-delivery-surplus.ts`; `integraciones/domain/get-whatsapp-chat-context.ts`.
  *Hecho:* tests de integración de cada lector con un pedido de una línea dan lo mismo que hoy
  (R45) y ninguno lee las columnas de `orders` que se van. Depende de T8.
- [x] **T14c [P] — Puente del formulario actual.** `pedidos/adapters/driving/order-actions.ts`
  (design § 4.1.1 y § 7). Los esquemas planos y los de líneas (con su nombre provisional) se
  quedan como están: renombrarlos y borrar los planos es de QT-314.
  *Hecho:* test de la acción: el `FormData` de hoy crea un pedido de una línea y la lectura del
  formulario devuelve los campos planos de hoy (R44); editar un pedido de dos líneas desde el
  puente → `invalid_input` sin escribir. Además, `PARCIAL` como estado final en
  `app/(private)/pedidos/components/order-row-actions.tsx` y `order-delivery-list.tsx` (design § 7;
  los mapas ya los dejó backend_dev en T0/T1: aquí se comprueba que su test,
  `tests/unit/pedidos-ui/order-row-actions.test.tsx`, cubre R54 con su nombre).
  *Hecho (además):* test de R54: con un pedido `PARCIAL`, editar, cancelar y eliminar
  deshabilitados, sin reparto, entrega ni entregas; «Responsables» y cliente disponibles.
  Depende de T9, T10, T13.
- [x] **T14d — Responsables en un `PARCIAL` (R55).** `asignaciones/domain/order-state.ts`,
  `pedidos/domain/order-catalog.ts` (`OrderAssignmentTarget` con los estados de sus líneas
  activas) y `order-catalog-prisma.ts` (design § 12): sustituye la provisional que admitía
  cualquier `PARCIAL`.
  *Hecho:* tests de asignar, desasignar y quitar grupo: un `PARCIAL` con una línea `PENDIENTE`,
  `EN_CURSO` o `BLOQUEADO` lo admite; uno con todas sus líneas activas en `POR_EMPACAR`…`TERMINADO`
  lo rechaza con `OrderProducedFrozenError` sin escribir; una línea cancelada no cuenta.
  Depende de T14a.

## Fase 6 — Contrato y cierre

- [x] **T14e — `order_line_id` obligatorio (paso 2 de 2).** Migración
  `20261103120150_order_lines_references_required` (design § 1.4, punto 3): repite el relleno,
  bloque `DO` que aborta si queda una fila sin línea donde debe tenerla, `NOT NULL` en cinco
  tablas, CHECK definitivo de `inventory_movements` (los cuatro tipos con pedido llevan línea,
  `delivery_void` incluido), FK compuestas `(order_line_id, order_id)`, únicos y PK por línea.
  `db/schema.prisma` pasa `orderLineId` a obligatorio donde corresponde. Quita el `null` del
  contrato de `inventario` (`orderLineId: string` en `MaterialReservations`,
  `OrderConsumptionLedger` y las escrituras de `product-prisma.ts`), borra la rama `IS NULL` de sus
  adaptadores y el uso transitorio de `findOnlyLineId` (design § 3.1).
  *Hecho:* test de integración de la migración: un pedido creado sin línea antes de aplicarla la
  recibe; un pedido con línea y filas sin ella las une a su línea; una fila sin línea de un pedido
  de dos líneas la hace abortar nombrando tabla y cuántas; después, la base rechaza filas sin línea,
  un `delivery` sin línea y una línea de otro pedido (R37); `down.sql` revierte y se niega si los
  únicos por pedido chocarían; `typecheck` verde con `orderLineId: string` y ningún `IS NULL` /
  `orderLineId: null` en los adaptadores de reserva, consumo y `product-prisma.ts`. Depende de T14a, T14b,
  T14c (todo el código escribe la línea).
- [x] **T15 — Quitar las columnas de `orders`.** Migración `20261103120200_orders_drop_line_columns`
  y `db/schema.prisma` (design § 1.2), `reserved_at` incluido. `down.sql` aborta si hay pedidos con
  más de una línea viva. En el mismo commit borra el **espejo** de `orders` (design § 4.1.1, puntos
  3 y 3b) de los casos de uso de alta y edición, de `refreshStatus`, de `mirrorFirstLine` y del
  adaptador, y con las columnas caen sus CHECK (`orders_packed_by_matches_status`,
  `orders_conditioned_by_matches_status`, `orders_finished_requires_finished_at`,
  `orders_finished_at_requires_delivered`, `orders_actual_cost_requires_packed` y los demás de
  esas columnas); `down.sql` los restaura.
  *Hecho:* ningún escritor de las columnas borradas queda (grep y `typecheck`); `OrderView.actualCost`
  sale de la suma de las líneas, no de `orders`; test de
  integración de la migración: sube y baja con pedidos de una línea dejando los
  valores como antes; con un pedido de dos líneas, la bajada falla, nombra cuántos y no cambia
  nada (R9); grep sin lecturas de `recipeId`/`quantity`/`salePrice`/`reservedAt` de `orders`
  fuera de la línea (R1). Depende de T14e (su relleno lee las columnas que esta task borra).
- [ ] **T16 — Recorridos.** `e2e/pedido-con-varias-recetas.spec.ts` (pedido de una línea por la
  pantalla actual: alta, abrir y finalizar como operador; apartado, consumo y lote de producto
  terminado iguales a hoy) y `tests/integration/pedidos/order-lines-flow.int.test.ts` (dos líneas
  con insumo compartido: alta, cancelar una, finalizar la otra, lote a lote). El E2E de dos recetas
  por pantalla es de QT-315.
  *Hecho:* los dos en verde (R46). Depende de T15.
- [ ] **T16b — Reintento de reserva de las líneas `BLOQUEADO` al editar (R56, R25, R44).**
  `lib/modules/pedidos/domain/update-order.ts` según design § 4.2.1: `retry` en `planEdit` (línea
  existente, sin cambios, guardada en `BLOQUEADO`); el atajo de «solo cambia el cliente» no se
  toma si hay alguna `retry`; coste precalculado y `prepareLine` para `changed || retry`; dentro
  de la misma transacción y del mismo `lockAliveLines`, las `retry` entran en `toSync` por
  `position` (antes que las nuevas) y **no** en `edited` de `writeLines`; `refreshStatus` al final.
  Tests:
  - unitario en `tests/unit/pedidos/update-order-lines.test.ts`, con `R56` en el nombre: (a) pedido
    de una línea `BLOQUEADO` sin cambios con material → `PENDIENTE`, `syncForLine` llamado,
    `reserved_at` = instante; (b) sin material y sin `confirmBlocked` → `order_would_block` y nada
    escrito; con `confirmBlocked` → sigue `BLOQUEADO`, `reserved_at` NULL; (c) pedido de dos
    líneas, una `PENDIENTE` sin cambios y una `BLOQUEADO` sin cambios: solo la segunda llama a
    `syncForLine`; la `PENDIENTE` no cambia ni de material ni de `reserved_at` (R25); (d) solo
    cambia el cliente con una línea `BLOQUEADO`: va por el camino completo y reintenta.
  - integración contra la base en `tests/integration/pedidos/order-lines-blocked-retry.int.test.ts`,
    con `R56` en el nombre: pedido de dos líneas (una `PENDIENTE`, otra `BLOQUEADO`) que comparten
    insumo; **con material repuesto**, guardar la edición sin cambios deja la bloqueada en
    `PENDIENTE` con su apartado lote a lote y el pedido derivado (R34), sin tocar los asientos de
    la otra línea; **sin reponer**, con confirmación sigue `BLOQUEADO`, sin asientos de reserva y
    `reserved_at` NULL, y sin confirmación no escribe nada.
  - `e2e/reserva-de-material.spec.ts` vuelve a verde **sin cambiar su aserción** (paso 5:
    reeditar B sin tocar nada → `PENDIENTE`).
  *Hecho:* los tres en verde con `pnpm run typecheck`, `pnpm run lint` y
  `pnpm exec vitest related --run` sobre lo tocado; commit `feat(QT-313): …`. Depende de T15.
- [x] **T17 [P] — Documentación del perfil.** `docs/architecture.md`, «Preguntas abiertas del
  dominio», punto 4: el precio de venta y el coste pasan a ser **de cada receta del pedido** y el
  pedido muestra la suma (enmienda de QC-307, decisión «¿Dónde va el precio de venta?»); y punto 2:
  la reserva elige lote **por receta del pedido**, con su propio plazo de caducidad.
  *Hecho:* el texto ya no dice «del pedido entero». Depende de T15.
- [ ] **T18 — Trazabilidad.** `progress/impl_QT-313.md` con el mapa `R1…R56 → test`.
  *Hecho:* cada `R<n>`, R56 incluido, tiene al menos un test con `R<n>` en el nombre. Depende de
  T16 y T16b.

## Archivos esperados

- `db/schema.prisma`
- `db/migrations/20261103115900_order_status_partial/migration.sql`
- `db/migrations/20261103115900_order_status_partial/down.sql`
- `db/migrations/20261103120000_order_lines/migration.sql`
- `db/migrations/20261103120000_order_lines/down.sql`
- `db/migrations/20261103120100_order_lines_references/migration.sql`
- `db/migrations/20261103120100_order_lines_references/down.sql`
- `db/migrations/20261103120150_order_lines_references_required/migration.sql`
- `db/migrations/20261103120150_order_lines_references_required/down.sql`
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
- `lib/modules/inventario/domain/product-catalog.ts`
- `lib/modules/inventario/domain/packaging-catalog.ts`
- `lib/modules/inventario/adapters/driven/persistence/product-catalog-prisma.ts`
- `tests/integration/inventario/costing-batches-exclude-line.int.test.ts`
- `lib/modules/inventario/domain/reservation-ledger.ts`
- `lib/modules/inventario/domain/movement-ledger.ts`
- `lib/modules/inventario/domain/order-consumption.ts`
- `lib/modules/inventario/domain/finished-goods-dispatch.ts`
- `lib/modules/inventario/adapters/driven/persistence/reservation-prisma.ts`
- `lib/modules/inventario/adapters/driven/persistence/order-consumption-prisma.ts`
- `lib/modules/inventario/adapters/driven/persistence/batch-movement-prisma.ts`
- `lib/modules/inventario/adapters/driven/persistence/product-prisma.ts`
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
- `tests/integration/pedidos/order-lines-references-required-migration.int.test.ts`
- `tests/integration/pedidos/order-lines-flow.int.test.ts`
- `tests/integration/pedidos/order-lines-blocked-retry.int.test.ts`
- `tests/integration/pedidos/list-query-orders.int.test.ts`
- `tests/integration/pedidos/void-delivery-order-line.int.test.ts`
- `tests/unit/asignaciones/order-state.test.ts`
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

Tocados en la fase 3 (T7) por el cambio de `MaterialReservations` y `findOnlyLineId`:

- `lib/modules/inventario/domain/inventory-movement.ts`
- `tests/helpers/order-unit-of-work-double.ts`
- `tests/integration/inventario/qc195-packaging-catalog.int.test.ts`
- `tests/integration/inventario/qc195-packaging-list.int.test.ts`
- `tests/integration/inventario/settle-packaging.int.test.ts`
- `tests/integration/pedidos/order-unit-conversion.int.test.ts`
- `tests/integration/pedidos/order-unit-of-work.int.test.ts`
- `tests/unit/inventario/product-last-batch-at.test.ts`
- `tests/unit/inventario/qc121-alcance.test.ts`
- `tests/unit/pedidos/cancel-order.test.ts`
- `tests/unit/pedidos/company-isolation-service.test.ts`
- `tests/unit/pedidos/create-order.test.ts`
- `tests/unit/pedidos/delete-order.test.ts`
- `tests/unit/pedidos/expire-stale-orders.test.ts`
- `tests/unit/pedidos/order-customer-write.test.ts`
- `tests/unit/pedidos/order-packing.test.ts`
- `tests/unit/pedidos/order-service.test.ts`
- `tests/unit/pedidos/review-blocked-orders.test.ts`
- `tests/unit/pedidos/transition-order.test.ts`
- `tests/unit/pedidos/update-order-presentation-lines.test.ts`
- `tests/unit/pedidos/update-order.test.ts`

Tocados en la fase 4 (T8) por el lector `findAliveLines` de `OrderRepository` y los metodos de linea de `OrderWriteRepository`:

- `tests/unit/pedidos/order-view.test.ts`
- `tests/integration/pedidos/finish-with-finished-goods.int.test.ts`
- `tests/integration/pedidos/order-content-copy.int.test.ts`
- `tests/integration/pedidos/order-cost-quote.int.test.ts`
- `tests/integration/pedidos/order-customer.int.test.ts`
- `tests/integration/pedidos/order-delivery-concurrency.int.test.ts`
- `tests/integration/pedidos/order-delivery-void-concurrency.int.test.ts`
- `tests/integration/pedidos/order-delivery-void.int.test.ts`
- `tests/integration/pedidos/order-ingredients-cost.int.test.ts`
- `tests/integration/pedidos/order-reservation-concurrency.int.test.ts`
- `tests/integration/pedidos/order-reservation-tools.int.test.ts`
- `tests/integration/pedidos/order-reservation.int.test.ts`
- `tests/integration/pedidos/order-unit-conversion.int.test.ts`
- `tests/integration/pedidos/qc170-distribution-company-scope.int.test.ts`
- `tests/integration/pedidos/qc170-distribution-concurrency.int.test.ts`
- `tests/integration/pedidos/qc195-packaging-reservation.int.test.ts`
- `tests/integration/pedidos/review-blocked-orders.int.test.ts`

Tocados en la fase 4 (T9, T10) por el alta y la edicion con lineas, el puente del formulario, `excludeOrderLineId` y los andamios de transicion:

- `lib/modules/pedidos/domain/list-order-line-ids.ts`
- `lib/modules/inventario/domain/costing-batch.ts`
- `lib/modules/inventario/adapters/driven/persistence/packaging-catalog-prisma.ts`
- `tests/helpers/single-recipe-order.ts`
- `tests/unit/pedidos/authorization.test.ts`
- `tests/unit/pedidos/company-scope.test.ts`
- `tests/unit/pedidos/order-actions.test.ts`
- `tests/unit/pedidos/order-actions-customer.test.ts`
- `tests/unit/pedidos/order-actions-distribution.test.ts`
- `tests/unit/pedidos/order-catalog.test.ts`
- `tests/unit/pedidos/order-customer-authorization.test.ts`
- `tests/unit/pedidos/order-edit-change.test.ts`
- `tests/unit/pedidos/qc145-estado-solo-planta.test.ts`
- `tests/unit/pedidos/qc195-contrato-tipos.test.ts`
- `tests/unit/pedidos/quote-order-cost.test.ts`
- `tests/integration/pedidos/order-lines-use-cases.int.test.ts`
- `tests/integration/documentos/formula-import.int.test.ts`
- `tests/integration/pedidos/actual-order-cost.int.test.ts`
- `tests/integration/pedidos/company-scope-queries.int.test.ts`
- `tests/integration/pedidos/order-crud.int.test.ts`
- `tests/integration/pedidos/order-expiry.int.test.ts`
- `tests/integration/pedidos/order-finished-at.int.test.ts`
- `tests/integration/pedidos/order-repository.int.test.ts`
- `tests/integration/pedidos/order-sale-price.int.test.ts`
- `scripts/seed-demo/gateway.ts`
- `tests/integration/asignaciones/execution-atomicity.int.test.ts`
- `tests/integration/scripts/seed-demo.int.test.ts`
- `tests/unit/inventario/adjust-batch-stock-prisma.test.ts`
- `tests/unit/inventario/finished-goods-dispatch-prisma.test.ts`
- `tests/unit/inventario/finished-goods-return-prisma.test.ts`

Tocados en la fase 4 (T11, T12) por cancelar, dar de baja, entregar, anular, caducar y desbloquear por linea, y por los rojos de T0/T1:

- `lib/modules/inventario/domain/finished-goods-return.ts`
- `lib/modules/pedidos/adapters/driven/persistence/order-delivery-void-prisma.ts`
- `lib/modules/pedidos/domain/order-delivery-target.ts`
- `lib/modules/pedidos/domain/void-direct-delivery.ts`
- `lib/modules/pedidos/ports/order-delivery-unit-of-work.ts`
- `lib/modules/pedidos/ports/order-delivery-void-repository.ts`
- `lib/modules/pedidos/ports/order-delivery-void-unit-of-work.ts`
- `tests/guards/guard-ambito-empresa-pedidos.test.ts`
- `tests/helpers/order-delivery-seed.ts`
- `tests/integration/inventario/finished-goods-dispatch.int.test.ts`
- `tests/integration/inventario/finished-goods-return.int.test.ts`
- `tests/integration/inventario/ledger-cuadre.int.test.ts`
- `tests/integration/pedidos/order-lines-delivery.int.test.ts`
- `tests/integration/pedidos/order-lines-state.int.test.ts`
- `tests/integration/unidades/unidades-constraints.int.test.ts`
- `tests/unit/pedidos/deliver-order.test.ts`
- `tests/unit/pedidos/delivery-by-line.test.ts`
- `tests/unit/pedidos/get-direct-delivery-for-void.test.ts`
- `tests/unit/pedidos/get-order-delivery.test.ts`
- `tests/unit/pedidos/list-order-deliveries.test.ts`
- `tests/unit/pedidos/schema/order-conditioning-states-migration.test.ts`
- `tests/unit/pedidos/schema/order-status-blocked-migration.test.ts`
- `tests/unit/pedidos/schema/pedidos-schema.test.ts`
- `tests/unit/pedidos/void-delivery.test.ts`
- `tests/unit/pedidos/void-direct-delivery.test.ts`

Tocados en la fase 4 (T13) por las lecturas con lineas (los fixtures de la pantalla ganan los campos nuevos de `OrderView` vacios; el puerto de lectura gana `findAliveLinesByOrderIds`):

- `tests/helpers/order-view-lines.ts`
- `tests/unit/paridad/campos-paridad.test.tsx`
- `tests/unit/paridad/confirmaciones-paridad.test.tsx`
- `tests/unit/paridad/formularios-paridad.test.tsx`
- `tests/unit/paridad/pedidos-paridad.test.tsx`
- `tests/unit/pedidos/get-order.test.ts`
- `tests/unit/pedidos/list-orders.test.ts`
- `tests/unit/pedidos/list-orders-customer.test.ts`
- `tests/unit/pedidos/order-customer-filter-where.test.ts`
- `tests/unit/pedidos/order-view-lines.test.ts`
- `tests/unit/pedidos-ui/cancel-order-dialog.test.tsx`
- `tests/unit/pedidos-ui/delete-order-dialog.test.tsx`
- `tests/unit/pedidos-ui/order-cards.test.tsx`
- `tests/unit/pedidos-ui/order-columns.test.tsx`
- `tests/unit/pedidos-ui/order-customer-dialog.test.tsx`
- `tests/unit/pedidos-ui/order-delivery-sheet.test.tsx`
- `tests/unit/pedidos-ui/order-distribution-dialog.test.tsx`
- `tests/unit/pedidos-ui/order-form.test.tsx`
- `tests/unit/pedidos-ui/order-form-customer.test.tsx`
- `tests/unit/pedidos-ui/order-form-leftover.test.tsx`
- `tests/unit/pedidos-ui/order-form-quote.test.tsx`
- `tests/unit/pedidos-ui/order-form-sale-price.test.tsx`
- `tests/unit/pedidos-ui/order-list-section.test.tsx`
- `tests/unit/pedidos-ui/order-list-section-produced.test.tsx`
- `tests/unit/pedidos-ui/order-row-wiring.test.tsx`
- `tests/unit/pedidos-ui/order-sheet.test.tsx`
- `tests/unit/pedidos-ui/order-sheet-coverage.test.tsx`
- `tests/unit/pedidos-ui/order-sheet-responsibles.test.tsx`
- `tests/unit/pedidos-ui/order-table.test.tsx`
- `tests/unit/pedidos-ui/pedidos-page-header.test.tsx`
- `tests/unit/pedidos-ui/pedidos-toasts.test.tsx`
- `tests/unit/pedidos-ui/pedidos-viewport.test.tsx`
- `tests/unit/pedidos-ui/read-only.test.tsx`
- `tests/unit/shared-ui/confirm-dialog-montado.test.tsx`

Tocados en la fase 5 (T14b) por los otros lectores, que leen la receta de la linea del pedido (los demas archivos de T14b ya estan arriba):
- `lib/modules/pedidos/domain/customer-order-directory.ts`
- `lib/modules/pedidos/ports/direct-delivery-repository.ts`
- `tests/integration/integraciones/whatsapp-chat-context-flow.int.test.ts`
- `tests/integration/inventario/finished-stock.int.test.ts`
- `tests/integration/pedidos/customer-order-directory.int.test.ts`
- `tests/integration/pedidos/direct-delivery-repository.int.test.ts`
- `tests/integration/pedidos/direct-delivery.int.test.ts`
- `tests/integration/pedidos/order-delivery.int.test.ts`
- `tests/integration/pedidos/packed-lines-directory.int.test.ts`
- `tests/unit/integraciones/whatsapp/conversations/get-whatsapp-chat-context.test.ts`

Tocados en la fase 5 (T14a) por el flujo de planta por linea (los demas archivos de T14a ya estan arriba):
- `lib/modules/asignaciones/domain/cancel-assigned-order.ts`
- `lib/modules/asignaciones/domain/conditioning-order-view.ts`
- `lib/modules/asignaciones/domain/conditioning-team.ts`
- `lib/modules/asignaciones/domain/execution-entry.ts`
- `lib/modules/asignaciones/domain/list-assigned-orders.ts`
- `lib/modules/asignaciones/domain/list-conditioned-orders.ts`
- `lib/modules/asignaciones/domain/list-finished-orders.ts`
- `lib/modules/asignaciones/domain/only-order-line.ts`
- `lib/modules/asignaciones/domain/packing-order-view.ts`
- `lib/modules/asignaciones/domain/register-evidence.ts`
- `lib/modules/asignaciones/domain/save-conditioning-batch-data.ts`
- `lib/modules/asignaciones/ports/conditioning-team-repository.ts`
- `lib/modules/asignaciones/ports/step-evidence-repository.ts`
- `lib/modules/inventario/adapters/driven/persistence/finished-goods-prisma.ts`
- `lib/modules/inventario/domain/finished-goods.ts`
- `lib/modules/pedidos/ports/order-conditioning-repository.ts`
- `lib/modules/pedidos/ports/order-packing-repository.ts`
- `tests/helpers/only-order-line.ts`
- `tests/integration/asignaciones/batch-states.int.test.ts`
- `tests/integration/asignaciones/company-orders.int.test.ts`
- `tests/integration/asignaciones/conditioning-execution-log.int.test.ts`
- `tests/integration/asignaciones/conditioning-steps-progress.int.test.ts`
- `tests/integration/asignaciones/conditioning-team-repository.int.test.ts`
- `tests/integration/asignaciones/execution-log-read.int.test.ts`
- `tests/integration/asignaciones/finish-conditioning-batch-data.int.test.ts`
- `tests/integration/asignaciones/finished-orders.int.test.ts`
- `tests/integration/asignaciones/list-order-responsibles.int.test.ts`
- `tests/integration/asignaciones/responsible-eligibility.int.test.ts`
- `tests/integration/asignaciones/start-conditioning-team.int.test.ts`
- `tests/integration/asignaciones/step-evidence-repository.int.test.ts`
- `tests/integration/asignaciones/use-case-fixture.ts`
- `tests/integration/inventario/deliverable-batches.int.test.ts`
- `tests/integration/inventario/finished-batch-labels.int.test.ts`
- `tests/integration/inventario/finished-goods.int.test.ts`
- `tests/integration/inventario/finished-goods-receipts.int.test.ts`
- `tests/integration/inventario/finished-goods-version.int.test.ts`
- `tests/integration/inventario/order-batches.int.test.ts`
- `tests/integration/inventario/product-type-lock.int.test.ts`
- `tests/integration/pedidos/direct-delivery-concurrency.int.test.ts`
- `tests/integration/pedidos/order-catalog-company-summary.int.test.ts`
- `tests/integration/pedidos/order-catalog-conditioned-by.int.test.ts`
- `tests/integration/pedidos/order-catalog-including-deleted.int.test.ts`
- `tests/integration/pedidos/order-conditioning.int.test.ts`
- `tests/integration/pedidos/order-packing.int.test.ts`
- `tests/unit/asignaciones/acondicionamiento-authorization.test.ts`
- `tests/unit/asignaciones/authorization.test.ts`
- `tests/unit/asignaciones/cancel-assigned-order.test.ts`
- `tests/unit/asignaciones/conditioning-doubles.ts`
- `tests/unit/asignaciones/execution-log-prisma.test.ts`
- `tests/unit/asignaciones/execution-log-repository.test.ts`
- `tests/unit/asignaciones/finish-assigned-order.test.ts`
- `tests/unit/asignaciones/finish-conditioning.test.ts`
- `tests/unit/asignaciones/finish-packing.test.ts`
- `tests/unit/asignaciones/get-assigned-order-execution.test.ts`
- `tests/unit/asignaciones/list-assigned-orders.test.ts`
- `tests/unit/asignaciones/list-finished-orders.test.ts`
- `tests/unit/asignaciones/list-packing-orders.test.ts`
- `tests/unit/asignaciones/record-conditioning-step.test.ts`
- `tests/unit/asignaciones/start-assigned-order.test.ts`
- `tests/unit/asignaciones/start-conditioning.test.ts`
- `tests/unit/asignaciones/start-packing.test.ts`
- `tests/unit/inventario/batch-movement-prisma.test.ts`
- `tests/unit/inventario/finished-goods-prisma.test.ts`
- `tests/unit/pedidos/order-conditioning.test.ts`
- `tests/unit/pedidos/order-lines-no-copy.test.ts`
- `tests/unit/asignaciones/assign-responsibles.test.ts`
- `tests/unit/asignaciones/remove-work-group-from-order.test.ts`
- `tests/unit/asignaciones/unassign-responsible.test.ts`
- `e2e/acondicionamiento.spec.ts`
- `e2e/anular-entrega.spec.ts`
- `e2e/consulta-de-evidencia.spec.ts`
- `e2e/contactos-chat.spec.ts`
- `e2e/dashboard-rediseno.spec.ts`
- `e2e/datos-de-lote-en-acondicionamiento.spec.ts`
- `e2e/detalle-de-producto-terminado.spec.ts`
- `e2e/ejecucion-receta.spec.ts`
- `e2e/empaque.spec.ts`
- `e2e/entrega-a-varios-clientes.spec.ts`
- `e2e/entrega-sin-pedido.spec.ts`
- `e2e/entregar-producto-terminado.spec.ts`
- `e2e/envases-reales-empaque.spec.ts`
- `e2e/operario-rediseno.spec.ts`
- `e2e/pasos-de-acondicionamiento.spec.ts`
- `e2e/pasos-de-envasado.spec.ts`
- `e2e/pedidos-rediseno.spec.ts`
- `e2e/recorrido-acondicionamiento.spec.ts`
- `e2e/recorrido-ejecucion.spec.ts`
- `e2e/registro-ejecucion.spec.ts`
- `tests/integration/asignaciones/conditioning-team-constraints.int.test.ts`
- `tests/integration/asignaciones/order-execution-entries-constraints.int.test.ts`
- `tests/integration/asignaciones/step-evidence-constraints.int.test.ts`
- `tests/integration/inventario/finished-product-detail.int.test.ts`
- `tests/integration/inventario/presentation-content.int.test.ts`
- `tests/integration/inventario/product-unit-without-presentation.int.test.ts`
- `tests/integration/inventario/qc195-packaging-constraints.int.test.ts`
- `tests/integration/inventario/reserve-existing-orders-migration.int.test.ts`
- `tests/integration/pedidos/direct-deliveries-migration.int.test.ts`
- `tests/integration/pedidos/direct-delivery-constraints.int.test.ts`
- `tests/integration/pedidos/order-delivery-constraints.int.test.ts`
- `tests/integration/pedidos/order-delivery-directory.int.test.ts`
- `tests/integration/pedidos/order-delivery-lines-customer-migration.int.test.ts`
- `tests/integration/pedidos/order-delivery-repository.int.test.ts`
- `tests/integration/pedidos/order-delivery-void-constraints.int.test.ts`
- `tests/integration/pedidos/order-delivery-void-repository.int.test.ts`
- `tests/integration/pedidos/order-packed-counts.int.test.ts`
- `tests/integration/pedidos/pedidos-constraints.int.test.ts`
- `tests/integration/pedidos/qc170-backfill.int.test.ts`
- `tests/integration/recetas/recipe-conditioning-steps-migration.int.test.ts`

Tocados en la fase 6 (T15) por quitar las columnas de linea de `orders` (las siembras escriben la receta en la linea y las lecturas la leen de ella):
- `e2e/acondicionar-con-equipo.spec.ts`
- `e2e/aislamiento-pedidos.spec.ts`
- `e2e/coste-real-de-produccion.spec.ts`
- `e2e/envases-del-pedido.spec.ts`
- `e2e/pedido-bloqueado.spec.ts`
- `e2e/pedido-con-cliente.spec.ts`
- `e2e/pedido-conversion-de-unidad.spec.ts`
- `e2e/pedido-en-varias-presentaciones.spec.ts`
- `e2e/pedido-precio-de-venta.spec.ts`
- `e2e/pedidos-asignados.spec.ts`
- `e2e/pedidos-busqueda.spec.ts`
- `e2e/pedidos-cotizacion.spec.ts`
- `e2e/pedidos-responsables.spec.ts`
- `e2e/pedidos-terminados.spec.ts`
- `e2e/pedidos.spec.ts`
- `e2e/producto-terminado.spec.ts`
- `e2e/recetas-porcentaje.spec.ts`
- `e2e/reserva-de-material.spec.ts`
- `e2e/versiones-de-receta.spec.ts`
- `tests/integration/asignaciones/order-assignment-prisma.int.test.ts`
- `tests/integration/asignaciones/order-assignments-constraints.int.test.ts`
- `tests/integration/identity/company.int.test.ts`
- `tests/integration/identity/work-group-assignments.int.test.ts`
- `tests/integration/pedidos/order-company-stats.int.test.ts`
- `tests/integration/pedidos/order-conditioning-constraints.int.test.ts`
- `tests/integration/pedidos/order-duplicate-number.int.test.ts`
- `tests/integration/pedidos/order-packing-constraints.int.test.ts`
- `tests/integration/pedidos/order-packing-states-rollback.int.test.ts`
- `tests/integration/pedidos/order-sequence-race.int.test.ts`
- `tests/integration/pedidos/order-sequence.int.test.ts`
- `tests/integration/pedidos/orders-customer-constraints.int.test.ts`
- `tests/unit/pedidos/orders-header-only.test.ts`
- `tests/integration/asignaciones/finish-auto-assign-packers.int.test.ts`
- `tests/integration/inventario/list-query-indexes.int.test.ts`
- `e2e/helpers/delete-orders.ts`
