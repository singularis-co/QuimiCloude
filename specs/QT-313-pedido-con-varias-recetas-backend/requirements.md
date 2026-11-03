# QT-313 — pedido-con-varias-recetas-backend · requirements.md

> **Zona:** backend · **Complejidad:** high · **depends_on:** — · **Rama:** `feature/QT-313-pedido-con-varias-recetas-backend`
>
> **Alcance.** Hoy un pedido lleva una sola receta (`orders.recipe_id`). Pasa a llevar N líneas.
> Cada línea tiene su propia receta, cantidad, unidad, reparto en presentaciones (QC-170), precio
> de venta, coste y estado. Los pedidos existentes migran a una sola línea, sin perder datos.
> Esta ficha cubre modelo, migración y servicios.
>
> **Lo que NO entra.**
> - La pantalla de alta, edición y consulta con varias recetas va en **QT-314**
>   (`pedido-con-varias-recetas-frontend`).
> - El margen por receta y en total va en **QC-308** (`margen-del-pedido`). Su descripción se
>   revisa cuando se acote.
>
> Sembrado por `/afinar-feature` el 2026-11-03. El bloque de Alcance y la tabla de «Decisiones
> cerradas» los fijó el humano ANTES del spec. `spec_author` los respeta, no los reabre y no los
> reescribe: su trabajo aquí es `## Requisitos (EARS)`.

## Requisitos (EARS)

> Escritos por `spec_author` (F1.2, 2026-11-03). Vocabulario:
> - **Línea**: una receta dentro de un pedido, con su cantidad, unidad, reparto, precio, coste y
>   estado. «Receta» y «línea» son lo mismo visto desde el negocio y desde el modelo.
> - **Línea viva**: no quitada (sin borrado lógico). Una línea cancelada sigue viva: se ve, con su
>   motivo.
> - **Estado editable**: `PENDIENTE`, `EN_CURSO` o `BLOQUEADO`, el mismo conjunto que hoy admite
>   la edición general del pedido.
> - **Estado cancelable**: `PENDIENTE`, `EN_CURSO` o `BLOQUEADO`, el mismo de
>   `order-cancellation.ts`.
> - **P1 a P4** son las cuatro preguntas sembradas, en su orden («Prioridad y cliente»,
>   «Caducidad de la reserva», «Estado del pedido entero», «Avisos QC-293 y QC-294»). P5 a P10 las
>   añade este spec. Un requisito marcado **[depende de Pn]** está escrito con la propuesta de
>   `design.md` y se reescribe si el humano decide otra cosa.
> - Entre corchetes, la fila de `## Decisiones cerradas` que cubre cada requisito.

### Modelo

- **R1** — El sistema DEBE guardar las recetas de un pedido como **líneas** del pedido: cada
  línea lleva su receta, su cantidad (mayor que cero), su unidad, su reparto en presentaciones
  (QC-170), su precio de venta opcional, su coste estimado, su coste real y su estado. El pedido
  NO DEBE guardar receta, cantidad, unidad, reparto, precio ni costes propios.
  *[¿Qué es un pedido con varias fórmulas? · ¿Dónde va el precio de venta?]*
- **R2** — El sistema DEBE guardar las líneas en una tabla propia del módulo `pedidos`, con
  identificadores en inglés, borrado lógico, columna de empresa y las cifras en
  `decimal(14,4)`. La base DEBE rechazar una línea cuya empresa no sea la de su pedido.
  *[Identificadores, cifras y borrado]*
- **R3** — Todo pedido creado o editado por los casos de uso DEBE tener **al menos una** línea
  viva. SI el alta o la edición no trae ninguna línea, ENTONCES el sistema DEBE rechazarla con
  `invalid_input` sin escribir nada. *[¿Qué es un pedido con varias fórmulas?]*
- **R4** — SI el alta o la edición traen dos líneas con la misma receta, o una línea nueva o
  cambiada con la receta de otra línea viva del pedido, ENTONCES el sistema DEBE rechazar la
  operación entera con el código `duplicate_order_recipe` sin escribir nada.
  *[¿Se puede repetir una receta?]* [depende de P9 y P10]
