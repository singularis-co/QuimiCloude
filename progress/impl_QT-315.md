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

## Tanda 3 — ajuste de tipos de e2e/ (adelanto de T13)

Decision del leader: se adelanta de T13 solo el ajuste de tipos de `e2e/`. Una tanda no cierra con typecheck rojo y `tsconfig.json` incluye `**/*.ts`, asi que los 64 errores de `e2e/` (20 specs) bloqueaban el «Hecho» de T7.

Que se hizo (sin cambiar lo que comprueba cada spec):
- `assignedOrderRoute`, `packingOrderRoute` y `conditioningOrderRoute` reciben el `lineId`.
- Donde se comparaba `url.pathname === <ruta>(id)` se compara contra `pathOf(<ruta>(id, lineId))`: sigue comprobando la misma ruta, sin la consulta `?receta=`.
- `DELIVERED_ORDER_PARAM` pasa a `MANUFACTURED_ORDER_PARAM` en las esperas de la redireccion de Finalizar.
- Los 404 con un pedido inventado pasan `randomUUID()` tambien como `lineId`.

Como se obtiene el `lineId`:
- Si el spec siembra con `createOrderWithLine`, se usa `order.lineId` y se anade `lineId` al tipo de lo sembrado.
- Si el pedido nace por la UI o solo se tiene el id, se usa `firstLineIdOf(orderId)`: la linea viva de menor `position`.

Helper anadido: `e2e/helpers/recipe-route.ts` (`pathOf`, `firstLineIdOf`).

Archivos (20 specs + 1 helper): acondicionamiento, acondicionar-con-equipo, coste-real-de-produccion, datos-de-lote-en-acondicionamiento, ejecucion-receta, empaque, envases-del-pedido, envases-reales-empaque, operario-rediseno, pasos-de-acondicionamiento, pasos-de-envasado, pedido-con-varias-recetas, pedido-en-varias-presentaciones, pedidos-asignados, pedidos-terminados, producto-terminado, recetas-porcentaje, recorrido-acondicionamiento, registro-ejecucion, reserva-de-material (`e2e/*.spec.ts`).

Sigue en T13: el E2E de dos recetas y cualquier adaptacion de comportamiento. Por ejemplo, los avisos de vuelta a la lista que aun buscan el testid «delivered» o los textos de la entrega. No se corrio Playwright.

Verificacion:
- `pnpm run typecheck`: 0 errores.
- `pnpm run lint`: 0 errores, 11 warnings (ninguno en `e2e/`), «✖ 11 problems (0 errors, 11 warnings)».

## Tanda 3 — cierre definitivo (implementer, 2026-11-10)
- Por decisión del leader, el ajuste de tipos de `e2e/` (parte de T13) se adelantó a la Tanda 3, en el commit `93c8e2e4e`. Una tanda no cierra con el typecheck rojo, y `tsconfig.json` incluye `**/*.ts`. T13 conserva el E2E de dos recetas y los cambios de comportamiento.
- `pnpm run typecheck`: 0 errores. `pnpm run lint`: 0 errores, 11 avisos.
- `tests/integration/asignaciones` entera, después del arreglo de `finish-with-finished-goods.int`: 29 archivos, 256 en verde.
- T7 queda `[x]`. T8 se mueve a la Tanda 4, como decidió el leader. Los bloqueos de la Tanda 3 quedan resueltos.

## Tanda 4 — T8 (backend_dev, 2026-11-10)

Grafo: no consultado; todo con Grep/Read. Sin migraciones, sin `db/`, sin dependencias, sin `app/` ni `components/`. Nada de Dashboard ni Recorrido (T10–T12).

### Archivos

