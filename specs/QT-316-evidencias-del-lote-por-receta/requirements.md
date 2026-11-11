# QT-316 — evidencias-del-lote-por-receta · requirements.md

> **Zona** fullstack · **Complejidad** medium · **depends_on** QT-315 · **Rama** `feature/QT-316-evidencias-del-lote-por-receta`
>
> **Alcance.** En Inventario › Producto terminado, el lote de un pedido de varias recetas solo
> muestra las fotos de **su** receta, es decir, de la línea del pedido que lo produjo. Esto vale
> para la columna «Evidencia» (el conteo) y para el diálogo de evidencias. Cuando el pedido tiene
> más de una receta, el título del diálogo la nombra. Un pedido de una sola receta se ve como hoy.
>
> **Lo que NO entra.**
> - El Recorrido y las pantallas de planta: ya son por receta (QT-315).
> - Cómo se toman o se guardan las fotos: cada foto ya lleva su línea.
> - Migraciones: no hacen falta.
>
> Sembrado por `/afinar-feature` el 2026-11-11. El bloque de Alcance y la tabla de «Decisiones
> cerradas» los fijó el humano ANTES del spec. `spec_author` los respeta, no los reabre y no los
> reescribe: su trabajo aquí es `## Requisitos (EARS)`.

## Requisitos (EARS)

> Escritos por `spec_author` (F1.2, 2026-11-11). Vocabulario:
> - **Receta**: una línea del pedido (QT-313). «Receta» y «línea» son lo mismo.
> - **Lote de un pedido**: lote de producto terminado con asiento `production`. **Su receta** es la
>   línea del pedido que guarda ese asiento.
> - **Receta viva**: no quitada; una cancelada sigue viva (QT-315). «Una sola receta viva» es la
>   misma regla que QT-315 R3 y R29.
> - **La ficha**: Inventario › Producto terminado › pestaña «Lotes», con su columna «Evidencia» y
>   su diálogo de evidencias (QC-271).
> - Entre corchetes, la fila de `## Decisiones cerradas` (o la pregunta abierta) que cubre cada
>   requisito.

### Columna «Evidencia»

- **R1** — CUANDO se pinta la pestaña «Lotes» de la ficha con la columna «Evidencia», el sistema
  DEBE mostrar en cada lote de un pedido el número de fotos **de su receta**, y NO DEBE sumar las
  fotos de las demás recetas del pedido. *[Conteo de la columna «Evidencia»]*
- **R2** — SI la receta de un lote no tiene ninguna foto, ENTONCES su celda DEBE mostrar «—» y no
  ofrecer el botón de evidencia, aunque otra receta del mismo pedido sí tenga fotos.
  *[Conteo de la columna «Evidencia»]*
- **R3** — Un lote sin pedido de origen DEBE seguir mostrando «—», como hoy. *[Conteo de la columna
  «Evidencia»]*
- **R4** — El sistema DEBE obtener los conteos de todos los lotes de una página con **una sola**
  lectura, sea cual sea el número de lotes y de pedidos de esa página. *[Conteo de la columna
  «Evidencia»]*
- **R5** — El listado de lotes de la ficha DEBE identificar, para cada lote de un pedido, la receta
  del pedido que lo produjo; para un lote sin asiento `production` DEBE no identificar ninguna.
  *[Conteo de la columna «Evidencia» · Lo que ya existe]*

### Diálogo de evidencias

- **R6** — CUANDO se abre el diálogo de evidencias de un lote, el sistema DEBE mostrar solo las
  fotos de la receta de ese lote, agrupadas por fase y paso como hoy, y NO DEBE mostrar ninguna foto
  de otra receta del pedido. *[Alcance · Conteo de la columna «Evidencia»]* Los grupos por fase, en
  R20.
- **R7** — DONDE el pedido del lote tiene más de una receta viva, el título del diálogo DEBE ser
  «Evidencia · Lote L · Pedido N · <receta>», con el nombre de la receta del lote, y la descripción
  DEBE decir «Fotos tomadas durante la ejecución de esta receta del pedido. Solo consulta.».
  *[Título del diálogo · Pase `/design`]*
- **R8** — MIENTRAS el pedido del lote tenga una sola receta viva, el título, la descripción, el
  conteo de la celda y las fotos del diálogo DEBEN ser los de hoy, sin nombrar la receta; la única
  diferencia es el grupo «Acondicionamiento» de R20. *[Título del diálogo · P2]*
