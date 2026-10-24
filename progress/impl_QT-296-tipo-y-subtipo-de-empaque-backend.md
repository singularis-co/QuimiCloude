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

## T3 — Subtipo en lecturas y filtro del listado (2026-10-23)

### Archivos
Producción (modificados):
- `lib/modules/inventario/domain/product-view.ts`: `ProductView.packagingSubtype?: PackagingSubtype | null`.
- `lib/modules/inventario/domain/product-queryable.ts`: `PRODUCT_PACKAGING_SUBTYPE_FILTER = 'packagingSubtype'` y
  `filterable.packagingSubtype: 'select'` (no ordenable).
- `lib/modules/inventario/adapters/driven/persistence/product-prisma.ts`: `PRODUCT_SELECT` gana
  `packagingSubtype` y `toProductView` lo copia. `productFilterWhere` traduce el filtro a
  `{ packagingSubtype: { in: validos } }` y descarta lo que no está en `PACKAGING_SUBTYPE_VALUES`
  (sin válidos, ninguna condición), igual que con `type`.
- `lib/modules/inventario/adapters/driven/persistence/finished-stock-prisma.ts`: su llamada a
  `toProductView` (filas de `FINISHED_PRODUCT` por SQL crudo) pasa `packagingSubtype: null`.

Tests:
- `tests/integration/inventario/list-query-products.int.test.ts` (ampliado): `sembrar` admite `type`,
  `packagingSubtype` y `companyId`. Tiene un bloque nuevo, «QT-296 — el subtipo de empaque en la lectura y en el
  filtro del listado», y el `afterAll` borra también la empresa ajena.
- `tests/unit/inventario/product-prisma.test.ts`: `filaBase` gana `packagingSubtype: null`. Bloque
  nuevo: «QT-296 — subtipo de empaque en la lectura y el filtro del listado».
- `tests/unit/shared/listas-blancas-listados.test.ts` (ampliado): bloque QT-296.
- Censos que fijaban la forma anterior (consecuencia directa del diseño):
  - `tests/unit/inventario/list-query.test.ts`: las claves de `PRODUCT_QUERYABLE.filterable` ganan
    `packagingSubtype`.
  - `tests/unit/inventario/company-scope.test.ts`: las claves de `toProductView` ganan
    `packagingSubtype`, y la fila del caso gana `packagingSubtype: null`.

### Divergencia con `design.md > 4.3`
`ProductView.packagingSubtype` es **opcional** (`?: PackagingSubtype | null`), no obligatorio.
- **Motivo:** con el campo obligatorio, `tsc` cae en 30 archivos de test que construyen un
  `ProductView` a mano. Son dobles y fixtures, casi todos de UI y fuera del alcance de backend
  (`paridad/*`, `inventario-ui/*`, `recetas-ui/*`, `shared-ui/*`, `inventario/*.tsx`…).
- **Lo que se mantiene:** los dos adaptadores que leen de la base (`PRODUCT_SELECT`/`toProductView`
  y `finished-stock-prisma`) **siempre** lo rellenan, y R11 lo prueba contra Postgres.
- Es el mismo criterio que la divergencia 1 de T2.
- **Para volverlo obligatorio:** basta un cambio mecánico en esos 30 archivos (una línea
  `packagingSubtype: null` por fixture).

### Mapa R → test
| R | Test |
|---|---|
| R11 | `list-query-products.int.test.ts` › «R11 — el detalle y el listado devuelven el subtipo, y null en lo que no es empaque» (`findAliveProductById`, que es lo que llama `getProduct`, y `listAliveProducts`); `product-prisma.test.ts` › «R11 — PRODUCT_SELECT trae el subtipo y toProductView lo copia tal cual» |
| R12 | `list-query-products.int.test.ts` › «R12 — con packagingSubtype = {CAP} salen solo las tapas vivas de la empresa» (con una tapa de baja y una tapa de otra empresa sembradas), «R12 — varios subtipos a la vez se suman, y un valor desconocido se descarta como con type»; `product-prisma.test.ts` › «R12 — se traduce a los subtipos validos pedidos», «R12 — un valor desconocido se descarta, y si no queda ninguno no compone condicion»; `listas-blancas-listados.test.ts` › «R12 — productos declara packagingSubtype como filtro de seleccion, sin hacerlo ordenable» |

## T4 — Solo envases en el reparto (2026-10-23)

### Archivos
Producción (modificado):
- `lib/modules/inventario/adapters/driven/persistence/packaging-catalog-prisma.ts`: `findAlivePackaging`
  gana `packagingSubtype: CONTAINER`. Es la única consulta de productos del archivo y la usan tanto
  `findRefs` como `findPackagingCostingBatches`: los lotes de costeo solo se piden de los productos
  que devuelve, así que el filtro cubre los dos. `pedidos` no se toca.

Tests (nuevos):
- `tests/integration/inventario/qt296-only-containers.int.test.ts`.
- `tests/integration/pedidos/qt296-distribution-rejects-caps.int.test.ts`: cableado real de
  `createOrder`, `updateOrder`, `updateOrderPresentationLines`, `transition`, `startPacking` y
  `finishPacking`, como en `finish-with-finished-goods.int.test.ts`.
- `tests/integration/aislamiento.json`: las dos filas nuevas en `commit`, justo después de la de T2.

### Nota sobre R13/R14
- **R14:** sus tests pasarían también **sin** el filtro nuevo, por dos motivos:
  - `findAlivePackaging` ya exigía `presentationId != null`;
  - el CHECK `products_presentation_only_in_container` (R3) impide que una tapa, un medidor u otro
    tengan presentación.

  El filtro por subtipo es la defensa en el servidor que pide el diseño. Con datos válidos no hay
  forma de sembrar un caso que lo distinga.
- **R13:** pasa lo mismo. El selector ya deja fuera tapa y medidor porque no tienen presentación. El
  test incluye el control sin el filtro por unidad, donde salen los tres.

### Mapa R → test
| R | Test |
|---|---|
| R13 | `qt296-only-containers.int.test.ts` › «R13 — la consulta del selector (type=PACKAGING, presentationUnitId={l}) devuelve solo el envase» |
| R14 | `qt296-only-containers.int.test.ts` › «R14 — findRefs con los ids del envase, la tapa y el medidor devuelve solo el envase», «R14 — findCostingBatches no trae lotes de la tapa ni del medidor, aunque tengan existencia y costo»; `qt296-distribution-rejects-caps.int.test.ts` › «R14 — el alta con una linea de reparto que apunta a una tapa da packaging_not_found y no escribe nada», «R14 — la edicion de un pedido con una linea que apunta a un medidor da packaging_not_found y el pedido queda intacto», «R14 — «Reparto y unidad» en POR_EMPACAR con una linea que apunta a una tapa da packaging_not_found sin escribir nada» |
| R39 | `qt296-distribution-rejects-caps.int.test.ts` › «R39 — Terminar el empaque con un envase en el reparto no toca la existencia de la tapa ni del medidor» (control: la existencia del envase sí cambia) |

Cómo sale `packaging_not_found` en cada camino:
- en el alta y la edición, como `ProductNotFoundError` de `pedidos`, que es como lo traduce hoy
  `resolveDistribution`;
- en «Reparto y unidad», como el literal `'packaging_not_found'`.

### Salida real (T3 + T4)
Los tests nuevos y ampliados, con `.env` cargado (base efímera de la plantilla). Primera tanda:
`qt296-distribution-rejects-caps`, `qt296-only-containers`, `qc195-packaging-catalog`,
`qc195-packaging-list` y `guard-aislamiento-integracion`.
```
 Test Files  5 passed (5)
      Tests  22 passed (22)
```
Segunda tanda: `qt296-only-containers`, `list-query-products`, `product-prisma` y
`listas-blancas-listados`.
```
 Test Files  4 passed (4)
      Tests  45 passed (45)
```

