# QC-241 — envio-whatsapp-sistema · design.md

> Zona: `backend` · Complejidad: `medium` · depends_on: QC-240 · Rama:
> `feature/QC-241-envio-whatsapp-sistema`
>
> El **qué** está en `requirements.md` (R1–R41). Aquí va el **cómo**. Precedentes que se copian:
>
> - **QC-111** (`documentos`): `document-job-route.ts` (firma antes que el cuerpo, `200` = no
>   reintentar, `500` = reintentar), `processing-queue-qstash.ts` y `queue-signature-qstash.ts`
>   (la librería solo en el adaptador, configuración leída en cada llamada).
> - **QC-240**: `deliver`, `sendFailureOf`, `buildTemplateMessage`, `isSendable`,
>   `recipientByCustomer`, `WhatsappOutboxRepository`, `WhatsappGraphClient.sendMessage`,
>   `WhatsappSendLog`.
> - **QC-242**: el cron diario de plantillas (`whatsapp-template-cron-route.ts`,
>   `createSyncAllWhatsappTemplates`: empresas de una en una, presupuesto de tiempo, fallo aislado).
>
> **Regla transversal.** Manda `docs/conventions.md > Comentarios`: ningún comentario nuevo cita
> `QC-<n>`, `R<n>`, `design.md` ni «decisión cerrada». En los tests, `R<n>` va en el nombre del caso.

---

## Lo que ya existe

Buscado `WhatsappNotifier`, `enqueue`, `QUEUED`, `queueMessageId`, `origin SYSTEM`,
`WHATSAPP_SEND_MAX_RETRIES`, `whatsapp/envios`, `@upstash/qstash`, `qstash`, «barrido», «cola» en:

- `feature_list.json` (por `name` y `description`, todos los estados);
- `specs/` con grep;
- el código (`lib/`, `app/`, `db/`, `tests/`, `vercel.json`, `.env.example`) con Grep/Read. **El MCP del
  grafo no se consultó** (no estaba disponible para este agente); se usó Grep/Read.

| Apareció | Qué es | Qué se hace |
|---|---|---|
| QC-238 (`done`): `WhatsappMessage` con `QUEUED`, `SENDING`, `SYSTEM`, `attempts`, `queueMessageId` | Modelo y enums | **Se reutiliza.** Solo se añade una columna y un índice (§2) |
| QC-240 (`done`): `deliver`, `sendFailureOf`/`TOKEN_INVALID_MESSAGE`, `buildTemplateMessage`, `isSendable`, `recipientByCustomer` | Envío síncrono de usuario | **Se reutilizan** las piezas puras y la traducción de fallos; el flujo es otro (cola) |
| QC-240: `WhatsappOutboxRepository` (`findContactsByWaIds`, `ensureContact`, `linkContact`, `markSent`, `markFailed`, `touchContact`) | Puerto de salientes | **Se reutiliza** sin cambiar su firma; las operaciones de la cola van en un puerto nuevo (§5.3) |
| QC-240: `WhatsappGraphClient.sendMessage` (fetch y canned) | Envío a Meta | **Se reutiliza** tal cual |
| QC-240 §9 y §11: «`SENDING` colgado… sería de QC-241»; «QC-241 usará `SYSTEM`, `QUEUED`, `queueMessageId`» | Frontera declarada | Se cumple; D10: el barrido solo toca los de origen `SYSTEM` |
| QC-111 (`done`): `processing-queue-qstash.ts`, `queue-signature-qstash.ts`, `processing-config-env.ts` | Adaptadores de QStash de `documentos` | **Patrón** que se copia. No se importan: un módulo no importa adaptadores de otro |
| QC-242 (`done`): `verifyCronSecret` (cableado en `integraciones`), `listActiveCompanyIds`, `integrationsSwitch`, `createSyncAllWhatsappTemplates` | Cron de plantillas | **Se reutilizan** el secreto, la lista de empresas, el interruptor del añadido y la forma del recorrido |
| `vercel.json`: tres crons, todos diarios | Tareas programadas | Se añade el barrido, horario (D7) |
| Guardia de importadores de `@upstash/qstash` | **No existe** como test; solo la fila de `docs/dependencias.md` y dos comentarios | Se crea (D12, §9) |
| QC-247 (`pending`), QC-297 (`pending`) | Consumidores futuros del puerto | Fuera de alcance; usarán `integraciones.whatsappNotifier` |
| QT-303 (agente IA) | Origen `AGENT` | No se toca; el barrido no mira `AGENT` (R33) |

Conclusión: no hay cola de envíos, notifier ni barrido en el código ni en otra ficha. Se sigue. La
feature no toca UI: no se consulta `components/shared/CATALOGO.md` y no hay pase `/design`.

---

## 1. Qué cambia (resumen)

