# QC-288 — entrega-sin-pedido · requirements.md

> **Zona:** fullstack · **Complejidad:** high · **depends_on:** — · **Rama:** `feature/QC-288-entrega-sin-pedido`
>
> **Alcance.** Desde la ficha de un producto terminado (QC-225) o el menú de acciones de su fila en el
> listado, el Administrador entrega envases de
> sus lotes a uno o varios clientes sin pedido de por medio. El tope es el excedente: lo disponible
> menos lo que esperan los pedidos TERMINADO de esa receta y presentación. La salida queda en el
> libro de movimientos como entrega, no como ajuste. Se ve en la tab Entregas de la ficha y desde
> ahí se anula, como en QC-224.
>
> **Lo que NO entra.**
> - Cerrar un pedido entregado a medias y liberar lo que le falta.
> - Cambiar la entrega desde pedido (QC-223 / QC-224 / QC-282).
> - Entregar varios productos terminados en una misma entrega.
>
> Sembrado por `/afinar-feature` el 2026-10-16. El bloque de Alcance y la tabla de «Decisiones
> cerradas» los fijó el humano ANTES del spec. `spec_author` los respeta, no los reabre y no los
> reescribe: su trabajo aquí es `## Requisitos (EARS)`.

## Requisitos (EARS)

**Leyenda.** `[D<n>]` es la fila n de `## Decisiones cerradas (no reabrir)`, contando desde arriba:
D1 origen · D2 varios clientes · D3 tope · D4 anular · D5 dónde se ve · D6 nota · D7 permiso ·
D8 cliente · D9 lote y conversión · D10 borrador e idempotencia · D11 solo inserción ·
D12 E2E · D13 dos entradas · D14 sin excedente · D15 pase `/design`. `[A]` marca una regla de
`docs/architecture.md` (aislamiento por empresa; operación que mueve existencias idempotente y
auditable).

**Términos.**
- **Entrega sin pedido**: entrega de envases de los lotes de UN producto terminado a uno o varios
  clientes, sin pedido de por medio.
- **Lote entregable** de un producto terminado: lote de ese producto, vivo y de la empresa, con
  contenido de envase guardado y al menos un envase entero disponible [D9].
- **Envases disponibles** de un lote, **clave de entrega** y **bloque**: como en QC-223 y QC-282.
- **Envases en stock** de un producto terminado: la suma de los envases disponibles de sus lotes con
  contenido de envase.
- **Envases que esperan los pedidos**: la suma, sobre los pedidos vivos de la empresa en `TERMINADO`
  de la misma receta, de los envases que le faltan a su línea de la misma presentación. «Faltan» es
  lo de QC-223 con «entregados» sin las líneas anuladas (QC-224).
- **Excedente**: envases en stock menos envases que esperan los pedidos, sin bajar de cero [D3].
- **Escritos**: la suma de los envases escritos en todos los bloques del sheet.
- **Parte de un cliente** en una entrega sin pedido: todas las líneas de ese cliente en esa entrega.
  Es la unidad que se anula [D4].

Siguen vigentes, sin cambios, los requisitos de QC-223, QC-224, QC-225 y QC-282 que esta ficha no
enmienda. La lista de enmiendas está en `design.md > 11`.

### Acceso

- **R1** [D7] La feature NO DEBE añadir, quitar ni reasignar permisos: el catálogo de permisos y los
  permisos sembrados de cada rol DEBEN quedar iguales.
- **R2** [D7] SI el actor no tiene `entregas.modificar`, ENTONCES el servidor DEBE responder
  `unauthorized` a la lectura del contenido del sheet, a la lectura del excedente y al registro de
  una entrega sin pedido, antes de validar la entrada y antes de leer o escribir nada.
- **R3** [D4, D7] SI el actor no tiene `entregas.anular`, ENTONCES el servidor DEBE responder
  `unauthorized` a la lectura de una entrega sin pedido para anularla y al registro de su
  anulación, antes de validar la entrada y antes de leer o escribir nada.
- **R4** [D7] El servidor DEBE decidir el acceso por el permiso y nunca por el rol: un actor con el
  permiso y un rol distinto de Administrador DEBE ser aceptado, y un Administrador sin el permiso en
  su conjunto DEBE ser rechazado, en las cinco operaciones de R2 y R3.

### Puntos de entrada

- **R5** [D13, D14] MIENTRAS el actor tenga `entregas.modificar` y el excedente del producto sea
  mayor que cero, la cabecera de la ficha de producto terminado DEBE mostrar «Entregar» en
  cualquiera de sus tabs. SI el excedente es cero, si no se pudo leer o si el actor no tiene el
  permiso, ENTONCES ese botón NO DEBE existir en el DOM.
- **R6** [D13, D14] MIENTRAS el actor tenga `entregas.modificar` y el excedente de un producto sea
  mayor que cero, el menú de acciones de la fila de ese producto en el listado de producto
  terminado DEBE ofrecer «Entregar». SI el excedente es cero, si no se pudo leer o si el actor no
  tiene el permiso, ENTONCES esa acción NO DEBE existir en el DOM de ese menú.
- **R7** [D13] CUANDO el usuario pulsa «Entregar» en la cabecera de la ficha o en el menú de la fila,
  la pantalla DEBE abrir el mismo sheet «Entregar sin pedido» de ese producto terminado.
- **R8** [D13] El listado de producto terminado DEBE obtener el excedente de todos los productos de
  la página con un número de lecturas que no depende del número de filas.
- **R9** [D3] El excedente DEBE contar solo los pedidos vivos de la empresa del actor en `TERMINADO`
  de la misma receta y la misma presentación del producto. Un pedido de otra receta, de otra
  presentación, en otro estado, borrado o de otra empresa NO DEBE contar, y los envases de las líneas
  de entrega anuladas DEBEN contar otra vez como pendientes. Un lote sin contenido de envase NO DEBE
  contar en los envases en stock.

### Sheet «Entregar sin pedido»

- **R10** [D15, D3] El sheet DEBE mostrar la tarjeta «Excedente» con los envases en stock, los
  envases que esperan los pedidos (en negativo) y «Se puede entregar» igual al excedente, y un
  desplegable «Ver los pedidos que esperan» que liste cada pedido al que le falten envases con su
  número y los envases que le faltan.
- **R11** [D15, D3] La tarjeta «Excedente» DEBE mostrar «Entregas N de M», con N los escritos y M el
  excedente, y una marca: «Sin envases» si N es cero, «Quedan K libres» si N no supera M (K = M − N)
  y «Sobran K» si N supera M (K = N − M).
- **R12** [D2, D15] CUANDO el sheet se abre sin borrador guardado, DEBE mostrar un solo bloque,
  titulado «Cliente 1», con el campo de cliente vacío, todos los campos de envases vacíos y la nota
  vacía.
- **R13** [D9] Cada bloque DEBE tener su campo de cliente y la lista de los lotes entregables del
  producto, cada uno con su código, sus disponibles (R16) y un campo de envases. La lista NO DEBE
  mostrar la fecha de vencimiento ni la de entrada del lote.
