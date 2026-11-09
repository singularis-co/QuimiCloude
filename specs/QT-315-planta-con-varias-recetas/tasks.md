# QT-315 — planta-con-varias-recetas · tasks.md

> **Cómo están hechas las tandas.**
> - Cada tanda cierra con el gate local en verde: `pnpm run typecheck`, `pnpm run lint`,
>   `pnpm exec vitest related --run <archivos>` y `pnpm exec vitest run guard`, más
>   `./init.sh` al final de la tanda.
> - Una tanda que cambia una firma usada por la UI lleva **en la misma tanda** la task de
>   `frontend_dev` que la consume. Así `typecheck` no queda rojo entre tandas.
> - Los E2E corren en CI (`gate-completo`). En local se corre solo el spec tocado:
>   `pnpm exec playwright test <spec>`.
>
> **Antes de T6:** el humano tiene que haber respondido **P1 y P2**. P3 se necesita antes de
> T10. P4 no bloquea.
>
> `[P]` = puede ir en paralelo con las otras `[P]` de su tanda. Cada test lleva `R<n>` en el
> nombre del caso.

## Tanda 1 — contratos de `pedidos` e `inventario` (aditivos)

- [ ] **T1 [P] · backend_dev — lecturas por receta en `OrderCatalog`** (design § 3.1, puntos 1 y 2)
  - `findAliveLineSummary(companyId, orderId, lineId)` y
    `listRecipeOutlinesByIdsIncludingDeleted(companyId, orderIds)`, con su adaptador Prisma, el
    barril y `composition`. Se exporta el tipo `OrderProgress`.
  - Un pedido dado de baja toma las líneas con su mismo `deleted_at` (R24).
  - **Hecho cuando:**
    - unit del mapeo;
    - integración contra la base con un pedido de dos recetas, una cancelada y una quitada, y con
      un pedido dado de baja;
    - rechazo cruzado por empresa;
    - typecheck y guardias en verde.
- [ ] **T2 [P] · backend_dev — `OrderCancellation.cancelLineAliveById`** (design § 3.1, punto 3)
  - Se extrae `cancelLineInsideTransaction`, que comparten `cancelOrderLine` y el método nuevo.
  - Se ata en `executionTransaction.orders` de `composition`.
  - **Hecho cuando:**
    - los tests de `cancel-order-line` siguen verdes sin cambiarlos;
    - hay un unit de `ok`, `not_found` y `not_cancellable`;
    - hay una integración: libera solo el material de esa línea y deriva el estado del pedido
      (R16, R17).
- [ ] **T3 [P] · backend_dev — `FinishedBatchLabels` por línea** (design § 3.2)
  - `listOfOrder` y `writeForOrder` reciben `orderLineId`.
  - Los tres llamadores de `asignaciones` pasan `summary.lineId`, el de hoy.
  - **Hecho cuando:**
    - `finished-batch-labels.int.test.ts` prueba que con dos líneas solo se leen y escriben los
      lotes de la nombrada (R13);
    - los tests de `asignaciones` que lo usan siguen verdes.

## Tanda 2 — lecturas por línea en los puertos de `asignaciones`

- [ ] **T4 [P] · backend_dev — registro de ejecución por línea** (design § 3.3)
  - `findLastStepPosition(companyId, orderId, orderLineId)`.
  - `ExecutionEntryRecord.orderLineId`.
  - El avance de los pasos de acondicionamiento filtra por línea en `get-conditioning-order`,
    `finish-conditioning` y `record-conditioning-step`.
  - Los llamadores pasan el `lineId` que ya tienen.
  - **Hecho cuando:** hay un unit y una integración con dos líneas del mismo pedido que no se
    mezclan (R13).
- [ ] **T5 [P] · backend_dev — fotos y equipo por línea** (design § 3.3)
  - `StepEvidenceRepository`: `listByLine`, `findById` y `delete` con línea, y `slot` libre por
    línea.
  - `ConditioningTeamRepository.listByLineInCompany`; `listByOrdersInCompany` con `orderLineId`.
  - Se actualizan `evidence-photos`, `read-order-evidence` (sigue por pedido para
    `getOrderEvidence`, P4), `record-step-move`, `register-evidence`, `request-evidence-upload`,
    `remove-evidence`, `finish-packing` y `record-conditioning-step`.
  - **Hecho cuando:**
    - `step-evidence-repository.int.test.ts` prueba el tope de fotos por paso **por receta**;
    - `conditioning-team-repository.int.test.ts` prueba que el equipo de una línea no sale en la
      otra (R13).

