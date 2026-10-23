# QC-203 — agrupar-insumos-por-familia-de-unidad · tasks.md

> Cada tanda cierra con `pnpm run typecheck`, `pnpm run lint`,
> `pnpm exec vitest related --run <archivos tocados>` y `pnpm exec vitest run guard`
> (`docs/perfil-agentes.md > Todos los agentes`). En los tests, `R<n>` va en el nombre del caso.
> Sin migración: ningún bloque toca `db/`.

## Tanda 1 — dominio puro (unidades + inventario)

- [x] **T1 — Publicar la familia de una unidad.** En `convert-quantity.ts`, `effectiveBaseId` pasa a
  ser la exportada `unitFamilyId`, y `convertQuantity` la usa por dentro. El barrel de `unidades`
  la reexporta (`design.md > 3.1`).
  Test `tests/unit/unidades/domain/unit-family.test.ts`: base, derivada y unidad suelta.
  *Hecho:* verde; `convert-quantity.test.ts` sigue verde sin tocarlo.
- [x] **T2 — `supply-family.ts`, `compareDecimals` e `isStoredDecimal`** (`design.md > 3.2`).
  Depende de T1.
  - `pickSupplyTarget` y `convertSupplyBatch`, puras, publicadas por el barrel de `inventario`.
  - `compareDecimals`, exacta, en `decimal-quantity.ts`.
  - `isStoredDecimal` exportada de `product-input.ts`, con el mismo patrón que ya usa.
  - Test `tests/unit/inventario/supply-family.test.ts`, casos:
    - `R1 solo cuentan homónimos con unidad de la misma familia`;
    - `R2 una unidad suelta es su propia familia`;
    - `R5 gana el de más existencia comparada en la base sin truncar`;
    - `R5 en empate gana el primero (más antiguo)`;
    - `R4 500 ml pasan a 0.5 l`;
    - `R6 0.004 por ml pasa a 4 por l`;
    - `R8 0.25 ml a l no cabe y no se redondea`;
    - `R8 más de 10 cifras enteras no cabe`;
    - `R9 0.25 por l a ml no cabe`;
    - `misma unidad devuelve la entrada`.

  *Hecho:* verde; ningún import de `@prisma/client` ni `next/*` (guardia de módulos verde).
- [x] **T3 — Errores y códigos nuevos** (`design.md > 4.3`).
  - `ConvertedStockOutOfRangeError` y `ConvertedCostOutOfRangeError` en `inventario/domain/errors.ts`,
    publicadas por el barrel.
  - `converted_stock_out_of_range` y `converted_cost_out_of_range` en `error-codes.ts`, con la
    línea de enmienda del 2026-10-14, y sus textos en `error-catalog.ts`.

  *Hecho:* `guard-catalogo-de-errores.test.ts` verde.

## Tanda 2 — alta manual en el servidor (depende de la tanda 1)

- [x] **T4 — Puerto y adaptador `findAliveSupplyHomonyms`; se retira `findAliveIdByNameInUnit`**
  (`design.md > 4.1`).
  - Se actualizan todos sus dobles y llamantes en tests (lista en «Archivos esperados») y la
    entrada de `tests/integration/aislamiento.json`.
  - Test nuevo `tests/integration/inventario/supply-homonyms.int.test.ts`, casos:
    - `R1 devuelve los vivos con unidad del mismo nombre normalizado, en orden de antigüedad, con su existencia`;
    - `R1 no devuelve los dados de baja ni los sin unidad`;
    - `R12 no devuelve el homónimo de otra empresa`.

  *Hecho:* verde; `guard-aislamiento-integracion.test.ts` verde.
- [x] **T5 — `createSupply` por familia** (`design.md > 4.2`). Depende de T4.
  - Devuelve `conversion` cuando convierte.
  - Test `tests/unit/inventario/create-product-familia.test.ts`, casos:
    - `R1 un homónimo de otra familia no cuenta y crea`;
    - `R3 sin homónimo crea con la unidad del alta`;
    - `R4 con homónimo en otra unidad agrega el lote convertido y no crea`;
    - `R4 con homónimo en la misma unidad agrega sin convertir`;
    - `R5 entre varios va al de más existencia`;
    - `R6 convierte el costo unitario`;
    - `R7 con solo costo total deriva sobre la existencia convertida`;
    - `R7 si el derivado queda en 0 rechaza como hoy`;
    - `R8 existencia que no cabe: ConvertedStockOutOfRangeError sin escribir`;
    - `R9 costo que no cabe: ConvertedCostOutOfRangeError sin escribir`;
    - `R10 destino terminado: action_not_allowed sin escribir`;
    - `R11 sin inventario.modificar no consulta ni escribe`;
    - `R29 solo llama a addBatchToAlive sobre el destino`.
  - Se adaptan los casos de `create-product.test.ts` que fijaban «otra unidad = otro producto»
    para mismas familias (QC-121 R6, QC-199 R10). Entre familias distintas se conservan.

  *Hecho:* verde.
