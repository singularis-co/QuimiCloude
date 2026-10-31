# QT-304 — bitácora de implementación (backend_dev)

## Tanda 1 — Esquema, catálogo y permisos (2026-10-31)

### Archivos creados

- `db/migrations/20261031120000_ai_agent_model_pairs/migration.sql` y `down.sql`
- `db/migrations/20261031120100_ai_agent_model_pairs_permissions/migration.sql` y `down.sql`
- `tests/integration/integraciones/ai-agent-model-pairs-migration.int.test.ts`
- `tests/unit/integraciones/schema/ai-agent-model-pairs-migration.test.ts`
- `tests/integration/identity/ai-agent-model-pairs-permissions-migration.int.test.ts`
- `tests/unit/identity/schema/ai-agent-model-pairs-permissions-migration.test.ts`

### Archivos modificados

- `db/schema.prisma`: `supportsTools`/`isEconomic` en `AiModel`, enum `AiModelRole`, modelo
  `AiAgentModelPair` (`/// @module integraciones`).
- `lib/modules/identity/domain/permissions.ts`: `modelos_ia.consultar`/`modelos_ia.modificar` en
  `PERMISSIONS` (al final, con párrafo en el JSDoc), en `SEED_ROLE_PERMISSIONS[ROLE_MAESTRO]` y en
  `ADMIN_EXCLUDED_PERMISSIONS`.
- `lib/modules/identity/domain/company-addons.ts`: los dos en `CORE_PERMISSIONS`.
- `lib/modules/identity/index.ts`: exporta `requirePlatformPermission`.
- `lib/modules/integraciones/domain/ai-provider.ts`: tipos `AiCatalogModel` y `AiCatalogEntry`
  (ver Desviaciones).
- `lib/modules/integraciones/ports/ai-provider-catalog.ts`: `list`/`get` devuelven `AiCatalogEntry`.
- `lib/modules/integraciones/adapters/driven/catalog/ai-provider-catalog-prisma.ts`: selecciona y
  devuelve las dos marcas.
- `docs/architecture.md`: bullet de exentas, catorce → quince, `ai_agent_model_pairs`.
- Arrastre (listas escritas a mano):
  - `tests/guards/guard-empresa-en-esquema.test.ts` (`EXENTAS`, 15)
  - `tests/guards/guard-identificador-de-request.test.ts` (`MIGRACIONES_ESPERADAS`, dos carpetas)
  - `tests/integration/aislamiento.json` (dos `.int.test.ts` en `transaccion`)
  - `tests/unit/integraciones/module-shape.test.ts` (R13: once modelos de `integraciones`)
  - `tests/unit/identity/permissions.test.ts` (catálogo, módulos, Maestro, excluidos; describe nuevo)
  - `tests/unit/identity/seed/seed-initial-access.test.ts`
  - `tests/unit/identity/addons/company-addons.test.ts` (describe nuevo)
  - `tests/unit/navegacion/qc75-convenciones.test.ts`
  - `tests/unit/asignaciones/schema/order-assignments-migration.test.ts`
  - `tests/integration/identity/identity-seed.int.test.ts` (Maestro con seis; caso nuevo de seed)
  - `tests/integration/integraciones/ai-models-migration.int.test.ts` y
    `ai-provider-migration.int.test.ts`: no estaban en la lista de arrastre del design. La migración
    nueva cuelga FK de `ai_models` y le añade columnas, así que sus casos aplican antes el `down.sql`
    de `*_ai_agent_model_pairs` (mismo patrón que `withoutAiModels`).
  - `tests/integration/integraciones/ai-provider-connection-prisma.int.test.ts` (R4)
  - `tests/unit/integraciones/ai-provider/ai-provider-doubles.ts` (marcas en el catálogo doble)

### Desviaciones

