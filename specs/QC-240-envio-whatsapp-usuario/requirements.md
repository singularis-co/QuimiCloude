# QC-240 — envio-whatsapp-usuario · requirements.md

> **Zona:** backend · **Complejidad:** medium · **Épica:** QC-220 Integraciones ·
> **depends_on:** QC-239, QC-242 (y, a través de ellas, QC-237 y QC-238) · **Rama:**
> `feature/QC-240-envio-whatsapp-usuario`
>
> El bloque de Alcance, «Lo que NO entra» y la tabla de decisiones se copian **tal cual** de la ficha
> del board (`feature_list.json > QC-240`). Las fijó el humano antes del spec y no se reabren. Lo que
> la ficha no dice y hace falta para escribir requisitos testeables va a `## Preguntas abiertas`,
> con el default que este spec usa mientras el humano no responda.

## Alcance (de la ficha)

Un usuario envía un mensaje de WhatsApp a un cliente de su empresa, de forma síncrona: ve el
resultado al instante y, si falla, puede reintentar.

* **Caso de uso** `sendWhatsappMessage` (lo llamará la pantalla de Contactos), con el permiso nuevo
  `whatsapp.enviar`, asignado solo al **Administrador** (decisión del humano, 2026-10-09; se amplía
  cuando se defina quién atiende a los clientes), con su migración de datos como en QC-221:
  1. El destinatario debe ser un **contacto vinculado a un cliente** de la empresa (QC-239). Si el
     cliente aún no tiene contacto, se crea con `waId = phone_e164` y queda vinculado. Un cliente sin
     `phone_e164` no puede recibir mensajes.
  2. La conexión debe estar `active`.
  3. **Ventana de 24 h:** con `lastInboundAt` de hace menos de 24 h se permite texto libre; fuera de
     la ventana, solo una **plantilla local** del catálogo de QC-242, **habilitada** y `APPROVED` en
     Meta.
     * El back toma el texto y el mapeo de la plantilla (`1 = cliente.nombre`, `2 = cuenta_numero`) y
       arma los parámetros `{{n}}` para Meta.
     * Las **constantes** (`cliente.nombre`) las manda el front ya resueltas; las **variables
       propias** (`cuenta_numero`) las completa el back con su `value` guardado.
     * Si falta el valor de una constante o llega vacío, se rechaza antes de llamar a Meta con un
       error que nombra su etiqueta («Falta el valor de Nombre del cliente»).
  4. `INSERT` del mensaje `out`, `status=sending`, `origin=user`, `sentById`. Si es plantilla: `body`
     con el texto final ya armado, `templateName` e idioma, y en `payload` los valores por clave.
  5. `POST /{phone_number_id}/messages` con el token descifrado.
     * Si responde bien: guarda el `wamid` y pasa a `sent`.
     * Si falla: pasa a `failed` con `errorCode` y `errorReason` traducidos al español.
  6. **Reintentar** un mensaje `failed`: crea un mensaje nuevo. El fallido se conserva.
     * Texto: mismo contenido.
     * Plantilla: se **recalcula** como un envío nuevo. Exige que siga habilitada y aprobada, toma las
       variables propias con su valor de hoy y el front vuelve a mandar las constantes.
* **Errores de Meta con efecto propio:**
  * Token vencido o revocado (`190`): la conexión pasa a `status=error` con el aviso «Revisa el token
    en Integraciones».
  * Fuera de la ventana (`131047`): mensaje claro que pide usar una plantilla.
  * Límite de envío (`130429`, `131056`): «Demasiados mensajes, intenta en un momento».
* El cliente de Graph (QC-237) gana el envío de texto y de plantilla.
* Los statuses posteriores (`delivered`, `read`, `failed`) ya los actualiza la recepción (QC-238).

**Lo que NO entra.** UI y E2E de navegador (ficha de Contactos). Envíos del sistema y cola (ficha
aparte). Adjuntos, respuestas citadas y reacciones salientes. Asignar `whatsapp.enviar` a otros
roles. Resolver el valor de las constantes (lo hace el front).

