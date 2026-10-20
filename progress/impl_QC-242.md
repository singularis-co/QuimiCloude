# QC-242 — plantillas-whatsapp-backend · bitácora del implementer

## Contraste con Meta (antes de T3), 2026-10-20

Fuentes (developers.facebook.com/documentation/business-messaging/whatsapp/…; las URL antiguas
`/docs/whatsapp/…` redirigen):
- templates/components (actualizada 2026-06-24, ejemplos v26.0)
- templates/overview (2026-05-21, v23.0)
- templates/template-management (v23.0)
- reference/whatsapp-business-account/message-template-api
- templates/supported-languages (2026-05-21)
- support/error-codes (2026-06-18)
- webhooks/reference/message_template_status_update y template_category_update
- Graph API reference `whats-app-business-account/message_templates` (v26.0, la más reciente)

| Supuesto del spec | Resultado | Qué se hace |
|---|---|---|
| §3.3 nombre `^[a-z0-9_]+$` 1–512 | Confirmado | Sin cambio |
| §3.3 header TEXT ≤ 60, 1 variable, ejemplo obligatorio | Confirmado | Sin cambio |
| §3.3 body ≤ 1024; variables `{{n}}` consecutivas desde 1; ejemplos obligatorios | Confirmado (Meta tiene además `parameter_format: named`, fuera de alcance) | Sin cambio |
| §3.3 footer ≤ 60 sin variables | 60 confirmado. «Sin variables»: Meta se contradice (components lo da como texto fijo; utility-templates dice que admite variables) | Se mantiene «sin variables» (lo más restrictivo); abierto |
| §3.3 texto de botón ≤ 25 | Confirmado | Sin cambio |
| §3.3 URL ≤ 2000, una variable al final, ejemplo | Confirmado | Sin cambio |
| §3.3 ≤ 10 botones, ≤ 2 URL, ≤ 1 teléfono, QUICK_REPLY agrupados | Confirmado | Sin cambio |
| §3.3 teléfono `^\+[1-9]\d{7,14}$` | Meta: cadena de ≤ 20 caracteres, ejemplo sin `+`, sin exigir E.164 | Se mantiene la regla del spec: es un subconjunto válido de lo que acepta Meta; abierto |
| §3.3 largos en puntos de código | No encontrado (Meta no dice cómo cuenta) | Se mantiene; abierto |
| Reglas de Meta que el spec no recoge: variable al principio o al final (2388299), proporción variables/palabras (2388293) | Nuevas | **No** se añaden al validador (cambiarían R10). Meta las rechaza ⇒ rechazo genérico (`WhatsappTemplateRejectedError`). Abierto para QC-243 |
| §3.2 idiomas (71 códigos) | **Corregido**: Meta lista 111. No sobra ninguno; faltan 40: ar_EG ar_AE ar_LB ar_MA ar_QA be_BY bn_IN prs_AF nl_BE en_AE en_AU en_CA en_GH en_IE en_IN en_JM en_MY en_NZ en_QA en_SG en_UG en_ZA fr_BE fr_CA fr_CH fr_CI fr_MA de_AT de_CH ps_AF si_LK es_CL es_CO es_CR es_DO es_EC es_HN es_PA es_PE es_UY | Se usa la lista vigente de 111. R8 apunta a «la lista de §3.2 [POR CONFIRMAR]»: es la corrección que pedía el contraste, no cambia el alcance |
| §6 crear: `POST …/message_templates` `{name, language, category, components}` ⇒ `{id, status, category}`; forma de componentes de §3.4 | Confirmado (idéntica al ejemplo de Meta) | Sin cambio |
| §6 listar: `fields`, `after`, `{data, paging:{cursors, next}}` | Confirmado | Sin cambio |
| §6 `limit=100` | Máximo no documentado (solo «min 1») | Se mantiene 100; abierto |
| §3.5 `rejected_reason` `NONE` ⇒ `null` | `NONE` está en su enum; no se dice expresamente que sea «sin rechazo» | Sin cambio (ya se guarda solo con `REJECTED`) |
| Estados | API: APPROVED ARCHIVED DELETED DISABLED IN_APPEAL LIMIT_EXCEEDED PAUSED PENDING PENDING_DELETION REJECTED | Sin cambio: los 5 conocidos + `OTHER` con su valor (R4) |
| §6 borrar `DELETE …?hsm_id&name` ⇒ `{success:true}`, solo ese idioma | Confirmado. Además: DISABLED no se puede borrar; nombre de una APPROVED bloqueado 30 días | Sin cambio: esos rechazos caen en `WhatsappMetaRejectedError` |
| §4.9 nombre repetido: `error_subcode` 2388024 | Confirmado (code 100, «Content in This Language Already Exists») | Sin cambio |
| §4.9 límite de creaciones: `code` 80008 o subcode 23880xx | 80008 confirmado como límite de llamadas a la WABA (general, no específico de plantillas). Subcode 23880xx específico: no encontrado. Límite: 100 plantillas por hora | Se mapea solo `code` 80008 ⇒ `WhatsappTemplateRateLimitedError`; sin rango de subcodes |
| §6 forma del error `{error:{message, code, error_subcode}}` | Confirmado (además type, error_user_msg, fbtrace_id) | Sin cambio |
| §7.1 `message_template_status_update` `{event, message_template_id, …, reason}` | Confirmado. `event` añade UNARCHIVED, FLAGGED, LOCKED, REINSTATED. `reason` puede ser `"NONE"` o `null` | `event` desconocido ⇒ `OTHER` (R4). `reason` acepta `null` |
| §7.1 `template_category_update` | Confirmado con dos formas: aviso previo `{…, correct_category, new_category (= la actual)}` y cambio hecho `{previous_category, new_category}` | Se lee `new_category` en ambas; `previous_category` opcional y campos extra pasan |
| §7.1 `entry[].id` = WABA | Confirmado | Sin cambio |
| Idioma en webhooks `en-US` (con guion) | Nuevo | Sin efecto: los cambios se cruzan por `metaTemplateId` (§5.2) |

