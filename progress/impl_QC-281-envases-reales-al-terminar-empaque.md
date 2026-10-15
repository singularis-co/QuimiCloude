# Bitácora de implementación — QC-281 Envases reales al terminar el empaque

Las secciones T1–T6 se reconstruyen de los commits y de `progress/features/QC-281.md > Tandas`
(añadidas tras la revisión, hallazgo m7). Las demás son las que escribieron los subagentes en su día.

## T1–T2 — migración y dominio del conteo (backend_dev, 2026-10-14) · 68a7ff54

Archivos:
- nuevos `db/migrations/20261015120200_order_presentation_lines_packed_count/{migration.sql,down.sql}`
  (3 columnas en `order_presentation_lines` y 4 `CHECK`, sin backfill); `db/schema.prisma`
- nuevo `lib/modules/pedidos/domain/packing-count.ts` (`PACKING_DIFFERENCE_REASONS`,
  `PACKING_INCREASE_REASONS`, `PACKING_REASON_OTHER_MAX`, `checkPackingCounts`, `effectivePackages`,
  `packedTotalInOrderUnit`, `maxPackagesForLine`); `lib/modules/pedidos/index.ts`,
  `lib/modules/pedidos/domain/order-distribution.ts`, `lib/modules/inventario/index.ts`
  (`STOCK_INCREASE_REASONS`)
- tests: nuevo `tests/unit/pedidos/packing-count.test.ts`, nuevo test de esquema de la migración
  (`order-presentation-lines-packed-count-migration.test.ts`), `tests/guards/guard-identificador-de-request.test.ts`

Mapa R → test: R2–R8, R13, R15, R25 → `packing-count.test.ts`; R13, R16, R25 → test de esquema de la
migración (CHECK iguales a las constantes del dominio, `down.sql` en orden inverso).

## T3–T4 — liquidar envases y guardar conteos por línea (backend_dev, 2026-10-14) · 12557f25

Archivos:
- `lib/modules/inventario/domain/reservation.ts` (`settlePackagingForOrder`) y
  `adapters/driven/persistence/reservation-prisma.ts`
- `lib/modules/pedidos/ports/order-write-repository.ts` (`recordPackedCounts`,
  `FinishPackingLine.packedPackages`), `adapters/driven/persistence/order-prisma.ts`,
  `order-catalog-prisma.ts`, `domain/order-catalog.ts` (`AssignedOrderPresentationLine.id/packedPackages`),
  `domain/list-order-summaries.ts`, `ports/order-summary-reader.ts`
- tests: nuevos `tests/integration/inventario/settle-packaging.int.test.ts` y
  `tests/integration/pedidos/order-packed-counts.int.test.ts`; `tests/integration/aislamiento.json`;
  `tests/helpers/order-unit-of-work-double.ts`; fixtures de asignaciones/pedidos con los campos nuevos

Mapa R → test: R17, R18, R19, R29 → `settle-packaging.int.test.ts`; R16, R29 → `order-packed-counts.int.test.ts`.

Verificación tanda 1 (T1–T4): typecheck verde, lint 0 errores, tests propios y 76 guardias verdes.
Migración aplicada a la base local del repo principal (el worktree no tiene `.env`).

## T5 — Terminar con conteo real en `pedidos` (backend_dev, 2026-10-14) · 5101473c

Archivos: `lib/modules/pedidos/domain/order-packing.ts` (flujo de design § 3),
`domain/order-catalog.ts` (`finishPackingAliveById` con `counts` y los tres resultados nuevos),
`lib/modules/asignaciones/domain/finish-packing.ts` (adaptación del tipo); tests: nuevo
`tests/helpers/packed-counts.ts`, `tests/unit/pedidos/order-packing.test.ts`,
`tests/integration/pedidos/finish-with-finished-goods.int.test.ts`, `tests/integration/pedidos/order-packing.int.test.ts`.

Mapa R → test: R15, R16, R18–R22, R30, R32 → `order-packing.test.ts` y `finish-with-finished-goods.int.test.ts`.
Cambia la expectativa de QC-195 R25 en `finish-with-finished-goods.int` a `packaging_stock_insufficient`
(design §§ 2.2 y 3).

