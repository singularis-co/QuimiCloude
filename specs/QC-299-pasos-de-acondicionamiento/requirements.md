# QC-299 — pasos-de-acondicionamiento · requirements.md

> Zona: fullstack · Complejidad: high · depends_on: [] · Rama: `feature/QC-299-pasos-de-acondicionamiento`
>
> **Alcance.** La fórmula puede tener sus propios **pasos de acondicionamiento**, opcionales y
> separados de los pasos del operador y de los de envasado. Misma estrategia que los pasos de
> envasado del empacador (QC-211). Lo que entra:
>
> - **Tercera sección «Acondicionamiento (opcional)»** en el formulario de alta y edición de la
>   fórmula, con el mismo editor y formato de filas que Pasos y Envasado (QC-211 D14).
> - **Dos switches por paso**, apagados por defecto: «Requiere evidencia» (QC-214) y
>   «Asignación requerida» (nuevo, solo en acondicionamiento).
> - **Paso a paso del acondicionador** en `/asignacion/acondicionamiento/<id>`, después de pulsar
>   «Acondicionar» (QC-218). El último paso lleva a «Terminar», que sigue exigiendo los datos de
>   lote como hoy (QC-219).
> - **Asignación requerida:** en ese paso el acondicionador elige uno o varios responsables entre
>   el equipo del pedido y él mismo. No avanza sin al menos uno.
> - **El avance se guarda:** al recargar, el acondicionador vuelve al paso en que iba.
> - **El recorrido de ejecución (QC-283) registra** qué usuarios fueron responsables de qué paso.
>
> **Lo que NO entra.**
>
> - Importación desde PDF: los PDF no traen pasos de acondicionamiento; se cargan a mano.
> - Responsables por paso en el detalle del pedido: solo en el recorrido.
> - Asignación por paso en los pasos del operador o de envasado.
> - Guardar el avance de los pasos del operador o de envasado: siguen como hoy.
> - Fases en los ingredientes (QC-173).
> - Rediseño de la pantalla del operario (QC-291): va después de esta ficha.
>
> Sembrado por `/afinar-feature` el 2026-10-16. El bloque de Alcance y la tabla de «Decisiones
> cerradas» los fijó el humano ANTES del spec. `spec_author` los respeta, no los reabre y no los
> reescribe: su trabajo aquí es `## Requisitos (EARS)`.

## Requisitos (EARS)

> Terminología. **Pasos del operador**: la lista que ya existe. **Pasos de envasado**: los de
> QC-211. **Pasos de acondicionamiento**: la lista nueva. **Fórmula** y **receta** son lo mismo.
> **Pantalla de acondicionamiento**: `/asignacion/acondicionamiento/<id>`. **Acondicionador**: quien
> pulsó «Acondicionar» y figura como quien acondiciona el pedido. **Equipo**: las personas guardadas
> al pulsar «Acondicionar» (QC-218). **Paso completado**: un paso de acondicionamiento que el
> acondicionador dejó atrás hacia delante al menos una vez, con su registro en el servidor.
> Entre paréntesis, la pregunta de `## Decisiones cerradas` que cubre cada requisito.

### Modelo y validación

- **R1.** (¿Son obligatorios?) El sistema DEBE aceptar el alta y la edición de una fórmula sin
  pasos de acondicionamiento. SI el alta omite la lista, ENTONCES el sistema DEBE guardarla vacía, y
  una fórmula con la lista vacía DEBE comportarse en todas las pantallas como una sin pasos de
  acondicionamiento. CUANDO se aplique la migración UP, toda fórmula existente DEBE quedar con la
  lista vacía y el resto de sus datos sin cambios; CUANDO se aplique la DOWN, el sistema DEBE quitar
  los pasos de acondicionamiento sin tocar ningún otro dato.
