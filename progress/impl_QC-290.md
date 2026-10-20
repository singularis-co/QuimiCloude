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

## T6 — Lo libre suma al excedente sin pedido (R16, R17)

### Archivos

- `lib/modules/pedidos/adapters/driven/persistence/direct-delivery-prisma.ts`: `listWaitingOrderLines`
  selecciona `packedSurplusPackages` y calcula `orderedPackages` con `orderedPackages(line)` en vez de
  `effectivePackages(line)`.
- `lib/modules/pedidos/domain/direct-delivery.ts`: comentario de `WaitingOrderLine.orderedPackages`
  (cita `orderedPackages`; los libres quedan para el excedente).
- `tests/integration/pedidos/direct-delivery-repository.int.test.ts`: `OrderSeed` admite
  `packedSurplusPackages`; motivo `conteo_fisico` cuando el conteo pasa del plan (el CHECK
  `order_presentation_lines_packed_reason_matches_count` rechaza `merma` por encima); dos casos nuevos.

### Mapa R → test

| R | Test |
|---|---|
| R16 | `direct-delivery-repository.int.test.ts` «R16, R17: los libres de un pedido cubren lo que espera otro TERMINADO de la misma receta y presentacion» (12 en el lote: 10 del pedido con libres + 2 de otro pedido → excedente 0); y `finish-with-finished-goods.int.test.ts` «R1, R6, R8, R9, R10: plan 5 x 1 L + 1 x 5 L con real 12 x 1 L…» (el lote guarda los 12 L, libres incluidos) |
| R17 | `direct-delivery-repository.int.test.ts` «R16, R17: un TERMINADO de 10 con 12 reales y 2 libres espera 10, y con sus 12 envases en el lote el excedente es 2» |

### Salida real

- `pnpm run typecheck` (`tsc --noEmit`): sin errores.
- `pnpm run lint`: `✖ 10 problems (0 errors, 10 warnings)`, ninguno en archivos de T6
  (`eslint` sobre los 3 archivos: «No issues found»).
- `pnpm exec vitest run tests/integration/pedidos/direct-delivery tests/unit/pedidos/direct-delivery
  tests/unit/pedidos/deliver-direct tests/unit/pedidos/list-direct-delivery-surplus
  tests/unit/pedidos/get-direct-delivery` (con `../../.env`, base de test efímera):
  `Test Files  11 passed (11)` / `Tests  151 passed (151)`. Incluye los 6 `.int` direct-delivery* y los
  5 unit de QC-288 (`deliver-direct`, `direct-delivery`, `get-direct-delivery`,
  `get-direct-delivery-for-void`, `list-direct-delivery-surplus`).

### Veredicto

T6 hecho: los pedidos `TERMINADO` esperan reales − libres, y los libres suman al excedente sin pedido
(12 reales, 2 libres → espera 10, excedente 2) verde contra Postgres real. Sin bloqueos.

## T5 — Entrega espera solo lo pedido (R12–R15, R18) (backend_dev, 2026-10-20)

Grafo (MCP) no consultado en esta tanda: Grep/Read sobre el worktree.

### Archivos

- `lib/modules/pedidos/domain/order-catalog.ts`: `OrderDeliveryProgressLine.packedSurplusPackages`.
- `lib/modules/pedidos/adapters/driven/persistence/order-catalog-prisma.ts`: `listOrderDeliveryProgressByIdsIncludingDeleted`
  selecciona `packedSurplusPackages`; `toOrderDeliveryProgress` lo pasa.
- `lib/modules/pedidos/domain/deliver-order.ts`, `get-order-delivery.ts`, `order-pending-delivery.ts`:
  `effectivePackages` → `orderedPackages` (docstring de `deliveryStateOf` ajustado).
- `lib/modules/pedidos/domain/packing-count.ts`: docstring de `effectivePackages` sin «entregar».
- Acondicionamiento (`conditioning-order-view.ts`, `conditioning-batch-data.ts`) y «Reparto»
  (`inventario/.../finished-product-detail.ts`, `asignaciones/domain/order-distribution-view.ts`) sin tocar (R18).
