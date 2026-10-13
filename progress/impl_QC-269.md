# QC-269 — Defectos de layout del operario · bitácora del implementer

Rama `feature/QC-269-layout-operario`, worktree `.worktrees/QC-269-layout-operario`. Sin push (lo
hace el leader tras el gate). Sin dependencias nuevas.

## Commits

| Tanda | Commit | Qué |
|---|---|---|
| 1 | `f36305f7` | T1a, T1b, T1c: producción y unit |
| 2 | `85348cd2` | T2a, T2b: fixture y 3 casos E2E |
| 3 | (este) | Ajuste del test de deriva del `calc` + bitácora |

## Archivos tocados

Producción:

- `app/(private)/asignacion/components/assigned-order-enter-trigger.tsx`: envoltorios de BLOQUEADO y
  EN_CURSO en bloque normal (sin `flex`/`items-start`), aviso con `mt-1`.
- `app/(private)/asignacion/components/operator-screen-frame.tsx`: `STEP_READER_SIDE_COLUMN_RESERVE`.
- `app/(private)/asignacion/[id]/components/order-execution-tools-panel.tsx`: `className?` con `cn`.
- `app/(private)/asignacion/[id]/components/order-execution-screen.tsx`: le pasa la constante.
- `app/(private)/asignacion/empaque/[id]/components/packing-order-screen.tsx`: la `Card` izquierda
  recibe la constante solo con `showsPackingSteps`.
- `app/(private)/asignacion/[id]/components/order-execution-lines.tsx`: nombre
  `min-w-0 flex-[1_1_12rem] break-words` con `ORDER_EXECUTION_LINE_NAME_TESTID`; cifras en un grupo
  `flex min-w-0 flex-wrap items-center gap-3`.
- `app/(private)/asignacion/[id]/components/index.ts`: exporta `ORDER_EXECUTION_LINE_NAME_TESTID`.

Tests:

- `tests/unit/asignaciones-ui/assigned-order-enter-trigger.test.tsx`
- `tests/unit/asignaciones-ui/operator-screen-frame.test.tsx`
- `tests/unit/asignaciones-ui/order-execution-screen.test.tsx`
- `tests/unit/asignaciones-ui/packing-order-screen.test.tsx` (el caso R4 de QC-265 sin tocar)
- `tests/unit/asignaciones-ui/order-execution-lines.test.tsx`
- `e2e/operario-rediseno.spec.ts`

`components/shared/step-reader/` no se toca. `E2E_ESPERADOS` y `data-table-alcance.test.ts` no cambian.

## Desviaciones respecto al spec (a revisión)

1. **Test de deriva del `calc` (design.md § 4.2):** vive en `order-execution-screen.test.tsx` y no en
   `operator-screen-frame.test.tsx`. Importar `StepReader` desde `operator-screen-frame.test.tsx`
   rompía la lista cerrada de importadores de
   `tests/unit/recetas-ui/recipe-route-contract.test.ts` (rojo nuevo en `./init.sh`). Ese guardia no
   se toca; `order-execution-screen.test.tsx` ya está en su lista `TESTS_QUE_LO_NOMBRAN` y pinta el
   `StepReader` real en `mode="ejecucion"`. `operator-screen-frame.test.tsx` conserva el prefijo
   `@min-[1101px]:` y la forma `mb-[calc(…)]` (R8).
2. **R6, `overflow-y`:** la `Card` de shadcn lleva `overflow-hidden`, nunca `visible`. El E2E
   comprueba `scrollHeight === clientHeight` y que `overflow-y` no sea `auto` ni `scroll`.
3. **Medida tras desplazar:** durante la hidratación la página vuelve arriba entre desplazar y medir;
   el E2E desplaza y mide en una sola llamada `evaluate`, con reintento `toPass` de 30 s.
