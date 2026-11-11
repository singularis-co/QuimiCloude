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

## Tanda 3 (frontend_dev, 2026-11-11)

### Archivos

**T6 — conteo por receta en Lotes**
- `app/(private)/inventario/producto-terminado/[id]/components/finished-product-list-section.tsx`: `loadEvidenceCounts` arma los pares `(orderId, orderLineId)` de las filas con pedido (sin repetir línea) y llama una vez a `countLineEvidenceAction`; mapa por `lineId` con `{ photoCount, recipeName }`. Ya no importa `countOrderEvidenceAction`.
- `.../components/finished-product-batches-table.tsx`: `EvidenceCounts` = `ReadonlyMap<lineId, { photoCount, recipeName }>`; la celda busca por `row.orderLineId`; sin entrada o con 0, «—». Pasa `lineId` y `recipeName` al botón.
- `tests/unit/inventario/producto-terminado/finished-product-route-contract.test.ts`: `LECTURAS_DE_EVIDENCIA` = `getLineEvidenceAction`, `countLineEvidenceAction` (comentario 2026-11-11, QT-316, P1); la fuente fabricada de R26 usa `getLineEvidenceAction`.
- `tests/unit/inventario-ui/finished-product-batches-evidence.test.tsx`: mocks a las actions de línea; los casos de QC-271 pasan a pares por línea; «R19 — dos lotes del mismo pedido muestran el mismo total» (QC-271) queda sustituido por `QT-316 R1` (comentario con fecha).
- `tests/unit/inventario-ui/finished-product-tables.test.tsx`: mock a las actions de línea; casos `QT-316 R4` y `QT-316 R13`.

**T7 — el diálogo de la receta**
- `.../components/batch-evidence-button.tsx`: props `lineId` y `recipeName`, al diálogo.
- `.../components/batch-evidence-dialog.tsx`: lee con `getLineEvidenceAction(orderId, lineId)` (el efecto depende de `lineId`); con `recipeName !== null` el título suma ` · <receta>` y la descripción es `recipeDescription`; `BATCH_EVIDENCE_TEXTS` gana `recipeDescription`, `conditioning`, `conditioningPhase`; tercer `PhaseSection` «Acondicionamiento» (`batch-evidence-conditioning`); `DialogTitle` con `break-words [overflow-wrap:anywhere]`. `components/shared/step-evidence` y `BATCH_EVIDENCE_DIALOG_CLASS` sin cambios.
- `tests/unit/inventario-ui/batch-evidence-dialog.test.tsx`: mock a `getLineEvidenceAction`; los casos de QC-271 con `lineId` y `recipeName={null}`; `describe('BatchEvidenceDialog, por receta')` nuevo.

Nota: en `tests/fixtures/order-evidence.ts`, `ORDER_EVIDENCE` suma 8 fotos (6 + 2) pero `ORDER_EVIDENCE_PHOTO_TOTAL` vale 9. Es de antes de esta tanda y no lo toqué (lo usan otros tests). Los casos R20 calculan el conteo de la celda a partir de la evidencia.

### Mapa R<n> → test (tanda 3)

