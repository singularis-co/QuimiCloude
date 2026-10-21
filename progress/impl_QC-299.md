# impl QC-299 — pasos-de-acondicionamiento

## Tanda 1 — Bloque A (T1, T2) · commit 83c5111d

### Archivos
- `db/schema.prisma` (solo las 6 líneas de la feature; se descartó el realineado de `prisma format` en modelos ajenos)
- `db/migrations/20261021120000_conditioning_step_actions/{migration,down}.sql`
- `db/migrations/20261021120001_conditioning_steps/{migration,down}.sql`
- `tests/unit/recetas/schema/recetas-schema.test.ts` (tres `Json`)
- `tests/integration/recetas/recipe-conditioning-steps-migration.int.test.ts` (nuevo)
- `tests/integration/aislamiento.json` (alta del test nuevo)
- `tests/guards/guard-identificador-de-request.test.ts` (alta de las dos migraciones en `MIGRACIONES_ESPERADAS`)

### Desvío del design anotado
- Índice `order_execution_entries_conditioning_step_once`: el predicado compara el enum sin `::text`
  (el cast a texto no es IMMUTABLE y Postgres lo rechaza en un índice, 42P17). Mismo efecto.

### Verificación
- `vitest run` recetas-schema + migración int + guard identificador: 3 archivos, 52 tests verdes
  (base efímera `qct_qc299_*`, borrada al terminar).
- Ciclo T1 sobre una copia desechable de la plantilla (`qct_qc299_t1check`, borrada):
  `db:migrate` → `db:rollback` (revierte 20261021120001) → down de 20261021120000 (aborta con
  `ROLLBACK ABORTADO: hay 1 anotacion(es)...` si hay fila; limpio deja 11 acciones y fases
  MANUFACTURING/PACKING) → `db:migrate` reaplica las dos. `db:rollback` siempre toma la última
  carpeta, así que el down de la 1 se aplicó con su mismo SQL + borrado de la fila de registro.
- `pnpm exec vitest run guard`: 80 archivos, 1096 verdes, 20 skipped.
- `pnpm run lint`: 0 errores, 10 warnings (preexistentes).
- `pnpm run typecheck`: **1 error** — `step-evidence-prisma.ts(18)`: el `Record<DbEvidencePhase, …>`
  exige `CONDITIONING`. Es el mapeo de T9 (`design.md > 4.6`); se cierra en la tanda que lleve T9.

### Base de desarrollo
La base local compartida (`QuimiCloude`) tiene 15 migraciones de otras ramas y **no** tiene las de
QC-299 aplicadas. No se tocó.

## Mapa R<n> -> test (parcial)
- R1 → `recipe-conditioning-steps-migration.int.test.ts` («R1: el UP…», «R1: el DOWN…»); `recetas-schema.test.ts` («R1: conditioningSteps mapea…»)
- R27 (BD) → `recipe-conditioning-steps-migration.int.test.ts` (cinco casos «R27: …»)
