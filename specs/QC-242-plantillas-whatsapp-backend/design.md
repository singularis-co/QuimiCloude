# QC-242 — plantillas-whatsapp-backend · design.md

> Zona: `backend` · Complejidad: `medium` · depends_on: QC-237, QC-238 · Rama:
> `feature/QC-242-plantillas-whatsapp-backend`
>
> **Enmienda 2026-10-20 (diccionario de variables, R53–R86): §18.** §1–§17 describen lo implementado
> en el PR #281 y siguen valiendo; donde §18 cambia algo de ellas, lo dice con la sección afectada
> (§3.3, §3.4, §4.3, §4.4, §4.5, §4.6, §5, §9, §11, §12).
>
> El **qué** está en `requirements.md` (R1–R52). Aquí va el **cómo**. Precedentes que se copian:
>
> - **QC-237**: `WhatsappConnectionRepository`, `decryptStoredSecret` (descifrar y dejar la conexión en
>   `ERROR` si el secreto es ilegible), `metaMessageOf` (tachar secretos en un texto de Meta), el
>   cliente de Graph con su doble `canned` para E2E, el patrón de Server Actions con `currentActor` y
>   `createErrorStateTranslator`.
> - **QC-238**: `parseWhatsappWebhook` → `InboundBatch`, `createReceiveWhatsappWebhook`, la ruta
>   `whatsapp-webhook-route.ts`, `resolveWebhookConnection` (ámbito sacado de la fila) y la guardia
>   `guard-ambito-empresa-integraciones.test.ts`.
> - **QC-141**: el cron `caducar-pedidos` (`order-expiry-cron-route.ts`, `verifyCronSecret`,
>   `createExpireStaleOrders` recorriendo empresas una a una con `listActiveCompanyIds`, presupuesto de
>   240 s y `maxDuration = 300`).
>
> **Regla transversal.** Manda `docs/conventions.md > Comentarios`: ningún comentario nuevo cita
> `QC-<n>`, `R<n>`, `design.md` ni «decisión cerrada». En los tests, `R<n>` va en el nombre del caso.

---

## Lo que ya existe

Buscado `plantilla`, `template`, `message_template`, `hsm`, `WhatsappTemplate`/`whatsapp_templates`
y `sincroniz` en:

- `feature_list.json`, por `name` y `description`, en todos los estados;
- `specs/` con grep;
- el código: Grep sobre `lib/`, `app/`, `db/` y `tests/`. El MCP del grafo responde
  (`list_projects`), pero no tiene indexado este worktree; se usó Grep/Read.

| Apareció | Qué es | Qué se hace |
|---|---|---|
| QC-243 `plantillas-whatsapp-frontend` (`pending`) | La pantalla que consume esta ficha | Frontera en §15. No se solapa |
| QC-240, QC-241 (`pending`) | Envío con plantilla (nombre, idioma, parámetros); `whatsapp_messages.template_name` | Consumidores; QC-240 dice «validar la plantilla contra el catálogo local: ficha de plantillas», y la ficha de aquí lo deja a Contactos. Frontera en §15 |
| QC-245, QC-247 (`pending`) | Contactos y notificaciones: eligen plantillas aprobadas | Consumen el filtro «solo aprobadas» (R44) |
| QC-119 `webhook-whatsapp-recepcion` (`cancelled`) | Épica antigua | Nada que reutilizar |
| QC-237 (`done`) | `WhatsappGraphClient.fetchPhoneNumber`, `whatsappGraphClientFetch`/`Canned`, `GraphFailure`, `metaMessageOf`, `decryptStoredSecret`, `readStoredSecret`, `createCreateWhatsappConnection`, `whatsapp-connection-actions.ts`, `WHATSAPP_INTEGRATION_ROUTE`, `WHATSAPP_SETUP_GUIDE_STEPS` | **Se reutiliza.** El puerto de Graph gana tres métodos (§6), la creación de conexión gana la importación inicial (§4.7), la guía gana un paso (§13). QC-237 §13 ya dejó escrito que QC-242 amplía el cliente de Graph sobre `wabaId` |
| QC-238 (`done`) | `parseWhatsappWebhook` (hoy salta todo `field !== 'messages'`), `createReceiveWhatsappWebhook`, `whatsapp-webhook-route.ts`, `resolveWebhookConnection`, `IntegrationsSwitch` | **Se reutiliza.** El parser gana los dos campos de plantillas (§7); el caso de uso gana un paso; la ruta programa la resincronización con `after` |
| QC-141 (`done`) | `verifyCronSecret` (adaptador de `pedidos`), `order-expiry-cron-route.ts`, `listActiveCompanyIds` (adaptador de `identity`) | **Se reutiliza** `verifyCronSecret` y `listActiveCompanyIds` cableados en `lib/composition`; se copia la forma de la ruta y del recorrido |
| `tests/unit/integraciones/whatsapp/whatsapp-webhook-payload.test.ts` R14 | Usa `message_template_status_update` como ejemplo de «campo que se ignora» | Se cambia el ejemplo por otro campo (`account_update`): el de plantillas deja de ignorarse |
| Ningún modelo, puerto ni ruta de plantillas | — | Nacen aquí |

Conclusión: no existe nada que resuelva parte del alcance; se sigue reutilizando lo de QC-237, QC-238
y QC-141. La ficha no crea UI: el único archivo de `app/(private)` que toca es una cadena más en la
lista de pasos de la guía (§13, [P8]); no se consulta `components/shared/CATALOGO.md` y no hay pase
`/design`.

---

## 1. Qué cambia (resumen)

```
db/schema.prisma                                        ← 2 enums, WhatsappTemplate, + templatesSyncedAt en WhatsappConnection
db/migrations/20261020120000_whatsapp_templates/{migration,down}.sql
app/api/cron/sincronizar-plantillas-whatsapp/route.ts   ← reexporta GET, runtime, maxDuration
vercel.json                                             ← + 1 cron
app/(private)/integraciones/whatsapp/components/whatsapp-setup-guide.tsx  ← + 1 paso (texto)
lib/modules/errores/domain/{error-codes,error-catalog}.ts                 ← + 6 códigos
lib/modules/integraciones/
  index.ts                                              ← + fábricas, validador, tipos
  domain/
    errors.ts                                           ← + 6 errores
    whatsapp-template.ts                                ← constantes, tipos, record, vista
    whatsapp-template-languages.ts                      ← lista de idiomas
    whatsapp-template-draft.ts                          ← validador puro (R6–R13)
    whatsapp-template-components.ts                     ← borrador ⇄ componentes de Meta
    whatsapp-template-meta.ts                           ← interpretar una plantilla de Meta (R4, R26)
    template-graph-failure.ts                           ← fallo de Graph → error de dominio (R19, R43)
    template-sync-plan.ts                               ← plan puro de sincronización (R23–R25)
    sync-whatsapp-templates.ts                          ← núcleo común + manual + reintento del webhook
    sync-all-whatsapp-templates.ts                      ← el cron
    list-whatsapp-templates.ts                          ← listar y consultar
    create-whatsapp-template.ts
    delete-whatsapp-template.ts
    template-connection.ts                              ← conexión viva utilizable (R15, R20)
    whatsapp-template-webhook.ts                        ← zod de los dos campos (R36–R41)
    whatsapp-webhook-payload.ts                         ← + templateUpdates en InboundBatch
    receive-whatsapp-webhook.ts                         ← + aplicar cambios de plantillas, followUp
    create-whatsapp-connection.ts                       ← + importación inicial (R29, R30)
    whatsapp-connection.ts                              ← + templatesSyncedAt en el record
  ports/
    whatsapp-graph-client.ts                            ← + createTemplate, listTemplatesPage, deleteTemplate
    whatsapp-template-repository.ts                     ← nuevo
  adapters/driven/
    graph/whatsapp-graph-client-fetch.ts                ← + 3 llamadas
    graph/whatsapp-graph-client-canned.ts               ← + 3 llamadas en memoria
    persistence/company-scope.ts                        ← + whatsappTemplateCompanyScope
    persistence/whatsapp-template-prisma.ts             ← nuevo
    persistence/whatsapp-connection-prisma.ts           ← + templatesSyncedAt en el select
  adapters/driving/
    whatsapp-template-actions.ts                        ← 4 Server Actions
    whatsapp-template-cron-route.ts                     ← GET del cron
    whatsapp-webhook-route.ts                           ← + after(resync)
    whatsapp-connection-actions.ts                      ← + log de la importación inicial fallida
lib/composition/index.ts                                ← amplía `integraciones`
tests/**                                                ← §14
```

---

## 2. Modelo de datos

### 2.1 Prisma

```prisma
enum WhatsappTemplateCategory {
  MARKETING
  UTILITY
  AUTHENTICATION
  @@map("whatsapp_template_category")
}

enum WhatsappTemplateStatus {
  PENDING
  APPROVED
  REJECTED
  PAUSED
  DISABLED
  OTHER
  @@map("whatsapp_template_status")
}

/// @module integraciones
model WhatsappTemplate {
  id             String                   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  companyId      String                   @map("company_id") @db.Uuid
  connectionId   String                   @map("connection_id") @db.Uuid
  metaTemplateId String                   @map("meta_template_id")
  name           String
  language       String
  category       WhatsappTemplateCategory
  components     Json                     @default("[]")
  status         WhatsappTemplateStatus
  statusRaw      String?                  @map("status_raw")
  rejectedReason String?                  @map("rejected_reason")
  lastSyncedAt   DateTime?                @map("last_synced_at") @db.Timestamptz(6)
  createdById    String?                  @map("created_by") @db.Uuid
  createdAt      DateTime                 @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt      DateTime                 @updatedAt @map("updated_at") @db.Timestamptz(6)
  deletedAt      DateTime?                @map("deleted_at") @db.Timestamptz(6)

  @@unique([connectionId, metaTemplateId], map: "whatsapp_templates_connection_meta_id_key")
  @@index([createdById], map: "whatsapp_templates_created_by_idx")
  @@map("whatsapp_templates")
}
```

`WhatsappConnection` gana `templatesSyncedAt DateTime? @map("templates_synced_at") @db.Timestamptz(6)`
([P6]).

Decisiones del modelo:

- **`metaTemplateId` como texto.** Meta da el id como cadena de dígitos en Graph; como número en el
  webhook (§7). Un número grande pierde precisión en `JSON.parse`: el id no casa, la plantilla parece
  desconocida y R38 la resincroniza, que la corrige. Se acepta y se fija en un test.
- **`statusRaw` solo con `OTHER`** (R4, D5): `CHECK ((status = 'OTHER') = (status_raw IS NOT NULL))`.
- **`createdById` nulo** para las importadas (R23). FK a `users(id)` escrita a mano, como QC-237.
- **`components` en el formato de Meta**, tal como lo devuelve `GET message_templates` (las creadas
  aquí guardan lo enviado, que tiene la misma forma). Así una importada con header de imagen u OTP se
  guarda entera, y la fase 2 de headers con archivo no cambia el modelo (D3).
- **Único parcial `(connection_id, name, language) WHERE deleted_at IS NULL`** ([P1]) solo en la
  migración (Prisma no expresa parciales), como `whatsapp_connections_company_live_key`. El único
  total `(connection_id, meta_template_id)` sí va en Prisma: es la clave del `upsert` de la
  sincronización y de la carrera de §4.4.
- **Sin `@relation`**: FK compuestas a mano en la migración (QC-237, QC-238), para que ningún
  `include` cruce de empresa.

### 2.2 Migración `20261020120000_whatsapp_templates`

Escrita a mano, en orden:

1. `CREATE TYPE "whatsapp_template_category"` y `"whatsapp_template_status"`.
2. `CREATE TABLE "whatsapp_templates"` con las columnas de §2.1; `updated_at` sin default;
   `CHECK (length(meta_template_id) > 0)`, `CHECK (length(name) > 0)`, `CHECK (length(language) > 0)`
   y el `CHECK` de `status_raw`.
3. Índices: `whatsapp_templates_connection_meta_id_key` (único),
   `CREATE UNIQUE INDEX "whatsapp_templates_name_language_live_key" ON "whatsapp_templates"
   ("connection_id", "name", "language") WHERE "deleted_at" IS NULL`, `whatsapp_templates_created_by_idx`.
4. FK (R1): `(company_id, connection_id) → whatsapp_connections (company_id, id)` (clave
   `whatsapp_connections_company_id_id_key` de QC-237), `company_id → companies(id)`,
   `created_by → users(id)`; todas `ON DELETE RESTRICT ON UPDATE CASCADE`.
5. `ALTER TABLE "whatsapp_connections" ADD COLUMN "templates_synced_at" TIMESTAMPTZ(6)`.
6. `ENABLE` y `FORCE ROW LEVEL SECURITY` en `whatsapp_templates`, sin policies (R50).

`down.sql`: `ALTER TABLE "whatsapp_connections" DROP COLUMN "templates_synced_at"`,
`DROP TABLE "whatsapp_templates"`, los dos `DROP TYPE`.

`guard-empresa-en-esquema`: la tabla tiene `company_id`. `guard-rls-force` la ve por la migración. Sin
filas de permisos: se usa `integraciones.modificar`, que ya existe.

---

## 3. Dominio: la plantilla

### 3.1 Tipos (`domain/whatsapp-template.ts`)

```ts
export const WHATSAPP_TEMPLATE_CATEGORIES = ['MARKETING', 'UTILITY', 'AUTHENTICATION'] as const;
export const CREATABLE_TEMPLATE_CATEGORIES = ['MARKETING', 'UTILITY'] as const;          // [P5]
export const KNOWN_TEMPLATE_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'PAUSED', 'DISABLED'] as const;
export type WhatsappTemplateStatus = (typeof KNOWN_TEMPLATE_STATUSES)[number] | 'OTHER';

export type WhatsappTemplateRecord = {          // nunca sale del módulo
  id; companyId; connectionId; metaTemplateId; name; language; category; components: unknown;
  status; statusRaw: string | null; rejectedReason: string | null; lastSyncedAt: Date | null;
  createdById: string | null; createdAt: Date; deletedAt: Date | null;
};

export type WhatsappTemplateView = {            // R46, campo a campo, sin spread
  id; name; language; category; status; statusRaw; rejectedReason;
  content: WhatsappTemplateContent | null;
  lastSyncedAt: string | null; createdAt: string;
};

export type WhatsappTemplateList = {
  templates: readonly WhatsappTemplateView[];
  templatesSyncedAt: string | null;             // R44, R48
};

export type TemplateSyncSummary = {
  imported: number; updated: number; deleted: number; skipped: number; syncedAt: string;
};
```

