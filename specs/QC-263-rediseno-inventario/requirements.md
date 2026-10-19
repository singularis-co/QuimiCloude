# QC-263 — Rediseño de Inventario e importación · requirements.md

## Alcance

Lleva al diseño del canvas (página 4) las dos pantallas de inventario, **Inventario** (`/inventario`)
e **Importar inventario** (`/inventario/importar`), con sus paneles y diálogos. Fuente:
`docs/diseno/canvas/Inventario.dc.html`, `InventarioTablet.dc.html`, `InventarioMovil.dc.html`,
`InventarioImportar.dc.html`, `InventarioImportarTablet.dc.html`, `InventarioImportarMovil.dc.html`
y `ModalesInventario.dc.html` (`_trabajo/rediseno/canvas/` es la misma fuente sin versionar), y
`progress/rediseno.md`. **El diseño manda sobre lo visual**; el comportamiento (permisos, acciones,
campos enviados, reglas del ajuste, de la importación y de la alarma de existencia) es el de hoy
salvo lo que dice cada requisito.

Lo que pide la ficha:

1. **Pestañas por tipo de producto** (Todos · Producto · Máquina · Envase · Producto terminado).
2. **Aviso de existencia bajo la alerta** en la celda de existencia.
3. **Menú ⋯ de fila** con Lotes, Historial, Ajustar existencia, Editar y Borrar (D2).
4. **Importación con barra de pasos:** Elegir archivo · Vista previa · Importación terminada (D6).
5. **Textos:** «Elige un motivo.» en lugar de «Elegi un motivo.» (D9) y los toasts que faltan (D10).

### Lo que NO entra

- **El formulario de producto** (`ProductForm`, panel «Nuevo producto» / «Editar producto»): sus
  campos, ayudas y validaciones no cambian. Las ayudas «Qué es X» del tablero llevan el texto entre
  corchetes y no existe una fuente para él (P8).
- ~~**Vencimiento en ámbar** de los lotes que vencen pronto: el tablero lo pinta, pero el dominio no
  tiene regla de «por vencer» (P9).~~ **Enmienda 2026-10-16:** `dev` trajo la regla (08b69744,
  `expiry-warning.ts`: menos de 30 días o vencido, texto relativo y chip «Vencido»). Ya no queda
  fuera: se conserva y entra su color (R48, P19).
- **Arrastrar y soltar** el archivo en la importación (P10).
- **Columna «Presentación del envase» por lote** en el panel de lotes (P2).
- **Icono en la cabecera del diálogo de borrado:** `DeleteConfirmDialog` no lo tiene y QC-262 lo dejó
  como deuda de la pieza compartida (su P5); el diálogo de borrado conserva su árbol de hoy.
- Cambiar el formato de cifras (`120,00`) o de fechas (`12/09/2026`) del tablero: se quedan los de
  hoy (P4).
- Lo que no es de esta ruta: QC-178 (precisión del coste unitario), QC-197 (lote real usado por el
  operador) y QC-253 (lote al acondicionar), todas `pending`. No se adelanta nada de ellas.

### Enmienda 2026-10-16 (cambios de `dev` posteriores al spec)

El spec se escribió sobre `f7cc5be2` y el merge de `origin/dev` (`d8b82a1d`) trajo funciones de
inventario que el tablero no dibuja. **Regla de la enmienda: lo que `dev` ya trajo se conserva;
el rediseño se adapta para incluirlo.** Ninguna decisión cerrada se reabre. Las preguntas que abrió
(P17–P22) las cerró el humano el 2026-10-16 (filas de `## Decisiones cerradas`). Lista completa con su commit en
`design.md > 12`. Requisitos tocados: R6, R11, R12, R13, R15, R46. Requisitos nuevos:
R47–R53. Lo que los requisitos tocados decían antes queda en `design.md > 12`.

### Enmienda 2 (2026-10-16, vuelta 2 del review)

El review de la implementación (`progress/review_QC-263.md`, B1) encontró la rama 22 commits por
detrás de `origin/dev`, y `dev` había vuelto a cambiar Inventario: «Costo» solo para el
Administrador, en moneda y con unidad, al final de la tabla, y sin «Presentación» en la pestaña
«Producto» (6a665e3f, 5496bd16, fb140780; tablero `InventarioMovil` enmendado en 070a8c71; QC-52
R35–R37). El humano decidió el 2026-10-16 las filas H1–H6 de `## Decisiones cerradas`. **Misma regla
que la enmienda 1: lo que `dev` trajo se conserva.** Además, el humano decidió que **el tablero
manda en tarjetas y sub-filas** y añadió «Elegir otro archivo» en el paso 2. Requisitos tocados:
R6, R13, R15, R21, R32, R47, R53. Requisitos nuevos: R54–R59. Preguntas P23–P27, cerradas el
mismo día. Lo que los tocados decían antes queda en
`design.md > 12 > Enmienda 2`.

## Decisiones cerradas (no reabrir)

La ficha llegó sin `/afinar-feature`. Estas filas son decisiones del humano ya tomadas en
`progress/rediseno.md` (2026-10-10) o al aprobar specs anteriores; este spec no las abre.

