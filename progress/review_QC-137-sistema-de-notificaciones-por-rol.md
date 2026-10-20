# Review QC-137 — sistema-de-notificaciones-por-rol

- Rama `feature/QC-137-sistema-de-notificaciones-por-rol`, HEAD `74075c80`. Diff: `git diff origin/dev...HEAD`, con 136 archivos.
- Fecha: 2026-10-20. Revisado contra:
  - `requirements.md`, con la enmienda del 2026-10-19 (E1–E8);
  - `design.md`, incluida la §16;
  - `tasks.md`;
  - la bitácora `progress/impl_QC-137-sistema-de-notificaciones-por-rol.md`;
  - `CHECKPOINTS.md`, `docs/checkpoints-proyecto.md` y `docs/perfil-agentes.md > reviewer`.

## Veredicto: **APROBADO** (OK)

No hay hallazgos bloqueantes. Hay 6 menores, ninguno impide el merge, pero el n.º 1 hay que
resolverlo antes de abrir el PR.

## Verificación ejecutada por el reviewer (salida real)

| Comando | Resultado |
| --- | --- |
| `pnpm run typecheck` | exit 0, 0 errores |
| `pnpm run lint` | exit 0: 0 errores y 10 avisos, todos previos y de archivos fuera del diff |
| `pnpm exec vitest run guard` | 84 archivos, 1144 pass y 21 skipped |
| `vitest run --project node --project ui` sobre `tests/unit/{notificaciones,notificaciones-ui,documentos,documentos-ui,composition,identity}`, más `guard-convenciones-showcase`, `vercel-cron`, `private-layout` y `private-layout-menu` | 275 archivos: 3987 pass y 2 fail, más 3 archivos caídos en el `beforeAll`. Los 5 son timeouts de 20 s y 60 s al importar `@/lib/composition` con 275 archivos en paralelo |
| Los 4 archivos que fallaron, corridos solos (`identity-facade`, `session-once-per-request-actions`, `session-once-per-request-render` y `documentos/module-contract`) | 4/4 en verde: 154 tests, 142 pass y 12 skipped. Es carga de la máquina, no un fallo de la rama |
| `git merge-tree HEAD origin/dev` | 3 conflictos (hallazgo 1) |
| Integración (`.int`) y E2E | **No ejecutados por el reviewer:** el worktree no tiene `DATABASE_URL` y no hay autorización para cargar el `.env` del checkout principal (hallazgo 5). La bitácora registra la integración en verde (identity 87 pass, notificaciones + batch-notice 27 pass) y `playwright test e2e/notificaciones.spec.ts` con 14 passed tras el merge de dev |

## Checklist

### Proceso (reviewer.md 1–4)
- [x] **Trazabilidad:** cada R vigente (R1–R57 salvo R20, R52 y R53) tiene al menos un test con nombre que lo cita y cuerpo real. La tabla está abajo.
- [x] **Tasks:** todas en `[x]` salvo T23, que es la QA manual del humano y no se exige.
- [x] **Checkpoints:** recorridos abajo.
- [x] **Verificación ejecutable:** typecheck, lint, guardias y unitarios relacionados, en verde. Los `.int` y el E2E no los pude correr (hallazgo 5).

### CHECKPOINTS.md
- [x] `requirements.md` en EARS y numerado; `design.md` con alternativas descartadas (§13); `tasks.md`.
- [x] `design.md` abre con `## Lo que ya existe`, que está completa. El diff no re-crea nada de esa lista:
  - de `pagination.ts` solo usa `DEFAULT_PAGE_SIZE`;
  - reutiliza `react-intersection-observer` y amplía la guardia de QC-140;
  - `ShowcaseLoadTrigger` no se reutiliza, con justificación (A15);
  - `listActiveCompanyIds` queda intacta.
