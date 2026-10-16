# QC-137 — sistema-de-notificaciones-por-rol · requirements.md

> Zona: fullstack · Complejidad: high · depends_on: [] · Rama: `feature/QC-137-sistema-de-notificaciones-por-rol`
>
> **Alcance.** Los usuarios de una empresa reciben en pantalla avisos de lo que les toca, por su
> rol o a su nombre. Lo que entra:
>
> - **Motor de avisos.** Los módulos emiten eventos por un puerto propio; el módulo de
>   notificaciones se suscribe en composition y crea los avisos. Un catálogo de eventos en código
>   fija, por evento, su texto, a quién va (rol o usuario concreto) y a qué pantalla lleva.
> - **Canales intercambiables (factory).** Entregar un aviso pasa por un puerto `canal` único.
>   Una factory resuelve los canales de cada evento a partir del catálogo. QC-137 implementa
>   **solo el canal en la aplicación**. Agregar email, teléfono, WhatsApp o Telegram después es
>   escribir un adaptador nuevo y registrarlo en la factory, sin tocar el motor, el catálogo ni
>   los módulos que emiten. Un test con un canal ficticio lo demuestra.
> - **Bandeja persistida** por empresa: cada aviso se guarda, cada usuario lo marca como leído por
>   su cuenta (aunque el aviso vaya a un rol entero) y se borra a los 90 días.
> - **Campana** en la cabecera con los últimos avisos y el **conteo de no leídos**, y **página
>   `/notificaciones`** con el historial completo. El ítem «Notificaciones» vuelve al menú con el
>   **mismo conteo** que la campana: los dos salen de la misma fuente y nunca muestran números
>   distintos. Ese conteo sustituye el número fijo de `private-nav.ts`.
> - **Tono de notificación** cuando llega un aviso nuevo con la pantalla abierta. No suena al
>   cargar la página por los avisos que ya estaban.
> - **Clic en un aviso** abre la pantalla de su origen y lo marca como leído.
> - **Llegada a la pantalla abierta** sin recargar. El mecanismo lo elige el `design.md` (ver
>   Preguntas abiertas).
> - **Primer evento real:** fin de una tanda de PDFs o fallo de un archivo (encargo de QC-107 D6),
>   dirigido a quien subió la tanda.
> - **Agregar un evento nuevo** requiere solo una entrada en el catálogo y un `emit` en el módulo
>   de origen. Queda documentado en el módulo, con un test que lo demuestra.
>
> **Lo que NO entra.**
>
> - Stock bajo la alerta → QC-292.
> - Pedido asignado / pedido listo → QC-293.
> - Pedido bloqueado → QC-294.
> - Canal email → QC-295.
> - Canal teléfono → QC-296.
> - Canal WhatsApp a usuarios internos → QC-297.
> - Canal Telegram → QC-298.
> - Avisos al **cliente final** por WhatsApp → QC-247 (otro destinatario, ver Preguntas abiertas).
> - Configurar por pantalla qué rol recibe cada evento: el mapa es fijo en código.
> - Preferencias por usuario (silenciar eventos).
>
> Sembrado por `/afinar-feature` el 2026-10-16. El bloque de Alcance y la tabla de «Decisiones
> cerradas» los fijó el humano ANTES del spec. `spec_author` los respeta, no los reabre y no los
> reescribe: su trabajo aquí es `## Requisitos (EARS)`.

## Requisitos (EARS)

Vocabulario de este documento:

- **Aviso:** una notificación guardada en la bandeja de una empresa, dirigida a un rol o a un
  usuario. **Destinatario de un aviso:** el usuario al que va dirigido, o cada usuario de la empresa
  que tenga el rol al que va dirigido.
- **Aviso vigente:** el que tiene 90 días o menos.
- **Evento:** lo que un módulo emite para que se cree un aviso. **Catálogo:** la lista de eventos,
  fija en código.
- **Conteo:** el número de avisos vigentes no leídos del usuario.
- **Pantalla abierta:** una pestaña del navegador con la zona privada cargada y visible.
- **Tableros:** `docs/diseno/canvas/Notificaciones.dc.html`, `NotificacionesTablet.dc.html`,
  `NotificacionesMovil.dc.html`, `NotificacionesEstados.dc.html` y `Sidebar.dc.html`, aprobados
  el 2026-10-16.

### Motor y catálogo

