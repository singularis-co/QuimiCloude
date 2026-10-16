# QC-291 — pantalla-operario-rediseno · requirements

## Alcance

Rediseño **visual** de las tres pantallas de ejecución de `/asignacion`: fabricación
(`/asignacion/[id]`), acondicionamiento (`/asignacion/acondicionamiento/[id]`) y empaque
(`/asignacion/empaque/[id]`). Fuente: issue QC-291 y los tableros aprobados
`docs/diseno/canvas/OperarioPantalla.dc.html`, `OperarioPantallaTablet.dc.html` y
`OperarioPantallaMovil.dc.html`.

Entra:

- **Cabecera** pegada arriba y con más aire. Antes de comenzar, «Volver a …». Comenzado, sin
  vuelta y con la línea «Fabricando/Acondicionando/Empacando». Solo el chip de Cantidad. Barra
  «Paso N de M» siempre a la vista.
- **Pie** pegado abajo. «Anterior» y «Siguiente» (o «Terminar …») centrados y del mismo ancho.
  Antes de comenzar, solo «Comenzar …». Solo hace scroll el contenido entre cabecera y pie.
- **Contenido del paso:** insignia con el número, comprobaciones como tarjetas grandes con
  contador «N de M», cuenta de espera y la tarjeta «Revisa antes de comenzar».
- **Columna lateral en escritorio:** Materiales/Envases, Herramientas y Equipo, en ese orden.
  Cada tarjeta es plegable y lleva el color de su sección en la cabecera. Cada material conserva
  su selector de unidad. El equipo va agrupado, con avatar de iniciales y la marca «Tú».
- **Tablet y teléfono:** botones flotantes redondos, uno por sección, que abren un panel con X.
  En teléfono el panel ocupa el ancho y los botones se ocultan mientras está abierto.

Lo que NO entra:

- Datos nuevos, permisos o cambios en los flujos de comenzar, terminar, cancelar, evidencia o
  registro de pasos. Nada en `lib/modules/` ni en `db/`.
- Lo que el tablero pinta y las vistas de hoy no traen (ver `## Preguntas abiertas` P1 a P6). No
  se inventa: o se omite o espera a una ficha de datos.

## Decisiones cerradas (no reabrir)

| # | Decisión | Fecha y fuente | Cubierta por |
|---|---|---|---|
| D1 | El diseño de los tableros `OperarioPantalla*` está aprobado y es la referencia visual. | 2026-10-16, humano (pase `/design`, `progress/features/QC-291.md`) | R1-R31 |
| D2 | Es rediseño visual: sin datos, permisos ni cambios de flujo. | 2026-10-16, issue QC-291 | R32 |
| D3 | Ninguna librería nueva. | 2026-10-16, ficha «Librerías: ninguna nueva» del tablero móvil | R32 |

## Requisitos (EARS)

«Comenzada por el actor» significa, en cada pantalla: en fabricación, el pedido está en
`EN_CURSO`; en acondicionamiento, está en `EN_ACONDICIONAMIENTO` y `conditionedById` es el actor;
en empaque, está en `EN_EMPAQUE` y `packedById` es el actor. «Paso a paso montado» significa que
la pantalla está comenzada por el actor y pinta `StepReader` con al menos un paso.

### Marco

- **R1.** La pantalla del operario DEBE ocupar exactamente el alto de la ventana (`100dvh`), con la
  cabecera arriba y el pie abajo. Solo la zona entre los dos hace scroll: el documento no se
  desplaza y la cabecera y el pie no se mueven al desplazar el contenido.
- **R2.** La cabecera DEBE mostrar:
  - la fase y el número del pedido («Fabricación · 2026-0000003»), con el número en su propio
    elemento;
  - el nombre de la receta como único `h1`, o el texto de receta dada de baja que se usa hoy;
  - un único chip «Cantidad <cifra> <unidad>», sin la unidad si el pedido no la tiene;
  - la insignia de estado con la etiqueta y el tono de `ORDER_STATUS_LABELS` y
    `ORDER_STATUS_TONES`.

  No DEBE mostrar chips de envase, lote, entrega ni presentación, ni la línea «Lo acondiciona …».
- **R3.** MIENTRAS la pantalla no esté comenzada por el actor, la cabecera DEBE mostrar el enlace de
  vuelta habilitado, con la etiqueta y el destino que tiene hoy en cada pantalla y estado.