Ninguna diferencia cambia un requisito: no hay preguntas que bloqueen.

## Entorno del worktree

Sin `.env` ni base de test. Consecuencias:
- `prisma validate` y `generate` se corren con `DATABASE_URL`/`DIRECT_URL` ficticias (solo las lee
  el datasource).
- La migración no se aplicó ni se revirtió en local, y los `.int.test.ts` no corren aquí: los corre
  CI (`gate-completo`).
- `vitest related` corre con `--project node --project ui`; el proyecto `integration` exige
  `DATABASE_URL` en su global setup. Sobre `errores/domain/*`, `related` arrastra casi toda la
  suite (todo importa `errores`) y pasó de 500 s: para esos archivos se corren directamente los
  tests afectados.

## Tanda 1 — T1, T2

Archivos:
- `db/schema.prisma`: enums `WhatsappTemplateCategory` y `WhatsappTemplateStatus`, modelo
  `WhatsappTemplate` y `templatesSyncedAt`.
- `db/migrations/20261020120000_whatsapp_templates/{migration,down}.sql`
- `lib/modules/errores/domain/error-codes.ts` y `error-catalog.ts`: 6 códigos.
- `lib/modules/integraciones/domain/errors.ts`: 6 clases.
- `lib/modules/integraciones/index.ts`: exporta las 6 clases.
- `tests/unit/errores/catalogo.test.ts`
- `tests/unit/integraciones/module-shape.test.ts`: exportaciones nuevas; 6 modelos de integraciones.

Salida:
```
prisma validate          -> The schema at db\schema.prisma is valid
prisma generate          -> ok
pnpm run typecheck       -> sin errores
pnpm run lint            -> 0 errors, 10 warnings (preexistentes)
vitest run catalogo.test.ts module-shape.test.ts -> Test Files 2 passed (2); Tests 162 passed | 1 skipped (163)
vitest run guard-empresa-en-esquema -> Test Files 1 passed; Tests 15 passed
vitest run guard-rls-force          -> Test Files 1 passed; Tests 4 passed
```

## Tanda 2 — T3, T4, T5, T6 (backend_dev)

Archivos (todos en `lib/modules/integraciones/domain/` salvo tests):
- nuevos: `whatsapp-template.ts`, `whatsapp-template-languages.ts` (111 códigos),
  `whatsapp-template-draft.ts`, `whatsapp-template-components.ts`, `whatsapp-template-meta.ts`,
  `template-sync-plan.ts`, `template-graph-failure.ts`
- `graph-failure.ts`: `code?` y `subcode?` opcionales (`number | null`).
- tests nuevos en `tests/unit/integraciones/whatsapp/templates/`: `whatsapp-template-draft`,
  `whatsapp-template-components`, `whatsapp-template-meta`, `template-sync-plan`,
  `template-graph-failure` (`.test.ts`).
- `tests/unit/integraciones/module-shape.test.ts`: 7 archivos nuevos en la lista; caso R6 de pureza
  del validador (solo `zod` y `./` de domain, recorriendo sus imports).
- `tests/guards/guard-identificador-de-request.test.ts`: la migración de T1 en la lista esperada
  (estaba roja desde T1).
- `index.ts` sin tocar (ningún test lo exige todavía).

Decisiones no escritas en el spec (abiertas para revisión):
- El validador rechaza U+0000 en cualquier texto (`invalid_chars`): llegaría a Meta y la base no lo guarda.
- `header`/`footer` ausentes = `null`; `buttons` y `body.examples` ausentes = `[]`.
- Plan: un `metaTemplateId` repetido en la lista se toma una vez (el primero).
- Recuento real del contraste: la lista del spec tenía 71 códigos y se añaden 40 (total 111, igual).

R → test (archivos de `templates/` salvo indicación):
- R4: draft `statusOf > R4: …` (2) y meta `R4: IN_APPEAL da OTHER…`
- R6: draft `R6: …` (4) y module-shape `R6: el validador … solo usan zod…`
- R7–R13: draft `describe('R7'…'R13')`, un caso por fila en el límite y límite+1
- R19: graph-failure `R19: …` (5)
- R21: graph-failure `R21: …` (3)
- R23–R25: sync-plan tabla `R23/R24/R25: …` y meta `R23: …`
- R26: meta `R26: …` (3)
- R43: graph-failure `R43: …` (2)
- R46: components `R46: …` (5)

Salida:
```
pnpm run typecheck -> tsc --noEmit sin errores
pnpm run lint      -> 0 errors, 10 warnings (preexistentes)
vitest run templates/ graph-failure module-shape -> Test Files 7 passed (7); Tests 175 passed | 1 skipped
vitest run create-whatsapp-connection test-and-enable update-whatsapp-connection -> 3 passed; 53 passed
vitest run guard -> 1 failed (guard-identificador: migración de T1 sin listar) -> corregido;
vitest run guard-identificador-de-request -> 23 passed
```
Veredicto: T3–T6 hechos y verdes.

## Tanda 3 — T7, T8, T9 (backend_dev)