- **R1** — El sistema DEBE tener un catálogo de eventos en código. Para cada evento, el catálogo
  fija el título y el texto del aviso, su tono (éxito, advertencia o error), su destinatario (un
  rol o el usuario que indique el evento), la pantalla de origen a la que lleva, el texto del
  enlace y los canales por los que se entrega.
- **R2** — CUANDO un módulo emite un evento del catálogo para una empresa, el sistema DEBE crear un
  único aviso en la bandeja de esa empresa, dirigido al destinatario que fija el catálogo.
- **R3** — SI un evento llega más de una vez con la misma clave de idempotencia en la misma
  empresa, ENTONCES el sistema DEBE dejar un solo aviso y NO DEBE volver a entregarlo por ningún
  canal.
- **R4** — SI el evento emitido no está en el catálogo, o su contenido no tiene la forma que el
  catálogo declara, ENTONCES el sistema NO DEBE crear el aviso. Además DEBE registrar el rechazo en
  el log sin lanzar error al módulo que lo emitió.
- **R5** — Los módulos que emiten eventos NO DEBEN importar el módulo de notificaciones. Cada uno
  DEBE emitir por un puerto propio, y la suscripción DEBE atarse solo en el punto de composición.
- **R6** — Agregar un evento a un módulo que ya emite DEBE requerir solo una entrada nueva en el
  catálogo y la llamada de emisión en el módulo de origen. El motor, la factory de canales y los
  canales NO DEBEN cambiar.
- **R7** — SI crear o entregar un aviso falla, ENTONCES la operación del módulo que emitió el
  evento DEBE terminar con el mismo resultado que si no hubiera avisos, y el fallo DEBE quedar
  registrado en el log.

### Canales

- **R8** — El sistema DEBE entregar cada aviso nuevo por cada canal que el catálogo fija para su
  evento. Los canales DEBEN resolverse con una factory sobre un único puerto de canal.
- **R9** — El único canal registrado en la factory DEBE ser el de la aplicación.
- **R10** — DONDE se registre en la factory un canal adicional, el sistema DEBE entregar por él los
  eventos que el catálogo le asigne. El motor, la entrada en el catálogo de los demás eventos y los
  módulos emisores NO DEBEN cambiar.
- **R11** — SI un canal falla al entregar un aviso, ENTONCES el sistema DEBE seguir entregando por
  los demás canales, y el aviso DEBE seguir en la bandeja.

### Bandeja, destinatarios y aislamiento

- **R12** — Cada aviso DEBE pertenecer a una sola empresa y dirigirse o a un rol o a un usuario de
  esa empresa, nunca a los dos ni a ninguno.
- **R13** — CUANDO un usuario consulta sus avisos, el sistema DEBE devolverle solo los avisos
  vigentes de su empresa dirigidos a él o a su rol actual. Un aviso de otra empresa, de otro rol o
  de otro usuario NO DEBE aparecer en la campana, en la página, en el conteo ni en ninguna
  respuesta del servidor. Esto se prueba también de punta a punta, con un usuario de otra empresa y
  uno de otro rol.
- **R14** — SI un usuario intenta marcar como leído un aviso que no le corresponde (de otra
  empresa, de otro rol, de otro usuario o inexistente), ENTONCES el sistema DEBE responder igual
  que si el aviso no existiera y NO DEBE cambiar ningún estado de lectura.
- **R15** — El sistema DEBE validar en el caso de uso, antes de leer o escribir la bandeja, que el
  usuario tiene el permiso de consultar notificaciones y que el aviso le corresponde.
- **R16** — CUANDO un usuario marca como leído un aviso dirigido a su rol, el sistema DEBE dejarlo
  leído solo para él. Los demás usuarios del rol DEBEN seguir viéndolo sin leer.
- **R17** — El sistema DEBE excluir de toda consulta los avisos con más de 90 días. Además, una
  tarea diaria DEBE borrarlos de la base, junto con su estado de lectura, recorriendo las empresas
  una a una.

### Módulo activable por empresa

- **R18** — Las notificaciones DEBEN ser un añadido por empresa con su propio permiso de consulta.
  Un usuario DEBE tener ese permiso efectivo solo si su rol lo tiene y el añadido está activo en su
  empresa.
- **R19** — MIENTRAS el añadido esté apagado en una empresa, el sistema NO DEBE crear avisos para
  ella. Sus usuarios NO DEBEN ver la campana ni el ítem «Notificaciones», y `/notificaciones` DEBE
  responder 404.
