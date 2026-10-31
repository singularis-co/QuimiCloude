# QT-304 — tool-calling-con-ai-sdk · design.md

> Revisado el 2026-10-31 con las respuestas del humano a P1–P7 (`requirements.md > D4–D12`). El
> cambio grande es D6: el modelo deja de ser por empresa y pasa a **pares de plataforma por
> proveedor** que elige el Maestro.

## Lo que ya existe

Buscado en el board (`feature_list.json`, todos los estados), en `specs/` y en el código (grafo del
worktree `C-Users-Cristian-Documents-trabajo-arc-labs-.worktrees-QT-304-tool-calling-con-ai-sdk` y
Grep en `lib/`) con: `tool calling`, `herramienta`, `generateText`, `generateObject`, `toolCalls`,
`routerModel`, `económico`, `AI SDK`, `ai-sdk`, `AiProvider`, `AiModel`, `requirePlatformPermission`.

| Dónde | Qué apareció | Qué se hace |
|---|---|---|
| Board | QT-303 (`done`): base del agente (añadido, configuración, modo). QT-305…QT-310 (`pending`): la cadena que consume esta ficha. | Nada que duplicar; esta ficha es la capa de IA que esas usan. |
| Board | QT-291 (`done`): catálogo `ai_models` y elección de modelo por empresa. | Se **extiende**: dos columnas en `ai_models`. La elección por empresa sigue sirviendo solo a la lectura de PDF (D4, D6). |
| Board | QT-292 (`pending`): pantalla de plataforma para editar el catálogo de modelos. | Solapa en parte: tendrá que editar también las dos marcas y respetar las FK de los pares (R9). Se anota allí; aquí no se hace pantalla. |
| Board | QT-311 (nueva, D7): pantalla del Maestro para los pares. | Consume `getAiModelPairs` y `saveAiModelPair` de esta ficha. |
| Board | QC-175 (`pending`): modelo de respaldo si Gemini está saturado. | Otro asunto (lectura de PDF). Su criterio de «saturado» puede reutilizar P9 si se cierra igual. |
| `specs/` | `QT-291-seleccion-de-modelo-por-tarea`, `QC-275-proveedor-ia-propio` (conexión, key cifrada, prueba). | Se siguen sus patrones (FK compuesta escrita a mano, RLS de catálogo). |
| `specs/` | `QC-182-modelo-de-planes` §4: permisos de plataforma del Maestro (`PERMISSIONS` + `SEED_ROLE_PERMISSIONS` + `ADMIN_EXCLUDED_PERMISSIONS` + `CORE_PERMISSIONS` + migración de datos `*_permissions` con `ON CONFLICT DO NOTHING` + test estático + test de integración). | Mismo patrón para `modelos_ia.*` (§5.1). |
| Código | `identity/domain/platform-actor.ts`: `PlatformActor` y `requirePlatformPermission`. `identity/index.ts` exporta solo el **tipo** `PlatformActor`. | Se exporta también `requirePlatformPermission` y lo usan los casos de uso de pares (§5.2). |
| Código | Ningún tool calling ni salida estructurada en `lib/` (Grep de `generateText`, `generateObject`, `toolCalls`, `tool_use`, `function_call`: 0). Sin `ai` ni `@ai-sdk/*` en `package.json`. | Se crea. |

Se reutiliza, sin re-crear:

- `integraciones/domain/ai-provider.ts`: `AiProviderCode`, `AiProviderEntry`, `AiModelOption`,
  `AiProviderConnectionRecord`, `aiProviderKeyContext`.
- `integraciones/domain/ai-provider-failure.ts`: `AiProviderFailure` y sus cinco tipos (R45).
- `integraciones/domain/resolve-ai-provider-for-reading.ts` y `test-saved-ai-provider.ts`
  (`decryptStoredKey`): el mismo camino para descifrar la key, con `missing`/`unreadable`.
- `integraciones/ports/ai-provider-catalog.ts` (`list`, `get`).
- La tabla de clasificación de `classifyAnthropicError`, `classifyOpenAiError` y
  `classifyGenaiError` (`documentos/adapters/driven/ai/`): se replica la **tabla**, no el código
  (§6), porque las clases de error son otras y un driven de otro módulo no se importa.

Se **retira** del diseño anterior (no llegó a implementarse): `routerModel` /
`router_model_id` en `ai_provider_connections`, `routerEconomicModel`, `selectAiRouterModel` y el
cambio en `save-ai-provider-connection.ts`. `AiProviderConnectionRecord` no cambia.

---

## 1. Dónde vive y cómo fluye

Todo en el módulo `integraciones`, dueño de la conexión, del catálogo y del agente (QT-303).

```
QT-311 (pantalla del Maestro, otra ficha)
  └─ integraciones.getAiModelPairs(actor)                     domain/get-ai-model-pairs.ts
  └─ integraciones.saveAiModelPair(input, actor)              domain/save-ai-model-pair.ts
        ├─ AiProviderCatalog (puerto existente)
        └─ AiModelPairRepository (puerto nuevo)               ports/ai-model-pair-repository.ts
              └─ adaptador Prisma                             adapters/driven/persistence/ai-model-pair-prisma.ts

QT-306 / QT-307 (desde composition)
  └─ integraciones.generateAgentText(companyId, request)      domain/generate-agent-text.ts
  └─ integraciones.generateAgentObject(companyId, request)    domain/generate-agent-object.ts
        ├─ resolveConversationModel (connections + catalog + pairs + cipher)
        │                                                     domain/resolve-conversation-model.ts
        ├─ withFallback (regla de D9)                         domain/model-fallback.ts
        └─ ConversationalModel (puerto)                       ports/conversational-model.ts
              └─ adaptador AI SDK                             adapters/driven/ai/conversational-model-ai-sdk.ts
```

