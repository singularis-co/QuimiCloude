# QC-282 — entrega-a-varios-clientes · requirements.md

> **Zona:** fullstack · **Complejidad:** high · **Épica:** QC-31 Pedidos · **depends_on:** QC-223, QC-224,
> QC-225 (done) · **Rama:** `feature/QC-282-entrega-a-varios-clientes`
>
> **Alcance**
> - Una sola entrega de un pedido TERMINADO se puede **repartir entre varios clientes a la vez**, en
>   lugar de hacer una entrega por cliente. Hoy (QC-223 D4) cada entrega lleva un cliente
>   obligatorio, y para entregar a tres clientes hay que guardar tres entregas seguidas.
> - **Bloques por cliente** en el sheet «Entregar»: cada cliente con sus presentaciones, lotes y
>   envases. Ej.: A → 30 × 200 ml del lote 1; B → 20 × 200 ml del lote 1 y 5 × 1 L del lote 2.
> - Se guarda como **UNA entrega con varios clientes** dentro.
> - «Anular» (enmienda QC-224) se elige por **cliente y presentación**.
>
> **Lo que NO entra**
> - Entregar sin pedido.
> - Precios y facturación (QC-223).
>
> Acotada con `/afinar-feature` el 2026-10-14 (nace del chat). Las decisiones del 2026-10-15 las
> cerró el humano al tomar la ficha y en el pase `/design`. `spec_author` no las reabre.

## Requisitos (EARS)

**Leyenda.** `[D<n>]` es la fila n de `## Decisiones cerradas (no reabrir)`, contando desde arriba.
`[A]` marca una regla de `docs/architecture.md` (aislamiento por empresa; operación que mueve
existencias idempotente y auditable).

**Términos.**
- **Bloque**: en el sheet «Entregar», un cliente con los envases que lleva de cada lote.
- **Cliente de la entrega**: cada cliente que lleva al menos una línea en una entrega.
- **Línea de entrega**: lo que un cliente lleva de un lote en una entrega (cliente, presentación del
  pedido, lote, envases y cantidad).
- **Par cliente-presentación** de una entrega: las líneas de esa entrega de un mismo cliente y una
  misma línea del reparto del pedido. Es la unidad que se anula [D5].
- **Envases que faltan**, **lote entregable**, **envases disponibles** y **clave de entrega**: como
  en QC-223 (`specs/QC-223-entregar-producto-terminado/requirements.md > Términos`), con «envases
  entregados» según QC-224 (sin las líneas anuladas).
- **Escritos en un lote**: la suma de los envases escritos para ese lote en todos los bloques.

Siguen vigentes, sin cambios, los requisitos de QC-223, QC-224 y QC-225 que esta ficha no enmienda.
La lista de enmiendas está en `design.md > 10`.

### Acceso

- **R1** [D8, D5] La feature NO DEBE añadir, quitar ni reasignar permisos: el catálogo de permisos y
  los permisos sembrados de cada rol DEBEN quedar iguales.
- **R2** [D8] SI el actor no tiene `entregas.modificar`, ENTONCES el servidor DEBE responder
  `unauthorized` al registro de una entrega con varios clientes antes de validar la entrada y antes
  de leer o escribir nada.
- **R3** [D5] SI el actor no tiene `entregas.anular`, ENTONCES el servidor DEBE responder
  `unauthorized` al registro de una anulación por cliente y presentación antes de validar la entrada
  y antes de leer o escribir nada.

### Sheet «Entregar»: bloques por cliente

- **R4** [D1, D3] CUANDO el sheet se abre sin borrador guardado y el pedido tiene un cliente vivo, el
  sheet DEBE mostrar un solo bloque, titulado «Cliente 1», con ese cliente elegido.
- **R5** [D3] CUANDO el sheet se abre sin borrador guardado, SI el pedido no tiene cliente o el suyo
  está dado de baja, ENTONCES el sheet DEBE mostrar un solo bloque con el campo de cliente vacío.
