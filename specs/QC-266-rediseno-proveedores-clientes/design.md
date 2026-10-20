# QC-266 — rediseno-proveedores-clientes · design.md

> **Enmienda contra dev (2026-10-19)** (§ 12, E1–E18). Las secciones de abajo se escribieron el
> 2026-10-13; donde `dev` las cambia llevan una nota *Enmienda En* y la tabla del § 12 manda.

## Lo que ya existe

**Términos buscados.** En el board (`feature_list.json`, todos los estados): «proveedor», «cliente»,
«catálogo», «vitrina», «importación», «rediseño», «toast». En `specs/` y `progress/`: `QC-266`,
`SupplierShowcase`, `CatalogImport`, `CustomerTable`, `separatorBefore`, `DocumentUploadDialog`,
«tarjetas», `D48`, `D53`. En el código (grafo `codebase-memory-mcp` del worktree, que respondió; Grep
para tests, e2e y textos): `SupplierShowcaseRow`, `ShowcaseLineCard`, `SupplierDetailHeader`,
`CatalogLineRowActions`, `CatalogImportRow`, `KIND_LABELS`, `CustomerRowActions`, `SupplierSheet`,
`useEntitySheet`, `toast.success` en las dos rutas, `RowActionsSpec`, `DataTableCardLayout`,
`PageHeader`, textos sin tilde en las rutas.

| Qué apareció | Dónde | Qué se hace |
| --- | --- | --- |
| QC-140, QC-43, QC-155, QC-158 (`done`): la vitrina, el detalle, Clientes y la revisión ya existen con su comportamiento | `app/(private)/proveedores/**`, `app/(private)/clientes/**` | Es un cambio visual sobre ellas; nada se re-crea |
| Los nueve toasts del tablero ya existen con su texto exacto (incluidos «Proveedor creado.» y «Proveedor actualizado.», que el tablero marca «[por confirmar]») | `components/shared/supplier/supplier-sheet.tsx`, `delete-supplier-dialog.tsx`, `catalog-line-sheet.tsx`, `delete-catalog-line-dialog.tsx`, `customer-sheet.tsx`, `delete-customer-dialog.tsx` (vía `useEntitySheet` o `toast.success`) | No se añade ninguno; un test los fija (D10, P13). Solo «Cliente creado.» tenía test |
| QC-256 (`done`): `PageShell`, `PageHeader`, `StatusBadge`, `Notice`, `ArrowLink`, `RowActionsMenu` centrado, `DataTable` con `card` y `actionsColumn({ menu })` | `components/shared/` | Se reutilizan |
| QC-257 (`done`): cabecera, menú lateral, `ThemeToggle` | `app/(private)/layout.tsx` | Nada que hacer |
| QC-262 (*enmienda E5:* `done`, en `dev`): `separatorBefore` en `RowActionMenuItem` y el patrón «menú como datos + un anfitrión por tabla» | `specs/QC-262-rediseno-pedidos/design.md > D5, D7`; `components/shared/row-actions-menu.tsx:53-54, 83-85` | Se usa su contrato tal cual (R38, P1 resuelta, E3) y su patrón (D6, D9) |
| QC-264 (*enmienda E5, E18:* `done`, en `dev`): restiló `components/shared/document-upload/` (tonos, `disabled`) | `specs/QC-264-rediseno-formulas/design.md > D4, § 6, § 12`; `components/shared/CATALOGO.md:69` | No se duplica: aquí solo se mueve el disparador (R19, D5) |
| QC-263 y QC-264: `RowActionsSpec` no lleva `triggerDataAttributes` | `components/shared/data-table/data-table-types.ts:65` | *Enmienda E4:* sigue sin llevarlo; se usa un tipo local en la ruta (D6), como QC-262, QC-263 y QC-264 |
| QC-263: tarjeta con `primary` = columna de imagen | `specs/QC-263-rediseno-inventario/design.md` | Mismo criterio en el catálogo (D7) |
| QC-265 (`done`): menú ⋯, tarjetas y altas en las listas cerradas; D53 (esqueletos sin tarjeta) | `specs/QC-265-rediseno-operario/`, `progress/deudas.md > D53` | Se imita; D53 se amplía (§ 11) |
| D48: `editCustomerLabel`, `deleteCustomerLabel` exportadas sin consumidor por QC-232 R5 | `progress/deudas.md > D48` | Se conservan (R41) |
| `guard-piezas-base > CONSTANTES_QUE_NO_SON_EL_PAR` nombra `TOUCH_TARGET` de `supplier-showcase-filters.tsx` | `tests/guards/guard-piezas-base.test.ts:242` (*enmienda E15*; `:678` exige además que `supplier-showcase-skeleton.tsx` exista) | Si la constante desaparece, su fila sale en el mismo commit (D1); el esqueleto se restila, no se borra |
| `guard-convenciones-showcase` (QC-140 R18, D8): `react-intersection-observer` solo en `showcase-load-trigger.tsx`, ningún `IntersectionObserver` ni `scroll` a mano | `tests/unit/proveedores-ui/guard-convenciones-showcase.test.ts` | El «Cargar más» visible llama a la misma `loadMore`; el centinela no cambia (D2) |
| Textos visibles sin tilde en las dos rutas | Grep | Ninguno: D9 no aplica |
| QC-236, QC-239 (`pending`) tocan clientes; QC-139 (`pending`) proveedores de lo que falta. *Enmienda E10:* QC-244 ya está en `dev` (`/clientes/contactos`, grupo «Clientes» en el menú) | `feature_list.json`; `progress/features/QC-244.md` | No se solapan con esta ficha; riesgo de choque en § 9 |
| *Enmienda (E1, E7, E8, E9):* piezas que trajo `dev` | `AiProviderRequiredTooltip` (`CATALOGO.md:51`), `ConfirmDialog` con `icon` (`:57`), `cardFieldLabel`/`withCardFieldLabel` (`:55`), `ArrowLink` con `disabled` (`:52`), `FormFooterBar` (solo en `app/(private)/produccion/formulas/components/form-footer-bar.tsx`) | Se reutilizan las tres primeras (paso 1); `FormFooterBar` no (§ 12, E9) |

**Filas de `components/shared/CATALOGO.md` consultadas y paso de la regla de decisión**
(`docs/perfil-agentes.md > Regla de decisión para componentes`):

| Pieza | Filas consultadas | Paso | Por qué no bastaba el anterior | Tablero |
| --- | --- | --- | --- | --- |
| Contenedor, título y acciones | `PageShell`, `PageHeader` | 1 · reutiliza | — | `Superficies.dc.html`, `Proveedores.dc.html`, `ProveedorDetalle.dc.html`, `ProveedorImportar.dc.html`, `Clientes.dc.html` |
| «Ver ficha», «Volver…» | `ArrowLink` | 1 · reutiliza | — | `Botones.dc.html` |
| Vacíos de la vitrina y de Clientes | `EmptyState` (`icon`) | 1 · reutiliza | — | `Proveedores.dc.html`, `Clientes.dc.html` |
| Tarjeta de proveedor y de producto | `Card`, `EntityImage` (`fill`), `Tooltip`, `Button` | 1 · reutiliza (la fila de la ruta se restila) | — | `Proveedores.dc.html`, `ProveedoresMovil.dc.html` |
| Estado de la fila de la importación | `StatusBadge`, `STATUS_TONES` | 1 · reutiliza | — | `Estados.dc.html`, `ProveedorImportar.dc.html` |
| Aviso de arrastre del catálogo | `Notice` (`warning`), `ConfirmDialog` (`aside`) | 1 · reutiliza | — | `ModalesProveedores.dc.html`, `Avisos.dc.html` |
| Menú ⋯ y tarjetas | `RowActionsMenu`, `DataTable` (`card`, `actionsColumn({ menu })`) | 1 · reutiliza | — | `Tabla.dc.html` |
| Separador del menú | `RowActionsMenu` | *Enmienda E3:* 1 · reutiliza (`separatorBefore` ya está en `dev`) | — | `Tabla.dc.html` |
| *Enmienda E1:* «Subir PDFs» deshabilitado sin proveedor IA | `AiProviderRequiredTooltip` | 1 · reutiliza (la página ya lo monta hoy) | — | `ProveedorIA.dc.html` |
| *Enmienda E7:* icono de los tres diálogos de baja | `ConfirmDialog` (`icon`), `DeleteConfirmDialog` | 1 · reutiliza (P16) | — | `ModalesProveedores.dc.html` |
| *Enmienda E8:* rótulos de cifras en las tarjetas | `cardFieldLabel`, `withCardFieldLabel` | 1 · reutiliza (P17) | — | `InventarioColumnasLotes.dc.html`, `Formulas.dc.html` |
| Disparador «Editar» del proveedor | `SupplierSheet` | 2 · cambio visual del disparador de edición (solo lo usan las rutas de esta ficha) | Hoy es un lápiz sin texto en `ghost` | `ProveedorDetalle.dc.html` |
| Paneles, diálogos, toasts | `FormSheet`, `Sheet`, `ConfirmDialog`, `DeleteConfirmDialog`, `Dialog`, `Toaster`, `useEntitySheet` | 1 · reutiliza | — | `ModalesProveedores.dc.html` |
| Subida de PDF | `DocumentUploadDialog` | 1 · reutiliza (el restilado es de QC-264) | — | `ModalesProveedores.dc.html`, `ModalesProduccion.dc.html` |

