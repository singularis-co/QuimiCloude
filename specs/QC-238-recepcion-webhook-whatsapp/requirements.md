# QC-238 — recepcion-webhook-whatsapp · requirements.md

> Zona: backend · Complejidad: medium · Épica: QC-220 «Integraciones» · depends_on: QC-237 (done) ·
> Bloquea a: QC-239, QC-242 · Rama: feature/QC-238-recepcion-webhook-whatsapp
>
> **Alcance** (ficha de Jira QC-238). La app recibe los webhooks de Meta de cada conexión y los
> guarda en una sola transacción, sin cola: si guardar falla se responde error y Meta reintenta solo.
> Todavía no sabe a qué cliente pertenece cada número: eso lo agrega la ficha de vinculación.
>
> - **Verificación (GET)** `/api/integraciones/whatsapp/webhook/[conexionId]`: con `hub.mode=subscribe`
>   y el `hub.verify_token` que coincide con el hash (comparación en tiempo constante, QC-234),
>   responde `hub.challenge` en texto plano y la conexión pasa de `pending` a `active`. Token
>   incorrecto o conexión inexistente: `403`.
> - **Recepción (POST)**, misma ruta:
>   1. Conexión inexistente o `disabled`: `200` sin procesar y una línea de log.
>   2. Firma `X-Hub-Signature-256` (HMAC-SHA256 del body crudo con el `app_secret` descifrado,
>      tiempo constante). Inválida: `401` sin body.
>   3. Parsea `entry[].changes[].value`. Un `metadata.phone_number_id` que no sea el de la conexión
>      se ignora.
>   4. **Una transacción:** upsert del contacto por `(connectionId, waId)` (nombre de perfil,
>      `lastInboundAt`, `lastMessageAt`); `INSERT` del mensaje `ON CONFLICT (wamid) DO NOTHING`;
>      update de statuses por `wamid` sin retroceder (`read` no vuelve a `delivered`; un `wamid`
>      desconocido se ignora); `lastWebhookAt` de la conexión.
>   5. `200`. Si la transacción falla: `500`.
>   - Un tipo desconocido se guarda como `type=unsupported` con el payload y responde `200`.
> - **Modelos** (`company_id` y las convenciones del repo):
>   - `WhatsappContact` (`whatsapp_contacts`): `connectionId`, `waId`, `profileName`, `customerId?`
>     (nulo en esta ficha), `lastInboundAt`, `lastMessageAt`. Único `(connectionId, waId)`.
>   - `WhatsappMessage` (`whatsapp_messages`): `connectionId`, `contactId`, `direction` (`in|out`),
>     `wamid` (único), `type`, `body`, `payload` jsonb, `status`, `errorCode`, `errorReason`,
>     `metaTimestamp`, y los campos de salida (`origin`, `sentById`, `templateName`, `attempts`,
>     `queueMessageId`) que llenará la ficha de envío. Índice `(connectionId, contactId, metaTimestamp)`.
> - **Tipos interpretados:** texto, imagen, audio, video, documento, sticker, ubicación, contactos,
>   reacción, respuesta de botón o lista. Los adjuntos se guardan como metadata (`media_id`,
>   `mime_type`, `caption`, `filename`) en `payload`, sin descargar el archivo.
>
> **Lo que NO entra.** Vincular con clientes y la purga (QC-239). Enviar (QC-240, QC-241). Mostrar
> mensajes. Descargar adjuntos. Webhooks de plantillas (QC-242). Respuestas automáticas. Cola.
>
> **Contexto observado** (`progress/features/QC-238.md`): en local, por cloudflared, Meta ya llama a
> `GET /api/integraciones/whatsapp/webhook/{id}?hub.mode=subscribe&hub.challenge=…&hub.verify_token=…`
> y hoy recibe `404` porque la ruta no existe. En el log aparecen también las variantes
> `hub_mode`/`hub_challenge`/`hub_verify_token`; la ruta lee solo las de punto (R8).
>
> Este archivo **no venía sembrado** por `/afinar-feature`. El Alcance y la tabla de decisiones son
> la ficha de Jira QC-238, copiadas sin cambios. Lo que la ficha no resuelve y este spec propone
> está marcado **[P<n>]** y espera la confirmación del humano en `## Preguntas abiertas`.

## Decisiones cerradas (no reabrir)

