# QC-264 — rediseno-formulas · design.md

## Lo que ya existe

**Términos buscados.** En el board (`feature_list.json`, todos los estados): «fórmula», «receta»,
«versión», «vista previa», «pasos», «arrastre», «subida de PDF», «toast». En `specs/` y `progress/`:
`QC-264`, `PropagateVersionsDialog`, `RecipeVersionList`, «Por revisar», `separatorBefore`,
`DocumentUploadDialog`, `StepReader`, `.form-ft`. En el código (grafo `codebase-memory-mcp` del
worktree, que respondió, y Grep): `RecipeTable`, `buildRecipeColumns`, `RecipeRowActions`,
`DeleteRecipeDialog`, `RecipeForm`, `RecipeLinesField`, `RecipeStepsField`, `RecipeStepEditor`,
`RecipeVersionForm`, `compareWithOriginal`, `FormulaImportReview`, `FormulaNameClash`,
`FormulaImportSummary`, `DocumentUploadRow`, `*_TONES`, `toast.success` en la ruta.

| Qué apareció | Dónde | Qué se hace |
| --- | --- | --- |
| El título singular y plural de propagar **ya existe** («1 versión parte…» / «N versiones parten…») | `propagate-versions-dialog.tsx > dialogTitle` | Se conserva; se restila y se fija con test (R27) |
| La barra de formato (Negrilla, Cursiva, Lista de verificación) y el arrastre con `@dnd-kit` y teclado **ya existen** (QC-26, QC-64), con ambas librerías aprobadas en `docs/dependencias.md` | `recipe-step-editor.tsx`, `recipe-steps-field.tsx`, `tests/guards/guard-editor-aislado.test.ts` | Se reutilizan; solo cambia la presentación (R16–R19). Ninguna librería nueva |
| Los seis toasts de la ruta **ya existen**, «Receta actualizada.» incluido | `recipe-form.tsx`, `recipe-version-form.tsx`, `delete-recipe-dialog.tsx` | No se añade ninguno; un test los fija (R46, D11) |
| La única forma sin tilde de la ruta es la descripción de la vista previa; en la subida compartida, «Quitar la seleccion» y «ya no esta disponible» | `recipe-form.tsx > PREVIEW_DESCRIPTION`, `components/shared/document-upload/labels.ts` | Se corrigen (R21, R45) |
| QC-256 (`done`) dejó `StatusBadge`, `PageShell`, `PageHeader`, `ArrowLink`, `Notice`, `RowActionsMenu` centrado y `DataTable` con `card` y `actionsColumn({ menu })`; y dejó **a esta ficha** el tono de las marcas de versión (se quedan en la ruta) y el de los estados de documento (los pinta quien los muestra); `.form-ft`, `.ed*`, `.seg`, `.num-dot`, `.lbox` son de «la ficha de la pantalla» | `specs/QC-256-piezas-compartidas-rediseno/requirements.md > Lo que NO entra` | Se reutilizan las piezas; las clases de pantalla se escriben con utilidades de Tailwind |
| QC-262 y QC-263 (aprobados, sin implementar) pasan el menú ⋯ a datos con un anfitrión de diálogos por tabla, y comparten el contrato `separatorBefore` (QC-262 D7) y el `triggerDataAttributes` en `RowActionsSpec` (QC-263 D4) | `.worktrees/QC-262-rediseno-pedidos/specs/…/design.md > D5, D7`, `.worktrees/QC-263-rediseno-inventario/specs/…/design.md > D4, D12` | Mismo enfoque y mismo contrato, sin variante (D2, D3); T0a mira qué ya está en `dev` |
| QC-269 (`done`) dejó en `StepReader` la reserva del pie fijo en `ejecucion`; QC-270 (`done`), la cabecera de `DataTable` alineada con su columna | `components/shared/step-reader/step-reader.tsx`, `components/shared/data-table/` | Se reutiliza: `align: 'end'` ya alinea la cabecera (R2); el modo `ejecucion` no se toca (R26) |
| QC-159: «la revisión avisa del choque antes de confirmar» | `specs/QC-159-formula-desde-pdf/requirements.md > Decisiones` | El choque sigue en línea (R41, P9) |
| La espera por paso es de la empresa (`minStepSeconds`, QC-125) | `components/shared/step-reader/step-reader.tsx` | El campo de espera por paso del tablero queda fuera (P6) |
| `recipe-route-contract.test.ts` cierra: carpetas de la ruta, importadores del lector (`recipe-form.tsx` es el único de la ruta) y tests que nombran `step-reader` | `tests/unit/recetas-ui/recipe-route-contract.test.ts` | Ninguna carpeta nueva; el lector se sigue montando solo en `recipe-form.tsx`; los tests nuevos no importan `step-reader` (§ 9) |
| QC-210, QC-173, QC-198, QC-214 (`pending`) tocan el formulario o los pasos; QC-268 (`pending`), el import profundo de `StepDocumentView`; QC-266 (`pending`), la otra pantalla que usa la subida | `feature_list.json` | No se adelanta nada; riesgo de choque en § 9 |

**Filas de `components/shared/CATALOGO.md` consultadas y paso de la regla de decisión**
(`docs/perfil-agentes.md > Regla de decisión para componentes`):