- [x] La bitácora tiene el mapa `R<n> → test`, por tandas.
- [x] Typecheck y lint en verde.
- [ ] `gate-completo` en CI: todavía no hay PR. Rojo conocido y ajeno: `tests/integration/proveedores/catalog-line.int.test.ts` (R32, línea 784). No es de esta feature.
- [x] Flujo crítico (permisos): hay E2E de Playwright, `e2e/notificaciones.spec.ts`, con su salida local en la bitácora.
- [x] No hay dependencias nuevas: `package.json` no aparece en el diff.
- [x] Sin secretos. El cron usa `verifyCronSecret` y `CRON_SECRET` del entorno.
- [x] Sin webhooks nuevos.
- [x] Nada hardcodeado entre entornos. El horario del cron vive en `vercel.json`.
- [ ] Cierre en `progress/features/QC-137.md` y desmontaje del worktree: los hace el leader después del merge.

### docs/checkpoints-proyecto.md
- [x] UI multiplataforma:
  - campana `size-11` (44 px);
  - filas `min-h-11`;
  - botones con `touch`;
  - no usa `100vh` como alto: `100vw` solo en el ancho del panel del teléfono;
  - `hover:` es solo estilo, porque la activación es por clic o tap;
  - el panel no tiene inputs.
- [x] `CATALOGO.md`: la fila `Popover` está al día con las tres props opcionales. Las piezas nuevas tienen un solo consumidor y viven en la ruta, sin fila, como dice `Lo que ya existe`.
- [x] Pase `/design`: los tableros `docs/diseno/canvas/Notificaciones*.dc.html` están citados en `requirements.md` y `design.md`.
- [x] Tablas nuevas con `company_id`:
  - `notifications` y `notification_reads`; la FK compuesta `(notification_id, company_id)` impide una lectura de otra empresa;
  - toda consulta de `notification-inbox-prisma.ts` pasa por `visible()`, que filtra por `company_id`, o por `deleteExpired(companyId, …)`;
  - el rechazo cruzado está probado en `notification-inbox.int.test.ts` (R13 y R14) y en el E2E (casos 2 y 3).
- [x] Permisos en `domain/`: tras E1 no hay permiso. La sesión con empresa se exige en el borde (hallazgo 2).
- [x] RLS `ENABLE` + `FORCE` en las dos tablas nuevas.
- [x] Sin cliente de Supabase en el acceso a datos: todo va por adaptadores Prisma.
- [x] Las cuatro migraciones nuevas tienen `down.sql`, y su orden es correcto (sección «Migraciones»).
- [x] Módulos hexagonales:
  - `domain/` y `ports/` de `notificaciones` no importan framework;
  - `documentos` e `identity` no importan `notificaciones` (lo prueba `guard-notificaciones-desacople`);
  - el barrel no reexporta `'use server'`;
  - los modelos nuevos llevan `/// @module notificaciones`;
  - nada nuevo en la raíz de `lib/`.
- [x] La lógica vive en `domain/`: `notify`, los casos de uso, `notify-if-batch-finished` y `file-list-phrase`. Las Server Actions solo resuelven sesión y forma.
- [x] Mutaciones por Server Actions; la campana recibe `userId` por props.

### perfil-agentes > reviewer (5–11)
- [x] 5. Calidad y seguridad:
  - RLS en las tablas nuevas;
  - el cron tiene puerta por secreto;
  - las capas están separadas;
  - los logs solo llevan `error.name`, sin datos de la consulta.
- [x] 6. Multiplataforma: sin bloqueantes (ver arriba).
- [x] 7. Dependencias: ninguna nueva.
- [x] 8. Aislamiento por empresa: cumple (ver arriba).
- [x] 9. Comentarios: busqué `QC-<n>`, `R<n>`, `design.md` y «decisión cerrada» en las líneas añadidas de `app/`, `lib/`, `components/`, `db/` y `vercel.json`. Ninguna coincidencia.
- [x] 10. Duplicados: `ErrorState` está descartado con motivo (D-T3-10) y `ShowcaseLoadTrigger` también (A15).
- [x] 11. Diseño: tiene referencia de tablero, y el cambio de `Popover` no altera lo visible de los usos actuales.

## Comprobaciones pedidas por el leader

