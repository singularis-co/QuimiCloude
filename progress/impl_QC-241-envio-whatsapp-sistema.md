# impl QC-241 — envio-whatsapp-sistema

## Tanda 1 (T1, T2, T3) — 2026-11-11, backend_dev

### Archivos

Creados:
- `db/migrations/20261111120000_whatsapp_system_send/migration.sql`, `down.sql`
- `lib/modules/integraciones/domain/whatsapp-send-retry-policy.ts`
- `lib/modules/integraciones/domain/whatsapp-send-job.ts`
- `lib/modules/integraciones/domain/whatsapp-notifier.ts`
- `lib/modules/integraciones/ports/whatsapp-send-queue.ts`
- `lib/modules/integraciones/ports/whatsapp-queue-signature.ts`
- `lib/modules/integraciones/ports/whatsapp-send-queue-repository.ts` (8 métodos, `scope` al final)
- `lib/modules/integraciones/ports/whatsapp-send-config.ts`
- `lib/modules/integraciones/ports/whatsapp-queue-log.ts`
- `tests/unit/integraciones/whatsapp/queue/whatsapp-send-retry-policy.test.ts`
- `tests/integration/integraciones/whatsapp-system-send-migration.int.test.ts`

Modificados:
- `db/schema.prisma`: `templateComponents Json? @map("template_components")` (1 línea).
- `lib/modules/integraciones/domain/whatsapp-outbound-message.ts`: `NewQueuedMessage`, `ClaimedMessage`.
- `lib/modules/integraciones/domain/whatsapp-send-failure.ts`: `sendDiagnosticOf` extraída; `RATE_LIMITED_CODES` exportada.
- `lib/modules/integraciones/domain/send-whatsapp-message.ts`: usa `sendDiagnosticOf` (misma salida).
- `tests/integration/aislamiento.json`: + la migración (`transaccion`).
- `tests/guards/guard-ambito-empresa-integraciones.test.ts`: `PUERTO_COLA` + describe del lado del puerto.
- `tests/guards/guard-identificador-de-request.test.ts`: + la migración en `MIGRACIONES_ESPERADAS`.
- `tests/unit/integraciones/module-shape.test.ts`: + los 8 archivos nuevos en la lista cerrada.
- `tests/integration/integraciones/whatsapp-agent-schema.int.test.ts`: DOWN/UP de las migraciones
  posteriores que filtran por `"origin"` (ver «Hallazgo»).

### Hallazgo: el índice parcial depende del enum de origen

El predicado `origin = 'SYSTEM'::whatsapp_message_origin` hace que el DOWN/UP aislado de
`20261030120000_whatsapp_agent` (renombra y recrea el tipo) falle con `42883 operator does not
exist`. En producción no pasa (las migraciones solo avanzan, y un rollback quita antes la posterior).
Se adaptó el test de esa migración con el patrón de dependientes posteriores de
`whatsapp-messages-migration.int.test.ts`. El SQL de la migración queda como en design §2.2.

### Pendiente para T5

`PUERTO_COLA` está definido en la guardia de ámbito pero **no** está en `PUERTOS`: el barrido de
implementación lee `adapters/driven/persistence/whatsapp-send-queue-prisma.ts` y su fábrica
`createWhatsappSendQueueRepository(db)`, que aún no existen. T5 lo añade a `PUERTOS`.

### R → test (esta tanda)

| R | Test |
|---|---|
| R15 (esquema del trabajo) | `whatsapp-send-retry-policy.test.ts` > «trabajo de envio de la cola» |
| R19, R31, R32 (motivos) | `whatsapp-send-retry-policy.test.ts` > «R19, R31, R32: los motivos fijos» |
| R22 | `whatsapp-send-retry-policy.test.ts` > «R22: … es temporal» |
| R23 | `whatsapp-send-retry-policy.test.ts` > «R23: … es permanente», «R23: un permanente se traduce…» |
| R25 (`maxAttemptsOf`) | `whatsapp-send-retry-policy.test.ts` > «R25: el tope de intentos…» |
| R26 (diagnóstico) | `whatsapp-send-retry-policy.test.ts` > «R26: el diagnostico…»; `send-whatsapp-message.test.ts` sin cambios |
| R29, R32 (plazos) | `whatsapp-send-retry-policy.test.ts` > «R29, R32: los plazos…» |
| R36 (puerto) | `guard-ambito-empresa-integraciones.test.ts` > «R36 — el puerto WhatsappSendQueueRepository…» |
| R40 | `whatsapp-system-send-migration.int.test.ts` (7 casos) |

