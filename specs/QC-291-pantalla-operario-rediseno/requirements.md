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
  contador «N de M», el hueco de la nota de seguridad y la tarjeta «Revisa antes de comenzar». La
  cuenta de espera sigue dentro del botón, como hoy (D13).
- **Columna lateral en escritorio:** las secciones de cada pantalla (D8), en este orden:
  Materiales/Envases, Herramientas y Equipo. Cada tarjeta es plegable y lleva el color de su
  sección en la cabecera. Cada material conserva su selector de unidad. El equipo va agrupado, con
  avatar de iniciales y la marca «Tú».
- **Tablet y teléfono:** botones flotantes redondos, uno por sección, que abren un panel con X.
  En teléfono el panel ocupa el ancho y los botones se ocultan mientras está abierto.

Lo que NO entra:

- Datos nuevos, permisos o cambios en los flujos de comenzar, terminar, cancelar, evidencia o
  registro de pasos. Nada en `lib/modules/` ni en `db/`.
- Lo que el tablero pinta y las vistas de hoy no traen. El humano lo cerró el 2026-10-16 (D4 a
  D10): se omite, sin ficha de datos.

## Decisiones cerradas (no reabrir)

| # | Decisión | Fecha y fuente | Cubierta por |
|---|---|---|---|
| D1 | El diseño de los tableros `OperarioPantalla*` está aprobado y es la referencia visual. | 2026-10-16, humano (pase `/design`, `progress/features/QC-291.md`) | R1-R31, R33, R34 |
| D2 | Es rediseño visual: sin datos, permisos ni cambios de flujo. | 2026-10-16, issue QC-291 | R32 |
| D3 | Ninguna librería nueva. | 2026-10-16, ficha «Librerías: ninguna nueva» del tablero móvil | R32 |
| D4 | (P1) Sin hora de inicio. La línea de estado dice solo «Fabricando», «Acondicionando» o «Empacando». | 2026-10-16, humano | R4 |
| D5 | (P2) Los pasos no tienen nombre. Fuera el nombre del paso de la cabecera, el título grande del paso y la lista de pasos de «Revisa antes de comenzar». La cabecera dice «Paso N de M» y la tarjeta de inicio da el número de pasos. | 2026-10-16, humano | R6, R12, R17 |
| D6 | (P3) Fuera el bloque «En este paso usas». | 2026-10-16, humano | R12 |
| D7 | (P4) El hueco de la nota de seguridad se queda en el diseño, sin contenido ni texto de muestra. Solo se pinta si un paso trae nota. Hoy ningún dato lo alimenta, así que no se ve nada, y no entra trabajo de datos. | 2026-10-16, humano | R34 |
| D8 | (P5) Cada pantalla pinta solo sus secciones y sus botones flotantes: fabricación, Materiales y Herramientas (Herramientas se oculta si no hay); acondicionamiento, Envases y Equipo; empaque, Envases. No hay Equipo en fabricación ni en empaque. | 2026-10-16, humano | R20, R21, R23, R27 |
| D9 | (P6) Sin rol en el equipo. Cada persona lleva avatar de iniciales, nombre y la marca «Tú». | 2026-10-16, humano | R23, R24 |
| D10 | (P7) Se queda como hoy: no existen los datos de «Insumos» ni de «Envases y etiquetas». La sección ámbar de acondicionamiento y empaque es «Envases», con el reparto de hoy. R25 se mantiene. | 2026-10-16, humano | R20, R25 |
| D11 | (P8) Sin presentación en fabricación. Se quita «Presentación: …» (`order-execution-presentation`) de la pantalla y su comprobación de `e2e/envases-del-pedido.spec.ts` («R44: la ejecución nombra los envases»). Enmienda QC-195 R44. | 2026-10-16, humano | R2 |
| D12 | (P9) Si el actor no puede actuar (pedido a nombre de otra persona, `TERMINADO`/`ENTREGADO`, o `POR_ACONDICIONAR` sin candidatos), el pie no lleva botones: solo una línea con el motivo. Se ajustan `acondicionar-con-equipo.spec.ts:283-286` y `acondicionamiento.spec.ts:463-465`. Enmienda QC-265 R34. | 2026-10-16, humano | R8, R33 |
| D13 | (P10) La cuenta atrás de la espera se queda en el botón, como en QC-265 R37. Sin cambios ahí. | 2026-10-16, humano | R15 |
| 2026-10-16 | P11: ¿textos de la línea de motivo de R33? (F1.4) | Se aprueban los propuestos: los textos existentes de «Lo acondiciona <nombre>.» y del empacador; «Este pedido ya está acondicionado.»; «Este pedido ya está entregado.»; «No se pudo cargar el equipo para comenzar.». |
| 2026-10-16 | ¿Spec aprobado? | Sí, por el humano en F1.4, incluidas las enmiendas a QC-195 R44 y QC-265 (`design.md > 1.1`). |
| 2026-10-16 | Bloqueo B1 del implementer: el ámbar y el verde claros no llegan a 4,5:1 (F2.1) | Se oscurecen manteniendo croma y tono: materiales `oklch(0.57 0.15 55)` (4,56) y equipo `oklch(0.54 0.13 160)` (4,57). El umbral de T3 sigue en 4,5:1. Tablero actualizado. |
| 2026-10-16 | Bloqueo B2 del implementer: la lista cerrada de QC-125 R18 solo admite `step-reader.tsx` (F2.1) | Se amplía con `components/shared/step-reader/step-document-view.tsx` y `components/shared/step-reader/index.ts`. Enmienda QC-125; T12 anota la enmienda fechada en su spec. |
| 2026-10-17 | Review vuelta 1, M2: E2E en rojo heredados de commits anteriores (envases-del-pedido, acondicionamiento, empaque, pedido-en-varias-presentaciones, datos-de-lote-en-acondicionamiento, recorrido-acondicionamiento) | Se arreglan los 6 en esta rama, actualizando los specs a la conducta vigente de `origin/dev`. No se anotan en el baseline. |
| 2026-10-17 | Review vuelta 1, M3: QC-269 R4, R5 y R6 quedan contradichos | Se enmiendan, con notas fechadas bajo esos requisitos y una fila en `design.md > 1.1`. |
| 2026-10-17 | Review vuelta 1, m1: la tarjeta «Revisa antes de comenzar» de empaque sale con el pedido a nombre de otra persona | Solo sale cuando el actor puede comenzar (`canStart`), igual que en acondicionamiento. R17 se aclara en ese sentido. |

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
  En fabricación, la presentación del pedido («Presentación: …», `order-execution-presentation`)
  NO DEBE aparecer en ningún punto de la pantalla.
