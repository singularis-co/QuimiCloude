# QC-281 — Envases reales al terminar el empaque · tasks

Orden: T1 → T2 → (T3 ∥ T4) → T5 → T6 → (T7 ∥ T8 ∥ T9 ∥ T10) → T11 → T12 → T13.
`[P]` = puede ir en paralelo con las otras `[P]` de su bloque. Cada task cierra con
`pnpm run typecheck`, `pnpm run lint` y `pnpm exec vitest related --run <archivos tocados>`; el
nombre de cada test lleva su `R<n>` (`docs/conventions.md > Tests`).

## [x] T1 — Migración y esquema
- Añadir `packedPackages`, `packedReason`, `packedReasonOther` a `OrderPresentationLine` en
  `db/schema.prisma`; `pnpm run db:migrate:create` → `..._order_presentation_lines_packed_count`;
  escribir los cuatro `CHECK` de `design.md § 1` en `migration.sql` y su `down.sql`.
- Test de esquema: la migración declara los cuatro `CHECK`; la lista de `packed_reason_in_catalog`
  es igual a `PACKING_DIFFERENCE_REASONS`; el tope `char_length(...) <= 200` del `CHECK` coincide con
  `PACKING_REASON_OTHER_MAX`; `down.sql` revierte columnas y constraints.
- **Hecho:** `db:migrate` y `db:rollback` limpios en local; test de esquema verde. (R16, R25)

## [x] T2 — Dominio puro del conteo (depende de T1)
- `lib/modules/pedidos/domain/packing-count.ts`: `PACKING_DIFFERENCE_REASONS`,
  `PACKING_INCREASE_REASONS`, `PACKING_REASON_OTHER_MAX`, `checkPackingCounts`, `effectivePackages`,
  `packedTotalInOrderUnit` (envuelve `sumInOrderUnit`), `maxPackagesForLine`.
- Exportar `STOCK_INCREASE_REASONS` en `lib/modules/inventario/index.ts`; exportar lo nuevo en
  `lib/modules/pedidos/index.ts`. Documentar `DistributionLine.packages` como entero ≥ 0.
- Tests unitarios: conjunto exacto de líneas; entero ≥ 0 con 0 aceptado; motivo sí/no según
  diferencia; sentido (Merma/Rotura no valen para más); «Otro» con texto 1..200 tras trim (201 rechazado); total en
  unidad del pedido con mezcla de unidades; máximo por línea; `effectivePackages` con `null`.
- **Hecho:** tests verdes. (R2–R8, R13, R15, R25)

## [x] T3 [P] — Liquidar envases con conteo real en `inventario` (depende de T2)
- `MaterialReservations.settlePackagingForOrder` en `lib/modules/inventario/domain/reservation.ts`
  e implementación en `reservation-prisma.ts` (`design.md § 4`).
- Tests de integración: menos → consume real y asiento `release` por la diferencia, disponible del
  envase sube; 0 → todo liberado, nada consumido; más con libre suficiente → consume apartado +
  exceso de lotes no apartados por otros; más sin libre → `insufficient` y nada escrito; apartado
  ajeno no se toca; otra empresa no se ve.
- **Hecho:** tests verdes. (R17, R18, R19, R29)

## [x] T4 [P] — Puerto y adaptador de líneas en `pedidos` (depende de T1)
- `OrderWriteRepository.recordPackedCounts` y `FinishPackingLine.packedPackages`
  (`ports/order-write-repository.ts`); implementación en `order-prisma.ts`
  (`findPresentationLinesForFinishOrder` lee `packed_packages`).
- `AssignedOrderPresentationLine` gana `id` y `packedPackages` (`domain/order-catalog.ts`,
  `adapters/driven/persistence/order-catalog-prisma.ts`).
- Tests de integración: escribe solo líneas del pedido y la empresa dados; una línea de otro pedido
  u otra empresa no cambia; el `CHECK` rechaza motivo incoherente y un texto de «Otro» de 201
  caracteres escritos a mano.
- **Hecho:** tests verdes. (R16, R29)

## [x] T5 — Terminar con conteo real en `pedidos` (depende de T2, T3, T4)
- `order-packing.ts`: flujo de `design.md § 3`; `OrderCatalog['finishPackingAliveById']` con
  `counts` y los tres resultados nuevos (`order-catalog.ts`); `errors.ts` si hace falta.
