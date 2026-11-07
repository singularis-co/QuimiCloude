# QT-314 — pedido-con-varias-recetas-frontend · requirements.md

> **Zona:** fullstack · **Complejidad:** medium · **depends_on:** QT-313 · **Rama:** `feature/QT-314-pedido-con-varias-recetas-frontend`
>
> **Alcance.** La pantalla de Pedidos pasa a trabajar con pedidos de varias recetas.
> - **Alta y edición.** El panel del pedido muestra una tabla de recetas, y cada receta se añade o se edita en un sub-panel propio.
> - **Consulta.** Un panel de detalle, de solo lectura, muestra el avance, los totales y cada receta con su estado.
> - **Listado.** Hay una fila por pedido, con un resumen de sus recetas, el avance y los totales.
> - **Acciones de una receta.** Cancelar con motivo, «Reparto y unidad» y Entregar, ver y anular entregas se lanzan desde el menú de la fila, eligiendo primero la receta.
> - **Piezas de `lib/` que hereda de QT-313** (design § 4.1.1 y § 7):
>   - renombrar los esquemas de líneas a sus nombres finales y borrar los planos;
>   - quitar el puente de una sola receta de `order-actions.ts`;
>   - añadir las acciones de servidor por receta;
>   - devolver en qué receta falla un alta o una edición.
>
> **Lo que NO entra.**
> - Las pantallas de planta con varias recetas (ejecución del operador, empaque y acondicionamiento) y el E2E de punta a punta de un pedido de dos recetas por planta van en **QT-315** (`planta-con-varias-recetas`).
> - El margen por receta y en total va en **QC-308** (`margen-del-pedido`).
> - Los responsables, el cliente y la prioridad siguen siendo del pedido entero, con sus pantallas de hoy. Solo cambia su habilitación en `PARCIAL`.
>
> Sembrado por `/afinar-feature` el 2026-11-06. El bloque de Alcance y la tabla de «Decisiones cerradas» los fijó el humano ANTES del spec. `spec_author` los respeta, no los reabre y no los reescribe: su trabajo aquí es `## Requisitos (EARS)`.

## Requisitos (EARS)

> Escritos por `spec_author` (F1.2, 2026-11-06). Vocabulario, el de QT-313:
> - **Receta**: una línea del pedido, con su cantidad, unidad, reparto, precio, coste y estado.
> - **Receta activa**: viva y no cancelada. Una receta cancelada sigue viva: se ve, con su motivo.
> - **Estado editable**: `PENDIENTE`, `EN_CURSO` o `BLOQUEADO`.
> - **Estado cancelable**: `PENDIENTE`, `EN_CURSO` o `BLOQUEADO`.
> - **Se puede quitar**: una receta nueva del borrador, o una guardada en `PENDIENTE` o `BLOQUEADO`.
> - **Terminada**: `TERMINADO` o `ENTREGADO`.
> - **Misma receta**: la misma original, o la original y una de sus versiones, o dos versiones de
>   la misma original.
> - **Panel**: el panel lateral del pedido (alta y edición). **Sub-panel**: el de una receta.
>   **Detalle**: el panel de consulta, de solo lectura.
> - **Tablero**: `docs/diseno/canvas/PedidosVariasRecetas*.dc.html`, aprobado el 2026-11-06.
> - `(lib)` marca los requisitos que se cumplen en `lib/` (los hace `backend_dev`).
> - Entre corchetes, la fila de `## Decisiones cerradas` que cubre cada requisito.

### Alta y edición: panel con tabla de recetas y sub-panel

- **R1** — CUANDO alguien con `pedidos.modificar` abre «Nuevo pedido», el sistema DEBE mostrar un
  panel con el cliente, la prioridad, la tabla de recetas vacía con el aviso «El pedido aún no tiene
  recetas. Añade al menos una.», el botón «Añadir receta» y «Guardar pedido» deshabilitado.
  *[Forma del formulario · Pase `/design`]*
- **R2** — La tabla de recetas del panel DEBE mostrar, por receta y en el orden del pedido, la
  fórmula, el reparto resumido, la cantidad con su unidad, el precio, el estado y, si la receta se
  puede editar, el botón «Editar»; y debajo de la tabla, el total del precio y el coste estimado del
  pedido. *[Forma del formulario]*
