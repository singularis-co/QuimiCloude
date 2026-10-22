# QC-265 — Rediseño del operario · requirements.md

## Alcance

Lleva al diseño del canvas (página 6) las cuatro pantallas del operario: **Asignación**
(`/asignacion`), **Ejecución** (`/asignacion/<id>`), **Empaque** (`/asignacion/empaque/<id>`) y
**Acondicionamiento** (`/asignacion/acondicionamiento/<id>`), con sus modales. Fuente:
`docs/diseno/canvas/Asignacion*.dc.html`, `Ejecucion*`, `Empaque*`, `Acondicionamiento*` y
`ModalesOperario.dc.html` (`_trabajo/rediseno/canvas/` es la misma fuente sin versionar) y
`progress/rediseno.md`. **El diseño manda sobre lo visual**; el comportamiento (permisos, acciones,
esperas, reglas de avance) es el de hoy salvo lo que dice cada requisito.

Lo que pide la ficha:

1. **Asignación:** la pestaña «Terminados» del acondicionador pasa a llamarse «Acondicionados» y cada
   pestaña lleva contador (D4). «Entrar» es la única acción visible de la fila; el resto va al menú ⋯
   (D2).
2. **Empaque y Acondicionamiento:** el mismo diseño que Ejecución, sin barra lateral, con cabecera y
   pie fijos y objetivos táctiles de 44 px o más (D5).
3. **Botón con cuenta atrás:** muestra un anillo de progreso.
4. **Textos:** se corrige «Lo esta empacando» (D9) y se añaden los toasts que faltan (D10).

Herencia de QC-252 (`specs/QC-252-componentizacion-asignacion/requirements.md`): los avisos adoptan
`Notice` (P4), el anillo de `CountdownGatedButton` (P5) y la deuda D51 (P6).

### Lo que NO entra

- **El buscador «Buscar»** del tablero de Asignación: las listas de `asignaciones` no admiten
  búsqueda y añadirla es trabajo de módulo (P11).
- **Editar el equipo después de comenzar** el acondicionamiento, y el selector con pestañas
  Personas / Grupos y autocompletar del tablero (P2). Cambiar la espera de 5 s del acondicionamiento
  (P3) o el paso a paso del empaque (P4): son decisiones cerradas de QC-218 y QC-211.
- **Casillas de 52 px** en el paso a paso: obliga a enmendar la lista cerrada R18 de
  `order-execution-screen.test.tsx` (deuda D44) (P13).
- **Icono en los vacíos** (`EmptyState` no lo tiene); el texto de los vacíos no cambia.
- Pasar la cabecera de progreso de la ejecución a la cabecera fija de la pantalla (P14).
- La pantalla «Recorrido» (`/dashboard/recorrido/<id>`): es de QC-261. Aquí solo se enlaza.
- QC-253 (lote sin producción en el acondicionamiento) y QC-200 (cancelar desde la ejecución): no
  se adelanta nada de ellas.

## Decisiones cerradas (no reabrir)

La ficha llegó sin `/afinar-feature`. Estas filas son decisiones del humano ya tomadas en
`progress/rediseno.md` (2026-10-10) o al aprobar specs anteriores; no las abre este spec.

