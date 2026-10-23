# QC-245 — contactos-whatsapp-backend · design.md

> Zona: `backend` · Complejidad: `medium` · depends_on: QC-240, QC-242 · Rama:
> `feature/QC-245-contactos-whatsapp-backend`
>
> El **qué** está en `requirements.md` (R1–R43). Aquí va el **cómo**. Precedentes que se copian:
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

> Sección autocontenida para copiar en la ficha de QC-246. Lo marcado **[ABIERTO]** depende de una
> pregunta de `requirements.md > Preguntas abiertas`; se indica su default, que es lo que se
> implementa si el humano no dice otra cosa.

### A. Server Actions

Todas se llaman desde un componente de cliente o de servidor importándolas por su **ruta exacta**
(no desde `@/lib/modules/integraciones`). Los tipos DTO se importan desde `@/lib/modules/integraciones`.

| Acción | Ruta de import | Permiso | Origen |
|---|---|---|---|
| `listWhatsappConversationsAction` | `@/lib/modules/integraciones/adapters/driving/whatsapp-conversation-actions` | `whatsapp.consultar` | nueva |
| `getWhatsappChatAction` | `@/lib/modules/integraciones/adapters/driving/whatsapp-conversation-actions` | `whatsapp.consultar` | nueva |
| `markWhatsappChatReadAction` | `@/lib/modules/integraciones/adapters/driving/whatsapp-conversation-actions` | `whatsapp.consultar` | nueva |
| `listSendableWhatsappTemplatesAction` | `@/lib/modules/integraciones/adapters/driving/whatsapp-conversation-actions` | `whatsapp.consultar` | nueva |
| `sendWhatsappMessageAction` | `@/lib/modules/integraciones/adapters/driving/whatsapp-message-actions` | `whatsapp.enviar` | QC-240 (ya existe) |
| `retryWhatsappMessageAction` | `@/lib/modules/integraciones/adapters/driving/whatsapp-message-actions` | `whatsapp.enviar` | QC-240 (ya existe) |

Ambos permisos son hoy solo del Administrador y desaparecen si la empresa tiene apagado el añadido
«Integraciones».

```ts
// ---- Forma de error común (de `@/lib/modules/errores`) ----
type ErrorState =
  | { status: 'error'; code: ErrorCode; message: string }                         // message en español
  | { status: 'error'; code: 'unexpected'; message: string; reference: string };  // reference = id de la petición

type ActionResult<T> = { status: 'success'; data: T } | ErrorState;

// ---- Nuevas ----
export async function listWhatsappConversationsAction(input: {
  search?: string;                                   // ≤ 100 caracteres; '' o solo espacios = sin búsqueda
  blocked?: 'all' | 'blocked' | 'not_blocked';       // [ABIERTO P7] default 'all'
  page?: number;                                     // entero ≥ 1, default 1
  pageSize?: number;                                 // entero ≥ 1; default 10, se acota a 25 [ABIERTO P12]
}): Promise<ActionResult<WhatsappConversationList>>;

export async function getWhatsappChatAction(input: {
  target: { contactId: string } | { customerId: string };   // uuid
  before?: string;                                   // cursor: id del mensaje más antiguo ya mostrado
  pageSize?: number;                                 // entero ≥ 1; default 30, se acota a 50 [ABIERTO P12]
}): Promise<ActionResult<WhatsappChat>>;

export async function markWhatsappChatReadAction(input: {
  contactId: string;                                 // uuid
  upToMessageId?: string;                            // [ABIERTO P4] último mensaje que mostró la pantalla
}): Promise<ActionResult<{ unreadCount: number }>>;

export async function listSendableWhatsappTemplatesAction(): Promise<ActionResult<{
  templates: readonly WhatsappSendableTemplate[];
}>>;

// ---- Reutilizadas de QC-240 (sin cambios) ----
type WhatsappSendRecipient = { contactId: string } | { customerId: string };

export async function sendWhatsappMessageAction(
  input:
    | { kind: 'text'; recipient: WhatsappSendRecipient; text: string }    // 1..4096 caracteres, no solo espacios
    | {
        kind: 'template';
        recipient: WhatsappSendRecipient;
        templateId: string;
        constants?: Record<string, string>;        // clave con punto (p. ej. 'cliente.nombre') → valor resuelto por el front
        constantLabels?: Record<string, string>;   // clave con punto → etiqueta, para el mensaje de faltantes
      },
): Promise<WhatsappSendResult>;

export async function retryWhatsappMessageAction(input: {
  messageId: string;                               // un saliente FAILED de origen usuario
  constants?: Record<string, string>;              // en plantillas: el front vuelve a mandar las constantes
  constantLabels?: Record<string, string>;
}): Promise<WhatsappSendResult>;

type WhatsappSendResult =
  | { status: 'success'; data: WhatsappOutboundMessageView }   // también si Meta lo rechazó: data.status = 'FAILED'
  | { status: 'missing_values'; message: string; missing: readonly { key: string; label: string }[] }
  | ErrorState;

type WhatsappOutboundMessageView = {
  id: string;
  type: 'TEXT' | 'TEMPLATE';
  status: 'SENT' | 'FAILED';
  body: string;                       // en plantillas, el texto final ya armado
  templateName: string | null;
  templateLanguage: string | null;
  errorCode: string | null;
  errorReason: string | null;         // en español
  createdAt: string;                  // ISO 8601
};
```