- **R6** [D1] Cada bloque DEBE tener su campo de cliente y, por cada presentación del pedido a la
  que le falten envases, la lista de sus lotes entregables, cada lote con su código, sus disponibles
  (R13) y un campo de envases. MIENTRAS a una presentación no le falten envases, ningún bloque DEBE
  mostrarle campos de envases.
- **R7** [D13] La lista de lotes del sheet «Entregar» NO DEBE mostrar la fecha de vencimiento del
  lote, ni en la tabla ni en las tarjetas de teléfono. *(La fecha de entrada del lote: ver P1.)*
- **R8** [D1] CUANDO el usuario pulsa «Añadir cliente», el sheet DEBE añadir al final un bloque con
  el cliente vacío y sin envases, titulado «Cliente N» según su posición.
- **R9** [D1] MIENTRAS haya más de un bloque, cada bloque DEBE ofrecer «Quitar». SI solo hay un
  bloque, ENTONCES «Quitar» NO DEBE existir en el DOM. CUANDO el usuario quita un bloque, el sheet DEBE
  quitarlo con todos sus envases y renumerar los títulos de los demás.
- **R10** [D7] El buscador de cliente de cada bloque DEBE ofrecer solo clientes vivos de la empresa
  del actor.

### Sheet «Entregar»: topes y validación

- **R11** [D6] El sheet DEBE mostrar un resumen «Por entregar» con, por cada presentación del pedido,
  la suma de los envases escritos en todos los bloques y los envases que le faltan, y una marca:
  «Completa» si la suma es igual a lo que falta, «Faltan N» si es menor y «Sobran N» si es mayor.
  *(Ver P2.)*
- **R12** [D6] MIENTRAS la suma de los envases escritos en todos los bloques para una presentación
  supere los que le faltan, el sheet NO DEBE enviar la entrega.
- **R13** [D16] En cada bloque, los disponibles de un lote DEBEN ser sus envases disponibles menos
  los escritos en ese lote, sin bajar de cero. Todos los bloques DEBEN mostrar el mismo número para el
  mismo lote.
- **R14** [D16] CUANDO el usuario escribe en el campo de envases de un lote, el campo DEBE aceptar
  solo dígitos. SI el número supera los envases disponibles del lote menos lo escrito en ese lote por
  los demás bloques, ENTONCES el campo DEBE quedarse en ese tope.
- **R15** [D16] MIENTRAS lo escrito en un lote supere sus envases disponibles (p. ej. porque la
  existencia bajó al volver a leer), el sheet DEBE marcar ese lote con «Solo hay N» (N, sus envases
  disponibles) en todos los bloques, DEBE mostrar el aviso de que entre todos los clientes se pasa de
  lo disponible en un lote, y «Entregar» DEBE estar deshabilitado.
- **R16** [D1] SI el usuario pulsa «Entregar» y un bloque no tiene cliente, ENTONCES el sheet DEBE
  mostrar bajo el campo de ese bloque «Elige el cliente.» y NO DEBE enviar la entrega.
- **R17** [D4] SI el usuario pulsa «Entregar» y un bloque tiene el mismo cliente que un bloque
  anterior, ENTONCES el sheet DEBE mostrar bajo el campo del bloque posterior «Este cliente ya está en
  la entrega.» y NO DEBE enviar la entrega.
- **R18** [D15] SI el usuario pulsa «Entregar» y un bloque con cliente no lleva ningún envase,
  ENTONCES el sheet DEBE mostrar bajo su campo de cliente «Este cliente no lleva envases: indica al
  menos uno en alguna presentación.» y NO DEBE enviar la entrega. Cada bloque DEBE mostrar como mucho
  un error, el primero que aplique en el orden R16, R17, R18.
- **R19** [D2] CUANDO el usuario pulsa «Entregar» y no aplica ninguno de R12, R15, R16, R17 ni R18,
  el sheet DEBE enviar una sola entrega con la clave de entrega del borrador y todos los bloques, cada
  uno con su cliente y sus envases por presentación y lote.
