# QT-296 — tipo-y-subtipo-de-empaque-backend · requirements.md

> **Zona** backend · **Complejidad** high · **depends_on** QC-158, QC-195, QC-131 ·
> **Rama** `feature/QT-296-tipo-y-subtipo-de-empaque-backend`
>
> **Alcance.** Cada línea del catálogo del proveedor guarda su tipo (materia prima, herramienta,
> empaque) y, si es empaque, su subtipo (envase, tapa, medidor, otro). La lectura del PDF los
> propone, y el alta y la edición manuales de la línea los admiten. Los productos de empaque del
> inventario ganan el mismo subtipo, también en la importación desde Excel. Solo el envase exige
> presentación, y el selector de envases del pedido muestra solo envases.
>
> **Lo que NO entra.** Toda la UI → **QT-297**. Descontar tapas y medidores al terminar el empaque
> → **QT-298** `consumo-de-tapas-y-medidores-al-empacar`. Reclasificar con IA las líneas de
> catálogo ya guardadas → no se hace.
>
> Sembrado por `/afinar-feature` el 2026-10-23. El bloque de Alcance y la tabla de «Decisiones
> cerradas» los fijó el humano ANTES del spec. `spec_author` los respeta, no los reabre y no los
> reescribe: su trabajo aquí es `## Requisitos (EARS)`.

## Requisitos (EARS)

> Escritos por `spec_author` en F1.2 (2026-10-23). «Empaque» es el tipo de producto `PACKAGING`.
> «Subtipo» es el de empaque: envase, tapa, medidor u otro. Actualizados el mismo día con las
> respuestas del humano a las preguntas abiertas (ahora en «Decisiones cerradas»). Enmienda F2.2
> (2026-10-24, review B1): R9 y R20 remiten a la nueva R43.

### Subtipo de empaque en el inventario

**R1.** El sistema DEBE guardar el subtipo de empaque como uno de un conjunto cerrado de cuatro
valores (envase, tapa, medidor, otro), y la base DEBE rechazar cualquier otro valor. Los valores
guardados DEBEN ser identificadores en inglés.

**R2.** Todo producto de tipo empaque DEBE tener subtipo, y la base DEBE rechazar un producto de
otro tipo que lo tenga.

**R3.** SI un producto tiene un subtipo distinto de envase, ENTONCES NO DEBE tener presentación, y
la base DEBE rechazar esa combinación.

**R4.** CUANDO se aplica la migración, todo producto de tipo empaque que ya exista (vivo o dado de
baja) DEBE quedar con subtipo envase y conservar su presentación, sus lotes y su existencia sin
cambios.

**R5.** CUANDO se da de alta a mano un empaque sin indicar subtipo, el sistema DEBE crearlo como
envase.

**R6.** CUANDO se da de alta a mano un empaque de subtipo envase sin presentación, el sistema DEBE
rechazarlo como entrada inválida (`invalid_input`) sin escribir nada.

**R7.** CUANDO se da de alta a mano un empaque de subtipo tapa, medidor u otro, el sistema DEBE
crearlo sin presentación, contado en la unidad de sistema de envases y con existencia entera. SI
la entrada trae presentación, ENTONCES el sistema DEBE rechazarla como `invalid_input` sin
escribir nada.

**R8.** SI la entrada del alta de un producto que no es empaque trae subtipo, ENTONCES el sistema
DEBE rechazarla como `invalid_input` sin escribir nada.

**R9.** CUANDO se da de alta un empaque con el nombre de un empaque vivo de la empresa que cuenta
como homónimo (R43):
- con otro subtipo, el sistema DEBE rechazarlo con `action_not_allowed` sin escribir nada;
- con el mismo subtipo (y, si es envase, la misma presentación), el sistema DEBE sumarle un lote
  al existente, como hoy.

**R43.** Al buscar un homónimo de empaque, en el alta manual (R9) y en la importación desde Excel
(R20), un envase legado (subtipo envase y sin presentación) NO DEBE contar como homónimo: se
ignora, como hacía QC-195. Tapa, medidor y otro SÍ cuentan aunque no tengan presentación. En
consecuencia:
- CUANDO existe solo un envase legado con un nombre y se da de alta, a mano o por Excel, un envase
  con ese nombre y una presentación, el sistema DEBE crear el envase nuevo;
- CUANDO coexisten el envase legado y un envase con presentación del mismo nombre, un lote nuevo
  de ese envase con la misma presentación, a mano o por Excel, DEBE sumarse al envase con
  presentación, sea cual sea el más antiguo.

