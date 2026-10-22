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
| **QC-262 (aprobado, sin implementar)** extiende `RowActionsMenu` con `separatorBefore` por ítem | `.worktrees/QC-262-rediseno-pedidos/specs/QC-262-rediseno-pedidos/design.md > D7`, su R14 | Mismo contrato, sin variante propia (D12, P16). **2026-10-16: ya en `dev` (a6a224e5)**, con su test y su fila del catálogo |
| **Enmienda 2026-10-16 — en `dev` desde el spec:** sub-filas de lote desplegables (f978ef29), columnas «Costo» (b0eaa866), «Tipo» (6f08e379) y «Presentación» con nombre sin presentación (c2ac0e65), vencimiento relativo y chip «Vencido» (08b69744), panel de lotes en tres líneas (ccde16f7), `movementReasonLabel` en su archivo con «Conteo físico» (ded3d3d8, QC-281), guía de importación y aviso de columnas ignoradas (c4f824fe, 6cc59959), toasts del desenlace de importación (da435d96), enlace a la ficha de producto terminado (f34f8bb7) | `product-columns.tsx`, `product-table.tsx`, `expiry-date.tsx`, `expiry-warning.ts`, `product-batches-panel.tsx`, `movement-reason-label.ts`, `import-guide.tsx`, `import-preview-summary.tsx`, `inventory-import-screen.tsx`, `finished-stock-columns.tsx` | Se conservan; el rediseño los incluye (§ 12, R47–R53) |
| **Enmienda 2 (2026-10-16) — en `origin/dev` después del primer merge:** «Costo unitario» solo para quien cumple `canViewUnitCosts` (el servidor no lo envía a los demás), en moneda con `formatMoneyDisplay` y exacto en `title` (6a665e3f), con la unidad del producto (5496bd16), al final antes de las acciones y nuevo orden de cifras (fb140780); «Presentación» fuera de la pestaña «Producto» (`showPresentation`); esqueleto de 8 columnas; QC-52 R35–R37 y la ficha de `InventarioMovil` enmendadas (070a8c71); `tablas-marca.test.tsx` tocado por 0f71d5af (pedidos) | `product-columns.tsx` (`showCost`, `showPresentation`, `unitCostCell`, `COST_COLUMN_LABEL`), `product-table.tsx`, `product-list-section.tsx`, `page.tsx`, `product-columns-skeleton.ts`, `lib/modules/inventario` (`canViewUnitCosts`) | Se conservan; el rediseño se monta encima (§ 12 > Enmienda 2, R53, R54) |
| `DataTableCards` ya tiene hueco `footer` (columna a la izquierda de «Acciones») y cada celda lleva `data-table-cell-<id>` / `data-table-head-<id>` | `components/shared/data-table/data-table-cards.tsx`, `data-table.tsx`, `data-table-header-menu.tsx` | «Mostrar lotes» va en `footer` sin tocar la pieza (§ 12 > Enmienda 2 > F4) |
| `:has()` ya se usa en el repo para estilar desde fuera (pantallas del operario) | `app/globals.css` | Precedente del fondo de las sub-filas desde la ruta (F5) |
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

- `align: 'end'` en `stock`, `averageUnitCost`, `qtyAlert`, `reserved` y `available` (QC-270 alinea
  la cabecera); `type` y `presentationName` siguen en `start` *(enmienda 2026-10-16, P18)*. Las
  sub-filas de lote comparten columna, así que heredan la alineación sin código propio.
- La celda de `available` de la fila `product` envuelve la cifra en `font-semibold` (la sub-fila
  de lote no).
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
*Enmienda 2026-10-16 (f978ef29):* en `ProductTable` las filas son `ProductTableRow`; `menu`
devuelve el spec del producto solo con `row.kind === 'product'` y un spec sin ítems con `batch` y
`batchesStatus` (R12), igual que hace hoy la celda `cell`. `ProductColumnsDeps.rowActions` pasa a
`menu: (product: ProductView) => RowActionsSpec`. La lectura del R11 es `listProductBatchesAction`
(todos los lotes), no `listAliveProductBatchesAction` (la de las sub-filas, solo vivos): no se
reutiliza la caché de las sub-filas para decidir `batchTarget`.
Al cerrar se deja `open: false` sin soltar `active`, para que el panel anime su salida, como hoy.

**D6 — Tarjetas (R13).** *Enmienda 2 (2026-10-16): el `card` de `ProductTable` es el de
§ 12 > Enmienda 2 > F3/F4, que sustituye al de E1 y a la línea siguiente. Enmienda 2026-10-16 (P17,
P18): tablero aprobado el 2026-10-16 (§ 12).* `ProductTable`:
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
`expiryDate` (celda = `ExpiryDate` de hoy, con relativo y chip; enmienda 2026-10-16, § 12 > E3),
`reserved`, `available` (`tabular`, cifras `align: 'end'`) y `actions`; las
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

**D8 — Historial en diálogo (R21–R23, R52).** `BatchHistory` conserva nombre, archivo y su export
`movementKindLabel` (*enmienda 2026-10-16:* `movementReasonLabel` ya no sale de aquí desde
ded3d3d8; vive en `movement-reason-label.ts` y el barrel `components/index.ts` la exporta desde
ese archivo, que es lo que lee `finished-product-route-contract.test.ts`) y cambia de
`Collapsible` a `Dialog` controlado:

```ts
type BatchHistoryProps = {
  readonly batchId: string;
  readonly batchLot: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
};
```

