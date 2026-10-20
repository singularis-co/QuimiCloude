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

## Tanda 2 — Bloques C y F

Alcance: T9, T10 (solo backend), T11 y T20. Fuera: `components/shared/document-upload/document-upload.tsx`
y `tests/unit/documentos-ui/document-upload-names.test.tsx` (UI, tanda de frontend_dev). Sin
dependencias nuevas.

### Archivos creados

| Archivo | Task | Qué es |
| --- | --- | --- |
| `lib/modules/documentos/domain/batch-finished-listener.ts` | T9 | `BatchFinishedListener` y `BatchFinishedEvent` (forma de design §6.1) |
| `lib/modules/documentos/domain/notify-if-batch-finished.ts` | T9 | `createNotifyIfBatchFinished({ notices, listener, log?, now? })`: lee el resumen; si `pending = 0` llama al listener. Nunca lanza (log `warn`) |
| `db/migrations/20261019120200_document_files_original_name/{migration,down}.sql` | T10 | `original_name TEXT NULL` + CHECK 1–255 (`char_length`); el down quita la columna |
| `lib/modules/documentos/domain/file-name.ts` | T10 | `fileNameSchema`: sin carpetas (`/` y `\`), sin `\p{Cc}`, recortado, 1–255 puntos de código |
| `lib/modules/notificaciones/domain/file-list-phrase.ts` | T11 | `fileListPhrase(names, failed)` |
| `lib/modules/notificaciones/adapters/driving/purge-route.ts` | T20 | `GET`: secreto → empresas una a una → `purgeExpiredNotifications`; 401/500/200; el fallo de una empresa no corta a las demás (500 con `failedCount`) |
| `app/api/cron/purgar-notificaciones/route.ts` | T20 | Reexporta `GET`, `runtime = 'nodejs'` literal |
| `tests/unit/documentos/batch-finished.test.ts` | T9 | 12 casos |
| `tests/unit/documentos/enqueue-names.test.ts` | T10 | 12 casos |
| `tests/integration/documentos/batch-notice.int.test.ts` | T9/T10 | 8 casos, modo `commit` |
| `tests/unit/notificaciones/documentos-event.test.ts` | T11 | 18 casos (10 filas de texto con `it.each`) |
| `tests/unit/notificaciones/file-list-phrase.test.ts` | T11 | 8 casos |
| `tests/unit/composition/documentos-batch-notice.test.ts` | T11 | 5 casos |
| `tests/unit/notificaciones/purge-route.test.ts` | T20 | 8 casos |

### Archivos modificados

- `db/schema.prisma`: una línea, `originalName String? @map("original_name")` en `DocumentFile`.
- `lib/modules/documentos/ports/document-batch-repository.ts`: `NewBatch.originalNames?`, tipo
  `BatchNotice` y puerto `BatchNoticeReader.readBatchNotice` (decisión 1).
- `lib/modules/documentos/adapters/driven/persistence/document-batch-repository-prisma.ts`:
  `createBatch` escribe `originalName` y un `createdAt` creciente por posición (decisión 3);
  `readBatchNotice` (tanda + `groupBy` por estado + 3 fallidos con nombre `ORDER BY created_at, id`);
  `documentBatchRepositoryPrisma` tipado `DocumentBatchRepository & BatchNoticeReader`.
- `lib/modules/documentos/domain/run-document-job.ts`: `batchFinished?` opcional; `terminar` recibe
  la fila reclamada y, tras un `finish` que no es `requeue`, llama a `notifyIfBatchFinished`.
- `lib/modules/documentos/domain/get-batch-status.ts`: `batchFinished?` opcional; aviso tras `expireStale`.
- `lib/modules/documentos/domain/enqueue-input.ts` (`names` opcional + `refine` de longitud) y
  `enqueue-batch.ts` (pasa `originalNames` solo si vino `names`).
- `lib/modules/notificaciones/domain/catalog.ts`: entrada `documentos.tanda_terminada` (esquema
  estricto, textos de §6.4, tono, título, destino, «Ver fórmulas»/«Ver proveedores», audiencia de usuario).
- `lib/composition/index.ts`: `batchFinishedDeps` justo antes de `runDocumentJob` (R48 + `notify`
  con `dedupeKey = documentos.tanda_terminada:<batchId>`), pasado a `runDocumentJob` y
  `getBatchStatus`; `notificaciones` gana `verifyCronSecret` y `listCompanyIds` al final de su bloque.
- `vercel.json`: tarea `/api/cron/purgar-notificaciones`, `30 7 * * *`.
- Tests: `tests/guards/guard-rutas-fuera-de-sesion.test.ts` (entrada núcleo con su prueba),
  `tests/guards/guard-identificador-de-request.test.ts` (migración nueva en la lista),
  `tests/integration/aislamiento.json` (`batch-notice.int.test.ts` en `commit`),
  `tests/unit/pedidos/vercel-cron.test.ts` (reescrito: filtra la tarea de caducidad, no fija el
  total), `tests/unit/composition/notificaciones-wiring.test.ts` (dos claves nuevas de la fachada).
- `lib/modules/documentos/index.ts`: **no se tocó** (decisión 4).

### Mapa R<n> → test (tanda 2)

| R | Test |
| --- | --- |
| R5 | `documentos-batch-notice.test.ts` › «R5: el aviso de fin de tanda se emite con la clave del evento y el dedupeKey de la tanda», «R5: ningún archivo de lib/modules/documentos importa @/lib/modules/notificaciones» |
| R7 | `batch-finished.test.ts` › «R7: un listener que lanza no cambia el RunDocumentJobResult, y el fallo queda en el log», «R7: una lectura de la tanda que lanza tampoco cambia el resultado, también con error», «R7: notifyIfBatchFinished nunca lanza, aunque no tenga log» |
| R17 | `purge-route.test.ts` › «R17: sin el secreto responde 401…», «R17: con un secreto que no casa responde 401», «R17: sin CRON_SECRET configurado responde 500 y no borra», «R17: con el secreto hace una llamada a borrar por empresa, de una en una», «R17: si falla una empresa sigue con las demás y responde 500», «R17: la tarea está declarada en vercel.json una vez al día» (+ `guard-rutas-fuera-de-sesion` verde con la entrada núcleo) |
| R46 | `batch-finished.test.ts` › «R46: con tres archivos, el aviso sale al terminar el tercero y no con los dos primeros», «R46: los archivos que fallan antes del último no avisan…», «R46: el último archivo terminado en done también cierra la tanda», «R46: un requeue no avisa ni consulta la tanda…», «R46: con archivos todavía pendientes no avisa», «R46: un archivo colgado que caduca cierra la tanda y sale un aviso…» (getBatchStatus); `documentos-batch-notice.test.ts` › «R46: runDocumentJob y getBatchStatus reciben el mismo aviso…»; `batch-notice.int.test.ts` › «QC-137 R46: una tanda de otra empresa o inexistente da null» |
| R47 | `documentos-event.test.ts` › «R47: <fila>» ×10 (las seis filas de §6.4, con y sin nombres: tono, título, cuerpo, `{hora}` y `bodyTime`) |
| R48 | `documentos-batch-notice.test.ts` › «R48: sin autor no se llama a notify y queda en el log»; `documentos-event.test.ts` › «R48: sin autor no se crea el aviso y queda el rechazo en el log» |
| R49 | `documentos-event.test.ts` › «R49: una tanda de fórmula lleva a fórmulas con «Ver fórmulas»», «R49: una tanda de catálogo lleva a la lista de proveedores…», «R49: el payload no admite el proveedor…»; `documentos-batch-notice.test.ts` › «R49: el payload que llega a notify no lleva proveedor» |
| R50 | `enqueue-names.test.ts` › «R50: se queda sin carpetas…», «R50: recorta espacios y quita caracteres de control», «R50: rechaza un nombre vacío…», «R50: admite 255 caracteres y rechaza 256», «R50: una longitud distinta de paths se rechaza», «R50: sin names se encola igual y el repositorio no recibe nombres, así quedan NULL» (+6); `batch-notice.int.test.ts` › «QC-137 R50: cada fila guarda su nombre, alineado con su ruta», «QC-137 R50: sin nombres las filas quedan con NULL…», «QC-137 R50: la base rechaza un nombre vacío y uno de más de 255 caracteres» |
| R51 | `file-list-phrase.test.ts` › «R51: uno, dos y tres nombres…», «R51: cuatro fallidos con nombre nombran tres y «y 1 más»», «R51: un nombre y dos fallidos sin nombre…», «R51: un nombre de 61 caracteres se recorta a 59 + «…» y uno de 60 no» (+4); `batch-notice.int.test.ts` › «QC-137 R51: conteos por estado, autor, estrategia y uploadedAt…», «QC-137 R51: los tres primeros fallidos con nombre, en orden de subida…», «QC-137 R51: los fallidos sin nombre se saltan…», «QC-137 R50, R51: una tanda con filas sin nombre da failedNames vacío y el aviso usa el texto genérico»; `documentos-event.test.ts` › «R51: sin ningún fallido con nombre se usa el texto genérico…» |

### Verificación (salida real)

```
$ pnpm run typecheck
> tsc --noEmit                     (sin errores)

$ pnpm run lint
✖ 10 problems (0 errors, 10 warnings)   (los mismos 10 de la tanda 1, en archivos que este diff no toca)
$ pnpm exec eslint <los 25 .ts tocados>   (sin salida, exit 0)

$ pnpm exec vitest run <los 8 tests nuevos/reescritos + las 2 guardias tocadas>
 Test Files  10 passed (10)
      Tests  99 passed (99)

$ pnpm exec vitest run --project node tests/unit/documentos tests/unit/notificaciones tests/unit/composition tests/unit/pedidos/vercel-cron.test.ts
 Test Files  102 passed (102)
      Tests  1139 passed | 30 skipped (1169)
 (los tests existentes de documentos, sin cambios, en verde)

$ pnpm exec vitest related --run --project node --project ui <23 .ts tocados, sin los .int> db/schema.prisma vercel.json
 FAIL  |ui| tests/unit/marca/tablas-marca.test.tsx > lista cerrada de columnas en Plex Mono > R11, R13: en 'product-columns.tsx' llevan tabular exactamente las columnas de la lista
 Test Files  1 failed | 383 passed (384)
      Tests  1 failed | 6372 passed | 2 skipped (6375)
 (único rojo: el ajeno conocido; sigue sin estar en tests/baseline-rojos.json)

$ pnpm exec vitest run --project integration tests/integration/documentos/batch-notice.int.test.ts
test-db: plantilla lista: qct_tpl_93de319bb683   (construida de nuevo: la migración cambió la huella)
 Test Files  1 passed (1)
      Tests  8 passed (8)

$ pnpm exec vitest run --project integration tests/integration/documentos tests/integration/notificaciones
test-db: plantilla reutilizada: qct_tpl_93de319bb683 (las migraciones no han cambiado)
 Test Files  8 passed (8)
      Tests  54 passed (54)

$ pnpm exec vitest run guard
 Test Files  80 passed (80)
      Tests  1096 passed | 20 skipped (1116)
```

**db:migrate / db:rollback** sobre `qct_qc137_migcheck_t2` (copia de la plantilla `qct_tpl_93de319bb683`,
borrada al terminar; la base de desarrollo no se tocó). Estado leído con `pg` en cada paso
(columna, CHECK, fila de `_prisma_migrations`):

- inicio: `{"column":1,"check":1,"migrationRow":1}`
- `db:rollback` → «aplicando down.sql de 20261019120200_document_files_original_name y borrando su
  fila de _prisma_migrations», «20261019120200_document_files_original_name revertida»;
  `{"column":0,"check":0,"migrationRow":0}`; `prisma migrate status`: «Following migration have not yet been applied».
- `db:migrate` → «Applying migration `20261019120200_document_files_original_name`», «All migrations
  have been successfully applied»; `{"column":1,"check":1,"migrationRow":1}`. Segunda corrida: «No pending migrations to apply».
- `prisma migrate diff` base → esquema: `document_files` sale cambiada solo por la FK compuesta escrita
  a mano (drift previo); ninguna línea nombra `original_name`.

Para la integración y la migración se cargó el `.env` del checkout principal (el worktree no tiene `.env`).

### Decisiones fuera del spec (a validar)

1. **`readBatchNotice` en un puerto aparte, `BatchNoticeReader`, en el mismo archivo
   `ports/document-batch-repository.ts`.** Añadirlo a `DocumentBatchRepository` rompía el typecheck
   de 7 tests existentes de `documentos` que declaran dobles tipados con ese puerto. El adaptador
   Prisma lo implementa en el mismo archivo y el objeto exportado cumple los dos.
2. **`NewBatch` conserva `paths` y gana `originalNames?` (alineado por índice), en vez de
   `files: { path, originalName }[]`.** Con `files`, `enqueue-batch.test.ts` (R2: claves exactas
   de la entrada; su doble usa `input.paths.map`) y `document-batch-repository-prisma.test.ts` se
   ponían rojos. `originalNames` solo viaja si vino `names`, para que la entrada sin nombres conserve
   sus cuatro claves.
3. **`createBatch` escribe `createdAt = ahora + índice ms` en cada archivo.** Las filas de una tanda
   se insertan en la misma transacción y pueden compartir instante, así que `ORDER BY created_at, id`
   ordenaría por el uuid y no por orden de subida (R51). Lo cubre el caso de los seis fallidos
   terminados en orden inverso.
4. **`lib/modules/documentos/index.ts` no se tocó.** `module-contract.test.ts` congela también los
   tipos del barril; exportar `BatchFinishedListener` lo ponía rojo. La composición tipa el aviso con
   `NonNullable<Parameters<typeof createRunDocumentJob>[0]['batchFinished']>`.
5. **`batchFinishedDeps` se declara junto a `runDocumentJob` y no en el bloque de `notificaciones`
   del final:** `createRunDocumentJob` lo necesita al construirse. Lee `notificaciones.notify` al
   llamar, no al construir. El log de R48 es `forModule('documentos')` (`batch_notice_without_author`).
6. **`bodyTime` es `uploadedAt` solo cuando el cuerpo lleva `{hora}`.** Las filas «Tanda procesada con
   errores» de §6.4 no la llevan, y el CHECK de la tabla exige que la marca y la hora vayan juntas;
   con `bodyTime = uploadedAt` siempre, la inserción fallaría.
7. **Esquema del payload:** `strictObject` (por eso un `supplierId` se rechaza), `recipientUserId`
   uuid, `strategy` con los dos literales (sin importar `documentos`), `done + failed = total`,
   `failedNames.length ≤ failed` y máximo 3 nombres.
8. **El cron recorre `listActiveCompanyIds`** (empresas sin baja), la misma lista que el cron de
   pedidos. Los avisos de una empresa dada de baja no los borra esta tarea.
9. **Puerta y lista de empresas en la fachada `notificaciones`** (`verifyCronSecret`, el mismo de
   pedidos, y `listCompanyIds`); el recorrido vive en el driving `purge-route.ts`. Responde
   `{ deleted }`, o 500 con `{ deleted, failedCount }`, como `order-expiry-cron-route`.
10. **Horario del cron:** `30 7 * * *` (media hora después del de pedidos). El design solo dice «una
    vez al día». Sin `maxDuration`: borrar 3-4 empresas no se acerca al defecto. El plan de Vercel
    y su límite de crons siguen desconocidos (design §11).
11. **`getBatchStatus` avisa en cada consulta de una tanda ya cerrada** (lo que dice §6.2). Cada
    sondeo posterior repite `readBatchNotice` + `notify`, y el `UNIQUE (company_id, dedupe_key)` lo
    deja en `notification_duplicate`.
12. Grafo de código: no se usó; exploración con Grep/Read.

### Veredicto

Bloques C (T9, T10 backend, T11) y F (T20) hechos: typecheck, lint, unitarios, integración, guardias
y la migración con su down en verde; el único rojo de `vitest related` es el ajeno conocido.

### Cierre de la tanda 2 (implementer)
- Tasks marcadas `[x]`: T9, T11 y T20. **T10 sigue abierta**: falta la parte de UI (`components/shared/document-upload/document-upload.tsx`, que manda `names`, y `tests/unit/documentos-ui/document-upload-names.test.tsx`). El leader acotó esta tanda a backend, así que pasa a frontend_dev en la tanda siguiente.
- Decisiones fuera del spec (1–8 de arriba), pendientes de validar con el reviewer y el leader. Las que más se apartan del design: el puerto aparte `BatchNoticeReader`, `NewBatch.originalNames?` en lugar de `files`, que `documentos/index.ts` no se tocó y el horario del cron.

## Tanda 3 — T10 (UI), T12, Bloques D y E (frontend_dev, implementer)

Commits: `61784c61` (T10 UI, T12, T17), `c0da969f` (bloque D, T13–T16), y el de cierre de T18, T19 y T19b.

### Decisión humana 2026-10-19 (prevalece sobre el spec)
Las notificaciones son núcleo: no hay permiso `notificaciones.consultar` ni añadido `notificaciones` por empresa.
En esta tanda, la campana, el panel y el feed no dependen de ese permiso ni del añadido. Todo usuario con sesión ve la campana.
No se revirtió nada de la tanda 1. Una tanda posterior quitará el permiso, el añadido y su migración, con una enmienda al spec.
- **Eliminado por decisión humana 2026-10-19:** la condición de T18 «el layout privado monta `NotificationsProvider` y la campana solo con el permiso efectivo». Se monta para toda sesión.
- **Eliminado por decisión humana 2026-10-19:** el caso de T18 «R19: sin permiso, el layout no monta ni la campana ni el proveedor». Lo sustituyen dos casos de `notification-bell.test.tsx`:
  - «con sesión monta la campana en la cabecera aunque no tenga ningún permiso» (con `[]` y con `['inventario.consultar']`);
  - «el layout no condiciona la campana a ningún permiso ni añadido de notificaciones».

### Archivos creados
- `app/(private)/components/notifications/`:
  - `notification-feed.ts`, `notification-list-state.ts`;
  - `chime.ts`, `chime-coordinator.ts`, `tab-bus.ts`, `relative-time.ts`;
  - `notifications-provider.tsx`, `unread-count-badge.tsx`, `notification-item.tsx`;
  - `notification-bell.tsx`, `notification-list-tail.tsx`, `index.ts`.
- `tests/unit/notificaciones-ui/`:
  - `polling-feed.test.ts`, `notification-list-state.test.ts`;
  - `chime.test.ts`, `chime-coordinator.test.ts`, `tab-bus.test.ts`, `relative-time.test.ts`;
  - `notifications-provider.test.tsx`, `notification-item.test.tsx`;
  - `notification-bell.test.tsx`, `solo-campana.test.ts`.
- `tests/unit/documentos-ui/document-upload-names.test.tsx`, `tests/guards/guard-notificaciones-desacople.test.ts`.

### Archivos modificados
- Producción:
  - `components/shared/document-upload/document-upload.tsx` (manda `names`);
  - `components/ui/popover.tsx` (`anchor`, `collisionPadding`, `positionerClassName`);
  - `components/shared/CATALOGO.md`;
  - `app/globals.css` (`@keyframes notification-count-bump`);
  - `app/(private)/components/index.ts`, `app/(private)/layout.tsx`.
- Tests existentes:
  - `tests/unit/documentos-ui/{document-upload-flow,document-upload-strategy,formulas-upload,supplier-detail-upload}.test.tsx` (añaden `names` al payload esperado);
  - `tests/unit/private-layout.test.tsx`, `tests/unit/navegacion/private-layout-menu.test.tsx` (`vi.mock` de `notification-actions`);
  - `tests/unit/proveedores-ui/guard-convenciones-showcase.test.ts` (T19b).

### Mapa R<n> → test (tanda 3)
| R | Test |
| --- | --- |
| R5 | `guard-notificaciones-desacople.test.ts` (repo verde, sintéticos rojos: alias, subruta, relativa, `import type`, reexport, `import()`, `require()`, varias líneas, fuente real mutado) |
| R19 | eliminado por decisión humana 2026-10-19 (ver arriba) |
| R22 | `notifications-provider.test.tsx` (0 sin insignia, 100 → «99+», insignia y nombre accesible del mismo número); `notification-bell.test.tsx` (`aria-label`) |
| R23 | `notification-bell.test.tsx` «al abrir pinta el primer lote de 10…» |
| R24 | `solo-campana.test.ts` (sin página, sin NavLink ni badge, sin prefijo, `firstVisibleNavHref` de los 5 roles) |
| R25 | `notification-list-state.test.ts`; `notification-bell.test.tsx` «el centinela a la vista pide el lote siguiente…»; `guard-convenciones-showcase.test.ts` «R18 (ampliada por QC-137)» |
| R26 | `notification-list-state.test.ts` (fallo → `tail = 'error'`, `retryMore` con el mismo cursor); `notification-bell.test.tsx` |
| R27 | `notification-list-state.test.ts`; `notification-bell.test.tsx` «No hay más avisos. Se conservan 90 días.» |
| R28 | `notification-list-state.test.ts` ×4 |
| R29 | `notification-item.test.tsx` (icono por tono, no leído con «… Sin leer») |
| R30 | `relative-time.test.ts` (bordes 59 s … 7 días y 1 min, zona fija) |
| R31 | `notification-item.test.tsx`, `notifications-provider.test.tsx`, `notification-bell.test.tsx` «el clic en un aviso lo marca leído, cierra el panel y lleva a su origen» |
| R32 | `notification-list-state.test.ts`, `notifications-provider.test.tsx`, `notification-bell.test.tsx` |
| R33 | `notification-list-state.test.ts` ×4; `notification-bell.test.tsx` ×2 (esqueletos, vacío, error con «Reintentar») |
| R34 | `notification-bell.test.tsx` (escritorio 400×520 con scroll; tablet 820 px como escritorio) |
| R35 | `notification-bell.test.tsx` (ancla = cabecera, `collisionPadding` 8/8/8/16, `w-[calc(100vw-16px)]`, `max-h-(--available-height)`, filas `min-h-11`) |
| R36 | `notification-item.test.tsx`, `notifications-provider.test.tsx` (llegada, fundido y pulso bajo `motion-safe`). **El balanceo de la campana (700 ms) no está hecho.** |
| R37 | `polling-feed.test.ts` (cada 30 s, sin solapes); `notifications-provider.test.tsx` (lista sin cargar → solo conteo; cargada → mezcla arriba) |
| R38 | `polling-feed.test.ts` (oculta no consulta; al volver visible sí) |
| R39 | `tab-bus.test.ts` ×4; `notifications-provider.test.tsx` ×3 |
| R40 | `polling-feed.test.ts` (`unauthorized` y `forbidden` paran) |
| R41–R43 | `chime-coordinator.test.ts` |
| R44 | `chime.test.ts` |
| R45 | `chime-coordinator.test.ts` ×3; `chime.test.ts` |
| R47 | `notification-item.test.tsx` (`{hora}` → `HH:MM`, `<b>` como texto); `relative-time.test.ts` |
| R50, R51 | `document-upload-names.test.tsx` (`names` alineado con `paths`; un archivo que falla no va en ninguno de los dos) |

### Verificación (salida real, resumida, de los subagentes)
- `pnpm run typecheck`: `tsc --noEmit` sin errores.
- `pnpm run lint`: 0 errors, 10 warnings, todos de archivos ajenos.
- `pnpm exec vitest run tests/unit/notificaciones-ui`: Test Files 10 passed (10), Tests 105 passed (105).
- `pnpm exec vitest run guard`: Test Files 81 passed (81), Tests 1101 passed | 20 skipped.
- `vitest run tests/unit/documentos-ui tests/unit/proveedores-ui`: 38 files passed, 343 passed | 6 skipped.
- `vitest related --run`:
  - popover y document-upload: 1 failed | 270 passed files. El fallo es `tests/unit/marca/tablas-marca.test.tsx`: rojo conocido y ajeno, y no está en `tests/baseline-rojos.json`.
  - bloque D: 11 passed (122 tests).
  - bloque E: 1 failed | 17 passed. El fallo es `tests/unit/identity/session-once-per-request-render.test.tsx` por «Hook timed out in 60000ms» en `beforeAll`; corrido solo pasa (12 passed). Se atribuye a la carga de la máquina; lo confirmará CI.
- Rojo de la guardia de T19b comprobado a mano: un importador temporal `tmp-probe-guard.ts` la puso roja; tras borrarlo, verde.

### Decisiones fuera del spec (a validar)
1. **T10: se cambiaron 5 tests existentes**, contra el criterio «sin cambios», porque comparaban el payload exacto `{strategy, paths}`. Añaden `names` al valor esperado y la comparación sigue siendo exacta. Son `document-upload-flow` ×2, `document-upload-strategy`, `formulas-upload` y `supplier-detail-upload`.
2. **T17 por el plan A:** `@base-ui/react` 1.7.0 tiene `anchor` y `collisionPadding` y expone `--available-height`. No hace falta el plan B.
3. **`app/globals.css`**, que no está en «Archivos esperados», gana `@keyframes notification-count-bump` (pulso de 360 ms).
4. **El contexto se amplió:** `summary.arrivals` y `summary.checkedAt` (el «ahora» de la hora relativa), y `list` expone el estado completo del reductor.
5. **Bus:** un resumen que llega de otra pestaña se aplica sin `refresh()`, para que las pestañas no se reboten el resumen sin fin. Un «leído» sí pide `refresh()`. El design §9.3 pide `refresh()` en los dos casos.
6. **`onStop` del feed** es `'unauthorized' | 'forbidden'`; el design solo nombraba `'unauthorized'`.
7. **Proveedor:** solo exige `userId`; `feed`, `actions`, `bus` y `chime` son opcionales, y con `null` quedan desactivados.
8. **`NotificationItem`** navega con `next/link` y su `onSelect` marca y cierra el panel, en vez del `router.push` del design §10.1. Con `href = null` pinta un `<button>`.
9. **Textos de interfaz como constantes exportadas** de cada archivo; no hay archivo de textos nuevo.
10. **El error del primer lote se compone con `EmptyState` + `Button` dentro de `role="alert"`,** en vez de reutilizar `ErrorState`, que exige un error del catálogo y no admite un `retryFirst()`. El design dice «1. Reutiliza»; aquí es «3. Compón».
11. **Punto de corte del teléfono: `useIsMobile()` (768 px)**, el que usa la cabecera (`md:hidden`). El design dice `sm`. La tablet (820 px) se comporta como escritorio.
12. **El ancla del teléfono es `() => trigger.closest('header')`,** así el `<header>` del layout sigue siendo Server Component.
13. **Hora relativa:** `now = max(summary.checkedAt, instante de apertura)`, para no leer el reloj en el render.
14. **Dos tests de layout tocados** (`private-layout.test.tsx`, `navegacion/private-layout-menu.test.tsx`). Ganan un `vi.mock` de `notification-actions`, porque montar el proveedor en jsdom añadía una segunda lectura de sesión. Las aserciones no cambian. T19 pedía «sin cambios» para los tests de navegación: lo valida el reviewer.

### Abierto / bloqueo
- **R36, balanceo de la campana de 700 ms: sin implementar.** `tests/guards/guard-movimiento.test.ts` (QC-228 R1) prohíbe animaciones de más de 400 ms en `app/` y `components/`. Lo decide el leader o el humano: o una excepción nombrada en la guardia, o bajar la duración por debajo de 400 ms (enmienda al spec).
- Rojo ajeno y conocido que sigue: `tests/unit/marca/tablas-marca.test.tsx`.

### Veredicto
Tanda 3 hecha: T10, T12, T13–T19b. Typecheck, lint, `notificaciones-ui` y las guardias en verde. Queda abierto el balanceo de R36. No se hizo push.

## Tanda 4 — parte backend: T24 (servidor), T25, T26, T28 (servidor), T21 (backend_dev)

Sin commit (lo hace el leader). Base de la vuelta atrás de la tanda 1: `a1467b6a` (padre de `4252273a`).

### Archivos creados
- `db/migrations/20261019120300_notifications_addon_removal/{migration.sql,down.sql}` (R54).
- `lib/modules/notificaciones/ports/company-status.ts` (`CompanyStatus.isActive`, R57).
- `lib/modules/identity/domain/is-company-active.ts` (`createIsCompanyActive`; un id que no es UUID da `false` sin tocar el puerto).
- `tests/unit/identity/is-company-active.test.ts`.

### Archivos borrados
- `lib/modules/notificaciones/ports/notifications-switch.ts`.

### Archivos modificados
- `identity`:
  - `domain/permissions.ts` y `domain/company-addons.ts`: contenido de `a1467b6a`, incluidas las dos frases del JSDoc de `SEED_ROLE_PERMISSIONS`;
  - `ports/company-membership-reader.ts`: gana `isCompanyActive`;
  - `domain/is-user-in-company.ts`: las deps usan `Pick<…, 'isUserInCompany'>`;
  - `adapters/driven/persistence/company-prisma.ts`: gana `isCompanyActive`, un `findFirst` con `deletedAt: null`;
  - `adapters/driven/persistence/company-directory-prisma.ts`: gana `listAllCompanyIds`;
  - `index.ts`: exporta `createIsCompanyActive`.
- `notificaciones`:
  - `domain/actor.ts`: sin permiso, y `Actor` sin `permissions`;
  - `domain/errors.ts`: sin `UnauthorizedError`;
  - los cuatro casos de uso: sin `requirePermission`, con `actor: Actor`;
  - `domain/notify.ts`: `NotifyDeps.companies` y el log `notification_company_inactive`;
  - `index.ts`;
  - `adapters/driving/notification-actions.ts`: sin `forbidden`; `currentActor()` con tres casos; el Maestro recibe vacío;
  - `adapters/driving/purge-route.ts` y `domain/purge-expired-notifications.ts`: solo el JSDoc.
- `lib/composition/index.ts`:
  - `identity.isCompanyActive`, con un solo `companyMembershipReader`;
  - `notificationCompanies` en lugar del interruptor;
  - `listCompanyIds: listAllCompanyIds`.
- `app/(private)/components/notifications/notification-feed.ts`: **solo el tipo**, `FeedStopReason = 'unauthorized'`, y su comparación. Es el cambio mínimo autorizado para que compile.
- Tests de otras fichas: los 20 de la lista de T24 (incluidos `e2e/helpers/addons.ts` y `e2e/modulos-por-empresa.spec.ts`) vuelven íntegros a `a1467b6a`. Sobre esa base solo se **añaden** los casos que nombra la tabla de Enmiendas: R21 en `permissions.test.ts` y R18 en `addons/company-addons.test.ts`.
- `tests/guards/guard-identificador-de-request.test.ts`: gana la migración nueva.
- Tests propios:
  - `tests/unit/notificaciones/`: `authorization`, `notify`, `notification-actions`, `purge-route`, `summary`, `notification-cursor`, `add-event`, `channel-factory` y `documentos-event`;
  - `tests/unit/composition/notificaciones-wiring.test.ts`;
  - `tests/integration/identity/`: `notifications-addon-migration`, `company-membership` y `company-directory-addons`.

### Mapa R<n> → test (tanda 4, backend)
| R | Test |
| --- | --- |
| R15 | `tests/unit/notificaciones/authorization.test.ts` › «R15: un actor sin ningún permiso lee su bandeja con empresa, usuario, rol y corte de 90 días» (una vez por operación) y «R15: marcar pasa a la bandeja el mismo alcance» |
| R17 | `tests/unit/notificaciones/purge-route.test.ts` › «R17: recorre también las empresas dadas de baja», más los R17 que ya estaban; `tests/unit/composition/notificaciones-wiring.test.ts` › «R17: la lista de empresas del cron es la de todas, no la de activas»; `tests/integration/identity/company-directory-addons.int.test.ts` › «QC-137 R17: listAllCompanyIds incluye las empresas dadas de baja» |
| R18 | `tests/unit/identity/addons/company-addons.test.ts` › «QC-137 R18: ADDONS no incluye notificaciones»; y los de R54 |
| R19 | `tests/unit/notificaciones/notify.test.ts` › «R19: crea el aviso sin consultar ningún añadido»; `tests/unit/notificaciones/notification-actions.test.ts` › «R19: con sesión y sin ningún permiso las cuatro acciones responden ok». Los dos de `notification-bell.test.tsx` los renombra frontend_dev |
| R21 | `tests/unit/identity/permissions.test.ts` › «QC-137 R21: el catálogo no tiene notificaciones.consultar y cada rol tiene los permisos de antes de QC-137» |
| R40 | `tests/unit/notificaciones/notification-actions.test.ts` › «R40: sin sesión responde unauthorized sin tocar la bandeja» (una vez por acción) |
| R54 | `tests/integration/identity/notifications-addon-migration.int.test.ts` › «QC-137 R54: tras las migraciones no queda permiso, asignación, añadido ni excepción», «QC-137 R54: aplicar la retirada dos veces no falla ni cambia nada» y «QC-137 R54: la retirada limpia también filas que la migración de datos no escribió (asignación o excepción a mano)» |
| R55 | `tests/integration/identity/company-membership.int.test.ts` › «QC-137 R55: un usuario dado de baja de esa empresa da false»; `tests/unit/notificaciones/notify.test.ts` › «R55: con el directorio en false no se crea el aviso y queda en el log» |
| R56 | `tests/unit/notificaciones/notification-actions.test.ts` › «R56: una sesión sin empresa recibe resumen, lote y marcar todas vacíos y con éxito, sin leer la bandeja» y «R56: sin sesión sigue respondiendo unauthorized». Los de la UI son de frontend_dev |
| R57 | `tests/unit/notificaciones/notify.test.ts` › «R57: con la empresa dada de baja no escribe la bandeja, no entrega por ningún canal y registra el descarte» y «R57: si la consulta de la empresa lanza, notify no lanza»; `tests/integration/identity/company-membership.int.test.ts` › «QC-137 R57: isCompanyActive da false para una empresa dada de baja y true para una viva»; `tests/unit/composition/notificaciones-wiring.test.ts` › «R57: el motor pregunta a identity.isCompanyActive»; `tests/unit/identity/is-company-active.test.ts` |

Casos borrados:
- los de R18 (rol ∩ añadido), R20, R52 y R53;
- «R15: sin notificaciones.consultar…» y «R19: con el añadido apagado…», en `authorization.test.ts` y en `notify.test.ts`;
- «R7: si el interruptor del añadido lanza…» y «R19: el interruptor del motor pregunta por el añadido…»;
- «R40: … forbidden» y «R25: sin permiso, una entrada mal formada responde forbidden».

### Verificación (salida real)
- `pnpm run typecheck`: 1 error, en `tests/unit/notificaciones-ui/polling-feed.test.ts(140,82)`: `'forbidden'` ya no es un `NotificationActionCode`. Es un archivo de frontend_dev; el resto compila.
- `pnpm run lint`: 0 errores. Los 10 avisos son previos y de archivos que no toqué.
- Unitarios tocados (`vitest run`, 74 archivos): 1278 pass, 1 fail y 3 skipped. El fallo es `polling-feed.test.ts` › «R40: con forbidden deja de consultar y avisa», de frontend_dev.
- Integración tocada, sobre la base efímera `qct_tpl_4660b575f629` (construida ya con la migración nueva):
  - 7 archivos de `identity`: 87 pass;
  - `notificaciones` + `documentos/batch-notice`: 27 pass.
- `pnpm exec vitest run guard`: 81 archivos, 1101 pass y 20 skipped, sin el README (ver «Abierto»).
- `db:migrate` y `db:rollback` en bases desechables, borradas al terminar:
  - **Base nueva vacía.** `migrate` aplica todo hasta `20261019120300` y quedan 0 filas. `rollback` deja permiso 1, asignaciones 2 (solo existen los roles que crean las migraciones) y añadido 1. `migrate` vuelve a 0.
  - **Con la `20261019120100` aplicada antes.** Copia de la plantilla sembrada, con la retirada revertida: permiso 1, asignaciones 4, añadido 1, excepción 1. `migrate` deja 0; `rollback` lo devuelve; `migrate` vuelve a 0.

### Decisiones fuera del spec (a validar)
1. `isCompanyActive` tiene su propio caso de uso, `domain/is-company-active.ts`, como `is-user-in-company.ts`. Las deps de los dos usan `Pick` del puerto, así los dobles que ya existen no cambian.
2. En `notification-actions.ts` la forma de la entrada se valida en el borde: después de la sesión y antes de mirar la empresa. Así el Maestro recibe `invalid_input` con un cursor o un id mal formados, como pide design §8.2. Un cursor válido del Maestro se decodifica sin leer la bandeja.
3. `Actor.permissions` sale del tipo, porque nada lo lee (design §7 lo permite).
4. JSDoc de `purge-route.ts` y `purge-expired-notifications.ts`: «borra también con el añadido apagado» pasa a decir que recorre también las dadas de baja.
5. Los casos de R18 y R21 se añaden al final de los archivos de otras fichas ya restaurados. Sus nombres, que fija la tabla de Enmiendas, son las únicas menciones a `notificaciones.consultar` o `notificaciones` fuera de las migraciones y del test de R54.

### Abierto / bloqueo
- **T21 bloqueada por una guardia.** `tests/guards/guard-arquitectura-modulos.test.ts` (bloque 1, R1) no admite en la raíz de `lib/modules/<m>/` ningún archivo que no sea `index.ts`, y `lib/modules/notificaciones/README.md` la pone roja. El borrador está escrito, fuera del repo. Lo decide el leader o el humano: una excepción en la guardia, u otra ruta para el README (enmienda a design §4.4 y a T21).
- Para frontend_dev: `polling-feed.test.ts` (el caso `forbidden` y R56), `notification-bell.test.tsx` (R19 en los nombres y R56) y T27.
- Rojo ajeno y conocido: `tests/unit/marca/tablas-marca.test.tsx`.

### Veredicto
La parte servidor de T24, T25, T26 y T28 está hecha y en verde, salvo `polling-feed.test.ts`, que es de frontend_dev. T21 está escrita pero sin colocar, porque la guardia de arquitectura la bloquea.

## Tanda 4 — parte frontend: T24 (navegador), T27, T28 (UI), T22 (frontend_dev)

Sin commit (lo hace el leader).

### Archivos creados
- `e2e/notificaciones.spec.ts` (T22, puntos 1, 2, 3, 4, 5 y 6; el 1b no, ver «Abierto»).
- `e2e/helpers/notifications.ts`: `seedNotifications` y `deleteCompanyNotifications`.

### Archivos modificados
- `tests/unit/notificaciones-ui/polling-feed.test.ts`: fuera el caso `forbidden`; R40 y R56.
- `tests/unit/notificaciones-ui/notification-bell.test.tsx`: los dos casos de montaje con «R19» en el nombre; R36 y R56.
- `app/globals.css`: `@keyframes notification-bell-swing` y `@utility animate-notification-bell-swing` (700 ms, `var(--ease-standard)`, una vez, origen 50 % 10 % como el tablero).
- `app/(private)/components/notifications/notification-bell.tsx`: el icono lleva `motion-safe:animate-notification-bell-swing` cuando `summary.arrivals > 0`, con `key={summary.arrivals}` para que vuelva a arrancar en cada llegada.
- `tests/guards/guard-movimiento.test.ts`: `EXCEPCIONES_DE_DURACION` (una entrada, con su motivo), cabecera, caso R36 con sus negativos y caso del login ajustado.
- `tests/guards/guard-identificador-de-request.test.ts`: la lista cerrada de E2E gana `notificaciones.spec.ts`.

`rg` de `forbidden|notificaciones\.consultar|isCompanyAddonActive|'notificaciones'` en `app/` y `tests/unit/notificaciones-ui`: solo la aserción negativa de R19 en `notification-bell.test.tsx` y el `existsSync` de `solo-campana.test.ts`. Ningún `forbidden` de notificaciones.

### Mapa R<n> → test (tanda 4, frontend)
| R | Test |
| --- | --- |
| R19 | `notification-bell.test.tsx` › «R19: con sesión monta la campana en la cabecera aunque no tenga ningún permiso (las notificaciones son núcleo)» y «R19: el layout no condiciona la campana a ningún permiso ni añadido de notificaciones»; `e2e/notificaciones.spec.ts` › «5. sin permiso ni añadido…» |
| R36 | `notification-bell.test.tsx` › «R36: al llegar un aviso la campana se balancea bajo motion-safe, y no al cargar»; `guard-movimiento.test.ts` › «QC-137 R36: la excepción del balanceo de la campana admite solo ese nombre, en esos archivos y a 700 ms» (negativos: `notification-bell-swingy` y `otra-animacion` a 700 ms, el mismo nombre en `app/otro.css` y `components/x.css`, el mismo a 701 ms) y «el bloque del login y la excepción del balanceo de la campana son lo único que la guardia deja fuera» |
| R40 | `polling-feed.test.ts` › «R40: se para con unauthorized» |
| R56 | `polling-feed.test.ts` › «R56: un resumen vacío no detiene la consulta»; `notification-bell.test.tsx` › «R56: con el resumen vacío del Maestro, campana sin insignia, "ninguna sin leer" y panel "No tienes notificaciones." sin error» |
| R13, R24, R25, R27, R46, R49 | `e2e/notificaciones.spec.ts`, casos 1–4 y 6 (sin ejecutar, ver «Abierto») |

### Verificación (salida real)
- `pnpm run typecheck`: 0 errores.
- `pnpm run lint`: 0 errores, 10 avisos, todos de archivos que no toqué.
- `pnpm exec vitest run tests/unit/notificaciones-ui`: 10 archivos, 107 pass.
- `pnpm exec vitest related --run <mis archivos>`: 23 archivos, 394 pass.
- `pnpm exec vitest run guard`: 81 archivos, 1102 pass y 20 skipped. La primera vuelta dio 1 rojo, `guard-identificador-de-request` (el spec nuevo no estaba en la lista cerrada); se arregló dándolo de alta.
- `pnpm exec playwright test e2e/notificaciones.spec.ts`: el servidor arranca (`Ready in 5.3s`), pero el `beforeAll` cae en los dos navegadores con `PrismaClientInitializationError … Environment variable not found: DATABASE_URL`. 2 fallan y 10 no corren (serie). El worktree no tiene `.env` y en el shell no hay `DATABASE_URL`.

### Decisiones fuera del spec (a validar)
1. La duración del balanceo vive en `globals.css` (`@utility`), y no en una clase arbitraria `animate-[…_700ms…]` en el `.tsx`. El detector de duraciones de la guardia solo mide declaraciones de CSS; una clase arbitraria se le escaparía, y medirlas todas pondría en rojo `status-badge` (1,6 s) y `spinner` (0,9 s). Así la excepción es la que deja pasar los 700 ms. El `.tsx` sigue en `archivos`, como dice design §9.5, aunque hoy solo nombra la utilidad.
2. Los casos del E2E corren en serie (`mode: 'serial'`), porque comparten la empresa A y el conteo del Administrador de A.
3. El punto 5 comprueba en la base que no quedan permiso, asignación, añadido ni excepción de notificaciones, antes de abrir la campana.

### Abierto / bloqueo
- **T22 1b, sin escribir.** El lector enlatado (`ai-reader-canned.ts`) devuelve siempre éxito y no ve el nombre del archivo. El almacenamiento en memoria tampoco falla nunca una ruta firmada. No hay forma de que falle uno de dos PDFs sin cambiar un doble de `documentos`, y eso es backend. Hace falta, por ejemplo, que el doble falle con una marca.
- **E2E sin ejecutar:** falta `DATABASE_URL` en el worktree. Tampoco sé si la base de desarrollo tiene aplicadas las migraciones de QC-137.

### Veredicto
T24 (navegador), T27 y T28 (UI) están hechas y en verde. T22 está escrita salvo el 1b, pero sin ejecutar: falta la base del E2E.

## Tanda 4 — T22 punto 1b (backend_dev)

Sin commit (lo hace el leader).

### Archivos
- Modificado `lib/modules/documentos/adapters/driven/storage/document-storage-memory.ts` (doble de E2E; producción intacta): fábrica `createDocumentStorageMemory({ originalNameOf })`, la constante exportada `UNREADABLE_E2E_NAME_MARK = 'e2e-ilegible'` y `documentStorageMemory` atado a una lectura de `document_files.original_name` por ruta (Prisma, en el propio módulo `documentos`). Si el nombre original lleva la marca, `download` devuelve bytes que no son un PDF; sin la marca, el mismo PDF mínimo de antes. La comprobación de rutas firmadas no cambia.
- Creado `tests/unit/documentos/document-storage-memory.test.ts` (6 casos: sin marca, sin nombre, con marca, marca parecida, ruta sin firmar, instancias separadas).
- Modificado `e2e/notificaciones.spec.ts`: caso «1b» entre el 1 y el 2; proveedor y nombres de archivo del worker; `supplier.deleteMany` en `beforeAll` (huérfanos) y en `afterAll`; el interceptor solo cuenta los `PUT`.

### Cómo falla el archivo marcado
El nombre es lo único del archivo que llega al servidor: los bytes los intercepta el navegador y la ruta la pone el servidor (`buildDocumentPath`). Los bytes ilegibles hacen fallar `countPages`/`renderPages` en `read-pdf-with-ai` → `unexpected`, que es definitivo (`error`). Un fallo de descarga no servía: es `requeue` y la cola en línea no reintenta, así que la tanda no terminaría. Solo afecta a la estrategia que lee por imágenes (catálogo); en fórmula, la parte `pdf` va directa al lector enlatado.

### R → test
- R13, R46, R49 (aviso de tanda parcial, nombre original, destino proveedores): `e2e/notificaciones.spec.ts` › «1b. …» (sin ejecutar).

### Verificación (salida real)
- `pnpm run typecheck`: 0 errores.
- `pnpm run lint`: 0 errores y 10 avisos; `eslint` sobre los 3 archivos tocados: 0.
- `pnpm exec vitest run tests/unit/documentos/document-storage-memory.test.ts`: 6 pass.
- `pnpm exec vitest related --run --project node --project ui <3 archivos>`: 359 archivos; 6079 pass, 1 skipped y 1 fail. El fallo es `tests/unit/marca/tablas-marca.test.tsx` › «R11, R13: en 'product-columns.tsx'…», ya anotado como ajeno. Sin `--project`, el proyecto `integration` cae en el `globalSetup` por falta de `DATABASE_URL`.
- `pnpm exec vitest run guard`: 81 archivos, 1102 pass y 20 skipped.
- `pnpm exec playwright test e2e/notificaciones.spec.ts`: el servidor arranca (`Ready in 1411ms`); el `beforeAll` cae con `PrismaClientInitializationError: Environment variable not found: DATABASE_URL`. 2 fallan y 12 no corren.

### Bloqueo
- No hay base para el E2E. El shell no tiene `DATABASE_URL`. Hay un Postgres en `localhost:5432`, pero pide contraseña (`SCRAM`), y la base efímera (`scripts/test-db`) también parte de `DATABASE_URL`. No he leído `.env` ni secretos de otros worktrees.

### Veredicto
El 1b está escrito y el doble falla de forma determinista con la marca (tests unitarios y guardias en verde). El E2E sigue sin ejecutar: falta `DATABASE_URL`.

## Tanda 4 — cierre (implementer)

Commits: `19e2c07b` (servidor: T24, T25, T26, T28), `d1434ee1` (navegador: T24, T27, T28 y E2E puntos 1–6), y este (T22 1b, doble de documentos y marcado de tasks). Sin push.

- Cerradas `[x]`: T24, T25, T26, T27, T28.
- **T21 abierta, bloqueada.** `tests/guards/guard-arquitectura-modulos.test.ts` (R1) no admite archivos en la raíz de `lib/modules/<m>/` salvo `index.ts`. Por eso `lib/modules/notificaciones/README.md` (design §4.4) la pone roja. El borrador está fuera del repo, en el scratchpad de la sesión. Lo decide el humano: una excepción en la guardia o una ruta nueva (y entonces se enmiendan §4.4 y T21).
- **T22 abierta.** El spec está escrito entero (1, 1b, 2–6), pero no se ha podido ejecutar: el worktree no tiene `DATABASE_URL`. El servidor arranca y el `beforeAll` cae con `PrismaClientInitializationError`. Hace falta que el humano dé la base del E2E, con las migraciones aplicadas hasta `20261019120300`.
- T23: es del humano.
- Rojo ajeno conocido: `tests/unit/marca/tablas-marca.test.tsx`. No se ha tocado.

### Verificación consolidada (salida de los subagentes, última vuelta)
| Comando | Resultado |
| --- | --- |
| `pnpm run typecheck` | 0 errores |
| `pnpm run lint` | 0 errores; 10 avisos que ya estaban, ninguno en archivos de la tanda |
| `vitest run tests/unit/notificaciones-ui` | 10 archivos, 107 pass |
| Unitarios de servidor tocados | 74 archivos: 1278 pass, 1 fail. El fallo era `polling-feed`, arreglado después en `d1434ee1` |
| Integración (base efímera) | identity: 7 archivos, 87 pass; notificaciones + batch-notice: 27 pass |
| `vitest related --run` (node + ui) del 1b | 359 archivos: 6079 pass, 1 fail (`tablas-marca`, el ajeno) |
| `pnpm exec vitest run guard` | 81 archivos: 1102 pass, 20 skipped |
| `db:migrate` / `db:rollback` de `20261019120300` | En verde en los dos casos: sobre base nueva y con `20261019120100` aplicada antes |
| `playwright test e2e/notificaciones.spec.ts` | No ejecutado: falta `DATABASE_URL` |

### Decisiones fuera del spec de esta tanda (a validar por el reviewer)
- **Servidor:**
  - `is-company-active.ts` va como caso de uso propio.
  - La entrada se valida antes de mirar la empresa: el Maestro recibe `invalid_input` si la entrada es mala.
  - `Actor.permissions` sale del tipo.
  - Los nombres de los tests de R18 y R21 nombran el permiso (los fija la tabla de Enmiendas).
- **UI:**
  - Los 700 ms van en una `@utility` de `globals.css`, no en una clase arbitraria, para que la guardia los mida.
  - El E2E corre en modo serial.
  - El punto 5 comprueba primero la base.
  - `notificaciones.spec.ts` entra en la lista cerrada de E2E de `guard-identificador-de-request`.
- **1b:**
  - `document-storage-memory.ts` (doble de E2E) pasa a ser una fábrica: con un nombre original que contiene `e2e-ilegible` devuelve bytes que no son PDF.
  - Solo funciona con la estrategia de catálogo.
  - Busca el nombre en `document_files.original_name`.
