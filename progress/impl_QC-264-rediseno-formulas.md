# impl QC-264 — rediseno-formulas

Bitácora del implementer (F2.1). Spec: `specs/QC-264-rediseno-formulas/` (R1–R51, enmienda E1–E22,
P1–P18 por defecto). `tasks.md` nombra esta bitácora `progress/impl_QC-264.md`; el leader fijó este
nombre (2026-10-19).

## Tanda 0 — Censo y comprobaciones

### T0a — Censo con grep

Barrido del 2026-10-19 con `grep -rlF` en `tests/unit`, `tests/guards`, `tests/integration` y `e2e`
(lista base de T0a + enmienda). MCP no usado: censo de literales. Sin coincidencias: `RecipeRowActions`,
`name: 'Ingredientes'`, `Asi se leera`, `Quitar la seleccion`, `ya no esta disponible`,
`document-upload-row-reason-`, `getByRole('tab', { name: 'Ingredientes'|'Herramientas' })`, `role: 'alert'`
/ `getByRole('alert'` (en ningún test, tampoco de formula-import). Los `recipe-step-add` /
`recipe-packing-step-add` sin sufijo que quedan son todos aserciones de ausencia (`queryByTestId(...)
.toBeNull()`), coherentes con P16. Coincidencias de `rowActions`, `Quitar` y `document-upload-actions`
en otros módulos (clientes, pedidos, proveedores, asignaciones, integración) no tocan la ruta y no se listan.

