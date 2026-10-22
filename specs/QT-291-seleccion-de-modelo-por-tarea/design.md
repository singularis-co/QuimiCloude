# QT-291 — seleccion-de-modelo-por-tarea · design.md

> Zona: `fullstack` · Complejidad: `high` · depends_on: QC-275 (hecha) · Rama:
> `feature/QT-291-seleccion-de-modelo-por-tarea`
>
> El **qué** está en `requirements.md` (R1–R31; decisiones D1–D11 por el orden de su tabla). Aquí va
> el **cómo**. Pese al nombre de la ficha, el alcance cerrado es **un solo modelo** para fórmula y
> catálogo (D4), solo del proveedor conectado (D1).
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
| `StatusBadge` | «Predeterminado» (`neutral`), «No disponible» (`danger`); «Error» de la tarjeta ya existe | 1, reutiliza |
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
  domain/ai-provider-failure.ts                         ← + marksConnection, texto de modelo no disponible
  domain/ai-model-input.ts                              ← nuevo: zod de la elección
  domain/select-ai-model.ts                             ← nuevo
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

## 3. Modelos del seed (pregunta abierta 1) — PROPUESTA para F1.4

Condición de cada fila (D3): aceptar **PDF** (fórmula, modo `pdf` de `MODE_BY_STRATEGY`) **e
imágenes** PNG (catálogo, modo `images`, también el recorte de `crop-catalog-images.ts`).

**Este agente no tiene acceso a la red**: no puede consultar la documentación de los proveedores ni
`openrouter.ai/api/v1/models`. Por eso solo propone ids **ya confirmados** con fuente y fecha: los
del T0 de QC-275 (`specs/QC-275-proveedor-ia-propio/design.md > 3`, confirmados el 2026-10-13 contra
la documentación oficial de cada proveedor, y la entrada `file` + `image` comprobada en
`architecture.input_modalities` del catálogo de OpenRouter). No se inventa ningún id.

| Proveedor | `model_id` | Predeterminado | `sort_order` | Fuente y fecha |
|---|---|---|---|---|
| `ANTHROPIC` | `claude-haiku-5-5` | sí | 1 | docs.anthropic.com «Models overview», T0 QC-275, 2026-10-13 |
| `GOOGLE` | `gemini-3.8-flash` | **sí** | 1 | ai.google.dev/gemini-api/docs/models, T0 QC-275, 2026-10-13 |
| `GOOGLE` | `gemini-3.5-flash-lite` | no | 2 | ídem |
| `OPENAI` | `gpt-6-luna` | sí | 1 | platform.openai.com/docs/models, T0 QC-275, 2026-10-13 |
| `OPENROUTER` | `anthropic/claude-haiku-5.5` | sí | 1 | openrouter.ai/api/v1/models (`input_modalities`), 2026-10-13 |

**Predeterminado de Gemini.** Hoy lee fórmulas con `gemini-3.8-flash` y catálogos con
`gemini-3.5-flash-lite`. Se propone `gemini-3.8-flash`: es el que QC-275 eligió para la lectura de
PDF nativo (fórmula) y también recibe imágenes, así que las dos tareas siguen funcionando con él.
**Efecto visible:** las empresas con Gemini pasan a leer catálogos con `gemini-3.8-flash` (más caro
que el lite) hasta que elijan el lite. La alternativa es el lite como predeterminado: más barato,
pero cambia el modelo de las fórmulas. Lo decide el humano.

**Qué pasa con `recipe_model`/`catalog_model`.** Se **borran** (paso 6 de §2.2): con un solo modelo
por empresa, conservarlas dejaría dos fuentes del «modelo de un proveedor» que pueden discrepar
(alternativa descartada en §16).

**Lista corta.** Con esta propuesta, Claude, OpenAI y OpenRouter tienen **una sola opción**: el
selector funciona, pero no da a elegir hasta que QT-292 (o una migración) añada modelos. Si el humano
quiere más modelos desde el primer día, da los ids en F1.4 y **T0 los confirma** contra la
documentación de cada proveedor (PDF e imágenes, con fecha), como en QC-275; si alguno no existe con
ese nombre o no lee las dos cosas, se para y se pregunta.

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
`testSavedAiProvider` (R11): es una carrera con «Desconectar», no un error.

### 4.3 Casos de uso