```
db/schema.prisma                                        ← WhatsappMessage + templateComponents
db/migrations/20261111120000_whatsapp_system_send/{migration,down}.sql   ← columna + índice parcial
lib/shared/routes.ts                                    ← + WHATSAPP_SEND_ROUTE
lib/modules/integraciones/
  index.ts                                              ← + fábricas, tipos y esquema del trabajo
  domain/
    whatsapp-notifier.ts                                ← tipo del puerto WhatsappNotifier y resultado
    whatsapp-send-job.ts                                ← zod del trabajo de envío
    whatsapp-send-retry-policy.ts                       ← temporal/permanente, plazos, motivos
    whatsapp-outbound-message.ts                        ← + NewQueuedMessage, ClaimedMessage
    enqueue-whatsapp-message.ts                         ← caso de uso enqueue
    process-whatsapp-send.ts                            ← caso de uso del consumidor
    sweep-whatsapp-sends.ts                             ← caso de uso del barrido
  ports/
    whatsapp-send-queue.ts                              ← publicar un trabajo
    whatsapp-queue-signature.ts                         ← verificar la firma
    whatsapp-send-queue-repository.ts                   ← persistencia de la cola
    whatsapp-send-config.ts                             ← tope de reintentos
    whatsapp-queue-log.ts                               ← líneas de log de la cola
  adapters/driven/
    queue/whatsapp-send-queue-qstash.ts                 ← Client.publishJSON
    queue/whatsapp-queue-signature-qstash.ts            ← Receiver.verify
    config/whatsapp-send-config-env.ts                  ← QSTASH_*, APP_BASE_URL, WHATSAPP_SEND_MAX_RETRIES
    persistence/whatsapp-send-queue-prisma.ts           ← nuevo
  adapters/driving/
    whatsapp-send-route.ts                              ← POST del consumidor
    whatsapp-send-sweep-cron-route.ts                   ← GET del barrido
app/api/integraciones/whatsapp/envios/route.ts          ← enchufe + runtime/maxDuration
app/api/cron/barrer-envios-whatsapp/route.ts            ← enchufe + runtime/maxDuration
lib/composition/index.ts                                ← cableado
vercel.json, .env.example, docs/dependencias.md         ← cron, variable, fila de qstash
lib/modules/documentos/adapters/driven/queue/*.ts       ← solo el comentario «único archivo»
tests/**                                                ← §10
```

---

## 2. Modelo de datos

### 2.1 Prisma (`WhatsappMessage`)

```prisma
  templateComponents Json?   @map("template_components")   // nuevo
```

- **Qué guarda:** los parámetros de Meta (`TemplateMessage.components`) armados al encolar. El
  consumidor envía exactamente eso (R20) y el `body` guardado coincide con lo enviado. Nulo en los
  mensajes de usuario, de agente y entrantes.
- `payload` conserva la forma de QC-240 (valores por clave), así que la pantalla de chat no cambia.
- **Sin RLS nueva:** la tabla ya tiene `ENABLE` y `FORCE ROW LEVEL SECURITY` (QC-238). La
  autorización vive en el caso de uso (`docs/architecture.md > Acceso a datos y autorizacion`).
- `@updatedAt` lo pone Prisma; las escrituras con SQL crudo de §5.3 ponen `updated_at = now()` a mano.

### 2.2 Migración `20261111120000_whatsapp_system_send` (R40)

```sql
ALTER TABLE "whatsapp_messages" ADD COLUMN "template_components" JSONB;

CREATE INDEX "whatsapp_messages_system_pending_idx"
  ON "whatsapp_messages" ("company_id", "status", "updated_at")
  WHERE "origin" = 'SYSTEM' AND "status" IN ('QUEUED', 'SENDING');
```

`down.sql`: `DROP INDEX "whatsapp_messages_system_pending_idx"` y `ALTER TABLE … DROP COLUMN
"template_components"`. El índice es parcial, escrito a mano como el único parcial de
`whatsapp_templates` (QC-242): Prisma no lo representa. Sirve a las tres consultas del barrido, que
corre cada hora en todas las empresas (D7; `docs/architecture.md`: nada de consultas sin índice en
crons frecuentes).
El timestamp se re-fecha en F2.3 si `dev` trae una migración posterior.

---

## 3. Contratos

### 3.1 Puerto `WhatsappNotifier` (`domain/whatsapp-notifier.ts`)

```ts
export type WhatsappTemplateRef = { readonly name: string; readonly language: string };   // D8

export type WhatsappEnqueueSkipReason =
  | 'addon_off' | 'no_active_connection' | 'customer_not_found' | 'no_phone'
  | 'contact_linked_elsewhere' | 'contact_blocked' | 'template_not_found'
  | 'template_not_sendable' | 'template_values_missing' | 'error';

export type WhatsappEnqueueOutcome =
  | { readonly status: 'queued'; readonly messageId: string; readonly published: boolean }
  | { readonly status: 'skipped'; readonly reason: WhatsappEnqueueSkipReason };

export interface WhatsappNotifier {
  enqueue(
    companyId: string,
    customerId: string,
    template: WhatsappTemplateRef,
    values: Readonly<Record<string, string>>,     // clave de constante con punto → valor
  ): Promise<WhatsappEnqueueOutcome>;              // nunca rechaza (R7)
}
```

`index.ts` exporta el tipo y `createWhatsappNotifier`; la composición publica
`integraciones.whatsappNotifier`. Un módulo consumidor (QC-247) declara su propio puerto y la
composición lo ata a este objeto: nadie importa rutas profundas de `integraciones`. El resultado es
para tests y logs; quien llama puede ignorarlo.

