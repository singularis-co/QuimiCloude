# QC-240 — envio-whatsapp-usuario · tasks.md

> Requisitos R1–R48 (`requirements.md`), diseño en `design.md`. `[P]` = puede ir en paralelo con las
> otras `[P]` de su tanda. Cada tarea cierra con `pnpm run typecheck`, `pnpm run lint` y
> `pnpm exec vitest related --run <archivos tocados>`; las que tocan módulos, además
> `pnpm exec vitest run guard`. Nadie corre `pnpm test`.
>
> Antes de T1: si el humano respondió alguna de P1–P9 con otra cosa que el default, se corrige el
> requisito y esta lista antes de empezar.

## Tanda 1 — base (sin dependencias entre sí)

- [x] **T1 [P] Permiso `whatsapp.enviar`** (R1–R3, D5).
  - Migración de datos `20261023120000_whatsapp_send_permission` (`migration.sql` + `down.sql`),
    copia de la de QC-221 (design §2.2).
  - `permissions.ts`: entrada, párrafo de enmienda, `SEED_ROLE_PERMISSIONS[ROLE_ADMINISTRADOR]`.
  - `company-addons.ts`: en `ADDON_PERMISSIONS.integraciones`.
  - Tests: `whatsapp-send-permission-migration.test.ts` (estático) y `.int.test.ts`; tensar
    `permissions.test.ts`, `company-addons.test.ts`, `identity-seed.int.test.ts` y los que encuentre
    `vitest related` contando permisos.
  - **Hecho:** los tests nombrados en verde; solo el Administrador tiene el permiso en el seed y en la
    migración; aplicar dos veces no duplica; `down.sql` deja las tablas como antes.

- [x] **T2 [P] Migración de esquema** (R44, R47).
  - `schema.prisma`: `templateLanguage String? @map("template_language")` en `WhatsappMessage`.
  - `20261023130000_whatsapp_outbound_messages` (`migration.sql` + `down.sql`, design §2.3).
  - Test `whatsapp-outbound-messages-migration.int.test.ts` (patrón de
    `whatsapp-messages-migration.int.test.ts`).
  - **Hecho:** FK rechaza un `sent_by` inexistente; down + up dejan el mismo esquema;
    `prisma validate` sin cambios inesperados.

- [x] **T3 [P] Errores** (design §8).
  - 10 códigos en `error-codes.ts` (con su línea en el comentario de fechas) y `error-catalog.ts`;
    10 clases en `integraciones/domain/errors.ts`; `WhatsappTemplateValuesMissingError` lleva
    `missing: { key, label }[]`.
  - **Hecho:** `guard-catalogo-de-errores` verde; cada clase devuelve su código.

- [x] **T4 [P] `clientes`: `mainPhoneOf` e `isCustomerAlive`** (R6, R7, R5).
  - `customer-phone-links.ts` (dominio de `clientes`) y el puerto `integraciones/ports/customer-phone-links.ts`.
  - Tests unitarios en `tests/unit/clientes/customer-phone-links-main-phone.test.ts`.
  - **Hecho:** vivo con principal ⇒ `{ e164 }`; sin principal o con teléfono antiguo ⇒ `no_phone`;
    baja, inexistente u otra empresa ⇒ `customer_not_found`.

- [x] **T5 [P] Graph `sendMessage`** (R29, P9).
  - Antes de escribir: contrastar con la documentación vigente de la Cloud API el cuerpo de texto y
    de plantilla, la respuesta (`messages[0].id`), los códigos `190`, `131047`, `130429`, `131056` y
    el largo máximo del texto; anotar lo encontrado en `progress/impl_QC-240.md`. Si algo difiere del
    design, parar y avisar al leader.
  - Puerto `whatsapp-graph-client.ts`; `whatsapp-graph-client-fetch.ts`; `whatsapp-graph-client-canned.ts`
    (`CANNED_SEND_FAIL_PREFIX`).
  - Test `whatsapp-graph-client-send.test.ts` con `fetch` simulado; tensar
    `integraciones-graph-doubles.test.ts`.
  - **Hecho:** URL, cabecera, cuerpos y las cinco salidas (ok, 4xx con código, 4xx sin cuerpo, 5xx,
    timeout, 2xx sin `wamid`) fijadas por test.

## Tanda 2 — dominio puro y adaptador (dependen de T2/T3)

- [x] **T6 [P] Dominio puro** (R15–R17, R21–R25, R33–R36). Depende de T3.
  - `whatsapp-send-input.ts`, `whatsapp-send-window.ts`, `whatsapp-template-message.ts`,
    `whatsapp-send-failure.ts`, `whatsapp-outbound-message.ts`.
  - Tests `whatsapp-send-window.test.ts`, `whatsapp-template-message.test.ts`,
    `whatsapp-send-failure.test.ts`.
  - **Hecho:** sin imports de `ports`, `next/*`, Prisma ni `lib/shared`; tabla de §4.6 y casos de §4.5
    en verde.

