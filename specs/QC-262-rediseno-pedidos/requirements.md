# QC-262 — Rediseño de Pedidos · requirements.md

## Alcance

Lleva al diseño del canvas (página 3) la pantalla `/pedidos` en escritorio, tablet y teléfono, y sus
modales. Fuente: `docs/diseno/canvas/Pedidos.dc.html`, `PedidosTablet.dc.html`,
`PedidosMovil.dc.html` (ficha) y `ModalesPedidos.dc.html` (`_trabajo/rediseno/canvas/` es la misma
fuente sin versionar), más `progress/rediseno.md`. **El diseño manda sobre lo visual**; el
comportamiento (permisos, acciones, campos enviados, reglas por estado, errores) es el de hoy salvo
lo que dice cada requisito.

Lo que pide la ficha:

1. **Filtros en una sola barra.**
2. **Prioridad con `PriorityMark`** (D1) y **cobertura con `StatusBadge`** (D3); el estado, también
   con `StatusBadge` (D3).
3. **Acciones de fila en el menú ⋯** (D2): Editar, Responsables, Cliente, Reparto y unidad,
   Entregar, Cancelar y Eliminar.
4. **En teléfono, la tabla se ve como tarjetas**, con «Acciones» que abre el menú centrado (D2).
5. **Toasts que faltan** (D10).

### Lo que NO entra

- **Un diálogo «Responsables» propio** con pestañas Personas / Grupos (tablero `ModalesPedidos`):
  «Responsables» sigue abriendo el panel del pedido en su sección (P1).
- **Formatos de fecha y cantidad del tablero** («02/10/2026», «120,00 kg»): siguen los de hoy (P3).
- **El título del panel de edición fijo** «Editar pedido»: sigue «<receta> × <cantidad>» (P4).
- **Icono en la cabecera de los diálogos de confirmación** (`dlg-ic` del tablero): `ConfirmDialog`
  no lo tiene y cambiarlo toca todos los módulos (P5).
- **`PriorityMark` dentro del selector de prioridad del formulario**: `SelectField` solo admite
  opciones de texto (P10).
- **Textos y atributos que pone la tabla compartida**: paginación «8 de 10 pedidos», `role="toolbar"`
  de la barra (P11).
- **El esqueleto de carga en tarjetas** en teléfono (P12).
- Las deudas D38, D39 y D40 de `progress/deudas.md` (P9).
- QC-179 (clic en editar que no abre el panel en WebKit, `pending`): no se adelanta nada.

## Decisiones cerradas (no reabrir)

La ficha llegó sin `/afinar-feature`. Estas filas son decisiones del humano ya tomadas en
`progress/rediseno.md` (2026-10-10) o al aprobar specs anteriores; no las abre este spec.

| # | Decisión | Quién y cuándo | Enmienda a | Cubierta por |
| --- | --- | --- | --- | --- |
| D1 | Prioridad con `PriorityMark` (barras neutras; solo «Crítica» en color e icono), no con `Badge` de color | humano, 2026-10-10 (`progress/rediseno.md` D1) | QC-227 (tono de la prioridad en `badges-estado`) | R6, R8 |
| D2 | Acciones de fila siempre en el menú ⋯. En teléfono la tabla pasa a tarjetas y «Acciones» abre el menú centrado en la pantalla visible | humano, 2026-10-10 (D2) | — | R10, R11, R12, R13, R15 |
| D3 | Tonos por significado con un único `StatusBadge` y un único mapa por dominio | humano, 2026-10-10 (D3) | QC-227 (tonos de estado y cobertura en `badges-estado`) | R5, R7, R8, R9 |
| D7 | Tallas de botón: sm 32 · default 36 · touch 44 · xl 52 | humano, 2026-10-10 (D7) | — | R1, R10, R15, R18 |
| D10 | Agregar los toasts que faltan | humano, 2026-10-10 (D10) | — | R21 |
| D14 | Lo demás del canvas queda aprobado; cada pantalla en escritorio, tablet y teléfono | humano, 2026-10-10 (D14) | — | R2, R3, R15, R16, R18, R19, R20 |
| QC-102 | «Responsables» abre **el mismo** panel del pedido en su sección; no hay un segundo panel | humano, 2026-09-13 (`specs/QC-102-responsables-en-la-pantalla-de-pedidos`) | — | R13 (P1) |
| QC-35 R39 | La cantidad se pinta redondeada a dos decimales con su valor exacto en `title` | humano, 2026-09-17 (enmienda a QC-35 R39) | — | R22 (P3) |
| QC-35 panel | El título del panel de alta y edición es «<receta> × <cantidad>» | humano, 2026-09-08 | — | R20 (P4) |
| Menú del pedido | Los ítems del menú dicen solo el verbo; el número va en el nombre del disparador | humano, 2026-10-04 (`order-row-actions.tsx`) | — | R10, R11 |

