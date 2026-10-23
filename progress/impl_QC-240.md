# QC-240 — envio-whatsapp-usuario · bitácora del implementer

## Tanda 1 (T1–T5) — 2026-10-23

Parte del WIP `8fd89d26` (dos sesiones cortadas). Revisado contra `tasks.md` y `design.md`, completado
y verificado aquí.

### Archivos creados/modificados

- T1: `db/migrations/20261023120000_whatsapp_send_permission/{migration,down}.sql`,
  `lib/modules/identity/domain/permissions.ts`, `lib/modules/identity/domain/company-addons.ts`,
  `tests/unit/identity/schema/whatsapp-send-permission-migration.test.ts`,
  `tests/integration/identity/whatsapp-send-permission-migration.int.test.ts`; tensados
  `tests/unit/identity/permissions.test.ts`, `tests/unit/identity/addons/company-addons.test.ts`,
  `tests/integration/identity/identity-seed.int.test.ts`, `tests/unit/navegacion/qc75-convenciones.test.ts`,
  `tests/unit/asignaciones/schema/order-assignments-migration.test.ts` (los que `vitest related` encontró
  contando permisos).
- T2: `db/schema.prisma` (una línea), `db/migrations/20261023130000_whatsapp_outbound_messages/{migration,down}.sql`,
  `tests/integration/integraciones/whatsapp-outbound-messages-migration.int.test.ts` (el fixture crea la
  conexión con otro usuario: si no, borrar al que envía chocaba con `whatsapp_connections_created_by_fkey`).
- T1/T2: `tests/integration/aislamiento.json` (dos entradas en `transaccion`),
  `tests/guards/guard-identificador-de-request.test.ts` (las dos migraciones en `MIGRACIONES_ESPERADAS`).
- T3: `lib/modules/errores/domain/error-codes.ts`, `error-catalog.ts`, `lib/modules/integraciones/domain/errors.ts`,
  `tests/unit/errores/catalogo.test.ts`.
- T4: `lib/modules/clientes/domain/customer-phone-links.ts`, `lib/modules/integraciones/ports/customer-phone-links.ts`,
  `tests/unit/clientes/customer-phone-links-main-phone.test.ts`, `tests/unit/integraciones/whatsapp/whatsapp-doubles.ts`.
- T5: `lib/modules/integraciones/ports/whatsapp-graph-client.ts`,
  `adapters/driven/graph/whatsapp-graph-client-fetch.ts`, `adapters/driven/graph/whatsapp-graph-client-canned.ts`,
  `lib/composition/index.ts` (cuatro líneas: `sendMessage` en el cliente compuesto, design §5.1 «lo cablea la
  composición igual que los otros cuatro métodos»; sin ellas el objeto no cumple el puerto y no compila),
  `tests/unit/integraciones/whatsapp/whatsapp-graph-client-send.test.ts`,
  `tests/unit/composition/integraciones-graph-doubles.test.ts`.

### T5 — contraste con la documentación de la Cloud API

**No se contrastó con la documentación vigente de Meta**: esta sesión no tiene acceso a ella. Se implementa
lo que dice el design (§5.1), sin añadir nada:

- `POST {GRAPH_BASE_URL}/{WHATSAPP_GRAPH_API_VERSION}/{phone_number_id}/messages`, token en
  `Authorization: Bearer`, `AbortSignal.timeout`, `cache: 'no-store'` (el `callGraph` existente).
- Texto: `{ messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'text', text: { body, preview_url: false } }`.
- Plantilla: `{ …, type: 'template', template: { name, language: { code }, components } }`.
- Éxito: 2xx con `messages[0].id` no vacío ⇒ `{ ok: true, wamid }`; 2xx sin él ⇒ `unreachable` sin código.
- Fallo: `templateFailureOf` (4xx con `error.code`/`error_subcode`/`message` ⇒ `rejected` con ellos; 4xx sin
  cuerpo legible ⇒ `rejected` sin detalle; 5xx, red o tiempo ⇒ `unreachable`). Los códigos `190`, `131047`,
  `130429`, `131056` se pasan tal cual; su traducción es T6 (§4.6).
