# QC-290 — empaque-con-excedente · bitácora de implementación

## T0, T2, T3 — dominio de los libres, migración, retirada del error (backend_dev, 2026-10-20)

Grafo (MCP) no consultado en esta tanda: Grep/Read sobre el worktree.

### Archivos

- T0
  - `lib/modules/pedidos/domain/order-distribution.ts`: `compareDecimals` junto a `sameDecimal`.
  - `lib/modules/pedidos/domain/packing-count.ts`: `orderedPackages`, `SurplusLine`, `PackingSurplus`,
    `packingSurplusByLine` (design §2.1). `maxPackagesForLine` se queda (la borra T7).
  - `lib/modules/pedidos/index.ts`: publica `orderedPackages`, `packingSurplusByLine`, `PackingSurplus`,
    `SurplusLine`. `compareDecimals` no se publica (como `sameDecimal`).
  - `tests/unit/pedidos/packing-count.test.ts`: bloques `compareDecimals`, `packingSurplusByLine`,
    `orderedPackages`.
- T2
  - nuevos `db/migrations/20261020160000_order_presentation_lines_packed_surplus/{migration.sql,down.sql}`.
  - `db/schema.prisma`: `OrderPresentationLine.packedSurplusPackages`.
  - nuevo `tests/unit/pedidos/schema/order-presentation-lines-packed-surplus-migration.test.ts`.
  - `tests/guards/guard-identificador-de-request.test.ts`: la migración entra en `MIGRACIONES_ESPERADAS`
    (la guardia exige registrar toda migración nueva).
- T3
  - `lib/modules/errores/domain/error-codes.ts`, `error-catalog.ts`, `lib/modules/asignaciones/domain/errors.ts`,
    `asignaciones/index.ts`, `asignaciones/domain/finish-packing.ts`, `pedidos/domain/order-catalog.ts`.
  - `lib/modules/pedidos/domain/order-packing.ts` (fuera de la lista de T3, necesario para compilar):
    `RejectedFinish` pierde el código y `assertPackedWithinQuantity` pasa a `assertPackedConvertible`,
    que ya no rechaza por exceso. T4 la sustituye por `resolveSurplus`.
  - tests: `catalogo.test.ts` (106 → 105), `order-packing-actions.test.ts`, `finish-packing.test.ts`,
    y los dos casos que el cambio rompía, reescritos como «se acepta» (T4 los amplía con los libres):
    `order-packing.test.ts` (antes L860) y `finish-with-finished-goods.int.test.ts` (antes L1567).

### Migración

- `db:migrate:create` NO se corrió: `progress/deudas.md` (D3) lo prohíbe sobre la Postgres local
  compartida (pide un `reset` destructivo). Carpeta a mano, instante posterior a toda migración de
  esta rama, de `dev` y de los demás worktrees (la última ajena es `20261020120000_*`).
- Aplicada en la plantilla de test de la rama (`pnpm run db:test template` → `qct_tpl_88f19b5be81c`,
  108 migraciones; el paso 5 confirma el esquema al día con `schema.prisma`).
- Ciclo up → down → up sobre una copia desechable de la plantilla: columna `integer NOT NULL DEFAULT 0`
  y el CHECK presentes; tras `down.sql` ni columna ni CHECK, y el resto de constraints intacto; tras
  reaplicar, forma de la tabla idéntica a la inicial.
- La base de desarrollo (`QuimiCloude`) NO se tocó: va 4 migraciones atrás (la más antigua,
  `20261019120000_notifications`); ponerla al día es `pnpm run db:migrate`, decisión del humano.

### R → test (lo cubierto en esta tanda)

| R | Test |
|---|---|
| R1 | `order-packing.test.ts` «R1: lo envasado por encima de la cantidad, sumado en la unidad del pedido, se acepta sin tope propio»; `finish-with-finished-goods.int.test.ts` «R1, R9: lo envasado por encima de la cantidad del pedido se acepta, pasa a POR_ACONDICIONAR y el lote lleva lo real» |
| R3 | `packing-count.test.ts` «R3: una linea sin contenido se informa, haya o no excedente», «R3: una unidad inconvertible se informa, haya o no excedente» |
| R5 | `packing-count.test.ts` «R5: sin superar la cantidad no hay libres aunque una linea pase su plan (9 x 1 L + 0 x 5 L)», «R5: envasado exacto a la cantidad, sin libres» |
| R6 | `packing-count.test.ts` «R6: 7 x 1 L + 1 x 5 L deja 2 libres de 1 L», «R6: 12 x 1 L + 0 x 5 L deja 2 libres de 1 L; la linea por debajo del plan no deja libres», «R6: una linea nunca deja mas libres que reales menos plan…», «R6, R7: con unidades mezcladas…» |
| R7 | `packing-count.test.ts` «R7, P3: excedente de 5 L con 1 L +4 y 5 L +1…», «R7: lo que no llega a un envase entero sigue en el pedido», «R7: a igual contenido manda el orden del reparto», «R7: compara decimales en texto sin importar la escala» |
| R8 | `order-presentation-lines-packed-surplus-migration.test.ts` (instante, columna, `down.sql` exacto, modelo Prisma) — parcial: el guardado al Terminar es T4 |
| R11 | `order-presentation-lines-packed-surplus-migration.test.ts` «R8, R11: anade la columna entera, NOT NULL y con DEFAULT 0», «R11: no reescribe plan, conteo real ni motivos…», «R6, R11: el CHECK…»; `packing-count.test.ts` «R11, R12: sin conteo guardado ni libres, espera el plan» |
| R12 | `packing-count.test.ts` «R12: el pedido espera los reales menos los libres» — parcial: los lectores de entrega son T5 |
| R22 | `packing-count.test.ts` «R22: el resultado solo depende de los datos…» — parcial: el diálogo es T7 |
| R26 | `catalogo.test.ts` (105 códigos, claves = códigos); guardia `guard-catalogo-de-errores`; `grep packed_exceeds_quantity` vacío fuera de `specs/` y `progress/` |
| R28 | sin cambios en `package.json` |

### Verificación

- `pnpm run typecheck`: verde (`tsc --noEmit` sin salida).
- `pnpm run lint`: `✖ 10 problems (0 errors, 10 warnings)`, todos en archivos que esta tanda no toca.
- `pnpm exec vitest run guard`: `Test Files 84 passed (84)`, `Tests 1148 passed | 21 skipped (1169)`.
- `pnpm exec vitest run` de los archivos tocados: `packing-count.test.ts` 56/56; migración 6/6;
  `order-packing`, `finish-packing`, `order-packing-actions`, `catalogo` 190/190;
  `finish-with-finished-goods.int.test.ts` 30/30.
- `pnpm exec vitest related --run <archivos tocados>` (con el `.env` del repo principal cargado):
  `Test Files 1066 passed (1066)`, `Tests 17417 passed | 34 skipped (17451)`, salida 0. Es casi toda
  la suite porque los barrels `pedidos` y `asignaciones` los importa media app.

### Veredicto

T0, T2 y T3 hechos; T4 parte de `assertPackedConvertible` y de los dos casos «se acepta».
