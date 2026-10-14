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

## Tanda 4 — T10, T11, T14 (2026-10-13)

### Archivos
- Modificados: `lib/composition/index.ts` (fuera el lector y el gateway provisionales y las
  construcciones globales de `readPdfWithAi`/`processPdfByStrategy`/`cropCatalogImages`; dentro
  `READER_BY_PROVIDER`, `aiProviderGateway` y `documentPipelineFor` en el bloque de documentos, y
  `PROBE_BY_PROVIDER`, `aiProviderProbe`, repositorio, catálogo y los nueve miembros en un bloque
  nuevo al final de `integraciones`; nada ajeno reordenado), `.env.example` (bloque de IA fuera),
  `docs/architecture.md` (línea de integraciones externas, frase del build de preview, dos filas
  de la tabla de variables), `specs/.../tasks.md` (T10, T11, T14).
- Creados: `lib/modules/integraciones/adapters/driving/ai-provider-actions.ts`;
  `tests/unit/composition/ai-provider-wiring.test.ts`;
  `tests/unit/integraciones/ai-provider/ai-provider-actions.test.ts`.
- Tests tensados (solo añadir): `documentos-facade.test.ts` (censo 14 → 12; afirma que las dos
  claves no están; mock de `createAnthropicReader`; el `vi.hoisted` ya no borra las cuatro de IA),
  `module-shape.test.ts` (R18 + el archivo de acciones; R19 fachada + nueve miembros y los tipos
  de los puertos nuevos), `guard-dobles-e2e.test.ts` (fila de integraciones + el doble de la
  prueba), `session-once-per-request-actions.test.ts` (+ la acción de consulta al final),
  `integraciones-graph-doubles.test.ts` y `encryption-keys-env.test.ts` (censos cerrados de la
  fachada `integraciones`, + nueve; no estaban en `design.md > 15.3`).

### R → test (de esta tanda)
- R1 → `ai-provider-actions.test.ts` (errores traducidos sin revalidar)
- R8 → `ai-provider-actions.test.ts` (ningún estado con la key ni el cifrado, también con un caso
  de uso que filtrara la fila)
- R13–R18, R20 → `ai-provider-actions.test.ts` (borde de cada acción)
- R21, R22 (lector por código y modelo por uso), R23, R24 → `ai-provider-wiring.test.ts`
- R37 → `ai-provider-actions.test.ts` (readiness que no lanza)
- R40, R41, R42 → `ai-provider-wiring.test.ts` (R42 con `process.env` vigilado y caso de
  sensibilidad; probado por mutación: una lectura en la composición lo pone rojo)
- R22 (variables) → `ai-model-literals.test.ts` y `guard-variables-por-entorno` verdes tras T14

### Desviaciones del design
- `documentPipelineFor` sin anotación de retorno: `DocumentPipeline` no sale por el contrato de
  `documentos` y la composición no importa de `domain/`; el tipo se infiere y casa con `pipelineFor`.
- `readerFor` devuelve `{ status }` para `missing`/`unreadable` (no la resolución entera).
- `guard-dobles-e2e`: la fila de `documentos` ya listaba `ai-reader-canned`; su elección vive ahora
  en `aiProviderGateway`, que consulta `documentsE2EDoublesEnabled(`. No se añadió nada a esa fila.
- Acciones: `testSavedAiProviderAction` revalida tras un resultado `tested` (bueno o fallido, la
  prueba escribe estado) y no con `not_connected`; `testAiProviderKeyAction` no revalida (no
  escribe). La readiness atrapa también un fallo al leer la sesión.
- `docs/architecture.md > Lo que hace el humano` sigue pidiendo borrar `ANTHROPIC_API_KEY`,
  `GEMINI_API_KEY` y los modelos de preview: no se tocó.

### Verificación
- `pnpm run typecheck`: 0 errores.
- `pnpm run lint`: 0 errores, 7 warnings preexistentes (`confirm-catalog-import.test.ts`,
  `order-service.test.ts`).
- `pnpm exec vitest related --run` (2 de `lib/` + 9 tests): 346 archivos, 5542 verdes, 3 omitidos,
  1 rojo: `encryption-keys-env.test.ts` (censo de la fachada), tensado y verde después (28/28).
- `pnpm exec vitest run guard`: 75 archivos, 1048 verdes, 20 omitidos, 0 rojos.