- **R2.** (¿Formato y topes?) El sistema DEBE validar cada paso de acondicionamiento con las mismas
  reglas que un paso del operador (estructura cerrada del documento, claves desconocidas
  rechazadas, sin paso vacío, como máximo 30 elementos) y DEBE rechazar una lista de más de 50. SI
  un paso o la lista incumple alguna regla, ENTONCES el sistema DEBE rechazar el guardado entero sin
  escribir nada.
- **R3.** (¿Formato y topes?) Los topes DEBEN contarse aparte por lista: una fórmula con 50 pasos
  del operador, 50 de envasado y 50 de acondicionamiento DEBE poder guardarse.
- **R4.** (¿Formato y topes?) El sistema DEBE guardar los pasos de acondicionamiento separados de
  los del operador y de los de envasado, en el orden recibido. CUANDO se lea una fórmula, el sistema
  DEBE devolver las tres listas intactas, en su orden, sin ningún paso de una lista dentro de otra.
- **R5.** (¿Opciones por paso?) Cada paso de acondicionamiento DEBE admitir dos marcas opcionales,
  «Requiere evidencia» y «Asignación requerida»; ausente DEBE equivaler a apagada. SI un paso del
  operador o de envasado trae la marca «Asignación requerida», ENTONCES el sistema DEBE rechazar el
  guardado entero.
- **R6.** (¿Dónde se editan y quién?) SI el actor no tiene `recetas.modificar`, ENTONCES el sistema
  NO DEBE guardar pasos de acondicionamiento por ninguna vía, y DEBE rechazar antes de validar la
  entrada y antes de tocar ningún puerto, igual que hoy con el resto de la fórmula.
- **R7.** (¿Importación desde PDF?) La revisión de una importación desde PDF NO DEBE mostrar
  sección de pasos de acondicionamiento. CUANDO se confirme una importación que crea una fórmula, la
  fórmula DEBE quedar sin pasos de acondicionamiento. CUANDO se confirme una importación que
  reemplaza una fórmula, el sistema DEBE conservar los pasos de acondicionamiento que tenía, sin
  cambios (ver P4).

### Formulario de fórmula

- **R8.** (¿Dónde se editan y quién?; Pase `/design`) El formulario de alta y el de edición DEBEN
  mostrar, después de «Envasado» y separada por un divisor, una sección «Acondicionamiento» marcada
  «(opcional)», con la ayuda «Opcional. Pasos que sigue el acondicionador uno a uno al acondicionar
  el pedido. «Asignación requerida» le pide elegir quién del equipo hizo el paso.» y con el mismo
  editor y formato de filas que «Pasos» y «Envasado»: abre con una fila vacía; añadir y quitar con
  «+» y «×» en la barra de cada fila; negrilla, cursiva y lista de verificación; reordenar por
  arrastre y por teclado. CUANDO se guarde, una fila vacía que el usuario no tocó NO DEBE enviarse.
- **R9.** (¿Opciones por paso?) Cada fila de «Acondicionamiento» DEBE ofrecer los switches
  «Requiere evidencia» y «Asignación requerida», los dos apagados en una fila nueva. Las filas de
  «Pasos» y «Envasado» DEBEN seguir ofreciendo solo «Requiere evidencia» y NO DEBEN ofrecer
  «Asignación requerida».
- **R10.** (¿Cómo se ven los switches en la fórmula?) En las tres secciones del formulario, cada
  switch DEBE mostrar solo su icono (cámara para evidencia, persona para asignación), sin texto
  visible ni icono «!» aparte; DEBE tener como nombre accesible el texto completo con el número de
  paso y la sección; y DEBE mostrar un tooltip con su texto completo tanto al pasar el ratón como al
  recibir el foco del teclado. MIENTRAS un switch esté encendido, la fila DEBE mostrar debajo del
  editor su línea de ayuda: «Al ejecutar, este paso pide de 1 a 3 fotos antes de avanzar.» o «Al
  ejecutar, hay que elegir uno o más responsables del equipo antes de avanzar.».
