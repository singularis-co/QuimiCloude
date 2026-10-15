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

## Tanda 3 — T8, T9, T10, T11 (2026-10-14)

### Archivos

Modificados (codigo):
- `lib/modules/asignaciones/domain/save-conditioning-batch-data.ts` (entrada `{ orderId, lot, expiryDate, productionDate }` estricta; una sola terna a `writeForOrder({ label })`; `no_batches` -> `batch_not_found`; fuera `firstDuplicateLot`; los errores de fecha ya no llevan `batchId`)
- `lib/modules/asignaciones/domain/errors.ts` (solo los comentarios de las cuatro clases que describian lineas; las clases no cambian)
- `lib/modules/asignaciones/domain/conditioning-batch-data.ts` (tipo `ConditioningBatchForm` y funcion pura `batchDataForm`)
- `lib/modules/asignaciones/domain/conditioning-order-view.ts` (`ConditioningBatchData.form`)
- `lib/modules/asignaciones/index.ts` (exporta el tipo `ConditioningBatchForm`)
- `lib/modules/asignaciones/adapters/driving/order-conditioning-actions.ts` (un valor por campo con `formData.get`; fuera `textValues`, `batchDataLines`, `culpritBatchId` y el `batchId` del estado de error; `SaveConditioningBatchDataResult` = `idle | success | ErrorState`)
- `scripts/seed-demo/gateway.ts` (`saveDemoBatchData` guarda una terna por pedido; no reescribe si el formulario ya es `shared` ni si es `no_batches`)

Modificados (tests):
- `tests/unit/asignaciones/save-conditioning-batch-data.test.ts` (reescrito a la entrada nueva)
- `tests/unit/asignaciones/conditioning-batch-data.test.ts` (+ bloque `batchDataForm`)
- `tests/unit/asignaciones/get-conditioning-order.test.ts` (`form` en las expectativas; + R14 y R16)
- `tests/unit/asignaciones/order-conditioning-actions.test.ts` (bloque de guardar reescrito)
- `tests/integration/asignaciones/finish-conditioning-batch-data.int.test.ts` (los 3 casos de QC-219 a la entrada nueva; + R17/R23 y R15/R16/R27 en TERMINADO y ENTREGADO)

Sustituciones de casos (design.md > 9):
- QC-219 R15/R16/R25: «una sola linea guardada siguen faltando datos» ya no se puede producir (guardar
  escribe en todas); el caso queda como: sin datos rechaza, un guardado cubre las dos lineas, Terminar pasa.
- QC-219 R17: la linea sin lote sigue sin datos tras guardar y bloquea Terminar (QC-284 R26).
- QC-219 R18: igual, con la entrada nueva.
- Unit QC-219 R7 (`lines`) -> QC-284 R19; R10 «dos lineas con el mismo lote» desaparece (no hay dos
  lineas en la entrada); R12 `batch_not_found` con `batchId` -> R23 `no_batches`.

### Mapa R<n> -> test (esta tanda)