**Para quien llama:** `enqueue` escribe fuera de cualquier transacción del llamante. Se llama después
de confirmar la operación de negocio; si se llama antes y la operación se revierte, el aviso sale
igual. Es una nota para QC-247, no una regla que esta ficha haga cumplir.

### 3.2 Trabajo de envío (`domain/whatsapp-send-job.ts`)

```ts
export const WHATSAPP_SEND_JOB_KIND = 'send_message';
export const whatsappSendJobSchema = z.object({
  kind: z.literal(WHATSAPP_SEND_JOB_KIND),
  messageId: z.uuid(),
  companyId: z.uuid(),
}).strict();
export type WhatsappSendJob = z.infer<typeof whatsappSendJobSchema>;
```

`companyId` viaja en el cuerpo firmado: la cola lo firma con el cuerpo (JWT con el SHA-256 del cuerpo,
fila de `docs/dependencias.md`), así que no se puede cambiar sin invalidar la firma. Con él, el
consumidor lee con ámbito desde la primera consulta y **no hace falta** un resolutor sin ámbito como
el del webhook (exención de la guardia de ámbito). Ver alternativa 3 de §11.

### 3.3 Consumidor `POST /api/integraciones/whatsapp/envios`

`adapters/driving/whatsapp-send-route.ts`, en el orden de `document-job-route.ts`:

1. `rawBody = await request.text()`; `signature = request.headers.get('upstash-signature')`.
2. `integraciones.whatsappQueueSignature.verify({ rawBody, signature })` falso ⇒ `401` (R14).
3. `JSON.parse` o `whatsappSendJobSchema.safeParse` fallan ⇒ `400` (R15).
4. `integraciones.processWhatsappSend(job)` ⇒ `'done'` ⇒ `200`; `'requeue'` ⇒ `500` (R18–R23).
5. Una excepción no prevista se registra (`whatsapp_send_job_crashed`, solo `messageId`) y responde
   `500` (R24).

Sin cookie, sin actor, sin permiso (R16). Respuestas sin cuerpo. `route.ts`: `runtime = 'nodejs'`,
`maxDuration = 60` (el tiempo máximo de Graph de QC-237 cabe holgado).

### 3.4 Barrido `GET /api/cron/barrer-envios-whatsapp`

`adapters/driving/whatsapp-send-sweep-cron-route.ts`, copia de `whatsapp-template-cron-route.ts`:
`integraciones.verifyCronSecret(authorization)` ⇒ `misconfigured` ⇒ `500`, `unauthorized` ⇒ `401`
(R27); si no, `integraciones.sweepWhatsappSends()` y `Response.json({ republished, failed,
companiesFailed })` (R28), `500` si alguna empresa falló. `route.ts`: `runtime = 'nodejs'`,
`maxDuration = 300` (presupuesto interno de 240 s, como el cron de plantillas).

`vercel.json` (D7, cerrada 2026-11-11):

```json
{ "path": "/api/cron/barrer-envios-whatsapp", "schedule": "0 * * * *" }
```

Una pasada por hora, en punto. Los umbrales de §4.1 no cambian (5 y 10 min): deciden **qué** mensaje
está viejo cuando pasa el barrido, no **cuándo** pasa. Consecuencia aceptada por el humano (D7): un
mensaje perdido puede tardar hasta ~1 h en republicarse o quedar en `FAILED` (ver §8).

---

## 4. Dominio

### 4.1 Política (`domain/whatsapp-send-retry-policy.ts`) — pura

```ts
export const QUEUED_STALE_MS = 5 * 60 * 1000;
export const SENDING_STUCK_MS = 10 * 60 * 1000;
export function maxAttemptsOf(maxRetries: number): number;          // 1 + maxRetries (D6)
export function isTemporarySendFailure(failure: GraphFailure): boolean;
//   kind 'unreachable' (red, tiempo, 5xx, 2xx sin wamid) ⇒ true
//   code ∈ {130429, 131056} ⇒ true
//   cualquier otro rechazo ⇒ false
export const SENDING_STUCK_REASON, RETRIES_EXHAUSTED_REASON, NOT_DELIVERABLE_REASON;   // §7
```

`5xx` llega como `unreachable` desde el adaptador de QC-237/240 (`templateFailureOf`), por eso no hay
rama de estado HTTP aquí. El `2xx` sin `wamid` también es `unreachable` (QC-240 §5.1): se trata como
temporal, con el riesgo de duplicado que ya acepta QC-240 P6.

### 4.2 `enqueue` (`domain/enqueue-whatsapp-message.ts`)

`createWhatsappNotifier(deps): WhatsappNotifier`. `deps`:

```ts
type EnqueueDeps = WhatsappSendRecipientDeps & {
  integrations: IntegrationsSwitch;
  connections: Pick<WhatsappConnectionRepository, 'findLive'>;
  templates: Pick<WhatsappTemplateRepository, 'findLiveByNameAndLanguage'>;
  variableKeys: Pick<WhatsappVariableKeyRepository, 'listAll'>;
  outbox: Pick<WhatsappOutboxRepository, 'findContactsByWaIds' | 'ensureContact' | 'linkContact' | 'touchContact'>;
  queueStore: Pick<WhatsappSendQueueRepository, 'insertQueued' | 'recordPublished'>;
  queue: WhatsappSendQueue;
  log: WhatsappQueueLog;
  now?: () => Date;
};
```