`pnpm run typecheck`: `tsc --noEmit`, exit 0 (con el trabajo en curso de T6 en `proveedores`).
`pnpm run lint`: `✖ 10 problems (0 errors, 10 warnings)`, los mismos 10 de T1/T2.
`pnpm exec vitest run guard`:
```
 Test Files  87 passed (87)
      Tests  1276 passed | 22 skipped (1298)
```
`pnpm exec vitest related --run <los 10 archivos de T3/T4>`: los 5 de producción, los 3 tests
ampliados y los 2 nuevos. Primera corrida:
```
 Test Files  6 failed | 719 passed (725)
      Tests  2 failed | 12504 passed | 8 skipped (12514)
   Duration  3813.30s
```
- **2 fallos reales:** los censos de `list-query.test.ts` y `company-scope.test.ts` (arriba). Ya
  están corregidos.
- **4 suites caídas por `Hook timed out in 10000ms` en su `afterAll`:** `clientes/customer-phone-shared`,
  `inventario/deliverable-batches`, `inventario/product-crud` y `recetas/list-query-recipes`. La
  causa es la carga de la máquina: la corrida duró 63 min, en paralelo con la de T6. Ninguna toca
  código de T3/T4.

Las seis, solas, tras el arreglo:
```
 Test Files  6 passed (6)
      Tests  61 passed (61)
```

**Veredicto T3/T4:** R11–R14 y R39 en verde. Typecheck, lint y guardias en verde. `vitest related`
queda en verde tras corregir dos censos y repetir cuatro suites caídas por tiempo. Hay una
divergencia: `ProductView.packagingSubtype` es opcional.

## T6 — Tipo y subtipo en la línea de catálogo (2026-10-23)

### Archivos
Producción (`lib/modules/proveedores/`):
- `domain/imported-classification.ts` (nuevo): `resolveImportedClassification(stored, incoming)`.
- `domain/catalog-line-input.ts`:
  - `catalogLineFieldsShape` se exporta con `type` y `packagingSubtype`
    (`z.enum(...).nullable().optional()`);
  - el alta usa `superRefine(subtypeOnlyInPackaging)`;
  - la edición usa `bothOrNeither` + `subtypeOnlyInPackaging`.
- `domain/catalog-line-view.ts`:
  - tipos nuevos: `CatalogLineClassification` y `CatalogLineBusinessFields` (los nueve campos de siempre);
  - `CatalogLineFields = negocio & clasificación`;
  - `CatalogLineReplacement = negocio & { classification? }`;
  - `CatalogLineView` hereda `type` y `packagingSubtype`.
- `domain/create-catalog-line.ts` e `import-catalog-lines.ts`: pasan `type ?? null` y
  `packagingSubtype ?? null`.
- `domain/update-catalog-line.ts`: manda `classification` solo si la entrada trae los campos.
- `domain/find-catalog-lines-by-identity.ts`: `AliveCatalogLineByIdentity` gana la clasificación.
- `ports/supplier-catalog-repository.ts`: `replaceAlive(id, data: CatalogLineReplacement, …)`.
- `ports/supplier-catalog-import-repository.ts`: las líneas de `findAliveByIdentities` ganan la
  clasificación, y el texto de `upsertCostByIdentity` ya no dice «solo el costo».
- `adapters/driven/persistence/supplier-catalog-line-prisma.ts`:
  - el select y la vista llevan las dos columnas;
  - el alta las escribe;
  - la edición escribe `classification` solo si viene.
- `adapters/driven/persistence/supplier-catalog-import-prisma.ts`:
  - la lectura por identidad trae las dos columnas;
  - `INSERT … ON CONFLICT` con el SQL de `design.md > 5.3`. El `CASE` del subtipo vive en una
    constante `Prisma.sql` y la usan el `SET` y el `WHERE`.
- `adapters/driving/supplier-catalog-actions.ts`: `readClassification` (clave ausente = no viaja;
  vacía = `null`).
- `index.ts`: exporta `catalogLineFieldsShape`, `CatalogLineBusinessFields`,
  `CatalogLineClassification`, `CatalogLineReplacement` y `resolveImportedClassification`.

Tests:
- `tests/unit/proveedores/imported-classification.test.ts` (nuevo).
- `tests/unit/proveedores/catalog-line-input.test.ts`:
  - bloque nuevo «QT-296 — tipo y subtipo en el alta y la edicion manual de la linea»;
  - los dos censos de `.shape` ganan `type` y `packagingSubtype`.
- `tests/integration/proveedores/catalog-line.int.test.ts` y `catalog-import-upsert.int.test.ts`:
  bloque QT-296 en cada uno; sus helpers `fields` y `campos` ganan los dos campos.
- `tests/unit/proveedores/scope.test.ts`:
  - el censo de `SupplierCatalogLine` gana `type` y `packagingSubtype`;
  - la lista de migraciones que tocan las tablas gana `20261023150000_packaging_subtype`.

  **Estaba rojo desde T1.** Lee `db/schema.prisma` y `db/migrations/`, y no salió en el
  `vitest related` de T1/T2.
- `catalog-service.test.ts` e `import-catalog-lines.test.ts`: las expectativas `toEqual` del dato
  que llega al puerto ganan `type: null, packagingSubtype: null` (`design.md > 11`).
- **Arreglos de compilación.** `CatalogLineView` y `CatalogLineFields` ganan campos obligatorios.
  En estos archivos solo se añade `type: null, packagingSubtype: null` al fixture, sin tocar
  ninguna aserción:
  - `tests/integration/proveedores/company-scope-queries.int.test.ts`;
  - `tests/unit/proveedores/{catalog-image-url,company-isolation-service,showcase-service}.test.ts`;
  - `tests/unit/proveedores-ui/{catalog-columns,catalog-line-form,catalog-line-sheet,delete-catalog-line-dialog,supplier-detail-page}.test.tsx`;
  - `tests/unit/paridad/{acciones-por-fila,campos-paridad,catalogo-paridad,confirmaciones-paridad,formularios-paridad}.test.tsx`;
  - `tests/unit/shared-ui/confirm-dialog-montado.test.tsx`;
  - `tests/unit/documentos-ui/supplier-detail-upload.test.tsx`;
  - en `documentos`, el arreglo mínimo pedido: los dobles de `findAliveByIdentity` de
    `tests/unit/documentos/confirm-catalog-import.test.ts` y `preview-catalog-import.test.ts`.

Lo que no se tocó:
- **`lib/modules/documentos/**`.** Con zod 4, `superRefine` sobre un `strictObject` conserva
  `.shape`. Por eso `classify-catalog-import.ts` (`createCatalogLineSchema.shape.*`) compila y se
  comporta igual. Pasar a `catalogLineFieldsShape` queda para T7.
- **`tests/integration/aislamiento.json`.** Los dos `.int` ampliados ya tenían su fila.

### Divergencias con `design.md > 5`
1. **Forma del puerto de edición.** El diseño pide que la edición reciba un `classification?`
   opcional. Va como campo de `data` (`CatalogLineReplacement`), no como parámetro aparte, porque
   las firmas del módulo llevan `scope` al final y no opcional. El alta y la importación usan
   `CatalogLineFields`, con los dos campos obligatorios y anulables.
2. **R28, «detalle».** El módulo no tiene lectura de una línea por id. Su única lectura es el
   listado (`listBySupplierAlive`, que también usa la vitrina). R28 se prueba sobre el listado y
   sobre la lectura por identidad, y `CatalogLineView` es el tipo de las dos.