| # | Decisión | Por qué |
| --- | --- | --- |
| D1 | Guardar en línea, sin cola | Meta reintenta cuando no recibe 200; eso ya cubre "si no se guarda, reintentar". |
| D2 | Idempotencia por `wamid` único | Meta puede reenviar el mismo mensaje. |
| D3 | Firma validada antes de parsear, con el secreto de la conexión de la URL | No se procesa nada que no venga de la app de esa empresa. |
| D4 | `200` para una conexión inexistente o deshabilitada, o un tipo desconocido | Un `500` haría que Meta reintentara sin fin. |
| D5 | Los statuses no retroceden | Meta no garantiza el orden. |

## Requisitos (EARS)

> Entre corchetes: la decisión (**D1**–**D5**), **[A]** si sale del Alcance, **[P<n>]** si es una
> propuesta pendiente de confirmar, o la regla del repo de la que sale.
>
> Vocabulario:
>
> - «la ruta» = `/api/integraciones/whatsapp/webhook/{conexionId}`.
> - «la conexión» = la fila viva (`deleted_at` nulo) de `whatsapp_connections` cuyo `id` es
>   `{conexionId}`. «La empresa» = la `company_id` de esa fila.
> - «conexión inexistente» = `{conexionId}` sin forma de UUID, o sin fila viva con ese `id`.
> - «conexión apagada» = la conexión está `disabled`, o el añadido `integraciones` no está activo en
>   la empresa (QC-277).
> - «POST firmado» = un POST cuya firma pasó R10.
> - «instante de Meta» = el `timestamp` (segundos Unix) que trae cada mensaje o status.

### Ruta y ámbito

**R1.** La ruta DEBE atender `GET` y `POST` sin sesión, sin cookie y sin permiso, y NO DEBE
redirigir al login. [A]

**R2.** El sistema DEBE tomar la empresa de toda operación de la ruta de la conexión identificada
por `{conexionId}`, nunca de la query string, de las cabeceras ni del cuerpo; toda lectura y
escritura de conexiones, contactos y mensajes DEBE filtrar por esa empresa. [A, D3]

**R3.** SI `{conexionId}` no tiene forma de UUID, ENTONCES el sistema DEBE tratarla como conexión
inexistente sin consultar la base. [A, D4]

**R4.** MIENTRAS el añadido `integraciones` no esté activo en la empresa de la conexión, el sistema
DEBE tratar la conexión como apagada (R7 para `GET`, R9 para `POST`). [QC-277 R26, D4, P2]

### Verificación (GET)

**R5.** CUANDO llega un `GET` con `hub.mode` igual a `subscribe`, un `hub.challenge` no vacío y un
`hub.verify_token` cuyo resumen coincide con el `verifyTokenHash` de la conexión, comparado en tiempo
constante, sobre una conexión que existe y no está apagada, el sistema DEBE responder `200` con el
valor de `hub.challenge`, sin modificar, como cuerpo `text/plain`. [A]

**R6.** CUANDO un `GET` cumple R5, el sistema DEBE poner `lastWebhookAt` en el instante de la
petición y, si la conexión está `pending`, dejarla `active`; una conexión `active` sigue `active` y
una en `error` sigue en `error`. Una conexión que pasó a `disabled` mientras llegaba la petición NO
DEBE quedar `active`. [A, QC-237 D12, P4]

**R7.** SI un `GET` trae un `hub.mode` distinto de `subscribe`, le falta `hub.mode`,
`hub.verify_token` o `hub.challenge`, trae un token que no coincide, o va a una conexión inexistente
o apagada, ENTONCES el sistema DEBE responder `403` sin cuerpo y sin modificar ninguna fila.
[A, P4]

**R8.** El sistema DEBE leer los tres parámetros del `GET` solo por sus nombres con punto
(`hub.mode`, `hub.verify_token`, `hub.challenge`); un `GET` que trae solo las variantes con guion
bajo (`hub_mode`, `hub_verify_token`, `hub_challenge`) DEBE responder `403`. [A]

### Recepción (POST): entrada

**R9.** SI un `POST` va a una conexión inexistente o apagada, ENTONCES el sistema DEBE responder
`200` sin cuerpo, sin verificar la firma, sin escribir nada y con una línea de log que dice el
motivo. [A, D4]

**R10.** CUANDO llega un `POST` a una conexión que existe y no está apagada, el sistema DEBE
verificar, antes de interpretar el cuerpo, que la cabecera `X-Hub-Signature-256` es `sha256=`
seguido del HMAC-SHA256 en hexadecimal de los bytes exactos del cuerpo recibido, calculado con el
App Secret descifrado de esa conexión y comparado en tiempo constante. [A, D3]