| Pieza | Filas consultadas | Paso | Por qué no bastaba el anterior | Tablero |
| --- | --- | --- | --- | --- |
| Cabeceras de página | `PageShell`, `PageHeader`, `ArrowLink` | 1 · reutiliza | — | `Superficies.dc.html`, `Botones.dc.html`, `Formula.dc.html` |
| Tabla, tarjetas y menú ⋯ | `DataTable` (`card`, `actionsColumn({ menu })`), `RowActionsMenu`, `EntityImage` | 1 · reutiliza | — | `Tabla.dc.html`, `Formulas.dc.html` |
| Separador del menú | `RowActionsMenu`, `DropdownMenu`, `Separator` | 2 · extiende `RowActionsMenu` (contrato de QC-262 D7), solo si no está ya en `dev` | «Cubre: ítems de acción o de enlace…»; no separa grupos | `Tabla.dc.html`, `Formulas.dc.html` (`.sep`) |
| Estados y marcas | `StatusBadge`, `Badge` | 1 · reutiliza `StatusBadge` | — | `Estados.dc.html`, `FormulaVersion.dc.html` |
| Avisos (choque, motivo de bloqueo, espera) | `Notice`, `Alert` | 1 · reutiliza | — | `Avisos.dc.html`, `ModalesProduccion.dc.html` |
| Diálogos | `ConfirmDialog`, `DeleteConfirmDialog`, `AlertDialog`, `Dialog` | 1 · reutiliza | — | `ModalesProduccion.dc.html` |
| Subir PDFs | `DocumentUpload`, `DocumentUploadDialog`, `DocumentUploadRow`, `StatusBadge`, `ArrowLink` | 2 · cambio visual de la pieza (componiendo `StatusBadge` y `ArrowLink`), sin cambiar su contrato | Su `Alcance` no pinta tono por estado; el tablero sí (P1) | `Formulas.dc.html`, `ModalesProduccion.dc.html` |
| Lector de la vista previa | `StepReader` | 2 · extiende con `layout?: 'inline' \| 'panel'` (solo en `lectura`) | `lectura` pinta los botones en línea, sin progreso por tramos ni pie propio; `ejecucion` es de pantalla completa del operario | `Formula.dc.html`, `FormulaMovil.dc.html`, `ModalesProduccion.dc.html` |
| Pestañas con contador | `Tabs`, `UrlTabs` | 3 · compone en la ruta (`TabsTrigger` + cifra) | `UrlTabs` navega por dirección; aquí son paneles de la misma página. `Tabs` no tiene contador | `Formula.dc.html` |
| Pie fijo de formulario (`FormFooterBar`) | `FormSheet` (pie), `Button`, `buttonVariants` | 4 · crea en la ruta | El pie de `FormSheet` vive dentro de un panel lateral (`Sheet`); aquí es el pie de una página | `Formula.dc.html`, `FormulaVersion.dc.html`, `ImportarFormula.dc.html` (`.form-ft`) |
| Toasts | `Toaster` (+ `toast` de `sonner`) | 1 · reutiliza | — | `Avisos.dc.html` |

El pie fijo lo usan el formulario de receta, el de versión y la revisión de importación, las tres bajo
`app/(private)/produccion/formulas/**` y ya servidas por el mismo barrel: se crea en
`app/(private)/produccion/formulas/components/` y no sube a `components/shared` (regla de la segunda
ruta).

## 1. Principio

Es un **cambio visual** con tablero aprobado (D14): los snapshots de paridad de recetas, del menú por
fila, de confirmaciones y del catálogo de proveedores (por la subida compartida, P1) **cambian**, y cada
cambio está en § 6. El comportamiento no cambia: mismas Server Actions, mismos campos, mismos permisos,
mismas reglas de suma, propagación y choque (R49). Lo que sí cambia por dentro es **dónde viven el
diálogo de borrado de la fila** (D2) y **dónde vive la sección «Versiones»** (D6), porque las tarjetas y
las dos columnas lo obligan.

## 2. Modelo de datos

No aplica: sin tablas, sin RLS, sin migraciones, sin cambios en `lib/modules/`. Ningún contrato de
módulo cambia. `RecipeVersionSummary.isUnderReview` ya llega a la ficha de la receta.

## 3. Rutas

Ninguna ruta nueva ni distinta, ninguna carpeta nueva (la lista cerrada de `recipe-route-contract`
no cambia). Las direcciones salen de `FORMULAS_ROUTE`, `NEW_RECIPE_ROUTE`, `recipeEditRoute`,
`newRecipeVersionRoute`, `recipeVersionRoute` y `formulaImportRoute`. Cada `page.tsx` conserva su
`requirePagePermission` en la primera línea.

## 4. Decisiones

**D1 — Cabecera del listado (R1).** `page.tsx` pinta `PageShell` > `PageHeader` con
`title={RECIPES_LABEL}`, `titleTestId="recipes-title"` y `actions` = `<FormulaPdfUpload />` (si
`canUpload`) seguido del enlace «Nueva fórmula» de hoy (con icono `Plus`). El `div` y el `h1` propios
desaparecen; el `Suspense` de la lista queda dentro de `PageShell`.

**D2 — Menú como datos y un anfitrión por tabla (R3–R5).** Mismo patrón que QC-262 D5 y QC-263 D4–D5:

- `recipe-row-actions.tsx` gana la función pura
  ```ts
  export type RecipeRowAction = 'delete';
  export function recipeRowActionsSpec(input: {
    readonly recipe: RecipeSummary;
    readonly onAction: (action: RecipeRowAction, recipe: RecipeSummary) => void;
  }): RowActionsSpec;
  ```
  con «Editar» (`href` = `recipeEditRoute`, `PencilIcon`, `RECIPE_ACTION_EDIT_TESTID`) y «Borrar»
  (`Trash2Icon`, `destructive`, `separatorBefore`, `RECIPE_ACTION_DELETE_TESTID`), `triggerLabel` de
  `recipeRowActionsLabel`, `triggerTestId` `recipe-row-actions`,
  `triggerDataAttributes={{ 'data-recipe-id': id }}` y `title` = nombre (lo usa el menú centrado).
  `RecipeRowActions` se conserva como envoltorio (`RowActionsMenu` + su `DeleteRecipeDialog`
  controlado) para sus tests y exports.
