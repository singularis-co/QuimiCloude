# QT-296 — tipo-y-subtipo-de-empaque-backend · design.md

> Escrito por `spec_author` en F1.2 (2026-10-23). Las referencias `archivo:línea` son sobre la punta
> de la rama en esa fecha (`18541c51`). La T0 de `tasks.md` las vuelve a contrastar.
> El MCP del grafo no se usó: la exploración fue con Grep y Read sobre el worktree.
>
> **Enmienda F2.2 (2026-10-24).** Recoge la decisión del humano sobre el review B1 (§4.1, §4.5,
> R43) y las divergencias de la implementación que cambian el diseño (`progress/impl_QT-296-…md >
> T10 > Divergencias con el spec`, review m3). Cada cambio va en su sección, marcado
> «*Enmienda F2.2*», y la tabla de §13 dice adónde fue cada una de las 14 divergencias.

## Lo que ya existe

**Términos buscados:** `subtipo`, `subtype`, `PackagingSubtype`, `packagingKind`, `tapa`,
`medidor`, `gatillo`, en `feature_list.json` (todas las fichas), `specs/` y el código (`lib/`,
`app/`, `db/`, `tests/`).

**Resultado:** no existe nada equivalente. Las coincidencias son de otro dominio: `subtype` en el
webhook de WhatsApp (QC-238, QC-262); «tapa» y «medidor» en textos de UI, en pasos de receta y en
el medidor de fuerza de la contraseña. En el board solo aparecen las tres fichas de esta acotación:
QT-296 (esta), QT-297 (su UI) y QT-298 (consumo de tapas y medidores). Esa división ya la dejó
escrita «Lo que NO entra».

**Lo que se reutiliza (no se re-crea):**

| Pieza | Dónde | Uso aquí |
|---|---|---|
| Enum `ProductType` y su espejo `PRODUCT_TYPES` | `db/schema.prisma:546`, `lib/modules/inventario/domain/product-type.ts` | Plantilla del enum nuevo: mismo patrón de migración (`20260922150000_product_type_enum`) y de espejo en TS. |
| Presentación fija del envase y unidad de sistema `u` | `products.presentation_id`, `create-product.ts:292-345` (QC-195) | El envase sigue igual. Tapa, medidor y otro usan la misma unidad y la misma existencia entera, sin presentación. |
| CHECK `products_finished_identity_matches_type` | `db/migrations/20261003130000_packaging_products_in_distribution/migration.sql:9-13` | No se toca. Ya admite `PACKAGING` sin presentación (los envases antiguos); se le suma un CHECK aparte para el subtipo. |
| `PackagingCatalog` (`findRefs`, `findCostingBatches`) | `inventario/adapters/driven/persistence/packaging-catalog-prisma.ts:23-34` | Gana el filtro por subtipo envase. Con eso, una tapa en el reparto da el `packaging_not_found` que ya existe. |
| Filtro `presentationUnitId` del listado | `inventario/domain/product-queryable.ts:22`, `product-prisma.ts:240` | Es la consulta del selector (QC-195 T4). No cambia: R13 se cumple porque una tapa no puede tener presentación (R3). |
| Contrato de importación Excel | `inventario/domain/inventory-import-contract.ts` (QC-209) | Gana una columna y dos motivos. Las reglas de columna «forbidden = se ignora y la fila sigue» (`plan-inventory-import.ts:199-210`) se reutilizan para R18 y R19. |
| Interpretación tolerante del JSON de la IA | `documentos/domain/catalog-extraction.ts` (`catch(null)` por campo) | Tipo y subtipo se leen con el mismo patrón: un valor raro se queda en `null` y la línea sobrevive (R29). |
| Clasificación, vista previa y confirmación del catálogo | `classify-catalog-import.ts`, `preview-catalog-import.ts`, `confirm-catalog-import.ts` (QC-158) | Se amplían con tipo y subtipo, sin cambiar su forma. |
| Escritura por identidad con `ON CONFLICT` | `proveedores/adapters/driven/persistence/supplier-catalog-import-prisma.ts:110-179` | El `DO UPDATE` gana tipo y subtipo con la regla de R34. |
| `material` y `measurements` | `supplier_catalog_lines` (QC-158) | Ya existen; no se tocan (R25). |
| Separación `proveedores` ↛ `inventario` | `tests/unit/proveedores/scope.test.ts:129-182` (QC-52, decisión 3) | **Restricción de diseño**: `proveedores` no puede importar `inventario`. Por eso hay dos espejos del subtipo (§3). |
| Guardia de literales de tipo | `tests/guards/guard-tipos-de-producto.test.ts:105` | **Restricción de diseño**: `'PACKAGING'` entre comillas solo puede aparecer en `product-type.ts`. Por eso el tipo de la línea de catálogo usa otros valores (§2.1). |

**UI:** esta ficha no toca componentes. No hay filas de `components/shared/CATALOGO.md` que
consultar ni pase `/design` que citar; eso es de QT-297.

## 1. Resumen

| Dónde | Qué cambia |
|---|---|
| Base | Dos enums nuevos: `PackagingSubtype` (compartido) y `CatalogLineType`. Columna `packaging_subtype` en `products` y columnas `type` y `packaging_subtype` en `supplier_catalog_lines`. Tres CHECK. Relleno: los empaques existentes pasan a envase. |
| `inventario` | Alta de empaque con subtipo, presentación solo en envase, homónimos por subtipo, subtipo en las vistas y en el filtro del listado, `PackagingCatalog` solo con envases, columna «Subtipo» en el Excel. |
| `proveedores` | Tipo y subtipo opcionales en el alta, la edición, las lecturas y la escritura por identidad. |
| `documentos` | El contrato JSON de la IA gana `type` y `packagingSubtype`. La vista previa trae la marca de revisión, y la clasificación y la confirmación los tienen en cuenta. |
| Prompt (humano) | `CATALOG_PROMPT` pide los dos campos nuevos y la tabla de veredictos gana dos filas. Va en la task aislada **TP**, que se hace después de que QC-131 cierre, sobre el texto firmado. |
| Excel | «Empaque» se acepta como sinónimo de «Envase» en «Tipo» y la plantilla pasa a escribir «Empaque» (§4.6). |

Sin tablas nuevas, sin permisos nuevos y sin dependencias nuevas.

## 2. Modelo de datos

### 2.1 Enums

```prisma
/// Enum y no tabla: el conjunto es cerrado a proposito y anadir un valor es una migracion.
enum PackagingSubtype {
  CONTAINER
  CAP
  MEASURER
  OTHER
}

/// Que es lo que vende el proveedor. No es `ProductType`: la linea no conoce el inventario.
enum CatalogLineType {
  RAW_MATERIAL
  TOOL
  PACKAGING_MATERIAL
}
```

