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

Ajuste posterior: el doble de `finishPacking` en `tests/unit/asignaciones/authorization.test.ts` recibe `recipes.findRefsIncludingDeleted` y `orders.listRecipeOutlinesByIdsIncludingDeleted`, los dos vacíos. Ninguna aserción cambia; el archivo pasa en verde (41/41). Ese archivo no tiene dobles de `finishConditioning` ni de `cancelAssignedOrder`.

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

## Tanda 4 — ampliacion de guardias de recetas

- **Que:** `PANTALLAS_AUTORIZADAS` (`tests/unit/recetas/module-contract.test.ts`) y `PANTALLA_DE_EJECUCION` (`tests/unit/recetas/scope.test.ts`) pasan de DOS a CINCO literales: entran `app/(private)/asignacion/page.tsx`, `app/(private)/asignacion/empaque/[id]/page.tsx` y `app/(private)/asignacion/acondicionamiento/[id]/page.tsx`. Comentario «AMPLIADA el 2026-11-10 (QT-315, planta-con-varias-recetas)» en ambos sitios. Mismo formato que cada Set (POSIX en `module-contract` via `toPosix`; `join` en `scope`), asi casa igual en Windows y Linux. Criterio de las guardias sin tocar; se sigue aplicando `consumesOnlyPublicContract`.
- **Por que:** decision del humano (2026-11-10), como en QC-180: las tres paginas solo leen la receta de la ruta (`?receta=`), no editan recetas.
- **Resultado** (`pnpm exec vitest run tests/unit/recetas/scope.test.ts tests/unit/recetas/module-contract.test.ts`): `module-contract` en verde (todo); `scope` sigue con 1 rojo en el mismo `it` («la pantalla de recetas vive solo donde la declara…»), pero en OTRA asercion: la lista cerrada de E2E de recetas (linea ~283) recibe ademas `helpers/recipe-route.ts` (`e2e/helpers/recipe-route.ts`, tanda 3/4). Queda fuera del mandato de esta tanda (no se cambia otra regla de guardia): lo decide el leader o el humano (ampliar la lista cerrada de E2E o renombrar/mover el helper para que no case).
- Total: 1 failed | 9 passed (10).
- 2026-11-10 (backend_dev, decision del humano: opcion (a)): la lista CERRADA de specs E2E de `tests/unit/recetas/scope.test.ts` suma `'helpers/recipe-route.ts'` como ultima entrada (orden de `readdirSync`), sin cambiar regex ni recorrido; `pnpm exec vitest run tests/unit/recetas/scope.test.ts` -> 5 passed (5).

## Tanda 4 — verificación de cierre, en serie (implementer, 2026-11-10)
- `pnpm run typecheck`: 0 errores.
- `pnpm run lint`: 0 errores, 11 avisos.
- `tests/unit/recetas`: 81 archivos, 1361 en verde, **1 rojo** (`scope.test.ts`, ver Bloqueos).
- `tests/unit/asignaciones-ui`, 49 archivos en 4 lotes: 186, 196, 184 y 278 tests, todo en verde.
- `tests/unit/asignaciones`: 123 archivos.
  - La primera pasada dio 2923 en verde y 1 rojo: el doble de `finishPacking` en `authorization.test.ts` no tenía la dependencia `recipes` que añadió T8.
  - Arreglado solo en el doble; ese archivo da 41/41 al volver a correrlo.
- `tests/integration/asignaciones`: 29 archivos, 256 en verde.
- `pnpm exec vitest run guard`: 87 archivos, 1335 en verde, 22 omitidos.
- T8 y T9 quedan **sin `[x]`** por el rojo de `scope.test.ts`.

### Bloqueos (tanda 4)
1. **`tests/unit/recetas/scope.test.ts` sigue en rojo, en el mismo `it`, pero por otra comprobación.**
   - Es la lista CERRADA de «specs E2E de recetas» (~l. 283), que filtra los archivos de `e2e/` con `/recet|recipe/i`.
   - Ahora encuentra `helpers/recipe-route.ts`: es el helper del ajuste de tipos de `e2e/` (`93c8e2e4e`) y no es un spec ni toca la pantalla de recetas.
   - Hay dos salidas, y las dos exigen una decisión:
     - (a) ampliar esa lista con el helper, que es otra ampliación de guardia;
     - (b) renombrar el helper sin «recipe» (p. ej. `e2e/helpers/line-route.ts`), que esquiva la guardia sin cambiar su criterio.
   - No hice ninguna de las dos.

## Tanda 4 — cierre (implementer, 2026-11-10)
- Por decisión del humano (opción a), la lista cerrada de E2E de `tests/unit/recetas/scope.test.ts` gana `helpers/recipe-route.ts`. El criterio de la guardia no cambia y el helper no se renombra.
- `tests/unit/recetas`: la primera pasada dio 1361 en verde y 1 rojo: un timeout de 20 s en `recetas-ui/formula-import-review.test.tsx`.
  - Ese archivo da 34/34 cuando corre solo, y esta feature no lo toca.
  - En la segunda pasada de la carpeta entera: **81 archivos, 1362 en verde**.
- `pnpm run typecheck`: 0 errores.
- El resto del cierre de la Tanda 4 está en «verificación de cierre, en serie», todo en verde.
- T8 y T9 quedan `[x]`. Los bloqueos de la Tanda 4 quedan resueltos.

## Tanda 5 — T10 (backend_dev, 2026-11-10)

### Archivos

**Producción (`lib/`)**
- `lib/modules/asignaciones/domain/execution-trace.ts`: `combineDurations(durations[])` exportada (la regla «abierta gana a sin cerrar, sin cerrar gana a cerrada»); `sumDurations` la usa. `buildExecutionTrace` no cambia de firma.
- `lib/modules/asignaciones/domain/list-execution-traces.ts`:
  - `ExecutionTraceRow` pierde `presentations` y gana `moreRecipes`, `progress: OrderProgress` y `recipes: ExecutionTraceRowRecipe[]` (`{ recipeName, presentations }`);
  - el catálogo pasa de `listDeliveryProgressByIdsIncludingDeleted` a `listRecipeOutlinesByIdsIncludingDeleted` (vía `readRecipeOutlines`, una llamada por página);
  - helpers nuevos exportados: `NO_PROGRESS`, `OrderContents`/`listOrderContents`, `recipesInOrder`, `groupEntriesByLine`, `traceRecipes`, `isOrderActive`, `entriesSpan`, `signerIds`;
  - `listConditioningTeams` recibe las anotaciones y devuelve el equipo **por `lineId`**, solo de las líneas con `conditioning_start`;
  - `toTracePresentations` recibe las `presentationLines` de una receta.
- `lib/modules/asignaciones/domain/get-execution-trace.ts`: `ExecutionTraceRecipe` nuevo; `ExecutionTraceDetail` según design § 3.6; `GetExecutionTraceDeps = ListExecutionTracesDeps & { units }`.
- `lib/modules/asignaciones/domain/order-evidence.ts`: tipos `RecipeEvidence`, `ExecutionEvidence`, `ExecutionEvidenceRead`.
- `lib/modules/asignaciones/domain/read-order-evidence.ts`: `readOrderEvidenceByLine` (nueva); `readOrderEvidence` se reparte en helpers privados sin cambiar su resultado ni el orden de las firmas.
- `lib/modules/asignaciones/domain/get-execution-evidence.ts`: usa `readOrderEvidenceByLine` y devuelve `ExecutionEvidenceRead`.
- `lib/modules/asignaciones/adapters/driving/execution-trace-actions.ts`: `ExecutionEvidenceResult.data` pasa a `ExecutionEvidence`.
- `lib/modules/asignaciones/index.ts`: exporta `ExecutionTraceRowRecipe`, `ExecutionTraceRecipe`, `ExecutionEvidence`, `ExecutionEvidenceRead`, `RecipeEvidence`.
- `lib/composition/index.ts`: `getExecutionTrace` recibe `recipes`, `presentations` y `units`.

