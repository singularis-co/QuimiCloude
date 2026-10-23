# QC-245 — contactos-whatsapp-backend · requirements.md

> **Zona:** backend · **Complejidad:** medium · **Épica:** QC-220 Integraciones ·
> **depends_on:** QC-240, QC-242 (y, a través de ellas, QC-238 y QC-239) · **Rama:**
> `feature/QC-245-contactos-whatsapp-backend`
>
> El bloque de Alcance, «Lo que NO entra», los criterios y la tabla de decisiones se copian **tal
> cual** de la ficha del board (`feature_list.json > QC-245`). Las fijó el humano antes del spec y no
> se reabren. La ficha se escribió **antes** de especificar QC-240, que ya entrega el envío, el
> reintento y la validación de la plantilla: este spec los **reutiliza** (`design.md > Lo que ya
> existe`) y lo que eso deja por decidir va a `## Preguntas abiertas`, con el default que el spec
> aplica mientras el humano no responda.

## Alcance (de la ficha)

Lo que necesita la pantalla de Contactos: permiso, consultas y Server Actions para listar
conversaciones, leer un chat, enviar y reintentar.

* **Permiso nuevo** `whatsapp.consultar`, solo para el **Administrador** (decisión del humano,
  2026-10-09), con su migración de datos como en QC-221. Ver Contactos y leer los chats lo exige;
  enviar sigue exigiendo `whatsapp.enviar` (QC-240).
* **Listar conversaciones:** solo contactos **vinculados** a un cliente activo de la empresa
  (QC-239). Por cada uno: nombre del cliente, teléfono formateado, último mensaje (texto o tipo),
  hora y **no leídos**. Orden por último mensaje, búsqueda por nombre o teléfono, paginado.
* **No leídos:** el contacto gana `lastReadAt`, compartido por la empresa. Los no leídos son los
  entrantes posteriores a esa marca. Abrir el chat la mueve al último mensaje.
* **Leer un chat:** mensajes del contacto ordenados por hora, paginados hacia atrás. Incluyen
  dirección, tipo, cuerpo, metadata del adjunto, estado, error traducido, origen (usuario o sistema)
  y quién lo envió. Devuelve también si la **ventana de 24 h** está abierta y hasta cuándo.
* **Abrir el chat de un cliente** que todavía no tiene contacto: devuelve un chat vacío con la
  ventana cerrada (el primer mensaje tiene que ser una plantilla).
* **Enviar con plantilla:** valida que la plantilla esté `APPROVED` en el catálogo (QC-242) y que la
  cantidad de parámetros coincida con sus variables, antes de llamar a QC-240.
* **Server Actions** (contrato del repo): listar conversaciones, leer chat, marcar leído, enviar
  texto, enviar plantilla, reintentar y listar plantillas aprobadas.
* **Cliente borrado:** su chat deja de aparecer y no se puede escribir. Los mensajes se conservan.
  Si ese número vuelve a escribir, queda no vinculado (QC-239).

**Lo que NO entra.** UI (ficha de pantalla de Contactos). Avisar a Meta que se leyó un mensaje (los
checks azules del lado del cliente). Descargar adjuntos. Asignar conversaciones a usuarios. Tiempo
real.

**Criterios de aceptación (de la ficha).**

* El listado muestra solo los contactos vinculados a clientes activos, ordenados por último mensaje,
  con los no leídos correctos.
* Marcar leído deja los no leídos en 0.
* El chat devuelve los mensajes paginados y el estado de la ventana de 24 h.
* Una plantilla no aprobada, o con parámetros de más o de menos, se rechaza sin llamar a Meta.
* Un cliente borrado no aparece y no se le puede escribir.
* Sin `whatsapp.consultar` las consultas se rechazan; sin `whatsapp.enviar`, los envíos.
* Ámbito por empresa; guardias, `./init.sh` y `gate-completo` en verde.

## Requisitos (EARS)

Vocabulario:

- **Consulta:** una llamada a listar conversaciones, leer un chat, marcar leído o listar plantillas
  enviables (las cuatro de esta ficha).
- **Envío:** una llamada a enviar o reintentar de QC-240 (`sendWhatsappMessage`,
  `retryWhatsappMessage`).
- **Conexión de la empresa:** la conexión de WhatsApp viva (sin borrar) de la empresa del actor.
- **Cliente activo:** cliente vivo (sin baja lógica) de la empresa del actor.
- **Conversación:** contacto de la conexión de la empresa, vinculado a un cliente activo y con al
  menos un mensaje guardado (P6).
- **Hora de un mensaje:** la hora de Meta (`metaTimestamp`) si la tiene; si no, la hora en que se
  guardó.
- **Último mensaje** de un contacto: su mensaje con la hora más reciente; a igual hora, el de
  identificador mayor.
- **Ventana abierta:** el contacto tiene `lastInboundAt` y `ahora − lastInboundAt < 24 h` (misma
  regla que QC-240).
- **Plantilla enviable:** la definición de QC-240: plantilla viva de la conexión de la empresa,
  habilitada, relacionada (`MAPPED`) y `APPROVED`.

### Permiso y autorización

- **R1.** El sistema DEBE tener el permiso `whatsapp.consultar` en el catálogo de permisos, con
  módulo `whatsapp` y acción `consultar`, y DEBE asignarlo por migración de datos y por seed **solo**
  al rol Administrador.
- **R2.** CUANDO se aplica la migración del permiso, el sistema DEBE crear la fila del permiso y su
  asignación al Administrador de forma idempotente; CUANDO se revierte, DEBE quitar exactamente esas
  filas y nada más.
- **R3.** El sistema DEBE clasificar `whatsapp.consultar` como permiso del añadido `integraciones`:
  con el añadido apagado en la empresa, el actor no lo tiene.
- **R4.** CUANDO un actor sin `whatsapp.consultar` (o sin empresa) hace una consulta, el sistema DEBE
  responder `unauthorized` antes de validar la entrada o tocar ningún puerto.
- **R5.** El sistema DEBE exigir para los envíos solo `whatsapp.enviar` (QC-240 R4) y NO DEBE exigir
  `whatsapp.consultar` para enviar ni `whatsapp.enviar` para consultar.

### Listar conversaciones

- **R6.** CUANDO un actor lista conversaciones, el sistema DEBE devolver solo conversaciones. Un
  contacto sin cliente, vinculado a un cliente dado de baja, sin mensajes, de otra conexión o de otra
  empresa NO DEBE aparecer.
- **R7.** El sistema DEBE devolver por cada conversación: el identificador del contacto y del
  cliente, el nombre del cliente (nombres y apellidos), el número del contacto en formato
  internacional, el último mensaje (dirección, tipo, vista previa, estado y hora), el número de no
  leídos y si el contacto está bloqueado.
- **R8.** La vista previa del último mensaje DEBE ser su cuerpo recortado a 120 caracteres cuando
  tiene cuerpo, y nula cuando no lo tiene; el tipo DEBE devolverse siempre para que la pantalla
  muestre «[Imagen]», etc.
- **R9.** El sistema DEBE ordenar las conversaciones por la hora de su último mensaje, de la más
  reciente a la más antigua, y a igual hora por identificador de contacto.
- **R10.** DONDE la consulta trae un texto de búsqueda no vacío, el sistema DEBE devolver solo las
  conversaciones cuyo cliente coincide por nombre (con la misma regla de palabras normalizadas que
  la búsqueda de Clientes) **o** cuyo número contiene los dígitos del texto. Un texto vacío o de solo
  espacios DEBE equivaler a no buscar.
- **R11.** DONDE la consulta trae el filtro de bloqueo, el sistema DEBE devolver todas
  (`all`, por defecto), solo las bloqueadas (`blocked`) o solo las no bloqueadas (`not_blocked`) (P7).
