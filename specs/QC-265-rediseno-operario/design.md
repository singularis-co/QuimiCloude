# QC-265 — rediseno-operario · design.md

## Lo que ya existe

**Términos buscados.** En el board (`feature_list.json`, todos los estados): «operario»,
«asignación», «empaque», «acondicion», «toast», «texto», «tilde», «barra lateral». En `specs/` y
`progress/`: `QC-265`, `Acondicionados`, `CountdownGatedButton`, `Notice`, `op-hd`, «sin barra
lateral», `packingSteps`, «5 s». En el código (grafo `codebase-memory-mcp` del worktree, que
respondió, y Grep): `AssignmentViewTabs`, `ASSIGNMENT_VIEW_LABELS`, `UrlTabs`, `OrderOutcomeNotice`,
`AssignedOrderDeliveredNotice`, `PackingOrderScreen`, `ConditioningOrderScreen`,
`OrderExecutionScreen`, `StepReader`, `WaitRing`, `CountdownGatedButton`, `ThemeToggle`, layouts de
`app/`.

| Qué apareció | Dónde | Qué se hace |
| --- | --- | --- |
| QC-252 (`done`) deja a esta ficha `Notice` en los avisos, el anillo del botón con espera y D51 | `specs/QC-252-componentizacion-asignacion/requirements.md > P4, P5, P6`, `progress/deudas.md > D51` | Se hacen aquí (R13–R15, R37, R38, R42, R43) |
| QC-256 (`done`) dejó `UrlTabs` (con contador), `Notice`, `StatusBadge`, `PriorityMark`, `ArrowLink`, `PageHeader`, `PageShell`, `RowActionsMenu` centrado y `DataTable` con `card`; y dejó a «la ficha de la pantalla» `.op-hd`, `.op-ft`, `.op-t`, `.seg`, `.num-dot`, `.lbox`, `.g2` | `specs/QC-256-piezas-compartidas-rediseno/requirements.md > Lo que NO entra` | Se reutilizan las piezas; las clases de operario se escriben aquí con utilidades de Tailwind (D3) |
| QC-257 (`done`) es el shell: cabecera, menú, `ThemeToggle` | `app/(private)/layout.tsx`, `app/(private)/components/theme-toggle.tsx` | El layout no cambia de forma; solo gana el atributo que permite ocultarlo (D2). `ThemeToggle` se reutiliza en la cabecera del operario |
| `StepReader` en modo `ejecucion` ya tiene progreso segmentado, anillo de espera (`WaitRing`, interno) y botones fijos abajo | `components/shared/step-reader/step-reader.tsx` | Se reutiliza; el anillo sale a una pieza compartida (D6) |
| QC-211 D6/D7: pasos de envasado con el paso a paso tras Comenzar | `specs/QC-211-pasos-de-envasado/requirements.md` | Se conserva (R30, P4) |
| QC-218 D6: espera de 5 s en el botón de los modales de acondicionamiento; equipo elegido en el modal | `specs/QC-218-acondicionar-con-equipo/requirements.md` | Se conserva (R35, R36, P2, P3) |
| El recorrido de un pedido vive en `/dashboard/recorrido/<id>` y exige `dashboard.consultar` | `lib/shared/routes.ts > executionTraceRoute`, `app/(private)/dashboard/recorrido/[id]/page.tsx` | «Ver recorrido» enlaza ahí con el permiso (R20, P9) |
| Las listas de `asignaciones` devuelven `Page<T>` con `total` | `lib/modules/asignaciones/domain/list-*.ts` | El contador lee `total` con `pageSize: 1` sin caso de uso nuevo (D5, P16) |
| QC-261 (`pending`, mismo dueño) rediseña Dashboard y Recorrido | `feature_list.json` | No se toca su ruta |
| QC-253 y QC-200 (`pending`) tocan el acondicionamiento y la cancelación | `feature_list.json` | Nada se adelanta; riesgo de choque anotado en § 9 |

**Filas de `components/shared/CATALOGO.md` consultadas y paso de la regla de decisión**
(`docs/perfil-agentes.md > Regla de decisión para componentes`):

