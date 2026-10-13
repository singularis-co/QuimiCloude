# QC-265 — rediseno-operario · bitácora del implementer

Worktree `.worktrees/QC-265-rediseno-operario`, rama `feature/QC-265-rediseno-operario`.
Spec: `specs/QC-265-rediseno-operario/`. P1–P16 con la opción por defecto (F1.4).

**Nombre de la bitácora.** `tasks.md` la llamaba `progress/impl_QC-265-rediseno-operario.md`; el
leader pidió `progress/impl_QC-265.md` (la forma de QC-260 y QC-261). Se usa la del leader y se
corrige la línea de `tasks.md > ## Archivos esperados` en el commit de la tanda 0.

## Tanda 0 — Censo y comprobaciones

Gate de partida: `./init.sh` → `== init OK ==` (2 min 8 s) antes de tocar nada.

### T0a. Censo (grep en `tests/unit`, `tests/guards`, `tests/integration`, `e2e`)

Los archivos que el grep encuentra y **ya** están en `## Archivos esperados` se tocan en la tanda
que dice `design.md > 7`. La tabla recoge los que salen y **no** están en la lista:

| Archivo | Qué nombra | Qué le pasa |
| --- | --- | --- |
| `e2e/ejecucion-receta.spec.ts` | comentario «el `data-testid` que exporta `AssignedOrderDeliveredNotice`» + literal `assigned-order-delivered-notice` | Nada: el testid se conserva (D8) y no importa el componente. Se corre en T8 (R45). |
| `e2e/producto-terminado.spec.ts`, `e2e/reserva-de-material.spec.ts` | literal `assigned-order-delivered-notice` | Nada: testid conservado, sin `import`. |
| `e2e/envases-del-pedido.spec.ts`, `e2e/pedidos-cotizacion.spec.ts` | constante local `MISSING_VALUE_MARK = '—'` | Nada: es local, no del barrel de asignación. |
| `tests/unit/shared-ui/responsible-avatars.test.tsx`, `tests/unit/pedidos-ui/*`, `tests/guards/guard-pantalla-pedidos-se-amplia.test.ts` | `MISSING_VALUE_MARK` de `pedidos/components` | Nada: otro barrel (R43 es solo el de asignación). |
| `tests/unit/shared/data-table-alcance.test.ts` | comentario sobre `packing-order-link` | Nada en el comentario. Si el e2e nuevo referencia `data-table`, se da de alta en su lista cerrada (T8) y entonces se añade a la lista. |
| `tests/unit/shared-ui/url-tabs.test.tsx` | `'Terminados'` como dato de prueba | Nada (ya lo dice `design.md > 7`). |
| `e2e/marca-componentes.spec.ts`, `e2e/movimiento.spec.ts`, `tests/unit/sidebar-desktop.test.tsx`, `tests/unit/theme/sidebar-panel.test.tsx`, `tests/unit/shell/control-barra.test.tsx`, `tests/unit/theme/private-header.test.tsx` | `data-slot="sidebar"` / `private-header` | Nada: el layout y `sidebar.tsx` no cambian; la regla CSS solo actúa con `[data-operator-screen]` en la página. |
| `tests/unit/identity/*`, `tests/integration/identity/login.int.test.ts`, `tests/unit/pedidos/*`, `tests/unit/proveedores/*`, `tests/unit/paridad/__snapshots__/formularios-paridad.test.tsx.snap` | «esta dada de baja» de otros módulos | Nada: R39 solo cubre las tres constantes del operario. |
| `tests/guards/guard-despliegue-preview.test.ts`, `tests/unit/recetas/*`, `tests/unit/scripts/build.test.ts` | «ningun paso» de otros contextos | Nada (mismo motivo). |

Ningún archivo nuevo entra en `## Archivos esperados` por el censo.

### T0b. Selector de D2

`components/ui/sidebar.tsx:219-260`: en escritorio el envoltorio `div[data-slot="sidebar"]`
(`group peer hidden md:block`) contiene a `sidebar-gap` (el hueco) y a `sidebar-container`
(`fixed`). Ocultarlo con `display: none` quita el hueco y la barra fija, y `SidebarInset` (hermano
siguiente dentro de `sidebar-wrapper`) arranca en x = 0. En móvil la barra es un `Sheet` cerrado
(portal) que tampoco ocupa sitio. **Selector = el de `design.md > D2`**, sin desviación. La
comprobación en navegador la cubre el e2e de R1 (T8a: x de `private-content` = 0).

## Tandas