- [x] **T6 — Consulta de homónimos y action** (`design.md > 4.4`). Depende de T4.
  - `find-supply-homonyms.ts`, `findSupplyHomonymsAction`, `conversion` en el estado de éxito de
    `createProductAction` y cableado en `lib/composition/index.ts`.
  - Test `tests/unit/inventario/find-supply-homonyms.test.ts`, casos:
    - `R11 sin inventario.modificar responde unauthorized sin consultar`;
    - `R12 pasa al puerto la empresa del actor y nunca la de la entrada`;
    - `nombre vacío devuelve [] sin consultar`.
  - Test de integración `R29 tras el alta convertida el otro homónimo conserva unidad, existencia y lotes`
    en `supply-homonyms.int.test.ts`, contra Postgres y por el caso de uso cableado.

  *Hecho:* verde.

## Tanda 3 — aviso en «Nuevo producto» (depende de T6)

- [x] **T7 — `PresentationUnitSelect` gana `hint`** (paso 2: prop opcional, sin romper usos) y su
  fila de `components/shared/CATALOGO.md` anota el punto de extensión.
  Casos nuevos en `tests/unit/configuracion-ui/presentation-unit-select.test.tsx` (el test que ya
  tiene): el texto visible enlazado por `aria-describedby`; sin `hint`, el árbol no cambia.
  *Hecho:* verde; `guard-catalogo-de-componentes.test.ts` verde.
- [x] **T8 — Aviso, errores de campo y toast** (`design.md > 5` y `> 6`; tableros
  `AltaConversion*.dc.html`). Depende de T7.
  - `onNameChange` en `ProductNamePicker`; `onUnitCostChange` en `ProductCostFields`; unidad
    controlada.
  - Archivos nuevos `use-supply-homonyms.ts` y `supply-conversion-notice.tsx`.
  - Cambios en `product-form.tsx` (validación previa y mapeo de los dos códigos a sus campos) y en
    `product-sheet.tsx` (toast).
  - Test `tests/unit/inventario-ui/product-form-conversion.test.tsx`, con la action simulada.
    Casos:
    - `R13 con homónimo en l y alta en ml muestra aviso con cantidad y costo convertidos y la ayuda bajo Unidad`;
    - `R13 se recalcula al cambiar la unidad o la existencia sin volver a pedir`;
    - `R13 sin costo unitario el aviso no trae la línea de costo`;
    - `R14 con varios homónimos nombra cada uno y el destino`;
    - `R15 sin homónimo o con uno en la misma unidad no hay aviso`;
    - `R16 cantidad que no cabe: error bajo Existencia y no envía`;
    - `R16 costo que no cabe: error bajo Costo unitario`;
    - `R16 el rechazo del servidor con converted_stock_out_of_range va a Existencia`;
    - `R17 el toast nombra la cantidad convertida y el destino`.

  *Hecho:* verde; `product-form-unidad.test.tsx` y `product-form-tipo-autocomplete.test.tsx` siguen
  verdes.

## Tanda 4 — importación desde Excel (depende de T5) [P con la tanda 3]

- [x] **T9 — Identidad por familia y conversión en el plan** (`design.md > 7`).
  - `stock` en `ImportProductRef` y en el adaptador.
  - Clave de familia y `FileProduct.unitId`.
  - Dos códigos de motivo con sus textos.
  - Traducción de las clases nuevas en `writeRow`.
  - Se actualizan `inventory-import-kit.ts` y `inventory-import-wiring.ts`.
  - Test `tests/unit/inventario/plan-inventory-import-familia.test.ts`, casos:
    - `R18 fila en ml con homónimo en l queda en sumar lote sobre ese producto`;
    - `R18 segunda fila del archivo en otra unidad de la familia suma sobre la primera`;
    - `R18 otra familia queda en crear`;
    - `R20 existencia convertida que no cabe deja la fila en error en Existencia`;
    - `R20 costo convertido que no cabe deja la fila en error en Costo unitario`;
    - `R20 total derivado en 0 tras convertir deja la fila en error en Costo total`.
  - Test `tests/unit/inventario/confirm-inventory-import-familia.test.ts`, casos:
    - `R19 la confirmación escribe el lote convertido sobre el destino`;
    - `R20 la confirmación no escribe la fila que no cabe`.
  - Integración `R19 findAliveProductsByNormalizedNames devuelve la existencia` en
    `inventory-import-repository.int.test.ts`.

  *Hecho:* verde; `plan-inventory-import.test.ts` verde o adaptado solo donde fijaba «nombre + unidad»
  para unidades de la misma familia.

