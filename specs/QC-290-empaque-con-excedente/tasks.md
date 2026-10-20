# QC-290 — empaque-con-excedente · tasks.md

> Orden: T0 → (T2 ∥ T3) → T4 → (T5 ∥ T6) → T8 → T9. T1 (pase `/design`) puede ir en paralelo con
> todo el servidor, pero **T7 no empieza sin T1 aprobado**. Cada task cierra con typecheck, lint y
> `pnpm exec vitest related --run <archivos tocados>`; las que tocan errores o esquema, además
> `pnpm exec vitest run guard`.

## Tasks

- [x] **T0 — Dominio puro de los libres** (backend). R3, R5, R6, R7, R22.
  - `compareDecimals` en `order-distribution.ts`; `packingSurplusByLine` y `orderedPackages` en
    `packing-count.ts` (design §2.1); borrar `maxPackagesForLine`; publicar en `pedidos/index.ts`.
  - Tests en `packing-count.test.ts`: los ejemplos de R5, R6 y P3, una línea sin contenido, unidades
    incompatibles, una línea por debajo del plan con excedente, empate de contenido (orden del
    reparto).
  - `maxPackagesForLine` **se queda** hasta T7 (el diálogo aún la importa y T7 espera a T1); T7 la
    borra junto con su bloque de tests.
  - Hecho: tests nuevos verdes; typecheck verde.

- [x] **T1 [P] — Pase `/design` del aviso informativo** (humano + `/design`). P2; desbloquea R20, R22.
  - Añadir el estado «Con excedente» a `docs/diseno/canvas/EmpaqueTerminarEstados.dc.html` (y a
    `EmpaqueTerminar.dc.html`, `EmpaqueTerminarMovil.dc.html`, `EmpaqueTerminarTablet.dc.html` si el
    aviso cambia el layout): texto, tono, ubicación (línea o pie), si detalla los libres, y la
    retirada del estado de error «Supera la cantidad del pedido».
  - Propuesta de partida: `Notice` en tono de información (design §UI).
  - Hecho: tablero aprobado por el humano y copiado a `docs/diseno/canvas/`; texto de P2 escrito en
    `requirements.md > Decisiones cerradas` por `/afinar-feature` o por el humano, y P2 cerrada.

- [x] **T2 — Migración y esquema** (backend). Depende de T0 solo para el nombre del campo. R8, R11.
  - `pnpm run db:migrate:create` → `<ts>_order_presentation_lines_packed_surplus` con
    `migration.sql` y `down.sql` de design §1.2; campo en `db/schema.prisma`.
  - Test de esquema `order-presentation-lines-packed-surplus-migration.test.ts`: columna, default 0,
    CHECK y que `down.sql` revierte exactamente.
  - Hecho: migración aplica y revierte sobre la base de test; test de esquema verde; guardias verdes.

- [x] **T3 [P] — Retirar `packed_exceeds_quantity`** (backend). R26.
  - `error-codes.ts`, `error-catalog.ts`, `asignaciones/domain/errors.ts`, `asignaciones/index.ts`,
    `asignaciones/domain/finish-packing.ts`, unión en `pedidos/domain/order-catalog.ts` (design §2.5).
  - Tests: `catalogo.test.ts` 106 → 105; quitar los casos de `order-packing-actions.test.ts` (L207)
    y `finish-packing.test.ts` (L55, L651).
  - Hecho: `grep packed_exceeds_quantity` sin resultados fuera de `specs/` y `progress/`; guardia
    `guard-catalogo-de-errores` verde.

- [x] **T4 — Terminar con excedente** (backend). Depende de T0, T2, T3. R1–R4, R8–R10, R27.
  - Puertos y adaptador (design §3): `FinishPackingLine.packedSurplusPackages`,
    `RecordedPackedLine`, `order-prisma.ts` lee y escribe la columna.
  - `order-packing.ts`: `resolveSurplus` sustituye a `assertPackedWithinQuantity`; `RejectedFinish`
    sin `'packed_exceeds_quantity'`; libres a `recordPackedCounts`.
  - Tests unitarios (`order-packing.test.ts`: sustituir L860 por «acepta y guarda 2 libres») e
    integración (`finish-with-finished-goods.int.test.ts`: sustituir L1567; casos de R4, R9, R10;
    `order-packed-counts.int.test.ts`: guardado, rechazo sin libres, CHECK).
  - Hecho: plan 5×1 L + 1×5 L con real 12×1 L + 0×5 L termina, da un lote de 12 L, guarda 2 libres
    en la línea de 1 L y el coste suma el del pedido.

- [ ] **T5 [P] — Entrega espera solo lo pedido** (backend). Depende de T4. R12–R15, R18.
  - `OrderDeliveryProgressLine.packedSurplusPackages` y su lectura en `order-catalog-prisma.ts`.
  - `orderedPackages` en `deliver-order.ts`, `get-order-delivery.ts`, `order-pending-delivery.ts`
    (design §2.4). Acondicionamiento y «Reparto» siguen con `effectivePackages`.
  - Tests: `deliver-order.test.ts`, `get-order-delivery.test.ts`, `list-orders.test.ts`,
    `order-delivery.int.test.ts` (tope de 10 con 12 reales y 2 libres; `ENTREGADO` al entregar 10).
  - Hecho: tests verdes; los de acondicionamiento (`get-conditioning-order.test.ts`,
    `conditioning-batch-data.test.ts`) siguen verdes sin tocarlos.