| Caso de uso | Cambio |
|---|---|
| `selectAiModel` (nuevo, `domain/select-ai-model.ts`) | `(input{modelId}, actor) => { status:'saved'; connection: View } \| { status:'not_connected' }`. (1) `requirePermission` (R8) → (2) zod `aiModelInputSchema` (`modelId` string recortada, 1–200) → (3) `find(scope)`; `null` ⇒ `not_connected` (R11) → (4) `catalog.get(provider)`; `modelId` ∉ `entry.models` o `=== record.unavailableModel` ⇒ `ValidationError` (R10) → (5) patch `{ model: modelId === entry.defaultModel ? null : modelId, updatedById }` (R9); si `record.unavailableModel !== null`: `unavailableModel: null` y, si `status === 'ERROR'` y `lastError` es el aviso de modelo (§4.4, comparado por `isModelUnavailableNotice`), `status:'ACTIVE', lastError:null, lastErrorAt:null` (R12) → (6) `update` → vista. **Sin prueba** (R9) |
| `getAiProviderConnection` | `providers` lleva `models` y `defaultModel` (la pantalla los pinta en el formulario, R30); la vista lleva el modelo (§4.1) |
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
```

`isAccountFailure` se conserva (decide el texto de `readingFailureMessage`); `marksConnection` lo
amplía con `model_unavailable` y sustituye a `isAccountFailure` en los lectores y en
`run-document-job.ts`. Textos (del tablero `ProveedorIAModelos.dc.html`, aprobados con él):

| Dónde | Texto |
|---|---|
| Prueba con `model_unavailable` (R20; sustituye «tu cuenta no tiene acceso al modelo …») | «Error con tu proveedor: el modelo {model} ya no está disponible.» |
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
- `integraciones` gana `selectAiModel`, construido con `connections` y `catalog`.
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
`revalidatePath(AI_PROVIDER_INTEGRATION_ROUTE)`. No devuelve la vista (R13: la pantalla se repinta
con el servidor). `toProviderState` y `toConnectionState` se rehacen campo a campo con los campos de
§4.1.

---

## 10. Rutas

Ninguna nueva. Permiso, menú y 404 sin `integraciones.modificar`: sin cambios (QC-275 R3).

---

## 11. Textos nuevos

Todos del tablero aprobado salvo el marcado *propuesto*.

| Clave | Texto |
|---|---|
| Título de sección | «Modelo» |
| Subtítulo | «Se usa para leer fórmulas y catálogos en PDF. Solo aparecen modelos de {Proveedor} que leen PDF e imágenes.» |
| Etiqueta | «Modelo de {Proveedor}» |
| Insignias | «Predeterminado», «No disponible» |
| Marca en la opción | «predeterminado» |
| Ayudas | «Se usa el modelo predeterminado de {Proveedor}.» · «Elegido por tu empresa.» · «Este modelo ya no está disponible. Elige otro para volver a leer PDF.» |
| Toast | «Modelo guardado» |
| Confirmación | título «¿Cambiar de proveedor?»; texto «El modelo que elegiste es de {Proveedor}. Si conectas otro proveedor, se usa el modelo predeterminado del nuevo proveedor. Si solo cambias la key de {Proveedor}, se conserva.»; «Cancelar» / «Continuar» |
| Ayuda del formulario (*propuesto*) | «Se usa con el modelo {modelo}.» (sustituye «Se usa con los modelos X y Y.») |

Sin cambios (ficha del tablero: «sin cambios en cabecera, aviso de error, prueba y acciones»): «Conexión
correcta · respondió en X s» y la línea «Última prueba». El tablero muestra variantes de los dos; se
pregunta en F1.4.

---

## 12. Pantalla

### 12.1 `AiModelSelect` (nuevo, paso 3)

Props: `providerName`, `options: AiModelOption[]`, `value: string` (modelo en uso), `isDefault`,
`unavailable`, `pending`, `onChange(modelId)`.

- **> 640 px**: `SharedSelectControl` controlado (`value`, `onValueChange`), `children` = id en mono
  (tachado si `unavailable`) + `StatusBadge` («Predeterminado» `neutral` o «No disponible» `danger`),
  `invalid={unavailable}`, `labelledBy`/`describedBy` a la etiqueta y la ayuda. Flecha que gira 180°
  y entrada `.pop` del tablero: las del control si ya las trae; si no, clases del tablero en el
  disparador `[POR VERIFICAR en T9]`.
- **≤ 640 px**: disparador a todo el ancho de 48 px y lista en `Sheet` inferior con título, como
  `CountrySelect` (R31). Sin buscador (pocas opciones).
- Opciones = `options` (ya sin el marcado, R28), id en mono, «predeterminado» junto al predeterminado,
  check en el valor.
- Con `unavailable`, el valor mostrado no está entre las opciones: el disparador pinta `children` con
  el id tachado; `SharedSelectControl` admite contenido propio del disparador (su fila).

### 12.2 `AiProviderCard`

- Quita las filas «Receta (fórmula desde PDF)» y «Catálogo desde PDF» y sus testids
  (`AI_PROVIDER_CARD_RECIPE_MODEL_TESTID`, `…CATALOG_MODEL_TESTID`) (R26).
- Añade la sección «Modelo» (§11) entre el aviso de error y «Última prueba», en el orden del tablero.
- Elegir: `useActionState` con `selectAiModelAction`; valor optimista con `useOptimistic`; `saved` ⇒
  `toast.success('Modelo guardado')`; `error` ⇒ texto bajo el selector y vuelve al valor del
  servidor; `not_connected` ⇒ `router.refresh()` (R29, R11).
- «Cambiar key o proveedor»: si `!connection.modelIsDefault`, abre `ConfirmDialog` (§11) y
  «Continuar» hace `setEditing(true)`; si no, como hoy (R15).

### 12.3 `AiProviderForm`

La ayuda pasa a «Se usa con el modelo {selected.defaultModel}.» (R30). Si el proveedor elegido es el
conectado y hay elección, el texto **no** cambia: la prueba usa la elección (R19) y es un detalle que
el tablero no pide mostrar.

---

## 13. E2E (pregunta abierta 2) — PROPUESTA: sí, mínimo

No es flujo crítico (`docs/checkpoints-proyecto.md > Flujos criticos`), pero
`e2e/integraciones-proveedor-ia.spec.ts` **ya** lee `recipeModel`/`catalogModel` de la base y los
testids de las dos filas que desaparecen (l. 283-296): sin tocarlo, el E2E de PR a producción se
pone rojo. Se ajusta ese caso y se añade **uno**:

- Con la conexión creada por el doble: el selector muestra el predeterminado con «Predeterminado»;
  elegir otra opción muestra «Modelo guardado» y, tras recargar, «Elegido por tu empresa.». Con
  Gemini (dos opciones en §3).

El estado «No disponible» se cubre en unit (`ai-provider-card.test.tsx`) con la vista, no en E2E:
fabricarlo exige escribir la fila a mano y no añade nada que el unit no vea.

---

## 14. Tests

| Archivo | Cubre |
|---|---|
| `tests/integration/integraciones/ai-models-migration.int.test.ts` (nuevo) | R1–R4, R7: tabla, PK, CHECK, FK, índice parcial (un segundo predeterminado da `23505`), siembra exacta de §3, un predeterminado por proveedor, FK compuesta rechaza modelo de otro proveedor (`23503`), columnas borradas, `down.sql` deja el esquema y los valores de QC-275 |
| `tests/integration/integraciones/ai-provider-migration.int.test.ts` | Se ajusta: aplica su migración y la nueva en orden, o deja de mirar las columnas que borra la nueva |
| `tests/integration/integraciones/ai-provider-connection-prisma.int.test.ts` | `model`/`unavailableModel` en create/update/find; P2003 |
| `tests/unit/integraciones/ai-provider/select-ai-model.test.ts` (nuevo) | R8–R12 |
| `…/save-ai-provider-connection.test.ts` | R14, R19 |
| `…/test-ai-provider-key.test.ts`, `…/test-saved-ai-provider.test.ts` | R18–R22 |
| `…/resolve-and-report.test.ts` | R16, R17, R23, R24 |
| `…/ai-provider-failure.test.ts` | R20, textos de §4.4 |
| `…/connection-view.test.ts` | vista: modelo en uso, marcado, opciones sin el marcado (R28) |
| `…/ai-provider-actions.test.ts` | `selectAiModelAction`, R13 |
| `tests/unit/documentos/run-document-job-ai-provider.test.ts` | R23 (archivo `ai_provider_error`, informe), R25 |
| `tests/unit/documentos/ai-reader-*.test.ts` (los de hoy) | 404 al leer ⇒ `AiProviderError` con `model_unavailable` (R23) |
| `tests/unit/composition/ai-provider-wiring.test.ts` | gateway sin uso; `selectAiModel` cableado |
| `tests/unit/documentos/ai-model-literals.test.ts` | R6, sin cambios (sigue barriendo `lib/`) |
| `tests/unit/integraciones-ui/ai-model-select.test.tsx` (nuevo) | R26–R28, R31 (opciones, insignias, tachado, `invalid`, hoja a ≤ 640 px, alturas) |
| `tests/unit/integraciones-ui/ai-provider-card.test.tsx` | R15, R26, R29 |
| `tests/unit/integraciones-ui/ai-provider-form.test.tsx`, `ai-provider-page.test.tsx` | R30; datos de prueba sin `recipeModel` |
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
6. **Probar el modelo al elegirlo.** Daría aviso inmediato, pero el tablero guarda al instante sin
   prueba y D8 deja la verificación a «Probar conexión». Descartada.
7. **Conservar `AiReadUse` por si vuelve un modelo por tarea.** Sería un parámetro ignorado; «un modelo
   distinto por tarea» está en «Lo que NO entra». Descartada.
