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

## Tanda 3 — T10–T14

### Archivos
- T10: nuevo `lib/modules/asignaciones/domain/record-conditioning-step.ts`; `domain/errors.ts` (4 errores nuevos); `lib/modules/errores/domain/{error-codes,error-catalog}.ts` (4 códigos); tests `record-conditioning-step.test.ts`, `conditioning-doubles.ts`, `tests/unit/errores/catalogo.test.ts` (102 → 106).
- T11: `domain/{conditioning-order-view,get-conditioning-order,finish-conditioning}.ts`, `index.ts`; tests `get-conditioning-order.test.ts`, `finish-conditioning.test.ts`; `tests/unit/identity/roles/acondicionamiento-rol.test.ts` (12 → 14 rutas, incluye `evidence-target.ts` de T9); fixtures `conditioningSteps: null` en `asignaciones-ui/conditioning-order-screen.test.tsx` y `paridad/asignacion-acondicionamiento-paridad.test.tsx`; `integration/asignaciones/finished-orders.int.test.ts` (deps).
- T12: `domain/get-execution-trace.ts` (`TracePerson`, variantes nuevas), `index.ts`; tests `get-execution-trace.test.ts` (+8), `list-execution-traces.test.ts` (+1); `tests/fixtures/execution-trace-conditioning.ts`.
- T13: `adapters/driving/order-conditioning-actions.ts` (`recordConditioningStepAction`), `lib/composition/index.ts`; tests `order-conditioning-actions.test.ts`, `tests/unit/composition/asignaciones-facade.test.ts` (35 → 36 operaciones).
- T14: nuevo `tests/integration/asignaciones/conditioning-steps-progress.int.test.ts` (+ alta en `aislamiento.json`).
- Arreglo del rojo de la tanda 2: `tests/unit/recetas/module-contract.test.ts` (alta de `recipe-conditioning-steps-reader.ts`).

### Confirmado en T14: target real del P2002
Segundo `CONDITIONING_STEP_ADVANCE` en la misma posición → `P2002`,
`meta = {"modelName":"OrderExecutionEntry","target":["order_id","step_position"]}`. El adaptador lo
traduce a `'step_already_completed'` sin cambios; el int lo verifica contra la base.

### Desvíos / lecturas
- Responsable repetido y responsables en paso sin «Asignación requerida» → `ValidationError` (`invalid_input`), como `startConditioningSchema`.
- Candidatos: el acondicionador sale una vez, primero, con `isSelf`, aunque esté en su equipo.
- `recordConditioningStepAction` revalida la ruta del detalle al tener éxito (calco de `saveConditioningBatchDataAction`); T17 lo tiene en cuenta.
- T14 caso 2 dobla `listEntriesForOrders` para forzar la carrera de forma determinista; escritura e índice reales.
- R35 «cifra de fotos por paso»: no va en el caso de uso (design 4.7); la pinta la UI (T18, design 5.3).

### PUNTO ABIERTO (preguntado al humano, sin resolver)
Responsables de posiciones que la fórmula ya no tiene: `composeConditioningStepsView`
(`conditioning-order-view.ts`) pasa el mapa de `conditioningProgress` tal cual, así que la vista los
incluye. Ningún test fija ese caso. `recordConditioningStep` no depende de ello (solo revisita
posiciones ≤ `completedCount`, ya recortado). Si se decide filtrar, el cambio va solo en esa función.

### Verificación de cierre de la tanda 3 (corrida por el implementer)
- `pnpm run typecheck`: **0 errores**.
- `pnpm run lint`: 0 errores, 10 warnings (preexistentes).
- `pnpm exec vitest run guard`: 80 archivos, 1096 verdes, 20 skipped.
- Unitarios T10/T11: 9 archivos, 392 verdes. T12: 80/80.
- Integración: `conditioning-steps-progress.int` + `conditioning-execution-log.int`, `finish-conditioning-batch-data.int`, `start-conditioning-team.int`, `seed-demo.int`: 5 archivos, 28/28.
- `vitest related` (con `.env`): 6446 verdes, 3 rojos → `asignaciones-facade` (corregido, 60/60 al repetir), `adjust-batch-dialog.test.tsx` (inestable con carga, pasa solo; inventario no se toca), `tablas-marca.test.tsx` (ajeno).
- Rojos ajenos fuera de `tests/baseline-rojos.json`: `tests/unit/marca/tablas-marca.test.tsx` (columna «Cantidad» de `order-columns.tsx`) y `tests/integration/proveedores/catalog-line.int.test.ts` (lee `error.meta?.constraint` de un P2003 como string; con `@prisma/client` 6.19.3 llega objeto; archivo idéntico a `dev`). No tocados.