- Actualizar dobles: `tests/helpers/order-unit-of-work-double.ts`.
- Tests unitarios (`tests/unit/pedidos/order-packing.test.ts`) e integración
  (`tests/integration/pedidos/finish-with-finished-goods.int.test.ts` u hermano nuevo):
  `invalid_packing_count`; `packed_exceeds_quantity` con unidades mixtas; igual a la cantidad se
  acepta; lote con `real × contenido`; línea en 0 sin lote; todas las líneas en 0 → `POR_ACONDICIONAR`
  sin lotes y envases liberados; coste total igual que con el plan, coste por unidad = coste / total
  real y suma de lotes = coste; rechazo deja estado, líneas, reservas y existencias intactas; segundo
  envío → `not_packable`; envase que también es ingrediente conserva lo de hoy.
- **Hecho:** tests verdes. (R15, R16, R18–R22, R30, R32)

## [x] T6 — Caso de uso y acción en `asignaciones` (depende de T5)
- `finish-packing.ts`: zod con `lines`, paso de `counts`, mapeo de resultados nuevos;
  `errors.ts` con `PackedExceedsQuantityError` y `PackagingStockInsufficientError`;
  `ports/execution-transaction.ts`; `lib/modules/errores/domain/error-codes.ts` y
  `error-catalog.ts` con los dos códigos; `lib/composition/index.ts`.
- `order-packing-actions.ts`: `finishPackingInputFromFormData` (JSON de `lines`).
- Actualizar `tests/helpers/execution-transaction-on-client.ts`.
- Tests: sin permiso → rechazo antes de leer; otro empacador → `OrderPackingTakenError`; entrada
  sin `lines` o JSON roto → validación; mapeo de cada resultado nuevo a su código; acción con
  `FormData` válido redirige como hoy.
- **Hecho:** tests verdes; `guard-catalogo-de-errores`, `guard-autorizacion-por-permiso` y
  `guard-arquitectura-modulos` verdes. (R13, R14)

## [x] T7 [P] — Vista de empaque y acondicionamiento en `asignaciones` (depende de T4, T6)
- `packing-order-view.ts` / `get-packing-order.ts` / `list-packing-orders.ts`: fuera `packages`;
  dentro `finish` (`design.md § 2.4`) con `PackagingCatalog.findRefs` y unidades.
- `order-distribution-view.ts`: `lineId` y `packedPackages`; `conditioning-order-view.ts` pinta
  `effectivePackages`; `conditioning-batch-data.ts` (`missingBatchDataLines`) y
  `finish-conditioning.ts` ignoran líneas con efectivo 0.
- Tests: `finish` solo para el empacador en `EN_EMPAQUE`; `freePackages` = disponible libre;
  acondicionamiento no bloquea por una línea en 0 y muestra envases reales; pedido antiguo
  (`packedPackages` nulo) sigue como hoy.
- **Hecho:** tests verdes. (R1, R9, R23, R25)

## [x] T8 [P] — Entregas con envases reales en `pedidos` (depende de T4)
- `deliver-order.ts` y `get-order-delivery.ts`: `orderedPackages = effectivePackages(line)`.
- Tests: línea con menos reales → lo pendiente es el real y la entrega completa el pedido con el
  real; línea en 0 no pide nada; línea antigua usa el plan.
- **Hecho:** tests verdes. (R24, R25)

## T9 [P] — Diálogo y pantalla del empacador (depende de T6, T7)
- `packing-finish-dialog.tsx` nuevo (`design.md § 6`, tablero `EmpaqueTerminar*.dc.html`): textos
  del tablero en `PACKING_FINISH_DIALOG_TEXTS`, estados `igual`, `diferencia`, `otro`, `tope`,
  `stock`, `cero`, `sinMotivo`, responsive y animaciones de la ficha.
- `packing-order-screen.tsx`: fuera «Envases:» y `PACKING_ORDER_PACKAGES_TESTID`; Terminar (pie y
  último paso) abre el diálogo; `index.ts` del barrel de la ruta.
