# QC-291 — pantalla-operario-rediseno · design

## Lo que ya existe

**Buscado.** Términos: «operario», «pantalla del operario», «OperatorScreenFrame», «StepReader
ejecución», «columna lateral», «botón flotante», «equipo de acondicionamiento».

- **Board** (`feature_list.json`):
  - QC-265 `rediseno-operario` (`done`): primer rediseño del operario. Montó el marco, la cabecera
    sticky, el pie fijo, el anillo en el botón (R37) y los dos botones del pie de
    acondicionamiento (R34).
  - QC-269 `layout-operario` (`done`): corrigió el scroll del panel de materiales y la fila de
    material.
  - QC-252 `componentizacion-asignacion` (`done`).
  - QC-268 `imports-profundos-step-reader` (`pending`): pide que `clampStepPosition` y
    `StepDocumentView` pasen por el barrel.

  Ninguna es esta ficha. QC-291 es la **segunda vuelta** de diseño sobre lo que dejaron QC-265 y
  QC-269, con tableros nuevos aprobados el 2026-10-16. Lo que cambia de otras fichas está en
  §1.1 (enmiendas).
- **Specs:** `specs/QC-265-rediseno-operario/` y `specs/QC-269-layout-operario/`, ya
  implementados. No hay spec que cubra la columna con colores, los botones flotantes ni el scroll
  interno.
- **Código:** el grafo no tiene indexado este worktree (`list_projects` no lo lista). Se exploró con
  Grep y Read.

**Lo que se reutiliza, verificado en código:**

| Pieza | Ruta | Uso aquí | Paso de la regla |
|---|---|---|---|
| `OperatorScreenFrame` | `app/(private)/asignacion/components/operator-screen-frame.tsx` | Marco de las tres pantallas | 2. Se extiende (ver §3.1) |
| `StepReader`, `StepProgress` (interno) | `components/shared/step-reader/step-reader.tsx` | Paso a paso en fabricación y empaque | 2. Props opcionales nuevas; `StepProgress` sale por el barrel (ver §3.2) |
| `StepDocumentView` | `components/shared/step-reader/step-document-view.tsx` | Párrafos y comprobaciones | 2. Prop opcional `variant` |
| `OrderExecutionCollapsibleCard` | `app/(private)/asignacion/[id]/components/order-execution-collapsible-card.tsx` | Tarjeta plegable de cada sección | 2. Prop opcional `tone`; se mueve a `app/(private)/asignacion/components/` (ver §3.4) |
| `OrderExecutionLines` | `app/(private)/asignacion/[id]/components/order-execution-lines.tsx` | Materiales con selector de unidad | 2. Estado de unidad controlable desde fuera (ver §3.5) |
| `OrderExecutionTools` | `app/(private)/asignacion/[id]/components/order-execution-tools.tsx` | Lista de herramientas | 1. Tal cual |
| `OrderExecutionToolsPanel` | `app/(private)/asignacion/[id]/components/order-execution-tools-panel.tsx` | Hoy compone las dos tarjetas | Se sustituye por `OperatorSidePanels`; el archivo se borra |
| `ConditioningTeamList` | `app/(private)/asignacion/acondicionamiento/[id]/components/conditioning-team-list.tsx` | Sección Equipo | 2. Avatar, «Personas», contador por grupo y `actorId` opcional |
| `groupResponsiblesByOrigin` | `lib/shared/ui/responsible-groups.ts` | Agrupado del equipo | 1. Tal cual, sin reordenar (ver §3.6) |
| `Avatar`, `AvatarFallback` + `getInitials` + `avatarTone` | `components/ui/avatar.tsx`, `lib/shared/ui/initials.ts`, `lib/shared/ui/avatar-tone.ts` | Avatar de iniciales, como hace `ResponsibleAvatars` | 1. Tal cual |
| `Dialog`, `DialogContent`, `DialogClose`, `DialogTitle` | `components/ui/dialog.tsx` | Panel de sección en tablet y teléfono | 1. Con `showCloseButton={false}` y `className` |
| `Collapsible` | `components/ui/collapsible.tsx` | Dentro de la tarjeta plegable | 1. Tal cual |
| `CountdownRing`, `CountdownTimer` | `components/shared/countdown-ring.tsx`, `components/shared/countdown-timer.tsx` | Bloque de espera | 1. Tal cual |
| `StatusBadge` + `ORDER_STATUS_LABELS` / `ORDER_STATUS_TONES` | `components/shared/status-badge.tsx`, `lib/shared/ui/order-status.ts` | Insignia de estado | 1. Tal cual |
| `ArrowLink` | `components/shared/arrow-link.tsx` | «Volver a …» | 1. Tal cual |
| `Button` (`size="xl"`, `touch`) | `components/ui/button.tsx` | Botones del pie | 1. Tal cual |
| `ConfirmDialog`, `StartConditioningDialog`, `FinishConditioningDialog`, `PackingFinishDialog`, `EvidenceMissingDialog`, `OrderCancelDialog` | sus archivos actuales | Diálogos de hoy | 1. Tal cual (R32) |
| `OrderDistributionFull`, `EntityImage`, `orderDistributionLineText`, `Notice` | `app/(private)/asignacion/components/order-distribution-full.tsx`, `components/shared/…` | Sección Envases | 1. Tal cual |