| R | Archivo | Caso(s) |
|---|---|---|
| R1 | `finished-product-batches-evidence.test.tsx` | `QT-316 R1 — dos lotes del mismo pedido, cada uno con las fotos de su receta` |
| R2 | ídem | `QT-316 R2 — una receta sin fotos muestra «—» sin botón, aunque la otra receta del pedido tenga` |
| R3 | ídem | `QT-316 R3 — un lote sin pedido de origen sigue con «—», aunque el mapa tenga conteos` |
| R4 | `finished-product-tables.test.tsx` | `QT-316 R4 — 25 lotes de 10 pedidos: una sola lectura de conteos, con un par por receta` |
| R4 | `finished-product-batches-evidence.test.tsx` | `R16, QT-316 R4 — … se cuenta una vez por página` |
| R6 | `batch-evidence-dialog.test.tsx` | `QT-316 R6 — lee con el pedido y la línea del lote, y vuelve a leer si cambia la línea` |
| R6, R7 | `finished-product-batches-evidence.test.tsx` | `QT-316 R6, R7 — el botón abre el diálogo de su receta: lee por línea y nombra la receta` |
| R7 | `batch-evidence-dialog.test.tsx` | `QT-316 R7 — con varias recetas, el título nombra la receta y la descripción es la de la receta` |
| R8, R9 | ídem | `QT-316 R8, R9 — sin nombre de receta, título y descripción de hoy, y las fotos salen igual` |
| R10 | ídem | `QT-316 R10 — esqueleto con el conteo de la receta, y el error con «Reintentar»`; `QT-316 R10 — firma caída: los grupos de la receta con su cantidad y sin fotos` |
| R11 | ídem | `QT-316 R11 — el título parte palabras largas y el diálogo sigue a pantalla completa en teléfono` |
| R13 | `finished-product-tables.test.tsx` | `QT-316 R13 — sin pedidos.consultar no hay columna «Evidencia» ni se piden los conteos` |
| R20 | `batch-evidence-dialog.test.tsx` | `QT-316 R20 — grupo «Acondicionamiento» tras Envasado, con sus pasos y su total; la suma da el conteo`; `QT-316 R20 — sin fotos de acondicionamiento no hay sección, y la suma sigue dando el conteo` |

### Verificación (salida real, un comando a la vez, `--maxWorkers=1`)

- `pnpm run typecheck`: exit 0, 0 errores.
- `pnpm run lint`: `✖ 11 problems (0 errors, 11 warnings)`, la base.
- `batch-evidence-dialog`, `finished-product-batches-evidence`, `finished-product-tables`, `finished-product-route-contract`, `pedidos/scope`, `recetas/scope`, `finished-product-tabs`, `finished-product-page`, `finished-product-params`, `finished-product-header`, `direct-delivery-void-dialog`: `Test Files 11 passed (11)`, `Tests 155 passed (155)`.
- `pnpm exec vitest run guard`: `Test Files 87 passed (87)`, `Tests 1335 passed | 22 skipped (1357)`.

Veredicto: tanda 3 (T6, T7) hecha; la pantalla ya no importa las actions del pedido entero; typecheck, lint, tests tocados y guardias en verde.

## Tanda 4 (T8) — backend_dev, 2026-11-11

Grafo: no usado (lo tocado se vio con Grep/Read). P4 aplicada (retirada, aprobada con el spec). No hizo falta regenerar tipos.

### Archivos

**Borrados** (con `git rm`, quedan en el índice)
- `lib/modules/asignaciones/domain/get-order-evidence.ts`, `lib/modules/asignaciones/domain/count-order-evidence.ts`.
- `tests/unit/asignaciones/get-order-evidence.test.ts`, `tests/unit/asignaciones/count-order-evidence.test.ts`.

**`lib/`**
- `lib/modules/asignaciones/index.ts`: fuera `OrderEvidenceCount`, `createGetOrderEvidence` + `GetOrderEvidenceDeps`, `createCountOrderEvidence` + `CountOrderEvidenceDeps`.
- `lib/modules/asignaciones/domain/order-evidence.ts`: fuera `OrderEvidenceCount` y el comentario de `OrderEvidence.conditioning` («la ficha de producto terminado no lo pinta»).
- `lib/modules/asignaciones/domain/read-order-evidence.ts`: fuera `readOrderEvidence` (P4); su comentario (no mira la fórmula, `OrderNotFoundError`) pasa a `readOrderEvidenceByLine`, cuyo código no cambia (R16). `readOrderEvidenceRows`, `toEvidence`, `allRows` y `signAll` se quedan.
- `lib/modules/asignaciones/adapters/driving/order-evidence-actions.ts`: fuera `getOrderEvidenceAction`, `countOrderEvidenceAction` y `OrderEvidenceCountResult`; el comentario de la firma caída pasa a `getLineEvidenceAction`. Queda `OrderEvidenceResult` (lo usa `getLineEvidenceAction`).
- `lib/composition/index.ts`: fuera `getOrderEvidence` y `countOrderEvidence` y sus dos imports.
- `lib/modules/asignaciones/ports/step-evidence-repository.ts` y `adapters/driven/persistence/step-evidence-prisma.ts`: fuera `countByOrders` (P4).

