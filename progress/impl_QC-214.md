# QC-214 — evidencia-por-paso · bitácora del implementer

## Tanda 1 (2026-10-13) — Bloques A y B: T1 a T12

Todo lo hizo `backend_dev`, en tres lanzamientos (T1–T2, T3–T7, T8–T12). Sin UI, sin dependencias
nuevas, sin push.

### Commits

| Task | Commit |
|---|---|
| T1 | `5afa5306` flag `requiresEvidence` en el paso |
| T2 | `eff8c8a6` tabla `order_step_evidence` (CHECK, FK compuestas, RLS) |
| T3 | `ae7b8986` `step-evidence.ts` puro |
| T4 | `91ee982a` errores de evidencia y de pasos bloqueados |
| T5 | `7739c350` puerto y repositorio Prisma |
| T6 | `c2f14520` storage: puerto, bucket Supabase y doble |
| T7 | `d097b61a` `evidence-target.ts`; `ec5c1aad` ajuste de `module-contract.test.ts` |
| T8 | `f15350a9` `request-evidence-upload.ts` |
| T9 | `1bd9a356` `register-evidence.ts` y `remove-evidence.ts` |
| T10 | `8af66cdd` `count-evidence-locking-orders.ts` |
| T11 | `b2758b4c` avanzar, finalizar y terminar empaque exigen fotos |
| T12 | `26895421` ejecución y empaque traen las fotos firmadas |
| marcas | `cb8186ac`, `f27b717e` y el commit de cierre de esta tanda |

### Archivos

**Datos:** `db/schema.prisma` (enum `EvidencePhase` y modelo `OrderStepEvidence` al final),
`db/migrations/20261013120000_order_step_evidence/{migration.sql,down.sql}`.

**recetas:** `domain/recipe-input.ts`, `domain/errors.ts` (`RecipeStepsLockedError`), `index.ts`.

**errores (compartidos):** `domain/error-codes.ts`, `domain/error-catalog.ts` (5 códigos, al final).

**asignaciones — nuevos:** `domain/step-evidence.ts`, `domain/evidence-target.ts`,
`domain/evidence-photos.ts`, `domain/request-evidence-upload.ts`, `domain/register-evidence.ts`,
`domain/remove-evidence.ts`, `domain/count-evidence-locking-orders.ts`,
`ports/step-evidence-repository.ts`, `ports/evidence-storage.ts`,
`adapters/driven/persistence/step-evidence-prisma.ts`,
`adapters/driven/storage/evidence-storage-{supabase,memory}.ts`,
`adapters/driven/config/evidence-storage-config-env.ts`, `adapters/driven/config/evidence-e2e-doubles-env.ts`.

**asignaciones — modificados:** `domain/errors.ts`, `domain/actor.ts` (`requireAnyPermission`, al
final), `record-step-move.ts`, `finish-assigned-order.ts`, `finish-packing.ts`,
`get-assigned-order-execution.ts`, `assigned-order-execution-view.ts`, `get-packing-order.ts`,
`packing-order-view.ts`, `index.ts`.

**Composición (compartido):** `lib/composition/index.ts` — solo añadidos: repositorio, storage elegido
por `evidenceE2EDoublesEnabled()` y deps nuevas de seis casos de uso existentes (lo mínimo para
compilar T11/T12). Los casos de uso nuevos y las Server Actions quedan para T13.

**Config/docs:** `.env.example`, `playwright.config.ts` (`EVIDENCE_E2E_DOUBLES: '1'`),
`docs/architecture.md > Variables por entorno` (dos filas al final).

**Tests nuevos:** `tests/unit/recetas/recipe-input.test.ts` (casos nuevos),
`tests/integration/recetas/step-evidence-flag.int.test.ts`,
`tests/integration/asignaciones/step-evidence-constraints.int.test.ts`,
`tests/integration/asignaciones/step-evidence-repository.int.test.ts`,
`tests/unit/asignaciones/{step-evidence,evidence-storage-memory,evidence-target,request-evidence-upload,register-evidence,remove-evidence,count-evidence-locking-orders,record-step-move-evidence}.test.ts`,
`tests/unit/asignaciones/evidence-doubles.ts`, `tests/helpers/evidence-off.ts`,
`tests/unit/errores/evidence-codes.test.ts`.

