# QC-264 — rediseno-formulas · tasks.md

Verificación de cada tanda (`docs/perfil-agentes.md > Todos los agentes`): `pnpm run typecheck`,
`pnpm run lint`, `pnpm exec vitest related --run <archivos de la tanda>` y
`pnpm exec vitest run guard`. Los E2E se corren por spec (`pnpm exec playwright test <spec>`) en la
tanda 9.

`[P]` = puede ir en paralelo con las otras `[P]` de su tanda. Antes de la tanda 1, el humano cierra
P1–P15 de `requirements.md` (o acepta los valores por defecto).

> **Enmienda contra dev (2026-10-19)** (`design.md > 12`, E1–E22). Tras el merge de `origin/dev`
> (`6fcbafe6`): T1a no aplica (E3); T0a, T0b, T1b, T1c, T1d, T2a, T2b, T3a, T3c, T4a, T7a, T8a, T9b
> y T9c cambian (nota *Enmienda* en cada una; la de más peso es T4a, por P16); T2c es nueva (R50). Antes de la tanda 1 el humano cierra también **P16–P18** (o acepta su
> defecto). `## Archivos esperados` corregido: sin `recipe-image-field.tsx`, `row-actions-menu.tsx`,
> `data-table-types.ts` ni los tests de `RowActionsMenu`; con los tests de QC-214 y de la subida que
> nombran lo que cambia. Choque aceptado con QC-203 en T7a (`design.md > 9`).

## Tanda 0 — Censo y comprobaciones (antes de tocar producción)

- [x] **T0a. Censo con grep.** Repetir el barrido de `design.md > 7` en `tests/unit`, `tests/guards`,
  `tests/integration` y `e2e` para cada símbolo, texto, testid o nombre accesible que la ficha cambia:
  `recipe-row-actions`, `rowActions`, `RecipeRowActions`, `buildRecipeColumns`, `recipe-version-link`,
  `recipe-version-row`, `recipe-version-under-review`, `recipe-version-form-under-review`,
  `recipe-lines-tab-`, `name: 'Ingredientes'`, `name: 'Herramientas'`, `recipe-line-mark-`,
  `recipe-line-original-`, `recipe-step-remove-`, `recipe-packing-step-remove-`, `recipe-step-add`,
  `Quitar`, `recipe-form-preview`, `Asi se leera`, `85dvh`, `propagate-version-row`,
  `formula-import-clash` (y `role: 'alert'`), `formula-import-summary`, `formula-import-error-back-link`,
  `document-upload-`, `Quitar la seleccion`, `ya no esta disponible`, `getByRole('link'` sobre versiones.
  Mirar además en `dev` si ya están `separatorBefore` en `RowActionMenuItem` y `triggerDataAttributes`
  en `RowActionsSpec` (QC-262, QC-263). *Hecho:* `progress/impl_QC-264.md` tiene la tabla «archivo →
  qué nombra → qué le pasa» y el resultado de las dos comprobaciones; todo archivo que salga y no esté
  en `## Archivos esperados` se añade a esa sección en el mismo commit.
  *Enmienda (E3, E4, E5, E7, E10, E19):* las dos comprobaciones ya están hechas (`separatorBefore` sí,
  `triggerDataAttributes` en `RowActionsSpec` no: tipo local); `recipe-step-add` ya no existe. El
  barrido suma `recipe-step-add-`, `recipe-packing-step-add-`, `-evidence`, `-row-tools`,
  `recipe-form-steps-locked`, `Requiere evidencia`, `No se puede mover`, `No se puede quitar`,
  `ai-provider-required-tooltip`, `document-upload-row-reason-`, `delete-recipe-dialog` y
  `getRecipeStepLockAction`, en los archivos de `design.md > 12 > E19`.
- [x] **T0b. Diálogos a pantalla completa.** Con el servidor de desarrollo, a 390 × 844 y 1440 × 900,
  comprobar cómo `components/ui/dialog.tsx` posiciona `DialogContent` (traslación, `max-w`, relleno)
  y qué clases hacen falta para que la vista previa ocupe `100dvh` sin hueco y el diálogo de subida
  quede entero (D4, D9). *Hecho:* las clases exactas quedan en el impl; `dialog.tsx` no se edita.
  *Enmienda (E14):* se parte de las clases de `batch-evidence-dialog.tsx:42` (QC-271) y solo se mide.
