# QC-269 — Defectos de layout del operario tras QC-265 · tasks.md

Hay tres tandas. La 1 son tres arreglos independientes, que pueden ir en paralelo. La 2 es el E2E que
los prueba en navegador. La 3 es el cierre. Cada tanda termina con `./init.sh` en verde.

## Tanda 1 — Producción y unit [T1a, T1b, T1c en paralelo]

- [ ] **T1a [P]. «Entrar» hereda la alineación de su contenedor** (R1–R3, `design.md > 2.2`).
  - En `assigned-order-enter-trigger.tsx`, los dos envoltorios de BLOQUEADO y EN_CURSO dejan de ser
    `flex flex-col items-start gap-1` y pasan a un bloque normal, con el aviso a `mt-1`.
  - Textos, `aria-describedby` y `data-testid` no cambian.
  - Se amplía `assigned-order-enter-trigger.test.tsx`: el envoltorio no lleva `flex` ni `items-*`, y
    el botón y el aviso siguen enlazados por `aria-describedby`.
  - *Hecho:* `pnpm exec vitest related --run` sobre los dos archivos, en verde.
- [ ] **T1b [P]. Reserva del pie en la columna lateral** (R4, R6–R8, `design.md > 4.2`).
  - En `operator-screen-frame.tsx` se crea `STEP_READER_SIDE_COLUMN_RESERVE`, con el literal y el
    comentario de § 4.2.
  - `OrderExecutionToolsPanel` gana `className?: string`, que compone con `cn` sobre su `Card`.
  - `order-execution-screen.tsx` le pasa la constante.
  - En `packing-order-screen.tsx`, la `Card` de la izquierda recibe la constante solo si
    `showsPackingSteps`.
  - Sin envoltorios nuevos, y `StepReader` no se toca.
  - Tests:
    - `operator-screen-frame.test.tsx`: prefijo `@min-[1101px]:` y mismo `calc` que el `pb-[…]` de
      `step-reader` en `mode="ejecucion"`;
    - `order-execution-screen.test.tsx`: la `Card` de materiales lleva la constante;
    - `packing-order-screen.test.tsx`: la `Card` la lleva con pasos y no la lleva sin ellos;
    - el caso R4 de QC-265 (`:653-661`) sigue sin tocarse.
  - *Hecho:* `vitest related` de los cinco archivos, en verde. `git diff --stat` no muestra
    `components/shared/step-reader/`.
- [ ] **T1c [P]. La fila de material no se solapa** (R9, R10, `design.md > 3.2`).
  - En `order-execution-lines.tsx`:
    - el nombre pasa a `min-w-0 flex-[1_1_12rem] break-words` y lleva
      `ORDER_EXECUTION_LINE_NAME_TESTID`;
    - las cifras van en un grupo `flex min-w-0 flex-wrap items-center gap-3`, en el orden actual.
  - La constante se exporta también por `app/(private)/asignacion/[id]/components/index.ts`.
  - Se amplía `order-execution-lines.test.tsx`: `data-testid` del nombre, clase de su base, grupo de
    cifras en orden, y los `data-testid` existentes en sus elementos de siempre.
  - *Hecho:* `vitest related` en verde, y `order-execution-screen.test.tsx` sin cambios en verde.

*Cierre de tanda:* `pnpm run typecheck`, `pnpm run lint` y `./init.sh`, en verde.

## Tanda 2 — E2E (depende de T1a, T1b y T1c)

- [ ] **T2a. Fixture** en el `beforeAll` de `e2e/operario-rediseno.spec.ts` (`design.md > 7`).
  - Productos y recetas:
    - `MANY_LINES = 24` productos con nombres largos, sembrados con `createMany`;
    - receta «muchos materiales»: 24 líneas que sumen 100,00 y un paso de una casilla;
    - receta «paso largo»: una línea al 100 % y un paso de `LONG_STEP_ITEMS = 30` casillas.
  - Pedidos `execMany` (EN_CURSO), `execLongStep` (EN_CURSO) y `execBlocked` (BLOQUEADO), asignados
    al Operador.
  - `deleteCompanyData` borra líneas de receta y productos en el orden de sus FK.
  - *Hecho:* los 17 casos existentes siguen en verde en Chromium.