- **R14** [D2] CUANDO el usuario pulsa «Añadir cliente», el sheet DEBE añadir al final un bloque con
  el cliente vacío y sin envases, titulado «Cliente N» según su posición. MIENTRAS haya más de un
  bloque, cada bloque DEBE ofrecer «Quitar»; SI solo hay uno, ENTONCES «Quitar» NO DEBE existir en
  el DOM. CUANDO el usuario quita un bloque, el sheet DEBE quitarlo con sus envases y renumerar los
  títulos de los demás.
- **R15** [D8] El buscador de cliente de cada bloque DEBE ofrecer solo clientes vivos de la empresa
  del actor.
- **R16** [D3, D9] En cada bloque, los disponibles de un lote DEBEN ser sus envases disponibles menos
  los escritos en ese lote en todos los bloques, sin bajar de cero. CUANDO el usuario escribe en un
  campo de envases, el campo DEBE aceptar solo dígitos y SI el número supera los envases disponibles
  del lote menos lo escrito en ese lote por los demás bloques, ENTONCES DEBE quedarse en ese tope.
- **R17** [D3] MIENTRAS lo escrito en un lote supere sus envases disponibles, el sheet DEBE marcar ese
  lote con «Solo hay N» en todos los bloques, DEBE mostrar «Entre todos los clientes se pasa de lo
  disponible en un lote. Baja los envases para poder entregar.» y «Entregar» DEBE estar
  deshabilitado.
- **R18** [D3, D15] MIENTRAS los escritos superen el excedente, el sheet DEBE mostrar «Entre todos los
  clientes se pasa del excedente: solo se pueden entregar M envases sin tocar lo que esperan los
  pedidos.» (M, el excedente) y «Entregar» DEBE estar deshabilitado.
- **R19** [D2, D8] SI el usuario pulsa «Entregar» y un bloque no tiene cliente, tiene el mismo cliente
  que un bloque anterior o no lleva ningún envase, ENTONCES el sheet DEBE mostrar bajo el campo de
  cliente de ese bloque, respectivamente, «Elige el cliente.», «Este cliente ya está en la
  entrega.» o «Este cliente no lleva envases: indica al menos uno.», como mucho uno por bloque y en
  ese orden, y NO DEBE enviar la entrega.
- **R20** [D6] El sheet DEBE ofrecer un campo «Nota (opcional)» de texto libre. SI la nota, sin
  espacios al principio ni al final, supera los 500 caracteres, ENTONCES el sheet DEBE mostrar «La
  nota no puede pasar de 500 caracteres.» y NO DEBE enviar la entrega.
- **R21** [D14, D15] SI al abrir o al volver a leer el sheet el excedente es cero, ENTONCES el sheet
  DEBE mostrar «No hay envases libres para entregar sin pedido» con los envases en stock, NO DEBE
  mostrar bloques ni nota y «Entregar» DEBE estar deshabilitado.
- **R22** [D2, D6, D10] CUANDO el usuario pulsa «Entregar» y no aplica ninguno de R17 a R21, el sheet
  DEBE enviar una sola entrega con la clave de entrega del borrador, el producto, cada bloque con su
  cliente y sus envases mayores que cero por lote, y la nota sin espacios al principio ni al final,
  o sin nota si queda vacía.
- **R23** [D3, D2] El sistema DEBE calcular el excedente, la suma por lote, el tope sobre el
  excedente y las reglas de bloque (sin cliente, cliente repetido, sin envases) con las mismas
  funciones puras en el sheet y en el servidor.

### Después de enviar

- **R24** [D10] CUANDO el servidor aplica la entrega o responde que ya estaba registrada, el sheet
  DEBE borrar el borrador de ese producto, cerrarse, avisar con el toast «Entrega sin pedido
  registrada» y refrescar la pantalla desde la que se abrió.
- **R25** [D3] CUANDO el servidor rechaza la entrega con `delivery_exceeds_surplus` o
  `delivery_batch_insufficient`, el sheet DEBE seguir abierto, mostrar el mensaje del rechazo, volver
  a leer el excedente y los lotes y conservar el borrador, ajustado según R27.
- **R26** CUANDO el servidor rechaza la entrega con cualquier otro error, el sheet DEBE seguir abierto
  con el mensaje y conservar los bloques y la nota.

### Borrador

- **R27** [D10] MIENTRAS el sheet esté abierto, cada cambio de bloques, clientes, envases o nota DEBE
  guardarse en `localStorage` bajo una clave propia del producto, junto con la clave de entrega.
  CUANDO el usuario vuelve a abrir el sheet del mismo producto tras cerrarlo sin cancelar o tras
  recargar, el sheet DEBE restaurar los bloques en el mismo orden, con sus clientes, sus envases, la
  nota y la clave de entrega. CUANDO el usuario pulsa «Cancelar», el sheet DEBE borrar ese borrador y
  cerrarse.
- **R28** [D10, D15] CUANDO el sheet restaura un borrador, DEBE descartar de todos los bloques los
  envases de los lotes que ya no se ofrecen y mostrar «Algunos lotes del borrador ya no están
  disponibles y se quitaron sus envases.» solo en ese caso.

### Registro de la entrega sin pedido (servidor)

- **R29** SI la entrada no tiene la forma acordada, ENTONCES el servidor DEBE responder `invalid_input`
  sin escribir nada. Son casos de forma no acordada: ningún cliente; un cliente sin envases; el mismo
  cliente dos veces; el mismo lote repetido dentro de un cliente; envases no enteros o menores que
  uno; más asignaciones que el tope del contrato; una nota que, sin espacios al principio ni al
  final, supera los 500 caracteres; una clave sin forma de uuid; un campo de más o un campo ausente.
  Un identificador de producto sin forma de uuid DEBE responder `product_not_found` y uno de cliente
  sin forma de uuid, `customer_not_found`.
- **R30** [D1, A] SI el producto no existe, está dado de baja, no es un producto terminado o es de
  otra empresa, ENTONCES el servidor DEBE responder `product_not_found` sin escribir nada.
- **R31** [D8, A] SI algún cliente de la entrega no existe, está dado de baja o es de otra empresa,
  ENTONCES el servidor DEBE responder `customer_not_found` sin escribir nada.
- **R32** [D9, A] SI algún lote no es de ese producto, es de otra empresa o no tiene contenido de
  envase, ENTONCES el servidor DEBE responder `batch_not_found` sin escribir nada.
- **R33** [D3, A] SI la suma de los envases de todos los clientes supera el excedente, calculado con el
  producto bloqueado, ENTONCES el servidor DEBE responder `delivery_exceeds_surplus` sin escribir
  nada.
- **R34** [D3, D9, A] SI la suma de los envases de todos los clientes para un lote supera sus envases
  disponibles, leídos con el producto bloqueado, ENTONCES el servidor DEBE responder
  `delivery_batch_insufficient` sin escribir nada. En ningún caso la existencia de un lote DEBE quedar
  negativa.
