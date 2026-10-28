# QC-307 — precio-de-venta-del-pedido · requirements.md

Zona: `fullstack` · Complejidad: `medium` · `depends_on`: ninguna · Épica: QC-31 Pedidos ·
Rama: `feature/QC-307-precio-de-venta-del-pedido`

> **Lo que entra.** El pedido gana un **precio de venta** opcional para el **pedido entero**. Se
> escribe a mano al registrarlo y se edita igual que el resto del pedido. Hace falta:
> - una columna nueva;
> - la validación en los casos de uso de crear y editar;
> - el campo en el formulario;
> - el valor en la tabla de pedidos y en el detalle.
>
> Esta ficha deroga «no existe ningún precio de venta» (QC-123 `[D1]`) y enmienda
> `docs/architecture.md > Preguntas abiertas del dominio`, punto 4. La enmienda la hace la propia
> feature.
>
> **Lo que NO entra.**
> - El margen (comparar el precio con el coste) y los informes de rentabilidad: van a **QC-308**,
>   bloqueada por esta.
> - La facturación: el ERP no factura (`docs/architecture.md`, punto 4). No tiene ficha.
> - Ordenar o filtrar por el precio.
> - La moneda: sigue implícita. La pregunta 5 del dominio sigue abierta.
> - El coste (`ingredientsCost`): no se toca ni se sustituye.
>
> Sembrado por `/afinar-feature` el 2026-10-22. El bloque de Alcance y la tabla de «Decisiones
> cerradas» los fijó el humano ANTES del spec. `spec_author` los respeta, no los reabre y no los
> reescribe: su trabajo aquí es `## Requisitos (EARS)`.

## Requisitos (EARS)

> Escritos por `spec_author` (F1.2, 2026-10-22). «Precio» es siempre el **precio de venta del
> pedido**. «Edición general» es la edición del formulario de pedido (`updateOrder`), distinta de
> la edición acotada del reparto y del cambio de cliente. Entre corchetes, la fila de
> `## Decisiones cerradas` que cubre cada requisito.

### Qué es el precio

- **R1** — El sistema DEBE guardar, como mucho, **un** precio por pedido, referido al pedido
  entero: un solo importe que no depende de la cantidad ni de las líneas del reparto en
  presentaciones, y que ninguna línea del reparto lleva. *[¿Vuelve a existir? · ¿A qué se refiere?]*
- **R2** — El sistema DEBE guardar el precio en la tabla de pedidos como decimal de 14 dígitos
  con 4 decimales, en una columna con nombre en inglés, y DEBE transportarlo entre capas como
  **cadena decimal** con 4 decimales exactos, nunca como número de coma flotante. *[¿Qué tipo
  tiene? · ¿Qué forma tiene la tabla?]*
- **R3** — El sistema NO DEBE guardar ni pedir una moneda con el precio: ni columna, ni campo de
  formulario, ni clave en la entrada. SI la entrada de alta o de edición trae una clave de moneda,
  ENTONCES el sistema DEBE descartarla sin guardarla. *[¿Lleva moneda?]*

### Alta

- **R4** — CUANDO se registra un pedido sin precio (el dato ausente, vacío o solo con espacios),
  el sistema DEBE crearlo **sin precio**. *[¿Es obligatorio?]*
- **R5** — CUANDO se registra un pedido con un precio que es un decimal no negativo de hasta 10
  dígitos enteros y hasta 4 decimales, el sistema DEBE crearlo con ese precio exacto.
  *[¿Es obligatorio? · ¿Qué tipo tiene?]*
- **R6** — CUANDO el precio indicado es **0**, el sistema DEBE guardarlo como 0 y devolverlo como
  `0.0000`, distinto de «sin precio», en todas sus salidas. *[¿Se admite 0?]*
- **R7** — SI el precio indicado es negativo, ENTONCES el sistema DEBE rechazar el alta o la
  edición con el código `invalid_input` y no escribir nada. *[¿Se admite 0?]*
- **R8** — SI el precio indicado no es un decimal válido (texto, coma decimal, notación
  exponencial, más de 4 decimales o más de 10 dígitos enteros), ENTONCES el sistema DEBE rechazar
  el alta o la edición con el código `invalid_input` y no escribir nada. *[¿Qué tipo tiene?]*
- **R9** — La base de datos DEBE rechazar cualquier escritura que deje un precio negativo en un
  pedido, aunque no pase por los casos de uso. *[¿Se admite 0?]*

### Edición