## T6 — caso de uso y acción en `asignaciones` (backend_dev, 2026-10-14) · 5f4abc1d

Archivos: `lib/modules/asignaciones/domain/finish-packing.ts` (zod con `lines`, paso de `counts`,
mapeo de resultados), `domain/errors.ts` (`PackedExceedsQuantityError`,
`PackagingStockInsufficientError`), `index.ts`, `adapters/driving/order-packing-actions.ts`
(`finishPackingInputFromFormData`), `lib/modules/errores/domain/{error-codes,error-catalog}.ts`,
`scripts/seed-demo/gateway.ts`; tests: `finish-packing.test.ts`, `order-packing-actions.test.ts`,
`authorization.test.ts`, `tests/unit/errores/catalogo.test.ts`,
`tests/integration/asignaciones/{execution-atomicity,finished-orders}.int.test.ts`.

Mapa R → test: R13, R14 → `finish-packing.test.ts` y `order-packing-actions.test.ts`.
`execution-atomicity` «R18, R24» pasa a `packaging_stock_insufficient`.

Verificación tanda 2 (T5–T6): typecheck verde, lint 0 errores, tests propios y 76 guardias verdes.
Rojo ajeno visto: `tests/integration/proveedores/catalog-line.int.test.ts` R32 (el diff no toca proveedores).

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

## Fix T10 — import de cliente (frontend_dev, 2026-10-15)

Causa: `finished-product-distribution-table.tsx` (`'use client'`) importaba `movementReasonLabel`
del barrel `@/app/(private)/inventario/components`, que reexporta secciones de servidor
(`next/headers` via `lib/composition`). Rompia `next build` y la ruta en dev.

Arreglo: la tabla recibe `reasonLabels` por prop, el mismo mapa `REASON_LABELS` que
`finished-product-list-section.tsx` (servidor) ya pasaba a la tabla de movimientos.

Archivos:
- `app/(private)/inventario/producto-terminado/[id]/components/finished-product-distribution-table.tsx`
- `app/(private)/inventario/producto-terminado/[id]/components/finished-product-list-section.tsx`
- `tests/unit/inventario-ui/finished-product-tables.test.tsx` (pasa `reasonLabels`; el motivo
  se comprueba contra la etiqueta recibida)
- `tests/unit/inventario/producto-terminado/finished-product-route-contract.test.ts`: nueva
  guardia «ningun modulo de cliente de la ruta importa valores del barrel de /inventario» + su
  prueba de mordida; `listFinishedProductDistributionAction` añadida a `LECTURAS_PERMITIDAS`
  (la guardia R7/R36 estaba roja desde T10 por no listarla).

Por que no lo cazo nada: la guardia R16 del contrato saltaba los modulos de cliente a proposito
(solo miraba llamadas de servidor), y la R14 de `guard-arquitectura-modulos` solo mira imports
DIRECTOS de `lib/composition` / adaptadores driven desde `'use client'`, no transitivos via un
barrel de `app/`. Una guardia generica transitiva seria una mejora al arnes (`/afinar-regla`).

Resultados:
- `pnpm run typecheck`: verde.
- `pnpm run lint`: 0 errores, 7 avisos ajenos a estos archivos (eslint de los tocados: limpio).
- `pnpm exec vitest run guard`: 76/76 archivos, 1069 pasan, 20 omitidos.
- `pnpm exec vitest related --run <tocados>`: 5/5 archivos, 57/57 tests.
- E2E chromium `envases-reales-empaque.spec.ts` + `detalle-de-producto-terminado.spec.ts`:
  5 passed (55.9s).

Veredicto: el import de cliente de T10 queda resuelto y protegido por guardia; E2E verdes.

## Cierre (T13) — consolidado del implementer (2026-10-15)

Commits de la tanda 4: 3af625b2 (pedido sin unidad), ded3d3d8 («Conteo físico»), 9e2ffedf (pliegue
animado), a2f17589 (T11), 2b65ee48 (T12), 6f478b49 (fix de T10: la tabla de Reparto importaba el
barrel de servidor de inventario desde un archivo `'use client'`; rompía `next build` y la página
`/inventario/producto-terminado/[id]`).

