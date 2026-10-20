# QC-242 — plantillas-whatsapp-backend · requirements.md

> Zona: backend · Complejidad: medium · Épica: QC-220 «Integraciones» · depends_on: QC-237 (done),
> QC-238 (done) · Bloquea a: QC-243, QC-245, QC-247 · Rama: feature/QC-242-plantillas-whatsapp-backend
>
> **Enmienda 2026-10-20 — diccionario de variables (decisión del humano, opción C).** Rango nuevo:
> **R53–R86** y **T22–T35**. R1–R52 y T1–T21 están implementados y mergeados a `dev` (PR #281); la
> enmienda los mantiene salvo R6, R10, R11, R13, R14, R16, R23, R46 y R47, que cambian donde lo dice
> `## Enmienda 2026-10-20` (cada uno lleva su marca). Decisiones del humano E1–E9 cerradas; propuestas
> del spec **[P10]–[P18]**: P10, P11, P13, P14, P16 y P18 aprobadas por el humano el 2026-10-20 (en
> la tabla de decisiones de la enmienda); P12, P15 y P17 retiradas.
>
> **Enmienda 2 — 2026-10-20 (tarde), las constantes las define el front.** Rango nuevo: **R87–R96** y
> **T36–T40**. Reemplaza R53, R55, R56, R60 y R66; cambia R67, R74, R75 y R81 (cada uno lleva su
> marca); reemplaza P10 y retira P11. Decisiones F1–F4 cerradas; propuestas **[P19]–[P22]**
> pendientes.
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
DEBE aplicar exactamente esa función. **[Enmienda 2026-10-20: el borrador público pasa a escribirse
con claves y la función recibe el diccionario de la empresa; ver R66 y R67.]**

**R7.** SI el nombre está vacío, contiene algo distinto de minúsculas `a-z`, dígitos y `_`, o supera
512 caracteres **[POR CONFIRMAR]**, ENTONCES el borrador DEBE ser inválido.

**R8.** SI el idioma no está en la lista de códigos de `design.md > 3.2` **[POR CONFIRMAR]**, ENTONCES
el borrador DEBE ser inválido.

**R9.** SI la categoría no es `MARKETING` ni `UTILITY`, ENTONCES el borrador DEBE ser inválido
(`AUTHENTICATION` no se crea en esta fase). **[P5]**

**R10.** El body DEBE ser obligatorio y no vacío y tener como mucho 1024 caracteres
**[POR CONFIRMAR]**; SI contiene una marca `{{…}}` que no sea `{{<entero ≥ 1>}}`, SI los números de
variable distintos no son exactamente `1…n`, o SI no hay exactamente un ejemplo no vacío por variable,
ENTONCES el borrador DEBE ser inválido. **[Enmienda 2026-10-20: R10, R11 y R13 se aplican al borrador
ya traducido a `{{n}}`, salvo sus reglas sobre los ejemplos, que son las etiquetas del diccionario;
ver R67.]**

**R11.** DONDE el borrador trae header, el header DEBE ser de texto, no vacío, con como mucho 60
caracteres **[POR CONFIRMAR]** y como mucho una variable, que solo puede ser `{{1}}` y DEBE traer un
ejemplo no vacío; un header sin variable NO DEBE traer ejemplo. **[Enmienda 2026-10-20: ver R67.]**

**R12.** DONDE el borrador trae footer, el footer DEBE ser no vacío, con como mucho 60 caracteres
**[POR CONFIRMAR]** y sin variables.

**R13.** DONDE el borrador trae botones, cada botón DEBE ser de respuesta rápida, URL o teléfono, con
un texto no vacío de como mucho 25 caracteres **[POR CONFIRMAR]**; un botón URL DEBE traer una URL
`https://` de como mucho 2000 caracteres **[POR CONFIRMAR]** con como mucho una variable `{{1}}` al
final y, si la tiene, un ejemplo que sea una URL `https://`; un botón de teléfono DEBE traer un número
`+` seguido de 8 a 15 dígitos **[POR CONFIRMAR]**; y el borrador NO DEBE superar 10 botones en total,
2 de URL ni 1 de teléfono, ni intercalar respuestas rápidas entre botones de URL o teléfono
**[POR CONFIRMAR]**. **[Enmienda 2026-10-20: ver R67.]**

**R14.** SI el borrador es inválido según R7–R13, ENTONCES crear DEBE rechazar con `invalid_input` sin
tocar Meta ni escribir nada. **[Enmienda 2026-10-20: también si es inválido según R66–R67.]**

### Crear

**R15.** SI no hay conexión viva, ENTONCES crear, sincronizar a mano y eliminar DEBEN rechazar con
`whatsapp_connection_not_found`; SI la conexión viva está deshabilitada, ENTONCES DEBEN rechazar con
`action_not_allowed`; en los dos casos sin llamar a Meta.

**R16.** CUANDO el Administrador crea una plantilla con un borrador válido y la conexión viva no está
deshabilitada, el sistema DEBE enviarla a Meta con el Access Token descifrado de la conexión y, si Meta
la acepta, guardarla con el id de Meta, el estado `PENDING`, los componentes enviados, el creador y la
hora, y devolver su vista. **[Enmienda 2026-10-20: también la relación de sus variables, su estado del
mapeo y su habilitación; ver R68 y R69.]**

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
`deletedAt` si lo tenía; en todas, DEBE anotar la hora de la sincronización. **[Enmienda 2026-10-20:
la relación de variables, el estado del mapeo y la habilitación de lo importado, revivido o cambiado
siguen R70–R73.]**

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
**[Enmienda 2026-10-20: sin cambio de texto; R82 fija que el filtro no depende del mapeo ni de la
habilitación.]**

**R45.** CUANDO el Administrador consulta una plantilla por id, el sistema DEBE devolver su vista si es
una plantilla viva de la conexión viva de su empresa, y `whatsapp_template_not_found` en cualquier
otro caso.

**R46.** La vista de una plantilla DEBE traer exactamente id, nombre, idioma, categoría, estado, valor
crudo, motivo de rechazo, contenido, hora de la última sincronización y hora de creación; el contenido
DEBE venir en la forma del borrador cuando todos sus componentes son de los de esta fase, y vacío
cuando no (header con archivo, botones de otro tipo, OTP); la vista NO DEBE traer el id de Meta, la
empresa, la conexión, el creador ni los componentes crudos. **[Enmienda 2026-10-20: la lista exacta
de claves de la vista y la forma del contenido cambian; ver R81.]**

### Server Actions

**R47.** El sistema DEBE ofrecer en `lib/modules/integraciones/adapters/driving/` las acciones de
listar, crear, sincronizar y eliminar plantillas, que responden `{ status: 'success', data }` o el
`ErrorState` del traductor del repo, y las tres de escritura DEBEN revalidar la pantalla de WhatsApp.
**[Enmienda 2026-10-20: se suman las acciones de R83.]**

**R48.** Las acciones NO DEBEN devolver ningún dato de la conexión distinto de la hora de la última
sincronización de plantillas.

### Guía, datos y despliegue

**R49.** La guía de la pestaña Conexión DEBE incluir un paso que diga que en la app de Meta hay que
suscribir los campos `messages`, `message_template_status_update` y `template_category_update` del
webhook. **[P8]**

**R50.** La tabla de plantillas DEBE tener RLS activada y forzada, y su migración DEBE tener un
`down.sql` que la revierte exactamente.

**R51.** Los códigos de error nuevos de esta ficha DEBEN estar en el catálogo con su texto en español.

**R52.** La ficha NO DEBE añadir dependencias ni variables de entorno. (Vale también para la
enmienda.)

## Enmienda 2026-10-20 — diccionario de variables (R53–R86)

Decisiones del humano del 2026-10-20: la opción C de las tres que se le presentaron, y sus respuestas
a las preguntas del primer borrador de esta enmienda. Va dentro de QC-242, en la misma rama y con un
segundo PR. Las opciones A (solo un catálogo de claves en código) y B (variables `NAMED` de Meta)
quedan descartadas (`design.md > 18.12`).

| Id | Decisión del humano (no reabrir) | Cubierta por |
| --- | --- | --- |
| E1 | **Diccionario de variables en la base**: cada entrada tiene una clave (identificador, p. ej. `usuario_nombre`) y una etiqueta (lo que ve el usuario, p. ej. «Nombre del cliente»). La pantalla escribe `hola {{usuario_nombre}}`; en Meta queda `{{1}}`; al devolverla, el backend sabe que `1` = `usuario_nombre`. | R53, R56, R60, R66, R67, R81 |
| E2 | **Relación por plantilla**: qué número de cada componente (header, body, botón URL) corresponde a qué clave. Al crear desde la app, el backend traduce `{{clave}}` → `{{n}}`, guarda la relación y toma los ejemplos del diccionario. Al listar o consultar, traduce `{{n}}` → `{{clave}}`. | R64, R66–R69, R74–R76, R81 |
| E3 | **Dos tipos de entrada**: **constantes del sistema** (claves que expone el código, con su resolvedor, p. ej. nombre del cliente o número de pedido; de solo lectura para la empresa) y **variables propias** que crea cada empresa. Las dos se pueden relacionar con un `{{n}}`. | R53–R55, R60, R66, R74 |
| E4 | **Valor de una variable propia**: la variable propia guarda en el diccionario su **valor fijo** (p. ej. `cuenta_numero`, «Número de cuenta», con el número de cuenta), y al enviar se usa ese valor. Las constantes no tienen valor guardado: lo resuelve el código. | R53, R54, R56, R60 |
| E5 | **Estado del mapeo, automático**: «sin relacionar» o «relacionada». Pasa a «relacionada» sola en cuanto todas sus variables quedan relacionadas. Sin variables = «relacionada». Las importadas de Meta (sincronización, importación al conectar, plantilla desconocida por webhook) llegan sin relacionar; las creadas desde la app nacen relacionadas. | R65, R68, R70, R74, R80 |
| E6 | **Al sincronizar, si Meta cambia los componentes** de una plantilla, vuelve a «sin relacionar». | R71 |
| E7 | **Borrar o renombrar una clave** solo si no está en uso por ninguna plantilla viva; con uso, error de dominio en español. | R58, R59 |
| E8 | **Habilitada, manual**: un booleano distinto del estado del mapeo, que el Administrador cambia con habilitar y deshabilitar (Server Action para QC-243, permiso `integraciones.modificar`). Solo se puede habilitar una plantilla «relacionada»; si no, error de dominio en español. | R62, R77, R78, R83 |
| E9 | **Listado**: el filtro por estado de Meta (p. ej. «solo aprobadas») es independiente del estado del mapeo y de la habilitación, y el listado siempre devuelve los dos campos. | R81, R82 |
| E10 | Va como enmienda dentro de QC-242, no como ficha nueva. | (proceso; esta sección) |
| E11 | **Valor inicial de habilitada**: creada desde la app = habilitada. Importada (sincronización, importación al conectar o plantilla desconocida por webhook) = habilitada solo si no trae variables; con variables nace deshabilitada y «sin relacionar». | R68, R70, R86 |
| E12 | **Al volver a «sin relacionar»** porque Meta cambió los componentes, se **deshabilita sola**. | R71, R72 |
| E13 | **Habilitar no exige `APPROVED`.** «Habilitada» es solo un indicador interno de que la plantilla tiene disponible la fuente de los datos de todas sus variables; el estado de Meta va aparte. | R77 |
| E14 | **El valor de una variable propia es obligatorio** y no vacío, con **como mucho 50 caracteres**, fijo (no depende de Meta). 50 cabe en el límite de todos los componentes de esta fase (header 60, body 1024, URL 2000). | R54 |
| E15 | **El ejemplo que se manda a Meta al crear es la etiqueta** de la entrada relacionada, para las constantes y para las variables propias. El usuario no escribe ejemplos y no hay campo de ejemplo aparte. Si la etiqueta excede algún límite de Meta para el ejemplo, la app la deja pasar; si Meta rechaza, se traduce su error como los demás (R19). | R53, R67 |
| P10 (2026-10-20) | **[Reemplazada por F4 / R88.]** Claves de constantes y propias con la misma forma, `^[a-z][a-z0-9_]*$`, de 1 a 40 caracteres; una propia no puede usar la clave de una constante. Quien añada una constante nueva comprueba antes en los datos que ninguna propia usa esa clave. Etiqueta de 1 a 60, sin exigir que sea única. Los 40 y 60 son del spec, no de Meta. Aprobado por el humano como propuesta. | R54, R56, R66 |
| P11 (2026-10-20) | **[Retirada por F1: las constantes las decide el front.]** Lista inicial de constantes: `nombre` («Nombre del cliente», del cliente), `pedido_numero` («Número de pedido», del pedido) y `empresa_nombre` («Nombre de la empresa», `Company.name`). Esta ficha declara el catálogo (clave, etiqueta, de qué dato sale) y lo expone en el contrato; el resolvedor que lee el dato real lo implementa la ficha que envía (QC-245, QC-247). Aprobado por el humano como propuesta. Quedan abiertos los dos datos que el spec no propuso (ver «Preguntas abiertas»). | R53, R55 |
| P13 (2026-10-20) | Etiqueta y valor de una variable propia se pueden modificar aunque esté en uso; el valor nuevo vale desde el siguiente envío. Aprobado por el humano como propuesta. | R57 |
| P14 (2026-10-20) | Quitar una relación a una plantilla habilitada la deja «sin relacionar» y la deshabilita sola, igual que E12. Aprobado por el humano como propuesta. | R72 |
| P16 (2026-10-20) | Una plantilla no relacionable (header con archivo, botones de otro tipo, OTP) queda siempre «sin relacionar», aunque no tenga variables, y nunca se habilita. El sistema no sabe enviar esos componentes. Aprobado por el humano como propuesta. | R64, R65 |
| P18 (2026-10-20) | Desde la app solo se crea con claves; un `{{1}}` en el borrador es inválido. Así toda plantilla creada nace relacionada (E5). Aprobado por el humano como propuesta. | R66 |
| E16 | **[El ejemplo canónico y quién resuelve las constantes cambian: Enmienda 2, F1–F3.]** **Flujo canónico**: a Meta se le envía siempre el texto posicional (`Hola {{1}}`); en el mapeo de la plantilla se guarda `1 = nombre`; `nombre` es una constante del sistema que el código resuelve al enviar con el nombre del cliente (`cliente.name`). Una variable propia (p. ej. `cuenta_numero`) se resuelve con su valor guardado. | R53, R64, R67, R68, R81 |

**Requisitos de R1–R52 que cambian** (el texto original se queda en su sitio con una marca; aquí, qué
cambia):

- **R6**: la función pública valida el borrador **con claves** (R66) y recibe el diccionario de la
  empresa; la regla de Meta en `{{n}}` (R7–R13) sigue existiendo y se aplica al resultado traducido.
- **R10, R11, R13**: se aplican al borrador traducido (R67), salvo sus reglas sobre los ejemplos. El
  borrador público ya no trae ejemplos: son las etiquetas de las entradas (E15), y la app no las
  valida contra los límites de Meta.
- **R14**: un borrador inválido según R66–R67 también rechaza con `invalid_input` sin tocar Meta ni
  escribir.
- **R16**: lo que se guarda incluye la relación de variables, el estado del mapeo y la habilitación
  (R68, R69).
- **R23**: la relación, el estado del mapeo y la habilitación de lo importado, revivido o cambiado
  siguen R70–R72.
- **R44**: sin cambio de texto; R82 fija su independencia del mapeo y de la habilitación.
- **R46**: la vista gana claves y su contenido muestra las claves (R81).
- **R47**: se suman las acciones de R83. R48 se mantiene para todas.

**Ejemplo canónico (E16).** La pantalla escribe `Hola {{nombre}}`. A Meta se le envía `Hola {{1}}`, con
la etiqueta de `nombre` como ejemplo del `{{1}}`. La plantilla guarda el mapeo `body.1 = nombre`. Al
listarla, el contenido vuelve como `Hola {{nombre}}`. Al enviar (QC-245, QC-247, fuera de esta ficha),
`nombre`, que es una constante del sistema, se resuelve con el nombre del cliente; una variable propia
como `cuenta_numero` se resolvería con su valor guardado.

Convenciones de la enmienda: «entrada» es una constante del sistema o una variable propia. «Hueco» es
una posición de variable de una plantilla: la variable del header, cada número distinto del body o la
variable de un botón URL. Una plantilla «relacionable» es una cuyo contenido tiene la forma del
borrador (R46: contenido no vacío). «Estado del mapeo» es «sin relacionar» o «relacionada» (E5);
«habilitada» es el booleano de E8.

### Diccionario de variables

**R53.** **[Reemplazado por R87 y R88 (F1, F4).]** El diccionario de una empresa DEBE estar formado por las **constantes del sistema**,
declaradas en el código con clave, etiqueta y el dato del que sale su valor, iguales para todas las
empresas y sin valor guardado, más las **variables propias** que guarda la empresa con
clave, etiqueta y valor fijo; la base DEBE rechazar dos variables propias con la misma clave en la
misma empresa. **[P11]**

**R54.** El contrato del módulo DEBE exponer una función pura que valida una variable propia y
devuelve sus problemas por campo; SI la clave no empieza por una minúscula `a-z`, contiene algo
distinto de minúsculas `a-z`, dígitos y `_` o supera 40 caracteres, SI la etiqueta está vacía o supera
60 caracteres, o SI el valor falta, está vacío, supera 50 caracteres o contiene `{{` o `}}`, ENTONCES
la variable DEBE ser inválida, y crear o modificar DEBE rechazar con `invalid_input` sin escribir.
**[P10]** (valor: E14)

**R55.** **[Reemplazado por R87 (F1).]** Las constantes del sistema NO DEBEN poder crearse, modificarse ni eliminarse desde la app, y
su vista NO DEBE traer id ni valor.

**R56.** **[Reemplazado por R89 (F1, F4).]** CUANDO el Administrador crea una variable propia válida, el sistema DEBE guardarla en su
empresa y devolver su vista; SI su clave ya está en el diccionario de la empresa (propia o constante),
ENTONCES DEBE rechazar con `whatsapp_variable_key_taken` sin escribir.

**R57.** CUANDO el Administrador modifica la etiqueta o el valor de una variable propia, el sistema DEBE
guardarlos, esté o no en uso. **[P13]**

**R58.** CUANDO el Administrador cambia la clave de una variable propia que no está relacionada con
ningún hueco de una plantilla viva, el sistema DEBE guardarla (con R56 para una clave repetida); SI
está relacionada, ENTONCES DEBE rechazar con `whatsapp_variable_key_in_use` sin escribir nada.

**R59.** CUANDO el Administrador elimina una variable propia que no está relacionada con ningún hueco
de una plantilla viva, el sistema DEBE borrarla; SI lo está, ENTONCES DEBE rechazar con
`whatsapp_variable_key_in_use` sin borrar nada.

**R60.** **[Reemplazado por R90 (F1).]** CUANDO el Administrador lista el diccionario, el sistema DEBE devolver las constantes del
sistema y las variables propias de su empresa ordenadas por clave, cada una con exactamente su tipo
(constante o propia), id, clave, etiqueta, valor y cuántas plantillas vivas la usan.

**R61.** SI al modificar o eliminar una variable propia el id no es un UUID, no existe o es de otra
empresa, ENTONCES el sistema DEBE rechazar con `whatsapp_variable_key_not_found` sin escribir.

**R62.** CUANDO se invoca listar el diccionario, crear, modificar o eliminar una variable propia,
relacionar variables o habilitar o deshabilitar una plantilla sin el permiso `integraciones.modificar`
o sin empresa en el actor, el sistema DEBE rechazar con `unauthorized` antes de validar la entrada y
sin tocar la base.

**R63.** Toda lectura y escritura de variables propias y de relaciones DEBE limitarse a la empresa del
actor; una variable propia de otra empresa DEBE tratarse igual que una inexistente, y la base DEBE
rechazar una relación cuya plantilla o cuya variable propia sea de otra empresa que la relación.

### Huecos y estado del mapeo

**R64.** Los huecos de una plantilla relacionable DEBEN ser: el del header si su texto tiene
variable, uno por cada número distinto del body, y uno por cada botón URL con variable, identificado
por la posición del botón; una plantilla no relacionable NO DEBE tener huecos que se puedan
relacionar.

**R65.** El estado del mapeo de una plantilla DEBE ser «relacionada» si es relacionable y cada uno de
sus huecos tiene relación con una entrada (también cuando no tiene huecos), y «sin relacionar» en
cualquier otro caso; DEBE recalcularse solo, sin acción del usuario, cada vez que cambian sus
relaciones o sus componentes. **[P16]**

### Crear con claves

**R66.** **[Reemplazado por R91 (F2, F4).]** El borrador de creación DEBE escribir las variables como `{{clave}}`, con la clave de una
constante o de una variable propia; SI contiene una marca `{{…}}` cuyo interior no tiene el formato de
una clave (incluido `{{1}}`), ENTONCES el borrador DEBE ser inválido, y SI nombra una clave que no está
en el diccionario de la empresa, ENTONCES DEBE ser inválido con un problema propio de clave
desconocida en ese campo. **[P18]**

**R67.** **[Cambia el ejemplo de las constantes: R92.]** CUANDO se valida o se crea un borrador con claves, el sistema DEBE traducir, en cada
componente por separado, cada clave distinta a `{{n}}` por orden de primera aparición desde 1 (la misma
clave repetida en un componente lleva el mismo número), DEBE tomar como ejemplo de cada `{{n}}` la
etiqueta de su entrada (en un botón URL, la URL con la variable sustituida por esa etiqueta), DEBE
ignorar los ejemplos que traiga el borrador y DEBE aplicar R7–R13 al resultado salvo sus reglas sobre
los ejemplos, devolviendo los problemas en los campos del borrador con claves; un ejemplo así obtenido
NO DEBE rechazarse en la app por ningún límite, y SI Meta lo rechaza, ENTONCES el sistema DEBE
responder como R19. (E15)

**R68.** CUANDO una plantilla creada desde la app se guarda (R16), el sistema DEBE guardar la relación
de cada uno de sus huecos con la entrada de su clave, de modo que quede «relacionada», y DEBE marcarla
habilitada.

**R69.** SI al guardar la creación la sincronización ya había guardado esa plantilla, ENTONCES el
sistema DEBE ponerle la relación de la creación y habilitarla cuando la fila no tiene relaciones y sus
huecos son los mismos que los creados, y NO DEBE cambiar su relación ni su habilitación en otro caso.

### Importar y sincronizar

**R70.** CUANDO la sincronización importa una plantilla (sea manual, diaria, al crear la conexión o por
un id desconocido del webhook) o le quita el `deletedAt` a una eliminada, el sistema DEBE guardarla sin
relaciones y DEBE marcarla habilitada solo si queda «relacionada» sin huecos; con huecos, o no
relacionable, DEBE quedar «sin relacionar» y deshabilitada.

**R71.** CUANDO la sincronización pone al día una plantilla cuyos componentes cambiaron, el sistema DEBE
quitarle todas sus relaciones (con lo que, si tiene huecos, queda «sin relacionar» y R72 la
deshabilita); SI no cambiaron sus componentes, ENTONCES sus relaciones, su estado del mapeo y su
habilitación NO DEBEN cambiar.

**R72.** CUANDO una plantilla habilitada pasa a «sin relacionar», sea por la sincronización o porque el
Administrador le quita una relación, el sistema DEBE deshabilitarla en la misma escritura. **[P14]**

**R73.** CUANDO una plantilla se marca eliminada (al eliminarla o al sincronizar), el sistema DEBE
quitarle sus relaciones y deshabilitarla; los cambios de estado y de categoría que llegan por webhook
(R36, R37) NO DEBEN cambiar sus relaciones, su estado del mapeo ni su habilitación.

### Relacionar las variables de una plantilla

**R74.** **[Cambia cómo se clasifica cada clave: R93.]** CUANDO el Administrador relaciona las variables de una plantilla viva de la conexión viva de
su empresa con una lista de pares hueco → clave (de una constante o de una variable propia), el sistema
DEBE sustituir todas las relaciones de la plantilla por esa lista (un hueco que no viene queda sin
relación), recalcular su estado del mapeo (R65), no llamar a Meta, no exigir que la conexión esté
habilitada y devolver la vista de R81.

**R75.** **[La rama de clave desconocida cambia: R93.]** SI al relacionar la plantilla no es relacionable, ENTONCES el sistema DEBE rechazar con
`whatsapp_template_not_mappable`; SI la lista nombra un hueco que la plantilla no tiene o repite un
hueco, ENTONCES con `invalid_input`; SI nombra una clave que no está en el diccionario de
la empresa, ENTONCES con `whatsapp_variable_key_not_found`; SI la plantilla no cumple R45, ENTONCES con
`whatsapp_template_not_found`; en todos los casos sin escribir.

**R76.** SI entre la lectura y la escritura de relacionar, habilitar o deshabilitar los componentes de
la plantilla cambiaron o la plantilla se marcó eliminada, ENTONCES el sistema DEBE rechazar con
`action_not_allowed` sin escribir.

### Habilitar y deshabilitar

**R77.** CUANDO el Administrador habilita una plantilla viva de la conexión viva de su empresa, el
sistema DEBE marcarla habilitada si está «relacionada», cualquiera que sea su estado en Meta; SI está
«sin relacionar», ENTONCES DEBE rechazar con `whatsapp_template_not_mapped` sin escribir.

**R78.** CUANDO el Administrador deshabilita una plantilla viva de la conexión viva de su empresa, el
sistema DEBE marcarla deshabilitada sin cambiar sus relaciones ni su estado del mapeo.

**R79.** CUANDO una plantilla pasa a «relacionada», el sistema NO DEBE cambiar su habilitación: solo
R68, R69, R70 y R77 habilitan.

**R80.** El sistema NO DEBE dejar habilitada una plantilla «sin relacionar».

### Listar, consultar y vista

**R81.** **[La etiqueta de una constante cambia: R94.]** La vista de una plantilla (R46) DEBE traer además exactamente: su estado del mapeo, si está
habilitada, y la lista de sus huecos, cada uno con su identificador, su número, y el tipo, la clave y
la etiqueta de su entrada (vacíos si no tiene relación); y en el contenido, cada variable de un hueco
relacionado DEBE aparecer como `{{clave}}` y la de uno sin relación como `{{n}}`.

**R82.** El filtro «solo aprobadas» (R44) DEBE devolver todas las plantillas `APPROVED`, cualquiera que
sea su estado del mapeo y su habilitación, y cada plantilla del listado DEBE traer los dos campos.

### Server Actions, datos y errores

**R83.** El sistema DEBE ofrecer en `lib/modules/integraciones/adapters/driving/` las acciones de
listar el diccionario, crear, modificar y eliminar variables propias, relacionar las variables de una
plantilla, y habilitar y deshabilitar una plantilla, con el contrato de R47, y las de escritura DEBEN
revalidar la pantalla de WhatsApp.

**R84.** Las tablas nuevas DEBEN tener la empresa, RLS activada y forzada, y su migración DEBE tener un
`down.sql` que la revierte exactamente.

**R85.** Los códigos de error nuevos de la enmienda DEBEN estar en el catálogo con su texto en
español.

**R86.** CUANDO se aplica la migración, cada plantilla viva que ya existía DEBE quedar sin relaciones,
con el estado del mapeo de R65 y habilitada solo si queda «relacionada» sin huecos (como una
importada, R70).

## Enmienda 2 — 2026-10-20 (tarde): las constantes las define el front (R87–R96)

Decisión del humano posterior a la aprobación de la enmienda. Cambia lo aprobado solo donde lo dice;
el resto de R53–R86 sigue. T22–T25 ya están implementadas sin commit sobre la versión anterior: qué
cambia en cada una está en `tasks.md > Enmienda 2`.

| Id | Decisión del humano (no reabrir) | Cubierta por |
| --- | --- | --- |
| F1 | **Las constantes del sistema las define el front; el back solo almacena.** No hay catálogo de constantes en el backend ni se valida contra uno. Reemplaza la parte de E3 y E16 que decía «el código las resuelve» y retira P11. | R87, R90, R94 |
| F2 | **Al relacionar un `{{n}}`, el back acepta cualquier clave con formato válido**: si coincide con una variable propia de la empresa, es una relación a esa propia; si no, se trata como constante del front. Con todas sus variables con clave, la plantilla queda «relacionada». | R91, R93 |
| F3 | **Al enviar** (QC-245, QC-247): el front manda ya resueltos los valores de las constantes; el back completa las variables propias con su valor guardado. | (frontera: `design.md > 19.6`) |
| F4 | **Formato**: las constantes llevan punto, `entidad.campo` (`cliente.nombre`, `pedido.numero`); las propias no admiten punto, así que nunca chocan. Reemplaza P10. | R88, R89 |

**Ejemplo canónico, corregido (sustituye al de E16).** La pantalla escribe `Hola {{cliente.nombre}}`.
A Meta se le envía `Hola {{1}}`. La plantilla guarda `body.1 = cliente.nombre` (constante: el back no
sabe qué es, solo guarda la clave). Al enviar, el front manda el valor de `cliente.nombre`; una
propia como `{{cuenta_numero}}` la completa el back con su valor guardado.

**R87.** El sistema DEBE guardar como diccionario solo las variables propias de cada empresa (clave,
etiqueta y valor) y NO DEBE tener un catálogo de constantes del sistema ni rechazar una constante por
no estar en uno. (F1)

**R88.** Una clave DEBE ser de una de dos formas: **propia**, una minúscula `a-z` seguida de minúsculas,
dígitos o `_`, de 1 a 40 caracteres y sin punto; o **constante**, dos segmentos de esa misma forma
unidos por un punto (`entidad.campo`), cada segmento de 1 a 40 caracteres; cualquier otra cosa NO
DEBE ser una clave. (F4)

**R89.** SI al crear o modificar una variable propia su clave no tiene la forma propia de R88 (incluida
una con punto), ENTONCES el sistema DEBE rechazar con `invalid_input`; SI otra variable propia de la
empresa ya tiene esa clave, ENTONCES con `whatsapp_variable_key_taken`; en los dos casos sin escribir.

**R90.** CUANDO el Administrador lista el diccionario, el sistema DEBE devolver las variables propias de
su empresa ordenadas por clave, cada una con exactamente id, clave, etiqueta, valor y cuántas plantillas
vivas la usan.

**R91.** El borrador de creación DEBE escribir las variables como `{{clave}}`; SI una marca `{{…}}` no
es una clave de R88 (incluido `{{1}}`), ENTONCES el borrador DEBE ser inválido; una clave con forma de
constante DEBE aceptarse sin consultar ningún catálogo; SI una clave con forma propia no es una
variable propia de la empresa, ENTONCES el borrador DEBE ser inválido con el problema de clave
desconocida en ese campo. **[P19]**

**R92.** CUANDO se crea un borrador que usa constantes, el ejemplo de cada `{{n}}` de una constante
DEBE ser la etiqueta que la petición trae para esa clave, y SI la petición no trae etiqueta para una
constante usada, ENTONCES el borrador DEBE ser inválido en ese campo; el ejemplo de una propia sigue
siendo su etiqueta guardada (E15). **[P20]**

**R93.** CUANDO se relacionan las variables de una plantilla, el sistema DEBE tratar cada clave con
forma de constante como una relación a esa constante y cada clave con forma propia como una relación
a la variable propia de la empresa con esa clave; SI una clave no tiene la forma de R88, ENTONCES DEBE
rechazar con `invalid_input`, y SI una clave con forma propia no es una variable propia de la
empresa, ENTONCES con `whatsapp_variable_key_not_found`, sin escribir. **[P19]** (F2)

**R94.** En la vista (R81), un hueco relacionado con una constante DEBE traer su tipo y su clave, y la
etiqueta vacía. (F1: la etiqueta la conoce el front.)

**R95.** SI el texto de un componente de una plantilla trae una marca `{{…}}` que no es `{{<entero ≥
1>}}` (p. ej. una variable con nombre `{{first_name}}`), ENTONCES la plantilla NO DEBE ser
relacionable (R64), y la migración (R86) DEBE dejarla igual. **[P21]**

**R96.** SI el ejemplo de un botón URL llega de Meta como texto o como lista de textos, ENTONCES el
contenido de la plantilla (R46) DEBE ser el mismo en los dos casos. **[P22]**

## Preguntas abiertas

P1–P9 cerradas por el humano el 2026-10-20 (ver «Decisiones cerradas»). Quedan sin confirmar solo
datos de Meta y de la plataforma, que no cambian la propuesta aprobada:

- **[P2] [POR CONFIRMAR]** Límites de Meta: el implementer los contrasta con la documentación vigente
  de Meta antes de T3 y para si alguno cambia un requisito.
- **[P4] [POR CONFIRMAR]** Códigos de error y formas de las respuestas y webhooks de Meta: el
  implementer los contrasta con la documentación vigente de Meta antes de T3 y para si alguno cambia
  un requisito.
- **[P9] [POR CONFIRMAR]** Límite de crons del plan de Vercel del proyecto.

### De la enmienda 2026-10-20

El humano aprobó la enmienda el 2026-10-20 («aprobado»): P10, P11, P13, P14, P16 y P18 pasan a
«Decisiones cerradas» de la enmienda; P12, P15 y P17 se retiraron antes (E14, E15). Queda abierto:

- **Enmienda 2 (propuestas del spec, pendientes de aprobación):**
  - **[P19] Clave con forma propia que no existe en la empresa** (p. ej. `{{nombre}}` sin variable
    propia `nombre`). F2 dice «si no coincide con una propia, es constante», pero F4 dice que las
    constantes llevan punto. Propuesta: se rechaza (clave desconocida al crear,
    `whatsapp_variable_key_not_found` al relacionar), porque sin punto no puede ser una constante.
    Alternativa: aceptarla como constante, y entonces las constantes también podrían ir sin punto y F4
    dejaría de garantizar que no chocan.
  - **[P20] Etiqueta de una constante al crear.** E15 manda la etiqueta como ejemplo a Meta, pero el
    back ya no conoce las constantes (F1). Propuesta: la petición de crear trae
    `constantLabels: { "<clave>": "<etiqueta>" }` con la etiqueta de cada constante usada, y el back la
    usa como ejemplo sin guardarla. Alternativa: mandar la clave misma (`cliente.nombre`) como ejemplo.
  - **[P21] Plantilla de Meta con variables con nombre** (`{{first_name}}`). Hoy el dominio no ve
    huecos y la da por «relacionada», y el relleno SQL la deja «sin relacionar»: no coinciden.
    Propuesta: no relacionable, siempre «sin relacionar» y nunca habilitada (R95), igual que el relleno.
    Las variables `NAMED` están fuera de alcance de la ficha.
  - **[P22] `example` de un botón URL como texto en el `GET`.** El contraste de T26 salió sin bloqueo,
    salvo que Meta puede devolver ese `example` como texto y no como lista. Propuesta: `contentOf`
    acepta los dos y toma el primer elemento si es lista (R96); así `componentsChanged` no ve un cambio
    donde solo cambia la forma.
- **[P11]** Retirada por F1. Los dos datos que tenía abiertos (`nombre` y `pedido_numero`) los decide
  el front. Texto anterior, para la historia:
- **[P11] Dos datos que el spec no propuso** (los dejó como pregunta, no como propuesta; la aprobación
  no los fija, y no se inventan aquí):
  - si la constante `nombre` sale solo de `Customer.firstNames` o de nombres y apellidos
    (`firstNames` + `lastNames`);
  - la forma del número de pedido de `pedido_numero` a partir de `orderYear`/`orderSequence`
    (**[POR CONFIRMAR]**: la que ya muestra la app).
  No bloquean esta ficha: el catálogo solo declara de qué dato sale cada constante, y el resolvedor
  lo escribe la ficha que envía (QC-245, QC-247), que tiene que cerrarlos antes de implementarlo.

Riesgo, no pregunta: E6 compara los componentes guardados con los que lista Meta. Las creadas desde
la app guardan lo **enviado**; si el `GET` de Meta los devuelve con otra forma, cada creada perdería su
relación en la primera sincronización. `design.md > 18.5` compara el contenido normalizado y T26 lo
fija con un test; la forma del `GET` es **[POR CONFIRMAR]** (P4): el implementer la contrasta con la
documentación vigente de Meta antes de T26.