| Archivo | Qué nombra | Qué le pasa |
| --- | --- | --- |
| `tests/unit/recetas-ui/recipe-page.test.tsx` | `recipe-row-actions` (`getAllByTestId(...)[0]`, :516 acotado a la celda; :1130 de página entera), `buildRecipeColumns`, `rowActions`, `delete-recipe-dialog` | migra (T2a, T2b): `rowActions`→`menu`; D3: revisar :1130 y `getAllByTestId('data-table-cell-name')` :703 si las tarjetas los duplican |
| `tests/unit/marca/tablas-marca.test.tsx` | `buildRecipeColumns({ rowActions })` | migra (T2b) |
| `tests/unit/shared-ui/confirm-dialog-montado.test.tsx` | monta `RecipeTable`; `recipe-row-actions`, `delete-recipe-dialog`; disparador por `getAllByTestId(...)[0]` (:821) | revisar (T2b): D3 y «un diálogo por tabla»; el `[0]` aguanta el duplicado, pero el diálogo deja de vivir en la fila |
| `tests/unit/shared-ui/row-actions-menu-href.test.tsx` | `recipe-row-actions` solo como testid de un `RowActionsMenu` suelto | sin cambios esperados |
| `tests/unit/paridad/recetas-paridad.test.tsx` + `.snap` | `recipe-row-actions`, `85dvh`, `document-upload-`, mock `getRecipeStepLockAction` | migra (T2b, T3a, T5a, T7a; snapshots aceptados § 6) |
| `tests/unit/paridad/acciones-por-fila.test.tsx` + `.snap` | `delete-recipe-dialog` (snap), mock `document-upload-actions` | migra (T2b) |
| `tests/unit/paridad/confirmaciones-paridad.test.tsx` + `.snap` | `delete-recipe-dialog`, «Quitar» (snap) | migra (T2c, T3d) |
| `tests/unit/paridad/catalogo-paridad.test.tsx` + `.snap` | `document-upload-`, `85dvh` | migra (T1c) |
| `tests/unit/recetas-ui/delete-recipe-dialog.test.tsx` | `delete-recipe-dialog` | migra (T2b, T2c) |
| `tests/unit/recetas-ui/recipe-route-contract.test.ts` | `delete-recipe-dialog.tsx` en lista de archivos, `getRecipeStepLockAction` | revisar (T3a, T4a; barrel con `FormFooterBar`) |
| `tests/unit/recetas-ui/recipe-form.test.tsx` | `recipe-version-link`/`-row`, `recipe-lines-tab-`, `recipe-step-remove-`, `recipe-step-add-`, `recipe-form-preview`, `getRecipeStepLockAction` | migra (T3a, T5a); `recipe-version-link` :708 revisar en T3c |
| `tests/unit/recetas-ui/recipe-version-list.test.tsx` | `recipe-version-link`/`-row`/`-under-review`, `delete-recipe-dialog`, `getByRole('link', 'Nueva versión')` | migra (T3c) |
| `tests/unit/recetas-ui/recipe-version-form.test.tsx` | `recipe-version-form-under-review`, `recipe-lines-tab-`, `recipe-line-mark-`, ausencia de `recipe-packing-step-add` | migra (T6a) |
| `tests/unit/marca/badges-estado.test.tsx` | `recipe-version-under-review`, `recipe-version-form-under-review` | migra (T3c, T6a; § 10) |
| `tests/unit/recetas-ui/recipe-lines-tabs.test.tsx`, `recipe-lines-field-tools.test.tsx`, `recipe-lines-no-finished-product.test.tsx` | `recipe-lines-tab-` | migra/revisar (T3b: nombre accesible con contador) |
| `tests/unit/recetas-ui/recipe-lines-baseline.test.tsx` | `recipe-line-mark-`, `recipe-line-original-` | migra (T6a) |
| `tests/unit/recetas-ui/recipe-version-pages.test.tsx` | `recipe-lines-tab-` | migra (T6a) |
| `tests/unit/recetas-ui/recipe-steps-field.test.tsx` | `-remove-`, `-add-`, `-evidence`, `-row-tools`, «Quitar paso N», «No se puede mover/quitar», «Requiere evidencia» | migra (T4a) |
| `tests/unit/recetas-ui/recipe-step-editor.test.tsx` | «Requiere evidencia» | migra (T4a) |
| `tests/unit/recetas-ui/recipe-form-packing-steps.test.tsx` | `recipe-packing-step-remove-`/`-add-`, ausencia del botón final | revisar (T3a, T4a) |
| `tests/unit/recetas-ui/recipe-form-evidence-lock.test.tsx` | `recipe-form-steps-locked`, `-evidence`, `-row-tools`, `-remove-`, `-add-`, «Requiere evidencia» | revisar (T3a, T4a; R51) |
| `tests/unit/recetas-ui/recipe-version-form-evidence.test.tsx` | «Requiere evidencia» | sin cambios esperados (T6a) |
| `tests/unit/recetas-ui/recipe-form-mensajes-zod.test.tsx` | mock `getRecipeStepLockAction` | sin cambios esperados (T3a) |
| `tests/unit/recetas-ui/recipe-form-propagation.test.tsx` | `propagate-version-row`, `max-h-[85dvh]` (:418) | migra (T3d) |
| `tests/unit/recetas-ui/formula-import-review.test.tsx` | `formula-import-clash`, `-summary`, `recipe-(packing-)step-remove-`/`-add-`, «Quitar» | migra (T7a; choque QC-203) |
| `tests/unit/recetas-ui/formula-import-page.test.tsx` | `formula-import-error-back-link` | migra (T7a; choque QC-203) |
| `tests/unit/navegacion/pantallas-exigen-permiso.test.tsx` | mock `getRecipeStepLockAction` | sin cambios esperados (T2a, T3a) |
| `tests/unit/documentos-ui/document-upload-dialog.test.tsx` | `document-upload-`, `85dvh` (:184) | migra (T1c) |
| `tests/unit/documentos-ui/document-upload-{rows,review-link,selection,a11y-tactil}.test.tsx`, `formula-pdf-upload.test.tsx`, `supplier-detail-upload.test.tsx` | `document-upload-` | migra/revisar (T1c) |
| `tests/unit/documentos-ui/formulas-upload.test.tsx` | `document-upload-`, `ai-provider-required-tooltip` | revisar (T2a) |
| `tests/unit/documentos-ui/document-upload-{flow,errors,strategy}.test.tsx` | `document-upload-` (`row-status`) | sin cambios esperados (T1c) |
| `tests/unit/documentos-ui/use-batch-status.test.tsx` | mock `document-upload-actions` | sin cambios esperados |
| `tests/unit/proveedores-ui/catalog-pdf-upload.test.tsx` | `document-upload-open` (:76) | revisar (T1c: mismo diálogo compartido) |
| `tests/unit/shared/ai-provider-required-tooltip.test.tsx` | `ai-provider-required-tooltip` | sin cambios esperados |
| `tests/unit/shared-ui/switch.test.tsx` | «Requiere evidencia» como etiqueta de ejemplo | sin cambios esperados |
| `tests/integration/recetas/step-evidence-flag.int.test.ts`, `tests/unit/recetas/recipe-actions.test.ts` | «Requiere evidencia» / `getRecipeStepLockAction` en dominio y acciones | sin cambios esperados (fuera de la capa UI) |
| `e2e/versiones-en-la-receta.spec.ts` | `page.getByTestId('recipe-row-actions')` + `toHaveCount(1)` (:313, página entera, D3), `recipe-version-row`, `-under-review`, `getByRole('link', { name, exact })` (:228, :383) | migra (T9b) |
| `e2e/recetas-pasos.spec.ts` | `recipe-row-actions` acotado a `data-table-row-` (:392), `recipe-form-preview` | revisar (T9b; preview en panel) |
| `e2e/formula-desde-pdf.spec.ts` | `formula-import-clash`/`-summary` por testid, `recipe-step-remove-`/`-add-`, `document-upload-` | revisar (T9b) |
| `e2e/pasos-de-envasado.spec.ts` | `recipe-packing-step-add-0` | sin cambios esperados (T9b) |
| `e2e/aislamiento-recetas.spec.ts` | `delete-recipe-dialog.tsx` en comentario | sin cambios esperados (T9b) |
| `e2e/documentos.spec.ts`, `e2e/catalogo-desde-pdf.spec.ts`, `e2e/movimiento.spec.ts` | `document-upload-` | revisar (T9b; `StatusBadge` con mismo testid) |
| `e2e/integraciones-proveedor-ia.spec.ts`, `e2e/modulos-por-empresa.spec.ts` | `document-upload-open`, `ai-provider-required-tooltip` | sin cambios esperados (T9b) |
| `e2e/ejecucion-receta.spec.ts` | «Quitar la foto 1 del paso 1» (evidencia, no la ruta) | sin cambios esperados (T9b) |

