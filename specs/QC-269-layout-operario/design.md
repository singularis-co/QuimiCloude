# QC-269 — Defectos de layout del operario tras QC-265 · design.md

## Lo que ya existe

**Búsqueda (`docs/specs.md > Antes de especificar`)**

| Dónde | Términos | Qué apareció |
|---|---|---|
| Board (`feature_list.json`, `summary`/`name`) | `scroll`, `pie fijo`, `Entrar`, `materiales`, `alinea`, `layout` | Solo QC-11 «Layout privado con sidebar», que no tiene que ver, y esta misma ficha |
| `specs/` | `alto del pie`, `debajo del pie`, `bajo el pie`, `taparía` | QC-227 (cabecera fijada de `DataTable`), que no tiene que ver. QC-265 es el origen de los tres defectos: esta ficha corrige su resultado y no lo duplica |
| `progress/deudas.md` | `pie fijo`, `tapa`, `scroll propio`, `justify-end` | «Foco tapado» bajo la paginación `sticky` de `DataTable` (línea 392): otro defecto, de otra pieza; no entra |
| Grafo (`search_graph`, bm25) | `footer reserve fixed scroll operator panel` | `OperatorScreenFrame`, que ya reserva el alto de **su** pie y es el patrón que se reutiliza; nada que resuelva el pie de `StepReader` |

**Lo que se reutiliza, sin cambiarlo:**

- **La reserva del pie de `StepReader`** (`components/shared/step-reader/step-reader.tsx:338`,
  `pb-[calc(140px+env(safe-area-inset-bottom,0px))]`). Se copia su valor exacto y un test vigila
  que no se separen (§ 4.2).
- **La reserva del pie del marco** (`app/(private)/asignacion/components/operator-screen-frame.tsx:104`).
  Es lo que deja bien a Acondicionamiento y al Empaque sin pasos (§ 4.3).
- **La alineación de celda de `DataTable`** (`components/shared/data-table/data-table.tsx:291-299`,
  `text-right` para `align: 'end'`). El arreglo de «Entrar» deja que el contenido la herede.

**Filas de `components/shared/CATALOGO.md` consultadas:** `StepReader` (línea 86), `DataTable`
(línea 59) y `Card` (línea 25, punto de extensión `className`). **No hay componente nuevo.**

- `Card`: paso 1, se reutiliza con su `className`.
- `OrderExecutionToolsPanel`: paso 2, gana una prop opcional `className`. Es pieza de ruta, no de
  catálogo, y sus usos actuales no cambian.
- `StepReader` y `DataTable` no se tocan.

**Pase `/design`:** no hay componente nuevo ni UI visible nueva. Los tres arreglos devuelven las
pantallas a sus tableros aprobados en QC-265: `docs/diseno/canvas/Asignacion.dc.html`, que alinea
«Entrar» al final, y `docs/diseno/canvas/Ejecucion.dc.html`, con el panel entero sobre el pie y la
fila `minmax(0, 1fr) auto`. Lo único que el tablero no dibuja es la fila en dos líneas de R10, y va
en `requirements.md > P2`.

## 1. Modelo de datos, RLS, migraciones, rutas

Ninguno. Es una corrección de maquetación en el cliente:

- no hay tabla, política, migración, ruta, Server Action ni contrato de entrada o salida nuevos;
- no hay dependencia nueva;
- cambian clases y un `data-testid` nuevo.

## 2. Defecto 1 — «Entrar» (R1–R3)

### 2.1 Causa

`AssignedOrderEnterTrigger` (`app/(private)/asignacion/components/assigned-order-enter-trigger.tsx`)
pinta el botón de tres maneras:

- **PENDIENTE:** `AssignedOrderStartTrigger`, que es un `Button` `inline-flex` suelto. Hereda el
  `text-right` de la celda y queda a la derecha.
- **BLOQUEADO (`:33`) y EN_CURSO (`:59`):** botón y aviso dentro de un
  `<div className="flex flex-col items-start gap-1">`. Ese `div` es un bloque a todo el ancho de la
  celda y `items-start` lleva a sus hijos al borde izquierdo, así que `text-right` no les llega.

En las tarjetas (`components/shared/data-table/data-table-cards.tsx:71`) el campo `footer` va a la
izquierda de un `flex justify-between`, así que hoy los tres estados coinciden a la izquierda.

### 2.2 Arreglo

