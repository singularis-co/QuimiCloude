# QC-261 — Diseño técnico

## Lo que ya existe

**Términos buscados.** Board (`feature_list.json`, todos los estados): `dashboard`, `recorrido`,
`encontrada`, `404`. Specs: `grep -ril` de `recorrido`, `dashboard`, `not-found`, `QC-261`,
`Ver recorrido`, `línea de tiempo`. Grafo (proyecto del worktree): `search_graph` «timeline stat
empty state not found»; `Grep` de los consumidores de `EmptyState`, `actionsColumn(`, `card={` y de
los selectores del dashboard en `tests/` y `e2e/`. `progress/deudas.md` por `dashboard|recorrido`.

**Qué apareció y qué se hace con ello.**

| Hallazgo | Qué es | Decisión |
|---|---|---|
| QC-12 (done) | El dashboard en blanco: un `h1`, ningún landmark, `dashboard-content` | Sus garantías se conservan (R1, C7) |
| QC-167 (done) | Lista de recorridos, filtros en la URL, detalle, 404, duración, tramos, vueltas atrás | Es lo que se rediseña. Comportamiento intacto (C5); solo cambia la presentación |
| QC-75 (done) | `app/(private)/not-found.tsx` sin enlaces ni palabras de permiso | Se rediseña su aspecto; sus reglas quedan (R19, P1) |
| QC-256 (done) | `StatusBadge`, `ORDER_STATUS_TONES`, `PageShell`, `PageHeader`, `ArrowLink`, `RowActionsMenu` centrado, `DataTable` con `card` y `actionsColumn({ menu })`, `Avatar` con `tone`, `avatarTone`. Su § 0 nombra a QC-261 como consumidor de `StatusBadge`, `PageShell`/`PageHeader` y `ArrowLink` (para `execution-trace-detail.tsx`) | Se reutilizan tal cual |
| QC-257 (done) | Shell: barra lateral en modo icono, cabecera, `ScreenEnter` | No se toca; da la entrada de pantalla y la barra de tablet/teléfono |
| QC-260, QC-252 | Rediseño de acceso; componentización de asignación | Sin enmiendas ni deudas que afecten a estas rutas. De QC-260 se copia el patrón de guardia de límites y de E2E con estilo computado |
| Deuda D35 | Tres mapas de estado duplicados | Para el dashboard ya está resuelta: `TRACE_ORDER_STATUS_LABELS` es alias de `ORDER_STATUS_LABELS`. Se usa el mapa compartido directamente |
| `shared/timeline`, `shared/stat` (fichas `RecorridoMovil`) | Nombres del canvas | **No existen** en el repo ni en el catálogo (grafo y `CATALOGO.md`). Ver tabla de abajo |

**Filas de `components/shared/CATALOGO.md` consultadas** y paso de la regla de decisión
(`docs/perfil-agentes.md > Regla de decisión para componentes`):

| Pieza | Paso | Uso aquí |
|---|---|---|
| `PageShell`, `PageHeader` | 1, reutiliza | Contenedor y `h1` de `/dashboard` y del detalle (R1, R10) |
| `DataTable` (`card`, `actionsColumn({ menu })`, `states.error`) | 1, reutiliza | Tabla, tarjetas en teléfono, menú ⋯ y error con reintento (R3, R7, R8, R9) |
| `RowActionsMenu` | 1, reutiliza (vía `actionsColumn`) | «Ver recorrido» como ítem `href`; presentación centrada en tarjeta (R7, R8) |
| `StatusBadge`, `ORDER_STATUS_LABELS`, `ORDER_STATUS_TONES` | 1, reutiliza | Estado, marcas y vueltas atrás (R4–R6) |
| `ResponsibleAvatars` | 1, reutiliza sin cambios | Columna «Personas» con tooltip |
| `Checkbox` | 1, reutiliza sin cambios | «Solo cancelados» |
| `ArrowLink` | 1, reutiliza | «Volver a la lista» (`direction="back"`, `touch`) (R11) |
| `Avatar` (`tone`, `size="sm"`), `avatarTone`, `getInitials`, `EMPTY_MARK` | 1, reutiliza | Persona de cada anotación (R14) |
| `ErrorState` | 1, reutiliza | Error de la lista (con `retry`) y del detalle (R9, R17) |
| `EmptyState` | 2, extiende | Gana `icon` y `heading` opcionales para la página no encontrada (§ 3.1) |
| `ExecutionTimeline` (nueva) | 4, crea en la ruta | Línea de tiempo de anotaciones (§ 3.3). No hay pieza de lista temporal en el catálogo; la usa una sola ruta, así que vive en `app/(private)/dashboard/recorrido/[id]/components/` |
| Tres datos del detalle («stat») | 3, compone en la ruta | `dl` con `StatusBadge`; no es pieza propia (una sola ruta, sin lógica) |
| `TableSkeleton`, `Skeleton` | descartadas | El esqueleto del tablero `Recorrido` exige un límite de carga que rompe el 404 (§ 8, A2) |

