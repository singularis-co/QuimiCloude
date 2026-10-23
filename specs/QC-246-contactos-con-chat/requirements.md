# QC-246 — contactos-con-chat · requirements.md

> Zona `frontend`. Depende de QC-245 (Server Actions de conversaciones, `in_progress`, su spec se
> reabre por la ampliación del 2026-10-23) y de QC-244 (lugar de «Contactos» en el menú, hecho).
> Se especifica contra el **contrato publicado** en la tarjeta (bloque «Contrato del backend
> (QC-245)») y `specs/QC-245-contactos-whatsapp-backend/design.md > Contrato para la pantalla`.
> Lo que depende de la ampliación de QC-245 lleva **[ABIERTO: depende de la ampliación de QC-245]**
> con el default que se implementa mientras no llegue (lista en `## Dependencias abiertas`).

## Alcance

Copiado de la tarjeta (2026-10-23); no se reabre.

`/clientes/contactos` deja de ser un placeholder (QC-244) y pasa a mostrar las conversaciones de
WhatsApp con los clientes. Consume los Server Actions de QC-245.

- **Acceso:** la página y el hijo «Contactos» del menú pasan de `clientes.consultar` a
  `whatsapp.consultar`. Sin conexión de WhatsApp: estado vacío «WhatsApp no está conectado», con un
  enlace a Integraciones.
- **Diseño:** en escritorio, dos columnas (lista | chat). En el móvil, una pantalla a la vez, con
  botón para volver.
- **Lista:** nombre del cliente, teléfono, vista previa del último mensaje, hora y contador de no
  leídos. Buscador. Estado vacío «Aún no hay conversaciones». Carga por partes al llegar al final
  del scroll, con «Cargando más conversaciones…».
- **Chat:** burbujas entrantes y salientes con hora; en las salientes, quién la envió o «Sistema».
  Estados enviando / enviado / entregado / leído / fallido (con motivo y «Reintentar»). Tipos:
  texto; imagen (miniatura, caption, visor a pantalla completa); sticker (sin burbuja, hora debajo);
  ubicación (tarjeta con mapa, lugar, dirección y «Abrir en el mapa»); audio, video y documento como
  etiqueta con su caption; reacción pegada a su mensaje; «Mensaje no soportado». Carga los
  anteriores al subir.
- **Escribir:** ventana abierta → caja y enviar (Enter envía, Shift+Enter salto), con cuánto falta
  para el cierre. Ventana cerrada → caja deshabilitada, aviso y «Enviar plantilla» con selector de
  plantilla y, si hay más de un pedido, de pedido; sin pedir variables. Chat sin mensajes → una
  burbuja por plantilla aprobada sobre la caja; elegirla rellena la caja con el texto resuelto,
  pulsarla otra vez lo quita; en el móvil bajan de línea. Valores por defecto: `cliente.*`,
  `empresa.*`, `pedido.*` (pedido más reciente) y variables propias; lo que falta sale
  `[falta <clave>]`. Selector «Pedido» en la cabecera (solo con más de uno) que recalcula el
  mensaje, y flecha que despliega el detalle del pedido (número, estado, fecha de entrega, total y,
  por producto, presentación × cantidad, entregado y faltante).
- **Actualización:** consulta cada 5–10 s con la pestaña visible; se pausa si no lo está. Sin
  tiempo real.
- **Desde Clientes:** acción «Abrir chat» (solo con `whatsapp.consultar` y teléfono válido) que
  lleva a `/clientes/contactos?cliente=<id>`.

**Lo que NO entra.** Ver o descargar audio, video y documentos (imágenes y stickers sí se ven).
Descargar imágenes. Enviar adjuntos. Notificaciones del navegador. Tiempo real. Server Actions,
base de datos y migraciones (los entrega QC-245). Botones de vincular, desvincular y bloquear el
contacto en el chat: van a **QT-299** (chat-vincular-bloquear-contacto, depende de QC-246) (D12).

## Decisiones cerradas (no reabrir)

