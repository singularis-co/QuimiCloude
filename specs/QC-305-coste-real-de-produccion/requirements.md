# QC-305 — coste-real-de-produccion · requirements.md

> **Zona** fullstack · **Complejidad** high · **depends_on** — · **Rama** `feature/QC-305-coste-real-de-produccion`
>
> **Alcance.** Al Terminar el empaque, el sistema calcula y guarda el coste real de producción del
> pedido: ingredientes ponderados por lote consumido y envases reales. El estimado deja de
> recalcularse desde Comenzar. El lote de producto terminado toma el coste real. Estimado y real se
> ven en el pedido, y el coste del lote en el detalle de producto terminado.
>
> **Lo que NO entra.** La precisión de `unit_cost` (QC-178). La elección del lote real por el
> operador (QC-197). Ordenar o filtrar por el coste real (QC-123 D12). Mano de obra, máquina o
> cualquier coste distinto de ingredientes y envases.
>
> Sembrado por `/afinar-feature` el 2026-10-21. El bloque de Alcance y la tabla de «Decisiones
> cerradas» los fijó el humano ANTES del spec. `spec_author` los respeta, no los reabre y no los
> reescribe: su trabajo aquí es `## Requisitos (EARS)`.

## Requisitos (EARS)

> **Vocabulario.** «Estimado»: el importe que el pedido ya guarda (`ingredients_cost`, total con
> envases, y `packaging_cost`, su parte de envases). «Coste real» o «real»: el importe nuevo de esta
> ficha. «Comenzado»: un pedido que ya pasó de `PENDIENTE` a `EN_CURSO` (Comenzar) y cualquier
> estado al que se llega desde ahí (`EN_CURSO`, `POR_EMPACAR`, `EN_EMPAQUE`, `POR_ACONDICIONAR`,
> `EN_ACONDICIONAMIENTO`, `TERMINADO`, `ENTREGADO`). «Asientos de consumo del pedido»: los
> movimientos de inventario de tipo consumo registrados contra ese pedido, de ingredientes y de
> envases, cada uno con su lote. «Sin importe»: el pedido no tiene número en ese campo; se pinta con
> el guion `—`. «Terminar»: Terminar el empaque (QC-281, QC-290).

### Cálculo del coste real (servidor)

- **R1.** CUANDO Terminar se acepta, el sistema DEBE calcular el coste real como la suma, sobre los
  asientos de consumo del pedido, de (cantidad consumida del lote × coste unitario del lote), con la
  cantidad y el coste en la unidad del lote, exacta y redondeada una sola vez al final a 4 decimales
  (mitad arriba). Ejemplo: 8 kg del lote 1A a 10 + 2 kg del lote 1B a 20 → `120.0000`, y NO
  `150.0000` (el promedio simple de QC-123 D4). [Ponderado]
- **R2.** El sistema DEBE contar en el coste real los asientos de consumo de los ingredientes de la
  receta y los de los envases consumidos al Terminar con el conteo real, excedente de QC-290
  incluido, cada uno al coste unitario del lote del que salió. Un envase que también es ingrediente
  cuenta por sus asientos, sin contarse dos veces. [Lote usado, Qué envases]
- **R3.** El sistema DEBE tomar el lote de cada asiento de consumo tal como está registrado, sin
  volver a elegir lotes por fecha de compra ni por reserva: SI el asiento de un ingrediente
  apunta a un lote distinto del que el pedido tenía apartado, ENTONCES el cálculo DEBE usar el coste
  del lote del asiento. [Lote usado: no depende de QC-197]
- **R4.** El sistema DEBE leer, para el coste real, solo asientos y lotes de la empresa del pedido,
  y NO DEBE contar asientos de consumo de otro pedido ni asientos que no sean de consumo (alta,
  ajuste, producción, entrega).
- **R5.** CUANDO Terminar se acepta, el sistema DEBE guardar el coste real en un campo del pedido
  distinto del estimado, en la misma transacción que el cambio de estado y el alta de los lotes; SI
  Terminar se rechaza por cualquier motivo, ENTONCES el sistema NO DEBE guardar ningún coste real.
  [¿Qué pasa con el estimado?, ¿Cuándo se calcula el real?]
- **R6.** CUANDO Terminar se acepta, el sistema NO DEBE cambiar el estimado del pedido
  (`ingredients_cost` ni `packaging_cost`). [¿Qué pasa con el estimado?]
- **R7.** SI el pedido no tiene ningún asiento de consumo, o algún lote de un asiento de consumo no
  tiene coste unitario (P1), o el coste real no cabe en `Decimal(14,4)`, ENTONCES el sistema DEBE
  dejar el coste real sin importe —nunca `0`— y DEBE aceptar Terminar igual. [¿Sin coste real?]