- `recipe-columns.tsx`: `RecipeColumnsDeps` pasa de `rowActions` a `menu: (recipe) => RowActionsSpec`
  y la columna se declara con `actionsColumn({ id: ACTIONS_COLUMN_ID, label, menu })`.
- `recipe-table.tsx` guarda `active: { recipe, open } | null` y monta **un** `DeleteRecipeDialog`
  controlado (`open`/`onOpenChange`, que ya existen) para la receta activa; al cerrar deja
  `open: false` sin soltar la receta, para que el diálogo anime su salida.
- Si `RowActionsSpec` (`components/shared/data-table/data-table-types.ts`) no admite todavía
  `triggerDataAttributes`, se añade a su `Pick` (cambio de tipo sin árbol nuevo, QC-263 D4). T0a lo mira.

**D3 — Columnas y tarjetas (R2, R5, R6).** `stepCount`, `createdAt` y `updatedAt` pasan a
`align: 'end'` y `tabular: true` (QC-270 alinea la cabecera). `RecipeTable` pasa
`card={{ primary: IMAGE_COLUMN_ID, title: 'name', meta: ['stepCount', 'createdAt', 'updatedAt'] }}` y
`RECIPE_TABLE_TEXTS` gana `cardActions: 'Acciones'` y `closeMenu: 'Cerrar'`. La miniatura de la
tarjeta es la `EntityImage` de la celda. El umbral es el de `DataTable` (760 px de contenedor).

Consecuencia que T0a mide: con `card`, cada celda y cada disparador del menú están **dos veces en el
DOM** (tabla y tarjeta). Los localizadores de página por `recipe-row-actions` o por celda se acotan a
`data-table-row-<id>` / `data-table-card-<id>`, como en QC-265 y QC-262.

**D4 — Subir PDFs (R7–R9; P1).** Cambio visual de `components/shared/document-upload/`, sin cambiar su
API ni sus `data-testid`:

- `document-upload-dialog.tsx`: el disparador gana `UploadIcon`; `DialogContent` pasa de
  `sm:max-w-lg max-h-[85dvh]` a `max-sm:w-[calc(100vw-32px)] sm:max-w-[640px] max-h-[calc(100dvh-32px)]`
  con desplazamiento interno (T0b comprueba las clases reales de `components/ui/dialog.tsx`, que no se
  edita).
- `document-upload-row.tsx`: la fase y el estado pasan a `StatusBadge` con dos mapas exhaustivos
  nuevos en `labels.ts`:
  ```ts
  export const BROWSER_PHASE_TONES: Record<BrowserPhase, StatusTone> = {
    pending: 'neutral', uploading: 'progress', uploaded: 'success', failed: 'danger' };
  export const FILE_STATUS_TONES: Record<DocumentFileStatus, StatusTone> = {
    queued: 'neutral', processing: 'info', done: 'success', error: 'danger' };
  ```
  `data-testid`, `data-phase` y `data-status` pasan al `StatusBadge` (acepta `data-*`). La fila gana el
  icono de documento delante del nombre. «Revisar» pasa a `ArrowLink direction="forward" size="sm"
  touch` con su `data-testid` de hoy.
- `labels.ts`: `CLEAR_LABEL = 'Quitar la selección'`, `UNKNOWN_BATCH_LABEL = 'La tanda ya no está
  disponible.'`.

**D5 — Formulario: cabecera y tarjetas (R10–R12).** Las dos páginas pintan `PageShell` >
`ArrowLink direction="back" href={FORMULAS_ROUTE} touch testId="recipe-form-back-link"` («Volver a la
lista») y el `h1` de hoy con su `data-testid`. `RecipeForm` envuelve sus bloques en `Card`: imagen +
nombre + descripción (sin título visible, P8; la imagen en fila con su texto en escritorio y encima en
teléfono), `RecipeLinesField`, `RecipeStepsField` × 2. Los títulos de sección siguen siendo `h2` de las
piezas (no se duplican).

`RecipeLinesField` pinta las pestañas con contador: dentro de cada `TabsTrigger`, la etiqueta y
`<span className="font-mono tabular-nums …" data-testid="recipe-lines-tab-<tipo>-count">{n}</span>`,
con `n` = líneas del estado (sin la fila fantasma). El nombre accesible pasa a «Ingredientes 3»; los
tests que buscan la pestaña por nombre exacto se migran a su `data-testid` (§ 7).

**D6 — Versiones al costado y pie fijo (R13–R15).** Hoy `RecipeVersionList` se monta debajo de
`RecipeForm` desde `page.tsx`. Para las dos columnas:

- `RecipeForm` gana `aside?: ReactNode`. Su raíz pasa a ser un contenedor de consultas con dos
  hermanos: el `<form id={formId} data-testid="recipe-form">` con las tarjetas y un `<aside>` con
  `aside`. Con contenedor de 880 px o más, fila (`flex-[3_1_560px]` / `flex-[1_1_300px]`); con menos,
  columna (P13).
- El `aside` queda **fuera del `<form>`** a propósito: la sección lleva el `DeleteConfirmDialog` de cada
  versión, y un envío dentro de un portal sube por el árbol de React hasta el `onSubmit` del formulario.
- El pie (`FormFooterBar`, § D7) va después de los dos, dentro de la raíz. «Guardar» es
  `<Button type="submit" form={formId}>`: el atributo `form` asocia el botón al formulario sin estar
  dentro (estándar HTML; Safari y Chrome lo admiten). El envío por Enter en un campo sigue funcionando
  porque el botón por defecto es el primer `submit` cuyo dueño es el formulario. T0c lo comprueba en
  jsdom y en WebKit antes de mover nada; si falla, el plan B es dejar el `aside` dentro del `<form>` tras
  comprobar que el borrado de versión no envía el formulario.
- `page.tsx` de edición pasa `aside={<RecipeVersionList originalId={id} versions={…} />}`; la de alta,
  `aside={<RecipeVersionList originalId={null} versions={[]} />}` (P2).

