# QC-283 — acondicionamiento-en-el-recorrido · tasks.md

> **Leyenda.** `[P]` = puede ir en paralelo con las demás `[P]` de su tanda. «Dep» = tareas que
> deben estar hechas antes. Cada tanda cierra con `pnpm run typecheck`, `pnpm run lint`,
> `pnpm exec vitest related --run <archivos>` y `pnpm exec vitest run guard` en verde
> (`docs/perfil-agentes.md > Todos los agentes`).
>
> **Orden con otras fichas.** QC-283 va **antes** que QC-284 (DC P4). QC-284 se adapta después a
> `createFinishedBatchLabels(db?)` (C2.5) y a las deps nuevas de `createSaveConditioningBatchData`
> (C2.7).
>
> **Tests.** Los casos llevan `R<n>` en el nombre. Los tests existentes que cambian por la
> enmienda a QC-167 D11/R15 llevan una nota fechada (`design.md > Plan de tests`).

## Tanda 0 — Contratos (secuencial: T1 → T2 → T3; desbloquea las tandas 1A y 1B)

### [x] T1 — Esquema, migraciones y tipos de escritura · backend_dev · R7, R8, R9, R33, R34

**Hacer:**

- C1.1 y C1.2 en `db/schema.prisma`, y `pnpm exec prisma generate`.
- Las dos migraciones de C1.5, con su `down.sql`.
- C2.1: `conditioning-trace.ts`, entero.
- C2.2: `execution-entry.ts`.
- Los tres pares nuevos en `EXECUTION_ACTION_TO_PRISMA`.
- C2.3 solo en `append` y `listEntriesForOrders`: escribir y leer `batch_lines`, validados con zod.
- Los `export type` de C4 en `lib/modules/asignaciones/index.ts`.
- Las tres claves de C2.2 en `EXECUTION_ACTION_LABELS` y `EXECUTION_TIMELINE_ACTIONS`, con los
  textos e iconos **definitivos** de `design.md > UI > Formato y textos`. Es la frontera de
  compilación.

**Tests:**

- `tests/unit/asignaciones/schema/order-execution-conditioning-migration.test.ts`:
  - R7: los tres CHECK;
  - R9: ninguna migración tiene `INSERT` ni `UPDATE`;
  - R34: hay `down.sql`, y el de las acciones lleva la guarda `RAISE EXCEPTION`.
- `tests/integration/asignaciones/order-execution-entries-constraints.int.test.ts` › R7, los seis
  casos de rechazo de C1.4.
- `tests/unit/asignaciones/execution-log-prisma.test.ts`:
  - R33: una foto corrupta lanza al leer;
  - el R31 de QC-82 sigue verde (R8).
- Si `order-execution-entries-migration.test.ts` (QC-82) falla por el valor añadido, se tensa con
  una nota fechada. Las aserciones sobre **su** migración no cambian.

**Hecho cuando:**

- las migraciones aplican en la base de test;
- typecheck, lint y guardias están en verde;
- los tests de arriba están en verde.

### [x] T2 — Lectura del recorrido · backend_dev · R10, R11, R13, R19–R24, R26, R27, R29, R31, R32 · Dep: T1

**Hacer:**

- C2.9: `ExecutionTrace` con `active`, `durations` y `totalDuration`, y las reglas de C3.3
  (fases, `cancel`, pausas y total) en `buildExecutionTrace`.
- C3.1 y C3.2 en `get-execution-trace.ts`, con un `toDetailStep` por variante.
- C3.4 en `list-execution-traces.ts`: `people` lleva los firmantes y después el equipo, sin repetir.
- C2.10:
  - `listByOrdersInCompany` en el puerto y en `conditioning-team-prisma.ts`;
  - las deps `team` en los dos casos de uso;
  - su cableado en `lib/composition/index.ts`.
- Adaptar los dobles de los tests.

**Tests:**

- `tests/unit/asignaciones/execution-trace.test.ts` › R19, R20, R21, R22, R23, R24 y R26 (total y
  precedencia del `kind`).
- `tests/unit/asignaciones/list-execution-traces.test.ts` › R11, R27, R29, R31 y R32.
- `tests/unit/asignaciones/get-execution-trace.test.ts` › R11 y R13.
- `tests/integration/asignaciones/conditioning-team-repository.int.test.ts` › R10
  (`listByOrdersInCompany` filtra por empresa y ordena por pedido y `position`).