El envoltorio deja de ser `flex`: `<div className="flex flex-col gap-1">` pasa a ser un bloque
normal, con el aviso separado del botón por `mt-1`. El botón (`inline-flex`) y el aviso (`<p>`)
**heredan la alineación de quien los contiene**:

- en la celda de la tabla, que es `text-right`, quedan a la derecha y comparten borde con el
  PENDIENTE (R1, R2);
- en el pie de la tarjeta, sin `text-align`, quedan a la izquierda como hoy (R3).

Así un solo arreglo vale para las dos presentaciones, sin que el disparador sepa dónde se pinta.

**Descartado `items-end`:**

- en la tabla funciona;
- en la tarjeta el envoltorio mide lo que su aviso, así que el botón de BLOQUEADO y el de EN_CURSO
  quedarían a la derecha de su aviso y desalineados con el de PENDIENTE: R3 rompería a 390 px.

Los `aria-describedby`, los `data-testid` y los textos no cambian.

## 3. Defecto 3 — Fila de material (R9, R10)

### 3.1 Causa

`order-execution-lines.tsx:66-67`: la fila es `flex flex-wrap` y el nombre es `min-w-0 flex-1`.

- `flex-1` es `flex: 1 1 0%`: el nombre cuenta con base **0** al decidir si la línea cabe. Por eso
  `flex-wrap` nunca lo manda a otra línea.
- `min-w-0` le deja encoger hasta casi nada. El texto se parte palabra a palabra y, con una palabra
  más ancha que la caja, se sale de ella y pisa al porcentaje.

Las cifras de la fila son:

- porcentaje («12,50 %»);
- separadores;
- cantidad;
- selector de unidad, de 44 px de alto mínimo;
- marca de aproximado.

Suman unos 260 px en `text-base`. El contenido del panel mide 268 px (300 px menos 2 × 16 px de
relleno), así que para el nombre no queda casi nada.

### 3.2 Arreglo

1. El nombre pasa a `min-w-0 flex-[1_1_12rem] break-words`. Su base es 12 rem, crece hasta llenar
   la línea y no se parte por debajo de esa base. `break-words` solo actúa con una palabra más ancha
   que la fila.
2. Las cifras (porcentaje, separadores, cantidad, unidad y aproximado) se agrupan en un
   `<span className="flex min-w-0 flex-wrap items-center gap-3">`. El grupo pasa entero a la línea
   siguiente cuando no cabe al lado del nombre (R10) y nunca se solapa con él (R9).
3. El nombre gana `data-testid={`${ORDER_EXECUTION_LINE_NAME_TESTID}-${index}`}`, con
   `ORDER_EXECUTION_LINE_NAME_TESTID = 'order-execution-line-name'`, exportado también por
   `app/(private)/asignacion/[id]/components/index.ts`. El E2E mide ese elemento.

Con estas reglas, la fila queda así según el ancho del contenido del panel:

| Ancho del contenido del panel | Resultado |
|---|---|
| 268 px (dos columnas, ≥ 1101 px de contenedor) | nombre a 268 px en la primera línea; cifras debajo |
| ~318 px (390 px de ventana, una columna) | igual |
| ≥ ~470 px (tableta o escritorio estrecho, una columna) | nombre y cifras en una línea |

Ningún `data-testid` existente cambia ni se mueve de elemento. Los separadores siguen siendo
`aria-hidden`.

**Descartadas:**

- **Rejilla `minmax(0,1fr) auto` del tablero tal cual, con las cifras apiladas en la columna
  `auto`:** la columna de cifras mide lo que su elemento más ancho (cantidad más selector, unos
  130 px). El nombre se queda en unos 130 px y sigue partido en tres o cuatro líneas.
- **Truncar el nombre con puntos suspensivos:** el operario necesita leer el material entero para
  pesarlo.

## 4. Defecto 2 — Panel tapado por el pie (R4–R8)

### 4.1 Causa exacta del «sin scroll»

Recorrida la cadena de contenedores. Ninguno corta el desplazamiento de la página:

| Contenedor | Clases o estilo | Corta el scroll |
|---|---|---|
| `SidebarInset` (`components/ui/sidebar.tsx:317`) | `relative flex w-full flex-1 flex-col`, sin `overflow` ni alto fijo | no |
| `ScreenEnter` (`app/(private)/components/screen-enter.tsx:20`) | `display: contents` | no |
| raíz de `OperatorScreenFrame` | `@container flex min-h-dvh flex-col`, sin `overflow` | no |
| cabecera del marco | `sticky top-0`; solo se pega, no recorta | no |
| cuerpo del marco (`operator-body`) | `flex flex-1 flex-col gap-5 p-5`; **sin reserva**, porque la ejecución no le pasa `footer` | no |
| rejilla de la ejecución (`order-execution-screen.tsx:144`) | `grid items-start …`; cada columna mide su contenido | no |

La página **sí** se desplaza. Lo que falla es **dónde termina** ese desplazamiento:

1. El pie del paso a paso no es del marco: lo pinta `StepReader`
   (`step-reader.tsx:368-388`, `fixed inset-x-0 bottom-0`, unos 111 px más el margen seguro).
2. La reserva de su alto está **solo dentro de la columna del lector**
   (`step-reader.tsx:338`, `pb-[calc(140px+…)]`).
3. Con `items-start`, la fila de la rejilla mide `max(alto del panel, alto del lector + 140 px)`.
4. Cuando el panel es más alto que el lector más su reserva, que es lo que pasa con muchos
   materiales, la página termina 20 px (`p-5`) por debajo del panel.
5. Con la página desplazada hasta el final, los últimos ~130 px de la ventana son el pie, y el
   final del panel queda debajo. Desplazar más no se puede porque la página ya terminó: de ahí el
   «sin scroll».

En una columna (390 px) el panel va **encima** del lector y la reserva del lector cubre el final. Con
muchos materiales a 390 px no hay defecto; R4 lo fija igual para que no aparezca.

Hay una segunda causa, temporal y ya conocida (`e2e/operario-rediseno.spec.ts:379-383`). Mientras
corre la animación `screen-enter` (`app/globals.css:641`), el cuerpo lleva `transform`, y eso lo hace
bloque contenedor del pie `fixed`. Dura una animación y termina; el E2E espera a que acabe y
comprueba que el pie queda pegado al borde inferior de la ventana (R6).

### 4.2 Arreglo: reservar el alto del pie en la columna lateral

Cuando hay dos columnas, la columna lateral reserva **el mismo alto que ya reserva el lector**. Así
la fila de la rejilla siempre deja ese hueco al final, sea cual sea la columna más alta.

- `operator-screen-frame.tsx` exporta una constante con el literal completo, para que Tailwind la
  genere:

  ```ts
  /** Reserva del pie fijo de `StepReader` (`mode="ejecucion"`) en la columna lateral, solo con dos
   *  columnas. Mismo `calc` que el `pb-[…]` de `step-reader.tsx`: lo vigila operator-screen-frame.test. */
  export const STEP_READER_SIDE_COLUMN_RESERVE =
    '@min-[1101px]:mb-[calc(140px+env(safe-area-inset-bottom,0px))]';
  ```

- **Es margen y no relleno**, por dos motivos:
  - Con relleno, el hueco quedaría **dentro** de la `Card`, como un trozo de tarjeta vacío.
  - Con `align-self: start`, el margen inferior de un elemento de la rejilla sí cuenta para el alto
    de su fila.
- **Solo desde `@min-[1101px]`**, el mismo corte que pasa a dos columnas. En una columna el panel
  queda encima del lector y un margen ahí abriría un hueco de 140 px entre los dos (R8).
- **Dónde se aplica:**
  - **Ejecución:** `<OrderExecutionToolsPanel className={STEP_READER_SIDE_COLUMN_RESERVE} …/>`.
    `OrderExecutionToolsPanel` gana `className?: string`, que compone con `cn` sobre su `Card`.
  - **Empaque con paso a paso** (`packing-order-screen.tsx:284`): la `Card` de la izquierda recibe la
    constante **solo si `showsPackingSteps`**. Sin pasos, el pie es el del marco y el marco ya
    reserva su alto en el cuerpo; sumar las dos dejaría un hueco doble.
  - En las dos, la clase va **en la propia `Card`**, sin envoltorio. Así
    `packing-order-screen.test.tsx:656-660` (la `Card` es hija directa de la rejilla) y el ancla del
    E2E `R4` de QC-265 (`gridTracks`) siguen valiendo sin tocarlos.
- **`StepReader` no se toca.** Su reserva interna sigue protegiendo el contenido del paso (R5) y a
  cualquier otro consumidor.
