# QC-270 — Bitácora de implementación

Rama `feature/QC-270-cabecera-alineada`, worktree `.worktrees/QC-270-cabecera-alineada`.

## Tanda 1 — La cabecera sigue a su columna (T1–T3)

Implementa `frontend_dev`.

### Archivos

- `components/shared/data-table/data-table-column-style.ts`: `toColumnAlignClass` y
  `toColumnJustifyClass` (end → `text-right`/`justify-end`, center → `text-center`/`justify-center`,
  start → `''`).
- `components/shared/data-table/data-table-header-menu.tsx`: el `<th>` usa `toColumnAlignClass`; el
  contenedor de la etiqueta añade `toColumnJustifyClass`.
- `components/shared/data-table/data-table.tsx`: fuera el `columnAlign` local; la celda del cuerpo
  usa `toColumnAlignClass`.
- `tests/unit/shared/data-table-header-menu.test.tsx`: dos `describe` nuevos.

### Rojo de T1 (antes de tocar producción)

`pnpm exec vitest run tests/unit/shared/data-table-header-menu.test.tsx`:
`Tests 5 failed | 16 passed (21)`.

- R1 y R2 fallan (no hay `justify-end` ni `text-center` en la cabecera).
- Los 3 casos de las funciones puras fallan con `TypeError: toColumnAlignClass is not a function`.
- R3–R7 y los 10 casos previos pasan.

### Verde (después de T2–T3)

- Mismo archivo: `Test Files 1 passed (1) · Tests 21 passed (21)`.
- `pnpm run typecheck`: sin errores.
- `pnpm run lint`: 0 errors, 7 warnings (`no-unused-vars` preexistentes en
  `confirm-catalog-import.test.ts` y `order-service.test.ts`).
- `pnpm exec vitest related --run` de los 3 archivos de producción:
  `Test Files 11 failed | 223 passed (234) · Tests 17 failed | 3817 passed | 1 skipped · Snapshots 17 failed`.
  Los 17 fallos son snapshots de los 11 `.snap` de paridad de `tasks.md > Archivos esperados`
  (asignacion 4, asignacion-acondicionamiento 3, inventario 2, y 1 en catalogo, clientes, grupos,
  pedidos, presentaciones, recetas, unidades, usuarios). Se regeneran en T4.

## Tanda 2 — Snapshots de paridad (T4, R8)

`pnpm exec vitest run tests/unit/paridad -u`: `Snapshots 17 updated · Test Files 22 passed (22) ·
Tests 412 passed (412)`. Cambian exactamente los 11 `.snap` de `tasks.md > Archivos esperados`;
ningún otro. Commit `4b91158f`, solo con los `.snap` (11 archivos, +47 -47).

Revisión mecánica: `node revisa-snaps.mjs` sobre `git diff -U1 -- tests/unit/paridad/__snapshots__`.
Empareja cada línea `-` con su `+`, exige que fuera de `class` la línea sea idéntica y que:
el `th` sea `data-testid="data-table-head-*"` y solo gane `text-center`; o el `div` siga
inmediatamente a un `th` de cabecera y solo gane `justify-end` (si el `th` lleva `text-right`) o
`justify-center` (si lleva `text-center`), sin perder ninguna clase. Salida:

```
Archivos: 11
  asignacion-acondicionamiento-paridad.test.tsx.snap  -5 +5
  asignacion-paridad.test.tsx.snap  -6 +6
  catalogo-paridad.test.tsx.snap  -4 +4
  clientes-paridad.test.tsx.snap  -1 +1
  grupos-paridad.test.tsx.snap  -1 +1
  inventario-paridad.test.tsx.snap  -14 +14
  pedidos-paridad.test.tsx.snap  -9 +9
  presentaciones-paridad.test.tsx.snap  -2 +2
  recetas-paridad.test.tsx.snap  -3 +3
  unidades-paridad.test.tsx.snap  -1 +1
  usuarios-paridad.test.tsx.snap  -1 +1
Total -47 +47 | th cambiados 11 | div cambiados 36
Cambios en th: {"-[text-left] +[text-center]":11}
Sin fallos: toda linea cambiada es un th de cabecera (text-left -> text-center) o su div inmediato (+justify-end/+justify-center segun el th).
```

**Desviación respecto a `tasks.md > T4` («no sale ninguna clase»):** en los 11 `th` de columnas
`center`, `text-center` **sustituye** a `text-left`, que trae la primitiva `TableHead`; `twMerge`
(dentro de `cn`) resuelve el conflicto quitando la clase vieja, igual que ya pasaba con
`text-right` en las columnas `end`. Es una clase de alineación de la cabecera, así que cumple R8; la
revisión la admite de forma explícita (solo `text-left` puede salir, y solo en el `th`). Las
cabeceras `end` no cambian en el `th` (ya llevaban `text-right`); sus `div` ganan `justify-end`
(25) y los de `center` ganan `justify-center` (11).

## Tanda 3 — Cierre (T5)

### Mapa R<n> -> test

Todos en `tests/unit/shared/data-table-header-menu.test.tsx` salvo R8.

| R | Test |
|---|---|
| R1 | «R1: una columna end pinta la cabecera con text-right y la etiqueta agrupada con justify-end»; «R1, R7: end se traduce a text-right y justify-end» |
| R2 | «R2: una columna center pinta la cabecera con text-center y la etiqueta agrupada con justify-center»; «R2, R7: center se traduce a text-center y justify-center» |
| R3 | «R3: una columna start no gana clase de alineacion en la cabecera ni de reparto en su etiqueta»; «R3, R7: start no produce clase en ninguna de las dos» |
| R4 | «R4: activar por clic la etiqueta de una columna end o center ordena y aria-sort pasa a ascending»; «R4: activar por teclado …» |
| R5 | «R5: el menu de una columna end o center ordena descendente y fija la columna» |
| R6 | «R6: en las tres alineaciones el boton de orden precede en el DOM al disparador del menu» |
| R7 | «R7: las celdas del cuerpo conservan text-right en end, text-center en center y ninguna en start» (+ los tres casos de funciones puras) |
| R8 | T4: los 11 `tests/unit/paridad/__snapshots__/*-paridad.test.tsx.snap` regenerados + la revisión mecánica de arriba |

### P3 (etiqueta recortada)

No se revisaron las listas en el navegador en esta sesión: sin observación que anotar.

### Gate

`./init.sh` (rápido): `exit=0`, `== init OK ==`. typecheck pasa; lint pasa (0 errors, 7 warnings
preexistentes); `vitest related`: `Test Files 234 passed (234)`; guardias:
`Test Files 113 passed (113) · Tests 1593 passed | 37 skipped`. Avisos amarillos ajenos: base de
desarrollo 4 migraciones atrás (no afecta a los tests) y 64 tests de árbol que solo corre el CI.
