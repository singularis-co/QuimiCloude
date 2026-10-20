# impl QC-301 — quitar-entregados-del-acondicionador

## T1 — Dominio y fachada (backend_dev, 2026-10-19)

### Archivos
- M `lib/modules/asignaciones/domain/assignment-views.ts`: sale `'acondicionados_entregados'` del tipo y del `push`; JSDoc ajustado.
- D `lib/modules/asignaciones/domain/list-delivered-conditioned-orders.ts`
- M `lib/modules/asignaciones/index.ts`: sale la exportacion.
- M `lib/composition/index.ts`: sale el import y el cableado de `listDeliveredConditionedOrders`.
- Puerto y adaptador sin tocar (`OrderCatalog.listAliveSummariesInCompany`, `conditionedBy`).
- M `tests/unit/asignaciones/assignment-views.test.ts`, `tests/unit/asignaciones/acondicionamiento-authorization.test.ts`,
  `tests/unit/composition/asignaciones-facade.test.ts`, `tests/unit/identity/roles/acondicionamiento-rol.test.ts`
- D `tests/unit/asignaciones/list-delivered-conditioned-orders.test.ts`

### R → test (T1)
- R1 → `assignment-views.test.ts` «QC-301 R1: el rol sembrado de acondicionamiento recibe exactamente…», «QC-301 R1: con otros permisos…»; `acondicionamiento-authorization.test.ts` «R2, QC-301 R1: …exactamente ['por_acondicionar', 'acondicionados']»
- R3 → `assignment-views.test.ts` «QC-301 R3: pedir `acondicionados_entregados` con el permiso…» y «…sin el permiso…»; `acondicionamiento-authorization.test.ts` «QC-301 R3: …cae a `por_acondicionar`»
- R6 → `asignaciones-facade.test.ts` «QC-301 R6: la fachada no expone…» y censo de 34; `acondicionamiento-rol.test.ts` «…QC-301 R6: son once rutas exactas…»
- R7 → `assignment-views.test.ts` «QC-301 R7: las vistas de los roles sin el permiso no cambian»

### Verificacion
- vitest (archivos de T1): assignment-views 35/35, acondicionamiento-authorization 23/23, asignaciones-facade 29/29, acondicionamiento-rol 16/16.
- `vitest related` (415 archivos): 414 ok; falla solo `tests/unit/asignaciones-ui/asignacion-page.test.tsx` (6 casos de «Entregados», alcance T2).
- lint: 0 errores (10 warnings previos, ninguno en archivos de T1).
- typecheck: errores solo en `app/(private)/asignacion/**` y `tests/unit/asignaciones-ui/**` (T2/T3) y `app/layout.tsx` (`LayoutProps`, previo, tipos generados de Next).
- grep `listDeliveredConditionedOrders` en `lib/`: vacio. En `app/`: `assignment-view-tabs-section.tsx` y `delivered-conditioned-orders-list-section.tsx` (T2).

Veredicto: T1 hecha; el rojo restante es de UI y lo cierra T2/T3.

## T2 y T3 — UI de `/asignacion` y vuelta desde `ENTREGADO` (frontend_dev, 2026-10-19)

### Archivos
- D `app/(private)/asignacion/components/delivered-conditioned-orders-list-section.tsx`
- M `app/(private)/asignacion/components/index.ts`: sale su bloque de exportacion.
- M `assignment-view-tabs.tsx`, `assignment-view-tabs-section.tsx` (sale el lector de entregados), `conditioning-orders-empty.tsx`, `conditioning-orders-skeleton.tsx`: sale la clave `acondicionados_entregados`.
- M `conditioned-orders-table.tsx`: `view?: Extract<AssignmentViewKind, 'acondicionados'>` (se conserva la prop, cambio minimo).
- M `app/(private)/asignacion/page.tsx`: sale la rama y el import.
- M `app/(private)/asignacion/acondicionamiento/[id]/components/conditioning-order-screen.tsx`: `TERMINADO || ENTREGADO` vuelven a «Acondicionados»; sale `backToDelivered`.
- M tests: `assignment-view-counts.test.ts`, `assignment-hrefs.test.ts`, `assignment-view-tabs.test.tsx`, `asignacion-page.test.tsx`, `conditioning-order-screen.test.tsx`, `conditioning-order-page.test.tsx`, `paridad/asignacion-acondicionamiento-paridad.test.tsx` + `.snap` (regenerada con `-u`: 4 entradas de «entregados» borradas, 1 actualizada: la vuelta del `ENTREGADO`).
- D `tests/unit/asignaciones-ui/delivered-conditioned-orders-list-section.test.tsx`

### R → test (T2, T3)
- R2 → `asignacion-page.test.tsx` «QC-301 R2: el rol sembrado ve exactamente dos pestañas…»; `assignment-view-tabs.test.tsx` «QC-301 R2: pinta exactamente dos pestañas…» y «QC-301 R2: no lee el número de pedidos entregados».
- R3 → `asignacion-page.test.tsx` «QC-301 R3: `?vista=acondicionados_entregados` cae a «Por acondicionar»…» y «QC-301 R3: %s pidiendo `?vista=acondicionados_entregados`…» (operador, empacador).
- R4 → `conditioning-order-screen.test.tsx` y `conditioning-order-page.test.tsx` «R21, QC-301 R4: en ENTREGADO … «Volver a «Acondicionados»»»; instantanea de paridad «R11 R24 — ENTREGADO, con su vuelta a la lista».
- R5 → sin lista que monte `ENTREGADO` para el acondicionador: borrada la seccion y su test; `assignment-hrefs.test.ts` mantiene `deliveredConditionedOrdersHref` prohibido; paridad sin la lista «entregados».

