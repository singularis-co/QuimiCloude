# QC-266 — Rediseño de Proveedores y Clientes · requirements.md

> **Enmienda contra dev (2026-10-19).** El spec se aprobó el 2026-10-13 (P1–P15 por defecto) y se
> enmendó tras el merge de `origin/dev` en la rama (687 commits), que trajo QC-262, QC-263, QC-264,
> QC-244, QC-275/QC-280, QC-277, QC-278, QC-165, QC-166 y cambios directos de Inventario y Pedidos.
> Regla: en lo visual manda el tablero; en columnas, costos, datos y conducta, lo mergeado. Lista
> completa de cambios, con su cita, en `design.md > 12` (E1–E18). Requisitos tocados: R15, R19, R31,
> R38 (solo su verificación), R41. Requisito nuevo: R44 *(supuesto P16)*. P1 queda resuelta por `dev`.
> Preguntas nuevas P16–P17 (`## Preguntas abiertas > Preguntas de la enmienda 2026-10-19`). Lo que
> decían los requisitos tocados queda en `design.md > 12`.

## Alcance

Lleva al diseño del canvas (página 7) cuatro pantallas y sus modales: la **vitrina de proveedores**
(`/proveedores`), el **detalle del proveedor** (`/proveedores/<id>`), la **revisión del catálogo
importado** (`/proveedores/<id>/importar/<documentoId>`) y **Clientes** (`/clientes`). Fuente:
`docs/diseno/canvas/Proveedores*.dc.html`, `ProveedorDetalle*`, `ProveedorImportar*`, `Clientes*` y
`ModalesProveedores.dc.html` (`_trabajo/rediseno/canvas/` es la misma fuente sin versionar) y
`progress/rediseno.md`. **El diseño manda sobre lo visual**; el comportamiento (permisos, acciones,
campos enviados, paginación, carga perezosa, reglas de la revisión) es el de hoy salvo lo que dice cada
requisito.

Lo que pide la ficha:

1. «Ver ficha del proveedor» y «Volver» pasan a ser **botones** (D2).
2. Las tarjetas de producto de la vitrina llevan **hover**.
3. La revisión del catálogo usa **tonos unificados** (D3).
4. Se agregan los **toasts** que faltan, por ejemplo «Proveedor creado.» (D10).

Más lo que dibuja el tablero y aprobó D14: cabeceras con `PageHeader`, menú ⋯ con separador y, con
contenedor de 760 px o menos, tablas en tarjetas con «Acciones» que abre el menú centrado (D2).

### Lo que NO entra

- **El rediseño del diálogo «Subir PDFs»** (`components/shared/document-upload/`): lo hace QC-264
  (su P1, aprobado). Aquí solo se coloca el disparador en la cabecera del detalle (R19).
- **La presentación bajo cada producto de la vitrina** («Saco 25 kg» en el tablero): la lectura de la
  vitrina no la trae y añadirla es trabajo de módulo (P2).
- **El nombre del PDF** en la cabecera de la revisión y en el selector de recortes: la vista previa no
  lo trae (P10), igual que QC-264 P10.
- **El contador «[Filas incluidas]»** y la línea tachada «[Costo actual]» de la revisión: van entre
  corchetes en el tablero, no existen hoy (P9).
- **Animaciones de entrada** (escalonada, productos que entran desde la derecha, la fila editada que
  parpadea): P14. Sí entran el hover de las tarjetas, la opacidad de la fila excluida y el giro de
  «Confirmando…».
- **Teléfono con código de país** del cliente (QC-236) y **WhatsApp con clientes** (QC-239): fichas
  propias, `pending`. No se adelanta nada. *Enmienda E10:* el **menú de Clientes con Contactos**
  (QC-244) ya está en `dev`; la pantalla `/clientes/contactos` que dejó no entra en esta ficha y no se
  toca.
- Cabecera de la zona privada, menú lateral e iconos: ya los dejó QC-257.

## Decisiones cerradas (no reabrir)