- [x] **T0c. Envío con `form=`.** *Resultado (2026-10-19):* pasa en Chromium y WebKit; en jsdom el
  Enter con el botón fuera no envía (límite del simulador). Humano: opción (a), sigue D6; en jsdom
  solo el clic, «Enter guarda» va en el E2E de T9a; plan B (A4) descartado. Prueba desechable (no se commitea) de un `<Button type="submit"
  form={id}>` fuera del `<form>`: clic y Enter en un campo envían una sola vez en jsdom (vitest `ui`) y
  en WebKit (Playwright). *Hecho:* resultado en el impl; si falla, se aplica el plan B de `design.md >
  D6` (A4) y se anota como desviación antes de la tanda 3.
- [x] **T0d. Pie fijo.** En `/produccion/formulas/nueva` con el servidor de desarrollo, medir si un pie
  `sticky bottom-0` dentro de `PageShell` queda visible sin desplazar a 390 × 844 y 1440 × 900 y si
  tapa el último campo. *Hecho:* clase final en el impl (D7).

## Tanda 1 — Piezas compartidas (depende de T0a, T0b)

- [x] **T1a [P]. Separador del menú — no aplica** (*enmienda E3*: `separatorBefore` y su test ya están
  en `dev`; tampoco se toca `RowActionsSpec`, E4). Texto aprobado, para el reviewer:
  ~~Separador del menú~~ (D2, R3; P15). Solo si T0a dice que no está en `dev`:
  `separatorBefore` en `RowActionMenuItem` con el contrato de QC-262 D7; test
  `tests/unit/shared-ui/row-actions-menu-separator.test.tsx` (desplegable y centrado, nunca delante del
  primer ítem, sin la prop el árbol de hoy) y `row-actions-menu-centrado.test.tsx` en verde. Si falta
  `triggerDataAttributes` en `RowActionsSpec`, se añade a su `Pick`. El leader avisa a los dueños de
  QC-262 y QC-263 antes de empezar.
- [x] **T1b [P]. `StepReader` con `layout="panel"`** (D9, R22, R24, R26). Tests en
  `tests/unit/recetas-ui/step-reader.test.tsx`: con `panel`, cabecera con «Paso N de M» y un tramo por
  paso marcado hasta el actual; motivo como `Notice` `info` y espera como `Notice` `warning` con sus
  testids y el `aria-describedby` de los botones; pie con «Anterior» y «Siguiente»/«Finalizar» de 44 px;
  `data-direction` según avance o retroceso; con `inline` (por defecto) y con `ejecucion`, el árbol de
  hoy (snapshot del árbol existente sin cambios). *Enmienda (E8):* con `panel`, `renderStepAddon` sale
  en el cuerpo y el motivo de `stepBlockReason` en el mismo `Notice` `info`; `data-direction` también
  tras un `stepRequest`.
- [x] **T1c [P]. Subir PDFs** (D4, R7–R9, R45; P1). `document-upload-dialog.tsx`,
  `document-upload-row.tsx`, `labels.ts` (`BROWSER_PHASE_TONES`, `FILE_STATUS_TONES`, tildes). Test
  nuevo `tests/unit/documentos-ui/document-upload-tones.test.tsx` (cada fase y estado con su tono, testid
  y `data-*`); tests de `design.md > 7` de `documentos-ui` actualizados; snapshot de `catalogo-paridad`
  (fila de `design.md > 6`). *Enmienda (E10):* el disparador conserva `disabled` (con el icono) y la
  fila, su motivo de error; `document-upload-flow`, `-errors` y `-strategy` en verde.
- [x] **T1d. Catálogo** (R48; depende de T1a–T1c). Filas de `StepReader` (punto de extensión `layout`,
  `Diseño` + `Formula.dc.html`, `ModalesProduccion.dc.html`), `DocumentUpload…` (`Alcance` con los
  tonos, `Diseño` = `Formulas.dc.html`, `ModalesProduccion.dc.html`) y, si T1a se hizo aquí,
  `RowActionsMenu`. *Hecho:* `pnpm exec vitest run guard-catalogo-de-componentes catalogo-qc256` en
  verde. *Enmienda (E3):* la fila de `RowActionsMenu` no cambia.

## Tanda 2 — Listado (depende de T1a o de que esté en `dev`) [P con 3–7]

