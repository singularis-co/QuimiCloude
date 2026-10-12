# QC-261 — Tareas

Cuatro tandas. **Tanda 1:** T1 (fija qué tests se tocan). **Tanda 2:** T2 y T3, en paralelo.
**Tanda 3:** T4, T5 y T6 (T5 depende de T3; T6 de T2; T4 de nada más que T1). **Tanda 4:** T7, T8
y T9. Cada tanda termina con `pnpm run typecheck`, `pnpm run lint`,
`pnpm exec vitest related --run <archivos>` y `pnpm exec vitest run guard`.

Si el humano cierra alguna de P1–P7 con otra opción que la de por defecto, se ajusta la task que
la cita antes de empezar su tanda.

## Tanda 1

- [x] **T1. Barrido de tests afectados (antes de tocar código).** Con `Grep` sobre `tests/` y
  `e2e/`, por: `execution-trace`, `ExecutionTrace`, `TRACE_LINK_TEXT`, `traceLinkName`,
  `GO_BACK_MARK`, `DELETED_ORDER_MARK`, `ACTIVE_ORDER_MARK`, `BACK_TO_LIST_TEXT`, `Motivo:`,
  `dashboard-title`, `dashboard-content`, `private-not-found`, `PrivateNotFound`, `EmptyState`,
  `buildExecutionTraceColumns`. Lista de partida (grep del spec, 2026-10-12), con el motivo en
  `design.md > 6`:
  - Unit/UI: `tests/ui/dashboard/execution-trace-table.test.tsx`,
    `tests/ui/dashboard/execution-trace-detail.test.tsx`, `tests/unit/dashboard-page.test.tsx`,
    `tests/unit/navegacion/private-not-found.test.tsx`,
    `tests/unit/paridad/recorridos-paridad.test.tsx` (+ su `.snap`),
    `tests/unit/marca/tablas-marca.test.tsx`, `tests/unit/shared-ui/empty-state.test.tsx`,
    `tests/unit/dashboard/execution-trace-format.test.ts`,
    `tests/unit/dashboard/execution-trace-list-params.test.ts` (no deberían cambiar).
  - Guardias: `tests/guards/guard-piezas-base.test.ts` (`MISSING_PERSON_MARK`, regla 4 de
    esqueletos), `tests/guards/guard-catalogo-de-componentes.test.ts`,
    `tests/guards/guard-movimiento.test.ts`, `tests/guards/guard-pantallas-exigen-permiso.test.ts`,
    `tests/guards/guard-identificador-de-request.test.ts`.
  - E2E: `e2e/recorrido-ejecucion.spec.ts` (**se ajusta**: líneas 435, 447 y 503 de hoy; comprobar
    también su ancho de ventana y si `data-table-row-<id>` es solo de la tabla), y los trece E2E que
    usan `private-not-found` (sin cambios esperados).
  *Hecho:* la lista está en `progress/impl_QC-261.md` con cada caso y su motivo; cualquier test que
  aparezca y no esté aquí se añade a la lista y a `## Archivos esperados`.

## Tanda 2

- [ ] **T2 [P]. `EmptyState` gana `icon` y `heading` opcionales** (`design.md > 3.1`). Casos nuevos
  en `tests/unit/shared-ui/empty-state.test.tsx` (recuadro oculto a lectores, `h1`/`h2` según
  `level`, `eyebrow` antes del encabezado, tallas `default` y `lg`; sin las props, árbol idéntico al
  de hoy). Fila del catálogo con los puntos de extensión y `docs/diseno/canvas/NoEncontrada.dc.html`
  en `Diseño`. *Hecho:* test y guardia del catálogo verdes; los consumidores de hoy sin cambios.