- [x] **T7 [P] `WhatsappOutboxRepository` y adaptador Prisma** (R8, R11, R26–R28, R30–R32, R43).
  Depende de T2.
  - `ports/whatsapp-outbox-repository.ts`, `adapters/driven/persistence/whatsapp-outbox-prisma.ts`
    (funciones con nombre, ámbito por las envolturas existentes).
  - Test `whatsapp-outbox-prisma.int.test.ts` + entrada en `aislamiento.json`.
  - Tensar `guard-ambito-empresa-integraciones.test.ts` con el puerto nuevo (9 métodos) y casos de
    sensibilidad.
  - **Hecho:** ámbito (fila de otra empresa invisible), `markSent`/`markFailed` solo desde `SENDING`,
    `touchContact` no retrocede, `ensureContact` concurrente deja una fila; guardia verde.

## Tanda 3 — casos de uso (dependen de T1, T3–T7)

- [x] **T8 Casos de uso `sendWhatsappMessage` y `retryWhatsappMessage`** (R4–R20, R26–R42).
  - `actor.ts` (`requireSendPermission`), `whatsapp-send-recipient.ts`, `send-whatsapp-message.ts`,
    `retry-whatsapp-message.ts`.
  - Dobles en `whatsapp-doubles.ts`; tests `send-whatsapp-message.test.ts` y
    `retry-whatsapp-message.test.ts`.
  - **Hecho:** cada rechazo previo sin `insertSending` ni `sendMessage` (espías); orden del permiso
    primero; `190` actualiza la conexión; reintento no toca el fallido.

## Tanda 4 — borde y cableado (depende de T8)

- [x] **T9 Composición, contrato y Server Actions** (R37, R45, R46).
  - `lib/composition/index.ts`, `integraciones/index.ts`,
    `adapters/driving/whatsapp-message-actions.ts`.
  - Test `whatsapp-message-actions.test.ts` (éxito, `missing_values`, `ErrorState`, logs sin texto,
    valores, número ni token).
  - Tensar `module-shape.test.ts` (archivos, contrato, cableado, importadores) y el test de una
    lectura de sesión por petición si lo pide.
  - **Hecho:** guardias verdes; la acción no decide nada fuera de traducir.

- [ ] **T10 Test de integración del flujo** (R48, A6). Depende de T9.
  - `tests/integration/integraciones/whatsapp-send-flow.int.test.ts` sobre la composición real con el
    doble de Graph inyectado; entrada en `aislamiento.json` (`commit`, `motivo`, `desde`).
  - **Hecho:** los criterios de aceptación de la ficha, uno por caso, en verde contra la base de test.

## Tanda 5 — cierre

- [ ] **T11 Verificación y trazabilidad.**
  - `pnpm run typecheck`, `pnpm run lint`, `pnpm exec vitest run guard`, `vitest related` sobre todo
    el diff; `./init.sh`.
  - `progress/impl_QC-240.md` con el mapa `R<n> → test` (abajo) actualizado a los nombres reales de
    los casos.
  - **Hecho:** todo verde; ningún `R<n>` sin test.

## Mapa R → test (previsto)

| R | Test |
|---|---|
| R1 | `whatsapp-send-permission-migration.test.ts`, `permissions.test.ts` |
| R2 | `whatsapp-send-permission-migration.int.test.ts` |
| R3 | `company-addons.test.ts` |
| R4 | `send-whatsapp-message.test.ts`, `retry-whatsapp-message.test.ts` |
| R5–R10 | `send-whatsapp-message.test.ts`; R8 también en `whatsapp-send-flow.int.test.ts` |
| R11 | `whatsapp-outbox-prisma.int.test.ts`, `whatsapp-send-flow.int.test.ts` |
| R12–R14 | `send-whatsapp-message.test.ts` |
| R15, R16 | `whatsapp-send-window.test.ts`, `send-whatsapp-message.test.ts` |
| R17 | `send-whatsapp-message.test.ts` (entrada) |
| R18–R20 | `send-whatsapp-message.test.ts` |
| R21–R25 | `whatsapp-template-message.test.ts`; R24 también en `whatsapp-message-actions.test.ts` |
| R26–R28 | `send-whatsapp-message.test.ts`, `whatsapp-send-flow.int.test.ts` |
| R29 | `whatsapp-graph-client-send.test.ts` |
| R30, R31 | `send-whatsapp-message.test.ts`, `whatsapp-outbox-prisma.int.test.ts` |
| R32 | `whatsapp-outbox-prisma.int.test.ts`, `whatsapp-send-flow.int.test.ts` |
| R33–R36 | `whatsapp-send-failure.test.ts`; R33 también en `whatsapp-send-flow.int.test.ts` |
| R37 | `send-whatsapp-message.test.ts`, `whatsapp-message-actions.test.ts` |
| R38 | `send-whatsapp-message.test.ts` |
| R39–R42 | `retry-whatsapp-message.test.ts`; R39 y R42 también en `whatsapp-send-flow.int.test.ts` |
| R43 | `whatsapp-outbox-prisma.int.test.ts`, `whatsapp-send-flow.int.test.ts` |
| R44, R47 | `whatsapp-outbound-messages-migration.int.test.ts` |
| R45, R46 | `whatsapp-message-actions.test.ts` |
| R48 | `whatsapp-send-flow.int.test.ts` |