**Tests/guardias ajustados:** `tests/integration/aislamiento.json`,
`tests/guards/guard-identificador-de-request.test.ts` (migración en `MIGRACIONES_ESPERADAS`),
`tests/guards/guard-dobles-e2e.test.ts` (fila `EVIDENCE_E2E_DOUBLES` en `VIGILADAS`),
`tests/unit/errores/catalogo.test.ts` (87 → 92 códigos), `tests/unit/asignaciones/module-contract.test.ts`,
casos nuevos o deps en `finish-assigned-order`, `finish-packing`, `get-assigned-order-execution`,
`get-packing-order`, `record-step-move`, `start-assigned-order`; fixtures (`evidence: []` /
`packingEvidence: []`) en 7 tests de `tests/unit/asignaciones-ui/` y 2 de `tests/unit/paridad/`;
integración `batch-states`, `finish-auto-assign-packers`, `finished-orders`,
`responsible-eligibility`, `pedidos/finish-with-finished-goods`.

### Mapa R<n> -> test (lo que cubre esta tanda)

| R | Test |
|---|---|
| R3, R4 | `tests/unit/recetas/recipe-input.test.ts`, `tests/integration/recetas/step-evidence-flag.int.test.ts` |
| R6 | `tests/integration/recetas/step-evidence-flag.int.test.ts` |
| R8–R12 (conteo de pedidos con fotos) | `tests/unit/asignaciones/count-evidence-locking-orders.test.ts`, `tests/integration/asignaciones/step-evidence-repository.int.test.ts` |
| R14, R33 | `tests/unit/asignaciones/get-assigned-order-execution.test.ts`, `get-packing-order.test.ts`, `register-evidence.test.ts`, `evidence-storage-memory.test.ts` |
| R19 | `register-evidence.test.ts`, `remove-evidence.test.ts`, `request-evidence-upload.test.ts`, `step-evidence-repository.int.test.ts` |
| R21 | `register-evidence.test.ts`, `remove-evidence.test.ts`, `record-step-move-evidence.test.ts` |
| R26, R27 | `request-evidence-upload.test.ts`, `register-evidence.test.ts`, `remove-evidence.test.ts`, `evidence-target.test.ts` |
| R28 | `step-evidence.test.ts`, `request-evidence-upload.test.ts`, `register-evidence.test.ts` |
| R29 | `request-evidence-upload.test.ts`, `register-evidence.test.ts`, `step-evidence-repository.int.test.ts` (concurrencia), `step-evidence-constraints.int.test.ts` |
| R30, R31 | `step-evidence.test.ts`, `register-evidence.test.ts`, `evidence-storage-memory.test.ts`, `step-evidence-constraints.int.test.ts` |
| R32 | `register-evidence.test.ts`, `step-evidence-constraints.int.test.ts` |
| R34 | `record-step-move-evidence.test.ts` |
| R35 | `finish-assigned-order.test.ts`, `step-evidence.test.ts` |
| R36 | `finish-packing.test.ts`, `step-evidence.test.ts` |
| R37 | `record-step-move-evidence.test.ts`, `finish-assigned-order.test.ts`, `finish-packing.test.ts` |
| R38 | `evidence-target.test.ts`, `register-evidence.test.ts`, `step-evidence-repository.int.test.ts` (cancelar no borra) |
| R39 | `evidence-target.test.ts`, `step-evidence-repository.int.test.ts`, `step-evidence-constraints.int.test.ts` |
| Códigos de error | `tests/unit/errores/evidence-codes.test.ts` |

Pendientes de tandas siguientes: R1, R2, R5, R7, R8 (UI), R9–R12 (`update-recipe`), R13, R15–R18,
R20, R22–R25, y la Server Action (T13).

### Salida real de la verificación

- `pnpm run db:migrate` → aplicada `20261013120000_order_step_evidence` (y 3 pendientes de `dev` en la
  base de desarrollo compartida); `pnpm run db:rollback` → revertida limpia; `db:migrate` de nuevo →
  «All migrations have been successfully applied».
