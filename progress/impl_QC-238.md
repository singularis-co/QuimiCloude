# QC-238 — recepcion-webhook-whatsapp · bitácora de implementación

## Estado: T1–T7 hechas (2026-10-19); sigue T8, ver «Tasks»

`tasks.md` exige contrastar §4.3 de `design.md` con la documentación vigente de la Cloud API antes
de T1, y parar si una diferencia cambia un requisito. Hay dos. No se ha tocado código.

## Contraste con la documentación de Meta (previo a T1)

- **Fuente:** developers.facebook.com, referencia del webhook `messages`
  (`/documentation/business-messaging/whatsapp/webhooks/reference/messages`, «Updated: 17 jun 2026»)
  y sus páginas por tipo (text, image, video, audio, document, sticker, location, contacts,
  reaction, button, interactive, unsupported, errors, status); `/docs/graph-api/webhooks/getting-started`
  para la firma y el handshake.
- **Versión:** las URLs no fijan versión; la página de status describe el comportamiento de
  Graph API **v24.0+** (omite `conversation` desde v24.0).

### Diferencias que cambian un requisito (piden decisión humana)

1. **Reacción quitada (R19/R20).** Meta **omite** `reaction.emoji` cuando el usuario quita la
   reacción. `design.md` §4.3 (línea 376) dice «`emoji` (vacío = quitó la reacción)». Si el schema
   lo exige, una reacción quitada caería en `UNSUPPORTED`.
   Propuesta: `emoji` opcional; ausente o vacío = quitó la reacción; payload `{ message_id, emoji: null }`.
2. **Clave del remitente (R16, y la unicidad `(connection_id, wa_id)` de R29).** Meta documenta
   `messages[].from` como «WhatsApp user phone number» y `contacts[].wa_id` como «WhatsApp user ID»,
   y avisa dos veces que «may not always match». `design.md` §4.3 (línea 365) trata `from` como
   el wa_id y cruza `from` con `contacts[].wa_id` para el nombre de perfil.
   Opciones: (a) mantener `from` como clave y aceptar `profileName = null` cuando no casen;
   (b) usar `contacts[].wa_id` cuando haya un único contacto en el `value` y `from` si no;
   (c) otra que decida el humano.

### Diferencias cosméticas (sin impacto en requisitos)

- Existe el status `played` (primera reproducción de nota de voz): R22 ya lo ignora; se puede
  nombrar en un test como valor conocido que se ignora.
- `interactive.type = "product"` existe: cae en `UNSUPPORTED` por R20.
- `type: "unsupported"` trae `errors[]` y `unsupported.type`: el diseño guarda el mensaje entero.
- Los medios traen también `sha256` y `url` (audio `voice`, sticker `animated`); R19 limita lo que
  se guarda.
- Campos opcionales que el diseño deja pasar: `identity_key_hash`, `context`, `referral`, y los
  campos de grupo en statuses.
- `value.errors` (errores de sistema/app/cuenta): ningún requisito lo cubre.
- `delivered` puede no llegar si llega `read`: §4.4 ya permite saltar pasos.

### Coincide sin diferencias

Forma de la notificación (`object`, `entry[].id`, `changes[].field = "messages"`,
`metadata.phone_number_id`, `contacts`, `messages`, `statuses`), objetos por tipo de §4.3,
errores de status, firma `X-Hub-Signature-256: sha256=<hex>` (§5.4) y handshake
`hub.mode=subscribe` / `hub.verify_token` / `hub.challenge`.

## Tasks

T1–T7 hechas (T3 cerrada con la excepción nombrada de la última fila de «Decisiones cerradas»; detalle en «Tanda T3, T6, T7»). Historia de T3: `guard-firma-sesion-unica` prohíbe `createHmac`/`crypto.subtle` fuera de `lib/modules/identity/adapters/driven/session/session-token.ts`, sin lista de exenciones, y §5.4 exige `createHmac` en `adapters/driven/security/webhook-signature-hmac.ts`. Pide decisión humana: exención con nombre en esa guardia, o enmienda del spec. `guard-ambito-empresa-integraciones` (4→5 métodos) en rojo esperado hasta T12.