- **R20** [D6, D16] El sistema DEBE calcular el tope por presentación, la suma por lote y las reglas
  de bloque (sin cliente, cliente repetido, sin envases) con las mismas funciones puras en el sheet y
  en el servidor.

### Registro de la entrega (servidor)

- **R21** SI la entrada no tiene la forma acordada, ENTONCES el servidor DEBE responder
  `invalid_input` sin escribir nada. Son casos de forma no acordada: ningún cliente; un cliente sin
  envases; el mismo cliente dos veces; la misma presentación y lote repetidos dentro de un cliente;
  envases no enteros o menores que uno; una línea del reparto que no es del pedido; más asignaciones
  que el tope del contrato; un campo de más o un campo ausente. Un identificador de cliente sin forma
  de uuid responde `customer_not_found` (R22), como en QC-223 R22.
- **R22** [D7, A] SI algún cliente de la entrega no existe, está dado de baja o es de otra empresa,
  ENTONCES el servidor DEBE responder `customer_not_found` sin escribir nada.
- **R23** [D6] SI la suma de los envases de todos los clientes para una presentación supera los que
  le faltan, calculados con el pedido bloqueado, ENTONCES el servidor DEBE responder
  `delivery_exceeds_remaining` sin escribir nada.
- **R24** [D16, A] SI la suma de los envases de todos los clientes para un lote supera sus envases
  disponibles, leídos con el producto bloqueado, ENTONCES el servidor DEBE responder
  `delivery_batch_insufficient` sin escribir nada de la entrega entera. En ningún caso la existencia
  de un lote DEBE quedar negativa.
- **R25** [D2, A] CUANDO el servidor aplica una entrega, DEBE guardar una sola entrega con el pedido,
  la clave, el autor y el instante y, por cada cliente y lote, una línea con el cliente, la línea del
  reparto, el lote, los envases y la cantidad descontada. NO DEBE cambiar el cliente del pedido.
- **R26** [D2, D16, A] CUANDO el servidor aplica una entrega, DEBE descontar de cada lote la suma de
  los envases de todos los clientes por el contenido de envase del lote, y DEBE escribir en la misma
  transacción un solo asiento de entrega por lote, cuya cantidad sea la suma, en negativo, de las
  cantidades de las líneas de ese lote en esa entrega.
- **R27** [D2, D6] CUANDO, tras aplicar una entrega, no le falten envases a ninguna presentación del
  pedido, el servidor DEBE pasar el pedido a `ENTREGADO` en la misma transacción. SI a alguna le
  siguen faltando, ENTONCES el pedido DEBE seguir `TERMINADO`.
- **R28** [A] CUANDO llega una entrega con varios clientes cuya clave ya está registrada en la
  empresa, el servidor NO DEBE escribir nada y DEBE responder que ya estaba registrada, con el estado
  actual del pedido de esa entrega.
- **R29** [A] SI falla cualquier paso de una entrega con varios clientes, incluido uno posterior al
  primer cliente, ENTONCES NO DEBE quedar escrito nada de ella: ni entrega, ni línea, ni asiento, ni
  cambio de existencia, ni cambio de estado del pedido.
- **R30** [D2, D4, A] La base DEBE rechazar una línea de entrega sin cliente, con un cliente de otra
  empresa o con un cliente y un lote que ya tiene otra línea de la misma entrega. La base DEBE aceptar
  dos líneas de la misma entrega y el mismo lote con clientes distintos.

### Migración de las entregas existentes

- **R31** [D11] CUANDO se aplica la migración, cada línea de cada entrega existente DEBE quedar con el
  cliente que tenía su entrega. Los envases, las cantidades, las anulaciones, los asientos y las
  existencias NO DEBEN cambiar. La entrega NO DEBE conservar un cliente propio: el cliente de una
  entrega solo se guarda en sus líneas.
- **R32** [D11] SI al aplicar la migración existe una entrega sin líneas, ENTONCES la migración DEBE
  abortar sin cambiar nada. CUANDO se revierte, SI cada entrega tiene un solo cliente, ENTONCES la
  reversión DEBE devolverle ese cliente a la entrega. SI alguna entrega tiene más de un cliente,
  ENTONCES la reversión DEBE abortar sin cambiar nada.