Archivos:
- nuevos: `lib/modules/integraciones/ports/whatsapp-template-repository.ts` (8 métodos, `NewCreatedTemplateRow`,
  `TemplateSyncRow`), `adapters/driven/persistence/whatsapp-template-prisma.ts`,
  `tests/unit/integraciones/whatsapp/templates/whatsapp-graph-client-templates.test.ts`,
  `…/templates/whatsapp-graph-client-canned-templates.test.ts`,
  `tests/integration/integraciones/whatsapp-template-prisma.int.test.ts`,
  `tests/integration/integraciones/whatsapp-template-migration.int.test.ts`
- `ports/whatsapp-graph-client.ts`: `createTemplate`, `listTemplatesPage`, `deleteTemplate` y sus tipos de resultado.
- `domain/whatsapp-template.ts`: tipo `TemplateWebhookUpdate` (§7.2), lo necesita el puerto antes que el parser.
- `domain/whatsapp-connection.ts` y `persistence/whatsapp-connection-prisma.ts`: `templatesSyncedAt` en record y select
  (la vista no lo expone; `connection-view.test.ts` lo pone no nulo para que el test de claves exactas lo vigile).
- `adapters/driven/graph/whatsapp-graph-client-fetch.ts`: las 3 llamadas; `fetchPhoneNumber` pasa por el mismo
  `callGraph` sin cambiar su comportamiento. `…-canned.ts`: mapa en memoria, `resetCannedTemplates`, `e2e_repetida`.
- `persistence/company-scope.ts`: `whatsappTemplateCompanyScope`.
- `lib/composition/index.ts` (mínimo): las 3 llamadas de Graph con la misma elección por llamada,
  `whatsappTemplateRepository` cableado y `templates` en `whatsappDeps` (la guardia de ámbito lee el cableado).
- `tests/guards/guard-ambito-empresa-integraciones.test.ts`: tercer puerto (8 métodos), quinta envoltura, describe R3 de
  escrituras de plantillas y 3 casos de sensibilidad. Endurecida: `TOCA_LA_BASE` ve también `prisma.$queryRaw` como
  plantilla etiquetada (antes no lo veía).
- `tests/unit/integraciones/whatsapp/whatsapp-doubles.ts`: `makeGraph` con los 3 métodos; `makeTemplateRepository`,
  `storedTemplate`; `templatesSyncedAt: null` en los records.
- `tests/unit/integraciones/module-shape.test.ts`: los 2 archivos nuevos en la lista.
- `tests/integration/aislamiento.json`: migración en `transaccion`, prisma en `commit` con motivo.
- `tests/integration/integraciones/whatsapp-connection-prisma.int.test.ts`: `templatesSyncedAt: null` en el `toEqual`
  del record (si no, CI rojo).

Decisiones / desvíos (abiertos para revisión):
- `insertCreated` usa `prisma.$queryRaw` (una sentencia) en vez de `tx.$queryRaw`: una transacción para un solo
  `INSERT … ON CONFLICT` no añade nada. El `DO UPDATE` lleva `WHERE company_id = EXCLUDED.company_id`; sin fila
  devuelta lanza. El 23505 del parcial se reconoce por SQLSTATE + nombre del índice.
- `applySync` usa `$transaction([...])` por lotes; las `updates` sin cambio van en un solo `updateMany` que solo pone
  `lastSyncedAt`.
- `listTemplatesPage`: `paging.next` sin `cursors.after` ⇒ `rejected` (cortar dejaría la lista a medias y la
  sincronización borraría lo que falta). El spec no lo dice.
- Doble canned: `deleteTemplate` es idempotente (`ok` aunque no exista); la lista no refleja un `APPROVED` llegado por
  webhook, así que una sincronización en el E2E de QC-243 devolvería la plantilla a `PENDING`. Abierto para QC-243.
- `NewCreatedTemplateRow.category` es `WhatsappTemplateCategory` (Meta puede reclasificar al crear).

R → test:
- R1: prisma.int `R1 — el alta guarda…`, `R1 — la base rechaza…`, `R1 — el alta con el ambito de otra empresa…`;
  migration.int `R1 R50: la FK compuesta…`
- R2: prisma.int `describe R2` (4 casos)
- R3: prisma.int `describe R3` (3) y `lectura de las vivas` (2); guardia `R3 — las escrituras de plantillas…` (5) y
  `R3 — sensibilidad…` (3); guardia `R2 — cada metodo de WhatsappTemplateRepository…` (10)
- R22: prisma.int `R22 — si un paso falla no queda nada escrito…`
- R23: prisma.int `R23 — importa sin creador…`, `R23 R24 — una borrada y vuelta a crear…`, carrera `R23 — si la sincronizacion ya inserto…`
- R24: prisma.int `R24 — marca eliminadas…`
- R25: prisma.int `R25 — anota la hora…`
- R27: `whatsapp-graph-client-templates.test.ts` (describe R27, 2) y `…-canned-templates.test.ts` (6)
- R36: prisma.int `R36 — el estado y el motivo…`
- R37: prisma.int `R37 — la categoria nueva…`
- R50: migration.int (5)

Salida:
```
pnpm run typecheck -> tsc --noEmit sin errores
pnpm run lint      -> 0 errors, 10 warnings (preexistentes)
vitest run tests/unit/integraciones/whatsapp/ module-shape integraciones-graph-doubles -> Test Files 28 passed (28); Tests 579 passed | 1 skipped
vitest run guard-ambito-empresa-integraciones -> Test Files 1 passed; Tests 57 passed
vitest run guard   -> Test Files 83 passed (83); Tests 1161 passed | 21 skipped
.int.test.ts       -> no corridos (sin base en el worktree); los corre CI
```
Veredicto: T7–T9 hechos; unit y guardias verdes, integración pendiente de CI.

