# QC-241 — envio-whatsapp-sistema · requirements.md

> **Zona:** backend · **Complejidad:** medium · **Épica:** QC-220 Integraciones ·
> **depends_on:** QC-240 (`done`) · **Rama:** `feature/QC-241-envio-whatsapp-sistema`
>
> El bloque de Alcance, «Lo que NO entra», la tabla de decisiones y los criterios de aceptación se
> copian **tal cual** de la ficha (`feature_list.json > QC-241`). Los fijó el humano antes del spec y
> no se reabren. Lo que la ficha no decía y hacía falta para escribir requisitos testeables se
> preguntó como P1–P10; el humano las cerró el 2026-11-11 y hoy son las filas D6–D15. Tras la
> vuelta 1 de review, el humano cerró D16–D18 el mismo día y se añadió R42.

## Alcance (de la ficha)

Otros módulos pueden pedir que se envíe un WhatsApp (por ejemplo, al entregar un pedido) sin depender
de que Meta responda: el envío se encola en QStash y se reintenta solo.

* **Puerto** `WhatsappNotifier.enqueue(companyId, customerId, plantilla, parámetros)`, que usan otros
  módulos:
  * Sin conexión `active` o sin teléfono válido del cliente: no hace nada y deja una línea de log.
    Nunca hace fallar la operación de negocio.
  * Si no: `INSERT` del mensaje `out`, `status=queued`, `origin=system` (crea el contacto vinculado si
    no existe) y publica en QStash `send_message` con el id del mensaje.
  * Siempre es una plantilla: el sistema no sabe si la ventana de 24 h está abierta.
* **Consumidor QStash** `POST /api/integraciones/whatsapp/envios`, con el mismo contrato que
  `document-job-route.ts`:
  * Firma QStash (`Receiver.verify`). Inválida: `401`.
  * **Claim** de `queued` a `sending` con `attempts+1`. Si ya no está `queued`: `200` sin hacer nada
    (entrega duplicada).
  * Meta responde bien: `wamid`, `sent`, `200`.
  * Error temporal (5xx, `130429`, `131056` o error de red): vuelve a `queued` y responde `500` para
    que QStash reintente.
  * Error permanente (resto de 4xx): `failed`, `200`.
  * Reintentos máximos en `WHATSAPP_SEND_MAX_RETRIES`.
* **Cron de barrido** (`CRON_SECRET`):
  * Mensajes `queued` de más de 5 min: se vuelven a publicar. Cubre el caso de que la publicación
    inicial haya fallado.
  * `queued` con los reintentos agotados: `failed`.
  * `sending` de más de 10 min: `failed`, **sin reintentar**, porque Meta pudo haberlo enviado y
    reintentar podría duplicarlo.
* Adapter de QStash propio del módulo, siguiendo el patrón de `documentos`. La lista de archivos que
  pueden importar `@upstash/qstash` se amplía para incluirlo.

**Lo que NO entra.** Qué eventos concretos disparan mensajes (ficha de notificaciones). UI. Envíos
masivos o campañas.

**Criterios de aceptación (de la ficha).**

* `enqueue` con una conexión activa deja el mensaje `queued` y lo publica; sin conexión, no hace nada
  y no lanza error.
* El consumidor envía y deja `sent`; la misma entrega dos veces envía una sola vez.
* Un 5xx deja `queued` y responde `500`; un 4xx permanente deja `failed` y responde `200`.
* El barrido vuelve a publicar los `queued` viejos, marca `failed` los que agotaron reintentos y los
  `sending` atascados.
* Firma QStash inválida: `401`.
* La guardia de imports de `@upstash/qstash` está en verde con el adapter nuevo.
* Ámbito por empresa; `./init.sh` y `gate-completo` en verde.

## Decisiones cerradas (no reabrir)