Todo el cuerpo va dentro de un `try`; el `catch` registra `whatsapp_enqueue_failed` con
`{ companyId, customerId, error: <nombre de la clase> }` y devuelve `skipped/error` (R7). Pasos, con
`scope = { companyId }`:

1. `integrations.isOn(companyId)` falso ⇒ `skipped/addon_off` (R2).
2. `connections.findLive(scope)`; `null` o `status !== 'ACTIVE'` ⇒ `skipped/no_active_connection`
   (R3).
3. **Destinatario** (R4, R5, R9): se reutiliza `recipientByCustomer` de QC-240 con un adaptador de
   contexto: su `actorId` se pasa como `null` ⇒ vínculo de sistema (D14). Hace falta un cambio mínimo:
   `RecipientContext.actorId: string | null` (hoy `string`); QC-240 sigue pasando el id del usuario.
   Sus errores se traducen a motivo: `LinkedCustomerNotFoundError` ⇒ `customer_not_found`,
   `WhatsappCustomerWithoutPhoneError` ⇒ `no_phone`, `WhatsappContactLinkedElsewhereError` ⇒
   `contact_linked_elsewhere`, `WhatsappContactBlockedError` ⇒ `contact_blocked`.
4. **Plantilla** (R6, R12): `templates.findLiveByNameAndLanguage(connection.id, name, language,
   scope)`; `null` ⇒ `template_not_found`; `!isSendable` ⇒ `template_not_sendable`;
   `buildTemplateMessage(template, ownValues, values, {})` con `ok: false` ⇒ `template_values_missing`
   y el log lleva `missing.map(m => m.key)`. `WhatsappTemplateNotSendableError` lanzado por
   `buildTemplateMessage` ⇒ `template_not_sendable`. Nunca texto libre, nunca ventana.
5. `queueStore.insertQueued({ connectionId, contactId, body, templateName, templateLanguage,
   payload: message.values, templateComponents: message.components }, scope)` ⇒ `id` (R8).
6. `outbox.touchContact(contact.id, now, scope)` (R13).
7. `queue.publish({ kind: 'send_message', messageId: id, companyId })` ⇒ `queueMessageId`;
   `queueStore.recordPublished(id, queueMessageId, scope)` (R10). Si `publish` lanza: log
   `whatsapp_enqueue_publish_failed` con `{ messageId }` y se devuelve `queued` con
   `published: false` (R11). El barrido lo vuelve a publicar.

Cada omisión deja `log.warn('whatsapp_enqueue_skipped', { companyId, customerId, reason })` (R2–R6).
Nunca valores, número, texto ni token (R26 aplica igual aquí).

### 4.3 Consumidor (`domain/process-whatsapp-send.ts`)

`createProcessWhatsappSend(deps): (job: WhatsappSendJob) => Promise<'done' | 'requeue'>`. `deps`:
`integrations`, `connections` (`findLive`, `update`), `cipher`, `queueStore` (`claim`, `release`),
`outbox` (`findContact`, `markSent`, `markFailed`), `graph` (`sendMessage`), `config`
(`maxRetries`), `sendLog`, `now?`.

1. `scope = { companyId: job.companyId }`; `maxAttempts = maxAttemptsOf(config.maxRetries())`.
2. `claimed = queueStore.claim(job.messageId, maxAttempts, scope)` (R17). `null` ⇒ `'done'` (R18).
3. Comprobaciones tras el reclamo (R19), cada una ⇒ `outbox.markFailed(id, null,
   NOT_DELIVERABLE_REASON, scope)` ⇒ `'done'`:
   `integrations.isOn` falso; `connections.findLive` nulo, no `ACTIVE` o con `id` distinto del
   `connectionId` del mensaje; `outbox.findContact(claimed.contactId, connectionId, scope)` nulo o con
   `blockedAt`; `decryptStoredSecret` lanza `SecretUnreadableError` (el helper ya deja la conexión en
   `ERROR`, QC-237).
4. `graph.sendMessage({ phoneNumberId, accessToken, to: contact.waId, message: { type: 'template',
   name: claimed.templateName, language: claimed.templateLanguage, components:
   claimed.templateComponents } })` (R20).
5. `ok` ⇒ `outbox.markSent(id, wamid, scope)` ⇒ `'done'` (R21). Si `markSent` devuelve `null` (ya no
   estaba en `SENDING`: el barrido lo marcó), se responde `'done'` igual: Meta ya lo aceptó y
   reintentar lo duplicaría (mismo criterio que QC-240 §9).
6. Fallo y `isTemporarySendFailure` ⇒ `queueStore.release(id, scope)` (`SENDING` → `QUEUED`,
   `attempts` igual) y `sendLog.sendFailed({ messageId, diagnostic })` ⇒ `'requeue'` (R22).
7. Fallo permanente ⇒ `sendFailureOf(failure)` ⇒ `outbox.markFailed(id, errorCode, errorReason,
   scope)`; si `effect === 'token_invalid'`, `connections.update(connection.id, { status: 'ERROR',
   lastError: TOKEN_INVALID_MESSAGE }, scope)`; `sendLog.sendFailed(...)` ⇒ `'done'` (R23).