**Tests**
- `tests/unit/asignaciones/list-execution-traces.test.ts`: dobles de outline en vez de reparto; claves de la fila; describe nuevo «un pedido de varias recetas».
- `tests/unit/asignaciones/get-execution-trace.test.ts`: `montar` con outline de una receta por defecto (estado de la línea = estado del pedido), catálogos y unidades; helper `unica()` para la sección única; describe nuevo «una seccion por receta».
- `tests/unit/asignaciones/get-execution-evidence.test.ts`: una aserción adaptada a `recipes[0]`; describe nuevo «las fotos por receta».
- **No se tocan:** los tests de `getOrderEvidence`, `readOrderEvidence` y `countOrderEvidence` (R34), ni `app/`, `components/`, `tests/ui`, `tests/fixtures`, `tests/unit/paridad`, `e2e/`, guardias ni snapshots.

### Mapa R → test

| R | Archivo | Caso |
|---|---|---|
| R21 | `list-execution-traces.test.ts` | `R21, R22, R23, R27: un PARCIAL con una fase abierta en una receta y cerrada en la otra suma y queda abierto`; `R21, R22: la primera receta y el orden de las presentaciones salen por orden de alta, no por el del outline` |
| R22 | `list-execution-traces.test.ts` | los dos de R21 (presentaciones agrupadas por receta, en orden de alta) |
| R23 | `list-execution-traces.test.ts` | `R21, R22, R23, R27: …` (abierta + cerrada = abierta, suma); `R23: con las dos recetas cerradas la suma es cerrada` |
| R24 | `list-execution-traces.test.ts` | `R24: un pedido dado de baja toma las recetas del outline de la baja y ninguna fase queda abierta` |
| R24 | `get-execution-trace.test.ts` | `R24: un pedido dado de baja muestra las recetas que tenia al darse de baja, sin ninguna fase abierta` |
| R25 | `get-execution-trace.test.ts` | `R25, R27: un PARCIAL de dos recetas mide cada fase con el estado de su linea y suma la duracion`; `R25: una receta sin anotaciones no tiene seccion pero cuenta en el avance`; `R25: las secciones van en orden de alta aunque las anotaciones lleguen en otro orden` |
| R25 | `get-execution-evidence.test.ts` | `R25: un pedido sin fotos da la lista de recetas vacia y no firma` |
| R26 | `get-execution-trace.test.ts` | `R26: equipo y responsables por receta: nada de una seccion pasa a la otra` |
| R26 | `get-execution-evidence.test.ts` | `R26: cada receta trae solo sus fotos, y una sola firma para todas`; `R26: con la firma caida cada receta conserva sus grupos y su cifra, sin fotos` |
| R26 | `list-execution-traces.test.ts` | `R26: el equipo de una receta sin Comenzar no entra en la fila` |
| R27 | `get-execution-trace.test.ts` | `R25, R27: un PARCIAL de dos recetas …` (fase abierta en una, cerrada en otra) |
| R27 | `list-execution-traces.test.ts` | `R21, R22, R23, R27: un PARCIAL …` |
| R28 | `get-execution-trace.test.ts` | `R28: una receta cancelada con anotaciones tiene su seccion, Cancelado y su linea de tiempo hasta la cancelacion` |
| R29 | `list-execution-traces.test.ts` | `R29: un pedido de una sola receta da la misma fila que su unico recorrido, sin «+N más»` |
| R29 | `get-execution-trace.test.ts` | `R29: un pedido de una receta da una sola seccion con el mismo recorrido de siempre`; además, todos los casos previos del archivo pasan por la sección única |
| R29 | `get-execution-evidence.test.ts` | `R29: un pedido de una receta da una sola entrada con las mismas fotos de siempre` |
| R34 | `get-order-evidence.test.ts`, `read-order-evidence.test.ts`, `count-order-evidence.test.ts` | sin tocar, en verde |

### Salida

- `pnpm exec vitest run tests/unit/asignaciones/list-execution-traces.test.ts tests/unit/asignaciones/get-execution-evidence.test.ts`: 2 archivos, **77/77**.
- `pnpm exec vitest run tests/unit/asignaciones/get-execution-trace.test.ts`: **37/37**.
- `pnpm exec vitest run tests/unit/asignaciones/get-order-evidence.test.ts tests/unit/asignaciones/read-order-evidence.test.ts tests/unit/asignaciones/count-order-evidence.test.ts tests/unit/asignaciones/execution-trace.test.ts tests/unit/asignaciones/execution-trace-actions.test.ts tests/unit/composition/asignaciones-facade.test.ts tests/unit/dashboard-route-contract.test.ts`: 7 archivos, **157/157**.
- `pnpm exec vitest run tests/guards/guard-arquitectura-modulos.test.ts tests/guards/guard-qc261-limites-de-la-ficha.test.ts`: 72 en verde, 1 omitido.
- `pnpm run lint`: 0 errores, 14 avisos, ninguno en archivos de esta tanda.
- `pnpm run typecheck`: **`lib/` y los tests de `lib/` limpios**. Quedan 44 errores, todos de T11 (`app/`, `tests/ui`, `tests/fixtures`, `tests/unit/paridad`); lista abajo.

### Errores de typecheck para T11

- `app/(private)/dashboard/components/execution-trace-columns.tsx:145, 148`: `ExecutionTraceRow.presentations` ya no existe → `recipes[].presentations`.
- `app/(private)/dashboard/recorrido/[id]/components/execution-timeline.tsx:253, 254`: `ExecutionEvidence.manufacturing` y `.conditioning` → `recipes[].evidence.*`.
- `app/(private)/dashboard/recorrido/[id]/components/execution-trace-detail.tsx:125` (`durations`), `:129` (`goBackCount`), `:132` (`steps`) → por sección en `recipes[]`; `:133, 134` (`ExecutionEvidence.packing`).
- `tests/fixtures/execution-trace-conditioning.ts:160, 184, 206, 224` (`steps` en `ExecutionTraceDetail`) y `:248` (`presentations` en `ExecutionTraceRow`).
- `tests/unit/paridad/recorridos-paridad.test.tsx:72, 87`: `presentations`.
- `tests/ui/dashboard/dashboard-rediseno.test.tsx:76, 92, 108`: `presentations`.
- `tests/ui/dashboard/execution-trace-detail.test.tsx`: `:79` `durations`; `:216, 505, 508, 667, 670` `steps` (y `:505` `step` implícito `any`); `:311` `goBackCount`; `:701, 720, 729, 748, 777, 810`: el `data` del resultado de evidencia tiene forma `OrderEvidence`, no `ExecutionEvidence`.
- `tests/ui/dashboard/execution-trace-evidence.test.tsx:78` `durations`; `:96` falta `recipes` en `ExecutionEvidence`.
- `tests/ui/dashboard/execution-trace-table.test.tsx:72, 91, 107, 125`: `presentations`.
- `tests/ui/dashboard/recorrido-rediseno.test.tsx:255` `durations`; `:357` `goBackCount`.
- `tests/ui/dashboard/textos-dashboard.test.tsx:164, 180` `presentations`; `:266` `durations`.

### Decisiones no cubiertas por el spec

1. **Sin outline, `progress` es `{ total: 0, finished: 0 }`** (`NO_PROGRESS`). Solo pasa si el catálogo no devuelve el outline de un pedido que sí devolvió el resumen.
2. **Una línea con anotaciones que el outline no trae** (quitada antes de la baja, por ejemplo):
   - en el Dashboard cuenta en la fila: se mide con el estado del pedido y va al final;
   - en el Recorrido no tiene sección, porque las recetas del pedido son las del outline (R24).
   - Con un outline completo no hay diferencia. Si conviene igualarlo, es una línea en `traceRecipes`.
3. **`recipes[]` de la fila incluye las canceladas**, como `moreRecipes`, porque el outline las trae y R22 habla de «sus recetas». `progress` no las cuenta.
4. **`active`, `firstAt` y `lastAt` son de nivel pedido.** `active` sale del estado del pedido (un `PARCIAL` está activo). `firstAt` y `lastAt` son el mínimo y el máximo de todas sus anotaciones, en la fila y en el detalle.
5. **`people` de la fila**: quien firma, en el orden del registro, y después el equipo de cada receta con Comenzar anotado, en orden de alta. El equipo de una línea sin `conditioning_start` ya no entra aunque otra receta del pedido sí tenga Comenzar.
6. **Fotos por línea sin leer el outline**:
   - `readOrderEvidenceByLine` usa los tres `listByOrder` de siempre y agrupa por `orderLineId`, con una sola firma para todas;
   - salen solo las líneas con fotos, en el orden de su primera foto, y la UI las cruza con las secciones por `lineId`;
   - no se usa `listByLine`, que haría 3 × N consultas.