- **R8.** CUANDO Terminar se acepta sin reparto o con todas las líneas en 0 envases (QC-281 D19), el
  sistema DEBE calcular y guardar el coste real igual que en R1, aunque no nazca ningún lote.
  [¿Cuándo se calcula el real?]
- **R9.** El sistema DEBE calcular el coste real una sola vez, al Terminar, y NO DEBE cambiarlo
  después por ningún ajuste de existencia, entrega, anulación de entrega, cambio del coste unitario
  de un lote ni ninguna otra operación. [¿Cuándo se calcula el real?]
- **R10.** El sistema NO DEBE dar coste real a un pedido que no ha pasado por Terminar con esta
  ficha en marcha: los pedidos anteriores a Terminar y los que terminaron el empaque antes de esta
  ficha quedan sin importe, y ninguna migración DEBE rellenarlo. [¿Sin coste real?]

### El estimado queda congelado desde Comenzar

- **R11.** MIENTRAS el pedido está en `PENDIENTE` o `BLOQUEADO`, el sistema DEBE seguir
  recalculando el estimado en cada edición, como hoy (QC-123 D8, QC-151, QC-141 R59–R66).
  [¿Cuándo cambia el estimado?]
- **R12.** CUANDO se guarda la edición general de un pedido en `EN_CURSO`, el sistema NO DEBE
  cambiar `ingredients_cost` ni `packaging_cost`, aunque cambien la receta, la cantidad, la unidad o
  el reparto; el resto de la edición DEBE seguir como hoy. [¿Cuándo cambia el estimado?]
- **R13.** CUANDO se guarda la edición de reparto y unidad (QC-170) de un pedido en `EN_CURSO` o en
  `POR_EMPACAR`, el sistema NO DEBE cambiar `ingredients_cost` ni `packaging_cost`. [¿Cuándo cambia
  el estimado?]
- **R14.** MIENTRAS un pedido está comenzado, ninguna operación del sistema DEBE escribir su
  estimado. [¿Cuándo cambia el estimado?]
- **R15.** MIENTRAS el formulario de edición está abierto sobre un pedido en `EN_CURSO`, el bloque de
  coste DEBE mostrar el estimado guardado —o el guion si no tiene— y NO DEBE pedir ninguna
  cotización al cambiar la receta, la cantidad, la unidad o el reparto. Enmienda QC-151 R12 solo para
  pedidos comenzados: QC-151 R1 se mantiene, porque guardar ya no cambia el estimado. [¿Cuándo
  cambia el estimado?]

### Coste del lote de producto terminado

- **R16.** CUANDO Terminar se acepta y nace al menos un lote de producto terminado, el sistema DEBE
  repartir el **coste real** entre todo lo envasado real (excedente incluido) con la regla de reparto
  de QC-281 R21 y QC-290 R10: el mismo coste por unidad del pedido para todos los lotes, expresado en
  la unidad de cada lote, de modo que la suma de `existencia × coste unitario` de sus lotes sea el
  coste real salvo redondeo a 4 decimales. **Enmienda D20 de QC-281**: el total que se reparte ya no
  es el estimado. [¿Cambia el coste del lote de producto terminado?]
- **R17.** SI el coste real queda sin importe (R7), ENTONCES los lotes de producto terminado que
  nacen de ese Terminar DEBEN quedar sin coste unitario (P2), y el sistema NO DEBE usar el estimado
  ni `0` en su lugar. [¿Sin coste real?, ¿Cambia el coste del lote?]
- **R18.** El sistema NO DEBE cambiar el coste unitario de ningún lote de producto terminado nacido
  antes de esta ficha.

### Dónde se ve

- **R19.** El listado de pedidos (tabla y tarjeta) DEBE mostrar en cada pedido el estimado y el coste
  real en dos columnas contiguas, en ese orden, con los rótulos «Costo estimado» y «Costo real»
  (P3). Ninguna de las dos DEBE ser ordenable ni filtrable (QC-123 D12). [¿Dónde se ve?]
- **R20.** SI el pedido no tiene coste real, ENTONCES su celda DEBE mostrar el guion con el rótulo
  accesible «Sin dato», nunca `0` ni una celda vacía; lo mismo para el estimado sin importe, como
  hoy. [¿Sin coste real?]
- **R21.** El sistema DEBE pintar el coste real en el listado con el formato `$1,234,567.50` (`$`
  fijo sin espacio, coma de miles, punto decimal, dos decimales; `120.0000` → `$120.00`,
  `12752.5512` → `$12,752.55`), el mismo `formatMoneyDisplay` del estimado (decisión 2026-10-21) y, SI el valor exacto difiere del pintado, ENTONCES DEBE exponer el valor exacto en
  el atributo `title`; SI coincide, NO DEBE llevar `title`. NO DEBE usar `Intl.NumberFormat`,
  `toLocaleString` ni coma flotante para obtenerlo. [Tipo y formato]
