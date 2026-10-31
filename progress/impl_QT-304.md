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

## Tanda 2 — Pares de plataforma (2026-10-31)

### Archivos creados

- `lib/modules/integraciones/domain/ai-model-pair.ts`: `AI_MODEL_ROLES`, `AiModelRole`,
  `AiModelPairChoice`, `AiModelPair`, `aiModelPairProblems` (pura, sobre `AiCatalogEntry`).
- `lib/modules/integraciones/domain/ai-model-pair-input.ts`: zod de la entrada.
- `lib/modules/integraciones/domain/get-ai-model-pairs.ts` y `save-ai-model-pair.ts`
  (`requirePlatformPermission` de `identity`, `PlatformActor`).
- `lib/modules/integraciones/ports/ai-model-pair-repository.ts`.
- `lib/modules/integraciones/adapters/driven/catalog/ai-model-pair-prisma.ts`
  (`createAiModelPairPrisma(db = prisma)`, upsert por `(provider, role)` con autor y hora).
- Tests: `tests/unit/integraciones/agente/ai-model-pair-rules.test.ts`,
  `save-ai-model-pair.test.ts`, `get-ai-model-pairs.test.ts`, `ai-model-pair-doubles.ts`;
  `tests/integration/integraciones/ai-model-pair-prisma.int.test.ts`.

### Archivos modificados

- `lib/modules/integraciones/index.ts`: tipos `AiCatalogModel`, `AiModelPair`, `AiModelRole`,
  `AiModelPairsOverview`, `AiModelPairsProvider`, `SaveAiModelPairResult`; `AI_MODEL_ROLES`,
  `createGetAiModelPairs`, `createSaveAiModelPair`.
- `lib/composition/index.ts`: `aiModelPairs: AiModelPairRepository`, `getAiModelPairs` y
  `saveAiModelPair` en la fachada `integraciones`.
- Arrastre (listas a mano): `tests/unit/integraciones/module-shape.test.ts` (archivos, contrato,
  fachada y tipo del puerto), `tests/unit/integraciones/encryption-keys-env.test.ts` y
  `tests/unit/composition/integraciones-graph-doubles.test.ts` (miembros de la fachada),
  `tests/integration/aislamiento.json` (entrada `commit` con motivo).

### Desviaciones

- **El adaptador vive en `adapters/driven/catalog/`, no en `persistence/`** (design §1 y T2.2 dicen
  `persistence/`). `guard-ambito-empresa-integraciones` barre todo `persistence/` y exige
  `scope: IntegracionesScope` en cada función que toca la base; la tabla de pares no tiene empresa.
  Meterla en `persistence/` pedía una exención nueva en la guardia (decisión humana). Se sigue el
  precedente de `ai-provider-catalog-prisma.ts` («tabla global sin empresa: por eso vive fuera de
  `persistence/`»). Si el humano prefiere la exención, es mover el archivo y añadirla.
- `createAiModelPairPrisma()` se cablea sin argumento (default `prisma`): la composición no importa
  el cliente Prisma.
- `saveAiModelPair` y `getAiModelPairs` lanzan el `UnauthorizedError` de `identity` (el que lanza
  `requirePlatformPermission`, como pide design §5.2), no el de `integraciones`. Mismo `code`
  (`unauthorized`). QT-311 lo tendrá en cuenta al mapear errores en su Server Action.

### Mapa R → test (tanda 2)

| R | Test |
|---|---|
| R5 | `ai-model-pair-prisma.int.test.ts` > «R5: list trae los ocho pares…», «R5: get devuelve…», «R5: get de un par que falta…», «R5: la base sigue cortando…» |
| R10 | `ai-model-pair-rules.test.ts` (8 casos R10); `save-ai-model-pair.test.ts` > validación (zod, otro proveedor, fuera de catálogo, iguales, sin herramientas, principal de enrutador no económico, proveedor ausente, recorte) |
| R11 | `ai-model-pair-rules.test.ts` > «R11: el respaldo del enrutador no se mira por economico»; `save-ai-model-pair.test.ts` > «R11: …se acepta» |
| R12 | `save-ai-model-pair.test.ts` > dos casos R12; `ai-model-pair-prisma.int.test.ts` > dos casos R12 |
| R13 | `save-ai-model-pair.test.ts` > 5 casos de autorización + «no exige empresa»; `get-ai-model-pairs.test.ts` > 4 casos + «basta con el permiso de consulta» |
| R14 | `get-ai-model-pairs.test.ts` > dos casos R14 |
| R15 | `save-ai-model-pair.test.ts` y `get-ai-model-pairs.test.ts` > dos casos R15 cada uno (espías y barrido del fuente) |

### Verificación (salida real, 2026-10-31)

- `pnpm run typecheck`: exit 0.
- `pnpm run lint`: `0 errors, 10 warnings` (los mismos de la tanda 1, archivos no tocados).
- `pnpm exec vitest run guard`: `Test Files 87 passed (87)`, `Tests 1327 passed | 22 skipped`.
- `pnpm exec vitest run tests/unit/integraciones tests/unit/composition`: verde tras actualizar las
  dos listas de la fachada (124 archivos).
- Integración: `ai-model-pair-prisma.int.test.ts` + `ai-agent-model-pairs-migration.int.test.ts`:
  `Test Files 2 passed`, `Tests 20 passed`.
- `pnpm run test:rapido`: lanzado dos veces y **parado por el sistema por falta de memoria** (no es
  un fallo del comando); no se relanzó. Lo relacionado con el diff ya está cubierto arriba (unit de
  `integraciones` y `composition`, guardias, int tocados).
- `./init.sh`: no se corre (para en el paso 4 por `feature_list.json`, QT-312).

Veredicto tanda 2: hecha, R5, R10–R15 con test; gate a mano verde.