- **R3** — CUANDO se pulsa «Añadir receta» o el «Editar» de una receta, el sistema DEBE abrir el
  sub-panel encima del panel, con la imagen, la receta, la versión, la cantidad, la unidad, el
  reparto, el precio de venta, la cotización y los insumos de esa receta, y los botones «Descartar»
  y «Aplicar». Al editar, los campos DEBEN venir con los valores de esa receta. *[Forma del
  formulario]*
- **R4** — CUANDO se pulsa «Aplicar» y los campos de la receta pasan la validación del esquema de
  una receta del contrato, el sistema DEBE cerrar el sub-panel y dejar la receta en la tabla: al
  final si es nueva, en su sitio si se editaba. SI algún campo no la pasa, ENTONCES el sistema DEBE
  marcar ese campo con su error, sin cerrar el sub-panel y sin perder lo escrito.
  *[Forma del formulario]*
- **R5** — CUANDO se pulsa «Descartar» o «Volver al pedido» en el sub-panel, el sistema DEBE
  cerrarlo y dejar la tabla como estaba antes de abrirlo. *[Forma del formulario]*
- **R6** — El sistema NO DEBE escribir nada en la base al añadir, editar o quitar una receta en el
  panel: solo cambia el borrador. CUANDO se cierra el panel sin «Guardar pedido», el borrador DEBE
  perderse y el pedido DEBE quedar como estaba. *[Forma del formulario]*
- **R7** — CUANDO se pulsa «Guardar pedido», el sistema DEBE enviar en una sola operación el
  cliente, la prioridad y todas las recetas no canceladas de la tabla, en su orden: las guardadas
  con su identificador y las nuevas sin él. CUANDO la operación termina bien, el sistema DEBE cerrar
  el panel, avisar con un toast y refrescar el listado. *[Forma del formulario · Esquemas de entrada]*
- **R8** — El sub-panel NO DEBE dejar aplicar una receta que es la misma receta que otra receta
  activa de la tabla, y DEBE decir por qué. SÍ DEBE dejar aplicar una receta cuya única otra
  aparición en la tabla está cancelada. *[Reglas de negocio de las recetas]*
- **R9** — MIENTRAS el estado del pedido no sea `ENTREGADO` ni `CANCELADO`, `PARCIAL` incluido, el
  sistema DEBE ofrecer «Editar» habilitado en el menú de la fila y en el detalle. En `ENTREGADO` y en
  `CANCELADO`, «Editar» DEBE estar deshabilitado. *[¿Cuándo se puede pulsar Editar?]*
- **R10** — En la edición, una receta guardada en un estado no editable DEBE salir en la tabla en
  solo lectura, con la marca «Solo lectura» y sin «Editar» ni «Quitar receta», y DEBE enviarse sin
  cambios al guardar. «Añadir receta» DEBE estar disponible en cualquier estado en que se pueda
  pulsar «Editar». *[¿Cuándo se puede pulsar Editar?]*
- **R11** — El sub-panel DEBE ofrecer «Quitar receta» solo para una receta que se puede quitar.
  CUANDO se pulsa, la receta DEBE salir de la tabla. Para una receta guardada en `EN_CURSO`, el
  sub-panel NO DEBE ofrecerlo. *[Reglas de negocio de las recetas]*
- **R12** — Una receta cancelada DEBE salir en la tabla en solo lectura y NO DEBE sumar al total ni
  al coste estimado del panel. MIENTRAS la tabla no tenga ninguna receta no cancelada, el sistema
  DEBE mostrar el aviso de R1 y mantener «Guardar pedido» deshabilitado.
  *[Reglas de negocio de las recetas · Forma del formulario]*
- **R13** — El precio de venta del sub-panel DEBE seguir las reglas de QC-307: vacío es «sin
  precio», 0 es válido, y un negativo o un decimal mal formado se marca sin aplicar. El total del
  panel DEBE ser la suma exacta de los precios de las recetas no canceladas que lo tienen, y DEBE
  decir cuántas no lo tienen. *[Reglas de negocio de las recetas]*
- **R14** — CUANDO el sub-panel cotiza una receta guardada, el sistema DEBE pedir la cotización con
  el identificador de esa receta, de modo que lo apartado por ella cuente como disponible y lo
  apartado por las demás recetas del pedido no. Una receta nueva DEBE cotizarse sin identificador.
  *[Forma del formulario]*