Las variables **propias** de una plantilla no se mandan: el back usa su valor guardado. Para
reintentar un texto basta `{ messageId }`. Si el destinatario es un cliente sin conversación
(`{ customerId }`), el envío crea el contacto; el chat siguiente se pide ya por `contactId`.

### B. Tipos compartidos

```ts
type WhatsappConnectionStatus = 'ACTIVE' | 'PENDING' | 'ERROR' | 'DISABLED';
type WhatsappMessageDirection = 'IN' | 'OUT';
type WhatsappMessageType =
  | 'TEXT' | 'IMAGE' | 'AUDIO' | 'VIDEO' | 'DOCUMENT' | 'STICKER' | 'LOCATION' | 'CONTACTS'
  | 'REACTION' | 'BUTTON' | 'INTERACTIVE' | 'TEMPLATE' | 'UNSUPPORTED';
type WhatsappMessageStatus = 'RECEIVED' | 'QUEUED' | 'SENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';

// ---- Paginación ----
type Page<T> = {                     // listado de conversaciones: por número de página
  items: readonly T[];
  total: number;                     // conversaciones que pasan los filtros
  page: number;                      // 1..totalPages
  pageSize: number;                  // el efectivo, ya acotado
  totalPages: number;
};
type ChatCursor = string;            // id (uuid) del mensaje más antiguo que ya tiene la pantalla

// ---- Listado ----
type WhatsappConversationList = {
  connectionStatus: WhatsappConnectionStatus | null;   // null = la empresa no tiene WhatsApp conectado
  page: Page<WhatsappConversationItem>;
};

type WhatsappConversationItem = {
  contactId: string;
  customerId: string;
  customerName: string;              // «Nombres Apellidos»
  phone: string;                     // número del contacto en formato internacional, p. ej. «+52 1 55 1234 5678»
  isBlocked: boolean;
  unreadCount: number;
  lastMessage: {
    direction: WhatsappMessageDirection;
    type: WhatsappMessageType;
    preview: string | null;          // cuerpo recortado a 120 caracteres; null si el tipo no tiene cuerpo
    status: WhatsappMessageStatus;
    at: string;                      // ISO 8601
  };
};

// ---- Chat ----
type WhatsappWindowState =
  | { open: true; closesAt: string } // ISO 8601: última entrada del cliente + 24 h
  | { open: false; closesAt: null };

type WhatsappChat = {
  connectionStatus: WhatsappConnectionStatus | null;
  contact: {                         // null = el cliente aún no tiene conversación (chat vacío)
    id: string;
    phone: string;
    isBlocked: boolean;
    unreadCount: number;
  } | null;
  customer: { id: string; name: string };
  window: WhatsappWindowState;       // chat vacío: siempre cerrada → el primer mensaje es una plantilla
  messages: readonly WhatsappChatMessage[];   // de más antiguo a más reciente
  hasMore: boolean;                  // quedan mensajes anteriores
  nextCursor: ChatCursor | null;     // = messages[0].id si hasMore; si no, null
};

type WhatsappChatMessage = {
  id: string;
  direction: WhatsappMessageDirection;
  type: WhatsappMessageType;
  body: string | null;               // texto, pie de un adjunto, emoji de reacción, título de botón…
  attachment: WhatsappChatAttachment | null;
  status: WhatsappMessageStatus;     // entrantes: 'RECEIVED'
  errorReason: string | null;        // solo FAILED, en español
  origin: 'USER' | 'SYSTEM' | null;  // null en los entrantes
  sentBy: { id: string; displayName: string | null } | null;   // null si no lo envió una persona
  templateName: string | null;
  at: string;                        // ISO 8601: hora de Meta en los entrantes, hora de guardado en los salientes
};

type WhatsappChatAttachment =
  | { kind: 'media'; mimeType: string; filename: string | null; caption: string | null }  // IMAGE, AUDIO, VIDEO, DOCUMENT, STICKER
  | { kind: 'location'; latitude: number; longitude: number; name: string | null; address: string | null }
  | { kind: 'reaction'; emoji: string | null; messageId: string };   // emoji null = reacción quitada; messageId = wamid del mensaje reaccionado

// ---- Plantillas enviables ----
type WhatsappSendableTemplate = {
  id: string;                        // es el templateId de sendWhatsappMessageAction
  name: string;
  language: string;                  // p. ej. 'es_MX'
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  content: {                         // los huecos se muestran como {{clave}}
    header: { text: string; example: string | null } | null;
    body: { text: string; examples: readonly string[] };
    footer: string | null;
    buttons: readonly (
      | { type: 'QUICK_REPLY'; text: string }
      | { type: 'URL'; text: string; url: string; example: string | null }
      | { type: 'PHONE_NUMBER'; text: string; phoneNumber: string }
    )[];
  };
  variables: readonly {
    slot: string;                    // 'header', 'body.1', 'button.0'…
    position: number;
    kind: 'system' | 'company';      // system = constante: la resuelve el front; company = propia: la pone el back
    key: string;                     // constante con punto ('cliente.nombre') o clave propia
    label: string | null;            // solo propias; la etiqueta de una constante la conoce el front
    value: string | null;            // solo propias: valor vigente, para la vista previa [ABIERTO P9]
  }[];
};
```

