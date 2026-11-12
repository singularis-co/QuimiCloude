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
