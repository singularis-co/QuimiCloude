# QC-275 — proveedor-ia-propio · design.md

> Zona: `fullstack` · Complejidad: `high` · depends_on: QC-234 (hecha) · Rama:
> `feature/QC-275-proveedor-ia-propio`
>
> El **qué** está en `requirements.md` (R1–R44, decisiones D1–D11 por el orden de su tabla). Aquí va
> el **cómo**. Precedentes que se copian:
>
> - **QC-237** (`specs/QC-237-conexion-whatsapp-por-empresa/`, ya en `dev`): conexión por empresa,
>   prueba antes de guardar, estado `ERROR` con `lastError`, secretos nunca devueltos, actor y
>   `requirePermission` de `integraciones`, `company-scope.ts`, Server Actions con `currentActor()`
>   dentro de `runInRequestScope`, dobles de E2E con `INTEGRATIONS_E2E_DOUBLES`.
> - **QC-234**: `SecretCipher`, `SecretContext`, `SecretUnreadableError`.
> - **QC-108 / QC-111 / QC-110 / QC-158 / QC-159**: el puerto `AiReader`, los adaptadores de Claude y
>   Gemini, la cola (`runDocumentJob`) y la clasificación de fallos (`failure-kind.ts`).
>
> **Diseño aprobado** (pase `/design`, D10): `docs/diseno/canvas/ProveedorIA.dc.html`,
> `docs/diseno/canvas/ProveedorIATablet.dc.html` y `docs/diseno/canvas/ProveedorIAMovil.dc.html`.
> Incluyen la pantalla en sus tres estados (Sin configurar, Conectado, Error), la confirmación de
> desconectar y el aviso de bloqueo donde se sube un PDF.
>
> **Regla transversal.** Manda `docs/conventions.md > Comentarios`: ningún comentario nuevo cita
> `QC-<n>`, `R<n>`, `design.md` ni «decisión cerrada». En los tests, `R<n>` va en el nombre del caso.
> Ningún identificador nuevo lleva `password`/`pass` (`guard-password-never-plaintext`): el campo se
> llama `apiKey`.

---

## Lo que ya existe

Buscado `proveedor IA`/`AI provider`, `api key`/`apiKey`/`api_key`, `ai_provider`, `AiReader`,
`ANTHROPIC_API_KEY`/`GEMINI_API_KEY`, `openai`/`openrouter` y «respaldo» en tres sitios:

- `feature_list.json` (todos los estados), por `name` y `description`;
- `specs/` con grep (`AiProvider`, `ai_provider`, `api_key_enc`: solo la página cascarón de QC-222);
- el código, con Grep/Read sobre `lib/`, `app/`, `components/`, `db/`, `tests/`, `e2e/` y `scripts/`.
  **El MCP del grafo no se consultó** en esta sesión (no estaba entre las herramientas cargadas del
  agente); la búsqueda de código fue con Grep/Read.

| Apareció | Qué es | Qué se hace |
|---|---|---|
| QC-234 (`done`) | `integraciones.secretCipher`, `SecretContext`, `SecretUnreadableError` | **Se reutiliza entero** |
| QC-237 (en `dev`) | Módulo `integraciones` con actor, ámbito, `company-scope.ts`, `IntegracionesError`, dobles por `INTEGRATIONS_E2E_DOUBLES`, patrón de pantalla | **Se reutilizan** actor, ámbito, errores, lector de dobles y el patrón. No se toca nada de WhatsApp |
| QC-221 / QC-222 (`done`) | Permiso `integraciones.modificar`, `AI_PROVIDER_INTEGRATION_ROUTE`, ítem de menú y `app/(private)/integraciones/proveedor-ia/page.tsx` (cascarón con `IntegrationPlaceholder`) | La página **se reescribe**. Permiso, ruta y menú **no se tocan** (R44) |
| `lib/modules/documentos/ports/ai-reader.ts` (`AiReader`) | Puerto de la lectura con IA | **No cambia** |
| `adapters/driven/ai/ai-reader-anthropic.ts`, `ai-reader-genai.ts` | Únicos archivos que importan `@anthropic-ai/sdk` y `@google/genai`; leen la key del entorno | **Se reescriben** para recibir la key y el modelo por parámetro y ganar la prueba (§7) |
| `adapters/driven/ai/ai-reader-canned.ts` | Doble de guion de la lectura | **No cambia** |
| `adapters/driven/config/ai-config-env.ts` | Lee `ANTHROPIC_*` y `GEMINI_*` | **Se borra** (D1, §9) |
| `lib/composition/index.ts` l. 1993-2080 | `aiReader` global (Claude o doble), `readPdfWithAi`, `processPdfByStrategy` y `cropCatalogImages` construidos una vez | **Se reemplaza** por la resolución por empresa y uso (§8) |
| `domain/run-document-job.ts`, `failure-kind.ts`, `issue-upload-links.ts` | Trabajo de la cola, clasificación, emisión de enlaces | **Se amplían** (§6) |
| `components/shared/document-upload/` (`DocumentUploadDialog`) | Subida de PDF compartida por Fórmulas y el detalle de proveedor | **No cambia**; el aviso de bloqueo va en su lugar (§12.6) |
| QC-175 (`pending`) | Respaldo de Gemini por variable de entorno | Pierde su base con D1; **pregunta abierta** del humano, no bloquea |
| QC-276 (`pending`) | Varios proveedores de respaldo | Fuera de alcance (D4). Frontera en §16 |
| QC-250 (`pending`) | Rotación de la clave de cifrado | Fuera de alcance. Lee la versión del prefijo `v<n>:` de `api_key_enc`, como en QC-237 |

**Componentes** (`components/shared/CATALOGO.md`, regla de decisión de `docs/perfil-agentes.md`):

| Fila consultada | Uso | Paso |
|---|---|---|
| `Card` | Tarjeta del formulario y de la conexión | 1, reutiliza |
| `PasswordField` (variante `secret`, `texts`) | Campo de la key con ojo («Mostrar la key» / «Ocultar la key») | 1, reutiliza |
| `Button`, `buttonVariants` (`touch`) | Acciones; enlace «Ir a Proveedor IA» | 1, reutiliza |
| `SubmitButton` | «Guardar y conectar» y «Probar conexión» con estado pendiente | 1, reutiliza |
| `ConfirmDialog` | Confirmación de «Desconectar» | 1, reutiliza |
| `StatusBadge` / `Badge` | «Sin configurar», «Conectado», «Error» | 1, reutiliza |
| `Notice` | Aviso «Error con tu proveedor» (`tone="danger"`) y aviso de bloqueo (`tone="info"`) | 1, reutiliza; el bloqueo **compone** (paso 3, abajo) |
| `Toaster` (`toast` de `sonner`) | «Proveedor IA conectado» / «desconectado» | 1, reutiliza |
| `PageHeader`, `PageShell` | Cabecera con miga «Integraciones» | 1, reutiliza |
| `ErrorState` | Error de carga de la página | 1, reutiliza |
| `DocumentUpload` | Botón «Subir PDFs» que el aviso reemplaza | 1, sin cambios |

Piezas nuevas:

- `AiProviderPicker` (grupo de opciones con logo), `AiProviderForm`, `AiProviderCard` y
  `AiProviderLogo`, en `app/(private)/integraciones/proveedor-ia/components/`: **paso 3** (componen
  `Card`, `PasswordField`, `Button`, `Notice`, `Badge`). Tablero: los tres de arriba.
- `AiProviderRequiredNotice` en `components/shared/`: **paso 3** (compone `Notice` y un enlace con
  `buttonVariants`). **Sube a `shared` desde el primer commit** porque lo consumen **dos rutas** en
  esta misma ficha (Fórmulas y el detalle de proveedor), y gana su fila en `CATALOGO.md`. Tablero:
  `ProveedorIA.dc.html` (bloque «Así se ve el bloqueo…»).

Conclusión: no existe nada que resuelva parte del alcance; se sigue reutilizando lo de arriba.

---

## 1. Qué cambia (resumen)

```
db/schema.prisma                                       ← enum AiProviderCode, AiProviderConnectionStatus; modelos AiProvider y AiProviderConnection
db/migrations/20261013150000_ai_providers/{migration,down}.sql
lib/modules/integraciones/
  index.ts                                             ← + tipos, fallo de proveedor y fábricas
  domain/
    ai-provider.ts                                     ← códigos, estados, catálogo, fila, vista
    ai-provider-failure.ts                             ← tipo del fallo y mensajes (§4.4)
    ai-provider-input.ts                               ← zod de probar y guardar
    get-ai-provider-connection.ts
    test-ai-provider-key.ts                            ← probar una key escrita, sin escribir
    test-saved-ai-provider.ts                          ← probar la guardada
    save-ai-provider-connection.ts
    disconnect-ai-provider.ts
    get-ai-provider-readiness.ts                       ← ¿hay conexión? ¿puede configurarla?
    resolve-ai-provider-for-reading.ts                 ← sistema: proveedor, modelo y key descifrada
    report-ai-provider-outcome.ts                      ← sistema: fallo de cuenta / recuperación
    actor.ts                                           ← + hasConfigurePermission
  ports/
    ai-provider-connection-repository.ts
    ai-provider-catalog.ts
    ai-provider-probe.ts
  adapters/driven/
    persistence/ai-provider-connection-prisma.ts
    catalog/ai-provider-catalog-prisma.ts              ← tabla global: fuera de persistence/ (§5.2)
    ai/ai-provider-probe-canned.ts                     ← doble E2E
  adapters/driving/ai-provider-actions.ts              ← 'use server'
lib/modules/documentos/
  index.ts                                             ← + AiProviderGateway, AiReadUse, errores nuevos
  domain/errors.ts                                     ← + AiProviderMissingError, AiProviderError
  domain/ai-read-use.ts                                ← estrategia → uso
  domain/failure-kind.ts                               ← + dos códigos, definitivos
  domain/issue-upload-links.ts                         ← + comprobación de conexión
  domain/run-document-job.ts                           ← resuelve el lector por empresa y uso, informa el desenlace
  ports/ai-provider-gateway.ts
  adapters/driven/ai/ai-reader-anthropic.ts            ← reescrito: config por parámetro + prueba + clasificación
  adapters/driven/ai/ai-reader-genai.ts                ← ídem
  adapters/driven/ai/ai-reader-openai.ts               ← nuevo: OpenAI y OpenRouter (SDK `openai`)
  adapters/driven/config/ai-config-env.ts              ← BORRADO
lib/composition/index.ts                               ← resolución por empresa y uso; amplía `integraciones`
lib/modules/errores/domain/{error-codes,error-catalog}.ts ← + 2 códigos
app/(private)/integraciones/proveedor-ia/page.tsx      ← reescrita
app/(private)/integraciones/proveedor-ia/components/*  ← nuevos (§12)
app/(private)/produccion/formulas/page.tsx             ← aviso de bloqueo
app/(private)/proveedores/[id]/page.tsx                ← aviso de bloqueo
components/shared/ai-provider-required-notice.tsx (+ index, CATALOGO.md)
public/brand/ai-providers/{anthropic,google,openai,openrouter}.svg   ← [POR CONFIRMAR] §12.5
.env.example, docs/architecture.md, docs/dependencias.md, package.json, pnpm-lock.yaml
tests/**, e2e/**                                       ← §15
```

