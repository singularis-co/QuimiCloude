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

## Tanda 3 — T9 Pantalla de empaque (frontend_dev)

**Archivos**

- `app/(private)/asignacion/empaque/[id]/components/packing-order-screen.tsx`:
  - cabecera con `phaseLabel` «Empaque», `running` «Empacando» si `canFinish`, `back` sin `disabled` y chip `packing-order-quantity` («Cantidad <cifra> <unidad>») en `quantity`;
  - una sola sección, Envases (`key: 'materials'`, `PackageIcon`, contador = líneas del reparto), con `useOperatorSidePanels`. Lleva el contenido de hoy: líneas con `EntityImage`, «Sin presentación» y el aviso de reparto pendiente. Se quita el `h2` «Reparto», porque el título lo pone la tarjeta. Rejilla `@min-[1001px]:grid-cols-[320px_minmax(0,1fr)]`;
  - pie de un botón centrado (`mx-auto max-w-[360px]`): «Comenzar el empaque» o «Terminar el empaque», que sin unidad queda deshabilitado con `aria-describedby` a la nota. Con pasos, `StepReader` con `slots` (`progressSlotRef`/`footerSlotRef` en estado) y `finishLabel` «Terminar el empaque». A nombre de otra persona, el pie lleva solo `<p role="status" data-testid="packing-order-footer-reason">` con `packerLabel`, y se conserva el `Notice` `packing-order-packer`;
  - «Revisa antes de comenzar» (`packing-order-not-started`): `Card` discontinua con `h3` y el texto del tablero, sin número de pasos;
  - sin `stepNote`, como dice §3.2. Mismas acciones y diálogos.
- `app/(private)/asignacion/empaque/[id]/components/index.ts`: exporta `PACKING_ORDER_FOOTER_REASON_TESTID`, `PACKING_ORDER_NOT_STARTED_TESTID`, `PACKING_ORDER_SECTIONS_TESTID` y `PACKING_ORDER_PACKAGES_TESTIDS`.
- `tests/unit/asignaciones-ui/packing-order-screen.test.tsx`:
  - se ajustan los casos que fijaban el diseño anterior: los dos botones del pie (R29/R31 de QC-265), la vuelta deshabilitada, la rejilla de 300/1101, el `h2` «Reparto», «Cantidad:» y la posición dentro de `packing-order-steps`;
  - se añade el describe «QC-291 — el empaque con la cabecera, el pie y la columna nuevos».
- `PACKING_ORDER_TEXTS`:
  - cambian `start`/`finish` a «Comenzar el empaque»/«Terminar el empaque» y `quantity` a «Cantidad»;
  - se añaden `phase`, `running`, `packages`, `startTitle` y `startBody`;
  - se quita `distribution`, que ya no se usa.

**Interpretación a revisar:** R17 dice «MIENTRAS la pantalla no esté comenzada por el actor». La tarjeta sale también con `EN_EMPAQUE` a nombre de otra persona, junto al aviso de quien empaca.

**Mapa R → test** (`tests/unit/asignaciones-ui/packing-order-screen.test.tsx`, describe «QC-291 — …» salvo que se indique)

- R2: «R2: la cabecera pinta «Empaque · número»…», «R2: un único chip «Cantidad <cifra> <unidad>»…», «R2: sin unidad, el chip lleva solo la cifra»
- R3: «R3: sin comenzar, la cabecera lleva «Volver a «Por empacar»» habilitado…»
- R4: «R4: comenzado por el actor (sin pasos|con pasos), no hay vuelta y la línea de estado dice «Empacando»»
- R5: «R5: a nombre de otra persona, la vuelta sigue habilitada y no hay «Empacando»»
- R8: «R8: sin comenzar, el pie tiene un único botón «Comenzar el empaque»…», «R8: mientras comienza, el botón queda deshabilitado y ocupado…»
- R9: «R9: con pasos, el pie lleva «Anterior» y «Siguiente»…», «R9: en el último paso, el pie dice «Terminar el empaque»…»; también «QC-291 R9: con pasos, el pie es el del paso a paso…» (describe de pasos)
- R10: «R10: comenzado sin pasos, el pie tiene un único botón «Terminar el empaque»…», «R10: sin unidad, el único botón queda deshabilitado con el motivo visible y asociado»
- R17: «R17: sin comenzar, el contenido muestra «Revisa antes de comenzar»…», «R17: comenzado por el actor, la tarjeta no aparece»
- R20: «R20: (sin comenzar|comenzado|de otra persona), la columna tiene solo Envases, en ámbar, sin Equipo ni Herramientas», «R20: la rejilla pasa a dos columnas, 320 px…»
- R25: «R25: Envases lleva las líneas con imagen…», «R25: sin reparto, Envases dice «Sin presentación»…», «R25: el panel de Envases muestra el mismo reparto»
- R32: «R32: Comenzar llama a startPackingAction con el estado inicial y solo el id del pedido», «R32: Terminar llama a finishPackingAction con el estado inicial, el id y las líneas del conteo»
- R33: «R33: a nombre de otra persona (%s), el pie no tiene botones y solo dice quién empaca» (×3, con y sin pasos), «R33: el motivo del pie no sale si el actor puede actuar»

