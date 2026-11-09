# QT-314 — pedido-con-varias-recetas-frontend · tasks.md

> Agentes:
> - `backend_dev` hace todo lo de `lib/`: dominio, contrato, acciones de servidor y composición.
> - `frontend_dev` hace todo lo de `app/(private)/pedidos/` y `components/shared/`, más los E2E.
>
> `[P]` = puede ir en paralelo con las otras `[P]` de su tanda (no comparten archivo). Cada task
> termina con `pnpm run typecheck`, `pnpm run lint`, `pnpm exec vitest related --run <archivos>` y
> `pnpm exec vitest run guard` en verde, salvo la tanda 3, que se mira al cerrar sus cuatro tasks
> (design § 7). En los tests, `R<n>` va en el nombre del caso.

## Tanda 1 — `lib/` sin romper la pantalla de hoy (backend_dev)

- [x] **T1** `[P]` · backend_dev — `OrderLineView` gana `originalRecipeId`, `recipeVersion`,
  `recipeImageUrl` y `unitLabel`, que rellena `toOrderLineView` sin consultas nuevas (design § 3.4).
  - **Hecho:** test de `getOrder` y `listOrders` con un pedido de dos recetas (una original y una
    versión, con unidades distintas) que comprueba los cuatro campos de cada receta, y que el
    número de llamadas a los catálogos no cambia.
  - **Cubre:** R18, R30, R32, R39 (dato).
- [x] **T2** `[P]` · backend_dev — El contrato publica `isEditableOrderLineStatus`,
  `isCancellableStatus`, `isRemovableOrderLineStatus`, `isDeletableOrder`, `sumDecimal4` y
  `orderLineInputSchema` (design § 3.6). `update-order.ts` y `delete-order.ts` usan los mismos
  predicados que publican, sin copias.
  - **Hecho:** test unitario por predicado, con todos los estados de `OrderLineStatus`, y test de
    que `updateOrder` y `deleteOrder` siguen rechazando lo mismo.
  - **Cubre:** R10, R11, R13, R36, R37.
- [x] **T3** · backend_dev · depende de T2 — Posiciones de las recetas que fallan como dato
  (design § 3.3): `PedidosError.linePositions`, `atLinePosition`, `OrderWouldBlockError` del alta y
  de la edición, `InsufficientMaterialError` en una receta en curso, `assertNoDuplicateOrderRecipe`,
  y `linePositionsOf` publicado.
  - **Hecho:**
    - un test por regla de R15 con un pedido de tres recetas en el que falla la segunda, o la
      segunda y la tercera, y comprueba las posiciones exactas;
    - un test de que `linePositionsOf` de un error ajeno es `[]`;
    - `guard-catalogo-de-errores` en verde **sin tocarla**.
  - **Cubre:** R15, R16.
- [x] **T4** · backend_dev · depende de T1 — Entregas por receta (design § 3.5):
  - `getOrderDelivery` y `listOrderDeliveries` aceptan `lineId`, de momento opcional;
  - `getOrderDeliveryAction` y `listOrderDeliveriesAction` lo pasan;
  - la vista de entregas gana `lineStatus`.
  - **Hecho:**
    - unidad: receta `TERMINADO` con el pedido `PARCIAL` → solo su reparto; receta `EN_CURSO` →
      `action_not_allowed`; receta de otro pedido o de otra empresa → `order_not_found`; el
      historial filtrado a la receta, sin entregas vacías;
    - `.int` `tests/integration/pedidos/order-delivery-by-line.int.test.ts` con un pedido de dos
      recetas contra la base.
  - **Cubre:** R33, R35.
- [x] **T5** · backend_dev · depende de T4 (mismo archivo) — `cancelOrderLineAction` en
  `order-actions.ts` (design § 3.2).
  - **Hecho:** test contra dobles: éxito; `not_cancellable`; `invalid_input` por motivo vacío o de
    501 caracteres; `invalid_input` sin `id` o sin `lineId`, sin llamar al caso de uso;
    `unauthorized` sin `pedidos.modificar`.
  - **Cubre:** R29, R42.

## Tanda 2 — piezas nuevas de la pantalla, sin cablear todavía (frontend_dev)