- **R20** — CUANDO se da de alta una empresa nueva, el añadido de notificaciones DEBE nacer
  apagado.
- **R21** — Los roles de empresa (Administrador, Operador, Empacador y Acondicionamiento) DEBEN
  tener el permiso de consultar notificaciones. El Maestro NO DEBE tenerlo.

### Campana, menú y página

- **R22** — MIENTRAS el usuario tenga el permiso efectivo, la cabecera de la zona privada DEBE
  mostrar una campana con el conteo. Con conteo 0 la campana NO DEBE llevar insignia, y con más de
  99 la insignia DEBE decir «99+». El nombre accesible del botón DEBE ser «Notificaciones, N sin
  leer», o «Notificaciones, ninguna sin leer» con conteo 0.
- **R23** — CUANDO el usuario abre la campana, el sistema DEBE mostrar sus 5 avisos vigentes más
  recientes y el enlace «Ver todas las notificaciones» a `/notificaciones`. Con conteo mayor que 0,
  el panel DEBE mostrar además la acción «Marcar todas como leídas».
- **R24** — La página `/notificaciones` DEBE listar los avisos vigentes del usuario del más
  reciente al más antiguo, con paginación de 10 por página, el filtro «Todas» / «No leídas» y el
  texto «Se conservan 90 días». Con conteo mayor que 0, la página DEBE mostrar «Marcar todas como
  leídas».
- **R25** — El conteo de la campana, el del ítem «Notificaciones» del menú y el de la pestaña «No
  leídas» DEBEN salir de una sola fuente en el navegador, y DEBEN mostrar siempre el mismo número.
  El ítem del menú NO DEBE mostrar ningún número fijo.
- **R26** — MIENTRAS la barra lateral esté plegada en modo icono, el ítem «Notificaciones» DEBE
  mostrar un punto sobre su icono si el conteo es mayor que 0, y nada si es 0. En el teléfono, el
  menú lateral DEBE mostrar el conteo junto a «Notificaciones».
- **R27** — El ítem «Notificaciones» DEBE aparecer en la sección «Seguimiento», justo después de
  «Dashboard», solo para quien tiene el permiso efectivo. Su presencia NO DEBE cambiar la pantalla
  a la que llega cada rol tras el login.
- **R28** — Cada aviso DEBE mostrar un icono según su tono, su título, su texto, el enlace a su
  origen y su hora. Un aviso no leído DEBE distinguirse de uno leído por el fondo tintado, el
  título en negrita y un punto, y su nombre accesible DEBE terminar en «Sin leer».
- **R29** — La hora de un aviso DEBE mostrarse con estas reglas:
  - con menos de 1 minuto, «ahora»;
  - con menos de 60 minutos, «hace N min»;
  - del mismo día, «hace N h»;
  - del día anterior, «ayer HH:MM»;
  - con más antigüedad, «DD/MM/AAAA HH:MM».

  Es la propuesta por defecto de la pregunta abierta 4: si el humano la cambia, cambia solo este
  requisito.
- **R30** — CUANDO el usuario hace clic en un aviso, el sistema DEBE marcarlo como leído para ese
  usuario y llevarlo a la pantalla de origen del aviso.
- **R31** — CUANDO el usuario pulsa «Marcar todas como leídas», el sistema DEBE marcar como leídos
  para ese usuario todos sus avisos vigentes no leídos. El conteo DEBE pasar a 0 en la campana, el
  menú y la pestaña.
- **R32** — La campana y la página DEBEN mostrar los estados de los tableros:
  - mientras cargan, esqueletos;
  - sin avisos, «Todavía no tienes notificaciones.»;
  - con el filtro «No leídas» y ningún aviso sin leer, «No tienes notificaciones sin leer.»;
  - si la carga falla, un error con «Reintentar», que DEBE volver a pedir los avisos.
- **R33** — En el teléfono, el panel de la campana DEBE ocupar el ancho de la pantalla con 8 px de
  margen y un alto máximo del 60 % de la pantalla. Cada aviso DEBE tener un área táctil de al
  menos 44 px de alto.
- **R34** — CUANDO llega un aviso nuevo con la pantalla abierta, el sistema DEBE animarlo así: la
  campana se balancea 700 ms, el conteo da un pulso de 360 ms y la fila nueva entra desde arriba
  con un fundido. MIENTRAS el sistema operativo pida movimiento reducido, NO DEBE haber balanceo,
  ni pulso, ni entrada.

