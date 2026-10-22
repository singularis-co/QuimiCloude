# QT-291 — seleccion-de-modelo-por-tarea · tasks.md

> Orden por dependencias. `[P]` = puede ir en paralelo con las otras `[P]` de su mismo bloque.
> Cada tanda cierra con `pnpm run typecheck`, `pnpm run lint`, `pnpm exec vitest related --run
> <archivos>` y `pnpm exec vitest run guard`. Nadie corre `pnpm test`.
> `backend_dev`: T0–T8. `frontend_dev`: T9–T12. E2E: T13.

## Bloque A — confirmación y datos

- [ ] **T0. Confirmar la lista de modelos** (sin código). Tomar la lista **aprobada en F1.4**
  (`design.md > 3`). Para cada id que no venga del T0 de QC-275, confirmar en la documentación
  oficial del proveedor (y en `architecture.input_modalities` de `openrouter.ai/api/v1/models` para
  OpenRouter) que existe con ese nombre y acepta PDF **e** imágenes; anotar fuente y fecha en
  `progress/impl_QT-291.md`. Verificar también qué código devuelve OpenRouter al generar con un id
  inexistente (`design.md > 7`).
  *Hecho:* tabla con id, fuente y fecha por fila. Si un id no existe o no lee las dos cosas, **se
  para y se pregunta**.

- [ ] **T1. Esquema y migración** (dep. T0). `db/schema.prisma` (`AiModel` con `/// @module
  integraciones`; `AiProvider` sin `recipeModel`/`catalogModel`; `AiProviderConnection` + `model`,
  `unavailableModel`). `db/migrations/20261022120000_ai_models/migration.sql` y `down.sql` según
  `design.md > 2.2`. Guardias: `EXENTAS` + caso R7 de `guard-empresa-en-esquema.test.ts`, bullet de
  `docs/architecture.md`, carpeta en `guard-identificador-de-request.test.ts`.
  *Hecho:* `pnpm exec prisma validate`; migración aplicada en la base de test; `vitest run guard` en
  verde; test `ai-models-migration.int.test.ts` (R1–R4, R7) en verde; `ai-provider-migration.int.test.ts`
  ajustado y en verde.

## Bloque B — dominio y adaptadores de `integraciones`

- [ ] **T2. Tipos y textos** (dep. T1). `domain/ai-provider.ts` (`AiModelOption`, entrada, registro,
  vista, `modelInUse`; fuera `AiReadUse`), `domain/ai-provider-failure.ts` (`marksConnection`,
  `modelUnavailableNotice`, `isModelUnavailableNotice`, texto de R20).
  *Hecho:* `connection-view.test.ts` y `ai-provider-failure.test.ts` en verde (R20, R28 a nivel de vista).

- [ ] **T3. [P] Adaptadores driven** (dep. T2). `catalog/ai-provider-catalog-prisma.ts` (modelos por
  proveedor, descarta proveedor sin predeterminado), `persistence/ai-provider-connection-prisma.ts`
  (dos campos, P2003), puerto del repositorio.
  *Hecho:* `ai-provider-connection-prisma.int.test.ts` en verde con los campos nuevos.

- [ ] **T4. [P] Elegir modelo** (dep. T2). `domain/ai-model-input.ts`, `domain/select-ai-model.ts`,
  `index.ts`.
  *Hecho:* `select-ai-model.test.ts` con un caso por R8, R9, R10, R11, R12 en verde.

- [ ] **T5. Prueba, guardado, resolución e informe** (dep. T2). `test-ai-provider-key.ts`,
  `test-saved-ai-provider.ts`, `save-ai-provider-connection.ts`, `resolve-ai-provider-for-reading.ts`
  (sin `use`), `report-ai-provider-outcome.ts`, `get-ai-provider-connection.ts`.
  *Hecho:* tests de R14, R16–R19, R21–R24 en verde (`save-…`, `test-ai-provider-key…`,
  `test-saved-…`, `resolve-and-report…`).

## Bloque C — `documentos`, composición y acción

- [ ] **T6. Lectores y trabajo** (dep. T5). Los tres `ai-reader-*.ts` (clasificar con `config.model`,
  lanzar con `marksConnection`); `ports/ai-provider-gateway.ts` (sin `use`,
  `reportConnectionFailure`); `run-document-job.ts`; borrar `domain/ai-read-use.ts`.
  *Hecho:* `ai-reader-anthropic-adapter.test.ts`, `ai-reader-adapter.test.ts`,
  `ai-reader-openai-adapter.test.ts` con el caso 404 al leer; `run-document-job-ai-provider.test.ts`
  con R23 y R25; todo en verde.

- [ ] **T7. Composición** (dep. T4, T6). `lib/composition/index.ts`.
  *Hecho:* `ai-provider-wiring.test.ts` (gateway sin uso, `selectAiModel`, R5) y
  `module-shape.test.ts` en verde; `ai-model-literals.test.ts` sigue en verde (R6).

- [ ] **T8. Server Action** (dep. T7). `selectAiModelAction` y vistas campo a campo en
  `ai-provider-actions.ts`.
  *Hecho:* `ai-provider-actions.test.ts` con `selectAiModelAction` y R13 en verde.

## Bloque D — pantalla (frontend_dev)

- [ ] **T9. `AiModelSelect`** (dep. T8). `components/ai-model-select.tsx` según `design.md > 12.1` y
  los tres tableros. Verificar si `SharedSelectControl` ya trae flecha que gira y entrada `.pop`.
  *Hecho:* `ai-model-select.test.tsx` (R26–R28, R31) en verde.

