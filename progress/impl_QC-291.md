# QC-291 — bitácora de implementación

## Estado (implementer, 2026-10-16) — PARADO en tanda 1 por dos contradicciones spec/código

Hechas: T1, T2, T4, T5, T7. Sin empezar: T6, T8–T13 (esperan a las decisiones de abajo).

**Bloqueo B1 — T3: los colores de `design.md §3.3` no pasan el 4.5:1 que exige el «Hecho» de T3.**
Recalculado por el implementer (OKLCH → sRGB → luminancia WCAG, la fórmula de
`tests/unit/theme/contraste.ts`), texto `--section-foreground` sobre cada fondo:

| Token | Claro | Oscuro |
|---|---|---|
| `--section-materials` `oklch(0.6 0.15 55)` | **4.03** (falla) | 6.29 |
| `--section-tools` `oklch(0.55 0.15 255)` | 4.76 | 5.57 |
| `--section-team` `oklch(0.55 0.13 160)` | **4.39** (falla) | 5.92 |

El título de la tarjeta es 16 px semibold, así que no aplica el umbral de texto grande (3:1).
Cambio mínimo que pasa (frontend_dev, mismo croma y tono): materials claro L ≤ 0.57 (4.56) y team
claro L ≤ 0.54 (4.57). Decide el humano: o cambiar los valores (y el tablero) o el umbral.
`app/globals.css` y `section-tones.test.ts` no se tocaron. T4 no depende de los valores: usa los
nombres de los tokens.

**Bloqueo B2 — lista cerrada de QC-125 contra §3.2.**
`tests/unit/asignaciones-ui/order-execution-screen.test.tsx` («R18 — el asistente heredado solo
puede cambiar step-reader.tsx (lista cerrada)») tiene
`PERMITIDOS = ['components/shared/step-reader/step-reader.tsx']`, aprobada en QC-125. §3.2 de este
spec exige cambiar también `step-document-view.tsx` (`variant`) e `index.ts` (exportar
`StepProgress`). El spec no menciona esa lista. Hoy ese caso sale rojo. Arreglo probable: ampliar
`PERMITIDOS` con esos dos archivos, pero eso relaja una regla aprobada por el humano en otra ficha.
Decide el humano.

**Pendiente conocido para T10** (no es bloqueo):
- `conditioning-order-screen.test.tsx`: R25 (×2) y R33 en rojo por el cambio de
  `ConditioningTeamList` (T7). Ya no hay `h2` «Equipo», `+N` ni `responsible-avatar`, como dice §3.6.
- `actorId` no está cableado (screen y `page.tsx`).
- La paridad `asignacion-acondicionamiento-paridad` tiene 13 snapshots de pantalla en rojo. Se
  regeneran al cerrar T1, T9 y T10. Ya se regeneraron las 2 de la lista de equipo.
- Nota de T7: el testid `conditioning-team-list-member` y su `data-user-id` pasan del `li` al
  `span` del nombre, para que su texto siga siendo exactamente el nombre
  (`e2e/acondicionar-con-equipo.spec.ts:486-495`). La fila entera es `conditioning-team-list-row`.

Rojos ajenos vistos en `vitest related`: `tests/unit/marca/tablas-marca.test.tsx` es inventario,
fuera de la feature. `formula-import-review.test.tsx`, `packing-finish-dialog.test.tsx` R13 y
`session-once-per-request-render` fallan por timeout con la máquina cargada.

## T1 — Marco con scroll interno y cabecera nueva (frontend_dev)

- Modificado: `app/(private)/asignacion/components/operator-screen-frame.tsx`. Raíz
  `h-dvh flex flex-col overflow-hidden relative`, zona `operator-scroll` y pie en flujo. Props
  `phaseLabel`, `running`, `quantity`, `progressSlotRef`, `footerSlotRef` y `overlay`. Se retiran
  `STEP_READER_SIDE_COLUMN_RESERVE` y la reserva `pb-[calc(132px…)]`. `back.disabled` se mantiene
  hasta T9 y T10.
- Imports de la reserva retirados en `order-execution-screen.tsx` y `packing-order-screen.tsx`.
- Tests: se reescribió `operator-screen-frame.test.tsx`. En `order-execution-screen.test.tsx` y
  `packing-order-screen.test.tsx` se quitaron los casos de la reserva de QC-269 (§3.1), y
  `min-h-dvh` pasa a ser «R1: … usa h-dvh».
- R1 → «R1: la raíz ocupa el alto de la ventana y no hace scroll; solo la zona central lo hace»,
  «R1: el pie va en flujo, sin position fixed…», «R1: el marco ya no exporta la reserva…»,
  «R1: overlay va dentro de la raíz…».