| Punto | Resultado |
| --- | --- |
| Aislamiento por `companyId` | OK. `visible()` filtra por `company_id`, `created_at >= cutoff` y destinatario (`notification-inbox-prisma.ts`). `markRead` y `markAllRead` insertan con un `SELECT` sobre los visibles. El cursor solo fija el corte, y hay un test con un cursor fabricado (R13) |
| Dedupe | OK. `UNIQUE (company_id, dedupe_key)` con `ON CONFLICT DO NOTHING`. Si no se guarda nada, no se entrega por ningún canal (`notify.ts`, R3). La clave es `documentos.tanda_terminada:<batchId>` |
| Polling solo con la pestaña visible | OK. `notification-feed.ts`: `run()` y `cycle()` exigen `visibility.isVisible()`; al ocultarse cancela el turno y al volver consulta de inmediato. El siguiente turno se programa al terminar, sin solapes (R37, R38) |
| Retención | OK. El corte a 90 días se calcula en el dominio (`retention.ts`) y se aplica en toda lectura. El cron diario `30 7 * * *` recorre `listAllCompanyIds`, también las dadas de baja (R17, E4) |
| Ausencia de permiso y añadido (núcleo) | OK. `permissions.ts` y `company-addons.ts` vuelven a su contenido previo, comprobado por igualdad exacta en los tests de R21 y R18. La migración `20261019120300` borra las filas. El layout monta la campana sin condición (R19) |
| Maestro con campana vacía | OK. `currentActor()` distingue tres casos (`none`, `no_company` y `company`). Sin empresa, responde vacío sin leer la bandeja, y el feed no se para (R56) |
| Empresas de baja sin avisos | OK. `notify` pregunta `companies.isActive` antes de resolver destinatario y bandeja, y descarta con el log `notification_company_inactive` (R57) |
| Excepción de `guard-movimiento` | OK y acotada. Es una lista cerrada de una entrada, `notification-bell-swing`: solo 700 ms exactos, solo en `app/globals.css` y `notification-bell.tsx`, y no exime la curva ni el bucle. Los casos negativos muerden: otro nombre, otro archivo y 701 ms. Sin la lista, la única infracción es esta |
| Migraciones | OK (sección siguiente) |
| Archivos compartidos con QC-203 y QC-288 | Cambios mínimos (sección siguiente) |

### Migraciones
- Las cuatro tienen `down.sql`:
  - `20261019120000_notifications`;
  - `20261019120100_notifications_addon`, ya publicada, que no se edita (R54);
  - `20261019120200_document_files_original_name`;
  - `20261019120300_notifications_addon_removal`, con `DELETE … WHERE`: es idempotente y su `down` reescribe lo que escribe `…120100`.
- Orden respecto a dev: `20261019120000_notifications` comparte timestamp con `20261019120000_whatsapp_connections_drop_meta_app_id`, y el orden lexicográfico pone la de notificaciones primero. Las dos migraciones no comparten tablas.
- Las de dev `20261019130000_customers_phone_e164`, que entró en dev después del merge, y `20261019140000_whatsapp_contacts_and_messages` quedan detrás de las cuatro de QC-137.
- En una base que ya tenga las de dev, las de QC-137 se aplican fuera de orden. La bitácora lo probó con 140000 en `qc137_merge_ooo`.

### Archivos compartidos (QC-203 / QC-288)
- **`lib/composition/index.ts`:**
  - dos imports ampliados;
  - `companyMembershipReader`;
  - `identity.isUserInCompany` e `identity.isCompanyActive`;
  - `batchFinishedDeps`, inyectado en `runDocumentJob` y `getBatchStatus`;
  - la fachada `notificaciones`, al final del archivo. Los imports a mitad de archivo siguen el patrón que ya existe (`integraciones`, línea 2705 de dev).
  - Nada se reescribe.
- **`db/schema.prisma`:** una columna nullable (`DocumentFile.originalName`) y dos modelos nuevos al final.
- **`lib/modules/documentos/*`:**
  - `originalNames?` opcional en `NewBatch`;
  - `names` opcional en el esquema de encolado;
  - el puerto aparte `BatchNoticeReader`;
  - `batchFinished` opcional en `run-document-job` y `get-batch-status`;
  - en `terminar`, el cambio de firma de `fileId` a `ClaimedFile`, que es interno;
  - el doble `document-storage-memory` convertido en fábrica.
  - `documentos/index.ts` no se toca (D-T2-4).

