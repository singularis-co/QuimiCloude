# QT-291 — seleccion-de-modelo-por-tarea · design.md

> Zona: `fullstack` · Complejidad: `high` · depends_on: QC-275 (hecha) · Rama:
> `feature/QT-291-seleccion-de-modelo-por-tarea`
>
> El **qué** está en `requirements.md` (R1–R34; decisiones D1–D11 y E1–E8 por el orden de su tabla).
> Aquí va el **cómo**. Pese al nombre de la ficha, el alcance cerrado es **un solo modelo** para
> fórmula y catálogo (D4), solo del proveedor conectado (D1).
>
> **Enmienda F1.4 (2026-10-22).** Cambian §3 (veinte modelos, recomendado), §4.3 (`selectAiModel`
> consulta el modelo antes de guardar), §4.4 y §11 (textos), §8, §9, §12, §13, §14 y §16 (la
> alternativa 6 pasa a ser la elegida). La migración de T1 (commit `418a746f`) solo rehace su seed.
>
> **Diseño aprobado** (pase `/design`, D9, «aprobado» 2026-10-22):
> `docs/diseno/canvas/ProveedorIAModelos.dc.html` (escritorio, tres estados: predeterminado, elegido,
> modelo retirado; confirmación de cambio de proveedor; toast),
> `docs/diseno/canvas/ProveedorIAModelosTablet.dc.html` y
> `docs/diseno/canvas/ProveedorIAModelosMovil.dc.html` (teléfono y la **ficha**: reutiliza / nuevo /
> librerías / estados / por confirmar). Los marcadores `[MODELO A/B/C]` del tablero los fija §3.
>
> **Regla transversal.** Manda `docs/conventions.md > Comentarios`: ningún comentario nuevo cita
> `QT-<n>`, `R<n>`, `design.md` ni «decisión cerrada». En los tests, `R<n>` va en el nombre del caso.
> Ningún literal de modelo en `lib/` (R6): los ids viven solo en la migración y en los tests.

---

## Lo que ya existe

Buscado `modelo`/`model`, `elegir modelo`, `ai_models`/`AiModel`, `recipeModel`/`catalogModel`,
`predeterminado` en:

- `feature_list.json` (todos los estados), por `name` y `description`: QC-275 `proveedor-ia-propio`
  (`done`), QC-175 `modelo-de-respaldo-si-gemini-esta-saturado` (`pending`), QC-276 (respaldo de
  proveedores, `pending`) y QT-292 (pantalla de catálogo de plataforma, creada al afinar esta).
- `specs/` con grep: solo `specs/QC-275-proveedor-ia-propio/` (su alcance excluía «Elegir modelo a
  mano», que es justo esto).
- El código con Grep/Read. **El MCP del grafo no se consultó**: no estaba entre las herramientas
  cargadas de este agente.

| Apareció | Qué es | Qué se hace |
|---|---|---|
| QC-275 (`done`) | `ai_providers` (con `recipe_model`, `catalog_model`), `ai_provider_connections`, casos de uso de `integraciones`, prueba por proveedor, lectura por empresa | **Se amplía**: es la base. Nada de esto lo cubre ya |
| `AiProviderCatalog` (`ports/ai-provider-catalog.ts`, `adapters/driven/catalog/ai-provider-catalog-prisma.ts`) | Catálogo global leído sin ámbito | **Se amplía** con los modelos (§5.2) |
| `resolve-ai-provider-for-reading.ts` (`modelFor(entry, use)`) | Elige el modelo por uso | **Se reescribe** `modelFor` → modelo en uso (§4.3) |
| `test-ai-provider-key.ts` (`runProbe`, prueba `[recipeModel, catalogModel]`) | Prueba de dos modelos | **Cambia** a un modelo (§4.3) |
| `documentos/domain/ai-read-use.ts` (`USE_BY_STRATEGY`), `AiReadUse` | Uso por estrategia | **Se borran** (§6.1) |
| `ai-reader-{anthropic,genai,openai}.ts` | Lectores y `classifyXError` | **Se amplían**: un 404 del modelo al leer lanza `AiProviderError` (§7) |
| `report-ai-provider-outcome.ts`, `run-document-job.ts` (`observeAccountFailures`) | Marca la conexión por fallo de cuenta | **Se amplían** al modelo no disponible (§7) |
| `AiProviderCard`, `AiProviderForm` (`app/(private)/integraciones/proveedor-ia/components/`) | Tarjeta «conectado» y formulario | **Se amplían** (§12) |
| QC-175, QC-276 | Respaldos | Fuera (Alcance). D7: sin vuelta automática al predeterminado |
| QT-292 | Pantalla de plataforma para el catálogo | Fuera. Frontera en §15 |

**Componentes** (`components/shared/CATALOGO.md`, regla de decisión de `docs/perfil-agentes.md`):

| Fila consultada | Uso | Paso |
|---|---|---|
| `SharedSelect`, `SharedSelectControl` | Disparador y lista del selector en ventanas > 640 px: modo controlado (`value`, `onValueChange`), contenido propio del disparador (`children`), `invalid`, `labelledBy`, `describedBy`, `triggerTestId`, `optionTestId` | 1, reutiliza |
| `SelectField` | La ficha del tablero lo nombra, pero **no cubre modo controlado** (su fila) y aquí se guarda al elegir | No se usa; `SharedSelectControl` es la pieza que envuelve |
| `CountrySelect` | Patrón de hoja inferior a ≤ 640 px (`Sheet`, `useIsMobile`) que pide el tablero de teléfono | Se copia el **patrón** (no la pieza: es de países, con buscador) |
| `StatusBadge` | «Recomendado» (`neutral`), «No disponible» (`danger`); «Error» de la tarjeta ya existe | 1, reutiliza |
| `ConfirmDialog` | «¿Cambiar de proveedor?» | 1, reutiliza |
| `Notice` | Aviso «Error con tu proveedor» de la tarjeta, ya existe | 1, sin cambios |
| `Toaster` (`toast` de `sonner`) | «Modelo guardado» | 1, reutiliza |
| `Card`, `Button`, `Spinner` | Tarjeta y acciones, ya existen | 1, sin cambios |