- **Contra la deriva:** un test lee el `pb-[calc(…)]` del `<section data-testid="step-reader">`
  pintado en `mode="ejecucion"`, lo compara con el `mb-[calc(…)]` de la constante y exige el mismo
  `calc`. Si alguien cambia el alto del pie en uno de los dos sitios, el test se pone rojo.

### 4.3 Acondicionamiento y Empaque sin pasos: no cambian

Las dos pasan su pie al marco (`footer=`), y el marco reserva `pb-[calc(132px+…)]` en el **cuerpo
entero** (`operator-screen-frame.tsx:104`). La reserva está después de la rejilla, así que cubre
cualquier columna. Revisado `conditioning-order-screen.tsx:119-172` y
`packing-order-screen.tsx:250-258`: no tienen el defecto.

## 5. Por qué no se toca la cabecera de `DataTable`

Ver `requirements.md > P1`. Resumen:

- el arreglo cambia la cabecera de todas las columnas `end` de la app;
- rompe snapshots de paridad de 11 listas cerradas
  (`tests/unit/paridad/__snapshots__/*.snap` pintan `class="flex gap-2 items-center min-w-0"` en
  cada cabecera);
- dejaría las columnas `center` igual de mal.

Es una ficha de `DataTable`, no de esta pantalla.

## 6. Alternativas descartadas

**A. Reservar el alto del pie en el cuerpo de toda la pantalla y quitárselo a `StepReader`.** Una
prop del marco del tipo `reserveFooter` pondría la reserva en `operator-body`, como hace con su
propio pie, y `StepReader` dejaría de reservar. Se descarta por tres motivos:

- toca dos piezas compartidas: `StepReader`, que está en catálogo, y el marco;
- cambia `StepReader` para todos sus consumidores;
- si se deja la reserva de `StepReader`, con el lector como columna más alta la página termina con
  dos reservas seguidas (140 + 132 px de vacío).

La reserva en la columna lateral (§ 4.2) no tiene ninguno de los tres problemas.

**B. Panel con desplazamiento propio (`sticky` + `max-h` + `overflow-y-auto`).** Se descarta por tres
motivos:

- **Alto de la cabecera:** el `max-h` tendría que restar el alto de la cabecera fija, y ese alto
  varía. El título y el subtítulo se parten en varias líneas según la receta y el reparto, así que
  haría falta medirlo en tiempo de ejecución o fijar un número que fallaría.
- **Uso táctil:** un área desplazable dentro de una página desplazable atrapa el gesto en tableta.
  El operario arrastra sobre el panel, mueve solo el panel y no llega al paso.
- **R6:** el humano pidió que todo sea alcanzable, no un segundo scroll.

**C. Relleno inferior en la rejilla entera.** Con el lector como columna más alta, su reserva y la
de la rejilla se sumarían. Además la rejilla de la ejecución también se pinta en una columna, y ahí
el hueco sobraría.

## 7. Verificación

**Unit (jsdom: clases y DOM, no medidas)**

| Archivo | Qué comprueba | R |
|---|---|---|
| `tests/unit/asignaciones-ui/assigned-order-enter-trigger.test.tsx` | En BLOQUEADO y EN_CURSO el envoltorio de botón y aviso no es `flex` ni lleva `items-*`, así que hereda la alineación de su contenedor; botón, aviso y `aria-describedby` siguen como hoy | R1–R3 |
| `tests/unit/asignaciones-ui/operator-screen-frame.test.tsx` | `STEP_READER_SIDE_COLUMN_RESERVE` lleva el prefijo `@min-[1101px]:` y su `calc` es idéntico al del `pb-[…]` de `step-reader` en `mode="ejecucion"` | R4, R7, R8 |
| `tests/unit/asignaciones-ui/order-execution-screen.test.tsx` | La `Card` de `order-execution-materials` lleva la constante | R4, R8 |
| `tests/unit/asignaciones-ui/packing-order-screen.test.tsx` | Con paso a paso, la `Card` de la izquierda lleva la constante; sin paso a paso no la lleva; la `Card` sigue siendo hija directa de la rejilla | R7, R8 |
| `tests/unit/asignaciones-ui/order-execution-lines.test.tsx` | El nombre tiene su `data-testid` y lleva `flex-[1_1_12rem]`; las cifras están en un grupo propio, en el orden de R10; los `data-testid` existentes siguen en sus elementos | R9, R10 |