- **R11.** (Pase `/design`) La cabecera de la sección «Acondicionamiento» DEBE resumir cuántos
  pasos tiene, cuántos piden evidencia y cuántos piden responsables, omitiendo las cifras en cero.
- **R12.** (¿Dónde se editan y quién?) CUANDO se guarde el formulario, el sistema DEBE enviar los
  pasos de acondicionamiento en el orden en que el usuario los ve y con sus dos marcas. SI un paso de
  acondicionamiento no es válido, ENTONCES el formulario DEBE mostrar el error junto a ese paso y NO
  DEBE atribuirlo a ningún paso de otra sección, ni el de otra sección a uno de acondicionamiento.
- **R13.** (¿Dónde se editan y quién?) CUANDO se abra la edición de una fórmula con pasos de
  acondicionamiento, el formulario DEBE cargarlos con su formato, sus listas de verificación y sus
  dos marcas intactas, en su orden. Guardar sin tocarlos DEBE dejarlos idénticos.

### Versiones

- **R14.** (¿Versiones?) CUANDO se cree o se edite una versión, el sistema NO DEBE guardar pasos de
  acondicionamiento propios de la versión, aunque la entrada los traiga.
- **R15.** (¿Versiones?) CUANDO se lea una versión, ya sea en su ficha o en la pantalla de
  acondicionamiento de un pedido de esa versión, el sistema DEBE devolver los pasos de
  acondicionamiento de su original. CUANDO se editen los de la original, todas sus versiones DEBEN
  mostrar los nuevos en la siguiente lectura.
- **R16.** (¿Versiones?) El formulario de una versión DEBE mostrar los pasos de acondicionamiento
  heredados solo para leer, sin ningún control de edición ni switch. SI la original no tiene,
  ENTONCES DEBE mostrar un aviso de que no los tiene.

### Pantalla de acondicionamiento

- **R17.** (¿Cuándo los ve el acondicionador?) MIENTRAS el pedido esté `POR_ACONDICIONAR`, o
  `EN_ACONDICIONAMIENTO` a nombre de otra persona, o `TERMINADO` o `ENTREGADO`, el sistema NO DEBE
  entregar a la pantalla los pasos de acondicionamiento ni su avance, y la pantalla NO DEBE mostrar
  ninguno.
- **R18.** (¿Cuándo los ve el acondicionador?; Pase `/design`) MIENTRAS el pedido esté
  `EN_ACONDICIONAMIENTO` a nombre del actor y su receta tenga pasos de acondicionamiento, la
  pantalla DEBE mostrarlos con el paso a paso de la ejecución del operador: un paso por pantalla, en
  su orden, con «Paso N de M» y la barra de progreso, junto a las tarjetas «Equipo» y «Datos de
  lote».
- **R19.** (¿Cuándo los ve el acondicionador?) SI la receta del pedido no tiene pasos de
  acondicionamiento (incluida una versión cuya original no los tiene y un pedido cuya receta ya no se
  encuentra), ENTONCES la pantalla de acondicionamiento DEBE mostrarse y comportarse en todos sus
  estados exactamente como hoy.
- **R20.** (¿Regla de avance?) MIENTRAS el paso actual tenga elementos de lista de verificación sin
  marcar, o no hayan pasado 5 segundos desde que se llegó a él, la pantalla NO DEBE permitir avanzar
  ni completar los pasos, y DEBE decir el motivo como lo dice la ejecución del operador.
- **R21.** (¿Regla de avance?; ¿Opciones por paso?) MIENTRAS el paso actual tenga «Requiere
  evidencia», la pantalla DEBE ofrecer subir, cambiar y quitar de 1 a 3 fotos como en la ejecución
  del operador (QC-214) y, sin ninguna foto, NO DEBE permitir dejar el paso hacia delante y DEBE
  decir «Sube al menos una foto para avanzar.». SI llega al servidor el completado de un paso con
  «Requiere evidencia» sin ninguna foto suya, ENTONCES el sistema DEBE rechazarlo sin escribir nada.
