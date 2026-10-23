# QT-296 — tipo-y-subtipo-de-empaque-backend · bitácora de implementación

> `backend_dev`. Worktree `.worktrees/QT-296-tipo-y-subtipo-de-empaque-backend`, base de datos
> propia `QuimiCloude_QT296`. El MCP del grafo no se usó: la exploración fue con Grep/Read.

## T0 — Recontraste (2026-10-23)

**Punta:** rama `5db868e1`; `origin/dev` en `f786d72e` (QC-240, WhatsApp). El spec se escribió
sobre `18541c51`; entre esa punta y la de la rama solo cambian archivos de `specs/` y `progress/`.

**Referencias `archivo:línea` de `design.md`.** Todas siguen valiendo, salvo una deriva de una
línea:

| Referencia | Estado |
|---|---|
| `db/schema.prisma:546` (`enum ProductType`), `:356-357` (envases sin presentación) | igual |
| `create-product.ts:292-345` (`createPackaging`) | igual |
| `20261003130000_packaging_products_in_distribution/migration.sql:9-13` | igual |
| `packaging-catalog-prisma.ts:23-34` (`findAlivePackaging`); `findPackagingCostingBatches` en `:128` | igual |
| `product-queryable.ts:22`, `product-prisma.ts:234-247`, `:240`, `:540-560` | igual |
| `plan-inventory-import.ts:88`, `:199-210`, `:476` | igual |
| `supplier-catalog-import-prisma.ts:110-179`, `:134-165` | igual |
| `tests/unit/proveedores/scope.test.ts:129-182`, `guard-tipos-de-producto.test.ts:105` | igual |
| `product-input.ts:80` (`DECIMAL_PATTERN`) | **se movió a `:81`** (en `:80` está su comentario) |
| `product-input.ts:245-258`, `product-view.ts:89-92`, `inventory-import-repository.ts:5-12` | igual |
| `confirm-inventory-import.ts:118-124`, `inventory-import-downloads.ts:54` y `:120` | igual |
| `import-cell-parsing.ts:40`, `import-sheet.ts:156`, `catalog-line-input.ts:186-195` | igual |
| `catalog-line-view.ts:33-69`, `confirm-catalog-import.ts:200-214` | igual |

`origin/dev` toca `db/schema.prisma` y `lib/composition/index.ts` (WhatsApp), sin solapar con
ninguna de estas referencias.

**Última migración.** En la rama sigue siendo `20261022120000_ai_models`. **Pero `origin/dev` ya
tiene `20261023120000_whatsapp_send_permission` y `20261023130000_whatsapp_outbound_messages`.**
Con `<ts> = 20261023120000`, al mergear dev las dos carpetas compartirían marca de tiempo y la
nuestra (`packaging…` < `whatsapp…`) quedaría ordenada antes de una ya aplicada en dev. **Se fija
`<ts> = 20261023150000`**, posterior a las dos.

**Rojos de partida.** `tests/baseline-rojos.json` está vacío. Corrida sobre la punta (`.env` del
worktree cargado) de los tests de `design.md > 11` que existen:
`product-input`, `create-product`, `plan-inventory-import`, `inventory-import-downloads`,
`import-header`, `import-cell-parsing`, `import-sheet-limits`, `listas-blancas-listados`,
`catalog-line-input`, `catalog-service`, `catalog-extraction`, `classify-catalog-import`,
`preview-catalog-import`, `confirm-catalog-import`, `ai-reader-canned` y los cuatro
`qc195-packaging-*.int`:

```
 Test Files  19 passed (19)
      Tests  364 passed (364)
```

`inventory-import-contract.test-d.ts` lo cubre `typecheck`. **Ningún rojo de partida.**

## T1 — Migración, esquema y espejos del enum (2026-10-23)

### Archivos

Creados:
- `db/migrations/20261023150000_packaging_subtype/migration.sql`
- `db/migrations/20261023150000_packaging_subtype/down.sql`
- `lib/modules/inventario/domain/packaging-subtype.ts`
- `lib/modules/proveedores/domain/catalog-line-type.ts`
- `tests/unit/inventario/packaging-subtype.test.ts`
- `tests/unit/inventario/schema/qt296-packaging-subtype-migration.test.ts`
- `tests/integration/inventario/qt296-packaging-subtype-migration.int.test.ts`
- `tests/integration/inventario/qt296-packaging-subtype-constraints.int.test.ts`
- `tests/integration/proveedores/qt296-catalog-line-type.int.test.ts`

