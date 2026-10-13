# QC-225 — detalle-de-producto-terminado · requirements.md

> **Zona:** fullstack · **Complejidad:** medium · **depends_on:** QC-223 · **Rama:** `feature/QC-225-detalle-de-producto-terminado`
>
> **Alcance.** Ficha de solo consulta de un producto terminado (`Product` con `type = FINISHED_PRODUCT`),
> en una ruta propia bajo /inventario, organizada en tabs: General, Stock, Lotes, Entradas, Salidas,
> Entregas y Costo de producción. Se llega desde la pestaña de producto terminado de /inventario y
> desde cada presentación ya producida de un pedido en /pedidos.
>
> **Lo que NO entra.**
> - Acciones desde la ficha (editar nombre o alerta, ajustar stock, entregar): siguen donde están hoy (QC-150 D23, QC-223).
> - Anular una entrega: QC-224.
> - Desglose de insumos consumidos por orden en el costo: fuera; solo costo por lote/orden.
> - Un concepto de «venta» propio, precios y facturación: no existe modelo; hoy la venta es un ajuste que resta (QC-150 D7). Sin ficha, igual que en QC-150.
> - Ficha de productos que no son terminados (insumos, materias primas).
>
> Sembrado por `/afinar-feature` el 2026-10-09. El bloque de Alcance y la tabla de «Decisiones cerradas»
> los fijó el humano ANTES del spec. `spec_author` los respeta, no los reabre y no los reescribe: su
> trabajo aquí es `## Requisitos (EARS)`.

## Requisitos (EARS)

Las etiquetas entre corchetes remiten a las filas de `## Decisiones cerradas (no reabrir)` por su
tema: [Llegada], [Tabs], [Entradas], [Salidas], [Ventas], [Costo], [Costos visibles],
[Solo consulta], [Permiso], [Borrado], [E2E], [Unidades], [Lote→orden], [Paginación],
[Identificadores]. La tabla de cobertura está al final de esta sección.

### Glosario

- **Ficha**: la página de solo consulta de un producto terminado, en su ruta propia bajo /inventario.
- **Producto terminado**: `Product` con `type = FINISHED_PRODUCT`, vivo (sin borrado lógico) y de la
  empresa del actor.
- **Asiento**: una fila del libro de movimientos de inventario (`inventory_movements`) de un lote del
  producto.
- **Envases enteros de una cantidad**: la parte entera de esa cantidad dividida por el contenido de
  envase guardado en su lote (`package_content`); el **resto** es lo que no llena un envase, en la
  unidad base.
- **Pedido de origen de un lote**: el pedido del asiento `production` de ese lote.

### Acceso

- **R1** [Permiso] CUANDO un usuario abre la ruta de la ficha, el sistema DEBE exigir
  `inventario.consultar` antes de leer ningún dato. SI no lo tiene, ENTONCES DEBE responder como a
  una ruta inexistente (404), sin nombrar el módulo ni el permiso.
- **R2** [Permiso] SI el actor no tiene `inventario.consultar`, ENTONCES cada lectura de la ficha
  (general y stock, lotes, entradas, salidas, entregas, costo de producción) y la consulta de enlaces
  de /pedidos DEBEN responder `unauthorized` antes de validar la entrada y sin leer nada.
- **R3** [Permiso] El servidor DEBE decidir el acceso por el permiso y nunca por el rol: un actor con
  `inventario.consultar` y un rol cualquiera DEBE ser aceptado, y un Administrador sin ese permiso
  en su conjunto DEBE ser rechazado.
- **R4** [Permiso] El tab Entregas, incluido el nombre del cliente, y el tab Costo de producción NO
  DEBEN exigir ningún permiso además de `inventario.consultar` (ni `pedidos.consultar` ni
  `clientes.consultar`).

### Producto no encontrado

- **R5** [Borrado] SI el identificador pedido no tiene forma de uuid, no existe, es de un producto
  con borrado lógico, es de otra empresa o es de un producto cuyo tipo no es `FINISHED_PRODUCT`,
  ENTONCES cada lectura de la ficha DEBE responder `product_not_found`, igual en los cinco casos, y
  NO DEBE devolver ningún dato del producto, de sus lotes ni de sus asientos.
- **R6** [Borrado] CUANDO la lectura responde `product_not_found`, la pantalla DEBE mostrar el estado
  «producto no encontrado» con un enlace de vuelta a la pestaña de producto terminado de /inventario
  y sin tabs. SI la lectura falla con cualquier otro error, ENTONCES DEBE mostrar el estado de error
  con el mensaje del catálogo y sin ningún dato.

