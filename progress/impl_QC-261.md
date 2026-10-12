# QC-261 — Bitácora de implementación

Rama `feature/QC-261-rediseno-dashboard`, worktree `.worktrees/QC-261-rediseno-dashboard`.
Spec: `specs/QC-261-rediseno-dashboard/` (P1–P7 cerradas con la opción por defecto).

## T1 — Barrido de tests afectados (2026-10-12)

`Grep` sobre `tests/` y `e2e/` por los términos de T1. 43 archivos con alguna coincidencia; los que
no tocan estas pantallas se descartan con motivo.

### Se editan (con nota `ENMIENDA QC-261` donde cambian aserciones)

| Archivo | Motivo |
|---|---|
| `tests/ui/dashboard/execution-trace-table.test.tsx` | Enlace «Ver recorrido» → ítem del menú; R26 de QC-167 → disparador 44×44. Aserciones de URL (R6–R11) sin editar |
| `tests/ui/dashboard/execution-trace-detail.test.tsx` | «Vuelta atrás» → `data-go-back` + `sr-only`; «Motivo:» → «Motivo · » |
| `tests/unit/paridad/recorridos-paridad.test.tsx` + `.snap` | Snapshot regenerado en su commit (estado, columnas, error con reintento) |
| `tests/unit/marca/tablas-marca.test.tsx` | Lista cerrada de `execution-trace-columns.tsx`: + «Duración» |
| `tests/unit/shared-ui/empty-state.test.tsx` | Casos nuevos de `icon` y `heading` |
| `tests/guards/guard-identificador-de-request.test.ts` | Alta de `e2e/dashboard-rediseno.spec.ts` en `E2E_ESPERADOS` |
| `e2e/recorrido-ejecucion.spec.ts` | Líneas 435 y 503: `getByRole('link', { name: traceLinkName })` → menú «Acciones del pedido {n}» → «Ver recorrido»; línea 447: `getByText(GO_BACK_MARK)` visible → `[data-go-back="true"]`. Localiza filas por `data-table-row-<id>` (prefijo en línea 148, `rowsLocator`/`rowOf` en 170–176): con `card` el T8 comprueba si ese testid se duplica en la tarjeta y acota al cuerpo visible sin tocar aserciones |

### Se corren sin editar (deben seguir verdes)

| Archivo | Motivo |
|---|---|
| `tests/unit/dashboard-page.test.tsx` | Un `h1`, sin landmarks, `dashboard-content` |
| `tests/unit/navegacion/private-not-found.test.tsx` | testid, mensaje, sin palabras de permiso, sin enlace |
| `tests/unit/dashboard/execution-trace-format.test.ts` | Alias `TRACE_ORDER_STATUS_LABELS` se conserva |
| `tests/unit/dashboard/execution-trace-list-params.test.ts` | Parámetros de URL, sin cambios |
| `tests/guards/guard-piezas-base.test.ts` | `MISSING_PERSON_MARK` se conserva; regla 4 (sin esqueleto local) |
| `tests/guards/guard-catalogo-de-componentes.test.ts` | Fila de `EmptyState` actualizada |
| `tests/guards/guard-movimiento.test.ts` | Clase `motion-safe:animate-[…]` de la línea de tiempo |
| `tests/guards/guard-pantallas-exigen-permiso.test.ts` | `requirePagePermission` sigue primera línea |
| **Nuevo en el barrido:** `tests/unit/dashboard-route-contract.test.ts` | Lee la fuente de `page.tsx`, `dashboard-content.tsx`, sección, tabla, página y componente del detalle: sin `use client`/`useState`/`onClick` en página y contenido, `page.tsx` importa de `./components` y sin literal `/dashboard`, sin `100vh`, y **ninguna línea con `hover:` puede llevar `hidden`/`invisible`/`opacity-0`/`sr-only`** |
| **Nuevo en el barrido:** `tests/unit/navegacion/qc75-convenciones.test.ts` | Lee `app/(private)/not-found.tsx`: debe contener `private-not-found` |
| **Nuevo en el barrido:** `tests/unit/navegacion/pantallas-exigen-permiso.test.tsx` | Renderiza las páginas con las acciones del recorrido espiadas |
| Los trece E2E con `private-not-found` | testid conservado; sin cambios |

Los tres «nuevos en el barrido» solo se leen y se corren: no se editan, así que **no** se añaden a
`tasks.md > ## Archivos esperados` (añadirlos crearía choques de candado falsos con otras fichas).

### Descartados