| Tanda | Commit | Gate |
| --- | --- | --- |
| 0 | `63f89d15` | init OK |
| 1 | `24e1affb` | init OK (un solo `./init.sh` tras 1 y 2, corridas en paralelo) |
| 2 | `c245a423` | init OK |
| 3 (T3a, T3b) | ver `git log` | init OK (un solo `./init.sh` tras 3 y 4) |
| 4 | ver `git log` | init OK |
| 5 | ver `git log` | init OK (un solo `./init.sh` tras 5 y 6) |
| 6 | ver `git log` (lleva el `.snap` compartido) | init OK |
| 7 | ver `git log` | init OK (al segundo intento; ver Tanda 7) |

## Bloqueos para el leader

1. **T3c/T3d (y lo que dependa en T8b).** «Por empacar» no es `DataTable`: es una tabla de servidor
   sin archivo `*-table.tsx`. Para el menú ⋯ y las tarjetas (D9, R18–R21) hace falta (a) un archivo de
   cliente nuevo, p. ej. `app/(private)/asignacion/components/assignment-row-actions.tsx` (el spec ya
   nombra `assignment-row-actions.test.tsx`), y (b) decidir si «Por empacar» pasa a `DataTable` con
   un `packing-orders-table.tsx` nuevo, lo que obliga a tocar `tests/unit/marca/tablas-marca.test.tsx`.
   Ninguno de los tres está en `## Archivos esperados`, y (b) es una decisión de diseño.
2. **E2E fuera de la lista (T4, desvío 2).** El `h1` de la ejecución es ahora la receta (R23, D3), y
   `e2e/envases-del-pedido.spec.ts` y `e2e/pedido-en-varias-presentaciones.spec.ts` afirman
   «<n> - <receta>». Hay que añadirlos a `## Archivos esperados` para migrarlos en T8b.

## Tanda 1 — Piezas compartidas (frontend_dev)

Archivos:
- creados `components/shared/countdown-ring.tsx`, `tests/unit/shared/countdown-ring.test.tsx`,
  `tests/unit/shared-ui/notice-dismiss.test.tsx`
- modificados `components/shared/step-reader/step-reader.tsx` (usa `CountdownRing` con
  `testId="step-reader-wait-ring"`; `WaitRing` borrado), `components/shared/countdown-gated-button.tsx`,
  `components/shared/notice.tsx` (`'use client'`, `dismissible?`),
  `tests/unit/shared/countdown-gated-button.test.tsx`, `components/shared/CATALOGO.md`
- snapshot `tests/unit/paridad/__snapshots__/asignacion-acondicionamiento-paridad.test.tsx.snap`:
  una línea, el `svg` del anillo en el diálogo de terminar (fila de `design.md > 6`, R37).
  `confirmaciones-paridad` no cambió.

Mapa R → test: R15 → `notice-dismiss.test.tsx` (3 casos) · R37 → `countdown-gated-button.test.tsx`
(3 casos `R37:`) · R38 → `countdown-ring.test.tsx` (6 casos) y `step-reader.test.tsx` · R44 →
`guard-catalogo-de-componentes`.

Verificación: typecheck OK; lint 0 errores (7 avisos ajenos); `vitest related` 912 pasan + el
snapshot de arriba actualizado (36/36); `vitest run guard` 74 archivos OK; `step-reader` +
`order-execution-screen` + `notice` OK.

Desvíos: (1) el anillo del botón no lleva `key` propia: `CountdownTimer` tampoco la lleva y la `key`
del botón reinicia los dos; (2) `size-5` en el anillo porque `Button` fuerza los `svg` a 16 px;
(3) catálogo: `StepReader` gana `CountdownRing` en `Base de` y `Notice` gana `Button`.

## Tanda 2 — Marco del operario (frontend_dev)

### T2a. `OperatorScreenFrame` y regla de CSS

Archivos:
- creado `app/(private)/asignacion/components/operator-screen-frame.tsx` (sin `'use client'`; fuera del barrel `index.ts`, D3)
- modificado `app/(private)/components/theme-toggle.tsx` (`className?` opcional vía `cn`; sin cambio de salida para los usos de hoy)
- modificado `app/globals.css` (regla `body:has([data-operator-screen])` sobre `[data-slot="sidebar"]` y `[data-testid="private-header"]`)
- creado `tests/unit/asignaciones-ui/operator-screen-frame.test.tsx`
- creado `tests/unit/theme/operator-chrome-css.test.ts`