- **R12.** El sistema DEBE paginar el listado por número de página, con el tamaño por defecto y el
  tope de los listados del repo, y devolver el total de conversaciones y de páginas.
- **R13.** SI la empresa no tiene conexión viva, ENTONCES el listado DEBE devolver una página vacía y
  el estado de conexión nulo, sin error. Con conexión, DEBE devolver su estado (`ACTIVE`, `PENDING`,
  `ERROR` o `DISABLED`).

### No leídos y marcar leído

- **R14.** El sistema DEBE guardar en cada contacto una única marca de lectura (`lastReadAt`),
  compartida por todos los usuarios de la empresa.
- **R15.** El sistema DEBE contar como no leídos los mensajes entrantes del contacto con hora
  posterior a su marca de lectura; sin marca, todos sus entrantes.
- **R16.** CUANDO un actor marca leído un chat sin indicar mensaje, el sistema DEBE mover la marca a
  la hora del último mensaje del contacto; los no leídos de ese contacto DEBEN quedar en 0.
- **R17.** CUANDO un actor marca leído indicando un mensaje del contacto, el sistema DEBE mover la
  marca a la hora de ese mensaje (P4). SI el mensaje no existe o no es de ese contacto, ENTONCES DEBE
  responder `whatsapp_message_not_found` sin cambiar nada.
- **R18.** El sistema NO DEBE mover nunca la marca de lectura hacia atrás. Un contacto sin mensajes
  DEBE quedar como estaba.
- **R19.** SI el contacto a marcar no es una conversación de la empresa (R6), ENTONCES el sistema
  DEBE responder `whatsapp_contact_not_found` sin cambiar nada.
- **R20.** Leer un chat NO DEBE cambiar la marca de lectura (P3). CUANDO marca leído, el sistema DEBE
  devolver los no leídos que quedan.

### Leer un chat

- **R21.** CUANDO un actor lee el chat de un contacto, el sistema DEBE exigir que el contacto sea de
  la conexión de la empresa y esté vinculado a un cliente activo; SI no, ENTONCES DEBE responder
  `whatsapp_contact_not_found`, igual para los casos de inexistente, de otra empresa, sin cliente o
  con el cliente dado de baja.
- **R22.** El sistema DEBE devolver los mensajes del contacto por páginas desde el más reciente
  hacia atrás: la primera página trae los más recientes y cada página siguiente, los anteriores al
  más antiguo ya devuelto. Dentro de la página DEBEN ir ordenados por hora ascendente y, a igual
  hora, por identificador.
- **R23.** El sistema DEBE indicar si quedan mensajes anteriores y el cursor para pedirlos. SI el
  cursor no es un mensaje de ese contacto, ENTONCES DEBE responder `whatsapp_message_not_found`.
- **R24.** El sistema DEBE devolver por cada mensaje: identificador, dirección, tipo, cuerpo,
  metadata del adjunto, estado, motivo del error en español, origen (usuario, sistema o nulo en los
  entrantes), quién lo envió (identificador y nombre mostrable, o nulo), nombre de la plantilla si lo
  es, y su hora.
- **R25.** La metadata del adjunto DEBE incluir solo lo que describe el mensaje sin descargarlo:
  tipo MIME, nombre de archivo y pie en imagen, audio, video, documento y sticker; latitud, longitud,
  nombre y dirección en ubicación; emoji y mensaje al que reacciona en reacción. NO DEBE incluir el
  identificador del archivo en Meta. *(Enmienda 1: el mensaje al que reacciona se identifica por su
  id interno, R49; los medios visibles llevan además la dirección de su archivo, R48.)*
- **R26.** CUANDO un mensaje fallido tiene código de error, el sistema DEBE devolver como motivo el
  texto en español de la tabla de QC-240 para ese código, y NO DEBE devolver el texto original de
  Meta. SI no tiene código, ENTONCES DEBE devolver el motivo guardado o, si no lo hay, «No se pudo
  enviar el mensaje.» (P8).
