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

## Tanda 0 · T3 — Puente del front: fixtures, formato, lista y tarjetas de duración (frontend_dev, 2026-10-14)

### Archivos

Creados:
- `tests/fixtures/execution-trace-conditioning.ts` (C4: detalle `terminado` con equipo mixto 2 por grupo + 1 directo, dos guardados con corrección y `presentationName: null`; `en_curso` sin equipo y `conditioning` `open`; `anterior` con `conditioning: null`; uno `unclosed` dado de baja; filas con `totalDuration` en los tres `kind`, una con 5 personas y una viva con todo cerrado)

Modificados (producción):
- `app/(private)/dashboard/components/execution-trace-format.ts` (`formatElapsedMinutes`, `formatTraceTotal`, `formatSnapshotDate`, `PHASE_DURATION_LABELS`, `PHASE_OPEN_MARK`, `PHASE_UNCLOSED_MARK`, `CONDITIONING_TEXTS`; `formatTraceDuration` borrada: sin consumidores)
- `app/(private)/dashboard/components/index.ts` (exporta lo nuevo; quita `formatTraceDuration`)
- `app/(private)/dashboard/components/execution-trace-columns.tsx` (celda Duración = cifra en minutos + sufijo `text-xs text-muted-foreground`, mismo texto que `formatTraceTotal`; «En curso» con `row.active`)
- `app/(private)/dashboard/recorrido/[id]/components/execution-trace-detail.tsx` (tarjeta por fase no `null` en orden producción → empaque → acondicionamiento, `formatElapsed` sin sufijo, insignias `progress`/`muted` con `data-testid` de design; rejilla `repeat(auto-fit,minmax(min(170px,50%-6px),1fr))` del tablero: 5 en fila / 3+2 / 2; «En curso» con `trace.active`)

Modificados (tests, nota fechada 2026-10-14): `tests/unit/dashboard/execution-trace-format.test.ts`, `tests/ui/dashboard/execution-trace-table.test.tsx`, `tests/ui/dashboard/execution-trace-detail.test.tsx`, `tests/ui/dashboard/recorrido-rediseno.test.tsx`, `tests/ui/dashboard/textos-dashboard.test.tsx`, `tests/ui/dashboard/dashboard-rediseno.test.tsx`, `tests/unit/paridad/recorridos-paridad.test.tsx` (el snapshot no cambió: el árbol accesible no incluye la cifra).

### Decisiones de implementación
- La rejilla usa el `auto-fit` del tablero con mínimo `min(170px, 50% - gap/2)` en vez de cortes por contenedor: en tablet (~700 px de contenedor, por debajo del corte de 760) un `@max-[760px]:grid-cols-2` daría 2 columnas en lugar de 3+2; el `min()` garantiza 2 columnas en teléfonos estrechos.
- `formatTraceDuration` tenía su test de formato (QC-167 R15): los casos de cifra pasan a `formatElapsed` y los de marca a `formatTraceTotal`.

### R → test
| R | Test |
|---|---|
| R15 (formato) | `execution-trace-format.test.ts` › «R15 - formatSnapshotDate reordena AAAA-MM-DD a dd/mm/aaaa», «R15 - el primer y el ultimo dia del ano no se corren por huso horario» |
| R25 | `execution-trace-detail.test.tsx` › «R25 - tarjetas por fase con insignias; fase null no se pinta», «R25 - una fase sin cierre lleva la insignia «Sin cierre anotado»», «R25 - estado, tres fases y vueltas atras: cinco datos en orden», «R25 - un pedido anterior a la feature no pinta la tarjeta de acondicionamiento», «R25 - la rejilla reparte 5 en una fila, 3 + 2 o 2 columnas segun el ancho»; `execution-trace-format.test.ts` › «R25 - una etiqueta por fase y las dos insignias»; `textos-dashboard.test.tsx` › «R21 - R25 - …» |
| R26 | `execution-trace-format.test.ts` › «R26 - formatElapsedMinutes trunca …» (5), «R26 - formatTraceTotal trunca a minutos y lleva los tres sufijos», «R26 - una duracion negativa se muestra como 0 min»; `execution-trace-table.test.tsx` › «R26 - celda de duracion con total y sufijo», «R26 - la cifra es la de la columna monoespaciada y el sufijo va pequeno y atenuado» |
| R28 | `execution-trace-table.test.tsx` › «R28 - En curso segun active; nunca en dado de baja», «R28 - una fila dada de baja con active a true tampoco lleva la marca»; `execution-trace-detail.test.tsx` › «R28 - En curso segun active; nunca en dado de baja» |

### Verificación (salida real)
- `pnpm run typecheck` → `tsc --noEmit`, exit 0, 0 errores (los 30 que dejó T2 cerrados).
- `pnpm run lint` → `✖ 7 problems (0 errors, 7 warnings)`, los mismos 7 de T2 en archivos no tocados.
- `pnpm exec vitest run` de los 7 tests listados → `Test Files 7 passed (7)`, `Tests 133 passed (133)`.
- `pnpm exec vitest related --run <4 archivos de app + fixture>` → `Test Files 11 passed (11)`, `Tests 212 passed (212)`.
- `pnpm exec vitest run guard` → `Test Files 76 passed (76)`, `Tests 1066 passed | 20 skipped (1086)`.
- Grafo de código (MCP) no usado: exploración con Grep/Read.

Veredicto: T3 hecha; el repo compila, lista y detalle consumen `active`/`totalDuration`/`durations`, tests y guardias en verde.