**Producción (`lib/`)**
- `lib/modules/asignaciones/domain/recipe-of-order.ts` (nuevo):
  - tipos `RecipePosition { position, count }`, `OtherRecipeView { lineId, recipeName, status }`, `RecipeOfOrderView`, `OutcomeRecipe { recipeName, recipeCount }`; constante `SINGLE_RECIPE` (1 de 1);
  - `readRecipeOutlines(orders, companyId, orderIds)`: UNA llamada a `listRecipeOutlinesByIdsIncludingDeleted`; con lista vacía no llama;
  - `recipePositionOf(outline, lineId)` y `otherRecipesOf(outline, lineId, names)`: orden por `position`, canceladas incluidas;
  - `readRecipeOfOrder(deps, companyId, orderId, lineId)`: outline + `recipes.findRefsIncludingDeleted` de las otras; sin otras, no llama;
  - `readOutcomeRecipe(deps, companyId, orderId, recipeId)`: nombre de la receta y número de recetas del outline.
- `compose-order-rows.ts`:
  - `ComposeOrderRowsDeps` gana `orders: Pick<OrderCatalog, 'listRecipeOutlinesByIdsIncludingDeleted'>`;
  - lee los outlines de la página en una llamada, y en la MISMA llamada de recetas pide los nombres de las filas y los de las otras recetas de sus pedidos;
  - `ComposedOrderRow` gana `recipe` y `otherRecipes`.
- Vistas de lista con `recipe: RecipePosition`:
  - tipos: `AssignedOrderView`, `CompanyOrderView`, `FinishedOrderView`, `PackingOrderRow`, `ConditioningOrderRow`;
  - quien las compone: `list-assigned-orders`, `list-company-orders`, `list-finished-orders`, `list-conditioned-orders`, `composePackingOrderRows` y la composición de `conditioning-order-view`.
- Vistas de detalle:
  - `AssignedOrderExecutionView` gana `lineId`, `recipe` y `otherRecipes`. Las compone `get-assigned-order-execution.ts` con `readRecipeOfOrder`; `start` y `open` las heredan;
  - `PackingOrderDetail` gana `otherRecipes`; `lineId` y `recipe` vienen de `PackingOrderRow`. La compone la nueva `composePackingOrderDetailRow` de `packing-order-view.ts`, que usa `get-packing-order.ts`. La fila de lista sigue sin `otherRecipes`;
  - `ConditioningOrderDetail` gana `otherRecipes` (`composeConditioningOrderDetail`).
- Resultados con `recipeName` y `recipeCount` (`OutcomeRecipe & { numberText }`):
  - `finish-assigned-order`, `cancel-assigned-order`, `finish-packing` y `finish-conditioning`;
  - los tres últimos ganan `recipes: Pick<RecipeCatalog, 'findRefsIncludingDeleted'>` en sus deps;
  - la lectura va después de las validaciones propias y antes de escribir.
- `lib/composition/index.ts`: `recipes: recipeCatalog` en `finishPacking`, `cancelAssignedOrder` y `finishConditioning`. Las listas ya recibían `orders: orderCatalog`.
- Driving: `adapters/driving/outcome-query.ts` (nuevo, sin `'use server'`).
  - `outcomeRoute(params, outcome)` añade `OUTCOME_RECIPE_PARAM` solo si `recipeCount > 1` y hay nombre;
  - lo usan `finishAssignedOrderAction`, `cancelAssignedOrderAction`, `finishPackingAction` y `finishConditioningAction`.
- `lib/modules/asignaciones/index.ts`: exporta los tipos `OtherRecipeView`, `OutcomeRecipe` y `RecipePosition`.

**Tests**
- Nuevos: `tests/unit/asignaciones/recipe-of-order.test.ts` y los dobles compartidos `tests/unit/asignaciones/recipe-outline-doubles.ts` (`outlinesDe`, `refsConNombre`, `conDosRecetas`, `conTresRecetas`, `recetaDeTres`).
- Casos nuevos en:
  - listas y detalles: `list-assigned-orders`, `get-assigned-order-execution`, `get-packing-order`, `get-conditioning-order`;
  - avisos: `finish-assigned-order`, `cancel-assigned-order`, `finish-packing`, `finish-conditioning`;
  - acciones: `order-execution-actions`, `order-packing-actions`, `order-conditioning-actions`.
