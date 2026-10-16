# QC-263 — rediseno-inventario · tasks.md

Verificación de cada tanda (`docs/perfil-agentes.md > Todos los agentes`): `pnpm run typecheck`,
`pnpm run lint`, `pnpm exec vitest related --run <archivos de la tanda>` y
`pnpm exec vitest run guard`. Los E2E se corren por spec (`pnpm exec playwright test <spec>`) en la
tanda 7.

`[P]` = puede ir en paralelo con las otras `[P]` de su tanda. Antes de la tanda 1, el humano cierra
P1–P16 de `requirements.md` (o acepta los valores por defecto).

## Tanda 0 — Censo y comprobaciones (antes de tocar producción)

- [x] **T0a. Censo con grep.** Repetir el barrido de `design.md > 7` en `tests/unit`, `tests/guards`,
  `tests/integration` y `e2e` para cada símbolo, texto o testid que la ficha cambia o mueve:
  `ProductTypeTabs`, `onNavigate`, `Mostrando todos los tipos`, `Filtrando por`, `routerMock.push`
  en tests de inventario, `product-row-actions`, `product-stock`, `data-table-cell-name`,
  `data-alert`, `text-destructive` en celdas de inventario, `ProductBatchesPanel`,
  `renderBatchDetail`, `renderBatchActions`, `product-batch-`, `batch-history-trigger`,
  `adjust-batch-open`, `adjust-batch-recorded-stock`, `adjust-batch-reason-error`, `Elegi un motivo`,
  `Conteo fisico`, `movementReasonLabel`, `inventory-import-back-link`, `inventory-import-template`,
  `ImportStatusLabel`, `statusFilterTestId`, `Todas (`, `RowActionMenuItem`. Anotar también el spec de
  origen de los R5 y R17 de `product-page.test.tsx`. Comprobar en `origin/dev` si QC-262 ya mergeó
  `separatorBefore` (decide T1a). *Hecho:* `progress/impl_QC-263.md` tiene la tabla «archivo → qué
  nombra → qué le pasa» y la decisión de T1a; todo archivo que salga y no esté en
  `## Archivos esperados` se añade a esa sección en el mismo commit.
- [x] **T0b. Medidas con el servidor de desarrollo.** A 1440, 820 y 390 px: ancho del contenedor de la
  tabla de `/inventario` (¿tarjetas a 820?), del `DataTable` dentro del panel «Lotes» a 900 px y del
  diálogo de historial a 1000 px; selector real del ancho de `SheetContent` en
  `components/ui/sheet.tsx` (no se edita); si el esqueleto de la tabla casa con las tarjetas (D53).
  *Hecho:* las medidas y el selector quedan en el impl; una desviación de `design.md > D6–D8` se anota
  como tal antes de la tanda 2.

## Tanda 1 — Pieza compartida (depende de T0a)

- [x] **T1a. Separador en `RowActionsMenu`** — no aplica (a6a224e5, QC-262). (D12, R14) — **solo si T0a dice que QC-262 no lo ha
  mergeado**. `separatorBefore?` en `RowActionMenuItem`, separador en el desplegable y en el diálogo
  centrado, nunca delante del primer ítem pintado. Test
  `tests/unit/shared-ui/row-actions-menu-separator.test.tsx`: con la prop hay un `role="separator"`
  justo antes del ítem en los dos modos; en el primer ítem no; sin la prop, el árbol de
  `row-actions-menu-centrado.test.tsx` no cambia. El leader avisa antes al dueño de QC-262.
  *Hecho:* tests en verde; si QC-262 ya lo tiene, la tarea se marca «no aplica» con el commit de `dev`.
- [x] **T1b. Catálogo** — no aplica: la fila ya lista `separatorBefore` (a6a224e5); guardias en verde (R44; depende de T1a, si aplica). Fila de `RowActionsMenu` con
  `separatorBefore` en «Puntos de extensión». *Hecho:*
  `pnpm exec vitest run guard-catalogo-de-componentes catalogo-qc256` en verde.

## Tanda 2 — `/inventario`: cabecera, pestañas, columnas (depende de T0b) [P con la 5]

