# QC-269 — Defectos de layout del operario tras QC-265 · requirements.md

## Alcance

Corrige tres defectos de maquetación que el humano vio en preview (PC, ventana a pantalla completa)
después de QC-265, sin rediseñar nada. Los tableros aprobados siguen mandando:
`docs/diseno/canvas/Asignacion.dc.html` y `docs/diseno/canvas/Ejecucion.dc.html`.

1. **`/asignacion`, columna «Entrar»:** con el pedido BLOQUEADO (botón deshabilitado y el aviso
   «Falta material: no se puede iniciar») o EN_CURSO (aviso «Este pedido ya está en curso.»), el
   botón queda a la izquierda de la celda, y con el pedido PENDIENTE queda a la derecha.
2. **Ejecución (`/asignacion/<id>`), grave:** si la receta tiene muchos materiales, el final del
   panel «Herramientas / Materiales» queda debajo del pie fijo «Anterior / Siguiente» y no hay forma
   de verlo. Mismo patrón en Empaque con paso a paso.
3. **Fila de material:** con el panel a 300 px, el nombre del material se parte palabra a palabra y
   pisa al porcentaje.

### Lo que NO entra

- **La cabecera de las columnas alineadas al final** de `DataTable` (la etiqueta queda a la
  izquierda aunque la celda se alinee a la derecha). Afecta a todas las tablas de la app: va en `P1`.
- **Acondicionamiento** (`/asignacion/acondicionamiento/<id>`): su pie es el del marco, y el marco
  ya reserva su alto (`design.md > 4.3`). No tiene el defecto y no cambia.
- **Empaque sin paso a paso:** mismo motivo, el pie es el del marco.
- Cambiar el alto, el contenido o la posición del pie fijo de `StepReader`, o añadir desplazamiento
  propio al panel (`design.md > 6`, alternativa B).
- Cualquier cambio de datos, permisos, rutas o textos.

## Decisiones cerradas (no reabrir)

La ficha llegó sin `/afinar-feature`. La única decisión del humano está en
`progress/features/QC-269.md > Decisiones`.

| # | Decisión | Quién y cuándo | Cubierta por |
|---|---|---|---|
| D1 | «Sí debemos corregir esto»: se corrigen los tres defectos vistos en preview (columna «Entrar», panel tapado por el pie, fila de material) | humano, 2026-10-13 | R1–R10 |

## Requisitos (EARS)

### Columna «Entrar» de «Mis asignados» (defecto 1)

**R1.** MIENTRAS «Mis asignados» se muestra como tabla, el sistema DEBE alinear «Entrar» al borde
final de su columna en los tres estados del pedido (PENDIENTE, EN_CURSO y BLOQUEADO): los tres botones
comparten el mismo borde derecho, con 1 px de tolerancia.

**R2.** SI el pedido está EN_CURSO o BLOQUEADO, ENTONCES el sistema DEBE mostrar su aviso debajo de
«Entrar» y alineado al mismo borde que el botón, con 1 px de tolerancia.

**R3.** MIENTRAS «Mis asignados» se muestra como tarjetas, el sistema DEBE colocar «Entrar» en el
mismo borde izquierdo del pie de la tarjeta en los tres estados del pedido, con 1 px de tolerancia.

### Panel de herramientas y materiales (defecto 2)

**R4.** CUANDO el operario desplaza la pantalla de ejecución hasta el final, el sistema DEBE mostrar
entero por encima del pie fijo el borde inferior del panel «Herramientas / Materiales» y su último
material, sea cual sea el número de materiales de la receta, tanto con la pantalla en dos columnas
(1440 × 900) como en una (390 × 844).

**R5.** CUANDO el operario desplaza la pantalla de ejecución hasta el final, el sistema DEBE mostrar
entero por encima del pie fijo el último elemento del paso en curso, sea cual sea su número de
elementos, en los dos anchos de R4.

**R6.** El sistema NO DEBE dar al panel «Herramientas / Materiales» un desplazamiento propio, y DEBE
mantener el pie del paso a paso anclado al borde inferior de la ventana: todo el contenido del panel
se alcanza con el desplazamiento de la página.

**R7.** MIENTRAS la pantalla de empaque muestra el paso a paso y pinta dos columnas, CUANDO el
empacador la desplaza hasta el final, el sistema DEBE mostrar entera por encima del pie fijo la
tarjeta de la columna izquierda (cantidad, reparto y envases).

**R8.** MIENTRAS la pantalla de ejecución o la de empaque pinta una sola columna, el sistema NO DEBE
añadir espacio entre la columna lateral y la del paso a paso: la reserva de R4 y R7 solo aplica con
dos columnas.

### Fila de material (defecto 3)

**R9.** El sistema DEBE pintar el nombre de cada material sin solaparlo con ningún otro dato de su
fila (porcentaje, cantidad, unidad o marca de aproximado), en cualquier ancho del panel.

**R10.** SI el nombre del material y sus cifras no caben en una sola línea con el nombre a 12 rem
(192 px) como mínimo, ENTONCES el sistema DEBE pasar las cifras a la línea siguiente y dar al nombre
todo el ancho de la fila. El orden de lectura no cambia: nombre, porcentaje, cantidad, unidad y marca
de aproximado.

## Preguntas abiertas

Cada una con el defecto que se aplica si nadie dice otra cosa al aprobar el spec.

- **P1. ¿Se alinea también la cabecera de las columnas `end`?** `DataTableHeaderCell`
  (`components/shared/data-table/data-table-header-menu.tsx:222`) pone la etiqueta en un `flex` sin
  `justify-end`, y la etiqueta queda a la izquierda aunque la celda vaya a la derecha. Arreglarlo
  aquí cambia la cabecera de todas las columnas `end` de la app: 14 definiciones en 9 archivos de
  `app/`, contadas con `grep "align: 'end'"`, y alguna de ellas se usa en varias listas. Además rompe los
  snapshots de paridad de las listas cerradas que las pintan
  (`tests/unit/paridad/__snapshots__/*-paridad.test.tsx.snap`, como «Acciones» en usuarios), y las
  columnas `center` seguirían igual de mal en cabecera.
  **Por defecto: fuera de esta ficha.** El leader abre una ficha aparte, «Alinear la cabecera de
  `DataTable` con su columna (`end` y `center`)». El tablero `Asignacion.dc.html:155` oculta
  visualmente la cabecera «Entrar», así que en esta columna no hay referencia que la contradiga.
- **P2. ¿La fila de material en dos líneas necesita su propio pase `/design`?** El tablero
  `Ejecucion.dc.html:58` dibuja la fila como nombre (`minmax(0, 1fr)`) más cantidad (`auto`), en una
  línea. La app añade porcentaje y selector de unidad (QC-147, QC-32), que no caben al lado de un nombre
  legible a 300 px (`design.md > 3`).
  **Por defecto: no.** R10 es la regla del tablero aplicada a los datos que este no dibuja: el nombre
  manda y las cifras ceden. El humano lo ve en preview al cerrar la ficha.
- **P3. ¿Basta un test unitario para el empaque (R7)?** Sembrar un empaque con paso a paso y un
  reparto largo en el E2E necesita receta con pasos de envasado, presentaciones y un pedido
  EN_EMPAQUE con muchas líneas de reparto. El mecanismo de R7 es la misma constante y la misma clase
  que R4, que sí se prueba en navegador.
  **Por defecto: sí.** R7 se prueba con un test unitario de la clase (`design.md > 7`) y el E2E de R4
  prueba el mecanismo.
