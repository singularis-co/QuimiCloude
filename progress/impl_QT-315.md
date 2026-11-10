# impl_QT-315 — planta-con-varias-recetas

## Tanda 1 (T1, T2, T3) — backend_dev, 2026-11-09

Grafo: el MCP responde pero no tiene proyecto indexado para este worktree; todo con Grep/Read.
Antes del primer typecheck hizo falta `prisma generate` y `next typegen` (worktree sin artefactos).

### Archivos

**T1 — `OrderCatalog.findAliveLineSummary` y `listRecipeOutlinesByIdsIncludingDeleted`**
- `lib/modules/pedidos/domain/order-catalog.ts`: los dos métodos, `OrderRecipeOutline`, `OrderRecipesOutline`.
- `lib/modules/pedidos/ports/order-summary-reader.ts`: `findAliveLine`.
- `lib/modules/pedidos/domain/list-order-summaries.ts`: `createFindAliveLineSummary` (nombres de envase como los listados; `itemsWithPackagingNames` extraída).
- `lib/modules/pedidos/adapters/driven/persistence/order-catalog-prisma.ts`: `findAliveOrderLineSummary`, `toOrderRecipesOutline`, `listOrderRecipeOutlinesByIdsIncludingDeleted`; `aliveLineScope` extraída de `aliveLinesWhere`.
- `lib/modules/pedidos/index.ts`: `createFindAliveLineSummary`, tipos `OrderRecipeOutline`, `OrderRecipesOutline`, `OrderProgress`.
- `lib/composition/index.ts`: `orderSummaryReader.findAliveLine`, `orderCatalog.findAliveLineSummary`, `orderCatalog.listRecipeOutlinesByIdsIncludingDeleted`.

**T2 — `OrderCancellation.cancelLineAliveById`**
- `lib/modules/pedidos/domain/order-cancellation.ts`: `cancelLineInsideTransaction`, el método en el tipo, `createCancelAliveOrderLine`.
- `lib/modules/pedidos/domain/cancel-order-line.ts`: usa `cancelLineInsideTransaction`.
- `lib/modules/pedidos/index.ts`: `createCancelAliveOrderLine`.
- `lib/composition/index.ts`: `executionTransaction.orders.cancelLineAliveById` con `joinOrderUnitOfWork(tx)`.

**T3 — `FinishedBatchLabels` por línea**
- `lib/modules/inventario/domain/finished-batch-labels.ts`, `adapters/driven/persistence/finished-batch-labels-prisma.ts`, `adapters/driven/persistence/product-prisma.ts` (`writeFinishedBatchLabels` filtra `order_line_id`).
- `lib/modules/asignaciones/domain/{finish-conditioning,get-conditioning-order,save-conditioning-batch-data}.ts`: pasan `summary.lineId`.

**Tests**
- Nuevos: `tests/integration/pedidos/order-line-outlines.int.test.ts`, `tests/integration/pedidos/cancel-line-from-execution.int.test.ts` (los dos en `aislamiento.json` como `commit`).
- Ampliados: `tests/unit/pedidos/order-catalog.test.ts`, `tests/unit/pedidos/cancel-order-line.test.ts` (solo un import y un `describe` al final; los casos existentes intactos), `tests/integration/inventario/finished-batch-labels.int.test.ts`.
- Adaptados a las firmas nuevas: `tests/helpers/{order-summaries,execution-transaction-on-client}.ts`, `tests/integration/asignaciones/{use-case-fixture.ts,assigned-orders,batch-states,company-orders,finished-orders,responsible-eligibility}.int.test.ts`, `tests/integration/pedidos/finish-with-finished-goods.int.test.ts`, `tests/unit/asignaciones/{assign-responsibles,execution-log-repository,finish-conditioning,get-conditioning-order,save-conditioning-batch-data}.test.ts`, `tests/unit/pedidos/list-summaries-including-deleted.test.ts`.
- Guardia: `tests/guards/guard-ambito-empresa-pedidos.test.ts`, entrada `findAliveLineSummary` en `METODOS_DELEGADOS_EN_DOMINIO` (mismo patrón que `listAliveSummariesByIds`).

### Mapa R<n> → test

| R | Archivo | Caso |
|---|---|---|
| R3, R21, R22 | `tests/unit/pedidos/order-catalog.test.ts` | `R3, R21, R22: un pedido vivo toma sus lineas vivas en orden de alta, canceladas incluidas; …` |
| R3, R21, R22 | `tests/integration/pedidos/order-line-outlines.int.test.ts` | `R3, R21, R22: un pedido de varias recetas trae las vivas en orden de alta, la cancelada incluida y la quitada fuera` |
| R24 | `tests/unit/pedidos/order-catalog.test.ts` | `R24: un pedido dado de baja toma solo las lineas quitadas en el mismo instante que el pedido`; `R24: filtra por empresa sin excluir los dados de baja …`; `R24: con ids vacio no consulta` |
| R24 | `tests/integration/pedidos/order-line-outlines.int.test.ts` | `R24: un pedido dado de baja trae las recetas que tenia vivas al darse de baja, no las quitadas antes`; `R24: varios pedidos en una consulta; un id de otra empresa o inexistente no vuelve` |
| R14 | `tests/unit/pedidos/order-catalog.test.ts` | `R14: busca esa linea viva de ese pedido vivo …`; `R14: una linea de otro pedido, quitada, de otra empresa o inexistente da null …` |
| R14 | `tests/integration/pedidos/order-line-outlines.int.test.ts` | `R14: devuelve esa linea viva en cualquier estado, canceladas incluidas; quitada, de otro pedido o de otra empresa da null` |
| R16 | `tests/unit/pedidos/cancel-order-line.test.ts` | `R16: ok cancela solo la linea nombrada …`; `R14, R16: not_found con una linea de otro pedido, quitada o de otra empresa …` |
| R16 | `tests/integration/pedidos/cancel-line-from-execution.int.test.ts` | `R16: cancela solo esa receta con su motivo, libera todo su material y deriva el pedido; la otra receta no cambia` |
| R17 | `tests/unit/pedidos/cancel-order-line.test.ts` | `R17: not_cancellable con la linea en un estado no cancelable, sin escribir nada` |
| R17 | `tests/integration/pedidos/cancel-line-from-execution.int.test.ts` | `R17: una receta en un estado no cancelable, ya cancelada, ajena o de otra empresa no escribe nada` |
| R13 | `tests/integration/inventario/finished-batch-labels.int.test.ts` | `R13: con dos lineas, listOfOrder y writeForOrder solo leen y escriben los lotes de la nombrada` |
| R32 | (reviewer) | sin cambios en `db/` ni en `package.json` |
| R34 | `getOrderEvidence` no se toca | ningún test de Inventario › evidencias cambiado |

