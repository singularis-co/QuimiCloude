# QC-306 — pdf-status-panel: requisitos

> **Spec a posteriori.** El código ya está en `dev` (commits `683a7e2e..97070fad`) y entró sin
> spec. Este archivo fija dos cosas: el comportamiento que ya existe y se conserva (R1–R18), y las
> correcciones de los hallazgos 3 a 10 de la revisión (`progress/review-pdf-status-panel.md`, en el
> worktree principal), que son R19–R38.

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
| 2026-10-21 | ¿Qué hacer con un código que entró en `dev` sin spec ni revisión? | **Opción A:** abrir la ficha, escribir el spec y el diseño a posteriori y corregir los hallazgos 3 a 10 de la revisión. | R1–R38 |
| 2026-10-21 | ¿Se toca la cola o la política de reintentos? | **No.** `maxAttempts` sigue saliendo de la configuración en cada consulta. La cota de «Intento N de M» se aplica al mostrarlo. | R2, R32 |
| 2026-09-24 (QC-160) | ¿Qué pasa si se cierra la ventana a mitad de una tanda? | Sin aviso. Al reabrir se ve la misma tanda con su estado, porque la ventana tiene `keepMounted`. Esta ficha lo conserva. | R16, R24 |

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
ruta de revisión de fórmulas.

**R18** — *(Provisional: depende de P2.)* SI la subida está deshabilitada, ENTONCES el panel DEBE
comportarse como decida P2. Mientras P2 siga abierta, se conserva el comportamiento actual: el panel
no se pinta.

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
vuelva a montar al navegar.

#### Registro ligado a usuario y empresa (hallazgo 5)

**R26** — El panel DEBE mostrar solo las tandas que se registraron en el mismo ámbito (mismo
usuario y misma empresa) que la sesión actual.

**R27** — El sistema NO DEBE guardar en el almacenamiento del navegador ningún dato del ámbito más
allá de lo que fije P3. En ningún caso guarda nombres de archivo, motivos de error ni el estado de
la tanda.

**R28** — CUANDO el usuario cierra sesión con el control de cierre de sesión, el sistema DEBE borrar
del navegador los registros de tandas que fije P4, y también la memoria de estados de la R25.

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

**R33** — Cada tanda del panel DEBE tener un rótulo que la identifique ante las demás. El rótulo
incluye la fecha y la hora de su registro y, en cuanto se conoce, su número de archivos. El texto
exacto lo fija el pase de diseño (P7).

**R34** — Cada control «Descartar» DEBE tener un nombre accesible distinto, que incluya el rótulo de
su tanda. Cada bloque de tanda DEBE estar asociado a su rótulo como nombre accesible.

#### Subida deshabilitada (hallazgo 9)

**R35** — *(Depende de P2.)* MIENTRAS la subida está deshabilitada y hay tandas recordadas, el
sistema DEBE aplicar la opción que se elija en P2. Si es la B (la recomendada), el panel muestra las
tandas y permite descartarlas, y no ofrece ninguna acción de subida.

#### Formato y catálogo (hallazgo 10)

**R36** — Todo archivo de producción de la pieza `components/shared/document-upload/` y el
envoltorio de fórmulas DEBEN terminar con un salto de línea final.

**R37** — *(Depende de P8.)* Ninguna línea de esos archivos DEBE superar el ancho máximo que se
confirme en P8. La revisión usó 100 columnas.

**R38** — La fila del catálogo de la pieza DEBE citar en su columna `Diseño` el tablero aprobado
del panel. También DEBE dejar de declarar como «no cubierta» la sincronía entre pestañas.

## Preguntas abiertas

**P1 — ¿Dónde va el panel en la página?** Hoy está dentro de `PageHeader > actions`, que es una
fila flex de botones (`page.tsx:45`). Nadie aprobó esa ubicación (hallazgo 2).
- **A.** Una sección a todo el ancho, debajo de la cabecera y encima de la tabla de fórmulas,
  plegable.
- **B.** Dentro de la cabecera, como hoy.
- **C.** Un indicador con contador en la cabecera que abre una hoja lateral (`Sheet`) con las tandas.
- **D.** Quitar el panel y dejar el seguimiento solo dentro de la ventana, como antes.
- **Recomendación: A.** Un panel de hasta 20 tandas no cabe en una fila de botones, y A no oculta el
  estado detrás de un gesto. La decisión final es del pase `/design`.