### Mapa R → test (lado `proveedores`)
| R | Test |
|---|---|
| R26 | `catalog-line-input.test.ts` › «R26 — en el alta, sin tipo ni subtipo la linea queda sin tipo», «R26 — en el alta, PACKAGING_MATERIAL + CAP vale y llega al puerto; un tipo sin subtipo tambien», «R26 — en el alta, un subtipo con TOOL o sin tipo, o un valor ajeno, es invalid_input sin escribir»; `catalog-line.int.test.ts` › «R26, R27, R28 — el alta los guarda, …» |
| R27 | `catalog-line-input.test.ts` › «R27 — en la edicion, sin ninguno de los dos el puerto no recibe clasificacion…», «R27 — en la edicion, con los dos se reemplazan y null + null quita», «R27 — en la edicion, uno solo de los dos, o un subtipo sin empaque, es invalid_input sin escribir»; `catalog-line.int.test.ts` › «R26, R27, R28 — …» |
| R28 | `catalog-line.int.test.ts` › «R26, R27, R28 — … y el listado los devuelve»; `catalog-import-upsert.int.test.ts` › «R34, R35 — la lectura por identidad devuelve el tipo y el subtipo guardados» |
| R33 | `catalog-import-upsert.int.test.ts` › «R33 — una linea nueva se guarda con el tipo y el subtipo de su fila», «R33 — una linea nueva sin tipo queda sin tipo ni subtipo» |
| R34 | `imported-classification.test.ts` › tabla «R34 — guardado %j + importado %j = %j» (14 filas), «R34 — un subtipo importado sin tipo empaque resultante se descarta», «R34 — el resultado nunca deja un subtipo bajo un tipo que no es empaque…»; `catalog-import-upsert.int.test.ts` › «R34 — sobre una linea viva CAP, null no la borra, CONTAINER la reemplaza y TOOL deja el subtipo en NULL», «R34 — el SQL da lo mismo que resolveImportedClassification en cada transicion» |
| R35 | `catalog-import-upsert.int.test.ts` › «R35 — con el mismo costo y solo un tipo nuevo cuenta `updated`; sin cambios, `unchanged`» |

### Salida real
`pnpm run typecheck`: `tsc --noEmit`, exit 0.
`pnpm run lint`: `✖ 10 problems (0 errors, 10 warnings)`, los mismos 10 de antes. Ninguno es de T6.

`pnpm exec vitest run guard`:
```
 Test Files  87 passed (87)
      Tests  1276 passed | 22 skipped (1298)
```
Los dos `.int` de proveedores, con `.env` cargado:
```
 Test Files  2 passed (2)
      Tests  30 passed (30)
```
`pnpm exec vitest related --run <los 38 archivos de T6>`, con `.env` cargado. El barrel arrastra
casi toda la suite, y la primera corrida la cortó mi propio `timeout 3000` antes del resumen. La
segunda:
```
 Test Files  494 passed (494)
      Tests  8283 passed | 3 skipped (8286)
   Duration  1181.70s
```

**Veredicto T6:** R26–R28 y R33–R35 (lado `proveedores`) en verde. `scope.test.ts`,
`catalog-service.test.ts`, typecheck, lint, guardias y `vitest related` también en verde. Hay dos
divergencias de forma, anotadas arriba.

## T5 — Columna «Subtipo» en el Excel (2026-10-23)

### Bloqueo anterior (resuelto)
La primera pasada se paró sin tocar nada. `subtype` amplía `ImportColumnKey`, y
`GUIDE_COLUMN_DESCRIPTION_TEXTS` (`import-texts.ts`, UI de QT-297) exige un texto por clave que el
spec no daba. El humano aprobó la excepción de abajo y T5 se retomó con las dos notas que había
dejado: los defaults de `productRef` del kit necesitan `packagingSubtype`, y el borrador de una
tapa o un medidor va sin `presentationId`. Las dos están aplicadas.

### Excepción de UI aprobada por el humano (2026-10-23)
Es el único cambio bajo `app/**`, en `app/(private)/inventario/importar/components/import-texts.ts`,
`GUIDE_COLUMN_DESCRIPTION_TEXTS`, con `subtype` justo después de `type` (el orden del contrato):
- `type: 'Qué es el producto: Insumo, Empaque, Instrumento o Producto terminado. Decide qué otras columnas se piden.'`
- `subtype: 'Solo en Empaque: Envase, Tapa, Medidor u Otro. Si va vacío, es Envase. Tapa, Medidor y Otro no llevan presentación.'`

`GUIDE_COLUMN_DESCRIPTIONS` (`import-guide-descriptions.tsx`) hace spread de ese mapa y no se tocó.
Ningún test de UI fijaba el texto viejo ni contaba columnas: `tests/unit/inventario/importar/` pasó
sin cambiar ninguna expectativa (salvo los fixtures de tipos, abajo).

### Archivos
Producción (`lib/modules/inventario/`):
- `domain/inventory-import-contract.ts`:
  - columna `subtype` («Subtipo», `headerRequired: false`, `optional` solo en `PACKAGING`) después de `type`;
  - `IMPORT_TYPE_LABELS.PACKAGING = 'Empaque'`, `IMPORT_TYPE_ALIASES = { PACKAGING: ['Envase'] }` y `IMPORT_SUBTYPE_LABELS`;
  - los códigos `subtype_invalid` y `subtype_mismatch`;
  - `ImportRowBase.packagingSubtype: PackagingSubtype | null`.
- `domain/import-cell-parsing.ts`: `TYPE_BY_LABEL` con etiquetas y alias, construido con `labelMap`, que lanza si un alias choca con otra etiqueta. `parseImportSubtype` nuevo: vacío es `CONTAINER`.
- `domain/plan-inventory-import.ts`:
  - `columnRule(column, type, subtype)` sustituye a las lecturas directas de `column.rules[type]` en `checkRequired`, `withoutIgnoredColumns` y `readValues`;
  - en un empaque que no es envase, `presentation` es `forbidden`;
  - el subtipo se lee antes de quitar las columnas ignoradas;
  - identidad `E|<nombre>` contra cualquier empaque vivo (ya no exige `presentationId !== null`). Primero `subtype_mismatch` y luego, solo en envase, `presentation_mismatch`. `FileProduct` lleva el subtipo;
  - el candidato lleva `packagingSubtype`, y `presentationId` solo si es envase. Hay dos mensajes nuevos.
- `domain/inventory-import-downloads.ts`: `subtype: ''` en los cuatro ejemplos y `LEGACY_IMPORT_EXAMPLE_ROWS`, con «Envase» en el empaque.
- `domain/import-sheet.ts`: `CANONICAL_EXAMPLES` con las dos listas.
- `domain/confirm-inventory-import.ts`:
  - `baseOf` pasa `packagingSubtype`;
  - una `ActionNotAllowedError` en un empaque da `presentation_mismatch` si es envase y `subtype_mismatch` si no.
- `ports/inventory-import-repository.ts`: `ImportProductRef.packagingSubtype`.
- `adapters/driven/persistence/inventory-import-prisma.ts`: lo selecciona y lo mapea.
- `index.ts`: exporta `IMPORT_TYPE_ALIASES`, `IMPORT_SUBTYPE_LABELS` y `LEGACY_IMPORT_EXAMPLE_ROWS`.

UI (la excepción aprobada): `app/(private)/inventario/importar/components/import-texts.ts`.

Tests:
- Ampliados con casos nuevos:
  - `tests/unit/inventario/plan-inventory-import.test.ts`: dos bloques «QT-296»;
  - `confirm-inventory-import.test.ts`, `import-cell-parsing.test.ts`, `import-header.test.ts`, `import-sheet-limits.test.ts` e `inventory-import-downloads.test.ts`;
  - `inventory-import-contract.test-d.ts`;
  - `tests/integration/inventario/inventory-import-confirm.int.test.ts`: R22 y R41;
  - `inventory-import-repository.int.test.ts`: R20, lado del adaptador.
