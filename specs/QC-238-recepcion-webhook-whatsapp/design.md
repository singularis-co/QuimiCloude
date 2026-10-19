# QC-238 — recepcion-webhook-whatsapp · design.md

> Zona: `backend` · Complejidad: `medium` · depends_on: QC-237 · Rama:
> `feature/QC-238-recepcion-webhook-whatsapp`
>
> El **qué** está en `requirements.md` (R1–R33). Aquí va el **cómo**. Precedentes que se copian:
>
> - **QC-237** (`specs/QC-237-conexion-whatsapp-por-empresa/design.md`): el modelo
>   `whatsapp_connections`, la clave candidata `(company_id, id)` creada para las FK de esta ficha
>   (§2.2 paso 3), `connection-secrets.ts` para descifrar el App Secret, `WHATSAPP_WEBHOOK_ROUTE_BASE`
>   (§4.6) y su frontera con esta ficha (§13).
> - **QC-234**: `SecretDigest.matches` (comparación en tiempo constante del verify token) y
>   `SecretCipher` (App Secret).
> - **QC-277** (`design.md > 8.1`): un webhook de añadido comprueba su interruptor en la empresa del
>   trabajo, por un puerto propio del módulo cableado a `identity.isCompanyAddonActive`.
> - **`documentos`** (`document-job-route.ts`): route handler en `adapters/driving/`, cuerpo crudo
>   antes que nada, firma antes de parsear, `route.ts` que solo reexporta y declara `runtime`.
> - **`pedidos`** (`guard-ambito-empresa-pedidos.test.ts`): la forma de una exención de ámbito con
>   nombre, aprobada en un spec.
>
> **Regla transversal.** Manda `docs/conventions.md > Comentarios`: ningún comentario nuevo cita
> `QC-<n>`, `R<n>`, `design.md` ni «decisión cerrada». En los tests, `R<n>` va en el nombre del caso.

---

## Lo que ya existe

Buscado `webhook`, `whatsapp_messages`/`WhatsappMessage`, `whatsapp_contacts`, `X-Hub-Signature`,
`hub.challenge`, `wamid` y «recepción» en:

- `feature_list.json`, por `name` y `description`, en todos los estados;
- `specs/` con grep (solo aparecen QC-237 y este spec);
- el código con grep sobre `lib/`, `app/`, `db/`, `tests/` y `e2e/`. El MCP del grafo no estaba
  disponible para este agente: se usó Grep/Read.

| Apareció | Qué es | Qué se hace |
|---|---|---|
| QC-119 `webhook-whatsapp-recepcion` (`cancelled`, épica antigua «Canal WhatsApp») | La misma idea, cancelada | Nada que reutilizar; QC-237 ya la registró |
| QC-237 (`done`) | `WhatsappConnection`, `WhatsappConnectionRepository` (`findLiveById`, `update`), `readStoredSecret`/`decryptStoredSecret`, `UNREADABLE_SECRET_MESSAGE`, `WHATSAPP_WEBHOOK_ROUTE_BASE`, `whatsappWebhookPath`, índice `whatsapp_connections_company_id_id_key` | **Se reutiliza.** El puerto gana un método (§5.2) y el `patch` gana `lastWebhookAt` |
| QC-234 (`done`) | `integraciones.secretDigest`, `integraciones.secretCipher` | Se reutilizan tal cual |
| QC-277 (`done`) | `identity.isCompanyAddonActive(companyId, addon)`, añadido `integraciones`, `guard-rutas-fuera-de-sesion.test.ts` (su §9.3 dice que el webhook de WhatsApp tendrá que entrar ahí) | Se reutiliza la consulta; la ruta entra en la guardia (R31) |
| `documentos/adapters/driving/document-job-route.ts`, `app/api/documentos/trabajos/route.ts` | Patrón de webhook firmado | Se copia la forma, no el código (la firma de QStash no sirve aquí) |
| `pedidos/adapters/driving/order-expiry-cron-route.ts` | Patrón de route handler sin sesión con `noBody(status)` y `console.error` con nombre de evento | Se copia la forma |
| QC-239…QC-248 (`pending`) | Vinculación, envío, plantillas, contactos, notificaciones | Consumidores de las tablas de aquí. Fronteras en §11 |
| QC-297 `canal-whatsapp-usuarios` (`pending`, épica Plataforma) | Canal de avisos a usuarios internos que nace de QC-137 (notificaciones por rol) | No se solapa: es salida hacia usuarios, no recepción de clientes |
| Ningún modelo de contacto o mensaje, ningún HMAC de Meta, ninguna ruta bajo `app/api/integraciones` | — | Nacen aquí |

Conclusión: no existe nada que resuelva parte del alcance. Se sigue. La feature no toca UI: no se
consulta `components/shared/CATALOGO.md` y no hay pase `/design`.

---

## 1. Qué cambia (resumen)

```
db/schema.prisma                                       ← 2 modelos + 4 enums
db/migrations/20261019140000_whatsapp_contacts_and_messages/{migration,down}.sql
app/api/integraciones/whatsapp/webhook/[conexionId]/route.ts   ← reexporta GET y POST, runtime
lib/modules/integraciones/
  index.ts                                             ← + 2 fábricas
  domain/
    whatsapp-message.ts                                ← constantes y tipos de mensaje
    whatsapp-message-status.ts                         ← orden de statuses (predecesores)
    whatsapp-inbound-message.ts                        ← un mensaje de Meta → fila normalizada
    whatsapp-webhook-payload.ts                        ← zod del cuerpo → InboundBatch
    webhook-connection.ts                              ← resolver la conexión de la URL
    verify-whatsapp-webhook.ts                         ← caso de uso GET
    receive-whatsapp-webhook.ts                        ← caso de uso POST
  ports/
    whatsapp-connection-repository.ts                  ← + recordWebhookHandshake, patch + lastWebhookAt
    whatsapp-webhook-directory.ts                      ← id → empresa (la única consulta sin ámbito)
    whatsapp-inbox-repository.ts                       ← guardar un lote en una transacción
    webhook-signature.ts                               ← verificar X-Hub-Signature-256
    integrations-switch.ts                             ← ¿añadido activo en la empresa?
  adapters/driven/
    persistence/company-scope.ts                       ← + 2 envolturas
    persistence/whatsapp-connection-prisma.ts          ← + recordWebhookHandshake, lastWebhookAt en update
    persistence/whatsapp-webhook-directory-prisma.ts   ← nuevo (exención con nombre)
    persistence/whatsapp-inbox-prisma.ts               ← nuevo
    security/webhook-signature-hmac.ts                 ← node:crypto
  adapters/driving/
    whatsapp-webhook-route.ts                          ← GET y POST
lib/composition/index.ts                               ← amplía `integraciones`
tests/**                                               ← §10
```

