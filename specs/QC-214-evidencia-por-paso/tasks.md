# QC-214 — evidencia-por-paso · tasks.md

Orden por dependencias. `[P]` = puede ir en paralelo con las otras `[P]` de su mismo bloque.
Cada task cierra con `pnpm run typecheck`, `pnpm run lint` y
`pnpm exec vitest related --run <archivos tocados>` en verde, y un commit
`feat(QC-214): …` / `test(QC-214): …`. Los nombres de los tests llevan su `R<n>`.

## Bloque A — Datos

- [x] **T1. Flag en el paso** (R3, R4). `requiresEvidence: z.boolean().optional()` en
  `recipeStepSchema` (`design.md > 2`).
  *Hecho:* `tests/unit/recetas/recipe-input.test.ts` cubre ausente, `true`, `false` y no booleano
  (rechazo); `tests/integration/recetas/step-evidence-flag.int.test.ts` guarda y relee el flag en
  `steps` y `packing_steps`, y en una versión lo devuelve el de su original (R6).
- [x] **T2. Tabla, migración y RLS** (R29–R31, R39). Modelo `OrderStepEvidence` con
  `/// @module asignaciones`, enum `EvidencePhase`, migración `20261013120000_order_step_evidence`
  con CHECK, FK compuestas, RLS forzada y `down.sql` (`design.md > 3`).
  *Hecho:* `pnpm run db:migrate` y `pnpm run db:rollback` limpios;
  `tests/integration/asignaciones/step-evidence-constraints.int.test.ts` prueba: 4.º `slot`
  rechazado, `slot` 0 y 4 rechazados, ruta fuera de `<empresa>/<pedido>/` rechazada, FK a pedido de
  otra empresa rechazada, `content_type` y `size_bytes` fuera de rango rechazados;
  `pnpm exec vitest run guard` verde (empresa en esquema, módulos).

## Bloque B — Dominio y adaptadores de `asignaciones` (depende de T1, T2)

- [x] **T3. Puro: `step-evidence.ts`** [P] (R28, R30, R31, R35–R37). Constantes, `buildEvidencePath`,
  `isEvidencePathOf`, `stepRequiresEvidence`, `missingEvidencePositions`; tipos `EvidencePhase`,
  `StepEvidenceView`; exportados por el barrel.
  *Hecho:* `tests/unit/asignaciones/step-evidence.test.ts` (otra empresa, otro pedido, `..`,
  segmentos de más o de menos; posiciones faltantes con la lista actual).
- [x] **T4. Errores** [P] (R29, R32, R34–R36, R9). `EvidenceRequiredError`, `EvidenceLimitError`,
  `EvidenceInvalidFileError`, `EvidenceNotFoundError` en `asignaciones`; `RecipeStepsLockedError` en
  `recetas`; los cinco códigos y mensajes en `lib/modules/errores`.
  *Hecho:* los tests existentes del catálogo de errores siguen verdes con los códigos nuevos.
- [x] **T5. Puertos y repositorio Prisma** (R29, R38, R39). `ports/step-evidence-repository.ts` y
  `adapters/driven/persistence/step-evidence-prisma.ts` (`design.md > 4.1`).
  *Hecho:* `tests/integration/asignaciones/step-evidence-repository.int.test.ts`: primer `slot`
  libre, `'limit'` con 3 y con dos inserciones simultáneas, `replace` atómico en el mismo `slot`,
  toda lectura filtrada por empresa (rechazo cruzado), cancelar el pedido no borra filas.
- [x] **T6. Storage: puerto, adaptador y doble** [P con T5] (R30, R33). `ports/evidence-storage.ts`,
  `evidence-storage-supabase.ts`, `evidence-storage-memory.ts`, `evidence-storage-config-env.ts`,
  `evidence-e2e-doubles-env.ts`; `EVIDENCE_E2E_DOUBLES` en `playwright.config.ts` y en `VIGILADAS`
  de la guardia; `SUPABASE_EVIDENCE_BUCKET` y `EVIDENCE_E2E_DOUBLES` vacías en `.env.example` y
  con su fila en `docs/architecture.md > Variables por entorno`.
  *Hecho:* `tests/unit/asignaciones/evidence-storage-memory.test.ts` (rechaza rutas no firmadas,
  `download` da un PNG válido para `validateRecipeImage`); guardias de dobles y de variables verdes.
- [x] **T7. Acceso: `evidence-target.ts`** (R26, R27, R38, R39). `design.md > 5.2`.
  *Hecho:* cubierto por los tests de T8 y T9: sin permiso, no asignado, otro empacador, otra
  empresa, `POR_EMPACAR`/`CANCELADO`/dado de baja → rechazo sin tocar el storage.