- [ ] **T2a [P]. Cabecera** (D1, R1, R2). `page.tsx` con `PageShell` + `PageHeader`. Test en
  `product-page.test.tsx`: un único `h1` «Inventario» con `inventario-title`; «Importar» (con permiso)
  antes de «Nuevo producto»; sin permiso de importar, solo «Nuevo producto».
- [ ] **T2b [P]. Pestañas** (D2, R3–R5). `productTypeTabHref` en `product-list-params.ts`;
  `ProductTypeTabs` sobre `UrlTabs`. Test `tests/unit/inventario/product-type-tabs.test.tsx`: cinco
  pestañas en orden, cada una enlace con el `href` que hoy daba `handleChange` (página 1, tipo puesto
  o quitado, búsqueda y orden intactos), la vigente `aria-selected`, lista «Filtrar por tipo de
  producto», sin «Mostrando…» ni «Filtrando por…». `product-list-params.test.ts` cubre
  `productTypeTabHref`. `product-page.test.tsx` (R5 de hoy) pasa a afirmar el `href`.
- [ ] **T2c [P]. Columnas y aviso** (D3, R6–R8). `align: 'end'`, «Disponible» en negrita y
  `stockAmountCell` en ámbar. Test `tests/unit/inventario/product-stock-alert.test.tsx`: por debajo
  de la alerta, `data-alert="true"`, clase `text-warning-text`, sin `text-destructive`, icono
  `aria-hidden`, `title` y texto oculto «Por debajo de la alerta de cantidad»; igual en la línea de
  producto terminado; en la alerta exacta y por encima, nada. `product-page.test.tsx` (R17 de hoy)
  enmendado. *Hecho:* snapshot de `inventario-paridad` actualizado con la fila de `design.md > 6`.

## Tanda 3 — Menú de fila, anfitrión y tarjetas (depende de T1a si aplica, y de T2)

- [ ] **T3a. Menú como datos** (D4, R9, R10). `productRowActionsSpec` y `ProductRowActions` como
  envoltorio. Test `tests/unit/inventario/product-row-actions.test.tsx`: orden Lotes, Historial,
  Ajustar existencia, Editar, separador, Borrar destructivo; sin `canAdjust` no hay «Ajustar
  existencia»; testids y `triggerLabel` de hoy; `title` = nombre.
- [ ] **T3b. Anfitrión por tabla** (D5, R11, R12). `product-row-dialogs.tsx` con `batchTarget`;
  `ProductTable` y `FinishedStockTable` con `actionsColumn({ menu })` y un solo anfitrión. Test
  `tests/unit/inventario/product-row-dialogs.test.tsx`: «Lotes», «Editar» y «Borrar» abren el panel o
  diálogo de hoy con el producto de la fila; «Historial» y «Ajustar» con un lote abren ese lote, con
  cero o con varios abren «Lotes», con error de lectura abren «Lotes» con su error; en producto
  terminado se usa el `loadBatches` de la línea; un solo panel montado a la vez.
  `finished-stock-table.test.tsx` actualizado. *Hecho:* snapshot de `acciones-por-fila` actualizado
  con la fila de `design.md > 6`.
- [ ] **T3c. Tarjetas** (D6, R13). `card` en las dos tablas y `cardActions` / `closeMenu`. Test
  `tests/unit/inventario/product-cards.test.tsx` (con el ayudante de ancho de contenedor que usan los
  tests de tarjetas): imagen, nombre, cifras y aviso en la tarjeta; «Acciones» de 44 px que abre el
  menú centrado con el nombre como título e ítems de 48 px; en producto terminado, número de pedido
  y sin «Disponible». Los tests de `design.md > 7` que contaban celdas de página se acotan al cuerpo
  visible.

## Tanda 4 — Lotes, historial y ajuste (depende de T3b)

- [ ] **T4a. Panel «Lotes» como tabla** (D7, R15–R20). `product-batch-columns.tsx`,
  `ProductBatchesPanel` sobre `DataTable` local con `batchMenu`, `ProductBatchesSheet` con la etiqueta
  «Lotes», el ancho y el menú de lote. Tests: `product-batches-panel.test.tsx` (columnas y testids de
  celda, envases, línea de presentación, vacío, «Sobre-reservado» con `StatusBadge` `danger`, tarjeta
  con «Acciones»), `product-batches-sheet.test.tsx` (etiqueta, estados de hoy, menú del lote con
  «Historial» y «Ajustar existencia» solo con permiso, se vuelven a pedir los lotes tras ajustar),
  `envase-en-inventario.test.tsx`. Enmiendas en `tablas-marca.test.tsx` (R12) y `badges-estado.test.tsx`
  (R7).
