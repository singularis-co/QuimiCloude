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

## T4. Elegir modelo, con consulta antes de guardar (2026-10-22, backend_dev)

**Archivos**
- `lib/modules/integraciones/domain/ai-model-input.ts` (nuevo): `aiModelInputSchema` (`modelId` recortado, 1–200).
- `lib/modules/integraciones/domain/select-ai-model.ts` (nuevo): `createSelectAiModel`, deps `connections`,
  `catalog`, `cipher`, `probe`. Orden: permiso → zod → `find` (`null` ⇒ `not_connected`) → `catalog.get`
  (fuera de `entry.models` o el marcado ⇒ `ValidationError`) → `cipher.decrypt` directo (una
  `SecretUnreadableError` se relanza **sin escribir**; no usa `decryptStoredKey`, que marca la conexión)
  → `probe` con `[modelId]` (fallida ⇒ `rejected` con `probeFailureMessage(failure)`, sin escribir) →
  `update` (`model` null si es el predeterminado; `unavailableModel: null` si había marcado;
  `ACTIVE`/errores vacíos si `ERROR` y `isModelUnavailableNotice` o `isAccountFailureNotice`). No
  escribe `lastCheckedAt`.
  Decisión menor: si `update` devuelve `null` (la fila desapareció entre la consulta y la escritura,
  carrera con «Desconectar») responde `not_connected`, igual que R11.
- `lib/modules/integraciones/index.ts`: + `createSelectAiModel`, + tipo `SelectAiModelResult`.
- `tests/unit/integraciones/module-shape.test.ts`: los dos archivos nuevos de `domain/` y los dos
  nombres nuevos del contrato.
- `tests/unit/integraciones/ai-provider/ai-provider-doubles.ts`: catálogo con `models`/`defaultModel`
  (tres modelos por proveedor, el predeterminado en medio), `model`/`unavailableModel` en
  `storedConnection` y en `create`, `failedProbe(kind, model)`.
- `tests/unit/integraciones/ai-provider/select-ai-model.test.ts` (nuevo, 42 casos).

**R → test** (`select-ai-model.test.ts`)
- R8: «R8: rechaza <actor> con unauthorized sin leer ni escribir la conexion» (×5), «R8: el rechazo llega antes de validar la entrada».
- R9: «R9: un modelo del catalogo del proveedor conectado queda como la eleccion…», «R9: elegir el
  predeterminado deja la eleccion vacia», «R9: la entrada se recorta…», «R9: elegir no escribe
  lastCheckedAt…», «R9: solo escribe en la conexion de la empresa del actor».
- R10: «R10: <otro proveedor | inexistente | vacio | …> da invalid_input sin consultar ni escribir» (×8),
  «R10: el modelo marcado da invalid_input…».
- R11: «R11: sin conexion responde not_connected…», «R11: la conexion de otra empresa no cuenta»,
  «R11: si la conexion desaparece entre la consulta y la escritura…».
- R12 (una fila de §4.2 por caso): «…ERROR por modelo no disponible (aviso de la prueba)…», «…(aviso de
  la lectura)…», «…ERROR por key rechazada (de «Probar conexion»)…», «…ERROR por falta de cuota (de una
  lectura)…» ⇒ `ACTIVE`; «…ERROR por sin respuesta | error inesperado | key ilegible guarda la eleccion
  sin cambiar el estado ni el error»; «…modelo marcado que no es el elegido…vacia el marcado»; «…aviso
  de key rechazada de otro proveedor no se reconoce…»; «…en ACTIVE solo escribe la eleccion».
- R32: «R32: consulta solo el modelo elegido con la key guardada, y nada se escribe antes», «R32:
  tambien consulta cuando el elegido es el predeterminado», «R32: descifra con el contexto…».
- R33: «R33: con rejected_key | quota | model_unavailable | unreachable | unexpected no escribe nada y
  devuelve el mensaje de la prueba» (×5, con la fila en `ERROR` y un modelo marcado: queda idéntica).
- R34: «R34: no consulta al proveedor, no escribe y lanza integration_secret_unreadable».

## T5. Prueba, guardado, resolución e informe (2026-10-22, backend_dev)

**Archivos**
- `domain/test-ai-provider-key.ts`: `TestAiProviderKeyDeps` + `connections` (solo `find`);
  `modelAfterSaving(existing, entry)` (R19); `runProbe` sustituido por `toTestResult(probeResult)`; la
  prueba consulta un solo modelo.
- `domain/save-ai-provider-connection.ts`: `find` antes de la prueba para el modelo de R19; al
  reemplazar, otro proveedor ⇒ `model: null, unavailableModel: null`; mismo proveedor ⇒ no toca
  `model`, `unavailableModel: null`; al crear, ambos `null`.
