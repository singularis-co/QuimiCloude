# QT-304 — tool-calling-con-ai-sdk · design.md

## Lo que ya existe

Buscado en el board (`feature_list.json`, todos los estados), en `specs/` y en el código (grafo del
worktree `C-Users-Cristian-Documents-trabajo-arc-labs-.worktrees-QT-304-tool-calling-con-ai-sdk` y
Grep en `lib/`) con: `tool calling`, `herramienta`, `generateText`, `generateObject`, `toolCalls`,
`routerModel`, `económico`, `AI SDK`, `ai-sdk`, `AiProvider`, `AiModel`.

| Dónde | Qué apareció | Qué se hace |
|---|---|---|
| Board | QT-303 (`done`): base del agente (añadido, configuración, modo). QT-305…QT-310 (`pending`): la cadena que consume esta ficha. | Nada que duplicar; esta ficha es la capa de IA que esas usan. |
| Board | QT-291 (`done`): catálogo `ai_models` y elección de modelo por empresa. | Se **extiende**: dos columnas en `ai_models` y una en `ai_provider_connections`. |
| Board | QT-292 (`pending`): pantalla de plataforma para editar el catálogo de modelos. | Solapa en parte: cuando se haga, tendrá que editar también las dos marcas nuevas y respetar la FK del modelo enrutador. Se anota allí; aquí no se hace pantalla. |
| Board | QC-175 (`pending`): modelo de respaldo si Gemini está saturado. | Otro asunto (lectura de PDF). Nada que reutilizar. |
| `specs/` | `QT-291-seleccion-de-modelo-por-tarea` (catálogo y elección), `QC-275-proveedor-ia-propio` (conexión, key cifrada, prueba). | Se siguen sus patrones (FK compuesta a mano, nulo = predeterminado, consulta antes de guardar). |
| Código | Ningún tool calling ni salida estructurada en `lib/` (Grep de `generateText`, `generateObject`, `toolCalls`, `tool_use`, `function_call`: 0). No hay `ai` ni `@ai-sdk/*` en `package.json` ni en `node_modules/.pnpm/lock.yaml`. | Se crea. |

Se reutiliza, sin re-crear:

- `integraciones/domain/ai-provider.ts`: `AiProviderCode`, `AiProviderEntry`, `AiModelOption`,
  `AiProviderConnectionRecord`, `modelInUse`, `aiProviderKeyContext`.
- `integraciones/domain/ai-provider-failure.ts`: `AiProviderFailure` y sus cinco tipos, y
  `probeFailureMessage` (R9, R35).
- `integraciones/domain/resolve-ai-provider-for-reading.ts` y `test-saved-ai-provider.ts`
  (`decryptStoredKey`): el mismo camino para descifrar la key, con `missing`/`unreadable`.
- `integraciones/domain/select-ai-model.ts`: el patrón de elegir modelo (permiso, validación con
  catálogo, consulta con `AiProviderProbe`, nulo = predeterminado) para el modelo enrutador.
- `integraciones/ports/ai-provider-probe.ts` y su cableado `PROBE_BY_PROVIDER`: la consulta previa
  a guardar el modelo enrutador (R9). No se reescribe con el AI SDK.
- La tabla de clasificación de `classifyAnthropicError`, `classifyOpenAiError` y
  `classifyGenaiError` (`documentos/adapters/driven/ai/`): se replica la **tabla**, no el código
  (§6), porque las clases de error son otras y un driven de otro módulo no se importa.

---

## 1. Dónde vive y cómo fluye

Todo en el módulo `integraciones`, que ya es dueño de la conexión, del catálogo y del agente
(QT-303).

```
QT-306 / QT-307 (desde composition)
  └─ integraciones.generateAgentText(companyId, request)          domain/generate-agent-text.ts
  └─ integraciones.generateAgentObject(companyId, request)        domain/generate-agent-object.ts
        ├─ resolveConversationModel (connections + catalog + cipher)  domain/resolve-conversation-model.ts
        └─ ConversationalModel (puerto)                               ports/conversational-model.ts
              └─ adaptador AI SDK                                     adapters/driven/ai/conversational-model-ai-sdk.ts
```

- Sin actor: igual que `resolveAiProviderForReading`, la empresa la pone el servidor (el job de
  QT-307), nunca el modelo ni una pantalla.
