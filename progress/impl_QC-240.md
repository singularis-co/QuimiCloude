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