### Verificacion
- `pnpm exec vitest run` (7 archivos): asignacion-page 59/59, assignment-view-tabs 10/10, conditioning-order-page 19/19, conditioning-order-screen 39/39, asignacion-acondicionamiento-paridad 33/33, assignment-hrefs 9/9, assignment-view-counts 6/6 — 175/175.
- `pnpm run typecheck`: verde tras `pnpm exec next typegen` (antes solo `app/layout.tsx: Cannot find name 'LayoutProps'`, tipos generados de Next).
- `pnpm run lint`: 0 errores, 10 warnings previos (ninguno en archivos de T2/T3).
- grep `acondicionados_entregados` en `app/` y `lib/`: vacio.

Veredicto: T2 y T3 hechas; typecheck, lint y los 7 archivos de test en verde.

## T4 — E2E (implementer, 2026-10-19)

### Archivos

- `e2e/acondicionamiento.spec.ts`: el paso 1 espera dos pestañas (QC-301 R2); el paso 6 nuevo pide
  `?vista=acondicionados_entregados` y comprueba que aterriza en «Por acondicionar», sin la sección
  de «Acondicionados», con A y sin E (QC-301 R3, R5). El paso 4 ya comprobaba que E no sale en
  «Acondicionados» (R5).
- `e2e/operario-rediseno.spec.ts`: salen `TAB_TESTIDS.entregados` y su fila en R9.

### Salida

- `pnpm exec playwright test e2e/operario-rediseno.spec.ts` → `40 passed (2.8m)`.
- `pnpm exec playwright test e2e/acondicionamiento.spec.ts` → `2 failed, 4 passed (1.3m)`. Los dos
  rojos (R22, chromium y webkit) fallan en el **paso 2**, en
  `order-distribution-full`: se espera `2 × …envase1 / 3 × …envase2` y llega
  `2 × …envase1 · 1 l / 3 × …envase2 · 1 l`.
  - El paso 1 (dos pestañas) ya había pasado.
  - **No es de QC-301:** el sufijo de volumen viene de `9a330ab2 feat(pedidos): volumen en el
    reparto…`, que ya está en `dev` antes de esta rama. QC-301 no toca el paso 2 ni
    `order-distribution-full.tsx`.
  - No está en `tests/baseline-rojos.json`, que no lista E2E.
  - Lo decide el leader, porque el arreglo es ajeno al alcance de QC-301.
- Evidencia de los pasos 1, 3, 4, 5 y 6: corrí una copia temporal
  (`e2e/tmp-qc301-acond.spec.ts`), sin la aserción del paso 2 y nada más cambiado. La borré y no
  se commiteó.
  - `-g R22` → `2 passed (25.5s)` (chromium y webkit).
  - El servidor registró `GET /asignacion?vista=acondicionados_entregados 200`.

## Cierre

- `pnpm run typecheck`: 0 errores. Hace falta `pnpm exec next typegen` en un worktree recién
  instalado para `LayoutProps`.
- `pnpm run lint`: 0 errores y 10 avisos, ninguno en archivos de QC-301.
- grep de `acondicionados_entregados|listDeliveredConditionedOrders` en `app/` y `lib/`: 0.
- Sin dependencias nuevas y sin migraciones (R7, R8).

### Mapa R → test (consolidado)

| R | Test |
|---|---|
| R1 | `tests/unit/asignaciones/assignment-views.test.ts`, `tests/unit/asignaciones/acondicionamiento-authorization.test.ts` |
| R2 | `tests/unit/asignaciones-ui/asignacion-page.test.tsx`, `assignment-view-tabs.test.tsx`, `assignment-view-counts.test.ts`; `e2e/acondicionamiento.spec.ts` (paso 1); `e2e/operario-rediseno.spec.ts` (R9) |
| R3 | `assignment-views.test.ts`, `acondicionamiento-authorization.test.ts`, `asignacion-page.test.tsx`; `e2e/acondicionamiento.spec.ts` (paso 6) |
| R4 | `tests/unit/asignaciones-ui/conditioning-order-screen.test.tsx`, `conditioning-order-page.test.tsx`, paridad del detalle |
| R5 | `e2e/acondicionamiento.spec.ts` (pasos 4 y 6), `list-conditioned-orders` (sin cambios) |
| R6 | `tests/unit/composition/asignaciones-facade.test.ts`, `tests/unit/identity/roles/acondicionamiento-rol.test.ts` |
| R7 | `assignment-views.test.ts` (roles sin el permiso no cambian); sin migraciones |
| R8 | gate: typecheck y guardia de dependencias |

## Rojo heredado de 9a330ab2, arreglado en esta rama (2026-10-19)

- Lo decidió el humano el 2026-10-17: los rojos E2E heredados se arreglan en la rama de la
  feature, no se pasan al baseline.
- En `e2e/acondicionamiento.spec.ts`, el paso 2 ahora espera en `order-distribution-full` el volumen
  de cada línea que añadió `9a330ab2` («2 × …envase1 · 1 l / 3 × …envase2 · 1 l»), con la constante
  nueva `PRESENTATION_VOLUME`. Solo cambia el test; el código de producto no se toca.
- `set -a; . ./.env; set +a; pnpm exec playwright test e2e/acondicionamiento.spec.ts` →
  `6 passed (42.9s)`: R22 y R23 ×2, en chromium y webkit.