Mapa R → test:
- R1 → `operator-chrome-css.test.ts` (dos casos R1) + `operator-screen-frame.test.tsx` «R1: la raíz lleva data-operator-screen…»
- R2 → `operator-screen-frame.test.tsx` «R2: la cabecera es pegajosa…», «R2, R3: … Cambiar tema …», «R2, R3: el pie es fijo…»
- R3 → `operator-screen-frame.test.tsx` «R3: con back pinta un ArrowLink…» y los dos «R2, R3»
- R4 → `operator-screen-frame.test.tsx` «R4: la raíz es contenedor de consultas» (las columnas las pinta cada pantalla en T4–T6)
- R6 → `operator-chrome-css.test.ts` «R6: la regla depende de la marca del operario»

Verificación:
- `pnpm run typecheck` → sin errores
- `pnpm run lint` → 0 errors, 7 warnings (preexistentes, en `confirm-catalog-import.test.ts` y `order-service.test.ts`)
- `pnpm exec vitest related --run <archivos>` → 22 files, 325 passed
- `pnpm exec vitest run guard` → 74 files, 1007 passed, 20 skipped

Desvíos: ninguno. El pie reserva 132 px + margen seguro (alto del pie del tablero). Ningún snapshot cambió.

Veredicto: T2a hecha, en verde; ninguna pantalla usa el marco todavía.

## Tanda 3 — Asignación (frontend_dev) · T3a y T3b hechas; T3c y T3d paradas

Archivos:
- creados `app/(private)/asignacion/components/assignment-view-counts.ts`,
  `assignment-view-tabs-section.tsx`, `tests/unit/asignaciones-ui/assignment-view-tabs.test.tsx`,
  `tests/unit/asignaciones-ui/assignment-view-counts.test.ts`
- borrados `assigned-order-delivered-notice.tsx`, `assigned-order-cancelled-notice.tsx`,
  `assigned-orders-error.tsx`
- modificados `page.tsx` (pestañas en su `Suspense`, avisos con `OrderOutcomeNotice`),
  `components/index.ts`, `assignment-view-tabs.tsx` (sobre `UrlTabs`, `counts?`, sin `'use client'`),
  `order-outcome-notice.tsx` (cuatro `kind` sobre `Notice` con `dismissible` «Cerrar»),
  `conditioning-`/`conditioned-`/`delivered-conditioned-orders-list-section.tsx` (`AssignmentListError`),
  `e2e/registro-ejecucion.spec.ts` (solo el `import`), tests de avisos, `asignacion-page`,
  `a11y-tactil`, `assigned-orders-states`, comentarios en `company-`/`finished-`/`packing-orders-list-section.test.tsx`,
  `asignacion-paridad.test.tsx` (comentario), `guard-asignacion-componentizada.test.ts` (R14, R42),
  `guard-piezas-base.test.ts` (la fila de delegación de `assigned-orders-error.tsx` pasa a
  `assignment-list-parts.tsx`, que es quien delega ahora en `ErrorState`)
- snapshot `asignacion-acondicionamiento-paridad`: los dos avisos (`packed`, `conditioned`) pasan de
  `<p>` verde a `Notice` `success` con icono y «Cerrar» (fila de `design.md > 6`, R13). Nada más cambió;
  `asignacion-paridad` y `asignacion-listas-paridad` no pintan pestañas ni avisos y no cambiaron.

Mapa R → test: R7 → `assignment-view-tabs.test.tsx` «R7» y `asignacion-page.test.tsx` «R5, R7» ·
R9 → `assignment-view-tabs.test.tsx` «R9», «R9, R11» · R10 → `assignment-view-counts.test.ts` (3 «R10»)
y `assignment-view-tabs.test.tsx` «R10» · R11 → `assignment-view-counts.test.ts` (2 «R11»),
`asignacion-page.test.tsx` «R11: las pestañas van en su propio Suspense…» · R12 →
`assignment-view-tabs.test.tsx` (3 «R12») · R13 → los cuatro tests de avisos («R13») y
`asignacion-page.test.tsx` «R13 — qué aviso sale con cada parámetro» · R14, R42 →
`guard-asignacion-componentizada.test.ts` (2 muestras + 2 repositorio) · R15 →
`packed-order-notice.test.tsx` «R15» (los cuatro `kind`).

Verificación:
- `pnpm run typecheck` → 0 errores
- `pnpm run lint` → 0 errors, 7 warnings (preexistentes)
- `pnpm exec vitest related --run <archivos>` → 36 files, 468 passed (tras actualizar el snapshot de arriba)
- `pnpm exec vitest run guard` → 74 files, 1011 passed, 20 skipped

