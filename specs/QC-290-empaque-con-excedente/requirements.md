# QC-290 — empaque-con-excedente · requirements.md

> **Zona:** fullstack · **Complejidad:** high · **depends_on:** — · **Rama:** `feature/QC-290-empaque-con-excedente`
>
> **Alcance:** Terminar el empaque con más envases reales de los que pide el pedido, con motivo
> obligatorio por línea que difiere. Lo envasado real entra al inventario; lo que supera al pedido
> queda como excedente libre en stock (entregable sin pedido, QC-288, o a otro pedido). El pedido
> sigue esperando solo lo pedido. El error «Supera la cantidad del pedido» pasa a aviso informativo.
>
> **Lo que NO entra:**
> - El tope del reparto antes de Comenzar (`order_distribution_exceeds_quantity`, Q3 de QC-170): sigue igual.
> - El bloqueo por stock libre del envase (D2 de QC-281): sigue igual.
> - Permisos nuevos y dependencias nuevas.
> - QC-304 (cancelada): duplicaba esta ficha; sus decisiones se traen aquí.
>
> Sembrado por `/afinar-feature` el 2026-10-20. El bloque de Alcance y la tabla de «Decisiones
> cerradas» los fijó el humano ANTES del spec. `spec_author` los respeta, no los reabre y no los
> reescribe: su trabajo aquí es `## Requisitos (EARS)`.

## Requisitos (EARS)

Vocabulario de esta ficha (no es implementación, es para que los requisitos se lean igual):

- **Envases reales** de una línea: los contados al terminar el empaque (QC-281); sin conteo
  guardado, el plan (QC-281 R25).
- **Envasado**: la suma de envases reales × contenido de cada línea, en la unidad del pedido, con la
  conversión del reparto (QC-281 D15).
- **Excedente del pedido**: envasado − cantidad del pedido, si es mayor que 0; si no, 0.
- **Envases libres** de una línea: los envases reales de esa línea que no espera el pedido.
- **Envases que espera el pedido** en una línea: envases reales − envases libres de esa línea.

### Terminar con más de lo pedido (servidor)

- **R1**: CUANDO llega una petición de Terminar el empaque cuyo envasado supera la cantidad del
  pedido, el sistema DEBE aceptarla si cumple las demás reglas de Terminar (conteo y motivo de
  QC-281 R13, permiso de R27 y stock libre del envase de R4), sin ningún tope propio para el
  excedente, y DEBE pasar el pedido a `POR_ACONDICIONAR`. [¿Se puede envasar más?, ¿Tope?]
- **R2**: SI una línea con más envases reales que su plan llega sin motivo, con un motivo que no es
  Conteo físico, Error de carga u Otro, o con Otro y un texto vacío, solo de espacios o de más de 200
  caracteres tras recortar, ENTONCES el sistema DEBE rechazar Terminar entero con error de
  validación sin cambiar nada, también cuando el envasado supera la cantidad del pedido. [¿Qué
  motivos?]
- **R3**: SI alguna línea no tiene contenido (ni copiado ni vigente) o su unidad no se puede
  convertir a la del pedido, ENTONCES el sistema DEBE rechazar Terminar entero con el mismo error que
  hoy («presentación sin contenido» o «unidades incompatibles»), haya o no excedente.
- **R4**: SI el exceso de envases de una línea sobre su plan es mayor que la existencia del envase no
  apartada por otros pedidos, ENTONCES el sistema DEBE rechazar Terminar entero con «no alcanza el
  stock del envase» (QC-281 R18), haya o no excedente. [¿Tope?]
- **R5**: SI el envasado no supera la cantidad del pedido, ENTONCES el sistema DEBE dejar 0 envases
  libres en todas las líneas, aunque alguna línea supere su plan. Ejemplo: plan 5×1 L + 1×5 L
  (10 L), real 9×1 L + 0×5 L (9 L) → 0 libres; el pedido espera 9×1 L + 0×5 L. [Caso mixto sin
  superar el total]