Fuera de «Archivos esperados» en esta tanda: `app/(private)/inventario/components/movement-reason-label.ts`,
`tests/unit/inventario/batch-history.test.tsx`, `tests/unit/inventario/adjust-batch-dialog.test.tsx`,
`e2e/ajuste-de-inventario.spec.ts`, `tests/unit/asignaciones-ui/packing-order-page.test.tsx`,
`tests/unit/paridad/asignacion-acondicionamiento-paridad.test.tsx`,
`tests/guards/guard-identificador-de-request.test.ts` (alta del spec E2E nuevo en `E2E_ESPERADOS`),
`tests/unit/inventario/producto-terminado/finished-product-route-contract.test.ts` (regresión del
import de cliente + `listFinishedProductDistributionAction` en `LECTURAS_PERMITIDAS`). Sumando tandas
anteriores, `git diff --name-only cfa2511e..HEAD` da 62 archivos fuera de la lista (fixtures y
contratos ya anotados en cada tanda).

### Mapa R<n> → test (consolidado)
- R1: `packing-finish-dialog.test.tsx` «R1: una fila por línea…prellenado con el plan»; `packing-order-screen.test.tsx` «R1: «Terminar» del pie abre…»; `get-packing-order.test.ts` «QC-281 … R1…»; pedido sin unidad: `packing-order-screen.test.tsx` (tanda 4)
- R2: `packing-count.test.ts`; `packing-finish-dialog.test.tsx` «R2: vacío →…», «R2: solo entra un entero…»
- R3: `packing-count.test.ts`; `packing-finish-dialog.test.tsx` «R3: todo igual al plan…», «R3: volver al plan…» (pliegue, tanda 4)
- R4: `packing-finish-dialog.test.tsx` «R4: al pasar de menos a más…se vacía»
- R5: `packing-count.test.ts`; `packing-finish-dialog.test.tsx` «R5, R13: «Otro» abre…»
- R6: `packing-count.test.ts`; `packing-finish-dialog.test.tsx` «R6: Terminar…sin motivo…»
- R7: `packing-count.test.ts`; `packing-finish-dialog.test.tsx` «R7: el pie «Envasado…» se ve siempre»
- R8: `packing-count.test.ts`; `packing-finish-dialog.test.tsx` «R8: Galón 16 supera 72 L…»
- R9: `packing-finish-dialog.test.tsx` «R9: Botella 19 pide 4 vacías…»; `get-packing-order.test.ts` «R9: freePackages…»; E2E `envases-reales-empaque.spec.ts` (rechazo por stock)
- R10: `packing-finish-dialog.test.tsx` «R3, R10…», «R10: …plural»
- R11: `packing-finish-dialog.test.tsx` «R11: «Cancelar» cierra sin enviar»; `packing-order-screen.test.tsx` «R11…»
- R12: `get-packing-order.test.ts`, `list-packing-orders.test.ts` «QC-281 R12…»; `packing-orders-columns.test.tsx` «R12…»; `packing-order-screen.test.tsx` «R12…»
- R13: `packing-count.test.ts`; migración `order-presentation-lines-packed-count-migration.test.ts`; `order-packing.test.ts` «R13, R22…»; `finish-packing.test.ts`; `order-packing-actions.test.ts`
- R14: `finish-packing.test.ts` «R14: sin `empaque.modificar` rechaza antes de validar…», «R14: …`OrderPackingTakenError`»; `get-packing-order.test.ts` «R1, R14…»
- R15: `packing-count.test.ts`; `order-packing.test.ts` y `finish-with-finished-goods.int.test.ts` «R15, R22: …packed_exceeds_quantity…»
- R16: `order-packed-counts.int.test.ts`; migración; `finish-with-finished-goods.int.test.ts`; `packing-finish-dialog.test.tsx` «R1, R16…»
- R17: `settle-packaging.int.test.ts`; E2E `envases-reales-empaque.spec.ts`
- R18: `settle-packaging.int.test.ts`; `order-packing.test.ts` y `finish-with-finished-goods.int.test.ts` «R18, R22…»; E2E
- R19: `settle-packaging.int.test.ts`; `packing-count.test.ts`; `finish-with-finished-goods.int.test.ts`; E2E
- R20: `finish-with-finished-goods.int.test.ts`; E2E (lotes con real × contenido)
- R21: `finish-with-finished-goods.int.test.ts`; `order-packing.test.ts`; E2E (coste unitario = coste / total real)
- R22: `order-packing.test.ts` y `finish-with-finished-goods.int.test.ts` «R13/R15/R18, R22: …no cambia nada»
- R23: `conditioning-batch-data.test.ts`, `finish-conditioning.test.ts`, `get-conditioning-order.test.ts`, `order-distribution-view.test.ts` «QC-281 R23…»; E2E (línea en 0, acondicionamiento no bloqueado)
- R24: `deliver-order.test.ts`, `get-order-delivery.test.ts` (envases reales en la entrega)
- R25: `packing-count.test.ts`; `conditioning-batch-data.test.ts`; `packed-lines-directory.int.test.ts` «una linea empacada antes de contar…»; `get-packing-order.test.ts` «R25…»
- R26: `list-finished-product-distribution.test.ts`; `packed-lines-directory.int.test.ts`; `finished-product-tabs.test.tsx`, `finished-product-params.test.ts`; E2E
- R27: `finished-product-tables.test.tsx`; `list-finished-product-distribution.test.ts`; `packed-lines-directory.int.test.ts`; E2E (−1/+1, motivo, «Sin lote»)
- R28: `finished-product-tables.test.tsx` «R28 — Reparto: …» (vacío, error con «Reintentar», paginación)
- R29: `settle-packaging.int.test.ts`, `order-packed-counts.int.test.ts`, `packed-lines-directory.int.test.ts`, `list-finished-product-distribution.test.ts`, `get-packing-order.test.ts` «R29…»
- R30: `order-packing.test.ts` y `finish-with-finished-goods.int.test.ts` «R30: …not_packable…»
- R31: guardia de dependencias del gate (sin dependencias nuevas; `package.json` sin cambios en la feature)
- R32: `packing-finish-dialog.test.tsx` «R32…»; `finish-with-finished-goods.int.test.ts`; `order-packing.test.ts`
- R33: `packing-finish-dialog.test.tsx` «R33…» (2); `packing-order-evidence.test.tsx` «R23, R33…»