---

## 2. Modelo de datos

### 2.1 Prisma

```prisma
enum WhatsappMessageDirection { IN OUT  @@map("whatsapp_message_direction") }

enum WhatsappMessageType {
  TEXT IMAGE AUDIO VIDEO DOCUMENT STICKER LOCATION CONTACTS REACTION BUTTON INTERACTIVE
  TEMPLATE UNSUPPORTED
  @@map("whatsapp_message_type")
}

enum WhatsappMessageStatus {
  RECEIVED QUEUED SENDING SENT DELIVERED READ FAILED
  @@map("whatsapp_message_status")
}

enum WhatsappMessageOrigin { USER SYSTEM  @@map("whatsapp_message_origin") }

/// <comentario corto: FK compuestas de empresa escritas en la migración>
/// @module integraciones
model WhatsappContact {
  id            String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  companyId     String    @map("company_id") @db.Uuid
  connectionId  String    @map("connection_id") @db.Uuid
  waId          String    @map("wa_id")
  profileName   String?   @map("profile_name")
  customerId    String?   @map("customer_id") @db.Uuid
  lastInboundAt DateTime? @map("last_inbound_at") @db.Timestamptz(6)
  lastMessageAt DateTime? @map("last_message_at") @db.Timestamptz(6)
  createdAt     DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt     DateTime  @updatedAt @map("updated_at") @db.Timestamptz(6)

  @@unique([connectionId, waId], map: "whatsapp_contacts_connection_id_wa_id_key")
  @@unique([companyId, id], map: "whatsapp_contacts_company_id_id_key")
  @@unique([companyId, connectionId, id], map: "whatsapp_contacts_company_connection_id_key")
  @@index([customerId], map: "whatsapp_contacts_customer_id_idx")
  @@map("whatsapp_contacts")
}

/// @module integraciones
model WhatsappMessage {
  id             String                   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  companyId      String                   @map("company_id") @db.Uuid
  connectionId   String                   @map("connection_id") @db.Uuid
  contactId      String                   @map("contact_id") @db.Uuid
  direction      WhatsappMessageDirection
  wamid          String?                  @unique(map: "whatsapp_messages_wamid_key")
  type           WhatsappMessageType
  body           String?
  payload        Json                     @default("{}")
  status         WhatsappMessageStatus
  errorCode      String?                  @map("error_code")
  errorReason    String?                  @map("error_reason")
  metaTimestamp  DateTime?                @map("meta_timestamp") @db.Timestamptz(6)
  origin         WhatsappMessageOrigin?
  sentById       String?                  @map("sent_by") @db.Uuid
  templateName   String?                  @map("template_name")
  attempts       Int                      @default(0)
  queueMessageId String?                  @map("queue_message_id")
  createdAt      DateTime                 @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt      DateTime                 @updatedAt @map("updated_at") @db.Timestamptz(6)

  @@index([connectionId, contactId, metaTimestamp], map: "whatsapp_messages_connection_contact_ts_idx")
  @@index([sentById], map: "whatsapp_messages_sent_by_idx")
  @@map("whatsapp_messages")
}
```

Decisiones del modelo:

- **Valores de enum en mayúscula**, como `WhatsappConnectionStatus` (QC-237 §2.1). La ficha los
  escribe en minúscula; es el mismo valor. El dominio usa constantes, nunca el literal.
- **`RECEIVED` para los entrantes.** La ficha pide `status` y no dice qué lleva un entrante; un
  valor propio evita una columna nula solo para los `in` y deja fuera de R21 a los entrantes (un
  status de Meta nunca los toca, porque `RECEIVED` no es predecesor de nada).
- **`QUEUED`, `SENDING`, `TEMPLATE` y `origin` ya en el enum.** La ficha fija los campos de salida
  en esta tabla (decisión del humano); QC-240 y QC-241 nombran `queued`, `sending`, `sent`,
  `failed`, `origin=user|system` y plantillas. Ponerlos ahora evita un `ALTER TYPE … ADD VALUE` por
  ficha, que en Postgres no se puede revertir con un `down.sql` limpio. No hay comportamiento
  nuevo detrás: solo los valores que necesita R21 para ordenar.
- **`wamid` nulo y único.** Un saliente `QUEUED` (QC-241) aún no tiene `wamid`; Postgres admite
  varios `NULL` en un índice único. Para un entrante siempre viene (zod lo exige).
- **`payload` `jsonb` no nulo** con `{}` por defecto (§4.3 fija su forma por tipo).
- **`errorCode` como texto**: Meta lo manda como número, pero QC-240 traduce por código y no se
  hace aritmética con él.
- **`attempts` con `0` por defecto**, sin nulo: un contador nulo no significa nada distinto de 0.
- **`customerId` sin FK ni `@relation`** en esta ficha: queda nulo (R16) y QC-239 decide su FK y
  su cruce con `clientes`. El índice sí va, porque QC-239 buscará por él; es un índice sin uso
  hasta entonces, y se acepta porque crearlo después obliga a otra migración en una tabla ya
  poblada. **No se crea ninguna FK a `customers`** (QC-239 decide si es `SET NULL` o `RESTRICT`).
- **`sentById` sin FK** por la misma razón: lo llena QC-240, que decide la FK a `users`.
- **Sin `deletedAt`**: la ficha no lo pide y QC-239 purga con borrado físico (decisión de su ficha).
- **Sin `@relation`** entre los tres modelos: las FK compuestas se escriben a mano en la migración
  (como QC-237 con `companies`), para que ningún `include` cruce de empresa por accidente.

### 2.2 Migración `20261019140000_whatsapp_contacts_and_messages`

Escrita a mano (las FK compuestas y de drift harían que `migrate dev` propusiera un reset, igual que
en `customers` y `whatsapp_connections`). En orden:

1. Los cuatro `CREATE TYPE`.
2. `CREATE TABLE "whatsapp_contacts"` y `CREATE TABLE "whatsapp_messages"` con las columnas de §2.1;
   `updated_at` sin default.
