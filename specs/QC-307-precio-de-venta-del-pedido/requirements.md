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

_Pendiente: los escribe spec_author (F1.2)._

## Preguntas abiertas

Ninguna.

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