- [ ] **T2b. Casos nuevos** de `design.md > 7`:
  - `R1, R2, R3 — «Entrar» alineado en sus tres estados`;
  - `R4, R6, R9, R10 — panel con muchos materiales`;
  - `R5 — paso largo`.

  Antes de medir, `waitForScreenEnterToSettle`. Todas las medidas van con 1 px de tolerancia
  (`EDGE_TOLERANCE_PX`).
  *Hecho:*
  - `pnpm exec playwright test e2e/operario-rediseno.spec.ts` en verde en Chromium y WebKit, sin
    saltados;
  - **los casos muerden:** con los arreglos de la tanda 1 retirados un momento (`git stash` solo de
    los archivos de producción), R1, R4 y R9 fallan a 1440 px. El implementer anota el resultado en
    `progress/impl_QC-269.md`;
  - `E2E_ESPERADOS` y `data-table-alcance.test.ts` no cambian.

## Tanda 3 — Cierre (depende de la tanda 2)

- [ ] **T3a. Trazabilidad** en `progress/impl_QC-269.md`, con la tabla de abajo verificada caso a caso.
- [ ] **T3b. Ficha aparte para P1**, si P1 se queda en su defecto. El leader la abre en el board:
  «Alinear la cabecera de `DataTable` con su columna (`end` y `center`)», con la causa de
  `requirements.md > P1`. *Hecho:* la key nueva queda citada en `progress/features/QC-269.md`.
- [ ] **T3c. Gate.** *Hecho:* `./init.sh` en verde y `./init.sh --completo` en verde antes del PR.

## Trazabilidad R → test

| R | Test |
|---|---|
| R1, R2, R3 | `e2e/operario-rediseno.spec.ts` (`R1, R2, R3 — «Entrar» alineado…`), `tests/unit/asignaciones-ui/assigned-order-enter-trigger.test.tsx` |
| R4 | `e2e/operario-rediseno.spec.ts` (`R4, R6, R9, R10 — panel…`), `tests/unit/asignaciones-ui/operator-screen-frame.test.tsx`, `tests/unit/asignaciones-ui/order-execution-screen.test.tsx` |
| R5 | `e2e/operario-rediseno.spec.ts` (`R5 — paso largo`) |
| R6 | `e2e/operario-rediseno.spec.ts` (`R4, R6, R9, R10 — panel…`) |
| R7 | `tests/unit/asignaciones-ui/packing-order-screen.test.tsx`, `tests/unit/asignaciones-ui/operator-screen-frame.test.tsx` (por `P3`) |
| R8 | `tests/unit/asignaciones-ui/operator-screen-frame.test.tsx` (prefijo `@min-[1101px]:`), `tests/unit/asignaciones-ui/packing-order-screen.test.tsx` |
| R9, R10 | `e2e/operario-rediseno.spec.ts` (`R4, R6, R9, R10 — panel…`), `tests/unit/asignaciones-ui/order-execution-lines.test.tsx` |

## Archivos esperados

Producción:

- `app/(private)/asignacion/components/assigned-order-enter-trigger.tsx`
- `app/(private)/asignacion/components/operator-screen-frame.tsx`
- `app/(private)/asignacion/[id]/components/order-execution-screen.tsx`
- `app/(private)/asignacion/[id]/components/order-execution-tools-panel.tsx`
- `app/(private)/asignacion/[id]/components/order-execution-lines.tsx`
- `app/(private)/asignacion/[id]/components/index.ts`
- `app/(private)/asignacion/empaque/[id]/components/packing-order-screen.tsx`

Tests:

- `tests/unit/asignaciones-ui/assigned-order-enter-trigger.test.tsx`
- `tests/unit/asignaciones-ui/operator-screen-frame.test.tsx`
- `tests/unit/asignaciones-ui/order-execution-screen.test.tsx`
- `tests/unit/asignaciones-ui/packing-order-screen.test.tsx`
- `tests/unit/asignaciones-ui/order-execution-lines.test.tsx`
- `e2e/operario-rediseno.spec.ts`

Spec y estado:

- `specs/QC-269-layout-operario/requirements.md`
- `specs/QC-269-layout-operario/design.md`
- `specs/QC-269-layout-operario/tasks.md`
- `progress/impl_QC-269.md`
- `progress/features/QC-269.md`

## Listas cerradas revisadas que no cambian

Van fuera de `## Archivos esperados` para que `scripts/archivos-en-vuelo.mjs` no las cuente como
tocadas:

- `E2E_ESPERADOS` (guard-identificador-de-request.test.ts): ya incluye `operario-rediseno.spec.ts`.
- data-table-alcance.test.ts: ya incluye `e2e/operario-rediseno.spec.ts`.
- Snapshots de paridad: ninguno pinta el disparador de «Entrar», la fila de material ni el cuerpo
  del operario. Se comprobó con grep de `items-start`, `order-execution-line` y `operator-body` en
  los `.snap`.
