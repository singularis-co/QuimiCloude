# QC-275 — proveedor-ia-propio · tasks.md

> Orden y dependencias. `[P]` = puede ir en paralelo con las demás `[P]` de su mismo bloque una vez
> cumplidas sus dependencias. Cada task cierra con `pnpm run typecheck`, `pnpm run lint`,
> `pnpm exec vitest related --run <archivos tocados>` y, si toca guardias,
> `pnpm exec vitest run guard`. Ningún subagente corre `pnpm test` entero.
>
> **Precondición de F2 (no es una task):** el humano cerró en F1.4 los `[POR VERIFICAR]` de
> `design.md > 19` que bloquean: los ocho modelos (bloquea T2) y la aprobación de `openai` (bloquea
> T0). Los logos (`[POR CONFIRMAR]`) no bloquean: la pantalla sale con monograma (T15).

## Bloque 0 — Dependencia

- [x] **T0. Verificar e instalar `openai`.** `npm view openai deprecated time.modified license` y
  descargas semanales; si los cuatro checks pasan, completar la fila de `design.md > 18.1` en
  `docs/dependencias.md` con los datos reales y la aprobación de F1.4, `pnpm add openai`. Si alguno
  falla: **parar** y devolver al leader. Enmendar en el mismo commit las filas de
  `@anthropic-ai/sdk` y `@google/genai` (`design.md > 18.2`).
  *Hecho:* `guard-dependencias-aprobadas` verde; `pnpm-lock.yaml` con `openai`; las tres filas al
  día.
  *Cubre:* R44.

## Bloque 1 — Datos

- [x] **T1. Catálogo de errores.** Medir el conteo de `ERROR_CODES` en `dev`; añadir
  `ai_provider_missing` y `ai_provider_error` con sus textos (`design.md > 11`); `catalogo.test.ts`
  sube en 2. *Depende de:* —. `[P]`
  *Hecho:* `catalogo.test.ts` y `guard-catalogo-de-errores` verdes.
- [x] **T2. Esquema y migración.** Enums, `AiProvider` y `AiProviderConnection` en
  `db/schema.prisma` con `/// @module integraciones`; migración `20261013150000_ai_providers` con el
  orden de `design.md > 2.2`, las cuatro filas con los modelos **cerrados en F1.4** y su `down.sql`.
  `ai_providers` en `EXENTAS` de `guard-empresa-en-esquema` y en el bullet de
  `docs/architecture.md > Dominio` n.º 1. *Depende de:* precondición de modelos. `[P]`
  *Hecho:* `pnpm run db:migrate` aplica; `down.sql` + `migration.sql` deja el mismo esquema
  (`ai-provider-migration.int.test.ts`); guardias de esquema, RLS y exentas verdes.
  *Cubre:* R4, R5.

## Bloque 2 — Dominio de `integraciones`

- [x] **T3. Tipos, fallo y entrada.** `domain/ai-provider.ts`, `ai-provider-failure.ts` (mensajes de
  `design.md > 4.4`), `ai-provider-input.ts` (zod), `hasConfigurePermission` en `actor.ts`; puertos
  `ai-provider-connection-repository.ts`, `ai-provider-catalog.ts`, `ai-provider-probe.ts`.
  *Depende de:* T1. *Hecho:* `ai-provider-failure.test.ts` y `connection-view.test.ts` verdes.
  *Cubre:* R8, R11, R18.
- [x] **T4. Casos de uso de actor.** `get-ai-provider-connection`, `test-ai-provider-key`,
  `test-saved-ai-provider`, `save-ai-provider-connection` (con la segunda vuelta de la carrera),
  `disconnect-ai-provider`, `get-ai-provider-readiness`; exportados por `index.ts`.
  *Depende de:* T3. *Hecho:* `authorization`, `test-ai-provider-key`, `test-saved-ai-provider`,
  `save-ai-provider-connection`, `disconnect-ai-provider` verdes con puertos simulados.
  *Cubre:* R1, R2, R7, R9, R10–R20.
- [x] **T5. Casos de uso de sistema.** `resolve-ai-provider-for-reading`, `getAiProviderStatus`,
  `report-ai-provider-outcome`. *Depende de:* T3. `[P]` con T4.
  *Hecho:* `resolve-and-report.test.ts` verde. *Cubre:* R6, R9, R21, R25, R27.
- [x] **T6. Persistencia y catálogo.** `persistence/ai-provider-connection-prisma.ts` (ámbito por
  `company-scope.ts`, `P2002` → error de carrera) y `catalog/ai-provider-catalog-prisma.ts`.
  *Depende de:* T2, T3. *Hecho:* `ai-provider-connection-prisma.int.test.ts` verde;
  `guard-ambito-empresa-integraciones` verde. *Cubre:* R2, R4, R5, R7, R19.
