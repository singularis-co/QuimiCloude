# QC-281 — Envases reales al terminar el empaque · requirements

## Alcance

Antes de Terminar el empaque, el Empacador que lo comenzó cuenta los envases que salieron de verdad
en cada línea del reparto. Terminar usa ese conteo, y ya no el plan (`order_presentation_lines.packages`),
para consumir y liberar envases, dar de alta los lotes de producto terminado y repartir el coste. La
diferencia entre plan y real, con su motivo, queda en la línea del reparto y se consulta en una tab
nueva «Reparto» del detalle de producto terminado.

**Entra**
- Diálogo «¿Terminar el empaque?» con conteo real y motivo por línea (sustituye la confirmación simple).
- Terminar en servidor con envases reales: tope, stock libre del envase, liberación de apartados,
  línea en 0 sin lote y coste sobre lo real.
- Quitar «Envases:» de la pantalla del empacador y la columna «Envases» de «Por empacar».
- Tab «Reparto» (8.ª) del detalle de producto terminado (QC-225).
- Consecuencias en acondicionamiento y entrega de que una línea pueda acabar con 0 envases o con
  un número distinto del plan.

**No entra**
- Cambiar el reparto antes de Comenzar (QC-170).
- Lote real de materia prima del Operador (QC-197).
- Permisos nuevos.
- Dependencias nuevas.

## Decisiones cerradas (no reabrir)

Fuente: `progress/features/QC-281.md > Decisiones` (humano, 2026-10-14) y tableros `/design`
aprobados el 2026-10-14 (`docs/diseno/canvas/EmpaqueTerminar*.dc.html`,
`ProductoTerminadoReparto*.dc.html`).

| # | Decisión | Requisitos |
|---|---|---|
| D1 | Tope de envases reales: lo envasado (suma de reales × contenido) no supera la cantidad del pedido. | R8, R15 |
| D2 | Lo que exceda al plan se consume del stock libre del envase; si no alcanza, no se deja Terminar. | R9, R18 |
| D3 | Menos envases que el plan liberan lo apartado que sobra. | R10, R17 |
| D4 | Una línea en 0 se permite y no da de alta lote. | R2, R10, R19, R23 |
| D5 | El conteo viene prellenado con el plan. | R1 |
| D6 | Motivo obligatorio por línea con diferencia, de lista cerrada + «Otro» con texto obligatorio. | R3, R5, R6, R13 |
| D7 | Motivos según sentido, como QC-92, fuente `MOVEMENT_REASONS`: menos → Merma, Rotura, Conteo físico, Error de carga, Otro; más → Conteo físico, Error de carga, Otro. | R3, R4, R13 |
| D8 | Se quita «Envases» del empacador (línea «Envases:» y columna en «Por empacar»). | R12 |
| D9 | El coste se reparte sobre los envases reales, por cantidad de cada lote (hereda QC-170). | R21 |
| D10 | Permiso: solo el Empacador que comenzó (QC-168), sin permiso nuevo. | R14 |
| D11 | E2E sí (inventario y coste). | R18, R21 (ver `tasks.md > T12`) |
| D12 | Sin dependencias nuevas. | R31 |
| D13 | Conteo real, motivo y texto de «Otro» se guardan **en la línea del reparto**, no en el movimiento del envase. | R16 |
| D14 | La diferencia plan/real/motivo se ve en una tab nueva «Reparto» del detalle de producto terminado. | R26, R27, R28 |
| D15 | El tope usa la misma conversión que ya usa el reparto (QC-170). Citada del código: `sumInOrderUnit` / `validateDistribution` de `lib/modules/pedidos/domain/order-distribution.ts`. | R7, R8, R15 |
| D16 | Pedidos empacados antes de QC-281: real = plan, sin motivo. | R25, R27 |
| D17 | Pie «Envasado: N de M» del diálogo visible siempre. | R7 |
| D18 | Textos del tablero aprobados tal cual. | R1–R12, R27, R28 |
| D19 | (2026-10-14) Se puede Terminar con todas las líneas en 0: el pedido pasa a `POR_ACONDICIONAR` sin ningún lote y con todos sus envases liberados. | R32 |
| D20 | (2026-10-14) El coste total del pedido queda igual que hoy (incluye los envases del plan); solo cambia el reparto, que se hace sobre lo envasado real. | R21 |
| D21 | (2026-10-14) El texto de «Otro» tiene un tope de **200 caracteres**. | R13 |
| D22 | (2026-10-14) La tab «Reparto» se ordena por número de pedido descendente. | R26 |
| D23 | (2026-10-14) Con pasos con foto de evidencia, la última frase de la descripción del diálogo («Terminar el empaque no se puede deshacer.») se sustituye por «Al terminar, las fotos de evidencia quedan fijas. No se puede deshacer.». | R33 |