3. Índices de §2.1. Además, `CHECK (length(wa_id) > 0)` en contactos.
4. **FK compuestas (R30):**
   - `whatsapp_contacts (company_id, connection_id) → whatsapp_connections (company_id, id)`
     (usa la clave `whatsapp_connections_company_id_id_key` de QC-237).
   - `whatsapp_messages (company_id, connection_id) → whatsapp_connections (company_id, id)`.
   - `whatsapp_messages (company_id, connection_id, contact_id) → whatsapp_contacts (company_id, connection_id, id)`.
   - `company_id → companies(id)` en las dos tablas.
   - Todas `ON DELETE RESTRICT ON UPDATE CASCADE`, como QC-237.
5. `ENABLE` y `FORCE ROW LEVEL SECURITY` en las dos tablas, sin policies, al final.

`down.sql`: `DROP TABLE "whatsapp_messages"`, `DROP TABLE "whatsapp_contacts"` y los cuatro
`DROP TYPE`, en ese orden.

`guard-empresa-en-esquema`: las dos tablas tienen `company_id`; la lista de exentas no cambia.
`guard-rls-force` las ve por la migración. Sin filas de permisos.

---

## 3. Ruta HTTP

### 3.1 `app/api/integraciones/whatsapp/webhook/[conexionId]/route.ts`

```ts
export { GET, POST } from '@/lib/modules/integraciones/adapters/driving/whatsapp-webhook-route';
export const runtime = 'nodejs';
```

- Solo reexporta y declara `runtime` como literal (el motivo está en `caducar-pedidos/route.ts`:
  Next lee estos campos de forma estática). `nodejs` porque `createHmac`/`timingSafeEqual` de
  `node:crypto` no cargan en el borde.
- **Sin `maxDuration`**: el camino es una consulta, un descifrado, un HMAC y una transacción; el
  límite por defecto de la plataforma basta y no hay presupuesto que medir.
- El segmento se llama `[conexionId]`, como la ficha; la ruta base sale de
  `WHATSAPP_WEBHOOK_ROUTE_BASE` y QC-237 ya construye la URL con ese mismo segmento.
- **Sesión (R1).** `/api/**` no está en `PRIVATE_ROUTE_PREFIXES`, así que el middleware la deja
  pasar (`decideRouteAccess` → `allow`) y le pone su `x-request-id`. No se toca el middleware. Hoy
  Meta recibe `404` (no una redirección), que confirma que el borde ya no la intercepta.

### 3.2 `adapters/driving/whatsapp-webhook-route.ts`

Firma de Next 16 para un segmento dinámico: `(request: Request, context: { params:
Promise<{ conexionId: string }> })`.

**GET**

1. `const { conexionId } = await context.params`.
2. `const query = new URL(request.url).searchParams`; se leen `hub.mode`, `hub.verify_token` y
   `hub.challenge` **con punto** (R8). `URLSearchParams` no convierte `_` en `.` ni al revés, así
   que las variantes con guion bajo simplemente no aparecen.
3. `integraciones.verifyWhatsappWebhook({ connectionId, mode, verifyToken, challenge })`.
4. `verified` ⇒ `new Response(challenge, { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' } })`.
   `forbidden` ⇒ `console.warn('whatsapp_webhook_verify_rejected', { reason })` y `noBody(403)`.

**POST**

1. `const rawBody = new Uint8Array(await request.arrayBuffer())`: los **bytes** exactos. No se usa
   `request.text()`: decodificar y volver a codificar puede cambiar bytes (BOM, secuencias
   inválidas) y entonces el HMAC no casa con el de Meta.
2. `integraciones.receiveWhatsappWebhook({ connectionId, rawBody, signature: request.headers.get('x-hub-signature-256') })`.
3. Traducción del resultado:

| Resultado del caso de uso | Respuesta | Log |
|---|---|---|
| `{ kind: 'ignored', reason }` (`missing`, `addon_off`, `disabled`, `unparseable`) | `200` sin cuerpo | `console.warn('whatsapp_webhook_ignored', { reason })` |
| `{ kind: 'unauthorized' }` | `401` sin cuerpo | `console.warn('whatsapp_webhook_bad_signature')` |
| `{ kind: 'secret_unreadable' }` | `500` sin cuerpo | `console.error('whatsapp_webhook_secret_unreadable', { connectionId })` |
| `{ kind: 'stored', counts }` | `200` sin cuerpo | ninguno (o `counts` si el implementer lo ve útil: solo números) |
| excepción (la transacción falló) | `500` sin cuerpo | `console.error('whatsapp_webhook_store_failed', { connectionId, error: mensaje })` |

- `connectionId` solo entra en un log **después** de validarse como UUID (no se registra lo que
  escribe un desconocido) y nunca el cuerpo, la firma, el token, un `wa_id` ni un texto (R27).
- El mensaje de la excepción de Prisma se registra recortado; no contiene el cuerpo porque los
  valores van parametrizados.
- `ignored` lleva `connectionId` solo si existía; con `missing` no.

---

## 4. Dominio

### 4.1 Resolver la conexión de la URL (`domain/webhook-connection.ts`)

```ts
export type WebhookConnection =
  | { kind: 'missing' }
  | { kind: 'addon_off' }
  | { kind: 'disabled' }
  | { kind: 'ready'; record: WhatsappConnectionRecord; scope: IntegracionesScope };

export async function resolveWebhookConnection(
  deps: { directory: WhatsappWebhookDirectory; integrations: IntegrationsSwitch;
          connections: WhatsappConnectionRepository },
  connectionId: string,
): Promise<WebhookConnection>;
```

1. `z.uuid()` sobre `connectionId`; si no pasa ⇒ `missing` **sin** tocar ningún puerto (R3).
2. `directory.companyOfConnection(connectionId)`; `null` ⇒ `missing`.
3. `integrations.isOn(companyId)`; `false` ⇒ `addon_off` (R4, P2).
4. `scope = { companyId }`; `connections.findLiveById(connectionId, scope)`; `null` ⇒ `missing`
   (la fila se borró entre 2 y 4).
5. `record.status === 'DISABLED'` ⇒ `disabled`; si no ⇒ `ready`.

El ámbito nace **de la fila**, nunca de la petición (R2). Es el único sitio del módulo que construye
un `IntegracionesScope` sin actor; lo fija un test (§10).

### 4.2 Casos de uso

Fábricas `createX(deps)` como el resto del módulo. `deps`: los de §4.1 más `digest: SecretDigest`,
`cipher: SecretCipher`, `signature: WebhookSignature`, `inbox: WhatsappInboxRepository` y
`now?: () => Date`. **Sin actor y sin `requirePermission`**: no hay usuario; la autorización es el
verify token (GET) y la firma (POST), y la empresa sale de la conexión.