La ficha llegó sin `/afinar-feature`. Estas filas son decisiones del humano ya tomadas en
`progress/rediseno.md` (2026-10-10), en la descripción de la ficha o al aprobar specs anteriores; no
las abre este spec.

| # | Decisión | Quién y cuándo | Enmienda a | Cubierta por |
| --- | --- | --- | --- | --- |
| Ficha 1 / D2 | Acciones de fila siempre en el menú ⋯; en teléfono la tabla pasa a tarjetas y «Acciones» abre el menú centrado. «Ver ficha», «Volver…» nunca son enlaces de texto: son botones (`b-back` con flecha) | humano, 2026-10-10 (D2) y descripción de QC-266 | QC-140 (enlace del nombre del proveedor y «Ver ficha del proveedor» en la fila vacía) | R3, R4, R8, R11, R14, R15, R17, R20, R26, R30, R31, R43 |
| Ficha 2 | Las tarjetas de producto de la vitrina llevan hover | descripción de QC-266 | — | R6 |
| Ficha 3 / D3 | Tonos por significado con un único `StatusBadge` y un único mapa por dominio; la revisión del catálogo usa tonos unificados | humano, 2026-10-10 (D3) y descripción de QC-266 | — | R21, R22, R43 |
| Ficha 4 / D10 | Agregar los toasts que faltan (p. ej. «Proveedor creado.») | humano, 2026-10-10 (D10) y descripción de QC-266 | — | R36, R37 |
| D7 | Tallas de botón: sm 32 · default 36 · touch 44 · xl 52 | humano, 2026-10-10 (D7) | — | R1, R4, R12, R21, R24, R25, R34 |
| D14 | Lo demás del canvas queda aprobado; cada pantalla en escritorio, tablet y teléfono | humano, 2026-10-10 (D14) | — | R1, R2, R5, R9, R10, R12, R18, R20, R24, R27, R28, R33, R34, R42, R44 (enmienda E7) |
| QC-262 D7 / R14 | El menú ⋯ separa grupos con `separatorBefore` por ítem de `RowActionsMenu`, sin cambiar el árbol de quien no lo pide | humano, 2026-10-13 (aprobación de QC-262) | — | R14, R30, R38 |
| QC-264 P1 | El restilado de la subida compartida de PDF lo hace QC-264; el detalle de proveedor lo hereda | humano, 2026-10-13 (aprobación de QC-264) | — | R19 |
| QC-140 R18, R48 | `react-intersection-observer` solo en `showcase-load-trigger.tsx`; nada de la vitrina se descubre solo con `:hover` | humano, 2026-09-24 (aprobación de QC-140) | — | R6, R9 |
| QC-261 P5 / QC-262 P2 | En tablet las listas salen en tarjetas por el umbral de `DataTable` (contenedor ≤ 760 px) | humano, 2026-10-12 / 2026-10-13 | — | R15, R31 (P8) |
| QC-232 R5 (D48) | `editCustomerLabel` y `deleteCustomerLabel` siguen exportadas aunque no tengan consumidor | humano, 2026-10-09 | — | R41 |

## Requisitos (EARS)

Los requisitos marcados *(supuesto Pn)* están escritos con la opción por defecto de la pregunta
abierta `Pn`; si el humano elige otra, se reescriben antes de implementar.

### Vitrina de proveedores (`/proveedores`)

- **R1.** La pantalla `/proveedores` DEBE pintarse dentro de `PageShell` con `PageHeader`: el título
  «Proveedores» como único `h1` (`data-testid="proveedores-title"`) y, como acción de la cabecera,
  «Nuevo proveedor» (primaria, con icono «+», de 44 px de alto, `data-testid="supplier-create-open"`),
  que abre el panel de alta de hoy.