Filas consultadas de `components/shared/CATALOGO.md`: `Avatar`, `Button`, `Card`, `Checkbox`,
`Collapsible`, `Dialog`, `Popover`, `Sheet`, `ArrowLink`, `CountdownRing`, `CountdownTimer`,
`Notice`, `ResponsibleAvatars`, `StatusBadge`, `StepReader`, `StepDocumentView`, `avatarTone`,
`getInitials`, `groupResponsiblesByOrigin`, `touchTarget`.

**Pieza nueva:** `OperatorSidePanels`, en `app/(private)/asignacion/components/`. Va por el
**paso 3 (compone)**: une `OrderExecutionCollapsibleCard`, `Button` y `Dialog`, que ya existen, y
no hay ninguna pieza que haga «columna en escritorio, botones flotantes con panel en tablet». Su
tablero es `docs/diseno/canvas/OperarioPantalla.dc.html`, en sus anchos de 1440, 834 y 390 px
(`OperarioPantallaTablet.dc.html`, `OperarioPantallaMovil.dc.html`).

**Tableros citados** (`docs/perfil-agentes.md > Pase de diseño`), aprobados el 2026-10-16:

- `docs/diseno/canvas/OperarioPantalla.dc.html`;
- `docs/diseno/canvas/OperarioPantallaTablet.dc.html`;
- `docs/diseno/canvas/OperarioPantallaMovil.dc.html`.

La «Ficha por plataforma» del tablero móvil dice:

- reutiliza `OperatorScreenFrame`, `StepReader` en ejecución, `ConditioningTeamList`,
  `ResponsibleAvatars`, la insignia de estado y los botones `b-xl`;
- ninguna librería nueva;
- la animación de cambio de paso es la que ya tiene `StepReader`.

## 1. Modelo de datos

**Ninguno.** No hay tablas, columnas, RLS ni migraciones. Las vistas de dominio no cambian
(R32).

Lo que el tablero pinta y las vistas no traen lo cerró el humano el 2026-10-16
(`requirements.md > Decisiones cerradas`, D4 a D13). Los tableros ya están actualizados a esas
decisiones:

| Dato del tablero | Vista de hoy | Qué hace el spec |
|---|---|---|
| Hora de inicio | Ninguna vista la trae | Fuera del diseño. La línea dice solo «Fabricando», «Acondicionando» o «Empacando» (D4, R4) |
| Nombre del paso, título grande, lista de pasos al empezar | `RecipeStepDocument` = `blocks` + `requiresEvidence` | Fuera. «Paso N de M» y el número de pasos (D5, R6, R12, R17) |
| «En este paso usas» | No hay relación paso–material | Fuera (D6, R12) |
| Nota de seguridad | No hay bloque «nota» | Hueco opcional en `StepReader` que nadie alimenta: no se ve (D7, R34) |
| Equipo en fabricación y empaque | Ninguno | Equipo solo en acondicionamiento (D8, R20, R23) |
| Rol de la persona | `ConditioningTeamMemberView` sin rol | Solo avatar, nombre y «Tú» (D9, R23, R24) |
| Insumos, «Envases y etiquetas», herramientas de acondicionamiento | `ConditioningOrderDetail` no los trae | Envases con el reparto de hoy, y Equipo (D10, R20, R25) |
| Presentación en fabricación | `order-execution-presentation` en el subtítulo | Fuera de la pantalla (D11, R2) |
| Cuenta atrás de la espera | Dentro del botón (QC-265 R37) | Se queda en el botón (D13, R15) |

### 1.1 Enmiendas a otras specs

Esta ficha cambia lo que fijaron otras. Al implementarla se añade una nota fechada bajo cada
requisito, sin reescribirlo (T12):

