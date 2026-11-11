# QT-316 — evidencias-del-lote-por-receta · tasks.md

> **Cómo están hechas las tandas.**
> - Cada tanda cierra con el gate local en verde: `pnpm run typecheck`, `pnpm run lint`,
>   `pnpm exec vitest related --run <archivos>` y `pnpm exec vitest run guard`, y al final de la
>   tanda `./init.sh`.
> - Una tanda que cambia una firma usada por la UI lleva **en la misma tanda** la task de
>   `frontend_dev` que la consume, para que `typecheck` no quede rojo entre tandas. Por eso la
>   retirada de las lecturas del pedido entero (T8) va **después** de que la pantalla deje de usarlas
>   (T6, T7).
> - El E2E corre en CI (`gate-completo`). En local se corre solo el spec tocado:
>   `pnpm exec playwright test e2e/consulta-de-evidencia.spec.ts`.
> - `[P]` = puede ir en paralelo con las otras `[P]` de su tanda. Cada test lleva `R<n>` en el
>   nombre del caso.
>
> P1–P3 están cerradas (`requirements.md > Decisiones cerradas`, 2026-11-11). **P4 sigue abierta**
> (`readOrderEvidence` y `countByOrders` sin consumidor). T8 sigue su recomendación, retirarlos. Si
> el humano decide conservarlos, T8 deja esas dos piezas y sus tests como están (design § 3.5).

## Tanda 1 — contratos (backend_dev)

- [x] **T1 [P] · backend_dev — la línea del lote en `inventario`** (design § 3.1 · R5)
  - `FinishedProductBatchRow.orderLineId: string | null`.
  - `listFinishedProductBatches` (Prisma) lee `orderLineId` del asiento `production`.
  - Comentario de `listBatches` en el puerto.
  - `tests/fixtures/finished-product-detail.ts` gana el campo.
  - El campo es aditivo: la pantalla compila sin usarlo todavía.
  - **Hecho cuando:**
    - `finished-product-detail.int.test.ts` tiene un caso R5: lote con `production` → la línea de
      ese asiento; lote de apertura → `null`;
    - `list-finished-product-batches.test.ts` comprueba que la fila conserva `orderLineId`;
    - typecheck y guardias en verde.
- [x] **T2 [P] · backend_dev — `StepEvidenceRepository.countByLines`** (design § 3.2 · R4, R15, R20)
  - Método en el puerto existente: no nace ningún archivo en `ports/`. `countByOrders` se queda
    hasta T8.
  - Adaptador Prisma con un solo `groupBy`, de las tres fases.
  - `tests/unit/asignaciones/evidence-doubles.ts` y `tests/helpers/evidence-off.ts` lo implementan.
  - **Hecho cuando:** `step-evidence-repository.int.test.ts` tiene un `describe('countByLines…')`
    con estos casos:
    - dos líneas del mismo pedido, contadas por separado (R1);
    - las fotos de acondicionamiento cuentan (R20);
    - una línea sin fotos no sale (R2);
    - una fila de otra empresa no cuenta (R15);
    - un par con el `orderId` cambiado no cuenta (R15);
    - con la lista vacía no consulta (R4).

## Tanda 2 — casos de uso, actions y composición (backend_dev; depende de T2)

- [x] **T3 [P] · backend_dev — `countLineEvidence`** (design § 3.3 · R1, R2, R4, R7, R8, R9, R12, R13, R15, R17)
  - `domain/count-line-evidence.ts` y el tipo `LineEvidenceCount` en `order-evidence.ts`.
  - El barril `index.ts` exporta el tipo y `createCountLineEvidence`.
  - **Hecho cuando:** `tests/unit/asignaciones/count-line-evidence.test.ts` cubre:
    - sin permiso → `UnauthorizedError` sin llamar a ningún puerto; por permiso, nunca por rol;
    - 26 líneas o un id no uuid → `ValidationError` sin llamar;
    - lista vacía → `[]` sin llamar;
    - pares repetidos;
    - una llamada a cada puerto con 25 líneas de 10 pedidos;
    - `recipeName` con dos recetas (una cancelada), `null` con una, `null` si la receta no vuelve
      del catálogo o la línea no está en el outline (línea quitada, P3);
    - receta borrada del catálogo con nombre (`findRefsIncludingDeleted`);
    - líneas con 0 fuera;
    - ningún método de escritura llamado.