- Adaptados a las vistas nuevas:
  - qué se cambió: dobles con `listRecipeOutlinesByIdsIncludingDeleted`/`findRefsIncludingDeleted`, `recipe: {1,1}`, `recipeName: null, recipeCount: 1`, listas de claves y los mocks de los casos de uso en las acciones;
  - archivos: `list-*-orders` (los seis), `get-{packing,conditioning}-order`, `get-assigned-order-execution`, `start-assigned-order`, `open-assigned-order`, `finish-*`, `cancel-assigned-order`, `conditioning-doubles.ts` y `order-*-actions`;
  - en `finish-packing`, el caso «R25, R42: las dependencias declaradas…» suma `recipes` y R20 en el nombre.
- Integración:
  - lector real de outlines en lugar del doble que lanzaba: `assigned-orders`, `batch-states`, `company-orders`, `finished-orders` y `responsible-eligibility` con `summaryReaders`; `pedidos/finish-with-finished-goods` importa el adaptador real;
  - `finish-auto-assign-packers` devuelve `[]`;
  - `finished-orders` cablea `recipes` en `finishPacking` y `finishConditioning`;
  - `tests/helpers/evidence-off.ts` (`recipesWithoutEvidence`) gana `findRefsIncludingDeleted: async () => []`;
  - `order-lines-execution`: el caso de cancelar (R16, R17) comprueba además `recipeCount: 2` y el nombre (R20).

### Mapa R<n> → test (T8)

| R | Archivo | Caso |
|---|---|---|
| R3 | `recipe-of-order.test.ts` | `R3, R7: una receta cancelada cuenta en M y las demas conservan su posicion`; `R3: una linea que el outline ya no trae se pinta como receta unica`; `R3: sin filas no lee outlines` |
| R3 | `recipe-of-order.test.ts` | `R2, R3: el numero de llamadas por pagina no crece con las filas y los outlines van en UNA llamada` |
| R3 | `list-assigned-orders.test.ts` | `R3: cada fila lleva su posicion y el total del pedido, canceladas incluidas; los outlines en UNA llamada` (con 1 y con 25 filas) |
| R7, R8 | `get-assigned-order-execution`, `get-packing-order`, `get-conditioning-order` | `R7, R8: trae su posicion, el total con la cancelada y las otras recetas en orden de alta` |
| R8 | `recipe-of-order.test.ts` | `R8: las otras recetas salen en orden de alta, con su nombre y su estado, canceladas incluidas`; `R8: composeOrderRows da las otras recetas de cada fila en orden de alta`; `R8: una receta que el catalogo no resuelve sale con nombre null` |
| R19 | `order-execution-actions.test.ts` | `R19: redirige a /asignacion?fabricado=<numero>…` (sigue verde con el resultado nuevo) |
| R20 | `recipe-of-order.test.ts` | `R20: da el nombre de la receta y el total de recetas, canceladas incluidas` |
| R20 | `finish-assigned-order`, `cancel-assigned-order`, `finish-packing`, `finish-conditioning` | `R20: devuelve … el nombre de la receta y cuantas tiene el pedido, canceladas incluidas` |
| R20 | `order-execution-actions.test.ts` | `R20: con mas de una receta, el aviso lleva el nombre de la receta en receta_aviso`; `R20: con mas de una receta, cancelar vuelve con el nombre de la receta cancelada` |
| R20 | `order-packing-actions`, `order-conditioning-actions` | `R20: con mas de una receta, el aviso de empacado/acondicionado lleva el nombre de la receta` |
| R20 | `order-lines-execution.int.test.ts` | `R16, R17, R20: cancelar desde la ejecucion … y el aviso trae la receta` |
| R29 | `recipe-of-order`, `list-assigned-orders`, `get-assigned-order-execution` | `R3, R29: un pedido de una sola receta da 1 de 1 y ninguna otra receta`; `R8, R29: con una sola receta no hay otras y no se piden nombres`; `R29: un pedido de una sola receta da 1 de 1`; `R29: con una sola receta, 1 de 1 y sin otras recetas` |
| R29 | `recipe-of-order`, `order-execution-actions` | `R20, R29: un pedido de una sola receta da recipeCount 1`; `R20, R29: con una sola receta, o sin nombre, el aviso no lleva receta_aviso` |