- [x] **T2a. Cabecera** (D1, R1). `page.tsx` con `PageShell` + `PageHeader`; orden de acciones; icono
  en «Nueva fórmula». Test en `recipe-page.test.tsx`: único `h1` «Fórmulas» con `recipes-title`, «Subir
  PDFs» antes de «Nueva fórmula», sin permiso de subir no hay «Subir PDFs». *Enmienda (E1):* también
  sin proveedor IA: «Subir PDFs» deshabilitado dentro del globo, en el mismo sitio y antes de «Nueva
  fórmula» (mock de `getAiProviderReadinessAction` con `configured: false`); `formulas-upload.test.tsx`
  en verde.
- [x] **T2b. Menú como datos, un diálogo por tabla y tarjetas** (D2, D3, R2–R6). `recipe-row-actions.tsx`,
  `recipe-columns.tsx`, `recipe-table.tsx`. Tests nuevos `tests/unit/recetas-ui/recipe-row-actions-spec.test.tsx`
  (ítems, orden, separador, destructivo, href, testids, `data-recipe-id`, `title`; «Borrar» abre el
  diálogo de esa receta; un solo `delete-recipe-dialog` montado) y `tests/unit/recetas-ui/recipe-cards.test.tsx`
  (`card` con miniatura y nombre, meta, «Acciones» de 44 px, menú centrado con el nombre; vacíos y
  error en tarjetas; columnas alineadas al final). `delete-recipe-dialog.test.tsx`, `tablas-marca`,
  `acciones-por-fila` y `recetas-paridad` (fila de listado) actualizados. *Enmienda (E4):*
  `recipeRowActionsSpec` devuelve `RecipeRowActionsSpec` (tipo local, como `ProductRowActionsSpec`);
  `data-table-types.ts` no se toca.
- [x] **T2c [P]. Icono de los borrados** (*enmienda E16*; D17, R50; supuesto P17).
  `delete-recipe-dialog.tsx`. Test en `delete-recipe-dialog.test.tsx`: con receta y con versión, el
  diálogo pinta `delete-recipe-icon` delante del título y los textos, botones y `data-testid` de hoy no
  cambian. Snapshot de `confirmaciones-paridad` (fila de borrar).

## Tanda 3 — Formulario: estructura, versiones y propagar (depende de T0c, T0d) [P con 2, 4–7]

- [x] **T3a. `FormFooterBar` y estructura** (D5, D6, D7, R10–R15). `form-footer-bar.tsx`, `recipe-form.tsx`
  (`aside`, `form=`), `nueva/page.tsx`, `[id]/page.tsx`. Test nuevo
  `tests/unit/recetas-ui/recipe-form-layout.test.tsx`: «Volver a la lista» con flecha y dirección, `h1`
  de hoy, tarjetas en orden, `aside` fuera del `<form>`, pie con «Vista previa» / «Cancelar» / «Guardar»
  de 44 px y clase del margen seguro, «Guardar» envía (clic y Enter) y se deshabilita como hoy.
  *Enmienda (E7, E9, E21):* la imagen sigue siendo `ImageField`; el aviso `recipe-form-steps-locked`
  queda dentro del `<form>`, encima de las tarjetas (R51); `[id]/page.tsx` conserva sus seis lecturas y
  `lockingOrders`. `recipe-form-evidence-lock.test.tsx` en verde (o migrado si localiza por posición).
- [x] **T3b. Pestañas con contador** (D5, R12). `recipe-lines-field.tsx`. `recipe-lines-tabs.test.tsx`:
  cifra junto a la etiqueta, no cuenta la fila fantasma, cambia al añadir o quitar; testids de hoy.
- [x] **T3c. Lista de versiones** (D12, D14, R14, R30, R31). `recipe-version-list.tsx`,
  `recipe-version-tones.ts`. `recipe-version-list.test.tsx`: nombre con `truncate` y `title`, «Por
  revisar» `waiting`, «Abrir» con su nombre accesible y dirección, borrado de hoy, `originalId={null}`
  con «Nueva versión» deshabilitado y el vacío. `badges-estado.test.tsx` enmendado (`design.md > 10`).
  *Enmienda (E12):* «Abrir la versión X» sale de `Abrir` + `<span className="sr-only">` dentro del
  `ArrowLink`; `ArrowLink` no se toca.
