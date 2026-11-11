# QT-316 — evidencias-del-lote-por-receta · tasks.md

> **Cómo están hechas las tandas.**
> - Cada tanda cierra con el gate local en verde: `pnpm run typecheck`, `pnpm run lint`,
>   `pnpm exec vitest related --run <archivos>` y `pnpm exec vitest run guard`, y al final de la
>   tanda `./init.sh`.
> - Una tanda que cambia una firma usada por la UI lleva **en la misma tanda** la task de
>   `frontend_dev` que la consume, para que `typecheck` no quede rojo entre tandas.
> - El E2E corre en CI (`gate-completo`). En local se corre solo el spec tocado:
>   `pnpm exec playwright test e2e/consulta-de-evidencia.spec.ts`.
> - `[P]` = puede ir en paralelo con las otras `[P]` de su tanda. Cada test lleva `R<n>` en el
>   nombre del caso.
>
> **P1–P3 siguen abiertas** (`requirements.md`). Las tasks siguen la recomendación de cada una. Si
> el humano decide otra cosa en P1, se añade T9b (retirar `getOrderEvidence` y `countOrderEvidence`).
> P2 y P3 no cambian ninguna task.

## Tanda 1 — contratos aditivos (backend_dev)

- [ ] **T1 [P] · backend_dev — la línea del lote en `inventario`** (design § 3.1 · R5)
  - `FinishedProductBatchRow.orderLineId: string | null`.
  - `listFinishedProductBatches` (Prisma) lee `orderLineId` del asiento `production`.
  - Comentario de `listBatches` en el puerto.
  - `tests/fixtures/finished-product-detail.ts` gana el campo.
  - En la misma tanda, la pantalla compila sin usarlo todavía (el campo es aditivo).
  - **Hecho cuando:**
    - `finished-product-detail.int.test.ts` tiene un caso R5: lote con `production` → la línea de
      ese asiento; lote de apertura → `null`;
    - `list-finished-product-batches.test.ts` comprueba que la fila conserva `orderLineId`;
    - typecheck y guardias en verde.
- [ ] **T2 [P] · backend_dev — `StepEvidenceRepository.countByLines`** (design § 3.2 · R4, R15)
  - Método en el puerto existente: no nace ningún archivo en `ports/`.
  - Adaptador Prisma con un solo `groupBy`.
  - `tests/unit/asignaciones/evidence-doubles.ts` y `tests/helpers/evidence-off.ts` lo implementan.
  - **Hecho cuando:** `step-evidence-repository.int.test.ts` tiene un `describe('countByLines…')`
    con estos casos:
    - dos líneas del mismo pedido, contadas por separado (R1);
    - una línea sin fotos no sale (R2);
    - una fila de otra empresa no cuenta (R15);
    - un par con el `orderId` cambiado no cuenta (R15);
    - con la lista vacía no consulta (R4).

## Tanda 2 — casos de uso, actions y composición (backend_dev; depende de T2)

- [ ] **T3 [P] · backend_dev — `countLineEvidence`** (design § 3.3 · R1, R2, R4, R7, R8, R9, R12, R13, R15, R17)
  - `domain/count-line-evidence.ts` y el tipo `LineEvidenceCount` en `order-evidence.ts`.
  - El barril `index.ts` exporta el tipo y `createCountLineEvidence`.
  - **Hecho cuando:** `tests/unit/asignaciones/count-line-evidence.test.ts` cubre:
    - sin permiso, `UnauthorizedError` sin llamar a ningún puerto;
    - 26 líneas o un id no uuid → `ValidationError` sin llamar;
    - lista vacía → `[]` sin llamar;
    - pares repetidos;
    - una llamada a cada puerto con 25 líneas de 10 pedidos;
    - `recipeName` con dos recetas (una cancelada), `null` con una, `null` si la receta no vuelve
      del catálogo o la línea no está en el outline;
    - receta borrada del catálogo con nombre (`findRefsIncludingDeleted`);
    - líneas con 0 fuera;
    - ningún método de escritura llamado.