R12 es de `enqueue` (T6): el puerto `WhatsappNotifier` solo admite plantilla por tipo; su test va en T6.

### Verificación

- `pnpm exec prisma validate` (con `.env`): válido.
- `pnpm run typecheck`: verde (tras `next typegen`).
- `pnpm run lint`: 0 errores, 11 avisos preexistentes en archivos ajenos; los archivos tocados, limpios.
- `pnpm exec vitest run guard`: 87 archivos, 1343 pass, 22 skipped, 0 fail.
- Unit: `tests/unit/integraciones/whatsapp/queue`, `.../send`, `module-shape.test.ts`: 9 archivos, 298 pass.
- Integración (base efímera): system-send, messages, outbound, constraints, connection, agent-schema,
  template, variable-keys, contacts-last-read, customer-phone-numbers, permisos read/send: todos verdes.
- `vitest related` sobre `send-whatsapp-message.ts` arrastra casi toda la suite (vía el contrato y la
  composición): se cortó y se corrieron los tests directos de arriba.

Veredicto: T1–T3 listas; T5 debe meter `PUERTO_COLA` en `PUERTOS`.

## D6 — semántica de retries en el SDK

Verificado el 2026-11-11 contra el SDK instalado: `node_modules/@upstash/qstash`, versión `2.11.3`
(`package.json`).

- `client-CsnfJpnA.d.ts:2295-2303` — `PublishRequest.retries?: number` (tipo declarado en la línea 2231), documentado como «In case your
  destination server is unavailable or returns a status code outside of the 200-299 range, we will
  retry the request after a certain amount of time. Configure how many times you would like the
  delivery to be retried up to the maxRetries limit defined in your plan. @default 3».
  Es decir: `retries` cuenta **reintentos tras la primera entrega**, no entregas totales. Total de
  entregas = 1 + `retries`, que es exactamente `maxAttemptsOf(maxRetries)` del dominio. El defecto
  del SDK (3) coincide con el de `WHATSAPP_SEND_MAX_RETRIES` (D6).
- `client-CsnfJpnA.d.ts:2567-2570` — `publishJSON` es un envoltorio de `publish` que serializa el
  cuerpo; acepta el mismo `PublishRequest` (con `retries`).
- `index.js:375-376` — el SDK lo manda como cabecera `Upstash-Retries` con `request.retries.toFixed(0)`
  solo si `retries !== undefined`: `0` se envía (sin reintentos), no se omite.
- Límite externo: el propio comentario dice «up to the maxRetries limit defined in your plan». Si el
  plan de QStash tiene un tope menor que `WHATSAPP_SEND_MAX_RETRIES`, QStash entrega menos veces que
  `maxAttemptsOf`; el tope del reclamo sigue siendo correcto (nunca se supera), solo que algún mensaje
  puede quedar `QUEUED` sin agotar intentos y lo recoge el barrido (republicación, R29). No verificado
  el tope del plan contratado: es dato de la cuenta, no del SDK.
- No confundir con `client-CsnfJpnA.d.ts:512-518` (`RetryConfig.retries`, `@default 5`): son los
  reintentos HTTP del propio cliente al publicar contra la API de QStash, no las entregas al consumidor.
  El adaptador no lo configura.
- `Receiver.verify` (`client-CsnfJpnA.d.ts:70-79`): «If that fails, the signature is invalid and a
  `SignatureError` is thrown» — por eso el adaptador de firma captura y devuelve `false`.

## Tanda 3 (T6, T7, T8) — 2026-11-11, backend_dev

### Archivos