**Comprobaciones:**

- `separatorBefore` en `RowActionMenuItem`: sí, `components/shared/row-actions-menu.tsx:54` (uso en `:84`).
- `triggerDataAttributes` en `RowActionsSpec`: no, `components/shared/data-table/data-table-types.ts:65`
  (`Pick<…, 'items' | 'triggerLabel' | 'triggerTestId' | 'title'>`); se usa tipo local (E4).

**Fuera de `## Archivos esperados`.** Los dos de «Revisar» se añadieron a `tasks.md` en el commit
de T0 («solo si cambia»). Los de «Solo corren» no se editan y no se añaden: entrar en la lista los
haría contar como archivos en vuelo y daría choques falsos con otras fichas.

- Revisar: `tests/unit/shared-ui/confirm-dialog-montado.test.tsx`, `tests/unit/proveedores-ui/catalog-pdf-upload.test.tsx`.
- Solo corren sin cambios (ya citados en E19 / T9b, no en la lista): `e2e/integraciones-proveedor-ia.spec.ts`,
  `e2e/modulos-por-empresa.spec.ts`, `e2e/ejecucion-receta.spec.ts`, `tests/unit/shared/ai-provider-required-tooltip.test.tsx`,
  `tests/guards/guard-pantallas-de-anadido.test.ts`, `tests/unit/documentos-ui/use-batch-status.test.tsx`.

### T0b — Diálogos a pantalla completa

Medido con Playwright (Chromium), clases aplicadas un momento y revertidas.

`DialogContent` hoy: `fixed top-1/2 left-1/2`, `translate: -50% -50%`, `max-width: calc(100% - 32px)`,
`sm:max-w-sm`, `p-4`. A 390 px, antes: vista previa 358×136, subida 358×717 (85dvh).

- **Vista previa (D9):** `top-0 left-0 flex h-dvh max-h-dvh w-full max-w-none translate-x-0
  translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0 sm:max-w-none md:top-1/2 md:left-1/2
  md:h-[min(900px,calc(100dvh-64px))] md:w-[min(920px,calc(100vw-48px))] md:-translate-x-1/2
  md:-translate-y-1/2 md:rounded-xl`.
  390×844 → popup 0,0 de 390×844, sin hueco. 1440×900 → 920×836 centrado (32–868).
  `sm:max-w-none` es obligatoria (si no, gana el `sm:max-w-sm` de la base).
- **Subida (D4):** `max-sm:w-[calc(100vw-32px)] sm:max-w-[640px] max-h-[calc(100dvh-32px)]
  overflow-y-auto` (`overflow-y-auto` ya está hoy y se conserva). Con 10 PDF:
  390×844 → 358×812 (16–828), entero, desplaza por dentro. 1440×900 → 640×634, entero, sin
  desplazamiento.