| # | Decisión | Quién y cuándo | Enmienda a | Cubierta por |
| --- | --- | --- | --- | --- |
| D2 | Acciones de fila siempre en el menú ⋯. En teléfono la tabla pasa a tarjetas y «Acciones» abre el menú centrado en la pantalla visible. «Volver…» nunca es enlace de texto: es botón con flecha | humano, 2026-10-10 (`progress/rediseno.md` D2) | — | R9, R12, R13, R14, R18, R19, R23, R29, R30 |
| D3 | Tonos por significado con un único `StatusBadge` y un único mapa por dominio (ámbar = waiting, danger = Error, success = Añadido/Nuevo…) | humano, 2026-10-10 (D3) | QC-227 (variante de `Badge` de «Sobre-reservado») | R7, R17, R36, R38, R48 |
| D6 | Importar inventario con barra de pasos: Elegir archivo · Vista previa · Importación terminada | humano, 2026-10-10 (D6) | — | R31, R32, R33, R49, R50, R59 |
| D7 | Tallas de botón: sm 32 · default 36 · touch 44 · xl 52 | humano, 2026-10-10 (D7) | — | R2, R13, R34, R42, R58, R59 |
| D9 | Corregir textos sin tildes y el voseo («Elegi un motivo.» → «Elige un motivo.») | humano, 2026-10-10 (D9) | QC-92 (etiqueta derivada «Conteo fisico») | R24, R25, R46 |
| D10 | Agregar los toasts que faltan | humano, 2026-10-10 (D10) | — | R27, R28, R51 |
| D14 | Lo demás del canvas queda aprobado; cada pantalla en escritorio, tablet y teléfono | humano, 2026-10-10 (D14) | — | R1, R5, R6, R15, R19, R29, R35, R39, R42, R43, R47, R52, R53 |
| QC-256 | `UrlTabs`, `PageShell`, `PageHeader`, `ArrowLink`, `StatusBadge`, `RowActionsMenu` centrado y `DataTable` con `card` son las piezas del rediseño | humano, 2026-10-10 (aprobación de QC-256) | — | R1, R3, R13, R30 |
| QC-270 | La cabecera de `DataTable` sigue la alineación de su columna (ya en `dev`) | humano, 2026-10-13 | — | R6 |
| P17 | Se mantienen las sub-filas de lote desplegables; en teléfono, cada una es tarjeta propia bajo la del producto, sin imagen ni «Acciones». **Requiere pase `/design`** (tableros `Inventario`, `InventarioTablet`, `InventarioMovil`); tablero `InventarioColumnasLotes*.dc.html` aprobado 2026-10-16 | humano, 2026-10-16 (P17) | f978ef29 | R12, R13, R47 |
| P18 | Se mantienen «Costo» (a la derecha, como las demás cifras), «Tipo» y «Presentación»; en la tarjeta, «Tipo» como chip de estado (solo en «Todos») y «Presentación» y «Costo» en las cifras. **Requiere pase `/design`** (mismos tableros); tablero `InventarioColumnasLotes*.dc.html` aprobado 2026-10-16 | humano, 2026-10-16 (P18) | b0eaa866, 6f08e379, c2ac0e65 | R6, R13, R53 |
| P19 | «Por vencer» y el nombre del producto en ámbar; «Vencido» como chip en tono de error. D3 se mantiene | humano, 2026-10-16 (P19) | 08b69744 | R48 |
| P20 | Panel «Lotes» como la tabla del tablero (tarjetas en teléfono), conservando el vencimiento relativo y el chip «Vencido» | humano, 2026-10-16 (P20) | ccde16f7 | R15, R19 |
| P21 | Guía de importación y avisos de la vista previa con su aspecto de hoy, sin pase `/design` | humano, 2026-10-16 (P21) | c4f824fe, 6cc59959 | R49, R50 |
| P22 | El esqueleto de la lista no se arregla aquí; se amplía D53 en T7c | humano, 2026-10-16 (P22) | 6f08e379 | — (deuda D53) |
| H4 | Se sigue lo de `dev`: «Costo» solo lo ve el Administrador (y el servidor no lo envía a los demás), en moneda redondeada con el valor exacto en `title` y con la unidad del producto, al final de la tabla antes de las acciones (coincide con el tablero); «Presentación» fuera de la pestaña «Producto». Se reescriben R6, R13 y R53 para conservar lo mergeado | humano, 2026-10-16 (review QC-263, B1 y H4) | 6a665e3f, 5496bd16, fb140780 (QC-52 R35–R37) | R6, R13, R53, R54 |
| H2·H3 | Manda el tablero (`InventarioColumnasLotes*`, `ModalesInventario`) en tarjetas y sub-filas: rótulos en las tarjetas de producto, de lote y de historial, dentro de la ruta y sin tocar `DataTable`; fondo suave, sangría y animación en las sub-filas de lote en escritorio; «Mostrar lotes» al pie de la tarjeta en teléfono, no en el título; fechas del panel «Lotes» a la derecha; orden de las cifras de la tarjeta como el tablero (Existencia, Alerta, Disponible, Costo) | humano, 2026-10-16 (review QC-263, H2, H3, m1, m2, m4, m5) | — | R13, R15, R47, R55, R56, R57, R58 |
| H5 | En el paso 2 de importar se añade un botón secundario «Elegir otro archivo» en la cabecera del paso, que vuelve al paso 1 sin recargar la página | humano, 2026-10-16 (review QC-263, H5) | — | R32, R59 |
| H1·H6 | Se confirman P12 (tarjetas a 820 px) y el chip «Tipo» con el tono de su tipo (R53); el leader corrige los tableros para que coincidan | humano, 2026-10-16 (review QC-263, H1, H6) | 6f08e379 | R13, R53 |
| P23 | Orden de columnas de `dev` (fb140780): Existencia · Disponible · Reservado · Alerta de cantidad · Costo unitario. El leader corrigió el tablero `InventarioColumnasLotes` (orden de `dev`, «Costo unitario» en moneda redondeada con unidad y exacto en `title`, chip «Tipo» con tono, sin «Presentación» en «Producto») y lo copió a `docs/diseno/canvas/` | humano, 2026-10-16 (criterio: columnas y costo, manda `dev`) | fb140780 | R53 |
| P24 | En la tarjeta, «Tipo» arriba a la derecha (hueco de estado) y «Presentación» la primera de la `meta`, sin rótulo, delante de las cifras | humano, 2026-10-16 | — | R13 |
| P25 | Cabecera «Costo unitario» (de `dev`); rótulo «Costo» en la tarjeta (del tablero) | humano, 2026-10-16 | 6a665e3f | R54, R55 |
| P26 | Manda el tablero: fondo suave, sangría y animación también en las tarjetas de lote del teléfono; con movimiento reducido, sin animación | humano, 2026-10-16 (criterio: tarjetas y fechas, manda el tablero) | — | R57 |
| P27 | Manda el tablero: la «Fecha» del historial alineada a la derecha (`ModalesInventario`) | humano, 2026-10-16 (criterio: tarjetas y fechas, manda el tablero) | — | R21 |
| m8 | Manda el tablero: la tarjeta del lote en teléfono no lleva «Reservado»; una cifra vacía («—») sí lleva su rótulo | humano, 2026-10-16 (review QC-263 vuelta 2, m8) | — | R55, R56 |

## Requisitos (EARS)

Los requisitos marcados *(supuesto Pn)* están escritos con la opción por defecto de la pregunta
abierta `Pn`; si el humano elige otra, se reescriben antes de implementar.

