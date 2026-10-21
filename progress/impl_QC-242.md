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

## Enmienda — Tanda E1: T22-T25 (backend_dev, 2026-10-20)

Archivos: `db/schema.prisma` (enum `WhatsappTemplateMappingStatus`, `WhatsappVariableKey`,
`WhatsappTemplateVariable`, `mappingStatus`/`enabled`/`@@unique([companyId,id])` en `WhatsappTemplate`;
`prisma format` solo en ese bloque), `db/migrations/20261020180000_whatsapp_variable_keys/{migration,down}.sql`,
`errores/domain/{error-codes,error-catalog}.ts` (+5 al final), `integraciones/domain/errors.ts` (+5 clases),
`domain/whatsapp-system-variables.ts`, `domain/whatsapp-variable-key.ts`, `domain/whatsapp-template-variables.ts`,
`domain/whatsapp-template-keyed-draft.ts`, `domain/whatsapp-template-draft.ts` (+`unknown_key`).
Tests: `tests/unit/errores/catalogo.test.ts` (112 -> 117 + describe R85), `whatsapp-variable-key.test.ts`,
`whatsapp-template-variables.test.ts`, `whatsapp-template-keyed-draft.test.ts` (nuevos),
`tests/guards/guard-identificador-de-request.test.ts` (+ la migracion en `MIGRACIONES_ESPERADAS`).

Mapa: R53, R54, R55 -> `whatsapp-variable-key.test.ts`; R64, R65, R71, R81 -> `whatsapp-template-variables.test.ts`;
R66, R67, R6 -> `whatsapp-template-keyed-draft.test.ts`; R85 -> `catalogo.test.ts`.

Migracion: probada con una sonda temporal (borrada) en la base efimera: aplicada (plantilla
`qct_tpl_4c4ddbb224a1` construida y "esquema al dia"), `down.sql` la revierte y la reaplicacion deja el
mismo esquema (columnas, indices, constraints, RLS), relleno sobre 6 filas (plana -> MAPPED/true; `{{1}}`,
header IMAGE, boton OTP, eliminada, sin BODY -> UNMAPPED/false). 3/3 verdes.

Salidas: typecheck 0 errores; lint 0 errores (11 warnings preexistentes, ninguno en lo tocado);
catalogo 61/61; whatsapp-variable-key 20/20; whatsapp-template-variables 18/18; keyed-draft + draft T3 54/54;
template-sync-plan y components verdes; guardias 85/85 archivos (1172 passed).

Rojo esperado, de otras tasks: `module-shape.test.ts` 2 casos (R18 lista de archivos, R13 seis modelos) ->
T34; `whatsapp-template-migration.int.test.ts` 2 casos (lista exacta de indices y de CHECK de
`whatsapp_templates` gana `whatsapp_templates_company_id_id_key` y `whatsapp_templates_enabled_requires_mapped`)
-> sin task asignada, a decidir.

Veredicto: T22-T25 hechas; quedan dos rojos que pertenecen a T34 y a una decision sobre el test de migracion de T1.

## Contraste con Meta antes de T26 (forma del GET frente a lo creado), 2026-10-20

Fuentes:
- Graph API v26.0 `whats-app-business-account/message_templates` (developers.facebook.com/docs/graph-api/reference/…; sin fecha visible): el GET devuelve `components` con la misma forma que el POST; el `example` del boton URL esta tipado `array<string>` en la creacion.
- templates/template-management (actualizada 2026-07-02, tambien en `.md`): ejemplo «Get all templates» POSITIONAL con header TEXT.
- templates/components (2026-06-24) y templates/overview (2026-05-21; `parameter_format` a nivel plantilla).

| Campo | Enviado (`toMetaComponents`) | GET (doc) | `contentOf` lo absorbe |
|---|---|---|---|
| HEADER TEXT | `{type,format,text,example:{header_text:[s]}}` | identico | si |
| BODY | `{type,text,example:{body_text:[[...]]}}` | identico (`body_text_named_params` solo en NAMED) | si |
| `example` ausente | se omite | se omite sin parametros | si (opcional) |
| FOOTER, QUICK_REPLY, URL estatico, PHONE_NUMBER | `{type,text,…}` | identico | si |
| URL con `{{1}}` | `example:[s]` | **no documentado** en el GET | si llega como array; como texto ⇒ `null` (lo cubre T39, R96) |
| claves de mas / orden | — | `parameter_format`, `id`, … fuera de `components` | si (zod no estricto, campo a campo) |

