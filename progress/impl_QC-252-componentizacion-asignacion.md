# QC-252 — Componentización de /asignacion · bitácora del implementer

Rama `feature/QC-252-componentizacion-asignacion`, worktree `.worktrees/QC-252-componentizacion-asignacion`.

## Paso 0 (2026-10-12)

- P1–P6 movidas a `requirements.md > Decisiones cerradas (no reabrir)` (humano, al aprobar el spec).
- P6: deuda nueva `progress/deudas.md > D51` (`AssignedOrderDeliveredNotice`,
  `AssignedOrdersError`/`AssignmentListError`, alias `MISSING_VALUE_MARK`).

## Censo T0b — tests que nombran lo que se toca (antes de tocar producción)

Grep sobre `tests/unit`, `tests/guards`, `tests/integration` y `e2e` de cada símbolo y archivo de
`tasks.md > T0b`. Los símbolos sin aparición (`conditioning-orders-href`, `ConditioningListView`,
`finishedOrdersHref`, `packingOrdersHref`, `BACK_HREF`, `ConditioningOrdersEmpty`, `groupTeamByOrigin`,
`ResponsibleGroup`, `statusLabel`, `distributionLineText`, `MISSING_NAME_MARK`,
`FinishConditioningDialog`, `CONDITIONING_ORDER_LINK_CLASS`) no tienen test que ajustar.

| Archivo de test | Nombra | Qué le pasa |
| --- | --- | --- |
| `tests/unit/asignaciones-ui/conditioning-orders-list-section.test.tsx` | `conditioningOrdersHref`, `conditionedOrdersHref`, `conditioning-orders-empty` | import → `assignedOrdersListHref`; mismas cadenas (T2) |
| `tests/unit/asignaciones-ui/delivered-conditioned-orders-list-section.test.tsx` | `deliveredConditionedOrdersHref`, `conditioning-orders-empty` | ídem (T2); el testid del vacío no cambia (T3a) |
| `tests/unit/asignaciones-ui/asignacion-page.test.tsx` | `data-list`, `ConditioningOrdersSkeleton` (por tipo) | aserción de `data-list` que se retira (D4, T3a); el tipo se conserva; avisos si los nombra (T5a) |
| `tests/unit/asignaciones-ui/packed-order-notice.test.tsx` | `PackedOrderNotice` | enmienda → `OrderOutcomeNotice kind="packed"` (T5a) |
| `tests/unit/asignaciones-ui/conditioned-order-notice.test.tsx` | `ConditionedOrderNotice` | enmienda → `OrderOutcomeNotice kind="conditioned"` (T5a) |
| `tests/unit/asignaciones-ui/countdown-gated-button.test.tsx` | `CountdownGatedButton`, `CONDITIONING_WAIT_SECONDS`, `COUNTDOWN_GATED_BUTTON_TESTID` | se mueve a `tests/unit/shared/countdown-gated-button.test.tsx`; import (T1d) |
| `tests/unit/asignaciones-ui/finish-conditioning-dialog.test.tsx` | `COUNTDOWN_GATED_BUTTON_TESTID` | import desde `components/shared` (T5b) |
| `tests/unit/asignaciones-ui/start-conditioning-dialog.test.tsx` | `COUNTDOWN_GATED_BUTTON_TESTID` | import desde `components/shared` (T5b) |
| `tests/unit/asignaciones-ui/conditioning-orders-columns.test.tsx` | `orderDistributionFullText` | sin cambio (la función se conserva); correr en T4b |
| `tests/unit/asignaciones-ui/assigned-orders-columns.test.tsx` | `MISSING_VALUE_MARK` (alias del barrel) | sin cambio (P6) |
| `tests/unit/pedidos-ui/order-responsibles.test.tsx` | `groupResponsiblesByOrigin` | sin cambio (reexport); correr en T1a |
| `tests/unit/pedidos-ui/order-route-contract.test.ts` | `groupResponsiblesByOrigin` | sin cambio (reexport); correr en T1a |
| `tests/guards/guard-qc87-no-reimplementado.test.ts` | `components/order-responsibles.tsx` (lee y muta su fuente) | sin cambio previsto; correr en T1a (el filtro sale del archivo) |
| `tests/guards/guard-piezas-base.test.ts` | `ARCHIVOS_D11`, `D11_SIN_HALLAZGOS`, `VACIOS_Y_ESQUELETOS_D7`, `conditioning-orders-empty/skeleton`, `TOUCH_TARGET`, `MISSING_VALUE_MARK` | enmienda D13 (T3c) |
| `tests/guards/guard-formularios-y-acciones.test.ts` | `NO_SE_TOCAN_R30`, `PREFIJOS_QUE_NO_SE_TOCAN_R30`, `conditioning-orders-empty.tsx`, `finish-conditioning-dialog.tsx` | sin cambio (detector puro sobre listas; ningún archivo listado se borra) |
| `tests/guards/guard-catalogo-de-componentes.test.ts` | `PIEZAS_PREVIAS_AL_REDISENO`, `order-distribution-label.tsx` | sin cambio; correr en T1e |
| `tests/unit/paridad/asignacion-listas-paridad.test.tsx` (+ `.snap`) | barrel de la ruta | solo la diferencia de R5 en el `.snap` (T3a) |
| `tests/unit/paridad/asignacion-paridad.test.tsx` (+ `.snap`) | barrel de la ruta | ídem |
| `tests/unit/paridad/confirmaciones-paridad.test.tsx` | `ConfirmDialog` | sin cambio en su snapshot (T1c) |
| `e2e/datos-de-lote-en-acondicionamiento.spec.ts` | `countdown-gated-button`, `CONDITIONING_WAIT_SECONDS`, `COUNTDOWN_GATED_BUTTON_TESTID`, `conditioned-order-notice`, `orderDistributionFullText` | solo `import` (T6a) |
| `e2e/acondicionar-con-equipo.spec.ts` | testids `conditioned-order-notice`, `countdown-gated-button`, `finish-conditioning-dialog` (literales) | sin cambio |
| `e2e/empaque.spec.ts`, `envases-del-pedido.spec.ts`, `pasos-de-envasado.spec.ts`, `pedido-en-varias-presentaciones.spec.ts` | testid `packed-order-notice` (literal) | sin cambio |
| `e2e/login-skin.spec.ts`, `pedido-bloqueado.spec.ts`, `tests/unit/inventario/product-route-contract.test.ts`, `pedidos-ui/order-customer-dialog.test.tsx`, `recetas-ui/*`, `shared/data-table-viewport.test.tsx` | `TOUCH_TARGET` de otras rutas | sin relación; sin cambio |
| `e2e/envases-del-pedido.spec.ts`, `e2e/pedidos-cotizacion.spec.ts`, `guard-pantalla-pedidos-se-amplia.test.ts`, `pedidos-ui/*`, `shared-ui/responsible-avatars.test.tsx` | `MISSING_VALUE_MARK` de `/pedidos` o local | sin relación; sin cambio |