El diagnóstico es el mismo de QC-240 (`Graph enviar mensaje: <kind>; code=<n>; subcode=<n>`); se
extrae a una función compartida en `whatsapp-send-failure.ts` para no duplicarla (R26).

Un mensaje que agotó el tope y sigue en `QUEUED` no se reclama (paso 2): el barrido lo pasa a
`FAILED` (R31). Un `SENDING` que quedó colgado porque el proceso murió tras el reclamo lo cierra la
primera pasada del barrido en que lleve más de 10 minutos sin cambiar: con el barrido horario (D7),
entre 10 min y ~1 h 10 min después (R32).

### 4.4 Barrido (`domain/sweep-whatsapp-sends.ts`)

`createSweepWhatsappSends(deps): () => Promise<SweepResult>`, forma de
`createSyncAllWhatsappTemplates`: `listCompanyIds`, presupuesto de 240 s, y por empresa un `try`
propio (R28). Por empresa, con `scope = { companyId }` y `at = now()`:

1. `queueStore.failStuckSending(at - SENDING_STUCK_MS, SENDING_STUCK_REASON, scope)` (R32). Nunca
   publica.
2. `queueStore.failExhausted(maxAttempts, RETRIES_EXHAUSTED_REASON, scope)` (R31).
3. Si `integrations.isOn(companyId)` es falso: `queueStore.failStaleQueued(at - QUEUED_STALE_MS,
   NOT_DELIVERABLE_REASON, scope)` y se pasa a la siguiente empresa (R34).
4. `queueStore.listStaleQueued(at - QUEUED_STALE_MS, maxAttempts, SWEEP_BATCH, scope)` y, por cada
   id: `queue.publish({ kind, messageId, companyId })` ⇒ `queueStore.recordPublished(id,
   queueMessageId, scope)` (renueva `updated_at`, R29). Un `publish` que lanza se registra
   (`whatsapp_sweep_publish_failed`, `{ messageId }`) y se sigue (R30).

`SWEEP_BATCH = 100` por empresa y pasada **[POR CONFIRMAR]**: acota lo que una pasada publica; lo que
quede sale en la siguiente pasada, una hora después (D7). Todas las consultas filtran `origin = 'SYSTEM'` (R33).

```ts
type SweepResult = {
  readonly republished: number;
  readonly failed: number;
  readonly companiesFailed: readonly { companyId: string; code: string }[];
};
```

---

## 5. Puertos y adaptadores

### 5.1 `WhatsappSendQueue` y `WhatsappQueueSignature`

```ts
export interface WhatsappSendQueue { publish(job: WhatsappSendJob): Promise<string> }     // id de la cola
export interface WhatsappQueueSignature {
  verify(delivery: { rawBody: string; signature: string | null }): Promise<boolean>;     // nunca lanza
}
```

`adapters/driven/queue/whatsapp-send-queue-qstash.ts`: `new Client({ token })` dentro de la función y
`client.publishJSON({ url, body: job, retries: maxRetries })`; devuelve `response.messageId`. La
configuración se lee en cada llamada (`readWhatsappSendQueueConfig()`), nunca al importar.

`adapters/driven/queue/whatsapp-queue-signature-qstash.ts`: `Receiver` con las dos claves; `verify`
captura la excepción de la librería y devuelve `false`; firma ausente ⇒ `false`.

Son los dos únicos archivos de `integraciones` que importan `@upstash/qstash` (R38). El
identificador de mensaje de la cola **no** se usa en el consumidor: el candado es el reclamo por
estado (D2), no el id de entrega, así que no hace falta `messageIdOf`.

### 5.2 Configuración (`adapters/driven/config/whatsapp-send-config-env.ts`)

```ts
export function readWhatsappSendQueueConfig(): { token; currentSigningKey; nextSigningKey; targetUrl; maxRetries };
export function readWhatsappSendMaxRetries(): number;   // R25
```

- `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`: las mismas de `documentos`
  (D13); si falta alguna, lanza nombrándolas sin su valor.
- `targetUrl = readPublicBaseUrl() + WHATSAPP_SEND_ROUTE`; sin `APP_BASE_URL` lanza nombrándola.
- `WHATSAPP_SEND_MAX_RETRIES`: vacía ⇒ `3` (D6); no entero o negativa ⇒ lanza nombrándola.

Lector propio y no el de `documentos`: un módulo no importa los adaptadores de otro
(`docs/perfil-agentes.md > Reglas de capa`, regla 2). `ports/whatsapp-send-config.ts` expone solo
`maxRetries(): number` al dominio; la composición lo cablea **diferido**, como `processingConfig`.

### 5.3 `WhatsappSendQueueRepository` y `persistence/whatsapp-send-queue-prisma.ts`

```ts
export type NewQueuedMessage = {
  connectionId; contactId; body: string; templateName: string; templateLanguage: string;
  payload: Record<string, unknown>; templateComponents: readonly unknown[];
};
export type ClaimedMessage = {
  id; connectionId; contactId; templateName: string; templateLanguage: string;
  templateComponents: readonly unknown[]; attempts: number;
};

export interface WhatsappSendQueueRepository {
  insertQueued(row: NewQueuedMessage, scope): Promise<{ id: string }>;
  recordPublished(id: string, queueMessageId: string, scope): Promise<void>;
  claim(id: string, maxAttempts: number, scope): Promise<ClaimedMessage | null>;
  release(id: string, scope): Promise<void>;
  listStaleQueued(before: Date, maxAttempts: number, limit: number, scope): Promise<readonly string[]>;
  failExhausted(maxAttempts: number, reason: string, scope): Promise<number>;
  failStaleQueued(before: Date, reason: string, scope): Promise<number>;
  failStuckSending(before: Date, reason: string, scope): Promise<number>;
}
```