## Tanda 1A · T4 — Writers ampliados y Comenzar anota (backend_dev, 2026-10-14)

### Archivos

Creados:
- `tests/integration/asignaciones/conditioning-execution-log.int.test.ts` (R1, R2; censado `commit` en `tests/integration/aislamiento.json`)

Modificados (produccion):
- `lib/modules/asignaciones/ports/execution-transaction.ts` (C2.4: `conditioning.finishConditioningAliveById` y `batches`)
- `lib/modules/asignaciones/domain/start-conditioning.ts` (C2.6: `log.append(conditioning_start)` tras `insertAll`, dentro de la transaccion)
- `lib/composition/index.ts` (`executionTransaction`: los dos escritores nuevos sobre `tx`)
- `lib/modules/inventario/adapters/driven/persistence/finished-batch-labels-prisma.ts` (C2.5 adelantado: `createFinishedBatchLabels(db?)`)
- `lib/modules/inventario/domain/finished-batch-labels.ts` (JSDoc de `writeForOrder`, C2.5)

Modificados (tests):
- `tests/helpers/execution-transaction-on-client.ts` (los dos escritores, con «lanza si este archivo no lo usa»; `batches` entra por un 4.º parametro opcional)
- `tests/unit/asignaciones/start-conditioning.test.ts` (doble `log.append`; R1, R2; el orden de R12/R13 gana `anota`, nota fechada)
- `tests/unit/asignaciones/execution-log-repository.test.ts` (R24 de QC-82: las claves ganan `batches`, nota fechada)
- `tests/integration/asignaciones/start-conditioning-team.int.test.ts` (la limpieza borra antes las anotaciones: su FK `RESTRICT` al pedido haria fallar el `finally`; nota fechada)

### Decisiones de implementacion
- **C2.5 entra en T4 y no en T5.** El cableado de C2.4 (`batches: createFinishedBatchLabels(tx)`) no compila sin la firma nueva. T5 añade su test de integracion. Sin `db` el adaptador hace lo de siempre; con `db`, `listOfOrder` lee y `writeForOrder` escribe por el, sin abrir otra transaccion.
- El fallo de `append` en integracion se fuerza con `stepPosition: 1`, que rechaza el CHECK `order_execution_entries_conditioning_has_no_step` dentro de la misma transaccion (el error es de Postgres, no de un doble), siguiendo `execution-atomicity.int.test.ts`.

### R → test
| R | Test |
|---|---|
| R1 | `start-conditioning.test.ts` › «R1: anota conditioning_start en la transaccion, tras la transicion y el equipo», «R1: si anotar falla, el error sale de la transaccion…», «R1: si insertar el equipo falla, no anota», «R1: una escritura %s no anota» (3); `conditioning-execution-log.int.test.ts` › «R1: la transicion, el equipo y la anotacion conditioning_start quedan juntos…», «R1: si append falla no quedan ni transicion ni equipo» |
| R2 | `start-conditioning.test.ts` › «R2: already_mine (repetir Comenzar) no anota»; `conditioning-execution-log.int.test.ts` › «R2: repetir Comenzar (already_mine) no anota otra vez» |

### Verificacion (salida real)
- `pnpm exec vitest run tests/unit/asignaciones/start-conditioning.test.ts tests/unit/asignaciones/execution-log-repository.test.ts` → `Test Files 2 passed (2)`, `Tests 99 passed (99)`.
- `pnpm exec vitest run --project integration tests/integration/asignaciones/conditioning-execution-log.int.test.ts tests/integration/asignaciones/start-conditioning-team.int.test.ts` → plantilla `qct_tpl_f928446831e4` reutilizada, base efimera creada y borrada; `Test Files 2 passed (2)`, `Tests 8 passed (8)`.
- `pnpm exec vitest run --project integration tests/integration/asignaciones/finished-orders.int.test.ts tests/integration/inventario/finished-batch-labels.int.test.ts` (consumidores del helper y del adaptador) → `Test Files 2 passed (2)`, `Tests 13 passed (13)`.
- `pnpm run typecheck` → `tsc --noEmit` sin errores.
- `pnpm exec eslint <10 archivos de T4>` → sin salida (0 problemas).

Veredicto: T4 hecha; Comenzar anota en su transaccion y los tests de T4 estan en verde.

## Tanda 1A · T5 — Guardar datos de lote anota con foto (backend_dev, 2026-10-14)

### Archivos

Modificados (produccion):
- `lib/modules/asignaciones/domain/save-conditioning-batch-data.ts` (C2.7: deps `batches.listOfOrder`, `presentations.findRefs`, `transaction`; foto fuera de la transaccion; `writers.batches.writeForOrder` + `log.append(conditioning_batch_save)` dentro; traduccion de `ExecutionAbortedError`)
- `lib/composition/index.ts` (`saveConditioningBatchData`: `presentations: presentationCatalog`, `transaction: executionTransaction`)
- (C2.5 ya entro en T4: `createFinishedBatchLabels(db?)` y su JSDoc)

Modificados (tests):
- `tests/unit/asignaciones/conditioning-doubles.ts` (`transaccionDeAcondicionamiento`: doble de la transaccion con `batches`, `conditioning.finishConditioningAliveById` y `log`, y `pasos`)
- `tests/unit/asignaciones/save-conditioning-batch-data.test.ts` (deps nuevas, nota fechada; R3, R4)
- `tests/integration/asignaciones/conditioning-execution-log.int.test.ts` (R3, R4, R5)
- `tests/integration/inventario/finished-batch-labels.int.test.ts` (con `db`: no abre transaccion propia; `duplicate_lot` con `db`)
- `tests/integration/asignaciones/finish-conditioning-batch-data.int.test.ts` (la limpieza borra antes las anotaciones; nota fechada)