- [ ] **T8. `request-evidence-upload.ts`** (R26–R30). *Hecho:*
  `tests/unit/asignaciones/request-evidence-upload.test.ts`: paso inexistente, paso sin evidencia,
  3 fotos sin sustituir → `evidence_limit`; ruta bajo `<empresa>/<pedido>/`; ningún campo de
  entrada elige la ruta (`strictObject`).
- [ ] **T9. `register-evidence.ts` y `remove-evidence.ts`** (R19, R21, R28, R29, R31–R33, R38).
  *Hecho:* `tests/unit/asignaciones/register-evidence.test.ts` y `remove-evidence.test.ts`:
  ruta ajena rechazada, archivo inexistente, PDF renombrado y > 5 MB → `evidence_invalid_file` y
  archivo borrado; `replace` en el mismo `slot`; URL de 15 min; un `remove` que falla vuelve como
  advertencia; pedido terminado o cancelado → rechazo.
- [ ] **T10. `count-evidence-locking-orders.ts`** (R8–R12). `design.md > 5.6`.
  *Hecho:* `tests/unit/asignaciones/count-evidence-locking-orders.test.ts`: cuenta `EN_CURSO` con
  fotos de fabricación y `EN_EMPAQUE` con fotos de envasado; ignora otros estados, otras recetas y
  pedidos sin fotos; pagina hasta el final.
- [ ] **T11. Avanzar y terminar** (R34–R37). `record-step-move.ts`, `finish-assigned-order.ts`,
  `finish-packing.ts` (`design.md > 5.7`).
  *Hecho:* `tests/unit/asignaciones/record-step-move-evidence.test.ts` (avance rechazado sin
  anotar; retroceso nunca se rechaza); casos nuevos en `finish-assigned-order.test.ts` y
  `finish-packing.test.ts` (rechazo sin transición; switch encendido después de empezar también
  se exige, R37; sin pasos con evidencia, igual que hoy).
- [ ] **T12. Lecturas con fotos** (R14, R33). `get-assigned-order-execution.ts` (`evidence`),
  `get-packing-order.ts` (`packingEvidence`), vistas y barrel.
  *Hecho:* casos nuevos en `get-assigned-order-execution.test.ts` y `get-packing-order.test.ts`:
  URL firmadas por foto; en empaque, sin fotos si empaca otro.
- [ ] **T13. Server Actions y composición** (R18, R26, R27). `step-evidence-actions.ts`; cableado en
  `lib/composition/index.ts` (repositorio, storage elegido por `evidenceE2EDoublesEnabled()`,
  casos de uso, `RecipeStepLockReader`).
  *Hecho:* `tests/unit/asignaciones/step-evidence-actions.test.ts` (traducción de errores, una
  lectura de sesión); el test de una lectura de sesión por petición sigue verde con el archivo
  nuevo; guardia de arquitectura verde.

## Bloque C — `recetas` (depende de T1, T4, T10)

- [ ] **T14. Bloqueo al guardar** (R7, R9–R12). `recipe-step-lock.ts`, puerto
  `recipe-step-lock-reader.ts`, `listVersionIdsIncludingDeleted` en el repositorio y en
  `recipe-prisma.ts`, `update-recipe.ts`, `get-recipe-step-lock.ts`,
  `getRecipeStepLockAction` (`design.md > 5.8`).
  *Hecho:* `tests/unit/recetas/recipe-step-lock.test.ts` (acortar, mover intacto, mover y
  reescribir no detectado, cambiar solo el switch no es mover, añadir al final);
  `update-recipe.test.ts` (rechazo con `recipe_steps_locked` sin persistir; sin pedidos con fotos
  se acepta; edición sin mover/quitar no consulta el lector; sin `recetas.modificar` rechaza);
  `tests/unit/recetas/get-recipe-step-lock.test.ts`; integración de
  `listVersionIdsIncludingDeleted` en `tests/integration/recetas/step-evidence-flag.int.test.ts`.

## Bloque D — UI (depende de B y C)

- [ ] **T15. `components/ui/switch.tsx`** [P] (R1). Sobre `@base-ui/react` Switch, medidas y
  animación de `FormulaEvidenciaMovil.dc.html`; fila nueva en `CATALOGO.md` con su tablero.
  *Hecho:* `tests/unit/shared-ui/switch.test.tsx` (`role="switch"`, `aria-checked`, teclado,
  deshabilitado); guardia del catálogo verde.