- [ ] **T4b [P]. Historial en diálogo** (D8, D9, R21–R23, R24). `BatchHistory` controlado, tabla y
  tarjetas, mapa de motivos con tilde, sin `TOUCH_TARGET`. Test `batch-history.test.tsx`: título con
  el lote, ocho columnas, «—» en lo nulo, «Sistema», pide una sola vez, estados de hoy,
  `movementReasonLabel('conteo_fisico') === 'Conteo físico'`; cerrar no cierra el panel de lotes.
- [ ] **T4c [P]. Ajuste** (D10, R24–R26). Test `adjust-batch-dialog.test.tsx`: descripción
  «<producto> · Lote <lote>», existencia registrada como campo deshabilitado, flecha de la
  diferencia, «Elige un motivo.» bajo el campo con `aria-invalid` y `aria-describedby`, ayuda de
  aumento solo al aumentar, motivos con tilde, modo controlado sin disparador; el envío y el resto de
  avisos como hoy.

## Tanda 5 — `/inventario/importar` (depende de T0b) [P con la 2]

- [ ] **T5a [P]. Cabecera** (D13, R29, R30). `importar/page.tsx` con `ArrowLink`, `PageHeader` y la
  plantilla en las acciones. Test `importar-page.test.tsx`: «Volver a inventario» con flecha y su
  testid lleva a `/inventario`; único `h1`; plantilla dentro de `page-header-actions`.
- [ ] **T5b. Barra de pasos** (D14, R31–R33). `import-steps.tsx` e `importStepOf`. Test
  `tests/unit/inventario/importar/import-steps.test.tsx`: `ol` «Pasos» con tres pasos numerados en
  orden, `aria-current="step"` solo en el vigente, sin botones; `importStepOf` para los seis tipos de
  resultado y `null`. `inventory-import-screen.test.tsx`: 1 → 2 → 3 y «Importar otro archivo» → 1.
- [ ] **T5c. Pasos 1 a 3** (D15, R34–R41). Tarjetas, zona de archivo, tonos de las cifras,
  `StatusBadge` en las filas, contador sin paréntesis, tarjetas de filas, botones al final, paso 3
  centrado. Tests: `import-upload.test.tsx` (zona con y sin archivo, aviso de tamaño, `aria-busy` al
  revisar), `import-preview.test.tsx` (tonos, `dt`/`dd` y testids de las cifras, `StatusBadge` con
  `data-status`, «Todas 48»), `import-missing-catalog.test.tsx` (tarjeta de advertencia, columnas),
  `inventory-import-screen.test.tsx` (orden: cifras, faltantes, tabla, botones; resultado con tabla).

## Tanda 6 — Toasts, guardia y limpieza (depende de 3, 4 y 5)

- [ ] **T6a [P]. Toasts** (D11, R27, R28). `UNIT_CREATED_TOAST` y `PRESENTATION_CREATED_TOAST`. Test
  `tests/unit/inventario/inventario-toasts.test.tsx`: un único `toast.success` con su texto al crear,
  editar, ajustar, borrar, crear unidad y crear presentación; ninguno con error.
- [ ] **T6b [P]. Guardia y D41** (D16, R4, R7, R30, R46). `tests/guards/guard-inventario-rediseno.test.ts`
  con sus reglas y un caso en negativo por regla; `guard-piezas-base.test.ts` sin la exclusión de
  `batch-history.tsx`. *Hecho:* `pnpm exec vitest run guard` en verde.
- [ ] **T6c. Catálogo** (R44). Si T1a no aplicó, comprobar que la fila de `RowActionsMenu` que dejó
  QC-262 cubre lo usado. *Hecho:* `guard-catalogo-de-componentes` en verde.

## Tanda 7 — E2E (depende de todas)