### Solo consulta

- **R7** [Solo consulta] La ficha NO DEBE ofrecer ningún control que modifique datos (editar,
  ajustar existencia, entregar, anular, borrar), y ningún archivo de su ruta DEBE importar una
  Server Action de escritura.

### Tabs

- **R8** [Tabs] La ficha DEBE mostrar el nombre del producto y siete tabs, en este orden: General,
  Stock, Lotes, Entradas, Salidas, Entregas y Costo de producción.
- **R9** [Tabs] CUANDO el usuario cambia de tab o de página, el sistema DEBE reflejarlo en la
  dirección, de modo que recargar o compartir el enlace abra el mismo tab y la misma página. CUANDO
  cambia de tab, DEBE volver a la página 1. SI el tab de la dirección no es uno de los siete,
  ENTONCES DEBE abrir General.

### General y Stock

- **R10** [Tabs] El tab General DEBE mostrar nombre, imagen (o el marcador de imagen ausente),
  presentación (nombre y contenido con su unidad), unidad base de la existencia y alerta de cantidad
  (o el marcador de ausencia si no tiene).
- **R11** [Unidades] El tab Stock DEBE mostrar la existencia total en la unidad base, igual a la suma
  exacta de la existencia de los lotes del producto.
- **R12** [Unidades] El tab Stock DEBE mostrar la existencia en envases agrupada por contenido de
  envase: por cada contenido distinto entre los lotes con existencia, la suma de los envases enteros
  de cada lote y la suma de sus restos, en la unidad base. Los lotes con existencia y sin contenido
  de envase DEBEN sumarse en una entrada «sin envase», solo en unidad base. El cálculo DEBE ser
  decimal exacto, sin coma flotante.

### Lotes

- **R13** [Lote→orden, Unidades] El tab Lotes DEBE listar todos los lotes del producto, incluidos los
  agotados, con: número de lote, pedido de origen (o «Sin pedido» si el lote no tiene asiento
  `production`), fecha de entrada, fecha de producción, vencimiento, contenido de envase, y
  existencia en unidad base y en envases enteros más resto.
- **R14** [Lote→orden] El pedido de origen de un lote DEBE resolverse por su asiento `production`, y
  su número visible DEBE mostrarse aunque el pedido esté cancelado, entregado o borrado.

### Entradas y Salidas

- **R15** [Entradas] El tab Entradas DEBE listar todos los asientos de los lotes del producto cuya
  cantidad es positiva, y solo esos, cada uno con fecha, origen, lote, cantidad en unidad base,
  envases enteros más resto si el lote tiene contenido de envase, número de pedido si el asiento lo
  lleva y motivo si es un ajuste.
- **R16** [Entradas] El origen de cada entrada DEBE distinguir, al menos: producción (con su pedido),
  apertura (alta o importación) y ajuste que suma (con su motivo).
- **R17** [Salidas, Ventas] El tab Salidas DEBE listar todos los asientos de los lotes del producto
  cuya cantidad es negativa, y solo esos, cada uno con fecha, tipo (entrega a cliente o ajuste que
  resta, con su motivo), lote, cantidad restada en valor absoluto en unidad base, envases enteros más
  resto si el lote tiene contenido de envase y número de pedido si el asiento lo lleva. Una venta
  registrada como ajuste que resta DEBE aparecer aquí como ajuste, con su motivo.
- **R18** [Entradas, Salidas] El sistema DEBE clasificar un asiento en Entradas o en Salidas por el
  signo de su cantidad y no por su tipo: un ajuste que suma DEBE salir solo en Entradas y uno que
  resta solo en Salidas.

### Entregas

- **R19** [Salidas] El tab Entregas DEBE listar cada lote de cada entrega del producto, con fecha,
  cliente, número de pedido, lote, envases entregados y cantidad en unidad base. Cada fila de
  Entregas DEBE tener su asiento correspondiente en Salidas.
- **R20** [Salidas] SI el cliente de una entrega está dado de baja, ENTONCES la fila DEBE mostrar su
  nombre con la marca de dado de baja. SI el cliente no se puede resolver, ENTONCES DEBE mostrar el
  marcador de ausencia. En ningún caso la fila DEBE ocultarse.

### Costo de producción

- **R21** [Costo, Costos visibles] El tab Costo de producción DEBE listar cada lote del producto que
  tiene asiento `production`, y solo esos, con: lote, número de pedido, cantidad que entró (la del
  asiento `production`) en unidad base y en envases, costo unitario guardado en el lote y costo
  total igual a costo unitario × cantidad que entró, calculado en decimal exacto y redondeado mitad
  arriba a cuatro decimales.
