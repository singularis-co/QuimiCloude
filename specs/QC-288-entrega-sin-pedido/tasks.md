# QC-288 — entrega-sin-pedido · tasks.md

> **Orden:**
> 1. T0 (contrato, secuencial).
> 2. B1 (migraciones).
> 3. Bloques B (backend) y F (frontend), en paralelo entre sí donde se marca `[P]`.
> 4. TC (barrido de censos).
> 5. TI (E2E).
> 6. TZ (cierre).
>
> P1–P4 de `requirements.md` se cierran con la aprobación del spec. Si el humano cambia alguna, se
> corrige el spec antes de T0.
>
> **Reglas de toda la feature:**
> - Ningún archivo de un bloque B aparece en un bloque F, y al revés. Las excepciones son T0 y TI.
> - Gate de cada tanda: `pnpm run typecheck`, `pnpm run lint`,
>   `pnpm exec vitest related --run <archivos tocados>` y `pnpm exec vitest run guard`. Gate de TZ:
>   `./init.sh`.
> - Un commit por task (`feat(QC-288): …` / `test(QC-288): …`).
> - Ningún comentario de producción cita la ficha, un `R<n>`, un `D<n>` ni el spec. En los tests, el
>   `R<n>` va en el nombre del caso.
> - Toda enmienda de un censo o de una guardia conserva sus aserciones previas y lleva una nota
>   fechada.

---

## [ ] T0 — Verificaciones previas y contrato (bloquea todo lo demás)

**Verificaciones**, anotadas en `progress/features/QC-288.md > Decisiones` antes de escribir nada:
1. Si `finishConditioningAlive` (`EN_ACONDICIONAMIENTO → TERMINADO`) bloquea el producto terminado.
   Fija si el paso 0 de `design.md > 3` entra o no.
2. En qué paso entra la existencia de un pedido en su producto terminado. Responde al dato de P4.
3. Qué formateador de número de pedido usa `OrderNumberDirectory`. Lo reutiliza `listWaitingLines`.
4. Si `pedidos/domain/errors.ts` ya tiene una clase con código `product_not_found`.
5. Que `products_company_id_id_key` es `(company_id, id)`.

Si alguna contradice el diseño, para y avisa al leader.

**Contrato** (`design.md > 2`), sin la lógica de los casos de uso:
- `lib/modules/pedidos/domain/direct-delivery.ts`, **ya implementada** (es pura y la necesitan B y F),
  con su test `tests/unit/pedidos/direct-delivery.test.ts`.
- `lib/modules/pedidos/ports/direct-delivery-repository.ts` y `direct-delivery-unit-of-work.ts`;
  los cambios de tipo en `order-delivery-repository.ts` y `order-delivery-void-repository.ts`
  (§2.5).
- Los cinco casos de uso de §2.6, con su firma, el permiso primero y un cuerpo que lanza
  `ActionNotAllowedError`.
- `lib/modules/pedidos/domain/errors.ts`: `DeliveryExceedsSurplusError` y
  `DirectDeliveryProductNotFoundError`. `lib/modules/errores/domain/error-codes.ts`: el código
  `delivery_exceeds_surplus` con su texto (§2.8).
- `lib/modules/inventario/domain/finished-goods-dispatch.ts`: `FinishedProductDeliveryCatalog`,
  `FinishedGoodsDirectDispatch` y los tipos de §2.2. En `finished-goods-return.ts`,
  `orderId: string | null`.
- `lib/modules/inventario/domain/inventory-movement.ts`, `reservation.ts`, `list-batch-movements.ts`
  y `finished-product-detail.ts`: los tipos de §2.2–§2.4.
- `lib/modules/pedidos/adapters/driving/order-actions.ts`: las cinco actions de §2.7, cableadas.
- `lib/composition/index.ts`: las claves nuevas, con dobles mínimos donde aún no hay adaptador.
- `lib/modules/pedidos/index.ts` e `lib/modules/inventario/index.ts`: exportan lo anterior.
- `tests/fixtures/direct-delivery.ts` (§2.9). Ajustes mínimos en fixtures y tests que construyen los
  tipos que cambian, con nota fechada.