- **R2.** La pantalla DEBE pintar una barra `role="toolbar"` llamada «Filtros de proveedores» con dos
  campos de búsqueda de 44 px y letra de 16 px, con icono de lupa y nombre accesible «Producto» y
  «Proveedor», y el botón «Limpiar filtros» con icono; el rebote, la dirección y el vaciado inmediato
  al limpiar DEBEN ser los de hoy. MIENTRAS el contenedor mide 760 px o menos, los campos DEBEN
  apilarse a todo el ancho. *(supuesto P15)*
- **R3.** El sistema DEBE pintar cada proveedor como una tarjeta (`article` nombrada por su título) con
  su nombre como `h2`, la cuenta de productos cargados y el botón «Ver ficha del proveedor» con flecha
  (`data-testid="supplier-detail-link"`) que lleva a su detalle; el nombre del proveedor NO DEBE ser un
  enlace. *(supuesto P3)*
- **R4.** MIENTRAS el contenedor de la vitrina mide 760 px o menos, cada tarjeta de proveedor DEBE
  pintar el nombre arriba y «Ver ficha del proveedor» debajo, a todo el ancho y con 44 px de alto.
- **R5.** Cada tarjeta de proveedor con productos DEBE pintar una tira horizontal de tarjetas de
  producto (imagen y nombre) que se desplaza con scroll y encaje (`scroll-snap`), con el dedo y con el
  teclado, como hoy.
- **R6.** DONDE el dispositivo admite puntero con hover, CUANDO el puntero pasa sobre una tarjeta de
  producto, el sistema DEBE marcar su borde y darle sombra; la tarjeta NO DEBE esconder ni revelar
  ningún dato o control según el hover.
- **R7.** MIENTRAS una fila tiene más productos por cargar, el sistema DEBE pintar al final de la tira
  el botón «Cargar más» con icono, de 44 px, con nombre accesible «Cargar más productos de <nombre>» y
  ese mismo texto como tooltip; la carga, el fallo («No se pudieron cargar más productos.» con
  «Reintentar») y sus `data-testid` DEBEN ser los de hoy.
- **R8.** SI un proveedor no tiene productos, ENTONCES su tarjeta DEBE pintar un panel con icono y
  «Sin productos todavía.» (`data-testid="supplier-showcase-row-empty"`) sin ningún enlace propio.
- **R9.** MIENTRAS la lista de proveedores tiene más tandas y no ha fallado, el sistema DEBE mantener
  la carga perezosa al llegar al final y además pintar un botón visible «Cargar más»; MIENTRAS carga
  una tanda, DEBE pintar una tarjeta esqueleto con `aria-busy` y nombre «Cargando más proveedores»; SI
  la tanda falla, ENTONCES DEBE pintar una caja `role="alert"` con icono, «No se pudieron cargar más
  proveedores.» y «Reintentar» (`data-testid="supplier-showcase-list-retry"`). *(supuesto P4)*
- **R10.** SI no hay proveedores, ENTONCES el sistema DEBE pintar el vacío con icono, «Todavía no hay
  proveedores dados de alta.» y «Nuevo proveedor»; SI hay filtros y nada coincide, ENTONCES DEBE pintar
  el vacío con icono, «Ningún proveedor coincide con la búsqueda o el filtro.» y «Limpiar filtros»
  como botón; los dos con sus `data-testid` de hoy.

### Detalle del proveedor (`/proveedores/<id>`)

- **R11.** El detalle DEBE pintar, encima de la cabecera, «Volver a proveedores» como botón con flecha
  hacia atrás que lleva a la lista de proveedores.
- **R12.** El detalle DEBE pintar con `PageHeader` el nombre del proveedor como único `h1`
  (`supplier-detail-name`), debajo «Teléfono» y «Correo electrónico» con su icono y su valor
  (`supplier-detail-phone`, `supplier-detail-email`, la marca de vacío si falta) y, como acciones y en
  este orden: «Editar» (contorno, lápiz, `supplier-edit-open`), «Dar de baja» (contorno, en color de
  peligro, nombre accesible «Dar de baja <nombre>», `supplier-delete-open`), «Subir PDFs» y «Nueva
  línea» (primaria, `catalog-line-create-open`); cada acción DEBE abrir lo de hoy. MIENTRAS el
  contenedor mide 760 px o menos, el contacto DEBE apilarse y las acciones repartirse a todo el ancho
  con 44 px de alto.
