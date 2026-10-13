# QC-263 — rediseno-inventario · design.md

## Lo que ya existe

**Términos buscados.** En el board (`feature_list.json`, todos los estados): «inventario», «lote»,
«importa», «existencia», «toast», «tilde». En `specs/` y `progress/`: `QC-263`, «Elegi un motivo»,
«Conteo fisico», `separatorBefore`, `D41`, `D53`, «barra de pasos». En el código (grafo
`codebase-memory-mcp` del worktree, que respondió, y Grep): `ProductTypeTabs`, `ProductRowActions`,
`buildProductColumns`, `isBelowAlert`, `stockAmountCell`, `ProductBatchesPanel`,
`ProductBatchesSheet`, `BatchHistory`, `movementReasonLabel`, `AdjustBatchDialog`,
`DeleteProductDialog`, `InventoryImportScreen`, `ImportRowsTable`, `ImportTotals`,
`ImportUploadField`, `RowActionMenuItem`, `UrlTabs`, `FileField`, `PageHeader`, `ArrowLink`.

| Qué apareció | Dónde | Qué se hace |
| --- | --- | --- |
| QC-209 (`done`) hizo la importación entera: archivo, vista previa con cifras, filtros, faltantes con alta de unidad y presentación, confirmación idempotente y resultado | `app/(private)/inventario/importar/`, `specs/QC-209-importar-inventario-desde-excel/` | Se reutiliza tal cual; esta ficha solo cambia el marco (pasos, tarjetas, cabecera) y los tonos |
| QC-92 y QC-213 (`done`): ajuste por total contado, motivos por sentido, historial del lote | `adjust-batch-dialog.tsx`, `batch-history.tsx`, `lib/modules/inventario/domain/stock-adjustment.ts` | Mismas reglas y envío; cambia dónde se abren (menú) y su aspecto |
| El menú ⋯ de la fila ya existe sobre `RowActionsMenu` (Lotes, Editar, Borrar), como celda `cell` y con un panel y dos diálogos montados por fila | `product-row-actions.tsx`, `product-table.tsx`, `finished-stock-table.tsx` | Pasa a `actionsColumn({ menu })` con un anfitrión por tabla, como QC-262 D5 (D4, D5) |
| Los toasts de producto (creado, actualizado, ajustado, borrado) ya existen | `product-sheet.tsx` (vía `useEntitySheet`), `adjust-batch-dialog.tsx`, `delete-product-dialog.tsx` | Se conservan y un test los fija (R27); faltan los de la importación (R28) |
| `ImportRowsTable` ya usa `DataTable` con parámetros locales para una lista que vive en el cliente | `import-preview-table.tsx` | Es el patrón que siguen las tablas de lotes y de historial (D7, D8) |
| **QC-262 (aprobado, sin implementar)** extiende `RowActionsMenu` con `separatorBefore` por ítem | `.worktrees/QC-262-rediseno-pedidos/specs/QC-262-rediseno-pedidos/design.md > D7`, su R14 | Mismo contrato, sin variante propia (D12, P16) |
| QC-270 (`done`): la cabecera de `DataTable` sigue la alineación de su columna | `components/shared/data-table/` | Basta con `align: 'end'` en la columna (D3) |
| QC-265 (`done`) dejó el patrón de tarjetas, el E2E a 1440/820/390 y D53 (esqueletos sin tarjeta) | `specs/QC-265-rediseno-operario/`, `progress/deudas.md > D53` | Se imita; D53 se amplía a `/inventario` si su esqueleto tampoco casa (T0b) |
| D41: `batch-history.tsx` conserva `TOUCH_TARGET` con dueño QC-223 (`done`) | `progress/deudas.md > D41`, exclusión en `tests/guards/guard-piezas-base.test.ts` | Se resuelve aquí (P15, R46) |
| `batch-history.tsx` y `product-name-picker.tsx` están en listas que exigen que existan (`NO_SE_TOCAN_R30` de `guard-formularios-y-acciones`, `NO_SE_TOCAN_R21` de `guard-buscadores`) | `tests/guards/` | Se editan, nunca se borran ni se renombran |
| QC-178, QC-197, QC-253 (`pending`) tocan coste, lote usado y lote al acondicionar | `feature_list.json` | Fuera; no comparten archivos de esta ficha salvo lo anotado en § 9 |

**Filas de `components/shared/CATALOGO.md` consultadas y paso de la regla de decisión**
(`docs/perfil-agentes.md > Regla de decisión para componentes`):