### Verificación de la tanda 4 (salida real reportada por los subagentes)
- `pnpm run typecheck`: sin errores (tras cada commit).
- `pnpm run lint`: 0 errores, 7 warnings preexistentes en archivos no tocados.
- `pnpm exec vitest run guard`: 76/76 archivos, 1069 passed, 20 skipped.
- `vitest related`: 214/214 (sin unidad), 434/434 (tilde), 218/218 (pliegue), 57/57 (fix T10).
- E2E chromium: ajuste-de-inventario 4/4, empaque 1/1, envases-del-pedido 2/2, operario-rediseno 20/20,
  pasos-de-envasado 1/1, pedido-en-varias-presentaciones 2/2, envases-reales-empaque 3/3,
  detalle-de-producto-terminado 2/2. envases-reales-empaque también 3/3 en webkit (con el fix de T10).
- `./init.sh`: no corrido por instrucción del leader; lo cubre `gate-completo` en el PR.

Pendiente: T9 sin marcar (revisión visual humana 1440/1024/390, incluido el pliegue animado y la
nota de pedido sin unidad).

## Fixes de review B1 y m3 (frontend_dev, 2026-10-15)

- **B1:** `Fold` se reescribe como `FoldPanel`, que compone `Collapsible`/`CollapsibleContent` (Base UI).
  - El raíz lleva `contents` y el panel es el elemento de la rejilla.
  - La animación es la misma: filas de 0fr a 1fr, 10 px y opacidad, en `--dur-base`, entrando con `--ease-enter` y saliendo con `--ease-exit`. Va por `data-starting-style`/`data-ending-style`.
  - Base UI se encarga de montar y desmontar.
  - Se quedan dos cosas propias: `inert`/`aria-hidden` al plegarse (Base UI no las pone durante la salida) y el contenido congelado mientras se pliega.
  - El recorte solo se aplica mientras se mueve. Reduced-motion lo sigue resolviendo la regla global.
  - Tests:
    - `packing-finish-dialog.test.tsx`: se reescribe el bloque de pliegue. Afirmaba `data-state`, las clases `starting:` y el desmontaje en `transitionend` de `Fold`. Ahora afirma `data-open`/`data-closed`/`data-ending-style`, `isConnected` y el desmontaje cuando acaba `getAnimations`. jsdom finge la transición y el alto.
    - Caso nuevo de R3: el anillo de foco no se recorta.
    - R3 «volver al plan» pasa a usar `waitFor`.
    - `confirmaciones-paridad` snapshot: +1 div `contents`.