## Archivos esperados

- `db/schema.prisma`
- `db/migrations/20261023120000_whatsapp_send_permission/migration.sql`
- `db/migrations/20261023120000_whatsapp_send_permission/down.sql`
- `db/migrations/20261023130000_whatsapp_outbound_messages/migration.sql`
- `db/migrations/20261023130000_whatsapp_outbound_messages/down.sql`
- `lib/modules/identity/domain/permissions.ts`
- `lib/modules/identity/domain/company-addons.ts`
- `lib/modules/errores/domain/error-codes.ts`
- `lib/modules/errores/domain/error-catalog.ts`
- `lib/modules/clientes/domain/customer-phone-links.ts`
- `lib/modules/integraciones/index.ts`
- `lib/modules/integraciones/domain/actor.ts`
- `lib/modules/integraciones/domain/errors.ts`
- `lib/modules/integraciones/domain/whatsapp-send-input.ts`
- `lib/modules/integraciones/domain/whatsapp-send-window.ts`
- `lib/modules/integraciones/domain/whatsapp-send-recipient.ts`
- `lib/modules/integraciones/domain/whatsapp-template-message.ts`
- `lib/modules/integraciones/domain/whatsapp-send-failure.ts`
- `lib/modules/integraciones/domain/whatsapp-outbound-message.ts`
- `lib/modules/integraciones/domain/send-whatsapp-message.ts`
- `lib/modules/integraciones/domain/retry-whatsapp-message.ts`
- `lib/modules/integraciones/ports/whatsapp-graph-client.ts`
- `lib/modules/integraciones/ports/whatsapp-outbox-repository.ts`
- `lib/modules/integraciones/ports/customer-phone-links.ts`
- `lib/modules/integraciones/adapters/driven/graph/whatsapp-graph-client-fetch.ts`
- `lib/modules/integraciones/adapters/driven/graph/whatsapp-graph-client-canned.ts`
- `lib/modules/integraciones/adapters/driven/persistence/whatsapp-outbox-prisma.ts`
- `lib/modules/integraciones/adapters/driving/whatsapp-message-actions.ts`
- `lib/composition/index.ts`
- `tests/unit/identity/schema/whatsapp-send-permission-migration.test.ts`
- `tests/integration/identity/whatsapp-send-permission-migration.int.test.ts`
- `tests/unit/identity/permissions.test.ts`
- `tests/unit/identity/addons/company-addons.test.ts`
- `tests/integration/identity/identity-seed.int.test.ts`
- `tests/unit/clientes/customer-phone-links-main-phone.test.ts`
- `tests/unit/integraciones/whatsapp/whatsapp-graph-client-send.test.ts`
- `tests/unit/composition/integraciones-graph-doubles.test.ts`
- `tests/unit/integraciones/whatsapp/send/whatsapp-send-window.test.ts`
- `tests/unit/integraciones/whatsapp/send/whatsapp-template-message.test.ts`
- `tests/unit/integraciones/whatsapp/send/whatsapp-send-failure.test.ts`
- `tests/unit/integraciones/whatsapp/send/send-whatsapp-message.test.ts`
- `tests/unit/integraciones/whatsapp/send/retry-whatsapp-message.test.ts`
- `tests/unit/integraciones/whatsapp/send/whatsapp-message-actions.test.ts`
- `tests/unit/integraciones/whatsapp/whatsapp-doubles.ts`
- `tests/unit/integraciones/module-shape.test.ts`
- `tests/guards/guard-ambito-empresa-integraciones.test.ts`
- `tests/guards/guard-catalogo-de-errores.test.ts`
- `tests/integration/integraciones/whatsapp-outbox-prisma.int.test.ts`
- `tests/integration/integraciones/whatsapp-outbound-messages-migration.int.test.ts`
- `tests/integration/integraciones/whatsapp-send-flow.int.test.ts`
- `tests/integration/aislamiento.json`
- `progress/impl_QC-240.md`