| # | Decisión | Quién y cuándo | Enmienda a | Cubierta por |
| --- | --- | --- | --- | --- |
| D2 | Acciones de fila siempre en el menú ⋯; única excepción «Entrar» del operario en Asignación. En teléfono la tabla pasa a tarjetas y «Acciones» abre el menú centrado. «Ver recorrido» nunca es enlace de texto | humano, 2026-10-10 (`progress/rediseno.md` D2) | — | R18, R19, R20, R21 |
| D3 | Tonos por significado con un único `StatusBadge` y un único mapa por dominio | humano, 2026-10-10 (D3) | — | R16, R27, R32 |
| D1 | Prioridad con `PriorityMark` | humano, 2026-10-10 (D1) | — | R17 |
| D4 | Asignación: la segunda pestaña «Terminados» (la del acondicionador) pasa a «Acondicionados»; contador en cada pestaña | humano, 2026-10-10 (D4) | QC-217 (etiqueta de la pestaña y enlace de vuelta) | R7, R8, R9, R10, R11, R12 |
| D5 | Empaque y Acondicionamiento con el diseño del operario de Ejecución: sin barra lateral, cabecera y pie fijos, objetivos ≥ 44 px | humano, 2026-10-10 (D5) | — | R1, R2, R3, R4, R5, R6 |
| D7 | Tallas de botón: touch 44 · xl 52 (operario) | humano, 2026-10-10 (D7) | — | R3, R25, R29, R34 |
| D9 | Corregir textos sin tildes | humano, 2026-10-10 (D9) | — | R39 |
| D10 | Agregar los toasts que faltan | humano, 2026-10-10 (D10) | — | R40 |
| D14 | Lo demás del canvas queda aprobado; cada pantalla en escritorio, tablet y teléfono | humano, 2026-10-10 (D14) | — | R21, R33, R41 |
| QC-252 P4 | La adopción de `Notice` en los avisos de `/asignacion` es de esta ficha | humano, 2026-10-12 (aprobación de QC-252) | — | R13, R14 |
| QC-252 P5 | `CountdownGatedButton` vive en `components/shared`; el anillo del tablero `Dominio.dc.html` lo pone esta ficha | humano, 2026-10-12 | — | R37, R38 |
| QC-252 P6 | Los duplicados de D51 quedaron fuera de QC-252; su dueño queda sin asignar | humano, 2026-10-12 | — | R14, R42, R43 (P15) |
| QC-211 D6, D7 | El empacador ve los pasos de envasado solo tras Comenzar, con el paso a paso del operador (checks y 5 s por paso), y el último paso termina | humano, 2026-10-05 | — | R30 |
| QC-218 D6 | Comenzar y Terminar el acondicionamiento esperan 5 s en el botón de su modal, solo en cliente | humano, 2026-10-06 | — | R35, R36 |

## Requisitos (EARS)

Los requisitos marcados *(supuesto Pn)* están escritos con la opción por defecto de la pregunta
abierta `Pn`; si el humano elige otra, se reescriben antes de implementar.

### Marco del operario (D5)

- **R1.** CUANDO alguien abre la ejecución, el empaque o el acondicionamiento de un pedido, el
  sistema NO DEBE pintar la barra lateral ni la cabecera de la zona privada, y la dirección, el
  permiso exigido y el 404 de cada pantalla DEBEN ser los de hoy. *(supuesto P1)*
- **R2.** En esas tres pantallas, el sistema DEBE pintar una cabecera fija arriba con el número del
  pedido, la receta como único `h1` y el control «Cambiar tema», y un pie fijo abajo con las
  acciones principales que deja libre el margen inferior seguro (`safe-area-inset-bottom`).
- **R3.** En esas tres pantallas, cada botón del pie DEBE medir al menos 52 px de alto y todo control
  interactivo al menos 44 × 44 px.
- **R4.** MIENTRAS el contenedor de la pantalla mide más de 1100 px, la ejecución y el empaque DEBEN
  pintar dos columnas (panel de 300 px y contenido de hasta 720 px) y el acondicionamiento sus dos
  tarjetas lado a lado; con 1100 px o menos, una sola columna en el orden del tablero (regla `.cq-2`
  de `docs/diseno/canvas/qc.css`).
- **R5.** SI una de esas tres pantallas responde 404, ENTONCES el sistema DEBE pintar el 404 de la
  zona privada con su barra lateral y su cabecera, como hoy.
- **R6.** El resto de pantallas privadas, `/asignacion` incluida, DEBE seguir pintando la barra
  lateral y la cabecera de la zona privada.

### Asignación — pestañas (D4)

- **R7.** La pestaña de la vista `acondicionados` DEBE llamarse «Acondicionados»; las demás pestañas
  conservan su etiqueta de hoy. *(supuesto P12: los textos de la tabla de esa vista no cambian)*