## Tanda 4 — T10, T11 (backend_dev)

Archivos:
- nuevos en `lib/modules/integraciones/domain/`: `template-connection.ts` (`requireTemplateConnection`,
  `templateFailureSecrets`), `create-whatsapp-template.ts`, `delete-whatsapp-template.ts`,
  `list-whatsapp-templates.ts` (`createListWhatsappTemplates`, `createGetWhatsappTemplate`,
  `toWhatsappTemplateView`, `isWhatsappTemplateId`), `sync-whatsapp-templates.ts` (`syncConnectionTemplates`,
  `createSyncWhatsappTemplates`, `createResyncWhatsappTemplates`, `MAX_TEMPLATE_PAGES = 20`).
- tests nuevos en `tests/unit/integraciones/whatsapp/templates/`: `create-whatsapp-template.test.ts`,
  `delete-whatsapp-template.test.ts`, `list-whatsapp-templates.test.ts`, `sync-whatsapp-templates.test.ts` y el
  montaje común `template-use-case-setup.ts` (dobles que explotan si los llaman, borrador válido).
- `tests/unit/integraciones/module-shape.test.ts`: los 5 archivos nuevos en la lista.
- `index.ts` y `lib/composition` sin tocar (T15); typecheck no lo exige.

Decisiones / desvíos (abiertos para revisión):
- `syncConnectionTemplates` recibe `cipher` en `deps` además de `graph`, `templates` y `now` (§4.2 no lo lista): §4.1.3
  pide tachar también el App Secret del texto de Meta leyéndolo con `readStoredSecret` solo si hay fallo. T12 tiene que
  pasarlo (ya lo tiene). Si el App Secret no se puede leer, se tacha solo el token (sin escribir en la conexión).
- `toWhatsappTemplateView` vive en `list-whatsapp-templates.ts` (como dice §4.6); en `whatsapp-template.ts` crearía un
  ciclo de imports (`components` → `draft` → `whatsapp-template`).
- Crear: una categoría de Meta ausente o desconocida deja la pedida (`categoryOf(res.category) ?? draft.category`).
  El diagnóstico de `ValidationError` lleva `campo:código` de cada problema.
- Eliminar: si `markDeleted` da `false` tras el `ok` de Meta (otra petición la marcó en medio) se devuelve `{ id }`
  igual: Meta ya la borró. El spec no lo dice.
- Consultar exige conexión viva (habilitada o no), igual que listar; leer no toca Meta.
- Resumen de la sincronización: `deleted` sale del plan. El adaptador no borra lo creado desde `startedAt` (R24) y
  `applySync` devuelve `void`, así que en esa carrera el conteo puede pasar en 1 al real. Abierto (cambiaría el puerto).
- Reintento: no lanza nunca; cualquier excepción (directorio, base, Graph, secreto) vuelve como
  `{ kind: 'failed', code }` con el código del catálogo o `unexpected`, nunca el mensaje.

R → test (todos en `templates/`):
- R5: create `R5: %s rechaza…` (3), delete `R5: …` (3), list `R5: listar…` (3) y `R5: consultar…` (2), sync `R5: …` (3);
  dobles que explotan: ningún puerto llamado
- R14: create `R14: un borrador invalido…`, `R14 R6: aplica el validador…`
- R15: create (3), delete (2), sync `sincronizar a mano > R15` (2)
- R16: create `R16: manda a Meta…`, `R16: nace PENDING…`, `R16: una conexion %s sirve…` (2)
- R17: create `R17: …` (2)
- R18: create `R18: …` (2)
- R19: create `R19: %s responde su codigo…` (4, una por fila de §4.9)
- R20: create, delete y sync `R20: un token ilegible…`; sync `R38 R20`
- R21: create `R21: …` (2), delete `R21: …`, sync `R22 R21: …`
- R22: sync `R22 R23 R25: lee las tres paginas…`, `R22: si falla la segunda…`, `R22: …tope de paginas`, `R22: …escritura`
- R23, R25: sync `R22 R23 R25: …` (el resto, en `template-sync-plan.test.ts` y la integración de T9)
- R24: sync `R24: marca eliminadas…`
- R26: sync `R26: salta las que no se pueden interpretar…`
- R27: sync `R27: nunca llama a crear ni a borrar…` (espía + `@ts-expect-error` sobre el tipo)
- R28: sync `R28: sincroniza la conexion viva…`
- R38: sync `describe reintento del webhook` (8: synced, 3 skipped, no UUID, failed de Meta, secreto, unexpected, directorio)
- R42: delete `R42: pide a Meta borrar por hsm_id…`
- R43: delete `R43: un id que no es UUID…`, `R43: si %s…` (4), `R43: si Meta %s…` (2)
- R44: list `R44: …` (7)
- R45: list `R45: …` (7)
- R46: list `R46: …` (3)

Salida:
```
pnpm run typecheck -> tsc --noEmit sin errores
pnpm run lint      -> 0 errors, 10 warnings (preexistentes)
vitest run tests/unit/integraciones/whatsapp/templates/ tests/unit/integraciones/module-shape.test.ts
                   -> Test Files 12 passed (12); Tests 289 passed | 1 skipped (290)
vitest run guard   -> Test Files 83 passed (83); Tests 1161 passed | 21 skipped (1182)
```
Veredicto: T10 y T11 hechos y verdes; sin cablear en composición ni contrato (T15).

## Tanda 5 — T12, T13, T14 (backend_dev)