- [ ] **T16. Extensión de `StepReader`** [P] (R15, R16, R22). Props `renderStepAddon`,
  `stepBlockReason`, `stepRequest` (`design.md > 8.2`); fila del catálogo actualizada.
  *Hecho:* casos nuevos en `tests/unit/recetas-ui/step-reader.test.tsx` (motivo extra bloquea
  Siguiente y Finalizar; prioridad del motivo de elementos pendientes; `stepRequest` navega y avisa
  a `onStepChange`); los casos existentes, sin tocar, siguen verdes.
- [ ] **T17. `components/shared/step-evidence/`** [P] (R13, R16–R21, R24, R25).
  `StepEvidence`, `upload-evidence.ts`, `EvidenceMissingDialog`, `index.ts`; fila en el catálogo
  con `EvidenciaPaso*.dc.html`.
  *Hecho:* `tests/unit/shared-ui/step-evidence.test.tsx` (estados vacío, subiendo con %, error con
  Quitar, 1–2 y 3 fotos, solo lectura, visor, área táctil, `accept` y `capture`);
  `tests/unit/shared-ui/upload-evidence.test.ts` (compresión antes de subir, `PUT` con progreso,
  registro al final, error en cada paso, nunca llama a la acción con bytes).
- [ ] **T18. Pantallas de Ejecución y Empaque** (R13–R16, R22, R23). `order-execution-screen.tsx`,
  `packing-order-screen.tsx`.
  *Hecho:* `tests/unit/asignaciones-ui/order-execution-evidence.test.tsx` y
  `packing-order-evidence.test.tsx`: bloque solo en pasos con evidencia; fotos iniciales; Siguiente
  bloqueado con el motivo; «Falta evidencia» con botón por paso que navega; confirmación con el
  texto de R23; los tests existentes de las dos pantallas siguen verdes.
- [ ] **T19. Editor de fórmulas** (R1, R2, R5, R6, R8). `recipe-step-editor.tsx`,
  `recipe-steps-field.tsx`, `recipe-form.tsx`, `recipe-version-form.tsx`, `[id]/page.tsx`.
  *Hecho:* casos nuevos en `recipe-step-editor.test.tsx` y `recipe-steps-field.test.tsx` (switch
  apagado por defecto, línea de ayuda, resumen por lista, sin switch si `showEvidenceSwitch` falta);
  `tests/unit/recetas-ui/recipe-form-evidence-lock.test.tsx` (aviso, mover y quitar
  deshabilitados, texto y switch activos); `recipe-version-form-evidence.test.tsx`.

## Bloque E — E2E y cierre (depende de todo)

- [ ] **T20. E2E del Operador** (R13, R15, R18, R22, R35). Extiende `e2e/ejecucion-receta.spec.ts`
  con una fórmula cuyo paso 1 exige evidencia: Siguiente bloqueado, subida interceptada en
  `https://evidencias-e2e.invalid/**`, avance, quitar la foto volviendo atrás, «Falta evidencia»
  al finalizar, volver a subir y finalizar.
  *Hecho:* `pnpm exec playwright test e2e/ejecucion-receta.spec.ts` verde en local.
- [ ] **T21. Cierre.** `./init.sh` verde; `progress/impl_QC-214.md` con el mapa `R<n> -> test`
  (`design.md > 10`); catálogo con las tres filas (switch, step-evidence, StepReader).

## Archivos esperados

