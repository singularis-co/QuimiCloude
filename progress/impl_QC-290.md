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

## T7 — Diálogo sin bloqueo y con aviso (frontend_dev, 2026-10-20)

### Archivos

- `app/(private)/asignacion/empaque/[id]/components/packing-finish-dialog.tsx`: fuera `maxPackagesForLine`,
  `TEXTS.exceeds`, `LineView.exceeds` y `overQuantity` (el total del pie ya no se pinta en `text-destructive`).
  El error de stock del envase se evalúa igual para toda línea por encima del plan. `describeLines` calcula
  `packingSurplusByLine` con los mismos datos del total y devuelve `surplus` solo si ninguna línea tiene error y
  el excedente no es 0. Aviso: `Notice tone="info"` (role `status`) como primer hijo del pie, `w-full flex-none`
  (encima de «Envasado: …»), título «Sobran <excedente> sobre el pedido.» y cuerpo «Quedan libres en stock: …» o
  «Ningún envase queda libre: …». Textos nuevos: `surplus`, `freePackages`, `surplusFree`, `surplusNoneFree`;
  testid nuevo `PACKING_FINISH_SURPLUS_TESTID`.
- `app/(private)/asignacion/empaque/[id]/components/index.ts`: exporta `PACKING_FINISH_SURPLUS_TESTID`.
- `lib/modules/pedidos/domain/packing-count.ts`, `lib/modules/pedidos/index.ts`: borrada `maxPackagesForLine`.
  `grep maxPackagesForLine` fuera de `specs/` y `progress/`: sin resultados.
- `tests/unit/pedidos/packing-count.test.ts`: borrado el bloque `describe('maxPackagesForLine')`.
- `tests/unit/asignaciones-ui/packing-finish-dialog.test.tsx`: el bloque «tope de la cantidad del pedido» (L412-439)
  pasa a «con excedente sobre el pedido»; el `T.exceeds` de L541 pasa a los textos del aviso.

### R → test (T7), en `tests/unit/asignaciones-ui/packing-finish-dialog.test.tsx`

| R | Test |
|---|---|
| R19 | «R19, R24: Galón 16 supera 72 L → sin error de línea, insignia normal, total sin tono de error y Terminar activo»; «R19: con excedente y motivos, Terminar envía el conteo real»; «R1–R10, R19, R20: los textos con plantilla…» (`exceeds` ya no existe) |
| R20 | «R20: estado del tablero (Galón 16, Botella 17) → un aviso informativo encima del pie…»; «R20: varios envases libres de una presentación van en plural»; «R20: si lo que sobra no llega a un envase entero…»; «R20: con una línea con error de conteo no hay aviso…» |
| R21 | «R21: igual o por debajo de la cantidad no hay aviso ni error»; «R21: al volver por debajo de la cantidad el aviso desaparece» |
| R22 | «R22: %s → los libres del aviso son los de packingSurplusByLine» (3 casos) |
| R23 | «R23: con excedente el stock del envase sigue bloqueando y sin aviso»; «R23: con excedente siguen los motivos de «más», el motivo obligatorio y la ayuda de envases vacíos»; «R23: con excedente un conteo vacío sigue siendo error y deshabilita Terminar» |
| R24 | «R19, R24: …»; «R24: el pie dice siempre «Envasado: total de cantidad», también por encima» |

### Salida real

- `pnpm run typecheck`: `tsc --noEmit` sin errores.
- `pnpm run lint`: `✖ 10 problems (0 errors, 10 warnings)`; los 10 avisos son previos y en archivos que T7 no toca
  (`step-evidence.tsx`, `list-execution-traces.test.ts`, `confirm-catalog-import.test.ts`, `order-service.test.ts`).
- `pnpm exec vitest run tests/unit/asignaciones-ui/packing-finish-dialog.test.tsx tests/unit/pedidos/packing-count.test.ts`:
  `Test Files 2 passed (2)`, `Tests 104 passed (104)`.
- `pnpm exec vitest related --run <dialog, packing-count.ts, pedidos/index.ts>`: «No test files found, exiting with
  code 0» en este worktree (causa no investigada; T5 lo corrió con el `.env` del repo principal). En su lugar, los consumidores directos del barril de
  componentes de empaque: `packing-order-evidence`, `packing-order-page`, `packing-order-screen`,
  `qc195-lineas-antiguas`, `asignacion-acondicionamiento-paridad`, `confirmaciones-paridad`,
  `recipe-route-contract`, `step-reader`: `Test Files 8 passed (8)`, `Tests 304 passed (304)`.