**R11.** SI la cabecera `X-Hub-Signature-256` falta, no tiene la forma `sha256=<64 hex>` o no
coincide, ENTONCES el sistema DEBE responder `401` sin cuerpo y no escribir nada, `lastWebhookAt`
incluido. [A, D3]

**R12.** SI el App Secret guardado no se puede descifrar, ENTONCES el sistema DEBE responder `500`,
no guardar ningún mensaje y dejar la conexión en `error` con el último error que pide volver a
escribir las credenciales (el de QC-237 R13). [D1, D3, QC-237 R13]

**R13.** SI un POST firmado no es JSON válido o no tiene la forma de una notificación de WhatsApp
Business (`object` y `entry[].changes[]`), ENTONCES el sistema DEBE responder `200` sin escribir
nada y con una línea de log. [D4]

**R14.** El sistema DEBE procesar solo los cambios con `field` igual a `messages`; un cambio de otro
campo DEBE ignorarse sin error y sin impedir que se procesen los demás del mismo `POST`. [A]

**R15.** SI un cambio trae un `metadata.phone_number_id` distinto del `phoneNumberId` de la
conexión, ENTONCES el sistema DEBE ignorar ese cambio, con una línea de log, y procesar los demás
del mismo `POST`. [A, D3]

### Recepción (POST): lo que se guarda

**R16.** CUANDO un POST firmado trae mensajes entrantes, el sistema DEBE crear o actualizar un
contacto por cada `(conexión, wa_id)` remitente, con el nombre de perfil que trae `contacts[]`,
`lastInboundAt` y `lastMessageAt` iguales al instante de Meta más reciente entre el guardado y los
recibidos (nunca retroceden) y `customerId` nulo. [A]

**R17.** CUANDO un POST firmado trae un mensaje entrante, el sistema DEBE guardarlo con
`direction = in`, `status = received`, su `wamid`, su `type`, su `body`, su `payload`, su
`metaTimestamp` (el instante de Meta), el contacto de R16, la conexión y la empresa; los campos de
salida (`origin`, `sentById`, `templateName`, `attempts`, `queueMessageId`, `errorCode`,
`errorReason`) DEBEN quedar nulos. [A]

**R18.** SI un mensaje entrante trae un `wamid` que ya está guardado, ENTONCES el sistema NO DEBE
crear otra fila ni modificar la existente, y el `POST` DEBE terminar igual que si fuera nuevo. [D2]

**R19.** El sistema DEBE interpretar los tipos texto, imagen, audio, video, documento, sticker,
ubicación, contactos, reacción, respuesta de botón y respuesta interactiva de botón o de lista,
guardando en `body` y `payload` lo que fija `design.md > 4.3` para cada uno; de los adjuntos DEBE
guardar solo `media_id`, `mime_type`, `caption` y `filename` (los que vengan) y NO DEBE descargar
el archivo. [A]

**R20.** SI un mensaje entrante es de un tipo que no está en R19, o de un tipo de R19 cuyo contenido
no tiene la forma esperada, ENTONCES el sistema DEBE guardarlo con `type = unsupported`, `body`
nulo y el mensaje tal como llegó en `payload`, y responder `200`. [A, D4]

**R21.** CUANDO un POST firmado trae un status (`sent`, `delivered`, `read` o `failed`) de un
`wamid` guardado en la conexión, el sistema DEBE actualizar el `status` del mensaje solo si eso lo
hace avanzar en el orden de `design.md > 4.4` (`queued`/`sending` → `sent` → `delivered` → `read`,
y `failed` solo desde `queued`, `sending` o `sent`); un status que retrocede o que llega a un mensaje
`failed` NO DEBE cambiar nada. Con `failed`, DEBE guardar `errorCode` y `errorReason` del primer
error que trae. [D5, P3]

**R22.** SI un status trae un `wamid` que no está guardado en la conexión, o un valor de status
fuera de los cuatro de R21, ENTONCES el sistema DEBE ignorarlo sin error. [A, D5]

### Recepción (POST): transacción y respuesta

**R23.** El sistema DEBE guardar todo lo de un POST firmado (contactos, mensajes y statuses de todos
sus `entry` y `changes`) y el `lastWebhookAt` de la conexión en una sola transacción; SI algo de
ella falla, ENTONCES no DEBE quedar escrito nada de ese `POST` y el sistema DEBE responder `500` con
una línea de log de error. [D1]

**R24.** CUANDO la transacción de un POST firmado termina bien, el sistema DEBE responder `200` sin
cuerpo y dejar `lastWebhookAt` en el instante de la petición, también si el `POST` no traía nada que
guardar. El estado de la conexión NO DEBE cambiar. [A, P4]

