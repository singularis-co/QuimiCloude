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
> - **Campana** en la cabecera con el **conteo de no leídos** y un panel con **todos los avisos
>   guardados** (hasta 90 días), que trae 10 y carga los siguientes solo al hacer scroll. **Sin
>   página propia y sin ítem en el menú lateral**, que no cambia. *(Ajustado el 2026-10-16 por
>   decisión del humano: ver las dos últimas filas de `## Decisiones cerradas`.)*
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
> - Página `/notificaciones`, ítem «Notificaciones» en el menú lateral y cualquier conteo en el
>   menú (decisión del humano del 2026-10-16). El menú lateral y su navegación no cambian.
>
> Sembrado por `/afinar-feature` el 2026-10-16. El bloque de Alcance y la tabla de «Decisiones
> cerradas» los fijó el humano ANTES del spec. `spec_author` los respeta, no los reabre y no los
> reescribe: su trabajo aquí es `## Requisitos (EARS)`. La revisión «solo campana» la decidió el
> humano y es la única razón de los ajustes marcados arriba.

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
- **Panel:** lo que se abre al pulsar la campana. **Lote:** cada tanda de hasta 10 avisos que el
  panel pide al servidor.
- **Acercarse al final:** que el final de la lista del panel quede a la vista, o a punto de
  quedarlo, dentro del área con scroll del panel (el margen exacto lo fija `design.md > 10.2`).
- **Tableros:** `docs/diseno/canvas/Notificaciones.dc.html`, `NotificacionesTablet.dc.html`,
  `NotificacionesMovil.dc.html` (ficha) y `NotificacionesEstados.dc.html` (11 estados), aprobados
  el 2026-10-16 y revisados el mismo día para «solo campana».

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
  de otro usuario NO DEBE aparecer en el panel, en el conteo, en ningún lote ni en ninguna
  respuesta del servidor. Esto se prueba también de punta a punta, con un usuario de otra empresa y
  uno de otro rol.
- **R14** — SI un usuario intenta marcar como leído un aviso que no le corresponde (de otra
  empresa, de otro rol, de otro usuario o inexistente), ENTONCES el sistema DEBE responder igual
  que si el aviso no existiera y NO DEBE cambiar ningún estado de lectura.
- **R15** — El sistema DEBE validar en el caso de uso, antes de leer o escribir la bandeja, que hay
  un usuario con sesión en una empresa y que el aviso le corresponde (R13). Consultar y marcar los
  avisos propios NO DEBE exigir ningún permiso. *(Enmienda 2026-10-19, E1.)*
- **R16** — CUANDO un usuario marca como leído un aviso dirigido a su rol, el sistema DEBE dejarlo
  leído solo para él. Los demás usuarios del rol DEBEN seguir viéndolo sin leer.
- **R17** — El sistema DEBE excluir de toda consulta los avisos con más de 90 días. Además, una
  tarea diaria DEBE borrarlos de la base, junto con su estado de lectura, recorriendo una a una
  **todas** las empresas, también las dadas de baja. *(Enmienda 2026-10-19, E4.)*

### Núcleo: sin permiso ni añadido *(enmienda 2026-10-19, E1; antes «Módulo activable por empresa»)*

- **R18** — Las notificaciones DEBEN ser núcleo: NO DEBEN ser un añadido por empresa ni tener un
  permiso propio. La lista de añadidos NO DEBE incluir `notificaciones` y la base NO DEBE tener la
  fila del añadido ni ninguna excepción por empresa de él. *(Enmienda 2026-10-19, E1.)*
- **R19** — El sistema DEBE crear los avisos de cualquier empresa sin consultar ningún añadido.
  MIENTRAS un usuario tenga sesión en una empresa, DEBE ver la campana y DEBE poder consultar y
  marcar sus avisos, sea cual sea su rol y aunque su rol no tenga ningún permiso. *(Enmienda
  2026-10-19, E1.)*
- **R20** — *Retirado por la enmienda del 2026-10-19 (E1).* Decía que el añadido nacía apagado en
  una empresa nueva; ya no hay añadido.