- La key se descifra dentro del caso de uso y viaja **solo** al puerto (R18). El resultado no la
  lleva.
- `integraciones.selectAiRouterModel(input, actor)` es un caso de uso con actor, como
  `selectAiModel` (§5.2).

## 2. Modelo de datos

### 2.1 `db/schema.prisma`

```prisma
model AiModel {
  provider      AiProviderCode
  modelId       String         @map("model_id")
  isDefault     Boolean        @default(false) @map("is_default")
  sortOrder     Int            @map("sort_order")
  supportsTools Boolean        @default(false) @map("supports_tools")   // nuevo
  isEconomic    Boolean        @default(false) @map("is_economic")      // nuevo
  ...
}

model AiProviderConnection {
  ...
  routerModel   String?        @map("router_model_id")                  // nuevo
}
```

Sin `@relation`, como el resto de `integraciones`: la FK va escrita a mano en la migración.

### 2.2 Migración `20261031120000_ai_model_capabilities`

Escrita a mano. En orden:

1. `ALTER TABLE "ai_models" ADD COLUMN "supports_tools" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN
   "is_economic" BOOLEAN NOT NULL DEFAULT false` (R1).
2. `UPDATE "ai_models" SET ...` por `(provider, model_id)` con la tabla de §3 (R2). Una fila por
   modelo marcado, con literales; las no marcadas quedan en `false`.
3. `ALTER TABLE "ai_provider_connections" ADD COLUMN "router_model_id" TEXT`,
   `ADD CONSTRAINT "ai_provider_connections_router_model_not_empty" CHECK ("router_model_id" <> '')`
   y FK `ai_provider_connections_router_model_fkey` `(provider, router_model_id) →
   ai_models(provider, model_id)` `ON DELETE RESTRICT ON UPDATE CASCADE`, `MATCH SIMPLE` (R5, R6):
   nulo no se comprueba; con valor, la base rechaza un modelo de otro proveedor o fuera del catálogo.
   Las conexiones existentes nacen sin elección.

«Económico» **no** lo puede imponer la FK (no hay FK contra un índice parcial). Lo imponen el caso de
uso al elegir (R7) y la resolución en cada uso (R14: un elegido que dejó de ser económico se trata
como sin elección). Ver §9.3 para el trigger descartado.

`down.sql`, inverso exacto (R3): `DROP CONSTRAINT` de la FK y del CHECK, `DROP COLUMN
"router_model_id"`; `DROP COLUMN "is_economic"`, `DROP COLUMN "supports_tools"`. Se pierden las
elecciones de modelo enrutador: es lo que revierte la subida.

### 2.3 RLS y guardias de esquema

- Sin tablas nuevas. `ai_models` y `ai_provider_connections` ya tienen RLS activada y forzada; las
  columnas nuevas la heredan. La autorización vive en el caso de uso (§5.2).
- `tests/guards/guard-identificador-de-request.test.ts` gana la carpeta nueva en su lista, con su
  comentario «no toca el identificador», como `20261022120000_ai_models`.
- `ai_models` sigue sin `company_id` (ya está en `EXENTAS`).

## 3. Valores sembrados (propuesta, P2)

**No hay dato verificado en el repo.** La tabla es la propuesta con la que se escribe el spec; T0 la
contrasta con `https://openrouter.ai/api/v1/models` (campo `supported_parameters`: `tools` para
«admite herramientas»; `structured_outputs` o `response_format` como dato de apoyo para el
enrutador) y con la documentación de cada proveedor. Si un valor no se confirma, se para y se
pregunta.

Criterio propuesto:
- **Admite herramientas**: todos los modelos del catálogo actual (todos son modelos de propósito
  general de las cuatro familias). A verificar uno por uno.
- **Económico**: los de menor coste de cada proveedor; por nombre, las líneas `haiku`, `flash-lite`,
  `luna` y `flash`. Es una inferencia por nombre, **no** un dato de precio: T0 la confirma con el
  precio por token de OpenRouter.

