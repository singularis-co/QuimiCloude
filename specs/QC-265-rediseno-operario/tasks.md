# QC-265 — rediseno-operario · tasks.md

Verificación de cada tanda (`docs/perfil-agentes.md > Todos los agentes`): `pnpm run typecheck`,
`pnpm run lint`, `pnpm exec vitest related --run <archivos de la tanda>` y
`pnpm exec vitest run guard`. Los E2E se corren por spec (`pnpm exec playwright test <spec>`) en la
tanda 8.

`[P]` = puede ir en paralelo con las otras `[P]` de su tanda. Antes de la tanda 1, el humano cierra
P1–P16 de `requirements.md` (o acepta los valores por defecto).

## Tanda 0 — Censo y comprobaciones (antes de tocar producción)

- [x] **T0a. Censo con grep.** Repetir el barrido de `design.md > 7` en `tests/unit`, `tests/guards`,
  `tests/integration` y `e2e` para cada símbolo, texto o testid que la ficha cambia o borra:
  `ASSIGNMENT_VIEW_LABELS`, `'Terminados'`, `backToFinished`, `Volver a «Terminados»`,
  `AssignedOrderDeliveredNotice`, `AssignedOrderCancelledNotice`, `assigned-order-delivered-notice`,
  `assigned-order-cancelled-notice`, `AssignedOrdersError`, `MISSING_VALUE_MARK`,
  `ConditioningOrderLink`, `conditioning-order-link`, `packing-order-link`, `WaitRing`,
  `step-reader-wait-ring`, `min-h-16`, `Lo esta empacando`, `esta dada de baja`, `ningun paso`,
  `CONDITIONING_BATCH_DATA_SUCCESS_TESTID`, `conditioning-batch-data-success`,
  `ORDER_CANCEL_TRIGGER_TESTID`, `order-cancel-trigger`, `private-header`, `data-slot="sidebar"`.
  *Hecho:* `progress/impl_QC-265-rediseno-operario.md` tiene la tabla «archivo → qué nombra → qué le
  pasa»; todo archivo que salga y no esté en `## Archivos esperados` se añade a esa sección en el
  mismo commit.
- [x] **T0b. Comprobar el selector de D2.** Con el servidor de desarrollo, en `/asignacion/<id>`,
  confirmar qué elemento lleva el hueco de la barra (`[data-slot="sidebar"]` u otro) y que, oculto con
  `display: none`, `SidebarInset` empieza en x = 0. *Hecho:* el selector exacto queda escrito en el
  impl; si difiere del de `design.md > D2`, se anota allí como desviación antes de la tanda 2.

## Tanda 1 — Piezas compartidas (depende de T0a)

- [x] **T1a [P]. `CountdownRing`** (D6, R38). Crear `components/shared/countdown-ring.tsx`; `step-reader.tsx`
  lo importa con `testId="step-reader-wait-ring"` y borra `WaitRing`. Test
  `tests/unit/shared/countdown-ring.test.tsx`: `aria-hidden`, `stroke-dashoffset` lleno al montar y
  vacío tras un fotograma, `transition` con los `seconds`, `size`, sin animación con movimiento
  reducido. *Hecho:* `tests/unit/recetas-ui/step-reader.test.tsx` y `order-execution-screen.test.tsx`
  (incluida la lista cerrada R18) en verde.
- [x] **T1b. Anillo en `CountdownGatedButton`** (D6, R37; depende de T1a). Test en
  `tests/unit/shared/countdown-gated-button.test.tsx`: mientras espera hay `countdown-ring` y la cuenta;
  al acabar no hay ninguno y el botón se habilita; con `disabled` sigue deshabilitado.
- [x] **T1c [P]. `Notice` con cierre** (D7, R15). Prop `dismissible`; test
  `tests/unit/shared-ui/notice-dismiss.test.tsx`: sin la prop el árbol es el de hoy (snapshot de los
  consumidores sin cambios); con ella hay un botón «Cerrar» de 44 × 44 px y al pulsarlo el aviso
  desaparece.
- [x] **T1d. Catálogo** (R44; depende de T1a–T1c). Fila nueva de `CountdownRing` (Compuestos,
  `Diseño` = `docs/diseno/canvas/Dominio.dc.html`); `Alcance` de `CountdownGatedButton` sin «el anillo
  todavía no está»; punto de extensión `dismissible` en `Notice` y su `Diseño` con
  `docs/diseno/canvas/Asignacion.dc.html`. *Hecho:* `pnpm exec vitest run guard-catalogo-de-componentes`
  en verde.