Tests fuera de `tasks.md > Archivos esperados` que no cambian: ninguno sale del censo con cambio.

## Tandas

### T0a (frontend_dev) — paridad nueva (D14)

- Creados: `tests/unit/paridad/asignacion-acondicionamiento-paridad.test.tsx` y su `.snap` (36 casos,
  36 snapshots) sobre el código sin tocar; commit propio `f06556ab` antes de cualquier cambio de
  producción. Cubre todo D14 más las listas pobladas de las tres vistas del acondicionador. No
  congela «Terminar» de empaque con pasos de envasado (fuera de D14).
- Preparación: el worktree no tenía `node_modules`; `pnpm install --frozen-lockfile`,
  `prisma generate`, `next typegen` (sin cambios versionados).

### T1a + T1b (frontend_dev) — agrupado, filtro y línea de reparto (D5, D7)

- Creados: `lib/shared/ui/responsible-groups.ts`, `tests/unit/shared-ui/responsible-groups.test.ts`,
  `tests/unit/shared-ui/order-distribution-line-text.test.ts`. Modificados:
  `app/(private)/pedidos/components/order-responsibles.tsx` (importa, reexporta, conserva exports),
  `components/shared/order-distribution-label.tsx` (`orderDistributionLineText` exportada).
- Filtro comprobado idéntico en `OrderResponsibles` y `ConditioningTeamPicker`
  (`trim().toLocaleLowerCase()`).
- `order-responsibles.test.tsx`, `order-route-contract.test.ts`, `guard-qc87-no-reimplementado` verdes sin tocarlos.

### T1c + T1d (frontend_dev) — `ConfirmDialog` extendido y botón con espera (D9, D10)