- **R35** [D3, A] CUANDO dos entregas sin pedido del mismo producto se confirman a la vez y juntas
  superan el excedente, el servidor DEBE aplicar exactamente una y responder
  `delivery_exceeds_surplus` a la otra. CUANDO una entrega sin pedido y una entrega, una anulación o
  un ajuste del mismo producto se confirman a la vez, el servidor DEBE aplicarlas una detrás de otra,
  y la entrega sin pedido NO DEBE dejar los envases en stock por debajo de los que esperan los
  pedidos en el instante en que se aplica.
- **R36** [D1, D2, D6, D9, A] CUANDO el servidor aplica una entrega sin pedido, DEBE guardar una sola
  entrega con el producto, la clave, la nota (o sin nota), el autor y el instante y, por cada cliente
  y lote, una línea con el cliente, el lote, los envases y la cantidad, igual a envases por el
  contenido de envase del lote. NO DEBE guardar ni cambiar ningún pedido.
- **R37** [D5, D9, A] CUANDO el servidor aplica una entrega sin pedido, DEBE descontar de cada lote la
  suma de los envases de todos los clientes por su contenido de envase, DEBE escribir en la misma
  transacción un solo asiento de tipo «entrega sin pedido» por lote, con la suma en negativo de las
  cantidades de sus líneas, la entrega, el autor y el instante, sin pedido y sin motivo, y DEBE
  recalcular la existencia del producto como la suma de sus lotes.
- **R38** [D10, A] CUANDO llega una entrega sin pedido cuya clave ya está registrada en la empresa
  para una entrega sin pedido, el servidor NO DEBE escribir nada y DEBE responder que ya estaba
  registrada. SI la clave ya es de una entrega de pedido, ENTONCES el servidor DEBE responder
  `invalid_input` sin escribir nada; y SI una entrega de pedido llega con la clave de una entrega sin
  pedido, ENTONCES DEBE responder `invalid_input` sin escribir nada.
- **R39** [A] SI falla cualquier paso de una entrega sin pedido, incluido uno posterior al primer
  cliente o al primer lote, ENTONCES NO DEBE quedar escrito nada de ella: ni entrega, ni línea, ni
  asiento, ni cambio de existencia.
- **R40** [D5, D11, A] La base DEBE rechazar cada uno de estos casos:
  - una entrega sin pedido y sin producto, o con pedido y con producto;
  - una nota en una entrega de pedido, o una nota vacía o de más de 500 caracteres;
  - una línea de una entrega sin pedido que lleva línea del reparto o cuyo lote es de otro producto,
    y una línea de una entrega de pedido sin línea del reparto;
  - un asiento de entrega sin pedido con pedido, sin entrega, con motivo o con cantidad no negativa,
    o que apunta a una entrega de pedido; un asiento de entrega que apunta a una entrega sin pedido;
  - un asiento de anulación de entrega sin pedido con pedido, sin anulación, con motivo o con
    cantidad no positiva, o que apunta a la anulación de una entrega de pedido;
  - una entrega sin pedido cuyo producto sea de otra empresa.

  Los casos de QC-223 R31 y QC-224 R32 DEBEN seguir rechazándose.
- **R41** [D11] El sistema NO DEBE ofrecer ningún camino de aplicación que modifique o borre una
  entrega sin pedido, sus líneas, su anulación o sus asientos. Las tablas, columnas y valores de
  enumerado nuevos DEBEN tener nombres en inglés.
- **R42** [D11] CUANDO se aplica la migración, las entregas, líneas, anulaciones, asientos y
  existencias que ya existen NO DEBEN cambiar. CUANDO se revierte, SI existe alguna entrega sin pedido
  o algún asiento de entrega sin pedido o de su anulación, ENTONCES la reversión DEBE abortar sin
  cambiar nada; si no, DEBE dejar el esquema como estaba.

### Anulación (ficha, tab Entregas)

- **R43** [D4, D5] MIENTRAS el actor tenga `entregas.anular`, cada fila del tab Entregas de una
  entrega sin pedido no anulada DEBE ofrecer «Anular». Las filas de entregas de pedido NO DEBEN
  ofrecer ningún control de anular. SI el actor no tiene el permiso, ENTONCES «Anular» NO DEBE existir
  en el DOM.
- **R44** [D4, D15] CUANDO el usuario pulsa «Anular» en una fila, el diálogo «Anular la entrega sin
  pedido» DEBE mostrar la fecha de la entrega y la presentación, y listar los clientes de esa entrega
  cuya parte no está anulada, cada uno con sus envases y todos sin marcar. NO DEBE listar un cliente
  con su parte ya anulada ni ningún campo de cantidad.
- **R45** [D4] SI el usuario confirma sin ningún cliente marcado, ENTONCES el diálogo DEBE mostrar «No
  hay nada que anular: marca al menos un cliente.» y NO DEBE enviar la anulación. QC-224 R13 (motivo
  obligatorio y de hasta 500 caracteres) y R14 (clave de anulación por apertura) DEBEN aplicarse a
  este diálogo.
- **R46** [D4] CUANDO el usuario confirma con al menos un cliente marcado y un motivo válido, el
  diálogo DEBE enviar la entrega, la clave de anulación, el motivo y los clientes marcados. CUANDO el
  servidor la aplica o responde que ya estaba registrada, el diálogo DEBE cerrarse, avisar con el
  toast «Entrega anulada» y refrescar la ficha. CUANDO la rechaza con `delivery_already_voided`, DEBE
  mostrar el mensaje y volver a leer la entrega; con cualquier otro error, DEBE seguir abierto con lo
  marcado y el motivo.

### Registro de la anulación (servidor)

- **R47** [D4] SI la anulación no tiene la forma acordada (identificador o clave sin forma de uuid,
  ningún cliente, un cliente repetido o sin forma de uuid, un motivo que tras recortar queda vacío o
  supera los 500 caracteres, un campo de más o uno ausente) o trae un cliente sin líneas en esa
  entrega, ENTONCES el servidor DEBE responder `invalid_input` sin escribir nada.
- **R48** [D4, A] SI la entrega no existe, es de otra empresa o es una entrega de pedido, ENTONCES la
  anulación de entrega sin pedido DEBE responder `delivery_not_found` sin escribir nada. SI se pide la
  anulación de pedido de QC-224 sobre una entrega sin pedido, ENTONCES DEBE responder
  `delivery_not_found` sin escribir nada.
- **R49** [D4] SI la parte de algún cliente pedido ya está anulada, ENTONCES el servidor DEBE responder
  `delivery_already_voided` y NO DEBE anular la de ningún otro cliente pedido.
- **R50** [D4, D11, A] CUANDO el servidor aplica una anulación de entrega sin pedido, DEBE guardarla
  con la entrega, el motivo sin espacios al principio ni al final, el autor y el instante; DEBE anular
  todas las líneas de los clientes pedidos y ninguna otra; DEBE devolver a cada lote la suma de las
  cantidades de sus líneas anuladas, aunque el producto esté dado de baja; DEBE escribir en la misma
  transacción un solo asiento de tipo «anulación de entrega sin pedido» por lote, con esa suma en
  positivo, la anulación, el autor y el instante, sin pedido y sin motivo; y DEBE recalcular la
  existencia del producto. La entrega, sus líneas y sus asientos DEBEN quedar sin cambios.
