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

_Pendiente: los escribe spec_author (F1.2)._

## Preguntas abiertas

Ninguna.

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