### Inventario — cabecera y pestañas

- **R1.** La pantalla `/inventario` DEBE pintar «Inventario» como único `h1` con `PageHeader`
  (conservando `data-testid="inventario-title"`) dentro de `PageShell`, con las acciones «Importar»
  (contorno, icono de subida, enlace a `/inventario/importar`, `data-testid="inventory-import-link"`,
  solo para quien hoy lo ve) y «Nuevo producto» (`data-testid="product-create-open"`), en ese orden;
  el permiso exigido y el 404 DEBEN ser los de hoy.
- **R2.** MIENTRAS el contenedor de la página mide 760 px o menos, las dos acciones de la cabecera
  DEBEN ocupar el ancho entre las dos y medir al menos 44 px de alto.
- **R3.** La pantalla DEBE pintar las pestañas «Todos», «Producto», «Máquina», «Envase» y «Producto
  terminado», en ese orden, con `UrlTabs`: cada una es un enlace real a la dirección que hoy produce
  elegirla (el filtro de tipo, o ninguno en «Todos», la página 1 y el resto de la consulta
  intacto), con la vigente seleccionada y la lista llamada «Filtrar por tipo de producto».
- **R4.** La pantalla NO DEBE pintar «Mostrando todos los tipos» ni «Filtrando por: …» bajo las
  pestañas.
- **R5.** MIENTRAS las pestañas no caben en el ancho, el sistema DEBE desplazarlas en horizontal sin
  saltar de línea y sin desbordar la página.

### Inventario — tabla y aviso de existencia

- **R6.** Las columnas «Existencia», «Disponible», «Reservado», «Alerta de cantidad» y, cuando se
  pinta (R54), «Costo unitario» (y «Existencia» y «Alerta de cantidad» en «Producto terminado»)
  DEBEN alinearse a la derecha en la celda y en la cabecera, en cifras tabulares, también en las
  sub-filas de lote (R47); «Tipo» y «Presentación» DEBEN alinearse a la izquierda; la cifra de
  «Disponible» de la fila de producto DEBE pintarse en negrita. *(enmienda 2026-10-16; decisión
  P18; enmienda 2: el orden y la visibilidad de «Costo unitario» son los de `dev`, H4; tablero
  `docs/diseno/canvas/InventarioColumnasLotes*.dc.html`, aprobado 2026-10-16)*
- **R7.** SI la alerta de cantidad de un producto supera su existencia (la regla de hoy: supera, no
  iguala), ENTONCES la celda de existencia DEBE pintarse en el tono de advertencia (ámbar), con un
  icono de advertencia oculto a lectores de pantalla y el texto «Por debajo de la alerta de cantidad»
  como `title` y como texto para lectores de pantalla, y conservar `data-alert="true"`; NO DEBE
  usar el tono de error.
- **R8.** El aviso del R7 DEBE pintarse igual en las líneas de producto de «Producto terminado» y en la
  tarjeta de teléfono (R13).

### Inventario — menú de fila

- **R9.** El menú ⋯ de la fila de un producto DEBE ofrecer, en este orden, «Lotes», «Historial»,
  «Ajustar existencia», «Editar», un separador y «Borrar» (destructivo); el disparador DEBE
  llamarse «Acciones de <nombre · unidad>» y conservar `data-testid="product-row-actions"` y
  `data-product-id`, y los ítems sus testids de hoy (`product-batches-open`, `product-edit-open`,
  `product-delete-open`) más `product-history-open` y `product-adjust-open`.
- **R10.** SI la persona no tiene permiso para ajustar existencia, ENTONCES el menú NO DEBE ofrecer
  «Ajustar existencia»; el resto de ítems DEBEN ser los de hoy para ese permiso.
- **R11.** CUANDO se elige «Historial» o «Ajustar existencia» en el menú de un producto, el sistema DEBE
  pedir sus lotes con la misma lectura que «Lotes» (todos sus lotes, no solo los vivos que despliega
  la sub-fila del R47); SI tiene exactamente un lote, ENTONCES DEBE abrir
  el historial o el ajuste de ese lote; SI tiene ninguno o varios, ENTONCES DEBE abrir el panel
  «Lotes» del producto para que la persona elija. *(supuesto P1; aclarado en la enmienda
  2026-10-16)*
- **R12.** CUANDO se elige «Lotes», «Editar» o «Borrar», el sistema DEBE abrir para ese producto el
  panel o diálogo de hoy (lotes, edición, borrado), con los mismos campos enviados; en «Producto
  terminado» el menú DEBE ser el mismo en cada línea de producto y pedir los lotes de esa línea.
  Las sub-filas de lote y de estado del R47 y la fila de grupo de «Producto terminado» NO DEBEN
  pintar menú ⋯ ni «Acciones». *(enmienda 2026-10-16)*
- **R13.** MIENTRAS el contenedor de la tabla mide 760 px o menos, el sistema DEBE pintar cada producto
  como tarjeta con imagen, nombre (y número de pedido en «Producto terminado»), el chip de «Tipo»
  (solo en «Todos»), «Presentación» (salvo en la pestaña «Producto») y, en este orden, las cifras
  «Existencia», «Alerta de cantidad», «Disponible» (salvo en «Producto terminado») y «Costo»
  (solo DONDE el R54 lo pinta, y salvo en «Producto terminado»), con sus rótulos (R55) y el aviso
  del R7; al pie, el conmutador «Mostrar lotes» del R58 (en la tabla de productos) y un botón
  «Acciones» de 44 px que abre el menú centrado con el nombre del producto como título e ítems de
  al menos 48 px. *(decisión P12, confirmada en H1; decisión P18; enmienda 2026-10-16; enmienda 2:
  H2·H3 y H4; tablero `docs/diseno/canvas/InventarioColumnasLotes*.dc.html`, aprobado 2026-10-16)*
- **R14.** DONDE un ítem de `RowActionsMenu` declara un separador delante, el menú DEBE pintar una
  línea divisoria (`role="separator"`) antes de ese ítem, en el desplegable y en el diálogo
  centrado, nunca antes del primer ítem que se pinta; sin la declaración, el árbol DEBE ser el de
  hoy. *(mismo contrato que QC-262 R14; ver P16)*

### Panel «Lotes»