- R2 → «R2: pinta la fase y el número…», «R2: sin phaseLabel…», «R2: el h1 mide 30 px / 700…»,
  «R2: el chip de cantidad y la insignia…», «R2: la cabecera sigue siendo pegajosa arriba».
- R3 → «R3: sin running, pinta el enlace de vuelta habilitado…».
- R4 → «R4: con running no hay enlace de vuelta… y la línea de estado dice exactamente su texto».
- R5 → «R5: a nombre de otro (sin running)…».
- R7 → «R7: la cabecera conserva «Cambiar tema» de 44 px…».
- Extra: R9 «footerSlotRef y progressSlotRef dan un nodo…» y R11 «la cabecera reserva el margen
  seguro…».

## T4 — Tarjeta plegable con `tone`, trasladada (frontend_dev)

- Creado: `app/(private)/asignacion/components/order-execution-collapsible-card.tsx`. Exporta
  `OperatorSectionTone` y `OPERATOR_SECTION_TONE_CLASSES`.
- Borrado: el archivo en `[id]/components/`.
- Import ajustado en `order-execution-tools-panel.tsx`. El barrel `[id]/components/index.ts` no
  exportaba la tarjeta: sin cambio.
- R20 → `tests/unit/asignaciones-ui/order-execution-collapsible-card.test.tsx`:
  «R20: con tone=%s la cabecera lleva %s…» (×3), «R20: sin tone la cabecera se ve como hoy…»,
  «R20: abierta al entrar…».

## T5 — Selector de unidad controlable (frontend_dev)

- `order-execution-lines.tsx`: `selectedUnitIds?` y `onSelectUnit?` opcionales. Sin el mapa sigue
  como hoy.
- R22 → `order-execution-lines.test.tsx`: «R22: dos listas con el mismo mapa muestran la misma
  unidad tras elegir en una», «R22: la unidad elegida sobrevive a desmontar y volver a montar…».
  Los casos no controlados siguen sin cambios y en verde.

## T7 — `ConditioningTeamList` (frontend_dev)

- `conditioning-team-list.tsx`: un `ul` con grupos y su contador, «Personas», filas de 44 px o más
  con `Avatar` de 36 px (`aria-hidden`) y «Tú» solo en la fila del actor. `actorId?` es opcional.
- El barrel `acondicionamiento/[id]/components/index.ts` exporta los nuevos testids.
- Paridad: se regeneraron solo las 2 snapshots de «la lista de equipo». El `.tsx` no cambia.
- R23 → `conditioning-team-list.test.tsx`: «R23: agrupa a las sueltas bajo «Personas»…»,
  «R23: cada persona lleva un avatar oculto a lectores…», «R23: la fila no muestra rol…».
- R24 → «R24: con el actor en el equipo, «Tú» va solo en su fila», «R24: %s no hay ninguna marca
  «Tú»» (×3).

**Verificación de la tanda 1 (implementer):** `pnpm run typecheck`, limpio. `pnpm run lint`:
`✖ 10 problems (0 errors, 10 warnings)`, ninguno en archivos de la feature. Los tests propios de
cada task están en verde. La salida de `vitest related` de cada subagente está arriba, en T2.

## T2 — `StepReader` con `slots` y `stepNote`; `StepDocumentView` con `variant` (frontend_dev)

**Archivos modificados**

- `components/shared/step-reader/step-reader.tsx`: props `slots` y `stepNote`; `StepProgress`
  exportado; con `slots`, progreso y pie por `createPortal`, insignia «N de M», porcentaje,
  contador «Comprueba · X de Y» y nota con `role="note"`. Sin `slots` el árbol no cambia.
- `components/shared/step-reader/step-document-view.tsx`: props `variant` y `checklistHeader`.
- `components/shared/step-reader/index.ts`: exporta `StepProgress`.
- `components/shared/CATALOGO.md`: solo las filas `StepReader`/`StepProgress` y `StepDocumentView`.
- `tests/unit/recetas-ui/step-reader.test.tsx`: un `describe` nuevo al final, y `StepProgress` y
  `StepReaderProps` añadidos al import del barrel. Los casos existentes no se tocaron.

**Mapa R → test** (`tests/unit/recetas-ui/step-reader.test.tsx`, describe «pantalla del operario: slots y stepNote»)