| Proveedor | `model_id` | `supports_tools` | `is_economic` |
|---|---|---|---|
| `ANTHROPIC` | `claude-opus-5-5` | sí | no |
| `ANTHROPIC` | `claude-sonnet-5-5` | sí | no |
| `ANTHROPIC` | `claude-opus-5` | sí | no |
| `ANTHROPIC` | `claude-sonnet-5` | sí | no |
| `ANTHROPIC` | `claude-haiku-5-5` | sí | **sí** |
| `GOOGLE` | `gemini-4-argon` | sí | no |
| `GOOGLE` | `gemini-3.8-flash` | sí | **sí** |
| `GOOGLE` | `gemini-3.7-flash` | sí | **sí** |
| `GOOGLE` | `gemini-3.5-flash-lite` | sí | **sí** |
| `GOOGLE` | `gemini-3.1-flash-lite` | sí | **sí** |
| `OPENAI` | `gpt-6.1-sol` | sí | no |
| `OPENAI` | `gpt-6-sol` | sí | no |
| `OPENAI` | `gpt-6-luna-pro` | sí | no |
| `OPENAI` | `gpt-6-luna` | sí | **sí** |
| `OPENAI` | `gpt-5.6-luna` | sí | **sí** |
| `OPENROUTER` | `anthropic/claude-sonnet-5.5` | sí | no |
| `OPENROUTER` | `openai/gpt-6.1-sol` | sí | no |
| `OPENROUTER` | `google/gemini-3.8-flash` | sí | **sí** |
| `OPENROUTER` | `anthropic/claude-haiku-5.5` | sí | **sí** |
| `OPENROUTER` | `openai/gpt-6-luna` | sí | **sí** |

Con esta tabla, el **económico predeterminado** (R14: primero económico por `sort_order`) sería
`claude-haiku-5-5`, `gemini-3.8-flash`, `gpt-6-luna` y `google/gemini-3.8-flash`. Los ids salen de
`20261022120000_ai_models/migration.sql`; viven solo en la migración y en tests, nunca en `lib/`
(`tests/unit/documentos/ai-model-literals.test.ts`).

## 4. El puerto `ConversationalModel`

### 4.1 Tipos (`ports/conversational-model.ts`)

Solo tipos propios y `zod` (paquete puro admitido en `ports/`). Ningún tipo de `ai` cruza el puerto.

```ts
import type { z } from 'zod';
import type { AiProviderCode } from '../domain/ai-provider';
import type { AiProviderFailure } from '../domain/ai-provider-failure';

export type ConversationTurn = { readonly role: 'user' | 'assistant'; readonly text: string };

/** El contexto (empresa, cliente) lo cierra quien construye la herramienta; el modelo solo da `input`. */
export type ConversationalTool<I = unknown> = {
  readonly name: string;
  readonly description: string;
  readonly input: z.ZodType<I>;
  execute(input: I): Promise<unknown>;            // resultado serializable a JSON
};

export type ModelTarget = {
  readonly provider: AiProviderCode;
  readonly model: string;
  readonly apiKey: string;
};

export type ToolCallRecord = { readonly name: string; readonly ok: boolean };
export type TokenUsage = { readonly inputTokens: number | null; readonly outputTokens: number | null };

export type TextGeneration =
  | { readonly status: 'ok'; readonly text: string; readonly toolCalls: readonly ToolCallRecord[];
      readonly usage: TokenUsage; readonly steps: number }
  | { readonly status: 'step_limit'; readonly toolCalls: readonly ToolCallRecord[]; readonly usage: TokenUsage; readonly steps: number }
  | { readonly status: 'empty_reply'; readonly toolCalls: readonly ToolCallRecord[]; readonly usage: TokenUsage; readonly steps: number }
  | { readonly status: 'failed'; readonly failure: AiProviderFailure };

export type ObjectGeneration<T> =
  | { readonly status: 'ok'; readonly value: T; readonly usage: TokenUsage }
  | { readonly status: 'invalid_output'; readonly usage: TokenUsage | null }
  | { readonly status: 'failed'; readonly failure: AiProviderFailure };

/** Un fallo del proveedor o de la red es un resultado, no una excepción (como `AiProviderProbe`). */
export interface ConversationalModel {
  generateText(input: ModelTarget & {
    readonly system: string;
    readonly turns: readonly ConversationTurn[];
    readonly tools: readonly ConversationalTool[];
    readonly maxSteps: number;
    readonly timeoutMs: number;
  }): Promise<TextGeneration>;
  generateObject<T>(input: ModelTarget & {
    readonly system: string;
    readonly turns: readonly ConversationTurn[];
    readonly schema: z.ZodType<T>;
    readonly timeoutMs: number;
  }): Promise<ObjectGeneration<T>>;
}
```

