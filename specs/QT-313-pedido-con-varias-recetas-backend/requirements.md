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

_Pendiente: los escribe spec_author (F1.2)._

## Preguntas abiertas

- **Prioridad y cliente:** ¿son del pedido o de cada receta? No se preguntó al acotar.
- **Caducidad de la reserva** (15 días, `orders.reserved_at`): ¿cuenta por receta o por pedido?
- **Estado del pedido entero:** ¿cómo se deriva de los estados de sus recetas, para listados y
  filtros?
- **Avisos QC-293 y QC-294** (pedido asignado y listo, pedido bloqueado): ¿se mandan por receta
  o por pedido?

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
