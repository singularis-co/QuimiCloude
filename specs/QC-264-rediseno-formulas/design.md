# QC-264 — rediseno-formulas · design.md

> **Aprobado el 2026-10-13** (P1–P15 por defecto) y **enmendado el 2026-10-19 contra `dev`** (merge
> `6fcbafe6`): ver § 12, tabla E1–E22. Las secciones de abajo llevan una nota *Enmienda (E<n>)* donde
> la enmienda las cambia; si una nota contradice al texto que la rodea, manda la nota.

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
| QC-262 y QC-263 (aprobados, sin implementar) pasan el menú ⋯ a datos con un anfitrión de diálogos por tabla, y comparten el contrato `separatorBefore` (QC-262 D7) y el `triggerDataAttributes` en `RowActionsSpec` (QC-263 D4) | `.worktrees/QC-262-rediseno-pedidos/specs/…/design.md > D5, D7`, `.worktrees/QC-263-rediseno-inventario/specs/…/design.md > D4, D12` | Mismo enfoque y mismo contrato, sin variante (D2, D3); T0a mira qué ya está en `dev`. *Enmienda (E3, E4, E15):* los dos están en `dev` (`specs/QC-262-rediseno-pedidos/`, `specs/QC-263-rediseno-inventario/`); `separatorBefore` existe y `triggerDataAttributes` **no** entró en `RowActionsSpec`: va en un tipo local de la ruta |
| QC-269 (`done`) dejó en `StepReader` la reserva del pie fijo en `ejecucion`; QC-270 (`done`), la cabecera de `DataTable` alineada con su columna | `components/shared/step-reader/step-reader.tsx`, `components/shared/data-table/` | Se reutiliza: `align: 'end'` ya alinea la cabecera (R2); el modo `ejecucion` no se toca (R26) |
| QC-159: «la revisión avisa del choque antes de confirmar» | `specs/QC-159-formula-desde-pdf/requirements.md > Decisiones` | El choque sigue en línea (R41, P9) |
| La espera por paso es de la empresa (`minStepSeconds`, QC-125) | `components/shared/step-reader/step-reader.tsx` | El campo de espera por paso del tablero queda fuera (P6) |
| `recipe-route-contract.test.ts` cierra: carpetas de la ruta, importadores del lector (`recipe-form.tsx` es el único de la ruta) y tests que nombran `step-reader` | `tests/unit/recetas-ui/recipe-route-contract.test.ts` | Ninguna carpeta nueva; el lector se sigue montando solo en `recipe-form.tsx`; los tests nuevos no importan `step-reader` (§ 9) |
| QC-210, QC-173, QC-198, QC-214 (`pending`) tocan el formulario o los pasos; QC-268 (`pending`), el import profundo de `StepDocumentView`; QC-266 (`pending`), la otra pantalla que usa la subida | `feature_list.json` | No se adelanta nada; riesgo de choque en § 9. *Enmienda (E5, E7):* QC-214 y QC-211 (D14) están en `dev` y cambiaron la fila del paso; el rediseño los conserva. QC-266 está `spec_ready` (va después de esta) |

**Filas de `components/shared/CATALOGO.md` consultadas y paso de la regla de decisión**
(`docs/perfil-agentes.md > Regla de decisión para componentes`):

| Pieza | Filas consultadas | Paso | Por qué no bastaba el anterior | Tablero |
| --- | --- | --- | --- | --- |
| Cabeceras de página | `PageShell`, `PageHeader`, `ArrowLink` | 1 · reutiliza | — | `Superficies.dc.html`, `Botones.dc.html`, `Formula.dc.html` |
| Tabla, tarjetas y menú ⋯ | `DataTable` (`card`, `actionsColumn({ menu })`), `RowActionsMenu`, `EntityImage` | 1 · reutiliza | — | `Tabla.dc.html`, `Formulas.dc.html` |
| Separador del menú | `RowActionsMenu`, `DropdownMenu`, `Separator` | ~~2 · extiende `RowActionsMenu`~~ *Enmienda (E3):* 1 · reutiliza (`separatorBefore` ya está en `dev`) | — | `Tabla.dc.html`, `Formulas.dc.html` (`.sep`) |
| «Subir PDFs» sin proveedor IA *(enmienda, E1)* | `AiProviderRequiredTooltip` | 1 · reutiliza | — | `ProveedorIA.dc.html` |
| Interruptor y fila del paso con evidencia *(enmienda, E7)* | `Switch`, `RecipeStepEditor` (`evidence`, `actions`) | 1 · reutiliza | — | `FormulaEvidencia.dc.html`, `FormulaEvidenciaTablet.dc.html`, `FormulaEvidenciaMovil.dc.html` |
| Icono de los borrados *(enmienda, E16)* | `ConfirmDialog` (`icon`), `DeleteConfirmDialog` | 1 · reutiliza | — | `ModalesProduccion.dc.html` (`dlg-ic`) |
| Pestaña activa que se desliza *(enmienda, E13)* | `Tabs` (`TabsIndicator`) | 1 · reutiliza | — | `FormulaMovil.dc.html` («Pestañas cruzan 200 ms») |
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