| R | Archivo | Caso |
|---|---|---|
| R14 | `tests/unit/asignaciones/conditioning-batch-data.test.ts` | `R14: un pedido con datos uniformes abre relleno ...`; `R14: un pedido sin datos abre vacio y sin aviso`; `R14: una linea sin lote no impide abrir relleno ni vacio ...` |
| R14 | `tests/unit/asignaciones/get-conditioning-order.test.ts` | `QC-284 R14: con las dos lineas con los mismos datos, el formulario abre relleno` |
| R14, R18, R26 | `tests/integration/asignaciones/finish-conditioning-batch-data.int.test.ts` | `QC-219 R15, R16, R25; QC-284 R18, R26: sin datos rechaza; un solo guardado cubre las dos lineas y Terminar pasa ...` |
| R15 | `tests/unit/asignaciones/conditioning-batch-data.test.ts` | `R15: datos a medias ...`; `R15: dos lotes distintos`; `R15: el mismo lote con distinto vencimiento / dia de produccion`; `R15: ... distingue mayusculas`; `R15: el aviso lista todas las lineas en su orden de alta, y una sin lote como null` |
| R15 | `tests/unit/asignaciones/get-conditioning-order.test.ts` | `R1, R2, R4, R18, R21: en %s propio ...` (ahora con `form: divergent` en los tres estados) |
| R15, R16, R27 | `tests/integration/asignaciones/finish-conditioning-batch-data.int.test.ts` | `QC-284 R15, R16, R27: un TERMINADO / ENTREGADO con lotes distintos abre con aviso sin escribir nada; al guardar ...` |
| R16 | `tests/unit/asignaciones/get-conditioning-order.test.ts` | `QC-284 R16: abrir el detalle solo lee los lotes, nunca escribe` |
| R16 | `tests/unit/asignaciones/conditioning-batch-data.test.ts` | `R16: es pura: no cambia lo que recibe` |
| R17 | `tests/unit/asignaciones/conditioning-batch-data.test.ts` | `R17: un pedido sin ninguna linea con lote -> no_batches`; `R17: un lote de otra presentacion no cuenta ...` |
| R17, R23 | `tests/integration/asignaciones/finish-conditioning-batch-data.int.test.ts` | `QC-284 R17, R23: un pedido sin ninguna linea con lote abre deshabilitado y guardar rechaza con batch_not_found` |
| R18, R27 | `tests/unit/asignaciones/save-conditioning-batch-data.test.ts` | `R18, R27: en %s propio escribe una sola terna para el pedido ...` (3 estados) |
| R18 | `tests/unit/asignaciones/order-conditioning-actions.test.ts` | `R18: exito -> revalida el detalle y no redirige` |
| R19 | `tests/unit/asignaciones/save-conditioning-batch-data.test.ts` | `R19: %s se rechaza con invalid_input sin tocar ningun puerto` (18 casos, incluidos `lines`, `batchId` y la forma de QC-219); `R19: el lote se recorta / de 59 digitos / de 60 caracteres y es valido` |
| R19 | `tests/unit/asignaciones/order-conditioning-actions.test.ts` | `R19: lee un valor por campo ...`; `R19: un batchId o datos repetidos ... solo el primer valor`; `R19: un campo ausente llega como null ...`; `R19: campos vacios viajan tal cual` |
| R20 | `tests/unit/asignaciones/save-conditioning-batch-data.test.ts` | `R20: un vencimiento de hoy ...`; `R20: un vencimiento pasado ...`; `R20: un dia de produccion de manana ...`; `R20: un dia de produccion %s ... es valido`; `R20: con las dos fechas mal, decide el vencimiento`; `R20: «hoy» es el dia civil UTC ...` |
| R21 | `tests/unit/asignaciones/save-conditioning-batch-data.test.ts` | `R21: duplicate_lot del puerto se traduce a batch_duplicate_lot ...` (el choque por clave contra base real esta en `finished-batch-labels.int.test.ts`, tanda 2) |
| R22 | `tests/unit/asignaciones/save-conditioning-batch-data.test.ts` | `R22: duplicate_lot en carrera, sin lote, se traduce sin batchId` |
| R23 | `tests/unit/asignaciones/save-conditioning-batch-data.test.ts` | `R23: no_batches del puerto -> batch_not_found` |
| R24 | `tests/unit/asignaciones/save-conditioning-batch-data.test.ts` | `R24: %s recibe unauthorized ...`; `R24: inexistente ... order_not_found, aunque las fechas fallen`; `R24: TERMINADO/ENTREGADO de otra persona ...`; `R24: EN_ACONDICIONAMIENTO de otra persona ...`; `R24: %s -> order_not_conditionable ...`; `R24: la empresa sale del actor ...`; `R24: el orden de los puertos es pedido -> resumen -> escritura`; `R24: con un pedido sin lotes y un vencimiento de hoy deciden las fechas, sin escribir` |
| R25 | `tests/unit/asignaciones/order-conditioning-actions.test.ts` | `R25: %s se traduce a ErrorState con el codigo y el texto del catalogo, sin batchId y sin revalidar` (8 codigos). La marca `aria-invalid` es del frontend (T12) |
| R26 | `tests/integration/asignaciones/finish-conditioning-batch-data.int.test.ts` | `QC-219 R17; QC-284 R26: una linea sin lote sigue sin datos tras guardar y bloquea Terminar` |