## Requisitos (EARS)

Los requisitos marcados *(supuesto Pn)* están escritos con la opción por defecto de la pregunta
abierta `Pn`; si el humano elige otra, se reescriben antes de implementar.

### Página

- **R1.** La pantalla `/pedidos` DEBE pintar dentro de `PageShell` una cabecera `PageHeader` con
  «Pedidos» como único `h1` (`data-testid="pedidos-title"`) y la acción «Nuevo pedido»
  (`data-testid="order-create-open"`), que mide al menos 44 × 44 px y abre el panel de alta de hoy.

### Barra de filtros

- **R2.** La lista DEBE pintar una sola barra de filtros (`data-testid="data-table-filters"`) que
  contiene, en este orden, el buscador «Buscar por receta», el filtro «Filtrar por cliente» y los
  chips «Estado», «Prioridad» y «Fecha de solicitud»; NO DEBE haber ningún control de filtro de la
  lista fuera de esa barra.
- **R3.** MIENTRAS el contenedor de la lista mide 760 px o menos, el buscador DEBE ocupar todo el
  ancho de la barra, y el filtro de cliente y los chips DEBEN quedar debajo, dentro de la misma barra,
  sin que nada de la barra desborde el ancho de la pantalla visible.
- **R4.** CUANDO se aplica, cambia o limpia un filtro, la búsqueda, el orden o la página, la dirección
  y las filas que pide la pantalla DEBEN ser las de hoy.

### Estado, prioridad y cobertura (D1, D3)

- **R5.** CUANDO la pantalla pinta el estado de un pedido, el sistema DEBE usar `StatusBadge` con el
  tono de `ORDER_STATUS_TONES` y la etiqueta de `ORDER_STATUS_LABELS`, con `data-testid="order-status"`
  y `data-status` iguales a los de hoy.
- **R6.** CUANDO la pantalla pinta la prioridad de un pedido, el sistema DEBE usar `PriorityMark` con
  el nivel de `ORDER_PRIORITY_LEVELS` y la etiqueta de `ORDER_PRIORITY_LABELS`, con
  `data-testid="order-priority"` y `data-priority` iguales a los de hoy.
- **R7.** CUANDO la lista o el panel del pedido pintan la cobertura, el sistema DEBE usar `StatusBadge`
  con el tono de `ORDER_COVERAGE_TONES` y la etiqueta de `ORDER_COVERAGE_LABELS`, con
  `data-testid="order-coverage"` y `data-coverage` iguales a los de hoy; SI la cobertura del pedido
  no llegó, ENTONCES DEBE pintarse el marcador de ausencia de hoy.
- **R8.** El código de producción de `app/(private)/pedidos/` NO DEBE importar `Badge` de
  `components/ui/badge` ni declarar un mapa propio de estado, prioridad o cobertura a variante o tono.
- **R9.** CUANDO el selector de versión de receta marca una versión, «por revisar» DEBE pintarse con
  `StatusBadge` en tono `waiting` y «dada de baja» en tono `muted`, con los textos de hoy.
  *(supuesto P10)*

### Menú de fila (D2)

- **R10.** Cada fila DEBE ofrecer sus acciones solo dentro del menú ⋯, cuyo disparador mide al menos
  44 × 44 px, se llama «Acciones del pedido <número>» y conserva `data-testid="order-row-actions"` y
  `data-order-id`; la única otra entrada al panel desde la fila DEBE seguir siendo el «+N» de la
  columna Responsables.
- **R11.** El menú ⋯ DEBE ofrecer sus ítems en este orden: «Editar», «Responsables», «Cliente»,
  «Reparto y unidad», «Entregar», un separador, «Cancelar» y «Eliminar»; «Cancelar» y «Eliminar»
  DEBEN pintarse como destructivos, y cada ítem conserva su `data-testid` de hoy. *(supuesto P6)*
- **R12.** Cada ítem DEBE aparecer, deshabilitarse u omitirse con las reglas de hoy: «Editar»,
  «Cancelar» y «Eliminar» deshabilitados en estado final; «Responsables» siempre habilitado;
  «Cliente» solo con `pedidos.modificar` y deshabilitado en `ENTREGADO` y `CANCELADO`; «Reparto y
  unidad» solo con `pedidos.modificar` en `POR_EMPACAR`; «Entregar» solo con `entregas.modificar` en
  `TERMINADO`.
