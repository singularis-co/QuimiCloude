# QC-264 — Rediseño de Fórmulas · requirements.md

## Alcance

Lleva al diseño del canvas (página 5) las pantallas de Fórmulas y sus modales: el **listado**
(`/produccion/formulas`), el **formulario** de alta y edición (`/produccion/formulas/nueva`,
`/produccion/formulas/<id>`), las **versiones** (`/produccion/formulas/<id>/versiones/nueva` y
`…/versiones/<versionId>`) y la **revisión de importación** (`/produccion/formulas/importar/<archivo>`).
Fuente: `docs/diseno/canvas/Formulas*.dc.html`, `Formula*.dc.html`, `FormulaVersion*.dc.html`,
`ImportarFormula*.dc.html` y `ModalesProduccion.dc.html`, y `progress/rediseno.md`. **El diseño manda
sobre lo visual**; el comportamiento (permisos, acciones, campos enviados, reglas de suma, propagación,
choque de nombre) es el de hoy salvo lo que dice cada requisito.

Lo que pide la ficha:

1. **Vista previa:** el lector paso a paso ocupa toda la pantalla en teléfono.
2. **Propagar versiones:** título en singular y en plural.
3. **Editor de pasos:** con barra de formato y arrastre.
4. **Versiones:** lista con «Por revisar».
5. **Textos (D9):** corregir las tildes; hoy la vista previa dice «Asi se leera» y «aqui».
6. **Toasts (D10):** los que falten, como «Receta actualizada.».

Lo que ya existe y solo se restila o se fija con test (ver `design.md > Lo que ya existe`): el título
singular y plural de propagar, la barra de formato (Negrilla, Cursiva, Lista de verificación), el
arrastre con `@dnd-kit` y su equivalente por teclado, la marca «Por revisar» y los seis toasts de la
ruta («Receta actualizada.» incluido).

### Lo que NO entra

- **Tiempo de espera por paso** en la barra del editor: la espera es de la empresa (QC-125), no del
  paso; añadirla cambia el modelo (P6).
- **«Devolver»** un ingrediente quitado en la versión y el texto «No se quitó nada de la original»: son
  conducta nueva marcada «por confirmar» (P8).
- **Nombre del PDF** bajo el título de la revisión: la vista previa de la importación no lo trae; es
  trabajo de módulo (`documentos`) (P10).
- **Icono en la cabecera de los diálogos** (`dlg-ic` del tablero): `ConfirmDialog` no lo tiene; queda
  como la deuda que abrió QC-262 (P14).
- Versiones creadas desde el alta y «Guardar y salir» (QC-210), fases de ingredientes (QC-173), pasos
  propios de la versión (QC-198) y evidencia por paso (QC-214): no se adelanta nada de ellas.
- Pasar el import profundo de `StepDocumentView` por el barrel de `step-reader` (QC-268).

## Decisiones cerradas (no reabrir)

La ficha llegó sin `/afinar-feature`. Estas filas son decisiones del humano ya tomadas en
`progress/rediseno.md` (2026-10-10) o al aprobar specs anteriores; este spec no las abre.

| # | Decisión | Quién y cuándo | Enmienda a | Cubierta por |
| --- | --- | --- | --- | --- |
| D2 | Acciones de fila siempre en el menú ⋯; en teléfono la tabla pasa a tarjetas y «Acciones» abre el menú centrado. «Volver…» nunca es enlace de texto: es botón con flecha | humano, 2026-10-10 (`progress/rediseno.md` D2) | — | R3, R5, R9, R10, R30, R32, R37, R43 |
| D3 | Tonos por significado con un único `StatusBadge` y un único mapa por dominio («Por revisar», «Cambiado» en ámbar; «Añadido», «Listo», «Subido» en éxito; «Quitado», «Error», «No se pudo subir» en peligro; «Procesando» en info; «Subiendo» en progreso) | humano, 2026-10-10 (D3) | QC-227 (`badges-estado`, «Por revisar» en `info`) | R8, R28, R30, R33, R35, R44 |
| D7 | Tallas de botón: touch 44 | humano, 2026-10-10 (D7) | — | R15, R20, R36, R40 |
| D9 | Corregir textos sin tildes | humano, 2026-10-10 (D9) | — | R21, R45 |
| D10 | Agregar los toasts que faltan | humano, 2026-10-10 (D10) | — | R46 |
| D14 | Lo demás del canvas queda aprobado; cada pantalla en escritorio, tablet y teléfono | humano, 2026-10-10 (D14) | — | R5, R13, R20, R23, R47 |
| QC-159 (2026-09-25) | El revisor elige reemplazar o cambiar el nombre; **la revisión avisa del choque antes de confirmar** | humano, 2026-09-25 | — | R41 |
| QC-26 R45 | `@dnd-kit/*` solo lo importa `recipe-steps-field.tsx`; el editor (`@tiptap/*`) solo `recipe-step-editor.tsx` y `recipe-step-schema.ts` | humano (aprobación de QC-26 y QC-64) | — | R19 |
| QC-64 R26 | La vista previa no usa el alto completo de la ventana con `vh` | humano (aprobación de QC-64) | Esta ficha: en teléfono ocupa la pantalla visible con `dvh` (ficha `FormulaMovil`) | R23 |
| QC-256 | Las marcas de versión de receta se quedan en su ruta y les pone tono esta ficha | humano, 2026-10-10 (aprobación de QC-256) | — | R33, R44 |
| QC-262 D7 | Separador del menú ⋯ con `separatorBefore` por ítem, sin variante (contrato compartido con QC-263) | humano, 2026-10-13 (aprobación de QC-262) | — | R3 |

