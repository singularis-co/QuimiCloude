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

_Pendiente: los escribe spec_author (F1.2)._

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