## Tanda T2–T5 (backend_dev, 2026-10-19)

**Archivos**
- T2: `lib/modules/integraciones/domain/whatsapp-message.ts`, `domain/whatsapp-message-status.ts`;
  `tests/unit/integraciones/whatsapp/whatsapp-message-status.test.ts`.
- T3: `ports/webhook-signature.ts`, `adapters/driven/security/webhook-signature-hmac.ts`;
  `tests/unit/integraciones/whatsapp/webhook-signature-hmac.test.ts`.
- T4: `domain/whatsapp-inbound-message.ts`, `domain/whatsapp-webhook-payload.ts`;
  `tests/unit/integraciones/whatsapp/whatsapp-webhook-fixtures.ts`, `whatsapp-webhook-payload.test.ts`.
- T5: `ports/whatsapp-connection-repository.ts` (+`lastWebhookAt`, +`recordWebhookHandshake`),
  `ports/whatsapp-webhook-directory.ts`, `ports/whatsapp-inbox-repository.ts`,
  `ports/integrations-switch.ts`, `adapters/driven/persistence/whatsapp-connection-prisma.ts`,
  `tests/unit/integraciones/whatsapp/whatsapp-doubles.ts`. Para que `typecheck` siga verde con el
  método nuevo del puerto: `lib/composition/index.ts` (solo la línea `recordWebhookHandshake`),
  `tests/integration/integraciones/whatsapp-connection-prisma.int.test.ts` (repositorio armado a
  mano) y `tests/unit/composition/integraciones-graph-doubles.test.ts` (su `vi.mock` del adaptador).

**Mapa R → test (esta tanda)**
- R21 → `whatsapp-message-status.test.ts` (tabla 7×4) y `whatsapp-webhook-payload.test.ts > statuses`.
- R10, R11 → `webhook-signature-hmac.test.ts`.
- R13, R14, R15, R16, R17, R18 (dedupe en lote), R19, R20, R22 → `whatsapp-webhook-payload.test.ts`.
- R6 (doble) → `whatsapp-doubles.ts`; el comportamiento lo prueban T8 y T14.

**Verificación**
- `pnpm run typecheck`: verde. `pnpm run lint`: 0 errores (10 warnings preexistentes, ninguno nuestro).
- `vitest related` T2–T4: 3 archivos, 133/133 verdes.
- `vitest related` T5 (con `.env`): 412 archivos; 410 verdes, 2 rojos: el `vi.mock` de
  `integraciones-graph-doubles.test.ts` (arreglado) y `recetas/recipe-tools.int.test.ts` (timeout de
  hook por carga; aislado pasa). Re-corrida de esos dos + `whatsapp-connection-prisma.int.test.ts`
  + `tests/unit/integraciones/whatsapp`: 19 archivos, 333/333 verdes.
- `pnpm exec vitest run guard`: 79/81 archivos verdes, 2 rojos:
  1. `guard-ambito-empresa-integraciones` (metodosEsperados 4, hay 5): previsto, lo tensa T12.
  2. `guard-firma-sesion-unica`: prohíbe `createHmac` fuera del codec de sesión, sin lista de
     exenciones. §5.4 exige `createHmac` en `webhook-signature-hmac.ts`. **Bloqueo: el spec no prevé
     esta guardia; pide decisión humana** (p. ej. exención con nombre para el HMAC de Meta).

**Veredicto:** T2–T5 hechas según spec; gate rojo por `guard-firma-sesion-unica` hasta que el humano decida.

## Tanda T3, T6, T7 (backend_dev, 2026-10-19)