- Correspondencia con la ficha: envase = `CONTAINER`, tapa = `CAP` (gatillo, válvula y
  atomizador incluidos), medidor = `MEASURER`, otro = `OTHER` (etiqueta y caja incluidas). Materia
  prima = `RAW_MATERIAL`, herramienta = `TOOL`, empaque = `PACKAGING_MATERIAL`.
- **`PackagingSubtype` es uno solo para las dos tablas.** Es el mismo concepto, y dos enums
  podrían divergir.
- **`CatalogLineType` es un enum propio, no `ProductType` con un CHECK.** Hay dos motivos y los dos
  vienen del repo:
  1. `proveedores` no puede leer nada del inventario (`scope.test.ts` R18, QC-52 decisión 3).
  2. `guard-tipos-de-producto` prohíbe el literal `'PACKAGING'` fuera de `product-type.ts`. Con
     `ProductType`, el dominio de `proveedores` tendría que escribir ese literal o importar
     `PRODUCT_TYPES` de `inventario`, y las dos cosas están prohibidas.

  Como `ProductType` tiene `FINISHED_PRODUCT` y este enum no, «producto terminado» queda fuera
  por construcción (R23), sin CHECK.
- Si algún día una línea de catálogo da de alta un producto, la correspondencia
  `CatalogLineType` → `ProductType` se escribirá en un módulo que importe los dos barrels (hoy,
  `documentos`). Esta ficha no la necesita.

### 2.2 Columnas y CHECK

```prisma
model Product {
  // ...
  /// Solo en empaques.
  packagingSubtype PackagingSubtype? @map("packaging_subtype")
}

model SupplierCatalogLine {
  // ...
  type             CatalogLineType?  @map("type")
  packagingSubtype PackagingSubtype? @map("packaging_subtype")
}
```

| CHECK | Tabla | Cuerpo | R |
|---|---|---|---|
| `products_packaging_subtype_matches_type` | `products` | `("type" = 'PACKAGING') = ("packaging_subtype" IS NOT NULL)` | R2 |
| `products_presentation_only_in_container` | `products` | `"packaging_subtype" IS NULL OR "packaging_subtype" = 'CONTAINER' OR "presentation_id" IS NULL` | R3 |
| `supplier_catalog_lines_packaging_subtype_matches_type` | `supplier_catalog_lines` | `"packaging_subtype" IS NULL OR "type" IS NOT DISTINCT FROM 'PACKAGING_MATERIAL'` | R24 |

*Enmienda F2.2 (divergencia 1).* La primera versión del CHECK de R24 usaba `"type" =
'PACKAGING_MATERIAL'`. Con `type` nulo, esa comparación vale `NULL`, el CHECK no falla y un
subtipo sin tipo pasaba. `IS NOT DISTINCT FROM` lo rechaza. Lo detectó el test de R24. Los CHECK de
R2 y R3 no tienen ese problema: `type` es `NOT NULL`, y en R3 el `IS NULL` explícito cubre el caso.

- **El envase no exige presentación en la base.** `schema.prisma:356-357` documenta envases sin
  presentación de antes de QC-195, y la decisión «Empaque que ya existe» los convierte en envase.
  Un `NOT NULL` condicional rompería la migración si queda alguno. La obligación vive en el alta
  (R6), como hoy.
- **Sin índices nuevos.** El filtro por subtipo del listado va siempre junto al ámbito de empresa,
  que ya tiene `products_company_id_idx`. Ninguna consulta filtra líneas de catálogo por tipo.
- **RLS:** sin tablas nuevas. `products` y `supplier_catalog_lines` ya tienen RLS y `FORCE`, y
  añadir columnas no lo cambia. `guard-empresa-en-esquema` no cambia.

### 2.3 Migración `db/migrations/20261023150000_packaging_subtype/`

*Enmienda F2.2 (divergencia 2).* El `<ts>` quedó en `20261023150000`. Mientras tanto, `origin/dev`
había ganado `20261023120000_whatsapp_send_permission` y `20261023130000_whatsapp_outbound_messages`,
que no tocan estas tablas. La migración está registrada en `MIGRACIONES_ESPERADAS`
(`tests/guards/guard-identificador-de-request.test.ts`), en orden cronológico tras las dos de `dev`.
Se escribe a mano, con el mismo
paréntesis de RLS que `20260922150000_product_type_enum`, porque el relleno escribe `products`.

```sql
-- migration.sql (orden)
ALTER TABLE "products" NO FORCE ROW LEVEL SECURITY;
CREATE TYPE "PackagingSubtype" AS ENUM ('CONTAINER', 'CAP', 'MEASURER', 'OTHER');
CREATE TYPE "CatalogLineType" AS ENUM ('RAW_MATERIAL', 'TOOL', 'PACKAGING_MATERIAL');
ALTER TABLE "products" ADD COLUMN "packaging_subtype" "PackagingSubtype";
UPDATE "products" SET "packaging_subtype" = 'CONTAINER' WHERE "type" = 'PACKAGING';   -- vivos y de baja (R4)
ALTER TABLE "products" ADD CONSTRAINT "products_packaging_subtype_matches_type" CHECK (...);
ALTER TABLE "products" ADD CONSTRAINT "products_presentation_only_in_container" CHECK (...);
ALTER TABLE "supplier_catalog_lines" ADD COLUMN "type" "CatalogLineType";
ALTER TABLE "supplier_catalog_lines" ADD COLUMN "packaging_subtype" "PackagingSubtype";
ALTER TABLE "supplier_catalog_lines" ADD CONSTRAINT "supplier_catalog_lines_packaging_subtype_matches_type" CHECK (...);
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "products" FORCE  ROW LEVEL SECURITY;
```

- El `UPDATE` no toca `updated_at`: es un relleno, no una edición.
- `supplier_catalog_lines` no necesita paréntesis: solo gana columnas nulas, sin relleno (R25).
- `down.sql` revierte en orden inverso: quita los tres CHECK, las tres columnas y los dos tipos.
  **Pierde los subtipos y tipos guardados**, y se acepta: es el rollback de una columna nueva.
- La migración no contiene `DELETE`, `material` ni `measurements` (R25). Lo comprueba un test sobre
  el texto.
- Las migraciones y los rollbacks se prueban contra la base propia del worktree, nunca contra la
  compartida (lección de QC-147 y QC-141).

## 3. Catálogos en código: dos espejos de un enum