Veredicto: T10, T11 y T14 hechas y en verde; sale el gateway provisional y la lectura usa la
conexión de cada empresa.

## Tanda 5 — T13 (frontend_dev, 2026-10-13)

### Archivos
- Creados: `components/shared/ai-provider-required-notice.tsx`,
  `tests/unit/shared/ai-provider-required-notice.test.tsx`.
- Modificados: `app/(private)/produccion/formulas/page.tsx` y `app/(private)/proveedores/[id]/page.tsx`
  (con `canUpload` piden `getAiProviderReadinessAction()`: `configured` ⇒ el botón de siempre; si no,
  el aviso en su sitio; sin `canUpload` no se consulta), `components/shared/CATALOGO.md` (fila nueva).
- Tests ampliados: `formulas-upload.test.tsx`, `supplier-detail-upload.test.tsx`,
  `document-upload-errors.test.tsx`, `module-shape.test.ts` (R19: + las dos páginas en la lista de
  importadores y un caso que exige que solo importen la acción de readiness por su ruta exacta).
- Tests tensados (solo un doble de la acción con `configured: true`; nada de lo que afirman cambia):
  `recipe-page`, `supplier-detail-page`, `recetas-paridad`, `catalogo-paridad`,
  `pantallas-exigen-permiso` y, fuera de la lista de `design.md > 15.3` pero confirmados por
  `vitest related`, `acciones-por-fila`, `catalog-line-form`, `catalog-line-sheet`,
  `delete-catalog-line-dialog`.

### R → test
- R37 → `ai-provider-required-notice.test.tsx` (con y sin `canConfigure`, enlace a
  `AI_PROVIDER_INTEGRATION_ROUTE`, talla táctil); `formulas-upload.test.tsx` y
  `supplier-detail-upload.test.tsx` (configurada ⇒ botón; sin configurar con y sin `canConfigure` ⇒
  aviso en el sitio del botón)
- R38 → `formulas-upload.test.tsx` y `supplier-detail-upload.test.tsx` (sin `documentos.modificar`, ni
  botón ni aviso y la readiness no se consulta; proveedor inexistente, tampoco)
- R39 → `document-upload-errors.test.tsx` (`ai_provider_missing` y `ai_provider_error`: texto del
  catálogo en la fila, distinto entre sí y sin el motivo libre)

### Desviaciones
- **`components/shared/index.ts` no se creó.** No existe barrel raíz de `components/shared` (cada pieza
  se importa por su archivo y la guardia del catálogo trataría un `index.ts` suelto como una entrada
  más con fila propia). `design.md > 1` y `tasks.md > Archivos esperados` lo listan; queda para que el
  leader decida si se corrige el spec o se crea.
- El aviso usa `Notice` tal cual (icono de `info`, no el candado del tablero), como fija `design.md > 12.6`.
- Prop `labels` opcional (textos para i18n) además de `canConfigure`.

### Verificación
- `pnpm run typecheck`: 0 errores.
- `pnpm run lint`: 0 errores, 7 warnings preexistentes (`confirm-catalog-import.test.ts`,
  `order-service.test.ts`).
- `pnpm exec vitest related --run` (2 páginas, el componente y 14 tests): 14 archivos, 345 verdes,
  1 omitido, 0 rojos. Una vuelta intermedia dio rojo `module-shape` R19 por los archivos a medias de
  T12 en `proveedor-ia/`; en la siguiente, con su lista ya añadida, verde.
- `pnpm exec vitest run tests/guards/guard-catalogo-de-componentes.test.ts`: 59 verdes.

Veredicto: T13 hecha y en verde; falta decidir el `components/shared/index.ts` del spec.

## Tanda 6 — T12, T15 (frontend_dev, 2026-10-13)

### Archivos
- Reescrito: `app/(private)/integraciones/proveedor-ia/page.tsx` (`PageShell` + `PageHeader` con miga,
  párrafo del tablero, `ErrorState` / `AiProviderForm` / `AiProviderCard`).
- Creados en `app/(private)/integraciones/proveedor-ia/components/`: `index.ts`,
  `ai-provider-brand.ts`, `ai-provider-logo.tsx`, `ai-provider-picker.tsx`, `ai-provider-form.tsx`,
  `ai-provider-card.tsx`.
- Creados: `tests/unit/integraciones-ui/ai-provider-page.test.tsx`, `ai-provider-form.test.tsx`,
  `ai-provider-card.test.tsx`.