7. **`getExecutionEvidence` devuelve `{ evidence: { recipes }, signingFailure }`**. Se mantiene el envoltorio para que la acción siga mandando la firma caída al log. La acción devuelve `data: ExecutionEvidence` (`{ recipes }`), la forma del design.
8. **`unitLabel` del detalle**: `symbol ?? name` de la unidad (`unitLabelOf`), igual que las listas.

### Bloqueos

- Ninguno en `lib/`. El typecheck global queda rojo hasta T11 (lista de arriba).
- No se tocó ninguna guardia ni ningún snapshot. `tests/unit/paridad/__snapshots__/recorridos-paridad.test.tsx.snap` puede cambiar cuando T11 adapte la vista.

Veredicto: T10 hecha en `lib/` con sus tests en verde. El typecheck global espera a T11.

## Tanda 5 — T11 (frontend_dev, 2026-11-10)

### Archivos

**Suben a `components/shared`** (fila en `CATALOGO.md` en el mismo cambio)
- `components/shared/order-progress.tsx`: movido desde `app/(private)/pedidos/components/order-progress.tsx` (borrado). Misma API; la entrada pasa a `OrderProgressValue = { finished; total }` estructural, sin importar `pedidos`.
- `components/shared/recipes-first-more.tsx` (nuevo): «primera receta +N más», sacado de `OrderRecipesCell`. Props `first`, `moreCount`, `firstTestId`, `moreTestId`, `texts.more`.
- `components/shared/CATALOGO.md`: filas de `OrderProgress` y `RecipesFirstMore` (Diseño: `PedidosVariasRecetas.dc.html`, `PlantaVariasRecetas.dc.html`).

**Pedidos (sin cambio visible)**
- `app/(private)/pedidos/components/order-columns.tsx`: `OrderRecipesCell` usa `RecipesFirstMore` con los testids de siempre (`order-recipes-first`, `order-recipes-more`); `OrderProgress` desde shared.
- `app/(private)/pedidos/components/order-detail-sheet.tsx`: `OrderProgress` desde shared.
- `app/(private)/pedidos/components/index.ts`: deja de exportar `OrderProgress` y sus constantes.

**Dashboard**
- `app/(private)/dashboard/components/execution-trace-columns.tsx`: «Fórmula» con `RecipesFirstMore` («+N más», testid `execution-trace-more-recipes`); columna nueva «Avance» (`TRACE_PROGRESS_COLUMN_ID`) tras «Fórmula» con `OrderProgress` corto; «Presentaciones» agrupadas por receta (`groupedPresentationsText`, separador « · »).
- `app/(private)/dashboard/components/execution-trace-table.tsx`: la tarjeta del teléfono lleva «Avance» como primer dato de `meta`.
- `app/(private)/dashboard/components/index.ts`: exporta `TRACE_PROGRESS_COLUMN_ID`, `TRACE_PROGRESS_LABEL`, `TRACE_RECIPE_GROUP_SEPARATOR`, `groupedPresentationsText`.

**Recorrido**
- `.../recorrido/[id]/components/execution-trace-detail.tsx`: resumen (`execution-trace-summary`: Estado, Avance largo, Duración total) y una `ExecutionTraceRecipeSection` por `trace.recipes`; `evidenceOfLine` cruza las fotos por `lineId` (sin entrada → evidencia vacía; error → se pasa a cada sección).
- `.../execution-trace-recipe-section.tsx` (nuevo, paso 3 · componer): `section` con `h2` del nombre, `StatusBadge` de la línea, «cantidad · reparto · duración · vueltas atrás N», duraciones por fase, `ExecutionTimeline` y `TracePackingEvidence` de esa línea.
- `.../execution-trace-stat.tsx` (nuevo, interno): `Stat`, `DurationValue`, `PhaseDuration` y `STAT_GRID_CLASS`, sacados de `execution-trace-detail.tsx` para usarlos en el resumen y en la sección.
- `.../execution-timeline.tsx`: `evidence` pasa a `TraceEvidenceResult` (fotos de una receta o el error); props `headingId` y `headingLevel` (ids únicos con varias líneas de tiempo).
- `.../trace-packing-evidence.tsx`: prop `headingLevel` (h3 dentro de la sección).
- `.../index.ts`: reexporta las piezas nuevas.

**Tests**
- `tests/fixtures/execution-trace-recipes.ts` (nuevo): `oneRecipeTrace`, `onlyRecipe`, `withSteps`, `oneRecipeRowFields` para llevar los dobles de una receta a la forma nueva.
- Adaptados a la forma nueva (los 44 errores): `tests/fixtures/execution-trace-conditioning.ts`, `tests/ui/dashboard/{dashboard-rediseno,execution-trace-detail,execution-trace-evidence,execution-trace-table,recorrido-rediseno,textos-dashboard}.test.tsx`, `tests/unit/paridad/recorridos-paridad.test.tsx`.
- Imports de `OrderProgress` a shared: `tests/unit/pedidos-ui/{order-progress,order-detail-sheet,order-cards,order-columns}.test.tsx` (en `order-progress.test.tsx` sobra el doble de las actions: ya no se importa el barril).
- Nuevo: `tests/ui/dashboard/planta-varias-recetas.test.tsx` (12 casos).

### Mapa R → test (UI)

| R | Archivo | Caso |
|---|---|---|
| R21 | `tests/ui/dashboard/planta-varias-recetas.test.tsx` | `R21: una fila por pedido, con «Parcial» en tono progress, la primera receta, «+1 más» y el avance «1 de 2» con su barra`; `R21: la cabecera de la tabla tiene la columna «Avance» después de «Fórmula»`; `R21: un pedido de una receta no lleva «+N más» y su avance es «0 de 1»`; `R21: en el teléfono la tarjeta lleva el avance con su barra` |
| R22 | `tests/ui/dashboard/planta-varias-recetas.test.tsx` | `R22: las presentaciones salen agrupadas por receta en orden de alta, unidas con « · » y sin sumar` |
| R25 | `tests/ui/dashboard/planta-varias-recetas.test.tsx` | `R25: el resumen lleva el estado, el avance «F de T terminadas» y la duración total`; `R25: una sección por receta, en orden de alta, …`; `R25: una receta sin anotaciones no tiene sección pero cuenta en el avance`; `R25: cada sección lleva su propia línea de tiempo, …` |
| R26 | `tests/ui/dashboard/planta-varias-recetas.test.tsx` | `R26: ninguna sección muestra anotaciones, fotos ni presentaciones de otra receta`; `R26: una receta sin fotos en la lectura no hereda las de otra` |
| R28 | `tests/ui/dashboard/planta-varias-recetas.test.tsx` | `R28: la receta cancelada se muestra «Cancelado» con su línea de tiempo hasta la cancelación` |
| R29 | `tests/ui/dashboard/*` adaptados | los casos previos del Dashboard y del Recorrido pasan con la fila y la sección única (`oneRecipeTrace`, `oneRecipeRowFields`) |

### Salida

- `pnpm run typecheck`: **0 errores** (antes 44).
- `pnpm exec vitest run tests/ui/dashboard/planta-varias-recetas.test.tsx`: 1 archivo, **12/12**.
- `pnpm exec vitest run tests/ui/dashboard/execution-trace-detail.test.tsx tests/ui/dashboard/execution-trace-table.test.tsx tests/ui/dashboard/dashboard-rediseno.test.tsx tests/ui/dashboard/textos-dashboard.test.tsx`: 4 archivos, **101/101**.
- `pnpm exec vitest run tests/ui/dashboard/execution-trace-evidence.test.tsx tests/ui/dashboard/recorrido-rediseno.test.tsx tests/ui/dashboard/trace-evidence-placement.test.ts` (dentro de una tanda de 7 archivos; los 3 en verde).
- `pnpm exec vitest run tests/unit/pedidos-ui/order-progress.test.tsx tests/unit/pedidos-ui/order-detail-sheet.test.tsx tests/unit/pedidos-ui/order-cards.test.tsx tests/unit/pedidos-ui/order-columns.test.tsx`: 4 archivos, **133/133**.
- `pnpm exec vitest run tests/guards/guard-catalogo-de-componentes.test.ts tests/guards/guard-qc261-limites-de-la-ficha.test.ts`: **69 en verde, 1 omitido**.
- `pnpm exec vitest run` de `guard-pedidos-rediseno`, `guard-pantalla-pedidos-se-amplia`, `guard-piezas-base`, `guard-arquitectura-modulos`, `guard-asignacion-componentizada`, `guard-tests-de-arbol-en-el-gate`, `guard-anillo-de-foco`, `guard-contrato-listados`, `guard-dependencias-aprobadas`: 9 archivos, **149 en verde, 3 omitidos**.
- `pnpm exec vitest run tests/unit/paridad/recorridos-paridad.test.tsx`: **6 en verde, 3 en rojo por snapshot** (ver abajo). No se corrió `-u`.
- `pnpm run lint`: 0 errores, 14 avisos (los mismos de antes, ninguno en archivos de T11).