**`tests/`**
- `tests/unit/asignaciones/evidence-doubles.ts` y `tests/helpers/evidence-off.ts`: fuera `countByOrders`.
- `tests/unit/asignaciones/read-order-evidence.test.ts`: los 17 casos de la lectura del pedido entero pasan a `readOrderEvidenceByLine`, sin perder ninguno (17 antes, 17 después). El ayudante `leerLinea` comprueba que la única receta devuelta es `LINEA` y entrega su evidencia. El caso «sin fotos» pasa a esperar `{ recipes: [] }`, que es lo que la lectura por línea devuelve sin fotos. Comentario 2026-11-11, QT-316, P1/P4. Nota: el archivo no tenía casos previos de `readOrderEvidenceByLine` (los de línea viven en `get-execution-evidence.test.ts`, sin tocar).
- `tests/unit/asignaciones/order-evidence-actions.test.ts`: fuera los `describe` y mocks de las dos actions retiradas; nuevo caso `R21: solo exporta getLineEvidenceAction y countLineEvidenceAction` (`Object.keys` del import del módulo).
- `tests/unit/composition/asignaciones-facade.test.ts`: censo 37 → 35 (salen las dos del pedido entero), título del `describe` e `it` reescritos, comentario 2026-11-11 (QT-316, tanda 4, P1). Los dos casos «QC-271 R2» pasan a las de línea: los casos existentes `getLineEvidence` / `countLineEvidence` se titulan ahora `QC-271 R2, QT-316 R13: …` (mismo permiso, `inventario.consultar` sin `pedidos.consultar`). El comentario histórico de QC-271 ya no nombra los símbolos (para que el Grep de R21 quede vacío).
- `tests/unit/identity/session-once-per-request-actions.test.ts`: sale la entrada de la action del pedido entero; comentario 2026-11-11 (QT-316, tanda 4, P1) en la de `getLineEvidenceAction`.
- `tests/integration/asignaciones/step-evidence-repository.int.test.ts`: sale el `describe` de `countByOrders`. T2 ya cubre sus 4 casos por línea (fases sumadas → `R20`; otra empresa → `R15`; sin fotos → `R2`; lista vacía sin consultar → `R4`). El `describe` de `countByLines` lo cita (`QC-271 R6, R29`), con comentario 2026-11-11, QT-316, P4.
- `tests/fixtures/order-evidence.ts`: fuera `ORDER_EVIDENCE_COUNTS` (`LINE_EVIDENCE_COUNTS` ya existía desde T5) y el import de `OrderEvidenceCount`.

**Encargo extra del coordinador: total de fotos del fixture**
- `tests/fixtures/order-evidence.ts`: `ORDER_EVIDENCE_PHOTO_TOTAL` deja el literal 9. Ahora sale de sumar `photoCount` de los grupos de las tres fases de `ORDER_EVIDENCE`, y vale 8 (6 de fabricación + 2 de envasado). Lleva comentario 2026-11-11, QT-316. El docstring de `ORDER_EVIDENCE` decía «Nueve fotos» y ahora dice «Ocho».
- `tests/unit/inventario-ui/batch-evidence-dialog.test.tsx` (solo este ajuste): el nombre accesible del botón en los dos `getByRole` del caso «R19, R24 — cerrar y volver a abrir» pasa del literal `9 fotos` a `${ORDER_EVIDENCE_PHOTO_TOTAL} fotos`. El botón se monta con `photoCount={ORDER_EVIDENCE_PHOTO_TOTAL}`, así que el caso comprueba lo mismo.
- `finished-product-batches-evidence.test.tsx` ya usaba la constante. Sus literales «6 / 3 / 2 fotos» son de mapas propios del caso y no dependen de ella. Ningún otro test de `tests/` usaba el literal.

