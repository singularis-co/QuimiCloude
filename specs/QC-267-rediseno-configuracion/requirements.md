# QC-267 — Rediseño de Configuración · requirements.md

## Alcance

Lleva al diseño del canvas (página 8) las pantallas de Configuración y sus modales: **Usuarios**
(`/configuracion/usuarios`, pestañas Personas y Grupos), **Presentaciones**
(`/configuracion/presentaciones`), **Unidades** (`/configuracion/unidades`) y la **pantalla
provisional de Integraciones** (`/integraciones/proveedor-ia` e `/integraciones/inventarios`, las
dos que pintan `IntegrationPlaceholder`). Fuente: `docs/diseno/canvas/Usuarios*.dc.html`,
`Presentaciones*`, `Unidades*`, `Integraciones*` y `ModalesConfiguracion.dc.html`
(`_trabajo/rediseno/canvas/` es la misma fuente sin versionar) y `progress/rediseno.md`. **El diseño
manda sobre lo visual**; el comportamiento (permisos, acciones, campos enviados, paginación, búsqueda,
filtros, reglas de cada formulario) es el de hoy salvo lo que dice cada requisito.

Lo que pide la ficha:

1. Usuarios con sus pestañas Personas y Grupos, Presentaciones, Unidades, la pantalla provisional de
   Integraciones y sus modales, al diseño del canvas.
2. Los **toasts que faltan**, como «Usuario actualizado.» (D10).
3. La tarjeta de WhatsApp del tablero de Integraciones es **solo referencia para QC-237** (D13): no
   entra.

Más lo que dibuja el tablero y aprobó D14: cabeceras con `PageHeader`, pestañas que navegan, estado
de cuenta con `StatusBadge`, avatares en las filas de personas, menú ⋯ con separador y, con contenedor
de 760 px o menos, tablas en tarjetas con «Acciones» que abre el menú centrado (D2).

### Lo que NO entra

- **La pantalla de WhatsApp** (`/integraciones/whatsapp`) y todo lo que dejó QC-237 en
  `app/(private)/integraciones/whatsapp/` y `lib/modules/integraciones/`: es de QC-237 (D13). La
  tarjeta de conexión del tablero no se construye.
- **«Cerrar todas las sesiones de X» en el menú de la fila** (tablero `Usuarios.dc.html`): QC-101 R8
  lo prohibió; sigue solo en el panel de edición (P2).
- **El conteo «N miembros»** en la tarjeta del grupo: es QC-100 (`pending`) (P3).
- **El rol debajo de cada miembro** en el panel del grupo: `WorkGroupMemberRow` no lo trae y añadirlo
  es trabajo de módulo (P4).
- **Icono en la cabecera de los diálogos** (`dlg-ic` del tablero): `ConfirmDialog` no lo tiene, igual
  que QC-262 P5 y QC-264 (P13).
- **Insignias de estado dentro del selector** del diálogo «Cambiar el estado de la cuenta»:
  `SelectField` solo admite opciones de texto, igual que QC-262 P10 (P12).
- **«Factor» deshabilitado mientras «No deriva de ninguna»** y la coma decimal de la equivalencia
  (P9, P10).
- **Animaciones de entrada escalonada y fundidos de la tabla** al cambiar de pestaña o al eliminar
  (P16). La entrada de la página ya la pone el layout privado.
- Textos y atributos que pone la tabla compartida (paginación, `role="toolbar"` de la barra), como
  QC-262 P11 (P11).
- QC-98 (aviso y reenvío del enlace en Usuarios), QC-100, QC-126 y QC-206 (`pending`): no se adelanta
  nada de ellas.
- Cabecera de la zona privada, menú lateral e iconos: ya los dejó QC-257.

## Decisiones cerradas (no reabrir)

La ficha llegó sin `/afinar-feature`. Estas filas son decisiones del humano ya tomadas en
`progress/rediseno.md` (2026-10-10), en la descripción de la ficha o al aprobar specs anteriores; no
las abre este spec.