Título «Historial del lote <lote>» (lote en `font-mono`), `DialogContent` hasta 1000 px con
`className="sm:max-w-[min(1000px,calc(100%-2rem))]"` (*enmienda 2026-10-16*, § 12 > E7; nunca
`sm:max-w-[1000px]`, que toca los bordes entre 640 y 1032 px y rompe R42/R52). Pide los
asientos la primera vez que `open` pasa a `true`. Los asientos van en un `DataTable` local con las
ocho columnas del R21 (`card` con `primary: 'kind'`, `status: 'quantity'`, `meta` con el resto) y los
`data-testid` de hoy dentro de cada celda; un dato nulo pinta `EMPTY_MARK`. Se borra `TOUCH_TARGET`
(D41): el disparador del historial ya no existe en este archivo.

**D9 — Motivos con tilde (R24, R46).** En `movement-reason-label.ts` (*enmienda 2026-10-16:* QC-281
ya puso ahí un mapa parcial `ACCENTED_LABELS` con «Conteo físico»), `movementReasonLabel` deja de
derivar la etiqueta del valor y lee un `Record<MovementReason, string>` exhaustivo: `merma` «Merma», `rotura` «Rotura»,
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

*Enmienda 2026-10-16:* se dio el primer caso. QC-262 lo mergeó (a6a224e5): `separatorBefore` en
`components/shared/row-actions-menu.tsx`, su test `row-actions-menu-separator.test.tsx` y la fila del
catálogo. Esta ficha no toca la pieza ni su fila.

**D13 — Importar: cabecera (R29, R30).** `importar/page.tsx` pinta `PageShell` > `ArrowLink
direction="back" href={INVENTORY_ROUTE} touch testId="inventory-import-back-link"` («Volver a
inventario») > `PageHeader` (`title`, `titleTestId`, `actions={<ImportTemplateButton />}`) > la
descripción en `<p>` > `InventoryImportScreen` > `ImportGuide`. `ImportTemplateButton` sale de la
tarjeta del paso 1. *Enmienda 2026-10-16 (c4f824fe, 6cc59959, 05f0d0af):* `ImportGuide values={values}`
se queda debajo de la pantalla de pasos, fuera de la barra, sin cambio propio (R49, P21); la página
conserva `requirePagePermission` en la primera línea, `requirePageAddon('importacion_excel')` en la
segunda y la lectura en paralelo de unidades y valores de la guía.

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
  tabla, apilados con 760 px o menos. *Enmienda 2026-10-16 (R50, P21):* el orden del paso 2 es
  cifras → avisos de hoy (`ExampleRowIgnoredNotice`, `IGNORED_COLUMNS_SUMMARY_TESTID`,
  `NO_VALID_ROWS_TESTID` o `PARTIAL_IMPORT_NOTICE`, sin cambio) → faltantes → filtros y tabla →
  botones. El aviso por fila (`ROW_IGNORED_COLUMNS_TESTID`) sigue dentro de la celda `detail`, que
  es la `meta` de la tarjeta.
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
`text-destructive` en la existencia (*enmienda 2026-10-16:* la regla mira **solo** el cuerpo de
`stockAmountCell` y de `packagedStockCell`, no el archivo entero: `product-columns.tsx` pinta con
derecho `text-destructive` el error de la sub-fila, `product-batches-row-error-message`); con P19
por defecto, `expiry-date.tsx` no declara `text-destructive` en `EXPIRING_CLASS`; `importar/page.tsx` no monta un `Link` con
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
| `ProductColumnsDeps.rowActions` *(enmienda)* | `(product) => ReactNode` en la celda `cell` | `menu: (product) => RowActionsSpec`; sub-filas sin ítems |
| `EXPIRING_CLASS` *(enmienda, P19)* | `'font-semibold text-destructive'` | `'font-semibold text-warning-text'` |
| `ProductBatchesPanel` líneas *(enmienda)* | `product-batch-line-lot/-amounts/-dates` (ccde16f7) | desaparecen; celdas de tabla (P20) |
| `buildProductColumns` *(enmienda 2)* | `showCost`, `showPresentation` de `dev`; cifras centradas | se conservan; cifras y «Costo unitario» `align: 'end'`; + columna `batchesToggle` (F4); celdas con rótulo de tarjeta (F3) |
| `cardFieldLabel` *(enmienda 2)* | — | nuevo, interno de la ruta (`card-field-label.tsx`): rótulo visible solo en la tarjeta |
| `PRODUCT_TABLE_SCOPE_CLASS` *(enmienda 2)* | — | nuevo en `product-table.tsx`: estilo de la ruta sobre el `DataTable` (oculta `batchesToggle` en la tabla y el chevrón en la tarjeta, fondo y entrada de sub-filas) |
| `ImportPreviewSummary` *(enmienda 2)* | sin vuelta atrás | + `onChooseAnother: () => void`, botón «Elegir otro archivo» en la cabecera |

## 6. Snapshots y árboles que cambian (aceptados)

Toda diferencia de paridad que no esté aquí es un fallo de la tanda:

| Archivo | Cambio | Requisito |
| --- | --- | --- |
| `tests/unit/paridad/inventario-paridad.test.tsx` (+ `.snap`) | `PageHeader`, `UrlTabs` sin texto de filtro, columnas a la derecha (también «Costo», enmienda), aviso ámbar, vencimiento cercano en ámbar (P19), `actionsColumn`, tarjetas. La base es el snapshot que `dev` regeneró (c2ac0e65, f978ef29, 08b69744, b0eaa866), no el de `f7cc5be2`. *Enmienda 2:* la base vuelve a ser la de `origin/dev` tras 6a665e3f, 5496bd16 y fb140780 (orden de columnas, «Costo unitario» solo con permiso, sin «Presentación» en «Producto»); encima, rótulos de tarjeta, columna `batchesToggle` oculta en la tabla, «Mostrar lotes» al pie y la clase de ámbito de la ruta | R1, R3, R4, R6, R7, R9, R13, R48, R53, R54, R55, R57, R58 |
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
| ~~`tests/unit/shared-ui/row-actions-menu-centrado.test.tsx`~~ | no aplica: T1a no se hace aquí (a6a224e5) |
| ~~`tests/unit/shared-ui/catalogo-qc256.test.ts`~~ | no aplica: T1a no se hace aquí (a6a224e5) |
| `tests/unit/inventario/product-batch-rows.test.tsx` *(enmienda; de dev)* | monta `ProductTable` con sub-filas: con `card` sus celdas salen dos veces (se acota a `data-table-row-…`); la columna de acciones pasa a `menu`; «Costo» a la derecha; vencimiento en ámbar (P19) |
| `tests/unit/inventario/product-type-column.test.tsx` *(enmienda; de dev)* | monta `ProductTable`: duplicados de tarjeta; «Tipo» en la tarjeta como estado |
| `tests/unit/shared-ui/confirm-dialog-montado.test.tsx` *(enmienda)* | monta `ProductTable` y abre el borrado: el diálogo pasa al anfitrión (D5) y el disparador sale dos veces (D6) |
| `tests/unit/inventario/producto-terminado/finished-product-route-contract.test.ts` *(enmienda)* | lee de dónde exporta el barrel `movementReasonLabel`: debe seguir siendo `movement-reason-label.ts`; sin cambio esperado |
| `tests/unit/inventario/importar/import-guide.test.tsx` *(enmienda; de dev)* | sin cambio esperado: la guía no cambia (R49) |
| `tests/unit/inventario/importar/inventory-import-screen.test.tsx` *(enmienda)* | sus casos de toasts de da435d96 (+110) se conservan (R51) |

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
| `e2e/ajuste-de-inventario.spec.ts` | `product-row-actions` acotado; `product-batch-<id>` → `data-table-row-<id>`; «Historial» y «Ajustar existencia» desde el menú del lote; ~~su mapa local `conteo_fisico: 'Conteo fisico'` → «Conteo físico»~~ (ya hecho por QC-281, ded3d3d8) |
| `e2e/reserva-de-material.spec.ts` | `product-batch-<id>` → `data-table-row-<id>`; `batch-history-trigger` desde el menú del lote |
| `e2e/producto-terminado.spec.ts` | `[data-testid^="product-batch-"]` → fila de la tabla de lotes; `adjust-batch-open` desde el menú del lote |
| `e2e/insumo-por-unidad.spec.ts` | `product-batch-quantity` acotado a la fila visible del panel |
| `e2e/datos-de-lote-en-acondicionamiento.spec.ts` | `product-batch-<id>` → `data-table-row-<id>` |
| `e2e/aislamiento-inventario.spec.ts` | `product-row-actions` acotado a la fila visible |
| `e2e/helpers/row-actions-menu.ts` | solo si hace falta un ayudante para el menú del lote dentro del panel |

Los E2E que solo esperan `inventario-title` (`session`, `login`, `cierre-de-sesiones`) no cambian:
el `data-testid` se conserva. *Enmienda 2026-10-16:* `pedido-bloqueado` **no** es de ese grupo
(estaba mal aquí): busca filas `[data-testid^="data-table-row-"]` con `product-stock` dentro (líneas
160 y 192). No le afectan las tarjetas (`data-table-card-…` no casa con el prefijo) ni las sub-filas
(pintan `batch-stock`), así que no se espera cambio, pero T7b lo corre. `e2e/helpers/product-name-cell.ts`
usa el mismo prefijo, que también casa con las sub-filas `<id>--batch-<lote>`; T3 lo revisa.

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
- *Enmienda 2026-10-16:* a 1440, desplegar los lotes de un producto pinta sus sub-filas sin menú
  (R47, R12) y «Costo» con `text-align` derecho (R6); un lote que vence en menos de 30 días pinta la
  fecha con el color del token de advertencia, no el de error (R48); a 820 de ventana el diálogo de
  historial deja ≥ 16 px a cada lado (R52); a 390, las sub-filas desplegadas salen como tarjetas
  debajo de la del producto, sin «Acciones» (R47); la guía de importación sigue debajo en los tres
  pasos (R49).

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
- **A8 — Sacar las sub-filas de lote de la vista en tarjetas** (enmienda, P17), con un filtro de
  filas nuevo en `DataTableCards` (`cardRows?: (row) => boolean`) o plegando todo al pasar a
  tarjeta. Daría tarjetas más limpias, pero tocaría una pieza compartida (paso 2 de la regla de
  decisión, con fila de catálogo y tablero propio) y en teléfono se perdería una función que `dev`
  ya trae: la regla de la enmienda es conservarla.
- **A9 — Dejar «Costo» centrada como la dejó b0eaa866** (enmienda, P18). Cero cambio en sus tests,
  pero quedaría la única cifra centrada entre cifras a la derecha, que es justo lo que el commit
  quería evitar («como el resto de la tabla»).
- **A10 — Conservar las tres líneas de ccde16f7 en el panel «Lotes»** (enmienda, P20). Cero cambio en
  sus tests, pero el tablero aprobado (D14) dibuja una tabla con menú por lote, y la lista no tiene
  dónde poner el menú ⋯ del R18 ni las tarjetas del R19 sin reinventar `DataTable`.