---

## 2. Modelo de datos

### 2.1 Prisma

```prisma
enum AiProviderCode {
  ANTHROPIC
  GOOGLE
  OPENAI
  OPENROUTER
  @@map("ai_provider_code")
}

enum AiProviderConnectionStatus {
  ACTIVE
  ERROR
  @@map("ai_provider_connection_status")
}

/// <comentario corto: catálogo global sembrado por migración; los modelos se cambian con otra migración>
/// @module integraciones
model AiProvider {
  code         AiProviderCode @id
  name         String
  recipeModel  String         @map("recipe_model")
  catalogModel String         @map("catalog_model")
  sortOrder    Int            @map("sort_order")

  @@map("ai_providers")
}

/// <comentario corto: una por empresa; FK de drift escritas en la migración>
/// @module integraciones
model AiProviderConnection {
  id            String                     @id @db.Uuid
  companyId     String                     @unique(map: "ai_provider_connections_company_id_key") @map("company_id") @db.Uuid
  provider      AiProviderCode
  apiKeyEnc     String                     @map("api_key_enc")
  status        AiProviderConnectionStatus @default(ACTIVE)
  lastError     String?                    @map("last_error")
  lastErrorAt   DateTime?                  @map("last_error_at") @db.Timestamptz(6)
  lastCheckedAt DateTime?                  @map("last_checked_at") @db.Timestamptz(6)
  keyUpdatedAt  DateTime                   @map("key_updated_at") @db.Timestamptz(6)
  createdById   String                     @map("created_by") @db.Uuid
  updatedById   String                     @map("updated_by") @db.Uuid
  createdAt     DateTime                   @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt     DateTime                   @updatedAt @map("updated_at") @db.Timestamptz(6)

  @@index([provider], map: "ai_provider_connections_provider_idx")
  @@map("ai_provider_connections")
}
```

- **`id` sin default**, generado por la aplicación (`RandomSource.newId()`, ya existe): el
  `recordId` del contexto de cifrado tiene que existir antes de cifrar (QC-237 §2.1).
- **Sin `deletedAt`**: desconectar borra la fila (D6, «el secreto se borra físicamente»). Por eso el
  índice único de empresa es **total**, no parcial.
- **Sin `@relation`**: `company_id`, `created_by`, `updated_by` y `provider` son FK escritas a mano,
  como en `whatsapp_connections`.
- **`updatedById`**: la conexión cambia de manos (otro Administrador cambia la key o el proveedor) y
  la fila no tiene historial; `createdById` solo diría quién conectó la primera vez.
- **`keyUpdatedAt`** alimenta «Key guardada el <fecha> · cifrada» (R31): `updatedAt` cambia también
  con una prueba o un fallo en uso y mentiría.
- **Valores de enum en mayúscula**, como el resto del esquema.

### 2.2 Migración `20261013150000_ai_providers`

Escrita a mano (FK de drift, igual que `whatsapp_connections`). En orden:

1. Los dos `CREATE TYPE`.
2. `CREATE TABLE "ai_providers"`, con `CHECK (recipe_model <> '' AND catalog_model <> '')` (R4).
3. `INSERT INTO "ai_providers"` de las cuatro filas (§3), con `sort_order` 1–4 en el orden del
   tablero: Claude, Gemini, OpenAI, OpenRouter. **Nombres visibles**: `Claude`, `Gemini`, `OpenAI`,
   `OpenRouter`.
4. `CREATE TABLE "ai_provider_connections"`; `updated_at` sin default.
5. `CREATE UNIQUE INDEX "ai_provider_connections_company_id_key" ON (company_id)` (R5, D4).
6. FK `company_id → companies(id)`, `created_by` y `updated_by → users(id)` con
   `ON DELETE RESTRICT ON UPDATE CASCADE`; `provider → ai_providers(code)` con `ON DELETE RESTRICT`
   (R5: un proveedor con conexiones no se puede borrar del catálogo).
7. `CREATE INDEX "ai_provider_connections_provider_idx"`.
8. `ENABLE` + `FORCE ROW LEVEL SECURITY` en **las dos** tablas, sin policies, al final.

`down.sql`: `DROP TABLE "ai_provider_connections"`, `DROP TABLE "ai_providers"` y los dos `DROP TYPE`.

**Cambiar un modelo del catálogo después** = una migración nueva con `UPDATE "ai_providers" SET …`
y su `down.sql` con el valor anterior. Lo dice el comentario del modelo; no hay pantalla para eso
(«Elegir modelo a mano» no entra).

### 2.3 Guardias de esquema

- `ai_provider_connections` tiene `company_id`: la lista de exentas no cambia por ella.
- `ai_providers` **no** tiene `company_id`: es un catálogo global como `roles` y `permissions`. Entra
  en `EXENTAS` de `tests/guards/guard-empresa-en-esquema.test.ts` con motivo «catálogo de
  proveedores de IA, compartido por todas las empresas», y en el bullet de exentas de
  `docs/architecture.md > Dominio` n.º 1 (la guardia compara los dos).
- `guard-rls-force` ve las dos por la migración.

---

## 3. Modelos del seed (punto 1 del leader)

**Todos `[POR VERIFICAR]`.** Este spec se escribió **sin red** (ni documentación de los
proveedores ni registro de npm); el humano los cierra en F1.4 contra la documentación oficial y,
si cambian, se corrige esta tabla antes de T1. Requisito de cada modelo: aceptar PDF (uso receta,
modo `pdf`) e imágenes PNG (uso catálogo, modo `images`), que es lo que mandan los dos usos.

| Proveedor | Receta | Catálogo | Fuente que se pudo ver | Dónde se verifica |
|---|---|---|---|---|
| Claude (`ANTHROPIC`) | `claude-sonnet-5-5` `[POR VERIFICAR]` | `claude-sonnet-5-5` `[POR VERIFICAR]` | Tipo `Model` de `@anthropic-ai/sdk@0.131.0` (la versión instalada, publicada el 2026-09-30), que enumera entre otros `claude-sonnet-5-5`, `claude-opus-5-5` y `claude-haiku-4-5`; `.env.example` lo pone de ejemplo de `ANTHROPIC_MODEL`. **No es la documentación oficial** y el valor real de `ANTHROPIC_MODEL` en producción no se conoce aquí | docs.anthropic.com, «Models overview» |
| Gemini (`GOOGLE`) | `[POR VERIFICAR]` | `[POR VERIFICAR]` | Ninguna en el repo: `GEMINI_MODEL` no tiene valor versionado y `@google/genai` no enumera modelos. **Candidato natural:** el valor de `GEMINI_MODEL` que hoy tenga producción, que el humano conoce | ai.google.dev, «Gemini models» |
| OpenAI (`OPENAI`) | `[POR VERIFICAR]` | `[POR VERIFICAR]` | Ninguna (el SDK no está instalado) | platform.openai.com, «Models» (comprobar entrada de archivos PDF) |
| OpenRouter (`OPENROUTER`) | `[POR VERIFICAR]` | `[POR VERIFICAR]` | Ninguna. Los ids tienen la forma `<vendor>/<modelo>` | openrouter.ai/models (filtrar por entrada de archivo e imagen) |

Fecha de la propuesta: 2026-10-13. Receta y catálogo **pueden** ser el mismo id: el seed tiene las
dos columnas para poder separarlos sin otra ficha. Para Claude se propone el mismo en los dos usos
porque el catálogo (muchas imágenes, JSON largo) es el uso exigente y la receta no compensa un
segundo modelo sin datos de calidad; un modelo más barato para receta (`claude-haiku-4-5`) es una
opción que el humano puede elegir.

**Sin un id verificado no se escribe la migración** (T2 depende de que esta tabla esté cerrada).

---

## 4. Dominio de `integraciones`

### 4.1 Tipos (`domain/ai-provider.ts`)

```ts
export const AI_PROVIDER_CODES = ['ANTHROPIC', 'GOOGLE', 'OPENAI', 'OPENROUTER'] as const;
export type AiProviderCode = (typeof AI_PROVIDER_CODES)[number];
export type AiProviderConnectionStatus = 'ACTIVE' | 'ERROR';
export type AiReadUse = 'recipe' | 'catalog';

export type AiProviderEntry = {           // fila del catálogo
  code: AiProviderCode; name: string; recipeModel: string; catalogModel: string;
};

/** Lleva el valor cifrado: NUNCA sale del módulo. */
export type AiProviderConnectionRecord = {
  id: string; companyId: string; provider: AiProviderCode; apiKeyEnc: string;
  status: AiProviderConnectionStatus; lastError: string | null; lastErrorAt: Date | null;
  lastCheckedAt: Date | null; keyUpdatedAt: Date;
};

/** Lo único que sale hacia la UI (R8). Fechas en ISO. */
export type AiProviderConnectionView = {
  provider: AiProviderCode; providerName: string; recipeModel: string; catalogModel: string;
  status: AiProviderConnectionStatus; lastError: string | null; lastErrorAt: string | null;
  lastCheckedAt: string | null; keyUpdatedAt: string;
};

export function toAiProviderConnectionView(record, entry): AiProviderConnectionView; // campo a campo, sin spread
```

