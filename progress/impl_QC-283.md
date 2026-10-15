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
