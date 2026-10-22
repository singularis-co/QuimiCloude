# QC-262 — rediseno-pedidos · design.md

## Lo que ya existe

**Términos buscados.** En el board (`feature_list.json`, todos los estados): «pedidos», «rediseño»,
«tarjeta», «toast», «PriorityMark», «cobertura», «menú». En `specs/` y `progress/`: `QC-262`,
`OrderStatusBadge`, `OrderCoverageBadge`, `actionsColumn`, `D37`–`D40`, `separador`, «tarjetas».
En el código (grafo `codebase-memory-mcp` del worktree, que respondió, y Grep): `OrderRowActions`,
`OrderRowSheetActions`, `buildOrderColumns`, `OrderTable`, `OrderCustomerFilter`,
`RowActionMenuItem`, `DataTableCardLayout`, `actionsColumn`, `ORDER_COVERAGE_TONES`, `Badge` en
`app/(private)/pedidos/`, textos de toasts y diálogos de la ruta.

| Qué apareció | Dónde | Qué se hace |
| --- | --- | --- |
| QC-256 (`done`) dejó `StatusBadge`, `PriorityMark`, el mapa único `ORDER_STATUS_TONES` / `ORDER_PRIORITY_LEVELS` / `ORDER_COVERAGE_TONES`, `PageShell`, `PageHeader`, `RowActionsMenu` centrado, `DataTable` con `card`, barra de chips y `actionsColumn({ menu })`, y dejó **a esta ficha** pasar `OrderStatusBadge`, `OrderPriorityBadge` y `OrderCoverageBadge` a las piezas nuevas | `specs/QC-256-piezas-compartidas-rediseno/design.md > Lo que ya existe` (fila «se dejan como están: las cambian QC-262…») | Se reutilizan; los tres badges de la ruta pasan a componerlas (D3) |
| QC-257 (`done`): cabecera, menú lateral en `Sheet` en teléfono, `ThemeToggle` | `app/(private)/layout.tsx` | Nada que hacer: lo que la ficha `PedidosMovil` pide de cabecera y menú ya está |
| La barra de filtros ya es una: buscador, `toolbarActions` (filtro de cliente) y chips, en ese orden | `components/shared/data-table/data-table-filters.tsx`, `order-table.tsx` | Se reutiliza; solo cambia el ancho del filtro de cliente (D2) |
| El menú ⋯ de la fila ya existe sobre `RowActionsMenu`, con sus reglas por estado y permiso, pero como celda `cell` (no `actionsColumn({ menu })`): las tarjetas no tienen de dónde sacar «Acciones» | `order-row-actions.tsx`, `order-columns.tsx`, deuda D37 | Pasa a `actionsColumn({ menu })` (D4, D5); D37 se cierra |
| Los toasts del tablero `ModalesPedidos` ya existen todos con el mismo texto | `order-sheet.tsx` (vía `useEntitySheet`), `cancel-order-dialog.tsx`, `delete-order-dialog.tsx`, `order-customer-dialog.tsx`, `order-distribution-dialog.tsx`, `order-delivery-sheet.tsx`, `order-responsibles.tsx` | No se añade ninguno; un test los fija (D9, P7) |
| Los textos de los modales ya coinciden con el tablero salvo los marcados entre corchetes y el título del panel | constantes de cada diálogo de la ruta | Se conservan (R20, P4, P8) |
| `guard-pantalla-pedidos-se-amplia` (QC-102) fija los nombres exportados por la ruta (`OrderStatusBadge`, `OrderPriorityBadge`, `OrderRowActions`, `OrderRowSheetActions`, `MISSING_VALUE_MARK`, `OrderListEmpty`…) en cualquier rama | `tests/guards/guard-pantalla-pedidos-se-amplia.test.ts` | Ningún nombre de esa lista desaparece (D10) |
| `guard-formularios-y-acciones > NO_SE_TOCAN_R30` exige que existan sus rutas (en cualquier rama) | `tests/guards/guard-formularios-y-acciones.test.ts` | Ningún archivo de esa lista se borra (D10) |
| QC-261 P5: en tablet las listas salen en tarjetas por el umbral de `DataTable` | `specs/QC-261-rediseno-dashboard/requirements.md` | Mismo criterio (P2) |
| QC-265 (`done`): `/asignacion` ya pasó a menú ⋯ y tarjetas; dejó D53 (esqueletos sin tarjeta) | `specs/QC-265-rediseno-operario/`, `progress/deudas.md > D53` | Se imita su forma; D53 se amplía a `/pedidos` (P12) |
| QC-179 (`pending`): editar que no abre el panel en WebKit | `feature_list.json` | No se toca; riesgo anotado en § 9 |