*Enmienda (E1, E2):* la acción de subida tiene hoy **tres estados** (`page.tsx:30-31, 49-55`) y los
tres se conservan dentro de `actions`, en el mismo sitio: sin `canUpload` (también con la lectura de
PDF apagada, QC-277), nada; con `canUpload` y `readiness.configured`, `<FormulaPdfUpload />`; con
`canUpload` y sin proveedor IA, `<AiProviderRequiredTooltip><FormulaPdfUpload disabled /></AiProviderRequiredTooltip>`.
`getAiProviderReadinessAction` se sigue llamando solo con `canUpload`. El orden de hoy es «Nueva
fórmula» y después la subida (`page.tsx:41-55`); se invierte porque lo pide el tablero (R1).

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
  *Enmienda (E4):* no lo admite (`data-table-types.ts:65`) y QC-262 y QC-263 no lo añadieron: cada
  ruta declara `export type <X>RowActionsSpec = RowActionsSpec & Pick<RowActionsMenuProps,
  'triggerDataAttributes'>` y el atributo llega al disparador por propagación (`actions-column.tsx:25-27`;
  precedentes `product-row-actions.tsx:39-41`, `order-row-actions.tsx:195`). Aquí,
  `RecipeRowActionsSpec` en `recipe-row-actions.tsx`, que es lo que devuelve `recipeRowActionsSpec`.
  `data-table-types.ts` no se toca. `ProductRowActions` (`product-row-actions.tsx:116-122`) es el modelo
  del envoltorio.

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
- *Enmienda (E10):* se conservan la prop `disabled` del disparador (`document-upload-dialog.tsx:29, 44`;
  el icono también sale deshabilitado) y la línea del motivo de error de la fila
  (`document-upload-row.tsx:21, 74-78`, `document-upload-row-reason-<i>`), que van debajo del
  `StatusBadge` con su texto de hoy.

**D5 — Formulario: cabecera y tarjetas (R10–R12).** Las dos páginas pintan `PageShell` >
`ArrowLink direction="back" href={FORMULAS_ROUTE} touch testId="recipe-form-back-link"` («Volver a la
lista») y el `h1` de hoy con su `data-testid`. `RecipeForm` envuelve sus bloques en `Card`: imagen +
nombre + descripción (sin título visible, P8; la imagen en fila con su texto en escritorio y encima en
teléfono), `RecipeLinesField`, `RecipeStepsField` × 2. Los títulos de sección siguen siendo `h2` de las
piezas (no se duplican).

`RecipeLinesField` pinta las pestañas con contador: dentro de cada `TabsTrigger`, la etiqueta y
`<span className="font-mono tabular-nums …" data-testid="recipe-lines-tab-<tipo>-count">{n}</span>`,
con `n` = líneas del estado (sin la fila fantasma). El nombre accesible pasa a «Ingredientes 3»; los
tests que buscan la pestaña por nombre exacto se migran a su `data-testid` (§ 7). *Enmienda (E13):*
la pastilla que se desliza entre pestañas es `TabsIndicator` (`components/ui/tabs.tsx`, fila del
catálogo), dentro de una `TabsList` con `relative`; no se escribe a mano.

*Enmienda (E9):* la imagen es `ImageField` de `components/shared` (`recipe-form.tsx:10, 421-429`); no
existe `recipe-image-field.tsx`. La tarjeta de datos la envuelve sin tocar la pieza.

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
- *Enmienda (E7, E21):* la edición hace hoy seis lecturas en paralelo (`[id]/page.tsx:75-91`, con
  máquinas y `getRecipeStepLockAction`) y pasa `lockingOrders` (`:176`); eso no cambia. El aviso de
  bloqueo (`recipe-form.tsx:389-393`) se queda dentro del `<form>`, encima de las tarjetas (R51), y
  `PropagateVersionsDialog` sigue montado dentro del `<form>` (`:576-589`; sus botones son
  `type="button"`).

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

*Enmienda (E5, E6, E7; supuesto P16).* La fila de `dev` ya no es la que describía D8: QC-211 D14 quitó
«Añadir paso» y puso un «+» por paso, y QC-214 metió en la barra el interruptor «Requiere evidencia»;
quitar y añadir llegan al editor por su prop `actions` y se pintan en la barra
(`recipe-step-editor.tsx:197-217`). Sustituye a las dos primeras viñetas y a la de la barra:

- Tarjeta: `grid grid-cols-[44px_minmax(0,1fr)]`; a la izquierda, el asa de hoy y debajo el número
  (como arriba); a la derecha, `RecipeStepEditor` entero. No hay tercera columna.
- Barra (`recipe-step-editor.tsx`): fondo `bg-muted` y borde inferior; a la izquierda, el `role="toolbar"`
  con los tres botones (44 × 44, `aria-pressed`, iconos `BoldIcon`, `ItalicIcon`, `ListChecksIcon` con
  `aria-hidden`); a la derecha, `row-tools` con el `Switch` y `actions`, como hoy. Bajo 768 px se parte
  en dos líneas (`w-full` / `md:ml-auto md:w-auto`, que ya está). Ningún `data-testid` ni nombre
  accesible cambia (`-toolbar`, `-bold`, `-italic`, `-checklist`, `-evidence`, `-row-tools`, `-remove-N`,
  `-add-N`).