Creados:
- `lib/modules/integraciones/domain/enqueue-whatsapp-message.ts` (`createWhatsappNotifier`)
- `lib/modules/integraciones/domain/process-whatsapp-send.ts` (`createProcessWhatsappSend`)
- `lib/modules/integraciones/domain/sweep-whatsapp-sends.ts` (`createSweepWhatsappSends`, `SWEEP_BATCH = 100`)
- `lib/modules/integraciones/adapters/driving/whatsapp-send-route.ts` (POST)
- `lib/modules/integraciones/adapters/driving/whatsapp-send-sweep-cron-route.ts` (GET)
- `app/api/integraciones/whatsapp/envios/route.ts` (`runtime = 'nodejs'`, `maxDuration = 60`)
- `app/api/cron/barrer-envios-whatsapp/route.ts` (`runtime = 'nodejs'`, `maxDuration = 300`)
- Tests en `tests/unit/integraciones/whatsapp/queue/`: `enqueue-whatsapp-message.test.ts`,
  `process-whatsapp-send.test.ts`, `sweep-whatsapp-sends.test.ts`, `whatsapp-send-route.test.ts`,
  `whatsapp-send-sweep-cron-route.test.ts`, `whatsapp-send-schedule.test.ts`

Modificados:
- `domain/whatsapp-send-recipient.ts`: `RecipientContext.actorId: string | null`.
- `vercel.json`: + `{ "path": "/api/cron/barrer-envios-whatsapp", "schedule": "0 * * * *" }`; los tres crons intactos.
- `tests/guards/guard-rutas-fuera-de-sesion.test.ts`: + las dos rutas como `anadido: 'integraciones'` y su caso R41.
- `tests/unit/integraciones/whatsapp/send/send-whatsapp-message.test.ts`: + 2 casos (usuario sigue con su id; `actorId null` ⇒ `linkedBy null`).
- **Adelanto mínimo de T9** (sin él no compilan los adaptadores driving, que piden todo a `@/lib/composition`):
  - `lib/modules/integraciones/index.ts`: + `whatsappSendJobSchema`, `createProcessWhatsappSend`, `createSweepWhatsappSends`.
  - `lib/composition/index.ts`: imports al final de la lista de `integraciones`; consts `whatsappSendQueueRepository`,
    `whatsappSendQueue`, `whatsappQueueSignature`, `whatsappSendConfig` (diferido), `whatsappQueueLog` tras
    `whatsappMediaDeps`; miembros `whatsappQueueSignature`, `processWhatsappSend`, `sweepWhatsappSends` al final de
    `integraciones`. Sin reordenar nada.
  - `tests/unit/integraciones/module-shape.test.ts`: listas cerradas ampliadas (5 archivos del módulo, 3 nombres del
    contrato, 3 miembros del cableado + 5 `typeOf`, 2 rutas importadoras).
  - Queda para T9: `whatsappNotifier` en la composición, `createWhatsappNotifier` y tipos en el contrato, el doble de
    `publish` con `INTEGRATIONS_E2E_DOUBLES`, `whatsapp-doubles.ts` y el flujo de integración.

### Decisiones

- **Orden en `enqueue`: plantilla antes que destinatario.** design §4.2 numera destinatario (3) y plantilla (4), pero
  `recipientByCustomer` puede crear o vincular el contacto; con ese orden una plantilla inexistente dejaría una
  escritura, contra R6 («NO DEBE escribir… nada») y el «Hecho» de T6. Las lecturas de plantilla van primero; el
  resultado de cada caso no cambia.
- `ProcessWhatsappSendDeps.connections` es el `WhatsappConnectionRepository` completo (lo exige `decryptStoredSecret`);
  sin `now`, que el consumidor no usa.
- `listCompanyIds` o `maxRetries()` que lanzan en el barrido se propagan (500 de la plataforma): `SweepResult` no tiene
  forma de expresar un fallo sin empresa y design no lo pide.
- Firma con claves vacías ⇒ 401 sin log: design §3.3 y R14 no piden registrarlo; no se añade.

### R → test (esta tanda)

| R | Test |
|---|---|
| R1–R13 | `enqueue-whatsapp-message.test.ts` (R9 también `send-whatsapp-message.test.ts`, 2 casos `QC-241 R9`) |
| R14, R15 | `whatsapp-send-route.test.ts` |
| R16 | `process-whatsapp-send.test.ts`, `whatsapp-send-route.test.ts` |
| R17–R23, R26 | `process-whatsapp-send.test.ts`; R18/R21/R22/R23 (códigos HTTP) en `whatsapp-send-route.test.ts` |
| R24 | `whatsapp-send-route.test.ts`, `process-whatsapp-send.test.ts` |
| R27 | `whatsapp-send-sweep-cron-route.test.ts` |
| R28 | `sweep-whatsapp-sends.test.ts`, `whatsapp-send-sweep-cron-route.test.ts` |
| R29–R34 | `sweep-whatsapp-sends.test.ts` |
| R35 | `whatsapp-send-schedule.test.ts` |
| R36 | `process-whatsapp-send.test.ts` (trabajo de otra empresa), `sweep-whatsapp-sends.test.ts` |
| R41 | `guard-rutas-fuera-de-sesion.test.ts` |