**R25.** CUANDO Meta reenvía un `POST` después de un `500` o de un `200`, el resultado en la base
DEBE ser el mismo que el de un único envío correcto: una sola fila por `wamid`, un solo contacto
por `(conexión, wa_id)`. [D1, D2]

**R26.** El tratamiento de un `GET` o un `POST` NO DEBE llamar a ningún servicio externo (Graph,
descarga de adjuntos) ni encolar trabajo. [D1, A]

**R27.** Ninguna línea de log de la ruta DEBE contener el cuerpo recibido, el verify token, el App
Secret, la firma, un `wa_id` ni el texto de un mensaje. [QC-237 D4]

### Modelo de datos

**R28.** El sistema DEBE guardar los contactos en `whatsapp_contacts` con `company_id` obligatorio,
único `(connection_id, wa_id)`, `customer_id` opcional, RLS activada y forzada, y una migración con
su `down.sql` que la revierte. [A]

**R29.** El sistema DEBE guardar los mensajes en `whatsapp_messages` con `company_id` obligatorio,
`wamid` único, índice `(connection_id, contact_id, meta_timestamp)`, los campos de salida de la
ficha, RLS activada y forzada, en la misma migración de R28. [A]

**R30.** La base DEBE rechazar un contacto o un mensaje cuya empresa no sea la de su conexión, y un
mensaje cuya empresa o conexión no sean las de su contacto. [A, R2]

### Clasificación y límites

**R31.** La ruta DEBE quedar clasificada como ruta del añadido `integraciones` en la guardia de
rutas fuera de sesión, con una prueba que demuestra que comprueba el añadido antes de actuar.
[QC-277 R26]

**R32.** La única consulta del sistema que lee `whatsapp_connections` sin el ámbito de una empresa
DEBE ser la que resuelve la empresa de `{conexionId}`, y DEBE devolver solo la `company_id` de una
fila viva. [R2, P1]

**R33.** Esta ficha NO DEBE añadir dependencias a `package.json`, permisos, entradas de menú,
variables de entorno ni códigos al catálogo de errores. [A]

## Preguntas abiertas

Cada una trae la propuesta que ya está escrita en los requisitos. Si el humano aprueba el spec sin
cambiarlas, quedan cerradas como están.

- **P1 — Una consulta sin ámbito de empresa (R32).** La URL solo trae el id de la conexión, así que
  algo tiene que averiguar de qué empresa es antes de poder filtrar (QC-237 `design.md > 13` lo dejó
  a este spec). `guard-ambito-empresa-integraciones` hoy prohíbe toda excepción y la de `pedidos`
  dice que una excepción «la aprueba un humano en un spec». **Propuesta:** una sola función, en su
  propio archivo, que devuelve solo `company_id` de una fila viva (ni secretos ni estado); todo lo
  demás se lee después con el ámbito de esa empresa. La guardia gana esa única exención, con su
  motivo y con la forma exacta vigilada (`design.md > 5.1`). ¿Se aprueba?
- **P2 — Añadido `integraciones` apagado (R4).** La ficha no lo dice, pero QC-277 R26 obliga a la
  ruta a comprobarlo. **Propuesta:** tratarlo como una conexión `disabled`: `GET` → `403`, `POST` →
  `200` sin guardar. Consecuencia: los mensajes que lleguen con el añadido apagado se pierden (Meta
  no reintenta un `200`), coherente con QC-277 D6 («al apagar, se descarta lo pendiente»). ¿Vale, o
  se prefiere guardarlos y no mostrarlos?
- **P3 — `failed` frente a `delivered`/`read` (R21).** Meta no garantiza el orden. **Propuesta:**
  `failed` es final (nada lo saca de ahí, como en QC-240 y QC-241, donde reintentar crea otro
  mensaje) y no pisa un `delivered` ni un `read` ya guardados. ¿O debe ganar la prueba de entrega
  cuando llega `delivered` después de `failed`?
- **P4 — Estados que la ficha no nombra (R6, R7, R24).** **Propuesta:** el `GET` sobre una conexión
  `disabled` responde `403` (la ficha solo nombra la inexistente) y no la toca; el `GET` correcto
  sobre una conexión en `error` pone `lastWebhookAt` pero la deja en `error` (lo que falló es la
  prueba contra Graph, que el handshake no arregla; la siguiente prueba buena la deja `active` por
  QC-237 D12); el `POST` no cambia nunca el estado, solo `lastWebhookAt`. ¿Vale?
