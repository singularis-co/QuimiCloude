# QC-262 — impl

## T0a — Censo

Grep del 2026-10-13 en `tests/unit`, `tests/ui`, `tests/guards`, `tests/integration` y `e2e` de los
símbolos de `tasks.md > T0a`. Lo que pasa con `card` (leído en `components/shared/data-table/`):
la tabla se pinta siempre (oculta por CSS a 760 px o menos) y `DataTableCards` se pinta cuando hay
filas (oculta por CSS por encima de 760 px). Así, en jsdom están las dos y en Playwright están las
dos en el DOM.

- La tarjeta repite las celdas de número, estado (`order-status`), receta (`order-missing-recipeName`),
  cliente (`order-missing-customer`), cantidad, fecha y prioridad (`order-priority`).
- También repite el disparador `order-row-actions` con su `data-order-id`.
- NO repite cobertura, responsables, presentación, motivo ni `data-table-row-*`: la tarjeta es
  `data-table-card-<id>`.
- `getAllByRole('row')` no se ve afectado, porque la tarjeta es un `li`.
- Los ítems `order-action-*` viven en el menú abierto, uno a la vez, así que no se duplican.
- En Playwright, `getByRole` excluye lo oculto, pero `getByTestId`, `locator(css)` y `getByText`
  no lo excluyen.
- Los E2E corren en Desktop Chrome y Desktop Safari a 1280 px, así que la lista sale en tabla.

**Marcados = localizador de página entera que con tarjetas encuentra dos.** Son 22 líneas en
10 archivos (★).