| # | Decisión | Quién y cuándo | Enmienda a | Cubierta por |
| --- | --- | --- | --- | --- |
| D2 | Acciones de fila siempre en el menú ⋯; en teléfono la tabla pasa a tarjetas y «Acciones» abre el menú centrado en la pantalla visible | humano, 2026-10-10 (`progress/rediseno.md` D2) | — | R6, R7, R8, R10, R11, R12, R15, R16, R17, R20, R21, R22 |
| D3 | Tonos por significado con un único `StatusBadge` y un único mapa por dominio (Activo `success`, Pendiente `neutral`, Inactivo `muted`, Bloqueado `danger`) | humano, 2026-10-10 (D3) | QC-227 (tono del estado de cuenta en `badges-estado`) | R5, R38 |
| D7 | Tallas de botón: sm 32 · default 36 · touch 44 · xl 52 | humano, 2026-10-10 (D7) | — | R1, R7, R13, R18, R30 |
| D10 / ficha 2 | Agregar los toasts que faltan (p. ej. «Usuario actualizado.») | humano, 2026-10-10 (D10) y descripción de QC-267 | — | R32 |
| D13 / ficha 3 | La tarjeta de WhatsApp del tablero de Integraciones es solo referencia para QC-237; no se construye aquí | humano, 2026-10-10 (D13) y descripción de QC-267 | — | R24 |
| D14 | Lo demás del canvas queda aprobado; cada pantalla en escritorio, tablet y teléfono | humano, 2026-10-10 (D14) | — | R1, R2, R4, R9, R13, R14, R18, R19, R23, R26–R30, R37 |
| QC-262 D7 / R14 | El menú ⋯ separa grupos con `separatorBefore` por ítem de `RowActionsMenu`, sin cambiar el árbol de quien no lo pide | humano, 2026-10-13 (aprobación de QC-262) | — | R6, R10, R15, R20, R33 |
| QC-261 P5 / QC-262 P2 | En tablet las listas salen en tarjetas por el umbral de `DataTable` (contenedor ≤ 760 px) | humano, 2026-10-12 / 2026-10-13 | — | R7, R11, R16, R21 |
| QC-101 R8 | La fila de usuarios no gana acciones: el cierre de todas las sesiones de otra persona vive solo en el panel de edición | humano, 2026-09-13 (`specs/QC-101-cierre-de-sesiones-de-otro-desde-la-pantalla/requirements.md`) | — | R6 (P2) |
| QC-67 / menú | Los ítems del menú dicen solo el verbo; el nombre va en el nombre accesible del disparador | humano, 2026-10-04 (`user-row-actions.tsx`) | — | R6, R10, R15, R20 |
| QC-85 R3, R7 | La pestaña vigente sale de la dirección; el enlace de cada pestaña lleva solo `tab`; los parámetros de lista de cada pestaña son independientes | humano, aprobación de QC-85 (`specs/QC-85-pantalla-de-grupos-de-trabajo`) | — | R2, R3 |
| QC-85 / QC-100 | El conteo de miembros de un grupo es QC-100, no de la pantalla de grupos | humano, 2026-09-12 (acotación de QC-85) | — | R11 (P3) |
| Formulario de usuario | Fecha de nacimiento, correo y teléfono van en una fila desde `sm` | humano (`user-form.tsx:455`) | — | R31 (P8) |
| QC-222 R9–R11 | La página cascarón de una integración pinta el título del menú y el vacío acordado, sin formulario, campo, selector, botón ni enlace, y corta por `integraciones.modificar` en su primera línea | humano, aprobación de QC-222 (`specs/QC-222-menu-de-integraciones`, `tests/unit/integraciones-ui/integration-pages.test.tsx`) | — | R23, R25 |

## Requisitos (EARS)

Los requisitos marcados *(supuesto Pn)* están escritos con la opción por defecto de la pregunta
abierta `Pn`; si el humano elige otra, se reescriben antes de implementar.

### Usuarios — página y pestañas