- **R3.** MIENTRAS la pantalla no esté comenzada por el actor, la cabecera DEBE mostrar el enlace de
  vuelta habilitado, con la etiqueta y el destino que tiene hoy en cada pantalla y estado.
- **R4.** MIENTRAS la pantalla esté comenzada por el actor, la cabecera NO DEBE contener el enlace
  de vuelta, ni deshabilitado. En su lugar DEBE mostrar una línea con `role="status"` que diga
  exactamente «Fabricando», «Acondicionando» o «Empacando», según la pantalla, sin hora de inicio.
- **R5.** SI el pedido de acondicionamiento o de empaque está en curso a nombre de otra persona,
  ENTONCES la cabecera DEBE mostrar el enlace de vuelta habilitado y NO DEBE mostrar la línea de
  R4.
- **R6.** MIENTRAS el paso a paso esté montado, la cabecera DEBE mostrar:
  - una barra con un tramo por paso, con su estado: hecho, actual o pendiente;
  - el texto «Paso N de M», sin nombre del paso, anunciado con `aria-live="polite"`;
  - el porcentaje `round(N / M × 100)` seguido de « %».

  Los tres DEBEN seguir visibles con el contenido desplazado hasta el final.
- **R7.** La cabecera DEBE conservar «Cambiar tema» y, en fabricación, el menú de acciones del
  pedido, con un objetivo táctil de al menos 44 × 44 px.

### Pie

- **R8.** MIENTRAS la pantalla no esté comenzada por el actor y el actor pueda comenzarla, el pie
  DEBE mostrar un único botón, centrado: «Comenzar la fabricación», «Comenzar el
  acondicionamiento» o «Comenzar el empaque». El botón abre el mismo diálogo de confirmación de
  hoy y queda deshabilitado en los mismos casos que hoy, salvo los de R33, que no pintan botón.
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
  número y el texto «de M». El contenido del paso NO DEBE mostrar un título grande con el nombre
  del paso ni el bloque «En este paso usas».
- **R13.** MIENTRAS el paso a paso esté montado, cada elemento de una lista de verificación DEBE
  pintarse como una tarjeta de al menos 60 px de alto.
  - Tocar cualquier punto de la tarjeta marca o desmarca el elemento.
  - Una tarjeta marcada lleva el fondo de acento y el texto tachado.
  - La tarjeta sigue siendo una casilla accesible, con su estado y su etiqueta.