`ToolCallRecord` lleva nombre y resultado, no la entrada ni la salida: lo que QT-307 registra por
turno (herramientas llamadas) sin guardar datos del cliente.

### 4.2 Validaciones que hace el dominio antes del puerto

- **Nombre de herramienta** (R27): `^[a-zA-Z0-9_-]{1,64}$`, único en la lista. Es el formato que
  admiten los cuatro proveedores según su documentación pública; **a verificar en T0** para Gemini.
  Un nombre inválido o repetido es error de programación (`Error`), no un resultado.
- **Tope de pasos** (R24, P5): entero en `[1, 8]`; fuera de rango, `Error`.
- **`timeoutMs`**: entero > 0; fuera de rango, `Error`.
- **Turnos**: al menos uno; el último es del usuario. Texto sin recortar (lo decide quien llama).

## 5. Casos de uso

### 5.1 Resolución del modelo (`domain/resolve-conversation-model.ts`, interno)

```ts
type ModelRole = 'main' | 'economic';
type ConversationModelResolution =
  | { status: 'missing' } | { status: 'unreadable' } | { status: 'no_economic_model' }
  | { status: 'ready'; target: ModelTarget; supportsTools: boolean };
```

- `main` (R13): `modelInUse(record, entry)`.
- `economic` (R14, R15): `routerEconomicModel(record, entry)`, función pura en
  `domain/ai-provider.ts`: el `routerModel` si existe en `entry.models` y es económico; si no, el
  primero económico de `entry.models` (que ya viene por `sort_order`); si no hay, `null` →
  `no_economic_model`.
- `missing`/`unreadable` (R16): mismo código que `resolveAiProviderForReading`, con
  `decryptStoredKey` y `SecretUnreadableError`. Un descifrado fallido **no** marca la conexión (R36).
- Sin cambiar `resolveAiProviderForReading` (R39).

### 5.2 `selectAiRouterModel` (`domain/select-ai-router-model.ts`)

Sigue `select-ai-model.ts` paso a paso:

1. `requireAgentConfigurePermission(actor)` (P3; si el humano elige `integraciones.modificar`,
   `requirePermission`) — R8.
2. zod: `{ modelId: string | null }` (cadena no vacía recortada, o `null` = sin elección).
3. Sin conexión → `{ status: 'not_connected' }` (R10).
4. `entry.models` debe traer `modelId` con `isEconomic`; si no → `ValidationError` sin consulta (R7).
5. Descifra la key y consulta `deps.probe.probe({ provider, apiKey, models: [modelId] })`; si falla
   → `{ status: 'rejected', message: probeFailureMessage(failure) }` sin escribir (R9). Con
   `modelId = null` se consulta el económico predeterminado.
6. Guarda `routerModel: modelId === predeterminadoEconómico ? null : modelId` (R11) y devuelve
   `{ status: 'saved', routerModelInUse }`.

No toca `status`/`lastError` de la conexión: elegir no es «Probar conexión» (mismo criterio que
`selectAiModel`).

### 5.3 `generateAgentText` y `generateAgentObject`

```ts
generateAgentText(companyId: string, request: {
  modelRole: ModelRole; system: string; turns: ConversationTurn[];
  tools: ConversationalTool[]; maxSteps: number; timeoutMs: number;
}): Promise<AgentTextResult>
// AgentTextResult = TextGeneration
//   | { status: 'missing' | 'unreadable' | 'no_economic_model' | 'model_without_tools' }

generateAgentObject<T>(companyId: string, request: {
  modelRole: ModelRole; system: string; turns: ConversationTurn[];
  schema: z.ZodType<T>; timeoutMs: number;
}): Promise<AgentObjectResult<T>>
```

- Valida §4.2 antes de leer la conexión (R27).
- `tools.length > 0 && !supportsTools` → `model_without_tools` sin llamar (R17).
- `generateAgentObject` pasa al puerto sin herramientas (R30) y **vuelve a validar** el valor con
  `schema.safeParse` (R28): si el adaptador devolviera algo que no cumple, sale `invalid_output`
  (R29). Es defensa barata y hace el requisito independiente del SDK.