**R10.** La edición de un producto NO DEBE cambiar su subtipo: una entrada de edición
que lo traiga DEBE rechazarse como `invalid_input`.

**R11.** El detalle y el listado de productos DEBEN devolver el subtipo de cada producto (vacío en
los que no son empaque).

**R12.** DONDE el listado de productos recibe un filtro por subtipo, el sistema DEBE devolver solo
los productos vivos de la empresa con alguno de esos subtipos.

### Selector de envases del pedido

**R13.** CUANDO el selector de envases del pedido pide los empaques cuya presentación tiene
contenido en las unidades del pedido, el sistema DEBE devolver solo empaques de subtipo envase.

**R14.** SI una línea de reparto del pedido (alta, edición, revisión de bloqueados o «Reparto y
unidad») apunta a un empaque que no es de subtipo envase, ENTONCES el sistema DEBE tratarlo como
un envase inexistente (`packaging_not_found`) y no escribir nada, igual que hoy con un envase
ajeno o dado de baja.

### Importación de inventario desde Excel

**R15.** La importación DEBE aceptar una columna opcional «Subtipo». Un archivo sin esa columna
DEBE importarse como hoy, con cada empaque como envase.

**R16.** CUANDO una fila de empaque trae «Subtipo» vacío, el sistema DEBE tratarla como envase.

**R17.** CUANDO una fila de empaque trae en «Subtipo» «Envase», «Tapa», «Medidor» u «Otro» (sin
distinguir mayúsculas, tildes ni espacios de los extremos), el sistema DEBE usar ese subtipo. SI
trae cualquier otro texto, ENTONCES la fila DEBE quedar en error con el motivo `subtype_invalid`
sobre la columna «Subtipo».

**R18.** SI una fila de empaque de subtipo tapa, medidor u otro trae «Presentación», ENTONCES el
sistema DEBE ignorar esa columna (la anota en las columnas ignoradas) y seguir con la fila. SI una
fila de envase no trae «Presentación», ENTONCES la fila DEBE quedar en error `value_required`,
como hoy.

**R19.** SI una fila que no es de empaque trae «Subtipo», ENTONCES el sistema DEBE ignorar esa
columna y seguir con la fila.

**R20.** SI una fila de empaque nombra un empaque vivo de la empresa que cuenta como homónimo
(R43), o uno que crea una fila anterior del mismo archivo, con otro subtipo, ENTONCES la fila DEBE quedar en error con el motivo
`subtype_mismatch`. Con el mismo subtipo, la fila DEBE sumar un lote, como hoy.

**R21.** La plantilla descargable DEBE incluir la columna «Subtipo». Las filas de ejemplo de una
plantilla descargada antes de esta ficha (sin esa columna y con «Envase» en «Tipo») DEBEN seguir
reconociéndose como ejemplo e ignorándose, igual que las de la plantilla nueva.

**R22.** CUANDO se confirma la importación, cada empaque creado DEBE quedar con el subtipo que
mostró su fila en la vista previa.

**R41.** La columna «Tipo» DEBE aceptar «Empaque» y «Envase» como el mismo tipo empaque,
comparados como los demás valores (sin distinguir mayúsculas, tildes ni espacios de los
extremos). Un archivo que ya existe con «Envase» DEBE importarse exactamente igual que antes de
esta ficha.

**R42.** La plantilla descargable DEBE escribir «Empaque» como tipo del empaque, tanto en su fila
de ejemplo como en la hoja de valores admitidos.

### Tipo y subtipo en la línea de catálogo del proveedor

**R23.** Una línea de catálogo DEBE poder guardar un tipo opcional entre materia prima,
herramienta y empaque, y la base DEBE rechazar cualquier otro valor, producto terminado incluido.

**R24.** Una línea de catálogo DEBE poder guardar un subtipo solo si su tipo es empaque, y la base
DEBE rechazar un subtipo en una línea de otro tipo o sin tipo. Una línea de empaque sin subtipo
DEBE admitirse.

**R25.** CUANDO se aplica la migración, las líneas de catálogo que ya existen DEBEN quedar sin tipo
ni subtipo y sin ningún otro cambio. La migración NO DEBE crear de nuevo `material` ni las
medidas, ni borrar físicamente ninguna fila.