**D7 — `FormFooterBar` (R15, R36, R40).** `app/(private)/produccion/formulas/components/form-footer-bar.tsx`,
sin `'use client'` (no tiene estado; recibe nodos):

```ts
export type FormFooterBarProps = {
  readonly leading?: ReactNode;   // «Vista previa», pegado a la izquierda
  readonly children: ReactNode;   // acciones a la derecha
  readonly testId?: string;
};
```

`sticky bottom-0 z-10`, borde superior, fondo de tarjeta al 92 % con desenfoque, `flex flex-wrap
justify-end gap-3`, relleno `14px` y `calc(14px + env(safe-area-inset-bottom))` abajo, márgenes
negativos iguales al relleno de `PageShell` para ir de borde a borde del área de contenido. Los botones
son `touch` (44 px, D7). T0d mide en 390 × 844 y 1440 × 900 que el pie queda visible sin desplazar y que
el último campo no queda tapado (si lo queda, `PageShell` de estas páginas gana relleno inferior por
`className`, nunca tocando `page-shell.tsx`).

**D8 — Editor de pasos (R16–R19).** Solo cambia la presentación de `recipe-steps-field.tsx` y la barra
de `recipe-step-editor.tsx`:

- Fila: `grid grid-cols-[44px_minmax(0,1fr)_44px]`; columna izquierda con el asa de hoy y debajo el
  número (`font-mono`, círculo de 28 px, `aria-hidden`: la posición ya está en el nombre del asa);
  centro, el editor; derecha, `Button variant="ghost" size="icon" touch` con `Trash2Icon`,
  `aria-label` «Quitar paso N» y el `data-testid` de hoy (deja de pintar el texto «Quitar»).
- «Añadir paso» baja al final de la lista: `Button variant="outline"` a todo el ancho, 44 px, borde
  discontinuo, `PlusIcon`; mismo `data-testid`.
- Estados de arrastre con lo que ya da `useSortable`: la fila activa (`isDragging`) lleva
  `data-dragging="true"`, `shadow-lg border-primary scale-[1.01] motion-reduce:scale-100`; mientras
  hay un paso activo en esa lista (`useDndContext().active !== null`), las demás llevan
  `data-drop-target="true"` y `border-dashed border-primary`. Al soltar o cancelar, `active` vuelve a
  `null` y desaparecen. Transición de 200 ms en sombra, borde y escala.
- Barra: fondo `bg-muted`, borde inferior, botones sin borde con `aria-pressed` y fondo de tarjeta
  cuando están activos; **siguen de 44 × 44 px** (P5, R26 de QC-64). Las tres acciones, sus iconos,
  `aria-label` y `data-testid` no cambian; solo los glifos «N», «C» y «☑» pasan a iconos de
  `lucide-react` (`BoldIcon`, `ItalicIcon`, `ListChecksIcon`) con `aria-hidden`.
- Nada de lo demás se toca: sensores, `activationConstraint`, anuncios, `handleDragEnd`, nombre del
  asa, `touch-none` del asa. `@dnd-kit/*` sigue solo en `recipe-steps-field.tsx` (R19).

**D9 — Vista previa (R21–R26).** Dos piezas:

1. `StepReader` gana `layout?: 'inline' | 'panel'` (por defecto `'inline'`, que es el árbol de hoy;
   solo se lee en `mode="lectura"`). Con `'panel'`:
   - raíz `flex h-full min-h-0 flex-col`;
   - cabecera: `step-reader-position` («Paso N de M», en negrita) y `StepProgress` (el componente
     interno que hoy solo usa `ejecucion`, sin cambios);
   - cuerpo `min-h-0 flex-1 overflow-y-auto` con el documento, el motivo de bloqueo como
     `Notice tone="info"` (`id={reasonId}`, `testId="step-reader-blocked-reason"`) y la espera como
     `Notice tone="warning"` (`id={waitReasonId}`, `testId="step-reader-wait-reason"`); los
     `aria-describedby` de los botones no cambian;
   - pie `border-t px-6 pt-3.5 pb-[calc(14px+env(safe-area-inset-bottom))] flex justify-end gap-3`
     con «Anterior» (`outline`, `basis-40`) y «Siguiente»/«Finalizar» (`basis-56`), `touch`, mismos
     `data-testid`;
   - el envoltorio del documento lleva `data-direction` (`advance` o `go_back`, según el último
     cambio) y entra con `animate-in fade-in slide-in-from-right-7` o `slide-in-from-left-7`, 200 ms,
     `motion-reduce:animate-none` (`tw-animate-css` ya está importado en `app/globals.css`).

   Toca solo `step-reader.tsx`; `inline` y `ejecucion` no cambian de árbol (R26, lo afirma
   `step-reader.test.tsx`).
2. `recipe-form.tsx` (sigue siendo el único montador de la ruta): `DialogContent` con
   `p-0 gap-0 flex flex-col overflow-hidden`, en `<768 px` `h-dvh w-screen max-w-none rounded-none`
   (pantalla visible entera) y desde 768 px `w-[min(920px,calc(100vw-48px))]
   h-[min(900px,calc(100dvh-64px))] max-w-none`; cabecera con título, descripción con tildes (R21) y
   el botón «Cerrar» de 44 px; el `StepReader` con `layout="panel"` ocupa el resto. Conserva
   `data-testid="recipe-form-preview"`, `finalFocus` y el montaje solo mientras está abierto (R25).
   T0b confirma cómo `components/ui/dialog.tsx` posiciona el popup para que `h-dvh` no deje hueco
   (el archivo no se edita; si hace falta, se sobreescribe la posición por `className`).