- Tensados (solo añadir): `tests/unit/integraciones-ui/integration-pages.test.tsx` (cascarón: solo
  inventarios; `proveedor-ia` y `whatsapp` afirman que no importan `IntegrationPlaceholder`,
  `INTEGRATION_EMPTY_MESSAGE` ni el barrel compartido; el corte por permiso sigue en las tres),
  `tests/unit/integraciones/module-shape.test.ts` (R19: + los seis archivos de la pantalla, ruta
  exacta), `specs/.../tasks.md` (T12, T15).

### R → test
- R3 → `ai-provider-page.test.tsx` (notFound sin permiso y sin consultar; login sin sesión; primera
  sentencia) e `integration-pages.test.tsx` (R11–R13 de QC-222 siguen en las tres)
- R8 → `ai-provider-page.test.tsx` (props y HTML sin `apiKey*`/cifrado, campos vacíos) y
  `ai-provider-form.test.tsx` (campo vacío y key fuera del HTML tras cada tipo de respuesta)
- R30 → `ai-provider-page.test.tsx` y `ai-provider-form.test.tsx` (cuatro radios con logo, nombre y
  subtítulo; flechas; campo oculto con ojo; ayuda con enlace y modelos; botones deshabilitados)
- R31 → `ai-provider-card.test.tsx` y `ai-provider-page.test.tsx`
- R32 → `ai-provider-form.test.tsx` y `ai-provider-card.test.tsx`
- R33 → `ai-provider-card.test.tsx` (título, texto, cancelar sin cambios)
- R34 → `ai-provider-form.test.tsx`, `ai-provider-card.test.tsx`, `ai-provider-page.test.tsx`
- R35 → `ai-provider-card.test.tsx` (`aria-label` del monograma). **R35 queda PENDIENTE de los logos
  oficiales**: no hay SVG entregados ni uso de marca confirmado (`design.md > 12.5`); no se crea
  `public/brand/ai-providers/`. Al llegar, solo cambian `ai-provider-brand.ts` y
  `ai-provider-logo.tsx` y el test pasa a afirmar el `alt`.
- R36 → `ai-provider-form.test.tsx` y `ai-provider-card.test.tsx` (16 px y 44 px en el campo, ojo
  44 × 44, botones 44 px, opciones 64 px, sin `hover:` en las opciones, columnas y apilado ≤ 760 px)

### Desviaciones y abiertos
- **Selector**: `RadioGroup` y `Radio` de `@base-ui/react` (ya aprobada; el tablero móvil la nombra)
  en vez de escribir a mano las flechas. Sin `name`: el proveedor viaja en un `<input hidden>`.
- **Sin `SubmitButton`**: no admite `disabled` ni `formAction`, y los dos botones envían a acciones
  distintas. Son `Button` con `Spinner` y el pendiente de cada `useActionState`.
- **Placeholder «Pega aquí tu API key» sin pintar**: `PasswordField` no tiene `placeholder` y
  extenderlo exige tocar su fila de `CATALOGO.md`, que estaba en manos de T13. Abierto: paso 2 de la
  regla (prop opcional) en una tanda que pueda tocar el catálogo.
- **Textos que el spec no trae**: título del `ErrorState` de carga «No se pudo cargar el proveedor
  IA.» y nombre de la miga «Ruta» (este sale de `Superficies.dc.html`). El texto del enlace a la
  consola es la URL sin protocolo (el tablero trae `[ENLACE A LA CONSOLA]`). A confirmar por el humano.
- **Sin «Cancelar»** al cambiar de key o proveedor: el tablero no lo trae; se sale guardando o
  recargando.
- El aviso en `ERROR` pinta solo `lastError` (`design.md > 12.3`), no la coletilla del tablero
  «Hasta que la reemplaces…», que contradice R28.
- Tras una prueba fallida de la guardada, el mensaje va en el aviso de la tarjeta; debajo solo
  mientras el aviso aún no lo trae (evita el duplicado tras revalidar). Con `not_connected`, la
  tarjeta hace `router.refresh()` (la acción no revalida en ese caso).
- Guardias no corridas en esta tanda (el leader acotó la verificación a los tres comandos).

### Verificación
- `pnpm run typecheck`: 0 errores.
- `pnpm run lint`: 0 errores, 7 warnings preexistentes (`confirm-catalog-import.test.ts`,
  `order-service.test.ts`).
