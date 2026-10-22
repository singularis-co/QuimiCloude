# QC-261 — Rediseño de Dashboard y recorrido

## Alcance

Llevar `/dashboard`, `/dashboard/recorrido/[id]` y la página no encontrada de la zona privada al
diseño aprobado del canvas (tableros `Dashboard`, `DashboardTablet`, `DashboardMovil`, `Recorrido`,
`RecorridoTablet`, `RecorridoMovil`, `NoEncontrada`, `NoEncontradaTablet` y `NoEncontradaMovil`,
copiados en `docs/diseno/canvas/`), en escritorio (1440), tablet (820) y teléfono (390). Fuente de
las decisiones: `progress/rediseno.md` (D2, D3, D9, D14) y la ficha QC-261 del board.

Lo que entra:

- «Ver recorrido» sale de la celda y pasa al menú ⋯ de la fila (D2).
- «Volver a la lista» pasa de enlace subrayado a botón con flecha (D2).
- Los estados del pedido, las marcas y las vueltas atrás se pintan con `StatusBadge` (D3).
- Las anotaciones del recorrido se pintan como línea de tiempo, con tres datos (Estado, Duración,
  Vueltas atrás) encima.
- En teléfono, la tabla del dashboard se ve como tarjetas y «Acciones» abre el menú centrado (D2).
- La página no encontrada privada con el estado vacío del tablero.
- `PageShell` y `PageHeader` en las dos pantallas del dashboard.

Lo que NO entra:

- Ningún cambio de backend ni de lógica: ni `lib/`, ni `db/`, ni `middleware.ts`, ni los casos de
  uso de `asignaciones`, ni los parámetros de URL, ni el cálculo de duración, tramos o vueltas atrás
  (QC-167).
- El total de pasos en la posición («Paso X de Y»): el registro no lo trae (ver P7).
- Cambiar el umbral de tarjetas de `DataTable` ni el aspecto de `ErrorState` (ver P5 y
  `design.md > 8`).
- El ítem activo de la barra lateral en la página no encontrada (es del shell, QC-257).
- La raíz `/` (QC-257, D11).

## Decisiones cerradas (no reabrir)

La ficha llegó sin `/afinar-feature`. Estas filas salen de decisiones del humano ya escritas; las
dudas que quedan van en `## Preguntas abiertas`.

