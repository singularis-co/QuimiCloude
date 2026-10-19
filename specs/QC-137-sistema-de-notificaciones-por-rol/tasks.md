# QC-137 — sistema-de-notificaciones-por-rol · tasks.md

> `[P]`: puede ir en paralelo con las demás `[P]` de su bloque una vez cumplidas sus
> dependencias. Cada tarea termina con `pnpm run typecheck`, `pnpm run lint` y
> `pnpm exec vitest related --run <archivos tocados>` en verde. Los nombres de test llevan su
> `R<n>`. Antes de dar un bloque por bueno: `pnpm exec vitest run guard`.
>
> **Revisión del 2026-10-16 (solo campana):** sin página `/notificaciones`, sin ítem de menú y sin
> tocar `private-nav.ts`, `AppSidebar` ni `firstVisibleNavHref` (QC-75). El panel trae el historial
> por lotes de 10 con cursor y carga al hacer scroll.
>
> **Respuestas del humano del 2026-10-19:** las preguntas 4 a 11 están cerradas (filas del
> 2026-10-19 en `requirements.md > Decisiones cerradas`). No queda ninguna que bloquee T1.

## Bloque A — Datos y permisos

- [ ] **T1. Esquema y migración de las tablas** (design §3, §3.1, §3.2.1)
  - Modelos `Notification` y `NotificationRead` en `db/schema.prisma`, con `/// @module
    notificaciones` y marcas `@db.Timestamptz(6)`.
  - Migración `<ts>_notifications` con su `down.sql`: CHECK de un destinatario, `UNIQUE
    (company_id, dedupe_key)`, FK compuesta de lecturas, índices `(…, created_at DESC, id DESC)`,
    RLS activada y forzada.
  - **Hecho:** `pnpm run db:migrate` y `db:rollback` limpios contra la base de test.
    `tests/integration/notificaciones/notifications-schema.int.test.ts` prueba:
    - R12: rechaza un aviso sin destinatario y uno con los dos;
    - R3: rechaza un `dedupe_key` repetido en la misma empresa y lo admite en otra;
    - R14: rechaza una lectura con empresa distinta a la del aviso;
    - R47: rechaza un `body` con `{hora}` sin `body_time` y al revés;
    - la cascada de borrado de las lecturas.
- [ ] **T2. Permiso y añadido** (design §7, §3.2.2).
  Depende de T1.
  - `permissions.ts`: `notificaciones.consultar` y los cuatro roles de empresa en
    `SEED_ROLE_PERMISSIONS`.
  - `company-addons.ts`: `notificaciones` en `ADDONS`, `ADDON_PERMISSIONS` y
    `ADDON_REQUIRES.notificaciones = []`.
  - Migración de datos `<ts>_notifications_addon` con su `down.sql`, que prende el añadido en cada
    empresa existente, como la de QC-277.
  - Actualizar los tests de QC-277 que cuentan cinco añadidos.
  - **Hecho:** tests de R18 (permiso efectivo = rol ∩ añadido), R20 (una empresa nueva no lo
    tiene), R21 (cuatro roles sí, Maestro no) y R53 (prender y apagar notificaciones con
    «Integraciones» apagada no exige ni cambia nada más). El test de integración de la migración
    cubre R52: tras aplicarla, todas las empresas existentes tienen el añadido prendido, y una
    empresa creada después no. Además, verdes:
    - el test de integración que compara la migración con las constantes;
    - `guard-catalogo` de añadidos.
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
- [ ] **T5. Bandeja con Prisma** (design §3, §8, §8.1). Depende de T1 y T4.
  - `notification-inbox-prisma.ts`: `insertIfAbsent`, resumen (conteo + más reciente), lote por
    cursor (pide 11, devuelve 10 y el cursor con microsegundos), marcar, marcar todas y borrar
    vencidos por empresa.
  - **Hecho:** `tests/integration/notificaciones/notification-inbox.int.test.ts` cubre:
    - R13: avisos de otra empresa, de otro rol y de otro usuario no salen en el resumen, en
      ningún lote ni en el conteo, tampoco con un cursor fabricado con el `id` de un aviso ajeno;
    - R16: marcar uno dirigido a un rol no lo marca para otro usuario del rol;
    - R17: uno de 91 días no sale y el borrado se lo lleva con sus lecturas, sin tocar otra
      empresa;
    - R23/R25/R27: con 23 avisos, tres lotes de 10, 10 y 3, del más reciente al más antiguo, y el
      último con `nextCursor = null`;
    - R28: dos avisos con el mismo milisegundo y distinto microsegundo, y dos con el mismo
      `created_at`, salen una vez cada uno a través del corte de lote; un aviso insertado entre
      dos lotes no repite ni salta ninguno del lote siguiente;
    - R32: marcar todas toca los visibles no leídos, también los que no estarían en el primer
      lote.
