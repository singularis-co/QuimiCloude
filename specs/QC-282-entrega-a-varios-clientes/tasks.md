# QC-282 — entrega-a-varios-clientes · tasks.md

> **Orden:** T0 (contrato, secuencial) → B1 (migración) → bloques B (backend) y F (frontend), en
> paralelo entre sí donde se marca `[P]` → TC (barrido de censos) → TI (E2E) → TZ (cierre).
>
> P1 y P2 cerradas el 2026-10-15 con la aprobación del spec (ver `requirements.md > Decisiones cerradas`).
>
> **Reglas de toda la feature:**
> - Ningún archivo de un bloque B aparece en un bloque F, y al revés. Las excepciones son T0 y TI.
> - Gate de cada tanda: `pnpm run typecheck`, `pnpm run lint`,
>   `pnpm exec vitest related --run <archivos tocados>` y `pnpm exec vitest run guard`. Gate de TZ:
>   `./init.sh`.
> - Un commit por task (`feat(QC-282): …` / `test(QC-282): …`).
> - Ningún comentario de producción cita la ficha, un `R<n>`, un `D<n>` ni el spec. En los tests, el
>   `R<n>` va en el nombre del caso.
> - Toda enmienda de un censo o de una guardia conserva sus aserciones previas y lleva una nota
>   fechada.

---

## [ ] T0 — Publicar el contrato (bloquea todo lo demás)

Implementa `design.md > 2` (tipos y firmas), sin la lógica nueva.

Archivos:
- `lib/modules/pedidos/domain/order-delivery.ts`: `DeliveryCustomerBlock`, `DeliveryBlockIssue`,
  `checkDeliveryBlocks`, `flattenBlocks` y `packagesLeftInBatch` **ya implementadas** (son puras y las
  necesitan B y F) con su test `tests/unit/pedidos/order-delivery.test.ts`.
- `lib/modules/pedidos/ports/order-delivery-repository.ts` y `order-delivery-void-repository.ts`:
  los tipos de `design.md > 2.2`.
- `lib/modules/pedidos/domain/deliver-order.ts`, `void-delivery.ts` y `list-order-deliveries.ts`: el
  esquema y los tipos nuevos (`design.md > 2.4`); el cuerpo puede lanzar `ActionNotAllowedError` hasta
  B3/B4.
- `lib/modules/pedidos/adapters/driving/order-actions.ts`: `DeliverOrderInput` y `VoidDeliveryInput`
  nuevos.
- `lib/modules/inventario/domain/finished-product-detail.ts`: `FinishedDeliveryDirectory`,
  `FinishedDeliveryLineRecord` y `FinishedProductDeliveryRow` (`design.md > 2.7`).
- `lib/modules/pedidos/index.ts` e `lib/modules/inventario/index.ts`: exportan lo anterior.
- Fixtures: `tests/fixtures/order-delivery.ts` (vista con dos presentaciones y un lote compartido;
  `deliverInput` con dos clientes), `tests/fixtures/order-delivery-void.ts` (historial con dos
  clientes, uno con una presentación anulada) y `tests/fixtures/finished-product-detail.ts` (filas
  con `presentationName` y `deliveryLineId`).
- Ajustes mínimos para que compile, con nota fechada, en los tests que construyen esos tipos.

Cubre: R20 (funciones puras), base de R16–R18 y R13–R14.

**Hecho cuando:** el gate de la tanda está en verde y hay commit
`feat(QC-282): publica el contrato de la entrega a varios clientes`.

---

## [ ] B1 — Migración y esquema (depende de T0)

- `db/migrations/<ts>_order_delivery_lines_customer/migration.sql` y `down.sql` (`design.md > 1.1`),
  con las dos comprobaciones previas que pide el diseño hechas contra la base de test.
- `db/schema.prisma` (`design.md > 1.1`).
- `lib/modules/pedidos/adapters/driven/persistence/order-delivery-prisma.ts`: `create` sin cliente;
  `addLines` con `customerId`.
- `tests/helpers/order-delivery-seed.ts`: el cliente en las líneas.
- Tests:
  - `tests/integration/pedidos/order-delivery-lines-customer-migration.int.test.ts` (nuevo): up sobre
    entregas de QC-223 con anulaciones de QC-224, filas y existencias intactas; up abortado con una
    entrega sin líneas; down con un cliente por entrega; down abortado con dos clientes (R31, R32);
  - `tests/unit/pedidos/schema/order-delivery-lines-customer-migration.test.ts` (nuevo): texto del
    SQL y del `down.sql`;
  - `tests/integration/pedidos/order-delivery-constraints.int.test.ts`: R30;
  - `tests/integration/pedidos/order-delivery-repository.int.test.ts`: las líneas guardan su cliente.