| # | Decisión | Por qué |
| --- | --- | --- |
| D1 | Envíos del sistema por QStash | La operación de negocio no falla ni se demora si Meta está caído, y nadie está mirando para reintentar. |
| D2 | Claim `queued`→`sending` | QStash puede entregar dos veces; solo uno envía. |
| D3 | Solo se reintentan los errores temporales | Un número inválido no se arregla reintentando. |
| D4 | `sending` atascado pasa a `failed` sin reintentar | Mejor un fallo visible que un mensaje duplicado al cliente. |
| D5 | El notifier nunca hace fallar al que lo llama | WhatsApp es un aviso, no parte de la operación. |
| D6 | (2026-11-11, era P1) `WHATSAPP_SEND_MAX_RETRIES` vale `3` por defecto y cuenta reintentos **después** del primer intento: tope de intentos = `1 + 3 = 4`. Que `retries` de QStash cuente igual se verifica contra el SDK instalado en la task del adaptador (T4) | Mismo valor que `DOCUMENT_PROCESSING_MAX_RETRIES` (`.env.example`); el humano acepta el valor por defecto. |
| D7 | (2026-11-11, era P2) El barrido corre **cada hora** (`0 * * * *`), como cron de Vercel en `/api/cron/barrer-envios-whatsapp`, protegido con `CRON_SECRET`. Los umbrales no cambian: `QUEUED` de más de 5 min y `SENDING` de más de 10 min | Decisión del humano. **Consecuencia aceptada:** como el barrido pasa una vez por hora, un mensaje perdido (publicación inicial fallida, `SENDING` atascado o reintentos agotados) puede tardar hasta ~1 h en republicarse o quedar en `FAILED`. |
| D8 | (2026-11-11, era P3) `plantilla = { name, language }`; `parámetros` = valores por **clave de constante** (`cliente.nombre`), los mismos que manda el front en QC-240; las variables propias las completa el back con su valor guardado; un faltante se registra por su clave | Nombre e idioma son estables entre sincronizaciones y conexiones, a diferencia del id local; el humano acepta el valor por defecto. |
| D9 | (2026-11-11, era P4) Si al enviar el añadido está apagado, la conexión no está viva y `ACTIVE`, la credencial es ilegible o el contacto está bloqueado: `FAILED` sin llamar a Meta y `200` | Reintentar no lo arregla (mismo criterio que D3); el humano acepta el valor por defecto. |
| D10 | (2026-11-11, era P5) El barrido de `SENDING` atascados (y todo el barrido) aplica **solo** a origen `SYSTEM` | La ficha habla de envíos del sistema; ampliar cambiaría el comportamiento aprobado de QC-240. El humano acepta el valor por defecto. |
| D11 | (2026-11-11, era P6) Los textos de los motivos nuevos son los de `design.md > 7` | El humano acepta la propuesta. |
| D12 | (2026-11-11, era P7) La guardia de imports de `@upstash/qstash` no existía: esta feature **crea** `tests/guards/guard-qstash-aislado.test.ts` con la lista cerrada de importadores y actualiza la fila de `docs/dependencias.md` y los dos comentarios de `documentos` | Sin test, la «lista» solo vivía en texto y nadie la hacía cumplir; el humano acepta el valor por defecto. |
| D13 | (2026-11-11, era P8) Sin variable nueva para la URL: `APP_BASE_URL` + `/api/integraciones/whatsapp/envios`, reutilizando `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY` y `QSTASH_NEXT_SIGNING_KEY`; sin `APP_BASE_URL`, la publicación falla y se aplica R11 | Misma cuenta de QStash; una variable más por entorno no aporta nada. El humano acepta el valor por defecto. |
| D14 | (2026-11-11, era P9) El contacto que crea o vincula `enqueue` queda con vínculo **de sistema** (`customerLinkedBy` nulo) | No hay usuario; el recálculo de QC-239 puede rehacerlo si el número cambia de dueño. El humano acepta el valor por defecto. |
| D15 | (2026-11-11, era P10) Con el añadido apagado, el barrido no republica y pasa a `FAILED` los `QUEUED` de más de 5 min de esa empresa | Que un aviso viejo no salga días después al reactivar el añadido; el humano acepta el valor por defecto. |
| D16 | (2026-11-11, review vuelta 1, m2) Si el consumidor rechaza una entrega porque faltan las claves de firma de la cola, deja una línea de log de nivel `error` con el identificador del flujo de envíos automáticos del sistema y **nunca** los valores de las claves. **No** se añade tope de republicaciones. Una `APP_BASE_URL` mal puesta (y unas claves presentes pero equivocadas) quedan como límite conocido (`design.md > 8`) | Sin la línea, una configuración rota deja los mensajes en `QUEUED` y el barrido los republica cada hora sin que nadie lo vea. Decisión del humano. |
| D17 | (2026-11-11, review vuelta 1, m3) En `docs/architecture.md > Variables por entorno`, `WHATSAPP_SEND_MAX_RETRIES` queda opcional y vacía en Preview y en Local (vale `3`); la fila de `APP_BASE_URL` se corrige: también la lee la cola de envíos de WhatsApp, y en Preview hace falta si se prueba WhatsApp | La fila decía «solo las lee el correo», que dejó de ser cierto con esta feature. Decisión del humano; sin requisito nuevo. |
| D18 | (2026-11-11, review vuelta 1, m4) `SWEEP_BATCH = 100` mensajes por empresa y pasada del barrido | Acota lo que una pasada publica; lo que quede sale en la pasada siguiente. Decisión del humano. |