## Tanda 2 — Marco del operario (depende de T0b)

- [x] **T2a. `OperatorScreenFrame` y regla de CSS** (D2, D3, R1–R4). Crear
  `app/(private)/asignacion/components/operator-screen-frame.tsx` y la regla `:has()` en
  `app/globals.css`; `ThemeToggle` gana `className?` si no lo tiene. Test
  `tests/unit/asignaciones-ui/operator-screen-frame.test.tsx`: `data-operator-screen` en la raíz,
  cabecera con número, `h1` único con la receta, «Cambiar tema», `ArrowLink` cuando hay `back`, pie con
  la clase del margen seguro, botones `xl` (R2, R3). Test
  `tests/unit/theme/operator-chrome-css.test.ts`: `app/globals.css` contiene la regla con
  `[data-operator-screen]`, el selector de la barra de T0b y `[data-testid="private-header"]` (R1).
  *Hecho:* tests en verde; ninguna pantalla lo usa todavía.

## Tanda 3 — Asignación (depende de T1c)

- [x] **T3a [P]. Pestañas, renombrado y contadores** (D1, D4, D5, R7, R9–R12). `AssignmentViewTabs`
  sobre `UrlTabs` con `counts?`; `assignment-view-counts.ts` y `assignment-view-tabs-section.tsx`;
  `page.tsx` la monta en `Suspense`. Tests:
  `tests/unit/asignaciones-ui/assignment-view-tabs.test.tsx` (etiqueta «Acondicionados», contador junto
  a la etiqueta, enlace real, vigente seleccionada, testids de hoy) y
  `tests/unit/asignaciones-ui/assignment-view-counts.test.ts` (llama a cada lista con `{ page: 1,
  pageSize: 1 }` sin filtros, toma `total`, una vista que falla queda sin contador y no lanza).
  `asignacion-page.test.tsx` comprueba que la lista vigente no espera al `Suspense` de las pestañas.
- [x] **T3b [P]. Avisos en una pieza** (D8, D14, R13, R14, R42). `OrderOutcomeNotice` con los cuatro
  tipos sobre `Notice` con `dismissible`; borrar `assigned-order-delivered-notice.tsx`,
  `assigned-order-cancelled-notice.tsx` y `AssignedOrdersError`. Tests: los cuatro de avisos de
  `design.md > 7` (tono, texto, `role="status"`, testid) y `asignacion-page.test.tsx` (qué aviso sale
  con cada parámetro). Guardia: reglas R14 y R42 en `guard-asignacion-componentizada.test.ts`.
- [ ] **T3c. Filas: estado, prioridad, menú y tarjetas** (D9, R16–R21; depende de T3b). Columnas de
  las seis tablas; `canViewTrace` desde `page.tsx`; borrar `ConditioningOrderLink` y el `Link` del
  número de «Por empacar»; `card` en cada `DataTable`. Tests: los de columnas de `design.md > 7`
  (`StatusBadge` con tono, `PriorityMark` con nivel, testids y `data-*` de hoy) y
  `tests/unit/asignaciones-ui/assignment-row-actions.test.tsx` («Entrar» del menú por vista y su
  dirección; «Ver recorrido» solo con `canViewTrace`; sin ítems no hay menú; «Entrar» visible solo en
  «Mis asignados»; tarjeta con «Entrar» y «Acciones»).
- [ ] **T3d. Título y limpieza** (R22, R43; depende de T3c). `PageShell` + `PageHeader` en `page.tsx`;
  el barrel deja de reexportar `MISSING_VALUE_MARK`; `assigned-orders-columns.test.tsx` importa
  `EMPTY_MARK`; `guard-piezas-base.test.ts` sin la exclusión del barrel. Snapshots de
  `asignacion-paridad` y `asignacion-listas-paridad` actualizados con las filas de `design.md > 6`.
  *Hecho:* `asignacion-page.test.tsx` afirma un único `h1` «Asignación» con `asignacion-title`.

## Tanda 4 — Ejecución (depende de T1a, T2a) [P con 5 y 6]