**Criterios de aceptación (de la ficha).**

* Dentro de la ventana, un texto se envía y queda `sent` con su `wamid` (Graph simulado).
* Fuera de la ventana, un texto se rechaza antes de llamar a Meta; una plantilla local habilitada y
  aprobada se envía con sus parámetros armados desde el mapeo.
* Una plantilla deshabilitada, «sin relacionar» o no `APPROVED` se rechaza antes de llamar a Meta.
* Si falta el valor de una constante, se rechaza nombrando su etiqueta; una variable propia toma su
  `value` guardado.
* El mensaje de plantilla guarda el texto final, `templateName`, idioma y los valores por clave.
* A un cliente sin teléfono válido, o a un número que no es cliente: se rechaza.
* Si Meta falla, queda `failed` con un mensaje en español; reintentar crea un mensaje nuevo, y en una
  plantilla recalcula con los valores vigentes.
* Un error `190` deja la conexión en `error`.
* Sin `whatsapp.enviar`: se rechaza. Solo el Administrador tiene el permiso.
* Con una conexión `disabled` o `pending`: se rechaza.
* Ámbito por empresa; guardias, `./init.sh` y `gate-completo` en verde.

## Requisitos (EARS)

Vocabulario:

- **Envío:** una llamada a `sendWhatsappMessage` o a `retryWhatsappMessage` (reintento).
- **Rechazo previo:** el envío termina con un error del catálogo **sin** escribir ningún mensaje y
  **sin** llamar a Meta.
- **Conexión de la empresa:** la conexión de WhatsApp viva (sin borrar) de la empresa del actor.
- **Contacto destinatario:** el contacto de WhatsApp de la conexión de la empresa al que se envía.
- **Ventana abierta:** el contacto destinatario tiene `lastInboundAt` y `ahora − lastInboundAt <
  24 h`. Sin `lastInboundAt`, la ventana está cerrada.
- **Plantilla enviable:** plantilla local viva de la conexión de la empresa, `enabled = true`,
  `mappingStatus = MAPPED` y `status = APPROVED`.
- **Constante:** clave con forma `entidad.campo` (QC-242 R88). **Variable propia:** clave sin punto
  guardada en el diccionario de la empresa.

### Permiso y autorización

- **R1.** El sistema DEBE tener el permiso `whatsapp.enviar` en el catálogo de permisos, con módulo
  `whatsapp` y acción `enviar`, y DEBE asignarlo por migración de datos y por seed **solo** al rol
  Administrador.
- **R2.** CUANDO se aplica la migración del permiso, el sistema DEBE crear la fila del permiso y su
  asignación al Administrador de cada empresa de forma idempotente; CUANDO se revierte, DEBE quitar
  exactamente esas filas y nada más.
- **R3.** El sistema DEBE clasificar `whatsapp.enviar` como permiso del añadido `integraciones`: con
  el añadido apagado en la empresa, el actor no lo tiene.
- **R4.** CUANDO un actor sin `whatsapp.enviar` (o sin empresa) llama a un envío, el sistema DEBE
  responder `unauthorized` antes de validar la entrada o tocar ningún puerto.

### Destinatario

- **R5.** DONDE el envío indica un contacto, el sistema DEBE exigir que el contacto sea de la
  conexión de la empresa y esté vinculado a un cliente vivo de la empresa. SI el contacto no existe,
  es de otra empresa o de otra conexión, ENTONCES DEBE responder `whatsapp_contact_not_found`; SI no
  tiene cliente o su cliente está dado de baja, ENTONCES DEBE responder
  `whatsapp_recipient_not_customer`. Ambos son rechazo previo.
- **R6.** DONDE el envío indica un cliente, el sistema DEBE exigir que el cliente esté vivo en la
  empresa del actor; SI no, ENTONCES DEBE responder `customer_not_found` como rechazo previo.
