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

## Cierre T2a y Tanda 3 (frontend_dev, 2026-10-13)

**Archivos.** Producción: `order-delivery-list.tsx` («Anulada» pasa a `StatusBadge` tono `danger`;
mismo texto, testids y `data-*`), `order-row-actions.tsx` (`OrderRowAction`, `orderRowActionsSpec`,
`OrderRowActionsSpec`, `OrderRowActionsSpecInput`; `OrderRowActions` es un envoltorio de
`RowActionsMenu` y gana `onAction`, y conserva sus callbacks de antes), `order-columns.tsx`
(`actionsColumn({ id: ACTIONS_COLUMN_ID, menu })`, `onAction` opcional en `OrderColumnsDeps`; sale
`canVoidDelivery`, que ya no usa ninguna columna), `order-table.tsx` (pedido activo
`{ order, action, open } | null` y un solo `OrderRowSheetActions`), `order-sheet.tsx`
(`OrderRowSheetActions` con el contrato nuevo), `index.ts` (exporta lo nuevo).
Tests: `order-row-actions.test.tsx`, `order-row-wiring.test.tsx`, `order-columns.test.tsx` y
`order-table.test.tsx` (casos nuevos); `order-customer-dialog`, `order-delivery-sheet`,
`order-distribution-dialog`, `order-sheet` y `shared-ui/confirm-dialog-montado` (montaban
`OrderRowSheetActions` suelto y pasan a montar `OrderTable`); `guard-pantalla-pedidos-se-amplia`
(anclas nuevas: `OrderRowAction`, `orderRowActionsSpec`; no se quita ninguna).

**R → test.**
- R10 → `order-row-actions.test.tsx` (disparador, `title`, emisión, diálogo centrado) y
  `order-columns.test.tsx` (`menu` de la columna, permisos, `onAction`, `data-order-id` en la celda).
- R11 → `order-row-actions.test.tsx` (orden, separador solo en «Cancelar», destructivos, testids).
- R12 → `order-row-actions.test.tsx` (tabla escrita a mano: 10 estados × 8 combinaciones de permisos).
- R13 → `order-row-wiring.test.tsx` (cada ítem abre lo suyo para su pedido, «Editar» y «Responsables»
  abren el mismo panel, nunca dos, el cerrado sigue montado) y `order-table.test.tsx`.

**Salida.**
- `pnpm run typecheck`: sin errores.
- `pnpm run lint`: 0 errores; 7 avisos ajenos (`confirm-catalog-import.test.ts`, `order-service.test.ts`).
- `pnpm exec vitest related --run` sobre los 6 archivos de producción: 63 archivos, 1358 pasan, 0 fallan.
- `pnpm exec vitest run guard`: 76 archivos, 1052 pasan, 20 omitidos, 0 fallan.
  `guard-pedidos-rediseno` pasa sin acotarla.
- `pnpm exec vitest run tests/unit/paridad`: 22 archivos, 412 pasan. **No cambió ningún snapshot**:
  ni `pedidos-paridad` ni `confirmaciones-paridad`. La celda pinta el mismo desplegable y, cerrado,
  el anfitrión no pinta nada.
- `tests/unit/pedidos-ui` + `confirm-dialog-montado` + `tablas-marca` + `badges-estado`:
  53 archivos, 1048 pasan, 3 omitidos.

**Desviaciones.**
1. **«Entregas»** (`order-action-deliveries`, `ENTREGADO`/`TERMINADO`) no aparece en el R11 ni en el
   `OrderRowAction` de D5, pero existe hoy y lo usa `e2e/anular-entrega.spec.ts`. Se conserva como
   `'deliveries'`, justo antes de «Entregar» (como hoy). Su posición la confirma el leader.
2. **`RowActionsSpec`** (`data-table-types.ts`, fuera de lista) no incluye `triggerDataAttributes`.
   `orderRowActionsSpec` devuelve `RowActionsSpec & { triggerDataAttributes }`, y `actionsColumn` y
   `DataTableCards` lo propagan a `RowActionsMenu`, así que `data-order-id` llega a la fila y a la
   tarjeta. El tipo compartido no lo declara.
3. Con el anfitrión único, «Cliente», «Reparto y unidad», «Entregar» y «Entregas» quedan montados
   (cerrados) al cerrar, como ya pasaba con el panel, «Cancelar» y «Eliminar». Antes se
   desmontaban. Cada apertura los remonta (`key`), así que el estado no pasa de una apertura a
   otra. El borrador guardado de reparto se conserva hasta el refresco, como hoy.