| Spec y requisito | Qué decía | Qué queda | Decisión |
|---|---|---|---|
| `specs/QC-195-envases-del-pedido-como-productos` R44 | La pantalla de empaque **y la de ejecución** nombran los envases de cada línea | Solo la de empaque. La de ejecución (fabricación) ya no muestra la presentación. Se borra la comprobación «R44: la ejecución nombra los envases» de `e2e/envases-del-pedido.spec.ts:624-635`; la de empaque (`:671`) se queda | D11 |
| `specs/QC-265-rediseno-operario` R23 | Cabecera con «Pedido … · Presentación: <reparto>» | «Cantidad …», sin presentación (R2) | D11 |
| `specs/QC-265-rediseno-operario` R29, R31 y R34 | El pie pinta siempre los dos botones; los que no aplican, deshabilitados | Un botón según el estado (R8, R10) y, sin acción posible, ningún botón y una línea con el motivo (R33) | D12 |

QC-265 R37, la cuenta dentro del botón, **no** se enmienda (D13).

**La marca «Tú» no es un dato nuevo.** La página de acondicionamiento ya resuelve `actor.id`
(`app/(private)/asignacion/acondicionamiento/[id]/page.tsx:57`). Hoy solo la usa para calcular
`canFinish`; desde ahora también la pasa como prop `actorId` a `ConditioningOrderScreen`, como ya
hace empaque con `PackingOrderScreen`. No hay consulta nueva.

## 2. Rutas

Las mismas tres rutas, sin cambios de permisos ni de carga:

- `app/(private)/asignacion/[id]/page.tsx`: sin cambios.
- `app/(private)/asignacion/acondicionamiento/[id]/page.tsx`: añade solo la prop `actorId`.
- `app/(private)/asignacion/empaque/[id]/page.tsx`: sin cambios.

## 3. Componentes y contratos

### 3.1 `OperatorScreenFrame` (extensión)

La estructura pasa de «documento con cabecera sticky y pie `fixed`» a una columna de alto fijo:

```
div[data-operator-screen] .@container  h-dvh flex flex-col overflow-hidden
  header[data-slot=operator-header]     flex-none   (sticky top-0 se conserva)
  div[data-slot=operator-scroll]        flex-1 min-h-0 overflow-y-auto overscroll-contain
    div[data-slot=operator-body]        contenido
  footer[data-slot=operator-footer]     flex-none   (en flujo, ya no fixed)
  [capa de OperatorSidePanels]          absolute, fuera del scroll
```

- Cabecera y pie ya no se superponen al contenido, así que desaparecen las reservas
  `pb-[calc(132px+…)]` del cuerpo y `STEP_READER_SIDE_COLUMN_RESERVE`.
- Esa reserva y su test de paridad en `order-execution-screen.test.tsx` se retiran. El problema
  que resolvía en QC-269 (el pie tapaba el final del panel) ya no puede darse.
- `safe-area-inset-top` va en la cabecera y `safe-area-inset-bottom` en el pie (R11).

**Props nuevas, todas opcionales:**

- `phaseLabel?: string`: «Fabricación», «Acondicionamiento» o «Empaque». Se pinta como
  `<phaseLabel> · <eyebrow>`. El número conserva su propio elemento `data-slot="operator-eyebrow"`,
  y por eso `envases-del-pedido` y `pedido-en-varias-presentaciones` siguen comparando el texto
  exacto.
- `running?: string`: la línea de R4. Si viene, sustituye a `back` en la fila de control y se
  pinta con `role="status"` y el punto de acento del tablero. `back.disabled` deja de usarse; se
  conserva en el tipo para no romper a nadie y ningún consumidor lo pasa.
- `quantity?: ReactNode`: el chip de Cantidad (R2), que sustituye a `subtitle` en las tres
  pantallas. `subtitle` se conserva en el tipo.
- `progressSlotRef?: Ref<HTMLDivElement>` y `footerSlotRef?: Ref<HTMLDivElement>`: dos
  contenedores, uno dentro de la cabecera y otro dentro del pie, donde `StepReader` pinta por
  portal su barra y sus botones (§3.2).
- `overlay?: ReactNode`: la capa de botones flotantes y panel (§3.3). Va dentro de la raíz y fuera
  de la zona con scroll, para que no se desplace con el contenido.

**Tamaños, sacados del tablero:**

| Elemento | Escritorio | Contenedor ≤ 560 px |
|---|---|---|
| `h1` | 30 px / 700 | 24 px |
| Relleno de la cabecera | `20px 24px 22px`, `gap` 18 px | `14px 16px 16px` |
| Ancho del contenido | 1120 px | — |
| Ancho interior del pie | 720 px | — |

