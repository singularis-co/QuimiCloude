# QC-305 — coste-real-de-produccion · informe del reviewer

Rama `feature/QC-305-coste-real-de-produccion`, HEAD `9fe6da41`, base `origin/dev`. 2026-10-21.
MCP del grafo no consultado: la revisión se hizo con Grep/Read y `git diff`.

## Verificación ejecutada (no la bitácora)

| Qué | Resultado |
|---|---|
| `pnpm run typecheck` | verde (exit 0) |
| `eslint` sobre los 100+ `.ts/.tsx` del diff | 0 errores, 2 warnings preexistentes en `tests/unit/pedidos/order-service.test.ts` |
| Unit backend relacionados (14 rutas, 33 archivos: `actual-order-cost`, `order-packing`, `update-order`, `update-order-presentation-lines`, `schema/*`, migraciones de inventario, `get-order`, `list-orders`, `asignaciones/*`, `order-cost`, `resolve-ingredients-cost`, `transition-order`) | 738/738 verdes |
| UI relacionados (`order-columns`, `order-cards`, `order-form-quote`, `use-order-cost-quote`, `pedidos-viewport`, `pedidos-paridad`, `tablas-marca`, `order-table`) | 205/205 verdes |
| `vitest run tests/guards` | **1 rojo**: `guard-identificador-de-request.test.ts` (ver B1). 1152 verdes, 16 skipped |
| `.int` afectados | **No corridos**: el worktree no tiene `.env` (`test-db: falta DATABASE_URL`) y no puedo crearlo. Quedan para `gate-completo`. Leí sus aserciones: ver Trazabilidad |
| E2E | no corrido (lo corre el CI, como se pidió) |
| CI | no hay PR ni corrida de `gate-completo` para la rama todavía |

## Checklist

### CHECKPOINTS.md
- [x] `requirements.md` con R1–R26 en EARS.
- [x] `design.md` con alternativas descartadas (§8, A–F) y su porqué.
- [x] `tasks.md`: T0–T9 todas `[x]`.
- [x] `design.md` abre con `## Lo que ya existe`, con contenido. El diff no re-crea nada de esa lista: reutiliza los asientos `consumption`, `unitCostByPresentationUnit`/`divideCost`, `formatMoneyDisplay`/`exactDecimalTitle`/`MissingValue`, la tab de PT; `ProductionCost` se generaliza a `CostCell` y `resolveLotCost` se retira, como dice la tabla.
- [x] Assignee y rama publicada (`progress/features/QC-305.md`).
- [x] Cada R1–R26 mapea a un test con aserción (ver Trazabilidad).
- [x] `progress/impl_QC-305.md` tiene el mapa R→test consolidado (T9).
- [x] Typecheck sin errores.
- [x] Lint sin errores.
- [ ] `gate-completo` verde: **no puede salir verde** con B1. Además no hay PR.
- [x] Flujo crítico (importes, inventario) con E2E Playwright `e2e/coste-real-de-produccion.spec.ts`; la salida local está en `impl_QC-305.md` (chromium y webkit 1/1). Ver m2.
- [x] Sin dependencias nuevas (`package.json` no está en el diff).
- [x] Sin secretos ni configuración hardcodeada.
- [x] Sin webhooks.
- [ ] `./init.sh` rápido en verde: no completó por memoria (anotado); la guardia de B1 lo pondría rojo igual.
- [ ] Veredicto OK: no (este informe).
- [ ] `Cierre` de `progress/features/QC-305.md`: vacío. Toca después de mergear.