### Lista de entregas del pedido (enmienda QC-224)

- **R33** [D12] CUANDO el usuario abre la lista de entregas de un pedido, cada entrega DEBE mostrarse
  como una tarjeta con su fecha, su número de clientes, su total de envases y su autor y, dentro, un
  subbloque por cliente con su nombre (aunque esté dado de baja) y, por cada presentación que llevó,
  su nombre, sus envases y, por lote, el código y los envases.
- **R34** [D5, D12] MIENTRAS un par cliente-presentación de una entrega esté anulado, el subbloque de
  ese cliente DEBE mostrar esa presentación marcada «Anulada» con el motivo, el autor y la fecha de la
  anulación. La misma presentación en el subbloque de otro cliente NO DEBE mostrarse anulada si su par
  no lo está.
- **R35** [D5] La lista DEBE ofrecer «Anular» en una entrega solo MIENTRAS se cumplan las condiciones
  de QC-224 R10 y a la entrega le quede al menos un par cliente-presentación sin anular.

### Diálogo «Anular la entrega» (enmienda QC-224)

- **R36** [D5, D14] CUANDO el usuario pulsa «Anular» en una entrega, el diálogo DEBE listar, agrupados
  por cliente, los pares cliente-presentación de esa entrega sin anular, cada uno con sus envases y
  todos sin marcar. NO DEBE listar los pares ya anulados, ni un cliente al que no le quede ningún par
  sin anular, ni ningún campo de cantidad.
- **R37** [D14] Cada grupo de cliente DEBE tener una casilla de grupo: marcada si todos sus pares lo
  están, sin marcar si no lo está ninguno y en estado mixto (`aria-checked="mixed"`) si solo lo están
  algunos. CUANDO el usuario pulsa la casilla de grupo con todos sus pares marcados, el diálogo DEBE
  desmarcarlos todos; en cualquier otro estado, DEBE marcarlos todos.
- **R38** [D5] CUANDO el usuario confirma con al menos un par marcado y un motivo válido, el diálogo
  DEBE enviar la anulación con la entrega, la clave de anulación, el motivo y los pares marcados
  (cliente y presentación). QC-224 R12 y R13 siguen vigentes.

### Registro de la anulación (servidor, enmienda QC-224)

- **R39** [D5] SI la anulación no trae ningún par, trae un par repetido o trae un par que no es de esa
  entrega, ENTONCES el servidor DEBE responder `invalid_input` sin escribir nada.
- **R40** [D5] SI algún par pedido ya está anulado, ENTONCES el servidor DEBE responder
  `delivery_already_voided` y NO DEBE anular ninguno de los otros pares pedidos.
- **R41** [D5] CUANDO el servidor aplica una anulación, DEBE anular todas las líneas de los pares
  pedidos, en todos sus lotes, y ninguna otra línea, tampoco las de la misma presentación de otro
  cliente.
- **R42** [D5, A] CUANDO el servidor aplica una anulación, DEBE devolver a cada lote la suma de las
  cantidades de sus líneas anuladas y DEBE escribir en la misma transacción un solo asiento de
  anulación de entrega por lote, con esa suma en positivo. Los envases entregados de cada presentación
  DEBEN bajar exactamente en los envases anulados, y el pedido DEBE volver de `ENTREGADO` a
  `TERMINADO` como en QC-224 R27.

### Tab Entregas del producto terminado (enmienda QC-225)

- **R43** [D12] El tab Entregas DEBE listar una fila por cada línea de entrega del producto (cliente,
  presentación y lote de una entrega), con fecha, cliente, número de pedido, presentación, lote,
  envases, cantidad en unidad base y anulación.
- **R44** [D12] La paginación, el orden y el total entregado de QC-225 R23 y R34 DEBEN aplicarse sobre
  esas filas. Una fila DEBE mostrarse «Anulada», con su motivo, solo SI su par cliente-presentación
  está anulado.