Modificados:
- `db/schema.prisma`: enums `PackagingSubtype` y `CatalogLineType`, `Product.packagingSubtype`,
  `SupplierCatalogLine.type` y `.packagingSubtype` (diff mínimo: solo líneas añadidas).
- `lib/modules/inventario/index.ts`, `lib/modules/proveedores/index.ts`: exportan los espejos.
- `tests/unit/inventario/schema/inventario-schema.test.ts`: el censo de escalares de `Product`
  gana `packagingSubtype`.
- `tests/unit/proveedores/schema/proveedores-schema.test.ts`: `SUPPLIER_CATALOG_LINE_COLUMNS` gana
  `type` y `packaging_subtype`.
- `tests/unit/proveedores/module-contract.test.ts`: el censo dmmf de `SupplierCatalogLine` gana
  `type` y `packagingSubtype` (escalares enum, sin relación).
- `tests/guards/guard-identificador-de-request.test.ts`: `MIGRACIONES_ESPERADAS` gana la migración
  nueva (la guardia exige que cada ficha con migración la anote).
- `tests/integration/aislamiento.json`: los tres `.int` nuevos en `transaccion`.

`resolveImportedClassification` (`domain/imported-classification.ts`, en la tabla de `design.md > 3`)
no entra en T1: `tasks.md > T1` solo pide los dos espejos. Queda para la task que lo use.

### Divergencia con `design.md > 2.2` (corregida en la migración, pide enmienda)

El cuerpo del CHECK `supplier_catalog_lines_packaging_subtype_matches_type` del diseño,
`"packaging_subtype" IS NULL OR "type" = 'PACKAGING_MATERIAL'`, **deja pasar una línea sin tipo y
con subtipo**: con `type` NULL la expresión vale NULL, y un CHECK solo rechaza FALSE. Lo destapó el
test de R24 de T1 («sin tipo se rechaza»), y se confirmó contra Postgres
(`SELECT 'MEASURER' IS NULL OR NULL = 'PACKAGING_MATERIAL'` → `null`). R24 y la T1 son inequívocos,
así que la migración usa
`"packaging_subtype" IS NULL OR "type" IS NOT DISTINCT FROM 'PACKAGING_MATERIAL'`. Los otros dos
CHECK no tienen el problema (`products.type` es NOT NULL). **Pendiente:** que `spec_author` enmiende
el cuerpo en `design.md > 2.2`.

### Mapa R → test

| R | Test |
|---|---|
| R1 | `tests/unit/inventario/packaging-subtype.test.ts` › «R1: el subtipo es un conjunto cerrado…», «R1: los dos espejos coinciden con el enum PackagingSubtype…», «R1, R24: db/schema.prisma declara las columnas…»; `qt296-packaging-subtype-migration.test.ts` › «R1, R23: crea los dos enums…»; `qt296-packaging-subtype-constraints.int.test.ts` › «R1: un valor fuera del enum PackagingSubtype se rechaza…» |
| R2 | `qt296-packaging-subtype-constraints.int.test.ts` › «R2: un empaque sin subtipo se rechaza, y un producto de otro tipo con subtipo tambien»; `qt296-packaging-subtype-migration.test.ts` › «R2, R3, R24: los tres CHECK con su cuerpo» |
| R3 | `qt296-packaging-subtype-constraints.int.test.ts` › «R3: tapa, medidor u otro con presentacion se rechazan…»; `packaging-subtype.test.ts` › «R3: solo el envase requiere presentacion» |
| R4 | `qt296-packaging-subtype-migration.int.test.ts` › «R4: todo empaque existente (vivo, de baja o sin presentacion) queda como envase…», «R4: el DOWN quita la columna y el UP se vuelve a aplicar…»; `qt296-packaging-subtype-migration.test.ts` › «R4: rellena los empaques como envase antes del CHECK y dentro del parentesis de RLS…» |
| R23 | `qt296-catalog-line-type.int.test.ts` › «R23: el tipo admite materia prima, herramienta, empaque o nada; producto terminado y valores ajenos no caben»; `packaging-subtype.test.ts` › «R23: CATALOG_LINE_TYPE_VALUES coincide con el enum CatalogLineType…» |
| R24 | `qt296-catalog-line-type.int.test.ts` › «R24: un subtipo solo cabe con tipo empaque; sin tipo o con otro tipo se rechaza, y empaque sin subtipo entra» |
| R25 | `qt296-catalog-line-type.int.test.ts` › «R25: una linea guardada antes de la migracion queda sin tipo ni subtipo…»; `qt296-packaging-subtype-migration.test.ts` › «R25: no borra filas ni recrea material ni medidas…», «R25: down.sql quita exactamente lo que crea migration.sql, en orden inverso» |