**Verificación**

- `pnpm run typecheck`: sin errores. En una primera pasada salió un TS2322 en `conditioning-order-screen.test.tsx:265`, archivo de T10 en paralelo; en la segunda ya no estaba.
- `pnpm run lint`: `✖ 10 problems (0 errors, 10 warnings)`; ninguno en archivos de T9.
- `pnpm exec vitest run tests/unit/asignaciones-ui/packing-order-screen.test.tsx`: `Test Files 1 passed (1) · Tests 84 passed (84)`.
- `pnpm exec vitest related --run <los 3 archivos de T9>`: `Test Files 1 failed | 7 passed (8) · Tests 13 failed | 237 passed (250) · Snapshots 13 failed`. Los 13 rojos están todos en `tests/unit/paridad/asignacion-acondicionamiento-paridad.test.tsx`: 4 son de «paridad del empaque», por este cambio, y 9 de acondicionamiento (T1/T7/T10). No se regeneraron: lo hace el implementer.

**Veredicto:** T9 hecha; sus tests están en verde y solo quedan las snapshots de paridad, que el implementer regenera.

## Tanda 3 — T10 Pantalla de acondicionamiento (frontend_dev)

**Archivos**

- `app/(private)/asignacion/acondicionamiento/[id]/components/conditioning-order-screen.tsx`: pasa a `'use client'` (usa `useOperatorSidePanels`). Importa por archivo, no por el barrel de `/asignacion`. Cabecera con `phaseLabel` «Acondicionamiento», `running` «Acondicionando» si `canFinish` y `back` sin `disabled`, chip «Cantidad <cifra> <unidad>» (`quantity`) y la insignia de hoy. Columna y capa con Envases (`materials`, `OrderDistributionFull withImages`, contador = líneas del reparto) y Equipo (`team`, solo si hay equipo, con `actorId`). En el contenido: el error de candidatos, `Notice` «Lo acondiciona …», la tarjeta «Revisa antes de comenzar» (`conditioning-order-not-started`) y «Datos de lote». `conditioningBlockedReason` calcula el motivo de R33.
- `.../conditioning-actions.tsx`: un solo botón según el estado («Comenzar el acondicionamiento» / «Terminar el acondicionamiento»), o ninguno con `blockedReason`, que pinta `<p role="status" data-testid="conditioning-actions-reason">`. Textos de P11 en `CONDITIONING_ACTIONS_TEXTS`.
- `.../components/index.ts`: exporta los testids nuevos y `conditioningBlockedReason`.
- `.../page.tsx`: pasa `actorId={actor.id}`. El actor ya estaba en la página: nada de `lib/modules/`.
- Tests: `conditioning-order-screen.test.tsx` reescrito; `conditioning-order-page.test.tsx` ajustado al pie nuevo, más un caso de `actorId`.

**Interpretaciones y abiertos**

- R17: la tarjeta «Revisa antes de comenzar» se pinta solo en `POR_ACONDICIONAR`. Leído al pie de la letra («no comenzada por el actor»), saldría también en `TERMINADO`, `ENTREGADO` y a nombre de otro, con un texto que habla de comenzar. Que lo confirme el leader.
- R33, abierto: un `EN_ACONDICIONAMIENTO` de otra persona con `conditionedByName === null` deja el pie vacío, sin botón y sin motivo. P11 no aprueba un texto para «quien acondiciona desconocido», y no lo inventé.
- El aviso «Faltan los datos de lote…» del pie sale solo con `canFinish`. En `TERMINADO`/`ENTREGADO` el pie lleva solo el motivo (R33).

**Mapa R → test** (`tests/unit/asignaciones-ui/conditioning-order-screen.test.tsx`)

