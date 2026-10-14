# QC-284 — lote-por-presentacion · requirements.md

> Zona: fullstack · Complejidad: — (la asigna el leader en F1.0) · depends_on: — · Rama: feature/QC-284-lote-por-presentacion
>
> **Alcance.** Las presentaciones de un pedido salen de la misma producción, pero QC-219 obliga a
> darle a cada línea un lote distinto, porque el lote es único en toda la empresa (QC-81). Esta
> ficha cambia la regla para que todas las presentaciones de una producción compartan lote, como
> en GS1 (lote + GTIN).
>
> - El lote deja de ser único en la empresa. Pasa a ser único por **producto + presentación +
>   lote**. Ej.: Crema 1 L y Crema 200 ml pueden llevar CR-2610; dos producciones de Crema 1 L no.
>   Un lote sin presentación (instrumentos) es único por producto.
> - Aplica a **todos los lotes**: producto terminado, insumos y envases. Ej.: Glicerina lote 2401 y
>   Alcohol lote 2401 conviven.
> - En acondicionamiento hay **un solo formulario por pedido**. Lote, vencimiento y día de
>   producción se escriben una vez y se guardan en todas las líneas de presentación. No se cambian
>   por línea.
> - Pedidos ya acondicionados con lotes distintos por línea: al corregirlos desde «Terminados» el
>   formulario sale vacío, con un aviso de que hoy las líneas tienen lotes distintos y cuáles son.
>   Al guardar, los tres datos pasan a todas las líneas. Si no se guarda, nada cambia.
> - Todo lo que hoy busca o valida un lote solo por su código pasa a hacerlo por producto +
>   presentación + lote: importación, ajuste, devoluciones, alta y el mensaje de
>   `batch_duplicate_lot`.
>
> **Se hereda sin cambio.** Distingue mayúsculas (QC-81). Dos empresas pueden repetir lote (QC-81).
> El correlativo automático sigue por empresa y continúa desde el más alto (QC-81). Fechas validadas
> en el servidor y en UTC (QC-219). Solo quien comenzó escribe (QC-219). Autorización en el
> service. Sin dependencias nuevas.
>
> **Lo que NO entra.** Crear el lote de una línea sin producción (QC-253). Reservar por vencimiento
> (QC-196). El lote real que usa el operador (QC-197).
>
> Acotado por el humano con `/afinar-feature` el 2026-10-14. El bloque de Alcance y la tabla de
> «Decisiones cerradas» transcriben la descripción del issue QC-284, que el leader entregó como
> fuente de verdad. `spec_author` no los reabre: su trabajo aquí es `## Requisitos (EARS)`.

## Requisitos (EARS)

> Notación EARS (`docs/specs.md`). Cada requisito cita entre corchetes las filas de «Decisiones
> cerradas» que lo originan, numeradas en el orden de la tabla:
>
> - **[D1]** la clave del lote · **[D2]** todos los lotes · **[D3]** un formulario por pedido ·
>   **[D4]** pedidos con lotes distintos · **[D5]** búsquedas y validaciones por la clave;
> - **[D6]** lo heredado · **[D7]** E2E · **[D8]** lo que reabre · **[D9]** lo que no entra ·
>   **[D10]** preguntas técnicas delegadas.
>
> Vocabulario fijo:
>
> - «la clave del lote» = producto + presentación + código de lote. Un lote **sin presentación**
>   tiene como clave producto + código.
> - «el código» = el texto de `lot`, exacto y sensible a mayúsculas (QC-81).
> - «el detalle», «quien acondiciona», «el permiso», «línea», «el lote de la línea», «línea con
>   datos», «hoy» y «pedido corregible» = lo mismo que en `specs/QC-219-…/requirements.md >
>   Vocabulario fijo`.
> - «línea con lote» = una línea que tiene lote de producción (asiento `production` de esa línea).
> - «los datos de lote» = lote, vencimiento y día de producción.
> - «el formulario» = la sección «Datos de lote» del detalle.
> - «pedido con datos uniformes» = un pedido con al menos una línea con lote, en el que **todas**
>   las líneas con lote son líneas con datos y sus tres datos coinciden.
> - «pedido sin datos» = un pedido en el que ninguna línea con lote es línea con datos.
> - «pedido con lotes distintos» = cualquier otro pedido con al menos una línea con lote: alguna
>   línea con lote tiene datos y otra no, o dos líneas con datos difieren en alguno de los tres.

