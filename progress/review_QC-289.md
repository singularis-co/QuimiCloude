# Review QC-289 — orden por defecto más nuevos primero; inventario por último lote

Diff revisado: `git diff origin/dev...HEAD` (e002f8b9, d9aea40c). `sdd: false`: se revisa contra
las Decisiones de `progress/features/QC-289.md`. Grafo MCP no usado; exploración con Grep/Read.

## Checklist

- [x] Trazabilidad decisión → test (mapas en `impl_QC-289-orden-defecto.md` e `impl_QC-289-inventario.md`):
  - Listados paginados `createdAt desc, id asc` → `tests/unit/shared/qc289-orden-por-defecto.test.ts` (it.each sobre los 8 `xxxOrderBy(null)`) + `list-query-*.int`.
  - Pedidos prioridad primero → mismo unitario («la prioridad sigue siendo el PRIMER criterio») + `list-query-orders`, `order-crud`, `order-repository`.
  - Inventario `last_batch_at desc nulls last, createdAt desc, id` → `tests/unit/inventario/product-last-batch-at.test.ts` + `list-query-products.int`.
  - Escritura solo al cargar lote (alta, lote sobre existente, importación terminado, producción) y no en ajuste/consumo → unit + `product-last-batch-at.int` + `finished-goods.int`.
  - Relleno `MAX(created_at)` / NULL sin lotes / down → `product-last-batch-at.int` «el UP rellena…».
  - Combos alfabéticos → unitario `listUnits` sin sort y `unit-repository.int`.
- [x] Tasks: no aplica (sin spec).
- [x] Ningún `*-catalog-prisma.ts` tocado; ningún orden por columna elegida cambiado (solo ramas `sort === null`).
- [x] `listUnits` modo catálogo alfabético es correcto: `listAll` solo lo usa `createListUnits` sin paginación, que alimenta selectores de unidad y el índice/selector «deriva de» de `configuracion/unidades/page.tsx`; la tabla paginada va por `listPage` → `unitOrderBy(null)` = `createdAt desc`.
- [x] Pedidos: `priority desc` sigue primero; dentro, `createdAt desc, orderYear desc, orderSequence desc, id asc`.
- [x] Migración `20261016120000_products_last_batch_at`: columna nullable, relleno por `MAX(product_batches.created_at)` agrupado por producto, índice parcial `(company_id, last_batch_at DESC NULLS LAST) WHERE deleted_at IS NULL` alineado con el `orderBy`, paréntesis RLS `NO FORCE`→`ENABLE`+`FORCE` igual que migraciones previas; `down.sql` borra índice y columna. Drift del índice documentado en `schema.prisma`. Listada en `guard-identificador-de-request`.
- [x] `last_batch_at` en las 4 rutas: `createWithFirstBatch` (`lastBatchAt: now` en el `product.create`, el lote usa el mismo `now`), `addBatchToAlive`, `addImportedFinishedGoodsBatch`, `receiveFinishedGoods` (`markBatchLoaded` con el mismo `now`/`input.now` que `toBatchCreateData`, sobre el mismo `tx`). Censo: solo 4 `productBatch.create` en `lib/`; ninguna otra ruta escribe la columna.
- [x] `markBatchLoaded` filtra `id` **y** `company_id` (de `InventoryScope.companyId`, no anulable); el unitario fija los valores `[now, productId, companyId]`.
- [x] E2E: `recetas.spec.ts` ajustado (siembra `createdAt` explícito). `inventario.spec.ts` solo JSDoc (ya paginaba buscando por nombre). Revisados `marca-componentes` (empresa propia con un único cliente → primera fila válida), `pedidos-busqueda` (compara conjuntos o la misma página antes/después), resto sin asunciones de orden alfabético por defecto. Ninguno pendiente.
- [x] Sin dependencias nuevas; sin UI; sin tablas nuevas.
- [ ] Comentarios de producción (perfil reviewer n.º 9): ver hallazgo 1.

## Verificación ejecutada (salida real)

- `pnpm run typecheck`: exit 0.
- `pnpm run lint`: 0 errors, 7 warnings (preexistentes, fuera del diff).
- `vitest run` unit (qc289-orden-por-defecto, product-last-batch-at, finished-goods-prisma, list-orders, list-use-cases): 5 files, 86 passed.
- `vitest run tests/guards`: 72 files, 993 passed, 14 skipped.
- `vitest run --project integration`: product-last-batch-at, list-query-products, finished-goods, list-query-units, list-query-orders → 5 files, 67 passed; los otros 12 `.int` modificados → 12 files, 192 passed.

## Hallazgos

1. **BLOQUEANTE** — Comentarios de producción añadidos que citan `QC-<n>`/`R<n>` (`docs/conventions.md > Comentarios`, perfil reviewer n.º 9). Líneas añadidas en:
   - `customer-prisma.ts` (`(QC-289)`), `user-admin-prisma.ts` (`(QC-289; … R30)`), `work-group-prisma.ts` (`(QC-289)`),
   - `presentation-prisma.ts` (`(QC-289)`), `order-prisma.ts` (`(QC-289)` y `(QC-33 R16)`),
   - `supplier-catalog-line-prisma.ts` (`(QC-289; …)`), `supplier-prisma.ts` (`(QC-289)`), `recipe-prisma.ts` (`(QC-289)`),
   - `unit-prisma.ts` (dos: JSDoc de `defaultOrderBy` y de `listUnits`).
   Quitar las referencias y dejar solo el porqué (p. ej. «la prioridad manda» sin `QC-33 R16`; sin «antes era…»). `product-prisma.ts`, migración y `schema.prisma` están limpios.
2. menor — Comentarios/contratos preexistentes que el cambio deja **falsos** (describen el orden por defecto viejo). El más serio es el del puerto: `lib/modules/pedidos/ports/order-repository.ts:45` (`created_at ASC, order_year ASC…`). También `proveedores/domain/list-catalog-lines.ts:49`, `proveedores/domain/list-suppliers.ts:39`, `identity/ports/work-group-repository.ts:143`, `identity/domain/list-work-groups.ts:43`, `identity/domain/user-queryable.ts:31`, `identity/domain/work-group-queryable.ts:30`, `app/(private)/configuracion/usuarios/components/work-group-list-params.ts:47`. Recomendado corregirlos en esta misma ronda (o commit `chore` aparte).
3. menor — `db/schema.prisma`, `Product.lastBatchAt`: «Solo la escribe la carga de un lote (alta o importacion)» omite el lote de producción, que tras la tanda 2 también la escribe. La cabecera de `migration.sql` sí está al día.
4. menor — No hay test de acceso cruzado específico para `markBatchLoaded`; queda cubierto por el filtro `company_id` en el SQL, el unitario que fija `companyId` en los parámetros y que todas las rutas llegan con un `productId` ya leído dentro del ámbito. Aceptable.

## Veredicto

**RECHAZADO** — un bloqueante: hallazgo 1 (citas `QC-<n>`/`R<n>` en comentarios añadidos de 9 adaptadores de producción). El comportamiento, la migración, la escritura de `last_batch_at` y los tests están correctos y en verde; al corregir los comentarios (y, recomendado, los hallazgos 2 y 3) queda listo.
