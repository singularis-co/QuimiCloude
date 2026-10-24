# QT-296 — tipo-y-subtipo-de-empaque-backend · tasks.md

> Escrito por `spec_author` en F1.2 (2026-10-23) y actualizado el mismo día con las respuestas del
> humano (`requirements.md > Decisiones cerradas`). Ninguna task empieza antes de que se apruebe el
> spec.
>
> Un solo carril: `backend_dev`. La UI es de QT-297. **TP** es humana, está **bloqueada hasta que
> QC-131 esté `done`** y no bloquea a ninguna otra: T0–T10 siguen ya.
>
> Cada task cierra con typecheck, lint, `vitest related` de lo tocado, `pnpm exec vitest run guard`
> y un commit (`feat(QT-296): …` / `test(QT-296): …`). Los tests llevan `R<n>` en el nombre del
> caso. El código de producción no cita fichas ni requisitos (`docs/conventions.md > Comentarios`).
> `[P]` marca lo que puede ir en paralelo.

## [x] T0 — Recontraste `[backend_dev]`

- Confirmar que las referencias `archivo:línea` de `design.md` siguen valiendo en la punta de
  `dev`. Las que se hayan movido se anotan en `progress/impl_QT-296.md`.
- Confirmar que la última migración sigue siendo `20261022120000_*` y fijar el `<ts>` de §2.3.
- Correr sobre la punta los tests de `design.md > 11` y anotar cuáles están rojos de partida.

**Hecho cuando:** `progress/impl_QT-296.md` tiene el recontraste y los rojos de partida, si los
hay.

## [x] T1 — Migración, esquema y espejos del enum `[depende de T0]`

- `db/migrations/<ts>_packaging_subtype/migration.sql` y `down.sql` (`design.md > 2.3`).
- `db/schema.prisma`: los enums `PackagingSubtype` y `CatalogLineType`, `Product.packagingSubtype`
  y `SupplierCatalogLine.type` / `.packagingSubtype`.
- `lib/modules/inventario/domain/packaging-subtype.ts` y
  `lib/modules/proveedores/domain/catalog-line-type.ts`, exportados por sus barrels
  (`design.md > 3`).
- Tests:
  - `tests/unit/inventario/packaging-subtype.test.ts`: los dos espejos son iguales y coinciden con
    los dos enums de `schema.prisma` (R1).
  - `tests/unit/inventario/schema/qt296-packaging-subtype-migration.test.ts`: sobre el texto, la
    migración no contiene `DELETE`, `material` ni `measurements`; `down.sql` quita exactamente lo
    que crea `migration.sql` (R25).
  - `tests/integration/inventario/qt296-packaging-subtype-migration.int.test.ts`: con empaques
    sembrados (vivo con presentación, de baja, envase antiguo sin presentación) y una materia
    prima antes de la migración, tras aplicarla los empaques quedan en `CONTAINER`, con la misma
    presentación, los mismos lotes y la misma existencia, y la materia prima queda en `NULL` (R4).
  - `tests/integration/inventario/qt296-packaging-subtype-constraints.int.test.ts`: un valor
    fuera del enum se rechaza (R1); `PACKAGING` sin subtipo y `PRODUCT` con subtipo se rechazan
    (R2); `CAP` con presentación se rechaza y `CONTAINER` con ella entra (R3).
  - `tests/integration/proveedores/qt296-catalog-line-type.int.test.ts`: `FINISHED_PRODUCT` y
    valores ajenos no caben en `type` (R23); un subtipo con `RAW_MATERIAL` o sin tipo se rechaza, y
    `PACKAGING_MATERIAL` sin subtipo entra (R24); una línea sembrada antes de la migración queda
    sin tipo ni subtipo y con el resto de columnas igual (R25).

**Hecho cuando:** `pnpm run db:migrate` aplica y `pnpm run db:rollback` revierte y deja
`_prisma_migrations` coherente sobre la base del worktree; R1–R4 y R23–R25 en verde;
`guard-arquitectura-modulos`, `guard-tipos-de-producto` y `guard-empresa-en-esquema` en verde.

