# impl QC-299 — pasos-de-acondicionamiento

## Tanda 1 — Bloque A (T1, T2) · commit 83c5111d

### Archivos
- `db/schema.prisma` (solo las 6 líneas de la feature; se descartó el realineado de `prisma format` en modelos ajenos)
- `db/migrations/20261021120000_conditioning_step_actions/{migration,down}.sql`
- `db/migrations/20261021120001_conditioning_steps/{migration,down}.sql`
- `tests/unit/recetas/schema/recetas-schema.test.ts` (tres `Json`)
- `tests/integration/recetas/recipe-conditioning-steps-migration.int.test.ts` (nuevo)
- `tests/integration/aislamiento.json` (alta del test nuevo)
- `tests/guards/guard-identificador-de-request.test.ts` (alta de las dos migraciones en `MIGRACIONES_ESPERADAS`)

### Desvío del design anotado
- Índice `order_execution_entries_conditioning_step_once`: el predicado compara el enum sin `::text`
  (el cast a texto no es IMMUTABLE y Postgres lo rechaza en un índice, 42P17). Mismo efecto.

### Verificación
- `vitest run` recetas-schema + migración int + guard identificador: 3 archivos, 52 tests verdes
  (base efímera `qct_qc299_*`, borrada al terminar).
- Ciclo T1 sobre una copia desechable de la plantilla (`qct_qc299_t1check`, borrada):
  `db:migrate` → `db:rollback` (revierte 20261021120001) → down de 20261021120000 (aborta con
  `ROLLBACK ABORTADO: hay 1 anotacion(es)...` si hay fila; limpio deja 11 acciones y fases
  MANUFACTURING/PACKING) → `db:migrate` reaplica las dos. `db:rollback` siempre toma la última
  carpeta, así que el down de la 1 se aplicó con su mismo SQL + borrado de la fila de registro.
- `pnpm exec vitest run guard`: 80 archivos, 1096 verdes, 20 skipped.
- `pnpm run lint`: 0 errores, 10 warnings (preexistentes).
- `pnpm run typecheck`: **1 error** — `step-evidence-prisma.ts(18)`: el `Record<DbEvidencePhase, …>`
  exige `CONDITIONING`. Es el mapeo de T9 (`design.md > 4.6`); se cierra en la tanda que lleve T9.

### Base de desarrollo
La base local compartida (`QuimiCloude`) tiene 15 migraciones de otras ramas y **no** tiene las de
QC-299 aplicadas. No se tocó.

## Mapa R<n> -> test (parcial)
- R1 → `recipe-conditioning-steps-migration.int.test.ts` («R1: el UP…», «R1: el DOWN…»); `recetas-schema.test.ts` («R1: conditioningSteps mapea…»)
- R27 (BD) → `recipe-conditioning-steps-migration.int.test.ts` (cinco casos «R27: …»)

## Tanda 2 — Bloque B (T3–T7) + T8 + T9 · ver commit de la tanda 2

### Archivos
- `lib/modules/recetas/domain/recipe-input.ts` — `recipeStepShape` + `refineStep`; `conditioningStepSchema` (estricto, `requiresAssignment?`); `conditioningSteps` en alta (`default([])`) y edición (opcional = conservar)
- `lib/modules/recetas/domain/recipe-view.ts` — `ConditioningStepView`, `RecipeDetail.conditioningSteps`
- `lib/modules/recetas/domain/recipe-conditioning-steps-reader.ts` (nuevo) — `RecipeConditioningStepsReader`
- `lib/modules/recetas/ports/recipe-repository.ts` — `NewRecipe.conditioningSteps?`, `RecipeRow` / `RecipeOriginalRow.conditioningSteps`
- `lib/modules/recetas/domain/{create-recipe,update-recipe,update-recipe-version,get-recipe,recipe-step-lock}.ts`
- `lib/modules/recetas/adapters/driven/persistence/recipe-prisma.ts` — `toConditioningSteps` tolerante; escribe la columna solo si viene; versión `[]`
- `lib/modules/recetas/adapters/driven/persistence/recipe-catalog-prisma.ts` — `toRecipeConditioningSteps`, `findRecipeConditioningStepsById`
- `lib/modules/recetas/index.ts` — publica `conditioningStepSchema`, `ConditioningStepInput`, `ConditioningStepView`, `RecipeConditioningStepsReader`
- Tests nuevos: `tests/unit/recetas/conditioning-steps.test.ts`, `tests/unit/recetas/recipe-conditioning-steps-reader.test.ts`, `tests/integration/recetas/conditioning-steps.int.test.ts`
- Tests ampliados: `tests/unit/recetas/recipe-input.test.ts`, `tests/unit/documentos/confirm-formula-import.test.ts`
- `tests/integration/aislamiento.json` (alta `commit` del int nuevo)
- Fixtures (solo `conditioningSteps: []`): 32 archivos de `tests/unit/**` y `tests/integration/recetas/recipe-versions-repository.int.test.ts`