- **R1.** La pantalla `/configuracion/usuarios` DEBE pintarse dentro de `PageShell` con `PageHeader`:
  «Usuarios» como único `h1` (`data-testid="usuarios-title"`) y, DONDE la sesión tiene
  `usuarios.modificar`, como acción de la cabecera «Nuevo usuario» en la pestaña Personas
  (`user-create-open`) o «Nuevo grupo» en la pestaña Grupos (`work-group-create-open`), primaria, con
  icono «+» y al menos 44 px de alto, que abre el panel de alta de hoy; SI no lo tiene, ENTONCES NO
  DEBE pintarse ninguna de las dos.
- **R2.** Las pestañas «Personas» y «Grupos» DEBEN pintarse con `UrlTabs`, cada una con su icono y
  como enlace real a la dirección de hoy de su pestaña (que lleva solo `tab`), con la vigente
  seleccionada, el nombre de la lista de hoy y los `data-testid` de hoy (`usuarios-tabs`,
  `usuarios-tab-personas`, `usuarios-tab-grupos`); MIENTRAS no caben en el ancho, DEBEN desplazarse en
  horizontal sin partirse en dos líneas.
- **R3.** CUANDO se abre una pestaña, el sistema DEBE pintar solo la sección de esa pestaña, con sus
  parámetros de lista independientes de los de la otra, como hoy.

### Usuarios — Personas

- **R4.** La tabla de personas DEBE pintar en la columna «Nombre» el avatar de la persona (sus
  iniciales con un color estable para su identificador) junto a su nombre, y conservar las columnas
  «Usuario» (en monoespaciada), «Correo», «Rol» y «Estado», el buscador, el filtro «Estado», el orden,
  la paginación y los estados de carga, error y vacío de hoy.
- **R5.** El estado de cuenta DEBE pintarse con `StatusBadge` desde un único mapa de tonos: «Activo»
  en `success`, «Pendiente» en `neutral`, «Inactivo» en `muted` y «Bloqueado» en `danger`, con las
  etiquetas de hoy, `data-testid="user-status"` y `data-status` con el valor almacenado.
- **R6.** DONDE la sesión tiene `usuarios.modificar`, el menú ⋯ de cada persona DEBE ofrecer, en este
  orden, «Editar», «Cambiar estado», un separador y «Eliminar» (destructivo), con el disparador
  «Acciones de <nombre>», los `data-testid` de hoy (`user-row-actions`, `user-action-edit`,
  `user-action-status`, `user-action-delete`) y `data-user-id` en el disparador de la fila; el menú NO
  DEBE ofrecer el cierre de sesiones; SI la sesión no tiene el permiso, ENTONCES ni la fila ni la
  tarjeta DEBEN pintar menú ni «Acciones». *(supuesto P2)*
- **R7.** MIENTRAS el contenedor de la lista mide 760 px o menos, el sistema DEBE pintar cada persona
  como tarjeta con el nombre de usuario y el estado arriba, el avatar y el nombre, el correo y el rol
  y, DONDE hay permiso, «Acciones» de 44 px que abre el menú centrado con el nombre de la persona como
  título e ítems de 48 px. *(supuesto P5)*
- **R8.** CUANDO se elige un ítem del menú de una persona (fila o tarjeta), el sistema DEBE abrir el
  panel «Editar usuario», el diálogo «Cambiar el estado de la cuenta» o el diálogo «Eliminar al
  usuario» de esa persona, con sus campos, textos, envío y errores de hoy; NO DEBE haber más de un
  panel o diálogo de persona abierto a la vez.

### Usuarios — Grupos

- **R9.** La tabla de grupos DEBE conservar las columnas «Nombre» y «Miembros» (hasta tres avatares y
  «+N» con el nombre accesible «Ver los N miembros restantes»), el buscador, el orden, la paginación y
  los estados de hoy.
- **R10.** DONDE la sesión tiene `usuarios.modificar`, el menú ⋯ de cada grupo DEBE ofrecer «Abrir»,
  un separador y «Eliminar» (destructivo), con el disparador «Acciones de <nombre>», los `data-testid`
  de hoy (`work-group-row-actions`, `work-group-action-edit`, `work-group-action-delete`) y
  `data-work-group-id` en el disparador de la fila; SI no lo tiene, ENTONCES ni la fila ni la tarjeta
  DEBEN pintar menú ni «Acciones».
