# impl QC-283 — acondicionamiento-en-el-recorrido

## Tanda 0 · T1 — Esquema, migraciones y tipos de escritura (backend_dev, 2026-10-14)

### Archivos

Creados:
- `db/migrations/20261015120000_order_execution_conditioning_actions/migration.sql` y `down.sql`
- `db/migrations/20261015120100_order_execution_batch_lines/migration.sql` y `down.sql`
- `lib/modules/asignaciones/domain/conditioning-trace.ts` (C2.1 entero)
- `tests/unit/asignaciones/schema/order-execution-conditioning-migration.test.ts`

Modificados (produccion):
- `db/schema.prisma` (C1.1 + C1.2) y `pnpm exec prisma generate`
- `lib/modules/asignaciones/domain/execution-entry.ts` (C2.2)
- `lib/modules/asignaciones/adapters/driven/persistence/execution-log-prisma.ts` (3 pares; C2.3 en `append` y `listEntriesForOrders`)
- `lib/modules/asignaciones/index.ts` (`export type` de C4)
- `app/(private)/dashboard/components/execution-trace-format.ts` (3 etiquetas)
- `app/(private)/dashboard/recorrido/[id]/components/execution-timeline.tsx` (3 tonos/iconos)

Modificados (tests):
- `tests/integration/asignaciones/order-execution-entries-constraints.int.test.ts` (7 casos R7 nuevos)
- `tests/unit/asignaciones/execution-log-prisma.test.ts` (R7/R33 nuevos; conteos 8→11 con nota fechada)
- `tests/unit/asignaciones/execution-log-repository.test.ts` (conteos 8→11 con nota fechada)
- `tests/unit/dashboard/execution-trace-format.test.ts` (etiquetas, nota fechada)
- `tests/ui/dashboard/textos-dashboard.test.tsx` (`TEXTOS.acciones` +3; R21 compara las 8 pintadas, nota fechada)
- `batchLines: null` en los fixtures de `execution-trace`, `get-execution-trace`, `list-execution-traces`,
  `execution-trace-detail`, `recorrido-rediseno` (el campo nuevo es obligatorio en `ExecutionEntryRecord`)
- `tests/guards/guard-identificador-de-request.test.ts` (las 2 migraciones en `MIGRACIONES_ESPERADAS`, como pide la guardia)

`order-execution-entries-migration.test.ts` (QC-82) no hizo falta tocarlo: sigue verde.

### Decisiones de implementacion
- `append` solo manda `batchLines` en `conditioning_batch_save` (validada con zod antes de escribir);
  en el resto omite la columna, que queda NULL. Asi los asserts exactos de QC-82 sobre `data` siguen igual.
- `listEntriesForOrders` parsea con `safeParse` y lanza con el id de la anotacion si no pasa (R33).

### R → test
| R | Test |
|---|---|
| R7 | `order-execution-conditioning-migration.test.ts` › «R7: los tres CHECK, con su texto literal, y ninguno mas» (+ «R7: anade batch_lines…», «R7: …versiones debilitadas», «R7: el CHECK de QC-82…») |
| R7 | `order-execution-entries-constraints.int.test.ts` › «R7: rechaza … con posicion de paso», «… con motivo», «… sin foto», «… foto sin lineas», «… foto que no es un array», «… foto en cualquier anotacion que no sea un guardado»; aceptacion: «R7: acepta las tres acciones nuevas…» |
| R7 | `execution-log-prisma.test.ts` › «R7: conditioning_batch_save escribe su foto…», «R7: %s no manda batchLines…» |
| R8 | `execution-log-prisma.test.ts` › «R31: el archivo del registro no contiene update…» y «R31 / R22: las unicas operaciones…» (QC-82, verdes) |
| R9 | `order-execution-conditioning-migration.test.ts` › «R9: ninguna migracion inserta ni actualiza filas» |
| R33 | `execution-log-prisma.test.ts` › «R33: foto corrupta lanza al leer (%s)» (7 casos), «R33: append valida la foto con zod…», «R33: listEntriesForOrders selecciona batchLines…», «R33: una foto con presentationName null es valida» |
| R34 | `order-execution-conditioning-migration.test.ts` › «R34: las dos migraciones tienen su down.sql», «R34: el down de batch_lines…», «R34: el down de las acciones abre con una guarda RAISE EXCEPTION…», «R34: …recrea el tipo con los ocho valores…», «R34: …tira los CHECK que nombran action…» |

### Verificacion (salida real)
- `pnpm exec next typegen` (el worktree no tenia `.next/types`; sin el, `app/layout.tsx` da TS2304 `LayoutProps`, ajeno a T1; CI lo corre igual).
- `pnpm run typecheck` → `tsc --noEmit` sin errores.
- `pnpm run lint` → `✖ 7 problems (0 errors, 7 warnings)`, todos en archivos no tocados (`confirm-catalog-import.test.ts`, `order-service.test.ts`).
- `pnpm exec vitest related --run <17 archivos>` → `Test Files 1 failed | 390 passed (391)`, `Tests 1 failed | 6587 passed | 2 skipped`. El rojo era `textos-dashboard.test.tsx › R21 - las ocho acciones…`; corregido y re-corrido: `Test Files 3 passed (3)`, `Tests 93 passed (93)`.
- `pnpm exec vitest run --project integration tests/integration/asignaciones/order-execution-entries-constraints.int.test.ts` → plantilla nueva `qct_tpl_f928446831e4` construida con las 2 migraciones (paso 5/6 «esquema al dia» ok); `Tests 21 passed (21)`.
- `pnpm exec vitest run guard` → primero 1 rojo (`guard-identificador-de-request` › R19, migraciones nuevas sin listar); tras listarlas: `Test Files 76 passed (76)`, `Tests 1066 passed | 20 skipped`.
- `down.sql` probado en una base desechable `CREATE DATABASE … TEMPLATE qct_tpl_f928446831e4` (borrada al final; la base de desarrollo no se toco): con una fila `CONDITIONING_START` el down de las acciones aborta con «ROLLBACK ABORTADO…» y tras el ROLLBACK el estado es identico; sin filas, down batch_lines + down acciones dejan el enum en 8 valores, sin `batch_lines` y con los 3 CHECK de QC-82; re-aplicar los UP devuelve exactamente el estado UP.

Veredicto: T1 hecha; typecheck, lint, guardias y tests de T1 en verde.