Pieza nueva:

- `AiModelSelect` en `app/(private)/integraciones/proveedor-ia/components/ai-model-select.tsx`:
  **paso 3** (compone `SharedSelectControl`, `StatusBadge`, `Sheet` y `useIsMobile`). La consume una
  sola ruta: no sube a `shared`. Tablero: los tres de arriba.

Librerías: ninguna nueva (`@base-ui/react`, `lucide-react`, `sonner` ya están; ficha del tablero).

Conclusión: nada existente resuelve la elección; se amplía QC-275.

---

## 1. Qué cambia (resumen)

```
db/schema.prisma                                        ← modelo AiModel; AiProvider pierde dos columnas; AiProviderConnection gana dos
db/migrations/20261022120000_ai_models/{migration,down}.sql
lib/modules/integraciones/
  index.ts                                              ← + AiModelOption, selectAiModel; − AiReadUse
  domain/ai-provider.ts                                 ← entrada sin recipe/catalog; modelInUse; vista con el modelo
  domain/ai-provider-failure.ts                         ← + marksConnection, textos de la prueba
  domain/ai-model-input.ts                              ← nuevo: zod de la elección
  domain/select-ai-model.ts                             ← nuevo: consulta el modelo y guarda
  domain/get-ai-provider-connection.ts                  ← vista con modelos
  domain/test-ai-provider-key.ts                        ← un solo modelo
  domain/test-saved-ai-provider.ts                      ← modelo en uso, marca/limpia el modelo
  domain/save-ai-provider-connection.ts                 ← conserva o vacía la elección
  domain/resolve-ai-provider-for-reading.ts             ← sin `use`; modelo en uso
  domain/report-ai-provider-outcome.ts                  ← + modelo no disponible; recuperar limpia
  ports/ai-provider-catalog.ts                          ← + modelos del proveedor
  ports/ai-provider-connection-repository.ts            ← + model, unavailableModel
  adapters/driven/catalog/ai-provider-catalog-prisma.ts
  adapters/driven/persistence/ai-provider-connection-prisma.ts
  adapters/driving/ai-provider-actions.ts               ← + selectAiModelAction; vistas
lib/modules/documentos/
  domain/ai-read-use.ts                                 ← BORRADO
  ports/ai-provider-gateway.ts                          ← readerFor sin `use`; reportFailure
  domain/run-document-job.ts                            ← sin uso; informa el modelo no disponible
  domain/failure-kind.ts                                ← sin cambios (ai_provider_error ya es definitivo)
  adapters/driven/ai/ai-reader-{anthropic,genai,openai}.ts ← 404 del modelo al leer → AiProviderError
lib/composition/index.ts                                ← gateway sin uso; + selectAiModel
app/(private)/integraciones/proveedor-ia/components/{ai-provider-card,ai-provider-form,ai-model-select}.tsx
docs/architecture.md, tests/guards/guard-empresa-en-esquema.test.ts, tests/guards/guard-identificador-de-request.test.ts
tests/**, e2e/integraciones-proveedor-ia.spec.ts         ← §14
```

---

## 2. Modelo de datos

### 2.1 Prisma

```prisma
/// <comentario corto: catálogo global de modelos; uno predeterminado por proveedor, índice parcial en la migración>
/// @module integraciones
model AiModel {
  provider  AiProviderCode
  modelId   String         @map("model_id")
  isDefault Boolean        @default(false) @map("is_default")
  sortOrder Int            @map("sort_order")

  @@id([provider, modelId], map: "ai_models_pkey")
  @@map("ai_models")
}

model AiProvider {
  code      AiProviderCode @id
  name      String
  sortOrder Int            @map("sort_order")
  // recipeModel y catalogModel: BORRADOS
  @@map("ai_providers")
}

model AiProviderConnection {
  // … columnas de QC-275 sin cambios …
  model            String? @map("model_id")
  unavailableModel String? @map("unavailable_model")
}
```

- **PK compuesta `(provider, model_id)`**, sin id sintético: el id del modelo solo es único dentro de
  su proveedor (OpenRouter usa `<vendor>/<modelo>`, que podría repetir el de otro), y la FK de la
  conexión necesita el par (abajo).
- **`model_id` en la conexión** = la elección (R7). `NULL` = sin elección → predeterminado (R9, R17).
- **FK compuesta** `(provider, model_id) → ai_models(provider, model_id)` `ON DELETE RESTRICT ON
  UPDATE CASCADE`, `MATCH SIMPLE` (la de Postgres por defecto): con `model_id` nulo no se comprueba;
  con valor, la base **rechaza un modelo de otro proveedor** (R7, D1). Un modelo elegido por alguna
  empresa no se puede borrar del catálogo: lo resuelve QT-292 (§15).
- **`unavailable_model`** = el modelo marcado (R21, R23). Texto sin FK: guarda el id que el
  proveedor dijo no ofrecer, aunque sea el predeterminado. La vista compara contra el modelo en uso:
  si el predeterminado cambia en el catálogo, la marca deja de aplicar sola.
- **Sin `@relation`**, como el resto de `integraciones`: las FK van escritas a mano en la migración.
- **Sin columna de empresa en `ai_models`**: catálogo global como `ai_providers` (R1).

### 2.2 Migración `20261022120000_ai_models`

Escrita a mano. En orden:

1. `CREATE TABLE "ai_models"` (`provider ai_provider_code NOT NULL`, `model_id TEXT NOT NULL`,
   `is_default BOOLEAN NOT NULL DEFAULT false`, `sort_order INTEGER NOT NULL`), PK
   `ai_models_pkey (provider, model_id)`, `CHECK ("model_id" <> '')` como
   `ai_models_model_id_not_empty` (R1).
