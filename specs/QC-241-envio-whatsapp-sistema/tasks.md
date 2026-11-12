# QC-241 — envio-whatsapp-sistema · tasks.md

> Orden: T1 → (T2, T3, T4 en paralelo) → T5 → T6 → T7 → T8 → T9 → T10.
> `[P]` = puede ir en paralelo con las otras `[P]` del mismo bloque.
> Cada task cierra con `pnpm run typecheck`, `pnpm run lint` y
> `pnpm exec vitest related --run <archivos tocados>`; las que tocan guardias, además
> `pnpm exec vitest run guard`. Nadie corre `pnpm test` completo.
> P1–P10 de `requirements.md` quedaron cerradas el 2026-11-11 (D6–D15); el barrido es horario (D7).
> Enmienda tras la vuelta 1 de review (2026-11-11, D16–D18): T11 y T12, en paralelo, después de T10.

## [x] T1 — Esquema y migración · R40

- `db/schema.prisma`: `templateComponents Json? @map("template_components")` en `WhatsappMessage`.
- `db/migrations/20261111120000_whatsapp_system_send/migration.sql` y `down.sql` (design §2.2):
  columna + índice parcial; el down los quita en orden inverso.
- Test `tests/integration/integraciones/whatsapp-system-send-migration.int.test.ts` y su entrada en
  `tests/integration/aislamiento.json`.
- **Hecho:** `prisma validate` verde; down + up deja el mismo esquema; el índice existe.

## [x] T2 — Dominio puro [P] · R12, R22, R23, R25, R26

- `domain/whatsapp-send-retry-policy.ts` (plazos, `maxAttemptsOf`, `isTemporarySendFailure`, motivos
  de design §7).
- `domain/whatsapp-send-job.ts` (zod del trabajo).
- `domain/whatsapp-notifier.ts` (tipos del puerto y del resultado).
- `domain/whatsapp-outbound-message.ts`: `NewQueuedMessage`, `ClaimedMessage`.
- `domain/whatsapp-send-failure.ts`: extraer `sendDiagnosticOf(failure)` (lo usan QC-240 y el
  consumidor); `send-whatsapp-message.ts` pasa a usarla sin cambiar su salida.
- Test `tests/unit/integraciones/whatsapp/queue/whatsapp-send-retry-policy.test.ts`.
- **Hecho:** tabla temporal/permanente cubierta caso a caso; textos fijados en test; los tests de
  `send/` siguen verdes.

## [x] T3 — Puertos [P] · R36, R38

- `ports/whatsapp-send-queue.ts`, `ports/whatsapp-queue-signature.ts`,
  `ports/whatsapp-send-queue-repository.ts` (8 métodos, `scope` al final),
  `ports/whatsapp-send-config.ts`, `ports/whatsapp-queue-log.ts`.
- `tests/guards/guard-ambito-empresa-integraciones.test.ts`: el puerto nuevo entra en el barrido.
- **Hecho:** typecheck verde; ningún archivo de `ports/` importa `@upstash/qstash`, `next/*` ni
  `@prisma/client`; la guardia de ámbito ve el puerto nuevo.

## [x] T4 — Adaptadores de QStash y configuración [P] · R10, R14, R25, R38

- `adapters/driven/config/whatsapp-send-config-env.ts` (design §5.2).
- `adapters/driven/queue/whatsapp-send-queue-qstash.ts` y
  `adapters/driven/queue/whatsapp-queue-signature-qstash.ts` (design §5.1). **Verificar contra el
  SDK instalado** (`node_modules/@upstash/qstash`) la semántica de `retries` (D6) y anotarla en
  `progress/impl_QC-241-envio-whatsapp-sistema.md`.
- `lib/shared/routes.ts`: `WHATSAPP_SEND_ROUTE`.
- `.env.example`: bloque de `WHATSAPP_SEND_MAX_RETRIES` (opcional, defecto) y nota de que reutiliza
  las de QStash y `APP_BASE_URL`.
- Tests: `whatsapp-send-config-env.test.ts`, `whatsapp-send-queue-qstash.test.ts`,
  `whatsapp-queue-signature-qstash.test.ts` (con `vi.mock('@upstash/qstash')`, sin red).
- **Hecho:** importar los adaptadores con las variables vacías no lanza; la configuración se lee al
  llamar; faltantes nombrados sin valor.