- Migrar los casos existentes de `duration` a `totalDuration` / `durations` / `active`, con nota
  fechada.

**Hecho cuando:**

- las Server Actions devuelven los tipos de C3 con datos reales;
- los tests de arriba están en verde;
- `lib/` compila. El repo entero todavía no compila, porque el front sigue leyendo `duration`: lo
  cierra T3 en esta misma tanda, y la tanda no se da por cerrada antes.

### [x] T3 — Puente del front: fixtures, formato, lista y tarjetas de duración · frontend_dev · R25, R26, R28 · Dep: T2

**Hacer:**

- `tests/fixtures/execution-trace-conditioning.ts`, según C4.
- En `execution-trace-format.ts`: `formatElapsedMinutes`, `formatTraceTotal`, `formatSnapshotDate`,
  `PHASE_DURATION_LABELS`, `PHASE_OPEN_MARK`, `PHASE_UNCLOSED_MARK` y `CONDITIONING_TEXTS`.
  Exportarlos por `app/(private)/dashboard/components/index.ts`.
- `execution-trace-columns.tsx`:
  - la celda Duración, con `formatTraceTotal(row.totalDuration)` y el sufijo atenuado;
  - la marca «En curso», con `row.active`.
- `execution-trace-detail.tsx`:
  - las tarjetas por fase, con insignias, sin pintar `null` y con la rejilla 5 / 3+2 / 2 del
    tablero;
  - la marca «En curso», con `trace.active`.
- Si `formatTraceDuration` queda sin consumidores, se borra junto con su test.

**Tests:**

- `tests/unit/dashboard/execution-trace-format.test.ts` › R15 (`formatSnapshotDate`) y R26
  (`formatTraceTotal` trunca a minutos, con los tres sufijos).
- `tests/ui/dashboard/execution-trace-table.test.tsx` › R26 y R28.
- `tests/ui/dashboard/execution-trace-detail.test.tsx` › R25 y R28.
- Ajustar `tests/ui/dashboard/recorrido-rediseno.test.tsx` y
  `tests/ui/dashboard/textos-dashboard.test.tsx`.

**Hecho cuando:**

- el repo entero compila;
- la tanda 0 cierra con typecheck, lint, `vitest related` y guardias en verde.

## Tanda 1A — Backend: escribir las tres anotaciones y filtrar por equipo (en paralelo con 1B)

T4 → T5 → T6 son secuenciales porque comparten `lib/composition/index.ts`, el puerto
`execution-transaction.ts` y el helper de test. T7 `[P]` no comparte archivos con ellas.

### T4 — Writers ampliados y Comenzar anota · backend_dev · R1, R2 · Dep: tanda 0

**Hacer:**

- C2.4: `ExecutionWriters` gana `conditioning.finishConditioningAliveById` y `batches`.
- Cableado sobre `tx` en `lib/composition/index.ts`.
- `tests/helpers/execution-transaction-on-client.ts`.
- C2.6: `log.append(conditioning_start)` dentro de la transacción de Comenzar.

**Tests:**

- `tests/unit/asignaciones/start-conditioning.test.ts` › R1 (orden: transición, equipo y
  anotación) y R2 (`already_mine` no anota).
- `tests/integration/asignaciones/conditioning-execution-log.int.test.ts` (NUEVO) › R1 (si `append`
  falla, no quedan ni transición ni equipo).

**Hecho cuando:** los tests están en verde y `start-conditioning-team.int.test.ts` sigue en verde.

### T5 — Guardar datos de lote anota con foto · backend_dev · R3, R4, R5 · Dep: T4

**Hacer:**

- C2.5: `createFinishedBatchLabels(db?)` y el JSDoc del puerto.
- C2.7: las deps nuevas, la foto, la transacción y la traducción de errores.
- El cableado en `lib/composition/index.ts`.
- `tests/unit/asignaciones/conditioning-doubles.ts`.

**Tests:**

- `tests/unit/asignaciones/save-conditioning-batch-data.test.ts` › R3 (foto en orden, con nombre
  o `null`) y R4 (un rechazo no anota y mantiene el error).
- `conditioning-execution-log.int.test.ts`:
  - R3 (misma transacción);
  - R4 (un lote duplicado no anota; un `append` que falla no guarda datos);
  - R5 (corregir añade otra foto y la primera no cambia).
- `tests/integration/inventario/finished-batch-labels.int.test.ts`: con `db`, no abre transacción
  propia.