## Requisitos (EARS)

### Diálogo de Terminar (empacador)

- **R1**: CUANDO el Empacador que tiene el pedido en `EN_EMPAQUE` pulsa «Terminar» (en el pie de la
  pantalla o en el último paso de envasado, tras pasar la comprobación de fotos de evidencia), el
  sistema DEBE abrir el diálogo «¿Terminar el empaque?» con una fila por línea del reparto que
  muestre el nombre de la presentación, «Plan: N envases» y un campo «Envases reales» prellenado
  con el plan de esa línea. [D5, D18]
- **R2**: SI el valor de «Envases reales» de una línea no es un entero mayor o igual que 0,
  ENTONCES el sistema DEBE mostrar en esa línea «Escribe un número entero: 0 o más.» y DEBE
  deshabilitar «Terminar». El valor 0 SÍ se acepta. [D4]
- **R3**: MIENTRAS los envases reales de una línea difieren del plan, el sistema DEBE mostrar en
  esa línea la insignia «−N» o «+N» y el campo obligatorio «Motivo de la diferencia», cuyas opciones
  son, si hay menos envases que el plan: Merma, Rotura, Conteo físico, Error de carga y Otro; y si
  hay más: Conteo físico, Error de carga y Otro, con la ayuda «Para envases de más solo valen Conteo
  físico, Error de carga u Otro.». MIENTRAS la línea coincide con el plan, el sistema NO DEBE mostrar
  insignia ni motivo. [D6, D7]
- **R4**: CUANDO una línea cambia de sentido (de menos a más envases que el plan o al revés) y el
  motivo elegido no está entre los del sentido nuevo, el sistema DEBE vaciar el motivo de esa
  línea. [D7]
- **R5**: MIENTRAS el motivo de una línea es «Otro», el sistema DEBE mostrar el campo obligatorio
  «Describe el motivo». [D6]
- **R6**: SI se pulsa «Terminar» con alguna línea que difiere del plan sin motivo, o con «Otro» y el
  texto vacío o solo con espacios, ENTONCES el sistema NO DEBE enviar nada y DEBE mostrar «Elige un
  motivo.» o «Escribe el motivo.» en esa línea y «Falta el motivo en las líneas que no coinciden con
  el plan.» en el pie. [D6, D18]
- **R7**: El sistema DEBE mostrar siempre en el pie del diálogo «Envasado: <total> de <cantidad del
  pedido>», haya o no diferencias, donde el total es la suma de envases reales × contenido de cada
  línea expresada en la unidad del pedido con la misma conversión del reparto (D15). [D15, D17]
- **R8**: SI una línea tiene más envases que el plan y lo envasado supera la cantidad del pedido,
  ENTONCES el sistema DEBE mostrar en esa línea «Supera la cantidad del pedido: con N envases se
  envasan <total> de <cantidad>. Máximo en esta línea: M.», donde M es el mayor entero de envases de
  esa línea que, con las demás como están, no supera la cantidad; DEBE marcar la insignia en tono de
  error, mostrar «Corrige las líneas marcadas para poder terminar.» en el pie y deshabilitar
  «Terminar». [D1, D15]
- **R9**: SI el exceso de envases de una línea sobre su plan es mayor que los envases vacíos libres
  de su envase (existencia no apartada por ningún pedido), ENTONCES el sistema DEBE mostrar en esa línea «No alcanza el stock
  del envase: hacen falta N envases vacíos de <presentación> y quedan L libres.», mostrar «Corrige
  las líneas marcadas para poder terminar.» en el pie y deshabilitar «Terminar». [D2]