- **R27.** CUANDO un mensaje tiene autor, el sistema DEBE devolver su nombre mostrable aunque la
  cuenta esté dada de baja o desactivada; SI el directorio de personas no lo devuelve, ENTONCES el
  nombre DEBE ser nulo.
- **R28.** El sistema DEBE devolver con el chat el estado de la ventana de 24 h: abierta o cerrada
  y, si está abierta, la hora a la que se cierra (`lastInboundAt + 24 h`); cerrada, hora nula.
- **R29.** El sistema DEBE devolver con el chat la cabecera del contacto: identificadores de contacto
  y cliente, nombre del cliente, número en formato internacional, si está bloqueado y sus no leídos.
- **R30.** CUANDO un actor abre el chat de un cliente, el sistema DEBE exigir que sea un cliente
  activo; SI no, ENTONCES DEBE responder `customer_not_found`. SI el cliente tiene conversaciones,
  ENTONCES DEBE devolver el chat de la de último mensaje más reciente (P5); SI no tiene ninguna,
  ENTONCES DEBE devolver un chat vacío, sin contacto, con la ventana cerrada y los datos del cliente.
- **R31.** El sistema DEBE paginar el chat con 30 mensajes por defecto y un tope de 50 (P12).

### Plantillas enviables

- **R32.** CUANDO un actor lista las plantillas para el chat, el sistema DEBE devolver solo las
  plantillas enviables de la conexión de la empresa; sin conexión viva, una lista vacía.
- **R33.** El sistema DEBE devolver por cada plantilla su identificador, nombre, idioma, categoría,
  contenido y sus variables con hueco, posición, tipo (constante o propia), clave, etiqueta (solo
  propias) y, en las propias, su valor vigente (P9).

### Envío desde Contactos (reutiliza QC-240)

- **R34.** El sistema DEBE ofrecer enviar texto, enviar plantilla y reintentar con las Server
  Actions de QC-240 (`sendWhatsappMessageAction` con `kind: 'text'` o `kind: 'template'`, y
  `retryWhatsappMessageAction`). Esta ficha NO DEBE añadir otro camino de envío (P1).
- **R35.** CUANDO desde Contactos se envía una plantilla no enviable, o le falta el valor de alguna
  constante, el sistema DEBE rechazarla antes de llamar a Meta y sin escribir ningún mensaje, con los
  errores de QC-240 (`whatsapp_template_not_sendable`, `missing_values`) (P2).

### Cliente borrado

- **R36.** CUANDO se da de baja un cliente, el sistema DEBE dejar de mostrar sus conversaciones en el
  listado (R6), responder `whatsapp_contact_not_found` al leer o marcar su chat (R19, R21) y
  `customer_not_found` al abrirlo por cliente (R30); un envío a ese contacto o a ese cliente DEBE
  rechazarse antes de llamar a Meta (QC-240 R5, R6).
- **R37.** CUANDO se da de baja un cliente, el sistema NO DEBE borrar ni modificar sus contactos ni
  sus mensajes.
- **R38.** CUANDO escribe un número cuyo único cliente está dado de baja, el sistema DEBE guardar el
  mensaje con el contacto sin cliente (QC-239 R17) y ese contacto NO DEBE aparecer en el listado.

### Ámbito, datos y entrega

- **R39.** Toda lectura y escritura de una consulta DEBE limitarse a la empresa del actor. Un
  identificador de contacto, cliente, mensaje o plantilla de otra empresa DEBE tratarse como
  inexistente.
- **R40.** El sistema DEBE ofrecer las cuatro consultas como Server Actions que devuelven
  `{ status: 'success', data }` o el error traducido del catálogo, sin pantalla propia.
- **R41.** El sistema NO DEBE escribir en el log el cuerpo de los mensajes, el número de los
  contactos ni el nombre de los clientes.