Cubre: R23 (funciones puras), base de R9–R11 y R18.

**Hecho cuando:** las cinco verificaciones están anotadas, el gate de la tanda está en verde y hay
commit `feat(QC-288): publica el contrato de la entrega sin pedido`.

---

## [ ] B1 — Migraciones y esquema (depende de T0)

- `db/migrations/<ts>_inventory_movement_kind_direct_delivery/` y `<ts>_direct_deliveries/`, con
  `migration.sql` y `down.sql` (`design.md > 1.1`, `1.2`).
  - Las comprobaciones previas de §1.2 se hacen contra la base de test.
  - Los timestamps van detrás de la última migración de `origin/dev`.
- `db/schema.prisma` (§1.3).
- Tests:
  - `tests/integration/pedidos/direct-deliveries-migration.int.test.ts` (nuevo):
    - up sobre entregas de QC-223/282 con anulaciones de QC-224, con filas, asientos y existencias
      intactos;
    - down sin entregas sin pedido, que deja el esquema previo;
    - down abortado con una entrega sin pedido y con un asiento de tipo nuevo (R42).
  - `tests/unit/pedidos/schema/direct-deliveries-migration.test.ts` (nuevo): texto del SQL y del
    `down.sql`, nombres en inglés (R41, R42).
  - `tests/integration/pedidos/direct-delivery-constraints.int.test.ts` (nuevo): un `INSERT` crudo por
    cada caso de R40, empresa B incluida.
  - `order-delivery-constraints.int.test.ts` y `order-delivery-void-constraints.int.test.ts`: se
    ejecutan sin cambios y siguen verdes.
- Censos: `guard-identificador-de-request.test.ts` (`MIGRACIONES_ESPERADAS`),
  `inventario-schema.test.ts` (enum), `pedidos-schema.test.ts` (referencias sin `@relation`), los
  censos de migraciones que tocan `products` si existen, y `tests/integration/aislamiento.json`.

Cubre: R40, R41, R42.

**Hecho cuando:** `pnpm run db:rollback` revierte las dos migraciones sobre la base de test, y el gate
de la tanda y las tres suites nuevas están en verde. Commit
`feat(QC-288): migra entregas sin pedido y sus asientos`.

---

## [ ] B2 [P] — `inventario`: salida, devolución y lecturas (depende de B1)

- `lib/modules/inventario/adapters/driven/persistence/product-prisma.ts`:
  - `dispatchFinishedGoods` con origen discriminado;
  - `lockFinishedProductForDelivery`;
  - `returnFinishedGoods` con `orderId` nulo → `direct_delivery_void`;
  - `writeMovement` con los dos tipos (§3.1).
- `finished-goods-dispatch-prisma.ts`: `createFinishedGoodsDirectDispatch(tx)`.
- `deliverable-batches-prisma.ts`: `findForDelivery` y `findSurplusBases` (§5).
- `batch-movement-prisma.ts`: selecciona `orderDeliveryId` y `orderDeliveryVoidId`.
- Tests:
  - u `tests/unit/inventario/finished-goods-dispatch-prisma.test.ts` (origen `direct`);
  - int `tests/integration/inventario/finished-goods-dispatch.int.test.ts` (origen `direct`, lote
    repetido entre clientes, lote de otro producto, empresa B: R32, R34, R37);
  - int `finished-goods-return.int.test.ts` (`orderId` nulo y producto dado de baja: R50);
  - int `deliverable-batches.int.test.ts` (lote sin contenido, empresa B: R9);
  - int `ledger-cuadre.int.test.ts` (+ caso sin pedido: R37).

Cubre: R9 (parte de `inventario`), R32, R34, R37, R50 (parte de `inventario`).

**Hecho cuando:** el gate de la tanda y las suites citadas están en verde y hay commit.

---

## [ ] B3 [P] — `pedidos`: adaptadores driven (depende de B1)