Archivos:
- nuevos en `lib/modules/integraciones/domain/`: `sync-all-whatsapp-templates.ts` (`createSyncAllWhatsappTemplates`,
  `SyncAllResult`, `SyncAllFailure`), `whatsapp-template-webhook.ts` (`interpretTemplateChange`,
  `isTemplateWebhookField`, `TEMPLATE_REJECTED_REASON_MAX_LENGTH = 500`).
- `domain/create-whatsapp-connection.ts`: deps con `templates`; tras `connections.create` corre
  `syncConnectionTemplates` con el token del formulario; resultado `created` con `templateImport`.
- `domain/sync-whatsapp-templates.ts`: el `codeOf` privado pasa a exportarse como `syncFailureCodeOf` (lo usan el
  reintento, el alta y el cron; sin triplicarlo).
- `domain/whatsapp-webhook-payload.ts`: firma `parseWhatsappWebhook(json, phoneNumberId, wabaId)`; `templateUpdates` y
  `skipped.templates` en `InboundBatch`.
- `domain/receive-whatsapp-webhook.ts`: deps con `templates`; `applyWebhookUpdates` tras `inbox.record` solo si hay
  cambios; `skipped.templates` y `followUp: 'resync_templates' | null` en `stored`.
- `adapters/driving/whatsapp-connection-actions.ts`: `console.error('whatsapp_templates_initial_sync_failed',
  { connectionId, code })` si `templateImport.ok === false`.
- `lib/composition/index.ts` (mínimo para compilar): `templates` en `whatsappWebhookDeps`. El alta ya lo recibía
  (`whatsappDeps`). La ruta del webhook no cambia (el `after` es T18).
- tests: `templates/sync-all-whatsapp-templates.test.ts` (nuevo); ampliados `create-whatsapp-connection.test.ts`,
  `whatsapp-connection-actions.test.ts`, `whatsapp-webhook-payload.test.ts`, `receive-whatsapp-webhook.test.ts`;
  `module-shape.test.ts` (2 archivos nuevos en la lista); `authorization.test.ts` (deps con `templates`, que también
  explotan si los llaman).
- integración (solo para compilar; no corren aquí): `whatsapp-connection-prisma.int.test.ts` (el alta del R9 recibe el
  repositorio real de plantillas: con el doble `canned` sincroniza contra la base) y `whatsapp-inbox-prisma.int.test.ts`
  (`templateUpdates: []`, `skipped.templates: 0` en el lote).

Tests de QC-237/QC-238 tensados (no relajados): los `toEqual` del resultado `stored` y de `skipped` llevan ahora
`templates: 0` y `followUp: null`; `parseSpy` se espera con la WABA; el R14 de QC-238 usa `account_update` como campo
ajeno (antes usaba `message_template_status_update`, que ahora sí se procesa).

Decisiones / desvíos (abiertos para revisión):
- Cron: `integrations.isOn` y `connections.findLive` van **dentro** del `try` por empresa (§4.8 solo nombra
  `decryptStoredSecret` y `syncConnectionTemplates`): un fallo leyendo el añadido o la conexión de una empresa queda como
  `stage: 'connection'` con su `companyId` y el cron sigue (R33), en vez de tumbar la vuelta entera.
- Cron: `graph` se tipa `SyncTemplatesGraph` (solo `listTemplatesPage`), como el núcleo.
- Webhook: un `message_template_id` numérico que no es entero seguro (> 2^53) se salta (R41): `JSON.parse` ya lo cambió
  y cruzarlo podría tocar otra plantilla. Un texto de dígitos se acepta tal cual. Cero delante (`'0123'`) se salta por
  la regla `/^[1-9]\d*$/` de §7.2.
- Webhook: `reason` vacío, solo espacios, `"NONE"`, `null` o ausente ⇒ `null`; si no, se guarda tal cual recortado a 500
  puntos de código (sin `trim`). Con un estado distinto de `REJECTED`, `null` aunque Meta mande motivo (R36).
- Webhook: un `entry` sin `id` no se toma por la WABA ⇒ salto con conteo (R39).
- Webhook: se rechaza U+0000 en `event`, `reason`, `message_template_name` y `message_template_language` (R41); en
  categoría basta con que no sea una de las tres.
- Alta: `syncConnectionTemplates` recibe `{ ...deps, now }`; el reloj del alta es el mismo de la sincronización.
- La ruta del webhook aún no registra `skipped.templates` en su línea de saltos ni usa `followUp` (T18).

R → test:
- R29: create-connection `R29: tras guardar la conexion sincroniza…`, `R29: no vuelve a descifrar…`,
  `R29: una prueba fallida no crea la conexion ni toca las plantillas`
- R30: create-connection `R30: si %s la conexion queda creada…` (2), `R30: un fallo al escribir…`;
  actions `R30 — el alta con la importacion de plantillas fallida…`, `R30 — con la importacion bien no se escribe ningun log`
- R32: sync-all `R32: sincroniza la conexion ACTIVE…`, `R32: no sincroniza una conexion %s…` (3),
  `R32: una empresa con el anadido apagado…`, `R32: una empresa sin conexion viva…`, `R32: recorre las empresas de una en una…`
  (cada `findLive` con el ámbito de una sola empresa; `findLiveById` nunca), `R27 R32: el cron nunca crea ni borra…`
- R33: sync-all `R33: si falla la segunda conexion sigue con la tercera…`, `R33: el fallo no lleva el mensaje…`,
  `R33: un token ilegible…`, `R33: un fallo al escribir o al leer el anadido…`, `R33: un fallo al listar las empresas…`,
  `R33: con el presupuesto agotado…` (el 500/200 y la línea de log son de la ruta, T16)
