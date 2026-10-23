# impl QC-203 — agrupar-insumos-por-familia-de-unidad

## Tanda 1 — dominio puro (T1, T2, T3) · 2026-10-14

### Archivos

Modificados:
- `lib/modules/unidades/domain/convert-quantity.ts` — `effectiveBaseId` pasa a `unitFamilyId` exportada.
- `lib/modules/unidades/index.ts` — reexporta `unitFamilyId`.
- `lib/modules/inventario/domain/decimal-quantity.ts` — `compareDecimals` exacta.
- `lib/modules/inventario/domain/product-input.ts` — `isStoredDecimal` exportada (mismo `DECIMAL_PATTERN`).
- `lib/modules/inventario/domain/errors.ts` — `ConvertedStockOutOfRangeError`, `ConvertedCostOutOfRangeError`.
- `lib/modules/inventario/index.ts` — publica las dos clases, `compareDecimals`, `isStoredDecimal` y `supply-family`.
- `lib/modules/errores/domain/error-codes.ts` — dos códigos y línea de enmienda del 2026-10-14.
- `lib/modules/errores/domain/error-catalog.ts` — claves y textos de design §4.3.

Creados:
- `lib/modules/inventario/domain/supply-family.ts`
- `tests/unit/unidades/domain/unit-family.test.ts`
- `tests/unit/inventario/supply-family.test.ts`

### Mapa R -> test (tanda 1)

| R | Caso |
|---|---|
| R1 | `unit-family.test.ts`: `R1 una unidad base es su propia familia`, `R1 una derivada pertenece a la familia de su base`; `supply-family.test.ts`: `R1 solo cuentan homónimos con unidad de la misma familia` |
| R2 | `unit-family.test.ts`: `R2 una unidad suelta, sin base ni derivadas, es su propia familia`; `supply-family.test.ts`: `R2 una unidad suelta es su propia familia` |
| R4 | `R4 500 ml pasan a 0.5 l` |
| R5 | `R5 gana el de más existencia comparada en la base sin truncar`, `R5 en empate gana el primero (más antiguo)` |
| R6 | `R6 0.004 por ml pasa a 4 por l` |
| R8 | `R8 0.25 ml a l no cabe y no se redondea`, `R8 más de 10 cifras enteras no cabe` |
| R9 | `R9 0.25 por l a ml no cabe` |
| — | `misma unidad devuelve la entrada` |

### Verificación

- `pnpm run typecheck`: sin errores.
- `pnpm run lint`: 0 errores, 7 warnings preexistentes en archivos no tocados.
- `pnpm exec vitest run --project node <3 tests>` (unit-family, supply-family, convert-quantity): 3 archivos, 35 tests verdes.
- `pnpm exec vitest related --run --project node --project ui convert-quantity.ts supply-family.ts`: 475 archivos, 8485 verdes, 9 saltados.
  Sin `--project`, `related` arranca el `globalSetup` de integración y cae por falta de `DATABASE_URL` en el worktree.
- `pnpm exec vitest run guard`: 76 archivos, 1064 verdes, 20 saltados.

Veredicto: tanda 1 verde; T1, T2 y T3 hechas.

## Tanda 2 — alta manual en el servidor (T4, T5, T6) · 2026-10-14

### Archivos

Modificados (producción):
- `lib/modules/inventario/ports/product-repository.ts` — `findAliveSupplyHomonyms(name, scope)`; se retira `findAliveIdByNameInUnit`.
- `lib/modules/inventario/adapters/driven/persistence/product-prisma.ts` — adaptador: vivos de la empresa, `name_normalized` igual, `unit_id IS NOT NULL`, cualquier tipo, `created_at, id` asc, `stock` (columna recalculada como suma de lotes) a texto con 4 decimales.
- `lib/modules/inventario/domain/create-product.ts` — `createSupply` por familia (design §4.2, pasos 1–8); tipos `SupplyConversion` y `CreateProductResult`.
- `lib/modules/inventario/adapters/driving/product-actions.ts` — `conversion?` en el éxito de `createProductAction`; `findSupplyHomonymsAction` y `SupplyHomonymsResult`.
- `lib/modules/inventario/index.ts` — publica `CreateProductResult`, `SupplyConversion` y `createFindSupplyHomonyms` con sus tipos.
- `lib/composition/index.ts` — `findAliveSupplyHomonyms` en `productRepository`; `inventario.findSupplyHomonyms`.

Creados (producción):
- `lib/modules/inventario/domain/find-supply-homonyms.ts`

Tests creados:
- `tests/unit/inventario/create-product-familia.test.ts` (13 casos de T5)
- `tests/unit/inventario/find-supply-homonyms.test.ts` (3 casos de T6)
- `tests/integration/inventario/supply-homonyms.int.test.ts` (3 casos de T4 + R29 de T6, por `inventario.createProduct` de `lib/composition`)