| Pieza | Filas consultadas | Paso | Por qué no bastaba el anterior | Tablero |
| --- | --- | --- | --- | --- |
| Título y acciones | `PageShell`, `PageHeader` | 1 · reutiliza | — | `Superficies.dc.html`, `Inventario.dc.html` |
| Pestañas por tipo | `UrlTabs`, `Tabs` | 1 · reutiliza `UrlTabs` | — | `Superficies.dc.html`, `Inventario.dc.html` |
| Tabla, tarjetas, menú | `DataTable` (`card`, `actionsColumn({ menu })`), `RowActionsMenu` | 1 · reutiliza | — | `Tabla.dc.html`, `Inventario.dc.html` |
| Separador del menú | `RowActionsMenu`, `DropdownMenu`, `Separator` | 2 · extiende `RowActionsMenu` (contrato de QC-262 D7) | «Cubre: ítems de acción o de enlace…»; no separa grupos | `Tabla.dc.html`, `Inventario.dc.html` |
| Estados (sobre-reservado, filas de importación) | `StatusBadge`, `STATUS_TONES`, `Badge` | 1 · reutiliza `StatusBadge` | — | `Estados.dc.html`, `InventarioImportar.dc.html` |
| Volver a inventario | `ArrowLink` | 1 · reutiliza | — | `Botones.dc.html`, `InventarioImportar.dc.html` |
| Paneles y diálogos | `Sheet`, `Dialog`, `DeleteConfirmDialog`, `FieldError`, `Input`, `Select` | 1 · reutiliza | — | `ModalesInventario.dc.html` |
| Avisos emergentes | `Toaster`, `useEntitySheet` | 1 · reutiliza | — | `Avisos.dc.html`, `ModalesInventario.dc.html` |
| Tarjetas de la importación | `Card`, `Notice` | 1 · reutiliza `Card` | — | `InventarioImportar.dc.html` |
| Zona de archivo | `FileField`, `file-types` | no se usa (P10) | No admite `.xlsx`, comprime imágenes y entrega bytes, no el `File` que necesita la action | `InventarioImportar.dc.html` |
| Barra de pasos (`ImportSteps`) | `UrlTabs`, `Tabs`, `PageHeader` | 4 · crea en la ruta | Ninguna fila es una secuencia de pasos: `UrlTabs` y `Tabs` son controles que se eligen, y aquí los pasos solo informan (P6) | `InventarioImportar.dc.html` (`.tabs` con `.count` en «Pasos») |
| Anfitrión de paneles de la fila (`ProductRowDialogs`) | — | excepción: subcomponente interno | Solo compone `ProductBatchesSheet`, `ProductSheet`, `DeleteProductDialog`, `BatchHistory`, `AdjustBatchDialog`; no pinta UI nueva | — |

`ImportSteps` solo lo usa `/inventario/importar`: ni `ProveedorImportar` ni `ImportarFormula` dibujan
pasos. Se queda en la ruta (regla de la segunda ruta).

## 1. Principio

Es un **cambio visual** con tablero aprobado (D6, D14). Cambian los snapshots de paridad de
inventario y de acciones por fila (§ 6). El comportamiento no cambia: mismos permisos, mismas
Server Actions con los mismos campos, mismas reglas de ajuste, de alarma y de importación (R45). Lo
que sí cambia por dentro es **dónde viven los paneles de la fila** (D5), porque las tarjetas lo
obligan, como en QC-262.

## 2. Modelo de datos

No aplica: sin tablas, sin RLS, sin migraciones, sin cambios en `lib/modules/`. Las lecturas son las
de hoy (`listProductsAction`, `listFinishedStockAction`, `listProductBatchesAction`,
`listOrderBatchesAction`, `listBatchMovementsAction`) y las escrituras también.

## 3. Rutas

Ninguna nueva. `/inventario` (`INVENTORY_ROUTE`, `inventario.consultar`) y `/inventario/importar`
(`INVENTORY_IMPORT_ROUTE`, `inventario.modificar`) siguen con `requirePagePermission` en su primera
línea. Las pestañas enlazan a `productListHref(…)`.

## 4. Decisiones

**D1 — Cabecera de `/inventario` (R1, R2).** `page.tsx` pinta `PageShell` > `PageHeader` con
`title="Inventario"`, `titleTestId="inventario-title"` y `actions`: el `Link` «Importar» de hoy (con
`UploadIcon`, `buttonVariants({ variant: 'outline' })`, `touchTarget`, solo con `canImport`) y el
`ProductSheet` de alta. El `div` y el `h1` propios desaparecen; el `Suspense` queda dentro de
`PageShell`. `PageHeader` ya reparte las acciones a todo el ancho con 760 px o menos.

**D2 — Pestañas con `UrlTabs` (R3–R5).** `ProductTypeTabs` deja de ser un `Tabs` con
`onValueChange` y compone `UrlTabs` (`label="Filtrar por tipo de producto"`,
`testId="product-type-tabs"`). La dirección de cada pestaña sale de una función pura nueva en
`product-list-params.ts`:

```ts
export function productTypeTabHref(params: DataTableParams, type: ProductType | 'all'): string;
```

que hace lo mismo que el `handleChange` de hoy (página 1, filtro de tipo puesto o quitado, el resto
intacto). Desaparecen `onNavigate`, el `TabsContent` y sus dos textos (R4). Las pestañas siguen
dentro de `ProductTable` y `FinishedStockTable` (no se pintan en los estados que sustituyen a la
tabla, como hoy).

Coste: la navegación pasa a ser un `Link`, no un `router.push` dentro de la transición de la tabla,
así que el rótulo «Cargando productos…» de la tabla no sale al cambiar de pestaña (el contenido
anterior se queda hasta que llega el nuevo, que es lo que hace el App Router). Búsqueda, orden y
filtros siguen con su transición.