| Archivo | Qué nombra | Qué le pasa |
| --- | --- | --- |
| `tests/unit/pedidos-ui/read-only.test.tsx` | `OrderTable`; `order-row-actions` ★ :280; `order-action-responsibles` | acotar (:280 a `data-table-row-<id>`) |
| `tests/unit/pedidos-ui/order-row-wiring.test.tsx` | `OrderTable`; `order-row-actions` ★ :156, :174; `order-action-*` | cambia aserción (anfitrión por tabla, D5) + acotar |
| `tests/unit/pedidos-ui/order-sheet-coverage.test.tsx` | `OrderTable`; `order-row-actions` ★ :172, :188, :199; `order-coverage` dentro del panel | acotar (la cobertura del panel ya va con `within(panel)`) |
| `tests/unit/pedidos-ui/order-sheet-responsibles.test.tsx` | `OrderTable`; `order-row-actions` ★ :220, :257, :273, :289, :337, :371; `order-action-*` | acotar (los «+N» de :242 y :303 no salen en tarjeta: sin cambio) |
| `tests/unit/pedidos-ui/order-list-section.test.tsx` | `OrderTable` real (espía); `order-row-actions` ★ :643, :868, :882, :983; `data-order-id`; `order-missing-responsibles`, `order-coverage`, `order-missing-coverage` | acotar las 4 (:613, :646, :725 y :754 son columnas que no salen en tarjeta: sin cambio) |
| `tests/unit/pedidos-ui/order-list-section-produced.test.tsx` | `OrderListSection` real; `getByText(formatOrderNumber(…))` ★ :226, :227 | acotar (el número sale en la tarjeta como `primary`) |
| `tests/unit/pedidos-ui/order-sheet.test.tsx` | `PedidosPage`; `OrderRowSheetActions` directo (:548, :572); `OrderRowActions`; `order-row-actions` ★ :629 (pantalla); :552 y :575 (anfitrión suelto) | cambia aserción (contrato nuevo de `OrderRowSheetActions`) + acotar :629. `getAllByRole('region')` (1) y `[aria-live]` (1) en :524–538: sin cambio previsto, vigilar con tarjetas |
| `tests/unit/pedidos-ui/order-customer-dialog.test.tsx` | `OrderRowSheetActions` directo (:218); `order-row-actions` | cambia aserción (contrato D5) |
| `tests/unit/pedidos-ui/order-delivery-sheet.test.tsx` | `OrderRowSheetActions` directo (:588); `order-row-actions` | cambia aserción (contrato D5) |
| `tests/unit/pedidos-ui/order-distribution-dialog.test.tsx` | `OrderRowActions` (:161–189), `OrderRowSheetActions` directo (:201, :355); `order-row-actions` | cambia aserción (contrato D5); los `OrderRowActions` sueltos, sin cambio |
| `tests/unit/shared-ui/confirm-dialog-montado.test.tsx` | `OrderRowSheetActions` directo (:555); `order-row-actions`; `order-action-*` | cambia aserción (contrato D5) |
| `tests/unit/pedidos-ui/order-row-actions.test.tsx` | `OrderRowActions` (27), `order-action-*` (24), `order-row-actions`, `data-order-id` | cambia aserción (`orderRowActionsSpec`, orden, separador; testids de hoy) |
| `tests/unit/pedidos-ui/order-columns.test.tsx` | `buildOrderColumns` (:71, :602, :644, :736), `ACTIONS_COLUMN_ID`, `order-status`, `order-priority`, `order-coverage`, `order-missing-*` | cambia aserción (`actionsColumn({ menu })`, piezas nuevas, `onAction`) |
| `tests/unit/pedidos-ui/pedidos-viewport.test.tsx` | `PedidosPage`; `buildOrderColumns` (:720); `ACTIONS_COLUMN_ID`; `order-row-actions` ya acotado con `within(fila)` (:549, :565, :611, :640) | sin cambio de localizadores; `buildOrderColumns` gana `onAction` si es obligatorio. Los barridos de `document.body` (:422, :531, :702) no prohíben `hidden` |
| `tests/unit/pedidos-ui/order-table.test.tsx` | `OrderTable`; `data-table-row-*`, `data-table-cell-*`, `getAllByRole('row')` | sin duplicados; cambia aserción: R2, barra única y tarjetas |
| `tests/unit/pedidos-ui/order-list-skeleton.test.tsx` | `buildOrderColumns` (:21) | sin cambio si `onAction` es opcional; si es obligatorio, se añade |
| `tests/unit/marca/tablas-marca.test.tsx` | `buildOrderColumns` (:242) | ídem (`onAction`); no monta `card` |
| `tests/unit/marca/badges-estado.test.tsx` | `OrderStatusBadge`, `OrderPriorityBadge`, `OrderCoverageBadge`, `order-status`/`priority`/`coverage` | cambia aserción (enmienda QC-227 R3–R5) |
| `tests/unit/pedidos-ui/order-customer-filter.test.tsx` | `ORDER_CUSTOMER_FILTER_TESTID` (hoy no afirma el ancho) | cambia aserción (gana: contenedor sin `w-full`) |
| `tests/unit/paridad/pedidos-paridad.test.tsx` (+ `.snap`, 24 coincidencias) | `PedidosPage`, `order-row-actions`, `OrderRowSheetActions` en el snapshot | cambia snapshot (fila de `design.md > 6`) |
| `tests/unit/paridad/formularios-paridad.test.tsx` (+ `.snap`) | `order-coverage`/`priority` en el snapshot | cambia snapshot solo si pinta cobertura o versión |
| `tests/unit/paridad/campos-paridad.test.tsx` | `order-priority-select` (selector del formulario, no el badge) | sin cambio |
| `tests/unit/identity/session-once-per-request-render.test.tsx` | `OrderListSection`/página reales, sin localizadores | sin cambio |
| `tests/unit/shared-ui/order-status.test.ts` | etiquetas reexportadas por la ruta | sin cambio (los exports se conservan) |
| `tests/unit/shared-ui/catalogo-qc256.test.ts` | `lib/shared/ui/order-status.ts` (fila) | cambia aserción (fila de `RowActionsMenu`, T1b) |
| `tests/unit/shared/data-table-alcance.test.ts` | lista cerrada de E2E con `data-table` | cambia (alta de `pedidos-rediseno`, T6a) |
| `tests/guards/guard-pantalla-pedidos-se-amplia.test.ts` | `OrderStatusBadge`, `OrderPriorityBadge`, `OrderRowActions`, `OrderRowSheetActions`, `buildOrderColumns`, `ACTIONS_COLUMN_ID` (anclas) | cambia (gana `orderRowActionsSpec`, `OrderRowAction`; nada se quita) |
| `tests/guards/guard-formularios-y-acciones.test.ts` | `ACTIONS_COLUMN_ID` (regla de celda), `NO_SE_TOCAN_R30` con `order-row-actions.tsx` y el test | puede cambiar (exclusión que deja de morder con `actionsColumn({ menu })`) |
| `tests/guards/guard-piezas-base.test.ts` | `order-columns.tsx`, `order-table.tsx` en sus listas | puede cambiar (ídem) |
| `tests/guards/guard-identificador-de-request.test.ts` | `E2E_ESPERADOS` | cambia (alta, T6a) |
| `tests/guards/guard-qc102-limites-de-la-ficha.test.ts`, `guard-buscadores.test.ts`, `guard-catalogo-de-errores.test.ts`, `guard-asignacion-componentizada.test.ts` | rutas de `pedidos/components` como dato de ejemplo o atadas a su rama | sin cambio |
| `e2e/helpers/order-distribution.ts` | `orderMenuTrigger` ★ :79 (página entera por `data-order-id`); `rowMenuTrigger` (ya acotado) | acotar. Lo usan `aislamiento-pedidos`, `anular-entrega`, `detalle-de-producto-terminado`, `entregar-producto-terminado`, `pedido-con-cliente` y `pedidos-cotizacion` |
| `e2e/pedido-en-varias-presentaciones.spec.ts` | localizador propio ★ :217 (`order-row-actions` + `data-order-id`), `order-action-*`, `order-missing-*` de empaque | acotar |
| `e2e/entregar-producto-terminado.spec.ts` | ★ :622 `toHaveCount(0)` por `data-order-id`; `order-status` dentro de `orderRow` | sin cambio obligado (0 sigue valiendo); acotar por coherencia |
| `e2e/pedido-bloqueado.spec.ts` | importa `ORDER_STATUS_LABELS` de `order-status-badge`; `order-status`/`order-coverage` dentro de fila | sin cambio |
| `e2e/reserva-de-material.spec.ts`, `anular-entrega.spec.ts`, `empaque.spec.ts`, `pedidos-responsables.spec.ts` | `order-status`/`order-coverage`/`order-missing-responsibles` dentro de `data-table-row-*` | sin cambio |
| `e2e/pedidos.spec.ts`, `pedidos-busqueda.spec.ts`, `pedidos-cotizacion.spec.ts`, `pedido-con-cliente.spec.ts`, `aislamiento-pedidos.spec.ts`, `pedidos-terminados.spec.ts`, `detalle-de-producto-terminado.spec.ts` | `pedidos-title`, `order-action-*` (menú), filas por `[data-testid^="data-table-row-"]`, `order-customer-filter` (uno, en la barra), `order-priority-select` | sin cambio (salvo lo que herede del helper) |
| `e2e/login.spec.ts`, `envases-del-pedido.spec.ts`, `pedido-conversion-de-unidad.spec.ts`, `producto-terminado.spec.ts`, `recetas-porcentaje.spec.ts`, `versiones-de-receta.spec.ts` | solo `pedidos-title` | sin cambio (sigue habiendo un único `h1` con ese testid, D1) |
| `tests/unit/asignaciones-ui/*`, `tests/ui/dashboard/*`, `tests/unit/clientes-ui/*`, `tests/unit/configuracion-ui/*`, `tests/unit/recetas-ui/*`, `tests/unit/inventario*/*`, `tests/unit/shared*/data-table*`, `tests/integration/aislamiento.json`, el resto de `e2e/` (`acondicionamiento`, `operario-rediseno`…) | falsos positivos: `assigned-order-status`, `company-order-*`, `packing-order-*`, rutas `lib/shared/ui/order-status`, `ACTIONS_COLUMN_ID` propio, `data-table-row-` de otras listas | sin cambio |