- Largo máximo del texto (P9): 4096, default del spec; la constante vive en `whatsapp-send-input.ts` (T6), no
  en el adaptador.

Queda abierto para el humano/leader: confirmar contra la documentación de Meta la forma de los cuerpos, la
respuesta, esos cuatro códigos y el límite de 4096.

### Mapa R → test (Tanda 1)

| R | Test |
|---|---|
| R1 | `permissions.test.ts` › «el permiso whatsapp.enviar» (6 casos `R1: …`); `whatsapp-send-permission-migration.test.ts` › `R1: ninguna otra migracion nombra whatsapp.enviar`, `R1, R2: la fila insertada es exactamente la entrada de PERMISSIONS…`, `R1, R2: la asignacion va solo al Administrador…`; `identity-seed.int.test.ts` › `R1, R2: sobre la base ya sembrada salvo whatsapp.enviar…` |
| R2 | `whatsapp-send-permission-migration.int.test.ts` › `R1, R2: sobre una base sembrada sin el permiso…`, `R2: aplicar el UP dos veces no falla…`, `R2: sobre una base que ya tiene el permiso…`, `R2: el DOWN, leido del archivo, deja la base exactamente como antes del UP`; casos `R2:` del test estático |
| R3 | `company-addons.test.ts` › `R3 — whatsapp.enviar es de integraciones, de ningún otro añadido y no es núcleo`, `R3 — con integraciones apagado la sesión pierde whatsapp.enviar; encendido lo conserva`, `R2 — exactamente cinco añadidos, con sus permisos` |
| R5 | `customer-phone-links-main-phone.test.ts` › `R5: isCustomerAlive responde lo que el puerto dice del cliente en esa empresa` (el resto de R5 va en T8) |
| R6 | `customer-phone-links-main-phone.test.ts` › `R6, R8: cliente vivo con principal ⇒ { e164 }…`, `R6: cliente dado de baja, inexistente o de otra empresa… ⇒ customer_not_found`, `R6: mainPhoneOf pasa la empresa como el ambito de clientes`, `R6: mainPhoneOf de un cliente que el puerto no ve vivo ⇒ customer_not_found` |
| R7 | `customer-phone-links-main-phone.test.ts` › `R7: cliente vivo sin ningun telefono ⇒ no_phone`, `R7: cliente vivo con solo secundarios… ⇒ no_phone` |
| R29 | `whatsapp-graph-client-send.test.ts` (URL, cabecera, cuerpos de texto y plantilla, versión ausente, 2xx con/sin `wamid`, 4xx con código ×5, 4xx sin código, 4xx sin cuerpo, 5xx, red, tiempo, doble E2E); `integraciones-graph-doubles.test.ts` › `R29 — el cliente real y el doble exponen los mismos cinco metodos, sendMessage incluido` |
| R44, R47 | `whatsapp-outbound-messages-migration.int.test.ts` (8 casos `R44`/`R47`) |

### Verificación (salida real)

- `pnpm run typecheck` → `tsc --noEmit`, EXIT 0.
- `pnpm exec eslint <archivos de T1–T5>` → sin salida, EXIT 0.
- `pnpm exec vitest related --run` sobre los archivos de T1 (como `permissions.ts` lo importa casi todo,
  arrastró 1028 archivos, 35 min): `Test Files  2 failed | 1026 passed (1028)` /
  `Tests  2 failed | 17558 passed | 23 skipped (17583)`. Los dos rojos: el caso R44 de borrar el usuario
  (corregido después; ver abajo) y `recetas/conditioning-steps.int.test.ts` por plazo bajo carga (457 s);
  vuelto a correr aislado, verde.
- Directo, los archivos tocados + `conditioning-steps.int.test.ts`: `Test Files  10 passed (10)` /
  `Tests  307 passed | 3 skipped (310)`.