## [x] T5 — Persistencia · R8, R17, R18, R29, R31–R33, R36 · depende de T1, T3

- `adapters/driven/persistence/whatsapp-send-queue-prisma.ts` (design §5.3): reclamo en una sola
  sentencia; `updated_at = now()` en el SQL crudo; todo con ámbito y `origin = 'SYSTEM'`.
- Test `tests/integration/integraciones/whatsapp-send-queue-prisma.int.test.ts` + `aislamiento.json`.
- **Hecho:** dos reclamos concurrentes ⇒ uno gana; tope de intentos respetado; `fail*` no toca
  `USER`/`AGENT`; otra empresa ⇒ cero filas.

## [x] T6 — `enqueue` · R1–R13 · depende de T2, T3

- `domain/whatsapp-send-recipient.ts`: `RecipientContext.actorId: string | null` (design §4.2,
  paso 4); `send-whatsapp-message.test.ts` comprueba que el envío de usuario no cambia.
- `domain/enqueue-whatsapp-message.ts` (`createWhatsappNotifier`, design §4.2).
- Test `tests/unit/integraciones/whatsapp/queue/enqueue-whatsapp-message.test.ts`.
- **Hecho:** cada omisión sin escrituras ni publicación y con su línea de log; ningún caso rechaza la
  promesa; el log no lleva valores, número ni texto.

## [x] T7 — Consumidor · R14–R24, R26 · depende de T2–T5

- `domain/process-whatsapp-send.ts` (design §4.3).
- `adapters/driving/whatsapp-send-route.ts` (design §3.3) y
  `app/api/integraciones/whatsapp/envios/route.ts` (`runtime`, `maxDuration`).
- Tests `process-whatsapp-send.test.ts` y `whatsapp-send-route.test.ts`.
- `tests/guards/guard-rutas-fuera-de-sesion.test.ts`: ruta del consumidor como añadido
  `integraciones` (R41).
- **Hecho:** firma inválida ⇒ 401 sin tocar nada; duplicado ⇒ 200 sin Meta; 5xx ⇒ `QUEUED` + 500;
  4xx ⇒ `FAILED` + 200.

## [x] T8 — Barrido · R27–R35 · depende de T2–T5

- `domain/sweep-whatsapp-sends.ts` (design §4.4).
- `adapters/driving/whatsapp-send-sweep-cron-route.ts` y
  `app/api/cron/barrer-envios-whatsapp/route.ts`.
- `vercel.json`: `{ "path": "/api/cron/barrer-envios-whatsapp", "schedule": "0 * * * *" }` (D7,
  cada hora), sin tocar los tres crons existentes.
- Tests `sweep-whatsapp-sends.test.ts`, `whatsapp-send-sweep-cron-route.test.ts`,
  `whatsapp-send-schedule.test.ts`.
- `tests/guards/guard-rutas-fuera-de-sesion.test.ts`: ruta del barrido como añadido `integraciones`.
- **Hecho:** 401/500 sin leer; atascados `FAILED` sin publicar; agotados `FAILED`; viejos
  republicados; una empresa que falla no detiene a las demás; `whatsapp-send-schedule.test.ts` fija
  la ruta y el `schedule` `0 * * * *`.

## [x] T9 — Composición, contrato y flujo · R1, R9, R21, R36, R37 · depende de T4–T8

- `lib/composition/index.ts` (design §5.5), incluido el doble de `publish` con
  `INTEGRATIONS_E2E_DOUBLES`.
- `lib/modules/integraciones/index.ts`: `createWhatsappNotifier`, `createProcessWhatsappSend`,
  `createSweepWhatsappSends`, `whatsappSendJobSchema` y tipos.
- `tests/unit/integraciones/module-shape.test.ts` y `tests/unit/integraciones/whatsapp/whatsapp-doubles.ts`.
- Test `tests/integration/integraciones/whatsapp-system-send-flow.int.test.ts` + `aislamiento.json`.
- **Hecho:** `enqueue` → consumidor → `SENT` con la composición real; status `delivered` aplicado;
  trabajo con otra empresa sin efecto.

## [x] T10 — Guardia de QStash y documentación · R38, R39 · depende de T4

- `tests/guards/guard-qstash-aislado.test.ts` (design §9).
- `docs/dependencias.md`: fila de `@upstash/qstash`, «aislada en cuatro archivos».
- Comentario de cabecera de `processing-queue-qstash.ts` y `queue-signature-qstash.ts` (sin cambiar
  código).