### Decisiones de implementacion
- `listOfOrder` antes de la transaccion: un `batchId` que no aparece lanza `ConditioningBatchNotFoundError(batchId)` sin abrir la transaccion ni leer el catalogo. Va despues de todas las comprobaciones actuales (fechas, lote repetido), que no cambian de orden.
- `findRefs` recibe los `presentationId` sin repetir, en el orden de la primera linea que los usa.
- `batchLabelsError` traduce `ExecutionAbortedError.outcome` con un `as` al desenlace no-`written` de `FinishedBatchLabelsOutcome`: el `outcome` de `ExecutionAbortedError` es generico (`ExecutionWriteOutcome`) y solo este caso de uso lo lanza con ese tipo.

### R → test
| R | Test |
|---|---|
| R3 | `save-conditioning-batch-data.test.ts` › «R3: compone la foto en el orden enviado, con nombre o null, y la anota en la transaccion tras escribir», «R3: la foto lleva solo las lineas enviadas…»; `conditioning-execution-log.int.test.ts` › «R3: guardado y anotacion en la misma transaccion…»; `finished-batch-labels.int.test.ts` › «R3: con db no abre transaccion propia…» |
| R4 | `save-conditioning-batch-data.test.ts` › «R4, R12: un lote que no es de una linea del pedido…», «R4: un rechazo del guardado (%s) no anota y mantiene el error» (3), «R4: un rechazo de las reglas… no abre la transaccion ni anota», «R4: si anotar falla, el error sale de la transaccion…»; `conditioning-execution-log.int.test.ts` › «R4: un lote duplicado o ajeno al pedido no guarda ni anota», «R4: un append que falla no guarda datos»; `finished-batch-labels.int.test.ts` › «R4: con db, un lote que ya tiene otra linea devuelve duplicate_lot sin escribir» |
| R5 | `conditioning-execution-log.int.test.ts` › «R5: corregir anade otra foto y la primera no cambia» |

### Verificacion (salida real)
- `pnpm exec vitest run tests/unit/asignaciones/save-conditioning-batch-data.test.ts` → `Tests 61 passed (61)`.
- `pnpm exec vitest run` de los 6 unit que usan `conditioning-doubles.ts` → `Test Files 6 passed (6)`, `Tests 161 passed (161)`.
- `pnpm exec vitest run --project integration tests/integration/asignaciones/conditioning-execution-log.int.test.ts tests/integration/inventario/finished-batch-labels.int.test.ts tests/integration/asignaciones/finish-conditioning-batch-data.int.test.ts` → plantilla `qct_tpl_f928446831e4` reutilizada, base efimera creada y borrada; `Test Files 3 passed (3)`, `Tests 18 passed (18)`.
- `pnpm exec tsc --noEmit` → sin errores. `pnpm exec eslint <7 archivos de T5>` → sin salida (0 problemas).

Veredicto: T5 hecha; cada guardado anota su foto en la misma transaccion y `finish-conditioning-batch-data.int.test.ts` sigue en verde.

## Tanda 1A · T6 — Terminar anota (backend_dev, 2026-10-14)

### Archivos

Modificados (produccion):
- `lib/modules/asignaciones/domain/finish-conditioning.ts` (C2.8: dep `transaction`; `writers.conditioning.finishConditioningAliveById` + `log.append(conditioning_finish)` dentro; traduccion de `ExecutionAbortedError` con la misma tabla de antes)
- `lib/composition/index.ts` (`finishConditioning`: `transaction: executionTransaction`)

Modificados (tests):
- `tests/unit/asignaciones/finish-conditioning.test.ts` (dobles de la transaccion de `conditioning-doubles.ts`; `depsIntocables` con transaccion intocable; nota fechada; R6)
- `tests/integration/asignaciones/conditioning-execution-log.int.test.ts` (R6)
- `tests/integration/asignaciones/finished-orders.int.test.ts` (`finishConditioning` recibe `execution.transaction`; el helper ya usa el `finishConditioningAliveById` real del fixture)

### Decisiones de implementacion
- Las comprobaciones previas (pedido, numero, estado, quien acondiciona, datos de lote) siguen fuera de la transaccion y en el mismo orden; solo la transicion y la anotacion entran. `orders.finishConditioningAliveById` deja de usarse en este caso de uso.

### R → test
| R | Test |
|---|---|
| R6 | `finish-conditioning.test.ts` › «R6: anota conditioning_finish en la transaccion, despues de la transicion», «R6: un rechazo de la transicion (%s) no anota y mantiene el error» (3), «R6: los rechazos previos… no abren la transaccion», «R6: si anotar falla, el error sale de la transaccion…»; `conditioning-execution-log.int.test.ts` › «R6: la transicion a TERMINADO y la anotacion conditioning_finish quedan juntas…», «R6: si append falla el pedido no cambia», «R6: un rechazo de Terminar (datos de lote incompletos) no anota» |