### Snapshots y guardias afectados

- **Guardias:** ninguna en rojo y ninguna editada.
- **Snapshot en rojo, sin actualizar:** `tests/unit/paridad/__snapshots__/recorridos-paridad.test.tsx.snap`, los 3 casos `paridad del detalle del recorrido con acondicionamiento > … — terminado | en curso | anterior`. Los 6 del Dashboard (`con filas`, cargando, vacío, sin resultados, dos errores) siguen en verde. Lo que cambia en el detalle:
  - el primer `dl` gana `data-testid="execution-trace-summary"` y pasa a «Estado», «Avance» (`OrderProgress` largo, `role=img` «F de T terminadas» con su barra) y «Duración» (`execution-trace-total-duration`, total del pedido); salen de él las duraciones por fase y «Vueltas atrás»;
  - entra una `section role=region` con el nombre de la receta: `h2` con el nombre, insignia del estado de la línea, `p` «cantidad · reparto · duración · vueltas atrás N», un `dl` con las duraciones por fase (mismos `execution-trace-duration`) y la línea de tiempo;
  - la línea de tiempo pasa dentro de la sección: «Anotaciones» de `h2` a `h3` y `aria-labelledby` de `execution-trace-annotations` a `execution-trace-annotations-<lineId>`; las anotaciones no cambian.
  - Lo decide el leader: es el cambio del design § 4.5.

### Decisiones

1. **Las duraciones por fase se quedan dentro de cada sección.** El design § 4.5 no las nombra, pero R29 pide que un pedido de una receta siga dando lo de hoy, con las marcas «En curso» y «Sin cierre anotado». La duración de la cabecera de la sección va sin sufijo (`formatElapsed`), como pide la regla previa de no repetir «(en curso)» en el detalle. Las marcas del total del resumen usan `execution-trace-total-open|unclosed`, así no chocan con las de fase.
2. **«Vueltas atrás»** pasa de dato del resumen a la cabecera de la sección («vueltas atrás N», como el tablero), con la misma insignia que antes.
3. **«Avance» en el Dashboard** va tras «Fórmula». No se reordenan las demás columnas: el tablero tiene otro orden, pero T11 solo pide añadir la columna. En el teléfono va como primer dato `meta` de la tarjeta. La fórmula no se añade a la tarjeta, porque no estaba y T11 no lo pide.
4. **Presentaciones:** dentro de una receta, «, » como hasta ahora; entre recetas, « · ». Una receta sin presentaciones no deja hueco.
5. **Fotos por `lineId`:** una línea sin entrada en `recipes` recibe evidencia vacía; con el error de lectura, cada sección pinta su aviso de error.
6. **`execution-trace-stat.tsx`** es un subcomponente interno sacado del detalle, sin UI nueva. `TracePackingEvidence` y `ExecutionTimeline` ganan `headingLevel` (y la segunda `headingId`), y sus usos actuales no cambian.
7. **Cantidad de la sección:** `formatDecimalDisplay(quantity)` + `unitLabel`, como las listas de Asignación.

### Bloqueos

- Ninguno en código. Queda pendiente la decisión del leader sobre los 3 snapshots del detalle (arriba).

Veredicto: T11 hecha, con typecheck 0, lint sin errores y los tests de T11, Pedidos y guardias en verde. Quedan en rojo 3 snapshots del detalle del Recorrido, pendientes del leader.

## Tanda 5 — estado al cortar (implementer, 2026-11-10)
- **Snapshots de `tests/unit/paridad/recorridos-paridad.test.tsx`.** El leader los acepta: R29 exceptúa «la sección única del Recorrido» y R25 pide un resumen más una sección por receta.
  - Regenerados solo los de ese archivo (`-u`): 3 actualizados, 9/9 en verde.
  - El diff neto, sin contar la sangría, es este:
    - el resumen `execution-trace-summary`, con Avance (`order-progress`), `execution-trace-total-duration` y `execution-trace-total-open`; sustituye a `execution-trace-stat`;
    - un `section` por receta, con nombre en `h2`, `execution-trace-recipe-status` y la línea «cantidad · reparto · duración · vueltas atrás» (design § 4.5);
    - Anotaciones pasa de `h2` a `h3`, y su `aria-labelledby` lleva el `lineId`.
  - Las entradas de la línea de tiempo no cambian.
- `order-progress.tsx` queda registrado en git como rename: `app/(private)/pedidos/components/` → `components/shared/`.
- `pnpm run typecheck`: 0 errores.
- `pnpm run lint`: 0 errores.
  - Los avisos habían subido de 11 a 14. Los 3 nuevos eran de T10: `_companyId` sin usar en los dobles de `tests/unit/asignaciones/get-execution-trace.test.ts` (l. 143, 147 y 151).
  - Ya están quitados. `eslint` de ese archivo sale sin avisos y el archivo da 37/37. El lint global no se ha vuelto a correr.
- El diff de `lib/`, `app/` y `components/` no cita R/QT/QC.
- **Corte por memoria.** El sistema mató `pnpm exec vitest run tests/unit/asignaciones`, el primer comando de tests del cierre.
  - Quedan sin correr: `tests/unit/asignaciones`, `tests/integration/asignaciones`, `tests/ui/dashboard`, `tests/unit/pedidos-ui`, `tests/unit/paridad`, `tests/unit/recetas` y `guard`.
  - T10 y T11 quedan **sin `[x]`**.

## Tanda 5 — reanudación del cierre (implementer, 2026-11-10, con `--maxWorkers=2`)
- `tests/unit/asignaciones`, 74 archivos en 3 lotes de 30, 30 y 14: 1030, 648 y 419 tests, todo en verde.
- `tests/integration/asignaciones`: 29 archivos, 256 en verde.
  - La primera pasada la corrí, por error, a la vez que `tests/ui/dashboard`, y las dos escribían en el mismo archivo de salida. La descarté y repetí cada una sola.
- `tests/ui/dashboard`: 8 archivos, 164 en verde.
- `tests/unit/pedidos-ui`, 66 archivos en 2 lotes de 33: 571 en verde; 518 en verde y 3 omitidos.
- **Corte por memoria en `pnpm exec vitest run --maxWorkers=2 tests/unit/paridad`**: 44 archivos, en una sola corrida y sin partir.
  - Quedan sin correr: `tests/unit/paridad`, `tests/unit/recetas`, `guard --maxWorkers=2` y el lint global.
  - T10 y T11 siguen sin `[x]`.

## Tanda 5 — cierre en lotes de 15, `--maxWorkers=1` (implementer, 2026-11-10)
- `tests/unit/paridad`, 22 archivos en 2 lotes: 351 y 60 tests, todo en verde. No ha cambiado ningún snapshot más.
- `tests/unit/recetas` + `tests/unit/recetas-ui`, 81 archivos en 6 lotes: 221, 220, 192 + **1 rojo**, 249, 297 y 182.
- `pnpm exec vitest run guard --maxWorkers=1`: 87 archivos, 1335 en verde, 22 omitidos.
- `pnpm run lint`: 0 errores, 11 avisos, otra vez los de siempre.
- Antes, en la reanudación con `--maxWorkers=2`, ya estaban en verde `tests/unit/asignaciones`, `tests/integration/asignaciones`, `tests/ui/dashboard` y `tests/unit/pedidos-ui`.