- [ ] **T6 [P] — Lo libre suma al excedente sin pedido** (backend). Depende de T4. R16, R17.
  - `direct-delivery-prisma.ts` selecciona la columna y usa `orderedPackages`; comentario de
    `direct-delivery.ts`.
  - Test: `direct-delivery-repository.int.test.ts` (pedido `TERMINADO` con 12 reales y 2 libres →
    espera 10; excedente = 2).
  - Hecho: test verde; el resto de tests de QC-288 sigue verde.

- [ ] **T7 — Diálogo sin bloqueo y con aviso** (frontend). **Depende de T1 aprobado** y de T0. R19–R24.
  - `packing-finish-dialog.tsx` según design §5 y el tablero de T1.
  - Borrar `maxPackagesForLine` de `packing-count.ts` y `pedidos/index.ts`, y su bloque en
    `packing-count.test.ts`.
  - Tests en `packing-finish-dialog.test.tsx`: sustituir los casos de L412-438 y L541 (ya no hay
    error ni «Corrige…» por exceso, «Terminar» habilitado, total sin tono de error); aviso visible solo
    con excedente; libres del aviso iguales a `packingSurplusByLine`; stock del envase sigue
    bloqueando con excedente.
  - Hecho: tests verdes; paridad del diálogo con el tablero aprobado.

- [ ] **T8 — E2E** (frontend/backend). Depende de T4, T5, T6, T7. R29 (y R1, R9, R12, R17 de punta a
  punta).
  - Caso nuevo en `e2e/envases-reales-empaque.spec.ts`: Terminar con una línea por encima del plan
    y envasado > cantidad → el aviso aparece y «Terminar» funciona → lote con lo real → el sheet de
    entrega pide solo lo pedido → el excedente entregable sin pedido del producto incluye los libres.
  - Hecho: `pnpm exec playwright test e2e/envases-reales-empaque.spec.ts` verde.

- [ ] **T9 — Cierre de tanda**. Depende de todo.
  - Mapa `R<n> → test` en `progress/impl_QC-290.md` (design §10), incluido R25 con el test existente
    de QC-170 y R28 con el gate.
  - Hecho: `./init.sh` verde; ningún `R<n>` sin test.

## Archivos esperados

- `lib/modules/pedidos/domain/order-distribution.ts`
- `lib/modules/pedidos/domain/packing-count.ts`
- `lib/modules/pedidos/domain/order-packing.ts`
- `lib/modules/pedidos/domain/order-catalog.ts`
- `lib/modules/pedidos/domain/deliver-order.ts`
- `lib/modules/pedidos/domain/get-order-delivery.ts`
- `lib/modules/pedidos/domain/order-pending-delivery.ts`
- `lib/modules/pedidos/domain/direct-delivery.ts`
- `lib/modules/pedidos/index.ts`
- `lib/modules/pedidos/ports/order-write-repository.ts`
- `lib/modules/pedidos/adapters/driven/persistence/order-prisma.ts`
- `lib/modules/pedidos/adapters/driven/persistence/order-catalog-prisma.ts`
- `lib/modules/pedidos/adapters/driven/persistence/direct-delivery-prisma.ts`
- `lib/modules/asignaciones/domain/errors.ts`
- `lib/modules/asignaciones/domain/finish-packing.ts`
- `lib/modules/asignaciones/index.ts`
- `lib/modules/errores/domain/error-codes.ts`
- `lib/modules/errores/domain/error-catalog.ts`
- `db/schema.prisma`
- `db/migrations/<ts>_order_presentation_lines_packed_surplus/migration.sql`
- `db/migrations/<ts>_order_presentation_lines_packed_surplus/down.sql`
- `app/(private)/asignacion/empaque/[id]/components/packing-finish-dialog.tsx`
- `docs/diseno/canvas/EmpaqueTerminar.dc.html`
- `docs/diseno/canvas/EmpaqueTerminarEstados.dc.html`
- `docs/diseno/canvas/EmpaqueTerminarMovil.dc.html`
- `docs/diseno/canvas/EmpaqueTerminarTablet.dc.html`
- `tests/unit/pedidos/packing-count.test.ts`
- `tests/unit/pedidos/order-packing.test.ts`
- `tests/unit/pedidos/deliver-order.test.ts`
- `tests/unit/pedidos/get-order-delivery.test.ts`
- `tests/unit/pedidos/list-orders.test.ts`
- `tests/unit/pedidos/schema/order-presentation-lines-packed-surplus-migration.test.ts`
- `tests/unit/asignaciones/finish-packing.test.ts`
- `tests/unit/asignaciones/order-packing-actions.test.ts`
- `tests/unit/asignaciones-ui/packing-finish-dialog.test.tsx`
- `tests/unit/errores/catalogo.test.ts`
- `tests/integration/pedidos/finish-with-finished-goods.int.test.ts`
- `tests/integration/pedidos/order-packed-counts.int.test.ts`
- `tests/integration/pedidos/order-delivery.int.test.ts`
- `tests/integration/pedidos/direct-delivery-repository.int.test.ts`
- `e2e/envases-reales-empaque.spec.ts`
- `progress/impl_QC-290.md`
