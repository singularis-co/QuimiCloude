# QC-306 — pdf-status-panel: requisitos

> **Spec a posteriori.** El código ya está en `dev` (commits `683a7e2e..97070fad`) y entró sin
> spec. Este archivo fija dos cosas:
> - el comportamiento que ya existe y se conserva: R1–R17 (R18 está retirado);
> - las correcciones de los hallazgos 3 a 10 de la revisión (`progress/review-pdf-status-panel.md`,
>   en el worktree principal) y lo que fijó el tablero: R19–R41 (R28 está retirado).

## Alcance

**Entra:**
- El spec y el diseño del panel persistente de tandas y de los campos que lo alimentan: `attempts`,
  `name` y `maxAttempts` en la consulta de la tanda.
- La corrección de los hallazgos 3 a 10 de la revisión:
  - (3) la lectura de `localStorage` es robusta y tiene pruebas;
  - (4) no hay sondeo duplicado ni se reconsultan las tandas terminadas;
  - (5) el registro va ligado a usuario y empresa;
  - (6) las pestañas se sincronizan;
  - (7) «Intento N de M» queda acotado;
  - (8) los rótulos son accesibles;
  - (9) queda decidido qué pasa con la subida deshabilitada;
  - (10) el formato.
- El pase de diseño aprobado del panel (hallazgo 2) es condición de esta ficha: lo pide el ticket.

**NO entra:**
- Ningún cambio en la cola ni en la política de reintentos (`maxRetries`, `retries` de QStash, la
  caducidad). Lo excluye el ticket.
- Ningún cambio de autorización en el servidor. La consulta de la tanda sigue sin filtrar por autor.
- Montar el panel en otras pantallas, como el catálogo de proveedores. El ticket no lo pide.
- Borrar los registros al cerrar sesión (P4).

## Glosario

- **Tanda**: el conjunto de PDF que se encola de una vez. La identifica su `batchId`.
- **Registro**: la lista de tandas que este navegador encoló. Guarda el `batchId`, la estrategia y el
  instante.
- **Panel**: la lista de tandas recordadas que se ve fuera de la ventana de subida.
- **Ventana**: el diálogo de subida (`DocumentUploadDialog`). Sigue montada al cerrarse.
- **Tanda terminada**: tanda cuyos archivos están todos en `done` o en `error`.
- **Ámbito del registro**: la pareja usuario + empresa de la sesión. Cada ámbito tiene su propio
  registro.

## Decisiones cerradas (no reabrir)