- Generación sin actor: igual que `resolveAiProviderForReading`, la empresa la pone el servidor (el
  job de QT-307), nunca el modelo ni una pantalla.
- Pares con `PlatformActor` (el Maestro no tiene empresa).
- La key se descifra dentro del caso de uso y viaja **solo** al puerto (R22).

## 2. Modelo de datos

### 2.1 `db/schema.prisma`

```prisma
enum AiModelRole {
  AGENT
  ROUTER

  @@map("ai_model_role")
}

model AiModel {
  provider      AiProviderCode
  modelId       String         @map("model_id")
  isDefault     Boolean        @default(false) @map("is_default")
  sortOrder     Int            @map("sort_order")
  supportsTools Boolean        @default(false) @map("supports_tools")   // nuevo
  isEconomic    Boolean        @default(false) @map("is_economic")      // nuevo
  ...
}

/// Pares principal + respaldo de la plataforma, uno por proveedor y rol. Los elige el Maestro.
/// Sin `@relation`: las FK a `ai_providers`, `ai_models` (dos compuestas) y `users`, y el CHECK,
/// están escritos a mano en la migración. `updatedBy` nulo = lo sembró la migración.
/// @module integraciones
model AiAgentModelPair {
  provider        AiProviderCode
  role            AiModelRole
  primaryModelId  String         @map("primary_model_id")
  fallbackModelId String         @map("fallback_model_id")
  updatedBy       String?        @map("updated_by") @db.Uuid
  updatedAt       DateTime       @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)

  @@id([provider, role], map: "ai_agent_model_pairs_pkey")
  @@index([updatedBy], map: "ai_agent_model_pairs_updated_by_idx")
  @@map("ai_agent_model_pairs")
}
```

`AiProviderConnection` **no cambia** (D6).

### 2.2 Migración de esquema `20261031120000_ai_agent_model_pairs`

Escrita a mano. En orden:

1. `ALTER TABLE "ai_models" ADD COLUMN "supports_tools" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN
   "is_economic" BOOLEAN NOT NULL DEFAULT false` (R1).
2. `UPDATE "ai_models" SET ...` por `(provider, model_id)` con la tabla de §3.1 (R2), con literales.
3. `CREATE TYPE "ai_model_role" AS ENUM ('AGENT', 'ROUTER')`.
4. `CREATE TABLE "ai_agent_model_pairs"` con (R5–R7, R9):
   - PK `(provider, role)` → como mucho un par por proveedor y rol.
   - `primary_model_id` y `fallback_model_id` `TEXT NOT NULL`.
   - `ai_agent_model_pairs_provider_fkey` `(provider) → ai_providers(code)` `ON DELETE RESTRICT ON
     UPDATE CASCADE`.
   - `ai_agent_model_pairs_primary_model_fkey` `(provider, primary_model_id) →
     ai_models(provider, model_id)` y `ai_agent_model_pairs_fallback_model_fkey` igual con
     `fallback_model_id`, ambas `ON DELETE RESTRICT ON UPDATE CASCADE`: un modelo de otro proveedor
     o fuera del catálogo se rechaza (R6) y un modelo en uso no se borra (R9).
   - `ai_agent_model_pairs_distinct_models` `CHECK ("primary_model_id" <> "fallback_model_id")` (R7).
   - `ai_agent_model_pairs_updated_by_fkey` `(updated_by) → users(id)` `ON DELETE RESTRICT ON UPDATE
     CASCADE`, nullable, como el resto de `*_by` del repo.
   - `updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP`.
   - `ENABLE` + `FORCE ROW LEVEL SECURITY`, sin policies, igual que `ai_models`.
5. `INSERT INTO "ai_agent_model_pairs"` de los ocho pares de §3.2 con `updated_by` NULL (R8).

«Admite herramientas» y «principal del enrutador económico» **no** los puede imponer la base (no hay
FK contra una columna booleana). Los impone `saveAiModelPair` (R10) y, para herramientas, la
generación en cada uso (R21, R27). Ver §9.3.

`down.sql`, inverso exacto (R3): `DROP TABLE "ai_agent_model_pairs"`, `DROP TYPE "ai_model_role"`,
`DROP COLUMN "is_economic"`, `DROP COLUMN "supports_tools"`. Se pierden los pares guardados por el
Maestro: es lo que revierte la subida.

### 2.3 Migración de datos `20261031120100_ai_agent_model_pairs_permissions`

Calcada de `20261028120100_plans_permissions` (QC-182 §4.3), separada del esquema para que se
revierta y se pruebe aparte (R17):

```sql
INSERT INTO "permissions" ("code", "module", "action", "description", "updated_at") VALUES
  ('modelos_ia.consultar', 'modelos_ia', 'consultar', 'Consultar los modelos de IA de la plataforma.', CURRENT_TIMESTAMP),
  ('modelos_ia.modificar', 'modelos_ia', 'modificar', 'Elegir los modelos de IA de la plataforma.', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_code")
SELECT "r"."id", "p"."code" FROM "roles" AS "r"
CROSS JOIN (VALUES ('modelos_ia.consultar'), ('modelos_ia.modificar')) AS "p"("code")
WHERE "r"."name" = 'Maestro'
ON CONFLICT ("role_id", "permission_code") DO NOTHING;
```

`down.sql`: `DELETE FROM "role_permissions"` y `DELETE FROM "permissions"` de exactamente esos dos
códigos. Las descripciones son las de `PERMISSIONS` (un test estático las compara).

### 2.4 RLS, guardias y docs que se tocan por la tabla nueva