Desvíos: (1) las pestañas de `UrlTabs` llevan `min-h-11` pero no `min-w-11`; los tests de
`asignacion-page` afirman el alto y que hay etiqueta (el ancho lo dan el relleno y el texto).
(2) **T3c parada**: «Por empacar» es una tabla de servidor (sin `DataTable`) y `RowActionsMenu` pide
el icono como componente, que no cruza de servidor a cliente; hace falta un archivo de cliente nuevo
(`assignment-row-actions.tsx`) fuera de `## Archivos esperados`, y decidir las tarjetas de «Por
empacar» (pasarla a `DataTable` rompe `tests/unit/marca/tablas-marca.test.tsx`, fuera de la lista).
T3d depende de T3c.

## Tanda 4 — Ejecución (frontend_dev)

Archivos:
- nuevo `app/(private)/asignacion/[id]/components/order-execution-tools-panel.tsx` (`Card` +
  `Collapsible`, abierto al entrar, contenido montado al plegar; testids `order-execution-materials` y
  `-divider` se mudan aquí)
- modificados `order-execution-screen.tsx` (sobre `OperatorScreenFrame`, importado por su archivo;
  menú `RowActionsMenu` «Acciones del pedido <n>» con «Cancelar pedido»; dos columnas con
  `@min-[1101px]`; `RECIPE_MISSING_TEXT` → `ORDER_EXECUTION_TEXTS.recipeMissing` «Esta receta está dada
  de baja.»), `order-cancel-dialog.tsx` (`open?`/`onOpenChange?`), `order-execution-tools.tsx`
  (`labelledBy?`), `index.ts`, `components/shared/step-reader/step-reader.tsx` (solo `ejecucion`:
  `size="xl"`, rejilla 1fr/2fr, motivo encima, barra `fixed` con margen seguro y la sección reserva
  su alto) y `app/(private)/asignacion/components/operator-screen-frame.tsx` (`titleTestId?`, desvío 1)
- tests: `order-execution-screen`, `order-execution-page`, `order-cancel-dialog`,
  `order-execution-tools`, nuevo `order-execution-tools-panel`, `recetas-ui/step-reader`

Mapa R → test: R2 → `order-execution-screen` «QC-265 R2, R23: pinta el número…», `order-execution-page`
«QC-265 R1, R2» · R3 → `order-execution-screen` «R26: objetivos tactiles…» (xl/`size-11`/44) y
`order-execution-tools-panel` «QC-265 R3» · R23 → `order-execution-screen` (4 casos «QC-265 R23»),
`order-cancel-dialog` (2 «QC-265 R23: modo controlado» + flujo por el menú) · R24 →
`order-execution-tools-panel` (5 «QC-265 R24»), `order-execution-screen` «QC-265 R24: divisor»,
`order-execution-tools` «QC-265 R24» · R25 → `step-reader` (5 «QC-265 R25», incluido `lectura` sin
cambios) y `order-execution-screen` (2 «QC-265 R25»); bloqueo y espera: «R19», «R4», «R13» de hoy ·
R26 → `order-execution-screen` «Finalizar pide confirmar…» (3 casos) y «R18: el envio…» · R45 → los
casos de envío/errores de hoy en `order-execution-screen` y `order-cancel-dialog`, sin cambios.

Verificación:
- `pnpm run typecheck` → 0 errores
- `pnpm run lint` → 0 errors, 7 warnings (preexistentes, otros archivos)
- `pnpm exec vitest related --run <7 archivos de producción>` → 41 files, 790 passed
- `pnpm exec vitest run guard` → 74 files, 1011 passed, 20 skipped
- `confirmaciones-paridad` en verde sin regenerar: no cambió ningún caso (cancelar se pinta suelto
  con su disparador; finalizar solo afirma el portal del diálogo)

Desvíos: (1) `OperatorScreenFrame` gana `titleTestId?` (una prop opcional, como `PageHeader`) para
que el `h1` conserve `order-execution-title`, que leen 10 E2E; el archivo es de la tanda 2 y la tanda 3
no lo toca. (2) El `h1` es la receta (R23): los E2E que afirman `toHaveText('<n> - <receta>')`
(`envases-del-pedido`, `pedido-en-varias-presentaciones`) cambian en T8b; `formatOrderExecutionTitle`
y `ORDER_EXECUTION_RECIPE_MISSING_TESTID` se borran (solo los usaba el test unitario). (3) El menú ⋯
lleva `order-execution-actions`; su ítem conserva `order-cancel-trigger`. Los E2E que cancelen deben
abrir antes el menú (T8b). (4) `StepReader` ya no recibe `title` en la ejecución (el `h1` nombra la
receta). (5) El `ErrorAlert` de Finalizar va encima del paso y no al final, para que no lo tape el pie
fijo. (6) El pie fijo de `StepReader` afecta ya al empaque con pasos (la sección reserva su alto); T5
lo integra en el marco.

