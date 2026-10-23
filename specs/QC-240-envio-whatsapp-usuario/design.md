# QC-240 — envio-whatsapp-usuario · design.md

> Zona: `backend` · Complejidad: `medium` · depends_on: QC-239, QC-242 · Rama:
> `feature/QC-240-envio-whatsapp-usuario`
>
> El **qué** está en `requirements.md` (R1–R48). Aquí va el **cómo**. Precedentes que se copian:
>
> - **QC-221** (`db/migrations/20261008120843_integrations_permission`): migración de **datos** del
>   permiso, idempotente, con test estático que compara los literales con las constantes.
> - **QC-237**: `WhatsappConnectionRepository`, `decryptStoredSecret`/`ACCESS_TOKEN_FIELD`,
>   `WhatsappGraphClient` (`callGraph`, cabecera `Authorization`, tiempo máximo, 5xx = inalcanzable),
>   FK de auditoría a `users` (`whatsapp_connections_created_by_fkey`).
> - **QC-238**: modelo `whatsapp_messages`/`whatsapp_contacts` (los valores `SENDING`, `TEMPLATE`,
>   `USER`, `sentById`, `templateName` ya existen), orden de statuses (`STATUS_PREDECESSORS`).
> - **QC-239**: vínculo contacto ↔ cliente (`customerLinkedBy`, `resolveContactLink`), bloqueo,
>   `waIdCandidates`/`phoneMatchesWaId`, `CustomerPhoneLinksService` cableado desde `clientes`.
> - **QC-242**: plantillas locales (`enabled`, `mappingStatus`, `variables`), diccionario de propias,
>   forma de las claves (§19.2), `findLiveByNameAndLanguage`, `templateFailureOf` en el adaptador.
>
> **Regla transversal.** Manda `docs/conventions.md > Comentarios`: ningún comentario nuevo cita
> `QC-<n>`, `R<n>`, `design.md` ni «decisión cerrada». En los tests, `R<n>` va en el nombre del caso.

---

## Lo que ya existe

Buscado `sendWhatsappMessage`, `whatsapp.enviar`, `/messages`, `sendText`/`sendTemplate`, `SENDING`,
«envío»/«enviar» y «reintentar» en:

- `feature_list.json` (por `name` y `description`, todos los estados);
- `specs/` con grep;
- el código (`lib/`, `app/`, `db/`, `tests/`) con Grep/Read. **El MCP del grafo no se consultó**
  (este agente no lo tenía a mano); se usó Grep/Read.

| Apareció | Qué es | Qué se hace |
|---|---|---|
| QC-238 (`done`): `WhatsappMessage` con `OUT`, `SENDING`, `TEMPLATE`, `USER`, `sentById`, `templateName`, `attempts`; `STATUS_PREDECESSORS` (`SENT` desde `SENDING`) | Modelo y statuses | **Se reutiliza.** Solo se añade la columna de idioma y la FK de `sent_by` (§2) |
| QC-237 (`done`): `WhatsappGraphClient` (4 métodos, ninguno envía mensajes), `whatsapp-graph-client-fetch.ts`, `whatsapp-graph-client-canned.ts` | Cliente de Graph | **Se amplía** con `sendMessage` (la ficha lo pide) |
| QC-239 (`done`): `WhatsappContactRepository`, `CustomerPhoneLinksService` (`addWaId`, `removeWaId`, `ownersOf`), `waIdCandidates`, `blockedAt` | Contactos y teléfonos | **Se reutiliza**; el servicio de `clientes` gana `mainPhoneOf` (§5.4) |
| QC-242 (`done`): `WhatsappTemplateRepository.findLiveById`/`findLiveByNameAndLanguage`, `WhatsappVariableKeyRepository.findByKeys`, `contentOf`, `variableSlotsOf`, `WHATSAPP_CONSTANT_KEY_PATTERN` | Plantillas y diccionario | **Se reutiliza** tal cual |
| QC-243 (`done`): catálogo de constantes del front; traduce `nombre_del_cliente` ↔ `cliente.nombre` solo al hablar con el backend | Front de plantillas | Al backend llegan claves con punto, que es lo que guarda `system_key`. Nada cambia en el back; la etiqueta llega del front (P2) |
| QC-241 (`pending`) envíos del sistema con cola | Otro origen (`SYSTEM`, `QUEUED`) | Frontera: no se toca la cola ni `queueMessageId` |
| QC-245/QC-246 (`pending`) | Contactos y chat (pantalla) | Consumidores de las Server Actions de aquí |
| QC-239 «¿Se responde a desconocidos? Sí; QC-240 actualizada» | Decisión que choca con D2 de la ficha | **P1** en `requirements.md`; el spec sigue la ficha actual |
| Ningún caso de uso, acción o llamada a `/messages` | — | Nacen aquí |

Conclusión: el envío no existe en el código ni en otra ficha. Se sigue. La feature no toca UI: no se
consulta `components/shared/CATALOGO.md` y no hay pase `/design`.

---

## 1. Qué cambia (resumen)