Cobertura: D1 → R1, R8, R10, R11 · D2 → R17, R18 · D3 → R22, R23 · D4 → R32 · D5 → R2–R7, R11 ·
D6 → R25 · D7 → R29, R32, R35 · D8 → R1, R6, R8 · D9 → R19 · D10 → R33 · D11 → R19, R31, R32 ·
D12 → R38 · D13 → R10, R11 · D14 → R9 · D15 → R34 · D16 → R42 · D17 → R10, R25 (documentación de
las dos variables que leen; el cambio de docs es `tasks.md > T12`) · D18 → R29 (el lote acota la
republicación).

## Glosario

- **Mensaje del sistema:** fila de `whatsapp_messages` con dirección `OUT` y origen `SYSTEM`.
- **Trabajo de envío:** el mensaje que se publica en la cola, con el id del mensaje del sistema y la
  empresa a la que pertenece.
- **Tope de intentos:** `1 + WHATSAPP_SEND_MAX_RETRIES` (el primer intento más los reintentos; D6).
- **Plantilla enviable:** plantilla local viva, habilitada, con todos sus huecos relacionados y
  `APPROVED` en Meta (la misma regla que usa QC-240).
- **Error temporal de Meta:** sin respuesta (red, tiempo agotado), respuesta 5xx, respuesta correcta
  sin `wamid`, o rechazo con código `130429` o `131056`. **Error permanente:** cualquier otro rechazo.

## Requisitos (EARS)

### Encolar (`WhatsappNotifier.enqueue`)

**R1.** El sistema DEBE ofrecer a los demás módulos, por el contrato del módulo `integraciones`, la
operación `enqueue(companyId, customerId, plantilla, parámetros)` del puerto `WhatsappNotifier`, que
termina sin esperar ninguna llamada a Meta.

**R2.** SI el añadido `integraciones` no está activo para la empresa, ENTONCES `enqueue` NO DEBE
escribir ningún mensaje ni contacto ni publicar en la cola, y DEBE dejar una línea de log con el motivo.

**R3.** SI la empresa no tiene una conexión de WhatsApp viva en estado `ACTIVE`, ENTONCES `enqueue` NO
DEBE escribir ni publicar nada, y DEBE dejar una línea de log con el motivo.

**R4.** SI el cliente no existe vivo en la empresa o no tiene un teléfono principal válido, ENTONCES
`enqueue` NO DEBE escribir ni publicar nada, y DEBE dejar una línea de log con el motivo.

**R5.** SI el número del cliente solo corresponde a contactos de la conexión vinculados a **otro**
cliente, o el contacto elegido está bloqueado, ENTONCES `enqueue` NO DEBE escribir ni publicar nada, y
DEBE dejar una línea de log con el motivo.

**R6.** SI la plantilla indicada no existe viva en la conexión con ese nombre e idioma, no es
enviable, o falta (o llega vacío) el valor de alguno de sus huecos, ENTONCES `enqueue` NO DEBE escribir
ni publicar nada, y DEBE dejar una línea de log con el motivo y, si faltan valores, solo las claves
que faltan.

**R7.** El sistema DEBE hacer que `enqueue` nunca lance ni rechace su promesa —tampoco ante un fallo de
la base, del descifrado o un error inesperado—: todo fallo se registra en una línea de log y
`enqueue` devuelve un resultado de «omitido».

**R8.** CUANDO se cumplen las condiciones de R2–R6, `enqueue` DEBE crear, en la empresa y la conexión
viva, un mensaje con dirección `OUT`, estado `QUEUED`, origen `SYSTEM`, sin autor, tipo `TEMPLATE`,
`attempts = 0`, con el texto final de la plantilla, su nombre e idioma, los valores por clave y los
parámetros de Meta ya armados.