## Requisitos (EARS)

Los requisitos marcados *(supuesto Pn)* están escritos con la opción por defecto de la pregunta
abierta `Pn`; si el humano elige otra, se reescriben antes de implementar.

### Listado (`/produccion/formulas`)

- **R1.** La pantalla del listado DEBE pintar dentro de `PageShell` un `PageHeader` con «Fórmulas» como
  único `h1` (`data-testid="recipes-title"`) y, como acciones y en este orden, «Subir PDFs» (contorno)
  y «Nueva fórmula» (principal, `data-testid="recipe-create-open"`); DONDE el usuario no puede subir
  documentos, «Subir PDFs» NO DEBE pintarse, como hoy.
- **R2.** La tabla de recetas DEBE pintar las columnas Imagen, Nombre, Pasos, Creado, Actualizado y la
  de acciones, en ese orden; Pasos, Creado y Actualizado DEBEN alinearse al final de la celda, con su
  cabecera alineada igual y cifras tabulares. El orden, el filtro de fecha y la búsqueda «Buscar
  receta» DEBEN ser los de hoy.
- **R3.** El menú ⋯ de cada fila DEBE ofrecer «Editar» (enlace a la ficha de la receta,
  `recipe-edit-open`), un separador y «Borrar» como ítem destructivo (`recipe-delete-open`); su
  disparador DEBE llamarse «Acciones de <nombre>» y conservar `data-testid="recipe-row-actions"` y
  `data-recipe-id`.
- **R4.** CUANDO se elige «Borrar» en el menú de una receta, el sistema DEBE abrir el diálogo de
  borrado de hoy para esa receta (textos, cuenta de versiones, bloqueo mientras cuenta, envío, error y
  toast «Receta borrada.»), y la tabla NO DEBE montar más de un diálogo de borrado a la vez.
- **R5.** MIENTRAS el contenedor de la tabla mide 760 px o menos, el sistema DEBE pintar cada receta
  como tarjeta con la miniatura y el nombre arriba, «Pasos», «Creado» y «Actualizado» como datos
  secundarios y el botón «Acciones» de 44 px, que abre el menú centrado con el nombre de la receta
  como título e ítems de 48 px.
- **R6.** Los estados de carga, error, vacío («Todavía no hay recetas en el catálogo.» con «Nueva
  fórmula») y sin coincidencias («Ninguna receta coincide con la búsqueda o los filtros.» con «Limpiar
  búsqueda y filtros») DEBEN ser los de hoy, con sus `data-testid`, en tabla y en tarjetas.

### Subir PDFs (modal del listado) *(supuesto P1)*

- **R7.** El diálogo «Subir PDFs» DEBE pintar la descripción «Solo PDF, hasta N archivos por tanda.»
  con el tope de la tanda; desde 640 px de ventana DEBE medir hasta 640 px de ancho, y MIENTRAS la
  ventana mide menos de 640 px DEBE ocupar el ancho visible menos 16 px por lado y desplazar su
  contenido por dentro sin superar el alto visible.
- **R8.** Cada archivo del diálogo DEBE pintar su fase o su estado con `StatusBadge`: «Sin subir» y «En
  cola» en `neutral`, «Subiendo» en `progress`, «Subido» y «Listo» en `success`, «Procesando» en
  `info`, «No se pudo subir» y «Error» en `danger`, conservando su `data-testid` y su `data-phase` o
  `data-status`.