- [x] **T6** `[P]` · frontend_dev — `RowActionsMenu` gana `groupLabel` por ítem, en `dropdown` y
  `centered`. Se actualiza su fila de `CATALOGO.md`: punto de extensión, y el tablero en `Diseño`.
  - **Hecho:** test nuevo `tests/unit/shared-ui/row-actions-menu-group.test.tsx` (el rótulo sale
    antes del ítem, no es enfocable y combina con `separatorBefore`); los tests de
    `row-actions-menu-*` de hoy, sin cambios y en verde.
  - **Cubre:** R25.
- [x] **T7** `[P]` · frontend_dev — `Notice` gana `actions`. Se actualiza su fila de `CATALOGO.md`.
  - **Hecho:** test nuevo `tests/unit/shared-ui/notice-actions.test.tsx`; `notice.test.tsx` y
    `notice-dismiss.test.tsx`, sin cambios y en verde.
  - **Cubre:** R17, R46.
- [x] **T8** `[P]` · frontend_dev — `order-progress.tsx`: «F de T», con barra y forma larga «N de M
  terminadas», y transición de ancho.
  - **Hecho:** test de las dos formas, del 0 de 0 y de un `aria-label` con el texto (la barra va
    `aria-hidden`).
  - **Cubre:** R18, R21, R46.
- [x] **T9** `[P]` · frontend_dev · depende de T1, T2 — `order-line-draft.ts` (design § 4.1):
  `draftFromOrder`, `candidateOf` (con `rowOfPosition`), `isSameRecipe`, `draftTotals`,
  `canRemove`, `isReadOnly`.
  - **Hecho:** test unitario de cada función, con canceladas, no editables, nuevas, una versión de
    la misma original y precios con 0 y vacíos.
  - **Cubre:** R7, R8, R10, R11, R12, R13.
- [x] **T10** `[P]` · frontend_dev · depende de T2 — `order-line-actions.ts`: `lineAcceptsAction`,
  `orderOffersLineAction` y sus motivos; `canEditOrder`, `canCancelOrder`, `canDeleteOrder` y
  `responsiblesFrozen` (design § 4.6).
  - **Hecho:** test con todos los estados de receta, y con pedidos `PARCIAL` que admiten y que no
    admiten cada acción.
  - **Cubre:** R9, R26, R27, R36, R37, R38.
- [x] **T11** `[P]` · frontend_dev · depende de T1, T8 — `order-detail-sheet.tsx` (design § 4.4).
  - **Hecho:** test con un pedido `PARCIAL` de tres recetas (una cancelada con motivo, una
    terminada y una sin precio): todos los campos de R18, ningún control salvo «Editar», y
    «Editar» deshabilitado en `ENTREGADO`.
  - **Cubre:** R18, R19, R9.
- [x] **T12** `[P]` · frontend_dev · depende de T5, T10 — `order-line-picker-dialog.tsx` y
  `cancel-order-line-dialog.tsx`.
  - **Hecho:**
    - selector: todas las recetas, las deshabilitadas con su motivo, opciones de 52 px, y elegir
      una emite su `lineId`;
    - diálogo: nombra la receta y el pedido, envía `id`, `lineId` y motivo, y un rechazo se queda
      en el diálogo con el motivo escrito.
  - **Cubre:** R27, R28, R44.

## Tanda 3 — el cambio de la pantalla y del contrato, en una sola tanda (backend_dev + frontend_dev)

- [x] **T13** · backend_dev · depende de la tanda 1 — Esquemas finales y fin del puente (design
  § 3.1, § 3.2):
  - renombrar los esquemas y borrar los planos;
  - `createOrderAction(input)`, `updateOrderAction(id, input)` y `OrderLinesErrorState` con
    `linePositions`;
  - `updateOrderDistributionAction` con `lineId` de la entrada;
  - `quoteOrderCostAction` sin `withOrderLine`;
  - `lineId` obligatorio en las dos lecturas de entregas;
  - borrar `singleLineIdOf`, `requireSingleLineIdOf`, `buildCreateCandidate`,
    `buildUpdateCandidate`, `readPresentationLines`, `createListOrderLineIds` y su entrada en
    `lib/composition/index.ts`;
  - reescribir a los requisitos nuevos los tests de QT-313 R44.
  - **Hecho:**
    - Grep sin resultados de `createOrderWithLinesSchema`, `updateOrderWithLinesSchema`,
      `updateOrderLineDistributionSchema`, `requireSingleLineIdOf` y `listOrderLineIds` en `lib/`,
      `app/` y `tests/`;
    - test de acción: alta y edición de tres recetas que llegan intactas al caso de uso;
    - test de `linePositions` en `order_would_block` y en un fallo de receta;
    - test de «Reparto y unidad» en un pedido de dos recetas.
  - **Cubre:** R14, R15, R31, R40, R41.