- **R13.** SI el catálogo del proveedor está vacío, ENTONCES el sistema DEBE pintar el vacío con su
  mensaje de hoy y sin un segundo «Nueva línea». *(supuesto P5)*
- **R14.** El menú ⋯ de cada línea del catálogo DEBE ofrecer «Editar», un separador y «Dar de baja»
  (destructivo), con el disparador «Acciones de <nombre>» y los `data-testid` de hoy
  (`catalog-line-row-actions`, `catalog-line-edit-open`, `catalog-line-delete-open`).
- **R15.** MIENTRAS el contenedor del catálogo mide 760 px o menos, el sistema DEBE pintar cada línea
  como tarjeta con imagen, costo, nombre, presentación, unidad, mínimo de compra, tiempo de entrega,
  material, medidas y fecha de actualización, y el botón «Acciones» de 44 px que abre el menú centrado
  con el nombre de la línea como título e ítems de 48 px. El mínimo de compra, el tiempo de entrega y
  la fecha de actualización DEBEN llevar en la tarjeta su rótulo («Mínimo de compra», «Tiempo de
  entrega», «Actualizado»), que en la tabla NO DEBE verse. *(supuestos P8, P17)*
- **R16.** CUANDO se elige «Editar» o «Dar de baja» en el menú de una línea (fila o tarjeta), el
  sistema DEBE abrir el panel de edición o la confirmación de baja de esa línea, con sus campos,
  textos, envío y errores de hoy; NO DEBE haber más de un panel o diálogo de línea abierto a la vez.
- **R17.** SI el proveedor no existe, ENTONCES el detalle DEBE pintar una caja `role="alert"` con icono,
  «Este proveedor no existe o fue dado de baja.» y «Volver a la lista de proveedores» como botón con
  flecha, con los `data-testid` de hoy (`supplier-not-found`, `supplier-not-found-message`,
  `supplier-not-found-link`).
- **R18.** CUANDO se abre «Dar de baja el proveedor», el diálogo DEBE pintar el aviso «Sus líneas de
  catálogo se dan de baja con él.» como `Notice` en tono `warning`
  (`data-testid="delete-supplier-cascade"`), con el título, la descripción, «Cancelar» y «Dar de baja»
  de hoy.
- **R19.** DONDE la sesión puede subir documentos y la empresa tiene proveedor IA conectado, el
  disparador «Subir PDFs» de la cabecera DEBE ser el de la pieza compartida de subida con la
  estrategia de catálogo y la revisión de este proveedor; DONDE puede subir y la empresa no tiene
  proveedor IA, DEBE pintarse deshabilitado dentro del globo «Inscribir proveedor» de hoy; SI la
  sesión no puede subir, ENTONCES NO DEBE pintarse. En los dos primeros casos DEBE ocupar el tercer
  lugar de las acciones del R12. Esta ficha NO DEBE modificar ningún archivo de
  `components/shared/document-upload/` ni `components/shared/ai-provider-required-tooltip.tsx`.

### Revisión del catálogo importado (`/proveedores/<id>/importar/<documentoId>`)

- **R20.** La revisión DEBE pintar, encima de la cabecera, «Volver al detalle del proveedor» como botón
  con flecha hacia atrás, y con `PageHeader` una miga con el nombre del proveedor (enlace a su detalle)
  y «Revisar importación», el título «Revisar importación de catálogo» como único `h1`
  (`catalog-import-title`) y el subtítulo «<N> filas leídas». *(supuesto P10)*
- **R21.** El sistema DEBE pintar cada fila leída como tarjeta con, en su cabecera, la casilla de 44 px
  con nombre accesible «Incluir fila <N>» (`catalog-import-row-included-<i>`), el título «Fila <N>», el
  estado de la fila con `StatusBadge` (`catalog-import-row-kind-<i>` con `data-kind`), la imagen y los
  botones «Elige una imagen del archivo» y «Quitar»; y debajo los campos de hoy en una rejilla que pasa
  a una columna con contenedor estrecho. *(supuesto P11)*
