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