## Tanda 3 — la receta viaja de punta a punta (depende de T1–T5, P1 y P2)

- [ ] **T6 · backend_dev — casos de uso y acciones con `lineId`** (design § 2, § 3.4 y § 3.7)
  - **`only-order-line.ts`.** Se borra; entra `order-line-target.ts` (`findLine`) con
    `orderLineInputSchema`.
  - **Puerta de estado.** Todos los casos de uso de la tabla de § 3.4 pasan a
    `{ orderId, lineId }`, con la puerta por estado **de la línea** (R10).
  - **Cancelar desde la ejecución.** `cancelAssignedOrder` usa `cancelLineAliveById` (R16, R17).
  - **Empaque.** `finishPacking` lee `counts[].presentationLineId`.
  - **Rutas.** Las acciones driving cambian de firma. En `lib/shared/routes.ts`:
    - los helpers con `lineId` obligatorio;
    - `RECIPE_PARAM`, `MANUFACTURED_ORDER_PARAM` y `OUTCOME_RECIPE_PARAM`;
    - se borran `DELIVERED_ORDER_*`.
  - **Comentarios.** Se corrigen los de `finishPackingAction`, `finishAssignedOrderAction` y
    `PACKED_ORDER_PARAM` (fila «Restos de nombres viejos»).
  - **Vistas.** Las de lista ganan `lineId`.
  - **Hecho cuando:**
    - no queda `onlyLineOf` ni `findOnlyLine` en el repo;
    - hay un unit por caso de uso con **dos recetas en el mismo estado**: opera solo sobre la
      nombrada (R11, R12);
    - una línea ajena o quitada da `order_not_found` (R14);
    - sin `lineId` da `invalid_input` (R14);
    - permisos sin cambios (R15);
    - un `PARCIAL` con la receta en `EN_CURSO` abre la ejecución (R10).
- [ ] **T7 · frontend_dev — la UI pasa la receta** (design § 2 y § 4.1; misma tanda que T6, va
  después)
  - **Páginas.** Las tres `page.tsx` exigen `?receta=<uuid>`, con `notFound()` si falta, y llaman
    con `{ orderId, lineId }`. Empaque captura también `ValidationError` (R9).
  - **Listas.** Las seis tablas usan `getRowId` por `lineId`. «Entrar» y los enlaces van con
    `…Route(row.id, row.lineId)` (R2, R4).
  - **Formularios.** Los diálogos y formularios mandan `lineId`, y el de terminar empaque manda
    `counts`.
  - **Hecho cuando:**
    - typecheck en verde con T6;
    - los tests de UI de páginas, columnas y triggers están actualizados;
    - hay un test de página 404 sin receta y con receta ajena (R9);
    - hay un test de dos filas con el mismo número y destinos distintos (R2).

## Tanda 4 — «Receta N de M», cabecera, cancelar receta y avisos

- [ ] **T8 · backend_dev — posición, otras recetas y nombre para el aviso** (design § 3.4)
  - **Listas.** `composeOrderRows` lee los outlines en una llamada. Las vistas de lista ganan
    `recipe: { position, count }`.
  - **Detalle.** Las vistas de detalle ganan `lineId`, `recipe` y `otherRecipes`.
  - **Aviso.** `finishAssignedOrder` y `cancelAssignedOrder` devuelven `recipeName` y
    `recipeCount`. Lo mismo `finishPacking` y `finishConditioning` para su aviso.
  - **Hecho cuando:**
    - hay un unit de N y M con una receta cancelada, según P1 (R3, R7);
    - hay un unit de `otherRecipes` en orden de alta (R8);
    - el número de llamadas por página no crece con las filas.