### Borrador

- **R45** [D9] MIENTRAS el sheet esté abierto, cada cambio de los bloques (añadir, quitar, cliente o
  envases) DEBE guardarse en `localStorage` bajo la clave del pedido, junto con la clave de entrega.
  CUANDO el usuario vuelve a abrir el sheet del mismo pedido tras cerrarlo sin cancelar o tras
  recargar, el sheet DEBE restaurar los bloques en el mismo orden, con sus clientes, sus envases y la
  clave de entrega.
- **R46** [D9, D17] CUANDO el sheet restaura un borrador, DEBE descartar de todos los bloques los
  envases de los lotes que ya no se ofrecen y mostrar el aviso de borrador ajustado solo en ese caso.
  NO DEBE mostrar ese aviso por ningún otro motivo, tampoco cuando un lote sigue ofrecido pero con
  menos envases (eso lo cubre R15).

### Verificación y dependencias

- **R47** [D10] El sistema DEBE tener un E2E que, contra el navegador y Postgres reales, cubra:
  - una entrega de un pedido `TERMINADO` a dos clientes que comparten un lote y llevan otra
    presentación, comprobando en Postgres una sola entrega, sus líneas por cliente, un asiento por
    lote con la suma y la existencia de cada lote;
  - el error de cliente repetido, que no envía nada;
  - el diálogo de anular abre sin nada marcado; se anula solo una presentación de uno de los clientes,
    comprobando en Postgres que el otro cliente conserva la suya y que el lote recupera solo lo
    anulado;
  - la lista muestra un subbloque por cliente y el tab Entregas del producto muestra una fila por
    cliente con la columna «Presentación».
- **R48** [D10] La feature NO DEBE añadir ninguna dependencia a `package.json`.

### Cobertura de las decisiones cerradas

| Decisión | Requisitos |
|---|---|
| D1 bloques por cliente | R4, R6, R8, R9, R16 |
| D2 una entrega con varios clientes | R19, R25, R26, R27, R30 |
| D3 precarga | R4, R5 |
| D4 sin clientes repetidos | R17, R21, R30 |
| D5 anular por cliente y presentación | R1, R3, R34, R35, R36, R38, R39, R40, R41, R42 |
| D6 tope por presentación sobre la suma | R11, R12, R20, R23, R27 |
| D7 clientes borrados no se ofrecen | R10, R22 |
| D8 permiso `entregas.modificar` | R1, R2 |
| D9 borrador con los bloques | R45, R46 |
| D10 E2E y sin dependencias | R47, R48 |
| D11 se migran las entregas existentes | R31, R32 |
| D12 lista y tab Entregas | R33, R34, R43, R44 |
| D13 sin «Vence» en el sheet | R7 |
| D14 anular abre sin nada marcado; casilla de grupo | R36, R37 |
| D15 al menos un envase por cliente | R18, R21 |
| D16 stock por lote sumando los clientes | R13, R14, R15, R20, R24, R26 |
| D17 aviso de borrador sin cambios | R46 |
| D18 pase `/design` aprobado | R4–R18, R33–R37, R43 (la UI sigue los tableros; `design.md > Lo que ya existe`) |

## Preguntas abiertas

- **P1 — Fecha de entrada en la lista de lotes del sheet.** QC-223 R7 muestra, por lote, la fecha de
  entrada y la de vencimiento. D13 quita solo «Vence». En el tablero aprobado
  (`EntregaVariosClientes.dc.html`) las columnas son «Lote · Disponibles · Entrada», y «Entrada» es
  el **campo de envases**, no la fecha: el tablero no muestra ninguna fecha. ¿La fecha de entrada del
  lote se mantiene en el sheet (con otra etiqueta, porque «Entrada» pasa a ser el campo) o se quita
  también? R7 solo fija lo decidido (sin vencimiento).