- `pnpm exec vitest related --run` (7 de la pantalla + 5 tests): 5 archivos, 168 verdes,
  1 omitido, 0 rojos. Sueltos: `ai-provider-page` + `integration-pages` 25/25, `ai-provider-form`
  21/21, `ai-provider-card` 19/19.

Veredicto: T12 y T15 hechas y en verde; R35 pendiente de los logos oficiales.

## Tanda 6 — guardia de dobles, fila de documentos (backend_dev, 2026-10-13)

- Modificado (solo añadir, al final): `tests/guards/guard-dobles-e2e.test.ts`.
- Hallazgo: la fila de `documentos` ya exigía la consulta en el camino por empresa:
  `aiProviderGateway.readerFor` elige `readCannedText` (doble de la fila) dentro de
  `documentsE2EDoublesEnabled()`, y el caso genérico de ELECCIÓN lo cubre. No se tocó la fila.
- Añadido: un caso de SENSIBILIDAD sobre el fuente real de `lib/composition/index.ts`, mutado en
  memoria: localiza `aiProviderGateway`, afirma que tiene `readCannedText`, `READER_BY_PROVIDER` y la
  consulta, y que al quitar la consulta `eleccionesSinConsulta` lo marca.
- R41 → `guard-dobles-e2e.test.ts` («SENSIBILIDAD: el lector por empresa de documentos consulta
  DOCUMENTS_E2E_DOUBLES…»), además de `ai-provider-wiring.test.ts`.
- `pnpm run typecheck`: 0 errores. `pnpm run lint`: 0 errores, 7 warnings preexistentes.
  `pnpm exec vitest run guard`: 75 archivos, 1049 verdes, 20 omitidos, 0 rojos.

Veredicto: la fila de `documentos` cubre el lector por empresa y un caso de sensibilidad lo demuestra.

## Tanda 7 — placeholder de la key y T16 (frontend_dev, 2026-10-13)

### Archivos
- `components/shared/password-field.tsx`: prop opcional `placeholder` (paso 2 de la regla; sus
  consumidores no cambian). Fila de `PasswordField` en `components/shared/CATALOGO.md`: alcance y
  punto de extensión `placeholder`.
- `app/(private)/integraciones/proveedor-ia/components/ai-provider-form.tsx`: «Pega aquí tu API key».
- `tests/unit/integraciones-ui/ai-provider-form.test.tsx`: el caso R30 del campo afirma el placeholder.
- Creado: `e2e/integraciones-proveedor-ia.spec.ts` (`design.md > 15.4`, puntos 1–7 en dos casos).
- Fila sembrada de `ai_provider_connections` (`ANTHROPIC`, `ACTIVE`, `v1:e2e-sin-descifrar`) en el
  `beforeAll`, y su borrado antes que usuarios y empresa (también en la limpieza de huérfanos), en
  `e2e/documentos.spec.ts`, `e2e/formula-desde-pdf.spec.ts`, `e2e/catalogo-desde-pdf.spec.ts`.
- `e2e/integraciones.spec.ts` (caso Administrador): Proveedor IA muestra el formulario «Conecta tu
  proveedor» y no `integration-empty`.
- `tests/guards/guard-identificador-de-request.test.ts`: + `integraciones-proveedor-ia.spec.ts` en
  `E2E_ESPERADOS` (solo añadir).
- `specs/.../tasks.md > Archivos esperados`: + `components/shared/password-field.tsx`.
- Adenda (orden del leader): `e2e/movimiento.spec.ts` siembra la misma fila en su `beforeAll` y la borra antes que usuarios y empresa (también en huérfanos), así su diálogo de subida de Fórmulas se pinta. typecheck 0 errores; lint 0 errores, 7 warnings preexistentes; E2E no corrido (base sin migrar).

### R → test (E2E)
- R37 → `integraciones-proveedor-ia.spec.ts` (aviso con enlace sin conexión; botón con conexión;
  aviso sin enlace con «Pídele…» para un rol con `recetas.consultar` + `documentos.modificar`)
- R30 → idem (cuatro radios, «Sin configurar», botones deshabilitados) e `integraciones.spec.ts`
- R16, R13, R17, R31, R8, R33, R20, R34 → caso largo de `integraciones-proveedor-ia.spec.ts`
- R3 → caso del rol sin `integraciones.modificar` (404)
- R41 / R23 → los tres E2E de documentos con la fila sembrada
- R30 (placeholder) → `ai-provider-form.test.tsx`

