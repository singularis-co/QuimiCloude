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

## Archivos tocados

## Mapa R<n> → test

## Salida de los tests

## Bloqueos

Ninguno.
