# QC-137 — sistema-de-notificaciones-por-rol · bitácora de implementación (backend_dev)

## Tanda 1 — Bloque A (T1, T2, T3)

Alcance: solo el Bloque A de `specs/QC-137-sistema-de-notificaciones-por-rol/tasks.md`. Bloques
B–G sin tocar. Sin dependencias nuevas. Sin commit (lo hace el leader).

### Archivos creados

| Archivo | Qué es |
| --- | --- |
| `db/migrations/20261019120000_notifications/migration.sql` + `down.sql` | T1: `notifications` y `notification_reads`, CHECK de un destinatario, de `event_key`, de `tone` y de `{hora}`↔`body_time`; `UNIQUE (company_id, dedupe_key)`, `UNIQUE (id, company_id)`, FK compuesta de lecturas en cascada, índices `(…, created_at DESC, id DESC)` y `(company_id, created_at)`, RLS activada y forzada. El down borra las dos tablas, hija primero |
| `db/migrations/20261019120100_notifications_addon/migration.sql` + `down.sql` | T2: migración de datos idempotente: permiso, asignación a los cuatro roles de empresa por nombre, fila en `addons` y excepción `enabled = true` en cada empresa existente (sin `WHERE`, como QC-277). El down borra exactamente esas filas, hijas primero |
| `lib/modules/identity/ports/company-membership-reader.ts` | T3: puerto `CompanyMembershipReader.isUserInCompany` |
| `lib/modules/identity/domain/is-user-in-company.ts` | T3: `createIsUserInCompany`; un id que no es UUID → `false` sin tocar el puerto |
| `tests/unit/identity/is-user-in-company.test.ts` | T3 unit |
| `tests/integration/identity/company-membership.int.test.ts` | T3 integración (otra empresa → `false`) |
| `tests/integration/notificaciones/notifications-schema.int.test.ts` | T1 |
| `tests/integration/identity/notifications-addon-migration.int.test.ts` | T2: R52, constantes, idempotencia y down |

### Archivos modificados

- Producción: `db/schema.prisma` (solo los dos modelos nuevos, al final, `/// @module notificaciones`),
  `lib/modules/identity/domain/permissions.ts` (entrada nueva, cuatro roles, párrafo del JSDoc;
  se quitan dos frases del JSDoc de `SEED_ROLE_PERMISSIONS` que dejaban de ser ciertas),
  `lib/modules/identity/domain/company-addons.ts`, `lib/modules/identity/index.ts`,
  `lib/modules/identity/adapters/driven/persistence/company-prisma.ts`
  (`createCompanyMembershipReader`, `findFirst` con `deletedAt: null`), `lib/composition/index.ts`
  (`identity.isUserInCompany`).
- Tests que fijaban el catálogo, el seed o «cinco añadidos» (actualizados, ver «Bloqueos y notas»):
  `tests/unit/identity/{permissions,company-actions,is-user-in-company}.test.ts`,
  `tests/unit/identity/addons/{company-addons,menu-recortado}.test.ts`,
  `tests/unit/identity/companies/{get-company-addons,set-all-company-addons,set-company-addon}.test.ts`,
  `tests/unit/identity/schema/{company-addons-migration,conditioning-role-migration}.test.ts`,
  `tests/unit/identity/seed/seed-initial-access.test.ts`, `tests/unit/navegacion/qc75-convenciones.test.ts`,
  `tests/unit/pedidos/qc146-alcance.test.ts`, `tests/unit/asignaciones/empacador-authorization.test.ts`,
  `tests/unit/asignaciones/schema/order-assignments-migration.test.ts`,
  `tests/integration/identity/{company-addons,conditioning-role-migration,identity-seed,session-user}.int.test.ts`,
  `tests/guards/guard-identificador-de-request.test.ts` (lista de migraciones esperadas),
  `tests/integration/aislamiento.json` (tres archivos nuevos, `transaccion`),
  `e2e/helpers/addons.ts` y `e2e/modulos-por-empresa.spec.ts` (solo textos «cinco»; no se corrió E2E).

### Mapa R<n> → test