- **R6**: CUANDO Terminar se acepta con excedente mayor que 0, el sistema DEBE fijar los envases
  libres de cada línea de modo que: (a) una línea con envases reales iguales o menores que su plan
  tiene 0 libres; (b) una línea con más envases reales que su plan tiene, como mucho, envases reales −
  plan; (c) los libres son envases enteros; y (d) la suma de libres × contenido, en la unidad del
  pedido, NO DEBE superar el excedente. Ejemplos: plan 5×1 L + 1×5 L, real 7×1 L + 1×5 L (12 L) →
  2 libres de 1 L, el pedido espera 5×1 L + 1×5 L; real 12×1 L + 0×5 L (12 L) → 2 libres de 1 L, el
  pedido espera 10×1 L + 0×5 L. [¿De qué presentación?, (P1)]
- **R7**: CUANDO hay que fijar los envases libres de R6, el sistema DEBE recorrer las líneas que
  superan su plan de mayor a menor contenido de un envase en la unidad del pedido (a igual
  contenido, en el orden del reparto) y dar a cada una el mayor número entero de libres que cumple
  R6 con lo que quede del excedente tras las anteriores. Lo que quede del excedente por debajo del
  contenido de un envase sigue siendo del pedido. [(P1), (P3)]
- **R8**: CUANDO Terminar se acepta, el sistema DEBE guardar los envases libres de cada línea del
  reparto en esa línea, en la misma transacción que el conteo real y el cambio de estado; SI Terminar
  se rechaza, ENTONCES NO DEBE guardar ninguno (QC-281 R22).
- **R9**: CUANDO Terminar se acepta, el sistema DEBE dar de alta, por cada línea con envases reales
  mayores que 0, un único lote de producto terminado con envases reales × contenido de la línea,
  envases libres incluidos. [¿Qué entra al inventario?]
- **R10**: CUANDO Terminar se acepta con excedente, el sistema DEBE calcular el coste del pedido con
  la misma regla que hoy (QC-281 R21, sin recalcularlo con los envases reales) y DEBE repartirlo
  entre todo lo envasado, excedente incluido, de modo que todos los lotes del pedido lleven el mismo
  coste por unidad del pedido y la suma de `existencia × coste unitario` de sus lotes sea el coste del
  pedido (salvo redondeo a 4 decimales). [Coste]
- **R11**: El sistema DEBE tratar una línea sin envases libres guardados (terminada antes de esta
  feature, o sin terminar) como 0 envases libres. Ninguna migración DEBE cambiar el plan, los envases
  reales ni los motivos de ninguna línea.

### Lo que espera el pedido (entrega)

- **R12**: El sistema DEBE usar como envases pedidos de cada línea los envases que espera el pedido
  (envases reales − envases libres) al calcular lo que le falta por entregar a cada presentación en el
  sheet de entrega, en el tope por presentación al registrar una entrega (QC-223 D3: R16, R18, R28) y
  en el estado de entrega del listado de pedidos. Sustituye «envases reales» de QC-281 R24. [¿El
  pedido cuenta el excedente?, (P1)]
- **R13**: SI una entrega de un pedido pide para una presentación más envases que los que espera el
  pedido en esa línea menos los ya entregados sin anular, ENTONCES el sistema DEBE rechazarla con el
  error de exceso de QC-223 R18 sin registrar nada. Ejemplo: real 12×1 L con 2 libres → el pedido
  admite como mucho 10 envases de 1 L. [(P1)]
- **R14**: CUANDO, tras una entrega, lo entregado sin anular cubre en todas las presentaciones los
  envases que espera el pedido, el sistema DEBE pasar el pedido a `ENTREGADO` (QC-223 R27) aunque los
  envases libres sigan en la existencia de su lote. [¿El pedido cuenta el excedente?]
- **R15**: El sheet de entrega de un pedido DEBE mostrar como «pedidos» de cada presentación los
  envases que espera el pedido, no los envases reales.

### Lo libre queda en stock

- **R16**: El sistema DEBE dejar los envases libres en la existencia del lote de su línea, disponibles
  para cualquier entrega de un pedido de la misma receta y presentación (QC-223 R7) igual que el resto
  de esa existencia. [Alcance: «o a otro pedido»]
- **R17**: CUANDO se calcula el excedente entregable sin pedido de un producto (QC-288), el sistema
  DEBE contar, como envases que espera cada pedido `TERMINADO`, los envases que espera el pedido
  (reales − libres) menos lo entregado sin anular, de modo que los envases libres sumen al excedente
  entregable sin pedido. Ejemplo: el único pedido de 1 L terminó con 12×1 L y 2 libres, nada
  entregado, sin otros lotes → excedente entregable sin pedido = 2. Cierra
  `specs/QC-288-entrega-sin-pedido/design.md > §12`. [¿El pedido cuenta el excedente?]