### Verificación

- `pnpm run typecheck` → exit 0.
- `pnpm run lint` → exit 0, 0 errores, 11 warnings preexistentes en archivos que esta tanda no toca.
- `pnpm exec vitest run tests/unit/integraciones/whatsapp tests/unit/integraciones/module-shape.test.ts` →
  81 archivos, 1794 passed, 1 skipped, 0 failed.
- `pnpm exec vitest run guard` → 87 archivos, 1355 passed, 22 skipped, 0 failed.
- Tests que barren rutas o `vercel.json` fuera de integraciones (route-segment-config, qc111/qc78 alcance, purge-route,
  etc., 7 archivos) → 85 passed, 24 skipped.
- Integración: no corrida; esta tanda no toca adaptadores con base.

Veredicto: T6–T8 completas y verdes; T9 adelantada solo en lo que exige el typecheck de los adaptadores driving.

## Tanda 4 (T9, T10) — 2026-11-11, backend_dev

### Archivos

- `lib/composition/index.ts`: `whatsappSendQueue` pasa a elegir en cada llamada (con
  `INTEGRATIONS_E2E_DOUBLES` devuelve `e2e-<messageId>` sin red; sin ella, QStash); nuevo miembro
  `whatsappNotifier: createWhatsappNotifier({...})` con los mismos repositorios del envío de usuario,
  `whatsappSendQueueRepository`, `whatsappSendQueue` y `whatsappQueueLog`. Aditivo, sin reordenar.
- `lib/modules/integraciones/index.ts`: + `createWhatsappNotifier`, tipos `WhatsappNotifier`,
  `WhatsappTemplateRef`, `WhatsappEnqueueOutcome`, `WhatsappEnqueueSkipReason` y `WhatsappSendJob`.
- `tests/unit/integraciones/module-shape.test.ts`: contrato (+6 nombres, 5 de tipo) y cableado
  (+`whatsappNotifier`).
- `tests/unit/integraciones/whatsapp/whatsapp-doubles.ts`: + `makeSendQueue`, `makeQueueSignature`,
  `makeQueueLog`, `makeSendQueueRepository`, `QUEUED_MESSAGE_ID`.
- `tests/unit/integraciones/whatsapp/queue/enqueue-whatsapp-message.test.ts`: usa los dobles nuevos
  (sin cambiar ningún caso).
- `tests/integration/integraciones/whatsapp-system-send-flow.int.test.ts` (nuevo, 5 casos) y su
  entrada `commit` en `tests/integration/aislamiento.json`.
- `tests/guards/guard-qstash-aislado.test.ts` (nuevo, 4 casos).
- `docs/dependencias.md`: fila de `@upstash/qstash`, «Aislada en cuatro archivos».
- `lib/modules/documentos/adapters/driven/queue/processing-queue-qstash.ts` y
  `queue-signature-qstash.ts`: solo el comentario de cabecera.
- `package.json`: sin cambios.

### Decisiones

- El doble de `publish` va en línea en la composición (como la elección de Graph), no como archivo
  `*-canned.ts`: no añade archivos al módulo ni a `guard-dobles-e2e` (la consulta
  `integrationsE2EDoublesEnabled(` acompaña a la elección).
- `makeQueueSignature` queda disponible en los dobles; el test de la ruta sigue doblando la
  composición con `vi.mock`, como antes.
- La guardia se comprobó además en disco: un `lib/modules/pedidos/zz-ficticio-qstash.ts` con
  `import { Client } from '@upstash/qstash'` la pone en rojo (1 failed); el archivo se borró.

### R → test (esta tanda)

| R | Test |
|---|---|
| R1, R8, R10 | `whatsapp-system-send-flow.int.test.ts` > «R1, R8, R10: enqueue deja el mensaje QUEUED…» |
| R9 | `whatsapp-system-send-flow.int.test.ts` > «R9: dos enqueue a la vez…» y «R9: un contacto sin cliente…» |
| R21, R37 | `whatsapp-system-send-flow.int.test.ts` > «R21, R37: el consumidor envia lo encolado…» |
| R36 | `whatsapp-system-send-flow.int.test.ts` > «R36: un trabajo firmado con otra empresa…» |
| R38 | `guard-qstash-aislado.test.ts` (4 casos), `guard-arquitectura-modulos.test.ts` |
| R39 | `guard-dependencias-aprobadas.test.ts` (package.json sin cambios) |