## Decisiones fuera del spec pendientes de validar

Las marcadas **Humano** (E1–E8, D-T1-2, D-T1-3, D-T1-5, D-T2-2, D-T2-3, D-T2-8, D-T3-H, D-T3-R36, P12 y P13), y las de T21 y T22 que tomó el humano, no se discuten.

| Id | Veredicto | Motivo |
| --- | --- | --- |
| D-T1-B1 | **Valida** | No hace falta un código de error nuevo para un resultado esperado. `'marked' \| 'not_found'` tipa R14 sin excepciones, y tras E1 `forbidden` ya no aparece en `NotificationActionCode` |
| D-T1-B3 | **Valida** | El reloj inyectado hace testeable el corte de 90 días, y el dominio calcula `cutoff` una sola vez por operación |
| D-T1-B4 | **Valida** | Los nombres son coherentes y en inglés (QC-4). `NotifyDeps.addon` ya no existe: hoy es `companies` |
| D-T1-B5 | **Valida** | Es la «señal medible» de `design §12.3`. Solo lleva `companyId`, sin datos personales |
| D-T1-B6 | **Valida** | `newest` leído o no, con el tono condicionado a `unreadCount > 0`: evita sonar por un aviso ya leído en otra pestaña |
| D-T2-1 | **Valida** | El puerto aparte no obliga a tocar los dobles de `DocumentBatchRepository`. `createdBy` no viaja al cliente |
| D-T2-4 | **Valida** | Respeta el contrato congelado (`module-contract.test.ts`, que corrí en verde). El tipo se deriva y no se duplica |
| D-T2-5 | **Valida** | Leer `notificaciones` al llamar evita depender del orden de declaración. El log de R48 queda en `documentos` |
| D-T2-6 | **Valida** | Es coherente con el CHECK `notifications_body_time_matches_body` |
| D-T2-7 | **Valida** | `strictObject` con invariantes (`done + failed = total`, como mucho 3 nombres) refuerza R4 |
| D-T2-9 | **Valida** | La puerta y la lista en la fachada, y el recorrido aislado por empresa en el adaptador. El 500 con `failedCount` no expone ids |
| D-T2-10 | **Valida** | La media hora tras el cron de pedidos evita el solape. Sin `maxDuration` es aceptable hoy. Si crecen las empresas, revisar con §13 A7 |
| D-T2-11 | **Valida** | Hace falta para R46 por caducidad. El `UNIQUE` lo hace idempotente. Coste: unas 5 consultas por cada sondeo de una tanda ya cerrada, y el sondeo del cliente se detiene al cerrar la tanda |
| D-T3-1 | **Valida** | El cambio es inevitable (el payload gana `names`) y la comparación sigue siendo exacta |
| D-T3-2 | **Valida** | `package.json` declara `@base-ui/react ^1.7.0`, y `PopoverContent` pasa `anchor` y `collisionPadding` al `Positioner` |
| D-T3-3 | **Valida** | `notification-count-bump` dura 360 ms, por debajo del tope. Ya está en «Archivos esperados» |
| D-T3-4 | **Valida** | `arrivals` y `checkedAt` son lo mínimo para animar y fechar sin leer el reloj en el render |
| D-T3-5 | **Valida** | Un resumen por el bus ya trae el dato. Un «leído» pide `refresh()` para recalcular el conteo real |
| D-T3-6 | **Valida, sin objeto** | Tras T24, `FeedStopReason = 'unauthorized'` (`notification-feed.ts`) |
| D-T3-7 | **Valida** | Los opcionales con `null` permiten probar el provider sin navegador real. Los valores por defecto son los del navegador |
| D-T3-8 | **Valida** | `next/link` da navegación nativa y accesible. Con `href = null`, se pinta un `<button>` |
| D-T3-9 | **Valida** | Hay precedente en el repo y los tests importan las mismas constantes |
| D-T3-10 | **Valida** | `ErrorState` exige un error del catálogo de `errores`. Componer con `EmptyState` y `Button` es el paso 3 de la regla de decisión, y queda documentado en `Lo que ya existe` |
| D-T3-11 | **Valida** | `useIsMobile()` es el hook del repo. Con 768 px, la tablet va como escritorio, que es lo que pide R34 |
| D-T3-12 | **Valida** | Mantiene el `<header>` como Server Component |
| D-T3-13 | **Valida** | Evita leer el reloj en el render (hidratación) y es coherente con R30 |
| D-T3-14 | **Valida** | Solo añade un `vi.mock`, sin cambiar aserciones |
| T4: `is-company-active.ts` como caso de uso propio | **Valida** | Es simétrico con `is-user-in-company.ts` y el guard de UUID evita el cast fallido |
| T4: entrada validada antes de mirar la empresa | **Valida** | Lo pide `design §8.2`: una entrada mal formada da `invalid_input` también al Maestro |
| T4: `Actor.permissions` sale | **Valida** | Nada lo lee (`design §7`) |
| T4: los nombres de los tests de R18 y R21 citan el permiso | **Valida** | Los fija la tabla de Enmiendas |
| T4: los 700 ms en una `@utility` de `globals.css` | **Valida** | Así la guardia mide la duración. Una clase arbitraria se le escaparía |
| T4: E2E en `serial` | **Valida** | Los casos comparten empresa y conteo |
| T4: el punto 5 comprueba primero la base | **Valida** | Prueba R18 y R54 desde la base, no solo desde la UI |
| T4: `notificaciones.spec.ts` en la lista de `guard-identificador-de-request` | **Valida** | Es el alta obligatoria de esa guardia |
| T4 1b: el doble de almacenamiento como fábrica con la marca `e2e-ilegible` | **Valida, con matiz** (hallazgo 3) | Es el único camino determinista para un fallo parcial, y solo actúa con `documentsE2EDoublesEnabled()`. Le falta el filtro por empresa en su consulta |