- **R22** [Costo] El costo de producción DEBE salir solo de los datos guardados: NO DEBE recalcularse
  con los costos actuales de los insumos ni desglosar los insumos consumidos.

### Listados

- **R23** [Paginación] Los tabs Lotes, Entradas, Salidas, Entregas y Costo de producción DEBEN
  paginarse con 10 filas por defecto y un tope de 25, y DEBEN ordenarse del más reciente al más
  antiguo, desempatando por identificador. SI se pide un tamaño mayor que el tope, ENTONCES DEBE
  aplicarse el tope. SI la página o el tamaño no son enteros mayores o iguales que 1, ENTONCES el
  servidor DEBE responder `invalid_input`.
- **R24** [Paginación] SI un tab de listado no tiene filas, ENTONCES DEBE mostrar un estado vacío
  propio de ese tab, distinto del estado de error.

### Ámbito de empresa

- **R25** [Permiso] Toda lectura de la ficha DEBE acotarse a la empresa del actor: ningún lote,
  asiento, entrega, cliente ni pedido de otra empresa DEBE aparecer en ningún tab.

### Puntos de llegada

- **R26** [Llegada] En la pestaña de producto terminado de /inventario, el nombre del producto en cada
  línea DEBE ser un enlace a su ficha.
- **R27** [Llegada] MIENTRAS un pedido esté `TERMINADO` o `ENTREGADO`, en /pedidos el nombre de cada
  presentación de su reparto que tenga un lote producido por ese pedido, de un producto terminado
  vigente, DEBE ser un enlace a la ficha de ese producto, también en las presentaciones que hoy se
  resumen como «+N».
- **R28** [Llegada] SI el pedido no está `TERMINADO` ni `ENTREGADO`, o la presentación no tiene lote
  producido por ese pedido, o el producto de ese lote tiene borrado lógico, ENTONCES el nombre de la
  presentación DEBE mostrarse como hoy, sin enlace.
- **R29** [Llegada, Permiso] SI quien ve /pedidos no tiene `inventario.consultar`, o la consulta de
  enlaces falla, ENTONCES no DEBE mostrarse ningún enlace a la ficha y la lista de pedidos DEBE
  pintarse igual que hoy. *(Ver P1.)*
- **R30** [Llegada] La dirección de la ficha DEBE construirse desde una única función de rutas; ningún
  otro archivo de producto DEBE escribirla como literal.

### E2E, datos y dependencias

- **R31** [E2E] Un recorrido E2E DEBE finalizar una orden, entregar parte de su producto terminado,
  abrir la ficha del producto desde /pedidos o /inventario y comprobar que aparecen el lote, la
  entrada de producción, la salida por entrega y la entrega con cliente, pedido, lote y envases. Otro
  caso DEBE comprobar que un usuario sin `inventario.consultar` es rechazado al abrir la ficha.
- **R32** [Lote→orden, Identificadores] La feature NO DEBE crear tablas, columnas, valores de enum ni
  migraciones, NO DEBE escribir en ninguna tabla y NO DEBE añadir dependencias a `package.json`.

### Cobertura de las decisiones cerradas

| Decisión (tema) | Requisitos |
|---|---|
| ¿Desde dónde se llega? [Llegada] | R26, R27, R28, R29, R30 |
| ¿Cómo se organiza la ficha? [Tabs] | R8, R9, R10 |
| ¿Qué es «Entradas»? [Entradas] | R15, R16, R18 |
| «Salidas» frente a «Entregas» [Salidas] | R17, R18, R19, R20 |
| «Ventas» [Ventas] | R17 |
| ¿Qué muestra «Costo de producción»? [Costo] | R21, R22 |
| ¿Se muestran costos? [Costos visibles] | R4, R21 |
| ¿Solo consulta o con acciones? [Solo consulta] | R7 |
| ¿Quién puede ver la ficha? [Permiso] | R1, R2, R3, R4, R25, R29 |
| Producto borrado [Borrado] | R5, R6 |
| ¿Lleva E2E? [E2E] | R31 |
| Unidades [Unidades] | R11, R12, R13, R15, R17, R19, R21 |
| Lote → orden que lo produjo [Lote→orden] | R13, R14, R21, R32 |
| Listados largos [Paginación] | R23, R24 |
| Identificadores y borrado [Identificadores] | R5 (borrado lógico), R32 (sin identificadores nuevos en la base) |

## Preguntas abiertas