### docs/checkpoints-proyecto.md
- [x] Typecheck y lint.
- [x] E2E de Playwright.
- [x] Multiplataforma: la tarjeta reutiliza `withCardFieldLabel` y el campo de tarjeta existente; sin `100vh`, sin `:hover`, sin inputs nuevos, sin targets nuevos.
- [x] Catálogo: ninguna pieza nueva ni cambiada en `components/ui|shared`, `lib/shared/ui` ni `hooks`.
- [x] Pase `/design`: excepción declarada en `design.md` (P3) y en Decisiones cerradas (columna y tarjeta), aprobada por el humano.
- [x] Sin tabla nueva: `orders` ya tiene RLS + FORCE; columna con `company_id` heredada.
- [x] Las lecturas nuevas filtran por empresa (`movementCompanyScope`, `batchCompanyScope`, `setOrderActualCost` con `company_id`) y hay test de rechazo cruzado (`order-consumption-ledger.int` «R4: con la empresa equivocada…»). `aislamiento.json` actualizado.
- [x] El permiso se valida en el caso de uso: `getOrder`/`listOrders` ya exigen `pedidos.consultar`, con test (R24).
- [x] Acceso a datos solo por adaptador driven (Prisma).
- [x] Las dos migraciones tienen `down.sql`.
- [x] Hexagonal: `pedidos/domain/actual-order-cost.ts` importa solo el tipo `ConsumedLot` del contrato `@/lib/modules/inventario`; el adaptador vive en `inventario/adapters/driven` y se cablea en `lib/composition`.
- [x] La lógica está en `domain/` (`calculateActualOrderCost`, `createFinishPacking`, `isStartedOrderStatus`).
- [x] La página valida el permiso en servidor (`requirePagePermission('pedidos.consultar')`, `page.tsx:119`).

### docs/perfil-agentes.md > reviewer (5–8)
- [x] 5. Calidad y seguridad: sin tabla nueva, sin webhooks, sin hardcode, capas separadas.
- [x] 6. Multiplataforma: ver arriba.
- [x] 7. Dependencias: ninguna.
- [x] 8. Aislamiento por empresa: ver arriba.
- [ ] Regla 11 (comentarios): **falla**, ver B2.

## Los seis puntos que pidió el leader

1. **Migraciones.**
   - `20261021140000_orders_actual_cost`: columna `DECIMAL(14,4)` anulable, `orders_actual_cost_non_negative` y `orders_actual_cost_requires_packed` con `"status"::text IN ('POR_ACONDICIONAR','EN_ACONDICIONAMIENTO','TERMINADO','ENTREGADO')`. El cast a `::text` sigue el patrón de los otros CHECK de `orders.status` (`20260904135210_order_cancellation`) y protege los `down.sql` que recrean el enum. Los cuatro estados son exactamente los alcanzables desde Terminar (`order-transitions.ts`: EN_EMPAQUE→POR_ACONDICIONAR→EN_ACONDICIONAMIENTO→TERMINADO→ENTREGADO, sin vuelta atrás, no cancelables). El test R9 de integración anula una entrega y sigue en un estado permitido. No hay backfill (R10). El `down.sql` quita las dos restricciones y la columna en orden inverso. Correcto.
   - `20261021150000_finished_goods_lot_cost_optional`: quita solo `product_batches_package_content_requires_unit_cost`; `product_batches_unit_cost_positive` (`> 0 OR (= 0 AND package_content IS NOT NULL)`) se queda, y un NULL pasa el CHECK. El `down.sql` lo recrea igual que `20260924190100` y avisa de que falla si ya hay lotes de PT sin coste. Es la conducta que fijó el humano ("falla si ya hay lotes de PT sin coste"). Correcto. Las dos migraciones están registradas en `MIGRACIONES_ESPERADAS` y tienen test propio.
2. **NULL `unit_cost` nunca cuenta como 0 (R17/P2).** Revisé todos los lectores de `unitCost`/`unit_cost` en `lib/` y `app/`:
   - `calculateActualOrderCost` devuelve `null` si cualquier lote no tiene coste.
   - `order-packing.ts`: con `actualCost === null`, `unitCosts` es `null` y cada lote nace con `unitCost: null`. El `?? '0.0000'` que queda solo cubre una unidad ausente del mapa, y el mapa se arma con todas las unidades de `resolvedLines`, así que no se alcanza con un real nulo.
   - `weightedAverageUnitCost` salta los lotes nulos. `product-catalog-prisma` y `packaging-catalog-prisma` filtran `unitCost: { not: null }` / devuelven `[]`. `finished-product-detail-prisma` usa `decimalOrNull`. `list-finished-product-costs` da `totalCost: null`. `product-batch-view` quita el campo. `product-columns.tsx > unitCostCell` y `finished-product-costs-table` pintan el guion.
   - El estimado (`order-cost.ts`) ya devuelve `null` con un lote sin coste.
   - No encontré ningún `COALESCE`, `?? 0` ni producto con `unit_cost` nulo. Correcto.