- **A11 — Mantener el rojo de `dev` en «por vencer»** (enmienda, P19). Es lo que hay hoy, pero D3
  (cerrada) reserva el rojo para el error, y el tablero pinta el vencimiento cercano con el token de
  advertencia (`--w-fg` en `ModalesInventario`, lote `L-2026-0921`). Queda como alternativa si el
  humano lo elige en P19.
- **A12 — Extender `DataTableCards` con rótulos por campo y un hueco de pie propio** (enmienda 2,
  H2·H3). Sería lo limpio (paso 2 de la regla de decisión: `card.labels`, fila de catálogo y
  tablero), pero H2·H3 piden expresamente hacerlo dentro de la ruta sin tocar el `DataTable`
  compartido, y lo usan las demás listas del rediseño. Queda como deuda si una segunda ruta lo
  necesita (§ 11).
- **A13 — Conmutador de lotes en una columna propia visible en la tabla** (enmienda 2, R58). Evita
  ocultar la columna desde la ruta, pero añade al escritorio una columna vacía de cabecera que el
  tablero no tiene (el chevrón va dentro de «Nombre»).
- **A14 — Rótulos con la consulta de contenedor `@max-[760px]`** (enmienda 2, R55). Depende de que el
  contenedor más cercano de la celda sea el mismo que decide tabla o tarjeta; ocultarlos con
  `[table_&]:hidden` no depende de eso y vale igual dentro del panel y del diálogo.
- **A15 — «Elegir otro archivo» que abre directamente el selector de archivos** (enmienda 2, R59).
  Ahorra un clic, pero si la persona cancela el selector se queda en el paso 2 con una vista previa
  de un archivo que ya no quiere, y el paso 1 ya tiene su zona de archivo; H5 dice «vuelve al paso 1».

## 9. Riesgos y coordinación

- **Duplicados de tabla y tarjeta** (D6, D7, D8): es el riesgo principal; nueve E2E localizan por
  testid de página. T0a los censa todos.
- **QC-262** — *resuelto el 2026-10-16: mergeó `separatorBefore` (a6a224e5); esta ficha ya no toca
  `row-actions-menu.tsx`, su test ni su fila; quedan solo las listas cerradas por apéndice.* Texto
  original: (aprobado, sin implementar, mismo dueño): comparten
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
| *(enmienda 2026-10-16)* ccde16f7, sin ficha (`product-batches-panel.test.tsx`, +59) | Las aserciones de las tres líneas (`product-batch-line-*`) se sustituyen por las de la tabla; las de vencimiento relativo y «Vencido» (08b69744) se conservan en la celda | P20, D14 |
| *(enmienda 2026-10-16)* 08b69744, sin ficha (`product-batch-rows.test.tsx`, `product-batches-panel.test.tsx`) | «Por vencer» pasa de rojo a ámbar; regla y textos iguales | P19, D3 |
| *(enmienda 2026-10-16)* b0eaa866, sin ficha (`product-batch-rows.test.tsx`, `product-page.test.tsx`, `tablas-marca.test.tsx`) | «Costo» pasa de centrada a la derecha | P18, R6 |

## 11. Deudas

- **D41** se resuelve (P15).
- **D53** se amplía a `/inventario` si T0b ve que su esqueleto no casa con la tabla en tarjetas.
  *T0b lo vio (2026-10-16):* esqueleto de 9 columnas sin tarjeta; la tabla real tiene 10 en «Todos»,
  9 con un tipo filtrado y 7 en «Producto terminado» (P22).
  *Enmienda 2:* tras el merge de `origin/dev` el esqueleto pinta 8 columnas
  (`PRODUCT_SKELETON_COLUMN_COUNT`) y la tabla depende de la pestaña y del permiso de costo (y gana
  la columna `batchesToggle`, oculta en la tabla). T8h vuelve a medirlo y corrige los números de
  D53.
- **D55** se amplía (enmienda 2, m3 del review): en `/inventario` hay dos cierres locales de 44 px
  (`showCloseButton={false}` más un `DialogClose` propio `size="icon"` + `touch`, como
  `batch-evidence-dialog.tsx`) en `batch-history.tsx` y `adjust-batch-dialog.tsx`, que se retiran
  cuando se arregle la primitiva; y la X de 32 px del `Sheet` «Lotes» sigue (preexistente, no la
  añade esta ficha). T8h lo escribe en `progress/deudas.md`.
- **Nueva, si A12 se descarta para siempre:** rótulos y pie de tarjeta hechos en la ruta
  (`cardFieldLabel`, columna `batchesToggle` oculta, `PRODUCT_TABLE_SCOPE_CLASS`). Si otra ruta los
  necesita, se suben a `DataTableCards` (paso 2) y se retira el apaño. T8h la abre.
- **Nuevas, si las preguntas quedan por defecto:** vencimiento «por vencer» (P9), arrastrar y soltar en
  la importación (P10), formato de cifras y fechas del tablero (P4), icono del diálogo de borrado
  (compartida con QC-262 P5).

## 12. Enmienda 2026-10-16

El spec se escribió sobre `f7cc5be2` (2026-10-13). El merge de `origin/dev` en la rama (`d8b82a1d`)
trajo funciones de inventario posteriores, que el implementer censó en
`progress/impl_QC-263.md > Cambios de dev posteriores al spec` antes de la tanda 2. **Regla: lo que
`dev` ya trajo se conserva y el rediseño lo incluye.** No se reabre ninguna decisión cerrada; donde
lo mergeado choca con una (D3 en E4) queda una pregunta abierta con opción por defecto
(`requirements.md > Preguntas de la enmienda 2026-10-16`, P17–P22; cerradas por el humano el
2026-10-16 con esa opción).