## Hallazgos

1. **menor — la rama vuelve a ir por detrás de `origin/dev`.**
   - Desde el merge `74075c80`, `origin/dev` avanzó hasta `c1dcf6ad` (QC-236, PR #276).
   - `git merge-tree HEAD origin/dev` da 3 conflictos: `lib/composition/index.ts`, `tests/guards/guard-identificador-de-request.test.ts` y `docs/diseno/canvas/canvas.json`.
   - Además entra la migración `20261019130000_customers_phone_e164`, que queda en buen orden: detrás de `…120300` y antes de `…140000`.
   - **Qué hacer:** volver a integrar dev antes de abrir el PR, conservando las dos partes, como en la integración anterior.
2. **menor — R15 («validar en el caso de uso … que hay un usuario con sesión en una empresa») se cumple por tipo, no con una comprobación en tiempo de ejecución dentro de `domain/`.**
   - Dónde: `lib/modules/notificaciones/adapters/driving/notification-actions.ts:58` (`currentActor`) y los casos de uso en `domain/*.ts`, que reciben un `Actor` no nulo.
   - Lo admite `design §8.2` («el caso sin empresa se resuelve en el borde»). Tras E1 no hay permiso que validar, y TS strict impide llamar sin actor.
   - Si en el futuro un caso de uso se llama desde otro borde, convendría un guard en `inboxScopeOf`.
3. **menor — consulta sin `companyId`.**
   - Dónde: `lib/modules/documentos/adapters/driven/storage/document-storage-memory.ts:45`, `prisma.documentFile.findFirst({ where: { path } })`.
   - Es un doble de E2E, solo activo con `documentsE2EDoublesEnabled()`. La ruta empieza por la empresa, así que en la práctica no cruza.
   - Aun así, rompe la regla general de Dominio n.º 1. **Qué hacer:** filtrar también por el prefijo de empresa de la ruta.
4. **menor — un nombre de archivo que no pasa el esquema rechaza toda la tanda.**
   - Dónde: `lib/modules/documentos/domain/file-name.ts:16`, con el `refine` sobre `names` de `enqueue-input.ts`.
   - Si un nombre queda vacío tras sanear, o pasa de 255 puntos de código, `enqueueBatch` lanza `ValidationError` para la tanda entera. R50 no pide rechazarla. Es un caso límite, porque los sistemas de archivos comunes no llegan a 255.
   - **Qué hacer:** recortar el nombre o guardarlo como `null`, en vez de fallar.
5. **menor — los `.int` y el E2E no los ejecutó el reviewer.**
   - Falta `DATABASE_URL` en el worktree, y no estoy autorizado a cargar el `.env` del checkout principal.
   - Quedan sin verificar por mí `notification-inbox`, `notifications-schema`, `notifications-addon-migration`, `company-membership`, `company-directory-addons`, `batch-notice` y `e2e/notificaciones.spec.ts`.
   - La bitácora los registra en verde. `gate-completo` tiene que confirmarlos en el PR.
6. **menor — timeouts al importar `@/lib/composition` en corridas grandes en paralelo.**
   - Con 275 archivos a la vez, 5 archivos superan los timeouts de 20 s y 60 s; corridos solos, pasan.
   - No es un defecto de la rama, pero `composition` crece y conviene vigilarlo en los shards de CI.

**Cuenta: 0 bloqueantes, 6 menores.**

## Tabla R<n> → test

Las rutas son relativas a `tests/` salvo `e2e/`. Todos los nombres los comprobé en el código. Los marcados con † son `.int` o E2E: existen y tienen cuerpo real, pero no los ejecuté yo (hallazgo 5).

| R | Test |
| --- | --- |
| R1 | `unit/notificaciones/add-event.test.ts` (R1, R6) |
| R2 | `unit/notificaciones/notify.test.ts` › «R2: un evento del catálogo crea un único aviso dirigido al usuario que fija el catálogo» |
| R3 | `notify.test.ts` › «R3: el mismo evento con la misma clave deja un solo aviso y no se vuelve a entregar»; `integration/notificaciones/notification-inbox.int.test.ts` › «QC-137 R3: insertIfAbsent …» †; `notifications-schema.int.test.ts` (R3) † |
| R4 | `notify.test.ts` › los 3 casos R4 (fuera del catálogo, `toString` heredado, payload sin forma); `documentos-event.test.ts` (R4) |
| R5 | `guards/guard-notificaciones-desacople.test.ts` (5 casos R5, también los negativos); `unit/composition/documentos-batch-notice.test.ts` (2 casos R5) |
| R6 | `add-event.test.ts` (R6) |
| R7 | `notify.test.ts` › «R7: si la bandeja lanza, notify no lanza y el fallo queda en el log»; `unit/documentos/batch-finished.test.ts` (4 casos R7) |
| R8 | `unit/notificaciones/channel-factory.test.ts` (2 casos R8) |
| R9 | `unit/composition/notificaciones-wiring.test.ts` (R9) |
| R10 | `channel-factory.test.ts` (R10, con un canal ficticio) |
| R11 | `channel-factory.test.ts` (R11) |
| R12 | `notify.test.ts` › «R12: un destinatario que no es de la empresa del evento se rechaza…»; `notifications-schema.int.test.ts` (3 casos R12) †; `company-membership.int.test.ts` (2) †; `unit/identity/is-user-in-company.test.ts` (2); `notificaciones-wiring.test.ts` (R12) |
| R13 | `notification-inbox.int.test.ts` › «QC-137 R13: avisos de otra empresa, de otro rol y de otro usuario no salen…, tampoco con un cursor fabricado» †; `e2e/notificaciones.spec.ts` casos 1, 1b, 2 y 3 † |
| R14 | `unit/notificaciones/authorization.test.ts` › «R14: …not_found, igual que uno inexistente»; `notification-actions.test.ts` › «R14: …»; `notification-inbox.int.test.ts` › «QC-137 R14: …no escribe lectura» †; `notifications-schema.int.test.ts` (2) † |
| R15 | `authorization.test.ts` › «R15: un actor sin ningún permiso lee su bandeja con empresa, usuario, rol y corte de 90 días» y «R15: marcar pasa a la bandeja el mismo alcance» |
| R16 | `notification-inbox.int.test.ts` › «QC-137 R16: marcar uno dirigido a un rol lo deja leído solo para quien lo marca» † |
| R17 | `unit/notificaciones/purge-route.test.ts` (9 casos R17, incluido «recorre también las empresas dadas de baja»); `notificaciones-wiring.test.ts` › «R17: la lista de empresas del cron es la de todas…»; `integration/identity/company-directory-addons.int.test.ts` › «QC-137 R17: listAllCompanyIds incluye las empresas dadas de baja» †; `notification-inbox.int.test.ts` › «QC-137 R17: uno de 91 días no sale…» † |
| R18 | `unit/identity/addons/company-addons.test.ts` › «QC-137 R18: ADDONS no incluye notificaciones»; `notifications-addon-migration.int.test.ts` (R54) † |
| R19 | `notify.test.ts` › «R19: crea el aviso sin consultar ningún añadido»; `notification-actions.test.ts` › «R19: con sesión y sin ningún permiso las cuatro acciones responden ok»; `unit/notificaciones-ui/notification-bell.test.tsx` (2 casos R19); E2E caso 5 † |
| R20 | *Retirado* |
| R21 | `unit/identity/permissions.test.ts` › «QC-137 R21: el catálogo no tiene notificaciones.consultar y cada rol tiene los permisos de antes de QC-137» |
| R22 | `notification-bell.test.tsx` (R22); `notifications-provider.test.tsx` (3); `unit/notificaciones/summary.test.ts` (2); `notification-actions.test.ts` › «R22: el resumen viaja…» |
| R23 | `notification-bell.test.tsx` (R23); `notification-inbox.int.test.ts` › «QC-137 R23, R25, R27: con 23 avisos salen tres lotes de 10, 10 y 3…» † |
| R24 | `unit/notificaciones-ui/solo-campana.test.ts` (3); E2E casos 1 y 6 † |
| R25 | `notification-list-state.test.ts` (3); `notification-bell.test.tsx` (R25); `notification-actions.test.ts` › «R25, R49: …»; `notification-inbox.int.test.ts` †; E2E caso 4 † |
| R26 | `notification-bell.test.tsx` (R26); `notification-list-state.test.ts` (R26) |
| R27 | `notification-bell.test.tsx` (R27); `notification-list-state.test.ts` (R27); `notification-inbox.int.test.ts` †; E2E caso 4 † |
| R28 | `unit/notificaciones/notification-cursor.test.ts` (2); `notification-list-state.test.ts` (4); `notification-inbox.int.test.ts` (2 casos R28) † |
| R29 | `unit/notificaciones-ui/notification-item.test.tsx` (3) |
| R30 | `unit/notificaciones-ui/relative-time.test.ts` (3) |
| R31 | `notification-item.test.tsx`, `notification-bell.test.tsx`, `notification-list-state.test.ts` y `notifications-provider.test.tsx` (R31 en cada uno) |
| R32 | `notification-bell.test.tsx`, `notification-list-state.test.ts`, `notifications-provider.test.tsx` y `notification-actions.test.ts` (R32); `notification-inbox.int.test.ts` › «QC-137 R32: …también los que no están en el primer lote…» † |
| R33 | `notification-bell.test.tsx` (2); `notification-list-state.test.ts` (4) |
| R34 | `notification-bell.test.tsx` (2 casos R34) |
| R35 | `notification-bell.test.tsx` (R35); `notification-item.test.tsx` (R35, 44 px) |
| R36 | `notification-bell.test.tsx` › «R36: al llegar un aviso la campana se balancea bajo motion-safe, y no al cargar»; `notification-item.test.tsx` (2); `notifications-provider.test.tsx` (R36); `guards/guard-movimiento.test.ts` › «QC-137 R36: la excepción del balanceo de la campana admite solo ese nombre, en esos archivos y a 700 ms» |
| R37 | `unit/notificaciones-ui/polling-feed.test.ts` (3 casos R37); `notifications-provider.test.tsx` (2) |
| R38 | `polling-feed.test.ts` › «R38: con la pestaña oculta no consulta, y consulta en el acto al volver visible» y «R38: al ocultarse cancela el turno…» |
| R39 | `unit/notificaciones-ui/tab-bus.test.ts` (4); `notifications-provider.test.tsx` (3) |
| R40 | `polling-feed.test.ts` › «R40: se para con unauthorized»; `notification-actions.test.ts` › «R40: sin sesión responde unauthorized sin tocar la bandeja» |
| R41 | `unit/notificaciones-ui/chime-coordinator.test.ts` (2); `notifications-provider.test.tsx` (R41) |
| R42 | `chime-coordinator.test.ts` (2) |
| R43 | `chime-coordinator.test.ts` (2) |
| R44 | `unit/notificaciones-ui/chime.test.ts` (3) |
| R45 | `chime-coordinator.test.ts` (3); `chime.test.ts` (R45) |
| R46 | `unit/documentos/batch-finished.test.ts` (11); `composition/documentos-batch-notice.test.ts` (R46); `integration/documentos/batch-notice.int.test.ts` (2) †; E2E casos 1 y 1b † |
| R47 | `unit/notificaciones/documentos-event.test.ts` (2); `notification-item.test.tsx` (3); `relative-time.test.ts` (R47); `notifications-schema.int.test.ts` (2) † |
| R48 | `documentos-event.test.ts` (R48); `composition/documentos-batch-notice.test.ts` (R48) |
| R49 | `documentos-event.test.ts` (4); `unit/notificaciones/notification-links.test.ts` (3); `composition/documentos-batch-notice.test.ts` (R49); E2E casos 1 y 1b † |
| R50 | `unit/documentos/enqueue-names.test.ts` (15); `unit/documentos-ui/document-upload-names.test.tsx` (2); `batch-notice.int.test.ts` (5) † |
| R51 | `unit/notificaciones/file-list-phrase.test.ts` (8); `documentos-event.test.ts` (3); `document-upload-names.test.tsx` (R51); `batch-notice.int.test.ts` (5) † |
| R52 | *Retirado* |
| R53 | *Retirado* |
| R54 | `integration/identity/notifications-addon-migration.int.test.ts` › «QC-137 R54: tras las migraciones no queda permiso, asignación, añadido ni excepción», «…aplicar la retirada dos veces no falla ni cambia nada» y «…limpia también filas que la migración de datos no escribió…» † |
| R55 | `notify.test.ts` › «R55: con el directorio en false no se crea el aviso y queda en el log»; `company-membership.int.test.ts` › «QC-137 R55: un usuario dado de baja de esa empresa da false» † |
| R56 | `notification-actions.test.ts` › «R56: una sesión sin empresa recibe resumen, lote y marcar todas vacíos y con éxito, sin leer la bandeja» y «R56: sin sesión sigue respondiendo unauthorized»; `polling-feed.test.ts` › «R56: un resumen vacío no detiene la consulta»; `notification-bell.test.tsx` (R56) |
| R57 | `notify.test.ts` › «R57: con la empresa dada de baja no escribe la bandeja, no entrega por ningún canal y registra el descarte» y «R57: si la consulta de la empresa lanza, notify no lanza»; `unit/identity/is-company-active.test.ts` (2); `notificaciones-wiring.test.ts` › «R57: el motor pregunta a identity.isCompanyActive»; `company-membership.int.test.ts` › «QC-137 R57: isCompanyActive …» † |

Todos los R vigentes tienen al menos un test unitario o de guardia que corrí en verde, salvo tres:

- R13 y R16: solo tienen tests †.
- R54: tiene tests †, y además lo apoyan, en unitarios en verde, R18 y R21 (catálogo y añadidos sin la entrada).

Los tests † pasan según la bitácora, y `gate-completo` tiene que confirmarlos.
