# QT-291 — seleccion-de-modelo-por-tarea · bitácora del implementer

## T0. Lista de modelos (2026-10-22)

Rehecha con la lista enmendada de F1.4 (`design.md > 3`, veinte modelos). Fuente común de PDF e
imágenes: `https://openrouter.ai/api/v1/models` (los veinte con `file` + `image`, según el spec,
consultado el 2026-10-22). Ids nativos: consulta de solo lectura `GET /models/<id>` con las keys de
`.env` (sin generar texto). Keys disponibles: Gemini válida; Anthropic responde 401 (key no válida);
OpenAI no hay key.

| Proveedor | sort | model_id | Recom. | Fuente | Fecha / estado |
|---|---|---|---|---|---|
| ANTHROPIC | 1 | `claude-opus-5-5` | no | `GET api.anthropic.com/v1/models/<id>` | **pendiente (sin key válida: 401)** |
| ANTHROPIC | 2 | `claude-sonnet-5-5` | no | ídem | **pendiente (sin key válida: 401)** |
| ANTHROPIC | 3 | `claude-opus-5` | no | ídem | **pendiente (sin key válida: 401)** |
| ANTHROPIC | 4 | `claude-sonnet-5` | no | ídem | **pendiente (sin key válida: 401)** |
| ANTHROPIC | 5 | `claude-haiku-5-5` † | sí | T0 QC-275 (docs.anthropic.com) | 2026-10-13 |
| GOOGLE | 1 | `gemini-4-argon` | no | `GET generativelanguage.googleapis.com/v1beta/models/<id>` → 200 | 2026-10-22 |
| GOOGLE | 2 | `gemini-3.8-flash` † | sí | ídem → 200 | 2026-10-22 |
| GOOGLE | 3 | `gemini-3.7-flash` | no | ídem → 200 | 2026-10-22 |
| GOOGLE | 4 | `gemini-3.5-flash-lite` † | no | ídem → 200 | 2026-10-22 |
| GOOGLE | 5 | `gemini-3.1-flash-lite` | no | ídem → 200 | 2026-10-22 |
| OPENAI | 1 | `gpt-6.1-sol` | no | `models.retrieve` | **pendiente (sin key)** |
| OPENAI | 2 | `gpt-6-sol` | no | ídem | **pendiente (sin key)** |
| OPENAI | 3 | `gpt-6-luna-pro` | no | ídem | **pendiente (sin key)** |
| OPENAI | 4 | `gpt-6-luna` † | sí | T0 QC-275 (platform.openai.com) | 2026-10-13 |
| OPENAI | 5 | `gpt-5.6-luna` | no | `models.retrieve` | **pendiente (sin key)** |
| OPENROUTER | 1 | `anthropic/claude-sonnet-5.5` | no | `/api/v1/models`: `["text","image","file"]` | 2026-10-22 |
| OPENROUTER | 2 | `openai/gpt-6.1-sol` | no | `["file","image","text"]` | 2026-10-22 |
| OPENROUTER | 3 | `google/gemini-3.8-flash` | no | `["text","image","video","file","audio"]` | 2026-10-22 |
| OPENROUTER | 4 | `anthropic/claude-haiku-5.5` † | sí | `["text","image","file"]` | 2026-10-22 |
| OPENROUTER | 5 | `openai/gpt-6-luna` | no | `["file","image","text"]` | 2026-10-22 |

Ningún id respondió «no existe». Pendientes: 4 de Anthropic (excepto el †) y 4 de OpenAI (excepto el †).

**OpenRouter con id inexistente al generar (`design.md > 7`), verificado 2026-10-22 con key:**
`POST /api/v1/chat/completions` con `model: "no-existe/modelo-xyz"` responde **HTTP 400**
`{"error":{"message":"no-existe/modelo-xyz is not a valid model ID","code":400}}`, **no 404**. T6
ajusta `classifyOpenAiError` (solo para OpenRouter) con test, como prevé el spec.

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