- Solo expectativas o fixtures, por la columna nueva y `packagingSubtype`:
  - `inventory-import-kit.ts`: `productRef` pone `CONTAINER` por defecto en `PACKAGING` y `null` en el resto;
  - `importar/import-preview-fixtures.ts` e `inventory-import-actions.test.ts`;
  - en `inventory-import-downloads.test.ts`: la cabecera con «Subtipo», «Empaque» en la hoja de valores y el índice de «Nombre» en R28 (`row[2]` → `row[3]`);
  - en `inventory-import-repository.int.test.ts` R17: `packagingSubtype: null`;
  - `tests/integration/inventario/xlsx-reader.test.ts`: `FIXTURE_COLUMNS`, porque el fixture es anterior a la columna (ver Verificación).
- `tests/integration/aislamiento.json` no cambia: no hay `.int` nuevo, e `inventory-import-confirm` ya estaba registrado.
- No toqué los archivos de T8 (`ai-reader-canned.ts` y su test).

### Divergencias y decisiones
1. **Subtipo ilegible en un empaque.** La fila da `subtype_invalid` y su `packagingSubtype` es `null`. `presentation` queda sin regla (ni obligatoria ni ignorada), y el resto se valida como envase. Así sale un único motivo por la columna culpable.
2. **El texto de `type_invalid` sigue diciendo «Envase».** («debe ser Insumo, Envase, Instrumento o Producto terminado.»). El spec no lo menciona, y R41 pide que un archivo existente dé la misma vista previa que hoy. «Envase» sigue siendo válido. Lo dejo así y lo marco como abierto, por si el humano lo quiere decir «Empaque».
3. **La hoja «Valores disponibles» no lista subtipos.** R42 solo pide «Empaque» en ella, y una columna nueva cambiaría su forma sin que el spec lo pida.
4. **Exports nuevos en `index.ts`**, para la UI de QT-297. El diseño no los pedía explícitamente.

### Mapa R → test
| R | Test |
|---|---|
| R15 | `plan-inventory-import.test.ts` › «R15 un archivo sin la columna «Subtipo» planifica igual que hoy, con los empaques como CONTAINER»; `import-header.test.ts` › «R15 «Subtipo» es opcional: sin la columna la celda va vacia, y con ella se lee por su cabecera» |
| R16 | `plan-inventory-import.test.ts` › «R16 «Subtipo» vacio o con solo espacios en un empaque es CONTAINER»; `import-cell-parsing.test.ts` › «R16 %j vacio es CONTAINER» |
| R17 | `plan-inventory-import.test.ts` › «R17 «tapa», «MEDIDOR» y « Otro » se leen…», «R17 «gatillo» deja la fila en error subtype_invalid sobre «Subtipo»»; `import-cell-parsing.test.ts` › «R17 %j se lee sin mayusculas…», «R17 %j es invalido» |
| R18 | `plan-inventory-import.test.ts` › «R18 una tapa con «Presentación» la anota en ignoredColumns y sigue…», «R18 un envase sin presentacion da value_required, con o sin «Subtipo»» |
| R19 | `plan-inventory-import.test.ts` › «R19 un insumo, un instrumento o un terminado con «Subtipo» lo anota en ignoredColumns y sigue» |
| R20 | `plan-inventory-import.test.ts` › «R20 un empaque vivo con otro subtipo da subtype_mismatch; con el mismo, add_batch», «R20 una fila anterior del archivo…», «R20 un envase vivo con el mismo subtipo sigue con su regla de presentacion»; `confirm-inventory-import.test.ts` › «R20 un rechazo del alta en carrera es subtype_mismatch en una tapa y presentation_mismatch en un envase»; `inventory-import-repository.int.test.ts` › «R20 devuelve el subtipo de cada empaque vivo…» |
| R21 | `inventory-import-downloads.test.ts` › «R21 la cabecera trae «Subtipo» justo despues de «Tipo»…»; `import-sheet-limits.test.ts` › «R21 todas las filas de ejemplo de la plantilla nueva se ignoran», «R21 la fila de ejemplo de empaque de una plantilla antigua… se ignora», «R21 las demas filas de ejemplo de una plantilla antigua tambien se ignoran», «R21 una fila igual al ejemplo antiguo pero con «ENVASE» se sigue importando, como hoy» |
| R22 | `inventory-import-confirm.int.test.ts` › «R22 confirmar un envase, una tapa y un medidor crea los tres con su subtipo, y la tapa sin presentacion»; `confirm-inventory-import.test.ts` › «R22 cada empaque llega al alta con el subtipo de su fila…» |
| R41 | `import-cell-parsing.test.ts` › «R41 %j es PACKAGING», «R41 %j sigue dando type_invalid…»; `plan-inventory-import.test.ts` › «R41 un archivo con «Envase» y sin «Subtipo» da la misma vista previa que antes, fila por fila», «R41 «Empaque» en lugar de «Envase» da exactamente la misma vista previa»; `inventory-import-confirm.int.test.ts` › «R41 una fila con «Envase» y otra con «Empaque»… crean un solo envase con dos lotes» |
| R42 | `inventory-import-downloads.test.ts` › «R42 la fila de ejemplo del empaque dice «Empaque» y no «Envase»», «R42 la hoja de valores admitidos dice «Empaque» y no «Envase»» |

### Verificación
`pnpm run typecheck`: `tsc --noEmit`, exit 0. Incluye `inventory-import-contract.test-d.ts`.
`pnpm run lint`: `✖ 10 problems (0 errors, 10 warnings)`, los mismos 10 de antes, ninguno en archivos de T5.
`pnpm exec vitest run guard`:
```
 Test Files  87 passed (87)
      Tests  1276 passed | 22 skipped (1298)
```
Unit de la importación (los 6 archivos ampliados):
```
 Test Files  6 passed (6)
      Tests  194 passed (194)
```
`tests/unit/inventario/importar/` (UI de la importación, sin cambiar expectativas):
```
 Test Files  9 passed (9)
      Tests  178 passed (178)
```
Integración (`.env` cargado) de `inventory-import-confirm` e `inventory-import-repository`:
- primera pasada: 1 rojo, en R17 del repositorio, porque esperaba la forma sin `packagingSubtype`. Se ajustó la expectativa;
- segunda pasada:
```
 Test Files  2 passed (2)
      Tests  22 passed | 1 skipped (23)
```
`pnpm exec vitest related --run <archivos de T5>`, con los 10 de producción, el de UI y los tests y fixtures tocados, sin T8. Primera corrida:
```
 Test Files  1 failed | 688 passed (689)
      Tests  6 failed | 12236 passed | 8 skipped (12250)
   Duration  1104.13s
```
- Los 6 rojos eran de `tests/integration/inventario/xlsx-reader.test.ts`, y ninguno era un `Hook timed out`.
- Su fixture `mixto.xlsx` es un Excel real de antes de la ficha, sin «Subtipo». El test ubicaba las columnas por posición con `INVENTORY_IMPORT_COLUMNS`.
- Arreglo solo en el test: `FIXTURE_COLUMNS` = las columnas sin `subtype`. El binario no se toca.
- Su caso «R4 R6 la hoja entera pasa a filas…» ya pasaba sin cambios: una plantilla antigua sin «Subtipo» se sigue leyendo (R15).

`xlsx-reader.test.ts`, solo, después del arreglo:
```
 Test Files  1 passed (1)
      Tests  12 passed (12)
```
`tsc --noEmit` exit 0 y `eslint` del archivo exit 0 tras el arreglo.

**Veredicto T5:** R15–R22, R41 y R42 en verde. Typecheck, lint y guardias también en verde, y en `vitest related` el único archivo rojo (`xlsx-reader`) quedó verde tras el arreglo. Sin dependencias nuevas, y bajo `app/**` solo la excepción aprobada.

## T7 — Lectura del PDF: interpretación, clasificación, vista previa y confirmación (2026-10-23)