## [x] T2 — Alta de empaque con subtipo `[depende de T1]` `[P con T3, T4, T5, T6]`

- `product-input.ts`, `create-product.ts`, `product-view.ts` (`PackagingIdentity`),
  `ports/product-repository.ts`, `product-prisma.ts` (`findAlivePackagingByName`,
  `createWithFirstBatch`) y `product-actions.ts` (leer `packagingSubtype` del `FormData`)
  (`design.md > 4.1, 4.2`).
- Tests:
  - `tests/unit/inventario/product-input.test.ts`: sin subtipo es `CONTAINER` (R5); envase sin
    presentación da `invalid_input` (R6); `CAP`, `MEASURER` y `OTHER` con presentación dan
    `invalid_input`, y existencia no entera también (R7); `PRODUCT` o `MACHINE` con subtipo dan
    `invalid_input` (R8); la edición con `packagingSubtype` da `invalid_input` (R10).
  - `tests/unit/inventario/create-product.test.ts`: un homónimo con otro subtipo da
    `action_not_allowed` sin escribir; uno con el mismo subtipo suma un lote; una tapa homónima
    de una tapa suma un lote sin presentación (R9).
  - `tests/unit/inventario/product-actions.test.ts`: la acción pasa `packagingSubtype` del
    `FormData` al caso de uso (R5, R7).
  - `tests/integration/inventario/qt296-packaging-subtype-product.int.test.ts`: el alta de una
    tapa queda con `packaging_subtype = 'CAP'`, sin presentación, con la unidad de sistema de
    envases y un lote sin presentación (R7); el alta sin subtipo queda `CONTAINER` (R5); un
    homónimo con otro subtipo no escribe ninguna fila (R9).

**Hecho cuando:** R5–R10 en verde, y los casos de `PACKAGING` de `product-input.test.ts` y de
`qc195-packaging-product.int.test.ts` siguen en verde sin cambiar sus expectativas.

## [x] T3 — Subtipo en lecturas y filtro del listado `[depende de T1]` `[P con T2, T4, T5, T6]`

- `ProductView.packagingSubtype`, `PRODUCT_SELECT` y sus proyecciones, `PRODUCT_QUERYABLE`, y
  `buildProductWhere` (`design.md > 4.3`).
- Tests:
  - `tests/integration/inventario/list-query-products.int.test.ts` (ampliado): `getProduct` y el
    listado devuelven el subtipo, y `null` en los que no son empaque (R11); con
    `packagingSubtype = {CAP}` salen solo las tapas vivas de la empresa, y un valor desconocido se
    descarta como hoy con `type` (R12).
  - `tests/unit/shared/listas-blancas-listados.test.ts` (ampliado).

**Hecho cuando:** R11 y R12 en verde; listas blancas en verde.

## [x] T4 — Solo envases en el reparto `[depende de T1]` `[P con T2, T3, T5, T6]`

- `packaging-catalog-prisma.ts`: `packagingSubtype: CONTAINER` en `findAlivePackaging` y en la
  consulta de lotes de costeo (`design.md > 4.4`). `pedidos` no se toca.
- Tests:
  - `tests/integration/inventario/qt296-only-containers.int.test.ts`: con un envase de 1 l, una
    tapa y un medidor sembrados, la consulta del selector (`type = PACKAGING`,
    `presentationUnitId = {l}`) devuelve solo el envase (R13); `PackagingCatalog.findRefs` con los
    tres ids devuelve solo el envase, y `findCostingBatches` no trae lotes de la tapa (R14).
  - `tests/integration/pedidos/qt296-distribution-rejects-caps.int.test.ts`: una línea de reparto
    con el id de la tapa da `packaging_not_found` en el alta y en «Reparto y unidad», sin escribir
    nada (R14). Terminar el empaque de un pedido con un envase en el reparto deja intacta la
    existencia de una tapa y de un medidor de la empresa (R39).