Tests adaptados (retirada de `findAliveIdByNameInUnit`):
- `tests/unit/inventario/create-product.test.ts` — dobles a `SupplyHomonym[]`; el catálogo de unidades del doble suma `ml` (otra familia). QC-121 R6 y QC-199 R10 «otra unidad» pasan a «unidad de otra familia» (se conservan). Los comentarios de QC-121 R7 / R20 que decían «el desempate es del adaptador» ya no eran ciertos (QC-203 R5) y se reescribieron. QC-199 R7 (unidad ajena): los homónimos se leen antes de `findRefs` (design §4.2 pasos 2–3), así que el caso afirma «no escribe» en vez de «puerto intacto».
- `tests/unit/inventario/authorization.test.ts`, `company-isolation-service.test.ts`, `product-service.test.ts`, `product-input.test.ts`, `list-use-cases.test.ts`, `tests/unit/asignaciones/empacador-authorization.test.ts` — renombre del doble.
- `tests/integration/inventario/product-unit-without-presentation.int.test.ts` — el caso QC-199 R10 pasa a `findAliveSupplyHomonyms` (con unidad; otra empresa no lo ve).
- `tests/integration/inventario/inventory-import-wiring.ts`, `product-batch-lot.int.test.ts`, `qc195-packaging-product.int.test.ts` — cableado manual del puerto.
- `tests/integration/aislamiento.json` — el motivo de `product-unit-without-presentation` nombra el método nuevo; entrada `commit` nueva para `supply-homonyms.int.test.ts`.

### Mapa R -> test (tanda 2)

| R | Caso |
|---|---|
| R1 | `create-product-familia.test.ts`: `R1 un homónimo de otra familia no cuenta y crea`; `supply-homonyms.int.test.ts`: `R1 devuelve los vivos con unidad del mismo nombre normalizado, en orden de antigüedad, con su existencia`, `R1 no devuelve los dados de baja ni los sin unidad` |
| R3 | `R3 sin homónimo crea con la unidad del alta` |
| R4 | `R4 con homónimo en otra unidad agrega el lote convertido y no crea`, `R4 con homónimo en la misma unidad agrega sin convertir` |
| R5 | `R5 entre varios va al de más existencia` |
| R6 | `R6 convierte el costo unitario` |
| R7 | `R7 con solo costo total deriva sobre la existencia convertida`, `R7 si el derivado queda en 0 rechaza como hoy` |
| R8 | `R8 existencia que no cabe: ConvertedStockOutOfRangeError sin escribir` |
| R9 | `R9 costo que no cabe: ConvertedCostOutOfRangeError sin escribir` |
| R10 | `R10 destino terminado: action_not_allowed sin escribir` |
| R11 | `R11 sin inventario.modificar no consulta ni escribe`; `find-supply-homonyms.test.ts`: `R11 sin inventario.modificar responde unauthorized sin consultar` |
| R12 | `find-supply-homonyms.test.ts`: `R12 pasa al puerto la empresa del actor y nunca la de la entrada`; `supply-homonyms.int.test.ts`: `R12 no devuelve el homónimo de otra empresa` |
| R17 | (servidor) `R4 con homónimo en otra unidad agrega el lote convertido y no crea` fija `conversion` en el retorno; el toast es T8 |
| R29 | `R29 solo llama a addBatchToAlive sobre el destino`; `supply-homonyms.int.test.ts`: `R29 tras el alta convertida el otro homónimo conserva unidad, existencia y lotes` |
| — | `find-supply-homonyms.test.ts`: `nombre vacío devuelve [] sin consultar` |

### Punto abierto (no bloquea)

- R7, borde ml → l con solo costo total: el `superRefine` de `createProductSchema` (QC-90) ya rechaza un total
  cuyo derivado sobre la existencia **sin convertir** da 0. Con 500 ml y total 0.0001, el alta se rechaza con
  `invalid_input` antes de convertir, aunque sobre 0.5 l el derivado (0.0002) cabría. En l → ml el caso es el
  de R7 y se rechaza tras convertir. El spec no toca el esquema; queda para decidir si se relaja.

### Revisión y verificación de la tanda 2 · 2026-10-14

Revisado el diff contra design §4.1, §4.2 y §4.4: cumple; los `it(...)` coinciden con tasks.md T4–T6.

- Punto A (unidad del alta fuera de `units`): `createSupply` lanza `ValidationError` antes de
  `pickSupplyTarget`. Lo cubre `create-product.test.ts` > `QC-199 — alta de insumo por unidad` >
  `R7 una unidad inexistente o de otra empresa es invalid_input y no escribe`.
- Punto B: `pickSupplyTarget` arma la base desde el id de familia. Comentario ampliado en
  `lib/modules/inventario/domain/supply-family.ts` (un solo nivel de derivación, QC-38 R15/R16;
  `convertQuantity` de QC-76). Es el único cambio de esta pasada.

Salida real:
- `pnpm typecheck` → `tsc --noEmit`, exit 0.
- `pnpm lint` → `✖ 7 problems (0 errors, 7 warnings)`, exit 0; los warnings son de archivos ajenos
  (`confirm-catalog-import.test.ts`, `order-service.test.ts`).