**`verifyWhatsappWebhook({ connectionId, mode, verifyToken, challenge })`** →
`{ kind: 'verified'; challenge: string } | { kind: 'forbidden'; reason }`

1. `mode !== 'subscribe'`, o `verifyToken`/`challenge` nulos o vacíos ⇒ `forbidden('bad_request')`
   **sin** tocar ningún puerto.
2. `resolveWebhookConnection`; cualquier cosa que no sea `ready` ⇒ `forbidden(<kind>)` (R7, P4).
3. `digest.matches(verifyToken, record.verifyTokenHash)` (SHA-256 + `timingSafeEqual`, QC-234);
   `false` ⇒ `forbidden('token_mismatch')`.
4. `connections.recordWebhookHandshake(record.id, now(), scope)` (§5.2, R6).
5. `verified` con el `challenge` tal cual.

`reason` es para el log y nunca viaja en la respuesta: el `403` es idéntico en todos los casos.

**`receiveWhatsappWebhook({ connectionId, rawBody, signature })`** →
`ignored | unauthorized | secret_unreadable | stored`

1. `resolveWebhookConnection`; `missing`/`addon_off`/`disabled` ⇒ `ignored(<kind>)` (R9, R4).
2. `appSecret = await decryptStoredSecret({ cipher, connections }, record, APP_SECRET_FIELD, scope)`
   (helper de QC-237). Si lanza `SecretUnreadableError` ⇒ `secret_unreadable`. El helper ya deja la
   conexión en `ERROR` con `UNREADABLE_SECRET_MESSAGE` (R12). Se responde `500` y no `200` a
   propósito: así Meta reintenta y, cuando el Administrador vuelve a escribir las credenciales, los
   reintentos que sigan llegando se guardan.
3. `signature.matches(rawBody, signatureHeader, appSecret)`; `false` ⇒ `unauthorized` (R10, R11).
4. `new TextDecoder('utf-8', { fatal: true }).decode(rawBody)` y `JSON.parse`; cualquier excepción
   ⇒ `ignored('unparseable')` (R13). `TextDecoder` es global de la plataforma: el dominio no
   importa nada para usarlo.
5. `parseWhatsappWebhook(json, record.phoneNumberId)` (§4.3) ⇒ `InboundBatch`, o `null` si la forma
   de fuera no casa ⇒ `ignored('unparseable')`.
6. `await inbox.record(batch, record.id, now(), scope)` (§5.3). Una excepción **se propaga**: el
   adaptador driving la traduce a `500` (R23). No se captura en el dominio para no confundir un
   fallo de la base con un resultado.
7. `stored` con los conteos (`messages`, `statuses`).

Ni `GET` ni `POST` llaman a Graph ni a la cola (R26): `deps` no incluye `graph`.

### 4.3 El cuerpo de Meta (`domain/whatsapp-webhook-payload.ts`, `domain/whatsapp-inbound-message.ts`)

Forma de fuera, con zod y `.passthrough()` donde Meta puede añadir campos (las formas son las de la
documentación de la Cloud API; el implementer las contrasta con la vigente antes de T5):

```ts
const notification = z.object({
  object: z.string(),
  entry: z.array(z.object({
    id: z.string().optional(),
    changes: z.array(z.object({ field: z.string(), value: z.unknown() })),
  })),
});
```

Para cada `change`:

- `field !== 'messages'` ⇒ se salta (R14).
- `value` con zod: `metadata.phone_number_id` (string), `contacts?` (`{ wa_id, profile?: { name? } }[]`),
  `messages?` (`unknown[]`), `statuses?` (`unknown[]`). Si no casa ⇒ se salta ese `change` con un
  aviso en el resultado (no tumba el resto).
- `metadata.phone_number_id !== record.phoneNumberId` ⇒ se salta (R15). El conteo de saltados
  vuelve al driving para su log, sin el número.

Cada mensaje se valida primero con su cabecera común —`id` (wamid), `from` (wa_id), `timestamp`
(string de dígitos) y `type` (string)—. Si la cabecera no casa, el mensaje no se puede guardar ni
como `unsupported` (no hay `wamid`, no hay contacto) y se salta con conteo. Si casa, el tipo decide:

| `type` de Meta | `type` | `body` | `payload` |
|---|---|---|---|
| `text` | `TEXT` | `text.body` | `{}` |
| `image`, `video`, `audio`, `sticker` | el mismo | `caption` si viene, si no `null` | `{ media_id, mime_type, caption? }` |
| `document` | `DOCUMENT` | `caption` si viene, si no `null` | `{ media_id, mime_type, caption?, filename? }` |
| `location` | `LOCATION` | `name` o `address` si vienen, si no `null` | `{ latitude, longitude, name?, address? }` |
| `contacts` | `CONTACTS` | `null` | `{ contacts: <el arreglo tal como llegó> }` |
| `reaction` | `REACTION` | `emoji` (vacío = quitó la reacción) | `{ message_id, emoji }` |
| `button` | `BUTTON` | `button.text` | `{ text, payload? }` |
| `interactive` con `button_reply` o `list_reply` | `INTERACTIVE` | `title` | `{ reply_type, id, title, description? }` |
| cualquier otro, o uno de arriba cuyo objeto no casa con su zod | `UNSUPPORTED` | `null` | el mensaje entero tal como llegó (R20) |

`media_id` es el `id` del objeto de medio de Meta; se renombra para que el `payload` no tenga dos
`id` con significados distintos. Ningún medio se descarga (R19, R26).

`metaTimestamp = new Date(Number(timestamp) * 1000)`.

El resultado es un `InboundBatch` puro:

```ts
type InboundBatch = {
  contacts: ReadonlyArray<{ waId: string; profileName: string | null; latestAt: Date }>; // uno por wa_id
  messages: ReadonlyArray<{ wamid; waId; type; body; payload; metaTimestamp }>;
  statuses: ReadonlyArray<{ wamid; status: 'SENT'|'DELIVERED'|'READ'|'FAILED'; errorCode: string|null; errorReason: string|null }>;
  skipped: { changes: number; messages: number; statuses: number };
};
```

- `contacts` se agrega por `wa_id` en el dominio: `latestAt` = el mayor `metaTimestamp` de sus
  mensajes del lote; `profileName` = el de `value.contacts[]` para ese `wa_id`, o `null`. Solo
  remitentes de mensajes, nunca `recipient_id` de un status.
