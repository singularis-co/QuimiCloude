# QC-271 — consulta-de-evidencia-por-paso · requirements.md

> **Zona:** fullstack · **Complejidad:** medium · **depends_on:** QC-214 · **Rama:** `feature/QC-271-consulta-de-evidencia-por-paso`
>
> **Alcance.** Ver, en solo lectura, las fotos de evidencia por paso que se subieron al ejecutar un
> pedido (QC-214), en dos lugares:
> - **Recorrido de ejecución del dashboard** (`/dashboard/recorrido/[id]`, QC-167): las fotos de
>   fabricación junto a su «Paso N» en la línea de tiempo; las de envasado en un bloque «Envasado»
>   aparte, agrupadas por paso.
> - **Ficha de producto terminado** (QC-225): en cada lote que tiene pedido de origen, las fotos de
>   ese pedido, agrupadas por fase (fabricación / envasado) y por paso. Solo las ve quien tiene
>   `pedidos.consultar` (hoy, el Administrador); el resto de quienes ven la ficha no las ve.
>
> **Lo que NO entra.**
> - Subir, cambiar o quitar fotos: sigue en la ejecución y el empaque (QC-214).
> - Una página de detalle del pedido o una opción «Ver evidencia» en /pedidos: QC-35 descartó la
>   página de detalle y se decidió no abrir otra entrada. Sin ficha.
> - Que el empaque anote sus cambios de paso en el registro de ejecución: descartado; el envasado
>   se muestra en su bloque. Sin ficha.
> - Abrir la evidencia a otros roles o crear un permiso nuevo: descartado. Sin ficha.
> - Limpieza de fotos de pedidos cancelados o de subidas huérfanas: queda «aparte» como dejó
>   QC-214 (`specs/QC-214-evidencia-por-paso/design.md:387-388`), sin ficha.
>
> Sembrado por `/afinar-feature` el 2026-10-14. El bloque de Alcance y la tabla de «Decisiones
> cerradas» los fijó el humano ANTES del spec. `spec_author` los respeta, no los reabre y no los
> reescribe: su trabajo aquí es `## Requisitos (EARS)`.

## Requisitos (EARS)

_Pendiente: los escribe spec_author (F1.2)._

## Preguntas abiertas

- **P1 (bloqueante, 2026-10-14, spec_author F1.2) — falta el pase `/design`.** La feature cambia
  lo visual de dos pantallas que ya tienen tablero, y ninguno de esos tableros incluye fotos:
  `docs/diseno/canvas/Recorrido*.dc.html` y `docs/diseno/canvas/ProductoTerminado*.dc.html`
  (buscado «evidencia», «foto», «Envasado»: nada). La pieza `StepEvidence` y su modo de solo
  lectura sí tienen tablero (`EvidenciaPaso*.dc.html`), pero dónde y cómo entra en cada pantalla
  es UI visible nueva, así que no aplica la excepción de `docs/perfil-agentes.md > Pase de diseño
  para componentes nuevos`. El spec no se escribe hasta que el humano apruebe el tablero y se copie
  a `docs/diseno/canvas/`. El pase tiene que fijar, en escritorio, tablet y teléfono:
  1. **Recorrido, fabricación.** Junto a qué anotación van las fotos de «Paso N» cuando ese paso
     sale varias veces en la línea de tiempo (avanzar, volver atrás y volver a avanzar): ¿en la
     primera, en la última o en un solo bloque por paso fuera de las anotaciones? Y dónde van las
     fotos de un paso que no tiene ninguna anotación con ese número (la decisión «nunca se esconde
     evidencia» obliga a mostrarlas).
  2. **Recorrido, envasado.** Dónde va el bloque «Envasado» (antes o después de «Anotaciones») y
     cómo se rotula cada paso dentro de él.
  3. **Ficha, pestaña Lotes.** Cómo se abren las fotos de un lote dentro de la tabla paginada:
     fila desplegable, panel o diálogo por lote, o una pestaña nueva. Y qué ve el Administrador en
     un lote con pedido de origen pero sin fotos (la decisión «sin hueco» dice que no se muestra
     nada).
  4. **Textos del modo solo lectura.** `StepEvidence` en `readOnly` dice «Fijada al terminar». Si
     ese texto vale para un pedido cancelado o dado de baja, o si hace falta otro para la
     consulta.
  5. **Estados** cargando, vacío y error de las fotos en las dos pantallas.

## Decisiones cerradas (no reabrir)

| Fecha | Pregunta | Decisión |
|---|---|---|
| 2026-10-14 | ¿Dónde se ven las fotos fuera de la ejecución? | En el recorrido de ejecución del dashboard (QC-167) y en la ficha de producto terminado (QC-225), en cada lote con pedido de origen. No hay página de detalle del pedido (QC-35) ni entrada nueva en /pedidos. |
| 2026-10-14 | ¿Quién las ve? | Solo el Administrador. Recorrido: `dashboard.consultar` (heredado de QC-167). Ficha: la ficha sigue con `inventario.consultar` (QC-225), pero las fotos solo se leen y se muestran con `pedidos.consultar`; sin ese permiso no se devuelven ni se firman. Sin permiso nuevo. Se valida en el service. |
| 2026-10-14 | ¿Cómo entran las fotos de envasado en el recorrido? | Bloque «Envasado» aparte, agrupado por paso. El empaque no anota cambios de paso (QC-82, QC-214 P4) y no se toca. |
| 2026-10-14 | Si la fórmula se edita después de terminar el pedido (se reordena o se apaga la evidencia de un paso), ¿qué se muestra? | Todas las fotos guardadas, rotuladas por su número de paso («Paso 3»), aunque hoy ese paso sea otro o ya no pida foto. Nunca se esconde evidencia. Cierra P5/P7 de QC-214 para estas pantallas. |
| 2026-10-14 | ¿Cómo se leen las fotos? | URL firmada de lectura de 15 min sobre el bucket privado de QC-214 (heredado de QC-106/QC-214). Se reutiliza la pieza `components/shared/step-evidence` en modo solo lectura (R24 de QC-214), con su visor ampliado. |
| 2026-10-14 | ¿Pedido dado de baja o cancelado? | Sus fotos se muestran igual: la evidencia no se borra al cancelar (QC-214 R38) y el recorrido de un pedido dado de baja se abre marcado (QC-167 D12). |
| 2026-10-14 | Estados de la vista | Vacío, cargando y error como en QC-35/QC-102/QC-174. Un pedido o paso sin fotos no muestra hueco. |
| 2026-10-14 | ¿Hace falta E2E? | Sí, porque toca permisos (`docs/checkpoints-proyecto.md`): el Administrador ve las fotos en el recorrido y en la ficha; el Operador abre la ficha y no ve fotos. Más el test de rechazo entre empresas. |
| 2026-10-14 | Identificadores | En inglés (heredado de QC-82, QC-214). |