**Filas de `components/shared/CATALOGO.md` consultadas y paso de la regla de decisión**
(`docs/perfil-agentes.md > Regla de decisión para componentes`):

| Pieza | Filas consultadas | Paso | Por qué no bastaba el anterior | Tablero |
| --- | --- | --- | --- | --- |
| Título y acción de la página | `PageHeader`, `PageShell` | 1 · reutiliza | — | `Superficies.dc.html`, `Pedidos.dc.html` |
| Barra de filtros | `DataTable` (barra de chips, `toolbarActions`), `AsyncAutocomplete` | 1 · reutiliza | — | `Tabla.dc.html`, `Pedidos.dc.html` |
| Estado y cobertura | `StatusBadge`, `ORDER_STATUS_TONES`, `ORDER_COVERAGE_TONES`, `Badge` | 1 · reutiliza (los badges de la ruta componen `StatusBadge`) | — | `Estados.dc.html` |
| Prioridad | `PriorityMark`, `ORDER_PRIORITY_LEVELS` | 1 · reutiliza | — | `Estados.dc.html` |
| Marca de la versión | `StatusBadge`, `SelectItem` | 1 · reutiliza | — | `ModalesPedidos.dc.html` |
| Menú ⋯ y tarjetas | `RowActionsMenu`, `DataTable` (`card`, `actionsColumn({ menu })`) | 1 · reutiliza | — | `Tabla.dc.html`, `Pedidos.dc.html` |
| Separador del menú | `RowActionsMenu`, `DropdownMenu` (separador), `Separator` | 2 · extiende `RowActionsMenu` con `separatorBefore` por ítem | `RowActionsMenu` «cubre: ítems de acción o de enlace con icono, deshabilitados o destructivos»; no separa grupos | `Tabla.dc.html` (`.sep` del menú), `Pedidos.dc.html` |
| Paneles y diálogos | `FormSheet`, `Sheet`, `ConfirmDialog`, `Dialog`, `AlertDialog` | 1 · reutiliza | — | `ModalesPedidos.dc.html` |
| Avisos emergentes | `Toaster`, `useEntitySheet` | 1 · reutiliza | — | `Avisos.dc.html`, `ModalesPedidos.dc.html` |

No se crea ningún componente. El anfitrión de los paneles de la fila (D5) es el
`OrderRowSheetActions` de hoy con otro contrato: un subcomponente interno de la ruta que solo compone
piezas ya catalogadas y no pinta UI visible nueva.

## 1. Principio

Es un **cambio visual** con tablero aprobado (D14): el snapshot de paridad de pedidos cambia, y cada
cambio está en § 6. El comportamiento no cambia: mismas acciones, mismos campos enviados, mismos
permisos, mismas reglas por estado (R12, R23). Lo que sí cambia por dentro es **dónde viven los
paneles de la fila** (D5), porque las tarjetas lo obligan.

## 2. Modelo de datos

No aplica: sin tablas, sin RLS, sin migraciones, sin cambios en `lib/modules/`. Ningún contrato de
módulo cambia.

## 3. Rutas

Ninguna ruta nueva ni distinta. `/pedidos` sigue en `app/(private)/pedidos/page.tsx`, con
`requirePagePermission('pedidos.consultar')` en su primera línea y la dirección de
`ORDERS_ROUTE` / `orderListHref`.

## 4. Decisiones

