# QC-182 — modelo-de-planes · requirements.md

> Zona: `backend` · Complejidad: `medium` · depends_on: QC-161 · Rama: `feature/QC-182-modelo-de-planes`
>
> **Alcance.** La tabla de planes de la plataforma, su migración y los permisos nuevos
> `planes.consultar` y `planes.modificar`, solo para el Maestro. Un plan es de la plataforma, no
> de una empresa. Tiene nombre, descripción, moneda, precio mensual y/o anual, si está activo, y
> la lista de **módulos** (los añadidos de QC-277) que trae. El núcleo va siempre y no se lista.
>
> **Lo que NO entra.**
> - Los casos de uso de alta, consulta, edición y desactivación: QC-185.
> - La pantalla de planes: QC-186.
> - El plan de cada empresa y la suscripción: QC-187.
> - Que los módulos del plan prendan añadidos en la empresa, combinados con las excepciones de
>   QC-277: QC-188.
> - Pasarela, métodos de pago, prueba, cobro y gracia: QC-183 y QC-189 a QC-192.
>
> Sembrado por `/afinar-feature` el 2026-10-28. El bloque de Alcance y la tabla de «Decisiones
> cerradas» los fijó el humano ANTES del spec. `spec_author` los respeta, no los reabre y no los
> reescribe: su trabajo aquí es `## Requisitos (EARS)`.

## Requisitos (EARS)

_Pendiente: los escribe spec_author (F1.2)._

## Preguntas abiertas

- **Unicidad del nombre.** ¿Dos planes pueden llamarse igual? La propuesta es único sin
  distinguir mayúsculas entre los planes no borrados (patrón de QC-4). No la decidió el humano:
  `spec_author` la deja como pregunta con esa propuesta por defecto.

## Decisiones cerradas (no reabrir)

| Fecha | Pregunta | Decisión |
|---|---|---|
| 2026-10-28 | ¿Qué otorga un plan a la empresa suscrita? | Un conjunto de **módulos**: el catálogo de añadidos de QC-277 (`dashboard`, `proveedores`, `lectura_pdf`, `importacion_excel`, `integraciones`), no permisos sueltos. Hereda QC-277 D16 («plan = conjunto de módulos + precio»). El núcleo no se lista: va siempre. Las excepciones por empresa de QC-277 siguen encima del plan (QC-277 D14). La tarjeta decía «lista de permisos»; se corrigió en el board. |
| 2026-10-28 | ¿Un plan puede no traer módulos? | Sí. Un plan solo con el núcleo es válido. |
| 2026-10-28 | ¿En qué moneda va el precio? | Una moneda por plan, `CRC` o `USD`; los precios del plan van en esa moneda. Es la primera moneda que se guarda en el sistema y no cierra la pregunta abierta «Moneda por empresa» de `docs/architecture.md`, que es la del costo. |
| 2026-10-28 | ¿Mensual, anual o los dos? | Al menos uno de los dos; el otro puede faltar. |
| 2026-10-28 | ¿Se admite precio 0? | Sí (plan gratuito); negativo nunca. El dinero va en `decimal(14,4)`, nunca `float` (`docs/architecture.md`). |
| 2026-10-28 | ¿Se edita un plan con suscripciones vivas? | Sí. Un precio nuevo rige desde la próxima renovación de cada empresa; los módulos cambian ya. La mecánica del precio vigente por suscripción es de QC-187. |
| 2026-10-28 | Borrado | Lógico, con `created_at`, `updated_at` y `deleted_at`, aparte de `active` (hereda QC-4). |
| 2026-10-28 | Idioma de los identificadores | Inglés (hereda QC-4). |
| 2026-10-28 | ¿La tabla de planes entra en la guardia de empresa (QC-61)? | No: es de plataforma, sin columna de empresa ni RLS de empresa, como la tabla del catálogo de añadidos (QC-277 D13). La relación plan↔módulo apunta con FK a esa tabla de catálogo. |
| 2026-10-28 | ¿E2E? | No: es modelo, migración y permisos, sin pantalla. El E2E entra con la pantalla (QC-186). |