- `domain/test-saved-ai-provider.ts`: consulta `[modelInUse(record, entry)]`; buena ⇒ además
  `unavailableModel: null`; `model_unavailable` ⇒ `ERROR`, `unavailableModel = failure.model`,
  `lastError = modelUnavailableNotice(model, entry.name, model === record.model)`; otra fallida, como antes.
- `domain/resolve-ai-provider-for-reading.ts`: firma `(companyId)`, `model = modelInUse(record, entry)`.
- `domain/report-ai-provider-outcome.ts`: `account_failure` → `connection_failure`; `model_unavailable`
  ⇒ `ERROR` + modelo marcado + `READING_FAILURE_PREFIX + modelUnavailableNotice(...)`; `recovered` ⇒
  además `unavailableModel: null`.
- `domain/get-ai-provider-connection.ts`: solo el comentario del tipo (el formulario ya no pinta modelos).
- Tests: `save-ai-provider-connection.test.ts`, `test-ai-provider-key.test.ts`,
  `test-saved-ai-provider.test.ts`, `resolve-and-report.test.ts`.

**R → test**
- R14: `save-…` «QT-291 R14: cambiar de proveedor vacia la eleccion y el modelo marcado», «…con el mismo
  proveedor (solo cambia la key) conserva la eleccion», «…la prueba buena del modelo en uso vacia el
  modelo marcado», «…crear la conexion la deja sin eleccion ni modelo marcado», «…una prueba fallida no
  toca la eleccion».
- R16: `resolve-and-report` «QT-291 R16: sin eleccion resuelve el predeterminado…», «QT-291 R16: con
  eleccion resuelve la eleccion…».
- R17: `resolve-and-report` «QT-291 R17: sin eleccion, el predeterminado se lee del catalogo en cada
  llamada»; `test-saved-…` «QT-291 R17, R18: sin eleccion, consulta el predeterminado leido del catalogo
  en ese momento».
- R18: `test-saved-…` «QT-291 R18: con eleccion, consulta solo la eleccion».
- R19: `save-…` cuatro casos «QT-291 R19: …»; `test-ai-provider-key…` «R10, QT-291 R19: prueba una sola vez…»
  y cuatro casos «QT-291 R19: …» (conectado con/sin eleccion, otro proveedor, sin conexion).
- R20 (caso de uso): `test-ai-provider-key…` y `test-saved-…` «QT-291 R20: …ya no está disponible.»».
- R21: `test-saved-…` «QT-291 R21: la eleccion no disponible deja ERROR…«que elegiste»», «…el
  predeterminado no disponible…sin «que elegiste»», «…otro fallo no marca ningun modelo».
- R22: `test-saved-…` «QT-291 R22: la prueba buena vacia el modelo marcado».
- R23: `resolve-and-report` «QT-291 R23: la eleccion no disponible deja ERROR…», «…tambien con el
  predeterminado…», «…un fallo de cuenta no marca ningun modelo».
- R24: `resolve-and-report` «QT-291 R24: una lectura buena con la conexion en ERROR vacia ademas el modelo marcado».
- R25 (resolución): `resolve-and-report` «QT-291 R25: con un modelo marcado resuelve igual el modelo en uso…».

**Sonda de OpenRouter (dato de T0).** `probeOpenRouter` (`documentos/adapters/driven/ai/ai-reader-openai.ts`)
no genera texto: busca el id en `GET /models` y un id ausente ya sale como `model_unavailable`; el 400
«not a valid model ID» solo aparece al generar. No afecta a T4/T5; queda para T6 (`classifyOpenAiError`).

## Verificación de la tanda T4 + T5 (2026-10-22, backend_dev)

- `eslint` de los 16 archivos tocados: 0 problemas.
- `vitest run` de los cinco tests del caso de uso: `select-ai-model` 42, `save-…` + `test-ai-provider-key…`
  + `authorization` 74, `test-saved-…` 14, `resolve-and-report` 21; todo en verde. Los 9 rojos de la
  tanda anterior (doble de catálogo y texto de R20) quedan en verde.
- `vitest related --run` (los 16): 476 archivos, 8284 pass, 4 skip, **2 fail**, ambos en
  `tests/unit/composition/ai-provider-wiring.test.ts` (T7): su fixture de catálogo sigue con
  `recipeModel`/`catalogModel` y la composición todavía llama `resolveAiProviderForReading(companyId, use)`.