2. FK `ai_models_provider_fkey`: `provider → ai_providers(code)` `ON DELETE RESTRICT ON UPDATE CASCADE`.
3. `CREATE UNIQUE INDEX "ai_models_one_default_per_provider" ON "ai_models"("provider") WHERE
   "is_default"` (R3: la base rechaza un segundo predeterminado).
4. `INSERT INTO "ai_models"` de la lista de §3.
5. `ALTER TABLE "ai_provider_connections" ADD COLUMN "model_id" TEXT, ADD COLUMN "unavailable_model"
   TEXT`; FK `ai_provider_connections_model_fkey` `(provider, model_id) → ai_models(provider,
   model_id)` `ON DELETE RESTRICT ON UPDATE CASCADE`. Las conexiones existentes quedan sin elección:
   leen con el predeterminado.
6. `ALTER TABLE "ai_providers" DROP CONSTRAINT "ai_providers_models_not_empty", DROP COLUMN
   "recipe_model", DROP COLUMN "catalog_model"` (R4).
7. `ENABLE` + `FORCE ROW LEVEL SECURITY` en `ai_models`, sin policies, al final (R1). Las otras dos
   tablas ya lo tienen.

«Al menos un predeterminado por proveedor» no lo puede imponer un índice: lo cubre el test de la
migración (R3) y, en ejecución, `modelInUse` lanza un error de dato imposible si falta (§4.3).

`down.sql`, inverso exacto:

1. `ALTER TABLE "ai_providers" ADD COLUMN "recipe_model" TEXT, ADD COLUMN "catalog_model" TEXT`;
   `UPDATE` con los valores que sembró `20261013150000_ai_providers` (literales, por código);
   `SET NOT NULL` en las dos; `ADD CONSTRAINT "ai_providers_models_not_empty" CHECK (...)`.
2. `DROP CONSTRAINT "ai_provider_connections_model_fkey"`; `DROP COLUMN "unavailable_model"`, `DROP
   COLUMN "model_id"`.
3. `DROP TABLE "ai_models"`.

Se pierden las elecciones al bajar: es lo que revierte la subida.

### 2.3 RLS y guardias de esquema

- `ai_models`: RLS activada y forzada, sin policies (`docs/architecture.md > Acceso a datos y
  autorizacion`: Prisma es el dueño; la frontera es el caso de uso). Solo la leen los casos de uso
  de `integraciones` por el adaptador `catalog/`.
- `ai_models` **no** tiene `company_id`: entra en `EXENTAS` de
  `tests/guards/guard-empresa-en-esquema.test.ts` con motivo «catálogo de modelos de IA, compartido
  por todas las empresas», en el caso R7 de ese archivo (la lista exacta pasa a doce) y en el bullet
  de exentas de `docs/architecture.md > Dominio` n.º 1 (la guardia compara los dos).
- `tests/guards/guard-identificador-de-request.test.ts` gana la carpeta nueva en su lista, con su
  comentario «no toca el identificador», como `20261013150000_ai_providers`.
- `guard-rls-force` ve la tabla nueva por la migración.

---

## 3. Modelos del seed (aprobado en F1.4, E1 y E2)

Condición de cada fila (D3): aceptar **PDF** (fórmula, modo `pdf` de `MODE_BY_STRATEGY`) **e
imágenes** PNG (catálogo, modo `images`, también el recorte de `crop-catalog-images.ts`).

**Fuente:** `https://openrouter.ai/api/v1/models`, consultada el **2026-10-22**: los veinte tienen
`architecture.input_modalities` con `file` **e** `image`. Cinco por proveedor, los mejores en
calidad/precio; `sort_order` = orden por calidad (1 = el de más calidad). Fuera por precio:
`claude-fable-5.1`, `gpt-6-astra`.

**Ids nativos.** Para Claude, Gemini y OpenAI la fuente es el catálogo de OpenRouter; el id con que
los llama el SDK del proveedor se confirma en **T0** contra la API de cada uno (con key). Sin key,
quedan **pendientes** en `progress/impl_QT-291.md` (pregunta abierta 3 de `requirements.md`); si uno
no existe con ese nombre, se para y se pregunta. Los marcados † ya los confirmó el T0 de QC-275
(2026-10-13).

| Proveedor | `sort_order` | `model_id` | `is_default` (UI: «Recomendado») |
|---|---|---|---|
| `ANTHROPIC` | 1 | `claude-opus-5-5` | no |
| `ANTHROPIC` | 2 | `claude-sonnet-5-5` | no |
| `ANTHROPIC` | 3 | `claude-opus-5` | no |
| `ANTHROPIC` | 4 | `claude-sonnet-5` | no |
| `ANTHROPIC` | 5 | `claude-haiku-5-5` † | **sí** |
| `GOOGLE` | 1 | `gemini-4-argon` | no |
| `GOOGLE` | 2 | `gemini-3.8-flash` † | **sí** |
| `GOOGLE` | 3 | `gemini-3.7-flash` | no |
| `GOOGLE` | 4 | `gemini-3.5-flash-lite` † | no |
| `GOOGLE` | 5 | `gemini-3.1-flash-lite` | no |
| `OPENAI` | 1 | `gpt-6.1-sol` | no |
| `OPENAI` | 2 | `gpt-6-sol` | no |
| `OPENAI` | 3 | `gpt-6-luna-pro` | no |
| `OPENAI` | 4 | `gpt-6-luna` † | **sí** |
| `OPENAI` | 5 | `gpt-5.6-luna` | no |
| `OPENROUTER` | 1 | `anthropic/claude-sonnet-5.5` | no |
| `OPENROUTER` | 2 | `openai/gpt-6.1-sol` | no |
| `OPENROUTER` | 3 | `google/gemini-3.8-flash` | no |
| `OPENROUTER` | 4 | `anthropic/claude-haiku-5.5` † | **sí** |
| `OPENROUTER` | 5 | `openai/gpt-6-luna` | no |