- [ ] **T6. Casos de uso de lectura** `[P]` (design §8, §8.1). Depende de T4.
  - `get-notification-summary`, `list-notifications`, `notification-cursor`,
    `mark-notification-read`, `mark-all-notifications-read`, `purge-expired-notifications`,
    `actor.ts`.
  - **Hecho:**
    - `tests/unit/notificaciones/authorization.test.ts` cubre R15 (sin `notificaciones.consultar`
      lanza antes de llamar a la bandeja, en las cuatro operaciones), R19 (añadido apagado =
      sin permiso efectivo = sin lectura) y R14 (marcar un aviso no visible responde `not_found`
      igual que uno inexistente);
    - `tests/unit/notificaciones/notification-cursor.test.ts` cubre R28: codificar y decodificar
      conserva los microsegundos; un cursor mal formado, con `t` sin forma o `i` no uuid, se
      rechaza sin llamar a la bandeja;
    - `tests/unit/notificaciones/summary.test.ts` cubre R22: el resumen trae el conteo y el más
      reciente, y no trae lista.
- [ ] **T7. Server Actions y enlaces** (design §4.3, §8). Depende de T5 y T6.
  - `notification-actions.ts` (`'use server'`, zod en el borde): resumen, lote, marcar y marcar
    todas. `notification-links.ts`.
  - **Hecho:**
    - `tests/unit/notificaciones/notification-actions.test.ts` cubre R40 (sin sesión, código
      `unauthorized`; sin permiso, `forbidden`), R14 (id que no es uuid: rechazado en el borde) y
      R25 (cursor que no es texto o vacío: `invalid_input`);
    - `tests/unit/notificaciones/notification-links.test.ts` cubre R49: los dos destinos
      (fórmulas y lista de proveedores) y uno desconocido sin enlace;
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
  - **Hecho:** `tests/unit/documentos/batch-finished.test.ts` cubre R46:
    - avisa **una vez** al terminar el último archivo, sea `done` o `error`, y nunca por cada
      archivo que falla antes;
    - no avisa con un `requeue` ni con archivos pendientes;
    - avisa tras una caducidad que cierra la tanda.

    Cubre también R7: el listener que lanza no cambia el `RunDocumentJobResult`. Los tests
    existentes de `documentos` siguen verdes sin cambios.

    `tests/integration/documentos/batch-notice.int.test.ts` cubre `readBatchNotice`: conteos, los
    3 primeros nombres de los fallidos en orden de subida y `uploadedAt` (R51).
- [ ] **T10. Nombre original de cada archivo** `[P]` (design §6.3, §3.2.3). Depende de T9.
  - Migración `<ts>_document_files_original_name` con `down.sql`.
  - `file-name.ts` (`fileNameSchema`), `names` opcional en `enqueue-input.ts`, `NewBatch.files` y
    `createBatch`.
  - `DocumentUpload` manda `names` en el mismo orden que `paths`.
  - **Hecho:**
    - `tests/unit/documentos/enqueue-names.test.ts` cubre R50: se queda sin carpetas
      (`C:\x\a.pdf` → `a.pdf`), recorta, rechaza vacío, más de 255 y longitud distinta de
      `paths`, y sin `names` encola con nombres `NULL`;
    - `tests/unit/documentos-ui/document-upload-names.test.tsx` comprueba que `names` llega a `enqueueBatchAction` alineado con
      `paths`, sin los archivos que fallaron al subir;
    - `tests/integration/documentos/batch-notice.int.test.ts` comprueba que `createBatch` guarda
      `original_name` y que una fila sin nombre (como las anteriores a la migración) queda con
      `NULL` y el aviso usa el texto genérico (R50, R51);
    - los tests existentes de `DocumentUpload`, `CatalogPdfUpload` y `FormulaPdfUpload` siguen
      verdes sin cambios.