- **R4.** MIENTRAS la pantalla esté comenzada por el actor, la cabecera NO DEBE contener el enlace
  de vuelta, ni deshabilitado. En su lugar DEBE mostrar una línea con `role="status"` que diga
  «Fabricando», «Acondicionando» o «Empacando», según la pantalla.
- **R5.** SI el pedido de acondicionamiento o de empaque está en curso a nombre de otra persona,
  ENTONCES la cabecera DEBE mostrar el enlace de vuelta habilitado y NO DEBE mostrar la línea de
  R4.
- **R6.** MIENTRAS el paso a paso esté montado, la cabecera DEBE mostrar:
  - una barra con un tramo por paso, con su estado: hecho, actual o pendiente;
  - el texto «Paso N de M», anunciado con `aria-live="polite"`;
  - el porcentaje `round(N / M × 100)` seguido de « %».

  Los tres DEBEN seguir visibles con el contenido desplazado hasta el final.
- **R7.** La cabecera DEBE conservar «Cambiar tema» y, en fabricación, el menú de acciones del
  pedido, con un objetivo táctil de al menos 44 × 44 px.

### Pie

- **R8.** MIENTRAS la pantalla no esté comenzada por el actor y el actor pueda comenzarla, el pie
  DEBE mostrar un único botón, centrado: «Comenzar la fabricación», «Comenzar el
  acondicionamiento» o «Comenzar el empaque». El botón abre el mismo diálogo de confirmación de
  hoy y queda deshabilitado en los mismos casos que hoy.
- **R9.** MIENTRAS el paso a paso esté montado, el pie DEBE mostrar «Anterior» y «Siguiente»,
  centrados y del mismo ancho. En el último paso, en lugar de «Siguiente», DEBE mostrar «Terminar la
  fabricación» o «Terminar el empaque». Encima de los botones va la línea del motivo de bloqueo.
  Bloqueo, espera mínima, evidencia y registro del cambio de paso se comportan igual que hoy.
- **R10.** SI la pantalla está comenzada por el actor y no tiene paso a paso, ENTONCES el pie DEBE
  mostrar un único botón «Terminar el acondicionamiento» o «Terminar el empaque», centrado. Esto
  pasa siempre en acondicionamiento, y en empaque cuando no hay pasos de envasado. El botón queda
  deshabilitado por los mismos motivos que hoy (datos de lote pendientes, pedido sin unidad), con
  el motivo visible y asociado por `aria-describedby`.
- **R11.** Los botones del pie DEBEN medir al menos lo que exige hoy el gate (`MIN_FOOTER_BUTTON_PX`
  de `e2e/operario-rediseno.spec.ts`). Cabecera y pie DEBEN reservar `env(safe-area-inset-*)`.

### Contenido del paso

- **R12.** MIENTRAS el paso a paso esté montado, el paso actual DEBE abrir con una insignia con su
  número y el texto «de M».
- **R13.** MIENTRAS el paso a paso esté montado, cada elemento de una lista de verificación DEBE
  pintarse como una tarjeta de al menos 60 px de alto.
  - Tocar cualquier punto de la tarjeta marca o desmarca el elemento.
  - Una tarjeta marcada lleva el fondo de acento y el texto tachado.
  - La tarjeta sigue siendo una casilla accesible, con su estado y su etiqueta.
- **R14.** DONDE el paso actual tenga elementos que marcar, el contenido DEBE mostrar «Comprueba» y
  el contador «X de Y»: X son los elementos marcados del paso actual e Y, todos los suyos. El
  contador se actualiza al marcar y al desmarcar.
- **R15.** MIENTRAS dure la espera mínima del paso, el contenido DEBE mostrar un bloque con
  `role="status"`, con un anillo que se vacía y la cuenta `MM:SS`. Ni el anillo ni la cuenta van
  dentro del botón primario. El botón primario DEBE seguir deshabilitado, con el motivo asociado.
  CUANDO la espera termina, el bloque DEBE desaparecer.
- **R16.** MIENTRAS el paso a paso esté montado, los párrafos del documento del paso DEBEN pintarse
  como texto de entrada: al menos 17 px con contenedor de más de 560 px y al menos 16 px por debajo.