### Verificacion (salida real)
- `pnpm exec vitest run tests/unit/asignaciones/finish-conditioning.test.ts tests/unit/asignaciones/acondicionamiento-authorization.test.ts tests/unit/asignaciones/order-conditioning-actions.test.ts` → `Test Files 3 passed (3)`, `Tests 85 passed (85)`.
- `pnpm exec vitest run --project integration tests/integration/asignaciones/conditioning-execution-log.int.test.ts tests/integration/asignaciones/finish-conditioning-batch-data.int.test.ts tests/integration/asignaciones/finished-orders.int.test.ts tests/integration/asignaciones/start-conditioning-team.int.test.ts` → plantilla `qct_tpl_f928446831e4` reutilizada, base efimera creada y borrada; `Test Files 4 passed (4)`, `Tests 25 passed (25)`.
- `pnpm exec tsc --noEmit` → sin errores. `pnpm exec eslint <5 archivos de T6>` → sin salida (0 problemas).

Veredicto: T6 hecha; Terminar anota en la misma transaccion que la transicion.

## Tanda 1A · T7 — Filtro por persona incluye al equipo (backend_dev, 2026-10-14)

### Archivos

Modificados (produccion):
- `lib/modules/asignaciones/adapters/driven/persistence/execution-log-prisma.ts` (C2.3 `listExecutedOrderIds`: con `userId`, union sin repetir de los pedidos firmados y de `listStartedOrderIdsOfTeamMember`: `orderConditioningTeamMember.findMany({ companyId, userId })` + `orderExecutionEntry.groupBy` con `CONDITIONING_START`, `orderId in` y el mismo rango; sin SQL crudo)
- `lib/modules/asignaciones/ports/execution-log-repository.ts` (solo el JSDoc de `listExecutedOrderIds`: la semantica nueva; firma sin cambios)

Modificados (tests):
- `tests/unit/asignaciones/execution-log-prisma.test.ts` (doble de lectura con `orderConditioningTeamMember.findMany`, nota fechada; R8 estatico, R30/R10, R32)
- `tests/integration/asignaciones/execution-log-read.int.test.ts` (R30, R32, R10)

### Decisiones de implementacion
- Las dos consultas del filtro (firmados y equipo) van en `Promise.all`; la del equipo no se hace sin `userId`, y la de `CONDITIONING_START` no se hace si la persona no esta en ningun equipo.
- En integracion los pedidos de la escena del equipo se crean `EN_CURSO`: `createOrder` no fija `conditioned_by` y el CHECK `orders_conditioned_by_matches_status` rechaza `EN_ACONDICIONAMIENTO` sin el; el estado del pedido no interviene en el filtro.

### R → test
| R | Test |
|---|---|
| R8 | `execution-log-prisma.test.ts` › «R8: la lectura del equipo para el filtro no actualiza ni borra: solo findMany sobre el equipo»; «R31: el archivo del registro no contiene update, upsert ni delete…» y «R31 / R22: las unicas operaciones sobre orderExecutionEntry…» (QC-82, verdes sin tocar) |
| R10 | `execution-log-read.int.test.ts` › «R10: el filtro por equipo no cruza empresas»; `execution-log-prisma.test.ts` › «R30, R10: con persona, suma los pedidos de su equipo…» (las dos consultas llevan `companyId`) |
| R30 | `execution-log-read.int.test.ts` › «R30: encuentra el pedido por el miembro del equipo que no firma ninguna anotacion», «R30: con rango, cuenta el instante del Comenzar», «R30: quien firma y ademas es del equipo no repite el pedido…»; `execution-log-prisma.test.ts` › «R30, R10: …» |
| R32 | `execution-log-read.int.test.ts` › «R32: un equipo sin Comenzar anotado no filtra»; `execution-log-prisma.test.ts` › «R32: sin filas de equipo no consulta Comenzar; sin persona no lee el equipo» |

### Verificacion (salida real)
- `pnpm exec vitest run tests/unit/asignaciones/execution-log-prisma.test.ts` → `Tests 70 passed (70)`.
- `pnpm exec vitest run --project integration tests/integration/asignaciones/execution-log-read.int.test.ts` → plantilla `qct_tpl_f928446831e4` reutilizada, base efimera creada y borrada; primera corrida 5 rojos propios (pedido `EN_ACONDICIONAMIENTO` sin `conditioned_by`, ver decisiones); corregido: `Tests 15 passed (15)`.

### Cierre de la tanda 1A (T4–T7)
- `pnpm run typecheck` → `tsc --noEmit` sin errores (incluye lo que frontend_dev tiene en curso de T8 en el worktree; no dio ningun rojo).
- `pnpm run lint` → `✖ 7 problems (0 errors, 7 warnings)`, los mismos 7 de tanda 0, en archivos no tocados (`confirm-catalog-import.test.ts`, `order-service.test.ts`).
- `pnpm exec vitest run guard` → `Test Files 76 passed (76)`, `Tests 1066 passed | 20 skipped (1086)`.
- `pnpm exec vitest related --run <11 archivos de produccion y helpers de T4–T7>` → `Test Files 386 passed (386)`, `Tests 6428 passed | 2 skipped (6430)`.
- Integracion de la tanda, por task (arriba): `conditioning-execution-log`, `start-conditioning-team`, `finish-conditioning-batch-data`, `finished-orders`, `finished-batch-labels`, `execution-log-read`, todas en verde en base efimera.
- Grafo de codigo (MCP) no usado: exploracion con Grep/Read.

Veredicto: T7 hecha y tanda 1A (T4–T7) cerrada en backend: typecheck, lint, guardias, related y las integraciones de la tanda en verde.

## Tanda 1B · T8 — Cuerpos de Comenzar, guardado y Terminar (frontend_dev, 2026-10-14)

### Archivos