- `pnpm exec vitest run <lista explícita>` → 288 passed, 0 failed: guard-aislamiento-integracion 6,
  guard-arquitectura-modulos 62, empacador-authorization 11, authorization 21,
  company-isolation-service 18, create-product-familia 13, create-product 82,
  find-supply-homonyms 3, list-use-cases 22, product-input 22, product-service 15,
  supply-family 10, unit-family 3.
- Integración: no corrida, sin base (el worktree no tiene `.env`; solo `.env.example`). Los int tests
  tocados compilan (typecheck verde).

Veredicto: tanda 2 verde en typecheck, lint y unit; falta correr la integración contra Postgres.
### Verificación (tanda 2)

- `pnpm run typecheck`: sin errores.
- `pnpm run lint`: 0 errores, 7 warnings preexistentes en archivos no tocados.
- `pnpm exec vitest run guard`: 76 archivos, 1064 verdes, 20 saltados. Un primer intento dio 2 rojos (`guard-ambito-empresa-pedidos`, `guard-dobles-e2e`). La causa fue un CRLF que mis ediciones metieron en `lib/composition/index.ts` y otros 6 archivos; volvieron a LF y las dos guardias quedaron verdes.
- Unit tocados por ruta (9 archivos): 207 verdes.
- Integración contra Postgres (`--project integration`): `supply-homonyms`, `product-unit-without-presentation`, `product-batch-lot`, `qc195-packaging-product`: 4 archivos, 37 verdes. Los 4 `inventory-import-*` que usan `inventory-import-wiring.ts`: 23 verdes y 1 saltado, el `skipIf` preexistente `QC209_MEDIR_2000`.
- `pnpm exec vitest related --run <7 archivos de producción> --project node --project ui`: 474 archivos, 8488 verdes, 7 saltados, 1 rojo (836 s).
  - El rojo es `product-page.test.tsx > un guardado rechazado por un campo…`, que excedió el tiempo límite de 20000 ms bajo carga. No está en `baseline-rojos.json`.
  - Corrido solo, ese archivo da 84/84 verdes.

Veredicto: tanda 2 verde; T4, T5 y T6 hechas. Queda abierto el borde de R7 descrito arriba.

## Tanda 3 — aviso en «Nuevo producto» (T7, T8) · 2026-10-14

### Archivos
- `components/shared/presentation-unit-select.tsx`: prop opcional `hint` (texto visible bajo el campo, `PRESENTATION_UNIT_HINT_TESTID`, enlazado por `aria-describedby` junto al del error). Sin `hint` el árbol no cambia.
- `components/shared/CATALOGO.md`: fila de `PresentationUnitSelect` con `hint` en Alcance y en Puntos de extensión.
- `app/(private)/inventario/components/use-supply-homonyms.ts` (nuevo): `findSupplyHomonymsAction` con rebote de 400 ms, solo al cambiar el nombre y solo en alta de insumo. El nombre vive en una referencia: teclear no repinta el formulario (medido: sin eso, el caso de 201 caracteres de `product-page.test.tsx` pasaba de ~4,5 s a ~6,7 s). Un fallo de lectura deja la lista vacía.
- `app/(private)/inventario/components/supply-conversion-notice.tsx` (nuevo): compone `Notice tone="info"`; `resolveSupplyDestination` (usa `pickSupplyTarget`), `checkConvertedSupplyBatch` (usa `convertSupplyBatch`), `supplyUnitHint`, `displayDecimal` (`trimDecimal` + coma) y `unitDisplayLabel`. Textos de `design.md > 6`.
- `app/(private)/inventario/components/product-form.tsx`: unidad controlada; aviso entre «Unidad» y «Existencia»; `hint` en «Unidad» solo cuando convierte; validación previa con el mismo destino (error en `stock` o `unitCost`, no envía); `converted_stock_out_of_range` → `stock` y `converted_cost_out_of_range` → `unitCost` desde el servidor; `onSaved({ lot, conversion })` (`ProductSaved`).
- `app/(private)/inventario/components/product-sheet.tsx`: toast `Se agregó un lote de {e'} {ud} a {n} · {ud}.` con `conversion` del servidor; si la unidad no está en `formUnits`, queda el aviso de siempre.
- `app/(private)/inventario/components/product-name-picker.tsx`: `onNameChange`.
- `app/(private)/inventario/components/product-cost-fields.tsx`: `onUnitCostChange` (avisa del unitario que viajará, tecleado o deducido del total).
- Tests: `tests/unit/configuracion-ui/presentation-unit-select.test.tsx` (3 casos nuevos; el archivo tenía finales mixtos en el índice y queda en LF), `tests/unit/inventario-ui/product-form-conversion.test.tsx` (nuevo).