- [x] **T14** · frontend_dev · depende de T6–T9, T13 — Panel y sub-panel (design § 4.2, § 4.3):
  - `order-form.tsx` rehecho con forma B;
  - `order-lines-table.tsx` y `order-line-sheet.tsx`;
  - el aviso de error por receta con «Guardar bloqueada»;
  - `order-ingredients-table.tsx` con `orderLineInputSchema`;
  - `use-order-cost-quote.ts` con `orderLineId`.
  - **Hecho:** tests de UI con un pedido de dos recetas:
    - alta vacía (R1);
    - tabla (R2);
    - sub-panel precargado (R3);
    - aplicar con y sin error (R4);
    - descartar (R5);
    - nada se envía hasta guardar (R6);
    - candidato enviado (R7);
    - receta repetida y versión (R8);
    - solo lectura y añadir (R10);
    - quitar (R11);
    - canceladas que no suman y Guardar deshabilitado (R12);
    - precio y total (R13);
    - cotización con `orderLineId` (R14);
    - aviso con «receta N», fila marcada y «Guardar bloqueada» reenviando con `confirmBlocked`
      (R17);
    - `invalid_transition` sin posiciones: mensaje del catálogo, panel abierto, borrador intacto,
      «Guardar pedido» sin regla de «sin cambios» (R50).
    - Se reescriben `order-form*.test.tsx`.
  - **Cubre:** R1–R8, R10–R14, R17, R44, R46, R50.
- [x] **T15** · frontend_dev · depende de T6, T8, T10, T11, T12, T13 — Listado, menú y cableado
  (design § 4.5, § 4.6):
  - `order-columns.tsx`, `order-table.tsx` (tarjeta), `order-row-actions.tsx` (tres grupos y
    habilitaciones), `order-sheet.tsx` (detalle, selector y acciones de receta) y
    `order-list-section.tsx` (`canModifyOrders` para «Cancelar receta…»);
  - `isFinalOrderStatus` y los cuatro mapas por estado del pedido desaparecen;
  - reescribir a los requisitos nuevos los tests de QT-313 R54.
  - **Hecho:** tests de UI:
    - columna «Fórmula» con «+N más», y «Motivo de cancelación» presente (R20);
    - avance (R21);
    - totales y «N sin precio» (R22);
    - sin columna Presentación (R23);
    - con la primera receta distinta del pedido plano, ninguna celda pinta el dato plano (R24);
    - menú en tres grupos (R25);
    - cada acción de receta según permiso y estados (R26);
    - «Editar» en `PARCIAL` y deshabilitado en `ENTREGADO` (R9);
    - el número de pedido abre el detalle (R18).
  - **Cubre:** R9, R18, R20–R27, R39, R42, R44, R45.
- [x] **T16** · frontend_dev · depende de T4, T10, T12, T13 — Diálogos por receta y pedido entero
  (design § 4.7): `order-distribution-dialog.tsx`, `order-delivery-sheet.tsx`,
  `order-deliveries-sheet.tsx`, `order-delivery-list.tsx`, `cancel-order-dialog.tsx` y
  `order-responsibles-sheet.tsx`.
  - **Hecho:** tests de UI:
    - reparto de la receta elegida, con su `lineId` (R30);
    - entrega de una receta `TERMINADO` con el pedido `PARCIAL`, con su nombre e imagen (R32);
    - entregas de la receta y «Anular» según `lineStatus` (R34);
    - cancelar el pedido nombrando las que se cancelan y las que se quedan (R36);
    - «Eliminar» según `isDeletableOrder` (R37);
    - responsables en `PARCIAL`, con y sin receta activa admitida (R38).
  - **Cubre:** R28, R30, R32, R34, R36, R37, R38.

## Tanda 4 — limpieza, E2E y cierre

