# QC-262 — rediseno-pedidos · tasks.md

Verificación de cada tanda (`docs/perfil-agentes.md > Todos los agentes`): `pnpm run typecheck`,
`pnpm run lint`, `pnpm exec vitest related --run <archivos de la tanda>` y
`pnpm exec vitest run guard`. Los E2E se corren por spec (`pnpm exec playwright test <spec>`) en la
tanda 6, que cierra con `./init.sh --completo` (lección de QC-261 y QC-265: el gate rápido no ve las
listas cerradas sin relación con el diff).

`[P]` = puede ir en paralelo con las otras `[P]` de su tanda. Antes de la tanda 1, el humano cierra
P1–P12 de `requirements.md` (o acepta los valores por defecto).

## Tanda 0 — Censo y medidas (antes de tocar producción)

- [x] **T0a. Censo con grep.** En `tests/unit`, `tests/ui`, `tests/guards`, `tests/integration` y
  `e2e`, cada símbolo, texto o testid que la ficha cambia o duplica: `OrderStatusBadge`,
  `OrderPriorityBadge`, `OrderCoverageBadge`, `STATUS_VARIANTS`, `variant=` sobre `order-status`,
  `order-priority`, `order-coverage`, `order-row-actions`, `data-order-id`, `order-action-`,
  `OrderRowSheetActions`, `OrderRowActions`, `buildOrderColumns`, `ACTIONS_COLUMN_ID`,
  `pedidos-title`, `order-customer-filter`, `order-missing-`, `data-table-row-`, `data-table-card`.
  Marcar los localizadores de página entera que con tarjetas encuentran dos elementos.
  *Hecho:* `progress/impl_QC-262.md` tiene la tabla «archivo → qué nombra → qué le pasa»; todo archivo
  que salga y no esté en `## Archivos esperados` se añade a esa sección en el mismo commit.
- [x] **T0b. Medidas.** Con el servidor de desarrollo, en `/pedidos` a 390 × 844: ancho del filtro de
  cliente con `w-64 max-w-full` (D2), ancho del panel de alta con `max-sm:w-full` (D8) y si algún
  diálogo no cabe. *Hecho:* lo medido queda en el impl; si difiere de `design.md > D2` o `> D8`, se
  anota como desviación antes de la tanda 3.

## Tanda 1 — Pieza compartida (depende de T0a)

- [x] **T1a. Separador en `RowActionsMenu`** (D7, R14). `separatorBefore?` en `RowActionMenuItem`;
  separador en el desplegable y en el diálogo centrado, nunca delante del primer ítem. Test
  `tests/unit/shared-ui/row-actions-menu-separator.test.tsx`: con la prop hay un `role="separator"`
  antes del ítem en las dos presentaciones; en el primer ítem no; sin la prop el árbol es el de hoy
  (`row-actions-menu-centrado.test.tsx` y `row-actions-menu-href.test.tsx` sin cambios).
- [x] **T1b. Catálogo** (R24; depende de T1a). Fila de `RowActionsMenu`: `separatorBefore` en
  «Puntos de extensión» y en «Cubre»; `Diseño` sigue `docs/diseno/canvas/Tabla.dc.html`. *Hecho:*
  `pnpm exec vitest run guard-catalogo-de-componentes catalogo-qc256` en verde.

## Tanda 2 — Estado, prioridad, cobertura y versión (depende de T0a) [P con 1]

- [x] **T2a [P]. Badges de la ruta** (D3, R5–R8). `order-status-badge.tsx` sobre `StatusBadge` y
  `PriorityMark`, mismos exports. Test `tests/unit/pedidos-ui/order-status-badges.test.tsx`: cada
  estado con su tono y etiqueta, cada prioridad con su nivel (Crítica = 4) y cada cobertura con su
  tono; `data-testid` y `data-*` de hoy. Guardia `tests/guards/guard-pedidos-rediseno.test.ts` (R8),
  con un caso que demuestra que muerde. Enmienda de `tests/unit/marca/badges-estado.test.tsx` R3–R5
  (`design.md > 10`). Tests de `design.md > 7` que afirmaban la variante, actualizados.
- [x] **T2b [P]. Marca de la versión** (D4, R9). `recipe-version-select.tsx`; test en
  `recipe-version-select.test.tsx`: «por revisar» en `waiting`, «dada de baja» en `muted`, mismo valor
  enviado.

## Tanda 3 — Menú como datos y anfitrión (depende de T1a, T2a)

- [x] **T3a. `orderRowActionsSpec`** (D5, R10–R12). Función pura en `order-row-actions.tsx`;
  `OrderRowActions` pasa a envoltorio. Tests en `order-row-actions.test.tsx`: orden del R11,
  `separatorBefore` en «Cancelar», «Cancelar» y «Eliminar» destructivos, tabla de reglas del R12 por
  estado y permiso, `triggerLabel`, `title` «Pedido <n>», testids de hoy.