- **R11.** MIENTRAS el contenedor de la lista mide 760 px o menos, el sistema DEBE pintar cada grupo
  como tarjeta con su nombre, sus avatares y, DONDE hay permiso, «Acciones» de 44 px que abre el menú
  centrado con el nombre del grupo como título; la tarjeta NO DEBE pintar un número de miembros.
  *(supuestos P3, P5)*
- **R12.** CUANDO se elige «Abrir» o «Eliminar» en el menú de un grupo (fila o tarjeta), el sistema
  DEBE abrir el panel «Editar grupo» o el diálogo «Eliminar el grupo» de ese grupo como hoy; NO DEBE
  haber más de un panel o diálogo de grupo abierto a la vez.

### Presentaciones (`/configuracion/presentaciones`)

- **R13.** La pantalla DEBE pintarse dentro de `PageShell` con `PageHeader`: «Presentaciones» como
  único `h1` (`presentaciones-title`) y «Nueva presentación» (`presentation-create-open`, primaria,
  «+», 44 px de alto) como acción de la cabecera; SI falla la lectura del catálogo de unidades,
  ENTONCES DEBE pintar solo el error de la lista, como hoy.
- **R14.** La tabla DEBE pintar «Nombre» y «Contenido» (alineado al final, en monoespaciada; «Sin
  contenido» atenuado), con un ancho máximo de 760 px, y conservar el buscador, el orden, la paginación
  y los estados de hoy. *(supuesto P6)*
- **R15.** El menú ⋯ de cada presentación DEBE ofrecer «Editar», un separador y «Eliminar»
  (destructivo), con el disparador «Acciones de <nombre>», los `data-testid` de hoy
  (`presentation-row-actions`, `presentation-action-edit`, `presentation-action-delete`) y
  `data-presentation-id` en el disparador de la fila.
- **R16.** MIENTRAS el contenedor de la lista mide 760 px o menos, el sistema DEBE pintar cada
  presentación como tarjeta con su nombre, su contenido y «Acciones» de 44 px que abre el menú centrado
  con el nombre como título. *(supuesto P5)*
- **R17.** CUANDO se elige un ítem del menú de una presentación (fila o tarjeta), el sistema DEBE
  abrir el panel «Editar presentación» o el diálogo «Eliminar la presentación» de esa presentación con
  sus campos, textos, envío y errores de hoy; la lista DEBE montar como mucho un panel de edición y un
  diálogo de borrado, no uno por fila.

### Unidades (`/configuracion/unidades`)

- **R18.** La pantalla DEBE pintarse dentro de `PageShell` con `PageHeader`: «Unidades» como único
  `h1` (`unidades-title`) y «Nueva unidad» (`unit-create-open`, primaria, «+», 44 px de alto) como
  acción de la cabecera; SI falla la lectura del catálogo, ENTONCES la cabecera DEBE pintarse igual,
  como hoy.
- **R19.** La tabla DEBE pintar «Nombre», «Símbolo» (en monoespaciada) y «Equivalencia» con el texto
  de hoy («1 g = 0.001 kg»), con la marca de vacío atenuada cuando falta el símbolo o la base, con un
  ancho máximo de 880 px, y conservar el buscador, el orden, la paginación y los estados de hoy.
  *(supuestos P6, P10)*
- **R20.** El menú ⋯ de cada unidad DEBE ofrecer «Editar», un separador y «Eliminar» (destructivo), con
  el disparador «Acciones de <nombre>», los `data-testid` de hoy (`unit-row-actions`,
  `unit-action-edit`, `unit-action-delete`) y `data-unit-id` en el disparador de la fila.
- **R21.** MIENTRAS el contenedor de la lista mide 760 px o menos, el sistema DEBE pintar cada unidad
  como tarjeta con su símbolo, su nombre, su equivalencia y «Acciones» de 44 px que abre el menú
  centrado con el nombre como título. *(supuesto P5)*