**Hecho cuando:** los tests están en verde y `finish-conditioning-batch-data.int.test.ts` sigue en
verde.

### T6 — Terminar anota · backend_dev · R6 · Dep: T5

**Hacer:**

- C2.8: `transaction` en las deps, y la transición y `log.append(conditioning_finish)` dentro.
- El cableado en `lib/composition/index.ts`.

**Tests:**

- `tests/unit/asignaciones/finish-conditioning.test.ts` › R6 (anota en la transacción; un rechazo
  no anota y mantiene el error).
- `conditioning-execution-log.int.test.ts` › R6 (si `append` falla, el pedido no cambia).

**Hecho cuando:** los tests están en verde.

### T7 [P] — Filtro por persona incluye al equipo · backend_dev · R10, R30, R32 · Dep: tanda 0

**Hacer:** C2.3 `listExecutedOrderIds`, con las dos consultas Prisma unidas y sin SQL crudo.

**Tests:**

- `tests/integration/asignaciones/execution-log-read.int.test.ts`:
  - R30 (encuentra el pedido por el miembro del equipo; con rango cuenta el instante del
    Comenzar);
  - R32 (un equipo sin Comenzar anotado no filtra);
  - R10 (no cruza empresas).
- `execution-log-prisma.test.ts` › R8 (el R31 de QC-82 sigue en verde).

**Hecho cuando:** los tests están en verde.

## Tanda 1B — Frontend: las tres anotaciones en la línea de tiempo (en paralelo con 1A)

### T8 — Cuerpos de Comenzar, guardado y Terminar · frontend_dev · R12–R18 · Dep: tanda 0

**Hacer:**

- `conditioning-step-details.tsx` (NUEVO), con `ConditioningStartBody`,
  `ConditioningBatchSaveBody` y `ConditioningBatchLinesTable`, según `design.md > UI > Línea de
  tiempo`. Usa solo piezas del catálogo.
- `TimelineStep` en `execution-timeline.tsx` estrecha por `step.action` y monta el cuerpo que toca.
- Regenerar el snapshot de `tests/unit/paridad/recorridos-paridad.test.tsx` y revisarlo a mano
  contra `docs/diseno/canvas/RecorridoAcondicionamiento.dc.html`.

**Tests:** `tests/ui/dashboard/execution-trace-detail.test.tsx`, con los fixtures de T3:

- R12: nombre, tono e icono;
- R13: supervisor y equipo en orden, con el grupo;
- R14: sin equipo;
- R15: quién guardó, «N presentaciones», líneas en `dd/mm/aaaa` y aviso;
- R16: presentación `null`;
- R17: Terminar solo con quién;
- R18: tarjetas de línea, acotadas a su cuerpo.

**Hecho cuando:**

- los tests están en verde;
- la revisión visual en escritorio, tablet y teléfono coincide con los tres tableros
  `RecorridoAcondicionamiento*`.

## Tanda 2 — Flujo completo (Dep: tandas 1A y 1B)

### T9 — E2E · frontend_dev o backend_dev · R36 · Dep: T4–T8

**Hacer:** `e2e/recorrido-acondicionamiento.spec.ts` (NUEVO), con los helpers de
`e2e/acondicionar-con-equipo.spec.ts`, `e2e/datos-de-lote-en-acondicionamiento.spec.ts` y
`e2e/recorrido-ejecucion.spec.ts`.

1. Un Administrador de acondicionamiento comienza con un equipo de dos personas, una por grupo.
2. Guarda dos líneas y después las corrige.
3. Termina.
4. Un Administrador abre el dashboard y comprueba:
   - el total de la fila, sin sufijo;
   - que filtrar por el miembro del equipo que no firma encuentra el pedido;
   - en el detalle, las tres anotaciones nuevas;
   - que la foto del primer guardado conserva el lote original;
   - las tres tarjetas de duración.

**Tests:** `pnpm exec playwright test e2e/recorrido-acondicionamiento.spec.ts` › «R36 - …».

**Hecho cuando:** el spec está en verde en local.

### T10 — Cierre de trazabilidad · implementer · R1–R36 · Dep: T9

**Hacer:**

- El mapa `R<n> -> test` en `progress/impl_QC-283.md`, partiendo de `design.md > Plan de tests`.
- Comprobar que R35 sigue cubierto por `tests/guards/guard-dependencias-aprobadas.test.ts`, sin
  dependencias nuevas.