- [x] **T3d. Propagar** (D10, R27–R29). `propagate-versions-dialog.tsx`. Test nuevo
  `tests/unit/recetas-ui/propagate-versions-dialog.test.tsx`: singular y plural con el número en mono,
  filas de 48 px, «Por revisar» solo en las que lo están, conducta de hoy; `recipe-form-propagation.test.tsx`
  en verde. Snapshots de `recetas-paridad` (formulario) y `confirmaciones-paridad` (propagar).

## Tanda 4 — Editor de pasos (depende de T1b solo por el orden de commits) [P con 2, 3, 5–7]

- [x] **T4a.** (D8, R16–R19) `recipe-steps-field.tsx`, `recipe-step-editor.tsx`. Tests en
  `recipe-steps-field.test.tsx`: número bajo el asa, quitar con icono y «Quitar paso N», «Añadir paso»
  al final con su testid, `data-dragging` en la tomada y `data-drop-target` en las demás mientras se
  arrastra (teclado: Espacio para tomar) y ninguna marca tras soltar o cancelar, orden y anuncios de hoy.
  `recipe-step-editor.test.tsx`: tres botones de 44 × 44 con `aria-pressed` e iconos ocultos a lectores.
  `recipe-route-contract` y `guard-editor-aislado` en verde (R19).
  *Enmienda (E5–E7; supuesto P16):* la tarjeta tiene dos columnas (asa + número / editor); quitar y
  añadir siguen en la barra del editor, a la derecha y con el interruptor «Requiere evidencia»
  (`design.md > D8 > Enmienda`). **No** hay «Añadir paso» al final: el test afirma que no existe
  `recipe-step-add` ni `recipe-packing-step-add` (como hoy, `recipe-steps-field.test.tsx:97-123`) y que el
  «+» de cada paso conserva su regla (`canAdd`). Bajo 768 px la barra se parte en dos líneas. Con
  `locked`, asa y quitar deshabilitados con su nombre de hoy y sin marcas de arrastre. Tests de QC-214
  (sus casos en `recipe-steps-field.test.tsx` y `recipe-step-editor.test.tsx`, y `recipe-form-evidence-lock.test.tsx`)
  en verde.

## Tanda 5 — Vista previa (depende de T1b, T3a) [P con 2, 4, 6, 7]

- [x] **T5a.** (D9, R21–R25) `recipe-form.tsx`. Test nuevo `tests/unit/recetas-ui/recipe-form-preview.test.tsx`
  (monta `RecipeForm`; no importa `@/components/shared/step-reader`): título, descripción con tildes,
  «Cerrar» de 44 px, `StepReader` en `panel` con los pasos del estado actual, nada se guarda ni navega,
  al cerrar se desmonta y el foco vuelve a «Vista previa»; clases de pantalla completa por debajo de
  768 px y de 920 × 900 desde 768 px. `recipe-form.test.tsx` en verde.

## Tanda 6 — Versión (depende de T3a, T3c) [P con 2, 4, 5, 7]

- [x] **T6a.** (D13, D14, R32–R36) páginas `versiones/nueva` y `versiones/[versionId]`,
  `recipe-version-form.tsx`, `recipe-lines-field.tsx`. Test nuevo
  `tests/unit/recetas-ui/recipe-version-marks.test.tsx`: tono por marca con `data-mark` de hoy, original
  tachado en «Cambiado», «Quitado» `danger`, resumen «Igual/Cambiado/Añadido N» que cambia al editar una
  línea, «Por revisar» `waiting`. `recipe-version-pages.test.tsx`: «Volver a la receta» con dirección y
  `h1` de hoy; `recipe-version-form.test.tsx` y `recipe-lines-baseline.test.tsx`: pie y conducta de hoy.

## Tanda 7 — Revisión de importación (depende de T3a) [P con 2, 4–6]

- [x] **T7a.** (D15, R37–R43) `importar/[documentoId]/page.tsx` y sus cuatro componentes. Test nuevo
  `tests/unit/recetas-ui/formula-import-layout.test.tsx`: «Volver al listado» con flecha, `h1` único,
  tarjetas con «N · S %» y la suma de hoy, número y «Referencia del PDF» por ingrediente, quitar con
  «Quitar el ingrediente N» y el texto oculto bajo 640 px, «Añadir ingrediente» discontinuo, «Confirmar»
  en el pie, choque con `Notice` `warning` y sus dos botones, resumen con icono, cifras y los dos
  botones, error con «Volver al listado». `formula-import-page.test.tsx` y `formula-import-review.test.tsx`
  migrados (rol del choque, enlace de error). Snapshot de `recetas-paridad` (revisión).
  *Enmienda (E2, E20):* `page.tsx` conserva sus tres primeras líneas (dos permisos y
  `requirePageAddon('lectura_pdf')`); `guard-pantallas-de-anadido` en verde. **Choque aceptado con
  QC-203** en `formula-import-review.tsx`, `formula-ingredient-row.tsx`, `formula-import-summary.tsx`,
  `formula-import-page.test.tsx` y `formula-import-review.test.tsx`: solo se cambian marcado y clases
  (ni `IngredientRowState`, ni `toDraftLine`/`toConfirmLine`, ni `buildConfirmReasons`); quien mergee
  segundo resuelve en F2.3 y lo anota en el impl.