3. **Tests reescritos o borrados.**
   - QC-150, `finish-with-finished-goods.int` «un ingrediente con material pero sin costo cuenta cero»: se reescribe a «QC-305 P1 / R7, R17» y ahora afirma `actualCost` null, `unitCost` null, existencia y `package_content` intactos. Además los dos casos de «R18 — el coste del lote» y los dos del conteo real pasan de afirmar el estimado a afirmar el real, y siguen afirmando que el estimado no cambia (R6). Justificado y sin pérdida.
   - Los tres QC-195 R47 de `update-order-presentation-lines.test.ts` (POR_EMPACAR recompone ingredientes guardados + envases nuevos) quedan prohibidos por R13. Los sustituyen: `R13` × {EN_CURSO, POR_EMPACAR} (no escribe ni calcula), `R13` sin importe y `R14` sobre todos los `STARTED_ORDER_STATUSES`, en las ramas reserved e insufficient. R45 sigue en PENDIENTE y R46 en BLOQUEADO. Justificado.
   - También se borraron los tests de `calculateLotIngredientsCost`, `calculateLotPackagingCost`, `resolveLotIngredientsCost` y `resolveLotCost` (`order-cost.test.ts`, `resolve-ingredients-cost.test.ts`, `order-ingredients-cost.int` «R17 … no cuenta ese ingrediente como cero»). Las cuatro funciones se borraron y ya no tienen llamadores (grep vacío en `lib`, `app`, `tests` y `e2e`). Su regla («sin coste cuenta cero», QC-150 R42 y QC-195 R31 para el lote) la retira P1. R43 sigue cubierto con su caso reescrito. No se perdió nada vigente.
4. **Reexport de `STARTED_ORDER_STATUSES`** en `lib/modules/pedidos/index.ts`: una sola línea en el bloque que ya exporta las constantes de `order-classification`. Es un `as const` puro, sin servidor. `order-form.tsx` ya importaba de ese barrel. Está limpio. Ver m3.
5. **Reparto entre lotes.** El real sale de una suma exacta en BigInt (cantidad × coste a la escala máxima), redondeada una sola vez a 4 decimales mitad arriba. Devuelve `null` si pasa de `10^14-1` sin escala, medido después de redondear, y hay tests de los dos bordes. El reparto reutiliza `unitCostByPresentationUnit`/`divideCost` sin cambiarlos: suma lo envasado real en la unidad del pedido y hace una división por unidad de lote, mitad arriba. Los tests «R16: … la suma de los lotes es el coste real» (`order-packing.test.ts:1001`, `:1180`) y `finish-with-finished-goods.int` (`toBeCloseTo(actualCost, 2)`) fijan que la suma cuadra salvo redondeo. Correcto.
6. **Costes en la tarjeta (`ORDER_TABLE_CARD`).** `meta` gana `productionCost` y `actualCost`, con la misma celda (`CostCell` + `withCardFieldLabel`). La tarjeta solo se pinta desde `OrderListSection`, que solo monta `pedidos/page.tsx`, y esa página corta con `requirePagePermission('pedidos.consultar')`. Los datos vienen de `listOrders`, que exige el mismo permiso en el service. `order-cards.test.tsx` «R19: sin pedidos.consultar no aparecen…» lo fija. Correcto.

## Trazabilidad (R → test con aserción real)