| Pieza | Filas consultadas | Paso | Por qué no bastaba el anterior | Tablero |
| --- | --- | --- | --- | --- |
| Pestañas con contador | `UrlTabs`, `Tabs` | 1 · reutiliza | — | `Superficies.dc.html`, `Asignacion.dc.html` |
| Avisos de `/asignacion` | `Notice`, `Alert` | 2 · extiende `Notice` con cierre opcional | `Notice` «no cubre: cerrar el aviso» (P7) | `Asignacion.dc.html` (X de cierre), `Avisos.dc.html` |
| Estado y prioridad | `StatusBadge`, `PriorityMark`, `ORDER_STATUS_TONES`, `ORDER_PRIORITY_LEVELS` | 1 · reutiliza | — | `Estados.dc.html` |
| Menú de fila y tarjetas | `RowActionsMenu`, `DataTable` (`card`, `actionsColumn`) | 1 · reutiliza | — | `Tabla.dc.html`, `Asignacion.dc.html` |
| Título de `/asignacion` | `PageHeader`, `PageShell` | 1 · reutiliza | — | `Superficies.dc.html` |
| Volver… | `ArrowLink` | 1 · reutiliza | — | `Botones.dc.html` |
| Diálogos | `ConfirmDialog`, `AlertDialog`, `Dialog` | 1 · reutiliza | — | `ModalesOperario.dc.html` |
| Toast de datos de lote | `Toaster` (+ `toast` de `sonner`) | 1 · reutiliza | — | `Avisos.dc.html` |
| Anillo de espera (`CountdownRing`) | `CountdownTimer`, `CountdownGatedButton`, `StepReader` | sube (pieza existente) | No es nueva: es el `WaitRing` interno de `StepReader`, que necesita un segundo consumidor (`CountdownGatedButton`) | `Dominio.dc.html` |
| `CountdownGatedButton` con anillo | `CountdownGatedButton` | 2 · extiende (compone `CountdownRing`) | Su `Alcance` dice que el anillo «todavía no está» | `Dominio.dc.html`, `Acondicionamiento.dc.html` |
| Marco del operario (`OperatorScreenFrame`) | `PageShell`, `PageHeader`, `ArrowLink`, `Button` | 4 · crea en la ruta | `PageShell`/`PageHeader` son de página con barra lateral, sin cabecera ni pie fijos | `Ejecucion.dc.html`, `Empaque.dc.html`, `Acondicionamiento.dc.html` (`.op-hd`, `.op-ft`) |
| Panel «Herramientas» plegable | `Collapsible`, `Card` | 3 · compone en la ruta | Ninguna fila es un panel plegable con título y contador | `Ejecucion.dc.html` |

El marco del operario lo usan tres páginas de la misma ruta (`/asignacion/**`): se crea en
`app/(private)/asignacion/components/` y no sube a `components/shared` (regla de la segunda ruta).

## 1. Principio

Es un **cambio visual** con tablero aprobado: los snapshots de paridad de `/asignacion` (QC-231,
QC-232, QC-252) **sí cambian**, y cada cambio está enumerado en § 6. Lo que no cambia es el
comportamiento: mismas acciones, mismos campos enviados, mismos permisos, mismas esperas
(R45). Los E2E que cambian una aserción lo hacen porque cambió lo que ve la persona, y § 7 lo dice
por archivo.

## 2. Modelo de datos

No aplica: sin tablas, sin RLS, sin migraciones, sin cambios en `lib/modules/`. Ningún contrato de
módulo cambia; los contadores usan los casos de uso de lista que ya existen (D5).

## 3. Rutas

Ninguna ruta nueva ni distinta. Las tres pantallas del operario siguen en
`app/(private)/asignacion/[id]/`, `empaque/[id]/` y `acondicionamiento/[id]/`; las direcciones
salen de `assignedOrderRoute`, `packingOrderRoute` y `conditioningOrderRoute`. «Entrar» del menú
usa `packingOrderRoute` / `conditioningOrderRoute`; «Ver recorrido», `executionTraceRoute`.

## 4. Decisiones

**D1 — Renombrado (R7, R8).** `ASSIGNMENT_VIEW_LABELS.acondicionados = 'Acondicionados'` y
`CONDITIONING_ORDER_SCREEN_TEXTS.backToFinished` pasa a `backToConditioned: 'Volver a
«Acondicionados»'`. Las claves de vista (`acondicionados`), los `data-testid` y las direcciones no
cambian. Los textos de la tabla siguen hablando de «terminados» (P12).