- No llama a `connections.update` (R36). Devolver el `failure` tal cual permite que QT-307 llame a
  `reportAiProviderOutcome` si así lo decide (P6, R35).

### 5.4 Cambios en casos de uso existentes

- `save-ai-provider-connection.ts > persistOnce` (R12): con otro proveedor, el patch suma
  `routerModel: null` junto a `model: null`; con el mismo, no lo toca. `create` nace con
  `routerModel: null`.
- `AiProviderConnectionRecord`, `NewAiProviderConnectionRow` y `AiProviderConnectionPatch` ganan
  `routerModel`; el adaptador Prisma lo lee y escribe. `toAiProviderConnectionView` **no** cambia
  (sin UI en esta ficha; P4).
- `AiModelOption` gana `supportsTools` e `isEconomic`; `ai-provider-catalog-prisma.ts` los selecciona
  (R4). `ai-provider-actions.ts > toModelOptionState` copia campo a campo y por eso **no** los saca a
  la pantalla: no se toca.

## 6. Clasificación de fallos (R34, R35)

La misma tabla que la lectura de PDF, por proveedor. El adaptador la aplica sobre el error del AI SDK
(`APICallError`: código HTTP en `statusCode`, cuerpo en `responseBody` — **nombres a verificar en
T0**). Del cuerpo solo se mira lo que la tabla dice, y nada de él sale.

| Situación | ANTHROPIC | GOOGLE | OPENAI | OPENROUTER |
|---|---|---|---|---|
| 401 / 403 | `rejected_key` | `rejected_key` | `rejected_key` | `rejected_key` |
| 400 con `API_KEY_INVALID` en el cuerpo | — | `rejected_key` | — | — |
| 402 | `unexpected` | `quota` | `quota` | `quota` |
| 429 | `quota` | `quota` | `quota` | `quota` |
| 404 (con modelo) | `model_unavailable` | `model_unavailable` | `model_unavailable` | `model_unavailable` |
| 400 con mensaje exacto `<modelo> is not a valid model ID` | — | — | — | `model_unavailable` |
| Sin respuesta, aborto o plazo (R33) | `unreachable` | `unreachable` | `unreachable` | `unreachable` |
| Cualquier otro | `unexpected` | `unexpected` | `unexpected` | `unexpected` |

Columnas tomadas de `classifyAnthropicError`, `classifyGenaiError` y `classifyOpenAiError` tal como
están hoy. La función es pura y exportada (`classifyAiSdkError(error, provider, model)`) para
probarla sin red.

Errores que **no** son del proveedor:
- Salida estructurada que no valida (en el SDK, `NoObjectGeneratedError` — **a verificar**) →
  `invalid_output`, no `failed`.
- Entrada de herramienta inválida o herramienta desconocida (R21, R22) → la llamada consta
  `ok: false` y la generación sigue o acaba según el SDK; **cómo** las expone el SDK (partes
  `tool-error` en los pasos o excepción `InvalidToolInputError`/`NoSuchToolError`) se verifica en T0.
  Si el SDK lanzara en vez de seguir, el adaptador lo convierte en `failed` con `unexpected` y la
  lista de llamadas se pierde; T0 decide y, si pasa, se pregunta.
- Excepción de `execute` (R23): el adaptador envuelve cada `execute` en un `try/catch` propio que
  devuelve al modelo `{ error: 'tool_failed' }` y anota la llamada `ok: false`. No depende de cómo
  el SDK trate los errores de herramienta.

## 7. El adaptador del AI SDK

Archivos (los únicos que importan `ai` o `@ai-sdk/*`, R37):

- `adapters/driven/ai/conversational-model-ai-sdk.ts`: implementa `ConversationalModel`, traduce
  herramientas y turnos, aplica `maxRetries: 0` (R32), `abortSignal: AbortSignal.timeout(timeoutMs)`
  (R33), el tope de pasos (R24) y `classifyAiSdkError` (§6).