### Verificación

- `pnpm run typecheck`: exit 0.
- `pnpm run lint`: 0 errores, 11 warnings preexistentes en archivos que esta tanda no toca.
- `pnpm exec vitest run tests/unit/integraciones/whatsapp tests/unit/integraciones/module-shape.test.ts tests/unit/documentos/processing-queue-qstash.test.ts tests/unit/documentos/queue-signature-qstash.test.ts tests/unit/documentos/qc111-alcance.test.ts tests/unit/composition/documentos-facade.test.ts`:
  85 archivos, 1841 passed, 3 skipped.
- `pnpm exec vitest run guard`: 88 archivos, 1359 passed, 22 skipped.
- Integración (`whatsapp-system-send-flow`, `whatsapp-send-queue-prisma`,
  `whatsapp-system-send-migration`): 3 archivos, 26 passed.

**Veredicto:** T9 y T10 completas; todo verde.

## Consolidado (implementer) — 2026-11-11

T1–T10 marcadas `[x]` en `tasks.md`. Commits de la rama (todos con push):

| Tanda | Tasks | Commit |
|---|---|---|
| 1 | T1–T3 | `02e8dc2e0` + `d7a0c12f3` (test de QT-303, ver justificación 1) |
| 2 | T4–T5 | `15923da28` |
| 3 | T6–T8 | `bab84afe7` |
| 4 | T9–T10 | `9306d887b` |

### Archivos tocados (`git diff --name-status origin/dev...HEAD`, sin `specs/` ni `progress/`)

Creados:
- `app/api/cron/barrer-envios-whatsapp/route.ts`, `app/api/integraciones/whatsapp/envios/route.ts`
- `db/migrations/20261111120000_whatsapp_system_send/migration.sql`, `down.sql`
- `lib/modules/integraciones/adapters/driven/config/whatsapp-send-config-env.ts`
- `lib/modules/integraciones/adapters/driven/persistence/whatsapp-send-queue-prisma.ts`
- `lib/modules/integraciones/adapters/driven/queue/whatsapp-queue-signature-qstash.ts`, `whatsapp-send-queue-qstash.ts`
- `lib/modules/integraciones/adapters/driving/whatsapp-send-route.ts`, `whatsapp-send-sweep-cron-route.ts`
- `lib/modules/integraciones/domain/`: `enqueue-whatsapp-message.ts`, `process-whatsapp-send.ts`,
  `sweep-whatsapp-sends.ts`, `whatsapp-notifier.ts`, `whatsapp-send-job.ts`, `whatsapp-send-retry-policy.ts`
- `lib/modules/integraciones/ports/`: `whatsapp-queue-log.ts`, `whatsapp-queue-signature.ts`,
  `whatsapp-send-config.ts`, `whatsapp-send-queue-repository.ts`, `whatsapp-send-queue.ts`
- `tests/guards/guard-qstash-aislado.test.ts`
- `tests/integration/integraciones/`: `whatsapp-send-queue-prisma.int.test.ts`,
  `whatsapp-system-send-flow.int.test.ts`, `whatsapp-system-send-migration.int.test.ts`
- `tests/unit/integraciones/whatsapp/queue/`: `enqueue-whatsapp-message`, `process-whatsapp-send`,
  `sweep-whatsapp-sends`, `whatsapp-queue-signature-qstash`, `whatsapp-send-config-env`,
  `whatsapp-send-queue-qstash`, `whatsapp-send-retry-policy`, `whatsapp-send-route`,
  `whatsapp-send-schedule`, `whatsapp-send-sweep-cron-route` (`.test.ts`)

Modificados (aditivos):
- `.env.example`, `db/schema.prisma`, `docs/architecture.md` (fila de `WHATSAPP_SEND_MAX_RETRIES`, ver
  decisión 3), `docs/dependencias.md`, `lib/composition/index.ts`, `lib/shared/routes.ts`, `vercel.json`
- `lib/modules/documentos/adapters/driven/queue/processing-queue-qstash.ts`, `queue-signature-qstash.ts`
  (solo cabecera)