- [x] **T4a. Cabecera, menú y panel** (D10, R23, R24). `OrderExecutionScreen` sobre el marco;
  `OrderCancelDialog` con `open?`/`onOpenChange?`; `order-execution-tools-panel.tsx`. Tests:
  `order-execution-screen.test.tsx` (cabecera con número, receta o «Esta receta está dada de baja.»,
  «Pedido … · Presentación: …», menú «Acciones del pedido <n>» con «Cancelar pedido» que abre el
  diálogo), `order-cancel-dialog.test.tsx` (modo controlado sin disparador; sin las props, el de hoy) y
  `tests/unit/asignaciones-ui/order-execution-tools-panel.test.tsx` (abierto al entrar, contador,
  plegar no cambia el paso ni lo marcado).
- [x] **T4b. Pie del paso a paso** (D10, R25, R26). `step-reader.tsx` en `ejecucion`: botones `xl`,
  proporción 1/3–2/3, motivo encima, barra anclada al pie. Tests: `step-reader.test.tsx` (modo
  `lectura` sin cambios; `ejecucion` con `size="xl"`) y `order-execution-screen.test.tsx` (bloqueo,
  espera, registro de paso y diálogo «¿Terminar el pedido?» como hoy).

## Tanda 5 — Empaque (depende de T2a) [P con 4 y 6]

- [x] **T5a.** (D11, R27–R31) `PackingOrderScreen` sobre el marco. Tests en
  `packing-order-screen.test.tsx`: `ArrowLink` «Volver a «Por empacar»» con su testid y dirección;
  `StatusBadge` con `data-status`; resumen y reparto con sus testids; falta de reparto con `Notice`
  `warning`; pie con los dos botones y solo uno habilitado por estado (R29); con pasos de envasado, el
  pie es el del paso a paso y no hay botones de R29 (R30); otra persona empaca → `Notice` `info` «Lo
  está empacando <nombre>.» / «… otra persona.» y los dos botones deshabilitados (R31).
  `packing-order-page.test.tsx` sin cambios de conducta. Snapshot de empaque en
  `asignacion-acondicionamiento-paridad` actualizado (fila de `design.md > 6`).

## Tanda 6 — Acondicionamiento (depende de T1b, T2a) [P con 4 y 5]

- [x] **T6a.** (D1, D12, R8, R32–R36) `ConditioningOrderScreen` y `ConditioningActions` sobre el marco.
  Tests en `conditioning-order-screen.test.tsx`: enlace de vuelta por estado con «Volver a
  «Acondicionados»» para `TERMINADO` (R8); cabecera con reparto, `StatusBadge` y «Lo acondiciona …»;
  tarjetas «Equipo» y «Datos de lote»; pie con solo un botón habilitado por estado y «Terminar»
  descrito por el aviso de lote. `start-conditioning-dialog.test.tsx` y
  `finish-conditioning-dialog.test.tsx`: título, textos, selector dentro (R35), espera de 5 s con
  anillo (R35, R36). `conditioning-order-page.test.tsx` sin cambios de conducta. Snapshots de
  `asignacion-acondicionamiento-paridad` y `confirmaciones-paridad` (casos con botón con espera)
  actualizados.

## Tanda 7 — Textos y toast (depende de 4, 5 y 6)

- [ ] **T7a [P]. Tildes** (D13, R39). Constantes de `packing-order-screen.tsx`,
  `order-execution-screen.tsx` y `step-reader.tsx`. Guardia: regla R39 en
  `guard-asignacion-componentizada.test.ts` (ninguna de las tres formas en `app/` ni en
  `components/`). Tests que afirmaban el texto viejo, actualizados.
- [ ] **T7b [P]. Toast de datos de lote** (D13, R40). `conditioning-batch-data-form.test.tsx`: con
  `success` se llama una vez a `toast.success('Datos de lote guardados.')` y no existe
  `conditioning-batch-data-success`; con error, ningún toast y el `ErrorAlert` de hoy.
- [ ] **T7c. Guardia del anillo** (R38). Regla en `guard-asignacion-componentizada.test.ts`: ningún
  `<circle>` con `strokeDashoffset` fuera de `components/shared/countdown-ring.tsx`.

## Tanda 8 — E2E (depende de todas)

- [ ] **T8a. E2E nuevo** `e2e/operario-rediseno.spec.ts` con los casos de `design.md > 7` (R1–R6, R9,
  R15, R21, R37, R41) y su alta en `E2E_ESPERADOS` de
  `tests/guards/guard-identificador-de-request.test.ts` con el comentario «Alta el <fecha> (QC-265)
  por el MISMO motivo y en el MISMO sitio que las demas: la lista es CERRADA y darse de alta en ella es
  su punto de extension por diseno. El ancla NO se relaja -el archivo se nombra, uno a uno-. Lo que
  ejercita: …». *Hecho:* pasa en Chromium y WebKit; `pnpm exec vitest run guard-identificador-de-request`
  en verde.