**D10 — Propagar (R27–R29).** `PropagateVersionsDialog` recibe
`Pick<RecipeVersionSummary, 'id' | 'name' | 'isUnderReview'>` (la ficha ya lo tiene). El título pinta
el número en `<span className="font-mono">`; `dialogTitle` sigue siendo la única regla de singular y
plural. Cada fila: `label` de `min-h-12` con la casilla, el nombre y, si `isUnderReview`,
`StatusBadge tone="waiting" label="Por revisar"` (`data-testid="propagate-version-under-review"`).
Botones y conducta de hoy. Conserva `max-h-[85dvh]` (lo afirma `recipe-form-propagation.test.tsx`).

**D11 — Toasts (R46).** Sin cambio de producción. Test nuevo `tests/unit/recetas-ui/formulas-toasts.test.tsx`
con `sonner` simulado que recorre los seis éxitos (y el de edición con versión por revisar) y comprueba
un único `toast.success` con su texto.

**D12 — Lista de versiones (R30, R31).** `RecipeVersionList`:

- `originalId: string | null`. Con `null`, «Nueva versión» es `Button size="sm" disabled` con
  `PlusIcon` y el cuerpo es el vacío de hoy.
- Con `originalId`, «Nueva versión» es el enlace de hoy con forma `outline sm` + `PlusIcon` y `touch`.
- Fila (`flex items-center gap-3 min-h-12`): nombre en `truncate` con `title`; `StatusBadge` `waiting`
  «Por revisar» (`recipe-version-under-review`); `ArrowLink direction="forward" size="sm" touch`
  «Abrir» con `aria-label` «Abrir la versión <nombre>» y `testId="recipe-version-link"`; el borrado de
  versión de hoy (P3). El nombre deja de ser enlace.
- Tonos desde el mapa único de la ruta (D14).

**D13 — Página y formulario de versión (R32–R36).**

- Las dos páginas pintan `PageShell` > `ArrowLink direction="back"
  href={recipeEditRoute(original.id)} touch testId="recipe-version-back-link"` («Volver a la receta»,
  P8) y el `h1` de hoy.
- `RecipeVersionForm`: el «Por revisar» de la versión con `StatusBadge` `waiting`; el pie pasa a
  `FormFooterBar` (no lleva `aside`, así que el botón sigue dentro del `<form>`).
- `RecipeLinesField` con `baseline`: la marca de cada línea con `StatusBadge` (`same` → `neutral`,
  `changed` → `waiting`, `added` → `success`), `data-testid`/`data-mark` de hoy; con `changed`, el
  texto «Original: X %» pasa a pintar el porcentaje con `line-through` (el texto no cambia; solo el
  tachado de la cifra). Fondo de la fila en ámbar o verde suave según la marca. Cada quitado con
  `StatusBadge tone="danger" label="Quitado"` y el nombre tachado.
- Resumen nuevo en la cabecera del bloque de líneas, solo con `baseline`: tres `StatusBadge` «Igual N»,
  «Cambiado N», «Añadido N» (`data-testid="recipe-lines-diff-summary"`), contados con
  `compareWithOriginal` en el mismo render que las marcas.

**D14 — Mapa único de tonos de la ruta (R44).** Nuevo
`app/(private)/produccion/formulas/components/recipe-version-tones.ts`:

```ts
export const RECIPE_VERSION_MARK_TONES: Record<VersionLineMark['kind'] | 'removed', StatusTone> = {
  same: 'neutral', changed: 'waiting', added: 'success', removed: 'danger' };
export const RECIPE_VERSION_UNDER_REVIEW_TONE: StatusTone = 'waiting';
export const RECIPE_VERSION_UNDER_REVIEW_LABEL = 'Por revisar';
```

Lo usan `RecipeVersionList`, `PropagateVersionsDialog`, `RecipeVersionForm` y `RecipeLinesField`. Se
borran `MARK_VARIANT` y los imports de `Badge` de la ruta.

**D15 — Revisión de importación (R37–R43).**

- `importar/[documentoId]/page.tsx`: `PageShell` > `ArrowLink direction="back" href={FORMULAS_ROUTE}
  touch testId="formula-import-back-link"` («Volver al listado») y el `h1` de hoy; el error
  (`ImportErrorNotice`) cambia su enlace por `ArrowLink direction="back"` con el `data-testid` de hoy.
- `FormulaImportReview`: tarjeta con nombre y descripción; tarjeta «Ingredientes» (`h2`) con
  «N · S %» en su cabecera (`data-testid="formula-import-ingredients-summary"`); `formula-import-sum`
  sigue pintándose debajo de la lista; «Añadir ingrediente» discontinuo a todo el ancho; los dos
  `RecipeStepsField` de hoy; «Confirmar» en `FormFooterBar`.
- `FormulaIngredientRow`: número en círculo, «Referencia del PDF» con lo leído, quitar con `XIcon` y
  texto «Quitar» en `hidden sm:inline` (debajo de 640 px solo el icono, 44 × 44, `aria-label` «Quitar
  el ingrediente N»), porcentaje y producto o materia prima nueva con los botones de hoy.
- `FormulaNameClash`: `Notice tone="warning"` con el texto de hoy y, debajo, «Cambiar el nombre»
  (`outline`) y «Reemplazar» (`destructive`), `touch`, `data-testid` de hoy. `role` lo pone `Notice`
  (`status`); hoy es `alert`: los tests que lo buscan por rol se migran (§ 7). Sigue en línea (P9).
- `FormulaImportSummary`: `Card` con `CircleCheckIcon` en tono éxito, el resultado como `h2`
  (`formula-import-summary-outcome`), las dos cifras en `font-mono` de 24 px con su etiqueta y, al pie,
  `ArrowLink back` «Volver al listado» (`formula-import-summary-back-link`, nuevo) y `ArrowLink forward`
  «Ver la fórmula» (`formula-import-summary-link`). Conserva `role="status"`.

**D16 — Guardia (R44, R45).** `tests/guards/guard-formulas-rediseno.test.ts`:

- ningún archivo de `app/(private)/produccion/formulas/` importa `@/components/ui/badge`;
- ninguno define un `Record` de marcas de versión fuera de `recipe-version-tones.ts`
  (literales `same:`/`changed:`/`added:` con valores de tono);
- ni `app/`, ni `components/` contienen «Asi se leera», «aqui se guarda», «Quitar la seleccion» ni
  «ya no esta disponible».

## 5. Contratos que cambian

| Símbolo | Antes | Después |
| --- | --- | --- |
| `recipeRowActionsSpec`, `RecipeRowAction` | — | nuevos en `recipe-row-actions.tsx` |
| `RecipeRowActions` | arma los ítems y su diálogo | envoltorio sobre `recipeRowActionsSpec` |
| `RecipeColumnsDeps` | `rowActions` | `menu` |
| `RECIPE_TABLE_TEXTS` | — | + `cardActions`, `closeMenu` |
| `RecipeTable` | sin `card`, diálogo por fila | `card` + receta activa, un diálogo por tabla |
| `RowActionMenuItem` | sin separador | + `separatorBefore?` (si no está en `dev`) |
| `RowActionsSpec` | `Pick<…, 'items' \| 'triggerLabel' \| 'triggerTestId' \| 'title'>` | + `'triggerDataAttributes'` (si no está en `dev`) |
| `StepReader` | `mode` | + `layout?: 'inline' \| 'panel'` |
| `RecipeForm` | — | + `aside?` |
| `RecipeVersionList` | `originalId: string` | `originalId: string \| null` |
| `PropagateVersionsDialog` | `versions: Pick<…, 'id' \| 'name'>[]` | + `'isUnderReview'` |
| `FormFooterBar` | — | nuevo en la ruta |
| `RECIPE_VERSION_MARK_TONES`, `RECIPE_VERSION_UNDER_REVIEW_*` | — | nuevos en la ruta |
| `BROWSER_PHASE_TONES`, `FILE_STATUS_TONES` | — | nuevos en `document-upload/labels.ts` |
| `CLEAR_LABEL`, `UNKNOWN_BATCH_LABEL` | sin tilde | con tilde |

## 6. Snapshots y árboles que cambian (aceptados)

Toda diferencia de paridad que no esté aquí es un fallo de la tanda:

| Archivo | Cambio | Requisito |
| --- | --- | --- |
| `tests/unit/paridad/recetas-paridad.test.tsx` (+ `.snap`) | cabecera con `PageHeader` y `ArrowLink`; columnas alineadas; `actionsColumn({ menu })` y tarjetas; formulario en tarjetas, pestañas con contador, pasos en tarjeta, pie fijo, sección de versiones al costado; marcas con `StatusBadge`; revisión de importación | R1–R5, R10–R17, R30–R43 |
| `tests/unit/paridad/acciones-por-fila.test.tsx` (+ `.snap`) | menú de recetas con separador; un diálogo por tabla | R3, R4 |
| `tests/unit/paridad/confirmaciones-paridad.test.tsx` (+ `.snap`) | solo los casos de borrar receta o versión y de propagar | R27–R29 |
| `tests/unit/paridad/catalogo-paridad.test.tsx` (+ `.snap`) | solo el diálogo de subida del detalle de proveedor (P1) | R7–R9 |
| `tests/unit/paridad/buscadores-paridad.test.tsx` | ninguno esperado; se lista porque monta el selector de producto de la ruta | — |

La tanda 0 no regenera nada; cada snapshot se actualiza en la tanda que cambia la pantalla y el commit
cita la fila.

## 7. Tests y E2E que se tocan (barrido con grep, 2026-10-13)

**Unitarios que cambian aserciones:**

| Test | Por qué |
| --- | --- |
| `tests/unit/recetas-ui/recipe-page.test.tsx` | `PageHeader`, orden de acciones, tarjetas, menú como datos |
| `tests/unit/recetas-ui/recipe-form.test.tsx`, `recipe-form-packing-steps.test.tsx`, `recipe-form-propagation.test.tsx` | tarjetas, pie con `form=`, `aside`, vista previa en panel y con tilde |
| `tests/unit/recetas-ui/recipe-steps-field.test.tsx`, `recipe-step-editor.test.tsx` | quitar con icono, «Añadir» al final, estados de arrastre, iconos de la barra |
| `tests/unit/recetas-ui/recipe-lines-tabs.test.tsx`, `recipe-lines-baseline.test.tsx`, `recipe-lines-field-tools.test.tsx`, `recipe-lines-sum.test.tsx`, `recipe-lines-unavailable.test.tsx`, `recipe-lines-no-finished-product.test.tsx` | contador en la pestaña (nombre accesible), marcas con `StatusBadge`, resumen |
| `tests/unit/recetas-ui/recipe-version-form.test.tsx`, `recipe-version-list.test.tsx`, `recipe-version-pages.test.tsx` | «Abrir», «Por revisar» `waiting`, alta deshabilitada, «Volver a la receta», pie |
| `tests/unit/recetas-ui/delete-recipe-dialog.test.tsx` | controlado desde la tabla |
| `tests/unit/recetas-ui/formula-import-page.test.tsx`, `formula-import-review.test.tsx` | «Volver al listado», tarjetas, choque con `Notice` (`role="status"`), resumen |
| `tests/unit/recetas-ui/step-reader.test.tsx` | `layout="panel"`; `inline` y `ejecucion` sin cambios |
| `tests/unit/recetas-ui/recipe-route-contract.test.ts` | barrel con `FormFooterBar` y `recipe-version-tones`; áreas táctiles de los controles nuevos |
| `tests/unit/documentos-ui/document-upload-dialog.test.tsx`, `document-upload-rows.test.tsx`, `document-upload-review-link.test.tsx`, `document-upload-selection.test.tsx`, `document-upload-a11y-tactil.test.tsx`, `document-upload-convenciones.test.ts`, `formula-pdf-upload.test.tsx`, `formulas-upload.test.tsx`, `supplier-detail-upload.test.tsx` | tamaño del diálogo, `StatusBadge`, «Revisar» con flecha, tildes |
| `tests/unit/marca/badges-estado.test.tsx` | «Por revisar» de lista y formulario pasa de `info` a `waiting` (enmienda, § 10) |
| `tests/unit/marca/tablas-marca.test.tsx` | `buildRecipeColumns` con `menu`; alineación |
| `tests/unit/shared-ui/row-actions-menu-centrado.test.tsx` | sin `separatorBefore`, árbol de hoy (solo si T1a se hace aquí) |
| `tests/unit/shared-ui/catalogo-qc256.test.ts` | fila de `RowActionsMenu` con el punto de extensión (solo si T1a se hace aquí) |