`AI_PROVIDER_CODES` es la lista cerrada del dominio: un código que el catálogo de la base no trae
o que no está aquí se trata como «fuera del catálogo» (R18).

### 4.2 Actor y ámbito

- Se reutiliza `requirePermission` (R1) e `IntegracionesScope` (R2).
- `actor.ts` gana `hasConfigurePermission(actor): boolean` para la consulta de R37 (no lanza). Así
  el código del permiso sigue escrito **solo** en `actor.ts` dentro del módulo (lo fija
  `module-shape.test.ts` R17).
- Los dos casos de uso **de sistema** (`resolveAiProviderForReading`, `reportAiProviderOutcome`) no
  reciben actor: reciben el `companyId` que salió del `claim` del archivo (R2), igual que
  `runDocumentJob` construye su ámbito. Construyen `IntegracionesScope` solo con ese valor.

### 4.3 Errores

No hay clases nuevas en `integraciones`: `UnauthorizedError` (R1), `ValidationError` (R18),
`SecretUnreadableError` (R9). Una prueba fallida **no es un error**, es un resultado
(`{ status: 'test_failed', message }`), por el mismo motivo que en QC-237 §3.3: el traductor toma el
texto del catálogo y aquí hay que mostrar el mensaje del proveedor.

Probar la guardada cuando ya no hay conexión (carrera con un «Desconectar» en otra pestaña) no abre
una clase de error para una carrera: `testSavedAiProvider` devuelve `{ status: 'not_connected' }` y
la pantalla recarga (`revalidatePath`), que ya pinta el formulario.

### 4.4 El fallo del proveedor (`domain/ai-provider-failure.ts`)

```ts
export type AiProviderFailureKind =
  | 'rejected_key' | 'quota' | 'model_unavailable' | 'unreachable' | 'unexpected';
export type AiProviderFailure = {
  kind: AiProviderFailureKind;
  httpStatus: number | null;
  model: string | null;            // solo en model_unavailable
};
export type AiProviderProbeResult =
  | { ok: true; elapsedMs: number }
  | { ok: false; failure: AiProviderFailure };

export function isAccountFailure(f: AiProviderFailure): boolean; // rejected_key | quota
export function probeFailureMessage(f: AiProviderFailure, providerName: string): string;
export function readingFailureMessage(f: AiProviderFailure, providerName: string): string;
export const UNREADABLE_KEY_MESSAGE = 'No se pudo leer la key guardada. Vuelve a escribirla.';
```

Los mensajes se **componen** con el tipo, el código y el nombre del proveedor del catálogo; el
texto libre del proveedor nunca entra (R11, R8: no hay nada que sanear porque nada llega). Textos
propuestos, se aprueban con el spec:

| `kind` | Prueba (R11) | Lectura (R25), tras «La última lectura falló: » |
|---|---|---|
| `rejected_key` | «Error con tu proveedor: la key fue rechazada. Revísala y vuelve a probar.» (texto del tablero) | «{Proveedor} rechazó la key ({status}).» (texto del tablero) |
| `quota` | «Error con tu proveedor: tu cuenta no tiene cuota o saldo disponible.» | «{Proveedor} indicó que tu cuenta no tiene cuota o saldo ({status}).» |
| `model_unavailable` | «Error con tu proveedor: tu cuenta no tiene acceso al modelo {model}.» | — (no marca, §7.4) |
| `unreachable` | «Error con tu proveedor: no respondió a tiempo. Vuelve a probar en unos minutos.» | — (no marca) |
| `unexpected` | «Error con tu proveedor: respondió con un error inesperado ({status o «sin código»}).» | — (no marca) |

### 4.5 Casos de uso

Fábricas `createX(deps)`; `deps`: `connections: AiProviderConnectionRepository`, `catalog:
AiProviderCatalog`, `probe: AiProviderProbe`, `cipher: SecretCipher`, `random: RandomSource`,
`now?: () => Date`. Las de actor abren con `requirePermission` (R1) **antes** de zod y de tocar un
puerto.

| Caso de uso | Firma | Pasos |
|---|---|---|
| `getAiProviderConnection` | `(actor) => { providers: AiProviderEntry[]; connection: AiProviderConnectionView \| null }` | `catalog.list()` (ordenado) + `connections.find(scope)` → vista. El catálogo va a la pantalla porque pinta los modelos de cada opción (R30) |
| `testAiProviderKey` | `(input{provider, apiKey}, actor) => TestResult` | zod (R18) → `catalog.get(provider)` o `ValidationError` → `probe.probe({provider, apiKey, models:[recipe, catalog]})` → `{status:'tested', ok:true, elapsedMs}` o `{status:'tested', ok:false, message}`. **Ninguna escritura** (R13) |
| `testSavedAiProvider` | `(actor) => TestResult \| {status:'not_connected'}` | `find(scope)` → `cipher.decrypt(apiKeyEnc, ctx)`; si lanza `SecretUnreadableError`: `update(ERROR, UNREADABLE_KEY_MESSAGE, lastErrorAt=now)` y relanza (R9) → prueba → buena: `ACTIVE`, `lastCheckedAt=now`, `lastError=null`, `lastErrorAt=null`; fallida: `ERROR`, `lastError=probeFailureMessage`, `lastErrorAt=now` (R14) |
| `saveAiProviderConnection` | `(input{provider, apiKey}, actor) => SaveResult` | zod (R18) → `catalog.get` → **prueba** (R15) → fallida: `{status:'test_failed', message}` sin escribir (R16) → buena: `existing = find(scope)`; `id = existing?.id ?? random.newId()`; `apiKeyEnc = encrypt(apiKey, {companyId, recordId:id, field:'api_key'})` (R7); `existing ? update(id, patch) : create(row)` con `ACTIVE`, `lastCheckedAt=keyUpdatedAt=now`, errores vacíos, `updatedById=actor.id` (y `createdById` al crear) (R17) → `{status:'saved', connection}`. **Carrera (R19):** si `create` choca con el índice único, el adaptador lanza `AiProviderConnectionRaceError` (interno, no publicado) y el caso de uso **repite una vez** el camino de `update` sobre la fila ganadora: vuelve a cifrar con **su** id, así el valor siempre casa con su contexto |
| `disconnectAiProvider` | `(actor) => {status:'disconnected'}` | `connections.delete(scope)`; idempotente (R20). Sin prueba ni proveedor |
| `getAiProviderReadiness` | `(actor) => { configured: boolean; canConfigure: boolean }` | **No** exige `integraciones.modificar` (la usa quien sube PDF): exige actor con empresa, si no `UnauthorizedError`. `configured = find(scope) !== null`; `canConfigure = hasConfigurePermission(actor)` (R37) |
| `resolveAiProviderForReading` | `(companyId, use) => ReadingResolution` | Sistema. `find({companyId})` → `null` ⇒ `{status:'missing'}`. `catalog.get(provider)` → modelo del uso **en ese momento** (R6). `decrypt` → ilegible ⇒ `update(ERROR, UNREADABLE_KEY_MESSAGE, now)` y `{status:'unreadable'}` (R9) → `{status:'ready', provider, model, apiKey, connectionStatus}` |
| `getAiProviderStatus` | `(companyId) => { provider; connectionStatus } \| null` | Sistema. Sin descifrar. Lo usan el doble de lectura (R41) y la emisión de enlaces (R23) |
| `reportAiProviderOutcome` | `(companyId, outcome: {kind:'account_failure', failure} \| {kind:'recovered'}) => void` | Sistema. `account_failure` ⇒ `ERROR`, `lastError = 'La última lectura falló: ' + readingFailureMessage(...)`, `lastErrorAt = now` (R25). `recovered` ⇒ solo si la fila está en `ERROR`: `ACTIVE`, errores vacíos (R27). Sin conexión (desconectada a mitad de lectura) no hace nada |

`ReadingResolution` lleva la key en claro: solo la consume la composición para construir el
adaptador y no se registra (R8). Es el único sitio donde la key sale del módulo, y sale hacia un
driven, no hacia la UI.

---

## 5. Puertos y adaptadores de `integraciones`

### 5.1 `ports/ai-provider-connection-repository.ts`

```ts
export interface AiProviderConnectionRepository {
  find(scope: IntegracionesScope): Promise<AiProviderConnectionRecord | null>;
  create(row: NewAiProviderConnectionRow, scope: IntegracionesScope): Promise<AiProviderConnectionRecord>;
  update(id: string, patch: AiProviderConnectionPatch, scope: IntegracionesScope): Promise<AiProviderConnectionRecord | null>;
  delete(scope: IntegracionesScope): Promise<void>;
}
```

`scope` al final de toda firma; `persistence/ai-provider-connection-prisma.ts` lo pasa siempre por
`company-scope.ts` (lo vigila `guard-ambito-empresa-integraciones`). `create` escribe `companyId`
desde el ámbito. `P2002` sobre `ai_provider_connections_company_id_key` ⇒
`AiProviderConnectionRaceError`. `select` explícito.

### 5.2 `ports/ai-provider-catalog.ts` y `adapters/driven/catalog/ai-provider-catalog-prisma.ts`

```ts
export interface AiProviderCatalog {
  list(): Promise<readonly AiProviderEntry[]>;              // por sort_order
  get(code: AiProviderCode): Promise<AiProviderEntry | null>;
}
```

Va en `catalog/` y **no** en `persistence/` a propósito: es una tabla global sin empresa, y
`guard-ambito-empresa-integraciones` exige ámbito a todo lo de `persistence/`. Filtra las filas cuyo
`code` no esté en `AI_PROVIDER_CODES`.

### 5.3 `ports/ai-provider-probe.ts`