**D2 — Sin barra lateral (R1, R5, R6; P1).** El layout privado es el único que lee la sesión
(`app/(private)/layout.tsx`, R16 de QC-11) y no sabe qué página pinta. Se resuelve con CSS:

- `OperatorScreenFrame` pinta su raíz con `data-operator-screen`.
- `app/globals.css` gana una regla: `body:has([data-operator-screen])` oculta (`display: none`) la
  barra lateral (`[data-slot="sidebar"]`, que incluye su hueco) y la cabecera privada
  (`[data-testid="private-header"]`). Con `display: none` salen también del árbol accesible y del
  orden de tabulación.
- El 404 no pinta el marco: conserva barra y cabecera (R5) sin tocar `not-found.tsx`.
- Navegador sin `:has()`: la barra se ve, como hoy. Playwright cubre Chromium y WebKit.

Lo que la tanda 0 comprueba antes de escribir la regla: que `[data-slot="sidebar"]` es el envoltorio
que lleva el hueco (`sidebar-gap`) y que, oculto, `SidebarInset` empieza en x = 0; si no, el selector
se ajusta al envoltorio real (`components/ui/sidebar.tsx` no se edita).

**D3 — Marco del operario (R2–R4).** `app/(private)/asignacion/components/operator-screen-frame.tsx`,
sin `'use client'` (no usa estado; recibe nodos ya pintados):

```ts
export type OperatorScreenFrameProps = {
  readonly back?: { readonly href: string; readonly label: string; readonly testId: string };
  readonly eyebrow: string;            // número del pedido, en mono
  readonly title: string;              // receta: el único h1
  readonly subtitle?: ReactNode;       // «Pedido … · Presentación: …», «N × envase»
  readonly status?: ReactNode;         // StatusBadge
  readonly headerActions?: ReactNode;  // menú ⋯ de la ejecución
  readonly footer?: ReactNode;         // acciones del pie
  readonly testId: string;             // el data-testid de la pantalla de hoy
  readonly children: ReactNode;
};
```

- Cabecera `sticky top-0` con fondo de tarjeta y borde inferior; contenido centrado a 1064 px.
- Pie `fixed inset-x-0 bottom-0` con relleno `calc(14px + env(safe-area-inset-bottom))`; el cuerpo
  reserva su alto para que nada quede debajo.
- «Cambiar tema»: el `ThemeToggle` de `app/(private)/components` con forma `outline` de 44 px; si no
  acepta `className`, gana esa prop opcional (no está en el catálogo: vive en la ruta del layout).
- Contenedor de consultas para la regla de dos columnas a 1100 px (R4).
- `back` se pinta con `ArrowLink direction="back" touch`.
- Los botones del pie son `Button size="xl"` (52 px, D7).
- Las pantallas de cliente (`PackingOrderScreen`, `OrderExecutionScreen`, `ConditioningActions`) lo
  importan por su archivo y **no** por el barrel de `asignacion/components`, que arrastra secciones
  de servidor (lección M1 de QC-252, `specs/QC-252-componentizacion-asignacion/design.md > 3`).

**D4 — Pestañas con `UrlTabs` (R9, R12).** `AssignmentViewTabs` pasa a componer `UrlTabs` con
`label="Vistas de asignación"`, `testId="assignment-view-tabs"` y por vista
`{ value, href: assignmentViewHref(view), label, count, testId }`. Conserva sus exports
(`ASSIGNMENT_VIEW_TABS_TESTID`, `ASSIGNMENT_VIEW_TAB_TESTIDS`, `ASSIGNMENT_VIEW_LABELS`) y gana la
prop opcional `counts?: Partial<Record<AssignmentViewKind, number>>`.

**D5 — Contadores (R9–R11; P16).** Sección de servidor nueva
`app/(private)/asignacion/components/assignment-view-tabs-section.tsx`:

- arma el actor como las demás secciones de lista;
- por cada vista permitida llama, en paralelo, a su caso de uso de lista con `{ page: 1, pageSize: 1 }`
  y sin filtros, y toma `total` (`asignados` → `listAssignedOrders`, `terminados` →
  `listFinishedOrders`, `todos` → `listCompanyOrders`, `por_empacar` → `listPackingOrders`,
  `por_acondicionar` → `listConditioningOrders`, `acondicionados` → `listConditionedOrders`,
  `acondicionados_entregados` → `listDeliveredConditionedOrders`);