**Hecho cuando:** R13, R14 y R39 en verde, y `qc195-packaging-catalog.int.test.ts` y
`qc195-packaging-list.int.test.ts` siguen en verde.

## [x] T5 — Columna «Subtipo» en el Excel `[depende de T1, T2]` `[P con T3, T4, T6]`

- `inventory-import-contract.ts`, `plan-inventory-import.ts` (`columnRule`, lectura del subtipo,
  identidad, mensajes), `inventory-import-downloads.ts` (`subtype: ''` en los ejemplos),
  `ports/inventory-import-repository.ts`, `inventory-import-prisma.ts` y
  `confirm-inventory-import.ts` (`design.md > 4.5`).
- Tests:
  - `tests/unit/inventario/plan-inventory-import.test.ts`:
    - un archivo sin la columna «Subtipo» planifica igual que hoy, con los empaques como
      `CONTAINER` (R15);
    - «Subtipo» vacío en un empaque da `CONTAINER` (R16);
    - «tapa», «MEDIDOR» y « Otro » se leen bien, y «gatillo» da `subtype_invalid` en `subtype`
      (R17);
    - una tapa con «Presentación» la anota en `ignoredColumns` y sigue, y un envase sin
      presentación da `value_required` (R18);
    - un insumo con «Subtipo» lo anota en `ignoredColumns` (R19);
    - un empaque existente o una fila anterior con otro subtipo dan `subtype_mismatch`, y con el
      mismo subtipo `add_batch` (R20).
  - `tests/unit/inventario/inventory-import-downloads.test.ts`: la plantilla trae la cabecera
    «Subtipo» (R21); su fila de ejemplo de empaque y su hoja de valores admitidos dicen «Empaque»,
    y no «Envase» (R42).
  - `tests/unit/inventario/import-sheet-limits.test.ts` (o el test de `parseImportSheet` que ya
    cubre `exampleRowIgnored`) (R21):
    - las filas de ejemplo de la plantilla nueva se ignoran;
    - las de una plantilla antigua (sin «Subtipo» y con «Envase») también;
    - una fila igual al ejemplo antiguo pero con «ENVASE» se sigue importando, como hoy.
  - `tests/unit/inventario/import-cell-parsing.test.ts` (R41):
    - «Empaque», «empaque», « EMPAQUE », «Envase» y «envase» dan `PACKAGING`;
    - «Empaques» sigue dando `type_invalid`, como cualquier texto desconocido.
  - `tests/unit/inventario/plan-inventory-import.test.ts` (R41): un archivo de antes de esta
    ficha, con «Envase» y sin «Subtipo», da la misma vista previa que hoy, fila por fila (mismo
    `status`, `target` y motivos), con `packagingSubtype = CONTAINER`.
  - `tests/integration/inventario/inventory-import-confirm.int.test.ts` (ampliado):
    - confirmar un archivo con un envase, una tapa y un medidor crea los tres con su subtipo, y la
      tapa sin presentación (R22);
    - una fila con «Envase» y otra con «Empaque» del mismo nombre y presentación crean un solo
      envase con dos lotes (R41).
  - Se ajustan las expectativas de `import-header.test.ts`, `inventory-import-contract.test-d.ts`,
    `inventory-import-kit.ts` e `importar/import-preview-fixtures.ts` a la columna nueva y a la
    etiqueta «Empaque». Si un test de UI (`import-guide.test.tsx`) se pone rojo porque cuenta
    columnas o fija el texto «Envase», se ajusta solo su expectativa. Si hace falta tocar un
    componente, se para y se avisa al leader: es de QT-297.
- Además de lo anterior: `IMPORT_TYPE_LABELS.PACKAGING = 'Empaque'` e `IMPORT_TYPE_ALIASES` en
  `inventory-import-contract.ts`; `TYPE_BY_LABEL` con alias en `import-cell-parsing.ts`;
  `LEGACY_IMPORT_EXAMPLE_ROWS` en `inventory-import-downloads.ts` y `CANONICAL_EXAMPLES` con las
  dos listas en `import-sheet.ts` (`design.md > 4.6`).