## Tanda 5 — Empaque (frontend_dev)

Archivos: `app/(private)/asignacion/empaque/[id]/components/packing-order-screen.tsx` (sobre
`OperatorScreenFrame` importado por archivo; textos en `PACKING_ORDER_TEXTS`, con tildes de R31/R39) e
`index.ts`; `tests/unit/asignaciones-ui/packing-order-screen.test.tsx`; 4 casos «paridad del empaque»
del snapshot `asignacion-acondicionamiento-paridad` (regenerados con `-u -t`, fila de § 6: marco,
`StatusBadge`, `Notice`, pie con dos `xl`; R2, R27–R31). `page.tsx` y `packing-order-page.test.tsx`
sin cambios (R45). `confirmaciones-paridad` sin cambios.

Mapa R → test (`packing-order-screen.test.tsx`, bloque «QC-265 — el empaque sobre el marco del
operario»): R2, R3, R4 (un caso cada uno) · R27 (2) · R28 (2) · R29 (2 + los de confirmar/enviar de
hoy) · R30 «QC-265 R30: con pasos, el pie es el del paso a paso…» · R31 (2, con y sin nombre) · R39
(2) · R45: casos de envío y error de hoy + `packing-order-page.test.tsx` intacto (56/56).

Verificación (del subagente, con T6 a medias): lint 0 errores; guard 74 archivos OK; sus 4 archivos
en verde. Gate conjunto tras T5+T6: init OK.

Desvíos: (1) el botón no aplicable se pinta deshabilitado y **sin** `data-testid` (el testid sigue
marcando el botón que abre la confirmación dentro de su `<form>`); (2) se borra
`PACKING_ORDER_NUMBER_TESTID` (`packing-order-number`): el número pasa al rótulo del marco; grep:
nadie más lo lee; (3) los `ErrorAlert` van encima del paso a paso para que el pie fijo no los tape;
con paso a paso el marco no pinta pie (R30); (4) sin pasos, la columna derecha queda vacía a > 1100 px
(R4/D11 al pie de la letra).

## Tanda 6 — Acondicionamiento (frontend_dev)

Archivos: en `app/(private)/asignacion/acondicionamiento/[id]/components/`
`conditioning-order-screen.tsx`, `conditioning-actions.tsx` (los dos botones `xl` del pie y los
diálogos), `conditioning-team-list.tsx` (avatares en la cabecera de la tarjeta);
`operator-screen-frame.tsx` gana `eyebrowTestId?` (aditivo; conserva `conditioning-order-number`, que
lee `e2e/acondicionamiento.spec.ts`); tests `conditioning-order-screen`, `conditioning-order-page`,
`start-conditioning-dialog`, `finish-conditioning-dialog`; 10 casos del snapshot
`asignacion-acondicionamiento-paridad` (con `-u -t`, fila de § 6: marco, R2, R32–R34). `page.tsx`,
`index.ts` y los dos diálogos no cambian de código. `confirmaciones-paridad` sin cambios.

Mapa R → test (`conditioning-order-screen.test.tsx` salvo indicación): R8 «R8 R32: en TERMINADO la
vuelta es «Volver a «Acondicionados»»…» · R32 «R15 R32: número, receta (único h1)…», «R11 R32: … en
un StatusBadge» · R33 «R33: «Equipo» es una tarjeta con los avatares…» · R34 los seis de «las acciones
del pie» y «R4 R34» · R35 `start-conditioning-dialog.test.tsx` «R35: … «Comenzar» bloqueado 5 s con el
anillo» · R36 `finish-conditioning-dialog.test.tsx` «R36: … bloqueado 5 s con el anillo».

Verificación: typecheck verde; lint 0 errores; `vitest related` 19 archivos, 351 verdes (incluye los
casos de empaque del snapshot compartido); guard 74 archivos, 1011 verdes. Gate: init OK.

Desvíos: (1) `eyebrowTestId?` en el marco (arriba); (2) por R34 el pie pinta siempre los dos botones,
el no aplicable deshabilitado, así que `e2e/acondicionar-con-equipo.spec.ts` (≈ líneas 270–273 y 466,
`toHaveCount(0)`) pasa a `toBeDisabled()` en T8b (§ 7 no lo recogía; el archivo sí está en la lista);
(3) «Cantidad:» y «Lo acondiciona …» van al subtítulo junto al reparto (D12 solo pedía el reparto; no
se pierde dato); el aviso de lote que falta pasa al pie, encima de los botones, y sigue describiendo
«Terminar»; (4) `conditioning-order-page.test.tsx`: «no ofrece el botón» pasa a «deshabilitado».