- **R22.** El detalle de producto terminado (tab «Costo de producción») DEBE mostrar, para un lote
  nacido de un Terminar con esta ficha en marcha, el coste unitario y el total que salen del coste
  real (R16), o el guion en los dos si el lote no tiene coste (R17), sin cambiar las columnas de la
  tab. [¿Dónde se ve?]

### Acceso, tipo y forma

- **R23.** El sistema DEBE transportar el coste real como cadena decimal con 4 decimales,
  `Decimal(14,4)` en la base, nunca `number`, sin moneda y sin ninguna dependencia nueva. [Tipo y
  formato]
- **R24.** El sistema DEBE devolver el coste real solo en las salidas del pedido que exigen
  `pedidos.consultar`, validado en el service, sin permiso nuevo; las salidas de `asignaciones` NO
  DEBEN llevar el coste real (ni el estimado, como hoy). [¿Quién lo ve?]
- **R25.** El sistema DEBE guardar el coste real como una columna nueva y opcional del propio
  pedido, con identificador en inglés, por una migración con `down.sql`, sin tabla nueva; `orders`
  conserva su borrado lógico y sus `created_at` / `updated_at` / `deleted_at`. [Forma de la tabla]

### E2E

- **R26.** El sistema DEBE tener un test E2E, en Chromium y WebKit y sin servicios externos, que:
  (a) crea un pedido cuyo ingrediente se consume de dos lotes con distinto coste unitario;
  (b) lo comienza, lo edita en `EN_CURSO` cambiando la cantidad y ve que el estimado guardado no
  cambia; (c) lo lleva hasta Terminar con un conteo real distinto del plan; (d) ve en el listado el
  estimado y el coste real lado a lado, con el real igual a la suma ponderada de los asientos que
  guardó la base; y (e) ve en el detalle de producto terminado el coste unitario del lote igual al
  coste real dividido entre lo envasado. [¿E2E?]

### Cobertura de las decisiones cerradas

| Decisión cerrada | Requisitos |
|---|---|
| ¿Cómo se combina el coste de los lotes usados? Ponderado por cantidad | R1 |
| ¿Qué es «lote usado»? Los asientos de consumo del pedido; no depende de QC-197 | R2, R3, R4 |
| ¿Qué envases entran? Los reales, excedente incluido, al coste de su lote | R2 |
| ¿Qué pasa con el estimado? Se conserva; el real va aparte | R5, R6 |
| ¿Cuándo cambia el estimado? Antes de Comenzar sí; desde Comenzar congelado | R11, R12, R13, R14, R15 |
| ¿Cuándo se calcula el real? Una vez, al Terminar; nada posterior lo recalcula | R5, R8, R9 |
| ¿Cambia el coste del lote de producto terminado? Sí, el real; enmienda D20 de QC-281 | R16, R17, R18 |
| ¿Dónde se ve? Pedido: estimado y real lado a lado; producto terminado: coste del lote | R19, R22 |
| ¿Sin coste real? Guion, nunca 0 | R7, R10, R17, R20 |
| Tipo y formato | R21, R23 |
| ¿Quién lo ve? `pedidos.consultar`; `asignaciones` sin importe | R24 |
| ¿E2E? Sí | R26 |
| Forma de la tabla | R25 |

## Preguntas abiertas

Ninguna. P1–P3 se cerraron al aprobar el spec (2026-10-21): ver las tres últimas filas de la tabla.

## Decisiones cerradas (no reabrir)