- **R42.** La migración de esquema DEBE tener su `down.sql`, que deja el esquema como antes.
- **R43.** El sistema DEBE verificar las consultas con tests unitarios de los casos de uso y tests de
  integración contra la base de test; esta ficha no tiene E2E de navegador (lo trae QC-246).

### Enmienda 1 (2026-10-23): lo que añade la pantalla ampliada de QC-246

El humano pidió «actualiza el spec y el contrato» el 2026-10-23, después de ampliar la ficha de
QC-246 con sus decisiones D5–D7 (aquí D6–D8); el mismo día cerró D9–D11. Esa ampliación cambia una
línea de «Lo que NO entra»:
**las imágenes y los stickers entrantes se sirven** (D7). Audio, video y documentos siguen sin
descargarse.

Vocabulario añadido:

- **Medio visible:** mensaje entrante de tipo imagen o sticker que guarda el identificador de su
  archivo en Meta.
- **Pedidos del cliente:** sus pedidos vivos (sin baja) de la empresa del actor, salvo los
  cancelados; los 20 de fecha de solicitud más reciente, de más reciente a más antiguo (P15).
- **Pedido elegido:** el que indica la pantalla o, si no indica ninguno, el primero de los pedidos
  del cliente.
- **Contexto del chat:** los pedidos del cliente, el pedido elegido y los valores por defecto de
  las variables de plantilla, para un contacto o un cliente.

#### Archivo de un medio

- **R44.** CUANDO se pide el archivo de un mensaje, el sistema DEBE exigir sesión con
  `whatsapp.consultar` y que el mensaje sea un medio visible de un contacto de la conexión de la
  empresa vinculado a un cliente activo. SI falta cualquiera de esas condiciones, ENTONCES DEBE
  responder «no encontrado» (HTTP 404) sin cuerpo, igual en todos los casos, y sin llamar a Meta.
- **R45.** CUANDO se pide el archivo de un medio visible de la empresa, el sistema DEBE descargarlo
  de Meta con el token de la conexión y devolverlo con su tipo de contenido, sin guardarlo en
  ningún almacenamiento propio (D9).
- **R46.** SI el token no se puede leer, Meta no responde o rechaza la descarga, el archivo supera
  5 MB o su tipo no es `image/jpeg`, `image/png` ni `image/webp`, ENTONCES el sistema DEBE responder
  «no disponible» (HTTP 502) sin cuerpo y sin guardar ninguna parte del archivo.
- **R47.** El sistema NO DEBE devolver en ninguna respuesta el identificador del archivo en Meta, la
  URL de descarga de Meta ni el token. La respuesta con el archivo DEBE marcarse como privada para
  la caché y NO DEBE poder interpretarse como otro tipo de contenido.
- **R48.** El sistema DEBE devolver en el adjunto de cada medio visible la dirección de la
  aplicación desde la que se pide su archivo; en los demás adjuntos de medio (audio, video,
  documento, o imagen o sticker sin archivo) esa dirección DEBE ser nula.

#### Reacciones

- **R49.** El sistema DEBE identificar el mensaje al que reacciona una reacción por el
  identificador interno con que ese mensaje aparece en el chat, cuando está guardado en el mismo
  contacto; SI no lo está, ENTONCES DEBE devolverlo nulo. NO DEBE devolver el identificador de Meta
  (`wamid`) en ningún mensaje del chat.

#### Contexto del chat

- **R50.** CUANDO un actor pide el contexto del chat, el sistema DEBE exigir `whatsapp.consultar`
  antes de validar la entrada o tocar ningún puerto (`unauthorized`, R4) y aplicar las reglas de
  existencia de leer el chat: por contacto, las de R21 (`whatsapp_contact_not_found`, también sin
  conexión); por cliente, las de R30 (`customer_not_found`), sin depender de la conexión.