Creados:
- `app/(private)/dashboard/recorrido/[id]/components/conditioning-step-details.tsx` (`ConditioningStartBody`, `ConditioningBatchSaveBody`, `ConditioningBatchLinesTable`; solo `Avatar`, `Table` y partes, `avatarTone`, `getInitials`, `EMPTY_MARK`, iconos `Users` y `Camera` de `lucide-react`)

Modificados (producción):
- `app/(private)/dashboard/recorrido/[id]/components/execution-timeline.tsx` (`StepBody` estrecha por `step.action`: Comenzar → `ConditioningStartBody`, guardado → `ConditioningBatchSaveBody`, Terminar → solo `StepPerson`, el resto como antes; «Hasta la siguiente» se mantiene en todas; `MISSING_PERSON_LABEL` pasa a `MISSING_DATA_LABEL` de la pieza nueva)
- `app/(private)/dashboard/recorrido/[id]/components/index.ts` (reexporta las tres piezas y sus props)

Modificados (tests):
- `tests/ui/dashboard/execution-trace-detail.test.tsx` (describe nuevo «R12 - R18 …», 10 casos con los fixtures de T3; los casos existentes no cambian)
- `tests/unit/paridad/recorridos-paridad.test.tsx` (describe nuevo con nota fechada: snapshot del detalle en las tres variantes del tablero, `terminado`, `en curso` y `anterior`)
- `tests/unit/paridad/__snapshots__/recorridos-paridad.test.tsx.snap` (3 snapshots nuevos; los 6 de la lista no cambian)

### Decisiones de implementación
- Las piezas reciben a quien firma ya pintado (`supervisor` / `savedBy: ReactNode`) en vez del paso entero: así `StepPerson` sigue viviendo en la línea de tiempo y no hay import circular entre los dos archivos.
- El snapshot de paridad de la lista no cubría el detalle (solo congela el `fallback` del `Suspense`), así que «regenerar» no cambiaba nada. Se añaden tres casos del detalle, uno por variante del tablero, para que la revisión a mano tenga algo que comparar.
- El corte tabla ⇄ tarjetas es `@max-[760px]`, el mismo de `DataTable`, contra el `@container` de `PageShell` (el contenedor del recorrido). Tabla y tarjetas están las dos en el DOM y el CSS oculta una, como en `DataTable`.
- La lista del equipo se nombra con `aria-labelledby` apuntando a «Equipo de trabajo · N» (`useId`, que se admite en Server Components).
- Un miembro sin `displayName` se pinta «—» con «Sin dato», igual que `StepPerson`.

### Revisión visual contra los tableros
- `RecorridoAcondicionamiento.dc.html` (terminado): coinciden la fila «Supervisor» con avatar, la etiqueta «Equipo de trabajo · 3» en mayúsculas pequeñas, la lista en caja con filas de 40 px y el grupo a la derecha con el icono `Users` y «Grupo de trabajo:» oculto, «Guardó» + persona + «N presentaciones», la tabla Lote · Presentación · Vencimiento · Día de producción (lote y fechas en monoespaciada, fechas a la derecha, cabecera de 36 px y filas de 44 px), el aviso con `Camera` y Terminar solo con la persona.
- Tablet (en curso, 820 px): el contenedor queda por encima de 760 px, así que la tabla conserva sus columnas; Comenzar sin equipo muestra «Equipo de trabajo · 0» y «Se comenzó sin equipo de trabajo.».
- Teléfono (390 px): la tabla se oculta y cada línea pasa a tarjeta (lote + presentación arriba, «Vence» y «Producido» abajo); la fila del equipo lleva `flex-wrap`, así que el grupo baja debajo del nombre si no cabe.
- Diferencia con el tablero: el tablero no dibuja «Hasta la siguiente» en las anotaciones nuevas, pero `design.md > UI > Línea de tiempo` lo mantiene, y gana el design.

### R → test
| R | Test |
|---|---|
| R12 | `execution-trace-detail.test.tsx` › «R12 - nombre, tono e icono de las tres anotaciones, en orden cronologico tras empaque» |
| R13 | `execution-trace-detail.test.tsx` › «R13 - supervisor y equipo en orden, con grupo», «R13 - un miembro que el directorio no devuelve se pinta «—» con «Sin dato»» |
| R14 | `execution-trace-detail.test.tsx` › «R14 - sin equipo» |
| R15 | `execution-trace-detail.test.tsx` › «R15 - quien guardo, n presentaciones, lineas con fechas dd/mm/aaaa y aviso», «R15 - un guardado de una linea dice «1 presentación»», «R15 - la correccion es otro guardado con su propia foto; la primera no cambia» |
| R16 | `execution-trace-detail.test.tsx` › «R16 - presentacion sin nombre» (en la tabla y en la tarjeta) |
| R17 | `execution-trace-detail.test.tsx` › «R17 - Terminar solo con quien» |
| R18 | `execution-trace-detail.test.tsx` › «R18 - tarjetas de linea con los mismos datos» (acotado al cuerpo de tarjetas del primer guardado) |
| R12–R18, R25 (paridad) | `recorridos-paridad.test.tsx` › «R12 R13 R14 R15 R16 R17 R18 R25 — terminado / en curso / anterior» |