- una vista cuyo caso de uso lanza queda sin contador (`Promise.allSettled`); el error no sube.
- `page.tsx` la monta en un `Suspense` cuyo `fallback` es `AssignmentViewTabs` sin contadores: la
  lista vigente no espera a los contadores (R11).

La función pura `toViewCounts(views, results)` vive aparte
(`app/(private)/asignacion/components/assignment-view-counts.ts`) para probarla sin servidor.

Coste: hasta cuatro lecturas de una fila por carga de `/asignacion` (la persona con más vistas).
Si se mide lento, el siguiente paso es un caso de uso de conteo en el módulo (A3).

**D6 — `CountdownRing` (R37, R38).** Sube a `components/shared/countdown-ring.tsx` el `WaitRing` de
`step-reader.tsx`, con la misma técnica (transición CSS lineal de `stroke-dashoffset` que arranca un
fotograma después de montar):

```ts
export const COUNTDOWN_RING_TESTID = 'countdown-ring';
export type CountdownRingProps = {
  readonly seconds: number;
  readonly size?: number;      // px; 40 por defecto (el de hoy en StepReader)
  readonly testId?: string;    // StepReader pasa 'step-reader-wait-ring'
  readonly className?: string;
};
```

Siempre `aria-hidden="true"`. `step-reader.tsx` lo importa y borra `WaitRing` (la lista cerrada R18 de
`order-execution-screen.test.tsx` permite tocar ese archivo). `CountdownGatedButton` lo pinta
delante de la cuenta mientras espera, con `size` 20 y `key` igual a la del `CountdownTimer`.
Con `prefers-reduced-motion` el anillo no anima (se queda lleno) y la cuenta sigue: la cuenta es la
información, el anillo es decoración.

**D7 — `Notice` con cierre (R15; P7).** Prop opcional nueva:

```ts
readonly dismissible?: { readonly label: string; readonly testId?: string };
```

Sin ella, el árbol es el de hoy (sus consumidores no cambian). Con ella, `Notice` pinta un botón
`ghost` de 44 × 44 px con icono X y `aria-label={label}`; al pulsarlo deja de pintarse (estado local).
`Notice` pasa a componente de cliente; se sigue pudiendo usar desde servidor con props serializables.
Fila del catálogo: punto de extensión y `Diseño` con `Asignacion.dc.html` añadido.

**D8 — Una pieza de aviso (R13, R14; D51).** `OrderOutcomeNotice` gana dos tipos y compone `Notice`:

| `kind` | Tono | `data-testid` | Texto |
| --- | --- | --- | --- |
| `delivered` | `warning` | `assigned-order-delivered-notice` | `assignedOrderDeliveredNoticeText` / `…WithPackagesText` |
| `cancelled` | `info` | `assigned-order-cancelled-notice` | `assignedOrderCancelledNoticeText` |
| `packed` | `success` | `packed-order-notice` | `packedOrderNoticeText` |
| `conditioned` | `success` | `conditioned-order-notice` | `conditionedOrderNoticeText` |

`delivered` acepta `packages` y `productName` opcionales. Las funciones de texto y las constantes
de `data-testid` se mueven a `order-outcome-notice.tsx` y siguen saliendo del barrel con su nombre.
Se borran `assigned-order-delivered-notice.tsx` y `assigned-order-cancelled-notice.tsx`.

**D9 — Filas (R16–R21).**

- Estado: `StatusBadge` con `tone={ORDER_STATUS_TONES[status]}` y `label={ORDER_STATUS_LABELS[status]}`;
  `data-testid` y `data-status` pasan al `StatusBadge` (acepta `data-*`).
- Prioridad: `PriorityMark` con `level={ORDER_PRIORITY_LEVELS[priority]}`.
- Menú ⋯: `actionsColumn({ menu })` de `DataTable`. Ítems por vista:

| Vista | Visible en la fila | Menú ⋯ |
| --- | --- | --- |
| Mis asignados | «Entrar» (`AssignedOrderEnterTrigger`, hoy) | «Ver recorrido»\* |
| Terminados, Todos | — | «Ver recorrido»\* |
| Por empacar | — | «Entrar» → `packingOrderRoute`, «Ver recorrido»\* |
| Por acondicionar, Acondicionados, Entregados | — | «Entrar» → `conditioningOrderRoute`, «Ver recorrido»\* |

  \* Solo con `dashboard.consultar`: `page.tsx` lo decide en servidor con la misma lectura de sesión
  (`hasPermission` del dominio, como `resolveAssignmentViews`) y lo baja como `canViewTrace` a cada
  sección. Testids nuevos: `assignment-row-enter`, `assignment-row-trace`.
