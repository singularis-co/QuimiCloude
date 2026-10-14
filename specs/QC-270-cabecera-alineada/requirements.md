# QC-270 — Cabecera de DataTable alineada con su columna (`align` end y center)

Zona: frontend · Complejidad: low · SDD.
Origen: `specs/QC-269-layout-operario/requirements.md > P1` (aprobado: la cabecera va en esta
ficha). Caso visto por el humano: la cabecera «Entrar» de `/asignacion` queda a la izquierda
mientras su celda va a la derecha.

## Alcance

**Qué entra.**

- La celda de cabecera de `DataTable` (`DataTableHeaderCell`) sigue la alineación que declara su
  columna (`align: 'start' | 'end' | 'center'`), igual que ya la siguen las celdas del cuerpo.
  Afecta a **todas** las tablas de la app con columnas `end` o `center`, incluidas las columnas de
  `actionsColumn()`, que nacen con `align: 'end'`.
- El menú de cabecera (ordenar, fijar, filtrar) y el icono de orden siguen funcionando con la
  etiqueta a la derecha o al centro.
- Se regeneran y se revisan los snapshots de paridad de las 11 listas cerradas que pintan una
  cabecera `end` o `center`.

**Lo que NO entra.**

- Las celdas de «Entrar» (`assigned-order-enter-trigger.tsx`): las arregla QC-269.
- Cambiar el `align` que declara cada columna (p. ej. «Cantidad» de Pedidos va `center` en la app y
  `num`, a la derecha, en `Tabla.dc.html:40`). Esta ficha hace que la cabecera obedezca al `align`
  que haya; no decide cuál toca.
- Ocultar visualmente la cabecera de las columnas de acciones (ver `P1`).
- La vista de tarjetas (`card`): no tiene cabecera de columnas.

## Decisiones cerradas (no reabrir)

| # | Decisión | Quién / cuándo | Cubierta por |
|---|---|---|---|
| D1 | La alineación de la cabecera de `DataTable` va en esta ficha y no en QC-269. | Humano, al aprobar `QC-269 > P1` | R1–R3 |
| D2 | Alcance: todas las tablas con columnas `end`/`center`, no solo «Entrar». | Leader, al abrir la ficha | R1, R2, R8 |
| D3 | Los snapshots de paridad afectados se regeneran y se revisan; no se dejan rojos ni se aceptan a ciegas. | Leader, al abrir la ficha | R8 |
| D4 | QC-269 arregla solo las celdas de «Entrar»; esta ficha no toca sus archivos. | Leader, al abrir la ficha | R7 |

## Requisitos (EARS)

- **R1.** DONDE una columna declara `align: 'end'`, el sistema DEBE pintar su celda de cabecera con
  el texto alineado a la derecha y con la etiqueta, el icono de orden y el disparador del menú
  agrupados contra el borde derecho de la celda.
- **R2.** DONDE una columna declara `align: 'center'`, el sistema DEBE pintar su celda de cabecera
  con el texto centrado y con la etiqueta, el icono de orden y el disparador del menú agrupados en
  el centro de la celda.
- **R3.** DONDE una columna declara `align: 'start'`, el sistema DEBE pintar su celda de cabecera
  exactamente como hoy: sin clase de alineación de texto en la celda y sin clase de reparto en el
  contenedor de la etiqueta.
- **R4.** MIENTRAS una columna `end` o `center` es ordenable, CUANDO el usuario activa su etiqueta
  por clic o por teclado, el sistema DEBE alternar el orden de esa columna y reflejarlo en
  `aria-sort` y en el icono, igual que en una columna `start`.
- **R5.** CUANDO el usuario abre el menú de cabecera de una columna `end` o `center`, el sistema
  DEBE ofrecer las mismas opciones que en una columna `start` (ordenar, fijar o soltar, filtrar,
  según lo que declare la columna) y cada opción DEBE producir el mismo efecto.
- **R6.** El sistema DEBE mantener, en las tres alineaciones, el mismo orden de la cabecera en el
  DOM: primero la etiqueta (o su botón de orden) y después el disparador del menú, para que el orden
  de tabulación y la lectura no cambien.
- **R7.** El sistema DEBE mantener la alineación de las celdas del cuerpo de cada columna tal como
  está hoy (`end` a la derecha, `center` centrada, `start` sin clase).
- **R8.** CUANDO se regeneran los snapshots de paridad de las listas cerradas, el diff de cada
  snapshot DEBE limitarse a las clases de alineación de las celdas de cabecera de sus columnas
  `end` y `center` y del contenedor inmediato de su etiqueta; cualquier otra línea cambiada es un
  fallo.

## Preguntas abiertas

Cada una con el defecto que se aplica si nadie dice otra cosa al aprobar el spec.

- **P1. ¿Las columnas de acciones llevan cabecera visible?** Los tableros la ocultan:
  `Tabla.dc.html:42` y `Asignacion.dc.html:61` ponen «Acciones» en `<span class="sr">`, y
  `Asignacion.dc.html:155` hace lo mismo con «Entrar» (`#Entrar` → `sr: true`). En cambio
  `Usuarios.dc.html:178` y `ModalesConfiguracion.dc.html:66` la dibujan visible y a la derecha. La
  app hoy la pinta visible en todas (`actionsColumn()`, etiqueta «Acciones»; «Entrar» en
  `assigned-orders-columns.tsx`).
  **Por defecto: siguen visibles, ahora alineadas a la derecha.** Ocultarlas cambia el árbol
  accesible de casi todas las listas y es otra decisión; si el humano la quiere, el leader abre una
  ficha aparte («Cabecera solo para lector de pantalla en columnas de acciones»).
- **P2. ¿Las cabeceras `center` necesitan su propio pase `/design`?** Ningún tablero dibuja una
  cabecera centrada. `Tabla.dc.html:40-41` sí fija la regla —la cabecera comparte la alineación de
  su columna (`th class="num"`, también con botón de orden)— y `center` es la misma regla con otro
  valor; no hay pieza ni UI nueva.
  **Por defecto: no.** El `design.md` cita `Tabla.dc.html` como referencia de la regla.
- **P3. ¿Qué pasa si la etiqueta no cabe en una columna `end`/`center` de ancho fijo?** Con el
  contenido agrupado a la derecha o al centro, lo que desborda se recorta por el inicio en vez de
  por el final.
  **Por defecto: no se trata en esta ficha.** Se revisa en la evidencia visual de T4; si alguna lista
  la recorta, se anota en `progress/impl_QC-270.md` y el leader abre ficha.