| Archivo | Exporta | Barrel |
|---|---|---|
| `lib/modules/inventario/domain/packaging-subtype.ts` (nuevo) | `PACKAGING_SUBTYPES` (`Object.freeze`, `as const`), `PACKAGING_SUBTYPE_VALUES`, `type PackagingSubtype`, `requiresPresentation(subtype)` (solo `CONTAINER`); *Enmienda F2.2:* `countsAsPackagingHomonym(ref)` (§4.1, R43) | `@/lib/modules/inventario` |
| `lib/modules/proveedores/domain/catalog-line-type.ts` (nuevo) | `CATALOG_LINE_TYPES`, `CATALOG_LINE_TYPE_VALUES`, `type CatalogLineType`, `CATALOG_LINE_PACKAGING_SUBTYPES` y `CATALOG_LINE_PACKAGING_SUBTYPES_VALUES` (espejo del de arriba), `type CatalogLinePackagingSubtype`; y en `domain/imported-classification.ts` (nuevo) `resolveImportedClassification` (§6.3) | `@/lib/modules/proveedores` |

El subtipo se declara dos veces a propósito, porque `proveedores` no puede importar `inventario`.
El repo ya lo hace con `DECIMAL_PATTERN` (`product-input.ts:80`). Para que los dos espejos no
diverjan, `tests/unit/inventario/packaging-subtype.test.ts` comprueba tres cosas:
1. los dos objetos tienen los mismos valores;
2. esos valores coinciden con el bloque `enum PackagingSubtype` de `db/schema.prisma`;
3. `CATALOG_LINE_TYPE_VALUES` coincide con el bloque `enum CatalogLineType`.

Desde `tests/` se puede importar todo. Esto cubre R1 en el código; en la base lo cubre el test de
integración que inserta un valor fuera del enum.

## 4. Inventario

### 4.1 Alta manual de producto (`product-input.ts`, `create-product.ts`)

La rama `PACKAGING` de `createUnion` (`product-input.ts:245-258`) cambia así:

```ts
z.strictObject({
  ...productFieldsShape,
  ...batchFieldsCommon,
  type: z.literal(PRODUCT_TYPES.PACKAGING),
  packagingSubtype: z.enum(PACKAGING_SUBTYPE_VALUES).optional().default(PACKAGING_SUBTYPES.CONTAINER), // R5
  presentationId: presentationIdSchema.optional(),
  image: createImageSchema,
}).superRefine((value, ctx) => {
  exigirCostoDelLote(value, ctx);
  // existencia entera, como hoy (R7)
  // CONTAINER sin presentationId -> issue en presentationId (R6)
  // CAP/MEASURER/OTHER con presentationId -> issue en presentationId (R7)
})
```

- Las ramas `PRODUCT` y `MACHINE` siguen siendo `strictObject` sin `packagingSubtype`. Mandarlo da
  `invalid_input` sin escribir nada (R8).
- **R5, alta sin subtipo = envase.** Es la misma regla que la ficha fija para el Excel («vacía en un
  envase cuenta como envase») y para lo que ya existe. Además, el formulario actual, que no cambia
  hasta QT-297, sigue funcionando sin mandar el campo.
- `createPackaging` (`create-product.ts:292`):
  - **Qué cuenta como homónimo** (*Enmienda F2.2, decisión del humano sobre B1, R43*). Cuenta un
    empaque vivo de la empresa con ese nombre normalizado **salvo un envase legado**: subtipo
    `CONTAINER` y `presentation_id NULL`, el que QC-195 dejó así. Se ignora como lo ignoraba
    QC-195. Tapa, medidor y otro sí cuentan, aunque no tengan presentación. El `where` de
    `findAlivePackagingByName` (`product-prisma.ts:540-560`) queda así:

    ```ts
    { nameNormalized, type: PACKAGING, deletedAt: null,
      NOT: { packagingSubtype: CONTAINER, presentationId: null } }
    ```

    Devuelve también `packagingSubtype` y mantiene el desempate `createdAt asc, id asc`. Con el
    legado fuera del conjunto, el más antiguo que queda es el envase bueno, y los lotes nuevos van
    a él (R43).
    *La primera versión decía «con o sin presentación» y quitaba la condición entera. Con eso, un
    legado bloqueaba el alta de un envase nuevo con el mismo nombre y, si ya coexistían, se quedaba
    con todos los lotes nuevos (review B1).*
  - Un homónimo con otro subtipo da `ActionNotAllowedError`. Si es envase con otra presentación,
    también, como hoy. En los demás casos se suma el lote (R9).
  - Nace con `{ presentationId: string | null, unitId, packagingSubtype }`. Los lotes siguen sin
    presentación.
- *Enmienda F2.2 (divergencia 4).* `PackagingIdentity.packagingSubtype` (`product-view.ts:89-92`)
  es **opcional**, y su `presentationId` admite `null`. `createWithFirstBatch` (`product-prisma.ts`)
  decide el subtipo por `product.type`:
  - `PACKAGING` → el de la identidad o, si falta, `CONTAINER` (la misma regla que R5);
  - cualquier otro tipo → `NULL`, y el CHECK de R2 lo garantiza aunque el código fallara.

  El dominio siempre lo manda. Que sea opcional evita tocar cinco ayudantes de siembra de test que
  llaman al adaptador con la identidad de QC-195.
- `product-actions.ts` (driving) lee `packagingSubtype` del `FormData` igual que lee `type`. Si
  falta, se omite. No hay UI que lo mande hasta QT-297.

### 4.2 Edición (R10)

El humano decidió que el subtipo queda fijo al crearlo. `updateUnion` no cambia: sus ramas son
`strictObject` sin `packagingSubtype`, así que mandarlo ya da `invalid_input`. Hoy pasa porque es
una clave desconocida, y un test lo fija para que siga pasando. Un error de subtipo se corrige
dando de baja el producto y creándolo de nuevo.

### 4.3 Lecturas y listado (R11, R12)

- `ProductView` gana `packagingSubtype?: PackagingSubtype | null`. Lo rellenan `PRODUCT_SELECT` y
  sus proyecciones, que cubren el detalle, el listado y `getProduct`.
  *Enmienda F2.2 (divergencia 4, review m2).* El campo es **opcional** (`?:`). Hacerlo obligatorio
  obligaba a tocar unos 30 fixtures de UI. Los adaptadores de lectura (`toProductView`,
  `finished-stock-prisma`) siempre lo rellenan, así que el riesgo es solo de tipos: QT-297 tiene
  que tratar `undefined` igual que `null`. **Deuda:** volverlo obligatorio cuando QT-297 toque esos
  fixtures.