```
db/schema.prisma                                      ← WhatsappMessage + templateLanguage
db/migrations/20261023120000_whatsapp_send_permission/{migration,down}.sql   ← datos (R1, R2)
db/migrations/20261023130000_whatsapp_outbound_messages/{migration,down}.sql ← columna + FK (R28, R44)
lib/modules/identity/domain/permissions.ts            ← + whatsapp.enviar, seed del Administrador
lib/modules/identity/domain/company-addons.ts         ← whatsapp.enviar en el añadido integraciones
lib/modules/errores/domain/error-codes.ts, error-catalog.ts   ← códigos nuevos (§8)
lib/modules/clientes/domain/customer-phone-links.ts   ← + mainPhoneOf
lib/modules/integraciones/
  index.ts                                            ← + fábricas y tipos de resultado
  domain/
    actor.ts                                          ← + requireSendPermission
    errors.ts                                         ← + errores nuevos
    whatsapp-send-input.ts                            ← zod de envío y reintento
    whatsapp-send-window.ts                           ← ventana de 24 h
    whatsapp-send-recipient.ts                        ← resolver el contacto destinatario
    whatsapp-template-message.ts                      ← parámetros de Meta y texto final
    whatsapp-send-failure.ts                          ← código de Meta → errorReason / efecto
    whatsapp-outbound-message.ts                      ← tipos y vista del saliente
    send-whatsapp-message.ts                          ← caso de uso (núcleo compartido)
    retry-whatsapp-message.ts                         ← caso de uso
  ports/
    whatsapp-graph-client.ts                          ← + sendMessage
    whatsapp-outbox-repository.ts                     ← nuevo
    customer-phone-links.ts                           ← + mainPhoneOf
  adapters/driven/
    graph/whatsapp-graph-client-fetch.ts              ← + sendMessage
    graph/whatsapp-graph-client-canned.ts             ← + sendMessage
    persistence/company-scope.ts                      ← sin cambios (las envolturas de mensaje y contacto ya existen)
    persistence/whatsapp-outbox-prisma.ts             ← nuevo
  adapters/driving/
    whatsapp-message-actions.ts                       ← sendWhatsappMessageAction, retryWhatsappMessageAction
lib/composition/index.ts                              ← cableado
tests/**                                              ← §10
```

---

## 2. Modelo de datos

### 2.1 Prisma (`WhatsappMessage`)

```prisma
  templateName     String?  @map("template_name")
  templateLanguage String?  @map("template_language")   // nuevo
```

- **Columna y no clave del `payload`** para el idioma: va junto a `templateName`, con el mismo tipo
  de dato, y la ficha los nombra juntos (A4). El `payload` queda solo para los valores por clave.
- **`sent_by` gana su FK** a `users(id)` `ON DELETE RESTRICT ON UPDATE CASCADE`, como
  `whatsapp_connections_created_by_fkey`; QC-238 §2.1 dejó esa decisión a esta ficha. El índice
  `whatsapp_messages_sent_by_idx` ya existe. Los entrantes tienen `sent_by` nulo y no los afecta.
- Sin `@relation`: la FK se escribe a mano en la migración, como el resto del módulo.
- **Sin RLS nueva**: la tabla ya tiene `ENABLE` y `FORCE ROW LEVEL SECURITY` (QC-238). La
  autorización vive en el caso de uso (`docs/architecture.md > Acceso a datos y autorizacion`).

### 2.2 Migración de datos `20261023120000_whatsapp_send_permission` (R1, R2)

Copia de la de QC-221:

```sql
INSERT INTO "permissions" ("code", "module", "action", "description", "updated_at") VALUES
  ('whatsapp.enviar', 'whatsapp', 'enviar',
   'Enviar mensajes de WhatsApp a los clientes de la empresa.', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_code")
SELECT "r"."id", 'whatsapp.enviar' FROM "roles" AS "r" WHERE "r"."name" = 'Administrador'
ON CONFLICT ("role_id", "permission_code") DO NOTHING;
```

`down.sql`: `DELETE FROM "role_permissions" WHERE "permission_code" = 'whatsapp.enviar'` y luego
`DELETE FROM "permissions" WHERE "code" = 'whatsapp.enviar'`.

`permissions.ts` gana la entrada (y el párrafo de enmienda del catálogo, sin citar la ficha) y
`SEED_ROLE_PERMISSIONS[ROLE_ADMINISTRADOR]` la incluye. `company-addons.ts` la pone en
`ADDON_PERMISSIONS.integraciones` (R3): así la sesión ya la quita cuando el añadido está apagado y no
hace falta un `assertAddon` aparte (`docs/architecture.md > Permisos y autenticacion`). `enviar` es
la tercera acción fuera de `consultar`/`modificar` (como `asignaciones.ejecutar` y
`entregas.anular`) y `whatsapp` no es carpeta de `lib/modules/` (como `usuarios` o `empaque`).

### 2.3 Migración de esquema `20261023130000_whatsapp_outbound_messages` (R44, R47)

```sql
ALTER TABLE "whatsapp_messages" ADD COLUMN "template_language" TEXT;
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_sent_by_fkey"
  FOREIGN KEY ("sent_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

`down.sql`: `DROP CONSTRAINT "whatsapp_messages_sent_by_fkey"` y `DROP COLUMN "template_language"`.
Escrita a mano (como las demás de WhatsApp). Los timestamps se re-fechan en F2.3 si `dev` trae una
posterior.

---

## 3. Contratos de entrada y salida

### 3.1 Envío (`domain/whatsapp-send-input.ts`)

```ts
const recipient = z.union([
  z.object({ contactId: z.uuid() }).strict(),
  z.object({ customerId: z.uuid() }).strict(),
]);                                                     // P7

