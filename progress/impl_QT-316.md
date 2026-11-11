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

## Tanda 2 (T3, T4, T5) — backend_dev, 2026-11-11

Grafo: no usado (sin índice de este worktree); Grep/Read. No hizo falta regenerar tipos.

### Archivos

**T3 — `countLineEvidence`**
- `lib/modules/asignaciones/domain/order-evidence.ts`: tipo `LineEvidenceCount`.
- `lib/modules/asignaciones/domain/count-line-evidence.ts` (nuevo): `createCountLineEvidence`, `CountLineEvidenceDeps`. Orden: permiso, `z.strictObject` (máx. 25 pares uuid), quita pares repetidos, `countByLines` (1 llamada), `readRecipeOutlines` solo de los pedidos con fotos (1), `findRefsIncludingDeleted` solo si hace falta algún nombre (1). `recipeName` si el outline tiene más de una receta (canceladas incluidas) y la línea está en él; si no, `null`.
- `lib/modules/asignaciones/index.ts`: exporta `LineEvidenceCount`, `createCountLineEvidence`, `CountLineEvidenceDeps`.
- `tests/unit/asignaciones/count-line-evidence.test.ts` (nuevo).

**T4 — `getLineEvidence`**
- `lib/modules/asignaciones/domain/get-line-evidence.ts` (nuevo): `createGetLineEvidence`, `GetLineEvidenceDeps` (= `ReadOrderEvidenceDeps`). Orden: permiso, entrada mal formada → `OrderNotFoundError`, `readOrderEvidenceByLine` (sin cambiarla), la receta de la línea. Si no trae fotos, el outline del pedido: línea viva → evidencia vacía; si no → `OrderNotFoundError`.
- `lib/modules/asignaciones/index.ts`: exporta `createGetLineEvidence`, `GetLineEvidenceDeps`.
- `tests/unit/asignaciones/get-line-evidence.test.ts` (nuevo).

**T5 — actions y composición**
- `lib/modules/asignaciones/adapters/driving/order-evidence-actions.ts`: `getLineEvidenceAction(orderId, lineId)` (firma caída → `log.warn('evidence_read_signing_failed', { orderId, lineId, message })`), `countLineEvidenceAction(lines)` y `LineEvidenceCountResult`. Las dos de hoy se quedan hasta T8.
- `lib/composition/index.ts`: `asignaciones.getLineEvidence` (orderCatalog, stepEvidenceRepository, evidenceStorage) y `asignaciones.countLineEvidence` (stepEvidenceRepository, orderCatalog, recipeCatalog), tras `countOrderEvidence`.
- `tests/fixtures/order-evidence.ts`: `EVIDENCE_LINE_ID` y `LINE_EVIDENCE_COUNTS` (aditivo; `ORDER_EVIDENCE_COUNTS` sale en T8).
- `tests/unit/asignaciones/order-evidence-actions.test.ts`: `describe` de las dos actions de línea.
- `tests/unit/composition/asignaciones-facade.test.ts`: censo 35 → 37 (`countLineEvidence`, `getLineEvidence`), comentario 2026-11-11 QT-316; dos casos `QT-316 R13` de rechazo sin `pedidos.consultar`.
- `tests/unit/identity/session-once-per-request-actions.test.ts`: filas de `getLineEvidenceAction` y `countLineEvidenceAction` en `ACCIONES`, comentario 2026-11-11 QT-316.

### Mapa R<n> → test (tanda 2)