- `PRODUCT_QUERYABLE.filterable` gana `packagingSubtype: 'select'`. `buildProductWhere`
  (`product-prisma.ts:234-247`) lo traduce a `{ packagingSubtype: { in: valoresValidos } }`,
  descartando los que no estén en `PACKAGING_SUBTYPE_VALUES`, igual que hace hoy con `type`. Se
  actualiza `tests/unit/shared/listas-blancas-listados.test.ts`.

### 4.4 Selector y reparto del pedido (R13, R14)

- **El selector no cambia de consulta.** Pide `type = PACKAGING` y `presentationUnitId ∈ unidades`
  (QC-195 T4). Ese filtro solo casa productos con presentación, y por R3 solo un envase puede
  tenerla. R13 lo prueba un test de integración que siembra un envase, una tapa y un medidor y
  hace la misma consulta que el selector.
- **`PackagingCatalog`** (`packaging-catalog-prisma.ts:28` y la consulta de lotes de
  `findPackagingCostingBatches`) gana `packagingSubtype: CONTAINER` en el `where`. Es la defensa
  del servidor: una línea de reparto con el id de una tapa no la encuentra `findRefs`, y los tres
  caminos de `pedidos` que ya la usan (`resolve-distribution.ts`,
  `order-presentation-availability.ts`, `update-order-presentation-lines.ts`) devuelven el
  `packaging_not_found` que ya existe (R14). **`pedidos` no cambia.**
- **R39:** Terminar el empaque consume solo los `packagingProductId` del reparto
  (`order-packing.ts`). Una tapa no puede entrar en el reparto (R14), así que no se consume. No
  hay cambio de código, solo un test que lo fija. El consumo de tapas es de QT-298.

### 4.5 Importación desde Excel (R15–R22)

`inventory-import-contract.ts`:

```ts
{ key: 'subtype', header: 'Subtipo', headerRequired: false,
  rules: { PRODUCT: 'forbidden', PACKAGING: 'optional', MACHINE: 'forbidden', FINISHED_PRODUCT: 'forbidden' } }
// va justo después de 'type'

export const IMPORT_SUBTYPE_LABELS = {
  CONTAINER: 'Envase', CAP: 'Tapa', MEASURER: 'Medidor', OTHER: 'Otro',
} as const satisfies Record<PackagingSubtype, string>;

IMPORT_ROW_ISSUE_CODES += 'subtype_invalid', 'subtype_mismatch'
ImportRowBase += readonly packagingSubtype: PackagingSubtype | null   // null si no es empaque o no se pudo leer
```

`plan-inventory-import.ts`:
- **Lectura del subtipo.** Se compara igual que «Tipo»: sin mayúsculas, sin tildes y sin espacios
  en los extremos. Vacío en un empaque da `CONTAINER` (R16). Un texto desconocido da
  `subtype_invalid` en `subtype` (R17).
  *Enmienda F2.2 (divergencia 12).* Con el subtipo ilegible, la fila tiene
  `packagingSubtype = null`. `presentation` no recibe ninguna regla de subtipo (ni obligatoria ni
  ignorada), y el resto de columnas se valida como en un envase. La fila queda en error de todos
  modos y no se escribe.
- **Presentación según el subtipo.** La tabla de reglas es por tipo, y el subtipo no cabe en ella.
  En una fila `PACKAGING` con subtipo distinto de envase, `presentation` se trata como
  `'forbidden'`: se ignora y se anota en `ignoredColumns` (R18). En envase sigue `'required'`.
  `withoutIgnoredColumns` y `checkRequired` reciben el subtipo ya leído. El cambio se hace en un
  único sitio: una función `columnRule(column, type, subtype)` que sustituye a las lecturas
  directas de `column.rules[type]`.
- **Subtipo en una fila que no es de empaque.** Se ignora por la regla `forbidden` (R19).
- **Identidad.** La clave sigue siendo `E|<nombre>`. El existente se busca entre los empaques
  vivos que cuentan como homónimo, con la **misma regla que el alta** (§4.1, R43): se ignora el
  envase legado (`CONTAINER` sin presentación), y tapa, medidor y otro cuentan sin presentación.
  En `resolveIdentity` (`plan-inventory-import.ts:476`), el `find` exige
  `!(product.packagingSubtype === CONTAINER && product.presentationId === null)` en lugar del
  `presentationId !== null` de hoy. Para que las dos búsquedas no diverjan, la regla se escribe una
  sola vez, como predicado puro del dominio (`countsAsPackagingHomonym(ref)` en
  `packaging-subtype.ts`). La usan `resolveIdentity` y los tests del adaptador; el `where` de
  Prisma la refleja tal cual. Si el subtipo difiere del existente o del de una fila anterior del
  archivo, la fila da `subtype_mismatch` en `subtype` (R20). Si coincide, el envase sigue con su
  regla de presentación (`presentation_mismatch`) y el resto suma lote.
  *Enmienda F2.2 (B1).* La primera versión decía «con o sin presentación» y quitaba la condición.
  Ver §4.1.
  `ImportProductRef` (`ports/inventory-import-repository.ts:5-12`) y su adaptador
  (`inventory-import-prisma.ts`) ganan `packagingSubtype`, y el estado del archivo (`FileProduct`)
  también.
- **Candidato de escritura.** Lleva `packagingSubtype`, y la presentación solo si es envase
  (R22). `confirm-inventory-import.ts:118-124`: una `ActionNotAllowedError` en una fila de empaque
  da `subtype_mismatch` si el subtipo de la fila no es envase, y `presentation_mismatch` si lo
  es. Solo ocurre en una carrera, porque la confirmación vuelve a planificar antes de escribir.
- **Plantilla (R21).** `IMPORT_EXAMPLE_ROWS` gana `subtype: ''` en todas las filas. La fila de
  ejemplo de una plantilla antigua, sin la columna, se lee con `subtype = ''`, y como
  `isExampleRow` compara columna a columna, sigue casando. Si el ejemplo dijera «Envase», las
  plantillas ya descargadas importarían su fila de ejemplo como un producto real.
- **Mensajes.** Se añaden los textos de `subtype_invalid` («debe ser Envase, Tapa, Medidor u
  Otro.») y de `subtype_mismatch` («ya existe un empaque con ese nombre y otro subtipo.») al mapa
  de `plan-inventory-import.ts:88`.
- La guía y la tabla de vista previa (`app/(private)/inventario/importar/components/`) son UI y van
  en QT-297. Si un test de UI existente cuenta columnas del contrato, se ajusta solo su
  expectativa, nunca el componente (`tasks.md > T5`).
