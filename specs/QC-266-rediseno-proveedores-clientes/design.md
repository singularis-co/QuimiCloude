# QC-266 — rediseno-proveedores-clientes · design.md

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
| QC-262 (`spec_ready`, sin implementar): define `separatorBefore` en `RowActionMenuItem` y el patrón «menú como datos + un anfitrión por tabla» | `.worktrees/QC-262-rediseno-pedidos/specs/QC-262-rediseno-pedidos/design.md > D5, D7` | Se usa su contrato tal cual (R38, P1) y su patrón (D6, D9) |
| QC-264 (`spec_ready`, sin implementar): restila `components/shared/document-upload/` y actualiza en `catalogo-paridad` el diálogo de subida del detalle de proveedor (su P1) | `.worktrees/QC-264-rediseno-formulas/specs/QC-264-rediseno-formulas/design.md > D4, § 6` | No se duplica: aquí solo se mueve el disparador (R19, D5) |
| QC-263 y QC-264: `RowActionsSpec` no lleva `triggerDataAttributes`; las dos lo añaden «solo si falta» | `components/shared/data-table/data-table-types.ts:65` | Igual aquí (D6): la fila de tabla conserva `data-catalog-line-id` y `data-customer-id` |
| QC-263: tarjeta con `primary` = columna de imagen | `.worktrees/QC-263-rediseno-inventario/.../design.md:164` | Mismo criterio en el catálogo (D7) |
| QC-265 (`done`): menú ⋯, tarjetas y altas en las listas cerradas; D53 (esqueletos sin tarjeta) | `specs/QC-265-rediseno-operario/`, `progress/deudas.md > D53` | Se imita; D53 se amplía (§ 11) |
| D48: `editCustomerLabel`, `deleteCustomerLabel` exportadas sin consumidor por QC-232 R5 | `progress/deudas.md > D48` | Se conservan (R41) |
| `guard-piezas-base > CONSTANTES_QUE_NO_SON_EL_PAR` nombra `TOUCH_TARGET` de `supplier-showcase-filters.tsx` | `tests/guards/guard-piezas-base.test.ts:238` | Si la constante desaparece, su fila sale en el mismo commit (D1) |
| `guard-convenciones-showcase` (QC-140 R18, D8): `react-intersection-observer` solo en `showcase-load-trigger.tsx`, ningún `IntersectionObserver` ni `scroll` a mano | `tests/unit/proveedores-ui/guard-convenciones-showcase.test.ts` | El «Cargar más» visible llama a la misma `loadMore`; el centinela no cambia (D2) |
| Textos visibles sin tilde en las dos rutas | Grep | Ninguno: D9 no aplica |
| QC-236, QC-239, QC-244 (`pending`) tocan clientes; QC-139 (`pending`) proveedores de lo que falta | `feature_list.json` | No se solapan con esta ficha; riesgo de choque en § 9 |

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
| Separador del menú | `RowActionsMenu` | 2 · el punto de extensión `separatorBefore` de QC-262 (P1) | `RowActionsMenu` no separa grupos hoy | `Tabla.dc.html` |
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
  44 px. El `Link` del nombre desaparece.
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
- `delete-supplier-dialog.tsx`: el disparador pasa a `variant="outline"` con `CircleSlashIcon`, el texto
  «Dar de baja», clase de color de peligro y el `aria-label` y `data-testid` de hoy; el `aside` pasa a
  `<Notice tone="warning" testId="delete-supplier-cascade">` con el texto de hoy.
- `catalog-table.tsx`: el vacío deja de pasar `children` con `CatalogLineSheet` (P5).
- `supplier-not-found.tsx`: recuadro `role="alert"` con icono, el texto de hoy y `ArrowLink
  direction="back"` «Volver a la lista de proveedores» (`testId="supplier-not-found-link"`).

**D5 — «Subir PDFs» (R19).** `CatalogPdfUpload` no cambia: solo se monta dentro de las acciones de la
cabecera. Ningún archivo de `components/shared/document-upload/` está en `## Archivos esperados`. Si
QC-264 ya está en `dev`, el disparador y el diálogo llegan restilados; si no, siguen como hoy.

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

**D7 — Catálogo en tarjetas (R15).** `CatalogTable` pasa a `DataTable`
`card={{ primary: IMAGE_COLUMN_ID, status: 'cost', title: 'name', meta: ['presentationId', 'unitId',
'minPurchase', 'deliveryTime', 'material', 'measurements'], footer: 'updatedAt' }}` (precedente de
QC-263) y `CATALOG_TABLE_TEXTS` gana `cardActions: 'Acciones'` y `closeMenu: 'Cerrar'`. El umbral es el
de `DataTable` (P8).

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
  `isConfirming` (R25). Reglas, envío y reclasificación sin cambios.
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
| `SupplierDetailHeader` | `supplier` | + `canUpload`, `units` (para las acciones) |
| `SupplierSheet` (edición) | `ghost`, solo lápiz | `outline`, lápiz y «Editar» |
| `RowActionMenuItem` | — | `separatorBefore?` (de QC-262; aquí solo si P1 cambia) |
| `RowActionsSpec` | sin `triggerDataAttributes` | + `triggerDataAttributes` (solo si falta) |

## 6. Snapshots y árboles que cambian (aceptados)

Toda diferencia de paridad que no esté aquí es un fallo de la tanda:

| Archivo | Cambio | Requisito |
| --- | --- | --- |
| `tests/unit/paridad/proveedores-paridad.test.tsx` (+ `.snap`) | vitrina con `PageHeader`, tarjetas de proveedor y de producto, barra, vacíos | R1–R10 |
| `tests/unit/paridad/catalogo-paridad.test.tsx` (+ `.snap`) | cabecera del detalle, vuelta, columna de acciones de `actionsColumn`, tarjetas, no encontrado; **no** el diálogo de subida (QC-264) | R11–R17 |
| `tests/unit/paridad/clientes-paridad.test.tsx` (+ `.snap`) | `PageHeader`, columna de acciones, tarjetas, vacío con icono | R28–R33 |
| `tests/unit/paridad/acciones-por-fila.test.tsx` (+ `.snap`) | menú de catálogo y de clientes con separador | R14, R30 |
| `tests/unit/paridad/confirmaciones-paridad.test.tsx` (+ `.snap`) | baja de proveedor con `Notice` y disparador con texto | R18 |
| `tests/unit/paridad/formularios-paridad.test.tsx` (+ `.snap`) | disparador de edición de `SupplierSheet`; ningún campo | R39 |
| `tests/unit/paridad/campos-paridad.test.tsx`, `buscadores-paridad.test.tsx` (+ `.snap`) | ninguno esperado; se listan porque montan piezas de las dos rutas | — |

La tanda 0 no regenera nada; cada snapshot se actualiza en la tanda que cambia la pantalla y el commit
cita la fila. `catalogo-paridad.snap` lo toca también QC-264: el segundo que llegue a `dev` regenera
sobre el primero (§ 9).

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
| `tests/unit/shared-ui/catalogo-qc256.test.ts` | fila de `SupplierSheet` (y de `RowActionsMenu` si P1 cambia) |
| `tests/guards/guard-piezas-base.test.ts` | fila de `TOUCH_TARGET` de los filtros, si la constante sale |

**Tests nuevos:** `tests/unit/proveedores-ui/supplier-showcase-rediseno.test.tsx` (R1–R10),
`supplier-detail-header.test.tsx` (R11, R12, R17–R19), `catalog-row-actions.test.tsx` (R14, R16),
`catalog-cards.test.tsx` (R13, R15), `catalog-import-rediseno.test.tsx` (R20–R27),
`proveedores-toasts.test.tsx` (R36, R37); `tests/unit/clientes-ui/clientes-page-header.test.tsx` (R28),
`customer-row-actions.test.tsx` (R30, R32), `customer-cards.test.tsx` (R29, R31, R33),
`clientes-toasts.test.tsx` (R36); `tests/guards/guard-proveedores-clientes-rediseno.test.ts` (R43); y,
solo si P1 cambia, `tests/unit/shared-ui/row-actions-menu-separator.test.tsx` (R38).

**E2E que pueden cambiar** (corren en el PR a producción; T7 los corre por spec):

| E2E | Qué cambia |
| --- | --- |
| `e2e/proveedores.spec.ts` | `supplier-detail-link` sigue, ahora es el botón; el alta se busca en la cabecera |
| `e2e/aislamiento-proveedores.spec.ts` | usa `supplier-detail-link`, `supplier-delete-open`, `supplier-create-open`: se conservan |
| `e2e/catalogo-desde-pdf.spec.ts` | `toHaveText('Nueva')` sobre `catalog-import-row-kind-*` sigue valiendo (la etiqueta va dentro del `StatusBadge`); la casilla sin etiqueta «Incluir» |
| `e2e/documentos.spec.ts` | si abre «Subir PDFs» del detalle |
| `e2e/clientes.spec.ts`, `e2e/movimiento.spec.ts`, `e2e/pedido-con-cliente.spec.ts`, `e2e/entregar-producto-terminado.spec.ts`, `e2e/anular-entrega.spec.ts`, `e2e/marca-componentes.spec.ts` | `customer-create-open` en la cabecera (dos en el vacío, P6); `customer-row-actions` duplicado por la tarjeta: acotar a `data-table-row-<id>` |

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

## 10. Enmiendas a specs cerrados

| Spec | Qué cambia | Por qué |
| --- | --- | --- |
| QC-140 (vitrina) | El nombre del proveedor deja de ser enlace («Ver el detalle de X»); la fila vacía pierde su enlace «Ver ficha del proveedor»; aparece «Cargar más» visible junto al centinela | D2 del humano, ficha QC-266 |
| QC-43 / QC-158 (detalle) | «Nueva línea» y «Subir PDFs» pasan a la cabecera; el vacío del catálogo no repite «Nueva línea»; el panel y el diálogo de la línea los monta un anfitrión por tabla | D2, D14 |
| QC-158 (revisión) | La etiqueta visible «Incluir» sale (queda el nombre «Incluir fila N»); «Cambiar» pasa a «Elige una imagen del archivo»; la clase de fila pasa a `StatusBadge` | D3, D14 |
| QC-155 (Clientes) | «Nuevo cliente» sale de la barra de la tabla a la cabecera; el panel y el diálogo los monta un anfitrión por tabla | D2, D14 |
| QC-55 (`tests/unit/shared/data-table-alcance.test.ts`) | La lista cerrada de E2E gana `e2e/proveedores-clientes-rediseno.spec.ts` | § 7 |

## 11. Deudas

- **D53** (esqueletos sin tarjeta) se amplía al catálogo del proveedor y a Clientes.
- **Nuevas, si se confirman por defecto:** presentación bajo el producto de la vitrina (P2), nombre del
  PDF en la revisión (P10), contador de filas incluidas (P9) y animaciones de entrada (P14).

## Dependencias de terceros

Ninguna nueva. `@base-ui/react` (Menu, Dialog, AlertDialog, Sheet, Select, Checkbox, Tooltip),
`sonner`, `lucide-react`, `@tanstack/react-table` y `react-intersection-observer` ya están en
`docs/dependencias.md`.