- Integración: `whatsapp-send-permission-migration` + `identity-seed`: verdes (en la corrida de 3 archivos,
  `Tests 1 failed | 48 passed (49)`, el rojo era el R44 ya corregido); `whatsapp-outbound-messages-migration`
  tras la corrección: `Test Files  1 passed (1)` / `Tests  8 passed (8)`.
- `pnpm exec vitest run guard`: primera corrida `Test Files 1 failed | 86 passed (87)` (censo de migraciones
  de `guard-identificador-de-request`); re-corrida tras corregirlo: `Test Files  87 passed (87)` / `Tests  1276 passed | 22 skipped (1298)`.

### Veredicto

Tanda 1 verde salvo el contraste de T5 con la documentación de Meta, que queda abierto.

## Tanda 2 (T6–T7) — 2026-10-23

### Archivos
- T6 (7284210c): `lib/modules/integraciones/domain/whatsapp-send-input.ts` (`WHATSAPP_TEXT_MAX_LENGTH = 4096`, medido en puntos de código), `whatsapp-send-window.ts`, `whatsapp-template-message.ts` (`buildTemplateMessage`, `isSendable`), `whatsapp-send-failure.ts`, `whatsapp-outbound-message.ts`; tests `tests/unit/integraciones/whatsapp/send/whatsapp-send-window.test.ts`, `whatsapp-template-message.test.ts`, `whatsapp-send-failure.test.ts`; entradas en `module-shape.test.ts`.
- T7 (2d00caf3): `lib/modules/integraciones/ports/whatsapp-outbox-repository.ts`, `adapters/driven/persistence/whatsapp-outbox-prisma.ts` (fábrica `createWhatsappOutboxRepository(db = prisma)`), `tests/integration/integraciones/whatsapp-outbox-prisma.int.test.ts`, entrada `commit` en `aislamiento.json`, `tests/guards/guard-ambito-empresa-integraciones.test.ts` (9 métodos + 5 casos de sensibilidad).

### Decisiones de implementación
- `buildTemplateMessage` lanza `WhatsappTemplateNotSendableError` ante contenido no relacionable: §4.5 nombra esa clase; «no como excepción» se lee como «no como error interno».
- Fábrica en el adaptador en vez del objeto inline de §5.3: la guardia de ámbito lee el cableado de ahí; los nombres de función son los de §5.3. T9 usa `createWhatsappOutboxRepository()`.
- T7 filtraba `findOutbound` por salientes y rompía R40 (un entrante daba `not_found`). Corregido en 1bfc280e (tanda 3): `OutboundMessageRecord` admite `origin`, `sentById` y `body` nulos.

### Verificación (salida real)
- T6: typecheck exit 0; eslint sin salida; `vitest run tests/unit/integraciones/whatsapp/send` `Test Files 3 passed (3)` / `Tests 47 passed (47)`; guard `Test Files 87 passed (87)` / `Tests 1303 passed | 22 skipped (1325)`.
- T7: typecheck y eslint limpios; `whatsapp-outbox-prisma.int.test.ts` `Test Files 1 passed (1)` / `Tests 17 passed (17)`; guard `Test Files 87 passed (87)` / `Tests 1303 passed | 22 skipped (1325)`.

## Tanda 3 (T8) — 2026-10-23

### Commits e historia
1bfc280e (fix R40), ec8ab563 (WIP T8, código y tests), 040f8cad (marca `[x]` de T8), c23e8705 (titulado T8; por un `git add -A` concurrente lleva también tests de T9: `whatsapp-message-actions.test.ts`, `integraciones-graph-doubles.test.ts`, `session-once-per-request-actions.test.ts`, `encryption-keys-env.test.ts`, `module-shape.test.ts`). Ningún contenido perdido; no se reescribe historia publicada.

### Archivos
`lib/modules/integraciones/domain/actor.ts` (`requireSendPermission`), `whatsapp-send-recipient.ts`, `send-whatsapp-message.ts`, `retry-whatsapp-message.ts`; `tests/unit/integraciones/whatsapp/whatsapp-doubles.ts`; `tests/unit/integraciones/whatsapp/send/send-whatsapp-message.test.ts` (62 casos), `retry-whatsapp-message.test.ts` (32 casos).