- [ ] **T3 [P]. `ExecutionTimeline`** (`design.md > 3.3`, `4`).
  `app/(private)/dashboard/recorrido/[id]/components/execution-timeline.tsx`: `h2` «Anotaciones» con
  contador, `ol` con nombre «Anotaciones», un `li` por paso con `data-testid`, `data-action`,
  `data-go-back`, punto con icono y tono por acción (tabla de § 3.3), acción, `<time>`, «Paso {n}»,
  avatar con `avatarTone` + `getInitials` o «—» con «Sin dato», «Motivo · …», «Hasta la siguiente:
  …» salvo en la última, «Vuelta atrás» `sr-only` en cada retroceder, entrada con
  `motion-safe:animate-[screen-enter_var(--dur-slow)_var(--ease-enter)_both]` y retardo en línea de
  40 ms por índice, realce solo con `hover:`. Tests en `tests/ui/dashboard/recorrido-rediseno.test.tsx`
  (R13, R14, R15, R16 en jsdom: retardos y clases). *Hecho:* tests y `guard-movimiento` verdes, y
  `app/globals.css` sin tocar (`design.md > 4`: candado con QC-265).

## Tanda 3

- [ ] **T4. Dashboard** (depende de T1; `design.md > 3.2`). `page.tsx` con `PageShell` y
  `PageHeader`; `execution-trace-list-section.tsx` sin landmark; `execution-trace-columns.tsx` con
  `StatusBadge`, marcas, alineación, `tabular` en «Duración» y `actionsColumn({ menu })` en lugar del
  `Link`; `execution-trace-table.tsx` con `card` y `retry`. Tests en
  `tests/ui/dashboard/dashboard-rediseno.test.tsx` (R1, R3–R9, incluido el menú centrado en tarjeta
  con el foco de vuelta). Ajustes con nota `ENMIENDA QC-261`:
  `tests/ui/dashboard/execution-trace-table.test.tsx` (enlace → ítem del menú; las aserciones de URL
  de R6–R11 **sin editar**), `tests/unit/marca/tablas-marca.test.tsx` (+ «Duración»). Snapshot de
  `recorridos-paridad` regenerado en su propio commit con el control de diff anotado.
  `tests/unit/dashboard-page.test.tsx` en verde **sin editar aserciones**. *Hecho:* todo lo anterior
  verde.

- [ ] **T5. Recorrido** (depende de T3; `design.md > 3.3`). `execution-trace-detail.tsx` con
  `PageShell`, `ArrowLink`, `PageHeader`, los tres datos y `ExecutionTimeline`; error con `ArrowLink`;
  barrel. Tests en `tests/ui/dashboard/recorrido-rediseno.test.tsx` (R10, R11, R12, R17). Ajuste con
  nota `ENMIENDA QC-261` de `tests/ui/dashboard/execution-trace-detail.test.tsx` (marca de vuelta
  atrás, «Motivo · »); sus casos de R12, R17, R18 y R20 de QC-167 **sin editar**. *Hecho:* tests
  verdes; `page.tsx` del detalle sin cambios.

- [ ] **T6. Página no encontrada** (depende de T2; `design.md > 3.4`). `app/(private)/not-found.tsx`
  con `EmptyState` extendido. Tests en `tests/unit/navegacion/no-encontrada-rediseno.test.tsx`
  (R19: icono oculto, «404» en Mono, un `h1`, texto, ningún enlace ni botón, ningún `main`).
  `tests/unit/navegacion/private-not-found.test.tsx` en verde **sin editar**. *Hecho:* tests verdes.

## Tanda 4

- [ ] **T7. Textos y límites** (depende de T4, T5, T6). `tests/ui/dashboard/textos-dashboard.test.tsx`
  (R21: la tabla exacta en las tres pantallas). `tests/guards/guard-qc261-limites-de-la-ficha.test.ts`
  (`design.md > 7`): nada bajo `lib/`, `db/`, `middleware.ts` ni `package.json` (R22); sin
  `next/link` en `execution-trace-columns.tsx` (R7); sin `loading.tsx` bajo
  `app/(private)/dashboard/` (R18); fuera de la rama, `skip` ruidoso como `guard-qc260-…`. *Hecho:*
  verde en la rama; el caso sintético de cada regla da rojo.

