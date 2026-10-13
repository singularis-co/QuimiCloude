# QC-214 — evidencia-por-paso · requirements.md

> **Zona:** fullstack · **Complejidad:** medium · **depends_on:** — · **Rama:** `feature/QC-214-evidencia-por-paso`
>
> **Alcance.** En el editor de fórmulas, cada paso de fabricación y cada paso de envasado tiene un
> switch «requiere evidencia», apagado por defecto. Al ejecutar un pedido (fabricación o envasado),
> en un paso con el switch encendido no se puede avanzar hasta tener entre 1 y 3 fotos subidas en
> ese paso; el servidor también lo hace cumplir. Mientras el pedido está en curso, quien lo ejecuta
> puede volver a pasos anteriores y quitar o cambiar sus fotos; el pedido no finaliza si algún paso
> que exige evidencia quedó sin fotos. Al finalizar, las fotos quedan fijas. No se pueden reordenar
> ni borrar pasos de una fórmula con pedidos en curso que tengan fotos. Las fotos se guardan en un
> bucket privado propio, por empresa y por pedido.
>
> **Lo que NO entra.** Ver las fotos en el detalle del pedido y en el registro de ejecución: va en
> QC-271 (bloqueada por esta). Congelar la fórmula al iniciar el pedido. Borrar fotos al cancelar o
> eliminar un pedido. Dar identificador estable a los pasos.
>
> Sembrado por `/afinar-feature` el 2026-10-13. El bloque de Alcance y la tabla de «Decisiones
> cerradas» los fijó el humano ANTES del spec. `spec_author` los respeta, no los reabre y no los
> reescribe: su trabajo aquí es `## Requisitos (EARS)`.

## Requisitos (EARS)

_Pendiente: los escribe spec_author (F1.2)._

## Preguntas abiertas

1. **Falta el pase `/design` (bloqueante, 2026-10-13, `spec_author` F1.2).** La ficha introduce UI
   visible nueva y ningún tablero de `docs/diseno/canvas/` la cubre (buscado `evidencia`, `foto`,
   `switch`, `requiere` en `Formula*`, `FormulaVersion*`, `Ejecucion*`, `Empaque*`,
   `ModalesOperario`, `ModalesProduccion`: nada). Por `docs/perfil-agentes.md > Pase de diseño para
   componentes nuevos`, el spec no se escribe hasta que el humano apruebe y se copien a
   `docs/diseno/canvas/` los tableros (escritorio, tablet y teléfono) de:
   - **El switch «requiere evidencia» en el editor de pasos** (fabricación y envasado). No hay
     primitivo `Switch` en `components/shared/CATALOGO.md` (solo `Checkbox`): el tablero decide si es
     un primitivo nuevo o se pinta con `Checkbox`, y dónde va en la fila del paso.
   - **El bloque de evidencia del paso en Ejecución y en Empaque**: subir con cámara o archivo
     (1 a 3 fotos), miniaturas, quitar y cambiar una foto, progreso de subida, error de formato o
     tamaño, el estado «no puedes avanzar sin evidencia» del botón Siguiente (gate `blocked` de
     `StepReader`), el rechazo al finalizar con un paso sin fotos y la vista de solo lectura tras
     finalizar.
   Cuando estén, se cita cada tablero en `design.md` y se relanza F1.2.

## Decisiones cerradas (no reabrir)

| Fecha | Pregunta | Decisión |
|---|---|---|
| 2026-10-13 | ¿A qué pasos aplica el switch? | **Fabricación y envasado** (`steps` y `packing_steps`, QC-211). Apagado por defecto; las fórmulas existentes quedan con todos los switches apagados. |
| 2026-10-13 | ¿Y si la fórmula cambia con el pedido en curso? | **Rige la fórmula actual**, como hoy: el pedido lee los pasos en vivo. Encender el switch en un paso aún no alcanzado lo exige al llegar. |
| 2026-10-13 | ¿Reordenar o borrar pasos con pedidos en curso que ya tienen fotos? | **Se bloquea.** Las fotos quedan atadas al número de paso (los pasos no tienen id), así que guardar una fórmula que reordena o borra pasos se rechaza, en el servidor, mientras tenga pedidos en curso con fotos. Sí se puede editar el texto de un paso, cambiar su switch y agregar pasos al final. |
| 2026-10-13 | ¿Puede corregir fotos? | **Sí, mientras el pedido esté en curso**, también en pasos anteriores (volviendo con «Anterior»). Al finalizar quedan fijas. |
| 2026-10-13 | ¿Un paso puede quedar con 0 fotos? | **Uno anterior, sí**. El paso en curso, no: no se avanza sin al menos 1. El pedido (o el empaque) no finaliza mientras algún paso que exige evidencia tenga 0. |
| 2026-10-13 | ¿Quién sube en envasado? | **Quien empaca** (`empaque.modificar`, QC-211), con las mismas reglas: no avanza sin evidencia y no finaliza el empaque con un paso que la exige sin fotos. En fabricación, **heredado de QC-63/QC-201**: `asignaciones.ejecutar` y responsable asignado. El switch lo cambia quien edita fórmulas (`recetas.modificar`). Todo validado en el service, con test. |
| 2026-10-13 | ¿Qué pasa con las fotos al cancelar o eliminar el pedido? | **Se conservan.** Su limpieza, si hace falta, va aparte. |
| 2026-10-13 | ¿Dónde se ven? | En la pantalla de ejecución (y de empaque), en esta ficha. Detalle del pedido y registro de ejecución: QC-271. |
| 2026-10-13 | Bucket | **Privado y propio** (QC-106; QC-171: un bucket por propósito). Ruta `<companyId>/<orderId>/...`; el servidor solo firma dentro de la empresa (QC-106). Subida directa firmada desde el navegador y lectura por URL firmada de 15 min (QC-106). Puerto + adaptador con doble en memoria (QC-25, QC-106). Variable de entorno declarada vacía en `.env.example`. |
| 2026-10-13 | Formato y tamaño | **Heredado de QC-25**: JPEG/PNG/WebP validado por contenido, ≤ 5 MB, compresión en cliente con `components/shared/compress-image.ts`. Sin dependencias nuevas. |
| 2026-10-13 | Versiones de fórmula | **Heredado de QC-172**: las versiones comparten los pasos de la original, así que heredan el switch. |
| 2026-10-13 | Identificadores y empresa | **Inglés** (QC-106 D18). Tabla nueva con columna de empresa y test de rechazo entre empresas (`docs/checkpoints-proyecto.md`). |
| 2026-10-13 | ¿E2E? | **Sí**: se extiende el E2E del flujo del Operador (QC-63), con storage simulado (QC-171). |