### Archivos
Producción (`lib/modules/documentos/domain/`, solo el barrel de `proveedores`):
- `catalog-extraction.ts`:
  - `extractedLineSchema` gana `type` y `packagingSubtype` (`z.enum(...).nullable().catch(null)`);
  - `ExtractedLine` gana los dos campos;
  - `trimLine` deja el subtipo en `null` si el tipo no es `PACKAGING_MATERIAL`.
- `catalog-import-input.ts`: `reviewedLineInputSchema` gana `type` y `packagingSubtype`
  (`z.enum(...).nullable().optional()`).
- `classify-catalog-import.ts`:
  - `ClassifyRowInput` y `AliveCatalogLine` ganan los dos campos;
  - `FIELD_VALIDATORS` gana `packagingSubtype`;
  - «cambia» = costo distinto **o** `resolveImportedClassification(viva, fila)` distinto de lo guardado.
- `preview-catalog-import.ts`:
  - `CatalogImportPreviewRow` gana `type`, `packagingSubtype` y `needsTypeReview`;
  - `fromExtractedLine`, `fromReviewedLine` y `toClassifyRow` pasan los dos campos, igual que el mapeo de las líneas vivas.
- `confirm-catalog-import.ts`: `toClassifyRow` y los `fields` de `importLines` pasan `type ?? null`
  y `packagingSubtype ?? null`.

Tests:
- `tests/unit/documentos/catalog-extraction.test.ts`: bloque nuevo «QT-296 — tipo y subtipo de cada linea».
- `tests/unit/documentos/preview-catalog-import.test.ts`: bloque nuevo «QT-296 — tipo, subtipo y marca de revision por fila».
- `tests/unit/documentos/classify-catalog-import.test.ts`:
  - bloque nuevo «classifyCatalogImportRows — QT-296, tipo y subtipo»;
  - el helper `fila` y las dos líneas vivas de los casos R9 ganan `type: null, packagingSubtype: null`, sin tocar ninguna aserción.
- `tests/unit/documentos/confirm-catalog-import.test.ts`: bloque nuevo «createConfirmCatalogImport — QT-296, tipo y subtipo».
- **Arreglo de compilación fuera de `documentos`:** `tests/unit/proveedores-ui/catalog-import-review.test.tsx`.
  - Su fixture `fila()` gana `type: null, packagingSubtype: null, needsTypeReview: true`, porque `CatalogImportPreviewRow` gana campos obligatorios.
  - No se toca ninguna aserción. Es el mismo precedente que en T6.

Lo que no se tocó:
- `ai-reader-canned.ts` (es de T8) y la UI. `catalog-import-review.tsx` arma `ReviewedLineInput` campo a campo y no reenvía la fila de la vista previa. Compila sin cambios y no manda los campos nuevos, que valen `null` (R32).
- `tests/integration/aislamiento.json`: T7 no añade ningún `.int`.
- `lib/modules/inventario/**`: es de T5.

### Divergencias
1. **`createCatalogLineSchema.shape.*` se mantiene en `classify-catalog-import.ts`.** T6 dejó como opción pasar a `catalogLineFieldsShape`. El diseño §6.3 no lo pide y con zod 4 `.shape` sigue igual tras `superRefine`. Lo dejé así para no ampliar el alcance.
2. **`ReviewedLineInput.type` y `.packagingSubtype` son opcionales en el tipo inferido.** No se usa `.transform(v => v ?? null)` en el borde: eso volvería obligatorios los campos en el tipo y rompería la compilación de `catalog-import-review.tsx`, que es UI de QT-297. El `?? null` se aplica en `fromReviewedLine` y en `confirm-catalog-import.ts`, y el efecto es el del diseño: si faltan, valen `null`.
3. **Subtipo sin tipo en una fila revisada.** Esa fila también sale «incompleta» por `packagingSubtype`. Es la regla de §6.3: es inválido si no es `null` y el tipo no es empaque. Hay un test.

### Mapa R → test (lado `documentos`)
| R | Test |
|---|---|
| R29 | `catalog-extraction.test.ts` › «R29 — lee type y packagingSubtype cuando son codigos validos», «R29 — RAW_MATERIAL sin subtipo se lee tal cual», «R29 — tipo y subtipo {ausentes, null, un numero, en minuscula o en espanol} quedan en null y la linea sigue…», «R29 — un subtipo «tapa» en minuscula queda null aunque el tipo sea empaque», «R29 — un tipo invalido en una linea no invalida las demas ni el documento» |
| R30 | `catalog-extraction.test.ts` › «R30 — RAW_MATERIAL + CAP deja el subtipo en null y conserva el tipo», «R30 — null + CAP deja el subtipo en null sin deducir el tipo empaque», «R30 — un subtipo sin clave type tampoco deduce el tipo» |
| R31 | `preview-catalog-import.test.ts` › «R31 — {sin tipo, empaque sin subtipo, materia prima, empaque con subtipo envase}: needsTypeReview = …», «R31 — la marca sale tambien de las filas leidas de la IA», «R31 — la marca no cambia kind: …«sin cambios»»; `confirm-catalog-import.test.ts` › «R31 — una fila marcada para revisar (empaque sin subtipo) no rechaza la confirmacion» |
| R32 | `preview-catalog-import.test.ts` › «R32 — las filas revisadas sin type ni packagingSubtype se aceptan…», «R32 — {un tipo ajeno, un subtipo ajeno} en una fila revisada rechaza la peticion con ValidationError», «R32 — una fila revisada con subtipo y tipo TOOL sale «incompleta»…»; `classify-catalog-import.test.ts` › «R32 — un subtipo con tipo TOOL sale «incompleta» con packagingSubtype en invalidFields», «R32 — un subtipo sin tipo tambien…», «R32 — empaque con subtipo, o un tipo sin subtipo, no invalida la fila»; `confirm-catalog-import.test.ts` › «R32 — una fila confirmada con subtipo bajo TOOL rechaza la confirmacion entera sin escribir», «R32 — un tipo ajeno en una fila de la confirmacion da ValidationError» |
| R33 | `confirm-catalog-import.test.ts` › «R33 — los fields que llegan a importLines llevan el tipo y el subtipo de cada fila» |
| R35 | `classify-catalog-import.test.ts` › «R35 — con el mismo costo y un tipo nuevo sale «cambia»», «R35 — con el mismo costo y solo un subtipo nuevo sale «cambia»», «R35 — un tipo null frente a uno guardado sale «sin cambios»…», «R35 — empaque sin subtipo frente a una tapa guardada sale «sin cambios»», «R35 — el mismo tipo y subtipo con el mismo costo sale «sin cambios»» |

### Verificación
`pnpm run typecheck`: `tsc --noEmit`, exit 0.
`pnpm run lint`: `✖ 10 problems (0 errors, 10 warnings)`, los mismos 10 de antes.
- Una primera pasada dio 12: dos `_args` nuevos en mocks de `confirm-catalog-import.test.ts`.
- Se corrigieron tipando el mock con `vi.fn<CatalogImportDeps['catalog']['importLines']>`.

`pnpm exec vitest run guard`:
```
 Test Files  87 passed (87)
      Tests  1276 passed | 22 skipped (1298)
```
`pnpm exec vitest related --run`, con los 5 de producción, los 4 tests de `documentos` y `catalog-import-review.test.tsx`. Una sola corrida, sin `Hook timed out`:
```
 Test Files  471 passed (471)
      Tests  8021 passed | 3 skipped (8024)
   Duration  943.22s
```
`catalog-import-authorization.test.ts` y `catalog-import-actions.test.ts`, solos:
```
 Test Files  2 passed (2)
      Tests  20 passed (20)
```

**Veredicto T7:** R29–R33 y R35 (lado `documentos`) en verde. Typecheck, lint, guardias y `vitest related` también en verde, sin dependencias nuevas.