**D1 — Cabecera (R1).** `page.tsx` pinta `PageShell` > `PageHeader` con `title={ORDERS_LABEL}`,
`titleTestId="pedidos-title"` y `actions={<OrderSheet … />}` (el disparador de alta de hoy, con su
`data-testid` y su talla de 44 px). El `div` de hoy y su `h1` propio desaparecen; el `Suspense` de la
lista queda dentro de `PageShell` igual que hoy.

**D2 — Barra de filtros (R2–R4).** La barra ya es una (`DataTableFilters`: buscador,
`toolbarActions`, chips). Solo cambia el contenedor de `OrderCustomerFilter`: de `w-full sm:w-64` a
un ancho fijo de 256 px que no supera el de la barra (`w-64 max-w-full`), para que en teléfono quede
debajo del buscador sin desbordar (R3). `data-table-filters.tsx` no se toca. La tanda 0 mide a 390 px
que el filtro no desborda; si desborda, el arreglo es en la ruta, nunca en la tabla compartida.

**D3 — Estado, prioridad, cobertura (R5–R8).** `order-status-badge.tsx` conserva sus exports
(`OrderStatusBadge`, `OrderPriorityBadge`, `OrderCoverageBadge`, los `*_FILTER_OPTIONS` y la
reexportación de etiquetas) y cambia su interior:

```tsx
<StatusBadge tone={ORDER_STATUS_TONES[status]} label={ORDER_STATUS_LABELS[status]}
  data-testid="order-status" data-status={status} />
<PriorityMark level={ORDER_PRIORITY_LEVELS[priority]} label={ORDER_PRIORITY_LABELS[priority]}
  data-testid="order-priority" data-priority={priority} />
<StatusBadge tone={ORDER_COVERAGE_TONES[coverage]} label={ORDER_COVERAGE_LABELS[coverage]}
  data-testid="order-coverage" data-coverage={coverage} />
```

Se borran `STATUS_VARIANTS`, `PRIORITY_VARIANTS`, `COVERAGE_VARIANTS` y el import de `Badge`. El
panel del pedido (`order-form.tsx`) ya usa `OrderCoverageBadge`, así que la cobertura del panel
cambia con la misma pieza. Guardia nueva `tests/guards/guard-pedidos-rediseno.test.ts`: ningún
archivo de `app/(private)/pedidos/` importa `@/components/ui/badge` ni declara un objeto con
claves de estado de pedido cuyos valores sean variantes de `Badge` (R8).

**D4 — Versión de receta (R9).** `recipe-version-select.tsx` pinta la marca de cada opción con
`StatusBadge` (`waiting` para «por revisar», `muted` para «dada de baja»), con los textos de su
constante de hoy. No cambia el valor enviado.

**D5 — Menú como datos y un anfitrión por tabla (R10–R13).** Hoy cada celda de acciones monta su
`OrderRowSheetActions` con su panel y sus cinco diálogos. Con tarjetas, la fila se pinta dos veces
(tabla y tarjeta, `DataTable > card`) y el menú de la tarjeta sale de `column.menu`, no de la celda.
Por eso:

- `order-row-actions.tsx` gana la función pura
  ```ts
  export type OrderRowAction = 'edit' | 'responsibles' | 'customer' | 'distribution' | 'deliver'
    | 'cancel' | 'delete';
  export function orderRowActionsSpec(input: {
    readonly order: OrderSummary;
    readonly canEditDistribution: boolean;
    readonly canEditCustomer: boolean;
    readonly canDeliver: boolean;
    readonly onAction: (action: OrderRowAction, order: OrderSummary) => void;
  }): RowActionsSpec;
  ```
  que devuelve los ítems en el orden del R11 (con `separatorBefore` en «Cancelar» y `destructive`
  en «Cancelar» y «Eliminar»), las mismas reglas de hoy (`isFinalOrderStatus`,
  `acceptsDistributionEdit`, `acceptsDelivery`, el mapa de cambio de cliente: R12), los mismos
  `testId`, `triggerLabel` «Acciones del pedido <número>», `triggerTestId="order-row-actions"`,
  `triggerDataAttributes={{ 'data-order-id': id }}` y `title` «Pedido <número>» (lo usa el diálogo
  centrado, R15). `OrderRowActions` se conserva como `<RowActionsMenu {...orderRowActionsSpec(…)} />`
  (ancla de QC-102 y sus tests).