### 3.2 `StepReader` (extensión, solo `mode="ejecucion"`)

Las props nuevas son opcionales. Sin ellas, el comportamiento es byte a byte el de hoy (R18).

```ts
readonly slots?: {
  /** Destino del progreso: barra, «Paso N de M» y porcentaje. */
  readonly progress: HTMLElement | null;
  /** Destino de la línea de motivo y los botones. */
  readonly actions: HTMLElement | null;
};
/**
 * Nota de seguridad del paso, por posición (1-based). Hueco del tablero (D7): ninguna pantalla lo
 * pasa hoy, porque el documento del paso no tiene nota.
 */
readonly stepNote?: (position: number) => string | null;
```

- **Con `slots`.** El progreso y los botones se pintan con `createPortal` en esos nodos, no en el
  `div` `fixed`, y la sección pierde su `pb-[calc(140px+…)]`.
  - Mientras un nodo sea `null` (primer render), no se pinta esa parte. La pantalla guarda los
    nodos en estado con un callback ref y re-renderiza al tenerlos.
  - Los testids se conservan: `step-reader-progress`, `step-reader-position`,
    `step-reader-actions`, `step-reader-previous`, `step-reader-next`, `step-reader-finish` y
    `step-reader-blocked-reason`. Así siguen valiendo los E2E de `ejecucion-receta`,
    `pasos-de-envasado` y `registro-ejecucion`.
- **Insignia (R12).** El encabezado del paso, `step-reader-heading`, que conserva el foco y el
  `scrollIntoView` del cambio de paso, pinta la insignia con el número y «de M». No hay título
  del paso ni bloque «En este paso usas» (D5, D6). El `title` del lector, si viene, sigue siendo
  el `h2` de la sección (empaque: «Pasos de envasado»); no es el nombre de un paso.
- **Porcentaje (R6).** Se calcula en el componente: `Math.round(((index + 1) / total) * 100)`.
- **Contador (R14).** «Comprueba · X de Y», con X = total − pendientes. Sale de `countPendingItems`,
  que ya existe, y del total de items del paso. Se pinta una vez, antes de la primera lista del
  documento. Para eso `StepDocumentView` recibe `checklistHeader?: ReactNode`.
- **Espera (R15): sin cambios** (D13). El anillo y el `CountdownTimer` siguen dentro del botón
  primario, como fijó QC-265 R37, y el motivo sigue en `aria-describedby`. Con `slots`, el botón
  se pinta por portal en el pie con su anillo dentro: cambia dónde está el botón, no lo que
  lleva. No hay bloque de espera en el contenido.
- **Nota de seguridad (R34).** Si `stepNote?.(position)` devuelve texto no vacío, debajo del
  documento se pinta un bloque con `role="note"`, `data-testid="step-reader-note"`, el icono
  `TriangleAlertIcon` (`aria-hidden`) y el texto, con el estilo `.opx-note` del tablero (fondo
  `muted`, `rounded-[14px]`). Sin `stepNote`, o con `null` o cadena vacía, no se pinta nada: ni
  contenedor vacío ni texto de muestra. Ninguna de las tres pantallas pasa `stepNote`; que llegue
  un dato es trabajo de otra ficha (D7).
- **`finishLabel`.** Lo pasan las pantallas: «Terminar la fabricación» o «Terminar el empaque».
- **`StepProgress`.** Se exporta por `components/shared/step-reader/index.ts`. Se actualiza su
  fila en `CATALOGO.md`, con el punto de extensión de las props nuevas.

**`StepDocumentView`, prop `variant?: 'lectura' | 'ejecucion'`** (por defecto `'lectura'`). En
`'ejecucion'`:

- Cada item es un `label` de tarjeta: `min-h-15` (60 px), borde, `rounded-[14px]` y relleno
  `12px 16px`. Lleva el `Checkbox` de hoy dentro, de 28 px visibles y objetivo de 44 px.
- Marcado: `bg-primary/7`, borde `primary/45` y texto `line-through text-muted-foreground`, con
  la transición de color de `qc.css`, la duración del sistema (`--dur-base`) y
  `motion-reduce:transition-none`.
- Los párrafos van en `text-[17px] leading-[1.55]` y bajan a `@max-[560px]:text-base` (R16).
- El `label` sigue envolviendo al `Checkbox`: el toque en toda la tarjeta lo marca (R13) sin
  manejadores nuevos.

