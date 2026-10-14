# QC-275 — bitácora de implementación (backend_dev)

## Tanda 1 — T1, T2, T3, T7 (2026-10-13)

### Archivos
- Modificados: `lib/modules/errores/domain/error-codes.ts`, `error-catalog.ts` (2 códigos al final),
  `db/schema.prisma` (2 enums + `AiProvider` + `AiProviderConnection` al final),
  `docs/architecture.md` (bullet de exentas: diez, + `ai_providers`),
  `lib/modules/integraciones/domain/actor.ts` (+ `hasConfigurePermission`),
  `tests/unit/errores/catalogo.test.ts` (88 → 90), `tests/unit/integraciones/module-shape.test.ts`
  (R13: tres modelos; R18: + 7 archivos), `tests/guards/guard-empresa-en-esquema.test.ts` (EXENTAS
  + `ai_providers`, R7/R14), `tests/guards/guard-identificador-de-request.test.ts` (migración
  esperada + dependencias 43 → 44 por `openai` de T0), `tests/integration/aislamiento.json`.
- Creados: `db/migrations/20261013150000_ai_providers/{migration,down}.sql`;
  `lib/modules/integraciones/domain/{ai-provider,ai-provider-failure,ai-provider-input}.ts`;
  `lib/modules/integraciones/ports/{ai-provider-connection-repository,ai-provider-catalog,ai-provider-probe}.ts`;
  `lib/modules/integraciones/adapters/driven/ai/ai-provider-probe-canned.ts`;
  `tests/unit/integraciones/ai-provider/{ai-provider-failure,connection-view,ai-provider-probe-canned,ai-provider-input,authorization}.test.ts`;
  `tests/integration/integraciones/ai-provider-migration.int.test.ts`.

### R → test (de esta tanda)
- R4, R5 → `ai-provider-migration.int.test.ts`
- R8 → `connection-view.test.ts`
- R9 (texto), R11, R25 (texto), R26 (`isAccountFailure`) → `ai-provider-failure.test.ts`
- R18 → `ai-provider-input.test.ts`
- R37 (`hasConfigurePermission`) → `authorization.test.ts` (T4 lo amplía)
- R40 → `ai-provider-probe-canned.test.ts`

### Desviaciones del design
- `probeFailureMessage(f)` sin `providerName`: los cinco textos aprobados no lo usan.
- `readingFailureMessage` recibe solo `AiProviderAccountFailure` (rejected_key | quota): para los
  otros tres tipos el design no da texto (no marcan).
- `AiProviderFailure` es unión discriminada: `model: string` solo en `model_unavailable`, `null` en el resto.
- `AiProviderConnectionRaceError` vive en `ports/ai-provider-connection-repository.ts` (interno).
- FK `provider → ai_providers(code)` con `ON UPDATE CASCADE` además del `ON DELETE RESTRICT` del design.
- `index.ts` de `integraciones` sin tocar: los exports van con T4/T8 (R20 de module-shape).

### Bloqueo abierto
- `guard-catalogo-de-errores` R9 (entradas huérfanas) en ROJO: `ai_provider_missing` y
  `ai_provider_error` no los declara ninguna clase hasta T8 (`AiProviderMissingError`,
  `AiProviderError` en `documentos/domain/errors.ts`). El «Hecho» de T1 no se puede cumplir sin T8.

### Verificación
- typecheck: 0 errores. lint: 0 errores, 7 warnings preexistentes.
- `vitest related`: 827 archivos, 2 rojos: guard R9 (arriba) y
  `proveedores/catalog-line.int.test.ts` R32, que también falla sin mis cambios (stash).
- `vitest run guard`: 75 archivos, 1 rojo (R9 de arriba).
- `ai-provider-migration.int.test.ts`: 10/10 en base efímera.

Veredicto: T1, T2, T3, T7 hechas; la guardia R9 de errores queda roja hasta T8.

## Tanda 2 — T4, T5, T6 (2026-10-13)

### Archivos
- Creados (dominio): `lib/modules/integraciones/domain/{get-ai-provider-connection,test-ai-provider-key,
  test-saved-ai-provider,save-ai-provider-connection,disconnect-ai-provider,get-ai-provider-readiness,
  resolve-ai-provider-for-reading,report-ai-provider-outcome}.ts`.
- Creados (adaptadores): `adapters/driven/persistence/ai-provider-connection-prisma.ts`,
  `adapters/driven/catalog/ai-provider-catalog-prisma.ts`.
- Modificados: `domain/ai-provider.ts` (+ `AI_PROVIDER_API_KEY_FIELD`, `aiProviderKeyContext`),
  `index.ts` (+ 9 fábricas, `isAccountFailure` y tipos), `specs/.../tasks.md` (T4–T6 marcadas).