## T8 — Doble de IA (2026-10-23)

### Archivos
- `lib/modules/documentos/adapters/driven/ai/ai-reader-canned.ts`:
  - dos constantes nuevas, `CANNED_CATALOG_NEW_TYPE` (`PACKAGING_MATERIAL`) y `CANNED_CATALOG_NEW_PACKAGING_SUBTYPE` (`CONTAINER`), tomadas de `CATALOG_LINE_TYPES` / `CATALOG_LINE_PACKAGING_SUBTYPES` del barrel de `proveedores`;
  - `CANNED_CATALOG_TEXT`: la fila «nueva» lleva esas dos constantes y la fila «cambia» lleva `type: null` y `packagingSubtype: null` explícitos.
- `tests/unit/documentos/ai-reader-canned.test.ts`: dos casos nuevos con `R38` en el nombre. Los seis casos que ya existían no cambian.

### Mapa R → test
| R | Test |
|---|---|
| R38 | `ai-reader-canned.test.ts` › «R38 — el catalogo de guion trae una linea PACKAGING_MATERIAL + CONTAINER y otra sin tipo ni subtipo» (pasa por `extractCatalogFromText`, todas las líneas sobreviven), «R38 — el JSON crudo trae los codigos del enum, no etiquetas, y la linea sin tipo los trae explicitos en null». La mitad E2E de R38 (las dos specs siguen en verde) queda pendiente: la corre el leader. |

### Lectura de las dos E2E (solo leídas, sin correr y sin tocar)
- `e2e/catalogo-desde-pdf.spec.ts`: no afirma tipo, subtipo ni `needsTypeReview`. Las afirmaciones que podría tocar el texto nuevo:
  - fila 0 = «Nueva»: no hay línea viva con ese nombre, así que sigue igual;
  - fila 1 = «Cambia de costo»: la línea viva sembrada no tiene tipo (la columna queda en NULL), y la fila trae `null` + `null`. `resolveImportedClassification` deja lo guardado, así que la clasificación no cambia, el costo sigue distinto y la fila sigue siendo «cambia»;
  - resumen 1/1/0/1 y la base (costo, material, medidas, imagen, presentación): nada de eso depende del tipo.
  - La validación del subtipo (`FIELD_VALIDATORS`) acepta `PACKAGING_MATERIAL` + `CONTAINER`, así que la fila 0 no pasa a «incompleta». La marca de revisión de la fila 1 no bloquea `catalog-import-confirm` (design §6.5). La pantalla actual no manda los dos campos al confirmar (R32: valen `null`), así que la línea creada queda sin tipo. La spec no lo mira.
  - Riesgo esperado: ninguno.
- `e2e/documentos.spec.ts`: solo afirma el estado `done` de las filas y el recuento de tandas/archivos en la base. Dice explícitamente que no afirma el texto de la IA. El texto nuevo sigue siendo JSON válido que `extractCatalogFromText` acepta entero, así que el trabajo no falla. Riesgo esperado: ninguno.
- Otros consumidores del archivo:
  - `formula-desde-pdf.spec.ts` y `formula-extraction.test.ts` usan el texto de fórmula, que no cambia;
  - `guard-dobles-e2e`, `qc158-alcance` y `qc159-alcance` siguen en verde: están dentro de la corrida de guardias y de `related`.

### Verificación
`pnpm run typecheck`: `tsc --noEmit`, exit 0.
`pnpm run lint`: `✖ 10 problems (0 errors, 10 warnings)`, los mismos 10 de antes.
`pnpm exec vitest related --run lib/modules/documentos/adapters/driven/ai/ai-reader-canned.ts tests/unit/documentos/ai-reader-canned.test.ts`, con `.env` cargado:
```
 Test Files  463 passed (463)
      Tests  7892 passed | 6 skipped (7898)
   Duration  1129.77s
```
`pnpm exec vitest run guard`:
```
 Test Files  87 passed (87)
      Tests  1276 passed | 22 skipped (1298)
```

**Veredicto T8:** la parte de código y unit test de R38 está en verde, sin dependencias nuevas. Falta correr las dos E2E (las corre el leader).

### T8 — E2E (corridas por el implementer, una a la vez, 2026-10-23, sobre `c6b754c8`)

```
$ pnpm exec playwright test e2e/catalogo-desde-pdf.spec.ts      (exit 0)
  ✓  2 [chromium] › e2e\catalogo-desde-pdf.spec.ts:305:7 › catalogo-desde-pdf › sube un PDF de catalogo, revisa sus filas y confirma la importacion (R38) (33.3s)
  ✓  1 [webkit] › e2e\catalogo-desde-pdf.spec.ts:305:7 › catalogo-desde-pdf › sube un PDF de catalogo, revisa sus filas y confirma la importacion (R38) (35.1s)
  2 passed (58.0s)

$ pnpm exec playwright test e2e/documentos.spec.ts              (exit 0)
  ✓ [chromium] + [webkit] documentos.spec.ts:361 (R16), :456 (R17), :524 (R18)
  6 passed (38.7s)
```
Ninguna de las dos se tocó. R38 (mitad E2E) en verde.

## T9 — Aislamiento y alcance (R36, R40)

### Archivos
- Nuevo `tests/integration/inventario/qt296-company-scope.int.test.ts` (commit, dos empresas efimeras por caso; limpia con `borrarEmpresa`, la ajena primero porque su presentacion usa una unidad sembrada a cuenta de la propia).
- Nuevo `tests/unit/documentos/qt296-alcance.test.ts` (mismo enfoque que `qc158-alcance.test.ts`: los casos de diff contra `origin/dev`/`dev` solo miden en `feature/QT-296-tipo-y-subtipo-de-empaque-backend`, se saltan ruidosamente fuera y fallan si el diff no trae nada bajo `specs/QT-296-.../`).
- `tests/integration/aislamiento.json`: entrada `commit` para `inventario/qt296-company-scope.int.test.ts`, junto a las otras de qt296.
- Codigo de produccion: ninguno. Los tres tests de autorizacion no se tocaron.

### Mapa
| R | Test |
|---|---|
| R36 | `qt296-alcance.test.ts` > R36a «ningun archivo del diff contra dev vive bajo borradores-de-prompts/» (+ detector) |
| R36 | `qt296-alcance.test.ts` > R36b «ningun archivo de produccion fuera de strategy-prompt-env.ts (y de playwright.config.ts, que la pone) nombra CATALOG_PROMPT» (+ detector) |
| R36 | `qt296-alcance.test.ts` > R36c «el diff contra dev no trae package.json ni pnpm-lock.yaml» (+ detector) |
| R40 | `qt296-company-scope.int.test.ts` > «un empaque de otra empresa con el mismo nombre y otro subtipo no da action_not_allowed en el alta» (control: el homonimo propio si da `ActionNotAllowedError`) |
| R40 | `qt296-company-scope.int.test.ts` > «... no da subtype_mismatch en el Excel» (vista previa y confirmacion; control: el homonimo propio en el mismo archivo si da `subtype_mismatch`) |
| R40 | `qt296-company-scope.int.test.ts` > «el filtro por subtipo no devuelve productos de otra empresa» (control: desde la otra empresa se ve lo suyo) |
| R40 | `qt296-company-scope.int.test.ts` > «el id de una tapa de otra empresa en el reparto da packaging_not_found» (`resolveDistributionLines`, el resolutor que comparten alta, edicion, «Reparto y unidad» y disponible, con los catalogos reales; controles: el envase ajeno tampoco existe, el propio se resuelve) |
| R40 | `tests/unit/inventario/authorization.test.ts`, `tests/unit/proveedores/authorization.test.ts`, `tests/unit/documentos/catalog-import-authorization.test.ts`: en verde sin cambiar expectativas |

