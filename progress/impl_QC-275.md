# QC-275 — bitácora de implementación (backend_dev)

## Tanda 1 — T1, T2, T3, T7 (2026-10-13)

### Archivos
- Modificados: `lib/modules/errores/domain/error-codes.ts`, `error-catalog.ts` (2 códigos al final),
  `db/schema.prisma` (2 enums + `AiProvider` + `AiProviderConnection` al final),
  `docs/architecture.md` (bullet de exentas: diez, + `ai_providers`),
  `lib/modules/integraciones/domain/actor.ts` (+ `hasConfigurePermission`),
  `tests/unit/errores/catalogo.test.ts` (88 → 90), `tests/unit/integraciones/module-shape.test.ts`
  (R13: tres modelos; R18: + 7 archivos), `tests/guards/guard-empresa-en-esquema.test.ts` (EXENTAS
  + `ai_providers`, R7/R14), `tests/guards/guard-identificador-de-request.test.ts` (migración
  esperada + dependencias 43 → 44 por `openai` de T0), `tests/integration/aislamiento.json`.
- Creados: `db/migrations/20261013150000_ai_providers/{migration,down}.sql`;
  `lib/modules/integraciones/domain/{ai-provider,ai-provider-failure,ai-provider-input}.ts`;
  `lib/modules/integraciones/ports/{ai-provider-connection-repository,ai-provider-catalog,ai-provider-probe}.ts`;
  `lib/modules/integraciones/adapters/driven/ai/ai-provider-probe-canned.ts`;
  `tests/unit/integraciones/ai-provider/{ai-provider-failure,connection-view,ai-provider-probe-canned,ai-provider-input,authorization}.test.ts`;
  `tests/integration/integraciones/ai-provider-migration.int.test.ts`.

### R → test (de esta tanda)
- R4, R5 → `ai-provider-migration.int.test.ts`
- R8 → `connection-view.test.ts`
- R9 (texto), R11, R25 (texto), R26 (`isAccountFailure`) → `ai-provider-failure.test.ts`
- R18 → `ai-provider-input.test.ts`
- R37 (`hasConfigurePermission`) → `authorization.test.ts` (T4 lo amplía)
- R40 → `ai-provider-probe-canned.test.ts`

### Desviaciones del design
- `probeFailureMessage(f)` sin `providerName`: los cinco textos aprobados no lo usan.
- `readingFailureMessage` recibe solo `AiProviderAccountFailure` (rejected_key | quota): para los
  otros tres tipos el design no da texto (no marcan).
- `AiProviderFailure` es unión discriminada: `model: string` solo en `model_unavailable`, `null` en el resto.
- `AiProviderConnectionRaceError` vive en `ports/ai-provider-connection-repository.ts` (interno).
- FK `provider → ai_providers(code)` con `ON UPDATE CASCADE` además del `ON DELETE RESTRICT` del design.
- `index.ts` de `integraciones` sin tocar: los exports van con T4/T8 (R20 de module-shape).

### Bloqueo abierto
- `guard-catalogo-de-errores` R9 (entradas huérfanas) en ROJO: `ai_provider_missing` y
  `ai_provider_error` no los declara ninguna clase hasta T8 (`AiProviderMissingError`,
  `AiProviderError` en `documentos/domain/errors.ts`). El «Hecho» de T1 no se puede cumplir sin T8.

### Verificación
- typecheck: 0 errores. lint: 0 errores, 7 warnings preexistentes.
- `vitest related`: 827 archivos, 2 rojos: guard R9 (arriba) y
  `proveedores/catalog-line.int.test.ts` R32, que también falla sin mis cambios (stash).
- `vitest run guard`: 75 archivos, 1 rojo (R9 de arriba).
- `ai-provider-migration.int.test.ts`: 10/10 en base efímera.

Veredicto: T1, T2, T3, T7 hechas; la guardia R9 de errores queda roja hasta T8.

## Tanda 2 — T4, T5, T6 (2026-10-13)

### Archivos
- Creados (dominio): `lib/modules/integraciones/domain/{get-ai-provider-connection,test-ai-provider-key,
  test-saved-ai-provider,save-ai-provider-connection,disconnect-ai-provider,get-ai-provider-readiness,
  resolve-ai-provider-for-reading,report-ai-provider-outcome}.ts`.
- Creados (adaptadores): `adapters/driven/persistence/ai-provider-connection-prisma.ts`,
  `adapters/driven/catalog/ai-provider-catalog-prisma.ts`.