- **R51.** El sistema DEBE devolver con el contexto los pedidos del cliente, cada uno con:
  identificador, número visible, estado, fecha de solicitud, total, nombre del producto y, por cada
  línea de su reparto en orden de alta, la presentación (identificador y nombre), los envases
  pedidos, los entregados y los que faltan por entregar. NO DEBE devolver fecha de entrega (D10).
- **R52.** Los envases de cada línea DEBEN coincidir con los que muestra Pedidos: pedidos = los que
  el pedido espera de esa línea (el conteo del empaque si lo hay, menos el excedente), entregados =
  los entregados sin contar lo anulado, y por entregar = el mayor entre 0 y pedidos − entregados.
- **R53.** El sistema DEBE devolver el total nulo en todos los pedidos mientras el precio de venta del
  pedido no exista en el sistema (D11).
- **R54.** DONDE la consulta indica un pedido, el sistema DEBE tomarlo como pedido elegido; SI no
  está entre los pedidos del cliente (inexistente, de otro cliente, de otra empresa, dado de baja,
  cancelado o fuera de los 20), ENTONCES DEBE responder `order_not_found` sin devolver datos. Sin
  pedidos del cliente, el pedido elegido DEBE ser nulo.
- **R55.** El sistema DEBE devolver con el contexto un objeto de valores con una entrada por cada
  constante del catálogo del sistema —`cliente.nombre`, `empresa.nombre` y `pedido.numero` (P18)— y
  una por cada variable propia de la empresa, con su clave.
- **R56.** El valor de `cliente.nombre` DEBE ser los nombres y apellidos del cliente; el de
  `empresa.nombre`, el nombre de la empresa del actor; el de `pedido.numero`, el número visible del
  pedido elegido; el de cada variable propia, su valor vigente. SI un valor no se puede resolver,
  ENTONCES su entrada DEBE ser nula: nunca omitida ni una cadena vacía.
- **R57.** Pedir el contexto NO DEBE escribir nada ni mover la marca de lectura, y DEBE limitarse a
  la empresa del actor: un contacto, cliente o pedido de otra empresa DEBE tratarse como
  inexistente.

#### Entrega y verificación

- **R58.** El sistema DEBE ofrecer el contexto como Server Action con la forma de R40 y el archivo
  como ruta HTTP `GET` de la aplicación, utilizable directamente como fuente de una imagen con la
  sesión del navegador. Ninguna de las dos DEBE escribir en el log el cuerpo de los mensajes, el
  número, el nombre del cliente ni el identificador del archivo.
- **R59.** El sistema DEBE verificar la enmienda con tests unitarios (dominio, casos de uso, cliente
  de Graph y ruta, con Graph doble) y de integración contra la base de test (pedidos del cliente,
  nombre de la empresa, mensajes de medio y reacciones, y el flujo completo).

### Cobertura de las decisiones cerradas

| Decisión | Requisitos |
|---|---|
| D1 `whatsapp.consultar` solo para el Administrador | R1–R5, R44, R50 |
| D2 Solo contactos vinculados a un cliente activo | R6, R21, R30, R38, R44, R50 |
| D3 No leídos compartidos por empresa (`lastReadAt` en el contacto) | R14–R20, R57 |
| D4 La plantilla se valida contra el catálogo aquí | R32, R35 (validación de QC-240, P2) |
| D5 Cliente borrado: chat oculto, mensajes conservados | R36–R38, R44 |
| D6 Plantillas sin pedir variables: el back da los valores por defecto y el pedido elegido | R50, R54–R56 |
| D7 Imágenes y stickers se ven; el resto de adjuntos, no | R44–R48 |
| D8 Detalle del pedido por presentación × envases, entregado y faltante | R51, R52 |
| D9 Medios por proxy en cada vista, nada guardado | R45, R46 |
| D10 Sin fecha de entrega | R51 |
| D11 `total: null` hasta QC-307 | R53 |

## Preguntas abiertas

Cada una con el default que este spec ya aplica. Si el humano responde otra cosa, se corrige el
requisito citado antes de aprobar.