- *Enmienda F2.2 (divergencia 13, excepción de UI aprobada por el humano el 2026-10-23).*
  `app/(private)/inventario/importar/components/import-texts.ts` (`GUIDE_COLUMN_DESCRIPTION_TEXTS`)
  gana la entrada `subtype`, y el texto de `type` pasa a decir «Empaque», con el texto exacto del
  humano. Sin ese cambio no compila, porque el mapa está tipado sobre `ImportColumnKey`, que gana
  `subtype`. Es el único archivo de `app/` que toca la ficha, y QT-297 pulirá el texto. Quedan
  para QT-297, por decisión del leader: el mensaje de `type_invalid`, que sigue diciendo «Envase», y
  la hoja «Valores disponibles», que no lista subtipos.

### 4.6 «Empaque» como sinónimo de «Envase» en «Tipo» (R21, R41, R42)

- `inventory-import-contract.ts`:
  - `IMPORT_TYPE_LABELS.PACKAGING` pasa a `'Empaque'`. Es la etiqueta que escribe la plantilla: la
    fila de ejemplo y la hoja de valores admitidos (`inventory-import-downloads.ts:54` y `:120`)
    la toman de ahí sin más cambio (R42).
  - Nuevo `IMPORT_TYPE_ALIASES = { PACKAGING: ['Envase'] } as const satisfies
    Partial<Record<ImportRowType, readonly string[]>>`.
- `import-cell-parsing.ts:40`: `TYPE_BY_LABEL` se construye con las etiquetas y con los alias,
  pasados todos por el mismo `foldText`. Así «Envase», «envase», « EMPAQUE » y «Empaque» dan
  `PACKAGING` (R41). `parseImportType` no cambia de firma. Al construir el mapa se comprueba que
  ningún alias choque con otra etiqueta.
- **Filas de ejemplo antiguas (R21).** `isExampleRow` (`import-sheet.ts:156`) compara la celda
  «Tipo» como texto (`collapseSpaces`), no como tipo. Con la etiqueta nueva, el ejemplo de envase
  de una plantilla ya descargada («Envase», sin columna «Subtipo») dejaría de reconocerse y se
  importaría como un producto real. Por eso `inventory-import-downloads.ts` exporta también
  `LEGACY_IMPORT_EXAMPLE_ROWS`: las mismas filas con `IMPORT_TYPE_ALIASES.PACKAGING[0]` en el
  empaque. `CANONICAL_EXAMPLES` se construye con las dos listas. Comparar «Tipo» por el tipo
  leído también funcionaría, pero dejaría de importar una fila que hoy se importa (p. ej.
  «ENVASE» con el resto igual al ejemplo), y la decisión exige que los archivos existentes se
  importen igual que hoy.
- Lo que ve el usuario de una fila (sus `cells`, el archivo de errores) sigue siendo el texto tal
  cual lo escribió. Solo cambia la etiqueta que propone el sistema.
- La guía de importación (UI) muestra la etiqueta del contrato y pasa a decir «Empaque» sin tocar
  el componente. Si un test de UI fija el texto «Envase», se ajusta solo su expectativa.

## 5. Proveedores: la línea de catálogo

### 5.1 Esquema de entrada (`catalog-line-input.ts`)

```ts
const catalogLineTypeSchema    = z.enum(CATALOG_LINE_TYPE_VALUES).nullable();
const catalogLineSubtypeSchema = z.enum(CATALOG_LINE_PACKAGING_SUBTYPES_VALUES).nullable();

createCatalogLineSchema = z.strictObject({ supplierId, ...catalogLineFieldsShape,
  type: catalogLineTypeSchema.optional(), packagingSubtype: catalogLineSubtypeSchema.optional() })
  .superRefine(subtipoSoloEnEmpaque)                                          // R26

updateCatalogLineSchema = z.strictObject({ ...catalogLineFieldsShape,
  type: catalogLineTypeSchema.optional(), packagingSubtype: catalogLineSubtypeSchema.optional() })
  .superRefine(ambosONinguno).superRefine(subtipoSoloEnEmpaque)                // R27
```

- **Alta (R26).** Si falta, es `null`. Un subtipo con un tipo distinto de `PACKAGING_MATERIAL`, o
  sin tipo, da `invalid_input`.
- **Edición (R27).** Tipo y subtipo viajan juntos. Si no viene ninguno, se conserva lo guardado:
  la edición del formulario actual, que no los manda, no borra un tipo puesto por el PDF. Si
  vienen los dos, reemplazan lo guardado, y `null` quita. Si viene uno solo, `invalid_input`. Así
  nunca queda un subtipo viejo bajo un tipo nuevo. Es la única excepción al «reemplazo completo»
  de la edición (`catalog-line-input.ts:186-195`), y es necesaria porque el formulario de hoy no
  conoce los campos.
- `classify-catalog-import.ts` valida campo a campo con `createCatalogLineSchema.shape.*`, y lo
  sigue haciendo.
  *Enmienda F2.2 (divergencia 9).* La primera versión daba por hecho que `.shape` se perdía con
  `superRefine` y proponía exportar `catalogLineFieldsShape` para `documentos`. Con zod 4,
  `superRefine` devuelve el mismo esquema y `.shape` sigue disponible, como confirman typecheck y
  tests. El clasificador no cambia de fuente y la forma base no se exporta.
- `supplier-catalog-actions.ts` (driving) lee `type` y `packagingSubtype` del `FormData`. Clave
  ausente es ausente; cadena vacía es `null`.

### 5.2 Escritura y lectura (`supplier-catalog-line-prisma.ts`, `create-catalog-line.ts`, `update-catalog-line.ts`)

- `CatalogLineFields` y `CatalogLineView` (`catalog-line-view.ts:33-69`) ganan
  `type: CatalogLineType | null` y `packagingSubtype: CatalogLinePackagingSubtype | null` (R28).
- *Enmienda F2.2 (divergencia 7).* La clasificación no viaja como un parámetro
  `classification?` aparte, sino dentro de `data`, con el tipo `CatalogLineReplacement`:
  `CatalogLineFields` sin los dos campos y con un `classification?: { type, packagingSubtype }`
  opcional. Si `classification` es `undefined`, el adaptador no escribe esas dos columnas (R27).
  El alta y la importación usan `CatalogLineFields`, con `type` y `packagingSubtype` obligatorios
  y anulables. El contrato es el mismo, y queda tipado en un solo argumento.
- La lectura del listado y la lectura por identidad seleccionan las dos columnas.
  *Enmienda F2.2 (divergencia 8).* `proveedores` no tiene lectura de una línea por id (`create` y
  `replaceAlive` no devuelven vista), así que el «detalle» de R28 se prueba sobre el listado y sobre
  la lectura por identidad. No se añade una lectura por id para eso. El listado no gana filtro por
  tipo: nadie lo pidió, y QT-297 decidirá si lo necesita.