| # | Decisión | Por qué | Cubierta por |
|---|---|---|---|
| D1 | `whatsapp.consultar` para ver Contactos, solo Administrador (humano, 2026-10-09) | Las conversaciones pueden traer datos sensibles. | R1, R2, R45 |
| D2 | Consulta periódica en lugar de tiempo real | Con pocas empresas alcanza; se pausa con la pestaña oculta. | R42, R43, R44 |
| D3 | Fuera de la ventana, solo plantilla desde un selector | Regla de Meta, explicada en pantalla en lugar de fallar al enviar. | R30, R31 |
| D4 | 100 % frontend; los Server Actions vienen de QC-245 | Cada ficha respeta su zona. | R48 |
| D5 | Las plantillas no piden variables: se resuelven con el objeto por defecto y el pedido elegido (humano, 2026-10-23) | Menos pasos; los datos ya están en el sistema. | R31, R33, R34, R35, R37 |
| D6 | Imágenes y stickers se ven; el resto de adjuntos sigue como etiqueta (humano, 2026-10-23) | Son los adjuntos que hay que mirar para responder. | R19, R20, R21 |
| D7 | El detalle del pedido muestra presentación × cantidad, entregado y faltante, no litros (humano, 2026-10-23) | Es como se piensa y se despacha un pedido. | R39 |
| D8 | Se especifica contra el contrato publicado de QC-245; lo de la ampliación queda abierto con default (humano, 2026-10-23, `progress/features/QC-246.md > Evaluación`) | QC-245 sigue en vuelo y su spec se reabre. | R20, R21, R23, R35, R38, R39 |
| D9 | Se acepta el choque con QC-166 en `lib/shared/navigation/private-nav.ts`: se rebasa sobre `dev` antes de tocarlo y solo se toca la entrada de Contactos (humano, 2026-10-23) | `archivos-en-vuelo.mjs` lo marca; el cambio aquí es una línea de permiso. | R2 |
| D10 | Los siete tableros del pase `/design` ya están en `docs/diseno/canvas/` (`Contactos`, `ContactosVentanaCerrada`, `ContactosVacios`, `ContactosNuevoChat`, `ContactosMovil`, `ContactosChatMovil`, `ContactosNuevoChatMovil`) (humano, 2026-10-23) | Son la referencia visual aprobada; se citan en `design.md > Referencia de diseño`. | R5, R6, R7 |
| D11 | El texto de la plantilla rellenada es de solo lectura (cierra P1; humano, 2026-10-23) | Una plantilla editada deja de ser la aprobada y la acción de envío no recibe texto. | R34 |
| D12 | Los botones de vincular, desvincular y bloquear no entran: van a QT-299 (chat-vincular-bloquear-contacto, depende de QC-246) (cierra P3; humano, 2026-10-23) | QC-245 (D2) lista solo contactos vinculados; la tarjeta de QC-246 no los incluye. | — (exclusión de alcance, sin requisito: ver «Lo que NO entra») |

## Requisitos (EARS)

Convenciones: «ancho de escritorio» = ventana de 768 px o más; «ancho de teléfono» = menos de
768 px. «Enviables» = las plantillas que devuelve `listSendableWhatsappTemplatesAction`. Los textos
entre comillas son literales de pantalla.

### Acceso y estados de la página

- **R1** — CUANDO alguien abre `/clientes/contactos`, el sistema DEBE exigir `whatsapp.consultar`:
  sin sesión, redirigir al login; con sesión y sin el permiso, responder 404, antes de pedir ningún
  dato.
- **R2** — MIENTRAS la sesión no traiga `whatsapp.consultar`, el menú lateral NO DEBE mostrar el
  hijo «Contactos» del grupo Clientes.
- **R3** — SI la consulta de conversaciones devuelve `connectionStatus: null`, ENTONCES el sistema
  DEBE mostrar, en lugar de la lista y el chat, el estado «WhatsApp no está conectado» con el texto
  «Conecta la cuenta de WhatsApp de la empresa para ver y responder las conversaciones con tus
  clientes.» y, DONDE la sesión trae `integraciones.modificar`, el enlace «Ir a Integraciones» a la
  pantalla de WhatsApp de Integraciones.
- **R4** — SI una carga inicial (lista, chat o plantillas) devuelve un error, ENTONCES el sistema
  DEBE mostrar el `message` del error, su referencia si es `unexpected`, y un botón «Reintentar»
  que repite esa carga.

### Disposición

- **R5** — MIENTRAS el ancho sea de escritorio, el sistema DEBE mostrar la lista de conversaciones
  y el chat seleccionado lado a lado; SI no hay chat seleccionado, ENTONCES el panel del chat DEBE
  mostrar un estado neutro [ABIERTO P6: texto; default «Elige una conversación para verla aquí.»].
- **R6** — MIENTRAS el ancho sea de teléfono, el sistema DEBE mostrar solo la lista o solo el chat;
  CUANDO se abre una conversación, DEBE pasar al chat, y CUANDO se pulsa «Volver a conversaciones»
  (o «Atrás» del navegador), DEBE volver a la lista.