- **R10** — CUANDO se guarda una edición general de un pedido, el sistema DEBE sustituir el
  precio guardado por el enviado: un valor nuevo, 0, o ninguno (vacío quita el precio).
  *[¿Se edita después del alta? · ¿Es obligatorio?]*
- **R11** — MIENTRAS el estado del pedido no admita la edición general, el sistema DEBE rechazar
  también el cambio de precio con el mismo código que rechaza el resto de la edición, y no
  escribir nada. *[¿Se edita después del alta?]*
- **R12** — CUANDO una edición general cambia el precio, sola o junto con el cliente, el sistema
  DEBE guardar el precio nuevo, y también el cliente nuevo si cambió. *[¿Se edita después del alta?]*
- **R13** — CUANDO se cambia solo el cliente de un pedido (por la edición general o por el cambio
  de cliente), se edita su reparto por la edición acotada, se cancela o se da de baja, el sistema
  DEBE conservar el precio guardado sin cambios. *[¿Se edita después del alta? · ¿Qué forma tiene
  la tabla?]*
- **R14** — SI la edición acotada del reparto recibe un precio, ENTONCES el sistema DEBE rechazarla
  con el código `invalid_input` y no escribir nada. *[¿Se edita después del alta?]*
- **R15** — SI quien registra o edita un pedido no tiene el permiso `pedidos.modificar`,
  ENTONCES el sistema DEBE rechazar la operación con el código `unauthorized` antes de validar
  la entrada y sin escribir nada. El catálogo de permisos NO DEBE cambiar. *[¿Se edita después
  del alta?]*

### Lectura

- **R16** — El sistema DEBE devolver el precio (cadena decimal con 4 decimales, o ausencia de
  precio) en la ficha de un pedido y en cada fila del listado de pedidos, que exigen el permiso
  `pedidos.consultar`. SI quien consulta no lo tiene, ENTONCES el sistema DEBE rechazar con
  `unauthorized` sin leer ningún pedido. *[¿Quién lo ve? · ¿Dónde se muestra?]*
- **R17** — El sistema NO DEBE incluir el precio en ningún dato que el módulo de pedidos entrega
  a `asignaciones` ni en ninguna salida de `asignaciones` (lista de pedidos asignados, ejecución,
  empaque, acondicionamiento, terminados y pedidos de la empresa), aunque el pedido tenga precio.
  *[¿Quién lo ve?]*
- **R18** — CUANDO se aplica la migración que crea la columna, el sistema DEBE dejar **sin precio**
  todos los pedidos que ya existían, sin rellenarlos con 0; y la migración de reversión DEBE
  quitar la columna y su restricción. *[¿Qué pasa con los pedidos existentes?]*

### Pantalla

- **R19** — La tabla de pedidos DEBE mostrar una columna «Precio de venta» con el precio en el
  mismo formato que las columnas de coste (dos decimales, separador de miles y el valor exacto
  como título); SI el pedido no tiene precio, ENTONCES la celda DEBE mostrar el marcador de
  ausencia; un precio 0 DEBE mostrarse como importe cero, no como ausencia. La tarjeta del
  teléfono DEBE mostrar el mismo dato con su rótulo. *[¿Dónde se muestra? · ¿Se admite 0?]*
- **R20** — La columna del precio NO DEBE ordenar ni filtrar. SI una consulta del listado pide
  ordenar o filtrar por el precio, ENTONCES el sistema DEBE omitir ese criterio y anotarlo, igual
  que con cualquier campo no declarado. *[¿Dónde se muestra?]*
- **R21** — El formulario de alta y de edición del pedido DEBE ofrecer un campo opcional «Precio
  de venta». En la edición DEBE venir precargado con el precio guardado, o vacío si no tiene.
  SI el valor no pasa la validación (R7, R8), ENTONCES el formulario DEBE señalar el error en ese
  campo sin enviar y sin perder lo escrito. *[¿Dónde se muestra? · ¿Es obligatorio?]*
- **R22** — CUANDO alguien con `pedidos.modificar` registra desde la pantalla un pedido con
  precio, el sistema DEBE mostrar ese precio en la columna de la tabla y precargado al reabrir
  el pedido para editarlo (recorrido E2E). *[¿Hace falta E2E?]*

### Lo que el precio no toca

- **R23** — El sistema NO DEBE derivar ningún valor del precio: ni margen, ni total, ni
  comparación con el coste. El coste estimado y el coste real de un pedido DEBEN ser los mismos
  con precio que sin él. *[¿Se compara con el coste? · ¿Vuelve a existir?]*

### Cobertura de la tabla de decisiones