4. Tras un refresco, el anfitrión toma la fila nueva del mismo id. Si el pedido ya no está en la
   página, sigue con el de antes.
5. Ninguna exclusión de `guard-piezas-base` dejó de morder: no se retiró ninguna.
6. Cierre de T2a: ningún test afirmaba la variante de «Anulada» (`order-delivery-list.test.tsx`
   solo mira el texto). No se tocó.

Veredicto: T2a cerrada y Tanda 3 (T3a, T3b) hecha; typecheck, lint, related y guardias en verde.

## Tanda 5 — T5a y T5b (frontend_dev, 2026-10-13)

Solo tests; ningún cambio de producción (decisión del leader: D8 sin `max-sm:w-full`, T5a afirma
el ancho de hoy, que T0b midió en 390 × 844).

Archivos tocados (solo añadidos, al final de cada archivo):

- `tests/unit/pedidos-ui/order-form.test.tsx`: R19 (clase del panel bajo 640 px: `w-full` y
  `data-[side=right]:w-full` como únicas clases de ancho sin breakpoint, tope `sm:max-w-md`, sin
  `data-[side=right]:w-3/4`, `min-width: 70vw`, `pb-[env(safe-area-inset-bottom)]`) y R20 (título y
  descripción del alta; título «<receta> × <cantidad>» y descripción de la edición).
- `tests/unit/pedidos-ui/cancel-order-dialog.test.tsx`, `delete-order-dialog.test.tsx`,
  `blocked-order-dialog.test.tsx`, `order-customer-dialog.test.tsx`,
  `order-distribution-dialog.test.tsx`, `order-delivery-sheet.test.tsx`: un caso R20 cada uno con
  título (por rol y nombre accesible) y los textos de sus botones.
- `tests/unit/pedidos-ui/pedidos-toasts.test.tsx` (nuevo): `sonner` simulado; 13 éxitos, cada uno
  con un único `toast.success` y su texto exacto (alta, edición, cancelar, eliminar, cliente,
  reparto, entrega completa, entrega parcial «Entrega registrada», asignar 1 y 3, retirar
  responsable, retirar grupo de 1 y de 3), y los mismos 13 con error: región de error pintada y
  ningún `toast.success`.

R → test:

| R | Test |
| --- | --- |
| R19 | `order-form.test.tsx` > «R19: por debajo de 640 px el panel ocupa todo el ancho con su clase de hoy» |
| R20 | `order-form.test.tsx` (2 casos R20), `cancel-order-dialog`, `delete-order-dialog`, `blocked-order-dialog`, `order-customer-dialog`, `order-distribution-dialog`, `order-delivery-sheet` (un caso R20 cada uno) |
| R21 | `pedidos-toasts.test.tsx` (26 casos) |

Salida:

- `pnpm run typecheck`: exit 0.
- `pnpm run lint`: 0 errores, 7 warnings preexistentes, ninguno en los archivos tocados.
- `pnpm exec vitest run` de los 8 archivos + `paridad/formularios-paridad.test.tsx`: 240 pasados,
  6 fallados. Los 6 son casos «montaje desde la fila» que montan `OrderTable`
  (`order-customer-dialog` R39, `order-delivery-sheet` R4, `order-distribution-dialog` R11 ×4) y
  fallan con «Found multiple elements by: [data-testid="order-row-actions"]»: vienen del
  `order-table.tsx` que la Tanda 4 está cambiando en paralelo, no de lo añadido aquí (los casos
  nuevos pasan todos). Los casos R19, R20 y R21 nuevos: 3 + 6 + 26, todos en verde.
- `formularios-paridad`: en verde, snapshot sin cambios.

Veredicto: T5a y T5b hechas, solo tests; 6 rojos ajenos que dependen de que la Tanda 4 cierre `order-table.tsx`.

## Tanda 4 — T4a, T4b y T4c (frontend_dev, 2026-10-13)