### Salida real

Migración contra `QuimiCloude_QT296` (sonda: última fila de `_prisma_migrations`, filas de esta
migración, columnas `packaging_subtype`, tipos, CHECK y `FORCE` de `products`):

```
-- migrate
All migrations have been successfully applied.
{"last":"20261023150000_packaging_subtype","rows_mig":"1","cols":"2","types":"2","checks":"3","products_force":true}
-- rollback
db:rollback: aplicando down.sql de 20261023150000_packaging_subtype y borrando su fila de _prisma_migrations
db:rollback: 20261023150000_packaging_subtype revertida.
{"last":"20261022120000_ai_models","rows_mig":"0","cols":"0","types":"0","checks":"0","products_force":true}
-- migrate
All migrations have been successfully applied.
{"last":"20261023150000_packaging_subtype","rows_mig":"1","cols":"2","types":"2","checks":"3","products_force":true}
✔ Generated Prisma Client (v6.19.3)
```

La base queda migrada. (El ciclo se corrió dos veces: la primera con el CHECK del diseño, antes del
arreglo; se revirtió antes de editar la migración, para no dejar un checksum aplicado distinto.)

Los cinco tests de T1:
```
 Test Files  5 passed (5)
      Tests  20 passed (20)
```

`pnpm run typecheck`: `tsc --noEmit`, exit 0. (Antes hubo que correr `pnpm exec next typegen`:
el worktree no tenía los tipos de ruta, `Cannot find name 'LayoutProps'`, `docs/verification.md:50`.)

`pnpm run lint`: exit 0, `✖ 10 problems (0 errors, 10 warnings)`; ninguno en archivos de esta task.

`pnpm exec vitest run guard` (más los tests de esquema y `module-contract`):
```
 Test Files  113 passed (113)
      Tests  1615 passed | 22 skipped (1637)
```

`pnpm exec vitest related --run <archivos tocados>` (los 14 de esta task; sin tope de tiempo, el
barrel arrastra casi todo el grafo):

```
 Test Files  18 failed | 673 passed (691)
      Tests  126 failed | 12041 passed | 8 skipped (12175)
```

**Las 126 caídas tienen una sola causa:** el CHECK `products_packaging_subtype_matches_type` (R2)
rechaza todo `PACKAGING` que nace sin subtipo.
- 118 (y las 3 de `inventory-import-confirm` y `seed-demo`, que pasan por el mismo camino) vienen de
  `createWithFirstBatch` (`product-prisma.ts`), el **único** escritor de `products` en producción.
  Escribir `packaging_subtype` ahí es **T2** (`design.md > 4.1`).
- 5 vienen de siembras de test que insertan un `PACKAGING` directamente con Prisma, sin pasar por
  el alta: `qc195-packaging-constraints.int` (2), `order-consumption-ledger.int`,
  `product-batch-lot-per-presentation.int`, `product-batch-require-unit.int`. `design.md > 11`
  solo prevé las siembras «que pasan por el alta»; estas no.

Archivos rojos: `asignaciones/execution-atomicity`, `inventario/{inventory-import-confirm,
order-consumption-ledger, product-batch-lot-per-presentation, product-batch-require-unit,
qc195-packaging-catalog, qc195-packaging-constraints, qc195-packaging-list,
qc195-packaging-product}`, `pedidos/{actual-order-cost, finish-with-finished-goods,
order-content-copy, order-ingredients-cost, order-repository, qc170-distribution-company-scope,
qc170-distribution-concurrency, qc195-packaging-reservation}`, `scripts/seed-demo` (todos `.int`).
Ninguno era rojo de partida (T0).

### Bloqueo: T1 no puede cerrar en verde sola

`tasks.md` pone el CHECK de R2 en T1 y la escritura del subtipo en T2, así que el commit de T1
deja roto el alta de cualquier empaque (en código y en 18 suites de integración) hasta T2. No se
ha tocado nada de T2. Opciones para el leader / `spec_author`:
1. Adelantar a T1 lo mínimo: que `createWithFirstBatch` escriba `CONTAINER` en `PACKAGING`
   (T2 lo sustituye por el subtipo de entrada), más `packagingSubtype: 'CONTAINER'` en las 5
   siembras directas.