R1 `actual-order-cost.test.ts` (120 y no 150; redondeo único; mitad arriba) + int «R1, R5, R6, R16, R22» (145.0000) + E2E · R2 int ledger «R2» + unit «R2» · R3 int ledger «R3» · R4 int ledger «R4» × 2 · R5 `order-packing.test.ts:667–716` · R6 `order-packing.test.ts:685` + int (estimado 155 intacto) · R7 unit ×4 + int «R7, R17, R22» · R8 `order-packing.test.ts:730/741` + int «R8» · R9 int «R9» (ajuste, cambio de coste, entrega, anulación) · R10/R25 `orders-actual-cost-migration.test.ts` · R11–R14 `update-order*.test.ts` + `order-repository.int` («keep») · R15 `use-order-cost-quote.test.ts` + `order-form-quote.test.tsx` · R16 `order-packing.test.ts` + int + E2E · R17 `order-packing.test.ts:779/797` + int + migración · R18 int «R18» × 2 · R19 `order-columns.test.tsx` + `order-cards.test.tsx` · R20/R21 `order-columns.test.tsx` · R22 int (14.5000/145.0000 y null/null) + E2E · R23 unit (cadena, sin `number`) + schema · R24 `get-order`, `list-orders`, `asignaciones/*` · R26 `e2e/coste-real-de-produccion.spec.ts`.

Todos verdes en lo que corrí. Los `.int` no los pude correr (sin `.env`).

## Hallazgos

- **B1 — BLOQUEANTE. La guardia `tests/guards/guard-identificador-de-request.test.ts` sale ROJA por este diff.**
  - Falla el caso «no hay ningun archivo nuevo en e2e/ y existe el test que lo sustituye (R21)» (`:1216`). El hallazgo es `e2e/coste-real-de-produccion.spec.ts: archivo nuevo en e2e/`.
  - El archivo no está en `tests/baseline-rojos.json`, así que es un rojo nuevo: `gate-completo` y `./init.sh` rápido saldrán rojos.
  - La bitácora dice «guardias 85/85» en T6/T7, pero eso fue antes de crear el spec E2E en T8. T8 solo corrió `guard-e2e`.
  - Falta dar de alta `coste-real-de-produccion.spec.ts` en la lista cerrada de esa guardia, con su comentario de alta como los demás: qué ejercita y que no toca el identificador de petición. Por ejemplo, junto a `envases-reales-empaque.spec.ts` (`:341`).
- **B2 — BLOQUEANTE. Comentarios de producción que citan ficha y requisito** (`docs/conventions.md > Comentarios`, `perfil-agentes.md` regla 11: «Sin excepciones»; `db/` cuenta como producción):
  - `app/(private)/pedidos/components/order-columns.tsx:225`: «QC-305 R19 — la misma celda…».
  - `app/(private)/pedidos/components/order-table.tsx:111`: «QC-305 R19: los dos costes…».
  - `lib/modules/inventario/domain/import-finished-goods.ts:24`: «(QC-305 retira el CHECK…)».
  - `db/migrations/20261021150000_finished_goods_lot_cost_optional/migration.sql:1`: «QC-305 P2/R17: …».
  - `db/migrations/20261021150000_finished_goods_lot_cost_optional/down.sql:5`: «(QC-305 R17)».

  Hay que quitar la cita y dejar solo el porqué. En tests rige la misma regla para comentarios (R<n> solo en el nombre del caso). La rama añade unos 30 comentarios con `QC-305`/`R<n>` en 16 archivos de `tests/` y `e2e/`, por ejemplo `update-order-presentation-lines.test.ts` «// QC-305 R13: desde Comenzar…», `finish-with-finished-goods.int.test.ts` (7) y `e2e/coste-real-de-produccion.spec.ts` (6). Deben limpiarse en la misma vuelta, en un commit `chore(QC-305): limpia comentarios de …` si abulta.
- m1 — menor. Los `.int` afectados (`actual-order-cost.int`, `order-consumption-ledger.int`, `finish-with-finished-goods.int`, `order-repository.int`, `pedidos-constraints.int`, `order-packing.int`, `order-conditioning-states-rollback.int`, `order-ingredients-cost.int`) no los verificó este reviewer por falta de `.env` en el worktree. Dependen de `gate-completo`.
- m2 — menor. El E2E en WebKit no se volvió a correr después del cambio de la tarjeta (T9b: «webkit no corrido tras este cambio»). El CI lo corre solo en el PR a producción. Conviene correrlo una vez en local antes del merge.
- m3 — menor. `order-form.tsx` hace `(STARTED_ORDER_STATUSES as readonly OrderSummary['status'][]).includes(...)`, que duplica `isStartedOrderStatus`, ya en el dominio. Exportar `isStartedOrderStatus` desde el barrel evitaría el cast. No bloquea.
- m4 — menor. R13 deja sin efecto QC-195 R47 y design §9 enmienda QC-170, pero solo se añadió nota al pie en QC-151, QC-281 y QC-290, que es lo que pedía §9. Una nota de una línea en `specs/QC-195-…/requirements.md` (R47) y en `specs/QC-170-…/requirements.md` ahorraría la búsqueda a quien lea esos specs.

