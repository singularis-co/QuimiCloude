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

## T4 — Terminar con excedente (backend_dev, 2026-10-20)

Grafo (MCP) no consultado en esta tanda: Grep/Read sobre el worktree.

### Archivos

- `lib/modules/pedidos/ports/order-write-repository.ts`: `FinishPackingLine.packedSurplusPackages`;
  `RecordedPackedLine = PackedLineCount & { packedSurplusPackages }`; `recordPackedCounts` la recibe.
- `lib/modules/pedidos/adapters/driven/persistence/order-prisma.ts`: `findPresentationLinesForFinishOrder`
  selecciona `packed_surplus_packages`; `recordPackedCountsForOrder` lo escribe en el mismo `UPDATE`.
- `lib/modules/pedidos/domain/order-packing.ts`: `resolveSurplus` (sobre `packingSurplusByLine`) sustituye a
  `assertPackedConvertible`; `withSurplus` añade los libres a cada conteo antes de `recordPackedCounts`,
  en el mismo punto del flujo (antes de `settlePackaging`, dentro de la unidad de trabajo). Cabecera ajustada.
- Tests:
  - `tests/unit/pedidos/order-packing.test.ts`: `lineaDe` con `packedSurplusPackages: 0`; el caso R1 de
    unidades mixtas afirma 1 libre de 200 ml; bloque nuevo «Terminar con excedente: plan 5 x 1 L + 1 x 5 L»;
    el caso R16 (QC-281) afirma los conteos con `packedSurplusPackages: 0`.
  - `tests/unit/asignaciones/finish-packing.test.ts`: bloque «finishPacking con excedente» (R27).
  - `tests/integration/pedidos/order-packed-counts.int.test.ts`: `count` devuelve `RecordedPackedLine`;
    bloque «envases libres» y CHECK de libres.
  - `tests/integration/pedidos/finish-with-finished-goods.int.test.ts`: `lineasDe` lee la columna; caso
    R1 ampliado con el libre; casos nuevos del «Hecho», R4 (rechazo y cubierto).
  - `tests/unit/pedidos/{deliver-order,get-order-delivery,list-order-deliveries}.test.ts`: solo
    `packedSurplusPackages: 0` en los fixtures de `FinishPackingLine` para compilar (T5 añade los casos).
- `effectivePackages`: su docstring («entregar, acondicionar y consultar») sigue siendo cierto mientras la
  entrega no pase a `orderedPackages`; se ajusta en T5.

### R → test (T4)

| R | Test |
|---|---|
| R1 | `order-packing.test.ts` «R1, R6, R8: lo envasado por encima de la cantidad… guarda sus libres», «R1, R6, R8, R9: con 12 x 1 L + 0 x 5 L acepta y guarda 2 libres…»; `finish-with-finished-goods.int.test.ts` «R1, R8, R9: lo envasado por encima…», «R1, R6, R8, R9, R10: plan 5 x 1 L + 1 x 5 L con real 12 x 1 L + 0 x 5 L termina…» |
| R2 | `order-packing.test.ts` «R2: con excedente, la linea por encima del plan %s rechaza con invalid_packing_count sin guardar nada» (sin motivo, motivo de «menos», «Otro» en blanco, «Otro» de 201) |
| R3 | `order-packing.test.ts` «R3: con excedente, una linea en una unidad que no se convierte… incompatible_units sin guardar libres» |
| R4 | `order-packing.test.ts` «R4, R8: con excedente, sin stock libre del envase… deshace los libres ya escritos»; `finish-with-finished-goods.int.test.ts` «R4, R8: con excedente, si el exceso sobre el plan supera el stock libre…», «R4: con excedente, si el stock libre del envase cubre el exceso… termina» |
| R5 | `order-packing.test.ts` «R5: con 9 x 1 L + 0 x 5 L no supera la cantidad y guarda 0 libres…» |
| R6 | los de R1 (2 libres de 1 L; 1 libre de 200 ml); `order-packed-counts.int.test.ts` «R6, R8: los libres solo caben en una linea contada y por encima de su plan…» |
| R8 | `order-packed-counts.int.test.ts` «R8: guarda los libres de cada linea con su conteo…», «R8, R11: un conteo sin libres guarda 0…», «R8: unos libres por encima de lo que la linea paso de su plan los rechaza la base…»; `finish-with-finished-goods.int.test.ts` los de R1 y R4 |
| R9 | `finish-with-finished-goods.int.test.ts` «R1, R6, R8, R9, R10…» (un lote de 12 L, ninguno de la garrafa en 0); `order-packing.test.ts` «R1, R6, R8, R9…» |
| R10 | `order-packing.test.ts` «R10: el coste del pedido se reparte entre los 12 L envasados…»; `finish-with-finished-goods.int.test.ts` «R1, R6, R8, R9, R10…» (coste del pedido intacto, unitario = coste / 12, suma = coste) |
| R27 | `finish-packing.test.ts` «R27: el actor con `empaque.modificar` que empaca el pedido termina…», «R27: sin `empaque.modificar` rechaza…», «R27: si el pedido lo empaca otro…», «R27: si el pedido ya no esta EN_EMPAQUE…» |

### Verificación

- `pnpm run typecheck`: verde (`tsc --noEmit` sin salida).
- `pnpm run lint`: `✖ 10 problems (0 errors, 10 warnings)`, todos en archivos que esta tanda no toca.
- `pnpm exec vitest run guard`: `Test Files 84 passed (84)`, `Tests 1148 passed | 21 skipped (1169)`.
- `pnpm exec vitest run` por archivo: `order-packing.test.ts` 63/63; `finish-packing.test.ts` 71/71;
  `order-packed-counts.int.test.ts` 12/12; `finish-with-finished-goods.int.test.ts` 33/33 (con el `.env`
  del repo principal; plantilla `qct_tpl_88f19b5be81c` reutilizada, base de corrida creada y borrada).
- `pnpm exec vitest related --run <14 archivos tocados>` (con el `.env` del repo principal): salida 0,
  `Test Files 537 passed (537)`, `Tests 9221 passed | 2 skipped (9223)`.

### Veredicto

T4 hecho: Terminar con excedente guarda los libres por línea en la misma transacción; el «Hecho»
(5 x 1 L + 1 x 5 L → 12 x 1 L + 0 x 5 L: lote de 12 L, 2 libres en 1 L, coste = el del pedido) verde
contra Postgres real. Sin bloqueos.