- `db/schema.prisma`
- `db/migrations/20261013120000_order_step_evidence/migration.sql`
- `db/migrations/20261013120000_order_step_evidence/down.sql`
- `lib/modules/recetas/domain/recipe-input.ts`
- `lib/modules/recetas/domain/recipe-step-lock.ts`
- `lib/modules/recetas/domain/update-recipe.ts`
- `lib/modules/recetas/domain/get-recipe-step-lock.ts`
- `lib/modules/recetas/domain/errors.ts`
- `lib/modules/recetas/index.ts`
- `lib/modules/recetas/ports/recipe-step-lock-reader.ts`
- `lib/modules/recetas/ports/recipe-repository.ts`
- `lib/modules/recetas/adapters/driven/persistence/recipe-prisma.ts`
- `lib/modules/recetas/adapters/driving/recipe-actions.ts`
- `lib/modules/asignaciones/domain/step-evidence.ts`
- `lib/modules/asignaciones/domain/evidence-target.ts`
- `lib/modules/asignaciones/domain/request-evidence-upload.ts`
- `lib/modules/asignaciones/domain/register-evidence.ts`
- `lib/modules/asignaciones/domain/remove-evidence.ts`
- `lib/modules/asignaciones/domain/count-evidence-locking-orders.ts`
- `lib/modules/asignaciones/domain/record-step-move.ts`
- `lib/modules/asignaciones/domain/finish-assigned-order.ts`
- `lib/modules/asignaciones/domain/finish-packing.ts`
- `lib/modules/asignaciones/domain/get-assigned-order-execution.ts`
- `lib/modules/asignaciones/domain/start-assigned-order.ts`
- `lib/modules/asignaciones/domain/get-packing-order.ts`
- `lib/modules/asignaciones/domain/assigned-order-execution-view.ts`
- `lib/modules/asignaciones/domain/packing-order-view.ts`
- `lib/modules/asignaciones/domain/errors.ts`
- `lib/modules/asignaciones/index.ts`
- `lib/modules/asignaciones/ports/step-evidence-repository.ts`
- `lib/modules/asignaciones/ports/evidence-storage.ts`
- `lib/modules/asignaciones/adapters/driven/persistence/step-evidence-prisma.ts`
- `lib/modules/asignaciones/adapters/driven/storage/evidence-storage-supabase.ts`
- `lib/modules/asignaciones/adapters/driven/storage/evidence-storage-memory.ts`
- `lib/modules/asignaciones/adapters/driven/config/evidence-storage-config-env.ts`
- `lib/modules/asignaciones/adapters/driven/config/evidence-e2e-doubles-env.ts`
- `lib/modules/asignaciones/adapters/driving/step-evidence-actions.ts`
- `lib/modules/errores/domain/error-codes.ts`
- `lib/modules/errores/domain/error-catalog.ts`
- `lib/composition/index.ts`
- `components/ui/switch.tsx`
- `components/shared/step-reader/step-reader.tsx`
- `components/shared/step-evidence/index.ts`
- `components/shared/step-evidence/step-evidence.tsx`
- `components/shared/step-evidence/upload-evidence.ts`
- `components/shared/step-evidence/evidence-missing-dialog.tsx`
- `components/shared/CATALOGO.md`
- `app/(private)/asignacion/[id]/components/order-execution-screen.tsx`
- `app/(private)/asignacion/empaque/[id]/components/packing-order-screen.tsx`
- `app/(private)/produccion/formulas/components/recipe-step-editor.tsx`
- `app/(private)/produccion/formulas/components/recipe-steps-field.tsx`
- `app/(private)/produccion/formulas/components/recipe-form.tsx`
- `app/(private)/produccion/formulas/components/recipe-version-form.tsx`
- `app/(private)/produccion/formulas/[id]/page.tsx`
- `.env.example`
- `playwright.config.ts`
- `docs/architecture.md`
- `tests/guards/guard-dobles-e2e.test.ts`
- `tests/unit/recetas/recipe-input.test.ts`
- `tests/unit/recetas/recipe-step-lock.test.ts`
- `tests/unit/recetas/update-recipe.test.ts`
- `tests/unit/recetas/get-recipe-step-lock.test.ts`
- `tests/integration/recetas/step-evidence-flag.int.test.ts`
- `tests/unit/asignaciones/step-evidence.test.ts`
- `tests/unit/asignaciones/request-evidence-upload.test.ts`
- `tests/unit/asignaciones/register-evidence.test.ts`
- `tests/unit/asignaciones/remove-evidence.test.ts`
- `tests/unit/asignaciones/count-evidence-locking-orders.test.ts`
- `tests/unit/asignaciones/record-step-move-evidence.test.ts`
- `tests/unit/asignaciones/finish-assigned-order.test.ts`
- `tests/unit/asignaciones/finish-packing.test.ts`
- `tests/unit/asignaciones/get-assigned-order-execution.test.ts`
- `tests/unit/asignaciones/get-packing-order.test.ts`
- `tests/unit/asignaciones/evidence-storage-memory.test.ts`
- `tests/unit/asignaciones/step-evidence-actions.test.ts`
- `tests/integration/asignaciones/step-evidence-constraints.int.test.ts`
- `tests/integration/asignaciones/step-evidence-repository.int.test.ts`
- `tests/unit/shared-ui/switch.test.tsx`
- `tests/unit/shared-ui/step-evidence.test.tsx`
- `tests/unit/shared-ui/upload-evidence.test.ts`
- `tests/unit/recetas-ui/step-reader.test.tsx`
- `tests/unit/recetas-ui/recipe-step-editor.test.tsx`
- `tests/unit/recetas-ui/recipe-steps-field.test.tsx`
- `tests/unit/recetas-ui/recipe-form-evidence-lock.test.tsx`
- `tests/unit/recetas-ui/recipe-version-form-evidence.test.tsx`
- `tests/unit/asignaciones-ui/order-execution-evidence.test.tsx`
- `tests/unit/asignaciones-ui/packing-order-evidence.test.tsx`
- `e2e/ejecucion-receta.spec.ts`