### Salida real

- `pnpm run typecheck`: 0 errores.
- `pnpm run lint`: 0 errores, 11 avisos, todos en archivos que esta tanda no toca.
- Unit (16 archivos de `pedidos`, `asignaciones` e `inventario`): 16 archivos, 619 casos, en verde tras ajustar la aserción de `append` en `save-conditioning-batch-data.test.ts`.
- Integración (29 archivos, `.int`): 29 archivos, 215 casos, en verde.
- Guardias (`pnpm exec vitest run guard`): 87 archivos, 1335 en verde, 22 omitidos.

### Veredicto

Tanda 1 hecha: los contratos de `pedidos` e `inventario` son aditivos y quedan atados en la composición; typecheck, lint, tests tocados y guardias en verde.

## Tanda 2 (T4, T5) — backend_dev, 2026-11-09

Grafo: sigue sin proyecto indexado para este worktree; todo con Grep/Read. Sin migraciones, sin `db/`, sin dependencias, sin UI ni firmas de acciones driving.

### Archivos

**T4 — registro de ejecución por línea**
- `lib/modules/asignaciones/domain/execution-entry.ts`: `ExecutionEntryRecord.orderLineId`.
- `lib/modules/asignaciones/ports/execution-log-repository.ts`: `findLastStepPosition(companyId, orderId, orderLineId)`.
- `lib/modules/asignaciones/adapters/driven/persistence/execution-log-prisma.ts`: filtra `orderLineId` en `findLastStepPosition`; `listEntriesForOrders` selecciona `orderLineId`.
- `lib/modules/asignaciones/domain/conditioning-steps.ts`: `lineConditioningProgress(entries, orderLineId, stepsCount)`.
- `lib/modules/asignaciones/domain/{get-conditioning-order,finish-conditioning,record-conditioning-step}.ts`: el avance usa `lineConditioningProgress` con `summary.lineId`.
- `lib/modules/asignaciones/domain/start-assigned-order.ts`: retomar pasa el `lineId` de `findOnlyLine`.

**T5 — fotos y equipo por línea**
- `lib/modules/asignaciones/ports/step-evidence-repository.ts`: `StepEvidenceRow.orderLineId`; `listByLine`; `findById` y `delete` con `orderLineId`; `listByOrder` se queda (ver decisiones).
- `lib/modules/asignaciones/adapters/driven/persistence/step-evidence-prisma.ts`: `listByLine`, `findById`/`delete` por línea, slot libre de `insert` y búsqueda de `replace` por `orderLineId`.
- `lib/modules/asignaciones/ports/conditioning-team-repository.ts`: `listByLineInCompany` (sustituye a `listByOrderInCompany`) y tipo `ConditioningTeamMemberOfOrderRow` con `orderLineId`.
- `lib/modules/asignaciones/adapters/driven/persistence/conditioning-team-prisma.ts`: ídem.
- `lib/modules/asignaciones/domain/evidence-photos.ts`: `assertEvidenceComplete` y `readStepEvidence` reciben `orderLineId`.
- Casos de uso: `record-step-move`, `register-evidence`, `request-evidence-upload`, `remove-evidence` (usa `target.lineId`), `finish-packing`, `record-conditioning-step`, `get-conditioning-order`; y, por la firma de `evidence-photos`, también `finish-assigned-order`, `get-packing-order` y `get-assigned-order-execution`.
- `read-order-evidence.ts`: sin cambios (sigue por pedido, R34).

**Tests**
- Integración: `tests/integration/asignaciones/{step-evidence-repository,conditioning-team-repository,execution-log-read}.int.test.ts` (casos nuevos y firmas nuevas). Ningún `.int` nuevo: `aislamiento.json` no cambia.
- Unit con casos nuevos: `conditioning-steps`, `record-conditioning-step`, `finish-conditioning`, `get-conditioning-order`, `request-evidence-upload`, `execution-log-prisma`.
- Adaptados a las firmas: `tests/helpers/evidence-off.ts`, `tests/unit/asignaciones/{evidence-doubles,conditioning-doubles}.ts` y `{execution-log-repository,execution-trace,list-execution-traces,get-execution-trace,order-evidence,get-assigned-order-execution,get-packing-order,finish-assigned-order,finish-packing,record-step-move,record-step-move-evidence,register-evidence,remove-evidence,start-assigned-order,start-conditioning}.test.ts`.
- Sin tocar (R34): `get-order-evidence.test.ts`, `read-order-evidence.test.ts`, `order-evidence-actions.test.ts`, `get-execution-evidence.test.ts`, `order-evidence-doubles.ts`.

### Mapa R<n> → test

| R | Archivo | Caso |
|---|---|---|
| R13 | `tests/integration/asignaciones/execution-log-read.int.test.ts` | `R13: findLastStepPosition con dos lineas del mismo pedido solo mira la nombrada`; `R13: listEntriesForOrders dice de que linea es cada anotacion` |
| R13 | `tests/unit/asignaciones/execution-log-prisma.test.ts` | `R14, R13: la ultima fila con posicion de esa linea del pedido en esa empresa, …` |
| R13 | `tests/unit/asignaciones/start-assigned-order.test.ts` | `R13: EN_CURSO con ultima posicion 3 anota resume …` (ahora exige el `lineId`) |
| R13 | `tests/unit/asignaciones/conditioning-steps.test.ts` | `R13: las anotaciones de la otra linea del mismo pedido no cuentan ni como avance ni como responsables` |
| R13 | `tests/unit/asignaciones/record-conditioning-step.test.ts` | `R13: el avance de la otra receta del pedido no cuenta: …` |
| R13 | `tests/unit/asignaciones/finish-conditioning.test.ts` | `R13: los pasos completados de otra receta del pedido no cuentan para terminar esta` |
| R13 | `tests/unit/asignaciones/get-conditioning-order.test.ts` | `R13: el avance sale solo de las anotaciones de la linea del resumen, …` (también equipo y fotos por línea) |
| R13 | `tests/integration/asignaciones/step-evidence-repository.int.test.ts` | `R13: el tope de 3 fotos por paso es por receta; …`; `R13: findById, delete y replace con la otra receta no ven la foto ni la tocan`; `R13: la sustitucion conserva el slot dentro de la receta` |
| R13 | `tests/unit/asignaciones/request-evidence-upload.test.ts` | `R13: tres fotos del mismo paso en la otra receta del pedido no llenan el tope de esta`; `R13: sustituir una foto de la otra receta es evidence_not_found` |
| R13 | `tests/integration/asignaciones/conditioning-team-repository.int.test.ts` | `R13: con dos lineas del mismo pedido, el equipo de una no sale en la otra`; `R13: una linea de otro pedido o de otra empresa no trae equipo`; `R13: listByOrdersInCompany dice de que linea es cada miembro` |
| R34 | `get-order-evidence.test.ts`, `read-order-evidence.test.ts`, `order-evidence-actions.test.ts` | sin tocar y en verde |