- `pnpm run typecheck` → sin errores (corrido por el implementer al cerrar la tanda).
- `pnpm run lint` → `✖ 7 problems (0 errors, 7 warnings)`; los 7 en archivos ajenos
  (`tests/unit/documentos/confirm-catalog-import.test.ts`, `tests/unit/pedidos/order-service.test.ts`).
- T1–T2, 3 archivos de test tocados → `75/75` tests.
- T3–T7, tests de la tanda (integración con `.env`) → `Test Files 10 passed (10)`, `Tests 201 passed (201)`.
- T8–T12: `pnpm exec vitest run tests/unit/asignaciones tests/unit/paridad` → `Test Files 124 passed (124)`,
  `Tests 2465 passed (2465)`; 5 `.int.test.ts` modificados → `Test Files 5 passed (5)`, `Tests 40 passed (40)`.
- `pnpm exec vitest run guard` (final) → `Test Files 75 passed (75)`, `Tests 1053 passed | 20 skipped (1073)`.
- Nota: en T1 `vitest related` sobre `recipe-input.ts` arrastró 482 archivos (equivale a la suite);
  dio 1 rojo en `tests/integration/asignaciones/execution-atomicity.int.test.ts` que en solitario pasa
  14/14 (coincidió con otra corrida en el worktree de QC-235: saturación). Desde T3 no se usa
  `related` sobre archivos muy importados.

### Decisiones para el reviewer

1. Orden permiso/entrada: el permiso depende de `phase`. Se aplica `requireEvidenceAccess` (alguno
   de `asignaciones.ejecutar`/`empaque.modificar`) antes de parsear, `strictObject` después y
   `resolveEvidenceTarget` (permiso de la fase) antes de cualquier puerto.
2. Textos de los 5 errores: propuesta de `backend_dev` (el spec no los fija); ver `error-catalog.ts`.
3. `insert` reintenta si otro ocupa el mismo slot a la vez; `'limit'` solo con 3 reales.
4. `step-evidence-repository.int.test.ts` y `step-evidence-flag.int.test.ts` en modo `commit`
   (transacciones propias del adaptador y dos conexiones reales).
5. Dos asserts de QC-211 en `finish-packing.test.ts` y uno de QC-87 en
   `get-assigned-order-execution.test.ts` se actualizaron porque el design § 5.7 añade deps/campos.
6. `register-evidence` devuelve `{ photos, warnings }` y `remove-evidence` `{ stepPosition, photos, warnings }`;
   T13 escribe `warnings` en el log.
7. La fila `EVIDENCE_E2E_DOUBLES` de la guardia de dobles entró en T12, cuando la composición ya
   elegía el doble (en T6 la guardia exigía ese cableado).

### Arreglo tras `./init.sh` rápido (2026-10-13)

- `a2dace42`: `recetas-constraints.int.test.ts` excluye por nombre exacto `order_step_evidence` del invariante «sin tabla de pasos» (cualquier otra tabla `%step%` sigue fallando); `pedidos/company-scope.int.test.ts` retira y restaura la FK `order_step_evidence_order_id_company_id_fkey` junto a las otras 5 dependientes de `orders_id_company_id_key`. Sin tocar migraciones. `npx vitest run --project integration` de los dos → `Test Files 2 passed (2)`, `Tests 36 passed (36)`; typecheck limpio, lint 0 errores.

## Tanda 2 · frontend_dev · T15 y T16 (2026-10-13)

Archivos: `components/ui/switch.tsx` (nuevo), `tests/unit/shared-ui/switch.test.tsx` (nuevo),
`components/shared/step-reader/step-reader.tsx`, `tests/unit/recetas-ui/step-reader.test.tsx`
(casos añadidos al final; los existentes sin tocar), `components/shared/CATALOGO.md` (fila nueva
`Switch`, fila `StepReader` con los tres puntos de extensión), `tasks.md` (T15, T16 en [x]).
Commits: `d4873ebe` (T15), `f6c18518` (T15: el test usa `setupUser`, lo pedía
`guard-teclear-y-plazo`), `0c96e0e0` (T16).