### Mapa R -> test (tanda 3)
| R | Test |
|---|---|
| R13 | `product-form-conversion.test.tsx`: `R13 con homónimo en l y alta en ml muestra aviso con cantidad y costo convertidos y la ayuda bajo Unidad`, `R13 se recalcula al cambiar la unidad o la existencia sin volver a pedir`, `R13 sin costo unitario el aviso no trae la línea de costo`; `presentation-unit-select.test.tsx`: `con \`hint\` pinta el texto visible y el campo lo referencia por aria-describedby` |
| R14 | `R14 con varios homónimos nombra cada uno y el destino` |
| R15 | `R15 sin homónimo o con uno en la misma unidad no hay aviso`; `presentation-unit-select.test.tsx`: `sin \`hint\` el árbol no cambia: ni texto de ayuda ni descripción añadida` |
| R16 | `R16 cantidad que no cabe: error bajo Existencia y no envía`, `R16 costo que no cabe: error bajo Costo unitario`, `R16 el rechazo del servidor con converted_stock_out_of_range va a Existencia` |
| R17 | `R17 el toast nombra la cantidad convertida y el destino` |

### Verificación (tanda 3)
- `pnpm run typecheck` → `tsc --noEmit`, exit 0.
- `pnpm run lint` → `✖ 7 problems (0 errors, 7 warnings)`; los mismos 7 warnings ajenos.
- `pnpm exec vitest run` sobre presentation-unit-select, todo `tests/unit/inventario-ui/` (incluye product-form-conversion, product-form-unidad, product-form-tipo-autocomplete), product-page, product-field, scope, import-missing-catalog, configuracion-convenciones, paridad (buscadores, error-alert, formularios), pedidos-ui (order-form ×3, order-sheet, toasts, viewport), proveedores-ui (catalog-import-review, catalog-line-sheet) y shared (presentation-select-helper, presentation-select-unit-filter) → 27 archivos, 544 verdes, 3 saltados.
- `pnpm exec vitest run guard` → 76 archivos, 1064 verdes, 20 saltados.
- Finales de línea: LF en todo lo tocado (0 bytes CR).

Notas:
- El tablero pinta «4,0000 por l»; `design.md > 5` pide sin ceros sobrantes, así que sale «4 por l».
- La línea de costo sale cuando el campo «Costo unitario» tiene valor, también si se dedujo del total: es lo que se envía y lo que el servidor convierte.

Veredicto: tanda 3 verde; T7 y T8 hechas.

## Tanda 4 — importación desde Excel (T9) · 2026-10-14

### Archivos
- `lib/modules/inventario/ports/inventory-import-repository.ts`: `ImportProductRef.stock`.
- `lib/modules/inventario/adapters/driven/persistence/inventory-import-prisma.ts`: `stock` en el `select` común (lo usan las dos consultas), como texto con 4 decimales.
- `lib/modules/inventario/domain/inventory-import-contract.ts`: `converted_stock_out_of_range` y `converted_cost_out_of_range` en `IMPORT_ROW_ISSUE_CODES`.
- `lib/modules/inventario/domain/plan-inventory-import.ts`: textos de §6 en `ISSUE_TEXT`; `resolveSupplyIdentity` (clave `P|{nombre}|{familia}`, destino con `pickSupplyTarget`); `FileProduct.unitId`; `alsoOccupies` del terminado por familia; `checkConversion` (vista previa: `convertSupplyBatch` y `deriveUnitCost` sobre la existencia convertida).
- `lib/modules/inventario/domain/confirm-inventory-import.ts`: `writeRow` traduce `ConvertedStockOutOfRangeError` y `ConvertedCostOutOfRangeError`.
- `tests/unit/inventario/inventory-import-kit.ts`: unidad `ML` (deriva de `LITRO`, factor 0.001) en el snapshot y en `listVisibleRefs`; `productRef` con `stock`.
- `tests/integration/inventario/inventory-import-repository.int.test.ts`: caso R19 nuevo; el caso R17 que fijaba el objeto entero gana `stock: '0.0000'`.
- Nuevos: `tests/unit/inventario/plan-inventory-import-familia.test.ts`, `tests/unit/inventario/confirm-inventory-import-familia.test.ts`.
- `tests/integration/inventario/inventory-import-wiring.ts`: sin cambios; la tanda 2 ya lo dejó con `findAliveSupplyHomonyms` y `units.findRefs`.
- `plan-inventory-import.test.ts`: sin cambios; ningún caso fijaba «nombre + unidad» entre unidades de la misma familia.

### Mapa R -> test (tanda 4)
| R | Test |
|---|---|
| R18 | `plan-inventory-import-familia.test.ts`: `R18 fila en ml con homónimo en l queda en sumar lote sobre ese producto`, `R18 segunda fila del archivo en otra unidad de la familia suma sobre la primera`, `R18 otra familia queda en crear` |
| R19 | `confirm-inventory-import-familia.test.ts`: `R19 la confirmación escribe el lote convertido sobre el destino`; `inventory-import-repository.int.test.ts`: `R19 findAliveProductsByNormalizedNames devuelve la existencia` |
| R20 | `plan-inventory-import-familia.test.ts`: `R20 existencia convertida que no cabe deja la fila en error en Existencia`, `R20 costo convertido que no cabe deja la fila en error en Costo unitario`, `R20 total derivado en 0 tras convertir deja la fila en error en Costo total`; `confirm-inventory-import-familia.test.ts`: `R20 la confirmación no escribe la fila que no cabe` (fila en error desde la vista previa y filas que el alta rechaza porque la base cambió) |