### T0c — Envío con `form=`

- Chromium y WebKit (`page.setContent`): clic = 1 envío; Enter en un campo = 1 envío;
  `button.form.id` correcto. **Pasa.**
- jsdom (vitest `ui`, `Button` real): clic = 1 envío. **Enter en un campo, con dos campos y el botón
  fuera del `<form>`: 0 envíos.** Con el botón dentro, o con un solo campo, Enter envía 1. Límite de
  la simulación de user-event/jsdom (busca el botón por defecto solo entre los descendientes).
- **Abierto (decisión del leader/humano antes de T3a):** el texto de T0c dice «si falla, plan B
  (A4)». Falla solo en jsdom, no en los navegadores. Ver `## Desviaciones`.

### T0d — Pie fijo

`/produccion/formulas/nueva` aún no usa `PageShell`; se inyectaron sus clases y un pie de 73 px. La
página desplaza la ventana.

- Relleno real de `PageShell`: `px-4 pt-4 pb-6` y `md:px-7 md:pt-6 md:pb-8`.
- Sin desplazar, el pie se ve: 390×844 → 771–844, 390 de ancho; 1440×900 → 827–900, 1168 de ancho
  desde x=272.
- Al fondo, el último campo no queda tapado (390: acaba en 751, pie en 771; 1440: 807 / 827).
- **Clase final:** `sticky bottom-0 z-10 -mx-4 -mb-6 md:-mx-7 md:-mb-8` + lo visual de D7.
  `PageShell` no necesita relleno inferior extra.

## Tanda 1 — Piezas compartidas

### T1b — `StepReader` con `layout="panel"` (frontend_dev, 2026-10-19; commit `811bddae`)

- **Archivos:** `components/shared/step-reader/step-reader.tsx` (prop `layout?: 'inline' | 'panel'`,
  solo en `lectura`; testids nuevos solo en `panel`: `step-reader-heading`, `-body`, `-step`,
  `data-layout="panel"`), `tests/unit/recetas-ui/step-reader.test.tsx` (8 casos nuevos; los snapshots
  en línea de `inline` y `ejecucion` se generaron antes de tocar el componente).
- **Mapa:** R26 -> «sin layout / inline, árbol de hoy» y «ejecucion, árbol de hoy aunque reciba
  panel»; R22 -> cabecera y tramos, `Notice` info/warning con `aria-describedby`, `stepBlockReason` y
  `renderStepAddon` en el cuerpo, pie de 44 px; R24 -> `data-direction` = `onStepChange` (también tras
  `stepRequest`), animación 200 ms con `motion-reduce:animate-none`.
- **Salidas:** typecheck verde; lint 0 errores (10 avisos ajenos); `vitest related` 46 archivos,
  997/997; `recipe-route-contract` 28/28.
- **Nota:** `Notice` es `role="status"`; `notice.tsx` no se tocó.

### T1c — Subir PDFs (frontend_dev, 2026-10-19; commit `776b57b2`)

- **Snapshot de `recetas-paridad`:** también cambió, solo en el diálogo de subida que pinta el listado
  (icono del disparador y clases del diálogo, 7 casos). Es la misma pieza; se aceptó en T1c.
  `recetas-paridad` + `catalogo-paridad`: 26/26.

- **Archivos:** `components/shared/document-upload/{document-upload-dialog.tsx, document-upload-row.tsx,
  labels.ts, index.ts}`; test nuevo `tests/unit/documentos-ui/document-upload-tones.test.tsx`;
  migrados `document-upload-dialog.test.tsx` (QC-160 `85dvh` -> `max-h-[calc(100dvh-32px)]`, § 10) y
  `document-upload-convenciones.test.ts` (paquetes de la pieza: `next/link` sale porque el enlace va por
  `ArrowLink`; entra `lucide-react`, ya en el stack); snapshot `catalogo-paridad` (solo el diálogo de
  subida: icono del disparador y clases del diálogo, 7 casos).
- **Hecho:** disparador con `UploadIcon` (sigue `disabled`); diálogo con las clases de T0b; fila con
  icono de documento, fase/estado en `StatusBadge` con `BROWSER_PHASE_TONES`/`FILE_STATUS_TONES`
  (mismos testid y `data-phase`/`data-status`), «Revisar» como `ArrowLink forward sm touch` con su
  testid, error y motivo debajo; `CLEAR_LABEL` y `UNKNOWN_BATCH_LABEL` con tildes. API sin cambios.