- `app/(private)/asignacion/components/packing-orders-columns.tsx`: fuera la columna «Envases».
- Tests de componente (`tests/unit/asignaciones-ui/`): prellenado; insignia ±N; motivos por sentido
  y vaciado al cambiar de sentido; «Otro» con texto y tope de 200 caracteres; «Elige un
  motivo.»/«Escribe el motivo.» y no envía; pie siempre visible; error de tope con máximo; error de
  stock; ayudas de liberar/salir; línea en 0; todas en 0 se puede Terminar; con pasos con foto la
  descripción acaba en el aviso de evidencias; Cancelar no envía; sin «Envases:» ni columna. Actualizar
  `packing-order-screen.test.tsx`, `packing-orders-columns.test.tsx`,
  `packing-order-evidence.test.tsx` y el snapshot de `confirmaciones-paridad`.
- **Hecho:** tests verdes; revisión visual contra los tableros en 1440/1024/390. (R1–R13, R32, R33)

## [x] T10 [P] — Tab «Reparto» (depende de T4)
- `FinishedDistributionDirectory` en `lib/modules/inventario/domain/finished-product-detail.ts`;
  `list-finished-product-distribution.ts`; export en `inventario/index.ts`; acción en
  `finished-product-actions.ts`.
- `packed-lines-directory-prisma.ts` en `pedidos` + cableado en `lib/composition/index.ts`.
- UI: `finished-product-params.ts` (`'reparto'`), `finished-product-tabs.tsx` («Reparto»),
  `finished-product-list-section.tsx`, `finished-product-distribution-table.tsx`, `index.ts`.
- Tests: sin `inventario.consultar` → rechazo; producto de otra empresa → no encontrado; solo
  pedidos empacados de esa receta + presentación; orden por número desc; filas igual / −N / +N /
  «Otro» entre comillas / «Sin lote» / «Empacado antes de QC-281»; vacío, error con «Reintentar»,
  paginación 10/25; añadir el directorio a `tests/integration/aislamiento.json` si aplica.
- **Hecho:** tests verdes. (R26–R29)

## [x] T11 — Limpieza de comentarios y E2E existentes (depende de T9)
- Ajustar los E2E que pulsan Terminar o miran «Envases:»/columna (`design.md § 10`).
- Limpiar comentarios de las líneas tocadas (`docs/conventions.md > Comentarios`).
- **Hecho:** `pnpm exec playwright test` de los specs tocados en verde.

## [x] T12 — E2E nuevo: inventario y coste (depende de T9, T10) (D11)
- `e2e/envases-reales-empaque.spec.ts`: pedido con dos líneas; Terminar con una línea −1 (Rotura) y
  otra +1 (Conteo físico) → existencias del envase (una libera, otra consume del libre), lotes con
  `real × contenido`, coste unitario = coste / total real; segundo caso con una línea en 0 → sin
  lote y acondicionamiento no bloqueado; tab «Reparto» muestra −1/+1 con motivo y «Sin lote».
  Caso de rechazo: exceso sin stock libre → «No alcanza el stock del envase…» y Terminar
  deshabilitado.
- **Hecho:** `pnpm exec playwright test e2e/envases-reales-empaque.spec.ts` verde. (R9, R17–R21,
  R23, R26, R27)

## [x] T13 — Cierre
- Mapa `R<n> → test` en `progress/impl_QC-281-envases-reales-al-terminar-empaque.md`.
- `./init.sh` verde (o `gate-completo` en el PR).
- **Hecho:** cada R1–R33 con su test; R31 lo cubre la guardia de dependencias del gate.

## Archivos esperados