| R | Test |
|---|---|
| R1 | `tests/unit/shared-ui/switch.test.tsx` (role switch, aria-checked, teclado, deshabilitado, medidas, 44 px) |
| R15 | `tests/unit/recetas-ui/step-reader.test.tsx` > «puntos de extension de la evidencia por paso» (motivo bloquea Siguiente y Finalizar, prioridad de pendientes, null no bloquea, addon) |
| R16 | ídem (motivo de subida bloquea; prioridad de pendientes) |
| R22 | ídem (`stepRequest` navega aunque el paso esté bloqueado y avisa a `onStepChange`; id de montaje, id repetido y paso actual no avisan) |

Salida real: `pnpm run typecheck` sin errores; `pnpm run lint` 0 errores, 7 avisos en archivos
ajenos (`confirm-catalog-import.test.ts`, `order-service.test.ts`); `vitest related --run` de
`step-reader.tsx` y `switch.tsx`: 41 archivos, 818 tests verdes; `vitest run guard`: 75 archivos
verdes tras el arreglo de `setupUser` (antes, 2 rojos en `guard-teclear-y-plazo`).

Decisiones para el reviewer: el `Switch` mide 44 px de alto por debajo de 768 px y 36 px desde
ahí (como `touch="mobile"` de `Button`; el tablero usa 760 px de contenedor). `stepRequest` se
sigue con `useEffectEvent`; el `id` con el que se monta no navega.

Veredicto: T15 y T16 hechas, verdes en typecheck, lint, related y guardias.

## Tanda 2 (2026-10-13) — backend_dev: T13 y T14

| Task | Commit |
|---|---|
| T13 | `0986c991` Server Actions de evidencia y su cableado |
| T14 | `a3a1cacd` bloqueo de mover/quitar pasos al guardar |

**Nuevos:** `lib/modules/asignaciones/adapters/driving/step-evidence-actions.ts`,
`lib/modules/recetas/domain/{recipe-step-lock,get-recipe-step-lock}.ts`,
`lib/modules/recetas/ports/recipe-step-lock-reader.ts`,
`tests/unit/asignaciones/step-evidence-actions.test.ts`,
`tests/unit/recetas/{recipe-step-lock,get-recipe-step-lock}.test.ts`.

**Modificados:** `lib/composition/index.ts` (solo añadidos: imports al final de sus bloques,
`evidenceTargetDeps`, `countEvidenceLockingOrders`, `recipeStepLockReader`, `listVersionIdsIncludingDeleted`
en `recipeRepository`, `stepLocks` en `updateRecipe`, `getRecipeStepLock` al final de `recetas`, tres
casos de uso al final de `asignaciones`); `recetas`: `update-recipe.ts`, `recipe-repository.ts`,
`recipe-prisma.ts` (`listRecipeVersionIdsIncludingDeleted`), `recipe-actions.ts`
(`getRecipeStepLockAction`), `index.ts`; `tests/helpers/evidence-off.ts` (`noEvidenceLocks`);
censo de `tests/unit/identity/session-once-per-request-actions.test.ts`; dobles de
`RecipeRepository` y deps de `createUpdateRecipe` en 15 tests unitarios y 3 de integración;
`recipe-actions.test.ts`, `update-recipe.test.ts`, `step-evidence-flag.int.test.ts` (casos nuevos).

**Mapa R<n> -> test (esta tanda):**

| R | Test |
|---|---|
| R7 | `update-recipe.test.ts` («R7: sin recetas.modificar…»), `authorization.test.ts` |
| R8 (dato del aviso) | `get-recipe-step-lock.test.ts`, `recipe-actions.test.ts` |
| R9, R10 | `recipe-step-lock.test.ts`, `update-recipe.test.ts`, `recipe-actions.test.ts`, `step-evidence-flag.int.test.ts` |
| R11 | `recipe-step-lock.test.ts`, `update-recipe.test.ts` |
| R12 | `update-recipe.test.ts`, `get-recipe-step-lock.test.ts`, `step-evidence-flag.int.test.ts` |
| R18 (registro en servidor) | `step-evidence-actions.test.ts` |
| R26, R27 (borde) | `step-evidence-actions.test.ts` |

