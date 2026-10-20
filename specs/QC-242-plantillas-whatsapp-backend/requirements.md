# QC-242 — plantillas-whatsapp-backend · requirements.md

> Zona: backend · Complejidad: medium · Épica: QC-220 «Integraciones» · depends_on: QC-237 (done),
> QC-238 (done) · Bloquea a: QC-243, QC-245, QC-247 · Rama: feature/QC-242-plantillas-whatsapp-backend
>
> **Alcance** (ficha de Jira QC-242, copiada sin cambios de fondo). El Administrador puede crear
> plantillas de mensaje en Meta desde la app, ver su estado de aprobación y eliminarlas. La app guarda
> una copia local que se mantiene al día por webhook y por sincronización (automática y manual). Esta
> ficha es solo backend: casos de uso, modelo, webhook, cron y los Server Actions que consume la
> pantalla.
>
> - **Modelo** `WhatsappTemplate` (`whatsapp_templates`), con `company_id` y las convenciones del
>   repo: `connectionId`, `metaTemplateId`, `name`, `language`, `category`
>   (`MARKETING|UTILITY|AUTHENTICATION`), `components` jsonb, `status`
>   (`PENDING|APPROVED|REJECTED|PAUSED|DISABLED`, más `OTHER` con el valor crudo para lo que Meta
>   agregue), `rejectedReason`, `lastSyncedAt`, `createdById`, timestamps y `deletedAt`. Único
>   `(connectionId, name, language)`.
> - Permiso: `integraciones.modificar` (solo el Administrador), igual que la conexión.
> - **Crear** (`POST /{waba_id}/message_templates`): nombre en minúsculas, números y `_`; idioma de la
>   lista de códigos de Meta (la fija este spec); header de texto opcional con como mucho una variable;
>   body obligatorio con variables posicionales `{{1}}…{{n}}` y un ejemplo obligatorio por variable;
>   footer opcional; botones de respuesta rápida, URL y teléfono. Los límites de Meta se validan antes
>   de llamar, con reglas del dominio que son las mismas que usa la pantalla. Nace `PENDING`; si Meta
>   cambia la categoría al responder, se guarda la de Meta. Errores de Meta (nombre repetido,
>   contenido rechazado, límite de creaciones por hora) traducidos al español.
> - **Sincronizar** (Meta → app, nunca al revés): `GET /{waba_id}/message_templates` paginado; crea o
>   actualiza por `metaTemplateId`, importa las creadas fuera de la app y deja con `deletedAt` las que
>   ya no existen en Meta. Devuelve importadas, actualizadas y eliminadas. Se dispara al crear la
>   conexión (si falla, la conexión se crea igual), una vez al día por cron (`CRON_SECRET`, conexiones
>   `active`, de una en una) y a mano desde la pantalla.
> - **Eliminar** una plantilla en un idioma (`DELETE` con `hsm_id` y `name`). Queda con `deletedAt`.
> - **Listar y consultar**, con filtro «solo aprobadas».
> - **Server Actions** en `lib/modules/integraciones/adapters/driving/`: listar, crear, sincronizar y
>   eliminar, con el contrato `{status:'success',data} | ErrorState`.
> - **Webhook:** la recepción de QC-238 gana `message_template_status_update` y
>   `template_category_update`; una plantilla desconocida dispara una sincronización de esa conexión.
> - La guía de la pestaña Conexión agrega que hay que suscribir esos dos campos además de `messages`.
>
> **Lo que NO entra.** UI (QC-243). Headers con imagen, video o documento. Variables con nombre
> (`NAMED`). Plantillas de autenticación con código (OTP). Editar una plantilla existente. Validar los
> parámetros de un envío contra el catálogo (ficha de Contactos). La deuda D77 de
> `progress/deudas.md` (mensaje «veneno» del webhook) es contexto: esta ficha no la resuelve, pero
> tampoco añade un caso nuevo de ella (R41).
>
> Este archivo **no venía sembrado** por `/afinar-feature`. El Alcance y la tabla de decisiones son la
> ficha de Jira. Lo que la ficha deja al spec, o que el spec propone y la ficha no resuelve, va marcado
> **[P<n>]**; el humano aprobó P1–P9 como las propuso el spec el 2026-10-20 (ver «Decisiones
> cerradas»). Los datos de Meta que no se pueden confirmar con documentación del repo siguen marcados
> **[POR CONFIRMAR]** (P2, P4 y el límite de crons de P9).