`statusOf(raw: string) → { status, statusRaw }`: uno de los cinco conocidos (comparación exacta en
mayúsculas) ⇒ `statusRaw: null`; cualquier otro ⇒ `OTHER` con `raw` recortado a 100 caracteres (R4).

### 3.2 Idiomas (`domain/whatsapp-template-languages.ts`) — [P3] [POR CONFIRMAR]

Lista de códigos de idioma que Meta acepta al crear, según la conoce el spec. **El implementer la
contrasta con la página «Supported languages» de la documentación vigente de plantillas antes de T3**
y anota en `progress/impl_QC-242.md` la fecha y las diferencias:

```
af sq ar az bn bg ca zh_CN zh_HK zh_TW hr cs da nl en en_GB en_US et fil fi fr ka de el gu ha he
hi hu id ga it ja kn kk rw_RW ko ky_KG lo lv lt mk ms ml mr nb fa pl pt_BR pt_PT pa ro ru sr sk sl
es es_AR es_ES es_MX sw sv ta te th tr uk ur uz vi zu
```

La lista restringe solo la **creación** (R8). La sincronización importa cualquier `language` que
traiga Meta: es un dato de fuera, no una elección del usuario.

### 3.3 El borrador y su validador (`domain/whatsapp-template-draft.ts`) — R6–R13

```ts
export type WhatsappTemplateButton =
  | { type: 'QUICK_REPLY'; text: string }
  | { type: 'URL'; text: string; url: string; example: string | null }
  | { type: 'PHONE_NUMBER'; text: string; phoneNumber: string };

export type WhatsappTemplateContent = {
  header: { text: string; example: string | null } | null;
  body: { text: string; examples: readonly string[] };
  footer: string | null;
  buttons: readonly WhatsappTemplateButton[];
};

export type WhatsappTemplateDraft = WhatsappTemplateContent & {
  name: string; language: string; category: 'MARKETING' | 'UTILITY';
};

export type WhatsappTemplateIssue = { field: string; code: WhatsappTemplateIssueCode; message: string };

export function validateWhatsappTemplateDraft(input: unknown):
  | { ok: true; draft: WhatsappTemplateDraft }
  | { ok: false; issues: readonly WhatsappTemplateIssue[] };
```

- **Puro** (R6): solo `zod` y constantes; no importa `../ports`, `errores` ni nada de servidor. Se
  exporta desde `index.ts` junto a `TEMPLATE_LIMITS` y `WHATSAPP_TEMPLATE_LANGUAGES`, para que QC-243
  lo importe en un componente de cliente como hoy se importa `cancelOrderSchema` de `pedidos`.
  `module-shape.test.ts` fija que el archivo no importa nada fuera de `zod` y del propio `domain/`.
- `field` usa rutas estables (`name`, `body.text`, `body.examples.1`, `buttons.2.url`…) y `message`
  va en español; `code` es la palabra estable para la UI (`required`, `too_long`, `invalid_chars`,
  `invalid_variable`, `variables_not_sequential`, `example_missing`, `example_extra`,
  `too_many_buttons`, `buttons_not_grouped`, `invalid_url`, `invalid_phone`, `not_allowed`).
- Los largos se miden en **puntos de código** (`[...texto].length`), no en unidades UTF-16: un emoji
  cuenta 1. Cómo cuenta Meta es [P2] [POR CONFIRMAR].
- Los textos no se recortan al validar; el validador rechaza los que son solo espacios.

**Límites** (`TEMPLATE_LIMITS`, todos [P2] [POR CONFIRMAR], una sola constante para que la pantalla
pinte los contadores con los mismos números):

| Campo | Regla |
|---|---|
| `name` | `^[a-z0-9_]+$`, 1–512 |
| `language` | en `WHATSAPP_TEMPLATE_LANGUAGES` |
| `category` | `MARKETING` o `UTILITY` |
| `header.text` | 1–60; como mucho una variable y solo `{{1}}`; con variable ⇒ `example` no vacío; sin variable ⇒ `example: null` |
| `body.text` | obligatorio, 1–1024 |
| variables del body | toda marca `{{…}}` casa con `\{\{([1-9]\d*)\}\}`; el conjunto de números es `{1…n}`; `examples.length === n`, todos no vacíos |
| `footer` | 1–60, sin `{{` |
| `buttons` | ≤ 10; `URL` ≤ 2; `PHONE_NUMBER` ≤ 1; los `QUICK_REPLY` contiguos (todos antes o todos después de los demás) |
| `buttons[].text` | 1–25, sin variables |
| `URL.url` | `https://`, ≤ 2000, como mucho un `{{1}}` y solo al final; con variable ⇒ `example` es una URL `https://`; sin variable ⇒ `example: null` |
| `PHONE_NUMBER.phoneNumber` | `^\+[1-9]\d{7,14}$` |

### 3.4 Borrador ⇄ componentes de Meta (`domain/whatsapp-template-components.ts`)

`toMetaComponents(draft)` arma el arreglo que se envía y se guarda:

```json
[
  { "type": "HEADER", "format": "TEXT", "text": "Pedido {{1}}", "example": { "header_text": ["A-102"] } },
  { "type": "BODY", "text": "Hola {{1}}, tu pedido {{2}} está listo.", "example": { "body_text": [["Ana", "A-102"]] } },
  { "type": "FOOTER", "text": "QuimiCloud" },
  { "type": "BUTTONS", "buttons": [
      { "type": "QUICK_REPLY", "text": "Gracias" },
      { "type": "URL", "text": "Ver pedido", "url": "https://ejemplo.test/p/{{1}}", "example": ["https://ejemplo.test/p/A-102"] },
      { "type": "PHONE_NUMBER", "text": "Llamar", "phone_number": "+573000000000" } ] }
]
```

Sin `example` cuando no hay variables; sin `HEADER`, `FOOTER` o `BUTTONS` cuando no vienen. La forma
es la de la Cloud API según la conoce el spec ([P4] [POR CONFIRMAR]).

`contentOf(components: unknown): WhatsappTemplateContent | null` hace lo inverso con zod: devuelve el
contenido si **todos** los componentes son de esta fase (header `TEXT`, body, footer y botones de
los tres tipos), y `null` si aparece cualquier otro (header `IMAGE`/`VIDEO`/`DOCUMENT`/`LOCATION`,
botones `OTP`, `COPY_CODE`, `FLOW`…, o una forma que no casa) (R46). Test de ida y vuelta:
`contentOf(toMetaComponents(d))` reproduce el contenido de `d`.

### 3.5 Una plantilla de Meta (`domain/whatsapp-template-meta.ts`) — R4, R26

```ts
export type MetaTemplateSnapshot = {
  metaTemplateId: string; name: string; language: string;
  category: WhatsappTemplateCategory; status: WhatsappTemplateStatus; statusRaw: string | null;
  rejectedReason: string | null; components: unknown;
};
export function interpretMetaTemplate(raw: unknown):
  | { ok: true; template: MetaTemplateSnapshot }
  | { ok: false; metaTemplateId: string | null };
```

zod sobre `{ id: string (dígitos), name: string min 1, language: string min 1, status: string,
category: string, components?: unknown[], rejected_reason?: string }` con `.passthrough()`. Categoría
fuera de las tres ⇒ `ok: false` con su id, si lo hay ([P7]). `rejected_reason` igual a `NONE` o vacío
⇒ `null` [POR CONFIRMAR]; solo se guarda con estado `REJECTED`. Textos con `\u0000` ⇒ `ok: false`
(D77: no se le da a la base algo que rechaza).

---

## 4. Casos de uso

Fábricas `createX(deps)` como el resto del módulo; `requirePermission(actor)` es la primera línea de
los que llevan actor (R5).

### 4.1 Conexión utilizable (`domain/template-connection.ts`)

```ts
export async function requireTemplateConnection(
  deps: { connections; cipher }, scope,
): Promise<{ record: WhatsappConnectionRecord; accessToken: string }>;
```

1. `connections.findLive(scope)`; `null` ⇒ `WhatsappConnectionNotFoundError` (R15).
2. `status === 'DISABLED'` ⇒ `ActionNotAllowedError('conexión deshabilitada')` (R15).
3. `decryptStoredSecret(deps, record, ACCESS_TOKEN_FIELD, scope)`: un secreto ilegible deja la
   conexión en `ERROR` y relanza `SecretUnreadableError` (R20). No se descifra el App Secret: las
   llamadas de plantillas no lo usan; sí entra en la lista de `metaMessageOf` cuando se tacha el
   texto de Meta, leyéndolo con `readStoredSecret` solo si hay un fallo que tachar (R21).

`PENDING` y `ERROR` se aceptan: el token puede funcionar aunque el webhook no se haya verificado, y
la sincronización al crear (R29) corre sobre una conexión que nace `PENDING`.

### 4.2 Núcleo de la sincronización (`domain/sync-whatsapp-templates.ts`)

```ts
async function syncConnectionTemplates(
  deps: { graph; templates; now }, connection: WhatsappConnectionRecord, accessToken: string, scope,
): Promise<TemplateSyncSummary>
```

1. `startedAt = now()`.
2. **Leer todo** (R22): `graph.listTemplatesPage({ wabaId, accessToken, after })` en bucle con el
   cursor `after` hasta que `next === null`. Tope de `MAX_TEMPLATE_PAGES = 20` páginas de 100: si se
   alcanza sin terminar ⇒ `WhatsappMetaRejectedError('demasiadas páginas')` sin escribir. Un fallo de
   cualquier página ⇒ error de §4.9 sin escribir.
3. `interpretMetaTemplate` sobre cada elemento; los `ok: false` se cuentan en `skipped` y su id (si lo
   hay) entra en `protectedIds` (R26).
4. `current = await templates.listForSync(connection.id, scope)` (vivas y eliminadas).
5. `plan = planTemplateSync(current, snapshots, protectedIds)` (§4.3, puro).
6. `await templates.applySync(connection.id, plan, startedAt, now(), scope)` en **una** transacción
   (§5.2). Una excepción se propaga (R22).
7. Devuelve el resumen (R25).

Nunca llama a `createTemplate` ni `deleteTemplate` (R27): `deps.graph` se tipa como
`Pick<WhatsappGraphClient, 'listTemplatesPage'>`, así que un test lo fija por tipo y por espía.

**Sincronización manual** (R28): `createSyncWhatsappTemplates(deps)(actor)` =
`requirePermission` → `scopeOf` → `requireTemplateConnection` → `syncConnectionTemplates`.

**Reintento del webhook** (R38): `createResyncWhatsappTemplates(deps)(connectionId)` sin actor:
`resolveWebhookConnection` (directorio, añadido, `findLiveById`, no deshabilitada; el ámbito sale de la
fila) → `decryptStoredSecret` del token → `syncConnectionTemplates`. Devuelve
`{ kind: 'synced', summary } | { kind: 'skipped', reason } | { kind: 'failed', code }`; no lanza.

### 4.3 Plan de sincronización (`domain/template-sync-plan.ts`) — R23–R25

```ts
type TemplateSyncPlan = {
  inserts: readonly MetaTemplateSnapshot[];
  updates: readonly { id: string; template: MetaTemplateSnapshot; changed: boolean }[];
  deletes: readonly string[];      // ids locales
};
```

- Por `metaTemplateId`: sin fila ⇒ `inserts`; con fila ⇒ `updates`, con `changed = true` si difiere
  algún campo de R23 o tenía `deletedAt`. `components` se compara con igualdad estructural
  (`JSON.stringify` de claves ordenadas), porque Meta puede devolver las claves en otro orden.
- `deletes`: filas vivas cuyo `metaTemplateId` no está ni en los snapshots ni en `protectedIds`.
- Resumen: `imported = inserts.length`, `updated = updates.filter(changed).length`,
  `deleted = deletes.length`.

Unit test con tabla: importar, actualizar estado, revivir una eliminada, no contar las que no
cambian, no borrar una protegida, borrar la que falta.

### 4.4 Crear (`domain/create-whatsapp-template.ts`) — R14, R16–R19

`createCreateWhatsappTemplate(deps)(input, actor)`:

1. `requirePermission`, `scopeOf`.
2. `validateWhatsappTemplateDraft(input)`; inválido ⇒ `ValidationError` con los `code` en el
   diagnóstico (R14). La Server Action devuelve `invalid_input`; los mensajes por campo los pinta la
   pantalla con el mismo validador (D3 de QC-243).
3. `requireTemplateConnection` (R15, R20).
4. `templates.findLiveByNameAndLanguage(connection.id, name, language, scope)` ≠ `null` ⇒
   `WhatsappTemplateNameTakenError` sin llamar a Meta (R18).
5. `components = toMetaComponents(draft)`;
   `graph.createTemplate({ wabaId, accessToken, name, language, category, components })`.
6. Fallo ⇒ §4.9 (R19); no se escribe nada.
7. Éxito ⇒ `templates.insertCreated({ metaTemplateId: res.id, name, language, category:
   categoryOf(res.category) ?? draft.category, components, status: 'PENDING', createdById: actor.id,
   lastSyncedAt: now() }, connection.id, scope)` (R16, R17).
8. Devuelve `toWhatsappTemplateView(record)`.

**Nace `PENDING`** aunque Meta conteste otro estado: lo pide la ficha; el webhook o la siguiente
sincronización lo ponen al día.