2. Cerrar T1 y T2 en un mismo commit.
3. Partir el CHECK de R2: T1 solo con «no-empaque sin subtipo», y la mitad «empaque con subtipo»
   en T2. Cambia la migración, que ya sería distinta en dos commits: es la peor.

**Veredicto T1:** migración, esquema, espejos y los tests de R1–R4 y R23–R25 en verde; typecheck,
lint y guardias en verde; `vitest related` rojo por el orden T1→T2 del spec (bloqueo arriba) y
una enmienda pendiente en `design.md > 2.2`.

## T2 — Alta de empaque con subtipo (2026-10-23)

### Archivos

Producción (modificados):
- `lib/modules/inventario/domain/product-input.ts`: la rama `PACKAGING` gana `packagingSubtype`
  (`z.enum(PACKAGING_SUBTYPE_VALUES)`, por defecto `CONTAINER`) y `presentationId` pasa a opcional;
  el `superRefine` exige presentación en el envase y la prohíbe en tapa/medidor/otro (issue en
  `presentationId`). `PRODUCT`, `MACHINE` y `updateUnion` no cambian (R8, R10 por `strictObject`).
- `lib/modules/inventario/domain/product-view.ts`: `PackagingIdentity` = `{ presentationId: string | null, unitId, packagingSubtype?: PackagingSubtype }`.
- `lib/modules/inventario/ports/product-repository.ts`: `findAlivePackagingByName` devuelve
  `{ id, presentationId: string | null, packagingSubtype }`.
- `lib/modules/inventario/domain/create-product.ts` (`createPackaging`): homónimo con otro subtipo u
  otra presentación → `ActionNotAllowedError`; `addBatchToAlive` recibe `{ presentationId }` solo si
  hay presentación; nace con `{ presentationId, unitId, packagingSubtype }`.
- `lib/modules/inventario/adapters/driven/persistence/product-prisma.ts`: `findAlivePackagingByName`
  sin la condición `presentationId != null` y con `packagingSubtype`; `createWithFirstBatch` solo
  consulta la presentación si viene y escribe `packaging_subtype` = subtipo de `packaging` (o
  `CONTAINER`) en `PACKAGING`, `NULL` en el resto.
- `lib/modules/inventario/adapters/driving/product-actions.ts`: lee `packagingSubtype` del `FormData`
  en el alta; ausente o vacío no viaja.

Tests:
- `tests/unit/inventario/product-input.test.ts`: bloque nuevo «QT-296 — subtipo de empaque en el
  alta y la edicion» (casos existentes intactos).
- `tests/unit/inventario/create-product.test.ts`: bloque nuevo «QT-296 — homonimo de un empaque por
  subtipo»; además, en los casos QC-195 existentes, los dobles de `findAlivePackagingByName` ganan
  `packagingSubtype: CONTAINER` (el puerto lo exige) y dos `toEqual` de la identidad ganan
  `packagingSubtype: CONTAINER` (ver divergencias).
- `tests/unit/inventario/product-actions.test.ts`: bloque nuevo «QT-296 — el subtipo de empaque
  viaja del FormData al caso de uso».
- `tests/integration/inventario/qt296-packaging-subtype-product.int.test.ts` (nuevo) y su fila
  `commit` en `tests/integration/aislamiento.json`.
- Siembras directas (solo se añade `packagingSubtype: type === 'PACKAGING' ? 'CONTAINER' : null` en
  el helper que inserta el producto): `qc195-packaging-constraints.int`, `order-consumption-ledger.int`,
  `product-batch-lot-per-presentation.int`, `product-batch-require-unit.int`.

### Divergencias con `design.md > 4.1`

1. **`PackagingIdentity.packagingSubtype` es opcional**, y `createWithFirstBatch` decide el subtipo
   por `product.type`: `PACKAGING` → el de `packaging` o `CONTAINER`; otro tipo → `NULL`. Motivo:
   cinco archivos de test (`tests/helpers/packaging-seed.ts`, `order-batches.int`,
   `qc195-packaging-catalog.int`, `qc195-packaging-list.int`, `order-ingredients-cost.int`) llaman al
   adaptador con la identidad de QC-195 sin subtipo, y dos (`qc195-packaging-catalog.int`,
   `qc195-packaging-list.int`) siembran un «envase legado» `PACKAGING` sin `packaging`. Con el campo
   obligatorio habría que tocar esas siembras, fuera del alcance pedido. El dominio siempre lo manda,
   y es la misma regla de R5 (sin subtipo = envase).