- R2: «R2: fase y número, receta como único h1, chip «Cantidad» y estado; sin reparto ni «Lo acondiciona» en la cabecera»; «R2: sin unidad el chip dice solo «Cantidad <cifra>»».
- R3: «R3: en %s la cabecera lleva el enlace de vuelta habilitado «%s»» (×3).
- R4: «R4: comenzado por el actor, no hay vuelta (ni deshabilitada) y la línea de estado dice exactamente «Acondicionando»».
- R5: «R5: en curso a nombre de otra persona, la vuelta está habilitada y no hay línea «Acondicionando»».
- R8: «R8: sin comenzar y con candidatos, un único botón «Comenzar el acondicionamiento», centrado, que abre el diálogo de hoy».
- R10: «R10: comenzado por el actor, un único botón «Terminar el acondicionamiento»…»; «R10: con datos de lote pendientes, «Terminar» va deshabilitado con el motivo visible y asociado por aria-describedby»; «R10: «Datos de lote» va en el contenido principal, no en la columna».
- R11 (extra): «R11: el botón del pie usa el tamaño xl de hoy (52 px)».
- R17: «R17: sin comenzar, el contenido muestra «Revisa antes de comenzar»…»; «R17: comenzado por el actor no hay tarjeta…».
- R20: «R20: la columna pinta solo Envases y Equipo, en ese orden, con el color de su sección; sin Herramientas ni Materiales»; «R20: los contadores son las líneas del reparto y las personas del equipo».
- R23: «R23: en %s Equipo agrupa a las personas sueltas bajo «Personas»…» (×2); «R23: pinta el nombre que trae el equipo…»; «R23: sin equipo no hay tarjeta Equipo ni botón flotante «Ver equipo»; Envases sigue».
- R24: «R24: con actorId, «Tú» va solo en la fila del actor»; «R24: sin actorId, o si el actor no está en el equipo, no hay ninguna marca «Tú»». En `conditioning-order-page.test.tsx`: «QC-291 R24: pasa el actor de la sesión a la pantalla…».
- R25: «R25: Envases muestra el reparto de hoy…»; «R25: sin reparto, Envases dice «Sin presentación»»; «R25: el panel de envases lleva el mismo reparto».
- R26: «R26: «Lo acondiciona <nombre>.» va en el contenido principal, fuera de la cabecera»; «R26: sin quien lo acondicione no se pinta la frase».
- R32: «R32: ni la página ni la pantalla son Server Actions…» (ahora incluye `conditioning-actions.tsx`); «R32: el modal de comenzar recibe los mismos candidatos y el pedido de hoy».
- R33: «R33: %s el pie no lleva ningún botón y solo la línea del motivo» (×4: a nombre de otro, `TERMINADO`, `ENTREGADO`, sin candidatos); «R33: sin candidatos el error del catálogo se sigue pintando en role="alert"».

**Verificación**

- `pnpm run typecheck`: exit 0.
- `pnpm run lint`: `✖ 10 problems (0 errors, 10 warnings)`; ninguno en archivos de T10.
- `pnpm exec vitest run tests/unit/asignaciones-ui/conditioning-order-screen.test.tsx`: `Test Files 1 passed (1) · Tests 52 passed (52)`.
- `pnpm exec vitest run tests/unit/asignaciones-ui/conditioning-order-page.test.tsx`: `Test Files 1 passed (1) · Tests 20 passed (20)`.
- `pnpm exec vitest related --run <los 4 archivos de T10 y sus 2 tests>`: `Test Files 1 failed | 7 passed (8) · Tests 13 failed | 147 passed (160) · Snapshots 13 failed`. Los 13 rojos son todos snapshots de `tests/unit/paridad/asignacion-acondicionamiento-paridad.test.tsx` (9 de acondicionamiento y 4 de empaque). No se regeneraron.
- E2E sin tocar (T12): `acondicionamiento.spec.ts:463-465`, `acondicionar-con-equipo.spec.ts:283-286` y `:477`, y `operario-rediseno.spec.ts` siguen buscando «Acondicionar»/«Terminar».

**Veredicto:** T10 hecha; sus tests están en verde y solo quedan las snapshots de paridad, que regenera el implementer.

## Tanda 3 — T8 Pantalla de fabricación (frontend_dev)

**Archivos**