- Tests:
  - `tests/unit/pedidos/deliver-order.test.ts`: bloque «QC-290 — deliverOrder espera solo lo pedido».
  - `tests/unit/pedidos/get-order-delivery.test.ts`: bloque «QC-290 — getOrderDelivery espera solo lo pedido».
  - `tests/unit/pedidos/list-orders.test.ts`: `Linea` con `packedSurplusPackages`; dos casos R12.
  - `tests/unit/asignaciones/list-execution-traces.test.ts`: solo `packedSurplusPackages: 0` en el fixture
    de `OrderDeliveryProgressLine` para compilar.
  - `tests/integration/pedidos/order-delivery.int.test.ts`: bloque «QC-290 — la entrega espera solo lo
    pedido, contra Postgres» (plan 10 × 1 L, 12 reales, 2 libres, lote de 12).
- `list-order-deliveries.test.ts`: no aplica (su dominio no usa `effectivePackages`); sin cambios en T5.

### R → test (T5)

| R | Test |
|---|---|
| R12 | `get-order-delivery.test.ts` «R12, R15: los «pedidos» de cada presentacion son los reales menos los libres…», «R12: una linea cuyos libres cubren lo que paso de su plan, ya entregado el plan, no pide lotes»; `list-orders.test.ts` «R12: los envases libres no cuentan como pendientes: 12 reales con 2 libres esperan 10», «R12: entregados los 10 que espera el pedido, es entregado aunque los 2 libres sigan sin entregar»; `order-delivery.int.test.ts` «R12, R15: el sheet y el progreso del listado leen la columna y esperan 10, no los 12 reales» |
| R13 | `deliver-order.test.ts` «R13: 12 reales con 2 libres admiten como mucho 10: pedir 11 es delivery_exceeds_remaining…», «R13: con 3 ya entregados, el tope es 10 - 3 = 7…», «R13, R14: entregar los 10…»; `order-delivery.int.test.ts` «R13: pedir 11 envases de 1 L con 12 reales y 2 libres es delivery_exceeds_remaining sin escribir nada» |
| R14 | `deliver-order.test.ts` «R13, R14: entregar los 10 que espera el pedido lo pasa a ENTREGADO aunque los 2 libres sigan en el lote»; `order-delivery.int.test.ts` «R13, R14: entregar los 10 que espera el pedido lo deja ENTREGADO y los 2 libres siguen en la existencia del lote» |
| R15 | `get-order-delivery.test.ts` «R12, R15: …»; `order-delivery.int.test.ts` «R12, R15: …» |
| R18 | sin tocar y verdes: `get-conditioning-order.test.ts` «R23: la fila y los datos de lote muestran los envases reales…», «R25: un pedido empacado sin conteo guardado…»; `conditioning-batch-data.test.ts` «QC-281 R23: …» (×2), «QC-281 R25: …»; `list-finished-product-distribution.test.ts` «R27: devuelve tal cual las filas igual, menos, mas…» (tab «Reparto») |

### Verificación

- `pnpm run typecheck`: verde (`tsc --noEmit` sin salida).
- `pnpm run lint`: `✖ 10 problems (0 errors, 10 warnings)`, las mismas de antes; las 2 de
  `list-execution-traces.test.ts` (L154, L158) son previas, no de la línea tocada.
- `pnpm exec vitest run guard`: `Test Files 84 passed (84)`, `Tests 1148 passed | 21 skipped (1169)`.
- `pnpm exec vitest run` de los unit tocados (`deliver-order`, `get-order-delivery`, `list-orders`,
  `list-execution-traces`, `list-order-deliveries`): `Test Files 5 passed (5)`, `Tests 245 passed (245)`.
- R18: `get-conditioning-order`, `conditioning-batch-data`, `list-finished-product-distribution`,
  `packing-count`: `Test Files 4 passed (4)`, `Tests 125 passed (125)`.
- `order-delivery.int.test.ts` (con el `.env` del repo principal; plantilla `qct_tpl_88f19b5be81c`
  reutilizada, base de corrida creada y borrada): `Tests 24 passed (24)`.
- `pnpm exec vitest related --run <11 archivos tocados>` (con el `.env` del repo principal): salida 0,
  `Test Files 536 passed (536)`, `Tests 9441 passed | 2 skipped (9443)`.

### Veredicto

T5 hecho: sheet, tope, paso a `ENTREGADO` y estado del listado esperan reales − libres; acondicionamiento
y «Reparto» siguen con reales. Sin bloqueos.