**Archivos**
- T3: `tests/guards/guard-firma-sesion-unica.test.ts`: `EXENTOS_DE_LA_FIRMA_DE_SESION` con una sola
  ruta exacta (`webhook-signature-hmac.ts`), `isSignatureIntruder()` y un caso de sensibilidad
  (la lista es exactamente esa ruta; la exenta pasa; vecinas, `.tsx`, otro módulo, otra carpeta,
  la ruta del webhook y `middleware.ts` con `createHmac` siguen siendo intrusas; la exenta sigue
  casando con la huella).
- T6: `lib/modules/integraciones/adapters/driven/persistence/whatsapp-webhook-directory-prisma.ts`.
- T7: `adapters/driven/persistence/company-scope.ts` (+2 envolturas),
  `adapters/driven/persistence/whatsapp-inbox-prisma.ts`,
  `tests/integration/integraciones/whatsapp-inbox-prisma.int.test.ts`,
  `tests/integration/aislamiento.json` (entrada `commit`, añadido).

**Mapa R → test (esta tanda)**, en `whatsapp-inbox-prisma.int.test.ts`:
- R16, R17, R24 → «crea el contacto y el mensaje entrante…»; R24 → «un lote vacío solo deja lastWebhookAt».
- R16 → «un lote más viejo no retrocede…»; R16, R25 → «dos record concurrentes del mismo número…».
- R18, R25 → «un wamid ya guardado…». R23 → «si un paso falla no queda nada escrito…».
- R21 → «avanza SENT -> READ…», «FAILED desde SENT…», «un status nunca toca un entrante».
- R22 → «un status de un wamid desconocido…». R2 → «un status de la empresa B…».
- R32 (T6) → lo prueban T12 (forma) y T15 (comportamiento), según `tasks.md`.

**Verificación**
- `pnpm run typecheck`: verde. `pnpm run lint`: 0 errores, 10 warnings preexistentes ajenos.
- `vitest run guard-firma-sesion-unica webhook-signature-hmac`: 2/2 archivos, 23/23.
- `vitest related` sobre los archivos nuevos + la guardia (con `.env`): 2/2 archivos, 19/19.
  `vitest related` con `company-scope.ts` arrastra la composición (>40 min); se cortó y se corrió
  en su lugar `vitest run tests/unit/integraciones tests/integration/integraciones`: 45/47 archivos,
  829 verdes, 5 rojos, ninguno de esta tanda:
  - `module-shape.test.ts` R13 y R18: listas exactas que tensa T13.
  - `whatsapp-connection-migration.int.test.ts` (3): su `down.sql` de QC-237 no puede borrar
    `whatsapp_connections` porque ahora dependen de ella las FK de T1. **Ninguna task lo cubre.**
- `vitest run guard`: 80/81 archivos; 3 rojos en `guard-ambito-empresa-integraciones` (4→5 métodos,
  2→4 envolturas, resolutor sin ámbito): los tres los resuelve T12.

**Veredicto:** T3, T6 y T7 hechas según spec; hay un rojo en la migración de QC-237 que no cubre ninguna task.

## Tanda 2026-10-19 (b) — reparación de la migración de QC-237, T8 y T9

**Reparación (no cambia el spec).** `tests/integration/integraciones/whatsapp-connection-migration.int.test.ts`:
patrón `DEPENDIENTES_POSTERIORES` de `clientes/customers-migration.int.test.ts` (detección transitiva
por `REFERENCES`, DOWN de dependientes de la más reciente a la más antigua antes del propio, UP
después), ancla `toContain('20261019140000_whatsapp_contacts_and_messages')` y nota fechada
2026-10-19. El caso del DOWN descuenta también las tablas creadas por las dependientes. Ningún caso
quitado ni relajado. Resultado: 1/1 archivo, 9/9 verdes (antes 3 rojos 2BP01).

**Archivos**
- T8: `lib/modules/integraciones/domain/webhook-connection.ts`, `domain/verify-whatsapp-webhook.ts`,
  `tests/unit/integraciones/whatsapp/verify-whatsapp-webhook.test.ts`.