### La clave del lote

**R1.** El sistema DEBE garantizar **en la base** que no existan dos lotes de la misma empresa con
el mismo producto, la misma presentación y el mismo código. Una comprobación hecha solo en el
código NO satisface este requisito. *(Sustituye QC-81 R11.)* [D1, D2, D8]

**R2.** El sistema DEBE garantizar **en la base** que no existan dos lotes **sin presentación** del
mismo producto con el mismo código. [D1, D2, D10]

**R3.** El sistema DEBE **admitir** dos lotes de la misma empresa con el mismo código cuando
difieren en el producto o en la presentación. En particular DEBE admitir:

- el mismo código en dos productos terminados de presentaciones distintas (Crema 1 L y Crema
  200 ml con `CR-2610`);
- el mismo código en dos insumos distintos (Glicerina `2401` y Alcohol `2401`);
- el mismo código en un insumo, un envase y un instrumento;
- el mismo código en dos lotes del mismo producto, uno con presentación y otro sin ella.

[D1, D2, D10]

**R4.** La comparación del código DEBE seguir siendo exacta y distinguir mayúsculas: `cr-2610` y
`CR-2610` no chocan. Dos empresas DEBEN poder seguir repitiendo cualquier clave. [D6]

**R5.** CUANDO el backend genera un lote, DEBE seguir calculándolo como el siguiente entero del más
alto de **todos** los lotes de solo dígitos de la empresa, sin mirar producto ni presentación (QC-81
R9, R16). Ejemplo: con `7` en Glicerina y `50` en Alcohol, el siguiente generado es `51` sea cual
sea el producto. [D6]

**R6.** CUANDO dos escrituras simultáneas dejan dos lotes con la misma clave, exactamente una DEBE
confirmarse. La otra NO DEBE dejar ninguna fila escrita:

- con lote tecleado, DEBE rechazarse con `batch_duplicate_lot`;
- con lote generado, DEBE reintentarse como dice QC-81 R15.

[D1, D6]

### Alta y mensaje

**R7.** SI el alta (manual o de un lote sobre un producto existente) trae un lote tecleado cuya
clave ya existe, ENTONCES el sistema DEBE rechazarla con `batch_duplicate_lot` sin escribir ni el
producto ni el lote. CUANDO el código solo existe con otra clave, el alta DEBE aceptarse y guardar
el lote tal cual. *(Sustituye QC-81 R13 en su condición.)* [D1, D5]

**R8.** El mensaje del catálogo para `batch_duplicate_lot` DEBE decir
«Ya existe un lote con ese valor para ese producto y presentacion.» (estilo del catálogo, sin
tildes). El código NO DEBE cambiar. [D5]

### Importación

**R9.** SI el lote de una fila ya existe con la misma clave que tendría el lote de la fila, en la
base o en una fila anterior del mismo archivo, ENTONCES su estado DEBE ser `duplicado` y NO DEBE
importarse. La vista previa y la confirmación DEBEN decir lo mismo. *(Precisa QC-209 R18: la clave
incluye la presentación del lote.)* [D5]

**R10.** CUANDO el código de una fila solo existe con otra clave, en la base o en una fila
anterior del archivo, la fila DEBE planificarse como si el código no existiera: `crear` o
`sumar lote`, según su producto. El motivo de error `lot_used_by_other_product` NO DEBE aparecer en
la vista previa ni en el resultado. *(Sustituye QC-209 R19.)* [D1, D5]

**R11.** CUANDO la confirmación choca en carrera con un lote escrito entre la vista previa y la
escritura, la fila DEBE quedar `duplicado` si la clave coincide. [D5]

### Ajuste y devoluciones

**R12.** El ajuste por conteo (QC-92) y la devolución por anulación de entrega DEBEN identificar el
lote por su identificador, nunca por su código. CUANDO dos lotes de la empresa comparten código,
DEBEN escribir solo en el lote pedido, y el listado de entregas del pedido DEBE mostrar el código
de cada lote entregado. [D5]

