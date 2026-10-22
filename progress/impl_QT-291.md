# QT-291 — seleccion-de-modelo-por-tarea · bitácora del implementer

## T0. Lista de modelos (2026-10-22)

Lista aprobada en F1.4 (`design.md > 3`), sin modelos añadidos. Los cinco ids vienen del T0 de
QC-275 (confirmados el 2026-10-13); no hay ninguno nuevo que confirmar.

| Proveedor | model_id | Predet. | Fuente | Fecha |
|---|---|---|---|---|
| ANTHROPIC | `claude-haiku-5-5` | sí | docs.anthropic.com «Models overview» (T0 QC-275) | 2026-10-13 |
| GOOGLE | `gemini-3.8-flash` | sí | ai.google.dev/gemini-api/docs/models (T0 QC-275) | 2026-10-13 |
| GOOGLE | `gemini-3.5-flash-lite` | no | ídem | 2026-10-13 |
| OPENAI | `gpt-6-luna` | sí | platform.openai.com/docs/models (T0 QC-275) | 2026-10-13 |
| OPENROUTER | `anthropic/claude-haiku-5.5` | sí | `openrouter.ai/api/v1/models`: `input_modalities = ["text","image","file"]` | **re-comprobado 2026-10-22** |

**Pendiente de confirmar (sin key):** qué código devuelve OpenRouter al generar con un id
inexistente (`design.md > 7`). Sin credenciales, `POST /api/v1/chat/completions` responde `401`
antes de mirar el modelo, así que no se pudo observar. Se implementa con el supuesto del spec (404)
y queda abierto para verificar con una key real.

## T1. Esquema y migración (2026-10-22, backend_dev)

**Archivos**
- `db/schema.prisma`: modelo `AiModel` (`/// @module integraciones`, PK `(provider, modelId)`);
  `AiProvider` sin `recipeModel`/`catalogModel`; `AiProviderConnection` + `model` (`model_id`),
  `unavailableModel` (`unavailable_model`).
- `db/migrations/20261022120000_ai_models/migration.sql` y `down.sql` (design §2.2; seed exacto de §3).
- `tests/guards/guard-empresa-en-esquema.test.ts`: `ai_models` en `EXENTAS`; caso R7 pasa a doce;
  bullets de ejemplo del caso R14 con `ai_models`.
- `docs/architecture.md`: bullet de exentas, «doce tablas», con `ai_models`.
- `tests/guards/guard-identificador-de-request.test.ts`: carpeta `20261022120000_ai_models`.
- `tests/integration/aislamiento.json`: el test nuevo en `transaccion`.
- `tests/integration/integraciones/ai-models-migration.int.test.ts` (nuevo).
- `tests/integration/integraciones/ai-provider-migration.int.test.ts`: los casos que miran
  `recipe_model`/`catalog_model` o bajan su migración aplican antes el DOWN de `ai_models`
  (`withoutAiModels`); columnas del snapshot ordenadas por nombre (el DOWN las re-añade al final).

**R → test** (`ai-models-migration.int.test.ts`)
- R1: «R1: el catalogo de modelos no tiene columna de empresa…», «R1: el CHECK rechaza un id vacio…»,
  «R1: un proveedor con modelos no se puede borrar…», «R1 (sensibilidad)…», DOWN e ida-vuelta.
- R2: «R2: la migracion siembra exactamente la lista aprobada».
- R3: «R3: cada proveedor tiene exactamente un predeterminado», «R3: la base rechaza un segundo predeterminado…».
- R4: «R4: ai_providers ya no guarda modelos por uso», DOWN devuelve los valores de QC-275.
- R7: «R7: la conexion guarda una sola eleccion opcional…», «R7: la base rechaza una eleccion de otro proveedor…».

**Salida**
- `pnpm exec prisma validate`: válido. `prisma generate`: OK.
- Migración aplicada en la base de test: plantilla nueva `qct_tpl_75fd97af8ce3` construida (6/6 pasos).
- `pnpm exec vitest run guard`: 87 archivos, 1276 pass, 22 skipped, 0 fail.
- `vitest run` de los dos `.int.test.ts`: 2 archivos, 23 pass.
- `eslint` de los cuatro `.ts` tocados: 0 problemas.
- `pnpm run typecheck`: 5 errores. 4 esperados por quitar las columnas (T3:
  `ai-provider-catalog-prisma.ts`; T13: `e2e/integraciones-proveedor-ia.spec.ts` ×3) y 1 ajeno
  (`app/layout.tsx`: `LayoutProps`, tipo generado por Next que no existe en este worktree).

**Veredicto:** T1 hecha; el typecheck queda rojo hasta T3/T13 por diseño.

## PARADA (2026-10-22): spec en enmienda

El leader paró la implementación tras T1: el humano cambió decisiones del spec (5 modelos por
proveedor ordenados por calidad, predeterminado = mejor calidad/precio, textos nuevos de «Probar
conexión», ayuda sin conexión sin nombrar modelo, elegir modelo prueba antes de guardar).

**Dónde quedó:**
- T0: hecha para la lista **antigua** (5 modelos en total). Queda invalidada: hay que rehacerla
  con la lista que traiga el leader. No marcada en `tasks.md`.
- T1: hecha y verificada con el spec antiguo (esquema, migración, guardias, `.int` en verde).
  **El seed de `db/migrations/20261022120000_ai_models/migration.sql` y los casos R2/R3 de
  `ai-models-migration.int.test.ts` hay que rehacerlos** con la lista y predeterminados nuevos.
  El resto (tabla `ai_models`, borrado de `recipe_model`/`catalog_model`, `model`/`unavailable_model`,
  guardias) no cambia con la enmienda. No marcada en `tasks.md` hasta rehacer el seed.
- typecheck: 5 errores esperados (4 los cierran T3/T13; `app/layout.tsx` `LayoutProps` es ajeno,
  tipo generado por Next ausente en el worktree).
- T2–T14: sin empezar.