- **R5** — La base de datos DEBE rechazar dos líneas vivas del mismo pedido con la misma
  receta, aunque la escritura no pase por los casos de uso. *[¿Se puede repetir una receta?]*
  [depende de P9]
- **R6** — El sistema DEBE devolver las líneas de un pedido siempre en el mismo orden: el de su
  alta en el pedido. *[¿Qué es un pedido con varias fórmulas?]*

### Migración de los pedidos existentes

- **R7** — CUANDO se aplica la migración, el sistema DEBE crear para cada pedido existente,
  borrados incluidos, **exactamente una** línea con la receta, la cantidad, la unidad, el
  estado, el motivo de cancelación, el coste estimado y su parte de envases, el coste real, el
  precio de venta, la fecha de terminado, el empacador y quien acondiciona que tenía el pedido,
  sin alterar ningún valor (un `NULL` sigue siendo `NULL`). *[¿Qué es un pedido con varias
  fórmulas? · Identificadores, cifras y borrado]*
- **R8** — CUANDO se aplica la migración, el sistema DEBE asociar a esa única línea todo lo que
  hoy cuelga del pedido y pasa a ser de la receta: las líneas del reparto, los asientos de
  reserva, los asientos de consumo, el registro de ejecución, las evidencias de los pasos y el
  equipo de acondicionamiento. El número de filas de cada una de esas tablas DEBE ser el mismo
  antes y después. *[¿Qué es un pedido con varias fórmulas?]*
- **R9** — CUANDO se revierte la migración y algún pedido tiene más de una línea viva, el
  sistema DEBE abortar la reversión sin cambiar nada y nombrar en el error cuántos pedidos lo
  impiden. CUANDO ningún pedido tiene más de una, la reversión DEBE devolver al pedido los
  valores de su línea y dejar la base como estaba antes de la migración.
  *[Identificadores, cifras y borrado]*

### Alta

- **R10** — CUANDO alguien con `pedidos.modificar` registra un pedido con N líneas válidas, el
  sistema DEBE crear el pedido y sus N líneas, calcular el coste estimado de cada línea y
  apartar el material de cada línea, todo en la misma transacción: si cualquiera de esas
  escrituras falla, no queda nada escrito. *[¿Qué es un pedido con varias fórmulas?]*
- **R11** — El sistema DEBE validar cada línea con las mismas reglas que hoy valida el pedido de
  una receta (receta y versión de la empresa, unidad del catálogo, reparto que no supera la
  cantidad, envases existentes) y, SI una línea no las cumple, ENTONCES DEBE rechazar el alta
  entera con el mismo código de hoy e indicar la posición de la línea que falló.
  *[¿Qué es un pedido con varias fórmulas?]*
- **R12** — El sistema DEBE apartar el material de las líneas **en su orden**: una línea compite
  por un insumo compartido con lo que ya apartaron las anteriores del mismo pedido.
  *[¿Cómo avanza el estado?]*
- **R13** — SI el material no alcanza para una o más líneas y la entrada no confirma guardar
  bloqueado, ENTONCES el sistema DEBE rechazar el alta con `order_would_block`, indicar qué
  líneas no alcanzan y no escribir nada. *[¿Cómo avanza el estado?]*
- **R14** — SI el material no alcanza para una o más líneas y la entrada confirma guardar
  bloqueado, ENTONCES el sistema DEBE dejar **solo esas líneas** en `BLOQUEADO`, sin material
  apartado y sin coste estimado, y las demás en `PENDIENTE` con su material apartado.
  *[¿Cómo avanza el estado?]*

### Precio y coste

- **R15** — El sistema DEBE aceptar en cada línea un precio de venta opcional con las reglas de
  QC-307: ausente o vacío es «sin precio», 0 vale y es distinto de vacío, un negativo o un
  decimal mal formado se rechaza con `invalid_input` sin escribir nada. La base DEBE rechazar un
  precio de línea negativo. *[¿Dónde va el precio de venta?]*
- **R16** — El sistema DEBE devolver con cada pedido el **precio total**: la suma exacta, en
  cadena decimal de 4 decimales, de los precios de sus líneas vivas no canceladas que tienen
  precio, y «sin precio» si ninguna lo tiene; y DEBE devolver también cuántas de esas líneas no
  tienen precio. El total NO DEBE guardarse. *[¿Dónde va el precio de venta?]* [depende de P8]