- **R9.** El disparador «Subir PDFs» DEBE llevar el icono de subida, y «Revisar» de un archivo listo
  DEBE ser un botón con flecha de 44 px que lleva a la revisión de hoy con su `data-testid`.

### Formulario de receta (alta y edición)

- **R10.** El formulario DEBE pintar, dentro de `PageShell`, el botón «Volver a la lista» con flecha
  hacia `/produccion/formulas` y debajo el `h1` de hoy («Nueva fórmula» o «Editar fórmula ·
  <nombre>», `data-testid="recipe-form-title"`).
- **R11.** El formulario DEBE agrupar sus campos en tarjetas, en este orden: imagen, nombre y
  descripción; «Ingredientes y herramientas»; «Pasos»; «Pasos de envasado»; cada campo con su
  etiqueta, su error y su `data-testid` de hoy. *(supuesto P8: la primera tarjeta no lleva título
  visible)*
- **R12.** Las pestañas «Ingredientes» y «Herramientas» DEBEN mostrar junto a su etiqueta el número de
  líneas de su lista (sin contar la fila en blanco de arranque) y conservar sus `data-testid`.
- **R13.** MIENTRAS el contenedor de la página mide 880 px o más, la sección «Versiones» DEBE pintarse
  a la derecha del formulario, en una columna de al menos 300 px; con menos, DEBE pintarse debajo del
  formulario y antes del pie. *(supuesto P13)*
- **R14.** CUANDO se abre el alta de una receta, la sección «Versiones» DEBE pintar «Nueva versión»
  deshabilitado y «Esta receta todavía no tiene versiones.». *(supuesto P2)*
- **R15.** El formulario DEBE pintar un pie fijo al borde inferior del área de contenido, visible sin
  desplazar la página, con «Vista previa» a la izquierda y «Cancelar» y «Guardar» a la derecha, botones
  de al menos 44 px y el margen inferior seguro (`safe-area-inset-bottom`); «Guardar» DEBE conservar
  su conducta de hoy (deshabilitado sin suma completa o sin producto, «Guardando…», envío por teclado).

### Editor de pasos (Pasos y Pasos de envasado)

- **R16.** Cada paso DEBE pintarse como tarjeta con el asa de arrastre y, debajo, el número del paso a
  la izquierda; el editor con su barra de formato (Negrilla, Cursiva, Lista de verificación) encima del
  área editable en el centro; y a la derecha el botón de quitar con icono y nombre accesible «Quitar
  paso N». Cada control DEBE medir al menos 44 × 44 px y los `data-testid` DEBEN ser los de hoy.
  *(supuesto P5)*
- **R17.** «Añadir paso» y «Añadir paso de envasado» DEBEN pintarse al final de su lista, a todo el
  ancho y con borde discontinuo, con sus `data-testid` de hoy.
- **R18.** MIENTRAS se arrastra un paso, su tarjeta DEBE marcarse como tomada (sombra elevada, borde
  en el color principal y escala 1,01, `data-dragging="true"`) y las demás tarjetas de esa lista como
  destino (borde discontinuo, `data-drop-target="true"`); CUANDO se suelta o se cancela, ninguna
  tarjeta DEBE conservar esas marcas. Con `prefers-reduced-motion`, la tarjeta tomada NO DEBE escalar.
  *(supuesto P4)*
- **R19.** El arrastre con puntero (umbral de 8 px), el equivalente por teclado, los anuncios de
  posición, el nombre del asa («Arrastrar el paso en la posición N de M») y el orden resultante DEBEN
  ser los de hoy, y solo `recipe-steps-field.tsx` DEBE importar `@dnd-kit/*`.
- **R20.** CUANDO el formulario de receta, el de versión o la revisión de importación se abren en una
  ventana de 390 × 844, ninguno DEBE desbordar en horizontal, cada fila de ingrediente DEBE partirse en
  dos líneas (producto arriba; porcentaje, cantidad y quitar abajo) y todo control interactivo DEBE
  medir al menos 44 × 44 px.

### Vista previa

- **R21.** El diálogo de vista previa DEBE titularse «Vista previa», describirse con «Así se leerá esta
  receta, paso a paso. Nada de lo que hagas aquí se guarda.» y ofrecer un botón «Cerrar» de 44 × 44 px.