**La carrera con el webhook.** Meta puede mandar `APPROVED` antes de que el paso 7 escriba: el webhook
no encuentra la plantilla y resincroniza (R38), y esa sincronización puede insertarla primero.
`insertCreated` hace `INSERT … ON CONFLICT (connection_id, meta_template_id) DO UPDATE SET created_by =
COALESCE(whatsapp_templates.created_by, EXCLUDED.created_by)` y no toca el estado: gana la fila de la
sincronización, que es más reciente, y conserva al creador. Un choque con el único parcial de nombre
e idioma (otra pestaña creó la misma entre 4 y 7) se traduce a `WhatsappTemplateNameTakenError`; en ese
caso Meta ya la tiene, y la siguiente sincronización la importa.

### 4.5 Eliminar (`domain/delete-whatsapp-template.ts`) — R42, R43

1. `requirePermission`, `scopeOf`.
2. `id` no UUID ⇒ `WhatsappTemplateNotFoundError` sin tocar puertos.
3. `requireTemplateConnection`.
4. `templates.findLiveById(id, scope)`; `null` o `connectionId !== connection.id` ⇒
   `WhatsappTemplateNotFoundError` (R43).
5. `graph.deleteTemplate({ wabaId, accessToken, hsmId: record.metaTemplateId, name: record.name })`
   (D4: con `hsm_id`, Meta borra solo ese idioma).
6. Fallo ⇒ §4.9 (`whatsapp_meta_rejected` o `whatsapp_meta_unreachable`) sin escribir.
7. Éxito ⇒ `templates.markDeleted(id, now(), scope)`; devuelve `{ id }`.

Si Meta dice que la plantilla ya no existe (se borró en WhatsApp Manager), el resultado es
`whatsapp_meta_rejected` y la siguiente sincronización la marca eliminada. Reconocer ese caso
necesitaría un código de Meta que el spec no puede confirmar.

### 4.6 Listar y consultar (`domain/list-whatsapp-templates.ts`) — R44–R46

- `createListWhatsappTemplates(deps)(input, actor)`: `input` con zod
  `{ onlyApproved?: boolean }` (inválido ⇒ `ValidationError`). `connections.findLive(scope)`; `null` ⇒
  `{ templates: [], templatesSyncedAt: null }`. Si no, `templates.listLive(connection.id,
  { onlyApproved }, scope)` ordenado por `name`, `language`. **No exige** que la conexión esté
  habilitada: leer la copia local no toca Meta.
- `createGetWhatsappTemplate(deps)(id, actor)`: viva y de la conexión viva ⇒ vista; si no ⇒
  `WhatsappTemplateNotFoundError`.

`toWhatsappTemplateView` campo a campo (precedente `toWhatsappConnectionView`), con
`content: contentOf(record.components)`.

### 4.7 La importación al crear la conexión (`domain/create-whatsapp-connection.ts`) — R29, R30

`CreateWhatsappConnectionDeps` gana `templates: WhatsappTemplateRepository` y el `graph` ya presente.
Tras `connections.create(...)`:

```ts
let templateImport: { ok: true; summary: TemplateSyncSummary } | { ok: false; code: string };
try {
  templateImport = { ok: true, summary: await syncConnectionTemplates(deps, record, data.accessToken, scope) };
} catch (error) {
  templateImport = { ok: false, code: codeOf(error) };     // mismo codeOf que expire-stale-orders
}
return { status: 'created', connection, verifyToken, templateImport };
```

El fallo no se traga: viaja en el resultado y la Server Action lo registra con
`console.error('whatsapp_templates_initial_sync_failed', { connectionId, code })` (R30). Se usa el
token en claro que acaba de validarse; no se vuelve a descifrar.

### 4.8 El cron (`domain/sync-all-whatsapp-templates.ts`) — R32, R33

```ts
export type SyncAllWhatsappTemplatesDeps = {
  listCompanyIds: () => Promise<readonly string[]>;
  integrations: IntegrationsSwitch;
  connections; cipher; graph; templates; now?; budgetMs?;
};
export type SyncAllResult = {
  synced: number;
  failed: readonly ({ stage: 'companies'; code } | { stage: 'connection'; companyId; code })[];
};
```

Forma de `createExpireStaleOrders`: lista de empresas (un fallo ⇒ `stage: 'companies'` y termina);
por cada una, mientras quede presupuesto (240 s): `integrations.isOn(companyId)` falso ⇒ siguiente;
`connections.findLive({ companyId })`; `null` o `status !== 'ACTIVE'` ⇒ siguiente (R32);
`decryptStoredSecret` y `syncConnectionTemplates` dentro de un `try` por conexión; fallo ⇒
`stage: 'connection'` y sigue (R33). Ninguna consulta lee dos empresas a la vez
(`docs/architecture.md > Crons internos`).

**Comprueba el añadido** aunque `docs/architecture.md` diga que los crons son núcleo: esta ruta es del
añadido `integraciones` y así la clasifica la guardia de rutas fuera de sesión (R35), igual que el
webhook.

### 4.9 Fallos de Graph (`domain/template-graph-failure.ts`) — R19, R21, R43

`GraphFailure` gana dos campos opcionales: `code: number | null` y `subcode: number | null` (los de
`error.code`/`error.error_subcode` de Meta). `fetchPhoneNumber` no los rellena y sus usos no cambian.

| Fallo | Crear | Sincronizar / eliminar |
|---|---|---|
| `unreachable` (red, timeout, 5xx) | `WhatsappMetaUnreachableError` | `WhatsappMetaUnreachableError` |
| `rejected` con «nombre e idioma ya existen» [POR CONFIRMAR: `error_subcode` 2388024] | `WhatsappTemplateNameTakenError` | — |
| `rejected` con «límite de creaciones» [POR CONFIRMAR: `code` 80008, o `error_subcode` del rango 23880xx] | `WhatsappTemplateRateLimitedError` | — |
| cualquier otro `rejected` | `WhatsappTemplateRejectedError` | `WhatsappMetaRejectedError` |

El adaptador `fetch` pasa a `unreachable` también las respuestas 5xx (hoy `fetchPhoneNumber` las trata
como `rejected`; ese comportamiento no se toca, las tres llamadas nuevas usan su propia rama).

El `diagnostic` de cada error lleva `code`, `subcode` y `metaMessageOf(failure, [accessToken,
appSecret])`: va al log del traductor, nunca a la respuesta, y con los secretos tachados (R21).

**Los números de la tabla son los que el spec cree vigentes y están sin confirmar** ([P4]): T3 los
contrasta. Si un código no se puede confirmar, ese caso cae en la fila «cualquier otro» y el
requisito se marca en la bitácora; no se inventa otro.

---

## 5. Puertos y adaptadores

### 5.1 `WhatsappTemplateRepository` (`ports/whatsapp-template-repository.ts`)

`scope` al final de cada firma, como `WhatsappConnectionRepository`:

```ts
export interface WhatsappTemplateRepository {
  listLive(connectionId: string, filter: { onlyApproved: boolean }, scope): Promise<readonly WhatsappTemplateRecord[]>;
  findLiveById(id: string, scope): Promise<WhatsappTemplateRecord | null>;
  findLiveByNameAndLanguage(connectionId: string, name: string, language: string, scope): Promise<WhatsappTemplateRecord | null>;
  insertCreated(row: NewCreatedTemplateRow, connectionId: string, scope): Promise<WhatsappTemplateRecord>;
  markDeleted(id: string, at: Date, scope): Promise<boolean>;
  listForSync(connectionId: string, scope): Promise<readonly TemplateSyncRow[]>;
  applySync(connectionId: string, plan: TemplateSyncPlan, startedAt: Date, at: Date, scope): Promise<void>;
  applyWebhookUpdates(connectionId: string, updates: readonly TemplateWebhookUpdate[], scope): Promise<{ unknown: number }>;
}
```

### 5.2 `persistence/whatsapp-template-prisma.ts`

Cada función con nombre declara `scope: IntegracionesScope` y filtra con
`whatsappTemplateCompanyScope(scope)` (nueva envoltura en `company-scope.ts`) o escribe con
`companyScopeColumns(scope)`.

- `listLive`: `where { connectionId, deletedAt: null, ...scope, status: onlyApproved ? 'APPROVED' :
  undefined }`, `orderBy [{ name: 'asc' }, { language: 'asc' }, { id: 'asc' }]`.
- `insertCreated`: `tx.$queryRaw` con el `INSERT … ON CONFLICT (connection_id, meta_template_id) DO
  UPDATE … RETURNING` de §4.4; un `23505` del índice `whatsapp_templates_name_language_live_key` ⇒
  `WhatsappTemplateNameTakenError` (reconocido por nombre, como `translateUniqueViolation` de QC-237).
- `markDeleted`: `updateMany where { id, deletedAt: null, ...scope }`; `count > 0`.
- `applySync`: **un** `prisma.$transaction`, en este orden para que una plantilla borrada y vuelta a
  crear en Meta con el mismo nombre e idioma no choque con el único parcial:
  1. `updateMany where { id in plan.deletes, connectionId, deletedAt: null, createdAt: { lt:
     startedAt }, ...scope } data { deletedAt: at, lastSyncedAt: at }` (R24: lo creado durante la
     sincronización no se borra).
  2. `updateMany` por cada `update` (por `id` y ámbito): campos de R23, `deletedAt: null`,
     `lastSyncedAt: at`. Las que no cambian también reciben `lastSyncedAt` (R23).
  3. `createMany({ data: inserts, skipDuplicates: true })` con `createdById: null`.
  4. `whatsappConnection.updateMany where { id: connectionId, deletedAt: null, ...connectionScope }
     data { templatesSyncedAt: at }` (R25, [P6]).
- `applyWebhookUpdates`: un `updateMany` por cambio, `where { connectionId, metaTemplateId, deletedAt:
  null, ...scope }`; `status` ⇒ `{ status, statusRaw, rejectedReason }`; `category` ⇒ `{ category }`.
  `unknown` = cuántos dieron `count = 0`. Sin transacción: cada `UPDATE` es atómico e idempotente.

`guard-ambito-empresa-integraciones.test.ts` gana el tercer puerto (8 métodos, mismo barrido) y la
quinta envoltura; la lista de exentos no cambia.

### 5.3 `WhatsappGraphClient` (se amplía)

```ts
createTemplate(input: { wabaId; accessToken; name; language; category; components: readonly unknown[] })
  : Promise<{ ok: true; id: string; status: string | null; category: string | null } | ({ ok: false } & GraphFailure)>;
listTemplatesPage(input: { wabaId; accessToken; after: string | null })
  : Promise<{ ok: true; items: readonly unknown[]; next: string | null } | ({ ok: false } & GraphFailure)>;
deleteTemplate(input: { wabaId; accessToken; hsmId: string; name: string })
  : Promise<{ ok: true } | ({ ok: false } & GraphFailure)>;
```

Los elementos de la lista viajan sin interpretar (`unknown`): los interpreta el dominio (§3.5), como
el cuerpo del webhook en QC-238.

---

## 6. Graph (`adapters/driven/graph/whatsapp-graph-client-fetch.ts`) — [P4] [POR CONFIRMAR]

Misma forma que `fetchPhoneNumber`: versión por `readGraphApiVersion()`, token **solo** en
`Authorization: Bearer`, `AbortSignal.timeout(10_000)`, `cache: 'no-store'`, nada registra la URL,
la cabecera ni el cuerpo.

| Llamada | Petición | Respuesta buena que se lee |
|---|---|---|
| crear | `POST /{v}/{waba_id}/message_templates`, JSON `{ name, language, category, components }` | `{ id: string, status?: string, category?: string }` |
| listar | `GET /{v}/{waba_id}/message_templates?fields=id,name,language,status,category,components,rejected_reason&limit=100[&after=<cursor>]` | `{ data: unknown[], paging?: { cursors?: { after?: string }, next?: string } }`; `next = paging.next ? paging.cursors.after : null` |
| borrar | `DELETE /{v}/{waba_id}/message_templates?hsm_id=<id>&name=<name>` | `{ success: true }` |

- El cursor se pide con `after` y no se sigue la URL `paging.next` tal cual: esa URL la arma Meta y
  puede llevar parámetros que no controlamos.
- Error: `{ error: { message, code?, error_subcode? } }` ⇒ `rejected` con `code`/`subcode`; 5xx o
  excepción de `fetch` ⇒ `unreachable`.
- `encodeURIComponent` en `waba_id`, `hsm_id`, `name` y `after`.

**Doble `canned`** (E2E de QC-243: «crear, ver pendiente, simular la aprobación por webhook»): guarda
en memoria del proceso un mapa `wabaId → plantillas`. `createTemplate` asigna un id numérico
creciente y la guarda; un nombre que empieza por `e2e_repetida` devuelve el fallo de «nombre
repetido»; `listTemplatesPage` devuelve lo guardado en una sola página; `deleteTemplate` la quita. Se
exporta `resetCannedTemplates()` para los tests. Sin esto, una sincronización manual en el E2E
borraría lo que se acaba de crear.

---

## 7. Webhook

### 7.1 Forma de los dos campos (`domain/whatsapp-template-webhook.ts`) — [P4] [POR CONFIRMAR]

```ts
// field: 'message_template_status_update'
{ event: string, message_template_id: number | string, message_template_name?: string,
  message_template_language?: string, reason?: string | null }
// field: 'template_category_update'
{ message_template_id: number | string, new_category: string, previous_category?: string }
```

`entry[].id` es el id de la WABA: un cambio de plantilla se acepta solo si coincide con
`record.wabaId` (R39). (Los de `messages` siguen comparando `metadata.phone_number_id`.)

### 7.2 Parser (`domain/whatsapp-webhook-payload.ts`)

`InboundBatch` gana `templateUpdates: readonly TemplateWebhookUpdate[]` y `skipped.templates`:

```ts
type TemplateWebhookUpdate =
  | { kind: 'status'; metaTemplateId: string; status; statusRaw; rejectedReason: string | null }
  | { kind: 'category'; metaTemplateId: string; category: WhatsappTemplateCategory };
```

- `parseWhatsappWebhook(json, phoneNumberId, wabaId)` (firma nueva; el caso de uso pasa
  `record.wabaId`).
- `field` ∈ {`message_template_status_update`, `template_category_update`} ⇒ zod de §7.1. Se salta
  con `skipped.templates += 1` si: `entry.id` ≠ `wabaId`, la forma no casa, el id no es un entero
  positivo (`/^[1-9]\d*$/` tras `String(...)`), la categoría es desconocida o un texto trae `\u0000`
  (R39, R41).
