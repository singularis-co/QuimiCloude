# QC-245 — contactos-whatsapp-backend · design.md

> Zona: `backend` · Complejidad: `medium` · depends_on: QC-240, QC-242 · Rama:
> `feature/QC-245-contactos-whatsapp-backend`
>
> El **qué** está en `requirements.md` (R1–R43; la Enmienda 1 del 2026-10-23 añade R44–R59, cuyo
> cómo está en §15, y D12–D14 del mismo día añaden R60–R63, §15.8). Aquí va el **cómo**. Precedentes que se copian:
>
> - **QC-240** (`db/migrations/20261023120000_whatsapp_send_permission`): migración de datos del
>   permiso, permiso dentro del añadido `integraciones`, `requireSendPermission`, las dos Server
>   Actions de envío, `isWindowOpen`, `isSendable`, `sendFailureOf`.
> - **QC-238**: `whatsapp_messages`/`whatsapp_contacts`, `metaTimestamp`, `lastInboundAt`,
>   `lastMessageAt`, el `payload` de cada tipo (`whatsapp-inbound-message.ts`).
> - **QC-239**: vínculo contacto ↔ cliente, `blockedAt`, `CustomerPhoneLinks.isCustomerAlive`.
> - **QC-242**: `toWhatsappTemplateView`, `WhatsappTemplateRepository.listLive`, diccionario de
>   variables propias.
> - **QC-87**: `PeopleDirectory.findRefsIncludingDeletedInCompany` para nombrar a una persona desde
>   otro módulo sin leer `users`.
> - **`pedidos/list-orders.ts`**: otro módulo entrega los ids que casan con un texto
>   (`findIdsMatchingName`) y la consulta propia filtra por ellos.
>
> **Regla transversal.** Manda `docs/conventions.md > Comentarios`: ningún comentario nuevo cita
> `QC-<n>`, `R<n>`, `design.md` ni «decisión cerrada». En los tests, `R<n>` va en el nombre del caso.

---

## Lo que ya existe

Buscado `whatsapp.consultar`, `lastReadAt`/`last_read_at`, `conversation`/`conversación`, «no
leídos», «chat», `listWhatsappConversations`, `sendWhatsappMessage`, «plantillas aprobadas» en:

- `feature_list.json` (por `name` y `description`, todos los estados);
- `specs/` con grep;
- el código (`lib/`, `app/`, `db/`, `tests/`) con Grep/Read. **El MCP del grafo no se consultó**
  (este agente no lo tenía a mano); se usó Grep/Read.