const templateValues = {
  constants: z.record(z.string(), z.string()).default({}),       // clave con punto → valor
  constantLabels: z.record(z.string(), z.string()).default({}),  // clave con punto → etiqueta (P2)
};

export const sendWhatsappMessageSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('text'), recipient, text: z.string() }),
  z.object({ kind: z.literal('template'), recipient, templateId: z.uuid(), ...templateValues }),
]);

export const retryWhatsappMessageSchema = z.object({ messageId: z.uuid(), ...templateValues });

export const WHATSAPP_TEXT_MAX_LENGTH = 4096;          // P9 [POR CONFIRMAR]
```

El texto se mide en puntos de código, como los validadores de QC-242, y se rechaza vacío o solo
espacios (R17). Se envía tal cual (sin recortar). Las claves de `constants` que no usa la plantilla
se ignoran; las de variables propias, también (R22).

### 3.2 Resultado

```ts
export type WhatsappOutboundMessageView = {
  readonly id: string;
  readonly type: 'TEXT' | 'TEMPLATE';
  readonly status: 'SENT' | 'FAILED';
  readonly body: string;
  readonly templateName: string | null;
  readonly templateLanguage: string | null;
  readonly errorCode: string | null;
  readonly errorReason: string | null;
  readonly createdAt: string;            // ISO
};
```

Server Actions (`adapters/driving/whatsapp-message-actions.ts`, `'use server'`, mismo patrón que
`whatsapp-template-actions.ts`: `currentActor()` dentro de `runInRequestScope`, `toErrorState` de
`createErrorStateTranslator(IntegracionesError, …)`):

```ts
export type WhatsappSendResult =
  | { status: 'success'; data: WhatsappOutboundMessageView }
  | { status: 'missing_values'; message: string; missing: readonly { key: string; label: string }[] }
  | ErrorState;