**Hecho cuando:** R15–R22, R41 y R42 en verde y la suite de importación de inventario sigue en
verde.

## [x] T6 — Tipo y subtipo en la línea de catálogo `[depende de T1]` `[P con T2, T3, T4, T5]`

- `catalog-line-input.ts` (forma base exportada, alta, edición «los dos o ninguno»),
  `catalog-line-view.ts`, `create-catalog-line.ts`, `update-catalog-line.ts`,
  `import-catalog-lines.ts`, `imported-classification.ts` (nuevo), `find-catalog-lines-by-identity.ts`,
  los puertos que cambian de forma, `supplier-catalog-line-prisma.ts`,
  `supplier-catalog-import-prisma.ts` (SQL de `design.md > 5.3`), `supplier-catalog-actions.ts` y
  el barrel (`design.md > 5`).
- Tests:
  - `tests/unit/proveedores/catalog-line-input.test.ts`:
    - en el alta, sin tipo ni subtipo queda `null`;
    - `PACKAGING_MATERIAL` + `CAP` vale;
    - un subtipo con `TOOL` o sin tipo, o un valor ajeno, da `invalid_input` (R26);
    - en la edición, sin ninguno de los dos se conserva, con los dos se reemplaza, `null` quita y
      uno solo da `invalid_input` (R27).
  - `tests/unit/proveedores/imported-classification.test.ts`: la tabla de verdad de
    `resolveImportedClassification` (R34).
  - `tests/integration/proveedores/catalog-line.int.test.ts` (ampliado): el alta guarda tipo y
    subtipo (R26); una edición sin los campos conserva el tipo guardado y una con `null` + `null`
    lo quita (R27); el detalle y el listado los devuelven (R28).
  - `tests/integration/proveedores/catalog-import-upsert.int.test.ts` (ampliado):
    - una línea nueva se guarda con tipo y subtipo (R33);
    - sobre una línea viva `CAP`, un `null` no la borra, `CONTAINER` la reemplaza y `TOOL` deja el
      subtipo en `NULL` (R34);
    - con el mismo costo y solo un tipo nuevo, cuenta `updated`; sin cambios, `unchanged` (R35).

**Hecho cuando:** R26–R28 y R33–R35 (lado `proveedores`) en verde, `proveedores/scope.test.ts`
en verde (sin importar `inventario`) y `catalog-service.test.ts` en verde.

## [x] T7 — Lectura del PDF: interpretación, clasificación, vista previa y confirmación `[depende de T6]`

- `catalog-extraction.ts`, `catalog-import-input.ts`, `classify-catalog-import.ts`,
  `preview-catalog-import.ts` y `confirm-catalog-import.ts` (`design.md > 6.2–6.5`).
- Tests:
  - `tests/unit/documentos/catalog-extraction.test.ts`:
    - lee `type` y `packagingSubtype`;
    - un valor ausente, `null`, un número o «tapa» en minúscula quedan `null` y la línea sigue
      (R29);
    - `RAW_MATERIAL` + `CAP` deja el subtipo en `null`, y `null` + `CAP` también, sin deducir el
      tipo (R30).
  - `tests/unit/documentos/preview-catalog-import.test.ts`: `needsTypeReview` es verdadero sin
    tipo y con empaque sin subtipo, y falso con `RAW_MATERIAL` y con `PACKAGING_MATERIAL` +
    `CONTAINER`; la marca no cambia `kind` (R31); las filas revisadas sin los campos se aceptan, y
    un valor ajeno da `ValidationError` (R32).
  - `tests/unit/documentos/classify-catalog-import.test.ts`:
    - una fila revisada con subtipo y tipo `TOOL` sale «incompleta» con `packagingSubtype` en
      `invalidFields` (R32);
    - con el mismo costo y un tipo nuevo sale «cambia»;
    - con un tipo `null` frente a uno guardado sale «sin cambios» (R35).
  - `tests/unit/documentos/confirm-catalog-import.test.ts`: los `fields` que llegan a
    `importLines` llevan el tipo y el subtipo de cada fila (R33); una confirmación con una fila
    marcada para revisar no se rechaza por eso (R31).