### 3.3 `OperatorSidePanels` (pieza nueva, paso 3)

`app/(private)/asignacion/components/operator-side-panels.tsx`, `'use client'`.

```ts
export type OperatorSectionTone = 'materials' | 'tools' | 'team';

export type OperatorSection = {
  readonly key: OperatorSectionTone;
  readonly title: string;          // «Materiales», «Envases», «Herramientas», «Equipo»
  readonly icon: LucideIcon;
  readonly count: number;
  readonly content: ReactNode;
  readonly testIds: { card: string; trigger: string; count: string; content: string; fab: string };
};

export type OperatorSidePanelsProps = {
  readonly sections: readonly OperatorSection[];  // ya en orden R20, sin las vacías (R21)
};

/** Devuelve las dos mitades: la columna y la capa flotante. */
export function useOperatorSidePanels(props: OperatorSidePanelsProps): {
  readonly column: ReactNode;   // aside, se oculta con @max-[1000px]:hidden
  readonly overlay: ReactNode;  // botones y panel, se oculta con @min-[1001px]:hidden
};
```

- **Columna** (R19, R20). `aside` con `aria-label` hecho con los títulos de sus secciones
  («Materiales y herramientas», «Envases y equipo», «Envases»). Contiene
  una `OrderExecutionCollapsibleCard` por sección, con `tone`. La rejilla de la pantalla es
  `@min-[1001px]:grid-cols-[320px_minmax(0,1fr)]`; hoy es `300px` con corte en 1101 px.
- **Capa** (R27-R31).
  - Pila `absolute right-4` sobre el pie, con un `Button` redondo de 56 px por sección, pintado
    con el color del tono. Lleva el contador en una burbuja, `aria-label` «Ver <título en
    minúscula>», `aria-expanded` y `aria-controls`.
  - El panel es un `Dialog` controlado (`open = sección activa`) con `DialogContent
    showCloseButton={false}` y `className` propio:
    - anclado a la derecha y por encima del pie (`right-[88px] bottom-[132px]`, `w-[min(380px,…)]`);
    - por debajo de 560 px, `inset-x-4` (R30).
  - Cabecera con `DialogTitle`, el contador y un `DialogClose` de 44 px con `aria-label` «Cerrar»
    (R28).
  - El `Dialog` de Base UI ya cierra al tocar fuera (backdrop) y con Escape, y devuelve el foco al
    disparador (R29). El backdrop es el `DialogOverlay` de hoy.
  - El cuerpo del panel lleva `overflow-y-auto` y `max-h` (R31).
  - R30: mientras haya un panel abierto, la pila lleva `@max-[560px]:hidden`. Se decide en React
    con `active !== null`, no con `:has()`.
- **Contenido duplicado.** El contenido de una sección se monta en la columna **y**, mientras el
  panel está abierto, en el panel. La columna está oculta con CSS en tablet, así que solo una copia
  es visible a la vez. Por eso:
  - los tests acotan por contenedor (`order-execution-materials` frente a
    `operator-side-panel-materials`);
  - el estado que tiene que sobrevivir, la unidad elegida, se sube fuera de las filas (§3.5).
  - El panel no usa `keepMounted`: si lo usara, habría dos copias montadas siempre.

**Colores** (R20, R27). Tres pares de tokens nuevos en `app/globals.css`, tomados del tablero:

| Token | Claro | Oscuro (`.dark`) |
|---|---|---|
| `--section-materials` | `oklch(0.57 0.15 55)` | `oklch(0.68 0.14 60)` |
| `--section-tools` | `oklch(0.55 0.15 255)` | `oklch(0.64 0.14 255)` |
| `--section-team` | `oklch(0.54 0.13 160)` | `oklch(0.64 0.12 160)` |
| `--section-foreground` | `oklch(0.99 0 0)` | `oklch(0.18 0 0)` |

Se exponen como utilidades de Tailwind en `@theme inline`, igual que los demás tokens del
archivo. El contraste AA de cada par lo comprueba un test unitario que calcula la luminancia
relativa a partir de los valores OKLCH (T3).

### 3.4 `OrderExecutionCollapsibleCard` (extensión y traslado)

- Prop opcional `tone?: OperatorSectionTone`. Con ella, el disparador ocupa la cabecera entera de
  la tarjeta, con fondo `bg-(--section-<tone>)` y texto `text-(--section-foreground)`, y el
  contador va sobre un fondo `--section-foreground` al 22 %. Sin `tone`, se ve como hoy.