- **R7.** SI el cliente indicado no tiene `phone_e164` (sin teléfono, teléfono antiguo con aviso o
  pendiente de relleno), ENTONCES el sistema DEBE responder `whatsapp_customer_without_phone` como
  rechazo previo.
- **R8.** CUANDO el envío indica un cliente con `phone_e164`, el sistema DEBE usar como contacto
  destinatario el contacto de la conexión de la empresa cuyo `waId` coincide con ese número
  (`phoneMatchesWaId`, con sus variantes de México, Argentina y Brasil) y que está vinculado a ese
  cliente o sin cliente. SI no hay ninguno, ENTONCES DEBE crear el contacto con `waId = phone_e164`.
  En los dos casos el contacto DEBE quedar vinculado a ese cliente como vínculo manual del actor.
- **R9.** SI el contacto que coincide con el número del cliente indicado está vinculado a **otro**
  cliente, ENTONCES el sistema DEBE responder `whatsapp_contact_linked_elsewhere` como rechazo previo
  y no cambiar el vínculo (P3).
- **R10.** SI el contacto destinatario está bloqueado, ENTONCES el sistema DEBE responder
  `whatsapp_contact_blocked` como rechazo previo (P4).
- **R11.** CUANDO dos envíos simultáneos a un cliente sin contacto crean su contacto, el sistema DEBE
  dejar un solo contacto para ese número en la conexión y usarlo en los dos envíos.

### Conexión

- **R12.** SI la empresa no tiene conexión viva, ENTONCES el sistema DEBE responder
  `whatsapp_connection_not_found` como rechazo previo.
- **R13.** SI la conexión de la empresa no está `ACTIVE` (`PENDING`, `ERROR` o `DISABLED`), ENTONCES
  el sistema DEBE responder `whatsapp_connection_not_active` como rechazo previo.
- **R14.** SI el token de la conexión no se puede descifrar, ENTONCES el sistema DEBE responder
  `integration_secret_unreadable`, dejar la conexión en `ERROR` con el aviso de QC-237 y no escribir
  ningún mensaje ni llamar a Meta.

### Ventana de 24 h y texto libre

- **R15.** MIENTRAS la ventana del contacto destinatario esté abierta, el sistema DEBE aceptar un
  envío de texto libre.
- **R16.** SI se envía texto libre con la ventana cerrada, ENTONCES el sistema DEBE responder
  `whatsapp_window_closed` («Pasaron más de 24 horas desde el último mensaje del cliente: usa una
  plantilla.») como rechazo previo.
- **R17.** SI el texto libre está vacío, tiene solo espacios o supera el largo máximo de texto de
  Meta, ENTONCES el sistema DEBE responder `invalid_input` como rechazo previo.
- **R18.** El sistema DEBE aceptar un envío con plantilla enviable tanto con la ventana abierta como
  cerrada.

### Plantilla

- **R19.** SI la plantilla indicada no existe, está eliminada, es de otra empresa o de otra conexión,
  ENTONCES el sistema DEBE responder `whatsapp_template_not_found` como rechazo previo.
- **R20.** SI la plantilla existe pero no es enviable (deshabilitada, «sin relacionar» o con un
  estado distinto de `APPROVED`), ENTONCES el sistema DEBE responder `whatsapp_template_not_sendable`
  como rechazo previo.
- **R21.** CUANDO se envía una plantilla enviable, el sistema DEBE armar un parámetro de Meta por cada
  hueco `{{n}}` de su header, body y botones URL, con el valor de la clave que su mapeo le asigna,
  en el orden y el componente de Meta que corresponden al hueco.
- **R22.** CUANDO un hueco está relacionado con una variable propia, el sistema DEBE usar el `value`
  guardado de esa variable en el momento del envío e ignorar cualquier valor que el front mande para
  esa clave.
- **R23.** CUANDO un hueco está relacionado con una constante, el sistema DEBE usar el valor que el
  front manda para esa clave. El sistema NO DEBE resolver el valor de una constante por su cuenta.