- Statuses: `status` fuera de los cuatro ⇒ se salta (R22). Con `failed`, `errorCode =
  String(errors[0].code)` y `errorReason = errors[0].error_data?.details ?? errors[0].message ??
  errors[0].title`, recortado a 500, o `null` si no hay `errors`.
- Un mismo `wamid` dos veces en el lote: se queda el primero (la base lo haría igual).

### 4.4 Orden de statuses (`domain/whatsapp-message-status.ts`)

```ts
export const STATUS_PREDECESSORS = {
  SENT:      ['QUEUED', 'SENDING'],
  DELIVERED: ['QUEUED', 'SENDING', 'SENT'],
  READ:      ['QUEUED', 'SENDING', 'SENT', 'DELIVERED'],
  FAILED:    ['QUEUED', 'SENDING', 'SENT'],
} as const;
```

Un status solo se escribe sobre un mensaje cuyo estado actual está en su lista (R21, D5). Así:

- `delivered` después de `read` no cambia nada; `read` después de `delivered`, sí.
- `failed` no pisa `delivered` ni `read`, y nada sale de `FAILED` (P3).
- `RECEIVED` no es predecesor de nada: un status nunca toca un entrante.
- Saltar pasos está permitido (`read` sin `delivered` previo), porque Meta puede perder o desordenar
  el intermedio.

La condición va **en el `where` del `UPDATE`** (§5.3), no en una lectura previa: dos webhooks
concurrentes no pueden hacer retroceder el estado.

---

## 5. Puertos y adaptadores

### 5.1 `WhatsappWebhookDirectory` — la única consulta sin ámbito (R32, P1)

```ts
// ports/whatsapp-webhook-directory.ts
export interface WhatsappWebhookDirectory {
  companyOfConnection(connectionId: string): Promise<string | null>;
}
```

`adapters/driven/persistence/whatsapp-webhook-directory-prisma.ts`, **una sola función**:

```ts
export async function companyOfWhatsappConnection(connectionId: string): Promise<string | null> {
  const row = await prisma.whatsappConnection.findFirst({
    where: { id: connectionId, deletedAt: null },
    select: { companyId: true },
  });
  return row?.companyId ?? null;
}
```

**Por qué existe.** La URL que Meta llama solo trae el id de la conexión (QC-237 D7: una URL por
conexión para validar la firma con su secreto antes de leer el cuerpo). Hasta saber la empresa no
hay ámbito con qué filtrar. QC-237 §13 dejó esta decisión a este spec.

**Por qué es segura así:** devuelve un UUID de empresa y nada más (ni secretos, ni estado, ni
teléfono); la fila completa se lee después con `findLiveById(id, scope)`, ya con ámbito. Quien
conozca el id de una conexión ajena no obtiene nada: la respuesta HTTP es la misma con o sin fila.

**Cómo se vigila.** `guard-ambito-empresa-integraciones.test.ts` gana **una** exención con nombre,
como `EXENTOS_DEL_AMBITO` en la guardia de `pedidos`: el archivo
`whatsapp-webhook-directory-prisma.ts`, con su motivo, y con su forma fijada por la propia guardia:

- exactamente una función que toca la base;
- su único acceso es `prisma.whatsappConnection.findFirst`;
- su `select` es exactamente `{ companyId: true }`;
- su `where` lleva `deletedAt: null`.

El caso «no existe ninguna lista de excepciones» pasa a «la única exención es la del resolutor de
empresa del webhook», y conserva su detección de cualquier otra lista. Casos de sensibilidad con
fuentes sintéticos: un segundo campo en el `select`, una segunda función, o el mismo archivo con
otro nombre ⇒ hallazgo.

### 5.2 `WhatsappConnectionRepository` (se amplía)

```ts
export type WhatsappConnectionPatch = { /* …los de hoy… */ readonly lastWebhookAt?: Date | null };

export interface WhatsappConnectionRepository {
  /* findLive, findLiveById, create, update: sin cambios de firma */
  recordWebhookHandshake(id: string, at: Date, scope: IntegracionesScope): Promise<void>;
}
```

`recordWebhookHandshake` en `whatsapp-connection-prisma.ts` hace **dos** `updateMany`, ambos con
`...whatsappConnectionCompanyScope(scope)` y `deletedAt: null`:

1. `where: { id, status: { not: 'DISABLED' } }`, `data: { lastWebhookAt: at }`;
2. `where: { id, status: 'PENDING' }`, `data: { status: 'ACTIVE' }`.

Cada `UPDATE` es atómico y la condición está en su `where`: si el Administrador deshabilita entre
la lectura y la escritura, ninguno de los dos casa y la conexión sigue `DISABLED` (R6). No hace
falta transacción: el orden importa poco (si cae entre 1 y 2, `lastWebhookAt` ya está puesto y la
siguiente prueba buena la deja `ACTIVE` por QC-237 D12; y Meta repite el handshake al volver a
guardar la URL).

`update` gana `lastWebhookAt: patch.lastWebhookAt` en su `data` (hoy no lo escribe). El webhook no
lo usa: lo usa la transacción de §5.3; se añade para que el `patch` sea completo y el doble de los
tests lo refleje.

La guardia de ámbito sube `metodosEsperados` de 4 a 5.

### 5.3 `WhatsappInboxRepository` (nuevo) y `whatsapp-inbox-prisma.ts`

```ts
export interface WhatsappInboxRepository {
  record(batch: InboundBatch, connectionId: string, receivedAt: Date, scope: IntegracionesScope): Promise<void>;
}
```

`recordWhatsappInbound` abre **un** `prisma.$transaction(async (tx) => …)` (R23) y, en orden:

1. **Contactos.** Por cada `batch.contacts`, una sentencia `tx.$queryRaw` (precedente:
   `order-prisma.ts`), que devuelve el `id`:

   ```sql
   INSERT INTO whatsapp_contacts (company_id, connection_id, wa_id, profile_name,
                                  last_inbound_at, last_message_at, updated_at)
   VALUES ($company, $connection, $waId, $profileName, $latestAt, $latestAt, now())
   ON CONFLICT (connection_id, wa_id) DO UPDATE SET
     profile_name    = CASE WHEN EXCLUDED.last_inbound_at >= COALESCE(whatsapp_contacts.last_inbound_at, '-infinity')
                            THEN COALESCE(EXCLUDED.profile_name, whatsapp_contacts.profile_name)
                            ELSE whatsapp_contacts.profile_name END,
     last_inbound_at = GREATEST(whatsapp_contacts.last_inbound_at, EXCLUDED.last_inbound_at),
     last_message_at = GREATEST(whatsapp_contacts.last_message_at, EXCLUDED.last_message_at),
     updated_at      = now()
   WHERE whatsapp_contacts.company_id = EXCLUDED.company_id
   RETURNING id
   ```

   `$company` sale de `companyScopeColumns(scope).companyId` (la guardia prohíbe leer
   `scope.companyId` a mano). Un solo `INSERT … ON CONFLICT` es atómico frente a dos webhooks
   simultáneos del mismo número, cosa que no garantiza un `upsert` de Prisma con una segunda
   escritura para el `GREATEST`. `GREATEST` ignora `NULL` en Postgres, y hace que un mensaje viejo
   reenviado no retroceda las fechas (R16, R25). El nombre de perfil solo se pisa con uno más
   reciente.