- **R13.** CUANDO la persona elige un ítem del menú, el sistema DEBE abrir para ese pedido el panel o
  el diálogo de hoy («Editar» y «Responsables» abren el mismo panel, en el formulario o en su sección
  de responsables) y NO DEBE haber dos paneles o diálogos de pedido abiertos a la vez.
  *(supuesto P1)*
- **R14.** DONDE un ítem de `RowActionsMenu` declara un separador delante, el menú DEBE pintar una
  línea divisoria (`role="separator"`) antes de ese ítem, en el desplegable y en el diálogo
  centrado, salvo que sea el primer ítem; SI ningún ítem lo declara, ENTONCES el árbol del menú DEBE
  ser el de hoy.

### Tarjetas (D2, D14)

- **R15.** MIENTRAS el contenedor de la lista mide 760 px o menos, el sistema DEBE pintar cada pedido
  como tarjeta con el número (en monoespaciada) y el estado arriba, la receta como título, el
  cliente, la cantidad y la fecha de solicitud como datos secundarios y, abajo, la prioridad y el
  botón «Acciones» de al menos 44 px, que abre los ítems del R11 en un diálogo centrado titulado
  «Pedido <número>» con ítems de al menos 48 px. *(supuesto P2)*
- **R16.** MIENTRAS el contenedor de la lista mide más de 760 px, el sistema DEBE pintar la tabla con
  las doce columnas de hoy en su orden, con el número fijado a la izquierda y el desbordamiento
  horizontal dentro de su caja, sin desplazar el documento.
- **R17.** Con la lista en tarjetas, los estados vacío, sin coincidencias y error, la paginación y el
  aviso de «en vuelo» DEBEN ser los de hoy.

### Modales y paneles

- **R18.** CUANDO se abre en una ventana de 390 × 844 cualquier diálogo de pedidos («Cancelar el
  pedido», «Eliminar el pedido», «Material insuficiente», «Cliente», «Reparto y unidad»), el diálogo
  DEBE quedar entero y centrado en la pantalla visible, con botones de al menos 44 px.
- **R19.** CUANDO se abre en una ventana de 390 × 844 el panel de alta y edición o el de entrega, el
  panel DEBE ocupar todo el ancho y el alto de la pantalla visible y su pie de acciones DEBE quedar
  visible por encima del margen inferior seguro.
- **R20.** Los modales DEBEN conservar los textos de hoy, que coinciden con el tablero: panel «Nuevo
  pedido» con «Completa los datos del pedido. La fecha y el número los pone el sistema.» y de edición
  con «Cambia los datos del pedido. Se guardan todos los campos.» (título «<receta> × <cantidad>»
  cuando hay receta); «Entregar pedido <número>» con «Elige el cliente y, por presentación, de qué
  lotes salen los envases.»; «Cancelar el pedido» con «Motivo de la cancelación», «Volver» y
  «Cancelar el pedido»; «Eliminar el pedido» con «Volver» y «Eliminar»; «Material insuficiente» con
  «Volver» y «Guardar bloqueado»; «Cliente» con «Quitar cliente», «Cancelar» y «Guardar»; «Reparto y
  unidad» con «Cancelar» y «Guardar». *(supuestos P4, P8)*

### Avisos emergentes (D10)

- **R21.** CUANDO una acción de pedidos termina con éxito, el sistema DEBE lanzar un único aviso
  emergente de éxito con su texto: «Pedido creado.», «Pedido actualizado.», «Pedido cancelado.»,
  «Pedido eliminado.», «Cliente actualizado.», «Reparto actualizado.», «Pedido entregado» (entrega
  que completa el pedido), «Entrega registrada» (entrega parcial), «Se añadió 1 persona al pedido.» /
  «Se añadieron <n> personas al pedido.», «Responsable retirado del pedido.» y «Se retiró 1 persona
  con el grupo.» / su plural de hoy. *(supuesto P7)*

### Sin regresión

- **R22.** Las celdas de la lista DEBEN pintar los mismos datos que hoy: número con
  `formatOrderNumber`, cantidad redondeada a dos decimales con su valor exacto en `title`, fecha
  `YYYY-MM-DD` en UTC, reparto con `OrderDistributionLabel` y marcador de ausencia donde falta un
  dato. *(supuesto P3)*
- **R23.** Crear, editar, cancelar, eliminar, cambiar cliente, cambiar reparto y unidad, entregar y
  asignar o retirar responsables DEBEN enviar los mismos campos a las mismas Server Actions que hoy,
  con el mismo permiso exigido, y sus errores DEBEN pintarse con los componentes y los `data-testid`
  de hoy.