| R | Archivo | Caso(s) |
|---|---|---|
| R1 | `count-line-evidence.test.ts` | `R1: dos recetas del mismo pedido se cuentan por separado, cada una con sus fotos` |
| R2 | ídem | `R2: una receta sin fotos no sale aunque otra del mismo pedido tenga…`; `R2: sin ninguna receta con fotos devuelve [] sin leer pedidos ni recetas` |
| R4 | ídem | `R4: 25 lineas de 10 pedidos se cuentan con una llamada a cada puerto`; `R4: los pares repetidos…`; `R4: la lista vacia…` |
| R4 | `order-evidence-actions.test.ts` | `R4: entrega el actor y los pares al caso de uso en una llamada…` |
| R6 | `get-line-evidence.test.ts` | `R6 R20: en un pedido de dos recetas solo salen las de la linea nombrada…`; `R6: la otra receta del pedido lee solo las suyas`; `R6: una receta viva del pedido sin fotos devuelve la evidencia vacia` |
| R6 | `order-evidence-actions.test.ts` | `R6: entrega el actor de la sesion, el pedido y la linea…` |
| R7 | `count-line-evidence.test.ts` | `R7: con dos recetas en el pedido, una cancelada, la receta se nombra` |
| R8 | ídem | `R8: con una sola receta en el pedido, recipeName es null…` |
| R9 | ídem | `R9: si la receta no vuelve del catalogo…`; `R9: si el pedido no vuelve del catalogo de pedidos…`; `R9 R12: una linea quitada del pedido con fotos cuenta, sin nombre de receta` |
| R10 | `get-line-evidence.test.ts` | `R10: con la firma caida los grupos salen con su cantidad, sin fotos…` |
| R10 | `order-evidence-actions.test.ts` | `R10: con la firma caida … en el log con la linea`; `R10: un error inesperado no se filtra…` |
| R12 | `get-line-evidence.test.ts` | `R12: un pedido dado de baja…`; `R12: una linea quitada del pedido que tiene fotos las sigue mostrando` |
| R12 | `count-line-evidence.test.ts` | `R12: una receta borrada del catalogo sigue con su nombre`; `R9 R12: …linea quitada…` |
| R13 | `count-line-evidence.test.ts`, `get-line-evidence.test.ts` | `R13: …` (actor ausente, sin conjunto, vacío, todo menos el permiso, Administrador sin el permiso, otro rol con él, autorización antes de validar; ningún puerto llamado) |
| R13 | `asignaciones-facade.test.ts` | `QT-316 R13: getLineEvidence / countLineEvidence rechaza sin pedidos.consultar sin llegar a la base` |
| R13 | `order-evidence-actions.test.ts` | `R13: sin sesion…`; `R13: un actor sin el permiso llega igual al caso de uso…`; `R13: unauthorized se traduce…` |
| R14 | `get-line-evidence.test.ts` | `R14: pedido ajeno, linea de otro pedido, linea inexistente y linea quitada sin fotos dan el mismo error`; `R14: el pedido de otra empresa no firma…`; `R14: un pedido inexistente…`; `R14: la entrada %j es order_not_found…`; `R14: lista las fotos y el pedido con la empresa del actor` |
| R14 | `order-evidence-actions.test.ts` | `R14: order_not_found se traduce por su code` |
| R15 | `count-line-evidence.test.ts` | `R15: 26 lineas…`; `R15: %s responde invalid_input…`; `R15: una linea de otra empresa…`; `R15: una linea pedida con otro pedido…`; `R15: cuenta con la empresa del actor…` |
| R15 | `order-evidence-actions.test.ts` | `R15: invalid_input se traduce por su code` |
| R16 | `get-line-evidence.test.ts` | `R16: reutiliza la lectura del pedido por linea…`; además `get-execution-evidence.test.ts` y `read-order-evidence.test.ts` verdes sin tocarlos |
| R17 | `count-line-evidence.test.ts`, `get-line-evidence.test.ts` | `R17: no llama a ningun metodo de escritura…` |
| R20 | `get-line-evidence.test.ts` | `R6 R20: …en sus tres fases` (acondicionamiento incluido) |

### Verificación (salida real, un comando a la vez, `--maxWorkers=1`)

- `pnpm run typecheck`: exit 0, 0 errores.
- `pnpm run lint`: exit 0, `✖ 11 problems (0 errors, 11 warnings)`, la base. La primera pasada dio 12: el aviso nuevo era `_companyId` sin usar en `count-line-evidence.test.ts`, ya corregido.
- Tests tocados (`count-line-evidence`, `get-line-evidence`, `order-evidence-actions`, `asignaciones-facade`, `session-once-per-request-actions`): 5 archivos, 234/234.
- Los que los usan y R16 (`get-execution-evidence`, `read-order-evidence`, `get-order-evidence`, `count-order-evidence`, `recipe-of-order`, `execution-trace-actions`, `order-evidence`, `batch-evidence-dialog`, `finished-product-batches-evidence`, `evidence-step-list`, `execution-trace-detail`, `execution-trace-evidence`, `planta-varias-recetas`, `trace-evidence-placement`): 14 archivos, 212/212.
- `tests/unit/recetas/{authorization,module-contract,scope}.test.ts` (los que barren el árbol): 3 archivos, 23/23.
- `pnpm exec vitest run guard`: 87 archivos, 1335 pasados, 22 saltados, 0 rojos.

Veredicto: tanda 2 (T3, T4, T5) hecha; typecheck, lint, tests tocados y guardias en verde.