- **R10**: MIENTRAS una línea difiere del plan sin error, el sistema DEBE mostrar bajo el motivo la
  ayuda que corresponda: con 0 envases, «Esta línea no da de alta lote. Se liberan sus N envases
  apartados.»; con menos, «Se libera 1 envase apartado.» o «Se liberan N envases apartados.»; con
  más, «Sale 1 envase vacío del stock libre (quedan L).» o «Salen N envases vacíos del stock libre
  (quedan L).». [D3, D4, D18]
- **R11**: CUANDO el Empacador cierra el diálogo o pulsa «Cancelar», el sistema NO DEBE cambiar el
  pedido, sus líneas, sus reservas ni el inventario.
- **R12**: El sistema NO DEBE mostrar la línea «Envases:» en la pantalla del pedido de empaque ni la
  columna «Envases» en la pestaña «Por empacar» de Asignación. [D8]

### Terminar en el servidor

- **R13**: CUANDO llega una petición de Terminar el empaque, el sistema DEBE exigir, por cada línea
  del reparto del pedido y solo por ellas, un número de envases reales entero ≥ 0, y un motivo SI y
  solo SI ese número difiere del plan, válido para su sentido (D7), con texto no vacío de hasta 200
  caracteres (tras recortar espacios) SI y solo SI el motivo es «Otro». SI falta o sobra alguna
  línea, o cualquiera de esas reglas no se cumple, ENTONCES el sistema DEBE rechazar la petición con
  error de validación sin cambiar nada. El campo «Describe el motivo» del diálogo NO DEBE admitir más
  de 200 caracteres. [D6, D7, D21]
- **R14**: El sistema DEBE permitir Terminar solo a un actor con `empaque.modificar` que sea quien
  tiene el pedido en `EN_EMPAQUE`; con cualquier otro actor DEBE rechazar como hoy (sin permiso,
  pedido de otro empacador o pedido no empacable), sin permiso nuevo. [D10]
- **R15**: SI la suma de envases reales × contenido de cada línea, convertida a la unidad del pedido
  con `sumInOrderUnit` (la conversión del reparto de QC-170), supera la cantidad del pedido,
  ENTONCES el sistema DEBE rechazar Terminar entero con el error «lo envasado supera la cantidad del
  pedido». Igual o menor SÍ se acepta. [D1, D15]
- **R16**: CUANDO Terminar se acepta, el sistema DEBE guardar en cada línea del reparto sus envases
  reales, su motivo y el texto de «Otro», en la misma transacción que el cambio de estado; el plan
  (`packages`) NO DEBE cambiar. [D13]
- **R17**: CUANDO una línea tiene menos envases reales que el plan, el sistema DEBE consumir del
  envase solo los envases reales y DEBE liberar en el libro de reservas lo que el pedido tenía
  apartado de más, de modo que esos envases vuelvan a estar disponibles. [D3]
- **R18**: CUANDO una línea tiene más envases reales que el plan, el sistema DEBE consumir los
  envases reales: lo apartado por el pedido más el exceso tomado de la existencia del envase no
  apartada por otros pedidos. SI esa existencia libre no alcanza, ENTONCES el sistema DEBE rechazar
  Terminar entero con el error «no alcanza el stock del envase» y ningún lote nace. [D2, D11]
- **R19**: CUANDO una línea tiene 0 envases reales, el sistema NO DEBE dar de alta lote de producto
  terminado para ella y DEBE liberar todo lo que el pedido tenía apartado de su envase. [D4]
- **R20**: CUANDO Terminar se acepta, el sistema DEBE dar de alta, por cada línea con envases reales
  mayores que 0, un lote de producto terminado con `envases reales × contenido de la línea`.
- **R21**: CUANDO Terminar se acepta, el sistema DEBE calcular el coste del pedido con la misma regla
  que hoy (QC-170 R18: el guardado, o recalculado si no hay) y DEBE dividirlo entre el total
  realmente envasado en la unidad del pedido (suma de envases reales × contenido convertidos con
  `sumInOrderUnit`), de modo que todos los lotes del pedido lleven el mismo coste por unidad del
  pedido y la suma de `existencia × coste unitario` de sus lotes sea el coste del pedido (salvo
  redondeo a 4 decimales). El coste total NO DEBE recalcularse con los envases reales. [D9, D11, D20]