- Modificado `components/shared/confirm-dialog.tsx` (`contentClassName?`, `confirmSlot?`). Creados
  `components/shared/countdown-gated-button.tsx` (`seconds` obligatorio),
  `asignacion/acondicionamiento/[id]/components/conditioning-wait.ts`,
  `tests/unit/shared-ui/confirm-dialog-extension.test.tsx`. Movido (git mv)
  `tests/unit/asignaciones-ui/countdown-gated-button.test.tsx` → `tests/unit/shared/countdown-gated-button.test.tsx`.
- La copia de la ruta del botón sigue viva hasta T5b. Snapshot de `confirmaciones-paridad` sin cambios.

### T1e (frontend_dev) — catálogo (R23)

- `components/shared/CATALOGO.md`: filas de `CountdownGatedButton` (Compuestos, `Dominio.dc.html`) y
  de `groupResponsiblesByOrigin`/`filterByDisplayName` (Apoyos, `sin UI`); `contentClassName` y
  `confirmSlot` en `ConfirmDialog`; `orderDistributionLineText` en `OrderDistributionLabel`.
- El `Alcance` del botón no cita QC-265 (la guardia del catálogo rechaza citas de ticket).
- Nota de R23: las filas de T1a/T1b entraron en el commit de T1c–T1e, no en el de T1a/T1b; los dos
  commits van en la misma tanda y ningún commit publicado queda sin su fila.

### T2 (frontend_dev) — direcciones (D1, R1–R3)

- Modificados: `asignacion/components/{finished-orders-table,finished-orders-list-section,packing-orders-list-section,conditioning-orders-table,conditioning-orders-list-section,conditioned-orders-table,conditioned-orders-list-section,delivered-conditioned-orders-list-section}.tsx`, `asignacion/components/index.ts`, `asignacion/empaque/[id]/components/packing-order-screen.tsx` (solo `BACK_HREF`), `tests/unit/asignaciones-ui/{conditioning-orders-list-section,delivered-conditioned-orders-list-section}.test.tsx` (solo import y llamada; cadenas esperadas iguales).
- Borrado (git rm): `asignacion/components/conditioning-orders-href.ts`. Creado: `tests/unit/asignaciones-ui/assignment-hrefs.test.ts`.
- `packing-order-screen.tsx` importa `assignmentViewHref` por `../../../components/assignment-view-params`, no por el barrel: por el barrel la pantalla de cliente arrastraba `assigned-orders-list-section` → `@/lib/composition` y `packing-order-page.test.tsx` caía (su mock no define `observabilidad`).
- Mapa: R1 → `assignment-hrefs.test.ts > direcciones de las listas de /asignacion (R1)`; R2 → `> vuelta a «Por empacar» (R2)`; R3 → `> los constructores sueltos ya no existen (R3)`.
- Grep de los símbolos borrados y de `conditioning-orders-href` en app, components, lib, tests, e2e: sin apariciones (salvo la lista del propio test de R3).
- `pnpm run typecheck`: exit 0. `pnpm run lint`: 0 errors, 7 warnings (ajenos: confirm-catalog-import.test.ts, order-service.test.ts). `vitest related` (13 archivos): 37 files, 521 tests passed. `vitest run tests/unit/asignaciones-ui` + 3 de paridad: 40 files, 525 tests passed, sin cambios de snapshot.
- Veredicto: T2 hecha, direcciones idénticas y paridad intacta.

### Tanda 3 (frontend_dev; el agente murió por un corte de red al final y el implementer cerró la verificación)

- T3a: `conditioning-orders-empty.tsx` y `conditioning-orders-skeleton.tsx` delegan en
  `AssignmentListEmpty`/`AssignmentListSkeleton`; «Entregados» usa `ConditioningOrdersEmpty`;
  «Por empacar» usa `AssignmentListEmpty`. `asignacion-page.test.tsx`: fuera la aserción de `data-list`.
  Diff de los `.snap`: solo `data-testid="packing-orders-empty"` en las entradas de vacío de
  «Por empacar» (3 en `asignacion-listas-paridad`, 2 en `asignacion-paridad`: primera página y página
  posterior; el design decía 1, pero las dos son el vacío de «Por empacar»).
- T3b: `touchTarget` en `assignment-view-tabs.tsx`, `conditioning-orders-columns.tsx`,
  `conditioning-order-screen.tsx`; `MissingValue` compartido; `ErrorAlert` para el error de candidatos.
  El barrel deja de exportar `CONDITIONING_ORDER_LINK_CLASS` (ningún consumidor).