### Errores por receta

- **R15** (lib) — SI el alta o la edición se rechazan porque una o varias recetas incumplen una
  regla de receta, ENTONCES la respuesta DEBE traer el código y el mensaje del catálogo de hoy y,
  además, las posiciones de esas recetas en la lista enviada (desde 0, de menor a mayor y sin
  repetir). Son reglas de receta: la validación de QT-313 R11, la falta de material sin confirmar de
  QT-313 R13, la falta de material en una receta en curso, el cambio de una receta no editable y la
  receta repetida (QT-313 R4). La respuesta NO DEBE traer el diagnóstico.
  *[Errores por receta]*
- **R16** (lib) — Las respuestas de error de las demás operaciones de `pedidos` y de los demás
  módulos NO DEBEN cambiar de forma, y la lista cerrada de campos de `ErrorState` DEBE quedar igual.
  *[Errores por receta]*
- **R17** — CUANDO el alta o la edición vuelven con posiciones, el panel DEBE mostrar un aviso que
  nombra cada receta con su número en la tabla, por ejemplo «No alcanza el material para Suavizante
  (receta 4).», y DEBE marcar su fila. CUANDO el código es `order_would_block`, el aviso DEBE ofrecer
  «Guardar bloqueada», que reenvía el mismo pedido confirmando que se guarde bloqueado, y «Revisar
  receta», que cierra el aviso sin enviar. *[Errores por receta]*

### Consulta: panel de detalle

- **R18** — CUANDO alguien con `pedidos.consultar` pulsa el número de un pedido o «Ver detalle», el
  sistema DEBE abrir un panel de detalle de solo lectura con el número, el cliente, la fecha de
  solicitud, el estado, la prioridad, el avance «N de M terminadas» con su barra, el precio total
  con el aviso «N sin precio», el coste estimado total, el coste real total, los responsables y una
  fila por receta con su nombre, estado, cantidad y unidad, reparto, precio, coste estimado, coste
  real y, si está cancelada, el motivo. *[¿Dónde se consulta un pedido? · Listado con varias recetas]*
- **R19** — El detalle NO DEBE ofrecer ningún control que cambie el pedido salvo «Editar», que
  sigue R9. *[¿Dónde se consulta un pedido?]*

### Listado

- **R20** — El listado DEBE tener una fila por pedido. En la columna de la fórmula DEBE mostrar la
  primera receta del pedido y, si tiene más, «+N más», donde N es el número de recetas del pedido
  menos una. *[Listado con varias recetas]*
- **R21** — El listado DEBE tener una columna de avance con «F de T» y su barra, donde T es el
  número de recetas activas y F el de las terminadas. *[Listado con varias recetas]*
- **R22** — Las columnas de precio de venta, coste estimado y coste real DEBEN mostrar los totales
  del pedido. SI alguna receta activa no tiene precio, ENTONCES la celda del precio DEBE añadir el
  aviso «N sin precio». SI el total no existe («sin precio» o «sin coste»), ENTONCES la celda DEBE
  mostrar el marcador de ausencia. *[Listado con varias recetas]*
- **R23** — El listado y la tarjeta del teléfono NO DEBEN tener la columna Presentación. El reparto
  de cada receta se ve en el detalle (R18). *[Listado con varias recetas]*
- **R24** — La pantalla de Pedidos NO DEBE pintar ningún dato de una receta (nombre, imagen,
  versión, cantidad, unidad, reparto, precio o coste) a partir de los campos del pedido que copian
  la primera receta: los saca de las recetas del pedido o de sus totales.
  *[Listado con varias recetas · Esquemas de entrada]*

### Acciones de una receta, desde el menú de la fila

- **R25** — El menú de la fila DEBE agrupar las acciones en tres bloques, en este orden: las del
  pedido («Ver detalle», «Editar», «Responsables», «Cliente»); las de una receta, bajo el rótulo
  «Por receta» («Reparto y unidad…», «Entregar…», «Entregas…», «Cancelar receta…»); y las del
  pedido entero, bajo el rótulo «Pedido entero» («Cancelar pedido», «Eliminar»).
  *[Acciones de una sola receta · Pase `/design`]*