- **R7** — MIENTRAS el ancho sea de teléfono (probado a 360 px), ningún estado de la pantalla
  (lista, chat con cada tipo de mensaje, burbujas de plantillas, detalle del pedido, diálogo de
  plantilla y visor de imagen) DEBE producir scroll horizontal.

### Lista de conversaciones

- **R8** — El sistema DEBE pintar cada conversación con el nombre del cliente, su teléfono, la
  vista previa del último mensaje, su hora y, SI tiene no leídos, un contador con nombre accesible
  «N sin leer», en el orden que devuelve el servidor.
- **R9** — SI el último mensaje no trae vista previa, ENTONCES la lista DEBE mostrar la etiqueta de
  su tipo: «[Imagen]», «[Sticker]», «[Audio]», «[Video]», «[Documento]», «[Ubicación]», «Reacción»
  o «Mensaje no soportado».
- **R10** — El sistema DEBE formatear la hora de la lista, en la hora local del navegador, como
  `HH:mm` si es de hoy, «Ayer» si es de ayer, el día abreviado («Lun») si es de los últimos siete
  días y `dd/MM` si es anterior.
- **R11** — CUANDO el usuario deja de escribir en el buscador «Buscar por nombre o teléfono»
  (máximo 100 caracteres), el sistema DEBE volver a pedir la lista desde la página 1 con ese texto
  y reemplazar la que se muestra.
- **R12** — SI hay conexión, no hay búsqueda y la lista está vacía, ENTONCES el sistema DEBE
  mostrar «Aún no hay conversaciones» con el texto «Cuando un cliente te escriba por WhatsApp, o
  abras un chat desde Clientes, aparecerá aquí.»; SI hay búsqueda y no hay resultados, ENTONCES
  DEBE mostrar un vacío de búsqueda con la opción de limpiarla [ABIERTO P6: texto; default «No hay
  conversaciones que coincidan con la búsqueda.»].
- **R13** — CUANDO el final de la lista entra en vista y quedan páginas, el sistema DEBE pedir la
  página siguiente, añadirla al final sin repetir conversaciones y mostrar «Cargando más
  conversaciones…» mientras llega.
- **R14** — CUANDO el usuario pulsa una conversación, el sistema DEBE abrir su chat y marcarla como
  la seleccionada en la lista.

### Cabecera del chat y ventana de 24 h

- **R15** — El sistema DEBE pintar en la cabecera del chat el nombre del cliente, el teléfono y el
  estado de la ventana: «Ventana abierta · se cierra en H h M min» (o «… se cierra en M min» con
  menos de una hora) si está abierta, y «Ventana cerrada» si no.
- **R16** — MIENTRAS la ventana esté abierta, el sistema DEBE recalcular el tiempo restante al
  menos una vez por minuto y, CUANDO llega `closesAt`, pasar al estado de ventana cerrada (R30) sin
  recargar.

### Mensajes

- **R17** — El sistema DEBE pintar los mensajes de más antiguo a más reciente, los entrantes a la
  izquierda y los salientes a la derecha, cada uno con su hora `HH:mm`, con un separador de día
  «Hoy», «Ayer» o la fecha `dd/MM/yyyy` cuando cambia el día.
- **R18** — El sistema DEBE pintar en cada saliente su autor: el nombre de quien lo envió si el
  origen es usuario, o «Sistema» si el origen es sistema.
- **R19** — El sistema DEBE pintar el estado de cada saliente con icono y nombre accesible:
  «Enviando» (reloj) para `QUEUED`, `SENDING` y el envío en curso; «Enviado» (✓) para `SENT`;
  «Entregado» (✓✓) para `DELIVERED`; «Leído» (✓✓ azul) para `READ`; y SI es `FAILED`, ENTONCES
  DEBE pintar la burbuja en tono de error con «No se pudo enviar: <motivo>».
- **R20** — El sistema DEBE pintar por tipo: `TEXT`, `TEMPLATE`, `BUTTON` e `INTERACTIVE` con
  cuerpo como texto; `AUDIO`, `VIDEO` y `DOCUMENT` como «[Audio]», «[Video]» o «[Documento]» con su
  caption y sin el archivo; y `UNSUPPORTED`, `CONTACTS` y cualquier mensaje sin contenido que
  pintar como «Mensaje no soportado» [ABIERTO P8: `CONTACTS` e `INTERACTIVE`].