## Tanda 8 — Textos, toasts y guardia (depende de 2–7)

- [ ] **T8a [P]. Tildes** (R21, R45). `PREVIEW_DESCRIPTION` en `recipe-form.tsx` (si no entró en T5a) y
  los de T1c. Tests que afirmaban el texto viejo, actualizados. *Enmienda (E17; supuesto P18):* nada
  más; «Lista de verificacion», «el maximo es» y «Elemento de la lista de verificacion» no se tocan
  salvo que el humano cierre P18 con la alternativa.
- [ ] **T8b [P]. Toasts** (D11, R46). Test nuevo `tests/unit/recetas-ui/formulas-toasts.test.tsx` con
  `sonner` simulado: un único `toast.success` con su texto en cada uno de los seis éxitos y en la
  edición con versión por revisar; ninguno en error.
- [ ] **T8c. Guardia** (D16, R44, R45). `tests/guards/guard-formulas-rediseno.test.ts`. *Hecho:*
  `pnpm exec vitest run guard` en verde y la guardia falla con una copia que importa `Badge` en la ruta.

## Tanda 9 — E2E (depende de todas)

- [ ] **T9a. E2E nuevo** `e2e/formulas-rediseno.spec.ts` con los casos de `design.md > 7` (R1–R3, R5,
  R13, R15, R20, R22, R23, R27, R30, R47) y su alta en `E2E_ESPERADOS` de
  `tests/guards/guard-identificador-de-request.test.ts` y en `tests/unit/shared/data-table-alcance.test.ts`,
  con el comentario «Alta el <fecha> (QC-264) por el MISMO motivo y en el MISMO sitio que las demas: la
  lista es CERRADA y darse de alta en ella es su punto de extension por diseno. El ancla NO se relaja -el
  archivo se nombra, uno a uno-. Lo que ejercita: …». *Hecho:* pasa en Chromium y WebKit;
  `pnpm exec vitest run guard-identificador-de-request data-table-alcance` en verde.
- [ ] **T9b. E2E existentes** (R49 y la tabla de `design.md > 7`). Migrar `versiones-en-la-receta.spec.ts`
  (localizador acotado a la fila de tabla y «Abrir la versión X») y los demás que T0a marque. *Hecho:*
  cada spec tocado pasa por separado (`pnpm exec playwright test <spec>`); los que solo leen testids
  conservados pasan sin cambios. *Enmienda (E19):* se corren también, sin cambios esperados,
  `e2e/integraciones-proveedor-ia.spec.ts`, `e2e/modulos-por-empresa.spec.ts` y
  `e2e/ejecucion-receta.spec.ts`.
- [ ] **T9c. Deudas.** `progress/deudas.md`: la nueva de P14 y las de P6, P8 y P10 si se confirman
  fuera; D53 ampliada si aplica. *Enmienda (E16–E18):* con P17 por defecto, en vez de la de P14 se
  amplía D56 con el diálogo de propagar; con P18 por defecto, deuda nueva de tildes; deuda nueva del
  «Volver a la lista» como enlace de texto en «no encontrada».

## Trazabilidad R → test