- Quitar (`XIcon`, «Quitar paso N») y añadir (`PlusIcon`, «Añadir un paso después del N») ya son
  botones de icono `touch` (`recipe-steps-field.tsx:417-446`): solo se restilan. No se pinta botón de
  añadir al final (R17); la regla de `canAdd` (`:194, 308`) no cambia.
- Evidencia: el borde en tono primario del paso encendido (`:370-372`), el resumen de la lista
  (`:279-286`), la línea de ayuda (`recipe-step-editor.tsx:236-245`) y el bloqueo (`locked`: asa y
  quitar deshabilitados con su nombre, `:375-389, 424-427`; `useSortable({ disabled })`, `:357-360`) se
  conservan. Con `locked` no hay arrastre, así que no hay estados de arrastre que pintar.

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

   *Enmienda (E8):* `StepReader` ganó en `dev` `initialStepPosition`, `onStepChange`,
   `renderStepAddon`, `stepBlockReason` y `stepRequest` (`step-reader.tsx:71-85`), y el motivo visible
   puede venir de `stepBlockReason` (`:243-244`). En `panel`, el cuerpo pinta también `stepAddon`
   debajo del documento, y el `Notice` `info` lleva `reasonText` (sea de casillas o extra). La
   dirección de `data-direction` se calcula igual que la que recibe `onStepChange` (también cuando el
   cambio llega por `stepRequest`). Hoy lo montan tres archivos (`recipe-route-contract.test.ts:1313-1330,
   1496-1520`); los dos del operario usan `ejecucion` y no cambian.
2. `recipe-form.tsx` (sigue siendo el único montador de la ruta): `DialogContent` con
   `p-0 gap-0 flex flex-col overflow-hidden`, en `<768 px` `h-dvh w-screen max-w-none rounded-none`
   (pantalla visible entera) y desde 768 px `w-[min(920px,calc(100vw-48px))]
   h-[min(900px,calc(100dvh-64px))] max-w-none`; cabecera con título, descripción con tildes (R21) y
   el botón «Cerrar» de 44 px; el `StepReader` con `layout="panel"` ocupa el resto. Conserva
   `data-testid="recipe-form-preview"`, `finalFocus` y el montaje solo mientras está abierto (R25).
   T0b confirma cómo `components/ui/dialog.tsx` posiciona el popup para que `h-dvh` no deje hueco
   (el archivo no se edita; si hace falta, se sobreescribe la posición por `className`).
   *Enmienda (E14):* ya hay precedente en `dev`:
   `app/(private)/inventario/producto-terminado/[id]/components/batch-evidence-dialog.tsx:42` (QC-271)
   sobreescribe la posición con `top-0 left-0 h-dvh max-h-dvh w-full max-w-none translate-x-0
   translate-y-0 rounded-none` y la recupera en `md:` (`md:top-1/2 md:left-1/2 md:-translate-x-1/2
   md:-translate-y-1/2`). Se parte de esas clases (corte en `md` = 768 px) y T0b solo mide.

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
  versión de hoy (P3). El nombre deja de ser enlace. *Enmienda (E12):* `ArrowLink` no acepta
  `aria-label` (`arrow-link.tsx:11-23`); el nombre accesible sale del propio texto:
  `Abrir<span className="sr-only"> la versión {name}</span>`. La pieza no se toca, y el `sr-only` no
  va en una línea con `hover:` (`recipe-route-contract.test.ts:1175-1183`).
- Tonos desde el mapa único de la ruta (D14).

**D13 — Página y formulario de versión (R32–R36).**

- Las dos páginas pintan `PageShell` > `ArrowLink direction="back"
  href={recipeEditRoute(original.id)} touch testId="recipe-version-back-link"` («Volver a la receta»,
  P8) y el `h1` de hoy.
- `RecipeVersionForm`: el «Por revisar» de la versión con `StatusBadge` `waiting`; el pie pasa a
  `FormFooterBar` (no lleva `aside`, así que el botón sigue dentro del `<form>`). *Enmienda (E7):* la
  marca «Requiere evidencia» de los pasos heredados (`recipe-version-form.tsx:69, 114-124, 169, 202`)
  se conserva tal cual.
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
  *Enmienda (E2):* las tres primeras líneas (`requirePagePermission` × 2 y `requirePageAddon('lectura_pdf')`,
  `:81-83`) no se mueven; las vigila `tests/guards/guard-pantallas-de-anadido.test.ts:39`.
- *Enmienda (E20):* `formula-import-review.tsx`, `formula-ingredient-row.tsx` y
  `formula-import-summary.tsx` los toca también QC-203 (Christian, `in_progress`); choque aceptado (§ 9).
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

