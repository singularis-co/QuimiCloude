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
