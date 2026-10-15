# QC-284 — bitacora de implementacion (backend_dev)

## Tanda 1 — T1, T2, T3, T4 (2026-10-14)

### Archivos

Creados:
- `db/migrations/20261014200000_product_batches_lot_per_presentation/migration.sql`
- `db/migrations/20261014200000_product_batches_lot_per_presentation/down.sql`
- `tests/unit/inventario/schema/product-batch-lot-per-presentation-migration.test.ts`
- `tests/integration/inventario/product-batch-lot-per-presentation-migration.int.test.ts`
- `tests/integration/inventario/product-batch-lot-per-presentation.int.test.ts`

Modificados:
- `db/schema.prisma` (fuera `@@unique([companyId, lot])`; comentario del modelo reescrito)
- `lib/modules/inventario/adapters/driven/persistence/product-prisma.ts` (`isDuplicateBatchLot` con los dos conjuntos; texto del error de reintento agotado)
- `lib/modules/errores/domain/error-catalog.ts` (texto de `batch_duplicate_lot`)
- `tests/guards/guard-identificador-de-request.test.ts` (migracion conocida)
- `tests/integration/aislamiento.json` (dos entradas `commit`)
- `tests/unit/inventario/schema/inventario-schema.test.ts`
- `tests/unit/inventario/product-batch-lot-retry.test.ts`
- `tests/unit/errores/catalogo.test.ts`
- `tests/integration/inventario/product-batch-lot.int.test.ts` (R11/R13 de QC-81 a la clave; el sandbox de su migracion revierte antes la de QC-284)

### Mapa R<n> -> test

| R | Archivo | Caso |
|---|---|---|
| R1 | `tests/integration/inventario/product-batch-lot-per-presentation.int.test.ts` | `R1, R6: dos lotes con el mismo producto, presentacion y codigo dan P2002 y isDuplicateBatchLot lo reconoce` |
| R1 | `tests/integration/inventario/product-batch-lot.int.test.ts` | `QC-284 R1: un duplicado de la misma clave por SQL crudo lo rechaza product_batches_product_presentation_lot_unique con 23505` |
| R1, R2 | `tests/unit/inventario/schema/inventario-schema.test.ts` | `R1, R2: ProductBatch no declara ningun @@unique que incluya lot, ...` |
| R1, R2, R28 | `tests/unit/inventario/schema/product-batch-lot-per-presentation-migration.test.ts` | `R1, R2, R28: el UP crea los dos indices parciales y despues quita el de (empresa, codigo)` |
| R1, R2, R3, R4 | `tests/integration/inventario/product-batch-lot-per-presentation-migration.int.test.ts` | `R1, R2, R3, R4: tras el UP la copia rechaza la misma clave en cada indice y admite el mismo codigo con otra clave` |
| R2 | `tests/integration/inventario/product-batch-lot-per-presentation.int.test.ts` | `R2, R6: dos lotes sin presentacion del mismo producto y codigo dan P2002 y isDuplicateBatchLot lo reconoce` |
| R3 | idem | `R3: Crema 1 L y Crema 200 ml con CR-2610; Glicerina y Alcohol con 2401; insumo, envase e instrumento ...; un producto con y sin presentacion` |
| R4 | idem | `R4: cr-2610 y CR-2610 en la misma clave no chocan, y otra empresa repite la misma clave analoga` |
| R5 | idem | `R5: con 7 en un producto y 50 en otro, el siguiente generado es 51 sea cual sea el producto` |
| R6 | idem | `R6: dos lotes tecleados simultaneos con la misma clave -> uno se confirma y el otro batch_duplicate_lot sin filas, en los dos indices` |
| R6 | idem | `R6: un lote generado que choca en la base con la misma clave se reintenta y se escribe con el siguiente` |
| R6, R1, R2, R3 | `tests/unit/inventario/product-batch-lot-retry.test.ts` | `isDuplicateBatchLot — ...` (7 casos R1/R2/R3/R6) |
| R7 | `tests/integration/inventario/product-batch-lot-per-presentation.int.test.ts` | `R7: lote sobre producto existente con la clave ya escrita -> batch_duplicate_lot sin lote ni asiento nuevos, en los dos indices` y `R7: el codigo que solo existe con otra clave se acepta y se guarda tal cual, por las dos altas` |
| R7 | `tests/integration/inventario/product-batch-lot.int.test.ts` | `QC-284 R7, R25: con la clave existente rechaza con BatchDuplicateLotError ...; con otro producto se acepta` |
| R7 | `tests/unit/inventario/product-batch-lot-retry.test.ts` | `R7: con lote escrito a mano no reintenta y sale BatchDuplicateLotError, tambien con el indice sin presentacion` |
| R8 | `tests/unit/errores/catalogo.test.ts` | `QC-284 R8: batch_duplicate_lot conserva su codigo y su clave, con el texto por producto y presentacion` |
| R28 | `tests/integration/inventario/product-batch-lot-per-presentation-migration.int.test.ts` | `R28: el UP, sentencia a sentencia, nunca deja la tabla sin unicidad de lote y no cambia ninguna fila` |
| R28 | `tests/unit/inventario/schema/product-batch-lot-per-presentation-migration.test.ts` | `R28: el UP solo es DDL y no modifica ninguna fila` |
| R29 | `tests/integration/inventario/product-batch-lot-per-presentation-migration.int.test.ts` | `R29: con dos lotes ... el DOWN aborta entero con su mensaje` y `R29: sin codigos repetidos ... el DOWN deja la unicidad (empresa, codigo) ...` |
| R29 | `tests/unit/inventario/schema/product-batch-lot-per-presentation-migration.test.ts` | `R29: el DOWN aborta con codigos repetidos antes de tocar indices, ...` y `R29: el aborto cuenta por (empresa, codigo), dice cuantos y que hacer` |