### Verificación (salida real)
- `pnpm exec vitest run tests/ui/dashboard/execution-trace-detail.test.tsx tests/ui/dashboard/recorrido-rediseno.test.tsx` → `Test Files 2 passed (2)`, `Tests 58 passed (58)`.
- `pnpm exec vitest run tests/unit/paridad/recorridos-paridad.test.tsx` → `Snapshots 3 written`, `Test Files 1 passed (1)`, `Tests 9 passed (9)`.
- `pnpm exec vitest related --run <conditioning-step-details.tsx, execution-timeline.tsx, index.ts, los 2 tests>` → `Test Files 5 passed (5)`, `Tests 126 passed (126)`.
- `pnpm run typecheck` → `tsc --noEmit`, 0 errores (con los cambios del backend en curso en el árbol).
- `pnpm run lint` → `✖ 7 problems (0 errors, 7 warnings)`, los mismos 7 de T2/T3 en archivos que no se tocaron.
- `pnpm exec vitest run guard` → `Test Files 76 passed (76)`, `Tests 1066 passed | 20 skipped (1086)`.
- Grafo de código (MCP) no usado: exploración con Grep/Read.

Veredicto: T8 hecha; las tres anotaciones se pintan según el tablero, R12–R18 tienen test y todo está en verde.

## Cierre de la tanda 1 (implementer, 2026-10-14)

Commits: T4 `79d5668f`, T5 `cda5e09b`, T6 `8b79b1e4`, T7 `3b7a40f9`, T8 `a126d98b`.
Sobre el arbol combinado (1A + 1B):
- `pnpm run typecheck` → `tsc --noEmit` sin errores.
- `pnpm run lint` → `✖ 7 problems (0 errors, 7 warnings)`, los mismos de la tanda 0, en archivos no tocados.
- `pnpm exec vitest run guard` → `Test Files 76 passed (76)`, `Tests 1066 passed | 20 skipped (1086)`.
- `pnpm exec vitest related --run <5 archivos de T8>` → `Test Files 5 passed (5)`, `Tests 126 passed (126)`.
- related de T4–T7: ver el cierre de T7 (386 archivos, 6428 en verde).
Sin push (lo pide el leader). T9/T10 pendientes.

## T9 — E2E (frontend_dev, 2026-10-14)

### Archivos
- `e2e/recorrido-acondicionamiento.spec.ts` (NUEVO). Sin cambios en código de producción.

### Mapa R → test
| R | Test |
|---|---|
| R36 | `e2e/recorrido-acondicionamiento.spec.ts` › «R36 - el supervisor comienza con un equipo de dos (uno por grupo), guarda y corrige…» (pasos internos R26, R30 R31, R12 R13, R5 R15, R17, R25) |

Fixture: pedido «Por acondicionar» con reparto de 2 líneas, lotes y asientos `production`, y
anotaciones de producción y empaque sembradas (10 min cada fase) firmadas por un tercero; equipo =
1 persona suelta + 1 por grupo, ninguno firma; pedido señuelo firmado solo por el Administrador.
El miembro por grupo no es opción del filtro (R31) y se filtra por URL `?persona=<id>` (R30).

### Verificación (salida real)
- `pnpm run typecheck` → `tsc --noEmit`, 0 errores.
- `pnpm run lint` → `✖ 7 problems (0 errors, 7 warnings)`, los mismos 7 previos; el spec nuevo, limpio.
- `pnpm exec playwright test e2e/recorrido-acondicionamiento.spec.ts --project=chromium` → **1 failed
  en el `beforeAll`**: `Invalid prisma.orderExecutionEntry.create() … The column 'existe' does not
  exist in the current database` (es `batch_lines`). La base local compartida (`QuimiCloude`) no
  tiene las migraciones de esta feature: `prisma migrate status` → «have not yet been applied:
  20261015120000_order_execution_conditioning_actions, 20261015120100_order_execution_batch_lines»,
  y además trae migraciones de otras ramas que este worktree no tiene. No se migró (fuera de
  alcance de frontend_dev). Limpieza comprobada: 0 empresas `qc283_e2e_` restantes.
- Grafo de código (MCP) no usado: exploración con Grep/Read.

Veredicto: spec escrito y tipado; no se pudo poner en verde en local porque la base no tiene las migraciones de QC-283 — pendiente de correr en CI o en una base migrada.

## T10 — Cierre de trazabilidad (implementer, 2026-10-14)

Mapa consolidado `R<n> -> test`, partiendo de `design.md > Plan de tests`. Cada caso se comprobo por
su titulo en el archivo (grep) y los archivos se corrieron (salida abajo).