- `lib/modules/pedidos/adapters/driven/persistence/direct-delivery-prisma.ts` (nuevo):
  `findByKey`, `create`, `addLines` y `listWaitingLines` (§5).
- `order-delivery-prisma.ts`: `findByKey` con `orderId` nulo.
- `order-delivery-void-prisma.ts`: `findDelivery` con `productId` y `createdAt`; `findDeliveryLines`
  con `presentationLineId` nulo; `findByKey` con `orderId` nulo.
- `order-delivery-directory-prisma.ts`: `listDeliveryLines` con `orderId` nulo y `note`;
  `findCustomerIdsForMovements` (§5).
- Tests (int):
  - `tests/integration/pedidos/direct-delivery-repository.int.test.ts` (nuevo): clave duplicada y
    `listWaitingLines` con otra receta, otra presentación, otro estado, borrado, empresa B y líneas
    anuladas (R9);
  - `order-delivery-void-repository.int.test.ts` (entrega sin pedido);
  - `order-delivery-directory.int.test.ts` (mezcla y orden, nota, total, clientes por asiento,
    empresa B: R52–R54).

Cubre: R9 (parte de `pedidos`), base de R38, R52–R54.

**Hecho cuando:** el gate de la tanda y las suites citadas están en verde y hay commit.

---

## [ ] B4 — `pedidos`: casos de uso (depende de T0; la integración, de B2 y B3)

- Implementa los cinco casos de uso de §2.6 y la transacción de §3 y §4. Incluye el paso 0 si T0 lo
  fijó.
- Enmienda `deliver-order.ts` y `void-delivery.ts` para los `orderId` nulos (§2.6, «Enmiendas»).
- Tests (u, con puertos dobles):
  - `get-direct-delivery.test.ts`, `list-direct-delivery-surplus.test.ts`, `deliver-direct.test.ts`,
    `get-direct-delivery-for-void.test.ts` y `void-direct-delivery.test.ts`. Cubren permiso primero,
    rol distinto y Administrador sin permiso (R2–R4), formas (R29, R47) y el número fijo de llamadas
    del listado (R8);
  - `deliver-order.test.ts` y `void-delivery.test.ts`, con los casos de clave y entrega de otro tipo
    (R38, R48).
- Tests (int):
  - `tests/integration/pedidos/direct-delivery.int.test.ts`: R30–R33, R36, R38, R39, con «20 en
    stock, 8 esperan → 12 pasa, 13 no» y empresa B;
  - `direct-delivery-concurrency.int.test.ts`: R35;
  - `direct-delivery-void.int.test.ts`: R47–R50, empresa B;
  - `direct-delivery-void-concurrency.int.test.ts`: R51.

Cubre: R2, R3, R4, R8, R29–R39, R47–R51.

**Hecho cuando:** el gate de la tanda y las suites citadas están en verde y hay commit.

---

## [ ] B5 — Actions, composición y lecturas de `inventario` (depende de B4)

- `lib/modules/pedidos/adapters/driving/order-actions.ts`: el cuerpo real de las cinco actions.
- `lib/composition/index.ts`: atado real (§6).
- `lib/modules/inventario/domain/list-finished-product-deliveries.ts`: `withoutOrder` y `note`; números
  solo para `orderId` no nulo (§2.4).
- `lib/modules/inventario/domain/list-batch-movements.ts`: `customerNames` con el hueco nuevo, una
  llamada por directorio (§2.3).
- Tests:
  - u `tests/unit/inventario/list-finished-product-deliveries.test.ts` (R52, R53);
  - u `list-batch-movements.test.ts` (R54);
  - u `tests/unit/identity/session-once-per-request-actions.test.ts` (`ACCIONES` + cinco).

Cubre: R52, R53, R54 (dominio).

**Hecho cuando:** el gate de la tanda está en verde y hay commit.

---

## [ ] F1 — Subir los bloques de entrega a `components/shared` (depende de T0)