- `./init.sh` en verde.

**Hecho cuando:** cada `R1…R36` tiene al menos un test que existe y pasa.

## Archivos esperados

**Esquema y migraciones**

- `db/schema.prisma`
- `db/migrations/20261015120000_order_execution_conditioning_actions/migration.sql`
- `db/migrations/20261015120000_order_execution_conditioning_actions/down.sql`
- `db/migrations/20261015120100_order_execution_batch_lines/migration.sql`
- `db/migrations/20261015120100_order_execution_batch_lines/down.sql`

**Módulo `asignaciones`**

- `lib/modules/asignaciones/domain/conditioning-trace.ts`
- `lib/modules/asignaciones/domain/execution-entry.ts`
- `lib/modules/asignaciones/domain/execution-trace.ts`
- `lib/modules/asignaciones/domain/get-execution-trace.ts`
- `lib/modules/asignaciones/domain/list-execution-traces.ts`
- `lib/modules/asignaciones/domain/start-conditioning.ts`
- `lib/modules/asignaciones/domain/save-conditioning-batch-data.ts`
- `lib/modules/asignaciones/domain/finish-conditioning.ts`
- `lib/modules/asignaciones/index.ts`
- `lib/modules/asignaciones/ports/execution-transaction.ts`
- `lib/modules/asignaciones/ports/conditioning-team-repository.ts`
- `lib/modules/asignaciones/adapters/driven/persistence/execution-log-prisma.ts`
- `lib/modules/asignaciones/adapters/driven/persistence/conditioning-team-prisma.ts`

**Módulo `inventario` y composición**

- `lib/modules/inventario/adapters/driven/persistence/finished-batch-labels-prisma.ts`
- `lib/modules/inventario/domain/finished-batch-labels.ts`
- `lib/composition/index.ts`

**Front del dashboard**

- `app/(private)/dashboard/components/execution-trace-format.ts`
- `app/(private)/dashboard/components/execution-trace-columns.tsx`
- `app/(private)/dashboard/components/index.ts`
- `app/(private)/dashboard/recorrido/[id]/components/execution-trace-detail.tsx`
- `app/(private)/dashboard/recorrido/[id]/components/execution-timeline.tsx`
- `app/(private)/dashboard/recorrido/[id]/components/conditioning-step-details.tsx`

**Tests: fixtures, helpers y unitarios**

- `tests/fixtures/execution-trace-conditioning.ts`
- `tests/helpers/execution-transaction-on-client.ts`
- `tests/unit/asignaciones/schema/order-execution-conditioning-migration.test.ts`
- `tests/unit/asignaciones/schema/order-execution-entries-migration.test.ts`
- `tests/unit/asignaciones/execution-log-prisma.test.ts`
- `tests/unit/asignaciones/execution-trace.test.ts`
- `tests/unit/asignaciones/list-execution-traces.test.ts`
- `tests/unit/asignaciones/get-execution-trace.test.ts`
- `tests/unit/asignaciones/execution-trace-actions.test.ts`
- `tests/unit/asignaciones/start-conditioning.test.ts`
- `tests/unit/asignaciones/save-conditioning-batch-data.test.ts`
- `tests/unit/asignaciones/finish-conditioning.test.ts`
- `tests/unit/asignaciones/conditioning-doubles.ts`
- `tests/unit/dashboard/execution-trace-format.test.ts`

**Tests de integración**

- `tests/integration/asignaciones/order-execution-entries-constraints.int.test.ts`
- `tests/integration/asignaciones/conditioning-execution-log.int.test.ts`
- `tests/integration/asignaciones/execution-log-read.int.test.ts`
- `tests/integration/asignaciones/conditioning-team-repository.int.test.ts`
- `tests/integration/inventario/finished-batch-labels.int.test.ts`

**Tests de UI y paridad**

- `tests/ui/dashboard/execution-trace-detail.test.tsx`
- `tests/ui/dashboard/execution-trace-table.test.tsx`
- `tests/ui/dashboard/recorrido-rediseno.test.tsx`
- `tests/ui/dashboard/textos-dashboard.test.tsx`
- `tests/unit/paridad/recorridos-paridad.test.tsx`
- `tests/unit/paridad/__snapshots__/recorridos-paridad.test.tsx.snap`

**E2E**

- `e2e/recorrido-acondicionamiento.spec.ts`