- **R8.** CUANDO el detalle de acondicionamiento de un pedido `TERMINADO` ofrece volver, el enlace
  DEBE decir «Volver a «Acondicionados»» y llevar a `/asignacion?vista=acondicionados`.
- **R9.** MIENTRAS el usuario puede ver más de una vista, cada pestaña DEBE mostrar junto a su etiqueta
  el número total de pedidos de su vista.
- **R10.** El contador de una vista DEBE ser el `total` que devuelve su lista en la primera página sin
  filtros de la dirección; para «Todos», sin filtro de estado. *(supuesto P16)*
- **R11.** SI falla la lectura del contador de una vista, ENTONCES esa pestaña DEBE pintarse sin
  contador y la vista vigente DEBE cargar su lista igual que hoy.
- **R12.** Las pestañas de `/asignacion` DEBEN pintarse con `UrlTabs`, cada una como enlace real a
  `/asignacion?vista=<vista>`, con la vigente seleccionada, el nombre de la lista «Vistas de
  asignación» y los `data-testid` de hoy (`assignment-view-tabs`, `assignment-view-tab-<vista>`).

### Asignación — avisos (QC-252 P4, D51)

- **R13.** CUANDO `/asignacion` llega con `entregado`, `cancelado`, `empacado` (en «Por empacar») o
  `acondicionado` (en «Por acondicionar»), el sistema DEBE pintar el aviso con `Notice`, en tono
  `warning` el de entregado, `success` los de empacado y acondicionado e `info` el de cancelado, con
  el texto, el `role="status"` y el `data-testid` de hoy. *(supuesto P8)*
- **R14.** Los cuatro avisos DEBEN salir de una sola pieza parametrizada por su tipo; el código de
  producción NO DEBE definir `AssignedOrderDeliveredNotice` ni `AssignedOrderCancelledNotice`.
- **R15.** CUANDO la persona pulsa «Cerrar» en un aviso de `/asignacion`, el sistema DEBE ocultarlo
  sin navegar ni recargar la lista; el control DEBE llamarse «Cerrar» y medir 44 × 44 px.
  *(supuesto P7)*

### Asignación — filas (D1, D2, D3)

- **R16.** CUANDO una lista de `/asignacion` pinta el estado de un pedido, el sistema DEBE usar
  `StatusBadge` con el tono de `ORDER_STATUS_TONES` y la etiqueta de `ORDER_STATUS_LABELS`, y
  conservar el `data-testid` y el `data-status` de hoy.
- **R17.** CUANDO «Mis asignados» o «Todos» pintan la prioridad, el sistema DEBE usar `PriorityMark`
  con el nivel de `ORDER_PRIORITY_LEVELS`, la etiqueta de hoy y su `data-testid` y `data-priority`.
- **R18.** En «Mis asignados», «Entrar» DEBE ser la única acción visible de la fila, con su conducta de
  hoy (entra directo si el pedido está en curso; pide «¿Comenzar el pedido?» si está pendiente).
- **R19.** En «Por empacar», «Por acondicionar», «Acondicionados» y «Entregados», el número del pedido
  NO DEBE ser un enlace, y el menú ⋯ de la fila DEBE ofrecer «Entrar», que lleva a la pantalla de
  empaque o de acondicionamiento de hoy. *(supuesto P10)*
- **R20.** DONDE el usuario tiene `dashboard.consultar`, el menú ⋯ de cada fila de `/asignacion` DEBE
  ofrecer «Ver recorrido», que lleva a `/dashboard/recorrido/<id>`; SI no lo tiene, ENTONCES NO DEBE
  ofrecerlo, y una fila sin ítems NO DEBE pintar el menú. *(supuesto P9)*
- **R21.** MIENTRAS el contenedor de una lista de `/asignacion` mide 760 px o menos, el sistema DEBE
  pintar cada fila como tarjeta con número, estado, receta y datos secundarios, el botón «Acciones»
  que abre el menú centrado y, si la fila lo tiene, «Entrar» de 44 px.