- **R51** [D4, A] CUANDO llega una anulación cuya clave ya está registrada en la empresa, el servidor NO
  DEBE escribir nada y DEBE responder que ya estaba registrada. CUANDO dos anulaciones que comparten
  un cliente de la misma entrega se confirman a la vez, el servidor DEBE aplicar exactamente una y
  responder `delivery_already_voided` a la otra. SI falla cualquier paso, ENTONCES NO DEBE quedar
  escrito nada de la anulación.

### Tab Entregas, historial del lote y movimientos

- **R52** [D5, D6, D15] El tab Entregas de la ficha DEBE listar las líneas de las entregas sin pedido
  del producto mezcladas con las de pedido, con el mismo orden, paginación y columnas de QC-282 R43 y
  R44. En la columna Pedido, una fila de entrega sin pedido DEBE mostrar la marca «Sin pedido» y,
  debajo, su nota si la tiene.
- **R53** [D5] El total entregado del tab Entregas DEBE incluir las líneas no anuladas de las entregas
  sin pedido. Leer el tab, sus marcas y su nota NO DEBE exigir ningún permiso además de
  `inventario.consultar`.
- **R54** [D5, D15] CUANDO el usuario abre el historial de un lote, el sistema DEBE mostrar cada asiento
  de entrega sin pedido con el tipo «Entrega sin pedido», su cantidad en negativo y, en lugar del
  número de pedido, el cliente; y cada asiento de su anulación con el tipo «Anulación de entrega sin
  pedido», su cantidad en positivo y el cliente.
- **R55** [D5] Los tabs Salidas y Entradas de la ficha DEBEN mostrar esos asientos con el origen
  «Entrega sin pedido» y «Anulación de entrega sin pedido», sin número de pedido. Cada fila de
  Entregas de una entrega sin pedido DEBE tener su asiento en Salidas.

### Verificación y dependencias

- **R56** [D12] El sistema DEBE tener un E2E que, contra el navegador y Postgres reales, cubra:
  - en la ficha de un producto con excedente, una entrega sin pedido a dos clientes que comparten un
    lote, con nota, comprobando en Postgres una sola entrega sin pedido con su producto y su nota,
    sus líneas por cliente, un asiento de entrega sin pedido por lote con la suma, la existencia de
    cada lote y que ningún pedido cambió;
  - que escribir más que el excedente deshabilita «Entregar»;
  - que un producto sin excedente no tiene «Entregar» ni en la cabecera de su ficha ni en el menú de
    su fila del listado;
  - que el tab Entregas muestra las filas con «Sin pedido» y la nota; la anulación de la parte de uno
    de los clientes, comprobando en Postgres que el lote recupera solo lo anulado y que el otro
    cliente conserva la suya;
  - que el historial del lote muestra «Entrega sin pedido».
- **R57** [D12] La feature NO DEBE añadir ninguna dependencia a `package.json`.

### Cobertura de las decisiones cerradas

| Decisión | Requisitos |
|---|---|
| D1 desde la ficha, un producto con sus lotes | R7, R13, R30, R36 |
| D2 varios clientes en bloques | R12, R14, R19, R22, R23, R36 |
| D3 tope en el excedente; por lote, envases disponibles | R9, R10, R11, R16, R17, R18, R23, R25, R33, R34, R35 |
| D4 anular como QC-224, por cliente | R3, R43, R44, R45, R46, R47, R48, R49, R50, R51 |
| D5 tab Entregas «Sin pedido», «Anular» en la fila; historial | R37, R40, R43, R52, R53, R54, R55 |
| D6 nota opcional visible en Entregas | R20, R22, R36, R52 |
| D7 permisos `entregas.modificar` / `entregas.anular` | R1, R2, R3, R4, R5, R6 |
| D8 cliente obligatorio y vivo de la empresa | R15, R19, R31 |
| D9 lote entregable, conversión con el contenido del lote | R13, R16, R32, R34, R36, R37 |
| D10 borrador en `localStorage`, `deliveryKey` | R22, R24, R27, R28, R38 |
| D11 solo inserción, nombres en inglés, sin borrado | R40, R41, R42, R50 |
| D12 E2E y sin dependencias | R56, R57 |
| D13 dos entradas al mismo sheet | R5, R6, R7, R8 |
| D14 sin excedente, nada en el DOM | R5, R6, R21 |
| D15 pase `/design` aprobado | R10, R11, R12, R18, R21, R28, R44, R52, R54 (la UI sigue los tableros; `design.md > Lo que ya existe`) |

## Preguntas abiertas

Ninguna. P1–P4 cerradas por el humano en F1.4 (ver tabla).

## Decisiones cerradas (no reabrir)`, contando desde arriba:
D1 origen · D2 varios clientes · D3 tope · D4 anular · D5 dónde se ve · D6 nota · D7 permiso ·
D8 cliente · D9 lote y conversión · D10 borrador e idempotencia · D11 solo inserción ·
D12 E2E · D13 dos entradas · D14 sin excedente · D15 pase `/design`. `[A]` marca una regla de
`docs/architecture.md` (aislamiento por empresa; operación que mueve existencias idempotente y
auditable).

**Términos.**
- **Entrega sin pedido**: entrega de envases de los lotes de UN producto terminado a uno o varios
  clientes, sin pedido de por medio.
- **Lote entregable** de un producto terminado: lote de ese producto, vivo y de la empresa, con
  contenido de envase guardado y al menos un envase entero disponible [D9].
- **Envases disponibles** de un lote, **clave de entrega** y **bloque**: como en QC-223 y QC-282.
- **Envases en stock** de un producto terminado: la suma de los envases disponibles de sus lotes con
  contenido de envase.
- **Envases que esperan los pedidos**: la suma, sobre los pedidos vivos de la empresa en `TERMINADO`
  de la misma receta, de los envases que le faltan a su línea de la misma presentación. «Faltan» es
  lo de QC-223 con «entregados» sin las líneas anuladas (QC-224).
- **Excedente**: envases en stock menos envases que esperan los pedidos, sin bajar de cero [D3].
- **Escritos**: la suma de los envases escritos en todos los bloques del sheet.
- **Parte de un cliente** en una entrega sin pedido: todas las líneas de ese cliente en esa entrega.
  Es la unidad que se anula [D4].

Siguen vigentes, sin cambios, los requisitos de QC-223, QC-224, QC-225 y QC-282 que esta ficha no
enmienda. La lista de enmiendas está en `design.md > 11`.

### Acceso

- **R1** [D7] La feature NO DEBE añadir, quitar ni reasignar permisos: el catálogo de permisos y los
  permisos sembrados de cada rol DEBEN quedar iguales.
- **R2** [D7] SI el actor no tiene `entregas.modificar`, ENTONCES el servidor DEBE responder
  `unauthorized` a la lectura del contenido del sheet, a la lectura del excedente y al registro de
  una entrega sin pedido, antes de validar la entrada y antes de leer o escribir nada.