- **R21** — El catálogo de permisos NO DEBE tener `notificaciones.consultar`, y cada rol DEBE tener
  exactamente los permisos que tenía antes de QC-137. *(Enmienda 2026-10-19, E1.)*

### Campana y panel

- **R22** — MIENTRAS el usuario tenga sesión en una empresa, la cabecera de la zona privada DEBE
  mostrar una campana con el conteo *(enmienda 2026-10-19, E1: antes «MIENTRAS el usuario tenga el
  permiso efectivo»)*. Con conteo 0 la campana NO DEBE llevar insignia, y con más de
  99 la insignia DEBE decir «99+». El nombre accesible del botón DEBE ser «Notificaciones, N sin
  leer», o «Notificaciones, ninguna sin leer» con conteo 0. La insignia, el nombre accesible y la
  presencia de «Marcar todas como leídas» DEBEN salir de una sola fuente del conteo en el
  navegador, y DEBEN coincidir siempre.
- **R23** — CUANDO el usuario abre la campana, el panel DEBE mostrar sus avisos vigentes del más
  reciente al más antiguo, empezando por un lote con los 10 más recientes. Con conteo mayor que 0,
  el panel DEBE mostrar además la acción «Marcar todas como leídas».
- **R24** — La campana DEBE ser el único lugar de la aplicación donde se ven los avisos. El sistema
  NO DEBE tener la ruta `/notificaciones`, NO DEBE añadir un ítem «Notificaciones» al menú lateral
  y el menú lateral NO DEBE mostrar ningún conteo de avisos.
- **R25** — CUANDO el usuario se acerca al final de la lista del panel y quedan avisos vigentes
  sin cargar, el sistema DEBE pedir el lote siguiente por sí solo, sin que el usuario pulse nada, y
  añadirlo al final de la lista. MIENTRAS ese lote se pide, el final de la lista DEBE mostrar
  «Cargando más avisos…» y el sistema NO DEBE pedir otro lote a la vez.
- **R26** — SI falla la petición de un lote siguiente, ENTONCES el final de la lista DEBE mostrar
  «No se pudieron cargar más avisos.» con el botón «Reintentar», los avisos ya cargados DEBEN
  seguir en la lista, y el sistema NO DEBE volver a pedir solo. CUANDO el usuario pulsa
  «Reintentar», el sistema DEBE volver a pedir ese mismo lote.
- **R27** — CUANDO ya no quedan avisos vigentes por cargar y la lista tiene al menos uno, el final
  de la lista DEBE mostrar «No hay más avisos. Se conservan 90 días.» y el sistema NO DEBE pedir
  más lotes.
- **R28** — Cada lote DEBE seguir exactamente donde terminó el anterior: ningún aviso DEBE salir
  dos veces en la lista del panel ni quedar sin salir, aunque lleguen avisos nuevos mientras el
  usuario recorre la lista. Los avisos que llegan con la lista cargada DEBEN aparecer arriba.
- **R29** — Cada aviso DEBE mostrar un icono según su tono, su título, su texto, el enlace a su
  origen y su hora. Un aviso no leído DEBE distinguirse de uno leído por el fondo tintado, el
  título en negrita y un punto, y su nombre accesible DEBE terminar en «Sin leer».
- **R30** — La hora de un aviso DEBE mostrarse según su antigüedad, en la zona horaria del
  navegador:
  - con menos de 1 minuto, «ahora»;
  - con menos de 60 minutos, «hace N min»;
  - con menos de 24 horas, «hace N h»;
  - de 1 a 7 días, «hace N días» («hace 1 día» con 1);
  - con más de 7 días, la fecha y la hora, «DD/MM/AAAA HH:MM» (p. ej. «14/10/2026 09:12»).

  N es la parte entera de la antigüedad en esa unidad.
- **R31** — CUANDO el usuario hace clic en un aviso, el sistema DEBE marcarlo como leído para ese
  usuario y llevarlo a la pantalla de origen del aviso.
- **R32** — CUANDO el usuario pulsa «Marcar todas como leídas», el sistema DEBE marcar como leídos
  para ese usuario todos sus avisos vigentes no leídos, cargados en el panel o no. El conteo DEBE
  pasar a 0 y los avisos ya cargados en el panel DEBEN pasar a verse como leídos.
