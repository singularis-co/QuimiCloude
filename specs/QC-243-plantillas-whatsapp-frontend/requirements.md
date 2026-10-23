# QC-243 — plantillas-whatsapp-frontend · requirements.md

> Zona: frontend · Complejidad: medium · Épica: QC-220 «Integraciones» · depends_on: QC-242 (done,
> PR #281 y #287) · Rama: feature/QC-243-plantillas-whatsapp-frontend
>
> **Fuente.** La ficha del board está desactualizada: la enmienda de QC-242 (diccionario de variables,
> relación `{{n}}` ↔ clave, «habilitada») entró en esta ficha el 2026-10-22 y el pase `/design` se
> aprobó el mismo día. Mandan, en este orden: `progress/features/QC-243.md > Decisiones` (todas las del
> 2026-10-22) y los tableros aprobados de `docs/diseno/canvas/` (`design.md > 2`). De la ficha se
> conserva lo que esas decisiones no cambian (D1, D3, D4, D5). Este archivo **no venía sembrado** por
> `/afinar-feature`: el Alcance y la tabla de decisiones salen de esas dos fuentes, sin añadir nada.

## Alcance

En `/integraciones/whatsapp` (QC-237), la fila de pestañas pasa a ser **«Conexión | Plantillas |
Variables»**. El Administrador (`integraciones.modificar`) puede, consumiendo solo los Server Actions de
QC-242:

- **Plantillas** (exige conexión): ver las plantillas de su conexión con su estado en Meta y su uso en
  el sistema, sincronizar con Meta, crear una plantilla con vista previa, duplicarla, eliminarla,
  relacionar sus variables `{{n}}` con datos del diccionario y habilitarla o deshabilitarla.
- **Variables** (no exige conexión): ver las constantes del sistema (de solo lectura, definidas en el
  front) y crear, editar y eliminar las variables propias de la empresa.

El alta escribe las variables como `{{clave}}` del diccionario; el ejemplo que recibe Meta es la
etiqueta (QC-242 E15), así que no hay «Agregar variable `{{n}}`» ni campo de ejemplo.

## Lo que NO entra

- **Encabezado (HEADER) y botones en el alta.** Los botones son una investigación aparte (tarjeta
  QT-290); la decisión «URL de botón fija, sin variables» queda para esa tarjeta. Una plantilla
  importada que ya trae encabezado o botones los muestra en la vista previa.
- Headers con imagen, video o documento, variables con nombre (`NAMED`) y plantillas OTP (QC-242 no las
  soporta: se ven como «No compatible»).
- Elegir una plantilla para enviar (fichas de Contactos y Notificaciones), estadísticas de uso.
- **Cualquier cambio de backend** (D5): Server Actions, dominio, esquema y migraciones son de QC-242.
  Lo que esta pantalla necesitaría del backend y no existe está en `## Preguntas abiertas`.
- El catálogo real de constantes del sistema y su resolución al enviar (QC-245, QC-247): aquí solo
  las tres de ejemplo.
- Actualización en tiempo real (D4).

## Decisiones cerradas (no reabrir)

| # | Decisión | Fuente | Cubierta por |
| --- | --- | --- | --- |
| D1 | Duplicar en lugar de editar: abre el alta con el contenido y el nombre con sufijo `_v2` | Ficha | R40 |
| D2 | **Reemplazada por G15.** «Ejemplo obligatorio por variable» deja de aplicar | Ficha → 2026-10-22 | — |
| D3 | Mismas validaciones que el dominio de QC-242: el error se ve antes de enviar | Ficha | R22, R31, R53 |
| D4 | Sin tiempo real: se refresca al entrar en la pestaña y al sincronizar | Ficha | R5, R8 |
| D5 | 100 % frontend; los Server Actions vienen de QC-242 | Ficha (humano, 2026-10-09) | R62 |
| G1 | Una sola fila de pestañas «Conexión \| Plantillas \| Variables» | 2026-10-22 | R1 |
| G2 | La pestaña Variables no exige conexión | 2026-10-22 | R2 |
| G3 | Alta sin encabezado (HEADER) ni botones | 2026-10-22 | R21, R34 |
| G4 | Categoría como desplegable, con la descripción en cada opción | 2026-10-22 | R25 |
| G5 | La clave de una variable propia es de solo lectura, la arma el front desde la etiqueta (sin tildes ni mayúsculas, espacios y signos como `_`) y no se cambia nunca; etiqueta y valor sí, aunque esté en uso | 2026-10-22 | R51, R52, R55 |
| G6 | Constantes del sistema de ejemplo, definidas en el front; el catálogo real se define después | 2026-10-22 | R48 |
| G7 | Vista previa: una variable propia muestra su valor; una constante, su etiqueta | 2026-10-22 | R32, R44 |
| G8 | Idiomas del alta: solo español (con variantes) e inglés | 2026-10-22 | R24 |
| G9 | Plantilla no relacionable (QC-242 P16) = «No compatible» con su motivo y sin «Relacionar» | 2026-10-22 | R14, R15, R20 |
| G10 | Rechazada = icono «!» con el motivo en un globo | 2026-10-22 | R13 |
| G11 | Confirmación antes de enviar a autorización, antes de guardar una relación (resumen `{{n}}` → dato) y antes de cambiar el valor de una variable en uso (antes/ahora, cuántas plantillas, aviso de formato) | 2026-10-22 | R33, R45, R56, R57 |
| G12 | Constantes en tabla con etiqueta, clave, descripción y ejemplo; en los menús de insertar y relacionar se ve la clave de cada dato y no hay etiquetas «Constante»/«Propia» | 2026-10-22 | R27, R42, R47 |
| G13 | Los diálogos no nombran a Meta ni a la empresa («se va a enviar para autorización», «Esta acción no se puede deshacer»); se retira la pregunta sobre reutilizar el nombre de una plantilla eliminada | 2026-10-22 | R37, R41 |
| G14 | Claves de las constantes con el mismo formato que las propias: `nombre_del_cliente`, `numero_de_pedido`, `nombre_de_la_empresa` | 2026-10-22 | R48 (choque con QC-242 R88: **P1**) |
| G15 | La enmienda de QC-242 entra en esta ficha: el alta escribe `{{clave}}`, el ejemplo para Meta es la etiqueta; no hay «Agregar variable `{{n}}`» ni campo de ejemplo | 2026-10-22 | R27, R29, R30, R31, R34 |
| G16 | Variable propia con campo nuevo «Descripción» | 2026-10-22 | R49, R58 (sin backend: **P2**) |

## Requisitos (EARS)

Convenciones: «la pantalla» es `/integraciones/whatsapp`. «Relacionable» es una plantilla cuyo
contenido el sistema puede relacionar (`design.md > 6.2`); «sin relacionar» es una relacionable con
`mappingStatus = 'UNMAPPED'`. «Diccionario» son las tres constantes del front más las variables propias
que devuelve `listWhatsappDictionaryAction`. Los textos entre «» son literales de los tableros.

### Pestañas y carga

**R1.** La pantalla DEBE mostrar una sola fila de pestañas «Conexión», «Plantillas» y «Variables», en
ese orden, y DEBE abrir en «Conexión».

**R2.** MIENTRAS la empresa no tiene conexión de WhatsApp, la pestaña «Plantillas» DEBE estar
deshabilitada y descrita (`aria-describedby`) por el texto «Conecta tu número primero para ver
Plantillas.», y la pestaña «Variables» DEBE estar habilitada.

**R3.** MIENTRAS la empresa tiene conexión, la pestaña «Plantillas» DEBE estar habilitada y mostrar el
listado de plantillas de `listWhatsappTemplatesAction`.

**R4.** El contenido de la pestaña «Conexión» NO DEBE cambiar respecto de QC-237.

**R5.** CUANDO el Administrador entra en la pestaña «Plantillas» o «Variables», la pantalla DEBE
volver a pedir sus datos al servidor; no DEBE haber ninguna otra actualización automática. (D4)

**R6.** SI falla la carga del listado de plantillas o del diccionario, ENTONCES la pestaña afectada
DEBE mostrar el mensaje del error con un reintento, y las otras pestañas DEBEN seguir funcionando.

### Sincronización

**R7.** La pestaña «Plantillas» DEBE mostrar una barra «Sincronización con Meta» con «Última:» seguido
de la hora de la última sincronización de la conexión (`templatesSyncedAt`) como `DD/MM/AAAA HH:MM` en
la zona horaria del dispositivo, o la marca de vacío si nunca se sincronizó. **[P4: el tipo
«automática» / «manual».]**

**R8.** CUANDO el Administrador pulsa «Sincronizar con Meta» (en la barra o en el estado vacío), la
pantalla DEBE llamar a `syncWhatsappTemplatesAction` y, mientras responde, mostrar el botón
deshabilitado con «Sincronizando…» y el icono girando, y el listado como esqueleto de carga; con éxito
DEBE mostrar el aviso «Plantillas sincronizadas con Meta.», la hora nueva, el resumen en tres etiquetas
«N importadas», «N actualizadas», «N eliminadas» y el listado actualizado.

**R9.** SI la sincronización falla, ENTONCES la pantalla DEBE mostrar el mensaje del error y dejar el
listado y la hora como estaban.

### Listado

**R10.** El listado DEBE mostrar por plantilla: nombre (con el inicio de su mensaje debajo), código de
idioma, categoría («Utilidad», «Marketing» o «Autenticación»), «Estado en Meta», «Uso en el sistema»,
«Última sincronización» y sus acciones; y, al pie, «N plantillas» con las que se ven.

**R11.** El estado en Meta DEBE pintarse como etiqueta de color: `APPROVED` «Aprobada», `PENDING`
«Pendiente», `REJECTED` «Rechazada», `PAUSED` «Pausada», `DISABLED` «Deshabilitada» y `OTHER`
«Otro · <valor crudo>», cada uno con el tono de `design.md > 6.5`.

**R12.** MIENTRAS el contenedor del listado mide 760 px o menos, cada plantilla DEBE verse como
tarjeta con nombre, estado, idioma, categoría y fecha, y debajo el interruptor de uso o «Relacionar
variables» y el botón «Acciones», que abre «Relacionar variables» (si aplica), «Duplicar» y
«Eliminar».

**R13.** DONDE una plantilla está `REJECTED` con motivo, la pantalla DEBE mostrar junto al estado un
icono «!» con nombre accesible «Motivo del rechazo: <motivo>» que, al pasar el puntero, al enfocarlo o
al tocarlo, muestra el motivo en un globo; en la tarjeta (R12) el motivo DEBE verse como texto, sin
globo.

**R14.** La columna «Uso en el sistema» DEBE mostrar: para una plantilla relacionada, un interruptor
con «Habilitada» o «Deshabilitada»; para una sin relacionar, la etiqueta «Sin relacionar» y el enlace
«Relacionar»; para una no relacionable, la etiqueta «No compatible» con su motivo debajo **[P5: texto
del motivo]** y ninguna forma de relacionarla.

**R15.** Una plantilla DEBE tratarse como no relacionable SI su contenido viene vacío, o SI su texto
trae una marca `{{…}}` que no es `{{<n>}}` ni la clave de uno de sus huecos relacionados.

**R16.** CUANDO el Administrador cambia el interruptor de una plantilla relacionada, la pantalla DEBE
llamar a `setWhatsappTemplateEnabledAction` con su id y el valor nuevo, y mostrar «Plantilla
habilitada.» o «Plantilla deshabilitada.»; SI la acción falla, ENTONCES DEBE mostrar el mensaje del
error y el interruptor DEBE volver a su valor anterior.

**R17.** SI hay al menos una plantilla sin relacionar, ENTONCES la pantalla DEBE mostrar sobre el
listado el aviso «1 plantilla importada de Meta está sin relacionar. Relaciónala para usarla en el
sistema.» o «N plantillas importadas de Meta están sin relacionar. Relaciónalas para usarlas en el
sistema.».

**R18.** La pantalla DEBE ofrecer una búsqueda «Buscar por nombre» (contiene, sin distinguir
mayúsculas) y los filtros «Todas», «Aprobadas», «Pendientes», «Rechazadas», «Pausadas»,
«Deshabilitadas» y «Sin relacionar», con uno activo a la vez; «Sin relacionar» DEBE mostrar solo las
plantillas sin relacionar, y los demás filtrar por estado en Meta; filtrar y buscar NO DEBEN pedir
nada al servidor.

**R19.** SI no hay ninguna plantilla, ENTONCES la pantalla DEBE mostrar «Todavía no hay plantillas.»,
«Crea una aquí o trae las que ya tienes aprobadas en Meta.» y los botones «Sincronizar con Meta» y
«Nueva plantilla»; SI hay plantillas pero ninguna pasa la búsqueda y el filtro, ENTONCES DEBE mostrar
«Ninguna plantilla coincide con la búsqueda.» con «Quitar filtros», que vacía la búsqueda y vuelve a
«Todas».

**R20.** El menú de acciones de cada plantilla DEBE ofrecer «Relacionar variables» solo si es
relacionable, «Duplicar» y «Eliminar».

### Nueva plantilla

**R21.** CUANDO el Administrador pulsa «Nueva plantilla», la pantalla DEBE abrir un panel «Nueva
plantilla» con el texto «Cada plantilla pasa por autorización antes de poder usarla. Suele tardar unas
horas.», los campos Nombre, Idioma, Categoría, Mensaje y Pie, y la vista previa; NO DEBE ofrecer
encabezado ni botones. (G3)

**R22.** El campo Nombre DEBE mostrar la ayuda «Solo minúsculas, números y guion bajo (_). Ejemplo:
pedido_listo.» y, en cuanto el texto contiene otro carácter, el error «Usa solo minúsculas, números y
guion bajo (_), sin espacios ni tildes.» en lugar de la ayuda; las demás reglas del nombre DEBEN ser
las del dominio. (D3)

**R23.** El alta DEBE abrir con Idioma «Español (es)», Categoría «Utilidad», y Nombre, Mensaje y Pie
vacíos.

**R24.** El campo Idioma DEBE ofrecer, agrupados como «Español» e «Inglés», solo `es` y los códigos
`es_*` de la lista de idiomas de QC-242, y `en`, `en_US` y `en_GB`, cada uno con su nombre y su código,
con la ayuda «El idioma del texto: español o inglés.». (G8)

**R25.** El campo Categoría DEBE ser un desplegable con «Utilidad» («Avisos sobre un pedido o una
cuenta: confirmaciones, estados, recordatorios.») y «Marketing» («Promociones y novedades. Tiene un
costo de envío distinto.»), cada opción con su descripción; con una elegida, el campo DEBE mostrar solo
su nombre y su descripción como ayuda debajo. (G4)

**R26.** Los campos Mensaje (obligatorio) y Pie («(opcional)», ayuda «Texto gris al final del mensaje.
Sin variables.») DEBEN mostrar un contador «N / límite» (1024 y 60) que cuenta el texto tal como lo
recibe Meta, con cada variable ya numerada, y que cambia al color de error al pasarse.

**R27.** CUANDO el Administrador pulsa «Insertar variable», la pantalla DEBE abrir un menú con los
grupos «Constantes del sistema» y «Variables propias» (etiqueta y clave de cada dato) y la opción
«Nueva variable propia»; elegir un dato DEBE insertar `{{clave}}` en la posición del cursor del
Mensaje (al final si no hay cursor). Junto al botón DEBE verse «Se escribe como {{clave}}.». (G12, G15)

**R28.** CUANDO el Administrador elige «Nueva variable propia» en ese menú, la pantalla DEBE abrir el
formulario de variable propia (R50) sin perder el borrador, y al guardarla la variable nueva DEBE
estar en el menú.

**R29.** MIENTRAS el Mensaje tiene variables del diccionario, el alta DEBE listar bajo «Variables en el
mensaje» cada una, sin repetir y por orden de aparición, como `{{clave}}` → etiqueta.

**R30.** SI el Mensaje tiene una marca `{{…}}` que no es una clave del diccionario (incluido `{{1}}`),
ENTONCES el alta DEBE mostrar «La variable <clave> no está en el diccionario. Elígela con «Insertar
variable» o créala como variable propia.» y NO DEBE permitir enviar.

**R31.** El alta DEBE validar el borrador con `validateKeyedTemplateDraft` del dominio y el
diccionario de la empresa mientras se escribe, mostrar cada problema en su campo y mantener «Enviar a
revisión» deshabilitado mientras haya alguno o falte el Mensaje. (D3)

**R32.** La vista previa DEBE pintar, mientras se escribe, una burbuja de chat con el mensaje (cada
variable propia por su valor y cada constante por su etiqueta, resaltadas; una clave desconocida como
`[clave]`), el pie en gris y la hora; con el Mensaje vacío DEBE decir «Escribe el mensaje para verlo
aquí.». (G7)

**R33.** CUANDO el Administrador pulsa «Enviar a revisión», la pantalla DEBE abrir el diálogo «Enviar
para autorización» con «La plantilla <nombre> se va a enviar para autorización. No se puede cambiar
mientras está en autorización; si hace falta otro texto, se duplica.», el idioma y la categoría
elegidos, las etiquetas de las variables usadas (o «Ninguna») y «Revisa el mensaje en la vista previa
antes de enviarlo.»; «Volver a revisar» DEBE cerrarlo sin enviar. (G11)

**R34.** CUANDO el Administrador pulsa «Enviar» en ese diálogo, la pantalla DEBE llamar a
`createWhatsappTemplateAction` con el borrador con claves, sin encabezado ni botones y con la etiqueta
de cada constante usada en `constantLabels`, y mientras responde el botón DEBE estar deshabilitado y
con indicador de carga.

**R35.** CUANDO la creación responde con éxito, la pantalla DEBE cerrar el panel, mostrar «Plantilla
enviada para autorización.» y la plantilla nueva en el listado como «Pendiente».

**R36.** SI la creación falla, ENTONCES el panel DEBE seguir abierto con el borrador intacto y mostrar
arriba «No se pudo enviar la plantilla» con el mensaje del error.

**R37.** Los diálogos de confirmación y los paneles de alta, relación y variable NO DEBEN contener la
palabra «Meta» ni el nombre de la empresa en sus textos fijos. (G13)

**R38.** MIENTRAS la pantalla mide menos de 768 px, los paneles de alta y de relación DEBEN ocupar la
pantalla entera con las pestañas «Formulario | Vista previa».

**R39.** CUANDO la vista previa gana una variable o un botón, ese elemento DEBE entrar con un fundido
de 240 ms, y SI el dispositivo pide reducir el movimiento, ENTONCES sin animación.

### Duplicar

**R40.** CUANDO el Administrador elige «Duplicar», la pantalla DEBE abrir el alta titulada «Duplicar
plantilla» con el nombre de la original seguido de `_v2`, su idioma, su categoría si es Utilidad o
Marketing, su mensaje y su pie, con cada variable relacionada como `{{clave}}` y cada hueco sin
relacionar como `{{<n>}}` (que R30 señala). **[P6: encabezado, botones y «No compatible».]** (D1)

### Eliminar

**R41.** CUANDO el Administrador elige «Eliminar», la pantalla DEBE pedir confirmación con «Eliminar
la plantilla» y «Se va a eliminar <nombre>. Esta acción no se puede deshacer.» («Volver» /
«Eliminar»); al confirmar DEBE llamar a `deleteWhatsappTemplateAction` y, con éxito, mostrar «Plantilla
eliminada.» y quitarla del listado; SI falla, ENTONCES DEBE mostrar el mensaje del error en el diálogo
y la plantilla DEBE seguir en el listado. (G13)

### Relacionar variables

**R42.** CUANDO el Administrador elige «Relacionar» o «Relacionar variables», la pantalla DEBE abrir
el panel «Relacionar variables» con «<nombre> · Elige qué dato va en cada hueco. Con todos
relacionados puedes habilitarla.», el «Texto de la plantilla» con sus `{{n}}`, un selector por hueco
con los grupos «Constantes del sistema» y «Variables propias» (etiqueta y clave), la relación actual
ya elegida, la ayuda «¿Falta un dato? Créalo en Variables y vuelve aquí.» y la vista previa. (G12)

**R43.** MIENTRAS falta elegir el dato de algún hueco, «Guardar» DEBE estar deshabilitado y el panel
DEBE decir «Falta relacionar el hueco <n>.» por cada uno.

**R44.** La vista previa del panel DEBE mostrar cada hueco elegido con el valor (propia) o la etiqueta
(constante) de su dato, y cada hueco sin elegir como «[<n> sin relacionar]». (G7)

**R45.** CUANDO el Administrador pulsa «Guardar», la pantalla DEBE abrir el diálogo «Revisa la
relación» con «<nombre> enviará estos datos en cada mensaje:» y una línea `{{n}}` → etiqueta y clave por
hueco; «Volver a revisar» DEBE volver al panel sin guardar. (G11)

**R46.** CUANDO el Administrador pulsa «Guardar relación», la pantalla DEBE llamar a
`relateWhatsappTemplateVariablesAction` con el id de la plantilla y un par hueco → clave por cada
hueco, y con éxito cerrar el panel, mostrar «Variables relacionadas. Ya puedes habilitarla.» y la fila
con su interruptor, entrando con un fundido; SI falla, ENTONCES DEBE mostrar el mensaje del error en el
diálogo sin cambiar nada.

### Variables

**R47.** La pestaña «Variables» DEBE mostrar «Las variables se insertan en las plantillas como
{{clave}}. Al enviar, el sistema pone el dato real. Meta ve la etiqueta como ejemplo cuando revisa la
plantilla.», la sección «Constantes del sistema» («Las resuelve el sistema con el dato de cada envío.
No se editan.») con una tabla Etiqueta, Clave, Descripción y Ejemplo sin acciones, y la sección
«Variables propias» (R49). (G12)

**R48.** Las constantes del sistema DEBEN ser exactamente tres, definidas en el front, con estos
datos de pantalla: `nombre_del_cliente` «Nombre del cliente» («Nombres y apellidos del cliente que
recibe el mensaje.», ejemplo «Laura Gómez»); `numero_de_pedido` «Número de pedido» («Número del pedido
del que trata el mensaje.», ejemplo «PED-00128»); `nombre_de_la_empresa` «Nombre de la empresa» («El
nombre de tu empresa en QuimiCloude.», ejemplo **[P7]**). La clave que viaja al backend es la de
**[P1]**. (G6, G14)

**R49.** La sección «Variables propias» DEBE mostrar «Datos fijos de tu empresa, como un número de
cuenta. Se guardan una vez y sirven para todas las plantillas; se envía el valor guardado.», el botón
«Nueva variable» y una tabla con Etiqueta, Clave, Descripción **[P2]**, Valor, «Plantillas que la usan»
y los botones de editar y eliminar de cada una; sin variables propias DEBE mostrar un estado vacío con
«Nueva variable».

**R50.** CUANDO el Administrador pulsa «Nueva variable», la pantalla DEBE abrir el panel «Nueva
variable» («Un dato fijo de tu empresa para usar en las plantillas.») con Etiqueta («Cómo se ve en la
app. Hasta 60 caracteres.»), Clave de solo lectura («Se arma sola desde la etiqueta: sin tildes ni
mayúsculas, espacios como _. No se puede cambiar después.»), Descripción **[P2]** («Para qué sirve el
dato, para quien arma las plantillas.») y Valor («Lo que se envía al cliente. Hasta 50 caracteres.»).

**R51.** MIENTRAS el Administrador escribe la etiqueta de una variable nueva, la Clave DEBE ser la
etiqueta sin tildes ni diacríticos, en minúsculas, con cada tramo de caracteres que no sean `a-z` o
`0-9` cambiado por un `_`, sin nada antes de la primera letra, sin `_` al final y cortada a 40
caracteres. (G5)

**R52.** SI la clave derivada queda vacía o coincide con la de otra variable propia o con la de una
constante, ENTONCES el panel DEBE mostrar el problema en el campo Clave y NO DEBE guardar.

**R53.** El panel DEBE validar etiqueta y valor con `validateWhatsappVariableKeyInput` del dominio y
mostrar cada problema en su campo antes de guardar. (D3)

**R54.** CUANDO el Administrador guarda una variable nueva válida, la pantalla DEBE llamar a
`createWhatsappVariableKeyAction` con clave, etiqueta y valor, cerrar el panel, mostrar «Variable
creada.» y la variable en la tabla y en los menús de insertar y relacionar; SI falla, ENTONCES el panel
DEBE seguir abierto con el mensaje del error.

**R55.** CUANDO el Administrador edita una variable propia, el panel DEBE titularse «Editar variable»,
mostrar su clave con «La clave no se cambia después de crear la variable.», permitir cambiar etiqueta y
valor aunque esté en uso, y llamar a `updateWhatsappVariableKeyAction` siempre con la clave guardada;
la ayuda del valor DEBE ser «Lo usan N plantillas. El valor nuevo se envía desde el próximo mensaje.
Hasta 50 caracteres.» si la usan N > 0 plantillas. (G5)

**R56.** SI el Administrador cambia el valor de una variable que usan N > 0 plantillas, ENTONCES antes
de guardar la pantalla DEBE abrir el diálogo «Revisa el cambio» con ««<etiqueta>» se envía en N
plantillas. Desde el próximo mensaje, los clientes recibirán el valor nuevo.», el valor «Antes»
tachado y el de «Ahora», y «Volver a revisar» / «Guardar cambio»; al confirmar DEBE guardar y mostrar
«Variable actualizada. El valor nuevo se envía desde el próximo mensaje.»; sin uso o sin cambio de
valor DEBE guardar sin diálogo y mostrar «Variable actualizada.». (G11)

**R57.** SI el valor nuevo de R56 empieza o acaba en espacio o tiene dos espacios seguidos, o SI el
anterior era solo dígitos y el nuevo no, ENTONCES el diálogo DEBE mostrar además «El valor nuevo tiene
espacios de más o no tiene el mismo formato que el anterior (antes solo números). Revísalo.». (G11)

**R58.** DONDE el backend guarda la descripción de una variable propia **[P2]**, el panel DEBE
enviarla y la tabla DEBE mostrarla; MIENTRAS no la guarde, el campo Descripción y su columna NO DEBEN
mostrarse en las variables propias.

**R59.** CUANDO el Administrador elimina una variable propia que no usa ninguna plantilla, la pantalla
DEBE pedir confirmación con «Eliminar la variable» y «Se va a eliminar «<etiqueta>». Esta acción no se
puede deshacer.», y al confirmar llamar a `deleteWhatsappVariableKeyAction` y mostrar «Variable
eliminada.»; SI la usan N > 0 plantillas, ENTONCES el diálogo DEBE decir «No se puede eliminar
«<etiqueta>»: la usan N plantillas. Quítala de esas plantillas primero.» con «Eliminar»
deshabilitado.

### Transversal

**R60.** Todo control de la pantalla DEBE medir al menos 44 × 44 px de objetivo táctil, todo campo de
texto DEBE usar letra de 16 px o más, y ningún dato ni acción DEBE depender solo de pasar el puntero.

**R61.** CUANDO llega por webhook la aprobación de una plantilla creada desde la pantalla y el
Administrador vuelve a entrar en «Plantillas», la plantilla DEBE verse «Aprobada».

**R62.** La ficha NO DEBE cambiar archivos de `lib/modules/`, `db/` ni `lib/composition/`, ni añadir
dependencias. (D5)

## Preguntas abiertas

Ninguna la ha decidido el humano. Cada una lleva la propuesta del spec (el **default** con el que se
implementa si se aprueba el spec tal cual) y qué cambio de backend implicaría la otra salida, que D5
deja fuera de esta ficha.

- **[P1] Claves de las constantes sin punto frente a QC-242 R88.** El backend reconoce una constante
  por el punto (`entidad.campo`) y trata `nombre_del_cliente` como variable propia: crear rechaza con
  `unknown_key` y relacionar con `whatsapp_variable_key_not_found`.
  **Default:** la pantalla muestra y escribe `nombre_del_cliente`, y una capa del front la traduce,
  solo al hablar con el backend, a una clave con punto: `cliente.nombre`, `pedido.numero` y
  `empresa.nombre` (las de la decisión del 2026-10-22 que G14 sustituyó en pantalla); al leer, al
  revés. Sin cambio de backend; R52 impide crear una propia con la clave de pantalla de una constante.
  **Otra salida (con backend):** enmienda 3 a QC-242 que relaje R88/R91/R93: el `CHECK` de
  `system_key` sin punto (migración), la petición de crear y la de relacionar marcando qué claves son
  constantes (`constantLabels` y un `kind` por par), y validar que una propia no use la clave de una
  constante enviada; QC-242 §19.7.3 descartó distinguirlas sin punto por el riesgo de que una propia
  posterior cambie el sentido de relaciones guardadas.
- **[P2] «Descripción» de la variable propia.** `WhatsappVariableKey` solo tiene clave, etiqueta y
  valor. **Default:** pedir al backend una enmienda a QC-242 (columna `description` opcional en
  `whatsapp_variable_keys` con su migración y `down.sql`, límite de largo, validador, vista
  `WhatsappDictionaryEntryView` y las dos acciones de escritura); hasta que exista, R58 oculta el campo
  y la columna en las propias (las constantes sí tienen descripción, del front). Si el humano la
  retira, R49, R50 y R58 pierden la descripción de las propias.
- **[P3] ¿Relacionar variables tiene efecto en Meta?** Hoy es solo local (QC-242 R74: no llama a
  Meta). **Default:** solo local; la relación decide qué dato se manda en cada `{{n}}` al enviar, y la
  plantilla en Meta no cambia. Ningún requisito de este spec llama a otra acción al relacionar.
  **Otra salida (con backend):** que relacionar edite en Meta los ejemplos de la plantilla, con un
  método nuevo del cliente de Graph, caso de uso y acción; editar una plantilla en Meta la vuelve a
  revisión y Meta limita las ediciones de las aprobadas **[POR CONFIRMAR con la documentación de
  Meta]**.
- **[P4] Tipo de la última sincronización («automática» / «manual»).** El tablero lo muestra, pero el
  backend solo devuelve la hora (`templatesSyncedAt`). **Default:** sin el tipo; tras una
  sincronización manual en la pantalla, el resumen de R8 ya dice que fue manual. **Con backend:**
  columna del tipo en `whatsapp_connections` (migración) y campo nuevo en la salida del listado.
- **[P5] Motivo de «No compatible».** La vista no dice por qué una plantilla no es relacionable
  (contenido vacío). **Default:** si el texto trae variables con nombre, «Usa variables con nombre. El
  sistema solo envía variables numeradas.»; en otro caso, «Usa elementos que el sistema no envía
  (imagen, video, documento, otro tipo de botón o código de verificación). El sistema solo envía
  plantillas de texto.». Los dos textos son propuesta del spec (el tablero solo trae el caso de la
  imagen). **Con backend:** un campo con el motivo en `WhatsappTemplateView`.
- **[P6] Duplicar lo que el alta no crea.** **Default:** la copia no lleva el encabezado ni los
  botones de la original, y el alta lo avisa con «La copia no lleva el encabezado ni los botones de la
  original.»; duplicar una «No compatible» abre el alta con nombre `_v2` e idioma, sin mensaje, y una
  categoría `AUTHENTICATION` deja la categoría en Utilidad. Sin cambio de backend.
- **[P7] Ejemplo de «Nombre de la empresa».** El tablero trae el marcador «[NOMBRE DE TU EMPRESA]» y la
  sesión no expone el nombre de la empresa. **Default:** la marca de vacío («—»). **Con backend
  (identity, no QC-242):** exponer el nombre de la empresa en el contexto de sesión o en una acción.