- **R22.** CUANDO se elige un ítem del menú de una unidad (fila o tarjeta), el sistema DEBE abrir el
  panel «Editar unidad» o el diálogo «Eliminar la unidad» de esa unidad con sus campos, textos, envío y
  errores de hoy; la lista DEBE montar como mucho un panel de edición y un diálogo de borrado, no uno
  por fila.

### Integraciones provisionales

- **R23.** CUANDO alguien con `integraciones.modificar` abre `/integraciones/proveedor-ia` o
  `/integraciones/inventarios`, el sistema DEBE pintar dentro de `PageShell` un `PageHeader` con la
  miga «Integraciones › <etiqueta>» y la etiqueta del menú como único `h1`
  (`data-testid="integration-title"`), y debajo un recuadro `role="status"` con un icono oculto a los
  lectores de pantalla y el texto exacto «Próximamente podrás configurar esta integración.»
  (`data-testid="integration-empty"`, cuyo texto es solo ese); la página NO DEBE pintar ningún
  formulario, campo, selector, botón ni enlace. *(supuesto P14)*
- **R24.** Esta ficha NO DEBE modificar ningún archivo de `app/(private)/integraciones/whatsapp/` ni de
  `lib/modules/integraciones/`, y la pantalla `/integraciones/whatsapp` DEBE pintarse igual que hoy.
- **R25.** Las dos páginas cascarón DEBEN conservar su `requirePagePermission('integraciones.modificar')`
  como primera sentencia, sus `metadata` y sus importaciones de hoy; el cambio vive solo en la pieza
  compartida de la ruta (`IntegrationPlaceholder`).

### Paneles y modales

- **R26.** MIENTRAS la ventana mide más de 760 px, los paneles de alta y edición de usuario y de grupo
  DEBEN medir 600 px de ancho y los de presentación y unidad 460 px (o el ancho visible, si es menor);
  MIENTRAS mide 760 px o menos, cualquier panel de la ficha DEBE ocupar todo el ancho, con sus campos
  en una columna y su pie visible. *(supuesto P7)*
- **R27.** MIENTRAS el panel de edición de un usuario carga la ficha, el sistema DEBE pintar el título
  «Editar usuario», la descripción «Cambia los datos de la persona.» y, en el cuerpo, una región
  `role="status"` con `aria-busy` (`user-sheet-loading`) con el giro de carga, el texto «Cargando los
  datos de la persona…» y el esqueleto de los campos.
- **R28.** En el panel de un grupo, el buscador de personas DEBE pintar cada candidata con su avatar,
  su nombre, su rol (oculto MIENTRAS el contenedor mide 760 px o menos) y el botón «Agregar»; CUANDO la
  persona ya está añadida, el botón DEBE decir «Agregado» con una marca, deshabilitado como hoy, sin
  cambiar de ancho.
- **R29.** En el panel «Editar grupo», cada miembro DEBE pintarse con su avatar, su nombre y «Quitar
  del grupo», y la paginación de miembros con su texto de hoy («Página X de Y · N en total»).
  *(supuesto P4)*
- **R30.** CUANDO se abre en una ventana de 390 × 844 cualquier diálogo de la ficha («Cambiar el estado
  de la cuenta», «¿Cerrar todas las sesiones de X?», «Eliminar al usuario», «Eliminar el grupo»,
  «Eliminar la presentación», «Eliminar la unidad», el menú centrado), el diálogo DEBE quedar entero y
  centrado en la pantalla visible con botones de al menos 44 px.
- **R31.** Los paneles y diálogos de la ficha DEBEN conservar sus títulos, descripciones, etiquetas,
  ayudas, opciones, disposición de campos desde `sm`, errores y botones de hoy, salvo lo que dicen
  R26–R29. *(supuestos P8, P9, P11, P12, P13)*

### Avisos emergentes (D10)

