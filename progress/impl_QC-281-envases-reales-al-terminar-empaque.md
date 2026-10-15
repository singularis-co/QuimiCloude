
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

## T9 — diálogo y pantalla del empacador (frontend_dev, 2026-10-14)

Archivos:
- nuevo `app/(private)/asignacion/empaque/[id]/components/packing-finish-dialog.tsx` (`PackingFinishDialog`, `PACKING_FINISH_DIALOG_TEXTS`, testids `PACKING_FINISH_*`): compone `ui/dialog`, `ui/button` (`touch`), `ui/input` (`inputMode="numeric"`), `SharedSelectControl` (controlado), `ui/textarea` + `ui/label` (el `TextField` no tiene varias líneas), `FieldError`, `StatusBadge`; reglas con `checkPackingCounts`, `packedTotalInOrderUnit`, `maxPackagesForLine` de `pedidos`.
- `packing-order-screen.tsx`: Terminar (pie y último paso) abre el diálogo; campo oculto `lines` (`PACKING_ORDER_LINES_FIELD`) en los dos `<form>`; fuera `PACKING_ORDER_FINISH_CONFIRM_TEXTS`.
- `index.ts` del barrel de la ruta.
- tests: nuevo `tests/unit/asignaciones-ui/packing-finish-dialog.test.tsx` (31); `packing-order-screen.test.tsx`, `packing-order-evidence.test.tsx`, `packing-orders-columns.test.tsx`, `tests/unit/paridad/confirmaciones-paridad.test.tsx` + snapshot, snapshot de `asignacion-acondicionamiento-paridad` (el `<form>` de Terminar gana el `input` oculto `lines`).
- «Envases:» y la columna ya habían salido en T7: verificado, con test.

Mapa R → test (UI):
- R1: dialog «R1: una fila por línea…prellenado con el plan», «R1: la cabecera…», «R1, R16: Terminar sin cambios envía el plan…»; screen «R1: «Terminar» del pie abre…», «R1, R21: el ultimo boton…abre el diálogo del conteo…», «R1, R16: …`lines`»
- R2: dialog «R2: vacío →…», «R2: solo entra un entero…», «R2: «−» no baja de 0», «R2, R10: 0 se acepta…»
- R3: dialog «R3: todo igual al plan…», «R3, R10: con menos envases…», «R3, R10: con más envases…», «R3: volver al plan…», «R3, R16: con diferencia y motivo…»
- R4: dialog «R4: al pasar de menos a más…se vacía», «R4: un motivo que vale en los dos sentidos se conserva…»
- R5: dialog «R5, R13: «Otro» abre «Describe el motivo»…»
- R6: dialog «R6: Terminar con una línea distinta y sin motivo…», «R6: «Otro» con solo espacios…»; screen «R6: …no envía nada»
- R7: dialog «R7: el pie «Envasado…» se ve siempre…», y el total en «R8: Galón 16…» y «R32…»
- R8: dialog «R8: Galón 16 supera 72 L…», «R8: igual o por debajo…»
- R9: dialog «R9: Botella 19 pide 4 vacías…», «R9: dos líneas con el mismo envase suman su exceso…»
- R10: dialog «R3, R10…» (2), «R10: …plural» (2), «R2, R10: 0 se acepta…»
- R11: dialog «R11: «Cancelar» cierra sin enviar», «R11: la X «Cerrar»…»; screen «R11: cerrar el diálogo…al reabrir vuelve al plan», «Terminar: cancelar no invoca la accion»
- R12: screen «R12: la pantalla no pinta «Envases:»…», «R28: …»; columns «R12: ninguna columna…«Envases»»
- R13: dialog «R5, R13…», «R13: el campo no admite más de 200 caracteres»
- R32: dialog «R32: con todas las líneas en 0…se puede Terminar»
- R33: dialog «R33: sin pasos con foto…», «R33: con pasos con foto…»; evidence «R23, R33…» (2)