2. **Mensajes.** `tx.whatsappMessage.createMany({ data, skipDuplicates: true })`, que Prisma
   traduce a `INSERT … ON CONFLICT DO NOTHING` (precedente: `order-assignment-prisma.ts`). Cada fila
   con `...companyScopeColumns(scope)`, `connectionId`, el `contactId` del paso 1 por su `wa_id`,
   `direction: 'IN'`, `status: 'RECEIVED'` y los campos del lote (R17, R18).
3. **Statuses.** Por cada uno, `tx.whatsappMessage.updateMany({ where: { wamid, connectionId,
   status: { in: STATUS_PREDECESSORS[s] }, ...whatsappMessageCompanyScope(scope) }, data: { status,
   errorCode, errorReason } })` (`errorCode`/`errorReason` solo con `FAILED`). `count = 0` es el
   caso normal de un `wamid` desconocido o de un status que retrocede (R21, R22).
4. **Conexión.** `tx.whatsappConnection.updateMany({ where: { id: connectionId, deletedAt: null,
   ...whatsappConnectionCompanyScope(scope) }, data: { lastWebhookAt: receivedAt } })` (R24). No
   toca `status`.

Cualquier excepción deshace todo y se propaga (R23). Con un lote vacío solo corre el paso 4.

`company-scope.ts` gana `whatsappContactCompanyScope(scope)` y `whatsappMessageCompanyScope(scope)`,
las dos `return companyScope(scope)`; la guardia, que hoy fija exactamente dos envolturas, pasa a
cuatro. El adaptador es una función con nombre que declara `scope: IntegracionesScope` y lo lleva a
esas envolturas, así que entra en el barrido sin exención.

### 5.4 `WebhookSignature` y `security/webhook-signature-hmac.ts`

```ts
export interface WebhookSignature {
  matches(rawBody: Uint8Array, header: string | null, appSecret: string): boolean;
}
```

1. `header` nulo o que no casa con `/^sha256=([0-9a-f]{64})$/i` ⇒ `false` (R11).
2. `expected = createHmac('sha256', appSecret).update(rawBody).digest()` (32 bytes).
3. `timingSafeEqual(expected, Buffer.from(hex, 'hex'))`. Los dos miden 32 bytes por construcción,
   así que `timingSafeEqual` no lanza por longitud.

`node:crypto` solo en `adapters/driven/` (lo vigila `module-shape.test.ts` R18).

### 5.5 `IntegrationsSwitch`

```ts
export interface IntegrationsSwitch { isOn(companyId: string): Promise<boolean> }
```

Sin adaptador propio: lo arma la composición, como `pdfReading` en `documentos`:
`{ isOn: (companyId) => identity.isCompanyAddonActive(companyId, 'integraciones') }`. La clave del
añadido vive en la composición, no en el módulo.

---

## 6. Composición (`lib/composition/index.ts`)

En el bloque de WhatsApp de `integraciones`, sin reordenar nada:

```ts
const whatsappConnectionRepository: WhatsappConnectionRepository = {
  findLive: findLiveWhatsappConnection,
  findLiveById: findLiveWhatsappConnectionById,
  create: insertWhatsappConnection,
  update: updateLiveWhatsappConnection,
  recordWebhookHandshake: recordWhatsappWebhookHandshake,
};
const whatsappWebhookDirectory: WhatsappWebhookDirectory = { companyOfConnection: companyOfWhatsappConnection };
const whatsappInboxRepository: WhatsappInboxRepository = { record: recordWhatsappInbound };
const webhookSignature: WebhookSignature = webhookSignatureHmac;
const integrationsSwitch: IntegrationsSwitch = {
  isOn: (companyId) => identity.isCompanyAddonActive(companyId, 'integraciones'),
};
const whatsappWebhookDeps = {
  directory: whatsappWebhookDirectory, integrations: integrationsSwitch,
  connections: whatsappConnectionRepository, digest: secretDigest, cipher: secretCipher,
  signature: webhookSignature, inbox: whatsappInboxRepository,
};
// en `integraciones`, al final:
verifyWhatsappWebhook: createVerifyWhatsappWebhook(whatsappWebhookDeps),
receiveWhatsappWebhook: createReceiveWhatsappWebhook(whatsappWebhookDeps),
```

Cada miembro del puerto se cablea a una **función con nombre** (la guardia no sigue lambdas). La
lambda de `integrationsSwitch` no es un puerto de persistencia y la guardia no la mira; es el mismo
patrón que `pdfReading`.

`identity` ya está declarada antes que el bloque de `integraciones` en el archivo (lo usa
`pdfReading`); si el implementer encuentra otro orden, lo mide antes de mover nada.

---

## 7. Contrato del módulo (`index.ts`)

Se suman `createVerifyWhatsappWebhook` y `createReceiveWhatsappWebhook`. Ningún tipo nuevo sale del
contrato: el driving recibe los resultados por inferencia desde la composición.

`module-shape.test.ts` se tensa (§10.3).

---

## 8. Tests: qué nivel prueba qué, y por qué no hay E2E

**No hay E2E de Playwright.** Un webhook no tiene pantalla ni navegador: lo que Playwright añadiría
es levantar `next start` para mandar dos peticiones HTTP, que es lo mismo que hace un test de
integración llamando a los `GET`/`POST` exportados con un `Request` real. El límite de verdad, Meta
llamando a la URL pública, no se puede automatizar en CI (exige una app de Meta, un número real y
un túnel). Se cubre así:

- **Integración contra la base de test** (`tests/integration/integraciones/whatsapp-webhook-route.int.test.ts`):
  los handlers exportados por `whatsapp-webhook-route.ts`, con la composición real (Prisma, cifrado
  de QC-234 con una clave generada en el test, HMAC real), una conexión sembrada con su App Secret
  cifrado y su verify token resumido. Es el recorrido completo ruta → dominio → adaptadores → base,
  sin dobles: handshake, firma, guardado, idempotencia y la transacción que falla.