- **R21** — DONDE un mensaje `IMAGE` trae su archivo servido [ABIERTO A1: depende de la ampliación
  de QC-245], el sistema DEBE mostrar su miniatura con el caption y, CUANDO se pulsa, abrir un visor
  a pantalla completa con la imagen, el caption, el nombre del cliente y la hora, que se cierra con
  «Cerrar imagen» en escritorio, con la flecha de volver en teléfono y con Escape. SI no trae
  archivo, ENTONCES DEBE mostrar el recuadro «[Imagen]» con el caption, sin abrir visor.
- **R22** — El sistema DEBE pintar un mensaje `STICKER` sin burbuja, como imagen de 128 px con la
  hora debajo; SI no trae archivo servido [ABIERTO A1], ENTONCES como recuadro «[Sticker]» del
  mismo tamaño.
- **R23** — El sistema DEBE pintar un mensaje `LOCATION` como tarjeta con el nombre del lugar y la
  dirección cuando vienen, y el enlace «Abrir en el mapa» que abre en una pestaña nueva un mapa en
  sus coordenadas [ABIERTO P5: proveedor del mapa].
- **R24** — El sistema NO DEBE pintar una reacción como mensaje aparte: DEBE pintar su emoji pegado
  a la esquina inferior del mensaje reaccionado, con nombre accesible «Reacción del cliente:
  <emoji>»; con varias reacciones sobre el mismo mensaje, DEBE mostrar la más reciente, y SI la más
  reciente trae emoji nulo, ENTONCES no DEBE mostrar ninguna. SI el mensaje reaccionado no está
  entre los cargados o no se puede identificar, ENTONCES la reacción no se muestra hasta que lo esté
  [ABIERTO A2: depende de la ampliación de QC-245].
- **R25** — CUANDO el usuario llega al inicio del historial y quedan mensajes anteriores, el sistema
  DEBE pedirlos, añadirlos arriba sin mover lo que el usuario está viendo y mostrar «Cargando
  mensajes anteriores…» mientras llegan.
- **R26** — CUANDO se abre un chat, el sistema DEBE mostrar el mensaje más reciente; CUANDO llega un
  mensaje nuevo, DEBE desplazarse a él solo si el usuario ya estaba al final.

### No leídos

- **R27** — CUANDO se abre un chat que tiene conversación, el sistema DEBE marcarla leída hasta el
  último mensaje mostrado y dejar en 0 el contador de esa conversación en la lista.
- **R28** — CUANDO una consulta periódica trae entrantes nuevos al chat abierto con la pestaña
  visible, el sistema DEBE volver a marcarla leída hasta el último mensaje mostrado.

### Escribir

- **R29** — MIENTRAS la ventana esté abierta, el sistema DEBE ofrecer la caja «Escribe un mensaje»
  y el botón «Enviar»: Enter envía, Shift+Enter inserta un salto de línea, y un texto vacío, solo de
  espacios o de más de 4096 caracteres no se puede enviar.
- **R30** — MIENTRAS la ventana esté cerrada y el chat tenga mensajes, el sistema DEBE deshabilitar
  la caja, mostrar el aviso «Pasaron más de 24 h desde el último mensaje del cliente: solo puedes
  enviar una plantilla aprobada.» y el botón «Enviar plantilla».
- **R31** — CUANDO se pulsa «Enviar plantilla», el sistema DEBE abrir el diálogo «Enviar plantilla»
  con el selector de plantilla (solo enviables), el selector «Pedido» solo si el cliente tiene más
  de un pedido (con el pedido elegido en el chat), y la vista previa con el texto ya resuelto; NO
  DEBE pedir el valor de ninguna variable.
- **R32** — CUANDO se envía un texto, el sistema DEBE mostrarlo al instante como saliente
  «Enviando», vaciar la caja y, al responder la acción, reemplazarlo por el mensaje devuelto («Enviado»
  o fallido con su motivo).
- **R33** — SI el chat no tiene mensajes, ENTONCES el sistema DEBE mostrar «Aún no hay mensajes con
  este cliente» con el texto «Para iniciar la conversación, WhatsApp exige una plantilla aprobada.
  Elige una abajo y se rellena el mensaje.» y, sobre la caja, una burbuja por plantilla enviable con
  su título [ABIERTO P4: título legible]; CUANDO se elige una, la caja DEBE rellenarse con su texto
  resuelto y la burbuja quedar marcada (`aria-pressed`); CUANDO se pulsa la marcada, la caja DEBE
  vaciarse y la burbuja desmarcarse; en ancho de teléfono las burbujas DEBEN bajar de línea.