export async function sendWhatsappMessageAction(input: unknown): Promise<WhatsappSendResult>;
export async function retryWhatsappMessageAction(input: unknown): Promise<WhatsappSendResult>;
```

- `missing_values` es una rama **fuera** de `ErrorState` (R24, R45): el texto del catálogo es fijo
  (`errorMessage(code)`, sin parámetros), y la ficha pide nombrar la etiqueta. La lista cerrada de
  campos de `ErrorState` (guardia del catálogo, caso 8) no cambia. El dominio lanza
  `WhatsappTemplateValuesMissingError` con `missing`; la acción la reconoce antes de `toErrorState`.
  `message`: «Falta el valor de A» / «Falta el valor de A, B y C», con la etiqueta de
  `constantLabels` o, si no llega, la clave.
- El error lleva igualmente un `code` del catálogo (`whatsapp_template_values_missing`, texto
  genérico) para quien lo reciba por `toErrorState` sin la rama especial.
- Sin `revalidatePath`: no hay pantalla todavía (la pondrá QC-245/246).

---

## 4. Dominio

### 4.1 Autorización (`domain/actor.ts`)

```ts
export const WHATSAPP_SEND_PERMISSION = 'whatsapp.enviar';
export function requireSendPermission(actor): asserts actor is Actor;   // assertPermission + empresa no vacía
```

Primera línea de los dos casos de uso (R4). El añadido llega resuelto en los permisos (R3).

### 4.2 El núcleo (`domain/send-whatsapp-message.ts`)

`createSendWhatsappMessage(deps)` y `createRetryWhatsappMessage(deps)` comparten una función interna
`deliver(plan, ctx)`. `deps`:

```ts
type SendDeps = {
  connections: WhatsappConnectionRepository;
  cipher: SecretCipher;
  outbox: WhatsappOutboxRepository;          // §5.2
  customerPhones: CustomerPhoneLinks;        // + mainPhoneOf, isCustomerAlive (§5.4)
  templates: WhatsappTemplateRepository;
  variableKeys: WhatsappVariableKeyRepository;
  graph: WhatsappGraphClient;
  now?: () => Date;
};
```

**`sendWhatsappMessage(input, actor)`**, en este orden (todo lo anterior a 7 es rechazo previo):

1. `requireSendPermission(actor)`; `scope = scopeOf(actor)` (R4).
2. `sendWhatsappMessageSchema.safeParse(input)`; fallo ⇒ `ValidationError` (R17).
3. **Conexión** (R12–R14): `connections.findLive(scope)`; `null` ⇒ `WhatsappConnectionNotFoundError`;
   `status !== 'ACTIVE'` ⇒ `WhatsappConnectionNotActiveError`. El token se descifra en el paso 6, ya
   validado todo lo demás, con `decryptStoredSecret(…, ACCESS_TOKEN_FIELD, scope)`; su
   `SecretUnreadableError` deja la conexión en `ERROR` (helper de QC-237) y se propaga antes de
   escribir el mensaje.
4. **Destinatario** (§4.4) ⇒ `{ contact, customerId }` (R5–R11).
5. **Contenido**:
   - texto: `isWindowOpen(contact.lastInboundAt, now)` o `WhatsappWindowClosedError` (R15, R16);
   - plantilla: `templates.findLiveById(templateId, scope)` con `connectionId` igual al de la conexión
     o `WhatsappTemplateNotFoundError` (R19); `isSendable(t)` o `WhatsappTemplateNotSendableError`
     (R20); `buildTemplateMessage` (§4.5) o `WhatsappTemplateValuesMissingError` (R21–R25).
6. Paso 3 diferido: descifrar el token.
7. `outbox.insertSending({...}, scope)` ⇒ `messageId` (R26–R28). Si lanza, se propaga y no hay
   llamada a Meta (R38).
8. `graph.sendMessage({ phoneNumberId, accessToken, to: contact.waId, message })` (R29).
9. Resultado (R30–R36): `ok` ⇒ `outbox.markSent(messageId, wamid, scope)`; fallo ⇒
   `sendFailureOf(failure)` (§4.6) ⇒ `outbox.markFailed(messageId, errorCode, errorReason, scope)` y,
   si el efecto es `token_invalid`, `connections.update(record.id, { status: 'ERROR', lastError:
   TOKEN_INVALID_MESSAGE }, scope)` (R33). El texto de Meta no se guarda, no se devuelve y no se
   registra (§7, R36, R46).
10. `outbox.touchContact(contact.id, at, scope)` (R32), y se devuelve la vista (R37).

**`retryWhatsappMessage(input, actor)`** (R39–R42): pasos 1–2 con su esquema;
`outbox.findOutbound(messageId, scope)`; `null` ⇒ `WhatsappMessageNotFoundError`; si no es
`FAILED`/`OUT`/`USER` ⇒ `WhatsappMessageNotRetryableError`. Después, paso 3, destinatario por
`{ contactId: failed.contactId }` (mismas reglas de R5 y R10), y el contenido: texto ⇒ el `body` del
fallido con la ventana de hoy (R41); plantilla ⇒ `templates.findLiveByNameAndLanguage(connectionId,
failed.templateName, failed.templateLanguage, scope)` (`null` ⇒ `WhatsappTemplateNotFoundError`) y
el mismo paso 5 con los valores del reintento (R42). Pasos 6–10 iguales. El fallido no se toca: el
nuevo es otra fila (R39).

Un fallido de una conexión anterior (borrada) da `whatsapp_contact_not_found` en el paso del
destinatario: su contacto no es de la conexión viva.

### 4.3 Ventana (`domain/whatsapp-send-window.ts`)

```ts
export const WHATSAPP_WINDOW_MS = 24 * 60 * 60 * 1000;
export function isWindowOpen(lastInboundAt: Date | null, now: Date): boolean;  // null ⇒ false; now - last < 24 h
```

### 4.4 Destinatario (`domain/whatsapp-send-recipient.ts`)

- **Por contacto** (R5, R10): `outbox.findContact(contactId, connectionId, scope)` (filtra empresa y
  conexión) ⇒ `null` ⇒ `WhatsappContactNotFoundError`; `customerId === null` ⇒
  `WhatsappRecipientNotCustomerError`; `customerPhones.isCustomerAlive(customerId, companyId)` falso ⇒
  `WhatsappRecipientNotCustomerError`; `blockedAt !== null` ⇒ `WhatsappContactBlockedError`.
- **Por cliente** (R6–R9, R11):
  1. `customerPhones.mainPhoneOf(customerId, companyId)` ⇒ `'customer_not_found'` ⇒
     `LinkedCustomerNotFoundError` (código `customer_not_found`); `'no_phone'` ⇒
     `WhatsappCustomerWithoutPhoneError`; si no, `{ e164 }`.
  2. `outbox.findContactsByWaIds(connectionId, waIdCandidates(e164), scope)`.
  3. Si alguno está vinculado a **este** cliente, se usa; si no, si hay uno sin cliente, se usa;
     si el único que hay está vinculado a otro cliente ⇒ `WhatsappContactLinkedElsewhereError` (P3).
     Con ninguno ⇒ `outbox.ensureContact(connectionId, e164, scope)`: `INSERT … ON CONFLICT
     (connection_id, wa_id) DO NOTHING` y relectura, que deja **un** contacto aunque dos envíos lo
     creen a la vez (R11).
  4. Si el contacto elegido no tenía este cliente, `outbox.linkContact(contact.id, { customerId,
     linkedBy: actor.id }, scope)` (manual, P8). Se escribe **antes** del mensaje: si el envío luego
     falla, el contacto queda vinculado igualmente, que es lo que haría vincular a mano.
  5. `blockedAt !== null` ⇒ `WhatsappContactBlockedError` (antes del paso 4: un rechazo previo no
     cambia nada).

El vínculo manual no pasa por `resolveContactLink`: el actor eligió al cliente y el número es su
principal, así que el cliente es dueño y la regla de QC-239 conservaría ese vínculo manual.

### 4.5 Parámetros y texto final (`domain/whatsapp-template-message.ts`) — puro

```ts
export type TemplateMessage = {
  readonly name: string;
  readonly language: string;
  readonly components: readonly unknown[];             // forma de Meta
  readonly body: string;                               // texto final (P5)
  readonly values: Readonly<Record<string, string>>;   // por clave, para el payload
};

