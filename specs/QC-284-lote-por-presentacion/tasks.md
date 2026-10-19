# QC-284 — lote-por-presentacion · tasks.md

> Orden por dependencias. `[P]` = puede ir en paralelo con las otras `[P]` del mismo bloque. Cada
> task cierra con `pnpm run typecheck`, `pnpm run lint`, `pnpm exec vitest related --run <archivos>`
> y, si toca guardias, `pnpm exec vitest run guard`. Los tests nombran el `R<n>` en el título del
> caso.

## Bloque A — Base de datos (backend_dev)

- [x] **T1. Migración de los índices** (R1, R2, R28, R29).
  `db/migrations/20261014200000_product_batches_lot_per_presentation/migration.sql` y `down.sql`
  según `design.md > 1.2`. Quitar `@@unique([companyId, lot])` y reescribir el comentario de
  `ProductBatch` en `db/schema.prisma`. Añadir el nombre a
  `tests/guards/guard-identificador-de-request.test.ts`.
  **Hecho:** `db:migrate` y `db:rollback` pasan sobre la base de test; test de esquema
  (`inventario-schema.test.ts`) exige que no haya `@@unique` de lote; test de migración nuevo que
  lee el SQL y comprueba el orden (crear, crear, quitar) y el aborto del `down`; integración: con
  dos lotes de una empresa con el mismo código en productos distintos, el rollback aborta entero
  con su mensaje (R29), y sin ellos deja `product_batches_company_lot_unique` de vuelta.

## Bloque B — `inventario` (backend_dev), depende de T1

- [x] **T2. `isDuplicateBatchLot` con los dos índices** (R1, R2, R6, R7).
  `design.md > 2.1`. **Hecho:** integración contra base real: misma clave → `P2002` reconocido en
  los dos índices; mismo código con otro producto, otra presentación, o con y sin presentación →
  se escribe (R3); `cr-2610` vs `CR-2610` y otra empresa → se escribe (R4); dos altas tecleadas
  simultáneas con la misma clave → una gana y la otra `batch_duplicate_lot` sin filas (R6); alta
  tecleada con clave existente → `batch_duplicate_lot` sin producto ni lote (R7). Unit del
  reintento actualizado a las columnas nuevas.

- [x] **T3. [P] Correlativo intacto** (R5). Integración: con `7` en un producto y `50` en otro, el
  siguiente generado es `51`. **Hecho:** test verde sin cambiar `resolveLot`.

- [x] **T4. [P] Texto de `batch_duplicate_lot`** (R8). `error-catalog.ts` y
  `tests/unit/errores/catalogo.test.ts`. **Hecho:** el catálogo devuelve el texto exacto de
  `design.md > 5.3`; el código no cambia.

- [x] **T5. Importación por la clave** (R9, R10, R11). `design.md > 3`: `findBatchesByLots` con
  `presentationId`, `ImportCatalogSnapshot`, `checkLot` por clave, retirar
  `lot_used_by_other_product` (contrato, textos, `confirm-inventory-import.ts`), `lotClash` →
  `duplicate`. **Hecho:** unit del plan: misma clave en base o en fila anterior → `duplicate`;
  código de otro producto en base o en fila anterior → `create`/`add_batch`; vista previa y
  confirmación coinciden; ningún resultado lleva `lot_used_by_other_product`. Integración de la
  confirmación con una carrera de la misma clave → `duplicate`.

- [x] **T6. [P] Ajuste y devolución con código compartido** (R12). Sin cambio de código esperado.
  **Hecho:** integración: dos lotes de la empresa con el mismo código (productos distintos); el
  ajuste por conteo de uno no cambia el otro; la devolución por anulación vuelve al lote de origen
  y el listado de entregas muestra el código de cada lote.

- [x] **T7. Contrato y adaptador de datos de lote** (R18, R21, R22, R23). `design.md > 2.2, 2.3`:
  `FinishedBatchLabels.writeForOrder` con `label` único y `no_batches`; `writeFinishedBatchLabels`
  escribe en todos los lotes del pedido con el choque por clave. **Hecho:** integración: escribe la
  misma terna en los dos lotes del pedido sin tocar `stock`, coste, compra, presentación, producto,
  contenido ni asientos; mismo código en otra producción de la misma presentación →
  `duplicate_lot` sin escribir nada; mismo código en otro producto o en el otro lote del pedido →
  se escribe; el código que ya tiene → se escribe; pedido sin lotes → `no_batches`; dos guardados
  simultáneos de pedidos distintos con la misma clave → uno gana, el otro `duplicate_lot` y sin
  filas escritas. Las guardias del libro siguen verdes sin cambios.

## Bloque C — `asignaciones` (backend_dev), depende de T7

- [x] **T8. Caso de uso de guardar** (R19, R20, R21, R23, R24, R27). `design.md > 4.1`.
  **Hecho:** unit con puertos simulados: forma de la entrada (y `lines`/`batchId` → `invalid_input`
  sin puertos); orden permiso → entrada → pedido → fechas → escritura; traducción de
  `no_batches` y `duplicate_lot`; en `TERMINADO`/`ENTREGADO` no se cambia estado, `finishedAt` ni
  equipo (integración, R27).

- [x] **T9. [P] El formulario del detalle** (R14, R15, R16, R17). `batchDataForm` en
  `conditioning-batch-data.ts` y `ConditioningBatchData.form` en `conditioning-order-view.ts`.
  **Hecho:** unit puro: `empty`, `shared`, `divergent` (datos a medias, lotes distintos, fechas
  distintas con el mismo lote, línea sin lote como `null`) y `no_batches`; el detalle no invoca
  ninguna escritura (R16).

