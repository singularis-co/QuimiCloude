# QC-270 — Tasks

Tres tandas. Implementa `frontend_dev`. Verificación de cada tanda: `pnpm run typecheck`,
`pnpm run lint` y `pnpm exec vitest related --run <archivos tocados>`; al cerrar, `./init.sh`.

## Tanda 1 — La cabecera sigue a su columna (R1–R7)

- [x] **T1 — Tests en rojo.** En `tests/unit/shared/data-table-header-menu.test.tsx`, un `describe`
  nuevo con los casos de `design.md > 2` (R1–R7) y los de `toColumnAlignClass` /
  `toColumnJustifyClass`, con `R<n>` en el nombre de cada caso.
  *Hecho:* los casos de R1, R2 y las funciones puras fallan contra el código de hoy; R3–R7 pasan
  (fijan lo que no debe romperse). El fallo se anota en `progress/impl_QC-270.md`.
- [x] **T2 — Funciones puras.** Depende de T1. `toColumnAlignClass` y `toColumnJustifyClass` en
  `components/shared/data-table/data-table-column-style.ts` (`design.md > 1.1`).
  *Hecho:* sus casos de T1 en verde.
- [x] **T3 — Cabecera y cuerpo usan la misma traducción.** Depende de T2.
  `DataTableHeaderCell` aplica `toColumnAlignClass` al `<th>` y `toColumnJustifyClass` al
  contenedor de la etiqueta; `data-table.tsx` sustituye `columnAlign` por `toColumnAlignClass`.
  Sin comentarios que citen fichas ni requisitos.
  *Hecho:* todo T1 en verde; `pnpm exec vitest related --run` de los tres archivos de producción en
  verde **salvo** los 11 snapshots de paridad, que fallan solo por las cabeceras `end`/`center`
  (se regeneran en T4).

## Tanda 2 — Snapshots de paridad (R8)

- [x] **T4 — Regenerar y revisar.** Depende de T3. `pnpm exec vitest run tests/unit/paridad -u` y
  revisión mecánica del diff de los 11 `.snap` de `## Archivos esperados`:
  - toda línea cambiada es un `th … data-testid="data-table-head-<id>"` de una columna `end` o
    `center` o el `div` inmediato que le sigue;
  - en el `th` solo entra `text-center` (columnas `center`); en el `div` solo entra `justify-end` o
    `justify-center`; no sale ninguna clase, salvo el `text-left` de `TableHead` en el `th` de las
    columnas `center`, que `twMerge` sustituye por `text-center` (desviación aceptada por el leader
    el 2026-10-13);
  - el número de líneas `-` y `+` coincide (ninguna línea añadida ni quitada).
  El comando de revisión y su salida van a `progress/impl_QC-270.md`. Un `.snap` fuera de la lista
  que cambie, o una línea que no cumpla lo anterior, para la tanda y se devuelve al leader.
  *Hecho:* `pnpm exec vitest run tests/unit/paridad` en verde; commit
  `test(QC-270): regenera snapshots de paridad por la cabecera alineada` con **solo** los `.snap`.

## Tanda 3 — Cierre

- [x] **T5 — Trazabilidad y gate.** Depende de T4. Mapa `R1..R8 -> test` en
  `progress/impl_QC-270.md` (R8 -> T4: snapshots regenerados + salida de la revisión mecánica).
  Anota ahí, si se observa al revisar las listas en el navegador, alguna etiqueta recortada
  (`requirements.md > P3`). `./init.sh` en verde.
  *Hecho:* mapa completo, `./init.sh` en verde.

## Archivos esperados

Producción:

- `components/shared/data-table/data-table-column-style.ts`
- `components/shared/data-table/data-table-header-menu.tsx`
- `components/shared/data-table/data-table.tsx`

Tests:

- `tests/unit/shared/data-table-header-menu.test.tsx`
- `tests/unit/paridad/__snapshots__/asignacion-paridad.test.tsx.snap`
- `tests/unit/paridad/__snapshots__/asignacion-acondicionamiento-paridad.test.tsx.snap`
- `tests/unit/paridad/__snapshots__/catalogo-paridad.test.tsx.snap`
- `tests/unit/paridad/__snapshots__/clientes-paridad.test.tsx.snap`
- `tests/unit/paridad/__snapshots__/grupos-paridad.test.tsx.snap`
- `tests/unit/paridad/__snapshots__/inventario-paridad.test.tsx.snap`
- `tests/unit/paridad/__snapshots__/pedidos-paridad.test.tsx.snap`
- `tests/unit/paridad/__snapshots__/presentaciones-paridad.test.tsx.snap`
- `tests/unit/paridad/__snapshots__/recetas-paridad.test.tsx.snap`
- `tests/unit/paridad/__snapshots__/unidades-paridad.test.tsx.snap`
- `tests/unit/paridad/__snapshots__/usuarios-paridad.test.tsx.snap`

Spec y estado:

- `specs/QC-270-cabecera-alineada/requirements.md`
- `specs/QC-270-cabecera-alineada/design.md`
- `specs/QC-270-cabecera-alineada/tasks.md`
- `progress/impl_QC-270.md`
- `progress/features/QC-270.md`

## Listas cerradas revisadas que no cambian

Van fuera de `## Archivos esperados` para que `scripts/archivos-en-vuelo.mjs` no las cuente como
tocadas:

- Los tests de paridad (`tests/unit/paridad/*-paridad.test.tsx`): no se editan, solo sus `.snap`.
- asignacion-listas-paridad.test.tsx.snap y el resto de `.snap` de paridad: no pintan ninguna
  cabecera `data-table-head-*` (comprobado con grep en los `.snap`).
- data-table-alcance.test.ts: la lista cerrada de E2E no gana entradas; esta ficha no añade E2E.
- `components/shared/CATALOGO.md`: la fila `DataTable` no cambia (no hay prop ni pieza nueva).
- Archivos de QC-269 (`specs/QC-269-layout-operario/tasks.md > Archivos esperados`): ninguno se toca,
  `assigned-order-enter-trigger.tsx` incluido.