- **P1 (R29, no bloquea el spec).** La decisión de llegada desde /pedidos no dice qué pasa si quien ve
  la lista no tiene `inventario.consultar`. R29 propone no pintar el enlace, porque llevaría a una
  ficha que responde 404 (R1). Hoy los roles sembrados con `pedidos.consultar` (solo Administrador)
  también tienen `inventario.consultar`, así que el caso solo aparece con un conjunto de permisos
  hecho a mano. Si el humano prefiere pintar el enlace siempre, R29 se reduce a «la lista se pinta
  igual si la consulta falla».
- **P2 (no bloquea el spec; choque con QC-224 en vuelo).** QC-224 (`anular-entrega`, in_progress, sin
  mergear) añade el tipo de asiento `delivery_void`, que suma existencia, y dice en su design que
  QC-225 «reutiliza» su lista de entregas por pedido. Este spec no depende de QC-224: clasifica los
  asientos por signo (R18), así que una anulación saldría en Entradas sin cambiar nada aquí, y no
  reutiliza la lista de QC-224 (design §9, A5). Lo que queda abierto es cómo se ve en el tab Entregas
  una entrega anulada: no hay modelo de anulación en `dev` hoy. Propuesta: lo resuelve la ficha que
  mergee segunda, con una fila en su propia tabla de decisiones. Además, los dos specs tocan los
  mismos archivos de contrato (design §11).

## Decisiones cerradas (no reabrir)

| Fecha | Pregunta | Decisión |
|---|---|---|
| 2026-10-09 | ¿Desde dónde se llega? | Desde /inventario: el nombre del producto en cada línea de la pestaña de producto terminado enlaza a la ficha. Desde /pedidos: el nombre de cada presentación ya producida enlaza a la ficha de su producto, solo en pedidos TERMINADO o ENTREGADO y solo si el producto está vigente. |
| 2026-10-09 | ¿Cómo se organiza la ficha? | En tabs: General, Stock, Lotes, Entradas, Salidas, Entregas y Costo de producción. |
| 2026-10-09 | ¿Qué es «Entradas»? | Todo lo que sumó stock según el libro de movimientos: producción (con su orden) y cualquier otra entrada (apertura, importación). Cada fila muestra su origen. |
| 2026-10-09 | ¿Qué es «Salidas» y en qué se diferencia de «Entregas»? | Salidas es el libro completo de lo que restó stock: entregas y ajustes que restan. Entregas es el detalle de cada entrega: cliente, pedido, lote y envases. Una entrega aparece en los dos tabs. |
| 2026-10-09 | «Ventas» | No existe un modelo de venta. Las ventas registradas como ajustes que restan (QC-150 D7) se ven en Salidas. |
| 2026-10-09 | ¿Qué muestra «Costo de producción»? | Por cada lote producido: la orden, la cantidad que entró, el costo unitario y el costo total. Usa los datos guardados (QC-150 D4/D12). Sin desglose de insumos. |
| 2026-10-09 | ¿Se muestran costos? | Sí, igual que en /inventario: lo ve quien tiene `inventario.consultar`. |
| 2026-10-09 | ¿Solo consulta o con acciones? | Solo consulta. |
| 2026-10-09 | ¿Quién puede ver la ficha? | Quien tiene `inventario.consultar` (Administrador, Operador). Se valida en el service, por permiso y nunca por rol. El tab Entregas, incluido el cliente, no exige `pedidos.consultar`. |
| 2026-10-09 | ¿Qué pasa con un producto borrado (borrado lógico)? | La ficha muestra «no encontrado», como el detalle de proveedor. Lo mismo para un id de otra empresa o de un producto que no es terminado. |
| 2026-10-09 | ¿Lleva E2E? | Sí, un recorrido: finalizar una orden, entregar, abrir la ficha y ver el lote, la entrada, la salida y la entrega. Además, un acceso sin permiso que debe ser rechazado. |
| 2026-10-09 | Unidades | Heredado de QC-223 D10/D13: el stock se guarda en la unidad base y se muestra también en envases según el `package_content` de cada lote. |
| 2026-10-09 | Lote → orden que lo produjo | Heredado: se resuelve por el `InventoryMovement` de tipo `production` del lote (`orderId`, `orderPresentationLineId`). Sin migración nueva. |
| 2026-10-09 | Listados largos | Heredado: los tabs de historial se paginan con `lib/shared/pagination.ts` y `DataTable`. |
| 2026-10-09 | Identificadores y borrado | Heredado de QC-150 D10 / QC-4: identificadores en inglés, borrado lógico. |