| R | Test |
| --- | --- |
| R3 | `notifications-schema.int.test.ts` › «QC-137 R3: rechaza un dedupe_key repetido en la misma empresa y lo admite en otra» |
| R12 | `notifications-schema.int.test.ts` › «QC-137 R12: rechaza un aviso sin destinatario y uno dirigido a un rol y a un usuario a la vez» (+ admite uno solo; rol inexistente → FK). `is-user-in-company.test.ts` y `company-membership.int.test.ts` › «QC-137 R12: … false si es de otra empresa» |
| R14 | `notifications-schema.int.test.ts` › «QC-137 R14: rechaza una lectura con una empresa distinta a la del aviso» |
| R47 | `notifications-schema.int.test.ts` › «QC-137 R47: rechaza un body con {hora} sin body_time y un body_time sin {hora} en el body» |
| cascada (R17) | `notifications-schema.int.test.ts` › «QC-137 R17: borrar un aviso borra sus lecturas, y no las de otro aviso» |
| R18 | `tests/unit/identity/addons/company-addons.test.ts` › «QC-137 R18 — el permiso efectivo es rol ∩ añadido…»; `company-addons.int.test.ts` › «QC-137 R18: con el añadido prendido, el Administrador lo tiene efectivo; al apagarlo, la siguiente lectura lo pierde»; `permissions.test.ts` › «R18: el catalogo es el previo … mas notificaciones.consultar al final» |
| R20 | `company-addons.int.test.ts` › «QC-137 R20: una empresa dada de alta con createWithAdministrator nace con notificaciones apagado»; `notifications-addon-migration.int.test.ts` › «QC-137 R52, R20: una empresa dada de alta despues de la migracion no tiene el añadido» |
| R21 | `permissions.test.ts` › «R21: los cuatro roles de empresa lo reciben al final…», «R21: el Maestro no lo recibe…», «R21: ningun otro rol tiene el permiso»; `notifications-addon-migration.int.test.ts` › «QC-137 R18, R21: las filas que escribe coinciden con las constantes de la app» |
| R52 | `notifications-addon-migration.int.test.ts` › «QC-137 R52: tras aplicarla, cada empresa que ya existia, viva o de baja, tiene notificaciones prendido y sin autor» (+ idempotencia y down) |
| R53 | `company-addons.test.ts` › «QC-137 R53 — no depende de ningún otro añadido…» y «… ningún añadido depende de él…»; `set-company-addon.test.ts` › «QC-137 R53: prender y apagar notificaciones con integraciones apagada solo pide esa clave al puerto»; `set-all-company-addons.test.ts` › «QC-137 R53: prender todos incluye notificaciones…»; `company-addons.int.test.ts` › «QC-137 R53: prender y apagar notificaciones con integraciones apagada no exige ni cambia ningun otro añadido» |

### Verificación (salida real)

Ver la sección «Salidas» al final.

### Bloqueos y notas

1. **Sin bloqueos.**
2. **Puerto nuevo no listado en `Archivos esperados`:** `lib/modules/identity/ports/company-membership-reader.ts`.
   Añadir `isUserInCompany` a `CompanyRepository` obligaba a tocar los ~10 dobles de test de ese
   puerto. El adaptador sí vive en `company-prisma.ts`, como dice el design.
3. **Decisión de implementación a validar:** `isUserInCompany` responde `false` para un usuario
   dado de baja (`deletedAt` no nulo). El design solo dice «es de esa empresa»; se siguió el
   patrón de los `findFirst` de `identity` (`user-admin-prisma`, `work-group-prisma`).
4. **Texto no dado por el spec:** descripción del permiso, «Consultar los avisos propios y marcarlos
   como leídos.» (columna NOT NULL de `permissions`).
5. **Radio de la enmienda de R21:** sumar `notificaciones.consultar` a Operador, Empacador y
   Administrador de acondicionamiento rompe ~55 asserts de tests de fichas previas que fijan el
   conjunto exacto de cada rol o el catálogo. Se actualizaron con el patrón ya usado por
   `entregas.anular` (filtros «sin X» para los casos previos; asserts nuevos sobre los reales).
6. **`tests/unit/marca/tablas-marca.test.tsx` en rojo, ajeno:** compara el texto de
   `product-columns.tsx` (columna «Costo»), que este diff no toca. Sale por `vitest related` porque
   el diff toca `lib/composition/index.ts`. No está en `tests/baseline-rojos.json`.
7. Grafo de código: no se usó; exploración con Grep/Read.

### Salidas