- `adapters/driven/ai/ai-sdk-models.ts`: `Record<AiProviderCode, (target) => LanguageModel>`, para
  que un proveedor nuevo sin implementación no compile (R31):
  - `ANTHROPIC` → `createAnthropic({ apiKey })(model)`.
  - `GOOGLE` → `createGoogleGenerativeAI({ apiKey })(model)`.
  - `OPENAI` → `createOpenAI({ apiKey })(model)`.
  - `OPENROUTER` → `createOpenAI({ apiKey, baseURL: OPENROUTER_BASE_URL }).chat(model)`: la API de
    chat completions, que es la que OpenRouter expone compatible. La constante se declara en este
    archivo con el mismo valor que la de `documentos` (`https://openrouter.ai/api/v1`): un driven de
    otro módulo no se importa (`docs/architecture.md > La regla de dependencias`).

API del AI SDK que usa el adaptador. **Ninguna firma se verificó contra el paquete** (no está
instalado y el spec se escribió sin red); T0 las confirma en la versión que se fije y, si alguna no
existe, se adapta el adaptador sin tocar el puerto:

| Necesidad | API esperada | Estado |
|---|---|---|
| Texto con herramientas y tope de pasos | `generateText({ model, system, messages, tools, stopWhen: stepCountIs(n), maxRetries, abortSignal })` | por verificar |
| Declarar una herramienta | `tool({ description, inputSchema, execute })` con un esquema zod | por verificar |
| Salida estructurada | `generateObject({ model, schema, ... })` o `generateText({ output: Output.object({ schema }) })` | por verificar cuál es la vigente |
| Pasos y llamadas | `result.steps[].toolCalls` / `toolResults`, `result.text` | por verificar |
| Tokens | `result.totalUsage` o `result.usage` con `inputTokens`/`outputTokens` | por verificar |
| Error HTTP | `APICallError.isInstance(e)`, `e.statusCode`, `e.responseBody` | por verificar |
| Modelo simulado para tests | `MockLanguageModelV*` de `ai/test` | por verificar el sufijo de versión |
| zod 4 | `peerDependencies.zod` admite `^4` (el repo usa `^4.4.3`) | por verificar |

`OPENROUTER_BASE_URL` es configuración de proveedor, no de entorno: no entra en
`docs/architecture.md > Principios 4` como hardcode de contexto, igual que en `documentos`.

### 7.1 Cableado (`lib/composition/index.ts`)

```ts
const conversationalModel: ConversationalModel = createConversationalModelAiSdk();
const agentModelDeps = { ...aiProviderDeps, model: conversationalModel };
// entradas nuevas de la fachada `integraciones`:
//   generateAgentText: createGenerateAgentText(agentModelDeps),
//   generateAgentObject: createGenerateAgentObject(agentModelDeps),
//   selectAiRouterModel: createSelectAiRouterModel(aiProviderDeps),
```

Sin doble E2E en esta ficha: no hay pantalla ni flujo que lo use. QT-307 lo añade si su E2E lo pide.

## 8. Dependencias nuevas (D1, R38) — se aprueban con este spec

| Paquete | Para qué | Qué código nos ahorra |
|---|---|---|
| `ai` | Núcleo: bucle de tool calling por pasos, validación de la entrada de cada herramienta con zod, salida estructurada validada, errores tipados, contabilidad de tokens. | El bucle «llamar → ejecutar herramientas → devolver resultados → volver a llamar» y la conversión zod → JSON Schema, escritos **tres veces** (un formato de herramientas por proveedor: `tool_use` de Anthropic, `function_call` de OpenAI, `functionDeclarations` de Gemini) sobre los SDK que ya tenemos. |
| `@ai-sdk/anthropic` | Proveedor Anthropic para `ai`. | La traducción a la Messages API con herramientas. |
| `@ai-sdk/openai` | Proveedor OpenAI y, con `baseURL`, OpenRouter. | La traducción a Chat Completions / Responses con herramientas. |
| `@ai-sdk/google` | Proveedor Gemini para `ai`. | La traducción a `generateContent` con `functionDeclarations`. |

**Los cuatro checks: DESCONOCIDOS, y se dice** (regla 6 de `CLAUDE.md`). El spec se escribió sin red
y sin el paquete en `node_modules`. No se proponen como «sí»: T0 los corre y los anota antes de la
aprobación:

```
npm view <pkg> deprecated time.modified version license peerDependencies
curl -s https://api.npmjs.org/downloads/point/last-week/<pkg>
```

