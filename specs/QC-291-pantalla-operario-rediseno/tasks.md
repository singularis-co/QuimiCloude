# QC-291 — pantalla-operario-rediseno · tasks

Cada task cierra con `pnpm run typecheck`, `pnpm run lint` y
`pnpm exec vitest related --run <archivos de la task>`. El nombre de cada test lleva su `R<n>`.

**Bloqueos:** ninguno. P1 a P10 están cerradas (D4 a D13, 2026-10-16). P11, el texto de la línea
de motivo, no bloquea: si el spec se aprueba sin cambiarlo, T9 y T10 usan los textos propuestos.

## Tasks

- [x] **T1 — Marco con scroll interno y cabecera nueva.** Depende de: —.
  - Archivos: `operator-screen-frame.tsx` y su test.
  - Raíz `h-dvh flex flex-col overflow-hidden`, zona `operator-scroll` y pie en flujo.
  - Props `phaseLabel`, `running`, `quantity`, `progressSlotRef`, `footerSlotRef` y `overlay`.
  - Se retiran la reserva `pb-[calc(132px…)]` y `STEP_READER_SIDE_COLUMN_RESERVE`, y también su
    import en las dos pantallas.
  - Tamaños de §3.1.
  - **Hecho:** tests R1-R5 y R7 en `tests/unit/asignaciones-ui/operator-screen-frame.test.tsx`. Por
    ejemplo, con `running` no hay enlace de vuelta, sí hay `role="status"` y su texto es exactamente
    el que se pasa, sin hora (R4).

- [x] **T2 [P] — `StepReader` con `slots` y `stepNote`; `StepDocumentView` con `variant`.**
  Depende de: —.
  - Insignia sin título de paso, porcentaje, contador «Comprueba · X de Y», tarjetas de 60 px,
    párrafos de entrada y el hueco de la nota de seguridad (§3.2).
  - La espera no cambia: anillo y cuenta siguen dentro del botón, también cuando el botón se
    pinta por portal en el pie (R15, D13).
  - `StepProgress` sale por el barrel; se actualizan sus filas en
    `components/shared/CATALOGO.md`.
  - **Hecho:**
    - tests R6 (sin nombre de paso), R9 (portal), R12 (sin título ni «En este paso usas»),
      R13, R14, R15 (con `slots`, el anillo está dentro de `step-reader-next` y no hay bloque de
      espera en el contenido), R16 y R34 (con `stepNote` hay `step-reader-note` con
      `role="note"`; sin él, con `null` o con cadena vacía, no hay nada) en
      `tests/unit/recetas-ui/step-reader.test.tsx`;
    - los tests actuales de lectura y de ejecución sin `slots` siguen verdes sin tocarlos (R18).

- [x] **T3 [P] — Tokens de color de sección.** Depende de: —.
  - Cuatro tokens, en claro y en oscuro, en `app/globals.css`, más sus utilidades `@theme`
    (§3.3).
  - **Hecho:** un test en `tests/unit/asignaciones-ui/section-tones.test.ts` (R20) lee
    `app/globals.css` y comprueba:
    - que los tokens existen en `:root` y en `.dark`;
    - que el contraste del texto sobre cada fondo es al menos 4.5:1.

- [x] **T4 [P] — Tarjeta plegable con `tone`, trasladada a `/asignacion`.** Depende de: T3.
  - Se mueve `order-execution-collapsible-card.tsx` a `app/(private)/asignacion/components/`, con
    la prop `tone` (§3.4).
  - Se ajustan los imports y el barrel de `[id]/components/index.ts`.
  - **Hecho:** test R20 (con `tone`, la cabecera lleva la clase del tono; sin `tone`, la de hoy) en
    `tests/unit/asignaciones-ui/order-execution-collapsible-card.test.tsx`.

- [x] **T5 [P] — Selector de unidad controlable.** Depende de: —.
  - `selectedUnitIds` y `onSelectUnit` opcionales en `order-execution-lines.tsx` (§3.5).
  - **Hecho:**
    - test R22 en `tests/unit/asignaciones-ui/order-execution-lines.test.tsx`: dos listas con el
      mismo mapa muestran la misma unidad tras elegir en una;
    - los casos actuales, no controlados, siguen verdes.

- [x] **T6 — `OperatorSidePanels`.** Depende de: T4.
  - Columna, botones flotantes y panel `Dialog` (§3.3). El `aria-label` de la columna sale de los
    títulos de sus secciones. Se exporta en el barrel de
    `app/(private)/asignacion/components/index.ts`.
  - **Hecho:** tests R20, R21, R27-R29 y R30 (clase de ocultar la pila con panel abierto) en
    `tests/unit/asignaciones-ui/operator-side-panels.test.tsx`:
    - se pintan solo las secciones recibidas, en su orden, con un botón flotante por sección;
    - sin herramientas no hay tarjeta ni botón;
    - `aria-expanded`;
    - «Cerrar», Escape y el foco que vuelve al botón.