No documentado: si Meta reformatea `phone_number` o recorta espacios (daria «cambio»). El doble `canned` lista lo mismo que recibio: T26 no prueba la forma real ([P4]).

Veredicto: **no rompe** la comparacion normalizada de §18.5. Sin pregunta al humano.

## Enmienda (T22–T35) y enmienda 2 (T36–T40)

### Tanda E1 — T22–T25 corregidas por T36–T39 (backend_dev), 2026-10-20

La sección de T22–T25 de arriba se escribió sobre la versión con catálogo de constantes en el back;
T36–T39 la corrigen (enmienda 2, F1–F4). Estado final:

- Migración `20261020180000_whatsapp_variable_keys`: `CHECK whatsapp_template_variables_system_key_format`
  = `^[a-z][a-z0-9_]{0,39}\.[a-z][a-z0-9_]{0,39}$` (R88); `down.sql` sin cambio.
- Borrado `domain/whatsapp-system-variables.ts` (R87): nadie lo importa.
- `whatsapp-variable-key.ts`: `WHATSAPP_CONSTANT_KEY_PATTERN`, `isOwnKey`, `isConstantKey`; vista del diccionario solo con propias.
- `whatsapp-template-keyed-draft.ts`: clasifica por forma (§19.3), `constantLabels` (§19.4, `nullish`); constante sin etiqueta ⇒ `example_missing`.
- `whatsapp-template-variables.ts`: `variableSlotsOf` ⇒ `null` si una marca no es `{{n}}` (R95).
- `whatsapp-template-components.ts`: ejemplo de URL como texto o lista (R96).
- `whatsapp-template-migration.int.test.ts`: las dos listas exactas ganan los dos nombres nuevos.
- Nuevo (adelanto de T29): `whatsapp-variable-keys-migration.int.test.ts` + entrada en `aislamiento.json`.
- `guard-identificador-de-request.test.ts`: la migración nueva en `MIGRACIONES_ESPERADAS`.

Salidas (un comando por llamada):
- `pnpm run typecheck` → limpio. `pnpm run lint` → 0 errores, 10 warnings ajenos.
- vitest: variable-key 27/27, template-variables 24/24, keyed-draft 28/28, template-draft (T3, sin cambios) 32/32, template-components 8/8, catalogo 61/61.
- `vitest run guard` → 85 files, 1172 passed, 21 skipped.
- `--project integration whatsapp-template-migration.int` → 6/6; `whatsapp-variable-keys-migration.int` → 6/6 (aplica, revierte, reaplica con el mismo esquema).
- Rojo conocido hasta T34: `module-shape.test.ts` (lista de archivos y número de modelos).

### Tanda E2 — T26–T29 (backend_dev), 2026-10-20

- Ciclo de imports: `canonical` y `sameComponents` se mueven a `domain/whatsapp-template-components.ts`; plan y variables importan de ahí (sin cambio de comportamiento).
- Nuevos: `ports/whatsapp-variable-key-repository.ts` (6 métodos, sin `countSystemKeyUsage`), `adapters/driven/persistence/whatsapp-variable-key-prisma.ts`, `tests/integration/integraciones/whatsapp-variable-key-prisma.int.test.ts`.
- Modificados: `template-sync-plan.ts`, `whatsapp-template.ts` (record y vista), `whatsapp-template-components.ts`, `whatsapp-template-variables.ts`, `ports/whatsapp-template-repository.ts`, `company-scope.ts` (+2 envolturas), `whatsapp-template-prisma.ts`, `lib/composition/index.ts` (para compilar), ajuste mínimo en `create-whatsapp-template.ts` y `list-whatsapp-templates.ts` (lo sustituyen T31/T33); tests: `whatsapp-doubles.ts`, `template-sync-plan.test.ts`, `whatsapp-template-prisma.int.test.ts`, `aislamiento.json`, `guard-ambito-empresa-integraciones.test.ts`, `create-`/`list-whatsapp-templates.test.ts`, `whatsapp-template-actions.test.ts`, `whatsapp-connection-prisma.int.test.ts`.
- Decisión anotada: las lecturas no hacen la «tercera consulta» de §18.8 (claves de propias por `id in`): el binding `company` solo lleva `variableKeyId`; la clave la pone la vista con `listAll` una vez por llamada (§18.7, T33).

