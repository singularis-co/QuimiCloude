# impl_QT-316 — evidencias-del-lote-por-receta

## Tanda 1 (T1, T2) — backend_dev, 2026-11-11

Grafo: no usado; el MCP no tiene índice de este worktree (design.md lo anota). Todo con Grep/Read.
Antes del primer typecheck hizo falta `pnpm exec prisma generate` y `pnpm exec next typegen`
(worktree sin artefactos; es lo que `scripts/gate-proyecto.sh` corre siempre).

### Archivos

**T1 — la línea del lote en `inventario`**
- `lib/modules/inventario/domain/finished-product-detail.ts`: `FinishedProductBatchRow.orderLineId: string | null`.
- `lib/modules/inventario/ports/finished-product-detail-repository.ts`: comentario de `listBatches`.
- `lib/modules/inventario/adapters/driven/persistence/finished-product-detail-prisma.ts`: el `select` del asiento `production` suma `orderLineId`; mapeo `row.movements[0]?.orderLineId ?? null`.
- `tests/fixtures/finished-product-detail.ts`: `FINISHED_ORDER_LINE_ID` y el campo en `finishedProductBatchRow` / `UNPACKAGED_BATCH_ROW`.
- `tests/unit/inventario/list-finished-product-batches.test.ts`: `crudoDe` lleva `orderLineId`; caso nuevo.
- `tests/integration/inventario/finished-product-detail.int.test.ts`: el `toEqual` exacto del caso R13/R14 gana `orderLineId`; caso nuevo.

**T2 — `StepEvidenceRepository.countByLines`**
- `lib/modules/asignaciones/ports/step-evidence-repository.ts`: el método (archivo existente; no nace nada en `ports/`).
- `lib/modules/asignaciones/adapters/driven/persistence/step-evidence-prisma.ts`: un `groupBy` por `['orderId', 'orderLineId']`, `where: { companyId, orderLineId: { in } }`, descarta el grupo cuyo `orderId` no es el del par; lista vacía sin consulta. Sin filtro de fase (las tres). `countByOrders` intacto.
- `tests/unit/asignaciones/evidence-doubles.ts`, `tests/helpers/evidence-off.ts`: el método en los dobles.
- `tests/integration/asignaciones/step-evidence-repository.int.test.ts`: `watchGroupBy()` y `describe('countByLines: fotos por linea de la empresa (QT-316)')`.

### Mapa R<n> → test (tanda 1)

| R | Archivo | Caso |
|---|---|---|
| R5 | `tests/integration/inventario/finished-product-detail.int.test.ts` | `QT-316 R5: cada lote con asiento production trae la linea de ese asiento; el de apertura, null` |
| R5 | `tests/unit/inventario/list-finished-product-batches.test.ts` | `QT-316 R5: cada fila conserva el orderLineId del puerto, o null en un lote sin pedido` |
| R1 | `tests/integration/asignaciones/step-evidence-repository.int.test.ts` | `QT-316 R1: dos lineas del mismo pedido se cuentan por separado, en una sola consulta` |
| R20 | ídem | `QT-316 R20: las fotos de acondicionamiento cuentan junto a las de fabricacion y envasado` |
| R2 | ídem | `QT-316 R2: una linea sin fotos no sale en el resultado` |
| R15 | ídem | `QT-316 R15: una fila de otra empresa no cuenta aunque se pida su linea` |
| R15 | ídem | `QT-316 R15: un par con el orderId cambiado no cuenta las fotos de la linea` |
| R4 | ídem | `QT-316 R4: con la lista vacia devuelve un Map vacio sin consultar` |

### Verificación (salida real, un comando a la vez, `--maxWorkers=1`)

- `pnpm run typecheck`: exit 0, 0 errores.
- `pnpm run lint`: exit 0, `✖ 11 problems (0 errors, 11 warnings)`, ninguno en archivos tocados.
- Unit, por ruta:
  - `list-finished-product-batches.test.ts`: 1 archivo, 10/10.
  - 10 de `tests/unit/asignaciones/` que usan `evidence-doubles`: 10 archivos, 168/168.
  - 14 de `tests/unit/inventario{,-ui}/` que usan la fixture: 14 archivos, 205/205.
  - 10 de `tests/unit/recetas/` que usan `evidence-off`: 10 archivos, 160/160.
- Integración, base efímera copiada de la plantilla (DATABASE_URL del `.env` del checkout principal, solo en ese shell):
  - `step-evidence-repository.int.test.ts` + `finished-product-detail.int.test.ts`: 2 archivos, 43/43.
  - 8 `.int` que usan `evidence-off`: 8 archivos, 81/81.
- `pnpm exec vitest run guard`: exit 0, 87 archivos, 1335 pasados, 22 saltados, 0 rojos.

Veredicto: tanda 1 (T1, T2) hecha; typecheck, lint, tests tocados y guardias en verde.