T11: el seed no tiene unit propio; lo cubre `tests/integration/scripts/seed-demo.int.test.ts` (dos corridas
completas, con pedidos que pasan por Terminar).

### Verificacion (salida real)

- `pnpm run typecheck`: **rojo, 11 errores, todos del frontend (T12)**; ninguno en `lib/`, `scripts/` ni en tests de backend:
  - `app/(private)/asignacion/acondicionamiento/[id]/components/conditioning-batch-data-form.tsx(79,33)` TS2339 `batchId` no existe en `ErrorState` (la accion ya no lo devuelve)
  - `tests/unit/asignaciones-ui/conditioning-batch-data-form.test.tsx(229,7)` TS2353 `batchId` en el estado de error
  - `tests/unit/asignaciones-ui/conditioning-order-screen.test.tsx` (370,60), (407,27), (423,27), (438,50), (450,48) TS2741 falta `form` en `ConditioningBatchData`
  - `tests/unit/paridad/asignacion-acondicionamiento-paridad.test.tsx` (376,11), (388,34), (398,42) TS2741 falta `form`
- `pnpm run lint`: 0 errores, 7 warnings en archivos no tocados.
- `pnpm exec vitest run guard`: 76 archivos, 1066 pass, 20 skipped.
- Unit: `save-conditioning-batch-data`, `conditioning-batch-data`, `get-conditioning-order`, `order-conditioning-actions`, `errores/conditioning-batch-data-codes`: 5 archivos, 153/153.
- Integracion: `finish-conditioning-batch-data.int.test.ts` 6/6 (los 3 rojos de la tanda 2 en verde).
- Seed: `tests/integration/scripts/seed-demo.int.test.ts` + `tests/unit/scripts/seed-demo-run.test.ts` 15/15.
- `vitest related` sobre los 7 archivos de `lib/` y `scripts/`: 429 archivos, 7293 pass, 2 skipped, 0 fail (el barrel `asignaciones/index.ts` arrastra casi toda la suite; los tests de UI pasan en ejecucion aunque no tipan, ver typecheck).

Veredicto: T8-T11 hechas y verdes en backend; el typecheck queda rojo solo por los 11 errores de frontend que cierra T12.

## Tanda 4 — T12, T13 (frontend_dev, 2026-10-14)

### Archivos

- `app/(private)/asignacion/acondicionamiento/[id]/components/conditioning-batch-data-form.tsx` (reescrito: un solo juego de campos; props `{ orderId, form, divergentLabels }`; `Notice` warning para `divergent`; campo culpable por `code`; se retiran `batchId`, testids de linea y provisional; nace `CONDITIONING_BATCH_DATA_DIVERGENT_TESTID`)
- `app/(private)/asignacion/acondicionamiento/[id]/components/conditioning-order-screen.tsx` (pasa `batchData.form` y las etiquetas por `presentationId`)
- `app/(private)/asignacion/acondicionamiento/[id]/components/index.ts` (barrel)
- `tests/unit/asignaciones-ui/conditioning-batch-data-form.test.tsx` (reescrito)
- `tests/unit/asignaciones-ui/conditioning-order-screen.test.tsx`
- `tests/unit/asignaciones-ui/conditioning-order-page.test.tsx` (fixtures con `form`)
- `tests/unit/paridad/asignacion-acondicionamiento-paridad.test.tsx` + `__snapshots__/…snap` (3 actualizados, 1 nuevo `no_batches`, 1 obsoleto retirado)
- `e2e/datos-de-lote-en-acondicionamiento.spec.ts` (reescrito al recorrido de R30)