```ts
export interface AiProviderProbe {
  probe(input: { provider: AiProviderCode; apiKey: string; models: readonly string[] }): Promise<AiProviderProbeResult>;
}
```

Lo implementan los tres archivos de SDK de `documentos` (§7), atados en la composición (§8). Así
cada SDK sigue importándose desde **un solo archivo** del repo (filas de `docs/dependencias.md`).

### 5.4 `adapters/driven/ai/ai-provider-probe-canned.ts` (R40)

`apiKey` que empieza por `E2E_INVALID` ⇒ `{ ok:false, failure:{ kind:'rejected_key', httpStatus:401,
model:null } }`; cualquier otra ⇒ `{ ok:true, elapsedMs: 800 }` (constantes exportadas).

---

## 6. `documentos`: la lectura por empresa y por uso (punto 3 del leader)

### 6.1 Lo que no cambia

`AiReader`, `createReadPdfWithAi`, `createProcessPdfByStrategy`, `createCropCatalogImages` y
`readCannedText` **no cambian de firma ni de comportamiento**: siguen recibiendo un `AiReader` ya
resuelto. Por eso sus tests (incluidos los que usan `ai-reader-canned`) no se tocan.

### 6.2 Uso por estrategia (`domain/ai-read-use.ts`)

```ts
export const USE_BY_STRATEGY: Record<PdfStrategy, AiReadUse> = { formula: 'recipe', catalogo: 'catalog' };
```

`AiReadUse` se importa del contrato de `integraciones` (un solo nombre para lo mismo). `Record`, no
`switch`: no compila si la estrategia gana un valor sin uso.

### 6.3 Puerto `ports/ai-provider-gateway.ts`

```ts
export type AiReaderLookup =
  | { status: 'missing' }
  | { status: 'unreadable' }
  | { status: 'ready'; reader: AiReader; connectionStatus: 'ACTIVE' | 'ERROR' };

export interface AiProviderGateway {
  isConfigured(companyId: string): Promise<boolean>;
  readerFor(companyId: string, use: AiReadUse): Promise<AiReaderLookup>;
  reportAccountFailure(companyId: string, failure: AiProviderFailure): Promise<void>;
  reportRecovered(companyId: string): Promise<void>;
}
```

### 6.4 Errores nuevos (`domain/errors.ts`)

| Clase | `code` | Lo lanza |
|---|---|---|
| `AiProviderMissingError` | `ai_provider_missing` | `issueUploadLinks` (R23) |
| `AiProviderError` | `ai_provider_error` | Los adaptadores de SDK ante un fallo de cuenta durante una lectura. Lleva `failure: AiProviderFailure` además del `diagnostic` (operación y código HTTP; nunca la key ni el cuerpo) |

`read-pdf-with-ai.ts` y `crop-catalog-images.ts` ya relanzan **tal cual** un `DocumentosError` que
venga del puerto (`conDiagnostico`): `ai_provider_error` llega intacto hasta `runDocumentJob` sin
tocar esos archivos. El plazo del dominio sigue envolviendo la llamada.

### 6.5 `failure-kind.ts`

`ProcessingFailureCode` gana `ai_provider_missing` y `ai_provider_error`, los dos `definitive`
(R24, R25: reintentar con la misma key rechazada o sin conexión no mejora nada y cada reintento
vuelve a pagar la rasterización). `ai_unavailable` sigue `retryable` (R26).

### 6.6 `issue-upload-links.ts` (R23)

`IssueUploadLinksDeps` gana `aiProvider: Pick<AiProviderGateway, 'isConfigured'>`. Orden: (1)
`requirePermission`, (2) **`isConfigured(actor.companyId)` → `false` ⇒ `AiProviderMissingError`**,
(3) esquema, (4) rutas, (5) firmas. Va **antes** del esquema para que un usuario con permiso pero sin
conexión reciba el motivo real y no un `invalid_input`; va **después** del permiso para que quien no
puede subir no aprenda nada de la empresa. Se comprueba aquí y no en `enqueueBatch` porque es el
primer paso del servidor: rechazar antes evita PDFs subidos y huérfanos. La desconexión entre la
subida y el procesamiento la cubre R24.

### 6.7 `run-document-job.ts`

`RunDocumentJobDeps` cambia:

```ts
readonly aiProvider: AiProviderGateway;
readonly pipelineFor: (reader: AiReader) => {
  processPdfByStrategy: (input: ProcessPdfByStrategyInput) => Promise<StrategyRunResult>;
  cropCatalogImages: (input: CropCatalogImagesInput) => Promise<CropCatalogImagesResult>;
};
```

(sustituye a `processPdfByStrategy` y `cropCatalogImages` sueltos). Flujo nuevo, entre leer la tanda
y descargar el PDF:

1. `lookup = await aiProvider.readerFor(companyId, USE_BY_STRATEGY[batch.strategy])`.
2. `missing` ⇒ `terminar(error, ai_provider_missing)` (R24); `unreadable` ⇒
   `terminar(error, ai_provider_error)` (R9; `integraciones` ya marcó la conexión). Sin descargar.
3. `ready` ⇒ envuelve el lector en un **observador** de dominio que guarda el último
   `AiProviderError` que atraviesa `read` y lo relanza; `pipeline = pipelineFor(observado)`.
4. Procesa y recorta como hoy.
5. Al terminar: si el observador vio un `AiProviderError` con `isAccountFailure` ⇒
   `reportAccountFailure` (R25). Si el resultado es `done` y `lookup.connectionStatus === 'ERROR'` ⇒
   `reportRecovered` (R27). Cualquier otro fallo ⇒ nada (R26).
6. Un fallo **al informar** (base caída) se registra con `log.warn` y no cambia el desenlace del
   archivo: el archivo ya terminó, igual que el borrado final del PDF.

Por qué el desenlace se informa en `runDocumentJob` y no en un envoltorio de la composición: es
lógica (qué cuenta como fallo de cuenta, cuándo se recupera) y la composición solo ata.

### 6.8 La fachada `documentos`

`readPdfWithAi` y `processPdfByStrategy` **salen** de la fachada: estaban construidos con el lector
global que D1 elimina, y ningún archivo de producción los consume (solo
`tests/unit/composition/documentos-facade.test.ts`; `qc109-alcance` vigila que nadie los invoque).
El censo cerrado pasa de catorce a doce claves. Los tests de dominio de esas dos funciones no
cambian.

---

## 7. Adaptadores de IA (SDK) — prueba y clasificación (puntos 5 y 6 del leader)

### 7.1 Forma común

Cada archivo de SDK exporta, sin leer ninguna variable:

```ts
export function createXReader(config: { apiKey: string; model: string }): AiReader;
export function probeX(input: { apiKey: string; models: readonly string[] }): Promise<AiProviderProbeResult>;
export function classifyXError(error: unknown, model: string | null): AiProviderFailure;  // exportada para test
```

- **Cliente por llamada**, `maxRetries: 0` donde el SDK lo admite, plazo pedido al cliente y además
  `AbortController` propio, como hoy.
- **Lectura**: si `classifyXError` da `rejected_key` o `quota` ⇒ lanza `AiProviderError` (§6.4).
  Cualquier otro fallo ⇒ `Error` llano, que el dominio convierte en `ai_unavailable` como hoy (R26).
- **Nunca** registra la key, la cabecera ni el cuerpo; el `diagnostic` de `AiProviderError` es
  `"<proveedor> <operación> respondió <status>"`.
- `ai-reader-anthropic.ts`: `readWithAnthropic` → `createAnthropicReader(config)`; las funciones de
  traducción (`toAnthropicBlock`, `buildAnthropicContent`, `textFromAnthropicMessage`) no cambian.
- `ai-reader-genai.ts`: `readWithGenai` → `createGenaiReader(config)`; `toGenaiPart`,
  `buildGenaiContents` no cambian.
- `ai-reader-openai.ts` (nuevo): `createOpenAiReader({apiKey, model, baseURL?})`,
  `probeOpenAi`, `probeOpenRouter`, `OPENROUTER_BASE_URL` = `https://openrouter.ai/api/v1`
  `[POR VERIFICAR]`. Chat Completions con un mensaje de usuario: las partes primero y el prompt al
  final; PDF como parte `file` con `file_data` en data URL base64; PNG como `image_url` con data
  URL. `finish_reason === 'length'` o `refusal` no nulo ⇒ error (no es una lectura), como el corte
  por tokens de Claude. **`[POR VERIFICAR]` en la primera task del adaptador (T9)** contra el paquete
  instalado: el nombre exacto de la parte de archivo, que OpenRouter la acepte igual en la misma
  forma y el campo de tokens de salida (`max_completion_tokens` o `max_tokens`).

### 7.2 La prueba pequeña por proveedor (R10)

Una sola regla para los cuatro: **comprobar la key y los dos modelos sin generar texto**, gratis y
sin consumir cuota de tokens. Los dos modelos en paralelo; plazo **10 s** para toda la prueba
(`AbortSignal.timeout(10_000)`, el mismo de la prueba de Graph en QC-237); `elapsedMs` medido en el
adaptador desde antes de la primera llamada hasta la última respuesta.

| Proveedor | Llamada | Verificado |
|---|---|---|
| Claude | `client.models.retrieve(model)` por cada modelo | Existe en `@anthropic-ai/sdk@0.131.0` (`resources/models.d.ts`: `retrieve(modelID, params?, options?)`) |
| Gemini | `client.models.get({ model })` por cada modelo | Existe en `@google/genai@2.23.0` (`genai.d.ts`: `get(params: GetModelParameters)`) |
| OpenAI | `client.models.retrieve(model)` por cada modelo | `[POR VERIFICAR]` con el paquete (no instalado al escribir esto) |
| OpenRouter | `GET /key` con la key (valida la key; su listado de modelos es público y no la valida) + `GET /models` y comprobar que los dos ids están | `[POR VERIFICAR]`: ruta exacta de la consulta de la key y que el SDK la alcance con `client.get('/key')` |

Por qué no una generación de 1 token: costaría cuota en cada prueba, y con OpenRouter cobraría según
el modelo. Lo que no valida esta prueba —que el modelo acepte un PDF— lo valida la primera lectura.