### Decisiones de implementación (el design no las fija)
- El caso de uso devuelve `{ message: WhatsappOutboundMessageView; diagnostic: string | null }` (§7).
- `markSent`/`markFailed` con `null` (el mensaje ya salió de SENDING): se devuelve el resultado de esta llamada y la fila queda como está. **Pendiente de confirmar** (pregunta abierta).
- Fallido OUT+USER sin contenido que reenviar ⇒ `whatsapp_message_not_retryable`.
- Valores de propias por `variableKeys.listAll(scope)` indexado por id (el design dice «findByKeys/por id»).
- Por cliente, el contacto se crea/vincula antes de comprobar ventana y plantilla (§4.4): un texto a un contacto nuevo acaba en `whatsapp_window_closed` con el contacto ya creado.

### Verificación (salida real)
- typecheck limpio; eslint en los 8 archivos sin incidencias.
- Los dos tests: `Test Files 2 passed (2)` / `Tests 94 passed (94)`.
- `vitest run tests/unit/integraciones`: `Test Files 90 passed (90)` / `Tests 1909 passed | 1 skipped (1910)`.
- `vitest related` sobre `actor.ts`: `Test Files 502 passed (502)` / `Tests 8866 passed | 3 skipped (8869)`.
- guard: `Test Files 87 passed (87)` / `Tests 1303 passed | 22 skipped (1325)`.

## Tanda 4 (T9) — EN CURSO, BLOQUEADA

Código y tests en b04e673e + c23e8705: `adapters/driving/whatsapp-message-actions.ts`, `lib/composition/index.ts` (aditivo: `createWhatsappOutboxRepository()`, `whatsappSendCustomerPhones`, `whatsappSendDeps`, los dos miembros), `lib/modules/integraciones/index.ts`, `lib/modules/clientes/adapters/driven/persistence/customer-phone-prisma.ts` (`createCustomerPhoneRepository(db = prisma)`: la guardia de arquitectura R17 prohíbe a la composición importar el cliente Prisma; desvío de §5.3), tests tensados `module-shape`, `session-once-per-request-actions`, `integraciones-graph-doubles`, `encryption-keys-env`.

Verificación: typecheck 0 errores; eslint limpio; actions `Tests 15 passed (15)`; `tests/unit/integraciones` `Test Files 91 passed (91)` / `Tests 1924 passed | 1 skipped (1925)`; `tests/unit/composition` `Tests 87 passed (87)`; session-once `Tests 110 passed (110)`; **guard `Test Files 1 failed | 86 passed (87)`**: el caso 9 de `guard-catalogo-de-errores` prohíbe a `adapters/driving/**` leer `.diagnostic`, y design §7 pide que la acción haga `console.warn('whatsapp_send_failed', { messageId, diagnostic })`. Contradicción spec ↔ guardia: decide el leader/humano.

## Mapa R → test (estado a la tanda 3)

`S` = `tests/unit/integraciones/whatsapp/send/send-whatsapp-message.test.ts`, `Rt` = `.../retry-whatsapp-message.test.ts`, `A` = `.../whatsapp-message-actions.test.ts`, `Ob` = `tests/integration/integraciones/whatsapp-outbox-prisma.int.test.ts`. Nombres exactos de R1–R3, R6–R7, R29, R44 y R47 en la Tanda 1.