- T3c: `guard-piezas-base`: los archivos de `/asignacion` a `D11_SIN_HALLAZGOS`,
  `EXCLUSIONES_ESTRECHAS_D11` con el alias del barrel, `VACIOS_Y_ESQUELETOS_D7_PENDIENTES = []`.
  Muerde (comprobado por el implementer): con `min-h-11 min-w-11` reintroducido en
  `assignment-view-tabs.tsx`, la guardia sale roja (`R7 (regla 2): nadie escribe el par como literal`
  y `QC-232 (R26, R28)…`); deshecho antes del commit.

### Tanda 4 (frontend_dev)

- T4a: `conditioning-team-list.tsx` con `groupResponsiblesByOrigin` (fuera `groupTeamByOrigin`);
  `conditioning-team-picker.tsx` con `filterByDisplayName`.
- T4b: fuera los `statusLabel` de las dos pantallas (`ORDER_STATUS_LABELS`); fuera
  `distributionLineText` (empaque) y `MISSING_NAME_MARK` (`order-distribution-full.tsx`), las dos con
  `orderDistributionLineText`; `conditioning-orders-columns.tsx` importa `ORDER_STATUS_LABELS`
  directamente. Casos R11/R12 nuevos en `conditioning-order-screen.test.tsx` y
  `packing-order-screen.test.tsx`. `order-distribution-full.tsx` pasó a `D11_SIN_HALLAZGOS` y salió
  su exclusión temporal de la guardia.
- Fuera del encargo, sin tocar: `packing-orders-columns.tsx` sigue usando el alias
  `COMPANY_ORDER_STATUS_LABELS` (la ficha no lo nombra).

### Tanda 5 (frontend_dev)

- T5a: `order-outcome-notice.tsx` nuevo; borrados `packed-order-notice.tsx` y
  `conditioned-order-notice.tsx`; barrel y `page.tsx`; tests de aviso enmendados.
- T5b: `finish-conditioning-dialog.tsx` sobre `ConfirmDialogFrame` + `ConfirmDialogBody` (las piezas
  de la fila `ConfirmDialog` del catálogo) con `confirmSlot` y `contentClassName`, para que el
  `useActionState` siga en el formulario interior y el `key` por apertura en `conditioning-actions.tsx`
  (D9). «Cancelar» sin `type` explícito da el mismo árbol (paridad del diálogo idéntica).
  `testIds.confirm` es obligatorio y recibe el testid del botón con espera, aunque no se pinta.
  `start-conditioning-dialog.tsx` importa el botón de shared; borrada la copia de la ruta y sus
  exports del barrel.
- T5c: guardia nueva `tests/guards/guard-asignacion-componentizada.test.ts` (12 casos, verdes sobre el
  repo y rojos con cada muestra que viola).

## Archivos tocados

Producción: los de `tasks.md > Archivos esperados > Producción`, sin añadidos. Tests: los de
`> Tests` (nota: `tests/unit/asignaciones-ui/conditioning-order-screen.test.tsx` y
`packing-order-screen.test.tsx` llevan casos nuevos). Estado: `requirements.md`, `tasks.md`,
`progress/deudas.md` (D51 nueva; D42, D43, D47 resueltas), esta bitácora.

## Mapa R<n> → test