**Recomendado** (E2): el mejor calidad/precio, que es el de hoy, para no cambiar el costo de nadie.
En Gemini, las empresas pasan a leer catálogos con `gemini-3.8-flash` en vez de
`gemini-3.5-flash-lite` (D4: un solo modelo); el lite queda como opción. El recomendado no es el
primero de la lista: la lista va por calidad y la insignia lo señala.

**Qué pasa con `recipe_model`/`catalog_model`.** Se **borran** (paso 6 de §2.2, E3); `down.sql` los
restaura con los valores de QC-275.

---

## 4. Dominio de `integraciones`

### 4.1 Tipos (`domain/ai-provider.ts`)

```ts
export type AiModelOption = {
  readonly modelId: string;
  readonly isDefault: boolean;
};

export type AiProviderEntry = {              // fila del catálogo de proveedores, con sus modelos
  readonly code: AiProviderCode;
  readonly name: string;
  readonly models: readonly AiModelOption[]; // por sort_order
  readonly defaultModel: string;             // el modelId del predeterminado
};

export type AiProviderConnectionRecord = {   // + dos campos
  /* … QC-275 … */
  readonly model: string | null;
  readonly unavailableModel: string | null;
};

export type AiProviderConnectionView = {
  readonly provider: AiProviderCode;
  readonly providerName: string;
  readonly modelInUse: string;
  readonly modelIsDefault: boolean;          // elección vacía
  readonly modelUnavailable: boolean;        // unavailableModel === modelInUse
  readonly modelOptions: readonly AiModelOption[]; // sin el marcado (R28)
  readonly status: AiProviderConnectionStatus;
  readonly lastError: string | null;
  readonly lastErrorAt: string | null;
  readonly lastCheckedAt: string | null;
  readonly keyUpdatedAt: string;
};

export function modelInUse(record: Pick<AiProviderConnectionRecord, 'model'>, entry: AiProviderEntry): string;
```

- `recipeModel`/`catalogModel` desaparecen de la entrada, de la vista y de `AiReadUse` (se borra).
- `toAiProviderConnectionView` sigue campo a campo y sin spread.
- `modelInUse` = `record.model ?? entry.defaultModel`. Si la elección no está entre `entry.models`
  (no puede pasar con la FK), lanza error de dato imposible, como el «el catálogo no trae el
  proveedor» de hoy.

### 4.2 Errores

Sin clases nuevas. Elegir un modelo fuera del catálogo del proveedor conectado = `ValidationError`
(`invalid_input`, R10). Sin conexión = resultado `{ status: 'not_connected' }`, como
`testSavedAiProvider` (R11): es una carrera con «Desconectar», no un error. Consulta fallida al
elegir = resultado `{ status: 'rejected', message }` (R33), como la prueba fallida de
`saveAiProviderConnection` en QC-275: es un fallo esperado del proveedor, no del sistema. Key
ilegible = `SecretUnreadableError` de QC-275 (R34).

**Qué hace cada tipo de fallo al elegir** (tipos de `specs/QC-275-proveedor-ia-propio/design.md >
7.3`):

| Fallo de la consulta (R32) | Se guarda | Conexión | Mensaje |
|---|---|---|---|
| `rejected_key` (401, 403, 400 de key de Gemini) | no | sin cambios | el de QC-275 para key rechazada |
| `quota` (402, 429) | no | sin cambios | el de QC-275 para cuota |
| `model_unavailable` (404, o id ausente del listado de OpenRouter) | no | sin cambios (el modelo marcado es el **en uso**; el que se intentó elegir no lo es) | R20 |
| `unreachable` (red, plazo de 10 s) | no | sin cambios | el de QC-275 para sin respuesta |
| `unexpected` | no | sin cambios | el de QC-275 para error inesperado |
| Key ilegible | no, y no llama | sin cambios | `integration_secret_unreadable` |

«Sin cambios» en key rechazada, cuota y key ilegible lo decidió el humano (fila «(F1.4) Al elegir,
si la prueba falla…»): se avisa bajo el selector y no se escribe nada.

**Qué hace una consulta buena al elegir con la conexión en `ERROR`** (R12; fila «(F1.4) Conexión en
Error por key o cuota»):

| `lastError` de la conexión | Al guardar la elección |
|---|---|
| Aviso de modelo no disponible (`isModelUnavailableNotice`) | `ACTIVE`, `lastError`/`lastErrorAt` vacíos, modelo marcado vacío |
| Key rechazada o sin cuota, de «Probar conexión» o de una lectura (`isAccountFailureNotice`) | `ACTIVE`, `lastError`/`lastErrorAt` vacíos: la consulta acaba de pasar con esa key |
| Otro (sin respuesta, inesperado, «No se pudo leer la key guardada…») | estado y error sin cambios |

Una key ilegible nunca llega aquí: R34 corta antes de la consulta.

### 4.3 Casos de uso