- Tests creados: `tests/unit/integraciones/ai-provider/{ai-provider-doubles.ts,test-ai-provider-key,
  test-saved-ai-provider,save-ai-provider-connection,disconnect-ai-provider,resolve-and-report}.test.ts`,
  `tests/integration/integraciones/ai-provider-connection-prisma.int.test.ts`.
- Tests ampliados (solo añadir): `authorization.test.ts`, `module-shape.test.ts` (R18: + 12 archivos;
  R20: + 32 símbolos del contrato), `tests/integration/aislamiento.json` (+ entrada `commit` al final).

### R → test (de esta tanda)
- R1 → `authorization.test.ts` (5 operaciones × 5 actores rechazados; antes de validar)
- R2 → `authorization.test.ts`, `resolve-and-report.test.ts`, `ai-provider-connection-prisma.int.test.ts`
- R4 → `ai-provider-connection-prisma.int.test.ts` (catálogo por el adaptador)
- R5 → `ai-provider-connection-prisma.int.test.ts` (RLS forzada en las dos, índice único → carrera)
- R6, R21, R24, R25, R26, R27, R28 → `resolve-and-report.test.ts`
- R7 → `save-ai-provider-connection.test.ts`, `ai-provider-connection-prisma.int.test.ts`
- R9 → `test-saved-ai-provider.test.ts`, `resolve-and-report.test.ts`
- R10, R11, R12, R13, R18 → `test-ai-provider-key.test.ts` (R18 también en save)
- R14 → `test-saved-ai-provider.test.ts`
- R15, R16, R17, R19 → `save-ai-provider-connection.test.ts`; R19 también en el de integración
  (dos altas y dos guardados concurrentes reales)
- R20 → `disconnect-ai-provider.test.ts`, `ai-provider-connection-prisma.int.test.ts`
- R23 (`getAiProviderStatus`), R37 (readiness) → `resolve-and-report.test.ts`, `authorization.test.ts`

### Desviaciones del design
- `getAiProviderStatus` es `createGetAiProviderStatus` en `resolve-ai-provider-for-reading.ts`:
  «Archivos esperados» no le da archivo propio.
- El adaptador toma el ámbito con `companyScopeColumns(scope)` (en `where` y en `data`) y NO añade
  una envoltura nueva a `company-scope.ts`: `guard-ambito-empresa-integraciones` fija exactamente
  dos exportaciones allí. Una envoltura propia exigiría tocar la guardia.
- Segunda vuelta de la carrera: `persist` se repite una vez si `create` lanza
  `AiProviderConnectionRaceError` **o** si `update` devuelve `null` (fila borrada entre leer y
  escribir); a la tercera, lanza `AiProviderConnectionRaceError`.
- `reportAiProviderOutcome` recibe `AiProviderFailure` y no marca si `!isAccountFailure` (el puerto
  del gateway de §6.3 pasa un `AiProviderFailure`).
- Si el catálogo no trae el proveedor de una conexión existente (la FK lo impide), los casos de uso
  lanzan `Error` llano (inesperado).
- `parseKeyInput`/`runProbe` (en `test-ai-provider-key.ts`) y `decryptStoredKey` (en
  `test-saved-ai-provider.ts`) se reutilizan desde guardar y resolver.
- `ai-provider-doubles.ts` es un helper de tests nuevo, calcado de `whatsapp-doubles.ts`.

### Verificación
- typecheck: 0 errores. lint: 0 errores, 7 warnings preexistentes (no son de esta tanda).
- `vitest related` (12 de `lib/` + tests tocados + `aislamiento.json`): 354 archivos, 5686 verdes,
  3 omitidos, 0 rojos.
- `vitest run guard`: 75 archivos, 1 rojo, el conocido `guard-catalogo-de-errores` R9 (se cierra con
  T8); `guard-ambito-empresa-integraciones` verde, con el adaptador nuevo dentro del barrido.
- `ai-provider-connection-prisma.int.test.ts`: 13/13 en base efímera.
- `vitest run tests/unit/integraciones`: 35 archivos, 578 verdes.

Veredicto: T4, T5 y T6 hechas y en verde; solo sigue rojo R9 de errores, que se cierra en T8.

## Tanda 3 — T8, T9 (2026-10-13)