### 5.3 Escritura por identidad de la importación (R33–R35)

`import-catalog-lines.ts` valida cada línea con la forma de edición, y los dos campos llegan
siempre: `null` significa «no se sabe». `upsertCatalogLinesByIdentity`
(`supplier-catalog-import-prisma.ts:134-165`):

```sql
INSERT ... ("type", "packaging_subtype", ...) VALUES (${type}::"CatalogLineType", ${subtype}::"PackagingSubtype", ...)
ON CONFLICT (supplier_id, name_normalized, presentation_id) WHERE deleted_at IS NULL
DO UPDATE SET
  "cost" = EXCLUDED."cost",
  "type" = COALESCE(EXCLUDED."type", supplier_catalog_lines."type"),
  "packaging_subtype" = CASE
      WHEN COALESCE(EXCLUDED."type", supplier_catalog_lines."type") = 'PACKAGING_MATERIAL'
        THEN COALESCE(EXCLUDED."packaging_subtype", supplier_catalog_lines."packaging_subtype")
      ELSE NULL END,
  "updated_by" = EXCLUDED."updated_by", "updated_at" = EXCLUDED."updated_at"
WHERE supplier_catalog_lines."cost" IS DISTINCT FROM EXCLUDED."cost"
   OR supplier_catalog_lines."type" IS DISTINCT FROM COALESCE(EXCLUDED."type", supplier_catalog_lines."type")
   OR supplier_catalog_lines."packaging_subtype" IS DISTINCT FROM (<mismo CASE>)
```

- **Un dato conocido reemplaza al guardado, y uno desconocido nunca lo borra (R34).** Reimportar
  un PDF en el que la IA dudó no deshace lo que alguien clasificó a mano. Si el tipo resultante
  no es empaque, el subtipo se vacía, y eso respeta el CHECK de R24.
- Que el `WHERE` incluya tipo y subtipo hace que «solo cambió el tipo» cuente como `updated`
  (R35). El `ON CONFLICT` sigue siendo el único árbitro: no hay ningún `SELECT` previo.
- `findAliveCatalogLinesByIdentities` y `findCatalogLinesByIdentity` devuelven también `type` y
  `packagingSubtype`, para que la clasificación pueda decir «cambia» (§6.3).

## 6. Documentos: lectura del catálogo desde PDF

### 6.1 Contrato JSON que acepta el sistema (enmienda a QC-158 `design.md > 3`)

Se añaden dos campos por línea. El resto no cambia.

```json
{
  "lines": [
    {
      "name": "...", "presentation": "...", "unit": "...", "cost": "...", "minPurchase": "...",
      "deliveryTime": 0, "material": "...", "measurements": { "...": "..." }, "page": 1,
      "type": "RAW_MATERIAL | TOOL | PACKAGING_MATERIAL | null",
      "packagingSubtype": "CONTAINER | CAP | MEASURER | OTHER | null"
    }
  ]
}
```

- Los valores son los códigos del enum, no etiquetas en español. Así no hace falta una tabla de
  sinónimos ni normalizar tildes. Qué significa cada código, y que gatillo, válvula y atomizador
  son `CAP` y etiqueta y caja son `OTHER`, lo explica el texto del prompt, que vive fuera del repo
  (R36, R37).
- El texto del prompt **no** se escribe aquí ni en ningún archivo versionado (R36, QC-129 R9,
  QC-158 R36). El borrador fuera de git (`borradores-de-prompts/catalogo.md`, QC-131 R7) se ajusta
  a esta forma en la task **TP**.

### 6.2 Interpretación (`catalog-extraction.ts`)

- `extractedLineSchema` gana `type: z.enum(CATALOG_LINE_TYPE_VALUES).nullable().catch(null)` y
  `packagingSubtype: z.enum(CATALOG_LINE_PACKAGING_SUBTYPES_VALUES).nullable().catch(null)`. Un
  valor ausente o fuera de la lista se queda en `null` y la línea sobrevive (R29). Los valores se
  importan del barrel de `proveedores`; `documentos` ya lo importa.
- En `trimLine`, si `type !== PACKAGING_MATERIAL`, entonces `packagingSubtype = null` (R30).
- `ExtractedLine` gana los dos campos.

### 6.3 Clasificación (`classify-catalog-import.ts`)

- `ClassifyRowInput` gana `type` y `packagingSubtype`. `FIELD_VALIDATORS` gana el campo
  `packagingSubtype`, que es inválido si no es `null` y el tipo no es `PACKAGING_MATERIAL`. Con
  eso la fila clasifica «incompleta» (R32). El tipo no puede ser inválido por valor: lo filtra el
  borde (§6.4) o la extracción (§6.2).
  *Enmienda F2.2 (divergencia 11).* Esto vale también para un subtipo **sin tipo** (`type = null`).
  La regla se aplica tal cual: la fila revisada sale «incompleta» por `packagingSubtype`, y no se
  descarta el subtipo en silencio como hace la extracción de la IA (R30). La diferencia es a
  propósito: lo que escribe un revisor se le señala, y lo que adivina la IA se descarta.
- `AliveCatalogLine` gana `type` y `packagingSubtype`. Una fila con línea viva es «cambia» si el
  costo difiere o si la clasificación resultante, calculada con la regla de §5.3, difiere de la
  guardada (R35). Para que la vista previa y la escritura no puedan divergir, esa regla se escribe
  una sola vez, como función pura de `proveedores` (`resolveImportedClassification(stored,
  incoming)`), y la usan la clasificación y los tests del SQL.

### 6.4 Borde (`catalog-import-input.ts`)

`reviewedLineInputSchema` gana `type` y `packagingSubtype`, los dos `z.enum(...).nullable().optional()`.
Si faltan, son `null`, y la pantalla actual, que no los manda, sigue funcionando (R32). Un valor
fuera de la lista rechaza la petición entera (`ValidationError`), igual que hoy un `deliveryTime`
que no es entero: es una entrada del navegador, no de la IA.

*Enmienda F2.2 (divergencia 10).* No hay `.transform` en el borde: `ReviewedLineInput.type` y
`.packagingSubtype` quedan **opcionales** en el tipo inferido. Un `.transform(v => v ?? null)` los
volvería obligatorios en ese tipo, y rompería `catalog-import-review.tsx`, la pantalla actual, que
construye filas sin ellos y es de QT-297. El paso de ausente a `null` se hace donde se usan los
campos: en `fromReviewedLine` (vista previa), en `toClassifyRow` y en el mapeo de `fields` de la
confirmación.

### 6.5 Vista previa y confirmación