- [ ] **T9 · frontend_dev — piezas del tablero «Pantalla de una receta»** (design § 4.1–§ 4.3;
  depende de T8)
  - **Piezas nuevas.** `RecipeOfOrderLabel` (paso 4) y `RecipeHeader` (paso 3), con «Ir a esta
    receta» según P2.
  - **Diálogo.** `OrderCancelDialog` pasa a «Cancelar esta receta».
  - **Avisos.** `OrderOutcomeNotice` pasa de `delivered` a `manufactured`, con la receta.
    `asignacion/page.tsx` lee `OUTCOME_RECIPE_PARAM`.
  - **Teléfono.** La tarjeta lleva «Receta N de M» y «Entrar» de 44 px (R30).
  - **Hecho cuando:**
    - hay tests de UI de «Receta N de M» y de su ausencia con una receta (R3, R29);
    - hay tests de la cabecera y de «Otras recetas» (R7, R8);
    - hay tests del diálogo (R18);
    - hay tests de los cuatro avisos con y sin receta, y ninguno dice «entregado» (R19, R20);
    - hay un test de que ninguna pantalla de planta ofrece entregar (R31);
    - el diff cumple multiplataforma.

## Tanda 5 — Dashboard y Recorrido (depende de P3)

- [ ] **T10 · backend_dev — recorrido por receta** (design § 3.5 y § 3.6)
  - **`listExecutionTraces`.** Agrupa por `orderLineId`. Añade `moreRecipes`, `progress` y
    `recipes[].presentations`. La duración es la suma, con «abierta gana» (R21–R23).
  - **`getExecutionTrace`.** Devuelve `recipes[]`, con responsables y equipo por receta (R25,
    R26).
  - **`getExecutionEvidence`.** Agrupa las fotos por línea.
  - **Fases.** Se miden con el estado de la línea (R27).
  - **Hecho cuando:**
    - hay un unit con un `PARCIAL` de dos recetas: fase abierta en una y cerrada en la otra (R27),
      y la duración suma (R23);
    - hay un unit de la cancelada con su sección (R28);
    - hay un unit del pedido dado de baja (R24);
    - hay un unit de un pedido de una receta, igual que hoy en una sección (R29).
- [ ] **T11 · frontend_dev — Dashboard y Recorrido** (design § 4.4, § 4.5 y § 7; misma tanda
  que T10)
  - **Piezas que suben.** `OrderProgress` y `RecipesFirstMore` suben a `components/shared`, con
    su fila en `CATALOGO.md` en el mismo commit. Pedidos importa desde ahí sin cambio visible.
  - **Dashboard.** `execution-trace-columns` gana «Avance» y «+N más», y agrupa las
    presentaciones.
  - **Recorrido.** `execution-trace-detail` pinta el resumen y `ExecutionTraceRecipeSection`.
  - **Hecho cuando:**
    - los tests de UI del Dashboard (R21, R22) y del Recorrido (R25, R26, R28) están en verde;
    - los tests de Pedidos que usan `OrderProgress` siguen verdes;
    - la guardia del catálogo está en verde.

## Tanda 6 — E2E (CI)

- [ ] **T12 [P] · frontend_dev — E2E nuevo `e2e/planta-con-varias-recetas.spec.ts`** (R33)
  - El recorrido es este:
    1. Se da de alta un pedido de dos recetas.
    2. Se fabrica la primera y se comprueba que la segunda sigue `PENDIENTE`.
    3. Se fabrica la segunda.
    4. Se empaca y se acondiciona cada una por su lado.
    5. En el Dashboard se ve «+1 más», «1 de 2» y después «2 de 2».
    6. El Recorrido tiene dos secciones.
  - **Hecho cuando:** `pnpm exec playwright test e2e/planta-con-varias-recetas.spec.ts` está en
    verde en local.
- [ ] **T13 [P] · frontend_dev — adaptar los E2E de planta** (R33)
  - Los E2E con las rutas o pantallas de planta (lista en `## Archivos esperados > E2E`) pasan
    a la receta en la dirección.
  - `dashboard-rediseno` y los dos `recorrido-*` pasan a las secciones.
  - **Hecho cuando:** cada spec tocado está en verde en local con
    `pnpm exec playwright test <spec>`.

## Cierre

