# QT-304 — tool-calling-con-ai-sdk · tasks.md

> Implementa `backend_dev`. Cada tanda cierra con `pnpm run typecheck`, `pnpm run lint`,
> `pnpm exec vitest related --run <archivos tocados>` y `pnpm exec vitest run guard`.
> Nada se instala sin la aprobación humana del spec (F1.4) y sin las filas de `docs/dependencias.md`
> (R38). Las preguntas P1–P7 de `requirements.md` se cierran en F1.4; si una respuesta cambia el
> diseño, el spec se corrige antes de implementar.

## Tanda 0 — Verificación con red (leader o humano; bloquea la tanda 4 y el seed de la tanda 1)

- [ ] **T0.1** Cuatro checks de `ai`, `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/google`
  (`npm view <pkg> deprecated time.modified version license peerDependencies` + descargas de la
  última semana). Fijar la versión exacta de la misma serie para los cuatro (P7) y confirmar que
  `peerDependencies.zod` admite `^4`. *Hecho:* datos anotados en `progress/features/QT-304.md` y en
  la fila propuesta de `design.md > 8`; si un check falla, se para y se pregunta.
- [ ] **T0.2** Confirmar en la versión fijada las firmas de la tabla de `design.md > 7` (texto con
  herramientas y tope de pasos, `tool`, salida estructurada vigente, pasos/llamadas, tokens,
  `APICallError`, modelo simulado de `ai/test`) y cómo expone el SDK una entrada de herramienta
  inválida y una herramienta desconocida (`design.md > 6`). *Hecho:* tabla de `design.md > 7`
  actualizada a «verificado» o corregida; si algo obliga a cambiar el puerto, se para y se pregunta.
- [ ] **T0.3** Contrastar el seed de `design.md > 3` con `https://openrouter.ai/api/v1/models`
  (`supported_parameters`, precio) y confirmar el formato de nombre de herramienta en Gemini
  (`design.md > 4.2`). *Hecho:* tabla de §3 confirmada o corregida con la fuente y la fecha (P2).

## Tanda 1 — Esquema y catálogo (depende de T0.3 para los valores del seed)

- [ ] **T1.1** `db/schema.prisma`: `supportsTools` e `isEconomic` en `AiModel`; `routerModel` en
  `AiProviderConnection` (`design.md > 2.1`). Sin comentarios con claves de ficha.
- [ ] **T1.2** Migración `20261031120000_ai_model_capabilities` (`migration.sql` + `down.sql`) según
  `design.md > 2.2`; carpeta añadida a `tests/guards/guard-identificador-de-request.test.ts`.
  *Hecho:* `ai-model-capabilities-migration.int.test.ts` verde con R1, R2, R3, R5 y R6; guardias
  verdes.
- [ ] **T1.3** Dominio y adaptadores de datos: `AiModelOption` (+`supportsTools`, `isEconomic`),
  `AiProviderConnectionRecord`/`NewAiProviderConnectionRow`/`AiProviderConnectionPatch`
  (+`routerModel`), `ai-provider-catalog-prisma.ts` y `ai-provider-connection-prisma.ts`.
  *Hecho:* `ai-provider-connection-prisma.int.test.ts` ampliado verde (R4, R5); tests existentes de
  `tests/unit/integraciones/ai-provider/` y sus dobles actualizados y verdes.
- [ ] **T1.4** `save-ai-provider-connection.ts`: cambio de proveedor vacía `routerModel`; mismo
  proveedor lo conserva; `create` nace en nulo (`design.md > 5.4`). *Hecho:* casos R12 en
  `save-ai-provider-connection.test.ts`.

## Tanda 2 — Modelo enrutador (depende de la 1)

- [ ] **T2.1** `routerEconomicModel` en `domain/ai-provider.ts` (`design.md > 5.1`). *Hecho:*
  `router-economic-model.test.ts` verde (R14, R15).
- [ ] **T2.2** `domain/select-ai-router-model.ts` + zod de entrada + export en `index.ts` + cableado
  en `lib/composition/index.ts` (`design.md > 5.2`, permiso según P3). *Hecho:*
  `select-ai-router-model.test.ts` verde (R7–R11).

## Tanda 3 — Puerto y casos de uso de generación (depende de la 1; `[P]` con la 2)

- [ ] **T3.1** `ports/conversational-model.ts` con los tipos de `design.md > 4.1` (solo `zod` y
  tipos del módulo). *Hecho:* typecheck y `guard-arquitectura-modulos` verdes.
- [ ] **T3.2** `domain/resolve-conversation-model.ts` (interno) y validaciones de
  `design.md > 4.2`. *Hecho:* cubierto por T3.3.