## Decisiones cerradas (no reabrir)

| # | Decisión | Por qué | Cubierta por |
| --- | --- | --- | --- |
| D1 | Copia local + webhook + sincronización | La UI no consulta a Meta en cada carga, y la sincronización corrige lo que el webhook no cubre. | R16, R22–R27, R36–R40, R44 |
| D2 | Solo el Administrador (`integraciones.modificar`) | Las plantillas son parte de la configuración de la integración. | R5 |
| D3 | Header solo de texto en fase 1 | Los headers con archivo necesitan otra API de subida; se agregan sin cambiar el modelo. | R11, R46 |
| D4 | Eliminar por `hsm_id` | Borrar solo por nombre eliminaría todos los idiomas. | R42 |
| D5 | Estado `OTHER` con el valor crudo | Meta agrega estados nuevos; no se pierde información ni falla el parser. | R4 |
| D6 | Sincronización automática (al conectar y diaria) más botón manual (decisión del humano) | Nadie tiene que acordarse de sincronizar; el botón queda para ver al instante un cambio hecho en WhatsApp Manager. | R28–R35 |
| D7 | Los Server Actions de plantillas van en esta ficha (decisión del humano) | Cada ficha respeta su zona: la pantalla recibe una API lista y queda 100 % frontend. | R47, R48 |
| P1 (2026-10-20) | Único `(connectionId, name, language)` solo entre las vivas (`WHERE deleted_at IS NULL`), más único total `(connectionId, metaTemplateId)`. Aprobado por el humano como propuesta. | Con un único total, una plantilla eliminada bloquearía para siempre ese nombre e idioma. | R2 |
| P2 (2026-10-20) | Límites de Meta de `design.md > 3.3` (nombre 512, body 1024, header y footer 60, botón 25, URL 2000, teléfono `+` y 8–15 dígitos, 10 botones / 2 URL / 1 teléfono, respuestas rápidas agrupadas, variables consecutivas, caracteres por punto de código). Aprobado por el humano como propuesta. **[POR CONFIRMAR]**: el implementer los contrasta con la documentación vigente de Meta antes de T3. | No hay documentación de Meta en el repo. | R7, R10–R13 |
| P3 (2026-10-20) | Lista completa de idiomas de `design.md > 3.2` para crear; la sincronización importa cualquier idioma. Aprobado por el humano como propuesta. | Es la lista pública de Meta; recortarla no aporta seguridad. | R8 |
| P4 (2026-10-20) | Códigos y formas de Meta de `design.md > 4.9, 6 y 7.1` (nombre repetido, límite de creaciones, respuesta de creación, cursor, webhooks de plantillas con `entry[].id` = WABA). Aprobado por el humano como propuesta. **[POR CONFIRMAR]**: el implementer los contrasta con la documentación vigente de Meta antes de T3. | Sin confirmar, un caso no reconocido cae en el rechazo genérico. | R19, R36, R37, R39 |
| P5 (2026-10-20) | Solo se crean `MARKETING` y `UTILITY`; `AUTHENTICATION` se importa por sincronización. Aprobado por el humano como propuesta. | Las de autenticación llevan OTP, fuera de alcance. | R9, R23 |
| P6 (2026-10-20) | Columna `templates_synced_at` en `whatsapp_connections`, puesta por cada sincronización completa. Aprobado por el humano como propuesta. | QC-243 muestra la hora de la última sincronización, también con cero plantillas. | R25, R44 |
| P7 (2026-10-20) | Una plantilla de Meta con categoría desconocida se salta con conteo; no se añade `OTHER` a la categoría. Aprobado por el humano como propuesta. | La ficha fija tres categorías. | R26, R39 |
| P8 (2026-10-20) | La línea nueva de la guía de la pestaña Conexión es un cambio de texto, sin pase `/design`. Aprobado por el humano como propuesta. | No hay componente nuevo ni cambio visual. | R49 |
| P9 (2026-10-20) | Cron diario `0 8 * * *`. Aprobado por el humano como propuesta. **[POR CONFIRMAR]** el límite de crons del plan de Vercel (este es el segundo; QC-241 propone un tercero). | Una hora después de `caducar-pedidos`. | R34 |