### Verificacion (con `.env` cargado)
`pnpm run typecheck`: `tsc --noEmit`, exit 0.
`pnpm run lint`: `✖ 10 problems (0 errors, 10 warnings)`, los mismos 10 de antes; `eslint` sobre los dos archivos nuevos: `No issues found`.
`pnpm exec vitest run <2 nuevos> <3 de autorizacion>`:
```
 Test Files  5 passed (5)
      Tests  51 passed (51)
```
(los 11 casos nuevos corren todos, ninguno saltado: 7 de R36 y 4 de R40)
`pnpm exec vitest run guard`:
```
 Test Files  87 passed (87)
      Tests  1276 passed | 22 skipped (1298)
```

**Veredicto T9:** R36 y R40 en verde, sin codigo de produccion ni dependencias nuevas; no aparecio ningun bug real.

## T10 — Cierre (2026-10-24)

### Commits de la rama (sobre `5db868e1`)
| Commit | Tasks |
|---|---|
| `98c067c7` feat: subtipo de empaque en la base y en el alta de producto | T0, T1, T2 |
| `0a1e3e44` feat: subtipo en lecturas y reparto, y tipo en la linea de catalogo | T3, T4, T6 |
| `3efec93d` feat: tipo y subtipo en la lectura del catalogo desde PDF | T7 |
| `7688557d` feat: columna Subtipo y Empaque como tipo en el Excel de inventario | T5 |
| `c6b754c8` test: tipo y subtipo en el doble de IA del catalogo | T8 |
| `363fe495` docs: salida de las E2E de T8 | T8 |
| `de1ef3f5` test: aislamiento por empresa y alcance del diff | T9 |

### Mapa R1..R42 -> test (resumen; el detalle por caso está en el «Mapa R → test» de cada task)
| R | Test(s) | Task |
|---|---|---|
| R1 | `unit/inventario/packaging-subtype.test.ts`, `integration/inventario/qt296-packaging-subtype-constraints.int.test.ts` | T1 |
| R2, R3 | `integration/inventario/qt296-packaging-subtype-constraints.int.test.ts` | T1 |
| R4 | `integration/inventario/qt296-packaging-subtype-migration.int.test.ts` | T1 |
| R5–R8, R10 | `unit/inventario/product-input.test.ts` (+ `product-actions.test.ts` R5/R7, `qt296-packaging-subtype-product.int.test.ts` R5/R7) | T2 |
| R9 | `unit/inventario/create-product.test.ts`, `qt296-packaging-subtype-product.int.test.ts` | T2 |
| R11, R12 | `integration/inventario/list-query-products.int.test.ts`, `unit/inventario/product-prisma.test.ts`, `unit/shared/listas-blancas-listados.test.ts` (R12) | T3 |
| R13, R14 | `integration/inventario/qt296-only-containers.int.test.ts`, `integration/pedidos/qt296-distribution-rejects-caps.int.test.ts` (R14) | T4 |
| R39 | `integration/pedidos/qt296-distribution-rejects-caps.int.test.ts` | T4 |
| R15–R20 | `unit/inventario/plan-inventory-import.test.ts` | T5 |
| R21 | `unit/inventario/inventory-import-downloads.test.ts`, `unit/inventario/import-sheet-limits.test.ts` | T5 |
| R22 | `integration/inventario/inventory-import-confirm.int.test.ts` | T5 |
| R41 | `unit/inventario/import-cell-parsing.test.ts`, `plan-inventory-import.test.ts`, `inventory-import-confirm.int.test.ts` | T5 |
| R42 | `unit/inventario/inventory-import-downloads.test.ts` | T5 |
| R23, R24 | `integration/proveedores/qt296-catalog-line-type.int.test.ts` | T1 |
| R25 | `integration/proveedores/qt296-catalog-line-type.int.test.ts`, `unit/inventario/schema/qt296-packaging-subtype-migration.test.ts` | T1 |
| R26, R27 | `unit/proveedores/catalog-line-input.test.ts`, `integration/proveedores/catalog-line.int.test.ts` | T6 |
| R28 | `integration/proveedores/catalog-line.int.test.ts` (listado), `catalog-import-upsert.int.test.ts` (lectura por identidad) | T6 |
| R29, R30 | `unit/documentos/catalog-extraction.test.ts` | T7 |
| R31, R32 | `unit/documentos/preview-catalog-import.test.ts`, `classify-catalog-import.test.ts`, `confirm-catalog-import.test.ts` | T7 |
| R33 | `integration/proveedores/catalog-import-upsert.int.test.ts`, `unit/documentos/confirm-catalog-import.test.ts` | T6, T7 |
| R34 | `unit/proveedores/imported-classification.test.ts`, `catalog-import-upsert.int.test.ts` | T6 |
| R35 | `catalog-import-upsert.int.test.ts`, `unit/documentos/classify-catalog-import.test.ts` | T6, T7 |
| R36 | `unit/documentos/qt296-alcance.test.ts` | T9 |
| R37 | **TP (humana): PENDIENTE hasta que QC-131 esté `done`** (decisión cerrada por el humano). Sin test automático: la verifica la sección firmada de `docs/revision-de-prompts.md`. | TP |
| R38 | `unit/documentos/ai-reader-canned.test.ts`; E2E `catalogo-desde-pdf.spec.ts` (2 passed) y `documentos.spec.ts` (6 passed) | T8 |
| R40 | `integration/inventario/qt296-company-scope.int.test.ts` + los tres tests de autorización sin cambios | T9 |

Sin huecos salvo R37, que espera a TP.

### TP — pendiente
TP **no se hizo** y queda sin marcar en `tasks.md`. Es humana, está bloqueada hasta que QC-131 esté
`done` y no bloquea ninguna otra task.

### Divergencias con el spec (para que `spec_author` enmiende `design.md`)
1. **§2.2, CHECK de R24.** `"packaging_subtype" IS NULL OR "type" = 'PACKAGING_MATERIAL'` deja pasar
   un subtipo sin tipo (el CHECK se evalúa a `NULL`). La migración usa
   `"type" IS NOT DISTINCT FROM 'PACKAGING_MATERIAL'`. Lo detectó el test de R24.
2. **§2.3, `<ts>` de la migración = `20261023150000`.** `origin/dev` ya tiene `20261023120000_*` y
   `20261023130000_*`.
3. **Orden T1 → T2.** T1 sola no cierra en verde: el CHECK de R2 rompe toda alta de empaque hasta T2
   (126 fallos en 18 suites). Se commitearon juntas, y 4 tests que siembran empaques a mano ganaron
   solo `packagingSubtype`.
4. **Campos opcionales en lugar de obligatorios.** `PackagingIdentity.packagingSubtype` (§4.1) y
   `ProductView.packagingSubtype` (§4.3). Con campos obligatorios habría que tocar 5 helpers de siembra y
   unos 30 fixtures de UI. Los adaptadores de lectura siempre lo rellenan.
5. **`create-product.test.ts`.** Dos expectativas de QC-195 («R1, R6», «R11») ganan
   `packagingSubtype: CONTAINER`, porque la identidad nueva lo exige.
6. **R13/R14.** Con datos válidos, los tests no distinguen el filtro `CONTAINER` nuevo de la guarda
   anterior (`presentationId != null` + CHECK de R3). El filtro es la defensa que pide el diseño.
7. **§5, forma del puerto de edición.** La clasificación va como campo de `data`
   (`CatalogLineReplacement`) y no como parámetro `classification?` aparte. El alta y la importación usan
   `CatalogLineFields`, con los dos campos obligatorios y anulables.
8. **§5, R28 «detalle».** `proveedores` no tiene lectura de una línea por id. R28 se prueba sobre el
   listado y sobre la lectura por identidad.
9. **§6.3, el clasificador conserva `createCatalogLineSchema.shape`.** No pasa a
   `catalogLineFieldsShape`: con zod 4, `.shape` sobrevive a `superRefine`.
