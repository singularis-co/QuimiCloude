# QC-307 — precio-de-venta-del-pedido · tasks.md

> Desglose de `design.md`. `[P]` = paralelizable con las otras `[P]` de su misma tanda una vez
> cumplidas sus dependencias. Cada task cierra con `pnpm run typecheck`, `pnpm run lint` y
> `pnpm exec vitest related --run <archivos tocados>` en verde (`docs/perfil-agentes.md > Todos
> los agentes`). El mapa `R<n> -> test` va en `progress/impl_QC-307.md`.

## Tanda 1 — base

- [ ] **T1 · Migración y esquema** (backend) — R2, R9, R18
  - `db/migrations/20261022120000_orders_sale_price/migration.sql` y `down.sql`, exactamente como
    `design.md > 1.2`.
  - `db/schema.prisma`: `salePrice` en `Order`, con su comentario (`design.md > 1.1`).
  - Test estático nuevo `tests/unit/pedidos/schema/orders-sale-price-migration.test.ts`, con el
    patrón de `orders-actual-cost-migration.test.ts` (predicado sobre el texto real + versión
    mutada en memoria). Afirma:
    - columna opcional `DECIMAL(14,4)` llamada `sale_price`;
    - CHECK `IS NULL OR >= 0`;
    - ni `UPDATE`, ni `DEFAULT`, ni columna de moneda;
    - el `down.sql` quita exactamente la restricción y la columna;
    - `schema.prisma` declara `salePrice Decimal? @map("sale_price") @db.Decimal(14, 4)`.
  - **Hecho:**
    - `pnpm exec prisma validate` pasa;
    - la migración aplica y revierte (`pnpm run db:rollback`) sobre la base local;
    - el test estático está en verde y en rojo con la versión mutada.

## Tanda 2 — dominio (depende de T1)

- [ ] **T2 · Esquema de entrada** (backend) [P] — R3, R4, R5, R6, R7, R8, R14
  - `order-input.ts`: `salePriceSchema` y `createOrderSchema.salePrice` (`design.md > 2.1`).
  - `tests/unit/pedidos/order-input.test.ts`, un caso por cada uno de estos:
    - ausente, `''` y `'   '` dan `null`;
    - `'0'` y `'0.0000'` se aceptan;
    - `'1250.5'` se acepta;
    - `'9999999999.9999'` se acepta;
    - `'-1'` falla;
    - `'1,5'` falla;
    - `'1e3'` falla;
    - `'1.12345'` falla;
    - `'12345678901'` falla;
    - `'abc'` falla;
    - una clave `currency` se descarta;
    - `updateOrderDistributionSchema` con `salePrice` falla por `.strict()`.
  - **Hecho:** los casos en verde. Los de `unitPrice` que ya existen siguen en verde sin tocarlos.

- [ ] **T3 · Tipos y comentarios del contrato** (backend) [P] — R1, R2, R17
  - `order-view.ts`: `salePrice` en `NewOrder`, `OrderRow` y `OrderView`. Se ajustan los tres
    comentarios «No es un precio de venta» (`design.md > 2.3`).
  - `order-input.ts:18-24`: «el precio **unitario** sigue fuera».
  - `order-catalog.ts`: `AssignedOrderSummary` **no** cambia. Se añade una línea al comentario de
    `:284-288` diciendo que el precio de venta tampoco está, a propósito (QC-307 R17).
  - `tests/unit/pedidos/order-view.test.ts`:
    - el caso de QC-123 R1 deja de afirmar que falta `salePrice` y conserva `price`, `unitPrice`
      y `total` en negativo;
    - se añaden el positivo de `salePrice` en `NewOrder`, `OrderRow` y `OrderView`, y el negativo
      en `AssignedOrderSummary`;
    - se añade el negativo de `margin` y `profit` en `OrderView` (R23).
  - **Hecho:** `typecheck` en verde **después** de T4 (los fixtures). El test de tipos está en verde.