Sin componentes nuevos (solo compone `Input`, `Label`, `Button`, `ErrorAlert`, `Notice`), sin cambios en `lib/`, sin dependencias.

### Mapa R<n> -> test

| R | Archivo | Caso |
|---|---|---|
| R13 | `tests/unit/asignaciones-ui/conditioning-batch-data-form.test.tsx` | `R13: un solo juego de «Lote», «Vencimiento» y «Día de producción» y un único botón, sin bloques por línea`; `R13: cada campo tiene su etiqueta, 16 px, 44 px de alto, es obligatorio y las fechas usan el selector nativo`; `R13: envía orderId y un solo valor por campo, y confirma con un solo toast` |
| R13, R14 | `tests/unit/asignaciones-ui/conditioning-order-screen.test.tsx` | `R13 R14 R33: en %s, con batchData, pinta la tarjeta con un solo juego de campos y un botón` (3 estados) |
| R14 | `conditioning-batch-data-form.test.tsx` | `R14: con datos uniformes los tres campos vienen rellenos y no hay aviso`; `R14: sin datos los tres campos vienen vacíos y no hay aviso` |
| R15 | `conditioning-batch-data-form.test.tsx` | `R15: con lotes distintos los campos vienen vacíos y un aviso warning lista cada línea con su lote o «sin lote»` |
| R15 | `conditioning-order-screen.test.tsx` | `R15: en %s, con lotes distintos, el aviso lista cada línea como en el reparto con su lote` (3 estados) |
| R15 | `tests/unit/paridad/asignacion-acondicionamiento-paridad.test.tsx` | `R11 R13 R15 R24 — mio, con datos de lote incompletos y «Terminar» bloqueado` (snapshot) |
| R17 | `conditioning-batch-data-form.test.tsx` | `R17: sin ninguna línea con lote los tres campos y el botón van deshabilitados` |
| R17 | `asignacion-acondicionamiento-paridad.test.tsx` | `R17 R24 — mio, sin ninguna línea con lote: el formulario va deshabilitado` (snapshot) |
| R25 | `conditioning-batch-data-form.test.tsx` | `R25: con %s muestra el mensaje en role="alert", marca aria-invalid solo su campo y conserva lo escrito` (3 códigos); `R25: con cualquier otro código va a role="alert" sin marcar ningún campo` |
| R26, R30 | `e2e/datos-de-lote-en-acondicionamiento.spec.ts` | `R30 R26 - un solo formulario vacío, …` (pasos: vencimiento de hoy, producción de mañana, lote de otra producción de la misma presentación choca, lote de envase se acepta y las dos líneas quedan iguales, Terminar, Administrador en /inventario) |

### Verificacion (salida real)