- [ ] **T11. Evento del catálogo y suscripción** (design §6.1, §6.3b, §6.4). Depende de T4, T8, T9
  y T10.
  - `file-list-phrase.ts` y la entrada `documentos.tanda_terminada` en `NOTIFICATION_CATALOG`.
  - `batchFinishedListener` en composición, pasado a `runDocumentJob` y `getBatchStatus`.
  - **Hecho:** `tests/unit/notificaciones/documentos-event.test.ts` cubre:
    - R47: las seis filas de la tabla de design §6.4, con nombres y sin nombres, con su tono, su
      título, su `{hora}` y `bodyTime = uploadedAt`;
    - R48: sin autor, ni aviso ni `notify`, con log;
    - R49: formula → fórmulas con «Ver fórmulas»; catálogo → lista de proveedores con «Ver
      proveedores», y el payload no lleva proveedor.

    `tests/unit/notificaciones/file-list-phrase.test.ts` cubre R51: uno, dos y tres nombres;
    cuatro fallidos con nombre → tres y «y 1 más»; un nombre y dos sin nombre → «"a.pdf" y 2
    más»; un nombre de 61 caracteres se recorta a 59 + «…» y uno de 60 no.

    `tests/unit/composition/documentos-batch-notice.test.ts` cubre R5: el `dedupeKey` es el de la
    tanda y `documentos` no importa `notificaciones`.
- [ ] **T12. Guardia de desacople** `[P]` (R5). Depende de T4.
  - `tests/guards/guard-notificaciones-desacople.test.ts`: ningún archivo de `lib/modules/*`,
    salvo `notificaciones`, importa `@/lib/modules/notificaciones`. Incluye su autocomprobación
    con un fuente sintético.
  - **Hecho:** verde en el repo, y rojo con el fuente sintético.

## Bloque D — Navegador: fuente única, consulta, lista, pestañas y tono

Todo en `app/(private)/components/notifications/` (design §1, «Piezas nuevas»).

- [ ] **T13. Feed por consulta periódica** (design §9.1, §9.2). Depende de T7.
  - `notification-feed.ts` (interfaz + `createPollingFeed`) con puertos de visibilidad y temporizador.
  - **Hecho:** `tests/unit/notificaciones-ui/polling-feed.test.ts`, con temporizadores falsos,
    cubre:
    - R37: consulta cada 30 s, sin solapes;
    - R38: no consulta oculta, y consulta al volver visible;
    - R40: se para con `unauthorized` y con `forbidden`;
    - un error deja `summary.status = 'error'` y el ciclo sigue.
- [ ] **T14. Bus entre pestañas y tono** `[P]` (design §9.3, §9.4). Depende de T13.
  - `tab-bus.ts`, `chime-coordinator.ts`, `chime.ts`, todos con puertos inyectables.
  - **Hecho:** `tests/unit/notificaciones-ui/chime-coordinator.test.ts` cubre:
    - R41: suena con un `newest` posterior a la marca;
    - R42: la primera respuesta de la pestaña no suena;
    - R43: dos coordinadores con el mismo almacén y candado suenan una vez;
    - R45: sin audio, toast una vez por sesión, con su texto y botón de cerrar, y sin lanzar.

    `tests/unit/notificaciones-ui/tab-bus.test.ts` cubre R39: un resumen o un «leído» publicados
    actualizan el conteo y los avisos cargados de la otra pestaña.
    `tests/unit/notificaciones-ui/chime.test.ts` cubre R44: el tono se genera con osciladores,
    sin cargar audio, y no existe API para silenciar.