### `[POR VERIFICAR]` 3–5 de `design.md > 19`, cerrados contra los paquetes instalados
Versiones: `openai@7.32.0`, `@anthropic-ai/sdk@0.131.0`, `@google/genai@2.23.0`. Lo que el paquete
no puede decir (comportamiento del servidor de OpenRouter/Gemini) se contrastó con su documentación
oficial (descargada el 2026-10-13) y se marca como tal.
- **3a. Parte PDF de Chat Completions** — `openai/resources/chat/completions/completions.d.ts:990-1023`:
  `ChatCompletionContentPart.File = { type: 'file'; file: { file_data?, file_id?, filename? } }`;
  imagen `{ type: 'image_url'; image_url: { url } }` (l. 1041-1065). El `.d.ts` dice solo «base64
  encoded file data»; el prefijo `data:application/pdf;base64,` sale de la doc de OpenAI
  (developers.openai.com/api/docs/guides/file-inputs: «Chat Completions accepts only PDF files as
  `file` content parts», ejemplo con `file_data: "data:application/pdf;base64,..."`).
- **3b. OpenRouter acepta la misma forma** — doc oficial openrouter.ai/docs/features/multimodal/pdfs:
  `{ type: 'file', file: { filename, file_data: 'data:application/pdf;base64,…' } }`. **No sale del paquete.**
- **3c. Campo de tokens** — `completions.d.ts:1790` `max_completion_tokens`; `:1801` `max_tokens` es
  `@deprecated`. OpenRouter acepta los dos con la misma semántica (openrouter.ai/docs/api-reference/parameters).
  Se usa `max_completion_tokens: 16000` (el mismo tope que Claude).
- **4a. `client.get('/key')`** — `openai/client.d.ts:272` `get<Rsp>(path, opts?)` es público; la URL se
  arma en `client.js` `buildURL` (base `…/api/v1` + `/key`, sin doble barra). La ruta `GET /api/v1/key`
  sale de openrouter.ai/docs/api-reference/limits; `curl` sin key a `https://openrouter.ai/api/v1/key`
  responde 401 y a `/api/v1/models` 200 (listado público, confirma que no valida la key).
- **4b. `baseURL`** — `client.d.ts:85` `baseURL?`; `https://openrouter.ai/api/v1` según la quickstart de
  OpenRouter. El listado sin `offset`/`limit` viene entero (doc de `GET /models`); `models.list()`
  devuelve `Page` con `data` (`core/pagination.d.ts:46-47`).
- **5a. Gemini 400 `API_KEY_INVALID`** — paquete: `ApiError { status }` (`genai.d.ts:544`) y
  `throwErrorIfNotOK` (`dist/node/index.mjs:14076-14104`) copia el cuerpo JSON entero en `message`,
  así que el motivo, si viene, está en `error.message`. **Que el servidor lo mande en un 400 NO está
  verificado**: la doc actual (ai.google.dev/gemini-api/docs/api-errors) da 401 `authentication` para
  key inválida (401 ya es `rejected_key`). La regla del design se implementa tal cual (no estorba).
- **5b. OpenRouter 402** — doc de limits: 402 Payment Required por saldo negativo o límite de crédito
  de la key ⇒ `quota`. **No sale del paquete.**
- Otros: Gemini sin `retryOptions` no reintenta (`index.mjs:13891`, `if (!retryOptions || …) return
  response`); `GetModelConfig { httpOptions, abortSignal }` (`genai.d.ts:6941-6951`).
  OpenAI/Anthropic: `APIConnectionError`, `APIUserAbortError` son `APIError` sin `status`
  (`core/error.d.ts:19-31`); `models.retrieve(model, options?)` en `openai/resources/models.d.ts:13`.

### Archivos
- Creados: `lib/modules/documentos/domain/ai-read-use.ts`, `ports/ai-provider-gateway.ts`,
  `adapters/driven/ai/ai-reader-openai.ts`; tests `run-document-job-ai-provider.test.ts`,
  `issue-upload-links-ai-provider.test.ts`, `run-document-job-doubles.ts` (helper),
  `ai-reader-openai-adapter.test.ts`, `ai-model-literals.test.ts`, `openai-sdk-isolation.test.ts`.
- Modificados: `documentos/domain/{errors,failure-kind,issue-upload-links,run-document-job}.ts`,
  `documentos/index.ts`, `adapters/driven/ai/{ai-reader-anthropic,ai-reader-genai}.ts`,
  `lib/composition/index.ts` (ajuste mínimo, abajo).
- Borrados: `adapters/driven/config/ai-config-env.ts`, `tests/unit/documentos/ai-config.test.ts`
  (borrado preparado en el índice: los `qc158/qc159-alcance` leen `git ls-files`).