- `event` ⇒ `statusOf` (R4); `rejectedReason` = `reason` solo si el estado es `REJECTED` y `reason`
  no es vacío ni `NONE`, recortado a 500; si no, `null` (R36).
- Cualquier otro `field` que no sea `messages` se sigue saltando sin conteo (R14 de QC-238).

### 7.3 Caso de uso (`domain/receive-whatsapp-webhook.ts`)

`deps` gana `templates: WhatsappTemplateRepository`. Tras `inbox.record(batch, …)`:

```ts
const { unknown } = batch.templateUpdates.length === 0
  ? { unknown: 0 }
  : await deps.templates.applyWebhookUpdates(record.id, batch.templateUpdates, scope);
return { kind: 'stored', counts, skipped, followUp: unknown > 0 ? 'resync_templates' : null };
```

Dos escrituras separadas, no una transacción: los mensajes ya son idempotentes (`wamid` único) y los
statuses no retroceden; los cambios de plantilla son `UPDATE` idempotentes. Si `applyWebhookUpdates`
lanza, se propaga ⇒ `500` (R40) y el reintento de Meta repite las dos sin duplicar nada.

### 7.4 Ruta (`adapters/driving/whatsapp-webhook-route.ts`)

En el caso `stored`, si `result.followUp === 'resync_templates'`:

```ts
after(async () => {
  const outcome = await integraciones.resyncWhatsappTemplates(conexionId);
  if (outcome.kind === 'failed') console.error('whatsapp_templates_resync_failed', { connectionId, code: outcome.code });
});
```

`after` de `next/server` corre después de mandar la respuesta: Meta recibe su `200` sin esperar a
Graph (R38), y el fallo solo deja una línea de log. Como mucho una vez por `POST` porque `followUp` es
un solo valor. `connectionId` en el log solo tras validarse como UUID, como hoy.

No se añade `maxDuration` a la ruta: si la resincronización no termina, el cron diario la corrige
(D1).

---

## 8. Cron

### 8.1 `app/api/cron/sincronizar-plantillas-whatsapp/route.ts`

```ts
export { GET } from '@/lib/modules/integraciones/adapters/driving/whatsapp-template-cron-route';
export const runtime = 'nodejs';
export const maxDuration = 300;
```

Literales, por el motivo que documenta `caducar-pedidos/route.ts`.

### 8.2 `adapters/driving/whatsapp-template-cron-route.ts`

Copia de `order-expiry-cron-route.ts`:

1. `integraciones.verifyCronSecret(request.headers.get('authorization'))`; `misconfigured` ⇒
   `console.error('whatsapp_templates_cron_misconfigured')` y `500`; `unauthorized` ⇒ `401` (R31).
2. `const result = await integraciones.syncAllWhatsappTemplates()`.
3. Con fallos ⇒ `console.error('whatsapp_templates_cron_failed', { failedCount, failed })` y
   `Response.json({ synced, failed: failedCount }, { status: 500 })`; sin fallos ⇒
   `Response.json({ synced, failed: 0 })` (R33). `failed` lleva `stage`, `companyId` y `code`, nunca
   un mensaje de Meta.

`verifyCronSecret` es el adaptador de `pedidos` (`cron-secret-env.ts`), cableado en la fachada
`integraciones` desde `lib/composition` (§10): la composición es el único sitio que puede importar un
adaptador de cualquier módulo.

### 8.3 `vercel.json`

```json
{ "path": "/api/cron/sincronizar-plantillas-whatsapp", "schedule": "0 8 * * *" }
```

[P9]: hora aprobada el 2026-10-20; el límite de crons del plan de Vercel sigue [POR CONFIRMAR]. `tests/unit/pedidos/vercel-cron.test.ts`
hoy exige **exactamente un** cron; se cambia para buscar el suyo por `path` (sigue fijando una sola
ejecución al día) y se añade el caso equivalente para el nuevo (R34).

---

## 9. Server Actions (`adapters/driving/whatsapp-template-actions.ts`) — R47, R48

`'use server'`, `currentActor()` y `toErrorState` como `whatsapp-connection-actions.ts`.

```ts
export type WhatsappTemplateListResult = { status: 'success'; data: WhatsappTemplateList } | ErrorState;
export type WhatsappTemplateCreateResult = { status: 'success'; data: WhatsappTemplateView } | ErrorState;
export type WhatsappTemplateSyncResult = { status: 'success'; data: TemplateSyncSummary } | ErrorState;
export type WhatsappTemplateDeleteResult = { status: 'success'; data: { id: string } } | ErrorState;

export async function listWhatsappTemplatesAction(input?: { onlyApproved?: boolean }): Promise<WhatsappTemplateListResult>;
export async function createWhatsappTemplateAction(draft: unknown): Promise<WhatsappTemplateCreateResult>;
export async function syncWhatsappTemplatesAction(): Promise<WhatsappTemplateSyncResult>;
export async function deleteWhatsappTemplateAction(id: string): Promise<WhatsappTemplateDeleteResult>;
```

- **Argumentos planos, no `FormData`**: el borrador es anidado (botones, ejemplos) y `FormData` lo
  aplana; QC-243 llama a la acción desde su `onSubmit`. El dominio valida igual cualquier cosa que
  llegue (`unknown`).
- Las tres de escritura llaman `revalidatePath(WHATSAPP_INTEGRATION_ROUTE)` en éxito.
- Lo único de la conexión que sale es `templatesSyncedAt` (R48).
- El test de «una lectura de sesión por petición» lee `adapters/driving/` del disco: la acción nueva
  entra sola en su barrido.

`whatsapp-connection-actions.ts` solo cambia en `createWhatsappConnectionAction`: el log de §4.7. Su
estado de formulario no cambia.

---

## 10. Composición (`lib/composition/index.ts`)

En el bloque de WhatsApp de `integraciones`, sin reordenar nada:

```ts
const whatsappGraphClient: WhatsappGraphClient = {
  fetchPhoneNumber: …,                                 // como hoy
  createTemplate: (i) => integrationsE2EDoublesEnabled() ? whatsappGraphClientCanned.createTemplate(i) : whatsappGraphClientFetch.createTemplate(i),
  listTemplatesPage: (i) => …,                         // misma elección por llamada
  deleteTemplate: (i) => …,
};
const whatsappTemplateRepository: WhatsappTemplateRepository = {
  listLive: listLiveWhatsappTemplates, findLiveById: findLiveWhatsappTemplateById,
  findLiveByNameAndLanguage: findLiveWhatsappTemplateByNameAndLanguage,
  insertCreated: insertCreatedWhatsappTemplate, markDeleted: markWhatsappTemplateDeleted,
  listForSync: listWhatsappTemplatesForSync, applySync: applyWhatsappTemplateSync,
  applyWebhookUpdates: applyWhatsappTemplateWebhookUpdates,
};
// whatsappDeps gana `templates`; whatsappWebhookDeps gana `templates` y `graph`.
const whatsappTemplateCronDeps = { ...whatsappWebhookDeps, listCompanyIds: listActiveCompanyIds };

// en `integraciones`, al final:
listWhatsappTemplates, getWhatsappTemplate, createWhatsappTemplate, syncWhatsappTemplates,
deleteWhatsappTemplate, resyncWhatsappTemplates, syncAllWhatsappTemplates,
verifyCronSecret,                                     // el de `pedidos`, ya importado arriba
```

`whatsappWebhookDeps` gana `graph` solo para `resyncWhatsappTemplates`; `receiveWhatsappWebhook`
sigue sin llamarlo (el test de QC-238 «`fetch` espiado no se llama» sigue verde: la resincronización
corre en `after`, fuera del caso de uso).

---

## 11. Contrato del módulo (`index.ts`)

Se suman: `createListWhatsappTemplates`, `createGetWhatsappTemplate`, `createCreateWhatsappTemplate`,
`createSyncWhatsappTemplates`, `createResyncWhatsappTemplates`, `createSyncAllWhatsappTemplates`,
`createDeleteWhatsappTemplate`, `validateWhatsappTemplateDraft`, `TEMPLATE_LIMITS`,
`WHATSAPP_TEMPLATE_LANGUAGES`, `CREATABLE_TEMPLATE_CATEGORIES`, los 6 errores, y los tipos
`WhatsappTemplateView`, `WhatsappTemplateList`, `WhatsappTemplateContent`, `WhatsappTemplateDraft`,
`WhatsappTemplateButton`, `WhatsappTemplateIssue`, `WhatsappTemplateStatus`,
`WhatsappTemplateCategory`, `TemplateSyncSummary`.

---

## 12. Errores (`errores` + `integraciones/domain/errors.ts`) — R51

Enmienda del catálogo (106 → 112 en `catalogo.test.ts`, o lo que haya en `dev` + 6 al sincronizar):

| Código | Texto |
|---|---|
| `whatsapp_template_not_found` | No se encontró la plantilla. |
| `whatsapp_template_name_taken` | Ya existe una plantilla con ese nombre en ese idioma. |
| `whatsapp_template_rate_limited` | Meta no permite crear más plantillas por ahora. Intenta de nuevo más tarde. |
| `whatsapp_template_rejected` | Meta rechazó la plantilla. Revisa el contenido e intenta de nuevo. |
| `whatsapp_meta_rejected` | Meta rechazó la solicitud. Intenta de nuevo o revisa la conexión. |
| `whatsapp_meta_unreachable` | No se pudo contactar con Meta. Intenta de nuevo en unos minutos. |

Cada uno con su clase en `errors.ts` (`IntegracionesError`), exportada por `index.ts`.

---

## 13. La guía de la pestaña Conexión — R49, [P8]

`WHATSAPP_SETUP_GUIDE_STEPS` gana, al final:

> «Webhook: en tu app › WhatsApp › Configuración, suscribe los campos messages,
> message_template_status_update y template_category_update.»

Solo una cadena más en el arreglo; el componente, su marcado y sus estilos no cambian.
`tests/unit/integraciones-ui/whatsapp-page.test.tsx` ya recorre todos los pasos; se añade un caso que
busca los tres nombres de campo.

---

## 14. Tests

### 14.1 Nuevos

| Archivo | Cubre |
|---|---|
| `tests/unit/integraciones/whatsapp/templates/whatsapp-template-draft.test.ts` | R6 (sin imports de servidor, vía `module-shape`), R7–R13: un caso por fila de §3.3 en el límite exacto y uno más; `{{nombre}}`, `{{0}}`, `{{1}}{{3}}`, ejemplo de más; header con `{{2}}`; botones 11, 3 URL, 2 teléfonos, respuestas rápidas intercaladas; emoji cuenta 1 |
| `…/templates/whatsapp-template-components.test.ts` | ida y vuelta borrador ⇄ componentes; `contentOf` con header `IMAGE`, botón `OTP` y forma rota ⇒ `null` (R46) |
| `…/templates/whatsapp-template-meta.test.ts` | R4 (cinco conocidos y `IN_APPEAL` ⇒ `OTHER` crudo), R26 (sin id, sin nombre, categoría desconocida, `\u0000`), `rejected_reason` `NONE` ⇒ `null` |
| `…/templates/template-sync-plan.test.ts` | R23–R25 por tabla (§4.3) |
| `…/templates/sync-whatsapp-templates.test.ts` | R22 (tres páginas, falla la segunda ⇒ `applySync` no se llama), tope de páginas, R27 (espía: ni `createTemplate` ni `deleteTemplate`), R28, R15, R20, R5; reintento del webhook: conexión deshabilitada o añadido apagado ⇒ `skipped`, fallo ⇒ `failed` sin lanzar |
| `…/templates/sync-all-whatsapp-templates.test.ts` | R32 (`ACTIVE` sí; `PENDING`/`ERROR`/`DISABLED` y añadido apagado no), R33 (la segunda falla, la tercera se sincroniza; `failed` con `companyId` y `code`), fallo al listar empresas, presupuesto agotado. Es la `prueba` de la guardia (R35) |
| `…/templates/create-whatsapp-template.test.ts` | R5 (orden: sin permiso no valida), R14 (inválido ⇒ Graph no llamado), R15, R16 (`PENDING`, creador, componentes), R17, R18, R19 (cada fila de §4.9), R20, R21 (el token no aparece en ningún `diagnostic` ni mensaje) |
| `…/templates/delete-whatsapp-template.test.ts` | R42 (Graph recibe `hsmId` y `name`), R43 (no UUID, de otra conexión, eliminada ⇒ sin Graph; Meta rechaza ⇒ sin `markDeleted`) |
| `…/templates/list-whatsapp-templates.test.ts` | R44 (orden, «solo aprobadas», sin conexión ⇒ vacía), R45, R46 (claves exactas de la vista) |
| `…/templates/whatsapp-template-actions.test.ts` | R47 (contrato de cada acción, `revalidatePath` en las tres de escritura), R48 (claves exactas de `data`), R5 (actor sin permiso ⇒ `unauthorized`) |
| `…/templates/whatsapp-template-cron-route.test.ts` | R31 (sin cabecera, incorrecta, variable ausente ⇒ ningún caso de uso llamado), R33 (códigos y cuerpo) |
| `…/templates/whatsapp-graph-client-templates.test.ts` | §6 con `fetch` espiado: URL, método, cabecera, cursor `after`, `5xx` ⇒ `unreachable`, `code`/`subcode` leídos; el token no está en la URL |
| `…/templates/whatsapp-graph-client-canned-templates.test.ts` | el doble: crear, listar, borrar, `e2e_repetida` |
| `tests/integration/integraciones/whatsapp-template-prisma.int.test.ts` | R1 (FK compuesta rechaza empresa distinta), R2 (único parcial: eliminada + nueva con el mismo nombre e idioma entra; dos vivas no), R3 (empresa B no ve ni actualiza las de A, también por webhook), R24 (una creada después de `startedAt` no se borra), R25 (`templatesSyncedAt`), la carrera de §4.4, `applySync` con borrada y recreada en Meta con el mismo nombre |
| `tests/integration/integraciones/whatsapp-template-migration.int.test.ts` | R50: `down.sql` y vuelta dejan el mismo esquema; RLS forzada en `pg_class`; índices por nombre en `pg_indexes` |
| `tests/integration/integraciones/whatsapp-template-flow.int.test.ts` | Recorrido real con el doble `canned`: crear ⇒ `PENDING`; webhook `APPROVED` firmado por la ruta ⇒ `APPROVED`; `REJECTED` ⇒ motivo; categoría; webhook de un id desconocido ⇒ `after` resincroniza (con `after` sustituido por una cola que el test vacía); eliminar en `es` no toca `en` (criterios de aceptación de la ficha) |