**Pase `/design`.** Todos los tableros están aprobados (D14) y versionados:
`docs/diseno/canvas/Dashboard.dc.html`, `docs/diseno/canvas/DashboardTablet.dc.html`,
`docs/diseno/canvas/DashboardMovil.dc.html` (ficha), `docs/diseno/canvas/Recorrido.dc.html`,
`docs/diseno/canvas/RecorridoTablet.dc.html`, `docs/diseno/canvas/RecorridoMovil.dc.html` (ficha,
con animación y librerías de la línea de tiempo), `docs/diseno/canvas/NoEncontrada.dc.html`,
`docs/diseno/canvas/NoEncontradaTablet.dc.html`, `docs/diseno/canvas/NoEncontradaMovil.dc.html`
(ficha), y para las piezas `docs/diseno/canvas/Tabla.dc.html` y `docs/diseno/canvas/Estados.dc.html`.
`ExecutionTimeline` cita `Recorrido.dc.html`; la extensión de `EmptyState` cita
`NoEncontrada.dc.html`. Clases de referencia del tablero: `docs/diseno/canvas/qc.css` (`.tl`, `.ev`,
`.ev-dot`, `.ev-body`, `.k-start`, `.k-back`, `.k-end`, `.k-cancel`, `.stat`, `.g3`, `.box`, `.bi`).

**Grafo.** El MCP respondió; la exploración de tests y e2e se hizo con `Grep`.

## 1. Modelo de datos

Ninguno. Sin tablas, sin RLS, sin migraciones, sin variables de entorno. Sin Server Actions nuevas.

## 2. Rutas

Las mismas, sin rutas nuevas ni archivos de framework nuevos:

- `app/(private)/dashboard/page.tsx` — Server Component, `requirePagePermission` sigue siendo su
  primera línea.
- `app/(private)/dashboard/recorrido/[id]/page.tsx` — igual; `notFound()` con `order_not_found`.
- `app/(private)/not-found.tsx` — sin props, dentro del layout privado.

**No se añade `loading.tsx`** en ninguna de las dos rutas del dashboard (R18, § 8 riesgo 1).

## 3. Contratos de las piezas

### 3.1 `EmptyState` — `icon` y `heading` opcionales (paso 2)

```ts
export type EmptyStateProps = {
  // … las de hoy, sin cambios
  /** Recuadro con icono antes del texto; oculto a lectores. `lg` = 64 px (página), si no 44 px. */
  readonly icon?: { readonly node: ReactNode; readonly size?: 'default' | 'lg' };
  /** Encabezado antes del mensaje; `eyebrow` es una etiqueta corta encima (p. ej. «404»). */
  readonly heading?: { readonly text: ReactNode; readonly level: 1 | 2; readonly eyebrow?: ReactNode };
};
```

- Sin las dos props, el árbol es idéntico al de hoy (los tres consumidores no cambian:
  `assignment-list-parts.tsx`, `supplier-showcase-section.tsx`, `order-list-empty.tsx`, y
  `DataTable`).
- El recuadro sigue `.box .bi` del tablero (radio 12/16 px, `--muted` / `--muted-foreground`).
- Fila del catálogo: `icon` y `heading` a `Puntos de extensión`; `Diseño` pasa de `previo al
  rediseño` a `docs/diseno/canvas/NoEncontrada.dc.html`.