| Caso de uso | Cambio |
|---|---|
| `selectAiModel` (nuevo, `domain/select-ai-model.ts`) | `(input{modelId}, actor) => { status:'saved'; connection: View } \| { status:'not_connected' } \| { status:'rejected'; message }`. Deps: `connections`, `catalog`, `cipher`, `probe` (sin reloj: no escribe fechas). (1) `requirePermission` (R8) → (2) zod `aiModelInputSchema` (`modelId` string recortada, 1–200) → (3) `find(scope)`; `null` ⇒ `not_connected` (R11) → (4) `catalog.get(provider)`; `modelId` ∉ `entry.models` o `=== record.unavailableModel` ⇒ `ValidationError` (R10) → (5) `cipher.decrypt(apiKeyEnc, ctx)`; si lanza `SecretUnreadableError`, **relanza sin escribir** (R34; la acción ya lo traduce a `integration_secret_unreadable`) → (6) `probe.probe({ provider, apiKey, models: [modelId] })`, también si es el predeterminado (R32); fallida ⇒ `{ status:'rejected', message: probeFailureMessage(failure, entry.name) }` **sin escribir** (R33) → (7) patch `{ model: modelId === entry.defaultModel ? null : modelId, updatedById }` (R9); si `record.unavailableModel !== null`: `unavailableModel: null`; si `status === 'ERROR'` y `lastError` es el aviso de modelo (`isModelUnavailableNotice`) **o** el de key rechazada o sin cuota (`isAccountFailureNotice`, §4.4), `status:'ACTIVE', lastError:null, lastErrorAt:null` (R12, tabla de §4.2); con otro error, estado y error sin tocar → (8) `update` → vista. La prueba buena **no** escribe `lastCheckedAt` (no es «Probar conexión») |
| `getAiProviderConnection` | La vista lleva el modelo (§4.1). `providers` lleva `models` y `defaultModel` en el dominio (los usa R19), pero la pantalla del formulario ya no los pinta (R30) |
| `testAiProviderKey` / `runProbe` | `models: [m]` con un solo modelo (R19): `m = (data.provider === existing?.provider && existing.model !== null) ? existing.model : entry.defaultModel`. Para conocer `existing`, `TestAiProviderKeyDeps` gana `connections` (solo `find`) |
| `testSavedAiProvider` | prueba `[modelInUse(record, entry)]` (R18). Buena: además vacía `unavailableModel` (R22). Fallida con `model_unavailable` del modelo en uso: `ERROR`, `unavailableModel = failure.model`, `lastError = modelUnavailableNotice(...)` (R21). Otra fallida: como hoy |
| `saveAiProviderConnection` | prueba el modelo de R19 antes de guardar. Al guardar: si `existing?.provider !== data.provider` ⇒ `model: null, unavailableModel: null` (R14); mismo proveedor ⇒ no toca `model`; `unavailableModel: null` porque la prueba con ese modelo acaba de salir bien. Crear: `model: null` |
| `resolveAiProviderForReading` | firma `(companyId) => …` (sin `use`); `model = modelInUse(record, entry)` leído **en cada llamada** (R16, R17) |
| `reportAiProviderOutcome` | `account_failure` pasa a `connection_failure` con `failure` de `marksConnection` (§4.4). `model_unavailable` ⇒ `ERROR`, `unavailableModel = failure.model`, `lastError = READING_FAILURE_PREFIX + modelUnavailableNotice(...)`, `lastErrorAt = now` (R23). `recovered` ⇒ además `unavailableModel: null` (R24) |

### 4.4 Fallo y textos (`domain/ai-provider-failure.ts`)

```ts
export function marksConnection(f: AiProviderFailure): boolean; // rejected_key | quota | model_unavailable
export function modelUnavailableNotice(model: string, providerName: string, chosen: boolean): string;
export function isModelUnavailableNotice(lastError: string | null): boolean;
export function isAccountFailureNotice(lastError: string | null, providerName: string): boolean;
```

`isAccountFailureNotice` reconoce los textos de `rejected_key` y `quota` con ese proveedor tal como
los escriben en `lastError` «Probar conexión» (`probeFailureMessage`) y la lectura
(`readingFailureMessage`, con su prefijo): comparación exacta contra esos textos, no por subcadena. Mismo motivo que
`isModelUnavailableNotice` para no añadir `last_error_kind` (§16, alternativa 5).

`isAccountFailure` se conserva (decide el texto de `readingFailureMessage`); `marksConnection` lo
amplía con `model_unavailable` y sustituye a `isAccountFailure` en los lectores y en
`run-document-job.ts`. Textos (del tablero `ProveedorIAModelos.dc.html`, aprobados con él):

| Dónde | Texto |
|---|---|
| Prueba con `model_unavailable`: «Probar conexión», key escrita y consulta al elegir (R20, R33; sustituye «tu cuenta no tiene acceso al modelo …») | «Error con tu proveedor: el modelo {model} ya no está disponible.» |
| Prueba buena en «Probar conexión», guardada o con key escrita (R20, E5; sustituye «Conexión correcta · respondió en X s») | «Conexión correcta · el modelo en uso responde». Lo pinta la pantalla (`ai-provider-form.tsx`, hoy `okMessage(elapsedMs)`); `elapsedMs` sigue en el resultado del caso de uso, pero ya no se muestra |
| `lastError` por prueba de la guardada (R21) | «El modelo {model} que elegiste ya no está disponible en {Proveedor}. Elige otro modelo para volver a leer fórmulas y catálogos en PDF.»; con el predeterminado, sin «que elegiste» |
| `lastError` por lectura (R23) | «La última lectura falló: » + el mismo aviso |

`isModelUnavailableNotice` reconoce el aviso por su cola fija («Elige otro modelo para volver a leer
fórmulas y catálogos en PDF.»), con o sin el prefijo de lectura. Alternativa descartada: una columna
`last_error_kind` (§16).

---

## 5. Puertos y adaptadores de `integraciones`

### 5.1 `ports/ai-provider-connection-repository.ts`

`NewAiProviderConnectionRow` y `AiProviderConnectionPatch` ganan `model?: string | null` y
`unavailableModel?: string | null`. El adaptador `persistence/ai-provider-connection-prisma.ts` los
añade a su `select` explícito y a `data`. Si la FK compuesta rechaza (P2003 sobre
`ai_provider_connections_model_fkey`), lanza `Error` de dato imposible: el caso de uso ya validó
contra el catálogo y la carrera posible (QT-292 borrando el modelo) la para el `RESTRICT`.

### 5.2 `ports/ai-provider-catalog.ts` y `adapters/driven/catalog/ai-provider-catalog-prisma.ts`

La interfaz **no cambia** (`list()`, `get(code)`); cambia `AiProviderEntry`. El adaptador lee
`ai_providers` con `include`-equivalente por consulta aparte de `ai_models` (sin `@relation`):
`findMany` de proveedores + `findMany` de modelos `orderBy [{provider}, {sortOrder}, {modelId}]`, y
agrupa. Un proveedor sin predeterminado (dato imposible, R3) se **descarta** de `list()` y `get()`
devuelve `null`, igual que hoy un código fuera de `AI_PROVIDER_CODES`; `resolveAiProviderForReading`
ya lanza ante `null`.

