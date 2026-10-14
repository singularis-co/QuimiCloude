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