### Desviaciones respecto al tablero

- Orden de la lista de libres: el tablero la arma en el orden de reparto de los libres (mayor contenido primero);
  el diálogo la lista en el orden de las líneas del reparto. Coinciden en el estado aprobado (Galón, Botella) y
  los números son siempre los de `packingSurplusByLine`; solo cambia el orden del texto si una línea de menor
  contenido va antes en el reparto.
- Formato de cantidades: el excedente pasa por `formatDecimalDisplay`, igual que el total del pie
  (en jsdom «5.48 L»; el tablero muestra «5,48 L»), sin cambio respecto a cómo el diálogo ya pinta el total.

### Veredicto T7

Hecho: el exceso ya no bloquea ni pinta error; aviso informativo con los libres de `packingSurplusByLine`; el stock del envase sigue bloqueando; `maxPackagesForLine` borrada. Sin bloqueos.

## T8 — E2E (frontend_dev)

### Archivos

- Modificado: `e2e/envases-reales-empaque.spec.ts` (caso 4 nuevo; importa `PACKING_FINISH_SURPLUS_TESTID`,
  `ORDERS_ROUTE`, `finishedProductDetailRoute` y los helpers `openOrderRowMenu`/`orderMenuTrigger`
  de `e2e/helpers/order-distribution.ts`; testids del sheet de entrega y del de entrega sin pedido
  como constantes locales, igual que sus specs). Sin dependencias nuevas.

### Recorrido del caso

Plan 5 × 1 l + 1 × 5 l (10 l = cantidad); el Empacador cuenta 7 × 1 l (Conteo físico) → 12 l.
El aviso `packing-finish-surplus` dice «Sobran 2 L sobre el pedido.» / «Quedan libres en stock: 2
envases de <envase 1 l>.», «Terminar» habilitado y sin error de línea → `POR_ACONDICIONAR`, línea 1 l
con `packedPackages 7` y `packedSurplusPackages 2`, la de 5 l con 0 libres → lotes de 7 l y 5 l con
coste `deriveUnitCost(cost, '12')` → pedido a `TERMINADO` por la base → el Administrador abre
«Entregar» del pedido: «Faltan 5» en 1 l y «Faltan 1» en 5 l → ficha del producto 1 l, «Entregar»
(sin pedido): En stock 7, Esperan −5, Se puede entregar 2.

### Mapa R → test

| R | Test |
|---|---|
| R29 | `e2e/envases-reales-empaque.spec.ts` › «R29, R1, R9, R12, R17 - Terminar con 2 envases de 1 l por encima del plan…» |
| R1 | mismo caso: aviso informativo, «Terminar» habilitado, pedido `POR_ACONDICIONAR`, libres guardados |
| R9 | mismo caso: lotes de 7 l y 5 l (libres incluidos), coste sobre 12 l |
| R12 | mismo caso: sheet de entrega del pedido «Faltan 5» (no 7) en la línea de 1 l |
| R17 | mismo caso: tarjeta de excedente de la entrega sin pedido = 2 envases |

### Verificación

- `pnpm run typecheck` → exit 0. `pnpm exec eslint e2e/envases-reales-empaque.spec.ts` → «No issues found».
- Base: `pnpm exec tsx --env-file=../../.env scripts/test-db.ts template` (equivale a
  `pnpm run db:test template` con el `.env` del repo principal) → «plantilla reutilizada:
  qct_tpl_88f19b5be81c (108 migraciones)». `CREATE DATABASE qc290_e2e TEMPLATE "qct_tpl_88f19b5be81c"`;
  Playwright con `DATABASE_URL`/`DIRECT_URL` → `qc290_e2e` (mismo host y credenciales). Al terminar,
  `DROP DATABASE qc290_e2e`. QuimiCloude sin tocar; `quimicloude_e2e` sin usar.
- Playwright se lanzó como `node --env-file=../../.env node_modules/@playwright/test/cli.js test
  e2e/envases-reales-empaque.spec.ts` (el mismo CLI que `pnpm exec playwright`; el worktree no tiene
  `.env` y así el `next dev` del webServer recibe el entorno con las URL ya apuntadas a `qc290_e2e`).