**R9.** SI el cliente no tiene contacto en la conexión, ENTONCES `enqueue` DEBE crearlo con
`waId` igual a su teléfono principal y vinculado a ese cliente; SI existe un contacto sin cliente con
ese número, ENTONCES DEBE vincularlo a ese cliente; y dos `enqueue` simultáneos al mismo número nuevo
DEBEN dejar un solo contacto.

**R10.** CUANDO `enqueue` crea el mensaje, el sistema DEBE publicar en la cola un trabajo de envío con
el id del mensaje y su empresa, y DEBE guardar en el mensaje el identificador que devuelve la cola.

**R11.** SI la publicación en la cola falla, ENTONCES el mensaje DEBE quedar en `QUEUED`, el sistema
DEBE dejar una línea de log y `enqueue` NO DEBE lanzar.

**R12.** El sistema DEBE enviar los mensajes del sistema **siempre** como plantilla: `enqueue` no
acepta texto libre ni consulta la ventana de 24 h del contacto.

**R13.** CUANDO `enqueue` crea el mensaje, el sistema DEBE mover la fecha del último mensaje del
contacto solo hacia delante, como hace el envío de un usuario.

### Consumidor (`POST /api/integraciones/whatsapp/envios`)

**R14.** CUANDO llega una petición al consumidor, el sistema DEBE verificar la firma de la cola sobre
el cuerpo crudo antes de interpretarlo; SI la firma falta o no es válida, ENTONCES DEBE responder
`401` sin leer ni escribir ningún mensaje.

**R15.** SI el cuerpo firmado no es JSON o no cumple el esquema del trabajo de envío, ENTONCES el
consumidor DEBE responder `400` sin escribir nada.

**R16.** El consumidor NO DEBE resolver sesión ni comprobar permisos de usuario: su única puerta es la
firma, y toda lectura y escritura DEBE hacerse con el ámbito de la empresa que trae el trabajo.

**R17.** CUANDO llega un trabajo válido, el sistema DEBE reclamar el mensaje en una sola escritura
atómica que lo pase de `QUEUED` a `SENDING` sumando 1 a `attempts`, y solo si el mensaje es de esa
empresa, tiene origen `SYSTEM` y no ha alcanzado el tope de intentos.

**R18.** SI el reclamo no cambia ninguna fila (el mensaje no está en `QUEUED`, no es de esa empresa o
agotó el tope de intentos), ENTONCES el consumidor DEBE responder `200` sin llamar a Meta ni escribir
nada; y dos entregas simultáneas del mismo trabajo DEBEN producir una sola llamada a Meta.

**R19.** SI, ya reclamado el mensaje, el añadido `integraciones` está apagado, la conexión no está
viva y `ACTIVE`, su credencial no se puede descifrar o el contacto está bloqueado, ENTONCES el sistema
DEBE dejar el mensaje en `FAILED` con un motivo en español, sin llamar a Meta, y responder `200` (D9).

**R20.** CUANDO el mensaje reclamado se envía, el sistema DEBE llamar a Meta con el token descifrado de
la conexión, el `waId` del contacto y la plantilla guardada en el mensaje (nombre, idioma y
parámetros), sin volver a resolver la plantilla.

**R21.** CUANDO Meta acepta el mensaje, el sistema DEBE guardar el `wamid`, dejar el mensaje en `SENT`
y responder `200`.

**R22.** SI Meta devuelve un error temporal, ENTONCES el sistema DEBE devolver el mensaje de `SENDING`
a `QUEUED` conservando `attempts`, y responder `500`.

**R23.** SI Meta devuelve un error permanente, ENTONCES el sistema DEBE dejar el mensaje en `FAILED`
con `errorCode` y el `errorReason` en español de la traducción de QC-240, responder `200` y no
reintentarlo; y SI el código es `190`, ENTONCES DEBE además dejar la conexión en `ERROR` con el aviso
«Revisa el token en Integraciones».

**R24.** SI ocurre un error no previsto (por ejemplo, la base no responde), ENTONCES el consumidor DEBE
responder `500`.

**R25.** El sistema DEBE leer el número de reintentos de `WHATSAPP_SEND_MAX_RETRIES`, usarlo como
número de reintentos de la cola al publicar y como base del tope de intentos; SI la variable falta o
está vacía, ENTONCES DEBE aplicar el valor por defecto `3` (D6); SI no es un entero ≥ 0, ENTONCES la
lectura DEBE fallar nombrando la variable sin mostrar su valor.