| R | Test |
| --- | --- |
| R1 | `tests/unit/recetas-ui/recipe-page.test.tsx`, `e2e/formulas-rediseno.spec.ts` |
| R2 | `tests/unit/recetas-ui/recipe-cards.test.tsx`, `e2e/formulas-rediseno.spec.ts` |
| R3, R4 | `tests/unit/recetas-ui/recipe-row-actions-spec.test.tsx`, `e2e/formulas-rediseno.spec.ts` (R3) |
| R5, R6 | `tests/unit/recetas-ui/recipe-cards.test.tsx`, `e2e/formulas-rediseno.spec.ts` (R5) |
| R7, R8, R9 | `tests/unit/documentos-ui/document-upload-tones.test.tsx`, `tests/unit/documentos-ui/document-upload-dialog.test.tsx`, `tests/unit/documentos-ui/document-upload-review-link.test.tsx` |
| R10, R11, R13, R14, R15 | `tests/unit/recetas-ui/recipe-form-layout.test.tsx`, `tests/unit/recetas-ui/recipe-version-list.test.tsx` (R14), `e2e/formulas-rediseno.spec.ts` (R13, R15) |
| R12 | `tests/unit/recetas-ui/recipe-lines-tabs.test.tsx` |
| R16, R17, R18, R19 | `tests/unit/recetas-ui/recipe-steps-field.test.tsx`, `tests/unit/recetas-ui/recipe-step-editor.test.tsx` (R16), `tests/unit/recetas-ui/recipe-form-packing-steps.test.tsx` (R17, enmienda E5), `tests/guards/guard-editor-aislado.test.ts` y `tests/unit/recetas-ui/recipe-route-contract.test.ts` (R19) |
| R20 | `e2e/formulas-rediseno.spec.ts` |
| R21, R23, R25 | `tests/unit/recetas-ui/recipe-form-preview.test.tsx`, `e2e/formulas-rediseno.spec.ts` (R23) |
| R22, R24, R26 | `tests/unit/recetas-ui/step-reader.test.tsx`, `e2e/formulas-rediseno.spec.ts` (R22) |
| R27, R28, R29 | `tests/unit/recetas-ui/propagate-versions-dialog.test.tsx`, `tests/unit/recetas-ui/recipe-form-propagation.test.tsx` (R29), `e2e/formulas-rediseno.spec.ts` (R27) |
| R30, R31 | `tests/unit/recetas-ui/recipe-version-list.test.tsx`, `tests/unit/marca/badges-estado.test.tsx` (R30), `e2e/formulas-rediseno.spec.ts` (R30) |
| R32, R36 | `tests/unit/recetas-ui/recipe-version-pages.test.tsx`, `tests/unit/recetas-ui/recipe-version-form.test.tsx` |
| R33, R34, R35 | `tests/unit/recetas-ui/recipe-version-marks.test.tsx`, `tests/unit/marca/badges-estado.test.tsx` (R35) |
| R37–R43 | `tests/unit/recetas-ui/formula-import-layout.test.tsx`, `tests/unit/recetas-ui/formula-import-page.test.tsx` (R37, R43) |
| R44, R45 | `tests/guards/guard-formulas-rediseno.test.ts` |
| R46 | `tests/unit/recetas-ui/formulas-toasts.test.tsx` |
| R47 | `e2e/formulas-rediseno.spec.ts` |
| R48 | `tests/guards/guard-catalogo-de-componentes.test.ts` |
| R49 | `e2e/recetas.spec.ts`, `e2e/versiones-en-la-receta.spec.ts`, `e2e/recetas-pasos.spec.ts`, `e2e/formula-desde-pdf.spec.ts`, `e2e/documentos.spec.ts`, `tests/unit/recetas-ui/recipe-form.test.tsx`, `tests/guards/guard-pantallas-de-anadido.test.ts` y `e2e/modulos-por-empresa.spec.ts` (corte por añadido, enmienda E2) |
| R1 (enmienda E1) | además `tests/unit/documentos-ui/formulas-upload.test.tsx`, `e2e/integraciones-proveedor-ia.spec.ts` |
| R50 | `tests/unit/recetas-ui/delete-recipe-dialog.test.tsx`, `tests/unit/paridad/confirmaciones-paridad.test.tsx` |
| R51 | `tests/unit/recetas-ui/recipe-form-evidence-lock.test.tsx`, `tests/unit/recetas-ui/recipe-form-layout.test.tsx` |

## Archivos esperados

*Enmienda 2026-10-19 (E3, E4, E9, E10, E16, E19):* salen de la lista recipe-image-field (no existe),
row-actions-menu, data-table-types y los tests de RowActionsMenu y catalogo-qc256 (no se tocan); entran
los tests de QC-214, los de la subida que nombran la fila y el de permisos de páginas, cada uno «solo
si cambia». Comparten archivos con QC-203 (choque aceptado): los tres componentes de la revisión y sus
dos tests. (Esta nota va sin comillas invertidas a propósito: el script de archivos en vuelo lee
como ruta todo lo que las lleve en esta sección.)