- [ ] **T4 · Fixtures** (backend + frontend) — depende de T3
  - Se añade `salePrice: null` a cada literal de `OrderRow` / `OrderView` / `OrderSummary` de los
    tests y helpers listados en `## Archivos esperados > Fixtures`. **No** se cambia ninguna
    aserción.
  - **Hecho:** `pnpm run typecheck` en verde y `vitest related` de esos archivos en verde, sin un
    solo cambio de expectativa.

- [ ] **T5 · Casos de uso y adaptadores** (backend) — depende de T2, T3 — R6, R10, R11, R12, R13, R15, R16, R17, R20, R23
  - `create-order.ts` y `update-order.ts` pasan `salePrice` en `NewOrder` / `OrderEdit`
    (`design.md > 3.1`, `> 3.2`).
  - `order-edit-change.ts`: `ComparableEdit.salePrice` y `sameSalePrice`.
  - `get-order.ts`: `salePrice: row.salePrice` en la vista.
  - `order-prisma.ts`: cambios de `ORDER_SELECT`, `toOrderRow`, `insertAliveOrder` y
    `updateAliveOrder` (`design.md > 4.1`).
  - `order-actions.ts`: `salePrice` en `buildCreateCandidate` (`design.md > 4.2`).
  - Unidad:
    - `create-order.test.ts`:
      - con precio y sin precio, el puerto recibe `'…'` o `null`;
      - sin `pedidos.modificar` falla con `unauthorized` antes del `parse` y sin escribir (R15);
      - `'-1'` falla con `invalid_input` sin escribir (R7);
      - el `ingredientsCost` es el mismo con precio que sin él (R23).
    - `update-order.test.ts`:
      - la edición sustituye el precio, lo pone a 0 y lo quita (R10);
      - en un estado no editable, el cambio de precio falla con `invalid_transition` sin escribir
        (R11);
      - cliente y precio cambiados a la vez: va por el camino completo y escribe los dos (R12);
      - solo el cliente cambiado: va por el atajo y `updateAlive` no se llama (R13).
    - `order-edit-change.test.ts`, `isCustomerOnlyEdit` con precio:
      - `null` frente a `null` es igual;
      - `null` frente a `'0'` es distinto;
      - `'12.5'` frente a `'12.5000'` es igual;
      - `'12.5'` frente a `'13'` es distinto.
    - `get-order.test.ts` / `list-orders.test.ts`:
      - la vista lleva `salePrice`;
      - sin `pedidos.consultar` no se lee el repositorio (R16);
      - un `sort=salePrice` y un filtro `salePrice` se podan y se anotan (R20).
    - `set-order-customer.test.ts` / `update-order-presentation-lines.test.ts`: el puerto que
      llaman no recibe precio (R13).
  - `asignaciones` (R17), en `list-assigned-orders.test.ts` y `get-assigned-order-execution.test.ts`:
    - se cuela `salePrice: '99.0000'` en el resumen de los casos `CLAVE_DE_IMPORTE` que ya existen;
    - se añade el `@ts-expect-error` de `salePrice` sobre `AssignedOrderSummary` y sobre
      `AssignedOrderExecutionView`.
  - Integración nueva `tests/integration/pedidos/order-sale-price.int.test.ts`, contra la base real:
    - el alta con `'1250.5'` se lee como `'1250.5000'`; con `'0'`, como `'0.0000'`; sin precio,
      como `null` (R2, R6);
    - un `UPDATE` crudo a `-1` falla con `23514` (R9);
    - la edición sustituye el precio y lo quita (R10);
    - `setCustomerAlive`, `updatePresentationLinesAlive`, `cancelAlive` y el borrado lógico dejan
      `sale_price` intacto (R13);
    - el resumen de `OrderCatalog` que lee `asignaciones` no trae ninguna clave de precio, con un
      pedido que sí lo tiene (R17);
    - una fila insertada sin la columna queda en `NULL` (R18).
  - **Hecho:**
    - unidad en verde;
    - `pnpm exec vitest run tests/integration/pedidos/order-sale-price.int.test.ts` en verde;
    - `pnpm exec vitest run guard` en verde (ámbito de empresa, convenciones de `pedidos`).

## Tanda 3 — pantalla (depende de T5; espera a P1 si el humano pide tablero)