- `CatalogImportPreviewRow` gana:
  - `type: CatalogLineType | null`;
  - `packagingSubtype: CatalogLinePackagingSubtype | null`;
  - `needsTypeReview: boolean`, que vale `type === null || (type === PACKAGING_MATERIAL && packagingSubtype === null)` (R31).

  La marca no cambia `kind` ni bloquea la confirmación.
- `fromExtractedLine`, `fromReviewedLine`, `toClassifyRow` (en los dos archivos) y el mapeo de
  `fields` de `confirm-catalog-import.ts:200-214` pasan los dos campos (R33).

### 6.6 Doble de IA (`ai-reader-canned.ts`, R38)

`CANNED_CATALOG_TEXT` gana `type` y `packagingSubtype` en sus dos líneas. La primera, que ya trae
material y medidas de envase, lleva `PACKAGING_MATERIAL` + `CONTAINER`. La segunda lleva `null` +
`null`, para que la vista previa marque la revisión. Se exportan dos constantes con esos valores
para que los tests afirmen contra ellas. `e2e/catalogo-desde-pdf.spec.ts` no se toca. Se vuelve a
correr para comprobar que sigue en verde (R38).

## 7. Contratos de salida para QT-297

Lo que la UI va a consumir. Esta ficha lo deja fijo y probado.

| Contrato | Forma |
|---|---|
| `@/lib/modules/inventario` | `PACKAGING_SUBTYPES`, `PACKAGING_SUBTYPE_VALUES`, `PackagingSubtype`, `requiresPresentation`; `ProductView.packagingSubtype`; filtro `packagingSubtype` del listado; `IMPORT_SUBTYPE_LABELS`; `IMPORT_TYPE_LABELS.PACKAGING = 'Empaque'` e `IMPORT_TYPE_ALIASES`; motivos `subtype_invalid` y `subtype_mismatch`; `ImportPreviewRow.packagingSubtype` |
| Alta de producto (`FormData`) | `packagingSubtype` opcional (`CONTAINER` por defecto en empaque); `presentationId` solo en envase |
| `@/lib/modules/proveedores` | `CATALOG_LINE_TYPES`, `CATALOG_LINE_TYPE_VALUES`, `CatalogLineType`, `CATALOG_LINE_PACKAGING_SUBTYPES`, `CatalogLinePackagingSubtype`; `CatalogLineView.type` y `.packagingSubtype` |
| Alta y edición de línea (`FormData`) | `type` y `packagingSubtype`; en la edición, los dos o ninguno (§5.1) |
| Importación del catálogo | `CatalogImportPreviewRow.type`, `.packagingSubtype`, `.needsTypeReview`; filas revisadas con `type` y `packagingSubtype` opcionales |

Nota para QT-297: un producto de empaque sin presentación ya no es siempre un envase antiguo.
Puede ser una tapa, un medidor u otro. La marca de envase antiguo sin presentación fija (QC-195
T14) debe mirar el subtipo.

## 8. Autorización y empresa (R40)

- Sin permisos nuevos. Las operaciones siguen exigiendo lo de hoy:
  - alta de producto e importación de Excel: `inventario.modificar`;
  - listado: `inventario.consultar`;
  - alta y edición de línea: `proveedores.modificar`;
  - vista previa y confirmación del catálogo: `CATALOG_IMPORT_PERMISSION` y el añadido
    `lectura_pdf`.
- Sin consultas nuevas fuera de ámbito. El filtro por subtipo va dentro del `AND` de empresa de
  `buildProductWhere`, y `PackagingCatalog` conserva `productCompanyScope`. Las consultas
  ampliadas de homónimos y de identidad conservan su ámbito.
- Test de R40: un empaque de otra empresa con el mismo nombre no da `subtype_mismatch` ni
  `action_not_allowed`, sino que se crea como nuevo. El id de una tapa de otra empresa en el
  reparto da `packaging_not_found`.

## 9. El prompt y QC-131 (task TP, aislada)

- **Qué hay que hacer.** Todo lo hace una persona; ningún agente escribe en Vercel ni firma
  (QC-131 R9):
  1. Ajustar el borrador fuera de git a §6.1.
  2. Poner el texto en `CATALOG_PROMPT`, en Production y en Preview, con el mismo texto (QC-131
     R8).
  3. Redesplegar (QC-131 R10).
  4. Hacer una pasada firmada con veredicto de «tipo» y «subtipo de empaque».
- **Qué toca del repo.** Dos filas nuevas en la tabla de veredictos de `catalogo` de
  `docs/revision-de-prompts.md` («tipo» y «subtipo de empaque»). QC-131 R14 prohíbe a QC-131
  modificar esa plantilla, y por eso TP espera a que QC-131 cierre. Además, una nota fechada al pie de
  `specs/QC-129-textos-definitivos-de-los-prompts/requirements.md`: R10 pasa de ocho datos más
  `page` a diez más `page`, por QT-296. Es el mismo precedente que dejó QC-158 T17.
- **Orden (decidido el 2026-10-23).** TP se hace después de que QC-131 cierre, sobre el texto que
  QC-131 dejó firmado. Así no se edita la plantilla de veredictos mientras QC-131 la usa.
- **Por qué no bloquea al resto.** El código acepta los campos aunque el prompt aún no los pida. Sin
  ellos, la IA no los devuelve, todas las líneas llegan sin tipo y marcadas para revisar (R29,
  R31), y la confirmación funciona como hoy. Las tasks T0–T10 siguen ya, y QT-296 puede
  mergearse antes de TP.