- [ ] **T8b. E2E existentes** (R45 y los cambios de `design.md > 7`). Migrar los E2E de la tabla a «Entrar»
  del menú ⋯, a la pestaña «Acondicionados» con contador, al toast de datos de lote y al `import` nuevo
  del aviso de cancelado. *Hecho:* cada spec tocado pasa por separado (`pnpm exec playwright test
  <spec>`); los que solo leen testids de avisos pasan sin cambios.
- [ ] **T8c. Deudas.** `progress/deudas.md`: D51 resuelta (si P15 por defecto); deuda nueva del
  buscador (si P11 por defecto).

## Trazabilidad R → test

| R | Test |
| --- | --- |
| R1 | `tests/unit/theme/operator-chrome-css.test.ts`, `e2e/operario-rediseno.spec.ts` |
| R2, R3 | `tests/unit/asignaciones-ui/operator-screen-frame.test.tsx`, `tests/unit/asignaciones-ui/a11y-tactil.test.tsx`, `e2e/operario-rediseno.spec.ts` |
| R4, R5, R6 | `e2e/operario-rediseno.spec.ts` |
| R7 | `tests/unit/asignaciones-ui/assignment-view-tabs.test.tsx` |
| R8 | `tests/unit/asignaciones-ui/conditioning-order-screen.test.tsx` |
| R9, R12 | `tests/unit/asignaciones-ui/assignment-view-tabs.test.tsx`, `e2e/operario-rediseno.spec.ts` (R9) |
| R10, R11 | `tests/unit/asignaciones-ui/assignment-view-counts.test.ts`, `tests/unit/asignaciones-ui/asignacion-page.test.tsx` (R11) |
| R13 | `tests/unit/asignaciones-ui/assigned-orders-delivered-notice.test.tsx`, `assigned-orders-cancelled-notice.test.tsx`, `packed-order-notice.test.tsx`, `conditioned-order-notice.test.tsx` |
| R14, R42 | `tests/guards/guard-asignacion-componentizada.test.ts` |
| R15 | `tests/unit/shared-ui/notice-dismiss.test.tsx`, `e2e/operario-rediseno.spec.ts` |
| R16, R17 | tests de columnas de `design.md > 7` |
| R18, R19, R20, R21 | `tests/unit/asignaciones-ui/assignment-row-actions.test.tsx`, `e2e/operario-rediseno.spec.ts` (R21) |
| R22 | `tests/unit/asignaciones-ui/asignacion-page.test.tsx` |
| R23, R26 | `tests/unit/asignaciones-ui/order-execution-screen.test.tsx`, `order-cancel-dialog.test.tsx` |
| R24 | `tests/unit/asignaciones-ui/order-execution-tools-panel.test.tsx` |
| R25 | `tests/unit/recetas-ui/step-reader.test.tsx`, `tests/unit/asignaciones-ui/order-execution-screen.test.tsx` |
| R27–R31 | `tests/unit/asignaciones-ui/packing-order-screen.test.tsx` |
| R32–R34 | `tests/unit/asignaciones-ui/conditioning-order-screen.test.tsx` |
| R35 | `tests/unit/asignaciones-ui/start-conditioning-dialog.test.tsx` |
| R36 | `tests/unit/asignaciones-ui/finish-conditioning-dialog.test.tsx` |
| R37 | `tests/unit/shared/countdown-gated-button.test.tsx`, `e2e/operario-rediseno.spec.ts` |
| R38 | `tests/unit/shared/countdown-ring.test.tsx`, `tests/guards/guard-asignacion-componentizada.test.ts` |
| R39 | `tests/guards/guard-asignacion-componentizada.test.ts` |
| R40 | `tests/unit/asignaciones-ui/conditioning-batch-data-form.test.tsx`, `e2e/datos-de-lote-en-acondicionamiento.spec.ts` |
| R41 | `e2e/operario-rediseno.spec.ts` |
| R43 | `tests/guards/guard-piezas-base.test.ts` |
| R44 | `tests/guards/guard-catalogo-de-componentes.test.ts` |
| R45 | `e2e/empaque.spec.ts`, `e2e/pasos-de-envasado.spec.ts`, `e2e/acondicionar-con-equipo.spec.ts`, `e2e/datos-de-lote-en-acondicionamiento.spec.ts`, `e2e/ejecucion-receta.spec.ts`, `e2e/registro-ejecucion.spec.ts` |