- [ ] **T15. Estado de la lista** (design §8.1, §9.1, §9.2). Depende de T13.
  - `notification-list-state.ts`: reductor puro de `list` (primer lote, `tail`, mezcla arriba,
    sustitución sin solape, marcar uno, marcar todos).
  - **Hecho:** `tests/unit/notificaciones-ui/notification-list-state.test.ts` cubre:
    - R25: `loadMore` con `tail = 'more'` pasa a `loading`; un segundo `loadMore` en `loading`
      no pide nada;
    - R26: un fallo deja `tail = 'error'` con los avisos intactos, y `retryMore` pide con el mismo
      cursor;
    - R27: `nextCursor = null` deja `tail = 'end'`;
    - R28: la mezcla arriba no duplica `id`s; un primer lote sin solape sustituye la lista y su
      cursor;
    - R32: marcar todos deja todos los cargados en `read: true`;
    - R33: el primer lote pasa por `loading` → `ready` / `error`, y `retryFirst` lo vuelve a pedir.
- [ ] **T16. Proveedor, insignia, fila y hora relativa** (design §9.1, §9.5, §9.6). Depende de
  T14 y T15.
  - `NotificationsProvider`, `useNotifications`, `UnreadCountBadge`, `NotificationItem`,
    `relative-time.ts` e `index.ts`.
  - **Hecho:** `tests/unit/notificaciones-ui/` cubre:
    - R22: 0 sin insignia, 100 → «99+», y la insignia y el nombre accesible leen el mismo número
      del contexto;
    - R29: icono por tono, no leído con su marca y su nombre accesible «… Sin leer»;
    - R30: las cinco ramas de la hora y sus bordes (59 s, 59 min, 23 h 59 min, 1 día, 7 días,
      7 días y 1 min → fecha), con una zona horaria fija en el test;
    - R47: `NotificationItem` sustituye `{hora}` por `HH:MM` de `bodyTime` en la zona del
      navegador; el nombre de archivo con `<b>` se pinta como texto;
    - R36: las clases de animación (llegada y fundido de lote) van bajo `motion-safe`;
    - R37: con la lista cargada, un `newest` nuevo pide el primer lote y lo mezcla arriba; con la
      lista sin cargar, solo cambia el conteo.

    Verde también `guard-movimiento`.

## Bloque E — Campana

- [ ] **T17. `PopoverContent` con ancla opcional** `[P]` (design §10.3, «Lo que ya existe»).
  No depende de nada.
  - `components/ui/popover.tsx`: `anchor`, `collisionPadding` y `positionerClassName` opcionales,
    pasados al `Positioner`. Comprobar contra la versión instalada de `@base-ui/react` que existen
    y que `--available-height` se expone; si no, aplicar el plan B de §10.3 y anotarlo en
    `progress/impl_QC-137.md`.
  - Fila de `Popover` en `CATALOGO.md` con el punto de extensión.
  - **Hecho:** los tests existentes que usan `Popover` siguen verdes sin cambios;
    `guard-catalogo-de-componentes` verde.