4. **Testid en el E2E:** el spec usa el literal `'order-execution-line-name'`, como el resto de
   `TESTIDS`; el unit `order-execution-lines.test.tsx` fija
   `ORDER_EXECUTION_LINE_NAME_TESTID === 'order-execution-line-name'`, así que una deriva la detecta
   Vitest. (Vuelta 2, H5: único motivo, el mismo que el comentario del E2E.)

## Trazabilidad R → test (verificada caso a caso)

| R | Test |
|---|---|
| R1, R2, R3 | E2E `R1, R2, R3 — «Entrar» alineado en sus tres estados`; unit `assigned-order-enter-trigger.test.tsx` (`R1, R2, R3 (QC-269)`, `it.each` BLOQUEADO/EN_CURSO) |
| R4 | E2E `R4, R6, R9, R10 — panel con muchos materiales`; unit `order-execution-screen.test.tsx` (Card de materiales con la constante; mismo `calc` que el pie del lector); `operator-screen-frame.test.tsx` (prefijo) |
| R5 | E2E `R5 — paso largo` |
| R6 | E2E `R4, R6, R9, R10 — panel con muchos materiales` (sin scroll propio, pie pegado al borde) |
| R7 | unit `packing-order-screen.test.tsx` (Card con la constante con pasos); `order-execution-screen.test.tsx` (mismo `calc`, por P3) |
| R8 | unit `operator-screen-frame.test.tsx` (prefijo `@min-[1101px]:`); `packing-order-screen.test.tsx` (sin pasos no la lleva) |
| R9, R10 | E2E `R4, R6, R9, R10 — panel con muchos materiales`; unit `order-execution-lines.test.tsx` (`el nombre no se solapa con las cifras (QC-269 R9, R10)`) |

## Salida de los tests

**Typecheck / lint:** `tsc --noEmit` exit 0; `eslint` sobre el diff exit 0 (los 7 avisos del lint
global son de `tests/unit/documentos/confirm-catalog-import.test.ts` y
`tests/unit/pedidos/order-service.test.ts`, ajenos).

**`vitest related --run` sobre el diff de la tanda 1:**

```
 Test Files  47 passed (47)
      Tests  724 passed (724)
```

**Tras el ajuste del test de deriva** (`vitest run` de operator-screen-frame, order-execution-screen
y recipe-route-contract): `Test Files 3 passed (3) | Tests 77 passed (77)`.

**`./init.sh` (rápido), final:**

```
 Test Files  47 passed (47)
      Tests  725 passed (725)
 Test Files  112 passed (112)
      Tests  1563 passed | 37 skipped (1600)
== init OK ==
```

La primera pasada de `./init.sh` dio un rojo nuevo en `recipe-route-contract.test.ts` (ver
desviación 1); se corrigió sin tocar el guardia.

**E2E `e2e/operario-rediseno.spec.ts`** (17 previos + 3 nuevos, sin saltados):

Chromium:

```
Running 20 tests using 5 workers
  ok 12 [chromium] › e2e\operario-rediseno.spec.ts:1107:7 › QC-269 R1, R2, R3 — «Entrar» en «Mis asignados» › R1, R2, R3 — «Entrar» alineado en sus tres estados (6.1s)
  ok 16 [chromium] › e2e\operario-rediseno.spec.ts:1174:7 › QC-269 R4, R6, R9, R10 — ejecución con muchos materiales › R4, R6, R9, R10 — panel con muchos materiales (9.4s)
  ok 19 [chromium] › e2e\operario-rediseno.spec.ts:1264:7 › QC-269 R5 — ejecución con un paso largo › R5 — paso largo (4.0s)
  20 passed (44.0s)
```

WebKit:

```
Running 20 tests using 5 workers
  ok 10 [webkit] › e2e\operario-rediseno.spec.ts:1107:7 › QC-269 R1, R2, R3 — «Entrar» en «Mis asignados» › R1, R2, R3 — «Entrar» alineado en sus tres estados (7.6s)
  ok 15 [webkit] › e2e\operario-rediseno.spec.ts:1174:7 › QC-269 R4, R6, R9, R10 — ejecución con muchos materiales › R4, R6, R9, R10 — panel con muchos materiales (10.4s)
  ok 19 [webkit] › e2e\operario-rediseno.spec.ts:1264:7 › QC-269 R5 — ejecución con un paso largo › R5 — paso largo (5.1s)
  20 passed (47.9s)
```

Los 3 casos nuevos, `--repeat-each=4` en Chromium: 12 pasados.

## Los casos muerden (T2b)

Con los 7 archivos de producción en `f36305f7~1` (vía `git checkout <sha> -- <archivos>`, sin
stash) y Chromium a 1440 px:

- **R1:** falla `R1: el borde derecho de «Entrar» en EN_CURSO es el de PENDIENTE` (Expected <= 1,
  Received 111.56). En una pasada con R2 primero, también `R2: el aviso de EN_CURSO termina en el
  borde de su «Entrar»` (Received 86.48).
- **R9:** con el `data-testid` del nombre añadido al `<span>` viejo, falla
  `R9 1440 × 900, material 0: el nombre no pisa al porcentaje` (Expected false, Received true).
- **R4:** falla `1440 × 900: R4 el último material por encima del pie fijo` (Expected <= 790,
  Received 843.5).
- **R5:** pasa también con el código viejo, como se esperaba: lo cubre la reserva interna de
  `StepReader`, que no cambia.

Restaurado con `git checkout HEAD -- <archivos>`; `git status` limpio salvo el spec.

## Entorno (para el leader)

- El `node_modules` del worktree estaba vacío. El subagente de la tanda 2 corrió
  `pnpm install --frozen-lockfile --offline` (solo lo fijado en el lockfile) y
  `pnpm exec prisma generate`; además `next typegen` para `.next/types`. Nada versionado cambia.
- Docker Desktop estaba apagado; se arrancó y subió `quimicloude-pg17`. Arrancaron también, solos,
  contenedores supabase de otros proyectos (crediflow, ordenex-app).

## Vuelta 2 (review_QC-269.md)

- **H1:** `order-execution-lines.tsx`, el comentario de la base de 12 rem ya no cita ficha ni
  requisitos; conserva el porqué. Ningún otro comentario nuevo de producción del diff cita fichas o
  requisitos (las menciones restantes están en `e2e/`, código de test).
- **H3:** el JSDoc de `STEP_READER_SIDE_COLUMN_RESERVE` nombra `order-execution-screen.test.tsx`.
- **H4:** el E2E de R10 mide además el grupo de cifras y el ancho interior de la fila (`li`,
  `clientWidth` menos padding). Si las cifras bajan bajo el nombre, exige
  `|ancho del nombre − ancho interior| ≤ 1 px`; y tras los anchos exige que el caso se haya dado al
  menos una vez (`wrappedRows > 0`), para que la aserción no quede vacía. Se da y pasa.
- **H5:** comentario del E2E y desviación 4 con un solo motivo (arriba).

Archivos: `app/(private)/asignacion/[id]/components/order-execution-lines.tsx`,
`app/(private)/asignacion/components/operator-screen-frame.tsx`, `e2e/operario-rediseno.spec.ts`.

Salida real:

- `./init.sh` (rápido): `Test Files 47 passed (47) | Tests 725 passed (725)`;
  `Test Files 112 passed (112) | Tests 1563 passed | 37 skipped (1600)`; `== init OK ==`.
- E2E `e2e/operario-rediseno.spec.ts`, Chromium: `20 passed (57.6s)`; WebKit: `20 passed (46.0s)`.

## Pendiente del leader

- T3b: abrir la ficha de P1 («Alinear la cabecera de `DataTable` con su columna (`end` y `center`)»)
  y citar la key en `progress/features/QC-269.md`.
- T3c: `./init.sh --completo` antes del PR, y push.