- Modificados: `domain/ai-provider.ts` (+ `AI_PROVIDER_API_KEY_FIELD`, `aiProviderKeyContext`),
  `index.ts` (+ 9 fábricas, `isAccountFailure` y tipos), `specs/.../tasks.md` (T4–T6 marcadas).
- Tests creados: `tests/unit/integraciones/ai-provider/{ai-provider-doubles.ts,test-ai-provider-key,
  test-saved-ai-provider,save-ai-provider-connection,disconnect-ai-provider,resolve-and-report}.test.ts`,
  `tests/integration/integraciones/ai-provider-connection-prisma.int.test.ts`.
- Tests ampliados (solo añadir): `authorization.test.ts`, `module-shape.test.ts` (R18: + 12 archivos;
  R20: + 32 símbolos del contrato), `tests/integration/aislamiento.json` (+ entrada `commit` al final).

### R → test (de esta tanda)
- R1 → `authorization.test.ts` (5 operaciones × 5 actores rechazados; antes de validar)
- R2 → `authorization.test.ts`, `resolve-and-report.test.ts`, `ai-provider-connection-prisma.int.test.ts`
- R4 → `ai-provider-connection-prisma.int.test.ts` (catálogo por el adaptador)
- R5 → `ai-provider-connection-prisma.int.test.ts` (RLS forzada en las dos, índice único → carrera)
- R6, R21, R24, R25, R26, R27, R28 → `resolve-and-report.test.ts`
- R7 → `save-ai-provider-connection.test.ts`, `ai-provider-connection-prisma.int.test.ts`
- R9 → `test-saved-ai-provider.test.ts`, `resolve-and-report.test.ts`
- R10, R11, R12, R13, R18 → `test-ai-provider-key.test.ts` (R18 también en save)
- R14 → `test-saved-ai-provider.test.ts`
- R15, R16, R17, R19 → `save-ai-provider-connection.test.ts`; R19 también en el de integración
  (dos altas y dos guardados concurrentes reales)
- R20 → `disconnect-ai-provider.test.ts`, `ai-provider-connection-prisma.int.test.ts`
- R23 (`getAiProviderStatus`), R37 (readiness) → `resolve-and-report.test.ts`, `authorization.test.ts`

### Desviaciones del design
- `getAiProviderStatus` es `createGetAiProviderStatus` en `resolve-ai-provider-for-reading.ts`:
  «Archivos esperados» no le da archivo propio.
- El adaptador toma el ámbito con `companyScopeColumns(scope)` (en `where` y en `data`) y NO añade
  una envoltura nueva a `company-scope.ts`: `guard-ambito-empresa-integraciones` fija exactamente
  dos exportaciones allí. Una envoltura propia exigiría tocar la guardia.
- Segunda vuelta de la carrera: `persist` se repite una vez si `create` lanza
  `AiProviderConnectionRaceError` **o** si `update` devuelve `null` (fila borrada entre leer y
  escribir); a la tercera, lanza `AiProviderConnectionRaceError`.
- `reportAiProviderOutcome` recibe `AiProviderFailure` y no marca si `!isAccountFailure` (el puerto
  del gateway de §6.3 pasa un `AiProviderFailure`).
- Si el catálogo no trae el proveedor de una conexión existente (la FK lo impide), los casos de uso
  lanzan `Error` llano (inesperado).
- `parseKeyInput`/`runProbe` (en `test-ai-provider-key.ts`) y `decryptStoredKey` (en
  `test-saved-ai-provider.ts`) se reutilizan desde guardar y resolver.
- `ai-provider-doubles.ts` es un helper de tests nuevo, calcado de `whatsapp-doubles.ts`.

### Verificación
- typecheck: 0 errores. lint: 0 errores, 7 warnings preexistentes (no son de esta tanda).
- `vitest related` (12 de `lib/` + tests tocados + `aislamiento.json`): 354 archivos, 5686 verdes,
  3 omitidos, 0 rojos.
- `vitest run guard`: 75 archivos, 1 rojo, el conocido `guard-catalogo-de-errores` R9 (se cierra con
  T8); `guard-ambito-empresa-integraciones` verde, con el adaptador nuevo dentro del barrido.
- `ai-provider-connection-prisma.int.test.ts`: 13/13 en base efímera.
- `vitest run tests/unit/integraciones`: 35 archivos, 578 verdes.

Veredicto: T4, T5 y T6 hechas y en verde; solo sigue rojo R9 de errores, que se cierra en T8.