| R | Test |
| --- | --- |
| R1 | `tests/unit/asignaciones-ui/assignment-hrefs.test.ts > direcciones de las listas de /asignacion (R1)`; `conditioning-orders-list-section.test.tsx`, `delivered-conditioned-orders-list-section.test.tsx` |
| R2 | `assignment-hrefs.test.ts > vuelta a «Por empacar» (R2)` |
| R3 | `assignment-hrefs.test.ts > los constructores sueltos ya no existen (R3)`; `tests/guards/guard-asignacion-componentizada.test.ts` |
| R4 | `tests/unit/paridad/asignacion-acondicionamiento-paridad.test.tsx > R4 R24 — <lista>, vacio` y `… vacio en una pagina posterior` |
| R5 | `tests/unit/paridad/__snapshots__/asignacion-listas-paridad.test.tsx.snap` y `asignacion-paridad.test.tsx.snap` (vacío de «Por empacar»); `packing-orders-list-section.test.tsx` |
| R6 | `asignacion-acondicionamiento-paridad.test.tsx > R6 R24 — esqueleto de <lista>`; `asignacion-page.test.tsx` (texto para lectores) |
| R7 | `guard-asignacion-componentizada.test.ts` |
| R8 | `tests/unit/shared-ui/responsible-groups.test.ts`; paridad de la lista de equipo (R8) |
| R9 | `responsible-groups.test.ts` (tipos y barrel de `/pedidos`); `tests/unit/pedidos-ui/order-route-contract.test.ts`; `guard-asignacion-componentizada.test.ts` |
| R10 | `responsible-groups.test.ts`; paridad del selector (R10); `start-conditioning-dialog.test.tsx` |
| R11 | `conditioning-order-screen.test.tsx > R11: %s se lee «%s», el texto de antes`; `packing-order-screen.test.tsx > ídem`; paridad del detalle (R11) |
| R12 | `conditioning-order-screen.test.tsx > R12: un estado imposible aquí (PENDIENTE)…`; `packing-order-screen.test.tsx > R12: … (CANCELADO)…` |
| R13 | `tests/unit/shared-ui/order-distribution-line-text.test.ts`; paridad de empaque (R13) |
| R14 | paridad de «Por acondicionar» (listas pobladas de `asignacion-acondicionamiento-paridad`); `conditioning-orders-columns.test.tsx` |
| R15 | `packed-order-notice.test.tsx`, `conditioned-order-notice.test.tsx`; paridad de avisos (R15) |
| R16 | `guard-asignacion-componentizada.test.ts` |
| R17 | `finish-conditioning-dialog.test.tsx`; paridad del diálogo (R17) |
| R18 | `tests/unit/shared-ui/confirm-dialog-extension.test.tsx`; `tests/unit/paridad/confirmaciones-paridad.test.tsx` (snapshot sin cambios) |
| R19 | `tests/unit/shared/countdown-gated-button.test.tsx`; `guard-asignacion-componentizada.test.ts` |
| R20 | paridad del detalle con error de candidatos catalogado e inesperado (R20); `conditioning-order-screen.test.tsx` |
| R21 | `tests/guards/guard-piezas-base.test.ts > R7 (regla 2)` y `D11_SIN_HALLAZGOS`; `tests/unit/asignaciones-ui/a11y-tactil.test.tsx` |
| R22 | `guard-piezas-base.test.ts > R22: ningun archivo de /asignacion queda excluido entero; el barrel solo por su alias` |
| R23 | `tests/guards/guard-catalogo-de-componentes.test.ts` |
| R24 | `asignacion-acondicionamiento-paridad.test.tsx`, `asignacion-listas-paridad.test.tsx`, `asignacion-paridad.test.tsx` |
| R25 | E2E de T6a (abajo) |

## Censo final (T6b)

Grep sobre `tests`, `e2e`, `app`, `components` y `lib` de los símbolos y archivos borrados
(`conditioning-orders-href`, los seis constructores, `ConditioningListView`, `BACK_HREF`, `data-list`,
`groupTeamByOrigin`, `distributionLineText`, `MISSING_NAME_MARK`, `PackedOrderNotice`,
`ConditionedOrderNotice`, rutas de los dos avisos y de la copia del botón, `CONDITIONING_ORDER_LINK_CLASS`):
solo aparecen en las listas de prohibidos de `guard-asignacion-componentizada.test.ts` y
`assignment-hrefs.test.ts` (R3). `statusLabel` solo queda en `inventario/importar` (ajeno).

## Salida de los tests

### Cierre de tandas 0–2 (implementer, 2026-10-12)

```
pnpm run typecheck   -> exit 0
pnpm run lint        -> ✖ 7 problems (0 errors, 7 warnings)   (ajenos: confirm-catalog-import.test.ts, order-service.test.ts)
pnpm exec vitest run guard tests/unit/paridad tests/unit/shared-ui tests/unit/shared/countdown-gated-button.test.tsx \
  tests/unit/asignaciones-ui tests/unit/pedidos-ui/order-responsibles.test.tsx tests/unit/pedidos-ui/order-route-contract.test.ts
 Test Files  174 passed (174)
      Tests  2356 passed | 18 skipped (2374)
```

Sin cambios en ningún snapshot de paridad preexistente.

### Cierre de tandas 3–6 (implementer, 2026-10-12)

```
pnpm run typecheck   -> exit 0
pnpm run lint        -> ✖ 7 problems (0 errors, 7 warnings)   (ajenos: confirm-catalog-import.test.ts, order-service.test.ts)
pnpm exec vitest run guard tests/unit/paridad tests/unit/asignaciones-ui tests/unit/shared-ui tests/unit/shared \
  tests/unit/pedidos-ui/order-responsibles.test.tsx tests/unit/pedidos-ui/order-route-contract.test.ts
 Test Files  198 passed (198)
      Tests  2624 passed | 20 skipped (2644)
```