### Llegada sin recargar

- **R35** — MIENTRAS una pestaña de la zona privada esté visible y el usuario tenga el permiso
  efectivo, el sistema DEBE consultar sus avisos cada 30 segundos. Con lo que llegue, DEBE
  actualizar sin recargar la página la campana, el menú, la pestaña «No leídas» y, si está a la
  vista, la primera página de `/notificaciones`.
- **R36** — MIENTRAS la pestaña esté oculta, el sistema NO DEBE consultar. CUANDO la pestaña vuelve
  a estar visible, DEBE consultar de inmediato.
- **R37** — CUANDO una pestaña recibe un conteo nuevo o el usuario marca avisos como leídos en
  ella, las demás pestañas del mismo usuario en el mismo navegador DEBEN actualizar su conteo sin
  esperar a su siguiente consulta.
- **R38** — SI la consulta responde que no hay sesión o que el usuario ya no tiene el permiso
  efectivo, ENTONCES el sistema DEBE dejar de consultar en esa pestaña.

### Tono

- **R39** — CUANDO una consulta que no es la primera de la pestaña trae al menos un aviso no leído
  más reciente que el último que ese navegador ya conocía, el sistema DEBE reproducir el tono una
  vez.
- **R40** — El sistema NO DEBE reproducir el tono por los avisos que ya existían cuando la página
  se cargó.
- **R41** — MIENTRAS el usuario tenga varias pestañas abiertas en el mismo navegador, el tono DEBE
  sonar una sola vez por llegada, no una vez por pestaña.
- **R42** — El tono DEBE generarse en el navegador, sin archivo de audio, y NO DEBE existir ningún
  control para silenciarlo.
- **R43** — SI toca sonar y el navegador no permite reproducir sonido, ENTONCES el sistema NO DEBE
  lanzar error. En ese caso DEBE mostrar el toast informativo «Notificaciones sin sonido», con
  botón de cerrar, una sola vez por sesión del navegador, y el conteo DEBE actualizarse igual.

### Primer evento: fin de una tanda de PDFs

- **R44** — CUANDO el último archivo pendiente de una tanda de PDFs queda leído o con error, el
  sistema DEBE emitir un único evento de fin de tanda, dirigido a quien subió la tanda y en la
  empresa de la tanda. Da igual que el archivo termine por el procesamiento o por la caducidad.
- **R45** — El aviso de fin de tanda DEBE decir:
  - con todos los archivos leídos, «Tanda de PDFs procesada», en tono de éxito;
  - con algunos leídos y otros con error, «Tanda procesada con errores» y «Se leyeron N de M
    archivos», en tono de advertencia;
  - con todos los archivos con error, «Falló la lectura de un archivo» en una tanda de uno, o «No
    se pudo leer ningún archivo de la tanda» en una de varios, en tono de error.

  Los textos exactos quedan sujetos a la pregunta abierta 4.
- **R46** — SI la tanda no tiene registrado quién la subió, ENTONCES el sistema NO DEBE crear el
  aviso y DEBE registrarlo en el log.
- **R47** — El aviso de fin de tanda DEBE llevar a la pantalla donde se subió la tanda: la lista de
  fórmulas en la estrategia de fórmula, y el detalle del proveedor en la de catálogo. SI la tanda de
  catálogo no tiene proveedor registrado, ENTONCES DEBE llevar a la lista de proveedores.

### Cobertura de las decisiones cerradas

| Decisión (fila de `## Decisiones cerradas`) | Cubierta por |
| --- | --- |
| ¿Qué eventos avisan? (QC-137 entrega solo PDFs) | R1, R44, R45, R46, R47 |
| ¿A quién va cada aviso? | R2, R12, R13 |
| ¿Quién recibe cada evento? (fijo en código) | R1 |
| ¿Se guarda? (leído, 90 días) | R16, R17, R24 |
| Aviso a un rol: leído por usuario | R16 |
| ¿Dónde se ve? | R22, R23, R24 |
| ¿Conteo? | R25, R26 |
| ¿Sonido? | R39, R40 |
| ¿Qué sonido? | R42 |
| ¿Se puede silenciar? | R42 |
| ¿Varias pestañas? | R37, R41 |
| ¿Y si el navegador no permite audio? | R43 |
| ¿Clic en el aviso? | R30, R47 |
| ¿Correo? | R9 |
| ¿Cómo se agregan canales? | R8, R10, R11 |
| ¿E2E? | R13 |
| Desacople | R5, R6 |
| ¿Un fallo al notificar rompe la operación? | R7 |
| ¿Se activa por empresa? | R18, R19, R20 |
| Identificadores de la DB | R12 (lo comprueba el test de integración del esquema, `design.md > 3`) |
| Autorización | R14, R15 |
| «Marcar todas como leídas» | R23, R24, R31 |
| Mecanismo de tiempo real: consulta periódica | R35, R36, R37, R38 |