- [ ] **T7a. E2E nuevo** `e2e/inventario-rediseno.spec.ts` con los casos de `design.md > 7` (R1–R3,
  R5–R7, R9, R11, R13–R15, R19–R21, R23, R25, R28, R31–R33, R38, R42, R43), midiendo con
  `boundingBox` y estilos computados, y su alta en `E2E_ESPERADOS` de
  `tests/guards/guard-identificador-de-request.test.ts` y en `tests/unit/shared/data-table-alcance.test.ts`
  con el comentario «Alta el <fecha> (QC-263) por el MISMO motivo y en el MISMO sitio que las demas: la
  lista es CERRADA y darse de alta en ella es su punto de extension por diseno. El ancla NO se relaja
  -el archivo se nombra, uno a uno-. Lo que ejercita: …». *Hecho:* pasa en Chromium y WebKit; las dos
  guardias en verde.
- [ ] **T7b. E2E existentes** (R45 y los cambios de `design.md > 7`). Migrar los de la tabla a la fila
  visible, al menú del lote y a «Conteo físico». *Hecho:* cada spec tocado pasa por separado
  (`pnpm exec playwright test <spec>`); los que solo esperan `inventario-title` pasan sin cambios.
- [ ] **T7c. Deudas y cierre.** `progress/deudas.md`: D41 resuelta; D53 ampliada si T0b lo vio; nuevas
  de P4, P9, P10 y del icono del borrado si quedan por defecto. `./init.sh --completo` en verde.

## Trazabilidad R → test

| R | Test |
| --- | --- |
| R1, R2 | `tests/unit/inventario/product-page.test.tsx`, `e2e/inventario-rediseno.spec.ts` |
| R3, R4 | `tests/unit/inventario/product-type-tabs.test.tsx`, `tests/unit/inventario/product-list-params.test.ts` (R3), `tests/guards/guard-inventario-rediseno.test.ts` (R4) |
| R5 | `e2e/inventario-rediseno.spec.ts` |
| R6 | `tests/unit/inventario/product-page.test.tsx`, `tests/unit/marca/tablas-marca.test.tsx`, `e2e/inventario-rediseno.spec.ts` |
| R7, R8 | `tests/unit/inventario/product-stock-alert.test.tsx`, `tests/guards/guard-inventario-rediseno.test.ts` (R7), `e2e/inventario-rediseno.spec.ts` (R7) |
| R9, R10 | `tests/unit/inventario/product-row-actions.test.tsx`, `tests/unit/paridad/acciones-por-fila.test.tsx` |
| R11, R12 | `tests/unit/inventario/product-row-dialogs.test.tsx`, `tests/unit/inventario/finished-stock-table.test.tsx` (R12), `e2e/inventario-rediseno.spec.ts` (R11) |
| R13 | `tests/unit/inventario/product-cards.test.tsx`, `e2e/inventario-rediseno.spec.ts` |
| R14 | `tests/unit/shared-ui/row-actions-menu-separator.test.tsx`, `e2e/inventario-rediseno.spec.ts` |
| R15, R16, R17 | `tests/unit/inventario/product-batches-panel.test.tsx`, `tests/unit/marca/badges-estado.test.tsx` (R17) |
| R18, R20 | `tests/unit/inventario/product-batches-sheet.test.tsx`, `e2e/inventario-rediseno.spec.ts` (R20) |
| R19 | `tests/unit/inventario/product-batches-panel.test.tsx`, `e2e/inventario-rediseno.spec.ts` |
| R21, R22, R23 | `tests/unit/inventario/batch-history.test.tsx`, `e2e/inventario-rediseno.spec.ts` (R21, R23) |
| R24, R25, R26 | `tests/unit/inventario/adjust-batch-dialog.test.tsx`, `e2e/inventario-rediseno.spec.ts` (R25), `e2e/ajuste-de-inventario.spec.ts` (R24) |
| R27, R28 | `tests/unit/inventario/inventario-toasts.test.tsx`, `e2e/inventario-rediseno.spec.ts` (R28) |
| R29 | `tests/unit/inventario/importar/importar-page.test.tsx` |
| R30 | `tests/guards/guard-inventario-rediseno.test.ts` |
| R31, R32 | `tests/unit/inventario/importar/import-steps.test.tsx`, `tests/unit/inventario/importar/inventory-import-screen.test.tsx`, `e2e/inventario-rediseno.spec.ts` |
| R33 | `e2e/inventario-rediseno.spec.ts` |
| R34 | `tests/unit/inventario/importar/import-upload.test.tsx` |
| R35, R36, R38, R39 | `tests/unit/inventario/importar/import-preview.test.tsx`, `e2e/inventario-rediseno.spec.ts` (R38) |
| R37 | `tests/unit/inventario/importar/import-missing-catalog.test.tsx` |
| R40, R41 | `tests/unit/inventario/importar/inventory-import-screen.test.tsx`, `e2e/inventario-importar.spec.ts` |
| R42, R43 | `e2e/inventario-rediseno.spec.ts` |
| R44 | `tests/guards/guard-catalogo-de-componentes.test.ts`, `tests/unit/shared-ui/catalogo-qc256.test.ts` |
| R45 | `e2e/inventario.spec.ts`, `e2e/inventario-importar.spec.ts`, `e2e/ajuste-de-inventario.spec.ts`, `e2e/producto-terminado.spec.ts`, `e2e/reserva-de-material.spec.ts`, `e2e/aislamiento-inventario.spec.ts` |
| R46 | `tests/guards/guard-inventario-rediseno.test.ts`, `tests/guards/guard-piezas-base.test.ts` |