- [ ] **T8. E2E** (depende de T4, T5, T6).
  - Nuevo `e2e/dashboard-rediseno.spec.ts`, en chromium y webkit, a 390, 820 y 1440 px, con estilo
    computado y sin capturas, sembrando como `e2e/recorrido-ejecucion.spec.ts` (empresa propia,
    pedidos con anotaciones, uno con retroceder): R8 (tarjetas a 390, «Acciones» abre el menú
    centrado, «Ver recorrido» lleva al detalle, el foco vuelve al cerrar), R16 (las anotaciones
    entran escalonadas; con `reducedMotion: 'reduce'` sin desplazamiento), R20 (sin scroll
    horizontal de la página, objetivos ≥ 44 px, buscador a 16 px) en `/dashboard`, el detalle y
    una URL privada que da 404.
  - **Registrar** `dashboard-rediseno.spec.ts` en `E2E_ESPERADOS` de
    `tests/guards/guard-identificador-de-request.test.ts`, con el comentario «Alta el 2026-10-12
    (QC-261) por el MISMO motivo y en el MISMO sitio que las demas: la lista es CERRADA y darse de
    alta en ella es su punto de extension por diseno. El ancla NO se relaja -el archivo se nombra,
    uno a uno-. Lo que ejercita: …» (con lo que ejercita y «No lee ni afirma nada sobre el
    identificador de peticion ni sobre `reference`»). Si la fecha de alta real es otra, se pone la
    del día del commit.
  - Ajuste de `e2e/recorrido-ejecucion.spec.ts` con nota `ENMIENDA QC-261`: abrir el recorrido por
    el menú «Acciones del pedido {n}» → «Ver recorrido» (líneas 435 y 503) y comprobar la vuelta
    atrás por `[data-go-back="true"]` (línea 447). Ninguna otra aserción cambia (R24).
  *Hecho:* `pnpm exec playwright test e2e/dashboard-rediseno.spec.ts e2e/recorrido-ejecucion.spec.ts e2e/permisos.spec.ts`
  verde; `pnpm exec vitest run guard` verde.

- [ ] **T9. Cierre.** Mapa `R<n> -> test` completo en `progress/impl_QC-261.md` (el de
  `design.md > 11`, con el nombre de cada caso); filas del catálogo revisadas; `./init.sh` verde.
  *Hecho:* los tres puntos.

## Archivos esperados

- `app/(private)/dashboard/page.tsx`
- `app/(private)/dashboard/components/index.ts`
- `app/(private)/dashboard/components/execution-trace-columns.tsx`
- `app/(private)/dashboard/components/execution-trace-table.tsx`
- `app/(private)/dashboard/components/execution-trace-list-section.tsx`
- `app/(private)/dashboard/components/execution-trace-format.ts`
- `app/(private)/dashboard/recorrido/[id]/components/index.ts`
- `app/(private)/dashboard/recorrido/[id]/components/execution-trace-detail.tsx`
- `app/(private)/dashboard/recorrido/[id]/components/execution-timeline.tsx`
- `app/(private)/not-found.tsx`
- `components/shared/empty-state.tsx`
- `components/shared/CATALOGO.md`
- `tests/ui/dashboard/dashboard-rediseno.test.tsx`
- `tests/ui/dashboard/recorrido-rediseno.test.tsx`
- `tests/ui/dashboard/textos-dashboard.test.tsx`
- `tests/ui/dashboard/execution-trace-table.test.tsx`
- `tests/ui/dashboard/execution-trace-detail.test.tsx`
- `tests/unit/navegacion/no-encontrada-rediseno.test.tsx`
- `tests/unit/shared-ui/empty-state.test.tsx`
- `tests/unit/marca/tablas-marca.test.tsx`
- `tests/unit/paridad/recorridos-paridad.test.tsx`
- `tests/unit/paridad/__snapshots__/recorridos-paridad.test.tsx.snap`
- `tests/guards/guard-qc261-limites-de-la-ficha.test.ts`
- `tests/guards/guard-identificador-de-request.test.ts`
- `e2e/dashboard-rediseno.spec.ts`
- `e2e/recorrido-ejecucion.spec.ts`
- `progress/impl_QC-261.md`