### 14.2 Tests y guardias que se tensan (nunca se relajan)

| Archivo | Cambio |
|---|---|
| `tests/unit/integraciones/whatsapp/whatsapp-webhook-payload.test.ts` | R14 de QC-238 usa `account_update` como campo ajeno; casos nuevos R36, R37, R39, R41 |
| `tests/unit/integraciones/whatsapp/receive-whatsapp-webhook.test.ts` | R40 (mensajes + plantillas, y fallo de plantillas ⇒ lanza), `followUp` con un id desconocido |
| `tests/unit/integraciones/whatsapp/whatsapp-webhook-route.test.ts` | R38: `after` llamado una vez con `followUp`, ninguna sin él; el fallo de la resincronización no cambia el `200` |
| `tests/unit/integraciones/whatsapp/create-whatsapp-connection.test.ts` | R29 (sincroniza con el token del formulario), R30 (Graph de plantillas falla ⇒ `created` y `templateImport.ok === false`) |
| `tests/unit/integraciones/whatsapp/whatsapp-connection-actions.test.ts` | R30: el log `whatsapp_templates_initial_sync_failed` sin secretos |
| `tests/unit/integraciones/whatsapp/whatsapp-doubles.ts` | doble del repositorio de plantillas y de los tres métodos de Graph |
| `tests/unit/integraciones/module-shape.test.ts` | R18 lista de archivos; R20 contrato; R19 cableado y quién importa el módulo (+ la ruta del cron); R13 modelos de cinco a seis (+ `WhatsappTemplate`); caso nuevo R6 (el validador solo importa `zod` y `domain/`) |
| `tests/guards/guard-ambito-empresa-integraciones.test.ts` | tercer puerto (8 métodos), quinta envoltura |
| `tests/guards/guard-rutas-fuera-de-sesion.test.ts` | + `'app/api/cron/sincronizar-plantillas-whatsapp/route.ts': { anadido: 'integraciones', prueba: 'tests/unit/integraciones/whatsapp/templates/sync-all-whatsapp-templates.test.ts' }` (R35) |
| `tests/unit/pedidos/vercel-cron.test.ts` | busca su cron por `path`; caso nuevo para el de plantillas (R34) |
| `tests/unit/errores/catalogo.test.ts` | cuenta + 6 (R51) |
| `tests/unit/integraciones-ui/whatsapp-page.test.tsx` | R49 |
| `tests/integration/aislamiento.json` | los tres `.int.test.ts` nuevos, con `commit` y `motivo` como los de QC-238 |

**Sin E2E de Playwright en esta ficha**: no hay pantalla. El E2E de plantillas lo pide QC-243 y usa el
doble de §6. Verificación manual con Meta (opcional, fuera del gate): crear una plantilla en una WABA
de prueba, ver el webhook `APPROVED`, borrarla; evidencia a `progress/impl_QC-242.md`.

---

## 15. Fronteras con otras fichas y choques previsibles

- **QC-243** consume las cuatro acciones, `validateWhatsappTemplateDraft`, `TEMPLATE_LIMITS`,
  `WHATSAPP_TEMPLATE_LANGUAGES` y la vista; habilita la pestaña. Su E2E usa el doble `canned`.
- **QC-240/QC-241** envían por nombre e idioma; no validan contra esta tabla (lo dice su ficha).
- **QC-245/QC-247** eligen plantillas con «solo aprobadas». Esta ficha exige `integraciones.modificar`
  para listar (D2); si quien envía no es Administrador, esas fichas necesitarán una consulta propia.
- **D77** (mensaje «veneno»): R41 evita que un cambio de plantilla abra un caso nuevo; los dos casos
  de mensajes siguen abiertos.

| Archivo | Con quién | Cómo se resuelve |
|---|---|---|
| `db/schema.prisma`, `db/migrations/` | Fichas con esquema en vuelo (QC-131, QC-274, QC-279 del mismo autor; otras según `archivos-en-vuelo --candidata`) | Bloque nuevo al final; timestamp re-fechado en F2.3 si `dev` trae una posterior |
| `lib/composition/index.ts` | Todas las fichas con cableado | Solo el bloque de WhatsApp de `integraciones` |
| `vercel.json`, `tests/unit/pedidos/vercel-cron.test.ts` | QC-241 (cron de barrido) | Entrada nueva; el test por `path` ya admite la de QC-241 |
| `lib/modules/errores/domain/*`, `catalogo.test.ts` | Toda ficha con códigos nuevos | Se suma al final; la cuenta se ajusta al sincronizar con `dev` |
| `tests/guards/guard-rutas-fuera-de-sesion.test.ts`, `tests/integration/aislamiento.json` | Fichas con rutas o tests de integración | Una entrada más |
| `lib/modules/integraciones/**`, `module-shape.test.ts`, guardia de ámbito | QC-239, QC-240, QC-241 (mismo módulo) | La que llegue después amplía las listas exactas |

---

## 16. Alternativas descartadas

1. **Consultar Meta en cada carga de la pantalla, sin copia local.** Lo descarta D1: cada carga
   gastaría una llamada a Graph y la lista dependería de que Meta responda.
2. **Resincronizar dentro del `POST` del webhook, antes de responder.** Una sincronización son varias
   llamadas a Graph de hasta 10 s cada una: Meta esperaría la respuesta y reintentaría por timeout,
   repitiendo todo el lote. Con `after` el `200` sale primero.
3. **Encolar la resincronización en QStash.** Daría reintentos, pero añade un consumidor, una firma y
   una ruta para algo que el cron diario ya corrige; `after` basta.
4. **Una sola transacción para mensajes y cambios de plantillas del webhook.** Obliga a meter el
   repositorio de plantillas dentro del `inbox` de QC-238. Las dos escrituras ya son idempotentes, así
   que separarlas no deja estados a medias que un reintento no arregle.
5. **Sincronizar escribiendo página a página.** Una página que falla a mitad dejaría marcadas como
   eliminadas las plantillas de las páginas no leídas. Se lee todo y se escribe en una transacción.
6. **Único total `(connectionId, name, language)`** como lo escribe la ficha: una plantilla eliminada
   bloquearía para siempre ese nombre e idioma, incluso cuando Meta ya permite reutilizarlo ([P1]).
7. **Copiar `cron-secret-env.ts` dentro de `integraciones`, o moverlo a `lib/shared/`.** Copiarlo
   duplica código de seguridad que puede divergir; moverlo toca `pedidos` y sus tests fuera del
   alcance. Cablear el mismo adaptador desde la composición reutiliza sin tocar `pedidos`.
8. **Server Actions con `FormData`** como las de la conexión: el borrador anidado obligaría a un
   formato de nombres de campo propio y a reconstruirlo en el servidor.
9. **Guardar `PENDING` solo si Meta no devuelve estado.** Más exacto, pero la ficha pide que nazca
   `PENDING` y su criterio de aceptación lo comprueba; el webhook lo corrige en segundos.
10. **Añadir `OTHER` también a la categoría** ([P7]): la ficha fija tres valores y no hay caso
    conocido de una cuarta hoy.

---

## 17. Dependencias de terceros y entorno

**Ninguna** (R52). `after` es de `next/server` (Next 16.3.0, ya instalado); `zod` ya está; `fetch` y
`AbortSignal.timeout` son de la plataforma. `package.json` no cambia. Ninguna variable nueva: se usan
`CRON_SECRET` (QC-141), `WHATSAPP_GRAPH_API_VERSION` y las de cifrado (QC-234/QC-237).

---

## 18. Enmienda 2026-10-20 — diccionario de variables (R53–R86)

Decisiones del humano E1–E14 en `requirements.md > Enmienda 2026-10-20`; propuestas [P10]–[P18].

### 18.0 Lo que ya existe

Buscado `variable_key`, `VariableKey`, `diccionario de variables`, `whatsapp_event_templates` y
`variables con nombre` en `feature_list.json` (por `key` QC-243, QC-245, QC-247), `specs/` y el código
(Grep; el grafo no tiene indexado este worktree tras el merge). Para la lista de constantes ([P11]) se
leyeron `Customer`, `Order` y `Company` en `db/schema.prisma`.

| Apareció | Qué es | Qué se hace |
|---|---|---|
| Lo implementado de QC-242 (`lib/modules/integraciones/**/whatsapp-template*`, `template-sync-plan.ts`, `whatsapp-template-prisma.ts`, `whatsapp-template-actions.ts`) | Modelo, validador `{{n}}`, `toMetaComponents`/`contentOf`, plan de sincronización, repositorio y acciones | **Se amplía.** Nada se reescribe: el validador `{{n}}` queda como regla de Meta detrás de la traducción |
| QC-247 (`pending`): catálogo de eventos en código con `cliente.nombre`, `pedido.numero`, `pedido.fecha_entrega`, `empresa.nombre`, y `whatsapp_event_templates` con «mapeo de variables (`{{1}}` → `cliente.nombre`)» | Consumidor | Las constantes del sistema (E3) cubren lo que su mapeo hacía: con la enmienda, la plantilla ya sabe de dónde sale cada variable. Su spec decide si su mapeo desaparece. No existe aún: no hay código que cambiar |
| QC-245 (`pending`): «valida que la cantidad de parámetros coincida con sus variables» | Consumidor | Con la enmienda, toma de la vista los huecos (R81) y arma los parámetros con los resolvedores de las constantes y los valores de las propias |
| QC-243 (`pending`): «Agregar variable inserta `{{n}}`», «campo de ejemplo obligatorio por variable» | La pantalla | Pasa a insertar `{{clave}}`; frontera en §18.11 |
| Contraste con Meta (`progress/impl_QC-242.md`): Meta tiene `parameter_format: named` | La opción B | Descartada (§18.12) |
| Ninguna tabla, puerto ni caso de uso de diccionario | — | Nace aquí |

Sin UI: no se consulta `components/shared/CATALOGO.md` ni hay pase `/design`.

### 18.1 Qué cambia (resumen)

```
db/schema.prisma                                ← 1 enum, WhatsappVariableKey, WhatsappTemplateVariable, + mappingStatus y enabled en WhatsappTemplate
db/migrations/20261020180000_whatsapp_variable_keys/{migration,down}.sql
lib/modules/errores/domain/{error-codes,error-catalog}.ts   ← + 5 códigos
lib/modules/integraciones/
  index.ts                                      ← + fábricas, validadores, catálogo de constantes, tipos, errores
  domain/
    errors.ts                                   ← + 5 errores
    whatsapp-system-variables.ts                ← nuevo: catálogo de constantes del sistema (R53, R55, [P11])
    whatsapp-variable-key.ts                    ← nuevo: variable propia, límites, validador puro (R54)
    whatsapp-template-variables.ts              ← nuevo: huecos, estado del mapeo, traducción {{clave}} ⇄ {{n}} (R64, R65, R67, R81)
    whatsapp-template-keyed-draft.ts            ← nuevo: validador público con claves (R66, R67)
    whatsapp-template-draft.ts                  ← + código de problema `unknown_key`
    whatsapp-template.ts                        ← record y vista ampliados
    template-sync-plan.ts                       ← + qué filas pierden la relación (R70, R71)
    create-whatsapp-template.ts                 ← borrador con claves, relación, carrera (R66–R69)
    list-whatsapp-templates.ts                  ← vista traducida (R81, R82)
    manage-whatsapp-variable-keys.ts            ← nuevo: listar, crear, modificar, eliminar (R56–R62)
    relate-whatsapp-template-variables.ts       ← nuevo: relacionar, habilitar, deshabilitar (R72, R74–R80)
  ports/
    whatsapp-variable-key-repository.ts         ← nuevo
    whatsapp-template-repository.ts             ← + replaceVariables, setEnabled; insertCreated con relación
  adapters/driven/persistence/
    company-scope.ts                            ← + whatsappVariableKeyCompanyScope, whatsappTemplateVariableCompanyScope
    whatsapp-variable-key-prisma.ts             ← nuevo
    whatsapp-template-prisma.ts                 ← relaciones en el record; applySync y markDeleted las quitan
  adapters/driving/
    whatsapp-variable-key-actions.ts            ← nuevo: 4 Server Actions
    whatsapp-template-actions.ts                ← + 2 Server Actions
lib/composition/index.ts                        ← amplía `integraciones`
tests/**                                        ← §18.10
```

### 18.2 Modelo de datos

```prisma
enum WhatsappTemplateMappingStatus {
  UNMAPPED
  MAPPED
  @@map("whatsapp_template_mapping_status")
}

/// @module integraciones
model WhatsappVariableKey {                         // variables propias; las constantes viven en código
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  companyId String   @map("company_id") @db.Uuid
  key       String
  label     String
  value     String
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)

  @@unique([companyId, key], map: "whatsapp_variable_keys_company_key_key")
  @@unique([companyId, id], map: "whatsapp_variable_keys_company_id_id_key")
  @@map("whatsapp_variable_keys")
}

/// @module integraciones
model WhatsappTemplateVariable {
  id            String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  companyId     String   @map("company_id") @db.Uuid
  templateId    String   @map("template_id") @db.Uuid
  slot          String
  variableKeyId String?  @map("variable_key_id") @db.Uuid     // variable propia
  systemKey     String?  @map("system_key")                   // constante del sistema
  createdAt     DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  @@unique([templateId, slot], map: "whatsapp_template_variables_template_slot_key")
  @@index([variableKeyId], map: "whatsapp_template_variables_variable_key_idx")
  @@map("whatsapp_template_variables")
}
```