- `order-columns.tsx` declara la columna con `actionsColumn({ id: ACTIONS_COLUMN_ID, menu })`
  (cierra D37). `buildOrderColumns` gana `onAction` en `OrderColumnsDeps`.
- `order-table.tsx` guarda `active: { order, action, open } | null` y monta **una vez**
  `OrderRowSheetActions` para el pedido activo. `OrderRowSheetActions` conserva su nombre y pasa a
  recibir `order`, `action`, `open`, `onOpenChange` y los catálogos: abre el panel (`edit` en
  formulario, `responsibles` en su sección: es **el mismo** `OrderSheet`) o el diálogo que toca. Al
  cerrar deja `open: false` sin soltar el pedido, para que el diálogo anime su salida, como hoy.
- La celda de responsables (`OrderRowResponsibles`, «+N») no cambia.

Elegir otro ítem mientras un panel está abierto no es posible (el velo modal lo tapa), y el estado
único de la tabla impide dos a la vez (R13).

**D6 — Tarjetas (R15–R17).** `OrderTable` pasa a `DataTable`:

```ts
card={{
  primary: ORDER_NUMBER_COLUMN_ID,
  status: STATUS_COLUMN_ID,
  title: RECIPE_NAME_COLUMN_ID,
  meta: [ORDER_CUSTOMER_NAME_COLUMN_ID, QUANTITY_COLUMN_ID, CREATED_AT_COLUMN_ID],
  footer: PRIORITY_COLUMN_ID,
}}
```

y `ORDER_TABLE_TEXTS` gana `cardActions: 'Acciones'` y `closeMenu: 'Cerrar'`. El umbral es el de
`DataTable` (contenedor de 760 px o menos, P2). El estado «sin coincidencias», el aviso de «en
vuelo» y la paginación ya los pinta `DataTable` igual en tarjetas (R17).

Consecuencia que la tanda 0 mide: con `card`, cada celda y el disparador del menú están **dos veces
en el DOM** (tabla y tarjeta, una oculta por CSS). Los localizadores de página por
`[data-testid="order-row-actions"][data-order-id=…]` pasan a encontrar dos y Playwright falla en
modo estricto; los tests de jsdom que cuentan `order-status` o `order-row-actions` en toda la página
también. Se acotan al cuerpo visible (`data-table-row-<id>` o `data-table-card-<id>`), como hizo
QC-265.

**D7 — Separador en `RowActionsMenu` (R14).** `RowActionMenuItem` gana
`readonly separatorBefore?: boolean`. En el desplegable se pinta `DropdownMenuSeparator` antes del
ítem; en el diálogo centrado, `Separator`. Nunca delante del primer ítem que se pinta. Sin la prop,
el árbol es el de hoy (los demás consumidores y sus snapshots no cambian). Fila del catálogo: punto
de extensión nuevo; su `Diseño` sigue siendo `Tabla.dc.html`, que ya dibuja el separador
(`catalogo-qc256` fija esa celda).

**D8 — Modales y paneles en teléfono (R18–R20).**

- Diálogos: `ConfirmDialog` y `Dialog` ya centran y llevan `max-h-[90dvh]` con desplazamiento; el E2E
  lo mide a 390 × 844 y solo si algo no cabe se ajusta la clase en la ruta.
- Panel de alta y edición: `OrderForm` pasa a `FormSheet` la clase que lo deja a todo el ancho por
  debajo de 640 px (`max-sm:w-full`; `minScreenWidth={70}` sigue desde 640 px). El panel de entrega
  ya lleva `data-[side=right]:w-full`. El pie de `FormSheet` ya respeta el margen seguro inferior.
- Textos: los de hoy (R20); ningún diálogo cambia de copy.

**D9 — Toasts (R21).** Sin cambio de producción. Test nuevo
`tests/unit/pedidos-ui/pedidos-toasts.test.tsx` que, con `sonner` simulado, recorre cada éxito y
comprueba un único `toast.success` con su texto.