- **R33** — El panel DEBE mostrar los estados de los tableros:
  - mientras carga el primer lote, esqueletos;
  - sin avisos vigentes, «No tienes notificaciones.»;
  - si falla el primer lote, «No se pudieron cargar las notificaciones.» con «Reintentar», que DEBE
    volver a pedir el primer lote.
- **R34** — En escritorio y tablet, el panel DEBE abrirse bajo la campana con 400 px de ancho y un
  alto fijo de 520 px, con scroll dentro del panel.
- **R35** — En el teléfono, el panel DEBE anclarse a la pantalla y no a la campana: DEBE ocupar el
  ancho de la pantalla con 8 px de margen a cada lado, y su alto máximo DEBE llegar hasta 16 px
  del borde inferior de la pantalla, con scroll dentro del panel. El panel NO DEBE salirse de la pantalla por
  ningún lado. Cada aviso DEBE tener un área táctil de al menos 44 px de alto.
- **R36** — CUANDO llega un aviso nuevo con la pantalla abierta, el sistema DEBE animarlo así: la
  campana se balancea 700 ms, el conteo da un pulso de 360 ms y, con el panel abierto, la fila nueva
  entra desde arriba con un fundido. Las filas de un lote cargado por scroll DEBEN entrar con un
  fundido. MIENTRAS el sistema operativo pida movimiento reducido, NO DEBE haber balanceo, ni
  pulso, ni entrada, ni fundido de filas. *(Enmienda 2026-10-19, E5: los 700 ms del balanceo se
  mantienen, con una excepción con nombre en la guardia de movimiento de QC-228.)*

### Llegada sin recargar

- **R37** — MIENTRAS una pestaña de la zona privada esté visible y el usuario tenga sesión, el
  sistema DEBE consultar sus avisos cada 30 segundos *(enmienda 2026-10-19, E1: sin la condición
  del permiso efectivo)*. Con lo que llegue, DEBE
  actualizar sin recargar la página el conteo de la campana y, si la lista del panel ya está
  cargada, añadir arriba los avisos nuevos.
- **R38** — MIENTRAS la pestaña esté oculta, el sistema NO DEBE consultar. CUANDO la pestaña vuelve
  a estar visible, DEBE consultar de inmediato.
- **R39** — CUANDO una pestaña recibe un conteo nuevo o el usuario marca avisos como leídos en
  ella, las demás pestañas del mismo usuario en el mismo navegador DEBEN actualizar su conteo sin
  esperar a su siguiente consulta.
- **R40** — SI la consulta responde que no hay sesión, ENTONCES el sistema DEBE dejar de consultar
  en esa pestaña. *(Enmienda 2026-10-19, E1: sin el caso «ya no tiene el permiso efectivo», que deja
  de existir.)*

### Tono

- **R41** — CUANDO una consulta que no es la primera de la pestaña trae al menos un aviso no leído
  más reciente que el último que ese navegador ya conocía, el sistema DEBE reproducir el tono una
  vez.
- **R42** — El sistema NO DEBE reproducir el tono por los avisos que ya existían cuando la página
  se cargó.
- **R43** — MIENTRAS el usuario tenga varias pestañas abiertas en el mismo navegador, el tono DEBE
  sonar una sola vez por llegada, no una vez por pestaña.
- **R44** — El tono DEBE generarse en el navegador, sin archivo de audio, y NO DEBE existir ningún
  control para silenciarlo.
- **R45** — SI toca sonar y el navegador no permite reproducir sonido, ENTONCES el sistema NO DEBE
  lanzar error. En ese caso DEBE mostrar el toast informativo «Notificaciones sin sonido», con
  botón de cerrar, una sola vez por sesión del navegador, y el conteo DEBE actualizarse igual.

### Primer evento: fin de una tanda de PDFs

- **R46** — CUANDO el último archivo pendiente de una tanda de PDFs queda leído o con error, el
  sistema DEBE emitir un único evento de fin de tanda, dirigido a quien subió la tanda y en la
  empresa de la tanda. Da igual que el archivo termine por el procesamiento o por la caducidad. El
  sistema NO DEBE crear un aviso por cada archivo que falla.