| Fecha | Pregunta | Decisión | Cubierta por |
|---|---|---|---|
| 2026-10-21 | ¿Qué hacer con un código que entró en `dev` sin spec ni revisión? | **Opción A:** abrir la ficha, escribir el spec y el diseño a posteriori y corregir los hallazgos 3 a 10 de la revisión. | R1–R41 |
| 2026-10-21 | ¿Se toca la cola o la política de reintentos? | **No.** `maxAttempts` sigue saliendo de la configuración en cada consulta. La cota de «Intento N de M» se aplica al mostrarlo. | R2, R32 |
| 2026-09-24 (QC-160) | ¿Qué pasa si se cierra la ventana a mitad de una tanda? | Sin aviso. Al reabrir se ve la misma tanda con su estado, porque la ventana tiene `keepMounted`. Esta ficha lo conserva. | R16, R24 |
| 2026-10-21 | P1: ¿dónde va el panel? | En una sección a todo el ancho **debajo** de la cabecera, no en `PageHeader > actions`. Es plegable y solo se ve si hay tandas recordadas. | R14, R17, R39 |
| 2026-10-21 | P2: ¿qué pasa con la subida deshabilitada y tandas recordadas? | El panel se muestra en **solo lectura**: estado, «Revisar» y «Descartar». | R35 (sustituye a R18) |
| 2026-10-21 | P3: ¿cómo se identifica el ámbito en el cliente? | La clave de `localStorage` lleva `userId` y `companyId` **en claro**. Se rechaza la alternativa del resumen (hash). | R26, R27 |
| 2026-10-21 | P4: ¿qué se borra al cerrar sesión? | **Nada.** La clave por usuario ya aísla los registros. Se retira el requisito de limpieza al cerrar sesión. | R26 (R28 retirado) |
| 2026-10-21 | P5: ¿se reconsultan las tandas terminadas tras recargar? | Una consulta por tanda terminada tras la recarga, y se para. **No** se guarda la foto final en `localStorage`. | R25, R27 |
| 2026-10-21 | P6: ¿el pase `/design` va antes que el spec? | **Sí**, antes de aprobar el spec. T0 sigue siendo bloqueante. `design.md` citará el tablero cuando exista en `docs/diseno/canvas/`. | R38, T0 |
| 2026-10-21 | P7: ¿qué texto lleva el rótulo de cada tanda? | «Tanda de hoy, 14:32 · 3 archivos», «Tanda de ayer, …» y fecha corta para el resto. Nombre accesible del botón: «Descartar la tanda de hoy, 14:32». | R33, R34 |
| 2026-10-21 | P8: ¿cuál es el ancho máximo de línea? | 100 columnas, **solo** en los archivos de esta feature. No se cambian los documentos ni ESLint. | R37 |
| 2026-10-21 | Tablero: ¿cómo arranca el panel? | **Desplegado.** Aprobado con `PanelTandas*.dc.html`. | R39 |
| 2026-10-21 | Tablero: ¿qué formato tiene la fecha corta? | «15/10, 09:12». El año solo aparece si no es el actual. | R33 |
| 2026-10-21 | Tablero: ¿qué aviso se muestra en solo lectura? | El texto exacto: «La subida de PDFs está desactivada. Las tandas que ya enviaste siguen procesándose: puedes revisarlas y descartarlas.» | R35 |
| 2026-10-21 | Tablero: ¿qué nombre accesible lleva «Reanudar» en el error de consulta? | El mismo patrón que «Descartar»: «Reanudar la tanda de hoy, 10:47». | R40 |
| 2026-10-21 | Tablero: ¿qué muestra la cabecera del panel? | Un contador de tandas y un resumen: «1 en curso», «Todas terminadas», «1 en curso · 1 con errores». | R41 |
| 2026-10-21 | R41: ¿qué cuenta como «con errores»? | Cualquier tanda con al menos un archivo en error, **aunque siga en curso**. Una tanda puede contar a la vez en «en curso» y en «con errores». | R41 |
| 2026-10-21 | R41: ¿cómo cuenta una tanda desconocida (que ya no existe)? | Suma **solo** en el contador total, no en «en curso» ni en «con errores». Si no hay otras, el resumen dice «Todas terminadas». | R41 |

## Requisitos (EARS)

### A. Lo que ya existe y se conserva

#### Consulta de la tanda (backend)

**R1** — CUANDO se consulta una tanda visible para el actor, el sistema DEBE devolver para cada
archivo su número de intentos consumidos (`attempts`, con 0 cuando nadie lo ha reclamado) y un
nombre legible (`name`). El nombre es el nombre original del archivo o, si falta, el último segmento
no vacío de su ruta. Nunca es vacío.

**R2** — CUANDO se consulta una tanda visible, el sistema DEBE devolver el tope de intentos totales
por archivo (`maxAttempts`). Es la primera entrega más los reintentos configurados y se lee de la
configuración en cada consulta, nunca de un literal.

**R3** — SI la tanda no existe o es de otra empresa, ENTONCES la consulta DEBE devolver el mismo
resultado vacío en los dos casos, sin distinguirlos. SI el actor no tiene el permiso de subida,
ENTONCES DEBE rechazarse.

**R4** — El contrato de la consulta DEBE tener exactamente las claves acordadas: la entrada de
archivo, la tanda leída y la tanda con su tope. Ni una de más ni una de menos.

#### Registro de tandas (cliente)

**R5** — CUANDO una tanda se encola con éxito, el sistema DEBE guardarla en el registro con su
estrategia y el instante del registro. SI el encolado falla, ENTONCES el sistema NO DEBE registrar
nada.

**R6** — El registro DEBE ordenar las tandas de la más reciente a la más antigua, sin `batchId`
repetidos. Tiene un tope de 20: al pasarlo, se descartan las más antiguas.

#### Panel

**R7** — El panel DEBE mostrar solo las tandas recordadas de su estrategia.

