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
