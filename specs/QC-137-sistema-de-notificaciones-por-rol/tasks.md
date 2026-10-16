# QC-137 — sistema-de-notificaciones-por-rol · tasks.md

> `[P]`: puede ir en paralelo con las demás `[P]` de su bloque una vez cumplidas sus
> dependencias. Cada tarea termina con `pnpm run typecheck`, `pnpm run lint` y
> `pnpm exec vitest related --run <archivos tocados>` en verde. Los nombres de test llevan su
> `R<n>`. Antes de dar un bloque por bueno: `pnpm exec vitest run guard`.
>
> **Antes de T1:** necesitan respuesta del humano las preguntas abiertas 4 (textos y umbral), 5
> (añadido prendido en las empresas existentes), 6 (dependencia de Integraciones), 7 (un aviso por
> tanda) y 9 (`supplier_id`). Las tareas afectadas lo dicen.

## Bloque A — Datos y permisos

- [ ] **T1. Esquema y migración de las tablas** (design §3, §3.1, §3.2.1)
  - Modelos `Notification` y `NotificationRead` en `db/schema.prisma`, con `/// @module
    notificaciones`.
  - Migración `<ts>_notifications` con su `down.sql`: CHECK de un destinatario, `UNIQUE
    (company_id, dedupe_key)`, FK compuesta de lecturas, índices, RLS activada y forzada.
  - **Hecho:** `pnpm run db:migrate` y `db:rollback` limpios contra la base de test.
    `tests/integration/notificaciones/notifications-schema.int.test.ts` prueba:
    - R12: rechaza un aviso sin destinatario y uno con los dos;
    - R3: rechaza un `dedupe_key` repetido en la misma empresa y lo admite en otra;
    - R14: rechaza una lectura con empresa distinta a la del aviso;
    - la cascada de borrado de las lecturas.
- [ ] **T2. Permiso y añadido** (design §7, §3.2.2). Depende de T1. **Pregunta 5 y 6.**
  - `permissions.ts`: `notificaciones.consultar` y los cuatro roles de empresa en
    `SEED_ROLE_PERMISSIONS`.
  - `company-addons.ts`: `notificaciones` en `ADDONS`, `ADDON_PERMISSIONS` y `ADDON_REQUIRES`.
  - Migración de datos `<ts>_notifications_addon` con su `down.sql`.
  - Actualizar los tests de QC-277 que cuentan cinco añadidos.
  - **Hecho:** tests de R18 (permiso efectivo = rol ∩ añadido), R20 (una empresa nueva no lo
    tiene) y R21 (cuatro roles sí, Maestro no). Además, verdes:
    - el test de integración que compara la migración con las constantes;
    - `guard-catalogo` de añadidos;
    - `guard-nav-permisos-declarados`.
- [ ] **T3. `identity.isUserInCompany`** `[P]` (design §7). Depende de T1.
  - **Hecho:** test unitario del caso de uso y test de integración del adaptador (otra empresa →
    `false`).

## Bloque B — Módulo `notificaciones` (dominio y adaptadores)

- [ ] **T4. Catálogo, motor y factory** (design §4, §5). Depende de T1.
  - `catalog.ts`, `notify.ts`, `channel-factory.ts`, puertos y `errors.ts`.
  - **Hecho:** `tests/unit/notificaciones/notify.test.ts`, con puertos simulados, cubre:
    - R2 (un aviso con el destinatario del catálogo) y R3 (duplicado: sin segunda entrega);
    - R4 (evento desconocido o payload inválido: sin aviso, con log, sin lanzar);
    - R7 (la bandeja lanza y `notify` no lanza);
    - R12 (usuario de otra empresa: rechazado);
    - R19 (añadido apagado: no escribe).

    `tests/unit/notificaciones/channel-factory.test.ts` cubre:
    - R8 (entrega por cada canal del catálogo);
    - R10 (un canal ficticio registrado recibe el aviso sin cambiar el motor);
    - R11 (el ficticio lanza: los demás reciben y la bandeja ya estaba escrita).

    `tests/unit/notificaciones/add-event.test.ts` cubre R6: un evento de prueba nuevo en el
    catálogo crea su aviso, y un evento con destinatario por rol se guarda con
    `recipient_role` (R1).
