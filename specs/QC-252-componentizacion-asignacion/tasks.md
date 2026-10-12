# QC-252 — componentizacion-asignacion · tasks.md

Verificación de cada tanda (`docs/perfil-agentes.md > Todos los agentes`): `pnpm run typecheck`,
`pnpm run lint`, `pnpm exec vitest related --run <archivos de la tanda>` y
`pnpm exec vitest run guard`. Las E2E de la tanda 6 se corren por spec.

`[P]` = puede ir en paralelo con las otras `[P]` de su tanda.

## Tanda 0 — Congelar y censar (antes de tocar producción)

- [ ] **T0a. Paridad nueva** (D14). Crear
  `tests/unit/paridad/asignacion-acondicionamiento-paridad.test.tsx` con los casos de
  `design.md > 4 > D14`, sobre el código **sin tocar**, y generar sus snapshots.
  *Hecho:* los snapshots existen, el archivo pasa en verde y se commitea solo (`test(QC-252): …`)
  antes de cualquier cambio de producción. Cada caso lleva en su nombre los `R<n>` que congela.
- [ ] **T0b. Censo con grep de lo que se toca o se borra.** Buscar en `tests/unit`, `tests/guards`,
  `tests/integration` y `e2e` cada archivo y símbolo que esta ficha borra, mueve o cambia de firma:
  `conditioning-orders-href`, `conditioningOrdersHref`, `conditionedOrdersHref`,
  `deliveredConditionedOrdersHref`, `ConditioningListView`, `finishedOrdersHref`, `packingOrdersHref`,
  `BACK_HREF`, `data-list`, `ConditioningOrdersEmpty`, `ConditioningOrdersSkeleton`,
  `conditioning-orders-empty`, `conditioning-orders-skeleton`, `groupTeamByOrigin`,
  `groupResponsiblesByOrigin`, `ResponsibleGroup`, `statusLabel`, `distributionLineText`,
  `orderDistributionFullText`, `MISSING_NAME_MARK`, `PackedOrderNotice`, `ConditionedOrderNotice`,
  `packed-order-notice`, `conditioned-order-notice`, `countdown-gated-button`,
  `CountdownGatedButton`, `CONDITIONING_WAIT_SECONDS`, `COUNTDOWN_GATED_BUTTON_TESTID`,
  `FinishConditioningDialog`, `finish-conditioning-dialog`, `TOUCH_TARGET`,
  `CONDITIONING_ORDER_LINK_CLASS`, `MISSING_VALUE_MARK`, `ARCHIVOS_D11`, `D11_SIN_HALLAZGOS`,
  `VACIOS_Y_ESQUELETOS_D7`, `NO_SE_TOCAN_R30`, `PREFIJOS_QUE_NO_SE_TOCAN_R30`, `PIEZAS_PREVIAS_AL_REDISENO`.
  *Hecho:* `progress/impl_QC-252-componentizacion-asignacion.md` tiene la tabla «archivo de test →
  símbolo o ruta que nombra → qué le pasa (sin cambio / import / aserción que se retira / enmienda)».
  Todo test que salga y no esté en `## Archivos esperados` se añade a esa sección en el mismo commit
  (si no, `guard-formularios-y-acciones > R4` y `archivos-en-vuelo` no lo ven).

## Tanda 1 — Piezas compartidas (depende de T0a)

- [ ] **T1a [P]. Agrupado y filtro** (D5, R8–R10). Crear `lib/shared/ui/responsible-groups.ts` con
  `groupResponsiblesByOrigin`, `filterByDisplayName` y sus tipos; test
  `tests/unit/shared-ui/responsible-groups.test.ts` (orden por primera aparición, «directos» primero,
  sin directos, filtro con mayúsculas y espacios, búsqueda vacía) y test de tipos que ata
  `ResponsibleOrigin` a `AssignmentOrigin` y al `origin` de `ConditioningTeamMemberView` en los dos
  sentidos. `pedidos/components/order-responsibles.tsx` importa de ahí y conserva sus exports.
  *Hecho:* `order-responsibles.test.tsx` y `order-route-contract.test.ts` siguen verdes sin tocarlos.
