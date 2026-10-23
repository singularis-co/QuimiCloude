# QT-291 — seleccion-de-modelo-por-tarea · tasks.md

> Orden por dependencias. `[P]` = puede ir en paralelo con las otras `[P]` de su mismo bloque.
> Cada tanda cierra con `pnpm run typecheck`, `pnpm run lint`, `pnpm exec vitest related --run
> <archivos>` y `pnpm exec vitest run guard`. Nadie corre `pnpm test`.
> `backend_dev`: T0–T8. `frontend_dev`: T9–T12. E2E: T13.

## Bloque A — confirmación y datos

- [x] **T0. Confirmar la lista de modelos** (sin código; **rehacer**: la tabla de
  `progress/impl_QT-291.md > T0` es de la lista antigua). Lista aprobada en F1.4: veinte modelos de
  `design.md > 3`. (a) Los cinco de OpenRouter: re-comprobar en
  `https://openrouter.ai/api/v1/models` que existen y que `architecture.input_modalities` trae `file`
  **e** `image` (sin key). (b) Los quince nativos de Claude, Gemini y OpenAI: confirmar el id **contra
  la API de cada proveedor** (`models.retrieve` / `models.get`, la misma consulta de la prueba de
  QC-275); los marcados † en `design.md > 3` ya los confirmó QC-275. **Sin key, quedan
  «pendiente (sin key)»** en la tabla y la implementación sigue (pregunta abierta 3). (c) Qué código
  devuelve OpenRouter al generar con un id inexistente (`design.md > 7`), si hay key.
  *Hecho:* tabla de veinte filas con proveedor, id, `sort_order`, recomendado, fuente y fecha, o
  «pendiente (sin key)». Si un id **responde que no existe** o no lee las dos cosas, **se para y se
  pregunta**.

- [x] **T1. Esquema y migración** (dep. T0). **Hecho en `418a746f` salvo el seed**: esquema, tabla
  `ai_models`, borrado de `recipe_model`/`catalog_model`, columnas `model_id`/`unavailable_model` de
  la conexión, guardias y `ai-provider-migration.int.test.ts` no cambian. **Queda:** (a) rehacer el
  `INSERT INTO "ai_models"` de `db/migrations/20261022120000_ai_models/migration.sql` con las veinte
  filas de `design.md > 3` (`sort_order` 1–5 por proveedor, `is_default` en los cuatro recomendados);
  `down.sql` no cambia (borra la tabla). (b) Rehacer en
  `tests/integration/integraciones/ai-models-migration.int.test.ts` los casos «R2: la migracion
  siembra exactamente la lista aprobada» (veinte filas exactas con su orden) y «R3: cada proveedor
  tiene exactamente un predeterminado» (y que es el de `design.md > 3`). Si la migración ya está
  aplicada en la base de test, se reconstruye la plantilla.
  *Hecho:* `pnpm exec prisma validate`; migración aplicada en la base de test; `vitest run guard` en
  verde; `ai-models-migration.int.test.ts` (R1–R4, R7) y `ai-provider-migration.int.test.ts` en verde.

## Bloque B — dominio y adaptadores de `integraciones`

- [x] **T2. Tipos y textos** (dep. T1). `domain/ai-provider.ts` (`AiModelOption`, entrada, registro,
  vista, `modelInUse`; fuera `AiReadUse`), `domain/ai-provider-failure.ts` (`marksConnection`,
  `modelUnavailableNotice`, `isModelUnavailableNotice`, `isAccountFailureNotice`, texto de modelo no
  disponible de R20).
  *Hecho:* `connection-view.test.ts` y `ai-provider-failure.test.ts` en verde (R20 en su parte de
  fallo, R28 a nivel de vista, `isAccountFailureNotice` con los textos de key rechazada y cuota de la
  prueba y de la lectura, y que no reconoce los demás).

- [x] **T3. [P] Adaptadores driven** (dep. T2). `catalog/ai-provider-catalog-prisma.ts` (modelos por
  proveedor, descarta proveedor sin predeterminado), `persistence/ai-provider-connection-prisma.ts`
  (dos campos, P2003), puerto del repositorio.
  *Hecho:* `ai-provider-connection-prisma.int.test.ts` en verde con los campos nuevos.

- [x] **T4. [P] Elegir modelo, con consulta antes de guardar** (dep. T2). `domain/ai-model-input.ts`,
  `domain/select-ai-model.ts` (deps `connections`, `catalog`, `cipher`, `probe`; orden de
  `design.md > 4.3`: permiso → zod → conexión → catálogo → descifrar → consulta de un modelo →
  escribir), `index.ts`; doble de sonda en `ai-provider-doubles.ts` si hace falta.
  *Hecho:* `select-ai-model.test.ts` en verde con un caso por R8, R9, R10, R11; R12 con un caso por
  fila de `design.md > 4.2` (en `ERROR` por modelo no disponible, por key rechazada y por cuota ⇒
  `ACTIVE` con `lastError`/`lastErrorAt` vacíos y la elección guardada; en `ERROR` por sin respuesta
  ⇒ estado y error sin cambios); R32 (la sonda
  recibe solo el modelo elegido, también el predeterminado; nada se escribe antes), R33 (un caso por
  tipo: `rejected_key`, `quota`, `model_unavailable`, `unreachable`, `unexpected`, sin escrituras y con
  su mensaje) y R34 (key ilegible: sin sonda ni escritura).