- Censos: `guard-identificador-de-request.test.ts` (`MIGRACIONES_ESPERADAS`),
  `tests/unit/clientes/scope.test.ts`, `tests/unit/pedidos/schema/pedidos-schema.test.ts`,
  `tests/integration/aislamiento.json`.

Cubre: R30, R31, R32.

**Hecho cuando:** la migración se aplica y se revierte en la base de test; los tests nombrados están
en verde; hay commit `feat(QC-282): mueve el cliente de la entrega a sus lineas`.

---

## [ ] B2 [P] — `inventario`: salida y devolución agregadas por lote (depende de B1)

- `lib/modules/inventario/adapters/driven/persistence/product-prisma.ts`: `dispatchFinishedGoods` y
  `returnFinishedGoods` según `design.md > 2.3`.
- `lib/modules/inventario/domain/finished-goods-dispatch.ts` y `finished-goods-return.ts`: solo la
  JSDoc del contrato (lote repetido, una línea por asignación en el mismo orden).
- Tests: `tests/unit/inventario/finished-goods-dispatch-prisma.test.ts`,
  `tests/unit/inventario/finished-goods-return-prisma.test.ts`,
  `tests/integration/inventario/finished-goods-dispatch.int.test.ts`,
  `tests/integration/inventario/finished-goods-return.int.test.ts` y
  `tests/integration/inventario/ledger-cuadre.int.test.ts` (dos clientes en un lote).

Cubre: R24, R26, R42 (parte de `inventario`).

**Hecho cuando:** un lote repetido entre dos asignaciones produce un decremento, un asiento con la
suma y dos líneas de salida; el cuadre está en verde; hay commit.

---

## [ ] B3 [P] — Entrega con varios clientes (depende de B1 y B2)

- `lib/modules/pedidos/domain/deliver-order.ts`: `design.md > 2.4` y `> 4`.
- Tests: `tests/unit/pedidos/deliver-order.test.ts` (R2, R21–R23, R27, R28),
  `tests/integration/pedidos/order-delivery.int.test.ts` (R21–R25, R27–R29),
  `tests/integration/pedidos/order-delivery-concurrency.int.test.ts` (un caso con dos clientes sobre
  el mismo lote).

Cubre: R2, R21–R29.

**Hecho cuando:** los tests nombrados están en verde y hay commit.

---

## [ ] B4 [P] — Anulación y lecturas (depende de B1 y B2)

- `lib/modules/pedidos/domain/void-delivery.ts` (`design.md > 5`).
- `lib/modules/pedidos/domain/list-order-deliveries.ts` (`design.md > 2.4`, `> 6`).
- `lib/modules/pedidos/adapters/driven/persistence/order-delivery-void-prisma.ts`: `customerId` en
  `findDeliveryLines` y en `listByOrder`.
- `lib/modules/pedidos/adapters/driven/persistence/order-delivery-directory-prisma.ts`:
  `listDeliveryLines`; se quita `findDeliveryDetails`.
- `lib/modules/inventario/domain/list-finished-product-deliveries.ts` (`design.md > 2.7`).
- `lib/modules/inventario/ports/finished-product-detail-repository.ts` y
  `lib/modules/inventario/adapters/driven/persistence/finished-product-detail-prisma.ts`: se quita
  `listDeliveryMovements`.
- `lib/composition/index.ts`: el directorio con `listDeliveryLines`.
- Tests: `tests/unit/pedidos/void-delivery.test.ts` (R3, R39–R41),
  `tests/integration/pedidos/order-delivery-void.int.test.ts` (R39–R42),
  `tests/integration/pedidos/order-delivery-void-repository.int.test.ts`,
  `tests/unit/pedidos/list-order-deliveries.test.ts` (R33, R34),
  `tests/integration/pedidos/order-delivery-directory.int.test.ts` (R43, R44),
  `tests/unit/inventario/list-finished-product-deliveries.test.ts` (R43, R44),
  `tests/integration/inventario/finished-product-detail.int.test.ts`.

Cubre: R3, R33, R34, R39–R44 (servidor).

**Hecho cuando:** los tests nombrados están en verde y hay commit.

---

## [ ] F1 [P] — Sheet «Entregar» con bloques y borrador v2 (depende de T0)

- `app/(private)/pedidos/components/order-delivery-sheet.tsx` (`design.md > 7.1`).
- `app/(private)/pedidos/components/order-delivery-customer-block.tsx` (nuevo).
- `app/(private)/pedidos/components/order-delivery-summary.tsx` (nuevo).
- `app/(private)/pedidos/components/order-delivery-draft.ts` y `use-order-delivery-draft.ts`
  (`design.md > 8`).