**Verificación:** `pnpm run typecheck` sin errores; `pnpm run lint` → `✖ 7 problems (0 errors, 7 warnings)`
(los mismos 7 ajenos); `vitest run tests/unit/recetas` + actions + censo de sesión →
`Test Files 69 passed (69)`, `Tests 1198 passed (1198)`; `recipe-actions.test.ts` 35/35;
`step-evidence-flag.int.test.ts` 8/8 (el primer intento dio 57P03: Postgres local en recuperación;
al reintentar, verde); `recipe-crud` + `formula-import` + `formula-import-versions` int →
`Test Files 3 passed (3)`, `Tests 26 passed (26)`; `pnpm exec vitest run guard` →
`Test Files 75 passed (75)`, `Tests 1054 passed | 20 skipped (1074)`.

**Decisiones para el reviewer:**
1. Las advertencias de register/remove van a `forModule('asignaciones').warn('evidence_storage_cleanup_failed', {operation, path, message})`; la ruta es `<empresa>/<pedido>/<uuid>`, sin datos de quien usa la app.
2. `removeEvidenceAction` devuelve `{ photos }` como dice el design § 6 (el caso de uso trae además `stepPosition`, que no se expone).
3. Forma canónica del paso: claves ordenadas (`jsonb` las reordena) y sin marcas `false`/ausentes; `requiresEvidence` fuera.
4. Insertar un paso en medio cuenta como mover (desplaza a los de detrás): lo prueba `update-recipe.test.ts`.
5. `getRecipeStepLock` sobre una versión responde por su original (el design no lo fija; una versión no tiene pasos propios).
6. `stepLocks` es dependencia obligatoria de `createUpdateRecipe`: si la composición no la diera, no compilaría.

Veredicto: T13 y T14 hechas, verificación verde.

## Tanda 2 (2026-10-13): T17 a T21, consolidado del implementer

### Commits

| Task | Commit |
|---|---|
| T17 | `943fb849` pieza compartida `step-evidence` (subida firmada, diálogo «Falta evidencia») |
| T19 | `fc97a1cc` editor de fórmulas: switch «Requiere evidencia» y bloqueo de mover/quitar |
| T18 | `ce9af14b` evidencia por paso en Ejecución y Empaque |
| contrato | `f19bf71c` `recipe-route-contract.test.ts` admite las ampliaciones de QC-214 (2 rojos que destapó T18) |
| T20 | `915fcecf` E2E del operador con evidencia por paso |

### Archivos

- **T17:** `components/shared/step-evidence/{step-evidence.tsx,upload-evidence.ts,evidence-missing-dialog.tsx,index.ts}`,
  fila nueva en `components/shared/CATALOGO.md` (tableros `EvidenciaPaso*.dc.html`),
  `tests/unit/shared-ui/{step-evidence.test.tsx,upload-evidence.test.ts}`.
- **T18:** `app/(private)/asignacion/components/use-step-evidence.tsx` (hook nuevo, compartido por las
  dos subrutas y reexportado en `components/index.ts`), `order-execution-screen.tsx` y
  `packing-order-screen.tsx`; tests nuevos `tests/unit/asignaciones-ui/{order-execution-evidence,packing-order-evidence}.test.tsx`;
  ajustes de fixture/mock en `order-execution-page.test.tsx` y `packing-order-page.test.tsx`.
- **T19:** `app/(private)/produccion/formulas/components/{recipe-step-editor,recipe-steps-field,recipe-form,recipe-version-form}.tsx`,
  `[id]/page.tsx`; tests nuevos `tests/unit/recetas-ui/{recipe-form-evidence-lock,recipe-version-form-evidence}.test.tsx`,
  casos añadidos en `recipe-step-editor.test.tsx` y `recipe-steps-field.test.tsx`; una línea de mock
  (`getRecipeStepLockAction`) en `recipe-form.test.tsx`, `tests/unit/paridad/recetas-paridad.test.tsx` y
  `tests/unit/navegacion/pantallas-exigen-permiso.test.tsx`.
- **Contrato:** `tests/unit/recetas-ui/recipe-route-contract.test.ts`, con `getRecipeStepLockAction` en
  `permitidas`, `EVIDENCIA_POR_PASO_QC214` (10 archivos de `lib/modules/recetas`) y `MIGRACION_QC214`
  añadidos al final de sus listas.
- **T20:** `e2e/ejecucion-receta.spec.ts` (un caso nuevo y limpieza de fotos en `beforeAll`/`afterAll`).