### Acondicionamiento: un formulario por pedido

**R13.** MIENTRAS quien acondiciona vea el detalle de su pedido en `EN_ACONDICIONAMIENTO`,
`TERMINADO` o `ENTREGADO`, el formulario DEBE mostrar **un solo** juego de campos «Lote»,
«Vencimiento» y «Día de producción» y un único botón «Guardar datos de lote». NO DEBE mostrar
campos por línea. Siguen las reglas de visibilidad de QC-219 R3 y las multiplataforma de QC-219 R5.
*(Sustituye QC-219 R1 y R2.)* [D3, D8]

**R14.** CUANDO se abre el formulario de un pedido con datos uniformes, sus tres campos DEBEN venir
rellenos con esos datos. CUANDO se abre el de un pedido sin datos, DEBEN venir vacíos y sin aviso.
[D3]

**R15.** CUANDO se abre el formulario de un pedido con lotes distintos, sus tres campos DEBEN venir
vacíos y el formulario DEBE mostrar un aviso que diga que hoy las líneas tienen lotes distintos y
liste, por cada línea en orden de alta, la línea y el código de su lote. Una línea sin lote se
lista como «sin lote». Vale en los tres estados de R13. [D4]

**R16.** Abrir el detalle, ver el formulario o el aviso, o salir sin guardar, NO DEBE escribir
ningún dato de lote ni cambiar ningún lote. [D4]

**R17.** MIENTRAS el pedido no tenga ninguna línea con lote, los tres campos y el botón DEBEN estar
deshabilitados. [D3, D9]

**R18.** CUANDO quien acondiciona guarda el formulario de un pedido corregible, el sistema DEBE
escribir, en una sola transacción, **el mismo** lote, vencimiento y día de producción en el lote de
**todas** las líneas con lote del pedido. NO DEBE cambiar de ningún lote la existencia, el coste
unitario, la fecha de compra, la presentación, el producto ni el contenido del envase, ni ningún
asiento. Cada lote DEBE seguir siendo el mismo registro (QC-219 R19). *(Sustituye QC-219 R6.)*
[D3, D4, D8]

**R19.** SI la entrada de guardar no es exactamente `{ orderId, lot, expiryDate, productionDate }`,
ENTONCES el sistema DEBE rechazar con `invalid_input` sin invocar ningún puerto. La forma válida
es:

- `orderId`, un uuid;
- `lot`, con las reglas del lote tecleado de QC-81: se recorta, entre 1 y 60 caracteres, y uno de
  solo dígitos, hasta 59;
- `expiryDate` y `productionDate`, con forma `AAAA-MM-DD` y días que existen en el calendario.

Una entrada con datos por línea (`lines`, `batchId`) NO es válida. *(Sustituye QC-219 R7.)*
[D3, D6]

**R20.** SI el vencimiento no es posterior a hoy, ENTONCES guardar DEBE rechazar con
`batch_expiry_not_future`. SI el día de producción es posterior a hoy, ENTONCES DEBE rechazar con
`batch_production_date_future`. En los dos casos, sin escribir ninguna línea. *(QC-219 R8 y R9 con
la entrada nueva.)* [D6]

**R21.** SI, para alguna línea con lote, otro lote de la empresa con el mismo producto y la misma
presentación que el de esa línea ya lleva el código enviado, ENTONCES guardar DEBE rechazar con
`batch_duplicate_lot` sin escribir ninguna línea. NO DEBE ser choque:

- el lote de otra línea del mismo pedido;
- un lote de otro producto o de otra presentación, del pedido que sea;
- escribir en un lote el código que ya tiene;
- un lote de otra empresa.

*(Sustituye QC-219 R10.)* [D1, D3, D8]

**R22.** CUANDO dos guardados simultáneos de pedidos distintos escriben el mismo código en dos lotes
con el mismo producto y la misma presentación, exactamente uno DEBE guardarse. El otro DEBE recibir
`batch_duplicate_lot` sin que se escriba ninguna de sus líneas. *(Sustituye QC-219 R11.)* [D1, D8]