- [ ] **T4 [P] · backend_dev — `getLineEvidence`** (design § 3.3 · R6, R10, R12, R13, R14, R16, R17)
  - `domain/get-line-evidence.ts` sobre `readOrderEvidenceByLine`, sin tocar `read-order-evidence.ts`.
  - **Hecho cuando:** `tests/unit/asignaciones/get-line-evidence.test.ts` cubre:
    - solo las fotos de la línea nombrada en un pedido de dos líneas;
    - una línea viva sin fotos → evidencia vacía;
    - pedido ajeno, línea de otro pedido, línea inexistente, línea quitada sin fotos e ids mal
      formados → `OrderNotFoundError`;
    - pedido dado de baja y línea quitada con fotos → salen;
    - firma caída → grupos sin fotos y `signingFailure`;
    - sin permiso → `UnauthorizedError` sin leer;
    - ninguna escritura.

    `read-order-evidence.test.ts`, `get-order-evidence.test.ts`, `get-execution-evidence.test.ts`
    y `count-order-evidence.test.ts` siguen verdes sin modificarlos (R16).
- [ ] **T5 · backend_dev — actions y composición** (design § 3.4; depende de T3 y T4)
  - `getLineEvidenceAction` y `countLineEvidenceAction` en `order-evidence-actions.ts`.
  - `asignaciones.getLineEvidence` y `asignaciones.countLineEvidence` en `lib/composition/index.ts`,
    al final del bloque.
  - **Hecho cuando:**
    - `order-evidence-actions.test.ts` cubre `success`, `order_not_found`, `invalid_input` y la
      firma caída (`log.warn` con `lineId`, R10);
    - el censo de `tests/unit/composition/asignaciones-facade.test.ts` crece con las dos, con su
      comentario de fecha y QT-316;
    - `tests/unit/identity/session-once-per-request-actions.test.ts` tiene el caso de las actions
      nuevas;
    - typecheck y guardias en verde.

## Tanda 3 — la pantalla (frontend_dev; depende de T1 y T5)

- [ ] **T6 · frontend_dev — conteo por receta en Lotes** (design § 4 · R1, R2, R3, R4, R13)
  - `loadEvidenceCounts` llama a `countLineEvidenceAction` una vez, con los pares de la página.
  - El mapa queda por `lineId` con `{ photoCount, recipeName }`.
  - La celda busca por `row.orderLineId`.
  - `LECTURAS_DE_EVIDENCIA` de `finished-product-route-contract.test.ts` gana las dos actions
    nuevas, con su comentario de fecha y QT-316.
  - **Hecho cuando:**
    - `finished-product-batches-evidence.test.tsx` cubre R1 (dos lotes del mismo pedido, cada uno
      con lo suyo), R2 (línea sin fotos → «—» sin botón) y R3;
    - `finished-product-tables.test.tsx` cubre R4 (una sola llamada) y R13 (sin permiso no hay
      columna ni llamada);
    - el contrato de la ruta está en verde.
- [ ] **T7 · frontend_dev — el diálogo de la receta** (design § 4 · R6, R7, R8, R9, R10, R11; depende de T6)
  - `batch-evidence-button.tsx` y `batch-evidence-dialog.tsx` reciben `lineId` y `recipeName`.
  - El diálogo lee con `getLineEvidenceAction`.
  - Título y descripción con la receta cuando `recipeName !== null`.
  - `BATCH_EVIDENCE_TEXTS.recipeDescription`.
  - El título parte palabras largas.
  - **Hecho cuando:** `batch-evidence-dialog.test.tsx` cubre:
    - la llamada con `(orderId, lineId)` (R6);
    - título y descripción con la receta (R7);
    - con `null`, los de hoy (R8, R9);
    - el esqueleto con el conteo de la receta y el error con «Reintentar» (R10);
    - la clase de partido de palabras en el título (R11).

    Los casos de QC-271 siguen verdes.

## Tanda 4 — E2E (CI; depende de T6 y T7)