- `pnpm exec vitest run guard`: 87 archivos, 1276 pass, 22 skipped, 0 fail.
- `pnpm run typecheck`: 34 errores, ninguno en `integraciones/domain` ni en sus tests:
  - T6: `documentos/domain/ai-read-use.ts` (1), `documentos/ports/ai-provider-gateway.ts` (1).
  - T6/T7: `lib/composition/index.ts` (2: `resolveAiProviderForReading` con dos argumentos y
    `'account_failure'` → `'connection_failure'`).
  - T8: `adapters/driving/ai-provider-actions.ts` (6), `ai-provider-actions.test.ts` (2).
  - T10/T11: `ai-provider-card.tsx` (2), `ai-provider-form.tsx` (2), `ai-provider-card.test.tsx` (5),
    `ai-provider-form.test.tsx` (4), `ai-provider-page.test.tsx` (5).
  - T13: `e2e/integraciones-proveedor-ia.spec.ts` (3).
  - Ajeno: `app/layout.tsx` (1, `LayoutProps`).

**Veredicto:** T4 y T5 hechas y en verde en sus tests; el rojo que queda es de T6–T13 y de `app/layout.tsx`.

## T6. Lectores y trabajo (2026-10-22, backend_dev)

**Archivos**
- `lib/modules/documentos/adapters/driven/ai/ai-reader-anthropic.ts`, `ai-reader-genai.ts`,
  `ai-reader-openai.ts`: al leer clasifican con `config.model` y lanzan `AiProviderError` con
  `marksConnection` (antes `isAccountFailure`). Un 404 al leer pasa a `model_unavailable` del modelo en uso.
- `ai-reader-openai.ts`, además: `classifyOpenAiError(error, model, origin = 'openai')`. Con
  `origin === 'openrouter'`, un **400** cuyo `error.message` es **exactamente** `"<model> is not a valid
  model ID"` (el id consultado) es `model_unavailable` (dato de T0). Cualquier otro 400 —otro mensaje,
  otro id, sin modelo o desde OpenAI— sigue `unexpected`. `providerLabel` devuelve el `origin`.
- `lib/modules/documentos/ports/ai-provider-gateway.ts`: `readerFor(companyId)` sin `use`;
  `reportAccountFailure` → `reportConnectionFailure`.
- `lib/modules/documentos/domain/run-document-job.ts`: sin `USE_BY_STRATEGY`; informa con
  `marksConnection` y `reportConnectionFailure`; observador renombrado `observeProviderFailures`.
- `lib/modules/documentos/domain/ai-read-use.ts`: **borrado** (no se exportaba en `documentos/index.ts`).
- `lib/modules/integraciones/index.ts`: + `marksConnection` (lo usan los lectores y el trabajo;
  `isAccountFailure` se conserva, `design.md > 4.4`).
- Tests: `ai-reader-anthropic-adapter.test.ts`, `ai-reader-adapter.test.ts`,
  `ai-reader-openai-adapter.test.ts`, `run-document-job-ai-provider.test.ts`, `run-document-job-doubles.ts`,
  `run-document-job-addon.test.ts` (renombre), `module-shape.test.ts` (contrato + `marksConnection`;
  R19 sin `ai-read-use.ts`).

**R → test**
- R23 (lector): «QT-291 R23 — un 404 al leer lanza AiProviderError con el modelo en uso…» en los tres
  adaptadores (OpenAI y OpenRouter en `it.each`); «QT-291 R23 — OpenRouter: el 400 «<id> is not a valid
  model ID» del modelo en uso es modelo no disponible»; «QT-291 R23 — un 400 distinto de OpenRouter, o ese
  mismo 400 con OpenAI, se propaga tal cual»; «QT-291 R23 — el 400 de id invalido solo es modelo no
  disponible con OpenRouter, con ese mensaje exacto y ese modelo» (clasificación, 9 casos).
- R23 (trabajo): `run-document-job-ai-provider` «QT-291 R23 — el modelo en uso no disponible termina el
  archivo en `ai_provider_error` definitivo y marca la conexion una vez», «…no repite la lectura con el
  predeterminado ni con otro modelo…», «…tambien en la peticion de coordenadas del recorte…».
- R25: «QT-291 R25 — con la conexion en `ERROR` por un modelo marcado, el archivo se lee con el lector de
  la empresa sin pedir otro», «QT-291 R25 — con un modelo marcado que vuelve a fallar…».
- El caso de QC-275 «R26 — un `AiProviderError` que no es de cuenta (modelo no disponible) no marca la
  conexion» se sustituye por los de R23 (el comportamiento cambia por spec). Los `R26 — %i al leer se
  propaga` dejan fuera el 404.

## T7. Composición (2026-10-22, backend_dev)

**Archivos**
- `lib/composition/index.ts`: `readerFor(companyId)` → `resolveAiProviderForReading(companyId)`;
  `reportConnectionFailure` → `{ kind: 'connection_failure', failure }`; `integraciones.selectAiModel =
  createSelectAiModel(aiProviderDeps)` (mismas deps: `connections`, `catalog`, `cipher`, `aiProviderProbe`
  con el doble canned). `testAiProviderKey` ya recibía `connections` por `aiProviderDeps`.