- **R17** — CUANDO se crea una línea o se edita su receta, cantidad, unidad o reparto, el
  sistema DEBE calcular y guardar el coste estimado **de esa línea** con las reglas de hoy
  (QC-151, QC-195), y NO DEBE tocar el coste guardado de las demás líneas.
  *[¿Qué es un pedido con varias fórmulas?]*
- **R18** — El sistema DEBE devolver con cada pedido el coste estimado total y el coste real
  total como suma de los de sus líneas vivas no canceladas, y «sin coste» si alguna de ellas no
  lo tiene. *[¿Qué es un pedido con varias fórmulas?]* [depende de P8]
- **R19** — El sistema NO DEBE incluir el precio de ninguna línea ni el total en los datos que
  `pedidos` entrega a `asignaciones` ni en ninguna salida de `asignaciones`.
  *[¿Dónde va el precio de venta?]*

### Edición

- **R20** — CUANDO se guarda una edición general, el sistema DEBE tratar cada línea de la entrada
  con identificador como la edición de esa línea, cada línea sin identificador como una línea
  nueva, y cada línea viva no cancelada que falte en la entrada como una petición de quitarla.
  *[¿Se pueden añadir o quitar recetas?]*
- **R21** — CUANDO una edición añade una línea a un pedido cuyas otras líneas están en cualquier
  estado, el sistema DEBE crearla en `PENDIENTE` (o en `BLOQUEADO`, con las reglas de R13 y R14)
  y apartar su material, sin cambiar el estado, el material ni el coste de las demás.
  *[¿Se pueden añadir o quitar recetas?]*
- **R22** — CUANDO una edición quita una línea en `PENDIENTE`, el sistema DEBE darla de baja
  (borrado lógico) y liberar todo su material en la misma transacción, con quien edita como
  autor. La línea quitada NO DEBE aparecer en ninguna lectura del pedido.
  *[¿Se pueden añadir o quitar recetas?]* [depende de P9]
- **R23** — SI una edición intenta quitar una línea que no está en `PENDIENTE`, ENTONCES el
  sistema DEBE rechazar la edición entera con el código `order_line_not_removable` sin escribir
  nada. *[¿Se pueden añadir o quitar recetas?]* [depende de P9]
- **R24** — SI una edición cambia algún dato de una línea que no está en un estado editable,
  ENTONCES el sistema DEBE rechazar la edición entera con `invalid_transition` sin escribir nada.
  Una línea en estado no editable que llega sin cambios NO DEBE impedir la edición del resto.
  *[¿Cómo avanza el estado?]*
- **R25** — CUANDO una edición cambia una línea en estado editable, el sistema DEBE volver a
  apartar el material de esa línea y volver a calcular su coste con las reglas de hoy (incluido
  el paso a `BLOQUEADO` o de vuelta a `PENDIENTE`), sin tocar el material, el coste ni el estado
  de las líneas que no cambian. *[¿Cómo avanza el estado?]*
- **R26** — CUANDO se edita el reparto y la unidad de una línea en `POR_EMPACAR` (la edición
  acotada de hoy), el sistema DEBE aplicar las reglas de hoy a esa línea y NO DEBE tocar las
  demás. *[¿Cómo avanza el estado?]*

### Cancelación

- **R27** — CUANDO alguien con `pedidos.modificar` cancela una línea en estado cancelable con un
  motivo de 1 a 500 caracteres una vez recortado, el sistema DEBE dejar esa línea en `CANCELADO`
  con ese motivo y liberar todo su material en la misma transacción, sin cambiar el estado, el
  material ni el coste de las demás líneas. *[¿Se puede cancelar una sola receta?]*
- **R28** — SI la línea que se cancela no está en un estado cancelable, ENTONCES el sistema DEBE
  rechazar con `not_cancellable` sin escribir nada. SI el motivo falta, está vacío o pasa de 500
  caracteres, ENTONCES DEBE rechazar con `invalid_input` sin escribir nada.
  *[¿Se puede cancelar una sola receta?]*