### Salida real

- `pnpm run typecheck`: 41 errores, **todos** en `tests/unit/asignaciones-ui/` (32) y `tests/unit/paridad/` (9).
  - Son fixtures que construyen vistas sin `recipe`, `otherRecipes` o `lineId`; la lista va en el informe al leader, para T9.
  - Ninguno en `lib/`, `app/`, `components/`, `e2e/`, `tests/integration/` ni `tests/unit/asignaciones/`.
- `pnpm run lint`: 0 errores y 11 avisos, los mismos de antes. Ninguno en archivos de esta tanda.
- Unit: `pnpm exec vitest run` con los 19 archivos tocados de `tests/unit/asignaciones/` → 668/668 en verde.
- Integración, por archivo: `assigned-orders` 7/7, `batch-states` 4/4, `company-orders` 4/4, `finish-auto-assign-packers` 3/3, `finished-orders` 8/8, `responsible-eligibility` 7/7, `order-lines-execution` 16/16, `execution-atomicity` 14/14, `pedidos/finish-with-finished-goods` 33/33.
- Guardias: `guard-arquitectura-modulos` y `guard-catalogo-de-errores` → 96/96.
- Fin de línea: 41 archivos tocados habían quedado en CRLF al editarlos; se normalizaron a LF, como en `HEAD`.

### Decisiones no cubiertas por el spec

1. **Nombres de las otras recetas en la misma llamada.** `composeOrderRows` añade a su única llamada de `findRefsIncludingDeleted` las recetas de los outlines. Así empaque y acondicionamiento sacan `otherRecipes` sin otra composición, y las listas no ganan llamadas.
2. **Línea ausente del outline** (se quitó entre las dos lecturas): se pinta como 1 de 1 y sin otras recetas, para no mostrar un «Receta N de M» incoherente.
3. **`recipeName` del aviso** sale de `findRefsIncludingDeleted`, incluida una receta dada de baja, con el mismo criterio que las listas. `recipeCount` son las recetas del outline, canceladas incluidas (P1); con el outline vacío vale 1.
4. **`OUTCOME_RECIPE_PARAM`** se escribe solo con `recipeCount > 1` **y** nombre resuelto (R20, R29). Sin nombre, el aviso nombra solo el pedido.
5. **La lectura del aviso va antes de escribir** y después de las validaciones propias de cada caso de uso. Así los errores de dominio salen igual que hoy, y el aviso no depende de leer tras el commit.
6. **`PackingOrderRow` (lista) no lleva `otherRecipes`.** Solo lo lleva `PackingOrderDetail`, como dice § 3.4.

### Bloqueos

Ninguno. Lo que queda rojo en typecheck son fixtures de UI (T9).

### Veredicto

T8 hecha. En `lib/` y sus tests todo en verde:
- las listas muestran «Receta N de M» y leen los outlines en una sola llamada;
- los detalles traen `lineId`, `recipe` y `otherRecipes`;
- los avisos traen `recipeName` y `recipeCount`, y las acciones escriben `receta_aviso`.

## Tanda 4 — T9 (frontend_dev, 2026-11-10)

Grafo: no se usó; todo con Grep/Read. No se tocó `lib/`, `e2e/`, `db/` ni las dependencias. Tampoco Dashboard, Recorrido ni `e2e/` (tandas 5-6).

### Archivos