Producción:

- `app/(private)/produccion/formulas/page.tsx`
- `app/(private)/produccion/formulas/nueva/page.tsx`
- `app/(private)/produccion/formulas/[id]/page.tsx`
- `app/(private)/produccion/formulas/[id]/versiones/nueva/page.tsx`
- `app/(private)/produccion/formulas/[id]/versiones/[versionId]/page.tsx`
- `app/(private)/produccion/formulas/importar/[documentoId]/page.tsx`
- `app/(private)/produccion/formulas/components/index.ts`
- `app/(private)/produccion/formulas/components/recipe-table.tsx`
- `app/(private)/produccion/formulas/components/recipe-columns.tsx`
- `app/(private)/produccion/formulas/components/recipe-row-actions.tsx`
- `app/(private)/produccion/formulas/components/delete-recipe-dialog.tsx`
- `app/(private)/produccion/formulas/components/recipe-form.tsx`
- `app/(private)/produccion/formulas/components/form-footer-bar.tsx`
- `app/(private)/produccion/formulas/components/recipe-lines-field.tsx`
- `app/(private)/produccion/formulas/components/recipe-steps-field.tsx`
- `app/(private)/produccion/formulas/components/recipe-step-editor.tsx`
- `app/(private)/produccion/formulas/components/recipe-version-list.tsx`
- `app/(private)/produccion/formulas/components/recipe-version-form.tsx`
- `app/(private)/produccion/formulas/components/recipe-version-tones.ts`
- `app/(private)/produccion/formulas/components/propagate-versions-dialog.tsx`
- `app/(private)/produccion/formulas/importar/[documentoId]/components/index.ts`
- `app/(private)/produccion/formulas/importar/[documentoId]/components/formula-import-review.tsx`
- `app/(private)/produccion/formulas/importar/[documentoId]/components/formula-ingredient-row.tsx`
- `app/(private)/produccion/formulas/importar/[documentoId]/components/formula-name-clash.tsx`
- `app/(private)/produccion/formulas/importar/[documentoId]/components/formula-import-summary.tsx`
- `components/shared/step-reader/step-reader.tsx`
- `components/shared/document-upload/document-upload-dialog.tsx`
- `components/shared/document-upload/document-upload-row.tsx`
- `components/shared/document-upload/labels.ts`
- `components/shared/document-upload/index.ts`
- `components/shared/CATALOGO.md`

Tests y guardias:

- `tests/unit/recetas-ui/recipe-page.test.tsx`
- `tests/unit/recetas-ui/recipe-row-actions-spec.test.tsx`
- `tests/unit/recetas-ui/recipe-cards.test.tsx`
- `tests/unit/recetas-ui/delete-recipe-dialog.test.tsx`
- `tests/unit/recetas-ui/recipe-form.test.tsx`
- `tests/unit/recetas-ui/recipe-form-layout.test.tsx`
- `tests/unit/recetas-ui/recipe-form-preview.test.tsx`
- `tests/unit/recetas-ui/recipe-form-packing-steps.test.tsx`
- `tests/unit/recetas-ui/recipe-form-propagation.test.tsx`
- `tests/unit/recetas-ui/recipe-form-evidence-lock.test.tsx` (enmienda E7; solo si su localizador depende de la estructura)
- `tests/unit/recetas-ui/recipe-version-form-evidence.test.tsx` (enmienda E7; solo si cambia)
- `tests/unit/recetas-ui/recipe-form-mensajes-zod.test.tsx` (enmienda E19; solo si cambia)
- `tests/unit/recetas-ui/propagate-versions-dialog.test.tsx`
- `tests/unit/recetas-ui/recipe-steps-field.test.tsx`
- `tests/unit/recetas-ui/recipe-step-editor.test.tsx`
- `tests/unit/recetas-ui/recipe-lines-tabs.test.tsx`
- `tests/unit/recetas-ui/recipe-lines-baseline.test.tsx`
- `tests/unit/recetas-ui/recipe-lines-field-tools.test.tsx`
- `tests/unit/recetas-ui/recipe-lines-sum.test.tsx`
- `tests/unit/recetas-ui/recipe-lines-unavailable.test.tsx`
- `tests/unit/recetas-ui/recipe-lines-no-finished-product.test.tsx`
- `tests/unit/recetas-ui/recipe-version-list.test.tsx`
- `tests/unit/recetas-ui/recipe-version-form.test.tsx`
- `tests/unit/recetas-ui/recipe-version-pages.test.tsx`
- `tests/unit/recetas-ui/recipe-version-marks.test.tsx`
- `tests/unit/recetas-ui/formula-import-page.test.tsx`
- `tests/unit/recetas-ui/formula-import-review.test.tsx`
- `tests/unit/recetas-ui/formula-import-layout.test.tsx`
- `tests/unit/recetas-ui/formulas-toasts.test.tsx`
- `tests/unit/recetas-ui/step-reader.test.tsx`
- `tests/unit/recetas-ui/recipe-route-contract.test.ts`
- `tests/unit/documentos-ui/document-upload-dialog.test.tsx`
- `tests/unit/documentos-ui/document-upload-rows.test.tsx`
- `tests/unit/documentos-ui/document-upload-review-link.test.tsx`
- `tests/unit/documentos-ui/document-upload-selection.test.tsx`
- `tests/unit/documentos-ui/document-upload-a11y-tactil.test.tsx`
- `tests/unit/documentos-ui/document-upload-convenciones.test.ts`
- `tests/unit/documentos-ui/document-upload-tones.test.tsx`
- `tests/unit/documentos-ui/formula-pdf-upload.test.tsx`
- `tests/unit/documentos-ui/formulas-upload.test.tsx`
- `tests/unit/documentos-ui/supplier-detail-upload.test.tsx`
- `tests/unit/documentos-ui/document-upload-flow.test.tsx` (enmienda E10; solo si cambia)
- `tests/unit/documentos-ui/document-upload-errors.test.tsx` (enmienda E10; solo si cambia)
- `tests/unit/documentos-ui/document-upload-strategy.test.tsx` (enmienda E10; solo si cambia)
- `tests/unit/shared-ui/confirm-dialog-montado.test.tsx` (censo T0a; monta `RecipeTable` y abre el borrado; solo si cambia)
- `tests/unit/proveedores-ui/catalog-pdf-upload.test.tsx` (censo T0a; usa el diálogo de subida compartido; solo si cambia)
- `tests/unit/marca/badges-estado.test.tsx`
- `tests/unit/marca/tablas-marca.test.tsx`
- `tests/unit/navegacion/pantallas-exigen-permiso.test.tsx` (enmienda E19; solo si `page.tsx` pide otro mock)
- `tests/unit/paridad/recetas-paridad.test.tsx`
- `tests/unit/paridad/__snapshots__/recetas-paridad.test.tsx.snap`
- `tests/unit/paridad/acciones-por-fila.test.tsx`
- `tests/unit/paridad/__snapshots__/acciones-por-fila.test.tsx.snap`
- `tests/unit/paridad/confirmaciones-paridad.test.tsx`
- `tests/unit/paridad/__snapshots__/confirmaciones-paridad.test.tsx.snap`
- `tests/unit/paridad/catalogo-paridad.test.tsx`
- `tests/unit/paridad/__snapshots__/catalogo-paridad.test.tsx.snap`
- `tests/unit/shared/data-table-alcance.test.ts` (lista cerrada de E2E que nombran `data-table`; alta de QC-264)
- `tests/guards/guard-formulas-rediseno.test.ts`
- `tests/guards/guard-identificador-de-request.test.ts` (`E2E_ESPERADOS`; alta de QC-264)
- `tests/guards/guard-editor-aislado.test.ts` (solo si su lista de archivos cambia; no se espera)
- `tests/guards/guard-catalogo-de-componentes.test.ts` (solo si su lista de piezas cambia; no se espera)

E2E:

- `e2e/formulas-rediseno.spec.ts`
- `e2e/versiones-en-la-receta.spec.ts`
- `e2e/recetas.spec.ts`
- `e2e/recetas-pasos.spec.ts`
- `e2e/recetas-porcentaje.spec.ts`
- `e2e/versiones-de-receta.spec.ts`
- `e2e/aislamiento-recetas.spec.ts`
- `e2e/errores.spec.ts`
- `e2e/pasos-de-envasado.spec.ts`
- `e2e/formula-desde-pdf.spec.ts`
- `e2e/documentos.spec.ts`
- `e2e/catalogo-desde-pdf.spec.ts`
- `e2e/movimiento.spec.ts`

Estado:

- `progress/impl_QC-264.md`
- `progress/deudas.md`
- `progress/features/QC-264.md`