**D3 — Columnas y aviso (R6–R8).** En `product-columns.tsx` y `finished-stock-columns.tsx`:

- `align: 'end'` en `stock`, `qtyAlert`, `reserved` y `available` (QC-270 alinea la cabecera).
- La celda de `available` envuelve la cifra en `font-semibold`.
- `stockAmountCell(stock, label, alerted)` con `alerted` pinta `text-warning-text font-semibold`, un
  `TriangleAlert` `aria-hidden` delante, `title="Por debajo de la alerta de cantidad"` y el mismo texto
  en un `sr-only`; conserva `data-testid="product-stock"`, `data-alert="true"` y el `aria-label` de la
  cifra exacta. `packagedStockCell` igual. La regla sigue en `isBelowAlert` (no cambia).
- Constante exportada `BELOW_ALERT_LABEL = 'Por debajo de la alerta de cantidad'`.

**D4 — Menú como datos (R9–R11).** `product-row-actions.tsx` gana la función pura

```ts
export type ProductRowAction = 'batches' | 'history' | 'adjust' | 'edit' | 'delete';
export function productRowActionsSpec(input: {
  readonly product: ProductView;
  readonly units?: readonly UnitRef[];
  readonly canAdjust: boolean;
  readonly onAction: (action: ProductRowAction, product: ProductView) => void;
}): RowActionsSpec;
```

que devuelve los ítems en el orden del R9 (iconos `Layers`, `History`, `Scale`, `Pencil`, `Trash2`),
`adjust` solo con `canAdjust` (R10), `separatorBefore` y `destructive` en `delete`, los testids
(`product-batches-open`, `product-history-open`, `product-adjust-open`, `product-edit-open`,
`product-delete-open`), `triggerLabel` de `productRowActionsLabel(…)`, `triggerTestId`
`product-row-actions` y `title` = nombre del producto (lo usa el menú centrado). El
`triggerDataAttributes` `data-product-id` se conserva (lo pasa `RowActionsMenu`; si `RowActionsSpec`
no lo admite, se añade a su `Pick` en `data-table-types.ts`, cambio de tipo sin árbol nuevo).
`ProductRowActions` se conserva como `<RowActionsMenu {...productRowActionsSpec(…)} />` para sus tests
y exports.

**D5 — Un anfitrión por tabla (R11, R12).** Nuevo `product-row-dialogs.tsx` (cliente, interno de la
ruta, sin exportar en el barrel salvo que un test lo pida):

```ts
export type ProductRowDialogsProps = {
  readonly active: {
    readonly product: ProductView;
    readonly action: ProductRowAction;
    readonly loadBatches?: () => Promise<ProductBatchesResult>;
  } | null;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly units?: readonly UnitRef[];
  readonly canAdjust: boolean;
};
```

Monta, para el producto activo, el `ProductBatchesSheet`, el `ProductSheet` de edición o el
`DeleteProductDialog` de hoy, en modo controlado. Para `history` y `adjust` (R11) pide los lotes
(`loadBatches ?? listProductBatchesAction(product.id)`) y decide con la función pura

```ts
export function batchTarget(batches: readonly ProductBatchView[]): { kind: 'single'; batch: ProductBatchView } | { kind: 'choose' };
```

`single` abre `BatchHistory` o `AdjustBatchDialog` de ese lote; `choose` (cero o varios lotes) o un
error de lectura abren el `ProductBatchesSheet`, que pinta su propio error. Mientras se piden los
lotes no se abre nada y el disparador del menú ya ha devuelto el foco.

`ProductTable` y `FinishedStockTable` guardan `active` y `open`, montan **un** `ProductRowDialogs` y
declaran la columna con `actionsColumn({ id: ACTIONS_COLUMN_ID, label, defaultPinned: 'right', menu })`.
En «Producto terminado» la fila de grupo no tiene menú (`menu` devuelve un spec sin ítems y
`RowActionsMenu` no pinta nada) y cada línea pasa su `loadBatches` (`loadLineBatches` de hoy).
Al cerrar se deja `open: false` sin soltar `active`, para que el panel anime su salida, como hoy.

**D6 — Tarjetas (R13).** `ProductTable`:
`card={{ primary: IMAGE_COLUMN_ID, title: 'name', meta: ['stock', 'qtyAlert', 'available'] }}`;
`FinishedStockTable`: `card={{ primary: IMAGE_COLUMN_ID, status: 'orderNumber', title: 'name',
meta: ['stock', 'qtyAlert'] }}` (el conmutador de despliegue va dentro de la celda `name`, así que
también se pliega en tarjeta). `PRODUCT_TABLE_TEXTS` gana `cardActions: 'Acciones'` y
`closeMenu: 'Cerrar'`. El umbral es el de `DataTable` (P12).

Consecuencia que T0 mide: con `card`, cada celda y cada disparador del menú están **dos veces en el
DOM**. Los localizadores de página por `product-row-actions`, `product-stock` o
`data-table-cell-name` pasan a encontrar dos; se acotan a `data-table-row-<id>` o
`data-table-card-<id>`, como QC-265 y QC-262.