- `tests/unit/composition/ai-provider-wiring.test.ts`: fixture de catálogo con `models`/`defaultModel`,
  conexión con `model`/`unavailableModel`, `update`/`list` doblados; bloque nuevo de elegir modelo.
- `tests/unit/integraciones/module-shape.test.ts`: `selectAiModel` en la fachada de la composición.

**R → test** (`ai-provider-wiring.test.ts`)
- R5: «QT-291 R5 — las opciones salen del catalogo: ver la conexion no llama a ninguna prueba ni construye
  ningun lector».
- R16: «R21, R22, QT-291 R16 — …el modelo en uso, el mismo en las dos estrategias» (con y sin elección).
- R19: «R40, QT-291 R19 — …solo el predeterminado del catalogo».
- R32: «QT-291 R32 — sin la variable consulta con la prueba de su codigo solo el modelo elegido…», «…con
  la variable responde el doble…», «…E2E_INVALID sale rechazada sin escribir».
- R33: «QT-291 R33 — sin la variable, una consulta fallida no escribe…».
- R6: `ai-model-literals.test.ts` (guardia) sigue verde: los ids de modelo de los tests están en `tests/`.

## T8. Server Action (2026-10-22, backend_dev)

**Archivos**
- `lib/modules/integraciones/adapters/driving/ai-provider-actions.ts`: `SelectAiModelFormState` y
  `selectAiModelAction` (`modelId` del `FormData`; `saved` ⇒ revalida; `not_connected` sin revalidar;
  `rejected` ⇒ `ErrorState` sin revalidar; errores por `toErrorState`, así que la key ilegible sale
  `integration_secret_unreadable` con su texto del catálogo y sin revalidar). `toProviderState` y
  `toConnectionState` campo a campo con los campos nuevos; cada opción de modelo también se copia campo a
  campo (`toModelOptionState`).
- `tests/unit/integraciones/ai-provider/ai-provider-actions.test.ts`.

**Decisión menor (a confirmar por el reviewer).** `ErrorState` exige un `code` del catálogo cerrado y el
spec no lo nombra para `rejected`. Se usa `ai_provider_error` («Error con tu proveedor…») con el
`message` de la prueba, no el del catálogo, como pide `design.md > 9`.

**R → test** (`ai-provider-actions.test.ts`)
- R9/R13: «QT-291 R9, R13 — elegir pasa el modelo del formulario…, devuelve solo `saved` y revalida».
- R10: «QT-291 R10 — sin el campo llega una cadena vacia…». R11: «QT-291 R11 — sin conexion…».
- R13: «QT-291 R13 — la consulta copia la vista y el catalogo campo a campo, tambien cada opcion de
  modelo»; además `select` entra en los casos genéricos (fila con key, actor, R1, `unexpected`).
- R33: «QT-291 R33 — una consulta fallida devuelve un ErrorState con el mensaje de la prueba y no revalida».
- R34: «QT-291 R34 — con la key ilegible devuelve `integration_secret_unreadable`…».

## Verificación de la tanda T6 + T7 + T8 (2026-10-22, backend_dev)

- `eslint --max-warnings=0` de los 19 `.ts` tocados: 0 problemas.
- `vitest run` de los tests de T6–T8 (`ai-reader-*` ×3, `run-document-job*`, `ai-provider-wiring`,
  `ai-provider-actions`, `module-shape`, `ai-model-literals`): todo en verde.
- `vitest related --run` (los 17 `.ts` + el borrado): 468 archivos, 8086 pass, 4 skip, **3 fail**, todos
  míos y ya arreglados:
  - `integraciones-graph-doubles.test.ts` y `encryption-keys-env.test.ts`: la lista exacta de la fachada
    `integraciones` de la composición no tenía `selectAiModel` → añadido.
  - `qc159-alcance.test.ts`: lee del disco lo que lista `git ls-files`; con `ai-read-use.ts` borrado y
    sin preparar en el índice daba `ENOENT` → borrado preparado en el índice (`git rm --cached`).
  - Re-ejecución de esos tres: 49 pass, 1 skip.
- `pnpm exec vitest run guard`: 87 archivos, 1276 pass, 22 skipped, 0 fail.
- `pnpm run typecheck`: 22 errores, ninguno de T6–T8:
  - T10/T11: `ai-provider-card.tsx` (2), `ai-provider-form.tsx` (2), `ai-provider-card.test.tsx` (5),
    `ai-provider-form.test.tsx` (4), `ai-provider-page.test.tsx` (5).
  - T13: `e2e/integraciones-proveedor-ia.spec.ts` (3).
  - Ajeno: `app/layout.tsx` (1, `LayoutProps`).

**Veredicto:** T6, T7 y T8 hechas y en verde; el rojo que queda es de T10/T11, T13 y `app/layout.tsx`.