- **R29** — CUANDO se cancela el pedido entero con un motivo válido, el sistema DEBE cancelar con
  ese motivo, en una sola transacción, todas sus líneas en estado cancelable y liberar su
  material; las líneas en otros estados NO DEBEN cambiar. SI ninguna línea está en estado
  cancelable, ENTONCES el sistema DEBE rechazar con `not_cancellable` sin escribir nada.
  *[¿Se puede cancelar una sola receta?]* [depende de P6]
- **R30** — SI quien edita, añade, quita o cancela una línea, o cancela el pedido, no tiene
  `pedidos.modificar`, ENTONCES el sistema DEBE rechazar con `unauthorized` antes de validar la
  entrada y sin leer ni escribir nada. El catálogo de permisos NO DEBE cambiar.
  *[¿Quién es responsable?]*

### Estado de cada receta y del pedido

- **R31** — Cada línea DEBE tener su propio estado y recorrer el mismo flujo y las mismas
  transiciones que hoy recorre el pedido (`PENDIENTE` → `EN_CURSO` → `POR_EMPACAR` →
  `EN_EMPAQUE` → `POR_ACONDICIONAR` → `EN_ACONDICIONAMIENTO` → `TERMINADO` → `ENTREGADO`, con
  `BLOQUEADO` y `CANCELADO`). *[¿Cómo avanza el estado?]*
- **R32** — CUANDO una acción del flujo mueve una línea (abrir, finalizar, comenzar o terminar el
  empaque, comenzar o terminar el acondicionamiento, entregar o anular una entrega, bloquear o
  desbloquear, cancelar), el sistema NO DEBE cambiar el estado de ninguna otra línea del pedido.
  *[¿Cómo avanza el estado?]*
- **R33** — El sistema DEBE devolver con cada pedido un **resumen de avance**: cuántas líneas
  vivas no canceladas tiene y cuántas de ellas están terminadas.
  *[¿Cómo avanza el estado?]* [depende de P7]
- **R34** — El sistema DEBE guardar en el pedido un estado **derivado** de los de sus líneas y
  volver a derivarlo en la misma transacción que cualquier cambio de estado de una línea, para
  que los listados y filtros por estado sigan funcionando. *[¿Cómo avanza el estado?]*
  [depende de P3]

### Ejecución, empaque, acondicionamiento y entrega

- **R35** — Los responsables (operador y empacador) DEBEN seguir asignándose al pedido entero,
  con las reglas de QC-86 sin cambios, y quien es responsable del pedido DEBE poder ejecutar
  cualquiera de sus líneas. *[¿Quién es responsable?]*
- **R36** — CUANDO se finaliza la fabricación de una línea, el sistema DEBE consumir
  exactamente lo apartado para esa línea (o, sin apartado, su necesidad), dar de alta el lote de
  producto terminado de cada línea de su reparto con la receta de esa línea y dejarla en
  `POR_EMPACAR`, en una sola transacción, sin consumir material de otra línea.
  *[¿Cómo avanza el estado?]*
- **R37** — El sistema DEBE asociar a su línea cada asiento de reserva, cada asiento de consumo,
  cada movimiento del registro de ejecución, cada evidencia de un paso y cada miembro del equipo
  de acondicionamiento de un pedido. *[¿Cómo avanza el estado?]*
- **R38** — CUANDO se termina el empaque de una línea, el sistema DEBE calcular y guardar el coste
  real **de esa línea** con los asientos de consumo de esa línea, con las reglas de QC-305.
  *[¿Cómo avanza el estado?]*
- **R39** — CUANDO una entrega completa el reparto de una línea, el sistema DEBE pasar esa línea
  de `TERMINADO` a `ENTREGADO`; CUANDO se anula una entrega, DEBE devolver a `TERMINADO` solo
  las líneas cuyo reparto deja de estar completo. *[¿Cómo avanza el estado?]*
- **R40** — CUANDO entra material, la revisión de bloqueados DEBE revisar cada línea
  `BLOQUEADO` por separado, en el orden de alta de los pedidos y, dentro del pedido, en el de sus
  líneas, y pasar a `PENDIENTE` con su material apartado solo las líneas para las que alcanza.
  *[¿Cómo avanza el estado?]*