- `tests/guards/guard-empresa-en-esquema.test.ts`: `ai_agent_model_pairs` entra en `EXENTAS` con
  motivo «pares de modelos de IA de la plataforma, compartidos por todas las empresas»; el recuento
  pasa de catorce a quince.
- `docs/architecture.md > Principios` (bullet de exentas): «catorce» → «quince» y
  `ai_agent_model_pairs` junto a `ai_models`. El guard R14 de ese archivo exige que coincidan.
- `tests/guards/guard-identificador-de-request.test.ts`: las dos carpetas nuevas en
  `MIGRACIONES_ESPERADAS`, con su comentario «no toca el identificador».
- `tests/integration/aislamiento.json`: los `.int.test.ts` nuevos en `transaccion`.

## 3. Valores sembrados

### 3.1 Marcas del catálogo (D5)

Verificado por el humano el 2026-10-31 en OpenRouter `/models`: los 15 modelos distintos tienen
`tools` y `structured_outputs`. «Económico» es una decisión de producto (equilibrio calidad/precio),
no un dato derivable del precio.

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
| `GOOGLE` | `gemini-3.1-flash-lite` | sí | no |
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

Los ids salen de `20261022120000_ai_models/migration.sql` (20 filas, sin altas posteriores); viven
solo en migraciones y tests, nunca en `lib/` (`tests/unit/documentos/ai-model-literals.test.ts`).

### 3.2 Pares iniciales (D8)

| Proveedor | Rol | Principal | Respaldo |
|---|---|---|---|
| `ANTHROPIC` | `AGENT` | `claude-sonnet-5-5` | `claude-sonnet-5` |
| `ANTHROPIC` | `ROUTER` | `claude-haiku-5-5` | `claude-sonnet-5-5` (no económico, D8) |
| `OPENAI` | `AGENT` | `gpt-6.1-sol` | `gpt-6-sol` |
| `OPENAI` | `ROUTER` | `gpt-6-luna` | `gpt-5.6-luna` |
| `GOOGLE` | `AGENT` | `gemini-4-argon` | `gemini-3.8-flash` |
| `GOOGLE` | `ROUTER` | `gemini-3.8-flash` | `gemini-3.5-flash-lite` |
| `OPENROUTER` | `AGENT` | `anthropic/claude-sonnet-5.5` | `openai/gpt-6.1-sol` |
| `OPENROUTER` | `ROUTER` | `anthropic/claude-haiku-5.5` | `google/gemini-3.8-flash` |

Comprobado contra §3.1: los 16 ids están en el catálogo de su proveedor, todos con herramientas,
principal ≠ respaldo en cada fila, y los cuatro principales de `ROUTER` son económicos. El respaldo
del enrutador de ANTHROPIC no es económico: **la regla «solo económicos» se aplica solo al
principal** (D8, R11), elegido así por el humano. El test de la migración lo fija como caso
explícito para que nadie lo «arregle».

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

export type ToolCallRecord = { readonly name: string; readonly ok: boolean; readonly executed: boolean };
export type TokenUsage = { readonly inputTokens: number | null; readonly outputTokens: number | null };

type Trace = { readonly toolCalls: readonly ToolCallRecord[]; readonly usage: TokenUsage; readonly steps: number };

export type TextGeneration =
  | ({ readonly status: 'ok'; readonly text: string } & Trace)
  | ({ readonly status: 'step_limit' } & Trace)
  | ({ readonly status: 'empty_reply' } & Trace)
  | { readonly status: 'failed'; readonly failure: AiProviderFailure;
      readonly toolCalls: readonly ToolCallRecord[] };   // las ejecutadas antes del fallo (R26)

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

- El puerto hace **una** llamada a **un** modelo. El respaldo es regla de dominio (§5.4), no del
  adaptador: así se prueba con un puerto simulado y el adaptador sigue sin reintentos (R42).
- `ToolCallRecord.executed` distingue «se ejecutó `execute`» de «se pidió pero no se ejecutó»
  (entrada inválida, herramienta desconocida). Lo usa R26. Lo anota el envoltorio de `execute` del
  adaptador, que no depende de cómo el SDK reporte los pasos.
- `ToolCallRecord` no lleva entrada ni salida: QT-307 registra herramientas llamadas sin guardar
  datos del cliente.

### 4.2 Validaciones que hace el dominio antes del puerto (R37)

- **Nombre de herramienta**: `^[a-zA-Z0-9_-]{1,64}$`, único en la lista. Formato común de los cuatro
  proveedores según su documentación pública; **se confirma en T4.2** para Gemini contra el paquete
  instalado. Inválido o repetido → `Error` (de programación), no un resultado.
- **Tope de pasos** (D10, R34): entero en `[1, 8]`; fuera de rango → `Error`.
- **`timeoutMs`**: entero > 0; fuera de rango → `Error`.
- **Turnos**: al menos uno; el último es del usuario.

## 5. Casos de uso

### 5.1 Permisos de plataforma (R16, R17)

Patrón de QC-182 §4, en `lib/modules/identity/domain/`:

- `permissions.ts > PERMISSIONS`: dos entradas al final, `module: 'modelos_ia'`, con las
  descripciones de §2.3; párrafo corto en el JSDoc («`modelos_ia` suma consultar y modificar, ver y
  elegir los pares de modelos de IA de la plataforma; su módulo no es una carpeta de `lib/modules/`:
  vive en `integraciones`; solo los recibe el Maestro»).
- `SEED_ROLE_PERMISSIONS[ROLE_MAESTRO]` gana los dos (y su JSDoc pasa a seis).
- `ADMIN_EXCLUDED_PERMISSIONS` gana los dos.
- `company-addons.ts > CORE_PERMISSIONS` gana los dos (partición `CORE ∪ ADDON = PERMISSIONS`).
- `identity/index.ts` exporta `requirePlatformPermission` (hoy solo el tipo `PlatformActor`).
- `seed-initial-access.ts` no cambia de código: deriva de las constantes.