- **R15.** El panel «Lotes» DEBE pintar «Lotes» encima del título (el nombre del producto con su
  unidad, como hoy) y una tabla con las columnas «Lote», «Cantidad», «Fecha de compra»,
  «Vencimiento», «Apartado», «Disponible» y acciones; lote, cifras y fechas en cifras tabulares, y
  las cifras y las dos fechas («Fecha de compra» y «Vencimiento») alineadas a la derecha en la
  celda y en la cabecera *(enmienda 2, H2·H3: el tablero `ModalesInventario` las marca `num`)*; las celdas DEBEN conservar sus `data-testid` de hoy
  (`product-batch-lot`, `-quantity`, `-packages`, `-purchase-date`, `-expiry-date`, `-reserved`,
  `-available`); la celda «Vencimiento» DEBE conservar el texto relativo
  (`product-batch-expiry-relative`) y el chip «Vencido» (`product-batch-expired`) de hoy, con
  `data-expiring` y `data-expired`. La disposición en tres líneas de hoy (`product-batch-line-lot`,
  `-line-amounts`, `-line-dates`) la sustituye la tabla. *(supuesto P2; decisión P20; enmienda 2026-10-16)*
- **R16.** El panel DEBE conservar la línea de presentación del envase («Presentación del envase: …» o
  «Envase sin presentación fija») y sus estados de hoy (cargando, error, «Este producto todavía no
  tiene lotes registrados.») con sus textos y `data-testid`.
- **R17.** SI un lote está sobre-reservado, ENTONCES su fila DEBE pintar «Sobre-reservado» con
  `StatusBadge` en tono `danger`, con `data-testid="product-batch-over-reserved"`. *(supuesto P11)*
- **R18.** El menú ⋯ de cada lote DEBE ofrecer «Historial» (`data-testid="batch-history-trigger"`) y,
  DONDE la persona puede ajustar, «Ajustar existencia» (`data-testid="adjust-batch-open"`); su
  disparador DEBE llamarse «Acciones del lote <lote>».
- **R19.** MIENTRAS el contenedor de la tabla de lotes mide 760 px o menos, cada lote DEBE pintarse
  como tarjeta con lote, «Cantidad», «Apartado», «Disponible», «Fecha de compra», «Vencimiento» y el
  botón «Acciones» de 44 px con el menú centrado.
- **R20.** El panel «Lotes» DEBE medir hasta 900 px de ancho y ocupar todo el ancho de la ventana
  cuando esta es más estrecha. *(supuesto P3)*

### Historial del lote

- **R21.** CUANDO se elige «Historial» de un lote, el sistema DEBE abrir el diálogo «Historial del lote
  <lote>» (lote en cifras tabulares) con una tabla de columnas «Tipo», «Cantidad», «Existencia
  anterior», «Total contado», «Motivo», «Pedido», «Autor» y «Fecha»; los asientos, su orden, los
  textos de tipo, el autor «Sistema» y la fecha DEBEN ser los de hoy, y un dato ausente DEBE pintar
  «—»; la columna «Fecha» DEBE alinearse a la derecha en la celda y en la cabecera. *(enmienda 2,
  decisión P27)*
  > *Nota 2026-10-19 (enmienda QC-288):* la tabla pasa a nueve columnas: «Cliente» entra entre
  > «Pedido» y «Autor». Solo los asientos de entrega sin pedido y de su anulación la rellenan (los
  > clientes separados por comas, en orden alfabético) y en ellos «Pedido» pinta «—»; en el resto
  > de tipos «Cliente» pinta «—».
- **R22.** El historial DEBE pedir los asientos la primera vez que se abre y conservar sus estados de
  hoy (cargando, error, lote anterior al libro) con sus textos y `data-testid`
  (`batch-history-entry-*`).
- **R23.** CUANDO se cierra el historial o el ajuste abierto desde el panel «Lotes», el panel DEBE
  seguir abierto; MIENTRAS el contenedor del historial mide 760 px o menos, cada asiento DEBE
  pintarse como tarjeta.
  > *Nota 2026-10-19 (enmienda QC-288):* la tarjeta del asiento suma el campo «Cliente», con su
  > rótulo, entre «Pedido» y el autor: la misma posición relativa que la novena columna de R21.

### Ajustar existencia

- **R24.** El diálogo «Ajustar existencia» DEBE pintar debajo del título «<producto> · Lote <lote>»,
  «Existencia registrada» como campo de solo lectura, «Total contado», la diferencia («Disminución de
  N» o «Aumento de N») con un icono de flecha, «Motivo» con «Merma», «Rotura», «Conteo físico» y
  «Error de carga» (los que hoy admite cada sentido) y «Cancelar» / «Ajustar»; lo enviado, los
  avisos y las reglas DEBEN ser los de hoy.
- **R25.** SI se pulsa «Ajustar» con diferencia y sin motivo, ENTONCES el sistema DEBE pintar «Elige un
  motivo.» debajo del campo «Motivo», con un icono, el campo marcado como inválido y descrito por el
  mensaje, y conservar `data-testid="adjust-batch-reason-error"`.
- **R26.** MIENTRAS la diferencia es un aumento, debajo de «Motivo» DEBE leerse «Para aumentar solo
  valen Conteo físico y Error de carga.».

### Avisos emergentes (D10)

- **R27.** CUANDO se crea un producto, se edita, se ajusta una existencia o se borra un producto, el
  sistema DEBE lanzar una sola vez el aviso emergente de hoy («Producto creado. Lote <lote>.»,
  «Producto actualizado.», «Existencia ajustada.», «Producto borrado.»).
- **R28.** CUANDO se crea una unidad o una presentación desde «Faltan en el catálogo», el sistema DEBE
  lanzar una sola vez «Unidad creada.» o «Presentación creada.» y volver a revisar el archivo como
  hoy. *(supuesto P5)*

### Importar inventario — cabecera y pasos (D6)

- **R29.** La pantalla `/inventario/importar` DEBE pintar, encima del título, «Volver a inventario»
  como botón con flecha que lleva a `/inventario` (`data-testid="inventory-import-back-link"`),
  «Importar inventario» como único `h1` con `PageHeader` (`data-testid="inventory-import-title"`),
  la descripción de hoy y «Descargar plantilla» en las acciones de la cabecera
  (`data-testid="inventory-import-template"`); el permiso exigido DEBE ser el de hoy.