```
$ pnpm run typecheck
> tsc --noEmit                     (sin errores)

$ pnpm run lint
✖ 10 problems (0 errors, 10 warnings)   (los 10 en archivos que este diff no toca)

$ pnpm exec vitest related --run --project node --project ui <23 archivos tocados>
 Test Files  1 failed | 690 passed (691)
      Tests  1 failed | 12540 passed | 22 skipped (12563)
 FAIL |ui| tests/unit/marca/tablas-marca.test.tsx > R11, R13: en 'product-columns.tsx' … (ajeno, nota 6)

$ pnpm exec vitest run --project integration tests/integration/notificaciones tests/integration/identity
test-db: plantilla lista: qct_tpl_a49a8f287bf6
test-db: la corrida de integracion va contra qct_qc137_f77f0a50_mvffz1mm_5xg (copia de qct_tpl_a49a8f287bf6).
 Test Files  32 passed (32)
      Tests  496 passed (496)

$ pnpm exec vitest run guard
 Test Files  80 passed (80)
      Tests  1096 passed | 20 skipped (1116)
```

**db:migrate / db:rollback** sobre una base desechable `qct_qc137_migcheck` (copia de la plantilla
de test ya migrada; borrada al terminar; la de desarrollo no se tocó):

- `db:rollback` → «20261019120100_notifications_addon revertida»: permiso, asignaciones, añadido y
  excepciones a 0; tablas siguen.
- `db:rollback` sobre la siguiente: el script elige la última carpeta del disco, no la última
  aplicada, así que vuelve a aplicar el down del añadido (sin efecto, avisa que no había fila).
  El down de `20261019120000_notifications` se aplicó con los mismos dos pasos que el script, en
  una transacción: tablas fuera, fila de `_prisma_migrations` borrada. `prisma migrate status`:
  «Following migrations have not yet been applied: 20261019120000_notifications,
  20261019120100_notifications_addon».
- `db:migrate` → «Applying migration 20261019120000_notifications», «Applying migration
  20261019120100_notifications_addon», «All migrations have been successfully applied». Segunda
  corrida: «No pending migrations to apply».
- `prisma migrate diff` base → esquema: de las tablas nuevas solo salen los `DROP CONSTRAINT` de las
  cinco FK escritas a mano (drift esperado, igual que `document_files`).

### Veredicto

Bloque A (T1, T2, T3) hecho: typecheck, lint, integración y guardias en verde; el único rojo de
`vitest related` es ajeno.

## Bloque B — Módulo `notificaciones` (T4, T5, T6, T7, T8)

Alcance: solo el Bloque B de `tasks.md`. Bloques C–G sin tocar (nada del emisor `documentos`, nada
de UI). Sin dependencias nuevas. Sin commit.

### Archivos creados