### Bloqueo (tanda 5)
- **`tests/unit/recetas/scope.test.ts` está en rojo** («la pantalla de recetas vive solo donde la declara…»), esta vez por la comprobación de `components/` (~l. 203).
  - El mensaje es «componente de recetas encontrado bajo components/: `components/shared/recipes-first-more.tsx`».
  - La comprobación busca `/recet|recipe/i` en los archivos de `components/` y no admite excepciones.
- La pieza la exige el spec. T11 dice «`OrderProgress` y `RecipesFirstMore` suben a `components/shared`», y design § 7 lo repite.
- Por regla del leader, no se amplía ninguna guardia sin su decisión. No se ha tocado nada.
- Hay dos salidas:
  - (a) añadir a esa comprobación una lista cerrada con `components/shared/recipes-first-more.tsx`, como en las ampliaciones anteriores;
  - (b) que el spec cambie el nombre de la pieza.
- T10 y T11 quedan **sin `[x]`**.

## Tanda 5 — ampliacion de la guardia de components/

- `tests/unit/recetas/scope.test.ts`: lista cerrada `COMPONENTES_PERMITIDOS` con solo `components/shared/recipes-first-more.tsx` (ruta relativa normalizada a `/`), decision del humano (salida a); motivo: pieza compartida "primera receta +N mas" pedida por T11 / design § 7, no es pantalla de recetas; criterio sin cambios; `pnpm exec vitest run --maxWorkers=1 tests/unit/recetas/scope.test.ts` -> 1 archivo, 5/5 tests en verde.

## Tanda 5 — cierre (implementer, 2026-11-10)
- La guardia de `components/` de `scope.test.ts` admite `components/shared/recipes-first-more.tsx` (opción (a), decisión del humano). El criterio no cambia.
- `tests/unit/recetas/scope.test.ts`: 5/5.
- `tests/unit/recetas` + `recetas-ui`, 81 archivos en 6 lotes con `--maxWorkers=1`: 221, 220, 193, 249, 297 y 182 tests, **todo en verde**.
- `pnpm run typecheck`: 0 errores.
- Las demás corridas del cierre siguen en verde y no se han repetido porque esta ampliación solo toca `scope.test.ts`:
  - `tests/unit/asignaciones`, `tests/integration/asignaciones`, `tests/ui/dashboard`, `tests/unit/pedidos-ui` y `tests/unit/paridad`;
  - `guard`: 87 archivos;
  - lint: 11 avisos.
- T10 y T11 quedan `[x]`. Los bloqueos de la Tanda 5 quedan resueltos.

## Tanda 6 — T13 (frontend_dev, 2026-11-10)

Solo se adaptan los E2E. No se tocan `lib/`, `app/`, `components/` ni `tests/`, y no entra el E2E de dos recetas (T12).

### Archivos (`e2e/`)
- `ejecucion-receta.spec.ts`, `empaque.spec.ts`, `producto-terminado.spec.ts`, `reserva-de-material.spec.ts`: el testid del aviso pasa de `assigned-order-delivered-notice` a `assigned-order-manufactured-notice` (la constante pasa a `MANUFACTURED_NOTICE_TESTID`). Lo que se comprueba sigue igual: número del pedido y «por empacar».
- `registro-ejecucion.spec.ts`: el ítem del menú ⋯ pasa de «Cancelar pedido» a «Cancelar esta receta» y el botón del diálogo a «Cancelar la receta» (`ORDER_CANCEL_TEXTS`).
- `operario-rediseno.spec.ts`:
  - el nombre del diálogo de cancelar pasa a «cancelar esta receta»;
  - las filas y tarjetas de «Mis asignados» y «Por acondicionar» (R21, QC-269) se buscan por `lineId`, porque `getRowId` es ya la línea.
- `pedidos-terminados.spec.ts`: `rowDomIndex` recibe `firstLineIdOf(orderId)`, porque la fila de «Terminados» es la de la receta.
- `recorrido-ejecucion.spec.ts`, `recorrido-acondicionamiento.spec.ts`: hay una sola `section` `execution-trace-recipe-section`; las anotaciones (y en acondicionamiento las tres duraciones por fase) se buscan dentro de ella.
- `dashboard-rediseno.spec.ts`: `steps()` busca la línea de tiempo dentro de la sección de la receta.

### Resultado (`pnpm exec playwright test <spec> --workers=1`, un spec cada vez)

| Spec | chromium | webkit |
|---|---|---|
| recorrido-ejecucion | 4/0/0 | 4/0/0 |
| recorrido-acondicionamiento | 1/0/0 | 1/0/0 |
| dashboard-rediseno | 5/1/0 | 4/2/0 |
| ejecucion-receta | 4/0/0 | 4/0/0 |
| empaque | 1/0/0 | 1/0/0 |
| producto-terminado | 1/0/0 | 1/0/0 |
| reserva-de-material | 1/0/0 | 1/0/0 |
| operario-rediseno (2.ª corrida, tras el ajuste a `lineId`) | 20/0/0 | 20/0/0 |
| pedidos-terminados | 4/0/0 | 4/0/0 |
| acondicionamiento | 3/0/0 | 3/0/0 |
| acondicionar-con-equipo | 1/0/0 | 1/0/0 |
| datos-de-lote-en-acondicionamiento | 1/0/0 | 1/0/0 |
| envases-reales-empaque | 4/0/0 | 4/0/0 |
| pasos-de-acondicionamiento | 1/0/0 | 1/0/0 |
| pedidos-asignados | 4/0/0 | 4/0/0 |
| registro-ejecucion (2.ª corrida, tras «Cancelar esta receta») | 2/0/0 | 2/0/0 |
| consulta-de-evidencia | 2/0/0 | 2/0/0 |
| recetas-porcentaje | sin resultado | sin resultado |
| envases-del-pedido, coste-real-de-produccion, pedido-en-varias-presentaciones, pasos-de-envasado, pedido-con-varias-recetas | sin correr | sin correr |

Formato: pasados/fallidos/omitidos.

### Rojos
- **`dashboard-rediseno` R20 «a 390 px» (chromium y webkit) y «a 820 px» (webkit): «recorrido a N px», `scrollWidth` 530–535 > 390 y 822 > 820.**
  - Un diagnóstico temporal, ya revertido, localizó el desborde en el `h2` `execution-trace-recipe-name` de `ExecutionTraceRecipeSection` (T11): `right=530`, `w=495`.
  - El nombre sembrado es una sola palabra larga (`qc261_e2e_<hex>…`) y el `h2` no la parte.
  - Es un fallo de la UI de T11, en `app/`, fuera de mi alcance. Una solución posible: `min-w-0` y `break-words` (o `[overflow-wrap:anywhere]`) en el `h2` o en su contenedor flex.
  - En la primera corrida, chromium 390 falló antes, en `openDashboard`, con «strict mode violation: `getByTestId('data-table')` resolved to 2 elements», uno oculto. Al repetir solo R20 no volvió a salir; el rojo fue el desborde. Lo trato como intermitente.

### Bloqueos
- **Memoria.** El sistema mató `recetas-porcentaje` por falta de memoria, con la sesión en espera. Su `next dev` quedó escuchando en el 3117 y se paró.
  - No se ha vuelto a lanzar: el aviso pide no relanzar sin orden.
  - Quedan sin correr `recetas-porcentaje`, `envases-del-pedido`, `coste-real-de-produccion`, `pedido-en-varias-presentaciones`, `pasos-de-envasado` y `pedido-con-varias-recetas`.

### Verificación
- `pnpm run typecheck`: 0 errores.
- `pnpm exec eslint` de los 10 archivos tocados: sin errores ni avisos. El lint global no se corrió.
- LF: sin CR en el diff.

### Veredicto
T13 sin terminar:
- 17 specs en verde;
- `dashboard-rediseno` en rojo, por el desborde del `h2` de la sección (app, T11);
- 6 specs sin correr por memoria.

## Tanda 6 — arreglo del desborde del nombre de receta

**Cambio:** en `app/(private)/dashboard/recorrido/[id]/components/execution-trace-recipe-section.tsx` el `h2[data-testid=execution-trace-recipe-name]` pasa de `text-lg font-semibold` a `min-w-0 text-lg font-semibold [overflow-wrap:anywhere]`. Es el mismo patrón que ya usa el repo para un título que tiene que partir palabras (`send-template-dialog.tsx`, `whatsapp-template-table.tsx`). No hay más cambios en la app.