- [x] **T7 [P] — `ConditioningTeamList` con avatar, «Personas» y «Tú».** Depende de: —.
  - Archivo: `conditioning-team-list.tsx` (§3.6).
  - **Hecho:**
    - tests R23 y R24 en `tests/unit/asignaciones-ui/conditioning-team-list.test.tsx`: iniciales,
      contador por grupo, etiqueta «Personas», ningún rol en la fila y «Tú» solo en la fila del
      actor;
    - el test de paridad `tests/unit/paridad/asignacion-acondicionamiento-paridad.test.tsx` se
      ajusta a la nueva etiqueta.

- [x] **T8 — Pantalla de fabricación.** Depende de: T1, T2, T5 y T6.
  - `order-execution-screen.tsx`:
    - `phaseLabel`, `running` («Fabricando»), insignia de estado y chip «Cantidad»;
    - se borra la presentación: el elemento `order-execution-presentation` y su constante en la
      pantalla y en `[id]/components/index.ts` (D11);
    - secciones Materiales y Herramientas, en ese orden, sin Equipo;
    - «Revisa antes de comenzar» con «N pasos» y sin lista de pasos;
    - `StepReader` con `slots`, sin `stepNote`, y `finishLabel` «Terminar la fabricación»;
    - pie «Comenzar la fabricación» centrado;
    - la unidad elegida, en el estado de la pantalla.
  - Se borra `order-execution-tools-panel.tsx` y su test pasa a T6.
  - **Hecho:** tests R2 (no hay `order-execution-presentation` ni «Presentación:»), R3, R4, R8, R9,
    R17, R20 (solo Materiales y Herramientas), R21, R22 y R32 en
    `tests/unit/asignaciones-ui/order-execution-screen.test.tsx`. R32: las mismas acciones se
    llaman con los mismos argumentos que hoy.

- [x] **T9 — Pantalla de empaque.** Depende de: T1, T2 y T6.
  - `packing-order-screen.tsx`:
    - cabecera, como en T8, con «Empacando»;
    - solo la sección Envases, con el contenido de hoy;
    - pie de un botón (R8, R10) o el del paso a paso (R9), con «Terminar el empaque»;
    - a nombre de otro, ningún botón y solo `packing-order-footer-reason` con el texto de quien
      empaca (R33, §3.7).
  - **Hecho:** tests R2-R5, R8-R10, R17, R20 (solo Envases, sin Equipo ni Herramientas), R25, R32
    y R33 en `tests/unit/asignaciones-ui/packing-order-screen.test.tsx`.

- [x] **T10 — Pantalla de acondicionamiento.** Depende de: T1, T6 y T7.
  - `conditioning-order-screen.tsx`:
    - cabecera, como en T8, con «Acondicionando»;
    - Envases y Equipo en la columna, sin Herramientas;
    - «Lo acondiciona …» en el contenido;
    - «Datos de lote» en el contenido principal;
    - «Revisa antes de comenzar»;
    - el motivo de R33, calculado por estado y pasado a `ConditioningActions`.
  - `conditioning-actions.tsx`: un solo botón según el estado, con los textos nuevos, o ninguno
    con la prop `blockedReason` (§3.7).
  - `page.tsx`: pasa `actorId`.
  - **Hecho:** tests R2-R5, R8, R10, R17, R20 (solo Envases y Equipo), R23 (sin equipo no hay
    tarjeta ni botón), R24-R26, R32 y R33 (en curso a nombre de otro, `TERMINADO`, `ENTREGADO` y
    sin candidatos: ningún `button` en el pie y `conditioning-actions-reason` con su texto) en
    `tests/unit/asignaciones-ui/conditioning-order-screen.test.tsx`.

- [ ] **T11 — E2E nuevo del rediseño.** Depende de: T8, T9 y T10.
  - `e2e/pantalla-operario-rediseno.spec.ts`, a 1440 × 900, 834 × 1112 y 390 × 844. Reutiliza la
    siembra y los helpers de `e2e/operario-rediseno.spec.ts`; si hace falta, se extraen a
    `e2e/helpers/operario.ts`.
  - Comprueba:
    - R1: con el contenido al final, cabecera y pie no se mueven y `document.scrollingElement`
      no se desplaza;
    - R6: barra y «Paso N de M» visibles al final del contenido;
    - R11;
    - R19: dos pistas, la primera de `320px`, a 1440 px;
    - R27-R31: botones de 56 px a 834 px; panel que abre y cierra con X, con toque fuera y con
      Escape; a 390 px, panel de ancho menos 32 px y botones ocultos; último elemento del panel
      alcanzable;
    - R22: la unidad elegida en el panel sigue al reabrirlo.
  - **Hecho:** `pnpm exec playwright test e2e/pantalla-operario-rediseno.spec.ts` en verde.