- [x] **T16b** · frontend_dev · depende de T16 · va antes de T17 — Enmienda F2.1 (design § 4.5 y
  § 4.7):
  - `order-responsibles-sheet.tsx`: la ficha de solo lectura pinta una fila por receta (nombre,
    cantidad con unidad, reparto y estado), canceladas incluidas, y deja de leer los campos planos
    de `OrderView`;
  - `order-delivery-draft.ts` y `use-order-delivery-draft.ts`: el borrador de «Entregar» por
    receta (clave, contenido y lectura con `lineId`), y `order-delivery-sheet.tsx` pasa `line.id`;
  - R44: el código de la tarjeta ya cumple la enmienda (pie con prioridad y «Acciones»); solo se
    añaden sus tests.
  - **Hecho:**
    - tests de UI de la ficha con un pedido de tres recetas cuya primera receta difiere de los
      campos planos, una de ellas cancelada: una fila por receta en orden, con cantidad, unidad,
      reparto y estado, la cancelada con su estado, y ningún dato plano pintado (R51);
    - test unitario del borrador: dos recetas del mismo pedido con borradores distintos se guardan
      y se leen cada una con lo suyo; abrir la segunda no borra la primera; el borrador de una no se
      carga en otra (R52); y un test de UI de `order-delivery-sheet` que abre «Entregar» en dos
      recetas y vuelve a la primera con su borrador (R52);
    - test de la tarjeta de teléfono: el pie tiene prioridad y «Acciones» y ningún botón «Ver
      detalle» aparte; tocar el número de pedido abre el detalle; «Ver detalle» dentro de
      «Acciones» abre el detalle (R44);
    - Grep de `order.recipeName`, `order.recipeImageUrl`, `order.quantity`, `order.unitLabel` y
      `order.presentationLines` sin resultados en `order-responsibles-sheet.tsx`.
  - **Cubre:** R44, R51, R52 (y R24 en la ficha).
- [ ] **T17** · backend_dev · depende de T15, T16, T16b — Se borran de `OrderView` los campos planos de
  la primera receta y su relleno en `toOrderView`, y se ajustan sus tests (decisión P1, design
  § 3.4).
  - **Hecho:** typecheck en verde sin que ningún archivo de `app/` lea esos campos, y Grep de
    `order.recipeName`, `order.quantity` y `order.presentationLines` sin resultados en
    `app/(private)/pedidos/`.
  - **Cubre:** R24.
- [ ] **T18** `[P]` · frontend_dev · depende de la tanda 3 — `e2e/pedidos-varias-recetas.spec.ts`
  y `e2e/helpers/order-form.ts`. El recorrido de R48 comprueba en la base, por receta, lo apartado
  al crear y lo liberado al cancelar.
  - **Hecho:** `pnpm exec playwright test e2e/pedidos-varias-recetas.spec.ts` en verde y su salida
    en `progress/impl_QT-314.md`.
  - **Cubre:** R48 (y de punta a punta R7, R18, R21, R22, R28, R10).
- [ ] **T19** `[P]` · frontend_dev · depende de la tanda 3 — Adaptar los E2E de pedidos que
  existen al panel nuevo, al menú por grupos y al selector de receta, con los helpers de T18. No
  se quita ninguna comprobación.
  - **Hecho:** cada spec de `## Archivos esperados > e2e`, corrido uno a uno con `pnpm exec
    playwright test <spec>` en verde, con la salida en `progress/impl_QT-314.md`.
  - **Cubre:** R49.
- [ ] **T20** · frontend_dev · depende de T13–T19 y T16b — Guardias y convenciones:
  - `pedidos-convenciones.test.ts` sin los esquemas planos;
  - `guard-pedidos-rediseno` en verde con los archivos nuevos;
  - comprobación de que `package.json` no cambió;
  - el mapa `R<n> -> test` completo en `progress/impl_QT-314.md`, con la nota de qué tests de
    QT-313 R44 y R54 se retiraron, y con las filas de la enmienda F2.1: R44 (enmendado), R51 y R52
    a los tests de T16b.
  - **Hecho:** `pnpm exec vitest run guard` en verde y las 52 filas del mapa (R1–R52).
  - **Cubre:** R43, R47, y la trazabilidad de todos.

## Archivos esperados