Corrida 1 (chromium + webkit a la vez, `next dev` en frío):

```
  ✘  1 [chromium] › …:551:7 › … R19, R20, R21, R23, R26, R27 - una línea en 0 … (1.7m)
  ✘  6 [chromium] › …:460:7 › … R17, R18, R20, R21, R26, R27 - una línea con 1 envase menos … (1.7m)
  ✘  5 [chromium] › …:675:7 › … R29, R1, R9, R12, R17 - Terminar con 2 envases de 1 l … (1.7m)
  ✘  3 [chromium] › …:643:7 › … R9 - un envase de más sin stock libre … (1.7m)
  ✓  8 [webkit] › …:643:7 › … R9 - un envase de más sin stock libre … (39.8s)
  ✓  4 [webkit] › …:460:7 › … R17, R18, R20, R21, R26, R27 - una línea con 1 envase menos … (3.7m)
  ✓  2 [webkit] › …:551:7 › … R19, R20, R21, R23, R26, R27 - una línea en 0 … (3.7m)
  ✓  7 [webkit] › …:675:7 › … R29, R1, R9, R12, R17 - Terminar con 2 envases de 1 l … (1.0m)
    TimeoutError: page.waitForURL: Timeout 60000ms exceeded.   (e2e/helpers/landing.ts:85, el login)
  4 failed
  4 passed (7.9m)
```

Los 4 rojos de chromium son el mismo: el `waitForURL` del login en `helpers/landing.ts` durante el
arranque en frío de `next dev` con 8 workers (también los 3 casos previos, que no se tocaron).
Corrida 2, solo chromium, servidor nuevo:

```
  ✓  3 [chromium] › …:643:7 › … R9 - un envase de más sin stock libre … (33.3s)
  ✓  4 [chromium] › …:460:7 › … R17, R18, R20, R21, R26, R27 - una línea con 1 envase menos … (55.1s)
  ✓  2 [chromium] › …:675:7 › … R29, R1, R9, R12, R17 - Terminar con 2 envases de 1 l … (1.0m)
  ✓  1 [chromium] › …:551:7 › … R19, R20, R21, R23, R26, R27 - una línea en 0 … (1.1m)
  4 passed (2.5m)
```

### Veredicto T8

Hecho: el caso R29 está verde en chromium y webkit sobre una base propia copiada de la plantilla; la
primera corrida conjunta tuvo un timeout del login en chromium (arranque en frío) que no es del caso nuevo.

## T9 — Cierre: mapa consolidado R1–R29 → test (implementer, 2026-10-20)

Archivos de toda la feature: `git diff 0105afe1 --stat` (44 archivos). Detalle por tanda en las secciones T0–T8 de arriba.
`package.json`, `pnpm-lock.yaml` y `docs/dependencias.md` sin cambios desde `0105afe1`.