- **R3** [D4, D7] SI el actor no tiene `entregas.anular`, ENTONCES el servidor DEBE responder
  `unauthorized` a la lectura de una entrega sin pedido para anularla y al registro de su
  anulación, antes de validar la entrada y antes de leer o escribir nada.
- **R4** [D7] El servidor DEBE decidir el acceso por el permiso y nunca por el rol: un actor con el
  permiso y un rol distinto de Administrador DEBE ser aceptado, y un Administrador sin el permiso en
  su conjunto DEBE ser rechazado, en las cinco operaciones de R2 y R3.

### Puntos de entrada

- **R5** [D13, D14] MIENTRAS el actor tenga `entregas.modificar` y el excedente del producto sea
  mayor que cero, la cabecera de la ficha de producto terminado DEBE mostrar «Entregar» en
  cualquiera de sus tabs. SI el excedente es cero, si no se pudo leer o si el actor no tiene el
  permiso, ENTONCES ese botón NO DEBE existir en el DOM.
- **R6** [D13, D14] MIENTRAS el actor tenga `entregas.modificar` y el excedente de un producto sea
  mayor que cero, el menú de acciones de la fila de ese producto en el listado de producto
  terminado DEBE ofrecer «Entregar». SI el excedente es cero, si no se pudo leer o si el actor no
  tiene el permiso, ENTONCES esa acción NO DEBE existir en el DOM de ese menú.
- **R7** [D13] CUANDO el usuario pulsa «Entregar» en la cabecera de la ficha o en el menú de la fila,
  la pantalla DEBE abrir el mismo sheet «Entregar sin pedido» de ese producto terminado.
- **R8** [D13] El listado de producto terminado DEBE obtener el excedente de todos los productos de
  la página con un número de lecturas que no depende del número de filas.
- **R9** [D3] El excedente DEBE contar solo los pedidos vivos de la empresa del actor en `TERMINADO`
  de la misma receta y la misma presentación del producto. Un pedido de otra receta, de otra
  presentación, en otro estado, borrado o de otra empresa NO DEBE contar, y los envases de las líneas
  de entrega anuladas DEBEN contar otra vez como pendientes. Un lote sin contenido de envase NO DEBE
  contar en los envases en stock.

### Sheet «Entregar sin pedido»

- **R10** [D15, D3] El sheet DEBE mostrar la tarjeta «Excedente» con los envases en stock, los
  envases que esperan los pedidos (en negativo) y «Se puede entregar» igual al excedente, y un
  desplegable «Ver los pedidos que esperan» que liste cada pedido al que le falten envases con su
  número y los envases que le faltan.
- **R11** [D15, D3] La tarjeta «Excedente» DEBE mostrar «Entregas N de M», con N los escritos y M el
  excedente, y una marca: «Sin envases» si N es cero, «Quedan K libres» si N no supera M (K = M − N)
  y «Sobran K» si N supera M (K = N − M).
- **R12** [D2, D15] CUANDO el sheet se abre sin borrador guardado, DEBE mostrar un solo bloque,
  titulado «Cliente 1», con el campo de cliente vacío, todos los campos de envases vacíos y la nota
  vacía.
- **R13** [D9] Cada bloque DEBE tener su campo de cliente y la lista de los lotes entregables del
  producto, cada uno con su código, sus disponibles (R16) y un campo de envases. La lista NO DEBE
  mostrar la fecha de vencimiento ni la de entrada del lote.
- **R14** [D2] CUANDO el usuario pulsa «Añadir cliente», el sheet DEBE añadir al final un bloque con
  el cliente vacío y sin envases, titulado «Cliente N» según su posición. MIENTRAS haya más de un
  bloque, cada bloque DEBE ofrecer «Quitar»; SI solo hay uno, ENTONCES «Quitar» NO DEBE existir en
  el DOM. CUANDO el usuario quita un bloque, el sheet DEBE quitarlo con sus envases y renumerar los
  títulos de los demás.
- **R15** [D8] El buscador de cliente de cada bloque DEBE ofrecer solo clientes vivos de la empresa
  del actor.
- **R16** [D3, D9] En cada bloque, los disponibles de un lote DEBEN ser sus envases disponibles menos
  los escritos en ese lote en todos los bloques, sin bajar de cero. CUANDO el usuario escribe en un
  campo de envases, el campo DEBE aceptar solo dígitos y SI el número supera los envases disponibles
  del lote menos lo escrito en ese lote por los demás bloques, ENTONCES DEBE quedarse en ese tope.
- **R17** [D3] MIENTRAS lo escrito en un lote supere sus envases disponibles, el sheet DEBE marcar ese
  lote con «Solo hay N» en todos los bloques, DEBE mostrar «Entre todos los clientes se pasa de lo
  disponible en un lote. Baja los envases para poder entregar.» y «Entregar» DEBE estar
  deshabilitado.
- **R18** [D3, D15] MIENTRAS los escritos superen el excedente, el sheet DEBE mostrar «Entre todos los
  clientes se pasa del excedente: solo se pueden entregar M envases sin tocar lo que esperan los
  pedidos.» (M, el excedente) y «Entregar» DEBE estar deshabilitado.
- **R19** [D2, D8] SI el usuario pulsa «Entregar» y un bloque no tiene cliente, tiene el mismo cliente
  que un bloque anterior o no lleva ningún envase, ENTONCES el sheet DEBE mostrar bajo el campo de
  cliente de ese bloque, respectivamente, «Elige el cliente.», «Este cliente ya está en la
  entrega.» o «Este cliente no lleva envases: indica al menos uno.», como mucho uno por bloque y en
  ese orden, y NO DEBE enviar la entrega.
- **R20** [D6] El sheet DEBE ofrecer un campo «Nota (opcional)» de texto libre. SI la nota, sin
  espacios al principio ni al final, supera los 500 caracteres, ENTONCES el sheet DEBE mostrar «La
  nota no puede pasar de 500 caracteres.» y NO DEBE enviar la entrega.
- **R21** [D14, D15] SI al abrir o al volver a leer el sheet el excedente es cero, ENTONCES el sheet
  DEBE mostrar «No hay envases libres para entregar sin pedido» con los envases en stock, NO DEBE
  mostrar bloques ni nota y «Entregar» DEBE estar deshabilitado.
- **R22** [D2, D6, D10] CUANDO el usuario pulsa «Entregar» y no aplica ninguno de R17 a R21, el sheet
  DEBE enviar una sola entrega con la clave de entrega del borrador, el producto, cada bloque con su
  cliente y sus envases mayores que cero por lote, y la nota sin espacios al principio ni al final,
  o sin nota si queda vacía.
- **R23** [D3, D2] El sistema DEBE calcular el excedente, la suma por lote, el tope sobre el
  excedente y las reglas de bloque (sin cliente, cliente repetido, sin envases) con las mismas
  funciones puras en el sheet y en el servidor.

### Después de enviar

- **R24** [D10] CUANDO el servidor aplica la entrega o responde que ya estaba registrada, el sheet
  DEBE borrar el borrador de ese producto, cerrarse, avisar con el toast «Entrega sin pedido
  registrada» y refrescar la pantalla desde la que se abrió.