| R | Test |
|---|---|
| R1–R3 | ver Tanda 1 |
| R4 | S «R4: … responde unauthorized antes de validar la entrada…», «R4, R26: el permiso es lo primero…»; Rt «R4: …» |
| R5 | S «R5: un contacto que … responde whatsapp_contact_not_found…»; `customer-phone-links-main-phone.test.ts` «R5: isCustomerAlive…» |
| R6 | S «R6: un cliente que no esta vivo…»; Tanda 1 |
| R7 | S «R7: un cliente sin phone_e164…»; Tanda 1 |
| R8 | S «R8: usa el contacto sin cliente…», «R8, R11: sin contacto…»; Ob «ensureContact crea el contacto…» |
| R9 | S «R9: … whatsapp_contact_linked_elsewhere…» |
| R10 | S «R10: un contacto bloqueado…» |
| R11 | S «R11: si ensureContact devuelve el contacto que otro envio acaba de crear…»; Ob «varios ensureContact a la vez…» |
| R12 | S «R12: sin conexion viva…», «R12: la conexion de otra empresa no cuenta» |
| R13 | S «R13: con la conexion en PENDING/ERROR/DISABLED…» |
| R14 | S «R14: un token que no se descifra…» |
| R15 | `whatsapp-send-window.test.ts` (3 casos R15); S «R15: con la ventana abierta se envia el texto libre» |
| R16 | `whatsapp-send-window.test.ts` (3 casos R16); S «R16: … whatsapp_window_closed…» |
| R17 | S «R17: un texto … responde invalid_input…», «R17: un texto justo en el maximo se acepta»; Rt «R17: un messageId sin forma de uuid…»; casos R17 del esquema (T6) |
| R18 | S «R18: una plantilla enviable se envia con la ventana abierta/cerrada» |
| R19 | S «R19: una plantilla que … responde whatsapp_template_not_found…» |
| R20 | S «R20: una plantilla … responde whatsapp_template_not_sendable…», «R20, R24: una constante sin valor…» |
| R21–R23 | `whatsapp-template-message.test.ts` (casos R21, R22, R23) |
| R24 | `whatsapp-template-message.test.ts` (4 casos R24); A «R24: una constante faltante sale con su etiqueta…» |
| R25 | `whatsapp-template-message.test.ts` (2 casos R25) |
| R26, R27 | S «R26, R27: un texto inserta el mensaje SENDING del actor…»; Ob «insertSending de un texto…» |
| R28 | S «R28: una plantilla guarda TEMPLATE…»; Ob «insertSending de una plantilla…» |
| R29 | `whatsapp-graph-client-send.test.ts`; S «R29: llama a Graph con el phone_number_id…» |
| R30 | S «R30: si Meta acepta…»; Ob «markSent guarda el wamid…» |
| R31 | S «R31: con … el mensaje queda FAILED…»; Ob «markFailed pasa a FAILED…» |
| R32 | S «R32: al terminar actualiza lastMessageAt…»; Ob «touchContact mueve lastMessageAt solo hacia delante…» |
| R33 | `whatsapp-send-failure.test.ts` «el código 190…»; S «R33: el codigo 190 deja el mensaje FAILED y la conexion en ERROR…» |
| R34, R35 | `whatsapp-send-failure.test.ts`; S «R34/R35: el codigo … deja el mensaje FAILED…» |
| R36 | `whatsapp-send-failure.test.ts` (5 casos R36); S «R36: otro codigo da el texto generico…» |
| R37 | S «R37: devuelve el mensaje resultante…»; A «R37: un mensaje SENT sale como success…» |
| R38 | S «R38: si falla la escritura del mensaje…» |
| R39 | Rt «R39: crea un mensaje nuevo SENT y no modifica el fallido» y siguientes |
| R40 | Rt «R40: un mensaje que … responde whatsapp_message_not_found…», «R40: … whatsapp_message_not_retryable…»; Ob «R31, R40 — findOutbound … tambien devuelve un entrante…» |
| R41 | Rt «R41: reenvia el mismo body…», «R41: valida la ventana en el momento del reintento…» |
| R42 | Rt «R42: busca la plantilla viva…», «R42: la variable propia toma su value vigente…» |
| R43 | Ob (4 casos R43) y `guard-ambito-empresa-integraciones.test.ts` «R43 (QC-240) …» |
| R44, R47 | `whatsapp-outbound-messages-migration.int.test.ts` (8 casos) |
| R45 | A «R45: enviar pasa la entrada tal cual…», «R45: cada error del catalogo sale como ErrorState…» |
| R46 | A «R46: …» (3 casos); depende de la decisión sobre §7 |
| R48 | pendiente: `whatsapp-send-flow.int.test.ts` (T10) |