- **Traslado** a `app/(private)/asignacion/components/order-execution-collapsible-card.tsx`. Hoy la
  usa solo `/asignacion/[id]`; desde ahora la usan las tres rutas de `/asignacion`. Sube al nivel de
  `/asignacion` y no a `components/shared`, como ya pasa con `OperatorScreenFrame` y
  `useStepEvidence`. Es una excepción declarada (`docs/perfil-agentes.md > Regla de decisión`):
  los consumidores son exactamente esas tres pantallas, y ninguna ruta fuera de `/asignacion` la
  necesita.

### 3.5 `OrderExecutionLines` (extensión)

Props opcionales `selectedUnitIds?: ReadonlyMap<number, string>` y
`onSelectUnit?: (index: number, unitId: string) => void`.

- Con ellas, la fila es controlada; sin ellas, conserva su `useState` de hoy.
- `OrderExecutionScreen` guarda el mapa en su estado. Así la unidad elegida es la misma en la
  columna y en el panel, y sobrevive a cerrar el panel (R22).
- Los testids y la conversión con `convertQuantity` no cambian.

### 3.6 `ConditioningTeamList` (extensión)

- Pierde su `h2` «Equipo» y su `ResponsibleAvatars`: el título y el contador los pone la tarjeta.
- Cada grupo pinta su nombre en versalitas con su número: el `workGroupName` o «Personas» (R23).
  `CONDITIONING_TEAM_LIST_TEXTS.directLabel` cambia de «Personas sueltas» a «Personas».
- Cada miembro, `li` de al menos 44 px, lleva:
  - `Avatar` de 36 px con `tone={avatarTone(userId)}`, `aria-hidden` y `AvatarFallback`
    `getInitials(displayName)`;
  - el nombre, sin rol (D9);
  - si `userId === actorId`, la marca «Tú» con `data-testid="conditioning-team-list-me"` (R24).
- **Orden de los grupos:** el de `groupResponsiblesByOrigin`, que pone las personas sueltas
  primero. El tablero las pone al final, pero son datos de muestra. Reordenar aquí sería el
  «segundo criterio» que el docblock de la utilidad pide evitar, y rompería
  `acondicionar-con-equipo.spec.ts:485`.
- Se conservan los testids `conditioning-team-list`, `-group`, `-group-name` y `-member`, y
  `data-kind`.

### 3.7 Las tres pantallas

| | Fabricación | Acondicionamiento | Empaque |
|---|---|---|---|
| `phaseLabel` | Fabricación | Acondicionamiento | Empaque |
| `running` (R4) | `status === 'EN_CURSO'` → «Fabricando» | `canFinish` → «Acondicionando» | `canFinish` → «Empacando» |
| `back` (R3, R5) | sin comenzar | sin `canFinish` | sin `canFinish` |
| Insignia de estado | **nueva** en fabricación, con `ORDER_STATUS_*` | la de hoy | la de hoy |
| Chip Cantidad | `order-execution-order-quantity` | `conditioning-order-quantity` | `packing-order-quantity` |
| Secciones y botones flotantes (R20, D8) | Materiales (`lines`) y Herramientas (`tools`, si hay: R21) | Envases (`OrderDistributionFull withImages`) y Equipo (si `team` no vacío: R23) | Solo Envases (líneas con `EntityImage`, vacío y aviso) |
| Presentación | **No se pinta** (D11) | En Envases | En Envases |
| Contenido sin comenzar (R17) | «Revisa antes de comenzar» + «N pasos» | «Revisa antes de comenzar» | «Revisa antes de comenzar» |
| Contenido comenzado | `StepReader` con `slots`, sin `stepNote` | Notice «Lo acondiciona …» (R26) + «Datos de lote» | `StepReader` con `slots` si hay pasos; si no, solo los avisos |
| Pie | R8 → R9 | R8 → R10, o R33 | R8 → R9 o R10, o R33 |

Notas:

- **«Revisa antes de comenzar»** es una `Card` con borde discontinuo, `h3` y texto, sin lista de
  pasos (D5). En fabricación cierra con «N pasos», como el tablero. Empaque no conoce sus pasos
  antes de comenzar (`get-packing-order.ts:65-67` los vacía), así que no da el número. Los textos
  de cada fase salen del tablero (`SCREENS[*].startBody`):
  - fabricación conserva el sentido del Notice de hoy;
  - acondicionamiento: «Al comenzar, el equipo queda registrado y el pedido pasa a «En
    acondicionamiento».»;
  - empaque: «Al comenzar, el empaque queda a tu nombre. Al terminar indicas los envases reales.»

  Se conserva el testid `order-execution-not-started`.