### Desviaciones y abiertos
- **`e2e/movimiento.spec.ts` NO se toca** (orden del leader: solo si sube PDF, y no sube). Pero abre
  y cierra el diálogo de subida de Fórmulas (`document-upload-open`), que sin conexión ya no se pinta
  (R37): **ese spec se pondrá rojo**. Decide el leader: sembrar allí también la fila (lo que ya lista
  `tasks.md > Archivos esperados`) o cambiar de diálogo.
- R32 («Cambiar key o proveedor») y R14 no tienen paso E2E: `design.md > 15.4` no los pide.

### Verificación
- `pnpm run typecheck`: 0 errores.
- `pnpm run lint`: 0 errores, 7 warnings preexistentes.
- `pnpm exec vitest related --run` (password-field, ai-provider-form y su test): 20 archivos,
  256 verdes.
- `pnpm exec vitest run guard-identificador guard-catalogo-de-componentes guard-e2e`: 6 archivos,
  109 verdes.
- **E2E NO corrieron en verde: la base local no tiene la migración de la ficha.**
  `pnpm exec playwright test e2e/integraciones-proveedor-ia.spec.ts` → 4 rojos (chromium y webkit),
  todos en el `beforeAll`:
  `Invalid prisma.aiProviderConnection.deleteMany() invocation … The table (not available) does not exist in the current database.`
  `prisma migrate status`: `20261013150000_ai_providers` sin aplicar, y la base trae tres migraciones
  de otras ramas que no están aquí (`…inventory_movement_kind_consumption`,
  `…reservations_and_decimal_stock`, `…order_step_evidence`): es una base compartida. No se migró (fuera
  del alcance de frontend_dev). Los otros cuatro specs tocados no se corrieron: fallarían por la misma
  tabla (siembran la fila o abren la pantalla). Para cerrarlos hace falta una base con la migración.

Veredicto: placeholder hecho y en verde; T16 escrita pero sin E2E verdes (base sin migrar), T16 sigue `[ ]`.

## Cierre (implementer, 2026-10-13) — T17 trazabilidad

### Mapa R → test (consolidado; detalle por tanda arriba)
- R1, R2, R37 → `tests/unit/integraciones/ai-provider/authorization.test.ts`; R1, R8, R13–R20, R37 → `ai-provider-actions.test.ts`
- R3, R8 → `tests/unit/integraciones-ui/ai-provider-page.test.tsx`; R8, R30, R32, R34, R36 → `ai-provider-form.test.tsx`; R31–R36 → `ai-provider-card.test.tsx`
- R4, R5 → `tests/integration/integraciones/ai-provider-migration.int.test.ts`; R2, R4, R5, R7, R19, R20 → `ai-provider-connection-prisma.int.test.ts`
- R6, R9, R21, R23–R28 → `resolve-and-report.test.ts`; R9, R21, R24–R28 → `run-document-job-ai-provider.test.ts`; R23 → `issue-upload-links-ai-provider.test.ts`
- R8 → `connection-view.test.ts`; R9, R11, R25, R26 → `ai-provider-failure.test.ts`; R18 → `ai-provider-input.test.ts`
- R10–R13, R18 → `test-ai-provider-key.test.ts`; R9, R14 → `test-saved-ai-provider.test.ts`; R7, R15–R19 → `save-ai-provider-connection.test.ts`; R20 → `disconnect-ai-provider.test.ts`
- R10, R11, R25, R26, R29 → `ai-reader-{anthropic-adapter,adapter,openai-adapter}.test.ts`; R29 → `openai-sdk-isolation.test.ts`
- R22, R43 → `ai-model-literals.test.ts`; R22 → `guard-variables-por-entorno`
- R37–R39 → `ai-provider-required-notice.test.tsx`, `formulas-upload.test.tsx`, `supplier-detail-upload.test.tsx`, `document-upload-errors.test.tsx`
- R40 → `ai-provider-probe-canned.test.ts`; R40–R42 → `tests/unit/composition/ai-provider-wiring.test.ts`; R41 → `guard-dobles-e2e.test.ts` (caso nuevo)
- R44 → `tests/guards/guard-dependencias-aprobadas.test.ts` (T0: 2/2 verde)
- E2E (escritos, sin correr en local): R3, R8, R13, R16, R17, R20, R30, R31, R33, R34, R37 → `e2e/integraciones-proveedor-ia.spec.ts`; R23, R41 → `documentos`, `formula-desde-pdf`, `catalogo-desde-pdf`, `movimiento`