### Salida real

- `pnpm run typecheck`: 0 errores.
- `pnpm run lint`: 0 errores, 11 avisos (los mismos de la Tanda 1, en líneas que esta tanda no toca).
- Unit: `pnpm exec vitest run tests/unit/asignaciones tests/unit/composition/asignaciones-facade.test.ts` → 119 archivos, 2716 en verde; tras añadir los R13, los 5 archivos con casos nuevos (`conditioning-steps`, `record-conditioning-step`, `finish-conditioning`, `get-conditioning-order`, `request-evidence-upload`) en verde (199 casos).
- R34, composición y UI: `tests/unit/asignaciones/{get-order-evidence,read-order-evidence,order-evidence-actions,get-execution-evidence}.test.ts tests/unit/composition tests/unit/identity/session-once-per-request-actions.test.ts tests/unit/inventario/producto-terminado/finished-product-route-contract.test.ts tests/unit/inventario-ui/{batch-evidence-dialog,finished-product-batches-evidence,finished-product-tables}.test.tsx tests/unit/asignaciones-ui` → 63 archivos, 1063 en verde.
- Integración: `pnpm exec vitest run tests/integration/asignaciones tests/integration/pedidos/finish-with-finished-goods.int.test.ts` → 30 archivos, 287 en verde.
- Guardias (`pnpm exec vitest run guard`): 87 archivos, 1335 en verde, 22 omitidos.

### Decisiones no cubiertas por el spec

1. **`StepEvidenceRepository.listByOrder` se queda.** La tabla del design la sustituye por `listByLine`, pero `readOrderEvidence` (la de `getOrderEvidence`, R34) la sigue usando y sus tests afirman `listByOrder(EMPRESA, PEDIDO, fase)`; quitarla obligaba a tocarlos. `readOrderEvidence` no cambia; su variante por línea queda para T10 (`getExecutionEvidence`).
2. **El avance se filtra en dominio** con `lineConditioningProgress`. `listEntriesForOrders` sigue por pedido porque Dashboard y Recorrido (T10) lo leen así.
3. **`ConditioningTeamRepository.listByOrderInCompany` se borra** (solo la usaban los dos casos de uso ya cambiados). `listConditioningTeams` sigue agrupando por pedido hasta T10.
4. **Llamadores forzados por la firma** de `evidence-photos` fuera de la lista de T5: `finish-assigned-order`, `get-packing-order` y `get-assigned-order-execution` pasan `summary.lineId`.
5. **Segunda línea en los `.int`:** `order_lines` tiene único `(order_id, original_recipe_id)`, así que la segunda receta se siembra con su propia receta.

### Bloqueos

Ninguno.

### Veredicto

Tanda 2 hecha: registro, fotos y equipo se leen por línea con el `lineId` que ya resuelven los casos de uso; typecheck, lint, tests tocados y guardias en verde.

## Notas para el reviewer (implementer, tandas 1 y 2)

1. **`findAliveLineSummary` pasa por el dominio.** El puerto `OrderSummaryReader` gana
   `findAliveLine`, porque `AssignedOrderSummary` necesita el nombre del envase
   (`PackagingCatalog`). Por eso se añadió `findAliveLineSummary` a `METODOS_DELEGADOS_EN_DOMINIO`
   en `tests/guards/guard-ambito-empresa-pedidos.test.ts`, el mismo patrón que sus hermanos.
2. **Outlines del pedido dado de baja (R24).** El adaptador elige las líneas con `deleted_at`
   igual al del pedido. El `.int` siembra la baja con líneas `PENDIENTE` y `BLOQUEADO`, porque el
   CHECK `order_lines_delivered_not_deleted` impide dar de baja un pedido con líneas `CANCELADO`.
3. **`StepEvidenceRepository.listByOrder` se conserva** junto a `listByLine`. La tabla de
   design § 3.3 lo sustituye, pero `readOrderEvidence` (de `getOrderEvidence`, R34) lo sigue usando
   y sus tests no se pueden tocar. La variante por línea de `readOrderEvidence` queda para T10.
4. **`ConditioningTeamRepository.listByOrderInCompany` se borra**, porque no le queda ningún
   llamador.
5. **El avance de acondicionamiento se filtra en el dominio** (`lineConditioningProgress`).
   `listEntriesForOrders` sigue leyendo por pedido para el Dashboard y el Recorrido (T10).
6. **Casos de uso fuera de la lista de T5:** `finish-assigned-order`, `get-packing-order`,
   `get-assigned-order-execution` y `start-assigned-order` (T4). Cambian por la nueva firma de
   `evidence-photos` y de `findLastStepPosition`, y pasan el `summary.lineId` de hoy.
7. **Aserciones existentes que cambiaron:**
   - T3: los dobles de `save-conditioning-batch-data`, `finish-conditioning` y
     `get-conditioning-order` incluyen ahora la línea;
   - T5: el fixture de `tests/unit/asignaciones/order-evidence.test.ts` (`groupEvidenceRows`, que
     no es un test de `getOrderEvidence`) gana `orderLineId`, porque el tipo lo exige.

   Los tests de `getOrderEvidence` (`get-order-evidence`, `read-order-evidence`,
   `order-evidence-actions`, `get-execution-evidence`) no se tocaron.