- **Mapa:** R7 -> `document-upload-tones` «R7: la ventana…» y `document-upload-dialog` (R15);
  R8 -> `document-upload-tones` «R8: …» (mapas, 4 fases, 4 estados, motivo); R9 -> «R9: Revisar…» y
  «R9: el disparador…»; R45 (subida) -> «R45: Quitar la selección…».
- **Salidas:** `typecheck` 0 errores; `lint` 0 errores, 10 avisos ajenos; `vitest related` 56 archivos,
  925 ok, 1 skip; lista a mano (documentos-ui, catalog-pdf-upload, catalogo-paridad,
  module-contract) 17 archivos, 117 ok. `flow`, `errors`, `strategy` y `catalog-pdf-upload` sin cambios.
- **Veredicto:** T1c lista; la fila de `CATALOGO.md` queda para T1d.

### T1d — Catálogo (frontend_dev, 2026-10-19)

- `components/shared/CATALOGO.md`: fila `StepReader` (alcance con `panel`, punto de extensión
  `layout`, `Diseño` + `Formula.dc.html`, `ModalesProduccion.dc.html`) y fila `DocumentUpload…`
  (alcance con tonos, icono, «Revisar» con `ArrowLink`; extensión `BROWSER_PHASE_TONES` /
  `FILE_STATUS_TONES`; `Diseño` = `Formulas.dc.html`, `ModalesProduccion.dc.html`; `Base de` + 
  `StatusBadge`, `ArrowLink`, que el código ya usa). `RowActionsMenu` sin cambio (E3).
- **Mapa:** R48 -> `tests/guards/guard-catalogo-de-componentes.test.ts`.
- **Salidas:** `guard-catalogo-de-componentes catalogo-qc256` 2 archivos, 65/65; `vitest run guard`
  81 archivos, 1106 ok / 20 skip, 0 rojos. Cierre de tanda: typecheck 0 errores; lint 0 errores,
  10 avisos ajenos.

## Tandas 2–7 (2026-10-19)

En dos olas de frontend_dev en paralelo, con archivos disjuntos: listado (T2a–T2c); formulario
(T3c, T3a, T3d, T5a, único dueño del barrel y de `recipe-route-contract`); pestañas (T3b); pasos
(T4a). Después, versión (T6a) y revisión de importación (T7a). Los snapshots compartidos los
regeneró el implementer al final (`1b61a76b`).

| Tarea | Commit | Archivos principales | Casos nuevos |
| --- | --- | --- | --- |
| T2a | `2825e4ed` | `formulas/page.tsx`, `recipe-page.test.tsx` | R1 ×4 (h1 único, orden e icono, sin permiso, sin proveedor IA deshabilitado en el globo) |
| T2b | `10ef152c` | `recipe-row-actions.tsx`, `recipe-columns.tsx`, `recipe-table.tsx`; `recipe-row-actions-spec.test.tsx` (nuevo), `recipe-cards.test.tsx` (nuevo), `tablas-marca`, `recipe-page` | R3, R4 ×11; R2, R5, R6 ×9 |
| T2c | `215870e1` | `delete-recipe-dialog.tsx` y su test | R50 ×5 |
| T3c | `0e9a2fd2` | `recipe-version-tones.ts` (nuevo), `recipe-version-list.tsx`, barrel; `recipe-version-list.test.tsx`, `badges-estado` | R30 ×4, R31, R14 |
| T3a | `81c1ce45` | `form-footer-bar.tsx` (nuevo), `recipe-form.tsx`, `nueva/page.tsx`, `[id]/page.tsx`, barrel; `recipe-form-layout.test.tsx` (nuevo), `recipe-form-packing-steps` | R10 ×2, R11, R51, R13 ×4, R14, R15 ×6 |
| T3b | `9d4b5254` | `recipe-lines-field.tsx` (pestañas), `recipe-lines-tabs.test.tsx` | R12 ×4 |
| T3d | `45cb196e` | `propagate-versions-dialog.tsx`; `propagate-versions-dialog.test.tsx` (nuevo) | R27 ×2, R28 ×2, R29 ×4 |
| T4a | `3dc779e6`, `4a86a744` | `recipe-steps-field.tsx`, `recipe-step-editor.tsx` y sus tests | R16–R19 ×12 |
| T5a | `70f1fa92` | `recipe-form.tsx`; `recipe-form-preview.test.tsx` (nuevo, no importa `step-reader`) | R21, R22, R23 ×3, R25 ×2 |
| T6a | `a1a9cffe` | páginas de versión, `recipe-version-form.tsx`, `recipe-lines-field.tsx` (marcas); `recipe-version-marks.test.tsx` (nuevo), `recipe-version-pages`, `recipe-version-form`, `badges-estado` | R32, R33 ×7, R34 ×3, R35 ×2, R36 |
| T7a | `4f9d1bd6` | `importar/[documentoId]/page.tsx` y sus 4 componentes; `formula-import-layout.test.tsx` (nuevo), `formula-import-page`, `formula-import-review` | R37–R43 ×12 |
| Snapshots | `1b61a76b` | `recetas-paridad.snap` (7 casos de lista), `confirmaciones-paridad.snap` (icono en 7 borrados) | — |