`WhatsappTemplate` gana `mappingStatus WhatsappTemplateMappingStatus @default(UNMAPPED)
@map("mapping_status")`, `enabled Boolean @default(false)` y `@@unique([companyId, id], map:
"whatsapp_templates_company_id_id_key")` (clave de la FK compuesta).

Decisiones del modelo:

- **Constantes en código, variables propias en la base** (E3, E4, E16). Una constante no tiene fila:
  su clave, etiqueta y de qué dato sale viven en `domain/whatsapp-system-variables.ts`, iguales para
  todas las empresas y de solo lectura (R55). La relación de un hueco apunta a una de las dos:
  `CHECK (("variable_key_id" IS NULL) <> ("system_key" IS NULL))` y
  `CHECK ("system_key" IS NULL OR "system_key" ~ '^[a-z][a-z0-9_]{0,39}$')` (misma forma que una
  propia, [P10]). Que la constante exista en el catálogo lo comprueba el dominio: la base no conoce el
  catálogo. Ejemplo de E16: la fila `(slot 'body.1', system_key 'nombre')` es el «`1 = nombre`».
- **Una tabla de relaciones, no un `jsonb` en la plantilla.** La FK a la variable propia con
  `ON DELETE RESTRICT` hace que la base impida borrar una en uso (R59) y la FK compuesta
  `(company_id, …)` impide cruzar empresas (R63). Un `jsonb` no da ninguna de las dos (§18.12).
- **`slot` como texto con forma fija**: `header`, `body.<n>` (n ≥ 1) o `button.<i>` (posición del botón,
  0–9). `CHECK ("slot" ~ '^(header|body\.[1-9][0-9]*|button\.[0-9])$')`. Un hueco es una cadena estable
  que viaja igual en la vista, en la acción de relacionar y en la base.
- **El estado del mapeo se guarda** (E5 lo llama «campo»): lo escribe el dominio en cada escritura de
  relaciones o componentes (R65), nunca el usuario. Guardarlo permite fijar en la base la regla de E8 y
  R80: `CHECK (NOT "enabled" OR "mapping_status" = 'MAPPED')`. Una plantilla habilitada «sin relacionar»
  no se puede escribir ni por error.
- **Borrado físico de la variable propia**: el resto del módulo usa `deletedAt`, pero aquí un borrado
  lógico dejaría a la FK sin efecto. Las relaciones de una plantilla que se marca eliminada se borran en
  la misma transacción (R73), para que no retengan la variable.
- **Renombrar la clave** (R58) no toca las relaciones: apuntan al `id`. E7 lo restringe igual, porque la
  clave se ve en el contenido de las plantillas (`{{clave}}`, R81).
- **Sin `@relation`** (como §2.1): FK escritas a mano en la migración.
- Una variable usada en una plantilla de una conexión ya borrada sigue «en uso» mientras esa plantilla
  no esté eliminada. Se acepta: es raro y se ve en el conteo de R60.

### 18.3 Migración `20261020180000_whatsapp_variable_keys`

A mano, en orden:

1. `CREATE TYPE "whatsapp_template_mapping_status" AS ENUM ('UNMAPPED', 'MAPPED')`.
2. `CREATE TABLE "whatsapp_variable_keys"` con `CHECK ("key" ~ '^[a-z][a-z0-9_]{0,39}$')`,
   `CHECK (length("label") BETWEEN 1 AND 60)`, `CHECK (length("value") BETWEEN 1 AND 50)` (E14) y
   `CHECK (position('{{' in "value") = 0 AND position('}}' in "value") = 0)`; el dominio mide en puntos
   de código como §3.3 y `length` de Postgres UTF-8 también; `updated_at` sin default; únicos de §18.2;
   FK `company_id → companies(id)`.
3. `CREATE UNIQUE INDEX "whatsapp_templates_company_id_id_key" ON "whatsapp_templates" ("company_id", "id")`.
4. `ALTER TABLE "whatsapp_templates" ADD COLUMN "mapping_status" "whatsapp_template_mapping_status" NOT
   NULL DEFAULT 'UNMAPPED', ADD COLUMN "enabled" BOOLEAN NOT NULL DEFAULT false`, y el `CHECK` de
   `enabled` de §18.2 (`whatsapp_templates_enabled_requires_mapped`).
5. `CREATE TABLE "whatsapp_template_variables"` con los tres `CHECK`, el único y el índice de §18.2; FK
   `(company_id, template_id) → whatsapp_templates (company_id, id)` y `(company_id, variable_key_id) →
   whatsapp_variable_keys (company_id, id)` (una FK compuesta con una columna nula no se comprueba, que
   es lo buscado para las constantes), las dos `ON DELETE RESTRICT ON UPDATE CASCADE`; `company_id →
   companies(id)`.
6. **Relleno** (R86): las filas existentes quedan sin relaciones; las vivas que cumplen R70 traducido a
   SQL pasan a `MAPPED` y `enabled = true`:
   ```sql
   UPDATE "whatsapp_templates" SET "mapping_status" = 'MAPPED', "enabled" = true
   WHERE "deleted_at" IS NULL
     AND position('{{' in "components"::text) = 0
     AND jsonb_path_exists("components", '$[*] ? (@.type == "BODY")')
     AND NOT jsonb_path_exists("components", '$[*] ? (@.type == "HEADER" && @.format != "TEXT")')
     AND NOT jsonb_path_exists("components", '$[*].buttons[*] ? (@.type != "QUICK_REPLY" && @.type != "URL" && @.type != "PHONE_NUMBER")');
   ```
   Es una aproximación de `contentOf` (no detecta componentes repetidos); el test de migración fija los
   casos de §18.10. Si `dev` y la migración de §2.2 llegan juntas a producción, el relleno corre sobre
   cero filas.
7. `ENABLE` y `FORCE ROW LEVEL SECURITY` en las dos tablas nuevas, sin policies (R84).

`down.sql`: `DROP TABLE "whatsapp_template_variables"`, `ALTER TABLE "whatsapp_templates" DROP
CONSTRAINT "whatsapp_templates_enabled_requires_mapped", DROP COLUMN "enabled", DROP COLUMN
"mapping_status"`, `DROP INDEX "whatsapp_templates_company_id_id_key"`, `DROP TABLE
"whatsapp_variable_keys"`, `DROP TYPE "whatsapp_template_mapping_status"`.

`guard-empresa-en-esquema`: las dos tablas tienen `company_id`. `guard-rls-force` las ve por la
migración. Sin filas de permisos nuevas.

### 18.4 Dominio: constantes y variables propias — R53–R55, R60

**Constantes (`domain/whatsapp-system-variables.ts`)**, lista inicial de [P11]:

```ts
export type SystemVariableSource = 'customer' | 'order' | 'company';
export type SystemVariable = { key: string; label: string; source: SystemVariableSource; field: string };
export const WHATSAPP_SYSTEM_VARIABLES: readonly SystemVariable[] = [
  { key: 'nombre', label: 'Nombre del cliente', source: 'customer', field: 'name' },        // E16; [P11] firstNames o nombres + apellidos
  { key: 'pedido_numero', label: 'Número de pedido', source: 'order', field: 'number' },     // [P11] [POR CONFIRMAR] la forma del número
  { key: 'empresa_nombre', label: 'Nombre de la empresa', source: 'company', field: 'name' },
];
export function systemVariableOf(key: string): SystemVariable | null;
```

`source`/`field` dicen de qué dato sale el valor; **leerlo no es de esta ficha** ([P11]): QC-245 y
QC-247 implementan el resolvedor, con el cliente, el pedido y la empresa que ya tienen al enviar. Un
test fija que las claves del catálogo son únicas y cumplen `WHATSAPP_VARIABLE_KEY_PATTERN`.

**Variables propias (`domain/whatsapp-variable-key.ts`)**:

```ts
export const WHATSAPP_VARIABLE_KEY_LIMITS = { keyMaxLength: 40, labelMaxLength: 60, valueMaxLength: 50 } as const;
export const WHATSAPP_VARIABLE_KEY_PATTERN = /^[a-z][a-z0-9_]*$/;

export type WhatsappVariableKeyRecord = { id; companyId; key; label; value; createdAt: Date };
export type WhatsappVariableKeyInput = { key: string; label: string; value: string };
export type WhatsappDictionaryEntryView =                       // R60, campo a campo
  | { kind: 'system'; id: null; key; label; value: null; usedBy: number }
  | { kind: 'company'; id: string; key; label; value: string; usedBy: number };

export function validateWhatsappVariableKeyInput(input: unknown):
  | { ok: true; value: WhatsappVariableKeyInput }
  | { ok: false; issues: readonly WhatsappTemplateIssue[] };
```

Puro, como el validador de §3.3: solo `zod` y `domain/`. Mismos criterios de §3.3: puntos de código,
rechaza solo espacios y `\u0000`. El valor: obligatorio, 1–50 (E14), sin `{{` ni `}}` porque irá
dentro de un parámetro de Meta. La modificación recibe los tres campos: si la clave no cambia, es
R57; si cambia, R58.

### 18.5 Dominio: huecos, estado del mapeo y traducción (`domain/whatsapp-template-variables.ts`) — R64, R65, R71, R81

```ts
export type TemplateSlot = 'header' | `body.${number}` | `button.${number}`;
export type TemplateVariableBinding =
  | { slot: TemplateSlot; kind: 'system'; systemKey: string }
  | { slot: TemplateSlot; kind: 'company'; variableKeyId: string };

export function variableSlotsOf(content: WhatsappTemplateContent | null): readonly TemplateSlot[] | null;
export function mappingStatusOf(components: unknown, bindings: readonly TemplateVariableBinding[]): 'UNMAPPED' | 'MAPPED';
export function componentsChanged(before: unknown, after: unknown): boolean;     // E6, R71
export function showKeys(content: WhatsappTemplateContent, keyBySlot: ReadonlyMap<TemplateSlot, string>): WhatsappTemplateContent;
```

- `variableSlotsOf`: `null` si el contenido es `null` (no relacionable, R64, [P16]); si no, `header` si
  el texto del header tiene `{{1}}`, `body.<n>` por cada número distinto del body en orden,
  `button.<i>` por cada botón URL cuya URL termina en `{{1}}`.
- `mappingStatusOf` (R65): `MAPPED` si `variableSlotsOf(contentOf(components))` no es `null` y cada
  hueco tiene una relación; una relacionable sin huecos es `MAPPED`. Es la **única** función que decide
  el estado; todo camino que escribe relaciones o componentes la llama y guarda su resultado.
- `componentsChanged(antes, después)` (E6): con los dos `contentOf` no nulos, compara el **contenido
  normalizado** (header, body, footer, botones y ejemplos, campo a campo); con alguno nulo,
  `!sameComponents(antes, después)` (§4.3). Se compara el contenido y no el JSON porque `components`
  guarda lo **enviado** al crear y la sincronización trae lo que **lista** Meta: con el JSON, una
  diferencia de forma (una clave de más en el `GET`) quitaría la relación a toda plantilla creada en
  la primera sincronización. Cualquier cambio real de componente cuenta, como pide E6. La forma del
  `GET` es [P4] [POR CONFIRMAR]; T26 fija con un test que lo creado y lo listado por el doble no cuentan
  como cambio.
- `showKeys` (R81, E16): sustituye, en el texto de cada hueco relacionado, `{{n}}` por `{{clave}}`
  (`Hola {{1}}` con `body.1 = nombre` ⇒ `Hola {{nombre}}`); los huecos sin relación quedan con `{{n}}`.
  Los ejemplos del contenido no se tocan (son los de Meta).

### 18.6 Dominio: el borrador con claves (`domain/whatsapp-template-keyed-draft.ts`) — R66, R67

```ts
export type WhatsappTemplateKeyedDraft = {        // sin ejemplos (E15)
  name; language; category;
  header: { text: string } | null;
  body: { text: string };
  footer: string | null;
  buttons: readonly ({ type: 'QUICK_REPLY'; text } | { type: 'URL'; text; url } | { type: 'PHONE_NUMBER'; text; phoneNumber })[];
};
export type DictionaryEntry =
  | { kind: 'system'; key: string; label: string }
  | { kind: 'company'; id: string; key: string; label: string };

export function validateKeyedTemplateDraft(input: unknown, dictionary: readonly DictionaryEntry[]):
  | { ok: true; draft: WhatsappTemplateDraft; bindings: readonly TemplateVariableBinding[] }
  | { ok: false; issues: readonly WhatsappTemplateIssue[] };
```

`dictionary` = `WHATSAPP_SYSTEM_VARIABLES` + las propias de la empresa. La pantalla lo recibe de
`listWhatsappDictionaryAction` (§18.9) y el caso de uso de crear lo arma igual.

1. zod con `.strip()` (por defecto): un `example`/`examples` que llegue se descarta (R67, E15); así
   QC-243 puede pasar el contenido de una vista al duplicar sin limpiarlo.
2. Marcas: `/\{\{([^{}]*)\}\}/g`. Un interior que no casa con `WHATSAPP_VARIABLE_KEY_PATTERN` y su
   largo ⇒ `invalid_variable` (incluye `{{1}}`, [P18]); una clave que no está en `dictionary` ⇒
   `unknown_key` (código nuevo en `WHATSAPP_TEMPLATE_ISSUE_CODES`) en ese campo (R66).
3. Traducción por componente (R67, E16): header, body y cada URL por separado; cada clave distinta
   recibe el siguiente número por orden de primera aparición; las repetidas, el mismo
   (`Hola {{nombre}}, tu pedido {{pedido_numero}}` ⇒ `Hola {{1}}, tu pedido {{2}}`). Ejemplos (E15): la
   **etiqueta** de la entrada por cada número (`["Nombre del cliente", "Número de pedido"]`); en URL,
   `url.replace('{{1}}', label)`.
4. `validateWhatsappTemplateDraft(traducido)` (§3.3, sin cambiar) y se **descartan** los problemas de
   los campos de ejemplo (`header.example`, `body.examples.*`, `buttons.<i>.example`): E15 dice que el
   ejemplo no se valida en la app. Si Meta lo rechaza, `templateGraphErrorOf` ya lo traduce (R19). El
   resto de problemas se devuelven con el `field` del borrador con claves. Los límites de largo se miden
   sobre el texto **traducido** (`Hola {{1}}`, lo que recibe Meta), no sobre el que escribe el usuario:
   el mensaje lo dice («El cuerpo admite como mucho 1024 caracteres una vez numeradas las variables»).