- **R32.** CUANDO termina bien una de estas operaciones, el sistema DEBE lanzar un único aviso
  emergente de éxito con su texto: crear usuario «Usuario creado.», editarlo «Usuario actualizado.»,
  cambiar su estado «Estado de la cuenta actualizado.», cerrar sus sesiones «Se cerraron las sesiones
  de <nombre>.», eliminarlo «Usuario eliminado.», crear grupo «Grupo creado.», editarlo «Grupo
  actualizado.», eliminarlo «Grupo eliminado.», añadir un miembro «Persona añadida al grupo.», quitarlo
  «Persona retirada del grupo.», crear, editar o eliminar una presentación «Presentación creada.»,
  «Presentación actualizada.», «Presentación eliminada.» y crear, editar o eliminar una unidad «Unidad
  creada.», «Unidad actualizada.», «Unidad eliminada.»; SI la operación falla, ENTONCES NO DEBE lanzar
  aviso de éxito. *(supuesto P15)*

### Piezas compartidas

- **R33.** DONDE un ítem de `RowActionsMenu` declara separador delante, el menú DEBE pintar una línea
  divisoria (`role="separator"`) antes de ese ítem, en el desplegable y en el diálogo centrado, nunca
  delante del primer ítem que se pinta; sin la declaración, el árbol DEBE ser el de hoy (contrato de
  QC-262 R14). *(supuesto P1)*
- **R34.** CUANDO un menú de fila se declara como datos para `DataTable`, el disparador de la fila de
  tabla DEBE poder llevar los atributos `data-*` de hoy (`data-user-id`, `data-work-group-id`,
  `data-presentation-id`, `data-unit-id`); sin ellos, el árbol de los consumidores de hoy NO DEBE
  cambiar.
- **R35.** CUANDO una pieza compartida gana un punto de extensión en esta ficha, `components/shared/CATALOGO.md`
  DEBE tener su fila al día en el mismo commit, con su tablero.

### Sin regresión y guardias

- **R36.** Crear, editar, eliminar y cambiar el estado de un usuario, cerrar sus sesiones, crear,
  editar y eliminar un grupo, añadir y quitar miembros, y crear, editar y eliminar presentaciones y
  unidades DEBEN enviar los mismos campos a las mismas Server Actions que hoy, con los mismos permisos
  de página y las mismas direcciones; los exports de los barrels de las rutas DEBEN seguir existiendo.
- **R37.** CUANDO se abre cada pantalla de la ficha (Personas, Grupos, Presentaciones, Unidades y las
  dos integraciones provisionales) en ventanas de 1440 × 900 y de 390 × 844, la página NO DEBE
  desbordar en horizontal, la cabecera y la primera fila o tarjeta DEBEN quedar dentro del ancho
  visible y, a 1440 × 900, cada lista DEBE pintarse como tabla y no como tarjetas.
- **R38.** El código de producción de `app/(private)/configuracion/` NO DEBE importar
  `@/components/ui/badge`, NO DEBE declarar un segundo mapa de tonos del estado de cuenta, y los
  componentes de fila de presentaciones y unidades NO DEBEN montar paneles ni diálogos.

## Preguntas abiertas

Cada una lleva su opción por defecto, con la que están escritos los requisitos.

- **P1. Orden con QC-262 (y QC-263/264/266).** El separador del menú (R33) lo define QC-262, aprobado
  y sin implementar; `triggerDataAttributes` en `RowActionsSpec` (R34) lo declaran QC-263, QC-264 y
  QC-266 «solo si falta». *Por defecto:* esta ficha se implementa **después** de que QC-262 llegue a
  `dev`; entonces R33 solo se verifica. Si el humano prefiere no esperar, la tanda 1 implementa
  `separatorBefore` con el MISMO contrato, el MISMO test (`row-actions-menu-separator.test.tsx`) y la
  misma fila del catálogo, y QC-262 lo reutiliza al rebasar. `triggerDataAttributes` lo añade quien
  llegue primero.
- **P2. Cierre de sesiones en el menú de la fila.** El tablero pone «Cerrar todas las sesiones de X»
  en el menú ⋯; QC-101 R8 (humano, 2026-09-13) lo dejó solo en el panel porque expulsa a alguien que
  puede estar trabajando. *Por defecto:* QC-101: el menú queda con tres ítems y el cierre sigue en el
  panel de edición.