- **R22.** El estado de una fila DEBE salir de un único mapa de tonos por clase: «Nueva» en `success`,
  «Cambia de costo» en `waiting`, «Sin cambios» en `neutral`, «Incompleta» en `danger` y «Duplicada» en
  `waiting`, con las etiquetas de hoy. *(supuesto P12)*
- **R23.** MIENTRAS una fila está excluida, su tarjeta DEBE pintarse al 60 % de opacidad y sus controles
  DEBEN seguir operables, de modo que volver a marcar la casilla la incluye.
- **R24.** SI alguna fila incluida necesita una presentación nueva, ENTONCES el sistema DEBE pintar el
  bloque «Unidades de presentaciones nuevas» como tarjeta con su `h2` y un selector por presentación
  con «Elige una unidad» y al menos 44 px de alto; el contenido y las reglas DEBEN ser los de hoy.
- **R25.** La revisión DEBE pintar «Confirmar» (44 px, `catalog-import-confirm`) en una barra pegada al
  borde inferior que sigue visible al desplazar; MIENTRAS confirma, el botón DEBE decir «Confirmando…»
  con el giro de carga y `aria-busy`; los motivos que bloquean y el envío DEBEN ser los de hoy.
- **R26.** CUANDO la confirmación termina bien, el sistema DEBE pintar el resumen `role="status"` con el
  icono de éxito, «La importación se guardó correctamente.», las cuatro cifras de hoy (en una columna
  con contenedor de 760 px o menos) y «Volver al detalle del proveedor» como botón con flecha
  (`catalog-import-summary-back-link`).
- **R27.** CUANDO se pulsa «Elige una imagen del archivo», el sistema DEBE abrir el diálogo «Elige una
  imagen del archivo» con el subtítulo «Fila <N>», un botón de al menos 44 px por recorte con nombre
  accesible «Recorte del archivo <n>», el elegido marcado y «Cancelar»; elegir uno DEBE asignarlo a la
  fila y cerrar, como hoy.

### Clientes (`/clientes`)

- **R28.** La pantalla `/clientes` DEBE pintarse dentro de `PageShell` con `PageHeader`: «Clientes» como
  único `h1` (`CUSTOMERS_TITLE_TESTID`) y, DONDE la sesión tiene `clientes.modificar`, «Nuevo cliente»
  (primaria, «+», 44 px, `customer-create-open`) como acción de la cabecera y no en la barra de la
  tabla; SI no lo tiene, ENTONCES NO DEBE pintarse.
- **R29.** La tabla de clientes DEBE conservar el buscador «Buscar clientes», las columnas, el orden por
  Apellidos, la paginación y los estados de hoy (cargando, error, vacío, sin coincidencias, página que
  se quedó atrás).
- **R30.** DONDE la sesión tiene `clientes.modificar`, el menú ⋯ de cada cliente DEBE ofrecer «Editar»,
  un separador y «Eliminar» (destructivo), con el disparador «Acciones de <nombres> <apellidos>» y los
  `data-testid` de hoy; SI no lo tiene, ENTONCES ni la fila ni la tarjeta DEBEN pintar menú ni
  «Acciones».
- **R31.** MIENTRAS el contenedor de la lista mide 760 px o menos, el sistema DEBE pintar cada cliente
  como tarjeta con apellidos, nombres, ciudad, teléfono, correo, dirección y fecha de alta y, DONDE hay
  permiso, «Acciones» de 44 px que abre el menú centrado con el nombre completo como título. La fecha
  de alta DEBE llevar en la tarjeta el rótulo «Fecha de alta», que en la tabla NO DEBE verse.
  *(supuestos P7, P8, P17)*