### 5.3 `ports/ai-provider-probe.ts`

Sin cambios: `models: readonly string[]` admite uno. El doble `ai-provider-probe-canned.ts` no cambia
(R40 de QC-275).

---

## 6. `documentos`

### 6.1 Sin uso por estrategia

`ai-read-use.ts` y `AiReadUse` se **borran**: con un solo modelo (D4) el uso no decide nada, y
dejarlo sería un parámetro que se ignora. `AiProviderGateway.readerFor(companyId)` pierde `use`;
`run-document-job.ts` deja de importar `USE_BY_STRATEGY`. `module-shape.test.ts` de `integraciones`
deja de esperar `AiReadUse` en el contrato.

### 6.2 Marcar el modelo no disponible

- `observeAccountFailures` pasa a guardar cualquier `AiProviderError` (ya lo hace) y `informarFallo`
  filtra con `marksConnection` en vez de `isAccountFailure`.
- `AiProviderGateway.reportAccountFailure` se renombra `reportConnectionFailure` (mismo cuerpo en la
  composición).
- `failure-kind.ts` **no cambia**: el archivo termina con `ai_provider_error`, que ya es definitivo
  (R23, sin reintento).

---

## 7. Adaptadores de IA

En los tres `ai-reader-*.ts`, la lectura llama hoy a `classifyXError(error, null)`: un 404 sale como
`unexpected` y termina en `ai_unavailable`. Cambia a `classifyXError(error, config.model)` y la
condición de lanzar `AiProviderError` pasa de `isAccountFailure` a `marksConnection`. El
`diagnostic` sigue siendo `"<proveedor> <operación> respondió <status>"`.

| Fallo al leer | Antes (QC-275 §7.4) | Ahora |
|---|---|---|
| 404 del modelo | `ai_unavailable`, reintentable, conexión sin cambios | `ai_provider_error`, definitivo, conexión `ERROR` + modelo marcado (R23) |
| Resto | igual | igual |

Aplica también si el modelo en uso es el predeterminado: el aviso dice lo mismo sin «que elegiste».
`[POR VERIFICAR en T6]`: que OpenRouter responda 404 (o qué código) cuando un id no existe al
generar; si responde otro, se ajusta `classifyOpenAiError` con test.

---

## 8. Composición (`lib/composition/index.ts`)

- `aiProviderGateway.readerFor(companyId)` llama a `integraciones.resolveAiProviderForReading(companyId)`.
  El doble de lectura (`DOCUMENTS_E2E_DOUBLES`) no cambia.
- `reportConnectionFailure` → `integraciones.reportAiProviderOutcome(companyId, { kind:
  'connection_failure', failure })`.
- `integraciones` gana `selectAiModel`, construido con `connections`, `catalog`, `cipher` y
  el mismo `aiProviderProbe` de «Probar conexión» (con el doble `ai-provider-probe-canned` cuando
  están activos los dobles de E2E).
- `testAiProviderKey` recibe `connections`.
- Importar la composición sigue sin leer variables ni tocar la base (QC-275 R42).

---

## 9. Server Action (`adapters/driving/ai-provider-actions.ts`)

```ts
export type SelectAiModelFormState =
  | { status: 'idle' } | { status: 'saved' } | { status: 'not_connected' } | ErrorState;

export async function selectAiModelAction(prev: SelectAiModelFormState, formData: FormData): Promise<SelectAiModelFormState>;
```

`modelId` de `formData`; `currentActor()`; `integraciones.selectAiModel`; `saved` ⇒
`revalidatePath(AI_PROVIDER_INTEGRATION_ROUTE)`; `rejected` ⇒ `ErrorState` con el `message` de la
consulta (R33), **sin** `revalidatePath` (no cambió nada); `SecretUnreadableError` ⇒ `ErrorState`
`integration_secret_unreadable` con su texto del catálogo de errores (R34). No devuelve la vista
(R13: la pantalla se repinta con el servidor). `toProviderState` y `toConnectionState` se rehacen campo a campo con los campos de
§4.1.

---

## 10. Rutas

Ninguna nueva. Permiso, menú y 404 sin `integraciones.modificar`: sin cambios (QC-275 R3).

---

## 11. Textos nuevos

Del tablero aprobado, con las enmiendas de F1.4: el predeterminado se rotula **«Recomendado»** en
toda la pantalla (E2), y los textos de la prueba y de la ayuda del formulario son los de E5 y E6.

| Clave | Texto |
|---|---|
| Título de sección | «Modelo» |
| Subtítulo | «Se usa para leer fórmulas y catálogos en PDF. Solo aparecen modelos de {Proveedor} que leen PDF e imágenes.» |
| Etiqueta | «Modelo de {Proveedor}» |
| Insignias | «Recomendado», «No disponible» |
| Marca en la opción | «recomendado» |
| Ayudas | «Se usa el modelo recomendado de {Proveedor}.» · «Elegido por tu empresa.» · «Este modelo ya no está disponible. Elige otro para volver a leer PDF.» |
| Toast | «Modelo guardado» |
| Error al elegir | el mensaje de la consulta (§4.2, tabla de fallos) o el del catálogo de errores, bajo el selector |
| Confirmación | título «¿Cambiar de proveedor?»; texto «El modelo que elegiste es de {Proveedor}. Si conectas otro proveedor, se usa el modelo recomendado del nuevo proveedor. Si solo cambias la key de {Proveedor}, se conserva.»; «Cancelar» / «Continuar» |
| Prueba buena (E5) | «Conexión correcta · el modelo en uso responde» (sustituye «Conexión correcta · respondió en X s») |
| Prueba con modelo no disponible (E5) | «Error con tu proveedor: el modelo {modelo} ya no está disponible.» |
| Ayuda del formulario sin conexión (E6) | «Después de conectar podrás elegir el modelo.» (sustituye «Se usa con los modelos X y Y.») |