**Hecho cuando:** R29–R33 y R35 (lado `documentos`) en verde, y
`catalog-import-authorization.test.ts` y `catalog-import-actions.test.ts` siguen en verde.

## [ ] T8 — Doble de IA y E2E existentes `[depende de T7]`

- `ai-reader-canned.ts`: tipo y subtipo en `CANNED_CATALOG_TEXT`, y las dos constantes nuevas
  (`design.md > 6.6`).
- Tests:
  - `tests/unit/documentos/ai-reader-canned.test.ts`: el texto de guion se parsea entero y trae
    una línea `PACKAGING_MATERIAL` + `CONTAINER` y otra sin tipo (R38).
  - Volver a correr `e2e/catalogo-desde-pdf.spec.ts` y `e2e/documentos.spec.ts`, una E2E a la vez
    en la máquina. Las dos siguen en verde sin tocarlas (R38).

**Hecho cuando:** R38 en verde y el resultado de las dos E2E anotado en `progress/impl_QT-296.md`.

## [ ] T9 — Aislamiento y alcance `[depende de T2–T8]`

- Tests:
  - `tests/integration/inventario/qt296-company-scope.int.test.ts`:
    - un empaque de otra empresa con el mismo nombre y otro subtipo no da `action_not_allowed` en
      el alta ni `subtype_mismatch` en el Excel;
    - el filtro por subtipo no devuelve productos de otra empresa;
    - el id de una tapa de otra empresa en el reparto da `packaging_not_found` (R40).
  - `tests/unit/documentos/qt296-alcance.test.ts`:
    - ningún archivo del diff está bajo `borradores-de-prompts/`;
    - nadie fuera de `strategy-prompt-env.ts` lee `CATALOG_PROMPT`;
    - en el diff no hay `package.json` ni `pnpm-lock.yaml` (R36). Mismo enfoque que
      `qc158-alcance.test.ts`.
  - Los tests de autorización existentes (`tests/unit/inventario/authorization.test.ts`,
    `tests/unit/proveedores/authorization.test.ts`,
    `tests/unit/documentos/catalog-import-authorization.test.ts`) siguen en verde sin cambiar
    sus expectativas (R40).

**Hecho cuando:** R36 y R40 en verde.

## [ ] TP — Prompt de catálogo y tabla de veredictos `[HUMANO]` `[BLOQUEADA: depende de QC-131 done]` `[no bloquea a ninguna]`

Todo lo hace una persona; ningún agente escribe en Vercel ni firma (QC-131 R9). No empieza hasta
que QC-131 esté `done`, y se hace sobre el texto que QC-131 dejó firmado en Vercel (decisión del
2026-10-23).

1. Partir del texto firmado de QC-131 y ajustar el borrador fuera de git
   (`borradores-de-prompts/catalogo.md`) al contrato de `design.md > 6.1`. El borrador:
   - pide `type` y `packagingSubtype` con esos códigos;
   - dice que gatillo, válvula y atomizador son `CAP`, y que etiqueta y caja son `OTHER`;
   - ordena devolver `null` si no se sabe.
2. Poner el texto en `CATALOG_PROMPT`, en Production y en Preview, con el mismo texto, y
   redesplegar.
3. Añadir a la tabla de veredictos de `catalogo` de `docs/revision-de-prompts.md` las filas «tipo»
   y «subtipo de empaque». QC-131 R14 le prohíbe a QC-131 tocar esa plantilla, y como TP va
   después de QC-131, no hay choque.
4. Nota fechada al pie de `specs/QC-129-textos-definitivos-de-los-prompts/requirements.md`: R10
   pasa de ocho datos más `page` a diez más `page`, por QT-296.
5. Pasada firmada en una sección nueva de `docs/revision-de-prompts.md`, con veredicto de tipo y
   subtipo.