| Archivo | Task | Qué es |
| --- | --- | --- |
| `lib/modules/notificaciones/index.ts` | T4/T6 | Contrato: solo reexporta de `./domain` |
| `lib/modules/notificaciones/domain/catalog.ts` | T4 | `CatalogEntry<P>`, `Audience`, `NotificationTone`, `NotificationTarget` (unión cerrada `formulas`/`suppliers`), `NotificationRecipient` y `NOTIFICATION_CATALOG` (vacío: la entrada `documentos.tanda_terminada` es T11) |
| `lib/modules/notificaciones/domain/notification-event.ts` | T4 | `NotificationEvent { key, companyId, dedupeKey, payload }` |
| `lib/modules/notificaciones/domain/notify.ts` | T4 | `createNotify`: catálogo + `safeParse` → interruptor → directorio (solo audiencia de usuario) → `insertIfAbsent` → un `try/catch` por canal → `try/catch` exterior. Nunca lanza |
| `lib/modules/notificaciones/domain/channel-factory.ts` | T4 | `createChannelFactory(registry).channelsFor(keys)` |
| `lib/modules/notificaciones/domain/errors.ts` | T4 | `NotificacionesError` + `UnauthorizedError` (`unauthorized`) + `ValidationError` (`invalid_input`), códigos ya existentes en el catálogo de `errores` |
| `lib/modules/notificaciones/ports/{notification-channel,notification-inbox,notifications-switch,recipient-directory,notification-log}.ts` | T4 | Los cinco puertos |
| `lib/modules/notificaciones/adapters/driven/persistence/notification-inbox-prisma.ts` | T5 | `$queryRaw`: `insertIfAbsent` (`ON CONFLICT DO NOTHING RETURNING`), resumen (`COUNT` + `LIMIT 1`), lote (pide 11, devuelve 10, cursor con `to_char(... 'US')`), marcar (CTE: visible → `INSERT … ON CONFLICT DO NOTHING`, responde si era visible), marcar todas, `deleteExpired` por empresa. `NOTIFICATION_BATCH_SIZE = DEFAULT_PAGE_SIZE` |
| `lib/modules/notificaciones/domain/{actor,retention,notification-cursor,get-notification-summary,list-notifications,mark-notification-read,mark-all-notifications-read,purge-expired-notifications}.ts` | T6 | `Actor { id, companyId, roleName, permissions }`, `NOTIFICATIONS_READ_PERMISSION`, `requirePermission` (delega en `identity.assertPermission`), `RETENTION_DAYS = 90`, cursor base64url validado con zod (`t` con 6 decimales, `i` uuid, `strictObject`) y los cinco casos de uso |
| `lib/modules/notificaciones/adapters/driving/notification-actions.ts` | T7 | `'use server'`: `getNotificationSummaryAction`, `listNotificationsAction`, `markNotificationReadAction`, `markAllNotificationsReadAction`. Respuesta `{ ok: true, data }` o `{ ok: false, code }` con `unauthorized` (sin sesión), `forbidden` (sin permiso efectivo), `invalid_input`, `not_found`, `unexpected`. `NotificationView` con `href` y fechas ISO |
| `lib/modules/notificaciones/adapters/driving/notification-links.ts` | T7 | `notificationHref(target)` con `FORMULAS_ROUTE` / `SUPPLIERS_ROUTE`; `kind` desconocido → `null` |
| `lib/modules/notificaciones/adapters/driven/channels/in-app-channel.ts` | T8 | Canal `in_app`: solo deja traza |
| `lib/modules/notificaciones/adapters/driven/observability/notification-log-console.ts` | T8 | `forModule('notificaciones')` |
| `tests/unit/notificaciones/{notify,channel-factory,add-event,authorization,notification-cursor,summary,notification-actions,notification-links}.test.ts` | T4, T6, T7 | |
| `tests/integration/notificaciones/notification-inbox.int.test.ts` | T5 | |
| `tests/unit/composition/notificaciones-wiring.test.ts` | T8 | |

### Archivos modificados

- `lib/composition/index.ts` (T8): un bloque **al final del archivo**, sin tocar nada de lo
  existente (para no chocar con QC-203/QC-288): imports de `notificaciones`, registro de canales con
  solo `in_app`, interruptor `identity.isCompanyAddonActive(companyId, 'notificaciones')`,
  `RecipientDirectory` con `identity.isUserInCompany` y la fachada `notificaciones` (`notify`,
  `getNotificationSummary`, `listNotifications`, `markNotificationRead`, `markAllNotificationsRead`,
  `purgeExpiredNotifications`).
- `tests/integration/aislamiento.json`: `notificaciones/notification-inbox.int.test.ts` en `transaccion`.
- `tests/unit/identity/session-once-per-request-actions.test.ts`: fila nueva en `ACCIONES` para
  `notification-actions.ts` (`getNotificationSummaryAction`). Sin ella el caso «TODO archivo de
  driving/ con las dos caras está en la lista» se pone rojo: el test lee el disco y exige la fila.
- `lib/modules/documentos/index.ts`: **no se tocó**.

### Mapa R<n> → test (Bloque B)