- **R22.** La pantalla `/asignacion` DEBE pintar su título «Asignación» como único `h1` con
  `PageHeader` (conservando `data-testid="asignacion-title"`) dentro de `PageShell`.

### Ejecución (`/asignacion/<id>`)

- **R23.** La cabecera fija de la ejecución DEBE pintar el número del pedido, la receta (o «Esta receta
  está dada de baja.»), «Pedido <cantidad> <unidad> · Presentación: <reparto>», «Cambiar tema» y un
  menú «Acciones del pedido <número>» con «Cancelar pedido», que abre el diálogo de cancelar de hoy
  con su motivo, textos, envío y errores.
- **R24.** La ejecución DEBE pintar herramientas y materiales en un panel plegable «Herramientas» con
  el número de herramientas, abierto al entrar; CUANDO se pliega o se despliega, el paso vigente y lo
  marcado NO DEBEN cambiar.
- **R25.** El paso a paso de la ejecución DEBE pintar «Anterior» y «Siguiente» (o «Finalizar» en el
  último paso) en el pie fijo, con 52 px de alto, y el motivo del bloqueo visible encima; el bloqueo
  por casillas y por espera, el registro del paso y el envío de Finalizar DEBEN ser los de hoy.
- **R26.** CUANDO se pulsa Finalizar sin bloqueo, el sistema DEBE abrir «¿Terminar el pedido?» con
  «Terminar el pedido no se puede deshacer.», «Cancelar» y «Terminar», y terminar como hoy.

### Empaque (`/asignacion/empaque/<id>`)

- **R27.** La cabecera fija del empaque DEBE pintar «Volver a «Por empacar»» como botón con flecha que
  lleva a `/asignacion?vista=por_empacar` (`data-testid="packing-order-back-link"`), el número, la
  receta y el estado del pedido con `StatusBadge` (`data-testid="packing-order-status"`,
  `data-status`).
- **R28.** El empaque DEBE pintar un resumen con «Cantidad:» y «Reparto» (una línea por presentación
  con su `data-testid` de hoy, «Sin presentación» si no hay líneas) y los envases; MIENTRAS el pedido
  está `POR_EMPACAR` sin reparto, el aviso «Falta el reparto: lo define quien edita pedidos» DEBE
  pintarse con `Notice` en tono `warning` y su `data-testid` de hoy.
- **R29.** El pie del empaque DEBE pintar «Comenzar» y «Terminar»; MIENTRAS el pedido está
  `POR_EMPACAR`, solo «Comenzar» DEBE estar habilitado; MIENTRAS está `EN_EMPAQUE` a nombre del actor
  y sin pasos de envasado, solo «Terminar»; cada uno abre su confirmación de hoy y envía lo de hoy.
- **R30.** MIENTRAS el pedido está `EN_EMPAQUE` a nombre del actor y tiene pasos de envasado, el
  empaque DEBE pintar el paso a paso «Pasos de envasado» con su pie (Anterior / Siguiente / Terminar)
  en lugar de los botones del R29, con las reglas de QC-211 (checks, 5 s por paso, Terminar en el
  último paso). *(supuesto P4)*
- **R31.** MIENTRAS el pedido está `EN_EMPAQUE` a nombre de otra persona, el empaque DEBE pintar con
  `Notice` en tono `info` «Lo está empacando <nombre>.» (o «Lo está empacando otra persona.» si no hay
  nombre), con `data-testid="packing-order-packer"`, y los dos botones del pie DEBEN estar
  deshabilitados.

### Acondicionamiento (`/asignacion/acondicionamiento/<id>`)

- **R32.** La cabecera fija del acondicionamiento DEBE pintar el enlace de vuelta de hoy como botón con
  flecha («Volver a «Por acondicionar»», «Volver a «Acondicionados»» o «Volver a «Entregados»» según
  el estado), el número, la receta, el reparto («N × envase») y el estado con `StatusBadge`
  (`data-testid="conditioning-order-status"`, `data-status`), y «Lo acondiciona <nombre>.» cuando lo
  hay.