- `pnpm run typecheck`: **0 errores** (`tsc --noEmit` sin salida).
- `pnpm run lint`: 0 errores, 7 warnings en archivos no tocados (`tests/unit/documentos/confirm-catalog-import.test.ts`, `tests/unit/pedidos/order-service.test.ts`, …). `eslint` sobre mis archivos: «No issues found».
- Tests por ruta: `conditioning-batch-data-form`, `conditioning-order-screen`, `conditioning-order-page`: 3 archivos, 67/67. Paridad: 37/37 (`-u`: 3 updated, 1 removed; el caso `no_batches` se escribió nuevo).
- `pnpm exec vitest related --run` sobre los 3 componentes y los 4 tests: 7 archivos, 136/136.
- `pnpm exec vitest run guard`: 76 archivos, 1066 pass, 20 skipped.
- **E2E** `pnpm exec playwright test e2e/datos-de-lote-en-acondicionamiento.spec.ts`: **2 failed (chromium, webkit)**, misma causa en los dos y de entorno:
  - Pasan en los dos navegadores: formulario único vacío sin aviso, «Terminar» deshabilitado, rechazo `batch_expiry_not_future`, rechazo `batch_production_date_future` y rechazo `batch_duplicate_lot` con el lote de otra producción de la misma presentación, sin cambiar ningún lote.
  - Falla el paso «el lote de un envase se acepta»: la acción devuelve `unexpected`. Log del servidor: `Invalid tx.productBatch.update() … Unique constraint failed on the fields: (company_id, lot)` en `writeFinishedBatchLabels`.
  - Causa: la base local de los E2E (`localhost:5432/QuimiCloude`, la de `.env`) **no tiene aplicada** `20261014200000_product_batches_lot_per_presentation`. `prisma migrate status`: «The migration have not yet been applied: 20261014200000_product_batches_lot_per_presentation»; además la base tiene 3 migraciones de otras ramas que no están en este worktree (`20260922160000_…`, `20260922160100_…`, `20261015120000_…`). Es una base compartida con otros worktrees: no la he migrado.
  - Para cerrarlo: aplicar la migración en una base donde corra el E2E (o la compartida, si el humano lo acepta) y volver a correr el spec.

### E2E contra la base aislada `qc284_e2e` (2026-10-14)

Corrido contra la base aislada `qc284_e2e`, recreada con `CREATE DATABASE "qc284_e2e" TEMPLATE "qct_tpl_4a9ce03acc6c"` (la plantilla de la rama, con la migración de T1 aplicada), con `DATABASE_URL`/`DIRECT_URL` apuntando a ella. La base compartida `QuimiCloude` no se tocó.

- Primera corrida: todos los pasos verdes salvo el último («el Administrador ve el mismo lote y vencimiento en los dos productos»), en los dos navegadores: `getByTestId('finished-stock-name').filter({ hasText: /^\s*qc219_e2e_<run>_receta\s*$/ })` esperaba 1 y encontró 2.
- Causa (del spec, no de producción): el lote sembrado de la otra producción (`…_previo`) no tiene asiento de pedido, y la pestaña «Producto terminado» lo pinta en su propio grupo «Sin pedido», cuya columna «Nombre» es también el nombre de la receta (`finishedStockRowName`). Comportamiento esperado de `/inventario`.
- Arreglo en `e2e/datos-de-lote-en-acondicionamiento.spec.ts > expectAdminSeesBatchData`: el grupo se identifica por su número de pedido (`finished-stock-order-number` con igualdad exacta a `numberText`), se comprueba que su nombre es la receta, y la fila del producto de cada línea se acota a las que cuelgan de ESE grupo (`data-table-row-<grupo>--<productId>`) además de nombre y presentación. Lo que R30 exige no se relaja: para cada uno de los dos productos del pedido se abre «Lotes» y se exige el lote `product-batch-<batchId>` con el código y el vencimiento escritos.

Salida (`pnpm exec playwright test e2e/datos-de-lote-en-acondicionamiento.spec.ts --reporter=list`):

```
  ✓  1 [chromium] › e2e\datos-de-lote-en-acondicionamiento.spec.ts:681:7 › datos de lote en el acondicionamiento: un formulario por pedido › R30 R26 - un solo formulario vacío, los rechazos no escriben nada, el lote de otra producción de la misma presentación choca, el de un envase no, las dos líneas quedan iguales, termina, y el Administrador lo ve en /inventario (57.3s)
  ✓  2 [webkit] › e2e\datos-de-lote-en-acondicionamiento.spec.ts:681:7 › datos de lote en el acondicionamiento: un formulario por pedido › R30 R26 - un solo formulario vacío, los rechazos no escriben nada, el lote de otra producción de la misma presentación choca, el de un envase no, las dos líneas quedan iguales, termina, y el Administrador lo ve en /inventario (1.2m)

  2 passed (2.1m)
```

