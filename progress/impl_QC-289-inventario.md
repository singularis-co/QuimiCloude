# QC-289 — Inventario por último lote cargado (backend_dev)

`sdd: false`: sin `R<n>`; el mapa va contra las Decisiones de `progress/features/QC-289.md`.
Los `defaultOrderBy` de los demás listados son de otro backend_dev en este mismo worktree.

## Archivos
- `db/migrations/20261016120000_products_last_batch_at/{migration.sql,down.sql}` (nuevo):
  columna `products.last_batch_at timestamptz NULL`, relleno `max(product_batches.created_at)` por
  producto, índice parcial `products_company_id_last_batch_at_idx (company_id, last_batch_at DESC
  NULLS LAST) WHERE deleted_at IS NULL`; paréntesis de RLS `NO FORCE`/`FORCE` para que el relleno
  vea filas.
- `db/schema.prisma`: `Product.lastBatchAt` (índice en la migración, drift documentado).
- `lib/modules/inventario/adapters/driven/persistence/product-prisma.ts`: `defaultOrderBy` nuevo,
  JSDoc de `TIE_BREAKER`, `markBatchLoaded` (privada, SQL crudo, no mueve `updated_at`).
- Tests: `tests/unit/inventario/product-last-batch-at.test.ts` (nuevo),
  `tests/integration/inventario/product-last-batch-at.int.test.ts` (nuevo, censo `commit`),
  `tests/integration/inventario/list-query-products.int.test.ts`,
  `tests/integration/inventario/product-crud.int.test.ts`, `tests/integration/aislamiento.json`,
  `tests/guards/guard-identificador-de-request.test.ts` (lista de migraciones),
  `e2e/inventario.spec.ts` (solo un JSDoc que decía «orden fijo por nombre»).

## Rutas que crean lotes
Escriben `last_batch_at` (mismo `now` que el `created_at` del lote, misma transacción):
- `createWithFirstBatch` (alta manual e importación de materia prima/envase): en el `product.create`.
- `addBatchToAlive` (lote sobre producto existente, manual o importación): `markBatchLoaded`.
- `addImportedFinishedGoodsBatch` (importación de producto terminado): `markBatchLoaded`.

No la escribe:
- `receiveFinishedGoods`: lote creado por una producción (Terminar el empaque). Decisión humana.
- Ninguna otra ruta crea lotes en `lib/` (censo de `guard-libro-de-inventario`).

## Mapa decisión → test
- Orden por defecto → unit `productOrderBy(null)`; int `list-query-products` «ordena por último
  lote descendente…» y «decide el identificador»; int `product-crud` R35 (desempate).
- Alta con primer lote la escribe = `created_at` del lote → int «el alta con primer lote…».
- Lote nuevo sobre existente la avanza, sin mover `updated_at` → int «un lote nuevo…».
- Importación de terminado la escribe → unit «el lote importado de producto terminado…».
- Ajuste no la toca → int «un ajuste de existencia no la toca».
- Producción no la toca → unit «el lote de una produccion no la toca».
- Consumo no la toca → unit «el consumo de un pedido no la toca».
- Relleno `MAX(created_at)` y NULL sin lotes; DOWN revierte → int «el UP rellena…».

## Verificación (salida real)
- `pnpm run typecheck`: sin errores (tras `next typegen`, faltaba en el worktree recién montado).
- `pnpm run lint`: `0 errors, 7 warnings`, todos en `tests/unit/documentos/confirm-catalog-import.test.ts`
  y `tests/unit/pedidos/order-service.test.ts`, preexistentes y no tocados.
- `vitest run` unit nuevo + `finished-goods-prisma.test.ts`: 2 files, 12 passed.
- `vitest run --project integration` `product-last-batch-at` + `list-query-products`: 2 files,
  24 passed (plantilla nueva `qct_tpl_f8f47b8c9ae3` construida con la migración).
- `vitest run guard`: 1 rojo (`guard-identificador-de-request`, migración nueva sin listar) →
  corregido; el archivo pasa 23/23.

## Veredicto
Hecho: inventario ordenado por último lote cargado, escrito solo en cargas, con tests en verde.