| R | Test |
| --- | --- |
| R1 | `add-event.test.ts` › «R1: un evento con destinatario por rol se guarda con el rol, sin usuario y sin consultar el directorio» |
| R2 | `notify.test.ts` › «R2: un evento del catálogo crea un único aviso dirigido al usuario que fija el catálogo» |
| R3 | `notify.test.ts` › «R3: el mismo evento con la misma clave deja un solo aviso y no se vuelve a entregar»; `notification-inbox.int.test.ts` › «QC-137 R3: insertIfAbsent devuelve el aviso guardado y null con la misma clave…» |
| R4 | `notify.test.ts` › «R4: un evento que no está en el catálogo…», «R4: una clave heredada de Object (toString)…», «R4: un payload sin la forma del catálogo…» |
| R6 | `add-event.test.ts` › «R6: un evento nuevo en el catálogo crea su aviso con el mismo motor y la misma factory» |
| R7 | `notify.test.ts` › «R7: si la bandeja lanza, notify no lanza y el fallo queda en el log», «R7: si el interruptor del añadido lanza, notify tampoco lanza» |
| R8 | `channel-factory.test.ts` › «R8: devuelve los canales registrados…», «R8: entrega el aviso por cada canal que el catálogo fija…» |
| R9 | `notificaciones-wiring.test.ts` › «R9: el único canal registrado en la factory es el de la aplicación» |
| R10 | `channel-factory.test.ts` › «R10: un canal ficticio registrado recibe los eventos que el catálogo le asigna, y no los demás» |
| R11 | `channel-factory.test.ts` › «R11: si el ficticio lanza, los demás canales reciben el aviso y la bandeja ya estaba escrita» |
| R12 | `notify.test.ts` › «R12: un destinatario que no es de la empresa del evento se rechaza…»; `notificaciones-wiring.test.ts` › «R12: el directorio de destinatarios es identity.isUserInCompany» |
| R13 | `notification-inbox.int.test.ts` › «QC-137 R13: avisos de otra empresa, de otro rol y de otro usuario no salen…, tampoco con un cursor fabricado» |
| R14 | `authorization.test.ts` › «R14: marcar un aviso no visible responde not_found…»; `notification-actions.test.ts` › «R14: un id que no es uuid (…) se rechaza con invalid_input…» (×4) y «R14: un aviso no visible responde not_found…»; `notification-inbox.int.test.ts` › «QC-137 R14: marcar un aviso que no le corresponde…» |
| R15 | `authorization.test.ts` › «summary/list/markRead/markAll › R15: sin notificaciones.consultar lanza UnauthorizedError y no llama a la bandeja» (+ el caso con permiso: scope con empresa, usuario, rol y corte de 90 días) |
| R16 | `notification-inbox.int.test.ts` › «QC-137 R16: marcar uno dirigido a un rol lo deja leído solo para quien lo marca» |
| R17 | `notification-inbox.int.test.ts` › «QC-137 R17: uno de 91 días no sale, y el borrado se lo lleva con sus lecturas sin tocar otra empresa» (la ruta del cron es T20) |
| R19 | `notify.test.ts` › «R19: con el añadido apagado…»; `authorization.test.ts` › «R19: con el añadido apagado el permiso no es efectivo…» (×4); `notificaciones-wiring.test.ts` › «R19: el interruptor del motor pregunta por el añadido con la clave notificaciones» |
| R22 | `summary.test.ts` › «R22: trae el conteo de no leídos y el más reciente, y no trae lista», «R22: sin avisos…»; `notification-actions.test.ts` › «R22: el resumen viaja con el conteo y el más reciente en ISO» |
| R23, R25, R27 | `notification-inbox.int.test.ts` › «QC-137 R23, R25, R27: con 23 avisos salen tres lotes de 10, 10 y 3…» |
| R25 | `notification-actions.test.ts` › «R25: un cursor que no es texto válido (…) responde invalid_input…» (×5), «R25: sin permiso, una entrada mal formada responde forbidden…»; `notification-cursor.test.ts` › «R25: una entrada de lote inválida (…)» (×4) |
| R28 | `notification-cursor.test.ts` › «R28: codificar y decodificar conserva…», «R28: el lote pasa a la bandeja el cursor decodificado…», «R28: un cursor mal formado (…) se rechaza sin llamar a la bandeja» (×6); `notification-inbox.int.test.ts` › «QC-137 R28: avisos del mismo milisegundo o del mismo instante…» y «QC-137 R28: con dos avisos del mismo created_at justo en el corte…» |
| R32 | `notification-inbox.int.test.ts` › «QC-137 R32: marcar todas toca los visibles no leídos, también los que no están en el primer lote, y nada ajeno»; `notification-actions.test.ts` › «R32: marcar todas devuelve cuántas marcó» |
| R40 | `notification-actions.test.ts` › «summary/list/markRead/markAll › R40: sin sesión responde unauthorized…» y «R40: con sesión y sin el permiso efectivo responde forbidden…» |
| R49 | `notification-links.test.ts` › los tres casos R49; `notification-actions.test.ts` › «R25, R49: el lote viaja como vista con href resuelto…» |