**R8** — MIENTRAS una tanda recordada tiene estado, el panel DEBE mostrar por cada archivo su
nombre, su estado y el texto «Intento N de M». N vale al menos 1.

**R9** — SI un archivo terminó en error, ENTONCES el panel DEBE mostrar el mensaje que el catálogo
de errores asocia a su código y, si lo hay, su motivo. La tanda sigue visible.

**R10** — SI un archivo está listo y la pantalla aporta una ruta de revisión, ENTONCES el panel
DEBE ofrecer el enlace «Revisar» a la revisión de ese archivo.

**R11** — CUANDO el usuario descarta una tanda, el sistema DEBE quitarla del registro y dejar de
mostrarla.

**R12** — SI una tanda recordada ya no existe para el actor, ENTONCES el panel DEBE avisar de que
la tanda ya no está disponible y DEBE permitir descartarla.

**R13** — SI la consulta de una tanda falla, ENTONCES el panel DEBE mostrar el error y un control
«Reanudar». Al pulsarlo, se vuelve a consultar.

**R14** — MIENTRAS el ámbito actual no tiene tandas recordadas de la estrategia, el panel NO DEBE
pintarse.

**R15** — El panel NO DEBE pintar nada en el render del servidor. Su primer render en el cliente
DEBE coincidir con el del servidor, sin desajuste de hidratación.

**R16** — Las filas de la ventana DEBEN conservar sus identificadores de prueba y su contenido de
antes: sin «Intento N de M». Las filas del panel DEBEN usar identificadores propios, que no
colisionen con los de la ventana.

**R17** — La pantalla de fórmulas DEBE montar la ventana y el panel con la estrategia `formula` y la
ruta de revisión de fórmulas:
- la ventana, en las acciones de la cabecera;
- el panel, en una sección a todo el ancho debajo de la cabecera, fuera de `PageHeader > actions`.

**R18** — *Retirado (P2).* Ocultar el panel con la subida deshabilitada era el comportamiento
anterior. Lo sustituye la R35.

### B. Correcciones de la revisión

#### Lectura y escritura robustas del registro (hallazgo 3)

**R19** — CUANDO la aplicación se carga de nuevo en el navegador, el panel DEBE mostrar las tandas
que el registro guardó antes en el almacenamiento del navegador para el mismo ámbito.

**R20** — SI lo guardado no es legible (JSON inválido o un valor que no es una lista), ENTONCES el
sistema DEBE arrancar con el registro vacío, sin lanzar errores a la pantalla.

**R21** — SI lo guardado tiene entradas de una forma antigua o inválida (sin `batchId`, con una
estrategia desconocida o con un instante que no es número), ENTONCES el sistema DEBE conservar solo
las entradas válidas.

**R22** — SI el almacenamiento del navegador rechaza la escritura (por estar lleno o bloqueado),
ENTONCES el sistema DEBE conservar el registro en memoria durante la sesión, sin lanzar errores a la
pantalla.

**R23** — SI el almacenamiento del navegador rechaza la lectura, ENTONCES el sistema DEBE arrancar
con el registro vacío, sin lanzar errores a la pantalla.

#### Una sola consulta por tanda (hallazgo 4)

**R24** — MIENTRAS la ventana y el panel siguen a la vez la misma tanda, el sistema DEBE hacer como
mucho una consulta de esa tanda por intervalo de sondeo, y como mucho una en vuelo.

**R25** — CUANDO una tanda ya se ha visto terminada, o ya se ha visto que no existe, el sistema NO
DEBE volver a consultarla en esa misma carga de la aplicación, aunque el panel se desmonte y se
vuelva a montar al navegar. CUANDO la aplicación se recarga, el sistema DEBE consultar cada tanda
terminada una sola vez y dejar de sondearla.

#### Registro ligado a usuario y empresa (hallazgo 5)

**R26** — El panel DEBE mostrar solo las tandas que se registraron en el mismo ámbito (mismo
usuario y misma empresa) que la sesión actual.

**R27** — La clave del registro en el almacenamiento del navegador DEBE incluir en claro el
`userId` y el `companyId` de la sesión. El valor DEBE contener solo `batchId`, `strategy` y
`rememberedAt` por tanda: ni nombres de archivo, ni motivos de error, ni el estado o la foto final de
la tanda.