**D17 — Icono de los borrados (R50; supuesto P17, enmienda E16).** `DeleteRecipeDialog`
(`delete-recipe-dialog.tsx:119`) pasa a `DeleteConfirmDialog` la prop
`icon={{ glyph: Trash2Icon, tone: 'danger', testId: 'delete-recipe-icon' }}` (prefijo de sus
`testIds`, `:164-170`), igual en receta y
en versión; `DeleteConfirmDialog` la reenvía a `ConfirmDialog` (`delete-confirm-dialog.tsx:40-41`). Sin
cambio de textos, conducta ni `data-testid` existentes; el snapshot de `confirmaciones-paridad` (fila
de borrar, § 6) recoge el icono. Propagar no lo lleva (P17).

## 5. Contratos que cambian

| Símbolo | Antes | Después |
| --- | --- | --- |
| `recipeRowActionsSpec`, `RecipeRowAction` | — | nuevos en `recipe-row-actions.tsx` |
| `RecipeRowActions` | arma los ítems y su diálogo | envoltorio sobre `recipeRowActionsSpec` |
| `RecipeColumnsDeps` | `rowActions` | `menu` |
| `RECIPE_TABLE_TEXTS` | — | + `cardActions`, `closeMenu` |
| `RecipeTable` | sin `card`, diálogo por fila | `card` + receta activa, un diálogo por tabla |
| `RowActionMenuItem` | ~~sin separador~~ | *Enmienda (E3):* sin cambio; `separatorBefore?` ya está en `dev` |
| `RowActionsSpec` | `Pick<…, 'items' \| 'triggerLabel' \| 'triggerTestId' \| 'title'>` | *Enmienda (E4):* sin cambio |
| `RecipeRowActionsSpec` *(enmienda, E4)* | — | nuevo en `recipe-row-actions.tsx`: `RowActionsSpec & Pick<RowActionsMenuProps, 'triggerDataAttributes'>` |
| `DeleteRecipeDialog` *(enmienda, E16)* | sin icono | pasa `icon` a `DeleteConfirmDialog` (D17) |
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
| `tests/unit/paridad/confirmaciones-paridad.test.tsx` (+ `.snap`) | solo los casos de borrar receta o versión y de propagar; *enmienda (E16):* + icono en los dos borrados | R27–R29, R50 |
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
| ~~`tests/unit/shared-ui/row-actions-menu-centrado.test.tsx`~~ | *Enmienda (E3):* no se toca (T1a no aplica) |
| ~~`tests/unit/shared-ui/catalogo-qc256.test.ts`~~ | *Enmienda (E3):* no se toca |
| `tests/unit/recetas-ui/recipe-form-evidence-lock.test.tsx` *(enmienda, E7, E19)* | aviso de bloqueo encima de las tarjetas; mover y quitar deshabilitados en la barra nueva (R51) |
| `tests/unit/recetas-ui/recipe-version-form-evidence.test.tsx` *(enmienda, E7, E19)* | pie fijo; marca «Requiere evidencia» heredada sin cambios |
| `tests/unit/recetas-ui/recipe-form-mensajes-zod.test.tsx` *(enmienda, E19)* | solo si sus localizadores dependen de la estructura del formulario |
| `tests/unit/documentos-ui/document-upload-flow.test.tsx`, `document-upload-errors.test.tsx`, `document-upload-strategy.test.tsx` *(enmienda, E10, E19)* | nombran `row-status` / la fila del motivo; solo si su aserción depende del `<span>` de hoy |
| `tests/unit/navegacion/pantallas-exigen-permiso.test.tsx` *(enmienda, E19)* | monta las páginas con sus mocks (`getRecipeStepLockAction`, `getAiProviderReadinessAction`); solo si el cambio de `page.tsx` pide otro mock |

**Corren sin cambios y deben seguir en verde** *(enmienda, E2, E11, E19)*:
`tests/guards/guard-pantallas-de-anadido.test.ts`, `tests/unit/proveedores/module-contract.test.ts`,
`tests/unit/shared/ai-provider-required-tooltip.test.tsx`, `tests/unit/shared-ui/row-actions-menu-separator.test.tsx`,
`tests/unit/shared-ui/row-actions-menu-centrado.test.tsx`.

**Tests nuevos:** `tests/unit/recetas-ui/recipe-row-actions-spec.test.tsx` (R3, R4),
`tests/unit/recetas-ui/recipe-cards.test.tsx` (R2, R5, R6), `tests/unit/recetas-ui/recipe-form-layout.test.tsx`
(R10–R15), `tests/unit/recetas-ui/recipe-form-preview.test.tsx` (R21–R25: monta `RecipeForm`, no importa
`step-reader`), `tests/unit/recetas-ui/propagate-versions-dialog.test.tsx` (R27–R29),
`tests/unit/recetas-ui/recipe-version-marks.test.tsx` (R33–R35),
`tests/unit/recetas-ui/formula-import-layout.test.tsx` (R37–R43), `tests/unit/recetas-ui/formulas-toasts.test.tsx`
(R46), `tests/unit/documentos-ui/document-upload-tones.test.tsx` (R8),
~~`tests/unit/shared-ui/row-actions-menu-separator.test.tsx` (R3, solo si T1a se hace aquí)~~ (ya
existe en `dev`, E3) y `tests/guards/guard-formulas-rediseno.test.ts` (R44, R45).