## T9. `AiModelSelect` (2026-10-22, frontend_dev)

**Regla de decisión.** `SharedSelectControl` (paso 1-2) no traía disparador deshabilitado, `aria-busy`, la
lista debajo del disparador con entrada de opacidad y escala, ni contenido propio de las opciones. Se
**extiende** con cinco props opcionales (`disabled`, `busy`, `alignItemWithTrigger`, `renderOption`,
`optionClassName`); sin ellas no cambia nada para sus dos consumidores (`SelectField`,
`packing-finish-dialog`). Su fila en `CATALOGO.md` las anota. La flecha que gira 180° no se añade al
primitivo (cambiaría todos los selects): va en las clases del disparador con `data-popup-open`, que Base UI
ya pone. La entrada `.pop` del tablero es la animación que `SelectContent` ya trae (`fade-in-0 zoom-in-95`),
apagada por `alignItemWithTrigger`; con `false` se ve.

`AiModelSelect` (paso 3) compone `SharedSelectControl`, `StatusBadge`, `Spinner`, `ErrorAlert`, `Sheet` y
`useIsMobile(641)` con el patrón de hoja de `CountrySelect`. Disparador de teléfono con `role="combobox"`,
`aria-haspopup="dialog"`, `aria-controls` a la lista; ocupado: deshabilitado, `aria-busy` y spinner, y la
hoja no se abre. Error bajo el selector con `ErrorAlert` (catálogo o mensaje de la consulta), enlazado por
`aria-describedby`.

**Archivos**
- Nuevo: `app/(private)/integraciones/proveedor-ia/components/ai-model-select.tsx`
- Modificados: `app/(private)/integraciones/proveedor-ia/components/index.ts` (barrel),
  `components/shared/shared-select.tsx`, `components/shared/CATALOGO.md` (fila de `SharedSelect`).
- Nuevo test: `tests/unit/integraciones-ui/ai-model-select.test.tsx` (11 casos).

**R → test** (`ai-model-select.test.tsx`)
- R26: «QT-291 R26: un solo selector «Modelo de <proveedor>» con las opciones del catálogo en su orden…».
- R27: «QT-291 R27: sin elección muestra el recomendado con «Recomendado»…» y «…con elección… «Elegido por
  tu empresa.»». Ambos afirman que no aparece «predeterminado».
- R28: «QT-291 R28: el modelo no disponible se muestra tachado, con «No disponible», inválido…».
- R29 (lado del selector): «elegir otra opción notifica su id, sin otro botón», «ocupado, el disparador
  está deshabilitado, con aria-busy y spinner, y no abre la lista», los dos de error bajo el selector.
- R31: «en escritorio, disparador de 44 px con letra de 16 px, opciones de 44 px y lista debajo con flecha
  que gira», «a 390 px el disparador ocupa el ancho con 48 px y la lista se abre en una hoja inferior…»,
  «a 390 px, ocupado no abre la hoja».

## T10. Tarjeta (2026-10-22, frontend_dev)

- Fuera las filas «Receta (fórmula desde PDF)» y «Catálogo desde PDF» y sus dos testids.
- Sección «Modelo» (título, subtítulo de `design.md > 11`, `AiModelSelect`) entre el aviso de error y
  «Última prueba», en el orden del tablero: el aviso sube por encima de la sección.
- Elegir: `useActionState(selectAiModelAction)` + `useOptimistic(modelInUse)` en la misma transición. Mientras
  dura, el selector está ocupado con el elegido; `saved` ⇒ `toast.success('Modelo guardado')`; `error` ⇒
  texto bajo el selector y, al acabar la transición, el valor del servidor; `not_connected` ⇒
  `router.refresh()`. El aviso y el estado de la tarjeta no cambian por un fallo de la consulta.
- «Cambiar key o proveedor»: con `modelIsDefault` abre el formulario como antes; sin él, `ConfirmDialog`
  «¿Cambiar de proveedor?» con el texto de `design.md > 11` («recomendado»), «Cancelar» / «Continuar».
- Prueba buena: «Conexión correcta · el modelo en uso responde» (sin `elapsedMs`).

**Archivos**: `app/(private)/integraciones/proveedor-ia/components/ai-provider-card.tsx`,
`tests/unit/integraciones-ui/ai-provider-card.test.tsx` (datos con `models`/`defaultModel` y la vista
nueva; viewport fijado con `tests/helpers/viewport` porque el selector usa `useIsMobile`).

**R → test** (`ai-provider-card.test.tsx`)
- R15: «QT-291 R15: con elección, «Cambiar key o proveedor» pide confirmación con «recomendado»; «Cancelar»
  no cambia nada», «QT-291 R15: con elección, «Continuar» abre el formulario…», «QT-291 R15, R32: sin
  elección, … muestra el formulario sin confirmación…».