- `insertQueued`: `direction OUT`, `status QUEUED`, `origin SYSTEM`, `sentById null`, `type TEMPLATE`,
  `attempts 0`, `metaTimestamp null`, columnas de empresa con `companyScopeColumns(scope)`.
- `claim` (R17, D2): **una** sentencia, para que dos entregas simultáneas no puedan ganar las dos:

  ```sql
  UPDATE "whatsapp_messages"
     SET "status" = 'SENDING', "attempts" = "attempts" + 1, "updated_at" = now()
   WHERE "id" = $id AND "company_id" = $company AND "origin" = 'SYSTEM'
     AND "status" = 'QUEUED' AND "attempts" < $maxAttempts
  RETURNING "id", "connection_id", "contact_id", "template_name", "template_language",
            "template_components", "attempts";
  ```

  Postgres serializa las dos `UPDATE` sobre la misma fila: la segunda reevalúa el `WHERE` tras el
  `COMMIT` de la primera y no encuentra `QUEUED`. Cero filas ⇒ `null`.
- `release`: `UPDATE … SET status 'QUEUED', updated_at now() WHERE id, company, origin SYSTEM, status
  'SENDING'`.
- `recordPublished`: `queue_message_id` y `updated_at = now()`, solo si sigue `QUEUED`.
- `fail*`: `updateMany`/`UPDATE` con ámbito, `origin = 'SYSTEM'`, el estado de origen en el `WHERE`, y
  `status 'FAILED'`, `error_code null`, `error_reason`. Devuelven la cuenta.
- Todas declaran `scope: IntegracionesScope` y lo llevan a `whatsappMessageCompanyScope` o
  `companyScopeColumns` (ya existen): el puerto entra en el barrido de
  `guard-ambito-empresa-integraciones.test.ts` **sin exención** (R36).

`markSent`, `markFailed`, `findContact`, `touchContact`, `findContactsByWaIds`, `ensureContact` y
`linkContact` son los de `WhatsappOutboxRepository` (QC-240), sin cambios: `markSent`/`markFailed` ya
exigen `SENDING` en su `WHERE`, que es lo que necesita el consumidor.

### 5.4 Log (`ports/whatsapp-queue-log.ts`)

`{ info, warn, error }(mensaje, campos?)`, la forma de `DocumentJobLog`; la composición lo cablea con
`forModule('integraciones')` (`pino`, ya aprobada). Eventos: `whatsapp_enqueue_skipped`,
`whatsapp_enqueue_failed`, `whatsapp_enqueue_publish_failed`, `whatsapp_sweep_publish_failed`,
`whatsapp_sweep_company_failed`, `whatsapp_send_job_crashed`. Los fallos de Meta siguen yendo a
`WhatsappSendLog` (`whatsapp_send_failed`, QC-240).

### 5.5 Composición

En el bloque de WhatsApp de `integraciones`, sin reordenar:

```ts
const whatsappSendQueueRepository = createWhatsappSendQueueRepository();
const whatsappSendQueue: WhatsappSendQueue = whatsappSendQueueQstash;
const whatsappQueueSignature: WhatsappQueueSignature = whatsappQueueSignatureQstash;
const whatsappSendConfig: WhatsappSendConfig = { maxRetries: () => readWhatsappSendMaxRetries() };
const whatsappQueueLog: WhatsappQueueLog = forModule('integraciones');
// en `integraciones`:
whatsappNotifier: createWhatsappNotifier({...}),
whatsappQueueSignature,
processWhatsappSend: createProcessWhatsappSend({...}),
sweepWhatsappSends: createSweepWhatsappSends({ ..., listCompanyIds: listActiveCompanyIds }),
```

Con `INTEGRATIONS_E2E_DOUBLES` puesta, `publish` no llama a QStash: devuelve un id fijo
(`e2e-<messageId>`) sin red, igual que el resto de dobles de `integraciones`. No hay E2E en esta
ficha; el doble evita que un E2E futuro que entregue un pedido dependa de QStash.

---

## 6. Rutas fuera de sesión (R41)

`tests/guards/guard-rutas-fuera-de-sesion.test.ts > RUTAS_FUERA_DE_SESION` gana:

| Ruta | Clasificación | Prueba |
|---|---|---|
| `app/api/integraciones/whatsapp/envios/route.ts` | `anadido: 'integraciones'` | `tests/unit/integraciones/whatsapp/queue/process-whatsapp-send.test.ts` |
| `app/api/cron/barrer-envios-whatsapp/route.ts` | `anadido: 'integraciones'` | `tests/unit/integraciones/whatsapp/queue/sweep-whatsapp-sends.test.ts` |

`lib/shared/routes.ts`: `WHATSAPP_SEND_ROUTE = '/api/integraciones/whatsapp/envios'`, junto a
`WHATSAPP_WEBHOOK_ROUTE_BASE`.