- Mueve a `components/shared/`, con la misma API (§7.1):
  - `app/(private)/pedidos/components/order-customer-label.ts`;
  - `order-customer-picker.tsx`;
  - `order-delivery-customer-block.tsx`.
- `app/(private)/pedidos/components/index.ts` los reexporta desde `shared`. Los imports relativos de
  `/pedidos` pasan a `@/components/shared/…`.
- `components/shared/CATALOGO.md`: tres filas con su `Diseño` (§7.1).
- Los tests de las tres piezas y del sheet de QC-282 siguen verdes sin cambiar aserciones. Solo
  cambian rutas de import, con nota.

Cubre: base de R12–R16 y R19.

**Hecho cuando:** el gate de la tanda está en verde, con `guard-catalogo-de-componentes` y los tests
de `pedidos-ui` incluidos, y hay commit `refactor(QC-288): sube los bloques de entrega a shared`.

---

## [ ] F2 — Sheet «Entregar sin pedido» y borrador (depende de F1 y T0)

- `app/(private)/inventario/components/direct-delivery-sheet.tsx`, `direct-delivery-surplus-card.tsx`,
  `direct-delivery-draft.ts` y `use-direct-delivery-draft.ts` (§7.2, §7.3), contra las actions
  mockeadas y las fixtures de T0.
- `app/(private)/inventario/components/index.ts`: los exporta.
- Tests (ui):
  - `tests/unit/inventario-ui/direct-delivery-surplus-card.test.tsx` (R10, R11);
  - `direct-delivery-sheet.test.tsx` (R12–R22, R24–R26, payload exacto);
  - `direct-delivery-draft.test.ts` (R27, R28).
- `tests/unit/pedidos/direct-delivery.test.ts`: el caso de fuentes de R23 (sheet y `deliver-direct.ts`).

Cubre: R10–R28.

**Hecho cuando:** el gate de la tanda está en verde (con `product-route-contract.test.ts`) y hay
commit.

---

## [ ] F3 — Entradas: cabecera de la ficha y menú del listado (depende de F2)

- `app/(private)/inventario/components/direct-delivery-button.tsx` (nuevo).
- `finished-product-header.tsx`: prop `actions`.
- `app/(private)/inventario/producto-terminado/[id]/page.tsx`: permiso y excedente (§7.4).
- `app/(private)/inventario/components/product-row-actions.tsx`: prop `directDelivery`.
- `finished-stock-table.tsx`: `surplusByProduct`.
- `finished-stock-list-section.tsx`: una llamada por página.
- Tests (ui):
  - `finished-product-header.test.tsx` y `finished-product-page.test.tsx` (R5);
  - `tests/unit/inventario/finished-stock-table.test.tsx` (`ProductRowActions` se prueba ahí y en
    `product-batches-sheet.test.tsx`; no hay `product-row-actions.test.tsx`) (R6, R7);
  - `finished-stock-list-section.test.tsx` (R8, una sola llamada);
  - `direct-delivery-button.test.tsx` (R7).

Cubre: R5, R6, R7, R8 (pantalla).

**Hecho cuando:** el gate de la tanda está en verde y hay commit.

---

## [ ] F4 [P] — Tab Entregas y diálogo de anular (depende de F1 y T0)

- `app/(private)/inventario/producto-terminado/[id]/components/direct-delivery-void-dialog.tsx` (nuevo).
- `finished-product-deliveries-table.tsx`: «Sin pedido», nota y `canVoidDirect`.
- `finished-product-list-section.tsx`: el permiso.
- `components/index.ts` de la ficha.
- `tests/unit/inventario/producto-terminado/finished-product-route-contract.test.ts`: la enmienda de
  QC-225 R7 (§9).
- Tests (ui):
  - `finished-product-tables.test.tsx` (R43, R52, R55);
  - `direct-delivery-void-dialog.test.tsx` (R44–R46).

Cubre: R43–R46, R52, R55 (pantalla).

**Hecho cuando:** el gate de la tanda está en verde y hay commit.

---

## [ ] F5 [P] — Historial del lote y tabs de movimientos (depende de T0)