Comandos:
- `pnpm run typecheck`: limpio.
- `pnpm run lint`: 0 errores, 7 warnings preexistentes en archivos no tocados.
- `pnpm exec vitest related --run <archivos de T9>`: 9 archivos, 216/216 tras actualizar el snapshot de `asignacion-acondicionamiento-paridad` (1 fallo previo: solo el `input` oculto nuevo).

Revisión visual 1440/1024/390: NO hecha (sin navegador en este agente).

Veredicto: T9 hecha en código y tests; queda la revisión visual y dos puntos abiertos (pedido con `finish: null`, formato de cifras).

## Tanda 4 — decisiones del humano (frontend_dev, 2026-10-15)

Commits: `3af625b2` (pedido sin unidad), `ded3d3d8` (tilde «Conteo físico»), y el del pliegue animado (este).

Archivos:
- 1. Pedido sin unidad: `app/(private)/asignacion/empaque/[id]/components/packing-order-screen.tsx`
  (`lacksUnit = EN_EMPAQUE propio && finish === null`; Terminar del pie deshabilitado sin form ni
  testid y `aria-describedby` a la nota; en paso a paso el último paso se bloquea con la nota como
  motivo visible vía `stepBlockReason`; `Notice` warning `packing-order-missing-unit`; texto en
  `PACKING_ORDER_TEXTS.missingUnit`), `.../components/index.ts`,
  `tests/unit/asignaciones-ui/packing-order-screen.test.tsx`, `packing-order-evidence.test.tsx`,
  `packing-order-page.test.tsx`, `tests/unit/paridad/asignacion-acondicionamiento-paridad.test.tsx`
  (fixtures de empaque propio pasan a llevar `finish`; el snapshot no cambia).
- 2. Tilde: `app/(private)/inventario/components/movement-reason-label.ts`,
  `tests/unit/inventario/batch-history.test.tsx`, `tests/unit/inventario/adjust-batch-dialog.test.tsx`,
  `tests/unit/inventario-ui/finished-product-tables.test.tsx`, `e2e/ajuste-de-inventario.spec.ts`
  (solo el texto, no corrido). Ningún snapshot contenía «Conteo fisico». El diálogo de Terminar
  mantiene su copia `PACKING_FINISH_DIALOG_TEXTS.reasons`: reusar la etiqueta exigiría importar desde
  `inventario/components` en otra ruta (o subirla a shared) y añadir «Otro»; no es trivial.
- 3. Pliegue: `packing-finish-dialog.tsx` (subcomponente interno `Fold`: `grid-rows-[1fr]`↔`[0fr]`,
  `translate-y-[10px]`, opacidad, `duration-(--dur-base)`; despliegue con `starting:`; al plegarse
  queda `inert` + `aria-hidden` con lo último que mostró y se desmonta en `transitionend`; movimiento
  reducido por la regla global de `globals.css`, que acorta a 0.01 ms), `index.ts`,
  `tests/unit/asignaciones-ui/packing-finish-dialog.test.tsx`.

R → test (añadidos):
- R1, R8 (pedido sin unidad): screen «R1, R8: sin pasos, «Terminar» del pie queda deshabilitado…»,
  «R1, R8: con pasos, el último paso no deja terminar…», «R1: la nota no sale en `POR_EMPACAR`…»,
  «R1: la nota es corta y lleva tilde».
- R3 (tilde/etiquetas): batch-history «deriva la etiqueta…» y finished-product-tables actualizados.
- R3, R5 (pliegue): dialog «R3: al diferir del plan el bloque se despliega…», «R3: al volver al plan
  el bloque se pliega…», «R3: si vuelve a diferir mientras se pliega…», «R5: el texto de «Otro» se
  pliega igual…»; «R3: volver al plan quita insignia y motivo» ajustado al desmontaje en `transitionend`.