- **P3. «N miembros» en la tarjeta del grupo.** Es el conteo de QC-100 («3 de 5», `pending`). *Por
  defecto:* la tarjeta pinta los avatares sin número.
- **P4. Rol bajo cada miembro del grupo.** `WorkGroupMemberRow` trae solo `id` y `displayName`. *Por
  defecto:* fuera (trabajo de módulo); el miembro se pinta con avatar y nombre. Se anota como deuda.
- **P5. Reparto de las tarjetas.** La ranura principal de `DataTableCardLayout` va en monoespaciada y
  semibold. *Por defecto:* Personas `primary` = usuario, `status` = estado, `title` = nombre, `meta` =
  correo y rol; Grupos `primary` = nombre, `meta` = miembros; Presentaciones `primary` = nombre,
  `status` = contenido; Unidades `primary` = símbolo, `title` = nombre, `meta` = equivalencia. El
  nombre del grupo y de la presentación sale en monoespaciada (mismo criterio que QC-266 P7).
  Alternativa: extender `DataTableCardLayout` (pieza que QC-262/263/264/266 también tocan).
- **P6. Ancho máximo de las tablas.** El tablero limita Presentaciones a 760 px y Unidades a 880 px, y
  las tarjetas salen con contenedor por debajo de 760 px. *Por defecto:* los dos anchos del tablero; la
  tanda 0 mide a 1440 px que Presentaciones sigue en tabla y, si no, el ancho sube a 800 px y se anota
  como desviación.
- **P7. Ancho de los paneles.** Hoy miden `sm:max-w-md` (448 px); el tablero pinta 600 px los de
  usuario y grupo y 460 px los de presentación y unidad. *Por defecto:* los del tablero.
- **P8. Disposición del formulario de usuario.** El tablero pinta «Fecha de nacimiento» sola y
  «Correo»/«Teléfono» en dos columnas; el código lleva una decisión humana de poner los tres en una
  fila. *Por defecto:* la decisión humana; en teléfono, una columna.
- **P9. «Factor» deshabilitado sin base.** El tablero lo deshabilita con «No deriva de ninguna»; hoy
  siempre está habilitado y el servidor valida. *Por defecto:* como hoy (cambiaría lo que envía el
  formulario); se anota como deuda.
- **P10. Separador decimal de la equivalencia.** El tablero usa coma; el código emite punto
  («0.001»). *Por defecto:* punto, como hoy; se anota como deuda (afecta a otras pantallas que
  muestran factores).
- **P11. Textos entre corchetes y por confirmar.** Los roles «[Operario]» / «[Supervisor]» son datos;
  «[Elige un rol]» no existe hoy; la paginación «Página X de Y · N en total» de la tabla principal la
  pone `DataTable`. *Por defecto:* los textos de hoy; ningún marcador nuevo en el selector de rol.
- **P12. Insignias dentro del selector de estado.** *Por defecto:* fuera; el selector sigue con
  opciones de texto.
- **P13. Icono en la cabecera de los diálogos.** *Por defecto:* fuera, como QC-262 P5.
- **P14. Miga de Integraciones.** El tablero pinta «Integraciones ›» sobre el `h1`; `PageHeader` marca
  como actual el último paso de la miga. *Por defecto:* miga de dos pasos «Integraciones › <etiqueta>»
  sin enlaces (la etiqueta se repite en el `h1`). La pantalla de WhatsApp (QC-237) queda con su
  cabecera de hoy, aunque las tres integraciones dejen de verse iguales.
- **P15. Toasts que faltan (D10).** Los dieciséis del R32 ya existen hoy con el texto del tablero,
  incluido «Usuario actualizado.», pero ninguno tiene test que fije su texto. *Por defecto:* no se
  añade ninguno nuevo; un test fija los dieciséis y que un fallo no lanza ninguno.
- **P16. Animaciones del tablero.** *Por defecto:* entran el giro y el esqueleto de carga del panel de
  usuario (R27) y «Agregar» → «Agregado» sin salto (R28); la entrada escalonada y los fundidos de la
  tabla quedan fuera como deuda.