**E2E que cambian** (corren en el PR a producción; T9 los corre por spec):

| E2E | Qué cambia |
| --- | --- |
| `e2e/versiones-en-la-receta.spec.ts` | `page.getByTestId('recipe-row-actions')` con `toHaveCount(1)` pasa a dos (tabla y tarjeta): se acota a `data-table-row-<id>`; las filas de versión se buscan por `getByRole('link', { name })` y el nombre deja de ser enlace: pasa a «Abrir la versión <nombre>» |
| `e2e/recetas.spec.ts`, `e2e/recetas-porcentaje.spec.ts`, `e2e/versiones-de-receta.spec.ts`, `e2e/aislamiento-recetas.spec.ts`, `e2e/errores.spec.ts` | leen filas por `data-table-row-<id>` y testids que se conservan; solo cambian si algún localizador es de página entera o por rol de enlace de versión |
| `e2e/recetas-pasos.spec.ts` | la vista previa lee testids que se conservan; el motivo pasa dentro de `Notice` |
| `e2e/pasos-de-envasado.spec.ts`, `e2e/formula-desde-pdf.spec.ts` | «Quitar» del paso sin texto (por testid, se conserva); choque con `role="status"`; «Volver al listado» nuevo |
| `e2e/documentos.spec.ts`, `e2e/catalogo-desde-pdf.spec.ts`, `e2e/movimiento.spec.ts` | estado de cada archivo dentro de `StatusBadge` (mismo testid y `data-status`); «Revisar» con flecha |
| `e2e/integraciones-proveedor-ia.spec.ts`, `e2e/modulos-por-empresa.spec.ts` *(enmienda, E1, E2, E19)* | leen `recipes-title` y `document-upload-open` (`integraciones-proveedor-ia.spec.ts:70-71`, `modulos-por-empresa.spec.ts:49-50`), que se conservan: deben pasar sin cambios con el botón deshabilitado, oculto o activo |
| `e2e/ejecucion-receta.spec.ts` *(enmienda, E8, E19)* | `StepReader` en `ejecucion` (R26): debe pasar sin cambios |
| `e2e/formula-desde-pdf.spec.ts:368`, `e2e/pasos-de-envasado.spec.ts:478` *(enmienda, E5)* | ya añaden con el «+» por paso (`recipe-step-add-1`, `recipe-packing-step-add-0`); con P16 no cambian por eso |

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
- *Enmienda.* **A8 — Añadir `triggerDataAttributes` al `Pick` de `RowActionsSpec`** (lo que decía D2).
  Toca `data-table-types.ts`, compartido por todas las tablas, para algo que QC-262 y QC-263 ya
  resolvieron con un tipo local en su ruta (E4); dos formas de hacer lo mismo en `dev` serían peores.
- *Enmienda.* **A9 — Extender `ArrowLink` con `ariaLabel?`** para «Abrir la versión X» (paso 2 de la
  regla). Cambia una pieza compartida y su fila del catálogo por un nombre que el texto oculto ya da sin
  tocarla (E12).
- *Enmienda.* **A10 — Mantener «Añadir paso» al final de la lista** (R17 tal como se aprobó). Reabre
  QC-211 D14, posterior a la aprobación de esta ficha, y deja dos maneras de añadir (P16).

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
- *Enmienda (E20).* **Choque aceptado con QC-203** (Christian Quevedo, `in_progress`, «agrupar
  insumos homónimos por familia de unidad»): toca
  `app/(private)/produccion/formulas/importar/[documentoId]/components/{formula-import-review,formula-ingredient-row,formula-import-summary}.tsx`
  y `tests/unit/recetas-ui/formula-import-{page,review}.test.tsx`, los mismos que T7a. Carlos Restrepo
  lo aceptó el 2026-10-19 (`progress/features/QC-264.md > Decisiones`): **no se evita**. Quien mergee
  segundo resuelve en F2.3, conservando la conducta de QC-203 (lo que lee y agrupa cada fila) y el
  aspecto de esta ficha (tarjeta, número, «Referencia del PDF», quitar con icono). Para que el
  conflicto sea pequeño, T7a solo cambia marcado y clases de esos tres archivos: ni el estado
  (`IngredientRowState`), ni `toDraftLine`/`toConfirmLine`, ni `buildConfirmReasons`.
- *Enmienda (E11).* **Guardia de proveedores:** `tests/unit/proveedores/module-contract.test.ts:370-376`
  falla si cualquier archivo de `app/` fuera de `app/(private)/proveedores` contiene `/proveedores|supplier/i`
  (sin comentarios). Nada nuevo bajo `app/(private)/produccion/formulas/**` puede llevar esa palabra
  (texto, `data-testid`, nombre de variable). Los textos del globo de proveedor IA viven en
  `components/shared/ai-provider-required-tooltip.tsx:18-21`, fuera de `app/`.

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
  *Enmienda (E16):* con P17 por defecto no es nueva: se amplía D56 solo con el diálogo de propagar.