### Verificación (tanda 4)
- `pnpm run typecheck` → `tsc --noEmit`, exit 0.
- `pnpm run lint` → `✖ 7 problems (0 errors, 7 warnings)`; los mismos 7 warnings ajenos de la tanda 2.
- `pnpm exec vitest run` sobre plan-inventory-import-familia, confirm-inventory-import-familia, plan-inventory-import, confirm-inventory-import, preview-inventory-import, create-product-familia y guard-ambito-empresa-inventario → 7 archivos, 123 verdes.
- `pnpm exec vitest run --project integration` sobre los 5 `inventory-import-*.int.test.ts` (repository, confirm, finished-goods, idempotency, isolation) → 36 verdes, 1 saltado (el `skipIf` preexistente `QC209_MEDIR_2000`).
- `pnpm exec vitest run guard` → 76 archivos, 1064 verdes, 20 saltados.
- Finales de línea: LF en todo lo tocado.

Nota: el borde de R7 de la tanda 2 (el esquema rechaza el costo total sobre la existencia sin convertir) se ve igual en la vista previa, porque la planificación valida con el mismo `createProductSchema`. Vista previa y confirmación siguen coincidiendo.

Veredicto: tanda 4 verde; T9 hecha.

## Tanda 5 — T10 servidor (materia prima de fórmula con unidad)

### Archivos
Producción (modificados):
- `lib/modules/documentos/domain/formula-import-input.ts`: la línea `new` exige `unitId: uuid`.
- `lib/modules/documentos/domain/review-formula-import.ts`: `DraftLine.new.unitId: string | null`, `RowProblem` `new_unit_missing`.
- `lib/modules/documentos/domain/preview-formula-import.ts`: `FormulaImportDeps.units: Pick<UnitCatalog, 'findRefs'>`.
- `lib/modules/documentos/domain/confirm-formula-import.ts`: `units.findRefs` de las unidades elegidas y de los homónimos antes de crear; elegible = no terminado, con unidad y de la familia (`unitFamilyId`); `createRawMaterial({ name, unitId })`; resumen con `created` y `reused`.
- `lib/modules/inventario/domain/create-raw-material.ts`: esquema `{ name, unitId }`, `deps.units.findRefs`, `products.create` con `unitId`.
- `lib/modules/inventario/adapters/driven/persistence/product-prisma.ts`: `createProduct` escribe `unitId`.
- `lib/composition/index.ts`: `units` en `createRawMaterial` y en `formulaImportDeps`.

Tests: nuevo `tests/unit/documentos/confirm-formula-import-unidad.test.ts`; casos nuevos en `review-formula-import.test.ts`, `create-raw-material.test.ts`, `create-raw-material.int.test.ts`; dobles adaptados en `confirm-formula-import.test.ts`, `preview-formula-import.test.ts`, `formula-import-authorization.test.ts`, `formula-import-actions.test.ts`, `formula-import.int.test.ts`, `formula-import-versions.int.test.ts`.

Nota: el homónimo se resuelve con `productNames.findAliveByNormalizedNames` (ya trae `unitId`), como pide `design.md > 8.2`; `findAliveSupplyHomonyms` es un método de `ProductRepository` que `documentos` no ve por contrato.

### Mapa R → test (T10)
| R | Test |
|---|---|
| R23 | `review-formula-import.test.ts`: `R23 una fila nueva sin unidad da new_unit_missing y no se puede confirmar` |
| R24 | `confirm-formula-import-unidad.test.ts`: `R24 sin unidad rechaza invalid_input sin crear`, `R24 unidad no visible rechaza sin crear`; `create-raw-material.test.ts`: `R24 unidad de otra empresa da ValidationError`, `R24 sin unidad da ValidationError sin tocar el puerto` |
| R25 | `confirm-formula-import-unidad.test.ts`: `R25 crea la materia prima con la unidad elegida`; `create-raw-material.test.ts`: `R25 guarda la unidad`; `create-raw-material.int.test.ts`: `R25 products.unit_id queda escrito` |
| R26 | `confirm-formula-import-unidad.test.ts`: `R26 reutiliza el único homónimo de la familia`, `R26 más de uno de la familia rechaza`, `R26 un homónimo sin unidad o de otra familia no cuenta y crea` |
| R27 | `confirm-formula-import-unidad.test.ts`: `R27 el resumen trae creadas con unidad y reutilizadas` |
| R28 | `confirm-formula-import-unidad.test.ts`: `R28 sin inventario.modificar no crea` |

### Verificación (tanda 5)
- `pnpm typecheck` → rojo SOLO en archivos de T11: `formula-import-review.tsx` (3), `formula-ingredient-row.tsx` (1) y `tests/unit/recetas-ui/formula-import-review.test.tsx` (1; el `FormulaImportSummary` gana `created`/`reused`). Ningún error fuera de T11.
- `pnpm lint` → `✖ 7 problems (0 errors, 7 warnings)`, los mismos 7 ajenos.
- `pnpm exec vitest run` sobre review-formula-import, confirm-formula-import-unidad, confirm-formula-import, preview-formula-import, formula-import-authorization, formula-import-actions, create-raw-material, create-raw-material-alcance y documentos/module-contract → 9 archivos, 163 verdes.
- `pnpm exec vitest run --project integration`: create-raw-material (2 verdes), formula-import (13 verdes), formula-import-versions (2 verdes).
- `pnpm exec vitest run guard` → 76 archivos, 1064 verdes, 20 saltados.
- Finales de línea: LF.