- `app/(private)/inventario/components/batch-history.tsx`: etiquetas y clientes (§7.6).
- `app/(private)/inventario/producto-terminado/[id]/components/finished-product-movements-table.tsx`:
  orígenes.
- Tests (ui): `tests/unit/inventario/batch-history.test.tsx` (R54) y `finished-product-tables.test.tsx`
  (R55, orígenes).

Cubre: R54, R55.

**Hecho cuando:** el gate de la tanda está en verde y hay commit.

---

## [ ] TC — Barrido de censos y guardias (depende de B1–B5 y F1–F5)

Recorre la tabla de `design.md > 9` fila por fila:
- verifica las marcadas «sin cambio»;
- aplica las enmiendas que falten;
- amplía `order-delivery-append-only.test.ts` (R41);
- confirma que no hay camino nuevo de escritura de `product_batches`;
- confirma que el catálogo de permisos y los seeds no cambian (R1).

**Hecho cuando:** `pnpm exec vitest run guard` y los censos citados están en verde, cada enmienda
lleva su nota y hay commit.

---

## [ ] TI — E2E (depende de TC)

- `e2e/entrega-sin-pedido.spec.ts` (nuevo), con los cinco recorridos de R56 y sus comprobaciones en
  Postgres.
- `guard-identificador-de-request.test.ts` (`E2E_ESPERADOS`).
- Si el diálogo o el sheet cambian algo que pisan, revisa `e2e/entrega-a-varios-clientes.spec.ts`,
  `anular-entrega.spec.ts`, `detalle-de-producto-terminado.spec.ts` y `producto-terminado.spec.ts`.
  Lo más probable es la ruta de import de F1; sin cambios de pasos.

Cubre: R56.

**Hecho cuando:** `pnpm exec playwright test e2e/entrega-sin-pedido.spec.ts` y los cuatro E2E citados
están en verde y hay commit.

---

## [ ] TZ — Cierre (depende de TI)

- `./init.sh` en verde.
- Mapa `R<n> → test` completo en `progress/impl_QC-288.md` (R1–R57). Ningún requisito sin test.
- R57: `guard-dependencias-aprobadas` en verde y `package.json` sin cambios.
- `progress/features/QC-288.md` actualizado.

**Hecho cuando:** todo lo anterior está hecho y el leader puede pasar a revisión.

---

## Archivos esperados

