
## T10 backend — tab «Reparto» (backend_dev, 2026-10-14)

Archivos:
- nuevo `lib/modules/inventario/domain/list-finished-product-distribution.ts` (caso de uso)
- `lib/modules/inventario/domain/finished-product-detail.ts` (`PackingReasonView`, `FinishedDistributionLine`, `FinishedDistributionDirectory`)
- `lib/modules/inventario/index.ts` (exports)
- `lib/modules/inventario/adapters/driving/finished-product-actions.ts` (`listFinishedProductDistributionAction`)
- `lib/modules/inventario/ports/finished-product-detail-repository.ts` + `adapters/driven/persistence/finished-product-detail-prisma.ts` (`FinishedProductRecord.recipeId`, fuera de "Archivos esperados": el caso de uso necesita la receta del producto)
- nuevo `lib/modules/pedidos/adapters/driven/persistence/packed-lines-directory-prisma.ts`
- `lib/composition/index.ts` (cableado)
- tests: nuevo `tests/unit/inventario/list-finished-product-distribution.test.ts`, nuevo `tests/integration/pedidos/packed-lines-directory.int.test.ts`, `tests/integration/aislamiento.json` (commit), `tests/unit/inventario/finished-product-actions.test.ts` (fila de la accion), `recipeId: null` en 5 fixtures de `tests/unit/inventario/*finished-product*.test.ts`, `tests/unit/pedidos/module-contract.test.ts` (lista cerrada de duenos del cliente Prisma)

Mapa R → test:
- R26: unit «sin inventario.consultar…», «pide al directorio…», «10 o 25…», «paginacion invalida…», «sin receta o sin presentacion…»; int «solo las lineas de pedidos empacados… descendente», «pagina de 10 o 25…», «segunda pagina…»
- R27: unit «devuelve tal cual las filas…»; int «cada fila trae plan, envases reales, motivo y texto de Otro…»
- R25 (tab): int «una linea empacada antes de contar…»
- R29: unit «producto de otra empresa o borrado…», «id que no es uuid…»; int «con la empresa B no ve ninguna linea de A…»
- R28: es UI (frontend_dev)

Verificacion:
- `pnpm run typecheck`: 0 errores
- `pnpm run lint`: 0 errores, 7 warnings preexistentes
- `pnpm exec vitest run guard`: 76 archivos, 1069 passed, 20 skipped
- unit: list-finished-product-distribution + finished-product-actions 43/43; module-contract 9/9
- integracion: packed-lines-directory 6/6; inventario/finished-product-detail 13/13
- `vitest related` (node+jsdom): 9 fallos en asignaciones/order-catalog de T7 en curso, ninguno de T10

Veredicto: backend de T10 listo para la UI.

## T7 backend — vista de empaque y acondicionamiento (backend_dev, 2026-10-14)

Archivos:
- `lib/modules/asignaciones/domain/packing-order-view.ts`: fuera `packages` y `products`; nuevo `PackingFinishView`/`PackingFinishLineView` y `composePackingFinishView` (presentaciones, unidades, `PackagingCatalog.findRefs` sin `excludeOrderId`)
- `lib/modules/asignaciones/domain/get-packing-order.ts`: `finish` solo en `EN_EMPAQUE` del actor; deps `+ packaging`
- `lib/modules/asignaciones/domain/order-distribution-view.ts`: `lineId`, `packedPackages`
- `lib/modules/asignaciones/domain/conditioning-order-view.ts`: `packages = effectivePackages(line)`
- `lib/modules/asignaciones/domain/conditioning-batch-data.ts`: `missingBatchDataLines` ignora lineas con efectivo 0 (lo usa `finish-conditioning.ts` sin cambios de codigo)
- contrato `pedidos` (fuera de lo que nombra el design, necesario para `content` copiado y `packaging.productId`): `AssignedOrderPresentationLine` + `presentationContent`, `packagingProductId`; `order-summary-reader.ts`, `list-order-summaries.ts`, `order-catalog-prisma.ts` (select + `toFixed(4)`)
- `lib/composition/index.ts`: `listPackingOrders` sin `products`; `getPackingOrder` con `packaging: packagingCatalog`
- `scripts/seed-demo/gateway.ts`: `packedAsPlanned` lee `asignaciones.getPackingOrder(...).finish.lines`; fuera la lectura Prisma de `orderPresentationLine`
- UI minima para compilar (T9 la rehace): `packing-orders-columns.tsx` sin columna «Envases» (`PACKING_ORDERS_COLUMN_COUNT` 5, fuera `PACKING_ORDER_PACKAGES_COLUMN_ID`), `packing-order-screen.tsx` sin «Envases:» (fuera `PACKING_ORDER_PACKAGES_TESTID`, texto y `EMPTY_MARK`), sus dos `index.ts`
- tests: fixtures con `lineId`/`packedPackages`/`presentationContent`/`packagingProductId`/`finish: null` en asignaciones, asignaciones-ui, paridad y pedidos/order-catalog; snapshots de paridad actualizados (solo cae «Envases»); `tests/unit/marca/tablas-marca.test.tsx` (`packing-orders-columns` sin tabulares)

Mapa R → test:
- R1: `get-packing-order.test.ts` «QC-281 … R1: al empacador en EN_EMPAQUE le llega cada linea…», «R1: el contenido copiado…», «R1: en POR_EMPACAR no hay conteo…», «R1, R14: en EN_EMPAQUE de otro…»
- R9: `get-packing-order.test.ts` «R9: freePackages es la parte entera del disponible libre…», «R9: un disponible negativo o un envase que no vuelve…»
- R12: `list-packing-orders.test.ts` «QC-281 R12: Por empacar ya no trae envases»; `get-packing-order.test.ts` «…sin envases (QC-281 R12)»; `packing-order-screen.test.tsx` R28 (sin «Envases:»)
- R23: `conditioning-batch-data.test.ts` «QC-281 R23 …» (2); `finish-conditioning.test.ts` «R23: una linea empacada con 0…», «R23: todas sus lineas en 0…»; `get-conditioning-order.test.ts` «R23: la fila y los datos de lote muestran los envases reales…»; `order-distribution-view.test.ts` «QC-281 R23: lleva el id de la linea…»
- R25: `conditioning-batch-data.test.ts`, `finish-conditioning.test.ts`, `get-conditioning-order.test.ts` «R25: … sin conteo guardado …»; `get-packing-order.test.ts` «R25: una linea antigua sin envase…»
- R29: `get-packing-order.test.ts` «R29: todas las lecturas del conteo van con la empresa del actor»

Verificacion:
- `pnpm run typecheck`: 0 errores
- `pnpm run lint`: 0 errores, 7 warnings preexistentes
- `pnpm exec vitest run guard`: 76 archivos, 1069 passed, 20 skipped
- `vitest related --run <fuentes T7> --project node --project ui`: 383 archivos, 6727 passed, 1 skipped
- integracion: `scripts/seed-demo.int.test.ts` 1/1; asignaciones assigned-orders, finish-conditioning-batch-data, finished-orders, company-orders 21/21

Veredicto: T7 backend listo; la UI del dialogo (T9) puede consumir `PackingOrderDetail.finish`.