### Desvíos
- T5: el lector no se cablea en `lib/composition/index.ts`: ningún caso de uso lo consume todavía (lo cablea T13 con los de `asignaciones`, `design.md > 4.8`).
- T6: `confirm-formula-import.ts` no cambia; ni su entrada (estricta) ni lo que manda a alta/edición llevan `conditioningSteps`.
- `detectLockedStepChange`: solo compara `blocks`, así que `requiresAssignment` ya quedaba fuera; se actualizó el comentario.

### Verificación
- `pnpm run typecheck`: 4 errores, ninguno de esta tanda: `step-evidence-prisma.ts(18)` (conocido, T9) y 3 por las acciones nuevas de T8 en curso (`execution-trace-format.ts`, `execution-timeline.tsx`, `tests/ui/dashboard/textos-dashboard.test.tsx`).
- `pnpm run lint`: 0 errores, 10 warnings (preexistentes).
- `pnpm exec vitest related --run <archivos>` (con `.env`): 552 archivos, 9596 verdes, 2 rojos, 3 skipped. Rojo 1 (`update-recipe-version.test.ts`, fixture) arreglado y verde después. Rojo 2 `tests/unit/marca/tablas-marca.test.tsx` (`order-columns.tsx` sin columna «Cantidad»): ajeno, ni el test ni pedidos tienen cambios.
- `tests/integration/recetas/**` + `documentos/formula-import` + 3 de `pedidos`: verdes tras el fixture de `recipe-versions-repository` (17 + 3 archivos).
- `tests/integration/recetas/conditioning-steps.int.test.ts`: 11/11.
- `pnpm exec vitest run guard`: 80 archivos, 1096 verdes, 20 skipped.

## Mapa R<n> -> test (Bloque B)
- R1 → `recipe-input.test.ts` («R1: el alta sin conditioningSteps…»)
- R2 → `recipe-input.test.ts` («R2: rechaza el paso de acondicionamiento vacio…», «R2: el contrato publica conditioningStepSchema»)
- R3 → `recipe-input.test.ts` («R3: 50 pasos del operador, 50 de envasado y 50 de acondicionamiento…»)
- R4 → `recipe-input.test.ts` («R4: …separados…»); `conditioning-steps.test.ts` (6 casos «R4»); `conditioning-steps.int.test.ts` (6 casos «R4»)
- R5 → `recipe-input.test.ts` (3 casos «R5»)
- R6 → `conditioning-steps.test.ts` (3 casos «R6»)
- R7 → `confirm-formula-import.test.ts` (3 casos «R7»)
- R14 → `recipe-input.test.ts` («R14: los esquemas de version descartan…»); `conditioning-steps.test.ts` («R14: editar una version escribe conditioningSteps: []…»)
- R15 → `conditioning-steps.test.ts` («R15: el detalle de una version…»); `recipe-conditioning-steps-reader.test.ts` (4 casos «R15»); `conditioning-steps.int.test.ts` (2 casos «R15»)
- R30 → `recipe-conditioning-steps-reader.test.ts` (4 casos «R30»)
- R32 → `conditioning-steps.int.test.ts` («R32: devuelve null para una receta de otra empresa…»)
- R33 → `conditioning-steps.int.test.ts` (2 casos «R33»)
- R34 → `conditioning-steps.test.ts` (4 casos «R34»)