- **R25** [D3] CUANDO el servidor rechaza la entrega con `delivery_exceeds_surplus` o
  `delivery_batch_insufficient`, el sheet DEBE seguir abierto, mostrar el mensaje del rechazo, volver
  a leer el excedente y los lotes y conservar el borrador, ajustado según R27.
- **R26** CUANDO el servidor rechaza la entrega con cualquier otro error, el sheet DEBE seguir abierto
  con el mensaje y conservar los bloques y la nota.

### Borrador

- **R27** [D10] MIENTRAS el sheet esté abierto, cada cambio de bloques, clientes, envases o nota DEBE
  guardarse en `localStorage` bajo una clave propia del producto, junto con la clave de entrega.
  CUANDO el usuario vuelve a abrir el sheet del mismo producto tras cerrarlo sin cancelar o tras
  recargar, el sheet DEBE restaurar los bloques en el mismo orden, con sus clientes, sus envases, la
  nota y la clave de entrega. CUANDO el usuario pulsa «Cancelar», el sheet DEBE borrar ese borrador y
  cerrarse.
- **R28** [D10, D15] CUANDO el sheet restaura un borrador, DEBE descartar de todos los bloques los
  envases de los lotes que ya no se ofrecen y mostrar «Algunos lotes del borrador ya no están
  disponibles y se quitaron sus envases.» solo en ese caso.

### Registro de la entrega sin pedido (servidor)

- **R29** SI la entrada no tiene la forma acordada, ENTONCES el servidor DEBE responder `invalid_input`
  sin escribir nada. Son casos de forma no acordada: ningún cliente; un cliente sin envases; el mismo
  cliente dos veces; el mismo lote repetido dentro de un cliente; envases no enteros o menores que
  uno; más asignaciones que el tope del contrato; una nota que, sin espacios al principio ni al
  final, supera los 500 caracteres; una clave sin forma de uuid; un campo de más o un campo ausente.
  Un identificador de producto sin forma de uuid DEBE responder `product_not_found` y uno de cliente
  sin forma de uuid, `customer_not_found`.
- **R30** [D1, A] SI el producto no existe, está dado de baja, no es un producto terminado o es de
  otra empresa, ENTONCES el servidor DEBE responder `product_not_found` sin escribir nada.
- **R31** [D8, A] SI algún cliente de la entrega no existe, está dado de baja o es de otra empresa,
  ENTONCES el servidor DEBE responder `customer_not_found` sin escribir nada.
- **R32** [D9, A] SI algún lote no es de ese producto, es de otra empresa o no tiene contenido de
  envase, ENTONCES el servidor DEBE responder `batch_not_found` sin escribir nada.
- **R33** [D3, A] SI la suma de los envases de todos los clientes supera el excedente, calculado con el
  producto bloqueado, ENTONCES el servidor DEBE responder `delivery_exceeds_surplus` sin escribir
  nada.
- **R34** [D3, D9, A] SI la suma de los envases de todos los clientes para un lote supera sus envases
  disponibles, leídos con el producto bloqueado, ENTONCES el servidor DEBE responder
  `delivery_batch_insufficient` sin escribir nada. En ningún caso la existencia de un lote DEBE quedar
  negativa.
- **R35** [D3, A] CUANDO dos entregas sin pedido del mismo producto se confirman a la vez y juntas
  superan el excedente, el servidor DEBE aplicar exactamente una y responder
  `delivery_exceeds_surplus` a la otra. CUANDO una entrega sin pedido y una entrega, una anulación o
  un ajuste del mismo producto se confirman a la vez, el servidor DEBE aplicarlas una detrás de otra,
  y la entrega sin pedido NO DEBE dejar los envases en stock por debajo de los que esperan los
  pedidos en el instante en que se aplica.
- **R36** [D1, D2, D6, D9, A] CUANDO el servidor aplica una entrega sin pedido, DEBE guardar una sola
  entrega con el producto, la clave, la nota (o sin nota), el autor y el instante y, por cada cliente
  y lote, una línea con el cliente, el lote, los envases y la cantidad, igual a envases por el
  contenido de envase del lote. NO DEBE guardar ni cambiar ningún pedido.
- **R37** [D5, D9, A] CUANDO el servidor aplica una entrega sin pedido, DEBE descontar de cada lote la
  suma de los envases de todos los clientes por su contenido de envase, DEBE escribir en la misma
  transacción un solo asiento de tipo «entrega sin pedido» por lote, con la suma en negativo de las
  cantidades de sus líneas, la entrega, el autor y el instante, sin pedido y sin motivo, y DEBE
  recalcular la existencia del producto como la suma de sus lotes.
- **R38** [D10, A] CUANDO llega una entrega sin pedido cuya clave ya está registrada en la empresa
  para una entrega sin pedido, el servidor NO DEBE escribir nada y DEBE responder que ya estaba
  registrada. SI la clave ya es de una entrega de pedido, ENTONCES el servidor DEBE responder
  `invalid_input` sin escribir nada; y SI una entrega de pedido llega con la clave de una entrega sin
  pedido, ENTONCES DEBE responder `invalid_input` sin escribir nada.
- **R39** [A] SI falla cualquier paso de una entrega sin pedido, incluido uno posterior al primer
  cliente o al primer lote, ENTONCES NO DEBE quedar escrito nada de ella: ni entrega, ni línea, ni
  asiento, ni cambio de existencia.
- **R40** [D5, D11, A] La base DEBE rechazar cada uno de estos casos:
  - una entrega sin pedido y sin producto, o con pedido y con producto;
  - una nota en una entrega de pedido, o una nota vacía o de más de 500 caracteres;
  - una línea de una entrega sin pedido que lleva línea del reparto o cuyo lote es de otro producto,
    y una línea de una entrega de pedido sin línea del reparto;
  - un asiento de entrega sin pedido con pedido, sin entrega, con motivo o con cantidad no negativa,
    o que apunta a una entrega de pedido; un asiento de entrega que apunta a una entrega sin pedido;
  - un asiento de anulación de entrega sin pedido con pedido, sin anulación, con motivo o con
    cantidad no positiva, o que apunta a la anulación de una entrega de pedido;
  - una entrega sin pedido cuyo producto sea de otra empresa.

  Los casos de QC-223 R31 y QC-224 R32 DEBEN seguir rechazándose.
- **R41** [D11] El sistema NO DEBE ofrecer ningún camino de aplicación que modifique o borre una
  entrega sin pedido, sus líneas, su anulación o sus asientos. Las tablas, columnas y valores de
  enumerado nuevos DEBEN tener nombres en inglés.
- **R42** [D11] CUANDO se aplica la migración, las entregas, líneas, anulaciones, asientos y
  existencias que ya existen NO DEBEN cambiar. CUANDO se revierte, SI existe alguna entrega sin pedido
  o algún asiento de entrega sin pedido o de su anulación, ENTONCES la reversión DEBE abortar sin
  cambiar nada; si no, DEBE dejar el esquema como estaba.

### Anulación (ficha, tab Entregas)