## Archivos esperados

Producción:

- `app/(private)/inventario/page.tsx`
- `app/(private)/inventario/components/index.ts`
- `app/(private)/inventario/components/product-type-tabs.tsx`
- `app/(private)/inventario/components/product-list-params.ts`
- `app/(private)/inventario/components/product-table.tsx`
- `app/(private)/inventario/components/product-columns.tsx`
- `app/(private)/inventario/components/product-columns-skeleton.ts`
- `app/(private)/inventario/components/product-list-section.tsx`
- `app/(private)/inventario/components/product-row-actions.tsx`
- `app/(private)/inventario/components/product-row-dialogs.tsx`
- `app/(private)/inventario/components/finished-stock-table.tsx`
- `app/(private)/inventario/components/finished-stock-columns.tsx`
- `app/(private)/inventario/components/finished-stock-list-section.tsx`
- `app/(private)/inventario/components/product-batches-sheet.tsx`
- `app/(private)/inventario/components/product-batches-panel.tsx`
- `app/(private)/inventario/components/product-batch-columns.tsx`
- `app/(private)/inventario/components/batch-history.tsx`
- `app/(private)/inventario/components/adjust-batch-dialog.tsx`
- `app/(private)/inventario/components/delete-product-dialog.tsx`
- `app/(private)/inventario/components/product-sheet.tsx`
- `app/(private)/inventario/components/movement-reason-label.ts` (D9: `movementReasonLabel` vive aquí desde ded3d3d8, QC-281; censo T0a)
- `app/(private)/inventario/importar/page.tsx`
- `app/(private)/inventario/importar/components/index.ts`
- `app/(private)/inventario/importar/components/inventory-import-screen.tsx`
- `app/(private)/inventario/importar/components/import-steps.tsx`
- `app/(private)/inventario/importar/components/import-upload-field.tsx`
- `app/(private)/inventario/importar/components/import-preview-summary.tsx`
- `app/(private)/inventario/importar/components/import-preview-table.tsx`
- `app/(private)/inventario/importar/components/import-result-summary.tsx`
- `app/(private)/inventario/importar/components/import-missing-catalog.tsx`
- `app/(private)/inventario/importar/components/import-create-unit-dialog.tsx`
- `app/(private)/inventario/importar/components/import-create-presentation-dialog.tsx`
- `app/(private)/inventario/importar/components/import-template-button.tsx`
- `app/(private)/inventario/importar/components/import-file-rejection.tsx`
- `app/(private)/inventario/importar/components/import-texts.ts`
- `components/shared/row-actions-menu.tsx` (solo si T1a aplica; compartido con QC-262)
- `components/shared/data-table/data-table-types.ts` (solo si `RowActionsSpec` necesita `triggerDataAttributes`, D4)
- `components/shared/CATALOGO.md`

Tests y guardias:

- `tests/unit/inventario/product-page.test.tsx`
- `tests/unit/inventario/product-list-params.test.ts`
- `tests/unit/inventario/product-type-tabs.test.tsx`
- `tests/unit/inventario/product-stock-alert.test.tsx`
- `tests/unit/inventario/product-row-actions.test.tsx`
- `tests/unit/inventario/product-row-dialogs.test.tsx`
- `tests/unit/inventario/product-cards.test.tsx`
- `tests/unit/inventario/finished-stock-table.test.tsx`
- `tests/unit/inventario/product-batch-rows.test.tsx` (sub-filas de lote de dev; censo T0a)
- `tests/unit/inventario/producto-terminado/finished-product-route-contract.test.ts` (origen de `movementReasonLabel` en el barrel; censo T0a)
- `tests/unit/shared-ui/confirm-dialog-montado.test.tsx` (monta `ProductTable` y abre el borrado; censo T0a)
- `tests/unit/inventario/product-batches-panel.test.tsx`
- `tests/unit/inventario/product-batches-sheet.test.tsx`
- `tests/unit/inventario/batch-history.test.tsx`
- `tests/unit/inventario/adjust-batch-dialog.test.tsx`
- `tests/unit/inventario/inventario-toasts.test.tsx`
- `tests/unit/inventario-ui/envase-en-inventario.test.tsx`
- `tests/unit/inventario/importar/import-steps.test.tsx`
- `tests/unit/inventario/importar/inventory-import-screen.test.tsx`
- `tests/unit/inventario/importar/importar-page.test.tsx`
- `tests/unit/inventario/importar/importar-route-contract.test.ts`
- `tests/unit/inventario/importar/import-preview.test.tsx`
- `tests/unit/inventario/importar/import-upload.test.tsx`
- `tests/unit/inventario/importar/import-missing-catalog.test.tsx`
- `tests/unit/marca/tablas-marca.test.tsx`
- `tests/unit/marca/badges-estado.test.tsx`
- `tests/unit/paridad/inventario-paridad.test.tsx`
- `tests/unit/paridad/__snapshots__/inventario-paridad.test.tsx.snap`
- `tests/unit/paridad/acciones-por-fila.test.tsx`
- `tests/unit/paridad/__snapshots__/acciones-por-fila.test.tsx.snap`
- `tests/unit/paridad/confirmaciones-paridad.test.tsx`
- `tests/unit/paridad/__snapshots__/confirmaciones-paridad.test.tsx.snap`
- `tests/unit/paridad/campos-paridad.test.tsx`
- `tests/unit/paridad/__snapshots__/campos-paridad.test.tsx.snap`
- `tests/unit/shared-ui/row-actions-menu-separator.test.tsx` (solo si T1a aplica; compartido con QC-262)
- `tests/unit/shared-ui/row-actions-menu-centrado.test.tsx` (solo si T1a aplica; compartido con QC-262)
- `tests/unit/shared-ui/catalogo-qc256.test.ts` (celda de `RowActionsMenu`, si T1a aplica)
- `tests/unit/shared/data-table-alcance.test.ts` (lista cerrada de E2E que nombran `data-table`; alta de QC-263)
- `tests/guards/guard-inventario-rediseno.test.ts`
- `tests/guards/guard-piezas-base.test.ts`
- `tests/guards/guard-identificador-de-request.test.ts`
- `tests/guards/guard-catalogo-de-componentes.test.ts`

E2E:

- `e2e/inventario-rediseno.spec.ts`
- `e2e/inventario.spec.ts`
- `e2e/inventario-importar.spec.ts`
- `e2e/ajuste-de-inventario.spec.ts`
- `e2e/reserva-de-material.spec.ts`
- `e2e/producto-terminado.spec.ts`
- `e2e/insumo-por-unidad.spec.ts`
- `e2e/datos-de-lote-en-acondicionamiento.spec.ts`
- `e2e/aislamiento-inventario.spec.ts`
- `e2e/pedido-bloqueado.spec.ts` (nombra `product-stock` en filas de `/inventario`; censo T0a)
- `e2e/helpers/row-actions-menu.ts`

Estado:

- `progress/impl_QC-263.md`
- `progress/deudas.md`
- `progress/features/QC-263.md`