Una lectura de sesión por petición: `session-once-per-request-actions.test.ts` sigue verde con la fila nueva.

### Verificación (salida real)

```
$ pnpm run typecheck
> tsc --noEmit                     (sin errores)

$ pnpm run lint
✖ 10 problems (0 errors, 10 warnings)   (los 10 en archivos que este diff no toca)
$ pnpm exec eslint <archivos del Bloque B>   (sin salida, exit 0)

$ pnpm exec vitest run --project node tests/unit/notificaciones tests/unit/composition/notificaciones-wiring.test.ts tests/unit/identity/session-once-per-request-actions.test.ts
 Test Files  10 passed (10)
      Tests  164 passed (164)

$ pnpm exec vitest related --run --project node --project ui <35 archivos .ts tocados, sin los .int>
 FAIL  |ui| tests/unit/marca/tablas-marca.test.tsx > lista cerrada de columnas en Plex Mono > R11, R13: en 'product-columns.tsx' llevan tabular exactamente las columnas de la lista
 Test Files  1 failed | 363 passed (364)
      Tests  1 failed | 6123 passed | 1 skipped (6125)
 (único rojo: el ajeno conocido, sale porque el diff toca lib/composition)

$ pnpm exec vitest run --project integration tests/integration/notificaciones
test-db: plantilla reutilizada: qct_tpl_a49a8f287bf6 (las migraciones no han cambiado)
test-db: la corrida de integracion va contra qct_qc137_f77f0a50_mvfhyjx6_hg4 (copia de qct_tpl_a49a8f287bf6).
 Test Files  2 passed (2)
      Tests  19 passed (19)
test-db: borrada la base de la corrida: qct_qc137_f77f0a50_mvfhyjx6_hg4.

$ pnpm exec vitest run guard
 Test Files  80 passed (80)
      Tests  1096 passed | 20 skipped (1116)
```

### Decisiones de implementación a validar

1. **Sin códigos nuevos en el catálogo de errores.** El dominio solo lanza `unauthorized` e
   `invalid_input`, que ya existen. `not_found` no es un error: `markNotificationRead` devuelve
   `'marked' | 'not_found'` (`guard-catalogo-de-errores` prohíbe el genérico `not_found` en el
   catálogo). `forbidden` y `not_found` existen solo como `code` de la respuesta `{ ok: false, code }`
   de las acciones (design §8), que no es `ErrorState`.
2. **Orden de los cortes en el borde.** Las acciones cortan primero la sesión (`unauthorized`),
   validan con el mismo esquema que publica el contrato (`listNotificationsInputSchema`,
   `notificationIdSchema`) y, si no pasa, entregan la entrada cruda al caso de uso, que comprueba el
   permiso antes que la forma: sin permiso gana `forbidden`, con permiso `invalid_input`; en ningún
   caso se toca la bandeja. Es el patrón de `document-batch-actions.ts`. Si el reviewer lee
   «rechazado en el borde» (R14 de T7) como «sin llegar al caso de uso», hay que invertir el orden y
   aceptar que `invalid_input` gane a `forbidden`.
3. **Reloj inyectado** (`now: () => Date`) en los casos de uso de lectura y en el borrado: el corte de
   90 días se calcula en el dominio (`retentionCutoff`) y viaja a la bandeja en `InboxScope.cutoff`.
4. **Nombres no fijados por el design:** `NotifyDeps.addon` (el interruptor; `switch` es palabra
   reservada), `InboxScope`, `InboxCursor`, `StoredTarget` (`{ kind: string }`: el destino leído
   puede ser de un `kind` desconocido), `notificationHref`.
5. **`getNotificationSummaryAction` registra cada lectura** (`notification_summary_read`, solo
   `companyId`), por design §12.3 («la acción registra con el logger del módulo, sin datos
   personales»). Es una línea cada 30 s por pestaña visible.
6. **`summary.newest`** es el más reciente de los visibles, leído o no; el tono (T14) exige además
   `unreadCount > 0` (design §9.3).
7. Grafo de código: no se usó; exploración con Grep/Read.

### Veredicto

Bloque B (T4–T8) hecho: typecheck, lint, integración y guardias en verde; el único rojo de
`vitest related` es el ajeno conocido (`tablas-marca.test.tsx` por `product-columns.tsx`).