Salidas: typecheck limpio; lint 0 errores (10 warnings ajenos); plan 31/31; `vitest run tests/unit/integraciones/whatsapp` 37 files 760/760; `tests/unit/composition` 80/80; guard 85 files 1197 passed 21 skipped; `.int` uno por llamada: template-prisma 35/35, variable-key-prisma 19/19, connection-prisma 16/16, template-flow 7/7. Rojo conocido hasta T34: `module-shape` (2).

### Tanda E3 — T30–T33 (backend_dev), 2026-10-20

- Nuevos: `domain/manage-whatsapp-variable-keys.ts` (4 fábricas, solo propias, R89/R90), `domain/relate-whatsapp-template-variables.ts` (relacionar con §19.3, habilitar, deshabilitar); tests `manage-whatsapp-variable-keys.test.ts`, `relate-whatsapp-template-variables.test.ts`.
- Modificados: `create-whatsapp-template.ts` (borrador con claves sobre `listAll` + `constantLabels`, relaciones, carrera R69), `list-whatsapp-templates.ts` (vista por hueco, `{{clave}}`, constante con `label: null`, `toWhatsappTemplateView(record, ownKeys)`); tests `create-`/`list-whatsapp-templates.test.ts`, `template-use-case-setup.ts`.
- Decisión abierta para el reviewer: `usedBy` de la vista que devuelve modificar no lo fija el diseño; se relee `listWithUsage` tras guardar (alternativa: 0, como al crear).

Salidas: typecheck limpio; lint 0 errores (10 warnings ajenos); create 34/34, list 31/31, manage 35/35, relate 39/39; `tests/unit/integraciones/whatsapp` 39 files 854/854; guard 85 files 1197 passed 21 skipped; `whatsapp-template-flow.int` 7/7. Rojo conocido hasta T34: `module-shape` (2).

### Tanda E4 — T34, T35 (backend_dev) y T40, 2026-10-20

- Nuevos: `adapters/driving/whatsapp-variable-key-actions.ts` (4 acciones), `tests/unit/integraciones/whatsapp/templates/whatsapp-variable-key-actions.test.ts`.
- Modificados: `lib/modules/integraciones/index.ts` (gana `WHATSAPP_CONSTANT_KEY_PATTERN`, las 6 fábricas, validadores, errores y tipos; sale `validateWhatsappTemplateDraft` — nadie fuera del módulo lo importaba, buscado en `app/`, `components/` y los demás worktrees), `whatsapp-template-actions.ts` (+ relacionar y habilitar), `lib/composition/index.ts` (6 miembros de la fachada), `module-shape.test.ts` (tensado: 8 archivos nuevos, contrato, 8 modelos, R6 sobre `validateKeyedTemplateDraft`), `whatsapp-template-actions.test.ts`, `whatsapp-template-flow.int.test.ts` (recorrido; la limpieza borra antes las relaciones por las FK RESTRICT). Tocados también porque fijan listas exactas: `tests/unit/integraciones/encryption-keys-env.test.ts`, `tests/unit/composition/integraciones-graph-doubles.test.ts`, `tests/unit/identity/session-once-per-request-actions.test.ts`.