## Mapa R<n> -> test (tanda 3)
- R17 → `get-conditioning-order.test.ts` («en %s no entrega pasos ni avance, y no llama al lector…»)
- R19 → `get-conditioning-order.test.ts` («con una receta %s, conditioningSteps es null…», «sin pasos, el resto del detalle es el mismo…»); `finish-conditioning.test.ts` («una receta %s termina como hoy sin leer el registro»)
- R21 → `record-conditioning-step.test.ts` («…pide evidencia sin ninguna foto…», «con una foto en ese paso lo completa»)
- R22 → `get-conditioning-order.test.ts` («los candidatos son el propio acondicionador primero…»)
- R23 → `record-conditioning-step.test.ts` (sin responsable, fuera del equipo, paso sin asignación, repetido, cambio validado)
- R25 → `finish-conditioning.test.ts` («con un paso sin completar rechaza con conditioning_steps_pending…», «sin ningun paso completado…», «con todos los pasos completados termina como hoy»)
- R27 → `record-conditioning-step.test.ts` (saltar, paso inexistente, otra pestaña); `conditioning-steps-progress.int.test.ts` (casos 1–4, concurrencia real)
- R28 → `record-conditioning-step.test.ts` (cambio anota, mismo conjunto no escribe, compara contra el último cambio); `conditioning-steps-progress.int.test.ts` (caso 1)
- R29 → `record-conditioning-step.test.ts` («%s rechaza sin leer los pasos ni escribir», terminado)
- R30 → `get-conditioning-order.test.ts` («el detalle no lee los pasos del operador ni los de envasado»)
- R31 → `record-conditioning-step.test.ts`, `get-conditioning-order.test.ts`, `finish-conditioning.test.ts` (permisos); `order-conditioning-actions.test.ts` («QC-299 T13», 4 casos); `asignaciones-facade.test.ts` («QC-299 R31»)
- R32 → `record-conditioning-step.test.ts`, `get-conditioning-order.test.ts`, `finish-conditioning.test.ts` (empresa del actor); `conditioning-steps-progress.int.test.ts` (casos 5–6)
- R35 → `get-execution-trace.test.ts` (Avanzar/Completar pasos con responsables, misma lectura de directorio, cuentan en la fase); `record-conditioning-step.test.ts` («completar un paso con asignacion anota sus responsables»)
- R36 → `get-execution-trace.test.ts` (cambio con anterior y nuevo, encadenado, anterior vacío, registro corrupto)
- R37 → `get-execution-trace.test.ts` (pasos de producción sin responsables); `list-execution-traces.test.ts` (fila sin cambios)

## Tanda 4 — UI (T15–T18) + decisión de responsables huérfanos

### Archivos
- T15: `app/(private)/produccion/formulas/components/{recipe-step-editor.tsx,recipe-steps-field.tsx,recipe-form.tsx,recipe-form-state.ts}`. `recipe-step-editor.tsx` estaba en CRLF en HEAD y queda en LF (`.gitattributes` pide LF); sin espacios de línea el diff es +78/−14.
- T16: `recipe-version-form.tsx`.
- T17: nuevos `app/(private)/asignacion/acondicionamiento/[id]/components/{conditioning-steps-panel.tsx,conditioning-step-responsibles-picker.tsx}`; modificados `conditioning-batch-data-form.tsx` (prop `locked`), `conditioning-order-screen.tsx` (pasa a `'use client'`), `index.ts`. `page.tsx` sin cambios.
- T18: `app/(private)/dashboard/components/execution-trace-format.ts`, `app/(private)/dashboard/recorrido/[id]/components/{execution-timeline.tsx,conditioning-step-details.tsx}`.
- Tests nuevos: `tests/unit/recetas-ui/recipe-form-conditioning-steps.test.tsx`, `tests/unit/asignaciones-ui/{conditioning-steps-panel,conditioning-step-responsibles-picker}.test.tsx`. Ampliados: `recipe-step-editor`, `recipe-steps-field`, `recipe-version-form`, `conditioning-order-screen`, `conditioning-batch-data-form`, `tests/ui/dashboard/execution-trace-detail.test.tsx`.
- Tests existentes ajustados: `recipe-form-evidence-lock`, `recipe-form-payload`, `recipe-form-state`, `recipe-lines-unavailable` (nombres accesibles «… de <sección>», `conditioningSteps: []`); `conditioning-order-page.test.tsx` (`conditioningSteps: null`); `recipe-route-contract.test.ts` (cuarto montador del asistente: `conditioning-steps-panel.tsx`, design 5.2); `tests/unit/recetas/scope.test.ts` (censo de `Recipe` + `conditioningSteps`, rojo desde la tanda 1 sin detectar).