**R28** — *Retirado (P4).* Al cerrar sesión no se borra ningún registro: la clave por usuario y
empresa (R26, R27) ya los aísla.

**R29** — SI en el navegador queda un registro con la clave global anterior, que no tiene ámbito,
ENTONCES el sistema DEBE descartarlo sin mostrar sus tandas.

#### Sincronía entre pestañas (hallazgo 6)

**R30** — CUANDO otra pestaña del mismo navegador cambia el registro del mismo ámbito, la pestaña
actual DEBE reflejar el cambio en su panel sin recargar.

**R31** — CUANDO una pestaña registra o descarta una tanda, el sistema DEBE conservar las tandas
que otra pestaña haya registrado. Solo cambia la tanda afectada.

#### «Intento N de M» acotado (hallazgo 7)

**R32** — El texto «Intento N de M» DEBE cumplir `1 ≤ N ≤ M`. SI los intentos consumidos superan
el tope recibido, ENTONCES N DEBE ser M.

#### Rótulos accesibles (hallazgo 8)

**R33** — Cada tanda del panel DEBE tener un rótulo que la identifique ante las demás, con la hora
local de su registro:
- registrada hoy: «Tanda de hoy, 14:32»;
- registrada ayer: «Tanda de ayer, 14:32»;
- registrada antes, en el año actual: «Tanda del 15/10, 09:12»;
- registrada en otro año: la fecha corta con el año.

En cuanto se conoce el número de archivos, el rótulo lo añade: «Tanda de hoy, 14:32 · 3 archivos».

**R34** — Cada control «Descartar» DEBE tener un nombre accesible distinto, de la forma «Descartar la
tanda de hoy, 14:32», con el día y la hora de su rótulo según R33. Cada bloque de tanda DEBE estar
asociado a su rótulo como nombre accesible.

#### Subida deshabilitada (hallazgo 9)

**R35** — MIENTRAS la subida está deshabilitada y hay tandas recordadas, el panel DEBE mostrarse en
solo lectura:
- muestra el estado de cada tanda;
- ofrece «Revisar» y «Descartar»;
- no ofrece ninguna acción de subida;
- muestra el aviso «La subida de PDFs está desactivada. Las tandas que ya enviaste siguen
  procesándose: puedes revisarlas y descartarlas.»

#### Formato y catálogo (hallazgo 10)

**R36** — Todo archivo de producción de la pieza `components/shared/document-upload/` y el
envoltorio de fórmulas DEBEN terminar con un salto de línea final.

**R37** — Ninguna línea de los archivos de producción que toca esta feature DEBE superar las 100
columnas. La regla se limita a esos archivos: no cambia los documentos del repo ni ESLint.

**R38** — La fila del catálogo de la pieza DEBE citar en su columna `Diseño` el tablero aprobado
del panel. También DEBE dejar de declarar como «no cubierta» la sincronía entre pestañas.

#### Panel plegable (P1)

**R39** — CUANDO el usuario pliega el panel, el sistema DEBE ocultar la lista de tandas y dejar
visible el título con un control para desplegarlo. CUANDO lo despliega, DEBE volver a mostrarla. El
panel DEBE arrancar desplegado.

#### Reanudar accesible (tablero)

**R40** — SI la consulta de una tanda falla, ENTONCES su control «Reanudar» DEBE tener un nombre
accesible distinto, de la forma «Reanudar la tanda de hoy, 10:47», con el día y la hora del rótulo
según R33.

#### Cabecera del panel (tablero)

**R41** — La cabecera del panel DEBE mostrar el número de tandas recordadas visibles, incluidas las
desconocidas, y un resumen de su estado:
- «N en curso» si hay tandas sin terminar;
- «N con errores» si hay tandas con al menos un archivo en error, aunque sigan en curso. Una tanda
  puede contar a la vez en «en curso» y en «con errores»;
- las dos partes unidas por « · » cuando se dan las dos («1 en curso · 1 con errores»);
- «Todas terminadas» cuando no hay ninguna de las dos.

Una tanda desconocida (que ya no existe) suma solo en el contador, no en «en curso» ni en «con
errores».

## Preguntas abiertas

Ninguna. P1–P8, los detalles del tablero y el resumen de la cabecera se cerraron el 2026-10-21 y
están en `## Decisiones cerradas`.