- **R43** [D4, D5] MIENTRAS el actor tenga `entregas.anular`, cada fila del tab Entregas de una
  entrega sin pedido no anulada DEBE ofrecer «Anular». Las filas de entregas de pedido NO DEBEN
  ofrecer ningún control de anular. SI el actor no tiene el permiso, ENTONCES «Anular» NO DEBE existir
  en el DOM.
- **R44** [D4, D15] CUANDO el usuario pulsa «Anular» en una fila, el diálogo «Anular la entrega sin
  pedido» DEBE mostrar la fecha de la entrega y la presentación, y listar los clientes de esa entrega
  cuya parte no está anulada, cada uno con sus envases y todos sin marcar. NO DEBE listar un cliente
  con su parte ya anulada ni ningún campo de cantidad.
- **R45** [D4] SI el usuario confirma sin ningún cliente marcado, ENTONCES el diálogo DEBE mostrar «No
  hay nada que anular: marca al menos un cliente.» y NO DEBE enviar la anulación. QC-224 R13 (motivo
  obligatorio y de hasta 500 caracteres) y R14 (clave de anulación por apertura) DEBEN aplicarse a
  este diálogo.
- **R46** [D4] CUANDO el usuario confirma con al menos un cliente marcado y un motivo válido, el
  diálogo DEBE enviar la entrega, la clave de anulación, el motivo y los clientes marcados. CUANDO el
  servidor la aplica o responde que ya estaba registrada, el diálogo DEBE cerrarse, avisar con el
  toast «Entrega anulada» y refrescar la ficha. CUANDO la rechaza con `delivery_already_voided`, DEBE
  mostrar el mensaje y volver a leer la entrega; con cualquier otro error, DEBE seguir abierto con lo
  marcado y el motivo.

### Registro de la anulación (servidor)

- **R47** [D4] SI la anulación no tiene la forma acordada (identificador o clave sin forma de uuid,
  ningún cliente, un cliente repetido o sin forma de uuid, un motivo que tras recortar queda vacío o
  supera los 500 caracteres, un campo de más o uno ausente) o trae un cliente sin líneas en esa
  entrega, ENTONCES el servidor DEBE responder `invalid_input` sin escribir nada.
- **R48** [D4, A] SI la entrega no existe, es de otra empresa o es una entrega de pedido, ENTONCES la
  anulación de entrega sin pedido DEBE responder `delivery_not_found` sin escribir nada. SI se pide la
  anulación de pedido de QC-224 sobre una entrega sin pedido, ENTONCES DEBE responder
  `delivery_not_found` sin escribir nada.
- **R49** [D4] SI la parte de algún cliente pedido ya está anulada, ENTONCES el servidor DEBE responder
  `delivery_already_voided` y NO DEBE anular la de ningún otro cliente pedido.
- **R50** [D4, D11, A] CUANDO el servidor aplica una anulación de entrega sin pedido, DEBE guardarla
  con la entrega, el motivo sin espacios al principio ni al final, el autor y el instante; DEBE anular
  todas las líneas de los clientes pedidos y ninguna otra; DEBE devolver a cada lote la suma de las
  cantidades de sus líneas anuladas, aunque el producto esté dado de baja; DEBE escribir en la misma
  transacción un solo asiento de tipo «anulación de entrega sin pedido» por lote, con esa suma en
  positivo, la anulación, el autor y el instante, sin pedido y sin motivo; y DEBE recalcular la
  existencia del producto. La entrega, sus líneas y sus asientos DEBEN quedar sin cambios.
- **R51** [D4, A] CUANDO llega una anulación cuya clave ya está registrada en la empresa, el servidor NO
  DEBE escribir nada y DEBE responder que ya estaba registrada. CUANDO dos anulaciones que comparten
  un cliente de la misma entrega se confirman a la vez, el servidor DEBE aplicar exactamente una y
  responder `delivery_already_voided` a la otra. SI falla cualquier paso, ENTONCES NO DEBE quedar
  escrito nada de la anulación.

### Tab Entregas, historial del lote y movimientos

- **R52** [D5, D6, D15] El tab Entregas de la ficha DEBE listar las líneas de las entregas sin pedido
  del producto mezcladas con las de pedido, con el mismo orden, paginación y columnas de QC-282 R43 y
  R44. En la columna Pedido, una fila de entrega sin pedido DEBE mostrar la marca «Sin pedido» y,
  debajo, su nota si la tiene.
- **R53** [D5] El total entregado del tab Entregas DEBE incluir las líneas no anuladas de las entregas
  sin pedido. Leer el tab, sus marcas y su nota NO DEBE exigir ningún permiso además de
  `inventario.consultar`.
- **R54** [D5, D15] CUANDO el usuario abre el historial de un lote, el sistema DEBE mostrar cada asiento
  de entrega sin pedido con el tipo «Entrega sin pedido», su cantidad en negativo y, en lugar del
  número de pedido, el cliente; y cada asiento de su anulación con el tipo «Anulación de entrega sin
  pedido», su cantidad en positivo y el cliente.
- **R55** [D5] Los tabs Salidas y Entradas de la ficha DEBEN mostrar esos asientos con el origen
  «Entrega sin pedido» y «Anulación de entrega sin pedido», sin número de pedido. Cada fila de
  Entregas de una entrega sin pedido DEBE tener su asiento en Salidas.

### Verificación y dependencias

- **R56** [D12] El sistema DEBE tener un E2E que, contra el navegador y Postgres reales, cubra:
  - en la ficha de un producto con excedente, una entrega sin pedido a dos clientes que comparten un
    lote, con nota, comprobando en Postgres una sola entrega sin pedido con su producto y su nota,
    sus líneas por cliente, un asiento de entrega sin pedido por lote con la suma, la existencia de
    cada lote y que ningún pedido cambió;
  - que escribir más que el excedente deshabilita «Entregar»;
  - que un producto sin excedente no tiene «Entregar» ni en la cabecera de su ficha ni en el menú de
    su fila del listado;
  - que el tab Entregas muestra las filas con «Sin pedido» y la nota; la anulación de la parte de uno
    de los clientes, comprobando en Postgres que el lote recupera solo lo anulado y que el otro
    cliente conserva la suya;
  - que el historial del lote muestra «Entrega sin pedido».
- **R57** [D12] La feature NO DEBE añadir ninguna dependencia a `package.json`.

### Cobertura de las decisiones cerradas

| Decisión | Requisitos |
|---|---|
| D1 desde la ficha, un producto con sus lotes | R7, R13, R30, R36 |
| D2 varios clientes en bloques | R12, R14, R19, R22, R23, R36 |
| D3 tope en el excedente; por lote, envases disponibles | R9, R10, R11, R16, R17, R18, R23, R25, R33, R34, R35 |
| D4 anular como QC-224, por cliente | R3, R43, R44, R45, R46, R47, R48, R49, R50, R51 |
| D5 tab Entregas «Sin pedido», «Anular» en la fila; historial | R37, R40, R43, R52, R53, R54, R55 |
| D6 nota opcional visible en Entregas | R20, R22, R36, R52 |
| D7 permisos `entregas.modificar` / `entregas.anular` | R1, R2, R3, R4, R5, R6 |
| D8 cliente obligatorio y vivo de la empresa | R15, R19, R31 |
| D9 lote entregable, conversión con el contenido del lote | R13, R16, R32, R34, R36, R37 |
| D10 borrador en `localStorage`, `deliveryKey` | R22, R24, R27, R28, R38 |
| D11 solo inserción, nombres en inglés, sin borrado | R40, R41, R42, R50 |
| D12 E2E y sin dependencias | R56, R57 |
| D13 dos entradas al mismo sheet | R5, R6, R7, R8 |
| D14 sin excedente, nada en el DOM | R5, R6, R21 |
| D15 pase `/design` aprobado | R10, R11, R12, R18, R21, R28, R44, R52, R54 (la UI sigue los tableros; `design.md > Lo que ya existe`) |

