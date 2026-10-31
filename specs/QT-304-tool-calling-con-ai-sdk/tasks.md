# QT-304 — tool-calling-con-ai-sdk · tasks.md

> Implementa `backend_dev`. Cada tanda cierra con `pnpm run typecheck`, `pnpm run lint`,
> `pnpm exec vitest related --run <archivos tocados>` y `pnpm exec vitest run guard`.
> Nada se instala sin la aprobación humana del spec (F1.4) y sin las filas de `docs/dependencias.md`
> (R48). P8 y P9 (`requirements.md > Preguntas abiertas`) se cierran antes de la tanda 3; si la
> respuesta cambia la propuesta, solo cambian `design.md > 5.4`, `model-fallback.ts` y su test.

## Tanda 0 — Verificación con red (hecha)

- [x] **T0.1** Cuatro checks de `ai`, `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/google` y
  versión fijada (D12). Hecho por el leader el 2026-10-31: datos en `progress/features/QT-304.md >
  Decisiones` y en `design.md > 8`.
- [x] **T0.3** Seed de marcas contrastado con OpenRouter `/models` por el humano el 2026-10-31 (D5,
  `design.md > 3.1`).
- [x] **T0.2** Firmas de la API del AI SDK y formato de nombre de herramienta en Gemini: **movidas
  a T4.2** (se verifican contra los tipos instalados).

## Tanda 1 — Esquema, catálogo y permisos

- [x] **T1.1** `db/schema.prisma`: `supportsTools` e `isEconomic` en `AiModel`; enum `AiModelRole`;
  modelo `AiAgentModelPair` (`design.md > 2.1`). Sin comentarios con claves de ficha.
- [x] **T1.2** Migración `20261031120000_ai_agent_model_pairs` (`migration.sql` + `down.sql`) según
  `design.md > 2.2`, con las tablas de §3.1 y §3.2. `ai_agent_model_pairs` en `EXENTAS` de
  `guard-empresa-en-esquema` (catorce → quince) y en el bullet de `docs/architecture.md`; carpeta en
  `guard-identificador-de-request`. *Hecho:* `ai-agent-model-pairs-migration.int.test.ts` y
  `ai-agent-model-pairs-migration.test.ts` verdes (R1–R3, R5–R9); guardias verdes.
- [x] **T1.3** `[P]` Permisos (`design.md > 2.3, 5.1`): `PERMISSIONS`, `SEED_ROLE_PERMISSIONS`,
  `ADMIN_EXCLUDED_PERMISSIONS`, `CORE_PERMISSIONS`; migración `20261031120100_ai_agent_model_pairs_permissions`;
  export de `requirePlatformPermission` en `identity/index.ts`; tests de arrastre de `design.md > 10`.
  *Hecho:* tests de permisos estático e integración verdes, `permissions.test.ts` ampliado verde
  (R16, R17), tests de arrastre verdes.
- [x] **T1.4** `AiModelOption` (+`supportsTools`, `isEconomic`) y `ai-provider-catalog-prisma.ts`;
  dobles de `ai-provider-doubles.ts`. *Hecho:* `ai-provider-connection-prisma.int.test.ts` ampliado
  verde (R4); tests existentes de `tests/unit/integraciones/ai-provider/` verdes.

## Tanda 2 — Pares de plataforma (depende de la 1)

- [x] **T2.1** `domain/ai-model-pair.ts` (tipos, `AI_MODEL_ROLES`, `aiModelPairProblems`) y
  `ports/ai-model-pair-repository.ts`. *Hecho:* `ai-model-pair-rules.test.ts` verde (R10, R11).
  **Desbloquea la tanda 3.**
- [x] **T2.2** `adapters/driven/persistence/ai-model-pair-prisma.ts`. *Hecho:*
  `ai-model-pair-prisma.int.test.ts` verde (R5, R12) y en `aislamiento.json`. Vive en
  `adapters/driven/catalog/` y no en `persistence/` (ver `progress/impl_QT-304.md > Tanda 2`).