**P2 — ¿Qué hace el panel con la subida deshabilitada y tandas en curso?** Hoy desaparece. La subida
se deshabilita cuando no hay proveedor de IA configurado.
- **A.** Ocultarlo, como hoy.
- **B.** Mostrarlo en solo lectura: estado, «Revisar» y «Descartar», sin acción de subida.
- **C.** Mostrar solo las tandas no terminadas.
- Afecta a R18 y R35.
- **Recomendación: B.** Consultar el estado solo exige el permiso de subida, no el proveedor de IA.
  Ocultar tandas en curso que siguen avanzando en la cola deja al usuario sin saber qué pasó.

**P3 — ¿Cómo identifica el cliente el ámbito (usuario + empresa) sin filtrar datos?** Lo que hay
hoy:
- `SessionUser` (lo que la UI recibe por props) tiene `id`, pero no `companyId`.
- `SessionContext` tiene los dos, y su comentario dice que ninguna pantalla muestra `companyId`.

Opciones:
- **A.** El servidor deriva un identificador opaco del ámbito: un resumen SHA-256 de
  `userId:companyId` con `node:crypto`, sin dependencia nueva. Se pasa como prop al envoltorio y es
  lo único que llega al cliente y a la clave del almacenamiento.
- **B.** Pasar `userId` y `companyId` en claro al cliente y usarlos en la clave.
- **C.** No acotar la clave y limitarse a borrar el registro al cerrar sesión (R28).
- **Recomendación: A.** No expone `companyId` al cliente, no añade librería y resiste el caso de un
  cierre de sesión que no pasa por el botón (caducidad o «cerrar las otras sesiones»), que C no
  cubre.

**P4 — ¿Qué se borra al cerrar sesión?**
- **A.** Solo el registro del ámbito que sale.
- **B.** Todos los registros de la pieza en ese navegador (todas las claves con su prefijo).
- **Recomendación: B.** Es más simple y no deja punteros de nadie en un navegador compartido. Lo que
  se pierde son solo punteros: las tandas siguen en el servidor.

**P5 — ¿Las tandas terminadas se vuelven a consultar tras recargar la página?** La R25 evita las
reconsultas dentro de una misma carga. Tras una recarga, cada tanda terminada se consulta una vez.
- **A.** Aceptar esa única consulta por recarga.
- **B.** Guardar en el almacenamiento del navegador la foto final de la tanda, con cero consultas.
  Eso deja nombres de archivo y motivos de error en el navegador y choca con la R27.
- **Recomendación: A.**

**P6 — ¿El pase `/design` es previo a este spec?** La regla de `docs/perfil-agentes.md >
spec_author` pide devolver `BLOQUEADO` si el spec toca un componente sin tablero aprobado.
- No existe ningún tablero del panel en `docs/diseno/canvas/`.
- Este spec se escribe igualmente porque el leader lo pidió para un código que ya existe.
- El tablero está como tarea bloqueante T0 de `tasks.md`.
- **Recomendación:** hacer el pase y aprobarlo **antes** de aprobar este spec. Si el pase cambia la
  ubicación (P1) o el rótulo (P7), se ajustan R17, R33 y R35 antes de la aprobación.

**P7 — ¿Cuál es el texto exacto del rótulo de cada tanda?**
- Afecta a R33 y R34.
- Propuesta: «Tanda del 21/10, 14:32 · 3 archivos». Es hora local, y el número de archivos aparece
  con la primera respuesta.
- Nombre accesible de «Descartar»: «Descartar la tanda del 21/10, 14:32».
- ¿Hace falta el año? ¿Hace falta «hoy» o «ayer»? Lo decide el pase de diseño.

**P8 — ¿Cuál es el ancho máximo de línea del repo?**
- La revisión señaló líneas de más de 100 columnas.
- Ningún documento del perfil ni la configuración de ESLint fijan ese límite.
- **Recomendación:** confirmar 100 columnas, el valor que aplica la revisión, o retirar la R37 si
  el repo no tiene esa norma.