- **R33.** El acondicionamiento DEBE pintar la tarjeta «Equipo» (MIENTRAS el pedido tiene equipo, con
  los grupos, avatares, nombres y `data-testid` de hoy) y la tarjeta «Datos de lote» con el
  formulario de hoy.
- **R34.** El pie del acondicionamiento DEBE pintar «Acondicionar» y «Terminar»; MIENTRAS el pedido
  está `POR_ACONDICIONAR` y hay candidatos, solo «Acondicionar» DEBE estar habilitado; MIENTRAS está
  `EN_ACONDICIONAMIENTO` a nombre del actor, solo «Terminar», deshabilitado y descrito por el aviso
  de hoy si faltan datos de lote.
- **R35.** CUANDO se pulsa «Acondicionar», el sistema DEBE abrir el diálogo «Acondicionar el pedido
  <número>» con el selector de equipo de hoy y «Comenzar» bloqueado 5 s con el botón con espera.
  *(supuestos P2, P3)*
- **R36.** CUANDO se pulsa «Terminar», el sistema DEBE abrir «Terminar el acondicionamiento» con «El
  pedido <número> pasará a Terminado.», «Cancelar» y «Terminar» bloqueado 5 s con el botón con
  espera, y terminar como hoy. *(supuesto P3)*

### Botón con espera (QC-252 P5)

- **R37.** MIENTRAS `CountdownGatedButton` espera, el sistema DEBE pintar dentro del botón un anillo de
  progreso, oculto a lectores de pantalla, que se vacía de forma lineal en los `seconds` de la
  espera, junto a la cuenta visible; CUANDO la espera acaba, anillo y cuenta DEBEN desaparecer y el
  botón DEBE habilitarse (salvo `disabled`).
- **R38.** El anillo de espera DEBE tener una sola definición, compartida por `CountdownGatedButton` y
  por la espera del paso a paso (`StepReader`).

### Textos y avisos emergentes (D9, D10)

- **R39.** Las pantallas del operario DEBEN decir «Lo está empacando…», «Esta receta está dada de
  baja.» y «Esta receta no tiene ningún paso que leer.»; el código de producción NO DEBE contener
  «Lo esta empacando», «receta esta dada de baja» ni «ningun paso».
- **R40.** CUANDO se guardan los datos de lote con éxito, el sistema DEBE lanzar el aviso emergente
  «Datos de lote guardados.» en vez del mensaje en línea. *(supuesto P5)*
- **R41.** CUANDO se abre cualquier diálogo del operario (comenzar el pedido, cancelar, terminar el
  pedido, comenzar y terminar el empaque, acondicionar y terminar el acondicionamiento) en una
  ventana de 390 × 844, el diálogo DEBE quedar entero y centrado en la pantalla visible, con botones
  de al menos 44 px.

### Deuda D51 y limpieza (QC-252 P6)

- **R42.** `/asignacion` DEBE tener una sola pieza de error de lista: el código de producción NO DEBE
  definir a la vez `AssignedOrdersError` y `AssignmentListError`.
- **R43.** El barrel de `app/(private)/asignacion/components/` NO DEBE reexportar `MISSING_VALUE_MARK`,
  y `tests/guards/guard-piezas-base.test.ts` NO DEBE excluir ningún archivo de `/asignacion`.
- **R44.** CUANDO una pieza se crea, sube a `components/shared` o gana un punto de extensión,
  `components/shared/CATALOGO.md` DEBE tener su fila al día en el mismo commit, con su tablero.

### Sin regresión

- **R45.** Comenzar, terminar y cancelar el pedido, registrar el paso, comenzar y terminar el empaque,
  comenzar y terminar el acondicionamiento y guardar los datos de lote DEBEN enviar los mismos campos
  a las mismas Server Actions que hoy, y sus errores DEBEN pintarse con `ErrorAlert` y los
  `data-testid` de hoy.

## Preguntas abiertas

Cada una lleva su opción por defecto, con la que están escritos los requisitos.