### lib (backend_dev)
- `lib/modules/pedidos/domain/order-input.ts`
- `lib/modules/pedidos/domain/order-view.ts`
- `lib/modules/pedidos/domain/get-order.ts`
- `lib/modules/pedidos/domain/list-orders.ts`
- `lib/modules/pedidos/domain/errors.ts`
- `lib/modules/pedidos/domain/order-line-diff.ts`
- `lib/modules/pedidos/domain/order-line-removal.ts`
- `lib/modules/pedidos/domain/order-cancellation.ts`
- `lib/modules/pedidos/domain/order-transitions.ts`
- `lib/modules/pedidos/domain/delete-order.ts`
- `lib/modules/pedidos/domain/create-order.ts`
- `lib/modules/pedidos/domain/update-order.ts`
- `lib/modules/pedidos/domain/order-totals.ts`
- `lib/modules/pedidos/domain/get-order-delivery.ts`
- `lib/modules/pedidos/domain/list-order-deliveries.ts`
- `lib/modules/pedidos/domain/list-order-line-ids.ts`
- `lib/modules/pedidos/index.ts`
- `lib/modules/pedidos/adapters/driving/order-actions.ts`
- `lib/composition/index.ts`

### components/shared (frontend_dev)
- `components/shared/row-actions-menu.tsx`
- `components/shared/notice.tsx`
- `components/shared/CATALOGO.md`

### app (frontend_dev)
- `app/(private)/pedidos/components/index.ts`
- `app/(private)/pedidos/components/order-form.tsx`
- `app/(private)/pedidos/components/order-sheet.tsx`
- `app/(private)/pedidos/components/order-row-actions.tsx`
- `app/(private)/pedidos/components/order-columns.tsx`
- `app/(private)/pedidos/components/order-table.tsx`
- `app/(private)/pedidos/components/order-list-section.tsx`
- `app/(private)/pedidos/components/cancel-order-dialog.tsx`
- `app/(private)/pedidos/components/order-distribution-dialog.tsx`
- `app/(private)/pedidos/components/order-delivery-sheet.tsx`
- `app/(private)/pedidos/components/order-deliveries-sheet.tsx`
- `app/(private)/pedidos/components/order-delivery-list.tsx`
- `app/(private)/pedidos/components/order-responsibles-sheet.tsx`
- `app/(private)/pedidos/components/order-ingredients-table.tsx`
- `app/(private)/pedidos/components/order-field.tsx`
- `app/(private)/pedidos/components/use-order-cost-quote.ts`
- `app/(private)/pedidos/components/order-progress.tsx`
- `app/(private)/pedidos/components/order-lines-table.tsx`
- `app/(private)/pedidos/components/order-line-sheet.tsx`
- `app/(private)/pedidos/components/order-detail-sheet.tsx`
- `app/(private)/pedidos/components/order-line-picker-dialog.tsx`
- `app/(private)/pedidos/components/cancel-order-line-dialog.tsx`
- `app/(private)/pedidos/components/order-line-draft.ts`
- `app/(private)/pedidos/components/order-line-actions.ts`
- `app/(private)/pedidos/components/order-delivery-draft.ts`
- `app/(private)/pedidos/components/use-order-delivery-draft.ts`

### tests de lib
- `tests/unit/pedidos/order-input.test.ts`
- `tests/unit/pedidos/order-input-lines.test.ts`
- `tests/unit/pedidos/order-actions.test.ts`
- `tests/unit/pedidos/order-actions-distribution.test.ts`
- `tests/unit/pedidos/order-actions-customer.test.ts`
- `tests/unit/pedidos/order-actions-delivery.test.ts`
- `tests/unit/pedidos/order-actions-delivery-void.test.ts`
- `tests/unit/pedidos/order-actions-cancel-line.test.ts`
- `tests/unit/pedidos/order-view.test.ts`
- `tests/unit/pedidos/order-view-lines.test.ts`
- `tests/unit/pedidos/get-order.test.ts`
- `tests/unit/pedidos/list-orders.test.ts`
- `tests/unit/pedidos/get-order-delivery.test.ts`
- `tests/unit/pedidos/list-order-deliveries.test.ts`
- `tests/unit/pedidos/order-line-positions.test.ts`
- `tests/unit/pedidos/order-line-predicates.test.ts`
- `tests/unit/pedidos/order-service.test.ts`
- `tests/unit/pedidos/qc138-transversales.test.ts`
- `tests/integration/pedidos/qc170-distribution-concurrency.int.test.ts`
- `tests/integration/pedidos/finish-with-finished-goods.int.test.ts`
- `tests/integration/pedidos/order-delivery-by-line.int.test.ts`