- El número deja de ser enlace: se borran `ConditioningOrderLink` y el `Link` de
  `packing-orders-columns.tsx` (`conditioning-order-link`, `packing-order-link` dejan de existir).
- Tarjetas: cada tabla pasa `card` a `DataTable` (`primary` = número, `status` = estado, `title` =
  receta, `meta` = cantidad / presentación / envases según la vista, `footer` = «Entrar» si la fila
  lo tiene). `RowActionsMenu` usa la presentación centrada en tarjetas (lo hace `DataTable`).
- Decisión del leader (2026-10-12): el menú ⋯ vive en un componente de cliente
  `app/(private)/asignacion/components/assignment-row-actions.tsx`, porque el icono no cruza de servidor a cliente.
- Decisión del leader (2026-10-12): «Por empacar» pasa a `DataTable` con un `packing-orders-table.tsx` nuevo, como las otras cinco tablas.
- Decisión del leader (2026-10-12): `e2e/envases-del-pedido.spec.ts` y `e2e/pedido-en-varias-presentaciones.spec.ts` se migran al `h1` nuevo (R23).

**D10 — Ejecución (R23–R26).** `OrderExecutionScreen` compone `OperatorScreenFrame`:

- `headerActions`: `RowActionsMenu` con `title` «Acciones del pedido <número>» y un ítem destructivo
  «Cancelar pedido» que abre `OrderCancelDialog` en modo controlado. `OrderCancelDialog` gana
  `open`/`onOpenChange` opcionales y deja de pintar su disparador cuando los recibe (sus tests de hoy
  siguen valiendo sin ellos).
- Panel `OrderExecutionToolsPanel` (ruta, compone `Card` + `Collapsible`): disparador «Herramientas»
  con el número de herramientas (`mono`), abierto por defecto, dentro `OrderExecutionTools` y, tras
  un separador, «Materiales» con `OrderExecutionLines`. Los `data-testid` de hoy se conservan.
- `StepReader` en modo `ejecucion`: sus botones pasan de `min-h-16` a `Button size="xl"`, «Anterior»
  ocupa 1/3 y la acción principal 2/3, el motivo del bloqueo va encima de los botones y la barra de
  acciones se ancla al pie de la pantalla (`fixed`, con el margen seguro). Solo cambia
  `step-reader.tsx`. El modo `lectura` no cambia.

**D11 — Empaque (R27–R31).** `PackingOrderScreen` compone `OperatorScreenFrame`:

- `back` = «Volver a «Por empacar»» → `backHref` de hoy; `status` = `StatusBadge`.
- Columna izquierda: tarjeta con «Cantidad:» y «Reparto» (lista de hoy, cada `<li>` con su
  `data-testid`) y «Envases: N». Columna derecha: el paso a paso cuando toca (R30).
- Pie: cuando hay paso a paso (R30), el pie es el de `StepReader`; si no, dos `Button size="xl"`,
  «Comenzar» y «Terminar», con el `variant` `default` el habilitado y `outline` el otro. Los
  `<form>`, campos ocultos, `ConfirmDialog` y `data-testid` de hoy no cambian; el botón que hoy no se
  pinta pasa a pintarse deshabilitado.
- Falta de reparto y «Lo está empacando…»: `Notice` (`warning` / `info`) con su `data-testid`.

**D12 — Acondicionamiento (R32–R36).** `ConditioningOrderScreen` compone `OperatorScreenFrame`:

- `back` según estado (D1); `subtitle` = reparto (`orderDistributionFullText`); `status` =
  `StatusBadge`.
- Cuerpo en dos tarjetas: «Equipo» (`ConditioningTeamList` de hoy con `ResponsibleAvatars` en la
  cabecera de la tarjeta) y «Datos de lote» (`ConditioningBatchDataForm` de hoy).
- Pie: `ConditioningActions` deja de pintar dos bloques sueltos y pinta los dos botones del pie
  («Acondicionar», «Terminar»), cada uno habilitado según R34; los diálogos son los de hoy
  (`StartConditioningDialog` con el selector y `FinishConditioningDialog`), ambos con
  `CountdownGatedButton`, que ahora lleva el anillo.