- [x] **T4 [P] · backend_dev — `getLineEvidence`** (design § 3.3 · R6, R10, R12, R13, R14, R16, R17, R20)
  - `domain/get-line-evidence.ts` sobre `readOrderEvidenceByLine`, sin cambiar
    `readOrderEvidenceByLine`.
  - **Hecho cuando:** `tests/unit/asignaciones/get-line-evidence.test.ts` cubre:
    - solo las fotos de la línea nombrada en un pedido de dos líneas, con las tres fases
      (`conditioning` incluido, R20);
    - una línea viva sin fotos → evidencia vacía;
    - pedido ajeno, línea de otro pedido, línea inexistente, línea quitada sin fotos e ids mal
      formados → `OrderNotFoundError`;
    - pedido dado de baja y línea quitada con fotos → salen;
    - firma caída → grupos sin fotos y `signingFailure`;
    - sin permiso → `UnauthorizedError` sin leer; por permiso, nunca por rol;
    - ninguna escritura.

    `get-execution-evidence.test.ts` y los casos de `readOrderEvidenceByLine` siguen verdes sin
    modificarlos (R16).
- [x] **T5 · backend_dev — actions y composición** (design § 3.4; depende de T3 y T4)
  - `getLineEvidenceAction` y `countLineEvidenceAction` en `order-evidence-actions.ts`. Las dos de
    hoy se quedan hasta T8.
  - `asignaciones.getLineEvidence` y `asignaciones.countLineEvidence` en `lib/composition/index.ts`.
  - **Hecho cuando:**
    - `order-evidence-actions.test.ts` cubre `success`, `order_not_found`, `invalid_input` y la
      firma caída (`log.warn` con `lineId`, R10);
    - el censo de `tests/unit/composition/asignaciones-facade.test.ts` gana las dos nuevas (en T8
      salen las viejas);
    - `tests/unit/identity/session-once-per-request-actions.test.ts` tiene el caso de las actions
      nuevas;
    - typecheck y guardias en verde.

## Tanda 3 — la pantalla (frontend_dev; depende de T1 y T5)

- [x] **T6 · frontend_dev — conteo por receta en Lotes** (design § 4 · R1, R2, R3, R4, R13)
  - `loadEvidenceCounts` llama a `countLineEvidenceAction` una vez, con los pares de la página.
  - El mapa queda por `lineId` con `{ photoCount, recipeName }`.
  - La celda busca por `row.orderLineId`.
  - En `finished-product-route-contract.test.ts`, `LECTURAS_DE_EVIDENCIA` pasa a las dos actions de
    línea, con su comentario de fecha y QT-316. Las de hoy salen, porque la ruta ya no las importa.
  - **Hecho cuando:**
    - `finished-product-batches-evidence.test.tsx` cubre R1 (dos lotes del mismo pedido, cada uno
      con lo suyo), R2 (línea sin fotos → «—» sin botón) y R3;
    - `finished-product-tables.test.tsx` cubre R4 (una sola llamada) y R13 (sin permiso no hay
      columna ni llamada);
    - el contrato de la ruta está en verde.
- [x] **T7 · frontend_dev — el diálogo de la receta** (design § 4 · R6, R7, R8, R9, R10, R11, R20; depende de T6)
  - `batch-evidence-button.tsx` y `batch-evidence-dialog.tsx` reciben `lineId` y `recipeName`.
  - El diálogo lee con `getLineEvidenceAction`.
  - Título y descripción con la receta cuando `recipeName !== null`.
  - `BATCH_EVIDENCE_TEXTS` gana `recipeDescription`, `conditioning` y `conditioningPhase`.
  - Tercer `PhaseSection`, «Acondicionamiento» (`batch-evidence-conditioning`).
  - El título parte palabras largas.
  - `components/shared/step-evidence` no cambia.
  - **Hecho cuando:** `batch-evidence-dialog.test.tsx` cubre:
    - la llamada con `(orderId, lineId)` (R6);
    - título y descripción con la receta (R7);
    - con `null`, los de hoy (R8, R9);
    - el esqueleto con el conteo de la receta y el error con «Reintentar» (R10);
    - la clase de partido de palabras en el título (R11);
    - el grupo «Acondicionamiento» con sus pasos y su total, sin sección cuando no tiene fotos, y la
      suma de las secciones igual al `photoCount` de la celda (R20).

    Los casos de QC-271 siguen verdes.