- [ ] **T8 · frontend_dev — ampliar `e2e/consulta-de-evidencia.spec.ts`** (R19)
  - Fixture con el prefijo del spec (`qc271_e2e_`): un pedido de **dos** líneas, con dos recetas y
    dos productos terminados, cada uno con su lote y su asiento `production` atado a su línea.
  - Fotos solo en la línea A (fabricación y envasado).
  - Caso nuevo «R19 - pedido de dos recetas»: en la ficha del producto A, la celda muestra el
    conteo de A, y el diálogo muestra solo esas fotos y el título con el nombre de la receta A; en
    la ficha del producto B, la celda muestra «—».
  - La limpieza de `afterAll` y la de huérfanos cubren las filas nuevas.
  - **No nace ningún archivo en `e2e/`.**
  - **Hecho cuando:**
    - `pnpm exec playwright test e2e/consulta-de-evidencia.spec.ts` da verde en local en chromium y
      webkit;
    - R27 y R28 de QC-271 siguen verdes;
    - `guard-identificador-de-request` y `guard-dobles-e2e` están en verde.

## Cierre

- [ ] **T9 · backend_dev — deuda de P1 y P2** (si el humano acepta las recomendaciones)
  - En `progress/deudas.md`:
    - la retirada de `getOrderEvidence`, `countOrderEvidence` y sus actions;
    - la diferencia de fases entre el conteo y el diálogo.
  - **Hecho cuando:** las dos entradas están escritas, con origen QT-316.
- [ ] **Gate:** `./init.sh` en verde. El mapa `R<n> -> test` está en `progress/impl_QT-316.md`
  (design § 6). `db/schema.prisma`, `db/migrations/` y `package.json` no cambian respecto de la
  rama base (R18).

## Archivos esperados

### `lib/` (backend_dev)

- `lib/modules/inventario/domain/finished-product-detail.ts`
- `lib/modules/inventario/ports/finished-product-detail-repository.ts`
- `lib/modules/inventario/adapters/driven/persistence/finished-product-detail-prisma.ts`
- `lib/modules/asignaciones/ports/step-evidence-repository.ts`
- `lib/modules/asignaciones/adapters/driven/persistence/step-evidence-prisma.ts`
- `lib/modules/asignaciones/domain/order-evidence.ts`
- `lib/modules/asignaciones/domain/count-line-evidence.ts` (nuevo)
- `lib/modules/asignaciones/domain/get-line-evidence.ts` (nuevo)
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
- `tests/unit/asignaciones/order-evidence-actions.test.ts`
- `tests/unit/asignaciones/evidence-doubles.ts`
- `tests/helpers/evidence-off.ts`
- `tests/integration/asignaciones/step-evidence-repository.int.test.ts`
- `tests/integration/inventario/finished-product-detail.int.test.ts`
- `tests/unit/inventario/list-finished-product-batches.test.ts`
- `tests/fixtures/finished-product-detail.ts`
- `tests/unit/inventario-ui/finished-product-batches-evidence.test.tsx`
- `tests/unit/inventario-ui/finished-product-tables.test.tsx`
- `tests/unit/inventario-ui/batch-evidence-dialog.test.tsx`
- `tests/unit/composition/asignaciones-facade.test.ts` (censo cerrado: crece)
- `tests/unit/inventario/producto-terminado/finished-product-route-contract.test.ts` (lista cerrada `LECTURAS_DE_EVIDENCIA`: crece)
- `tests/unit/identity/session-once-per-request-actions.test.ts` (censo de actions: crece)

### E2E

- `e2e/consulta-de-evidencia.spec.ts`

### Estado y docs

- `specs/QT-316-evidencias-del-lote-por-receta/requirements.md`
- `specs/QT-316-evidencias-del-lote-por-receta/design.md`
- `specs/QT-316-evidencias-del-lote-por-receta/tasks.md`
- `progress/features/QT-316.md`
- `progress/impl_QT-316.md`
- `progress/deudas.md`