- [ ] **T5. Bandeja con Prisma** (design §3, §8). Depende de T1 y T4.
  - `notification-inbox-prisma.ts`: `insertIfAbsent`, resumen, lista paginada, marcar, marcar
    todas y borrar vencidos por empresa.
  - **Hecho:** `tests/integration/notificaciones/notification-inbox.int.test.ts` cubre:
    - R13: avisos de otra empresa, de otro rol y de otro usuario no salen en el resumen, la lista
      ni el conteo;
    - R16: marcar uno dirigido a un rol no lo marca para otro usuario del rol;
    - R17: uno de 91 días no sale y el borrado se lo lleva con sus lecturas, sin tocar otra
      empresa;
    - R24: orden y paginación de 10, filtro «no leídas»;
    - R31: marcar todas solo toca los visibles.
- [ ] **T6. Casos de uso de lectura** `[P]` (design §8). Depende de T4.
  - `get-notification-summary`, `list-notifications`, `mark-notification-read`,
    `mark-all-notifications-read`, `purge-expired-notifications`, `actor.ts`.
  - **Hecho:** `tests/unit/notificaciones/authorization.test.ts` cubre:
    - R15: sin `notificaciones.consultar` lanza antes de llamar a la bandeja;
    - R14: marcar un aviso no visible responde `not_found` igual que uno inexistente;
    - R22/R23: el resumen trae el conteo y como mucho 5.
- [ ] **T7. Server Actions y enlaces** (design §4.3, §8). Depende de T5 y T6.
  - `notification-actions.ts` (`'use server'`, zod en el borde) y `notification-links.ts`.
  - `NOTIFICATIONS_ROUTE` en `lib/shared/routes.ts` y en `PRIVATE_ROUTE_PREFIXES`.
  - **Hecho:**
    - `tests/unit/notificaciones/notification-actions.test.ts` cubre R38 (sin sesión, código
      `unauthorized`) y R14 (id que no es uuid: rechazado en el borde);
    - `tests/unit/notificaciones/notification-links.test.ts` cubre R47: los tres destinos y uno
      desconocido sin enlace;
    - el test de una lectura de sesión por petición sigue verde.
- [ ] **T8. Cableado en composición** (design §4.2, §5, §6.1). Depende de T3, T5, T6 y T7.
  - `lib/composition/index.ts`:
    - la fachada `notificaciones`;
    - el registro de canales con **solo** `in_app`;
    - el interruptor con `identity.isCompanyAddonActive(…, 'notificaciones')`;
    - el `RecipientDirectory` con `identity.isUserInCompany`.
  - **Hecho:** `tests/unit/composition/notificaciones-wiring.test.ts` cubre R9 (solo `in_app`) y
    R19 (el interruptor usa la clave `notificaciones`).

## Bloque C — Emisor `documentos`

- [ ] **T9. Puerto y detección de fin de tanda** (design §6.1, §6.2). Depende de T1.
  - `batch-finished-listener.ts` y `notify-if-batch-finished.ts`.
  - `readBatchNotice` en el puerto y en `document-batch-repository-prisma.ts`.
  - Llamadas en `run-document-job.ts` y `get-batch-status.ts`, con listener opcional.
  - **Hecho:** `tests/unit/documentos/batch-finished.test.ts` cubre R44:
    - avisa al terminar el último archivo, sea `done` o `error`;
    - no avisa con un `requeue` ni con archivos pendientes;
    - avisa tras una caducidad que cierra la tanda.

    Cubre también R7: el listener que lanza no cambia el `RunDocumentJobResult`. Los tests
    existentes de `documentos` siguen verdes sin cambios.
- [ ] **T10. Proveedor de la tanda de catálogo** `[P]` (design §6.3, §3.2.3). Depende de T9.
  **Pregunta 9.**
  - Migración `<ts>_document_batches_supplier` con `down.sql`.
  - `supplierId` opcional en `enqueue-input.ts`, `NewBatch` y `createBatch`.
  - Prop `supplierId` en `DocumentUpload` y `DocumentUploadDialog`, que pasa
    `CatalogPdfUpload`. Fila de `CATALOGO.md` actualizada.
  - **Hecho:** test del esquema de encolado (uuid opcional, rechaza no-uuid). Un test de la
    pieza compartida comprueba que `supplierId` llega a `enqueueBatchAction`. Los tests existentes
    de `DocumentUpload` siguen verdes.