**Migraciones de tests (por qué):** `recipe-version-list` (el nombre deja de ser enlace, QC-174 en
`design.md > 10`); `badges-estado` («Por revisar» de lista y formulario `info` -> `waiting`, § 10);
`tablas-marca` (`rowActions` -> `menu`; Pasos en mono); `recipe-page` (menú y miniatura acotados a la
fila, por las tarjetas); `recipe-form-packing-steps` (pasos y envasado en tarjetas separadas, sin
`Separator`); `formula-import-review` (choque `role="status"`); `formula-import-page` (enlace de error
por `href` y `data-direction="back"`).

**Choque con QC-203 (T7a):** solo marcado y clases en `formula-import-review`, `formula-ingredient-row`
y `formula-import-summary`; `IngredientRowState`, `toDraftLine`/`toConfirmLine`, `buildConfirmReasons`
y los manejadores no se tocaron. `page.tsx` conserva sus tres primeras líneas.

## Archivos creados / modificados

Ver las tablas de cada tanda. Nuevos: `components/form-footer-bar.tsx`, `components/recipe-version-tones.ts`
(bajo `app/(private)/produccion/formulas/`); tests nuevos: `step-reader` (casos), `document-upload-tones`,
`recipe-row-actions-spec`, `recipe-cards`, `recipe-form-layout`, `recipe-form-preview`,
`propagate-versions-dialog`, `recipe-version-marks`, `formula-import-layout`.

## Mapa R -> test

| R | Test |
| --- | --- |
| R1 | `recipe-page.test.tsx` (T2a); E2E pendiente (T9a) |
| R2, R5, R6 | `recipe-cards.test.tsx`; E2E R2/R5 pendiente |
| R3, R4 | `recipe-row-actions-spec.test.tsx`; E2E R3 pendiente |
| R7, R8, R9 | `document-upload-tones.test.tsx`, `document-upload-dialog.test.tsx` |
| R10, R11, R13, R14, R15 | `recipe-form-layout.test.tsx`, `recipe-version-list.test.tsx` (R14); «Enter guarda» y R13/R15 en E2E pendiente |
| R12 | `recipe-lines-tabs.test.tsx` |
| R16–R19 | `recipe-steps-field.test.tsx`, `recipe-step-editor.test.tsx`, `recipe-form-packing-steps.test.tsx`, `guard-editor-aislado`, `recipe-route-contract` |
| R20 | E2E pendiente (T9a) |
| R21, R23, R25 | `recipe-form-preview.test.tsx` |
| R22, R24, R26 | `step-reader.test.tsx` (y R22 en `recipe-form-preview`) |
| R27, R28, R29 | `propagate-versions-dialog.test.tsx`, `recipe-form-propagation.test.tsx` |
| R30, R31 | `recipe-version-list.test.tsx`, `badges-estado.test.tsx` |
| R32, R36 | `recipe-version-pages.test.tsx`, `recipe-version-form.test.tsx` |
| R33, R34, R35 | `recipe-version-marks.test.tsx`, `badges-estado.test.tsx` |
| R37–R43 | `formula-import-layout.test.tsx`, `formula-import-page.test.tsx`, `formula-import-review.test.tsx` |
| R44, R45 | guardia `guard-formulas-rediseno` pendiente (T8c); R45 de la subida en `document-upload-tones` |
| R46 | `formulas-toasts.test.tsx` pendiente (T8b) |
| R47 | E2E pendiente (T9a) |
| R48 | `guard-catalogo-de-componentes.test.ts` |
| R49 | `recipe-form.test.tsx`, `guard-pantallas-de-anadido`, E2E existentes (T9b) |
| R50 | `delete-recipe-dialog.test.tsx`, `confirmaciones-paridad` |
| R51 | `recipe-form-layout.test.tsx`, `recipe-form-evidence-lock.test.tsx` |