- **R41** — CUANDO vence el plazo de la reserva, el sistema DEBE cancelar con el motivo de
  caducidad de hoy las líneas `PENDIENTE` del pedido y liberar su material; las líneas en otros
  estados NO DEBEN cambiar. *[¿Cómo avanza el estado?]* [depende de P2]

### Prioridad, cliente y avisos

- **R42** — El sistema DEBE seguir guardando la prioridad y el cliente en el pedido, con las
  reglas de hoy, y aplicarlos a todas sus líneas. *[¿Quién es responsable?]* [depende de P1]

### Ámbito, compatibilidad y verificación

- **R43** — SI una operación nombra una línea de otra empresa, de otro pedido o quitada,
  ENTONCES el sistema DEBE responder igual que con un pedido inexistente (`order_not_found`)
  sin leer ni escribir datos de esa línea. *[Identificadores, cifras y borrado]*
- **R44** — MIENTRAS la pantalla de pedidos siga enviando una sola receta (antes de QT-314), el
  sistema DEBE tratar esa entrada como un pedido de una sola línea y devolver a la pantalla los
  mismos datos que hoy. *[¿Una ficha o dos?]*
- **R45** — MIENTRAS un pedido tenga una sola línea, las salidas de `asignaciones`, de
  `inventario` (producto terminado, entregas) y del contexto de chat de `integraciones` DEBEN
  ser las mismas que hoy para ese pedido. *[¿Una ficha o dos?]*
- **R46** — Un recorrido E2E DEBE registrar un pedido por la pantalla actual, abrirlo y
  finalizarlo como operador y comprobar que el material apartado y consumido y el lote de
  producto terminado son los mismos que antes de esta ficha; y un test de integración contra la
  base DEBE recorrer un pedido de **dos** líneas que comparten un insumo (alta, cancelar una
  línea, finalizar la otra) y comprobar lote a lote lo apartado, lo liberado y lo consumido.
  *[¿Hace falta E2E?]* [depende de P5]

### Baja del pedido

- **R47** — CUANDO se da de baja un pedido con las reglas de baja de hoy, el sistema DEBE dar de
  baja también todas sus líneas y liberar su material en la misma transacción. Ninguna línea de
  un pedido dado de baja DEBE aparecer en una lectura. *[Identificadores, cifras y borrado]*

### Cobertura de la tabla de decisiones

| Decisión (fila) | Requisitos |
|---|---|
| ¿Qué es un pedido con varias fórmulas? | R1, R3, R6, R7, R8, R10, R11, R17, R18 |
| ¿Cómo avanza el estado? | R12, R13, R14, R24, R25, R26, R31, R32, R33, R34, R36, R37, R38, R39, R40, R41 |
| ¿Dónde va el precio de venta? | R1, R15, R16, R19 |
| ¿Quién es responsable? | R30, R35, R42 |
| ¿Se puede cancelar una sola receta? | R27, R28, R29 |
| ¿Se pueden añadir o quitar recetas? | R20, R21, R22, R23 |
| ¿Se puede repetir una receta? | R4, R5 |
| ¿Una ficha o dos? | R44, R45 |
| Identificadores, cifras y borrado | R2, R7, R9, R43, R47 |
| ¿Hace falta E2E? | R46 |

La pregunta P4 (avisos QC-293 y QC-294) no tiene requisito aquí: las dos fichas están `pending`
y no hay aviso implementado que cambiar. La decide quien las acote (`design.md > 9`).

## Preguntas abiertas

- **Prioridad y cliente:** ¿son del pedido o de cada receta? No se preguntó al acotar.
- **Caducidad de la reserva** (15 días, `orders.reserved_at`): ¿cuenta por receta o por pedido?
- **Estado del pedido entero:** ¿cómo se deriva de los estados de sus recetas, para listados y
  filtros?
- **Avisos QC-293 y QC-294** (pedido asignado y listo, pedido bloqueado): ¿se mandan por receta
  o por pedido?

### Añadidas por spec_author (F1.2, 2026-11-03)

Cada una lleva una propuesta en `design.md`; ninguna está decidida.