- [ ] **T11. Evento del catálogo y suscripción** (design §6.1, §6.4). Depende de T4, T8 y T9.
  **Pregunta 4 y 7.**
  - Entrada `documentos.tanda_terminada` en `NOTIFICATION_CATALOG`.
  - `batchFinishedListener` en composición, pasado a `runDocumentJob` y `getBatchStatus`.
  - **Hecho:** `tests/unit/notificaciones/documentos-event.test.ts` cubre:
    - R45: los cuatro desenlaces con su tono y sus textos;
    - R46: sin autor, ni aviso ni `notify`, con log;
    - R47: formula → fórmulas; catálogo con y sin proveedor.

    `tests/unit/composition/documentos-batch-notice.test.ts` cubre R5: el `dedupeKey` es el de la
    tanda y `documentos` no importa `notificaciones`.
- [ ] **T12. Guardia de desacople** `[P]` (R5). Depende de T4.
  - `tests/guards/guard-notificaciones-desacople.test.ts`: ningún archivo de `lib/modules/*`,
    salvo `notificaciones`, importa `@/lib/modules/notificaciones`. Incluye su autocomprobación
    con un fuente sintético.
  - **Hecho:** verde en el repo, y rojo con el fuente sintético.

## Bloque D — Navegador: fuente única, consulta, pestañas y tono

- [ ] **T13. Feed por consulta periódica** (design §9.1, §9.2). Depende de T7.
  - `notification-feed.ts` (interfaz + `createPollingFeed`) con puertos de visibilidad y temporizador.
  - **Hecho:** `tests/unit/notificaciones-ui/polling-feed.test.ts`, con temporizadores falsos,
    cubre:
    - R35: consulta cada 30 s, sin solapes;
    - R36: no consulta oculta, y consulta al volver visible;
    - R38: se para con `unauthorized`;
    - un error deja `status = 'error'` y el ciclo sigue.
- [ ] **T14. Bus entre pestañas y tono** `[P]` (design §9.3, §9.4). Depende de T13.
  - `tab-bus.ts`, `chime-coordinator.ts`, `chime.ts`, todos con puertos inyectables.
  - **Hecho:** `tests/unit/notificaciones-ui/chime-coordinator.test.ts` cubre:
    - R39: suena con un `newest` posterior a la marca;
    - R40: la primera respuesta de la pestaña no suena;
    - R41: dos coordinadores con el mismo almacén y candado suenan una vez;
    - R43: sin audio, toast una vez por sesión y sin lanzar.

    `tests/unit/notificaciones-ui/tab-bus.test.ts` cubre R37: un resumen o un «leído» publicados
    actualizan la otra pestaña. `tests/unit/notificaciones-ui/chime.test.ts` cubre R42: el tono
    se genera con osciladores, sin cargar audio, y no existe API para silenciar.
- [ ] **T15. Proveedor, insignia, fila y hora relativa** (design §9.1, §9.5, §9.6, §10). Depende
  de T13 y T14.
  - `NotificationsProvider`, `useNotificationSummary`, `UnreadCountBadge`, `NotificationItem`,
    `relative-time.ts` e `index.ts`.
  - Filas nuevas en `CATALOGO.md` con su tablero.
  - **Hecho:** `tests/unit/notificaciones-ui/` cubre:
    - R22: 0 sin insignia, 100 → «99+»;
    - R28: icono por tono, no leído con su marca y su nombre accesible «… Sin leer»;
    - R29: las cinco ramas de la hora;
    - R34: las clases de animación van bajo `motion-safe`.

    Verdes también `guard-catalogo-de-componentes` y `guard-movimiento`.

## Bloque E — Pantallas