- **R30.** El código de producción NO DEBE pintar «Volver a inventario» como enlace de texto ni
  «Descargar plantilla» fuera de la cabecera.
- **R31.** La pantalla DEBE pintar una barra de pasos «Elegir archivo», «Vista previa» e «Importación
  terminada», numerados 1, 2 y 3, como lista ordenada llamada «Pasos», con el vigente marcado
  `aria-current="step"`; los pasos NO DEBEN ser controles. *(supuesto P6)*
- **R32.** El paso vigente DEBE ser el 1 mientras no hay vista previa ni resultado (también con el
  archivo rechazado o un error), el 2 con la vista previa y el 3 con la importación hecha, sin nada
  importado o ya importada; CUANDO se pulsa «Importar otro archivo» (paso 3) o «Elegir otro
  archivo» (paso 2, R59), el vigente DEBE volver al 1. *(enmienda 2, H5)*
- **R33.** MIENTRAS la barra de pasos no cabe en el ancho, el sistema DEBE desplazarla en horizontal
  sin saltar de línea y sin desbordar la página.

### Importar inventario — paso 1

- **R34.** El paso 1 DEBE pintar una tarjeta que, sin archivo, muestra un icono de subida, «.xlsx ·
  .csv» y «Elegir archivo» de 44 px y, con archivo, su nombre en cifras tabulares, su tamaño y
  «Elegir otro archivo»; la ayuda de límites, el aviso de archivo grande, «Revisar archivo» (con
  flecha, deshabilitado sin archivo válido) y lo enviado DEBEN ser los de hoy; MIENTRAS se revisa,
  «Revisar archivo» DEBE mostrar el icono de carga y `aria-busy="true"`. *(supuesto P10)*

### Importar inventario — paso 2

- **R35.** El paso 2 DEBE pintar una tarjeta «Vista previa» con el nombre del archivo y las cifras
  «Filas», «Se crean», «Suman lote», «Duplicadas» y «Con error», que se reacomodan solas según el
  ancho, conservando el `dt`/`dd` y el `data-testid` de cada cifra.
- **R36.** Las cifras del R35 DEBEN pintarse en el tono de su estado: «Se crean» `success`, «Suman lote»
  `info`, «Duplicadas» `waiting` y «Con error» `danger`.
- **R37.** «Faltan en el catálogo» DEBE pintarse como tarjeta con borde e icono de advertencia, con
  «Unidades» y «Presentaciones» en dos columnas (una sola con 760 px de contenedor o menos), cada
  faltante con su nombre, sus filas y «Crear»; lo que crea y los `data-testid` DEBEN ser los de hoy.
- **R38.** El estado de cada fila de la vista previa y del resultado DEBE pintarse con `StatusBadge`:
  «Crear» y «Creado» en `success`, «Sumar lote» y «Lote sumado» en `info`, «Duplicado» en `waiting`
  y «Error» en `danger`, conservando `data-testid="inventory-import-row-status"` y `data-status`.
- **R39.** Los filtros de filas («Todas», «Crear», «Sumar lote», «Duplicado», «Error» y los del
  resultado) DEBEN pintar su número en cifras tabulares sin paréntesis, con `aria-pressed` y sus
  `data-testid` de hoy; MIENTRAS el contenedor de la tabla de filas mide 760 px o menos, cada fila
  DEBE pintarse como tarjeta con fila, estado, producto y detalle. *(supuesto P13)*
- **R40.** El paso 2 DEBE terminar con «Descargar filas con error» (si hay filas con error) e
  «Importar N filas válidas» (N en cifras tabulares), apilados a todo el ancho con 760 px de
  contenedor o menos; MIENTRAS se importa, el botón DEBE mostrar el icono de carga, `aria-busy` y
  «Importando…». *(supuesto P14)*

### Importar inventario — paso 3

- **R41.** El paso 3 DEBE pintar una tarjeta con icono de éxito, «Importación terminada» (o «No se
  importó nada»), el nombre del archivo, la descripción de hoy, las cifras del resultado de hoy,
  «Descargar filas con error» (si hay) e «Importar otro archivo» como acción principal, y debajo la
  tabla del resultado; el aviso de importación ya hecha DEBE pintarse en este paso con su texto y
  `data-testid` de hoy. *(supuesto P7)*

### Diálogos y teléfono

- **R42.** CUANDO se abre cualquier diálogo de la ruta (historial, ajuste, borrado, menú centrado,
  nueva unidad, nueva presentación) en una ventana de 390 × 844, el diálogo DEBE quedar entero y
  centrado en la pantalla visible, con botones de al menos 44 px.
- **R43.** En ventanas de 1440, 820 y 390 px de ancho, `/inventario` (en «Todos» y en «Producto
  terminado») y cada paso de `/inventario/importar` NO DEBEN desbordar la página en horizontal; lo que
  no cabe se desplaza dentro de su tabla.

### Catálogo, limpieza y no regresión

- **R44.** CUANDO una pieza compartida gana un punto de extensión, `components/shared/CATALOGO.md` DEBE
  tener su fila al día en el mismo commit, con su tablero.
- **R45.** Crear, editar y borrar un producto, ajustar una existencia, revisar e importar un archivo y
  crear un faltante DEBEN enviar los mismos campos a las mismas Server Actions que hoy, y sus errores
  DEBEN pintarse con los componentes y `data-testid` de hoy.
- **R46.** El código de producción de `app/(private)/inventario/` NO DEBE contener «Elegi un motivo»
  ni «Conteo fisico», `movementReasonLabel` (que vive en `movement-reason-label.ts` desde QC-281)
  DEBE devolver el texto con tilde de cada motivo sin derivarlo del valor, y `batch-history.tsx` NO
  DEBE declarar su propia constante táctil (D41). *(supuesto P15; enmienda 2026-10-16: «Conteo
  físico» ya lo trajo QC-281, ded3d3d8; la guardia lo mantiene)*

### Enmienda 2026-10-16 — lo que trajo `dev`