- [ ] **T14 · implementer — cierre**
  - El mapa `R<n> → test` (R1–R33) va en `progress/impl_QT-315.md`.
  - `./init.sh` en verde.
  - Se comprueba R32: el diff no toca `db/` ni las dependencias de `package.json`.
  - Se corre `node scripts/archivos-en-vuelo.mjs --candidata QT-315` y el resultado se anota.
  - **Hecho cuando:** el reviewer tiene todo lo que pide `CHECKPOINTS.md` y
    `docs/checkpoints-proyecto.md`.

## Archivos esperados

### `lib/` (backend_dev)
- `lib/modules/pedidos/domain/order-catalog.ts`
- `lib/modules/pedidos/domain/order-cancellation.ts`
- `lib/modules/pedidos/domain/cancel-order-line.ts`
- `lib/modules/pedidos/domain/list-order-summaries.ts`
- `lib/modules/pedidos/domain/order-totals.ts`
- `lib/modules/pedidos/ports/order-summary-reader.ts`
- `lib/modules/pedidos/adapters/driven/persistence/order-catalog-prisma.ts`
- `lib/modules/pedidos/index.ts`
- `lib/modules/inventario/domain/finished-batch-labels.ts`
- `lib/modules/inventario/adapters/driven/persistence/finished-batch-labels-prisma.ts`
- `lib/modules/inventario/adapters/driven/persistence/product-prisma.ts`
- `lib/modules/asignaciones/index.ts`
- `lib/modules/asignaciones/ports/execution-log-repository.ts`
- `lib/modules/asignaciones/ports/step-evidence-repository.ts`
- `lib/modules/asignaciones/ports/conditioning-team-repository.ts`
- `lib/modules/asignaciones/ports/execution-transaction.ts`
- `lib/modules/asignaciones/adapters/driven/persistence/execution-log-prisma.ts`
- `lib/modules/asignaciones/adapters/driven/persistence/step-evidence-prisma.ts`
- `lib/modules/asignaciones/adapters/driven/persistence/conditioning-team-prisma.ts`
- `lib/modules/asignaciones/adapters/driving/order-execution-actions.ts`
- `lib/modules/asignaciones/adapters/driving/order-packing-actions.ts`
- `lib/modules/asignaciones/adapters/driving/order-conditioning-actions.ts`
- `lib/modules/asignaciones/adapters/driving/step-evidence-actions.ts`
- `lib/modules/asignaciones/adapters/driving/execution-trace-actions.ts`
- `lib/modules/asignaciones/domain/only-order-line.ts` (se borra)
- `lib/modules/asignaciones/domain/order-line-target.ts` (nuevo)
- `lib/modules/asignaciones/domain/assigned-order-view.ts`
- `lib/modules/asignaciones/domain/assigned-order-execution-view.ts`
- `lib/modules/asignaciones/domain/company-order-view.ts`
- `lib/modules/asignaciones/domain/finished-order-view.ts`
- `lib/modules/asignaciones/domain/packing-order-view.ts`
- `lib/modules/asignaciones/domain/conditioning-order-view.ts`
- `lib/modules/asignaciones/domain/compose-order-rows.ts`
- `lib/modules/asignaciones/domain/list-assigned-orders.ts`
- `lib/modules/asignaciones/domain/list-company-orders.ts`
- `lib/modules/asignaciones/domain/list-finished-orders.ts`
- `lib/modules/asignaciones/domain/list-packing-orders.ts`
- `lib/modules/asignaciones/domain/list-conditioning-orders.ts`
- `lib/modules/asignaciones/domain/list-conditioned-orders.ts`
- `lib/modules/asignaciones/domain/open-assigned-order.ts`
- `lib/modules/asignaciones/domain/get-assigned-order-execution.ts`
- `lib/modules/asignaciones/domain/start-assigned-order.ts`
- `lib/modules/asignaciones/domain/record-step-move.ts`
- `lib/modules/asignaciones/domain/finish-assigned-order.ts`
- `lib/modules/asignaciones/domain/cancel-assigned-order.ts`
- `lib/modules/asignaciones/domain/get-packing-order.ts`
- `lib/modules/asignaciones/domain/start-packing.ts`
- `lib/modules/asignaciones/domain/finish-packing.ts`
- `lib/modules/asignaciones/domain/get-conditioning-order.ts`
- `lib/modules/asignaciones/domain/start-conditioning.ts`
- `lib/modules/asignaciones/domain/finish-conditioning.ts`
- `lib/modules/asignaciones/domain/record-conditioning-step.ts`
- `lib/modules/asignaciones/domain/save-conditioning-batch-data.ts`
- `lib/modules/asignaciones/domain/conditioning-steps.ts`
- `lib/modules/asignaciones/domain/evidence-target.ts`
- `lib/modules/asignaciones/domain/evidence-photos.ts`
- `lib/modules/asignaciones/domain/register-evidence.ts`
- `lib/modules/asignaciones/domain/request-evidence-upload.ts`
- `lib/modules/asignaciones/domain/remove-evidence.ts`
- `lib/modules/asignaciones/domain/read-order-evidence.ts`
- `lib/modules/asignaciones/domain/get-execution-evidence.ts`
- `lib/modules/asignaciones/domain/execution-entry.ts`
- `lib/modules/asignaciones/domain/execution-trace.ts`
- `lib/modules/asignaciones/domain/list-execution-traces.ts`
- `lib/modules/asignaciones/domain/get-execution-trace.ts`
- `lib/composition/index.ts`
- `lib/shared/routes.ts`

