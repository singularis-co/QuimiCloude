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
| §3.2 idiomas (70 códigos) | **Corregido**: Meta lista 111. No sobra ninguno; faltan 41: ar_EG ar_AE ar_LB ar_MA ar_QA be_BY bn_IN prs_AF nl_BE en_AE en_AU en_CA en_GH en_IE en_IN en_JM en_MY en_NZ en_QA en_SG en_UG en_ZA fr_BE fr_CA fr_CH fr_CI fr_MA de_AT de_CH ps_AF si_LK es_CL es_CO es_CR es_DO es_EC es_HN es_PA es_PE es_UY | Se usa la lista vigente de 111. R8 apunta a «la lista de §3.2 [POR CONFIRMAR]»: es la corrección que pedía el contraste, no cambia el alcance |
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