---

## 7. Motivos en español (D11, aceptados 2026-11-11)

| Constante | Texto |
|---|---|
| `SENDING_STUCK_REASON` | «No se pudo confirmar si el mensaje llegó. Revisa con el cliente antes de volver a enviarlo.» |
| `RETRIES_EXHAUSTED_REASON` | «No se pudo enviar después de varios intentos.» |
| `NOT_DELIVERABLE_REASON` | «No se envió: la conexión de WhatsApp no estaba activa o el contacto no estaba disponible.» |

Los de Meta son los de `sendFailureOf` (QC-240). Todos caben en el recorte de 500 de QC-238. Los
textos se fijan en un test.

---

## 8. Concurrencia y límites conocidos

- **Entrega doble** (D2): resuelta por el `UPDATE … WHERE status = 'QUEUED'` de §5.3.
- **Republicación mientras QStash aún reintenta**: el barrido republica un `QUEUED` de más de 5 min
  aunque QStash tenga un reintento pendiente con espera larga. Las dos entregas compiten por el
  reclamo y solo una envía; el tope de intentos acota el total.
- **Meta acepta pero `markSent` no llega a escribirse** (la base cae): el mensaje queda `SENDING` y
  el barrido lo pasa a `FAILED` en su primera pasada tras los 10 min aunque se entregó. Es lo que
  elige D4.
- **Latencia del barrido (D7, consecuencia aceptada).** El barrido corre cada hora, así que todo lo
  que depende de él tarda hasta ~1 h más que su umbral: un `QUEUED` cuya publicación inicial falló
  (R11) sale entre 5 min y ~1 h 5 min después; un `SENDING` atascado y un `QUEUED` con los
  intentos agotados quedan visibles como `FAILED` con el mismo retraso. Los reintentos de QStash ante
  errores temporales no dependen del barrido y no se ven afectados.
- **Status de Meta antes del `wamid`**: igual que QC-240 §9; el status se pierde y el mensaje queda
  `SENT` por el paso 5.
- **`2xx` sin `wamid` o tiempo agotado**: se reintenta (temporal) y puede duplicar si Meta sí lo
  recibió; mismo riesgo que acepta QC-240 P6.

---

## 9. Guardia de `@upstash/qstash` (R38, D12)

`tests/guards/guard-qstash-aislado.test.ts`, forma de `guard-envio-de-correo.test.ts`:

- Censo de `lib/`, `app/`, `components/`, `scripts/` (fuentes `.ts`/`.tsx`/`.mjs`).
- Importadores = **exactamente** `lib/modules/documentos/adapters/driven/queue/processing-queue-qstash.ts`,
  `lib/modules/documentos/adapters/driven/queue/queue-signature-qstash.ts`,
  `lib/modules/integraciones/adapters/driven/queue/whatsapp-send-queue-qstash.ts` y
  `lib/modules/integraciones/adapters/driven/queue/whatsapp-queue-signature-qstash.ts`.
- Caso de sensibilidad: un importador ficticio en el censo da hallazgo; `import`, `import type`,
  `require` y `import()` se detectan.
- `domain/` y `ports/` de `integraciones` no importan `@upstash/qstash`, `next/*` ni
  `@prisma/client` (ya lo cubre `guard-arquitectura-modulos`; la guardia nueva solo cuenta
  importadores).

`docs/dependencias.md > @upstash/qstash`: la nota pasa de «Aislada en dos archivos» a cuatro, con la
fecha y la ficha. Los comentarios de cabecera de los dos adaptadores de `documentos` («Unico archivo
del repositorio, junto a…») se corrigen: hoy serían falsos.

---

## 10. Tests

Mapa `R<n> → test` en `tasks.md`.

### 10.1 Nuevos