- **R24.** SI falta el valor de alguna constante usada por la plantilla, o llega vacío o con solo
  espacios, ENTONCES el sistema DEBE rechazar el envío antes de llamar a Meta y sin escribir ningún
  mensaje, con un error cuyo texto nombra la etiqueta de cada constante que falta («Falta el valor de
  Nombre del cliente»), y que devuelve también sus claves (P2).
- **R25.** CUANDO se envía una plantilla, el sistema DEBE armar el texto final sustituyendo cada
  `{{n}}` del contenido de la plantilla por el valor usado en su parámetro (P5).

### El mensaje y la llamada a Meta

- **R26.** CUANDO un envío pasa todas las validaciones, el sistema DEBE insertar el mensaje con
  `direction = OUT`, `status = SENDING`, `origin = USER`, `sentById` = el actor, `attempts = 1`, el
  contacto destinatario y la conexión de la empresa, **antes** de llamar a Meta.
- **R27.** CUANDO el mensaje es de texto, el sistema DEBE guardarlo con `type = TEXT`, el texto en
  `body` y `payload = {}`.
- **R28.** CUANDO el mensaje es de plantilla, el sistema DEBE guardarlo con `type = TEMPLATE`, el
  texto final en `body`, el nombre de la plantilla en `templateName`, su idioma en la columna de
  idioma y, en `payload`, el valor usado para cada clave del mapeo (constantes y propias), por clave.
- **R29.** El sistema DEBE llamar a `POST /{phone_number_id}/messages` de Graph con el token
  descifrado de la conexión en la cabecera, el `waId` del contacto destinatario como destino y el
  texto, o el nombre, idioma y parámetros de la plantilla.
- **R30.** CUANDO Meta acepta el mensaje y devuelve su `wamid`, el sistema DEBE guardar el `wamid` y
  pasar el mensaje a `SENT`, solo si sigue en `SENDING`.
- **R31.** CUANDO Meta rechaza el mensaje, no responde, o responde sin `wamid`, el sistema DEBE pasar
  el mensaje a `FAILED` con `errorCode` (el código de Meta como texto, o nulo si no lo hay) y
  `errorReason` en español según la tabla de traducción (R33–R36).
- **R32.** CUANDO un envío termina, el sistema DEBE actualizar `lastMessageAt` del contacto
  destinatario a la hora del envío si es posterior a la que tenía, sin tocar `lastInboundAt`.
- **R33.** CUANDO Meta responde el código `190`, el sistema DEBE dejar el mensaje en `FAILED` y la
  conexión en `ERROR` con `lastError` «Revisa el token en Integraciones».
- **R34.** CUANDO Meta responde el código `131047`, el sistema DEBE dejar el mensaje en `FAILED` con
  `errorReason` «Pasaron más de 24 horas desde el último mensaje del cliente: usa una plantilla.».
- **R35.** CUANDO Meta responde el código `130429` o `131056`, el sistema DEBE dejar el mensaje en
  `FAILED` con `errorReason` «Demasiados mensajes, intenta en un momento».
- **R36.** CUANDO Meta responde cualquier otro código, o no responde, el sistema DEBE dejar el
  mensaje en `FAILED` con un `errorReason` genérico en español que incluye el código si lo hay. El
  texto original de Meta NO DEBE guardarse en el mensaje ni devolverse (P6).
- **R37.** CUANDO un envío escribe un mensaje, el sistema DEBE devolver el mensaje resultante (id,
  tipo, estado `SENT` o `FAILED`, `body`, `errorCode`, `errorReason`, fecha) como resultado correcto,
  también cuando Meta lo rechazó. Un rechazo previo DEBE devolverse como error del catálogo.
- **R38.** SI falla la escritura del mensaje antes de llamar a Meta, ENTONCES el sistema NO DEBE
  llamar a Meta.

### Reintentar

- **R39.** CUANDO un actor reintenta un mensaje `FAILED`, saliente y de origen `USER` de su empresa,
  el sistema DEBE crear un mensaje **nuevo** con las mismas reglas de R5 y R10–R38 sobre el contacto
  del mensaje fallido, y NO DEBE modificar el mensaje fallido.