No se crea ningún componente compartido. Los anfitriones de paneles por tabla (D6, D9) son
subcomponentes internos de la ruta que solo componen piezas ya catalogadas y no pintan UI visible
nueva (excepción del pase `/design`).

## 1. Principio

Cambio visual con tablero aprobado (D14). El comportamiento no cambia: mismas Server Actions, mismos
campos, mismos permisos de página, mismas direcciones, misma carga perezosa, mismas reglas de la
revisión (R41). Lo único que cambia por dentro es **dónde viven el panel de edición y el diálogo de
baja** de las filas del catálogo y de Clientes (D6, D9): con tarjetas, cada fila se pinta dos veces y el
menú de la tarjeta sale de `column.menu`, no de la celda.

## 2. Modelo de datos

No aplica: sin tablas, sin RLS, sin migraciones, sin cambios en `lib/modules/`. Ningún contrato de
módulo cambia (P2 y P10 lo dejan fuera a propósito).

## 3. Rutas

Ninguna ruta nueva ni distinta. `/proveedores`, `/proveedores/[id]`,
`/proveedores/[id]/importar/[documentoId]` y `/clientes` siguen en sus `page.tsx`, con su
`requirePagePermission` en la primera línea y sus direcciones de `lib/shared/routes.ts`.

## 4. Decisiones

**D1 — Vitrina: cabecera y barra (R1, R2).** `proveedores/page.tsx` pinta `PageShell` > `PageHeader`
(`title={SUPPLIERS_LABEL}`, `titleTestId="proveedores-title"`, `actions={<SupplierSheet />}`); los
filtros y el `Suspense` quedan dentro de `PageShell` como hoy. `supplier-showcase-filters.tsx`:
contenedor `role="toolbar"` con `aria-label="Filtros de proveedores"`; cada `<label>` pasa a `sr-only`
con el mismo texto y `htmlFor` (el nombre accesible no cambia, P15); `SearchIcon` absoluto dentro del
campo; «Limpiar filtros» `ghost` con `XIcon`; `@max-[760px]:` apila a todo el ancho. Mismos `data-testid`
y `SHOWCASE_FILTERS_TEXTS`. Si `TOUCH_TARGET` desaparece del archivo, su fila de
`CONSTANTES_QUE_NO_SON_EL_PAR` (`guard-piezas-base`) sale en el mismo commit.

**D2 — Vitrina: tarjetas, carga y vacíos (R3–R5, R7–R10).**

- `supplier-showcase-row.tsx`: el `<li>` envuelve un `<article aria-labelledby={h2Id}>` con las clases
  de tarjeta (`rounded-xl border bg-card`, 18/20 px). Cabecera: `h2` con el nombre y debajo la cuenta
  (`showcaseCountLabel(lines.length, hasMoreLines)`, función pura nueva en
  `supplier-showcase-params.ts`: «1 producto», «N productos», sufijo «+» con `hasMoreLines`, cadena
  vacía con 0; P3); a la derecha `ArrowLink direction="forward" variant="outline" size="sm"` con
  «Ver ficha del proveedor», `testId="supplier-detail-link"` y `aria-label="Ver ficha del proveedor
  <nombre>"` (contiene el texto visible). Con `@max-[760px]:` el botón pasa debajo a todo el ancho y
  44 px. El `Link` del nombre desaparece. *Enmienda E6:* `ArrowLink` no acepta `aria-label`
  (`components/shared/arrow-link.tsx:11-23`); el nombre accesible sale de un
  `<span className="sr-only"> <nombre></span>` dentro de sus `children`, como QC-264 E12. La pieza no
  se toca.
- Tira: el `<ul>` de hoy (`overflow-x-auto snap-x snap-mandatory`, `tabIndex={0}`, la `section
  aria-label="Productos de <nombre>"`). «Cargar más» pasa a ser el último `<li>` de la tira: `Button
  variant="outline" touch` con `PlusIcon`, envuelto en `Tooltip` cuyo contenido es su
  `aria-label` (el tooltip repite, no sustituye: R6, QC-140 R48). El aviso de fallo sigue debajo.
- Sin productos: panel con `PackageIcon` y «Sin productos todavía.», sin el enlace de hoy.
- `supplier-showcase-list.tsx`: el `<ul>` pasa a columna con 16 px entre tarjetas; mientras
  `hasMore && !failed` se pintan **el centinela de hoy y** un `Button variant="outline" touch` «Cargar
  más» (`ChevronDownIcon`, `data-testid="supplier-showcase-list-load-more"`) que llama a la misma
  `loadMore` (su `inFlight` ya impide dos vuelos; P4); mientras `loading`, una tarjeta esqueleto con
  `aria-busy="true"` y `aria-label="Cargando más proveedores"`; el fallo pasa a caja `role="alert"` con
  icono, el texto de hoy y «Reintentar» (`supplier-showcase-list-retry`). `showcase-load-trigger.tsx`
  no se toca.
- `supplier-showcase-skeleton.tsx`: el esqueleto inicial pasa a tarjetas (título y cuatro huecos de
  156 px).
- `supplier-showcase-section.tsx`: vacío con `EmptyState icon` (`TruckIcon`) y su `SupplierSheet`; «sin
  coincidencias» pasa a `EmptyState` con `SearchIcon` y su enlace «Limpiar filtros» con forma de botón
  (`supplier-showcase-no-results`, `supplier-showcase-clear-filters`).

**D3 — Tarjeta de producto y hover (R5, R6).** `showcase-line-card.tsx`: `<li>` de 156 px
(`w-39 shrink-0 snap-start`), `flex-col gap-2 p-2 rounded-xl border border-transparent
transition-[border-color,box-shadow] duration-200 hover:border-border hover:shadow-md`;
`EntityImage size="fill"` y el nombre en 13 px `font-medium line-clamp-2`. En Tailwind 4 la variante
`hover:` solo aplica con `@media (hover: hover)`, así que en táctil no hay estado pegado; nada se
muestra u oculta con él. Mismo `data-testid`.

**D4 — Detalle: vuelta, cabecera, vacío y no encontrado (R11–R13, R17, R18).**

- `proveedores/[id]/page.tsx`: `PageShell` con, en orden, `ArrowLink direction="back"` «Volver a
  proveedores» (`href={SUPPLIERS_ROUTE}`, `testId="supplier-detail-back-link"`), `SupplierDetailHeader`
  y el `Suspense` del catálogo. Los estados de error y de no encontrado van también dentro de
  `PageShell`.