## Requisitos (EARS)

Convenciones: «conexión viva» es la conexión de WhatsApp no borrada de la empresa (QC-237 garantiza
como mucho una). «Plantilla viva» es una fila de `whatsapp_templates` sin `deletedAt`. «Sin tocar
Meta ni la base» significa que no se llama al cliente de Graph ni a ningún puerto de persistencia.

### Modelo y ámbito

**R1.** El sistema DEBE guardar cada plantilla con su empresa y su conexión, y la base DEBE rechazar
una plantilla cuya empresa no sea la de su conexión.

**R2.** El sistema NO DEBE admitir dos plantillas vivas con la misma conexión, nombre e idioma, ni dos
plantillas (vivas o eliminadas) con la misma conexión y el mismo `metaTemplateId`. **[P1]**

**R3.** Toda lectura y escritura de plantillas DEBE limitarse a la empresa del actor, o, sin actor
(cron y webhook), a la empresa de la conexión; una plantilla de otra empresa DEBE tratarse igual que
una inexistente.

**R4.** SI Meta informa, por sincronización o por webhook, un estado distinto de `PENDING`,
`APPROVED`, `REJECTED`, `PAUSED` y `DISABLED`, ENTONCES el sistema DEBE guardar el estado `OTHER` con
el valor crudo de Meta; con uno de esos cinco, el valor crudo DEBE quedar vacío.

### Permiso

**R5.** CUANDO se invoca listar, consultar, crear, sincronizar a mano o eliminar plantillas sin el
permiso `integraciones.modificar` o sin empresa en el actor, el sistema DEBE rechazar con
`unauthorized` antes de validar la entrada y sin tocar Meta ni la base.

### Validación del borrador (dominio, compartida con la pantalla)

**R6.** El contrato del módulo DEBE exponer una función pura que valida un borrador de plantilla y
devuelve la lista de problemas por campo, sin dependencias de servidor, y el caso de uso de crear
DEBE aplicar exactamente esa función.

**R7.** SI el nombre está vacío, contiene algo distinto de minúsculas `a-z`, dígitos y `_`, o supera
512 caracteres **[POR CONFIRMAR]**, ENTONCES el borrador DEBE ser inválido.

**R8.** SI el idioma no está en la lista de códigos de `design.md > 3.2` **[POR CONFIRMAR]**, ENTONCES
el borrador DEBE ser inválido.

**R9.** SI la categoría no es `MARKETING` ni `UTILITY`, ENTONCES el borrador DEBE ser inválido
(`AUTHENTICATION` no se crea en esta fase). **[P5]**

**R10.** El body DEBE ser obligatorio y no vacío y tener como mucho 1024 caracteres
**[POR CONFIRMAR]**; SI contiene una marca `{{…}}` que no sea `{{<entero ≥ 1>}}`, SI los números de
variable distintos no son exactamente `1…n`, o SI no hay exactamente un ejemplo no vacío por variable,
ENTONCES el borrador DEBE ser inválido.

**R11.** DONDE el borrador trae header, el header DEBE ser de texto, no vacío, con como mucho 60
caracteres **[POR CONFIRMAR]** y como mucho una variable, que solo puede ser `{{1}}` y DEBE traer un
ejemplo no vacío; un header sin variable NO DEBE traer ejemplo.

