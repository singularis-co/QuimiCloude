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
- **Vencimiento en ámbar** de los lotes que vencen pronto: el tablero lo pinta, pero el dominio no
  tiene regla de «por vencer» (P9).
- **Arrastrar y soltar** el archivo en la importación (P10).
- **Columna «Presentación del envase» por lote** en el panel de lotes (P2).
- **Icono en la cabecera del diálogo de borrado:** `DeleteConfirmDialog` no lo tiene y QC-262 lo dejó
  como deuda de la pieza compartida (su P5); el diálogo de borrado conserva su árbol de hoy.
- Cambiar el formato de cifras (`120,00`) o de fechas (`12/09/2026`) del tablero: se quedan los de
  hoy (P4).
- Lo que no es de esta ruta: QC-178 (precisión del coste unitario), QC-197 (lote real usado por el
  operador) y QC-253 (lote al acondicionar), todas `pending`. No se adelanta nada de ellas.

## Decisiones cerradas (no reabrir)

La ficha llegó sin `/afinar-feature`. Estas filas son decisiones del humano ya tomadas en
`progress/rediseno.md` (2026-10-10) o al aprobar specs anteriores; este spec no las abre.

| # | Decisión | Quién y cuándo | Enmienda a | Cubierta por |
| --- | --- | --- | --- | --- |
| D2 | Acciones de fila siempre en el menú ⋯. En teléfono la tabla pasa a tarjetas y «Acciones» abre el menú centrado en la pantalla visible. «Volver…» nunca es enlace de texto: es botón con flecha | humano, 2026-10-10 (`progress/rediseno.md` D2) | — | R9, R12, R13, R14, R18, R19, R23, R29, R30 |
| D3 | Tonos por significado con un único `StatusBadge` y un único mapa por dominio (ámbar = waiting, danger = Error, success = Añadido/Nuevo…) | humano, 2026-10-10 (D3) | QC-227 (variante de `Badge` de «Sobre-reservado») | R7, R17, R36, R38 |
| D6 | Importar inventario con barra de pasos: Elegir archivo · Vista previa · Importación terminada | humano, 2026-10-10 (D6) | — | R31, R32, R33 |
| D7 | Tallas de botón: sm 32 · default 36 · touch 44 · xl 52 | humano, 2026-10-10 (D7) | — | R2, R13, R34, R42 |
| D9 | Corregir textos sin tildes y el voseo («Elegi un motivo.» → «Elige un motivo.») | humano, 2026-10-10 (D9) | QC-92 (etiqueta derivada «Conteo fisico») | R24, R25, R46 |
| D10 | Agregar los toasts que faltan | humano, 2026-10-10 (D10) | — | R27, R28 |
| D14 | Lo demás del canvas queda aprobado; cada pantalla en escritorio, tablet y teléfono | humano, 2026-10-10 (D14) | — | R1, R5, R6, R15, R19, R29, R35, R39, R42, R43 |
| QC-256 | `UrlTabs`, `PageShell`, `PageHeader`, `ArrowLink`, `StatusBadge`, `RowActionsMenu` centrado y `DataTable` con `card` son las piezas del rediseño | humano, 2026-10-10 (aprobación de QC-256) | — | R1, R3, R13, R30 |
| QC-270 | La cabecera de `DataTable` sigue la alineación de su columna (ya en `dev`) | humano, 2026-10-13 | — | R6 |

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

- **R6.** Las columnas «Existencia», «Alerta de cantidad», «Reservado» y «Disponible» (y
  «Existencia» y «Alerta de cantidad» en «Producto terminado») DEBEN alinearse a la derecha en la
  celda y en la cabecera, en cifras tabulares; la cifra de «Disponible» DEBE pintarse en negrita.
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
  pedir sus lotes con la misma lectura que «Lotes»; SI tiene exactamente un lote, ENTONCES DEBE abrir
  el historial o el ajuste de ese lote; SI tiene ninguno o varios, ENTONCES DEBE abrir el panel
  «Lotes» del producto para que la persona elija. *(supuesto P1)*
- **R12.** CUANDO se elige «Lotes», «Editar» o «Borrar», el sistema DEBE abrir para ese producto el
  panel o diálogo de hoy (lotes, edición, borrado), con los mismos campos enviados; en «Producto
  terminado» el menú DEBE ser el mismo en cada línea de producto y pedir los lotes de esa línea.
- **R13.** MIENTRAS el contenedor de la tabla mide 760 px o menos, el sistema DEBE pintar cada producto
  como tarjeta con imagen, nombre (y número de pedido en «Producto terminado»), «Existencia»,
  «Alerta de cantidad», «Disponible» (salvo en «Producto terminado») y el aviso del R7, y un botón
  «Acciones» de 44 px que abre el menú centrado con el nombre del producto como título e ítems de al
  menos 48 px. *(supuesto P12)*
- **R14.** DONDE un ítem de `RowActionsMenu` declara un separador delante, el menú DEBE pintar una
  línea divisoria (`role="separator"`) antes de ese ítem, en el desplegable y en el diálogo
  centrado, nunca antes del primer ítem que se pinta; sin la declaración, el árbol DEBE ser el de
  hoy. *(mismo contrato que QC-262 R14; ver P16)*

### Panel «Lotes»

- **R15.** El panel «Lotes» DEBE pintar «Lotes» encima del título (el nombre del producto con su
  unidad, como hoy) y una tabla con las columnas «Lote», «Cantidad», «Fecha de compra»,
  «Vencimiento», «Apartado», «Disponible» y acciones; lote, cifras y fechas en cifras tabulares y
  las cifras a la derecha; las celdas DEBEN conservar sus `data-testid` de hoy
  (`product-batch-lot`, `-quantity`, `-packages`, `-purchase-date`, `-expiry-date`, `-reserved`,
  `-available`). *(supuesto P2)*
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
  «—».
- **R22.** El historial DEBE pedir los asientos la primera vez que se abre y conservar sus estados de
  hoy (cargando, error, lote anterior al libro) con sus textos y `data-testid`
  (`batch-history-entry-*`).
- **R23.** CUANDO se cierra el historial o el ajuste abierto desde el panel «Lotes», el panel DEBE
  seguir abierto; MIENTRAS el contenedor del historial mide 760 px o menos, cada asiento DEBE
  pintarse como tarjeta.

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
  importado o ya importada; CUANDO se pulsa «Importar otro archivo», el vigente DEBE volver al 1.
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
  ni «Conteo fisico», y `batch-history.tsx` NO DEBE declarar su propia constante táctil (D41).
  *(supuesto P15)*

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
  tocar la pieza (R14).