| R | Test (archivo › caso) |
|---|---|
| R1 | `tests/unit/asignaciones/start-conditioning.test.ts` › «R1: anota conditioning_start en la transaccion, tras la transicion y el equipo»; `tests/integration/asignaciones/conditioning-execution-log.int.test.ts` › «R1: si append falla no quedan ni transicion ni equipo» |
| R2 | `start-conditioning.test.ts` › «R2: already_mine (repetir Comenzar) no anota» |
| R3 | `tests/unit/asignaciones/save-conditioning-batch-data.test.ts` › «R3: compone la foto en el orden enviado, con nombre o null, …»; `conditioning-execution-log.int.test.ts` › «R3: guardado y anotacion en la misma transaccion: …» |
| R4 | `save-conditioning-batch-data.test.ts` › «R4: un rechazo de las reglas (fechas, lote repetido) no abre la transaccion ni anota»; `conditioning-execution-log.int.test.ts` › «R4: un lote duplicado o ajeno al pedido no guarda ni anota», «R4: un append que falla no guarda datos» |
| R5 | `conditioning-execution-log.int.test.ts` › «R5: corregir anade otra foto y la primera no cambia» |
| R6 | `tests/unit/asignaciones/finish-conditioning.test.ts` › «R6: anota conditioning_finish en la transaccion, despues de la transicion»; `conditioning-execution-log.int.test.ts` › «R6: si append falla el pedido no cambia» |
| R7 | `tests/integration/asignaciones/order-execution-entries-constraints.int.test.ts` › «R7: acepta las tres acciones nuevas sin posicion ni motivo, y la foto solo en el guardado» (+ rechazos); `tests/unit/asignaciones/schema/order-execution-conditioning-migration.test.ts` › «R7: los tres CHECK, con su texto literal, y ninguno mas» |
| R8 | `tests/unit/asignaciones/execution-log-prisma.test.ts` › «R8: la lectura del equipo para el filtro no actualiza ni borra: solo findMany sobre el equipo» |
| R9 | `order-execution-conditioning-migration.test.ts` › «R9: ninguna migracion inserta ni actualiza filas» |
| R10 | `tests/integration/asignaciones/execution-log-read.int.test.ts` › «R10: el filtro por equipo no cruza empresas»; `tests/integration/asignaciones/conditioning-team-repository.int.test.ts` › «R10: listByOrdersInCompany filtra por empresa y ordena por pedido y position» |
| R11 | `tests/unit/asignaciones/get-execution-trace.test.ts` y `list-execution-traces.test.ts` › «R11: sin dashboard.consultar no lee registro ni equipo» |
| R12 | `tests/ui/dashboard/execution-trace-detail.test.tsx` › describe «R12 - R18 - las tres anotaciones de acondicionamiento en la linea de tiempo» › «R12 - nombre, tono e icono de las tres anotaciones, …» |
| R13 | `execution-trace-detail.test.tsx` › «R13 - supervisor y equipo en orden, con grupo»; `get-execution-trace.test.ts` › «R13: equipo con nombres actuales y grupo foto» |
| R14 | `execution-trace-detail.test.tsx` › «R14 - sin equipo» |
| R15 | `execution-trace-detail.test.tsx` › «R15 - quien guardo, n presentaciones, lineas con fechas dd/mm/aaaa y aviso»; `tests/unit/dashboard/execution-trace-format.test.ts` › formatSnapshotDate (ver T3) |
| R16 | `execution-trace-detail.test.tsx` › «R16 - presentacion sin nombre» |
| R17 | `execution-trace-detail.test.tsx` › «R17 - Terminar solo con quien» |
| R18 | `execution-trace-detail.test.tsx` › «R18 - tarjetas de linea con los mismos datos» |
| R19 | `tests/unit/asignaciones/execution-trace.test.ts` › «R19: tres fases cerradas» |
| R20 | `execution-trace.test.ts` › «R20: fase abierta hasta now en su estado» |
| R21 | `execution-trace.test.ts` › «R21: sin cierre fuera de su estado o dado de baja» |
| R22 | `execution-trace.test.ts` › «R22: fase sin apertura es null; guardados sin Comenzar» |
| R23 | `execution-trace.test.ts` › «R23: descuenta pausas antes de cada resume; resume doble; BLOQUEADO no» |
| R24 | `execution-trace.test.ts` › «R24: cancel cierra solo la fase en curso» |
| R25 | `execution-trace-detail.test.tsx` › «R25 - tarjetas por fase con insignias; fase null no se pinta» |
| R26 | `execution-trace.test.ts` › «R26: total = suma, null = 0, precedencia del kind»; `execution-trace-format.test.ts` › «R26 - formatTraceTotal trunca a minutos y lleva los tres sufijos»; `tests/ui/dashboard/execution-trace-table.test.tsx` › «R26 - celda de duracion con total y sufijo» |
| R27 | `list-execution-traces.test.ts` › «R27: la fila trae totalDuration y no el desglose» |
| R28 | `execution-trace-table.test.tsx` y `execution-trace-detail.test.tsx` › «R28 - En curso segun active; nunca en dado de baja» |
| R29 | `list-execution-traces.test.ts` › «R29: firmantes y despues equipo, sin repetir» |
| R30 | `execution-log-read.int.test.ts` › «R30: encuentra el pedido por el miembro del equipo que no firma ninguna anotacion», «R30: con rango, cuenta el instante del Comenzar» |
| R31 | `list-execution-traces.test.ts` › «R31: opciones solo de firmantes» |
| R32 | `list-execution-traces.test.ts` › «R32: equipo sin Comenzar no sale»; `execution-log-read.int.test.ts` › «R32: un equipo sin Comenzar anotado no filtra» |
| R33 | `execution-log-prisma.test.ts` › «R33: append valida la foto con zod y no escribe una corrupta ni una vacia», «R33: listEntriesForOrders selecciona batchLines y devuelve la foto validada» |
| R34 | `order-execution-conditioning-migration.test.ts` › «R34: las dos migraciones tienen su down.sql», «R34: el down de las acciones abre con una guarda RAISE EXCEPTION …» |
| R35 | `tests/guards/guard-dependencias-aprobadas.test.ts` (sin cambios). `package.json` y `pnpm-lock.yaml` sin diff frente a `dev` (merge-base `2ebf7634`) |
| R36 | `e2e/recorrido-acondicionamiento.spec.ts` › «R36 - el supervisor comienza con un equipo de dos (uno por grupo), guarda y corrige…» (verde en chromium y webkit, ver abajo) |