### 3.2 Dashboard — `app/(private)/dashboard/`

- `page.tsx`: `<PageShell>` con `<PageHeader title="Dashboard" titleTestId="dashboard-title" />` y
  `<DashboardContent>`. Sigue sin consultas propias.
- `dashboard-content.tsx`: sin cambios de estructura (`div` plano, `Suspense`).
- `execution-trace-list-section.tsx`: el contenedor sigue siendo `div` (no `section`: sería un
  landmark con nombre, C7) con el `h2` «Recorridos de ejecución».
- `execution-trace-columns.tsx`:
  - «Nº de pedido»: número + `DeletedOrderMark` / `ActiveOrderMark`, que pasan a ser `StatusBadge`
    (`muted` / `progress`) conservando sus `data-testid` (R6).
  - «Estado»: `StatusBadge` con `ORDER_STATUS_TONES` y `data-testid` / `data-status` (R4).
  - «Primera anotación», «Última anotación», «Duración»: `tabular: true`, `align: 'end'` (R3).
  - «Vueltas atrás»: `align: 'end'`; `StatusBadge tone="waiting"` con la cifra si > 0, `0`
    atenuado si no (R5).
  - La columna `trace` con `Link` desaparece; entra `actionsColumn({ menu })` con
    `{ triggerLabel: 'Acciones del pedido ' + numberText, title: <>Pedido <span mono>{n}</span></>,
    triggerTestId: 'execution-trace-actions', items: [{ label: TRACE_LINK_TEXT, icon: Route, href:
    executionTraceDetailHref(row.orderId, params), testId: 'execution-trace-link' }] }` (R7).
- `execution-trace-table.tsx`: pasa `card={{ primary: TRACE_NUMBER_COLUMN_ID, status:
  TRACE_STATUS_COLUMN_ID, meta: [TRACE_FIRST_AT_COLUMN_ID, TRACE_DURATION_COLUMN_ID,
  TRACE_GO_BACK_COLUMN_ID], footer: PERSON_COLUMN_ID }}` (los ids que ya exportan
  `execution-trace-columns.tsx` y `execution-trace-list-params.ts`) (R8) y en `buildStates` añade
  `retry: { kind: 'refresh' }`, `retryTestId: 'execution-trace-retry'` (R9, P6). La casilla y el
  estado de transición no cambian.
- `execution-trace-format.ts`: `TRACE_ORDER_STATUS_LABELS` puede quedarse como alias (lo importan
  tests y el e2e); no se añaden formatos.

### 3.3 Recorrido — `app/(private)/dashboard/recorrido/[id]/components/`

- `execution-trace-detail.tsx`:
  - `ExecutionTraceDetail`: `<PageShell>` → `<ArrowLink direction="back" touch href={backHref}
    testId="execution-trace-back">Volver a la lista</ArrowLink>` → `<PageHeader title={<>Recorrido
    del pedido <span className="font-mono">{numberText}</span></>}
    titleTestId="execution-trace-title" />` → `dl` de tres datos (R12; `grid-cols-3`,
    `@max-[760px]:grid-cols-1`, cada uno como `.stat` del tablero) → `<ExecutionTimeline steps=… />`.
  - `ExecutionTraceDetailError`: `ArrowLink` + `h1` «Recorrido» + `ErrorState` de hoy (R17).
  - `BackLink`, `BACK_LINK_CLASS` y el subrayado desaparecen. `BACK_TO_LIST_TEXT` y
    `MISSING_PERSON_MARK` se conservan (los importan tests y la guardia de piezas base).
- `execution-timeline.tsx` (nueva, `ExecutionTimeline`, Server Component):

```ts
export type ExecutionTimelineProps = {
  readonly steps: readonly ExecutionTraceDetailStep[];
};
```

  Pinta (R13–R16):