## Tanda 5 — materia prima de fórmula (depende de T1; tras la tanda 2 por `product-prisma.ts` y `lib/composition/index.ts`)

- [x] **T10 — Servidor** (`design.md > 8.1` a `8.3`).
  - Cambios en `formula-import-input.ts`, `review-formula-import.ts` (`new_unit_missing`),
    `confirm-formula-import.ts`, `FormulaImportDeps.units` y `create-raw-material.ts` (unidad y
    `units`).
  - `product-prisma.ts > createProduct` escribe `unitId`.
  - Cableado en `lib/composition/index.ts`.
  - Tests:
    - `review-formula-import.test.ts`: caso
      `R23 una fila nueva sin unidad da new_unit_missing y no se puede confirmar`.
    - `tests/unit/documentos/confirm-formula-import-unidad.test.ts`, casos:
      - `R24 sin unidad rechaza invalid_input sin crear`;
      - `R24 unidad no visible rechaza sin crear`;
      - `R25 crea la materia prima con la unidad elegida`;
      - `R26 reutiliza el único homónimo de la familia`;
      - `R26 más de uno de la familia rechaza`;
      - `R26 un homónimo sin unidad o de otra familia no cuenta y crea`;
      - `R27 el resumen trae creadas con unidad y reutilizadas`;
      - `R28 sin inventario.modificar no crea`.
    - `create-raw-material.test.ts`: casos `R25 guarda la unidad` y
      `R24 unidad de otra empresa da ValidationError`.
    - `create-raw-material.int.test.ts`: caso `R25 products.unit_id queda escrito`.
  - Se adaptan los dobles de `confirm-formula-import.test.ts`, `preview-formula-import.test.ts`,
    `formula-import-authorization.test.ts`, `formula-import-actions.test.ts` y
    `formula-import.int.test.ts` a la línea con `unitId` y a `deps.units`.

  *Hecho:* verde.
- [x] **T11 — UI de la revisión** (`design.md > 8.4`; tableros `ImportarFormulaUnidad*.dc.html`).
  Depende de T7 y T10.
  - Cambios en `formula-import-review.tsx`, `formula-ingredient-row.tsx` y
    `formula-import-summary.tsx`.
  - Test `tests/unit/recetas-ui/formula-import-unidad.test.tsx`, casos:
    - `R21 con «kg» leído preselecciona kg y dice que se sugirió del PDF`;
    - `R22 con «gotas» queda vacía con su ayuda`;
    - `R22 sin unidad en el PDF queda vacía con su ayuda`;
    - `R22 con dos coincidencias queda vacía con su ayuda`;
    - `R22 al elegir a mano dice Elegida por ti`;
    - `R23 Confirmar con una vacía marca el error en esa fila y no llama a la action`;
    - `R27 el resumen lista las creadas con su unidad`.

  *Hecho:* verde; `formula-import-review.test.tsx` y `formula-import-page.test.tsx` verdes o
  adaptados a la unidad obligatoria.

## Tanda 6 — recorrido, documentación y cierre

- [ ] **T12 — E2E** `e2e/inventario-familia-de-unidad.spec.ts`. Depende de T8.
  - Caso `R30 alta de Glicerina 500 ml sobre Glicerina en l avisa, guarda y la existencia sube 0,5 l`.
  - Usuario de fixture con `createFixtureUser`. «Glicerina» en l se siembra por Prisma con un lote.
  - Pasos: abrir «Nuevo producto», escribir nombre, elegir ml y existencia 500, y ver
    `supply-conversion-notice` con `500 ml = 0,5 l`. Después guardar y ver en el listado la
    existencia anterior + 0,5 l.
  - Contra Postgres: un solo producto vivo «Glicerina», y su nuevo lote con existencia `0.5000`.

  *Hecho:* `pnpm exec playwright test e2e/inventario-familia-de-unidad.spec.ts` verde.