### Mapa R<n> -> test (completo, R1 a R39)

| R | Test |
|---|---|
| R1 | `tests/unit/shared-ui/switch.test.tsx`, `tests/unit/recetas-ui/{recipe-step-editor,recipe-steps-field,recipe-form-evidence-lock}.test.tsx` |
| R2 | `recipe-steps-field.test.tsx`, `recipe-form-evidence-lock.test.tsx` |
| R3, R4 | `tests/unit/recetas/recipe-input.test.ts`, `tests/integration/recetas/step-evidence-flag.int.test.ts` |
| R5 | `recipe-step-editor.test.tsx`, `recipe-steps-field.test.tsx`, `recipe-form-evidence-lock.test.tsx` |
| R6 | `step-evidence-flag.int.test.ts`, `tests/unit/recetas-ui/recipe-version-form-evidence.test.tsx` |
| R7 | `tests/unit/recetas/update-recipe.test.ts` |
| R8 | `recipe-form-evidence-lock.test.tsx`, `recipe-steps-field.test.tsx`; dato: `get-recipe-step-lock.test.ts`, `recipe-actions.test.ts`, `count-evidence-locking-orders.test.ts` |
| R9, R10 | `recipe-step-lock.test.ts`, `update-recipe.test.ts`, `recipe-actions.test.ts`, `step-evidence-flag.int.test.ts`, `count-evidence-locking-orders.test.ts` |
| R11 | `recipe-step-lock.test.ts`, `update-recipe.test.ts` |
| R12 | `update-recipe.test.ts`, `get-recipe-step-lock.test.ts`, `step-evidence-flag.int.test.ts` |
| R13 | `tests/unit/shared-ui/step-evidence.test.tsx`, `tests/unit/asignaciones-ui/{order-execution-evidence,packing-order-evidence}.test.tsx`, `e2e/ejecucion-receta.spec.ts` |
| R14 | `order-execution-evidence.test.tsx`, `packing-order-evidence.test.tsx`, `get-assigned-order-execution.test.ts`, `get-packing-order.test.ts` |
| R15 | `step-reader.test.tsx`, `order-execution-evidence.test.tsx`, `packing-order-evidence.test.tsx`, `e2e/ejecucion-receta.spec.ts` |
| R16 | `step-reader.test.tsx`, `step-evidence.test.tsx`, `upload-evidence.test.ts`, `order-execution-evidence.test.tsx` |
| R17 | `step-evidence.test.tsx`, `upload-evidence.test.ts`, `order-execution-evidence.test.tsx` |
| R18 | `upload-evidence.test.ts`, `step-evidence.test.tsx`, `step-evidence-actions.test.ts`, `e2e/ejecucion-receta.spec.ts` |
| R19 | `step-evidence.test.tsx`, `upload-evidence.test.ts`, `order-execution-evidence.test.tsx`, `packing-order-evidence.test.tsx`, `register-evidence.test.ts`, `remove-evidence.test.ts` |
| R20 | `step-evidence.test.tsx` (visor) |
| R21 | `step-evidence.test.tsx`, `register-evidence.test.ts`, `remove-evidence.test.ts`, `record-step-move-evidence.test.ts` |
| R22 | `step-reader.test.tsx`, `step-evidence.test.tsx` (diálogo), `order-execution-evidence.test.tsx`, `packing-order-evidence.test.tsx`, `e2e/ejecucion-receta.spec.ts` |
| R23 | `order-execution-evidence.test.tsx`, `packing-order-evidence.test.tsx`, `e2e/ejecucion-receta.spec.ts` |
| R24 | `step-evidence.test.tsx` (modo solo lectura de la pieza; su consumidor es QC-271, design § «Lo que ya existe») |
| R25 | `step-evidence.test.tsx` (44 px, `accept`, `capture="environment"`) |
| R26, R27 | `request-evidence-upload.test.ts`, `register-evidence.test.ts`, `remove-evidence.test.ts`, `evidence-target.test.ts`, `step-evidence-actions.test.ts` |
| R28 | `step-evidence.test.ts`, `request-evidence-upload.test.ts`, `register-evidence.test.ts` |
| R29 | `request-evidence-upload.test.ts`, `register-evidence.test.ts`, `step-evidence-repository.int.test.ts`, `step-evidence-constraints.int.test.ts` |
| R30, R31 | `step-evidence.test.ts`, `register-evidence.test.ts`, `evidence-storage-memory.test.ts`, `step-evidence-constraints.int.test.ts` |
| R32 | `register-evidence.test.ts`, `step-evidence-constraints.int.test.ts` |
| R33 | `get-assigned-order-execution.test.ts`, `get-packing-order.test.ts`, `register-evidence.test.ts`, `evidence-storage-memory.test.ts` |
| R34 | `record-step-move-evidence.test.ts` |
| R35 | `finish-assigned-order.test.ts`, `step-evidence.test.ts`, `e2e/ejecucion-receta.spec.ts` (rechazo `evidence_required` de punta a punta) |
| R36 | `finish-packing.test.ts`, `step-evidence.test.ts` |
| R37 | `record-step-move-evidence.test.ts`, `finish-assigned-order.test.ts`, `finish-packing.test.ts` |
| R38 | `evidence-target.test.ts`, `register-evidence.test.ts`, `step-evidence-repository.int.test.ts` |
| R39 | `evidence-target.test.ts`, `step-evidence-repository.int.test.ts`, `step-evidence-constraints.int.test.ts` |