- **P1 — Solape con QC-240.** La ficha pide Server Actions de «enviar texto», «enviar plantilla» y
  «reintentar» y validar la plantilla «antes de llamar a QC-240». QC-240 (mergeada, PR #305) ya
  entrega `sendWhatsappMessageAction` (texto o plantilla por `kind`) y `retryWhatsappMessageAction`,
  y valida plantilla y valores antes de Meta. **Default:** se reutilizan tal cual; esta ficha no crea
  acciones de envío ni repite la validación (R34, R35). Se anota en «Lo que NO entra» al aprobar.
- **P2 — «Parámetros de más o de menos».** Con QC-240 (A1) el front no manda parámetros por posición:
  manda valores por clave de constante y el back arma los `{{n}}` desde el mapeo, así que la cantidad
  siempre coincide. «De menos» = constante sin valor: QC-240 lo rechaza (`missing_values`). «De más» =
  claves que la plantilla no usa: QC-240 las **ignora**. **Default:** se mantiene (R35). Alternativa:
  rechazar claves desconocidas con `invalid_input`, que cambia el contrato de QC-240.
- **P3 — Quién mueve la marca de lectura.** **Default:** una acción propia «marcar leído»; leer el
  chat no escribe (R20). QC-246 la llama al abrir el chat y tras cada consulta periódica que traiga
  entrantes nuevos.
- **P4 — Hasta dónde marca.** **Default:** hasta el mensaje que indique la pantalla (el último que
  mostró) o, si no indica, hasta el último del contacto (R16, R17). Así un entrante que llega entre
  leer y marcar no queda leído sin verse.
- **P5 — Cliente con varias conversaciones** (varios teléfonos, QC-239). **Default:** abrir por
  cliente devuelve la de último mensaje más reciente (R30); el listado muestra todas.
- **P6 — Contacto vinculado sin mensajes.** **Default:** no es conversación y no aparece en el
  listado (R6); su chat sí se puede leer por contacto (R21) y queda vacío.
- **P7 — Bloqueados.** QC-239 dejó «el filtro de bloqueados» para esta ficha; la ficha no lo nombra.
  **Default:** el listado los incluye con la marca `isBlocked` y acepta el filtro `all` /
  `blocked` / `not_blocked`, por defecto `all` (R7, R11).
- **P8 — Motivo de un fallo que llegó por webhook.** QC-238 guarda el texto de Meta (en inglés) como
  motivo. **Default:** con código se muestra el texto en español de la tabla de QC-240; sin código, el
  guardado o «No se pudo enviar el mensaje.» (R26).
- **P9 — Valor de las variables propias en el selector de plantillas.** **Default:** se devuelve el
  valor vigente para la vista previa (R33). El usuario no lo edita: el back lo pone al enviar.
- **P10 — Conversaciones de una conexión anterior** (borrada y vuelta a crear). **Default:** no se
  muestran; el listado y el chat solo ven la conexión viva (vocabulario, R6, R21).
- **P11 — Números desconocidos.** QC-239 decía que QC-245 los mostraría «con el número como nombre»;
  D2 de esta ficha dice solo vinculados, y QC-240 P1 ya se aprobó así. **Default:** manda D2: no se
  listan (R6).
- **P12 — Tamaños de página.** **Default:** listado con los de `lib/shared/pagination` (10 por
  defecto, tope 25); chat 30 por defecto, tope 50 (R12, R31).
- **P13 — Reacciones entrantes.** **Default:** cuentan como mensaje entrante: suben a último mensaje
  y suman no leídos (R8, R15).

Abiertas por la Enmienda 1 (2026-10-23):

- **P14 — Medios: proxy o copia propia.** Cerrada por el humano el 2026-10-23: D9.
- **P15 — Qué pedidos van al selector.** **Default:** los vivos del cliente salvo los cancelados, los
  20 de fecha de solicitud más reciente, el más reciente primero (vocabulario de la Enmienda 1,
  R51, R54). Alternativas: incluir los cancelados, o solo los que no están entregados.
- **P16 — Fecha de entrega.** Cerrada por el humano el 2026-10-23: D10.
- **P17 — Total del pedido.** Cerrada por el humano el 2026-10-23: D11.
- **P18 — Catálogo de constantes del sistema.** El único catálogo escrito es el del front de QC-243
  (`design.md > 5`): `cliente.nombre`, `empresa.nombre`, `pedido.numero`. **Default:** el back
  resuelve esas tres (R55). Los datos permitirían además `cliente.nombres`, `cliente.apellidos`,
  `cliente.ciudad`, `cliente.correo`, `cliente.direccion`, `empresa.telefono`, `empresa.correo`,
  `pedido.estado`, `pedido.fecha_solicitud` y `pedido.total` (siempre nulo, D11); no
  `pedido.fecha_entrega` (D10). Ampliar el catálogo exige cambiarlo también en el front de
  plantillas.
- **P19 — Pedidos con solo `whatsapp.consultar`.** El contexto enseña número, estado, producto y
  envases de los pedidos del cliente a quien tenga `whatsapp.consultar`, aunque no tenga
  `pedidos.consultar`. **Default:** basta `whatsapp.consultar` (hoy solo el Administrador, que tiene
  los dos, D1). Si otro rol recibe el permiso, se revisa.

## Decisiones cerradas (no reabrir)

Copiadas de la ficha (`feature_list.json > QC-245`).

| # | Decisión | Por qué |
| --- | --- | --- |
| D1 | `whatsapp.consultar` solo para el Administrador (decisión del humano) | Las conversaciones pueden traer datos sensibles; ampliar después es solo asignar el permiso. |
| D2 | Solo contactos vinculados a un cliente activo | Decisión del humano: solo se conversa con clientes. |
| D3 | No leídos compartidos por empresa (`lastReadAt` en el contacto) | Con un solo rol que atiende, no hace falta llevarlo por usuario. |
| D4 | La plantilla se valida contra el catálogo aquí | El error se da antes de llamar a Meta, con un mensaje claro. |
| D5 | Cliente borrado: chat oculto, mensajes conservados | No se pierde historial por un borrado lógico. |
| D6 | (2026-10-23, de D5 de QC-246, decisión del humano) Las plantillas no piden variables: el back entrega los valores por defecto (constantes del sistema y variables propias) y los pedidos del cliente, y el valor de `pedido.*` sale del pedido elegido | Menos pasos para el usuario; los datos ya están en el sistema. |
| D7 | (2026-10-23, de D6 de QC-246, decisión del humano) Imágenes y stickers entrantes se sirven a la pantalla; audio, video y documentos siguen sin descargarse | Son los adjuntos que el usuario necesita mirar para responder. |
| D8 | (2026-10-23, de D7 de QC-246, decisión del humano) El detalle del pedido da, por línea, la presentación × envases pedidos, los entregados y los que faltan, no litros | Es como se piensa y se despacha un pedido. |
| D9 | (2026-10-23, decisión del humano) El archivo de una imagen o un sticker se descarga de Meta en cada vista y no se guarda nada. Que la imagen deje de verse cuando Meta la caduca (unos 30 días) se acepta. Guardarla en Storage es la alternativa descartada | Sin almacenamiento ni datos nuevos que custodiar; basta para responder conversaciones recientes. |
| D10 | (2026-10-23, decisión del humano) Sin fecha de entrega: el contrato no tiene ese campo y el detalle del pedido no la muestra | El pedido no tiene esa fecha en la base. |
| D11 | (2026-10-23, decisión del humano) `total: null` hasta que entre QC-307; QC-245 no la espera. El campo sigue en el contrato y la pantalla lo oculta si es nulo | No bloquear la ficha por otra en curso; el contrato no cambia cuando llegue el precio. |