### Mapa R<n> → test (tanda 4)

| R | Archivo | Caso(s) |
|---|---|---|
| R13 (y QC-271 R2) | `asignaciones-facade.test.ts` | `QC-271 R2, QT-316 R13: getLineEvidence / countLineEvidence rechaza sin pedidos.consultar sin llegar a la base` |
| R15 (y QC-271 R29) | `step-evidence-repository.int.test.ts` | `QT-316 R15, QC-271 R29: una fila de otra empresa no cuenta aunque se pida su linea` |
| R16 | `read-order-evidence.test.ts` | los 17 casos de `readOrderEvidenceByLine — …` (QC-271 R5, R7–R11, R29 y QC-299 R21, R32), sin cambio en el código de la función; `get-execution-evidence.test.ts` verde sin tocarlo |
| R21 | `order-evidence-actions.test.ts` | `R21: solo exporta getLineEvidenceAction y countLineEvidenceAction` |
| R21 | `asignaciones-facade.test.ts` | `R31: … ninguna mas` (censo de 35, sin las dos del pedido entero) |
| R21 | `finished-product-route-contract.test.ts` | `LECTURAS_DE_EVIDENCIA` solo admite las de línea (T6) |
| R21 | typecheck | los archivos borrados no se importan |

### Grep de R21

```
$ grep -rnE "getOrderEvidence|countOrderEvidence|readOrderEvidence\b|countByOrders|OrderEvidenceCount\b" app components lib tests e2e; echo "exit=$?"
exit=1
```
Sin coincidencias, `e2e/` incluido. `grep -rlE "get-order-evidence|count-order-evidence" app components lib tests e2e scripts docs *.json` tampoco da nada (exit 1).

### Verificación (salida real, un comando a la vez, `--maxWorkers=1`)

- `pnpm run typecheck`: exit 0, 0 errores.
- `pnpm run lint`: exit 0, `✖ 11 problems (0 errors, 11 warnings)`, la base; ninguno en archivos tocados.
- Tocados y R16 (`read-order-evidence`, `order-evidence-actions`, `get-execution-evidence`, `get-line-evidence`, `count-line-evidence`, `asignaciones-facade`, `session-once-per-request-actions`, `batch-evidence-dialog`, `finished-product-batches-evidence`, `finished-product-tables`, `finished-product-route-contract`): `Test Files 11 passed (11)`, `Tests 349 passed (349)`.
- Los que usan los dobles / el fixture (`count-evidence-locking-orders`, `execution-trace-actions`, `order-evidence`, `record-step-move-evidence`, `register-evidence`, `remove-evidence`, `request-evidence-upload`, `evidence-step-list`, `execution-trace-detail`, `execution-trace-evidence`, `planta-varias-recetas`, `trace-evidence-placement`): `Test Files 12 passed (12)`, `Tests 191 passed (191)`.
- `tests/unit/recetas/` que usan `evidence-off` (10 archivos): `Test Files 10 passed (10)`, `Tests 160 passed (160)`.
- Integración, base efímera copiada de la plantilla (`DATABASE_URL` del `.env` del checkout principal solo en ese shell; la borró el teardown): `step-evidence-repository.int.test.ts`: `Test Files 1 passed (1)`, `Tests 25 passed (25)` (29 − los 4 de `countByOrders`). Las 8 `.int` que importan `evidence-off` solo pierden una clave del doble: las cubre el typecheck y no se corrieron.
- `pnpm exec vitest run guard`: exit 0, `Test Files 87 passed (87)`, `Tests 1335 passed | 22 skipped (1357)`. Ninguna guardia ni snapshot cambió.

Veredicto: tanda 4 (T8) hecha; la lectura y el conteo del pedido entero ya no existen (R21, P1, P4); typecheck, lint, tests tocados, integración y guardias en verde.