- `lib/modules/integraciones/index.ts`; `domain/send-whatsapp-message.ts`,
  `whatsapp-outbound-message.ts`, `whatsapp-send-failure.ts`, `whatsapp-send-recipient.ts`
- `tests/guards/guard-ambito-empresa-integraciones.test.ts` (`PUERTO_COLA` en `PUERTOS`),
  `guard-identificador-de-request.test.ts`, `guard-rutas-fuera-de-sesion.test.ts`
- `tests/integration/aislamiento.json`, `tests/integration/integraciones/whatsapp-agent-schema.int.test.ts`
- `tests/unit/integraciones/module-shape.test.ts`, `whatsapp/send/send-whatsapp-message.test.ts`,
  `whatsapp/whatsapp-doubles.ts`

`package.json` sin cambios; ninguna dependencia nueva.

### Mapa R1–R41 → test

| R | Test |
|---|---|
| R1–R13 | `enqueue-whatsapp-message.test.ts`; R1, R8, R10 también en `whatsapp-system-send-flow.int.test.ts`; R9 (concurrente y vínculo) en `whatsapp-system-send-flow.int.test.ts` y `send-whatsapp-message.test.ts`; R8, R10 también en `whatsapp-send-queue-prisma.int.test.ts`; R10 también en `whatsapp-send-queue-qstash.test.ts` |
| R14 | `whatsapp-send-route.test.ts`, `whatsapp-queue-signature-qstash.test.ts`, `whatsapp-send-config-env.test.ts` |
| R15 | `whatsapp-send-route.test.ts`, `whatsapp-send-retry-policy.test.ts` (esquema del trabajo) |
| R16 | `process-whatsapp-send.test.ts`, `whatsapp-send-route.test.ts` |
| R17, R18 | `process-whatsapp-send.test.ts`, `whatsapp-send-route.test.ts`; concurrencia en `whatsapp-send-queue-prisma.int.test.ts` |
| R19, R20 | `process-whatsapp-send.test.ts`; motivos fijos de R19 en `whatsapp-send-retry-policy.test.ts` |
| R21 | `process-whatsapp-send.test.ts`, `whatsapp-send-route.test.ts`, `whatsapp-system-send-flow.int.test.ts` |
| R22, R23 | `process-whatsapp-send.test.ts`, `whatsapp-send-route.test.ts`, `whatsapp-send-retry-policy.test.ts`; `release` de R22 en `whatsapp-send-queue-prisma.int.test.ts` |
| R24 | `whatsapp-send-route.test.ts`, `process-whatsapp-send.test.ts` |
| R25 | `whatsapp-send-config-env.test.ts`, `whatsapp-send-queue-qstash.test.ts`, `whatsapp-send-retry-policy.test.ts` |
| R26 | `process-whatsapp-send.test.ts`, `whatsapp-send-retry-policy.test.ts` |
| R27 | `whatsapp-send-sweep-cron-route.test.ts` |
| R28 | `whatsapp-send-sweep-cron-route.test.ts`, `sweep-whatsapp-sends.test.ts` |
| R29–R34 | `sweep-whatsapp-sends.test.ts`; R29, R31–R34 también en `whatsapp-send-queue-prisma.int.test.ts` |
| R35 | `whatsapp-send-schedule.test.ts` (ruta y `0 * * * *`) |
| R36 | `whatsapp-send-queue-prisma.int.test.ts`, `whatsapp-system-send-flow.int.test.ts`, `guard-ambito-empresa-integraciones.test.ts`, `process-whatsapp-send.test.ts`, `sweep-whatsapp-sends.test.ts` |
| R37 | `whatsapp-system-send-flow.int.test.ts` |
| R38 | `guard-qstash-aislado.test.ts` (muerde con un importador ficticio en disco, borrado después), `guard-arquitectura-modulos.test.ts` |
| R39 | `guard-dependencias-aprobadas.test.ts` |
| R40 | `whatsapp-system-send-migration.int.test.ts` |
| R41 | `guard-rutas-fuera-de-sesion.test.ts` |
| R42 | `whatsapp-queue-signature-qstash.test.ts > R42: claves de firma que faltan con la firma presente` (8 casos; T11, vuelta 1 de review) |

### Verificación final (implementer, tras `9306d887b`)