8. R32 y R34 no tienen test propio en estas tandas: el diff no toca `db/`, `package.json`,
   `read-order-evidence.ts` ni `batch-evidence-dialog.tsx`.

## Bloqueos

Ninguno en las tandas 1 y 2.

## Tanda 3 — T6 (backend_dev, 2026-11-09)

Grafo: sin proyecto indexado para este worktree; todo con Grep/Read. Sin migraciones, sin `db/`, sin dependencias, sin `app/` ni `components/`. No incluye nada de T8 (`recipe {position,count}`, `otherRecipes`, `recipeName`/`recipeCount`, outlines en `composeOrderRows`).

### Archivos

**Producción (`lib/`)**
- `lib/modules/asignaciones/domain/only-order-line.ts`: **borrado**.
- `lib/modules/asignaciones/domain/order-line-target.ts` (nuevo):
  - `orderLineInputSchema`: `{ orderId: uuid, lineId: uuid }`, estricto;
  - `findLine`: lee con `OrderCatalog.findAliveLineSummary`; `null` → `OrderNotFoundError`;
  - `lineAsTarget`: la línea como `OrderAssignmentTarget`, para aplicar `assertOrderAcceptsWrites` al estado de la línea.
- Casos de uso pasados a `{ orderId, lineId }`, con la puerta en el estado de la línea:
  - ejecución: `get-assigned-order-execution`, `start-assigned-order` (y `open-assigned-order` por herencia), `record-step-move`, `finish-assigned-order`;
  - cancelar: `cancel-assigned-order`, que usa `cancelLineAliveById`;
  - empaque: `start-packing`, `get-packing-order`, `finish-packing` (`counts[].presentationLineId` → `PackedLineCount.lineId`);
  - acondicionamiento: `start-conditioning` (con `conditioning-team.ts`: `startConditioningSchema` extiende `orderLineInputSchema`), `get-conditioning-order`, `finish-conditioning`, `record-conditioning-step`, `save-conditioning-batch-data`;
  - fotos: `evidence-target` (`resolveEvidenceTarget(deps, actor, orderId, lineId, phase)`), `register-evidence`, `request-evidence-upload`, `remove-evidence`.
- Vistas de lista con `lineId`:
  - los tipos: `assigned-order-view`, `company-order-view`, `finished-order-view`, `packing-order-view` (`PackingOrderRow`), `conditioning-order-view` (`ConditioningOrderRow`);
  - quien las compone: `list-assigned-orders`, `list-company-orders`, `list-finished-orders`, `list-conditioned-orders`. Las de empaque y acondicionamiento se componen en sus `*-order-view.ts`.
- Driving: `order-execution-actions.ts`, `order-packing-actions.ts`, `order-conditioning-actions.ts` y `step-evidence-actions.ts` (este, solo los tipos de entrada).
- `lib/shared/routes.ts`:
  - nuevos `RECIPE_PARAM`, `MANUFACTURED_ORDER_PARAM` y `OUTCOME_RECIPE_PARAM`;
  - los tres helpers con `lineId` obligatorio;
  - borrados `DELIVERED_ORDER_PARAM`, `DELIVERED_ORDER_PACKAGES_PARAM` y `DELIVERED_ORDER_PRODUCT_PARAM`;
  - corregido el comentario de `PACKED_ORDER_PARAM`.
- Comentarios corregidos:
  - `finishPackingAction`: «Deja la receta `POR_ACONDICIONAR`…»;
  - `finishAssignedOrderAction`: «Deja la receta `POR_EMPACAR`…»;
  - `PACKED_ORDER_PARAM`;
  - los JSDoc de los casos de uso tocados, de «pedido» a «receta» donde decide la línea.

**Tests**
- Nuevos:
  - `tests/unit/asignaciones/recipe-routes.test.ts`;
  - `tests/helpers/only-recipe-plant.ts`: puente para los `.int` de una sola receta. Si falta `lineId`, pone la única línea viva en la entrada. Los de varias recetas pasan `lineId` explícito.
- Ampliado: `tests/helpers/packed-counts.ts` (`packingCountsOfPlan`, con `presentationLineId`).
- Dobles: `tests/unit/asignaciones/{evidence-doubles,conditioning-doubles}.ts`. Ganan `findAliveLineSummary` con dos recetas en el mismo estado, y `lineaDe`/`otraLineaDe` devuelven un uuid en lugar de `linea-<id>`.
- Unit con casos nuevos y firmas nuevas:
  - fotos: `evidence-target`, `register-evidence`, `request-evidence-upload`, `remove-evidence`;
  - ejecución: `record-step-move`, `record-step-move-evidence`, `get-assigned-order-execution`, `open-assigned-order`, `start-assigned-order`, `finish-assigned-order`, `cancel-assigned-order`;
  - empaque: `get-packing-order`, `start-packing`, `finish-packing`;
  - acondicionamiento: `get-conditioning-order`, `start-conditioning`, `conditioning-team`, `finish-conditioning`, `record-conditioning-step`, `save-conditioning-batch-data`;
  - listas: `list-{assigned,company,finished,packing,conditioning,conditioned}-orders`;
  - permisos y acciones: `authorization`, `order-{execution,packing,conditioning}-actions`, `step-evidence-actions`.
- Fuera de `asignaciones`:
  - `tests/unit/identity/session-once-per-request-actions.test.ts`;
  - `tests/unit/pedidos-ui/order-route-contract.test.ts`;
  - `tests/unit/recetas-ui/recipe-route-contract.test.ts` (la lista cerrada de exportaciones de `routes.ts`).
- Integración: `tests/integration/asignaciones/{batch-states,conditioning-execution-log,conditioning-steps-progress,execution-atomicity,finish-auto-assign-packers,finish-conditioning-batch-data,finished-orders,order-lines-execution,responsible-eligibility,start-conditioning-team}.int.test.ts`. En `order-lines-execution`:
  - el caso de QT-313 «dos líneas en el mismo estado → `invalid_input`» se sustituye por dos: R11/R12 (comenzar la nombrada) y R14 (sin `lineId`);
  - se añade R16/R17: cancelar una receta desde la ejecución.
