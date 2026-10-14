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