- [ ] **T18. Campana y panel con carga al hacer scroll** (design §10.1, §10.2, §10.3). Depende de
  T16 y T17.
  - `notification-bell.tsx` y `notification-list-tail.tsx` (centinela con `useInView` de
    `react-intersection-observer`, `root` = área con scroll, `rootMargin` de 120 px, `skip` fuera de
    `tail === 'more'` y `fallbackInView: true`). El layout privado monta `NotificationsProvider` y
    la campana solo con el permiso efectivo.
  - **Hecho:** `tests/unit/notificaciones-ui/notification-bell.test.tsx`, con
    `mockAllIsIntersecting` de `react-intersection-observer/test-utils`, cubre:
    - R22: `aria-label` con y sin no leídos;
    - R23: al abrir, 10 avisos del más reciente al más antiguo; «Marcar todas…» solo con no leídos;
    - R25: el centinela a la vista pide el lote siguiente y pinta «Cargando más avisos…»; con el
      lote en vuelo, otro cruce del centinela no pide nada;
    - R26: el fallo pinta «No se pudieron cargar más avisos.» y «Reintentar», conserva las filas y
      no vuelve a pedir solo;
    - R27: al final pinta «No hay más avisos. Se conservan 90 días.»;
    - R31: clic → marcar y navegar;
    - R32: marcar todas deja el conteo a 0 y las filas como leídas;
    - R33: esqueletos, «No tienes notificaciones.» y «No se pudieron cargar las notificaciones.» con
      «Reintentar»;
    - R34: en escritorio, 400 px de ancho y 520 px de alto con scroll;
    - R35: en el teléfono, el `anchor` es la cabecera, `collisionPadding` 8 a los lados y arriba y
      16 abajo, ancho `calc(100vw - 16px)`, alto máximo `--available-height` y filas de 44 px;
    - R19: sin permiso, el layout no monta ni la campana ni el proveedor.

    Los tests del layout privado siguen verdes.
- [ ] **T19. Solo campana** `[P]` (R24, design §10.4). Depende de T18.
  - **Hecho:** `tests/unit/notificaciones-ui/solo-campana.test.ts` verde: no existe
    `app/(private)/notificaciones/`, ningún `NavLink` de `PRIVATE_NAV_ITEMS` apunta a
    `/notificaciones` ni lleva `badge`, `PRIVATE_ROUTE_PREFIXES` no tiene `/notificaciones` y
    `firstVisibleNavHref` da lo mismo que hoy para los cinco roles. Los tests existentes de
    navegación y de `AppSidebar` siguen verdes **sin cambios**.
- [ ] **T19b. Ampliar la guardia de QC-140** `[P]` (R25, design §10.2, §15). Depende de T18.
  - `tests/unit/proveedores-ui/guard-convenciones-showcase.test.ts`: `ARCHIVO_AUTORIZADO` pasa a
    `ARCHIVOS_AUTORIZADOS` con `showcase-load-trigger.tsx` y
    `app/(private)/components/notifications/notification-list-tail.tsx`; el caso R18 compara con
    `toEqual` la lista ordenada y su nombre y comentario dicen que QC-137 la amplió. El caso D8 no
    cambia.
  - **Hecho:** la guardia verde en el repo; rojo comprobado a mano añadiendo un tercer importador
    temporal y quitándolo después (anotado en `progress/impl_QC-137.md`);
    `pnpm exec vitest run guard` verde.

## Bloque F — Retención

- [ ] **T20. Cron de borrado** (design §11). Depende de T6 y T8.
  - `app/api/cron/purgar-notificaciones/route.ts`, `vercel.json` y la entrada en
    `RUTAS_FUERA_DE_SESION`.
  - `tests/unit/pedidos/vercel-cron.test.ts` se reescribe sin fijar el total de tareas.
  - **Hecho:** `tests/unit/notificaciones/purge-route.test.ts` cubre R17: 401 sin secreto, 500 sin
    variable, y una llamada a borrar por empresa. `guard-rutas-fuera-de-sesion` verde.

## Bloque G — Documentación, E2E y QA

- [ ] **T21. README del módulo** `[P]` (design §4.4). Depende de T11.
  - `lib/modules/notificaciones/README.md`: cómo agregar un evento y cómo agregar un canal.
  - **Hecho:** cada paso del README nombra el archivo real y el test de R6/R10 que lo demuestra.