### Refresh tras `recordConditioningStepAction` (T17)
Las props se leen solo al montar (paso de entrada, fotos iniciales, responsables guardados, aviso), así que el refresh no mueve el paso en curso ni borra marcas. Completados = máx(servidor, última respuesta de la acción). Envíos en cola en orden; «Completar pasos» sin doble envío; volver atrás no escribe; si el servidor rechaza, vuelve a ese paso con el error. Lo cubre un test que repinta con props nuevas.

### Desvíos respecto a los tableros (decisiones de los frontend_dev)
- Formulario: tooltip sin «mantener pulsado» en táctil (Base UI no lo trae; el nombre accesible lleva el texto, design 5.4). Ayuda de la sección visible bajo el título (prop `optionalDescription` en vez de `optionalHelp` de design 5.1, que pedía un texto no especificado). Formulario de versión sin switches (R16/P5), con marcas en texto. «+», «×» y asa conservan su nombre accesible.
- Paso a paso: `StepReader` no se toca → h2 «Pasos de acondicionamiento» con «Paso N de M» debajo, pie centrado a 720 px, motivos de bloqueo en el pie. Texto de evidencia de esta pantalla «Sube al menos una foto para avanzar.» (R21) sin tocar el hook compartido. «Pasos completos» con el pie de hoy (R24). «Retomaste donde ibas» en la columna izquierda. «Equipo» reutiliza `ConditioningTeamList` sin la fila «(acondiciona)». Toast «Pasos completos.».
- Recorrido: «Paso N» sin «de M» (P2, design 5.3). Singular «1 foto de evidencia» (añadido; el spec solo trae «N fotos de evidencia»: **confirmar**). La cifra va en la última «Avanzar»/«Completar pasos» de la posición, no en un cambio de responsables. Antes vacío se pinta «—».

### Decisión del humano 2026-10-21: responsables huérfanos
Anotada en `requirements.md > Decisiones cerradas`. `composeConditioningStepsView` filtra los responsables de posiciones que ya no existen; el registro los conserva y el recorrido los sigue mostrando.
- Código: `lib/modules/asignaciones/domain/conditioning-order-view.ts` (filtro `1 <= stepPosition <= steps.length`).
- Tests: `get-conditioning-order.test.ts` («R28, R26: si la formula perdio pasos, la vista ignora los responsables de posiciones que ya no existen»); `get-execution-trace.test.ts` («R35, R36: el recorrido sigue mostrando como historia los responsables de posiciones que la formula ya no tiene»).

### Verificación de cierre de la tanda 4 (corrida por el implementer)
- `pnpm run typecheck`: **0 errores**.
- `pnpm run lint`: 0 errores, 10 warnings (preexistentes).
- `pnpm exec vitest run guard`: 80 archivos, 1096 verdes, 20 skipped (una corrida en paralelo con otros agentes dio timeout en `guard-asignacion-componentizada`; repetida sola, verde).
- UI: `vitest run tests/unit/recetas tests/unit/recetas-ui tests/unit/asignaciones-ui tests/ui/dashboard tests/unit/paridad tests/unit/dashboard tests/unit/identity/session-once-per-request-render.test.tsx` → 153 archivos, 2590/2590.
- Tras el filtro: `tests/unit/asignaciones` + `tests/unit/asignaciones-ui` → 120 archivos, 2667/2667.
- A vigilar en CI por tiempo con carga: `session-once-per-request-render.test.tsx` (`beforeAll` 60 s; pasa solo), `formula-import-review.test.tsx` («más de 500 caracteres», ~20,7 s también en HEAD).