**Fuera de `## Archivos esperados` (no añadidos; decide el leader):**

- Cambian:
  - `tests/unit/shared-ui/confirm-dialog-montado.test.tsx` (monta `OrderRowSheetActions` con el
    contrato de hoy).
  - `tests/unit/pedidos-ui/order-list-section-produced.test.tsx` (★ `getByText` del número).
- Cambian solo si `onAction` es obligatorio en `OrderColumnsDeps`:
  - `tests/unit/pedidos-ui/order-list-skeleton.test.tsx`.
- Sin editar, pero se rompen o arreglan a través de `e2e/helpers/order-distribution.ts` y hay que
  correrlos en T6b:
  - `e2e/anular-entrega.spec.ts`
  - `e2e/detalle-de-producto-terminado.spec.ts`

## T0b — Medidas

Servidor de desarrollo en `:3119` contra `quimicloude-pg17`, con el administrador del seed. El
script, que solo lee y no confirma nada, está en el scratchpad de la sesión (`medir.cjs`). Hay
10 pedidos reales en estados variados. Se midió a 390 × 844 en Chromium y WebKit, y los dos
motores dan lo mismo salvo donde se indica. Servidor apagado al terminar.

| Qué | Valor | Frente a design.md |
| --- | --- | --- |
| Documento | `scrollWidth` 390 = ancho de la ventana | — |
| Barra `data-table-filters` | 358 px (x 16 → 374), 3 filas: buscador 358 × 44, cliente debajo, chips debajo | R3 ya se cumple hoy |
| Filtro de cliente HOY (`w-full sm:w-64`) | Chromium **252 px**, WebKit **285 px**: no llena la barra (el `w-full` se resuelve contra `data-table-toolbar-actions`, que mide su contenido). Nada desborda | — |
| Filtro con `w-64 max-w-full` (simulado inline: `width:16rem; max-width:100%`) | **256 px** en los dos (x 16 → 272 < 358). Nada desborda | D2 se confirma: 256 cabe; sin desviación |
| Panel de alta HOY (`FormSheet`, `minScreenWidth={70}`) | **390 × 844** (x 0). `min-width: 70vw` = 273 px. El ancho lo pone ya el `w-full` / `data-[side=right]:w-full` de la clase por defecto de `FormSheet`. Pie: «Guardar» de 44 px con borde inferior en 828 (< 844) | **Desviación D8:** `max-sm:w-full` no cambia nada (con `width:100%` simulado sigue en 390). El panel ya ocupa todo el ancho a 390; T5a no necesita la clase y su test puede afirmar el ancho de hoy |
| Panel de edición | 390 × 844; el cuerpo desplaza por dentro (2370/645) y el pie sigue en 828 | R19 ya se cumple |
| Panel de entrega (pedido TERMINADO) | 390 × 844; «Cancelar»/«Entregar» de 44 px en 828 | R19 ya se cumple |
| «Cancelar el pedido» (EN_CURSO) | `alertdialog` 320 × 335, x 35 → 355, y 255 → 590; entero y centrado; botones de 44 px | cabe |
| «Eliminar el pedido» (EN_CURSO) | `alertdialog` 320 × 231, entero y centrado; botones de 44 px | cabe |
| «Cliente» (POR_EMPACAR) | `dialog` 358 × 345, y 250 → 595; entero y centrado; acciones de 44 px; **cerrar (X) 32 px** | cabe |
| «Reparto y unidad» (POR_EMPACAR) | `dialog` 358 × 615, y 115 → 730; entero y centrado, sin desplazamiento; acciones de 44 px; **cerrar (X) 32 px** | cabe |
| «Material insuficiente» (`blocked-order-dialog`) | **No medido.** Solo se abre al guardar un alta o edición que bloquearía material, es decir, al llamar a la Server Action con datos reales. Si el material alcanza, crea o edita un pedido, y el script no muta datos. Es un `ConfirmDialog` como «Cancelar»/«Eliminar», que caben con margen. Queda para el E2E de T6a | abierto |

