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

## T1 (resto). Seed de veinte modelos (2026-10-22, backend_dev)

**Archivos**
- `db/migrations/20261022120000_ai_models/migration.sql`: el `INSERT` con las veinte filas de
  `design.md > 3` (`sort_order` 1–5 por proveedor, `is_default` en los cuatro recomendados).
  `down.sql` sin cambios.
- `tests/integration/integraciones/ai-models-migration.int.test.ts`: `SEEDED` con las veinte filas y
  `DEFAULTS`; casos R2 y R3 rehechos.
- `tests/unit/integraciones/module-shape.test.ts`: el caso de modelos de `integraciones` del esquema
  pasa a nueve (`AiModel`, que añadió T1 en `418a746f` y no se había ajustado).

**R → test** (`ai-models-migration.int.test.ts`)
- R2: «R2: la migracion siembra exactamente la lista aprobada, cinco por proveedor con orden 1 a 5».
- R3: «R3: cada proveedor tiene exactamente un predeterminado y es el aprobado».

**Salida**
- `pnpm exec prisma validate`: válido.
- Plantilla de test reconstruida sola por la huella: `qct_tpl_a9127c0147c3` (6/6 pasos).
- `ai-models-migration.int.test.ts` + `ai-provider-migration.int.test.ts`: 2 archivos, 23 pass.

## T2. Tipos y textos (2026-10-22, backend_dev)

**Archivos**
- `lib/modules/integraciones/domain/ai-provider.ts`: `AiModelOption`; `AiProviderEntry` con `models`
  y `defaultModel`; registro con `model`/`unavailableModel`; vista con `modelInUse`,
  `modelIsDefault`, `modelUnavailable`, `modelOptions` (sin el marcado); `modelInUse()` (lanza si la
  elección no está en la entrada); fuera `AiReadUse`.
- `lib/modules/integraciones/domain/ai-provider-failure.ts`: `marksConnection`,
  `modelUnavailableNotice`, `isModelUnavailableNotice`, `isAccountFailureNotice`; texto de
  `model_unavailable` de la prueba (R20); `READING_FAILURE_PREFIX` se muda aquí (lo necesitan los
  reconocedores y así no hay import circular).
- `lib/modules/integraciones/domain/report-ai-provider-outcome.ts`: solo importa
  `READING_FAILURE_PREFIX` del archivo de fallos (el resto es T5).
- `lib/modules/integraciones/index.ts`: − `AiReadUse`, + `AiModelOption`.
- Tests: `connection-view.test.ts`, `ai-provider-failure.test.ts`, `module-shape.test.ts` (contrato).

**R → test**
- R13: `connection-view.test.ts` «R13: la vista tiene exactamente los campos publicos…», «R13: la
  vista serializada no contiene…», «R13: un campo extra en la fila o en una opcion…».
- R16/R17: `connection-view.test.ts` «R17, R26, R27: sin eleccion…», «R17: si el marcado ya no es el
  modelo en uso…», `modelInUse` «R17: sin eleccion devuelve el predeterminado…», «R16: con eleccion…».
- R27: «R27: con eleccion, el modelo en uso es la eleccion…».
- R28 (vista): «R28: si el modelo en uso es el marcado…», «R28: el predeterminado marcado tambien…».
- R20 (fallo): `ai-provider-failure.test.ts` «R11, R20: un texto por tipo de fallo…».
- R21/R23 (textos): «R21, R23: la key rechazada, la falta de cuota y el modelo no disponible marcan…»,
  «R21: con un modelo elegido dice «que elegiste»…», «R21, R23: con el predeterminado no dice…».
- R12 (reconocedores): «R12: reconoce el aviso de la prueba y el de la lectura…», «R12: no reconoce
  otros errores…», cuatro casos de `isAccountFailureNotice` (prueba, lectura con/sin código, los que
  no reconoce, comparación exacta).

**Salida**
- `vitest run` de `connection-view`, `ai-provider-failure`, `module-shape`: 3 archivos, 134 pass, 1 skip.

**Nota.** `design.md > 4.3` escribe `probeFailureMessage(failure, entry.name)`; el texto de R20 no
lleva proveedor, así que la firma sigue con un solo argumento.

## T3. Adaptadores driven (2026-10-22, backend_dev)