- **R17.** MIENTRAS la pantalla no esté comenzada por el actor, el contenido principal DEBE mostrar
  la tarjeta «Revisa antes de comenzar» con el texto que explica qué pasa al comenzar en esa
  fase. DONDE la pantalla conozca los pasos antes de comenzar, que hoy es solo fabricación, la
  tarjeta DEBE decir cuántos pasos tiene la receta.
- **R18.** `StepReader` en `mode="lectura"` y cualquier uso que no pase las props nuevas DEBEN
  comportarse exactamente igual que hoy. Sus tests actuales siguen verdes sin cambios.

### Columna lateral (contenedor de más de 1000 px)

- **R19.** MIENTRAS el contenedor de la pantalla mida más de 1000 px, la pantalla DEBE pintar dos
  columnas: una lateral de 320 px con las secciones y otra con el paso o el contenido principal.
- **R20.** Las secciones DEBEN ir en este orden, sin saltarse ninguna presente:
  1. Materiales en fabricación, o Envases en acondicionamiento y empaque.
  2. Herramientas.
  3. Equipo.

  Cada sección es una tarjeta plegable, abierta al entrar, con su icono, su título y su contador.
  La cabecera de la tarjeta va pintada con el color de su sección (ámbar, azul y verde), en claro
  y en oscuro, y su texto cumple contraste AA.
- **R21.** SI la pantalla no tiene herramientas, ENTONCES NO DEBE pintarse ni la tarjeta
  Herramientas ni su botón flotante.
- **R22.** Cada material DEBE conservar el selector de unidad de hoy. La unidad elegida DEBE
  mantenerse al plegar la tarjeta, al cerrar y reabrir el panel, y al pasar de la columna al
  panel.
- **R23.** DONDE la pantalla tenga equipo, que hoy es solo acondicionamiento con equipo no vacío,
  la sección Equipo DEBE agrupar a las personas así:
  - por grupo de trabajo, con su nombre y su número de personas;
  - las personas sueltas bajo «Personas», con su número.

  Cada persona lleva un avatar con sus iniciales (`getInitials`, tono de `avatarTone`) y su
  nombre.
- **R24.** SI una persona del equipo es el actor de la sesión, ENTONCES su fila DEBE llevar la marca
  «Tú». En la fila de cualquier otra persona, la marca NO DEBE aparecer.
- **R25.** En acondicionamiento y en empaque, la sección Envases DEBE mostrar el reparto del pedido
  con el contenido de hoy. En acondicionamiento son las líneas con imagen de envase. En empaque son
  las líneas con imagen, «Sin presentación» si no hay reparto y el aviso de reparto pendiente
  cuando aplica.
- **R26.** DONDE el pedido de acondicionamiento tenga quien lo acondiciona, la frase «Lo acondiciona
  <nombre>.» DEBE mostrarse en el contenido principal, fuera de la cabecera.

### Tablet y teléfono (contenedor de 1000 px o menos)

- **R27.** MIENTRAS el contenedor mida 1000 px o menos, la columna lateral NO DEBE verse. En su
  lugar DEBE aparecer, a la derecha y por encima del pie, una pila de botones redondos flotantes,
  uno por cada sección presente y en el orden de R20. Cada botón:
  - mide al menos 56 × 56 px;
  - lleva el color de su sección;
  - muestra el contador de la sección;
  - tiene el nombre accesible «Ver <sección en minúscula>».
- **R28.** CUANDO se pulsa un botón flotante, DEBE abrirse el panel de su sección. El panel lleva:
  - una cabecera en el color de la sección, con su título y su contador;
  - un botón «Cerrar» (X) de 44 × 44 px.

  El botón flotante refleja el estado del panel en `aria-expanded`.
- **R29.** CUANDO se pulsa «Cerrar», se toca fuera del panel o se pulsa Escape, el panel DEBE
  cerrarse y el foco DEBE volver al botón flotante que lo abrió.
- **R30.** MIENTRAS el contenedor mida 560 px o menos y haya un panel abierto, el panel DEBE ocupar
  el ancho de la pantalla, menos un margen de 16 px a cada lado, y los botones flotantes NO DEBEN
  verse.
