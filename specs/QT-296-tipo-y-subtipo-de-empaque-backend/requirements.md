# QT-296 — tipo-y-subtipo-de-empaque-backend · requirements.md

> **Zona** backend · **Complejidad** high · **depends_on** QC-158, QC-195, QC-131 ·
> **Rama** `feature/QT-296-tipo-y-subtipo-de-empaque-backend`
>
> **Alcance.** Cada línea del catálogo del proveedor guarda su tipo (materia prima, herramienta,
> empaque) y, si es empaque, su subtipo (envase, tapa, medidor, otro). La lectura del PDF los
> propone, y el alta y la edición manuales de la línea los admiten. Los productos de empaque del
> inventario ganan el mismo subtipo, también en la importación desde Excel. Solo el envase exige
> presentación, y el selector de envases del pedido muestra solo envases.
>
> **Lo que NO entra.** Toda la UI → **QT-297**. Descontar tapas y medidores al terminar el empaque
> → **QT-298** `consumo-de-tapas-y-medidores-al-empacar`. Reclasificar con IA las líneas de
> catálogo ya guardadas → no se hace.
>
> Sembrado por `/afinar-feature` el 2026-10-23. El bloque de Alcance y la tabla de «Decisiones
> cerradas» los fijó el humano ANTES del spec. `spec_author` los respeta, no los reabre y no los
> reescribe: su trabajo aquí es `## Requisitos (EARS)`.

## Requisitos (EARS)

_Pendiente: los escribe spec_author (F1.2)._

## Preguntas abiertas

- **Orden con QC-131.** El texto del prompt de `catalogo` vive en Vercel (`CATALOG_PROMPT`) con la
  revisión firmada de QC-131 (`in_progress`). ¿Esta ficha espera a que QC-131 cierre y añade tipo
  y subtipo sobre el texto firmado, o se coordina antes? Le toca al humano.

## Decisiones cerradas (no reabrir)

| Fecha | Pregunta | Decisión |
|---|---|---|
| 2026-10-23 | ¿Tapas y medidores son materia prima? | No: son `PACKAGING` con un subtipo. |
| 2026-10-23 | Subtipos | Lista fija: envase, tapa, medidor, otro. Gatillo, válvula y atomizador cuentan como tapa; etiqueta y caja, como otro. Añadir uno es un cambio de código. |
| 2026-10-23 | ¿Quién exige presentación? | Solo el envase. Tapa, medidor y otro no la llevan. |
| 2026-10-23 | Empaque que ya existe | Todo pasa a envase: hoy todos tienen presentación y se usan en el reparto. |
| 2026-10-23 | Selector de envases del pedido (QC-195) | Muestra solo los de subtipo envase. |
| 2026-10-23 | Descontar tapas y medidores al empacar | Fuera: va a QT-298. |
| 2026-10-23 | La IA no sabe el tipo de una línea | La línea queda sin tipo y la revisión la marca. No se inventa. |
| 2026-10-23 | Líneas de catálogo ya guardadas | Quedan sin tipo hasta que se editan o se reimporta el PDF. |
| 2026-10-23 | Tipos admitidos en la línea de catálogo | Materia prima, herramienta y empaque. No producto terminado. |
| 2026-10-23 | Excel de inventario (QC-209) | Columna «Subtipo» opcional; si va vacía en un envase, cuenta como envase. |
| 2026-10-23 | Alta y edición manual de la línea de catálogo | Tipo y subtipo opcionales. |
| 2026-10-23 | E2E | No en esta ficha: no es un flujo crítico (no mueve inventario ni importes). El de la UI va en QT-297. |
| 2026-10-23 | Conjunto cerrado del subtipo | Enum de Postgres, como `ProductType` (migración `20260922150000_product_type_enum`). |
| 2026-10-23 | Borrado e idioma de identificadores | Heredado de QC-4: borrado lógico y nombres en inglés. |
| 2026-10-23 | `material` y medidas | Ya existen en la línea de catálogo (QC-158); no se re-crean. |