- **R32.** CUANDO se elige «Editar» o «Eliminar» en el menú de un cliente (fila o tarjeta), el sistema
  DEBE abrir el panel «Editar cliente» o «Eliminar el cliente» de ese cliente con sus campos, textos,
  envío y errores de hoy; NO DEBE haber más de un panel o diálogo de cliente abierto a la vez.
- **R33.** SI no hay ningún cliente, ENTONCES el vacío DEBE pintar icono, «Todavía no hay clientes
  registrados.» y, DONDE hay permiso, «Nuevo cliente». *(supuesto P6)*

### Modales y paneles

- **R34.** CUANDO se abre en una ventana de 390 × 844 cualquier diálogo de la ficha («Dar de baja el
  proveedor», «Dar de baja la línea», «Eliminar el cliente», «Elige una imagen del archivo», el menú
  centrado), el diálogo DEBE quedar entero y centrado en la pantalla visible con botones de al menos
  44 px; y cualquier panel («Nuevo/Editar proveedor», «Nueva/Editar línea de catálogo»,
  «Nuevo/Editar cliente») DEBE ocupar todo el ancho, con sus campos en una columna y su pie visible.
- **R35.** Los paneles y diálogos de la ficha DEBEN conservar sus títulos, descripciones, etiquetas,
  ayudas, errores y botones de hoy. *(supuesto P9)*
- **R44.** CUANDO se abre «Dar de baja el proveedor», «Dar de baja la línea» o «Eliminar el cliente»,
  el diálogo DEBE pintar delante del título el icono decorativo en tono de peligro (oculto a lectores
  de pantalla): el círculo tachado en las dos bajas y la papelera en «Eliminar el cliente»; los
  textos, botones y envío DEBEN ser los del R35. *(supuesto P16)*

### Avisos emergentes (D10)

- **R36.** CUANDO termina bien crear o editar un proveedor, darlo de baja, crear, editar o dar de baja
  una línea de catálogo, o crear, editar o eliminar un cliente, el sistema DEBE lanzar un único aviso
  emergente de éxito con su texto: «Proveedor creado.», «Proveedor actualizado.», «Proveedor dado de
  baja.», «Línea de catálogo creada.», «Línea de catálogo actualizada.», «Línea de catálogo dada de
  baja.», «Cliente creado.», «Cliente actualizado.» o «Cliente eliminado.»; SI la operación falla,
  ENTONCES NO DEBE lanzar ninguno.
- **R37.** CUANDO la confirmación de una importación termina bien, el sistema DEBE pintar el resumen del
  R26 y NO DEBE lanzar aviso emergente. *(supuesto P13)*

### Piezas compartidas

- **R38.** DONDE un ítem de `RowActionsMenu` declara separador delante, el menú DEBE pintar una línea
  divisoria (`role="separator"`) antes de ese ítem, en el desplegable y en el diálogo centrado, nunca
  delante del primer ítem que se pinta; sin la declaración, el árbol DEBE ser el de hoy (contrato de
  QC-262 R14). *Enmienda E3:* el contrato ya está en `dev`; esta ficha solo lo usa y lo verifica, no
  lo implementa (P1 resuelta).
- **R39.** El disparador «Editar» de `SupplierSheet` en modo edición DEBE pintar el lápiz y el texto
  «Editar» en variante contorno; el disparador de alta DEBE seguir igual.
- **R40.** CUANDO una pieza compartida gana un punto de extensión o cambia su aspecto en esta ficha,
  `components/shared/CATALOGO.md` DEBE tener su fila al día en el mismo commit, con su tablero.

### Sin regresión y guardias

- **R41.** Crear, editar y dar de baja proveedor y línea, subir PDFs, previsualizar y confirmar la
  importación y crear, editar y eliminar cliente DEBEN enviar los mismos campos a las mismas Server
  Actions que hoy, con los mismos permisos de página, los mismos cortes por añadido de empresa
  (`proveedores` en las tres pantallas de proveedores, por el permiso efectivo; `lectura_pdf` además
  en la revisión) y las mismas direcciones; los exports de los barrels de las cuatro rutas DEBEN
  seguir existiendo.