- **R26** — El sistema DEBE pintar cada acción de una receta solo SI quien mira tiene su permiso y
  al menos una receta del pedido la admite: «Reparto y unidad…» con `pedidos.modificar` y una
  receta en `POR_EMPACAR`; «Entregar…» con `entregas.modificar` y una receta en `TERMINADO`;
  «Entregas…» con una receta en `TERMINADO` o `ENTREGADO`; «Cancelar receta…» con
  `pedidos.modificar` y una receta en estado cancelable.
  *[Acciones de una sola receta · Entregas desde Pedidos · Permisos]*
- **R27** — CUANDO se elige una acción de una receta, el sistema DEBE abrir un selector con todas
  las recetas del pedido, cada una con su nombre, su estado, su cantidad y su reparto. Las que no
  admiten la acción DEBEN salir deshabilitadas y con el motivo. CUANDO se elige una receta
  habilitada, el sistema DEBE abrir el diálogo o el panel de esa acción para esa receta.
  *[Acciones de una sola receta]*
- **R28** — CUANDO se confirma «Cancelar la receta» con un motivo de 1 a 500 caracteres, el sistema
  DEBE cancelar solo esa receta, avisar con un toast y refrescar el listado. El diálogo DEBE nombrar
  la receta y el pedido. SI el servidor rechaza, ENTONCES el diálogo DEBE mostrar el mensaje del
  catálogo sin cerrarse y sin perder el motivo escrito.
  *[Acciones de una sola receta · Reglas de negocio de las recetas]*
- **R29** (lib) — La acción de servidor de cancelar una receta DEBE recibir el pedido, la receta y
  el motivo, llamar al caso de uso `cancelOrderLine` y devolver éxito o el error del catálogo
  (`not_cancellable`, `invalid_input`, `unauthorized`, `order_not_found`). SI falta el pedido o la
  receta, ENTONCES DEBE responder `invalid_input` sin llamar al caso de uso.
  *[Acciones de una sola receta]*
- **R30** — CUANDO se abre «Reparto y unidad» de una receta, el diálogo DEBE venir con el reparto,
  la unidad y la cantidad de esa receta, y al guardar DEBE enviar el identificador de esa receta.
  Las demás recetas NO DEBEN cambiar. *[Acciones de una sola receta]*
- **R31** (lib) — La acción de servidor de «Reparto y unidad» DEBE tomar la receta de su entrada y
  NO DEBE rechazar un pedido por tener más de una receta. *[Esquemas de entrada]*
- **R32** — CUANDO se abre «Entregar» de una receta, el panel de entrega DEBE mostrar el nombre y la
  imagen de esa receta y solo su reparto, y DEBE registrar la entrega de esa receta, también con el
  pedido en `PARCIAL`. *[Entregas desde Pedidos con varias recetas]*
- **R33** (lib) — La lectura de lo que queda por entregar DEBE recibir la receta. SI la receta está
  en `TERMINADO`, ENTONCES DEBE devolver solo el reparto de esa receta, sea cual sea el estado del
  pedido. SI no está en `TERMINADO`, ENTONCES DEBE rechazar con `action_not_allowed`. SI la receta no
  es de ese pedido, es de otra empresa o está quitada, ENTONCES DEBE responder `order_not_found`.
  *[Entregas desde Pedidos con varias recetas]*
- **R34** — CUANDO se abre «Entregas» de una receta, la lista DEBE mostrar solo lo entregado de esa
  receta. El sistema DEBE ofrecer «Anular» SI quien mira tiene `entregas.anular` y la receta está en
  `TERMINADO` o `ENTREGADO`, también con el pedido en `PARCIAL`.
  *[Entregas desde Pedidos con varias recetas]*
- **R35** (lib) — La lectura de las entregas de un pedido DEBE recibir la receta y devolver solo
  las líneas de entrega del reparto de esa receta, solo las entregas que tienen alguna de ellas, y
  el estado de la receta. *[Entregas desde Pedidos con varias recetas]*

### Pedido entero, responsables y cliente

- **R36** — El sistema DEBE habilitar «Cancelar pedido» SI al menos una receta activa está en
  estado cancelable, y deshabilitarlo si no. El diálogo DEBE nombrar las recetas que se cancelan y
  las que se quedan como están. *[Reglas de negocio de las recetas · Acciones de una sola receta]*