### T8 — registro de ejecución y avance puro
- Nuevos: `lib/modules/asignaciones/domain/conditioning-steps.ts`, `tests/unit/asignaciones/conditioning-steps.test.ts`
- Modificados: `domain/{execution-entry,conditioning-trace,execution-trace,get-execution-trace}.ts`, `ports/execution-log-repository.ts`, `adapters/driven/persistence/execution-log-prisma.ts`; tests `execution-trace`, `execution-log-prisma`, `get-execution-trace`, `list-execution-traces` (fixture `responsibleUserIds: null`) y dobles de `cancel/finish/start-assigned-order`, `record-step-move(-evidence)`, `execution-log-repository` (`append` devuelve `'ok'`).
- Desvíos: `ExecutionLogRepository.append` devuelve `'ok' | 'step_already_completed'` (T10 lo traduce a `ConditioningStepOutOfOrderError`). El adaptador reconoce el choque del índice por `P2002` con target `step_position` o nombre del índice; el target real lo confirma T14. `get-execution-trace.ts` lanza para las tres acciones nuevas hasta T12 (nada las escribe antes de T10). `conditioningProgress` recorta `completedCount` pero conserva responsables de posiciones fuera de la lista (el design no lo fija; abierto).

### Adelanto de T18 (solo para compilar)
- `app/(private)/dashboard/components/execution-trace-format.ts`, `app/(private)/dashboard/recorrido/[id]/components/execution-timeline.tsx`, `tests/ui/dashboard/textos-dashboard.test.tsx`, `tests/unit/dashboard/execution-trace-format.test.ts`: etiquetas «Avanzar», «Completar pasos», «Cambio de responsables» (design 5.3); tono/icono del tablero `RecorridoPasosAcondicionamiento` (`neutral`+`ArrowRight`; `waiting`+`UserPlus`). T18 sigue abierta.

### T9 — fotos de la fase `conditioning`
- `lib/modules/asignaciones/domain/{step-evidence,evidence-target,count-evidence-locking-orders,order-evidence,read-order-evidence}.ts`, `adapters/driven/persistence/step-evidence-prisma.ts`, `lib/composition/index.ts` (cablea `findRecipeConditioningStepsById` en `evidenceTargetDeps`).
- Tests: `evidence-target`, `count-evidence-locking-orders`, `read-order-evidence` ampliados; `step-evidence` y `request-evidence-upload` ajustados (fase de ejemplo desconocida pasa a `'storage'`); `tests/fixtures/order-evidence.ts` (`conditioning: []`).
- Pendiente para T10: `tests/unit/asignaciones/evidence-doubles.ts > acceso()` no pasa `conditioningSteps`.

### Verificación de cierre de la tanda 2 (corrida por el implementer)
- `pnpm run typecheck`: **0 errores**.
- `pnpm run lint`: 0 errores, 10 warnings (preexistentes).
- `pnpm exec vitest run guard`: 80 archivos, 1096 verdes, 20 skipped.
- T8: sus 4 archivos de test, 208/208. T9: `vitest run tests/unit/asignaciones tests/ui/dashboard tests/ui/inventario` 79/79 archivos, 2009/2009.
- `vitest related` de T9: 410/413 archivos; rojos `step-evidence` y `request-evidence-upload` corregidos después; queda `tests/unit/marca/tablas-marca.test.tsx` (columna «Cantidad» de `order-columns.tsx` de pedidos): ajeno, no está en `tests/baseline-rojos.json`, ni el test ni pedidos tienen cambios en esta rama.

## Mapa R<n> -> test (T8, T9)
- R27 → `tests/unit/asignaciones/conditioning-steps.test.ts` (bloque «conditioningProgress: pasos completados (R27)», 7 casos); `execution-log-prisma.test.ts` («R27: el choque con el indice de paso unico…», «R27: %s no se disfraza…», «R27: %s escribe su posicion…»)
- R28 → `conditioning-steps.test.ts` («R28: vale la ultima anotacion…», `sameResponsibles`, `conditioningResponsiblesSchema`); `execution-log-prisma.test.ts` («R28: append no escribe responsables invalidos», «R28: listEntriesForOrders…», «R28: responsables corruptos lanzan al leer»)
- R38 → `execution-trace.test.ts` (bloque «anotaciones de paso de acondicionamiento (R38)», 6 casos)
- R21 → `evidence-target.test.ts` («acondicionamiento (QC-299: R21, R32)», «requireEvidenceAccess (QC-299: R21)»); `read-order-evidence.test.ts` («acondicionamiento (QC-299: R21, R32)»); `step-evidence.test.ts`
- R32 → `evidence-target.test.ts`, `count-evidence-locking-orders.test.ts`, `read-order-evidence.test.ts` (casos de otra empresa)
- R34 → `count-evidence-locking-orders.test.ts` («acondicionamiento (QC-299: R34, R32)»)