**Qué está en el tablero y qué no.** Comprobado contra `docs/diseno/canvas/Inventario.dc.html`,
`InventarioTablet`, `InventarioMovil`, `InventarioImportar*` y `ModalesInventario.dc.html`:

| Lo mergeado | ¿En el tablero? |
| --- | --- |
| Sub-filas de lote desplegables y su conmutador (f978ef29) | **No.** La lista del tablero tiene una fila por producto |
| Columnas «Tipo», «Presentación», «Costo» de la lista (6f08e379, c2ac0e65, b0eaa866) | **No.** La lista del tablero tiene Imagen, (# Pedido), Nombre, Existencia, Alerta, Reservado, Disponible y acciones. «Costo» y «Presentación» solo salen como campos del formulario de producto |
| Vencimiento cercano resaltado (08b69744) | **Sí, en ámbar** (`--w-fg`, `ModalesInventario`, lote `L-2026-0921`). El texto relativo y el chip «Vencido» **no** |
| Panel de lotes en tres líneas (ccde16f7) | **No.** El tablero dibuja una tabla |
| Guía de importación (c4f824fe, 6cc59959) | **No** |
| Aviso de columnas ignoradas (6cc59959) | **No** |
| Toasts del desenlace de importación (da435d96) | Parcial: el tablero solo dibuja «Unidad creada.» y «[Presentación creada.]» |

**Decisión del humano (2026-10-16):** P17–P22 cerradas con la opción por defecto
(`requirements.md > Decisiones cerradas`). P17 y P18 **sí** requieren pase `/design`: el leader lo
hace en el canvas sobre `Inventario`, `InventarioTablet` e `InventarioMovil` (sub-filas de lote en
tabla y en tarjeta; columnas «Tipo», «Presentación» y «Costo» en la tabla y en la tarjeta).
**Tablero aprobado por el humano el 2026-10-16:** `docs/diseno/canvas/InventarioColumnasLotes.dc.html`
(+ `InventarioColumnasLotesTablet`, `InventarioColumnasLotesMovil`, con su ficha). El pase se hizo
en un tablero propio, no sobre `Inventario`, y sigue lo que ya hace dev:
- «Costo» es el costo unitario (b0eaa866);
- todos los productos llevan el chevrón «Mostrar lotes de X», con sus estados de carga, error y
  «Sin lotes con existencia.» (f978ef29).

T2c y la tanda 3 quedan libres (`tasks.md`). La guía y los avisos no cambian de aspecto ni llevan pase (P21).

**Cambios, cada uno con su commit de origen:**

| # | Commit | Qué cambia en el spec | Dónde | R / P |
| --- | --- | --- | --- | --- |
| E1 | f978ef29, 6f08e379, c2ac0e65, b0eaa866 | **Tarjeta de `ProductTable`.** Sustituye la de D6: `card={{ primary: IMAGE_COLUMN_ID, status: showType ? 'type' : undefined, title: 'name', meta: ['presentationName', 'stock', 'averageUnitCost', 'qtyAlert', 'available'] }}` (un `useMemo` sobre `showType`). `FinishedStockTable` añade `'presentationName'` al principio de su `meta`. Las sub-filas `batch` y `batchesStatus` salen como tarjeta de `DataTable` sin extensión: título = su celda `name` (el `dl` del lote o el estado con «Reintentar»), `meta` = sus cifras, sin imagen ni «Acciones» porque su `menu` no tiene ítems. El `pl-12` de esas celdas puede quitarse en tarjeta (`@max-[760px]:pl-0`) sin otro cambio | D6 | R13, R47; P17, P18 |
| E2 | f978ef29 | **Menú solo en la fila de producto.** `menu` devuelve un spec sin ítems para `batch` y `batchesStatus`; `rowActions` pasa a `menu` | D5 | R12 |
| E3 | b0eaa866 | **«Costo» a la derecha** con las demás cifras; «Tipo» y «Presentación» a la izquierda. Las celdas de sub-fila heredan la alineación de su columna | D3 | R6; P18 |
| E4 | 08b69744 | **«Por vencer» en ámbar.** `EXPIRING_CLASS` pasa a `'font-semibold text-warning-text'`: afecta a la fecha de la sub-fila, a la del panel y al nombre del producto. «Vencido» sigue en `StatusBadge` `danger`. Regla (`isExpiringSoon`, 30 días), textos y `data-expiring`/`data-expired` iguales. **Choca con D3 cerrada si se dejara en rojo; no se cambia D3** | `expiry-date.tsx` | R48; P19 |
| E5 | ccde16f7, 08b69744 | **Panel «Lotes» como tabla** (D7 se mantiene). Las tres líneas `product-batch-line-*` desaparecen. La celda `expiryDate` pinta `ExpiryDate`, que hoy devuelve un `<dd>` (inválido en una celda de tabla): gana `as?: 'dd' \| 'span'` con defecto `'dd'`, así la sub-fila (que sí está en un `dl`) no cambia y la tabla pasa `'span'`. Se conservan `product-batch-expiry-date`, `-expiry-relative` y `-expired` | D7, `expiry-date.tsx` | R15; P20 |
| E6 | ded3d3d8 (QC-281) | **`movementReasonLabel` vive en `movement-reason-label.ts`**, con un mapa parcial de tildes. D8 deja de citarla como export de `batch-history.tsx`; D9 sustituye ahí el mapa parcial por el exhaustivo. El barrel la sigue exportando desde ese archivo. «Conteo fisico» ya no sale en producción; la guardia lo mantiene. El mapa local de `e2e/ajuste-de-inventario.spec.ts` ya está hecho | D8, D9, § 7 | R24, R46 |
| E7 | — (medida de T0b) | **Clase del tope del historial.** `sm:max-w-[min(1000px,calc(100%-2rem))]`, el patrón del repo (`sm:max-w-[min(90vw,64rem)]`). Con ella, a 820 de ventana el diálogo mide 788 y su contenido 756: el historial sale en tarjetas a 820, que R23 admite | D8 | R23, R42, R52 |
| E8 | c4f824fe, 6cc59959, 05f0d0af | **Importar: guía y cortes.** `ImportGuide` debajo de `InventoryImportScreen`, dentro de `PageShell`, sin cambio propio; `requirePageAddon` en la segunda línea | D13 | R29, R49; P21 |
| E9 | 6cc59959 | **Avisos del paso 2** entre cifras y faltantes; aviso por fila en «Detalle» (y en la tarjeta); aviso de fila de ejemplo también en el paso 3 | D15 | R50; P21 |
| E10 | da435d96 | **Toasts del desenlace de importación** conservados. El test de T6a cuenta con ellos: tras crear una unidad o una presentación, la nueva revisión llega a vista previa y no avisa, así que el único `toast.success` es el del alta y no hay `toast.error`; si la revisión se rechaza, sale además el `toast.error` del rechazo, que es de R51 y no de R28. El paso 3 y el toast de éxito dicen lo mismo: se aceptan los dos (uno pasa, el otro queda) | D11, T6a | R28, R51 |
| E11 | f34f8bb7 (QC-225) | El nombre de la línea de «Producto terminado» enlaza a la ficha; en la tarjeta el título lleva el enlace y el conmutador | D6 | R13, R53 |
| E12 | f978ef29 | **Lectura del R11**: `listProductBatchesAction`, no la de las sub-filas (`listAliveProductBatchesAction`, solo vivos) | D5 | R11 |
| E13 | 08b69744, f978ef29 | **Guardia D16 acotada** al cuerpo de `stockAmountCell` y `packagedStockCell`; con E4, `EXPIRING_CLASS` sin `text-destructive` | D16 | R7, R48 |
| E14 | 6f08e379 | **D53:** esqueleto de 9 columnas y sin tarjeta contra 10 / 9 / 7 columnas reales. Se amplía la deuda, no se arregla | § 11 | P22 |
| E15 | — (censo T0a) | **§ 7 corregido:** `pedido-bloqueado.spec.ts` nombra `product-stock`; nuevos en el censo `product-batch-rows.test.tsx`, `product-type-column.test.tsx`, `confirm-dialog-montado.test.tsx`, `finished-product-route-contract.test.ts`, `import-guide.test.tsx`, `e2e/helpers/product-name-cell.ts` | § 7, `tasks.md` | R45 |
| E16 | a6a224e5 (QC-262) | **D12 resuelta:** `separatorBefore` ya en `dev`; T1a y T1b no aplican | D12, § 9 | R14, R44 |
| E17 | 325aa378, 4714563e, af613689, 17978345, e002f8b9 | Sin efecto: la plantilla `.xlsx` sigue siendo un botón (D13 lo mueve igual); el formulario de producto está fuera; el orden por último lote es de persistencia y D2 conserva el orden de la URL | — | — |

**Requisitos antes de la enmienda** (para el reviewer): R6 no nombraba «Costo», «Tipo» ni
«Presentación»; R11 decía solo «la misma lectura que Lotes»; R12 no hablaba de sub-filas; R13 tenía
imagen, nombre, «Existencia», «Alerta de cantidad», «Disponible» y el aviso; R15 no nombraba el
relativo ni «Vencido»; R46 no nombraba `movement-reason-label.ts`. R47–R53 son nuevos.

### Enmienda 2 (2026-10-16)

**Por qué.** El review de la vuelta 1 (`progress/review_QC-263.md`) rechazó por B1: la rama
(HEAD `774a293c`) quedó 22 commits detrás de `origin/dev` (`0f71d5af`, merge-base `27fdd133`), y
`git merge-tree` da seis conflictos (`product-columns.tsx`, `product-table.tsx`,
`product-batch-rows.test.tsx`, `product-page.test.tsx`, `tablas-marca.test.tsx` e
`inventario-paridad.test.tsx.snap`). El humano decidió el 2026-10-16 H1–H6
(`requirements.md > Decisiones cerradas`). **Regla, la misma: lo que `dev` trajo se conserva.**

**Cómo se leyó `dev`.** Esta enmienda se escribió sin shell: no se pudo correr `git fetch` ni
`git show origin/dev:…`. Lo de `dev` se leyó en el worktree `QC-166-area-del-maestro`, que ya integra
`origin/dev` hasta `0f71d5af` (lo cita su bitácora), y en el review. **6939047b no se pudo leer**:
T8a lo comprueba al integrar y, si toca Inventario, lo anota en el impl antes de resolver (no
cambia ningún requisito sin volver aquí).

**070a8c71** (enmiendas de specs por los cambios directos a `dev`) no toca este spec: enmienda QC-52
(R6 con nota, R35–R37 nuevos), QC-225 (R37) y QC-227, y añade la fila «Enmienda 2026-10-16» a las
fichas de `InventarioMovil` y `ProductoTerminadoMovil` y a `docs/diseno/README.md`. Este spec se
alinea con QC-52 R35–R37 salvo en dos cosas, ya decididas: «Costo» va al final (fb140780, H4; QC-52
R35 dice «justo después de la existencia», que fb140780 dejó atrás) y las cifras se alinean a la
derecha (P18; `dev` las centra).

**Cambios, cada uno con su commit de origen:**

| # | Commit | Qué cambia en el spec | Dónde | R / decisión |
| --- | --- | --- | --- | --- |
| F1 | 6a665e3f, 5496bd16, fb140780, 0f71d5af | **Integrar `origin/dev` antes de nada (T8a).** Reglas para los seis conflictos: en `product-columns.tsx` y `product-table.tsx` gana el **conjunto, el orden y la visibilidad** de columnas de `dev` (`showType`, `showPresentation`, `showCost` / `canSeeCost`, `costColumn(units)`, `unitCostCell`, `COST_COLUMN_LABEL`) y gana la rama en **alineación** (`align: 'end'` en toda cifra, también en `averageUnitCost`, que `dev` deja `center`), en `menu` en vez de `rowActions`, en `stockAmountCell` ámbar, en `card` y en el anfitrión único; el `useMemo` de columnas y el del `card` dependen de `showType`, `showPresentation` y `canSeeCost`. En los tres tests se conservan **todos** los casos de `dev` (costo solo con permiso, moneda, unidad, orden, sin «Presentación» en «Producto»; en `tablas-marca`, el cambio de `order-columns` de 0f71d5af) y se les aplican los ajustes de la rama (derecha, duplicados de tarjeta acotados a `data-table-row-…`). El snapshot de paridad se regenera sobre el de `origin/dev` y su diferencia es solo la de § 6 | `product-columns.tsx`, `product-table.tsx`, 3 tests, `.snap` | R6, R53, R54; H4 |
| F2 | 6a665e3f, 5496bd16, fb140780 | **«Costo» de `dev`.** R53 fija el orden de `dev`: imagen, «Nombre», «Tipo», «Presentación», «Existencia», «Disponible», «Reservado», «Alerta de cantidad», «Costo unitario», acciones. R54 fija visibilidad y formato (`formatMoneyDisplay`, `exactDecimalTitle`, unidad, «—»); la regla y el no-envío siguen en `lib/modules/inventario` (`canViewUnitCosts`, QC-52 R36), que esta ficha no toca. Sustituye al «sin redondear» y al «para todos» del R53 de la enmienda 1; E3 (derecha) se mantiene | D3, § 12 > E3 | R6, R53, R54; H4, P23 |
| F3 | — (tablero `InventarioColumnasLotes`, teléfono; `ModalesInventario`) | **Tarjeta del producto y rótulos.** `card` de `ProductTable`: `{ primary: IMAGE_COLUMN_ID, status: showType ? 'type' : undefined, title: 'name', meta: [...(showPresentation ? ['presentationName'] : []), 'stock', 'qtyAlert', 'available', ...(canSeeCost ? ['averageUnitCost'] : [])], footer: BATCHES_TOGGLE_COLUMN_ID }` (orden del tablero, H2·H3; sustituye la `meta` de E1). Rótulos: nuevo `card-field-label.tsx` con `cardFieldLabel(text)` → `<span data-card-label className="text-muted-foreground [table_&]:hidden">{text} </span>`, que la celda pinta **delante y fuera** del elemento con `data-testid` de la cifra (su texto no cambia); dentro de una `<table>` no se ve, en la tarjeta (`<ul>`) sí. Textos en `PRODUCT_CARD_LABELS` (`stock` «Existencia», `qtyAlert` «Alerta», `available` «Disponible», `unitCost` «Costo»; la clave es `unitCost` y no `cost` porque `product-route-contract.test.ts` prohíbe `.cost` en la ruta). Sub-fila de lote: rótulo en `stock`, `available` y `averageUnitCost`; su `meta` es la del producto, así que «Reservado» no sale en su tarjeta (el tablero tampoco lo pinta; decisión del humano 2026-10-16, m8). Solo la celda que devuelve `null` (no pinta nada) queda sin rótulo; la celda que pinta «—» (cifra vacía: sin alerta, sin costo, sin motivo, sin pedido…) **sí** lleva su rótulo. `FinishedStockTable` igual en `stock` y `qtyAlert`. Panel «Lotes»: rótulos en `quantity` «Cantidad», `reserved` «Apartado», `available` «Disponible», `purchaseDate` «Fecha de compra», `expiryDate` «Vencimiento». Historial: `previousStock` «Existencia anterior», `countedStock` «Total contado», `reason` «Motivo», `order` «Pedido»; `author` y `date` sin rótulo | D6, D7, D8 | R13, R55, R56; H2·H3, P24, P25 |
| F4 | — (tablero, teléfono) | **«Mostrar lotes» al pie.** Nueva columna de la ruta `batchesToggle` (`BATCHES_TOGGLE_COLUMN_ID`, `label: 'Lotes'`, `align: 'start'`, `pinnable: false`): en la fila `product` pinta `<Button variant="ghost" touch aria-expanded data-testid="product-batches-card-toggle">` con `ChevronRight` (gira 90° como el de la tabla) y «Mostrar lotes» / «Ocultar lotes» (`PRODUCT_BATCH_ROW_TEXTS.cardToggle(expanded)`); en las sub-filas, `null`. Llama al mismo `onToggle`. Va como `card.footer`, que `DataTableCards` ya pinta a la izquierda de «Acciones». En la tabla, la columna se oculta desde la ruta con `PRODUCT_TABLE_SCOPE_CLASS` (`[&_[data-testid=data-table-head-batchesToggle]]:hidden [&_[data-testid=data-table-cell-batchesToggle]]:hidden`), y el chevrón del título se oculta en la tarjeta (`[&_[data-testid=data-table-cards]_[data-testid=product-batches-toggle]]:hidden`). La clase va en un `div` que envuelve al `DataTable` en `ProductTable`; `DataTable` no cambia. T8c confirma en el DOM que `th` y `td` llevan esos `data-testid` (`data-table-header-menu.tsx`, `data-table.tsx`) | D6, `product-columns.tsx`, `product-table.tsx` | R13, R47, R58; H2·H3; A13 |
| F5 | — (tablero, escritorio: `tr.lot td{background…;animation:qc-rise…}`) | **Sub-filas en escritorio.** La raíz de la celda `name` de las filas `batch` y `batchesStatus` gana `data-batch-subrow`; `PRODUCT_TABLE_SCOPE_CLASS` añade `[&_tr:has([data-batch-subrow])>td]:bg-[color-mix(in_oklch,var(--muted)_55%,var(--card))]` (el valor del tablero, **opaco**: con `bg-muted/55` las celdas fijadas, imagen y acciones, quedaban translúcidas al desplazar en horizontal, lo destapó el E2E) y `motion-safe:[&_tr:has([data-batch-subrow])>td]:animate-[screen-enter_var(--dur-slow)_var(--ease-enter)_both]` (la animación de entrada que ya existe en `globals.css`, 300 ms). La sangría es el `pl-12` de hoy en la celda, que en la tarjeta se quita (`@max-[760px]:pl-0`, E1). **Teléfono (decisión P26, manda el tablero `.lot-m`):** la misma clase de ámbito añade sobre la tarjeta de la sub-fila `[&_li:has([data-batch-subrow])]:ml-5 [&_li:has([data-batch-subrow])]:rounded-lg [&_li:has([data-batch-subrow])]:bg-muted` y `motion-safe:[&_li:has([data-batch-subrow])]:animate-[screen-enter_var(--dur-slow)_var(--ease-enter)_both]`; el `<li>` lo pinta `DataTableCards` y no se toca. Revoca la frase de P17 «la ficha no cambia el aspecto de la sub-fila en la tabla» y la «tarjeta de `DataTable` sin extensión» en su aspecto (sigue sin imagen ni «Acciones») | D6, `product-columns.tsx`, `product-table.tsx` | R57; H2·H3, P26 |
| F6 | — (`ModalesInventario`, l. 80 y l. 120, m1 del review) | **Fechas a la derecha.** `align: 'end'` en `purchaseDate` y `expiryDate` de `product-batch-columns.tsx` y, por la decisión P27, en la columna `date` de `batch-history.tsx` | D7, D8 | R15, R21; H2·H3, P27 |
| F7 | — (H5) | **«Elegir otro archivo» en el paso 2.** `ImportPreviewSummary` gana `onChooseAnother` y pinta en la cabecera de la tarjeta «Vista previa», a la derecha del título y del nombre del archivo, `<Button variant="outline" touch data-testid="inventory-import-choose-another">` con `UPLOAD_CHANGE_LABEL` («Elegir otro archivo», ya en `import-texts.ts`, el que usa la zona del paso 1; no se duplica el literal), `disabled` con `confirming`. `InventoryImportScreen` le pasa `restart` (el mismo de «Importar otro archivo»: archivo, resultado y error a `null`), así que `importStepOf(null)` da el paso 1. No llama a ninguna action ni a `toast`. Con 760 px o menos la cabecera apila el botón a todo el ancho | D15 | R32, R59; H5; A15 |
| F8 | — (m3 del review) | **D55 ampliada** con los dos cierres locales y la X del `Sheet` «Lotes» (§ 11). R42 no cambia: no nombra el panel | § 11 | — |
| F9 | 6f08e379, 6a665e3f | **D53 a medir de nuevo** tras el merge (esqueleto de 8 columnas en `dev`) | § 11 | P22 |
| F10 | — (H1, H6) | **P12 y el chip «Tipo» con tono, confirmados.** El leader corrige los tableros (`InventarioColumnasLotes*`, `InventarioTablet`); *Hecho por el leader el 2026-10-16 (decisión P23):* `InventarioColumnasLotes` corregido y copiado a `docs/diseno/canvas/` en la rama: orden de `dev`, «Costo unitario» en moneda redondeada con unidad y exacto en `title`, chip «Tipo» con tono (info/neutral/waiting/success) y sin «Presentación» en «Producto» | — | R13, R53 |
| F11 | — (decisiones P23–P27, 2026-10-16) | **Preguntas de la enmienda 2 cerradas.** P23, P24 y P25 con la opción por defecto (ya escrita en F2, F3); P26 y P27 con el tablero (F5 teléfono, F6 historial) | — | R13, R21, R53, R54, R55, R57 |

**Requisitos antes de la enmienda 2** (para el reviewer): R6 nombraba «Costo» sin condición y en el
orden de E1; R13 llevaba el conmutador en el nombre, las cifras «Presentación, Existencia, Costo,
Alerta, Disponible» sin rótulos y «Costo» para todos; R15 alineaba a la derecha solo las cifras;
R21 no fijaba la alineación de «Fecha»; R32 solo volvía al paso 1 con «Importar otro archivo»; R47 nombraba solo el chevrón; R53 decía
«Costo» sin redondear, para todos, y «Presentación» en todas las pestañas. R54–R59 son nuevos.

## Dependencias de terceros

Ninguna nueva. `@base-ui/react` (Tabs, Menu, Dialog, Sheet, Select), `sonner`, `lucide-react` y
`@tanstack/react-table` ya están.