### 5.2 `getAiModelPairs` y `saveAiModelPair`

Tipos de dominio (`domain/ai-model-pair.ts`):

```ts
export const AI_MODEL_ROLES = ['AGENT', 'ROUTER'] as const;
export type AiModelRole = (typeof AI_MODEL_ROLES)[number];
export type AiModelPair = {
  readonly provider: AiProviderCode; readonly role: AiModelRole;
  readonly primaryModelId: string; readonly fallbackModelId: string;
  readonly updatedBy: string | null; readonly updatedAt: Date;
};
/** Pura: lista de problemas de un par contra el catálogo de su proveedor (R10, R11). */
export function aiModelPairProblems(entry: AiProviderEntry, role: AiModelRole,
  primaryModelId: string, fallbackModelId: string): readonly string[];
```

Puerto `ports/ai-model-pair-repository.ts`: `list(): Promise<readonly AiModelPair[]>`,
`get(provider, role): Promise<AiModelPair | null>`, `save(pair, actorId): Promise<AiModelPair>`
(upsert por `(provider, role)` que pone `updated_by` y `updated_at`).

**`getAiModelPairs(actor)`** (R13–R15):
1. `requirePlatformPermission(actor, 'modelos_ia.consultar')`.
2. `catalog.list()` y `pairs.list()`.
3. Devuelve `{ providers: [{ code, name, models: AiModelOption[], agent: AiModelPair | null,
   router: AiModelPair | null }] }` en el orden del catálogo.

**`saveAiModelPair(input, actor)`** (R10–R13, R15):
1. `requirePlatformPermission(actor, 'modelos_ia.modificar')` — antes de validar y de tocar puertos.
2. zod (`domain/ai-model-pair-input.ts`): `{ provider: AiProviderCode, role: AiModelRole,
   primaryModelId: string, fallbackModelId: string }`, cadenas recortadas no vacías.
3. `catalog.get(provider)`; sin entrada → `ValidationError`.
4. `aiModelPairProblems(...)`: cada modelo en `entry.models`, distintos, ambos `supportsTools`, y si
   `role === 'ROUTER'`, el principal `isEconomic`. **El respaldo no se mira por económico** (R11). Con
   problemas → `ValidationError` sin escribir.
5. `pairs.save(..., actor.id)` y devuelve `{ status: 'saved', pair }`.

Sin consulta al proveedor: el Maestro no tiene key y los pares valen para todas las empresas (R15).
Sin Server Action (D7): la añade QT-311.

### 5.3 Resolución del modelo (`domain/resolve-conversation-model.ts`, interno)

```ts
type ConversationModelResolution =
  | { status: 'missing' } | { status: 'unreadable' } | { status: 'no_model_pair' }
  | { status: 'ready';
      primary: ModelTarget & { supportsTools: boolean };
      fallback: ModelTarget & { supportsTools: boolean } };
```

1. Conexión de la empresa; sin ella → `missing` (R20).
2. Descifra la key con `decryptStoredKey`; `SecretUnreadableError` → `unreadable` (R20). No marca la
   conexión (R46).
3. `pairs.get(connection.provider, role)`; nulo → `no_model_pair` (R19).
4. `catalog.get(provider)` para las marcas `supportsTools` de los dos modelos. Un modelo del par que
   ya no esté en el catálogo no puede pasar (FK, R9).
5. `connection.model` (la elección de la empresa) **no se lee** (R18).

En uso no se vuelve a comprobar «económico»: es política de coste del Maestro, ya validada al
guardar. «Herramientas» sí (R21, R27), porque sin ella la llamada fallaría.

`resolveAiProviderForReading` no cambia (R49).

### 5.4 Respaldo (`domain/model-fallback.ts`, D9)

Función pura `shouldFallBack(failure: AiProviderFailure): boolean`:

| `failure.kind` | ¿Respaldo? | R |
|---|---|---|
| `model_unavailable` (404 o modelo inválido de OpenRouter) | sí | R23 |
| `unreachable` (sin respuesta, aborto, plazo) | sí | R23 |
| `unexpected` con `httpStatus` ∈ `OVERLOAD_STATUSES` = {503, 529} (P9) | sí | R23 |
| `unexpected` con otro código o sin código | no | R24 |
| `rejected_key` | no | R24 |
| `quota` (402, 429) | no | R24 |

Y el orquestador de intentos, usado por los dos casos de uso:

1. Llama al puerto con el principal.
2. Si el resultado es `failed` y `shouldFallBack(failure)` y **ninguna** `toolCalls[i].executed`
   (R26, P8) y (sin herramientas pedidas o `fallback.supportsTools`) (R27) → llama **una** vez con el
   respaldo, misma entrada (R23). Si no → devuelve el resultado del principal.
3. El resultado del respaldo se devuelve tal cual, falle o no (R25).
4. `step_limit`, `empty_reply` e `invalid_output` nunca disparan el respaldo (R24).

**Plazo por intento**: cada llamada recibe el `timeoutMs` completo; el peor caso es `2 × timeoutMs`.
QT-307 lo sabe al fijar el suyo.

### 5.5 `generateAgentText` y `generateAgentObject`