- **Acondicionamiento:** `ConditioningActions` pasa a pintar **un** botón según el estado (R8,
  R10), o ninguno (R33). Recibe una prop nueva `blockedReason?: string | null`: si viene, no pinta
  botones ni monta diálogos, y pinta solo
  `<p role="status" data-testid="conditioning-actions-reason">`. La pantalla la calcula:
  - en curso a nombre de otro: `CONDITIONING_ORDER_SCREEN_TEXTS.conditionedBy(nombre)`;
  - `TERMINADO`: `CONDITIONING_ACTIONS_TEXTS.finished`;
  - `ENTREGADO`: `CONDITIONING_ACTIONS_TEXTS.delivered`;
  - `POR_ACONDICIONAR` sin candidatos: `CONDITIONING_ACTIONS_TEXTS.noCandidates`. Hoy los
    candidatos solo faltan si su carga falla (`page.tsx:72-81`); el error se sigue pintando en
    `conditioning-order-candidates-error`.

  Los textos de `CONDITIONING_ACTIONS_TEXTS` pasan a «Comenzar el acondicionamiento» y «Terminar
  el acondicionamiento», más los tres motivos propuestos en `requirements.md > P11`.
- **Empaque:** `startCell` y `finishCell` dejan de ir juntos en una rejilla de dos. Se pinta el que
  aplica, centrado y con `max-w-[360px]`. A nombre de otro (R33), el pie pinta solo
  `<p role="status" data-testid="packing-order-footer-reason">` con el texto de
  `PACKING_ORDER_TEXTS.packer` / `packerUnknown`. El `Notice` `packing-order-packer` del
  contenido se conserva.
- **Fabricación:** la presentación sale de la pantalla (D11). Se borran el elemento
  `order-execution-presentation` y su constante, y no se mueve a ninguna sección.
- **Sin acción posible en fabricación:** el spec no cambia nada. D12 nombra solo casos de
  acondicionamiento y empaque.

## 4. Integraciones

Ninguna.

## 5. Dependencias

**Ninguna nueva** (D3). `Dialog`, `Collapsible`, `Avatar` y `Button` vienen de `@base-ui/react` y
del sistema, ya aprobados en `docs/dependencias.md`. `createPortal` es de `react-dom`, que ya es
una dependencia.

## 6. Multiplataforma

- Alto de pantalla con `h-dvh`, nunca `100vh`. `env(safe-area-inset-*)` en cabecera y pie.
- **Scroll anidado en iOS.** La zona con scroll lleva `overscroll-contain`. El cuerpo del `Dialog`
  lleva su propio `overflow-y-auto`. Base UI bloquea el scroll del documento mientras el `Dialog`
  está abierto. Antes de cerrar la feature hay que comprobarlo en WebKit con el proyecto
  `webkit` de Playwright, si existe en `playwright.config.ts`. Si no existe, se marca como «sin
  verificar en iOS» en `progress/impl_QC-291.md`: no se afirma.
- Ningún control depende de `:hover`. Los objetivos táctiles miden al menos 44 px; los botones
  flotantes, 56 px.
- Los cortes son de contenedor (`@container`), no de ventana: como hoy, la pantalla pasa a una
  columna por el ancho que tiene de verdad.

## 7. Verificación

**Unitarios** (`tests/unit/asignaciones-ui/`, `tests/unit/recetas-ui/`). Se ajustan los de hoy y se
añaden casos `R<n>` para:

- el marco: R1-R7, por estructura y atributos;
- `StepReader` con y sin `slots`: R6, R9, R12-R16, R18 y R34 (con `stepNote` se pinta la nota;
  sin él, o con `null`, no hay `step-reader-note`);
- `OperatorSidePanels`: R20, R21, R27-R29;
- `ConditioningTeamList`: R23, R24;
- el estado de unidad: R22;
- las tres pantallas: R2-R5, R8, R10, R17, R20, R23, R25, R26, R32 y R33.

**E2E: sí hace falta.** jsdom no aplica container queries ni calcula scroll, posiciones ni
`position`. Por eso R1, R6 (visible al final), R11, R19, R27, R30 y R31 solo se verifican en
navegador. Va en un spec nuevo, `e2e/pantalla-operario-rediseno.spec.ts`, a 1440 × 900, 834 × 1112
y 390 × 844.

**E2E existentes que tocan estas pantallas y necesitan cambios de selector o de expectativa:**