- **`AiModelOption` no gana las marcas; se añaden `AiCatalogModel` y `AiCatalogEntry`.** El design
  (§5.6) pide ampliar `AiModelOption` y dice que `toModelOptionState` no se toca. No es posible a la
  vez: `AiModelOption` y `AiProviderEntry` son también el tipo de la pantalla de la empresa
  (`ai-model-select.tsx`, `ai-provider-actions.ts`, `AiProviderConnectionView.modelOptions`) y el
  typecheck se rompe en UI y en ~20 fixtures de tests de UI. Solución sin tocar UI: el puerto
  `AiProviderCatalog` devuelve `AiCatalogEntry` (= `AiProviderEntry` con `models: AiCatalogModel[]`,
  asignable a `AiProviderEntry`), y las marcas no salen a la pantalla de la empresa, que es la
  intención del design. R4 se cumple. La tanda 2 (`getAiModelPairs`) usará `AiCatalogModel` donde el
  design dice `AiModelOption[]`.
- Worktree sin `node_modules` ni `.env`: `pnpm install --frozen-lockfile` (sin dependencias nuevas),
  copia del `.env` de la raíz (ignorado por git) y `next typegen` para `LayoutProps`.

### Mapa R → test (tanda 1)

| R | Test |
|---|---|
| R1 | `ai-agent-model-pairs-migration.int.test.ts` > «R1: ai_models gana supports_tools e is_economic…»; `ai-agent-model-pairs-migration.test.ts` > «R1: las dos columnas nacen NOT NULL…» |
| R2 | int > «R2: cada modelo sembrado queda con las marcas aprobadas», «R2: el UP no cambia ningun otro dato…»; estático > tres casos R2 |
| R3 | int > «R3: el DOWN quita la tabla…», «R3: vuelta e ida…»; estático > dos casos R3 |
| R4 | `ai-provider-connection-prisma.int.test.ts` > dos casos «QT-304 R4» |
| R5 | int > «R5: la tabla de pares no lleva empresa…», «R5: como mucho un par…», «R5 (sensibilidad)»; estático > «R5: RLS…» |
| R6 | int > «R6: la base rechaza un modelo de otro proveedor o fuera del catalogo…» |
| R7 | int > «R7: la base rechaza un par cuyo principal y respaldo son el mismo modelo» |
| R8 | int > dos casos R8; estático > dos casos R8 |
| R9 | int > «R9: un modelo que es principal o respaldo…» |
| R16 | `permissions.test.ts` > describe «los permisos de los modelos de IA de la plataforma» (7 casos); `company-addons.test.ts` > dos casos «QT-304 R16»; `seed-initial-access.test.ts`; `identity-seed.int.test.ts` > «QT-304 R16…»; estático de permisos > casos R16 |
| R17 | `ai-agent-model-pairs-permissions-migration.int.test.ts` (4 casos); `ai-agent-model-pairs-permissions-migration.test.ts` > casos R17 |

### Verificación (salida real, 2026-10-31)

- `pnpm run typecheck`: exit 0 (tras `next typegen`; sin `.next/types` el worktree nuevo daba
  `app/layout.tsx: Cannot find name 'LayoutProps'`, ajeno al cambio).
- `pnpm run lint`: exit 0, `0 errors, 10 warnings`, todas en archivos no tocados
  (`step-evidence.tsx`, `list-execution-traces.test.ts`, `confirm-catalog-import.test.ts`,
  `order-service.test.ts`).
- `pnpm run test:rapido` (related + guardias): `126 passed | 1 failed` → el rojo era el fixture de
  R14 de `guard-empresa-en-esquema` (lista a mano); corregido y `pnpm exec vitest run guard`:
  `Test Files 87 passed (87)`, `Tests 1327 passed | 22 skipped`.
- Integración tocada: `ai-agent-model-pairs-migration`, `ai-agent-model-pairs-permissions-migration`,
  `plans-permissions-migration`, `ai-models-migration`, `ai-provider-migration`,
  `ai-provider-connection-prisma`, `identity-seed` (+ `tests/unit/integraciones`,
  `tests/unit/identity`): verdes.
- `./init.sh`: exit 1 en el paso 4, **antes** de typecheck/tests: `feature_list.json invalido: id
  duplicado: 290 … 305` (la copia del board en la raíz del worktree principal mezcla ids de QC y QT).
  Ajeno a esta tanda; los pasos siguientes se corrieron a mano arriba y `check-perfil` da 6/6.

Veredicto tanda 1: hecha, R1–R9, R16, R17 y R4 con test; gate local verde salvo el validador del
board, ajeno.