- **R37** — El sistema DEBE habilitar «Eliminar» SI el pedido y todas sus recetas vivas están en un
  estado que la baja de hoy admite, con la misma regla que aplica el servidor, y deshabilitarlo si
  no. *[Reglas de negocio de las recetas]*
- **R38** — «Responsables» DEBE seguir abierto en cualquier estado. MIENTRAS el pedido esté en
  `PARCIAL`, el panel de responsables DEBE ofrecer sus controles de escritura SI al menos una receta
  activa está en `PENDIENTE`, `EN_CURSO` o `BLOQUEADO`, y no ofrecerlos si no; y «Cliente» DEBE
  estar habilitado. En los demás estados, los dos DEBEN seguir como hoy. La prioridad se cambia con
  «Editar» (R9). *[Alcance: responsables, cliente y prioridad · Reglas de negocio de las recetas ·
  ¿Cuándo se puede pulsar Editar?]*
- **R39** — El sistema DEBE pintar el estado de un pedido `PARCIAL` como «Parcial» con el tono
  `progress`, y el estado de cada receta con la misma etiqueta y el mismo tono que ese estado tiene
  en un pedido, en el listado, la tarjeta, el panel, el detalle y el selector.
  *[Reglas de negocio de las recetas]*

### Contrato de entrada (piezas de `lib/` heredadas de QT-313)

- **R40** (lib) — El contrato de `pedidos` DEBE publicar los esquemas de entrada con sus nombres
  finales: `createOrderSchema` y `updateOrderSchema` (un pedido con `lines`), `cancelOrderLineSchema`
  y `updateOrderDistributionSchema` (con `lineId`). NO DEBEN existir los esquemas planos de una
  receta ni los nombres provisionales `createOrderWithLinesSchema`, `updateOrderWithLinesSchema` y
  `updateOrderLineDistributionSchema`. *[Esquemas de entrada]*
- **R41** (lib) — Las acciones de servidor de alta y de edición DEBEN entregar al caso de uso las
  recetas tal como llegan, y NO DEBEN rechazar un pedido por su número de recetas ni leer sus
  recetas para completar la entrada. *[Esquemas de entrada]*

### Permisos

- **R42** — El sistema NO DEBE añadir ningún permiso al catálogo. El listado y el detalle DEBEN
  exigir `pedidos.consultar`; el alta, la edición, quitar una receta, cancelar una receta, cancelar
  el pedido y «Reparto y unidad» DEBEN exigir `pedidos.modificar` en el servidor, y la acción de
  servidor nueva (R29) DEBE rechazar con `unauthorized` sin ese permiso. Lo que la pantalla pinta o
  esconde según el permiso sigue como hoy, más R26 para las acciones de una receta. *[Permisos]*
- **R43** — El precio de una receta y el total del pedido DEBEN pintarse solo en la pantalla de
  Pedidos y sus paneles, que exigen `pedidos.consultar`, y NO DEBEN aparecer en las pantallas de
  `asignaciones`. *[Permisos]*

### Plataformas y animación (tablero aprobado)

- **R44** — En teléfono, el sistema DEBE mostrar el listado en tarjetas con la primera receta, el
  «+N más», la barra de avance y los botones «Ver detalle» y «Acciones»; el panel, el sub-panel y
  el detalle DEBEN ocupar la pantalla entera y el sub-panel DEBE volver al panel con la flecha; la
  tabla de recetas del panel DEBE pasar a tarjetas; y el selector de receta DEBE ser un diálogo
  centrado con opciones de al menos 52 px de alto. *[Pase `/design`]*
- **R45** — En tablet, la tabla del listado DEBE desplazarse en horizontal dentro de su caja y el
  panel y el sub-panel DEBEN apilarse a la derecha. *[Pase `/design`]*
- **R46** — El sub-panel DEBE entrar encima del panel con la misma curva y duración que el panel,
  el aviso de error por receta DEBE entrar con la animación de los avisos, y la barra de avance DEBE
  animar el cambio de ancho. *[Pase `/design`]*

### Dependencias y verificación

- **R47** — La feature NO DEBE añadir ninguna dependencia a `package.json`. *[¿Librería nueva?]*
- **R48** — Un recorrido E2E por Pedidos DEBE dar de alta un pedido de dos recetas con precio,
  reabrirlo en el detalle y comprobar el avance y los totales, cancelar una de las recetas y
  comprobar que su material queda libre y que deja de sumar, y añadir otra receta con «Editar».
  *[¿Hace falta E2E?]*