### `app/` y `components/` (frontend_dev)
- `app/(private)/asignacion/page.tsx`
- `app/(private)/asignacion/components/index.ts`
- `app/(private)/asignacion/components/recipe-of-order-label.tsx` (nuevo)
- `app/(private)/asignacion/components/recipe-header.tsx` (nuevo)
- `app/(private)/asignacion/components/assigned-order-enter-trigger.tsx`
- `app/(private)/asignacion/components/assigned-orders-columns.tsx`
- `app/(private)/asignacion/components/assigned-orders-table.tsx`
- `app/(private)/asignacion/components/company-orders-columns.tsx`
- `app/(private)/asignacion/components/company-orders-table.tsx`
- `app/(private)/asignacion/components/finished-orders-columns.tsx`
- `app/(private)/asignacion/components/finished-orders-table.tsx`
- `app/(private)/asignacion/components/packing-orders-columns.tsx`
- `app/(private)/asignacion/components/packing-orders-table.tsx`
- `app/(private)/asignacion/components/conditioning-orders-columns.tsx`
- `app/(private)/asignacion/components/conditioning-orders-table.tsx`
- `app/(private)/asignacion/components/conditioned-orders-columns.tsx`
- `app/(private)/asignacion/components/conditioned-orders-table.tsx`
- `app/(private)/asignacion/components/assignment-row-actions.tsx`
- `app/(private)/asignacion/components/order-outcome-notice.tsx`
- `app/(private)/asignacion/components/operator-screen-frame.tsx`
- `app/(private)/asignacion/components/use-step-evidence.tsx`
- `app/(private)/asignacion/[id]/page.tsx`
- `app/(private)/asignacion/[id]/components/order-execution-screen.tsx`
- `app/(private)/asignacion/[id]/components/order-cancel-dialog.tsx`
- `app/(private)/asignacion/empaque/[id]/page.tsx`
- `app/(private)/asignacion/empaque/[id]/components/packing-order-screen.tsx`
- `app/(private)/asignacion/empaque/[id]/components/packing-finish-dialog.tsx`
- `app/(private)/asignacion/acondicionamiento/[id]/page.tsx`
- `app/(private)/asignacion/acondicionamiento/[id]/components/conditioning-order-screen.tsx`
- `app/(private)/asignacion/acondicionamiento/[id]/components/conditioning-actions.tsx`
- `app/(private)/asignacion/acondicionamiento/[id]/components/conditioning-batch-data-form.tsx`
- `app/(private)/asignacion/acondicionamiento/[id]/components/conditioning-steps-panel.tsx`
- `app/(private)/asignacion/acondicionamiento/[id]/components/start-conditioning-dialog.tsx`
- `app/(private)/asignacion/acondicionamiento/[id]/components/finish-conditioning-dialog.tsx`
- `app/(private)/dashboard/components/execution-trace-columns.tsx`
- `app/(private)/dashboard/components/execution-trace-table.tsx`
- `app/(private)/dashboard/recorrido/[id]/page.tsx`
- `app/(private)/dashboard/recorrido/[id]/components/index.ts`
- `app/(private)/dashboard/recorrido/[id]/components/execution-trace-detail.tsx`
- `app/(private)/dashboard/recorrido/[id]/components/execution-trace-recipe-section.tsx` (nuevo)
- `app/(private)/dashboard/recorrido/[id]/components/trace-evidence-placement.ts`
- `app/(private)/pedidos/components/order-progress.tsx` (se mueve)
- `app/(private)/pedidos/components/order-columns.tsx`
- `app/(private)/pedidos/components/order-detail-sheet.tsx`
- `app/(private)/pedidos/components/index.ts`
- `components/shared/order-progress.tsx` (nuevo)
- `components/shared/recipes-first-more.tsx` (nuevo)
- `components/shared/CATALOGO.md`