**Archivos:**
- `app/(private)/dashboard/recorrido/[id]/components/execution-trace-recipe-section.tsx` (modificado)
- `tests/unit/paridad/__snapshots__/recorridos-paridad.test.tsx.snap` (actualizado con `-u`)

**Resultados (un comando a la vez):**
- `pnpm exec vitest run --maxWorkers=1 tests/ui/dashboard/{execution-trace-detail,planta-varias-recetas,execution-trace-evidence,recorrido-rediseno,textos-dashboard}.test.tsx tests/ui/dashboard/trace-evidence-placement.test.ts`: 6 archivos, 120 tests en verde.
- `pnpm exec vitest run --maxWorkers=1 tests/unit/paridad/recorridos-paridad.test.tsx`: 3 snapshots fallaron. Revisé el diff: sus únicas líneas cambiadas son, 3 veces, la `class` del h2 (`font-semibold text-lg` → `[overflow-wrap:anywhere] font-semibold min-w-0 text-lg`). Lo actualicé con `-u` solo en ese archivo: 3 snapshots actualizados, 9/9 en verde.
- `pnpm exec playwright test e2e/dashboard-rediseno.spec.ts --workers=1` (puerto 3117 libre antes de cada corrida):
  - Corrida 1: 10 pasan y 2 fallan. Fallan chromium R8 a 390 px y chromium R20 a 390 px, las dos por el strict mode de `data-table`. El desborde ya no aparece: R20 a 820 px pasa en los dos proyectos y R20 a 390 px pasa en webkit.
  - Corrida 2: 11 pasan y 1 falla, chromium R20 a 390 px por el mismo strict mode. Esta vez R8 pasa.
  - Webkit: 6/6 en las dos corridas.
- Strict mode, no intermitente (sale en 2 de 2 corridas, siempre en chromium a 390 px):
  - El error salta en `openDashboard` (`e2e/dashboard-rediseno.spec.ts:240`), con `expect(page.getByTestId('data-table')).toBeVisible()`. El selector no está acotado y encuentra 2 `div[data-testid=data-table]`:
    - el primero está dentro de `dashboard-content`;
    - el segundo está fuera de `dashboard-content`, y Playwright solo lo identifica como `.nth(1)`. En el call log figura como `unexpected value "hidden"`.
  - El usuario aterriza en `/dashboard` tras el login y el spec hace luego `page.goto(DASHBOARD_ROUTE)`. Durante esa carga existe un segundo árbol oculto con su propia `data-table`.
  - El origen exacto del nodo oculto no está determinado. No es el fallback del `Suspense` (es un `<p role=status>`), y `cacheComponents` no está activo.
  - No viene de este cambio: afecta al listado del dashboard, no al recorrido.
  - Arreglo propuesto, fuera de mi alcance porque toca el spec: acotar el selector a `page.getByTestId('dashboard-content').getByTestId('data-table')`.
- `pnpm run typecheck`: exit 0.
- `pnpm run lint`: exit 0, con 0 errores y 11 warnings que ya existían (ninguno en el archivo tocado).

**Veredicto:** el nombre de la receta ya parte las palabras y el desborde a 390/820 px está resuelto. Queda en rojo chromium a 390 px por el strict mode de `data-table` en el spec, que es otra causa.

## Tanda 6 — specs pendientes de T13 (frontend_dev, 2026-11-10)

Cada spec corrió solo, con `pnpm exec playwright test <spec> --workers=1` (los dos proyectos). Antes de cada corrida el puerto 3117 estaba libre, así que no hubo que matar ningún `next dev`. La memoria no cortó ninguna corrida.

### Resultado

Formato: pasados/fallidos/omitidos.

| Spec | chromium | webkit |
|---|---|---|
| recetas-porcentaje | 4/0/0 | 4/0/0 |
| envases-del-pedido (1.ª corrida) | 1/1/0 | 1/1/0 |
| envases-del-pedido (2.ª, tras el ajuste) | 2/0/0 | 2/0/0 |
| coste-real-de-produccion | 1/0/0 | 1/0/0 |
| pedido-en-varias-presentaciones (con el mismo ajuste, aplicado antes de correrlo) | 2/0/0 | 2/0/0 |
| pasos-de-envasado | 1/0/0 | 1/0/0 |
| pedido-con-varias-recetas | 1/0/0 | 1/0/0 |

### Ajustes (`e2e/`)
- `envases-del-pedido.spec.ts` y `pedido-en-varias-presentaciones.spec.ts`:
  - **Causa del fallo:** en esta rama la ejecución ya no usa la cabecera por defecto de `OperatorScreenFrame`, que tenía el `span[data-slot=operator-eyebrow]`. Usa `RecipeHeader`, y su rótulo es `span[data-testid=recipe-header-eyebrow]` con «Fabricación · Pedido <número>».
  - **Ajuste:** `EXECUTION_EYEBROW_SELECTOR` pasa a `[data-testid="recipe-header-eyebrow"]` y la aserción, de `toHaveText(número)` a `toContainText(número)`.
  - La comprobación es la misma: el número del pedido está en el rótulo de la cabecera y no en el `h1`.
- `pnpm exec eslint` sobre los 2 archivos: sin problemas. LF: sin CR.

### Parte B — `data-table` duplicada en `dashboard-rediseno` (solo lectura)
- **Una sola fuente.** El testid `data-table` solo se pinta en `components/shared/data-table/data-table.tsx:292`. En el dashboard solo hay una `DataTable`: la de `ExecutionTraceTable`, dentro de `ExecutionTraceListSection`.
- **Nada en la app pinta una segunda tabla.** No hay variante móvil aparte: las tarjetas viven dentro del mismo `div[data-testid=data-table]`. Tampoco hay portal, panel lateral ni `loading.tsx`, y `ScreenEnter` (`app/(private)/components/screen-enter.tsx`) no duplica a los hijos.
- **Causa más probable: el streaming SSR de React 19.2.8 con Next 16.3.0.**
  - `ExecutionTraceListSection` va dentro del `<Suspense>` de `app/(private)/dashboard/components/dashboard-content.tsx:16`.
  - El servidor manda el contenido resuelto en un `<div hidden id="S:…">` al final del `body`, es decir, fuera de `dashboard-content`.
  - En 19.2, `$RC` no lo revela al momento. Marca el límite como `$~` y aplaza la revelación (`$RV`) a `$RT+300 ms`, o hasta los 2300 ms si cae entre 2000 y 2300 (`node_modules/react-dom/cjs/react-dom-server.node.development.js`, script `$RC`/`$RV`).
  - Mientras tanto existe una copia oculta fuera de `dashboard-content`. Si el cliente ya ha pintado el límite dentro de `dashboard-content`, coinciden las dos, y eso es lo que da el strict mode.
  - Esto último es una inferencia de la lectura del código: no se ha confirmado ejecutando nada.
- **Es preexistente, no de QT-315.**
  - `dashboard-content.tsx`, `execution-trace-list-section.tsx`, `page.tsx`, `components/shared/data-table/*`, el layout privado y `screen-enter.tsx` no cambian frente a `origin/dev`.
  - En `origin/dev`, el spec ya tenía el mismo selector sin acotar en `e2e/dashboard-rediseno.spec.ts:240`.
  - Lo único que QT-315 toca del dashboard son las columnas (la columna de progreso): puede mover el tiempo de la carga, pero no la estructura.
- **Arreglo propuesto (no aplicado):** acotar el selector a `page.getByTestId('dashboard-content').getByTestId('data-table')`.

### Veredicto
Los 6 specs pendientes de T13 están en verde en chromium y webkit, con un ajuste mínimo de selector en 2 specs. La `data-table` duplicada es preexistente y la causa más probable es el streaming SSR de React; falta confirmarla.

## Tanda 6 — selector de data-table en dashboard-rediseno (frontend_dev, 2026-11-10)

- **Cambio** (solo `e2e/dashboard-rediseno.spec.ts`, l. 240, `openDashboard`): `page.getByTestId('data-table')` → `page.getByTestId('dashboard-content').getByTestId('data-table')`. Era el único `getByTestId('data-table')` sin acotar del spec. No cambia lo que comprueba.
- **Puerto 3117**: libre antes de cada corrida; ningún `next dev` colgado.
- **Resultados** (`--workers=1`, en primer plano, uno a la vez):
  - chromium, corrida 1: `6 passed (59.3s)`
  - chromium, corrida 2: `6 passed (1.0m)`
  - webkit: `6 passed (1.4m)`
