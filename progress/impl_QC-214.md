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