**R12.** DONDE el borrador trae footer, el footer DEBE ser no vacío, con como mucho 60 caracteres
**[POR CONFIRMAR]** y sin variables.

**R13.** DONDE el borrador trae botones, cada botón DEBE ser de respuesta rápida, URL o teléfono, con
un texto no vacío de como mucho 25 caracteres **[POR CONFIRMAR]**; un botón URL DEBE traer una URL
`https://` de como mucho 2000 caracteres **[POR CONFIRMAR]** con como mucho una variable `{{1}}` al
final y, si la tiene, un ejemplo que sea una URL `https://`; un botón de teléfono DEBE traer un número
`+` seguido de 8 a 15 dígitos **[POR CONFIRMAR]**; y el borrador NO DEBE superar 10 botones en total,
2 de URL ni 1 de teléfono, ni intercalar respuestas rápidas entre botones de URL o teléfono
**[POR CONFIRMAR]**.

**R14.** SI el borrador es inválido según R7–R13, ENTONCES crear DEBE rechazar con `invalid_input` sin
tocar Meta ni escribir nada.

### Crear

**R15.** SI no hay conexión viva, ENTONCES crear, sincronizar a mano y eliminar DEBEN rechazar con
`whatsapp_connection_not_found`; SI la conexión viva está deshabilitada, ENTONCES DEBEN rechazar con
`action_not_allowed`; en los dos casos sin llamar a Meta.

**R16.** CUANDO el Administrador crea una plantilla con un borrador válido y la conexión viva no está
deshabilitada, el sistema DEBE enviarla a Meta con el Access Token descifrado de la conexión y, si Meta
la acepta, guardarla con el id de Meta, el estado `PENDING`, los componentes enviados, el creador y la
hora, y devolver su vista.

**R17.** SI Meta responde a la creación con una categoría distinta de la pedida, ENTONCES el sistema
DEBE guardar la categoría que asignó Meta.

**R18.** SI ya existe una plantilla viva con el mismo nombre e idioma en la conexión, ENTONCES crear
DEBE rechazar con `whatsapp_template_name_taken` sin llamar a Meta.

**R19.** SI Meta rechaza la creación, ENTONCES el sistema NO DEBE guardar nada y DEBE responder, en
español: `whatsapp_template_name_taken` si el nombre ya existe en ese idioma,
`whatsapp_template_rate_limited` si se alcanzó el límite de creaciones, `whatsapp_template_rejected`
para cualquier otro rechazo, y `whatsapp_meta_unreachable` si Meta no respondió o respondió 5xx. La
forma en que Meta distingue los dos primeros casos es **[POR CONFIRMAR]**.

**R20.** SI el Access Token guardado no se puede descifrar al crear, sincronizar o eliminar, ENTONCES
el sistema DEBE rechazar con `integration_secret_unreadable` sin llamar a Meta y dejar la conexión en
`error` con el aviso de QC-237, salvo que esté deshabilitada.

**R21.** Ninguna respuesta, error ni línea de log de esta ficha DEBE contener el Access Token ni el
App Secret, ni en claro ni cifrados.

### Sincronizar (núcleo común)

**R22.** CUANDO se sincroniza una conexión, el sistema DEBE leer de Meta todas las páginas de su lista
de plantillas antes de escribir nada, y SI falla la lectura de cualquier página o la escritura,
ENTONCES NO DEBE quedar ningún cambio en la base.

**R23.** CUANDO se sincroniza, por cada plantilla que Meta devuelve el sistema DEBE crearla si no
existe en la conexión una fila con su `metaTemplateId` (sin creador), o, si existe, poner al día su
nombre, idioma, estado, valor crudo, categoría, motivo de rechazo y componentes y quitarle el
`deletedAt` si lo tenía; en todas, DEBE anotar la hora de la sincronización.

**R24.** CUANDO se sincroniza, el sistema DEBE marcar con `deletedAt` cada plantilla viva de la
conexión cuyo `metaTemplateId` no esté en la lista de Meta, salvo las creadas después de que empezó
esa sincronización.