- **R9** — SI el nombre de la receta del lote no se puede resolver, ENTONCES el título y la
  descripción DEBEN ser los de hoy, sin nombrar receta, y las fotos DEBEN salir igual. *[P3]*
- **R10** — Los estados del diálogo DEBEN ser los de QC-271: mientras lee, tantas casillas esqueleto
  como fotos tiene la receta del lote (entre 1 y el tope por paso); si la lectura falla, el error con
  «Reintentar»; si la firma de las fotos falla, los grupos con su cantidad y sin fotos, y la causa
  al log, nunca a la pantalla. *[Pase `/design` (Estados)]*
- **R11** — En el teléfono el diálogo DEBE ocupar la pantalla completa y su título DEBE partirse en
  varias líneas, palabras largas incluidas, sin desplazamiento horizontal. En tablet DEBE
  comportarse como en QC-271. *[Pase `/design` (Tablet, Teléfono)]*

### Reglas de la lectura

- **R12** — Las fotos de una receta DEBEN salir y contar aunque su receta se haya borrado del
  catálogo, la línea se haya quitado del pedido, el pedido esté dado de baja o su paso ya no pida
  evidencia, igual que la lectura del pedido entero de la rama base. *[Fotos de una receta quitada
  · P3]*
- **R13** — La lectura de las fotos de una receta y la de sus conteos DEBEN exigir `pedidos.consultar`
  en el caso de uso, antes de leer ningún dato, con el mismo error que la lectura del pedido entero
  de la rama base (`unauthorized`). Sin
  ese permiso, la ficha NO DEBE pintar la columna ni pedir los conteos, como hoy. El catálogo de
  permisos NO DEBE cambiar. *[Permisos]*
- **R14** — SI la lectura de las fotos nombra un pedido inexistente o de otra empresa, una línea de
  otro pedido o de otra empresa, una línea inexistente, o ids mal formados, ENTONCES el sistema DEBE
  responder `order_not_found` sin devolver ninguna foto ni firmar ninguna lectura. *[Receta ajena o
  inexistente]*
- **R15** — CUANDO se piden conteos, una línea de otro pedido o de otra empresa NO DEBE contar ni
  salir en la respuesta; SI la petición trae más de 25 recetas o algún id mal formado, ENTONCES el
  sistema DEBE responder `invalid_input` sin leer la base. *[Receta ajena o inexistente]*
- **R16** — La lectura de las fotos de una receta DEBE reutilizar `readOrderEvidenceByLine` (QT-315),
  y `readOrderEvidenceByLine`, el Recorrido (`getExecutionEvidence`) y las pantallas de planta NO
  DEBEN cambiar de comportamiento: sus tests de hoy siguen verdes sin tocarlos. *[Lo que ya existe
  · Alcance (Lo que NO entra)]*
- **R17** — La consulta DEBE ser solo de lectura: no DEBE escribir en la base, mover inventario ni
  tocar importes. *[¿Hace falta E2E?]*
- **R18** — Esta ficha NO DEBE añadir tablas, columnas, migraciones, permisos ni dependencias:
  `db/schema.prisma`, `db/migrations/`, el catálogo de permisos y `package.json` DEBEN quedar como en
  la rama base. *[Alcance (Lo que NO entra) · Permisos]*

### Verificación

- **R19** — `e2e/consulta-de-evidencia.spec.ts` DEBE ampliarse con un pedido de **dos** recetas, cada
  una con su lote: el lote de la receta con fotos (de fabricación, envasado y acondicionamiento)
  muestra su conteo y su diálogo solo con sus fotos, los tres grupos y el nombre de la receta en el
  título; el lote de la receta sin fotos muestra «—». Los casos de hoy
  (R27 y R28 de QC-271) DEBEN seguir pasando. No se crea ningún E2E nuevo. *[¿Hace falta E2E? ·
  P2]*

### Decisiones P1 y P2

- **R20** — El diálogo DEBE mostrar, tras «Fabricación» y «Envasado», el grupo «Acondicionamiento»
  con las fotos de acondicionamiento de la receta, por paso, igual que los otros dos grupos y con su
  total en la cabecera. Un grupo sin fotos NO DEBE pintarse. La suma de los totales de los grupos
  pintados DEBE ser igual al conteo de la celda del lote. *[P2 · Pase `/design`]*
