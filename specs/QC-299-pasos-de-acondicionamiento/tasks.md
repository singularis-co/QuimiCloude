# QC-299 — pasos-de-acondicionamiento · tasks.md

Leyenda: `[P]` = paralelizable con las otras `[P]` del mismo bloque. `dep:` = tasks que deben estar
hechas antes. Cada task cierra con typecheck, lint, `pnpm exec vitest related --run <archivos>` y
`pnpm exec vitest run guard` en verde, y su commit. T20 cierra con `./init.sh`. `R<n>` va en el
nombre de cada caso de test. Antes de T1: las preguntas abiertas P1–P6 resueltas en la aprobación
(si cambian, se corrige el spec primero).

## Bloque A — modelo

- [x] **T1. Migraciones y esquema Prisma.**
  Según `design.md > 2`. `<ts>` posterior a la última migración de `dev`; la 2 un segundo después.
  Hecho: `pnpm run db:migrate` y `pnpm run db:rollback` (las dos, en orden inverso) aplican sin
  error en local; `prisma generate` ok; el down de la 1 aborta con filas de los valores nuevos.
- [x] **T2. Tests de esquema y migración** — dep: T1.
  Enmendar `recetas-schema.test.ts` (tres `Json`). Integración: UP deja `conditioning_steps = '[]'`
  con `steps` y `packing_steps` idénticos; DOWN quita columnas, CHECK e índice y nada más; los CHECK
  rechazan responsables en otra acción, lista vacía y paso sin posición; el índice rechaza completar
  dos veces la misma posición.
  Hecho: verdes; casos `R1`, `R27`.

## Bloque B — `recetas`

- [x] **T3. Esquemas de entrada** [P con T5] — dep: ninguna.
  `conditioningStepSchema`, `conditioningSteps` en alta (`default([])`) y edición (opcional)
  (`design.md > 3.1`).
  Hecho: aceptan sin la clave, con 50+50+50; rechazan 51, paso vacío, 31 elementos, clave
  desconocida; `requiresAssignment` se acepta en acondicionamiento y se rechaza en `steps` y
  `packingSteps`; los esquemas de versión descartan la clave. Casos `R1`, `R2`, `R3`, `R5`, `R14`.
- [x] **T4. Tipos, puerto, casos de uso y adaptador** — dep: T1, T3.
  `design.md > 3.2`. Ajustar fixtures de `RecipeRow` que no compilen (solo añadir
  `conditioningSteps: []`).
  Hecho: alta y edición pasan la lista en orden; edición sin la clave conserva la guardada; versión
  escribe `[]`; `getRecipe` de una versión devuelve los de la original; sin `recetas.modificar`
  rechaza sin tocar el repositorio; mover/quitar pasos de acondicionamiento con pedidos con fotos
  lanza `RecipeStepsLockedError` y encender un switch no. Casos `R4`, `R6`, `R14`, `R15`, `R34`.
- [x] **T5. Lector de pasos de acondicionamiento** [P con T3] — dep: T1.
  `design.md > 3.3`.
  Hecho: `toRecipeConditioningSteps` devuelve los propios o los de la original, tolera inválidos;
  los `select` de ejecución y de envasado no piden `conditioningSteps`. Casos `R15`, `R30`.
- [x] **T6. Importación desde PDF** — dep: T4.
  Hecho: confirmar una importación que crea deja `[]`; una que reemplaza conserva los pasos de
  acondicionamiento; la revisión no pinta sección nueva. Caso `R7`.
- [x] **T7. Integración de `recetas`** — dep: T4, T5.
  Hecho: contra base real, las tres listas salen intactas y separadas; versión lee la original;
  receta dada de baja sigue devolviendo sus pasos; otra empresa da `null`. Casos `R4`, `R15`,
  `R32`, `R33`.

## Bloque C — `asignaciones` (dominio)