### Salida real

- T17: `vitest related --run` de sus 4 archivos → `Test Files 2 passed (2)`, `Tests 31 passed (31)`.
- T19: `vitest related --run` → `Test Files 28 passed (28)`, `Tests 480 passed (480)`.
- T18: `order-execution-evidence` 13/13, `packing-order-evidence` 10/10, los dos tests de página 18/18.
  Destapó 2 rojos en `recipe-route-contract.test.ts` (no estaban en `baseline-rojos.json`), que se arreglaron en `f19bf71c` → `Tests 28 passed (28)`.
- T20: `pnpm exec playwright test e2e/ejecucion-receta.spec.ts` → `8 passed (2.3m)` (3 casos existentes y el nuevo, en chromium y webkit).
- `pnpm exec vitest run guard` (tras T20) → `Test Files 75 passed (75)`, `Tests 1054 passed | 20 skipped (1074)`.
- Typecheck sin errores y lint con 0 errores (7 avisos ajenos), en cada task.
- `./init.sh` (rápido), T21: typecheck limpio, lint `✖ 7 problems (0 errors, 7 warnings)`, guardias
  verdes, `test:rapido` → `Test Files 3 failed | 844 passed (847)`, `Tests 3 failed | 13472 passed | 34 skipped (13509)`.
  Los 3 rojos nuevos: `catalog-line.int.test.ts` R32 (deuda D33 de entorno, ajena) y dos contratos
  que QC-214 desfasó, `asignaciones-facade.test.ts` (tres operaciones nuevas) y
  `recetas/module-contract.test.ts` (tres archivos nuevos). Los arregló `8916f0ae`, solo en los tests:
  `vitest run` de los dos → `Test Files 2 passed (2)`, `Tests 31 passed (31)`. No relancé `./init.sh`
  entero (más de 10 min). Lo vuelve a correr el leader en el gate.

### Decisiones para el reviewer (T17 a T20)

1. T17: valida y comprime **antes** de pedir el enlace (design § 7 lo pone después) para que un archivo inválido no llegue al servidor.
2. T17: `stepPosition` es una prop extra de `StepEvidence`, para los nombres accesibles del tablero. El visor usa un `DialogClose` propio de 44 px con el texto «Cerrar». Las fotos firmadas se pintan con `<img>`, como en `entity-image`.
3. T18: el bloque del Empaque solo aparece con `showsPackingSteps`; quien no empaca no ve el paso a paso (pregunta abierta 5). El modo de solo lectura (R24) queda en la pieza para QC-271.
4. T18: si «Cambiar» o «Quitar» fallan en el servidor, la foto original se queda y se añade una casilla en error. Con 3 fotos pueden verse 4 casillas un momento; el tablero no define este caso.
5. T18: con algún paso que exige evidencia, la confirmación cambia su texto por el de R23.
6. T19: `locked` va en `recipe-steps-field`, donde viven mover y quitar, no en el editor. El switch queda fuera del `role="toolbar"` de formato. Con bloqueo, «Quitar» también se deshabilita en los pasos nuevos. El aviso usa `Notice` en tono warning.
7. T20: el orden del E2E cambia respecto a tasks.md. Con el paso 1 sin foto, Siguiente queda bloqueado y la UI no deja llegar a Finalizar. El caso parte de un pedido ya en curso en el paso 2: «Falta evidencia» → «Paso 1» → subir → avanzar. Una segunda pestaña quita la foto, Finalizar se rechaza con `evidence_required` (R35), luego se sube otra vez y se finaliza.
8. Switch (T15): mide 44 px por debajo de 768 px de ventana; el tablero corta a 760 px de contenedor.