- **R22.** Dentro de la vista previa, el lector DEBE pintar arriba «Paso N de M» y una barra de
  progreso con un tramo por paso (marcados los tramos hasta el actual); en medio, el paso con
  desplazamiento propio, el motivo de bloqueo como aviso `info` («Marca los N elementos pendientes para
  continuar.») y la espera como aviso `warning` («Espera MM:SS para continuar.»); y abajo, en un pie
  fijo del diálogo, «Anterior» y «Siguiente» (o «Finalizar» en el último paso) alineados a la derecha,
  de 44 px, con sus `data-testid` de hoy.
- **R23.** MIENTRAS la ventana mide menos de 768 px, la vista previa DEBE ocupar la pantalla visible
  entera (alto `100dvh`, sin margen ni radio) con el pie respetando el margen inferior seguro; desde
  768 px DEBE centrarse con hasta 920 px de ancho y hasta 900 px de alto, sin superar la ventana
  menos 64 px.
- **R24.** CUANDO el lector de la vista previa cambia de paso, el paso nuevo DEBE entrar deslizándose
  28 px desde el lado hacia el que se avanza (`data-direction="advance"` o `"go_back"`); con
  `prefers-reduced-motion` NO DEBE desplazarse.
- **R25.** La vista previa DEBE seguir proyectando los pasos del estado actual del formulario sin
  guardar ni navegar, desmontarse al cerrarse (lo marcado se pierde) y devolver el foco a «Vista
  previa», como hoy.
- **R26.** Fuera de la vista previa, el lector (`StepReader`) DEBE pintar el mismo árbol que hoy, en
  modo `lectura` y en modo `ejecucion`.

### Propagar a versiones

- **R27.** El diálogo de propagar DEBE titularse «1 versión parte de esta receta» con una versión y «N
  versiones parten de esta receta» con más de una, con el número en monoespaciada.
- **R28.** Cada versión del diálogo de propagar DEBE pintarse como fila de al menos 48 px con su
  casilla, su nombre y, DONDE la versión está por revisar, «Por revisar» con `StatusBadge` en tono
  `waiting`.
- **R29.** El diálogo de propagar DEBE ofrecer «Cancelar», «Guardar sin propagar» y «Guardar y
  propagar» con la conducta de hoy (todas marcadas al abrir, «Guardar y propagar» deshabilitado sin
  ninguna marcada, mismas versiones enviadas en el orden de la lista).

### Versiones

- **R30.** Cada versión de la sección «Versiones» DEBE pintarse en una fila con su nombre en una sola
  línea (cortado con elipsis y con el nombre completo como `title`), «Por revisar» con `StatusBadge`
  `waiting` en una sola línea DONDE la versión lo está (`data-testid="recipe-version-under-review"`),
  el botón «Abrir» con flecha y nombre accesible «Abrir la versión <nombre>»
  (`data-testid="recipe-version-link"`) que lleva a la versión, y el borrado de versión de hoy.
  *(supuesto P3)*
- **R31.** La cabecera de la sección «Versiones» DEBE pintar «Nueva versión» como botón pequeño con
  icono de más que lleva al alta de versión (`data-testid="recipe-version-new"`).
- **R32.** La página de una versión (alta y edición) DEBE pintar, dentro de `PageShell`, el botón
  «Volver a la receta» con flecha hacia la ficha de la receta original y debajo el `h1` de hoy
  («Nueva versión de <original>» o el nombre de la versión, `data-testid="recipe-version-page-title"`).
  *(supuesto P8)*
- **R33.** En el formulario de versión, la marca de cada línea DEBE pintarse con `StatusBadge`
  («Igual» en `neutral`, «Cambiado» en `waiting`, «Añadido» en `success`) y cada quitado con «Quitado»
  en `danger`; CUANDO la línea está «Cambiado», el porcentaje original DEBE pintarse tachado. Los
  `data-testid` y `data-mark` DEBEN ser los de hoy.
- **R34.** El formulario de versión DEBE pintar en la cabecera de sus líneas el resumen «Igual N»,
  «Cambiado N» y «Añadido N» con `StatusBadge`, y CUANDO cambia una línea, el resumen DEBE contar las
  marcas nuevas.
- **R35.** MIENTRAS la versión que se edita está por revisar, el formulario DEBE pintar «Por revisar»
  con `StatusBadge` `waiting` y `data-testid="recipe-version-form-under-review"`.
- **R36.** El formulario de versión DEBE pintar un pie fijo con «Cancelar» y «Guardar» de al menos
  44 px y el margen inferior seguro, con la conducta y los toasts de hoy.