| Spec | Qué cambia |
|---|---|
| `e2e/operario-rediseno.spec.ts` | R2/R3: el pie ya no es `fixed` y el scroll no es el de `window`. R4: la primera pista es `320px` con corte en 1001 px, y en acondicionamiento el ancla ya no son dos `card` lado a lado. R37 se queda: el anillo sigue en el botón (D13), solo cambia que el botón está en el pie por portal. QC-269 R4/R6/R5: a 390 px el panel de materiales es un botón flotante, y `expectWholeAboveFooter` mide sobre la zona con scroll. `executionMaterialsTrigger` como control de 44 px en teléfono pasa a ser el botón flotante. «Terminar» del R41 cambia de texto. |
| `e2e/recetas-porcentaje.spec.ts:574` | «Pedido 200» pasa a «Cantidad 200». |
| `e2e/envases-del-pedido.spec.ts:624-635` | Se borra la comprobación «R44: la ejecución nombra los envases» (D11, enmienda de QC-195 R44). La de empaque, `:671`, se queda. |
| `e2e/acondicionar-con-equipo.spec.ts` | `:283-286`: en vez de dos botones deshabilitados, ningún botón y la línea `conditioning-actions-reason` (D12). `:477`: texto exacto «Terminar el acondicionamiento». |
| `e2e/acondicionamiento.spec.ts:463-465` | Ningún botón y la línea de motivo (D12); donde haya botón, textos «Comenzar el acondicionamiento» y «Terminar el acondicionamiento». |
| `e2e/pasos-de-envasado.spec.ts:624` | «Terminar» pasa a «Terminar el empaque». |

Se revisan sin cambio previsto, porque usan testids que se conservan y el ancho por defecto pinta
la columna:

- `e2e/ejecucion-receta.spec.ts`;
- `e2e/registro-ejecucion.spec.ts`;
- `e2e/empaque.spec.ts`;
- `e2e/envases-reales-empaque.spec.ts`;
- `e2e/pedido-en-varias-presentaciones.spec.ts`;
- `e2e/producto-terminado.spec.ts`;
- `e2e/datos-de-lote-en-acondicionamiento.spec.ts`;
- `e2e/reserva-de-material.spec.ts`;
- `e2e/recorrido-acondicionamiento.spec.ts`.

Si alguno falla, se corrige en T12.

## 8. Alternativas descartadas

1. **Mantener `position: fixed` en el pie y el scroll del documento, con la cabecera sticky.** Es
   lo de hoy. Descartada:
   - R1 pide que solo haga scroll la zona central;
   - el pie fijo obliga a reservar su alto a mano en cada columna, que es la clase de error que
     corrigió QC-269 (`STEP_READER_SIDE_COLUMN_RESERVE`, un `calc` duplicado vigilado por un test
     de paridad);
   - con un pie en flujo, la reserva deja de existir.
2. **Hacer `StepReader` controlado**, con el índice y las marcas subidos a cada pantalla, para
   pintar el progreso en la cabecera y los botones en el pie sin portales. Descartada:
   - cambia el contrato de una pieza compartida con tres usos en lectura (fórmulas y recetas);
   - obliga a repetir en dos pantallas el estado de marcas, la espera y el bloqueo, que hoy vive
     en un solo sitio;
   - los portales a nodos que da el marco mueven solo **dónde** se pinta, no **quién** tiene el
     estado.
3. **Usar `Sheet`** (`components/ui/sheet.tsx`) para el panel de tablet. Descartada: es un panel
   lateral a toda altura, y el tablero pinta una tarjeta flotante anclada sobre el pie, junto a los
   botones.
4. **Usar `Popover`** anclado al botón flotante. Descartada:
   - el posicionador ancla el panel al disparador y no da el panel a todo el ancho del teléfono
     (R30);
   - no trae el fondo que cierra al tocar fuera.

   `Dialog` da las dos cosas con `className`.
5. **Ocultar la columna o el panel con `useIsMobile`** (JS) en vez de container queries.
   Descartada:
   - mide la ventana y no el contenedor;
   - en el servidor no sabe el ancho, así que el primer render no coincidiría con el del cliente;
   - el marco ya es `@container`.

## 9. Riesgos

- **Portales y primer render.** Hasta que el marco monta sus nodos, `StepReader` no pinta
  progreso ni botones: es un frame. Se acepta. Un test comprueba que, con los nodos, todo está
  en su sitio tras el primer efecto.
- **Doble montaje del contenido de una sección** con el panel abierto. Está acotado: los tests
  usan testids por contenedor y la unidad elegida está subida a la pantalla (§3.3, §3.5).