**D10 — Anclas y listas cerradas que se respetan.**

- Ningún export de `ANCLAS_DE_LA_PANTALLA` (`guard-pantalla-pedidos-se-amplia`) desaparece; se
  añaden `orderRowActionsSpec` y `OrderRowAction` (solo se gana, R41 de QC-102).
- Ningún archivo de `NO_SE_TOCAN_R30` (`guard-formularios-y-acciones`) ni de `ARCHIVOS_D11`
  (`guard-piezas-base`) se borra.
- Si al tocar `order-columns.tsx` u `order-table.tsx` una exclusión de `guard-piezas-base` deja de
  morder (la guardia lo trata como hallazgo), se retira en el mismo commit, como QC-265 R43.

## 5. Contratos que cambian

| Símbolo | Antes | Después |
| --- | --- | --- |
| `OrderStatusBadge`, `OrderPriorityBadge`, `OrderCoverageBadge` | `Badge` con variante | `StatusBadge` / `PriorityMark`; mismos props y `data-*` |
| `RowActionMenuItem` | sin separador | + `separatorBefore?` |
| `orderRowActionsSpec`, `OrderRowAction` | — | nuevos en `order-row-actions.tsx` |
| `OrderRowActions` | arma los ítems | envoltorio de `RowActionsMenu` sobre `orderRowActionsSpec` |
| `OrderRowSheetActions` | menú + panel + cinco diálogos por fila | anfitrión del pedido activo: `order`, `action`, `open`, `onOpenChange` |
| `OrderColumnsDeps` | — | + `onAction` |
| Columna `actions` | `cell` con `OrderRowSheetActions` | `actionsColumn({ menu })` |
| `OrderTable` | sin `card` | `card` + estado del pedido activo |
| `ORDER_TABLE_TEXTS` | — | + `cardActions`, `closeMenu` |

## 6. Snapshots y árboles que cambian (aceptados)

Toda diferencia de paridad que no esté aquí es un fallo de la tanda:

| Archivo | Cambio | Requisito |
| --- | --- | --- |
| `tests/unit/paridad/pedidos-paridad.test.tsx` (+ `.snap`) | cabecera con `PageHeader`; estado, prioridad y cobertura con las piezas; columna de acciones de `actionsColumn`; tarjetas; filtro de cliente | R1, R2, R5–R7, R10, R15 |
| `tests/unit/paridad/formularios-paridad.test.tsx` (+ `.snap`) | solo los casos del panel de pedido que pintan la cobertura o la versión | R7, R9 |
| `tests/unit/paridad/confirmaciones-paridad.test.tsx` (+ `.snap`) | ninguno esperado; se lista porque monta los diálogos de pedidos | — |

La tanda 0 no regenera nada; cada snapshot se actualiza en la tanda que cambia la pantalla y el
commit cita la fila.

## 7. Tests y E2E que se tocan (barrido con grep, 2026-10-13)

**Unitarios que cambian aserciones:**

| Test | Por qué |
| --- | --- |
| `tests/unit/marca/badges-estado.test.tsx` | R3–R5 de QC-227 afirman la variante de `Badge` por estado, prioridad y cobertura: pasan a tono de `StatusBadge` y nivel de `PriorityMark` (enmienda, § 10) |
| `tests/unit/pedidos-ui/order-row-actions.test.tsx` | orden, separador, destructivos; `orderRowActionsSpec` |
| `tests/unit/pedidos-ui/order-row-wiring.test.tsx` | el anfitrión por tabla en vez de por fila |
| `tests/unit/pedidos-ui/order-columns.test.tsx` | columna de `actionsColumn`, piezas nuevas |
| `tests/unit/pedidos-ui/order-table.test.tsx`, `order-list-section.test.tsx`, `pedidos-viewport.test.tsx`, `a11y-tactil.test.tsx`, `read-only.test.tsx` | duplicados de tabla y tarjeta: acotar al cuerpo visible; tarjetas |
| `tests/unit/pedidos-ui/order-sheet.test.tsx`, `order-sheet-coverage.test.tsx`, `order-sheet-responsibles.test.tsx`, `order-form.test.tsx` | cobertura con `StatusBadge`; ancho del panel |
| `tests/unit/pedidos-ui/recipe-version-select.test.tsx` | marca con `StatusBadge` |
| `tests/unit/pedidos-ui/order-customer-filter.test.tsx` | ancho del contenedor |
| `tests/unit/shared-ui/row-actions-menu-centrado.test.tsx` | sin `separatorBefore`, árbol de hoy |
| `tests/unit/marca/tablas-marca.test.tsx` | si mide la tabla de pedidos con `card` (lección de QC-265) |
| `tests/unit/shared-ui/catalogo-qc256.test.ts` | fila de `RowActionsMenu` con el punto de extensión nuevo |