- **R14.** DONDE el paso actual tenga elementos que marcar, el contenido DEBE mostrar «Comprueba» y
  el contador «X de Y»: X son los elementos marcados del paso actual e Y, todos los suyos. El
  contador se actualiza al marcar y al desmarcar.
- **R15.** MIENTRAS dure la espera mínima del paso, el botón primario del pie DEBE seguir
  deshabilitado y llevar dentro el anillo y la cuenta, igual que hoy (QC-265 R37), con el motivo
  asociado. El contenido del paso NO DEBE mostrar un bloque de espera aparte.
- **R16.** MIENTRAS el paso a paso esté montado, los párrafos del documento del paso DEBEN pintarse
  como texto de entrada: al menos 17 px con contenedor de más de 560 px y al menos 16 px por debajo.
- **R17.** MIENTRAS la pantalla no esté comenzada por el actor, el contenido principal DEBE mostrar
  la tarjeta «Revisa antes de comenzar» con el texto que explica qué pasa al comenzar en esa
  fase. DONDE la pantalla conozca los pasos antes de comenzar, que hoy es solo fabricación, la
  tarjeta DEBE decir cuántos pasos tiene la receta. La tarjeta NO DEBE listar los pasos.
- **R18.** `StepReader` en `mode="lectura"` y cualquier uso que no pase las props nuevas DEBEN
  comportarse exactamente igual que hoy. Sus tests actuales siguen verdes sin cambios.

### Columna lateral (contenedor de más de 1000 px)

- **R19.** MIENTRAS el contenedor de la pantalla mida más de 1000 px, la pantalla DEBE pintar dos
  columnas: una lateral de 320 px con las secciones y otra con el paso o el contenido principal.
- **R20.** Cada pantalla DEBE pintar solo sus secciones, en este orden:
  - fabricación: Materiales y Herramientas;
  - acondicionamiento: Envases y Equipo;
  - empaque: Envases.

  Ninguna otra sección DEBE aparecer: ni Herramientas en acondicionamiento o empaque, ni Equipo
  en fabricación o empaque. Cada sección es una tarjeta plegable, abierta al entrar, con su icono, su título y su contador.
  La cabecera de la tarjeta va pintada con el color de su sección (ámbar, azul y verde), en claro
  y en oscuro, y su texto cumple contraste AA.
- **R21.** SI la pantalla de fabricación no tiene herramientas, ENTONCES NO DEBE pintarse ni la
  tarjeta Herramientas ni su botón flotante.
- **R22.** Cada material DEBE conservar el selector de unidad de hoy. La unidad elegida DEBE
  mantenerse al plegar la tarjeta, al cerrar y reabrir el panel, y al pasar de la columna al
  panel.
- **R23.** DONDE el pedido de acondicionamiento tenga equipo no vacío, la sección Equipo DEBE
  agrupar a las personas así:
  - por grupo de trabajo, con su nombre y su número de personas;
  - las personas sueltas bajo «Personas», con su número.

  Cada persona lleva un avatar con sus iniciales (`getInitials`, tono de `avatarTone`) y su
  nombre. La fila NO DEBE mostrar rol. SI el equipo está vacío, ENTONCES NO DEBE pintarse ni la
  tarjeta Equipo ni su botón flotante.
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
  uno por cada sección que pinta esa pantalla (R20, R21, R23) y en ese orden. Cada botón:
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

### Añadidos en la revisión del 2026-10-16

- **R33.** SI el actor no puede actuar sobre el pedido, ENTONCES el pie NO DEBE mostrar ningún
  botón, ni deshabilitado, y DEBE mostrar solo una línea con `role="status"` que diga el motivo.
  Los casos son:
  - acondicionamiento o empaque en curso a nombre de otra persona;
  - acondicionamiento en `TERMINADO` o `ENTREGADO`;
  - acondicionamiento en `POR_ACONDICIONAR` sin candidatos para el equipo.
- **R34.** DONDE el paso actual traiga una nota de seguridad, el contenido del paso DEBE pintarla
  debajo de las comprobaciones, con `role="note"` y el icono de aviso del tablero. SI el paso no
  trae nota, ENTONCES el contenido NO DEBE pintar el bloque, ni vacío ni con texto de muestra.
  Hoy ninguna pantalla pasa notas: en las tres, el bloque no aparece.

## Preguntas abiertas

Ninguna. P11 cerrada por el humano en F1.4 (ver «Decisiones cerradas»).