**R26.** CUANDO se da de alta a mano una línea de catálogo, el tipo y el subtipo DEBEN ser
opcionales, y ausentes DEBEN dejar la línea sin tipo. SI la entrada trae un tipo o un subtipo
fuera de su lista, o un subtipo sin tipo empaque, ENTONCES el sistema DEBE rechazarla como
`invalid_input` sin escribir nada.

**R27.** CUANDO se edita a mano una línea de catálogo, el tipo y el subtipo viajan juntos:
- si la entrada no trae ninguno de los dos, el sistema DEBE conservar los guardados;
- si trae los dos, DEBE reemplazarlos (vacío quita), con las mismas reglas de validez que R26;
- SI trae solo uno de los dos, ENTONCES el sistema DEBE rechazarla como `invalid_input` sin
  escribir nada.

**R28.** El detalle y el listado de líneas de catálogo DEBEN devolver el tipo y el subtipo de cada
línea (vacíos si no los tiene).

### Lectura del catálogo desde PDF

**R29.** CUANDO se interpreta el texto que la IA dejó para un catálogo, el sistema DEBE leer de
cada línea su tipo y su subtipo. Un valor ausente, nulo o fuera de su lista DEBE quedar como «sin
tipo» o «sin subtipo» sin invalidar la línea ni el documento.

**R30.** SI la IA devuelve un subtipo para una línea cuyo tipo no es empaque o no se sabe,
ENTONCES el sistema DEBE descartar ese subtipo: no se deduce el tipo a partir de él.

**R31.** La vista previa de la importación DEBE devolver, por fila, el tipo, el subtipo y una
marca de revisión, que DEBE ser verdadera CUANDO la fila no tiene tipo o es de empaque sin
subtipo, y falsa en otro caso. La marca NO DEBE impedir confirmar la fila.

**R32.** La vista previa y la confirmación DEBEN aceptar tipo y subtipo opcionales en las filas
revisadas. SI una fila revisada trae un subtipo sin tipo empaque, ENTONCES DEBE clasificarse
«incompleta» con el subtipo como campo inválido.

**R33.** CUANDO se confirma la importación, cada línea nueva DEBE guardarse con el tipo y el
subtipo de su fila.

**R34.** CUANDO se confirma una fila que coincide con una línea viva, un tipo conocido DEBE
reemplazar el guardado y un tipo desconocido NO DEBE borrarlo. El subtipo DEBE seguir la misma
regla, y DEBE quedar vacío si el tipo resultante no es empaque.

**R35.** La clasificación DEBE marcar «cambia» una fila con línea viva CUANDO cambia el costo o
CUANDO la confirmación cambiaría su tipo o su subtipo, y «sin cambios» si no cambia nada de eso.
El resumen de la confirmación DEBE contar como actualizada una línea en la que solo cambió el tipo
o el subtipo.

**R36.** Ningún archivo versionado DEBE contener el texto del prompt de catálogo, ni completo ni en
fragmentos: se versiona solo el contrato JSON que el sistema acepta (`design.md > 6`).

**R37.** CUANDO el humano cambia `CATALOG_PROMPT` para pedir tipo y subtipo, el prompt DEBE pedirlos
con los valores del contrato, DEBE ordenar que gatillo, válvula y atomizador cuenten como tapa y
que etiqueta y caja cuenten como otro, y DEBE ordenar devolver `null` si no se sabe. La pasada
firmada en `docs/revision-de-prompts.md` DEBE llevar veredicto de tipo y de subtipo. Ese cambio
DEBE hacerse solo CUANDO QC-131 esté cerrada, y sobre el texto que QC-131 dejó firmado.

**R38.** El doble de IA de los E2E DEBE devolver, en el catálogo de guion, al menos una línea con
tipo empaque y subtipo envase y una sin tipo, y las E2E existentes del catálogo DEBEN seguir en
verde. Esta ficha NO DEBE añadir un E2E nuevo.

### Lo que no cambia

**R39.** Terminar el empaque de un pedido NO DEBE consumir ningún producto de subtipo tapa,
medidor u otro: el consumo de empaque sigue siendo solo el de los envases del reparto.

**R40.** Esta ficha NO DEBE añadir permisos: cada operación tocada DEBE seguir exigiendo el mismo
permiso y el mismo ámbito de empresa que hoy, y un empaque o una línea de otra empresa DEBE seguir
tratándose como inexistente.

### Cobertura de las decisiones cerradas