- [ ] **T16. Campana en la cabecera** (design §10.1). Depende de T15.
  - `notification-bell.tsx`. El layout privado monta `NotificationsProvider` y la campana solo
    con el permiso efectivo.
  - **Hecho:** `tests/unit/notificaciones-ui/notification-bell.test.tsx` cubre:
    - R22: `aria-label` con y sin no leídos;
    - R23: 5 últimos, «Marcar todas…» solo con no leídos, «Ver todas…» a `/notificaciones`;
    - R30: clic → marcar y navegar;
    - R31: marcar todas deja el conteo a 0;
    - R32: cargando, vacío y error con «Reintentar»;
    - R33: clases de ancho y alto en el teléfono;
    - R19: sin permiso, el layout no monta ni la campana ni el proveedor.

    Los tests del layout privado siguen verdes.
- [ ] **T17. Menú** `[P]` (design §10.3). Depende de T15.
  - `private-nav.ts`: `counter` en vez de `badge`, `landing`, el ítem nuevo y
    `firstVisibleNavHref`.
  - `app-sidebar.tsx`: conteo y punto.
  - **Hecho:**
    - test de `AppSidebar`: R25 (el número es el del contexto y no hay fijo) y R26 (punto con la
      barra plegada, nada con 0);
    - `tests/unit/navegacion/orden-secciones.test.ts`: R27 (Seguimiento tras Dashboard; el
      aterrizaje de cada rol no cambia);
    - `guard-nav-serializable` y `guard-nav-permisos-declarados` verdes.
- [ ] **T18. Página `/notificaciones`** (design §10.2). Depende de T15 y T7.
  - `page.tsx` con `requirePagePermission('notificaciones.consultar')`.
  - `components/` con lista, filtro (`UrlTabs`), paginación y «Marcar todas».
  - **Hecho:** `tests/unit/notificaciones-ui/notifications-page.test.tsx` cubre:
    - R24: orden, 10 por página, filtro y texto de 90 días;
    - R25: el `count` de «No leídas» es el del contexto;
    - R32: los dos vacíos con sus textos;
    - R35: un `newest` nuevo en la página 1 refresca la lista;
    - R19: sin permiso, 404.

    `guard-rutas-privadas-cubiertas` verde.

## Bloque F — Retención

- [ ] **T19. Cron de borrado** (design §11). Depende de T6 y T8.
  - `app/api/cron/purgar-notificaciones/route.ts`, `vercel.json` y la entrada en
    `RUTAS_FUERA_DE_SESION`.
  - `tests/unit/pedidos/vercel-cron.test.ts` se reescribe sin fijar el total de tareas.
  - **Hecho:** `tests/unit/notificaciones/purge-route.test.ts` cubre R17: 401 sin secreto, 500 sin
    variable, y una llamada a borrar por empresa. `guard-rutas-fuera-de-sesion` verde.

## Bloque G — Documentación, E2E y QA

- [ ] **T20. README del módulo** `[P]` (design §4.4). Depende de T11.
  - `lib/modules/notificaciones/README.md`: cómo agregar un evento y cómo agregar un canal.
  - **Hecho:** cada paso del README nombra el archivo real y el test de R6/R10 que lo demuestra.
- [ ] **T21. E2E de aislamiento y del primer evento** (R13, R44). Depende de T16, T17, T18 y T11.
  - `e2e/notificaciones.spec.ts`, con los dobles de `e2e/formula-desde-pdf.spec.ts` (lector
    enlatado y cola en línea):
    1. El Administrador de la empresa A sube un PDF de fórmula. Sin recargar, su campana muestra
       1 y el aviso lleva a fórmulas.
    2. El Administrador de la empresa B **no** lo ve, ni en la campana ni en `/notificaciones`.
    3. Con un aviso dirigido al rol Administrador de A, sembrado por helper, el Operador de A
       **no** lo ve y el Administrador de A sí.
    4. Con el añadido apagado en A, no hay campana y `/notificaciones` da 404 (R19).
  - **Hecho:** `pnpm exec playwright test e2e/notificaciones.spec.ts` verde.
- [ ] **T22. QA multiplataforma manual** (design §10.4). Depende de T21.
  - Comprobación en un iPhone (Safari) y un Android (Chrome):
    - tono tras un toque;
    - toast «Notificaciones sin sonido» sin toque previo;
    - dos pestañas suenan una vez;
    - panel al 60 % de alto;
    - punto con la barra plegada en tablet.
  - **Hecho:** resultado anotado en `progress/impl_QC-137.md`, con lo que no se pudo comprobar
    dicho como tal.