## Archivos esperados

Producción:

- `app/globals.css`
- `app/(private)/components/theme-toggle.tsx`
- `app/(private)/asignacion/page.tsx`
- `app/(private)/asignacion/components/index.ts`
- `app/(private)/asignacion/components/operator-screen-frame.tsx`
- `app/(private)/asignacion/components/assignment-view-tabs.tsx`
- `app/(private)/asignacion/components/assignment-view-tabs-section.tsx`
- `app/(private)/asignacion/components/assignment-view-counts.ts`
- `app/(private)/asignacion/components/order-outcome-notice.tsx`
- `app/(private)/asignacion/components/assigned-order-delivered-notice.tsx`
- `app/(private)/asignacion/components/assigned-order-cancelled-notice.tsx`
- `app/(private)/asignacion/components/assigned-orders-error.tsx`
- `app/(private)/asignacion/components/assignment-list-parts.tsx`
- `app/(private)/asignacion/components/assigned-orders-columns.tsx`
- `app/(private)/asignacion/components/assigned-orders-table.tsx`
- `app/(private)/asignacion/components/assigned-orders-list-section.tsx`
- `app/(private)/asignacion/components/company-orders-columns.tsx`
- `app/(private)/asignacion/components/company-orders-table.tsx`
- `app/(private)/asignacion/components/company-orders-list-section.tsx`
- `app/(private)/asignacion/components/finished-orders-columns.tsx`
- `app/(private)/asignacion/components/finished-orders-table.tsx`
- `app/(private)/asignacion/components/finished-orders-list-section.tsx`
- `app/(private)/asignacion/components/packing-orders-columns.tsx`
- `app/(private)/asignacion/components/packing-orders-list-section.tsx`
- `app/(private)/asignacion/components/conditioning-orders-columns.tsx`
- `app/(private)/asignacion/components/conditioning-orders-table.tsx`
- `app/(private)/asignacion/components/conditioning-orders-list-section.tsx`
- `app/(private)/asignacion/components/conditioned-orders-columns.tsx`
- `app/(private)/asignacion/components/conditioned-orders-table.tsx`
- `app/(private)/asignacion/components/conditioned-orders-list-section.tsx`
- `app/(private)/asignacion/components/delivered-conditioned-orders-list-section.tsx`
- `app/(private)/asignacion/[id]/components/index.ts`
- `app/(private)/asignacion/[id]/components/order-execution-screen.tsx`
- `app/(private)/asignacion/[id]/components/order-cancel-dialog.tsx`
- `app/(private)/asignacion/[id]/components/order-execution-tools-panel.tsx`
- `app/(private)/asignacion/[id]/components/order-execution-tools.tsx`
- `app/(private)/asignacion/[id]/components/order-execution-lines.tsx`
- `app/(private)/asignacion/empaque/[id]/page.tsx`
- `app/(private)/asignacion/empaque/[id]/components/index.ts`
- `app/(private)/asignacion/empaque/[id]/components/packing-order-screen.tsx`
- `app/(private)/asignacion/acondicionamiento/[id]/page.tsx`
- `app/(private)/asignacion/acondicionamiento/[id]/components/index.ts`
- `app/(private)/asignacion/acondicionamiento/[id]/components/conditioning-order-screen.tsx`
- `app/(private)/asignacion/acondicionamiento/[id]/components/conditioning-actions.tsx`
- `app/(private)/asignacion/acondicionamiento/[id]/components/start-conditioning-dialog.tsx`
- `app/(private)/asignacion/acondicionamiento/[id]/components/finish-conditioning-dialog.tsx`
- `app/(private)/asignacion/acondicionamiento/[id]/components/conditioning-team-list.tsx`
- `app/(private)/asignacion/acondicionamiento/[id]/components/conditioning-batch-data-form.tsx`
- `components/shared/countdown-ring.tsx`
- `components/shared/countdown-gated-button.tsx`
- `components/shared/notice.tsx`
- `components/shared/step-reader/step-reader.tsx`
- `components/shared/CATALOGO.md`

Tests y guardias:

- `tests/unit/asignaciones-ui/operator-screen-frame.test.tsx`
- `tests/unit/theme/operator-chrome-css.test.ts`
- `tests/unit/asignaciones-ui/assignment-view-tabs.test.tsx`
- `tests/unit/asignaciones-ui/assignment-view-counts.test.ts`
- `tests/unit/asignaciones-ui/assignment-row-actions.test.tsx`
- `tests/unit/asignaciones-ui/order-execution-tools-panel.test.tsx`
- `tests/unit/asignaciones-ui/asignacion-page.test.tsx`
- `tests/unit/asignaciones-ui/assigned-orders-delivered-notice.test.tsx`
- `tests/unit/asignaciones-ui/assigned-orders-cancelled-notice.test.tsx`
- `tests/unit/asignaciones-ui/packed-order-notice.test.tsx`
- `tests/unit/asignaciones-ui/conditioned-order-notice.test.tsx`
- `tests/unit/asignaciones-ui/assigned-orders-columns.test.tsx`
- `tests/unit/asignaciones-ui/company-orders-columns.test.tsx`
- `tests/unit/asignaciones-ui/packing-orders-columns.test.tsx`
- `tests/unit/asignaciones-ui/conditioning-orders-columns.test.tsx`
- `tests/unit/asignaciones-ui/finished-orders-columns.test.tsx`
- `tests/unit/asignaciones-ui/packing-orders-list-section.test.tsx`
- `tests/unit/asignaciones-ui/conditioning-orders-list-section.test.tsx`
- `tests/unit/asignaciones-ui/delivered-conditioned-orders-list-section.test.tsx`
- `tests/unit/asignaciones-ui/finished-orders-list-section.test.tsx`
- `tests/unit/asignaciones-ui/company-orders-list-section.test.tsx`
- `tests/unit/asignaciones-ui/assigned-orders-states.test.tsx`
- `tests/unit/asignaciones-ui/assigned-orders-can-execute.test.tsx`
- `tests/unit/asignaciones-ui/a11y-tactil.test.tsx`
- `tests/unit/asignaciones-ui/order-execution-screen.test.tsx`
- `tests/unit/asignaciones-ui/order-execution-page.test.tsx`
- `tests/unit/asignaciones-ui/order-cancel-dialog.test.tsx`
- `tests/unit/asignaciones-ui/order-execution-tools.test.tsx`
- `tests/unit/asignaciones-ui/order-execution-lines.test.tsx`
- `tests/unit/asignaciones-ui/packing-order-screen.test.tsx`
- `tests/unit/asignaciones-ui/packing-order-page.test.tsx`
- `tests/unit/asignaciones-ui/conditioning-order-screen.test.tsx`
- `tests/unit/asignaciones-ui/conditioning-order-page.test.tsx`
- `tests/unit/asignaciones-ui/start-conditioning-dialog.test.tsx`
- `tests/unit/asignaciones-ui/finish-conditioning-dialog.test.tsx`
- `tests/unit/asignaciones-ui/conditioning-batch-data-form.test.tsx`
- `tests/unit/shared/countdown-ring.test.tsx`
- `tests/unit/shared/countdown-gated-button.test.tsx`
- `tests/unit/shared-ui/notice-dismiss.test.tsx`
- `tests/unit/recetas-ui/step-reader.test.tsx`
- `tests/unit/paridad/asignacion-paridad.test.tsx`
- `tests/unit/paridad/__snapshots__/asignacion-paridad.test.tsx.snap`
- `tests/unit/paridad/asignacion-listas-paridad.test.tsx`
- `tests/unit/paridad/__snapshots__/asignacion-listas-paridad.test.tsx.snap`
- `tests/unit/paridad/asignacion-acondicionamiento-paridad.test.tsx`
- `tests/unit/paridad/__snapshots__/asignacion-acondicionamiento-paridad.test.tsx.snap`
- `tests/unit/paridad/confirmaciones-paridad.test.tsx`
- `tests/unit/paridad/__snapshots__/confirmaciones-paridad.test.tsx.snap`
- `tests/guards/guard-asignacion-componentizada.test.ts`
- `tests/guards/guard-piezas-base.test.ts`
- `tests/guards/guard-identificador-de-request.test.ts`

E2E:

- `e2e/operario-rediseno.spec.ts`
- `e2e/acondicionamiento.spec.ts`
- `e2e/acondicionar-con-equipo.spec.ts`
- `e2e/empaque.spec.ts`
- `e2e/pasos-de-envasado.spec.ts`
- `e2e/pedidos-asignados.spec.ts`
- `e2e/pedidos-terminados.spec.ts`
- `e2e/datos-de-lote-en-acondicionamiento.spec.ts`
- `e2e/registro-ejecucion.spec.ts`

Estado:

- `progress/impl_QC-265.md`
- `progress/deudas.md`
- `progress/features/QC-265.md`