**Tests nuevos:** `tests/unit/pedidos-ui/order-status-badges.test.tsx` (R5–R7),
`tests/unit/pedidos-ui/pedidos-page-header.test.tsx` (R1), `tests/unit/pedidos-ui/order-cards.test.tsx`
(R15–R17), `tests/unit/pedidos-ui/pedidos-toasts.test.tsx` (R21),
`tests/unit/shared-ui/row-actions-menu-separator.test.tsx` (R14) y
`tests/guards/guard-pedidos-rediseno.test.ts` (R8).

**E2E que cambian** (corren en el PR a producción; T6 los corre por spec):

| E2E | Qué cambia |
| --- | --- |
| `e2e/helpers/order-distribution.ts` | el disparador por `data-order-id` se acota a `data-table-row-<id>` |
| `e2e/pedido-en-varias-presentaciones.spec.ts` | ídem (línea del localizador de página) |
| `e2e/entregar-producto-terminado.spec.ts` | ídem; su `toHaveCount(0)` sigue valiendo |
| `e2e/pedidos.spec.ts`, `pedidos-busqueda.spec.ts`, `pedidos-cotizacion.spec.ts`, `pedidos-responsables.spec.ts`, `pedido-con-cliente.spec.ts`, `pedido-bloqueado.spec.ts`, `reserva-de-material.spec.ts`, `aislamiento-pedidos.spec.ts`, `empaque.spec.ts`, `envases-del-pedido.spec.ts`, `pedido-conversion-de-unidad.spec.ts`, `producto-terminado.spec.ts`, `pedidos-terminados.spec.ts` | leen filas por `data-table-row-<id>` y testids que se conservan; solo cambian si algún localizador es de página entera |

**E2E nuevo:** `e2e/pedidos-rediseno.spec.ts` (Chromium y WebKit): a 1440, una sola barra con sus
controles en orden (R2), menú con el orden, el separador y los destructivos (R11, R14), tabla con
doce columnas y número fijado (R16); a 820 y 390, tarjetas (R15, P2); a 390, barra sin desbordar
(R3), «Acciones» de 44 px con diálogo centrado «Pedido <n>» e ítems de 48 px (R15), diálogos enteros
y centrados (R18) y paneles a todo el ancho con el pie visible (R19). Se da de alta en
`E2E_ESPERADOS` de `tests/guards/guard-identificador-de-request.test.ts` y en la lista cerrada de
`tests/unit/shared/data-table-alcance.test.ts` (de 40 a 41), con el comentario «Alta el <fecha>
(QC-262) por el MISMO motivo y en el MISMO sitio que las demas: …», como las de QC-265.

T0 repite el grep antes de tocar nada y lo deja en `progress/impl_QC-262.md`.

## 8. Alternativas descartadas

- **A1 — Seguir con la celda `cell` y poner el menú en el pie de la tarjeta** (`card.footer` =
  columna de acciones). Cero cambio de dónde viven los paneles, pero la tarjeta pintaría el
  desplegable de la tabla y no el botón «Acciones» con el diálogo centrado que pide D2, y cada fila
  seguiría montando seis paneles y diálogos en el árbol (dos veces, con la tarjeta).