- `supplier-detail-header.tsx`: `PageHeader` con `title={supplier.name}`,
  `titleTestId="supplier-detail-name"` y `actions` = `SupplierSheet supplier` (D10), `DeleteSupplierDialog`,
  `CatalogPdfUpload` (solo si `canUpload`, que baja por props desde la página) y `CatalogLineSheet`
  (alta). Justo debajo, el `<dl>` de contacto (fuera de `PageHeader`, que no tiene ranura de
  descripción: § 8 A6) con `PhoneIcon` y `MailIcon` y los `data-testid` de hoy; `@max-[760px]:` lo
  apila. La cabecera conserva `data-testid="supplier-detail"`. El `div justify-end` de la subida y el
  `CatalogLineSheet` de encima de la tabla desaparecen de `page.tsx` y `catalog-list-section.tsx`.
  *Enmienda E1:* la subida tiene tres estados en `dev` (`[id]/page.tsx:101, 126-141`). La página
  sigue calculando `canUpload` y, solo con él, `getAiProviderReadinessAction()`, y baja a la cabecera
  la prop `upload: ReactNode | null` ya armada (`CatalogPdfUpload`, o `CatalogPdfUpload disabled`
  dentro de `AiProviderRequiredTooltip`, o `null`). `SupplierDetailHeader` recibe `supplier`, `units`
  y `upload`, y no lee la sesión ni llama a ninguna action (sigue sin `'use client'`).
- *Enmienda E7 (P16):* `delete-supplier-dialog.tsx` pasa además
  `icon={{ glyph: CircleSlashIcon, tone: 'danger', testId: 'delete-supplier-icon' }}`;
  `delete-catalog-line-dialog.tsx` lo mismo con `testId: 'delete-catalog-line-icon'`. Precedente:
  `app/(private)/produccion/formulas/components/delete-recipe-dialog.tsx:173`.
- `delete-supplier-dialog.tsx`: el disparador pasa a `variant="outline"` con `CircleSlashIcon`, el texto
  «Dar de baja», clase de color de peligro y el `aria-label` y `data-testid` de hoy; el `aside` pasa a
  `<Notice tone="warning" testId="delete-supplier-cascade">` con el texto de hoy.
- `catalog-table.tsx`: el vacío deja de pasar `children` con `CatalogLineSheet` (P5).
- `supplier-not-found.tsx`: recuadro `role="alert"` con icono, el texto de hoy y `ArrowLink
  direction="back"` «Volver a la lista de proveedores» (`testId="supplier-not-found-link"`).

**D5 — «Subir PDFs» (R19).** `CatalogPdfUpload` no cambia: solo se monta dentro de las acciones de la
cabecera. Ningún archivo de `components/shared/document-upload/` está en `## Archivos esperados`. Si
QC-264 ya está en `dev`, el disparador y el diálogo llegan restilados; si no, siguen como hoy.
*Enmienda E1, E18:* QC-264 está en `dev`: llegan restilados. El estado deshabilitado conserva el
globo de QC-275 y su `document-upload-open`; `ai-provider-required-tooltip.tsx` tampoco se toca.

**D6 — Catálogo: menú como datos y un anfitrión por tabla (R14, R16).** Patrón de QC-262 D5:

- `catalog-line-row-actions.tsx` gana
  ```ts
  export type CatalogLineAction = 'edit' | 'delete';
  export function catalogLineRowActionsSpec(
    line: CatalogLineListItem,
    onAction: (action: CatalogLineAction, line: CatalogLineListItem) => void,
  ): RowActionsSpec;
  ```
  con «Editar» y «Dar de baja» (`separatorBefore: true`, `destructive: true`), los `testId` y el
  `triggerLabel` de hoy, `triggerTestId=CATALOG_LINE_ROW_ACTIONS_TESTID` y `title=line.name`.
  `CatalogLineRowActions` **conserva su nombre** y pasa a anfitrión: recibe `supplierId`, `units`,
  `line`, `action`, `open`, `onOpenChange` y monta el `CatalogLineSheet` controlado o el
  `DeleteCatalogLineDialog` de esa línea. Los exports de constantes del barrel se conservan (D49).
- `catalog-columns.tsx`: `CatalogColumnsDeps.rowActions` pasa a `onAction`; la columna se declara con
  `actionsColumn({ id: ACTIONS_COLUMN_ID, menu: (line) => catalogLineRowActionsSpec(line, onAction) })`.
- `catalog-table.tsx` guarda `active: { line, action, open } | null` y monta **una vez**
  `CatalogLineRowActions` para la línea activa; al cerrar deja `open: false` sin soltar la línea para
  que el panel o el diálogo animen su salida.
- `data-catalog-line-id` en el disparador de la fila: si `RowActionsSpec` sigue sin
  `triggerDataAttributes` cuando se implemente, se añade a su `Pick` en
  `components/shared/data-table/data-table-types.ts` (mismo cambio que QC-263 y QC-264 declaran «solo
  si falta»; el primero que llegue lo hace).
  *Enmienda E4:* sustituido. Ninguna de las tres lo añadió: cada una declaró un tipo local y
  `actionsColumn` lo propaga a `RowActionsMenu` en la fila y en la tarjeta
  (`components/shared/data-table/actions-column.tsx:27-28`). Aquí igual:
  `export type CatalogLineRowActionsSpec = RowActionsSpec & Pick<RowActionsMenuProps, 'triggerDataAttributes'>`
  en `catalog-line-row-actions.tsx`, y `catalogLineRowActionsSpec` lo devuelve con
  `triggerDataAttributes: { 'data-catalog-line-id': line.id }` (precedentes:
  `app/(private)/inventario/components/product-row-actions.tsx:41-43, 127`,
  `app/(private)/produccion/formulas/components/recipe-row-actions.tsx:36, 70`). `data-table-types.ts` no
  se toca (además lo vigila `tests/unit/clientes-ui/data-table-intacta-clientes.test.ts:163-203`).
- *Enmienda E5:* el anfitrión único sigue el de Fórmulas (`recipe-table.tsx:166-174, 258-262`:
  `active` con `open`, un solo montaje, `open: false` sin soltar la fila). El nombre `onAction` de las
  deps tiene precedente en `app/(private)/maestro/empresas/components/company-columns.tsx:37-40`.

**D7 — Catálogo en tarjetas (R15).** `CatalogTable` pasa a `DataTable`
`card={{ primary: IMAGE_COLUMN_ID, status: 'cost', title: 'name', meta: ['presentationId', 'unitId',
'minPurchase', 'deliveryTime', 'material', 'measurements'], footer: 'updatedAt' }}` (precedente de
QC-263) y `CATALOG_TABLE_TEXTS` gana `cardActions: 'Acciones'` y `closeMenu: 'Cerrar'`. El umbral es el
de `DataTable` (P8).
*Enmienda E8 (P17):* en `catalog-columns.tsx` las celdas de `minPurchase`, `deliveryTime` y
`updatedAt` pasan por `withCardFieldLabel(<encabezado de la columna>, <celda de hoy>)`; `withCardFieldLabel`
deja sin rótulo una celda `null`, así que la marca de vacío sale sola. En la tabla el rótulo está
oculto (`data-card-label`), así que el texto de la celda no cambia. Las doce columnas de `dev`
(incluida «Creado», que no sale en la tarjeta) no cambian.

**D8 — Revisión del catálogo (R20–R27).**

- `importar/[documentoId]/page.tsx`: `PageShell` con `ArrowLink direction="back"` «Volver al detalle del
  proveedor» (`href={supplierDetailRoute(id)}`, `testId="catalog-import-back-link"`), `PageHeader`
  (`breadcrumb={{ label: 'Ruta', items: [{ label: supplier.name, href: supplierDetailRoute(id) },
  { label: 'Revisar importación' }] }}`, `title` y `titleTestId` de hoy) y debajo
  `<p>{preview.rows.length} filas leídas</p>` (`catalog-import-rows-read`; «1 fila leída» en
  singular). Los tres estados de error siguen como hoy, dentro de `PageShell` (P10).