- *Enmienda (E17):* **Nueva si P18 se queda en su defecto:** tildes de «Lista de verificación»,
  «el máximo es», «Elemento de la lista de verificación» y de dos mensajes de `recipe-input.ts`.
- *Enmienda (E18):* **Nueva:** el «Volver a la lista» de «receta no encontrada»
  (`[id]/page.tsx:105-111`, `recipe-form.tsx:364-370`) y de las páginas de versión
  (`versiones/nueva/page.tsx:83`, `versiones/[versionId]/page.tsx:90`) sigue siendo enlace de texto, contra
  D2. Ningún requisito lo cubría y la enmienda no lo amplía.
- **D53** (esqueletos que no casan con las tarjetas) se amplía a `/produccion/formulas` si al medir el
  esqueleto de la tabla en tarjetas no coincide.
- **Nuevas si se confirman fuera:** espera por paso (P6), «Devolver» un quitado (P8), nombre del PDF
  en la revisión (P10).

## Dependencias de terceros

Ninguna nueva. `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` y `@tiptap/*` ya están
aprobadas (`docs/dependencias.md`, QC-26 y QC-64) y no cambian de archivo importador; `@base-ui/react`
(Dialog, AlertDialog, Tabs, Menu), `sonner`, `lucide-react`, `tw-animate-css` y `@tanstack/react-table`
ya están. *Enmienda:* la enmienda tampoco añade ninguna (`Switch` de Base UI ya lo trajo QC-214).

## 12. Enmienda contra dev (2026-10-19)

**Por qué.** El spec se escribió y aprobó el 2026-10-13. El 2026-10-19 la rama recibió `origin/dev`
(`6fcbafe6`, 577 commits): QC-211 D14, QC-214, QC-225, QC-262, QC-263, QC-271, QC-275, QC-277, QC-278,
QC-280 (su código ya está en `dev`), QC-166 y cambios directos a `dev`. **Regla:** en lo visual manda
el tablero (`docs/diseno/canvas/`); en columnas, datos y conducta, lo mergeado. No se cambia
conducta aprobada salvo que `dev` la haga imposible o la haya resuelto distinto; en ese caso queda una
pregunta nueva con su defecto (P16–P18, `requirements.md`).

**Cómo se leyó `dev`.** Sin shell ni git: se leyó el árbol del worktree tras el merge (código, tests,
guardias, tableros, `components/shared/CATALOGO.md`, `progress/impl_QC-*.md` y `feature_list.json`).
Los cambios directos a `dev` («usuario») se leyeron por su efecto en el árbol, no por commit. Las
citas son `archivo:línea` del árbol tras `6fcbafe6`.