- R20: «QT-291 R20: «Probar conexión» prueba la guardada y muestra «Conexión correcta · el modelo en uso
  responde», sin tiempo».
- R26: «QT-291 R26: la sección «Modelo» va entre el aviso de error y «Última prueba»… sin las filas de receta
  y catálogo», «QT-291 R26: las opciones son solo las del proveedor conectado, en su orden».
- R27/R28 (integrados en la tarjeta): «QT-291 R27: sin elección, «Recomendado»…», «QT-291 R28: con el modelo
  en uso marcado…».
- R29: «…elegir envía el modelo sin otro botón; mientras se consulta, el selector está ocupado…; si se
  guarda, «Modelo guardado»», «…si la consulta falla, el mensaje va bajo el selector, vuelve el valor
  anterior y la tarjeta no cambia», «…un error del catálogo (key ilegible)…», «…si ya no hay conexion al
  elegir, refresca la pantalla sin aviso».

## T11. Formulario y página (2026-10-22, frontend_dev)

- `ai-provider-form.tsx`: la ayuda deja de leer `recipeModel`/`catalogModel` y termina en «Después de
  conectar podrás elegir el modelo.»; `aiProviderTestOkMessage` desaparece y la prueba buena es
  `AI_PROVIDER_FORM_TEXTS.testOk` («Conexión correcta · el modelo en uso responde»), también la de la
  tarjeta (comparten `AiProviderFeedbackMessage`).
- Decisión anotada: el formulario no sabe si hay conexión; la misma ayuda sale también al abrirlo desde
  «Cambiar key o proveedor». R30 no dice nada de ese caso y la frase sigue siendo cierta.
- `ai-provider-page.test.tsx`: datos sin `recipeModel`; el caso R31 mira la sección «Modelo»; el caso R8
  excluye del «input vacío» el input oculto del select de Base UI (lleva el modelo en uso, no la key) y
  afirma que su valor es un modelo del catálogo.

**Archivos**: `app/(private)/integraciones/proveedor-ia/components/ai-provider-form.tsx`,
`tests/unit/integraciones-ui/ai-provider-form.test.tsx`, `tests/unit/integraciones-ui/ai-provider-page.test.tsx`.

**R → test**
- R20 (key escrita): `ai-provider-form.test.tsx` «R34, QT-291 R20: la prueba buena de la key escrita muestra
  «Conexión correcta · el modelo en uso responde», sin tiempo…».
- R30: `ai-provider-form.test.tsx` «R30, QT-291 R30: la ayuda enlaza la consola del elegido y dice «Después de
  conectar podrás elegir el modelo.» sin nombrar modelos…».
- R26 en la página: `ai-provider-page.test.tsx` «R31, QT-291 R26: con conexion pinta la tarjeta… y la
  sección «Modelo»…».

## T12. Revisión visual (2026-10-22, frontend_dev)

**Cómo.** Base aislada desde la plantilla `qct_tpl_a9127c0147c3` (`qct_qt291selecci_2c6b3448_mvke1giw_18pk`,
añadidos de la empresa del seed prendidos), `next dev --port 3119` con `INTEGRATIONS_E2E_DOUBLES=1` y clave de
cifrado efímera. Gemini se conectó por la pantalla y `gemini-4-argon` se eligió por la pantalla (toast
«Modelo guardado»; la base quedó con `model_id = gemini-4-argon`). Los tres estados se fijaron por SQL; el
tema, con la cookie `theme_preference`. Al terminar: servidor parado, base borrada, caché de `.next/dev`
borrada (solo quedan los tipos generados).

**Capturas** (`progress/capturas/QT-291/`, 22 PNG, 3,9 MB):
- Tres estados × tres anchos × dos temas: `{recomendado,elegido,retirado}-{escritorio,tablet,telefono}-{claro,oscuro}.png`
  (1440×1000, 820×1180, 390×844 a 2×).
- Selector abierto en cada ancho (claro): `recomendado-abierto-{escritorio,tablet,telefono}-claro.png`
  (escritorio y tablet: lista debajo del disparador; teléfono: hoja inferior con título «Modelo de Gemini»).
- `elegido-toast-escritorio-claro.png`: el toast tras elegir por la pantalla.

**Contra `docs/diseno/canvas/ProveedorIAModelos*.dc.html`**
- Orden de la tarjeta igual al tablero: cabecera, aviso de error, sección «Modelo» (título, subtítulo,
  etiqueta «Modelo de Gemini», selector, ayuda) y «Última prueba».
- Disparador: id en mono + insignia; «Recomendado» (neutral) donde el tablero dice «predeterminado» —manda
  el spec—. En la lista, la marca minúscula «recomendado» junto al predeterminado y el check en el valor.