- Integración fuera de `asignaciones`: `tests/integration/pedidos/finish-with-finished-goods.int.test.ts` (los dos casos R26 pasan `lineId: await ensureOnlyLine(prisma, creado.id)` a `finishAssignedOrder`; el `orderCatalog` del archivo cablea `findAliveLineSummary` con `createFindAliveLineSummary` + `findAliveOrderLineSummary`, como `lib/composition`). Aserciones sin cambios; 33/33 verde. Ningún otro `.int` fuera de `asignaciones` llama a sus casos de uso (`cancel-line-from-execution` solo usa `withExecutionTransaction`).

### Mapa R<n> → test (T6)

| R | Archivo | Caso |
|---|---|---|
| R2 | `list-assigned-orders.test.ts` | `R2: dos recetas del mismo pedido salen como dos filas con el mismo id y su propio lineId` |
| R9 | `recipe-routes.test.ts` | `R9, R11: ejecucion, empaque y acondicionamiento nombran la receta con ?receta=<lineId>` (la 404 de la página es de T7) |
| R10 | `start-assigned-order.test.ts` | `R10: con el pedido PARCIAL y la receta EN_CURSO, abre la ejecucion y retoma por el estado de la receta`; `R10: con el pedido PARCIAL y la receta PENDIENTE, la comienza` |
| R10 | `get-assigned-order-execution.test.ts` | `R10: con el pedido PARCIAL y la receta EN_CURSO, la ejecucion abre por el estado de la receta` |
| R10 | `finish-assigned-order`, `finish-conditioning`, `record-conditioning-step`, `save-conditioning-batch-data`, `start-conditioning`, `finish-packing`, `cancel-assigned-order` | `R10: …con el pedido PARCIAL… el pedido no se lee` / `R10: la evidencia se exige por el estado y la persona de la receta` |
| R10 | `get-packing-order`, `start-packing`, `get-conditioning-order` | `R10: decide por el estado de la receta …` |
| R11, R12 | un `describe('… la receta nombrada …')` por caso de uso en `tests/unit/asignaciones/` | `R11, R12: con dos recetas … opera/lee solo la nombrada` |
| R11 | `order-execution-actions.test.ts`, `order-packing-actions.test.ts` | `R11: abrir/comenzar pasa { orderId, lineId } al caso de uso`; `R11, R26: …revalida la pantalla de esa receta`; `R11, R13: …counts…` |
| R11, R12 | `order-lines-execution.int.test.ts` | `R11, R12: con dos lineas PENDIENTE, comenzar la nombrada la deja EN_CURSO, la anota y no toca la otra` |
| R14 | los mismos archivos de unit | `R14: sin lineId, o con uno que no es uuid, da invalid_input sin tocar ningun puerto`; `R14: una receta de otro pedido, quitada o inexistente da order_not_found …` |
| R14 | `recipe-routes.test.ts`, `order-lines-execution.int.test.ts` | `R14: el lineId es obligatorio en los tres helpers`; `R14: sin lineId responde invalid_input sin escribir` |
| R15 | `get-assigned-order-execution`, `start-assigned-order`, `cancel-assigned-order`, `get-packing-order`, `start-packing`, `finish-packing`, `get-conditioning-order`, `start-conditioning`, `finish-conditioning`, `record-conditioning-step`, `save-conditioning-batch-data` | `R15: … sin el permiso no lee la receta` / `R15: quien es responsable del pedido puede … cualquiera de sus recetas`. Los casos de permiso de antes siguen verdes, sin cambios de permiso |
| R16 | `cancel-assigned-order.test.ts` | `R16: cancela solo la receta nombrada por cancelLineAliveById y anota en su registro` |
| R16, R17 | `order-lines-execution.int.test.ts` | `R16, R17: cancelar desde la ejecucion deja CANCELADO solo la receta nombrada, anota en su registro y la otra sigue` |
| R17 | `cancel-assigned-order.test.ts` | `R17: una receta en un estado no cancelable da not_cancellable sin anotar`; `R17: el motivo sigue siendo obligatorio y de 1 a 500 caracteres …` |
| R19 | `order-execution-actions.test.ts`, `recipe-routes.test.ts` | `R19: redirige a /asignacion?fabricado=<numero> …`; `R19: el aviso de fabricacion terminada se llama fabricado y ningun parametro dice «entregado»` |
| R20 | `recipe-routes.test.ts` | `R20: la receta del aviso viaja en receta_aviso …` (escribirlo es de T8) |

### Salida real

- `pnpm run typecheck`: 127 errores. **Ninguno en `lib/` ni en los tests de `lib/`**. Todos están en:
  - `app/`: 14;
  - `e2e/`: 64;
  - `tests/unit/asignaciones-ui/`: 40;
  - `tests/unit/paridad/`: 7;
  - `tests/unit/shared-ui/upload-evidence.test.ts`: 2.
- `pnpm run lint`: 0 errores y 11 avisos, los mismos de las tandas 1 y 2. Los avisos nuevos de esta tanda se limpiaron.
- Unit: `pnpm exec vitest run tests/unit/asignaciones tests/unit/pedidos tests/unit/composition tests/unit/identity/session-once-per-request-actions.test.ts tests/unit/pedidos-ui/order-route-contract.test.ts tests/unit/recetas-ui/recipe-route-contract.test.ts tests/unit/recetas/scope.test.ts` → 307 archivos: 6562 en verde, 9 rojos y 3 omitidos.
  - Los 9 rojos están **todos** en `tests/unit/asignaciones-ui/`. El filtro `tests/unit/asignaciones` también recoge esa carpeta.
  - Archivos: `assigned-orders-route-contract`, `asignacion-page`, `assigned-orders-delivered-notice`, `assignment-row-actions`, `conditioning-orders-list-section`, `packing-orders-list-section`. Son de T7.
- Integración: `pnpm exec vitest run tests/integration/asignaciones` → 29 archivos, 256 en verde.
- Guardias (`pnpm exec vitest run guard`): 87 archivos, 1335 en verde, 22 omitidos.
- `onlyLineOf` / `findOnlyLine`: no quedan en el repo fuera de `specs/` y `progress/`. Tampoco en `app/` ni `components/`.

### Decisiones no cubiertas por el spec