| Decisión (fila) | Requisitos |
|---|---|
| ¿Vuelve a existir un precio de venta? | R1, R23 (y la enmienda de `docs/architecture.md`, task T9) |
| ¿A qué se refiere el precio? | R1 |
| ¿Es obligatorio? | R4, R5, R10, R21 |
| ¿Se admite 0? | R6, R7, R9, R19 |
| ¿Se edita después del alta? | R10, R11, R12, R13, R14, R15 |
| ¿Dónde se muestra? | R16, R19, R20, R21 |
| ¿Quién lo ve? | R16, R17 |
| ¿Lleva moneda? | R3 |
| ¿Qué pasa con los pedidos existentes? | R18 |
| ¿Qué tipo tiene y cómo viaja? | R2, R5, R8 |
| ¿Se compara con el coste (margen)? | R23 |
| ¿Hace falta E2E? | R22 |
| ¿Qué forma tiene la tabla? (QC-4) | R2, R13 |

## Preguntas abiertas

Ninguna de alcance. Una de proceso, para confirmar al aprobar el spec:

- **P1 — Pase `/design`.** El spec no crea ningún componente: el campo reutiliza `OrderField` y
  la columna reutiliza la celda de importe y `withCardFieldLabel`. Se acoge a la excepción de
  `docs/perfil-agentes.md > Pase de diseño` igual que QC-305 con su columna de coste real
  (`design.md > Lo que ya existe > UI`). Si el humano pide tablero, las tasks de UI (T6, T7)
  esperan a él.

## Decisiones cerradas (no reabrir)

| Fecha | Pregunta | Decisión |
|---|---|---|
| 2026-10-22 | ¿Vuelve a existir un precio de venta? | **Sí.** **Deroga QC-123 `[D1]`**. También deroga la premisa de QC-35bis (2026-09-07, «un pedido es receta + cantidad»), pero solo en lo que toca al precio: la unidad no vuelve. Esta feature enmienda `docs/architecture.md`, punto 4: el precio de venta existe en el pedido, se escribe a mano y no sustituye al coste |
| 2026-10-22 | ¿A qué se refiere el precio? | Al **pedido entero**: un solo importe. No es un precio por unidad de cantidad ni por presentación, y no depende de `quantity` ni de `OrderPresentationLine`. Se aparta de QC-33 (precio unitario) por decisión del humano |
| 2026-10-22 | ¿Es obligatorio? | **No.** Es opcional en el alta y en la edición. Vacío = sin precio |
| 2026-10-22 | ¿Se admite 0? | **Sí.** 0 = se regala, y no es lo mismo que vacío. Un precio **negativo nunca** se acepta: lo rechazan el caso de uso y un `CHECK` en la base |
| 2026-10-22 | ¿Se edita después del alta? | **Sí, como el resto del pedido**: en el mismo formulario, con las mismas reglas de edición y con `pedidos.modificar`. **No nace permiso nuevo** |
| 2026-10-22 | ¿Dónde se muestra? | **En una columna de la tabla de pedidos y en el detalle/formulario.** Solo se muestra: no se ordena ni filtra. *Mismo criterio que QC-123 `[D12]`* |
| 2026-10-22 | ¿Quién lo ve? | Quien tiene **`pedidos.consultar`**. La vía `asignaciones` (Operador) **no lleva el precio**. *Heredado de QC-123 `[D10]`* |
| 2026-10-22 | ¿Lleva moneda? | **No.** La moneda es implícita y no se guarda. La pregunta 5 del dominio sigue abierta. *Heredado de QC-123 `[D11]`* |
| 2026-10-22 | ¿Qué pasa con los pedidos existentes? | Quedan **sin precio** (vacío). No se rellenan con 0. *Mismo criterio que QC-123 `[D9]`* |
| 2026-10-22 | ¿Qué tipo tiene y cómo viaja? | Es `decimal(14,4)`, nunca `float`, y viaja como **cadena decimal**. **No entra `decimal.js`**. *Heredado de QC-33, QC-68 y QC-123 `[D14]`* |
| 2026-10-22 | ¿Se compara con el coste (margen)? | **No entra.** Va a **QC-308**, creada el mismo día y bloqueada por esta |
| 2026-10-22 | ¿Hace falta E2E? | **Sí.** Un recorrido: registrar un pedido con precio y verlo guardado al reabrirlo y en la tabla. `CHECKPOINTS.md` lo exige para los flujos con importes, y esta ficha tiene pantalla |
| 2026-09-01 | ¿Qué forma tiene la tabla? | Identificadores de base en inglés y borrado lógico. *Heredado de QC-4* |