**Producción (`app/(private)/asignacion/`)**
- Nuevos en `components/`:
  - `recipe-of-order-label.tsx`:
    - `RecipeOfOrderLabel` pinta «Receta N de M» y da `null` con una sola receta;
    - además `recipeOfOrderText`, `hasSeveralRecipes` y `RecipeNameWithPosition`, que es la celda «Receta» de las listas.
  - `recipe-header.tsx`:
    - `RecipeHeader` pinta fase · Pedido · Receta N de M, el `h1`, cantidad · reparto, el estado y la lista «Otras recetas del pedido»;
    - la función pura `otherRecipeHref(orderId, other, access)` sigue la tabla de design § 3.4;
    - exporta también `RecipeAccess` y `NO_RECIPE_ACCESS`.
  - `recipe-access.ts`: `recipeAccessOf(bearer)`. Usa `canExecuteAssignedOrders` y `resolveAssignmentViews` para no nombrar códigos de permiso fuera de `lib/`, como exigen las guardias de permisos.
- `components/operator-screen-frame.tsx`: prop opcional `heading`, en unión de tipos con la cabecera de hoy. Los consumidores de hoy no cambian.
- La celda «Receta» pinta `RecipeNameWithPosition` en `recipeColumn` (`components/assignment-list-parts.tsx`) y en `conditioning-orders-columns.tsx`. Con una receta, el DOM es el de hoy.
- `components/assigned-order-enter-trigger.tsx`: `aria-label` «Entrar a <receta> del pedido <n>» (`assignedOrderEnterLabel`), como el tablero.
- `components/order-outcome-notice.tsx`:
  - `delivered` pasa a `manufactured`, con testid `assigned-order-manufactured-notice`;
  - los cuatro textos aceptan la receta (design § 4.3);
  - se borra la variante con envases y producto.
- `page.tsx`: lee `OUTCOME_RECIPE_PARAM` y lo pasa a los cuatro avisos. Vacío cuenta como ausente.
- `[id]/components/order-cancel-dialog.tsx`, ahora «Cancelar esta receta»:
  - nombra la receta y el pedido, y avisa de que las demás recetas siguen;
  - el motivo lleva la ayuda «Entre 1 y 500 caracteres.»;
  - los botones son «Volver» y «Cancelar la receta»;
  - props nuevas: `recipeName` y `numberText`.
- Pantallas: `order-execution-screen.tsx`, `packing-order-screen.tsx` y `conditioning-order-screen.tsx` usan `RecipeHeader` vía `heading` y ganan la prop opcional `access`. La de ejecución gana además `StatusBadge` y `ORDER_EXECUTION_STATUS_TESTID`.
- Páginas: `[id]/page.tsx`, `empaque/[id]/page.tsx` y `acondicionamiento/[id]/page.tsx` pasan `access={recipeAccessOf(...)}`.
- Barriles: `components/index.ts` y `[id]/components/index.ts`.

**Tests**
- Nuevos: `tests/unit/asignaciones-ui/recipe-header.test.tsx` y `tests/unit/asignaciones-ui/recipe-screens.test.tsx`.
- Renombrado: `assigned-orders-delivered-notice.test.tsx` pasa a `assigned-orders-manufactured-notice.test.tsx`. Pierde los casos de envases, que se fueron con la variante, y gana casos R19 y R20.
- Con casos nuevos: `recipe-rows.test.tsx` (R3, R29, R30), `order-cancel-dialog.test.tsx` (R18) y `asignacion-page.test.tsx` (R20).
- Los 41 errores de typecheck de T8:
  - las fixtures ganan `recipe: { position: 1, count: 1 }`, `otherRecipes: []` y `lineId` donde faltaba;
  - `twoRecipes` de `recipe-rows` da 1 de 2 y 2 de 2.
- Fixtures sin tipo que fallaban al ejecutarse:
  - `order-execution-page`, `packing-order-page`, `conditioning-order-page` y `packing-orders-list-section`;
  - `paridad/asignacion-paridad`;
  - `marca/tablas-marca`, que además gana `lineId`: le faltaba desde T7.