| R | Test |
|---|---|
| R1 | `tests/unit/pedidos/order-packing.test.ts` «R1, R6, R8, R9: con 12 x 1 L + 0 x 5 L acepta y guarda 2 libres…»; `tests/integration/pedidos/finish-with-finished-goods.int.test.ts` «R1, R6, R8, R9, R10: plan 5 x 1 L + 1 x 5 L con real 12 x 1 L + 0 x 5 L termina…»; E2E «R29, R1, R9, R12, R17…» |
| R2 | `order-packing.test.ts` «R2: con excedente, la linea por encima del plan %s rechaza con invalid_packing_count sin guardar nada» (4 casos); `tests/unit/pedidos/packing-count.test.ts` «R2: marca cada linea con error…» |
| R3 | `packing-count.test.ts` «R3: una linea sin contenido se informa…», «R3: una unidad inconvertible se informa…»; `order-packing.test.ts` «R3: con excedente, una linea en una unidad que no se convierte…» |
| R4 | `order-packing.test.ts` «R4, R8: con excedente, sin stock libre del envase…»; `finish-with-finished-goods.int.test.ts` «R4, R8: … supera el stock libre…», «R4: … si el stock libre del envase cubre el exceso… termina» |
| R5 | `packing-count.test.ts` «R5: sin superar la cantidad no hay libres…», «R5: envasado exacto a la cantidad, sin libres»; `order-packing.test.ts` «R5: con 9 x 1 L + 0 x 5 L…» |
| R6 | `packing-count.test.ts` «R6: 7 x 1 L + 1 x 5 L deja 2 libres de 1 L», «R6: 12 x 1 L + 0 x 5 L…», «R6: una linea nunca deja mas libres que reales menos plan…»; `order-packed-counts.int.test.ts` «R6, R8: los libres solo caben en una linea contada…» |
| R7 | `packing-count.test.ts` «R7, P3: excedente de 5 L con 1 L +4 y 5 L +1…», «R7: lo que no llega a un envase entero sigue en el pedido», «R7: a igual contenido manda el orden del reparto» |
| R8 | `tests/integration/pedidos/order-packed-counts.int.test.ts` «R8: guarda los libres de cada linea con su conteo…», «R8: unos libres por encima de lo que la linea paso de su plan los rechaza la base…»; migración «R8: down.sql revierte exactamente…» |
| R9 | `finish-with-finished-goods.int.test.ts` «R1, R6, R8, R9, R10…» (un lote de 12 L); E2E (lotes 7 l y 5 l) |
| R10 | `order-packing.test.ts` «R10: el coste del pedido se reparte entre los 12 L envasados…»; `finish-with-finished-goods.int.test.ts` «R1, R6, R8, R9, R10…» |
| R11 | `tests/unit/pedidos/schema/order-presentation-lines-packed-surplus-migration.test.ts` «R8, R11: anade la columna entera, NOT NULL y con DEFAULT 0», «R11: no reescribe plan, conteo real ni motivos…»; `order-packed-counts.int.test.ts` «R8, R11: un conteo sin libres guarda 0…»; `packing-count.test.ts` «R11, R12: sin conteo guardado ni libres, espera el plan» |
| R12 | `tests/unit/pedidos/get-order-delivery.test.ts` «R12, R15: los «pedidos»… reales menos los libres»; `tests/unit/pedidos/list-orders.test.ts` «R12: …12 reales con 2 libres esperan 10»; `tests/integration/pedidos/order-delivery.int.test.ts` «R12, R15: el sheet y el progreso del listado… esperan 10»; E2E |
| R13 | `tests/unit/pedidos/deliver-order.test.ts` «R13: …pedir 11 es delivery_exceeds_remaining», «R13: con 3 ya entregados, el tope es 10 - 3 = 7»; `order-delivery.int.test.ts` «R13: pedir 11 envases… sin escribir nada» |
| R14 | `deliver-order.test.ts` y `order-delivery.int.test.ts` «R13, R14: entregar los 10… ENTREGADO» |
| R15 | `get-order-delivery.test.ts` y `order-delivery.int.test.ts` «R12, R15…» |
| R16 | `tests/integration/pedidos/direct-delivery-repository.int.test.ts` «R16, R17: los libres de un pedido cubren lo que espera otro TERMINADO…»; `finish-with-finished-goods.int.test.ts` «R1, R6, R8, R9, R10…» (el lote guarda los 12 L) |
| R17 | `direct-delivery-repository.int.test.ts` «R16, R17: un TERMINADO de 10 con 12 reales y 2 libres espera 10… el excedente es 2»; E2E (Se puede entregar 2) |
| R18 | existentes, sin tocar y verdes: `get-conditioning-order.test.ts` «R23: la fila y los datos de lote muestran los envases reales…»; `conditioning-batch-data.test.ts` «QC-281 R23»; `list-finished-product-distribution.test.ts` «R27: devuelve tal cual las filas…» (tab Reparto) |
| R19 | `tests/unit/asignaciones-ui/packing-finish-dialog.test.tsx` «R19, R24: Galón 16 supera 72 L → sin error de línea… Terminar activo», «R19: con excedente y motivos, Terminar envía el conteo real» |
| R20 | `packing-finish-dialog.test.tsx` «R20: estado del tablero (Galón 16, Botella 17) → un aviso informativo encima del pie…», «R20: con una línea con error de conteo no hay aviso…» |
| R21 | `packing-finish-dialog.test.tsx` «R21: igual o por debajo de la cantidad no hay aviso ni error», «R21: al volver por debajo de la cantidad el aviso desaparece» |
| R22 | `packing-finish-dialog.test.tsx` «R22: %s → los libres del aviso son los de packingSurplusByLine» (3 casos); `packing-count.test.ts` «R22: el resultado solo depende de los datos…» |
| R23 | `packing-finish-dialog.test.tsx` «R23: con excedente el stock del envase sigue bloqueando y sin aviso», «R23: …conteo vacío sigue siendo error…» |
| R24 | `packing-finish-dialog.test.tsx` «R24: el pie dice siempre «Envasado: total de cantidad», también por encima» |
| R25 | existentes de QC-170/QC-195, sin tocar: `tests/integration/pedidos/qc170-distribution-concurrency.int.test.ts:340` «bajar la cantidad por debajo de lo repartido rechaza con order_distribution_exceeds_quantity…»; `tests/unit/pedidos/create-order.test.ts:522` «R36 / QC-195 R13: el reparto en envases pasa de la cantidad del pedido…»; `tests/unit/pedidos/update-order.test.ts:615` |
| R26 | `tests/unit/errores/catalogo.test.ts` (105 códigos); guardia `guard-catalogo-de-errores`; `grep -r packed_exceeds_quantity` vacío fuera de `specs/` y `progress/` |
| R27 | `tests/unit/asignaciones/finish-packing.test.ts` «R27: el actor con `empaque.modificar` que empaca el pedido termina…», «R27: sin `empaque.modificar` rechaza…», «R27: si el pedido lo empaca otro…», «R27: si el pedido ya no esta EN_EMPAQUE…» |
| R28 | dependencias sin cambios desde `0105afe1` (`package.json`, `pnpm-lock.yaml`, `docs/dependencias.md`); gate CI |
| R29 | `e2e/envases-reales-empaque.spec.ts` «R29, R1, R9, R12, R17 - Terminar con 2 envases de 1 l por encima del plan…» (chromium 4/4 y webkit 4/4, en corridas separadas) |

