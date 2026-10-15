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

## Tanda 0 · T2 — Lectura del recorrido (backend_dev, 2026-10-14)

### Archivos

Modificados (produccion):
- `lib/modules/asignaciones/domain/execution-trace.ts` (C2.9 + C3.3: `active`, `durations`, `totalDuration`; fases, `cancel` que hereda la fase de la anotacion previa, pausas por `resume` solo en produccion, total con precedencia `open` > `unclosed` > `closed`; `CLOSING_ACTIONS` eliminado)
- `lib/modules/asignaciones/domain/get-execution-trace.ts` (C3.1 union discriminada + `toDetailStep` por variante; C3.2 `active`/`durations`)
- `lib/modules/asignaciones/domain/list-execution-traces.ts` (C3.4 `active`/`totalDuration`, `people` = firmantes + equipo sin repetir; deps `team`; helpers `listConditioningTeams` y `toTraceTeamMember`, compartidos con el detalle)
- `lib/modules/asignaciones/ports/conditioning-team-repository.ts` (`listByOrdersInCompany`)
- `lib/modules/asignaciones/adapters/driven/persistence/conditioning-team-prisma.ts` (`listByOrdersInCompany`, sin consulta con lista vacia)
- `lib/composition/index.ts` (`team: createConditioningTeamRepository()` en los dos casos de uso)

Modificados (tests):
- `tests/unit/asignaciones/execution-trace.test.ts` (migrado de `duration`, nota fechada 2026-10-14; casos R19–R24, R26, R28)
- `tests/unit/asignaciones/list-execution-traces.test.ts` (migrado, nota fechada; doble `team`; R11, R27, R29, R31, R32)
- `tests/unit/asignaciones/get-execution-trace.test.ts` (migrado, nota fechada; doble `team`; R11, R13, R32)
- `tests/integration/asignaciones/conditioning-team-repository.int.test.ts` (R10)
- dobles: `tests/unit/asignaciones/conditioning-doubles.ts`, `tests/unit/asignaciones/execution-log-repository.test.ts` (`listByOrdersInCompany` en el puerto)

### Decisiones de implementacion
- Un `cancel` pertenece a la fase de la anotacion previa (si esa es otro `cancel`, la hereda); solo cierra `production` o `packing`, y solo si esa fase esta abierta y sin cerrar. En una fase `unclosed`, un `cancel` que pertenece a ella cuenta como su ultima anotacion (literal de C3.3).
- La pausa de un `resume` se mide contra la anotacion inmediatamente anterior del recorrido, sea de la fase que sea; resultado `max(0, …)`.
- `conditioning_batch_save` sin `batchLines` lanza en `toDetailStep` (el CHECK de T1 y la validacion R33 lo hacen imposible por el adaptador).
- El equipo se pide en UNA llamada por pagina/detalle y solo para pedidos con `conditioning_start`; sus `userId` se suman a la unica lectura de `findRefsIncludingDeletedInCompany`.

### R → test
| R | Test |
|---|---|
| R10 | `conditioning-team-repository.int.test.ts` › «R10: listByOrdersInCompany filtra por empresa y ordena por pedido y position», «R10: con orderIds vacio devuelve la lista vacia sin consultar» |
| R11 | `list-execution-traces.test.ts` y `get-execution-trace.test.ts` › «R11: sin dashboard.consultar no lee registro ni equipo» |
| R13 | `get-execution-trace.test.ts` › «R13: equipo con nombres actuales y grupo foto», «R13: Comenzar sin equipo lleva la lista vacia», «R13: el guardado lleva su foto como lines y el Terminar solo quien firma», «R13: los pasos de produccion no llevan batchLines…» |
| R19 | `execution-trace.test.ts` › «R19: tres fases cerradas», «R19: cada fase usa la primera anotacion que la abre…», «R15 R19: el resultado lleva active, durations y totalDuration…» |
| R20 | `execution-trace.test.ts` › «R20: fase abierta hasta now en su estado»; `list-execution-traces.test.ts` › «R3 R20: …» |
| R21 | `execution-trace.test.ts` › «R21: sin cierre fuera de su estado o dado de baja», «R21: la ultima anotacion de la fase no incluye las de otras fases» |
| R22 | `execution-trace.test.ts` › «R22: fase sin apertura es null; guardados sin Comenzar», «R22: una produccion sin start es null…» |
| R23 | `execution-trace.test.ts` › «R23: descuenta pausas antes de cada resume; resume doble; BLOQUEADO no» (+3 casos R23) |
| R24 | `execution-trace.test.ts` › «R24: cancel cierra solo la fase en curso» (+4 casos R24) |
| R26 | `execution-trace.test.ts` › «R26: total = suma, null = 0, precedencia del kind», «R26: las tres fases null dan closed con 0», «R26: el ms del total es exacto…» |
| R27 | `list-execution-traces.test.ts` › «R27: la fila trae totalDuration y no el desglose»; `get-execution-trace.test.ts` › «R15 R27: el detalle trae el desglose y la fila su suma…» |
| R28 (dominio) | `execution-trace.test.ts` › «R3 R28: … active» (3 casos) |
| R29 | `list-execution-traces.test.ts` › «R29: firmantes y despues equipo, sin repetir», «R29: nombres actuales del directorio…» |
| R31 | `list-execution-traces.test.ts` › «R31: opciones solo de firmantes» |
| R32 | `list-execution-traces.test.ts` › «R32: equipo sin Comenzar no sale», «R32: sin ningun Comenzar en la pagina no consulta el equipo»; `get-execution-trace.test.ts` › «R32: sin Comenzar anotado no consulta el equipo» |

### Verificacion (salida real)
- `pnpm exec vitest run` de los 3 unit de dominio → `Test Files 3 passed (3)`, `Tests 104 passed (104)`.
- `pnpm exec vitest run --project integration tests/integration/asignaciones/conditioning-team-repository.int.test.ts` → plantilla `qct_tpl_f928446831e4` reutilizada, base efimera creada y borrada; `Tests 8 passed (8)`.
- `pnpm run typecheck` → 30 errores, TODOS en `app/` (6), `tests/ui/` (22) y `tests/unit/paridad/recorridos-paridad.test.tsx` (2): leen `duration` o meten `batchLines` en pasos de produccion. `lib/` y los tests de T2 compilan. Los cierra T3 (frontend_dev), como preve `tasks.md > T2 > Hecho cuando`.
- `pnpm run lint` → `✖ 7 problems (0 errors, 7 warnings)`, todos en archivos no tocados (`confirm-catalog-import.test.ts`, `order-service.test.ts`).
- `pnpm exec vitest related --run <12 archivos de T2>` → `Test Files 385 passed (385)`, `Tests 6355 passed | 2 skipped (6357)`.
- `pnpm exec vitest run guard` → `Test Files 76 passed (76)`, `Tests 1066 passed | 20 skipped (1086)`.
- Grafo de codigo (MCP) no usado: exploracion con Grep/Read.

Veredicto: T2 hecha; `lib/` compila, tests de T2, related y guardias en verde; el typecheck del front queda rojo a proposito hasta T3.