### 7.3 Clasificación de errores (R11, R25, R26)

| Respuesta | Claude (`APIError.status`) | Gemini (`ApiError.status`) | OpenAI / OpenRouter (`APIError.status`) | Tipo |
|---|---|---|---|---|
| 401, 403 | sí | sí | sí | `rejected_key` |
| 400 con key inválida | — | sí, si el mensaje trae `API_KEY_INVALID` `[POR VERIFICAR]` | — | `rejected_key` |
| 402 | — | — | OpenRouter, sin créditos `[POR VERIFICAR]` | `quota` |
| 429 | sí | sí | sí | `quota` |
| 404 (en la prueba) | sí | sí | sí; o id ausente del listado de OpenRouter | `model_unavailable` (con `model`) |
| Sin respuesta, `AbortError`, error de conexión del SDK | sí | sí | sí | `unreachable` |
| Cualquier otra (5xx, 400 genérico, cuerpo inesperado) | sí | sí | sí | `unexpected` |

**429 marca la conexión aunque sea un límite por minuto y no la cuota** (D8 dice «cuota»; los SDKs no
distinguen de forma fiable las dos). Aceptado porque `ERROR` no bloquea (R28) y la siguiente lectura
buena la devuelve a `ACTIVE` (R27).

### 7.4 Qué marca la conexión al leer (punto 6 del leader)

| Fallo durante una lectura | Archivo | Conexión |
|---|---|---|
| 401, 403, 429 (o equivalentes de §7.3) | `ai_provider_error`, definitivo | `ERROR` + `lastError` (R25) |
| Key guardada ilegible | `ai_provider_error`, definitivo | `ERROR` + «No se pudo leer la key…» (R9) |
| Sin conexión | `ai_provider_missing`, definitivo | — (no hay) (R24) |
| Plazo del dominio, red, 5xx, 404 de modelo | `ai_unavailable`, reintentable (como hoy) | sin cambios (R26) |
| PDF ilegible, más páginas que el tope, conversión | `invalid_input` / `unexpected` (como hoy) | sin cambios (R26) |
| Respuesta sin texto, negativa, corte por tokens | `ai_unavailable` (como hoy) | sin cambios (R26) |

Un 404 de modelo durante una lectura **no** marca: no es la key (D8) y lo detecta «Probar conexión»
con su mensaje propio. Si el humano quiere que también marque, es una fila más en
`isAccountFailure`.

---

## 8. Composición (`lib/composition/index.ts`)

Se **reemplaza** el bloque de l. 1993-2010 y el de `cropCatalogImages` (l. 2073-2080); el resto del
módulo no se reordena. Lo nuevo de `integraciones` va al final, junto a su bloque.

```ts
type ReaderFactory = (cfg: { apiKey: string; model: string }) => AiReader;
const READER_BY_PROVIDER: Record<AiProviderCode, ReaderFactory> = {
  ANTHROPIC: createAnthropicReader,
  GOOGLE: createGenaiReader,
  OPENAI: (cfg) => createOpenAiReader(cfg),
  OPENROUTER: (cfg) => createOpenAiReader({ ...cfg, baseURL: OPENROUTER_BASE_URL }),
};
const PROBE_BY_PROVIDER: Record<AiProviderCode, AiProviderProbe['probe']> = { … probeAnthropic, probeGenai, probeOpenAi, probeOpenRouter };

const aiProviderProbe: AiProviderProbe = {
  probe: (input) => integrationsE2EDoublesEnabled()
    ? aiProviderProbeCanned.probe(input)
    : PROBE_BY_PROVIDER[input.provider]({ apiKey: input.apiKey, models: input.models }),
};

const aiProviderGateway: AiProviderGateway = {
  isConfigured: async (companyId) => (await integraciones.getAiProviderStatus(companyId)) !== null,
  readerFor: async (companyId, use) => {
    if (documentsE2EDoublesEnabled()) {
      const status = await integraciones.getAiProviderStatus(companyId);
      return status === null ? { status: 'missing' }
        : { status: 'ready', reader: { read: readCannedText }, connectionStatus: status.connectionStatus };
    }
    const r = await integraciones.resolveAiProviderForReading(companyId, use);
    return r.status !== 'ready' ? r
      : { status: 'ready', reader: READER_BY_PROVIDER[r.provider]({ apiKey: r.apiKey, model: r.model }), connectionStatus: r.connectionStatus };
  },
  reportAccountFailure: (companyId, failure) => integraciones.reportAiProviderOutcome(companyId, { kind: 'account_failure', failure }),
  reportRecovered: (companyId) => integraciones.reportAiProviderOutcome(companyId, { kind: 'recovered' }),
};

function documentPipelineFor(reader: AiReader) {
  const readPdfWithAi = createReadPdfWithAi({ ai: reader, converter: pdfConverter });
  return {
    processPdfByStrategy: createProcessPdfByStrategy({ readPdfWithAi, countPages: pdfConverter.countPages, log: strategyRunLog, prompt: strategyPrompt }),
    cropCatalogImages: createCropCatalogImages({ converter: pdfConverter, ai: reader, cropper: imageCropper, storage: cropStorage, log: cropRegionLog }),
  };
}
```

- **Por qué se construye la cadena en cada trabajo.** El lector depende de la empresa y del uso; las
  fábricas solo cierran funciones (sin E/S), así que construirlas por trabajo cuesta nada y evita un
  lector global mutable. Las piezas sin estado (`pdfConverter`, `strategyRunLog`, `strategyPrompt`,
  `cropStorage`, `imageCropper`) siguen construidas una vez.
- **Orden de declaración.** `documentos` se evalúa antes que `integraciones` en el archivo:
  `aiProviderGateway` llama a `integraciones.*` **dentro** de funciones (no al construir), y los
  casos de uso de `integraciones` que necesita se declaran como `function`/`const` antes del uso en
  tiempo de ejecución. Si el orden del archivo lo impide, el bloque del gateway se coloca tras el de
  `integraciones` y `documentos` lo recibe por una función, como `buildCustomerCatalog`. Lo resuelve
  T10 sin reordenar bloques ajenos.
- `Record` sobre `AiProviderCode`: un proveedor nuevo sin lector o sin prueba no compila.
- **Doble de lectura (R41):** con `DOCUMENTS_E2E_DOUBLES` no se descifra nada; sí se exige conexión.
- Importar la composición sigue sin leer variables ni tocar la base (R42): todo vive en funciones.
- `integraciones` gana: `getAiProviderConnection`, `testAiProviderKey`, `testSavedAiProvider`,
  `saveAiProviderConnection`, `disconnectAiProvider`, `getAiProviderReadiness`,
  `getAiProviderStatus`, `resolveAiProviderForReading`, `reportAiProviderOutcome`. `documentos`
  pierde `readPdfWithAi` y `processPdfByStrategy` (§6.8).

---

## 9. Corte inmediato (D1, punto 4 del leader)

| Pieza | Qué pasa |
|---|---|
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `GEMINI_API_KEY`, `GEMINI_MODEL` | **Ningún archivo de `lib/` ni `app/` las lee** (R22). Se quitan de `.env.example` (bloque «Lectura de PDF con IA») y de la tabla `docs/architecture.md > Variables por entorno` (`guard-variables-por-entorno` compara `.env.example` contra la tabla: las dos salen juntas) |
| `lib/modules/documentos/adapters/driven/config/ai-config-env.ts` | **Se borra**. Las dos funciones solo las importan los dos adaptadores |
| `tests/unit/documentos/ai-config.test.ts` | **Se borra con su archivo**, salvo sus casos R16 («ningún identificador de modelo escrito a mano en `lib/modules/documentos`») que **se mudan y se tensan** a `tests/unit/documentos/ai-model-literals.test.ts`: barren `lib/` entero (no solo `documentos`) y el patrón cubre `claude-`, `gemini-`, `gpt-` y `<vendor>/` de OpenRouter (R43), con su caso de sensibilidad |
| `tests/unit/documentos/ai-reader-anthropic-adapter.test.ts`, `ai-reader-adapter.test.ts` | Dejan de simular el entorno; pasan la config por parámetro y suman clasificación y prueba (§15) |
| `tests/unit/composition/documentos-facade.test.ts` | El `vi.hoisted` deja de borrar las cuatro variables; el mock de `readWithAnthropic` pasa a `createAnthropicReader`; censo 14 → 12; el caso «R22 de QC-129» que afirmaba las dos claves retiradas se sustituye por uno que afirma que **no** están |
| `scripts/entorno-de-preview.mjs` (`SIN_VALOR`) y sus tests | **No cambian**: seguir exigiendo que `ANTHROPIC_API_KEY` y `GEMINI_API_KEY` estén vacías en preview no cuesta nada y cubre que alguien las deje en Vercel. `docs/architecture.md > El build de preview` gana una frase: «ya no las lee la app; se siguen rechazando por si quedan en Vercel» |
| Vercel producción | **Tarea del humano tras desplegar**: borrar las cuatro variables (§14). Antes del despliegue, avisar a las empresas: desde ese momento no leen PDF hasta conectar su proveedor (D1) |
| `docs/architecture.md > Integraciones externas` | La línea de Anthropic y Gemini pasa a «Anthropic, Google Gemini y OpenAI/OpenRouter (`openai`): lectura de PDF con la key de cada empresa» |

**Qué recibe una lectura sin proveedor** (R23, R24): en la subida, `ai_provider_missing` con el
texto «Para leer PDF, conecta el proveedor IA de tu empresa.» antes de firmar nada; si se desconectó
entre la subida y el trabajo, el archivo termina en error con ese mismo código y la fila de la
subida lo pinta (R39). **El aviso de bloqueo** se pinta en Fórmulas y en el detalle de proveedor
(§12.6), que son los dos únicos sitios con `DocumentUploadDialog`. El tablero dice «Fórmulas,
Inventario»: la subida de catálogo vive en `/proveedores/<id>` (`catalog-pdf-upload.tsx`), no en
Inventario; el aviso va donde está el botón.