- `pnpm run typecheck` (`tsc --noEmit`): sin errores.
- `pnpm run lint`: `✖ 11 problems (0 errors, 11 warnings)`; warnings preexistentes, ninguno en el spec tocado.
- **Nota para el reviewer / posible deuda**: la causa es preexistente. `data-table` aparece duplicada en el DOM del dashboard también en `origin/dev` (sin QT-315), y el selector sin acotar violaba el modo estricto de Playwright. Causa probable: Suspense con streaming de React 19.2, que deja en el DOM a la vez el contenido y su copia (ver «Tanda 6 — specs pendientes de T13»). El selector acotado lo esquiva; la duplicación en sí queda como deuda fuera de QT-315.

Veredicto: spec `dashboard-rediseno` en verde en chromium (x2) y webkit con el selector acotado; typecheck y lint sin errores.

## Tanda 6 — T12 (frontend_dev, 2026-11-10)

### Archivo
- `e2e/planta-con-varias-recetas.spec.ts` (nuevo). Reutiliza los helpers de `e2e/helpers/`: `addOrderLine`, `openCreateOrderPanel`, `saveOrder`, `enterAndStartAssignedOrder`, `clickAndConfirm`, `seedPackaging`, `enableAllAddons`, `deleteOrdersWithLines`, `deleteCompanyNotifications` y `pathOf`. Usa el prefijo `qt315_e2e_` y limpia los huérfanos por prefijo y por edad. No se toca `app/`, `lib/` ni `components/`.

### Caso (uno, porque cada paso es la precondición del siguiente)
`QT-315 R33 R7 R8 R21 R25`:
1. El Administrador da de alta por Pedidos un pedido de dos recetas, A y B, cada una con su insumo y con el envase compartido.
2. El Operador entra a A desde la fila de su línea en «Mis asignados». La cabecera muestra «Receta 1 de 2» (R7) y la otra receta aparece en `PENDIENTE` (R8). El Operador la fabrica. Base: `[POR_EMPACAR, PENDIENTE]`.
3. El Operador fabrica B: cabecera «Receta 2 de 2», la otra receta en `POR_EMPACAR`. Base: `[POR_EMPACAR, POR_EMPACAR]`.
4. El Empacador empaca A. Base: `[POR_ACONDICIONAR, POR_EMPACAR]`. El acondicionador comienza A (equipo: el Operador), guarda los datos de lote y termina. Base: `[TERMINADO, POR_EMPACAR]`.
5. Dashboard (R21), acotado a `dashboard-content`: la fila del pedido muestra A, «+1 más» y «1 de 2» (`data-finished=1`).
6. Se empaca y acondiciona B. Base: `[TERMINADO, POR_ACONDICIONAR]` y después `[TERMINADO, TERMINADO]`. Dashboard: «+1 más» y «2 de 2».
7. Recorrido (R25): el resumen muestra «2 de 2 terminadas» y hay 2 `execution-trace-recipe-section`, en orden de alta (`data-line-id`), cada una `TERMINADO` y con el nombre de su receta.

### Resultados
Comando: `pnpm exec playwright test e2e/planta-con-varias-recetas.spec.ts --workers=1`. El puerto 3117 estaba libre antes y después; no había ningún `next dev` colgado.

| Proyecto | Resultado |
|---|---|
| chromium | 1/0/0 (1.8m) |
| webkit | 1/0/0 (3.5m) |

Total: `2 passed (6.2m)`.

- `pnpm run typecheck`: sin errores.
- `pnpm run lint`: `✖ 11 problems (0 errors, 11 warnings)`. Son las mismas advertencias que ya había; ninguna está en el spec nuevo, y `eslint` sobre ese archivo no da salida. LF: sin CR.

### Guardia de recetas
`pnpm exec vitest run --maxWorkers=1 tests/unit/recetas/scope.test.ts` da **1 rojo de 5**: «la pantalla de recetas vive solo donde la declara QC-26…». En la lista cerrada de E2E de recetas aparece un spec inesperado, `planta-con-varias-recetas.spec.ts`; es el único de diferencia. Siguiendo la orden, no amplío la lista (l. ~289 de `tests/unit/recetas/scope.test.ts`). Hay dos salidas, y la decisión es del leader: añadir el spec a la lista, con su comentario `QT-315 / R33`, o renombrarlo sin «receta».

### Veredicto
T12 en verde en chromium y webkit, con typecheck y lint limpios. Queda pendiente la decisión del leader sobre la guardia `scope.test.ts`, que está en rojo por el nombre del spec nuevo.

## T14 — tests de trazabilidad R5 y R6

Solo tests; nada en `app/`, `lib/` ni `components/`.

### Archivos modificados
- `tests/unit/asignaciones-ui/assignment-row-actions.test.tsx`
- `tests/unit/asignaciones-ui/recipe-screens.test.tsx`

### Mapa R → test
- **R5** → `assignment-row-actions.test.tsx`:
  - «R5: en la fila de la segunda receta, «Ver recorrido» va al pedido (row.id), no a su lineId» (las seis vistas).
  - «R5: dos filas del mismo pedido (dos lineId) se pintan aparte y ambas actúan sobre el mismo pedido».
  - **Nota:** las filas de `/asignacion` no ofrecen asignar, desasignar ni quitar grupo; su menú solo tiene «Entrar» y «Ver recorrido». Esas acciones viven en `/pedidos` (`OrderResponsibles`, con `orderId={order.id}`), cuya tabla tiene una fila por pedido (`getRowId={(order) => order.id}`). Por eso el caso cubre lo que la fila sí hace: actúa sobre `row.id`, como dice design § 4.1.
- **R6** → `recipe-screens.test.tsx`:
  - «R6: $nombre muestra los datos de la receta nombrada y la otra receta solo sale en «Otras recetas»» (ejecucion, empaque, acondicionamiento).
  - «R6: ejecucion pinta los pasos de su receta, no los de otra del mismo pedido».

### Salida
- `pnpm exec vitest run --maxWorkers=1 tests/unit/asignaciones-ui/assignment-row-actions.test.tsx tests/unit/asignaciones-ui/recipe-screens.test.tsx` → `Test Files 2 passed (2)`, `Tests 47 passed (47)`.
- `pnpm run typecheck` → `tsc --noEmit`, sin errores.
- `pnpm run lint` → `✖ 11 problems (0 errors, 11 warnings)`; ningún aviso en los dos archivos tocados.

### Veredicto
R5 y R6 ya tienen tests y están en verde. R5 solo puede cubrir «Ver recorrido», porque las filas de `/asignacion` no tienen acciones de responsables.

## T14 — cierre (implementer, 2026-11-10)