- [x] **T3b. Columna y anfitrión** (D5, R13; depende de T3a). `order-columns.tsx` con
  `actionsColumn({ menu })` y `onAction`; `order-table.tsx` con el pedido activo y un solo
  `OrderRowSheetActions`; `order-sheet.tsx` con el contrato nuevo. Tests en
  `order-row-wiring.test.tsx`: cada ítem abre su panel o diálogo para su pedido, «Editar» y
  «Responsables» abren el mismo `OrderSheet` en su sección, nunca dos abiertos, el diálogo cerrado
  sigue montado para animar. `order-columns.test.tsx` y `order-table.test.tsx` actualizados.
  *Hecho:* `guard-pantalla-pedidos-se-amplia`, `guard-formularios-y-acciones` y `guard-piezas-base`
  en verde (exclusiones que dejan de morder, retiradas).

## Tanda 4 — Página, barra y tarjetas (depende de T3b)

- [x] **T4a [P]. Cabecera** (D1, R1). `page.tsx` con `PageShell` y `PageHeader`. Test
  `tests/unit/pedidos-ui/pedidos-page-header.test.tsx`: un único `h1` «Pedidos» con `pedidos-title`
  y «Nuevo pedido» en las acciones de la cabecera.
- [x] **T4b [P]. Filtro de cliente** (D2, R2–R4). `order-customer-filter.tsx`; test en
  `order-customer-filter.test.tsx` (contenedor sin `w-full`) y en `order-table.test.tsx` (una sola
  `data-table-filters` con buscador, cliente y los tres chips, en ese orden; nada fuera).
- [x] **T4c. Tarjetas** (D6, R15–R17; depende de T4a). `card` y textos en `order-table.tsx`. Test
  `tests/unit/pedidos-ui/order-cards.test.tsx`: tarjeta con número, estado, receta, cliente,
  cantidad, fecha, prioridad y «Acciones» que abre el diálogo centrado «Pedido <n>»; vacío, sin
  coincidencias y paginación como hoy. Acotar al cuerpo visible los tests de `design.md > 7`
  (`order-list-section`, `pedidos-viewport`, `a11y-tactil`, `read-only`). Snapshot de
  `pedidos-paridad` actualizado (fila de `design.md > 6`).

## Tanda 5 — Paneles en teléfono y avisos (depende de T3b) [P con 4]

- [x] **T5a [P]. Panel a todo el ancho** (D8, R19, R20). `order-form.tsx` (clase del panel por debajo
  de 640 px); los diálogos solo si T0b encontró algo. Tests en `order-sheet.test.tsx` y
  `order-form.test.tsx`: clase del panel y textos del R20. Snapshot de `formularios-paridad` si
  cambia (fila de `design.md > 6`).
- [x] **T5b [P]. Avisos emergentes** (D9, R21). Test `tests/unit/pedidos-ui/pedidos-toasts.test.tsx`:
  cada éxito lanza un único `toast.success` con su texto, incluidos la entrega parcial y el plural de
  grupos; un error no lanza ninguno.

## Tanda 6 — E2E y cierre (depende de todas)

- [x] **T6a. E2E nuevo** `e2e/pedidos-rediseno.spec.ts` con los casos de `design.md > 7` (R2, R3,
  R11, R14–R16, R18, R19) y sus altas en `E2E_ESPERADOS` de
  `tests/guards/guard-identificador-de-request.test.ts` y en la lista cerrada de
  `tests/unit/shared/data-table-alcance.test.ts`, con el comentario «Alta el <fecha> (QC-262) por el
  MISMO motivo y en el MISMO sitio que las demas: la lista es CERRADA y darse de alta en ella es su
  punto de extension por diseno. El ancla NO se relaja -el archivo se nombra, uno a uno-. Lo que
  ejercita: …». *Hecho:* pasa en Chromium y WebKit; las dos guardias en verde.
- [x] **T6b. E2E existentes** (R4, R22, R23). Acotar a `data-table-row-<id>` los localizadores de
  página que T0a marcó (`e2e/helpers/order-distribution.ts`, `pedido-en-varias-presentaciones`,
  `entregar-producto-terminado` y los que salgan). *Hecho:* cada spec tocado pasa por separado; los
  de la tabla de `design.md > 7` que no se tocan pasan sin cambios.
- [x] **T6c. Deudas y cierre.** `progress/deudas.md`: D37 resuelta; dueño de D38–D40 a «sin
  asignar»; D53 ampliada a `/pedidos`; nuevas de P5 y P10 si quedan por defecto.
  `./init.sh --completo` en verde.