- **R34** — MIENTRAS haya una plantilla elegida (burbuja o diálogo), el sistema DEBE mostrar el
  texto resuelto sin dejar editarlo (D11).
- **R35** — El sistema DEBE resolver cada `{{clave}}` de la plantilla con el objeto de valores por
  defecto —constantes `cliente.*`, `empresa.*`, `pedido.*` del pedido elegido y variables propias de
  la empresa— y, SI falta el valor de una clave, ENTONCES DEBE escribir `[falta <clave>]` en su
  lugar [ABIERTO A3/A4: depende de la ampliación de QC-245; default en `design.md > 4`].
- **R36** — SI el texto resuelto tiene alguna clave sin valor, ENTONCES el sistema DEBE deshabilitar
  el envío de esa plantilla y mostrar «Falta el valor de <etiquetas>»; SI la acción de envío
  devuelve `missing_values`, ENTONCES DEBE mostrar su `message` y no añadir ningún saliente.
- **R37** — CUANDO se envía una plantilla (desde el diálogo o desde la caja con una burbuja
  elegida), el sistema DEBE mostrarla como saliente «Enviando» y luego con el resultado, cerrar el
  diálogo o vaciar la caja y, SI el chat no tenía conversación, ENTONCES DEBE recargarlo para pasar
  a la conversación creada.
- **R38** — DONDE el cliente tiene más de un pedido [ABIERTO A3], el sistema DEBE mostrar el
  selector «Pedido» en la cabecera del chat, con el más reciente elegido al abrir; CUANDO se cambia,
  DEBE recalcular el texto resuelto de la caja y de la vista previa.
- **R39** — DONDE el cliente tiene al menos un pedido [ABIERTO A3; P10], el sistema DEBE mostrar un
  botón de flecha «Ver detalles del pedido» (`aria-expanded`, `aria-controls`) que despliega y
  pliega el detalle del pedido elegido: número, estado, fecha de entrega, total y, por producto, el
  nombre, la presentación pedida como «N × <presentación>», lo entregado y lo que falta por entregar
  [ABIERTO P2: campos exactos].
- **R40** — SI una acción de envío o de reintento devuelve un error, ENTONCES el sistema DEBE quitar
  el saliente provisional, devolver el texto a la caja (en un texto) y mostrar el `message` del
  error junto a la caja.

### Reintentar

- **R41** — DONDE un saliente es `FAILED`, de origen usuario, y la sesión trae `whatsapp.enviar`, el
  sistema DEBE mostrar «Reintentar»; CUANDO se pulsa, DEBE llamar a reintentar ese mensaje y añadir
  el devuelto como un mensaje nuevo, dejando el fallido en su sitio.

### Actualización periódica

- **R42** — MIENTRAS la pestaña esté visible, el sistema DEBE volver a pedir la primera página de la
  lista (con la búsqueda vigente) y el chat abierto cada 8 s (nunca menos de 5 s ni más de 10 s
  entre el fin de una consulta y la siguiente), e integrar conversaciones, mensajes y estados nuevos
  sin recargar y sin duplicar.
- **R43** — MIENTRAS la pestaña esté oculta, el sistema NO DEBE consultar; CUANDO vuelve a estar
  visible, DEBE consultar en ese momento.
- **R44** — SI una consulta periódica falla, ENTONCES el sistema DEBE seguir mostrando lo último que
  tenía y reintentar en el turno siguiente; SI devuelve `unauthorized`, ENTONCES DEBE dejar de
  consultar.

### Desde Clientes

- **R45** — DONDE la sesión trae `whatsapp.consultar`, la lista de Clientes DEBE mostrar en cada
  cliente con teléfono válido el enlace «Abrir chat» a `/clientes/contactos?cliente=<id>`, y en los
  que no lo tienen el texto «Sin teléfono válido»; sin el permiso, NO DEBE mostrar ninguno de los
  dos.
- **R46** — CUANDO se abre `/clientes/contactos?cliente=<id>`, el sistema DEBE abrir el chat de ese
  cliente (su conversación, o un chat vacío con la ventana cerrada si no la tiene); SI el cliente no
  existe, ENTONCES DEBE mostrar «El cliente solicitado no existe.» junto a la lista.

### Permiso de envío y frontera