## Tanda 4 — retirar la lectura del pedido entero (backend_dev; depende de T6 y T7)

- [x] **T8 · backend_dev — retirar `getOrderEvidence` y `countOrderEvidence`** (design § 3.5, § 5 · R21; P1, P4)
  - Se borran `domain/get-order-evidence.ts` y `domain/count-order-evidence.ts`.
  - Se borran también sus tests: `get-order-evidence.test.ts` y `count-order-evidence.test.ts`.
  - Fuera del barril: `createGetOrderEvidence`, `createCountOrderEvidence`, sus `Deps` y
    `OrderEvidenceCount`.
  - Fuera de `order-evidence-actions.ts`: `getOrderEvidenceAction`, `countOrderEvidenceAction` y
    `OrderEvidenceCountResult`.
  - Fuera de `lib/composition`: las dos operaciones y sus imports.
  - P4: fuera `readOrderEvidence` y `StepEvidenceRepository.countByOrders` (puerto, adaptador y
    dobles).
  - Los casos de `readOrderEvidence` pasan a `readOrderEvidenceByLine` en
    `read-order-evidence.test.ts`.
  - El `describe` de `countByOrders` de la integración pasa a `countByLines`, si T2 no lo cubre ya.
  - `ORDER_EVIDENCE_COUNTS` → `LINE_EVIDENCE_COUNTS` en `tests/fixtures/order-evidence.ts`.
  - Censos: en `asignaciones-facade.test.ts` salen las dos viejas, y los dos casos «QC-271 R2» pasan
    a las de línea. En `session-once-per-request-actions.test.ts` sale la entrada de
    `getOrderEvidenceAction`. Cada cambio lleva un comentario con fecha, QT-316 y P1.
  - Se quita el comentario de `OrderEvidence.conditioning` («la ficha de producto terminado no lo
    pinta»).
  - **Hecho cuando:**
    - `Grep` de `getOrderEvidence|countOrderEvidence|readOrderEvidence\b|countByOrders|OrderEvidenceCount\b`
      sobre `app/`, `components/`, `lib/`, `tests/` y `e2e/` no da nada (R21);
    - `order-evidence-actions.test.ts` comprueba que el módulo solo exporta las dos actions de
      línea;
    - `get-execution-evidence.test.ts` sigue verde sin tocarlo (R16);
    - typecheck, lint, `vitest related` y guardias en verde.

## Tanda 5 — E2E (CI; depende de T6, T7 y T8)

- [x] **T9 · frontend_dev — ampliar `e2e/consulta-de-evidencia.spec.ts`** (R19, R20)
  - Fixture con el prefijo del spec (`qc271_e2e_`): un pedido de **dos** líneas, con dos recetas y
    dos productos terminados, cada uno con su lote y su asiento `production` atado a su línea.
  - Fotos solo en la línea A, de fabricación, envasado y acondicionamiento.
  - Caso nuevo «R19 - pedido de dos recetas»:
    - en la ficha del producto A, la celda muestra el conteo de A;
    - el diálogo muestra solo esas fotos, en los tres grupos, y el título con el nombre de la
      receta A;
    - en la ficha del producto B, la celda muestra «—».
  - La limpieza de `afterAll` y la de huérfanos cubren las filas nuevas.
  - **No nace ningún archivo en `e2e/`.**
  - **Hecho cuando:**
    - `pnpm exec playwright test e2e/consulta-de-evidencia.spec.ts` da verde en local en chromium y
      webkit;
    - R27 y R28 de QC-271 siguen verdes;
    - `guard-identificador-de-request` y `guard-dobles-e2e` están en verde.

