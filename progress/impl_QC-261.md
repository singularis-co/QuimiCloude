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