Veredicto: T10 verde en servidor; el typecheck queda rojo hasta T11 (UI de la revisión).

## Tanda 5 — T11 UI de la revisión de fórmula

### Archivos
Producción (modificados), en `app/(private)/produccion/formulas/importar/[documentoId]/components/`:
- `formula-import-review.tsx`: la fila gana `newUnitId` y `newUnitSource` (`suggested | none | ambiguous | missing | picked`). El valor inicial sale de `suggestUnitId(unitRead, units)`. Para separar «ninguna» de «más de una» se cuentan las coincidencias con `normalizeUnitName`. `toDraftLine` y `toConfirmLine` mandan `unitId`. `ROW_PROBLEM_LABELS` gana `new_unit_missing: 'sin unidad'`. La unidad vacía NO deshabilita «Confirmar»: al pulsarlo, enciende `showUnitErrors`, no llama a la action, y desde ahí la fila y los motivos la marcan (R23, tablero: `confirm → tried`). El resumen recibe `units`.
- `formula-ingredient-row.tsx`: en modo `create`, `PresentationUnitSelect` controlado (`name={null}`, `value`, `onValueChange` → `picked`, `hint`, `error`) junto a «Nombre» (`sm:grid-cols-[minmax(0,1fr)_12.5rem]`; en teléfono va debajo, a todo el ancho). Entra con `animate-in fade-in`. Los textos de la ayuda y el error son los de `design.md > 6`.
- `formula-import-summary.tsx`: prop `units`; bajo cada contador va la lista `Nombre · u` de las creadas y los nombres de las reutilizadas, o `EMPTY_MARK` si no hay ninguna.
- `page.tsx`: sin cambios (ya pasaba `units` de `listUnitsAction()`).

Tests:
- Nuevo: `tests/unit/recetas-ui/formula-import-unidad.test.tsx`.
- Adaptados:
  - `formula-import-review.test.tsx`: el resumen lleva `created`/`reused`; la fila «crear» pide unidad; el selector tiene `min-h-11`.
  - `formula-import-page.test.tsx`: caso nuevo `R21 … sugiere la unidad leida entre las de listUnitsAction`. Además, el saneador de `useId` acepta letras (`_r_h_`): con un render más antes, el contador de React ya las emitía.

### Mapa R → test (T11)
| R | Test (`formula-import-unidad.test.tsx` salvo indicación) |
|---|---|
| R21 | `R21 con «kg» leído preselecciona kg y dice que se sugirió del PDF`; `formula-import-page.test.tsx`: `R21 una fila «Crear materia prima» sugiere la unidad leida entre las de listUnitsAction` |
| R22 | `R22 con «gotas» queda vacía con su ayuda`, `R22 sin unidad en el PDF queda vacía con su ayuda`, `R22 con dos coincidencias queda vacía con su ayuda`, `R22 al elegir a mano dice Elegida por ti` |
| R23 | `R23 Confirmar con una vacía marca el error en esa fila y no llama a la action` |
| R27 | `R27 el resumen lista las creadas con su unidad`, `R27 sin creadas ni reutilizadas el resumen pinta una raya` |

### Verificación (T11)
- `pnpm run typecheck` → exit 0, verde en todo el repo.
- `pnpm run lint` → `✖ 7 problems (0 errors, 7 warnings)`, los mismos 7 ajenos.
- `pnpm exec vitest run tests/unit/recetas-ui` → 28 archivos, 533 verdes.
- `pnpm exec vitest related --run` sobre los 3 componentes y los 3 tests → 3 archivos, 48 verdes.
- `pnpm exec vitest run guard` → 76 archivos, 1064 verdes, 20 saltados. Una primera pasada dio rojo en `guard-piezas-base` R25 por una constante local `'—'`; ahora se usa `EMPTY_MARK`.
- Finales de línea: `git ls-files --eol` da `w/lf` en todos; `file` no marca CRLF.

Veredicto: T11 verde; typecheck del repo en verde.

## Tanda 6 — T12 E2E, T13 revisión de E2E, T15 gate y trazabilidad

### Archivos
- Nuevo: `e2e/inventario-familia-de-unidad.spec.ts`, con un solo caso: `R30 alta de Glicerina 500 ml sobre Glicerina en l avisa, guarda y la existencia sube 0,5 l`.
  - Fixture: empresa y Administrador propios por corrida (`createFixtureUser`, prefijo `qc203_e2e_`). «Glicerina» en l se siembra por Prisma con un lote de 2 l y su asiento `opening`.
  - El recorrido:
    1. El listado parte de `2 l`.
    2. Se abre «Nuevo producto», se elige ml, existencia 500.
    3. `supply-conversion-notice-stock` = `500 ml = 0,5 l`.
    4. Al guardar, la fila muestra `2.5 l`, y sigue así tras recargar; hay una sola fila.
  - En Postgres: un solo producto vivo «Glicerina» en l, y su lote nuevo tiene `stock.toFixed(4) === '0.5000'`.
  - El listado muestra `2.5 l` con punto porque `formatDecimalDisplay` no usa coma; el test afirma lo que se pinta.
