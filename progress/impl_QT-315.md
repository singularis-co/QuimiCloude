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