- [x] **T10. Server Action** (R19, R25). `design.md > 4.2`. **Hecho:** unit: lee un valor por
  campo, ya no devuelve `batchId`, entrega los códigos del catálogo.

- [x] **T11. [P] Seed de demo.** `scripts/seed-demo/gateway.ts > saveDemoBatchData` llama con la
  entrada nueva. **Hecho:** typecheck verde; el seed guarda un único lote por pedido.

## Bloque D — Pantalla (frontend_dev), depende de T9 y T10

- [x] **T12. Formulario único** (R13, R14, R15, R17, R25). `design.md > 5.1, 5.2`.
  **Hecho:** test de componente: un solo juego de tres campos y un botón; valores iniciales con
  `shared`; vacíos sin aviso con `empty`; vacíos con `Notice` `warning`, la lista por línea y
  «sin lote» con `divergent`; deshabilitado con `no_batches`; tras un rechazo, `role="alert"`,
  `aria-invalid` solo en el campo del código y lo escrito se conserva; 16 px, 44 px, `type="date"`
  y etiquetas. Test de la pantalla y paridad (snapshot) actualizados.

## Bloque E — Verificación (implementer), depende de todo lo anterior

- [x] **T13. E2E** (R26, R30). Reescribir `e2e/datos-de-lote-en-acondicionamiento.spec.ts` al
  recorrido de R30, con la siembra actual más un lote de otra producción de la presentación de la
  línea 1 con código conocido. **Hecho:** `pnpm exec playwright test
  e2e/datos-de-lote-en-acondicionamiento.spec.ts` verde en Chromium y WebKit.

- [x] **T14. Cierre** (R31, R32). Mapa `R<n> -> test` en `progress/impl_QC-284.md`;
  `package.json` y `pnpm-lock.yaml` sin cambios; `pnpm exec vitest run guard` verde; `./init.sh`
  verde.

## Archivos esperados

- `db/schema.prisma`
- `db/migrations/20261014200000_product_batches_lot_per_presentation/migration.sql`
- `db/migrations/20261014200000_product_batches_lot_per_presentation/down.sql`
- `lib/modules/errores/domain/error-catalog.ts`
- `lib/modules/inventario/index.ts`
- `lib/modules/inventario/domain/finished-batch-labels.ts`
- `lib/modules/inventario/domain/inventory-import-contract.ts`
- `lib/modules/inventario/domain/plan-inventory-import.ts`
- `lib/modules/inventario/domain/confirm-inventory-import.ts`
- `lib/modules/inventario/domain/preview-inventory-import.ts`
- `lib/modules/inventario/ports/inventory-import-repository.ts`
- `lib/modules/inventario/adapters/driven/persistence/product-prisma.ts`
- `lib/modules/inventario/adapters/driven/persistence/finished-batch-labels-prisma.ts`
- `lib/modules/inventario/adapters/driven/persistence/inventory-import-prisma.ts`
- `lib/modules/asignaciones/index.ts`
- `lib/modules/asignaciones/domain/save-conditioning-batch-data.ts`
- `lib/modules/asignaciones/domain/conditioning-batch-data.ts`
- `lib/modules/asignaciones/domain/conditioning-order-view.ts`
- `lib/modules/asignaciones/domain/errors.ts`
- `lib/modules/asignaciones/adapters/driving/order-conditioning-actions.ts`
- `app/(private)/asignacion/acondicionamiento/[id]/components/conditioning-batch-data-form.tsx`
- `app/(private)/asignacion/acondicionamiento/[id]/components/conditioning-order-screen.tsx`
- `app/(private)/inventario/importar/components/import-texts.ts`
- `scripts/seed-demo/gateway.ts`
- `tests/guards/guard-identificador-de-request.test.ts`
- `tests/unit/inventario/schema/inventario-schema.test.ts`
- `tests/unit/inventario/schema/product-batch-lot-per-presentation-migration.test.ts`
- `tests/unit/inventario/product-batch-lot-retry.test.ts`
- `tests/unit/inventario/plan-inventory-import.test.ts`
- `tests/unit/inventario/confirm-inventory-import.test.ts`
- `tests/unit/inventario/preview-inventory-import.test.ts`
- `tests/unit/inventario/inventory-import-kit.ts`
- `tests/unit/errores/catalogo.test.ts`
- `tests/unit/asignaciones/save-conditioning-batch-data.test.ts`
- `tests/unit/asignaciones/conditioning-batch-data.test.ts`
- `tests/unit/asignaciones/get-conditioning-order.test.ts`
- `tests/unit/asignaciones/order-conditioning-actions.test.ts`
- `tests/unit/asignaciones-ui/conditioning-batch-data-form.test.tsx`
- `tests/unit/asignaciones-ui/conditioning-order-screen.test.tsx`
- `tests/unit/paridad/asignacion-acondicionamiento-paridad.test.tsx`
- `tests/unit/paridad/__snapshots__/asignacion-acondicionamiento-paridad.test.tsx.snap`
- `tests/integration/inventario/product-batch-lot.int.test.ts`
- `tests/integration/inventario/product-batch-lot-per-presentation.int.test.ts`
- `tests/integration/inventario/product-batch-lot-per-presentation-migration.int.test.ts`
- `tests/integration/inventario/finished-batch-labels.int.test.ts`
- `tests/integration/inventario/inventory-import-confirm.int.test.ts`
- `tests/integration/inventario/inventory-import-repository.int.test.ts`
- `tests/integration/inventario/adjust-by-count.int.test.ts`
- `tests/integration/inventario/finished-goods-return.int.test.ts`
- `tests/integration/asignaciones/finish-conditioning-batch-data.int.test.ts`
- `tests/integration/aislamiento.json`
- `e2e/datos-de-lote-en-acondicionamiento.spec.ts`