- Retirado: id tachado, insignia «No disponible» (danger), borde y anillo de inválido, ayuda en rojo y el
  aviso «Error con tu proveedor» arriba. Legible en claro y oscuro.
- Teléfono: disparador a todo el ancho, botones apilados a ancho completo; tablet a 820 px usa ya la lista
  de escritorio (la hoja es solo ≤ 640 px, como `CountrySelect`). Los botones de la tarjeta apilados en tablet
  son los de QC-275, fuera de esta feature.
- Sin diferencias más allá de la insignia.

**Defecto corregido.** En la lista de escritorio/tablet la marca «recomendado» quedaba pegada arriba (como un
superíndice): el `ItemText` del primitivo es `flex` sin alinear y el contenido de la opción eran dos
hermanos sueltos. El tablero los centra (`align-items: center`). `OptionContent` de
`ai-model-select.tsx` va ahora en un `<span class="flex items-center gap-2">`; las capturas abiertas son las
de después del arreglo. En la hoja de teléfono no cambia nada visible.

**Archivos:** `app/(private)/integraciones/proveedor-ia/components/ai-model-select.tsx`, `progress/capturas/QT-291/*.png` (22).

## Verificación de la tanda T9 + T10 + T11 (2026-10-22, frontend_dev)

- `pnpm run typecheck`: 3 errores, todos en `e2e/integraciones-proveedor-ia.spec.ts` (T13). El de
  `app/layout.tsx` (`LayoutProps`) no salió en esta corrida (los tipos de rutas de `.next` se regeneraron
  al arrancar `next dev`).
- `pnpm exec eslint` de los 9 archivos tocados: «No issues found».
- `pnpm exec vitest related --run --maxWorkers=4 <9 archivos>`: 189 archivos, 3487 pass, 1 skip, 0 casos en
  rojo; 2 archivos (`paridad/error-alert-paridad.test.tsx`, `pedidos-ui/packaging-select.test.tsx`) cayeron al
  cargar por `ENOSPC` (disco lleno). Re-ejecutados con `tests/unit/integraciones-ui/`: 12 archivos, 166 pass.
  (La primera corrida con los workers por defecto murió sin salida; con 4 terminó.)
- `pnpm exec vitest run guard`: 87 archivos; un rojo mío en `guard-catalogo-de-componentes` (la celda
  `Diseño` admite solo un valor) → la cita del tablero pasó a `Puntos de extensión`; re-ejecutada: 59 pass.
  El resto, 1275 pass, 22 skipped.

**Veredicto:** T9, T10 y T11 hechas y en verde; T12 pendiente por disco lleno; queda T13 (E2E).

## F2: R30 ayuda solo en alta

Decisión del humano (requirements.md > Decisiones cerradas, fila «(F2) Ayuda … al abrir «Cambiar key
o proveedor»»): la frase «Después de conectar podrás elegir el modelo.» solo sale en el alta.

**Archivos modificados**
- `app/(private)/integraciones/proveedor-ia/components/ai-provider-form.tsx`: prop opcional
  `connected` (por defecto `false`); con ella la ayuda termina en el enlace a la consola, sin la frase.
- `app/(private)/integraciones/proveedor-ia/components/ai-provider-card.tsx`: al abrir el formulario
  desde «Cambiar key o proveedor» le pasa `connected`. `page.tsx` no cambia (el alta monta el
  formulario sin la prop).
- `tests/unit/integraciones-ui/ai-provider-form.test.tsx`: nuevo caso con `connected`.
- `tests/unit/integraciones-ui/ai-provider-card.test.tsx`: nuevo caso tras pulsar «Cambiar key o proveedor».

**R → test**
- R30 (alta: sale) → ai-provider-form.test.tsx «R30, QT-291 R30: la ayuda enlaza la consola del elegido y dice …» (existente).
- R30 (con conexión: no sale) → ai-provider-form.test.tsx «QT-291 R30: con la empresa ya conectada, la ayuda solo enlaza la consola …»
  y ai-provider-card.test.tsx «QT-291 R30: al pulsar «Cambiar key o proveedor» la ayuda del formulario no dice …».

**Salida**
- `pnpm run typecheck`: 3 errores, todos en `e2e/integraciones-proveedor-ia.spec.ts` (rojo esperado).
- `pnpm exec eslint` de los 4 archivos: No issues found.
- `pnpm exec vitest run` de los 4 `tests/unit/integraciones-ui/ai-*.test.tsx`: 4 archivos, 72 pass.
- `pnpm exec vitest run guard`: 86 archivos pass, 1 fail ajeno: `guard-catalogo-de-errores` > «ningun
  archivo define su propio traductor (R23)» señala `lib/modules/integraciones/adapters/driving/ai-provider-actions.ts`
  (archivo del backend en edición por otro agente; no tocado aquí). 1275 pass, 22 skipped.