- **R47.** CUANDO se pulsa el conmutador de lotes de un producto (el chevrón `product-batches-toggle`
  en la tabla, o «Mostrar lotes» al pie de la tarjeta, R58), el
  sistema DEBE desplegar debajo una sub-fila por lote vivo (lote, fecha de compra, vencimiento,
  existencia, costo si el R54 lo pinta, reservado y disponible) o una sub-fila de estado (cargando, «Sin lotes con
  existencia.», error con «Reintentar»), con sus textos, su lectura y sus `data-testid` de hoy; MIENTRAS
  el contenedor de la tabla mide 760 px o menos, cada sub-fila DEBE pintarse como tarjeta propia
  justo debajo de la del producto, sin imagen ni «Acciones». *(decisión P17; enmienda 2: H2·H3, H4;
  tablero `docs/diseno/canvas/InventarioColumnasLotes*.dc.html`, aprobado 2026-10-16)*
- **R48.** SI un lote vence a menos de 30 días o ya venció (la regla de hoy, `expiry-warning.ts`),
  ENTONCES su fecha de vencimiento (en la sub-fila y en el panel «Lotes») y el nombre del producto en
  la tabla DEBEN pintarse en el tono de advertencia (ámbar), conservar `data-expiring="true"` y el
  texto relativo de hoy; SI ya venció, ENTONCES DEBE pintarse además el chip «Vencido» con
  `StatusBadge` en tono `danger`; NO DEBE usarse el tono de error para un lote que aún no vence.
  *(decisión P19)*
- **R49.** La pantalla `/inventario/importar` DEBE pintar la guía de importación (`ImportGuide`, con
  sus pestañas, su contenido, los valores de la empresa y sus `data-testid` de hoy) debajo de la
  pantalla de pasos, en los tres pasos, fuera de la barra de pasos. *(decisión P21)*
- **R50.** CUANDO la vista previa trae la fila de ejemplo ignorada, filas con columnas ignoradas, ninguna
  fila válida o filas que se saltan, el paso 2 DEBE pintar sus avisos de hoy (textos, `role="status"`
  y `data-testid`) entre las cifras y «Faltan en el catálogo»; el aviso de columnas ignoradas de
  cada fila DEBE seguir en su «Detalle», también en la tarjeta del R39; y el paso 3 DEBE conservar
  el aviso de fila de ejemplo ignorada de hoy. *(decisión P21)*
- **R51.** CUANDO termina una revisión o una confirmación, el sistema DEBE lanzar una sola vez el aviso
  emergente de hoy de su desenlace (importado con sus totales, nada importado, ya importado, archivo
  rechazado o error del servidor) y NO DEBE lanzar ninguno al llegar a la vista previa; el paso 3
  DEBE pintarse igual con el aviso emergente que sin él.
- **R52.** MIENTRAS la ventana mide 640 px o más, el diálogo «Historial del lote» DEBE medir como
  máximo 1000 px y dejar al menos 16 px libres a cada lado de la ventana.
- **R53.** La tabla de productos DEBE conservar las columnas y el orden de hoy (fb140780): imagen,
  «Nombre» (sin la presentación), «Tipo» (chip con el tono de su tipo, solo en «Todos»),
  «Presentación» (salvo en la pestaña «Producto»), «Existencia», «Disponible», «Reservado»,
  «Alerta de cantidad», «Costo unitario» (solo DONDE el R54 lo pinta) y las acciones, con sus
  `data-testid` de hoy; MIENTRAS la pestaña vigente es «Producto», NO DEBE pintar «Presentación»
  ni en la tabla ni en la tarjeta; la de «Producto terminado» DEBE conservar «Presentación», sin
  «Costo unitario», y el enlace del nombre a la ficha del producto terminado. *(enmienda 2, H4 y
  H1·H6; QC-52 R37)*

### Enmienda 2 (2026-10-16) — costo de `dev`, tablero en tarjetas y sub-filas, «Elegir otro archivo»

- **R54.** DONDE la sesión cumple la regla de hoy para ver costos unitarios (`canViewUnitCosts`), la
  tabla de productos DEBE pintar «Costo unitario» y la tarjeta la cifra «Costo», en moneda con dos
  decimales redondeados y la unidad del producto («$2,500.00 / L»; sin unidad conocida, solo el
  importe), con el valor exacto en `title`, el promedio ponderado en la fila del producto y el
  costo del lote en su sub-fila, y «—» sin costo; SI la sesión no la cumple, ENTONCES la columna,
  la cifra de la tarjeta y el costo de las sub-filas NO DEBEN pintarse, y el servidor NO DEBE
  enviar el costo (la regla y el envío son los de hoy, QC-52 R35–R36). *(enmienda 2, H4; 6a665e3f,
  5496bd16)*
- **R55.** MIENTRAS el contenedor de la tabla de productos (o de «Producto terminado») mide 760 px o
  menos, cada cifra de la tarjeta de producto DEBE llevar delante su rótulo visible («Existencia», «Alerta», «Disponible»,
  «Costo») y cada cifra de la tarjeta de una sub-fila de lote el suyo («Existencia», «Disponible»,
  «Costo»); la tarjeta de la sub-fila de lote NO DEBE pintar «Reservado»; una cifra vacía que se
  pinta como «—» DEBE llevar su rótulo, y solo un campo que no pinta nada queda sin él; el texto
  de cada `data-testid` de cifra DEBE seguir siendo solo la cifra; MIENTRAS el contenedor mide más de 760 px, la tabla NO
  DEBE pintar esos rótulos dentro de las celdas. *(enmienda 2, H2·H3; sin «Reservado» en la tarjeta
  del lote por decisión del humano del 2026-10-16, m8 del review; tablero
  `InventarioColumnasLotes`, teléfono)*
- **R56.** MIENTRAS el contenedor de la tabla de lotes o del historial mide 760 px o menos, la
  tarjeta de cada lote DEBE rotular «Cantidad», «Apartado», «Disponible», «Fecha de compra» y
  «Vencimiento», y la de cada asiento del historial «Existencia anterior», «Total contado»,
  «Motivo» y «Pedido» (el autor y la fecha, sin rótulo), también cuando el valor se pinta como «—»; el texto de cada `data-testid` de celda
  DEBE seguir siendo solo su valor. *(enmienda 2, H2·H3; tablero `ModalesInventario`)*