### Tests
- `tests/unit/pedidos/order-catalog.test.ts`
- `tests/unit/pedidos/cancel-order-line.test.ts`
- `tests/integration/pedidos/order-line-outlines.int.test.ts` (nuevo)
- `tests/integration/pedidos/cancel-line-from-execution.int.test.ts` (nuevo)
- `tests/integration/inventario/finished-batch-labels.int.test.ts`
- `tests/integration/asignaciones/use-case-fixture.ts`
- `tests/integration/asignaciones/step-evidence-repository.int.test.ts`
- `tests/integration/asignaciones/conditioning-team-repository.int.test.ts`
- `tests/integration/asignaciones/execution-log-read.int.test.ts`
- `tests/integration/asignaciones/two-recipes.int.test.ts` (nuevo)
- `tests/unit/asignaciones/conditioning-doubles.ts`
- `tests/unit/asignaciones/evidence-doubles.ts`
- `tests/unit/asignaciones/start-assigned-order.test.ts`
- `tests/unit/asignaciones/open-assigned-order.test.ts`
- `tests/unit/asignaciones/get-assigned-order-execution.test.ts`
- `tests/unit/asignaciones/record-step-move.test.ts`
- `tests/unit/asignaciones/record-step-move-evidence.test.ts`
- `tests/unit/asignaciones/finish-assigned-order.test.ts`
- `tests/unit/asignaciones/cancel-assigned-order.test.ts`
- `tests/unit/asignaciones/get-packing-order.test.ts`
- `tests/unit/asignaciones/start-packing.test.ts`
- `tests/unit/asignaciones/finish-packing.test.ts`
- `tests/unit/asignaciones/get-conditioning-order.test.ts`
- `tests/unit/asignaciones/start-conditioning.test.ts`
- `tests/unit/asignaciones/finish-conditioning.test.ts`
- `tests/unit/asignaciones/record-conditioning-step.test.ts`
- `tests/unit/asignaciones/save-conditioning-batch-data.test.ts`
- `tests/unit/asignaciones/evidence-target.test.ts`
- `tests/unit/asignaciones/register-evidence.test.ts`
- `tests/unit/asignaciones/request-evidence-upload.test.ts`
- `tests/unit/asignaciones/remove-evidence.test.ts`
- `tests/unit/asignaciones/list-assigned-orders.test.ts`
- `tests/unit/asignaciones/list-company-orders.test.ts`
- `tests/unit/asignaciones/list-finished-orders.test.ts`
- `tests/unit/asignaciones/list-packing-orders.test.ts`
- `tests/unit/asignaciones/list-conditioning-orders.test.ts`
- `tests/unit/asignaciones/list-conditioned-orders.test.ts`
- `tests/unit/asignaciones/execution-trace.test.ts`
- `tests/unit/asignaciones/list-execution-traces.test.ts`
- `tests/unit/asignaciones/get-execution-trace.test.ts`
- `tests/unit/asignaciones/get-execution-evidence.test.ts`
- `tests/unit/asignaciones/order-execution-actions.test.ts`
- `tests/unit/asignaciones/order-packing-actions.test.ts`
- `tests/unit/asignaciones/order-conditioning-actions.test.ts`
- `tests/unit/asignaciones/step-evidence-actions.test.ts`
- `tests/unit/asignaciones/authorization.test.ts`
- `tests/unit/asignaciones/module-contract.test.ts`
- `tests/unit/asignaciones-ui/asignacion-page.test.tsx`
- `tests/unit/asignaciones-ui/assigned-order-enter-trigger.test.tsx`
- `tests/unit/asignaciones-ui/assigned-orders-columns.test.tsx`
- `tests/unit/asignaciones-ui/assigned-orders-delivered-notice.test.tsx`
- `tests/unit/asignaciones-ui/assigned-orders-cancelled-notice.test.tsx`
- `tests/unit/asignaciones-ui/assigned-orders-route-contract.test.ts`
- `tests/unit/asignaciones-ui/assignment-row-actions.test.tsx`
- `tests/unit/asignaciones-ui/assigned-orders-can-execute.test.tsx`
- `tests/unit/asignaciones-ui/company-orders-columns.test.tsx`
- `tests/unit/asignaciones-ui/finished-orders-columns.test.tsx`
- `tests/unit/asignaciones-ui/packing-orders-columns.test.tsx`
- `tests/unit/asignaciones-ui/conditioning-orders-columns.test.tsx`
- `tests/unit/asignaciones-ui/packed-order-notice.test.tsx`
- `tests/unit/asignaciones-ui/conditioned-order-notice.test.tsx`
- `tests/unit/asignaciones-ui/order-cancel-dialog.test.tsx`
- `tests/unit/asignaciones-ui/order-execution-page.test.tsx`
- `tests/unit/asignaciones-ui/order-execution-screen.test.tsx`
- `tests/unit/asignaciones-ui/packing-order-page.test.tsx`
- `tests/unit/asignaciones-ui/packing-order-screen.test.tsx`
- `tests/unit/asignaciones-ui/packing-finish-dialog.test.tsx`
- `tests/unit/asignaciones-ui/conditioning-order-page.test.tsx`
- `tests/unit/asignaciones-ui/conditioning-order-screen.test.tsx`
- `tests/unit/asignaciones-ui/recipe-header.test.tsx` (nuevo)
- `tests/unit/asignaciones-ui/recipe-of-order-label.test.tsx` (nuevo)
- `tests/unit/recetas-ui/recipe-route-contract.test.ts`
- `tests/unit/pedidos-ui/order-route-contract.test.ts`
- `tests/unit/dashboard-route-contract.test.ts`
- `tests/ui/dashboard/execution-trace-table.test.tsx`
- `tests/ui/dashboard/execution-trace-detail.test.tsx`
- `tests/ui/dashboard/execution-trace-evidence.test.tsx`
- `tests/ui/dashboard/dashboard-rediseno.test.tsx`
- `tests/ui/dashboard/recorrido-rediseno.test.tsx`
- `tests/ui/dashboard/trace-evidence-placement.test.ts`
- `tests/helpers/delivery-progress-double.ts`