- [x] **T7. Doble de la prueba.** `adapters/driven/ai/ai-provider-probe-canned.ts`.
  *Depende de:* T3. `[P]` *Hecho:* `ai-provider-probe-canned.test.ts` verde. *Cubre:* R40.

## Bloque 3 — `documentos`

- [x] **T8. Dominio de documentos.** `errors.ts` (+2 clases), `ai-read-use.ts`, `failure-kind.ts`
  (+2 códigos definitivos), `ports/ai-provider-gateway.ts`, `issue-upload-links.ts` (paso de
  conexión), `run-document-job.ts` (`pipelineFor`, lookup, observador, informe); contrato en
  `index.ts`. Adaptar los tests existentes de `design.md > 15.3` (run-document-job, issue-upload-links,
  failure-kind, module-contract, authorization, document-upload-actions, document-job-route).
  *Depende de:* T1, T3 (tipos por contrato). *Hecho:* `run-document-job-ai-provider.test.ts`,
  `issue-upload-links-ai-provider.test.ts` y los adaptados verdes; los tests de `read-pdf-with-ai`,
  `process-pdf-by-strategy`, `crop-catalog-images` y `ai-reader-canned` **sin tocar** y verdes.
  *Cubre:* R21, R23–R28.
- [x] **T9. Adaptadores de SDK.** Reescribir `ai-reader-anthropic.ts` y `ai-reader-genai.ts` (config
  por parámetro, `probeX`, `classifyXError`); crear `ai-reader-openai.ts` (OpenAI y OpenRouter).
  **Primero** cerrar contra los paquetes instalados los `[POR VERIFICAR]` 3–5 de `design.md > 19`
  y anotarlos en `progress/impl_QC-275.md`. Borrar `config/ai-config-env.ts` y
  `tests/unit/documentos/ai-config.test.ts`; crear `ai-model-literals.test.ts` (R16 mudado y tensado)
  y `openai-sdk-isolation.test.ts`.
  *Depende de:* T0, T3, T8. *Hecho:* `ai-reader-anthropic-adapter`, `ai-reader-adapter`,
  `ai-reader-openai-adapter`, `ai-model-literals`, `openai-sdk-isolation` verdes.
  *Cubre:* R10, R11, R22, R25, R26, R29, R43.

## Bloque 4 — Composición y acciones

- [ ] **T10. Cableado.** `lib/composition/index.ts` según `design.md > 8`: `READER_BY_PROVIDER`,
  `PROBE_BY_PROVIDER`, `aiProviderProbe`, `aiProviderGateway`, `documentPipelineFor`; `documentos`
  pierde dos claves y `issueUploadLinks`/`runDocumentJob` reciben sus deps nuevas; `integraciones`
  gana nueve miembros. Adaptar `documentos-facade.test.ts`, `module-shape.test.ts` y
  `guard-dobles-e2e.test.ts` (`design.md > 15.3`).
  *Depende de:* T4–T9. *Hecho:* `ai-provider-wiring.test.ts` y los adaptados verdes;
  `pnpm exec vitest run guard` verde. *Cubre:* R40, R41, R42.
- [ ] **T11. Server Actions.** `adapters/driving/ai-provider-actions.ts` (`design.md > 10`).
  *Depende de:* T10. *Hecho:* `ai-provider-actions.test.ts` verde; el barrido de
  `session-once-per-request-actions.test.ts` sigue verde. *Cubre:* R1, R8, R13–R20, R37.

## Bloque 5 — Pantalla

- [ ] **T12. Página Proveedor IA.** `page.tsx` reescrita y `components/` (`ai-provider-brand.ts`,
  `ai-provider-logo.tsx`, `ai-provider-picker.tsx`, `ai-provider-form.tsx`, `ai-provider-card.tsx`,
  `index.ts`) según los tres tableros. Adaptar `integration-pages.test.tsx`.
  *Depende de:* T11. *Hecho:* `ai-provider-page`, `ai-provider-form`, `ai-provider-card` verdes.
  *Cubre:* R3, R8, R30–R36.
- [ ] **T13. Aviso de bloqueo.** `components/shared/ai-provider-required-notice.tsx` (+ `index.ts`,
  fila en `CATALOGO.md`); ramas en `produccion/formulas/page.tsx` y `proveedores/[id]/page.tsx`.
  Ampliar `formulas-upload.test.tsx`, `supplier-detail-upload.test.tsx`,
  `document-upload-errors.test.tsx`; simular la readiness en los tests de página de
  `design.md > 15.3`. *Depende de:* T11. `[P]` con T12.
  *Hecho:* `ai-provider-required-notice.test.tsx` y los ampliados verdes. *Cubre:* R37–R39.

## Bloque 6 — Corte, documentación y E2E