- **R42.** CUANDO se abre cada una de las cuatro pantallas en ventanas de 1440 × 900 y de 390 × 844, la
  página NO DEBE desbordar en horizontal (salvo la caja de scroll propia de la tabla y de la tira de
  productos), y la cabecera, la barra y la primera tarjeta o fila DEBEN quedar dentro del ancho visible.
- **R43.** El código de producción de `app/(private)/proveedores/` y `app/(private)/clientes/` NO DEBE
  pintar enlaces de texto para navegar (todo enlace que la ruta pinta va con forma de botón:
  `ArrowLink` o `buttonVariants`; la miga la pinta `PageHeader` y no cuenta), NO DEBE importar `@/components/ui/badge` y NO DEBE declarar un segundo mapa de
  tonos de la clase de fila de la importación.

## Preguntas abiertas

Cada una lleva su opción por defecto, con la que están escritos los requisitos.

- **P1. Orden con QC-262 y QC-264.** El separador del menú (R38) lo define QC-262 y el diálogo de subida
  lo restila QC-264; las dos están aprobadas y sin implementar. *Por defecto:* esta ficha se implementa
  **después** de que QC-262 y QC-264 lleguen a `dev`; entonces R38 solo se verifica (no se reescribe) y
  R19 hereda el diálogo restilado. Si el humano prefiere no esperar a QC-262, la tanda 1 implementa
  `separatorBefore` con el MISMO contrato, el MISMO archivo de test
  (`row-actions-menu-separator.test.tsx`) y la misma fila del catálogo, y QC-262 lo reutiliza al
  rebasar. A QC-264 no se le adelanta nada en ningún caso.
  *Resuelta por `dev` (enmienda E3, E18):* QC-262 y QC-264 están mergeadas y la rama las tiene;
  `separatorBefore` y el diálogo de subida restilado ya existen.
- **P2. Presentación bajo cada producto de la vitrina.** El tablero la pinta; `ShowcaseLine` no la
  trae. *Por defecto:* fuera (trabajo de módulo en `proveedores`); se anota como deuda.
- **P3. Cuenta de productos de la tarjeta.** El tablero pinta «N productos» o «N+ productos». *Por
  defecto:* se deriva de lo ya cargado: «1 producto», «N productos», con «+» mientras la fila tiene más
  por cargar; sin cuenta si no hay productos. No cuenta el total real del catálogo.
- **P4. «Cargar más» visible en la lista general.** La ficha del tablero lo pide como alternativa
  accesible al centinela; hoy no existe. *Por defecto:* se añade, junto al centinela (que no cambia).
- **P5. «Nueva línea» en el catálogo vacío.** Hoy está encima de la tabla y dentro del vacío; el
  tablero la lleva a la cabecera. *Por defecto:* solo en la cabecera; el vacío conserva su mensaje y no
  repite el botón (evita dos `catalog-line-create-open` a la vez).
- **P6. «Nuevo cliente» en el vacío.** El tablero lo pinta en la cabecera y en el vacío. *Por defecto:*
  en los dos, como la vitrina de proveedores hoy; con la lista vacía hay dos `customer-create-open`.
- **P7. Tarjeta del cliente.** `DataTable` pinta la tarjeta por columnas y su ranura principal va en
  monoespaciada; no hay columna de «nombre completo». *Por defecto:* principal Apellidos, a la derecha
  la ciudad, título Nombres, datos Teléfono, Correo y Dirección, pie Fecha de alta. Alternativa:
  extender `DataTableCardLayout` (pieza compartida con QC-262/263/264 en vuelo).
- **P8. Tablet.** Los tableros de tablet dicen «la tabla se desplaza en horizontal»; con la barra
  lateral en icono, el contenedor a 820 px cae bajo el umbral de 760 px. *Por defecto:* tarjetas por
  el umbral de `DataTable`, como QC-261 P5 y QC-262 P2.