**Archivos.** Producción: `app/(private)/pedidos/page.tsx` (`PageShell` > `PageHeader` con
`title={ORDERS_LABEL}`, `titleTestId="pedidos-title"` y `actions={<OrderSheet … />}`; fuera el `div`
y el `h1` propios; el `Suspense` queda igual), `order-customer-filter.tsx` (`w-full sm:w-64` →
`w-64 max-w-full`), `order-table.tsx` (`card` de D6 como constante del módulo y
`cardActions: 'Acciones'`, `closeMenu: 'Cerrar'` en `ORDER_TABLE_TEXTS`).
Tests nuevos: `tests/unit/pedidos-ui/pedidos-page-header.test.tsx` (3), `order-cards.test.tsx` (12).
Tests ampliados: `order-customer-filter.test.tsx` (R3, R4), `order-table.test.tsx` (R2 ×2),
`order-sheet.test.tsx` (R19 alta y edición: `data-side="right"`, `w-full`,
`data-[side=right]:w-full`, `data-[side=right]:inset-y-0`, `data-[side=right]:h-full`,
`pb-[env(safe-area-inset-bottom)]`; sin `max-sm:w-full`, decisión del leader).
Acotados a `data-table-row-<id>` (duplicados de tarjeta): `order-row-wiring` (2), `order-sheet` (3),
`order-sheet-coverage` (3), `order-sheet-responsibles` (6), `read-only` (1), `order-list-section` (4),
`order-list-section-produced` (2, `getByText` del número), `shared-ui/confirm-dialog-montado` (1).
`pedidos-viewport`, `a11y-tactil` y `tablas-marca` pasan sin cambios.
Snapshot: `tests/unit/paridad/__snapshots__/pedidos-paridad.test.tsx.snap` (7 actualizados,
+123/−54): cabecera `PageShell`/`PageHeader` (clases del `h1` y contenedores), `ul data-table-cards`
con una tarjeta por pedido, `@container` en `data-table` y `@max-[760px]:hidden` en la caja de la
tabla, y filtro de cliente `max-w-full w-64`. Nada fuera de la fila de `design.md > 6`.

**R → test.**
- R1 → `pedidos-page-header.test.tsx` (PageShell > PageHeader; único `h1` «Pedidos» con
  `pedidos-title`; «Nuevo pedido» en `page-header-actions`, 44 px, abre el panel).
- R2 → `order-table.test.tsx` (una sola barra; buscador, cliente y chips Estado, Prioridad, Fecha de
  solicitud en ese orden; ningún control de filtro fuera).
- R3 → `order-customer-filter.test.tsx` (contenedor `w-64 max-w-full`, sin `w-full` ni `*:w-full`).
- R4 → `order-customer-filter.test.tsx` (misma dirección al elegir) + los R34 de hoy.
- R15 → `order-cards.test.tsx` (campos, orden, monoespaciada, «Acciones» de 44 px con
  `data-order-id`, diálogo «Pedido <n>» con ítems de 48 px y «Cerrar», el ítem abre lo suyo).
- R17 → `order-cards.test.tsx` (vacío, sin coincidencias, paginación única). El aviso «en vuelo» y el
  error siguen cubiertos por `order-table.test.tsx` y `order-list-section.test.tsx`, en verde con
  tarjetas.
- R19 → `order-sheet.test.tsx` (2 casos).

**Salida.**
- `pnpm run typecheck`: sin errores.
- `pnpm run lint`: 0 errores, 7 avisos ajenos (`confirm-catalog-import.test.ts`, `order-service.test.ts`).
- `pnpm exec vitest related --run` de los 3 archivos de producción: 66 archivos, 1408 pasan,
  **6 fallan**.
- `pnpm exec vitest run guard`: 76 archivos, 1052 pasan, 20 omitidos, 0 fallan.
- `pnpm exec vitest run tests/unit/pedidos-ui tests/unit/paridad/pedidos-paridad tests/unit/marca`:
  61 archivos, 1151 pasan, 3 omitidos, **6 fallan**.
- Los 6 rojos son los mismos en los dos comandos: archivos de la Tanda 5, que no se tocan aquí.
  Fallan con «Found multiple elements by: [data-testid="order-row-actions"]», que es el duplicado
  de tarjeta. Falta acotar a `data-table-row-<id>`:
  - `order-customer-dialog.test.tsx:238`
  - `order-delivery-sheet.test.tsx:608`
  - `order-distribution-dialog.test.tsx:219, 398, 409`, y probablemente también 172, 196, 381 y
    440, que usan el mismo localizador.