## Preguntas abiertas

1. **Mecanismo de tiempo real. CERRADA el 2026-10-16:** consulta periódica. Ver la fila en
   `## Decisiones cerradas` y `design.md > 9` y `> 12`.
2. **Relación con QC-247.** QC-247 avisa al cliente final por WhatsApp con su propio puerto de
   eventos. Queda abierto si QC-247 se monta sobre esta factory (el cliente como un destinatario
   más) o sigue aparte. Lo resuelve quien acote QC-247; QC-137 no lo bloquea.
3. **Para las fichas de canal, no para esta:** qué es «teléfono» (SMS, llamada o los dos), de
   dónde salen el correo, el teléfono o el chat de Telegram de cada usuario, y si cada usuario
   elige por qué canal recibe cada evento.
4. **Lo que el pase `/design` dejó «Por confirmar».** El pase quedó aprobado el 2026-10-16
   (tableros en `docs/diseno/canvas/Notificaciones{,Tablet,Movil,Estados}.dc.html` y
   `Sidebar.dc.html`). «Marcar todas como leídas» pasó a `## Decisiones cerradas`. Siguen
   abiertos:
   - **Avisos por página.** El spec adopta **10**, el `DEFAULT_PAGE_SIZE` de
     `lib/shared/pagination.ts` que usan las demás listas (R24). Confírmalo o di otro número.
   - **Texto exacto del enlace al origen.** El tablero usa «Ver la tanda» y «Ver el archivo».
     Pero no existe pantalla de una tanda ni de un archivo con error: el enlace lleva a la
     pantalla donde se subió (R47). Propuesta: «Ver fórmulas» en la estrategia de fórmula y «Ver
     proveedor» en la de catálogo. Lo mismo vale para el título y el texto de cada aviso (R45).
   - **Hora relativa.** Falta hasta qué antigüedad se usa y desde cuándo se pasa a fecha. El spec
     propone la regla de R29, coherente con los ejemplos del tablero («hace 48 min», «ayer 17:05»,
     «14/10/2026 09:12»).
5. **¿Las empresas que ya existen arrancan con el añadido prendido?** La migración de QC-277
   prendió los cinco añadidos de entonces para todas las empresas existentes, y QC-277 D7 dice que
   una empresa **nueva** nace solo con el núcleo (R20). Para las existentes hay dos opciones:
   prendido, como hizo QC-277, o apagado hasta que el Maestro lo prenda. El spec propone
   **prendido**, para que el primer evento llegue sin otro paso. Falta tu confirmación.
6. **¿El añadido de notificaciones depende de «Integraciones»?** QC-277 D1 dice que
   «Integraciones» «arrastra la lectura de PDF, Contactos y las notificaciones», y QC-277 D3 lista
   las notificaciones como añadido propio. El spec propone que **no dependa** de nada: el aviso de
   PDFs ya depende de la lectura de PDF, y esta de Integraciones. Si D1 quería decir que sí, se
   añade la dependencia (`ADDON_REQUIRES`) y nada más cambia.
7. **Un aviso por tanda, no uno por archivo.** El tablero muestra a la vez «Falló la lectura de un
   archivo» y «Tanda procesada con errores». El spec emite **un solo aviso al terminar la tanda**
   (R44, R45): evita dos avisos por la misma tanda. Si quieres además un aviso inmediato por cada
   archivo que falla, es otro evento del catálogo (R6).
8. **El nombre del archivo no se guarda.** La ruta del PDF es `<empresa>/<uuid>.pdf`, y el nombre
   que puso quien subió no llega a la base (`lib/modules/documentos/domain/document-path.ts`). Por
   eso el aviso no puede decir «No se pudo leer "cotizacion-proveedor.pdf"», como el tablero.
   Guardarlo es una columna nueva en `document_files` y queda fuera de este spec, salvo que lo
   pidas.