- **R57.** Cada sub-fila de lote y de estado (R47) DEBE pintarse con un fondo suave distinto del de
  su producto y sangrada respecto de él, y entrar con la animación de entrada de 300 ms del repo:
  MIENTRAS el contenedor de la tabla de productos mide más de 760 px, en todas sus celdas y con su
  contenido de «Nombre» sangrado; MIENTRAS mide 760 px o menos, en su tarjeta, que DEBE quedar
  sangrada respecto de la del producto y con esquinas redondeadas. DONDE la persona pide movimiento
  reducido, la sub-fila NO DEBE animarse. El componente compartido `DataTable` NO DEBE cambiar.
  *(enmienda 2, H2·H3 y decisión P26; tablero `InventarioColumnasLotes`, escritorio y teléfono)*
- **R58.** MIENTRAS el contenedor de la tabla de productos mide 760 px o menos, la tarjeta de cada
  producto DEBE pintar al pie, a la izquierda de «Acciones», un botón de texto «Mostrar lotes»
  («Ocultar lotes» con los lotes desplegados) de al menos 44 px de alto, con icono de chevrón,
  `aria-expanded` y `data-testid="product-batches-card-toggle"`, que hace lo mismo que el chevrón
  de la tabla (R47); la tarjeta NO DEBE pintar el chevrón en el título. *(enmienda 2, H2·H3;
  tablero `InventarioColumnasLotes`, teléfono)*
- **R59.** El paso 2 de `/inventario/importar` DEBE pintar en su cabecera, junto a «Vista previa» y el
  nombre del archivo, un botón secundario «Elegir otro archivo» de al menos 44 px
  (`data-testid="inventory-import-choose-another"`), deshabilitado mientras se importa; CUANDO se
  pulsa, el sistema DEBE volver al paso 1 sin recargar la página, sin archivo elegido, sin vista
  previa ni error, sin importar nada y sin lanzar ningún aviso emergente. *(enmienda 2, H5)*

## Preguntas abiertas

Cada una lleva su opción por defecto, con la que están escritos los requisitos.

- **P1. «Historial» y «Ajustar existencia» desde la fila del producto.** Son acciones de un lote; el
  tablero abre «el lote principal» y lo marca «por confirmar»; el dominio no tiene lote principal.
  *Por defecto:* con un solo lote se abre ese; con ninguno o varios se abre «Lotes» para elegir
  (R11).
- **P2. Columna «Presentación del envase» por lote.** El tablero la pone en cada lote; hoy la
  presentación es del producto y se pinta una vez encima. *Por defecto:* sin columna; la línea de
  encima se queda (R15, R16).
- **P3. Ancho del panel «Lotes».** `InventarioMovil` dice 600 px y `ModalesInventario` lo dibuja a
  900 px; a 600 px la tabla saldría siempre en tarjetas (umbral de 760 px de `DataTable`). *Por
  defecto:* hasta 900 px (R20).
- **P4. Formato de cifras y fechas.** El tablero escribe `120,00` y `12/09/2026 10:14`; hoy son las
  de `formatDecimalDisplay` y `YYYY-MM-DD HH:mm`. *Por defecto:* las de hoy (fuera de esta ficha).
- **P5. Toast al crear una presentación.** El tablero lo escribe entre corchetes
  («[Presentación creada.]»). *Por defecto:* «Presentación creada.» (R28).
- **P6. Pasos clicables.** En el tablero se puede pulsar cada paso. *Por defecto:* la barra solo
  informa; avanzar es «Revisar archivo» e «Importar…», volver es «Importar otro archivo» (R31).
- **P7. Qué repite el paso 3.** El tablero lo marca «por confirmar». *Por defecto:* las cifras del
  resultado de hoy (cinco) y la tabla del resultado debajo (R41).
- **P8. Textos entre corchetes.** «[Borrar el producto]», su texto, «[Qué es X]», «[Elegir]», «[La
  unidad «gal» no está en el catálogo]»… *Por defecto:* se quedan los textos de hoy («Borrar
  producto», «Se va a borrar «X». Esta acción no se puede deshacer.», los motivos de fila del
  módulo) y las ayudas no se añaden.
- **P9. Vencimiento en ámbar.** *Por defecto:* fuera; no hay regla de dominio de «por vencer».
  **Superada el 2026-10-16:** `dev` trajo la regla (08b69744). Lo que queda abierto es su color: P19.
- **P10. Zona de archivo.** El tablero pide `FileField` (arrastrar y soltar), que no admite `.xlsx`,
  comprime imágenes y entrega bytes, no el `File`. *Por defecto:* `ImportUploadField` se queda y
  toma el aspecto de la zona, sin arrastrar y soltar (R34).
- **P11. «Sobre-reservado».** Hoy es `Badge` `destructive`; D3 pide `StatusBadge`. *Por defecto:*
  `StatusBadge` `danger` con el mismo texto y testid (R17).
- **P12. Tablet en tarjetas.** La ficha de tablet dice «la tabla hace scroll horizontal»; con la barra
  lateral en icono el contenedor queda bajo 760 px y `DataTable` pinta tarjetas. *Por defecto:* el
  umbral de `DataTable`, como QC-261 P5 y QC-262 P2 (R13).
- **P13. Contador de los filtros.** Hoy «Todas (48)»; el tablero «Todas 48». *Por defecto:* el del
  tablero (R39).
- **P14. Texto mientras se importa.** El tablero deja «Importar N filas válidas» con el icono de carga;
  hoy dice «Importando…». *Por defecto:* «Importando…» con el icono (R40).
- **P15. D41.** `batch-history.tsx` conserva `TOUCH_TARGET` con dueño QC-223 (`done`). *Por defecto:*
  se resuelve aquí, porque esta ficha reescribe el archivo (R46).
- **P16. Separador de `RowActionsMenu` compartido con QC-262.** QC-262 (aprobado, sin implementar)
  extiende `RowActionsMenu` con `separatorBefore` (su R14, `design.md > D7`). *Por defecto:* se usa
  el mismo contrato; lo implementa la ficha que llegue antes a `dev` y la otra lo reutiliza sin
  tocar la pieza (R14). **Resuelta:** QC-262 lo mergeó (a6a224e5); T1a y T1b no aplican.

### Preguntas de la enmienda 2026-10-16

**Resueltas por el humano el 2026-10-16:** las seis pasan a `## Decisiones cerradas (no reabrir)`
(filas P17–P22), todas con la opción por defecto; P17 y P18 requieren pase `/design`. El texto de
abajo se conserva como historia.