| # | Qué decía el spec | Qué hay en `dev` (cita) | Qué cambia aquí | R / P / T |
| --- | --- | --- | --- | --- |
| E1 | R1/D1: «Subir PDFs» se pinta o no según `canUpload` | Tres estados: sin `canUpload` nada; con proveedor IA, `FormulaPdfUpload`; sin él, `FormulaPdfUpload disabled` dentro de `AiProviderRequiredTooltip` (`app/(private)/produccion/formulas/page.tsx:30-31, 49-55`; QC-275, QC-280; pieza en `CATALOGO.md:51`). Hoy «Nueva fórmula» va primero (`:41-55`) | R1 nombra los tres estados; D1 los conserva en `actions`; el orden lo pone el tablero («Subir PDFs» primero). El E2E nuevo mide el orden con el botón activo o deshabilitado (los dos llevan `document-upload-open`) | R1; T2a, T9a |
| E2 | R49: «mismos permisos de página» | La revisión corta además por añadido: `requirePageAddon('lectura_pdf')` (`importar/[documentoId]/page.tsx:83`), vigilado por `tests/guards/guard-pantallas-de-anadido.test.ts:37-41`. Con la lectura de PDF apagada (o con integraciones apagado, `ADDON_REQUIRES`), `documentos.*` sale del permiso efectivo y `canUploadDocuments` (`lib/modules/documentos/domain/actor.ts:98-105`) da `false`: no hay botón; la revisión responde 404 y las acciones de vista previa y confirmación rechazan con `unauthorized` (QC-277 R14, R15; `specs/QC-277-modulos-por-empresa/design.md:416-417, 451, 461-463`). Ya lo cubre `e2e/modulos-por-empresa.spec.ts` | R49 nombra el corte; D15 no mueve las tres primeras líneas. Ninguna pantalla de Fórmulas depende de otro añadido | R49; T7a |
| E3 | P15/T1a/D2: `separatorBefore` «si no está en `dev`» | Está: `components/shared/row-actions-menu.tsx:53-54, 82-85`, con `tests/unit/shared-ui/row-actions-menu-separator.test.tsx` (QC-262 D7) | P15 resuelta; T1a no aplica; `row-actions-menu.tsx`, sus tests y `catalogo-qc256.test.ts` salen de `Archivos esperados`; la fila de `RowActionsMenu` del catálogo no cambia | R3; T1a, T1d |
| E4 | D2: añadir `triggerDataAttributes` al `Pick` de `RowActionsSpec` | No está (`components/shared/data-table/data-table-types.ts:65`); QC-262 y QC-263 usan un tipo local y la propagación de `withMenu` (`actions-column.tsx:25-27`; `app/(private)/inventario/components/product-row-actions.tsx:39-41`, `app/(private)/pedidos/components/order-row-actions.tsx:195`) | `RecipeRowActionsSpec` en la ruta; `data-table-types.ts` no se toca (A8) | R3; T2b |
| E5 | R17/D8: «Añadir paso» discontinuo al final, con su `data-testid` de hoy (`recipe-step-add`) | QC-211 D14 (2026-10-16, `5f2cc171`, aprobado por el humano): sin botón final; «+» por paso (`recipe-steps-field.tsx:99, 433-444`), solo el del último con bloqueo (`:308`); lo afirman `tests/unit/recetas-ui/recipe-steps-field.test.tsx:97-106` y `recipe-form-packing-steps.test.tsx:238-245`; tablero enmendado `FormulaEvidenciaMovil.dc.html:30`. `recipe-step-add` ya no existe | P16 (defecto: sin botón final). R17 reescrito; la viñeta de D8 sustituida | R17; P16; T4a |
| E6 | R16/D8: quitar a la derecha de la tarjeta, en una tercera columna; dejaba de pintar el texto «Quitar» | Quitar y añadir ya son botones de icono `touch` (`recipe-steps-field.tsx:417-446`) que el editor pinta en su barra, a la derecha (`recipe-step-editor.tsx:197-217`), como dibuja `FormulaEvidencia*` | Tarjeta de dos columnas (asa + número / editor); los botones en la barra. R16 reescrito | R16; P16; T4a |
| E7 | «Lo que NO entra»: evidencia por paso (QC-214) «no se adelanta» | QC-214 está en `dev`: interruptor «Requiere evidencia» (`recipe-step-editor.tsx:47-48, 203-214`), resumen (`recipe-steps-field.tsx:103-110, 279-286`), borde del paso encendido (`:370-372`), bloqueo con nombres propios (`:111-114, 375-389, 424-427`), aviso del formulario (`recipe-form.tsx:128-133, 389-393`), `lockingOrders` (`[id]/page.tsx:90, 176`), marca en la versión (`recipe-version-form.tsx:69, 114-124`); tests `recipe-form-evidence-lock.test.tsx`, `recipe-version-form-evidence.test.tsx` | Se conserva todo dentro del rediseño. R16 (interruptor), R19 (nombre bloqueado), R51 (aviso y bloqueo) | R16, R19, R51; T3a, T4a, T6a |
| E8 | D9: `StepReader` con `mode` y un montador en la ruta | Ganó `initialStepPosition`, `onStepChange`, `renderStepAddon`, `stepBlockReason`, `stepRequest` (`components/shared/step-reader/step-reader.tsx:71-85, 243-244`); tres montadores (`tests/unit/recetas-ui/recipe-route-contract.test.ts:1313-1330, 1496-1520`) | `panel` pinta también `stepAddon` y el motivo extra; `ejecucion` (operario y empaque) no cambia | R22, R26; T1b |
| E9 | `Archivos esperados`: `recipe-image-field.tsx` | No existe: la imagen es `ImageField` compartido (`recipe-form.tsx:10, 421-429`) | Sale de `Archivos esperados`; D5 envuelve `ImageField` sin tocarlo | R11; T3a |
| E10 | D4: el diálogo y la fila sin más props | `DocumentUploadDialog` ganó `disabled` (`document-upload-dialog.tsx:29, 44`); la fila, el motivo del error (`document-upload-row.tsx:21, 74-78`). Tests nuevos: `document-upload-flow.test.tsx` (nombra `row-status`), `document-upload-errors.test.tsx`, `document-upload-strategy.test.tsx` | D4 los conserva; los tres tests entran en el censo y en `Archivos esperados` (solo si cambian) | R7–R9; T1c |
| E11 | — | `tests/unit/proveedores/module-contract.test.ts:370-376` prohíbe `/proveedores\|supplier/i` en `app/` fuera de `app/(private)/proveedores` | Restricción para todo archivo nuevo o tocado de la ruta (§ 9); la subida compartida está en `components/shared` y no le aplica | R48, R49 |
| E12 | D12: «Abrir» con `aria-label` | `ArrowLink` no tiene `aria-label` (`components/shared/arrow-link.tsx:11-23`) | Nombre accesible con `sr-only` dentro del enlace; la pieza no se toca (A9) | R30; T3c |
| E13 | D5: pestañas con contador, sin animación propia | `Tabs` ganó `TabsIndicator`, la pastilla que se desliza en 200 ms (`components/shared/CATALOGO.md:41`) | D5 la usa (paso 1), como pide `FormulaMovil` | R12; T3b |
| E14 | T0b: averiguar cómo poner un diálogo a pantalla completa | Precedente: `app/(private)/inventario/producto-terminado/[id]/components/batch-evidence-dialog.tsx:42` (QC-271) | D9 parte de esas clases; T0b solo mide | R23; T0b, T5a |
| E15 | «Lo que ya existe»: QC-262 y QC-263 «aprobados, sin implementar», specs en `.worktrees/` | En `dev` (`done`); specs en `specs/QC-262-rediseno-pedidos/` y `specs/QC-263-rediseno-inventario/`; patrón «menú como datos + envoltorio» en `product-row-actions.tsx:51-122` | Citas corregidas; D2 sigue ese patrón | R3–R5 |
| E16 | P14: icono de los diálogos fuera porque `ConfirmDialog` no lo tiene | Lo tiene: `icon` (`components/shared/confirm-dialog.tsx:80-91, 182`; `CATALOGO.md:56`), usado en `app/(private)/maestro/empresas/components/company-delete-dialog.tsx:134`; D56 «en parte resuelta» (`progress/deudas.md:447-450`). `DeleteRecipeDialog` usa `DeleteConfirmDialog` (`delete-recipe-dialog.tsx:119`), que reenvía las props (`delete-confirm-dialog.tsx:40-41`); propagar es un `AlertDialog` propio (`propagate-versions-dialog.tsx:66-70`) | P17 (defecto: icono en los dos borrados). R50 y D17 nuevos | R50; P17; T2c |
| E17 | D9 censado: «la única forma sin tilde de la ruta es la descripción de la vista previa» | Quedan «Lista de verificacion» (`recipe-step-editor.tsx:45`), «el maximo es» (`:50`), «Elemento de la lista de verificacion» (`recipe-step-schema.ts:65`) y dos del módulo (`lib/modules/recetas/domain/recipe-input.ts:108, 196`) | P18 (defecto: fuera, deuda). R45 y la guardia D16 no cambian | R45; P18; T9c |
| E18 | — | «Volver a la lista» de «no encontrada» sigue como enlace de texto (`[id]/page.tsx:105-111`, `recipe-form.tsx:364-370`) | Fuera del alcance aprobado; se anota en § 11 | — |
| E19 | § 7: censo del 2026-10-13 | Tests y E2E de `dev` que nombran lo que esta ficha toca: `recipe-form-evidence-lock`, `recipe-version-form-evidence`, `recipe-form-mensajes-zod`, `navegacion/pantallas-exigen-permiso`, `shared/ai-provider-required-tooltip`, `guard-pantallas-de-anadido`; `e2e/integraciones-proveedor-ia.spec.ts:70-71, 226, 324, 358`, `e2e/modulos-por-empresa.spec.ts:49-50, 195, 249, 260`, `e2e/ejecucion-receta.spec.ts` | § 7 ampliado; T0a los incluye | R49; T0a, T9b |
| E20 | — | Choque aceptado con QC-203 (Christian, `in_progress`) en los tres componentes de la revisión y sus dos tests (`progress/features/QC-264.md:22-25`) | Riesgo en § 9; T7a no toca estado ni reglas de esos archivos | R37–R43; T7a |
| E21 | D6: la edición pasa `aside` | La edición hace seis lecturas (`[id]/page.tsx:75-91`) y pasa `lockingOrders`; `PropagateVersionsDialog` vive dentro del `<form>` (`recipe-form.tsx:576-589`) | Se conservan; D6 solo añade `aside` | R13, R51; T3a |
| E22 | Comprobado sin cambios | `DataTableCardLayout` con `primary/status/title/meta/footer` y textos `cardActions`/`closeMenu` (`data-table-types.ts:112-118, 182-185`); `StatusTone` con `progress` y `waiting` (`lib/shared/ui/status-tone.ts:1`); `PageHeader` con `title`, `titleTestId`, `actions` (`page-header.tsx:11-13`); `Notice` con `tone`, `id`, `testId` (`notice.tsx:13-18`); `badges-estado.test.tsx:194, 226` sigue en `info` (enmienda P12 vigente); `tablas-marca.test.tsx:254` llama `buildRecipeColumns({ rowActions })` (pasa a `menu`, ya en § 7); QC-225, QC-263, QC-278 y QC-166 no tocan la ruta | Sin cambio | — |

**Requisitos antes de la enmienda** (para el reviewer):

- R1 no nombraba el estado deshabilitado con globo ni el añadido.
- R16 decía: «Cada paso DEBE pintarse como tarjeta con el asa de arrastre y, debajo, el número del paso
  a la izquierda; el editor con su barra de formato (Negrilla, Cursiva, Lista de verificación) encima
  del área editable en el centro; y a la derecha el botón de quitar con icono y nombre accesible
  «Quitar paso N». Cada control DEBE medir al menos 44 × 44 px y los `data-testid` DEBEN ser los de
  hoy.»
- R17 decía: «"Añadir paso" y "Añadir paso de envasado" DEBEN pintarse al final de su lista, a todo el
  ancho y con borde discontinuo, con sus `data-testid` de hoy.»
- R19 no nombraba el nombre del asa bloqueada.
- R49 no nombraba el corte por añadido.
- R50 y R51 son nuevos.