### tests de UI y guardias
- `tests/unit/shared-ui/row-actions-menu-group.test.tsx`
- `tests/unit/shared-ui/notice-actions.test.tsx`
- `tests/unit/pedidos-ui/order-form.test.tsx`
- `tests/unit/pedidos-ui/order-form-customer.test.tsx`
- `tests/unit/pedidos-ui/order-form-leftover.test.tsx`
- `tests/unit/pedidos-ui/order-form-quote.test.tsx`
- `tests/unit/pedidos-ui/order-form-sale-price.test.tsx`
- `tests/unit/pedidos-ui/order-form-lines-error.test.tsx`
- `tests/unit/pedidos-ui/order-sheet.test.tsx`
- `tests/unit/pedidos-ui/order-sheet-coverage.test.tsx`
- `tests/unit/pedidos-ui/order-sheet-responsibles.test.tsx`
- `tests/unit/pedidos-ui/order-row-actions.test.tsx`
- `tests/unit/pedidos-ui/order-row-wiring.test.tsx`
- `tests/unit/pedidos-ui/order-columns.test.tsx`
- `tests/unit/pedidos-ui/order-cards.test.tsx`
- `tests/unit/pedidos-ui/order-table.test.tsx`
- `tests/unit/pedidos-ui/order-list-section.test.tsx`
- `tests/unit/pedidos-ui/order-list-section-produced.test.tsx`
- `tests/unit/pedidos-ui/order-delivery-sheet.test.tsx`
- `tests/unit/pedidos-ui/order-deliveries-sheet.test.tsx`
- `tests/unit/pedidos-ui/order-delivery-list.test.tsx`
- `tests/unit/pedidos-ui/order-distribution-dialog.test.tsx`
- `tests/unit/pedidos-ui/cancel-order-dialog.test.tsx`
- `tests/unit/pedidos-ui/order-responsibles.test.tsx`
- `tests/unit/pedidos-ui/read-only.test.tsx`
- `tests/unit/pedidos-ui/a11y-tactil.test.tsx`
- `tests/unit/pedidos-ui/pedidos-viewport.test.tsx`
- `tests/unit/pedidos-ui/pedidos-convenciones.test.ts`
- `tests/unit/pedidos-ui/order-line-draft.test.ts`
- `tests/unit/pedidos-ui/order-line-actions.test.ts`
- `tests/unit/pedidos-ui/order-progress.test.tsx`
- `tests/unit/pedidos-ui/order-lines-table.test.tsx`
- `tests/unit/pedidos-ui/order-line-sheet.test.tsx`
- `tests/unit/pedidos-ui/order-detail-sheet.test.tsx`
- `tests/unit/pedidos-ui/order-line-picker-dialog.test.tsx`
- `tests/unit/pedidos-ui/cancel-order-line-dialog.test.tsx`
- `tests/unit/pedidos-ui/order-delivery-draft.test.ts`
- `tests/guards/guard-pedidos-rediseno.test.ts`

### e2e (frontend_dev)
- `e2e/pedidos-varias-recetas.spec.ts`
- `e2e/helpers/order-form.ts`
- `e2e/helpers/order-distribution.ts`
- `e2e/pedido-con-varias-recetas.spec.ts`
- `e2e/pedidos.spec.ts`
- `e2e/pedidos-rediseno.spec.ts`
- `e2e/pedidos-cotizacion.spec.ts`
- `e2e/pedidos-busqueda.spec.ts`
- `e2e/pedidos-terminados.spec.ts`
- `e2e/pedidos-responsables.spec.ts`
- `e2e/pedidos-asignados.spec.ts`
- `e2e/pedido-bloqueado.spec.ts`
- `e2e/pedido-con-cliente.spec.ts`
- `e2e/pedido-conversion-de-unidad.spec.ts`
- `e2e/pedido-en-varias-presentaciones.spec.ts`
- `e2e/pedido-precio-de-venta.spec.ts`
- `e2e/envases-del-pedido.spec.ts`
- `e2e/aislamiento-pedidos.spec.ts`
- `e2e/entrega-sin-pedido.spec.ts`
- `e2e/reserva-de-material.spec.ts`
- `e2e/anular-entrega.spec.ts`
- `e2e/entregar-producto-terminado.spec.ts`
- `e2e/entrega-a-varios-clientes.spec.ts`
- `e2e/coste-real-de-produccion.spec.ts`
- `e2e/detalle-de-producto-terminado.spec.ts`
- `e2e/envases-reales-empaque.spec.ts`
- `e2e/producto-terminado.spec.ts`
- `e2e/recetas-porcentaje.spec.ts`
- `e2e/versiones-de-receta.spec.ts`

### progreso
- `progress/impl_QT-314.md`