- [x] **T2.3** `domain/ai-model-pair-input.ts`, `domain/get-ai-model-pairs.ts`,
  `domain/save-ai-model-pair.ts`, exports en `index.ts` y cableado en `lib/composition/index.ts`
  (`design.md > 5.2, 7.1`). *Hecho:* `get-ai-model-pairs.test.ts` y `save-ai-model-pair.test.ts`
  verdes (R10–R15).

## Tanda 3 — Puerto, resolución, respaldo y casos de uso de generación (depende de T2.1; `[P]` con T2.2–T2.3)

- [ ] **T3.1** `ports/conversational-model.ts` con los tipos de `design.md > 4.1` (solo `zod` y tipos
  del módulo). *Hecho:* typecheck y `guard-arquitectura-modulos` verdes.
- [ ] **T3.2** `domain/model-fallback.ts`: `shouldFallBack` y el orquestador de intentos
  (`design.md > 5.4`). *Hecho:* `model-fallback.test.ts` verde (R23, R24).
- [ ] **T3.3** `domain/resolve-conversation-model.ts` (interno) y validaciones de
  `design.md > 4.2`. *Hecho:* cubierto por T3.4.
- [ ] **T3.4** `domain/generate-agent-text.ts` y `domain/generate-agent-object.ts`, exportados en
  `index.ts` (`design.md > 5.5`). *Hecho:* `generate-agent-text.test.ts` (R18–R28, R34, R37, R46) y
  `generate-agent-object.test.ts` (R23, R24, R38–R40) verdes con un puerto simulado.

## Tanda 4 — Adaptador del AI SDK (depende de la aprobación F1.4 y de la tanda 3)

- [ ] **T4.1** Filas de las cuatro dependencias en `docs/dependencias.md` (las de `design.md > 8`, con
  la fecha de F1.4); `pnpm add ai@^7.0.159 @ai-sdk/anthropic@^4.0.94 @ai-sdk/openai@^4.0.106
  @ai-sdk/google@^4.0.109`; `DEPENDENCIAS_ESPERADAS` de 45 a 49 con su línea de historia. Confirmar
  el riesgo ESM: `pnpm run typecheck`, un `vitest` que importe `ai` y `pnpm run build`. *Hecho:*
  `guard-dependencias-aprobadas` y `guard-identificador-de-request` verdes (R48); si el ESM rompe
  algo, se para y se pregunta.
- [ ] **T4.2** Verificar contra los tipos instalados las firmas de la tabla de `design.md > 7`,
  cómo expone el SDK una entrada de herramienta inválida y una herramienta desconocida
  (`design.md > 6`), y el formato de nombre de herramienta en Gemini (`design.md > 4.2`). *Hecho:*
  tabla de §7 a «verificado» o corregida en `design.md`; si algo obliga a cambiar el puerto, se para
  y se pregunta.
- [ ] **T4.3** `adapters/driven/ai/ai-sdk-models.ts`. *Hecho:* `ai-sdk-models.test.ts` verde (R41).
- [ ] **T4.4** `classifyAiSdkError` con la tabla de `design.md > 6`. *Hecho:*
  `classify-ai-sdk-error.test.ts` verde (R44, R45).
- [ ] **T4.5** `adapters/driven/ai/conversational-model-ai-sdk.ts`: `generateText` y
  `generateObject`, envoltorio de `execute` con `executed` (R33), sin reintentos, plazo y tope de
  pasos. *Hecho:* `conversational-model-ai-sdk.test.ts` verde con el modelo simulado de `ai/test`
  (R29–R36, R39, R42, R43).
- [ ] **T4.6** Cableado del adaptador en `lib/composition/index.ts` (`design.md > 7.1`) y guardia de
  aislamiento. *Hecho:* `ai-sdk-isolation.test.ts` verde (R47, R49); `ai-model-literals.test.ts`,
  `openai-sdk-isolation.test.ts` y `run-document-job-ai-provider.test.ts` siguen verdes sin cambios.

## Cierre

- [ ] **T5.1** Mapa `R<n> -> test` (R1–R49) en `progress/impl_QT-304.md`; `./init.sh` verde.