### E2E
- `e2e/planta-con-varias-recetas.spec.ts` (nuevo)
- `e2e/acondicionamiento.spec.ts`
- `e2e/acondicionar-con-equipo.spec.ts`
- `e2e/datos-de-lote-en-acondicionamiento.spec.ts`
- `e2e/ejecucion-receta.spec.ts`
- `e2e/empaque.spec.ts`
- `e2e/envases-reales-empaque.spec.ts`
- `e2e/operario-rediseno.spec.ts`
- `e2e/pasos-de-acondicionamiento.spec.ts`
- `e2e/pedidos-asignados.spec.ts`
- `e2e/recorrido-acondicionamiento.spec.ts`
- `e2e/recorrido-ejecucion.spec.ts`
- `e2e/registro-ejecucion.spec.ts`
- `e2e/dashboard-rediseno.spec.ts`
- `e2e/consulta-de-evidencia.spec.ts`
- `e2e/reserva-de-material.spec.ts`
- `e2e/recetas-porcentaje.spec.ts`
- `e2e/producto-terminado.spec.ts`
- `e2e/envases-del-pedido.spec.ts`
- `e2e/pedidos-terminados.spec.ts`
- `e2e/coste-real-de-produccion.spec.ts`
- `e2e/pedido-en-varias-presentaciones.spec.ts`
- `e2e/pasos-de-envasado.spec.ts`
- `e2e/pedido-con-varias-recetas.spec.ts`
