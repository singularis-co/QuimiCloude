
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