### Pendientes
- **R35 pendiente de logos oficiales** (`[POR CONFIRMAR]`): hoy se cubre con el `aria-label` del monograma en `ai-provider-card.test.tsx`.
- **T16 sin correr:** la base local es compartida y no tiene `20261013150000_ai_providers`; no se migró. Los E2E corren en CI (PR a producción) o tras migrar una base propia.
- `proveedores/catalog-line.int.test.ts` R32: rojo previo a la feature (comprobado con stash en la tanda 1) y no está en `tests/baseline-rojos.json`.
- Spec: `components/shared/index.ts` no existe (no hay barril raíz) y no se creó; `design.md > 1` y `tasks.md` lo listan.

### Verificación final (implementer)
- `pnpm exec vitest run guard`: 75 archivos, 1049 verdes, 20 omitidos, 0 rojos (tras la tanda 7).
- typecheck y lint: 0 errores en cada tanda (7 avisos previos).

## F2.3 — Sincronizacion con dev (2026-10-13)

`git fetch origin dev` + `git merge origin/dev` (dev en 8ecfff69). Los choques esperados con
QC-214 (schema.prisma, .env.example, architecture.md, composition, error-codes/catalog,
catalogo.test, guard-dobles-e2e) se auto-mezclaron sin conflicto. Conflictos reales, todos de registro:

- `docs/diseno/canvas/canvas.json`: tres bloques (pantallas, `order`, notas) — se conservan las
  entradas ProveedorIA* (QC-275) y ProductoTerminado*/PedidosPresentaciones* (QC-225). JSON valido.
- `tests/guards/guard-identificador-de-request.test.ts`: `E2E_ESPERADOS` — se conservan
  `integraciones-proveedor-ia.spec.ts` y `detalle-de-producto-terminado.spec.ts`.
- `tests/integration/aislamiento.json`: se conservan la entrada de `ai-provider-connection-prisma`
  y las dos de QC-225 (`finished-product-detail`, `order-delivery-directory`).

Migraciones: dev no trae ninguna posterior; `20261013150000_ai_providers` sigue siendo la ultima. Sin renombrar.

Verificacion: `tsc --noEmit` 0 errores; `pnpm lint` 0 errores (7 warnings previos);
`vitest run guard` 75 archivos / 1055 passed, 20 skipped; `vitest related` de los archivos en
conflicto 1 archivo / 23 passed.

## Rojos de CI en gate-completo (run 38500812990, commit b1cf1e13) — 2026-10-13

Cuatro rojos de esta feature, arreglados en los tests (no en la baseline). Cada cambio lleva el comentario de enmienda `QC-275 2026-10-13`:

- `tests/unit/proveedores/scope.test.ts` (alcance QC-43): sigue el precedente QC-222 T10 (`1bb7fc85`) y excluye la carpeta `integraciones/proveedor-ia/`; todo lo demas bajo integraciones sigue en rojo. La comprobacion por la palabra «proveedor» (que la pantalla usa como texto) se cambia por un barrido de `supplier`, `modules/proveedores` y `SUPPLIERS_ROUTE`. El E2E `integraciones-proveedor-ia.spec.ts` entra en la lista cerrada.
- `tests/unit/recetas-ui/recipe-route-contract.test.ts`: `getAiProviderReadinessAction` pasa a ser una operacion permitida; la lista `MIGRACION_QC275` (schema.prisma + migracion `ai_providers`) se excluye del barrido de db/.
- `tests/unit/composition/ai-provider-wiring.test.ts` R42: se ignora solo `WATCH_REPORT_DEPENDENCIES`, que lee el cargador CJS de Node 24, mediante un conjunto cerrado `RUNTIME_ENV_VARS`. Cualquier otra lectura sigue en rojo, y el test simula la lectura del runtime para comprobar que el filtro no oculta la centinela.

Verificacion:
- `WATCH_REPORT_DEPENDENCIES=1 vitest run` de los 3 archivos: 3 archivos / 45 passed.
- `vitest run guard`: 1062 passed, 20 skipped.
- `tsc`: 0 errores.
- lint: 0 errores (7 avisos previos).