**D7 — Panel «Lotes» como tabla (R15–R20).** Nuevo `product-batch-columns.tsx`:

```ts
export function buildProductBatchColumns(deps: {
  readonly units?: readonly UnitRef[];
  readonly product?: Pick<ProductView, 'type' | 'unitId' | 'presentationId' | 'presentationName'>;
  readonly menu?: (batch: ProductBatchView) => RowActionsSpec;
}): readonly DataTableColumn<ProductBatchView>[];
```

con `lot`, `quantity` (con la línea de envases `product-batch-packages` debajo), `purchaseDate`,
`expiryDate`, `reserved`, `available` (`tabular`, cifras `align: 'end'`) y `actions`; las
funciones de cantidad de hoy (`formattedQuantity`, `exactQuantity`, `packageCountLabel`, unidad del
envase) se mudan a este archivo sin cambiar. «Sobre-reservado» va en la celda `lot` con
`StatusBadge tone="danger"` (P11).

`ProductBatchesPanel` conserva nombre, `data-testid="product-batches-panel"`, la línea de
presentación y el vacío, y monta `DataTable` con parámetros locales (el patrón de
`ImportRowsTable`: `createDefaultParams`, `searchable={false}`, paginación local), `getRowId =
batch.id` y `card={{ primary: 'lot', meta: ['quantity', 'reserved', 'available', 'purchaseDate',
'expiryDate'] }}`. Sus ranuras cambian: `renderBatchDetail` y `renderBatchActions` dejan paso a
`batchMenu?: (batch) => RowActionsSpec`. El identificador de fila `product-batch-<id>` pasa a ser el
`data-table-row-<id>` / `data-table-card-<id>` de la tabla (§ 7).

`ProductBatchesSheet` pinta `SheetHeader` con «Lotes» (etiqueta) sobre el `SheetTitle` de hoy y
`SheetContent` con `className="data-[side=right]:w-full data-[side=right]:sm:max-w-[900px]"` (P3; T0b
confirma el selector real de `components/ui/sheet.tsx`, que no se edita). El menú de cada lote
(«Historial» `batch-history-trigger`, «Ajustar existencia» `adjust-batch-open` solo con
`canAdjust`; disparador «Acciones del lote <lote>», `title` = lote) abre, encima del panel, el
`BatchHistory` o el `AdjustBatchDialog` de ese lote, en modo controlado; tras un ajuste se vuelven a
pedir los lotes (`fetchBatches`, como hoy).

**D8 — Historial en diálogo (R21–R23).** `BatchHistory` conserva nombre, archivo y exports
(`movementKindLabel`, `movementReasonLabel`) y cambia de `Collapsible` a `Dialog` controlado:

```ts
type BatchHistoryProps = {
  readonly batchId: string;
  readonly batchLot: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
};
```

Título «Historial del lote <lote>» (lote en `font-mono`), `DialogContent` hasta 1000 px. Pide los
asientos la primera vez que `open` pasa a `true`. Los asientos van en un `DataTable` local con las
ocho columnas del R21 (`card` con `primary: 'kind'`, `status: 'quantity'`, `meta` con el resto) y los
`data-testid` de hoy dentro de cada celda; un dato nulo pinta `EMPTY_MARK`. Se borra `TOUCH_TARGET`
(D41): el disparador del historial ya no existe en este archivo.

**D9 — Motivos con tilde (R24, R46).** `movementReasonLabel` deja de derivar la etiqueta del valor y
lee un `Record<MovementReason, string>` exhaustivo: `merma` «Merma», `rotura` «Rotura»,
`conteo_fisico` «Conteo físico», `error_de_carga` «Error de carga». Un motivo nuevo en el dominio
no compila hasta tener su texto. Enmienda a QC-92 (§ 10).

**D10 — Ajuste (R24–R26).** `AdjustBatchDialog` gana `open?`/`onOpenChange?` (sin ellos, el
disparador de hoy, para sus tests) y `productName?` para la descripción «<producto> · Lote <lote>».
«Existencia registrada» pasa a `Input disabled` con el valor de `formatDecimalDisplay(seenStock)`
(`data-testid="adjust-batch-recorded-stock"` sobre el campo). La diferencia va en un panel con
`ArrowDownToLine` / `ArrowUpFromLine`. «Elige un motivo.» deja de ir arriba y pasa a `FieldError`
bajo el selector (mismo `id`, `role="alert"`, `testId="adjust-batch-reason-error"`), con
`aria-invalid` en el disparador. Con `adjustment.direction === 'increase'` se pinta la ayuda del R26
(`data-testid="adjust-batch-increase-hint"`). El resto de avisos, el envío y el comportamiento de
sobre-reservado no cambian.

**D11 — Toasts (R27, R28).** `ImportCreateUnitDialog` y `ImportCreatePresentationDialog` llaman a
`toast.success('Unidad creada.')` / `toast.success('Presentación creada.')` antes de `onCreated()`
cuando el resultado es `success`. Textos en `import-texts.ts` (`UNIT_CREATED_TOAST`,
`PRESENTATION_CREATED_TOAST`). Test nuevo `inventario-toasts.test.tsx` con `sonner` simulado que
recorre los seis éxitos de la ruta y comprueba un único `toast.success` con su texto.