- Ajustes:
  - `packed-order-notice`: el kind y el testid;
  - `assigned-orders-columns`: el nombre accesible del «Entrar» bloqueado;
  - `paridad/confirmaciones-paridad`: las props del diálogo.
- Snapshots de paridad: 18 regenerados, después de revisar el diff:
  - `asignacion-paridad` (1): el «Entrar» de «Mis asignados» gana el `aria-label` «Entrar a Jarabe simple del pedido 2026-000123», en la tabla y en la tarjeta. Nada más;
  - `confirmaciones-paridad` (4):
    - «¿Cancelar el pedido?» pasa a «Cancelar esta receta» en el título y en el disparador;
    - «Cancelar pedido» pasa a «Cancelar la receta» en el botón de confirmar;
    - entran la descripción con la receta y el pedido, y la ayuda del motivo con su `aria-describedby`;
  - `asignacion-acondicionamiento-paridad` (13, empaque y acondicionamiento):
    - la cabecera pasa a `RecipeHeader`, con el eyebrow «<Fase> · Pedido <n>»;
    - el `h1` y los testids son los mismos;
    - empaque gana cantidad · reparto en la cabecera;
    - con una receta no aparecen «Receta N de M» ni «Otras recetas».

### Mapa R<n> → test (T9)

| R | Archivo | Caso |
|---|---|---|
| R3 | `recipe-rows.test.tsx` | `R3: «%s» pinta «Receta 1 de 2» y «Receta 2 de 2» en la tabla` (seis listas) |
| R3, R30 | `recipe-rows.test.tsx` | `R3, R30: «%s» en el telefono, cada tarjeta lleva su «Receta N de M»` |
| R3, R29 | `recipe-rows.test.tsx` | `R3, R29: «%s» con una sola receta no pinta «Receta 1 de 1»` |
| R30 | `recipe-rows.test.tsx` | `R30: en el telefono, el «Entrar» de la tarjeta de «asignados» mide 44 × 44 px y nombra la receta` |
| R30 | `recipe-header.test.tsx` | `R30: el «Ir a esta receta» tiene 44 × 44 px y la fila se apila en el telefono` |
| R7 | `recipe-header.test.tsx` | `R7: nombra la fase, el pedido, «Receta N de M», …`; `R7: con la receta dada de baja, …` |
| R7 | `recipe-screens.test.tsx` | `R7: $nombre nombra la fase, el pedido, «Receta 1 de 3», …` (ejecución, empaque, acondicionamiento) |
| R8 | `recipe-header.test.tsx` | cabecera: `R8: lista las otras recetas …`; `R8: «Ir a esta receta» lleva …` |
| R8 | `recipe-header.test.tsx` | destino: `R8: $status lleva a su pantalla` (seis estados) |
| R8 | `recipe-header.test.tsx` | sin permiso: `R8: $status sin el permiso de su pantalla no ofrece enlace`; `R8: sin el permiso de la pantalla, …` |
| R8 | `recipe-header.test.tsx` | sin enlace (CANCELADO, TERMINADO, BLOQUEADO, ENTREGADO): `R8: %s no ofrece enlace ni con todos los permisos`; `R8: la fila %s sale con su nombre y su estado, sin «Ir a esta receta»` |
| R8 | `recipe-header.test.tsx` | `recipeAccessOf` (2 casos) |
| R8 | `recipe-screens.test.tsx` | `R8: $nombre lista las otras recetas, …`; `R8: $nombre sin el permiso de la ejecucion …`; `R8: $nombre sin permisos pasados …`; `R8: empaque y acondicionamiento llevan a su pantalla, …` |
| R29 | `recipe-header.test.tsx`, `recipe-screens.test.tsx` | `R29: con una sola receta no hay «Receta 1 de 1» ni «Otras recetas»`; `R29: $nombre con una sola receta …` |
| R18 | `order-cancel-dialog.test.tsx` | `R18: el menu ofrece «Cancelar esta receta» y el dialogo nombra …`; `R18: el FormData lleva el pedido, la receta, el paso y el motivo`; `R18: con la receta dada de baja, …` |
| R19 | `assigned-orders-manufactured-notice.test.tsx` | parámetro y testid: `R19: el parametro se llama `fabricado`, …`; `R19: el testid del aviso no se llama «entregado»` |
| R19 | `assigned-orders-manufactured-notice.test.tsx` | texto: `R19, R20: con `receta_aviso`, el aviso de fabricada …`; `R19: sin receta pinta el aviso de siempre, sin envases` |
| R19 | `assigned-orders-manufactured-notice.test.tsx` | `R19: «$kind» no dice «entregado», con receta ni sin ella` (los cuatro avisos) |
| R20 | `assigned-orders-manufactured-notice.test.tsx` | `R20: con `receta_aviso`, el aviso de cancelada …`; `R20: «$kind» con receta nombra la receta y el pedido` (los cuatro avisos) |
| R20, R29 | `assigned-orders-manufactured-notice.test.tsx` | `R20, R29: «$kind» sin receta nombra solo el pedido`; `R20, R29: con `receta_aviso` vacio, …` |
| R20 | `asignacion-page.test.tsx` | `R20: con `receta_aviso`, los avisos de empacada y acondicionada llevan la receta` |
| R31 | `recipe-screens.test.tsx` | `R31: $nombre no ofrece entregar la receta ni el pedido` (las tres pantallas) |
| R31 | `recipe-screens.test.tsx` | `R31: %s no nombra ninguna accion de entrega` (páginas, pantallas, cabecera y menú de fila) |