### Medicion del riesgo abierto (P2002 con indices parciales)

`@prisma/client` 6.19 devuelve el choque de los dos indices parciales como `P2002` con columnas en
`meta.target`. Salida real (mutacion temporal: `isDuplicateBatchLot` con el conjunto viejo):

```
P2002 meta={"modelName":"ProductBatch","target":["company_id","product_id","presentation_id","lot"]}
P2002 meta={"modelName":"ProductBatch","target":["company_id","product_id","lot"]}
Tests  5 failed | 4 passed (9)
```

Con el codigo de la tanda, los 9 casos pasan. No hace falta caer a `meta.constraint`.

### Migracion aplicada y revertida en una base de prueba

Base `qc284_scratch` (copia de la plantilla `qct_tpl_4a9ce03acc6c`, ya borrada):

- `pnpm run db:rollback` -> `20261014200000_product_batches_lot_per_presentation revertida.`;
  queda `product_batches_company_lot_unique`, RLS forzada.
- `pnpm run db:migrate` -> `All migrations have been successfully applied.`; quedan los dos indices.
- Con dos lotes `DUP-1` en productos distintos, `db:rollback` -> `ROLLBACK ABORTADO: hay 1 codigo(s) de
  lote repetido(s) ... en 2 fila(s)`; indices y fila de `_prisma_migrations` intactos.

### Verificacion

- `pnpm run typecheck`: sin errores.
- `pnpm run lint`: 0 errores, 7 warnings en archivos no tocados.
- `pnpm exec vitest run guard`: 76 archivos, 1066 pass, 20 skipped.
- Unit por ruta: `product-batch-lot-per-presentation-migration.test.ts` + `inventario-schema.test.ts` 37/37;
  `product-batch-lot-retry.test.ts` 27/27; `catalogo.test.ts` 55/55.
- Integracion por ruta: los tres archivos de lote, 33/33.
- `pnpm exec vitest related --run` (product-prisma.ts, error-catalog.ts, schema.prisma): 899 archivos,
  2 rojos:
  - `tests/integration/inventario/finished-batch-labels.int.test.ts > R11 (QC-219)`: espera choque entre
    productos distintos; lo deroga esta ficha. Lo reescribe T7.
  - `tests/integration/proveedores/catalog-line.int.test.ts > R32`: FK de `supplier_catalog_lines`
    (`restriccionDe` devuelve un objeto). No toca lotes; no esta en `baseline-rojos.json`. No es de esta tanda.

### Pendiente para tareas siguientes