- **R40.** SI el mensaje a reintentar no existe o es de otra empresa, ENTONCES el sistema DEBE
  responder `whatsapp_message_not_found`; SI existe pero no es `FAILED`, saliente y de origen `USER`,
  ENTONCES DEBE responder `whatsapp_message_not_retryable`. Ambos son rechazo previo.
- **R41.** CUANDO se reintenta un texto, el sistema DEBE enviar el mismo `body` del mensaje fallido,
  validando la ventana en el momento del reintento (R15, R16).
- **R42.** CUANDO se reintenta una plantilla, el sistema DEBE buscar la plantilla viva de la conexión
  con el `templateName` y el idioma del fallido y recalcular el envío como uno nuevo: exigir que sea
  enviable (R19, R20), tomar el `value` vigente de las variables propias y los valores de constantes
  que manda el front en el reintento (R22–R24).

### Ámbito, datos y entrega

- **R43.** Toda lectura y escritura de un envío DEBE limitarse a la empresa del actor. Un
  identificador de contacto, cliente, plantilla o mensaje de otra empresa DEBE tratarse como
  inexistente.
- **R44.** La base DEBE impedir que `whatsapp_messages.sent_by` apunte a un usuario inexistente.
- **R45.** El sistema DEBE ofrecer el envío y el reintento como Server Actions que devuelven el
  resultado de R37, el error del catálogo, o el error de R24 con sus etiquetas y claves, sin pantalla
  propia.
- **R46.** El sistema NO DEBE escribir en el log el texto del mensaje, los valores de las variables,
  el número del contacto ni el token.
- **R47.** La migración de esquema DEBE tener su `down.sql`, que deja el esquema como antes.
- **R48.** El sistema DEBE verificar el envío con tests de integración contra la base de test y un
  doble de Graph, sin llamar a Meta; esta ficha no tiene E2E de navegador.

### Cobertura de las decisiones cerradas

| Decisión | Requisitos |
|---|---|
| D1 Envío síncrono, sin cola | R26, R29–R31, R37 |
| D2 Solo a clientes de la empresa | R5–R9, R43 |
| D3 Fuera de 24 h, solo plantilla | R15, R16, R18, R34 |
| D4 Reintentar crea un mensaje nuevo | R39–R42 |
| D5 `whatsapp.enviar` solo para el Administrador | R1–R4 |
| A1 Plantilla del catálogo local; el back arma los parámetros desde su mapeo | R19, R21, R25 |
| A2 Solo habilitadas y `APPROVED`; si no, rechazo antes de Meta | R20 |
| A3 Constantes del front; propias con su `value`; constante faltante = rechazo con su etiqueta | R22–R24 |
| A4 El mensaje guarda texto final, `templateName`, idioma y valores por clave | R28 |
| A5 Reintentar una plantilla recalcula como envío nuevo | R42 |
| A6 Tests de integración con doble de Graph; E2E de navegador en Contactos | R48 |

## Preguntas abiertas

Cada una con el default que este spec ya aplica. Si el humano responde otra cosa, se corrige el
requisito citado antes de aprobar.

- **P1 — Choque con QC-239 sobre «responder a desconocidos».** La tabla de QC-239 dice
  «¿Se responde a desconocidos? Sí; QC-240 actualizada en el board» (2026-10-20), pero la ficha de
  QC-240 que está hoy en el board dice D2 «Solo a clientes de la empresa» y su criterio de aceptación
  «a un número que no es cliente: se rechaza». **Default:** manda la ficha actual (D2): solo
  contactos vinculados a un cliente (R5). Si el humano confirma lo de QC-239, R5 deja de exigir
  cliente y D2 cambia en el board.
- **P2 — La etiqueta de una constante no está en el backend.** QC-242 (§19, F1) dejó el catálogo de
  constantes solo en el front y no guarda sus etiquetas; QC-243 traduce `nombre_del_cliente` ↔
  `cliente.nombre` en el front y al backend llega la clave con punto. Para nombrar la etiqueta (R24)
  **default:** el front manda, junto a los valores, `constantLabels` (clave con punto → etiqueta),
  como ya hace al crear una plantilla (QC-242 §19.4); si falta la etiqueta, el texto usa la clave.