5. `bindings`: por cada hueco, la constante (`systemKey`) o la propia (`variableKeyId`) de su clave.

`validateWhatsappTemplateDraft` sale del contrato (`index.ts`): la pantalla usa la de claves. Sigue
siendo la regla de Meta y sus tests de T3 no cambian. R6 pasa a cumplirse con
`validateKeyedTemplateDraft` (pura; `module-shape` fija sus imports igual que con la otra).

### 18.7 Casos de uso

Regla que atraviesa todos: el par (estado del mapeo, habilitada) se escribe siempre junto, calculado
por `mappingStatusOf` y por la regla «si queda `UNMAPPED`, `enabled = false`» (R72, R80). El `CHECK` de
§18.2 lo respalda en la base.

**Crear (§4.4 cambia en los pasos 2, 7 y 8).** `deps` gana `variableKeys`.

2. `dictionary = [...WHATSAPP_SYSTEM_VARIABLES, ...await variableKeys.listAll(scope)]`;
   `validateKeyedTemplateDraft(input, dictionary)`; inválido ⇒ `ValidationError` (R14). Leer el
   diccionario no es escribir: R14 se mantiene.
7. `templates.insertCreated({ …, variables: bindings, mappingStatus: 'MAPPED', enabled: true },
   connection.id, scope)` (R68, E11) devuelve `{ record, inserted }`.
8. Carrera (R69): si `inserted === false` (la sincronización ya la había insertado),
   `record.variables.length === 0` y `sameSlots(variableSlotsOf(contentOf(record.components)),
   slotsDe(bindings))` ⇒ `templates.replaceVariables(record.id, bindings, { mappingStatus: 'MAPPED',
   enabled: true }, record.components, scope)`; si no, se deja como está. Devuelve la vista de la fila
   final.

**Eliminar (§4.5).** Sin cambio en el dominio; `markDeleted` quita las relaciones y pone
`enabled = false` en su transacción (R73). El estado del mapeo se deja como estaba: la fila eliminada
no se lee, y si se revive, R70 lo recalcula.

**Listar y consultar (§4.6).** El filtro no cambia (R82, E9): `onlyApproved` sigue filtrando solo por
`status`. `deps` gana `variableKeys`; se lee la lista de propias **una vez** por llamada y
`toWhatsappTemplateView(record, dictionaryByKey)` arma la vista de R81:

```ts
export type WhatsappTemplateVariableView = {
  slot: string; position: number;                         // `position` = n del {{n}} (1 en header y botón)
  kind: 'system' | 'company' | null; key: string | null; label: string | null;
};
// WhatsappTemplateView gana, campo a campo:
mappingStatus: 'UNMAPPED' | 'MAPPED'; enabled: boolean; variables: readonly WhatsappTemplateVariableView[];
```

El `mappingStatus` de la vista es el guardado. Una relación a una constante que ya no está en el
catálogo (se quitó del código) sale con `kind: 'system'`, la clave y `label: null`; la vista no
recalcula el estado. Quitar una constante del catálogo exige antes una migración de datos: queda
escrito en la cabecera de `whatsapp-system-variables.ts`.

**Diccionario (`domain/manage-whatsapp-variable-keys.ts`, R56–R62).** Cuatro fábricas; todas
`requirePermission` → `scopeOf` primero.

- `createListWhatsappDictionary`: constantes del catálogo (con `usedBy` de
  `variableKeys.countSystemKeyUsage(scope)`) más `variableKeys.listWithUsage(scope)`, todo ordenado por
  `key` (R60).
- `createCreateWhatsappVariableKey(input)`: R54 ⇒ `ValidationError`; `systemVariableOf(key) !== null`
  ⇒ `WhatsappVariableKeyTakenError` (R56) sin tocar la base; `variableKeys.create(value, scope)`; el
  adaptador traduce el `23505` de `whatsapp_variable_keys_company_key_key` a
  `WhatsappVariableKeyTakenError` (reconocido por el nombre del índice, como `isNameLanguageTaken`).
- `createUpdateWhatsappVariableKey(id, input)`: id no UUID ⇒ `WhatsappVariableKeyNotFoundError`; R54;
  clave de una constante ⇒ `WhatsappVariableKeyTakenError`; `variableKeys.update(id, value, scope)`
  devuelve `{ kind: 'updated', record } | { kind: 'not_found' } | { kind: 'in_use' }`. El adaptador, en
  una transacción con la fila bloqueada, devuelve `in_use` solo si **la clave cambia** y la variable
  tiene relaciones con plantillas vivas (R58); etiqueta y valor se guardan siempre (R57, [P13]).
- `createDeleteWhatsappVariableKey(id)`: id no UUID ⇒ no encontrada; `variableKeys.delete(id, scope)`
  devuelve `'deleted' | 'not_found' | 'in_use'`. El adaptador comprueba el uso y borra en una
  transacción; un `23503` de la FK también se traduce a `in_use` (la base es la última palabra, R59).
- Una constante no tiene id: modificar o eliminar con cualquier id llega al repositorio de propias y,
  si no es una propia de la empresa, es `not_found` (R55, R61).

**Relacionar, habilitar, deshabilitar (`domain/relate-whatsapp-template-variables.ts`, R72, R74–R80).**

```ts
createRelateWhatsappTemplateVariables(deps)(input: unknown, actor)   // { templateId, bindings: [{ slot, key }] }
createSetWhatsappTemplateEnabled(deps)(input: unknown, actor)        // { templateId, enabled: boolean }
```

1. `requirePermission`, `scopeOf`; zod de la entrada (forma rota ⇒ `ValidationError`).
2. `templateId` no UUID, sin conexión viva, plantilla no viva o de otra conexión ⇒
   `WhatsappTemplateNotFoundError` (R75 remite a R45). No exige conexión habilitada (R74).
3. Relacionar: `slots = variableSlotsOf(contentOf(record.components))`; `null` ⇒
   `WhatsappTemplateNotMappableError` (R75). Hueco que no está en `slots` o repetido ⇒
   `ValidationError`. Cada `key` se resuelve: `systemVariableOf(key)` ⇒ relación a constante; si no,
   `variableKeys.findByKeys(keys, scope)`; una que falte ⇒ `WhatsappVariableKeyNotFoundError`.
   La entrada lleva la **clave** y no el id: es lo que el usuario ve en `{{clave}}` y sirve igual para
   las dos clases. Se calcula `mappingStatus = mappingStatusOf(record.components, bindings)` y
   `enabled = mappingStatus === 'MAPPED' && record.enabled` (R72, [P14]; relacionar nunca habilita,
   R79). Escribe `replaceVariables(id, bindings, { mappingStatus, enabled }, record.components, scope)`.
4. Habilitar: `record.mappingStatus !== 'MAPPED'` ⇒ `WhatsappTemplateNotMappedError` (R77); no mira el
   estado de Meta (E13). `setEnabled(id, true, record.components, scope)`. Deshabilitar:
   `setEnabled(id, false, …)`, sin otra condición (R78).
5. Las dos escrituras pasan los `components` leídos: el adaptador bloquea la fila (`FOR UPDATE`) y
   escribe solo si sigue viva y `components = $leídos::jsonb` (igualdad de `jsonb`, que no depende del
   orden de claves); si no ⇒ `false` ⇒ `ActionNotAllowedError('la plantilla cambió')` (R76). Se compara
   `components` y no `updatedAt` porque un webhook de estado cambia `updatedAt` sin cambiar las
   variables.
6. Devuelve la vista de R81.

**Sincronización (§4.3 y §5.2 cambian).** `planTemplateSync` gana, por fila, la decisión de variables:

```ts
inserts: { template; mappingStatus; enabled: boolean }[];                          // R70, E11
updates: { id; template; changed; resetVariables: boolean; mappingStatusAfterReset; enabledAfterReset: boolean }[];  // R70, R71
```

- En un insert o un reset: sin relaciones, `mappingStatus = mappingStatusOf(template.components, [])`
  (`MAPPED` solo si es relacionable y sin huecos), y `enabled = mappingStatus === 'MAPPED'` (E11).
- `resetVariables = local.deletedAt !== null || componentsChanged(local.components,
  template.components)` (E6). Un revivido no tiene relaciones (R73 las quitó) y se trata como un
  importado (R70).
- **Reset con huecos ⇒ `UNMAPPED` y `enabled = false`** (E6, E12). Reset sin huecos ⇒ `MAPPED` y se
  **conserva** la habilitación que tenía, salvo un revivido, que sigue E11: E12 solo deshabilita al
  volver a «sin relacionar».
- `resetVariables` implica que los componentes difieren, que ya era `changed`; los conteos de R25 no
  cambian.

`syncConnectionTemplates` no cambia: pasa el plan al repositorio. Los webhooks de estado y categoría
(`applyWebhookUpdates`) no tocan `mapping_status`, `enabled` ni las relaciones (R73): no cambian.

### 18.8 Puertos y adaptadores

```ts
export interface WhatsappVariableKeyRepository {
  listAll(scope): Promise<readonly WhatsappVariableKeyRecord[]>;
  listWithUsage(scope): Promise<readonly (WhatsappVariableKeyRecord & { usedBy: number })[]>;
  countSystemKeyUsage(scope): Promise<ReadonlyMap<string, number>>;          // plantillas vivas por constante
  findByKeys(keys: readonly string[], scope): Promise<readonly WhatsappVariableKeyRecord[]>;
  create(input: WhatsappVariableKeyInput, scope): Promise<WhatsappVariableKeyRecord>;
  update(id: string, input: WhatsappVariableKeyInput, scope)
    : Promise<{ kind: 'updated'; record: WhatsappVariableKeyRecord } | { kind: 'not_found' } | { kind: 'in_use' }>;
  delete(id: string, scope): Promise<'deleted' | 'not_found' | 'in_use'>;
}

type MappingWrite = { mappingStatus: 'UNMAPPED' | 'MAPPED'; enabled: boolean };

// WhatsappTemplateRepository (§5.1) cambia:
insertCreated(row: NewCreatedTemplateRow & { variables } & MappingWrite, connectionId, scope)
  : Promise<{ record: WhatsappTemplateRecord; inserted: boolean }>;
replaceVariables(id, bindings, mapping: MappingWrite, expectedComponents: unknown, scope): Promise<boolean>;
setEnabled(id, enabled: boolean, expectedComponents: unknown, scope): Promise<boolean>;
// WhatsappTemplateRecord gana `mappingStatus`, `enabled` y `variables` (TemplateVariableBinding[]).
```

`whatsapp-template-prisma.ts`:

- Lecturas (`listLive`, `findLiveById`, `findLiveByNameAndLanguage`) traen las relaciones con una
  segunda consulta por `templateId in (…)` y el mismo ámbito (sin `include`, §2.1), y las claves de las
  propias con una tercera por `id in (…)`.
- `insertCreated`: una transacción interactiva. El `INSERT … ON CONFLICT … DO UPDATE` de §5.2 gana
  `mapping_status` y `enabled` en el `INSERT` (el `DO UPDATE` no los toca) y devuelve
  `(xmax = 0) AS "inserted"`; si insertó, `createMany` de las relaciones con
  `companyScopeColumns(scope)`. Si no insertó, no escribe relaciones (lo decide el dominio, §18.7).
- `replaceVariables` / `setEnabled`: transacción con `SELECT … FOR UPDATE` en el ámbito; condición de
  §18.7 paso 5; `deleteMany` + `createMany` de relaciones y `update` de `mappingStatus` y `enabled`.
- `markDeleted`: en una transacción, `deleteMany` de sus relaciones y `enabled: false`.
- `applySync` (sigue siendo una transacción): los borrados de §5.2 paso 1 también borran sus relaciones
  y ponen `enabled: false` (R73); cada `update` con `resetVariables` borra sus relaciones y escribe
  `mappingStatusAfterReset` y `enabledAfterReset`; los `inserts` llevan su `mappingStatus` y `enabled`.
  El orden de §5.2 se mantiene (borrados primero). El paso 1 filtra por `createdAt < startedAt`: el
  `deleteMany` de relaciones usa el mismo filtro a través de `template_id in (ids que cumplen)`,
  calculados dentro de la transacción.

`whatsapp-variable-key-prisma.ts`: cada función con `scope: IntegracionesScope` al final y
`whatsappVariableKeyCompanyScope(scope)`. `listWithUsage` y `countSystemKeyUsage` cuentan plantillas
**vivas** distintas (`whatsapp_template_variables` unido a plantillas con `deleted_at IS NULL`, en el
ámbito). `update` y `delete`: transacción con la fila bloqueada y el conteo de uso.

`guard-ambito-empresa-integraciones.test.ts`: cuarto puerto (7 métodos), dos métodos más en el de
plantillas (10), dos envolturas más en `company-scope.ts`.

### 18.9 Server Actions, composición, contrato y errores

`adapters/driving/whatsapp-variable-key-actions.ts` (nuevo, `'use server'`, mismo patrón que §9):

```ts
listWhatsappDictionaryAction(): Promise<{ status: 'success'; data: readonly WhatsappDictionaryEntryView[] } | ErrorState>;
createWhatsappVariableKeyAction(input: unknown): Promise<{ status: 'success'; data: WhatsappDictionaryEntryView } | ErrorState>;
updateWhatsappVariableKeyAction(id: string, input: unknown): Promise<{ status: 'success'; data: WhatsappDictionaryEntryView } | ErrorState>;
deleteWhatsappVariableKeyAction(id: string): Promise<{ status: 'success'; data: { id: string } } | ErrorState>;
```

`whatsapp-template-actions.ts` gana (E8: la acción de habilitar que pide QC-243):

```ts
relateWhatsappTemplateVariablesAction(input: unknown): Promise<WhatsappTemplateCreateResult>;   // vista de R81
setWhatsappTemplateEnabledAction(input: unknown): Promise<WhatsappTemplateCreateResult>;       // { templateId, enabled }
```

