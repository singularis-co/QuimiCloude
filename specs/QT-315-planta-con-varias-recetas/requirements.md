# QT-315 — planta-con-varias-recetas · requirements.md

> **Zona:** fullstack · **Complejidad:** high · **depends_on:** QT-313 (y la rama nace de QT-314, PR #319) · **Rama:** `feature/QT-315-planta-con-varias-recetas`
>
> **Alcance.** Las pantallas de planta pasan a trabajar por **receta** del pedido. Cada receta se elige y avanza por su lado.
> - **Pantallas:** ejecución del operario, empaque y acondicionamiento.
> - **Listas de Asignación:** una fila por receta.
> - **Dashboard de recorridos y Recorrido de un pedido:** cada pedido muestra el detalle de sus recetas.
> - **Backend:** las acciones y los casos de uso de `asignaciones` reciben la receta (la línea) en vez de buscar «la única receta» del pedido en un estado.
> - **E2E:** un pedido de dos recetas recorre planta de punta a punta.
>
> **Lo que NO entra.**
> - La entrega: en planta no existe y no se crea. Ya es por receta desde Pedidos (QT-314) y está la entrega directa de Inventario.
> - El alta, la edición y la consulta del pedido: QT-314.
> - El rediseño visual de las pantallas del operario: QC-291. Se adapta a varias recetas al integrar `dev`, después de esta ficha.
> - Los avisos QC-293 y QC-294.
> - Las evidencias del lote en Inventario › Producto terminado: van a **QT-316**
>   `evidencias-del-lote-por-receta`, que depende de esta ficha (decisión P4).
>
> Sembrado por `/afinar-feature` el 2026-11-09. El bloque de Alcance y la tabla de «Decisiones cerradas» los fijó el humano ANTES del spec. `spec_author` los respeta, no los reabre y no los reescribe: su trabajo aquí es `## Requisitos (EARS)`.

## Requisitos (EARS)

> Escritos por `spec_author` (F1.2, 2026-11-09). Vocabulario:
> - **Receta**: una línea del pedido (QT-313). «Receta» y «línea» son lo mismo visto desde planta
>   y desde el modelo.
> - **Receta viva**: no quitada. Una receta cancelada sigue viva.
> - **Pantalla de una receta**: la de ejecución (`/asignacion/…`), la de empaque
>   (`/asignacion/empaque/…`) o la de acondicionamiento (`/asignacion/acondicionamiento/…`).
> - **Acción de planta**: comenzar o retomar, avanzar o retroceder un paso, finalizar la
>   fabricación, cancelar desde la ejecución, comenzar o terminar el empaque, comenzar o terminar
>   el acondicionamiento, anotar un paso de acondicionamiento, cambiar sus responsables, guardar
>   los datos de lote, y pedir, registrar, reemplazar o quitar una foto de evidencia.
> - **Listas de Asignación**: «Mis asignados», «Terminados», «Todos», «Por empacar», «Por
>   acondicionar» y «Acondicionados».
> - Entre corchetes, la fila de `## Decisiones cerradas` que cubre cada requisito.

### Listas de Asignación

- **R1** — CUANDO se pinta una lista de Asignación, el sistema DEBE mostrar **una fila por
  receta** que cumpla el filtro de esa vista, con el nombre, la cantidad, el reparto y el estado
  **de esa receta**, y el número, la prioridad y los responsables del pedido.
  *[¿Cómo trabaja el operario un pedido de varias recetas?]*
- **R2** — SI un pedido tiene dos o más recetas que cumplen el filtro de la misma vista,
  ENTONCES esa lista DEBE mostrar una fila distinta por cada una, cada fila con su propio
  «Entrar»; el contador de la pestaña y la paginación DEBEN contar recetas, no pedidos.
  *[¿Cómo trabaja el operario…?]*
- **R3** — DONDE el pedido tiene más de una receta viva, la fila DEBE mostrar «Receta N de M» bajo
  el nombre de la receta, con N la posición de esa receta entre las vivas del pedido en su orden
  de alta y M el número de recetas vivas, **canceladas incluidas**, aunque el avance «F de T»
  (R21, R25) no las cuente. Un pedido de una sola receta viva NO DEBE mostrarlo.
  *[¿Cómo trabaja el operario…? · Pase `/design` aprobado · P1]*
- **R4** — CUANDO se pulsa «Entrar» en una fila, el sistema DEBE abrir la pantalla que esa vista
  abre hoy (ejecución, empaque o acondicionamiento), **de esa receta**, con la receta identificada
  en la dirección. *[¿Cómo trabaja el operario…?]*
- **R5** — Asignar responsables, desasignar a uno o quitar un grupo desde una fila DEBE actuar
  sobre el **pedido entero**, con las reglas de QT-313 R35 y R55 sin cambios, sea cual sea la
  receta de la fila. *[Reglas de estado y responsables]*

### Pantalla de una receta

- **R6** — La pantalla de una receta DEBE mostrar los pasos, las líneas, las herramientas, el
  reparto, las fotos de evidencia, el equipo, los datos de lote y los avisos **de la receta de la
  dirección**, y NO DEBE mostrar datos de otra receta del mismo pedido.
  *[¿Cómo trabaja el operario…? · ¿Una ficha o dos?]*
- **R7** — La cabecera de la pantalla de una receta DEBE nombrar la fase, el número del pedido, el
  nombre de la receta, su cantidad, su reparto y su estado, y DONDE el pedido tiene más de una
  receta viva, también «Receta N de M» con la regla de R3. *[Pase `/design` aprobado]*
- **R8** — DONDE el pedido tiene más de una receta viva, la pantalla DEBE listar las **otras**
  recetas vivas del pedido con su nombre y su estado, en su orden de alta. Para cada una DEBE
  ofrecer «Ir a esta receta», que lleva a la pantalla que corresponde a su estado (ejecución con
  `PENDIENTE` o `EN_CURSO`; empaque con `POR_EMPACAR` o `EN_EMPAQUE`; acondicionamiento con
  `POR_ACONDICIONAR` o `EN_ACONDICIONAMIENTO`), solo SI quien mira tiene el permiso que esa
  pantalla exige (R15). En cualquier otro estado (cancelada, terminada, `BLOQUEADO` o `ENTREGADO`)
  NO DEBE ofrecerlo. *[Pase `/design` aprobado · P2]*
- **R9** — SI la dirección de una pantalla de receta no nombra ninguna receta, o nombra una de
  otro pedido, de otra empresa, quitada o inexistente, ENTONCES el sistema DEBE responder como
  hoy ante un pedido inexistente (página no encontrada), sin mostrar datos de ningún pedido.
  *[Receta ajena o inexistente en la ruta]*
- **R10** — La pantalla de una receta DEBE decidir qué muestra y qué acciones ofrece por el
  **estado de esa receta** y por quién la empaca o acondiciona, con las mismas reglas que hoy
  aplica al estado del pedido; el estado del pedido (también `PARCIAL`) y el de las otras recetas
  NO DEBEN influir. *[Reglas de estado y responsables]*

### Acciones de planta

- **R11** — CUANDO se ejecuta una acción de planta, el sistema DEBE operar sobre la receta que la
  acción nombra y NO DEBE cambiar el estado, el registro de ejecución, las fotos, el equipo, los
  lotes ni los datos de lote de ninguna otra receta del pedido. *[¿Una ficha o dos? · Reglas de
  estado y responsables]*
- **R12** — El sistema NO DEBE rechazar ninguna acción ni lectura de planta porque el pedido tenga
  más de una receta en el mismo estado. *[¿Una ficha o dos?]*
- **R13** — Las lecturas que deciden o pintan una acción de planta (la última posición anotada al
  retomar, el avance de los pasos de acondicionamiento, el equipo, las fotos de un paso y su tope
  por paso, los lotes y sus datos de lote) DEBEN tomar **solo** los datos de la receta nombrada.
  *[¿Una ficha o dos? · Reglas de estado y responsables]*
- **R14** — SI una acción de planta no nombra receta, ENTONCES el sistema DEBE rechazarla con
  `invalid_input`, sin leer ni escribir datos del pedido. SI nombra una receta de
  otro pedido, de otra empresa, quitada o inexistente, ENTONCES DEBE responder `order_not_found`
  sin escribir nada. *[Receta ajena o inexistente en la ruta]*
- **R15** — Cada acción y cada lectura de planta DEBE exigir el mismo permiso que exige hoy
  (`asignaciones.*`, `empaque.modificar`, `acondicionamiento.modificar`, `dashboard.consultar`),
  validado en el caso de uso antes de leer ningún dato; quien es responsable del pedido DEBE poder
  ejecutar cualquiera de sus recetas. El catálogo de permisos NO DEBE cambiar.
  *[Permisos · Reglas de estado y responsables]*

### Cancelar desde la ejecución

- **R16** — CUANDO un responsable cancela desde la ejecución una receta en estado cancelable con un
  motivo de 1 a 500 caracteres una vez recortado, el sistema DEBE dejar **esa receta** en
  `CANCELADO` con ese motivo, liberar todo su material, anotar la cancelación en el registro de
  esa receta y volver a derivar el estado del pedido, todo en una transacción, sin cambiar el
  estado, el material ni el coste de las demás recetas. *[Cancelar desde la ejecución]*
- **R17** — SI la receta que se cancela no está en un estado cancelable, ENTONCES el sistema DEBE
  rechazar con `not_cancellable`; SI el motivo falta, está vacío o pasa de 500 caracteres,
  ENTONCES DEBE rechazar con `invalid_input`; en los dos casos sin escribir nada.
  *[Cancelar desde la ejecución]*
- **R18** — La pantalla de ejecución DEBE ofrecer «Cancelar esta receta» solo con la receta en
  `PENDIENTE` o `EN_CURSO`, con un diálogo que nombra la receta y el pedido, pide el motivo y avisa
  de que las demás recetas siguen. CUANDO la cancelación sale bien, DEBE volver a la lista con un
  aviso de receta cancelada. *[Cancelar desde la ejecución · Pase `/design` aprobado]*

### Avisos y nombres

- **R19** — CUANDO se finaliza la fabricación de una receta, el sistema DEBE volver a la lista con
  un aviso de que esa receta del pedido quedó **por empacar**. Ni el aviso ni el parámetro de la
  dirección que lo anuncia DEBEN llamarse ni decir «entregado». *[Restos de nombres viejos]*
- **R20** — Los avisos de vuelta a la lista (fabricada, empacada, acondicionada, cancelada) DEBEN
  nombrar el pedido y, DONDE el pedido tiene más de una receta viva, también la receta.
  *[¿Cómo trabaja el operario…? · Restos de nombres viejos]*

### Dashboard de recorridos

- **R21** — El Dashboard de recorridos DEBE mostrar **una fila por pedido**, con el estado del
  pedido («Parcial» con tono `progress`), la primera receta y «+N más» con la misma regla que el
  listado de Pedidos (QT-314), y el avance «F de T» con su barra, igual que el listado de Pedidos.
  *[Dashboard y Recorrido · Reglas de estado y responsables]*
- **R22** — Las presentaciones de una fila del Dashboard DEBEN salir agrupadas por receta, en el
  orden de alta de las recetas, sin sumar ni intercalar presentaciones de recetas distintas.
  *[Dashboard y Recorrido]*
- **R23** — La duración de una fila del Dashboard DEBE ser la suma de las duraciones de sus
  recetas, y DEBE mostrarse abierta si alguna de ellas lo está. *[Dashboard y Recorrido]*
- **R24** — Para un pedido dado de baja, el Dashboard y el Recorrido DEBEN tomar como sus recetas
  las que el pedido tenía vivas en el momento de la baja. *[Dashboard y Recorrido]*

### Recorrido de un pedido

- **R25** — El Recorrido de un pedido DEBE mostrar un resumen del pedido (estado, avance «F de T
  terminadas» y duración total) y, debajo, **una sección por receta** en su orden de alta, con su
  nombre, su estado, su cantidad, su reparto, su duración, sus vueltas atrás y su línea de tiempo
  (fabricación, empaque y acondicionamiento) con sus anotaciones, su equipo, sus responsables por
  paso, sus datos de lote y sus fotos. Una receta sin ninguna anotación NO DEBE tener sección,
  pero DEBE contar en el avance del resumen. *[Dashboard y Recorrido · P3]*
- **R26** — Ninguna sección del Recorrido DEBE mostrar anotaciones, fotos, equipo ni presentaciones
  de otra receta. *[Dashboard y Recorrido]*
- **R27** — El sistema DEBE medir las duraciones de fase **por receta**: una fase cuenta como
  abierta si la receta está en el estado de esa fase y el pedido no está dado de baja, aunque el
  pedido esté en `PARCIAL`. *[Dashboard y Recorrido · Reglas de estado y responsables]*
- **R28** — Una receta cancelada que tiene sección DEBE mostrarse con su estado «Cancelado» y su
  línea de tiempo hasta la cancelación. *[Dashboard y Recorrido · Cancelar desde la ejecución]*

### Compatibilidad, multiplataforma y verificación

- **R29** — MIENTRAS un pedido tenga una sola receta viva, las listas, las pantallas, las acciones,
  el Dashboard y el Recorrido DEBEN dar los mismos datos y comportarse como hoy, salvo la receta
  en la dirección y la sección única del Recorrido: sin «Receta N de M» y sin «Otras recetas».
  *[Pase `/design` aprobado · ¿Una ficha o dos?]*
- **R30** — En el teléfono, las listas de Asignación DEBEN pasar a tarjetas con «Receta N de M» y
  un «Entrar» de al menos 44 × 44 px; la cabecera de la receta y las secciones del Recorrido DEBEN
  apilarse en una columna. *[Pase `/design` aprobado]*
- **R31** — Ninguna pantalla de planta DEBE ofrecer entregar una receta ni un pedido.
  *[Entrega desde planta]*
- **R32** — Esta ficha NO DEBE añadir tablas, columnas, migraciones, permisos ni dependencias:
  `db/schema.prisma`, `db/migrations/`, el catálogo de permisos y las dependencias de
  `package.json` DEBEN quedar como en la rama base. *[¿Una ficha o dos? · Permisos · ¿Librería
  nueva?]*
- **R33** — Un recorrido E2E DEBE llevar un pedido de **dos** recetas por planta de punta a punta,
  con las dos avanzando por su lado: fabricar, empacar y acondicionar cada una, comprobar en cada
  paso que la otra receta no cambia de estado, y comprobar el Dashboard («+1 más», «1 de 2» y
  «2 de 2») y el Recorrido con sus dos secciones. Los E2E de planta que ya existen DEBEN seguir
  pasando, adaptados a la receta en la dirección. *[¿Hace falta E2E?]*
- **R34** — Esta ficha NO DEBE cambiar la consulta de evidencias del lote en Inventario ›
  Producto terminado: DEBE seguir devolviendo las fotos del pedido como en la rama base. Su
  separación por receta es de QT-316. *[P4]*

### Cobertura de la tabla de decisiones

| Decisión (fila) | Requisitos |
|---|---|
| ¿Cómo trabaja el operario un pedido de varias recetas? | R1, R2, R3, R4, R6, R20 |
| Entrega desde planta | R31 (la descripción de la tarjeta ya se corrigió al acotar) |
| Dashboard y Recorrido | R21, R22, R23, R24, R25, R26, R27, R28 |
| Orden con QC-291 | Sin requisito: decisión de proceso. El spec no depende de nada de QC-291 (`design.md` § 9) |
| ¿Una ficha o dos? | R6, R11, R12, R13, R29, R32 |
| Cancelar desde la ejecución | R16, R17, R18, R28 |
| Reglas de estado y responsables | R5, R10, R11, R13, R15, R21, R27 |
| Permisos | R15, R32 |
| Receta ajena o inexistente en la ruta | R9, R14 |
| ¿Hace falta E2E? | R33 |
| Pase `/design` (obligatorio, lo que tiene que cubrir) | R1, R3 (listas por receta), R7 (cabecera con la receta), R21 (Dashboard con «+N más» y avance), R25 (Recorrido por secciones) |
| Restos de nombres viejos | R19, R20 (el comentario de `finishPackingAction` se corrige en T6; lo verifica el reviewer) |
| ¿Librería nueva? | R32 |
| Pase `/design` (aprobado) | R3, R7, R8, R18, R29, R30 |
| P1 — «Receta N de M» cuenta las canceladas | R3, R7 |
| P2 — destino y visibilidad de «Ir a esta receta» | R8 |
| P3 — receta sin anotaciones en el Recorrido | R25 |
| P4 — evidencias del lote en Inventario fuera (QT-316) | R34 |

## Preguntas abiertas

Ninguna. P1–P4 cerradas en la tabla de abajo.

## Decisiones cerradas (no reabrir)

| Fecha | Pregunta | Decisión |
|---|---|---|
| 2026-11-09 | ¿Cómo trabaja el operario un pedido de varias recetas? | **Una fila por receta.** Cada lista de Asignación (asignados, terminados, todos, por empacar, por acondicionar, acondicionados) muestra una fila por receta, por ejemplo «#1042 · Hipoclorito 5 %», con el estado de esa receta. Al entrar se abre la pantalla de ejecución, empaque o acondicionamiento **de esa receta**, que viaja en la ruta. Con dos recetas en el mismo estado salen dos filas distintas, cada una con su destino. |
| 2026-11-09 | Entrega desde planta | **No entra.** En planta no hay entrega y no se crea. La entrega por receta ya está en Pedidos (QT-314). Se corrige la descripción de la tarjeta. |
| 2026-11-09 | Dashboard y Recorrido | **Pedido con secciones.** En el Dashboard, una fila por pedido con «primera receta +N más» y el avance «N de M», igual que el listado de Pedidos (QT-314). El Recorrido de un pedido se separa en una sección por receta, cada una con sus fases (producción, empaque y acondicionamiento), sus pasos, sus evidencias y su reparto. Las presentaciones dejan de mezclarse entre recetas. |
| 2026-11-09 | Orden con QC-291 | **QT-315 primero**, sobre las pantallas de hoy. QC-291, el rediseño visual que está en vuelo y es del mismo dueño, se adapta a varias recetas cuando integre `dev`. |
| 2026-11-09 | ¿Una ficha o dos? | **Una ficha fullstack** (complexity high). El backend es mecánico: la receta viaja de punta a punta y se quita la búsqueda de «la única receta» (`onlyLineOf` / `findOnlyLine`). No hay modelo ni migraciones nuevos. |
| 2026-11-09 | Cancelar desde la ejecución | **Solo esa receta**, con motivo. Libera su material y las demás recetas siguen. Es la misma regla que «Cancelar receta» de Pedidos (QT-313 R27 y R28). |
| 2026-11-09 | Reglas de estado y responsables | Heredado de QT-313, sin reabrir: cada receta tiene su estado y sus transiciones; los responsables (operador y empacador) son del pedido entero y pueden ejecutar cualquiera de sus recetas (R35); en `PARCIAL`, los responsables solo se pueden cambiar si queda alguna receta activa en PENDIENTE, EN_CURSO o BLOQUEADO (R55); «Parcial» se muestra con tono `progress`. |
| 2026-11-09 | Permisos | Heredado: los de hoy de `asignaciones` (operador, empacador, acondicionador). **No nace ningún permiso nuevo.** La autorización se valida en el caso de uso. |
| 2026-11-09 | Receta ajena o inexistente en la ruta | Heredado de QT-313 R43: una receta de otro pedido, de otra empresa o quitada se trata igual que un pedido inexistente. |
| 2026-11-09 | ¿Hace falta E2E? | **Sí.** Mueve inventario (`CHECKPOINTS.md`). Un pedido de **dos** recetas recorre planta de punta a punta: ejecución, empaque y acondicionamiento de cada una, con las dos avanzando por su lado. Los E2E de planta que ya existen se adaptan (decisión P5 de QT-313). |
| 2026-11-09 | Pase `/design` | **Obligatorio** antes del spec (`docs/perfil-agentes.md`). Tiene que cubrir: las listas de Asignación por receta, la cabecera de ejecución, empaque y acondicionamiento con la receta, el Dashboard con «+N más» y avance, y el Recorrido con secciones por receta. |
| 2026-11-09 | Restos de nombres viejos | **Entran:** el comentario de `finishPackingAction` («Deja el pedido ENTREGADO») y el aviso «delivered» de `finishAssignedOrderAction` (`DELIVERED_ORDER_PARAM`) se corrigen para que digan lo que pasa de verdad. |
| 2026-11-09 | ¿Librería nueva? | **No.** |
| 2026-11-09 | Pase `/design` | **Aprobado por el humano el 2026-11-09.** Tableros: `docs/diseno/canvas/PlantaVariasRecetas.dc.html`, `PlantaVariasRecetasTablet.dc.html` y `PlantaVariasRecetasMovil.dc.html`. El de escritorio es interactivo y cubre Asignación por receta, la pantalla de una receta (con cancelar receta), Recorridos y el Recorrido del pedido por secciones; el de teléfono lleva además la ficha. Están en el canvas del proyecto, página «6 · Operario», y `design.md` los cita. |
| 2026-11-09 | P1 — «Receta N de M»: ¿cuentan las recetas canceladas? | **Sí, cuentan**, como «+N más» y el detalle de QT-314: M son las recetas vivas, canceladas incluidas, y N la posición en el orden de alta. El avance «F de T» sigue sin contarlas. |
| 2026-11-09 | P2 — «Ir a esta receta»: ¿a qué pantalla lleva y quién lo ve? | **A la pantalla que corresponde al estado de esa receta** (ejecución, empaque o acondicionamiento), **solo si quien mira tiene permiso para esa pantalla**. No aparece si la receta está `BLOQUEADO` o `ENTREGADO` (ni cancelada o terminada). La pantalla de destino aplica sus reglas de hoy. |
| 2026-11-09 | P3 — Recorrido: ¿tiene sección una receta sin anotaciones? | **No tiene sección; solo cuenta en el avance** del resumen. |
| 2026-11-09 | P4 — Evidencias del lote en Inventario › Producto terminado | **Fuera de QT-315.** Van a la ficha **QT-316** `evidencias-del-lote-por-receta`, ya creada en el board, que depende de QT-315. |