---

## 10. Server Actions (`adapters/driving/ai-provider-actions.ts`)

`'use server'`, calcadas de `whatsapp-connection-actions.ts` (`currentActor()` una vez dentro de
`runInRequestScope`, `createErrorStateTranslator(IntegracionesError, …)`,
`revalidatePath(AI_PROVIDER_INTEGRATION_ROUTE)` tras cada mutación con éxito).

| Acción | Entrada | Salida |
|---|---|---|
| `getAiProviderConnectionAction()` | — | `{status:'success', providers, connection}` \| `ErrorState` |
| `testAiProviderKeyAction(prev, formData)` | `provider`, `apiKey` | `{status:'tested', ok:true, elapsedMs}` \| `{status:'tested', ok:false, message}` \| `ErrorState` |
| `testSavedAiProviderAction(prev, formData)` | — | lo mismo \| `{status:'not_connected'}` |
| `saveAiProviderConnectionAction(prev, formData)` | `provider`, `apiKey` | `{status:'saved'}` \| `{status:'test_failed', message}` \| `ErrorState` |
| `disconnectAiProviderAction(prev, formData)` | — | `{status:'disconnected'}` \| `ErrorState` |
| `getAiProviderReadinessAction()` | — | `{configured, canConfigure}`; ante cualquier error, `{configured:false, canConfigure:false}` (la página de Fórmulas no debe romperse por esto; el servidor vuelve a comprobar en R23) |

Ningún estado lleva `apiKey` ni `apiKeyEnc` (R8). El campo de la key vuelve vacío tras cada
respuesta.

---

## 11. Catálogo de errores

Dos entradas al final de `ERROR_CODES` con su clave y texto en `error-catalog.ts`;
`tests/unit/errores/catalogo.test.ts` sube en **2** sobre el conteo que tenga `dev` al empezar T1
(se mide; no se copia de aquí).

| Código | Texto (propuesto; se aprueba con el spec) |
|---|---|
| `ai_provider_missing` | «Para leer PDF, conecta el proveedor IA de tu empresa.» |
| `ai_provider_error` | «Error con tu proveedor IA. Revisa la conexión en Integraciones > Proveedor IA.» |

---

## 12. Pantalla

### 12.1 Archivos

```
app/(private)/integraciones/proveedor-ia/
  page.tsx
  components/
    index.ts
    ai-provider-brand.ts           logos, subtítulos y enlaces a la consola por código
    ai-provider-logo.tsx           SVG oficial o monograma (§12.5)
    ai-provider-picker.tsx         'use client'  grupo de opciones (role="radiogroup")
    ai-provider-form.tsx           'use client'  key, probar, guardar (useActionState)
    ai-provider-card.tsx           'use client'  conexión: estado, modelos, acciones, desconectar
components/shared/ai-provider-required-notice.tsx
```

### 12.2 `page.tsx`

1. `await requirePagePermission('integraciones.modificar')` como **primera** sentencia (R3).
2. `getAiProviderConnectionAction()`; `ErrorState` ⇒ `ErrorState` de página.
3. `PageHeader` con miga «Integraciones» y título «Proveedor IA»; el párrafo del tablero.
4. Sin conexión ⇒ `AiProviderForm` (R30). Con conexión ⇒ `AiProviderCard` (R31), que alterna al
   formulario con «Cambiar key o proveedor» (R32).

Props: el catálogo (`AiProviderEntry[]`) y la vista (R8).

### 12.3 Textos (del tablero, D10)

- Párrafo: «La lectura de fórmulas y catálogos en PDF usa la cuenta de IA de tu empresa. Elige el
  proveedor, pega tu API key y prueba la conexión. La key se guarda cifrada y nunca se vuelve a
  mostrar.»
- Formulario: «Conecta tu proveedor» / «Sin proveedor configurado no se pueden leer PDF.» / estado
  «Sin configurar»; leyenda «Proveedor»; subtítulos «Anthropic», «Google», «GPT», «Muchos modelos con
  una key»; etiqueta «API key de {nombre}», placeholder «Pega aquí tu API key»; ayuda «Créala en la
  consola de {nombre}: <enlace>. Se usa con los modelos {receta} y {catálogo}.»; botones «Probar
  conexión» y «Guardar y conectar»; nota «"Guardar y conectar" hace la misma prueba pequeña antes de
  guardar: con la key rechazada no se guarda nada.»
- Tarjeta: «Key guardada el {dd/mm/aaaa} · cifrada»; «Receta (fórmula desde PDF)», «Catálogo desde
  PDF», «Última prueba»; acciones «Desconectar», «Probar conexión», «Cambiar key o proveedor».
- **Última prueba** (propuesto): con `ACTIVE` y `lastCheckedAt`, «Correcta el {fecha hora}»; con
  `ERROR`, «Falló el {lastErrorAt}»; sin ninguna, «—».
- Aviso en `ERROR` (`Notice tone="danger"`, título «Error con tu proveedor»): el `lastError`.
- Enlaces a la consola `[POR VERIFICAR]`: console.anthropic.com/settings/keys,
  aistudio.google.com/apikey, platform.openai.com/api-keys, openrouter.ai/settings/keys. Con
  `target="_blank" rel="noopener noreferrer"`.

### 12.4 Comportamiento

- `AiProviderPicker`: botones con `role="radio"` y `aria-checked`, flechas para moverse, 64 px de
  alto mínimo (tablero); en teléfono, una columna (`ProveedorIAMovil.dc.html`).
- `PasswordField variant="secret"` con `texts={{ show: 'Mostrar la key', hide: 'Ocultar la key' }}`,
  `autoComplete="off"`; vacío al montar y tras cada respuesta (R8).
- «Probar conexión» y «Guardar y conectar» deshabilitados con la key vacía (R30); resultado en una
  región `aria-live="polite"` (R34).
- «Desconectar» con `ConfirmDialog` (R33). «Probar conexión» en la tarjeta prueba la guardada (R14).

### 12.5 Logos oficiales (punto 7 del leader) — `[POR CONFIRMAR]`

- **Dónde**: `public/brand/ai-providers/{anthropic,google,openai,openrouter}.svg`, servidos como
  `<img>` con `alt` = nombre (R35), 40 × 40 en el formulario y 44 × 44 en la tarjeta. Un mapa en
  `ai-provider-brand.ts` dice qué archivo tiene cada código.
- **Fuente y licencia**: **no verificadas**. Cada proveedor publica un kit o unas normas de marca
  (Anthropic/Claude, Google para Gemini, OpenAI, OpenRouter) que regulan cuándo se puede mostrar el
  logo; mostrarlo para identificar una integración es un uso habitual, pero **si cada kit lo permite
  aquí, y con qué condiciones (color, márgenes, sin modificar), lo confirma el humano** antes de
  versionar los SVG. La ficha no versiona un SVG sacado de otra fuente.
- **Mientras no lleguen**: `AiProviderLogo` pinta el monograma del tablero (C, G, O, R) en el
  recuadro, con el nombre como `aria-label`. R35 queda abierto hasta que el humano entregue los SVG.

### 12.6 Aviso de bloqueo (`components/shared/ai-provider-required-notice.tsx`, R37–R38)

```tsx
<AiProviderRequiredNotice canConfigure={boolean} />
```

`Notice tone="info"` con «**Para leer PDF, conecta el proveedor IA de tu empresa.** La lectura usa
tu propia API key.» y, con `canConfigure`, un enlace «Ir a Proveedor IA»
(`buttonVariants({ variant: 'outline', size: 'sm', touch: true })` a
`AI_PROVIDER_INTEGRATION_ROUTE`); sin él, «Pídele a un administrador que lo configure». El tablero
pinta un candado sobre fondo neutro; `Notice` trae el icono de su tono. **Se usa `Notice` tal cual**
(paso 1/3 de la regla) y la diferencia de icono se acepta; si el humano quiere el candado exacto, es
extender `Notice` con un `icon` opcional (paso 2), que no rompe a sus consumidores.

En `produccion/formulas/page.tsx` y `proveedores/[id]/page.tsx`: con `canUpload` (como hoy) se pide
`getAiProviderReadinessAction()`; `configured` ⇒ el botón de siempre; si no ⇒ el aviso en su lugar.
Sin `canUpload`, nada (R38). Gana su fila en `CATALOGO.md` con sus dos consumidores.

### 12.7 Multiplataforma (R36)

Campo a 16 px (`PasswordField` ya lo cumple), botones y opciones de 44 px o más, nada por `:hover`,
sin `100vh`. Disposición de tablet y teléfono según sus tableros (acciones apiladas con `cq-stack`
bajo 760 px). **No se declara ninguna excepción.**

---

## 13. Dobles para E2E

- Prueba: `INTEGRATIONS_E2E_DOUBLES` (ya la pone `playwright.config.ts`) ⇒ `aiProviderProbeCanned`
  (§5.4), elegido en cada llamada (§8).
- Lectura: `DOCUMENTS_E2E_DOUBLES` ⇒ `readCannedText`, **solo con conexión** (R41).
- `tests/guards/guard-dobles-e2e.test.ts`: la fila de `integraciones` gana la consulta del doble de
  la prueba y la de `documentos` la del lector por empresa; los dos motivos de rojo y sus casos de
  sensibilidad se conservan.
- **Datos de los E2E que suben PDF** (`documentos.spec.ts`, `formula-desde-pdf.spec.ts`,
  `catalogo-desde-pdf.spec.ts`, y `movimiento.spec.ts` si sube): su empresa efímera necesita una
  conexión o R23 los rompe. Su `beforeAll` inserta con Prisma una fila de `ai_provider_connections`
  (`ANTHROPIC`, `ACTIVE`, `api_key_enc = 'v1:e2e-sin-descifrar'`) y su limpieza la borra **antes**
  que la empresa. El valor no se descifra nunca: con `DOCUMENTS_E2E_DOUBLES` la lectura no descifra
  (R41), y por eso no hace falta compartir la clave de cifrado del servidor con el proceso de los
  tests (que `playwright.config.ts` genera al cargar y difiere entre procesos).