## Tanda 7 — Textos y toast (frontend_dev)

Archivos: `components/shared/step-reader/step-reader.tsx` («ningún paso»);
`app/(private)/asignacion/acondicionamiento/[id]/components/conditioning-batch-data-form.tsx` (un
`toast.success('Datos de lote guardados.')` por envío; sin el `<p>` de éxito);
`tests/unit/asignaciones-ui/conditioning-batch-data-form.test.tsx`;
`tests/guards/guard-asignacion-componentizada.test.ts` (reglas R38 y R39, muestra + repositorio).
El resto de R39 ya venía de T4/T5.

Mapa R → test: R38 → guardia «anillo y textos del operario > R38 …» y «repositorio > R38 … una sola
definición» (+ `countdown-ring.test.tsx` de T1) · R39 → guardia «… R39 …» (muestras) y «repositorio >
R39 … app/ y components/» · R40 → `conditioning-batch-data-form.test.tsx` «R1 R40 … un solo toast»,
«R40: un toast por envío…» y los dos «R5» (con error, sin toast) · el E2E de R40 se migra en T8.

Verificación: typecheck OK; lint 0 errores; `vitest related` 46 archivos, 900 verdes; guard 74
archivos, 1017 verdes. **Primer `./init.sh` en rojo**: `tests/unit/recetas-ui/recipe-route-contract.test.ts`
(QC-64 R12, lista cerrada de quién nombra el asistente; no está en `baseline-rojos.json`). Causa: la
muestra de R38 en la guardia usaba la ruta hipotética `components/shared/step-reader/step-reader.tsx`.
Arreglo (implementer, una línea): la muestra pasa a `components/shared/otra-pieza.tsx`; no se toca la
lista cerrada ni se relaja el ancla. Segundo `./init.sh`: **init OK**.

Desvíos: (1) R39 en `requirements.md` dice «código de producción»; la guardia mira `app/` y
`components/`, como `tasks.md` T7a y `design.md > D15`. Quedan «ningun paso» en comentarios de
`lib/modules/identity/.../session-token.ts:257`, `lib/modules/pedidos/domain/order-cost.ts:38` y
`lib/modules/recetas/domain/recipe-percentage.ts:3` (otros módulos, sin texto visible): sin tocar.
(2) `CONDITIONING_BATCH_DATA_SUCCESS_TESTID` sigue exportado hasta T8b, porque
`e2e/datos-de-lote-en-acondicionamiento.spec.ts` lo importa (línea 40); las líneas 727–731 esperan el
testid y pasan al toast en T8b.

## `./init.sh --completo` (tras la tanda 7; T3c, T3d y T8 pendientes)

Primer intento: **rojo nuevo** (fuera del baseline) en `tests/unit/shared-ui/catalogo-qc256.test.ts`.
Ese test fija con igualdad exacta la celda `Diseño` de `Notice` en `Avisos.dc.html`, y T1d (D7)
añade `Asignacion.dc.html`. El gate rápido no lo vio porque `vitest related` no relaciona un `.md`.
Es una lista cerrada de filas del catálogo que el cambio obliga a ajustar. La expectativa de `Notice`
pasa a los dos tableros y el archivo se añade a `## Archivos esperados`. Resultado: el test queda en
verde (6/6). Segundo `--completo`: **init OK**, 1160/1160 archivos y 17 310 tests en verde (141 saltados).

## Decisiones del leader (2026-10-12) y Tanda 3, T3c–T3d (frontend_dev)

Decisiones (también en `progress/features/QC-265.md > Decisiones` y en `design.md > D9`): (a) el menú ⋯
va en el componente de cliente nuevo `assignment-row-actions.tsx`; (b) «Por empacar» pasa a `DataTable`
con `packing-orders-table.tsx` nuevo, y entra `tests/unit/marca/tablas-marca.test.tsx`; (c)
`e2e/envases-del-pedido.spec.ts` y `e2e/pedido-en-varias-presentaciones.spec.ts` entran en la lista
para T8b. Los cinco archivos se añaden a `## Archivos esperados`.

Archivos: se crean `assignment-row-actions.tsx`, `packing-orders-table.tsx` y
`tests/unit/asignaciones-ui/assignment-row-actions.test.tsx`. Se modifican `page.tsx` (`PageShell` +
`PageHeader`, `canViewTrace`), el barrel (sin `MISSING_VALUE_MARK`) y los `*-columns`, `*-table` y
`*-list-section` de las seis tablas y de `delivered-conditioned-orders-list-section.tsx`. Desaparecen
`ConditioningOrderLink`, `CONDITIONING_ORDER_LINK_TESTID`, el `Link` de «Por empacar» y su tabla a mano.
Tests: `guard-piezas-base` (lista cerrada `D11_SIN_HALLAZGOS`: alta del barrel con «Alta el 2026-10-12
(QC-265)…»; `EXCLUSIONES_ESTRECHAS_D11` queda vacía), `tablas-marca` (solo el caso de la sección de
empaque), `asignacion-page`, los tests de columnas y de list-sections y `assigned-orders-can-execute`.
`data-table-alcance` no se toca.