- **R49** — Los E2E de pedidos que ya existen DEBEN pasar con la pantalla nueva, adaptados a ella
  y sin perder lo que comprobaban. *[¿Hace falta E2E?]*

### Lo que deja de aplicar de QT-313

QT-313 R44 (la pantalla manda una sola receta) y R54 (`PARCIAL` como estado final en la pantalla)
dejan de aplicar con esta ficha. Los sustituyen R7, R41 (R44) y R9, R26, R36, R38 (R54). Sus tests
se retiran o se reescriben a los requisitos nuevos (`tasks.md`).

### Cobertura de la tabla de decisiones

| Decisión (fila) | Requisitos |
|---|---|
| Forma del formulario de alta y edición | R1, R2, R3, R4, R5, R6, R7, R12, R14 |
| ¿Dónde se consulta un pedido? | R18, R19 |
| Listado con varias recetas | R18, R20, R21, R22, R23, R24 |
| Acciones de una sola receta | R25, R26, R27, R28, R29, R30, R36 |
| ¿Cuándo se puede pulsar Editar? | R9, R10, R38 |
| Entregas desde Pedidos con varias recetas | R26, R32, R33, R34, R35 |
| Errores por receta | R15, R16, R17 |
| Esquemas de entrada | R7, R24, R31, R40, R41 |
| Reglas de negocio de las recetas | R8, R11, R12, R13, R28, R36, R37, R38, R39 |
| Permisos | R26, R42, R43 |
| ¿Hace falta E2E? | R48, R49 |
| ¿Librería nueva? | R47 |
| Pase `/design` | R1, R25, R44, R45, R46 |

## Preguntas abiertas

- **P1** — ¿Se borran de `OrderView` los campos planos que copian la primera receta (`recipeId`,
  `recipeName`, `recipeVersion`, `recipeImageUrl`, `quantity`, `unitId`, `unitLabel`,
  `presentationLines`, `salePrice`, `ingredientsCost`, `packagingCost`, `actualCost`)? QT-313 § 7 los
  dejó para la pantalla de una receta. La fila «Esquemas de entrada» manda quitar el puente de
  `order-actions.ts`, pero no dice nada de esta lectura. **Recomendación: sí, en esta ficha**
  (`tasks.md` T17). Hoy solo los leen la pantalla de Pedidos y sus tests. Si se quedan, sirven para
  volver a pintar la primera receta como si fuera el pedido, que es justo lo que R24 prohíbe. Si la
  respuesta es no, T17 sale del plan y R24 se verifica solo con tests.
- **P2** — En un pedido sin ninguna receta editable (todas terminadas, por ejemplo), «Guardar
  pedido» sin añadir receta lo rechaza el servidor con `invalid_transition` (QT-313, `planEdit`).
  También lo rechaza si solo cambia la prioridad. ¿El panel avisa antes de enviar? **Recomendación:
  no.** El panel muestra el mensaje del catálogo, como hoy con cualquier rechazo, y no se añade
  ninguna regla de «sin cambios» en la pantalla.
- **P3** — El tablero no coincide con la decisión en dos detalles del listado. Rotula la columna
  «Recetas» y escribe «+N»; la decisión dice «En Fórmula, la primera receta y "+N más"». Además, no
  pinta la columna «Motivo de cancelación», y la decisión solo quita Presentación. **Recomendación:
  seguir la decisión escrita**: la columna se llama «Fórmula», el texto es «+N más» y «Motivo de
  cancelación» se queda. Así está escrito R20.

## Decisiones cerradas (no reabrir)