## Preguntas abiertas

- **P1** El tablero del listado (`EntregaSinPedido.dc.html`, tarjeta 1b) pinta las columnas «En stock»,
  «Esperan pedidos» y «Excedente», que el listado de hoy no tiene (agrupa por pedido). Ninguna
  decisión las pide. El spec NO las añade: solo la acción «Entregar» del menú (R6). ¿Se confirma?
- **P2** Tope de la nota (R20, R29, R40): el spec toma 500 caracteres, como el motivo de anular de
  QC-224, y trata una nota vacía como «sin nota». ¿Se confirma?
- **P3** Un asiento es por lote (QC-282 §3): si dos clientes de la misma entrega sin pedido sacan del
  mismo lote, el historial del lote (R54) tiene un asiento con dos clientes. El spec muestra sus
  nombres separados por coma, en orden alfabético. ¿Se confirma?
- **P4** Observación sobre D3, sin reabrirla. Solo cuentan los pedidos `TERMINADO`. T0 debe verificar
  en qué paso entra la existencia del pedido en el producto terminado. Si entra al terminar el
  empaque (`receiveFromOrder`), los pedidos `POR_ACONDICIONAR` y `EN_ACONDICIONAMIENTO` ya tienen su
  existencia en el stock y no cuentan en «esperan». Una entrega sin pedido podría llevársela. ¿Es lo
  querido?

## Decisiones cerradas (no reabrir)

| Fecha | Pregunta | Decisión |
|---|---|---|
| 2026-10-16 | ¿Desde dónde se lanza? | Acción «Entregar» en la ficha de producto terminado (QC-225). Una entrega es de ese producto terminado (una receta y una presentación), con sus lotes. |
| 2026-10-16 | ¿Varios clientes? | Sí: bloques por cliente, mismo patrón que QC-282 (sin clientes repetidos, cada cliente lleva al menos un envase). |
| 2026-10-16 | ¿Tope frente a pedidos pendientes? | Solo el excedente: envases disponibles del producto menos los envases que les faltan a los pedidos TERMINADO de la misma receta y presentación. Ej.: 20 en stock y 8 esperados, se entregan como mucho 12. Por lote, sigue el tope de envases disponibles (QC-223 D3/D5). |
| 2026-10-16 | ¿Anular? | Sí, como QC-224: `entregas.anular`, motivo obligatorio, registro compensatorio que devuelve los envases al lote; por cliente y presentación (QC-282). |
| 2026-10-16 | ¿Dónde se ve y desde dónde se anula? | Tab Entregas de la ficha de producto terminado (QC-225), mezclada con las de pedido y marcada «Sin pedido» en la columna Pedido; «Anular» en esa fila. En el historial del lote, el asiento sale como «Entrega sin pedido». |
| 2026-10-16 | ¿Datos extra? | Nota opcional de texto libre (p. ej. «Venta mostrador, factura 0012»), visible en la tab Entregas. |
| 2026-10-16 | ¿Permiso? | `entregas.modificar` para entregar y `entregas.anular` para anular, sin permiso nuevo (hereda QC-223 D6, QC-224 D4). |
| 2026-10-16 | ¿Cliente? | Obligatorio por bloque; solo clientes vivos de la empresa (hereda QC-156, QC-223 D4). |
| 2026-10-16 | ¿Lote y conversión? | Lote entregable de ese producto terminado con al menos un envase entero; envases convertidos con el contenido guardado en el lote (hereda QC-223 D5, D13). |
| 2026-10-16 | ¿Borrador e idempotencia? | Borrador en `localStorage` (QC-223 D8); clave de entrega generada en el cliente (`deliveryKey`, QC-223). |
| 2026-10-16 | ¿Se modifica o borra una entrega? | No: solo de inserción; la anulación es un registro nuevo (hereda QC-223 R32, QC-224 D8). Identificadores en inglés, borrado lógico (hereda la 4). |
| 2026-10-16 | ¿E2E? | Obligatorio: mueve inventario (hereda QC-213 D10). Sin dependencias nuevas. |
| 2026-10-16 | ¿Más puntos de entrada? (enmienda la fila 1, revisión del pase `/design`) | Dos entradas al mismo sheet: «Entregar» en la cabecera de la ficha de producto terminado (visible en cualquier tab) y «Entregar» en el menú de acciones de la fila del listado de producto terminado. |
| 2026-10-16 | ¿Y sin excedente? (revisión del pase `/design`) | Si el excedente es 0, ni el botón de la ficha ni la acción del menú existen en el DOM: no se muestran deshabilitados. |
| 2026-10-16 | ¿Pase `/design`? | Aprobado por el humano. Tableros en `docs/diseno/canvas/`: `EntregaSinPedido.dc.html`, `EntregaSinPedidoTablet.dc.html` y `EntregaSinPedidoMovil.dc.html` (página «Inventario» del canvas; origen https://claude.ai/artifact/CGeq7psd1fvkViqFPVfDW1). Del tablero: tarjeta «Excedente» (en stock − esperan pedidos = se puede entregar, con los pedidos desplegables), contador «Entregas N de M»; la nota va bajo «Sin pedido» en la columna Pedido del tab Entregas; la anulación se marca por cliente (una sola presentación); los envases abren vacíos. |
| 2026-10-16 | P1: ¿columnas «En stock», «Esperan pedidos» y «Excedente» en el listado? (F1.4) | No se añaden. El listado solo gana la acción «Entregar» en el menú de la fila (R6). |
| 2026-10-16 | P2: ¿tope de la nota? (F1.4) | 500 caracteres, como el motivo de anular de QC-224. Una nota vacía o solo espacios cuenta como «sin nota». |
| 2026-10-16 | P3: ¿asiento de lote con varios clientes? (F1.4) | El historial del lote muestra los nombres separados por coma, en orden alfabético. |
| 2026-10-16 | P4: ¿cuentan los pedidos POR_ACONDICIONAR / EN_ACONDICIONAMIENTO en «esperan»? (F1.4) | No: solo los TERMINADO (D3 se mantiene). Se acepta que una entrega sin pedido pueda llevarse existencia que esos pedidos necesitarán. |
| 2026-10-16 | ¿Spec aprobado? | Sí, por el humano en F1.4, incluidas las enmiendas a QC-223, QC-224 y QC-225 (`design.md > 11`) y el traslado de tres componentes de `/pedidos` a `components/shared`. |