```
<div card>                                   ← sin section/region
  <h2 id=…>Anotaciones</h2><span count>{n}</span>
  <ol aria-labelledby=…  class="tl">          ← nombre accesible «Anotaciones»
    <li data-testid="execution-trace-step" data-action data-go-back style="animation-delay: i*40ms">
      <span ev-dot aria-hidden><Icon/></span>
      <div ev-body>
        acción (strong) · <time dateTime>{formatTraceInstant}</time>
        Paso {n} · <Avatar size="sm" tone={avatarTone(userId)}>{getInitials(name)}</Avatar> {name | «—»}
        Motivo · {reason}                     ← solo cancel con motivo
        Hasta la siguiente: {formatElapsed}   ← salvo la última
        <span class="sr-only">Vuelta atrás</span> ← solo go_back
```

  Mapa acción → tono / icono (`lucide-react`, ya en el repo), en un `Record<ExecutionAction, …>`
  exhaustivo dentro del archivo:

  | Acción | Tono | Icono |
  |---|---|---|
  | `start`, `resume` | `progress` | `Play` |
  | `pack_start` | `progress` | `Package` |
  | `advance` | neutro | `ArrowRight` |
  | `go_back` | `waiting` (punto y tarjeta) | `RotateCcw` |
  | `finish` | `success` | `CircleCheck` |
  | `pack_finish` | `success` | `Package` |
  | `cancel` | `danger` | `Ban` |

  Los colores salen de los tokens `--status-<tono>-subtle|text|dot` de `app/globals.css`; no se
  declara ningún token nuevo.
- `index.ts`: exporta lo de hoy; `ExecutionTimeline` es interno (lo usa solo el detalle).

### 3.4 No encontrada — `app/(private)/not-found.tsx`

```tsx
<EmptyState
  testId="private-not-found"
  icon={{ node: <Search />, size: 'lg' }}
  heading={{ level: 1, eyebrow: '404', text: 'No encontramos esta página' }}
  message="Revisa la dirección e inténtalo de nuevo, o continúa desde el menú lateral."
  className="… flex-1 min-h-[460px] (tablero) …"
/>
```

Sin `children`, sin `clearSearch` ni `firstPage`: ningún enlace (R19, P1). La etiqueta «404» va en
Plex Mono; el `h1` a 26 px como el tablero.

## 4. CSS

Por defecto, **sin cambios en `app/globals.css`**: la entrada de cada anotación reutiliza
`@keyframes screen-enter` con `--dur-slow` y `--ease-enter` (valores arbitrarios de Tailwind) y el
retardo en línea; el bloque global de movimiento reducido ya anula animación y retardo (R16). El
realce va con la variante `hover:` de Tailwind 4, que solo aplica con `@media (hover: hover)`.
Si `tests/guards/guard-movimiento.test.ts` no admite la animación en línea, se declara en
`app/globals.css` un bloque `[data-timeline-step]` junto a `screen-enter`, sin `infinite`.

## 5. Textos

Los de R21. Nuevos: «Acciones del pedido {n}», «Pedido {n}», «Reintentar» (por defecto de
`ErrorState`), «Motivo · », «404». El resto ya existe con tildes; la guardia de textos de R21 lo
comprueba.

## 6. Tests afectados (barrido del spec, 2026-10-12)