- [ ] **T22. E2E de aislamiento, primer evento y scroll** (R13, R19, R24, R25, R27, R46, R49,
  R50, R51). Depende de T18, T19 y T11.
  - `e2e/notificaciones.spec.ts`, con los dobles de `e2e/formula-desde-pdf.spec.ts` (lector
    enlatado y cola en línea):
    1. El Administrador de la empresa A sube un PDF de fórmula. Sin recargar, su campana muestra
       1 y el aviso, con «Ver fórmulas», lleva a fórmulas.
    1b. Sube desde un proveedor una tanda de dos PDFs en la que el lector enlatado falla uno: un
       solo aviso «Tanda procesada con errores» que nombra el archivo fallido por su nombre
       original, y «Ver proveedores» lleva a la lista de proveedores.
    2. El Administrador de la empresa B **no** lo ve en el panel de su campana.
    3. Con un aviso dirigido al rol Administrador de A, sembrado por helper, el Operador de A
       **no** lo ve y el Administrador de A sí.
    4. Con 12 avisos sembrados para un usuario, el panel abre con 10; al hacer scroll hasta el
       final aparecen los 2 restantes y «No hay más avisos. Se conservan 90 días.», sin
       repetidos (observador real del navegador).
    5. Con el añadido apagado en A, no hay campana.
    6. `/notificaciones` responde 404 y el menú lateral no tiene «Notificaciones».
  - **Hecho:** `pnpm exec playwright test e2e/notificaciones.spec.ts` verde.
- [ ] **T23. QA multiplataforma manual** (design §10.5). Depende de T22.
  - Comprobación en un iPhone (Safari) y un Android (Chrome):
    - tono tras un toque;
    - toast «Notificaciones sin sonido» sin toque previo;
    - dos pestañas suenan una vez;
    - panel anclado a la pantalla: 8 px por lado, 16 px del borde inferior, scroll dentro y sin
      salirse;
    - carga al hacer scroll dentro del panel, con el dedo.
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
| R6 | T4, T21 |
| R7 | T4, T9 |
| R8 | T4 |
| R9 | T8 |
| R10 | T4 |
| R11 | T4 |
| R12 | T1, T4 |
| R13 | T5, T22 |
| R14 | T1, T6, T7 |
| R15 | T6 |
| R16 | T5 |
| R17 | T5, T20 |
| R18 | T2 |
| R19 | T4, T6, T8, T18, T22 |
| R20 | T2 |
| R21 | T2 |
| R22 | T6, T16, T18 |
| R23 | T5, T18 |
| R24 | T19, T22 |
| R25 | T5, T7, T15, T18, T19b, T22 |
| R26 | T15, T18 |
| R27 | T5, T15, T18, T22 |
| R28 | T5, T6, T15 |
| R29 | T16 |
| R30 | T16 |
| R31 | T18 |
| R32 | T5, T15, T18 |
| R33 | T15, T18 |
| R34 | T18 |
| R35 | T17, T18, T23 |
| R36 | T16 |
| R37 | T13, T16 |
| R38 | T13 |
| R39 | T14 |
| R40 | T7, T13 |
| R41 | T14 |
| R42 | T14 |
| R43 | T14, T23 |
| R44 | T14 |
| R45 | T14, T23 |
| R46 | T9, T22 |
| R47 | T1, T11, T16 |
| R48 | T11 |
| R49 | T7, T11, T22 |
| R50 | T10, T22 |
| R51 | T9, T10, T11, T22 |
| R52 | T2 |
| R53 | T2 |

## Archivos esperados