**Desviaciones y hallazgos:**

1. **D8:** el panel de alta y edición ya mide 390 a 390 px. `max-sm:w-full` es redundante. Se
   propone no añadirlo y que T5a afirme el ancho de hoy. Decide el leader.
2. **R18 (abierto):** el botón de cerrar (X) de «Cliente», «Reparto y unidad» y del panel de
   entrega mide 32 px. Si R18 («botones de al menos 44 px») cuenta ese botón, ningún diálogo de
   pedidos lo cumple hoy, y el arreglo iría en la ruta o en `Dialog`/`Sheet` (compartidas, fuera de
   «Archivos esperados»). Lo que se ve en el código de hoy es que el resto de botones mide 44 px.
3. **D2:** sin desviación. Hoy el filtro tampoco llena la barra (252/285 px), así que el cambio a
   256 px fijo casi no se ve en teléfono.

## Tanda 1 — T1a y T1b (frontend_dev)

Archivos:
- `components/shared/row-actions-menu.tsx`: `separatorBefore?` por ítem; `DropdownMenuSeparator` en el
  desplegable y `Separator` en el diálogo centrado, envueltos en `Fragment` (sin la prop, el DOM no cambia).
  Nunca delante del primer ítem (`hasSeparatorBefore`).
- `tests/unit/shared-ui/row-actions-menu-separator.test.tsx` (nuevo).
- `components/shared/CATALOGO.md`: fila `RowActionsMenu` con `separatorBefore` en «Cubre» y en «Puntos de
  extensión»; `Separator` añadido a «Base de»; «Diseño» sigue en `Tabla.dc.html`. `catalogo-qc256` sin cambios.