- [ ] **T6 · Columna y tarjeta** (frontend) [P] — R19, R20
  - `order-columns.tsx`: `AmountCell` y la columna `salePrice` antes de «Costo estimado»
    (`design.md > 6.2`).
  - `order-list-skeleton.tsx`: 15.
  - `order-columns.test.tsx`:
    - la lista acordada pasa a quince ids, en el orden nuevo;
    - la celda con precio, la celda sin precio (marcador de ausencia) y la celda con 0
      (`$ 0.00`, no ausencia);
    - el `title` lleva el valor exacto;
    - la columna no declara `sortable` ni `filter`.
  - `order-cards.test.tsx`: la tarjeta pinta el precio con su rótulo.
  - **Hecho:**
    - tests en verde;
    - `order-list-skeleton.test.tsx` en verde sin tocarlo;
    - `guard-pantalla-pedidos-se-amplia.test.ts` en verde, porque solo se ganan exportaciones.

- [ ] **T7 · Campo del formulario** (frontend) [P] — R21
  - `order-form.tsx`: `ORDER_BUSINESS_FIELDS`, `FIELD_MESSAGES`, `FIELD_LABELS` y el `OrderField`
    (`design.md > 6.1`).
  - Test nuevo `tests/unit/pedidos-ui/order-form-sale-price.test.tsx`:
    - el alta envía `salePrice` en el `FormData`;
    - la edición precarga `'1250.5'` desde `'1250.5000'`, y vacío desde `null`;
    - `'-1'` señala el campo sin llamar a la action y conserva lo escrito;
    - el campo no es `required`.
  - **Hecho:** test en verde; `formularios-paridad` y `campos-paridad` en verde. Si cambia una
    instantánea, se revisa y se actualiza a conciencia, con nota en `progress/impl_QC-307.md`.

- [ ] **T8 · E2E** (frontend) — depende de T6, T7 — R22
  - `e2e/pedido-precio-de-venta.spec.ts`, el recorrido de `design.md > 7`.
  - **Hecho:** `pnpm exec playwright test e2e/pedido-precio-de-venta.spec.ts` en verde.

## Tanda 4 — documentación (puede ir en paralelo desde la tanda 1)

- [ ] **T9 · Enmiendas** [P] — cierra la decisión 1
  - `docs/architecture.md > Preguntas abiertas del dominio`: punto 4 y `### Por qué`
    (`design.md > 9`).
  - `specs/QC-123-el-total-del-pedido-decidir-donde-vive-el-precio/requirements.md`: la nota
    debajo de `[D1]`, sin reescribir la fila.
  - **Hecho:**
    - `docs/architecture.md` ya no contiene «No existe ningun precio de venta» y dice que el precio
      existe, es del pedido entero, se escribe a mano y no sustituye al coste;
    - la fila `[D1]` de QC-123 está intacta y lleva su nota;
    - el validador del perfil de `./init.sh` está en verde.

## Cierre

- [ ] **T10 · Verificación local y trazabilidad** — depende de todas
  - `./init.sh` en verde.
  - `progress/impl_QC-307.md` con el mapa R1…R23 → test concreto (archivo y nombre del caso).
  - **Hecho:** cada `R<n>` tiene al menos un test que falla si se rompe.

## Archivos esperados

### Base y dominio

- `db/schema.prisma`
- `db/migrations/20261022120000_orders_sale_price/migration.sql`
- `db/migrations/20261022120000_orders_sale_price/down.sql`
- `lib/modules/pedidos/domain/order-input.ts`
- `lib/modules/pedidos/domain/order-view.ts`
- `lib/modules/pedidos/domain/order-catalog.ts`
- `lib/modules/pedidos/domain/order-edit-change.ts`
- `lib/modules/pedidos/domain/create-order.ts`
- `lib/modules/pedidos/domain/update-order.ts`
- `lib/modules/pedidos/domain/get-order.ts`
- `lib/modules/pedidos/adapters/driven/persistence/order-prisma.ts`
- `lib/modules/pedidos/adapters/driving/order-actions.ts`

### Pantalla

- `app/(private)/pedidos/components/order-form.tsx`
- `app/(private)/pedidos/components/order-columns.tsx`
- `app/(private)/pedidos/components/order-list-skeleton.tsx`