- **m3:** `reasons` se deriva de `movementReasonLabel`, importado directamente del archivo `app/(private)/inventario/components/movement-reason-label`.
  - No se usa el barrel porque arrastra código de servidor.
  - `otro` sigue literal porque `MovementReason` no lo incluye.

R → test: R3 → los 4 casos de «el bloque de motivo se despliega y se pliega»; R5 → «R5: el texto de «Otro» se pliega igual…».
Comandos:
- typecheck: verde.
- lint: 0 errores y 7 warnings preexistentes.
- guard: 76/76 archivos (1069 passed, 20 skipped).
- vitest related: 8 archivos, 219/219.
- E2E `envases-reales-empaque` en chromium: 3/3, con `.env` + `.env.local` del repo principal exportados.

Veredicto: B1 y m3 resueltos sin dependencias nuevas.

## Merge de origin/dev (QC-283, QC-284) y m2 (backend_dev, 2026-10-15)

Archivos:
- Conflictos resueltos como union: `tests/guards/guard-identificador-de-request.test.ts`,
  `tests/integration/aislamiento.json` y `tests/unit/asignaciones/finish-conditioning.test.ts`.
  En este ultimo quedan el bloque QC-283 R6 y el bloque QC-281 R23/R25; el `montar` de dev ya
  acepta `packedPackages`.
- m2: `git mv` de la migracion a `20261015120200_order_presentation_lines_packed_count`.
  Va despues de las dos de QC-283 (`...120000`, `...120100`), que tocan `order_execution_entries`
  y su enum; la nuestra solo toca `order_presentation_lines`.
  Referencias actualizadas: MIGRACIONES_ESPERADAS, `tasks.md > Archivos esperados` y esta bitacora.
  El test de esquema localiza la migracion por sufijo y gana un caso: su instante no lo comparte
  ninguna otra migracion.
- `tests/integration/pedidos/order-repository.int.test.ts`: la expectativa del resumen no tenia
  `presentationContent` ni `packagingProductId`, que T7 (`4e5cd569`) anadio a la linea.
  Era un rojo propio, anterior al merge.
- Base local: `_prisma_migrations.migration_name` pasa del nombre viejo al nuevo, con el mismo
  checksum. Despues, `db:migrate` responde «No pending migrations».

R23 y R25 tras el merge:
- `conditioning-batch-data.ts:35-37`: `effectivePackages(line) > 0`.
- `conditioning-order-view.ts:164-170`: `packages` real en la fila.
- QC-283 no anade lecturas de `packages`: la foto del guardado sale de los lotes del pedido, asi
  que una linea en 0 no aparece.

Salidas:
- typecheck: 0 errores.
- lint: 0 errores y 7 avisos, ninguno en archivos tocados.
- guard: 76/76 archivos (1069 passed, 20 skipped).
- related (node y ui): 354 de 356 archivos verdes. Los dos rojos no son de QC-281:
  - `inventario-paridad`: tambien rojo en dev, porque la columna «Tipo» de QC-284 no esta en
    el snapshot.
  - `session-once-per-request-render`: timeout por carga; aislado da 12/12.
- integracion: 41 archivos (pedidos, inventario y asignaciones tocados), 378 passed y 2 failed.
  Los 2 eran `order-repository`; tras la correccion da 13/13.

Veredicto: merge resuelto con R23/R25 intactos. Queda un rojo heredado de dev (`inventario-paridad`).