## Archivos esperados

- `db/schema.prisma`
- `db/migrations/20261031120000_ai_agent_model_pairs/migration.sql`
- `db/migrations/20261031120000_ai_agent_model_pairs/down.sql`
- `db/migrations/20261031120100_ai_agent_model_pairs_permissions/migration.sql`
- `db/migrations/20261031120100_ai_agent_model_pairs_permissions/down.sql`
- `package.json`
- `pnpm-lock.yaml`
- `docs/dependencias.md`
- `docs/architecture.md`
- `lib/modules/identity/domain/permissions.ts`
- `lib/modules/identity/domain/company-addons.ts`
- `lib/modules/identity/index.ts`
- `lib/modules/integraciones/domain/ai-provider.ts`
- `lib/modules/integraciones/domain/ai-model-pair.ts`
- `lib/modules/integraciones/domain/ai-model-pair-input.ts`
- `lib/modules/integraciones/domain/get-ai-model-pairs.ts`
- `lib/modules/integraciones/domain/save-ai-model-pair.ts`
- `lib/modules/integraciones/domain/resolve-conversation-model.ts`
- `lib/modules/integraciones/domain/model-fallback.ts`
- `lib/modules/integraciones/domain/generate-agent-text.ts`
- `lib/modules/integraciones/domain/generate-agent-object.ts`
- `lib/modules/integraciones/ports/ai-model-pair-repository.ts`
- `lib/modules/integraciones/ports/conversational-model.ts`
- `lib/modules/integraciones/adapters/driven/catalog/ai-provider-catalog-prisma.ts`
- `lib/modules/integraciones/adapters/driven/persistence/ai-model-pair-prisma.ts`
- `lib/modules/integraciones/adapters/driven/ai/ai-sdk-models.ts`
- `lib/modules/integraciones/adapters/driven/ai/conversational-model-ai-sdk.ts`
- `lib/modules/integraciones/index.ts`
- `lib/composition/index.ts`
- `tests/guards/guard-identificador-de-request.test.ts`
- `tests/guards/guard-empresa-en-esquema.test.ts`
- `tests/integration/aislamiento.json`
- `tests/integration/integraciones/ai-agent-model-pairs-migration.int.test.ts`
- `tests/integration/integraciones/ai-provider-connection-prisma.int.test.ts`
- `tests/integration/integraciones/ai-model-pair-prisma.int.test.ts`
- `tests/integration/identity/ai-agent-model-pairs-permissions-migration.int.test.ts`
- `tests/integration/identity/identity-seed.int.test.ts`
- `tests/unit/integraciones/schema/ai-agent-model-pairs-migration.test.ts`
- `tests/unit/identity/schema/ai-agent-model-pairs-permissions-migration.test.ts`
- `tests/unit/identity/permissions.test.ts`
- `tests/unit/identity/seed/seed-initial-access.test.ts`
- `tests/unit/identity/addons/company-addons.test.ts`
- `tests/unit/navegacion/qc75-convenciones.test.ts`
- `tests/unit/asignaciones/schema/order-assignments-migration.test.ts`
- `tests/unit/integraciones/ai-provider/ai-provider-doubles.ts`
- `tests/unit/integraciones/agente/ai-model-pair-rules.test.ts`
- `tests/unit/integraciones/agente/get-ai-model-pairs.test.ts`
- `tests/unit/integraciones/agente/save-ai-model-pair.test.ts`
- `tests/unit/integraciones/agente/model-fallback.test.ts`
- `tests/unit/integraciones/agente/generate-agent-text.test.ts`
- `tests/unit/integraciones/agente/generate-agent-object.test.ts`
- `tests/unit/integraciones/agente/conversational-model-ai-sdk.test.ts`
- `tests/unit/integraciones/agente/classify-ai-sdk-error.test.ts`
- `tests/unit/integraciones/agente/ai-sdk-models.test.ts`
- `tests/unit/integraciones/agente/ai-sdk-isolation.test.ts`
- `progress/impl_QT-304.md`
