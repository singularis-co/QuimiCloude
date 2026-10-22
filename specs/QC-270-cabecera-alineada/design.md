# QC-270 — Diseño: cabecera de DataTable alineada con su columna

## Lo que ya existe

Buscado `cabecera alineada`, `justify-end`, `text-right`/`text-center` en cabecera y `align` de
columna, en `feature_list.json` (todos los estados), `specs/` y el grafo del worktree.

- **Board:** solo esta ficha (QC-270). QC-257 («Shell del rediseño: cabecera…») habla de la
  cabecera de la app, no de la de las tablas.
- **Specs:** `specs/QC-269-layout-operario/requirements.md > P1` es el origen de esta ficha y la deja
  fuera de QC-269. Ningún spec cerrado especifica la alineación de la cabecera de `DataTable`.
- **Código:**
  - `DataTableHeaderCell` (`components/shared/data-table/data-table-header-menu.tsx:190-243`) ya
    pone `text-right` en el `<th>` cuando `align === 'end'` (línea 216), pero **nada** para
    `center`, y su contenido va en `<div class="flex min-w-0 items-center gap-2">` (línea 222) sin
    `justify-*`. Como el contenido es un `flex`, `text-right` no lo mueve: la etiqueta queda a la
    izquierda en las dos alineaciones.
  - `columnAlign` (`components/shared/data-table/data-table.tsx:291-299`) traduce `align` a
    `text-right`/`text-center` para las **celdas del cuerpo** (`data-table.tsx:379`). Es la segunda
    traducción de la misma propiedad, y ya se separó de la de la cabecera (la de cabecera olvida
    `center`).
  - `toColumnTextClass` (`components/shared/data-table/data-table-column-style.ts:34-38`) es el
    sitio donde ya viven las clases que dependen de la columna y que comparten cabecera y cuerpo.
- **Catálogo (`components/shared/CATALOGO.md`):** fila `DataTable` (línea 59), que lista `align`
  implícito en «columnas declarativas» y no dice nada de la cabecera; fila `Table` (línea 39), la
  primitiva, que no se toca.
- **Se reutiliza:** `DataTableHeaderCell` y `data-table-column-style.ts`. **Regla de decisión:**
  paso 1 (reutilizar) y corrección de la pieza existente; no hay componente nuevo, ni prop nueva, ni
  cambio de API pública. La fila del catálogo no cambia: el punto de extensión (`align`) ya existe.

## Tablero que respalda el cambio visual

`docs/diseno/canvas/Tabla.dc.html:40-41`: las cabeceras «Cantidad» y «Fecha de solicitud» llevan
`class="num"` (`docs/diseno/canvas/qc.css:58`, `.num{text-align:right}`), la segunda con su botón de
orden dentro. Es decir, el tablero de la tabla ya dibuja la cabecera con la alineación de su
columna; la app no la seguía. Lo mismo en `Asignacion.dc.html:155` (`cls: 'num'` en las cabeceras
de cantidad, envases y fecha) y en `Usuarios.dc.html:178` («Acciones» a la derecha).
Ningún tablero dibuja una cabecera centrada: se aplica la misma regla con el otro valor
(`requirements.md > P2`).

## 1. El cambio

### 1.1 Una sola traducción de `align` para cabecera y cuerpo

En `data-table-column-style.ts`, dos funciones puras junto a `toColumnTextClass`:

```ts
export function toColumnAlignClass<TRow>(column: Pick<DataTableColumn<TRow>, 'align'>): string
// 'end' -> 'text-right', 'center' -> 'text-center', 'start' -> ''

export function toColumnJustifyClass<TRow>(column: Pick<DataTableColumn<TRow>, 'align'>): string
// 'end' -> 'justify-end', 'center' -> 'justify-center', 'start' -> ''
```

- `data-table.tsx` sustituye su `columnAlign` local por `toColumnAlignClass(column)` en la celda del
  cuerpo. Mismo resultado de clases para las tres alineaciones (R7): los snapshots no cambian en las
  celdas del cuerpo.
- `DataTableHeaderCell`:
  - el `<th>` cambia `column.align === 'end' && 'text-right'` por `toColumnAlignClass(column)`
    (gana `text-center` para `center`, R2);
  - el `<div>` de la línea 222 añade `toColumnJustifyClass(column)` (R1, R2).
- `start` devuelve `''` en las dos, que `cn` descarta: ni el `<th>` ni el `<div>` ganan clases
  (R3), y las cabeceras `start` de los snapshots no se mueven.

### 1.2 Lo que no cambia

- **Orden en el DOM (R6):** etiqueta (o su `<button>` de orden) y después `children` (el
  `DataTableHeaderMenu`). Solo cambia el reparto del `flex`, no el orden. El disparador del menú
  queda pegado a la etiqueta, a su derecha, en las tres alineaciones.
- **Orden y menú (R4, R5):** `toggleHeaderSort`, `aria-sort`, `SortIcon` y el `DropdownMenu` no se
  tocan. El contenido del menú mantiene `align="start"` respecto a su disparador; Base UI ya lo
  recoloca si choca con el borde derecho de la ventana.