**Archivos**
- `lib/modules/integraciones/ports/ai-provider-connection-repository.ts`: `model?` y
  `unavailableModel?` en `NewAiProviderConnectionRow` y `AiProviderConnectionPatch`; doc del error de FK.
- `lib/modules/integraciones/adapters/driven/catalog/ai-provider-catalog-prisma.ts`: proveedores +
  `ai_models` por consulta aparte (`orderBy provider, sortOrder, modelId`), agrupado; un proveedor sin
  predeterminado se descarta de `list()` y `get()` da `null`.
- `lib/modules/integraciones/adapters/driven/persistence/ai-provider-connection-prisma.ts`: los dos
  campos en `select`, `toRecord`, `create` y `updateMany`; `P2003` con `meta.constraint` =
  `ai_provider_connections_model_fkey` ⇒ `Error` «integraciones: el modelo de la conexión no está en
  el catálogo de su proveedor» (con `cause`); otra FK se relanza cruda.
- `tests/integration/integraciones/ai-provider-connection-prisma.int.test.ts`.

**R → test** (`ai-provider-connection-prisma.int.test.ts`)
- R2/R3/R5: «QT-291 R2, R3, R5 — los modelos de cada proveedor salen del catalogo de modelos…».
- R3: «QT-291 R3 — un proveedor sin predeterminado (dato imposible) no sale de list…».
- R17: «QT-291 R17 — el catalogo se lee en cada llamada…».
- R7: «QT-291 R7 — create guarda la eleccion…», «…create sin los campos…», «…una eleccion de otro
  proveedor la rechaza la base…», «…otra FK rota (el autor) no se disfraza…».
- R7/R12: «QT-291 R7, R12 — update cambia y vacia…». R14: «QT-291 R14 — cambiar de proveedor
  vaciando la eleccion…».
- Los casos de QC-275 (R2, R4, R5, R7, R19, R20) siguen, ajustados a la entrada y el registro nuevos.

Los dos casos que tocan `ai_models` (R17, R3) restauran la fila en `finally`; el proyecto
`integration` corre con `fileParallelism: false`.

**Salida**
- `ai-provider-connection-prisma.int.test.ts`: 22 pass.

## Verificación de la tanda T1 (resto) + T2 + T3 (2026-10-22, backend_dev)

- `pnpm exec prisma validate`: válido.
- `pnpm exec vitest run guard`: 87 archivos, 1276 pass, 22 skipped, 0 fail.
- `eslint` de los 12 archivos tocados: 0 problemas.
- `.int`: `ai-models-migration` + `ai-provider-migration` 23 pass; `ai-provider-connection-prisma` 22 pass.
- `vitest related --run` (los 7 de producción): 476 archivos, 8136 pass, **9 fail**, todos de T5:
  - 8 en `save-ai-provider-connection.test.ts` (7) y `authorization.test.ts` (1): `TypeError ... reading
    'some'`; el doble de catálogo de `ai-provider-doubles.ts` sigue con la entrada vieja (sin `models`).
  - 1 en `test-ai-provider-key.test.ts` «R11»: espera el texto viejo de modelo no disponible (R20).
- `pnpm run typecheck`: 45 errores, todos esperados:
  - T4/T5: `domain/resolve-ai-provider-for-reading.ts` (3), `domain/test-ai-provider-key.ts` (2),
    `tests/unit/integraciones/ai-provider/ai-provider-doubles.ts` (6), `resolve-and-report.test.ts` (1),
    `save-ai-provider-connection.test.ts` (1).
  - T6: `documentos/domain/ai-read-use.ts` (1), `documentos/ports/ai-provider-gateway.ts` (1).
  - T8: `adapters/driving/ai-provider-actions.ts` (6), `ai-provider-actions.test.ts` (2).
  - T10/T11: `ai-provider-card.tsx` (2), `ai-provider-form.tsx` (2), `ai-provider-card.test.tsx` (5),
    `ai-provider-form.test.tsx` (4), `ai-provider-page.test.tsx` (5).
  - T13: `e2e/integraciones-proveedor-ia.spec.ts` (3).
  - Ajeno: `app/layout.tsx` (1, `LayoutProps`, tipo generado por Next ausente en el worktree).

**Veredicto:** T1 cerrada (seed de veinte), T2 y T3 hechas y en verde en sus tests; el resto del rojo es de T4–T13.