- [ ] **T12 — Ajustar los E2E existentes y anotar las enmiendas.** Depende de: T8, T9 y T10.
  - La tabla de `design.md > 7`:
    - `e2e/operario-rediseno.spec.ts` (R37 se conserva: el anillo sigue en el botón);
    - `e2e/recetas-porcentaje.spec.ts`;
    - `e2e/envases-del-pedido.spec.ts`: se borra la comprobación «R44: la ejecución nombra los
      envases» (`:624-635`) y se deja la de empaque (D11);
    - `e2e/acondicionar-con-equipo.spec.ts` (`:283-286`) y `e2e/acondicionamiento.spec.ts`
      (`:463-465`): ningún botón y la línea de motivo (D12);
    - `e2e/pasos-de-envasado.spec.ts`.
  - Se corre también la lista «sin cambio previsto» y se corrige lo que falle.
  - Notas de enmienda fechadas, sin reescribir el requisito (`design.md > 1.1`):
    - bajo R44 de `specs/QC-195-envases-del-pedido-como-productos/requirements.md`;
    - bajo R23, R29, R31 y R34 de `specs/QC-265-rediseno-operario/requirements.md`.
  - **Hecho:**
    - cada spec de la lista, en verde con `pnpm exec playwright test <spec>`;
    - las únicas comprobaciones borradas son las que amparan D11 y D12, citadas en
      `progress/impl_QC-291.md`;
    - las dos specs enmendadas llevan su nota.

- [ ] **T13 — Cierre.** Depende de: T1 a T12.
  - `progress/impl_QC-291.md` con:
    - el mapa `R1…R34 → test`;
    - el estado de la verificación en WebKit (`design.md > 6`).
  - `pnpm exec vitest run guard` en verde.
  - **Hecho:** el mapa no tiene huecos y `./init.sh` termina en verde.

## Archivos esperados

- `app/(private)/asignacion/components/operator-screen-frame.tsx`
- `app/(private)/asignacion/components/operator-side-panels.tsx`
- `app/(private)/asignacion/components/order-execution-collapsible-card.tsx`
- `app/(private)/asignacion/components/index.ts`
- `app/(private)/asignacion/[id]/components/order-execution-collapsible-card.tsx`
- `app/(private)/asignacion/[id]/components/order-execution-screen.tsx`
- `app/(private)/asignacion/[id]/components/order-execution-lines.tsx`
- `app/(private)/asignacion/[id]/components/order-execution-tools-panel.tsx`
- `app/(private)/asignacion/[id]/components/index.ts`
- `app/(private)/asignacion/acondicionamiento/[id]/page.tsx`
- `app/(private)/asignacion/acondicionamiento/[id]/components/conditioning-order-screen.tsx`
- `app/(private)/asignacion/acondicionamiento/[id]/components/conditioning-actions.tsx`
- `app/(private)/asignacion/acondicionamiento/[id]/components/conditioning-team-list.tsx`
- `app/(private)/asignacion/empaque/[id]/components/packing-order-screen.tsx`
- `app/globals.css`
- `components/shared/step-reader/step-reader.tsx`
- `components/shared/step-reader/step-document-view.tsx`
- `components/shared/step-reader/index.ts`
- `components/shared/CATALOGO.md`
- `tests/unit/asignaciones-ui/operator-screen-frame.test.tsx`
- `tests/unit/asignaciones-ui/operator-side-panels.test.tsx`
- `tests/unit/asignaciones-ui/order-execution-collapsible-card.test.tsx`
- `tests/unit/asignaciones-ui/order-execution-screen.test.tsx`
- `tests/unit/asignaciones-ui/order-execution-lines.test.tsx`
- `tests/unit/asignaciones-ui/order-execution-tools-panel.test.tsx`
- `tests/unit/asignaciones-ui/conditioning-order-screen.test.tsx`
- `tests/unit/asignaciones-ui/conditioning-team-list.test.tsx`
- `tests/unit/asignaciones-ui/packing-order-screen.test.tsx`
- `tests/unit/asignaciones-ui/section-tones.test.ts`
- `tests/unit/recetas-ui/step-reader.test.tsx`
- `tests/unit/paridad/asignacion-acondicionamiento-paridad.test.tsx`
- `e2e/pantalla-operario-rediseno.spec.ts`
- `e2e/helpers/operario.ts`
- `e2e/operario-rediseno.spec.ts`
- `e2e/recetas-porcentaje.spec.ts`
- `e2e/envases-del-pedido.spec.ts`
- `e2e/acondicionar-con-equipo.spec.ts`
- `e2e/acondicionamiento.spec.ts`
- `e2e/pasos-de-envasado.spec.ts`
- `specs/QC-195-envases-del-pedido-como-productos/requirements.md`
- `specs/QC-265-rediseno-operario/requirements.md`
- `progress/impl_QC-291.md`