- **A2 — Borrar `OrderStatusBadge`, `OrderPriorityBadge` y `OrderCoverageBadge`** y usar
  `StatusBadge`/`PriorityMark` directamente en las columnas y el panel. Más directo, pero tumba las
  anclas de `guard-pantalla-pedidos-se-amplia` (QC-102 R41) y los imports de una docena de tests y un
  E2E (`pedido-bloqueado` importa las etiquetas de ese archivo), para el mismo árbol final.
- **A3 — Diálogo «Responsables» propio** como dibuja `ModalesPedidos` (P1). Contradice la decisión
  de QC-102 de un único panel por pedido y duplica el selector de personas y grupos que ya vive en
  `order-responsibles.tsx`.
- **A4 — Umbral propio de tarjetas para que tablet siga en tabla** (P2). Obliga a extender
  `DataTable` con un umbral por consumidor y contradice el criterio de QC-261 P5; el propio tablero
  cae en tarjetas a 820 px.
- **A5 — Separador automático antes del primer ítem destructivo** en `RowActionsMenu`. No pide nada
  al consumidor, pero cambia el árbol de todas las listas con menú (usuarios, unidades,
  presentaciones, clientes, asignación) y sus snapshots sin sus fichas.
- **A6 — Extender `SelectField` para pintar `PriorityMark` en el selector de prioridad** (P10).
  Cambia una pieza compartida que usan todos los formularios, con su valor en el disparador de Base
  UI, por un detalle de un solo campo.

## 9. Riesgos y coordinación

- **Duplicados de tabla y tarjeta** (D6): es el riesgo principal; T0 lo censa entero antes de tocar
  nada.
- **QC-179** (`pending`) toca el mismo disparador de editar en WebKit. Si entra después, parte del
  anfitrión de D5; el E2E nuevo corre en WebKit y abre «Editar» desde el menú.
- **Archivos compartidos con otras fichas:** `components/shared/row-actions-menu.tsx`,
  `components/shared/CATALOGO.md` (cualquier ficha de rediseño en vuelo: QC-263, QC-264, QC-266,
  QC-267 están `pending`) y `tests/unit/shared/data-table-alcance.test.ts` /
  `guard-identificador-de-request.test.ts` (listas cerradas que crecen por apéndice).
  `scripts/archivos-en-vuelo.mjs` lo comprueba con `## Archivos esperados`.
- **Gate rápido y listas cerradas:** la lección de QC-261 y QC-265; T6 cierra con
  `./init.sh --completo`.

## 10. Enmiendas a specs cerrados

| Spec | Qué cambia | Por qué |
| --- | --- | --- |
| QC-227 (`tests/unit/marca/badges-estado.test.tsx`, R3–R5) | Estado, prioridad y cobertura de pedido dejan de ser variantes de `Badge`: se afirma el tono de `StatusBadge` (de `ORDER_STATUS_TONES` / `ORDER_COVERAGE_TONES`) y el nivel de `PriorityMark` | D1, D3 del humano |
| QC-35 (`pedidos-viewport.test.tsx`, R22, R45) | El disparador del menú se busca dentro de la fila de tabla visible, porque la tarjeta lleva otro | D2 |
| QC-55 (`tests/unit/shared/data-table-alcance.test.ts`) | La lista cerrada de E2E pasa de 40 a 41 con `e2e/pedidos-rediseno.spec.ts` | § 7 |
| QC-102 (`order-row-wiring.test.tsx`) | Los paneles de la fila los monta un anfitrión por tabla y no cada celda; sigue habiendo un solo `OrderSheet` por pedido abierto | D5 |

## 11. Deudas

- **D37** se cierra (D5).
- **D38, D39, D40** siguen; su dueño pasa de «QC-223» (`done`) a «sin asignar» (P9).
- **D53** se amplía a `/pedidos` (P12).
- **Nuevas:** icono en la cabecera de `ConfirmDialog` (P5) y `PriorityMark` en el selector de
  prioridad (P10), si se confirman fuera.

## Dependencias de terceros

Ninguna nueva. `@base-ui/react` (Menu, Dialog, Sheet, Select), `sonner`, `lucide-react` y
`@tanstack/react-table` ya están.