Sin cambios: la línea «Última prueba» y el resto de mensajes de error de la prueba (QC-275 R11).
Mientras se consulta el modelo al elegir, el selector se muestra ocupado (`Spinner` en el
disparador, `aria-busy`), sin texto nuevo.

---

## 12. Pantalla

### 12.1 `AiModelSelect` (nuevo, paso 3)

Props: `providerName`, `options: AiModelOption[]`, `value: string` (modelo en uso), `isDefault`,
`unavailable`, `pending`, `onChange(modelId)`.

- **> 640 px**: `SharedSelectControl` controlado (`value`, `onValueChange`), `children` = id en mono
  (tachado si `unavailable`) + `StatusBadge` («Recomendado» `neutral` o «No disponible» `danger`),
  `invalid={unavailable}`, `labelledBy`/`describedBy` a la etiqueta y la ayuda. Flecha que gira 180°
  y entrada `.pop` del tablero: las del control si ya las trae; si no, clases del tablero en el
  disparador `[POR VERIFICAR en T9]`.
- **≤ 640 px**: disparador a todo el ancho de 48 px y lista en `Sheet` inferior con título, como
  `CountrySelect` (R31). Sin buscador (pocas opciones).
- Opciones = `options` (ya sin el marcado, R28) en `sort_order` (por calidad), id en mono,
  «recomendado» junto al predeterminado, check en el valor. Con cinco opciones, sin buscador.
- Con `pending` (consulta de R32 en curso): disparador deshabilitado, `aria-busy="true"` y `Spinner`
  en el disparador; no abre la lista ni la hoja (R29). Que `SharedSelectControl` admita deshabilitar
  el disparador `[POR VERIFICAR en T9]`; si no, se pide en su fila del catálogo, no se reimplementa.
- Con `unavailable`, el valor mostrado no está entre las opciones: el disparador pinta `children` con
  el id tachado; `SharedSelectControl` admite contenido propio del disparador (su fila).

### 12.2 `AiProviderCard`

- Quita las filas «Receta (fórmula desde PDF)» y «Catálogo desde PDF» y sus testids
  (`AI_PROVIDER_CARD_RECIPE_MODEL_TESTID`, `…CATALOG_MODEL_TESTID`) (R26).
- Añade la sección «Modelo» (§11) entre el aviso de error y «Última prueba», en el orden del tablero.
- Elegir: `useActionState` con `selectAiModelAction`; valor optimista con `useOptimistic` mientras
  dura la consulta (el selector ocupado, `pending` del `useActionState`); `saved` ⇒
  `toast.success('Modelo guardado')`; `error` (consulta fallida R33, key ilegible R34 o error del
  catálogo) ⇒ texto bajo el selector y vuelve al valor del servidor; `not_connected` ⇒
  `router.refresh()` (R29, R11). Un fallo de la consulta no cambia el aviso de error de la tarjeta:
  la conexión no se tocó (R33).
- «Cambiar key o proveedor»: si `!connection.modelIsDefault`, abre `ConfirmDialog` (§11) y
  «Continuar» hace `setEditing(true)`; si no, como hoy (R15).

### 12.3 `AiProviderForm`

- Sin conexión, la ayuda pasa a «Después de conectar podrás elegir el modelo.» (R30, E6), sin nombrar
  modelos: el formulario deja de leer `recipeModel`/`catalogModel` y no necesita `defaultModel`.
- La prueba buena pasa a «Conexión correcta · el modelo en uso responde» (R20, E5): `okMessage`
  deja de formatear `elapsedMs`. Aplica a la prueba de la key escrita y a la de la conexión guardada.

---

## 13. E2E (decidido en F1.4, E7: sí, mínimo)

No es flujo crítico (`docs/checkpoints-proyecto.md > Flujos criticos`), pero
`e2e/integraciones-proveedor-ia.spec.ts` **ya** lee `recipeModel`/`catalogModel` de la base y los
testids de las dos filas que desaparecen (l. 283-296): sin tocarlo, el E2E de PR a producción se
pone rojo. Se ajusta ese caso (y el texto `testOk` a «Conexión correcta · el modelo en uso
responde», R20; la ayuda sin conexión, R30) y se añade **uno**:

- Con Gemini y la conexión creada por el doble: el selector muestra `gemini-3.8-flash` con
  «Recomendado»; elegir otra opción (la consulta la responde bien el doble
  `ai-provider-probe-canned`, cuya key no empieza por `E2E_INVALID`) muestra «Modelo guardado» y,
  tras recargar, «Elegido por tu empresa.».

El fallo de la consulta al elegir (R33) se cubre en unit: el doble canned solo falla por la key, y
la key guardada del E2E es válida.

El estado «No disponible» se cubre en unit (`ai-provider-card.test.tsx`) con la vista, no en E2E:
fabricarlo exige escribir la fila a mano y no añade nada que el unit no vea.

---

## 14. Tests