Lo que se sabe sin verificar (memoria del autor, no acta): los cuatro son del repositorio
`github.com/vercel/ai`, licencia Apache-2.0, publicados con frecuencia y con millones de descargas
semanales; las majors de `ai` y de `@ai-sdk/*` van emparejadas (`ai@5` con `@ai-sdk/*@2`, `ai@6` con
`@ai-sdk/*@3`). **La versión exacta es DESCONOCIDA** (P7): se fija la última estable de la major
vigente el día de T0, las cuatro de la misma serie, con rango `^` como el resto de `package.json`.

**Fila propuesta para `docs/dependencias.md`** (una por paquete; se rellena con los datos de T0 y la
fecha de aprobación; la escribe el implementer **después** de la aprobación humana):

| Paquete | Para qué | Estado | Fecha | Notas |
| --- | --- | --- | --- | --- |
| `ai` | Núcleo del AI SDK de Vercel para el agente de WhatsApp (QT-304): tool calling por pasos, salida estructurada validada con zod, errores tipados y tokens. La alternativa es el bucle de herramientas a mano, tres veces, sobre `@anthropic-ai/sdk`, `openai` y `@google/genai` | aprobada | `<fecha F1.4>` | **Los cuatro checks**, verificados en T0 el `<fecha>`: `deprecated` `<…>`; última release **`<versión>` del `<fecha>`**; **`<n>`** descargas semanales; licencia **`<…>`**. Aprobada por el humano con el spec de QT-304 (F1.4). **Aislada** en `lib/modules/integraciones/adapters/driven/ai/conversational-model-ai-sdk.ts` y `ai-sdk-models.ts`, detrás del puerto `ConversationalModel`; lo vigila `tests/unit/integraciones/agente/ai-sdk-isolation.test.ts`. **No sustituye** a `@anthropic-ai/sdk`, `openai` ni `@google/genai`: la lectura de PDF y la prueba de conexión siguen con ellos (P1). Descartadas: bucle propio sobre los SDK actuales; `@openrouter/ai-sdk-provider` y `@ai-sdk/openai-compatible` para OpenRouter (`specs/QT-304-tool-calling-con-ai-sdk/design.md > 9`) |
| `@ai-sdk/anthropic` | Proveedor Anthropic del AI SDK (QT-304) | aprobada | `<fecha>` | Mismos datos de T0 por paquete; misma aislación y misma serie de versiones que `ai` |
| `@ai-sdk/openai` | Proveedor OpenAI del AI SDK y, con `baseURL`, OpenRouter (QT-304) | aprobada | `<fecha>` | Ídem |
| `@ai-sdk/google` | Proveedor Gemini del AI SDK (QT-304) | aprobada | `<fecha>` | Ídem |

Transitivas que arrastran (`@ai-sdk/provider`, `@ai-sdk/provider-utils` y lo que T0 vea) **no llevan
fila**, con el mismo criterio que `@tanstack/react-store` y `date-fns`.

`tests/guards/guard-identificador-de-request.test.ts > DEPENDENCIAS_ESPERADAS` pasa de 45 a 49, con
su línea de historia.

## 9. Alternativas descartadas

### 9.1 Bucle de herramientas propio sobre los tres SDK que ya están aprobados

Sin dependencia nueva: un adaptador por proveedor con su formato de herramientas, la conversión de
zod a JSON Schema (zod 4 trae `z.toJSONSchema`) y el bucle de pasos. **Descartada** porque D1 ya la
cerró el humano y porque son tres implementaciones del mismo bucle, con tres formatos de llamada y
de resultado, tres maneras de contar tokens y tres de forzar salida estructurada, que habría que
mantener y probar. Es justo lo que `docs/architecture.md > Dependencias de terceros` pide no
reinventar.

### 9.2 `@openrouter/ai-sdk-provider` o `@ai-sdk/openai-compatible` para OpenRouter

El proveedor oficial de OpenRouter expone sus extras (enrutado entre proveedores, `reasoning`), y
`@ai-sdk/openai-compatible` es el genérico de Vercel para APIs compatibles. **Descartadas por ahora**:
cada una es una fila y un paquete más para algo que `@ai-sdk/openai` con `baseURL` y `.chat()` ya
cubre, y es como hoy se conecta OpenRouter (`openai` con `baseURL`). **Salida identificada**: si T0
muestra que `@ai-sdk/openai` no hace tool calling o salida estructurada con OpenRouter, se propone
`@openrouter/ai-sdk-provider` (con sus cuatro checks) y se para a preguntar.