## Trazabilidad R → test

| R | Test |
| --- | --- |
| R1 | `tests/unit/pedidos-ui/pedidos-page-header.test.tsx` |
| R2 | `tests/unit/pedidos-ui/order-table.test.tsx`, `e2e/pedidos-rediseno.spec.ts` |
| R3 | `tests/unit/pedidos-ui/order-customer-filter.test.tsx`, `e2e/pedidos-rediseno.spec.ts` |
| R4 | `tests/unit/pedidos-ui/order-table.test.tsx`, `tests/unit/pedidos-ui/order-customer-filter.test.tsx`, `e2e/pedidos-busqueda.spec.ts` |
| R5, R6, R7 | `tests/unit/pedidos-ui/order-status-badges.test.tsx`, `tests/unit/marca/badges-estado.test.tsx`, `tests/unit/pedidos-ui/order-sheet-coverage.test.tsx` (R7) |
| R8 | `tests/guards/guard-pedidos-rediseno.test.ts` |
| R9 | `tests/unit/pedidos-ui/recipe-version-select.test.tsx` |
| R10, R11, R12 | `tests/unit/pedidos-ui/order-row-actions.test.tsx`, `e2e/pedidos-rediseno.spec.ts` (R11) |
| R13 | `tests/unit/pedidos-ui/order-row-wiring.test.tsx` |
| R14 | `tests/unit/shared-ui/row-actions-menu-separator.test.tsx`, `e2e/pedidos-rediseno.spec.ts` |
| R15, R17 | `tests/unit/pedidos-ui/order-cards.test.tsx`, `e2e/pedidos-rediseno.spec.ts` (R15) |
| R16 | `tests/unit/pedidos-ui/pedidos-viewport.test.tsx`, `e2e/pedidos-rediseno.spec.ts` |
| R18, R19 | `e2e/pedidos-rediseno.spec.ts`, `tests/unit/pedidos-ui/order-sheet.test.tsx` (R19) |
| R20 | `tests/unit/pedidos-ui/order-form.test.tsx`, `cancel-order-dialog.test.tsx`, `delete-order-dialog.test.tsx`, `blocked-order-dialog.test.tsx`, `order-customer-dialog.test.tsx`, `order-distribution-dialog.test.tsx`, `order-delivery-sheet.test.tsx` |
| R21 | `tests/unit/pedidos-ui/pedidos-toasts.test.tsx` |
| R22 | `tests/unit/pedidos-ui/order-columns.test.tsx`, `tests/unit/paridad/pedidos-paridad.test.tsx` |
| R23 | `e2e/pedidos.spec.ts`, `e2e/pedido-con-cliente.spec.ts`, `e2e/pedido-en-varias-presentaciones.spec.ts`, `e2e/entregar-producto-terminado.spec.ts`, `e2e/pedidos-responsables.spec.ts`, `e2e/reserva-de-material.spec.ts` |
| R24 | `tests/guards/guard-catalogo-de-componentes.test.ts`, `tests/unit/shared-ui/catalogo-qc256.test.ts` |

## Archivos esperados

Producción:

- `app/(private)/pedidos/page.tsx`
- `app/(private)/pedidos/components/index.ts`
- `app/(private)/pedidos/components/order-status-badge.tsx`
- `app/(private)/pedidos/components/order-row-actions.tsx`
- `app/(private)/pedidos/components/order-columns.tsx`
- `app/(private)/pedidos/components/order-table.tsx`
- `app/(private)/pedidos/components/order-sheet.tsx`
- `app/(private)/pedidos/components/order-list-section.tsx`
- `app/(private)/pedidos/components/order-customer-filter.tsx`
- `app/(private)/pedidos/components/order-form.tsx`
- `app/(private)/pedidos/components/recipe-version-select.tsx`
- `app/(private)/pedidos/components/order-delivery-sheet.tsx`
- `app/(private)/pedidos/components/cancel-order-dialog.tsx`
- `app/(private)/pedidos/components/delete-order-dialog.tsx`
- `app/(private)/pedidos/components/blocked-order-dialog.tsx`
- `app/(private)/pedidos/components/order-customer-dialog.tsx`
- `app/(private)/pedidos/components/order-distribution-dialog.tsx`
- `components/shared/row-actions-menu.tsx`
- `components/shared/CATALOGO.md`

Tests y guardias:

- `tests/unit/shared-ui/row-actions-menu-separator.test.tsx`
- `tests/unit/shared-ui/row-actions-menu-centrado.test.tsx`
- `tests/unit/shared-ui/row-actions-menu-href.test.tsx`
- `tests/unit/shared-ui/catalogo-qc256.test.ts`
- `tests/unit/pedidos-ui/order-status-badges.test.tsx`
- `tests/unit/pedidos-ui/pedidos-page-header.test.tsx`
- `tests/unit/pedidos-ui/order-cards.test.tsx`
- `tests/unit/pedidos-ui/pedidos-toasts.test.tsx`
- `tests/unit/pedidos-ui/order-row-actions.test.tsx`
- `tests/unit/pedidos-ui/order-row-wiring.test.tsx`
- `tests/unit/pedidos-ui/order-columns.test.tsx`
- `tests/unit/pedidos-ui/order-table.test.tsx`
- `tests/unit/pedidos-ui/order-list-section.test.tsx`
- `tests/unit/pedidos-ui/pedidos-viewport.test.tsx`
- `tests/unit/pedidos-ui/a11y-tactil.test.tsx`
- `tests/unit/pedidos-ui/read-only.test.tsx`
- `tests/unit/pedidos-ui/order-sheet.test.tsx`
- `tests/unit/pedidos-ui/order-sheet-coverage.test.tsx`
- `tests/unit/pedidos-ui/order-sheet-responsibles.test.tsx`
- `tests/unit/pedidos-ui/order-form.test.tsx`
- `tests/unit/pedidos-ui/recipe-version-select.test.tsx`
- `tests/unit/pedidos-ui/order-customer-filter.test.tsx`
- `tests/unit/pedidos-ui/cancel-order-dialog.test.tsx`
- `tests/unit/pedidos-ui/delete-order-dialog.test.tsx`
- `tests/unit/pedidos-ui/blocked-order-dialog.test.tsx`
- `tests/unit/pedidos-ui/order-customer-dialog.test.tsx`
- `tests/unit/pedidos-ui/order-distribution-dialog.test.tsx`
- `tests/unit/pedidos-ui/order-delivery-sheet.test.tsx`
- `tests/unit/marca/badges-estado.test.tsx`
- `tests/unit/marca/tablas-marca.test.tsx`
- `tests/unit/paridad/pedidos-paridad.test.tsx`
- `tests/unit/paridad/__snapshots__/pedidos-paridad.test.tsx.snap`
- `tests/unit/paridad/formularios-paridad.test.tsx`
- `tests/unit/paridad/__snapshots__/formularios-paridad.test.tsx.snap`
- `tests/unit/paridad/confirmaciones-paridad.test.tsx`
- `tests/unit/paridad/__snapshots__/confirmaciones-paridad.test.tsx.snap`
- `tests/guards/guard-pedidos-rediseno.test.ts`
- `tests/guards/guard-pantalla-pedidos-se-amplia.test.ts`
- `tests/guards/guard-piezas-base.test.ts`
- `tests/guards/guard-formularios-y-acciones.test.ts`
- `tests/guards/guard-identificador-de-request.test.ts`
- `tests/unit/shared/data-table-alcance.test.ts` (lista cerrada de E2E que nombran `data-table`; alta de QC-262)

E2E:

- `e2e/pedidos-rediseno.spec.ts`
- `e2e/helpers/order-distribution.ts`
- `e2e/pedido-en-varias-presentaciones.spec.ts`
- `e2e/entregar-producto-terminado.spec.ts`
- `e2e/pedidos.spec.ts`
- `e2e/pedidos-busqueda.spec.ts`
- `e2e/pedidos-cotizacion.spec.ts`
- `e2e/pedidos-responsables.spec.ts`
- `e2e/pedido-con-cliente.spec.ts`
- `e2e/pedido-bloqueado.spec.ts`
- `e2e/reserva-de-material.spec.ts`
- `e2e/aislamiento-pedidos.spec.ts`
- `e2e/empaque.spec.ts`
- `e2e/envases-del-pedido.spec.ts`
- `e2e/pedido-conversion-de-unidad.spec.ts`
- `e2e/producto-terminado.spec.ts`
- `e2e/pedidos-terminados.spec.ts`

Añadidos por el leader el 2026-10-13 (censo de T0a):

- `app/(private)/pedidos/components/order-delivery-list.tsx`
- `tests/unit/shared-ui/confirm-dialog-montado.test.tsx`
- `tests/unit/pedidos-ui/order-list-section-produced.test.tsx`
- `tests/unit/pedidos-ui/order-list-skeleton.test.tsx`
- `tests/unit/pedidos/scope.test.ts` (R57: alta de `e2e/pedidos-rediseno.spec.ts`)
- `tests/unit/clientes/scope.test.ts` (R28: alta en `E2E_PERMITIDOS` con su nota)

Estado:

- `progress/impl_QC-262.md`
- `progress/deudas.md`
- `progress/features/QC-262.md`