- **P9. Textos entre corchetes del tablero.** «[Escribe un teléfono o un correo.]», «[Elige una
  presentación]», «[Costo actual]», «[Filas incluidas]», «[Proveedor creado.]», «[Proveedor
  actualizado.]». *Por defecto:* se quedan los textos de hoy (los dos toasts ya existen con ese texto);
  «Costo actual: X» y «Costo nuevo: Y» siguen como hoy y el contador de filas incluidas no entra.
- **P10. Cabecera de la revisión.** El tablero pinta el nombre del proveedor como miga y «<archivo> · N
  filas leídas». *Por defecto:* miga «<proveedor> › Revisar importación» (la miga marca el último paso
  como actual) y subtítulo «N filas leídas» sin el nombre del archivo; el selector de recortes dice
  «Fila N» sin archivo.
- **P11. Cabecera de cada fila de la revisión.** Hoy: «Fila N», la clase en texto, la casilla con la
  etiqueta visible «Incluir» y el selector de recortes con el texto «Cambiar». El tablero: casilla sola
  con nombre «Incluir fila N», «Fila N», `StatusBadge` y «Elige una imagen del archivo». *Por defecto:*
  el tablero (los textos no van entre corchetes); «Quitar» se conserva.
- **P12. Tono de «Duplicada».** La ficha del tablero dice «apagado»; D3 y los datos del propio tablero
  dicen ámbar («Duplicado» en `waiting`). *Por defecto:* D3, `waiting`.
- **P13. Toasts que faltan (D10).** Los nueve del R36 ya existen hoy con el texto del tablero, pero solo
  uno tiene test. *Por defecto:* no se añade ninguno nuevo: un test fija los nueve; confirmar la
  importación sigue sin toast porque pinta su resumen.
- **P14. Animaciones del tablero.** *Por defecto:* entran el hover de la tarjeta de producto, la fila
  excluida al 60 % y el giro de «Confirmando…»; la entrada escalonada, los productos que entran desde
  la derecha y el parpadeo de la fila editada quedan fuera como deuda.
- **P15. Etiquetas de los filtros de la vitrina.** Hoy hay etiqueta visible encima de cada campo; el
  tablero pinta solo la lupa y el texto de ayuda. *Por defecto:* la etiqueta queda solo para lectores
  de pantalla (`sr-only`) y el nombre accesible no cambia.

### Preguntas de la enmienda 2026-10-19

- **P16. Icono de peligro en las tres confirmaciones de baja** (`design.md > 12`, E7). El spec lo dejó
  fuera porque `ConfirmDialog` no lo admitía; hoy tiene la prop `icon` (QC-166) y QC-264 la usa en sus
  borrados (su R50). El tablero `ModalesProveedores.dc.html` lo dibuja (`dlg-ic danger`) en «Dar de
  baja el proveedor», «Dar de baja la línea» y «Eliminar el cliente». *Por defecto:* entra en los
  tres (R44), con el círculo tachado en las dos bajas y la papelera en el cliente, como el tablero;
  `ConfirmDialog` no se toca. Si el humano dice que no, R44 sale y D56 se amplía a estas pantallas.
- **P17. Rótulos de las cifras sueltas en las tarjetas** (`design.md > 12`, E8). Con contenedor
  estrecho, la tarjeta pinta el mínimo de compra, el tiempo de entrega y las fechas sin su encabezado
  de columna («10», «15», «2026-10-01»), y el tablero no dice cómo se leen. `dev` trae
  `withCardFieldLabel` (`components/shared/card-field-label.tsx`), que Inventario y Fórmulas usan para
  esto. *Por defecto:* rótulo con el texto del encabezado de su columna en «Mínimo de compra»,
  «Tiempo de entrega» y «Actualizado» del catálogo y en «Fecha de alta» de Clientes (R15, R31); los
  datos que se leen solos (presentación, unidad, material, medidas, teléfono, correo, dirección) van
  sin rótulo. Alternativa: sin rótulos, como el spec aprobado.