## Cierre

- [ ] **Gate:** `./init.sh` en verde.
  - El mapa `R<n> -> test` está en `progress/impl_QT-316.md` (design § 6).
  - El informe de implementación dice que QT-315 R34 queda superado (design § 3.5).
  - `db/schema.prisma`, `db/migrations/` y `package.json` no cambian respecto de la rama base (R18).

## Archivos esperados

### `lib/` (backend_dev)

- `lib/modules/inventario/domain/finished-product-detail.ts`
- `lib/modules/inventario/ports/finished-product-detail-repository.ts`
- `lib/modules/inventario/adapters/driven/persistence/finished-product-detail-prisma.ts`
- `lib/modules/asignaciones/ports/step-evidence-repository.ts`
- `lib/modules/asignaciones/adapters/driven/persistence/step-evidence-prisma.ts`
- `lib/modules/asignaciones/domain/order-evidence.ts`
- `lib/modules/asignaciones/domain/read-order-evidence.ts`
- `lib/modules/asignaciones/domain/count-line-evidence.ts` (nuevo)
- `lib/modules/asignaciones/domain/get-line-evidence.ts` (nuevo)
- `lib/modules/asignaciones/domain/get-order-evidence.ts` (se borra)
- `lib/modules/asignaciones/domain/count-order-evidence.ts` (se borra)
- `lib/modules/asignaciones/index.ts`
- `lib/modules/asignaciones/adapters/driving/order-evidence-actions.ts`
- `lib/composition/index.ts`

### `app/` (frontend_dev)

- `app/(private)/inventario/producto-terminado/[id]/components/finished-product-list-section.tsx`
- `app/(private)/inventario/producto-terminado/[id]/components/finished-product-batches-table.tsx`
- `app/(private)/inventario/producto-terminado/[id]/components/batch-evidence-button.tsx`
- `app/(private)/inventario/producto-terminado/[id]/components/batch-evidence-dialog.tsx`

### Tests

- `tests/unit/asignaciones/count-line-evidence.test.ts` (nuevo)
- `tests/unit/asignaciones/get-line-evidence.test.ts` (nuevo)
- `tests/unit/asignaciones/get-order-evidence.test.ts` (se borra)
- `tests/unit/asignaciones/count-order-evidence.test.ts` (se borra)
- `tests/unit/asignaciones/read-order-evidence.test.ts`
- `tests/unit/asignaciones/order-evidence-actions.test.ts`
- `tests/unit/asignaciones/evidence-doubles.ts`
- `tests/helpers/evidence-off.ts`
- `tests/fixtures/order-evidence.ts`
- `tests/integration/asignaciones/step-evidence-repository.int.test.ts`
- `tests/integration/inventario/finished-product-detail.int.test.ts`
- `tests/unit/inventario/list-finished-product-batches.test.ts`
- `tests/fixtures/finished-product-detail.ts`
- `tests/unit/inventario-ui/finished-product-batches-evidence.test.tsx`
- `tests/unit/inventario-ui/finished-product-tables.test.tsx`
- `tests/unit/inventario-ui/batch-evidence-dialog.test.tsx`
- `tests/unit/composition/asignaciones-facade.test.ts` (censo cerrado: cambian dos entradas)
- `tests/unit/inventario/producto-terminado/finished-product-route-contract.test.ts` (lista cerrada `LECTURAS_DE_EVIDENCIA`: se reescribe)
- `tests/unit/identity/session-once-per-request-actions.test.ts` (censo de actions: cambia una entrada)

### E2E

- `e2e/consulta-de-evidencia.spec.ts`

### Estado y docs

- `specs/QT-316-evidencias-del-lote-por-receta/requirements.md`
- `specs/QT-316-evidencias-del-lote-por-receta/design.md`
- `specs/QT-316-evidencias-del-lote-por-receta/tasks.md`
- `progress/features/QT-316.md`
- `progress/impl_QT-316.md`