**D12 — Separador en `RowActionsMenu` (R14; P16).** Contrato de QC-262 D7, sin variante:
`RowActionMenuItem` gana `readonly separatorBefore?: boolean`; en el desplegable,
`DropdownMenuSeparator` antes del ítem; en el diálogo centrado, `Separator`; nunca delante del
primer ítem pintado; sin la prop, el árbol de hoy. T0a mira si QC-262 ya lo mergeó en `dev`:

- **Ya está en `dev`:** T1a se salta; esta ficha no toca `row-actions-menu.tsx` ni su fila.
- **No está:** T1a lo implementa con el test `row-actions-menu-separator.test.tsx` que QC-262 nombra
  y la fila del catálogo; QC-262 al rebasar lo encuentra hecho y reutiliza.

El leader avisa al dueño de QC-262 (mismo dueño hoy) antes de T1a para que no lo implementen las dos
a la vez.

**D13 — Importar: cabecera (R29, R30).** `importar/page.tsx` pinta `PageShell` > `ArrowLink
direction="back" href={INVENTORY_ROUTE} touch testId="inventory-import-back-link"` («Volver a
inventario») > `PageHeader` (`title`, `titleTestId`, `actions={<ImportTemplateButton />}`) > la
descripción en `<p>` > `InventoryImportScreen`. `ImportTemplateButton` sale de la tarjeta del paso 1.

**D14 — Barra de pasos (R31–R33).** Nuevo `importar/components/import-steps.tsx` (sin estado):

```ts
export type ImportStep = 1 | 2 | 3;
export function importStepOf(outcome: { readonly kind: string } | null): ImportStep; // preview → 2; imported | nothing_imported | already_imported → 3; resto → 1
export function ImportSteps({ current }: { readonly current: ImportStep }): JSX.Element;
```

`<ol aria-label="Pasos" data-testid="inventory-import-steps">` con tres `<li>`
(`data-testid="inventory-import-step-<n>"`): número en la pastilla redonda del contador de `UrlTabs`
(mismas clases), etiqueta, `aria-current="step"` en el vigente y el aspecto de pestaña activa;
contenedor `overflow-x-auto` sin salto de línea. `InventoryImportScreen` la pinta arriba con
`importStepOf(outcome)`. Cada paso entra con la animación de entrada existente (`motion-safe`).

**D15 — Importar: pasos 1 a 3 (R34–R41).**

- Paso 1: `Card` con `ImportUploadField` en forma de zona (borde discontinuo, icono, «.xlsx · .csv»
  cuando no hay archivo; fila con nombre `font-mono`, tamaño y «Elegir otro archivo» cuando lo hay).
  «Revisar archivo» gana `ArrowRight` y `Spinner` + `aria-busy` mientras revisa; el `role="status"`
  «Revisando el archivo…» se conserva. Sin arrastrar y soltar (P10).
- Paso 2: `Card` «Vista previa» (h2) con el nombre del archivo y `ImportTotals`, que gana
  `tones?: Partial<Record<TKey, StatusTone>>` → `text-success-text` / `text-info-text` /
  `text-warning-text` / `text-destructive-text` en el `dd` y `grid-cols-[repeat(auto-fit,minmax(130px,1fr))]`.
  `ImportMissingCatalog` en `Card` con borde `border-warning-border` e icono `TriangleAlert`,
  `grid @max-[760px]:grid-cols-1`. Los botones de `ImportPreviewSummary` se mueven al final, tras la
  tabla, apilados con 760 px o menos.
- Estado de fila: `ImportStatusLabel` compone `StatusBadge` con dos mapas de la ruta
  (`PREVIEW_STATUS_TONES`, `RESULT_STATUS_TONES`); los iconos de hoy se van; `data-testid` y
  `data-status` pasan al `StatusBadge`. Filtros: «Todas <n>» con `<span class="font-mono tabular-nums">`.
  `ImportRowsTable` pasa `card={{ primary: 'row', status: 'status', title: 'product', meta: ['detail'] }}`.
- Paso 3: `ImportResultSummary` / `ImportNothingImportedSummary` en `Card` con cabecera centrada
  (icono `CircleCheck` en `success` o `CircleAlert`, título, nombre del archivo, descripción de hoy),
  cifras de hoy, botones («Importar otro archivo» pasa a `default`) y la tabla debajo (P7).
  `ImportAlreadyDoneNotice` igual, dentro del paso 3.

**D16 — Guardia (R4, R7, R30, R46).** `tests/guards/guard-inventario-rediseno.test.ts`: en
`app/(private)/inventario/**` no aparecen «Elegi un motivo», «Conteo fisico», «Mostrando todos los
tipos», «Filtrando por»; `product-columns.tsx` y `finished-stock-columns.tsx` no pintan
`text-destructive` en la existencia; `importar/page.tsx` no monta un `Link` con
`IMPORT_BACK_LABEL` (usa `ArrowLink`); `batch-history.tsx` no declara `min-h-11 min-w-11`.
`guard-piezas-base.test.ts` retira la exclusión de `batch-history.tsx` (D41).