Mapa R → test:
- R16 → tests de columnas (`data-tone`, `data-status`).
- R17 → `assigned-`/`company-orders-columns` (`data-level`, `data-priority`).
- R18–R21 → `assignment-row-actions.test.tsx`. R20, también `asignacion-page.test.tsx`, donde las siete secciones reciben `canViewTrace`.
- R22 → `asignacion-page.test.tsx` (un único `h1` «Asignación» con `asignacion-title`).
- R43 → `guard-piezas-base.test.ts` «QC-265 R43».

Snapshots: `asignacion-paridad` (cuatro listas) y `asignacion-acondicionamiento-paridad` (tres listas del
acondicionador). Todo entra en § 6 R16–R21: `StatusBadge`, `PriorityMark`, «Acciones», tarjetas, número
sin enlace y «Por empacar» sobre `DataTable`. `asignacion-listas-paridad` no cambia.

Verificación:
- typecheck OK; lint 0 errores.
- `vitest related`: 37 archivos, 529 tests en verde.
- `guard`: 74 archivos, 1017 en verde.
- `marca` + `data-table-alcance` + `paridad` + `asignaciones-ui`: 73 archivos, 1110 en verde.
- `./init.sh`: init OK.

Desvíos:
- (a) Los esqueletos (fuera de la lista) no se tocan y pintan una columna menos que la tabla cuando esta lleva «Acciones»: siempre en «Por empacar» y en las tres vistas de acondicionamiento, y en las demás solo con `canViewTrace`.
- (b) Las tablas montan el menú con `assignmentActionsColumn` → `actionsColumn({ menu })`, que es de donde `DataTable` saca el «Acciones» de la tarjeta.
- (c) `canViewTrace` es opcional y vale `false` por defecto, para no tocar `session-once-per-request-render.test.tsx`.
- (d) Se renombran testids que leen los E2E: `packing-order-row` pasa a `data-table-row-<id>`; la paginación de «Por empacar» pasa a `data-table-next`/`previous`; se quita `packing-orders-page-indicator`. Se migran en T8b.

## Tanda 8, T8b — E2E existentes migrados (frontend_dev)

Diez specs, cada uno por separado y en los dos navegadores (chromium / webkit), sin saltados:
- acondicionamiento 4/4 · 4/4
- acondicionar-con-equipo 1/1 · 1/1
- empaque 1/1 · 1/1
- pasos-de-envasado 1/1 · 1/1
- pedidos-asignados 4/4 · 4/4
- pedidos-terminados 4/4 · 4/4
- datos-de-lote-en-acondicionamiento 1/1 · 1/1
- registro-ejecucion 2/2 · 2/2
- envases-del-pedido 2/2 · 2/2
- pedido-en-varias-presentaciones 2/2 · 2/2

No se tocó código de la app.

Cambios:
- Se entra a los pedidos por «Entrar» del menú ⋯ (`assignment-row-actions` → `assignment-row-enter`), localizando la fila por `data-table-row-<id>`.
- Las pestañas se leen con contador y «Acondicionados».
- En el acondicionamiento, el botón que no toca pasa de `toHaveCount(0)` a `toBeDisabled()`.
- Datos de lote: toast «Datos de lote guardados.».
- Cancelar el pedido: menú `order-execution-actions` → `order-cancel-trigger`.
- `h1` = receta, y el número se lee en `[data-slot="operator-eyebrow"]`.

Lista cerrada (implementer): `tests/unit/shared/data-table-alcance.test.ts`. `e2e/acondicionar-con-equipo.spec.ts`
ahora nombra `data-table-row` y entra con «Alta el 2026-10-12 (QC-265)…»; el centinela pasa de 38 a 39.
El gate rápido no lo veía. El archivo se añade a `## Archivos esperados`.

Verificación: typecheck OK; lint 0 errores; guard 74/1017 en verde; `data-table-alcance` 18/18; `./init.sh` init OK.