- [ ] **T3.3** `domain/generate-agent-text.ts` y `domain/generate-agent-object.ts`, exportados en
  `index.ts` (`design.md > 5.3`). *Hecho:* `generate-agent-text.test.ts` (R13, R16–R18, R24, R27,
  R36) y `generate-agent-object.test.ts` (R28–R30) verdes con un puerto simulado.

## Tanda 4 — Adaptador del AI SDK (depende de T0.1, T0.2, la aprobación F1.4 y la tanda 3)

- [ ] **T4.1** Filas de las cuatro dependencias en `docs/dependencias.md` con los datos de T0.1;
  instalar con `pnpm add` las versiones fijadas; `DEPENDENCIAS_ESPERADAS` de 45 a 49 con su línea
  de historia. *Hecho:* `guard-dependencias-aprobadas` y `guard-identificador-de-request` verdes
  (R38).
- [ ] **T4.2** `adapters/driven/ai/ai-sdk-models.ts` (`design.md > 7`). *Hecho:*
  `ai-sdk-models.test.ts` verde (R31).
- [ ] **T4.3** `classifyAiSdkError` con la tabla de `design.md > 6`. *Hecho:*
  `classify-ai-sdk-error.test.ts` verde (R34, R35).
- [ ] **T4.4** `adapters/driven/ai/conversational-model-ai-sdk.ts`: `generateText` y
  `generateObject`, envoltorio de `execute` (R23), sin reintentos, plazo y tope de pasos. *Hecho:*
  `conversational-model-ai-sdk.test.ts` verde con el modelo simulado de `ai/test` (R19–R26, R29,
  R32, R33).
- [ ] **T4.5** Cableado en `lib/composition/index.ts` (`design.md > 7.1`) y guardia de aislamiento.
  *Hecho:* `ai-sdk-isolation.test.ts` verde (R37, R39); `ai-model-literals.test.ts` y
  `openai-sdk-isolation.test.ts` siguen verdes sin cambios.

## Cierre

- [ ] **T5.1** Mapa `R<n> -> test` (R1–R39) en `progress/impl_QT-304.md`; `./init.sh` verde.

## Archivos esperados

- `db/schema.prisma`
- `db/migrations/20261031120000_ai_model_capabilities/migration.sql`
- `db/migrations/20261031120000_ai_model_capabilities/down.sql`
- `package.json`
- `pnpm-lock.yaml`
- `docs/dependencias.md`
- `lib/modules/integraciones/domain/ai-provider.ts`
- `lib/modules/integraciones/domain/save-ai-provider-connection.ts`
- `lib/modules/integraciones/domain/ai-router-model-input.ts`
- `lib/modules/integraciones/domain/select-ai-router-model.ts`
- `lib/modules/integraciones/domain/resolve-conversation-model.ts`
- `lib/modules/integraciones/domain/generate-agent-text.ts`
- `lib/modules/integraciones/domain/generate-agent-object.ts`
- `lib/modules/integraciones/ports/ai-provider-connection-repository.ts`
- `lib/modules/integraciones/ports/conversational-model.ts`
- `lib/modules/integraciones/adapters/driven/catalog/ai-provider-catalog-prisma.ts`
- `lib/modules/integraciones/adapters/driven/persistence/ai-provider-connection-prisma.ts`
- `lib/modules/integraciones/adapters/driven/ai/ai-sdk-models.ts`
- `lib/modules/integraciones/adapters/driven/ai/conversational-model-ai-sdk.ts`
- `lib/modules/integraciones/index.ts`
- `lib/composition/index.ts`
- `tests/guards/guard-identificador-de-request.test.ts`
- `tests/integration/integraciones/ai-model-capabilities-migration.int.test.ts`
- `tests/integration/integraciones/ai-provider-connection-prisma.int.test.ts`
- `tests/unit/integraciones/ai-provider/ai-provider-doubles.ts`
- `tests/unit/integraciones/ai-provider/router-economic-model.test.ts`
- `tests/unit/integraciones/ai-provider/select-ai-router-model.test.ts`
- `tests/unit/integraciones/ai-provider/save-ai-provider-connection.test.ts`
- `tests/unit/integraciones/agente/generate-agent-text.test.ts`
- `tests/unit/integraciones/agente/generate-agent-object.test.ts`
- `tests/unit/integraciones/agente/conversational-model-ai-sdk.test.ts`
- `tests/unit/integraciones/agente/classify-ai-sdk-error.test.ts`
- `tests/unit/integraciones/agente/ai-sdk-models.test.ts`
- `tests/unit/integraciones/agente/ai-sdk-isolation.test.ts`
- `progress/impl_QT-304.md`