- [ ] **T14. Corte de variables.** Quitar el bloque de IA de `.env.example`; en
  `docs/architecture.md`, filas de la tabla de variables, línea de integraciones externas y frase del
  build de preview (`design.md > 9`). *Depende de:* T9. `[P]`
  *Hecho:* `guard-variables-por-entorno` verde; `ai-model-literals.test.ts` (R22) verde.
  *Cubre:* R22.
- [ ] **T15. Logos.** Si el humano entregó los SVG oficiales con su uso de marca confirmado,
  versionarlos en `public/brand/ai-providers/` y mapearlos en `ai-provider-brand.ts`; si no, dejar
  el monograma y anotar R35 como pendiente en `progress/impl_QC-275.md`. *Depende de:* T12.
  *Hecho:* `ai-provider-card.test.tsx` afirma el `alt` (con SVG) o el `aria-label` (monograma).
  *Cubre:* R35.
- [ ] **T16. E2E.** `e2e/integraciones-proveedor-ia.spec.ts` (`design.md > 15.4`); fila sembrada de
  conexión en `documentos.spec.ts`, `formula-desde-pdf.spec.ts`, `catalogo-desde-pdf.spec.ts` (y
  `movimiento.spec.ts` si sube PDF), con su limpieza; `e2e/integraciones.spec.ts` y
  `E2E_ESPERADOS` de `guard-identificador-de-request.test.ts`.
  *Depende de:* T12, T13. *Hecho:* `pnpm exec playwright test e2e/integraciones-proveedor-ia.spec.ts`
  y los cuatro specs tocados verdes en chromium y webkit. *Cubre:* R3, R8, R13, R16, R17, R20,
  R30–R34, R37, R41.
- [ ] **T17. Trazabilidad.** Mapa `R1…R44 → test` en `progress/impl_QC-275.md`; ningún `R<n>` sin
  test (R35 puede quedar marcado pendiente de logos si T15 no los tuvo). *Depende de:* T0–T16.
  *Hecho:* `./init.sh` verde.

## Archivos esperados