| # | Decisión | Fuente | Requisitos |
|---|---|---|---|
| C1 | El diseño de las tres pantallas es el de sus nueve tableros; lo demás del canvas queda aprobado | humano, 2026-10-10 (D14) | R1–R21 |
| C2 | Acciones de fila siempre en el menú ⋯; en teléfono la tabla pasa a tarjetas y «Acciones» abre el menú centrado; «Ver recorrido» y «Volver…» nunca son enlaces de texto | humano, 2026-10-10 (D2) | R7, R8, R11 |
| C3 | Un único `StatusBadge` y un único mapa de etiquetas por dominio; tonos por significado (Por empacar/Por acondicionar ámbar, En curso con punto que late, Cancelado y Dado de baja apagados…) | humano, 2026-10-10 (D3) | R4, R5, R6, R13 |
| C4 | Textos con tildes y sin voseo | humano, 2026-10-10 (D9) | R21 |
| C5 | Solo presentación: el comportamiento de QC-167 (filtros en la URL, paginación, permisos, 404, duración, tramos, vueltas atrás, marcas) no cambia; si el diseño pide lógica nueva, va a preguntas abiertas | encargo de la ficha (frontend, low), 2026-10-12 | R2, R18, R22, R24 |
| C6 | Se reutiliza antes de crear (reutiliza, extiende, compón, crea) y toda pieza nueva o con cambio visual cita su tablero | humano, 2026-10-10 (regla dura) | R23 |
| C7 | El dashboard conserva las garantías de QC-12 / QC-167 R25: un único `h1`, ningún landmark nuevo, `dashboard-content` con la lista y nada más | QC-167 R25 (cerrado) | R1 |
| C8 | La página no encontrada no delata permisos ni módulos y no resuelve «la primera pantalla disponible» | QC-75 R7, R9 (cerrado) | R19 |
| C9 | Se quita el chip «En curso» de actividad bajo el número del pedido y junto al estado del detalle; se conservan «Dado de baja», la marca de fase abierta y el sufijo « (en curso)» de la duración. Enmienda aprobada por el usuario, sin tarjeta (commit `0f135128`) | usuario, 2026-10-16 | R6, R21 |
| C10 | El estado `EN_CURSO` se lee «En fabricación» (antes «En curso»); solo cambia el texto, no el código ni el tono. Enmienda aprobada por el usuario, sin tarjeta (commit `440ff5b2`, #256) | usuario, 2026-10-16 | R4 |

## Requisitos (EARS)

> «La lista» es la del área de contenido de `/dashboard`; «el detalle», la página
> `/dashboard/recorrido/[id]`; «anotación», «tramo», «activo» y «dado de baja» tienen el sentido de
> `specs/QC-167-recorrido-de-ejecucion-en-el-dashboard/requirements.md > Vocabulario`.

### Dashboard

**R1.** El sistema DEBE pintar `/dashboard` dentro del contenedor de página compartido, con un único
`h1` «Dashboard» (`data-testid="dashboard-title"`) y, en el área `dashboard-content`, un único
bloque con el `h2` «Recorridos de ejecución» y la lista; la pantalla NO DEBE añadir ningún landmark
(ni `section` con nombre, ni `region`) y el `main` del layout privado DEBE seguir siendo único.

**R2.** El sistema DEBE ofrecer en la barra de la lista el buscador «Buscar por número de pedido»
(rol `searchbox`), la casilla «Solo cancelados» (rol `checkbox` con ese nombre accesible) y los
filtros «Personas» y «Última anotación», y CUANDO se usa cualquiera de ellos DEBE navegar a la misma
dirección que hoy, carácter a carácter (QC-167 R6–R11).

**R3.** El sistema DEBE pintar las columnas de la lista en este orden y con estos nombres: «Nº de
pedido», «Estado», «Personas», «Primera anotación», «Última anotación», «Duración», «Vueltas
atrás» y la columna de acciones; «Primera anotación», «Última anotación» y «Duración» DEBEN ir en
la fuente monoespaciada de cifras tabulares, y esas tres y «Vueltas atrás» DEBEN alinearse al final.

**R4.** El sistema DEBE pintar el estado de cada pedido, en la fila y en el detalle, con
`StatusBadge` usando la etiqueta de `ORDER_STATUS_LABELS` y el tono de `ORDER_STATUS_TONES`, y
DEBE conservar `data-testid="execution-trace-status"` y `data-status` con el código del estado.

**R5.** SI un pedido tiene una o más vueltas atrás, ENTONCES el sistema DEBE pintar su cifra, en la
fila y en el detalle, dentro de un `StatusBadge` de tono `waiting`; SI tiene cero, ENTONCES DEBE
pintar «0» sin insignia y atenuado. La cifra DEBE ser la del dominio y DEBE conservar
`data-testid="execution-trace-go-backs"`.

**R6.** SI un pedido está dado de baja, ENTONCES el sistema DEBE pintar, junto a su número en la
fila y junto a su estado en el detalle, un `StatusBadge` de tono `muted` con «Dado de baja»
(`data-testid="execution-trace-deleted"`). El sistema NO DEBE pintar, ni en la fila ni en el
detalle, ninguna marca «En curso» de actividad (`data-testid="execution-trace-active"`), esté el
pedido activo o dado de baja: el estado ya dice en qué paso va. *(Ubicación y forma: P4.)*

> **Enmendado el 2026-10-16 (enmienda aprobada por el usuario, sin tarjeta; commit `0f135128`).**
> Texto original: «…SI está activo, ENTONCES DEBE pintar en los mismos sitios un `StatusBadge` de
> tono `progress` con «En curso» (`data-testid="execution-trace-active"`). Un pedido dado de baja NO
> DEBE llevar la marca «En curso».» La marca de actividad desaparece de la fila y del detalle. Se
> conservan «Dado de baja» y la duración abierta con su sufijo « (en curso)» (QC-167 R3, QC-283 R26)
> y la insignia «En curso» de una fase abierta en el detalle (QC-283 R25).

**R7.** Ninguna celda de la lista DEBE contener un enlace «Ver recorrido». Cada fila DEBE tener un
menú de acciones cuyo disparador tenga el nombre accesible «Acciones del pedido {número}» y un
objetivo de al menos 44 × 44 px; CUANDO se abre, el menú DEBE ofrecer un único ítem «Ver recorrido»
que sea un enlace (`data-testid="execution-trace-link"`) a la misma dirección que hoy
(`executionTraceDetailHref(orderId, params)`, con la consulta de la lista).

**R8.** MIENTRAS el contenedor de la lista mide 760 px de ancho o menos, el sistema DEBE pintar
cada pedido como tarjeta con: número (y sus marcas de R6) y estado arriba; primera anotación,
duración y vueltas atrás como datos; las personas al pie; y un botón «Acciones» de al menos 44 px de
alto. CUANDO se pulsa «Acciones», el sistema DEBE abrir el menú centrado en la pantalla con el título
«Pedido {número}», un botón «Cerrar» y el ítem «Ver recorrido» de al menos 48 px de alto, y al
cerrarse DEBE devolver el foco al botón «Acciones». *(Tablet: P5.)*

**R9.** MIENTRAS la lista no tiene filas, el sistema DEBE mostrar «No hay pedidos ejecutados que
mostrar.»; SI la lectura de la lista falla, ENTONCES DEBE mostrar dentro del área «No se pudo cargar
la lista de pedidos ejecutados.» con `data-testid="execution-trace-error"` y un botón «Reintentar»
que vuelve a pedir la página actual sin cambiar su dirección. *(Botón: P6.)*

### Recorrido

**R10.** El sistema DEBE pintar el detalle dentro del contenedor de página compartido, con un único
`h1` «Recorrido del pedido {número}» (`data-testid="execution-trace-title"`) cuyo número vaya en la
fuente monoespaciada.

**R11.** El sistema DEBE pintar «Volver a la lista», antes de la cabecera del detalle y también en su
estado de error, como **enlace** con forma de botón y flecha hacia atrás, con un objetivo de al menos
44 × 44 px, `data-testid="execution-trace-back"` y la misma dirección que hoy (QC-167 R17).

**R12.** El sistema DEBE pintar bajo la cabecera del detalle una lista de definiciones con tres
datos, «Estado» (R4 y las marcas de R6), «Duración» (la cifra de `formatTraceDuration`, en la
fuente monoespaciada, `data-testid="execution-trace-duration"` con `data-kind`) y «Vueltas atrás»
(R5); CUANDO el contenedor del detalle mide 760 px o menos, los tres datos DEBEN apilarse en una
columna, y si no, ir en tres columnas iguales.

**R13.** El sistema DEBE pintar las anotaciones en un bloque con el `h2` «Anotaciones» y, a su lado,
el número de anotaciones; dentro, una lista ordenada con nombre accesible «Anotaciones», un `li`
por anotación (`data-testid="execution-trace-step"`, `data-action` con la acción del dominio y
`data-go-back="true"` en cada retroceder) en el orden del dominio, unidos por una línea vertical.

**R14.** El sistema DEBE pintar en cada anotación: un punto con el icono de su acción, oculto a las
tecnologías de asistencia; la acción con su etiqueta de `EXECUTION_ACTION_LABELS`; su instante en un
`<time>` con `dateTime` ISO y el texto de `formatTraceInstant` *(formato: P2)*; «Paso {n}» cuando
la anotación tiene posición *(P7)*; la persona con su avatar de iniciales en el color estable de su
identificador y su nombre, o «—» con nombre accesible «Sin dato» si el directorio ya no la
devuelve; «Motivo · {motivo}» en cada cancelar con motivo; y, en todas salvo la última, «Hasta la
siguiente: {tramo}» *(P3)*.

**R15.** El sistema DEBE dar a cada anotación el tono de su acción en el punto: retroceder en
`waiting` (ámbar, también el fondo y el borde de su tarjeta), arrancar, retomar y comenzar empaque
en `progress`, finalizar y terminar empaque en `success`, cancelar en `danger` y avanzar en neutro;
y cada retroceder DEBE llevar el texto «Vuelta atrás» para lectores de pantalla. El color NO DEBE
ser la única forma de distinguir un retroceder: lo distinguen también su icono y su etiqueta.
*(P4.)*

**R16.** CUANDO se pinta el detalle, el sistema DEBE hacer entrar las anotaciones subiendo, una tras
otra con 40 ms de desfase y una sola vez; MIENTRAS el sistema operativo pide movimiento reducido,
DEBE mostrarlas sin desplazamiento. El realce de la tarjeta de una anotación al pasar el puntero
DEBE darse solo en dispositivos con `hover: hover` y NO DEBE ser la única vía de ningún dato.

**R17.** SI la lectura del recorrido falla con un error que no es `order_not_found`, ENTONCES el
sistema DEBE mostrar el `h1` «Recorrido» y «No se pudo cargar el recorrido.» con
`data-testid="execution-trace-detail-error"`, como hoy.

**R18.** SI el pedido no existe, es de otra empresa, no tiene anotaciones o la sesión no tiene
`dashboard.consultar`, ENTONCES la respuesta DEBE seguir siendo **404** en el código HTTP, como hoy
(QC-167 R18, R20): el rediseño NO DEBE añadir a `/dashboard` ni a su detalle ningún límite de carga
que haga empezar la respuesta antes de esas comprobaciones.

### Página no encontrada

**R19.** CUANDO una ruta privada declarada responde 404, el sistema DEBE pintar, dentro del armazón
privado y sin `main` propio, un estado vacío que ocupe el área de contenido y quede centrado, con
`data-testid="private-not-found"`, un icono de búsqueda en un recuadro oculto a las tecnologías de
asistencia, la etiqueta «404» en la fuente monoespaciada, un único `h1` «No encontramos esta
página» y el texto «Revisa la dirección e inténtalo de nuevo, o continúa desde el menú lateral.»;
NO DEBE pintar ningún enlace ni botón *(P1)* y NO DEBE mencionar permisos, roles, autorización ni
ningún módulo (QC-75 R7).

### Transversal

**R20.** CUANDO la ventana mide 390, 820 o 1440 px de ancho, las tres pantallas NO DEBEN provocar
scroll horizontal de la página (la tabla solo puede desplazarse dentro de su caja), cada control
accionable DEBE tener un objetivo de al menos 44 × 44 px, los campos de texto DEBEN tener al menos
16 px de letra, y ningún dato DEBE depender de `:hover`.

**R21.** El sistema DEBE mostrar en las tres pantallas exactamente estos textos visibles y nombres
accesibles, con su ortografía:

| Dónde | Texto |
|---|---|
| Dashboard | «Dashboard» · «Recorridos de ejecución» · «Buscar por número de pedido» · «Solo cancelados» |
| Columnas | «Nº de pedido», «Estado», «Personas», «Primera anotación», «Última anotación», «Duración», «Vueltas atrás» |
| Menú de fila | «Acciones del pedido {número}» · «Ver recorrido» · «Acciones» · «Pedido {número}» · «Cerrar» |
| Estados de la lista | «No hay pedidos ejecutados que mostrar.» · «No se pudo cargar la lista de pedidos ejecutados.» · «Reintentar» |
| Marcas | «Dado de baja» · ~~«En curso»~~ (quitada el 2026-10-16, R6) · «Vuelta atrás» |
| Recorrido | «Volver a la lista» · «Recorrido del pedido {número}» · «Estado» · «Duración» · «Vueltas atrás» · «Anotaciones» · «Paso {n}» · «Motivo» · «Hasta la siguiente:» · «Sin dato» · «No se pudo cargar el recorrido.» |
| Acciones | «Arrancar», «Retomar», «Avanzar», «Retroceder», «Cancelar», «Finalizar», «Comenzar empaque», «Terminar empaque» |
| No encontrada | «404» · «No encontramos esta página» · «Revisa la dirección e inténtalo de nuevo, o continúa desde el menú lateral.» |

### Alcance y piezas

**R22.** El cambio de esta ficha NO DEBE modificar ningún archivo bajo `lib/`, `db/` ni
`middleware.ts`, ni añadir dependencias a `package.json`.

**R23.** Cada pieza compartida extendida por esta ficha DEBE tener su fila al día en
`components/shared/CATALOGO.md` (puntos de extensión y tablero en `Diseño`), la guardia del catálogo
DEBE quedar en verde, y toda pieza nueva de esta ficha DEBE vivir en la carpeta `components/` de su
ruta, exportada por su barrel.

**R24.** Los E2E de `e2e/recorrido-ejecucion.spec.ts` DEBEN pasar cambiando solo cómo localizan el
acceso al recorrido (menú de fila en vez de enlace de celda) y la marca de vuelta atrás (R15); sus
aserciones de filtros, URL, 404, orden de anotaciones, dados de baja y vuelta a la lista NO DEBEN
cambiar.

## Preguntas abiertas

Cada una lleva la opción por defecto con la que el spec está escrito. Si el humano aprueba sin
comentarlas, se cierran con esa opción.

- **P1 — Botón de la página no encontrada.** El tablero pone un botón primario «[Ir a Asignación]»
  y lo marca «Por confirmar». QC-75 (cerrado) decidió no pintar ningún enlace en el 404 privado:
  quien no tiene permiso de Asignación caería en otro 404, y un destino fijo delata qué pantallas
  existen; `tests/unit/navegacion/private-not-found.test.tsx` lo asegura («no pinta ningún
  enlace»). **Por defecto: sin botón** (R19). Alternativa: un botón a una ruta que toda sesión
  tenga, que hoy no existe.
- **P2 — Formato de fecha y hora.** El tablero muestra «02/10/2026 08:12»; hoy se pinta
  `2026-10-02 08:12:00` en UTC (`formatTraceInstant`, sin configuración regional para que servidor y
  navegador pinten lo mismo). **Por defecto: se conserva el formato de hoy** (R14). Cambiarlo es
  decidir zona horaria y formato regional, que no está en ningún doc.
- **P3 — «Hasta la siguiente».** QC-167 R14 exige el tramo entre anotaciones; el tablero no lo
  dibuja. **Por defecto: se conserva**, en la línea de datos de cada anotación (R14).
- **P4 — Marcas del pedido y de la vuelta atrás.** El tablero no dibuja la marca «En curso» aparte
  del estado (QC-167 R3), pone «Dado de baja» en la columna Personas («Por confirmar»: qué marca) y
  no pinta la insignia visible «Vuelta atrás». **Por defecto:** «Dado de baja» sigue marcando el
  pedido (QC-167 D12) y va junto al número; «En curso» se conserva junto al número; las dos como
  `StatusBadge` (R6); la vuelta atrás se marca con el tono ámbar, su icono y «Retroceder», con
  «Vuelta atrás» solo para lectores de pantalla (R15).
  **Enmienda 2026-10-16 (`0f135128`):** «En curso» deja de pintarse junto al número y junto al
  estado; ver R6 y la fila C9.
- **P5 — Tablet.** `DashboardTablet` dibuja la tabla con scroll horizontal a 820 px, pero
  `DataTable` (QC-256) pasa a tarjetas cuando su contenedor mide 760 px o menos, y a 820 px con la
  barra lateral en modo icono el contenedor queda por debajo. **Por defecto: se acepta el
  comportamiento de `DataTable`** (tarjetas en tablet vertical); cambiar el umbral afecta a todas las
  tablas y sería ficha propia.
- **P6 — Reintentar.** El tablero pone «[Reintentar]» en el error de la lista y lo marca «Por
  confirmar»; hoy no hay botón. **Por defecto: botón «Reintentar»** que refresca la página
  (`ErrorState` con `retry: refresh`, su texto por defecto) (R9).
- **P7 — Posición del paso.** El tablero muestra «Paso X de Y» («Por confirmar»); el registro solo
  guarda la posición, no el total. **Por defecto: «Paso {n}»**, como hoy (R14); el total pediría
  cambiar `asignaciones`, fuera de esta ficha.