- R36: payload `R36: un cambio de estado…`, `R36: REJECTED guarda el motivo…`, `R36: con un estado que no es REJECTED…`,
  `R36 R4: el evento %s se guarda como OTHER…` (5); receive `R36: un APPROVED…`, `R36: REJECTED guarda el motivo; R37: …`
- R37: payload `R37: el cambio de categoria hecho…`, `R37: el aviso previo…`; receive `R36: …; R37: la categoria nueva se guarda`
- R38: receive `R38: un id que no esta en la copia local pide resincronizar, una sola vez…`, `R38: recibir no sincroniza…`
  (el `after` y que el fallo no cambie la respuesta, T18)
- R39: payload `R39: un cambio de otra WABA…`, `R39: un entry sin id…`, `R39: %s se salta con conteo` (6); receive
  `R39 R41: lo saltado de otra WABA o ilegible…`, `R39: la WABA que se compara es la de la conexion guardada`
- R40: receive `R40: un POST con mensajes y cambios de plantillas guarda los dos`, `R40: si falla guardar los cambios…`,
  `R40: sin cambios de plantillas no se llama al repositorio…`
- R41: payload `R41: un cambio de estado con %s se salta…` (9), `R41: un id de texto con digitos…`; receive `R39 R41: …`
- R14 (QC-238): payload `R14: un change de otro field…` con `account_update`, `R14: los cambios de plantillas no cuentan…`

Salida:
```
pnpm run typecheck -> tsc --noEmit sin errores (antes del ajuste: authorization.test.ts y los dos .int.test.ts sin `templates`)
pnpm run lint      -> 0 errors, 10 warnings (preexistentes)
vitest run tests/unit/integraciones/whatsapp/ tests/unit/integraciones/module-shape.test.ts
                   -> Test Files 32 passed (32); Tests 718 passed | 1 skipped (719)
vitest run guard   -> Test Files 83 passed (83); Tests 1161 passed | 21 skipped (1182)
.int.test.ts       -> no corridos (sin base en el worktree); los corre CI
```
Veredicto: T12, T13 y T14 hechos; unit y guardias verdes, integración pendiente de CI; la ruta del webhook sin `after` (T18).

## Tanda 6 — T15-T18

backend_dev escribió el código y lo detuvo el leader (3 h sin cerrar, ya en T18). El implementer
revisó lo que dejó en el worktree, lo verificó y cerró dos rojos mecánicos en tests.

Archivos:
- `lib/composition/index.ts`: casos de uso de plantillas, `syncAllWhatsappTemplates` y
  `verifyCronSecret` en `integraciones`, como en §10.
- `lib/modules/integraciones/index.ts`: contrato de §11.
- `adapters/driving/whatsapp-template-actions.ts`: Server Actions (§9).
- `adapters/driving/whatsapp-template-cron-route.ts`, `app/api/cron/sincronizar-plantillas-whatsapp/route.ts` y `vercel.json` con `0 8 * * *`.
- `adapters/driving/whatsapp-webhook-route.ts`: `after` con `followUp`, log
  `whatsapp_templates_resync_failed` y `templates` en el log de saltos.
- Tests:
  - nuevos: `templates/whatsapp-template-actions.test.ts` y `templates/whatsapp-template-cron-route.test.ts`;
  - ampliados: `whatsapp-webhook-route.test.ts`, `module-shape.test.ts`, `tests/unit/pedidos/vercel-cron.test.ts`, `tests/unit/identity/session-once-per-request-actions.test.ts` y `tests/guards/guard-rutas-fuera-de-sesion.test.ts`;
  - tensados por el implementer: `tests/unit/composition/integraciones-graph-doubles.test.ts` y `tests/unit/integraciones/encryption-keys-env.test.ts`. La lista exacta de la fachada suma los 8 miembros nuevos. En `module-shape`, `WHATSAPP_TEMPLATE_LANGUAGES` pasa a su sitio según `.sort()`.

Salida:
```
pnpm run typecheck -> sin errores
pnpm run lint      -> 0 errors, 10 warnings (preexistentes)
vitest run whatsapp-webhook-route, template-actions, template-cron-route, module-shape, vercel-cron, session-once-per-request-actions
                   -> 1 failed | 5 passed (orden en module-shape); tras el arreglo module-shape: 104 passed | 1 skipped
vitest run --project node tests/unit/integraciones/ tests/unit/composition/
                   -> 2 failed | 54 passed (listas de la fachada); tras el arreglo esos dos: 33 passed
vitest run guard   -> Test Files 83 passed; Tests 1162 passed | 21 skipped
```

R<n> -> test:
- R5: `whatsapp-template-actions.test.ts`, 3 casos «R5: …» (actor de la sesión, sin sesión ⇒ unauthorized, sin permiso ⇒ unauthorized).
- R31: `whatsapp-template-cron-route.test.ts`, 3 casos «R31: …» (sin cabecera, secreto incorrecto, CRON_SECRET sin definir).
- R33: `whatsapp-template-cron-route.test.ts`, 3 casos «R33: …».
- R34: `tests/unit/pedidos/vercel-cron.test.ts`, 2 casos «R34: …» (una tarea a la ruta, a las 08:00).
- R35: `whatsapp-template-cron-route.test.ts`, «reexporta solo GET…» y «declara runtime y maxDuration como literales…», más `guard-rutas-fuera-de-sesion` con la ruta nueva.
- R38: `whatsapp-webhook-route.test.ts`: «R38: con followUp ⇒ 200 y after llamado UNA vez…», «R38: sin followUp after no se llama…» y el caso del fallo de la resincronización (log `whatsapp_templates_resync_failed`, 200 igual).
- R39: `whatsapp-webhook-route.test.ts`, «R39: stored con solo cambios de plantillas saltados…».
- R40: `whatsapp-webhook-route.test.ts`, 2 casos «R40: …».
- R47: `whatsapp-template-actions.test.ts`, 8 casos «R47: …»; `module-shape.test.ts` «R20: el contrato reexporta exactamente…».
- R48: `whatsapp-template-actions.test.ts`, 6 casos «R48: …».