2. `create-product.test.ts` (QC-195, «R1, R6» y «R11 envase e instrumento») cambia dos expectativas
   `toEqual` de la identidad: ahora incluyen `packagingSubtype: CONTAINER`. Es consecuencia directa
   del diseño («nace con `{ presentationId, unitId, packagingSubtype }`»). Los casos de `PACKAGING` de
   `product-input.test.ts` y de `qc195-packaging-product.int.test.ts` **no** cambian.
3. Comportamiento nuevo pedido por el diseño: un envase legado sin presentación ya cuenta como
   homónimo; un alta de envase con presentación sobre ese nombre da `action_not_allowed` (antes creaba
   otro producto).

### Mapa R → test

| R | Test |
|---|---|
| R5 | `product-input.test.ts` › «R5 — un empaque sin subtipo es un envase»; `product-actions.test.ts` › «R5 — sin packagingSubtype en el FormData, o vacio, la clave no viaja…»; `qt296-packaging-subtype-product.int.test.ts` › «R5 — un empaque dado de alta sin subtipo queda como envase…» |
| R6 | `product-input.test.ts` › «R6 — un envase sin presentacion es invalid_input…», «R6, R7, R8 — el caso de uso rechaza la entrada invalida con invalid_input sin consultar ni escribir» |
| R7 | `product-input.test.ts` › «R7 — tapa, medidor y otro entran sin presentacion y con existencia entera», «R7 — tapa, medidor u otro con presentacion es invalid_input», «R7 — un subtipo fuera del catalogo es invalid_input»; `create-product.test.ts` › «R7 — una tapa sin homonimo nace sin presentacion…»; `product-actions.test.ts` › «R7 — pasa packagingSubtype tal cual al caso de uso»; `qt296-packaging-subtype-product.int.test.ts` › «R7 — una tapa queda con subtipo CAP, sin presentacion, en la unidad de envases…» |
| R8 | `product-input.test.ts` › «R8 — PRODUCT o MACHINE con subtipo es invalid_input», «R6, R7, R8 — el caso de uso rechaza…» |
| R9 | `create-product.test.ts` › «R9 — un homonimo con otro subtipo se rechaza con action_not_allowed sin escribir», «R9 — un homonimo envase con el mismo subtipo y la misma presentacion suma un lote», «R9 — una tapa homonima de una tapa suma un lote sin presentacion»; `qt296-packaging-subtype-product.int.test.ts` › «R9 — un homonimo con otro subtipo se rechaza sin escribir ninguna fila; con el mismo subtipo suma un lote» |
| R10 | `product-input.test.ts` › «R10 — la edicion con packagingSubtype es invalid_input, en cualquier tipo» |

### Salida real

`pnpm run typecheck`: `tsc --noEmit`, exit 0.

`pnpm run lint`: exit 0, `✖ 10 problems (0 errors, 10 warnings)` (los mismos 10 de T1; ninguno en
archivos de T1/T2).

`pnpm exec vitest run guard`:
```
 Test Files  87 passed (87)
      Tests  1276 passed | 22 skipped (1298)
```

`pnpm exec vitest related --run <los 32 archivos cambiados frente a HEAD, T1 + T2, sin progress/>`
con `.env` cargado (`QuimiCloude_QT296`). Primera corrida, con el subtipo escrito solo cuando venía
`packaging`:
```
 Test Files  2 failed | 727 passed (729)
      Tests  2 failed | 12566 passed | 8 skipped (12576)
```
(los dos envases legados de `qc195-packaging-catalog.int` y `qc195-packaging-list.int`, divergencia 1).
Tras decidir el subtipo por `product.type`:
```
 Test Files  729 passed (729)
      Tests  12568 passed | 8 skipped (12576)
   Duration  1240.46s
```

### Bloqueo de T1: resuelto

Los 126 fallos de T1 en 18 suites (121 por `createWithFirstBatch` y 5 por siembras directas) están
en verde: el adaptador escribe el subtipo en todo `PACKAGING` y las 5 siembras ganan
`packagingSubtype`. T1 y T2 van en el mismo commit.

**Veredicto T2:** R5–R10 en verde; typecheck, lint, guardias y `vitest related` (729/729 archivos) en
verde, con tres divergencias anotadas arriba.