### Mapa R1–R34 → test
Se sacó de los nombres de caso **añadidos o cambiados desde el spec** (`git diff b8a756300..HEAD -- tests e2e`). Formato: requisito (n.º de archivos): rutas bajo `tests/` o `e2e/`. Los nombres exactos de cada caso están en las secciones de cada tanda.
- R1 (1): unit/asignaciones-ui/packing-order-screen.tsx
- R2 (4): ui/dashboard/execution-trace-table.tsx, unit/asignaciones-ui/recipe-rows.tsx, unit/asignaciones/list-assigned-orders.ts +1
- R3 (5): integration/pedidos/order-line-outlines.int.ts, unit/asignaciones-ui/recipe-rows.tsx, unit/asignaciones/list-assigned-orders.ts +2
- R4 (2): unit/asignaciones-ui/assigned-order-enter-trigger.tsx, unit/asignaciones-ui/recipe-rows.tsx
- R5 (0): 
- R6 (0): 
- R7 (6): e2e/planta-con-varias-recetas.ts, unit/asignaciones-ui/recipe-header.tsx, unit/asignaciones/get-assigned-order-execution.ts +3
- R8 (7): e2e/planta-con-varias-recetas.ts, unit/asignaciones-ui/recipe-header.tsx, unit/asignaciones-ui/recipe-screens.tsx +4
- R9 (5): unit/asignaciones-ui/assigned-orders-manufactured-notice.tsx, unit/asignaciones-ui/conditioning-order-page.tsx, unit/asignaciones-ui/order-execution-page.tsx +2
- R10 (11): unit/asignaciones/finish-assigned-order.ts, unit/asignaciones/finish-conditioning.ts, unit/asignaciones/finish-packing.ts +8
- R11 (23): integration/asignaciones/order-lines-execution.int.ts, unit/asignaciones-ui/conditioning-batch-data-form.tsx, unit/asignaciones-ui/finish-conditioning-dialog.tsx +20
- R12 (16): integration/asignaciones/order-lines-execution.int.ts, ui/dashboard/recorrido-rediseno.tsx, unit/asignaciones/evidence-target.ts +13
- R13 (13): integration/asignaciones/conditioning-team-repository.int.ts, integration/asignaciones/execution-log-read.int.ts, integration/asignaciones/step-evidence-repository.int.ts +10
- R14 (22): integration/asignaciones/order-lines-execution.int.ts, integration/pedidos/order-line-outlines.int.ts, unit/asignaciones/cancel-assigned-order.ts +19
- R15 (12): unit/asignaciones-ui/conditioning-order-page.tsx, unit/asignaciones/cancel-assigned-order.ts, unit/asignaciones/finish-conditioning.ts +9
- R16 (7): integration/asignaciones/order-lines-execution.int.ts, integration/pedidos/cancel-line-from-execution.int.ts, unit/asignaciones-ui/packing-order-screen.tsx +4
- R17 (6): integration/asignaciones/order-lines-execution.int.ts, integration/pedidos/cancel-line-from-execution.int.ts, unit/asignaciones-ui/order-execution-step-log.tsx +3
- R18 (2): unit/asignaciones-ui/order-cancel-dialog.tsx, unit/asignaciones-ui/order-execution-step-log.tsx
- R19 (5): unit/asignaciones-ui/asignacion-page.tsx, unit/asignaciones-ui/assigned-orders-manufactured-notice.tsx, unit/asignaciones/order-execution-actions.ts +2
- R20 (13): integration/asignaciones/order-lines-execution.int.ts, unit/asignaciones-ui/asignacion-page.tsx, unit/asignaciones-ui/assigned-orders-manufactured-notice.tsx +10
- R21 (6): e2e/planta-con-varias-recetas.ts, integration/pedidos/order-line-outlines.int.ts, ui/dashboard/planta-varias-recetas.tsx +3
- R22 (4): integration/pedidos/order-line-outlines.int.ts, ui/dashboard/planta-varias-recetas.tsx, unit/asignaciones/list-execution-traces.ts +1
- R23 (1): unit/asignaciones/list-execution-traces.ts
- R24 (5): integration/pedidos/order-line-outlines.int.ts, unit/asignaciones/get-execution-trace.ts, unit/asignaciones/list-execution-traces.ts +2
- R25 (8): e2e/planta-con-varias-recetas.ts, ui/dashboard/execution-trace-detail.tsx, ui/dashboard/planta-varias-recetas.tsx +5
- R26 (5): ui/dashboard/planta-varias-recetas.tsx, unit/asignaciones/get-execution-evidence.ts, unit/asignaciones/get-execution-trace.ts +2
- R27 (3): unit/asignaciones-ui/finish-conditioning-dialog.tsx, unit/asignaciones/get-execution-trace.ts, unit/asignaciones/list-execution-traces.ts
- R28 (2): ui/dashboard/planta-varias-recetas.tsx, unit/asignaciones/get-execution-trace.ts
- R29 (11): unit/asignaciones-ui/assigned-orders-manufactured-notice.tsx, unit/asignaciones-ui/recipe-header.tsx, unit/asignaciones-ui/recipe-rows.tsx +8
- R30 (2): unit/asignaciones-ui/recipe-header.tsx, unit/asignaciones-ui/recipe-rows.tsx
- R31 (1): unit/asignaciones-ui/recipe-screens.tsx
- R32 (0): 
- R33 (1): e2e/planta-con-varias-recetas.ts
- R34 (0): 

Complementos al mapa:
- **R1** (una fila por receta) lo cubren los casos «R2: … pinta una fila por receta …» de `unit/asignaciones-ui/recipe-rows`, en las seis tablas.
- **R5**: `unit/asignaciones-ui/assignment-row-actions` tiene dos casos:
  - «R5: en la fila de la segunda receta, «Ver recorrido» va al pedido (row.id), no a su lineId»;
  - «R5: dos filas del mismo pedido (dos lineId) se pintan aparte y ambas actúan sobre el mismo pedido».

  **Para el reviewer:** las filas de `/asignacion` no tienen asignar, desasignar ni quitar grupo. Esas acciones viven en `/pedidos` (`OrderResponsibles`, una fila por pedido), así que de la fila de una receta solo se puede probar «Ver recorrido».
- **R6**: `unit/asignaciones-ui/recipe-screens` tiene dos casos:
  - «R6: $nombre muestra los datos de la receta nombrada y la otra receta solo sale en «Otras recetas»», en ejecución, empaque y acondicionamiento;
  - «R6: ejecucion pinta los pasos de su receta, no los de otra del mismo pedido».

  Lo completan los casos R13 de lecturas por línea.
- **R32**, comprobado sobre el diff `origin/dev...HEAD`: 0 archivos en `db/`, y ni `package.json` ni `pnpm-lock.yaml` cambian. No hay permisos nuevos.
- **R34**, comprobado sobre el diff `b8a756300..HEAD`:
  - no se tocan `batch-evidence-dialog.tsx`, `get-order-evidence.ts` ni los tests de `getOrderEvidence` (`get-order-evidence`, `read-order-evidence`, `order-evidence-actions`), y esos tests siguen en verde;
  - `read-order-evidence.ts` gana `readOrderEvidenceByLine` (T10), pero `readOrderEvidence` conserva firma y resultado.

### `node scripts/archivos-en-vuelo.mjs --candidata QT-315`
- Resultado: «QT-315: sin conflicto de archivos con 6 feature(s) en vuelo», con 8 avisos:
  - QC-96 en vuelo con la rama sin publicar;
  - QC-131 sin `## Archivos esperados`;
  - `CATALOGO.md` es archivo de apéndice compartido con QC-291 y con QT-314;
  - mismo dueño, sin choque: QC-291, QT-296, QT-304 y QT-314.

### `./init.sh`
- **Rojo en el validador de `feature_list.json`**: «id duplicado» 290–308 entre fichas QC y QT, la deuda ya registrada. Es el único rojo, pero `init.sh` **se corta ahí**, así que typecheck, lint, `vitest related` y guardias no llegan a correr dentro de `init.sh`. Se verificaron a mano en los cierres de cada tanda.

### Bloqueo abierto
- **`tests/unit/recetas/scope.test.ts` está en rojo (1 de 5)** porque `e2e/planta-con-varias-recetas.spec.ts` no está en la lista cerrada de E2E de recetas (~l. 289).
  - El nombre del spec lo fija `tasks.md` (T12) y `requirements.md` R33, así que renombrarlo chocaría con el spec.
  - No se ha ampliado la guardia: hace falta la decisión del leader o del humano.

### T14 — última ampliación y estado final (implementer, 2026-11-10)
- `tests/unit/recetas/scope.test.ts`: la lista cerrada de E2E de recetas gana `'planta-con-varias-recetas.spec.ts'` («QT-315 / R33»), como en QT-313 y QT-314. Decisión del humano. El archivo da 5/5.
- `pnpm run typecheck`: 0 errores.
- `pnpm exec vitest run guard --maxWorkers=1`: 86 de 87 archivos en verde, **1 rojo**. Es `tests/guards/guard-identificador-de-request.test.ts`, en «no hay ningun archivo nuevo en e2e/ … (R21)».
  - Su lista cerrada `E2E_ESPERADOS` (l. 57) no contiene `planta-con-varias-recetas.spec.ts`.
  - Hay precedente: QT-313 y QT-314 añadieron a esa lista sus specs nuevos (l. 257 y 263; commits `c9d18d80e` y `5e980f7bd`).
  - No la he ampliado: la autorización cubría solo `scope.test.ts`, y queda a la decisión del leader.
- T14 queda **sin `[x]`** por ese rojo.
