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

## Archivos creados / modificados

## Mapa R -> test

## Salidas de tests

## Desviaciones

- **T0c — decidido (humano, 2026-10-19): opción (a).** D6 se mantiene; en jsdom solo el clic; «Enter
  guarda» en el E2E de T9a (Chromium y WebKit); plan B (A4) descartado. Contexto: `form=` funciona en Chromium y WebKit, pero en jsdom el Enter en
  un campo no envía cuando el botón está fuera del `<form>`. Opciones: (a) seguir con D6 (aside fuera
  del form) y comprobar «Enter envía» en el E2E de T9a, dejando en jsdom solo el clic (y, si se
  quiere, `form.requestSubmit()`); (b) plan B A4 literal: `aside` dentro del `<form>` tras comprobar
  que el borrado de versión no envía la receta. Recomendación del implementer: (a), porque el fallo es
  del simulador y el comportamiento real cumple.