**Tests nuevos:** `tests/unit/recetas-ui/recipe-row-actions-spec.test.tsx` (R3, R4),
`tests/unit/recetas-ui/recipe-cards.test.tsx` (R2, R5, R6), `tests/unit/recetas-ui/recipe-form-layout.test.tsx`
(R10–R15), `tests/unit/recetas-ui/recipe-form-preview.test.tsx` (R21–R25: monta `RecipeForm`, no importa
`step-reader`), `tests/unit/recetas-ui/propagate-versions-dialog.test.tsx` (R27–R29),
`tests/unit/recetas-ui/recipe-version-marks.test.tsx` (R33–R35),
`tests/unit/recetas-ui/formula-import-layout.test.tsx` (R37–R43), `tests/unit/recetas-ui/formulas-toasts.test.tsx`
(R46), `tests/unit/documentos-ui/document-upload-tones.test.tsx` (R8),
`tests/unit/shared-ui/row-actions-menu-separator.test.tsx` (R3, solo si T1a se hace aquí) y
`tests/guards/guard-formulas-rediseno.test.ts` (R44, R45).

**E2E que cambian** (corren en el PR a producción; T9 los corre por spec):

| E2E | Qué cambia |
| --- | --- |
| `e2e/versiones-en-la-receta.spec.ts` | `page.getByTestId('recipe-row-actions')` con `toHaveCount(1)` pasa a dos (tabla y tarjeta): se acota a `data-table-row-<id>`; las filas de versión se buscan por `getByRole('link', { name })` y el nombre deja de ser enlace: pasa a «Abrir la versión <nombre>» |
| `e2e/recetas.spec.ts`, `e2e/recetas-porcentaje.spec.ts`, `e2e/versiones-de-receta.spec.ts`, `e2e/aislamiento-recetas.spec.ts`, `e2e/errores.spec.ts` | leen filas por `data-table-row-<id>` y testids que se conservan; solo cambian si algún localizador es de página entera o por rol de enlace de versión |
| `e2e/recetas-pasos.spec.ts` | la vista previa lee testids que se conservan; el motivo pasa dentro de `Notice` |
| `e2e/pasos-de-envasado.spec.ts`, `e2e/formula-desde-pdf.spec.ts` | «Quitar» del paso sin texto (por testid, se conserva); choque con `role="status"`; «Volver al listado» nuevo |
| `e2e/documentos.spec.ts`, `e2e/catalogo-desde-pdf.spec.ts`, `e2e/movimiento.spec.ts` | estado de cada archivo dentro de `StatusBadge` (mismo testid y `data-status`); «Revisar» con flecha |

**E2E nuevo:** `e2e/formulas-rediseno.spec.ts` (Chromium y WebKit), con una receta sembrada con dos
versiones (una por revisar) y un paso con lista de verificación:

- a 1440 × 900: cabecera con «Subir PDFs» antes de «Nueva fórmula» (R1); columnas en orden y Pasos,
  Creado y Actualizado alineados a la derecha con su cabecera (R2); menú ⋯ con «Editar», separador y
  «Borrar» (R3); formulario con «Versiones» a la derecha del formulario y el pie fijo visible sin
  desplazar (R13, R15); «Por revisar» en una línea (R30); vista previa centrada de hasta 920 × 900 con
  el pie del diálogo visible (R22, R23); diálogo de propagar en plural (R27);
- a 820 × 1180: «Versiones» debajo del formulario; listado en tarjetas (R5, R13);
- a 390 × 844: tarjetas con «Acciones» de 44 px y menú centrado con ítems de 48 px (R5, R47); sin
  desborde horizontal en formulario, versión y revisión (R20); vista previa que ocupa la pantalla
  visible entera, con «Anterior» y «Siguiente» dentro de ella (R23); diálogos de borrar, propagar y
  subir enteros (R47); pie con botones de 44 px (R15).

Se da de alta en `E2E_ESPERADOS` de `tests/guards/guard-identificador-de-request.test.ts` y en la lista
cerrada de `tests/unit/shared/data-table-alcance.test.ts` (un apéndice más, en su orden alfabético),
con el comentario «Alta el <fecha> (QC-264) por el MISMO motivo y en el MISMO sitio que las demas: …»,
como las de QC-265 y QC-262.

T0a repite el grep antes de tocar nada y lo deja en `progress/impl_QC-264.md`.

## 8. Alternativas descartadas

- **A1 — Un lector propio en la ruta para la vista previa** (copiar el paso a paso dentro de
  `recipe-form.tsx` con el pie y los avisos del tablero). Evita tocar una pieza compartida, pero duplica
  el bloqueo por casillas, la espera y el marcado en memoria, que `StepReader` ya resuelve y prueban
  QC-63, QC-64 y QC-125; la regla de decisión pide extender antes que crear. Además el lector solo puede
  importarse desde `recipe-form.tsx` en esta ruta (`recipe-route-contract`).