| Archivo | Cubre |
|---|---|
| `tests/integration/integraciones/ai-models-migration.int.test.ts` (creado en T1; R2/R3 se rehacen) | R1–R4, R7: tabla, PK, CHECK, FK, índice parcial (un segundo predeterminado da `23505`), siembra exacta de §3 (veinte filas: proveedor, `model_id`, `sort_order` 1–5 por proveedor), el predeterminado de cada proveedor es el de §3, FK compuesta rechaza modelo de otro proveedor (`23503`), columnas borradas, `down.sql` deja el esquema y los valores de QC-275 |
| `tests/integration/integraciones/ai-provider-migration.int.test.ts` | Se ajusta: aplica su migración y la nueva en orden, o deja de mirar las columnas que borra la nueva |
| `tests/integration/integraciones/ai-provider-connection-prisma.int.test.ts` | `model`/`unavailableModel` en create/update/find; P2003 |
| `tests/unit/integraciones/ai-provider/select-ai-model.test.ts` (nuevo) | R8–R12, R32 (la sonda recibe solo el modelo elegido, también el predeterminado, y nada se escribe antes), R33 (un caso por tipo de fallo: sin escrituras y el mensaje), R34 (key ilegible: sin sonda ni escritura); R12 con un caso por fila de la tabla de §4.2 (modelo no disponible, key rechazada y cuota ⇒ `ACTIVE` y error vacío; sin respuesta ⇒ sin cambios) |
| `…/ai-provider-failure.test.ts` (además) | `isAccountFailureNotice`: reconoce los textos de key rechazada y cuota de la prueba y de la lectura; no reconoce sin respuesta, inesperado ni key ilegible |
| `…/save-ai-provider-connection.test.ts` | R14, R19 |
| `…/test-ai-provider-key.test.ts`, `…/test-saved-ai-provider.test.ts` | R18–R22 |
| `…/resolve-and-report.test.ts` | R16, R17, R23, R24 |
| `…/ai-provider-failure.test.ts` | R20, textos de §4.4 |
| `…/connection-view.test.ts` | vista: modelo en uso, marcado, opciones sin el marcado (R28) |
| `…/ai-provider-actions.test.ts` | `selectAiModelAction`, R13; `rejected` y key ilegible ⇒ `ErrorState` sin `revalidatePath` (R33, R34) |
| `tests/unit/documentos/run-document-job-ai-provider.test.ts` | R23 (archivo `ai_provider_error`, informe), R25 |
| `tests/unit/documentos/ai-reader-*.test.ts` (los de hoy) | 404 al leer ⇒ `AiProviderError` con `model_unavailable` (R23) |
| `tests/unit/composition/ai-provider-wiring.test.ts` | gateway sin uso; `selectAiModel` cableado |
| `tests/unit/documentos/ai-model-literals.test.ts` | R6, sin cambios (sigue barriendo `lib/`) |
| `tests/unit/integraciones-ui/ai-model-select.test.tsx` (nuevo) | R26–R28, R31 (opciones en orden, «Recomendado»/«recomendado», ninguna «predeterminado», tachado, `invalid`, ocupado con `pending`, hoja a ≤ 640 px, alturas) |
| `tests/unit/integraciones-ui/ai-provider-card.test.tsx` | R15 (texto con «recomendado»), R20 (prueba buena), R26, R29 (ocupado, toast, error y vuelta al valor anterior) |
| `tests/unit/integraciones-ui/ai-provider-form.test.tsx`, `ai-provider-page.test.tsx` | R20 (prueba buena con key escrita), R30; datos de prueba sin `recipeModel` |
| `tests/unit/integraciones/module-shape.test.ts` | contrato sin `AiReadUse`, con `selectAiModel` |
| `e2e/integraciones-proveedor-ia.spec.ts` | §13 (R26, R27, R29) |
| R5 | Sin test de red: `ai-provider-catalog-prisma` es la única fuente de opciones y ningún adaptador de SDK expone un «listar modelos» que la composición cablee; lo afirma `ai-provider-wiring.test.ts` (el catálogo de la vista viene del puerto `AiProviderCatalog`) |

---

## 15. Frontera con QT-292

QT-292 pondrá la pantalla para añadir y quitar modelos. Esta ficha le deja: la tabla, el índice de un
predeterminado y la FK `RESTRICT` (no se puede quitar un modelo elegido sin decidir qué hacer con esas
empresas: decisión de QT-292). La regla «solo modelos que leen PDF e imágenes» (D3) hoy la garantiza
la revisión del seed; QT-292 deberá pedirla al dar de alta.

---

## 16. Alternativas descartadas

1. **Conservar `recipe_model`/`catalog_model` en `ai_providers` como predeterminado.** Ahorra la
   tabla de modelos y una migración menos agresiva, pero son dos modelos para una decisión de uno
   (D4) y no hay sitio para la lista de opciones. Descartada.
2. **Columna `default_model` en `ai_providers` con FK a `ai_models`** en vez de `is_default`. Da
   «exactamente uno» por construcción, pero crea una FK circular entre las dos tablas (sembrar exige
   `DEFERRABLE` o dos pasos) y complica a QT-292. Se prefiere `is_default` + índice parcial + test.
3. **`ai_models` con id UUID y FK simple desde la conexión.** La FK simple no garantiza que el modelo
   sea del proveedor conectado (D1); habría que validarlo solo en el dominio. La compuesta lo hace la
   base.
4. **Guardar el modelo elegido aunque sea el predeterminado.** El tablero vuelve a «sin elección» al
   elegir el predeterminado (`pick: m === DEF ? null : m`), y así un cambio de predeterminado en el
   catálogo llega a quien no eligió nada (R17). Descartada.
5. **Columna `last_error_kind` para reconocer el error de modelo.** Más robusta que comparar el texto,
   pero añade un enum para un solo caso; `unavailable_model` ya dice qué modelo y el texto lo compone
   el propio módulo. Si aparece un segundo caso, se revisa.
6. **Guardar al elegir sin probar** (lo que dibuja el tablero y proponía la primera versión de este
   spec). Más rápido, pero un modelo que la cuenta no tiene quedaría guardado y la siguiente lectura
   fallaría y marcaría la conexión (R23). Descartada en F1.4 (E8): se consulta antes de guardar (R32).
6b. **Consultar al elegir con una generación real** (un prompt corto) en vez de la consulta sin
   texto de QC-275 R10. Probaría también el permiso de generar, pero cuesta tokens en cada cambio y
   duplica la prueba con otra semántica. Descartada: se reutiliza la sonda de «Probar conexión».
6c. **Al fallar la consulta, guardar igual y marcar la conexión en `ERROR`.** Deja rastro en la
   tarjeta, pero contradice E8 («no se guarda y se avisa») y deja a la empresa con un modelo que no
   responde. Descartada.
7. **Conservar `AiReadUse` por si vuelve un modelo por tarea.** Sería un parámetro ignorado; «un modelo
   distinto por tarea» está en «Lo que NO entra». Descartada.