**E2E: se amplía `e2e/operario-rediseno.spec.ts`.** Ya está en `E2E_ESPERADOS`
(`tests/guards/guard-identificador-de-request.test.ts:394`) y en la lista de
`tests/unit/shared/data-table-alcance.test.ts:681`, así que **no cambia ninguna lista cerrada**.
Corre en Chromium y WebKit.

*Fixture: se añade al `beforeAll` existente*

- **Productos y recetas:**
  - `MANY_LINES = 24` productos de la empresa del fixture, con nombres largos de varias palabras (al
    menos uno con una palabra de más de 20 caracteres);
  - una receta «muchos materiales», con esas 24 líneas y porcentajes que sumen 100,00, y un paso con
    una sola casilla;
  - una receta «paso largo», con una línea al 100 % y un paso de `LONG_STEP_ITEMS = 30` casillas.
  - Para la forma de las líneas, igual que `e2e/ejecucion-receta.spec.ts:401-416`: el `INSERT`
    directo no valida la suma.
- **Pedidos del Operador, asignados a él:**
  - `execMany`, EN_CURSO, con la receta «muchos materiales»;
  - `execLongStep`, EN_CURSO, con la receta «paso largo»;
  - `execBlocked`, BLOQUEADO, con la receta base. El CHECK de `conditioned_by` admite BLOQUEADO sin
    él.
- **Limpieza:** `deleteCompanyData` añade, en el orden de sus FK, las líneas de receta y los
  productos del fixture, igual que `e2e/ejecucion-receta.spec.ts`.
- Ningún caso confirma nada: los pedidos no cambian de estado.

*Casos nuevos*

1. **`R1, R2, R3 — «Entrar» alineado en sus tres estados`.**
   - A 1440 × 900, en la tabla, con las filas de `execPending`, `execRunning` y `execBlocked`:
     - el borde derecho de `assigned-order-enter` es el mismo en las tres, con 1 px de tolerancia;
     - el borde derecho de cada `assigned-order-enter-reason` coincide con el de su botón, con 1 px
       de tolerancia.
   - A 390 × 844, en las tarjetas de los mismos pedidos: el borde izquierdo de
     `assigned-order-enter` es el mismo en las tres, con 1 px de tolerancia.
2. **`R4, R6, R9, R10 — panel con muchos materiales`.** Se abre `execMany` a 1440 × 900 y después a
   390 × 844. En cada ancho:
   - se espera a `waitForScreenEnterToSettle`;
   - se comprueba que `order-execution-materials` tiene `scrollHeight === clientHeight` y `overflow-y`
     `visible` (R6);
   - se desplaza la página hasta el final;
   - el borde inferior de `step-reader-actions` coincide con el de la ventana, con 1 px de
     tolerancia (R6);
   - el borde inferior de `order-execution-line-23` y el de `order-execution-materials` son
     menores o iguales que el borde superior de `step-reader-actions` (R4);
   - para cada línea, la caja de `order-execution-line-name-<i>` no corta a la de
     `order-execution-line-percentage-<i>` ni a la de `order-execution-line-quantity-<i>` (R9);
   - el ancho del nombre es al menos `min(192, ancho de la fila) − 1` px (R10).
3. **`R5 — paso largo`.** Se abre `execLongStep` en los mismos dos anchos y se desplaza hasta el
   final. El borde inferior de `step-reader-item-0-29` es menor o igual que el borde superior de
   `step-reader-actions`.

**Presupuesto E2E:**

- son tres casos más, con un `loginAndLand` cada uno;
- los productos se siembran con `createMany`;
- el job por navegador tiene 60 min (`.github/workflows/gate.yml:303`) y el `actionTimeout` de 30 s
  no se toca (`tests/guards/guard-e2e-presupuesto.test.ts`).

**Lo que este diseño no prueba en navegador:** R7, el empaque con paso a paso. Va con un test unitario
de la clase, según `requirements.md > P3`.

## 8. Riesgos

- **El alto del pie de `StepReader` crece**, por ejemplo con un motivo de bloqueo en dos líneas a
  390 px. La reserva de 140 px es la misma que ya usa el lector; si se queda corta, se queda corta
  en los dos sitios a la vez y el test de § 4.2 obliga a cambiarlos juntos. El E2E de R4 y R5 lo
  detectaría a 390 px.
- **Las listas cerradas no se tocan:** ni `E2E_ESPERADOS` ni `data-table-alcance`. El test de
  `packing-order-screen.test.tsx:653-661` sigue igual porque no se añade envoltorio.