Desvíos:
- (1) Mientras llega el contador, el streaming de `Suspense` deja dos copias de las pestañas con el mismo testid (el respaldo y la resuelta, aún sin intercambiar), y WebKit falló un clic por modo estricto. Los specs leen las pestañas con `filter({ visible: true })`, y los E2E futuros tendrán que hacer lo mismo.
- (2) Las tarjetas (ocultas en escritorio) repiten `company-order-date`, así que `pedidos-terminados` cuenta solo lo visible.
- (3) `CONDITIONING_BATCH_DATA_SUCCESS_TESTID` sigue exportado porque `datos-de-lote` lo importa en la línea 332 (`toHaveCount(0)`), una comprobación que ya no mide nada.

## Tanda 8, T8a y T8c — E2E nuevo y deudas (frontend_dev)

`e2e/operario-rediseno.spec.ts` (nuevo): 17/17 en chromium y 17/17 en webkit, sin saltados. Casos:
- R1, R5, R6 (3): sin barra ni cabecera y `private-content` en x = 0; el 404 y `/asignacion` las conservan.
- R2, R3 (3): a 390 × 844, cabecera sticky con un solo `h1` y «Cambiar tema»; pie fijo con botones de 52 px; controles de 44 × 44.
- R4 (3): dos columnas a 1440 y una a 820.
- R9 (1): contadores en las pestañas.
- R15 (1): «Cerrar» oculta el aviso sin recargar.
- R21 (2): tarjetas a 390 con «Entrar» de 44 px; «Acciones» centrado.
- R41 (3): los siete diálogos del operario, centrados.
- R37 (1): anillo `aria-hidden` que se vacía; después, el botón se habilita.

Listas cerradas:
- `E2E_ESPERADOS` de `tests/guards/guard-identificador-de-request.test.ts`: alta con «Alta el 2026-10-12 (QC-265) por el MISMO motivo…».
- `tests/unit/shared/data-table-alcance.test.ts`: alta, y el centinela pasa de 39 a 40.

No saltó ninguna otra (29 tests unitarios que leen `e2e/`, todos en verde).

T8c, en `progress/deudas.md`:
- D51 queda resuelta por QC-265 (D8, D14; R13, R14, R42, R43).
- Entra D52: el buscador de `/asignacion` queda fuera (P11).

Verificación: typecheck OK; lint 0 errores; guard 74/1017; `data-table-alcance` 18/18; `./init.sh` init OK.

Desvíos:
- (1) El 404 de la ejecución (R5) se provoca con el Empacador, sin `asignaciones.ejecutar`: un pedido inexistente pinta hoy el error dentro de la pantalla con respuesta 200, y es conducta anterior. Empaque y acondicionamiento usan un id aleatorio.
- (2) La espera de animaciones del spec solo cuenta `CSSAnimation`, porque la transición de 5 s del anillo bloqueaba la medida del diálogo.

## Cierre — gate completo y E2E afectados (implementer)

`./init.sh --completo` (tras T8): **init OK**. 1161/1161 archivos de test y 17 347 tests en verde (141
saltados).

E2E: once specs juntos (`--workers=1`, chromium + webkit): `operario-rediseno`, `acondicionamiento`,
`acondicionar-con-equipo`, `empaque`, `pasos-de-envasado`, `pedidos-asignados`, `pedidos-terminados`,
`datos-de-lote-en-acondicionamiento`, `registro-ejecucion`, `envases-del-pedido` y
`pedido-en-varias-presentaciones`.

**Primera corrida: 76 pasados, 2 fallidos**, los dos de `operario-rediseno` y por fragilidad del spec,
no de la app:
- (1) [chromium] Pie del empaque desviado 1,17 px. La animación `screen-enter` aplica `transform` a un
  ancestro y, mientras dura, ese ancestro es el bloque contenedor del `fixed`. El spec ahora espera a
  que la animación termine (`waitForScreenEnterToSettle`) y la tolerancia sigue en 1 px.
- (2) [webkit] El clic en «Cancelar pedido» pasó los 30 s: al hidratar se desmonta el ítem. Se arregla
  con el bucle `toPass` de `registro-ejecucion`.

Con `--repeat-each=3` en los dos navegadores: 102/102.

**Segunda corrida de los once: 78 pasados, 0 fallidos, 0 saltados (10,0 min).** `./init.sh`: init OK.

Salida (cola):
```
  ok 78 [webkit] › e2e\registro-ejecucion.spec.ts:384:7 › el registro de ejecucion de un pedido asignado › R40 - el Operador cancela el pedido con un motivo, vuelve a la lista con la confirmacion y el pedido queda CANCELADO con ese motivo (5.6s)

  78 passed (10.0m)
```

Veredicto del implementer: T0–T8 completas, todo R1–R45 mapeado a su test (secciones de cada tanda);
queda para el reviewer.