- **Hecho:** `pnpm exec vitest run guard` verde; la guardia muerde con un importador ficticio;
  `package.json` sin cambios.

## [x] T11 — Línea de log cuando faltan las claves de firma [P] · R42 · depende de T4, T7

- `adapters/driven/queue/whatsapp-queue-signature-qstash.ts` (design §5.1, «Claves que faltan»): con
  firma presente y alguna clave ausente o vacía, `log.error('whatsapp_send_signing_keys_missing',
  { flow: 'whatsapp_system_send', missing: <nombres> })` y `false`. El identificador del flujo, como
  constante exportada.
- `adapters/driven/config/whatsapp-send-config-env.ts`, solo si hace falta para conocer los nombres
  que faltan sin parsear el texto del error.
- Test `tests/unit/integraciones/whatsapp/queue/whatsapp-queue-signature-qstash.test.ts`: casos `R42`
  del design §10.1. Si cambia el lector, `whatsapp-send-config-env.test.ts` sigue verde.
- **Hecho:** con firma y sin claves, una línea `error` con el flujo y los nombres, y sin ningún valor
  de clave (el test pone un valor centinela en la clave presente y comprueba que no aparece); sin firma,
  o con firma inválida y claves puestas, ninguna línea; `whatsapp-send-route.test.ts` sigue verde
  (`401`).

## [x] T12 — Variables por entorno en la documentación [P] · D17 · depende de T10

- `docs/architecture.md > Variables por entorno` (design §13):
  - fila `WHATSAPP_SEND_MAX_RETRIES`: `opcional | vacia (valor por defecto, 3) | vacia (valor por
    defecto, 3)`;
  - `APP_BASE_URL` sale de la fila del correo y pasa a una fila propia: Production «de produccion»;
    Preview «necesaria si se prueba WhatsApp (la lee tambien la cola de envios de WhatsApp para la URL
    del consumidor); si no, ausente»; Local «segun dev». La fila del correo conserva el resto de sus
    variables y su texto.
- Sin requisito nuevo (D17).
- **Hecho:** `pnpm exec vitest run guard-variables-por-entorno` verde; ninguna fila dice que
  `APP_BASE_URL` solo la lee el correo.

## Mapa R → test

| R | Test |
|---|---|
| R1–R13 | `tests/unit/integraciones/whatsapp/queue/enqueue-whatsapp-message.test.ts` (R9 concurrente y R8 también en `whatsapp-system-send-flow.int.test.ts`) |
| R14, R15 | `whatsapp-send-route.test.ts`; R14 también `whatsapp-queue-signature-qstash.test.ts` |
| R16–R24, R26 | `process-whatsapp-send.test.ts`; R17/R18 concurrentes en `whatsapp-send-queue-prisma.int.test.ts`; R22/R23 también `whatsapp-send-retry-policy.test.ts` |
| R25 | `whatsapp-send-config-env.test.ts`, `whatsapp-send-queue-qstash.test.ts` |
| R27, R28 | `whatsapp-send-sweep-cron-route.test.ts`, `sweep-whatsapp-sends.test.ts` |
| R29–R34 | `sweep-whatsapp-sends.test.ts`; R31–R33 también `whatsapp-send-queue-prisma.int.test.ts` |
| R35 | `whatsapp-send-schedule.test.ts` (ruta y `schedule` `0 * * * *`) |
| R36 | `whatsapp-send-queue-prisma.int.test.ts`, `whatsapp-system-send-flow.int.test.ts`, `guard-ambito-empresa-integraciones.test.ts` |
| R37 | `whatsapp-system-send-flow.int.test.ts` |
| R38 | `guard-qstash-aislado.test.ts`, `guard-arquitectura-modulos.test.ts` |
| R39 | `guard-dependencias-aprobadas.test.ts` |
| R40 | `whatsapp-system-send-migration.int.test.ts` |
| R41 | `guard-rutas-fuera-de-sesion.test.ts` |
| R42 | `tests/unit/integraciones/whatsapp/queue/whatsapp-queue-signature-qstash.test.ts` (línea `error` con `flow: 'whatsapp_system_send'`, sin valores de clave); el `401` también `whatsapp-send-route.test.ts` |

## Archivos esperados