| Comando | Resultado |
|---|---|
| `pnpm run typecheck` | exit 0 |
| `pnpm run lint` | exit 0 — `✖ 11 problems (0 errors, 11 warnings)`, todas en archivos ajenos a la feature |
| `pnpm exec vitest run tests/unit/integraciones/whatsapp tests/unit/integraciones/module-shape.test.ts` | `Test Files 81 passed (81)` · `Tests 1794 passed \| 1 skipped (1795)` |
| `pnpm exec vitest run guard` | `Test Files 88 passed (88)` · `Tests 1359 passed \| 22 skipped (1381)` |
| integración (`.env` del repo principal): flow, queue-prisma, system-send-migration, agent-schema | `Test Files 4 passed (4)` · `Tests 45 passed (45)`; base efímera copia de `qct_tpl_7f2e8b9de890`, borrada al terminar |

**`vitest related` no se usa en este worktree:** `pnpm exec vitest related --run <archivos>` sale con
código 127 sin más salida que la cabecera `RUN`. Sobre `send-whatsapp-message.ts`, además, arrastra
casi toda la suite por el contrato y la composición. Por eso todas las tandas corrieron sus archivos
de test directamente (tabla de arriba). No se corrió la suite completa: la corre `gate-completo` en CI.
No hay E2E: la feature no añade ni toca specs de Playwright.

### Justificaciones fuera de `tasks.md`

1. **`tests/integration/integraciones/whatsapp-agent-schema.int.test.ts` (QT-303), commit `d7a0c12f3`.**
   El índice parcial nuevo filtra por `origin = 'SYSTEM'::whatsapp_message_origin`. Ese test revierte
   y reaplica por su cuenta `20261030120000_whatsapp_agent`, que renombra y recrea el tipo, y con el
   índice en pie fallaba con `42883 operator does not exist` (5 casos). Se adaptó con el patrón que ya
   usa `whatsapp-messages-migration.int.test.ts`: revertir antes las migraciones posteriores que
   filtran por `"origin"` y reaplicarlas después. El SQL de la migración queda como en design §2.2.
   El leader lo aceptó el 2026-11-11.
2. **`tests/guards/guard-identificador-de-request.test.ts` (+2 líneas).** `MIGRACIONES_ESPERADAS` es
   una lista cerrada de migraciones; toda migración nueva entra en ella o la guardia se pone en rojo.
   Necesario por T1.

Otras listas cerradas tocadas por el mismo motivo (añadidos mínimos): `module-shape.test.ts`
(archivos, contrato, cableado e importadores) y `guard-ambito-empresa-integraciones.test.ts`
(`PUERTO_COLA`).

### Decisiones de los backend_dev que el reviewer o el humano deben mirar

1. **Orden de `enqueue` distinto de design §4.2:** la plantilla se resuelve antes que el destinatario.
   `recipientByCustomer` puede crear o vincular el contacto, y con el orden literal una plantilla
   inexistente, no enviable o con valores que faltan dejaba ese contacto escrito, en contra de R6 y del
   «Hecho» de T6. Los motivos de omisión no cambian.
2. **Claves de firma vacías ⇒ 401 sin log.** `verify` no lanza, así que el adaptador devuelve `false`.
   Ni design §3.3 ni R14 piden registrarlo y no se añadió. Un despliegue sin
   `QSTASH_*_SIGNING_KEY` rechaza todas las entregas sin rastro. Si se quiere un log, se decide en el spec.
3. **Fila nueva en `docs/architecture.md > Variables por entorno`** para `WHATSAPP_SEND_MAX_RETRIES`
   (`opcional | vacía (defecto 3) | vacía`), copiada de `DOCUMENT_PROCESSING_MAX_RETRIES`. La exige
   `guard-variables-por-entorno`. El spec no dice qué valor llevan Production y Preview: hay que confirmarlo.
4. **Barrido:** si `listCompanyIds` o `maxRetries()` lanzan, el error se propaga (500). `SweepResult`
   no expresa un fallo sin empresa y el design no lo fija.
5. **`ProcessWhatsappSendDeps.connections`** es el repositorio completo (lo pide `decryptStoredSecret`);
   se quitó `now`, que el consumidor no usa.