- [x] **T5. Prueba, guardado, resolución e informe** (dep. T2). `test-ai-provider-key.ts`,
  `test-saved-ai-provider.ts`, `save-ai-provider-connection.ts`, `resolve-ai-provider-for-reading.ts`
  (sin `use`), `report-ai-provider-outcome.ts`, `get-ai-provider-connection.ts`.
  *Hecho:* tests de R14, R16–R19, R21–R24 en verde (`save-…`, `test-ai-provider-key…`,
  `test-saved-…`, `resolve-and-report…`).

## Bloque C — `documentos`, composición y acción

- [x] **T6. Lectores y trabajo** (dep. T5). Los tres `ai-reader-*.ts` (clasificar con `config.model`,
  lanzar con `marksConnection`); `ports/ai-provider-gateway.ts` (sin `use`,
  `reportConnectionFailure`); `run-document-job.ts`; borrar `domain/ai-read-use.ts`.
  *Hecho:* `ai-reader-anthropic-adapter.test.ts`, `ai-reader-adapter.test.ts`,
  `ai-reader-openai-adapter.test.ts` con el caso 404 al leer; `run-document-job-ai-provider.test.ts`
  con R23 y R25; todo en verde.

- [x] **T7. Composición** (dep. T4, T6). `lib/composition/index.ts` (`selectAiModel` con `cipher` y
  el mismo `aiProviderProbe`, doble canned incluido).
  *Hecho:* `ai-provider-wiring.test.ts` (gateway sin uso, `selectAiModel` con sonda, R5) y
  `module-shape.test.ts` en verde; `ai-model-literals.test.ts` sigue en verde (R6).

- [x] **T8. Server Action** (dep. T7). `selectAiModelAction` y vistas campo a campo en
  `ai-provider-actions.ts` (`rejected` y key ilegible ⇒ `ErrorState` sin `revalidatePath`,
  `design.md > 9`).
  *Hecho:* `ai-provider-actions.test.ts` con `selectAiModelAction`, R13, R33 y R34 en verde.

## Bloque D — pantalla (frontend_dev)

- [x] **T9. `AiModelSelect`** (dep. T8). `components/ai-model-select.tsx` según `design.md > 12.1` y
  los tres tableros, con los textos de `design.md > 11` («Recomendado»/«recomendado», nunca
  «predeterminado» en pantalla) y el estado ocupado (`pending`). Verificar si `SharedSelectControl`
  ya trae flecha que gira, entrada `.pop` y disparador deshabilitado.
  *Hecho:* `ai-model-select.test.tsx` (R26–R28, R31, ocupado) en verde.

- [x] **T10. Tarjeta** (dep. T9). `ai-provider-card.tsx`: sección «Modelo», al elegir selector ocupado
  mientras se consulta, toast si se guarda, error bajo el selector y vuelta al valor anterior si
  falla; confirmación de cambio de proveedor con «recomendado»; prueba buena con «Conexión correcta ·
  el modelo en uso responde»; fuera las dos filas de modelos.
  *Hecho:* `ai-provider-card.test.tsx` (R15, R20, R26, R29) en verde.

- [x] **T11. [P] Formulario y página** (dep. T8). `ai-provider-form.tsx`: ayuda sin conexión «Después
  de conectar podrás elegir el modelo.» (R30) y prueba buena «Conexión correcta · el modelo en uso
  responde» (R20); datos de `ai-provider-page.test.tsx` sin `recipeModel`.
  *Hecho:* `ai-provider-form.test.tsx` (R20, R30) y `ai-provider-page.test.tsx` en verde.

- [ ] **T12. Revisión visual** (dep. T10, T11). Escritorio, tablet (≤ 1024 px) y teléfono (390 px)
  contra los tableros; claro y oscuro.
  *Hecho:* capturas en `progress/impl_QT-291.md` con los tres estados del selector.

## Bloque E — E2E y cierre

- [ ] **T13. E2E** (dep. T10). `e2e/integraciones-proveedor-ia.spec.ts`: ajustar el caso que lee
  `recipeModel`/`catalogModel`, el texto de la prueba buena (`testOk`) y la ayuda sin conexión, y
  añadir el de elegir modelo con Gemini (`design.md > 13`).
  *Hecho:* `pnpm exec playwright test e2e/integraciones-proveedor-ia.spec.ts` en verde.

- [ ] **T14. Trazabilidad y gate** (dep. todo). Mapa `R<n> -> test` (R1–R34) en
  `progress/impl_QT-291.md`; ids de T0 que sigan «pendiente (sin key)» listados para el humano;
  `./init.sh` en verde.
  *Hecho:* ningún `R<n>` sin test; el leader lista los ids pendientes y el humano los acepta por
  escrito **antes del PR** (no bloquea la implementación).

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
- `tests/integration/aislamiento.json`
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