export function buildTemplateMessage(
  template: WhatsappTemplateRecord,
  ownValues: ReadonlyMap<string, { key: string; value: string }>,   // por variableKeyId
  constants: Readonly<Record<string, string>>,
  constantLabels: Readonly<Record<string, string>>,
):
  | { ok: true; message: TemplateMessage }
  | { ok: false; missing: readonly { key: string; label: string }[] };
```

1. `content = contentOf(template.components)`; `slots = variableSlotsOf(content)`. `null` o algún
   hueco sin relación en `template.variables` no debería pasar con `MAPPED`, pero se trata como no
   enviable (`WhatsappTemplateNotSendableError`) y no como excepción.
2. Por hueco: binding `company` ⇒ `ownValues.get(variableKeyId).value` (el caso de uso los lee con
   `variableKeys.findByKeys`/por id, valor de hoy, R22); binding `system` ⇒ `constants[systemKey]`,
   recortado solo para decidir si está vacío (R23, R24). Las faltantes se acumulan (todas, en orden
   de hueco, sin repetir clave).
3. Componentes de Meta [POR CONFIRMAR contra la documentación vigente de la Cloud API en T5]:
   `{ type: 'header', parameters: [{ type: 'text', text }] }` si hay `header`;
   `{ type: 'body', parameters: [...] }` en el orden de `n`; por cada `button.<i>`,
   `{ type: 'button', sub_type: 'url', index: '<i>', parameters: [{ type: 'text', text }] }`.
4. `body` (P5): header (si es de texto), body y footer con cada `{{n}}` sustituido, unidos por
   `\n\n`; los botones no entran.
5. `values`: `{ [clave]: valor }` de cada clave usada (constantes con su clave con punto, propias con
   su clave).

### 4.6 Fallos de Meta (`domain/whatsapp-send-failure.ts`)

```ts
export const TOKEN_INVALID_MESSAGE = 'Revisa el token en Integraciones';
export function sendFailureOf(failure: GraphFailure):
  { errorCode: string | null; errorReason: string; effect: 'token_invalid' | null };
```

| Fallo | `errorCode` | `errorReason` | Efecto |
|---|---|---|---|
| `code = 190` | `'190'` | «Revisa el token en Integraciones» | conexión `ERROR` + `lastError` (R33) |
| `code = 131047` | `'131047'` | «Pasaron más de 24 horas desde el último mensaje del cliente: usa una plantilla.» | — (R34) |
| `code ∈ {130429, 131056}` | el código | «Demasiados mensajes, intenta en un momento» | — (R35) |
| otro `code` | el código | «Meta no aceptó el mensaje (código N). Intenta de nuevo o revisa la conexión.» | — (R36, P6) |
| rechazo sin código | `null` | «Meta no aceptó el mensaje. Intenta de nuevo o revisa la conexión.» | — |
| `unreachable` (red, tiempo, 5xx) o `2xx` sin `wamid` | `null` | «No se pudo contactar con Meta. Intenta de nuevo en unos minutos.» | — |

`errorReason` cabe en el recorte de 500 de QC-238. Los textos se fijan en un test.

---

## 5. Puertos y adaptadores

### 5.1 `WhatsappGraphClient.sendMessage` (se amplía)

```ts
export type GraphOutboundMessage =
  | { readonly type: 'text'; readonly body: string }
  | { readonly type: 'template'; readonly name: string; readonly language: string; readonly components: readonly unknown[] };

export type GraphMessageSent = { readonly ok: true; readonly wamid: string } | ({ readonly ok: false } & GraphFailure);

sendMessage(input: { phoneNumberId: string; accessToken: string; to: string; message: GraphOutboundMessage }): Promise<GraphMessageSent>;
```

Fetch [POR CONFIRMAR la forma vigente en T5]: `POST {base}/{version}/{phone_number_id}/messages`
con `callGraph` (token en la cabecera, `AbortSignal.timeout`, `no-store`). Cuerpo:
`{ messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'text', text: { body,
preview_url: false } }` o `{ …, type: 'template', template: { name, language: { code }, components } }`.
Éxito: zod `{ messages: [{ id: string.min(1) }] }` ⇒ `wamid = messages[0].id`; sin él ⇒ fallo
`unreachable` (no hay prueba de entrega). Fallo: `templateFailureOf(reply)` (ya da `code`, `subcode`,
`message`; 5xx = `unreachable`). Nada se registra desde el adaptador.

Doble para E2E (`whatsapp-graph-client-canned.ts`): devuelve `wamid.E2E.<n>`; con `to` que empieza
por `CANNED_SEND_FAIL_PREFIX` devuelve el fallo `190` (así un E2E futuro de Contactos puede ver el
camino de error). Lo cablea la composición igual que los otros cuatro métodos.

### 5.2 `WhatsappOutboxRepository` (nuevo) y `persistence/whatsapp-outbox-prisma.ts`

```ts
export type OutboundContact = { id; waId; customerId: string | null; customerLinkedBy: string | null; blockedAt: Date | null; lastInboundAt: Date | null };
export type NewOutboundMessage = {
  connectionId; contactId; sentById; type: 'TEXT' | 'TEMPLATE'; body: string;
  templateName: string | null; templateLanguage: string | null; payload: Record<string, unknown>;
};
export type OutboundMessageRecord = NewOutboundMessage & { id; status; direction; origin; errorCode; errorReason; createdAt: Date };