### Gate
Por decisión del humano (2026-10-20), `./init.sh` no se corre al cerrar las tandas: la suite completa la corre CI (`gate-completo`) en el PR. Solo la tanda 1 lo corrió en local (verde). Lo que se verificó en local está en cada sección.

## Ajuste del reviewer: orden del aviso

El aviso de excedente listaba los libres en el orden de las líneas; ahora los lista de mayor a menor contenido por envase y, a igual contenido, en el orden del reparto (R7, tablero `EmpaqueTerminar.dc.html` estado `excedente`). Las cantidades siguen siendo las de `packingSurplusByLine`.

- `lib/modules/pedidos/domain/packing-count.ts`: nuevo `largestPackageFirst(orderUnit, lines)` (ordena con `compareDecimals`, `sort` estable). `packingSurplusByLine` lo usa para su cascada, sin cambio de comportamiento.
- `lib/modules/pedidos/index.ts`: publica `largestPackageFirst` y el tipo `LargestPackageFirst`.
- `app/(private)/asignacion/empaque/[id]/components/packing-finish-dialog.tsx`: el aviso recorre las líneas en ese orden.
- `tests/unit/pedidos/packing-count.test.ts`: `describe('largestPackageFirst')` con «R7: de mayor a menor contenido por envase, convirtiendo a la unidad del pedido», «R7: a igual contenido conserva el orden recibido», «R3: informa la linea sin contenido o con unidad inconvertible».
- `tests/unit/asignaciones-ui/packing-finish-dialog.test.tsx`: «R20, R7: con la línea de menor contenido antes en el reparto, el aviso lista de mayor a menor contenido», «R20, R7: a igual contenido el aviso conserva el orden del reparto».

Salida:
- `pnpm run typecheck`: sin errores.
- `pnpm run lint`: 0 errores, 10 warnings previos en otros archivos; `eslint` sobre los 5 archivos tocados: limpio.
- `pnpm exec vitest run tests/unit/pedidos/order-packing.test.ts tests/unit/pedidos/packing-count.test.ts tests/unit/asignaciones-ui/packing-finish-dialog.test.tsx`: 3 archivos, 172 tests en verde.
- `vitest related`: sin las rutas con corchetes no encuentra tests del diálogo; con `packing-count.ts` arrastra el proyecto `integration` (pide `DATABASE_URL`) y, limitado a `node`/`ui`, abarca casi toda la suite por el barril `@/lib/modules/pedidos`: se cortó. En su lugar se corrieron los tests que consumen directamente el diálogo y `packing-count` (arriba).

Veredicto: aviso ordenado como pide R7 con la misma regla del dominio; tests tocados en verde.