- El error de candidatos sigue con `ErrorAlert` y su `data-testid`.

**D13 — Textos y toast (R39, R40).** Constantes corregidas en `packing-order-screen.tsx`,
`order-execution-screen.tsx` y `step-reader.tsx`. `ConditioningBatchDataForm`, al recibir
`status: 'success'`, llama a `toast.success('Datos de lote guardados.')` una vez por envío (efecto
sobre el resultado) y deja de pintar `conditioning-batch-data-success`. El `Toaster` ya está montado
en el layout privado.

**D14 — Error de lista único (R42).** `AssignedOrdersError` se borra y su sitio lo ocupa
`AssignmentListError`, que ya pinta los mismos `data-testid`. El barrel deja de reexportar
`MISSING_VALUE_MARK`; `assigned-orders-columns.test.tsx` importa `EMPTY_MARK` de
`lib/shared/ui/empty-mark`.

**D15 — Guardias.**

- `tests/guards/guard-asignacion-componentizada.test.ts` gana reglas para R14 (los dos avisos
  borrados), R38 (una sola definición del anillo: ningún `<circle>` con `stroke-dashoffset` fuera de
  `countdown-ring.tsx`), R39 (las tres formas sin tilde) y R42.
- `tests/guards/guard-piezas-base.test.ts` retira la exclusión estrecha del barrel (R43).
- `tests/guards/guard-identificador-de-request.test.ts`: alta del E2E nuevo (§ 7).

## 5. Contratos que cambian

| Símbolo | Antes | Después |
| --- | --- | --- |
| `ASSIGNMENT_VIEW_LABELS.acondicionados` | «Terminados» | «Acondicionados» |
| `CONDITIONING_ORDER_SCREEN_TEXTS.backToFinished` | «Volver a «Terminados»» | `backToConditioned`: «Volver a «Acondicionados»» |
| `AssignmentViewTabs` | `current`, `views` | + `counts?` |
| `OrderOutcomeNotice` | `kind: 'packed' \| 'conditioned'` | + `'delivered' \| 'cancelled'`, `packages?`, `productName?` |
| `AssignedOrderDeliveredNotice`, `AssignedOrderCancelledNotice` | componentes | borrados (sus textos y testids siguen exportados) |
| `AssignedOrdersError` | componente | borrado |
| `MISSING_VALUE_MARK` | reexportado por el barrel | sin reexportar |
| `ConditioningOrderLink` | enlace del número | borrado |
| `Notice` | sin cierre | `dismissible?` |
| `CountdownRing` | `WaitRing` interno de `StepReader` | `components/shared/countdown-ring.tsx` |
| `CountdownGatedButton` | cuenta | cuenta + anillo |
| `OrderCancelDialog` | disparador propio | + `open?`, `onOpenChange?` |
| `ThemeToggle` | — | + `className?` (si no lo tiene) |
| Columnas de las listas | sin menú | + `actionsColumn`, `card`; opción `canViewTrace` |

## 6. Snapshots y árboles que cambian (aceptados)

Toda diferencia de paridad que no esté aquí es un fallo de la tanda:

| Archivo | Cambio | Requisito |
| --- | --- | --- |
| `tests/unit/paridad/asignacion-paridad.test.tsx` (+ `.snap`) | pestañas con `UrlTabs` y contador; estado con `StatusBadge`; prioridad con `PriorityMark`; columna de acciones y tarjetas; avisos con `Notice` | R9, R12, R13, R16–R21 |
| `tests/unit/paridad/asignacion-listas-paridad.test.tsx` (+ `.snap`) | ídem en las listas de empaque y acondicionamiento; número sin enlace | R16, R19, R21 |
| `tests/unit/paridad/asignacion-acondicionamiento-paridad.test.tsx` (+ `.snap`) | marco del operario, avisos, diálogo de terminar con anillo, empaque | R2, R13, R27–R37 |
| `tests/unit/paridad/confirmaciones-paridad.test.tsx` (+ `.snap`) | solo los casos del operario que llevan `CountdownGatedButton` (anillo) | R37 |

La tanda 0 no regenera nada: los snapshots se actualizan en la tanda que cambia la pantalla, y el
commit cita la fila de esta tabla.

## 7. Tests y E2E que se tocan (barrido con grep, 2026-10-12)