- [ ] **T10. Tarjeta** (dep. T9). `ai-provider-card.tsx`: sección «Modelo», guardar al elegir con
  toast, confirmación de cambio de proveedor, fuera las dos filas de modelos.
  *Hecho:* `ai-provider-card.test.tsx` (R15, R26, R29) en verde.

- [ ] **T11. [P] Formulario y página** (dep. T8). `ai-provider-form.tsx` (ayuda con un modelo);
  datos de `ai-provider-page.test.tsx` sin `recipeModel`.
  *Hecho:* `ai-provider-form.test.tsx` (R30) y `ai-provider-page.test.tsx` en verde.

- [ ] **T12. Revisión visual** (dep. T10, T11). Escritorio, tablet (≤ 1024 px) y teléfono (390 px)
  contra los tableros; claro y oscuro.
  *Hecho:* capturas en `progress/impl_QT-291.md` con los tres estados del selector.

## Bloque E — E2E y cierre

- [ ] **T13. E2E** (dep. T10). `e2e/integraciones-proveedor-ia.spec.ts`: ajustar el caso que lee
  `recipeModel`/`catalogModel` y añadir el de elegir modelo (`design.md > 13`).
  *Hecho:* `pnpm exec playwright test e2e/integraciones-proveedor-ia.spec.ts` en verde.

- [ ] **T14. Trazabilidad y gate** (dep. todo). Mapa `R<n> -> test` (R1–R31) en
  `progress/impl_QT-291.md`; `./init.sh` en verde.
  *Hecho:* ningún `R<n>` sin test.

## Archivos esperados

- `db/schema.prisma`
- `db/migrations/20261022120000_ai_models/migration.sql`
- `db/migrations/20261022120000_ai_models/down.sql`
- `docs/architecture.md`
- `lib/modules/integraciones/index.ts`
- `lib/modules/integraciones/domain/ai-provider.ts`
- `lib/modules/integraciones/domain/ai-provider-failure.ts`
- `lib/modules/integraciones/domain/ai-model-input.ts`
- `lib/modules/integraciones/domain/select-ai-model.ts`
- `lib/modules/integraciones/domain/get-ai-provider-connection.ts`
- `lib/modules/integraciones/domain/test-ai-provider-key.ts`
- `lib/modules/integraciones/domain/test-saved-ai-provider.ts`
- `lib/modules/integraciones/domain/save-ai-provider-connection.ts`
- `lib/modules/integraciones/domain/resolve-ai-provider-for-reading.ts`
- `lib/modules/integraciones/domain/report-ai-provider-outcome.ts`
- `lib/modules/integraciones/ports/ai-provider-catalog.ts`
- `lib/modules/integraciones/ports/ai-provider-connection-repository.ts`
- `lib/modules/integraciones/adapters/driven/catalog/ai-provider-catalog-prisma.ts`
- `lib/modules/integraciones/adapters/driven/persistence/ai-provider-connection-prisma.ts`
- `lib/modules/integraciones/adapters/driving/ai-provider-actions.ts`
- `lib/modules/documentos/index.ts`
- `lib/modules/documentos/domain/ai-read-use.ts`
- `lib/modules/documentos/domain/run-document-job.ts`
- `lib/modules/documentos/ports/ai-provider-gateway.ts`
- `lib/modules/documentos/adapters/driven/ai/ai-reader-anthropic.ts`
- `lib/modules/documentos/adapters/driven/ai/ai-reader-genai.ts`
- `lib/modules/documentos/adapters/driven/ai/ai-reader-openai.ts`
- `lib/composition/index.ts`
- `app/(private)/integraciones/proveedor-ia/components/ai-model-select.tsx`
- `app/(private)/integraciones/proveedor-ia/components/ai-provider-card.tsx`
- `app/(private)/integraciones/proveedor-ia/components/ai-provider-form.tsx`
- `tests/guards/guard-empresa-en-esquema.test.ts`
- `tests/guards/guard-identificador-de-request.test.ts`
- `tests/integration/integraciones/ai-models-migration.int.test.ts`
- `tests/integration/integraciones/ai-provider-migration.int.test.ts`
- `tests/integration/integraciones/ai-provider-connection-prisma.int.test.ts`
- `tests/unit/integraciones/module-shape.test.ts`
- `tests/unit/integraciones/ai-provider/ai-provider-doubles.ts`
- `tests/unit/integraciones/ai-provider/select-ai-model.test.ts`
- `tests/unit/integraciones/ai-provider/save-ai-provider-connection.test.ts`
- `tests/unit/integraciones/ai-provider/test-ai-provider-key.test.ts`
- `tests/unit/integraciones/ai-provider/test-saved-ai-provider.test.ts`
- `tests/unit/integraciones/ai-provider/resolve-and-report.test.ts`
- `tests/unit/integraciones/ai-provider/ai-provider-failure.test.ts`
- `tests/unit/integraciones/ai-provider/connection-view.test.ts`
- `tests/unit/integraciones/ai-provider/ai-provider-actions.test.ts`
- `tests/unit/documentos/run-document-job-ai-provider.test.ts`
- `tests/unit/documentos/ai-reader-adapter.test.ts`
- `tests/unit/documentos/ai-reader-anthropic-adapter.test.ts`
- `tests/unit/documentos/ai-reader-openai-adapter.test.ts`
- `tests/unit/composition/ai-provider-wiring.test.ts`
- `tests/unit/integraciones-ui/ai-model-select.test.tsx`
- `tests/unit/integraciones-ui/ai-provider-card.test.tsx`
- `tests/unit/integraciones-ui/ai-provider-form.test.tsx`
- `tests/unit/integraciones-ui/ai-provider-page.test.tsx`
- `e2e/integraciones-proveedor-ia.spec.ts`
- `progress/impl_QT-291.md`