### Tests nuevos

- `tests/unit/pedidos/schema/orders-sale-price-migration.test.ts`
- `tests/integration/pedidos/order-sale-price.int.test.ts`
- `tests/unit/pedidos-ui/order-form-sale-price.test.tsx`
- `e2e/pedido-precio-de-venta.spec.ts`

### Tests con casos nuevos

- `tests/unit/pedidos/order-input.test.ts`
- `tests/unit/pedidos/order-view.test.ts`
- `tests/unit/pedidos/create-order.test.ts`
- `tests/unit/pedidos/update-order.test.ts`
- `tests/unit/pedidos/order-edit-change.test.ts`
- `tests/unit/pedidos/get-order.test.ts`
- `tests/unit/pedidos/list-orders.test.ts`
- `tests/unit/pedidos/set-order-customer.test.ts`
- `tests/unit/pedidos/update-order-presentation-lines.test.ts`
- `tests/unit/asignaciones/list-assigned-orders.test.ts`
- `tests/unit/asignaciones/get-assigned-order-execution.test.ts`
- `tests/unit/pedidos-ui/order-columns.test.tsx`
- `tests/unit/pedidos-ui/order-cards.test.tsx`

### Fixtures (solo ganan `salePrice: null`)

- `tests/helpers/order-unit-of-work-double.ts`
- `tests/unit/pedidos/transition-order.test.ts`
- `tests/unit/pedidos/delete-order.test.ts`
- `tests/unit/pedidos/cancel-order.test.ts`
- `tests/unit/pedidos/company-scope.test.ts`
- `tests/unit/pedidos/company-isolation-service.test.ts`
- `tests/unit/pedidos/order-packing.test.ts`
- `tests/unit/pedidos/order-customer-write.test.ts`
- `tests/unit/pedidos/quote-order-cost.test.ts`
- `tests/unit/pedidos/order-service.test.ts`
- `tests/unit/pedidos/list-orders-customer.test.ts`
- `tests/unit/shared-ui/confirm-dialog-montado.test.tsx`
- `tests/unit/paridad/campos-paridad.test.tsx`
- `tests/unit/paridad/pedidos-paridad.test.tsx`
- `tests/unit/paridad/formularios-paridad.test.tsx`
- `tests/unit/paridad/confirmaciones-paridad.test.tsx`
- `tests/unit/pedidos-ui/cancel-order-dialog.test.tsx`
- `tests/unit/pedidos-ui/delete-order-dialog.test.tsx`
- `tests/unit/pedidos-ui/order-customer-dialog.test.tsx`
- `tests/unit/pedidos-ui/order-delivery-sheet.test.tsx`
- `tests/unit/pedidos-ui/order-distribution-dialog.test.tsx`
- `tests/unit/pedidos-ui/order-form-customer.test.tsx`
- `tests/unit/pedidos-ui/order-form-leftover.test.tsx`
- `tests/unit/pedidos-ui/order-form-quote.test.tsx`
- `tests/unit/pedidos-ui/order-form.test.tsx`
- `tests/unit/pedidos-ui/order-list-section-produced.test.tsx`
- `tests/unit/pedidos-ui/order-list-section.test.tsx`
- `tests/unit/pedidos-ui/order-row-actions.test.tsx`
- `tests/unit/pedidos-ui/order-sheet-coverage.test.tsx`
- `tests/unit/pedidos-ui/order-row-wiring.test.tsx`
- `tests/unit/pedidos-ui/order-sheet-responsibles.test.tsx`
- `tests/unit/pedidos-ui/order-sheet.test.tsx`
- `tests/unit/pedidos-ui/order-table.test.tsx`
- `tests/unit/pedidos-ui/pedidos-page-header.test.tsx`
- `tests/unit/pedidos-ui/pedidos-toasts.test.tsx`
- `tests/unit/pedidos-ui/pedidos-viewport.test.tsx`
- `tests/unit/pedidos-ui/read-only.test.tsx`

### Documentación y estado

- `docs/architecture.md`
- `specs/QC-123-el-total-del-pedido-decidir-donde-vive-el-precio/requirements.md`
- `progress/impl_QC-307.md`