1. **`lineAsTarget`.** Se usa la tabla de `order-state.ts` (`assertOrderAcceptsWrites`) sobre la línea, como si el pedido tuviera una sola receta. Así no hay una segunda tabla de estados, y los errores siguen siendo los de hoy.
2. **`startAssignedOrder` deja de reintentar la «carrera de la vista».**
   - Antes, la vista leía el estado del pedido y después el resumen filtrado por ese estado. Si otro responsable arrancaba entre las dos lecturas, el resumen salía vacío.
   - Ahora la vista lee la línea con `findLine`, sin filtrar por estado, y esa ventana desaparece.
   - La carrera real la resuelve el `stale` de la transición, que relee con `findLine`, como pide § 3.4.
   - Los tests de la carrera vieja se sustituyen por dos de «la carrera se relee por la línea (R16)».
3. **Ningún caso de uso de T6 lee ya `findAliveById`.** Un pedido inexistente o de otra empresa, una línea quitada y una línea de otro pedido dan el mismo `order_not_found` por `findLine`. `start-packing` mantiene la distinción de hoy: con la línea viva en otro estado, responde `order_not_packable`.
4. **`OUTCOME_RECIPE_PARAM` está declarado, pero ninguna acción lo escribe todavía.** Hace falta `recipeName`/`recipeCount` del caso de uso, que es T8. `finishAssignedOrderAction` ya redirige con `MANUFACTURED_ORDER_PARAM`.
5. **`revalidatePath(packingOrderRoute(orderId, lineId))`, literal de design § 3.7**, e igual en acondicionamiento.
   - La ruta lleva la consulta (`?receta=`), pero la etiqueta de caché implícita de Next es el `pathname` sin consulta.
   - Dentro de una Server Action la llamada sigue marcando la ruta como revalidada, y la pantalla actual se refresca.
   - Conviene comprobar en E2E que la pantalla se repinta tras Comenzar y Guardar. Si no se repinta, se pasa a revalidar el `pathname`.
6. **`PackingFinishLineView.lineId` no se renombra.** Es la línea del reparto en la vista de Terminar, y § 3.4 solo renombra la entrada. La UI manda ese valor en `counts[].presentationLineId`.
7. **`StepEvidenceRepository.listByOrder` se queda** por `readOrderEvidence` (R34), como en la tanda 2.
8. **Puente `tests/helpers/only-recipe-plant.ts`** para los `.int` de una sola receta, en lugar de reescribir unas 60 llamadas. Los tests que prueban varias recetas o la falta de `lineId` no pasan por el puente.
9. **Corrección de typecheck (TS2345):** `finished-orders.int.test.ts` tipa `wireListFinishedOrders(tx)` como `FixtureTx['tx']` en lugar de `Parameters<typeof createOrderAssignmentRepository>[0]` (`PrismaLike | undefined`). El helper no cambia y el test tampoco cambia de comportamiento: 8/8 en verde.

### Bloqueos

Ninguno.

### Veredicto

T6 hecha: la receta viaja de punta a punta en `lib/` y la puerta es el estado de la línea. `lib/` y sus tests compilan y están en verde. Lo que queda en rojo es de UI y E2E: T7 y T13.

## Tanda 3 — T7 (frontend_dev, 2026-11-09)

Grafo: no se usó, porque este worktree no tiene proyecto indexado; todo con Grep/Read. No se tocó nada de `lib/`, `e2e/` ni dependencias. Tampoco nada de T8, T9 ni T11: no hay «Receta N de M», cabecera, otras recetas, avisos con receta, Dashboard ni Recorrido.

### Archivos

**Producción**
- Nuevo: `app/(private)/asignacion/components/recipe-param.ts` (`recipeLineIdOf`). Lee `?receta=`, que debe venir una sola vez y ser un uuid; si no, devuelve `null`. Se exporta en el barrel `components/index.ts`.
- Páginas:
  - `asignacion/[id]/page.tsx`, `empaque/[id]/page.tsx` y `acondicionamiento/[id]/page.tsx` leen `searchParams` y responden `notFound()` sin `lineId`. Si lo hay, llaman con `{ orderId, lineId }` (ejecución: `openAssignedOrderAction(id, lineId)`).
  - Empaque captura también `ValidationError`.
  - `asignacion/page.tsx` lee `MANUFACTURED_ORDER_PARAM` y deja de leer los `DELIVERED_ORDER_*`, que ya no existen.
- Tablas, `getRowId` por `lineId`: `assigned-`, `company-`, `finished-`, `packing-`, `conditioning-` y `conditioned-orders-table.tsx`.
- Enlaces con `…Route(row.id, row.lineId)`: `assigned-order-enter-trigger.tsx` (el id del aviso también va por `lineId`), `packing-`, `conditioning-` y `conditioned-orders-columns.tsx`.
- Ejecución:
  - `order-execution-screen.tsx` recibe la prop `lineId` y la pasa a `startAssignedOrderAction`, `recordStepMoveAction`, `useStepEvidence`, `OrderCancelDialog` y al campo oculto `lineId` del formulario de Terminar.
  - `order-cancel-dialog.tsx` recibe la prop `lineId` y la envía en un campo oculto.
  - Barrel: `ORDER_EXECUTION_LINE_ID_FIELD` y `ORDER_CANCEL_LINE_ID_FIELD`.
- Empaque:
  - `packing-order-screen.tsx`: campos `lineId` en Comenzar y Terminar. `PACKING_ORDER_LINES_FIELD` (`lines`) pasa a `PACKING_ORDER_COUNTS_FIELD` (`counts`). El conteo del diálogo se traduce a `{ presentationLineId, packedPackages, reason, reasonOther }`.
  - `packing-finish-dialog.tsx`: solo el comentario del tipo `PackingFinishSubmission`.
- Acondicionamiento:
  - `conditioning-actions`, `start-conditioning-dialog` y `finish-conditioning-dialog` reciben la prop `lineId` y envían su campo oculto. Barrel: `START_/FINISH_CONDITIONING_LINE_ID_FIELD`.
  - `conditioning-batch-data-form`: `CONDITIONING_BATCH_DATA_FIELDS.lineId`.
  - `conditioning-steps-panel`: `lineId` en `recordConditioningStepAction` y en las fotos.
  - `conditioning-order-screen`: pasa `order.lineId` a los tres.
- Fotos:
  - `app/(private)/asignacion/components/use-step-evidence.tsx`: opción `lineId`, que se usa en subir, registrar y quitar.
  - `components/shared/step-evidence/upload-evidence.ts`: `EvidenceUploadTarget.lineId`, que viaja al enlace firmado y al registro.