- `db/schema.prisma`
- `db/migrations/<ts>_notifications/migration.sql`
- `db/migrations/<ts>_notifications/down.sql`
- `db/migrations/<ts>_notifications_addon/migration.sql`
- `db/migrations/<ts>_notifications_addon/down.sql`
- `db/migrations/<ts>_document_files_original_name/migration.sql`
- `db/migrations/<ts>_document_files_original_name/down.sql`
- `lib/modules/notificaciones/index.ts`
- `lib/modules/notificaciones/README.md`
- `lib/modules/notificaciones/domain/catalog.ts`
- `lib/modules/notificaciones/domain/file-list-phrase.ts`
- `lib/modules/notificaciones/domain/notification-event.ts`
- `lib/modules/notificaciones/domain/notify.ts`
- `lib/modules/notificaciones/domain/channel-factory.ts`
- `lib/modules/notificaciones/domain/notification-cursor.ts`
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
- `lib/modules/documentos/domain/file-name.ts`
- `lib/modules/documentos/domain/enqueue-batch.ts`
- `lib/modules/documentos/ports/document-batch-repository.ts`
- `lib/modules/documentos/adapters/driven/persistence/document-batch-repository-prisma.ts`
- `lib/modules/identity/index.ts`
- `lib/modules/identity/domain/permissions.ts`
- `lib/modules/identity/domain/company-addons.ts`
- `lib/modules/identity/domain/is-user-in-company.ts`
- `lib/modules/identity/adapters/driven/persistence/company-prisma.ts`
- `lib/composition/index.ts`
- `components/ui/popover.tsx`
- `components/shared/CATALOGO.md`
- `components/shared/document-upload/document-upload.tsx`
- `app/(private)/layout.tsx`
- `app/(private)/components/index.ts`
- `app/(private)/components/notifications/index.ts`
- `app/(private)/components/notifications/notification-bell.tsx`
- `app/(private)/components/notifications/notification-list-tail.tsx`
- `app/(private)/components/notifications/notification-list-state.ts`
- `app/(private)/components/notifications/notifications-provider.tsx`
- `app/(private)/components/notifications/notification-feed.ts`
- `app/(private)/components/notifications/tab-bus.ts`
- `app/(private)/components/notifications/chime.ts`
- `app/(private)/components/notifications/chime-coordinator.ts`
- `app/(private)/components/notifications/notification-item.tsx`
- `app/(private)/components/notifications/unread-count-badge.tsx`
- `app/(private)/components/notifications/relative-time.ts`
- `app/api/cron/purgar-notificaciones/route.ts`
- `vercel.json`
- `tests/integration/notificaciones/notifications-schema.int.test.ts`
- `tests/integration/notificaciones/notification-inbox.int.test.ts`
- `tests/integration/identity/company-addons.int.test.ts`
- `tests/integration/documentos/batch-notice.int.test.ts`
- `tests/unit/notificaciones/file-list-phrase.test.ts`
- `tests/unit/documentos/enqueue-names.test.ts`
- `tests/unit/documentos-ui/document-upload-names.test.tsx`
- `tests/unit/proveedores-ui/guard-convenciones-showcase.test.ts`
- `tests/unit/notificaciones/notify.test.ts`
- `tests/unit/notificaciones/channel-factory.test.ts`
- `tests/unit/notificaciones/add-event.test.ts`
- `tests/unit/notificaciones/authorization.test.ts`
- `tests/unit/notificaciones/notification-cursor.test.ts`
- `tests/unit/notificaciones/summary.test.ts`
- `tests/unit/notificaciones/notification-actions.test.ts`
- `tests/unit/notificaciones/notification-links.test.ts`
- `tests/unit/notificaciones/documentos-event.test.ts`
- `tests/unit/notificaciones/purge-route.test.ts`
- `tests/unit/notificaciones-ui/polling-feed.test.ts`
- `tests/unit/notificaciones-ui/chime-coordinator.test.ts`
- `tests/unit/notificaciones-ui/chime.test.ts`
- `tests/unit/notificaciones-ui/tab-bus.test.ts`
- `tests/unit/notificaciones-ui/notification-list-state.test.ts`
- `tests/unit/notificaciones-ui/notifications-provider.test.tsx`
- `tests/unit/notificaciones-ui/notification-item.test.tsx`
- `tests/unit/notificaciones-ui/relative-time.test.ts`
- `tests/unit/notificaciones-ui/notification-bell.test.tsx`
- `tests/unit/notificaciones-ui/solo-campana.test.ts`
- `tests/unit/composition/notificaciones-wiring.test.ts`
- `tests/unit/composition/documentos-batch-notice.test.ts`
- `tests/unit/documentos/batch-finished.test.ts`
- `tests/unit/identity/addons/company-addons.test.ts`
- `tests/unit/identity/companies/set-all-company-addons.test.ts`
- `tests/unit/identity/is-user-in-company.test.ts`
- `tests/unit/pedidos/vercel-cron.test.ts`
- `tests/guards/guard-notificaciones-desacople.test.ts`
- `tests/guards/guard-rutas-fuera-de-sesion.test.ts`
- `e2e/notificaciones.spec.ts`