### Salida real

- `pnpm run typecheck`: 0 errores. `tsc --noEmit` no da salida.
- `pnpm run lint`: `✖ 11 problems (0 errors, 11 warnings)`. Son los 11 avisos de antes; ninguno en archivos de esta tanda.
- `pnpm exec vitest run <rutas>`: 1308 en verde y 1 en rojo, `tests/unit/recetas/module-contract.test.ts` (ver Bloqueos). Las rutas fueron:
  - los 60 archivos que montan las piezas tocadas;
  - los dos nuevos;
  - `asignaciones/module-contract`, `identity/roles/acondicionamiento-rol` y `marca/tablas-marca`.
- Paridad (`asignacion-paridad`, `asignacion-acondicionamiento-paridad` y `confirmaciones-paridad`), con `-u` después de revisar el diff: `Snapshots 18 updated`, `Tests 107 passed (107)`.
- `pnpm exec vitest run guard`:
  - todo en verde salvo `tests/unit/recetas/scope.test.ts` (ver Bloqueos);
  - `guard-asignacion-componentizada` 22/22, tras corregir dos comentarios sin tilde.
- Fin de línea: todos los archivos tocados quedan en LF.

### Decisiones no cubiertas por el spec

1. **`RecipeHeader` entra por una prop `heading` de `OperatorScreenFrame`.** Es el paso 2: una extensión opcional.
   - Así la cabecera, con su `h1` único, queda dentro del encabezado del marco, y el cuerpo de cada pantalla no cambia.
   - La lista «Otras recetas» va dentro del encabezado, como en el tablero. Con varias recetas, el encabezado fijo crece.
2. **Los permisos de «Ir a esta receta» los calcula la página** con `recipeAccessOf` y los baja como `access` (booleans serializables).
   - La ejecución lee la sesión con `identity.getSessionUser()`, que está memoizada por petición.
   - Empaque y acondicionamiento reusan el `actor` que ya tenían.
   - Sin `access`, las pantallas no ofrecen ningún enlace.
3. **«Cancelar esta receta» se queda en el menú ⋯ de la cabecera**, donde estaba «Cancelar pedido». Cambian los textos, no el sitio.
4. **El `aria-label` del «Entrar»** solo se pone cuando la fila trae `numberText`. Con la receta dada de baja dice «Entrar al pedido <n>».
5. **Empaque gana cantidad · reparto en la cabecera** (R7), aunque el cuerpo siga mostrando la cantidad y el reparto de hoy.
6. **El testid del aviso de fabricada pasa a `assigned-order-manufactured-notice`**, porque R19 pide que el aviso no se llame «entregado».