- **P2 — Progreso por presentación.** QC-223 R6 muestra, por presentación, «Pedidos N · Entregados M ·
  Faltan K». El tablero lo sustituye por el resumen «Por entregar» («Entregas X de Y» + marca), y en
  sus datos de ejemplo Y coincide con lo pedido porque no hay entregas previas. R11 toma Y = los
  envases que **faltan** (es el tope de D6; con lo pedido, «Completa» saldría mal en un pedido con
  entregas parciales). ¿Se confirma, y se deja de mostrar «Pedidos · Entregados · Faltan»?

## Decisiones cerradas (no reabrir)

| Fecha | Pregunta | Decisión |
|---|---|---|
| 2026-10-14 | ¿Cómo se reparte la entrega? | Bloques por cliente en el sheet «Entregar»: cada cliente con sus presentaciones, lotes y envases. |
| 2026-10-14 | ¿Cómo se guarda? | Como UNA entrega con varios clientes dentro. |
| 2026-10-14 | ¿Precarga? | El cliente del pedido es el primer bloque; un pedido sin cliente abre con un bloque vacío. |
| 2026-10-14 | ¿Clientes repetidos? | No: sin clientes repetidos en la misma entrega. |
| 2026-10-14 | ¿Anular? (enmienda QC-224) | Se elige cliente y presentación a anular (ej.: solo lo de B, y de B solo los 1 L). Lo demás de QC-224 se mantiene: motivo obligatorio, `entregas.anular`, registro compensatorio. |
| 2026-10-14 | ¿Tope? | Hereda QC-223 D3: por presentación, sobre la suma de todos los clientes. |
| 2026-10-14 | ¿Clientes borrados? | No se ofrecen (hereda QC-156). |
| 2026-10-14 | ¿Permiso? | `entregas.modificar` (hereda QC-223). Sin permiso nuevo. |
| 2026-10-14 | ¿Borrador? | En `localStorage` (QC-223 D8), con los bloques por cliente. |
| 2026-10-14 | ¿E2E y dependencias? | E2E sí (movimiento de inventario). Sin dependencias nuevas. |
| 2026-10-15 | ¿Las entregas existentes de un solo cliente se migran o se leen como un bloque? (era P1 del issue) | Se migran: migración de datos a un bloque con su cliente. Un solo camino de lectura. |
| 2026-10-15 | ¿Cómo se muestra en las listas? (era P2 del issue) | Lista de entregas del pedido (QC-224): una tarjeta por entrega con un subbloque por cliente. Tab Entregas de QC-225: una fila por cliente, presentación y lote, con la columna nueva «Presentación». |
| 2026-10-15 | ¿Fecha de vencimiento en el sheet? (revisión del pase `/design`) | Sobra: se quita la columna «Vence» solo del sheet «Entregar» (tabla de lotes y tarjetas de teléfono). |
| 2026-10-15 | ¿Cómo abre «Anular la entrega»? | Sin nada marcado (cambia el «todo marcado» de QC-224), con una casilla de grupo por cliente que marca o desmarca todo lo del cliente y queda en estado mixto si solo hay algo marcado. |
| 2026-10-15 | ¿Un cliente puede ir sin envases? | No: cada cliente lleva al menos un envase en alguna presentación; si no, error bajo su bloque. |
| 2026-10-15 | ¿Stock por lote con varios clientes? | Se suma lo de todos los clientes. «Disponibles» muestra lo que queda tras todos los bloques; la Entrada no deja pasar de ahí; si la suma ya supera el stock (p. ej. bajó), el lote marca «Solo hay N» y «Entregar» queda deshabilitado. El servidor lo valida igual. |
| 2026-10-15 | ¿Aviso de borrador? | El de QC-223 D8, sin cambios: solo cuando un lote del borrador ya no está disponible. |
| 2026-10-15 | ¿Pase `/design`? | Aprobado por el humano. Tableros en `docs/diseno/canvas/`: `EntregaVariosClientes.dc.html`, `EntregaVariosClientesTablet.dc.html` y `EntregaVariosClientesMovil.dc.html` (página «Pedidos» del canvas; origen https://claude.ai/artifact/WUkjAyEcpu73NyNRmA6iMk). |