**Unitarios que cambian aserciones** (por texto, testid o árbol):

| Test | Por qué |
| --- | --- |
| `tests/unit/asignaciones-ui/asignacion-page.test.tsx` | pestañas en `Suspense` con contadores; avisos en una pieza; `PageHeader` |
| `tests/unit/asignaciones-ui/assigned-orders-delivered-notice.test.tsx`, `assigned-orders-cancelled-notice.test.tsx`, `packed-order-notice.test.tsx`, `conditioned-order-notice.test.tsx` | renderizan `OrderOutcomeNotice` con su `kind`; mismos textos y testids |
| `tests/unit/asignaciones-ui/assigned-orders-columns.test.tsx`, `company-orders-columns.test.tsx`, `packing-orders-columns.test.tsx`, `conditioning-orders-columns.test.tsx`, `finished-orders-columns.test.tsx` | `StatusBadge`, `PriorityMark`, menú ⋯, número sin enlace; `EMPTY_MARK` en vez de `MISSING_VALUE_MARK` |
| `tests/unit/asignaciones-ui/packing-orders-list-section.test.tsx`, `conditioning-orders-list-section.test.tsx`, `delivered-conditioned-orders-list-section.test.tsx`, `finished-orders-list-section.test.tsx`, `company-orders-list-section.test.tsx`, `assigned-orders-states.test.tsx`, `assigned-orders-can-execute.test.tsx` | `canViewTrace`, `card`, error único |
| `tests/unit/asignaciones-ui/a11y-tactil.test.tsx` | tallas del marco y del pie |
| `tests/unit/asignaciones-ui/order-execution-screen.test.tsx`, `order-execution-page.test.tsx`, `order-cancel-dialog.test.tsx`, `order-execution-tools.test.tsx`, `order-execution-lines.test.tsx` | cabecera, menú ⋯, panel plegable, texto con tilde |
| `tests/unit/asignaciones-ui/packing-order-screen.test.tsx`, `packing-order-page.test.tsx` | marco, pie con dos botones, `Notice`, textos con tilde |
| `tests/unit/asignaciones-ui/conditioning-order-screen.test.tsx`, `conditioning-order-page.test.tsx`, `start-conditioning-dialog.test.tsx`, `finish-conditioning-dialog.test.tsx`, `conditioning-batch-data-form.test.tsx` | marco, «Volver a «Acondicionados»», pie, toast |
| `tests/unit/shared/countdown-gated-button.test.tsx` | anillo |
| `tests/unit/recetas-ui/step-reader.test.tsx` | texto con tilde, `CountdownRing`, botones `xl` en `ejecucion` |
| `tests/unit/shared-ui/url-tabs.test.tsx` | ninguno (solo se reutiliza) — se lista porque el grep lo encontró |

**E2E que cambian** (corren en el PR a producción; T8 los corre por spec):

| E2E | Qué cambia |
| --- | --- |
| `e2e/acondicionamiento.spec.ts` | `tabs.nth(1)` deja de ser «Terminados» exacto: «Acondicionados» + contador; `conditioning-order-link` → menú ⋯ «Entrar» |
| `e2e/acondicionar-con-equipo.spec.ts` | `conditioning-order-link` → menú ⋯ «Entrar» |
| `e2e/empaque.spec.ts` | `packing-order-link` → menú ⋯ «Entrar»; texto de pestañas con contador |
| `e2e/pasos-de-envasado.spec.ts` | `packing-order-link` → menú ⋯ «Entrar» |
| `e2e/pedidos-asignados.spec.ts` | `packing-order-link` → menú ⋯ «Entrar»; pestañas con contador |
| `e2e/pedidos-terminados.spec.ts` | pestañas con contador (si afirma el texto exacto) |
| `e2e/datos-de-lote-en-acondicionamiento.spec.ts` | `CONDITIONING_BATCH_DATA_SUCCESS_TESTID` → toast «Datos de lote guardados.» |
| `e2e/registro-ejecucion.spec.ts` | `import` de `assignedOrderCancelledNoticeText` desde `order-outcome-notice` |
| `e2e/ejecucion-receta.spec.ts`, `e2e/reserva-de-material.spec.ts`, `e2e/producto-terminado.spec.ts`, `e2e/envases-del-pedido.spec.ts`, `e2e/pedido-en-varias-presentaciones.spec.ts` | leen los testids de los avisos, que se conservan; solo cambian si afirman el árbol del aviso |