`tests/unit/asignaciones/*` (módulo de dominio `execution-trace`, sin UI), `tests/unit/composition/
asignaciones-facade.test.ts`, `tests/unit/identity/session-once-per-request-actions.test.ts`,
`tests/integration/identity/*` (`resetIdentityToEmptyState`), `tests/unit/documentos/process-pdf-by-strategy.test.ts`
(«Motivo:» de otro dominio), `tests/unit/pedidos/order-view.test.ts`, `tests/unit/shared-ui/order-status.test.ts`,
`tests/unit/shared/data-table-states-sustituyen.test.tsx`: no leen ni renderizan nada que esta ficha cambie.

## Tandas

### Tanda 1 (T1)
Solo el barrido de arriba. `./init.sh`: init OK (111 archivos, 1543 tests pasados, 36 omitidos).

### Tanda 2 (T2, T3) — frontend_dev, en paralelo
- T2: `components/shared/empty-state.tsx` (props `icon` y `heading` opcionales; sin ellas, árbol de
  hoy), `components/shared/CATALOGO.md` (fila `EmptyState`: puntos de extensión y diseño
  `NoEncontrada.dc.html`), `tests/unit/shared-ui/empty-state.test.tsx` (5 casos nuevos «R19: …»; los
  5 existentes sin editar).
- T3: `app/(private)/dashboard/recorrido/[id]/components/execution-timeline.tsx` (nuevo,
  `ExecutionTimeline`, Server Component) y `tests/ui/dashboard/recorrido-rediseno.test.tsx`
  (`describe('ExecutionTimeline')`, 18 casos de R13–R16).
- Desvío menor de T3 (anotado): `design.md > 3.3` habla de tokens `--status-<tono>-*`, que no
  existen para `waiting`/`success`/`danger`; se usan `warning-*`, `success-*` y `destructive-*`, igual
  que `StatusBadge`. Ningún token nuevo; `app/globals.css` sin tocar.
- Salidas: vitest related T3 18/18; `guard-movimiento` + `dashboard-route-contract` 27/27; vitest
  related T2 3646 pasados; `guard-catalogo-de-componentes` + `private-not-found` 63/63; typecheck y
  lint 0 errores (7 avisos previos, ninguno en estos archivos).
- `./init.sh`: init OK (111 archivos, 1543 pasados, 36 omitidos).