Snapshots: solo cambiaron las entradas de vacío de «Por empacar» (R5, T3a); la paridad nueva de
acondicionamiento no cambió desde su commit `f06556ab`.

### E2E de T6a (frontend_dev)

`git diff e2e/`: solo `e2e/datos-de-lote-en-acondicionamiento.spec.ts`, solo líneas de `import`
(`conditioning-wait`, `components/shared/countdown-gated-button`, `order-outcome-notice`; el import de
`order-distribution-full` cambió de posición por el orden alfabético). Ninguna aserción.

Entorno: la base de desarrollo iba 5 migraciones atrás; se aplicó `pnpm run db:migrate`
(`prisma migrate deploy`). Playwright no carga `.env`: se cargó con `set -a; . ./.env`, como `init.sh`.

`pnpm exec playwright test` de los 9 specs de T6a (chromium + webkit):

```
1 failed
  [webkit] › e2e\acondicionar-con-equipo.spec.ts:395:7 › acondicionar con equipo (R33, R34) › R33 y R34 - ...
39 passed (3.8m)
```

El fallo: `page.waitForURL` agotó 60 s en la línea 499 (vuelta a «Por acondicionar»), solo en webkit.
Reintento del spec solo:

```
ok 1 [chromium] ... (17.4s)
ok 2 [webkit] ... (20.4s)
2 passed (25.5s)
```

Pasan: acondicionamiento (4+4), datos-de-lote (1+1), empaque (1+1), pasos-de-envasado (1+1),
envases-del-pedido (2+2), pedido-en-varias-presentaciones (2+2), pedidos-asignados (4+4),
pedidos-terminados (4+4), acondicionar-con-equipo (1+1 al reintentar). El fallo de webkit se toma como
inestabilidad (pasa al reintentar sin cambios); si CI lo repite, mirarlo.

`./init.sh` (T6b) lo corre el leader al cerrar la tanda.

## Review vuelta 1: arreglos (2026-10-12)

- M1 (`78fff63b`): `empaque/[id]/page.tsx` importa `assignmentViewHref` por el barrel y pasa
  `backHref` a `PackingOrderScreen`; fuera el import profundo. `packing-order-page.test.tsx` gana el
  caso R2 de `backHref` y el `observabilidad` en su mock de `@/lib/composition` (mismo patrón que
  `conditioning-order-page.test.tsx`).
- m3 (`c8e14a8c`): con `confirmSlot`, `ConfirmDialog`/`ConfirmDialogBody` no admiten
  `testIds.confirm` (tipo discriminado); `delete-confirm-dialog.tsx` ajustado sin cambio de conducta;
  fila del catálogo al día.
- m4, m5 (`fe917e3e`): fuera `CONDITIONING_ORDERS_PAGE_PAST_END_TEXT` y
  `CONDITIONING_ORDERS_FIRST_PAGE_TEXT`; el test del botón con espera usa un literal propio.
- m1, m2 y las enmiendas de M1 y m4 (`6b5359c9`): en `design.md`. `tasks.md > Archivos esperados`
  suma los archivos nuevos del arreglo.
- F2.3 (`380295f8`): merge de `origin/dev` (QC-260). Un conflicto trivial en `CATALOGO.md` (fila
  `Notice` de dev + fila `OrderDistributionLabel` de esta rama). Sin migraciones.

```
pnpm run typecheck -> exit 0
pnpm run lint      -> ✖ 7 problems (0 errors, 7 warnings)  (ajenos)
pnpm exec vitest related --run <producción tocada desde origin/dev>
 Test Files  215 passed (215)
      Tests  3461 passed | 1 skipped (3462)
pnpm exec vitest run guard tests/unit/paridad
 Test Files  95 passed (95)
      Tests  1409 passed | 19 skipped (1428)
```

## Bloqueos

Ninguno. Para el reviewer: `packing-order-screen.tsx` (pantalla de cliente) importa
`assignmentViewHref` por su ruta exacta y no por el barrel de `asignacion/components`, porque el barrel
arrastra secciones de servidor (`@/lib/composition`) al cliente. Se aparta de la regla de importar
por el barrel; si el reviewer la exige, la alternativa es separar un barrel de cliente, fuera de esta
ficha.