| Archivo | Cubre |
|---|---|
| `tests/unit/integraciones/whatsapp/queue/enqueue-whatsapp-message.test.ts` | R1–R13 con puertos dobles: cada omisión sin escrituras ni `publish`; mensaje `QUEUED`/`SYSTEM`/sin autor con componentes; `publish` que lanza; base que lanza ⇒ no rechaza; log sin valores |
| `tests/unit/integraciones/whatsapp/queue/process-whatsapp-send.test.ts` | R16–R24, R26: reclamo nulo ⇒ `done` sin Meta; R19 en sus cuatro causas; éxito; 5xx/red/130429/131056 ⇒ `release` + `requeue`; 4xx ⇒ `FAILED`; `190` ⇒ conexión `ERROR`; `markSent` nulo ⇒ `done`; añadido |
| `tests/unit/integraciones/whatsapp/queue/sweep-whatsapp-sends.test.ts` | R28–R34: orden de los pasos, atascado sin `publish`, agotados, republicación con `recordPublished`, `publish` que lanza sigue, empresa que falla no detiene, añadido apagado |
| `tests/unit/integraciones/whatsapp/queue/whatsapp-send-retry-policy.test.ts` | Clasificación temporal/permanente (R22, R23), `maxAttemptsOf`, textos de §7 |
| `tests/unit/integraciones/whatsapp/queue/whatsapp-send-route.test.ts` | R14, R15, R18 (200), R22 (500), R23 (200), R24: firma antes que el cuerpo; sin sesión |
| `tests/unit/integraciones/whatsapp/queue/whatsapp-send-sweep-cron-route.test.ts` | R27, R28 |
| `tests/unit/integraciones/whatsapp/queue/whatsapp-send-queue-qstash.test.ts` | `publishJSON` con URL, cuerpo y `retries` (R10, R25); config leída al llamar; `vi.mock('@upstash/qstash')` |
| `tests/unit/integraciones/whatsapp/queue/whatsapp-queue-signature-qstash.test.ts` | R14: firma ausente, `verify` que lanza ⇒ `false`; `vi.mock` |
| `tests/unit/integraciones/whatsapp/queue/whatsapp-send-config-env.test.ts` | R25: defecto, inválida nombra la variable sin valor, faltan QSTASH_* / `APP_BASE_URL` |
| `tests/unit/integraciones/whatsapp/queue/whatsapp-send-schedule.test.ts` | R35: `vercel.json` declara la ruta del barrido con `schedule` `0 * * * *` y existe su `route.ts` |
| `tests/integration/integraciones/whatsapp-send-queue-prisma.int.test.ts` | Adaptador: ámbito (R36), reclamo concurrente ⇒ una fila (R18), tope de intentos, `release`, los tres `fail*` solo `SYSTEM` (R33), `updated_at` renovado |
| `tests/integration/integraciones/whatsapp-system-send-flow.int.test.ts` | Composición real con cola y Graph dobles: `enqueue` → consumidor → `SENT` (R8, R9 concurrente, R21); status `delivered` por webhook (R37); trabajo con otra empresa ⇒ sin efecto (R36) |
| `tests/integration/integraciones/whatsapp-system-send-migration.int.test.ts` | R40: down y up dejan el mismo esquema; el índice existe |
| `tests/guards/guard-qstash-aislado.test.ts` | R38 |

### 10.2 Tests y guardias que se tensan (nunca se relajan)

| Archivo | Cambio |
|---|---|
| `tests/guards/guard-rutas-fuera-de-sesion.test.ts` | + dos rutas (R41) |
| `tests/guards/guard-ambito-empresa-integraciones.test.ts` | + puerto `WhatsappSendQueueRepository` (8 métodos) en el barrido, sin exención |
| `tests/unit/integraciones/module-shape.test.ts` | archivos, contrato, cableado, importadores |
| `tests/unit/integraciones/whatsapp/whatsapp-doubles.ts` | + dobles de la cola, la firma y el repositorio |
| `tests/unit/integraciones/whatsapp/send/send-whatsapp-message.test.ts` | `RecipientContext.actorId` admite `null` sin cambiar el comportamiento de usuario |
| `tests/integration/aislamiento.json` | entradas de los `.int.test.ts` nuevos |

R39 lo cubre `guard-dependencias-aprobadas.test.ts` (sin cambios: `package.json` no cambia).

---

## 11. Alternativas descartadas

1. **Resolver la plantilla otra vez en el consumidor** (guardar solo los valores, como el reintento de
   QC-240, A5). Ahorra la columna, pero el texto guardado podría no coincidir con lo enviado si una
   variable propia cambia entre encolar y enviar, y el consumidor necesitaría plantillas y diccionario.
   Con los parámetros guardados, el consumidor envía exactamente lo encolado.
2. **Guardar los parámetros de Meta dentro de `payload`** (bajo una clave reservada). Sin migración,
   pero mezcla dos formas en el mismo JSON y una clave propia del diccionario podría chocar con la
   reservada.
3. **Mandar solo el id del mensaje en el trabajo** y resolver la empresa con una consulta sin ámbito
   (como el directorio del webhook, QC-238). Obliga a una tercera exención en la guardia de ámbito. La
   empresa ya viaja firmada, así que no aporta nada.
4. **Usar el identificador de entrega de QStash como candado** (como `document-job-route.ts`). La
   ficha fija el reclamo por estado (D2), que además cubre la republicación del barrido, que llega con
   otro identificador.
5. **Reutilizar `insertSending` y `deliver` de QC-240.** `deliver` inserta y envía en la misma
   llamada y exige autor; la cola separa esos dos momentos.
6. **Ampliar `WhatsappOutboxRepository`** con las operaciones de la cola. Cambiaría un puerto
   aprobado y su lista exacta en la guardia de ámbito; uno nuevo deja intacto lo de QC-240.
7. **Variable nueva para la URL de la cola** (`WHATSAPP_SEND_QSTASH_URL`). Es una variable más por
   entorno para un dato que ya se deriva de `APP_BASE_URL` (D13).

---

## 12. Dependencias de terceros

**Ninguna nueva** (R39). `@upstash/qstash` ya está aprobada (2026-09-18); esta ficha solo amplía sus
importadores (§9). `pino` y `zod`, ya aprobadas. `package.json` no cambia.

## 13. Variables de entorno

- **Nueva:** `WHATSAPP_SEND_MAX_RETRIES` (opcional; defecto `3`, D6), documentada en `.env.example`.
- **Reutilizadas:** `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`,
  `APP_BASE_URL`, `CRON_SECRET`, las de cifrado (QC-234) y `WHATSAPP_GRAPH_API_VERSION` (QC-237).