## Salidas de tests

Cierre de las tandas 2–7 (HEAD `1b61a76b`):

- `pnpm run typecheck`: 0 errores.
- `pnpm run lint`: 0 errores, 10 avisos `no-unused-vars` en archivos ajenos.
- `pnpm exec vitest related --run <46 archivos cambiados desde d0eaa824>`: 39 archivos, 718/718.
- `pnpm exec vitest run guard tests/unit/proveedores/module-contract.test.ts tests/unit/paridad tests/unit/marca tests/unit/recetas-ui tests/unit/shared-ui/confirm-dialog-montado.test.tsx tests/unit/documentos-ui`:
  161 archivos, 2450 ok / 20 skip, 0 rojos.

## Desviaciones

- **T3c, nombre accesible de «Abrir».** E12 pedía `Abrir<span className="sr-only"> la versión X</span>`;
  jsdom recorta el espacio inicial y da «Abrirla versión X». Se pinta
  `<span aria-hidden>Abrir</span><span className="sr-only">Abrir la versión X</span>`. `ArrowLink`
  no se toca.
- **T2b, prop interna.** `recipe-route-contract` toma cualquier `xxxAction(` por Server Action; dentro
  de `recipeRowActionsSpec` el `onAction` desestructurado se renombra a `notify`. La firma pública
  sigue siendo `onAction`.
- **T2b, rótulos de la tarjeta (abierto).** El tablero (`Formulas.dc.html:66`) pinta «Pasos N · Creado … ·
  Actualizado …»; D3 no dice cómo, y la pieza que lo hace (`card-field-label.tsx`) vive solo en
  inventario. Las tarjetas salen sin rótulos. Decisión pendiente: subirla a `components/shared`
  (segunda ruta) o deuda.
- **T2b, barrel.** `recipeRowActionsSpec`, `RecipeRowActionsSpec`, `RecipeRowAction` y
  `RECIPE_ROW_ACTION_LABELS` no están en `components/index.ts`; los tests importan del archivo. Ninguna
  `page.tsx` los usa.
- **T3d / T7a, snapshots que no existen.** `confirmaciones-paridad` no tiene caso de propagar y
  `recetas-paridad` no tiene casos de la revisión de importación ni de formulario con datos (solo
  errores): `design.md > 6` los daba por existentes. No se dieron de alta; lo cubren los tests nuevos.
- **T4a.** Sin `opacity-70` en la tarjeta tomada (el tablero no la atenúa). Testids nuevos `-number-N`
  y `-bar`. El tablero de evidencia aún dibuja quitar en tercera columna y botón final: manda la
  enmienda (P16).
- **T5a.** Ya lleva la tilde de `PREVIEW_DESCRIPTION` (parte de T8a; T8a sin marcar).
- **T7a.** Choque en línea, no en diálogo (P9); sin nombre del PDF bajo el `h1` (la página no recibe
  el dato; P10).
- **T1c (antes).** El snapshot de `recetas-paridad` cambió también por la subida del listado.

- **T0c — decidido (humano, 2026-10-19): opción (a).** D6 se mantiene; en jsdom solo el clic; «Enter
  guarda» en el E2E de T9a (Chromium y WebKit); plan B (A4) descartado. Contexto: `form=` funciona en Chromium y WebKit, pero en jsdom el Enter en
  un campo no envía cuando el botón está fuera del `<form>`. Opciones: (a) seguir con D6 (aside fuera
  del form) y comprobar «Enter envía» en el E2E de T9a, dejando en jsdom solo el clic (y, si se
  quiere, `form.requestSubmit()`); (b) plan B A4 literal: `aside` dentro del `<form>` tras comprobar
  que el borrado de versión no envía la receta. Recomendación del implementer: (a), porque el fallo es
  del simulador y el comportamiento real cumple.