- [ ] **T1b [P]. Función de línea de reparto** (D7, R13). Exportar `orderDistributionLineText` de
  `components/shared/order-distribution-label.tsx`; test en
  `tests/unit/shared-ui/order-distribution-line-text.test.ts` (envase, respaldo a presentación, `—`).
  *Hecho:* la pieza pinta igual (sus tests y la paridad de las listas sin cambios).
- [ ] **T1c [P]. `ConfirmDialog` extendido** (D9, R18). `contentClassName?` y `confirmSlot?`; test
  `tests/unit/shared-ui/confirm-dialog-extension.test.tsx` (sin las props, mismo árbol; con
  `confirmSlot`, el pie pinta el nodo dado y no el botón propio; con `contentClassName`, la clase llega
  al contenido). *Hecho:* `tests/unit/paridad/confirmaciones-paridad.test.tsx` sin cambios en su
  snapshot.
- [ ] **T1d [P]. `CountdownGatedButton` en shared** (D10, R19). Crear
  `components/shared/countdown-gated-button.tsx` con `seconds`; mover
  `tests/unit/asignaciones-ui/countdown-gated-button.test.tsx` a
  `tests/unit/shared/countdown-gated-button.test.tsx`. Crear
  `app/(private)/asignacion/acondicionamiento/[id]/components/conditioning-wait.ts` con
  `CONDITIONING_WAIT_SECONDS`. *Hecho:* el test movido pasa con las mismas aserciones.
- [ ] **T1e. Catálogo** (R23, depende de T1a–T1d). Filas nuevas de `CountdownGatedButton` (Compuestos,
  `Diseño` = `docs/diseno/canvas/Dominio.dc.html`) y de `groupResponsiblesByOrigin`,
  `filterByDisplayName` (Apoyos, `sin UI`); puntos de extensión nuevos en `ConfirmDialog` y
  `OrderDistributionLabel`. *Hecho:* `pnpm exec vitest run guard-catalogo-de-componentes` en verde.

## Tanda 2 — Direcciones (depende de T0a)

- [ ] **T2.** (D1, R1–R3) Sustituir los constructores por `assignedOrdersListHref` /
  `assignmentViewHref` en `finished-orders-table.tsx`, `finished-orders-list-section.tsx`,
  `packing-orders-list-section.tsx`, `conditioning-orders-table.tsx`,
  `conditioning-orders-list-section.tsx`, `conditioned-orders-table.tsx`,
  `conditioned-orders-list-section.tsx`, `delivered-conditioned-orders-list-section.tsx` y
  `packing-order-screen.tsx`; borrar `conditioning-orders-href.ts` y sus exports del barrel. Test
  nuevo `tests/unit/asignaciones-ui/assignment-hrefs.test.ts` con la tabla de `design.md > 3` (las
  cadenas de hoy, escritas a mano). Enmendar los dos tests de sección del censo T0b.
  *Hecho:* las cadenas esperadas no cambian en ningún test; paridad sin diferencias.

## Tanda 3 — Vacíos, esqueletos, marcas y talla (depende de T2)

- [ ] **T3a.** (D2, D3, D4, R4–R7) `ConditioningOrdersEmpty` y `ConditioningOrdersSkeleton` delegan en
  `AssignmentListEmpty` / `AssignmentListSkeleton`; «Entregados» usa `ConditioningOrdersEmpty`;
  «Por empacar» usa `AssignmentListEmpty`. Retirar la aserción de `data-list` de
  `asignacion-page.test.tsx`. Actualizar **solo** las entradas de vacío de «Por empacar» en
  `asignacion-listas-paridad.test.tsx.snap` y `asignacion-paridad.test.tsx.snap`.
  *Hecho:* el diff de los `.snap` es exactamente la línea `data-testid="packing-orders-empty"` en
  cada entrada de vacío de «Por empacar»; la paridad nueva sin cambios.