- **R47** — SI la sesión no trae `whatsapp.enviar`, ENTONCES el sistema NO DEBE mostrar la caja de
  texto, las burbujas de plantillas, «Enviar plantilla» ni «Reintentar»; el chat queda de solo
  lectura.
- **R48** — El sistema DEBE leer y escribir los datos de la pantalla solo a través de las Server
  Actions del contrato de QC-245 / QC-240 (y las de su ampliación cuando existan): ningún archivo de
  la ruta importa `@/lib/composition` ni un módulo por una ruta profunda que no sea
  `adapters/driving`.

## Dependencias abiertas (ampliación de QC-245)

Nada de esto existe en el contrato publicado. Los nombres que use QC-245 al ampliarlo **no** se
dan por sabidos; la pantalla los consume a través de los tipos locales de `design.md > 4`.

| # | Qué falta en el contrato | Requisitos | Default mientras no llegue |
|---|---|---|---|
| A1 | Archivo servido de `IMAGE` y `STICKER` (hoy `attachment` trae `mimeType`, `filename` y `caption`, sin dirección) | R21, R22 | Recuadro «[Imagen]» / «[Sticker]»; el visor no se abre. |
| A2 | Reacción ligada al **id del mensaje del chat** (hoy `attachment.messageId` es el wamid y los mensajes del chat no exponen su wamid) | R24 | La reacción no se muestra (nunca como mensaje aparte). |
| A3 | Pedidos del cliente para el chat (lista, más reciente primero, con número, estado, fecha de entrega, total y líneas con presentación × cantidad, entregado y faltante) | R35, R38, R39 | Sin selector ni flecha (como un cliente sin pedidos); `pedido.*` sale `[falta pedido.numero]`. |
| A4 | Objeto de valores por defecto para cliente + pedido (constantes del sistema y propias) | R35, R36 | `cliente.nombre` = nombre del cliente del chat; propias = `variables[].value` de la plantilla (QC-245 P9); `empresa.nombre` y `pedido.*` sin valor. |
| A5 | Envío de plantilla con el pedido elegido y parámetros resueltos en el servidor | R37 | Se envía como hoy: `templateId` + `constants` (las del sistema, resueltas por el front) + `constantLabels`. |

## Preguntas abiertas

- **P1** — **Cerrada (D11):** el texto de la plantilla rellenada es de solo lectura (R34).
- **P2** — Campos exactos del detalle del pedido y de dónde salen «entregado» y «faltante» (los
  cierra QC-245 al ampliar). El total depende además de que el pedido tenga precio de venta
  (QC-307 en vuelo). Default: los de R39; un campo que no llegue se pinta con la marca de vacío.
- **P3** — **Cerrada (D12):** los botones de vincular, desvincular y bloquear no entran; van a
  QT-299 (chat-vincular-bloquear-contacto, depende de QC-246).
- **P4** — El contrato trae de cada plantilla su `name` de Meta (p. ej. `pedido_listo`), no un
  título legible como «Pedido listo para despacho» del tablero. Default: se muestra `name`.
- **P5** — Proveedor del enlace «Abrir en el mapa» y si la tarjeta lleva imagen de mapa. Una imagen
  de mapa estático necesita un proveedor y una key (y su aprobación como dependencia). Default:
  recuadro con icono, sin imagen, y enlace `https://www.google.com/maps/search/?api=1&query=<lat>,<lng>`.
- **P6** — Textos sin tablero: panel del chat sin selección (R5) y búsqueda sin resultados (R12).
  Defaults en cada requisito.
- **P7** — Conexión no activa (`PENDING`, `ERROR`, `DISABLED`) y contacto bloqueado: ¿aviso
  permanente en el chat o solo el error al enviar? Default: solo el error de la acción (R40).
- **P8** — `CONTACTS` (tarjeta de contacto) e `INTERACTIVE` sin cuerpo no tienen diseño. Default:
  «Mensaje no soportado» (R20).
- **P9** — En teléfono no hay Shift. ¿Enter envía también allí (como dice la tarjeta) o inserta
  salto y solo envía el botón? Default: igual que en escritorio (R29).
- **P10** — Con un solo pedido no hay selector; ¿se muestra la flecha del detalle? Default: sí
  (R39).
- **P11** — El pase `/design` no trae tableros de tablet ni la ficha por plataforma de los `…Movil`
  (`docs/diseno/README.md > El canvas`). ¿Se aceptan así? (Los tableros ya están copiados en
  `docs/diseno/canvas/`: D10.)