```ts
generateAgentText(companyId: string, request: {
  role: AiModelRole; system: string; turns: ConversationTurn[];
  tools: ConversationalTool[]; maxSteps: number; timeoutMs: number;
}): Promise<AgentTextResult>
// AgentTextResult =
//   | (TextGeneration & { model: string; fallbackFrom: AiProviderFailure | null })   (R28)
//   | { status: 'missing' | 'unreadable' | 'no_model_pair' | 'model_without_tools' }

generateAgentObject<T>(companyId: string, request: {
  role: AiModelRole; system: string; turns: ConversationTurn[];
  schema: z.ZodType<T>; timeoutMs: number;
}): Promise<AgentObjectResult<T>>   // mismo envoltorio `model` + `fallbackFrom`
```

- Valida §4.2 antes de leer la conexión (R37).
- `tools.length > 0 && !primary.supportsTools` → `model_without_tools` sin llamar (R21).
- `generateAgentObject` pasa al puerto sin herramientas (R40) y **vuelve a validar** con
  `schema.safeParse` (R38): si el adaptador devolviera algo que no cumple, sale `invalid_output`
  (R39). Sin herramientas, R26 no aplica.
- No llama a `connections.update` (R46). El `failure` sale tal cual para que QT-307 decida si llama a
  `reportAiProviderOutcome` (D11, R45).

### 5.6 Cambios en código existente de `integraciones`

- `AiModelOption` gana `supportsTools` e `isEconomic`; `ai-provider-catalog-prisma.ts` los
  selecciona (R4). `ai-provider-actions.ts > toModelOptionState` copia campo a campo y por eso no los
  saca a la pantalla de la empresa: no se toca.
- Los dobles de `tests/unit/integraciones/ai-provider/ai-provider-doubles.ts` ganan las dos marcas.
- Nada más del flujo de conexión cambia.

## 6. Clasificación de fallos (R44, R45)

La misma tabla que la lectura de PDF, por proveedor. El adaptador la aplica sobre el error del AI SDK
(`APICallError`: código HTTP en `statusCode`, cuerpo en `responseBody` — **nombres a verificar en
T4.2 contra los tipos instalados**). Del cuerpo solo se mira lo que la tabla dice, y nada de él sale.

| Situación | ANTHROPIC | GOOGLE | OPENAI | OPENROUTER |
|---|---|---|---|---|
| 401 / 403 | `rejected_key` | `rejected_key` | `rejected_key` | `rejected_key` |
| 400 con `API_KEY_INVALID` en el cuerpo | — | `rejected_key` | — | — |
| 402 | `unexpected` | `quota` | `quota` | `quota` |
| 429 | `quota` | `quota` | `quota` | `quota` |
| 404 (con modelo) | `model_unavailable` | `model_unavailable` | `model_unavailable` | `model_unavailable` |
| 400 con mensaje exacto `<modelo> is not a valid model ID` | — | — | — | `model_unavailable` |
| Sin respuesta, aborto o plazo (R43) | `unreachable` | `unreachable` | `unreachable` | `unreachable` |
| Cualquier otro (incluidos 5xx) | `unexpected` + código | `unexpected` + código | `unexpected` + código | `unexpected` + código |

La tabla **no cambia** respecto a la lectura de PDF: la sobrecarga (503/529, P9) sigue siendo
`unexpected` con su `httpStatus`; la reconoce `shouldFallBack` (§5.4). Así el tipo
`AiProviderFailure` y `reportAiProviderOutcome` no cambian (R45).

`classifyAiSdkError(error, provider, model)` es pura y exportada para probarla sin red.

Errores que **no** son del proveedor:
- Salida estructurada que no valida (en el SDK, `NoObjectGeneratedError` — **a verificar en T4.2**)
  → `invalid_output`, no `failed`.
- Entrada de herramienta inválida o herramienta desconocida (R31, R32) → la llamada consta
  `ok: false, executed: false`. **Cómo** las expone el SDK (partes `tool-error` en los pasos o
  excepción `InvalidToolInputError`/`NoSuchToolError`) se verifica en T4.2. Si el SDK lanzara en vez
  de seguir, el adaptador lo convierte en `failed` con `unexpected`; si eso obliga a cambiar el
  puerto, se para y se pregunta.
- Excepción de `execute` (R33): el adaptador envuelve cada `execute` en un `try/catch` propio que
  devuelve al modelo `{ error: 'tool_failed' }` y anota `ok: false, executed: true`.

## 7. El adaptador del AI SDK

Archivos (los únicos que importan `ai` o `@ai-sdk/*`, R47):

- `adapters/driven/ai/conversational-model-ai-sdk.ts`: implementa `ConversationalModel`, traduce
  herramientas y turnos, aplica `maxRetries: 0` (R42), `abortSignal: AbortSignal.timeout(timeoutMs)`
  (R43), el tope de pasos (R34), el envoltorio de `execute` (R33, `executed`) y
  `classifyAiSdkError` (§6).
- `adapters/driven/ai/ai-sdk-models.ts`: `Record<AiProviderCode, (target) => LanguageModel>`, para
  que un proveedor nuevo sin implementación no compile (R41):
  - `ANTHROPIC` → `createAnthropic({ apiKey })(model)`.
  - `GOOGLE` → `createGoogleGenerativeAI({ apiKey })(model)`.
  - `OPENAI` → `createOpenAI({ apiKey })(model)`.
  - `OPENROUTER` → `createOpenAI({ apiKey, baseURL: OPENROUTER_BASE_URL }).chat(model)`. La
    constante se declara en este archivo con el mismo valor que la de `documentos`
    (`https://openrouter.ai/api/v1`): un driven de otro módulo no se importa.

Versión fijada (D12): `ai@7.0.159` con `@ai-sdk/*@4`. Las firmas siguen **por verificar contra los
tipos instalados en T4.2**; si alguna no existe, se adapta el adaptador sin tocar el puerto:

| Necesidad | API esperada | Estado |
|---|---|---|
| Texto con herramientas y tope de pasos | `generateText({ model, system, messages, tools, stopWhen: stepCountIs(n), maxRetries, abortSignal })` | por verificar (T4.2) |
| Declarar una herramienta | `tool({ description, inputSchema, execute })` con un esquema zod | por verificar (T4.2) |
| Salida estructurada | `generateObject({ model, schema, ... })` o `generateText({ output: Output.object({ schema }) })` | por verificar cuál es la vigente en `ai@7` (T4.2) |
| Pasos y llamadas | `result.steps[].toolCalls` / `toolResults`, `result.text` | por verificar (T4.2) |
| Tokens | `result.totalUsage` o `result.usage` con `inputTokens`/`outputTokens` | por verificar (T4.2) |
| Error HTTP | `APICallError.isInstance(e)`, `e.statusCode`, `e.responseBody` | por verificar (T4.2) |
| Modelo simulado para tests | `MockLanguageModelV*` de `ai/test` | por verificar el sufijo (T4.2) |
| zod 4 | peer `zod ^3.25.76 \|\| ^4.1.8`; el repo usa `^4.4.3` | **verificado en T0** (2026-10-31) |
| Node | `engines.node >=22`; local 22.13.1, CI 24 | **verificado en T0** (2026-10-31) |
| Módulos | AI SDK 7 es ESM; el repo no declara `"type": "module"` | riesgo: confirmar en T4.1 con typecheck, `vitest` y `next build` |

`OPENROUTER_BASE_URL` es configuración de proveedor, no de entorno, igual que en `documentos`.

### 7.1 Cableado (`lib/composition/index.ts`)

```ts
const conversationalModel: ConversationalModel = createConversationalModelAiSdk();
const aiModelPairs: AiModelPairRepository = createAiModelPairPrisma(prisma);
const agentModelDeps = { ...aiProviderDeps, pairs: aiModelPairs, model: conversationalModel };
// entradas nuevas de la fachada `integraciones`:
//   getAiModelPairs:     createGetAiModelPairs({ catalog, pairs: aiModelPairs }),
//   saveAiModelPair:     createSaveAiModelPair({ catalog, pairs: aiModelPairs }),
//   generateAgentText:   createGenerateAgentText(agentModelDeps),
//   generateAgentObject: createGenerateAgentObject(agentModelDeps),
```

Sin doble E2E: no hay pantalla ni flujo que lo use. QT-311 y QT-307 lo añaden si lo piden.

## 8. Dependencias nuevas (D1, D12, R48) — se aprueban con este spec

| Paquete | Para qué | Qué código nos ahorra |
|---|---|---|
| `ai` | Núcleo: bucle de tool calling por pasos, validación de la entrada de cada herramienta con zod, salida estructurada validada, errores tipados, contabilidad de tokens. | El bucle «llamar → ejecutar herramientas → devolver resultados → volver a llamar» y la conversión zod → JSON Schema, escritos **tres veces** (`tool_use` de Anthropic, `function_call` de OpenAI, `functionDeclarations` de Gemini) sobre los SDK que ya tenemos. |
| `@ai-sdk/anthropic` | Proveedor Anthropic para `ai`. | La traducción a la Messages API con herramientas. |
| `@ai-sdk/openai` | Proveedor OpenAI y, con `baseURL`, OpenRouter. | La traducción a Chat Completions con herramientas. |
| `@ai-sdk/google` | Proveedor Gemini para `ai`. | La traducción a `generateContent` con `functionDeclarations`. |

**Los cuatro checks, verificados por el leader con red el 2026-10-31 (T0)**
(`progress/features/QT-304.md > Decisiones`):

| Paquete | Versión (latest) | `deprecated` | Última publicación | Licencia | Descargas/semana |
|---|---|---|---|---|---|
| `ai` | 7.0.159 | no | 2026-10-30 | Apache-2.0 | 41,9 M |
| `@ai-sdk/anthropic` | 4.0.94 | no | 2026-10-30 | Apache-2.0 | 20,3 M |
| `@ai-sdk/openai` | 4.0.106 | no | 2026-10-30 | Apache-2.0 | 21,4 M |
| `@ai-sdk/google` | 4.0.109 | no | 2026-10-30 | Apache-2.0 | 12,2 M |

Serie `ai@7` + `@ai-sdk/*@4` (no `ai@6`/`@3`). Rango en `package.json`: `^` sobre la versión
fijada, como el resto. Peer `zod ^3.25.76 || ^4.1.8` (repo `^4.4.3`) y `engines.node >=22`:
compatibles. Riesgo abierto: ESM-only (§7, T4.1).

**Filas propuestas para `docs/dependencias.md`** (las escribe el implementer en T4.1, **después**
de la aprobación humana; `<fecha F1.4>` es la fecha de esa aprobación):