**R23.** SI el pedido no tiene ninguna línea con lote, ENTONCES guardar DEBE rechazar con
`batch_not_found` sin escribir nada. *(Sustituye QC-219 R12: la entrada ya no trae lotes.)*
[D3, D9]

**R24.** Guardar DEBE comprobar en este orden, y la primera que falle decide el error:

1. el permiso: actor nulo o sin el permiso → `unauthorized`, sin invocar ningún puerto (QC-219 R13);
2. la entrada (R19);
3. el pedido, con los códigos y reglas de QC-219 R14;
4. las fechas (R20);
5. la existencia de líneas con lote (R23) y el choque (R21, R22).

[D6]

**R25.** SI guardar falla, ENTONCES el formulario DEBE mostrar el mensaje del catálogo en una región
`role="alert"`, conservar lo escrito y marcar con `aria-invalid` el campo culpable:

- «Lote» con `batch_duplicate_lot`;
- «Vencimiento» con `batch_expiry_not_future`;
- «Día de producción» con `batch_production_date_future`.

Con cualquier otro código, ningún campo se marca. *(Sustituye la marca por línea de QC-219 R5.)*
[D3]

**R26.** Terminar DEBE seguir exigiendo que todas las líneas del pedido sean líneas con datos
(QC-219 R4, R15–R17). CUANDO se guarda el formulario de un pedido `EN_ACONDICIONAMIENTO` en el que
todas sus líneas tienen lote, «Terminar» DEBE habilitarse. Una línea sin lote sigue bloqueando
Terminar. [D3, D9]

**R27.** CUANDO quien lo acondicionó guarda el formulario de un pedido `TERMINADO` o `ENTREGADO`
con lotes distintos, los tres datos DEBEN quedar iguales en todas sus líneas con lote, y el estado,
`finishedAt` y el equipo del pedido NO DEBEN cambiar. [D4]

### Base de datos

**R28.** CUANDO se aplica la migración UP de esta feature, el sistema DEBE:

- crear las garantías de R1 y R2 **antes** de quitar la de (empresa, código), de modo que en ningún
  instante la tabla quede sin unicidad de lote;
- no modificar ninguna fila.

[D1, D2, D10]

**R29.** CUANDO se aplica `db:rollback` sobre la migración de esta feature:

- SI alguna empresa tiene dos lotes con el mismo código, ENTONCES el rollback DEBE detenerse entero,
  con un mensaje que diga cuántos códigos repetidos hay y qué hacer, sin dejar ningún índice a
  medias;
- si no, la base DEBE quedar como antes de la migración: con la unicidad (empresa, código) y sin
  las garantías de R1 y R2.

[D10]

### Verificación y alcance

**R30.** El E2E DEBE recorrer, con los roles reales del seed, un pedido `EN_ACONDICIONAMIENTO` del
acondicionador 1 con dos líneas de presentaciones distintas y sus dos lotes de producción:

- el detalle muestra un solo formulario, vacío, y «Terminar» deshabilitado;
- guardar el código del lote de otra producción de la presentación de la línea 1 se rechaza con el
  mensaje de `batch_duplicate_lot`, y ningún lote del pedido cambia;
- guardar un código que ya tiene un envase de la empresa (otro producto) se acepta;
- tras guardar, los dos lotes del pedido llevan el mismo código, vencimiento y día de producción;
- «Terminar» se habilita, confirma y aterriza en «Por acondicionar» con el aviso.

Los rechazos de fechas de QC-219 R28 DEBEN seguir en el recorrido. *(Sustituye QC-219 R28.)*
[D3, D7]

**R31.** El sistema DEBE probar R1–R29 con tests unitarios, de integración y guardias, y las
guardias DEBEN seguir en verde. Esta feature NO DEBE añadir ninguna dependencia a `package.json`.
[D6, D7]

**R32.** Esta feature NO DEBE crear lotes para líneas sin producción, ni leer el vencimiento para
reservar o consumir, ni tocar el lote de los insumos que usa el operador. [D9]

### Cobertura de la tabla de decisiones