- [ ] **T3b.** (D11, D12, R14, R21) Talla táctil en `assignment-view-tabs.tsx`,
  `conditioning-orders-columns.tsx` y `conditioning-order-screen.tsx`; `MissingValue` compartido en
  `conditioning-orders-columns.tsx`; `ErrorAlert` para el error de candidatos.
  *Hecho:* paridad sin cambios; `a11y-tactil.test.tsx` verde.
- [ ] **T3c.** (D13, R22) Enmendar `tests/guards/guard-piezas-base.test.ts`: los cinco archivos de
  `/asignacion` a `D11_SIN_HALLAZGOS` salvo el barrel, exclusión estrecha del alias del barrel,
  `VACIOS_Y_ESQUELETOS_D7_PENDIENTES` vacía. Comprobar que muerde: reintroducir a mano el par en
  `assignment-view-tabs.tsx` pone la guardia en rojo (se deshace antes de commitear).
  *Hecho:* `pnpm exec vitest run guard` en verde.

## Tanda 4 — Equipo y etiquetas (depende de T1a, T1b)

- [ ] **T4a.** (D5, R8–R10) `conditioning-team-list.tsx` usa `groupResponsiblesByOrigin` y borra
  `groupTeamByOrigin`; `conditioning-team-picker.tsx` usa `filterByDisplayName`.
  *Hecho:* paridad de lista y selector sin cambios; `start-conditioning-dialog.test.tsx` y
  `conditioning-order-screen.test.tsx` verdes.
- [ ] **T4b.** (D6, D7, R11–R13) Borrar los `statusLabel` y `distributionLineText`; usar
  `ORDER_STATUS_LABELS` y `orderDistributionLineText`; `orderDistributionFullText` usa la función de
  línea. Casos nuevos en `conditioning-order-screen.test.tsx` y `packing-order-screen.test.tsx`: cada
  estado posible con su texto de hoy (R11) y un estado imposible con su etiqueta del mapa (R12).
  *Hecho:* paridad sin cambios; `qc195-lineas-antiguas.test.tsx` y `conditioning-orders-columns.test.tsx`
  verdes.

## Tanda 5 — Avisos y diálogo (depende de T1c, T1d)

- [ ] **T5a.** (D8, R15, R16) Crear `order-outcome-notice.tsx`, borrar los dos avisos, actualizar
  barrel y `page.tsx`; enmendar `packed-order-notice.test.tsx`, `conditioned-order-notice.test.tsx` y,
  si los nombra, `asignacion-page.test.tsx`. *Hecho:* paridad de avisos sin cambios.
- [ ] **T5b.** (D9, D10, R17, R19) `FinishConditioningDialog` sobre `ConfirmDialog` con
  `confirmSlot={<CountdownGatedButton seconds={CONDITIONING_WAIT_SECONDS} …/>}`;
  `start-conditioning-dialog.tsx` importa el botón de shared; borrar la copia de la ruta y sus
  exports del barrel; actualizar imports de `finish-conditioning-dialog.test.tsx` y
  `start-conditioning-dialog.test.tsx`. *Hecho:* paridad del diálogo sin cambios (vigilar el `type` de
  «Cancelar»); `finish-conditioning-dialog.test.tsx` verde con las mismas aserciones.
- [ ] **T5c.** (R3, R7, R9, R16, R19) Guardia nueva `tests/guards/guard-asignacion-componentizada.test.ts`
  con muestras que la violan y que la cumplen. *Hecho:* verde sobre el repo y roja con cada muestra.

## Tanda 6 — E2E y cierre (depende de todas)

- [ ] **T6a.** (R25) Actualizar solo los `import` de `e2e/datos-de-lote-en-acondicionamiento.spec.ts`.
  Correr `pnpm exec playwright test` sobre `e2e/acondicionamiento.spec.ts`,
  `e2e/acondicionar-con-equipo.spec.ts`, `e2e/datos-de-lote-en-acondicionamiento.spec.ts`,
  `e2e/empaque.spec.ts`, `e2e/pasos-de-envasado.spec.ts`, `e2e/envases-del-pedido.spec.ts`,
  `e2e/pedido-en-varias-presentaciones.spec.ts`, `e2e/pedidos-asignados.spec.ts` y
  `e2e/pedidos-terminados.spec.ts`. *Hecho:* verdes; `git diff` de `e2e/` sin líneas de aserción.