- **R21** — La lectura y el conteo de las fotos de **todo el pedido** DEBEN dejar de existir:
  `getOrderEvidence`, `countOrderEvidence`, sus actions `getOrderEvidenceAction` y
  `countOrderEvidenceAction`, y lo que solo ellos usan. Ni la fachada de `asignaciones`, ni su
  barril, ni `order-evidence-actions.ts` DEBEN exponerlos, y ningún archivo de `app/`,
  `components/`, `lib/` ni `tests/` DEBE nombrarlos. Esto supera QT-315 R34. *[P1 · P4]*

### Cobertura de la tabla de decisiones

| Decisión (fila) | Requisitos |
|---|---|
| Conteo de la columna «Evidencia» | R1, R2, R3, R4, R5, R6 |
| Título del diálogo | R7, R8 |
| ¿Hace falta E2E? | R17, R19 |
| Permisos | R13, R18 |
| Receta ajena o inexistente | R14, R15 |
| Fotos de una receta quitada | R12 |
| Lo que ya existe | R5, R16 |
| Alcance (Lo que NO entra: Recorrido, planta, migraciones) | R16, R18 |
| Pase `/design` aprobado (`EvidenciaLoteVariasRecetas*`) | R7, R10, R11, R20 |
| P1 — retirar las lecturas del pedido entero | R21 |
| P2 — mostrar acondicionamiento | R20, R19 |
| P3 — receta de una línea quitada | R9, R12, R14 |
| P4 — `readOrderEvidence` y `countByOrders` sin consumidor | R21 |

## Preguntas abiertas

Ninguna.

## Decisiones cerradas (no reabrir)

| Fecha | Pregunta | Decisión |
|---|---|---|
| 2026-11-11 | Conteo de la columna «Evidencia» | **Solo las fotos de la receta del lote.** Si esa receta no tiene fotos, la columna muestra «—», aunque otra receta del pedido sí tenga. |
| 2026-11-11 | Título del diálogo | **Añadir la receta:** «Evidencia · Lote L · Pedido N · <receta>». Con una sola receta viva, el título queda como hoy (la misma regla que QT-315 R29). |
| 2026-11-11 | ¿Hace falta E2E? | **Ampliar `e2e/consulta-de-evidencia.spec.ts`** con un pedido de dos recetas: cada lote muestra solo sus fotos y su conteo. No hay E2E nuevo. El resto va en unit e integración. Es solo lectura: no mueve inventario ni importes. |
| 2026-11-11 | Permisos | Heredado: `pedidos.consultar`, como hoy. No se crea ningún permiso. La autorización se valida en el caso de uso. |
| 2026-11-11 | Receta ajena o inexistente | Heredado de QT-313 R43: una línea de otro pedido o de otra empresa se trata igual que un pedido inexistente. |
| 2026-11-11 | Fotos de una receta quitada | Heredado: las fotos salen aunque la receta se haya quitado o su paso ya no pida evidencia, igual que con `readOrderEvidence` hoy. |
| 2026-11-11 | Lo que ya existe | Se reutiliza la lectura por línea `readOrderEvidenceByLine` de QT-315. No se rehace. |
| 2026-11-11 | P1 — ¿Se retiran `getOrderEvidence` y `countOrderEvidence`? | **Se retiran en esta ficha**, con sus actions (`getOrderEvidenceAction` y `countOrderEvidenceAction`), sus tests y sus entradas en los censos (`asignaciones-facade`, `finished-product-route-contract`, `session-once-per-request-actions` y los que aparezcan). `readOrderEvidence` se queda solo si tiene otro consumidor. QT-315 R34 queda superado, con la justificación en `design.md`. El cambio en `asignaciones` deja de ser solo aditivo. |
| 2026-11-11 | P2 — ¿Qué fases cuenta la columna? | **Se muestra el acondicionamiento.** El diálogo suma el grupo «Acondicionamiento» con sus fotos por paso, igual que los otros. Un grupo vacío no se pinta. Así el conteo de la celda coincide con lo que se ve. Tablero actualizado: `docs/diseno/canvas/EvidenciaLoteVariasRecetas.dc.html` (`3080a2ebd`). |
| 2026-11-11 | P3 — Receta cuya línea se quitó del pedido | **La recomendación del spec.** Sus fotos salen y cuentan, sin nombre de receta: el título queda como hoy. Una línea quitada sin fotos responde `order_not_found`. No se toca el contrato de `pedidos`. |
| 2026-11-11 | P4 — `readOrderEvidence` y `countByOrders` sin consumidor | **Se retiran también, en la misma task que P1.** `readOrderEvidenceByLine` se queda con el código común. Los casos de `read-order-evidence.test.ts` pasan a la lectura por línea sin perder ninguno. Lo aprobó el humano junto con el spec. |