- **R22**: SI Terminar se rechaza por cualquier motivo, ENTONCES el sistema NO DEBE cambiar el estado
  del pedido, sus líneas, sus reservas, la existencia de ningún lote ni dar de alta ningún lote.

### Después de Terminar

- **R23**: MIENTRAS un pedido está en acondicionamiento, el sistema NO DEBE contar una línea con 0
  envases reales como línea sin datos de lote (no bloquea Terminar el acondicionamiento) y DEBE
  mostrar los envases reales de cada línea. [D4]
- **R24**: CUANDO se registra una entrega de un pedido, el sistema DEBE usar los envases reales de
  cada línea como los envases pedidos de esa línea (lo que queda por entregar y si la entrega lo
  completa).
- **R25**: El sistema DEBE tratar una línea sin conteo real guardado (pedido empacado antes de esta
  feature) como envases reales = plan y sin motivo en acondicionamiento, en entrega y en la tab
  «Reparto». Ninguna migración DEBE reescribir esas líneas. [D16]

### Tab «Reparto» del detalle de producto terminado

- **R26**: El sistema DEBE mostrar en el detalle de producto terminado una 8.ª tab «Reparto», la
  última, de solo consulta, con el permiso `inventario.consultar` de la página; con una fila por
  línea del reparto de cada pedido empacado (estado `POR_ACONDICIONAR`, `EN_ACONDICIONAMIENTO`,
  `TERMINADO` o `ENTREGADO`) de la receta y presentación de ese producto, ordenadas por número de
  pedido descendente, con las columnas Pedido · Presentación · Plan · Envases reales · Diferencia ·
  Motivo, y paginada como las demás tabs (10 o 25 filas). [D14, D22]
- **R27**: El sistema DEBE pintar cada fila así: igual al plan → «—» en Diferencia y Motivo; menos
  envases → «−N» y el motivo; más envases → «+N» y el motivo; «Otro» → el texto escrito entre
  comillas bajo el motivo; 0 envases reales → «−N» y «Sin lote»; línea sin conteo real guardado →
  envases reales = plan, «—» y la nota «Empacado antes de QC-281». La diferencia se calcula al
  pintar; el resto sale de la línea del reparto. [D14, D16, D18]
- **R28**: El sistema DEBE mostrar en la tab los estados de las demás tabs de listado: cargando
  (esqueleto), vacío «Ningún pedido empacado tiene este producto.», página vacía, y error «No se
  pudo cargar el reparto.» con «Reintentar». [D18]

### Transversales

- **R29**: El sistema NO DEBE leer ni escribir líneas del reparto, reservas, lotes ni pedidos de otra
  empresa al Terminar ni al listar la tab «Reparto»; un pedido o producto de otra empresa DEBE
  responder igual que uno que no existe.
- **R30**: Terminar DEBE ser idempotente frente al doble envío: un segundo envío sobre un pedido que
  ya salió de `EN_EMPAQUE` DEBE rechazarse como hoy (`not_packable`) sin consumir ni dar de alta
  nada más.
- **R31**: La feature NO DEBE añadir dependencias de terceros. [D12]
- **R32**: CUANDO Terminar se acepta con todas las líneas del reparto en 0 envases reales, el sistema
  DEBE pasar el pedido a `POR_ACONDICIONAR` sin dar de alta ningún lote y liberando todo lo apartado
  de sus envases. [D19]
- **R33**: MIENTRAS el pedido tiene pasos de envasado con foto de evidencia, el diálogo «¿Terminar el
  empaque?» DEBE mostrar como descripción «Cuenta los envases que salieron de verdad. Ya vienen con
  el plan: cambia solo los que no coinciden. Al terminar, las fotos de evidencia quedan fijas. No se
  puede deshacer.»; sin esos pasos, la del tablero tal cual. [D23]

## Preguntas abiertas

Ninguna. Las cinco que dejó el spec las cerró el humano el 2026-10-14 (D19–D23).