- [x] **T8. Registro de ejecución y avance puro** — dep: T1.
  `execution-entry.ts`, `conditioning-trace.ts`, `conditioning-steps.ts`, `execution-trace.ts`,
  `execution-log-prisma.ts` (`design.md > 4.1`, `> 4.2`).
  Hecho: `conditioningProgress` cuenta completados, recorta a la lista y da los responsables
  vigentes por posición; el adaptador valida responsables al escribir y al leer y traduce el índice
  único; la duración de la fase no cambia con las anotaciones nuevas. Casos `R27`, `R28`, `R38`.
- [x] **T9. Fotos de la fase `conditioning`** [P con T8] — dep: T1, T5.
  `step-evidence.ts`, `evidence-target.ts`, `count-evidence-locking-orders.ts`,
  `read-order-evidence.ts`, `order-evidence.ts`, adaptador de evidencias (`design.md > 4.6`).
  Hecho: subir/quitar en `conditioning` exige `acondicionamiento.modificar`, `EN_ACONDICIONAMIENTO`
  y ser quien acondiciona; un pedido `EN_ACONDICIONAMIENTO` con fotos cuenta para el bloqueo.
  Casos `R21`, `R32`, `R34`.
- [ ] **T10. `recordConditioningStep`** — dep: T5, T8, T9.
  Caso de uso, errores en `asignaciones` y en `errores` (`design.md > 4.3`).
  Hecho: autoriza antes de validar; completa solo el siguiente; rechaza saltos, pasos inexistentes,
  pedido de otro o terminado; exige foto y responsables cuando el paso los pide; rechaza
  responsables fuera del equipo, repetidos o en paso sin marca; revisitar con otro conjunto anota un
  cambio y con el mismo no escribe. Casos `R21`, `R23`, `R27`, `R28`, `R29`, `R31`, `R32`.
- [ ] **T11. `getConditioningOrder` y `finishConditioning`** — dep: T8, T9.
  `design.md > 4.4`, `> 4.5`.
  Hecho: los pasos y su avance solo salen en `EN_ACONDICIONAMIENTO` del actor y sin llamar al lector
  en los demás casos; sin pasos, `null`; los candidatos son el actor y el equipo; Terminar con pasos
  pendientes lanza `conditioning_steps_pending` sin tocar el pedido. Casos `R17`, `R19`, `R25`,
  `R30`, `R31`.
- [ ] **T12. Recorrido** — dep: T8.
  `get-execution-trace.ts`, `list-execution-traces.ts` (`design.md > 4.7`).
  Hecho: las anotaciones de paso traen responsables con nombre; el cambio trae anterior y nuevo; la
  lista no cambia. Casos `R35`, `R36`, `R37`.
- [ ] **T13. Server Action y composición** — dep: T10, T11.
  `order-conditioning-actions.ts`, `lib/composition/index.ts`.
  Hecho: la acción traduce errores como las demás de acondicionamiento; `vitest run guard` verde.
  Caso `R31`.
- [ ] **T14. Integración de `asignaciones`** — dep: T13.
  Hecho: contra base real, completar, revisitar y cambiar escriben las anotaciones esperadas; el
  segundo completado concurrente falla; otra empresa no ve ni escribe nada. Casos `R27`, `R28`,
  `R32`.

## Bloque D — UI

- [ ] **T15. Editor y sección del formulario** [P con T17] — dep: T3.
  `recipe-step-editor.tsx`, `recipe-steps-field.tsx`, `recipe-form.tsx`, `recipe-form-state.ts`
  (`design.md > 5.1`, tablero `FormulaAcondicionamiento*`).
  Hecho: tercera sección tras divisor con ayuda y «(opcional)»; dos switches solo en
  acondicionamiento; switches solo-icono con tooltip por hover y foco y nombre accesible completo en
  las tres secciones; resumen de la cabecera; filas vacías no se envían; errores en su sección;
  carga y guarda intactos. Casos `R8`, `R9`, `R10`, `R11`, `R12`, `R13`.
- [ ] **T16. Formulario de versión** [P con T15] — dep: T4.
  Hecho: bloque `inert` con los heredados o el aviso. Caso `R16`.