- `app/(private)/asignacion/[id]/components/order-execution-screen.tsx`: `phaseLabel` «Fabricación»; `running` «Fabricando» con el pedido en curso, que sustituye a `back` (la vuelta solo sin comenzar); `StatusBadge` `order-execution-status` con `ORDER_STATUS_*`; chip «Cantidad <cifra> <unidad>» en `quantity` (testid `order-execution-order-quantity` y su `title` exacto). Fuera `order-execution-presentation`, `ORDER_EXECUTION_PRESENTATION_TESTID` y `ORDER_EXECUTION_TEXTS.presentation` (D11). Secciones con `useOperatorSidePanels`: Materiales y luego Herramientas, esta solo si hay; `columnTestId` `order-execution-materials`; rejilla `@min-[1001px]:grid-cols-[320px_minmax(0,1fr)]`. Testids de tarjeta conservados (`order-execution-materials-panel*`, `order-execution-tools-panel*`), y botones flotantes nuevos `order-execution-materials-fab` y `order-execution-tools-fab` (`ORDER_EXECUTION_*_SECTION_TESTIDS`). Unidad elegida en un `Map` del estado de la pantalla, que se pasa a `OrderExecutionLines` (`selectedUnitIds`/`onSelectUnit`). Sin comenzar: `Card` «Revisa antes de comenzar» con borde discontinuo, `h3`, el `startBody` del tablero y «N pasos» (testid `order-execution-not-started`). `StepReader` con `slots` (nodos en estado por callback ref), sin `stepNote`, con `finishLabel` «Terminar la fabricación». Pie «Comenzar la fabricación», centrado y `max-w-[360px]`; el diálogo, la acción y el `disabled` son los mismos.
- `app/(private)/asignacion/[id]/components/order-execution-tools.tsx`: el id del título sale de `useId` (antes era el fijo `order-execution-tools-heading`, que se repetía con el panel abierto). Nueva prop opcional `label` (`aria-label`, sin título propio) porque la pantalla no conoce el id del título de la tarjeta. Pasa a `'use client'` por el hook. Sin `label` ni `labelledBy`, se ve igual que antes.
- `app/(private)/asignacion/[id]/components/index.ts`: fuera los exports de `order-execution-tools-panel` y de `ORDER_EXECUTION_PRESENTATION_TESTID`; entran `ORDER_EXECUTION_MATERIALS_TESTID`, `ORDER_EXECUTION_MATERIALS_SECTION_TESTIDS`, `ORDER_EXECUTION_TOOLS_SECTION_TESTIDS` y `ORDER_EXECUTION_STATUS_TESTID`.
- Borrados: `app/(private)/asignacion/[id]/components/order-execution-tools-panel.tsx` y `tests/unit/asignaciones-ui/order-execution-tools-panel.test.tsx` (con `git rm`: el borrado está en el índice y no hay commit).
- `tests/unit/asignaciones-ui/order-execution-screen.test.tsx`: «Pedido» pasa a «Cantidad». Se borran los casos de la presentación (QC-170 R26/R27, R26 «sin control», R44 envase), porque D11 la quita. El pie se comprueba dentro del pie del marco y no `fixed`. Los objetivos táctiles admiten `size-14` (botones flotantes) y la tarjeta `min-h-15` de la casilla. El caso de la lista cerrada de QC-125 R18 queda igual. Casos nuevos: R2, R3, R4, R8, R9, R17, R20, R21, R22, R32 y R34.
- `tests/unit/asignaciones-ui/order-execution-page.test.tsx`: el caso EN_CURSO esperaba la vuelta deshabilitada; ahora comprueba R4.
- `tests/unit/asignaciones-ui/order-execution-tools.test.tsx`: casos de `label` y de dos copias sin ids repetidos.

**Mapa R → test** (`tests/unit/asignaciones-ui/order-execution-screen.test.tsx`, salvo que se indique otro)