### Verificacion (salida real)
- `pnpm exec vitest run <11 archivos unit/ui del mapa>` → `Test Files 11 passed (11)`, `Tests 426 passed (426)`.
- `pnpm exec vitest run --project integration <conditioning-execution-log, order-execution-entries-constraints, execution-log-read, conditioning-team-repository>` → `Test Files 4 passed (4)`, `Tests 54 passed (54)`; base efimera borrada.
- `pnpm exec vitest run tests/guards/guard-dependencias-aprobadas.test.ts` → `Test Files 1 passed (1)`, `Tests 2 passed (2)`.
- Typecheck y lint: `tsc --noEmit` sin errores; `✖ 7 problems (0 errors, 7 warnings)`, los previos; `eslint e2e/recorrido-acondicionamiento.spec.ts` limpio.
- `./init.sh` **no se corrio** por instruccion del leader: el gate completo lo corre CI.

### E2E de R36 en base desechable (2026-10-14)
- Primer intento (T9) contra la base compartida `QuimiCloude`: falla en `beforeAll`, la base no tiene
  las migraciones de QC-283. No se toco esa base.
- Base desechable como en CI (`gate.yml` › «Base del E2E»): `pnpm run db:test template` →
  `plantilla reutilizada: qct_tpl_f928446831e4 (93 migraciones)`; `CREATE DATABASE qc283_e2e_desechable
  TEMPLATE qct_tpl_f928446831e4`; `DATABASE_URL`/`DIRECT_URL` solo en el entorno del comando (sin
  editar `.env`); puerto del E2E 3117 (playwright.config), libre.
- 1.ª corrida: falla una asercion del test (no de produccion): `execution-trace-step-person` incluye
  las iniciales del avatar (`"QSQc28… Supervisa"`). frontend_dev la ajusta: el avatar debe mostrar
  `getInitials(nombre)` y el span entero `${iniciales}${nombre}`.
- Tras el ajuste: chromium `✓ 1 [chromium] › e2e\recorrido-acondicionamiento.spec.ts:768:7 › … 1 passed (47.9s)`
  y webkit `✓ 1 [webkit] › … 1 passed (48.3s)` (frontend_dev); repetido por el implementer en chromium:
  `1 passed (40.8s)`.
- Limpieza: `DROP DATABASE qc283_e2e_desechable` → 0 restantes; `test-results` borrado.
- Interpretacion del fixture: «equipo de dos, una por grupo» = 1 persona suelta + 1 por grupo de
  trabajo. Si se queria dos grupos de una persona, es un cambio menor en el fixture.

Veredicto: R1–R36 con test existente y en verde. T9 y T10 cerradas.

## Correcciones del review (2026-10-14)

Informe: `progress/review_QC-283.md`. Delegado en `backend_dev`.

- **B1:** alta de `recorrido-acondicionamiento.spec.ts` al final de `E2E_ESPERADOS` en
  `tests/guards/guard-identificador-de-request.test.ts`, con su motivo (lo que ejercita; no lee
  ni afirma nada sobre el identificador de peticion ni `reference`, comprobado con grep).
- **Menor 7:** sin `as` en `lib/modules/asignaciones/domain/save-conditioning-batch-data.ts`.
  Tipo `BatchLabelsRejection = Exclude<FinishedBatchLabelsOutcome, { kind: 'written' }>` y
  subclase `BatchLabelsAbortedError extends ExecutionAbortedError` con `outcome` tipado; el
  `catch` estrecha con `instanceof`. Sin cambio de comportamiento.
- **M1:** quitadas las citas a `QC-<n>`, `R<n>` y notas historicas de los comentarios anadidos por
  la rama en `tests/` y `e2e/`; se conserva solo el porque no evidente. Sin tocar comentarios
  preexistentes. Quedan fuera (no son comentarios): tres nombres de `describe` con «QC-283 — …»
  y el `motivo` de `tests/integration/aislamiento.json`.

Verificacion (salida real):
- `pnpm exec vitest run guard`: Test Files 76 passed (76); Tests 1066 passed, 20 skipped.
- `pnpm run typecheck`: sin errores.
- `pnpm run lint`: 0 errors, 7 warnings (archivos no tocados).
- `vitest related --run` (dominio + tests ui/unit tocados): Test Files 384 passed; Tests 6536 passed, 2 skipped.
- `--project integration` (3 `.int` tocados + `conditioning-execution-log`): Test Files 4 passed; Tests 33 passed.

## Corrección: gate-completo rojo en PR #243 (2026-10-14)

- Causa: `tests/unit/shared/data-table-alcance.test.ts` (lista CERRADA de E2E que referencian `data-table`, R36 de QC-55) recibía 47 specs; el nuevo `e2e/recorrido-acondicionamiento.spec.ts` no estaba dado de alta.
- Decisión (a): la referencia es legítima. El E2E localiza la fila del pedido y la del señuelo en la lista del recorrido de ejecución del dashboard por `data-table-row-<id>`, igual que `recorrido-ejecucion.spec.ts` (QC-167). No estrena tabla.
- Cambio: nota fechada 2026-10-14, entrada ordenada antes de `recorrido-ejecucion`, recuento «cuarenta y seis» -> «cuarenta y siete» en título y mensaje.
- Otras listas cerradas: `tests/guards/guard-identificador-de-request.test.ts` ya incluía el spec (commit 5e45b37e). No hay más.
- Verificación: `vitest run tests/unit/shared/data-table-alcance.test.ts` 18 passed | 2 skipped; `vitest run guard` 76 files, 1066 passed | 20 skipped; typecheck limpio; lint 0 errores, 7 warnings.