- **R22.** (Asignación requerida: ¿entre quiénes?; ¿Cuántos responsables por paso?) MIENTRAS el
  paso actual tenga «Asignación requerida», la pantalla DEBE ofrecer elegir, con selección múltiple,
  entre las personas del equipo y el propio acondicionador, marcado «(tú)», y decir cuántos van
  elegidos. Sin ninguno elegido, la pantalla NO DEBE permitir dejar el paso hacia delante y DEBE
  decir «Elige al menos un responsable para avanzar.».
- **R23.** (Asignación requerida: ¿entre quiénes?) SI llega al servidor el completado o el cambio de
  responsables de un paso con «Asignación requerida» sin ningún responsable, con alguno que no sea
  del equipo del pedido ni el acondicionador, o con uno repetido; o con responsables en un paso sin
  «Asignación requerida», ENTONCES el sistema DEBE rechazarlo sin escribir nada.
- **R24.** (¿Cuándo los ve el acondicionador?; ¿Datos de lote?) En el último paso, el botón DEBE
  decir «Completar pasos». CUANDO se pulse sin estar bloqueado, el sistema DEBE registrar el último
  paso como completado y la pantalla DEBE mostrar «Pasos completos», con «Volver a los pasos», y
  ofrecer «Terminar». CUANDO se pulse «Terminar», el sistema DEBE terminar el acondicionamiento
  exactamente como hoy: misma acción, misma exigencia de datos de lote, mismos errores visibles y
  misma navegación.
- **R25.** (¿Datos de lote?) MIENTRAS la receta tenga pasos de acondicionamiento y alguno siga sin
  completar, la tarjeta «Datos de lote» DEBE mostrarse deshabilitada con la nota «Al completar los
  pasos» y «Terminar» NO DEBE ofrecerse. SI llega al servidor «Terminar» con pasos de
  acondicionamiento sin completar, ENTONCES el sistema DEBE rechazarlo sin cambiar el pedido (ver
  P1).
- **R26.** (¿Qué pasa al recargar?) CUANDO el acondicionador vuelva a abrir la pantalla de un pedido
  `EN_ACONDICIONAMIENTO` a su nombre, la pantalla DEBE entrar en el primer paso sin completar o, si
  están todos completados, en «Pasos completos»; DEBE conservar los responsables y las fotos ya
  guardados de cada paso; y, SI hay al menos un paso completado y alguno pendiente, ENTONCES DEBE
  avisar «Retomaste donde ibas». Las marcas de lista de verificación NO DEBEN conservarse.
- **R27.** (¿Qué pasa al recargar?) El sistema DEBE guardar el avance en el servidor: SI llega el
  completado de un paso que no es el siguiente al último completado (salta pasos o el paso ya no
  existe en la fórmula), ENTONCES DEBE rechazarlo sin escribir nada.
- **R28.** (¿Se puede cambiar el responsable de un paso ya pasado?) MIENTRAS el pedido esté
  `EN_ACONDICIONAMIENTO` a nombre del actor, la pantalla DEBE permitir volver a un paso completado
  y cambiar sus responsables. CUANDO el acondicionador deje ese paso hacia delante con un conjunto de
  responsables distinto del guardado, el sistema DEBE añadir un registro nuevo con el conjunto nuevo
  y NO DEBE editar ni borrar el anterior; con el mismo conjunto NO DEBE escribir nada.
- **R29.** (¿Se puede cambiar el responsable de un paso ya pasado?) SI el pedido ya no está
  `EN_ACONDICIONAMIENTO` a nombre del actor, ENTONCES el sistema DEBE rechazar todo completado de
  paso y todo cambio de responsables sin escribir nada.

### Quién los ve, permisos y lectura en vivo

- **R30.** (¿Quién los ve?) La ejecución del operador y la pantalla de empaque NO DEBEN recibir ni
  mostrar pasos de acondicionamiento. La pantalla de acondicionamiento NO DEBE recibir ni mostrar
  pasos del operador ni de envasado.