## Trazabilidad prevista

| R | Tarea(s) |
| --- | --- |
| R1 | T4, T11 |
| R2 | T4 |
| R3 | T1, T4 |
| R4 | T4 |
| R5 | T11, T12 |
| R6 | T4, T20 |
| R7 | T4, T9 |
| R8 | T4 |
| R9 | T8 |
| R10 | T4 |
| R11 | T4 |
| R12 | T1, T4 |
| R13 | T5, T21 |
| R14 | T1, T6, T7 |
| R15 | T6 |
| R16 | T5 |
| R17 | T5, T19 |
| R18 | T2 |
| R19 | T4, T8, T16, T18, T21 |
| R20 | T2 |
| R21 | T2 |
| R22 | T6, T15, T16 |
| R23 | T6, T16 |
| R24 | T5, T18 |
| R25 | T17, T18 |
| R26 | T17 |
| R27 | T17 |
| R28 | T15 |
| R29 | T15 |
| R30 | T16 |
| R31 | T5, T16 |
| R32 | T16, T18 |
| R33 | T16, T22 |
| R34 | T15 |
| R35 | T13, T18 |
| R36 | T13 |
| R37 | T14 |
| R38 | T7, T13 |
| R39 | T14 |
| R40 | T14 |
| R41 | T14, T22 |
| R42 | T14 |
| R43 | T14, T22 |
| R44 | T9, T21 |
| R45 | T11 |
| R46 | T11 |
| R47 | T7, T11 |

## Archivos esperados