| Archivo | Qué cambia |
|---|---|
| `tests/ui/dashboard/execution-trace-table.test.tsx` | R2 «enlace» → menú; R12 del enlace se comprueba en el ítem del menú; R26 «el enlace mide 44x44» → el disparador del menú |
| `tests/ui/dashboard/execution-trace-detail.test.tsx` | R16 «se marca con el texto «Vuelta atrás»» → `data-go-back` + texto `sr-only`; «Motivo:» → «Motivo · »; «Volver» sigue 44×44 |
| `tests/unit/dashboard-page.test.tsx` | Sin cambio de aserciones esperado (un `h1`, sin landmarks, `dashboard-content`); se comprueba |
| `tests/unit/navegacion/private-not-found.test.tsx` | Sin cambio de aserciones esperado (testid, mensaje, sin palabras, sin enlace) |
| `tests/unit/paridad/recorridos-paridad.test.tsx` + `.snap` | Snapshot regenerado en su commit, con control de diff (estado, columnas, error con reintento) |
| `tests/unit/marca/tablas-marca.test.tsx` | Lista cerrada de `execution-trace-columns.tsx`: + «Duración» (`ENMIENDA QC-261`) |
| `tests/unit/shared-ui/empty-state.test.tsx` | Casos nuevos de `icon` y `heading`; los de hoy, intactos |
| `tests/guards/guard-piezas-base.test.ts` | Sin cambio esperado (`MISSING_PERSON_MARK` se conserva); se comprueba |
| `tests/guards/guard-identificador-de-request.test.ts` | Alta de `e2e/dashboard-rediseno.spec.ts` en `E2E_ESPERADOS` |
| `e2e/recorrido-ejecucion.spec.ts` | Líneas 435 y 503: abrir «Acciones del pedido {n}» y pulsar el ítem «Ver recorrido» (`traceLinkName` deja de usarse); línea 447: `[data-go-back="true"]` en vez de `getByText(GO_BACK_MARK)` visible. Nada más (R24) |
| E2E con `private-not-found` (`acondicionamiento`, `clientes`, `entregar-producto-terminado`, `integraciones`, `permisos`, `pedidos`, `inventario`, `login`, `recetas`, `proveedores`, `presentaciones`, `unidades`, `usuarios`) | Sin cambios: el `data-testid` se conserva |

## 7. Alcance verificable

Guardia `tests/guards/guard-qc261-limites-de-la-ficha.test.ts`, como la de QC-260: diff contra el
merge-base con `origin/dev` sin archivos bajo `lib/`, `db/`, `middleware.ts` ni cambios en
`package.json` (R22); ninguna celda de `execution-trace-columns.tsx` importa `next/link` (R7);
`app/(private)/dashboard/**` sin `loading.tsx` (R18). Fuera de la rama
`feature/QC-261-rediseno-dashboard`, `skip` ruidoso.

## 8. Riesgos

1. **El esqueleto del tablero rompe el 404.** `Recorrido.dc.html` simula 700 ms de esqueleto. Un
   `loading.tsx` haría empezar el streaming antes de `requirePagePermission` y de `notFound()`, y la
   respuesta saldría con 200; `e2e/recorrido-ejecucion.spec.ts` exige 404 (R29, R18 de QC-167).
   Además `guard-piezas-base` (regla 4) prohíbe esqueletos locales de lista. No se pinta esqueleto
   (R18); el `Suspense` de hoy de la lista se queda.
2. **Tarjetas en tablet** (P5): con la barra en modo icono, la lista de 820 px se pinta en tarjetas.
   Lo dice la pregunta; no se toca `DataTable`.
3. **`DataTable` con `card` duplica celdas en el DOM.** Los tests y el E2E nuevo acotan al cuerpo
   visible (lo avisa la fila del catálogo). El E2E de QC-167 localiza filas por
   `data-table-row-<id>`; T1 comprueba con qué ancho de ventana corre y si ese testid es solo de la
   tabla, y acota sus localizadores si hace falta (sin tocar aserciones, R24).
4. **Archivos calientes.** `components/shared/CATALOGO.md` y `components/shared/empty-state.tsx`
   pueden estar en otra ficha en vuelo (QC-265 usa `EmptyState`); lo detecta
   `scripts/archivos-en-vuelo.mjs` por `tasks.md`.

## 9. Alternativas descartadas

- **A1. Componer la página no encontrada a mano en la ruta** (`not-found.tsx` con su propio
  marcado). Ahorra tocar `EmptyState`, pero la ficha del tablero nombra `shared/empty-state` y el
  recuadro con icono es el mismo `.box` de los vacíos; dos marcados del mismo vacío divergen.
  Extender con props opcionales no cambia a nadie.
- **A2. `loading.tsx` con `Skeleton` para el recorrido**, como el tablero. Rompe el código 404
  (§ 8, riesgo 1) y la regla 4 de `guard-piezas-base`.
- **A3. `ExecutionTimeline` en `components/shared/`.** Solo la usa una ruta y nadie más tiene
  anotaciones; subirla antes sería una excepción sin consumidores identificados
  (`docs/architecture.md > Regla: sin sobre-ingenieria`).