- **P5 — Pantallas de planta con varias recetas.** QT-314 cubre alta, edición y consulta del
  pedido. ¿Qué ficha lleva la ejecución del operador (`/asignacion/[id]`), el empaque, el
  acondicionamiento y la entrega de un pedido con varias líneas, donde hay que elegir la receta?
  Sin esas pantallas, un pedido de dos recetas no se puede fabricar desde la aplicación, y el E2E
  de R46 solo puede recorrer uno de una. Propuesta: ficha frontend nueva en la épica QC-31.
- **P6 — Cancelar el pedido con recetas ya fabricadas y sin terminar.** Una receta en
  `POR_EMPACAR`, `EN_EMPAQUE`, `POR_ACONDICIONAR` o `EN_ACONDICIONAMIENTO` no está terminada pero
  hoy no se cancela (su material ya se consumió). La decisión dice «cancelar el pedido cancela
  todas las que no estén terminadas». ¿Esas quedan intactas, o se rechaza la cancelación del
  pedido entero? Propuesta: quedan intactas (R29).
- **P7 — Qué cuenta como «terminada»** en el resumen «1 de 2 terminadas»: ¿`TERMINADO`,
  `ENTREGADO` o los dos? ¿Las canceladas cuentan en el total? Propuesta: `TERMINADO` y `ENTREGADO`
  cuentan como terminadas; las canceladas no cuentan en ningún lado (R33).
- **P8 — Sumas con huecos.** ¿El precio total suma las recetas canceladas? ¿Y si alguna receta
  no tiene precio, o no tiene coste? Propuesta: canceladas fuera; el precio suma lo que hay y
  dice cuántas faltan (R16); el coste total queda «sin coste» si falta alguno, porque un coste
  parcial parecería completo (R18).
- **P9 — Quitar y repetir.** ¿Una receta `BLOQUEADO` se puede quitar (tampoco ha empezado)? ¿Una
  receta cancelada impide volver a añadir la misma receta al pedido? Propuesta: solo se quita la
  `PENDIENTE`, como dice la decisión; la cancelada sigue ocupando su receta (R4, R5, R22, R23).
- **P10 — Versiones de receta.** ¿La receta original y una versión suya (QC-172
  `versiones-de-receta`, `recipes.parent_recipe_id`) cuentan como la misma receta para la regla de no repetir?
  Propuesta: no; se compara la receta efectiva que se fabrica (R4).

## Decisiones cerradas (no reabrir)

| Fecha | Pregunta | Decisión |
|---|---|---|
| 2026-11-03 | ¿Qué es un pedido con varias fórmulas? | **Líneas dentro del pedido.** Un pedido tiene N recetas, y cada una lleva su cantidad, su unidad y su reparto en presentaciones (QC-170). No es un pedido que agrupa pedidos. |
| 2026-11-03 | ¿Cómo avanza el estado? | **Cada receta avanza por su lado.** Una puede estar Terminada mientras otra sigue En curso. El pedido muestra un resumen (por ejemplo «1 de 2 terminadas»). |
| 2026-11-03 | ¿Dónde va el precio de venta? | **En cada receta.** El pedido muestra la suma. Enmienda QC-307, que lo tenía por pedido entero. |
| 2026-11-03 | ¿Quién es responsable? | **Los responsables (operador y empacador) son del pedido entero.** La asignación de QC-86 no cambia. |
| 2026-11-03 | ¿Se puede cancelar una sola receta? | **Sí, con motivo,** y eso libera su material. Cancelar el pedido cancela todas las recetas que no estén terminadas. |
| 2026-11-03 | ¿Se pueden añadir o quitar recetas con otras ya en producción? | **Añadir sí.** Quitar solo si esa receta sigue Pendiente; si no, se cancela. |
| 2026-11-03 | ¿Se puede repetir una receta en el mismo pedido? | **No:** cada receta aparece una sola vez por pedido. Las presentaciones distintas las cubre el reparto (QC-170). |
| 2026-11-03 | ¿Una ficha o dos? | **Dos:** backend (ésta, QT-313) y frontend (QT-314, bloqueada por ésta). |
| 2026-11-03 | Identificadores, cifras y borrado | Heredado: identificadores en inglés y borrado lógico (QC-4), decimal exacto (QC-4, QC-141) y ámbito por empresa (QC-60). |
| 2026-11-03 | ¿Hace falta E2E? | **Sí:** la feature mueve inventario (`CHECKPOINTS.md`, igual que QC-170). |