## Veredicto

**RECHAZADO.**

La funcionalidad cumple R1–R26 y los seis puntos pedidos (migraciones, NULL nunca 0, tests reescritos, reexport, reparto, permiso de la tarjeta). Para cerrar falta:
1. **B1**: dar de alta `coste-real-de-produccion.spec.ts` en la lista cerrada de `guard-identificador-de-request.test.ts`, para que la guardia y `gate-completo` salgan verdes.
2. **B2**: quitar las citas `QC-305`/`R<n>`/`P<n>` de los 5 comentarios de producción listados y de los comentarios añadidos en tests y E2E.

La vuelta 2 puede acotarse al rango de esos commits.

## Re-revisión (acotada a 03a77724..1467b340)

Verificación ejecutada: typecheck verde; eslint sobre el diff, 0 errores (los mismos 2 warnings preexistentes); `vitest run tests/guards` 77/77 archivos, 1153 verdes, 16 skipped, 0 rojos.

- [x] **B1 resuelto.** `coste-real-de-produccion.spec.ts` está dado de alta en `E2E_ESPERADOS` con su comentario de alta (qué ejercita, que no toca el identificador). `guard-identificador-de-request.test.ts` sale verde. De paso se quitó `QC-305` de los dos comentarios de `MIGRACIONES_ESPERADAS`.
- [x] **B2 resuelto.** Las 5 citas de producción están quitadas: `order-columns.tsx`, `order-table.tsx`, `import-finished-goods.ts`, `migration.sql` y `down.sql`. Revisé `git diff origin/dev...HEAD` sobre `lib app db components hooks tests e2e`: no queda ningún comentario añadido por la rama que cite `QC-<n>`, `R<n>`, `P<n>` ni `design.md`, salvo la excepción de abajo.
- [x] **m3 resuelto.** `order-form.tsx` usa `isStartedOrderStatus(order.status)` sin cast, y `lib/modules/pedidos/index.ts` reexporta `isStartedOrderStatus` junto a `STARTED_ORDER_STATUSES`. Las dos son funciones de dominio puro. Está limpio.
- [x] **m4 resuelto.** Hay una nota de una línea al pie de `specs/QC-195-…/requirements.md` (R47 sin efecto en comenzados) y de `specs/QC-170-…/requirements.md` (R13).

Los dos restos que el implementer dejó a propósito:
- `(QC-195 R47)` en `tests/unit/pedidos/schema/pedidos-schema.test.ts:333`: **aceptable**. La cita está en `origin/dev` (`:331`), en una línea que la rama tocó solo para añadir «y el coste real». La regla manda limpiar las líneas que toca la rama, así que lo estricto sería quitarla. Pero la cita es de otra ficha y es preexistente, y la regla dice que lo preexistente no se arrastra. Queda como **menor**, no bloquea.
- `"motivo": "QC-305 T4: …"` en `tests/integration/aislamiento.json`: **aceptable**. Es un JSON de datos, no un comentario. Ese campo es el censo de aislamiento que lee la guardia (`docs/verification.md > El censo de aislamiento`) y documenta el `desde`/motivo de cada archivo en modo `commit`. Hay 114 citas `QC-<n>` en ese archivo: es su formato. La regla de comentarios no aplica.

Los menores m1 (los `.int` no se corrieron aquí, quedan para CI) y m2 (WebKit tras el cambio de la tarjeta) siguen como estaban. No bloquean.

**Veredicto de la re-revisión: OK.** Sin bloqueantes. Queda pendiente que `gate-completo` salga verde en el PR.