- R6: «R6: con slots, la barra, «Paso N de M» sin nombre de paso y el porcentaje van al nodo de progreso»; «R6: StepProgress sale por el barrel…»
- R9: «R9: con slots, el motivo y los botones van por portal al pie…»; «R9: en el último paso el pie lleva el texto de terminar…»; «R9: mientras un nodo es null no se pinta esa parte…»
- R12: «R12: el paso abre con la insignia «N de M», sin título de paso ni «En este paso usas»»; «R12: el title del lector sigue siendo el h2 de la sección…»
- R13: «R13: cada comprobación es una tarjeta de 60 px que se marca y desmarca…»
- R14: «R14: «Comprueba» y el contador «X de Y»…»; «R14: un paso sin elementos no pinta…»; «R14: con varias listas en el paso…»
- R15: «R15: con slots, el anillo y la cuenta van dentro de Siguiente en el pie…»; «R15: con slots, en el último paso la cuenta va dentro del botón de terminar»
- R16: «R16: con slots, los párrafos van en letra de entrada…»
- R18: los casos existentes, sin cambios, en verde; además «R18: en "ejecucion" sin slots, el paso no lleva insignia…»
- R34: «R34: con stepNote, la nota del paso va debajo de las comprobaciones…»; «R34: sin stepNote, con null o con cadena vacía…»; «R34: la nota sigue al paso actual…»

**Verificación**

- `pnpm run typecheck`: exit 0.
- `pnpm exec eslint components/shared/step-reader tests/unit/recetas-ui/step-reader.test.tsx`: sin salida (limpio).
- `pnpm exec vitest run tests/unit/recetas-ui/step-reader.test.tsx`: `Test Files 1 passed (1) · Tests 113 passed (113)`.
- `pnpm exec vitest run tests/guards/guard-catalogo-de-componentes.test.ts`: `Tests 59 passed (59)`.
- `pnpm exec vitest related --run <archivos de T2>`: `Test Files 4 failed | 41 passed (45) · Tests 16 failed | 968 passed (984) · Snapshots 13 failed`. Los rojos que no son de T2:
  - `tests/unit/paridad/asignacion-acondicionamiento-paridad.test.tsx` (13 snapshots): los diffs son del marco y de la lista de equipo de las tareas en paralelo (`max-w-[1064px]` → `max-w-[720px]`, líneas de reparto). T2 no cambia el DOM sin `slots`.
  - `tests/unit/marca/tablas-marca.test.tsx` (`product-columns.tsx`): del inventario, ajeno a esta feature.
  - `tests/unit/recetas-ui/formula-import-review.test.tsx`: se pasó del tiempo límite de 20 s con la máquina cargada.
- **Abierto, contradicción entre código y spec:** `tests/unit/asignaciones-ui/order-execution-screen.test.tsx` › «R18 — el asistente heredado solo puede cambiar step-reader.tsx (lista cerrada)» tiene `PERMITIDOS = ['components/shared/step-reader/step-reader.tsx']` (QC-125, ratificado por el humano). El design de QC-291 §3.2 pide cambiar también `step-document-view.tsx` (`variant`) e `index.ts` (`StepProgress`), así que el caso queda en rojo. No lo toqué: el archivo es de T8 y otro agente lo está editando. Ampliar la lista necesita una decisión del humano o del leader.

**Veredicto:** T2 hecha y verde en su propio test; queda en rojo la lista cerrada heredada de `order-execution-screen.test.tsx`, que necesita una decisión.

## Tanda 2 — T3 (tokens de sección) y B2 (lista cerrada de QC-125)

**Archivos**

- `app/globals.css`: `--section-materials`, `--section-tools`, `--section-team` y `--section-foreground` al final de `:root` y de `.dark` (valores de design.md §3.3, con B1), y sus `--color-section-*` en `@theme inline`.
- `tests/unit/asignaciones-ui/section-tones.test.ts` (nuevo): reutiliza `tests/unit/theme/contraste.ts`.
- `tests/unit/asignaciones-ui/order-execution-screen.test.tsx`: solo `PERMITIDOS` del caso «R18 — el asistente heredado solo puede cambiar step-reader.tsx (lista cerrada)», con `step-document-view.tsx` e `index.ts` (B2, aprobado por el humano).
- La tarjeta de T4 usa `bg-(--section-<tone>)` y `text-(--section-foreground)`: nombran las variables, que ahora existen. Sin cambios.

**Mapa R → test** (`tests/unit/asignaciones-ui/section-tones.test.ts`)

- R20: «R20: los cuatro tokens existen en :root y en .dark con los valores de design.md §3.3»; «R20: cada token tiene su utilidad en @theme inline»; «R20: el texto de sección contrasta al menos 4.5:1 sobre cada fondo, en claro y en oscuro»; «R20: la tarjeta con tono solo nombra tokens de sección que existen».
- R18 (QC-125, B2): «R18 — el asistente heredado…» con la lista ampliada.