- `db/schema.prisma`
- `db/migrations/20261015120000_order_presentation_lines_packed_count/migration.sql`
- `db/migrations/20261015120000_order_presentation_lines_packed_count/down.sql`
- `lib/modules/pedidos/domain/packing-count.ts`
- `lib/modules/pedidos/domain/order-distribution.ts`
- `lib/modules/pedidos/domain/order-packing.ts`
- `lib/modules/pedidos/domain/order-catalog.ts`
- `lib/modules/pedidos/domain/errors.ts`
- `lib/modules/pedidos/domain/deliver-order.ts`
- `lib/modules/pedidos/domain/get-order-delivery.ts`
- `lib/modules/pedidos/index.ts`
- `lib/modules/pedidos/ports/order-write-repository.ts`
- `lib/modules/pedidos/adapters/driven/persistence/order-prisma.ts`
- `lib/modules/pedidos/adapters/driven/persistence/order-catalog-prisma.ts`
- `lib/modules/pedidos/adapters/driven/persistence/packed-lines-directory-prisma.ts`
- `lib/modules/inventario/index.ts`
- `lib/modules/inventario/domain/reservation.ts`
- `lib/modules/inventario/domain/finished-product-detail.ts`
- `lib/modules/inventario/domain/list-finished-product-distribution.ts`
- `lib/modules/inventario/adapters/driven/persistence/reservation-prisma.ts`
- `lib/modules/inventario/adapters/driving/finished-product-actions.ts`
- `lib/modules/asignaciones/index.ts`
- `lib/modules/asignaciones/domain/finish-packing.ts`
- `lib/modules/asignaciones/domain/errors.ts`
- `lib/modules/asignaciones/domain/packing-order-view.ts`
- `lib/modules/asignaciones/domain/get-packing-order.ts`
- `lib/modules/asignaciones/domain/list-packing-orders.ts`
- `lib/modules/asignaciones/domain/order-distribution-view.ts`
- `lib/modules/asignaciones/domain/conditioning-order-view.ts`
- `lib/modules/asignaciones/domain/conditioning-batch-data.ts`
- `lib/modules/asignaciones/domain/finish-conditioning.ts`
- `lib/modules/asignaciones/ports/execution-transaction.ts`
- `lib/modules/asignaciones/adapters/driving/order-packing-actions.ts`
- `lib/modules/errores/domain/error-codes.ts`
- `lib/modules/errores/domain/error-catalog.ts`
- `lib/composition/index.ts`
- `app/(private)/asignacion/empaque/[id]/components/packing-finish-dialog.tsx`
- `app/(private)/asignacion/empaque/[id]/components/packing-order-screen.tsx`
- `app/(private)/asignacion/empaque/[id]/components/index.ts`
- `app/(private)/asignacion/components/packing-orders-columns.tsx`
- `app/(private)/inventario/producto-terminado/[id]/components/finished-product-params.ts`
- `app/(private)/inventario/producto-terminado/[id]/components/finished-product-tabs.tsx`
- `app/(private)/inventario/producto-terminado/[id]/components/finished-product-list-section.tsx`
- `app/(private)/inventario/producto-terminado/[id]/components/finished-product-distribution-table.tsx`
- `app/(private)/inventario/producto-terminado/[id]/components/index.ts`
- `tests/helpers/order-unit-of-work-double.ts`
- `tests/helpers/execution-transaction-on-client.ts`
- `tests/unit/pedidos/packing-count.test.ts`
- `tests/unit/pedidos/order-packing.test.ts`
- `tests/unit/pedidos/schema/order-presentation-lines-packed-count-migration.test.ts`
- `tests/unit/pedidos/deliver-order.test.ts`
- `tests/unit/asignaciones/finish-packing.test.ts`
- `tests/unit/asignaciones/order-packing-actions.test.ts`
- `tests/unit/asignaciones/conditioning-batch-data.test.ts`
- `tests/unit/asignaciones-ui/packing-finish-dialog.test.tsx`
- `tests/unit/asignaciones-ui/packing-order-screen.test.tsx`
- `tests/unit/asignaciones-ui/packing-orders-columns.test.tsx`
- `tests/unit/asignaciones-ui/packing-order-evidence.test.tsx`
- `tests/unit/paridad/confirmaciones-paridad.test.tsx`
- `tests/unit/paridad/__snapshots__/confirmaciones-paridad.test.tsx.snap`
- `tests/unit/inventario/list-finished-product-distribution.test.ts`
- `tests/unit/inventario-ui/finished-product-tables.test.tsx`
- `tests/unit/inventario-ui/finished-product-tabs.test.tsx`
- `tests/unit/inventario-ui/finished-product-params.test.ts`
- `tests/integration/pedidos/finish-with-finished-goods.int.test.ts`
- `tests/integration/pedidos/packed-lines-directory.int.test.ts`
- `tests/integration/inventario/settle-packaging.int.test.ts`
- `tests/integration/aislamiento.json`
- `e2e/envases-reales-empaque.spec.ts`
- `e2e/empaque.spec.ts`
- `e2e/pedido-en-varias-presentaciones.spec.ts`
- `e2e/envases-del-pedido.spec.ts`
- `e2e/pasos-de-envasado.spec.ts`
- `e2e/operario-rediseno.spec.ts`
- `e2e/helpers/confirm-dialog.ts`