**R25.** CUANDO termina una sincronización, el sistema DEBE devolver cuántas plantillas importó,
cuántas actualizó (solo las que cambiaron en algún campo de R23) y cuántas marcó eliminadas, y DEBE
anotar en la conexión la hora de esa sincronización. **[P6]**

**R26.** SI una plantilla de la lista de Meta no trae id, nombre o idioma, o trae una categoría que no
es una de las tres conocidas, ENTONCES el sistema DEBE saltarla, contarla aparte y seguir con las
demás; una plantilla local con ese id NO DEBE marcarse eliminada por ese motivo. **[P7]**

**R27.** La sincronización NO DEBE crear, cambiar ni borrar nada en Meta.

### Disparadores de la sincronización

**R28.** CUANDO el Administrador pide sincronizar, el sistema DEBE sincronizar la conexión viva de su
empresa (R22–R27) y devolver el resumen de R25.

**R29.** CUANDO se crea una conexión con éxito, el sistema DEBE sincronizar sus plantillas con el
Access Token recién validado, antes de devolver el resultado.

**R30.** SI la sincronización de R29 falla, ENTONCES la creación de la conexión DEBE devolver
`created` igual, con la conexión guardada y su verify token, y DEBE quedar una línea de log con el id
de la conexión y el código del fallo.

**R31.** CUANDO se llama a la ruta del cron sin `Authorization: Bearer <CRON_SECRET>` o con un valor
que no casa, el sistema DEBE responder `401`, y SI `CRON_SECRET` no está definida, `500`; en los dos
casos sin leer ninguna empresa, conexión ni plantilla.

**R32.** CUANDO corre el cron con el secreto correcto, el sistema DEBE recorrer las empresas activas
de una en una y sincronizar la conexión viva de cada una que esté `active` y tenga el añadido
`integraciones` activo; NO DEBE sincronizar las conexiones `pending`, `error` ni `disabled`, ni las de
una empresa con el añadido apagado.

**R33.** SI falla la sincronización de una conexión durante el cron, ENTONCES el sistema DEBE seguir
con las demás y, al terminar, responder `500` con el número de conexiones sincronizadas y de fallos y
una línea de log con el id de empresa y el código de cada fallo; sin fallos, `200`.

**R34.** El cron DEBE estar declarado en `vercel.json` con una sola ejecución al día. **[P9]**

**R35.** La ruta del cron DEBE estar clasificada en `tests/guards/guard-rutas-fuera-de-sesion.test.ts`
como ruta del añadido `integraciones`, con la prueba de R32.

### Webhook

**R36.** CUANDO llega, en un `POST` del webhook ya validado por QC-238, un cambio
`message_template_status_update` de la cuenta de WhatsApp Business de la conexión, el sistema DEBE
poner a la plantilla viva de esa conexión con ese `metaTemplateId` el estado recibido (R4), y su
motivo de rechazo si el estado es `REJECTED`, o dejar el motivo vacío con cualquier otro estado.

**R37.** CUANDO llega un cambio `template_category_update` de la cuenta de la conexión, el sistema DEBE
poner a la plantilla viva con ese `metaTemplateId` la categoría nueva.

**R38.** SI un cambio de R36 o R37 nombra un `metaTemplateId` que no corresponde a ninguna plantilla
viva de la conexión, ENTONCES el sistema DEBE sincronizar esa conexión después de responder a Meta,
como mucho una vez por `POST`, y un fallo de esa sincronización NO DEBE cambiar la respuesta.

**R39.** SI un cambio de R36 o R37 viene de otra cuenta de WhatsApp Business, no casa con la forma
esperada **[POR CONFIRMAR]** o trae una categoría desconocida, ENTONCES el sistema DEBE saltarlo con
conteo, sin error y sin impedir que se procesen los demás cambios del mismo `POST`.

**R40.** CUANDO un mismo `POST` trae mensajes y cambios de plantillas, el sistema DEBE procesar los
dos; SI falla guardar los cambios de plantillas, ENTONCES el webhook DEBE responder `500`.