| Paquete | Para qué | Estado | Fecha | Notas |
| --- | --- | --- | --- | --- |
| `ai` | Núcleo del AI SDK de Vercel para el agente de WhatsApp (QT-304): tool calling por pasos, salida estructurada validada con zod, errores tipados y tokens. La alternativa es el bucle de herramientas a mano, tres veces, sobre `@anthropic-ai/sdk`, `openai` y `@google/genai` | aprobada | `<fecha F1.4>` | **Los cuatro checks**, verificados el 2026-10-31: `deprecated` no; última release **`7.0.159` del 2026-10-30**; **41,9 M** descargas semanales; licencia **Apache-2.0**. Peer `zod ^3.25.76 \|\| ^4.1.8`, `engines.node >=22`. Aprobada por el humano con el spec de QT-304 (F1.4). **Aislada** en `lib/modules/integraciones/adapters/driven/ai/conversational-model-ai-sdk.ts` y `ai-sdk-models.ts`, detrás del puerto `ConversationalModel`; lo vigila `tests/unit/integraciones/agente/ai-sdk-isolation.test.ts`. **No sustituye** a `@anthropic-ai/sdk`, `openai` ni `@google/genai`: la lectura de PDF y la prueba de conexión siguen con ellos. Descartadas: bucle propio sobre los SDK actuales; `@openrouter/ai-sdk-provider` y `@ai-sdk/openai-compatible` para OpenRouter (`specs/QT-304-tool-calling-con-ai-sdk/design.md > 9`) |
| `@ai-sdk/anthropic` | Proveedor Anthropic del AI SDK (QT-304) | aprobada | `<fecha F1.4>` | Checks del 2026-10-31: `deprecated` no; última release **`4.0.94` del 2026-10-30**; **20,3 M** descargas semanales; licencia **Apache-2.0**. Misma aislación y misma serie (`@ai-sdk/*@4` con `ai@7`) |
| `@ai-sdk/openai` | Proveedor OpenAI del AI SDK y, con `baseURL`, OpenRouter (QT-304) | aprobada | `<fecha F1.4>` | Checks del 2026-10-31: `deprecated` no; última release **`4.0.106` del 2026-10-30**; **21,4 M** descargas semanales; licencia **Apache-2.0**. Ídem |
| `@ai-sdk/google` | Proveedor Gemini del AI SDK (QT-304) | aprobada | `<fecha F1.4>` | Checks del 2026-10-31: `deprecated` no; última release **`4.0.109` del 2026-10-30**; **12,2 M** descargas semanales; licencia **Apache-2.0**. Ídem |

Transitivas (`@ai-sdk/provider`, `@ai-sdk/provider-utils` y las que aparezcan al instalar) **no
llevan fila**, con el mismo criterio que `@tanstack/react-store` y `date-fns`.

`tests/guards/guard-identificador-de-request.test.ts > DEPENDENCIAS_ESPERADAS` pasa de 45 a 49, con
su línea de historia.

## 9. Alternativas descartadas

### 9.1 Bucle de herramientas propio sobre los tres SDK que ya están aprobados

Sin dependencia nueva: un adaptador por proveedor con su formato de herramientas, `z.toJSONSchema` y
el bucle de pasos. **Descartada**: D1 la cerró el humano, y son tres implementaciones del mismo
bucle, con tres formatos, tres contabilidades de tokens y tres formas de forzar salida
estructurada. Es lo que `docs/architecture.md > Dependencias de terceros` pide no reinventar.

### 9.2 `@openrouter/ai-sdk-provider` o `@ai-sdk/openai-compatible` para OpenRouter

**Descartadas por ahora**: cada una es una fila y un paquete más para algo que `@ai-sdk/openai` con
`baseURL` y `.chat()` ya cubre, y es como hoy se conecta OpenRouter. **Salida identificada**: si T4
muestra que `@ai-sdk/openai` no hace tool calling o salida estructurada con OpenRouter, se propone
`@openrouter/ai-sdk-provider` (con sus cuatro checks) y se para a preguntar.

### 9.3 Trigger en la base para «admite herramientas» y «principal del enrutador económico»

Un trigger `BEFORE INSERT OR UPDATE` en `ai_agent_model_pairs` que mire las marcas de `ai_models`.
**Descartado**: también habría que vigilar el cambio de las marcas en el catálogo (otro trigger), y
el repo no usa triggers para reglas de negocio (la frontera es el caso de uso,
`docs/architecture.md > Acceso a datos y autorizacion`). Lo cubren `saveAiModelPair` (R10) y la
comprobación de herramientas en cada uso (R21, R27).

### 9.4 Respaldo dentro del adaptador (o `maxRetries` del SDK)

Que el adaptador recibiera los dos modelos y cambiara solo. **Descartado**: mezclaría la política
(D9: qué fallos cambian de modelo, P8) con la traducción al SDK, y solo se podría probar con el
modelo simulado del SDK. En dominio es una función pura más un orquestador probados con un puerto
simulado, y el adaptador mantiene `maxRetries: 0` (R42).

### 9.5 Columnas de par en `ai_providers` en vez de tabla propia

Cuatro columnas (`agent_primary`, `agent_fallback`, `router_primary`, `router_fallback`) en
`ai_providers`. **Descartado**: duplica la estructura por rol, complica las FK (cuatro compuestas en
la misma tabla) y el autor/fecha serían por proveedor y no por par. La tabla `(provider, role)` deja
un rol nuevo en una fila más y un valor más del enum.

### 9.6 Exponer la key resuelta a QT-307 (como `resolveAiProviderForReading`)

**Descartado** para la conversación: los casos de uso llaman al puerto ellos mismos, así la key no
sale del módulo (R22) y QT-306/QT-307 no tocan secretos.

## 10. Tests