**R26.** Las líneas de log del consumidor NO DEBEN contener el texto de Meta, el texto del mensaje, los
valores de la plantilla, el número del destinatario ni el token; solo el id del mensaje y un
diagnóstico con el tipo de fallo y el código.

### Cron de barrido (`GET /api/cron/barrer-envios-whatsapp`)

**R27.** CUANDO llega una petición al barrido sin `Authorization: Bearer <CRON_SECRET>` correcto, el
sistema DEBE responder `401`; SI `CRON_SECRET` no está definida, ENTONCES DEBE responder `500`; en los
dos casos sin leer ninguna empresa ni mensaje.

**R28.** CUANDO el barrido está autorizado, el sistema DEBE recorrer las empresas de una en una,
leyendo y escribiendo cada una con su propio ámbito; el fallo en una empresa NO DEBE detener a las
demás; y DEBE responder con un resumen de cuántos mensajes republicó y marcó `FAILED`, sin datos de
los mensajes.

**R29.** MIENTRAS un mensaje del sistema está en `QUEUED`, no agotó el tope de intentos y lleva más de
5 minutos sin cambiar, el barrido DEBE volver a publicarlo, guardar el nuevo identificador de la cola
y renovar su marca de último cambio.

**R30.** SI volver a publicar un mensaje falla, ENTONCES el mensaje DEBE quedar en `QUEUED`, el
sistema DEBE dejar una línea de log y el barrido DEBE seguir con los demás.

**R31.** MIENTRAS un mensaje del sistema está en `QUEUED` y alcanzó el tope de intentos, el barrido
DEBE dejarlo en `FAILED` con un motivo fijo en español.

**R32.** MIENTRAS un mensaje del sistema está en `SENDING` y lleva más de 10 minutos sin cambiar, el
barrido DEBE dejarlo en `FAILED` con un motivo fijo en español y NO DEBE volver a publicarlo.

**R33.** El barrido NO DEBE tocar mensajes de origen `USER` ni `AGENT` (D10).

**R34.** SI el añadido `integraciones` está apagado para una empresa, ENTONCES el barrido NO DEBE
republicar sus mensajes, y DEBE dejar en `FAILED`, con el motivo de R19, los `QUEUED` de más de
5 minutos (D15).

**R35.** El barrido DEBE quedar declarado en `vercel.json` como tarea programada en la ruta
`/api/cron/barrer-envios-whatsapp` con la frecuencia `0 * * * *` (una vez por hora) (D7).

### Transversales

**R36.** El sistema DEBE aplicar el ámbito de empresa a toda consulta de esta feature: un trabajo cuya
empresa no es la del mensaje no lo reclama ni lo modifica, y ninguna consulta del barrido lee varias
empresas a la vez.

**R37.** CUANDO llega por el webhook un status posterior (`delivered`, `read`, `failed`) de un mensaje
del sistema ya `SENT`, el sistema DEBE aplicarlo por su `wamid` igual que a los mensajes de un usuario.

**R38.** El sistema DEBE tener su propio adaptador de la cola en el módulo `integraciones`; `domain/` y
`ports/` NO DEBEN importar `@upstash/qstash`, `next/*` ni `@prisma/client`; y los únicos archivos del
repositorio que importan `@upstash/qstash` DEBEN ser los dos de `documentos` y los del adaptador nuevo,
lo que DEBE vigilar una guardia del gate (D12).

**R39.** El sistema NO DEBE incorporar dependencias nuevas.

**R40.** La migración de esta feature DEBE traer su `down.sql`, que revierte exactamente lo que hace
`migration.sql`.

**R41.** Las dos rutas nuevas sin sesión DEBEN figurar en la clasificación de rutas fuera de sesión
como del añadido `integraciones`, cada una con su prueba.

### Enmienda tras la vuelta 1 de review (2026-11-11)

**R42.** SI llega al consumidor una entrega firmada y falta, o está vacía, alguna de las claves de
firma de la cola, ENTONCES el sistema DEBE responder `401` como en R14 y DEBE dejar una línea de log
de nivel `error` que lleve el identificador del flujo de envíos automáticos del sistema y los nombres
de las claves que faltan, y que NO DEBE contener el valor de ninguna clave (D16).

## Preguntas abiertas

Ninguna. P1–P10 se cerraron el 2026-11-11 (D6–D15); m2–m4 de la vuelta 1 de review, el mismo día
(D16–D18).