- [ ] **T6b.** Repetir el censo de T0b sobre el árbol final: ningún test ni guardia nombra un archivo o
  símbolo borrado. Marcar D42, D43 y D47 resueltas en `progress/deudas.md`. Mapa `R<n> → test` en
  `progress/impl_QC-252-componentizacion-asignacion.md` (abajo, el de partida).
  *Hecho:* `./init.sh` en verde.

## Trazabilidad de partida (R → test)

| R | Test |
| --- | --- |
| R1, R2 | `tests/unit/asignaciones-ui/assignment-hrefs.test.ts`; tests de sección del acondicionador |
| R3 | `tests/guards/guard-asignacion-componentizada.test.ts` |
| R4, R6 | `tests/unit/paridad/asignacion-acondicionamiento-paridad.test.tsx`, `asignacion-listas-paridad.test.tsx` |
| R5 | `asignacion-listas-paridad.test.tsx` (snapshot de vacío de «Por empacar»), `packing-orders-list-section.test.tsx` |
| R7 | `tests/guards/guard-asignacion-componentizada.test.ts` |
| R8 | `tests/unit/shared-ui/responsible-groups.test.ts`; paridad de la lista de equipo |
| R9 | `responsible-groups.test.ts` (tipos), `tests/unit/pedidos-ui/order-route-contract.test.ts`, guardia nueva |
| R10 | `responsible-groups.test.ts`; paridad del selector; `start-conditioning-dialog.test.tsx` |
| R11, R12 | `conditioning-order-screen.test.tsx`, `packing-order-screen.test.tsx` |
| R13 | `tests/unit/shared-ui/order-distribution-line-text.test.ts`; paridad de empaque |
| R14 | paridad de «Por acondicionar»; `conditioning-orders-columns.test.tsx` |
| R15 | `packed-order-notice.test.tsx`, `conditioned-order-notice.test.tsx`; paridad de avisos |
| R16 | `tests/guards/guard-asignacion-componentizada.test.ts` |
| R17 | `finish-conditioning-dialog.test.tsx`; paridad del diálogo |
| R18 | `tests/unit/shared-ui/confirm-dialog-extension.test.tsx`, `confirmaciones-paridad.test.tsx` |
| R19 | `tests/unit/shared/countdown-gated-button.test.tsx`; guardia nueva |
| R20 | paridad del detalle con error de candidatos; `conditioning-order-screen.test.tsx` |
| R21, R22 | `tests/guards/guard-piezas-base.test.ts`; `a11y-tactil.test.tsx` |
| R23 | `tests/guards/guard-catalogo-de-componentes.test.ts` |
| R24 | los tres archivos de paridad de `/asignacion` |
| R25 | los E2E de T6a |

## Archivos esperados

### Producción