- `db/schema.prisma`
- `db/migrations/<ts>_notifications/migration.sql`
- `db/migrations/<ts>_notifications/down.sql`
- `db/migrations/<ts>_notifications_addon/migration.sql`
- `db/migrations/<ts>_notifications_addon/down.sql`
- `db/migrations/<ts>_document_batches_supplier/migration.sql`
- `db/migrations/<ts>_document_batches_supplier/down.sql`
- `lib/modules/notificaciones/index.ts`
- `lib/modules/notificaciones/README.md`
- `lib/modules/notificaciones/domain/catalog.ts`
- `lib/modules/notificaciones/domain/notification-event.ts`
- `lib/modules/notificaciones/domain/notify.ts`
- `lib/modules/notificaciones/domain/channel-factory.ts`
- `lib/modules/notificaciones/domain/list-notifications.ts`
- `lib/modules/notificaciones/domain/get-notification-summary.ts`
- `lib/modules/notificaciones/domain/mark-notification-read.ts`
- `lib/modules/notificaciones/domain/mark-all-notifications-read.ts`
- `lib/modules/notificaciones/domain/purge-expired-notifications.ts`
- `lib/modules/notificaciones/domain/retention.ts`
- `lib/modules/notificaciones/domain/actor.ts`
- `lib/modules/notificaciones/domain/errors.ts`
- `lib/modules/notificaciones/ports/notification-channel.ts`
- `lib/modules/notificaciones/ports/notification-inbox.ts`
- `lib/modules/notificaciones/ports/notifications-switch.ts`
- `lib/modules/notificaciones/ports/recipient-directory.ts`
- `lib/modules/notificaciones/ports/notification-log.ts`
- `lib/modules/notificaciones/adapters/driven/persistence/notification-inbox-prisma.ts`
- `lib/modules/notificaciones/adapters/driven/channels/in-app-channel.ts`
- `lib/modules/notificaciones/adapters/driven/observability/notification-log-console.ts`
- `lib/modules/notificaciones/adapters/driving/notification-actions.ts`
- `lib/modules/notificaciones/adapters/driving/notification-links.ts`
- `lib/modules/notificaciones/adapters/driving/purge-route.ts`
- `lib/modules/documentos/index.ts`
- `lib/modules/documentos/domain/batch-finished-listener.ts`
- `lib/modules/documentos/domain/notify-if-batch-finished.ts`
- `lib/modules/documentos/domain/run-document-job.ts`
- `lib/modules/documentos/domain/get-batch-status.ts`
- `lib/modules/documentos/domain/enqueue-input.ts`
- `lib/modules/documentos/domain/enqueue-batch.ts`
- `lib/modules/documentos/ports/document-batch-repository.ts`
- `lib/modules/documentos/adapters/driven/persistence/document-batch-repository-prisma.ts`
- `lib/modules/identity/index.ts`
- `lib/modules/identity/domain/permissions.ts`
- `lib/modules/identity/domain/company-addons.ts`
- `lib/modules/identity/domain/is-user-in-company.ts`
- `lib/modules/identity/adapters/driven/persistence/company-prisma.ts`
- `lib/composition/index.ts`
- `lib/shared/routes.ts`
- `lib/shared/navigation/private-nav.ts`
- `components/private/app-sidebar.tsx`
- `components/shared/CATALOGO.md`
- `components/shared/notifications/index.ts`
- `components/shared/notifications/notifications-provider.tsx`
- `components/shared/notifications/notification-feed.ts`
- `components/shared/notifications/tab-bus.ts`
- `components/shared/notifications/chime.ts`
- `components/shared/notifications/chime-coordinator.ts`
- `components/shared/notifications/notification-item.tsx`
- `components/shared/notifications/unread-count-badge.tsx`
- `components/shared/notifications/relative-time.ts`
- `components/shared/document-upload/document-upload.tsx`
- `components/shared/document-upload/document-upload-dialog.tsx`
- `app/(private)/layout.tsx`
- `app/(private)/components/index.ts`
- `app/(private)/components/notification-bell.tsx`
- `app/(private)/notificaciones/page.tsx`
- `app/(private)/notificaciones/components/index.ts`
- `app/(private)/notificaciones/components/notification-list.tsx`
- `app/(private)/notificaciones/components/notification-filter-tabs.tsx`
- `app/(private)/notificaciones/components/notification-pagination.tsx`
- `app/(private)/notificaciones/components/mark-all-read-button.tsx`
- `app/(private)/proveedores/[id]/components/catalog-pdf-upload.tsx`
- `app/api/cron/purgar-notificaciones/route.ts`
- `vercel.json`
- `tests/integration/notificaciones/notifications-schema.int.test.ts`
- `tests/integration/notificaciones/notification-inbox.int.test.ts`
- `tests/integration/identity/company-addons.int.test.ts`
- `tests/unit/notificaciones/notify.test.ts`
- `tests/unit/notificaciones/channel-factory.test.ts`
- `tests/unit/notificaciones/add-event.test.ts`
- `tests/unit/notificaciones/authorization.test.ts`
- `tests/unit/notificaciones/notification-actions.test.ts`
- `tests/unit/notificaciones/notification-links.test.ts`
- `tests/unit/notificaciones/documentos-event.test.ts`
- `tests/unit/notificaciones/purge-route.test.ts`
- `tests/unit/notificaciones-ui/polling-feed.test.ts`
- `tests/unit/notificaciones-ui/chime-coordinator.test.ts`
- `tests/unit/notificaciones-ui/chime.test.ts`
- `tests/unit/notificaciones-ui/tab-bus.test.ts`
- `tests/unit/notificaciones-ui/notification-item.test.tsx`
- `tests/unit/notificaciones-ui/relative-time.test.ts`
- `tests/unit/notificaciones-ui/notification-bell.test.tsx`
- `tests/unit/notificaciones-ui/notifications-page.test.tsx`
- `tests/unit/notificaciones-ui/app-sidebar-counter.test.tsx`
- `tests/unit/composition/notificaciones-wiring.test.ts`
- `tests/unit/composition/documentos-batch-notice.test.ts`
- `tests/unit/documentos/batch-finished.test.ts`
- `tests/unit/identity/addons/company-addons.test.ts`
- `tests/unit/identity/companies/set-all-company-addons.test.ts`
- `tests/unit/identity/is-user-in-company.test.ts`
- `tests/unit/navegacion/orden-secciones.test.ts`
- `tests/unit/pedidos/vercel-cron.test.ts`
- `tests/guards/guard-notificaciones-desacople.test.ts`
- `tests/guards/guard-rutas-fuera-de-sesion.test.ts`
- `e2e/notificaciones.spec.ts`