### Revisión de importación

- **R37.** La revisión DEBE pintar, dentro de `PageShell`, el botón «Volver al listado» con flecha hacia
  `/produccion/formulas` y debajo «Revisar fórmula» como único `h1` (`data-testid="formula-import-title"`).
- **R38.** La revisión DEBE agrupar nombre y descripción en una tarjeta y los ingredientes en otra
  titulada «Ingredientes» cuya cabecera muestra el número de ingredientes y la suma de porcentajes
  («N · S %»), sin dejar de pintar la suma de hoy (`formula-import-sum`).
- **R39.** Cada ingrediente de la revisión DEBE pintarse como tarjeta con su número, «Referencia del
  PDF» con lo leído, el botón de quitar, el porcentaje y el producto elegido o la materia prima nueva
  con su conmutador de hoy; MIENTRAS la ventana mide menos de 640 px, el botón de quitar DEBE mostrar
  solo el icono, con 44 × 44 px y nombre accesible «Quitar el ingrediente N».
- **R40.** «Añadir ingrediente» DEBE pintarse a todo el ancho con borde discontinuo, y «Confirmar» en
  un pie fijo con el margen inferior seguro, con la conducta de hoy (deshabilitado con motivos,
  «Confirmando…»).
- **R41.** MIENTRAS el nombre choca con una receta viva y el revisor no ha elegido, la revisión DEBE
  avisarlo en la propia pantalla, antes de confirmar, con `Notice` en tono `warning`, el texto de hoy y
  los botones «Cambiar el nombre» y «Reemplazar» (este como destructivo), con sus `data-testid`.
  *(supuesto P9)*
- **R42.** CUANDO la confirmación termina bien, la revisión DEBE pintar una tarjeta de resumen con el
  icono de éxito, el resultado de hoy («Se creó una fórmula nueva.» o «Se reemplazó la fórmula
  existente.») como título, «Materias primas creadas» y «Materias primas reutilizadas» con su cifra, y
  los botones «Volver al listado» y «Ver la fórmula» (con flecha hacia la ficha), con sus `data-testid`.
- **R43.** SI la revisión no se puede abrir, ENTONCES el sistema DEBE pintar «No se pudo abrir esta
  revisión.» con el botón «Volver al listado» con flecha, con los `data-testid` de hoy.

### Tonos, textos y avisos emergentes

- **R44.** Ningún archivo de `app/(private)/produccion/formulas/` DEBE importar
  `@/components/ui/badge`, y los tonos de las marcas de versión DEBEN salir de un único mapa de la ruta.
- **R45.** La ruta y la subida de PDF DEBEN decir «Así se leerá…», «aquí», «Quitar la selección» y «La
  tanda ya no está disponible.»; el código de producción NO DEBE contener «Asi se leera», «aqui se
  guarda», «Quitar la seleccion» ni «ya no esta disponible».
- **R46.** CUANDO termina bien guardar una receta nueva, guardar una receta editada (también si queda
  alguna versión por revisar), borrar una receta, crear una versión, editar una versión o borrar una
  versión, el sistema DEBE lanzar exactamente un toast de éxito con «Receta creada.», «Receta
  actualizada.», «Receta borrada.», «Versión creada.», «Versión actualizada.» o «Versión borrada.»,
  respectivamente.

### Teléfono, catálogo y sin regresión

- **R47.** CUANDO se abre en una ventana de 390 × 844 el diálogo de borrar receta, el de propagar, el
  de subir PDFs o el menú centrado de una tarjeta, el diálogo DEBE quedar entero dentro de la pantalla
  visible y sus botones DEBEN medir al menos 44 px.
- **R48.** CUANDO una pieza compartida gana un punto de extensión o cambia su aspecto
  (`StepReader`, `RowActionsMenu`, `DocumentUpload`), `components/shared/CATALOGO.md` DEBE tener su fila
  al día en el mismo commit, con su tablero en `Diseño`.
- **R49.** Crear, editar y borrar receta, crear, editar y borrar versión, propagar, subir PDFs y
  confirmar una importación DEBEN enviar los mismos campos a las mismas Server Actions que hoy, con los
  mismos permisos de página, y sus errores DEBEN pintarse con los `data-testid` de hoy.

## Preguntas abiertas

Cada una lleva su opción por defecto, con la que están escritos los requisitos.