- `catalog-import-row.tsx`: `KIND_LABELS` se conserva y nace a su lado
  `export const KIND_TONES: Record<RowFormState['kind'], StatusTone>` con los cinco tonos del R22 (único
  mapa, P12). Cabecera de la tarjeta en una línea que se parte: `Checkbox` de 44 px con
  `aria-label="Incluir fila N"` y su `data-testid` (sin la etiqueta visible «Incluir»), `h2` «Fila N»,
  `StatusBadge tone={KIND_TONES[kind]} label={KIND_LABELS[kind]}
  data-testid="catalog-import-row-kind-<i>" data-kind={kind}`, hueco, `EntityImage`, `CropPicker` y
  «Quitar». La `Card` lleva `opacity-60 transition-opacity` mientras `!included` (R23). Los campos van
  en `grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3`; diámetro y alto, valor y unidad en
  una rejilla `1fr 76px`. «Costo actual» / «Costo nuevo» siguen como hoy (P9). `role="alert"` de
  «Revisa: …» sin cambio.
- `crop-picker.tsx`: el disparador dice «Elige una imagen del archivo» con `ImageIcon` (P11); el
  diálogo gana la descripción «Fila N» (prop `rowNumber`), cada recorte su `aria-label="Recorte del
  archivo N"` y su pie de texto, el elegido con anillo `ring-2 ring-primary`, y «Cancelar» en el pie.
- `new-presentation-units.tsx`: `Card` con el `h2` de hoy; los selectores en `grid-cols-2` que pasa a
  una columna `@max-[760px]:`.
- `catalog-import-review.tsx`: la confirmación pasa a una `Card` `sticky bottom-0` con los motivos de
  bloqueo y el `ErrorAlert` encima del botón; «Confirmar» con `Spinner` delante mientras
  `isConfirming` (R25). Reglas, envío y reclasificación sin cambios. *Enmienda E9:* no se usa
  `FormFooterBar` de Fórmulas: el tablero (`ProveedorImportar.dc.html:73`) dibuja una tarjeta
  `sticky; bottom: 0`, no la barra de borde a borde, y la pieza vive en otra ruta.
- *Enmienda E2:* las tres primeras líneas de `importar/[documentoId]/page.tsx` (`:66-68`, dos
  permisos y `requirePageAddon('lectura_pdf')`) no se mueven; las vigila
  `tests/guards/guard-pantallas-de-anadido.test.ts:40`.
- `catalog-import-summary.tsx`: `Card` `role="status"` con `CircleCheckIcon` en tono éxito, el texto de
  hoy, el `<dl>` en cuatro columnas que pasan a una `@max-[760px]:`, y `ArrowLink direction="back"`
  con el `testId` de hoy.

**D9 — Clientes (R28–R33).**

- `clientes/page.tsx`: `PageShell` > `PageHeader` (`title={CUSTOMERS_LABEL}`,
  `titleTestId={CUSTOMERS_TITLE_TESTID}`, `actions={canModify ? <CustomerSheet /> : undefined}`).
- `customer-table.tsx`: deja de pasar `toolbarActions`; el vacío sigue con su `CustomerSheet` si hay
  permiso (P6) y gana `icon` (`ContactIcon`); `card={{ primary: 'lastNames', status: 'city', title:
  'firstNames', meta: ['phone', 'email', 'address'], footer: 'createdAt' }}` (P7); textos `cardActions`,
  `closeMenu` en `CUSTOMER_TABLE_TEXTS`; guarda el cliente activo y monta **una vez**
  `CustomerRowActions` como anfitrión (mismo patrón que D6).
- `customer-row-actions.tsx`: `customerRowActionsSpec(customer, canModify, onAction)` con «Editar» y
  «Eliminar» (`separatorBefore`, `destructive`), `title` = nombre completo e `items: []` sin permiso
  (`DataTableCards` no pinta «Acciones» sin ítems y `RowActionsMenu` no pinta nada). `CustomerRowActions`
  conserva su nombre como anfitrión (`customer`, `action`, `open`, `onOpenChange`). `editCustomerLabel`
  y `deleteCustomerLabel` siguen exportadas (D48).
- `customer-columns.tsx`: `actionsColumn({ menu })` con `onAction` y `canModify` en sus deps;
  `CUSTOMER_SKELETON_COLUMN_COUNT` no cambia (9).
- *Enmienda E4, E7, E8:* `CustomerRowActionsSpec` local, igual que el del catálogo, con
  `triggerDataAttributes: { 'data-customer-id': customer.id }`; `delete-customer-dialog.tsx` pasa a
  `DeleteConfirmDialogBody` `icon={{ glyph: Trash2Icon, tone: 'danger', testId: 'delete-customer-icon' }}`
  (P16; la prop está en `ConfirmDialogBodyBaseProps`, `confirm-dialog.tsx:182`); la celda de
  `createdAt` pasa por `withCardFieldLabel('Fecha de alta', …)` (P17).

**D10 — `SupplierSheet` (R39).** En edición el disparador pasa de `ghost` con lápiz solo a
`variant="outline" touch` con `PencilIcon` y el texto «Editar»; `aria-label` «Editar <nombre>» y
`data-testid` de hoy. El alta no cambia. Fila de `CATALOGO.md`: `Diseño` gana
`docs/diseno/canvas/ProveedorDetalle.dc.html`.

**D11 — Modales en teléfono (R34, R35).** `ConfirmDialog` y `Dialog` ya centran con `max-h-[90dvh]`;
`FormSheet` ya respeta el margen inferior seguro. La tanda 0 mide a 390 × 844 los tres paneles y los
cuatro diálogos; solo si algo no cabe se ajusta la clase en la ruta (`max-sm:w-full` en el panel, como
QC-262 D8). Ningún texto cambia.

**D12 — Toasts (R36, R37).** Sin cambio de producción. Dos tests nuevos con `sonner` simulado recorren
cada éxito (un único `toast.success` con su texto) y cada fallo (ninguno):
`tests/unit/proveedores-ui/proveedores-toasts.test.tsx` y `tests/unit/clientes-ui/clientes-toasts.test.tsx`.
El de proveedores comprueba además que confirmar una importación no lanza ninguno.

**D13 — Guardia (R43).** `tests/guards/guard-proveedores-clientes-rediseno.test.ts`: en los archivos de
producción de las dos rutas, todo `<Link` lleva `buttonVariants` o es `ArrowLink`; ninguno importa
`@/components/ui/badge`; fuera de `catalog-import-row.tsx` no hay un objeto con las cinco claves de
clase de fila (`nueva`, `cambia`, `sin cambios`, `incompleta`, `duplicada`) cuyos valores sean tonos.
Lleva un caso con fuente fabricada que demuestra que muerde.

## 5. Contratos que cambian

| Símbolo | Antes | Después |
| --- | --- | --- |
| `showcaseCountLabel` | — | nuevo en `supplier-showcase-params.ts` |
| `CatalogColumnsDeps` | `rowActions: (line) => ReactNode` | `onAction: (action, line) => void` |
| `catalogLineRowActionsSpec`, `CatalogLineAction` | — | nuevos |
| `CatalogLineRowActions` | menú + panel + diálogo por fila | anfitrión de la línea activa |
| `CustomerColumnsDeps` | `rowActions` | `onAction`, `canModify` |
| `customerRowActionsSpec`, `CustomerAction` | — | nuevos |
| `CustomerRowActions` | menú + panel + diálogo por fila | anfitrión del cliente activo |
| `CustomerTable` | `toolbarActions` con el alta | sin `toolbarActions`; `card` y cliente activo |
| `CatalogTable` | `children` del vacío con el alta | sin él; `card` y línea activa |
| `KIND_TONES` | — | nuevo en `catalog-import-row.tsx` |
| `CropPicker` | `triggerTestId` | + `rowNumber` |
| `SupplierDetailHeader` | `supplier` | + `units` y `upload: ReactNode \| null` (*enmienda E1*: sustituye a `canUpload`) |
| `SupplierSheet` (edición) | `ghost`, solo lápiz | `outline`, lápiz y «Editar» |
| `RowActionMenuItem` | — | *Enmienda E3:* no cambia (`separatorBefore?` ya está en `dev`) |
| `RowActionsSpec` | sin `triggerDataAttributes` | *Enmienda E4:* no cambia |
| `CatalogLineRowActionsSpec`, `CustomerRowActionsSpec` | — | *Enmienda E4:* nuevos, locales a su ruta (`RowActionsSpec & Pick<RowActionsMenuProps, 'triggerDataAttributes'>`) |
| `DeleteSupplierDialog`, `DeleteCatalogLineDialog`, `DeleteCustomerDialog` | sin icono | *Enmienda E7 (P16):* `icon` de peligro; props públicas sin cambio |