- R2: «R2: la cabecera pinta «Fabricación · <número>» con el número en su elemento, un único chip «Cantidad» y la insignia de estado»; «R2: sin comenzar, la insignia dice «Pendiente»»; «R2: no hay `order-execution-presentation` ni «Presentación:» en ningún punto, sin comenzar ni comenzada».
- R3: «R3: PENDIENTE: la vuelta es un enlace habilitado a la lista de pedidos asignados, sin línea «Fabricando»».
- R4: «R4: EN_CURSO: la cabecera no lleva la vuelta, ni deshabilitada, sino «Fabricando» con role="status"»; «R4: confirmar comienza el pedido y pinta la ejecucion…»; `order-execution-page.test.tsx` «R4: EN_CURSO retoma sin «Comenzar», sin la vuelta y con «Fabricando»».
- R8: «R8: PENDIENTE pinta en el pie un único botón «Comenzar la fabricación», centrado…».
- R9: «R9: «Anterior» y «Siguiente» van en el pie del marco…»; «R9: en el último paso el pie ofrece «Terminar la fabricación»…»; «R9: el progreso del paso va en la cabecera».
- R17: «R17: PENDIENTE pinta «Revisa antes de comenzar» con su texto y el número de pasos, sin listarlos»; «R17: con un solo paso dice «1 paso»».
- R20: «R20: la columna lleva solo Materiales y Herramientas, en ese orden…»; «R20: los botones flotantes son los de Materiales y Herramientas, en ese orden, sin Equipo»; «R20: la lista de herramientas toma el nombre de su tarjeta…»; «R20: con el panel de herramientas abierto, cada copia de la lista tiene su nombre y no hay ids repetidos».
- R21: «R21: sin herramientas no hay tarjeta Herramientas ni su botón flotante».
- R22: «R22: la unidad elegida en la columna sale en el panel, y la del panel sigue al cerrarlo y reabrirlo»; «R22: plegar y desplegar la tarjeta de materiales conserva la unidad».
- R32: «R32: comenzar llama a startAssignedOrderAction con el id del pedido, tras el mismo diálogo»; «R32: cambiar de paso registra el movimiento y terminar envía orderId y la posición del paso»; «R32: el menú de la cabecera sigue ofreciendo «Cancelar pedido»». Siguen además los casos de espera, bloqueo, errores y confirmación de antes.
- R34 (fabricación): «R34: la fabricación no pasa nota de seguridad: no hay bloque de nota».

**Pendiente para T12 (E2E, no se tocó)**

- `e2e/recetas-porcentaje.spec.ts:574` espera `Pedido 200`; ahora el chip dice `Cantidad 200`.
- `e2e/envases-del-pedido.spec.ts:151` (`order-execution-presentation`): es la comprobación que borra D11.
- `e2e/operario-rediseno.spec.ts` usa `order-execution-materials` y `order-execution-materials-panel-trigger`, que se conservan.

**Verificación**

- `pnpm run typecheck`: el único error es `tests/unit/asignaciones-ui/conditioning-order-screen.test.tsx(265,35)` (TS2322, `candidatesError`), archivo de T10; ninguno en archivos de T8.
- `pnpm run lint`: `✖ 10 problems (0 errors, 10 warnings)`, los mismos de antes; ninguno en archivos de T8.
- `pnpm exec vitest related --run <screen, tools, index.ts y sus 3 tests>`: `Test Files 9 passed (9) · Tests 202 passed (202)`.
- `pnpm exec vitest run guard`: `Test Files 80 passed (80) · Tests 1096 passed | 20 skipped (1116)`.
- No se corrió `vitest -u` en `tests/unit/paridad/`.

**Veredicto:** T8 hecha; sus tests están en verde, y los E2E de la pantalla quedan para T12.

## Tanda 3 — cierre del implementer (T8, T9, T10)

- Snapshots de paridad regenerados por el implementer después de T8-T10:
  `pnpm exec vitest run tests/unit/paridad/asignacion-acondicionamiento-paridad.test.tsx -u`.
  Salida: `Snapshots 13 updated · Test Files 1 passed (1) · Tests 37 passed (37)`.
- `pnpm run typecheck` limpio. `pnpm run lint`: `✖ 10 problems (0 errors, 10 warnings)`, ninguno
  en archivos de la feature.
- **Abierto A1 (para el reviewer o el humano): R17 se lee distinto en empaque y en
  acondicionamiento.** El texto de R17 dice «MIENTRAS la pantalla no esté comenzada por el actor».
  - Empaque (T9) lo aplica al pie de la letra: también sale con el empaque en curso a nombre de otra
    persona.
  - Acondicionamiento (T10) solo lo pinta en `POR_ACONDICIONAR`. No sale en `TERMINADO`, en
    `ENTREGADO` ni en curso a nombre de otra persona, porque su texto habla de comenzar.

  No se unificó: decide el humano.
- **Abierto A2: R33 sin nombre.** Acondicionamiento en `EN_ACONDICIONAMIENTO`, a nombre de otra
  persona y con `conditionedByName === null`: el pie queda vacío, sin botón y sin motivo. P11 no
  trae un texto para «persona desconocida» y no se inventó.
- **Props extra, sin cambio visible para los usos de hoy:**
  - `columnTestId?` en `useOperatorSidePanels` (T6).
  - `label?` en `OrderExecutionTools` (T8), para que la tarjeta no repita «Herramientas».
- `order-execution-page.test.tsx` y `conditioning-order-page.test.tsx` se ajustaron a R4 y a R33.
  Fallaban con el cambio aunque no estaban en la lista de las tasks.
