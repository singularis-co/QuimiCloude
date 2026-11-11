# QC-241 — envio-whatsapp-sistema · requirements.md

> **Zona:** backend · **Complejidad:** medium · **Épica:** QC-220 Integraciones ·
> **depends_on:** QC-240 (`done`) · **Rama:** `feature/QC-241-envio-whatsapp-sistema`
>
> El bloque de Alcance, «Lo que NO entra», la tabla de decisiones y los criterios de aceptación se
> copian **tal cual** de la ficha (`feature_list.json > QC-241`). Los fijó el humano antes del spec y
> no se reabren. Lo que la ficha no dice y hace falta para escribir requisitos testeables va a
> `## Preguntas abiertas`, con el valor por defecto que este spec usa mientras el humano no responda.

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

Cobertura: D1 → R1, R8, R10, R11 · D2 → R17, R18 · D3 → R22, R23 · D4 → R32 · D5 → R2–R7, R11.

## Glosario

- **Mensaje del sistema:** fila de `whatsapp_messages` con dirección `OUT` y origen `SYSTEM`.
- **Trabajo de envío:** el mensaje que se publica en la cola, con el id del mensaje del sistema y la
  empresa a la que pertenece.
- **Tope de intentos:** `1 + WHATSAPP_SEND_MAX_RETRIES` (el primer intento más los reintentos; P1).
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
DEBE dejar el mensaje en `FAILED` con un motivo en español, sin llamar a Meta, y responder `200` (P4).

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
está vacía, ENTONCES DEBE aplicar el valor por defecto (P1); SI no es un entero ≥ 0, ENTONCES la
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

**R33.** El barrido NO DEBE tocar mensajes de origen `USER` ni `AGENT` (P5).

**R34.** SI el añadido `integraciones` está apagado para una empresa, ENTONCES el barrido NO DEBE
republicar sus mensajes, y DEBE dejar en `FAILED`, con el motivo de R19, los `QUEUED` de más de
5 minutos (P10).

**R35.** El barrido DEBE quedar declarado en `vercel.json` como tarea programada (P2).

### Transversales

**R36.** El sistema DEBE aplicar el ámbito de empresa a toda consulta de esta feature: un trabajo cuya
empresa no es la del mensaje no lo reclama ni lo modifica, y ninguna consulta del barrido lee varias
empresas a la vez.

**R37.** CUANDO llega por el webhook un status posterior (`delivered`, `read`, `failed`) de un mensaje
del sistema ya `SENT`, el sistema DEBE aplicarlo por su `wamid` igual que a los mensajes de un usuario.

**R38.** El sistema DEBE tener su propio adaptador de la cola en el módulo `integraciones`; `domain/` y
`ports/` NO DEBEN importar `@upstash/qstash`, `next/*` ni `@prisma/client`; y los únicos archivos del
repositorio que importan `@upstash/qstash` DEBEN ser los dos de `documentos` y los del adaptador nuevo,
lo que DEBE vigilar una guardia del gate (P7).

**R39.** El sistema NO DEBE incorporar dependencias nuevas.

**R40.** La migración de esta feature DEBE traer su `down.sql`, que revierte exactamente lo que hace
`migration.sql`.

**R41.** Las dos rutas nuevas sin sesión DEBEN figurar en la clasificación de rutas fuera de sesión
como del añadido `integraciones`, cada una con su prueba.

## Preguntas abiertas

Cada una con el valor por defecto que usa el spec mientras el humano no responda.

**P1. Valor por defecto y significado de `WHATSAPP_SEND_MAX_RETRIES`.** Ni la ficha ni `docs/` lo
fijan. *Por defecto:* `3`, el mismo que `DOCUMENT_PROCESSING_MAX_RETRIES` (`.env.example`), y se lee
como reintentos **después** del primer intento: tope de intentos = `1 + 3 = 4`. Que `retries` de
QStash cuente igual (reintentos tras la primera entrega) está **[POR CONFIRMAR]** contra el SDK
instalado en la task del adaptador.

**P2. El cron de barrido no existe y necesita una frecuencia sub-diaria.** `vercel.json` hoy declara
tres crons, los tres diarios (`caducar-pedidos`, `purgar-notificaciones`,
`sincronizar-plantillas-whatsapp`). Para que «más de 5 min» y «más de 10 min» tengan sentido, el
barrido tiene que correr cada pocos minutos. **Desconocido:** si el plan de Vercel del proyecto admite
crons sub-diarios (no está en `docs/`). *Por defecto:* `*/5 * * * *` en la ruta
`/api/cron/barrer-envios-whatsapp`. Si el plan no lo permite, el humano decide la alternativa (otra
frecuencia, o un programador externo).

**P3. Cómo se identifica la plantilla y qué son los «parámetros».** La ficha dice
`enqueue(companyId, customerId, plantilla, parámetros)` sin fijar la forma. *Por defecto:*
`plantilla = { name, language }` (estable entre sincronizaciones y entre conexiones, a diferencia del
id local) y `parámetros` = valores por **clave de constante** (`cliente.nombre`), los mismos que el
front manda en QC-240; las variables propias las completa el back con su valor guardado. Sin
etiquetas: un faltante se registra por su clave.

**P4. Qué hace el consumidor si al enviar la conexión ya no está activa, el añadido se apagó, la
credencial es ilegible o el contacto se bloqueó.** La ficha no lo dice. *Por defecto:* `FAILED` sin
llamar a Meta y `200` (R19), con motivos propuestos en `design.md > 7`. Reintentar no lo arregla
(mismo criterio que D3).

**P5. ¿El barrido de `SENDING` atascados aplica también a los envíos de usuario (QC-240)?** QC-240
§9 dejó el `SENDING` colgado sin barrido y dijo que «sería de QC-241». *Por defecto:* **solo origen
`SYSTEM`** (R33), porque la ficha habla de los envíos del sistema y ampliar cambiaría el comportamiento
aprobado de QC-240.

**P6. Textos de los motivos nuevos** (`errorReason` del atascado, del agotado y de R19). Propuesta en
`design.md > 7`; el humano los ve al aprobar.

**P7. La «guardia de imports de `@upstash/qstash`» no existe como test.** Buscado en `tests/`: no hay
ninguna guardia que fije los importadores; la «lista» vive solo en la fila de `docs/dependencias.md`
(«Aislada en dos archivos») y en los comentarios de los dos adaptadores de `documentos`. *Por
defecto:* esta feature **crea** la guardia `tests/guards/guard-qstash-aislado.test.ts` con la lista
cerrada de importadores (forma de `guard-envio-de-correo.test.ts`), y actualiza la fila y los dos
comentarios.

**P8. URL que llama la cola.** `QSTASH_TARGET_URL` es la de documentos. *Por defecto:* sin variable
nueva: `APP_BASE_URL` + `/api/integraciones/whatsapp/envios`, y se reutilizan `QSTASH_TOKEN`,
`QSTASH_CURRENT_SIGNING_KEY` y `QSTASH_NEXT_SIGNING_KEY` (la misma cuenta de QStash). Sin
`APP_BASE_URL`, la publicación falla y R11 se aplica.

**P9. Vínculo del contacto que crea o vincula `enqueue`.** *Por defecto:* vínculo **de sistema**
(`customerLinkedBy` nulo), porque no hay usuario; el recálculo de QC-239 puede rehacerlo si el número
cambia de dueño.

**P10. Añadido apagado en el barrido.** *Por defecto:* R34 (no se republica; los `QUEUED` viejos de
esa empresa pasan a `FAILED`), para que un aviso viejo no salga días después al reactivar el añadido.