## Tanda 7 — T19 (frontend_dev)

Archivos:
- `app/(private)/integraciones/whatsapp/components/whatsapp-setup-guide.tsx`: el paso del webhook,
  al final de `WHATSAPP_SETUP_GUIDE_STEPS`.
- `tests/unit/integraciones-ui/whatsapp-page.test.tsx`

Salida:
```
pnpm run typecheck -> sin errores
pnpm run lint      -> 0 errors, 10 warnings (preexistentes)
vitest run tests/unit/integraciones-ui/ -> Test Files 9 passed; Tests 131 passed
```

R49 -> `whatsapp-page.test.tsx` «R49: la guia incluye un paso que pide suscribir messages, message_template_status_update y template_category_update».

## Tanda 8 — T20, T21 (cierre)

Archivos:
- `tests/integration/integraciones/whatsapp-template-flow.int.test.ts`, más su entrada `commit` en
  `tests/integration/aislamiento.json`. Usa la fachada real, el `POST` firmado, el doble `canned`
  (`INTEGRATIONS_E2E_DOUBLES=1`) y `after` mockeado como cola. **No se ha ejecutado**: no hay base
  en el worktree; lo corre CI.
- `tests/guards/guard-qc242-limites-de-la-ficha.test.ts`: R52. El diff contra el merge-base no toca
  `package.json`, `pnpm-lock.yaml` ni `.env.example`. Mismo patrón que el de QC-238.