### C. Errores por acción

Textos del catálogo (`message` de `ErrorState`). Toda acción puede devolver además `unexpected`
(«Ocurrio un error inesperado. Intentalo de nuevo.», con `reference`).

| Código | Texto | list | getChat | markRead | templates | send | retry |
|---|---|:-:|:-:|:-:|:-:|:-:|:-:|
| `unauthorized` | «El actor no tiene permiso para realizar esta operacion.» | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `invalid_input` | «La entrada recibida no es valida.» | ✓ | ✓ | ✓ | | ✓ | ✓ |
| `whatsapp_contact_not_found` | «La conversación no existe.» | | ✓ | ✓ | | ✓ | ✓ |
| `customer_not_found` | «El cliente solicitado no existe.» | | ✓ | | | ✓ | |
| `whatsapp_message_not_found` | «No se encontró el mensaje.» | | ✓ (cursor) | ✓ | | | ✓ |
| `whatsapp_connection_not_found` | «No se encontró la conexión de WhatsApp.» | | | | | ✓ | ✓ |
| `whatsapp_connection_not_active` | «La conexión de WhatsApp no está activa. Revísala en Integraciones.» | | | | | ✓ | ✓ |
| `integration_secret_unreadable` | «No se pudo leer una credencial guardada de la integración. Vuelve a escribirla.» | | | | | ✓ | ✓ |
| `whatsapp_recipient_not_customer` | «Solo se pueden enviar mensajes a clientes de la empresa.» | | | | | ✓ | ✓ |
| `whatsapp_customer_without_phone` | «El cliente no tiene un teléfono válido para WhatsApp.» | | | | | ✓ | |
| `whatsapp_contact_linked_elsewhere` | «Ese número está vinculado a otro cliente. Cámbialo desde Contactos.» | | | | | ✓ | |
| `whatsapp_contact_blocked` | «El contacto está bloqueado.» | | | | | ✓ | ✓ |
| `whatsapp_window_closed` | «Pasaron más de 24 horas desde el último mensaje del cliente: usa una plantilla.» | | | | | ✓ | ✓ |
| `whatsapp_template_not_found` | «No se encontró la plantilla.» | | | | | ✓ | ✓ |
| `whatsapp_template_not_sendable` | «La plantilla no está habilitada o no está aprobada por Meta.» | | | | | ✓ | ✓ |
| `whatsapp_message_not_retryable` | «Solo se puede reintentar un mensaje que falló.» | | | | | | ✓ |
| `missing_values` (rama propia, no `ErrorState`) | «Falta el valor de A» / «Falta el valor de A, B y C» | | | | | ✓ | ✓ |

Sin conexión de WhatsApp, `list`, `getChat` por cliente y `templates` **no** dan error:
devuelven `connectionStatus: null` y vacío. `getChat` por contacto da `whatsapp_contact_not_found`.