## 10. Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| **Columna `type` de la línea con el enum `ProductType` y un CHECK que excluya `FINISHED_PRODUCT`.** Un solo enum de tipo en toda la base. | El dominio de `proveedores` tendría que escribir `'PACKAGING'` (lo prohíbe `guard-tipos-de-producto`) o importar `PRODUCT_TYPES` de `inventario` (lo prohíbe `proveedores/scope.test.ts` R18, decisión 3 de QC-52). Reabrir cualquiera de las dos es una decisión del humano, no del spec. |
| **Un único catálogo TS del subtipo, que `proveedores` importe de `inventario`.** | La misma prohibición de QC-52. Al revés, que `inventario` importe de `proveedores`, crea una dependencia del inventario hacia el catálogo de proveedores solo por una constante. Dos espejos con un test que los compare con el enum cuestan menos. |
| **Exigir presentación al envase en la base** (`CHECK` con `packaging_subtype = 'CONTAINER' → presentation_id IS NOT NULL`). | Hay envases sin presentación documentados (`schema.prisma:356-357`). Si queda uno, la migración falla en producción, y no hay una regla cerrada para rellenarlos. La obligación ya vive en el alta. |
| **Etiquetas en español en el JSON de la IA** («materia prima», «tapa»…). | Obliga a una tabla de sinónimos y a normalizar tildes y plurales, y lo que no encaje se pierde igual. Con los códigos del enum, el prompt explica el significado y el código solo comprueba la pertenencia a la lista. |
| **En la reimportación, el tipo de la IA siempre pisa al guardado, aunque sea `null`.** | Una pasada en la que la IA duda borraría la clasificación que alguien hizo a mano. «Un dato conocido reemplaza, uno desconocido no borra» (R34) cumple igual la decisión «se reimporta el PDF». |
| **Edición de línea como reemplazo completo también para tipo y subtipo.** | El formulario actual, que no cambia hasta QT-297, no manda los campos, y cada edición borraría el tipo que puso el PDF. |
| **Reconocer las filas de ejemplo comparando «Tipo» por el tipo leído, en vez de añadir las filas de ejemplo antiguas** (R21). | Es menos código, pero ignoraría como ejemplo filas que hoy se importan («ENVASE» o «envase» con el resto igual al ejemplo). La decisión exige que los archivos existentes se importen igual que hoy. |
| **Que el envase legado cuente como homónimo** (la primera versión de §4.1 y §4.5). | Cerraba el camino de QC-195 para recuperar un legado («se da de alta de nuevo como envase») y, con el legado y el bueno ya coexistiendo, mandaba todos los lotes nuevos contra el legado porque es el más antiguo (review B1). El humano decidió ignorarlo (R43). |
| **Rellenar la presentación de los envases legados en la migración, para que dejen de ser legado.** | No hay una regla cerrada para elegir esa presentación, y hacerlo a ciegas inventa un dato (regla 6). |
| **Filtrar por subtipo en el selector, cambiando la consulta del cliente.** | Es UI (QT-297), y no hace falta: R3 garantiza que el filtro por unidad de la presentación ya solo casa envases. La defensa del servidor está en `PackagingCatalog`. |

## 11. Tests existentes que cambian, y por qué

| Test | Cambio |
|---|---|
| `tests/unit/inventario/product-input.test.ts` | Los casos de `PACKAGING` siguen verdes sin subtipo (R5). Se añaden los de R6, R7 y R8. |
| `tests/unit/inventario/create-product.test.ts` | Los dobles de `findAlivePackagingByName` devuelven `packagingSubtype`. Se añaden R9. |
| `tests/unit/inventario/plan-inventory-import.test.ts`, `inventory-import-downloads.test.ts`, `import-header.test.ts`, `inventory-import-contract.test-d.ts`, `inventory-import-kit.ts`, `importar/import-preview-fixtures.ts` | La columna nueva aparece en cabeceras y celdas, y `packagingSubtype` en las filas. |
| `tests/unit/inventario/import-cell-parsing.test.ts`, `import-sheet-limits.test.ts` | «Empaque» y «Envase» dan el mismo tipo; ejemplos nuevos y antiguos (§4.6). Las expectativas que fijan «Envase» como etiqueta de la plantilla pasan a «Empaque». |
| `tests/unit/shared/listas-blancas-listados.test.ts` | `PRODUCT_QUERYABLE` gana `packagingSubtype`. |
| `tests/unit/proveedores/catalog-line-input.test.ts`, `catalog-service.test.ts` | Formas con los dos campos y la regla «los dos o ninguno». |
| `tests/unit/documentos/catalog-extraction.test.ts`, `classify-catalog-import.test.ts`, `preview-catalog-import.test.ts`, `confirm-catalog-import.test.ts` | Filas con tipo y subtipo, marca de revisión y «cambia» por tipo. |
| `tests/unit/documentos/ai-reader-canned.test.ts` | El texto de guion trae los dos campos. |
| `tests/integration/inventario/qc195-packaging-*.int.test.ts` | Las siembras de envase pasan por el alta con el subtipo por defecto. No se espera ningún cambio de expectativa; si alguno cambia, se anota en la bitácora con su motivo. |

*Enmienda F2.2 (divergencias 3 y 5).*
- **T1 y T2 se commitearon juntas.** El CHECK de R2 rompe cualquier alta de empaque hasta que T2
  manda el subtipo: 126 fallos en 18 suites con T1 sola. Por eso cuatro tests que siembran
  empaques a mano ganaron solo `packagingSubtype`.
- **`create-product.test.ts`.** Dos expectativas de QC-195 («R1, R6» y «R11») ganan
  `packagingSubtype: CONTAINER`, porque la identidad nueva de §4.1 lo incluye.

## 12. Dependencias de terceros

Ninguna. Todo se resuelve con `zod`, Prisma y SQL, que ya están en el repo.

## 13. Enmienda F2.2: adónde fue cada divergencia de la implementación

Origen: `progress/impl_QT-296-tipo-y-subtipo-de-empaque-backend.md > T10 > Divergencias con el
spec`, y review vuelta 1 (B1, m2, m3).

| # | Divergencia | Cambia el diseño | Dónde queda |
|---|---|---|---|
| 1 | CHECK de R24 con `IS NOT DISTINCT FROM` | Sí | §2.2 |
| 2 | Migración `20261023150000` | Sí | §2.3 |
| 3 | T1 y T2 en un mismo commit | No (orden de trabajo) | §11 |
| 4 | `PackagingIdentity.packagingSubtype` y `ProductView.packagingSubtype` opcionales | Sí | §4.1, §4.3 (deuda de m2) |
| 5 | Dos expectativas de `create-product.test.ts` | No (consecuencia de §4.1) | §11 |
| 6 | R13 y R14 no distinguen el filtro `CONTAINER` de la guarda anterior | No | §4.4 ya lo da como defensa en profundidad |
| 7 | Clasificación de la edición dentro de `data` (`CatalogLineReplacement`) | Sí | §5.2 |
| 8 | R28 probado sobre el listado y la lectura por identidad | Sí | §5.2 |
| 9 | El clasificador conserva `createCatalogLineSchema.shape` | Sí | §5.1 |
| 10 | Campos de la fila revisada opcionales, sin `.transform` | Sí | §6.4 |
| 11 | Subtipo sin tipo en una fila revisada da «incompleta» | Sí (lo precisa) | §6.3 |
| 12 | Subtipo ilegible en el Excel | Sí | §4.5 |
| 13 | Excepción de UI en `import-texts.ts` | Sí | §4.5 |
| 14 | Exports nuevos en `inventario/index.ts` | No (cabe en §7) | §7 |
| B1 | El envase legado no cuenta como homónimo (decisión del humano, 2026-10-24) | Sí | §4.1, §4.5, §10, R43, `tasks.md > T11` |