**Hecho cuando:** la última sección firmada de `catalogo` tiene «tipo» y «subtipo de empaque» sin
ningún **mal** (R37). El arnés solo puede comprobar que las filas y la sección existen; el
veredicto es del humano.

## [ ] T10 — Cierre `[depende de T1–T9]`

- `progress/impl_QT-296.md` con el mapa `R1..R42 -> test` sin huecos. R37 queda mapeado a TP y,
  si TP no ha cerrado, se declara pendiente porque espera a que QC-131 esté `done`.
- Limpieza de comentarios en las líneas tocadas.
- `./init.sh` en verde.

**Hecho cuando:** trazabilidad completa y gate local en verde.

## Mapa R -> task

| R | Task | R | Task | R | Task | R | Task |
|---|---|---|---|---|---|---|---|
| R1 | T1 | R11 | T3 | R21 | T5 | R31 | T7 |
| R2 | T1 | R12 | T3 | R22 | T5 | R32 | T7 |
| R3 | T1 | R13 | T4 | R23 | T1 | R33 | T6, T7 |
| R4 | T1 | R14 | T4 | R24 | T1 | R34 | T6 |
| R5 | T2 | R15 | T5 | R25 | T1 | R35 | T6, T7 |
| R6 | T2 | R16 | T5 | R26 | T6 | R36 | T9 |
| R7 | T2 | R17 | T5 | R27 | T6 | R37 | TP |
| R8 | T2 | R18 | T5 | R28 | T6 | R38 | T8 |
| R9 | T2 | R19 | T5 | R29 | T7 | R39 | T4 |
| R10 | T2 | R20 | T5 | R30 | T7 | R40 | T9 |
| | | | | | | R41 | T5 |
| | | | | | | R42 | T5 |

## Archivos esperados

Producción:
- `db/schema.prisma`
- `db/migrations/<ts>_packaging_subtype/migration.sql`
- `db/migrations/<ts>_packaging_subtype/down.sql`
- `lib/modules/inventario/index.ts`
- `lib/modules/inventario/domain/packaging-subtype.ts`
- `lib/modules/inventario/domain/product-input.ts`
- `lib/modules/inventario/domain/create-product.ts`
- `lib/modules/inventario/domain/product-view.ts`
- `lib/modules/inventario/domain/product-queryable.ts`
- `lib/modules/inventario/domain/inventory-import-contract.ts`
- `lib/modules/inventario/domain/plan-inventory-import.ts`
- `lib/modules/inventario/domain/inventory-import-downloads.ts`
- `lib/modules/inventario/domain/import-cell-parsing.ts`
- `lib/modules/inventario/domain/import-sheet.ts`
- `lib/modules/inventario/domain/confirm-inventory-import.ts`
- `lib/modules/inventario/ports/product-repository.ts`
- `lib/modules/inventario/ports/inventory-import-repository.ts`
- `lib/modules/inventario/adapters/driven/persistence/product-prisma.ts`
- `lib/modules/inventario/adapters/driven/persistence/packaging-catalog-prisma.ts`
- `lib/modules/inventario/adapters/driven/persistence/inventory-import-prisma.ts`
- `lib/modules/inventario/adapters/driving/product-actions.ts`
- `lib/modules/proveedores/index.ts`
- `lib/modules/proveedores/domain/catalog-line-type.ts`
- `lib/modules/proveedores/domain/imported-classification.ts`
- `lib/modules/proveedores/domain/catalog-line-input.ts`
- `lib/modules/proveedores/domain/catalog-line-view.ts`
- `lib/modules/proveedores/domain/create-catalog-line.ts`
- `lib/modules/proveedores/domain/update-catalog-line.ts`
- `lib/modules/proveedores/domain/import-catalog-lines.ts`
- `lib/modules/proveedores/domain/find-catalog-lines-by-identity.ts`
- `lib/modules/proveedores/ports/supplier-catalog-import-repository.ts`
- `lib/modules/proveedores/ports/supplier-catalog-repository.ts`
- `lib/modules/proveedores/adapters/driven/persistence/supplier-catalog-line-prisma.ts`
- `lib/modules/proveedores/adapters/driven/persistence/supplier-catalog-import-prisma.ts`
- `lib/modules/proveedores/adapters/driving/supplier-catalog-actions.ts`
- `lib/modules/documentos/domain/catalog-extraction.ts`
- `lib/modules/documentos/domain/catalog-import-input.ts`
- `lib/modules/documentos/domain/classify-catalog-import.ts`
- `lib/modules/documentos/domain/preview-catalog-import.ts`
- `lib/modules/documentos/domain/confirm-catalog-import.ts`
- `lib/modules/documentos/adapters/driven/ai/ai-reader-canned.ts`