- **R31.** MIENTRAS haya un panel abierto, su contenido NO DEBE quedar tapado por el pie. SI no cabe,
  ENTONCES DEBE hacer scroll dentro del panel.

### Lo que no cambia

- **R32.** Las tres pantallas DEBEN conservar las mismas Server Actions, los mismos diálogos de
  confirmación, evidencia y cancelación, el mismo registro de cambios de paso y las mismas
  condiciones de habilitación. El diff de la feature NO DEBE tocar `lib/modules/`, `db/` ni
  `package.json`.

## Preguntas abiertas

Cada una sale de un dato que el tablero pinta y que las vistas de hoy
(`AssignedOrderExecutionView`, `ConditioningOrderDetail`, `PackingOrderDetail`,
`RecipeStepDocument`) no traen. Mientras no se respondan, el spec **omite** ese dato: no lo
inventa.

- **P1. «desde HH:MM».** Ninguna de las tres vistas trae la hora de inicio: no hay `startedAt` en
  `lib/modules/asignaciones`. R4 pinta la línea sin hora. ¿Se queda así o se abre una ficha de
  datos que exponga la hora?
- **P2. Nombre del paso, título grande y texto de entrada.** `RecipeStepDocument` solo trae
  `blocks` y `requiresEvidence`: un paso no tiene nombre. R6 pinta «Paso N de M» sin «· nombre», y
  R12 pinta la insignia sin título. Esto afecta también a la lista de pasos de «Revisa antes de
  comenzar» (R17 solo da el número de pasos). ¿Se omite el nombre o se toma del primer párrafo del
  documento? Lo segundo sería una regla nueva.
- **P3. «En este paso usas».** No hay relación entre un paso y los materiales que usa. El spec no
  pinta el bloque. ¿Va a una ficha de datos?
- **P4. Nota de seguridad.** El documento del paso no tiene un tipo de bloque «nota». El spec no
  pinta la nota. ¿Va a una ficha de datos?
- **P5. Responsables en fabricación y Equipo en empaque.**
  - `AssignedOrderExecutionView` no trae responsables.
  - `PackingOrderDetail` solo trae a quien empaca (`packedById` / `packedByName`), no un equipo.
  - R23 pinta Equipo solo en acondicionamiento.

  ¿Se omite en las otras dos pantallas? ¿O empaque muestra a quien empaca como única persona,
  con la marca «Tú»?
- **P6. Rol de cada persona.** `ConditioningTeamMemberView` trae `userId`, `displayName` y
  `origin`, pero no el rol. R23 pinta solo el nombre. ¿Se omite el rol?
- **P7. Título de la sección ámbar fuera de fabricación.** El tablero dice «Insumos» en
  acondicionamiento y «Envases y etiquetas» en empaque, con datos que no existen: ni insumos de
  acondicionamiento ni etiquetas. El spec usa «Envases» con el reparto (R25). ¿Se confirma?
- **P8. Presentación en fabricación.** Hoy el subtítulo dice «Presentación: …», con el testid
  `order-execution-presentation`. Lo cubre `e2e/envases-del-pedido.spec.ts` («R44: la ejecución
  nombra los envases»). R2 lo quita de la cabecera. Hay dos opciones:
  - quitarlo de la pantalla y borrar esa comprobación del E2E;
  - moverlo a una sección Envases, como en las otras dos pantallas, entre Materiales y
    Herramientas.

  **Bloquea T8 y T12.**
- **P9. Pie sin acción posible.** Hay tres casos en que el actor no puede hacer nada:
  - acondicionamiento o empaque a nombre de otra persona;
  - acondicionamiento `TERMINADO` o `ENTREGADO`;
  - `POR_ACONDICIONAR` sin candidatos.

  Hoy se pintan los dos botones deshabilitados (QC-265 R34; lo comprueban
  `e2e/acondicionar-con-equipo.spec.ts:283-286` y `e2e/acondicionamiento.spec.ts:463-465`). El
  tablero no cubre estos casos. Hay dos opciones:
  - pintar solo «Comenzar …» deshabilitado;
  - no pintar pie.

  **Bloquea T9, T10 y T12.**
- **P10. La cuenta atrás sale del botón.** QC-265 R37 la puso dentro del botón primario, con su
  anillo. El tablero la pinta en el contenido, y R15 la saca del botón. ¿Se confirma que se
  retira del botón?