- [ ] **T13 — Revisar los E2E que daban por partidos los homónimos de una misma familia.** Hay que
  leer `e2e/inventario.spec.ts`, `e2e/insumo-por-unidad.spec.ts` y `e2e/inventario-importar.spec.ts`.
  - Si alguno crea el mismo nombre en dos unidades de la misma familia y espera dos productos, se
    adapta a la regla nueva o se cambia a dos familias.
  - Si ninguno lo hace, la tarea se cierra sin diff y se anota en `progress/impl_QC-203-…md`.

  Depende de T8 y T9.
  *Hecho:* esos specs verdes sin casos saltados.
- [x] **T14 — Anotar las enmiendas** (`design.md > 9`). Una línea «Enmendado por QC-203 (fecha):
  …» bajo QC-159 R25 y R26, QC-199 R10, QC-121 R5 y R6, y QC-209 R14 y R15, en sus
  `requirements.md`. No se reescribe el requisito original. [P]
  *Hecho:* las seis anotaciones presentes.
- [ ] **T15 — Gate y trazabilidad.** `./init.sh` en verde, y el mapa `R1..R30 -> test` en
  `progress/impl_QC-203-agrupar-insumos-por-familia-de-unidad.md`. Depende de todo lo anterior.
  *Hecho:* cada `R<n>` con al menos un test nombrado.

## Mapa previsto R -> test

| R | Test(s) |
|---|---|
| R1 | T2 `supply-family.test.ts`; T4 `supply-homonyms.int.test.ts`; T5 `create-product-familia.test.ts` |
| R2 | T2 |
| R3 | T5 |
| R4 | T2; T5 |
| R5 | T2; T5 |
| R6 | T2; T5 |
| R7 | T5 |
| R8 | T2; T5 |
| R9 | T2; T5 |
| R10 | T5 |
| R11 | T5; T6 `find-supply-homonyms.test.ts` |
| R12 | T4; T6 |
| R13 | T8 `product-form-conversion.test.tsx`; T12 |
| R14 | T8 |
| R15 | T8 |
| R16 | T8 |
| R17 | T8 |
| R18 | T9 `plan-inventory-import-familia.test.ts` |
| R19 | T9 `confirm-inventory-import-familia.test.ts`, `inventory-import-repository.int.test.ts` |
| R20 | T9 |
| R21 | T11 `formula-import-unidad.test.tsx` |
| R22 | T11 |
| R23 | T10 `review-formula-import.test.ts`; T11 |
| R24 | T10 `confirm-formula-import-unidad.test.ts`, `create-raw-material.test.ts` |
| R25 | T10 `confirm-formula-import-unidad.test.ts`, `create-raw-material.test.ts`, `create-raw-material.int.test.ts` |
| R26 | T10 |
| R27 | T10; T11 |
| R28 | T10 |
| R29 | T5; T6 (integración) |
| R30 | T12 `e2e/inventario-familia-de-unidad.spec.ts` |

## Archivos esperados

Producción:

- `lib/modules/unidades/domain/convert-quantity.ts`
- `lib/modules/unidades/index.ts`
- `lib/modules/inventario/domain/supply-family.ts`
- `lib/modules/inventario/domain/decimal-quantity.ts`
- `lib/modules/inventario/domain/product-input.ts`
- `lib/modules/inventario/domain/create-product.ts`
- `lib/modules/inventario/domain/find-supply-homonyms.ts`
- `lib/modules/inventario/domain/create-raw-material.ts`
- `lib/modules/inventario/domain/errors.ts`
- `lib/modules/inventario/domain/plan-inventory-import.ts`
- `lib/modules/inventario/domain/inventory-import-contract.ts`
- `lib/modules/inventario/domain/confirm-inventory-import.ts`
- `lib/modules/inventario/ports/product-repository.ts`
- `lib/modules/inventario/ports/inventory-import-repository.ts`
- `lib/modules/inventario/adapters/driven/persistence/product-prisma.ts`
- `lib/modules/inventario/adapters/driven/persistence/inventory-import-prisma.ts`
- `lib/modules/inventario/adapters/driving/product-actions.ts`
- `lib/modules/inventario/index.ts`
- `lib/modules/errores/domain/error-codes.ts`
- `lib/modules/errores/domain/error-catalog.ts`
- `lib/modules/documentos/domain/formula-import-input.ts`
- `lib/modules/documentos/domain/review-formula-import.ts`
- `lib/modules/documentos/domain/confirm-formula-import.ts`
- `lib/modules/documentos/domain/preview-formula-import.ts`
- `lib/modules/documentos/index.ts`
- `lib/composition/index.ts`
- `components/shared/presentation-unit-select.tsx`
- `components/shared/CATALOGO.md`
- `app/(private)/inventario/components/product-form.tsx`
- `app/(private)/inventario/components/product-sheet.tsx`
- `app/(private)/inventario/components/product-name-picker.tsx`
- `app/(private)/inventario/components/product-cost-fields.tsx`
- `app/(private)/inventario/components/supply-conversion-notice.tsx`
- `app/(private)/inventario/components/use-supply-homonyms.ts`
- `app/(private)/produccion/formulas/importar/[documentoId]/components/formula-import-review.tsx`
- `app/(private)/produccion/formulas/importar/[documentoId]/components/formula-ingredient-row.tsx`
- `app/(private)/produccion/formulas/importar/[documentoId]/components/formula-import-summary.tsx`