**Veredicto:** R30 ajustada (ayuda solo en alta) y en verde; queda el rojo de guardia del backend.

## F2: R34 log

- `selectAiModelAction` registra `console.error('ai_provider_select_secret_unreadable', { companyId })` cuando el estado traducido es `integration_secret_unreadable` (decide por el estado, no por `instanceof`: guardia R23); la conexión no pasa a Error y el aviso no cambia. Sin key, valor cifrado ni diagnóstico propio. Archivos: `lib/modules/integraciones/adapters/driving/ai-provider-actions.ts`, `tests/unit/integraciones/ai-provider/ai-provider-actions.test.ts` (2 tests «QT-291 R34 —»). Salida: typecheck solo 3 errores en `e2e/integraciones-proveedor-ia.spec.ts` (esperado); eslint sin problemas; `vitest run tests/unit/integraciones/ai-provider/` 12 archivos, 214 pass; `vitest run guard` 1276 pass, 22 skipped, 0 fail (el rojo R23 anotado arriba queda resuelto). **Veredicto:** R34 log en verde.

## T13. E2E (2026-10-22, frontend_dev)

**Archivo:** `e2e/integraciones-proveedor-ia.spec.ts`.
- Fuera los testids de las filas «Receta»/«Catálogo» y la lectura de `recipeModel`/`catalogModel` (los 3
  errores de typecheck). El paso del alta lee el recomendado de Gemini de `ai_models` y afirma que el selector
  lo muestra con «Recomendado» y que la fila queda con `model` nulo.
- `testOk` pasa a «Conexión correcta · el modelo en uso responde»; con Gemini elegido, la ayuda del formulario
  dice «Después de conectar podrás elegir el modelo.» y no nombra ningún `gemini-`.
- Caso nuevo: Gemini conectado por el doble → recomendado con «Recomendado» y «Se usa el modelo recomendado de
  Gemini.» → elegir el primer no predeterminado del catálogo → «Modelo guardado», fila con ese `model` y
  `ACTIVE` → recargar → «Elegido por tu empresa.» sin «Recomendado».

**R → test**
- R20 → paso «R13, R34, QT-291 R20: «Probar conexión» … «Conexión correcta · el modelo en uso responde»…».
- R30 → paso «R16, R34, QT-291 R30: con Gemini la ayuda dice que el modelo se elige despues…».
- R26, R27 → paso «R17, R31, R34, QT-291 R26, R27: «Guardar y conectar» … recomendado de Gemini en la sección «Modelo»».
- R9, R26, R27, R29, R32 → caso «QT-291 R26, R27, R29, R32, R9: con Gemini conectado, elegir otro modelo…».

**Salida** (`pnpm exec playwright test e2e/integraciones-proveedor-ia.spec.ts`)
- Contra la base de `.env` (`QuimiCloude`): 4 failed, 2 passed. Esa base **no tiene la migración
  `20261022120000_ai_models`** (`aiModel.findMany`: «The table … does not exist»). No es del spec: es el
  estado de la base de desarrollo local. No se migró (base compartida).
- Contra una base aislada desde la plantilla de la rama (`DATABASE_URL` de `qct_qt291selecci_…_uv8`):
  1.ª corrida 5 passed, 1 failed: WebKit, paso «R37: sin conexion, Fórmulas pinta «Subir PDFs»
  deshabilitado…» (globo por `hover()` no apareció en 5 s; paso de QC-275 sin tocar). 2.ª corrida:
  ```
  ✓ [chromium] R37, R3: quien sube PDF sin integraciones.modificar … 404
  ✓ [chromium] QT-291 R26, R27, R29, R32, R9: con Gemini conectado, elegir otro modelo …
  ✓ [webkit]   R37, R3: …
  ✓ [webkit]   QT-291 R26, R27, R29, R32, R9: …
  ✓ [chromium] R37, R30, R13, R16, R34, R17, R31, R8, R33, R20: …
  ✓ [webkit]   R37, R30, R13, R16, R34, R17, R31, R8, R33, R20: …
  6 passed (40.4s)
  ```
- Servidor del E2E (3117) parado al terminar; base aislada borrada; `test-results/` borrado.

**Verificación T12 + T13**
- `pnpm run typecheck`: 0 errores.
- `pnpm exec eslint` de los 2 archivos: No issues found.
- `pnpm exec vitest run tests/unit/integraciones-ui/`: 10 archivos, 154 pass.
- `pnpm exec vitest run guard`: 87 archivos, 1276 pass, 22 skipped, 0 fail.

**Veredicto:** T12 y T13 hechas; un defecto de alineación corregido; E2E en verde contra una base migrada, con un
rojo intermitente de WebKit en un paso de QC-275 y la base local de `.env` sin migrar.