- **R18**: MIENTRAS un pedido está en acondicionamiento, y en la tab «Reparto» del detalle de producto
  terminado, el sistema DEBE seguir usando los envases reales de cada línea (no los que espera el
  pedido), como hoy (QC-281 R23, R26, R27).

### Diálogo «¿Terminar el empaque?» (Empacador)

- **R19**: MIENTRAS el envasado del diálogo supera la cantidad del pedido, el sistema NO DEBE mostrar
  en ninguna línea «Supera la cantidad del pedido: …», NO DEBE marcar la insignia «+N» en tono de
  error por ese motivo, NO DEBE mostrar «Corrige las líneas marcadas para poder terminar.» por ese
  motivo, NO DEBE pintar el total del pie en tono de error y NO DEBE deshabilitar «Terminar» por ese
  motivo. [Qué ve el Empacador, ¿Se puede envasar más?]
- **R20**: MIENTRAS el envasado del diálogo supera la cantidad del pedido y ninguna línea tiene error
  de conteo, el sistema DEBE mostrar un único aviso informativo (no de error, no bloqueante) encima
  del pie: «Sobran <excedente> sobre el pedido.» y, en segunda línea, «Quedan libres en stock: <N>
  envase(s) de <presentación>[, …].» o, si ningún envase queda libre, «Ningún envase queda libre: lo
  que sobra no llega a un envase entero y sigue en el pedido.» Tablero:
  `docs/diseno/canvas/EmpaqueTerminar.dc.html` (estado `excedente`). [Qué ve el Empacador, (P2)]
- **R21**: MIENTRAS el envasado del diálogo no supera la cantidad del pedido, el sistema NO DEBE
  mostrar el aviso de R20.
- **R22**: DONDE el aviso de R20 muestre envases libres, el sistema DEBE calcularlos con la misma
  regla que el servidor (R5–R7), de modo que el diálogo y lo guardado al Terminar coincidan para el
  mismo conteo.
- **R23**: MIENTRAS el envasado del diálogo supera la cantidad del pedido, el sistema DEBE seguir
  aplicando las demás reglas del diálogo de QC-281: entero ≥ 0 (R2), insignia y motivo obligatorio
  por línea que difiere con los motivos de «más» (R3–R6), stock libre del envase (R9, que sí bloquea)
  y ayudas (R10). [¿Qué motivos?, ¿Tope?]
- **R24**: El sistema DEBE seguir mostrando siempre en el pie «Envasado: <total> de <cantidad del
  pedido>» (QC-281 R7), también cuando el total supera la cantidad.

### Transversales

- **R25**: El sistema DEBE seguir rechazando el reparto antes de Comenzar cuando supera la cantidad
  del pedido (QC-170 Q3, `order_distribution_exceeds_quantity`), sin cambios. [Alcance: «Lo que NO
  entra»]
- **R26**: El catálogo de errores NO DEBE conservar el error «Lo envasado supera la cantidad del
  pedido.»: ninguna petición puede ya producirlo. [Qué ve el Empacador]
- **R27**: El sistema DEBE permitir Terminar con excedente solo al actor con `empaque.modificar` que
  tiene el pedido en `EN_EMPAQUE` (QC-281 R14) y DEBE rechazar a cualquier otro como hoy, sin permiso
  nuevo. [Permiso]
- **R28**: La feature NO DEBE añadir dependencias de terceros. [¿Dependencias?]
- **R29**: El flujo «Terminar con excedente → lotes con lo envasado real → el pedido espera solo lo
  pedido → lo libre aparece como excedente entregable sin pedido» DEBE quedar cubierto por un E2E
  en `e2e/envases-reales-empaque.spec.ts` (inventario: `docs/checkpoints-proyecto.md > Flujos
  criticos`). [¿E2E?]

### Cobertura de las decisiones cerradas

| Decisión (fila de la tabla) | Requisitos |
|---|---|
| ¿Se puede envasar más que el pedido? | R1, R19, R25 |
| ¿Tope del excedente? | R1, R4, R23 |
| ¿Qué motivos? | R2, R23 |
| ¿Qué entra al inventario? | R9, R16 |
| ¿El pedido cuenta el excedente? | R12, R14, R17 |
| ¿De qué presentación es el excedente? | R6, R7 |
| Caso mixto sin superar el total | R5 |
| Coste | R10 |
| Qué ve el Empacador | R19, R20, R21, R22, R26 |
| Permiso | R27 |
| ¿E2E? | R29 |
| ¿Dependencias? | R28 |
| (P1) Caso mixto que supera el total | R6, R7, R12, R13 |
| QC-304 | Sin requisito propio: sus decisiones son las filas de arriba. |