## Menores del review y F2.3 (2026-10-13)

### Menores (review OK, a592db7c)
- `6186d14b` m1 y m2: `design.md > 7` cuenta el orden real (comprimir, luego el enlace firmado) y `tasks.md > T20` el flujo real del E2E. Solo cambia la redacción.
- `d50ffab9` m3: si «Cambiar» trae la ruta de la foto sustituida, `register-evidence.ts` lanza `ValidationError` (`invalid_input`) antes de descargar: no hay escritura ni borrado en el bucket. Test en `tests/unit/asignaciones/register-evidence.test.ts` (R19).
- `5e046719` m4: el P2002 sobre `order_step_evidence_company_path_key` devuelve `'path_taken'` en `insert`/`replace` (puerto y adaptador); el dominio lo traduce a `ValidationError` y no borra el archivo de otra foto. No se añadió ningún código al catálogo. Tests unitarios en `register-evidence.test.ts` y de integración en `tests/integration/asignaciones/step-evidence-repository.int.test.ts` (R19, R31).

### Merge de origin/dev (`1355d5f2`)
Entraron QC-235, QC-225, QC-269, QC-270, QC-272 y QC-273. Todos los conflictos se resolvieron uniendo las dos partes; no se descartó nada:
- `app/(private)/asignacion/[id]/components/order-execution-screen.tsx` y `app/(private)/asignacion/empaque/[id]/components/packing-order-screen.tsx`: import de `OperatorScreenFrame` + `STEP_READER_SIDE_COLUMN_RESERVE` (QC-269) más `useStepEvidence` (QC-214).
- `docs/diseno/canvas/canvas.json` (`order`): primero los tableros de dev (CountrySelect, ProductoTerminado*, PedidosPresentaciones*) y después los de QC-214 (EvidenciaPaso*, FormulaEvidencia*).
- `lib/modules/errores/domain/error-codes.ts` y `error-catalog.ts`: primero `company_not_found` (QC-235, ya en dev) y después los cinco códigos de QC-214.
- `tests/unit/errores/catalogo.test.ts`: longitud 93 (87 + 1 de QC-235 + 5 de QC-214).
- `tests/guards/guard-identificador-de-request.test.ts`: `MIGRACIONES_ESPERADAS` con `20261013120000_companies_country` y `20261013120000_order_step_evidence`.
- `tests/integration/aislamiento.json`: las dos entradas de QC-214 y las dos de QC-225.
- Se fusionaron solos: `lib/composition/index.ts`, `db/schema.prisma`, `components/shared/CATALOGO.md`, `docs/architecture.md`.

Migración aplicada a la base local (`pnpm run db:migrate`): `20261013120000_companies_country`. Hecho también: `pnpm install --frozen-lockfile` (trae `libphonenumber-js`, aprobada en QC-235) y `prisma generate`.
Ojo: las dos migraciones comparten el prefijo `20261013120000`. Prisma las ordena por nombre (`companies_country` antes que `order_step_evidence`) y son independientes entre sí.

### Salida real
- `pnpm run typecheck`: exit 0.
- `pnpm run lint`: 0 errores y 7 avisos, todos en archivos ajenos.
- `pnpm exec vitest run` sobre catalogo, guard-identificador-de-request, guard-aislamiento-integracion, order-execution-screen, packing-order-screen y register-evidence: 6 archivos, 197 tests en verde. `guard-catalogo-de-errores`: 34 en verde.
- Por falta de memoria no se corrieron `./init.sh`, la suite completa ni el E2E: el gate completo lo da CI.