- **Verificación manual con Meta** (T16): el humano o el implementer, con cloudflared, pulsa
  «Verificar y guardar» en Meta y manda un mensaje desde un teléfono; la evidencia (estado
  `active`, fila en `whatsapp_messages`) va a `progress/impl_QC-238.md`. No es parte del gate.

`guard-identificador-de-request.test.ts > E2E_ESPERADOS` no cambia.

---

## 9. Variables de entorno y despliegue

Ninguna variable nueva (R33). Para que el webhook funcione en un entorno hacen falta las de QC-234
(`INTEGRATIONS_ENCRYPTION_KEYS` y `_ACTIVE`) y `APP_BASE_URL` (QC-237), que ya son condición de
despliegue de QC-237. Sin las de cifrado, el `POST` termina en `500` con
`whatsapp_webhook_secret_unreadable` (el `GET` funciona: no descifra nada).

---

## 10. Tests

### 10.1 Nuevos

| Archivo | Cubre |
|---|---|
| `tests/unit/integraciones/whatsapp/verify-whatsapp-webhook.test.ts` | R3 (id no UUID: ningún puerto llamado), R4 (añadido apagado ⇒ `forbidden`), R5, R6 (`PENDING`/`ACTIVE`/`ERROR`: `recordWebhookHandshake` llamado con `now()` y el ámbito de la fila), R7 (cada causa ⇒ `forbidden`, ningún `recordWebhookHandshake`; `bad_request` sin tocar puertos), R2 (el ámbito sale de `directory`, nunca de la entrada) |
| `tests/unit/integraciones/whatsapp/receive-whatsapp-webhook.test.ts` | R9 (`missing`/`disabled`/`addon_off` sin `decrypt` ni `signature`), R4, R10 (orden: firma antes de `JSON.parse`; con firma mala, un cuerpo no JSON no lanza), R11, R12 (`SecretUnreadableError` ⇒ `secret_unreadable` y `update` a `ERROR` con el mensaje de QC-237), R13, R23 (una excepción del `inbox` se propaga), R26 (`deps` sin Graph; `fetch` espiado no se llama) |
| `tests/unit/integraciones/whatsapp/whatsapp-webhook-payload.test.ts` | R14, R15, R16 (agregado por `wa_id`, `latestAt` el mayor, `profileName` de `contacts[]`), R17, R19 (cada fila de la tabla de §4.3), R20 (tipo desconocido, `interactive` de otro subtipo y un `image` sin `id` ⇒ `UNSUPPORTED` con el mensaje entero), R22 (status desconocido), cabecera rota ⇒ saltado |
| `tests/unit/integraciones/whatsapp/whatsapp-message-status.test.ts` | R21: la tabla completa de transiciones (cada estado actual × cada status entrante) |
| `tests/unit/integraciones/whatsapp/webhook-signature-hmac.test.ts` | R10, R11: vector conocido calculado en el test con `createHmac`; un byte cambiado ⇒ `false`; cabecera sin `sha256=`, con 63 hex o nula ⇒ `false` sin lanzar; bytes no UTF-8 en el cuerpo firman bien (prueba de que se firma el binario, no un texto) |
| `tests/unit/integraciones/whatsapp/whatsapp-webhook-route.test.ts` | R1 (`decideRouteAccess` con sesión anónima y la ruta ⇒ `allow`), R8 (solo `hub_*` ⇒ el caso de uso recibe `null`), traducción de cada resultado a su código, `content-type` `text/plain` y cuerpo exacto del challenge, R27 (con `console.warn`/`error` espiados, ningún argumento contiene el cuerpo, la firma, el token, un `wa_id` ni el texto de prueba), una excepción del caso de uso ⇒ `500` |
| `tests/integration/integraciones/whatsapp-webhook-route.int.test.ts` | Recorrido real (§8): R5 + R6 (handshake deja `ACTIVE` y `lastWebhookAt`), R7 (token malo y conexión `DISABLED` ⇒ `403`, fila sin cambios), R9, R11 (firma mala ⇒ `401`, cero filas, `lastWebhookAt` igual), R16–R18, R20, R21, R24, R25 (mismo `POST` dos veces ⇒ una fila), R23 + R25 (con `prisma.$transaction` envuelto para lanzar **después** de ejecutar el callback real: `500` y cero filas; el reintento sin la envoltura guarda una sola vez), R4 (añadido apagado ⇒ `200`, nada guardado), R12 (secreto cifrado con otra clave ⇒ `500` y `ERROR`) |
| `tests/integration/integraciones/whatsapp-inbox-prisma.int.test.ts` | R2 (un status de la empresa B con el `wamid` de un mensaje de A no lo toca), R16 (`GREATEST`: un lote más viejo no retrocede fechas ni nombre), R18 (`ON CONFLICT`), R21 (el `where` no deja retroceder), dos `record` concurrentes del mismo número ⇒ un contacto |
| `tests/integration/integraciones/whatsapp-messages-constraints.int.test.ts` | R28, R29 (únicos, índice por nombre en `pg_indexes`, RLS forzada en `pg_class`), R30 (contacto con empresa distinta de su conexión, y mensaje con contacto de otra conexión ⇒ rechazo de FK), R32 (`companyOfWhatsappConnection`: viva ⇒ su empresa; borrada o inexistente ⇒ `null`) |
| `tests/integration/integraciones/whatsapp-messages-migration.int.test.ts` | R28, R29: `down.sql` y vuelta a `migration.sql` dejan el mismo esquema, con el patrón de `whatsapp-connection-migration.int.test.ts` |

Los `.int.test.ts` nuevos entran en `tests/integration/aislamiento.json` con su forma de
aislamiento: los que llaman a la ruta o al adaptador escriben con `commit` (la transacción de la ruta
no puede envolverse en la transacción del test) y llevan `motivo` y `desde`, como
`whatsapp-connection-prisma.int.test.ts`; limpian por empresa efímera.

Los cuerpos de prueba se construyen en `tests/unit/integraciones/whatsapp/whatsapp-webhook-fixtures.ts`
con las formas de la documentación de la Cloud API, sin números ni nombres reales.

### 10.2 Guardias y tests de otras fichas que se tensan (nunca se relajan)