- Tests: `tests/unit/pedidos-ui/order-delivery-sheet.test.tsx` (R4–R9, R11–R19),
  `tests/unit/pedidos-ui/order-delivery-summary.test.tsx` (nuevo, R11, R12),
  `tests/unit/pedidos-ui/order-delivery-draft.test.ts` (R45, R46; lectura de un borrador v1).
- Contra la action mockeada y las fixtures de T0.

Cubre: R4–R19, R45, R46.

**Hecho cuando:** los tests nombrados están en verde; el sheet se ve como el tablero en escritorio,
tablet y teléfono (comprobado en el navegador local); hay commit.

---

## [ ] F2 [P] — Lista de entregas y diálogo de anular (depende de T0 y F3)

- `app/(private)/pedidos/components/order-delivery-list.tsx` (`design.md > 7.2`).
- `app/(private)/pedidos/components/delivery-void-dialog.tsx` (`design.md > 7.3`).
- `app/(private)/pedidos/components/order-deliveries-sheet.tsx`: solo lo que exija el tipo nuevo.
- Tests: `tests/unit/pedidos-ui/order-delivery-list.test.tsx` (R33–R35),
  `tests/unit/pedidos-ui/delivery-void-dialog.test.tsx` (R36–R38),
  `tests/unit/pedidos-ui/order-deliveries-sheet.test.tsx`.

Cubre: R33–R38 (pantalla).

**Hecho cuando:** los tests nombrados están en verde y hay commit.

---

## [ ] F3 — `Checkbox` con estado indeterminado (depende de T0)

- `components/ui/checkbox.tsx` (`design.md > 7.4`).
- `components/shared/CATALOGO.md`: punto de extensión en la fila de `Checkbox`.
- Test: `tests/unit/shared-ui/checkbox-indeterminate.test.tsx` (nuevo); los tests que ya usan
  `Checkbox` siguen verdes sin tocarlos.

Cubre: base de R37.

**Hecho cuando:** los tests están en verde y hay commit.

---

## [ ] F4 [P] — Tab Entregas con «Presentación» (depende de T0)

- `app/(private)/inventario/producto-terminado/[id]/components/finished-product-deliveries-table.tsx`
  (`design.md > 7.5`).
- Test: `tests/unit/inventario-ui/finished-product-tables.test.tsx` (R43, R44).

Cubre: R43, R44 (pantalla).

**Hecho cuando:** el test está en verde y hay commit.

---

## [ ] TC — Barrido de censos y guardias (depende de B y F)

- Recorre `design.md > 9`: cada fila verificada o enmendada con nota fechada.
- Verifica que `tests/unit/pedidos/order-delivery-append-only.test.ts` no barre `db/migrations`.
- Verifica R1 (`tests/unit/identity/permissions.test.ts` sin cambios y en verde) y R48.
- `pnpm exec vitest run guard` en verde.

**Hecho cuando:** guardias en verde y hay commit `test(QC-282): censos de la entrega a varios clientes`.

---

## [ ] TI — E2E (depende de TC)

- `e2e/entrega-a-varios-clientes.spec.ts` (nuevo, R47).
- `e2e/entregar-producto-terminado.spec.ts`, `e2e/anular-entrega.spec.ts` y
  `e2e/detalle-de-producto-terminado.spec.ts`: SQL con el cliente en las líneas; el diálogo abre sin
  nada marcado.
- `tests/guards/guard-identificador-de-request.test.ts`: `E2E_ESPERADOS`.
- `pnpm exec playwright test e2e/entrega-a-varios-clientes.spec.ts` y los tres tocados.

**Hecho cuando:** los cuatro specs pasan en local y hay commit.

---

## [ ] TZ — Cierre

- `./init.sh` en verde.
- `progress/impl_QC-282-entrega-a-varios-clientes.md` con el mapa `R<n> → test` (`design.md > 12`).

**Hecho cuando:** todo lo anterior y el leader puede pedir review.

---

## Archivos esperados