| Decisión (por su pregunta) | Requisitos |
|---|---|
| ¿Tapas y medidores son materia prima? | R2, R7 |
| Subtipos | R1, R17, R37 |
| ¿Quién exige presentación? | R3, R6, R7, R18 |
| Empaque que ya existe | R4, R5, R16 |
| Selector de envases del pedido | R13, R14 |
| Descontar tapas y medidores al empacar | R39 |
| La IA no sabe el tipo de una línea | R29, R30, R31 |
| Líneas de catálogo ya guardadas | R25, R27, R34 |
| Tipos admitidos en la línea de catálogo | R23, R26 |
| Excel de inventario (QC-209) | R15, R16, R17, R19, R20, R21, R22 |
| Orden con QC-131 | R37 |
| ¿Se puede cambiar el subtipo de un producto ya creado? | R10 |
| ¿Una línea de catálogo de empaque puede quedar sin subtipo? | R24, R31 |
| Etiqueta del tipo en el Excel | R21, R41, R42 |
| Envase legado sin presentación al buscar homónimos (B1) | R9, R20, R43 |
| Alta y edición manual de la línea de catálogo | R26, R27 |
| E2E | R38 |
| Conjunto cerrado del subtipo | R1 |
| Borrado e idioma de identificadores | R1, R25 |
| `material` y medidas | R25 |

## Preguntas abiertas

Ninguna.

## Decisiones cerradas (no reabrir)

| Fecha | Pregunta | Decisión |
|---|---|---|
| 2026-10-23 | ¿Tapas y medidores son materia prima? | No: son `PACKAGING` con un subtipo. |
| 2026-10-23 | Subtipos | Lista fija: envase, tapa, medidor, otro. Gatillo, válvula y atomizador cuentan como tapa; etiqueta y caja, como otro. Añadir uno es un cambio de código. |
| 2026-10-23 | ¿Quién exige presentación? | Solo el envase. Tapa, medidor y otro no la llevan. |
| 2026-10-23 | Empaque que ya existe | Todo pasa a envase: hoy todos tienen presentación y se usan en el reparto. |
| 2026-10-23 | Selector de envases del pedido (QC-195) | Muestra solo los de subtipo envase. |
| 2026-10-23 | Descontar tapas y medidores al empacar | Fuera: va a QT-298. |
| 2026-10-23 | La IA no sabe el tipo de una línea | La línea queda sin tipo y la revisión la marca. No se inventa. |
| 2026-10-23 | Líneas de catálogo ya guardadas | Quedan sin tipo hasta que se editan o se reimporta el PDF. |
| 2026-10-23 | Tipos admitidos en la línea de catálogo | Materia prima, herramienta y empaque. No producto terminado. |
| 2026-10-23 | Excel de inventario (QC-209) | Columna «Subtipo» opcional; si va vacía en un envase, cuenta como envase. |
| 2026-10-23 | Alta y edición manual de la línea de catálogo | Tipo y subtipo opcionales. |
| 2026-10-23 | E2E | No en esta ficha: no es un flujo crítico (no mueve inventario ni importes). El de la UI va en QT-297. |
| 2026-10-23 | Conjunto cerrado del subtipo | Enum de Postgres, como `ProductType` (migración `20260922150000_product_type_enum`). |
| 2026-10-23 | Borrado e idioma de identificadores | Heredado de QC-4: borrado lógico y nombres en inglés. |
| 2026-10-23 | `material` y medidas | Ya existen en la línea de catálogo (QC-158); no se re-crean. |
| 2026-10-23 | Orden con QC-131 | El cambio del prompt (task TP) se hace DESPUÉS de que QC-131 cierre, sobre el texto firmado. El resto de QT-296 sigue ya. |
| 2026-10-23 | ¿Se puede cambiar el subtipo de un producto ya creado? | No: queda fijo al crearlo, como la presentación del envase. |
| 2026-10-23 | ¿Una línea de catálogo de empaque puede quedar sin subtipo? | Sí, y la revisión la marca. |
| 2026-10-23 | Etiqueta del tipo en el Excel | «Empaque» se acepta ya como sinónimo de «Envase» en «Tipo», comparado como los demás valores. La plantilla escribe «Empaque». Los archivos y filas de ejemplo con «Envase» siguen importándose igual que hoy. |
| 2026-10-24 | Envase legado sin presentación al buscar homónimos (review B1) | Al buscar un empaque del mismo nombre, en el alta manual y en el Excel, un envase legado sin presentación (el que dejó así QC-195) no cuenta: se ignora. «Galón» con presentación 4 L se crea aunque exista un «Galón» legado sin presentación, y los lotes nuevos van al bueno, como hoy. |