| Decisión | Requisitos |
|---|---|
| D1 Clave producto + presentación + lote | R1, R2, R3, R6, R7, R10, R21, R22, R28 |
| D2 Todos los lotes | R1, R2, R3, R28 |
| D3 Un formulario por pedido | R13, R14, R17, R18, R19, R21, R23, R25, R26, R30 |
| D4 Pedidos con lotes distintos | R15, R16, R18, R27 |
| D5 Búsquedas y validaciones por la clave, y el mensaje | R7, R8, R9, R10, R11, R12 |
| D6 Lo heredado | R4, R5, R6, R19, R20, R24, R31 |
| D7 E2E | R30, R31 |
| D8 Reabre QC-219 D2, D3, R10 y la unicidad de QC-81 | R1, R13, R18, R21, R22 |
| D9 Lo que no entra | R17, R23, R26, R32 |
| D10 Preguntas técnicas delegadas | R2, R3, R28, R29 |

## Preguntas abiertas

**Ninguna de negocio.** Las dos técnicas que la ficha delegó quedan cerradas en `design.md`:

- **Presentación vacía en el índice único** → dos índices únicos parciales (`design.md > 1.1`).
  Consecuencia que se aprueba con el spec: un lote con presentación y otro sin ella del mismo
  producto pueden compartir código (R3, último punto).
- **Orden de la migración** → primero se crean los dos índices nuevos y después se quita el viejo;
  el rollback comprueba antes de recrear el viejo (`design.md > 1.2`).

Una interpretación, que se aprueba con el spec (`design.md > 6`, N2): el alcance dice «al
corregirlos desde «Terminados»», y R15 aplica el mismo formulario vacío con aviso en los tres
estados en que se ve el formulario, incluido un `EN_ACONDICIONAMIENTO` que quedó con datos a medias
antes de esta ficha.

## Decisiones cerradas (no reabrir)

| Fecha | Pregunta | Decisión |
|---|---|---|
| 2026-10-14 | ¿De qué depende la unicidad del lote? | **Producto + presentación + lote**, no la empresa entera. Crema 1 L y Crema 200 ml pueden llevar CR-2610; dos producciones de Crema 1 L no. Un lote sin presentación (instrumentos) es único por producto |
| 2026-10-14 | ¿A qué lotes aplica? | **A todos**: producto terminado, insumos y envases. Glicerina lote 2401 y Alcohol lote 2401 conviven |
| 2026-10-14 | ¿Cómo se escribe en acondicionamiento? | **Un solo formulario por pedido.** Lote, vencimiento y día de producción se escriben una vez y se guardan en todas las líneas de presentación. No se cambian por línea |
| 2026-10-14 | ¿Qué pasa con los pedidos ya acondicionados con lotes distintos por línea? | Al corregirlos desde «Terminados», **formulario vacío con un aviso** de que hoy las líneas tienen lotes distintos y cuáles son. Al guardar, los tres datos pasan a todas las líneas. Si no se guarda, nada cambia |
| 2026-10-14 | ¿Qué más cambia? | Todo lo que hoy busca o valida un lote solo por su código pasa a **producto + presentación + lote**: importación, ajuste, devoluciones, alta y el mensaje de `batch_duplicate_lot` |
| 2026-10-14 | ¿Qué se hereda sin cambio? | Distingue mayúsculas (QC-81). Dos empresas pueden repetir lote (QC-81). El correlativo automático sigue por empresa y continúa desde el más alto (QC-81). Fechas validadas en el servidor y en UTC (QC-219). Solo quien comenzó escribe (QC-219). Autorización en el service. Sin dependencias nuevas |
| 2026-10-14 | ¿E2E? | **Sí:** dos presentaciones de un pedido guardan el mismo lote y terminan, y el mismo lote en la misma presentación de otra producción se rechaza |
| 2026-10-14 | ¿Qué reabre? | **QC-219 D2, D3 y R10, y la regla de unicidad de QC-81** |
| 2026-10-14 | ¿Qué no entra? | Crear el lote de una línea sin producción (**QC-253**). Reservar por vencimiento (**QC-196**). El lote real que usa el operador (**QC-197**) |
| 2026-10-14 | ¿Preguntas abiertas para el spec? | **Ninguna de negocio.** Las técnicas las resuelve `spec_author`: cómo se trata la presentación vacía en el índice único y el orden de la migración del índice |