### Tanda 3 (T4, T5, T6) — frontend_dev, en paralelo
- T4: `app/(private)/dashboard/page.tsx` (`PageShell` + `PageHeader`), `components/execution-trace-columns.tsx`
  (`StatusBadge` en estado, marcas y vueltas atrás; Mono tabular y alineación al final;
  `actionsColumn({ menu })` con «Ver recorrido» en lugar del `Link`), `components/execution-trace-table.tsx`
  (`card` y `retry`), `components/index.ts` (+ `TRACE_ACTIONS_LABEL_PREFIX`, `TRACE_MENU_TITLE_PREFIX`;
  fuera `TRACE_LINK_COLUMN_ID`, sin usos). Tests: `tests/ui/dashboard/dashboard-rediseno.test.tsx` (nuevo,
  14 casos R1, R3–R9), ENMIENDA en `execution-trace-table.test.tsx` (R2/R12 por el menú, R26 el disparador;
  URL de R6–R11 sin editar) y `tablas-marca.test.tsx` (+ «Duración"). Snapshot de `recorridos-paridad`
  regenerado en commit propio: solo cambian las 6 cabeceras (`div`+`h1` → `PageShell`+`PageHeader`); ese
  test solo pinta «Cargando…», así que badge/menú/reintento no aparecen en él. `recorridos-paridad.test.tsx`,
  `execution-trace-list-section.tsx` y `execution-trace-format.ts` sin cambios.
  Notas: «En curso» exige `!row.deleted` (R6); el título del menú va en `<span>` (no fragmento) porque
  `guard-formularios-y-acciones` R28 lo tomaba como acción de fila suelta.
- T5: `recorrido/[id]/components/execution-trace-detail.tsx` (`PageShell`, `ArrowLink`, `PageHeader`, `dl` de
  tres datos, `ExecutionTimeline`; error con `ArrowLink` + h1 «Recorrido» + `ErrorState`). `index.ts` y
  `page.tsx` sin cambios; `BACK_TO_LIST_TEXT` y `MISSING_PERSON_MARK` conservados. Tests:
  `describe('ExecutionTraceDetail')` en `recorrido-rediseno.test.tsx` (R10, R11×2, R12×4, R17) y ENMIENDA en
  `execution-trace-detail.test.tsx` (R13 «Motivo · …», R16 `data-go-back` + `sr-only`); R12, R17, R18, R20
  de QC-167 sin editar.
  Observación: el detalle pinta «Dado de baja»/«En curso» con `StatusBadge` directamente, en paralelo a las
  marcas de las columnas (mismos tonos y testids). Duplicación pequeña, posible unificación; no la exige el spec.
- T6: `app/(private)/not-found.tsx` (`EmptyState` con `icon` y `heading`, como `design.md > 3.4`) y
  `tests/unit/navegacion/no-encontrada-rediseno.test.tsx` (6 casos R19). `private-not-found.test.tsx` sin editar.
- Salidas de los subagentes: T4 related 154/154, lote del dashboard 165/165, `vitest run guard` 997 pasados;
  T5 related 88/88, lote 140 pasados; T6 related 10/10, `tests/unit/navegacion` 123 pasados. typecheck y lint
  0 errores (7 avisos previos ajenos).

### Tanda 4 (T7, T8; T9 parcial) — frontend_dev
- T7: `tests/ui/dashboard/textos-dashboard.test.tsx` (13 casos R21, textos literales en las tres pantallas,
  sin discrepancias) y `tests/guards/guard-qc261-limites-de-la-ficha.test.ts` (8 casos: R22 diff contra el
  merge-base sin `lib/`, `db/`, `middleware.ts`, `package.json` + sintético + skip ruidoso fuera de la rama;
  R7 sin `next/link` en `execution-trace-columns.tsx` (AST) + sintético; R18 sin `loading.*` bajo
  `app/(private)/dashboard/` + sintético). `vitest run guard`: 74 archivos, 1005 pasados, 19 omitidos.
- T8: `e2e/dashboard-rediseno.spec.ts` (nuevo; 6 casos × chromium/webkit: R8 a 390, R16 normal y reducido,
  R20 a 390/820/1440); alta al final de `E2E_ESPERADOS` en `tests/guards/guard-identificador-de-request.test.ts`
  (23/23); `e2e/recorrido-ejecucion.spec.ts` con `ENMIENDA QC-261`: `openTrace` (menú «Acciones del pedido
  {n}» → «Ver recorrido», helper existente `openRowActionsMenuItem`) en lugar de `traceLinkName` (antiguas
  líneas 435 y 503), y la vuelta atrás por `[data-go-back="true"]` con el mismo `toBeVisible()` (antigua 447).
  `data-table-row-<id>` no se duplica (las tarjetas usan `data-table-card-<id>`): sin acotar nada.
- Ajuste de medición en R8: el `Dialog` entra con `zoom-in-96`; el ítem medía 47,1 px a mitad de animación.
  Se espera a que no haya animaciones `running` antes de medir; umbral de 48 px intacto.

#### Salida E2E (2026-10-12)
`pnpm exec playwright test e2e/dashboard-rediseno.spec.ts e2e/recorrido-ejecucion.spec.ts e2e/permisos.spec.ts`:
```
  4 failed
    [chromium] › e2e\dashboard-rediseno.spec.ts:411:9 › R20 — a 820 px › … el buscador tiene 16 px de letra
    [chromium] › e2e\dashboard-rediseno.spec.ts:411:9 › R20 — a 1440 px › … el buscador tiene 16 px de letra
    [webkit] › e2e\dashboard-rediseno.spec.ts:411:9 › R20 — a 820 px › …
    [webkit] › e2e\dashboard-rediseno.spec.ts:411:9 › R20 — a 1440 px › …
    Expected: >= 16   Received: 14
  18 passed (1.1m)
```
`recorrido-ejecucion.spec.ts` (R18, R24) y `permisos.spec.ts`: verdes. R8, R16 y R20 a 390 px: verdes.

#### BLOQUEO (R20 a 820 y 1440 px)
El buscador de `DataTable` mide 14 px desde 768 px: `components/ui/input.tsx` lleva `md:text-sm` y
`components/shared/data-table/data-table-filters.tsx` añade `FIELD_TEXT = "text-base"`, que no anula la
variante `md:`. `design.md > 12` daba por hecho «buscador a 16 px (ya en `DataTable`)»; no es así por encima
de 768 px. El arreglo (p. ej. añadir `md:text-base` a `FIELD_TEXT`) cae en
`components/shared/data-table/data-table-filters.tsx`, **fuera de `## Archivos esperados`** y compartido por
todas las tablas. No se toca sin decisión del leader/humano; el test no se rebaja. Las aserciones de R20
posteriores a la del buscador (44 px de los controles, el detalle y el 404 a 820/1440) quedan sin ejecutar
hasta que pase esa línea.

## Mapa R<n> -> test

| R | Test |
|---|---|
| R1 | `tests/ui/dashboard/dashboard-rediseno.test.tsx` «R1 PageShell, un h1, bloque div con h2 y sin landmarks»; `tests/unit/dashboard-page.test.tsx` (sin editar) |
| R2 | `tests/ui/dashboard/execution-trace-table.test.tsx` (aserciones de URL sin editar; R12 por el menú) |
| R3 | `dashboard-rediseno.test.tsx` «R3 orden de columnas», «R3 Mono tabular y alineación al final»; `tests/unit/marca/tablas-marca.test.tsx` |
| R4 | `dashboard-rediseno.test.tsx` «R4 StatusBadge con su tono» |
| R5 | `dashboard-rediseno.test.tsx` «R5 waiting con la cifra», «R5 0 sin insignia y atenuado» |
| R6 | `dashboard-rediseno.test.tsx` «R6 baja muted sin En curso», «R6 activo progress» |
| R7 | `dashboard-rediseno.test.tsx` «R7 sin enlace en celda, disparador 44×44», «R7 ítem único con la misma URL»; `tests/guards/guard-qc261-limites-de-la-ficha.test.ts` (sin `next/link`) |
| R8 | `dashboard-rediseno.test.tsx` «R8 tarjeta», «R8 menú centrado, Cerrar, ítem de 48 px y foco de vuelta»; `e2e/dashboard-rediseno.spec.ts` «R8 — a 390 px …» (verde) |
| R9 | `dashboard-rediseno.test.tsx` «R9 vacío», «R9 error con Reintentar (router.refresh)» |
| R10 | `tests/ui/dashboard/recorrido-rediseno.test.tsx` «R10: dentro de PageShell, un único h1 … número en Mono» |
| R11 | `recorrido-rediseno.test.tsx` «R11: Volver a la lista … 44×44 …», «R11: también en el estado de error» |
| R12 | `recorrido-rediseno.test.tsx` 4 casos R12 (dl de tres datos, 0 atenuado, marcas, orden con la línea de tiempo) |
| R13 | `recorrido-rediseno.test.tsx` 2 casos R13; `tests/ui/dashboard/execution-trace-detail.test.tsx` R13 (ENMIENDA «Motivo · ») |
| R14 | `recorrido-rediseno.test.tsx` casos R14 (acción, `<time>`, «Paso {n}», avatar, «Sin dato», «Motivo · », «Hasta la siguiente») |
| R15 | `recorrido-rediseno.test.tsx` «$action lleva el tono $tone y su icono propio» (8), «cada retroceder lleva Vuelta atrás solo para lectores»; `execution-trace-detail.test.tsx` R16 (ENMIENDA) |
| R16 | `recorrido-rediseno.test.tsx` «entrada con motion-safe y screen-enter, retardo de 40 ms por índice», «el realce va solo con hover:»; `e2e/dashboard-rediseno.spec.ts` R16 normal y reducido (verdes) |
| R17 | `recorrido-rediseno.test.tsx` «R17: error con un único h1 Recorrido …»; `execution-trace-detail.test.tsx` R17 (sin editar) |
| R18 | `e2e/recorrido-ejecucion.spec.ts` (404, verde); `guard-qc261-limites-de-la-ficha.test.ts` (sin `loading.*`) |
| R19 | `tests/unit/navegacion/no-encontrada-rediseno.test.tsx` (6 casos); `tests/unit/navegacion/private-not-found.test.tsx` (sin editar); `tests/unit/shared-ui/empty-state.test.tsx` (5 casos) |
| R20 | `e2e/dashboard-rediseno.spec.ts` R20 × 390/820/1440 — **390 verde; 820 y 1440 rojos (BLOQUEO arriba)** |
| R21 | `tests/ui/dashboard/textos-dashboard.test.tsx` (13 casos) |
| R22 | `guard-qc261-limites-de-la-ficha.test.ts` (diff sin `lib/`, `db/`, `middleware.ts`, `package.json`) |
| R23 | `tests/guards/guard-catalogo-de-componentes.test.ts`, `guard-qc261-limites-de-la-ficha.test.ts` |
| R24 | `e2e/recorrido-ejecucion.spec.ts` (verde; solo apertura por menú y `data-go-back`) |

`./init.sh` de la Tanda 4: init OK (related 231 archivos, 3709 pasados, 1 omitido; rápidos y guardias 112
archivos, 1551 pasados, 36 omitidos).