- **Divisor de columna:** `DataTableColumnDivider` es `absolute` y va fuera del `<div>` flex: no le
  afecta el reparto.
- **Ancho:** `toWidthStyle` y `toColumnTextClass` siguen en el `<th>`.
- **`actionsColumn()`** sigue con `align: 'end'` por defecto; su cabecera «Acciones» pasa a la
  derecha sin tocar `actions-column.tsx`.

### 1.3 Modelo de datos, rutas, contratos

No hay: cambio solo de presentación en una pieza cliente. Sin tablas, sin RLS, sin migraciones,
sin rutas, sin Server Actions. La API de `DataTableColumn` no cambia. Sin dependencias nuevas.

### 1.4 Multiplataforma

`justify-content` en `flex` y `text-align` en `<th>` funcionan igual en WebKit (iOS) y Chrome
Android. El objetivo táctil del botón de orden y del disparador (`touchTarget`) no cambia.

## 2. Tests

- **Unitario nuevo (R1–R7)** en `tests/unit/shared/data-table-header-menu.test.tsx`: monta
  `DataTable` con tres columnas ordenables —`start`, `end`, `center`— y comprueba:
  - R1/R2/R3: clases del `<th>` (`data-table-head-<id>`) y del contenedor de su etiqueta
    (`text-right` + `justify-end`; `text-center` + `justify-center`; ninguna de las cuatro en
    `start`);
  - R4: clic en la etiqueta de `end` y de `center` emite el orden y `aria-sort` pasa a
    `ascending`;
  - R5: abrir el menú de `end` y `center` (`data-table-header-menu-<id>`), ordenar descendente y
    fijar (`data-pinned`);
  - R6: dentro de cada `<th>`, el botón de orden precede al disparador del menú
    (`compareDocumentPosition`);
  - R7: las celdas del cuerpo (`data-table-cell-<id>`) conservan `text-right`/`text-center`/nada.
  Se localiza todo por `data-testid` y por rol; el contenedor de la etiqueta es el primer hijo
  elemento del `<th>`.
- **Unitario de las funciones puras** en el mismo archivo: `toColumnAlignClass` y
  `toColumnJustifyClass` para los tres valores.
- **Snapshots de paridad (R8):** se regeneran las 11 listas
  (`tests/unit/paridad/__snapshots__/*-paridad.test.tsx.snap` de `tasks.md > Archivos esperados`),
  localizadas con `grep` de las cabeceras con `text-right` en los `.snap` y de las columnas
  `align: 'center'` de `app/`. El commit de snapshots va **solo** con snapshots, y su diff se revisa
  de forma mecánica (`tasks.md > T4`).

## 3. Alternativas descartadas

1. **Arreglarlo solo en la cabecera, sin unificar con el cuerpo** (añadir `text-center` y
   `justify-*` dentro de `DataTableHeaderCell` y dejar `columnAlign` en `data-table.tsx`).
   Descartada: dos traducciones de la misma propiedad son justo lo que produjo el fallo —la de
   cabecera ya olvidaba `center`—. Una función compartida obliga a que cabecera y cuerpo cambien
   juntos.
2. **Quitar el `flex` del contenedor y dejar que `text-align` del `<th>` mueva el contenido como
   texto en línea.** Descartada: el `flex` es el que alinea en vertical la etiqueta, el icono y el
   disparador de 44 px y fija el `gap`; sin él, el disparador cae a otra línea o se desalinea, y
   cambia también la cabecera de todas las columnas `start`.
3. **`flex-row-reverse` en las columnas `end`** para dejar el menú en el borde. Descartada: invierte
   el orden visual frente al del DOM (R6) y el lector de pantalla y el foco irían al revés de lo que
   se ve.
4. **Variantes `justify-end-safe`/`justify-center-safe` de Tailwind 4** para que una etiqueta que no
   cabe se recorte por el final. Descartada por ahora: nadie usa esas variantes en el repo y no hay
   un caso observado de etiqueta que no quepa (`requirements.md > P3`).

## 4. Riesgos y choques

- **QC-269 (en curso, otra rama):** ninguno de sus `Archivos esperados` está en los de esta ficha.
  QC-269 declara que ningún snapshot de paridad pinta el disparador de «Entrar», así que no
  regenera `asignacion-paridad.test.tsx.snap`; esta ficha sí lo regenera. Si QC-269 llegara a
  tocarlo, quien mergee segundo regenera ese snapshot sobre `dev`.
- **Guardias de rama** que listan `components/shared/data-table/*` como intocables
  (`guard-pantalla-pedidos-se-amplia.test.ts`, `data-table-alcance.test.ts > Alcance QC-56`) solo
  miden en la rama de su ficha y se saltan aquí.
- **Snapshots ajenos en vuelo:** cualquier otra ficha que regenere uno de estos 11 snapshots choca
  en archivo; lo detecta `scripts/archivos-en-vuelo.mjs` con la lista de `tasks.md`.