- `db/schema.prisma`
- `db/migrations/20261013150000_ai_providers/migration.sql`
- `db/migrations/20261013150000_ai_providers/down.sql`
- `package.json`
- `pnpm-lock.yaml`
- `.env.example`
- `docs/architecture.md`
- `docs/dependencias.md`
- `lib/composition/index.ts`
- `lib/modules/errores/domain/error-codes.ts`
- `lib/modules/errores/domain/error-catalog.ts`
- `lib/modules/integraciones/index.ts`
- `lib/modules/integraciones/domain/actor.ts`
- `lib/modules/integraciones/domain/ai-provider.ts`
- `lib/modules/integraciones/domain/ai-provider-failure.ts`
- `lib/modules/integraciones/domain/ai-provider-input.ts`
- `lib/modules/integraciones/domain/get-ai-provider-connection.ts`
- `lib/modules/integraciones/domain/test-ai-provider-key.ts`
- `lib/modules/integraciones/domain/test-saved-ai-provider.ts`
- `lib/modules/integraciones/domain/save-ai-provider-connection.ts`
- `lib/modules/integraciones/domain/disconnect-ai-provider.ts`
- `lib/modules/integraciones/domain/get-ai-provider-readiness.ts`
- `lib/modules/integraciones/domain/resolve-ai-provider-for-reading.ts`
- `lib/modules/integraciones/domain/report-ai-provider-outcome.ts`
- `lib/modules/integraciones/ports/ai-provider-connection-repository.ts`
- `lib/modules/integraciones/ports/ai-provider-catalog.ts`
- `lib/modules/integraciones/ports/ai-provider-probe.ts`
- `lib/modules/integraciones/adapters/driven/persistence/ai-provider-connection-prisma.ts`
- `lib/modules/integraciones/adapters/driven/catalog/ai-provider-catalog-prisma.ts`
- `lib/modules/integraciones/adapters/driven/ai/ai-provider-probe-canned.ts`
- `lib/modules/integraciones/adapters/driving/ai-provider-actions.ts`
- `lib/modules/documentos/index.ts`
- `lib/modules/documentos/domain/errors.ts`
- `lib/modules/documentos/domain/ai-read-use.ts`
- `lib/modules/documentos/domain/failure-kind.ts`
- `lib/modules/documentos/domain/issue-upload-links.ts`
- `lib/modules/documentos/domain/run-document-job.ts`
- `lib/modules/documentos/ports/ai-provider-gateway.ts`
- `lib/modules/documentos/adapters/driven/ai/ai-reader-anthropic.ts`
- `lib/modules/documentos/adapters/driven/ai/ai-reader-genai.ts`
- `lib/modules/documentos/adapters/driven/ai/ai-reader-openai.ts`
- `lib/modules/documentos/adapters/driven/config/ai-config-env.ts`
- `app/(private)/integraciones/proveedor-ia/page.tsx`
- `app/(private)/integraciones/proveedor-ia/components/index.ts`
- `app/(private)/integraciones/proveedor-ia/components/ai-provider-brand.ts`
- `app/(private)/integraciones/proveedor-ia/components/ai-provider-logo.tsx`
- `app/(private)/integraciones/proveedor-ia/components/ai-provider-picker.tsx`
- `app/(private)/integraciones/proveedor-ia/components/ai-provider-form.tsx`
- `app/(private)/integraciones/proveedor-ia/components/ai-provider-card.tsx`
- `app/(private)/produccion/formulas/page.tsx`
- `app/(private)/proveedores/[id]/page.tsx`
- `components/shared/ai-provider-required-notice.tsx`
- `components/shared/index.ts`
- `components/shared/CATALOGO.md`
- `public/brand/ai-providers/anthropic.svg`
- `public/brand/ai-providers/google.svg`
- `public/brand/ai-providers/openai.svg`
- `public/brand/ai-providers/openrouter.svg`
- `tests/unit/integraciones/ai-provider/authorization.test.ts`
- `tests/unit/integraciones/ai-provider/test-ai-provider-key.test.ts`
- `tests/unit/integraciones/ai-provider/test-saved-ai-provider.test.ts`
- `tests/unit/integraciones/ai-provider/save-ai-provider-connection.test.ts`
- `tests/unit/integraciones/ai-provider/disconnect-ai-provider.test.ts`
- `tests/unit/integraciones/ai-provider/resolve-and-report.test.ts`
- `tests/unit/integraciones/ai-provider/ai-provider-failure.test.ts`
- `tests/unit/integraciones/ai-provider/connection-view.test.ts`
- `tests/unit/integraciones/ai-provider/ai-provider-actions.test.ts`
- `tests/unit/integraciones/ai-provider/ai-provider-probe-canned.test.ts`
- `tests/unit/integraciones/module-shape.test.ts`
- `tests/unit/composition/ai-provider-wiring.test.ts`
- `tests/unit/composition/documentos-facade.test.ts`
- `tests/unit/documentos/run-document-job-ai-provider.test.ts`
- `tests/unit/documentos/issue-upload-links-ai-provider.test.ts`
- `tests/unit/documentos/ai-reader-openai-adapter.test.ts`
- `tests/unit/documentos/ai-reader-anthropic-adapter.test.ts`
- `tests/unit/documentos/ai-reader-adapter.test.ts`
- `tests/unit/documentos/ai-model-literals.test.ts`
- `tests/unit/documentos/openai-sdk-isolation.test.ts`
- `tests/unit/documentos/ai-config.test.ts`
- `tests/unit/documentos/run-document-job.test.ts`
- `tests/unit/documentos/run-document-job-log.test.ts`
- `tests/unit/documentos/document-job-route.test.ts`
- `tests/unit/documentos/issue-upload-links.test.ts`
- `tests/unit/documentos/authorization.test.ts`
- `tests/unit/documentos/document-upload-actions.test.ts`
- `tests/unit/documentos/failure-kind.test.ts`
- `tests/unit/documentos/module-contract.test.ts`
- `tests/unit/documentos-ui/formulas-upload.test.tsx`
- `tests/unit/documentos-ui/supplier-detail-upload.test.tsx`
- `tests/unit/documentos-ui/document-upload-errors.test.tsx`
- `tests/unit/recetas-ui/recipe-page.test.tsx`
- `tests/unit/proveedores-ui/supplier-detail-page.test.tsx`
- `tests/unit/paridad/recetas-paridad.test.tsx`
- `tests/unit/paridad/catalogo-paridad.test.tsx`
- `tests/unit/navegacion/pantallas-exigen-permiso.test.tsx`
- `tests/unit/integraciones-ui/integration-pages.test.tsx`
- `tests/unit/integraciones-ui/ai-provider-page.test.tsx`
- `tests/unit/integraciones-ui/ai-provider-form.test.tsx`
- `tests/unit/integraciones-ui/ai-provider-card.test.tsx`
- `tests/unit/shared/ai-provider-required-notice.test.tsx`
- `tests/unit/errores/catalogo.test.ts`
- `tests/integration/integraciones/ai-provider-connection-prisma.int.test.ts`
- `tests/integration/integraciones/ai-provider-migration.int.test.ts`
- `tests/guards/guard-empresa-en-esquema.test.ts`
- `tests/guards/guard-dobles-e2e.test.ts`
- `tests/guards/guard-identificador-de-request.test.ts`
- `e2e/integraciones-proveedor-ia.spec.ts`
- `e2e/integraciones.spec.ts`
- `e2e/documentos.spec.ts`
- `e2e/formula-desde-pdf.spec.ts`
- `e2e/catalogo-desde-pdf.spec.ts`
- `e2e/movimiento.spec.ts`
