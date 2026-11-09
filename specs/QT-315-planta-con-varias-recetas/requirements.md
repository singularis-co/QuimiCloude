# QT-315 — planta-con-varias-recetas · requirements.md

> **Zona:** fullstack · **Complejidad:** high · **depends_on:** QT-313 (y la rama nace de QT-314, PR #319) · **Rama:** `feature/QT-315-planta-con-varias-recetas`
>
> **Alcance.** Las pantallas de planta pasan a trabajar por **receta** del pedido. Cada receta se elige y avanza por su lado.
> - **Pantallas:** ejecución del operario, empaque y acondicionamiento.
> - **Listas de Asignación:** una fila por receta.
> - **Dashboard de recorridos y Recorrido de un pedido:** cada pedido muestra el detalle de sus recetas.
> - **Backend:** las acciones y los casos de uso de `asignaciones` reciben la receta (la línea) en vez de buscar «la única receta» del pedido en un estado.
> - **E2E:** un pedido de dos recetas recorre planta de punta a punta.
>
> **Lo que NO entra.**
> - La entrega: en planta no existe y no se crea. Ya es por receta desde Pedidos (QT-314) y está la entrega directa de Inventario.
> - El alta, la edición y la consulta del pedido: QT-314.
> - El rediseño visual de las pantallas del operario: QC-291. Se adapta a varias recetas al integrar `dev`, después de esta ficha.
> - Los avisos QC-293 y QC-294.
>
> Sembrado por `/afinar-feature` el 2026-11-09. El bloque de Alcance y la tabla de «Decisiones cerradas» los fijó el humano ANTES del spec. `spec_author` los respeta, no los reabre y no los reescribe: su trabajo aquí es `## Requisitos (EARS)`.

## Requisitos (EARS)

_Pendiente: los escribe spec_author (F1.2)._

## Preguntas abiertas

Ninguna.

## Decisiones cerradas (no reabrir)

| Fecha | Pregunta | Decisión |
|---|---|---|
| 2026-11-09 | ¿Cómo trabaja el operario un pedido de varias recetas? | **Una fila por receta.** Cada lista de Asignación (asignados, terminados, todos, por empacar, por acondicionar, acondicionados) muestra una fila por receta, por ejemplo «#1042 · Hipoclorito 5 %», con el estado de esa receta. Al entrar se abre la pantalla de ejecución, empaque o acondicionamiento **de esa receta**, que viaja en la ruta. Con dos recetas en el mismo estado salen dos filas distintas, cada una con su destino. |
| 2026-11-09 | Entrega desde planta | **No entra.** En planta no hay entrega y no se crea. La entrega por receta ya está en Pedidos (QT-314). Se corrige la descripción de la tarjeta. |
| 2026-11-09 | Dashboard y Recorrido | **Pedido con secciones.** En el Dashboard, una fila por pedido con «primera receta +N más» y el avance «N de M», igual que el listado de Pedidos (QT-314). El Recorrido de un pedido se separa en una sección por receta, cada una con sus fases (producción, empaque y acondicionamiento), sus pasos, sus evidencias y su reparto. Las presentaciones dejan de mezclarse entre recetas. |
| 2026-11-09 | Orden con QC-291 | **QT-315 primero**, sobre las pantallas de hoy. QC-291, el rediseño visual que está en vuelo y es del mismo dueño, se adapta a varias recetas cuando integre `dev`. |
| 2026-11-09 | ¿Una ficha o dos? | **Una ficha fullstack** (complexity high). El backend es mecánico: la receta viaja de punta a punta y se quita la búsqueda de «la única receta» (`onlyLineOf` / `findOnlyLine`). No hay modelo ni migraciones nuevos. |
| 2026-11-09 | Cancelar desde la ejecución | **Solo esa receta**, con motivo. Libera su material y las demás recetas siguen. Es la misma regla que «Cancelar receta» de Pedidos (QT-313 R27 y R28). |
| 2026-11-09 | Reglas de estado y responsables | Heredado de QT-313, sin reabrir: cada receta tiene su estado y sus transiciones; los responsables (operador y empacador) son del pedido entero y pueden ejecutar cualquiera de sus recetas (R35); en `PARCIAL`, los responsables solo se pueden cambiar si queda alguna receta activa en PENDIENTE, EN_CURSO o BLOQUEADO (R55); «Parcial» se muestra con tono `progress`. |
| 2026-11-09 | Permisos | Heredado: los de hoy de `asignaciones` (operador, empacador, acondicionador). **No nace ningún permiso nuevo.** La autorización se valida en el caso de uso. |
| 2026-11-09 | Receta ajena o inexistente en la ruta | Heredado de QT-313 R43: una receta de otro pedido, de otra empresa o quitada se trata igual que un pedido inexistente. |
| 2026-11-09 | ¿Hace falta E2E? | **Sí.** Mueve inventario (`CHECKPOINTS.md`). Un pedido de **dos** recetas recorre planta de punta a punta: ejecución, empaque y acondicionamiento de cada una, con las dos avanzando por su lado. Los E2E de planta que ya existen se adaptan (decisión P5 de QT-313). |
| 2026-11-09 | Pase `/design` | **Obligatorio** antes del spec (`docs/perfil-agentes.md`). Tiene que cubrir: las listas de Asignación por receta, la cabecera de ejecución, empaque y acondicionamiento con la receta, el Dashboard con «+N más» y avance, y el Recorrido con secciones por receta. |
| 2026-11-09 | Restos de nombres viejos | **Entran:** el comentario de `finishPackingAction` («Deja el pedido ENTREGADO») y el aviso «delivered» de `finishAssignedOrderAction` (`DELIVERED_ORDER_PARAM`) se corrigen para que digan lo que pasa de verdad. |
| 2026-11-09 | ¿Librería nueva? | **No.** |