- Modificado: `tests/guards/guard-identificador-de-request.test.ts`. Se da de alta `inventario-familia-de-unidad.spec.ts` en `E2E_ESPERADOS`, con su comentario, como hicieron QC-262 y los demás. Sin esa línea, la guardia R21 de QC-71 se ponía roja con «archivo nuevo en e2e/».

### T13 — sin diff
- `e2e/inventario.spec.ts` (caso R26 de QC-121): homónimos en kg y L, que son dos familias distintas. La regla nueva no lo afecta.
- `e2e/insumo-por-unidad.spec.ts`: los dos altas son en kg. Es la misma unidad y ya esperaba un solo producto.
- `e2e/inventario-importar.spec.ts`: las filas del homónimo `insumo_existente` van en kilogramo, igual que el sembrado. Las dos filas de `tambor` usan la misma unidad.
- Ninguno crea el mismo nombre en dos unidades de una misma familia esperando dos productos.

### Mapa R1..R30 → test (consolidado)
| R | Tests nombrados |
|---|---|
| R1 | `supply-family.test.ts`: `R1 solo cuentan homónimos con unidad de la misma familia`; `unit-family.test.ts`: `R1 una derivada pertenece a la familia de su base`; `supply-homonyms.int.test.ts`: `R1 devuelve los vivos con unidad del mismo nombre normalizado…`, `R1 no devuelve los dados de baja ni los sin unidad`; `create-product-familia.test.ts`: `R1 un homónimo de otra familia no cuenta y crea` |
| R2 | `supply-family.test.ts`: `R2 una unidad suelta es su propia familia`; `unit-family.test.ts`: `R2 una unidad suelta, sin base ni derivadas, es su propia familia` |
| R3 | `create-product-familia.test.ts`: `R3 sin homónimo crea con la unidad del alta` |
| R4 | `supply-family.test.ts`: `R4 500 ml pasan a 0.5 l`; `create-product-familia.test.ts`: `R4 con homónimo en otra unidad agrega el lote convertido y no crea`, `R4 con homónimo en la misma unidad agrega sin convertir` |
| R5 | `supply-family.test.ts`: `R5 gana el de más existencia comparada en la base sin truncar`, `R5 en empate gana el primero (más antiguo)`; `create-product-familia.test.ts`: `R5 entre varios va al de más existencia` |
| R6 | `supply-family.test.ts`: `R6 0.004 por ml pasa a 4 por l`; `create-product-familia.test.ts`: `R6 convierte el costo unitario` |
| R7 | `create-product-familia.test.ts`: `R7 con solo costo total deriva sobre la existencia convertida`, `R7 si el derivado queda en 0 rechaza como hoy` |
| R8 | `supply-family.test.ts`: `R8 0.25 ml a l no cabe y no se redondea`, `R8 más de 10 cifras enteras no cabe`; `create-product-familia.test.ts`: `R8 existencia que no cabe: ConvertedStockOutOfRangeError sin escribir` |
| R9 | `supply-family.test.ts`: `R9 0.25 por l a ml no cabe`; `create-product-familia.test.ts`: `R9 costo que no cabe: ConvertedCostOutOfRangeError sin escribir` |
| R10 | `create-product-familia.test.ts`: `R10 destino terminado: action_not_allowed sin escribir` |
| R11 | `create-product-familia.test.ts`: `R11 sin inventario.modificar no consulta ni escribe`; `find-supply-homonyms.test.ts`: `R11 sin inventario.modificar responde unauthorized sin consultar` |
| R12 | `find-supply-homonyms.test.ts`: `R12 pasa al puerto la empresa del actor y nunca la de la entrada`; `supply-homonyms.int.test.ts`: `R12 no devuelve el homónimo de otra empresa` |
| R13 | `product-form-conversion.test.tsx`: `R13 con homónimo en l y alta en ml muestra aviso…`, `R13 se recalcula al cambiar la unidad o la existencia sin volver a pedir`, `R13 sin costo unitario el aviso no trae la línea de costo`; E2E `R30 alta de Glicerina 500 ml…` |
| R14 | `product-form-conversion.test.tsx`: `R14 con varios homónimos nombra cada uno y el destino` |
| R15 | `product-form-conversion.test.tsx`: `R15 sin homónimo o con uno en la misma unidad no hay aviso` |
| R16 | `product-form-conversion.test.tsx`: `R16 cantidad que no cabe: error bajo Existencia y no envía`, `R16 costo que no cabe: error bajo Costo unitario`, `R16 el rechazo del servidor con converted_stock_out_of_range va a Existencia` |
| R17 | `product-form-conversion.test.tsx`: `R17 el toast nombra la cantidad convertida y el destino` |
| R18 | `plan-inventory-import-familia.test.ts`: `R18 fila en ml con homónimo en l queda en sumar lote sobre ese producto`, `R18 segunda fila del archivo en otra unidad de la familia suma sobre la primera`, `R18 otra familia queda en crear` |
| R19 | `confirm-inventory-import-familia.test.ts`: `R19 la confirmación escribe el lote convertido sobre el destino`; `inventory-import-repository.int.test.ts`: `R19 findAliveProductsByNormalizedNames devuelve la existencia` |
| R20 | `plan-inventory-import-familia.test.ts`: `R20 existencia convertida que no cabe…`, `R20 costo convertido que no cabe…`, `R20 total derivado en 0 tras convertir…`; `confirm-inventory-import-familia.test.ts`: `R20 la confirmación no escribe la fila que no cabe` |
| R21 | `formula-import-unidad.test.tsx`: `R21 con «kg» leído preselecciona kg y dice que se sugirió del PDF`; `formula-import-page.test.tsx`: `R21 una fila «Crear materia prima» sugiere la unidad leida entre las de listUnitsAction` |
| R22 | `formula-import-unidad.test.tsx`: `R22 con «gotas» queda vacía con su ayuda`, `R22 sin unidad en el PDF…`, `R22 con dos coincidencias…`, `R22 al elegir a mano dice Elegida por ti` |
| R23 | `review-formula-import.test.ts`: `R23 una fila nueva sin unidad da new_unit_missing y no se puede confirmar`; `formula-import-unidad.test.tsx`: `R23 Confirmar con una vacía marca el error en esa fila y no llama a la action` |
| R24 | `confirm-formula-import-unidad.test.ts`: `R24 sin unidad rechaza invalid_input sin crear`, `R24 unidad no visible rechaza sin crear`; `create-raw-material.test.ts`: `R24 unidad de otra empresa da ValidationError`, `R24 sin unidad da ValidationError sin tocar el puerto` |
| R25 | `confirm-formula-import-unidad.test.ts`: `R25 crea la materia prima con la unidad elegida`; `create-raw-material.test.ts`: `R25 guarda la unidad`; `create-raw-material.int.test.ts`: `R25 products.unit_id queda escrito` |
| R26 | `confirm-formula-import-unidad.test.ts`: `R26 reutiliza el único homónimo de la familia`, `R26 más de uno de la familia rechaza`, `R26 un homónimo sin unidad o de otra familia no cuenta y crea` |
| R27 | `confirm-formula-import-unidad.test.ts`: `R27 el resumen trae creadas con unidad y reutilizadas`; `formula-import-unidad.test.tsx`: `R27 el resumen lista las creadas con su unidad`, `R27 sin creadas ni reutilizadas el resumen pinta una raya` |
| R28 | `confirm-formula-import-unidad.test.ts`: `R28 sin inventario.modificar no crea` |
| R29 | `create-product-familia.test.ts`: `R29 solo llama a addBatchToAlive sobre el destino`; `supply-homonyms.int.test.ts`: `R29 tras el alta convertida el otro homónimo conserva unidad, existencia y lotes` |
| R30 | `e2e/inventario-familia-de-unidad.spec.ts`: `R30 alta de Glicerina 500 ml sobre Glicerina en l avisa, guarda y la existencia sube 0,5 l` |

