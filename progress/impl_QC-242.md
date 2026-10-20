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