## Mapa R<n> -> test (tanda 4)
- R8 → `recipe-form-conditioning-steps.test.tsx` («R8: el alta la muestra tras «Envasado»…», «R8: una fila vacía…no se envía», reordenar teclado/arrastre); `recipe-steps-field.test.tsx` («R8: la sección se marca «(opcional)»…»)
- R9 → `recipe-steps-field.test.tsx` («R9: cada fila ofrece…», «R9: «Pasos» y «Envasado» siguen ofreciendo solo…»); `recipe-step-editor.test.tsx` («R9: sin la prop assignment…»); `recipe-form-conditioning-steps.test.tsx` («R9: solo «Acondicionamiento»…»)
- R10 → `recipe-step-editor.test.tsx` (solo icono, tooltip por hover y por foco, línea de ayuda); `recipe-steps-field.test.tsx` (nombre accesible); `recipe-form-conditioning-steps.test.tsx` («R10: en las tres secciones…»)
- R11 → `recipe-steps-field.test.tsx` («R11: la cabecera resume…», «R11: con la fila en blanco…»); `recipe-form-conditioning-steps.test.tsx`
- R12 → `recipe-form-conditioning-steps.test.tsx` (envío con marcas, paso vacío, error en su sección); `recipe-steps-field.test.tsx`
- R13 → `recipe-form-conditioning-steps.test.tsx` («R13: formato, lista de verificación y las dos marcas…», «R13: una lectura sin la clave…»)
- R16 → `recipe-version-form.test.tsx` (2 casos «R16 —»)
- R18 → `conditioning-steps-panel.test.tsx` («R18: un paso por pantalla…»); `conditioning-order-screen.test.tsx` («QC-299 R18…»)
- R19 → `conditioning-order-screen.test.tsx` (2 casos «QC-299 R19»)
- R20 → `conditioning-steps-panel.test.tsx` (2 casos «R20», temporizadores falsos)
- R21 → `conditioning-steps-panel.test.tsx` (2 casos «R21»)
- R22 → `conditioning-steps-panel.test.tsx` (5 casos «R22»); `conditioning-step-responsibles-picker.test.tsx` (5 casos «R22», incluido ≥ 44 px)
- R24 → `conditioning-steps-panel.test.tsx` (6 casos «R24»)
- R25 → `conditioning-steps-panel.test.tsx` («R24 R25»); `conditioning-order-screen.test.tsx` (3 «QC-299 R25»); `conditioning-batch-data-form.test.tsx` (3 «QC-299 R25»)
- R26 → `conditioning-steps-panel.test.tsx` (5 casos «R26»); `get-conditioning-order.test.ts` («R28, R26: …»)
- R28 → `get-conditioning-order.test.ts` («R28, R26: si la formula perdio pasos…»)
- R35 → `tests/ui/dashboard/execution-trace-detail.test.tsx` (6 casos «QC-299 R35»); `get-execution-trace.test.ts` («R35, R36: el recorrido sigue mostrando como historia…»)
- R36 → `execution-trace-detail.test.tsx` (3 casos «QC-299 R36»)
- R37 → `tests/unit/paridad/recorridos-paridad.test.tsx` (paridad del detalle intacta)

Pendientes: T19 (E2E, R39) y T20 (cierre).

## Tanda 5 — T19 (E2E) y T20 (cierre)

### Archivos
- Nuevo `e2e/pasos-de-acondicionamiento.spec.ts` (un caso `R39:`; empresa efímera `qc299_e2e_*` con `enableAllAddons`, usuarios del propio fixture, limpieza por prefijo).
- `tests/guards/guard-identificador-de-request.test.ts`: alta del spec en la lista cerrada `E2E_ESPERADOS`.

### Cómo se corrió
La base compartida `QuimiCloude` no tiene las migraciones de QC-299 y **no se tocó**. Como CI
(`gate.yml > Base del E2E`), se creó `qc299_e2e` como copia de la plantilla migrada
`qct_tpl_c94dd731b081` (`pnpm run db:test template`), se corrió el spec con `DATABASE_URL` y
`DIRECT_URL` apuntando a ella y después se borró.

Dos fallos del propio test, corregidos: (1) la empresa efímera no activaba add-ons y el
Administrador no tenía `dashboard.consultar` → 404 en el recorrido (diagnosticado con logs del
servidor; `getExecutionTrace` no llegaba a ejecutarse); (2) en webkit, `toBeEnabled()` del «Siguiente»
con el timeout por defecto de 5 s frente a la espera obligatoria de 5 s → plazo
`STEP_WAIT_MS + 30_000`. Ningún bug de la app.