**Tests**
- Nuevo: `tests/unit/asignaciones-ui/recipe-rows.test.tsx`, para R2 y R4 en las seis tablas.
- Con casos R nuevos: `order-execution-page`, `packing-order-page`, `conditioning-order-page`, `assigned-order-enter-trigger`, `asignacion-page` y `assigned-orders-delivered-notice`.
- Actualizados a la firma nueva (`lineId` en las filas, props, `FormData` y hrefs):
  - `a11y-tactil`, `assigned-orders-can-execute`, `assigned-orders-columns` y `assigned-orders-route-contract`;
  - `assignment-row-actions`, `company-orders-columns` y `company-orders-list-section`;
  - `conditioning-batch-data-form`, `conditioning-order-screen`, `conditioning-orders-columns`, `conditioning-orders-list-section` y `conditioning-steps-panel`;
  - `finish-conditioning-dialog`, `finished-orders-columns` y `finished-orders-list-section`;
  - `order-cancel-dialog`, `order-execution-evidence`, `order-execution-screen`, `order-execution-step-log`, `order-execution-tools` y `order-execution-tools-panel`;
  - `packing-order-evidence`, `packing-order-screen`, `packing-orders-columns` y `packing-orders-list-section`;
  - `qc195-lineas-antiguas` y `start-conditioning-dialog`.
- Fuera de `asignaciones-ui`:
  - `tests/unit/paridad/{asignacion-paridad,asignacion-acondicionamiento-paridad,confirmaciones-paridad}.test.tsx` y sus `.snap`;
  - `tests/unit/shared-ui/upload-evidence.test.ts`;
  - `tests/unit/identity/session-once-per-request-render.test.tsx`: las dos páginas de detalle reciben `searchParams` con `receta`.

### Mapa R<n> → test (T7)

| R | Archivo | Caso |
|---|---|---|
| R2 | `recipe-rows.test.tsx` | `R2: «%s» pinta una fila por receta con el mismo número de pedido, sin claves repetidas` (las seis tablas) |
| R2, R4 | `recipe-rows.test.tsx` | `R2, R4: en «asignados» las dos filas del mismo pedido llevan a destinos distintos` |
| R4 | `recipe-rows.test.tsx` | `R4: «Por empacar» entra al empaque de cada receta, con ?receta=<lineId>`; `R4: «Por acondicionar» …`; `R4: «Acondicionados» …` |
| R4 | `assigned-order-enter-trigger.test.tsx` | `R4: lleva a la ejecucion de esa receta, con la receta en ?receta` |
| R9 | `order-execution-page.test.tsx` | `R9: %s responde 404 sin abrir ningun pedido` (falta, no es uuid o va repetido); `R9: con una receta ajena pinta lo mismo que un pedido inexistente, sin datos del pedido` |
| R9 | `packing-order-page.test.tsx` | `R9: pide getPackingOrder con el pedido y la receta de la direccion`; `R9: %s responde 404 sin leer ningun pedido`; `R9: con una receta ajena … responde 404`; `R9: un id que no es uuid (ValidationError) da el mismo 404` |
| R9 | `conditioning-order-page.test.tsx` | `R15, R9: pide getConditioningOrder con el actor, el pedido y la receta …`; `R9: %s responde notFound() sin leer ningun pedido`; `R9: con una receta ajena … responde el mismo notFound()` |
| R11 | `packing-order-screen.test.tsx` | `R11: ${caso.nombre}: confirmar envia el formulario con el pedido y la receta`; `R1, R16, R11: … el formulario lleva el conteo real en `counts`` |
| R11 | `order-execution-screen.test.tsx`, `order-execution-step-log.test.tsx`, `finish-conditioning-dialog.test.tsx`, `conditioning-batch-data-form.test.tsx` | `R11: el FormData … lleva pedido, receta y paso …`; `R17, R11 — …`; `R18, R11 — …`; `R27, R11: confirmar envía solo el pedido y la receta`; `R13, R11: envía orderId, lineId …` |
| R19 | `asignacion-page.test.tsx`, `assigned-orders-delivered-notice.test.tsx` | `R19: `fabricado` pinta el aviso de por empacar, sin envases ni producto`; `R19: `entregado` ya no pinta ningun aviso`; `R19: el parametro se llama `fabricado`, no `entregado`, y el aviso no habla de envases` |

### Salida real

- `pnpm run typecheck`: queda **65** errores.
  - `e2e/`: **64**, de T13 y sin tocar.
  - `tests/integration/asignaciones/finished-orders.int.test.ts(231,6)`: **1**, `TS2345 'PrismaLike | undefined' is not assignable to parameter of type 'Db'`. Viene de `onOnlyRecipe(…, tx)` (T6); ver Bloqueos.
  - `app/`, `components/`, `tests/unit/asignaciones-ui/`, `tests/unit/paridad/` y `tests/unit/shared-ui/upload-evidence.test.ts`: **0**.
- `pnpm run lint`: 0 errores y 11 avisos, los mismos de las tandas anteriores. Ninguno en archivos de esta tanda.
- Tests, por rutas y en lotes:
  - `tests/unit/asignaciones-ui/`, los 47 archivos más `recipe-rows`, en cuatro lotes de 11 a 14 archivos: todos en verde. Tras la última corrección de cada lote: 12 archivos y 171 tests; 13 y 209; 12 y 181; 11 y 201.
  - `tests/unit/paridad/{asignacion-acondicionamiento-paridad,asignacion-listas-paridad,confirmaciones-paridad}.test.tsx`: 3 archivos y 108 tests en verde, con 16 snapshots actualizados.
  - `tests/unit/paridad/asignacion-paridad.test.tsx`: 18 tests en verde. Snapshots actualizados por separado y vuelto a correr sin `-u`.
  - `tests/unit/shared-ui/upload-evidence.test.ts` y `tests/unit/identity/session-once-per-request-render.test.tsx`: en verde.
- Guardias (`pnpm exec vitest run guard`): 87 archivos; 1335 tests en verde y 22 omitidos.
- Snapshots: se revisó el diff antes de actualizar. Solo cambian tres cosas:
  - `data-testid="data-table-row-…"` y `data-table-card-…`, de `order-x` a `linea-order-x`;
  - el `href` de «Entrar», que gana `?receta=`;
  - los campos ocultos `lineId`.

### Decisiones no cubiertas por el spec