- **A4. `section aria-labelledby` para «Recorridos de ejecución» y «Anotaciones»**, como el
  tablero. Crea landmarks `region` y rompe la garantía de QC-12/QC-167 R25 (C7).
- **A5. Cambiar el umbral de tarjetas de `DataTable` a 640 px** para que la tablet vea la tabla.
  Cambia todas las tablas de la app; va en ficha propia si el humano lo pide (P5).
- **A6. Mantener el enlace «Ver recorrido» en la celda además del menú.** Menos cambio en el E2E,
  pero D2 lo prohíbe expresamente.

## 10. Enmiendas a specs cerrados

| Spec | Qué cambia | Por qué |
|---|---|---|
| QC-167 R2 | «un enlace a su recorrido» pasa a ser el ítem «Ver recorrido» del menú de la fila | D2 — R7 |
| QC-167 R16 | La marca visual de cada retroceder es el tono ámbar, su icono y «Retroceder»; «Vuelta atrás» queda para lectores de pantalla | Tablero `Recorrido` — R15, P4 |
| QC-167 R26 | El control táctil de la fila es el disparador del menú (44 × 44) | R7 |
| QC-167 (texto del motivo) | «Motivo: {m}» → «Motivo · {m}» | Tablero `Recorrido` — R14 |
| QC-227 (`tablas-marca`) | `execution-trace-columns.tsx` lleva en Mono también «Duración» | Tablero `Dashboard` — R3 |
| QC-75 (404 privado) | Aspecto del tablero; sus reglas (sin enlaces, sin palabras de permiso, testid) no cambian | Tablero `NoEncontrada` — R19 |

## 11. Trazabilidad prevista

| R | Test |
|---|---|
| R1, R3, R4, R5, R6, R7, R9 | `tests/ui/dashboard/dashboard-rediseno.test.tsx`, `tests/unit/dashboard-page.test.tsx` |
| R2 | `tests/ui/dashboard/execution-trace-table.test.tsx` (aserciones de URL sin editar) |
| R8 | `tests/ui/dashboard/dashboard-rediseno.test.tsx` (layout `card`, menú centrado, foco) y `e2e/dashboard-rediseno.spec.ts` (390 px) |
| R10–R15, R17 | `tests/ui/dashboard/recorrido-rediseno.test.tsx`, `tests/ui/dashboard/execution-trace-detail.test.tsx` |
| R16 | `tests/ui/dashboard/recorrido-rediseno.test.tsx` (retardos) y `e2e/dashboard-rediseno.spec.ts` (movimiento reducido, estilo computado) |
| R18 | `e2e/recorrido-ejecucion.spec.ts` (404 sin cambios) y `tests/guards/guard-qc261-limites-de-la-ficha.test.ts` (sin `loading.tsx`) |
| R19 | `tests/unit/navegacion/no-encontrada-rediseno.test.tsx`, `tests/unit/navegacion/private-not-found.test.tsx`, `tests/unit/shared-ui/empty-state.test.tsx` |
| R20 | `e2e/dashboard-rediseno.spec.ts` (chromium y webkit; 390, 820, 1440) |
| R21 | `tests/ui/dashboard/textos-dashboard.test.tsx` |
| R22 | `tests/guards/guard-qc261-limites-de-la-ficha.test.ts` |
| R23 | `tests/guards/guard-catalogo-de-componentes.test.ts`, `tests/guards/guard-qc261-limites-de-la-ficha.test.ts` |
| R24 | `e2e/recorrido-ejecucion.spec.ts` |

## 12. Multiplataforma

Sin excepciones. Objetivos de 44 px (disparador ⋯, «Acciones», `ArrowLink touch`, casilla con
`touchTarget`), ítems del menú centrado de 48 px, buscador a 16 px (ya en `DataTable`), realce solo
con `hover: hover`, tooltip de avatar con su nombre también como nombre accesible, ninguna
`100vh`. Se verifica en webkit (`playwright.config.ts`).

## 13. Dependencias

Ninguna nueva. `lucide-react`, `@base-ui/react` y `@tanstack/react-table` ya están; las fichas de
los tableros lo confirman («ninguna nueva»).