Mapa:
- R14 → `tests/unit/shared-ui/row-actions-menu-separator.test.tsx` (6 casos: desplegable y centrado × con prop,
  primer ítem, sin prop).
- R24 → `tests/guards/guard-catalogo-de-componentes.test.ts`, `tests/unit/shared-ui/catalogo-qc256.test.ts`.

Salida:
- `pnpm run typecheck`: sin errores.
- `pnpm run lint`: 0 errores, 7 warnings previos (confirm-catalog-import.test.ts, order-service.test.ts).
- `pnpm exec vitest related --run components/shared/row-actions-menu.tsx`: 250/251 archivos, 4032 pasados,
  1 fallo en `tests/unit/paridad/pedidos-paridad.test.tsx` (snapshot que la Tanda 2 en paralelo estaba
  actualizando); relanzado solo: 7/7 en verde.
- `pnpm exec vitest run guard-catalogo-de-componentes catalogo-qc256 row-actions-menu`: 5 archivos, 89/89.

Veredicto: T1a y T1b hechas, en verde.

## Tanda 2 — T2a y T2b (frontend_dev, 2026-10-13)

**Archivos.** Producción: `app/(private)/pedidos/components/order-status-badge.tsx` (sobre
`StatusBadge` y `PriorityMark`; fuera `STATUS_VARIANTS`, `PRIORITY_VARIANTS`, `COVERAGE_VARIANTS` y el
import de `Badge`; mismos exports, testids y `data-*`), `recipe-version-select.tsx` (marca con
`StatusBadge`: `waiting` / `muted`, testid `recipe-version-select-mark`; el `input` oculto y su valor
no cambian). Tests: nuevos `tests/unit/pedidos-ui/order-status-badges.test.tsx` y
`tests/guards/guard-pedidos-rediseno.test.ts`; enmendados `tests/unit/marca/badges-estado.test.tsx`
(R3–R5 a `data-tone` / `data-level`), `order-columns.test.tsx` (tono en vez de variante),
`order-sheet-coverage.test.tsx` (tono en el panel), `recipe-version-select.test.tsx` (R9).
Snapshot: `tests/unit/paridad/__snapshots__/pedidos-paridad.test.tsx.snap`, 8+/4−: solo
`order-status` (clases de `StatusBadge` + punto) y `order-priority` (clases de `PriorityMark` + svg),
fila de `design.md > 6`. `formularios-paridad` no cambió.

**R → test.** R5, R6, R7 → `order-status-badges.test.tsx`, `badges-estado.test.tsx` R3–R5,
`order-sheet-coverage.test.tsx` (R7, tono y ausencia en el panel; la ausencia en la lista sigue en
`order-columns.test.tsx`). R8 → `guard-pedidos-rediseno.test.ts` (caso inventado que muerde + barrido).
R9 → `recipe-version-select.test.tsx` (dos casos R9).

**Salida.** `pnpm run typecheck`: sin errores. `pnpm run lint`: 0 errores, 7 avisos en
`confirm-catalog-import.test.ts` y `order-service.test.ts` (ajenos). `vitest related` de los dos
archivos de producción: 63 archivos, 1222 pasan, 1 falla (snapshot de `pedidos-paridad`, actualizado
con `-u` en ese archivo: 7/7). `vitest run guard`: 76 archivos, 1051 pasan, 20 omitidos, **1 falla**:
`guard-pedidos-rediseno` R8 con `app/(private)/pedidos/components/order-delivery-list.tsx:5 importa
Badge` (`<Badge variant="destructive">` de «Anulada», línea 150).

**Desviaciones.**
1. `order-delivery-list.tsx` importa `Badge` y no está en `## Archivos esperados`: no se tocó. R8 lo
   prohíbe en toda la ruta. Decide el leader: añadirlo a la lista y pasar «Anulada» a `StatusBadge`
   (tono `danger`), o acotar R8.
2. En la versión, la marca sustituye al paréntesis de hoy («A medias (por revisar)» pasa a «A medias»
   + insignia «por revisar»); los textos son los mismos. Una `note` dada por quien llama (ningún
   llamador de producción la pasa) sale en `muted` mientras el listado no llega.

Veredicto: T2a y T2b hechas; gate de guardias rojo solo por `order-delivery-list.tsx` (fuera de lista).