- `db/schema.prisma`
- `db/migrations/20261111120000_whatsapp_system_send/migration.sql`
- `db/migrations/20261111120000_whatsapp_system_send/down.sql`
- `lib/shared/routes.ts`
- `lib/modules/integraciones/index.ts`
- `lib/modules/integraciones/domain/whatsapp-notifier.ts`
- `lib/modules/integraciones/domain/whatsapp-send-job.ts`
- `lib/modules/integraciones/domain/whatsapp-send-retry-policy.ts`
- `lib/modules/integraciones/domain/whatsapp-outbound-message.ts`
- `lib/modules/integraciones/domain/whatsapp-send-failure.ts`
- `lib/modules/integraciones/domain/whatsapp-send-recipient.ts`
- `lib/modules/integraciones/domain/send-whatsapp-message.ts`
- `lib/modules/integraciones/domain/enqueue-whatsapp-message.ts`
- `lib/modules/integraciones/domain/process-whatsapp-send.ts`
- `lib/modules/integraciones/domain/sweep-whatsapp-sends.ts`
- `lib/modules/integraciones/ports/whatsapp-send-queue.ts`
- `lib/modules/integraciones/ports/whatsapp-queue-signature.ts`
- `lib/modules/integraciones/ports/whatsapp-send-queue-repository.ts`
- `lib/modules/integraciones/ports/whatsapp-send-config.ts`
- `lib/modules/integraciones/ports/whatsapp-queue-log.ts`
- `lib/modules/integraciones/adapters/driven/queue/whatsapp-send-queue-qstash.ts`
- `lib/modules/integraciones/adapters/driven/queue/whatsapp-queue-signature-qstash.ts`
- `lib/modules/integraciones/adapters/driven/config/whatsapp-send-config-env.ts`
- `lib/modules/integraciones/adapters/driven/persistence/whatsapp-send-queue-prisma.ts`
- `lib/modules/integraciones/adapters/driving/whatsapp-send-route.ts`
- `lib/modules/integraciones/adapters/driving/whatsapp-send-sweep-cron-route.ts`
- `lib/modules/documentos/adapters/driven/queue/processing-queue-qstash.ts`
- `lib/modules/documentos/adapters/driven/queue/queue-signature-qstash.ts`
- `lib/composition/index.ts`
- `app/api/integraciones/whatsapp/envios/route.ts`
- `app/api/cron/barrer-envios-whatsapp/route.ts`
- `vercel.json`
- `.env.example`
- `docs/dependencias.md`
- `docs/architecture.md`
- `tests/unit/integraciones/whatsapp/queue/enqueue-whatsapp-message.test.ts`
- `tests/unit/integraciones/whatsapp/queue/process-whatsapp-send.test.ts`
- `tests/unit/integraciones/whatsapp/queue/sweep-whatsapp-sends.test.ts`
- `tests/unit/integraciones/whatsapp/queue/whatsapp-send-retry-policy.test.ts`
- `tests/unit/integraciones/whatsapp/queue/whatsapp-send-route.test.ts`
- `tests/unit/integraciones/whatsapp/queue/whatsapp-send-sweep-cron-route.test.ts`
- `tests/unit/integraciones/whatsapp/queue/whatsapp-send-queue-qstash.test.ts`
- `tests/unit/integraciones/whatsapp/queue/whatsapp-queue-signature-qstash.test.ts`
- `tests/unit/integraciones/whatsapp/queue/whatsapp-send-config-env.test.ts`
- `tests/unit/integraciones/whatsapp/queue/whatsapp-send-schedule.test.ts`
- `tests/unit/integraciones/whatsapp/send/send-whatsapp-message.test.ts`
- `tests/unit/integraciones/whatsapp/whatsapp-doubles.ts`
- `tests/unit/integraciones/module-shape.test.ts`
- `tests/integration/integraciones/whatsapp-send-queue-prisma.int.test.ts`
- `tests/integration/integraciones/whatsapp-system-send-flow.int.test.ts`
- `tests/integration/integraciones/whatsapp-system-send-migration.int.test.ts`
- `tests/integration/aislamiento.json`
- `tests/guards/guard-qstash-aislado.test.ts`
- `tests/guards/guard-rutas-fuera-de-sesion.test.ts`
- `tests/guards/guard-ambito-empresa-integraciones.test.ts`
- `progress/impl_QC-241-envio-whatsapp-sistema.md`