Salida:
```
pnpm run typecheck / lint (T20 y la guardia) -> sin errores / 0 errors, 10 warnings preexistentes
vitest run guard-aislamiento -> 6 passed
vitest run guard-qc242       -> 4 passed (la rama es la de la ficha: el caso del diff corrió de verdad)
vitest run guard             -> Test Files 84 passed (84); Tests 1166 passed | 21 skipped (1187)
git diff 66dc2f13 -- package.json .env.example pnpm-lock.yaml -> vacío
./init.sh (rápido), cortado a los 295 s por la regla de los 5 min:
  ✓ node, dependencias, fichas, assignee, cupo, specs, perfil, cliente Prisma, tipos de ruta
  ✓ typecheck paso
  ✓ lint paso (0 errors, 10 warnings)
  ✗ test:rapido no terminó: `vitest related` sobre `errores/domain/*` y `lib/composition/index.ts`
    arrastra casi toda la suite, e incluye los `.int` que exigen DATABASE_URL. Queda para
    `gate-completo` en CI.
```

## Mapa R<n> -> test (consolidado)

Detalle caso a caso en cada tanda. Todos los R1–R52 tienen al menos un caso con su `R<n>` en el
nombre, dentro de los archivos de test que toca esta rama (comprobado con grep sobre el diff).

| R | Test |
|---|---|
| R1, R2 | `whatsapp-template-prisma.int.test.ts` («R1 — …», `describe R2`); `whatsapp-template-migration.int.test.ts` «R1 R50: …» |
| R3 | `whatsapp-template-prisma.int.test.ts` `describe R3`; `guard-ambito-empresa-integraciones.test.ts` «R3 — …» y su sensibilidad |
| R4 | `whatsapp-template-draft.test.ts`, `whatsapp-template-meta.test.ts` («R4: IN_APPEAL da OTHER…») |
| R5 | create/delete/list/sync-whatsapp-templates.test.ts «R5: …»; `whatsapp-template-actions.test.ts` «R5: …» |
| R6–R13 | `whatsapp-template-draft.test.ts` (`describe R6`…`R13`, límite y límite+1); `module-shape.test.ts` caso R6 |
| R14–R21 | `create-whatsapp-template.test.ts`; R15/R20/R21 también delete y sync; R19/R21 en `template-graph-failure.test.ts`; R14 R17 en `whatsapp-template-flow.int.test.ts` |
| R22–R28 | `sync-whatsapp-templates.test.ts`; R23–R25 en `template-sync-plan.test.ts` y `whatsapp-template-prisma.int.test.ts`; R26 en meta; R27 en los dos tests del cliente Graph |
| R29, R30 | `create-whatsapp-connection.test.ts` «importacion de plantillas»; `whatsapp-connection-actions.test.ts` |
| R31, R33, R35 | `whatsapp-template-cron-route.test.ts`; R32 R33 `sync-all-whatsapp-templates.test.ts` |
| R34 | `tests/unit/pedidos/vercel-cron.test.ts` «R34: …» |
| R36, R37, R39, R41 | `whatsapp-webhook-payload.test.ts` «cambios de plantillas»; `receive-whatsapp-webhook.test.ts`; R36 R37 en `whatsapp-template-prisma.int` y `whatsapp-template-flow.int` |
| R38, R40 | `receive-whatsapp-webhook.test.ts`, `whatsapp-webhook-route.test.ts`, `sync-whatsapp-templates.test.ts` (reintento), `whatsapp-template-flow.int.test.ts` |
| R42, R43 | `delete-whatsapp-template.test.ts`; R43 en `template-graph-failure.test.ts`; R42 en `whatsapp-template-flow.int.test.ts` |
| R44–R46 | `list-whatsapp-templates.test.ts`; R46 en `whatsapp-template-components.test.ts` |
| R47, R48 | `whatsapp-template-actions.test.ts`; R47 en `module-shape.test.ts` (contrato) |
| R49 | `whatsapp-page.test.tsx` «R49: …» |
| R50 | `whatsapp-template-migration.int.test.ts` (5 casos); `guard-rls-force` |
| R51 | `tests/unit/errores/catalogo.test.ts` |
| R52 | `guard-qc242-limites-de-la-ficha.test.ts` (4 casos «R52: …») |

## Abierto para el reviewer y el leader

- Los `.int` nuevos (`whatsapp-template-prisma`, `-migration`, `-flow`) y los dos `.int` ajustados
  (`whatsapp-connection-prisma`, `whatsapp-inbox-prisma`) **no se han corrido**: no hay base.
- La migración no se aplicó ni se revirtió en local.
- El límite de crons del plan de Vercel (P9) sigue [POR CONFIRMAR].
- Desvíos que anotó cada tanda: alta sin transacción y cursor sin `after` (tanda 3);
  `syncConnectionTemplates` con `cipher` y el conteo `deleted` en una carrera (tanda 4); el cron
  con `isOn`/`findLive` dentro del `try` (tanda 5); U+0000 rechazado en el validador (tanda 2).
  Para QC-243: el doble `canned` no refleja un `APPROVED` llegado por webhook.

## Rojo de CI, PR #281

- **Fallo:** run 39486830175, shard 3 — `whatsapp-template-prisma.int.test.ts > R2 — dos vivas con la misma conexion, nombre e idioma no entran` recibia un `PrismaClientKnownRequestError` en vez de `WhatsappTemplateNameTakenError`.
- **Causa:** el traductor solo reconocia SQLSTATE `23505` (de `meta.code`) con el nombre del indice en el texto; Prisma 6.19.3 da `P2002` para el `$queryRaw` y, en un indice unico parcial de SQL crudo, pone las COLUMNAS en `meta.target` (`["connection_id","name","language"]`), no el nombre del indice (mismo hallazgo que `user-admin-prisma.ts`).
- **Arreglo:** `isNameLanguageTaken` (ahora exportada) acepta `P2002` cuyo `meta.target` incluya `name` y `language`, o el nombre `whatsapp_templates_name_language_live_key`; conserva la via `P2010`/`23505` por texto. El otro unico, `(connection_id, meta_template_id)`, no lleva esas columnas y no se confunde (ademas lo absorbe el `ON CONFLICT`). `applyWhatsappTemplateSync` no traduce P2002 (usa `skipDuplicates`).
- **Archivos:** `lib/modules/integraciones/adapters/driven/persistence/whatsapp-template-prisma.ts`; nuevo `tests/unit/integraciones/whatsapp/templates/whatsapp-template-prisma-errors.test.ts`.
- **R2 → test:** `whatsapp-template-prisma-errors.test.ts > R2: el unico parcial de nombre e idioma...` (6 casos, sin base), ademas del `.int` existente.
- **Salida:** `pnpm exec vitest run <test unitario>` → 1 file, 6 passed. `pnpm typecheck` → limpio. `pnpm lint` → 0 errores, 10 warnings preexistentes ajenos.
- **Veredicto:** traduccion corregida; el `.int` se confirma en CI (no hay base local).

### Segunda vuelta: forma medida (run 39489484672 seguia rojo)

- **El arreglo fe812453 se adivino y no cerro el rojo.** La forma se midio contra el Postgres local con un `console.log` temporal en el `catch` de `insertCreatedWhatsappTemplate` (ya borrado, no commiteado).
- **Forma medida:** `PrismaClientKnownRequestError`, `code: 'P2010'`, `meta: { code: '23505', message: 'Key (connection_id, name, language)=(<uuid>, duplicada, es) already exists.' }`; `message`: ``Invalid `prisma.$queryRaw()` invocation: ... Raw query failed. Code: `23505`. Message: `Key (connection_id, name, language)=(...) already exists.` ``. **No** hay `meta.target` ni el nombre del indice en ningun campo.
- **Causa:** el traductor si se ejecutaba (el `catch` no envuelve ni relanza antes), pero en la via `P2010`/`23505` buscaba el nombre del indice, que Postgres no pone en el `DETAIL`; devolvia `false` y se relanzaba el error crudo.
- **Arreglo:** en `23505`, `isNameLanguageTaken` lee la lista de columnas del `DETAIL` (`(...)=(`, el parentesis no depende del idioma del servidor) y acepta exactamente `{connection_id, name, language}`. Se conservan las vias `P2002` y nombre del indice. El test unitario usa ahora la forma medida (ingles y espanol) y el caso negativo `(connection_id, meta_template_id)`.
- **Salida (local, Postgres localhost:5432, base desechable `qct_*`):**
  - `pnpm exec vitest run --project integration tests/integration/integraciones/whatsapp-template-prisma.int.test.ts` → 1 file, 20 passed (antes: 1 failed | 19 passed, el caso R2).
  - `... whatsapp-template-flow.int.test.ts` → 1 file, 7 passed.
  - `... whatsapp-template-migration.int.test.ts` → 1 file, 6 passed.
  - `pnpm exec vitest run tests/unit/integraciones/whatsapp/templates/whatsapp-template-prisma-errors.test.ts` → 1 file, 9 passed.
  - `pnpm typecheck` → limpio. `pnpm lint` → 0 errores, 10 warnings preexistentes ajenos (los dos archivos tocados: sin issues). Guardias (`vitest run guard`) → 85 files passed.
- **Veredicto:** traduccion corregida segun la forma medida; los tres `.int` de plantillas en verde en local.