- **P3 — Número del cliente con un contacto vinculado a otro cliente** (número compartido, n:m de
  QC-239). **Default:** rechazo `whatsapp_contact_linked_elsewhere` sin tocar el vínculo (R9); se
  cambia desde Contactos (vincular, QC-239).
- **P4 — Contacto bloqueado (QC-239).** La ficha no lo dice. **Default:** no se le puede enviar
  (R10).
- **P5 — Qué guarda `body` en una plantilla con header o footer.** **Default:** header (si es de
  texto), body y footer con sus valores, separados por una línea en blanco; los botones no entran
  (R25).
- **P6 — Traducción de otros códigos de Meta y de la falta de respuesta.** **Default:** solo los
  tres casos de la ficha tienen texto propio; cualquier otro código da «Meta no aceptó el mensaje
  (código N). Intenta de nuevo o revisa la conexión.» y la falta de respuesta (red, tiempo agotado,
  5xx) da «No se pudo contactar con Meta. Intenta de nuevo en unos minutos.» con `errorCode` nulo
  (R36). Aviso: si Meta recibió el mensaje pero la respuesta se perdió, reintentar lo duplica; se
  acepta (D1, D4).
- **P7 — Cómo indica el destinatario la pantalla de Contactos.** **Default:** el envío acepta un
  contacto (conversación abierta) **o** un cliente (cliente sin conversación aún) (R5–R8).
- **P8 — Vínculo del contacto al enviar por cliente.** **Default:** vínculo manual del actor
  (`customerLinkedBy = actor`), porque el usuario eligió a ese cliente; así un recálculo por número
  compartido no lo deshace (R8).
- **P9 — Largo máximo del texto libre.** **Default:** 4096 caracteres, el límite de texto de la Cloud
  API **[POR CONFIRMAR contra la documentación vigente en T5]** (R17).

## Decisiones cerradas (no reabrir)

Copiadas de la ficha (`feature_list.json > QC-240`).

| # | Decisión | Por qué |
| --- | --- | --- |
| D1 | Envío síncrono, sin cola | Hay una persona mirando: el error inmediato y "Reintentar" son más claros que un reintento invisible. |
| D2 | Solo a clientes de la empresa | Decisión del humano: solo se conversa con clientes. |
| D3 | Fuera de 24 h, solo plantilla | Regla de Meta; se valida antes de llamar para dar un error claro. |
| D4 | Reintentar crea un mensaje nuevo | El historial conserva el intento fallido. |
| D5 | `whatsapp.enviar` solo para el Administrador (decisión del humano) | Se amplía cuando se defina quién atiende a los clientes. |
| A1 | Plantilla elegida del catálogo local de QC-242; el back arma los parámetros desde su mapeo (humano, 2026-10-20) | Usa el diccionario de variables y el mapeo `{{n}}` ↔ clave. |
| A2 | Solo plantillas habilitadas y `APPROVED`; si no, rechazo antes de Meta (humano, 2026-10-20) | Error claro en lugar de un fallo de Meta. |
| A3 | Constantes resueltas por el front; propias por el back con su `value`; constante faltante o vacía = rechazo que nombra su etiqueta (humano, 2026-10-20) | Evita mensajes con huecos. |
| A4 | El mensaje guarda el texto final, `templateName`, idioma y los valores por clave (humano, 2026-10-20) | El historial no depende de que la plantilla siga igual. |
| A5 | Reintentar una plantilla recalcula como envío nuevo (humano, 2026-10-20) | Manda los valores vigentes y respeta si se deshabilitó. |
| A6 | Verificación con tests de integración y doble de Graph; el E2E de navegador va en Contactos (humano, 2026-10-20) | Esta ficha no tiene pantalla; mismo criterio que QC-238. |