Comandos (tras cada cambio):
- `pnpm run typecheck`: limpio las tres veces.
- `pnpm run lint`: 0 errores, 7 warnings preexistentes (tests/unit/documentos, tests/unit/pedidos).
- `pnpm exec vitest run guard`: 76 archivos, 1069 pasan, 20 omitidos, las tres veces.
- `vitest related`: cambio 1 → 8 archivos, 214/214 (antes de ajustar `packing-order-page.test.tsx`,
  3 rojos ahí por `finish: null` en empaque propio); cambio 2 → 27 archivos, 434/434; cambio 3 → 8
  archivos, 218/218.

Fuera de «Archivos esperados»: `app/(private)/inventario/components/movement-reason-label.ts`,
`tests/unit/inventario/batch-history.test.tsx`, `tests/unit/inventario/adjust-batch-dialog.test.tsx`,
`e2e/ajuste-de-inventario.spec.ts`, `tests/unit/asignaciones-ui/packing-order-page.test.tsx`,
`tests/unit/paridad/asignacion-acondicionamiento-paridad.test.tsx`.

Revisión visual del pliegue: NO hecha (sin navegador).

Veredicto: las tres decisiones hechas con tests; typecheck, lint y guardias verdes.

## T11–T12 — E2E (frontend_dev, 2026-10-15)

Archivos:
- T11 (a2f17589): `e2e/helpers/confirm-dialog.ts` (solo la cabecera: ya no atribuye el diálogo a
  `ConfirmActionDialog`). Ningún otro E2E necesitó cambio: el diálogo conserva los testids y viene
  prellenado con el plan; ninguno miraba «Envases:» ni la columna de «Por empacar».
- T12: `e2e/envases-reales-empaque.spec.ts` (nuevo);
  `tests/guards/guard-identificador-de-request.test.ts` (alta del spec nuevo en la lista cerrada
  `E2E_ESPERADOS`; sin ella la guardia queda roja). Fuera de «Archivos esperados»: la guardia.

R → test (`e2e/envases-reales-empaque.spec.ts`):
- R17, R18, R20, R21, R26, R27 → «R17, R18, R20, R21, R26, R27 - una línea con 1 envase menos
  (Rotura)… y «Reparto» muestra −1 y +1 con su motivo».
- R19, R20, R21, R23, R26, R27 → «R19, R20, R21, R23, R26, R27 - una línea en 0 no da de alta lote…
  y «Reparto» la marca «Sin lote»».
- R9 → «R9 - un envase de más sin stock libre del envase muestra «No alcanza el stock del envase…»
  y deja Terminar deshabilitado».

Playwright (chromium; base local del repo principal, `.env` + `.env.local` exportados):
- T11, sin cambios de código: ajuste-de-inventario 4/4, empaque 1/1, envases-del-pedido 2/2,
  operario-rediseno 20/20, pasos-de-envasado 1/1, pedido-en-varias-presentaciones 2/2 → 30 passed.
- T12, estado del commit: 1 passed, 2 failed. Los dos rojos son el mismo bug de T10, no del spec:
  `finished-product-distribution-table.tsx` (`'use client'`) importa `movementReasonLabel` del
  barrel `@/app/(private)/inventario/components`, que arrastra `product-list-section.tsx` →
  `lib/composition` → `next/headers` al cliente. La ruta `/inventario/producto-terminado/[id]` no
  compila (`next build` falla con 10 errores; en `next dev`, ENOENT de `build-manifest.json` y
  overlay «Build Error» en las demás páginas). También deja rojo `e2e/detalle-de-producto-terminado.spec.ts`.
- Comprobado con el import cambiado a `@/app/(private)/inventario/components/movement-reason-label`
  (aplicado solo para la prueba y revertido): chromium 3/3 y webkit 3/3.

Comandos:
- `pnpm run typecheck`: limpio.
- `pnpm run lint`: 0 errores, 7 warnings preexistentes.
- `pnpm exec vitest run guard`: 76/76 archivos, 1069 pasan, 20 omitidos (antes del alta en
  `E2E_ESPERADOS`: 1 rojo en `guard-identificador-de-request`).

Veredicto: T11 verde sin tocar specs; T12 escrito y verde en chromium y webkit con el arreglo de
un import de T10, que queda pendiente (rojo hasta entonces).
