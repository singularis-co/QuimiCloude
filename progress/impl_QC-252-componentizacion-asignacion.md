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

## Archivos tocados

## Mapa R<n> → test

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

## Bloqueos

Ninguno. Para el reviewer: `packing-order-screen.tsx` (pantalla de cliente) importa
`assignmentViewHref` por su ruta exacta y no por el barrel de `asignacion/components`, porque el barrel
arrastra secciones de servidor (`@/lib/composition`) al cliente. Se aparta de la regla de importar
por el barrel; si el reviewer la exige, la alternativa es separar un barrel de cliente, fuera de esta
ficha.