- **P1. Cómo se quita la barra lateral.** El layout privado es el único que lee la sesión y no sabe qué
  página pinta. *Por defecto:* la pantalla del operario marca su raíz y una regla de CSS con `:has()`
  oculta la barra y la cabecera privadas (`design.md > D2`); nada se mueve de carpeta y el 404 sigue
  con su barra (R5). Alternativas: grupo de rutas `(operario)` o decidir por la ruta en el cliente
  (`design.md > 8`).
- **P2. Equipo del acondicionamiento.** El tablero lo pone en la pantalla, con pestañas Personas /
  Grupos, autocompletar y «Quitar»/«Asignar» también tras comenzar; QC-218 lo eligió dentro del modal
  y fijo al comenzar. *Por defecto:* el selector sigue en el modal (restilado) y la pantalla pinta el
  equipo de solo lectura.
- **P3. Espera del acondicionamiento.** El tablero cuenta 10 s en el «Terminar» del pie desde que se
  comienza; QC-218 D6 fija 5 s en el botón de cada modal. *Por defecto:* QC-218, con el anillo.
- **P4. Pasos de envasado.** El tablero los pinta como lista fija y «Terminar» en el pie; QC-211 D6/D7
  fija el paso a paso tras Comenzar. *Por defecto:* QC-211 (R30).
- **P5. Toasts que faltan (D10).** El tablero pinta tres, todos con texto por confirmar: «[Datos de
  lote guardados.]», «[Empaque terminado.]» y «[Acondicionamiento terminado.]». *Por defecto:* solo
  el de datos de lote, que sustituye al mensaje en línea; terminar empaque o acondicionamiento ya
  vuelve a la lista con su aviso y no lleva toast.
- **P6. Textos entre corchetes del tablero.** «[DESCRIPCIÓN DEL DIÁLOGO]» de comenzar y terminar el
  empaque y de «Acondicionar el pedido N», «[Materiales]», «[Volver a «Por acondicionar»]» y «[No hay
  pedidos entregados.]». *Por defecto:* se quedan los textos de hoy; «Acondicionar el pedido N» sigue
  sin descripción y el título del bloque de materiales es «Materiales».
- **P7. Avisos que se cierran.** El tablero dibuja una X; `Notice` no la tiene. *Por defecto:* `Notice`
  gana un cierre opcional (paso 2 de la regla de decisión, tablero `Asignacion.dc.html`).
- **P8. Tono del aviso de cancelado.** No está en el tablero; D3 da `muted` a «Cancelado» y `Notice`
  no tiene ese tono. *Por defecto:* `info`.
- **P9. «Ver recorrido» para el operario.** El recorrido exige `dashboard.consultar`. *Por defecto:*
  solo se ofrece a quien tiene ese permiso.
- **P10. Entrar a un pedido de Por empacar / Por acondicionar.** El tablero lo marca «por confirmar» y
  lo pone en el menú ⋯; hoy es el número el que enlaza. *Por defecto:* «Entrar» en el menú y el número
  como texto (D2).
- **P11. Buscador.** *Por defecto:* fuera de esta ficha (trabajo de módulo); se anota como deuda.
- **P12. Alcance del renombrado.** *Por defecto:* solo la pestaña y el enlace de vuelta; «Cargando
  pedidos terminados…», «No hay pedidos terminados que mostrar.» y «Todavía no has terminado ningún
  acondicionamiento.» hablan del estado `TERMINADO` y no cambian.
- **P13. Casillas de 52 px.** *Por defecto:* no se enmienda la lista R18; las casillas siguen como hoy.
- **P14. Progreso en la cabecera de la ejecución.** *Por defecto:* el progreso sigue arriba del paso,
  dentro de `StepReader`; partirlo cambia una pieza que también usa Fórmulas.
- **P15. D51 entero.** *Por defecto:* entran los tres puntos (avisos, error de lista y alias), porque
  esta ficha reescribe esos archivos.
- **P16. Qué cuenta el contador.** *Por defecto:* el total de la vista sin filtros de la dirección,
  leído con la primera página de su lista (sin caso de uso nuevo).