`listWhatsappTemplatesAction` no cambia de firma; su `data.templates` trae los campos nuevos de la
vista (R82). Las de escritura llaman `revalidatePath(WHATSAPP_INTEGRATION_ROUTE)` (R83). La vista de la
entrada se copia campo a campo; `usedBy` en la creación es 0.

**Composición**: `whatsappVariableKeyRepository` atado a sus funciones; `variableKeys` entra en los deps
de crear, listar, consultar, relacionar y habilitar; seis fábricas nuevas en `integraciones`.

**Contrato (`index.ts`)**: se suman `createListWhatsappDictionary`, `createCreateWhatsappVariableKey`,
`createUpdateWhatsappVariableKey`, `createDeleteWhatsappVariableKey`,
`createRelateWhatsappTemplateVariables`, `createSetWhatsappTemplateEnabled`,
`validateKeyedTemplateDraft`, `validateWhatsappVariableKeyInput`, `WHATSAPP_VARIABLE_KEY_LIMITS`,
`WHATSAPP_VARIABLE_KEY_PATTERN`, `WHATSAPP_SYSTEM_VARIABLES` (con `source` y `field`, para que QC-245 y
QC-247 escriban sus resolvedores, [P11]), los 5 errores y los tipos `WhatsappDictionaryEntryView`,
`WhatsappTemplateVariableView`, `WhatsappTemplateKeyedDraft`, `SystemVariable`. Sale
`validateWhatsappTemplateDraft` (§18.6). Se mantienen `TEMPLATE_LIMITS` y `WhatsappTemplateDraft` (la
pantalla pinta contadores).

**Errores (R85)**, cuenta + 5 en `catalogo.test.ts`:

| Código | Texto |
|---|---|
| `whatsapp_variable_key_not_found` | No se encontró la variable. |
| `whatsapp_variable_key_taken` | Ya existe una variable con esa clave. |
| `whatsapp_variable_key_in_use` | La variable se usa en una o más plantillas. Quítala de ellas antes de eliminarla o cambiar su clave. |
| `whatsapp_template_not_mapped` | Relaciona todas las variables de la plantilla antes de habilitarla. |
| `whatsapp_template_not_mappable` | Esta plantilla tiene contenido que la app todavía no admite y no se puede relacionar. |

R76 reutiliza `action_not_allowed` (ya existe).

### 18.10 Tests

| Archivo | Cubre |
|---|---|
| `tests/unit/integraciones/whatsapp/templates/whatsapp-variable-key.test.ts` (nuevo) | R54: clave en el límite (40) y +1, empieza por dígito, mayúscula, guion, punto; etiqueta 60/61, solo espacios; valor ausente, vacío, 50/51, con `{{`; catálogo de constantes: claves únicas y con el patrón (R53) |
| `…/templates/whatsapp-template-variables.test.ts` (nuevo) | R64 (huecos de header, body repetido, botón URL en posición 2, no relacionable ⇒ `null`), R65 (`mappingStatusOf`: cero huecos ⇒ `MAPPED`; uno sin relación ⇒ `UNMAPPED`; no relacionable sin variables ⇒ `UNMAPPED`, [P16]), `componentsChanged` por tabla (E6: body, footer, ejemplo o botón cambian ⇒ sí; el mismo contenido con otra forma de JSON ⇒ no), `showKeys` (`Hola {{1}}` ⇒ `Hola {{nombre}}`, E16; un hueco sin relación queda `{{n}}`, R81) |
| `…/templates/whatsapp-template-keyed-draft.test.ts` (nuevo) | R66 (`{{1}}`, `{{Nombre}}`, clave desconocida ⇒ `unknown_key` en su campo; constante y propia valen), R67 (`Hola {{nombre}}` ⇒ `Hola {{1}}` con ejemplo «Nombre del cliente», E16; traducción por componente; repetida ⇒ mismo número; URL con la etiqueta sustituida; ejemplos del borrador ignorados; una etiqueta de 60 en un header no da problema, E15; largo medido traducido; `field` reescrito), R6 (solo `zod` y `domain/`, vía `module-shape`) |
| `…/templates/template-sync-plan.test.ts` (se amplía) | R70 (insert sin huecos ⇒ `MAPPED` y habilitada; con huecos o no relacionable ⇒ `UNMAPPED` y deshabilitada), R71 (`resetVariables` por tabla; reset con huecos ⇒ `UNMAPPED` y deshabilitada, R72; reset sin huecos conserva la habilitación), revivida ⇒ como importada |
| `…/templates/create-whatsapp-template.test.ts` (se amplía) | R14 con R66–R67 (Graph no llamado), R67 (Meta rechaza por el ejemplo ⇒ `whatsapp_template_rejected`), R68 (relaciones, `MAPPED` y `enabled` enviados), R69 (`inserted: false` sin relaciones y mismos huecos ⇒ `replaceVariables`; con relaciones o huecos distintos ⇒ no) |
| `…/templates/list-whatsapp-templates.test.ts` (se amplía) | R81 (claves exactas de la vista, contenido con `{{clave}}`, constante quitada del catálogo ⇒ `label: null`), R82 (`onlyApproved` devuelve aprobadas `UNMAPPED` y deshabilitadas, con los dos campos), las propias se leen una vez |
| `…/templates/manage-whatsapp-variable-keys.test.ts` (nuevo) | R55 (id de una constante ⇒ no encontrada; vista sin id ni valor), R56 (clave repetida y clave de una constante ⇒ `taken`, sin puerto en el segundo caso), R57, R58 (renombrar sin uso guarda; con uso ⇒ `in_use`), R59, R60 (orden, constantes y propias, claves exactas), R61, R62 (sin permiso ningún puerto llamado) |
| `…/templates/relate-whatsapp-template-variables.test.ts` (nuevo) | R74 (sustituye todo; constante y propia; recalcula a `MAPPED`; sin Graph; conexión deshabilitada sirve), R72 (quitar una relación a una habilitada ⇒ `UNMAPPED` y deshabilitada, [P14]), R75 (cada rama), R76 (`false` del puerto ⇒ `action_not_allowed`), R77 (`UNMAPPED` ⇒ `not_mapped`; `PENDING` y `REJECTED` relacionadas se habilitan, E13), R78, R79 (quedar `MAPPED` no habilita), R62 |
| `…/templates/whatsapp-template-actions.test.ts` (se amplía) | R83 para las dos acciones nuevas; `revalidatePath` |
| `…/templates/whatsapp-variable-key-actions.test.ts` (nuevo) | R83 (contrato, claves exactas de `data`, `revalidatePath` en las tres de escritura), R62 |
| `tests/integration/integraciones/whatsapp-variable-key-prisma.int.test.ts` (nuevo) | R53 (único por empresa; la misma clave en otra empresa entra; `CHECK` del valor 50/51), R58 y R59 (con uso ⇒ `in_use`; la FK impide borrar en uso), R60 (`usedBy` y `countSystemKeyUsage` no cuentan eliminadas), R63 (empresa B no ve ni borra; FK compuesta rechaza relación cruzada; relación con las dos columnas o ninguna ⇒ rechazo) |
| `tests/integration/integraciones/whatsapp-template-prisma.int.test.ts` (se amplía) | R68, R69 (`inserted` con la carrera de §4.4), R70–R72 dentro de `applySync`, R73 en `markDeleted` y en `applyWebhookUpdates`, R76 (componentes cambiados entre lectura y escritura ⇒ `false`), R80 (el `CHECK` rechaza `enabled` con `UNMAPPED`) |
| `tests/integration/integraciones/whatsapp-variable-keys-migration.int.test.ts` (nuevo) | R84 (`down.sql` y vuelta, RLS forzada, índices y `CHECK` por nombre), R86 (relleno: sin variables ⇒ `MAPPED` y habilitada; con `{{1}}`, header `IMAGE`, botón `OTP`, eliminada ⇒ `UNMAPPED` y deshabilitada) |
| `tests/integration/integraciones/whatsapp-template-flow.int.test.ts` (se amplía) | Recorrido de E16: crear `cuenta_numero`; crear `Hola {{nombre}}, tu cuenta {{cuenta_numero}}` ⇒ Meta (doble) recibe `{{1}}`/`{{2}}` con las etiquetas de ejemplo, la vista vuelve con las claves, `MAPPED` y habilitada; importar una de Meta con `{{1}}` ⇒ `UNMAPPED` y deshabilitada; relacionarla ⇒ `MAPPED` y sigue deshabilitada; habilitar; Meta cambia el body ⇒ `UNMAPPED` y deshabilitada; borrar `cuenta_numero` en uso ⇒ `in_use` |
| `tests/unit/errores/catalogo.test.ts` | cuenta + 5 (R85) |
| `tests/unit/integraciones/module-shape.test.ts` | archivos nuevos, contrato, modelos de seis a ocho, R6 sobre el validador con claves |
| `tests/guards/guard-ambito-empresa-integraciones.test.ts` | cuarto puerto, métodos nuevos, dos envolturas |
| `tests/unit/integraciones/whatsapp/whatsapp-doubles.ts` | doble del diccionario y de los métodos nuevos |
| `tests/integration/aislamiento.json` | los dos `.int.test.ts` nuevos |

### 18.11 Fronteras

- **QC-243**: el formulario inserta `{{clave}}` del diccionario (no `{{n}}`), llama a
  `validateKeyedTemplateDraft` con la lista de `listWhatsappDictionaryAction`, no pide ejemplos (son las
  etiquetas, E15) y gana: una sección de diccionario (constantes de solo lectura y propias con clave,
  etiqueta y valor), un «Relacionar variables» por plantilla, el interruptor de habilitar (E8) y los
  dos campos en el listado. La vista previa puede mostrar el valor de las propias y la etiqueta de las
  constantes. Su descripción de Jira dice «Agregar variable inserta `{{n}}`» y «un campo de ejemplo
  obligatorio por variable»: **la ficha QC-243 necesita ajustarse** antes de su spec (eso lo hace el
  humano en Jira, no este spec).
- **QC-245** y **QC-247**: usan una plantilla solo si es `APPROVED` y habilitada (lo comprueban ellas:
  el listado no filtra por eso, E9); arman los parámetros por hueco, en orden de `position`: una
  constante con su resolvedor ([P11]), una propia con su `value` (E4). El mapeo
  `{{1}} → cliente.nombre` que describe QC-247 queda cubierto por las constantes; su spec decide si lo
  conserva.
- **QC-240/QC-241** no cambian: envían `{{n}}` posicionales; el orden de los parámetros lo arma quien
  envía con la lista de huecos.

| Archivo | Con quién | Cómo se resuelve |
|---|---|---|
| `db/schema.prisma`, `db/migrations/` | Fichas con esquema en vuelo | Bloque al final; timestamp re-fechado si `dev` trae una posterior |
| `lib/composition/index.ts`, `errores/domain/*`, `catalogo.test.ts`, `aislamiento.json` | Como §15 | Como §15 |
| `lib/modules/integraciones/**` | QC-239, QC-240, QC-241 | Como §15 |

### 18.12 Alternativas descartadas

1. **Opción A — solo un catálogo de claves en código** (una lista fija `nombre`, `pedido_numero`…).
   Daría resolvedores gratis, pero cada dato propio de la empresa (un número de cuenta, un horario)
   exigiría un despliegue. El humano eligió un diccionario por empresa (E1) y luego lo hizo mixto (E3):
   lo bueno de A se conserva en las constantes del sistema.
2. **Opción B — variables `NAMED` de Meta** (`parameter_format: named`, `{{usuario_nombre}}` dentro de
   Meta). La ficha la deja fuera («Variables con nombre (`NAMED`)»); no resuelve las plantillas
   importadas, que siguen llegando con `{{1}}` y necesitarían la misma relación; el nombre viviría por
   plantilla en Meta, sin etiqueta, valor ni diccionario de empresa; y cambia el envío de QC-240
   (`parameter_name` en cada parámetro). E16 fija el texto posicional hacia Meta.
3. **Solo variables propias, sin constantes** (la primera versión de esta enmienda). Cada empresa
   tendría que crear «Nombre del cliente» a mano y nadie sabría resolverla al enviar. E3 lo descarta.
4. **Constantes como filas de la base** (sembradas por migración en cada empresa). Las haría
   relacionables por la misma FK, pero obliga a sembrar cada empresa nueva y a migrar todas para añadir
   una constante; y el resolvedor, que es código, quedaría separado de su clave. Se dejan en código y la
   relación apunta a una de las dos (`variable_key_id` o `system_key`).
5. **La relación como `jsonb` en `whatsapp_templates`.** Una sola tabla y una escritura menos, pero sin
   FK: nada impide borrar una variable en uso ni apuntar a una de otra empresa, y «en uso» exigiría
   recorrer el `jsonb` de todas las plantillas.
6. **Un solo campo «habilitada» automático** (la versión intermedia de esta enmienda). El humano lo
   separó en dos (E5, E8): el estado del mapeo es un hecho que el sistema calcula; la habilitación es
   una decisión del Administrador.
7. **Calcular el estado del mapeo al leer, sin guardarlo.** Evita mantenerlo en cada escritura, pero
   sin la columna la base no puede impedir una plantilla habilitada «sin relacionar» (`CHECK` de §18.2)
   y el listado tendría que parsear los componentes de cada fila.
8. **Comparar el JSON crudo de los componentes para E6.** Más simple, pero `components` guarda lo
   enviado al crear y lo que lista Meta, que pueden diferir en forma; cada plantilla creada perdería su
   relación en la primera sincronización. Se compara el contenido normalizado (§18.5), que sigue
   contando cualquier cambio real.
9. **Seguir aceptando `{{1}}` en el borrador de creación** junto a las claves: dejaría plantillas
   creadas desde la app sin relacionar, contra E5 ([P18]).
10. **Validar en la app el ejemplo (la etiqueta) contra los límites de Meta**: E15 lo descarta; Meta es
    quien decide y su rechazo ya se traduce (R19).

### 18.13 Dependencias y entorno

Ninguna (R52). `jsonb_path_exists` es de Postgres 12+, ya en uso por Supabase. Ninguna variable nueva.