- **R47** — El aviso de fin de tanda DEBE decir, con «HH:MM» la hora a la que se subió la tanda en
  la zona horaria del navegador que lo muestra:
  - con todos los archivos leídos, en tono de éxito: título «Tanda de PDFs procesada»; texto «Se
    leyeron los N archivos de la tanda que subiste a las HH:MM.», o «Se leyó el archivo de la tanda
    que subiste a las HH:MM.» con un solo archivo;
  - con algunos leídos y otros con error, en tono de advertencia: título «Tanda procesada con
    errores»; texto «Se leyeron N de M archivos.» seguido de, con nombres, «No se pudo leer L.»
    (un fallido) o «No se pudieron leer L.» (varios), y sin nombres, «Uno no se pudo leer.» o «K no
    se pudieron leer.»;
  - con todos los archivos con error, en tono de error: título «Falló la lectura de la tanda»;
    texto, en una tanda de uno, «No se pudo leer L, de la tanda que subiste a las HH:MM.» o, sin
    nombre, «No se pudo leer el archivo de la tanda que subiste a las HH:MM.»; en una tanda de
    varios, «No se pudo leer ningún archivo de la tanda que subiste a las HH:MM: L.» o, sin nombres,
    la misma frase terminada en «HH:MM.».

  L es la lista de archivos fallidos de R51 y K el número de fallidos.
- **R48** — SI la tanda no tiene registrado quién la subió, ENTONCES el sistema NO DEBE crear el
  aviso y DEBE registrarlo en el log.
- **R49** — El aviso de fin de tanda DEBE llevar a la pantalla desde la que se subió la tanda: a la
  lista de fórmulas, con el enlace «Ver fórmulas», si se subió desde Fórmulas; y a la lista de
  proveedores, con el enlace «Ver proveedores», si se subió desde un proveedor. El sistema NO DEBE
  guardar el proveedor de la tanda.
- **R50** — CUANDO se encola una tanda, el sistema DEBE guardar con cada archivo el nombre original
  que tenía en el equipo de quien lo subió, sin carpetas. Los archivos ya guardados antes de este
  cambio DEBEN quedar sin nombre.
- **R51** — La lista de archivos fallidos (L) DEBE nombrar, entre comillas y en el orden en que se
  subieron, como mucho los tres primeros archivos fallidos que tengan nombre guardado:
  - con todos los fallidos nombrados: «"a.pdf"», «"a.pdf" y "b.pdf"» o «"a.pdf", "b.pdf" y
    "c.pdf"»;
  - si quedan fallidos sin nombrar (más de tres, o alguno sin nombre guardado): los nombrados
    separados por comas y «y N más», donde N cuenta los fallidos no nombrados: «"a.pdf", "b.pdf",
    "c.pdf" y 4 más».

  Un nombre de más de 60 caracteres DEBE recortarse a sus primeros 59 seguidos de «…». SI ningún
  archivo fallido tiene nombre guardado, ENTONCES el aviso DEBE usar el texto genérico de R47.
- **R52** — *Retirado por la enmienda del 2026-10-19 (E1).* Decía que la migración del añadido lo
  prendía en las empresas existentes; lo sustituye R54.
- **R53** — *Retirado por la enmienda del 2026-10-19 (E1).* Decía que el añadido no dependía de
  ningún otro; ya no hay añadido.

### Añadidos por la enmienda del 2026-10-19

- **R54** — CUANDO se aplica la migración que retira el añadido, la base DEBE quedar sin el permiso
  `notificaciones.consultar`, sin ninguna asignación de ese permiso a un rol, sin la fila
  `notificaciones` de los añadidos y sin ninguna excepción por empresa de ese añadido, tanto si la
  migración de datos de la tanda 1 se llegó a aplicar como si no. Aplicarla de nuevo NO DEBE fallar
  ni cambiar nada. Las migraciones ya commiteadas NO DEBEN borrarse ni editarse. *(E1.)*
- **R55** — SI el usuario destinatario de un evento está dado de baja, ENTONCES el sistema DEBE
  tratarlo como un usuario que no es de la empresa: NO DEBE crear el aviso y DEBE registrar el
  rechazo en el log (R12). *(E2.)*