Producción:
- `db/schema.prisma`
- `db/migrations/<ts>_order_delivery_lines_customer/migration.sql`
- `db/migrations/<ts>_order_delivery_lines_customer/down.sql`
- `lib/modules/pedidos/domain/order-delivery.ts`
- `lib/modules/pedidos/domain/deliver-order.ts`
- `lib/modules/pedidos/domain/void-delivery.ts`
- `lib/modules/pedidos/domain/list-order-deliveries.ts`
- `lib/modules/pedidos/ports/order-delivery-repository.ts`
- `lib/modules/pedidos/ports/order-delivery-void-repository.ts`
- `lib/modules/pedidos/index.ts`
- `lib/modules/pedidos/adapters/driving/order-actions.ts`
- `lib/modules/pedidos/adapters/driven/persistence/order-delivery-prisma.ts`
- `lib/modules/pedidos/adapters/driven/persistence/order-delivery-void-prisma.ts`
- `lib/modules/pedidos/adapters/driven/persistence/order-delivery-directory-prisma.ts`
- `lib/modules/inventario/domain/finished-goods-dispatch.ts`
- `lib/modules/inventario/domain/finished-goods-return.ts`
- `lib/modules/inventario/domain/finished-product-detail.ts`
- `lib/modules/inventario/domain/list-finished-product-deliveries.ts`
- `lib/modules/inventario/ports/finished-product-detail-repository.ts`
- `lib/modules/inventario/index.ts`
- `lib/modules/inventario/adapters/driven/persistence/product-prisma.ts`
- `lib/modules/inventario/adapters/driven/persistence/finished-product-detail-prisma.ts`
- `lib/composition/index.ts`
- `app/(private)/pedidos/components/order-delivery-sheet.tsx`
- `app/(private)/pedidos/components/order-delivery-customer-block.tsx`
- `app/(private)/pedidos/components/order-delivery-summary.tsx`
- `app/(private)/pedidos/components/order-delivery-draft.ts`
- `app/(private)/pedidos/components/use-order-delivery-draft.ts`
- `app/(private)/pedidos/components/order-delivery-list.tsx`
- `app/(private)/pedidos/components/order-deliveries-sheet.tsx`
- `app/(private)/pedidos/components/delivery-void-dialog.tsx`
- `app/(private)/inventario/producto-terminado/[id]/components/finished-product-deliveries-table.tsx`
- `components/ui/checkbox.tsx`
- `components/shared/CATALOGO.md`

Tests:
- `tests/fixtures/order-delivery.ts`
- `tests/fixtures/order-delivery-void.ts`
- `tests/fixtures/finished-product-detail.ts`
- `tests/helpers/order-delivery-seed.ts`
- `tests/unit/pedidos/order-delivery.test.ts`
- `tests/unit/pedidos/deliver-order.test.ts`
- `tests/unit/pedidos/void-delivery.test.ts`
- `tests/unit/pedidos/list-order-deliveries.test.ts`
- `tests/unit/pedidos/order-delivery-append-only.test.ts`
- `tests/unit/pedidos/schema/pedidos-schema.test.ts`
- `tests/unit/pedidos/schema/order-delivery-lines-customer-migration.test.ts`
- `tests/unit/clientes/scope.test.ts`
- `tests/unit/inventario/finished-goods-dispatch-prisma.test.ts`
- `tests/unit/inventario/finished-goods-return-prisma.test.ts`
- `tests/unit/inventario/list-finished-product-deliveries.test.ts`
- `tests/unit/pedidos-ui/order-delivery-sheet.test.tsx`
- `tests/unit/pedidos-ui/order-delivery-summary.test.tsx`
- `tests/unit/pedidos-ui/order-delivery-draft.test.ts`
- `tests/unit/pedidos-ui/order-delivery-list.test.tsx`
- `tests/unit/pedidos-ui/delivery-void-dialog.test.tsx`
- `tests/unit/pedidos-ui/order-deliveries-sheet.test.tsx`
- `tests/unit/inventario-ui/finished-product-tables.test.tsx`
- `tests/unit/shared-ui/checkbox-indeterminate.test.tsx`
- `tests/integration/pedidos/order-delivery-lines-customer-migration.int.test.ts`
- `tests/integration/pedidos/order-delivery.int.test.ts`
- `tests/integration/pedidos/order-delivery-concurrency.int.test.ts`
- `tests/integration/pedidos/order-delivery-constraints.int.test.ts`
- `tests/integration/pedidos/order-delivery-repository.int.test.ts`
- `tests/integration/pedidos/order-delivery-void.int.test.ts`
- `tests/integration/pedidos/order-delivery-void-repository.int.test.ts`
- `tests/integration/pedidos/order-delivery-directory.int.test.ts`
- `tests/integration/inventario/finished-goods-dispatch.int.test.ts`
- `tests/integration/inventario/finished-goods-return.int.test.ts`
- `tests/integration/inventario/ledger-cuadre.int.test.ts`
- `tests/integration/inventario/finished-product-detail.int.test.ts`
- `tests/integration/aislamiento.json`
- `tests/guards/guard-identificador-de-request.test.ts`
- `e2e/entrega-a-varios-clientes.spec.ts`
- `e2e/entregar-producto-terminado.spec.ts`
- `e2e/anular-entrega.spec.ts`
- `e2e/detalle-de-producto-terminado.spec.ts`