- **P1. Subir PDFs es una pieza compartida.** `DocumentUploadDialog` también lo usa el detalle de
  proveedor (QC-266, `pending`). *Por defecto:* el restilado (tamaño, tonos, «Revisar» con flecha,
  tildes) entra aquí porque este tablero es el que lo dibuja; proveedores lo hereda igual y su
  snapshot (`catalogo-paridad`) se actualiza en esta ficha. Alternativa: dejarlo entero a QC-266 y
  quitar R7–R9.
- **P2. Versiones en el alta.** El tablero pinta la sección en el alta con «Nueva versión»
  deshabilitado; crear versiones desde el alta es QC-210 (`pending`). *Por defecto:* la sección se pinta
  deshabilitada (R14) y QC-210 la habilita después. Alternativa: no pintarla en el alta.
- **P3. Borrar una versión desde la lista.** El tablero no lo dibuja y hoy existe. *Por defecto:* se
  conserva el botón de icono de hoy al final de la fila, después de «Abrir». Alternativa: un menú ⋯ por
  versión con «Borrar».
- **P4. Arrastre por toques del tablero** («[Toca otro paso para soltarlo ahí]»: tocar el asa toma el
  paso y tocar otro lo suelta). *Por defecto:* se conserva el arrastre de hoy (puntero, táctil y
  teclado con `@dnd-kit`, ya aprobado) y se le añaden los estados visuales (R18); no hay modo de toque a
  toque ni librería nueva.
- **P5. Botones de la barra de formato.** El tablero los dibuja de 32 px. *Por defecto:* siguen de
  44 × 44 px (regla multiplataforma y QC-64 R26); solo cambian a la barra compacta con fondo atenuado.
- **P6. Tiempo de espera por paso** en la barra del editor. *Por defecto:* fuera; la espera es por
  empresa (QC-125) y añadirla por paso es un cambio de modelo.
- **P7. «Añadir ingrediente» / «Añadir herramienta» al final de la lista** (tablero) frente a «añadir
  después de» en cada línea con la fila en blanco de arranque (hoy, QC-147 y QC-194). *Por defecto:* se
  conserva la mecánica de hoy y se restila; no se añade el botón del final.
- **P8. Textos entre corchetes del tablero:** «[Datos de la receta]», «[Herramienta]», «[Añadir
  herramienta]», «[Receta actualizada.]», «[Borrar la receta]», «[Original]», «[Estado]», «[Devolver]»,
  «[No se quitó nada de la original.]», «[La fórmula ya existe]», «[Fórmula importada]», «[Se crea]»,
  «[N]», «[Ninguna receta coincide con la búsqueda.]», «[Texto del paso]», «[Elemento de la lista]» y
  «[Volver a la receta]». *Por defecto:* se quedan los textos de hoy; la tarjeta de datos va sin título
  visible; «Borrar receta» sigue siendo el título del borrado; el resumen se titula con el resultado de
  hoy; no se añade «Se crea» ni cabeceras de columna nuevas; **sí** se añade «Volver a la receta»,
  porque D2 pide el botón de vuelta y la pantalla de versión no tiene ninguno.
- **P9. Choque de nombre en diálogo** (tablero) frente al aviso en línea antes de confirmar (QC-159,
  decisión del 2026-09-25). *Por defecto:* aviso en línea con `Notice` (R41).
- **P10. Nombre del PDF bajo «Revisar fórmula».** *Por defecto:* fuera; la vista previa del módulo no lo
  devuelve.
- **P11. Títulos del formulario de versión.** El tablero titula las líneas «De la receta original»;
  hoy ese título es el de la sección heredada (imagen, descripción y pasos de la original, en edición).
  *Por defecto:* se quedan los títulos de hoy.
- **P12. Tono de «Por revisar».** Hoy es `info` (variante de `Badge`); D3 lo pone en ámbar. *Por
  defecto:* `waiting`, y se enmienda el aserto de QC-227 en `badges-estado.test.tsx` (`design.md > 10`).
- **P13. Umbral de las dos columnas del formulario.** El tablero reparte 560 px + 300 px + 20 px de
  hueco. *Por defecto:* 880 px de contenedor (a 1440 px se ven dos columnas; a 820 px, una).
- **P14. Icono en la cabecera de los diálogos** (borrar, propagar, choque). *Por defecto:* fuera; se
  amplía la deuda de QC-262 (P5 de esa ficha) a esta ruta.
- **P15. Separador del menú ⋯.** *Por defecto:* el contrato de QC-262 D7 (`separatorBefore`); si al
  empezar no está en `dev`, lo implementa esta ficha con ese mismo contrato y el test que QC-262 nombra.