- Tests adaptados (tensados): `run-document-job`, `run-document-job-log`, `document-job-route`
  (cadena + proveedor `ACTIVE`; el helper además falla si la cadena no recibe el lector observado),
  `issue-upload-links`, `authorization` (+ «la conexión no se consulta sin permiso"),
  `document-upload-actions`, `failure-kind` (5 códigos; `ai_unavailable` único reintentable),
  `module-contract` (+2 runtime, +2 tipos; clases nuevas con su `code` y `failure`),
  `qc111-alcance` R22 (lista exacta 5 → 7 clases), `ai-reader-anthropic-adapter`, `ai-reader-adapter`,
  `integraciones/module-shape` R19 (+7 archivos de documentos y un caso nuevo: solo por contrato).
- Sin tocar y verdes: `read-pdf-with-ai`, `process-pdf-by-strategy`, `crop-catalog-images`, `ai-reader-canned`.

### R → test (de esta tanda)
- R9 (al leer) → `run-document-job-ai-provider.test.ts` («key ilegible … ai_provider_error»)
- R10 → `ai-reader-{anthropic-adapter,adapter,openai-adapter}.test.ts` («la prueba de la conexión»)
- R11 → los tres adaptadores («la clasificación de un fallo» y probes)
- R21 → `run-document-job-ai-provider.test.ts` (uso por estrategia, mismo lector en el recorte)
- R22 → `ai-model-literals.test.ts` (variables en `lib/`+`app/`), los tres adaptadores (sin `process.env`,
  key por lector), `ai-reader-adapter` (aislamiento de `@google/genai`)
- R23 → `issue-upload-links-ai-provider.test.ts`
- R24, R25, R26, R27, R28 → `run-document-job-ai-provider.test.ts`; R24/R25/R26 también
  `failure-kind.test.ts`; R25/R26 (lanzar o no `AiProviderError`) en los tres adaptadores
- R29 → `ai-reader-openai-adapter.test.ts`, `openai-sdk-isolation.test.ts`
- R43 → `ai-model-literals.test.ts` (barrido de `lib/` + sensibilidad)

### Desviaciones del design
- **Contrato y puerto**: `AiProviderGateway`/`AiReaderLookup` viven en `ports/` pero el barril solo
  reexporta de `./domain` (`module-contract` (b)); se reexportan desde `domain/run-document-job.ts`.
  `DocumentPipeline` (tipo de `pipelineFor`) se exporta del dominio pero no por el barril.
- **402 ⇒ `quota` también en Gemini** (doc oficial de errores de Gemini: `payment_required`, prepago
  agotado) y en el clasificador único de OpenAI/OpenRouter (OpenAI no documenta 402; la tabla del
  design lo daba solo para OpenRouter y el lector comparte función). Anthropic 402 ⇒ `unexpected`.
- **Gemini: todo lo que no es `ApiError` ⇒ `unreachable`** (la librería convierte toda respuesta de
  error en `ApiError` y deja pasar tal cual los fallos de `fetch`).
- Los probes deduplican modelos (receta = catálogo ⇒ una sola consulta).
- En OpenRouter, si la key falla gana su fallo aunque el listado responda.
- 403 de OpenRouter también es «presupuesto agotado» (doc de limits); el design lo mapea a
  `rejected_key` y así queda.
- **Composición (ajuste mínimo para compilar, T10 lo reemplaza)**: `aiReader` global ya no usa
  Claude: fuera de `DOCUMENTS_E2E_DOUBLES` rechaza; un `aiProviderGateway` provisional dice
  `missing`/no configurado fuera del doble E2E y `ready` con el lector de guion dentro; `runDocumentJob`
  recibe `pipelineFor: () => ({ processPdfByStrategy, cropCatalogImages })` (ignora el lector) e
  `issueUploadLinks` el gateway. `readPdfWithAi`/`processPdfByStrategy` siguen en la fachada (su
  retirada y `documentos-facade.test.ts` son de T10). **Hasta T10, fuera de E2E ninguna empresa lee PDF.**

### Verificación
- `pnpm run typecheck`: 0 errores.
- `pnpm run lint`: 0 errores, 7 warnings preexistentes (`confirm-catalog-import.test.ts`, `order-service.test.ts`).
- `pnpm exec vitest related --run` (11 de `lib/` + 20 tests tocados): 380 archivos, 6068 verdes,
  6 omitidos, 0 rojos (727 s).
- `pnpm exec vitest run guard`: 75 archivos, 1048 verdes, 20 omitidos, **0 rojos**:
  `guard-catalogo-de-errores` R9 queda verde con `AiProviderMissingError` y `AiProviderError`.

Veredicto: T8 y T9 hechas y en verde; la composición queda con un gateway provisional hasta T10.