9. **El proveedor de una tanda de catálogo.** Hoy la tanda no guarda desde qué proveedor se
   subió, y el aviso no puede llevar a su detalle. El spec propone guardarlo
   (`document_batches.supplier_id`, opcional, `design.md > 6.3`). La alternativa barata es llevar
   a la lista de proveedores, que ya es el plan B de R47.

## Decisiones cerradas (no reabrir)

| Fecha | Pregunta | Decisión |
| --- | --- | --- |
| 2026-10-16 | ¿Qué eventos avisan? | PDFs (QC-107), stock bajo la alerta, pedido asignado/listo y pedido bloqueado. **Se parte:** QC-137 monta el motor y entrega solo el de PDFs; los otros tres son fichas chicas que solo agregan catálogo + `emit` (patrón de QC-247). |
| 2026-10-16 | ¿A quién va cada aviso? | Por rol **y** por usuario concreto, siempre dentro de su empresa (`companyId`). Nunca cruza de empresa. |
| 2026-10-16 | ¿Quién recibe cada evento? | Fijo en código, en el catálogo. Sin pantalla de configuración. |
| 2026-10-16 | ¿Se guarda? | Sí, con estado de leído. Retención de 90 días. |
| 2026-10-16 | Aviso dirigido a un rol: ¿cómo se marca leído? | Cada usuario el suyo. |
| 2026-10-16 | ¿Dónde se ve? | Campana en la cabecera + página `/notificaciones` con historial. |
| 2026-10-16 | ¿Conteo? | Campana y menú muestran el mismo conteo de no leídos, de una sola fuente. |
| 2026-10-16 | ¿Sonido? | Sí: tono al llegar un aviso nuevo con la pantalla abierta. |
| 2026-10-16 | ¿Qué sonido? | Uno propio, generado en el navegador (sin archivo de audio de terceros ni licencia que revisar). |
| 2026-10-16 | ¿Se puede silenciar? | No. |
| 2026-10-16 | ¿Varias pestañas? | Suena **una sola vez por navegador**, no una vez por pestaña (como Slack, Gmail o WhatsApp Web). El conteo sí se actualiza en todas. |
| 2026-10-16 | ¿Y si el navegador no permite audio? | No suena, sin error. Se muestra un aviso sencillo de que el sonido no está disponible. El conteo se actualiza igual. |
| 2026-10-16 | ¿Clic en el aviso? | Lleva a la pantalla de origen. |
| 2026-10-16 | ¿Correo? | No en esta ficha. Solo el canal en la aplicación. |
| 2026-10-16 | ¿Cómo se agregan canales? | Puerto `canal` + factory que resuelve los canales por evento. Futuro: aplicación, email, teléfono, WhatsApp y Telegram. Un fallo de un canal no impide los demás ni la bandeja. |
| 2026-10-16 | ¿E2E? | Sí: un usuario de otra empresa o de otro rol nunca ve el aviso. |
| 2026-10-16 | Desacople | Los módulos emiten por puerto propio y no importan `notificaciones`; suscripción en composition. Heredado de QC-247 D1 y del patrón `StockIncreaseListener`. |
| 2026-10-16 | ¿Un fallo al notificar rompe la operación? | Nunca. Heredado de QC-247 D4. |
| 2026-10-16 | ¿Se activa por empresa? | Sí, es módulo activable. Heredado de QC-277 D3. |
| 2026-10-16 | Identificadores de la DB | En inglés. Heredado de QC-4. |
| 2026-10-16 | Autorización | Validada en el service; cada usuario lee y marca solo sus avisos. Heredado de `docs/architecture.md > Acceso a datos y autorizacion`. |
| 2026-10-16 | ¿«Marcar todas como leídas»? | Sí, en el panel de la campana y en la página `/notificaciones`, y solo con avisos sin leer. Aprobado por el humano junto con el pase `/design` (`docs/diseno/canvas/Notificaciones.dc.html`). |
| 2026-10-16 | Mecanismo de tiempo real | **Consulta periódica** (polling), y solo con la pestaña visible, detrás de una interfaz propia de entrega al cliente: campana, menú y pestaña «No leídas» leen el conteo sin saber cómo llega. Supabase Realtime Broadcast queda **descartado hoy**, con el camino de migración y su umbral en `design.md`. Sin dependencia nueva ni enmienda a `docs/architecture.md` por esta decisión. Decisión del humano. |