## 6. Snapshots y árboles que cambian (aceptados)

Toda diferencia de paridad que no esté aquí es un fallo de la tanda:

| Archivo | Cambio | Requisito |
| --- | --- | --- |
| `tests/unit/paridad/proveedores-paridad.test.tsx` (+ `.snap`) | vitrina con `PageHeader`, tarjetas de proveedor y de producto, barra, vacíos | R1–R10 |
| `tests/unit/paridad/catalogo-paridad.test.tsx` (+ `.snap`) | cabecera del detalle, vuelta, columna de acciones de `actionsColumn`, tarjetas, no encontrado; **no** el diálogo de subida (QC-264) | R11–R17 |
| `tests/unit/paridad/clientes-paridad.test.tsx` (+ `.snap`) | `PageHeader`, columna de acciones, tarjetas, vacío con icono | R28–R33 |
| `tests/unit/paridad/acciones-por-fila.test.tsx` (+ `.snap`) | menú de catálogo y de clientes con separador | R14, R30 |
| `tests/unit/paridad/confirmaciones-paridad.test.tsx` (+ `.snap`) | baja de proveedor con `Notice` y disparador con texto; *enmienda E7:* icono de peligro en las bajas que monte | R18, R44 |
| `tests/unit/paridad/formularios-paridad.test.tsx` (+ `.snap`) | disparador de edición de `SupplierSheet`; ningún campo | R39 |
| `tests/unit/paridad/campos-paridad.test.tsx`, `buscadores-paridad.test.tsx` (+ `.snap`) | ninguno esperado; se listan porque montan piezas de las dos rutas | — |

La tanda 0 no regenera nada; cada snapshot se actualiza en la tanda que cambia la pantalla y el commit
cita la fila. `catalogo-paridad.snap` lo toca también QC-264: el segundo que llegue a `dev` regenera
sobre el primero (§ 9). *Enmienda E18:* QC-264 ya llegó; esta ficha regenera sobre su snapshot.
*Enmienda E8:* el rótulo oculto de `withCardFieldLabel` entra en el árbol de la tabla, así que
`catalogo-paridad` y `clientes-paridad` cambian también en esas celdas (R15, R31).

## 7. Tests y E2E que se tocan (barrido con grep, 2026-10-13)

**Unitarios que cambian aserciones** (T0 repite el grep y lo deja en `progress/impl_QC-266.md`):

| Test | Por qué |
| --- | --- |
| `tests/unit/proveedores-ui/supplier-showcase-row.test.tsx` (49 menciones) | el nombre deja de ser enlace; «Ver ficha» con flecha y nombre nuevo; «Cargar más» dentro de la tira; vacío sin enlace |
| `supplier-showcase-page.test.tsx`, `supplier-showcase-list.test.tsx`, `supplier-showcase-filters.test.tsx`, `showcase-line-card.test.tsx` | `PageHeader`, «Cargar más» visible, esqueleto y error, barra con `role="toolbar"` y etiquetas `sr-only`, tarjeta de 156 px |
| `supplier-detail-page.test.tsx`, `catalog-columns.test.tsx`, `catalog-line-sheet.test.tsx`, `delete-catalog-line-dialog.test.tsx`, `catalog-pdf-upload.test.tsx` | vuelta, acciones en la cabecera, columna con `menu`, anfitrión |
| `catalog-import-review.test.tsx`, `catalog-import-page.test.tsx` | cabecera, casilla sin «Incluir», `StatusBadge`, «Elige una imagen del archivo», barra fija |
| `tests/unit/documentos-ui/supplier-detail-upload.test.tsx` | el disparador vive en la cabecera |
| `tests/unit/shared/supplier-sheet.test.tsx` | disparador de edición con texto |
| `tests/unit/clientes-ui/clientes-page.test.tsx`, `customer-table.test.tsx`, `customer-columns.test.tsx`, `customer-list-section.test.tsx`, `customer-list-empty.test.tsx`, `customer-list-error.test.tsx`, `customer-list-skeleton.test.tsx`, `clientes-viewport.test.tsx`, `customer-sheet.test.tsx`, `delete-customer-dialog.test.tsx`, `clientes-convenciones.test.ts` | alta en la cabecera, columna con `menu`, anfitrión, tarjetas: los que cuentan disparadores o celdas en toda la página se acotan al cuerpo visible (`data-table-row-<id>` / `data-table-card-<id>`) |
| `tests/unit/shared-ui/confirm-dialog-montado.test.tsx` | monta los diálogos de baja; el diálogo sigue montado tras cerrar |
| `tests/unit/shared-ui/catalogo-qc256.test.ts` | fila de `SupplierSheet` (*enmienda E3:* la de `RowActionsMenu` ya no cambia) |
| `tests/guards/guard-piezas-base.test.ts` | fila de `TOUCH_TARGET` de los filtros (`:242`), si la constante sale |
| *Enmienda E13:* `tests/unit/marca/tablas-marca.test.tsx` | llama `buildCustomerColumns({ rowActions })` (`:249`) y `buildCatalogColumns({ …, rowActions })` (`:261-263`): pasan a `onAction` (y `canModify` en clientes) |
| *Enmienda E13:* `tests/unit/navegacion/pantallas-exigen-permiso.test.tsx` | monta `ProveedoresPage` y `ProveedorDetallePage` (`:12-13, 230-240`) con las actions simuladas; solo cambia si la página nueva pide algo que hoy no simula |
| *Enmienda E13:* `tests/unit/documentos-ui/document-upload-*.test.tsx`, `tests/unit/shared/ai-provider-required-tooltip*` | no cambian (la pieza no se toca); se corren por `vitest related` al mover el disparador |

**Tests nuevos:** `tests/unit/proveedores-ui/supplier-showcase-rediseno.test.tsx` (R1–R10),
`supplier-detail-header.test.tsx` (R11, R12, R17–R19), `catalog-row-actions.test.tsx` (R14, R16),
`catalog-cards.test.tsx` (R13, R15), `catalog-import-rediseno.test.tsx` (R20–R27),
`proveedores-toasts.test.tsx` (R36, R37); `tests/unit/clientes-ui/clientes-page-header.test.tsx` (R28),
`customer-row-actions.test.tsx` (R30, R32), `customer-cards.test.tsx` (R29, R31, R33),
`clientes-toasts.test.tsx` (R36); `tests/guards/guard-proveedores-clientes-rediseno.test.ts` (R43); y,
solo si P1 cambia, `tests/unit/shared-ui/row-actions-menu-separator.test.tsx` (R38).
*Enmienda E3:* P1 no cambia: `row-actions-menu-separator.test.tsx` ya existe en `dev` y cubre R38 sin
tocarse. *Enmienda E7:* R44 se fija en `supplier-detail-header.test.tsx` (baja del proveedor),
`catalog-row-actions.test.tsx` (baja de la línea) y `customer-row-actions.test.tsx` (eliminar el
cliente): icono con su `testId`, `data-tone="danger"` y `aria-hidden`.

**E2E que pueden cambiar** (corren en el PR a producción; T7 los corre por spec):