## 5. Contratos que cambian

| Símbolo | Antes | Después |
| --- | --- | --- |
| `ProductTypeTabs` | `params`, `onNavigate`; `Tabs` + texto de filtro | `params`; `UrlTabs` |
| `productTypeTabHref` | — | nuevo en `product-list-params.ts` |
| `stockAmountCell` | rojo `text-destructive` | ámbar, icono y texto «Por debajo de la alerta de cantidad» |
| `ProductRowActions` | arma ítems y monta paneles | envoltorio de `RowActionsMenu` sobre `productRowActionsSpec` |
| `productRowActionsSpec`, `ProductRowAction`, `ProductRowDialogs`, `batchTarget` | — | nuevos |
| Columna `actions` de las dos tablas | `cell` | `actionsColumn({ menu })` |
| `ProductTable`, `FinishedStockTable` | sin `card`, paneles por fila | `card` + anfitrión único |
| `ProductBatchesPanel` | lista `<ul>` con `dl`, ranuras `renderBatchDetail` / `renderBatchActions` | `DataTable` local, ranura `batchMenu` |
| `buildProductBatchColumns` | — | nuevo |
| `BatchHistory` | `Collapsible` con disparador propio | `Dialog` controlado (`open`, `onOpenChange`) |
| `movementReasonLabel` | derivada del valor | mapa exhaustivo con tildes |
| `AdjustBatchDialog` | disparador propio | + `open?`, `onOpenChange?`, `productName?` |
| `RowActionMenuItem` | sin separador | + `separatorBefore?` (QC-262 D7) |
| `ImportTotals` | sin tono | + `tones?` |
| `ImportStatusLabel` | icono + clase | `StatusBadge` con tono |
| `ImportSteps`, `importStepOf` | — | nuevos |

## 6. Snapshots y árboles que cambian (aceptados)

Toda diferencia de paridad que no esté aquí es un fallo de la tanda:

| Archivo | Cambio | Requisito |
| --- | --- | --- |
| `tests/unit/paridad/inventario-paridad.test.tsx` (+ `.snap`) | `PageHeader`, `UrlTabs` sin texto de filtro, columnas a la derecha, aviso ámbar, `actionsColumn`, tarjetas | R1, R3, R4, R6, R7, R9, R13 |
| `tests/unit/paridad/acciones-por-fila.test.tsx` (+ `.snap`) | «productos» y «producto terminado» ganan «Historial» y, con permiso, «Ajustar existencia» | R9, R10 |
| `tests/unit/paridad/confirmaciones-paridad.test.tsx` (+ `.snap`) | ninguno esperado (el borrado de producto no cambia); se lista porque lo monta | — |
| `tests/unit/paridad/campos-paridad.test.tsx` (+ `.snap`) | ninguno esperado (`DialogTextField` no cambia); se lista porque lo monta | — |

La tanda 0 no regenera nada; cada snapshot se actualiza en la tanda que cambia la pantalla y el
commit cita la fila.

## 7. Tests y E2E que se tocan (barrido con grep, 2026-10-13)

**Unitarios que cambian aserciones:**

| Test | Por qué |
| --- | --- |
| `tests/unit/inventario/product-page.test.tsx` | R5 de hoy: la pestaña ya no llama a `router.push`, es un enlace (se afirma su `href`); sin «Filtrando por»; R17 de hoy «en rojo» → ámbar con `data-alert`; menú con cinco ítems; duplicados de tabla y tarjeta |
| `tests/unit/inventario/finished-stock-table.test.tsx` | menú por línea, `card`, aviso ámbar |
| `tests/unit/inventario/product-batches-panel.test.tsx` | tabla en vez de lista, `batchMenu`, «Sobre-reservado» con `StatusBadge` |
| `tests/unit/inventario/product-batches-sheet.test.tsx` | etiqueta «Lotes», ancho, historial y ajuste desde el menú del lote |
| `tests/unit/inventario/batch-history.test.tsx` | diálogo controlado; «Conteo físico» |
| `tests/unit/inventario/adjust-batch-dialog.test.tsx` | «Conteo físico»; «Elige un motivo.» bajo el campo; existencia registrada como campo; modo controlado |
| `tests/unit/inventario-ui/envase-en-inventario.test.tsx` | lee el panel de lotes |
| `tests/unit/inventario/importar/inventory-import-screen.test.tsx`, `importar-page.test.tsx`, `import-preview.test.tsx`, `import-upload.test.tsx`, `import-missing-catalog.test.tsx` | pasos, cabecera, tarjetas, `StatusBadge`, contador sin paréntesis, toasts |
| `tests/unit/marca/tablas-marca.test.tsx` | R12 de QC-227: las cifras del panel de lotes dejan de ser `dd` (enmienda, § 10) |
| `tests/unit/marca/badges-estado.test.tsx` | R7 de QC-227: «Sobre-reservado» pasa a `StatusBadge` `danger` (enmienda) |
| `tests/unit/shared-ui/row-actions-menu-centrado.test.tsx` | sin `separatorBefore`, árbol de hoy (solo si T1a se hace aquí) |
| `tests/unit/shared-ui/catalogo-qc256.test.ts` | fila de `RowActionsMenu` con el punto de extensión (solo si T1a se hace aquí) |