1. **Ejecución con receta ajena.** Hoy, ante un pedido inexistente, la página de ejecución pinta `OrderExecutionError` (`order_not_found`), no un 404. R9 pide responder «como hoy»:
   - sin `?receta`, con un valor que no es uuid o repetido, responde `notFound()` antes de llamar (design § 2);
   - con una receta ajena, pinta el mismo error que un pedido inexistente, sin datos del pedido.
   - En empaque y acondicionamiento las dos cosas dan 404, como hoy.
2. **Una sola pieza lee `?receta`.** `recipeLineIdOf` vive en el barrel de `asignacion/components`, porque la usan las tres páginas.
   - La de ejecución importa ahora ese barrel, que arrastra las secciones de lista.
   - Por eso su test añade `observabilidad` al doble de `@/lib/composition`, como ya hacían los demás tests de ese barrel.
3. **Aviso de fabricado en T7.** `asignacion/page.tsx` pasa a leer `MANUFACTURED_ORDER_PARAM`: los `DELIVERED_ORDER_*` ya no existen y la acción redirige con `fabricado`.
   - `OrderOutcomeNotice` no cambia: sigue con `kind="delivered"` y conserva su variante con envases. Pasar a `manufactured` y borrar esa variante es de T9.
   - Su test de componente con envases se mantiene. Se quitó el de página con envases, porque ya no hay parámetro que los lleve.
4. **El diálogo de Terminar empaque no cambia.** Sigue produciendo `PackedLineCount[]` (`lineId` de la línea del reparto). La pantalla lo traduce a `counts[].presentationLineId` al escribir el campo oculto (decisión 6 de T6).
5. **`EvidenceUploadTarget.lineId` es obligatorio** en `components/shared/step-evidence/upload-evidence.ts`. Las acciones lo exigen y su único consumidor (`use-step-evidence`) se actualizó.
   - No cambia la UI ni las props del catálogo: la fila de `CATALOGO.md` no nombra los campos del destino.
   - La guardia del catálogo sigue en verde.

### Bloqueos

- **Fuera de mi alcance, para backend_dev:** `tests/integration/asignaciones/finished-orders.int.test.ts(231,6)`, `TS2345 'PrismaLike | undefined' is not assignable to parameter of type 'Db'`.
  - Lo introdujo el cambio de T6 a `onOnlyRecipe({...}, tx)`.
  - No estaba en la lista de errores a resolver y es de la capa de integración de `lib/`.
- `e2e/`: 64 errores de typecheck, de T13 y sin tocar.

### Veredicto

T7 hecha: las tres pantallas exigen `?receta`, las seis listas tienen una fila por receta y todos los formularios mandan `lineId`; empaque manda `counts`. Lo que queda en rojo de typecheck es `e2e/` (T13) y un `.int` de T6.

## Tanda 3 — cierre (implementer, 2026-11-09)

### Verificación al cierre (corrida por el implementer)
- `pnpm run typecheck`: **64 errores, todos en `e2e/`**. Fuera de `e2e/`, 0.
- `pnpm run lint`: 0 errores, 11 avisos (los de siempre).
- `tests/unit/asignaciones-ui/`, 47 archivos en 4 lotes: 12/171, 11/191, 12/177 y 12/210 (archivos/tests), todo en verde.
- `tests/unit/asignaciones`, `tests/unit/paridad`, `tests/unit/shared-ui/upload-evidence.test.ts` y `tests/unit/pedidos`: 320 archivos, 6786 en verde, 3 omitidos.
- `tests/integration/asignaciones`, `tests/integration/pedidos` y `finished-batch-labels.int`: 104 archivos.
  - En la primera pasada salieron 992 en verde y 1 rojo, en `finish-with-finished-goods.int`: era un llamador de `finishAssignedOrder` sin `lineId`, que T6 no había adaptado.
  - Arreglado en el test; volví a correr ese archivo y da 33/33.
- `pnpm exec vitest run guard`: 87 archivos, 1335 en verde, 22 omitidos.
- Los comentarios de producción añadidos en `lib/`, `app/` y `components/` no citan R/QT/QC. Tampoco queda `onlyLineOf` ni `findOnlyLine` en el código.

### Notas para el reviewer (tanda 3)
1. **R9, receta ajena en ejecución.** `asignacion/[id]` pinta `OrderExecutionError`, igual que hoy un pedido inexistente en esa página, y no da 404. Sin receta, con una que no es uuid o con una repetida, sí es `notFound()`. En empaque y acondicionamiento las dos cosas dan 404.
2. **`OUTCOME_RECIPE_PARAM`** está declarado, pero ninguna acción lo escribe todavía: depende de `recipeName`, que es de T8. `OrderOutcomeNotice` sigue con `kind="delivered"`; el cambio es de T9.
3. **`revalidatePath` con `?receta=`**, tal como lo escribe design § 3.7. La etiqueta de caché de Next es el pathname, así que conviene comprobar en E2E que la pantalla se repinta.
4. **Puente de tests.** Los `.int` de una sola receta usan `tests/helpers/only-recipe-plant.ts`.
5. **Snapshots de paridad.** Se regeneraron `tests/unit/paridad/{asignacion-paridad,asignacion-acondicionamiento-paridad,confirmaciones-paridad}`. Solo cambian testids por `lineId`, el `href` con `?receta=` y los campos ocultos `lineId`.

## Bloqueos (tanda 3)

1. **El typecheck queda rojo en `e2e/` (64 errores en 20 specs).**
   - Vienen de `DELIVERED_ORDER_PARAM`, que ya no existe, y de los helpers de ruta, que ahora piden `(orderId, lineId)`.
   - Adaptar esos E2E es T13 (Tanda 6), que tengo prohibido tocar. Pero el «Hecho» de T7 pide «typecheck en verde con T6», y `tsconfig.json` incluye `**/*.ts`.
   - Por eso **T7 queda sin `[x]`**. Su trabajo está hecho y verde fuera de `e2e/`.
   - Decide el leader: adelantar a esta tanda el ajuste de tipos de `e2e/` (de T13) o aceptar el rojo hasta la Tanda 6. Con el rojo, `gate-completo` no pasa.
2. **T8 no se hizo.** La orden la pone en la Tanda 3, pero en `tasks.md` es de la Tanda 4 («No toques las tandas 4–6»), y depende del «Receta N de M» que consume T9. Queda pendiente para la Tanda 4.