### Cobertura de las decisiones cerradas

| Decisión (fila de `## Decisiones cerradas`) | Cubierta por |
| --- | --- |
| ¿Qué eventos avisan? (QC-137 entrega solo PDFs) | R1, R46, R47, R48, R49 |
| ¿A quién va cada aviso? | R2, R12, R13 |
| ¿Quién recibe cada evento? (fijo en código) | R1 |
| ¿Se guarda? (leído, 90 días) | R16, R17, R27 |
| Aviso a un rol: leído por usuario | R16 |
| ¿Dónde se ve? | Sustituida por la fila «¿Dónde se ve? (revisión)»: R22, R23, R24 |
| ¿Conteo? | R22 (una sola fuente), R39. La parte del menú queda sin objeto por «¿Dónde se ve? (revisión)», y R24 lo fija |
| ¿Sonido? | R41, R42 |
| ¿Qué sonido? | R44 |
| ¿Se puede silenciar? | R44 |
| ¿Varias pestañas? | R39, R43 |
| ¿Y si el navegador no permite audio? | R45 |
| ¿Clic en el aviso? | R31, R49 |
| ¿Correo? | R9 |
| ¿Cómo se agregan canales? | R8, R10, R11 |
| ¿E2E? | R13 |
| Desacople | R5, R6 |
| ¿Un fallo al notificar rompe la operación? | R7 |
| ¿Se activa por empresa? | Sustituida por la enmienda E1 (núcleo): R18, R19, R21, R54 |
| Identificadores de la DB | R12 (lo comprueba el test de integración del esquema, `design.md > 3`) |
| Autorización | R14, R15 |
| «Marcar todas como leídas» | R22, R23, R32. La parte de la página queda sin objeto por «¿Dónde se ve? (revisión)» |
| Mecanismo de tiempo real: consulta periódica | R37, R38, R39, R40 |
| ¿Dónde se ve? (revisión): solo campana | R22, R23, R24 |
| Historial en el panel con carga al hacer scroll | R23, R25, R26, R27, R28, R33 |
| Un aviso por tanda (2026-10-19) | R46 |
| Destino del aviso de PDFs (2026-10-19) | R49 |
| Añadido prendido en las empresas existentes (2026-10-19) | Sin objeto por la enmienda E1: R54 retira lo que esa migración escribió |
| El añadido no depende de «Integraciones» (2026-10-19) | Sin objeto por la enmienda E1 (R18) |
| Carga al hacer scroll con `react-intersection-observer` (2026-10-19) | R25 (la guardia de QC-140 ampliada lo comprueba, `design.md > 10.2`) |
| Nombre del archivo que falló (2026-10-19) | R47, R50, R51 |
| Hora relativa y textos (2026-10-19) | R30, R47 |
| Panel en el teléfono (2026-10-19) | R35 |
| E1. Notificaciones núcleo (enmienda 2026-10-19) | R15, R18, R19, R21, R22, R37, R40, R54 (R20, R52 y R53 retirados) |
| E2. Usuario dado de baja no es miembro (enmienda 2026-10-19) | R12, R55 |
| E3. `paths[]` + `originalNames?[]` y orden por `createdAt` (enmienda 2026-10-19) | R50, R51 (cambio de diseño, sin requisito nuevo: `design.md > 6.3`) |
| E4. El cron borra también avisos de empresas dadas de baja (enmienda 2026-10-19) | R17 |
| E5. Balanceo de 700 ms con excepción en la guardia (enmienda 2026-10-19) | R36 |

## Preguntas abiertas

1. **Mecanismo de tiempo real. CERRADA el 2026-10-16:** consulta periódica. Ver la fila en
   `## Decisiones cerradas` y `design.md > 9` y `> 12`.
2. **Relación con QC-247.** QC-247 avisa al cliente final por WhatsApp con su propio puerto de
   eventos. Queda abierto si QC-247 se monta sobre esta factory (el cliente como un destinatario
   más) o sigue aparte. Lo resuelve quien acote QC-247; QC-137 no lo bloquea.
3. **Para las fichas de canal, no para esta:** qué es «teléfono» (SMS, llamada o los dos), de
   dónde salen el correo, el teléfono o el chat de Telegram de cada usuario, y si cada usuario
   elige por qué canal recibe cada evento.