- **R31.** (¿Quién los ve?) CUANDO un actor con `acondicionamiento.modificar` y sin
  `recetas.consultar` abra un pedido `EN_ACONDICIONAMIENTO` a su nombre, el sistema DEBE entregarle
  los pasos de acondicionamiento y su avance. SI el actor no tiene `acondicionamiento.modificar`,
  ENTONCES cada caso de uso de esta ficha que recorre o registra pasos DEBE rechazar antes de validar
  la entrada y antes de leer ningún puerto.
- **R32.** (Heredados) El sistema DEBE leer y escribir pasos, avance, responsables y fotos de
  acondicionamiento solo dentro de la empresa del actor: SI el pedido o su receta no son de su
  empresa, ENTONCES NO DEBE entregar ni escribir nada.
- **R33.** (¿Copia en el pedido?) El sistema NO DEBE copiar los pasos de acondicionamiento al
  pedido: CUANDO se editen los de una fórmula con pedidos `EN_ACONDICIONAMIENTO`, la siguiente
  apertura de esos pedidos DEBE mostrar los pasos nuevos. SI la receta está dada de baja, ENTONCES
  el acondicionador DEBE seguir viendo sus pasos.
- **R34.** (¿Opciones por paso?: «Requiere evidencia» de QC-214) MIENTRAS algún pedido
  `EN_ACONDICIONAMIENTO` de la fórmula o de una de sus versiones tenga fotos de evidencia de
  acondicionamiento, el sistema DEBE rechazar una edición que quite o mueva pasos de
  acondicionamiento, igual que hoy con los del operador y los de envasado; cambiar el texto, los
  switches o añadir pasos al final DEBE seguir permitido.

### Recorrido de ejecución

- **R35.** (El recorrido registra; Pase `/design`) CUANDO se complete un paso de acondicionamiento,
  el sistema DEBE anotarlo en el registro de ejecución con quien lo completó, el instante, el número
  de paso y, si el paso tiene «Asignación requerida», sus responsables. El recorrido del pedido
  (QC-283) DEBE mostrar cada anotación como «Avanzar» o, la del último paso, «Completar pasos», con
  el número de paso, los nombres de los responsables y cuántas fotos de evidencia tiene ese paso.
- **R36.** (¿Se puede cambiar el responsable…?) CUANDO se registre un cambio de responsables
  (R28), el recorrido DEBE mostrarlo como «Cambio de responsables» con el número de paso, quien lo
  hizo, el conjunto anterior y el nuevo.
- **R37.** (¿Dónde se ven los responsables?) El detalle del pedido y la lista del recorrido NO DEBEN
  cambiar: los responsables por paso solo se muestran en el recorrido de un pedido.
- **R38.** (El recorrido registra) Las anotaciones nuevas DEBEN contar dentro de la fase de
  acondicionamiento: la duración de esa fase y la total DEBEN medirse igual que hoy, desde
  «Comenzar acondicionamiento» hasta «Terminar acondicionamiento».

### Prueba de punta a punta

- **R39.** (¿E2E?) DEBE existir una prueba E2E en la que el Administrador crea una fórmula con
  pasos de acondicionamiento, uno de ellos con «Asignación requerida»; el acondicionador pulsa
  «Acondicionar» con equipo, recorre los pasos, elige un responsable, recarga y retoma en el paso
  en que iba, completa los pasos, guarda los datos de lote y termina; el recorrido muestra el
  responsable del paso; y ni el operador ni el empacador ven ningún paso de acondicionamiento.

### Cobertura de las decisiones cerradas

