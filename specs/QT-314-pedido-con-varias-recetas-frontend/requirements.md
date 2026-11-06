# QT-314 — pedido-con-varias-recetas-frontend · requirements.md

> **Zona:** fullstack · **Complejidad:** medium · **depends_on:** QT-313 · **Rama:** `feature/QT-314-pedido-con-varias-recetas-frontend`
>
> **Alcance.** La pantalla de Pedidos pasa a trabajar con pedidos de varias recetas.
> - **Alta y edición.** El panel del pedido muestra una tabla de recetas, y cada receta se añade o se edita en un sub-panel propio.
> - **Consulta.** Un panel de detalle, de solo lectura, muestra el avance, los totales y cada receta con su estado.
> - **Listado.** Hay una fila por pedido, con un resumen de sus recetas, el avance y los totales.
> - **Acciones de una receta.** Cancelar con motivo, «Reparto y unidad» y Entregar, ver y anular entregas se lanzan desde el menú de la fila, eligiendo primero la receta.
> - **Piezas de `lib/` que hereda de QT-313** (design § 4.1.1 y § 7):
>   - renombrar los esquemas de líneas a sus nombres finales y borrar los planos;
>   - quitar el puente de una sola receta de `order-actions.ts`;
>   - añadir las acciones de servidor por receta;
>   - devolver en qué receta falla un alta o una edición.
>
> **Lo que NO entra.**
> - Las pantallas de planta con varias recetas (ejecución del operador, empaque y acondicionamiento) y el E2E de punta a punta de un pedido de dos recetas por planta van en **QT-315** (`planta-con-varias-recetas`).
> - El margen por receta y en total va en **QC-308** (`margen-del-pedido`).
> - Los responsables, el cliente y la prioridad siguen siendo del pedido entero, con sus pantallas de hoy. Solo cambia su habilitación en `PARCIAL`.
>
> Sembrado por `/afinar-feature` el 2026-11-06. El bloque de Alcance y la tabla de «Decisiones cerradas» los fijó el humano ANTES del spec. `spec_author` los respeta, no los reabre y no los reescribe: su trabajo aquí es `## Requisitos (EARS)`.

## Requisitos (EARS)

_Pendiente: los escribe spec_author (F1.2)._

## Preguntas abiertas

Ninguna.

## Decisiones cerradas (no reabrir)

| Fecha | Pregunta | Decisión |
|---|---|---|
| 2026-11-06 | Forma del formulario de alta y edición | **B · Tabla + sub-panel.** El panel del pedido tiene el cliente, la prioridad, una tabla de recetas (fórmula, reparto resumido, cantidad, precio, estado, editar) y el total. «Añadir receta» o «Editar» abre un sub-panel con fórmula, versión, cantidad, unidad, reparto, precio, cotización e insumos de esa receta, más «Quitar receta» y «Aplicar». Nada se guarda hasta «Guardar pedido». Se eligió viendo las tres opciones con 5 recetas en el lienzo https://claude.ai/artifact/G1MVH6f21QwVJF71Gu4M1i. |
| 2026-11-06 | ¿Dónde se consulta un pedido? | **Panel de detalle de solo lectura**, que hoy no existe: datos del pedido, «N de M terminadas», totales y una fila por receta con estado, cantidad, reparto, precio, costes y el motivo si está cancelada. |
| 2026-11-06 | Listado con varias recetas | **Una fila por pedido.** En Fórmula, la primera receta y «+N más». Columna nueva de avance («1 de 2»). Precio, costo estimado y costo real pasan a ser los totales del pedido, con un aviso «N sin precio». La columna Presentación sale del listado y se ve en el detalle. |
| 2026-11-06 | Acciones de una sola receta | **Desde el menú de la fila del listado, eligiendo primero la receta.** Son: cancelar receta con motivo, «Reparto y unidad» (receta en `POR_EMPACAR`), Entregar y Entregas/Anular entrega. Solo se ofrecen las recetas cuyo estado admite esa acción. |
| 2026-11-06 | ¿Cuándo se puede pulsar Editar? | **En cualquier estado salvo Entregado y Cancelado**, `PARCIAL` incluido. Las recetas en un estado no editable salen en solo lectura (sin «Editar» ni «Quitar») y siempre se puede añadir una receta. Sustituye para la pantalla la regla de QT-313 R54, que trataba `PARCIAL` como cerrado. |
| 2026-11-06 | Entregas desde Pedidos con varias recetas | **Entran en QT-314:** Entregar, Entregas y Anular entrega desde Pedidos, por receta. Se entrega una receta Terminada aunque el pedido esté `PARCIAL`. QT-315 se queda con las pantallas de planta. |
| 2026-11-06 | Errores por receta | **El aviso nombra la receta**, por ejemplo «No alcanza el material para Suavizante (receta 4)», y su fila queda marcada. **Reabre la decisión de QT-313 «Posición de la línea solo en el diagnóstico»:** la respuesta del alta y de la edición devuelve la posición de las recetas que fallan (R11 y R13 de QT-313). Es un cambio de `lib/` dentro de esta ficha. |
| 2026-11-06 | Esquemas de entrada | Heredado de QT-313 (design § 4.1.1, fila «Esquemas planos»): **esta ficha renombra `createOrderWithLinesSchema`, `updateOrderWithLinesSchema` y `updateOrderLineDistributionSchema` a sus nombres finales, borra los planos y quita `requireSingleLineIdOf` y el puente de una receta de `order-actions.ts`.** También deja de aplicar QT-313 R44, porque la pantalla ya envía N recetas. |
| 2026-11-06 | Reglas de negocio de las recetas | Heredadas de QT-313, sin reabrir: quitar solo en Pendiente o Bloqueado (si no, se cancela); una receta no se repite en el pedido (las versiones cuentan como la misma); la cancelada no suma ni cuenta; el precio sigue las reglas de QC-307; «Parcial» con tono `progress`; responsables, cliente y prioridad del pedido entero. |
| 2026-11-06 | Permisos | Heredado: `pedidos.consultar` para ver y `pedidos.modificar` para alta, edición, quitar y cancelar. El Operador no ve precios (QC-307). **No nace ningún permiso nuevo.** |
| 2026-11-06 | ¿Hace falta E2E? | **Sí:** hay importes y movimientos de inventario (`CHECKPOINTS.md`). Un recorrido por Pedidos: alta de un pedido de dos recetas con precio; reabrirlo y ver avance y totales; cancelar una receta; añadir otra. Los E2E de pedidos que existen se adaptan a la pantalla nueva. |
| 2026-11-06 | ¿Librería nueva? | **No.** Se reutilizan los patrones de la pantalla (`FormSheet`, `order-distribution-field.tsx`, filas de `recipe-lines-field.tsx`). |