4–11. **CERRADAS el 2026-10-19** por el humano (hora relativa y textos, añadido prendido, sin
   dependencia de «Integraciones», un aviso por tanda, nombre del archivo, destino sin
   `supplier_id`, margen del teléfono y librería del observador). Ver las filas del 2026-10-19 en
   `## Decisiones cerradas` y R30, R35, R46, R47, R49–R53.

12. **Maestro y otros usuarios sin empresa (enmienda E1).** R19 dice «todo usuario con sesión en
    una empresa». El Maestro no tiene empresa (`SessionUserRecord.companyId = null`) y la bandeja
    es por empresa. Hoy, si una sesión sin empresa monta el layout privado, la acción responde
    `unauthorized` (`getSessionContext()` da `null`) y la consulta se para (R40), con la campana
    montada. Queda abierto si el Maestro debe ver la campana (vacía) o no verla. No bloquea T24–T27:
    el código actual no cambia hasta que se responda.
13. **Avisos de una empresa dada de baja (enmienda E1).** Antes, el interruptor del añadido decidía
    si se creaban. Sin él, una tanda que termina en una empresa dada de baja crea su aviso (que
    nadie puede leer, porque sus usuarios no entran). R17 los borra a los 90 días (E4). Queda
    abierto si `notify` debe además rechazarlos. No bloquea: no cambia ningún requisito actual.

Sin preguntas abiertas que bloqueen QC-137. Las 2 y 3 son de otras fichas; la 12 y la 13 no
bloquean T24–T27.

**Nota para el próximo pase `/design`, no es una pregunta:** la ficha de
`NotificacionesMovil.dc.html` todavía dice «alto máximo 70 %» y sus enlaces de ejemplo dicen «Ver
proveedor». Manda R35 y R49; hay que corregir la ficha para que coincida.

## Enmiendas

### 2026-10-19 — decisiones del humano tras las tandas 1–3

Decisiones del humano del 2026-10-19 (E1–E5) y recogida de las decisiones de implementación de
las tandas 1–3 (E6). Las E1–E5 son del humano y no se reabren. Las de E6 constan en
`progress/impl_QC-137-sistema-de-notificaciones-por-rol.md` como «fuera del spec»: se recogen en
`design.md > 16` y quedan **pendientes de validar por el reviewer**.

| Id | Decisión del humano | Requisitos | Tarea |
| --- | --- | --- | --- |
| E1 | Las notificaciones son **núcleo**: sin permiso `notificaciones.consultar` y sin añadido `notificaciones` por empresa. Todo usuario con sesión tiene campana y bandeja. Sustituye las filas «¿Se activa por empresa?», «¿Empresas existentes?» y «¿Depende de "Integraciones"?» de `## Decisiones cerradas`. | R15, R18, R19, R21, R22, R37, R40 cambian; R20, R52, R53 se retiran; R54 nuevo | T24 |
| E2 | Un usuario **dado de baja** no cuenta como miembro: `isUserInCompany` responde `false`. Se queda el puerto `lib/modules/identity/ports/company-membership-reader.ts`. | R55 nuevo (refina R12) | T25 |
| E3 | `NewBatch` usa `paths[]` + `originalNames?[]` alineados por posición, no `files[]`. El orden de subida se fija con `createdAt` + 1 ms por archivo. | R50, R51 sin cambio de texto | — (ya hecho en T10; `design.md > 6.3`) |
| E4 | El cron de borrado a 90 días borra también los avisos de las empresas **dadas de baja** (hoy solo recorre las activas). | R17 cambia | T26 |
| E5 | El **balanceo de 700 ms** de la campana se mantiene: excepción con nombre, solo para la campana, en `tests/guards/guard-movimiento.test.ts` (QC-228 R1), con su motivo. | R36 sin cambio de texto | T27 |

**Textos anteriores, para la historia:**

- R15: «… que el usuario tiene el permiso de consultar notificaciones y que el aviso le corresponde.»
- R17: «… recorriendo las empresas una a una.»
- R18: «Las notificaciones DEBEN ser un añadido por empresa con su propio permiso de consulta. Un
  usuario DEBE tener ese permiso efectivo solo si su rol lo tiene y el añadido está activo en su
  empresa.»