---

## 14. Variables de entorno y despliegue

| Variable | Cambio | Dónde |
|---|---|---|
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `GEMINI_API_KEY`, `GEMINI_MODEL` | **Salen** (D1) | Borrarlas de Vercel producción **después** de desplegar. Preview: ya ausentes |
| `INTEGRATIONS_ENCRYPTION_KEYS` / `_ACTIVE` | no (QC-234) | Condición para desplegar (ya lo era con QC-237): sin ellas, guardar una key falla con error inesperado |
| `INTEGRATIONS_E2E_DOUBLES`, `DOCUMENTS_E2E_DOUBLES` | no | Solo `playwright.config.ts` |

Ninguna variable nueva: las URL base de OpenRouter y de los demás proveedores no cambian entre
entornos (`docs/architecture.md > Principios` n.º 4).

---

## 15. Tests

### 15.1 Nuevos

| Archivo | Cubre |
|---|---|
| `tests/unit/integraciones/ai-provider/authorization.test.ts` | R1, R2: cada caso de uso de actor rechaza actor nulo, sin empresa, sin permiso y con otro permiso, sin tocar puertos; el ámbito es la empresa del actor aunque la entrada traiga `companyId`; `getAiProviderReadiness` solo exige empresa |
| `tests/unit/integraciones/ai-provider/test-ai-provider-key.test.ts` | R10 (modelos del catálogo pasados a la prueba), R11, R12, R13 (ningún puerto de escritura llamado), R18 |
| `tests/unit/integraciones/ai-provider/test-saved-ai-provider.test.ts` | R9 (sin prueba; `ERROR` + mensaje), R14 (buena y fallida, desde `ACTIVE` y desde `ERROR`) |
| `tests/unit/integraciones/ai-provider/save-ai-provider-connection.test.ts` | R7 (contexto exacto del `encrypt`), R15, R16 (ninguna escritura; la existente intacta), R17 (crear y reemplazar), R18, R19 (carrera: segunda vuelta por `update` con el id ganador) |
| `tests/unit/integraciones/ai-provider/disconnect-ai-provider.test.ts` | R20 (borrado; idempotente; sin prueba) |
| `tests/unit/integraciones/ai-provider/resolve-and-report.test.ts` | R6 (modelo del catálogo leído en cada llamada), R9, R21 (uso → modelo), R25 (mensaje compuesto, `lastErrorAt`), R27 (solo desde `ERROR`), sin conexión no escribe |
| `tests/unit/integraciones/ai-provider/ai-provider-failure.test.ts` | R11 (un texto por tipo, todos con el prefijo, ninguno con texto libre), mensajes de lectura |
| `tests/unit/integraciones/ai-provider/connection-view.test.ts` | R8 (la vista no tiene `apiKey*`; un campo extra en la fila no aparece) |
| `tests/unit/integraciones/ai-provider/ai-provider-actions.test.ts` | R8 (cada estado serializado de cada acción no contiene la key ni el cifrado), traducción de errores, readiness que no lanza |
| `tests/unit/integraciones/ai-provider/ai-provider-probe-canned.test.ts` | R40 |
| `tests/unit/composition/ai-provider-wiring.test.ts` | R40 y R41 (con y sin cada variable, en el mismo proceso, cambia el adaptador; con `DOCUMENTS_E2E_DOUBLES` y sin conexión ⇒ `missing`; no se descifra), R42 (importar no lee variables: `vi.resetModules` + import con `process.env` vigilado), cada código de proveedor elige su lector y su prueba |
| `tests/unit/documentos/run-document-job-ai-provider.test.ts` | R21 (uso por estrategia), R24, R25 (informa una vez; archivo definitivo), R26 (`ai_unavailable` y PDF ilegible no informan), R27, R28 (`ERROR` lee), fallo al informar no cambia el desenlace |
| `tests/unit/documentos/issue-upload-links-ai-provider.test.ts` | R23 (orden: permiso → conexión → esquema; sin firmar) |
| `tests/unit/documentos/ai-reader-openai-adapter.test.ts` | R29 (forma del mensaje con PDF e imagen, `baseURL` de OpenRouter, `finish_reason`), clasificación §7.3, prueba §7.2 con el SDK simulado |
| `tests/unit/documentos/ai-model-literals.test.ts` | R43 (barrido de `lib/` + caso de sensibilidad) y R22 (ningún archivo de `lib/` ni `app/` nombra las cuatro variables retiradas) |
| `tests/unit/documentos/openai-sdk-isolation.test.ts` | R29: un solo archivo importa `openai` |
| `tests/integration/integraciones/ai-provider-connection-prisma.int.test.ts` | R2 (empresa B no lee, actualiza ni borra la de A), R4 (cuatro filas, modelos no vacíos), R5 (RLS forzada en las dos; índice único; FK a proveedor), R7 (la columna empieza por `v<n>:` y no contiene la key), R19 (dos `create` en paralelo) |
| `tests/integration/integraciones/ai-provider-migration.int.test.ts` | R4, R5: `down.sql` + `migration.sql` deja el mismo esquema y las mismas cuatro filas |
| `tests/unit/integraciones-ui/ai-provider-page.test.tsx` | R3, R8 (HTML y props sin key), R30, R31 |
| `tests/unit/integraciones-ui/ai-provider-form.test.tsx` | R30 (deshabilitados sin key), R32, R34, R36 (clases de tamaño) |
| `tests/unit/integraciones-ui/ai-provider-card.test.tsx` | R31 (etiquetas, aviso solo con `ERROR`), R33, R34, R35 (`alt`) |
| `tests/unit/shared/ai-provider-required-notice.test.tsx` | R37 (con y sin `canConfigure`) |
| `tests/unit/documentos-ui/formulas-upload.test.tsx` y `supplier-detail-upload.test.tsx` (existen; **se amplían**) | R37, R38 en cada página (readiness simulada: configurada, sin configurar con y sin `canConfigure`, sin permiso de subida) |
| `tests/unit/documentos-ui/document-upload-errors.test.tsx` (existe; **se amplía**) | R39: el texto del catálogo de `ai_provider_missing` y `ai_provider_error` en la fila |
| `e2e/integraciones-proveedor-ia.spec.ts` | §15.4 |

### 15.2 Adaptadores de Claude y Gemini

`ai-reader-anthropic-adapter.test.ts` y `ai-reader-adapter.test.ts` (Gemini): la config llega por
parámetro (R22); suman la clasificación de §7.3 (401, 403, 429, 404, red, 5xx; Gemini 400
`API_KEY_INVALID`), que un fallo de cuenta lanza `AiProviderError` y otro un `Error` llano, y la
prueba (§7.2) con las dos llamadas y el plazo.

### 15.3 Tests de otras fichas que se ponen rojos y se tensan (nunca se relajan)

| Archivo | Qué fija hoy | Cambio |
|---|---|---|
| `tests/unit/integraciones/module-shape.test.ts` R13 | Un modelo de `integraciones` | Exactamente tres: `WhatsappConnection`, `AiProvider`, `AiProviderConnection` |
| … R18 | Lista exacta de archivos del módulo | + los de §1 |
| … R19 (importadores) | Solo composición y la pantalla de WhatsApp | + la pantalla de proveedor IA, las páginas de Fórmulas y del detalle de proveedor (acción de readiness, ruta exacta), y `lib/modules/documentos` **por contrato** (tipos) |
| … R19 (fachada) | Miembros exactos de `integraciones` | + los nueve de §8 |
| … R20 | Símbolos exactos del contrato | La lista nueva exacta |
| `tests/unit/composition/documentos-facade.test.ts` | Censo de 14 claves; mock de `readWithAnthropic` | 12 claves; afirma que `readPdfWithAi` y `processPdfByStrategy` **no** están; mock de `createAnthropicReader` |
| `tests/unit/documentos/run-document-job.test.ts`, `run-document-job-log.test.ts`, `document-job-route.test.ts` | `processPdfByStrategy` y `cropCatalogImages` sueltos en `deps` | `pipelineFor` + un `aiProvider` doble que devuelve `ready`; los casos existentes siguen afirmando lo mismo |
| `tests/unit/documentos/issue-upload-links.test.ts`, `authorization.test.ts`, `document-upload-actions.test.ts` (construyen `createIssueUploadLinks` o simulan la fachada) | Deps `{storage, now}` | + `aiProvider` con `isConfigured: true`; el orden de los pasos se afirma con el paso nuevo |
| `tests/unit/documentos/failure-kind.test.ts` | Mapa de tres códigos | Cinco |
| `tests/unit/documentos/module-contract.test.ts` | Contrato de `documentos` | + `AiProviderGateway`, `AiReaderLookup`, `AiProviderMissingError`, `AiProviderError` |
| `tests/unit/documentos/ai-config.test.ts` | Lectura de `ANTHROPIC_*`/`GEMINI_*` | **Se borra con el archivo**; sus casos R16 se mudan y se tensan (§9) |
| `tests/unit/integraciones-ui/integration-pages.test.tsx` | `proveedor-ia` es cascarón | Solo `inventarios`; un caso afirma que `proveedor-ia` ya no importa `IntegrationPlaceholder` |
| `e2e/integraciones.spec.ts` (caso Administrador) | Cada hijo muestra `integration-empty` | Proveedor IA muestra «Conecta tu proveedor» |
| `tests/guards/guard-identificador-de-request.test.ts` (`E2E_ESPERADOS`) | Lista cerrada | + `integraciones-proveedor-ia.spec.ts` |
| `tests/guards/guard-dobles-e2e.test.ts` | Consultas de las dos variables | + la prueba y el lector por empresa (§13) |
| `tests/guards/guard-empresa-en-esquema.test.ts` (`EXENTAS`) | Lista cerrada | + `ai_providers` (§2.3) |
| `tests/guards/guard-dependencias-aprobadas.test.ts` | — | Sin cambio de código: lee la fila nueva |
| `tests/unit/errores/catalogo.test.ts` | Conteo de `dev` | + 2 |
| `tests/unit/recetas-ui/recipe-page.test.tsx`, `tests/unit/proveedores-ui/supplier-detail-page.test.tsx`, `tests/unit/paridad/recetas-paridad.test.tsx`, `catalogo-paridad.test.tsx`, `tests/unit/navegacion/pantallas-exigen-permiso.test.tsx` (renderizan esas páginas; se confirma cuáles con `vitest related`) | Sin readiness | Simulan la acción de readiness (`configured: true`); lo que afirman no cambia |