**Verificación**

- `pnpm run typecheck`: exit 0.
- `pnpm run lint`: `✖ 10 problems (0 errors, 10 warnings)`; ninguno en archivos de esta tanda.
- `pnpm exec vitest run tests/unit/asignaciones-ui/section-tones.test.ts tests/unit/theme`: `Test Files 12 passed (12) · Tests 72 passed (72)`.
- `pnpm exec vitest related --run app/globals.css tests/unit/asignaciones-ui/section-tones.test.ts tests/unit/asignaciones-ui/order-execution-screen.test.tsx`: `Test Files 5 passed (5) · Tests 89 passed (89)`.

**Veredicto:** T3 y B2 hechas y verdes.

## Tanda 2 — T6 `OperatorSidePanels` (frontend_dev)

**Archivos**

- `app/(private)/asignacion/components/operator-side-panels.tsx` (nuevo, `'use client'`): `useOperatorSidePanels({ sections, columnTestId? })` → `{ column, overlay }` (design.md §3.3). Paso 3 de la regla: compone `OrderExecutionCollapsibleCard` (con `tone`), `Button` y `Dialog`; vive en la ruta, sin fila en el catálogo; tablero `OperarioPantalla*.dc.html`.
- `app/(private)/asignacion/components/index.ts`: reexporta la pieza, sus tipos y sus testids.
- `tests/unit/asignaciones-ui/operator-side-panels.test.tsx` (nuevo): incluye los casos vigentes de `order-execution-tools-panel.test.tsx` (contador mono, tarjetas en orden y abiertas, plegar sin desmontar, unidad tras plegar, 52 px). El archivo viejo y su test siguen: los borra T8.

**Notas para T8–T10**

- `columnTestId` es opcional y extra al contrato del design: la fabricación lo pasa como `order-execution-materials` (lo usan el E2E y el test de pantalla).
- El panel va en el portal de Base UI, fuera del `@container` del marco: su corte de 560 px es de ventana (`max-[560px]:`). El marco ocupa toda la ventana (la barra lateral se oculta), así que coincide. La pila sí usa `@max-[560px]:hidden`.
- Base UI no devuelve el foco tras un toque fuera donde `focus()` no admite `preventScroll` (jsdom, Chrome Android); la pieza lo devuelve en `onOpenChangeComplete`.
- `OrderExecutionTools` pinta un id fijo (`order-execution-tools-heading`): con el panel abierto hay dos copias en el DOM. Lo resuelve quien arma la sección (T8).

**Mapa R → test** (`tests/unit/asignaciones-ui/operator-side-panels.test.tsx`)

- R19: «R19 y R27: la columna se oculta en contenedores de 1000 px o menos y la capa en los de más».
- R20: «R20: pinta solo las secciones recibidas, en su orden…»; «R20: el nombre de la columna sale de los títulos de sus secciones»; «R20: cada contador va en su disparador, en mono»; «R20: plegar una tarjeta oculta su contenido sin desmontarlo…».
- R21: «R21: no se pintan ni la tarjeta Herramientas ni su botón flotante».
- R22: «R22: plegar y desplegar los materiales conserva la unidad elegida».
- R27: «R27: un botón redondo de 56 px por sección…»; «R27: en acondicionamiento, Envases y Equipo…».
- R28: «R28: pulsar un botón abre el panel de su sección…» (incluye `aria-expanded` y `aria-controls`); «R28: el panel de materiales lleva el contenido de materiales…».
- R29: «R29: «Cerrar» cierra…»; «R29: Escape cierra…»; «R29: tocar fuera del panel lo cierra…».
- R30: «R30: con un panel abierto la pila se oculta en contenedores de 560 px o menos…».

**Verificación**

- `pnpm run typecheck`: exit 0.
- `pnpm run lint`: `✖ 10 problems (0 errors, 10 warnings)`; ninguno en archivos de T6.
- `pnpm exec vitest run tests/unit/asignaciones-ui/operator-side-panels.test.tsx`: `Test Files 1 passed (1) · Tests 15 passed (15)`.
- `pnpm exec vitest related --run <los 3 archivos>`: `Test Files 3 failed | 36 passed (39) · Tests 17 failed | 533 passed (550)`. Los rojos son de archivos que no usan la pieza: entran solo por el barrel. `paridad/asignacion-acondicionamiento-paridad` (13 snapshots, la pantalla de tanda 1), `conditioning-order-screen` (3, Equipo de T7) y `marca/tablas-marca` (1, `product-columns.tsx`, fuera de la feature).

**Veredicto:** T6 hecha y verde en su test; los rojos de `related` vienen de antes y no los toca T6.