| Archivo | Qué fija hoy | Cambio |
|---|---|---|
| `tests/guards/guard-rutas-fuera-de-sesion.test.ts` | Dos rutas clasificadas | + `'app/api/integraciones/whatsapp/webhook/[conexionId]/route.ts': { anadido: 'integraciones', prueba: 'tests/unit/integraciones/whatsapp/receive-whatsapp-webhook.test.ts' }` (R31); el ancla anti-vacuidad gana la ruta nueva |
| `tests/guards/guard-ambito-empresa-integraciones.test.ts` | Un puerto de 4 métodos, 2 envolturas, ninguna exención | Puerto de conexión con 5 métodos; segundo puerto `WhatsappInboxRepository` (1 método) con el mismo barrido; 4 envolturas; la exención única de §5.1 con su forma vigilada y sus casos de sensibilidad (R2, R32) |
| `tests/unit/integraciones/module-shape.test.ts` R18 | Lista exacta de `.ts` del módulo | + los archivos nuevos de §1 |
| … R20 | Contrato exacto | + `createVerifyWhatsappWebhook`, `createReceiveWhatsappWebhook` |
| … R19 (quién importa el módulo) | Lista exacta | + `app/api/integraciones/whatsapp/webhook/[conexionId]/route.ts` |
| … R19 (cableado) | Miembros exactos de `integraciones` y tipos de sus puertos | + `verifyWhatsappWebhook`, `receiveWhatsappWebhook`; `typeOf` de `whatsappWebhookDirectory`, `whatsappInboxRepository`, `webhookSignature`, `integrationsSwitch` |
| … R13 | Tres modelos de `integraciones` | Cinco: + `WhatsappContact`, `WhatsappMessage` |
| `tests/unit/integraciones/whatsapp/whatsapp-doubles.ts` | Repositorio doble de 4 métodos | + `recordWebhookHandshake`; `update` aplica `lastWebhookAt` |

`R22` de `module-shape.test.ts` solo corre en la rama de QC-221: no aplica.

---

## 11. Fronteras con otras fichas y choques previsibles

- **QC-239** pone `customerId` dentro de la misma transacción de §5.3 (paso 1) y decide la FK a
  `customers`; purga contactos y mensajes. Aquí `customerId` queda nulo.
- **QC-240/QC-241** insertan salientes (`direction = OUT`, `origin`, `sentById`, `attempts`,
  `queueMessageId`, `templateName`) y actualizan `lastMessageAt` al enviar. Los statuses de sus
  `wamid` los escribe ya esta ficha (R21).
- **QC-242** añade `message_template_status_update` y `template_category_update` al filtro de R14:
  hoy esos `changes` se saltan sin error.
- **QC-245/246** leen las tablas para mostrar conversaciones.

| Archivo | Con quién | Cómo se resuelve |
|---|---|---|
| `db/schema.prisma`, `db/migrations/` | Toda ficha con esquema en vuelo (QC-131, QC-274, QC-279 del mismo autor; otras según `archivos-en-vuelo --candidata` en F2.0) | Bloque nuevo al final; el timestamp se re-fecha en F2.3 si `dev` trae una posterior |
| `lib/composition/index.ts` | Todas las fichas con cableado | Solo el bloque de WhatsApp de `integraciones` |
| `tests/guards/guard-rutas-fuera-de-sesion.test.ts` | Toda ficha con una ruta `app/api` nueva | Una entrada más |
| `tests/integration/aislamiento.json` | Toda ficha con tests de integración | Entradas nuevas en orden alfabético |
| `lib/modules/integraciones/**`, `module-shape.test.ts`, `guard-ambito-empresa-integraciones.test.ts` | QC-242 (mismo módulo; depende de esta) | Va después; amplía las listas exactas |

---

## 12. Alternativas descartadas

1. **Meter la empresa en la URL** (`/webhook/{companyId}/{conexionId}`) para no tener una consulta
   sin ámbito. Cambia la URL que QC-237 ya muestra y que el Administrador ya pegó en Meta (hoy
   Meta llama a la URL de una sola pieza), y la empresa seguiría llegando de fuera: habría que
   comprobarla contra la fila igualmente, o sea, leer la fila por id.
2. **Buscar la conexión por `metadata.phone_number_id` del cuerpo** (una URL única para todas).
   Obliga a leer el cuerpo antes de validar la firma, que es lo que QC-237 D7 y la D3 de aquí
   prohíben.
3. **Un `upsert` de Prisma para el contacto, más un `updateMany` con `lt` para las fechas.** Son
   dos sentencias por contacto; entre ellas otro webhook del mismo número puede escribir y la
   condición de «no retroceder» depende de una relectura. El `INSERT … ON CONFLICT … GREATEST` lo
   hace en una sentencia atómica.
4. **Comprobar el orden de statuses leyendo el mensaje y decidiendo en el dominio.** Dos webhooks
   concurrentes (`delivered` y `read` llegan juntos con frecuencia) pueden leer el mismo estado y
   el último en escribir gana, aunque retroceda. La condición en el `where` del `UPDATE` no tiene
   esa carrera.
5. **Responder `200` también con el App Secret ilegible.** Evitaría reintentos, pero Meta no
   volvería a mandar esos mensajes: se perderían hasta que el Administrador viera el error. Con
   `500` la conexión queda en `error` (visible en la tarjeta) y los reintentos de Meta se guardan
   cuando se arreglan las credenciales.
6. **Leer el cuerpo con `request.text()`** como `documentos`. QStash firma de otra forma; para el
   HMAC de Meta lo correcto son los bytes recibidos, sin decodificar y volver a codificar.
7. **Un E2E con Playwright** que haga los `GET`/`POST` contra `next start`. Prueba lo mismo que el
   test de integración sobre los handlers, con un servidor y un navegador que el webhook no usa, y
   suma minutos al gate del PR a producción (§8).
8. **Guardar el mensaje de Meta entero en `payload` para todos los tipos.** Acopla a quien lea
   (QC-245/246) al formato de Meta, que cambia por versión, y duplica `id`, `from` y `timestamp`
   que ya tienen columna. Solo `UNSUPPORTED` lo guarda entero, porque no hay forma conocida que
   extraer.
9. **Activar la conexión también con el primer `POST` firmado.** La ficha dice que la activa el
   `GET`, y QC-237 D12 ya cubre el caso de una conexión que recibe sin handshake: el `POST` pone
   `lastWebhookAt` y la siguiente prueba buena la deja `active`.

---

## 13. Dependencias de terceros

**Ninguna** (R33). `createHmac`, `timingSafeEqual` (`node:crypto`), `TextDecoder` y `URL` son de
la plataforma; `zod` ya está. `package.json` no cambia.