- T9: `domain/receive-whatsapp-webhook.ts`, `tests/unit/integraciones/whatsapp/receive-whatsapp-webhook.test.ts`.
- `tests/unit/integraciones/whatsapp/whatsapp-doubles.ts`: + `makeWebhookDirectory`, `makeIntegrationsSwitch` (añadido).
- El id se valida con `isWhatsappConnectionId` (zod uuid, ya existente); el token se compara con
  `SecretDigest.matches` (SHA-256 + `timingSafeEqual`).

**Mapa R → test (esta tanda)**
- R2 → verify: «el ámbito pasado a findLiveById y devuelto es el que dio el resolutor», «si el resolutor
  da otra empresa… ⇒ missing», «el resolutor recibe el id de la URL y nada más»; receive: «guarda el
  lote… con el ámbito de la fila».
- R3 → verify: «el id %j sin forma de UUID ⇒ forbidden(missing) sin llamar a ningún puerto» (5 ids),
  resolutor «R3: un id sin forma de UUID»; receive: «R3, R9: un id sin forma de UUID».
- R4 → verify: «añadido integraciones apagado ⇒ forbidden(addon_off)…»; receive: «R9, R4: … con el añadido apagado».
- R5 → verify: «con token correcto devuelve el challenge tal cual…», «el token se compara contra el resumen».
- R6 → verify: «deja ACTIVE una conexión PENDING», «una conexión ACTIVE/ERROR conserva su estado…»,
  «si la deshabilitan entre la lectura y la escritura, sigue DISABLED».
- R7 → verify: 8 casos `bad_request` sin puertos, inexistente, fila desaparecida, DISABLED, addon_off,
  token_mismatch; ninguno llama a `recordWebhookHandshake`.
- R9 → receive: «conexión inexistente/DISABLED/añadido apagado ⇒ ignored sin descifrar, sin firma y sin guardar».
- R10 → receive: «el orden es resolver → descifrar → firma → parsear → guardar» (espías con
  `invocationCallOrder`), «la firma se comprueba sobre los bytes exactos…», «con firma mala, un cuerpo
  que no es JSON ni UTF-8 no lanza».
- R11 → receive: «falta la cabecera / cabecera que no coincide ⇒ unauthorized, sin parsear y sin escribir».
- R12 → receive: «SecretUnreadableError ⇒ secret_unreadable, la conexión queda en ERROR…», «un fallo
  del cifrador que no es SecretUnreadableError se propaga».
- R13 → receive: 4 cuerpos firmados ilegibles ⇒ `ignored(unparseable)`.
- R23 → receive: «una excepción del inbox se propaga tal cual».
- R24 (dominio) → receive: «un POST firmado sin nada que guardar llama igualmente al inbox».
- R26 → receive y verify: `fetch` espiado no se llama; los deps no incluyen Graph.

**Verificación**
- `pnpm run typecheck`: verde (sin salida de errores).
- `pnpm run lint`: 0 errores, 10 warnings preexistentes ajenos; `eslint` sobre los archivos tocados: limpio.
- `vitest run verify-whatsapp-webhook receive-whatsapp-webhook`: 2/2 archivos, 47/47.
- `vitest run tests/integration/integraciones/whatsapp-connection-migration.int.test.ts` (con `.env`): 1/1, 9/9.
- `vitest related --run` sobre los 3 archivos de dominio nuevos + `whatsapp-doubles.ts`: 7/7 archivos, 142/142.
- `vitest run tests/guards`: 72/73 archivos, 1005 verdes, 3 rojos, los mismos de la tanda anterior en
  `guard-ambito-empresa-integraciones` (4→5 métodos, envolturas, resolutor): los cierra T12.

**Veredicto:** T8 y T9 hechas según spec y el rojo de la migración de QC-237 reparado; sigue el rojo conocido de la guardia de ámbito, que es de T12.
