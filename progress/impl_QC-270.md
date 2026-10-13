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