**E2E nuevo:** `e2e/operario-rediseno.spec.ts` (Chromium y WebKit): sin barra lateral en las tres
pantallas y con barra en el 404 y en `/asignacion` (R1, R5, R6); pie fijo y tallas a 390 × 844
(R2, R3); dos columnas a 1440 y una a 820 (R4); contadores (R9); cerrar un aviso (R15); tarjetas a
390 × 844 con «Entrar» de 44 px y «Acciones» centrado (R21); diálogos centrados (R41); anillo
visible y que se vacía (R37). Se da de alta en `E2E_ESPERADOS` de
`tests/guards/guard-identificador-de-request.test.ts` con el comentario «Alta el <fecha> (QC-265) por
el MISMO motivo y en el MISMO sitio que las demas: …», como las altas de QC-260 y QC-257.

T0 repite el grep antes de tocar nada y lo deja en `progress/impl_QC-265-rediseno-operario.md`.

## 8. Alternativas descartadas

- **A1 — Grupo de rutas `(operario)` con su propio layout** (D2). Limpio en el render, pero mueve tres
  carpetas de páginas, cambia los `import` de unos 30 tests y de 5 guardias
  (`guard-pantallas-exigen-permiso`, `guard-rutas-privadas-cubiertas`…), duplica la lectura de
  sesión que el layout privado declara única (R16 de QC-11), duplica el `Toaster` y obliga a un 404
  propio sin menú, que dejaría a la persona sin salida (`app/(private)/not-found.tsx` explica por qué
  el 404 no lleva enlace).
- **A2 — Decidir el marco en el cliente por la ruta** (`usePathname` en el layout). El 404 de esas
  direcciones saldría sin barra ni salida, y la regla «qué es pantalla de operario» quedaría en una
  lista de direcciones que hay que mantener a mano.
- **A3 — Caso de uso de conteo en `asignaciones`** para los contadores. Es trabajo de módulo
  (backend) y la ficha es de frontend; `total` ya está en cada lista. Queda como siguiente paso si
  las lecturas de una fila se miden lentas.
- **A4 — Seguir el tablero al pie de la letra en Empaque y Acondicionamiento** (lista fija de pasos,
  equipo editable en pantalla, espera de 10 s en el pie). Contradice decisiones cerradas del humano
  (QC-211 D6/D7, QC-218 D6) y exige acciones de servidor nuevas; van como P2–P4.
- **A5 — Un `Notice` nuevo para `/asignacion` con su X**, sin tocar el compartido. Duplica la pieza
  que QC-256 dejó como única; extender con una prop opcional es el paso 2 de la regla.
- **A6 — Mover el progreso a la cabecera fija** (P14). Obliga a partir `StepReader`, que también usa
  Fórmulas en modo `lectura`, para una diferencia de posición.

## 9. Riesgos y coordinación

- **`:has()`**: lo soportan Chromium, WebKit y Firefox actuales; en un navegador viejo la barra se ve
  (como hoy). El E2E corre en Chromium y WebKit.
- **Archivos compartidos con otras fichas:** `components/shared/CATALOGO.md`, `components/shared/notice.tsx`,
  `app/globals.css` (cualquier ficha de rediseño en vuelo; hoy QC-261, mismo dueño) y
  `app/(private)/asignacion/acondicionamiento/[id]/components/conditioning-batch-data-form.tsx`
  (QC-253, `pending`). `scripts/archivos-en-vuelo.mjs` lo comprueba con `## Archivos esperados`.
- **Lista cerrada R18** de `order-execution-screen.test.tsx`: solo se toca `step-reader.tsx` dentro de
  `components/shared/step-reader/`; `CountdownRing` vive fuera de esa carpeta.
- **Tamaño:** la ficha es `medium` y toca cuatro pantallas. Las tandas 3–6 son independientes entre
  sí tras la 1 y la 2.

## 10. Deudas

- **D51** se resuelve entera (D8, D14) si P15 queda por defecto.
- **Nueva:** buscador de `/asignacion` (P11), si se confirma fuera.
- **D44** sigue abierta (P13).

## Dependencias de terceros

Ninguna nueva. `sonner` (toast), `@base-ui/react` (Collapsible, Menu, AlertDialog) y `lucide-react`
ya están.