**Tests nuevos:** `tests/unit/inventario/product-type-tabs.test.tsx` (R3, R4),
`product-row-actions.test.tsx` (R9, R10), `product-row-dialogs.test.tsx` (R11, R12),
`product-cards.test.tsx` (R13), `product-stock-alert.test.tsx` (R7, R8),
`inventario-toasts.test.tsx` (R27, R28), `tests/unit/inventario/importar/import-steps.test.tsx` (R31,
R32), `tests/unit/shared-ui/row-actions-menu-separator.test.tsx` (R14, si T1a se hace aquí) y
`tests/guards/guard-inventario-rediseno.test.ts` (R4, R7, R30, R46).

**E2E que cambian** (corren en el PR a producción; T7 los corre por spec):

| E2E | Qué cambia |
| --- | --- |
| `e2e/inventario.spec.ts` | `product-stock` y `data-table-cell-name` de página entera → acotar a `data-table-row-<id>` |
| `e2e/inventario-importar.spec.ts` | «Descargar plantilla» en la cabecera; barra de pasos; contador de filtros |
| `e2e/ajuste-de-inventario.spec.ts` | `product-row-actions` acotado; `product-batch-<id>` → `data-table-row-<id>`; «Historial» y «Ajustar existencia» desde el menú del lote; su mapa local `conteo_fisico: 'Conteo fisico'` → «Conteo físico» |
| `e2e/reserva-de-material.spec.ts` | `product-batch-<id>` → `data-table-row-<id>`; `batch-history-trigger` desde el menú del lote |
| `e2e/producto-terminado.spec.ts` | `[data-testid^="product-batch-"]` → fila de la tabla de lotes; `adjust-batch-open` desde el menú del lote |
| `e2e/insumo-por-unidad.spec.ts` | `product-batch-quantity` acotado a la fila visible del panel |
| `e2e/datos-de-lote-en-acondicionamiento.spec.ts` | `product-batch-<id>` → `data-table-row-<id>` |
| `e2e/aislamiento-inventario.spec.ts` | `product-row-actions` acotado a la fila visible |
| `e2e/helpers/row-actions-menu.ts` | solo si hace falta un ayudante para el menú del lote dentro del panel |

Los E2E que solo esperan `inventario-title` (`session`, `login`, `cierre-de-sesiones`,
`pedido-bloqueado`) no cambian: el `data-testid` se conserva.

**E2E nuevo:** `e2e/inventario-rediseno.spec.ts` (Chromium y WebKit), con medidas reales y no solo
árbol (lección de QC-269):

- a 1440 × 900: cabecera con «Importar» y «Nuevo producto» (R1); pestañas como enlaces (R3); cabecera
  y celda de «Existencia» con `text-align` derecho y misma `x` final (R6); celda en alarma con el color
  del token de advertencia y el icono (R7); menú con los cinco ítems, el separador y «Borrar»
  destructivo (R9, R14); «Historial» con un lote abre su diálogo y con dos abre «Lotes» (R11); panel
  «Lotes» con tabla y ancho ≤ 900 px (R15, R20); historial con tabla y cerrar deja el panel abierto
  (R21, R23); ajuste sin motivo → «Elige un motivo.» bajo el campo (R25);
- a 820 × 1180: tarjetas en la lista (R13, P12); pestañas sin desbordar (R5);
- a 390 × 844: tarjetas con «Acciones» de 44 px y menú centrado con ítems de 48 px (R13); lotes e
  historial en tarjetas (R19, R23); diálogos enteros y centrados (R42); sin desbordamiento horizontal
  en `/inventario` y en los tres pasos de la importación (R43); barra de pasos que se desplaza (R33);
- importación de un archivo de muestra (fixtures de `inventario-importar.spec.ts`): paso vigente 1 → 2
  → 3 → 1 (R31, R32), estados con tono (R38), toast «Unidad creada.» (R28).

Se da de alta en `E2E_ESPERADOS` de `tests/guards/guard-identificador-de-request.test.ts` y en la
lista cerrada de `tests/unit/shared/data-table-alcance.test.ts` (en su sitio alfabético), con el
comentario «Alta el <fecha> (QC-263) por el MISMO motivo y en el MISMO sitio que las demas: …», como
las de QC-265. Si `ajuste-de-inventario.spec.ts` pasa a nombrar `data-table-row-…`, también entra en
esa lista.

T0a repite el grep antes de tocar nada y lo deja en `progress/impl_QC-263.md`.

## 8. Alternativas descartadas

- **A1 — Mantener `Tabs` con `router.push` dentro de la transición de la tabla** (D2). Conserva el
  rótulo «Cargando productos…» al cambiar de pestaña, pero las pestañas no serían enlaces (ni abrir en
  otra pestaña ni funcionar sin JavaScript) y quedaría una segunda pieza de pestañas que navegan junto
  a `UrlTabs`, que QC-256 dejó como la única.