Documentación (TP, humana):
- `docs/revision-de-prompts.md`
- `specs/QC-129-textos-definitivos-de-los-prompts/requirements.md`

Tests nuevos:
- `tests/unit/inventario/packaging-subtype.test.ts`
- `tests/unit/inventario/schema/qt296-packaging-subtype-migration.test.ts`
- `tests/integration/inventario/qt296-packaging-subtype-migration.int.test.ts`
- `tests/integration/inventario/qt296-packaging-subtype-constraints.int.test.ts`
- `tests/integration/inventario/qt296-packaging-subtype-product.int.test.ts`
- `tests/integration/inventario/qt296-only-containers.int.test.ts`
- `tests/integration/inventario/qt296-company-scope.int.test.ts`
- `tests/integration/pedidos/qt296-distribution-rejects-caps.int.test.ts`
- `tests/integration/proveedores/qt296-catalog-line-type.int.test.ts`
- `tests/unit/proveedores/imported-classification.test.ts`
- `tests/unit/documentos/qt296-alcance.test.ts`

Tests que se amplían o ajustan:
- `tests/unit/inventario/product-input.test.ts`
- `tests/unit/inventario/create-product.test.ts`
- `tests/unit/inventario/product-actions.test.ts`
- `tests/unit/inventario/plan-inventory-import.test.ts`
- `tests/unit/inventario/inventory-import-downloads.test.ts`
- `tests/unit/inventario/import-header.test.ts`
- `tests/unit/inventario/import-cell-parsing.test.ts`
- `tests/unit/inventario/import-sheet-limits.test.ts`
- `tests/unit/inventario/inventory-import-actions.test.ts` (si fija la etiqueta «Envase»)
- `tests/unit/inventario/importar/import-preview.test.tsx` (si fija la etiqueta «Envase»)
- `tests/unit/inventario/importar/inventory-import-screen.test.tsx` (si fija la etiqueta «Envase»)
- `tests/unit/inventario/inventory-import-contract.test-d.ts`
- `tests/unit/inventario/inventory-import-kit.ts`
- `tests/unit/inventario/importar/import-preview-fixtures.ts`
- `tests/unit/inventario/importar/import-guide.test.tsx`
- `tests/unit/shared/listas-blancas-listados.test.ts`
- `tests/unit/inventario/schema/inventario-schema.test.ts` (si fija las columnas de `Product`)
- `tests/unit/proveedores/schema/proveedores-schema.test.ts` (si fija las columnas de `SupplierCatalogLine`)
- `tests/integration/inventario/list-query-products.int.test.ts`
- `tests/integration/inventario/inventory-import-confirm.int.test.ts`
- `tests/unit/proveedores/catalog-line-input.test.ts`
- `tests/unit/proveedores/catalog-service.test.ts`
- `tests/integration/proveedores/catalog-line.int.test.ts`
- `tests/integration/proveedores/catalog-import-upsert.int.test.ts`
- `tests/unit/documentos/catalog-extraction.test.ts`
- `tests/unit/documentos/classify-catalog-import.test.ts`
- `tests/unit/documentos/preview-catalog-import.test.ts`
- `tests/unit/documentos/confirm-catalog-import.test.ts`
- `tests/unit/documentos/ai-reader-canned.test.ts`

Estado:
- `progress/impl_QT-296.md`
- `progress/features/QT-296.md`