**Desviaciones.**
1. Los 6 rojos de arriba están en archivos de la Tanda 5. Según el brief no se tocan.
2. R19 queda afirmado dos veces: aquí en `order-sheet.test.tsx` y en `order-form.test.tsx`
   (Tanda 5).

Veredicto: T4a, T4b y T4c hechas. Typecheck, lint y guardias en verde. Quedan 6 rojos de duplicado
de tarjeta en tres tests de diálogos de la Tanda 5.

## Tanda 6 — E2E (frontend_dev, 2026-10-13)

**Archivos.**
- `e2e/pedidos-rediseno.spec.ts` (nuevo, T6a): seis casos, fixture propio `qc262_e2e_`. Hay un
  PENDIENTE con cliente, un POR_EMPACAR y un TERMINADO con una línea, y un insumo con lote de 500
  para «Material insuficiente». No confirma nada.
- `e2e/helpers/order-distribution.ts` (T6b): `orderMenuTrigger` acotado a `data-table-row-<id>`.
- `e2e/pedido-en-varias-presentaciones.spec.ts` (T6b): `rowActions` acotado a `data-table-row-<id>`.
- `e2e/entregar-producto-terminado.spec.ts` (T6b): el `toHaveCount(0)` de :622 se acota a
  `orderRow(page, id)`, y sigue valiendo.
- `tests/guards/guard-identificador-de-request.test.ts`: alta de `pedidos-rediseno.spec.ts` en
  `E2E_ESPERADOS`, con el comentario de T6a y «Lo que ejercita: …».
- `tests/unit/shared/data-table-alcance.test.ts`: alta de `e2e/pedidos-rediseno.spec.ts`, con el
  comentario de T6a. Además entran `e2e/helpers/order-distribution.ts` y
  `e2e/pedido-en-varias-presentaciones.spec.ts`, porque al acotarlos nombran `data-table-row-`
  (nota propia). El centinela pasa de 42 a 45, no de 40 a 41 como dice `design.md > 7`:
  `anular-entrega` y `detalle-de-producto-terminado` ya habían entrado antes.

**R → test** (`e2e/pedidos-rediseno.spec.ts`):

| R | Caso |
| --- | --- |
| R2, R11, R14, R16 | «a 1440 px: una sola barra en orden, menú con separador y destructivos, y doce columnas con el número fijado» |
| R15 | «a 820 px: la lista se pinta en tarjetas» y «a 390 px: la barra no desborda y «Acciones» abre el menú centrado…» |
| R3 | «a 390 px: la barra no desborda…» |
| R18 | «a 390 px: «Cancelar el pedido», «Eliminar el pedido», «Cliente» y «Reparto y unidad»…» y «a 390 px: «Material insuficiente»…» |
| R19 | «a 390 px: los paneles de alta, edición y entrega ocupan toda la pantalla con el pie visible» |

**Salida** (cada spec por separado; `pnpm exec playwright test e2e/<spec>.spec.ts --project=<p>`):

| Spec | chromium | webkit |
| --- | --- | --- |
| `pedidos-rediseno` | 6 passed (27.0s) | 6 passed (32.2s) |
| `pedidos` | 2 passed (17.5s) | — |
| `pedido-con-cliente` | 4 passed (23.8s) | — |
| `pedido-en-varias-presentaciones` | 2 passed (40.3s) | — |
| `entregar-producto-terminado` | 2 passed (20.8s) | — |
| `pedidos-responsables` | 1 passed (20.8s) | — |
| `reserva-de-material` | 1 passed (49.1s) | — |
| `pedidos-busqueda` | 5 passed (26.4s) | — |
| `anular-entrega` | 2 passed (15.7s) | — |
| `detalle-de-producto-terminado` | 2 passed (18.2s) | — |
| `pedidos-cotizacion` | 2 passed (25.9s) | — |
| `pedido-bloqueado` | 1 passed (21.6s) | — |
| `aislamiento-pedidos` | 1 passed (15.8s) | — |
| `empaque` | 1 passed (26.2s) | — |
| `envases-del-pedido` | 2 passed (37.7s) | — |
| `pedido-conversion-de-unidad` | 2 passed (12.7s) | — |
| `producto-terminado` | 1 passed (38.4s) | — |
| `pedidos-terminados` | 4 passed (15.4s) | — |