- [ ] **T17. Paso a paso del acondicionador** — dep: T13.
  `conditioning-steps-panel.tsx`, `conditioning-step-responsibles-picker.tsx`,
  `conditioning-batch-data-form.tsx`, `conditioning-order-screen.tsx`, `page.tsx`, barrel
  (`design.md > 5.2`, tablero `AcondicionamientoPasos*`).
  Hecho: con temporizadores falsos, checks y 5 s bloquean; evidencia y responsables bloquean con su
  texto; «Completar pasos» lleva a «Pasos completos» y aparece «Terminar»; «Datos de lote» bloqueada
  hasta completar; entra en el primer pendiente con el aviso; sin pasos la pantalla es la de hoy;
  objetivos ≥ 44 px. Casos `R18`, `R19`, `R20`, `R21`, `R22`, `R24`, `R25`, `R26`.
- [ ] **T18. Recorrido** — dep: T12.
  `execution-trace-format.ts`, `execution-timeline.tsx`, `conditioning-step-details.tsx`
  (`design.md > 5.3`, tablero `RecorridoPasosAcondicionamiento*`).
  Hecho: «Avanzar» / «Completar pasos» con responsables y cifra de fotos; «Cambio de responsables»
  con antes y después. Casos `R35`, `R36`.

## Bloque E — punta a punta y cierre

- [ ] **T19. E2E** — dep: T15, T17, T18.
  `e2e/pasos-de-acondicionamiento.spec.ts`, según R39.
  Hecho: `pnpm exec playwright test e2e/pasos-de-acondicionamiento.spec.ts` verde. Caso `R39`.
- [ ] **T20. Cierre** — dep: todas.
  Mapa `R<n> -> test` en `progress/impl_QC-299.md`; `./init.sh` verde.

## Archivos esperados