| E2E | Qué cambia |
| --- | --- |
| `e2e/proveedores.spec.ts` | `supplier-detail-link` sigue, ahora es el botón; el alta se busca en la cabecera |
| `e2e/aislamiento-proveedores.spec.ts` | usa `supplier-detail-link`, `supplier-delete-open`, `supplier-create-open`: se conservan |
| `e2e/catalogo-desde-pdf.spec.ts` | `toHaveText('Nueva')` sobre `catalog-import-row-kind-*` sigue valiendo (la etiqueta va dentro del `StatusBadge`); la casilla sin etiqueta «Incluir» |
| `e2e/documentos.spec.ts` | si abre «Subir PDFs» del detalle |
| `e2e/clientes.spec.ts`, `e2e/movimiento.spec.ts`, `e2e/marca-componentes.spec.ts` | `customer-create-open` en la cabecera (dos en el vacío, P6); `customer-row-actions` duplicado por la tarjeta: acotar a `data-table-row-<id>`. *Enmienda E14:* `pedido-con-cliente`, `entregar-producto-terminado` y `anular-entrega` salen: siembran clientes por Prisma y no nombran ningún testid de la pantalla (`tests/unit/clientes/scope.test.ts:313-327`; grep de `customer-(create\|row\|action)` en `e2e/` solo da los tres de esta fila) |
| *Enmienda E2, E14:* `e2e/modulos-por-empresa.spec.ts`, `e2e/integraciones-proveedor-ia.spec.ts` | no cambian: el primero solo pide `SUPPLIERS_ROUTE` con el añadido apagado (`:52-57`); el segundo mide «Subir PDFs» en Fórmulas |

**E2E nuevo:** `e2e/proveedores-clientes-rediseno.spec.ts` (Chromium y WebKit), a 1440 × 900 y a
390 × 844 sobre las cuatro pantallas:

- a 1440: vitrina con tarjetas, «Ver ficha del proveedor» como botón que navega, hover de una tarjeta
  de producto (cambia `box-shadow`), «Cargar más» de una fila; detalle con «Volver a proveedores» y las
  cuatro acciones en orden, tabla con menú «Editar», separador, «Dar de baja»; revisión con
  `StatusBadge`, fila excluida al 60 %, barra de «Confirmar» visible tras desplazar; Clientes con
  «Nuevo cliente» en la cabecera y menú con separador;
- a 390: ninguna página desborda en horizontal (R42), «Ver ficha» a todo el ancho y 44 px, tarjetas del
  catálogo y de Clientes con «Acciones» de 44 px que abre el diálogo centrado con su título e ítems de
  48 px, diálogos enteros y centrados, paneles a todo el ancho con el pie visible (R34).

Se da de alta en `E2E_ESPERADOS` de `tests/guards/guard-identificador-de-request.test.ts` y en la lista
cerrada de `tests/unit/shared/data-table-alcance.test.ts`, en su sitio por orden alfabético, con el
comentario «Alta el <fecha> (QC-266) por el MISMO motivo y en el MISMO sitio que las demas: …», como
las de QC-265.

*Enmienda E12:* por su nombre, el E2E cae además en otras dos listas cerradas que el spec no nombraba:
`tests/unit/proveedores/scope.test.ts:355-369` (casa con `PATRON_PROVEEDORES` por la ruta, `:59, 66-72`;
va antes de `'proveedores.spec.ts'` en orden alfabético) y `E2E_PERMITIDOS` de
`tests/unit/clientes/scope.test.ts:340-351` (casa con `/cliente/i` por el nombre, `:362`). Las dos
altas llevan su comentario, como las de QC-262 y QC-275. El E2E llama a `enableAllAddons(companyId)`
(`e2e/helpers/addons.ts:15`) como `proveedores.spec.ts`, porque `proveedores` y `lectura_pdf` son
añadidos (E2), y siembra la revisión como `e2e/catalogo-desde-pdf.spec.ts`.

## 8. Alternativas descartadas

- **A1 — Dejar el nombre del proveedor como enlace y añadir el botón al lado.** Dos destinos iguales en
  la misma tarjeta y un enlace de texto, que D2 prohíbe.
- **A2 — Celda `cell` del menú y el menú en el pie de la tarjeta** (`card.footer` = acciones). Cero
  cambio de dónde viven los paneles, pero la tarjeta pintaría el desplegable de tabla en vez de
  «Acciones» con diálogo centrado (D2), y cada fila montaría su panel y su diálogo dos veces.
- **A3 — Rediseñar aquí `DocumentUploadDialog`.** Lo dibujan dos tableros y QC-264 ya lo tomó (su P1,
  aprobado); hacerlo aquí duplica trabajo y choca en los mismos archivos.
- **A4 — Leer la presentación de cada producto para la vitrina** (P2). Pide cambiar la consulta de la
  vitrina en `lib/modules/proveedores` (repositorio, puerto y dominio) en una ficha de zona `frontend`.
- **A5 — Umbral propio de tarjetas para que tablet siga en tabla** (P8). Obliga a extender `DataTable`
  por consumidor y contradice QC-261 P5 y QC-262 P2.
- **A6 — Extender `PageHeader` con una ranura de descripción** para el contacto y el «N filas leídas».
  Toca una pieza compartida por un detalle de alineación; el `<dl>` justo debajo de la cabecera da el
  mismo orden de lectura.
- **A7 — Extender `DataTableCardLayout` para la tarjeta de cliente** (P7). Toca `data-table`, que
  QC-263 y QC-264 también pueden abrir, por la tipografía de una ranura.
- **A8 — Toast al confirmar la importación** (P13). Repetiría lo que ya dice el resumen `role="status"`
  que la sustituye.
- **A9 — Subir `FormFooterBar` a `components/shared` y usarlo en la revisión** (*enmienda E9*). Es la
  segunda ruta que lo pediría y la regla lo permite, pero el tablero de esta pantalla dibuja otra cosa
  (una tarjeta pegada abajo, no una barra de borde a borde con desenfoque) y en lo visual manda el
  tablero; además tocaría tres archivos de Fórmulas recién cerrados.
- **A10 — Añadir `triggerDataAttributes` al `Pick` de `RowActionsSpec`** (*enmienda E4*). Es lo que
  decía D6, pero las tres fichas que pasaron antes eligieron el tipo local; hacerlo aquí abriría
  `data-table-types.ts` para dos rutas y dejaría tres tipos locales redundantes.
- **A11 — Pasar `canUpload` y la disposición del proveedor IA a la cabecera y que ella decida**
  (*enmienda E1*). Obligaría a `SupplierDetailHeader` a conocer `AiProviderRequiredTooltip` y el resultado
  de una action; la página ya arma los tres estados hoy y basta con bajarlos como nodo.

## 9. Riesgos y coordinación

- **Orden con QC-262 y QC-264** (P1): esta ficha se implementa con las dos ya en `dev`. Comparte con
  QC-262 `components/shared/row-actions-menu.tsx` (solo si P1 cambia) y con QC-264
  `tests/unit/paridad/catalogo-paridad.test.tsx` y su `.snap`; con QC-262, QC-263 y QC-264
  `components/shared/CATALOGO.md`, `components/shared/data-table/data-table-types.ts` (solo si falta
  `triggerDataAttributes`), `tests/unit/shared/data-table-alcance.test.ts` y
  `guard-identificador-de-request.test.ts` (listas cerradas que crecen por apéndice).
  `scripts/archivos-en-vuelo.mjs` lo comprueba con `## Archivos esperados`.
- **Duplicados de tabla y tarjeta** (D6, D7, D9): los localizadores de página por `data-testid` de
  disparador o de celda encuentran dos. T0 los censa antes de tocar nada.
- **QC-236 y QC-244** (`pending`) tocarán el formulario de cliente y el menú: si entran antes, se rebasa;
  ninguno de sus archivos está aquí salvo `customer-columns.tsx` si QC-236 cambia la celda de teléfono.
- **Gate rápido y listas cerradas:** lección de QC-261 y QC-265; T7 cierra con `./init.sh --completo`.
- *Enmienda (E3, E4, E18):* QC-262, QC-263 y QC-264 están en `dev`: esta ficha ya no comparte con ellas
  `row-actions-menu.tsx` ni `data-table-types.ts` (no se tocan). Siguen en común, por apéndice,
  `CATALOGO.md` y las listas cerradas de E2E.