### 9.3 Trigger en la base para exigir que `router_model_id` sea económico

Un trigger `BEFORE INSERT OR UPDATE` que mire `ai_models.is_economic`. **Descartado**: también
habría que vigilar el cambio de `is_economic` en el catálogo (otro trigger), y el repo no usa
triggers para reglas de negocio (la frontera es el caso de uso, `docs/architecture.md > Acceso a
datos y autorizacion`). R14 cubre el caso «dejó de ser económico» en cada uso.

### 9.4 Exponer la key resuelta a QT-307 (como `resolveAiProviderForReading`)

Así lo hace la lectura de PDF: la composición recibe la key y construye el lector. **Descartado**
para la conversación: los casos de uso de esta ficha llaman al puerto ellos mismos, así la key no
sale nunca del módulo (R18) y QT-306/QT-307 no tocan secretos.

## 10. Tests

| Archivo | Qué prueba | R |
|---|---|---|
| `tests/integration/integraciones/ai-model-capabilities-migration.int.test.ts` | Columnas, valores de §3, CHECK y FK del enrutador (otro proveedor y fuera de catálogo rechazados), `down.sql` deja el esquema y los datos previos | R1–R3, R5, R6 |
| `tests/integration/integraciones/ai-provider-connection-prisma.int.test.ts` (ampliado) | `routerModel` se lee y escribe; el catálogo trae las dos marcas | R4, R5 |
| `tests/unit/integraciones/ai-provider/router-economic-model.test.ts` | `routerEconomicModel`: elegido, nulo, elegido que dejó de ser económico, sin económicos | R14, R15 |
| `tests/unit/integraciones/ai-provider/select-ai-router-model.test.ts` | Permiso, no económico, sin conexión, consulta fallida, nulo = predeterminado económico | R7–R11 |
| `tests/unit/integraciones/ai-provider/save-ai-provider-connection.test.ts` (ampliado) | Cambio de proveedor vacía el enrutador; mismo proveedor lo conserva | R12 |
| `tests/unit/integraciones/agente/generate-agent-text.test.ts` | Con puerto simulado: resolución main/economic, `missing`, `unreadable`, `model_without_tools`, validaciones §4.2, la key no sale, sin `update` | R13, R16–R18, R24, R27, R36 |
| `tests/unit/integraciones/agente/generate-agent-object.test.ts` | Puerto simulado: valor validado, re-validación, sin herramientas | R28–R30 |
| `tests/unit/integraciones/agente/conversational-model-ai-sdk.test.ts` | Con el modelo simulado de `ai/test`: herramientas ofrecidas, ejecución con entrada validada, entrada inválida, herramienta desconocida, excepción en `execute`, tope de pasos, respuesta vacía, tokens y pasos, salida estructurada inválida, sin reintentos, plazo | R19–R26, R29, R32, R33 |
| `tests/unit/integraciones/agente/classify-ai-sdk-error.test.ts` | La tabla de §6 caso por caso; el fallo no lleva texto del proveedor | R34, R35 |
| `tests/unit/integraciones/agente/ai-sdk-models.test.ts` | Un constructor por código de proveedor; OpenRouter con la URL de OpenRouter | R31 |
| `tests/unit/integraciones/agente/ai-sdk-isolation.test.ts` | Barrido de `lib/`, `app/`, `components/`, `scripts/`: solo los dos archivos de §7 importan `ai`/`@ai-sdk/*`; `documentos` no | R37, R39 |
| `tests/guards/guard-dependencias-aprobadas.test.ts` (sin cambios) | Las cuatro filas existen | R38 |

## 11. Riesgos y desconocidos

- **Toda la superficie del AI SDK de §7 está sin verificar** (paquete no instalado, sin red). Es el
  riesgo principal y por eso T0 va primero y bloquea la tanda 4.
- **Seed de §3 sin verificar** (P2): inferido por nombre.
- **Tool calling por OpenRouter con `@ai-sdk/openai`**: depende de que el modelo de destino admita
  herramientas en OpenRouter; lo cubre `supports_tools` por modelo, verificado en T0.
- **Coste**: esta ficha no limita uso; los topes son de QT-307 (D2 de QT-303).