- `db/schema.prisma`
- `db/migrations/<ts>_conditioning_step_actions/migration.sql`
- `db/migrations/<ts>_conditioning_step_actions/down.sql`
- `db/migrations/<ts>_conditioning_steps/migration.sql`
- `db/migrations/<ts>_conditioning_steps/down.sql`
- `lib/modules/recetas/domain/recipe-input.ts`
- `lib/modules/recetas/domain/recipe-view.ts`
- `lib/modules/recetas/domain/recipe-step-lock.ts`
- `lib/modules/recetas/domain/create-recipe.ts`
- `lib/modules/recetas/domain/update-recipe.ts`
- `lib/modules/recetas/domain/update-recipe-version.ts`
- `lib/modules/recetas/domain/get-recipe.ts`
- `lib/modules/recetas/domain/recipe-conditioning-steps-reader.ts`
- `lib/modules/recetas/ports/recipe-repository.ts`
- `lib/modules/recetas/index.ts`
- `lib/modules/recetas/adapters/driven/persistence/recipe-prisma.ts`
- `lib/modules/recetas/adapters/driven/persistence/recipe-catalog-prisma.ts`
- `lib/modules/documentos/domain/confirm-formula-import.ts`
- `lib/modules/asignaciones/index.ts`
- `lib/modules/asignaciones/domain/execution-entry.ts`
- `lib/modules/asignaciones/domain/conditioning-trace.ts`
- `lib/modules/asignaciones/domain/conditioning-steps.ts`
- `lib/modules/asignaciones/domain/execution-trace.ts`
- `lib/modules/asignaciones/domain/record-conditioning-step.ts`
- `lib/modules/asignaciones/domain/get-conditioning-order.ts`
- `lib/modules/asignaciones/domain/conditioning-order-view.ts`
- `lib/modules/asignaciones/domain/finish-conditioning.ts`
- `lib/modules/asignaciones/domain/errors.ts`
- `lib/modules/asignaciones/domain/step-evidence.ts`
- `lib/modules/asignaciones/domain/evidence-target.ts`
- `lib/modules/asignaciones/domain/count-evidence-locking-orders.ts`
- `lib/modules/asignaciones/domain/read-order-evidence.ts`
- `lib/modules/asignaciones/domain/order-evidence.ts`
- `lib/modules/asignaciones/domain/get-execution-trace.ts`
- `lib/modules/asignaciones/domain/list-execution-traces.ts`
- `lib/modules/asignaciones/adapters/driven/persistence/execution-log-prisma.ts`
- `lib/modules/asignaciones/adapters/driven/persistence/step-evidence-prisma.ts`
- `lib/modules/asignaciones/adapters/driving/order-conditioning-actions.ts`
- `lib/modules/errores/domain/error-codes.ts`
- `lib/modules/errores/domain/error-catalog.ts`
- `lib/composition/index.ts`
- `app/(private)/produccion/formulas/components/recipe-step-editor.tsx`
- `app/(private)/produccion/formulas/components/recipe-steps-field.tsx`
- `app/(private)/produccion/formulas/components/recipe-form.tsx`
- `app/(private)/produccion/formulas/components/recipe-form-state.ts`
- `app/(private)/produccion/formulas/components/recipe-version-form.tsx`
- `app/(private)/asignacion/acondicionamiento/[id]/page.tsx`
- `app/(private)/asignacion/acondicionamiento/[id]/components/index.ts`
- `app/(private)/asignacion/acondicionamiento/[id]/components/conditioning-order-screen.tsx`
- `app/(private)/asignacion/acondicionamiento/[id]/components/conditioning-steps-panel.tsx`
- `app/(private)/asignacion/acondicionamiento/[id]/components/conditioning-step-responsibles-picker.tsx`
- `app/(private)/asignacion/acondicionamiento/[id]/components/conditioning-batch-data-form.tsx`
- `app/(private)/dashboard/components/execution-trace-format.ts`
- `app/(private)/dashboard/recorrido/[id]/components/execution-timeline.tsx`
- `app/(private)/dashboard/recorrido/[id]/components/conditioning-step-details.tsx`
- `tests/unit/recetas/schema/recetas-schema.test.ts`
- `tests/integration/recetas/recipe-conditioning-steps-migration.int.test.ts`
- `tests/unit/recetas/recipe-input.test.ts`
- `tests/unit/recetas/conditioning-steps.test.ts`
- `tests/unit/recetas/recipe-conditioning-steps-reader.test.ts`
- `tests/integration/recetas/conditioning-steps.int.test.ts`
- `tests/unit/documentos/confirm-formula-import.test.ts`
- `tests/unit/asignaciones/conditioning-steps.test.ts`
- `tests/unit/asignaciones/record-conditioning-step.test.ts`
- `tests/unit/asignaciones/get-conditioning-order.test.ts`
- `tests/unit/asignaciones/finish-conditioning.test.ts`
- `tests/unit/asignaciones/conditioning-doubles.ts`
- `tests/unit/asignaciones/evidence-target.test.ts`
- `tests/unit/asignaciones/count-evidence-locking-orders.test.ts`
- `tests/unit/asignaciones/read-order-evidence.test.ts`
- `tests/unit/asignaciones/execution-trace.test.ts`
- `tests/unit/asignaciones/execution-log-prisma.test.ts`
- `tests/unit/asignaciones/get-execution-trace.test.ts`
- `tests/unit/asignaciones/list-execution-traces.test.ts`
- `tests/unit/asignaciones/order-conditioning-actions.test.ts`
- `tests/integration/asignaciones/conditioning-steps-progress.int.test.ts`
- `tests/unit/recetas-ui/recipe-step-editor.test.tsx`
- `tests/unit/recetas-ui/recipe-steps-field.test.tsx`
- `tests/unit/recetas-ui/recipe-form-conditioning-steps.test.tsx`
- `tests/unit/recetas-ui/recipe-version-form.test.tsx`
- `tests/unit/asignaciones-ui/conditioning-order-screen.test.tsx`
- `tests/unit/asignaciones-ui/conditioning-steps-panel.test.tsx`
- `tests/unit/asignaciones-ui/conditioning-step-responsibles-picker.test.tsx`
- `tests/unit/asignaciones-ui/conditioning-batch-data-form.test.tsx`
- `tests/ui/dashboard/execution-trace-detail.test.tsx`
- `e2e/pasos-de-acondicionamiento.spec.ts`