Tests nuevos:

- `tests/unit/unidades/domain/unit-family.test.ts`
- `tests/unit/inventario/supply-family.test.ts`
- `tests/unit/inventario/create-product-familia.test.ts`
- `tests/unit/inventario/find-supply-homonyms.test.ts`
- `tests/unit/inventario/plan-inventory-import-familia.test.ts`
- `tests/unit/inventario/confirm-inventory-import-familia.test.ts`
- `tests/unit/inventario-ui/product-form-conversion.test.tsx`
- `tests/unit/documentos/confirm-formula-import-unidad.test.ts`
- `tests/unit/recetas-ui/formula-import-unidad.test.tsx`
- `tests/integration/inventario/supply-homonyms.int.test.ts`
- `e2e/inventario-familia-de-unidad.spec.ts`

Tests que se adaptan (retirada de `findAliveIdByNameInUnit`, línea nueva con `unitId`, `stock` en
`ImportProductRef`):

- `tests/unit/inventario/create-product.test.ts`
- `tests/unit/inventario/authorization.test.ts`
- `tests/unit/inventario/company-isolation-service.test.ts`
- `tests/unit/inventario/product-service.test.ts`
- `tests/unit/inventario/product-input.test.ts`
- `tests/unit/inventario/list-use-cases.test.ts`
- `tests/unit/inventario/inventory-import-kit.ts`
- `tests/unit/inventario/plan-inventory-import.test.ts`
- `tests/unit/inventario/create-raw-material.test.ts`
- `tests/unit/inventario/create-raw-material-alcance.test.ts`
- `tests/unit/asignaciones/empacador-authorization.test.ts`
- `tests/unit/documentos/review-formula-import.test.ts`
- `tests/unit/documentos/confirm-formula-import.test.ts`
- `tests/unit/documentos/preview-formula-import.test.ts`
- `tests/unit/documentos/formula-import-authorization.test.ts`
- `tests/unit/documentos/formula-import-actions.test.ts`
- `tests/unit/recetas-ui/formula-import-review.test.tsx`
- `tests/unit/recetas-ui/formula-import-page.test.tsx`
- `tests/unit/configuracion-ui/presentation-unit-select.test.tsx`
- `tests/integration/aislamiento.json`
- `tests/integration/inventario/product-unit-without-presentation.int.test.ts`
- `tests/integration/inventario/product-batch-lot.int.test.ts`
- `tests/integration/inventario/qc195-packaging-product.int.test.ts`
- `tests/integration/inventario/inventory-import-wiring.ts`
- `tests/integration/inventario/inventory-import-repository.int.test.ts`
- `tests/integration/inventario/create-raw-material.int.test.ts`
- `tests/integration/documentos/formula-import.int.test.ts`

E2E que se revisan (T13; solo cambian si fijaban homónimos partidos dentro de una familia):

- `e2e/inventario.spec.ts`
- `e2e/insumo-por-unidad.spec.ts`
- `e2e/inventario-importar.spec.ts`

Documentación (T14):

- `specs/QC-159-formula-desde-pdf/requirements.md`
- `specs/QC-199-presentacion-por-unidad-en-alta-de-producto/requirements.md`
- `specs/QC-121-unidad-como-identidad-del-item/requirements.md`
- `specs/QC-209-importar-inventario-desde-excel/requirements.md`