- `inventory-import-prisma.ts` sigue diciendo «indice unico (company_id, lot)» en un mensaje de error (T5).
- `e2e/datos-de-lote-en-acondicionamiento.spec.ts` tiene un caso «el lote de otro producto choca» (T13).

Veredicto: T1–T4 hechas y verdes; el P2002 de los indices parciales esta medido y lo reconoce `isDuplicateBatchLot`.

## Tanda 2 — T5, T6, T7 (2026-10-14)

### Archivos

Modificados (codigo):
- `lib/modules/inventario/domain/inventory-import-contract.ts` (fuera `lot_used_by_other_product`)
- `lib/modules/inventario/domain/plan-inventory-import.ts` (`ImportCatalogSnapshot.batches` con `presentationId`; `batchKeys` por clave; `checkLot` por clave; `fileLots` por identidad + codigo; fuera el texto del motivo retirado)
- `lib/modules/inventario/domain/confirm-inventory-import.ts` (`lotClash` -> `duplicate` sin releer; fuera `targetProductId`)
- `lib/modules/inventario/ports/inventory-import-repository.ts` (`findBatchesByLots` devuelve `presentationId`)
- `lib/modules/inventario/adapters/driven/persistence/inventory-import-prisma.ts` (`findBatchesByLots` con `presentationId`; mensaje del reintento agotado ya no dice «indice unico (company_id, lot)»)
- `lib/modules/inventario/domain/finished-batch-labels.ts` (`label` unico, `no_batches`, fuera `batch_not_found`)
- `lib/modules/inventario/adapters/driven/persistence/finished-batch-labels-prisma.ts` (pasa `label`)
- `lib/modules/inventario/adapters/driven/persistence/product-prisma.ts` (`writeFinishedBatchLabels`: bloquea los lotes de produccion del pedido, choque por clave con `IS NOT DISTINCT FROM`, escribe la misma terna en todos)

Modificados (tests): `tests/unit/inventario/{plan,confirm,preview}-inventory-import.test.ts`,
`tests/unit/inventario/inventory-import-kit.ts`, `tests/integration/inventario/{inventory-import-confirm,inventory-import-repository,adjust-by-count,finished-goods-return,finished-batch-labels}.int.test.ts`.
Ningun archivo nuevo de integracion: `aislamiento.json` sin cambios.

`app/(private)/inventario/importar/components/import-texts.ts` NO se toca: no contiene el texto de
`lot_used_by_other_product`; el texto vivia en `plan-inventory-import.ts > ISSUE_TEXT` y se retiro alli.

### Precision sobre design.md > 2.3

El conjunto que bloquea y escribe `writeFinishedBatchLabels` es el mismo que devuelve `listOfOrder`
(asiento `production` del pedido **con** `order_presentation_line_id` y lote **con** presentacion), para
que R18 («todas las lineas con lote») escriba exactamente las lineas que el formulario muestra.

### Mapa R<n> -> test