### Salida de `pnpm exec playwright test e2e/pasos-de-acondicionamiento.spec.ts`
```
Running 2 tests using 2 workers
  ✓  1 [chromium] › e2e\pasos-de-acondicionamiento.spec.ts:485:7 › pasos de acondicionamiento de punta a punta (R39) › R39: ... (1.7m)
  ✓  2 [webkit] › e2e\pasos-de-acondicionamiento.spec.ts:485:7 › pasos de acondicionamiento de punta a punta (R39) › R39: ... (1.8m)

  2 passed (2.7m)
```

## Mapa R<n> -> test — consolidado R1–R39
Detalle de cada caso en las secciones de mapa de cada tanda. Rutas bajo `tests/` salvo el E2E.

| R | Tests |
|---|---|
| R1 | `integration/recetas/recipe-conditioning-steps-migration.int.test.ts` (UP/DOWN); `unit/recetas/schema/recetas-schema.test.ts`; `unit/recetas/recipe-input.test.ts`; `unit/recetas/scope.test.ts` (censo) |
| R2 | `unit/recetas/recipe-input.test.ts` |
| R3 | `unit/recetas/recipe-input.test.ts` |
| R4 | `unit/recetas/recipe-input.test.ts`; `unit/recetas/conditioning-steps.test.ts`; `integration/recetas/conditioning-steps.int.test.ts` |
| R5 | `unit/recetas/recipe-input.test.ts`; `unit/recetas/schema/recetas-schema.test.ts` |
| R6 | `unit/recetas/conditioning-steps.test.ts` |
| R7 | `unit/documentos/confirm-formula-import.test.ts` |
| R8 | `unit/recetas-ui/recipe-form-conditioning-steps.test.tsx`; `unit/recetas-ui/recipe-steps-field.test.tsx` |
| R9 | `unit/recetas-ui/recipe-steps-field.test.tsx`; `recipe-step-editor.test.tsx`; `recipe-form-conditioning-steps.test.tsx` |
| R10 | `unit/recetas-ui/recipe-step-editor.test.tsx`; `recipe-steps-field.test.tsx`; `recipe-form-conditioning-steps.test.tsx` |
| R11 | `unit/recetas-ui/recipe-steps-field.test.tsx`; `recipe-form-conditioning-steps.test.tsx` |
| R12 | `unit/recetas-ui/recipe-form-conditioning-steps.test.tsx`; `recipe-steps-field.test.tsx` |
| R13 | `unit/recetas-ui/recipe-form-conditioning-steps.test.tsx` |
| R14 | `unit/recetas/recipe-input.test.ts`; `unit/recetas/conditioning-steps.test.ts` |
| R15 | `unit/recetas/conditioning-steps.test.ts`; `unit/recetas/recipe-conditioning-steps-reader.test.ts`; `integration/recetas/conditioning-steps.int.test.ts` |
| R16 | `unit/recetas-ui/recipe-version-form.test.tsx` |
| R17 | `unit/asignaciones/get-conditioning-order.test.ts` |
| R18 | `unit/asignaciones-ui/conditioning-steps-panel.test.tsx`; `conditioning-order-screen.test.tsx` |
| R19 | `unit/asignaciones/get-conditioning-order.test.ts`; `finish-conditioning.test.ts`; `unit/asignaciones-ui/conditioning-order-screen.test.tsx` |
| R20 | `unit/asignaciones-ui/conditioning-steps-panel.test.tsx` |
| R21 | `unit/asignaciones/record-conditioning-step.test.ts`; `evidence-target.test.ts`; `read-order-evidence.test.ts`; `step-evidence.test.ts`; `unit/asignaciones-ui/conditioning-steps-panel.test.tsx` |
| R22 | `unit/asignaciones/get-conditioning-order.test.ts`; `unit/asignaciones-ui/conditioning-steps-panel.test.tsx`; `conditioning-step-responsibles-picker.test.tsx` |
| R23 | `unit/asignaciones/record-conditioning-step.test.ts` |
| R24 | `unit/asignaciones-ui/conditioning-steps-panel.test.tsx` |
| R25 | `unit/asignaciones/finish-conditioning.test.ts`; `unit/asignaciones-ui/conditioning-steps-panel.test.tsx`; `conditioning-order-screen.test.tsx`; `conditioning-batch-data-form.test.tsx` |
| R26 | `unit/asignaciones-ui/conditioning-steps-panel.test.tsx`; `unit/asignaciones/get-conditioning-order.test.ts` |
| R27 | `integration/recetas/recipe-conditioning-steps-migration.int.test.ts`; `unit/asignaciones/conditioning-steps.test.ts`; `execution-log-prisma.test.ts`; `record-conditioning-step.test.ts`; `integration/asignaciones/conditioning-steps-progress.int.test.ts` |
| R28 | `unit/asignaciones/conditioning-steps.test.ts`; `execution-log-prisma.test.ts`; `record-conditioning-step.test.ts`; `get-conditioning-order.test.ts`; `integration/asignaciones/conditioning-steps-progress.int.test.ts` |
| R29 | `unit/asignaciones/record-conditioning-step.test.ts` |
| R30 | `unit/recetas/recipe-conditioning-steps-reader.test.ts`; `unit/asignaciones/get-conditioning-order.test.ts` |
| R31 | `unit/asignaciones/record-conditioning-step.test.ts`; `get-conditioning-order.test.ts`; `finish-conditioning.test.ts`; `order-conditioning-actions.test.ts`; `unit/composition/asignaciones-facade.test.ts` |
| R32 | `integration/recetas/conditioning-steps.int.test.ts`; `unit/asignaciones/{evidence-target,count-evidence-locking-orders,read-order-evidence,record-conditioning-step,get-conditioning-order,finish-conditioning}.test.ts`; `integration/asignaciones/conditioning-steps-progress.int.test.ts` |
| R33 | `integration/recetas/conditioning-steps.int.test.ts` |
| R34 | `unit/recetas/conditioning-steps.test.ts`; `unit/asignaciones/count-evidence-locking-orders.test.ts` |
| R35 | `unit/asignaciones/get-execution-trace.test.ts`; `record-conditioning-step.test.ts`; `ui/dashboard/execution-trace-detail.test.tsx` |
| R36 | `unit/asignaciones/get-execution-trace.test.ts`; `ui/dashboard/execution-trace-detail.test.tsx` |
| R37 | `unit/asignaciones/get-execution-trace.test.ts`; `list-execution-traces.test.ts`; `unit/paridad/recorridos-paridad.test.tsx` |
| R38 | `unit/asignaciones/execution-trace.test.ts` |
| R39 | `e2e/pasos-de-acondicionamiento.spec.ts` («R39: el Administrador crea la formula…», chromium + webkit) |