| Fecha | Pregunta | Decisión |
|---|---|---|
| 2026-11-06 | Forma del formulario de alta y edición | **B · Tabla + sub-panel.** El panel del pedido tiene el cliente, la prioridad, una tabla de recetas (fórmula, reparto resumido, cantidad, precio, estado, editar) y el total. «Añadir receta» o «Editar» abre un sub-panel con fórmula, versión, cantidad, unidad, reparto, precio, cotización e insumos de esa receta, más «Quitar receta» y «Aplicar». Nada se guarda hasta «Guardar pedido». Se eligió viendo las tres opciones con 5 recetas en el lienzo https://claude.ai/artifact/G1MVH6f21QwVJF71Gu4M1i. |
| 2026-11-06 | ¿Dónde se consulta un pedido? | **Panel de detalle de solo lectura**, que hoy no existe: datos del pedido, «N de M terminadas», totales y una fila por receta con estado, cantidad, reparto, precio, costes y el motivo si está cancelada. |
| 2026-11-06 | Listado con varias recetas | **Una fila por pedido.** En Fórmula, la primera receta y «+N más». Columna nueva de avance («1 de 2»). Precio, costo estimado y costo real pasan a ser los totales del pedido, con un aviso «N sin precio». La columna Presentación sale del listado y se ve en el detalle. |
| 2026-11-06 | Acciones de una sola receta | **Desde el menú de la fila del listado, eligiendo primero la receta.** Son: cancelar receta con motivo, «Reparto y unidad» (receta en `POR_EMPACAR`), Entregar y Entregas/Anular entrega. Solo se ofrecen las recetas cuyo estado admite esa acción. |
| 2026-11-06 | ¿Cuándo se puede pulsar Editar? | **En cualquier estado salvo Entregado y Cancelado**, `PARCIAL` incluido. Las recetas en un estado no editable salen en solo lectura (sin «Editar» ni «Quitar») y siempre se puede añadir una receta. Sustituye para la pantalla la regla de QT-313 R54, que trataba `PARCIAL` como cerrado. |
| 2026-11-06 | Entregas desde Pedidos con varias recetas | **Entran en QT-314:** Entregar, Entregas y Anular entrega desde Pedidos, por receta. Se entrega una receta Terminada aunque el pedido esté `PARCIAL`. QT-315 se queda con las pantallas de planta. |
| 2026-11-06 | Errores por receta | **El aviso nombra la receta**, por ejemplo «No alcanza el material para Suavizante (receta 4)», y su fila queda marcada. **Reabre la decisión de QT-313 «Posición de la línea solo en el diagnóstico»:** la respuesta del alta y de la edición devuelve la posición de las recetas que fallan (R11 y R13 de QT-313). Es un cambio de `lib/` dentro de esta ficha. |
| 2026-11-06 | Esquemas de entrada | Heredado de QT-313 (design § 4.1.1, fila «Esquemas planos»): **esta ficha renombra `createOrderWithLinesSchema`, `updateOrderWithLinesSchema` y `updateOrderLineDistributionSchema` a sus nombres finales, borra los planos y quita `requireSingleLineIdOf` y el puente de una receta de `order-actions.ts`.** También deja de aplicar QT-313 R44, porque la pantalla ya envía N recetas. |
| 2026-11-06 | Reglas de negocio de las recetas | Heredadas de QT-313, sin reabrir: quitar solo en Pendiente o Bloqueado (si no, se cancela); una receta no se repite en el pedido (las versiones cuentan como la misma); la cancelada no suma ni cuenta; el precio sigue las reglas de QC-307; «Parcial» con tono `progress`; responsables, cliente y prioridad del pedido entero. |
| 2026-11-06 | Permisos | Heredado: `pedidos.consultar` para ver y `pedidos.modificar` para alta, edición, quitar y cancelar. El Operador no ve precios (QC-307). **No nace ningún permiso nuevo.** |
| 2026-11-06 | ¿Hace falta E2E? | **Sí:** hay importes y movimientos de inventario (`CHECKPOINTS.md`). Un recorrido por Pedidos: alta de un pedido de dos recetas con precio; reabrirlo y ver avance y totales; cancelar una receta; añadir otra. Los E2E de pedidos que existen se adaptan a la pantalla nueva. |
| 2026-11-06 | ¿Librería nueva? | **No.** Se reutilizan los patrones de la pantalla (`FormSheet`, `order-distribution-field.tsx`, filas de `recipe-lines-field.tsx`). |
| 2026-11-06 | Pase `/design` | **Aprobado por el humano el 2026-11-06.** Tableros `docs/diseno/canvas/PedidosVariasRecetas.dc.html` (escritorio, interactivo: listado, detalle, editar y nuevo con sub-panel, selector de receta, cancelar receta, cancelar pedido y error por receta), `PedidosVariasRecetasTablet.dc.html` y `PedidosVariasRecetasMovil.dc.html` (teléfono y ficha). Están en el canvas del proyecto, página «3 · Pedidos». `design.md` los cita. |