Además, sin fallos:
- `pnpm run typecheck`: exit 0.
- `pnpm run lint`: 0 errores; 7 avisos ajenos (`confirm-catalog-import.test.ts`, `order-service.test.ts`).
- `pnpm exec vitest run guard-identificador-de-request data-table-alcance`: 2 archivos, 41 pasan y
  2 omitidos.
- `pnpm exec vitest run guard`: 76 archivos, 1052 pasan y 20 omitidos.

**Medidas que afirma el spec** (Chromium, caja `boundingBox` en px). Los valores se sacaron en una
pasada con registro temporal, retirado después; WebKit pasa las mismas aserciones.

- **1440 × 900**
  - Barra, de izquierda a derecha:
    - buscador: x 300, ancho 380, alto 44;
    - cliente: x 688, ancho 256;
    - chips: x 952, ancho 369; dentro van «Estado», «Prioridad» y «Fecha de solicitud».
  - Tabla:
    - Las doce `data-table-head-<id>` están en el orden de R16.
    - El número va con `data-pinned="left"` y `position: sticky`.
    - La caja de la tabla tiene `overflow-x: auto`, con `scrollWidth` 2478 y `clientWidth` 1112.
    - Desplazada hasta el final, la celda del número sigue en x 300.
    - El documento no desborda.
  - Menú de la fila:
    - POR_EMPACAR: Editar, Responsables, Cliente, Reparto y unidad, separador, Cancelar y Eliminar.
    - TERMINADO: Editar, Responsables, Cliente, Entregas, Entregar, separador, Cancelar y Eliminar.
    - Cancelar y Eliminar llevan `data-variant="destructive"`; el resto, no.
- **820 × 1180**
  - Tarjetas a la vista y filas ocultas.
  - «Acciones» mide 97.7 × 44.
- **390 × 844**
  - Barra (x 16, ancho 358):
    - buscador: 358 × 44;
    - cliente: y 236, ancho 256, debajo del buscador;
    - chips: y 288, 358 × 96.
    - Nada sale de la barra y el documento no desborda.
  - «Acciones» mide 97.7 × 44 y lleva `data-order-id`.
  - El diálogo «Pedido <n>» mide 358 × 385, va en x 16 → 374 e y 229.5 → 614.5, y tiene un separador.
    Sus ítems miden 326 × 48.
  - Diálogos, todos con botones de 44 px de alto:

    | Diálogo | Caja | y |
    | --- | --- | --- |
    | «Cancelar el pedido» | 320 × 335 | 254.5 → 589.5 |
    | «Eliminar el pedido» | 320 × 231 | 306.5 → 537.5 |
    | «Cliente» (con «Quitar cliente») | 358 × 345 | 249.5 → 594.5 |
    | «Reparto y unidad» | 358 × 517 | 163.5 → 680.5 |
    | «Material insuficiente» | 320 × 251 | 296.5 → 547.5 |

    Todos quedan enteros y centrados con 2 px de tolerancia. En «Material insuficiente», «Volver»
    no escribe el pedido: el recuento de la base no cambia.
  - Paneles:
    - alta, edición y entrega miden 390 × 844, en x 0 e y 0;
    - los botones del pie («Cancelar» y «Guardar» / «Entregar») miden 44 de alto, con el borde
      inferior en 828, por debajo de 844.

**Desviaciones y hallazgos.**
1. **Hallazgo de producción, sin tocar.** A 390 px, una receta cuyo nombre es una sola palabra
   larga desborda el documento. Con el fixture `qc262_e2e_<32 hex>_receta` (50 caracteres sin
   espacios), `scrollWidth` llegó a 478. El texto de `data-table-card-field-recipeName`
   (`components/shared/data-table/data-table-cards.tsx`) no se parte, porque la tarjeta no lleva
   `break-words` ni `min-w-0`. El spec usa un nombre con espacios, como uno real
   (`Receta <12 hex> pedidos`). Decide el leader: deuda, o arreglo en la pieza compartida, que
   está fuera de «Archivos esperados».
2. `data-table-alcance` gana dos entradas más de las previstas, por el acotado de T6b (arriba).
3. R18 mide solo los botones de acción. La X de 32 px queda fuera (D55, decisión del leader).

Veredicto: T6a y T6b hechas; el spec nuevo pasa en chromium y webkit, los 17 specs de pedidos pasan
en chromium, y typecheck, lint y guardias están en verde. Queda un hallazgo de producción
(desbordamiento de palabras largas en la tarjeta) para el leader.
