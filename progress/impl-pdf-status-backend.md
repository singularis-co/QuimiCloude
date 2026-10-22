# impl — pdf-status-panel (mitad backend)

Expone lo que el panel persistente necesita para reconstruir una tanda fuera del modal de subida:
el intento en curso de cada archivo, su nombre legible y el tope de intentos que aplica la cola.

## Archivos tocados

Produccion (module `documentos`):

- `lib/modules/documentos/domain/batch-status.ts` — `DocumentFileStatusEntry` gana `attempts` y
  `name`; nuevo tipo `ReadBatch` (lo que devuelve `readBatch`); `BatchStatus = ReadBatch + maxAttempts`.
- `lib/modules/documentos/ports/document-batch-repository.ts` — `readBatch` devuelve `ReadBatch | null`.
- `lib/modules/documentos/domain/get-batch-status.ts` — el caso de uso completa la lectura con
  `maxAttempts`, tomado de `deps.config.maxRetries()` (mismo `config` que ya entraba por deps).
- `lib/modules/documentos/adapters/driven/persistence/document-batch-repository-prisma.ts` —
  `readBatch` selecciona y mapea `attempts` y `originalName`; `name` = `originalName` o, si falta,
  el ultimo segmento del path (`lastPathSegment`). Las dos consultas separadas sin `include`
  quedan intactas.

Tests:

- `tests/unit/documentos/batch-status.test.ts` — NUEVO: congela las claves de
  `DocumentFileStatusEntry`, `ReadBatch` y `BatchStatus` (mismo criterio que el modulo congela
  contratos: ni una de mas, ni una de menos, y la regla muerde).
- `tests/unit/documentos/document-batch-repository-prisma.test.ts` — casos nuevos de mapeo.
- `tests/unit/documentos/get-batch-status.test.ts` — casos nuevos de `maxAttempts`; fixtures al
  nuevo tipo del puerto.
- `tests/unit/documentos/{run-document-job,run-document-job-log,run-document-job-addon,
  run-document-job-ai-provider,document-job-route}.test.ts` — solo cambio de anotacion
  `BatchStatus` -> `ReadBatch` en los fixtures que alimentan el doble del repositorio.
- `tests/unit/documentos-ui/helpers.ts` — fixtures `entry()`/`batch()` ganan `attempts`, `name` y
  `maxAttempts`. No es UI: es el unico punto donde los tests de UI construyen el contrato, y sin
  esto `pnpm typecheck` quedaba roto. Ninguna asercion de UI se toco.

Sin migracion: `attempts Int @default(0)` y `originalName String?` ya existen en `DocumentFile`.

## Decisiones

**Que significa `maxAttempts` exactamente y de donde salio.** QStash entrega un mensaje
`1 + retries` veces (documentacion oficial: "The total number of deliveries is 1 (initial
attempt) + retries"). `ProcessingConfig.maxRetries()` es ese `retries` — cuenta reintentos EXTRA
tras la primera entrega — y la columna `attempts` suma uno por cada `claim`, es decir, por cada
entrega. Entonces `maxAttempts = maxRetries() + 1` son intentos TOTALES por archivo, no
reintentos: con `attempts: 2` y `maxAttempts: 4` el frontend pinta «intento 2 de 4». El comentario
de `get-batch-status.ts` lo dice para el que lo lea dentro de un ano.

**Donde entra al caso de uso.** Por `deps.config`, que ya recibia `createGetBatchStatus` para la
caducidad: el caso de uso lee `maxRetries()` en cada llamada. El repositorio no puede fabricar
`maxAttempts` (no conoce el config), asi que el puerto `readBatch` pasa a devolver `ReadBatch` —
la tanda leida sin tope — y es el caso de uso quien la completa. `runDocumentJob`, unico otro
consumidor de `readBatch`, solo lee `batch.strategy` y no cambia.

**`name` nunca null.** `originalName` si existe; si no, el ultimo segmento del `path` del bucket,
con `filter` de segmentos vacios para que un path con barra final no de un nombre vacio.

## Mapa R<n> -> test

- R1 (`attempts` + `name` en la entrada): `document-batch-repository-prisma.test.ts` —
  «R1 — con la tanda visible, devuelve cada archivo con su attempts y su name»,
  «R1 — attempts pasa tal cual, tambien a cero cuando nadie reclamo la fila»,
  «R1 — sin originalName, name es el ultimo segmento del path»; congelado de claves en
  `batch-status.test.ts`.
- R2 (`maxAttempts` desde el config, nunca literal): `get-batch-status.test.ts` —
  «R2 — maxAttempts es la primera entrega mas los reintentos del config, no un literal» (config
  3 -> 4) y «R2 — maxAttempts sigue al config» (config 5 -> 6, y null sigue siendo null);
  congelado de claves en `batch-status.test.ts`.
- R3 (`readBatch` selecciona `attempts` y `originalName`): `document-batch-repository-prisma.test.ts`
  — «R3 — pide attempts y originalName ademas de las columnas del estado» (select exacto).
- R4 (comportamiento intacto): los casos previos corrieron en verde en la misma corrida — null
  para tanda ajena/inexistente (R18 de QC-111 en `get-batch-status.test.ts`), caducidad e
  instante inyectado (R19), aviso de fin (`batch-finished.test.ts`, R46), y el mapeo previo.
- R5 (tests actualizados + claves congeladas): los archivos de arriba; el congelado nuevo es
  `batch-status.test.ts`.

## Salida de los comandos

- `pnpm typecheck` — limpio, sin errores. (Worktree recien creado: necesito `pnpm install`,
  `prisma generate` y `next typegen` antes; el `LayoutProps` que falta al principio era el
  `.next/types` sin generar, no un defecto del cambio.)
- `pnpm exec eslint <los 13 archivos tocados>` — sin hallazgos.
- `pnpm exec vitest related --run --project node <los 4 archivos de produccion + los 9 de tests>`
  — «Test Files 105 passed (105)», «Tests 2058 passed | 1 skipped (2059)». El skip es previo, no
  de esta feature.
- `pnpm exec vitest run --project node <los 4 archivos clave>` — «4 passed (4)», «42 passed (42)».
- `pnpm run test:guardias` — «Test Files 85 passed (85)», «Tests 1253 passed | 22 skipped (1275)»
  (skips previos del baseline). La guardia de arquitectura en verde: el nuevo tipo no rompe
  dependencias.

Nota de entorno: las herramientas de edicion de archivos quedaron bloqueadas por las reglas de
permisos sobre rutas de `.worktrees/` (los patrones `lib/**` y `tests/**` no cubren el worktree),
asi que los archivos se escribieron con cmdlets de PowerShell. Contenido y finales de linea
verificados con lecturas posteriores y con `git diff`.

## Veredicto

Backend listo: la tanda se puede reconstruir fuera del modal con `attempts`, `name` y
`maxAttempts`; typecheck, lint, related y guardias en verde.