| Fecha | Pregunta | Decisión |
|---|---|---|
| 2026-10-21 | ¿Cómo se combina el coste de los lotes usados? | **Ponderado por cantidad**: Σ (cantidad consumida del lote × `unit_cost` del lote). Ej.: 8 kg de 1A a 10 + 2 kg de 1B a 20 = 120. Se aparta a sabiendas del promedio simple de QC-123 D4, que sigue valiendo para el estimado. |
| 2026-10-21 | ¿Qué es «lote usado»? | Los asientos de consumo que el sistema ya registra contra el pedido (ingredientes y envases). No depende de QC-197: cuando QC-197 cambie el lote del asiento, el cálculo lo toma sin cambios. |
| 2026-10-21 | ¿Qué envases entran? | Los envases reales consumidos al terminar, incluido el excedente de QC-290, cada uno al coste del lote del que salió. |
| 2026-10-21 | ¿Qué pasa con el estimado? | Se conserva en su campo (`ingredients_cost` / `packaging_cost`). El real va en un campo aparte. |
| 2026-10-21 | ¿Cuándo cambia el estimado? | Se recalcula al editar mientras el pedido no ha empezado (QC-123 D8, QC-151). **Desde Comenzar queda congelado.** Hoy la edición en `EN_CURSO` lo recalcula (`lib/modules/pedidos/domain/update-order.ts:99`, `:225`): esta ficha lo cambia. |
| 2026-10-21 | ¿Cuándo se calcula el real? | **Una sola vez, al Terminar el empaque.** Ajustes o anulaciones posteriores no lo recalculan. |
| 2026-10-21 | ¿Cambia el coste del lote de producto terminado? | Sí: el lote toma el coste real, repartido sobre lo envasado real. **Enmienda D20 de QC-281** (hoy reparte el total del estimado). El reparto por cantidad de cada lote de QC-281 D9 / QC-290 sigue igual. |
| 2026-10-21 | ¿Dónde se ve? | En la vista del pedido, estimado y real lado a lado. En el detalle de producto terminado, el coste del lote, que ya sale del real. |
| 2026-10-21 | ¿Sin coste real? | Guion, nunca 0. Cubre los pedidos terminados antes de esta ficha y los casos sin cálculo posible. *Heredado de QC-123 D5/D9.* |
| 2026-10-21 | Tipo y formato | `Decimal(14,4)` como cadena, nunca `float`, sin dependencia nueva, sin moneda. Formato `$ 1,234,567.50` con el valor exacto en `title`. *Heredado de QC-123 D11/D14 y QC-151.* |
| 2026-10-21 | ¿Quién lo ve? | Quien tenga `pedidos.consultar`, validado en el service. Sin permiso nuevo. La vía `asignaciones` no lleva importe. *Heredado de QC-123 D10.* |
| 2026-10-21 | ¿E2E? | Sí: toca importes e inventario (`docs/checkpoints-proyecto.md > Flujos criticos`). |
| 2026-09-01 | Forma de la tabla | Borrado lógico, `created_at` / `updated_at` / `deleted_at`, identificadores en inglés. *Heredado de QC-4.* |
| 2026-10-21 | (P1, R7) ¿Un lote consumido sin coste unitario? | El pedido queda **sin coste real** (guion). No se suma sin ese lote: daría un real más bajo que el verdadero sin avisar. *Cerrada por el humano al aprobar el spec (F1.4).* |
| 2026-10-21 | (P2, R17) Sin coste real, ¿qué coste lleva el lote de producto terminado? | **Sin coste unitario**; el detalle pinta guion. Ni `0.0000` ni el estimado. *Cerrada por el humano al aprobar el spec (F1.4).* |
| 2026-10-21 | (P3, R19) ¿Dónde y cómo se ve en el pedido? | En el **listado de pedidos**: «Costo de producción» pasa a «Costo estimado» y a su derecha nace «Costo real». **Sin pase `/design`** (excepción de `docs/perfil-agentes.md > Pase de diseño`, como QC-284). Concreta la fila «¿Dónde se ve?». *Cerrada por el humano al aprobar el spec (F1.4).* |
| 2026-10-21 | Alcance del congelado del estimado | Aprobado tal como lo amplía el spec: tampoco recalcula la edición de reparto y unidad (QC-170) en `EN_CURSO`/`POR_EMPACAR` (R13), y el formulario de un pedido comenzado deja de recotizar (R15, enmienda QC-151 R12 solo para comenzados). *Humano, F1.4.* |
| 2026-10-21 | R17: el CHECK de QC-150/QC-281 se quita por migración; lote PT sin coste real = unit_cost NULL | `product_batches_package_content_requires_unit_cost` impedía un lote de producto terminado sin `unit_cost`. Se quita por una migración con `down.sql` (`unit_cost_positive` se queda). Sin coste real el lote nace con `unit_cost` NULL; quien lee lotes de PT lo trata como «sin coste» (guion), nunca 0 ni el estimado. *Humano, F2.1, al desbloquear T4.* |
| 2026-10-21 | R21: el listado usa formatMoneyDisplay ($120.00, sin espacio), igual que el estimado; el formulario sigue con formatOrderAmount | R21 pedía `$ 120.00` (con espacio, de QC-151 R18) y design §5.1 reutilizaba `formatMoneyDisplay`, que pinta `$120.00`. Gana el design: las dos columnas del listado se ven igual. El bloque de coste del formulario (`formatOrderAmount`, `$ 1,234.50`) no cambia. *Humano, F2.1, al cerrar T7.* |
| 2026-10-21 | R19: la tarjeta de teléfono del listado muestra «Costo estimado» y «Costo real» | La tarjeta (`ORDER_TABLE_CARD`) no sale de las columnas y no pintaba ningún coste. Se añaden los dos a la tarjeta con el estilo de campo de tarjeta existente, `formatMoneyDisplay`, guion sin valor y solo con `pedidos.consultar`, como la tabla. Sin pase `/design`: excepción declarada, la misma de P3. *Humano, F2.1, al cerrar T8.* |