Todos los R1..R30 tienen al menos un test nombrado. Ningún R queda sin test.

### Verificación (Tanda 6)
- `pnpm exec playwright test e2e/inventario-familia-de-unidad.spec.ts` dio `2 passed (1.5m)`: chromium 44.9s y webkit 45.8s.
- `pnpm exec playwright test e2e/inventario.spec.ts e2e/insumo-por-unidad.spec.ts e2e/inventario-importar.spec.ts` se corrió a la vez que el typecheck y dio `4 failed, 16 passed`. Los 4 rojos estaban en `inventario.spec.ts`, todos con `PrismaClientInitializationError … The paging file is too small for this operation to complete`: la máquina se quedó sin memoria, no falló una aserción. Al repetir `inventario.spec.ts` solo, sin nada en paralelo, dio `16 passed (3.7m)`. Los otros dos specs ya habían quedado verdes en la primera corrida. Ningún caso se saltó.
- `pnpm run typecheck`: exit 0.
- `pnpm run lint`: `✖ 7 problems (0 errors, 7 warnings)`, los mismos 7 ajenos de antes.
- `pnpm exec vitest related --run e2e/inventario-familia-de-unidad.spec.ts`: «No test files found». El archivo es de Playwright y Vitest excluye `e2e/**`.
- `pnpm exec vitest run guard`: la primera pasada dio 1 rojo, `guard-identificador-de-request > no hay ningun archivo nuevo en e2e/… (R21)`. Tras dar de alta el spec en `E2E_ESPERADOS`, dio 76 archivos, 1064 verdes y 20 saltados.
- No se corrió `./init.sh`, ni el rápido ni el `--completo`, por indicación del leader. Se corrieron por separado las piezas que el leader pidió.
- Finales de línea: LF.

Veredicto: Tanda 6 verde. T12, T13 y T15 quedan marcadas.