- **A2 — Seguir con la celda `cell` y poner las acciones en el pie de la tarjeta** (D4, D5). Cero cambio
  de dónde viven los paneles, pero la tarjeta pintaría el desplegable y no el «Acciones» centrado que
  pide D2, y cada fila seguiría montando su panel y dos diálogos, dos veces con la tarjeta (es la A1
  de QC-262).
- **A3 — Extender `FileField` con `.xlsx`** (P10). Tocaría `file-types.ts` y una pieza que usan recetas
  y proveedores para imágenes y PDF; `FileField` entrega bytes y la action de importar lee un `File`;
  y el `MIME` de un `.csv` en Windows (`application/vnd.ms-excel`) obligaría a reglas por extensión
  que hoy viven en el dominio de inventario.
- **A4 — Tablas de lotes e historial con `Table` y una lista de tarjetas propia** (D7, D8). Evita la
  paginación de `DataTable`, pero duplica en la ruta el modo tarjeta que `DataTable` ya trae; la
  importación ya resolvió una lista del cliente con `DataTable` y parámetros locales.
- **A5 — Barra de pasos como `tablist`**, como el marcado del tablero. Las pestañas prometen paneles
  que se eligen; aquí no se elige el paso (P6). Una lista ordenada con `aria-current="step"` dice lo
  que es.
- **A6 — «Lote principal» = el más antiguo o el primero que se consume** para «Historial» y «Ajustar»
  desde la fila (P1). Inventaría una regla de dominio que no existe; con varios lotes, abrir «Lotes»
  no adivina.
- **A7 — Separador propio del inventario, o automático antes del primer destructivo** (D12). El primero
  duplica la extensión de QC-262; el segundo cambia el árbol de todas las listas con menú sin sus
  fichas (A5 de QC-262).

## 9. Riesgos y coordinación

- **Duplicados de tabla y tarjeta** (D6, D7, D8): es el riesgo principal; nueve E2E localizan por
  testid de página. T0a los censa todos.
- **QC-262** (aprobado, sin implementar, mismo dueño): comparten
  `components/shared/row-actions-menu.tsx`, `components/shared/CATALOGO.md`,
  `tests/unit/shared-ui/row-actions-menu-separator.test.tsx`, `row-actions-menu-centrado.test.tsx`,
  `catalogo-qc256.test.ts` y las listas cerradas de `data-table-alcance.test.ts` y
  `guard-identificador-de-request.test.ts` (crecen por apéndice; el conflicto es de texto, no de
  diseño). D12 decide quién implementa el separador; `scripts/archivos-en-vuelo.mjs` lo verá por
  `## Archivos esperados`.
- **Umbral de tarjetas dentro del panel y del diálogo:** el contenedor del `DataTable` en el panel de
  900 px y en el diálogo de 1000 px queda por encima de 760 px en escritorio; a 820 de ventana el
  diálogo de historial puede caer en tarjetas. T0b lo mide; el E2E solo afirma tabla a 1440 y
  tarjetas a 390.
- **WebKit y el `Sheet` con diálogo encima:** el historial y el ajuste se abren sobre el panel con un
  segundo velo; el E2E nuevo corre en WebKit y cierra el diálogo comprobando que el panel sigue.
- **Gate rápido y listas cerradas:** lección de QC-261/QC-265; T7 cierra con `./init.sh --completo`.

## 10. Enmiendas a specs cerrados

| Spec | Qué cambia | Por qué |
| --- | --- | --- |
| QC-92 (`batch-history.test.tsx`, `adjust-batch-dialog.test.tsx`; `progress/impl_QC-92` «coste declarado: sin tilde») | `movementReasonLabel` deja de derivar y lleva tildes: «Conteo físico» | D9 del humano |
| Pantalla de productos (`product-page.test.tsx`: su R5 de la pestaña y su R17 «en rojo»; T0a anota el spec de origen) | La pestaña es un enlace; la alarma de existencia es ámbar con icono, no roja | D3, D14 |
| QC-227 (`tablas-marca.test.tsx` R12; `badges-estado.test.tsx` R7) | Las cifras del panel de lotes van en celdas de tabla; «Sobre-reservado» es `StatusBadge` `danger` | D3 |
| QC-209 (`importar-page.test.tsx`, `import-preview.test.tsx`, `inventario-importar.spec.ts`) | Volver con flecha, plantilla en la cabecera, barra de pasos, contador sin paréntesis, estados con `StatusBadge` | D2, D3, D6 |
| QC-55 (`tests/unit/shared/data-table-alcance.test.ts`) | La lista cerrada de E2E gana `e2e/inventario-rediseno.spec.ts` | § 7 |

## 11. Deudas

- **D41** se resuelve (P15).
- **D53** se amplía a `/inventario` si T0b ve que su esqueleto no casa con la tabla en tarjetas.
- **Nuevas, si las preguntas quedan por defecto:** vencimiento «por vencer» (P9), arrastrar y soltar en
  la importación (P10), formato de cifras y fechas del tablero (P4), icono del diálogo de borrado
  (compartida con QC-262 P5).

## Dependencias de terceros

Ninguna nueva. `@base-ui/react` (Tabs, Menu, Dialog, Sheet, Select), `sonner`, `lucide-react` y
`@tanstack/react-table` ya están.