### Bloqueos

1. **Las guardias de `recetas` están en rojo**: `tests/unit/recetas/module-contract.test.ts` y `tests/unit/recetas/scope.test.ts`.
   - Marcan como «segunda pantalla de recetas» cualquier `page.tsx` fuera de `produccion/formulas` que contenga `recet|recipe`.
   - `empaque/[id]/page.tsx` y `acondicionamiento/[id]/page.tsx` ya estaban en rojo desde T7: en `HEAD` contienen `recipeLineIdOf`.
   - Esta tanda suma `asignacion/page.tsx`, porque design § 4.3 exige leer `OUTCOME_RECIPE_PARAM` ahí.
   - No he tocado las guardias. Ampliar `PANTALLAS_AUTORIZADAS` lo decide el leader o el humano.
2. **E2E (T13)**:
   - `e2e/ejecucion-receta`, `empaque`, `producto-terminado` y `reserva-de-material` buscan `assigned-order-delivered-notice`, que ahora es `assigned-order-manufactured-notice`;
   - también cambian los E2E que buscan «Cancelar pedido» en la ejecución.

### Veredicto

T9 hecha:
- las listas muestran «Receta N de M» en la tabla y en la tarjeta;
- la cabecera de receta lista «Otras recetas», con «Ir a esta receta» según el estado y el permiso;
- la ejecución tiene el diálogo «Cancelar esta receta»;
- los avisos son `manufactured` y llevan la receta.

Typecheck en 0. Queda en rojo la guardia de `recetas` (bloqueo 1).

## Tanda 4 — estado al cortar (implementer, 2026-11-10)
- T8 y T9 están implementadas y commiteadas como trabajo en curso, **sin `[x]`**.
- **Verificación de cierre incompleta.** La corrida se cortó por falta de memoria del sistema. Antes del corte:
  - el diff de `lib/`, `app/` y `components/` no cita R/QT/QC;
  - `pnpm run typecheck` da 0 errores.

  Quedan sin correr en el cierre: lint, `asignaciones-ui` en lotes, `tests/unit/asignaciones`, los `.int` de `asignaciones` y las guardias. Los subagentes sí corrieron por ruta los archivos que tocaron (ver T8 y T9).
- **Bloqueo: guardias de `recetas` en rojo**, fuera de `tests/baseline-rojos.json`:
  - `tests/unit/recetas/scope.test.ts` («la pantalla de recetas vive solo donde la declara…»);
  - `tests/unit/recetas/module-contract.test.ts` («la feature no añade ningún route handler…»).

  Las dos buscan `/recet|recipe/i` en el código de cualquier `page.tsx` fuera de `produccion/formulas` y lo tratan como «segunda pantalla de recetas».
  - `empaque/[id]/page.tsx` y `acondicionamiento/[id]/page.tsx` están en rojo **desde T7** (`fe1186ead`, ya publicado), por `recipeLineIdOf`. En la Tanda 3 no se vio: `vitest run guard` no recoge `tests/unit/recetas/`, y esa carpeta no estaba en las rutas del cierre.
  - T9 añade `asignacion/page.tsx`, por `OUTCOME_RECIPE_PARAM`, que pide design § 4.3.
  - Ponerlas en verde exige ampliar `PANTALLAS_AUTORIZADAS` (`module-contract`) y el conjunto cerrado de `scope`. Es cambiar una regla de guardia, como ya se hizo con QC-180: lo decide el leader o el humano.
- **Para T13** (E2E):
  - el testid del aviso pasa a `assigned-order-manufactured-notice`;
  - `ejecucion-receta`, `empaque`, `producto-terminado` y `reserva-de-material` todavía buscan `assigned-order-delivered-notice`;
  - «Cancelar pedido» pasa a «Cancelar esta receta».
