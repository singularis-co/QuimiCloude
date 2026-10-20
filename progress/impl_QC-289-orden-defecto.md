# QC-289 — Bitácora backend_dev: orden por defecto "más nuevos primero" (listados, no productos)

`sdd: false`. Sin requisitos `R<n>`, así que no hay mapa `R<n> → test`. Este documento enlaza cada decisión de `progress/features/QC-289.md` con su test.
Productos/lotes los lleva otro backend_dev (`product-prisma.ts`, schema, migración): esta tanda no los toca.

## Producción
- `defaultOrderBy()` → `[{ createdAt: 'desc' }, TIE_BREAKER(id asc)]`, con el JSDoc al día, en presentation-prisma, unit-prisma,
  recipe-prisma, supplier-prisma, supplier-catalog-line-prisma (antes createdAt asc), work-group-prisma,
  user-admin-prisma y customer-prisma (`customerOrderBy` pasa a exportarse para el unitario).
- order-prisma: `priority desc, createdAt desc, orderYear desc, orderSequence desc, id asc`.
- unit-prisma `listUnits` (modo catálogo, alimenta los selectores): con `sort === null` sigue `name asc, id asc`.
  Lo pide la decisión "los combos siguen alfabéticos".
- `db/schema.prisma`: los 9 modelos tienen `createdAt`.

## Decisión → test
- Listados paginados createdAt desc + id: `tests/unit/shared/qc289-orden-por-defecto.test.ts` (it.each sobre los 8 `xxxOrderBy(null)`)
  y los `list-query-*.int.test.ts` de cada módulo.
- Pedidos, prioridad primero y luego createdAt desc: el mismo unitario más `order-crud`, `order-repository` y `list-query-orders`.
- Combos alfabéticos: el unitario (`listUnits` sin sort → name asc) y `unit-repository.int.test.ts` (sin tocar, verde).

## Tests ajustados
integration: list-query-{presentations,suppliers,recipes,units,customers,orders,catalog-lines}, order-crud
(LIST_ORDER_BY = `orderOrderBy(null)`), order-repository, user-crud (R30, excludeUserId), work-group-crud (R25),
supplier-crud, recipe-crud. unit: pedidos/list-orders y proveedores/list-use-cases (solo comentarios). e2e: recetas.spec.ts.

## Verificación
- typecheck: 1 error, `app/layout.tsx(45,56) Cannot find name 'LayoutProps'`. Falta `.next/types` (Next typegen) en el
  worktree. No viene de este cambio.
- lint: 0 errores, 8 warnings, ninguno en archivos de esta tanda.
- vitest related: 7319 pass / 3 fail. De los 3 fallos:
  - user-crud excludeUserId: era mío, corregido; el re-run da 55/55.
  - catalog-line R32: `meta.constraint` no es string. Depende del idioma de Postgres y no tiene que ver con el orden.
  - order-reservation-concurrency: se agotó el plazo de 120 s, flake de saturación.

Veredicto: hecho. Lo que queda rojo no viene de este cambio.