- **A2 — Librería nueva de arrastre, o un modo «toca para tomar, toca para soltar»** como el prototipo
  del tablero (P4). `@dnd-kit` ya está aprobado (`docs/dependencias.md`), cubre ratón, táctil y teclado
  con anuncios, y su estado (`isDragging`, `active`) basta para los estados visuales. Un segundo modo
  de mover pasos duplica la lógica de orden y el contrato de accesibilidad de QC-26 R34.
- **A3 — Choque de nombre en un `AlertDialog` al pulsar «Confirmar»** (tablero, P9). Contradice la
  decisión de QC-159 (avisar antes de confirmar) y cambia el flujo de `replaceChoice`.
- **A4 — Dejar «Versiones» dentro del `<form>`** (D6). Más simple, pero el borrado de versión monta su
  diálogo dentro del árbol del formulario y un envío en el portal llegaría al `onSubmit` de la receta.
  Queda como plan B si T0c falla.
- **A5 — Separador automático antes del primer ítem destructivo** en `RowActionsMenu`. Cambia el árbol
  de todas las listas con menú y sus snapshots sin sus fichas (QC-262 A5).
- **A6 — Dejar la subida de PDFs entera a QC-266** (P1). Evita tocar proveedores, pero la ficha de
  Fórmulas incluye sus modales y el tablero `ModalesProduccion` es el que dibuja sus estados; partir la
  pieza dejaría dos aspectos del mismo diálogo.
- **A7 — Mapa de tonos de versión en `lib/shared/ui`**, como `ORDER_STATUS_TONES`. Solo lo usa una
  ruta; QC-256 decidió dejarlo en ella hasta que lo pida una segunda.

## 9. Riesgos y coordinación

- **Duplicados de tabla y tarjeta** (D3): `recipe-row-actions` y las celdas pasan a estar dos veces en
  el DOM; es lo que rompe `versiones-en-la-receta.spec.ts`. T0a lo censa entero.
- **`form=` fuera del formulario** (D6): si jsdom o WebKit no lo envían igual, T0c lo detecta antes de
  la tanda 3 y se aplica el plan B (A4).
- **Listas cerradas:** `recipe-route-contract.test.ts` (carpetas, importadores del lector, tests que lo
  nombran: los tests nuevos **no** importan `@/components/shared/step-reader`), `guard-editor-aislado`
  (`@dnd-kit` y `@tiptap` en sus archivos), `E2E_ESPERADOS` y `data-table-alcance` (crecen por
  apéndice), `catalogo-qc256` (si T1a se hace aquí).
- **Archivos compartidos con otras fichas:** `components/shared/row-actions-menu.tsx` y
  `components/shared/data-table/data-table-types.ts` (QC-262, QC-263: mismo contrato, el primero que
  llegue a `dev` lo pone y los demás lo reutilizan); `components/shared/step-reader/step-reader.tsx`
  (QC-268, `pending`); `components/shared/document-upload/*` (QC-266, `pending`);
  `components/shared/CATALOGO.md` (cualquier ficha de rediseño en vuelo); `recipe-form.tsx`,
  `recipe-steps-field.tsx` y `recipe-lines-field.tsx` (QC-210, QC-173, QC-198, QC-214, `pending`).
  `scripts/archivos-en-vuelo.mjs` lo comprueba con `## Archivos esperados`.
- **Nombres accesibles que cambian:** pestañas con contador («Ingredientes 3»), enlace de versión
  («Abrir la versión X»), choque (`status` en vez de `alert`). § 7 los lista; T0a busca además por
  `getByRole` en `tests/` y `e2e/`.
- **Tamaño:** la ficha es `medium` y toca cinco pantallas, una pieza compartida con proveedores y el
  lector. Las tandas 2–7 son independientes entre sí tras la 1.

## 10. Enmiendas a specs cerrados

| Spec | Qué cambia | Por qué |
| --- | --- | --- |
| QC-64 (R26: tope `85dvh` de la vista previa) | En teléfono la vista previa ocupa `100dvh`; desde 768 px, hasta 900 px de alto y la ventana menos 64 px | Ficha `FormulaMovil` (D14); `dvh` sigue respetando la barra de iOS, que es lo que R26 protegía |
| QC-227 (`tests/unit/marca/badges-estado.test.tsx`) | «Por revisar» de la lista de versiones y del formulario pasa de variante `info` de `Badge` a `StatusBadge` `waiting` | D3 del humano |
| QC-174 (`recipe-version-list.test.tsx`) | El nombre de la versión deja de ser enlace; abre «Abrir» con flecha | D2 del humano |
| QC-160 (`document-upload-dialog.test.tsx`, `max-h-[85dvh]`) | El diálogo de subida mide hasta 640 px y en teléfono el ancho visible menos 32 px | Ficha `FormulasMovil` (P1) |
| QC-55 (`tests/unit/shared/data-table-alcance.test.ts`) | La lista cerrada de E2E gana `e2e/formulas-rediseno.spec.ts` | § 7 |

## 11. Deudas

- **Nueva:** icono en la cabecera de los diálogos de Fórmulas (P14), como la de QC-262 P5.
- **D53** (esqueletos que no casan con las tarjetas) se amplía a `/produccion/formulas` si al medir el
  esqueleto de la tabla en tarjetas no coincide.
- **Nuevas si se confirman fuera:** espera por paso (P6), «Devolver» un quitado (P8), nombre del PDF
  en la revisión (P10).

## Dependencias de terceros

Ninguna nueva. `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` y `@tiptap/*` ya están
aprobadas (`docs/dependencias.md`, QC-26 y QC-64) y no cambian de archivo importador; `@base-ui/react`
(Dialog, AlertDialog, Tabs, Menu), `sonner`, `lucide-react`, `tw-animate-css` y `@tanstack/react-table`
ya están.