- *Enmienda E11:* `tests/unit/proveedores/module-contract.test.ts:370-376` prohíbe `/proveedores|supplier/i`
  en todo archivo de `app/` fuera de `app/(private)/proveedores`, y `tests/unit/proveedores/scope.test.ts:343-350`
  prohíbe esa palabra en la ruta de cualquier archivo de `components/` fuera de `components/shared/supplier/`.
  Los archivos de `app/(private)/clientes/` de esta ficha no la nombran (ni en código ni en textos), y
  el guardia nuevo vive en `tests/guards/`. Si algún texto con esa palabra tuviera que salir de
  `app/(private)/proveedores`, va a `lib/shared/ui/` (precedente QC-278 E17). Simétrico para clientes:
  `tests/unit/clientes/scope.test.ts:632-684` (R38) prohíbe marcas de clientes fuera de
  `app/(private)/clientes/`.
- *Enmienda E10:* QC-244 dejó `/clientes/contactos` y su barrel; esta ficha no los toca y
  `clientes/scope.test.ts:203-205` los admite por ruta exacta.

## 10. Enmiendas a specs cerrados

| Spec | Qué cambia | Por qué |
| --- | --- | --- |
| QC-140 (vitrina) | El nombre del proveedor deja de ser enlace («Ver el detalle de X»); la fila vacía pierde su enlace «Ver ficha del proveedor»; aparece «Cargar más» visible junto al centinela | D2 del humano, ficha QC-266 |
| QC-43 / QC-158 (detalle) | «Nueva línea» y «Subir PDFs» pasan a la cabecera; el vacío del catálogo no repite «Nueva línea»; el panel y el diálogo de la línea los monta un anfitrión por tabla | D2, D14 |
| QC-158 (revisión) | La etiqueta visible «Incluir» sale (queda el nombre «Incluir fila N»); «Cambiar» pasa a «Elige una imagen del archivo»; la clase de fila pasa a `StatusBadge` | D3, D14 |
| QC-155 (Clientes) | «Nuevo cliente» sale de la barra de la tabla a la cabecera; el panel y el diálogo los monta un anfitrión por tabla | D2, D14 |
| QC-55 (`tests/unit/shared/data-table-alcance.test.ts`) | La lista cerrada de E2E gana `e2e/proveedores-clientes-rediseno.spec.ts` | § 7 |
| *Enmienda E12:* QC-43/QC-44 (`tests/unit/proveedores/scope.test.ts`) y QC-155 (`tests/unit/clientes/scope.test.ts`, R28) | Sus listas cerradas de E2E ganan el mismo spec | § 7 |

## 11. Deudas

- **D53** (esqueletos sin tarjeta) se amplía al catálogo del proveedor y a Clientes.
- **Nuevas, si se confirman por defecto:** presentación bajo el producto de la vitrina (P2), nombre del
  PDF en la revisión (P10), contador de filas incluidas (P9) y animaciones de entrada (P14).
- *Enmienda E16:* los tres estados de error de la revisión siguen sin vuelta al detalle (Fórmulas sí
  la tiene: `app/(private)/produccion/formulas/importar/[documentoId]/page.tsx:60`). Fuera del alcance
  aprobado; se anota.
- *Enmienda E7:* si P16 se rechaza, D56 se amplía a las tres bajas de esta ficha.

## Dependencias de terceros

Ninguna nueva. `@base-ui/react` (Menu, Dialog, AlertDialog, Sheet, Select, Checkbox, Tooltip),
`sonner`, `lucide-react`, `@tanstack/react-table` y `react-intersection-observer` ya están en
`docs/dependencias.md`. *Enmienda:* la enmienda tampoco añade ninguna.

## 12. Enmienda contra dev (2026-10-19)