### Verificación de cierre de la tanda 5 (corrida por el implementer)
- `pnpm run typecheck`: **0 errores**.
- `pnpm run lint`: 0 errores, 10 warnings (preexistentes).
- `pnpm exec vitest run guard`: 80 archivos, 1096 verdes, 20 skipped.
- E2E: 2 passed (chromium + webkit), salida arriba.
- `./init.sh`: lo corre el leader (criterio de hecho de T20).

## Vuelta 2 — correcciones de la revisión 1 + F2.3 + pulsación larga

HEAD antes del fix: `f4d5281d`.

### Correcciones (commit `09730570`)
- M1: `tests/unit/recetas-ui/recipe-route-contract.test.ts` — `PASOS_DE_ACONDICIONAMIENTO_QC299` (12 archivos de `lib/modules/recetas/`) en `RECETAS_PERMITIDAS` y `MIGRACION_QC299` (schema + 4 SQL) en `DB_PERMITIDAS`.
- M2: `tests/unit/shared/data-table-alcance.test.ts` — alta de `e2e/pasos-de-acondicionamiento.spec.ts` en la lista cerrada.
- m4: comentarios repartidos en `finish-conditioning.ts` y `evidence-target.ts`.
- m5: `design.md` anota `optionalDescription` (5.1) y `stepsPending` en `conditioning-order-screen.tsx` (5.2).