6. **Doble de `publish`** con `INTEGRATIONS_E2E_DOUBLES`: va dentro de la composición, igual que el de
   Graph, sin archivo `*-canned.ts`. Design §5.5 no fija dónde va. `makeQueueSignature` (design §10.2)
   está en los dobles, pero ningún test lo usa todavía.
7. **Límite de `retries` del plan de QStash** sin verificar (dato de la cuenta). Si es menor, el
   barrido republica lo que QStash deje de reintentar (sección D6).

## Vuelta 1 de review: T11 (R42) y T12 (D17), 2026-11-11

- Modificados: `lib/modules/integraciones/adapters/driven/queue/whatsapp-queue-signature-qstash.ts`
  (constante exportada `WHATSAPP_SYSTEM_SEND_FLOW`, `log.error('whatsapp_send_signing_keys_missing')`
  con firma presente y claves ausentes o vacías), `.../config/whatsapp-send-config-env.ts`
  (`missingWhatsappQueueSigningKeys()`, devuelve los nombres sin parsear el error),
  `tests/unit/integraciones/whatsapp/queue/whatsapp-queue-signature-qstash.test.ts` (8 casos R42),
  `docs/architecture.md` (fila propia de `APP_BASE_URL`; Local de `WHATSAPP_SEND_MAX_RETRIES`).
- R42 → `whatsapp-queue-signature-qstash.test.ts > R42: claves de firma que faltan con la firma presente`.
- typecheck verde; lint 0 errores (11 warnings preexistentes, ninguno en archivos tocados);
  `vitest run tests/unit/integraciones/whatsapp tests/unit/integraciones/module-shape.test.ts`: 81 archivos,
  1802 pass, 1 skipped, 0 fail; `vitest run guard`: 88 archivos, 1359 pass, 22 skipped, 0 fail.
- Veredicto: T11 y T12 listas para la vuelta 2.

## Rojos de gate-completo en el PR #320 (run 43244357301), 2026-11-12

Tres eran nuestros y uno no. Los nuestros eran listas cerradas que no declaraban lo que añade la
feature. Se arreglaron declarando esos miembros: las aserciones siguen siendo `toEqual` sobre la
lista completa.

| Archivo | Causa | Arreglo |
|---|---|---|
| `tests/unit/composition/integraciones-graph-doubles.test.ts` | Lista cerrada de `Object.keys(integraciones)`: faltaban `processWhatsappSend`, `sweepWhatsappSends`, `whatsappNotifier` y `whatsappQueueSignature` (T7–T9) | Se añaden los 4 en orden |
| `tests/unit/integraciones/encryption-keys-env.test.ts` | La misma lista cerrada (R10/R19) | Se añaden los 4 en orden |
| `tests/unit/recetas-ui/recipe-route-contract.test.ts` | Lista cerrada de exports de `lib/shared/routes.ts` (QC-64 R12): faltaba `WHATSAPP_SEND_ROUTE` (T4) | Se añade con su nota de alta, como QC-237 y QC-245 |
| `tests/integration/pedidos/order-conditioning.int.test.ts` | **No es nuestro.** Es intermitente: en CI falló «R10: dos Comenzar reales a la vez…», con `23514 order_lines_conditioned_by_matches_status` en `tests/helpers/only-order-line.ts:136`. La feature no toca `pedidos`, `tests/helpers` ni `order_lines`; respecto de `origin/dev` solo añade la migración de WhatsApp | Sin cambio (ver prueba) |

Prueba de `order-conditioning`:
- La rama contiene `origin/dev` entero (`behind=0`).
- 5/5 verdes en la rama: `Tests 10 passed (10)` cada vez.
- 3/3 verdes en un checkout de `origin/dev` (`89f8f03f1`), cada uno contra su propia base efímera (`qct_devcheck_…`).
- Es una prueba de carrera. Las mismas violaciones del CHECK salen en el log de Postgres de corridas
  verdes de otras ramas (QT-314, run 42698943281: 10 líneas), así que el fallo depende del
  entrelazado y no del código de la rama.

Verificación tras el arreglo:

| Comando | Resultado |
|---|---|
| Los 3 tests unit | `Test Files 3 passed (3)` · `Tests 62 passed (62)` |
| `pnpm run typecheck` | exit 0 |
| `pnpm run lint` | `✖ 11 problems (0 errors, 11 warnings)` |
| `pnpm exec vitest run guard` | `Test Files 88 passed (88)` · `Tests 1359 passed \| 22 skipped (1381)` |