| Apareció | Qué es | Qué se hace |
|---|---|---|
| QC-240 (`done`, PR #305): `sendWhatsappMessageAction`, `retryWhatsappMessageAction` (`adapters/driving/whatsapp-message-actions.ts`), `whatsapp.enviar`, validación de plantilla enviable y de constantes antes de Meta | Envío, reintento y la validación que la ficha pide en «Enviar con plantilla» | **Se reutiliza tal cual** (R34, R35, P1, P2). No se crea ninguna acción de envío |
| QC-240: `isWindowOpen`, `WHATSAPP_WINDOW_MS` (`domain/whatsapp-send-window.ts`) | Regla de la ventana | **Se reutiliza** para el estado de la ventana del chat (R28) |
| QC-240: `sendFailureOf` y textos de `domain/whatsapp-send-failure.ts` | Traducción de códigos de Meta | **Se reutiliza**: se exporta la función por código que hoy es interna (`reasonOf` → `sendFailureReasonOf`) (R26) |
| QC-240: `isSendable` (`domain/whatsapp-template-message.ts`) | Definición de plantilla enviable | **Se reutiliza** para el selector (R32) |
| QC-240: migración `whatsapp_send_permission` y `requireSendPermission` | Forma del permiso | **Se copia** para `whatsapp.consultar` (R1–R4) |
| QC-242: `toWhatsappTemplateView`, `listWhatsappTemplatesAction({ onlyApproved })` | Listado de plantillas para Integraciones | **No sirve tal cual**: exige `integraciones.modificar` y no filtra por habilitada y relacionada. Se reutiliza `toWhatsappTemplateView` dentro de un caso de uso nuevo con `whatsapp.consultar` (R32, R33) |
| QC-239: `CustomerPhoneLinks.isCustomerAlive`; `WhatsappContactRepository` | Vida del cliente y contactos | `isCustomerAlive` se reutiliza en el chat; el listado necesita muchos ids a la vez y usa el `CustomerCatalog` (§5.3) |
| QC-239 «Listar conversaciones (con el número como nombre) y el filtro de bloqueados: QC-245» | Traspaso que choca con D2 | **P11** (manda D2) y **P7** (filtro de bloqueados como default) |
| `clientes`: `CustomerCatalog.findRefsIncludingDeleted`, `searchCondition`, `formatPhoneInternational` | Nombre, baja y búsqueda de clientes; formato de teléfono | **Se reutilizan**; el catálogo gana un método (§5.3) |
| `identity`: `PeopleDirectory`, `buildDisplayName` | Nombre mostrable de una persona | **Se reutiliza** para «quién lo envió» (R27) |
| QC-244 (`done`): `/clientes/contactos` placeholder con `clientes.consultar` | Pantalla | Frontera: el cambio de permiso de la página lo hace QC-246 |
| QC-246 (`pending`) | Pantalla de Contactos | Consumidor del §«Contrato para la pantalla» |
| Ningún `lastReadAt`, `whatsapp.consultar`, listado de conversaciones ni lectura de chat | — | Nacen aquí |

Conclusión: el envío existe y se reutiliza; las consultas no existen. Se sigue. La feature no toca
UI: no se consulta `components/shared/CATALOGO.md` y no hay pase `/design`.

**Enmienda 1 (2026-10-23).** Buscado además «media», `media_id`, `wamid`, «reacción», «constantes
del sistema», `cliente.nombre`, «pedidos del cliente», «nombre de la empresa», «fecha de entrega» y
«total» en `specs/`, `lib/`, `app/` y `db/` con Grep/Read (el grafo, de nuevo, no se consultó):

| Apareció | Qué es | Qué se hace |
|---|---|---|
| `whatsapp-inbound-message.ts`: `payload.media_id` en imagen, sticker, audio, video y documento; `payload.message_id` (= `wamid`) en reacción | Lo que hay para pedir un archivo y para casar una reacción | `media_id` solo lo lee el caso de uso del archivo (R47); la reacción se casa en SQL por `wamid` (único) dentro del contacto (R49) |
| `whatsapp-graph-client-fetch.ts` (`callGraph`, token solo en cabecera, `GRAPH_TIMEOUT_MS`) y su doble `whatsapp-graph-client-canned.ts` | Cliente de Graph | Gana `downloadMedia` (§15.2); el doble, un PNG fijo |
| `decryptStoredSecret` + `ACCESS_TOKEN_FIELD` (QC-240, `send-whatsapp-message.ts`) | Leer el token de la conexión | **Se reutiliza** para la descarga |
| `app/api/integraciones/whatsapp/webhook/[conexionId]/route.ts` (reexport de un driving) y `guard-rutas-fuera-de-sesion.test.ts` | Forma de una ruta de `app/api` | **Se copia** la forma; la ruta nueva entra en la guardia como del añadido `integraciones` |
| Ningún archivo servido a un usuario con sesión desde una ruta (`createSignedUrl` solo en Storage de documentos y evidencias) | — | Nace aquí (§15.1) |
| QC-243 `design.md > 5`: catálogo de constantes del front, `cliente.nombre`, `pedido.numero`, `empresa.nombre` | El único catálogo de constantes escrito | Sus tres claves se mantienen; D13 añade cuatro `pedido.*` que el front tendrá que aprender (R55, §11). QC-242 F4 fija el formato con punto; QC-247 (`pending`) menciona `pedido.fecha_entrega`, sin código |
| `OrderCatalog.listDeliveryProgressByIdsIncludingDeleted`, `orderedPackages`, `remainingPackages`, `formatOrderNumber` (contrato de `pedidos`) | Envases por línea, entregados y faltantes; número visible | **Se reutilizan** (R51, R52) |
| `OrderCatalog` no lista por cliente; `orders_company_id_customer_id_idx` existe | — | Servicio nuevo `CustomerOrderDirectory` en `pedidos` (§15.4) |
| `PresentationCatalog.findRefs` (`inventario`), `RecipeCatalog.findRefsIncludingDeleted` (`recetas`) | Nombre de la presentación y del producto | **Se reutilizan** |
| `identity.getCompanyCountry` (dato de presentación de la propia empresa, sin permiso) | Precedente de lectura de un campo de la empresa | **Se copia** para `getCompanyName` (§15.5) |
| `WhatsappVariableKeyRepository.listAll` (QC-242) | Variables propias con valor | **Se reutiliza** (R56) |
| Fecha de entrega o prometida en `orders` | No existe | Fuera del contrato (D10) |
| QC-307 (`in_progress`, sin mergear): precio de venta del pedido | Total del pedido | No se espera: `total: null` (D11) |
| D12–D14: `ORDER_STATUSES_NOT_IN_PROGRESS` (`pedidos/domain/order-classification.ts`, `['ENTREGADO', 'CANCELADO']`) | Los estados que no son «en curso» | Es exactamente «no abierto» (D12): se exporta del barril de `pedidos` y se pasa como `excludedStatuses` (§15.8) |
| `ORDER_STATUS_LABELS` (`lib/shared/ui/order-status.ts`) | Etiquetas internas de Pedidos («En fabricación», «Por empacar»…) | **No sirven** para el cliente (alternativa 19). No hay ninguna agrupación en lenguaje del cliente: nace aquí desde el `enum OrderStatus` (R60) |
| `formatCivilDate` (`lib/shared/ui/date-civil.ts`) | Día civil UTC con que Pedidos pinta fechas | Misma regla para `pedido.fecha_solicitud` (R61, P21), reescrita en el dominio (que no importa `lib/shared`) |

---

## 1. Qué cambia (resumen)

```
db/schema.prisma                                          ← WhatsappContact + lastReadAt
db/migrations/20261024120000_whatsapp_read_permission/{migration,down}.sql   ← datos (R1, R2)
db/migrations/20261024130000_whatsapp_contacts_last_read/{migration,down}.sql ← columna (R14, R42)
lib/modules/identity/domain/permissions.ts                ← + whatsapp.consultar, seed del Administrador
lib/modules/identity/domain/company-addons.ts             ← whatsapp.consultar en el añadido integraciones
lib/modules/clientes/domain/customer-catalog.ts           ← + findAliveIdsMatchingName
lib/modules/clientes/adapters/driven/persistence/customer-catalog-prisma.ts ← su implementación
lib/modules/integraciones/
  index.ts                                                ← + fábricas y tipos de la vista
  domain/
    actor.ts                                              ← + requireReadPermission
    whatsapp-send-failure.ts                              ← exporta sendFailureReasonOf
    whatsapp-conversation.ts                              ← tipos de la vista (DTO), vista previa, metadata, motivo
    whatsapp-conversation-input.ts                        ← zod de las cuatro consultas
    list-whatsapp-conversations.ts                        ← caso de uso
    get-whatsapp-chat.ts                                  ← caso de uso
    mark-whatsapp-chat-read.ts                            ← caso de uso
    list-sendable-whatsapp-templates.ts                   ← caso de uso
  ports/
    whatsapp-conversation-repository.ts                   ← nuevo
  adapters/driven/persistence/
    whatsapp-conversation-prisma.ts                       ← nuevo
  adapters/driving/
    whatsapp-conversation-actions.ts                      ← cuatro Server Actions
lib/composition/index.ts                                  ← cableado
tests/**                                                  ← §10
```

Lo que añade la Enmienda 1 (archivo de un medio, reacciones por id interno, contexto del chat) está
en §15.0.

---

## 2. Modelo de datos

### 2.1 Prisma (`WhatsappContact`)

```prisma
  lastMessageAt    DateTime? @map("last_message_at") @db.Timestamptz(6)
  lastReadAt       DateTime? @map("last_read_at") @db.Timestamptz(6)   // nuevo
```

- Una columna en el contacto y no una tabla por usuario: D3.
- **Sin RLS nueva**: `whatsapp_contacts` ya tiene `ENABLE` y `FORCE ROW LEVEL SECURITY` (QC-238). La
  autorización vive en el caso de uso (`docs/architecture.md > Acceso a datos y autorizacion`).
- **Sin índice nuevo.** Las lecturas de mensajes filtran por `connection_id, contact_id`, que ya
  cubre `whatsapp_messages_connection_contact_ts_idx`; el orden por hora se hace sobre los mensajes
  de un solo contacto. Si un chat creciera a decenas de miles de mensajes, el índice de expresión
  `(contact_id, COALESCE(meta_timestamp, created_at), id)` es la mejora (§12, alternativa 5).

### 2.2 Migración de datos `20261024120000_whatsapp_read_permission` (R1, R2)

Copia de la de QC-240:

```sql
INSERT INTO "permissions" ("code", "module", "action", "description", "updated_at") VALUES
  ('whatsapp.consultar', 'whatsapp', 'consultar',
   'Ver las conversaciones de WhatsApp con los clientes de la empresa.', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_code")
SELECT "r"."id", 'whatsapp.consultar' FROM "roles" AS "r" WHERE "r"."name" = 'Administrador'
ON CONFLICT ("role_id", "permission_code") DO NOTHING;
```

`down.sql`: `DELETE FROM "role_permissions" WHERE "permission_code" = 'whatsapp.consultar'` y luego
`DELETE FROM "permissions" WHERE "code" = 'whatsapp.consultar'`.

`permissions.ts` gana la entrada y `SEED_ROLE_PERMISSIONS[ROLE_ADMINISTRADOR]` la incluye.
`company-addons.ts` la pone en `ADDON_PERMISSIONS.integraciones` (R3): la sesión ya la quita con el
añadido apagado y no hace falta `assertAddon`.

### 2.3 Migración de esquema `20261024130000_whatsapp_contacts_last_read` (R14, R42)

```sql
ALTER TABLE "whatsapp_contacts" ADD COLUMN "last_read_at" TIMESTAMPTZ(6);
```

`down.sql`: `ALTER TABLE "whatsapp_contacts" DROP COLUMN "last_read_at";`. Los contactos existentes
quedan sin marca: todos sus entrantes cuentan como no leídos (R15). Los timestamps se re-fechan en
F2.3 si `dev` trae una posterior.

---

## 3. Contratos de entrada (`domain/whatsapp-conversation-input.ts`)

```ts
export const CONVERSATION_SEARCH_MAX_LENGTH = 100;
export const CHAT_DEFAULT_PAGE_SIZE = 30;   // P12
export const CHAT_MAX_PAGE_SIZE = 50;       // P12

export const listWhatsappConversationsSchema = z.object({
  search: z.string().max(CONVERSATION_SEARCH_MAX_LENGTH).default(''),
  blocked: z.enum(['all', 'blocked', 'not_blocked']).default('all'),   // P7
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).optional(),                       // se acota con lib/shared/pagination
}).strict();

export const getWhatsappChatSchema = z.object({
  target: z.union([
    z.object({ contactId: z.uuid() }).strict(),
    z.object({ customerId: z.uuid() }).strict(),
  ]),
  before: z.uuid().optional(),                                        // cursor: id del mensaje más antiguo ya mostrado
  pageSize: z.number().int().min(1).optional(),                       // se acota a CHAT_MAX_PAGE_SIZE
}).strict();

export const markWhatsappChatReadSchema = z.object({
  contactId: z.uuid(),
  upToMessageId: z.uuid().optional(),                                 // P4
}).strict();
```

`pageSize` mayor que el tope se **acota** (como `lib/shared/pagination`), no se rechaza. La búsqueda
se recorta antes de usarla (R10).

---

## 4. Dominio

### 4.1 Autorización (`domain/actor.ts`)

```ts
export const WHATSAPP_READ_PERMISSION = 'whatsapp.consultar';
export function requireReadPermission(actor): asserts actor is Actor;   // assertPermission + empresa no vacía
```

Primera línea de los cuatro casos de uso (R4). Los envíos siguen con `requireSendPermission` (R5).

### 4.2 Vista (`domain/whatsapp-conversation.ts`) — puro

Los tipos públicos son los del §«Contrato para la pantalla». Funciones:

- `previewOf(body: string | null): string | null` — recorta a 120 puntos de código (R8).
- `attachmentOf(type, payload): WhatsappChatAttachment | null` — por tipo, solo las claves de R25
  (`mime_type`, `filename`, `caption`, `latitude`, `longitude`, `name`, `address`, `emoji`,
  `message_id`), leídas con zod `safeParse`; un `payload` que no casa da `null`. Nunca `media_id`.
- `failureReasonOf(message)`: `status !== 'FAILED'` ⇒ `null`; con `errorCode` numérico ⇒
  `sendFailureReasonOf(Number(code))` (QC-240); sin código ⇒ `errorReason ?? 'No se pudo enviar el
  mensaje.'` (R26, P8). Un `errorCode` no numérico se trata como sin código.
- `windowOf(lastInboundAt, now)`: `isWindowOpen` ⇒ `{ open: true, closesAt: lastInboundAt +
  WHATSAPP_WINDOW_MS }`; si no, `{ open: false, closesAt: null }` (R28).
- `customerNameOf(ref)`: `` `${firstNames} ${lastNames}`.trim() ``.
- El teléfono: `formatPhoneInternational(waId)` del contrato de `clientes` (R7).

### 4.3 `listWhatsappConversations(input, actor)` (R6–R13, R15)

1. `requireReadPermission(actor)`; `scope = scopeOf(actor)`.
2. `safeParse`; fallo ⇒ `ValidationError`.
3. `connections.findLive(scope)`; `null` ⇒ `{ connectionStatus: null, page: vacía }` (R13).
4. `linked = conversations.listLinkedCustomerIds(connection.id, scope)` (distintos, solo contactos
   con mensajes).
5. `refs = customers.findRefsIncludingDeleted(linked, companyId)`; `alive = refs sin baja` (D2, R6).
   Sin vivos ⇒ página vacía.
6. Búsqueda (R10): `search = input.search.trim()`. Vacía ⇒ sin filtro. Si no:
   `nameIds = customers.findAliveIdsMatchingName(search, aliveIds, companyId)` y `digits = search`
   sin lo que no sea dígito (`''` ⇒ no filtra por número).
7. `conversations.listPage({ connectionId, customerIds: aliveIds, nameMatchIds, digits, blocked,
   offset, limit }, scope)` ⇒ `{ rows, total }` (R9, R11, R12).
8. Se arma cada fila con el nombre de `refs`, el teléfono formateado y `previewOf` (R7, R8).

### 4.4 `getWhatsappChat(input, actor)` (R21–R31)

1. Permiso, parseo, `connection = connections.findLive(scope)`.
2. **Por contacto**: sin conexión ⇒ `WhatsappContactNotFoundError`;
   `conversations.findContact(contactId, connection.id, scope)`; `null`, `customerId === null` o
   `customers.findAliveRefById(customerId)` nulo ⇒ `WhatsappContactNotFoundError` (R21).
3. **Por cliente**: `customers.findAliveRefById(customerId)` nulo ⇒ `LinkedCustomerNotFoundError`
   (`customer_not_found`) (R30). Sin conexión, o
   `conversations.findLatestContactOfCustomer(customerId, connection.id, scope)` nulo ⇒ chat vacío
   (`contact: null`, `customer` con nombre, `window` cerrada, `messages: []`, `hasMore: false`).
4. Mensajes: `conversations.listMessages(contactId, connection.id, { before, limit: size + 1 },
   scope)`; `before` que no es del contacto ⇒ el puerto devuelve `'cursor_not_found'` ⇒
   `WhatsappMessageNotFoundError` (R23). Se piden `size + 1` para saber `hasMore`; el puerto
   devuelve de más reciente a más antiguo y el caso de uso invierte (R22).
5. Autores: ids `sentById` distintos ⇒ `people.findRefsIncludingDeletedInCompany(companyId, ids,
   now)` ⇒ `displayName` o `null` (R27).
6. Cabecera: `unreadCount = conversations.countUnread(contactId, scope)` (R15, R29); ventana (R28).
7. **No escribe nada** (R20).

### 4.5 `markWhatsappChatRead(input, actor)` (R16–R20)

1. Permiso, parseo, conexión; mismas comprobaciones que 4.4 paso 2 (R19).
2. `conversations.advanceLastRead(contactId, upToMessageId ?? null, scope)` ⇒
   `'ok' | 'message_not_found'`; `'message_not_found'` ⇒ `WhatsappMessageNotFoundError` (R17).
3. Devuelve `{ unreadCount: conversations.countUnread(contactId, scope) }` (R20).

La hora se calcula **en SQL** (§5.2): así la marca guarda los microsegundos de la base y la
comparación de R15 no pierde precisión al pasar por un `Date` de JS.

### 4.6 `listSendableWhatsappTemplates(actor)` (R32, R33)

`requireReadPermission`; `connections.findLive`; `null` ⇒ `[]`. `templates.listLive(connection.id,
{ onlyApproved: true }, scope)` filtrado con `isSendable`; `variableKeys.listAll(scope)` para clave,
etiqueta y valor. Cada plantilla con `toWhatsappTemplateView` reducido a los campos del contrato y,
en las variables propias, `value` (P9). Orden: el de `listLive`.

### 4.7 Envío y cliente borrado (R34–R38)

Sin código nuevo de envío. R35 y R36 se verifican con tests de integración que llaman a las acciones
de QC-240 sobre el escenario de esta ficha (§10). R37 y R38 son comportamiento de `clientes` y de
QC-239: los tests comprueban que la baja no toca contactos ni mensajes y que el contacto sin cliente
no aparece.

---

## 5. Puertos y adaptadores

### 5.1 `WhatsappConversationRepository` (nuevo, `ports/whatsapp-conversation-repository.ts`)

```ts
export type ConversationContactRow = {
  readonly id: string; readonly waId: string; readonly customerId: string | null;
  readonly blockedAt: Date | null; readonly lastInboundAt: Date | null;
};
export type ConversationRow = ConversationContactRow & {
  readonly unreadCount: number;
  readonly lastMessage: { direction; type; body: string | null; status; at: Date } | null;
};
export type ChatMessageRow = {
  id; direction; type; body: string | null; payload: unknown; status; errorCode: string | null;
  errorReason: string | null; origin: 'USER' | 'SYSTEM' | null; sentById: string | null;
  templateName: string | null; at: Date;
};

export interface WhatsappConversationRepository {
  listLinkedCustomerIds(connectionId: string, scope): Promise<readonly string[]>;
  listPage(query: ConversationPageQuery, scope): Promise<{ rows: readonly ConversationRow[]; total: number }>;
  findContact(id: string, connectionId: string, scope): Promise<ConversationContactRow | null>;
  findLatestContactOfCustomer(customerId: string, connectionId: string, scope): Promise<ConversationContactRow | null>;
  listMessages(contactId: string, connectionId: string, page: { before: string | null; limit: number }, scope):
    Promise<readonly ChatMessageRow[] | 'cursor_not_found'>;
  countUnread(contactId: string, scope): Promise<number>;
  advanceLastRead(contactId: string, upToMessageId: string | null, scope): Promise<'ok' | 'message_not_found'>;
}
```

`scope: IntegracionesScope` al final de cada firma: entra en el barrido de la guardia de ámbito
sin exención.

### 5.2 `persistence/whatsapp-conversation-prisma.ts`

- Funciones con nombre que llevan el ámbito a `whatsappContactCompanyScope`,
  `whatsappMessageCompanyScope` o, en `$queryRaw`, a `companyScopeColumns(scope)`.
- **Hora** de un mensaje: `COALESCE(meta_timestamp, created_at)` (vocabulario). Orden del chat y del
  último mensaje: `(hora DESC, id DESC)`.
- `listPage`: un `$queryRaw` sobre `whatsapp_contacts c` con `c.company_id = $company`,
  `c.connection_id = $conn`, `c.customer_id = ANY($aliveIds)`, filtro de bloqueo
  (`blocked_at IS [NOT] NULL`), búsqueda `(c.customer_id = ANY($nameIds) OR c.wa_id LIKE '%' ||
  $digits || '%')`; `LATERAL` al último mensaje (`LIMIT 1`, que también exige que exista: P6);
  subconsulta de no leídos `direction = 'IN' AND hora > COALESCE(c.last_read_at, '-infinity')`;
  `ORDER BY last.hora DESC, c.id`; `OFFSET/LIMIT` de `toOffsetLimit`; `count(*)` con el mismo `WHERE`.
  `$digits` se escapa para `LIKE` (solo dígitos, pero se pasa como parámetro).
- `listMessages`: con `before`, primero comprueba que el mensaje es de ese contacto y empresa
  (si no, `'cursor_not_found'`); luego `WHERE (hora, id) < (SELECT hora, id FROM … WHERE id =
  $before)` en la misma sentencia, para no pasar la hora por JS.
- `advanceLastRead`: `UPDATE whatsapp_contacts SET last_read_at = GREATEST(last_read_at, (SELECT
  hora FROM whatsapp_messages WHERE …))` con ámbito; con `upToMessageId` la subconsulta exige
  `contact_id` y empresa (si no hay fila ⇒ `'message_not_found'` sin escribir); sin él toma el
  último mensaje del contacto; sin mensajes el `GREATEST` con `NULL` deja la marca igual (R18).
- `findLatestContactOfCustomer`: contacto de la conexión con ese `customer_id` y al menos un
  mensaje, por `last_message_at DESC NULLS LAST, id`.

### 5.3 `CustomerCatalog.findAliveIdsMatchingName` (en `clientes`)

```ts
/** De `ids`, los clientes vivos de la empresa que casan con `search` (misma regla que el listado). */
findAliveIdsMatchingName(search: string, ids: readonly string[], companyId: string): Promise<readonly string[]>;
```

Implementación en `customer-catalog-prisma.ts` con `searchCondition` (ya exportada de
`customer-prisma.ts`) + `deletedAt: null` + ámbito + `id IN ids`. Un texto sin palabras útiles
(solo símbolos) devuelve los `ids` vivos, igual que no buscar; el caso de uso no lo llama con
búsqueda vacía. Con un texto de solo dígitos (un teléfono) casi nunca casa por nombre, y el filtro
por dígitos del número lo cubre.
Se pone en el catálogo y no en `CustomerPhoneLinks` porque es búsqueda de clientes, que el catálogo
ya ofrece a otros módulos sin datos de contacto.

### 5.4 Composición

En el bloque de WhatsApp de `integraciones`, sin reordenar:

```ts
const whatsappConversationRepository: WhatsappConversationRepository = { /* funciones de 5.2 */ };
const whatsappConversationDeps = {
  connections: whatsappConnectionRepository, conversations: whatsappConversationRepository,
  customers: customerCatalog, people: peopleDirectory,
  templates: whatsappTemplateRepository, variableKeys: whatsappVariableKeyRepository,
};
// en `integraciones`:
listWhatsappConversations: createListWhatsappConversations(whatsappConversationDeps),
getWhatsappChat: createGetWhatsappChat(whatsappConversationDeps),
markWhatsappChatRead: createMarkWhatsappChatRead(whatsappConversationDeps),
listSendableWhatsappTemplates: createListSendableWhatsappTemplates(whatsappConversationDeps),
```

`buildCustomerCatalog` gana `findAliveIdsMatchingName`.

### 5.5 Server Actions (`adapters/driving/whatsapp-conversation-actions.ts`)

`'use server'`, mismo patrón que `whatsapp-message-actions.ts`: `currentActor()` dentro de
`runInRequestScope`, `toErrorState` de `createErrorStateTranslator(IntegracionesError, …)`. Copian la
vista campo a campo. Sin `revalidatePath` (no hay pantalla todavía). Se importan por su ruta exacta.

---

## Contrato para la pantalla (QC-246)

> Autocontenido, para copiar tal cual en la ficha de QC-246. **Versión 2, 2026-10-23 (Enmienda 1):**
> archivo de imágenes y stickers, reacciones por id interno, `getWhatsappChatContextAction` con pedidos
> y valores por defecto; revisada el mismo día con D12–D14 (pedidos abiertos, siete constantes).
> **[ABIERTO Pn]** = depende de una pregunta abierta del spec; vale su default.

### A. Acciones y ruta

Las acciones se importan por su **ruta exacta**; los tipos, desde `@/lib/modules/integraciones`.
`CONV` = `@/lib/modules/integraciones/adapters/driving/whatsapp-conversation-actions`;
`MSG` = `@/lib/modules/integraciones/adapters/driving/whatsapp-message-actions`.

| Qué | Dónde | Permiso | Origen |
|---|---|---|---|
| `listWhatsappConversationsAction` | `CONV` | `whatsapp.consultar` | nueva |
| `getWhatsappChatAction` | `CONV` | `whatsapp.consultar` | nueva |
| `markWhatsappChatReadAction` | `CONV` | `whatsapp.consultar` | nueva |
| `listSendableWhatsappTemplatesAction` | `CONV` | `whatsapp.consultar` | nueva |
| `getWhatsappChatContextAction` | `CONV` | `whatsapp.consultar` | nueva (v2) |
| `GET /api/integraciones/whatsapp/media/<messageId>` | la URL llega hecha en `attachment.mediaUrl` | `whatsapp.consultar` | nueva (v2) |
| `sendWhatsappMessageAction` | `MSG` | `whatsapp.enviar` | QC-240, ya en `dev` |
| `retryWhatsappMessageAction` | `MSG` | `whatsapp.enviar` | QC-240, ya en `dev` |

Los dos permisos son hoy solo del Administrador y desaparecen con el añadido «Integraciones» apagado.

```ts
type ErrorState = // de @/lib/modules/errores; message en español
  | { status: 'error'; code: ErrorCode; message: string }
  | { status: 'error'; code: 'unexpected'; message: string; reference: string };
type ActionResult<T> = { status: 'success'; data: T } | ErrorState;
type ChatTarget = { contactId: string } | { customerId: string }; // uuid

listWhatsappConversationsAction(input: {
  search?: string; // ≤ 100; '' o espacios = sin búsqueda
  blocked?: 'all' | 'blocked' | 'not_blocked'; // default 'all' [ABIERTO P7]
  page?: number; // ≥ 1, default 1
  pageSize?: number; // default 10, tope 25 [ABIERTO P12]
}): Promise<ActionResult<WhatsappConversationList>>;

getWhatsappChatAction(input: {
  target: ChatTarget;
  before?: string; // = nextCursor
  pageSize?: number; // default 30, tope 50 [ABIERTO P12]
}): Promise<ActionResult<WhatsappChat>>;

markWhatsappChatReadAction(input: {
  contactId: string;
  upToMessageId?: string; // último mostrado [ABIERTO P4]
}): Promise<ActionResult<{ unreadCount: number }>>;

listSendableWhatsappTemplatesAction(): Promise<ActionResult<{ templates: readonly WhatsappSendableTemplate[] }>>;

getWhatsappChatContextAction(input: {
  target: ChatTarget;
  orderId?: string; // el del selector; sin él, el abierto más reciente
}): Promise<ActionResult<WhatsappChatContext>>;

// ---- QC-240, sin cambios ----
sendWhatsappMessageAction(input:
  | { kind: 'text'; recipient: ChatTarget; text: string } // 1..4096, no solo espacios
  | { kind: 'template'; recipient: ChatTarget; templateId: string;
      constants?: Record<string, string>; // clave con punto → valor (de context.values)
      constantLabels?: Record<string, string> } // clave con punto → etiqueta
): Promise<WhatsappSendResult>;

retryWhatsappMessageAction(input: {
  messageId: string; // saliente FAILED de origen usuario
  constants?: Record<string, string>; constantLabels?: Record<string, string>; // plantillas
}): Promise<WhatsappSendResult>;

type WhatsappSendResult =
  | { status: 'success'; data: WhatsappOutboundMessageView } // también si Meta rechazó: data.status = 'FAILED'
  | { status: 'missing_values'; message: string; missing: readonly { key: string; label: string }[] }
  | ErrorState;
type WhatsappOutboundMessageView = {
  id: string; type: 'TEXT' | 'TEMPLATE'; status: 'SENT' | 'FAILED';
  body: string; // plantillas: texto final
  templateName: string | null; templateLanguage: string | null;
  errorCode: string | null; errorReason: string | null; // en español
  createdAt: string; // ISO 8601
};
```

Las variables **propias** no se mandan: el back pone su valor guardado. Una constante con valor
`null` en `context.values` no se manda y el envío responde `missing_values`. Reintentar un texto:
`{ messageId }`. Enviar a `{ customerId }` sin conversación crea el contacto; el chat siguiente se
pide ya por `contactId`.

**Ruta del archivo** (`GET`, misma sesión del navegador; se usa como `src` de `<img>`):

| Respuesta | Cuándo |
|---|---|
| `200`, cuerpo = la imagen, `Content-Type` `image/jpeg`, `image/png` o `image/webp`, `Cache-Control: private, max-age=3600` | Imagen o sticker entrante de un chat que el actor puede leer |
| `404` sin cuerpo | Sin sesión o sin `whatsapp.consultar`; id que no es un mensaje así de la empresa, cliente dado de baja, audio/video/documento |
| `502` sin cuerpo | Meta no lo sirve: caído, token, más de 5 MB, tipo no admitido, o medio caducado (Meta los borra a los ~30 días; no se guarda copia) |

### B. Tipos compartidos

```ts
type WhatsappConnectionStatus = 'ACTIVE' | 'PENDING' | 'ERROR' | 'DISABLED';
type WhatsappMessageDirection = 'IN' | 'OUT';
type WhatsappMessageType = 'TEXT' | 'IMAGE' | 'AUDIO' | 'VIDEO' | 'DOCUMENT' | 'STICKER' | 'LOCATION'
  | 'CONTACTS' | 'REACTION' | 'BUTTON' | 'INTERACTIVE' | 'TEMPLATE' | 'UNSUPPORTED';
type WhatsappMessageStatus = 'RECEIVED' | 'QUEUED' | 'SENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';

// ---- Listado ----
type WhatsappConversationList = {
  connectionStatus: WhatsappConnectionStatus | null; // null = sin WhatsApp conectado
  page: { items: readonly WhatsappConversationItem[]; total: number; page: number; pageSize: number; totalPages: number };
};
type WhatsappConversationItem = {
  contactId: string; customerId: string;
  customerName: string; // «Nombres Apellidos»
  phone: string; // «+52 1 55 1234 5678»
  isBlocked: boolean; unreadCount: number;
  lastMessage: {
    direction: WhatsappMessageDirection; type: WhatsappMessageType;
    preview: string | null; // cuerpo recortado a 120; null sin cuerpo
    status: WhatsappMessageStatus; at: string; // ISO 8601
  };
};

// ---- Chat ----
type WhatsappChat = {
  connectionStatus: WhatsappConnectionStatus | null;
  contact: { id: string; phone: string; isBlocked: boolean; unreadCount: number } | null; // null = chat vacío
  customer: { id: string; name: string };
  window: { open: true; closesAt: string } | { open: false; closesAt: null }; // última entrada + 24 h
  messages: readonly WhatsappChatMessage[]; // de más antiguo a más reciente
  hasMore: boolean;
  nextCursor: string | null; // = messages[0].id si hasMore
};
type WhatsappChatMessage = {
  id: string;
  direction: WhatsappMessageDirection; type: WhatsappMessageType;
  body: string | null; // texto, pie, emoji de reacción, título de botón…
  attachment: WhatsappChatAttachment | null;
  status: WhatsappMessageStatus; // entrantes: 'RECEIVED'
  errorReason: string | null; // solo FAILED, en español
  origin: 'USER' | 'SYSTEM' | null; // null en entrantes
  sentBy: { id: string; displayName: string | null } | null;
  templateName: string | null;
  at: string; // ISO 8601
};
type WhatsappChatAttachment =
  | { kind: 'media'; mimeType: string; filename: string | null; caption: string | null;
      mediaUrl: string | null } // v2: solo imagen/sticker entrante
  | { kind: 'location'; latitude: number; longitude: number; name: string | null; address: string | null }
  | { kind: 'reaction'; emoji: string | null; // null = reacción quitada
      messageId: string | null }; // v2: `id` del mensaje reaccionado; null si no está guardado

// ---- Plantillas enviables ----
type WhatsappSendableTemplate = {
  id: string; // = templateId del envío
  name: string; language: string; // 'es_MX'
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  content: { // huecos como {{clave}}
    header: { text: string; example: string | null } | null;
    body: { text: string; examples: readonly string[] };
    footer: string | null;
    buttons: readonly ({ type: 'QUICK_REPLY'; text: string }
      | { type: 'URL'; text: string; url: string; example: string | null }
      | { type: 'PHONE_NUMBER'; text: string; phoneNumber: string })[];
  };
  variables: readonly {
    slot: string; position: number; // 'header', 'body.1', 'button.0'…
    kind: 'system' | 'company'; // constante | propia
    key: string; // 'cliente.nombre' o clave propia
    label: string | null; // solo propias
    value: string | null; // solo propias, valor vigente [ABIERTO P9]
  }[];
};

// ---- Contexto del chat (v2) ----
type WhatsappChatContext = {
  customer: { id: string; name: string };
  orders: readonly WhatsappCustomerOrder[]; // abiertos (ni entregados ni cancelados), ≤ 20, el más reciente primero
  selectedOrderId: string | null; // orderId pedido, o orders[0]; null sin pedidos abiertos
  values: Readonly<Record<string, string | null>>; // clave → texto; null = falta
};
type WhatsappCustomerOrder = {
  id: string;
  number: string; // '2026-0000128'
  status: 'PENDIENTE' | 'EN_CURSO' | 'POR_EMPACAR' | 'EN_EMPAQUE' | 'BLOQUEADO'
    | 'POR_ACONDICIONAR' | 'EN_ACONDICIONAMIENTO' | 'TERMINADO';
  requestedAt: string; // ISO 8601
  total: string | null; // decimal en texto; hoy siempre null (QC-307)
  productName: string | null; // producto (receta)
  lines: readonly {
    presentationId: string;
    presentationName: string | null; // «Bidón 20 L»
    ordered: number; // envases → «10 × Bidón 20 L»
    delivered: number;
    pending: number; // max(0, ordered − delivered)
  }[];
};
```

### C. Errores por acción

El texto en español llega en `message`: mostrarlo tal cual. Toda acción puede dar además
`unexpected` (con `reference`). `ctx` = `getWhatsappChatContextAction`.

| Código | list | chat | read | tpl | ctx | send | retry |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| `unauthorized` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `invalid_input` | ✓ | ✓ | ✓ | | ✓ | ✓ | ✓ |
| `whatsapp_contact_not_found` | | ✓ | ✓ | | ✓ | ✓ | ✓ |
| `customer_not_found` | | ✓ | | | ✓ | ✓ | |
| `order_not_found` (v2) | | | | | ✓ | | |
| `whatsapp_message_not_found` | | ✓ (cursor) | ✓ | | | | ✓ |
| `whatsapp_connection_not_found`, `whatsapp_connection_not_active`, `integration_secret_unreadable`, `whatsapp_recipient_not_customer`, `whatsapp_contact_blocked`, `whatsapp_window_closed`, `whatsapp_template_not_found`, `whatsapp_template_not_sendable` | | | | | | ✓ | ✓ |
| `whatsapp_customer_without_phone`, `whatsapp_contact_linked_elsewhere` | | | | | | ✓ | |
| `whatsapp_message_not_retryable` | | | | | | | ✓ |
| `missing_values` (rama propia: «Falta el valor de A, B y C») | | | | | | ✓ | ✓ |

Sin WhatsApp conectado, `list`, `chat` por cliente, `tpl` y `ctx` por cliente **no** dan error
(`connectionStatus: null` y vacío donde aplica); `chat` y `ctx` por contacto dan
`whatsapp_contact_not_found`. Si Meta rechaza un envío **no** es error: `success` con
`data.status = 'FAILED'` y `data.errorReason` en español.

### D. Semántica

**Listado.** Solo conversaciones: contacto de la conexión actual, vinculado a un cliente vivo y con
al menos un mensaje [ABIERTO P6]; números sin cliente y clientes dados de baja no salen [ABIERTO P11].
Orden por hora del último mensaje, el más reciente primero. La búsqueda casa por nombre del cliente
(sin acentos ni mayúsculas) **o** por los dígitos del número. Paginado por número de página: en la
consulta periódica, recargar la página 1.

**Chat.** Sin `before`: los `pageSize` más recientes, de más antiguo a más reciente; los anteriores
con `before = nextCursor` mientras `hasMore`. Lo nuevo: volver a pedir sin `before` y unir por `id`.
Por `customerId`: la conversación de último mensaje más reciente [ABIERTO P5] o chat vacío con
ventana cerrada. Leer **no** marca leído [ABIERTO P3].

**No leídos.** Una marca por conversación, compartida por la empresa. `unreadCount` = entrantes
posteriores a la marca (las reacciones cuentan [ABIERTO P13]). `markWhatsappChatReadAction` mueve la
marca hasta `upToMessageId` (el último mostrado) o, sin él, hasta el último; nunca retrocede.
Llamarla al abrir el chat y tras cada consulta que traiga entrantes. No avisa a Meta.

**Imágenes y stickers (v2).** `attachment.mediaUrl` (relativa) va como `src` de la miniatura y del
visor. Se descarga de Meta en cada vista, sin copia: a los ~30 días Meta la borra y la ruta da 502;
la pantalla muestra «Imagen no disponible» (evento `error`). Audio, video y documento: `mediaUrl: null`.

**Reacciones (v2).** `attachment.messageId` es el `id` del mensaje reaccionado en `messages`. La
reacción llega como mensaje propio (cuenta como no leído): no se pinta como burbuja, se pega a ese
mensaje (si aún no está cargado, al cargarlo). Del mismo lado al mismo mensaje vale la más reciente;
`emoji: null` la quita; `messageId: null` (no guardado) no se pinta.

**Contexto del chat (v2).** Pedirlo al abrir el chat y al cambiar el selector «Pedido»
(`orderId`), no en la consulta periódica.
- `orders`: solo los abiertos, para el selector (se muestra si hay más de uno) y el detalle, ya con
  sus líneas: no hay otra llamada. `pending` y `delivered` coinciden con Pedidos. `total` hoy es
  siempre `null` (QC-307): ocultarlo. No hay fecha de entrega. Sin pedidos abiertos: `orders: []`.
- `values` trae **siempre** estas siete constantes, más cada variable propia por su clave (sin
  punto: nunca choca). Las `pedido.*` salen del pedido elegido y son todas `null` sin él:

  | Clave | Ejemplo |
  |---|---|
  | `cliente.nombre` | «Laura Gómez» |
  | `empresa.nombre` | «Agua Pura» |
  | `pedido.numero` | «2026-0000128» |
  | `pedido.estado` | `recibido`, `en preparación`, `entregado` o `cancelado` [ABIERTO P20] |
  | `pedido.fecha_solicitud` | «23/10/2026» [ABIERTO P21] |
  | `pedido.total` | siempre `null` (QC-307) |
  | `pedido.detalle` | «10 × Bidón 20 L (entregado 6, faltan 4); 5 × Garrafa 5 L (entregado 5, faltan 0)»: una línea de texto, sin saltos |

  Para resolver una plantilla: `values[variable.key]`; si es `null` o no está, el texto muestra
  `[falta <clave>]`. Al enviar, `constants` = las constantes de la plantilla con valor no nulo, y
  `constantLabels` de su catálogo de etiquetas.
- **Seguimiento de front:** el catálogo de constantes de QC-243 (y su traducción
  `nombre_del_cliente` ↔ `cliente.nombre`) aún no tiene las cuatro `pedido.*` nuevas; hasta
  añadirlas, ninguna plantilla las usa.
- `orderId` que no está en `orders` (también entregado o cancelado) ⇒ `order_not_found`.

---

## 6. Contrato del módulo (`index.ts`)

Se suman `createListWhatsappConversations`, `createGetWhatsappChat`, `createMarkWhatsappChatRead`,
`createListSendableWhatsappTemplates` y los tipos del §B. `module-shape.test.ts` se tensa (§10.2).
La Enmienda 1 suma `createGetWhatsappChatContext`, `createGetWhatsappMedia`,
`WhatsappOrderNotFoundError` y los tipos del contexto (§15).

---

## 7. Logs (R41)

Ningún `console.*` en el dominio ni en el adaptador. Las acciones solo registran lo que ya hace
`toErrorState` con el `diagnostic` de un error inesperado. Ningún error nuevo lleva cuerpo, número ni
nombre en su `diagnostic`.

---

## 8. Errores

**Ningún código nuevo.** Se reutilizan `unauthorized`, `invalid_input`, `whatsapp_contact_not_found`,
`customer_not_found` (vía `LinkedCustomerNotFoundError`) y `whatsapp_message_not_found`. El catálogo
y su guardia no cambian. La Enmienda 1 añade una **clase** con un código que ya existe
(`WhatsappOrderNotFoundError`, `order_not_found`, §15.3), como `LinkedCustomerNotFoundError`.

---

## 9. Concurrencia y límites conocidos

- **Paginación por offset en el listado.** Si llega un mensaje entre dos páginas, una conversación
  puede repetirse o saltarse. Se acepta: la pantalla recarga la página 1 en cada consulta periódica.
- **Marcar leído sin `upToMessageId`** puede dar por leído un entrante que llegó entre leer y marcar;
  por eso el contrato pide pasar el último mostrado (P4).
- **Dos usuarios marcando a la vez**: `GREATEST` en una sola sentencia; gana la marca más reciente.
- **Coste del listado**: lee todos los ids de clientes vinculados de la conexión y los pasa al
  catálogo. Con el volumen previsto (pocas empresas, cientos de conversaciones) es una consulta
  barata; si creciera, ver §12 alternativa 2.

---

## 10. Tests

Mapa `R<n> → test` completo en `tasks.md`.

### 10.1 Nuevos

| Archivo | Cubre |
|---|---|
| `tests/unit/integraciones/whatsapp/conversations/whatsapp-conversation.test.ts` | R8 (120 puntos de código, emoji), R25 (cada tipo; sin `media_id`; payload que no casa), R26 (tabla por código, sin código, no numérico), R28 (abierta, 24 h exactas, sin `lastInboundAt`) |
| `tests/unit/integraciones/whatsapp/conversations/whatsapp-conversation-input.test.ts` | R10 (100 caracteres), R12/R31 (acotar tamaño), entradas inválidas |
| `tests/unit/integraciones/whatsapp/conversations/list-whatsapp-conversations.test.ts` | R4, R6, R7, R10, R11, R13 con puertos dobles; ningún puerto antes del permiso |
| `tests/unit/integraciones/whatsapp/conversations/get-whatsapp-chat.test.ts` | R4, R21–R24, R27–R31 |
| `tests/unit/integraciones/whatsapp/conversations/mark-whatsapp-chat-read.test.ts` | R4, R17, R19, R20 |
| `tests/unit/integraciones/whatsapp/conversations/list-sendable-whatsapp-templates.test.ts` | R4, R32, R33 |
| `tests/unit/integraciones/whatsapp/conversations/whatsapp-conversation-actions.test.ts` | R40 (forma `success`/`ErrorState`, copia campo a campo), R41 (sin cuerpo, número ni nombre en logs) |
| `tests/integration/integraciones/whatsapp-conversation-prisma.int.test.ts` | Adaptador: R9 (orden y empate), R10 (nombre o dígitos), R11, R12, R15 (microsegundos, sin marca), R16, R18 (no retrocede; sin mensajes), R22/R23 (cursor, empate de hora), R39 (otra empresa / otra conexión) |
| `tests/integration/integraciones/whatsapp-conversations-flow.int.test.ts` | Composición real + doble de Graph: R5, R6, R14, R16 (no leídos en 0), R34, R35 (plantilla no enviable y constante faltante sin llamar a Meta), R36–R38 (baja del cliente: oculto, no se escribe, mensajes intactos, el número vuelve a escribir y queda sin cliente), R39 |
| `tests/integration/clientes/customer-catalog.int.test.ts` (se amplía) | `findAliveIdsMatchingName`: solo vivos, solo de los ids, ámbito, normalización |
| `tests/unit/identity/schema/whatsapp-read-permission-migration.test.ts` | R1, R2: literales de la migración = constantes de la app |
| `tests/integration/identity/whatsapp-read-permission-migration.int.test.ts` | R2: idempotente; revertir quita solo esas filas; solo el Administrador |
| `tests/integration/integraciones/whatsapp-contacts-last-read-migration.int.test.ts` | R42: down y up dejan el mismo esquema |

### 10.2 Tests y guardias que se tensan (nunca se relajan)

| Archivo | Cambio |
|---|---|
| `tests/unit/identity/permissions.test.ts` | + `whatsapp.consultar`; Administrador la tiene, ningún otro rol (R1, D1) |
| `tests/unit/identity/addons/company-addons.test.ts` | + en `integraciones` (R3) |
| `tests/integration/identity/identity-seed.int.test.ts` | seed del Administrador con el permiso |
| `tests/unit/integraciones/module-shape.test.ts` | lista de archivos, contrato, cableado, importadores; `whatsapp-conversation-actions.ts` exporta exactamente las cuatro acciones (R34: ninguna de envío) |
| `tests/guards/guard-ambito-empresa-integraciones.test.ts` | + puerto `WhatsappConversationRepository` (7 métodos) en el barrido |
| `tests/unit/clientes/customer-catalog.test.ts` | contrato del catálogo con el método nuevo |
| `tests/unit/integraciones/whatsapp/send/whatsapp-send-failure.test.ts` | `sendFailureReasonOf` exportada da los mismos textos |
| `tests/unit/integraciones/whatsapp/whatsapp-doubles.ts` | + doble de `WhatsappConversationRepository` |
| `tests/integration/aislamiento.json` | entradas de los `.int.test.ts` nuevos |

---

## 11. Fronteras con otras fichas y choques previsibles

- **QC-246** (pantalla): consume el §«Contrato para la pantalla»; cambia el permiso de la página y
  del menú a `whatsapp.consultar` y trae el E2E.
- **QC-240**: no se modifica salvo exportar `sendFailureReasonOf`.
- **QC-241** (envíos del sistema): sus mensajes `origin = SYSTEM` aparecen en el chat con `sentBy:
  null`.
- **Front de plantillas (seguimiento de D13, no se especifica aquí).** El catálogo de constantes
  del front de QC-243 (`design.md > 5`) y su traducción de clave visible a clave con punto
  (`nombre_del_cliente` ↔ `cliente.nombre`) solo conocen `cliente.nombre`, `empresa.nombre` y
  `pedido.numero`. Para que una plantilla pueda usar `pedido.estado`, `pedido.fecha_solicitud`,
  `pedido.total` y `pedido.detalle`, el front tiene que aprender esas cuatro (clave visible,
  etiqueta, descripción y ejemplo). Hasta entonces el back las devuelve y ninguna plantilla las usa.
  **Nota para el leader:** anotarlo en la ficha de QC-246 si esa pantalla toca el catálogo de
  constantes; si no, abrir una ficha nueva de front. Lo decide el humano.

| Archivo | Con quién | Cómo se resuelve |
|---|---|---|
| `db/schema.prisma`, `db/migrations/` | Fichas con esquema en vuelo (QC-131, QC-279 del mismo autor; otras según `archivos-en-vuelo`) | Una línea en `WhatsappContact`; timestamps re-fechados en F2.3 |
| `lib/modules/identity/domain/permissions.ts`, `company-addons.ts` | Fichas que añadan permisos | Una entrada más |
| `lib/modules/clientes/domain/customer-catalog.ts` y su adaptador | Fichas de `clientes` (QC-302, QC-303) | Un método más al final |
| `lib/composition/index.ts` | Todas las fichas con cableado | Solo el bloque de WhatsApp y `buildCustomerCatalog` |
| `lib/modules/integraciones/**`, `module-shape.test.ts`, guardia de ámbito | QC-241 (mismo módulo) | La que llegue después amplía las listas exactas |
| `lib/modules/pedidos/index.ts` (Enmienda 1) | QC-307 (`in_progress`, precio de venta) | Solo tres líneas de barril (con `ORDER_STATUSES_NOT_IN_PROGRESS`); el adaptador va en archivo nuevo. Cuando QC-307 entre, una ficha de seguimiento rellena `total` y `pedido.total` (D11) |
| `lib/modules/identity/index.ts` (Enmienda 1) | Fichas de `identity` | Una línea de barril |
| `tests/guards/guard-rutas-fuera-de-sesion.test.ts`, `session-once-per-request-actions.test.ts` (Enmienda 1) | Cualquier ficha con rutas o acciones nuevas | Una entrada más |

---

## 12. Alternativas descartadas

1. **Crear acciones propias «enviar texto», «enviar plantilla» y «reintentar»** que envuelvan a las
   de QC-240, como pide la ficha al pie de la letra. Duplicaría el contrato y la validación sin
   cambiar el comportamiento; QC-240 ya los entrega para esta pantalla (P1).
2. **`JOIN` a `customers` en SQL** desde el adaptador de `integraciones` para filtrar por vivos y
   buscar por nombre en una sola consulta. Es leer la tabla de otro módulo
   (`docs/architecture.md > Anti-patrones`); se usa el catálogo de `clientes`, como `pedidos`.
3. **Desvincular los contactos al dar de baja un cliente** (`customer_id = NULL`). Ocultaría el chat
   sin filtrar en la lectura, pero obliga a `clientes` a llamar a `integraciones` (flecha de vuelta
   prohibida) y pierde a qué cliente pertenecía la conversación (D5: conservar el historial).
4. **Marca de lectura por usuario** (tabla `contacto × usuario`). Descartada por D3.
5. **Índice de expresión sobre la hora del mensaje** en esta ficha. Prisma no lo modela y el volumen
   no lo pide; el índice existente ya acota por contacto (§2.1).
6. **Cursor con la hora** (ISO) en lugar del id del mensaje. Un `Date` de JS pierde los microsegundos
   de `timestamptz(6)` y dos mensajes en el mismo milisegundo se saltarían; el id resuelve la hora en
   la base.
7. **Marcar leído al leer el chat.** Una lectura con escritura, repetida por la consulta periódica, y
   un entrante que llega entre dos lecturas quedaría leído sin verse (P3, P4).
8. **Reutilizar `listWhatsappTemplatesAction({ onlyApproved: true })`.** Exige
   `integraciones.modificar` y devuelve plantillas deshabilitadas o sin relacionar que el envío
   rechazaría.

Descartadas en la Enmienda 1:

9. **Exponer `wamid` en cada mensaje del chat** para que la pantalla case la reacción. Mete un
   identificador de Meta en el contrato de la pantalla, la obliga a llevar dos ids por mensaje y a
   casar ella; el back ya tiene el índice único por `wamid` y lo casa en la misma consulta (R49).
10. **Copiar el medio a Storage** al recibirlo o en la primera vista. Sobrevive a la caducidad de Meta,
    pero exige un bucket nuevo, su RLS, una columna con la ruta, purga y custodia de imágenes de
    clientes. El humano lo descartó (D9).
11. **Server Action que devuelve el archivo en base64.** Un `<img>` necesita una URL; un data URL de
    hasta 5 MB viaja en el payload de React, no se cachea y engorda cada mensaje. La ruta `GET`
    sirve bytes con la cookie de sesión y la caché privada del navegador.
12. **La ruta del archivo bajo `app/(private)/clientes/contactos/`.** El middleware le daría sesión,
    pero sin sesión responde un 307 a `/login` en HTML a una petición de imagen, y mete un archivo
    de backend en el árbol de la pantalla de QC-246. En `app/api/` el caso de uso decide y la ruta
    responde 404 limpio.
13. **Pedir la URL del medio con el `media_id`** (`/media/<mediaId>`). Expone el id de Meta y obliga a
    buscar el mensaje por un campo JSON; con el id interno la propiedad del mensaje se comprueba
    por la clave primaria.
14. **Valores y pedidos dentro de `getWhatsappChat`.** El chat se consulta cada 5–10 s; recalcular
    pedidos, envases y nombre de la empresa en cada consulta multiplica lecturas a tres módulos sin
    que cambien. Va en una acción aparte que la pantalla pide al abrir y al cambiar de pedido.
15. **Detalle del pedido en una segunda llamada** (lista ligera + `getOrderDetail`). Con como mucho
    20 pedidos y unas pocas líneas por pedido (un producto por pedido, una línea por presentación),
    la respuesta es pequeña; una sola llamada deja el panel abrirse sin espera y sin un segundo
    camino de autorización.
16. **Añadir `listAliveOfCustomer` a `OrderCatalog`.** Ese puerto lo implementan a mano unas 35
    dobles de test (`: OrderCatalog`); un método obligatorio más las rompe todas. Un servicio
    estrecho propio (`CustomerOrderDirectory`) no toca a nadie.
17. **Leer el nombre de la empresa con `createGetCompany`** (ficha del maestro). Es una pantalla de
    plataforma con su permiso y devuelve la ficha entera; aquí basta un campo de la propia empresa,
    como `getCompanyCountry`.

Descartadas al aplicar D12–D14:

18. **Las líneas como dato estructurado dentro de `values`** (`pedido.lineas: [{ presentacion,
    pedido, entregado, faltante }]`). `values` deja de ser `Record<string, string | null>` y no se
    puede pasar a `constants` del envío (QC-240 solo acepta texto), ni insertar en un hueco `{{n}}`
    de Meta. Ese dato estructurado ya va en `orders[].lines` del mismo contexto (D8), que es lo que
    pinta el panel. Se elige un valor de texto listo, `pedido.detalle` (R62).
19. **Reutilizar `ORDER_STATUS_LABELS` para `pedido.estado`.** Son diez etiquetas del taller
    («En fabricación», «Por empacar», «Bloqueado»); el humano pidió cuatro en lenguaje del cliente, y
    `lib/shared/ui` no se importa desde el dominio.

---

## 13. Dependencias de terceros

**Ninguna.** `zod` y `libphonenumber-js` (vía `formatPhoneInternational` de `clientes`) ya están.
`package.json` no cambia.

## 14. Variables de entorno

Ninguna nueva (la descarga usa `WHATSAPP_GRAPH_API_VERSION`, que ya existe).

---

## 15. Enmienda 1 (2026-10-23): archivo de medios, reacciones y contexto del chat

R44–R59, D6–D11. Pedida por el humano («actualiza el spec y el contrato») tras ampliar QC-246.
Ninguna tarea hecha cambia de comportamiento: al enmendar, T1 estaba a medias sin commit y T2–T9
sin empezar. Las tareas T10–T17 de `tasks.md` añaden lo de aquí; las que tocan lo que producen
T4, T5 y T7 dependen de ellas.

### 15.0 Qué cambia

```
app/api/integraciones/whatsapp/media/[mensajeId]/route.ts         ← reexport de GET + runtime nodejs
lib/modules/identity/
  domain/get-company-name.ts                                     ← createGetCompanyName
  ports/company-name-reader.ts                                   ← findNameOf(companyId)
  adapters/driven/persistence/company-name-prisma.ts             ← su lectura
  index.ts                                                       ← + createGetCompanyName
lib/modules/pedidos/
  domain/customer-order-directory.ts                             ← interfaz + CustomerOrderSummary
  adapters/driven/persistence/customer-order-directory-prisma.ts ← listAliveOfCustomer
  index.ts                                                       ← + tipos, ORDER_STATUSES_NOT_IN_PROGRESS (D12)
lib/modules/integraciones/
  domain/whatsapp-media.ts                                       ← constantes y reglas puras del archivo
  domain/get-whatsapp-media.ts                                   ← caso de uso del archivo
  domain/whatsapp-chat-context.ts                                ← tipos y armado puro del contexto (+ §15.8)
  domain/get-whatsapp-chat-context.ts                            ← caso de uso del contexto
  domain/whatsapp-conversation.ts                                ← attachmentOf: mediaUrl, reacción por id interno
  domain/whatsapp-conversation-input.ts                          ← + getWhatsappChatContextSchema, getWhatsappMediaSchema
  domain/errors.ts                                               ← + WhatsappOrderNotFoundError
  ports/whatsapp-conversation-repository.ts                      ← + findMediaMessage; ChatMessageRow.reactedMessageId
  ports/whatsapp-graph-client.ts                                 ← + downloadMedia
  ports/company-name-lookup.ts                                   ← (companyId) => Promise<string | null>
  adapters/driven/persistence/whatsapp-conversation-prisma.ts    ← reacción en SQL, findMediaMessage
  adapters/driven/graph/whatsapp-graph-client-fetch.ts           ← downloadMedia
  adapters/driven/graph/whatsapp-graph-client-canned.ts          ← downloadMedia (PNG fijo)
  adapters/driving/whatsapp-conversation-actions.ts              ← + getWhatsappChatContextAction
  adapters/driving/whatsapp-media-route.ts                       ← GET
  index.ts                                                       ← + fábricas, tipos, error
lib/composition/index.ts                                         ← cableado
```

Sin migraciones ni RLS nuevas: no hay tabla ni columna nueva (D9: nada se guarda).

### 15.1 Archivo de un medio (R44–R48, R58)

**Ruta.** `app/api/integraciones/whatsapp/media/[mensajeId]/route.ts`:
`export { GET } from '@/lib/modules/integraciones/adapters/driving/whatsapp-media-route'` y
`export const runtime = 'nodejs'`, como el webhook. Una ruta y no una Server Action: la consume un
`<img src>` (alternativa 11). `/api/**` no pasa por el middleware, así que la ruta lee la sesión ella
misma, con el mismo `currentActor()` de las acciones (`runInRequestScope` + `getSessionUser` +
`getSessionContext`). Como el permiso viene de la sesión, el añadido apagado ya lo quita (R3).

**`whatsapp-media-route.ts` (driving)** solo traduce:

| Resultado del caso de uso | Respuesta |
|---|---|
| `{ kind: 'file', contentType, body, contentLength }` | `200`; `Content-Type`; `Content-Length` si se conoce; `Cache-Control: private, max-age=3600`; `X-Content-Type-Options: nosniff`; `Content-Disposition: inline`; cuerpo = el stream |
| `UnauthorizedError`, `ValidationError`, `WhatsappMessageNotFoundError` | `404` sin cuerpo (404 y no 403: `docs/architecture.md`, «no existe» y «no puedes» indistinguibles) |
| `{ kind: 'unavailable' }` | `502` sin cuerpo |
| cualquier otra excepción | `500` sin cuerpo; se registra solo el `diagnostic` sin id de archivo (R58) |

**Caso de uso `getWhatsappMedia(input, actor)`** (`domain/get-whatsapp-media.ts`):

1. `requireReadPermission(actor)` (R44).
2. `getWhatsappMediaSchema = z.object({ messageId: z.uuid() }).strict()`; fallo ⇒ `ValidationError`.
3. `connections.findLive(scope)`; `null` ⇒ `WhatsappMessageNotFoundError`.
4. `conversations.findMediaMessage(messageId, connection.id, scope)` ⇒
   `{ direction, type, payload, customerId } | null`. `null`, `direction !== 'IN'`, tipo fuera de
   `VIEWABLE_MEDIA_TYPES = ['IMAGE', 'STICKER']`, `customerId === null`,
   `customers.findAliveRefById` nulo o `mediaIdOf(payload)` nulo ⇒ `WhatsappMessageNotFoundError`.
   Nada de esto llama a Meta.
5. `accessToken = decryptStoredSecret(deps, connection, ACCESS_TOKEN_FIELD, scope)`;
   `SecretUnreadableError` ⇒ `{ kind: 'unavailable' }` (como al enviar, la conexión queda en
   `ERROR`; esa es la única escritura posible).
6. `graph.downloadMedia({ mediaId, accessToken, maxBytes: WHATSAPP_MEDIA_MAX_BYTES })`; fallo ⇒
   `unavailable`. Tipo fuera de `WHATSAPP_MEDIA_CONTENT_TYPES` ⇒ `unavailable` (R46).

`domain/whatsapp-media.ts` (puro): `WHATSAPP_MEDIA_PATH = '/api/integraciones/whatsapp/media'`,
`mediaUrlOf(messageId)`, `VIEWABLE_MEDIA_TYPES`, `WHATSAPP_MEDIA_MAX_BYTES = 5 * 1024 * 1024`,
`WHATSAPP_MEDIA_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp']`, `mediaIdOf(payload)`
(zod `{ media_id: z.string().min(1) }`), `isViewableMedia(direction, type, payload)`.

**Puerto `WhatsappGraphClient.downloadMedia`:**

```ts
export type GraphMediaDownload =
  | { readonly ok: true; readonly contentType: string; readonly contentLength: number | null;
      readonly body: ReadableStream<Uint8Array> }
  | ({ readonly ok: false } & GraphFailure);
downloadMedia(input: { readonly mediaId: string; readonly accessToken: string; readonly maxBytes: number }):
  Promise<GraphMediaDownload>;
```

**`whatsapp-graph-client-fetch.ts`:** dos pasos, el token siempre en cabecera y nunca en un log:

1. `GET {GRAPH_BASE_URL}/{version}/{mediaId}` ⇒ zod `{ url: z.string().url(), mime_type: z.string(),
   file_size: z.number().int().optional() }`. 5xx o red ⇒ `unreachable`; otro no-2xx ⇒ `rejected`
   (incluye el medio caducado). `file_size > maxBytes` ⇒ `rejected` sin descargar.
2. La URL tiene que ser `https:` y su host terminar en `.fbsbx.com` (donde Meta sirve los
   medios); si no, `rejected` y **no** se manda el token a ese host. `GET url` con el token, el mismo
   `AbortSignal.timeout(GRAPH_TIMEOUT_MS)`. No-2xx ⇒ `rejected`; `Content-Length > maxBytes` ⇒
   `rejected`. El cuerpo se devuelve como stream detrás de un `TransformStream` que corta con error
   si pasa de `maxBytes` (defensa si la cabecera miente). `contentType` = la cabecera de la
   respuesta sin parámetros, o `mime_type` si falta.

**`whatsapp-graph-client-canned.ts`** (dobles de E2E): devuelve siempre el mismo PNG de 1×1, para
que QC-246 pinte miniaturas sin Meta.

**Adjunto (R48).** `attachmentOf(message)` pasa a recibir el mensaje entero (dirección, tipo,
`payload`, `id`, `reactedMessageId`) y pone `mediaUrl = isViewableMedia(...) ? mediaUrlOf(id) : null`.
Sigue sin devolver `media_id` (R25, R47).

**Puerto de conversaciones.** `findMediaMessage(messageId, connectionId, scope)`: el mensaje por
clave primaria con `company_id` y `connection_id` del ámbito, y el `customer_id` de su contacto.
Es el octavo método: entra en el barrido de la guardia de ámbito sin exención.

### 15.2 Reacciones (R49)

`listMessages` añade `reactedMessageId` a cada `ChatMessageRow`:

```sql
LEFT JOIN whatsapp_messages r
  ON m.type = 'REACTION'
 AND r.wamid = m.payload->>'message_id'
 AND r.contact_id = m.contact_id
 AND r.company_id = m.company_id
```

Usa el único `whatsapp_messages_wamid_key`. Una reacción a un mensaje de otro contacto o no
guardado da `null`. `attachmentOf` devuelve `{ kind: 'reaction', emoji, messageId: reactedMessageId }`.
El `wamid` no sale del adaptador (alternativa 9).

### 15.3 Contexto del chat (R50–R57)

**Entrada** (`whatsapp-conversation-input.ts`):

```ts
export const CUSTOMER_ORDERS_LIMIT = 20;   // D12
export const getWhatsappChatContextSchema = z.object({
  target: z.union([z.object({ contactId: z.uuid() }).strict(), z.object({ customerId: z.uuid() }).strict()]),
  orderId: z.uuid().optional(),
}).strict();
```

**Caso de uso `getWhatsappChatContext(input, actor)`** (`domain/get-whatsapp-chat-context.ts`):

1. `requireReadPermission`; parseo (`ValidationError`).
2. Cliente: por contacto, las comprobaciones de §4.4 paso 2 (sin conexión ⇒
   `WhatsappContactNotFoundError`); por cliente, `customers.findAliveRefById` nulo ⇒
   `LinkedCustomerNotFoundError`, sin mirar la conexión. Se extrae a una función compartida con
   `getWhatsappChat` (`resolveChatCustomer`) para que las dos reglas no diverjan.
3. `orders = customerOrders.listAliveOfCustomer(companyId, customerId,
   ORDER_STATUSES_NOT_IN_PROGRESS, CUSTOMER_ORDERS_LIMIT)`: solo abiertos (D12, §15.8).
4. Pedido elegido: con `orderId`, el de `orders` con ese id, o `WhatsappOrderNotFoundError`
   (`order_not_found`); sin él, `orders[0] ?? null` (R54).
5. Con pedidos: `deliveryProgress.listDeliveryProgressByIdsIncludingDeleted(companyId, ids)`,
   `presentations.findRefs(idsÚnicos, companyId)` y `recipes.findRefsIncludingDeleted(idsÚnicos,
   companyId)`: tres lecturas por lote, ninguna por pedido.
6. `companyName(companyId)` y `variableKeys.listAll(scope)`.
7. Arma con las funciones puras y **no escribe nada** (R57).

**Dominio puro** (`domain/whatsapp-chat-context.ts`): tipos del §B del contrato y

- `WHATSAPP_SYSTEM_CONSTANT_KEYS` (las siete claves de D13, §15.8).
- `customerOrderOf(summary, progress, presentations, recipes)`: `number = formatOrderNumber`,
  `requestedAt = createdAt` ISO, `total: null` (D11, sin campo de fecha de entrega: D10),
  `productName` = `RecipeRef.name` o `null`; por línea de `progress`, en su orden: `ordered =
  orderedPackages(line)`, `delivered = line.deliveredPackages`, `pending = remainingPackages({
  orderedPackages: ordered, deliveredPackages: delivered })` (R52, mismas funciones que Pedidos),
  `presentationName` = `PresentationRef.name` o `null`. Un pedido sin progreso sale con `lines: []`.
- `contextValuesOf({ customer, companyName, selected, variables })`: `cliente.nombre` =
  `customerNameOf(customer)`; `empresa.nombre` = `companyName`; las claves `pedido.*` del elegido
  (§15.8) o todas `null` sin elegido; cada propia `key → value`. Una cadena vacía se normaliza a
  `null` (R56).

**Pedidos del cliente (`pedidos`, §15.4)** e **identidad de la empresa (§15.5)** llegan por contrato;
`integraciones` no lee `orders` ni `companies` (alternativa 2 de §12, mismo criterio).

**Error.** `WhatsappOrderNotFoundError extends IntegracionesError`, `code = 'order_not_found'`
(código ya en el catálogo: «El pedido solicitado no existe.»).

**Grafo de módulos.** `integraciones` gana aristas a `pedidos`, `inventario` y `recetas` (solo
tipos de sus contratos). Ninguno de los tres importa `integraciones` ni `documentos`
(que sí importa `integraciones`): no se cierra ningún ciclo (`guard-arquitectura-modulos`, bloque 15).

### 15.4 `pedidos`: `CustomerOrderDirectory`

```ts
// domain/customer-order-directory.ts
export type CustomerOrderSummary = {
  readonly id: string; readonly number: OrderNumber; readonly status: OrderStatus;
  readonly recipeId: string; readonly createdAt: Date;
};
export interface CustomerOrderDirectory {
  /** Pedidos vivos de ese cliente en esa empresa, sin los de `excludedStatuses`, los `limit` de
   *  `created_at` más reciente (desempate `id` DESC). Cliente inexistente o de otra empresa ⇒ []. */
  listAliveOfCustomer(companyId: string, customerId: string,
    excludedStatuses: readonly OrderStatus[], limit: number): Promise<readonly CustomerOrderSummary[]>;
}
```

Adaptador en un archivo nuevo (`customer-order-directory-prisma.ts`, `where: { companyId,
customerId, deletedAt: null, status: { notIn } }`, índice `orders_company_id_customer_id_idx`) para
no chocar con QC-307 en `order-catalog-prisma.ts`. Servicio aparte y no método de `OrderCatalog`:
alternativa 16. El barril exporta la interfaz y el tipo; la composición la instancia.

### 15.5 `identity`: `getCompanyName`

Copia de `getCompanyCountry`: `createGetCompanyName({ companies: Pick<CompanyNameReader,
'findNameOf'> })` ⇒ `(companyId) => Promise<string | null>`; `null` si la empresa no existe o está
dada de baja. Sin actor: el `companyId` sale de la sesión firmada y el caso de uso que lo llama ya
autorizó. En `integraciones`, `ports/company-name-lookup.ts` es el tipo de función (como
`CompanyCountryLookup` en `clientes`).

### 15.6 Composición y borde

```ts
const whatsappChatContextDeps = {
  connections: whatsappConnectionRepository, conversations: whatsappConversationRepository,
  customers: customerCatalog, customerOrders: customerOrderDirectory,
  deliveryProgress: { listDeliveryProgressByIdsIncludingDeleted: listOrderDeliveryProgressByIdsIncludingDeleted },
  presentations: presentationCatalog, recipes: recipeCatalog,
  companyName: identity.getCompanyName, variableKeys: whatsappVariableKeyRepository,
};
const whatsappMediaDeps = {
  connections: whatsappConnectionRepository, conversations: whatsappConversationRepository,
  customers: customerCatalog, graph: whatsappGraphClient, cipher: secretCipher,
};
// en `integraciones`:
getWhatsappChatContext: createGetWhatsappChatContext(whatsappChatContextDeps),
getWhatsappMedia: createGetWhatsappMedia(whatsappMediaDeps),
```

(Los nombres de las variables del cableado son los que ya haya en `lib/composition/index.ts`.)
`getWhatsappChatContextAction` va en `whatsapp-conversation-actions.ts`, mismo patrón (`run`,
`toErrorState`, copia campo a campo). Ese archivo exporta ahora **cinco** acciones.

Guardias y tests de borde que se tensan:

| Archivo | Cambio |
|---|---|
| `tests/guards/guard-rutas-fuera-de-sesion.test.ts` | + `app/api/integraciones/whatsapp/media/[mensajeId]/route.ts` como `anadido: 'integraciones'`, prueba `whatsapp-media-route.test.ts` (sin el permiso, 404) |
| `tests/unit/identity/session-once-per-request-actions.test.ts` | + `getWhatsappChatContextAction` y el `GET` de la ruta: una lectura de sesión por llamada |
| `tests/unit/integraciones/module-shape.test.ts` | archivos nuevos, contrato, cableado, cinco acciones |
| `tests/guards/guard-ambito-empresa-integraciones.test.ts` | ocho métodos en `WhatsappConversationRepository` |
| `tests/unit/pedidos/module-contract.test.ts` | contrato con `CustomerOrderDirectory` |

### 15.7 Tests (R59)

| Archivo | Cubre |
|---|---|
| `tests/unit/integraciones/whatsapp/conversations/whatsapp-media.test.ts` | R48 (`mediaUrl` solo en imagen/sticker entrante con `media_id`), `mediaIdOf`, tipos admitidos |
| `tests/unit/integraciones/whatsapp/conversations/whatsapp-conversation.test.ts` (se amplía) | R25, R48, R49 en `attachmentOf`: sin `media_id`, reacción con id interno o `null` |
| `tests/unit/integraciones/whatsapp/conversations/whatsapp-chat-context.test.ts` | R52 (pedidos/entregados/faltan con conteo, excedente y anulado), R53, R55, R56 (nulos, sin cadena vacía, propias) |
| `tests/unit/integraciones/whatsapp/conversations/get-whatsapp-media.test.ts` | R44 (cada rama ⇒ no encontrado y Graph sin llamar), R45, R46 (token ilegible, Graph falla, tipo) |
| `tests/unit/integraciones/whatsapp/conversations/get-whatsapp-chat-context.test.ts` | R50, R51, R54 (elegido por defecto, `orderId` ajeno), R57 (sin escrituras; espías) |
| `tests/unit/integraciones/whatsapp/conversations/whatsapp-media-route.test.ts` | R44, R46, R47 (cabeceras, sin `media_id` ni URL de Meta), R58 |
| `tests/unit/integraciones/whatsapp/whatsapp-graph-client-media.test.ts` | R45–R47 con `fetch` doble: dos pasos, token solo en cabecera, host ajeno, tamaño por `file_size`, cabecera y stream, 5xx vs 4xx |
| `tests/unit/integraciones/whatsapp/whatsapp-graph-client-canned.test.ts` (se amplía) | `downloadMedia` del doble |
| `tests/integration/integraciones/whatsapp-conversation-prisma.int.test.ts` (se amplía) | R49 (reacción casada, de otro contacto ⇒ null), `findMediaMessage` con ámbito |
| `tests/integration/pedidos/customer-order-directory.int.test.ts` | vivos, sin entregados ni cancelados (D12), orden, límite, otra empresa |
| `tests/integration/identity/company-name-read.int.test.ts` | nombre; dada de baja ⇒ null |
| `tests/unit/identity/get-company-name.test.ts` | la fábrica |
| `tests/integration/integraciones/whatsapp-chat-context-flow.int.test.ts` | Composición real + Graph doble: R44 (ruta 404 a otra empresa y a cliente dado de baja), R45, R49, R51–R57, R60–R63 de punta a punta |

### 15.8 Decisiones D12–D14 (R54–R56, R60–R63)

**Pedidos abiertos (D12).** `pedidos` exporta `ORDER_STATUSES_NOT_IN_PROGRESS` en su barril y el
contexto lo pasa como `excludedStatuses`. `CustomerOrderDirectory` no cambia de firma. Un pedido
entregado o cancelado no está en `orders` y pedirlo por `orderId` da `order_not_found` (R54). El
tipo `WhatsappCustomerOrder.status` del contrato pierde `ENTREGADO`.

**Claves (D13).** En `domain/whatsapp-chat-context.ts`:

```ts
export const WHATSAPP_SYSTEM_CONSTANT_KEYS = [
  'cliente.nombre', 'empresa.nombre', 'pedido.numero', 'pedido.estado',
  'pedido.fecha_solicitud', 'pedido.total', 'pedido.detalle',
] as const;
export type CustomerOrderStage = 'recibido' | 'en preparación' | 'entregado' | 'cancelado';
export const CUSTOMER_ORDER_STAGE: Readonly<Record<OrderStatus, CustomerOrderStage>> = {
  PENDIENTE: 'recibido',
  EN_CURSO: 'en preparación', POR_EMPACAR: 'en preparación', EN_EMPAQUE: 'en preparación',
  POR_ACONDICIONAR: 'en preparación', EN_ACONDICIONAMIENTO: 'en preparación',
  TERMINADO: 'en preparación', BLOQUEADO: 'en preparación',   // P20
  ENTREGADO: 'entregado', CANCELADO: 'cancelado',
};
```

`Record<OrderStatus, …>` hace que un estado nuevo en el `enum` no compile hasta tener etiqueta
(R60). Con D12 el elegido nunca está entregado ni cancelado; las cuatro etiquetas se definen igual
para que el mapa sea total.

| Clave | Valor (pedido elegido; sin elegido, todas `null`) |
|---|---|
| `pedido.numero` | `formatOrderNumber` (sin cambios) |
| `pedido.estado` | `CUSTOMER_ORDER_STAGE[status]` (R60) |
| `pedido.fecha_solicitud` | `customerDateOf(createdAt)`: `DD/MM/AAAA` del día UTC, igual que `formatCivilDate` de Pedidos (R61, P21) |
| `pedido.total` | siempre `null` (D11) |
| `pedido.detalle` | `orderDetailTextOf(lines)` (R62) |

**Líneas (D13): texto listo, no estructura.** Los valores de una plantilla son solo texto, y Meta
rechaza un parámetro con salto de línea, tabulador o más de cuatro espacios seguidos. Por eso:

- **elegido:** `pedido.detalle`, una cadena con una parte por línea del reparto, en el orden de
  `orders[].lines`, unidas por `; `. Ejemplo: «10 × Bidón 20 L (entregado 6, faltan 4); 5 × Garrafa
  5 L (entregado 5, faltan 0)». «falta» con 1. Sin nombre de presentación: «presentación sin
  nombre». Sin líneas: `null`. No se recorta: si una plantilla queda por encima del tope de Meta, el
  envío sale `FAILED` con su motivo, como cualquier rechazo;
- **descartado:** `pedido.lineas` estructurado dentro de `values` (alternativa 18). El dato
  estructurado ya llega en `orders[].lines`.

**Permiso (D14).** `getWhatsappChatContext` solo llama a `requireReadPermission`; ningún
`assertPermission('pedidos.…')`. Las lecturas de `pedidos` van por contrato sin actor. Test: actor
con `whatsapp.consultar` y sin ningún permiso de Pedidos recibe pedidos y valores (R63).

**Tests.** `whatsapp-chat-context.test.ts` gana R60 (los diez estados, mapa total), R61 (fecha
cerca de medianoche UTC), R62 (singular, sin nombre, sin líneas, sin `\n` ni `\t`) y R55/R56 (siete
claves, todas `pedido.*` nulas sin elegido). `get-whatsapp-chat-context.test.ts` gana R54
(entregado ⇒ `order_not_found`) y R63.