### F2.3 — merge de `origin/dev` (commit `62e137f8`, 411 commits de dev)
- Conflictos resueltos conservando ambos lados: `error-codes.ts`/`error-catalog.ts` (121 códigos = 117 de dev + 4), `catalogo.test.ts`, `aislamiento.json`, guardia del identificador (E2E y migraciones de dev + QC-299), `data-table-alcance.test.ts` (cincuenta y cinco), `canvas.json` (148 tableros, 58 notas), fachada de asignaciones (35 = 34 tras QC-301 + `recordConditioningStep`), rol de acondicionamiento (13 rutas: sale `list-delivered-conditioned-orders.ts` que QC-301 borró).
- Formulario de recetas: dev (QC-264) lo rediseñó con secciones en tarjetas; Acondicionamiento pasa a ser la tercera tarjeta (desaparece `recipe-form-conditioning-separator`, como dev quitó `recipe-form-steps-separator`). `recipe-step-editor.tsx` y `recipe-steps-field.tsx`: maquetación de dev + switches de QC-299. Tests ajustados sin rebajar: `recipe-form-conditioning-steps` (R8, tarjeta propia tras Envasado), `recipe-form-layout` (5 tarjetas), `recipe-steps-field` (nombre «… de Pasos»); fixtures `RecipeDetail` con `conditioningSteps: []` en `formulas-toasts`, `recipe-version-marks`, `recipe-form-layout`, `recipe-form-preview`.
- Ninguna ambigüedad: QC-301 solo quitó `listDeliveredConditionedOrders`, que QC-299 no usa.
- Migraciones del merge (13 de dev) verificadas sobre base efímera: `pnpm run db:test template` construyó `qct_tpl_bdf56c3e8ff5` con las 113 migraciones (las de QC-299 al final); `recipe-conditioning-steps-migration.int.test.ts` (UP/DOWN) verde contra una copia, borrada al terminar. `QuimiCloude` no se tocó.
- Tras el merge hace falta `pnpm exec prisma generate` (el schema de dev cambió).
- `tests/unit/marca/tablas-marca.test.tsx`: **verde** tras el merge.

### Pulsación larga en táctil (decisión del humano 2026-10-21)
- Anotada en `requirements.md > Decisiones cerradas` y en `design.md > 5.4`.
- `app/(private)/produccion/formulas/components/recipe-step-editor.tsx`: `IconSwitch` controla el `open` del `Tooltip` con pointer events (touch/pen, 500 ms; mover > 10 px o cancelar aborta; el click al soltar tras la pulsación larga se descarta; sin menú contextual ni selección; se cierra al tocar fuera). El `Tooltip` compartido **no cambia**: ningún otro consumidor afectado. Sin dependencias.
- Tests: `tests/unit/recetas-ui/recipe-step-editor.test.tsx`, bloque «ayuda de los switches por pulsación larga en táctil», 10 casos «R10: pulsación larga — …».
- R10 → añade ese bloque al mapa.

### Verificación local (implementer)
- `pnpm run typecheck`: **0 errores**. `pnpm run lint`: 0 errores, 10 warnings (preexistentes).
- `pnpm exec vitest run guard`: 85 archivos, 1253 verdes, 22 skipped.
- `recipe-route-contract.test.ts` y `data-table-alcance.test.ts`: verdes.
- `tests/unit/recetas` + `tests/unit/recetas-ui` + `tests/unit/shared` + `tablas-marca`: 162 archivos, 2292 verdes, 2 skipped.
- Con la integración de la migración (base efímera): 163 archivos, 2290 verdes (corrida previa a la pulsación larga).

## Vuelta 3 — F2.3 de nuevo (PR #290 en conflicto con `dev`, +42 commits)
- Conflictos (listas cerradas), ambos lados conservados: `tests/guards/guard-identificador-de-request.test.ts` (`MIGRACIONES_ESPERADAS`: las dos de QC-299 y después `20261021140000_orders_actual_cost` y `20261021150000_finished_goods_lot_cost_optional`, por timestamp); `tests/unit/shared/data-table-alcance.test.ts` (nota de `coste-real-de-produccion.spec.ts` de dev y después la de QC-299; recuento 55 → **cincuenta y seis**).
- `dev` cambió `db/schema.prisma` → `pnpm exec prisma generate`.
- Dos migraciones nuevas de dev verificadas en base efímera: plantilla `qct_tpl_37cac790cc7c` con 115 migraciones; `QuimiCloude` no se tocó.
- Verificación: typecheck **0 errores**; lint 0 errores, 10 warnings; guardias 85 archivos, 1255 verdes, 22 skipped; `tests/unit/{shared,pedidos,pedidos-ui,documentos,documentos-ui,paridad,asignaciones,inventario,recetas,recetas-ui,marca}` + `tests/integration/pedidos` + int de migración y de progreso de QC-299 → 770 archivos, 12896 verdes, 40 skipped (base efímera borrada).
