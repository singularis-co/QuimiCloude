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