### 15.4 E2E (punto 8 del leader): **sí hace falta**

Motivo: `docs/checkpoints-proyecto.md > Flujos criticos` obliga a E2E en **permisos** (la pantalla
y el aviso cambian con `integraciones.modificar`) y la ficha **corta un flujo existente** (subir PDF)
según el estado de una integración: sin E2E, un fallo de cableado dejaría a todas las empresas sin
leer PDF y solo se vería en producción. `e2e/integraciones-proveedor-ia.spec.ts`, con el patrón de
`integraciones-whatsapp.spec.ts` (prefijo `qc275_e2e_`, empresa efímera, Administrador real del
seed, `loginAndLand`, `test.setTimeout(180_000)`):

1. Fórmulas sin conexión: aviso de bloqueo con «Ir a Proveedor IA» y sin «Subir PDFs».
2. El enlace lleva a `/integraciones/proveedor-ia`: «Sin configurar», cuatro proveedores.
3. Elegir Gemini, key `E2E_INVALID…`, «Guardar y conectar»: mensaje de key rechazada; recarga: sigue
   «Sin configurar» (nada guardado).
4. Key válida, «Probar conexión»: «Conexión correcta»; «Guardar y conectar»: «Conectado», modelos de
   Gemini del catálogo; el HTML no contiene la key.
5. Fórmulas: aparece «Subir PDFs».
6. «Desconectar» → confirmar: «Sin configurar»; la fila no existe en la base.
7. Un usuario con permiso de subida y **sin** `integraciones.modificar` ve el aviso con «Pídele a
   un administrador que lo configure» y sin enlace.

El recorrido de lectura con la key de la empresa (R21, R25) lo cubren los E2E de documentos con la
fila sembrada (§13) y los tests de unidad de §15.1; el fallo en uso no tiene doble E2E propio.

---

## 16. Choques previsibles con otras features

| Archivo | Con quién | Cómo se resuelve |
|---|---|---|
| `db/schema.prisma`, `db/migrations/` | Cualquiera con esquema | Bloque al final; timestamp re-fechado en F2.3 si `dev` trae uno posterior |
| `lib/composition/index.ts` | Todas | Solo el bloque de IA de `documentos` y el final de `integraciones` |
| `lib/modules/documentos/domain/run-document-job.ts`, adaptadores de IA | QC-175, QC-176 (pendientes) | Van después; QC-176 cambia la lectura por lotes sobre `pipelineFor` |
| `lib/modules/errores/…`, `catalogo.test.ts` | Toda ficha con códigos | Al final; conteo re-medido |
| `.env.example`, `docs/architecture.md` | Fichas con variables | Solo se quita el bloque de IA y se toca el bullet de exentas |
| `app/(private)/produccion/formulas/page.tsx`, `proveedores/[id]/page.tsx` | Fichas de esas pantallas | Cambio de una rama alrededor del botón de subida |
| `package.json`, `pnpm-lock.yaml`, `docs/dependencias.md` | Fichas con dependencias | Una fila y una entrada |
| `module-shape.test.ts` de `integraciones` | QC-238, QC-242 (mismo módulo) | Quien llegue después amplía las listas |
| **QC-276** | Proveedores de respaldo | Parte de `AiProviderGateway.readerFor` y `isAccountFailure`; quitar el índice único de empresa es su migración |

---

## 17. Alternativas descartadas

1. **Catálogo de proveedores como constante en el código** en vez de tabla sembrada. Ahorraba la
   exención de `guard-empresa-en-esquema` y el adaptador `catalog/`, pero el humano fijó «por seed»
   (D5, Alcance) y la tabla da la FK que impide una conexión a un proveedor inexistente (R5).
2. **Copiar los modelos en la conexión** al guardar. Un cambio de modelo del seed no llegaría a las
   empresas ya conectadas sin reescribir sus filas; leerlos del catálogo en cada lectura (R6) lo
   hace con una migración de una línea.
3. **Añadir `companyId` y `use` a `AiReadRequest`** y resolver el proveedor dentro del `AiReader` de
   la composición. Cambiaba el puerto y todos sus tests (incluido el doble de guion), y metía en la
   composición la lógica de qué es un fallo de cuenta y cuándo se recupera. `pipelineFor` + el
   observador en `runDocumentJob` deja el puerto intacto y esa lógica en el dominio, con test.
4. **Mantener `readPdfWithAi` y `processPdfByStrategy` en la fachada** atados a «algún» lector. Sin
   key global no hay lector honesto que darles, y nada de producción los usa.
5. **Probar con una generación de 1 token** en vez de consultar los modelos. Cuesta cuota en cada
   prueba (y dinero en OpenRouter) y no aporta: la existencia del modelo con esa key es lo que la
   prueba necesita saber.
6. **Bloquear la subida también en `ERROR`.** Lo descarta R28 (pregunta abierta, `requirements.md`):
   una cuota recargada dejaría la empresa bloqueada hasta que alguien pruebe a mano.
7. **Reintentar en la cola los fallos de cuenta** (`retryable`). Una key rechazada no mejora
   esperando y cada reintento vuelve a rasterizar y a llamar (D8: «la lectura falla»).
8. **Comprobar la conexión en `enqueueBatch`** en vez de en `issueUploadLinks`. Dejaba subir los PDF
   al bucket para rechazarlos después: huérfanos sin fila que los caduque.
9. **`fetch` a mano contra OpenAI y OpenRouter.** Lo cierra D3: SDK oficial.
10. **Mover los SDK a `integraciones`** porque allí vive la prueba. Partía cada SDK en dos archivos
    (lectura en `documentos`, prueba en `integraciones`) contra la regla de «aislada en un solo
    archivo» de sus filas; la prueba se queda junto al lector y la composición ata el puerto de
    `integraciones` a esas funciones.
11. **Guardar el texto de error del proveedor en `lastError`.** Puede repetir la key o datos de la
    cuenta y no es estable; el mensaje compuesto por tipo y código (§4.4) dice lo que el
    Administrador necesita.

---

## 18. Dependencias de terceros (punto 2 del leader)

### 18.1 `openai` (nueva, D3)

- **Qué hace:** cliente oficial de la API de OpenAI: autenticación, Chat Completions con partes de
  archivo e imagen, errores tipados con `status`, plazo y `maxRetries`, `baseURL` configurable (que
  es lo que permite usarlo con OpenRouter, cuya API es compatible).
- **Qué código nos ahorra:** el cliente HTTP de dos proveedores (cabeceras, cuerpo multimodal,
  parseo y errores tipados) y la consulta de modelos de la prueba. Lo decidió el humano (D3).
- **Los cuatro checks** (`docs/architecture.md > Dependencias de terceros`): **desconocidos**. El
  spec se escribió sin red y el paquete no está instalado en el repo, así que no se pudo correr
  `npm view openai deprecated time.modified license` ni consultar las descargas semanales. **No es
  un sí** (regla 6): los cuatro se verifican antes de instalar (T0) y, si alguno falla, se para y se
  vuelve al humano.
  1. `deprecated`: desconocido.
  2. Release en los últimos 12 meses: desconocido.
  3. ≥ 10.000 descargas semanales: desconocido.
  4. Licencia: desconocido (se cree Apache-2.0, sin verificar).
- **Fila propuesta para `docs/dependencias.md`** (se completa con los datos de T0):

  `| \`openai\` | Cliente oficial de OpenAI para leer un PDF con OpenAI y con OpenRouter (API compatible, otra \`baseURL\`) con la key de cada empresa, y para la prueba de la conexión (consulta de modelos). La alternativa es \`fetch\` a mano contra Chat Completions de dos proveedores | aprobada | <fecha de F1.4> | **Los cuatro checks**, verificados contra el registro de npm el <fecha>: <deprecated>; ultima release <versión y fecha>; <descargas> descargas semanales; licencia <licencia>. Aprobada por el humano al aprobar el spec de QC-275 (F1.4); decisión D3 de la ficha. **Aislada en un solo archivo**, \`lib/modules/documentos/adapters/driven/ai/ai-reader-openai.ts\`, detrás del puerto \`AiReader\` y de la prueba de \`integraciones\`; lo vigila \`tests/unit/documentos/openai-sdk-isolation.test.ts\` |`

### 18.2 `@anthropic-ai/sdk` y `@google/genai` (ya en el registro)

Las dos **ya tienen fila** (`aprobada`, 2026-10-05 y 2026-09-18). No hay checks que rehacer; sus
filas se **enmiendan** (acta puesta al día, con fecha): dejan de leer la key del entorno, Gemini deja
de ser «respaldo sin cablear» y pasa a cablearse por empresa, y el mismo archivo hace la prueba de
la conexión. La versión de `@google/genai` instalada en este worktree es la de `pnpm-lock.yaml`;
no se actualiza en esta ficha.

---

## 19. Lo que queda `[POR VERIFICAR]` / `[POR CONFIRMAR]` para F1.4

1. Los ocho identificadores de modelo (§3).
2. Los cuatro checks de `openai` (§18.1), en T0 antes de instalar.
3. La forma de la parte PDF en Chat Completions de OpenAI y OpenRouter y el campo de tokens de
   salida (§7.1).
4. La consulta de la key de OpenRouter (`GET /key`) y su `baseURL` (§7.1, §7.2).
5. Gemini 400 `API_KEY_INVALID` y OpenRouter 402 como fallos de cuenta (§7.3).
6. Enlaces a la consola de cada proveedor (§12.3).
7. Logos oficiales: fuente y uso de marca (§12.5) — `[POR CONFIRMAR]`.
8. R27/R28 y los textos nuevos (preguntas abiertas de `requirements.md`).