Las abre el merge de `dev` (`d8b82a1d`). Ninguna reabre una decisión cerrada: donde lo mergeado
contradice una, se dice cuál y se propone la opción por defecto, con la que están escritos los
requisitos. **Lo que lleva «fuera del tablero» no está dibujado en
`docs/diseno/canvas/Inventario*.dc.html` ni en `ModalesInventario.dc.html`: el humano decide si hace
falta un pase `/design` antes de la tanda 3 (`docs/perfil-agentes.md > Pase de diseño`).**

- **P17. Sub-filas de lote en tarjeta (f978ef29; fuera del tablero).** El tablero no tiene lotes
  desplegables en la lista. Con `card`, `DataTable` pinta cada sub-fila como una tarjeta más. *Por
  defecto:* se conservan en tabla y en tarjeta; la tarjeta de la sub-fila es la de `DataTable` sin
  extensión (sin imagen, sin «Acciones»), justo debajo de la del producto, y la ficha no cambia el
  aspecto de la sub-fila en la tabla (R47). Si el humano quiere otro aspecto en teléfono, hace falta
  pase `/design`.
- **P18. «Costo», «Tipo» y «Presentación» (b0eaa866, 6f08e379, c2ac0e65; fuera del tablero).** El
  tablero no tiene esas columnas. b0eaa866 centró «Costo» «como el resto de la tabla», y R6 pasa el
  resto a la derecha: dejarla centrada la haría la única cifra centrada. *Por defecto:* se conservan
  las tres; «Costo» a la derecha como las demás cifras del R6 (el tablero alinea toda cifra a la
  derecha, clase `num`); en la tarjeta, «Tipo» como chip de estado (solo en «Todos») y «Presentación» y
  «Costo» en las cifras (R6, R13, R53).
- **P19. Color de «por vencer» (08b69744) contra D3.** `dev` pinta en rojo (`text-destructive`) el
  vencimiento a menos de 30 días y el nombre del producto. D3 (cerrada) da el ámbar a lo que espera o
  avisa y el rojo al error, y el tablero pinta el vencimiento cercano en ámbar. **No se cambia D3.**
  *Por defecto:* la regla, los textos relativos y el chip «Vencido» se quedan; el color de «por
  vencer» pasa a ámbar y «Vencido» queda en `danger` (R48). Si el humano prefiere el rojo de `dev`,
  R48 se reescribe y la guardia de D16 no mira el vencimiento.
- **P20. Panel de lotes en tres líneas (ccde16f7) contra la tabla del tablero.** `dev` repartió cada
  lote en tres líneas (lote · cantidades · fechas) después del spec; el tablero aprobado
  (`ModalesInventario`, D14) dibuja una tabla. *Por defecto:* la tabla del tablero, con tarjetas en
  teléfono; los `data-testid` de las tres líneas desaparecen y sus aserciones se enmiendan (R15).
- **P21. Guía de importación y avisos de la vista previa (c4f824fe, 6cc59959; fuera del tablero).**
  `InventarioImportar*` no dibuja la guía ni los avisos de columnas ignoradas. *Por defecto:* la guía
  se queda debajo de la pantalla en los tres pasos, con su aspecto de hoy (R49); los avisos van en el
  paso 2 entre las cifras y los faltantes, con su aspecto de hoy (R50). Sin cambio visual de esas
  piezas, no hace falta pase `/design`.
- **P22. Esqueleto de la lista (D53).** El esqueleto tiene 9 columnas y no pasa a tarjeta; la tabla
  real tiene 10 en «Todos» y 7 en «Producto terminado» (6f08e379) y pasa a tarjeta con `card`. *Por
  defecto:* no se arregla aquí; D53 se amplía a `/inventario` con estos números (T7c), como ya decía
  `design.md > 11`.

### Preguntas de la enmienda 2 (2026-10-16)

**Resueltas por el humano el 2026-10-16:** las cinco pasan a `## Decisiones cerradas` (filas
P23–P27). P23, P24 y P25 con la opción por defecto; **P26 y P27 con el tablero, no con el defecto**
(R57 y R21 reescritos). El texto de abajo se conserva como historia.

Las abre la enmienda 2. Ninguna reabre H1–H6: son detalles que esas filas no cubren.

- **P23. Orden de las columnas de la tabla: tablero contra `dev`.** El tablero de escritorio
  (`InventarioColumnasLotes`) dibuja Existencia · Alerta · Reservado · Disponible · Costo; `dev`
  (fb140780) pinta Existencia · Disponible · Reservado · Alerta · Costo unitario. H4 solo fija
  «Costo» al final. *Por defecto:* el orden de `dev` (regla de la enmienda: lo mergeado se conserva;
  el review ya decía que la tabla no tiene requisito de orden) (R53), y el leader corrige el
  tablero. El mismo tablero dice «sin redondear» del costo, contra H4: también lo corrige el leader.
- **P24. Dónde van «Tipo» y «Presentación» en la tarjeta.** El tablero los pone en una línea bajo el
  nombre. `DataTable` no tiene un hueco bajo el título distinto de `meta`, y H2·H3 prohíben tocarlo.
  *Por defecto:* «Tipo» en el hueco de estado, arriba a la derecha (como ya está), y «Presentación»
  la primera de la `meta`, sin rótulo, justo bajo el nombre y delante de las cifras (R13).
- **P25. Rótulo del costo en la tarjeta.** La cabecera de `dev` dice «Costo unitario»
  (`COST_COLUMN_LABEL`) y la tarjeta del tablero dice «Costo». *Por defecto:* «Costo unitario» en
  la cabecera (es de `dev`) y «Costo» en la tarjeta (manda el tablero, H2·H3) (R54, R55).
- **P26. Fondo y sangría de las tarjetas de lote en teléfono.** H2·H3 piden fondo, sangría y
  animación «en escritorio»; el tablero de teléfono también dibuja fondo suave y sangría en la
  tarjeta de cada lote (`.lot-m`). *Por defecto:* solo escritorio, como dice H2·H3; en teléfono la
  sub-fila sigue siendo la tarjeta de `DataTable` sin extensión (P17, R47).
- **P27. «Fecha» del historial a la derecha.** `ModalesInventario` la marca `num`, como las fechas del
  panel «Lotes», pero H2·H3 solo nombran las fechas del panel. *Por defecto:* sin cambio (R21).