| Decisión | Requisitos |
|---|---|
| ¿Son obligatorios? | R1 |
| ¿Formato y topes? | R2, R3, R4 |
| ¿Dónde se editan y quién? | R6, R8, R12, R13 |
| ¿Versiones? | R14, R15, R16 |
| ¿Cuándo los ve el acondicionador? | R17, R18, R19, R24 |
| ¿Regla de avance? | R20, R21, R22 |
| ¿Quién los ve? | R30, R31 |
| ¿Copia en el pedido? | R33 |
| ¿Opciones por paso? | R5, R9, R21, R34 |
| Asignación requerida: ¿entre quiénes? | R22, R23 |
| ¿Se puede cambiar el responsable de un paso ya pasado? | R28, R29, R36 |
| ¿Qué pasa al recargar? | R26, R27 |
| ¿Cuántos responsables por paso? | R22, R23 |
| ¿Cómo se ven los switches en la fórmula? | R10 |
| ¿Dónde se ven los responsables? | R35, R37 |
| ¿Importación desde PDF? | R7 |
| ¿Datos de lote? | R24, R25 |
| ¿Orden frente a QC-291? | No es comportamiento del sistema: `design.md > Coordinación` y `tasks.md`. |
| ¿E2E? | R39 |
| Heredados | R32 (empresa); identificadores en inglés y sin dependencias: `design.md`, lo revisa el reviewer. |
| Pase `/design` | R8, R10, R11, R18, R22, R35, R36 |

## Preguntas abiertas

> El spec toma la opción marcada «por defecto» en cada una; si el humano decide otra cosa en la
> aprobación, se corrige antes de F2.

- **P1. ¿El servidor exige los pasos completos?** Los tableros bloquean «Datos de lote» y
  «Terminar» hasta completar los pasos, pero ninguna decisión dice si eso se controla también en el
  servidor (QC-211 lo dejó solo en el cliente, pero allí el avance no se guardaba). Por defecto:
  `Terminar` se rechaza en el servidor con pasos pendientes (R25); guardar datos de lote **no** se
  rechaza en el servidor, solo se deshabilita en pantalla.
- **P2. «Paso N de M» en el recorrido.** El tablero `RecorridoPasosAcondicionamiento` muestra
  «Paso 2 de 4», pero el registro no guarda cuántos pasos tenía la fórmula en ese momento, y la
  fórmula se lee en vivo. Por defecto: el recorrido muestra «Paso N», como hoy los pasos del
  operador. Mostrar «de M» pide guardar el total en cada anotación.
- **P3. ¿Los responsables bloquean mover pasos?** Los responsables, como las fotos, se atan al
  número de paso: mover o quitar un paso de acondicionamiento con pedidos a medias los desplaza. Por
  defecto: el bloqueo de R34 solo cuenta fotos, como el heredado de QC-214.
- **P4. Reemplazo por PDF.** Los PDF no traen pasos de acondicionamiento; R7 asume que reemplazar
  una fórmula por importación los conserva (si no, se borrarían los cargados a mano). Confirmar.
- **P5. Formulario de versión sin tablero propio.** El bloque de solo lectura de R16 calca el de
  envasado (mismas piezas, sin UI nueva) y se ampara en la excepción del pase de diseño. Confirmar o
  pedir tablero.
- **P6. «Retroceder» no se anota.** El tablero del recorrido no muestra vueltas atrás y R26 retoma
  en el primer paso sin completar, no en el último que se vio. Por defecto: volver atrás no escribe
  nada en el servidor; solo escriben completar un paso y cambiar responsables.

## Decisiones cerradas (no reabrir)