**R41.** SI un cambio de R36 o R37 trae un valor que la base no puede guardar (un texto con
`\u0000`, un id que no es un entero positivo), ENTONCES el sistema DEBE saltarlo con conteo como R39,
sin hacer fallar el `POST`.

### Eliminar

**R42.** CUANDO el Administrador elimina una plantilla viva de su conexión, el sistema DEBE pedir a
Meta que la borre por su `metaTemplateId` (`hsm_id`) y su nombre y, si Meta acepta, marcarla con
`deletedAt`; las plantillas con el mismo nombre en otros idiomas NO DEBEN cambiar ni en Meta ni en la
base.

**R43.** SI Meta rechaza el borrado o no responde, ENTONCES la plantilla NO DEBE cambiar y el sistema
DEBE responder `whatsapp_meta_rejected` o `whatsapp_meta_unreachable`; SI el id no es un UUID, no
existe, es de otra empresa o de otra conexión, o ya está eliminada, ENTONCES DEBE responder
`whatsapp_template_not_found` sin llamar a Meta.

### Listar y consultar

**R44.** CUANDO el Administrador lista las plantillas, el sistema DEBE devolver las plantillas vivas de
la conexión viva de su empresa ordenadas por nombre y luego idioma, y la hora de la última
sincronización de la conexión; SI pide «solo aprobadas», ENTONCES DEBE devolver únicamente las
`APPROVED`; SI no hay conexión viva, ENTONCES DEBE devolver la lista vacía y la hora vacía.

**R45.** CUANDO el Administrador consulta una plantilla por id, el sistema DEBE devolver su vista si es
una plantilla viva de la conexión viva de su empresa, y `whatsapp_template_not_found` en cualquier
otro caso.

**R46.** La vista de una plantilla DEBE traer exactamente id, nombre, idioma, categoría, estado, valor
crudo, motivo de rechazo, contenido, hora de la última sincronización y hora de creación; el contenido
DEBE venir en la forma del borrador cuando todos sus componentes son de los de esta fase, y vacío
cuando no (header con archivo, botones de otro tipo, OTP); la vista NO DEBE traer el id de Meta, la
empresa, la conexión, el creador ni los componentes crudos.

### Server Actions

**R47.** El sistema DEBE ofrecer en `lib/modules/integraciones/adapters/driving/` las acciones de
listar, crear, sincronizar y eliminar plantillas, que responden `{ status: 'success', data }` o el
`ErrorState` del traductor del repo, y las tres de escritura DEBEN revalidar la pantalla de WhatsApp.

**R48.** Las acciones NO DEBEN devolver ningún dato de la conexión distinto de la hora de la última
sincronización de plantillas.

### Guía, datos y despliegue

**R49.** La guía de la pestaña Conexión DEBE incluir un paso que diga que en la app de Meta hay que
suscribir los campos `messages`, `message_template_status_update` y `template_category_update` del
webhook. **[P8]**

**R50.** La tabla de plantillas DEBE tener RLS activada y forzada, y su migración DEBE tener un
`down.sql` que la revierte exactamente.

**R51.** Los códigos de error nuevos de esta ficha DEBEN estar en el catálogo con su texto en español.

**R52.** La ficha NO DEBE añadir dependencias ni variables de entorno.

## Preguntas abiertas

P1–P9 cerradas por el humano el 2026-10-20 (ver «Decisiones cerradas»). Quedan sin confirmar solo
datos de Meta y de la plataforma, que no cambian la propuesta aprobada:

- **[P2] [POR CONFIRMAR]** Límites de Meta: el implementer los contrasta con la documentación vigente
  de Meta antes de T3 y para si alguno cambia un requisito.
- **[P4] [POR CONFIRMAR]** Códigos de error y formas de las respuestas y webhooks de Meta: el
  implementer los contrasta con la documentación vigente de Meta antes de T3 y para si alguno cambia
  un requisito.
- **[P9] [POR CONFIRMAR]** Límite de crons del plan de Vercel del proyecto.