Un envío que llega a Meta y Meta rechaza **no** es un error: vuelve `success` con `data.status =
'FAILED'` y `data.errorReason` en español (p. ej. «Revisa el token en Integraciones», «Demasiados
mensajes, intenta en un momento»).

### D. Semántica

**Listado.**
- Solo conversaciones: contacto de la conexión actual, vinculado a un cliente vivo y con al menos
  un mensaje [ABIERTO P6]. Números sin cliente y clientes dados de baja no aparecen [ABIERTO P11].
- Orden: hora del último mensaje, más reciente primero; empate por `contactId`.
- Búsqueda: casa por nombre del cliente (palabras sin acentos ni mayúsculas, como en Clientes) **o**
  porque el número contiene los dígitos escritos.
- Paginación por número de página (`page`, `pageSize`, `total`, `totalPages`). El orden cambia
  cuando llegan mensajes: al consultar periódicamente, recargar la página 1.

**Chat.**
- Primera llamada sin `before`: los `pageSize` mensajes más recientes, devueltos de más antiguo a
  más reciente. Para cargar los anteriores, `before = nextCursor`; seguir mientras `hasMore`.
- Para traer lo nuevo en la consulta periódica, volver a pedir sin `before` y unir por `id`.
- Abrir por `customerId`: si el cliente tiene conversaciones, la de último mensaje más reciente
  [ABIERTO P5]; si no, chat vacío con `contact: null` y ventana cerrada.
- Leer el chat **no** marca leído [ABIERTO P3].

**No leídos y marcar leído.**
- La marca de lectura es **una por conversación y compartida por toda la empresa**: si un usuario
  marca leído, el contador baja para todos.
- `unreadCount` = mensajes **entrantes** posteriores a la marca (las reacciones entrantes cuentan
  [ABIERTO P13]); sin marca, todos los entrantes.
- `markWhatsappChatReadAction({ contactId, upToMessageId })` mueve la marca hasta ese mensaje
  (pasar el id del último mensaje que se mostró); sin `upToMessageId`, hasta el último del chat.
  La marca nunca retrocede. Devuelve los no leídos que quedan (0 si no llegó nada después).
- Uso esperado: al abrir el chat y después de cada consulta periódica que traiga entrantes nuevos.
- No avisa a Meta: el cliente no ve los checks azules.

---

## 6. Contrato del módulo (`index.ts`)

Se suman `createListWhatsappConversations`, `createGetWhatsappChat`, `createMarkWhatsappChatRead`,
`createListSendableWhatsappTemplates` y los tipos del §B. `module-shape.test.ts` se tensa (§10.2).

---

## 7. Logs (R41)

Ningún `console.*` en el dominio ni en el adaptador. Las acciones solo registran lo que ya hace
`toErrorState` con el `diagnostic` de un error inesperado. Ningún error nuevo lleva cuerpo, número ni
nombre en su `diagnostic`.

---

## 8. Errores

**Ningún código nuevo.** Se reutilizan `unauthorized`, `invalid_input`, `whatsapp_contact_not_found`,
`customer_not_found` (vía `LinkedCustomerNotFoundError`) y `whatsapp_message_not_found`. El catálogo
y su guardia no cambian.

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

| Archivo | Con quién | Cómo se resuelve |
|---|---|---|
| `db/schema.prisma`, `db/migrations/` | Fichas con esquema en vuelo (QC-131, QC-279 del mismo autor; otras según `archivos-en-vuelo`) | Una línea en `WhatsappContact`; timestamps re-fechados en F2.3 |
| `lib/modules/identity/domain/permissions.ts`, `company-addons.ts` | Fichas que añadan permisos | Una entrada más |
| `lib/modules/clientes/domain/customer-catalog.ts` y su adaptador | Fichas de `clientes` (QC-302, QC-303) | Un método más al final |
| `lib/composition/index.ts` | Todas las fichas con cableado | Solo el bloque de WhatsApp y `buildCustomerCatalog` |
| `lib/modules/integraciones/**`, `module-shape.test.ts`, guardia de ámbito | QC-241 (mismo módulo) | La que llegue después amplía las listas exactas |

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

---

## 13. Dependencias de terceros

**Ninguna.** `zod` y `libphonenumber-js` (vía `formatPhoneInternational` de `clientes`) ya están.
`package.json` no cambia.

## 14. Variables de entorno

Ninguna nueva.