- R19: «MIENTRAS el añadido esté apagado en una empresa, el sistema NO DEBE crear avisos para ella,
  sus usuarios NO DEBEN ver la campana, y toda consulta o marcado de avisos de esos usuarios DEBE
  responder como "sin permiso" sin leer la bandeja.»
- R20: «CUANDO se da de alta una empresa nueva, el añadido de notificaciones DEBE nacer apagado.»
- R21: «Los roles de empresa (Administrador, Operador, Empacador y Acondicionamiento) DEBEN tener el
  permiso de consultar notificaciones. El Maestro NO DEBE tenerlo.»
- R22 y R37: condicionados a «el permiso efectivo».
- R40: «SI la consulta responde que no hay sesión o que el usuario ya no tiene el permiso efectivo …»
- R52: «CUANDO se aplica la migración del añadido, cada empresa que ya existía DEBE quedar con el
  añadido de notificaciones prendido. …»
- R53: «El añadido de notificaciones NO DEBE depender de ningún otro añadido …»

**Trazabilidad de los requisitos cambiados y nuevos.** Los tests existentes vienen de la bitácora;
los «(T2x)» los escribe o reescribe esa tarea. Los tests que nombran R20, R52 o R53, o que prueban
el permiso o el añadido, **se borran o se reescriben** en T24: un requisito retirado no se prueba.