10. **§6.4, campos de la fila revisada opcionales.** `ReviewedLineInput.type` y `.packagingSubtype` son
    opcionales en el tipo inferido, y el `?? null` se aplica en `fromReviewedLine` y en la confirmación.
    Un `.transform` en el borde volvería obligatorio el campo y rompería `catalog-import-review.tsx` (QT-297).
11. **§6.3, subtipo sin tipo.** La fila revisada sale «incompleta» por `packagingSubtype`, aplicando
    la regla tal cual.
12. **§4.5, subtipo ilegible en un empaque.** Da `subtype_invalid` con `packagingSubtype = null`.
    `presentation` queda sin regla y el resto se valida como envase.
13. **Excepción de UI aprobada por el humano (2026-10-23).** En `import-texts.ts`
    (`GUIDE_COLUMN_DESCRIPTION_TEXTS`) se añadió la entrada `subtype` y el texto de `type` pasó a decir «Empaque»,
    con el texto exacto del humano. Sin ese cambio no compila, porque `ImportColumnKey` gana `subtype`. QT-297
    pulirá el texto.
14. **Exports nuevos en `inventario/index.ts`**, para QT-297. El leader los dio por buenos.

Notas para QT-297, decididas por el leader (no se tocan aquí):
- el mensaje de `type_invalid` sigue diciendo «Envase»;
- la hoja «Valores disponibles» no lista subtipos.

### Verificación final
- `./init.sh` (rápido): rojo en el validador de features, antes de los tests. Las causas son del
  board: ids QC/QT duplicados, features en vuelo sin assignee y el cupo de backend. El leader lo
  conoce y lo acepta. Por eso las comprobaciones se corren a mano, abajo.
- Limpieza de comentarios: ninguna línea de producción añadida (`lib/`, `app/`, `db/schema.prisma`,
  la migración) cita fichas, requisitos, TODO ni FIXME.

### Verificación final del leader (2026-10-24)
- `pnpm run typecheck`: exit 0.
- `pnpm run lint`: 0 errores, 10 avisos (los mismos 10 de antes).
- `pnpm exec vitest run guard`: 87/87 archivos, 1276 pasados, 22 omitidos.
- `vitest related` sobre todo el diff contra `origin/dev`: **no se completó**. Dos ejecuciones paralelas se colgaron durante horas y el leader las mató, y el reintento lo detuvo el sistema por falta de memoria. Con el visto bueno del humano, la suite completa queda para `gate-completo` en CI. Cada tanda ya pasó su `vitest related` (secciones T3/T4, T5, T6, T7 y T8).
- TP sigue pendiente: espera a que QC-131 esté `done` (R37).

## T11 — El envase legado no cuenta como homónimo (review B1, 2026-10-24)

Decisión del humano (R43, `design.md > 4.1` y `> 4.5`). La **divergencia 3 de T2 queda revertida**:
un `CONTAINER` con `presentation_id NULL` vuelve a no contar como homónimo, como antes de esta
ficha. Tapa, medidor y otro sí cuentan aunque no tengan presentación.

`backend_dev` escribió el código y los tests, pero se cayó por un corte de stream antes de
informar. El implementer revisó el diff y corrió la verificación (abajo).

### Archivos
- `lib/modules/inventario/domain/packaging-subtype.ts`: predicado puro `countsAsPackagingHomonym(ref)`.
- `lib/modules/inventario/index.ts`: lo exporta el barrel.
- `lib/modules/inventario/adapters/driven/persistence/product-prisma.ts` (`findAlivePackagingByName`):
  `NOT: { packagingSubtype: CONTAINER, presentationId: null }`, con el mismo desempate de antes.
- `lib/modules/inventario/domain/plan-inventory-import.ts` (`resolveIdentity`, rama `PACKAGING`): el `find` usa el predicado.
- Tests: `tests/unit/inventario/packaging-subtype.test.ts`, `create-product.test.ts` y
  `plan-inventory-import.test.ts`; `tests/integration/inventario/qt296-packaging-subtype-product.int.test.ts`
  e `inventory-import-confirm.int.test.ts` (ampliados).

### Mapa R → test
| R | Tests |
|---|---|
| R43 | `packaging-subtype.test.ts` › «R43: el envase sin presentacion (legado) no cuenta como homonimo; con presentacion si», «R43: tapa, medidor y otro cuentan como homonimo aunque no tengan presentacion»; `inventory-import-confirm.int.test.ts` › «R43 con el «Galón» legado (el mas antiguo) y el de 4 L sembrados, confirmar una fila «Galón» 4 L suma el lote al de 4 L» |
| R43, R9 | `create-product.test.ts` › «R43, R9 — con solo un «Galón» legado, que el adaptador ya no devuelve, …crea el producto», «R43, R9 — una tapa «Galón» homonima sin presentacion sigue contando…»; `qt296-packaging-subtype-product.int.test.ts` › «R43, R9 — con solo un «Galón» legado, … crea un producto nuevo y no toca el legado», «R43, R9 — con el legado (el mas antiguo) y el «Galón» 4 L coexistiendo, … suma el lote al de 4 L», «R43, R9 — con una tapa «Galón» viva, … action_not_allowed…» |
| R43, R20 | `plan-inventory-import.test.ts` › «R43, R20 con solo el «Galón» legado, … sale create», «R43, R20 con el legado … y el de 4 L coexistiendo, la fila sale add_batch con target el de 4 L», «R43, R20 con una tapa «Galón» viva, … subtype_mismatch» |

### Verificación (implementer; un proceso cada vez, `--maxWorkers=2`, `.env` con `QuimiCloude_QT296`)
- `pnpm run typecheck`: exit 0. `eslint` sobre los 9 archivos tocados: sin salida (0 errores, 0 avisos).
- Unit `packaging-subtype`, `create-product` y `plan-inventory-import`: 3 archivos, **159/159**.
- Int `qt296-packaging-subtype-product` e `inventory-import-confirm`: 2 archivos, **15 pasados y 1 omitido** (el `skipIf(QC209_MEDIR_2000)` de siempre).
- Int `qc195-packaging-list` y `qc195-packaging-catalog` (siembran legados): **9/9**. `qc195-packaging-product`: **8/8**.
- `pnpm exec vitest run guard`: 87/87 archivos, 1276 pasados, 22 omitidos.

## F2.3 — Merge de `origin/dev` (2026-10-24)

- Conflicto único (review m1): `tests/guards/guard-identificador-de-request.test.ts`, `MIGRACIONES_ESPERADAS`.
  Se conservan las tres entradas en orden cronológico: `20261023120000_whatsapp_send_permission`,
  `20261023130000_whatsapp_outbound_messages` y `20261023150000_packaging_subtype`. `db/schema.prisma` y
  `tests/integration/aislamiento.json` se mezclaron solos. Nada ambiguo.
- Migraciones nuevas aplicadas a `QuimiCloude_QT296` con `prisma migrate deploy` (las dos de WhatsApp) y `prisma generate`.
- m2 queda como deuda aceptada (`design.md > 4.3`).

### Verificación tras el merge (un proceso cada vez, `--maxWorkers=2`)
- `pnpm run typecheck`: exit 0. `eslint` del guard resuelto: sin salida.
- `pnpm exec vitest run guard`: 87/87 archivos, 1303 pasados, 22 omitidos.
- Unit `packaging-subtype`, `qt296-packaging-subtype-migration` y `whatsapp-send-permission-migration`: 3 archivos, **22/22**.
- Int `qt296-packaging-subtype-migration` (UP/DOWN/UP), `whatsapp-send-permission-migration` y `whatsapp-outbound-messages-migration`: 3 archivos, **15/15**.
- El `vitest related` del diff completo queda para `gate-completo` en CI.