| Archivo | Qué prueba | R |
|---|---|---|
| `tests/integration/integraciones/ai-agent-model-pairs-migration.int.test.ts` | Columnas y valores de §3.1; tabla, PK, FK (otro proveedor, fuera de catálogo), CHECK principal ≠ respaldo, `DELETE` de un modelo en uso → `23503`; los ocho pares de §3.2 sin autor, con el respaldo no económico de ANTHROPIC fijado; `down.sql` deja esquema y datos previos | R1–R3, R5–R9 |
| `tests/unit/integraciones/schema/ai-agent-model-pairs-migration.test.ts` | Estático: literales de §3.1 y §3.2 en el SQL, RLS `ENABLE` + `FORCE` sin policies, `down.sql` inverso | R2, R3, R8 |
| `tests/integration/integraciones/ai-provider-connection-prisma.int.test.ts` (ampliado) | El catálogo trae las dos marcas | R4 |
| `tests/integration/integraciones/ai-model-pair-prisma.int.test.ts` | `list`, `get`, `save` (upsert con autor y fecha; los demás pares intactos) | R5, R12 |
| `tests/unit/integraciones/agente/ai-model-pair-rules.test.ts` | `aiModelPairProblems`: fuera de catálogo, iguales, sin herramientas, principal de enrutador no económico, respaldo de enrutador no económico aceptado | R10, R11 |
| `tests/unit/integraciones/agente/save-ai-model-pair.test.ts` | Permiso (sin permiso, actor nulo, permiso de consulta no basta), sin empresa aceptado, validación sin escribir, guarda con autor, sin probe ni cipher | R10–R13, R15 |
| `tests/unit/integraciones/agente/get-ai-model-pairs.test.ts` | Permiso; proveedores en orden con sus dos pares o «sin par» y marcas; sin probe ni cipher | R13–R15 |
| `tests/unit/identity/schema/ai-agent-model-pairs-permissions-migration.test.ts` | Literales = `PERMISSIONS`, solo Maestro, `ON CONFLICT DO NOTHING`, down exacto | R16, R17 |
| `tests/integration/identity/ai-agent-model-pairs-permissions-migration.int.test.ts` | Crea y asigna solo al Maestro; segunda aplicación sin cambios; down | R17 |
| `tests/unit/identity/permissions.test.ts` (ampliado) | Catálogo, Maestro, excluidos del Administrador | R16 |
| `tests/unit/integraciones/agente/model-fallback.test.ts` | `shouldFallBack` fila a fila de §5.4: 404, modelo inválido OpenRouter, `unreachable`, 503, 529, 500/502/504, 401, 403, 402, 429, `unexpected` sin código | R23, R24 |
| `tests/unit/integraciones/agente/generate-agent-text.test.ts` | Puerto simulado: par por rol y proveedor, `connection.model` ignorado, `no_model_pair`, `missing`, `unreadable`, `model_without_tools`, validaciones §4.2, la key no sale, sin `update`; respaldo: un caso por motivo de D9 (sí y no), un solo intento extra, fallo del respaldo devuelto, herramienta ejecutada bloquea, respaldo sin herramientas bloquea, `step_limit`/`empty_reply` no pasan, `model` y `fallbackFrom` | R18–R28, R34, R37, R46 |
| `tests/unit/integraciones/agente/generate-agent-object.test.ts` | Puerto simulado: valor validado, re-validación, sin herramientas, respaldo por `unreachable`, `invalid_output` no pasa al respaldo | R23, R24, R38–R40 |
| `tests/unit/integraciones/agente/conversational-model-ai-sdk.test.ts` | Con el modelo simulado de `ai/test`: herramientas ofrecidas, ejecución con entrada validada, entrada inválida, herramienta desconocida, excepción en `execute` (`executed: true`), tope de pasos, respuesta vacía, tokens y pasos, salida estructurada inválida, sin reintentos, plazo | R29–R36, R39, R42, R43 |
| `tests/unit/integraciones/agente/classify-ai-sdk-error.test.ts` | La tabla de §6 caso por caso, 503/529 como `unexpected` con código; el fallo no lleva texto del proveedor | R44, R45 |
| `tests/unit/integraciones/agente/ai-sdk-models.test.ts` | Un constructor por código de proveedor; OpenRouter con la URL de OpenRouter | R41 |
| `tests/unit/integraciones/agente/ai-sdk-isolation.test.ts` | Barrido de `lib/`, `app/`, `components/`, `scripts/`: solo los dos archivos de §7 importan `ai`/`@ai-sdk/*`; `documentos` no | R47, R49 |
| `tests/unit/documentos/run-document-job-ai-provider.test.ts` (sin cambios) | La lectura sigue con `connection.model` | R49 |
| `tests/guards/guard-dependencias-aprobadas.test.ts` (sin cambios) | Las cuatro filas existen | R48 |

Tests que se tocan por arrastre (fijan a mano el catálogo de permisos, el Maestro o las exentas;
mismo criterio que QC-182 §6): `tests/unit/identity/seed/seed-initial-access.test.ts`,
`tests/unit/navegacion/qc75-convenciones.test.ts`,
`tests/unit/asignaciones/schema/order-assignments-migration.test.ts`,
`tests/unit/identity/addons/company-addons.test.ts`,
`tests/integration/identity/identity-seed.int.test.ts`, `tests/guards/guard-empresa-en-esquema.test.ts`,
`tests/guards/guard-identificador-de-request.test.ts`, `tests/integration/aislamiento.json`. Si
aparece otro, se amplía igual y se anota en `progress/impl_QT-304.md`.

## 11. Riesgos y desconocidos

- **Firmas del AI SDK de §7 sin verificar** contra los tipos de `ai@7`: T4.2 va antes del adaptador.
- **ESM-only**: AI SDK 7 es ESM y el repo no declara `"type": "module"`. Next y vitest lo resuelven
  en principio; se confirma en T4.1 (typecheck, `vitest`, `next build`). Si falla, se para.
- **P8 y P9 abiertas**: el spec está escrito con su propuesta; cambiarlas solo toca §5.4 y su test.
- **Plazo por intento**: con respaldo, una generación puede tardar hasta `2 × timeoutMs`.
- **Tool calling por OpenRouter con `@ai-sdk/openai`**: verificado que los modelos admiten `tools` en
  OpenRouter (D5); falta comprobar en T4 que `.chat()` los envía bien.
- **Coste**: esta ficha no limita uso; los topes son de QT-307 (D2 de QT-303).
- **QT-292**: al editar el catálogo deberá respetar las FK de los pares (R9) y las marcas.