Producción:
- `db/schema.prisma`
- `db/migrations/<ts>_inventory_movement_kind_direct_delivery/migration.sql`
- `db/migrations/<ts>_inventory_movement_kind_direct_delivery/down.sql`
- `db/migrations/<ts>_direct_deliveries/migration.sql`
- `db/migrations/<ts>_direct_deliveries/down.sql`
- `lib/modules/pedidos/domain/direct-delivery.ts`
- `lib/modules/pedidos/domain/get-direct-delivery.ts`
- `lib/modules/pedidos/domain/list-direct-delivery-surplus.ts`
- `lib/modules/pedidos/domain/deliver-direct.ts`
- `lib/modules/pedidos/domain/get-direct-delivery-for-void.ts`
- `lib/modules/pedidos/domain/void-direct-delivery.ts`
- `lib/modules/pedidos/domain/deliver-order.ts`
- `lib/modules/pedidos/domain/void-delivery.ts`
- `lib/modules/pedidos/domain/errors.ts`
- `lib/modules/pedidos/ports/direct-delivery-repository.ts`
- `lib/modules/pedidos/ports/direct-delivery-unit-of-work.ts`
- `lib/modules/pedidos/ports/order-delivery-repository.ts`
- `lib/modules/pedidos/ports/order-delivery-void-repository.ts`
- `lib/modules/pedidos/adapters/driven/persistence/direct-delivery-prisma.ts`
- `lib/modules/pedidos/adapters/driven/persistence/order-delivery-prisma.ts`
- `lib/modules/pedidos/adapters/driven/persistence/order-delivery-void-prisma.ts`
- `lib/modules/pedidos/adapters/driven/persistence/order-delivery-directory-prisma.ts`
- `lib/modules/pedidos/adapters/driving/order-actions.ts`
- `lib/modules/pedidos/index.ts`
- `lib/modules/errores/domain/error-codes.ts`
- `lib/modules/inventario/domain/finished-goods-dispatch.ts`
- `lib/modules/inventario/domain/finished-goods-return.ts`
- `lib/modules/inventario/domain/inventory-movement.ts`
- `lib/modules/inventario/domain/reservation.ts`
- `lib/modules/inventario/domain/list-batch-movements.ts`
- `lib/modules/inventario/domain/finished-product-detail.ts`
- `lib/modules/inventario/domain/list-finished-product-deliveries.ts`
- `lib/modules/inventario/adapters/driven/persistence/product-prisma.ts`
- `lib/modules/inventario/adapters/driven/persistence/finished-goods-dispatch-prisma.ts`
- `lib/modules/inventario/adapters/driven/persistence/finished-goods-return-prisma.ts`
- `lib/modules/inventario/adapters/driven/persistence/deliverable-batches-prisma.ts`
- `lib/modules/inventario/adapters/driven/persistence/batch-movement-prisma.ts`
- `lib/modules/inventario/adapters/driven/persistence/finished-product-detail-prisma.ts`
- `lib/modules/inventario/ports/finished-product-detail-repository.ts`
- `lib/modules/inventario/index.ts`
- `lib/composition/index.ts`
- `components/shared/order-customer-label.ts`
- `components/shared/order-customer-picker.tsx`
- `components/shared/order-delivery-customer-block.tsx`
- `components/shared/CATALOGO.md`
- `app/(private)/pedidos/components/order-customer-label.ts`
- `app/(private)/pedidos/components/order-customer-picker.tsx`
- `app/(private)/pedidos/components/order-delivery-customer-block.tsx`
- `app/(private)/pedidos/components/index.ts`
- `app/(private)/pedidos/components/order-delivery-sheet.tsx`
- `app/(private)/pedidos/components/order-form.tsx`
- `app/(private)/pedidos/components/order-customer-filter.tsx`
- `app/(private)/pedidos/components/order-customer-dialog.tsx`
- `app/(private)/pedidos/components/order-columns.tsx`
- `app/(private)/pedidos/components/order-table.tsx`
- `app/(private)/pedidos/components/order-list-section.tsx`
- `app/(private)/inventario/components/direct-delivery-sheet.tsx`
- `app/(private)/inventario/components/direct-delivery-surplus-card.tsx`
- `app/(private)/inventario/components/direct-delivery-draft.ts`
- `app/(private)/inventario/components/use-direct-delivery-draft.ts`
- `app/(private)/inventario/components/direct-delivery-button.tsx`
- `app/(private)/inventario/components/product-row-actions.tsx`
- `app/(private)/inventario/components/finished-stock-table.tsx`
- `app/(private)/inventario/components/finished-stock-list-section.tsx`
- `app/(private)/inventario/components/batch-history.tsx`
- `app/(private)/inventario/components/index.ts`
- `app/(private)/inventario/producto-terminado/[id]/page.tsx`
- `app/(private)/inventario/producto-terminado/[id]/components/finished-product-header.tsx`
- `app/(private)/inventario/producto-terminado/[id]/components/finished-product-deliveries-table.tsx`
- `app/(private)/inventario/producto-terminado/[id]/components/finished-product-list-section.tsx`
- `app/(private)/inventario/producto-terminado/[id]/components/finished-product-movements-table.tsx`
- `app/(private)/inventario/producto-terminado/[id]/components/direct-delivery-void-dialog.tsx`
- `app/(private)/inventario/producto-terminado/[id]/components/index.ts`