Salidas (un comando por llamada, ninguno pasó de 5 min):
- `pnpm run typecheck` → limpio (repetido por el implementer tras el último cambio). `pnpm run lint` → 0 errores, 10 warnings ajenos.
- module-shape 104 passed, 1 skipped (R22, solo en su rama); template-actions 23/23; variable-key-actions 14/14; `tests/unit/integraciones` 66 files 1353 passed 1 skipped; `tests/unit/composition` 80/80; session-once-per-request 106/106; guard 85 files 1197 passed 21 skipped.
- `.int` (`--project integration`, uno por llamada): template-flow 8/8, template-prisma 35/35, variable-key-prisma 19/19, variable-keys-migration 6/6, template-migration 6/6.
- `git diff 2bd8ddc4 -- package.json .env.example pnpm-lock.yaml` → vacío (R52).

### Mapa R53–R96 → test (enmiendas 1 y 2)

Rutas: `U/` = `tests/unit/integraciones/whatsapp/templates/`, `I/` = `tests/integration/integraciones/`.

| R | Test |
|---|---|
| R53 | Reemplazado por R87/R88 |
| R54 | `U/whatsapp-variable-key.test.ts` > «R54: …» (clave 40/41, formas inválidas, etiqueta 60/61 y espacios, valor ausente/vacío/50/51/`{{`); `U/manage-whatsapp-variable-keys.test.ts` > R54 |
| R55, R56 | Reemplazados por R87 y R89 |
| R57 | `U/manage-whatsapp-variable-keys.test.ts` > «R57 …» |
| R58 | `U/manage-…` > «R58 …» (sin uso guarda; con uso `in_use`; clave de otra `taken`); `I/whatsapp-variable-key-prisma.int.test.ts` > «R58 — …»; `I/whatsapp-template-flow.int.test.ts` (borrar en uso) |
| R59 | `U/manage-…` > R59; `I/whatsapp-variable-key-prisma.int` > «R59 — en uso ⇒ in_use», «la FK impide borrarla en uso» |
| R60 | Reemplazado por R90; conteo `usedBy`: `I/whatsapp-variable-key-prisma.int` > «R60 — ordena por clave y cuenta plantillas vivas distintas» |
| R61 | `U/manage-…` > R61 (no UUID, no existe, otra empresa) |
| R62 | `U/manage-…`, `U/relate-whatsapp-template-variables.test.ts`, `U/whatsapp-variable-key-actions.test.ts` > «R62 …» |
| R63 | `I/whatsapp-variable-key-prisma.int` > «R63 — …» (B no ve ni borra; FK compuesta; dos columnas o ninguna); `tests/guards/guard-ambito-empresa-integraciones.test.ts` > «R63 — …» |
| R64 | `U/whatsapp-template-variables.test.ts` > «R64: …» |
| R65 | `U/whatsapp-template-variables.test.ts` > «R65: …» |
| R66 | Reemplazado por R91 |
| R67 | `U/whatsapp-template-keyed-draft.test.ts` > «R67 …»; `U/create-whatsapp-template.test.ts` > R67 (rechazo de Meta por el ejemplo ⇒ `whatsapp_template_rejected`) |
| R68 | `U/create-…` > R68; `I/whatsapp-template-prisma.int.test.ts` > «R68 — inserta las relaciones…» |
| R69 | `U/create-…` > R69 (3 casos de carrera); `I/whatsapp-template-prisma.int` > «R69 — … inserted false» |
| R70 | `U/template-sync-plan.test.ts` > «R70: …»; `I/whatsapp-template-prisma.int` > «R70 — …» |
| R71 | `U/template-sync-plan.test.ts` > «R71: cambia %s», «lo creado y lo que lista el doble canned…»; `I/whatsapp-template-prisma.int` > «R71 …» |
| R72 | `U/template-sync-plan.test.ts` > «R71 R72 …»; `U/relate-…` > R72; `I/whatsapp-template-prisma.int` > «R71 R72 …» |
| R73 | `I/whatsapp-template-prisma.int` > «R73 — …» (applySync, markDeleted, otra empresa, webhook no toca) |
| R74 | `U/relate-…` > «R74 …» (sustituye todo, conexión deshabilitada, sin Graph) |
| R75 | `U/relate-…` > «R75 …» (todas las ramas) |
| R76 | `U/relate-…` > R76; `I/whatsapp-template-prisma.int` > «R76 — …» (4 casos) |
| R77 | `U/relate-…` > «R77 …» (APPROVED/PENDING/REJECTED, E13; UNMAPPED ⇒ `not_mapped`) |
| R78 | `U/relate-…` > R78 |
| R79 | `U/relate-…` > R79 |
| R80 | `U/relate-…` > R80; `I/whatsapp-template-prisma.int` > «R80 — el CHECK rechaza enabled con UNMAPPED» |
| R81 | `U/list-whatsapp-templates.test.ts` > «R81 R94 …»; `U/whatsapp-template-variables.test.ts` (`showKeys`) |
| R82 | `U/list-whatsapp-templates.test.ts` > R82 |
| R83 | `U/whatsapp-variable-key-actions.test.ts` > «R83: …»; `U/whatsapp-template-actions.test.ts` > «R83: relacionar y habilitar por el mismo contrato» |
| R84 | `I/whatsapp-variable-keys-migration.int.test.ts` > «R84: …» (RLS, CHECK por nombre, DOWN, ida-vuelta-ida) |
| R85 | `tests/unit/errores/catalogo.test.ts` > «R85: …» (2 casos) |
| R86 | `I/whatsapp-variable-keys-migration.int` > «R86 R95: el relleno…» |
| R87 | `U/whatsapp-variable-key.test.ts` > «R87: el dominio no tiene catalogo…»; `U/whatsapp-template-keyed-draft.test.ts` > «R87 R91 …»; `U/manage-…` > R90/R87 |
| R88 | `U/whatsapp-variable-key.test.ts` > «R88: …»; `I/whatsapp-variable-key-prisma.int` > «R88 — constante de un segmento se rechaza», «propia con punto no entra»; `I/whatsapp-variable-keys-migration.int` > «R84 R88 …» |
| R89 | `U/manage-…` > «R89 …» (punto ⇒ `invalid_input` sin puerto al crear y modificar); `U/whatsapp-variable-key.test.ts` > «R89 …» |
| R90 | `U/manage-…` > «R90/R87: solo propias, por clave, campos exactos» |
| R91 | `U/whatsapp-template-keyed-draft.test.ts` > «R91 …», «R91 P19: propia desconocida ⇒ unknown_key»; `U/create-…` > R14/R91 |
| R92 | `U/whatsapp-template-keyed-draft.test.ts` > «R92 P20: constante sin etiqueta ⇒ example_missing», «R67 R92 E16: Hola {{cliente.nombre}} ⇒ Hola {{1}}»; `I/whatsapp-template-flow.int` (Meta recibe las etiquetas) |
| R93 | `U/relate-…` > «R74/R93 …» |
| R94 | `U/list-whatsapp-templates.test.ts` > «R81/R94 … label: null»; `I/whatsapp-template-flow.int` |
| R95 | `U/whatsapp-template-variables.test.ts` > «R95 P21: {{first_name}} …», «R95: una marca que no es {{n}}…»; `I/whatsapp-variable-keys-migration.int` > «R86 R95» |
| R96 | `U/whatsapp-template-components.test.ts` > «R96: …»; `U/template-sync-plan.test.ts` > «R96: el ejemplo del boton URL listado como texto…» |

Criterios E/F en el recorrido (`I/whatsapp-template-flow.int.test.ts` > «el recorrido de las variables de una plantilla»): E1/E2/E15/E16 (Meta recibe `Hola {{1}}, tu cuenta {{2}}` con las etiquetas), E4, E5/E11, E2/R74/R79/F2, E8/R77, E6/E12, E7/R58, F1. F3 es frontera, sin test.

Abierto para el reviewer:
- `usedBy` en la vista que devuelve modificar: se relee `listWithUsage` (el diseño no lo fija).
- Lecturas sin la «tercera consulta» de §18.8: la clave de una propia la pone la vista con `listAll`.
- La forma del `GET` sigue siendo [P4]: no está documentado si Meta reformatea `phone_number`.

Veredicto: T22–T40 implementadas; R53–R96 mapeados (los reemplazados remiten a su sustituto).