- `app/(private)/asignacion/page.tsx`
- `app/(private)/asignacion/components/index.ts`
- `app/(private)/asignacion/components/conditioning-orders-href.ts` (se borra)
- `app/(private)/asignacion/components/finished-orders-table.tsx`
- `app/(private)/asignacion/components/finished-orders-list-section.tsx`
- `app/(private)/asignacion/components/packing-orders-list-section.tsx`
- `app/(private)/asignacion/components/conditioning-orders-table.tsx`
- `app/(private)/asignacion/components/conditioning-orders-list-section.tsx`
- `app/(private)/asignacion/components/conditioned-orders-table.tsx`
- `app/(private)/asignacion/components/conditioned-orders-list-section.tsx`
- `app/(private)/asignacion/components/delivered-conditioned-orders-list-section.tsx`
- `app/(private)/asignacion/components/conditioning-orders-empty.tsx`
- `app/(private)/asignacion/components/conditioning-orders-skeleton.tsx`
- `app/(private)/asignacion/components/conditioning-orders-columns.tsx`
- `app/(private)/asignacion/components/assignment-view-tabs.tsx`
- `app/(private)/asignacion/components/order-distribution-full.tsx`
- `app/(private)/asignacion/components/order-outcome-notice.tsx` (nuevo)
- `app/(private)/asignacion/components/packed-order-notice.tsx` (se borra)
- `app/(private)/asignacion/components/conditioned-order-notice.tsx` (se borra)
- `app/(private)/asignacion/empaque/[id]/components/packing-order-screen.tsx`
- `app/(private)/asignacion/acondicionamiento/[id]/components/index.ts`
- `app/(private)/asignacion/acondicionamiento/[id]/components/conditioning-order-screen.tsx`
- `app/(private)/asignacion/acondicionamiento/[id]/components/conditioning-team-list.tsx`
- `app/(private)/asignacion/acondicionamiento/[id]/components/conditioning-team-picker.tsx`
- `app/(private)/asignacion/acondicionamiento/[id]/components/finish-conditioning-dialog.tsx`
- `app/(private)/asignacion/acondicionamiento/[id]/components/start-conditioning-dialog.tsx`
- `app/(private)/asignacion/acondicionamiento/[id]/components/countdown-gated-button.tsx` (se borra)
- `app/(private)/asignacion/acondicionamiento/[id]/components/conditioning-wait.ts` (nuevo)
- `app/(private)/pedidos/components/order-responsibles.tsx`
- `components/shared/countdown-gated-button.tsx` (nuevo)
- `components/shared/confirm-dialog.tsx`
- `components/shared/order-distribution-label.tsx`
- `components/shared/CATALOGO.md`
- `lib/shared/ui/responsible-groups.ts` (nuevo)

### Tests

- `tests/unit/paridad/asignacion-acondicionamiento-paridad.test.tsx` (nuevo)
- `tests/unit/paridad/__snapshots__/asignacion-acondicionamiento-paridad.test.tsx.snap` (nuevo)
- `tests/unit/paridad/__snapshots__/asignacion-listas-paridad.test.tsx.snap`
- `tests/unit/paridad/__snapshots__/asignacion-paridad.test.tsx.snap`
- `tests/unit/asignaciones-ui/assignment-hrefs.test.ts` (nuevo)
- `tests/unit/asignaciones-ui/conditioning-orders-list-section.test.tsx`
- `tests/unit/asignaciones-ui/delivered-conditioned-orders-list-section.test.tsx`
- `tests/unit/asignaciones-ui/asignacion-page.test.tsx`
- `tests/unit/asignaciones-ui/packed-order-notice.test.tsx`
- `tests/unit/asignaciones-ui/conditioned-order-notice.test.tsx`
- `tests/unit/asignaciones-ui/countdown-gated-button.test.tsx` (se mueve)
- `tests/unit/asignaciones-ui/finish-conditioning-dialog.test.tsx`
- `tests/unit/asignaciones-ui/start-conditioning-dialog.test.tsx`
- `tests/unit/asignaciones-ui/conditioning-order-screen.test.tsx`
- `tests/unit/asignaciones-ui/packing-order-screen.test.tsx`
- `tests/unit/shared/countdown-gated-button.test.tsx` (nuevo, movido)
- `tests/unit/shared-ui/responsible-groups.test.ts` (nuevo)
- `tests/unit/shared-ui/order-distribution-line-text.test.ts` (nuevo)
- `tests/unit/shared-ui/confirm-dialog-extension.test.tsx` (nuevo)
- `tests/guards/guard-piezas-base.test.ts`
- `tests/guards/guard-asignacion-componentizada.test.ts` (nuevo)
- `e2e/datos-de-lote-en-acondicionamiento.spec.ts` (solo `import`)

### Estado y specs

- `specs/QC-252-componentizacion-asignacion/requirements.md`
- `specs/QC-252-componentizacion-asignacion/design.md`
- `specs/QC-252-componentizacion-asignacion/tasks.md`
- `progress/impl_QC-252-componentizacion-asignacion.md`
- `progress/deudas.md`