Tests:
- `tests/fixtures/direct-delivery.ts`
- `tests/fixtures/order-delivery.ts`
- `tests/fixtures/order-delivery-void.ts`
- `tests/fixtures/finished-product-detail.ts`
- `tests/fixtures/adjust-batch-stock.ts`
- `tests/unit/pedidos/direct-delivery.test.ts`
- `tests/unit/pedidos/get-direct-delivery.test.ts`
- `tests/unit/pedidos/list-direct-delivery-surplus.test.ts`
- `tests/unit/pedidos/deliver-direct.test.ts`
- `tests/unit/pedidos/get-direct-delivery-for-void.test.ts`
- `tests/unit/pedidos/void-direct-delivery.test.ts`
- `tests/unit/pedidos/deliver-order.test.ts`
- `tests/unit/pedidos/void-delivery.test.ts`
- `tests/unit/pedidos/order-delivery-append-only.test.ts`
- `tests/unit/pedidos/schema/direct-deliveries-migration.test.ts`
- `tests/unit/pedidos/schema/pedidos-schema.test.ts`
- `tests/unit/inventario/schema/inventario-schema.test.ts`
- `tests/unit/inventario/finished-goods-dispatch-prisma.test.ts`
- `tests/unit/inventario/list-finished-product-deliveries.test.ts`
- `tests/unit/inventario/list-batch-movements.test.ts`
- `tests/unit/inventario/batch-history.test.tsx`
- `tests/unit/inventario/producto-terminado/finished-product-route-contract.test.ts`
- `tests/unit/inventario/product-route-contract.test.ts`
- `tests/unit/inventario-ui/direct-delivery-surplus-card.test.tsx`
- `tests/unit/inventario-ui/direct-delivery-sheet.test.tsx`
- `tests/unit/inventario-ui/direct-delivery-draft.test.ts`
- `tests/unit/inventario-ui/direct-delivery-button.test.tsx`
- `tests/unit/inventario-ui/direct-delivery-void-dialog.test.tsx`
- `tests/unit/inventario-ui/finished-product-header.test.tsx`
- `tests/unit/inventario-ui/finished-product-page.test.tsx`
- `tests/unit/inventario/product-batches-sheet.test.tsx`
- `tests/unit/inventario/finished-stock-table.test.tsx`
- `tests/unit/inventario-ui/finished-stock-list-section.test.tsx`
- `tests/unit/inventario-ui/finished-product-tables.test.tsx`
- `tests/unit/identity/session-once-per-request-actions.test.ts`
- `tests/unit/errores/catalogo.test.ts`
- `tests/guards/guard-identificador-de-request.test.ts`
- `tests/integration/aislamiento.json`
- `tests/integration/pedidos/direct-deliveries-migration.int.test.ts`
- `tests/integration/pedidos/direct-delivery-constraints.int.test.ts`
- `tests/integration/pedidos/direct-delivery-repository.int.test.ts`
- `tests/integration/pedidos/direct-delivery.int.test.ts`
- `tests/integration/pedidos/direct-delivery-concurrency.int.test.ts`
- `tests/integration/pedidos/direct-delivery-void.int.test.ts`
- `tests/integration/pedidos/direct-delivery-void-concurrency.int.test.ts`
- `tests/integration/pedidos/order-delivery-void-repository.int.test.ts`
- `tests/integration/pedidos/order-delivery-directory.int.test.ts`
- `tests/integration/inventario/finished-goods-dispatch.int.test.ts`
- `tests/integration/inventario/finished-goods-return.int.test.ts`
- `tests/integration/inventario/deliverable-batches.int.test.ts`
- `tests/integration/inventario/ledger-cuadre.int.test.ts`
- `e2e/entrega-sin-pedido.spec.ts`

Rutas de los tests de UI confirmadas en T0 (2026-10-16): `finished-product-tables.test.tsx` vive en
`tests/unit/inventario-ui/` y `batch-history.test.tsx` en `tests/unit/inventario/`.
`product-row-actions.test.tsx` no existe: `ProductRowActions` se prueba en
`tests/unit/inventario/finished-stock-table.test.tsx` y `product-batches-sheet.test.tsx`, que
sustituyen a esa fila. El censo de códigos de error es `tests/unit/errores/catalogo.test.ts`.