| Fecha | Pregunta | Decisión |
| --- | --- | --- |
| 2026-10-16 | ¿Son obligatorios? | No. Una fórmula puede no tener pasos de acondicionamiento; las existentes no se migran. Heredado de QC-211 D1 y D13. |
| 2026-10-16 | ¿Formato y topes? | Los mismos que los pasos del operador (QC-62), guardados aparte de los del operador y de los de envasado. Heredado de QC-211 D2. |
| 2026-10-16 | ¿Dónde se editan y quién? | En alta y edición, sección propia «Acondicionamiento (opcional)», mismo editor y formato de filas que Pasos y Envasado, con los dos switches en la barra de la fila. Solo el Administrador. Heredado de QC-211 D3 y D14. |
| 2026-10-16 | ¿Versiones? | Heredan los pasos de acondicionamiento de la original, solo lectura. Heredado de QC-211 D4. |
| 2026-10-16 | ¿Cuándo los ve el acondicionador? | Después de pulsar «Acondicionar» (QC-218); el último paso lleva a «Terminar». Sin pasos, la pantalla se ve como hoy. Heredado de QC-211 D6 y D8. |
| 2026-10-16 | ¿Regla de avance? | Checks + espera de 5 s (QC-64, QC-125), más evidencia y responsables cuando el paso los exige. Heredado de QC-211 D7. |
| 2026-10-16 | ¿Quién los ve? | Solo el acondicionador. El operador y el empacador no los ven; el acondicionador no ve los pasos del operador ni los de envasado. Lee con su permiso de acondicionamiento (QC-216), sin `recetas.consultar`. Autorización en el caso de uso. Heredado de QC-211 D9 y D10. |
| 2026-10-16 | ¿Copia en el pedido? | No: lectura en vivo de la fórmula. Heredado de QC-211 D11. |
| 2026-10-16 | ¿Opciones por paso? | Dos switches, apagados por defecto: «Requiere evidencia» (QC-214) y «Asignación requerida» (nuevo). |
| 2026-10-16 | Asignación requerida: ¿entre quiénes? | Entre el equipo elegido al pulsar «Acondicionar» (QC-218) y el propio acondicionador. Uno o varios; al menos uno para avanzar. |
| 2026-10-16 | ¿Se puede cambiar el responsable de un paso ya pasado? | Sí, mientras el pedido sigue en acondicionamiento. Al «Terminar» queda fijo. Cada cambio entra en el recorrido como un registro nuevo; el anterior no se edita ni se borra (heredado de QC-82). |
| 2026-10-16 | ¿Qué pasa al recargar? | Retoma donde iba: el avance por los pasos de acondicionamiento se guarda en el servidor. Responsables y fotos ya puestos se conservan. |
| 2026-10-19 | ¿Cuántos responsables por paso? | Uno o más, del equipo del pedido, incluido el propio acondicionador. Ninguno no deja avanzar un paso con «Asignación requerida». |
| 2026-10-19 | ¿Cómo se ven los switches en la fórmula? | Solo icono (cámara = evidencia, persona = asignación), con el nombre completo para lector de pantalla. Cada switch muestra un tooltip con su texto completo al pasar el ratón o con foco (sin icono «!» aparte). |
| 2026-10-16 | ¿Dónde se ven los responsables? | Solo en el recorrido de ejecución (QC-283). El detalle del pedido no cambia. |
| 2026-10-16 | ¿Importación desde PDF? | No entra: los PDF no especifican pasos de acondicionamiento. Se aparta de QC-211 D5. |
| 2026-10-16 | ¿Datos de lote? | Pasos primero; «Terminar» al final sigue exigiendo los datos de lote como hoy (QC-219). |
| 2026-10-16 | ¿Orden frente a QC-291? | QC-299 es prioridad; QC-291 va después. |
| 2026-10-16 | ¿E2E? | Sí: el Administrador crea la fórmula con pasos de acondicionamiento (uno con asignación requerida); el acondicionador comienza, asigna, recarga y retoma, termina; el recorrido muestra el responsable; operador y empacador no los ven. |
| 2026-10-16 | Heredados | Identificadores en inglés (QC-4); aislamiento por empresa; sin dependencias nuevas salvo aprobación (regla 7). |
| 2026-10-19 | Pase `/design` (era la pregunta abierta 1) | Aprobado por el humano: 9 tableros en `docs/diseno/canvas/{FormulaAcondicionamiento,AcondicionamientoPasos,RecorridoPasosAcondicionamiento}{,Tablet,Movil}.dc.html`. Switches de la fórmula solo con icono y tooltip propio; uno o más responsables por paso. |