Tras el arreglo: `pnpm run typecheck` 0 errores (exit 0); `pnpm run lint` 0 errores, 7 warnings en archivos no tocados (exit 0); `eslint` sobre el spec: «No issues found».

Veredicto: T12 y T13 hechas; el E2E de R26/R30 pasa en Chromium y WebKit contra la base aislada `qc284_e2e`.

## Cierre — T14 (implementer, 2026-10-14)

### R31 y R32 (los que no tienen test propio)
- **R31** (R1–R29 probados; guardias verdes; sin dependencias nuevas): el mapa de las tandas 1–4
  cubre R1–R30. `git diff --stat 0ac707ea HEAD -- package.json pnpm-lock.yaml` sale vacío (sin
  cambios desde que se tomó la feature). Guardias: 76 archivos verdes (abajo).
- **R32** (no crear lotes para líneas sin producción, no leer el vencimiento para reservar o
  consumir, no tocar lotes de insumos): `tests/integration/inventario/finished-batch-labels.int.test.ts`
  casos R23 (pedido sin lotes / otra empresa / inexistente -> `no_batches` sin escribir ni crear
  nada) y R18 (no cambian existencia, coste, compra, presentación, producto, contenido, asientos
  ni el lote de otro pedido). Además el diff de producción no toca reserva, consumo ni ejecución:
  solo `asignaciones` (datos de lote del acondicionamiento), `inventario` (lotes, importación,
  etiquetas de terminado), `errores` (texto), la pantalla del detalle y el seed.

### Verificación final (sobre HEAD tras F2.3)
- F2.3: `git fetch origin dev && git merge origin/dev` -> «Already up to date» (dev no trae nada
  nuevo; sin migraciones que aplicar).
- `pnpm run typecheck` -> exit 0.
- `pnpm run lint` -> exit 0, `✖ 7 problems (0 errors, 7 warnings)`, todos en archivos no tocados.
- Los 25 archivos de test tocados por la feature + guardias, en una corrida
  (`pnpm exec vitest run <25 archivos> guard`, con `.env` cargado):
  ```
   Test Files  100 passed (100)
        Tests  1578 passed | 21 skipped (1599)
  ```
- E2E: ver tanda 4 (2 passed, Chromium y WebKit, base aislada `qc284_e2e`).
- `./init.sh` (rápido): **aborta en el validador de features** antes de los tests —
  `zona fullstack: QC-203, QC-271, QC-275, QC-281, QC-283 (5 in_progress, max 3)`—, el rojo de
  cupo conocido y aceptado por el humano. Por eso los pasos que vienen detrás (typecheck, lint,
  tests, guardias) se corrieron a mano, arriba. `test:rapido` no se corrió: con `schema.prisma` en
  el diff arrastra casi toda la suite (899 archivos en la tanda 1); queda para el gate del leader / CI.

### Abierto
- `tests/integration/proveedores/catalog-line.int.test.ts > R32` sale rojo aislado en este
  worktree (`TypeError: .toMatch() expects to receive a string, but got object`, FK de
  `supplier_catalog_lines`). No está en `tests/baseline-rojos.json` y no se ha confirmado contra
  la base sin el cambio; ningún archivo de la feature toca proveedores. Lo decide el leader.
- Seed de demo (T11): cuando un pedido tiene datos divergentes, `saveDemoBatchData` toma el lote
  provisional de la primera línea que lo tenga y, si no, el lote escrito de la primera línea. Esa
  regla de respaldo la eligió el backend_dev; el spec no la fija.
- La base de desarrollo compartida `QuimiCloude` NO tiene aplicada la migración de T1 (la
  comparten otros worktrees, con 3 migraciones de otras ramas). No se migró. Las bases
  `qc284_e2e` (E2E) quedan en el Postgres local y se pueden borrar con `pnpm run db:test clean`.