**Por qué.** El spec se escribió y aprobó el 2026-10-13 (P1–P15 por defecto). El 2026-10-19 la rama
recibió `origin/dev` (687 commits): QC-262, QC-263, QC-264 (#274), QC-244 (#270), QC-275/QC-280,
QC-277, QC-278 (#268), QC-165, QC-166 y cambios directos de Inventario y Pedidos. **Regla del humano:**
en lo visual manda el tablero (`docs/diseno/canvas/`); en columnas, costos y datos, lo mergeado en
`dev`. No se cambia conducta aprobada salvo que `dev` la haga imposible o la haya resuelto distinto;
lo que no sale del código ni de los docs queda como pregunta nueva con su defecto (P16, P17).

**Cómo se leyó `dev`.** Sin shell ni git: se leyó el árbol del worktree tras el merge (código de las
cuatro rutas y de las piezas compartidas, tests, guardias, E2E, tableros, `components/shared/CATALOGO.md`,
`progress/deudas.md`, `progress/features/QC-244.md` y `feature_list.json`) con Grep y Read. Los
cambios directos a `dev` se leyeron por su efecto en el árbol, no por commit. Las citas son
`archivo:línea` del árbol tras el merge.

| # | Qué decía el spec | Qué hay en `dev` (cita) | Qué cambia aquí | R / P / T |
| --- | --- | --- | --- | --- |
| E1 | R19/D4: «Subir PDFs» se pinta o no según `canUpload`, que baja a la cabecera | Tres estados: sin `canUpload` nada; con proveedor IA, `CatalogPdfUpload`; sin él, `CatalogPdfUpload disabled` dentro de `AiProviderRequiredTooltip` (`app/(private)/proveedores/[id]/page.tsx:101, 126-141`; QC-275, QC-280; `CATALOGO.md:51`). El tablero no dibuja el deshabilitado (`ProveedorDetalle.dc.html:45`); su globo es el de `ProveedorIA.dc.html` | R19 nombra los tres estados y el tercer puesto del R12. D4: `SupplierDetailHeader` recibe `upload: ReactNode \| null` armado por la página (A11) | R12, R19; T3a |
| E2 | R41: «mismos permisos de página» | `proveedores` es un añadido (`lib/modules/identity/domain/company-addons.ts:3, 8`): apagado, `proveedores.*` sale del permiso efectivo y las tres pantallas responden 404 por `requirePagePermission` (`e2e/modulos-por-empresa.spec.ts:52-57`). La revisión corta además con `requirePageAddon('lectura_pdf')` (`importar/[documentoId]/page.tsx:68`), vigilado por `tests/guards/guard-pantallas-de-anadido.test.ts:40` | R41 nombra los dos cortes; D8 no mueve las tres primeras líneas; el E2E nuevo llama a `enableAllAddons` | R41; T4a, T7a |
| E3 | P1/T1a/R38: `separatorBefore` «si no está en `dev`» | Está: `components/shared/row-actions-menu.tsx:53-54, 83-85`, con `tests/unit/shared-ui/row-actions-menu-separator.test.tsx` (QC-262 D7); fila de `RowActionsMenu` al día (`CATALOGO.md:91`) | P1 resuelta; T1a solo verifica; `row-actions-menu.tsx`, sus dos tests y la fila de `RowActionsMenu` salen de `Archivos esperados` | R38; P1; T1a, T1d |
| E4 | D6/T1b: añadir `triggerDataAttributes` al `Pick` de `RowActionsSpec` «solo si falta» | No está (`components/shared/data-table/data-table-types.ts:65`). QC-262, QC-263 y QC-264 usan un tipo local que `actionsColumn` propaga (`actions-column.tsx:27-28`; `inventario/components/product-row-actions.tsx:41-43`, `pedidos/components/order-row-actions.tsx:195`, `produccion/formulas/components/recipe-row-actions.tsx:36`). `tests/unit/clientes-ui/data-table-intacta-clientes.test.ts:163-203` vigila que el contrato compartido no gane mecanismos de acciones | `CatalogLineRowActionsSpec` y `CustomerRowActionsSpec` locales; `data-table-types.ts` no se toca (A10); T1b no aplica | R14, R30; T1b, T3b, T5b |
| E5 | «Lo que ya existe»: QC-262/QC-263/QC-264 «sin implementar», specs en `.worktrees/` | En `dev` (`done`); specs en `specs/QC-262-rediseno-pedidos/`, `specs/QC-263-rediseno-inventario/`, `specs/QC-264-rediseno-formulas/`. Anfitrión único en `produccion/formulas/components/recipe-table.tsx:166-174, 258-262`; deps `onAction` en `maestro/empresas/components/company-columns.tsx:37-40` (otras rutas usan `menu`, `recipe-columns.tsx:35-38`) | Citas corregidas; D6 y D9 siguen ese patrón y conservan `onAction` | R14, R16, R30, R32 |
| E6 | D2: «Ver ficha del proveedor» con `aria-label` | `ArrowLink` no tiene `aria-label` (`components/shared/arrow-link.tsx:11-23`); ganó `disabled` | Nombre accesible con `sr-only` dentro del enlace (QC-264 E12); la pieza no se toca | R3; T2b |
| E7 | — (los diálogos de baja sin icono) | `ConfirmDialog` tiene `icon` (`components/shared/confirm-dialog.tsx:182, 233-239`; `CATALOGO.md:57`), en el cuerpo también (`DeleteConfirmDialogBody`, que usa `delete-customer-dialog.tsx:98`); QC-264 R50 lo usa (`delete-recipe-dialog.tsx:173`); D56 «en parte resuelta» (`progress/deudas.md:442-454`). El tablero lo dibuja en las tres bajas (`ModalesProveedores.dc.html:33, 68, 119`, `dlg-ic danger`: círculo tachado, círculo tachado, papelera) | P16 (defecto: sí). R44 nuevo; D4 y D9 pasan `icon` | R44; P16; T3a, T3b, T5b |
| E8 | R15/R31: la tarjeta pinta las cifras sin decir qué son | `cardFieldLabel`/`withCardFieldLabel` (`components/shared/card-field-label.tsx`; `CATALOGO.md:55`), usado en `inventario/components/product-columns.tsx:393, 633-666` y `produccion/formulas/components/recipe-columns.tsx:76-93`. El tablero de la tarjeta del catálogo solo enumera su contenido (`ProveedorDetalleMovil.dc.html:24`) | P17 (defecto: rótulo en mínimo de compra, tiempo de entrega, actualizado y fecha de alta). R15 y R31 lo nombran; D7 y D9 lo aplican | R15, R31; P17; T3c, T5c |
| E9 | D8: la barra de «Confirmar» como `Card` `sticky` | `FormFooterBar` existe solo en Fórmulas (`app/(private)/produccion/formulas/components/form-footer-bar.tsx:12-22`; `formula-import-review.tsx:471`), barra de borde a borde con desenfoque. El tablero de esta pantalla dibuja una tarjeta `position: sticky; bottom: 0` (`ProveedorImportar.dc.html:73`) | D8 no cambia (manda el tablero); `FormFooterBar` ni se reutiliza ni se sube (A9) | R25; T4c |
| E10 | «Lo que NO entra»: el menú de Clientes con Contactos (QC-244) `pending` | En `dev` (`progress/features/QC-244.md:36`, PR #270): `app/(private)/clientes/contactos/page.tsx`, grupo «Clientes» en `lib/shared/navigation/private-nav.ts`; `tests/unit/clientes/scope.test.ts:203-205` admite su `page.tsx` | Se corrige el texto; `/clientes/contactos` no entra ni se toca; R28 sigue hablando solo de `/clientes` | R28; § 9 |
| E11 | — | `tests/unit/proveedores/module-contract.test.ts:370-376` prohíbe `/proveedores\|supplier/i` en `app/` fuera de `app/(private)/proveedores`; `tests/unit/proveedores/scope.test.ts:343-350` lo prohíbe en rutas de `components/` fuera de `components/shared/supplier/` | Restricción escrita en § 9. Ningún archivo de esta ficha la rompe: los de clientes no nombran proveedores; si un texto tuviera que salir, va a `lib/shared/ui/` (QC-278 E17) | R41, R43 |
| E12 | § 7: el E2E nuevo entra en dos listas cerradas | Por su nombre cae también en `tests/unit/proveedores/scope.test.ts:355-369` (`PATRON_PROVEEDORES`, `:59`) y en `E2E_PERMITIDOS` de `tests/unit/clientes/scope.test.ts:340-351` (`/cliente/i`, `:362`) | Cuatro altas en T7a; los dos `scope.test.ts` entran en `Archivos esperados` | R42; T7a |
| E13 | § 7: censo del 2026-10-13 | `tests/unit/marca/tablas-marca.test.tsx:249, 261-263` llama `build*Columns({ rowActions })`; `tests/unit/navegacion/pantallas-exigen-permiso.test.tsx:12-13, 230-240` monta las dos páginas de proveedores | § 7 ampliado; T0a, T3b y T5b los incluyen | R14, R30, R41; T0a |
| E14 | § 7: seis E2E de clientes «pueden cambiar» | Solo `clientes.spec.ts`, `movimiento.spec.ts` (`:507` ya usa `.first()`) y `marca-componentes.spec.ts` nombran testids o la ruta de la pantalla; `pedido-con-cliente`, `entregar-producto-terminado` y `anular-entrega` siembran por Prisma (`clientes/scope.test.ts:313-327`) | Los tres últimos salen de § 7, T7b y `Archivos esperados` | R41; T7b |
| E15 | «Lo que ya existe»: `guard-piezas-base.test.ts:238` | La fila está en `:242`; `:678` exige que `supplier-showcase-skeleton.tsx` exista | Cita corregida; D2 restila el esqueleto, no lo borra | R9; T2a, T2d |
| E16 | — | Los errores de la revisión no tienen vuelta (`importar/[documentoId]/page.tsx:27-45, 78-100`); los de Fórmulas sí (`produccion/formulas/importar/[documentoId]/page.tsx:60`) | Fuera del alcance aprobado; se anota en § 11 | — |
| E17 | Comprobado sin cambios | `PageHeader` con `title`, `titleTestId`, `actions`, `breadcrumb` y `data-slot="page-header-actions"` (`page-header.tsx:10-18, 63-69`; es un `data-slot`, no un `data-testid`); `Notice`, `StatusBadge` (`waiting`), `EmptyState` (`icon`), `DataTableCardLayout` y `cardActions`/`closeMenu` (`data-table-types.ts:114-120, 184-187`); las doce columnas del catálogo, incluida «Creado» (`catalog-columns.tsx:157-271`), igual que el tablero (`ProveedorDetalleMovil.dc.html:22`); las nueve de clientes (`customer-columns.tsx:53-124`); los nueve textos de toast; `KIND_LABELS` (`catalog-import-row.tsx:29-35`); `CropPicker` (`crop-picker.tsx:11-25`); la vitrina y sus filtros. El catálogo del proveedor no tiene corte por permiso de costos (`canViewUnitCosts` es de Inventario). D53 sigue vigente. `StepReader` con `panel` no aplica a esta ficha | Sin cambio | — |
| E18 | D5/§ 6: «si QC-264 ya está en `dev`» | Está: `DocumentUploadDialog` con `disabled` y tonos `BROWSER_PHASE_TONES`/`FILE_STATUS_TONES` (`CATALOGO.md:69`), tests `tests/unit/documentos-ui/document-upload-tones.test.tsx`, `document-upload-dialog.test.tsx`, `document-upload-errors.test.tsx`; el snapshot de `catalogo-paridad` ya lo trae | El detalle hereda el diálogo; ningún archivo de la subida entra en `Archivos esperados` | R19; T3a, T3c |

**Requisitos antes de la enmienda** (para el reviewer):

- R15 no nombraba los rótulos de la tarjeta.
- R19 decía: «DONDE la sesión puede subir documentos, el disparador «Subir PDFs» de la cabecera DEBE ser
  el de la pieza compartida de subida con la estrategia de catálogo y la revisión de este proveedor; SI
  no puede, ENTONCES NO DEBE pintarse. Esta ficha NO DEBE modificar ningún archivo de
  `components/shared/document-upload/`.»
- R31 no nombraba el rótulo de la fecha de alta.
- R38 terminaba en «*(supuesto P1)*».
- R41 no nombraba los cortes por añadido.
- R44 es nuevo.