| R | Archivo | Caso |
|---|---|---|
| R9 | `tests/unit/inventario/plan-inventory-import.test.ts` | `QC-284 R9: un terminado con la misma clave ... en la base es duplicado`; `QC-284 R9: un terminado repetido en el archivo con la misma presentacion es duplicado; con otra, no`; `QC-284 R9, R10: un envase o un insumo se compara con la clave sin presentacion` |
| R9, R10 | `tests/unit/inventario/confirm-inventory-import.test.ts` | `R25, QC-284 R9, R10: vuelve a validar contra la base del momento con la clave del lote`; `QC-284 R9, R10: la vista previa y la confirmacion dicen lo mismo con codigos repetidos entre claves` |
| R9, R10 | `tests/integration/inventario/inventory-import-confirm.int.test.ts` | `QC-284 R9, R10: el codigo de otro producto no impide crear ni sumar lote, y la misma clave sigue siendo duplicado` |
| R9, R10 | `tests/integration/inventario/inventory-import-repository.int.test.ts` | `QC-284 R9, R10: devuelve la presentacion de cada lote y todos los lotes que comparten codigo` |
| R10 | `tests/unit/inventario/plan-inventory-import.test.ts` | `QC-284 R10: el codigo es de otro producto, en la base o en una fila anterior: ...`; `QC-284 R10: el mismo codigo en otra presentacion u otro producto terminado no es duplicado`; `QC-284 R10: lot_used_by_other_product ya no existe en el catalogo de motivos` |
| R10 | `tests/unit/inventario/confirm-inventory-import.test.ts` | `QC-284 R10: ningun resultado lleva lot_used_by_other_product, ni con el codigo en otro producto` |
| R11 | `tests/unit/inventario/confirm-inventory-import.test.ts` | `R27, QC-284 R11: ... un choque de lote es duplicado`; `R27, QC-284 R11: un lote que choca al escribir sobre el mismo producto es duplicado`; `QC-284 R11: un terminado cuyo lote tecleado choca en carrera queda duplicado` |
| R11 | `tests/integration/inventario/inventory-import-confirm.int.test.ts` | `QC-284 R11: un lote con la misma clave escrito entre la vista previa y la escritura deja la fila duplicada` |
| R12 | `tests/integration/inventario/adjust-by-count.int.test.ts` | `QC-284 R12: con dos lotes de la empresa que comparten codigo, el ajuste solo escribe en el lote pedido` |
| R12 | `tests/integration/inventario/finished-goods-return.int.test.ts` | `QC-284 R12: con dos lotes que comparten codigo, la devolucion vuelve solo al lote de origen y findLots da el codigo de cada uno` |
| R18 | `tests/integration/inventario/finished-batch-labels.int.test.ts` | `R18: la misma terna en los dos lotes del pedido; no toca existencia, coste, compra, presentacion, producto, contenido, asientos ni otro pedido` |
| R21 | idem | `R21: duplicate_lot con el codigo de otra produccion de la misma presentacion, sin escribir ninguna linea`; `R21: no choca el codigo de otro producto, de otra presentacion, de otra linea del pedido, el suyo ni el de otra empresa`; `R21: sensible a mayusculas, ...` |
| R22 | idem | `R22: dos guardados simultaneos de pedidos distintos con la misma clave: ...`; `R22: con la misma clave escrita por otra sesion sin confirmar, la escritura espera, recibe duplicate_lot ...` (sustituye el caso «R11 (QC-219)») |
| R23 | idem | `R23: no_batches para un pedido sin lotes de produccion, de otra empresa o inexistente, sin escribir nada` |

T6: sin cambio de codigo; ajuste y devolucion ya identificaban el lote por `id`.

### Verificacion (salida real)

- `pnpm run typecheck`: **rojo, 6 errores, todos de T8** (contrato nuevo de `writeForOrder`):
  - `lib/modules/asignaciones/domain/save-conditioning-batch-data.ts(104,7)` TS2561 `labels` -> `label`
  - `lib/modules/asignaciones/domain/save-conditioning-batch-data.ts(108,9)` TS2367 `batch_not_found` ya no existe
  - `lib/modules/asignaciones/domain/save-conditioning-batch-data.ts(108,94)` TS2339 `batchId` en `never`
  - `tests/unit/asignaciones/save-conditioning-batch-data.test.ts(132,45)` TS2551 y `(132,57)` TS7006 (`labels`)
  - `tests/unit/asignaciones/save-conditioning-batch-data.test.ts(283,42)` TS2322 `batch_not_found`
  - `scripts/seed-demo/gateway.ts` compila: llama al caso de uso, no al puerto (lo cambia T11).
- `pnpm run lint`: 0 errores, 7 warnings en archivos no tocados.
- `pnpm exec vitest run guard`: 76 archivos, 1066 pass, 20 skipped.
- Unit: `plan-inventory-import` + `confirm-inventory-import` + `preview-inventory-import` 67/67; con `product-batch-lot-retry` y `product-batch-lot-per-presentation.int` 103/103.
- Integracion: `inventory-import*` (5 archivos) 38 pass, 1 skipped (medida 2000); `adjust-by-count` + `finished-goods-return` 17/17; `finished-batch-labels` 8/8.
- Rojo esperado hasta T8: `tests/integration/asignaciones/finish-conditioning-batch-data.int.test.ts`, 3 casos
  (R15/R16/R25, R17, R18 de QC-219): el caso de uso aun pasa `labels` al adaptador nuevo.

Veredicto: T5, T6 y T7 hechas y verdes en su alcance; typecheck rojo solo en `asignaciones`, pendiente de T8.