| R | Test |
| --- | --- |
| R15 | `tests/unit/notificaciones/authorization.test.ts` › «R15: un actor sin ningún permiso lee su bandeja con empresa, usuario, rol y corte de 90 días» y «R15: marcar pasa a la bandeja el mismo alcance» (T24) |
| R17 | `tests/unit/notificaciones/purge-route.test.ts` (los casos R17 actuales) + «R17: recorre también las empresas dadas de baja» (T26); `tests/unit/composition/notificaciones-wiring.test.ts` › «R17: la lista de empresas del cron es la de todas, no la de activas» (T26); `tests/integration/identity/company-directory-addons.int.test.ts` (el que ya prueba `listActiveCompanyIds`) › «QC-137 R17: listAllCompanyIds incluye las empresas dadas de baja» (T26) |
| R18 | `tests/unit/identity/addons/company-addons.test.ts` › «QC-137 R18: ADDONS no incluye notificaciones» (T24); `tests/integration/identity/notifications-addon-migration.int.test.ts` (R54) |
| R19 | `tests/unit/notificaciones/notify.test.ts` › «R19: crea el aviso sin consultar ningún añadido» (T24); `tests/unit/notificaciones-ui/notification-bell.test.tsx` › «con sesión monta la campana en la cabecera aunque no tenga ningún permiso» y «el layout no condiciona la campana a ningún permiso ni añadido de notificaciones» (tanda 3, renombrados con «R19» en T24); `tests/unit/notificaciones/notification-actions.test.ts` › «R19: con sesión y sin ningún permiso las cuatro acciones responden ok» (T24) |
| R21 | `tests/unit/identity/permissions.test.ts` › «QC-137 R21: el catálogo no tiene notificaciones.consultar y cada rol tiene los permisos de antes de QC-137» (T24) |
| R22 | Los de la tanda 3 (`notifications-provider.test.tsx`, `notification-bell.test.tsx`) |
| R36 | `tests/unit/notificaciones-ui/notification-bell.test.tsx` › «R36: al llegar un aviso la campana se balancea bajo motion-safe, y no al cargar» (T27); `tests/guards/guard-movimiento.test.ts` › «QC-137 R36: la excepción del balanceo de la campana admite solo ese nombre, en esos archivos y a 700 ms» y sus casos negativos (T27); los de la tanda 3 para pulso, entrada y fundido |
| R37 | `tests/unit/notificaciones-ui/polling-feed.test.ts` (tanda 3) |
| R40 | `tests/unit/notificaciones-ui/polling-feed.test.ts` › «R40: se para con unauthorized» (tanda 3, sin el caso `forbidden` tras T24); `notification-actions.test.ts` › «R40: sin sesión responde unauthorized» (tanda 1) |
| R54 | `tests/integration/identity/notifications-addon-migration.int.test.ts`, reescrito en T24: «QC-137 R54: tras las migraciones no queda permiso, asignación, añadido ni excepción», «QC-137 R54: aplicar la retirada dos veces no falla ni cambia nada», «QC-137 R54: la retirada limpia también filas que la migración de datos no escribió (asignación o excepción a mano)» |
| R55 | `tests/integration/identity/company-membership.int.test.ts` › «QC-137 R55: un usuario dado de baja de esa empresa da false» (T25); `tests/unit/notificaciones/notify.test.ts` › «R55: con el directorio en false no se crea el aviso y queda en el log» (T25, o el caso R12 actual si ya lo cubre: lo comprueba T25) |

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
| 2026-10-16 | ¿Dónde se ve? (revisión) | **Solo campana**, sin página `/notificaciones` ni ítem «Notificaciones» en el menú lateral; el menú lateral no cambia (vuelve a su versión de `dev`). **Sustituye** a la fila «¿Dónde se ve?», deja sin objeto la parte «y menú» de «¿Conteo?» y la parte «y en la página `/notificaciones`» de «Marcar todas como leídas», y las menciones al menú y a la pestaña «No leídas» de «Mecanismo de tiempo real». Decisión del humano, reflejada en Jira y en los tableros. |
| 2026-10-16 | Historial en el panel | El panel de la campana muestra **todos los avisos guardados (hasta 90 días)** con **carga automática al hacer scroll**: trae 10 y, al acercarse al final, pide los siguientes, con el `IntersectionObserver` del navegador y sin librería. Al final de la lista: «Cargando más avisos…», error con «Reintentar» que conserva lo ya cargado, y «No hay más avisos. Se conservan 90 días.». En el teléfono el panel se ancla a la pantalla, no a la campana. Decisión del humano, reflejada en Jira y en los tableros. |
| 2026-10-19 | ¿Un aviso por tanda o por archivo? | **Uno por tanda**, al terminar. No hay aviso por cada archivo fallido. Decisión del humano (pregunta 7). |
| 2026-10-19 | ¿Adónde lleva el aviso de PDFs? | A donde se subió la tanda: la lista de **Fórmulas** si se subió desde Fórmulas, y la **lista de Proveedores** si se subió desde un proveedor. **No se guarda `supplier_id`.** Enlaces «Ver fórmulas» / «Ver proveedores». Decisión del humano (pregunta 9). |
| 2026-10-19 | ¿Empresas existentes? | El añadido arranca **prendido** en las empresas que ya existen, con una migración como la de QC-277. Las nuevas nacen apagadas (QC-277 D7). Decisión del humano (pregunta 5). |
| 2026-10-19 | ¿Depende de «Integraciones»? | **No.** El añadido no depende de ningún otro. Decisión del humano (pregunta 6). |
| 2026-10-19 | ¿Con qué se hace la carga al hacer scroll? | Con **`react-intersection-observer`**, ya aprobada. Se amplía la guardia de QC-140 para admitir el archivo nuevo que la importa, con su test. **Sustituye** la parte «con el `IntersectionObserver` del navegador y sin librería» de la fila «Historial en el panel»: la había propuesto el leader en el tablero, no fue decisión del humano. Decisión del humano (pregunta 11). |
| 2026-10-19 | ¿Se nombra el archivo que falló? | **Sí.** Se guarda el nombre original de cada archivo (columna nueva, migración con `down.sql`). Los archivos ya guardados quedan sin nombre y su aviso usa el texto genérico. Con varios fallidos, el aviso los nombra con un tope y «y N más» (R51). Decisión del humano (pregunta 8). |
| 2026-10-19 | Hora relativa y textos | Relativa hasta 7 días («hace 3 min», «hace 5 h», «hace 3 días»); después, fecha y hora («14/10/2026 09:12»). Textos de los avisos: los del tablero, ajustados a lo anterior. Decisión del humano (pregunta 4). |
| 2026-10-19 | Panel en el teléfono | 8 px a los lados y 16 px abajo. Decisión del humano (pregunta 10). |