export interface WhatsappOutboxRepository {
  findContact(id: string, connectionId: string, scope): Promise<OutboundContact | null>;
  findContactsByWaIds(connectionId: string, waIds: readonly string[], scope): Promise<readonly OutboundContact[]>;
  ensureContact(connectionId: string, waId: string, scope): Promise<OutboundContact>;
  linkContact(id: string, link: ContactLink, scope): Promise<void>;
  insertSending(row: NewOutboundMessage, scope): Promise<OutboundMessageRecord>;
  markSent(id: string, wamid: string, scope): Promise<OutboundMessageRecord | null>;
  markFailed(id: string, errorCode: string | null, errorReason: string, scope): Promise<OutboundMessageRecord | null>;
  findOutbound(id: string, scope): Promise<OutboundMessageRecord | null>;
  touchContact(id: string, at: Date, scope): Promise<void>;
}
```

- Cada método es una **función con nombre** que declara `scope: IntegracionesScope` y lo lleva a
  `whatsappMessageCompanyScope`/`whatsappContactCompanyScope`/`companyScopeColumns` (ya existen,
  QC-238): entra en el barrido de la guardia de ámbito sin exención.
- `insertSending`: `direction: 'OUT'`, `status: 'SENDING'`, `origin: 'USER'`, `attempts: 1`,
  `metaTimestamp: null` (R26).
- `markSent`/`markFailed`: `updateMany({ where: { id, status: 'SENDING', …scope } })` y relectura; la
  condición en el `where` evita pisar un estado que ya movió un status de Meta (§9).
- `ensureContact`: `$queryRaw` `INSERT … ON CONFLICT (connection_id, wa_id) DO NOTHING` con
  `company_id` de `companyScopeColumns(scope)` y luego `findFirst` por `(connectionId, waId)` con
  ámbito (R11). El contacto nuevo nace con `last_inbound_at` nulo (ventana cerrada).
- `touchContact`: `UPDATE … SET last_message_at = GREATEST(last_message_at, $at)` con ámbito (R32).
- `findContact`/`findContactsByWaIds` filtran por `connectionId` además de la empresa.

### 5.3 Composición

En el bloque de WhatsApp de `integraciones`, sin reordenar:

```ts
const whatsappOutboxRepository: WhatsappOutboxRepository = {
  findContact: findWhatsappOutboundContact, findContactsByWaIds: findWhatsappOutboundContactsByWaIds,
  ensureContact: ensureWhatsappOutboundContact, linkContact: linkWhatsappOutboundContact,
  insertSending: insertWhatsappSendingMessage, markSent: markWhatsappMessageSent,
  markFailed: markWhatsappMessageFailed, findOutbound: findWhatsappOutboundMessage,
  touchContact: touchWhatsappContactOnSend,
};
// en `integraciones`:
sendWhatsappMessage: createSendWhatsappMessage(whatsappSendDeps),
retryWhatsappMessage: createRetryWhatsappMessage(whatsappSendDeps),
```

`customerPhones` se cablea con el servicio de `clientes` fuera de transacción
(`createCustomerPhoneLinks({ phones: createCustomerPhoneRepository(prisma) })`, como hoy dentro de la
unidad de trabajo pero con el cliente raíz). `graph` es el mismo cliente (fetch o canned) que ya
eligen los otros casos de uso.

### 5.4 `CustomerPhoneLinksService.mainPhoneOf` / `isCustomerAlive` (en `clientes`)

```ts
mainPhoneOf(customerId: string, companyId: string): Promise<'customer_not_found' | 'no_phone' | { readonly e164: string }>;
isCustomerAlive(customerId: string, companyId: string): Promise<boolean>;
```

`mainPhoneOf`: cliente vivo de la empresa (si no, `customer_not_found`); su vínculo principal vivo
(R8 de QC-239 lo mantiene igual a `phone_e164`) ⇒ `{ e164 }`, o `no_phone`. Se pone en el servicio
que `integraciones` ya consume (con su puerto `ports/customer-phone-links.ts`) y no en
`CustomerCatalog`, que por contrato no expone teléfonos. `isCustomerAlive` reutiliza la misma
consulta de cliente vivo que `addWaId`.

---

## 6. Contrato del módulo (`index.ts`)

Se suman `createSendWhatsappMessage`, `createRetryWhatsappMessage`, `WhatsappTemplateValuesMissingError`
y los tipos `WhatsappOutboundMessageView`. `module-shape.test.ts` se tensa (§10.2).

---

## 7. Logs (R46)

- Ningún `console.*` en el dominio. La acción no registra nada salvo lo que ya hace `toErrorState`
  con el `diagnostic` del error.
- Un fallo de Meta no es una excepción (se devuelve el mensaje `FAILED`). El caso de uso devuelve,
  junto a la vista, un `diagnostic` interno `Graph enviar mensaje: <kind>; code=<n>; subcode=<n>`, y
  la acción lo escribe con `console.warn('whatsapp_send_failed', { messageId, diagnostic })`. **No**
  lleva el texto de Meta: puede repetir el número del destinatario o parte del mensaje (R46). Nunca
  el texto, los valores, el `waId` ni el token.

---

## 8. Errores (catálogo de `errores` + `integraciones/domain/errors.ts`)

| Código | Clase | Texto |
|---|---|---|
| `whatsapp_connection_not_active` | `WhatsappConnectionNotActiveError` | «La conexión de WhatsApp no está activa. Revísala en Integraciones.» |
| `whatsapp_recipient_not_customer` | `WhatsappRecipientNotCustomerError` | «Solo se pueden enviar mensajes a clientes de la empresa.» |
| `whatsapp_customer_without_phone` | `WhatsappCustomerWithoutPhoneError` | «El cliente no tiene un teléfono válido para WhatsApp.» |
| `whatsapp_contact_linked_elsewhere` | `WhatsappContactLinkedElsewhereError` | «Ese número está vinculado a otro cliente. Cámbialo desde Contactos.» |
| `whatsapp_contact_blocked` | `WhatsappContactBlockedError` | «El contacto está bloqueado.» |
| `whatsapp_window_closed` | `WhatsappWindowClosedError` | «Pasaron más de 24 horas desde el último mensaje del cliente: usa una plantilla.» |
| `whatsapp_template_not_sendable` | `WhatsappTemplateNotSendableError` | «La plantilla no está habilitada o no está aprobada por Meta.» |
| `whatsapp_template_values_missing` | `WhatsappTemplateValuesMissingError` | «Faltan valores de la plantilla.» (la acción usa el texto con etiquetas, §3.2) |
| `whatsapp_message_not_found` | `WhatsappMessageNotFoundError` | «No se encontró el mensaje.» |
| `whatsapp_message_not_retryable` | `WhatsappMessageNotRetryableError` | «Solo se puede reintentar un mensaje que falló.» |

Se reutilizan `unauthorized`, `invalid_input`, `whatsapp_connection_not_found`,
`whatsapp_contact_not_found`, `whatsapp_template_not_found`, `customer_not_found` (vía
`LinkedCustomerNotFoundError`) e `integration_secret_unreadable`. Los textos son propuesta del spec;
el humano los ve al aprobar.

---

## 9. Concurrencia y límites conocidos

- **`SENDING` colgado.** Si el proceso muere entre el paso 7 y el 9, el mensaje queda en `SENDING`.
  Un status de Meta posterior lo mueve (`SENT` admite `SENDING` como predecesor). No se añade un
  barrido: la ficha no lo pide (sería de QC-241).
- **Status antes del `wamid`.** Meta puede mandar `sent`/`delivered` antes de que se guarde el
  `wamid` (paso 9). Ese status no encuentra fila y se pierde; el mensaje queda en `SENT` por el paso
  9, y los siguientes (`delivered`/`read`) sí se aplican. Se acepta: el caso de un `delivered`
  perdido es raro y no rompe nada.
- **`markSent`/`markFailed` condicionados a `SENDING`**: no retroceden un estado ya movido.
- **Reintento tras timeout**: puede duplicar el mensaje si Meta sí lo recibió (P6).

---

## 10. Tests

Mapa `R<n> → test` completo en `tasks.md`.

### 10.1 Nuevos

| Archivo | Cubre |
|---|---|
| `tests/unit/integraciones/whatsapp/send/send-whatsapp-message.test.ts` | R4, R5–R10, R12–R20, R26–R38 con puertos dobles; orden (ningún puerto antes del permiso; ninguna escritura ni `sendMessage` en un rechazo previo) |
| `tests/unit/integraciones/whatsapp/send/retry-whatsapp-message.test.ts` | R39–R42 |
| `tests/unit/integraciones/whatsapp/send/whatsapp-template-message.test.ts` | R21–R25 (header, body en orden, botón URL, repetidas, faltantes con etiqueta y sin etiqueta, vacío/espacios, propias ignoran el valor del front, `values` por clave, texto final) |
| `tests/unit/integraciones/whatsapp/send/whatsapp-send-failure.test.ts` | R33–R36: la tabla de §4.6 |
| `tests/unit/integraciones/whatsapp/send/whatsapp-send-window.test.ts` | R15, R16: `null`, 23 h 59 min, 24 h exactas |
| `tests/unit/integraciones/whatsapp/send/whatsapp-message-actions.test.ts` | R45, R37, R24 (rama `missing_values`), R46 (sin texto ni valores en logs) |
| `tests/unit/integraciones/whatsapp/whatsapp-graph-client-send.test.ts` | R29: URL, cabecera, cuerpo de texto y de plantilla, `wamid`, 4xx con código, 5xx/timeout = `unreachable`, sin `wamid` (con `fetch` simulado) |
| `tests/integration/integraciones/whatsapp-send-flow.int.test.ts` | Composición real + doble de Graph inyectado (A6, R48): R8, R11 (dos envíos a la vez ⇒ un contacto), R26–R28, R30, R31, R32, R33 (conexión `ERROR` en la base), R39 (el fallido queda igual y hay dos filas), R42 (valor de propia cambiado entre envío y reintento), R43 (contacto/plantilla/mensaje de otra empresa ⇒ no encontrado) |
| `tests/integration/integraciones/whatsapp-outbox-prisma.int.test.ts` | Adaptador: ámbito, `markSent` solo desde `SENDING`, `GREATEST` de `touchContact`, `ensureContact` concurrente |
| `tests/integration/integraciones/whatsapp-outbound-messages-migration.int.test.ts` | R44 (FK a `users` rechaza un id inexistente), R47 (down y up dejan el mismo esquema) |
| `tests/unit/identity/schema/whatsapp-send-permission-migration.test.ts` | R1, R2: literales de la migración = constantes de la app (patrón de QC-221) |
| `tests/integration/identity/whatsapp-send-permission-migration.int.test.ts` | R2: aplicar dos veces no duplica; revertir quita solo esas filas; solo el Administrador |

### 10.2 Tests y guardias que se tensan (nunca se relajan)

| Archivo | Cambio |
|---|---|
| `tests/unit/identity/permissions.test.ts` | + `whatsapp.enviar`; Administrador la tiene, ningún otro rol (R1, D5) |
| `tests/unit/identity/addons/company-addons.test.ts` | + en `integraciones` (R3) |
| `tests/integration/identity/identity-seed.int.test.ts` | seed del Administrador con el permiso |
| `tests/unit/integraciones/module-shape.test.ts` | lista de archivos, contrato, cableado, importadores |
| `tests/guards/guard-ambito-empresa-integraciones.test.ts` | + puerto `WhatsappOutboxRepository` (9 métodos) en el barrido |
| `tests/guards/guard-catalogo-de-errores.test.ts` / catálogo | + 10 códigos |
| `tests/unit/composition/integraciones-graph-doubles.test.ts` | el doble y el fetch exponen `sendMessage` |
| `tests/unit/integraciones/whatsapp/whatsapp-doubles.ts` | + dobles de outbox y de `sendMessage` |
| `tests/integration/aislamiento.json` | entradas de los `.int.test.ts` nuevos (los de flujo escriben con `commit`, con `motivo` y `desde`) |

Otros tests que cuenten permisos (menú, sesión) los localiza el implementer en T1 con
`vitest related` y los actualiza en la misma tarea.

---

## 11. Fronteras con otras fichas y choques previsibles

- **QC-241** (envíos del sistema, cola): usará `origin = SYSTEM`, `QUEUED`, `queueMessageId`. Puede
  reutilizar `buildTemplateMessage`, `sendFailureOf` y `sendMessage`.
- **QC-245/QC-246** (Contactos, chat): llaman a las dos Server Actions y resuelven las constantes.
- **QC-238**: sus statuses siguen moviendo los salientes (no se toca).

| Archivo | Con quién | Cómo se resuelve |
|---|---|---|
| `db/schema.prisma`, `db/migrations/` | Fichas con esquema en vuelo (QC-131, QC-279 del mismo autor; otras según `archivos-en-vuelo`) | Cambio de una línea en `WhatsappMessage`; timestamps re-fechados en F2.3 |
| `lib/modules/identity/domain/permissions.ts`, `company-addons.ts` | Fichas que añadan permisos | Una entrada más |
| `lib/modules/errores/domain/*` | Fichas con códigos nuevos | Entradas al final del bloque de WhatsApp |
| `lib/composition/index.ts` | Todas las fichas con cableado | Solo el bloque de WhatsApp |
| `lib/modules/integraciones/**`, `module-shape.test.ts`, guardia de ámbito | QC-241 (mismo módulo) | La que llegue después amplía las listas exactas |

---

## 12. Alternativas descartadas

1. **Mandar el mensaje a una cola y responder `queued`** (como QC-241). Descartada por D1: hay una
   persona mirando y el error inmediato con «Reintentar» es más claro.
2. **Llamar a Meta antes de insertar el mensaje** (insertar ya `SENT` o `FAILED`). Un status de
   Meta que llegue antes del `INSERT` no encontraría fila, y un fallo de la base después de un envío
   aceptado dejaría un mensaje entregado sin rastro. La ficha fija el orden (`INSERT` `sending` y
   después `POST`).
3. **Reintentar actualizando el mensaje fallido** (`attempts + 1`). Descartada por D4: el historial
   conserva el intento fallido.
4. **Reintentar una plantilla con los valores guardados en el `payload` del fallido.** Descartada por
   A5: se recalcula con los valores vigentes y se respeta si se deshabilitó.
5. **Guardar el idioma en el `payload`** en lugar de una columna. Ahorra la migración de esquema,
   pero separa dos datos que la ficha nombra juntos y obliga a leer JSON para un dato que el
   reintento busca por igualdad junto a `templateName`.
6. **Resolver las constantes en el backend** (leer el nombre del cliente). Descartada por A3 y por
   QC-242 §19 (F1): el catálogo de constantes vive solo en el front.
7. **Meter el texto con etiquetas en `ErrorState`** (un campo `params`). La lista de campos de
   `ErrorState` es cerrada y la guardia del catálogo lo prohíbe; una rama propia del resultado de la
   acción no la toca.
8. **Comprobar el añadido con `assertAddon` en el caso de uso** (como QC-239). Innecesario: el
   permiso nuevo pertenece al añadido y la sesión ya lo quita; QC-239 lo necesitaba porque usa un
   permiso núcleo (`clientes.modificar`).

---

## 13. Dependencias de terceros

**Ninguna.** `fetch`, `AbortSignal` y `zod` ya están. `package.json` no cambia.

## 14. Variables de entorno

Ninguna nueva. Hacen falta las de QC-234 (cifrado), QC-237 (versión de Graph) y la conexión
`ACTIVE`, que ya son condición de despliegue.