## Preguntas abiertas

Ninguna.

## Decisiones cerradas (no reabrir)

| Fecha | Pregunta | Decisión |
|---|---|---|
| 2026-10-20 | ¿Se puede envasar más que el pedido? | Sí, con motivo obligatorio por línea que difiere. Reemplaza D1/R8/R15 de QC-281; Q3 de QC-170 sigue para el reparto antes de Comenzar. |
| 2026-10-20 | ¿Tope del excedente? | No. Solo el stock libre del envase (D2 de QC-281). |
| 2026-10-20 | ¿Qué motivos? | Los de «más» de QC-281 D7: Conteo físico, Error de carga, Otro con texto obligatorio (≤ 200, D21). |
| 2026-10-20 | ¿Qué entra al inventario? | Lo envasado real: lote = envases reales × contenido (R20 de QC-281). |
| 2026-10-20 | ¿El pedido cuenta el excedente? | No: espera solo lo pedido; el excedente queda libre en stock (tarjeta QC-290; cierra lo que `specs/QC-288-entrega-sin-pedido/design.md > §12` dejó a esta ficha). |
| 2026-10-20 | ¿De qué presentación es el excedente? | Por línea, frente a su plan: plan 5×1 L + 1×5 L, real 7×1 L + 1×5 L → 2 envases de 1 L libres. |
| 2026-10-20 | Caso mixto sin superar el total | Si lo envasado no supera la cantidad del pedido, no hay excedente: todo es del pedido (9×1 L + 0×5 L → todo al pedido). |
| 2026-10-20 | Coste | Entre todo lo envasado, mismo coste unitario (hereda D9/D20 de QC-281). |
| 2026-10-20 | Qué ve el Empacador | Aviso informativo en vez del error (texto en P2). |
| 2026-10-20 | Permiso | Hereda D10 de QC-281: solo el Empacador que comenzó, sin permiso nuevo. |
| 2026-10-20 | ¿E2E? | Sí (inventario, `docs/checkpoints-proyecto.md > Flujos criticos`). Se amplía `e2e/envases-reales-empaque.spec.ts`. |
| 2026-10-20 | ¿Dependencias? | Ninguna nueva. |
| 2026-10-20 | (P1) Caso mixto que supera el total: plan 5×1 L + 1×5 L, real 12×1 L + 0×5 L = 12 L | Lo libre nunca supera lo que excede el pedido (12 − 10 = 2 L), y sale de las líneas que pasaron su plan: 2 envases de 1 L libres. El pedido espera, por línea, envases reales − libres de esa línea (aquí 10×1 L + 0×5 L). Afecta al tope de entrega por presentación de QC-223 D3: el spec lo cubre. |
| 2026-10-20 | (P3) Varias líneas pasan su plan y el excedente no alcanza para todas | Mayor contenido primero; a igual contenido, orden del reparto (R7). Ej.: excedente 5 L, 1 L +4 y 5 L +1 → 1 libre de 5 L, 0 de 1 L. |
| 2026-10-20 | (P4) ¿Se muestran los libres fuera del aviso? | No por ahora: solo el aviso del diálogo; se ven como existencia del lote y en «Entrega sin pedido» (QC-288). Otra vista va en otra ficha. |
| 2026-10-20 | Pase `/design` | Se hace antes de aprobar el spec, sin excepción (`docs/perfil-agentes.md > Pase de diseño`). Cierra P2. |
| 2026-10-20 | (P2) Texto y tono del aviso | Aprobado el tablero `EmpaqueTerminar*.dc.html` (estado `excedente`): un aviso informativo encima del pie, detallado. Ej.: «Sobran 5,48 L sobre el pedido.» / «Quedan libres en stock: 1 envase de Galón 3,78 L, 1 envase de Botella 1 L.» Sin libres: «Ningún envase queda libre: lo que sobra no llega a un envase entero y sigue en el pedido.» Sin «(estimados)». |
| 2026-10-20 | QC-304 | Duplicado de esta ficha: cancelada, decisiones absorbidas aquí. |