- **R24.** CUANDO una pieza compartida gana un punto de extensión, `components/shared/CATALOGO.md`
  DEBE tener su fila al día en el mismo commit, con su tablero.

## Preguntas abiertas

Cada una lleva su opción por defecto, con la que están escritos los requisitos.

- **P1. Diálogo «Responsables».** El tablero `ModalesPedidos` dibuja un diálogo propio con pestañas
  Personas / Grupos de trabajo y casillas; QC-102 decidió un único panel por pedido con su sección de
  responsables. *Por defecto:* sigue el panel único (R13); el diálogo propio, si se quiere, es otra
  ficha.
- **P2. Tablet.** La ficha `PedidosMovil` dice «tabla con scroll horizontal» en tablet, pero el propio
  tablero cae en tarjetas a 820 px (su contenedor `.page` mide menos de 760 px con la barra en
  icono). *Por defecto:* el umbral de `DataTable` (contenedor de 760 px o menos), como QC-261 P5; en
  tablet salen tarjetas.
- **P3. Formatos del tablero.** El tablero pinta «02/10/2026» y «120,00 kg». *Por defecto:* los de hoy
  (`YYYY-MM-DD` en UTC y punto decimal redondeado a dos cifras, decisión de QC-35 R39).
- **P4. Título del panel.** El tablero lo deja fijo («Nuevo pedido» / «Editar pedido»); hoy pasa a
  «<receta> × <cantidad>» al elegir receta (decisión del 2026-09-08). *Por defecto:* el de hoy.
- **P5. Icono en los diálogos de confirmación.** El tablero pone un icono de peligro o aviso sobre el
  título de «Cancelar», «Eliminar» y «Material insuficiente»; `ConfirmDialog` no lo admite y lo usan
  todos los módulos. *Por defecto:* fuera; se anota deuda para una ficha transversal.
- **P6. Separador del menú.** El tablero (`Pedidos.dc.html`, `Tabla.dc.html`) separa «Cancelar» y
  «Eliminar» del resto; `RowActionsMenu` no tiene separador. *Por defecto:* `RowActionsMenu` gana
  un separador opcional por ítem (paso 2 de la regla de decisión, R14).
- **P7. Toasts que faltan (D10).** Los nueve del tablero ya existen hoy con el mismo texto, y hay dos
  más («Entrega registrada», «Se retiró… con el grupo.»). *Por defecto:* no se añade ninguno; R21 los
  fija con test. «Pedido entregado» sigue sin punto, como en el tablero y en la app.
- **P8. Textos entre corchetes del tablero.** «[Elige un envase]», «[Pedido N. Asigna personas o
  grupos de trabajo.]», «[No alcanza el material…]», «[faltan]», «[Ingrediente]», «[Costo]»,
  «[Concentrado]», «[Sin fragancia]», «[Envasado turno A]». *Por defecto:* se quedan los textos de hoy.
- **P9. Deudas de pedidos.** D37 (columna de acciones sin `actionsColumn()`) entra: las tarjetas la
  necesitan. D38 (locales de lista y `OrderRecipeImage`), D39 (`TOUCH_TARGET` de `order-sheet.tsx`) y
  D40 (panel de entrega sin `FormSheet`) chocan con las anclas de `guard-pantalla-pedidos-se-amplia`
  y con la lista `NO_SE_TOCAN_R30` de `guard-formularios-y-acciones`. *Por defecto:* D37 dentro;
  D38, D39 y D40 fuera, con su dueño actualizado en `progress/deudas.md`.
- **P10. Selectores del formulario.** El tablero pinta `PriorityMark` en el selector de prioridad y
  `StatusBadge` en las marcas del selector de versión. El de versión pinta sus propios `SelectItem`
  en la ruta; el de prioridad usa `SelectField`, que solo admite opciones de texto. *Por defecto:*
  la versión, dentro (R9); la prioridad, fuera (extender `SelectField` es trabajo de pieza
  compartida), con deuda nueva.
- **P11. Lo que pinta la tabla compartida.** «8 de 10 pedidos» en la paginación y
  `role="toolbar"`/«Filtros de pedidos» en la barra. *Por defecto:* los de hoy; cambiarlos es tocar
  `DataTable` para todas las listas.
- **P12. Esqueleto en teléfono.** `OrderListSkeleton` pinta filas de tabla también en teléfono (como
  D53 en `/asignacion`). *Por defecto:* no cambia; se amplía D53 a `/pedidos`.
