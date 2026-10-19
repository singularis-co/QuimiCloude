# QC-137 — sistema-de-notificaciones-por-rol · design.md

> Requisitos en `requirements.md` (R1–R55; R20, R52 y R53 retirados por la enmienda del
> 2026-10-19). Tableros aprobados el 2026-10-16 y revisados el mismo
> día para «solo campana»:
> `docs/diseno/canvas/Notificaciones.dc.html` (escritorio, con el panel en el contenedor estrecho),
> `NotificacionesTablet.dc.html`, `NotificacionesMovil.dc.html` (lleva la ficha: Reutiliza / Nuevo
> / Librerías / Escritorio / Tablet / Teléfono / Animación / Carga al hacer scroll / Sin audio /
> Estados / Por confirmar) y `NotificacionesEstados.dc.html` (11 estados).
>
> **Revisión del 2026-10-16 (solo campana).** Sale la página `/notificaciones`, el ítem del menú,
> la pestaña «No leídas», la paginación por páginas, el cambio a `NavLink.badge` de
> `private-nav.ts` y el `landing: false` de `firstVisibleNavHref` (QC-75 ya no se toca). Entra la
> lista completa en el panel con carga por cursor al hacer scroll (§8.1, §10.2) y el anclaje a la
> pantalla en el teléfono (§10.3).
>
> **Respuestas del humano del 2026-10-19.** Un aviso por tanda; el enlace va a la lista de
> Fórmulas o a la de Proveedores, **sin `supplier_id`**; el añadido nace prendido en las empresas
> existentes y no depende de nada; la carga al hacer scroll usa **`react-intersection-observer`**
> (ya aprobada), ampliando la guardia de QC-140; se **guarda el nombre original** de cada archivo y
> el aviso nombra los fallidos (R50, R51); hora relativa hasta 7 días; teléfono con 8 px a los
> lados y 16 px abajo.
>
> **Enmienda del 2026-10-19 (tras las tandas 1–3; `requirements.md > Enmiendas`).** Decisiones del
> humano: **E1** notificaciones núcleo, sin permiso ni añadido (§7, §3.2, T24); **E2** un usuario
> dado de baja no es miembro, con el puerto `company-membership-reader.ts` (§7, T25); **E3**
> `NewBatch` con `paths[]` + `originalNames?[]` y orden por `createdAt` + 1 ms (§6.3); **E4** el
> cron borra también avisos de empresas dadas de baja (§11, T26); **E5** el balanceo de 700 ms se
> queda, con una excepción con nombre en la guardia de movimiento (§9.5, T27). Las decisiones de
> implementación de las tandas 1–3 que la bitácora marca «fuera del spec» se recogen en §16, todas
> **pendientes de validar por el reviewer**. Donde este documento dice otra cosa en las secciones
> anteriores, mandan las notas «Enmienda 2026-10-19» y §16.

## Lo que ya existe

**Búsqueda** (`docs/specs.md > Antes de especificar`). Términos: `notificaci`, `aviso`, `campana`,
`bell`, `badge`, `realtime`, `tono`, `cursor`, `IntersectionObserver`.

| Dónde | Qué apareció | Qué se hace |
| --- | --- | --- |
| Board (`feature_list.json`) | QC-247/QC-248: WhatsApp al cliente final. QC-292…QC-298: fichas hijas de esta (eventos y canales) | Ya en «Lo que NO entra» y pregunta abierta 2. Nada que choque |
| `specs/` | QC-11/QC-8: ítem «Notificaciones» de relleno, retirado en QC-13. QC-107 D5/D6: el tiempo real y el aviso de fin de tanda son encargo de QC-137. QC-277 D3: notificaciones como añadido futuro | Se cumple el encargo de QC-107 (R46–R51) y se crea el añadido de QC-277 D3 (R18–R20, R52, R53). El ítem del menú **no** vuelve (R24) |
| Código | `lib/shared/navigation/private-nav.ts`: `NavLink.badge?: number`, fijo y sin uso; `NavIconName` ya incluye `'bell'` | **No se toca** (R24). `private-nav.ts`, `AppSidebar` y `firstVisibleNavHref` quedan como en `dev` |
| Código | `lib/modules/inventario/domain/stock-increase-listener.ts` y su cableado en `lib/composition/index.ts` | **Patrón que se copia** para el emisor de `documentos` (§6) |
| Código | `components/shared/document-upload/use-batch-status.ts`: sondeo por Server Action (`getBatchStatusAction`) cada 2 s | **Precedente** de lectura desde el cliente por Server Action, sin librería de fetch (§9) |
| Código | `identity.isCompanyAddonActive(companyId, addon)`, ya usado por `documentos` fuera de sesión | ~~Se reutiliza para no crear avisos con el añadido apagado (R19)~~. **Enmienda 2026-10-19 (E1):** ya no se usa; no hay añadido |
| Código | `lib/modules/identity/adapters/driven/persistence/company-directory-prisma.ts`: `listActiveCompanyIds()` (solo `deletedAt: null`), la usa el cron de pedidos | **Enmienda 2026-10-19 (E4):** gana `listAllCompanyIds()`, sin filtro de baja, para el cron de borrado (§11). `listActiveCompanyIds` no cambia |
| Código | `tests/guards/guard-movimiento.test.ts` (QC-228 R1, R2, R23): tope de 400 ms en `app/` y `components/`; su única zona exenta es el bloque «Pantallas de acceso» de `app/globals.css` | **Enmienda 2026-10-19 (E5):** gana una excepción con nombre, solo para el balanceo de la campana (§9.5) |
| Código | `lib/shared/pagination.ts`: `DEFAULT_PAGE_SIZE = 10`, `toOffsetLimit`, `buildPage` | Se reutiliza **solo** `DEFAULT_PAGE_SIZE` como tamaño de lote. `toOffsetLimit` y `buildPage` no: son por desplazamiento y repetirían o saltarían avisos al llegar uno nuevo (R28, A12) |
| Código | `app/(private)/proveedores/components/showcase-load-trigger.tsx` usa `react-intersection-observer` (aprobada en `docs/dependencias.md`), y `tests/unit/proveedores-ui/guard-convenciones-showcase.test.ts` (QC-140 R18) exige que sea su **único** importador | **Se reutiliza la librería** (decisión del 2026-10-19). El centinela nuevo `notification-list-tail.tsx` es el segundo y último importador autorizado, y la guardia de QC-140 se amplía a una lista cerrada de dos archivos (§10.2, §15). `ShowcaseLoadTrigger` no se reutiliza tal cual: no admite `root` ni `rootMargin`, y extenderlo obligaría a subirlo a `shared` (A15) |
| Código | `react-intersection-observer/test-utils` (`mockAllIsIntersecting`), ya usado en `tests/unit/proveedores-ui/` | Se usa igual en los tests del panel (R25) |
| Código | `lib/modules/documentos/domain/document-path.ts`: la ruta del PDF es `<empresa>/<uuid>.pdf`; el nombre original no llega a la base | `document_files` gana `original_name` (§6.3, R50) |
| Código | `lib/` no tiene zona horaria de empresa; las pantallas formatean fechas con la del navegador (`whatsapp-connection-card.tsx`, `ai-provider-card.tsx`) | La hora «a las HH:MM» del aviso se pinta en el navegador (§3, §9.6) |
| Código | `app/api/cron/caducar-pedidos/route.ts` + `vercel.json` | Patrón del cron de borrado (§11) |
| Código | `app/(private)/layout.tsx` ya monta `<Toaster richColors />` | El toast «Notificaciones sin sonido» usa esa región (R45) |
| Código | `db/schema.prisma`: las marcas de tiempo son `@db.Timestamptz(6)` | El cursor lleva la marca con microsegundos (§8.1) |

**Filas de `components/shared/CATALOGO.md` consultadas y qué se hace con cada una:**

| Fila | Paso de la regla de decisión | Uso |
| --- | --- | --- |
| `Popover`, `PopoverTrigger`, `PopoverContent` (`components/ui/popover.tsx`) | 2. Extiende | Panel de la campana. `PopoverContent` gana las props opcionales `anchor`, `collisionPadding` y `positionerClassName`, que pasan al `Positioner` de Base UI, para anclar el panel a la pantalla en el teléfono (§10.3). Sin ellas se comporta igual que hoy: los consumidores no cambian. Se anota en su fila |
| `Button`, `buttonVariants` | 1. Reutiliza | Campana, «Marcar todas como leídas», «Reintentar» |
| `Badge`, `badgeVariants` | 1. Reutiliza | Insignia del conteo de la campana |
| `EmptyState` | 1. Reutiliza | «No tienes notificaciones.» |
| `ErrorState` | ~~1. Reutiliza~~ → descartada en la tanda 3 | Error del primer lote con «Reintentar» (R33). **Se compuso con `EmptyState` + `Button` dentro de `role="alert"`** (paso 3): `ErrorState` exige un error del catálogo de `errores` y no admite `retryFirst()`. §16, D-T3-10, pendiente de validar por el reviewer |
| `Skeleton` | 1. Reutiliza | Carga del primer lote (R33). `TableSkeleton` se descarta: la lista no es una tabla |
| `Toaster` (`components/ui/sonner.tsx`) + `toast` de `sonner` | 1. Reutiliza | «Notificaciones sin sonido» |
| `DataTable` | Descartada | Es una tabla con orden y columnas: la bandeja es una lista |
| `Notice` | Descartada | Aviso en línea; el tablero pide toast |
| `UrlTabs`, `PageShell`, `PageHeader` | Descartadas en la revisión | Eran de la página `/notificaciones`, que ya no existe |
| `DocumentUpload`, `DocumentUploadDialog`, `DocumentUploadRow` | Cambio interno, sin prop nueva | `DocumentUpload` manda al encolar el `name` de cada `File` junto a su ruta (§6.3). Ni la API ni lo visible cambian: no hay pase `/design` que hacer. Sus consumidores no cambian |

**Piezas nuevas** (las del bloque «Nuevo» de la ficha del tablero). Todas tienen **un solo
consumidor**, la cabecera del layout privado, así que viven en la carpeta de la ruta,
`app/(private)/components/notifications/` (paso 4 de la regla, `docs/perfil-agentes.md`), y **no**
ganan fila en `CATALOGO.md`. Con la página y el menú fuera, ya no hay excepción que declarar para
subirlas a `shared`.

| Pieza | Paso | Por qué |
| --- | --- | --- |
| Fila de aviso (`NotificationItem`) | 3. Compón (icono `lucide-react` + textos + punto) | Solo la pinta el panel |
| Fuente única del conteo y de la lista (`NotificationsProvider`, `useNotifications`) | 4. Crea (no es UI) | La leen la campana, su insignia, su nombre accesible y el panel (R22) |
| Insignia de conteo (`UnreadCountBadge`: oculta con 0, «99+») | 3. Compón (`Badge`) | Solo la campana |
| Final de la lista (`NotificationListTail`: centinela con `useInView` + «Cargando más avisos…» / error con «Reintentar» / «No hay más avisos…») | 3. Compón (`Button` + icono de giro + `react-intersection-observer`) | Estados 5, 6 y 7 del tablero |
| Campana con panel (`NotificationBell`) | 3. Compón (`Popover` + `Button` + `UnreadCountBadge` + `NotificationItem` + `NotificationListTail`) | El layout privado |

## 1. Resumen de la solución

```
documentos (emite por su puerto) ──► lib/composition ──► notificaciones.notify(evento)
                                                           │ catálogo → aviso
                                                           │ bandeja (Prisma, idempotente)
                                                           └ factory de canales → canal «app»
navegador: NotificationFeed (consulta periódica del resumen) ──► NotificationsProvider ──► campana
           listNotificationsAction(cursor) por lotes de 10 ──┘   (conteo + lista del panel)
                                                  coordinador de pestañas ──► tono (Web Audio)
```

## 2. Módulo `notificaciones`

```
lib/modules/notificaciones/
  index.ts                                   contrato: reexporta de ./domain
  domain/
    catalog.ts                               NOTIFICATION_CATALOG (R1) y sus tipos
    file-list-phrase.ts                      la lista L de archivos fallidos (R51)
    notification-event.ts                    NotificationEvent { key, companyId, dedupeKey, payload }
    notify.ts                                createNotify: el motor (R2–R4, R7, R8, R11, R19, R55)
    channel-factory.ts                       createChannelFactory (R8–R10)
    notification-cursor.ts                   cursor opaco: codificar/decodificar con zod (R28, §8.1)
    list-notifications.ts                    un lote por cursor (R13, R15, R23, R25, R27, R28)
    get-notification-summary.ts              conteo + aviso más reciente (R13, R22, R37)
    mark-notification-read.ts                (R14, R16, R31)
    mark-all-notifications-read.ts          (R32)
    purge-expired-notifications.ts          (R17)
    retention.ts                             RETENTION_DAYS = 90, cutoff(now)
    actor.ts                                 Actor y su alcance (E1: sin permiso ni requirePermission)
    errors.ts
  ports/
    notification-channel.ts                  NotificationChannel (el puerto único de canal)
    notification-inbox.ts                    la bandeja (persistencia)
    notifications-switch.ts                  SE BORRA en T24 (E1): ya no hay añadido que consultar
    recipient-directory.ts                   el usuario destinatario es de esa empresa y no está de baja (R55)
    notification-log.ts
  adapters/
    driven/persistence/notification-inbox-prisma.ts
    driven/channels/in-app-channel.ts        el canal de la aplicación (§5)
    driven/observability/notification-log-console.ts
    driving/notification-actions.ts          'use server': resumen, lote, marcar, marcar todas
    driving/notification-links.ts            destino → href con lib/shared/routes (§4.3)
    driving/purge-route.ts                   lo que llama el cron (§11)
```

`docs/architecture.md > La regla de dependencias` se cumple así:
- `domain/` solo importa `zod` y su propio `ports/`.
- Las rutas (`lib/shared/routes`) se resuelven en el adaptador `driving` (§4.3).
- Cada puerto se ata en `lib/composition/index.ts`.

## 3. Modelo de datos

Dos tablas nuevas, dueño `/// @module notificaciones`. Identificadores en inglés (decisión
heredada de QC-4). Las FK a `companies`, `users` y `roles` cruzan de módulo. Por eso van **sin
`@relation`**, escritas a mano en la migración: es el patrón de `Customer`, para que un `include`
no cruce de módulo.

### `notifications`

| Columna | Tipo | Notas |
| --- | --- | --- |
| `id` | `uuid` PK | `gen_random_uuid()` |
| `company_id` | `uuid` NOT NULL | FK `companies(id)` `ON DELETE CASCADE` |
| `event_key` | `text` NOT NULL | `CHECK (event_key ~ '^[a-z_]+\.[a-z_]+$')` |
| `tone` | `text` NOT NULL | `CHECK (tone IN ('success','warning','danger'))` |
| `title`, `body`, `link_label` | `text` NOT NULL | Texto ya resuelto por el catálogo al crear: cambiar un texto del catálogo no reescribe el historial (máx. 90 días). Única excepción: `body` puede llevar la marca `{hora}`, que el navegador sustituye (fila siguiente) |
| `body_time` | `timestamptz(6)` NULL | El instante que `{hora}` representa (la subida de la tanda, R47). El servidor no conoce la zona horaria del usuario (en `lib/` no hay ninguna), así que «HH:MM» se pinta en el navegador, como las demás fechas de la app. `CHECK ((body_time IS NULL) = (position('{hora}' in body) = 0))` |
| `target_kind` | `text` NULL | Destino abstracto (§4.3), nunca una URL |
| `target_params` | `jsonb` NULL | Parámetros del destino para eventos futuros que lleven un id; el de PDFs no lleva |
| `recipient_user_id` | `uuid` NULL | FK `users(id)` `ON DELETE CASCADE` |
| `recipient_role` | `text` NULL | FK `roles(name)` `ON UPDATE CASCADE ON DELETE RESTRICT`. Ver §3.3 |
| `dedupe_key` | `text` NOT NULL | Idempotencia (R3) |
| `created_at` | `timestamptz(6)` NOT NULL | `now()` |

Restricciones e índices:
- `CHECK (num_nonnulls(recipient_user_id, recipient_role) = 1)`: un rol o un usuario, nunca los
  dos ni ninguno (R12).
- `UNIQUE (company_id, dedupe_key)`: R3. La inserción usa `ON CONFLICT DO NOTHING`.
- `UNIQUE (id, company_id)`: clave candidata de la FK compuesta de `notification_reads`, como
  `document_batches_id_company_id_key`.
- `INDEX (company_id, recipient_user_id, created_at DESC, id DESC)` e
  `INDEX (company_id, recipient_role, created_at DESC, id DESC)`: sirven al resumen, que se
  consulta cada 30 s por usuario (ruta caliente, `docs/architecture.md > Anti-patrones`: «queries
  sin indice»), y al recorrido por cursor del panel, que ordena por `(created_at, id)` (§8.1).
- `INDEX (company_id, created_at)`: el borrado por empresa (§11).

### `notification_reads`

| Columna | Tipo | Notas |
| --- | --- | --- |
| `notification_id` | `uuid` NOT NULL | FK compuesta `(notification_id, company_id)` → `notifications(id, company_id)` `ON DELETE CASCADE`: una lectura no puede ser de otra empresa |
| `user_id` | `uuid` NOT NULL | FK `users(id)` `ON DELETE CASCADE` |
| `company_id` | `uuid` NOT NULL | La lleva para cumplir `guard-empresa-en-esquema` sin entrar en la lista de exentas |
| `read_at` | `timestamptz(6)` NOT NULL | `now()` |

PK `(notification_id, user_id)`: «leído» es por usuario (R16) y marcar dos veces no duplica.

### 3.1 RLS

Las dos tablas con `ENABLE ROW LEVEL SECURITY` y `FORCE ROW LEVEL SECURITY`, sin policies, al
final de la migración, como `company_addon_overrides`. Es defensa en profundidad. La frontera es
el caso de uso (R15, `docs/architecture.md > Acceso a datos y autorizacion`).

### 3.2 Migraciones (cada una con `down.sql`)

1. `db/migrations/<ts>_notifications/`: las dos tablas, restricciones, índices y RLS. El
   `down.sql` las borra en orden inverso.
2. `db/migrations/<ts>_notifications_addon/` (`20261019120100`, commiteada en la tanda 1),
   **de datos**. **Enmienda 2026-10-19 (E1): la deshace la migración 4**; se queda en el repo tal
   cual:
   - permiso `notificaciones.consultar` (módulo `notificaciones`, acción `consultar`);
   - `role_permissions` para Administrador, Operador, Empacador y Acondicionamiento, resueltos
     por nombre (R21);
   - fila `notificaciones` en `addons`;
   - una excepción `enabled = true` en `company_addon_overrides` por cada empresa **existente**,
     como hizo la migración de QC-277 (R52, decisión del 2026-10-19). Las empresas que se creen
     después no la tienen y nacen apagadas (R20).

   Todo idempotente con `ON CONFLICT DO NOTHING`, como
   `20261009120200_delivery_void_permission`. El `down.sql` borra exactamente esas filas.
3. `db/migrations/<ts>_document_files_original_name/`: `ALTER TABLE document_files ADD COLUMN
   original_name text NULL` con `CHECK (original_name IS NULL OR char_length(original_name)
   BETWEEN 1 AND 255)` (§6.3, R50). Las filas que ya existen quedan con `NULL`: no hay de dónde
   sacar su nombre. El `down.sql` quita la columna. **No** hay columna `supplier_id` (R49).
4. **Enmienda 2026-10-19 (E1, R54).** `db/migrations/<ts>_notifications_addon_removal/`, **de
   datos**, con `<ts>` posterior a `20261019120200`. La migración 2 ya está commiteada y en push,
   así que pudo aplicarse en algún entorno: **no se borra ni se edita**, se deshace con esta.
   - `migration.sql`: las cuatro sentencias del `down.sql` de la 2, en su orden (hijas antes que
     catálogos, las FK son `RESTRICT`): excepciones de `company_addon_overrides` con
     `addon_key = 'notificaciones'`, la fila de `addons`, las asignaciones de `role_permissions` con
     `permission_code = 'notificaciones.consultar'` y el permiso. Son `DELETE … WHERE`, así que es
     idempotente y no falla si la 2 nunca llegó a aplicarse (base nueva: la 2 escribe y la 4 borra
     en la misma corrida).
   - `down.sql`: vuelve a escribir lo que escribe la 2 (mismo SQL idempotente, `ON CONFLICT DO
     NOTHING`). Es un restablecimiento **aproximado**: prende el añadido en todas las empresas que
     existan al revertir, no en las que lo tenían; los interruptores reales que se apagaron entre
     medias no se recuperan. Se acepta: el `down` solo sirve para volver a la versión de la tanda
     1, que el humano ya descartó.
   - La lista de migraciones de `tests/guards/guard-identificador-de-request.test.ts` gana la nueva.

### 3.3 Por qué el rol se guarda por su nombre

`SessionUser` trae `roleName` de la **misma lectura de la base** que resuelve la sesión
(`SessionUserRecord.roleName`), no de la cookie. `roles.name` es `@unique`, así que admite una FK
con `ON UPDATE CASCADE`: renombrar un rol arrastra sus avisos. Con `role_id` habría que añadir
`roleId` a `SessionUser`, que es otro cambio en el contrato más usado de `identity`, o resolver
nombre → id en cada consulta.

**Aviso al reviewer:** `docs/architecture.md` dice que `roleName` «no autoriza nada». Aquí no
autoriza. **Enmienda 2026-10-19 (E1):** ya no hay permiso `notificaciones.consultar`; leer y marcar
la bandeja **propia** no pide permiso (R15, R19). La frontera sigue en el caso de uso: el actor sale
de la sesión del servidor (empresa y usuario de `getSessionContext()`, rol y permisos de
`getSessionUser()`), y cada consulta aplica «avisos visibles» (§8). `roleName` solo **acota** qué
avisos son del usuario (R13), igual que `companyId`. Es la decisión cerrada «Autorización»: «cada
usuario lee y marca solo sus avisos».

## 4. Catálogo y motor

### 4.1 Catálogo (`domain/catalog.ts`)

```ts
type Audience<P> = { kind: 'role'; role: string } | { kind: 'user'; userIdFrom: (p: P) => string };
type CatalogEntry<P> = {
  schema: z.ZodType<P>;                    // forma del payload (R4)
  tone: (p: P) => 'success' | 'warning' | 'danger';
  title: (p: P) => string;
  body: (p: P) => string;                  // puede llevar '{hora}'
  bodyTime: (p: P) => Date | null;         // el instante de '{hora}', o null si no la lleva
  linkLabel: (p: P) => string;
  target: (p: P) => NotificationTarget | null;
  audience: Audience<P>;
  channels: readonly ChannelKey[];         // hoy siempre ['in_app']
};
export const NOTIFICATION_CATALOG = { 'documentos.tanda_terminada': {...} } satisfies ...;
```

El rol del catálogo se escribe con las constantes que exporta `@/lib/modules/identity`
(`ROLE_ADMINISTRADOR`…), que el dominio puede importar por barril. Hoy ningún evento va a un rol,
pero el camino se construye y se prueba (R12, R13, R16) porque es una decisión cerrada.

### 4.2 Motor (`domain/notify.ts`)

`notify(event)` **nunca lanza** (R7). Hace esto, en orden:

1. Busca la entrada del catálogo y valida el `payload` con su `schema`. Si falla, registra
   `notification_rejected` y termina (R4).
2. ~~Llama a `switch.isOn(companyId)`. Si el añadido está apagado, termina sin escribir (R19).~~
   **Enmienda 2026-10-19 (E1):** el paso se quita. `NotifyDeps` pierde `addon` y el puerto
   `notifications-switch.ts` se borra (T24). Se crea el aviso en cualquier empresa (R19).
3. Si el destinatario es un usuario, `recipients.belongsToCompany(userId, companyId)`. Si no
   pertenece, lo rechaza y lo registra (R12). Un usuario dado de baja no pertenece (R55, E2). Lo
   implementa `identity` (§7).
4. `inbox.insertIfAbsent(nuevoAviso)`. Devuelve `null` si `(company_id, dedupe_key)` ya existía,
   y en ese caso termina sin entregar (R3).
5. Para cada canal de `factory.channelsFor(entry.channels)`, llama a `deliver(aviso)` dentro de su
   propio `try/catch`. Un fallo se registra y se sigue con el siguiente canal (R11).
6. Un `try/catch` exterior registra cualquier otro fallo (R7).

### 4.3 Destino del aviso: abstracto en la base, ruta en el borde

`NotificationTarget` es una unión cerrada:

- `{ kind: 'formulas' }`
- `{ kind: 'suppliers' }`

Se guarda en `target_kind`/`target_params` (`target_params` queda para eventos futuros que
necesiten un id; el de PDFs no lleva). `adapters/driving/notification-links.ts` lo convierte en
`href` con `FORMULAS_ROUTE` y `SUPPLIERS_ROUTE` de `lib/shared/routes.ts`. Un `kind` desconocido da un aviso sin enlace, que sigue marcándose como
leído al pulsarlo. Así el dominio no importa `lib/shared` y, si cambia una URL, cambia en un sitio
y los avisos ya guardados la siguen. `lib/shared/routes.ts` **no cambia**: ya no hay ruta nueva.

### 4.4 Cómo se agrega un evento (R6)

Lo documenta `lib/modules/notificaciones/README.md`:

1. Se añade una entrada en `NOTIFICATION_CATALOG`.
2. Se llama a la emisión en el módulo de origen, por **su** puerto.
3. Solo si el módulo emite por primera vez: se declara su puerto (patrón `StockIncreaseListener`)
   y se añade una línea en `lib/composition/index.ts` que lo ata a `notificaciones.notify`.

El test de R6 registra en un catálogo de prueba un evento nuevo, lo emite y comprueba que se crea
el aviso sin tocar `notify.ts` ni `channel-factory.ts`.

## 5. Canales: puerto único y factory

```ts
// ports/notification-channel.ts
export type ChannelKey = 'in_app';     // QC-295…QC-298 añaden 'email' | 'phone' | 'whatsapp' | 'telegram'
export interface NotificationChannel {
  readonly key: ChannelKey;
  deliver(notification: DeliverableNotification): Promise<void>;
}
// domain/channel-factory.ts
export function createChannelFactory(registry: Partial<Record<ChannelKey, NotificationChannel>>) {
  return { channelsFor: (keys: readonly ChannelKey[]) => keys.flatMap((k) => registry[k] ?? []) };
}
```

- **La bandeja no es un canal.** Se escribe antes de entregar y con independencia de los canales,
  así que un fallo de canal nunca la toca (decisión cerrada «Un fallo de un canal no impide los
  demás ni la bandeja», R11).
- **Canal `in_app` hoy:** con la consulta periódica, el aviso ya es visible en cuanto está en la
  bandeja, así que `deliver` no hace nada y solo deja traza. **Es el enchufe del tiempo real:** si
  algún día se migra a Broadcast, este adaptador es el que publica (§12.3).
- **Test con canal ficticio (R10):** se registra un `fake` además de `in_app` y un evento de prueba
  que lo pide. Se comprueba que `fake.deliver` recibe el aviso sin cambiar el motor. Un `fake` que
  lanza demuestra R11.
- La composición registra **solo** `in_app` (R9). Un test de composición lo fija.

## 6. Primer emisor: `documentos`

### 6.1 Puerto propio

`lib/modules/documentos/domain/batch-finished-listener.ts`, mismo patrón y ubicación que
`StockIncreaseListener`:

```ts
export interface BatchFinishedListener {
  /** Se llama con la tanda ya cerrada. No debe lanzar: el desenlace de los archivos ya está escrito. */
  onBatchFinished(input: {
    companyId: string; batchId: string; strategy: PdfStrategy;
    createdBy: string | null; uploadedAt: Date;
    total: number; done: number; failed: number;
    failedNames: readonly string[];   // hasta 3, en orden de subida, solo los que tienen nombre
    occurredAt: Date;
  }): Promise<void>;
}
```

`documentos` no importa `notificaciones` (R5). La composición lo ata:

```ts
const batchFinishedListener: BatchFinishedListener = {
  async onBatchFinished(e) {
    if (e.createdBy === null) { log.warn('batch_notice_without_author', {...}); return; }   // R48
    await notificaciones.notify({
      key: 'documentos.tanda_terminada', companyId: e.companyId,
      dedupeKey: `documentos.tanda_terminada:${e.batchId}`,
      payload: { recipientUserId: e.createdBy, strategy: e.strategy, uploadedAt: e.uploadedAt,
                 total: e.total, done: e.done, failed: e.failed, failedNames: e.failedNames },
    });
  },
};
```

### 6.2 Cuándo termina una tanda (R46)

Un dominio nuevo, `documentos/domain/notify-if-batch-finished.ts`, lee el resumen de la tanda con
un método nuevo del repositorio. Si ningún archivo está en `queued` ni en `processing`, llama al
listener. Lo llaman dos sitios:

- `run-document-job.ts`, después de cada `finish` **no reintentable** (`done` o `error`). Un
  `requeue` no cierra nada.
- `get-batch-status.ts`, después de `expireStale`. La caducidad también cierra archivos, y sin
  esto una tanda con un archivo colgado nunca avisaría.

Dos archivos que terminan a la vez pueden ver los dos la tanda cerrada. El
`UNIQUE (company_id, dedupe_key)` deja un solo aviso (R3), sin candados en `documentos`. Los dos
listeners son **opcionales** en las `deps`, como `stockIncreases`, para que los tests existentes
de `documentos` no cambien.

Método nuevo del puerto `DocumentBatchRepository`:

```ts
readBatchNotice(batchId: string, companyId: string): Promise<{
  strategy: PdfStrategy; createdBy: string | null; uploadedAt: Date;
  total: number; done: number; failed: number; pending: number;
  failedNames: string[];   // los 3 primeros con nombre, ORDER BY created_at, id
} | null>;
```

**Enmienda 2026-10-19 (§16, D-T2-1, pendiente de validar por el reviewer):** `readBatchNotice` no
entra en `DocumentBatchRepository` sino en un puerto aparte, `BatchNoticeReader`, en el mismo
archivo `ports/document-batch-repository.ts` (el tipo de retorno se llama `BatchNotice`). Añadirlo
al puerto existente rompía el typecheck de 7 tests de `documentos` con dobles tipados. El adaptador
Prisma implementa los dos y el objeto exportado es `DocumentBatchRepository & BatchNoticeReader`.

Un `SELECT` con conteos agrupados por estado y otro con `original_name` de los fallidos con
nombre, `LIMIT 3`. `uploadedAt` es `document_batches.created_at`. El `failed` total sale del
conteo, así que «y N más» (R51) es `failed - failedNames.length`. No reutiliza `readBatch` porque esa función
alimenta la respuesta al cliente, y añadirle `createdBy` lo filtraría a la UI.

### 6.3 Nombre original de cada archivo (R50)

- `enqueueBatchSchema` gana `names: z.array(fileNameSchema).optional()`, con un `refine` que exige
  la misma longitud que `paths` cuando viene. `fileNameSchema` (`documentos/domain/file-name.ts`):
  se queda con lo que va tras la última `/` o `\`, recorta espacios, quita caracteres de control y
  exige de 1 a 255 caracteres. Sin `names` la tanda se encola igual, con nombres `NULL`: así un
  cliente viejo en caché no rompe.
- ~~`NewBatch` pasa a `files: { path, originalName: string | null }[]`~~. **Enmienda 2026-10-19
  (E3, decisión del humano):** `NewBatch` conserva `paths: string[]` y gana `originalNames?:
  string[]`, alineado con `paths` por posición. `enqueueBatch` solo lo pasa si vino `names`, así la
  entrada sin nombres conserva sus claves. `createBatch` escribe `document_files.original_name` y
  un `created_at = ahora + i ms` en el archivo `i` de la tanda: las filas de una tanda se insertan
  en la misma transacción y pueden compartir instante, y sin ese desfase `ORDER BY created_at, id`
  ordenaría por el uuid y no por orden de subida (R51). Con `files[]` se ponían rojos
  `enqueue-batch.test.ts` (claves exactas de la entrada) y `document-batch-repository-prisma.test.ts`.
- `DocumentUpload` manda `names` con el `File.name` de cada archivo subido con éxito, en el mismo
  orden que `paths`. No hay prop nueva ni cambio visible; `DocumentUploadDialog`,
  `CatalogPdfUpload` y `FormulaPdfUpload` no cambian.
- El nombre es texto del usuario: el aviso lo muestra como texto (React escapa), nunca como HTML.

### 6.3b Destino (R49)

`strategy = 'formula'` → `{ kind: 'formulas' }`, «Ver fórmulas». `strategy = 'catalogo'` →
`{ kind: 'suppliers' }`, «Ver proveedores». La tanda de catálogo solo se sube desde un proveedor,
así que la estrategia basta para saber desde dónde se subió. No se guarda el proveedor (decisión
del 2026-10-19).

### 6.4 Textos del evento (R47, R51; los del tablero, decisión del 2026-10-19)

`{hora}` se guarda tal cual y `body_time = uploadedAt` (§3). L = `fileListPhrase(failedNames,
failed)` (R51); «con nombres» quiere decir `failedNames.length > 0`.

| Desenlace | `tone` | `title` | `body` con nombres | `body` sin nombres |
| --- | --- | --- | --- | --- |
| `failed = 0`, `total > 1` | `success` | Tanda de PDFs procesada | — | Se leyeron los {total} archivos de la tanda que subiste a las {hora}. |
| `failed = 0`, `total = 1` | `success` | Tanda de PDFs procesada | — | Se leyó el archivo de la tanda que subiste a las {hora}. |
| `done > 0`, `failed = 1` | `warning` | Tanda procesada con errores | Se leyeron {done} de {total} archivos. No se pudo leer L. | Se leyeron {done} de {total} archivos. Uno no se pudo leer. |
| `done > 0`, `failed > 1` | `warning` | Tanda procesada con errores | Se leyeron {done} de {total} archivos. No se pudieron leer L. | Se leyeron {done} de {total} archivos. {failed} no se pudieron leer. |
| `done = 0`, `total = 1` | `danger` | Falló la lectura de la tanda | No se pudo leer L, de la tanda que subiste a las {hora}. | No se pudo leer el archivo de la tanda que subiste a las {hora}. |
| `done = 0`, `total > 1` | `danger` | Falló la lectura de la tanda | No se pudo leer ningún archivo de la tanda que subiste a las {hora}: L. | No se pudo leer ningún archivo de la tanda que subiste a las {hora}. |

`fileListPhrase` (`domain/file-list-phrase.ts`, puro): cada nombre entre comillas rectas, recortado
a 59 caracteres + «…» si pasa de 60; une con «, » y « y »; si `failed > failedNames.length`, añade
« y N más» con `N = failed - failedNames.length`. Ejemplos: `"a.pdf"`; `"a.pdf" y "b.pdf"`;
`"a.pdf", "b.pdf" y "c.pdf"`; `"a.pdf", "b.pdf", "c.pdf" y 4 más`; `"a.pdf" y 2 más`. Tope de 3:
el panel tiene 400 px y el texto no debe pasar de unas cuatro líneas.

Enlace: §6.3b.

## 7. Añadido, permiso y lo que cambia en `identity`

> **Enmienda 2026-10-19 (E1, E2). Lo que vale desde ahora:**
>
> - **Sin permiso y sin añadido.** `permissions.ts` y `company-addons.ts` vuelven a su contenido
>   anterior a la tanda 1: sin `notificaciones.consultar`, sin la entrada en
>   `SEED_ROLE_PERMISSIONS`, sin `'notificaciones'` en `ADDONS`, `ADDON_PERMISSIONS` ni
>   `ADDON_REQUIRES`, y con las dos frases del JSDoc de `SEED_ROLE_PERMISSIONS` que la tanda 1 quitó
>   (R18, R21). La enmienda a QC-277 R2 («pasan a ser seis») **se deshace**: vuelven a ser cinco.
> - **Los tests de otras fichas que la tanda 1 ajustó** (filtros «sin X», conteos de «seis», textos
>   de E2E) vuelven a su versión anterior a la tanda 1, salvo en lo que no tenga que ver con el
>   permiso o el añadido (lista en T24).
> - **Casos de uso:** `actor.ts` pierde `NOTIFICATIONS_READ_PERMISSION` y `requirePermission`. El
>   `Actor` conserva `id`, `companyId` y `roleName`; `permissions` sale si nada más lo lee. Las
>   cuatro operaciones ya no lanzan `UnauthorizedError`; si el error queda sin uso en el módulo, se
>   quita.
> - **Acciones:** con sesión de empresa responden `ok`, sea cual sea el rol (R19). El código
>   `forbidden` deja de existir en `NotificationActionFailure`; quedan `unauthorized` (sin sesión, o
>   sesión sin empresa: `getSessionContext()` da `null`), `invalid_input`, `not_found` y
>   `unexpected`. La decisión D-T1-B2 de la bitácora (orden «permiso antes que forma») queda sin
>   objeto: una entrada mal formada responde siempre `invalid_input`.
> - **Composición:** la fachada `notificaciones` pierde el interruptor
>   `identity.isCompanyAddonActive(…, 'notificaciones')`.
> - **Pertenencia (E2, R55):** `identity.isUserInCompany(userId, companyId)` vive en su puerto propio
>   `lib/modules/identity/ports/company-membership-reader.ts` (`CompanyMembershipReader`), no en
>   `CompanyRepository` (añadirlo ahí obligaba a tocar ~10 dobles de test). Su adaptador,
>   `createCompanyMembershipReader` en `company-prisma.ts`, busca con `deletedAt: null`: un usuario
>   dado de baja da `false`, como los demás `findFirst` de `identity` (`user-admin-prisma`,
>   `work-group-prisma`). Decisión del humano: se queda así.
>
> El texto de abajo es el diseño original y queda solo como historia en lo que contradiga esta nota.

- `identity/domain/permissions.ts`: permiso `notificaciones.consultar`, que se añade a
  `SEED_ROLE_PERMISSIONS` de los cuatro roles de empresa (R21).
- `identity/domain/company-addons.ts`: `ADDONS` gana `'notificaciones'`;
  `ADDON_PERMISSIONS.notificaciones = ['notificaciones.consultar']`;
  `ADDON_REQUIRES.notificaciones = []` (R53, decisión del 2026-10-19: no depende de
  «Integraciones» ni de ningún otro). El permiso efectivo ya sale de
  `effectivePermissions`, así que la campana y las acciones se recortan solas (R18, R19).
  **Enmienda QC-277 R2**, que dice «exactamente cinco añadidos»: pasan a ser seis. Los tests de
  QC-277 que cuentan cinco se actualizan.
- R20 (una empresa nueva nace apagada) no necesita código: lo garantiza QC-277 D7 al no crear
  excepción. Se prueba igual.
- `identity` gana `isUserInCompany(userId, companyId)` en su contrato, con un `findFirst` en su
  adaptador. Implementa el puerto `RecipientDirectory` (§4.2).
- Los casos de uso de lectura exigen `notificaciones.consultar` con el `requirePermission` del
  módulo. Marcar como leído es parte de consultar la bandeja propia y no pide otro permiso.
- **No se toca la navegación.** El permiso **no** entra en `PRIVATE_NAV_ITEMS`, así que
  `guard-nav-permisos-declarados` no lo ve ni lo necesita.

## 8. Lectura: casos de uso y Server Actions

`Actor = { id, companyId, roleName, permissions }`, construido en el `driving` a partir de
`identity.getSessionUser()`, con **una** lectura de sesión por petición (QC-104). El test de
`tests/unit/` que vigila esa regla lee las acciones del disco y cubre las nuevas solo.

Todas las consultas filtran con la misma condición, «avisos visibles»:

```sql
company_id = $companyId AND created_at >= $cutoff
AND (recipient_user_id = $userId OR recipient_role = $roleName)
```

Con `roleName = null`, solo la mitad del usuario. «No leído» añade
`NOT EXISTS (SELECT 1 FROM notification_reads r WHERE r.notification_id = n.id AND r.user_id = $userId)`.

| Acción / caso de uso | Entrada | Salida | Requisitos |
| --- | --- | --- | --- |
| `getNotificationSummaryAction()` | — | `{ ok: true, data: { unreadCount, newest: { id, createdAt } \| null } }` o `{ ok: false, code }` | R13, R22, R37, R40 |
| `listNotificationsAction({ cursor })` | `cursor: string \| null` (opaco, §8.1) | `{ ok: true, data: { items: NotificationView[≤10], nextCursor: string \| null } }` o `{ ok: false, code }` (`invalid_input` con un cursor mal formado) | R13, R15, R23, R25, R27, R28 |
| `markNotificationReadAction(id)` | `z.uuid()` | `{ ok: true }` o `{ ok: false, code: 'not_found' }` si no es visible (R14) | R14, R16, R31 |
| `markAllNotificationsReadAction()` | — | `{ ok: true, data: { marked } }` | R32 |

- `NotificationView = { id, tone, title, body, bodyTime: string (ISO) | null, linkLabel, href: string | null, createdAt: string (ISO), read: boolean }`.
  `body` viaja con la marca `{hora}` sin sustituir; la sustituye `NotificationItem` (§9.6).
- El resumen ya **no** trae avisos: el panel los pide por lotes. Así la consulta de cada 30 s es
  un `COUNT` y un `SELECT … LIMIT 1` por índice.
- **Marcar** es `INSERT INTO notification_reads … SELECT … FROM notifications WHERE <visibles> AND id = $id ON CONFLICT DO NOTHING`.
  Si el aviso no es visible, no inserta nada y responde `not_found`: lo mismo para uno ajeno que
  para uno inexistente (R14). **Marcar todas** es el mismo `INSERT … SELECT` sobre los no leídos,
  estén o no cargados en el panel (R32).
- ~~Con el añadido apagado, el permiso efectivo no está, y las cuatro acciones responden
  `{ ok: false, code: 'forbidden' }` antes de tocar la bandeja (R19, R15).~~ **Enmienda
  2026-10-19 (E1):** no hay añadido ni permiso; sin sesión de empresa las cuatro responden
  `unauthorized` antes de tocar la bandeja (R15, R40), y con sesión responden sobre los avisos
  visibles del actor (§7).

### 8.1 Lotes por cursor (R25, R27, R28)

- **Orden:** `ORDER BY created_at DESC, id DESC`. El `id` desempata dos avisos del mismo instante.
- **Tamaño de lote:** `NOTIFICATION_BATCH_SIZE = DEFAULT_PAGE_SIZE` (10, `lib/shared/pagination.ts`).
  Se piden `11` filas: si llega la undécima, hay más y no se devuelve.
- **Siguiente lote:** `AND (created_at, id) < ($cursorTs::timestamptz, $cursorId::uuid)`, con la
  condición de «avisos visibles». Los índices de §3 sirven el orden y el corte.
- **Cursor:** `base64url(JSON.stringify({ t, i }))`, donde `t` es `created_at` del último aviso
  del lote **como texto con microsegundos**, leído de la base (`to_char(created_at AT TIME ZONE
  'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`), e `i` su `id`. La columna es `timestamptz(6)` y un
  `Date` de JS solo guarda milisegundos: con él, dos avisos del mismo milisegundo podrían saltarse
  o repetirse. `notification-cursor.ts` lo valida con zod (`t` con esa forma, `i` uuid) y uno mal
  formado da `invalid_input`, sin leer la bandeja.
- **Por qué no repite ni salta (R28):** el corte es por valor, no por posición. Un aviso nuevo
  entra arriba y no mueve el corte de los lotes que siguen. Un aviso que vence entre dos lotes
  simplemente no sale, y es lo que pide R17.
- **El cursor no autoriza nada:** cada lote vuelve a aplicar «avisos visibles» con el actor de la
  sesión. Un cursor fabricado con el `id` de un aviso ajeno solo fija el punto de corte (R13, R14).
- `nextCursor = null` cuando no hay undécima fila: el panel pinta el final (R27).

## 9. Entrega al cliente: consulta periódica detrás de una interfaz propia

### 9.1 La interfaz

```ts
// app/(private)/components/notifications/notification-feed.ts
export interface NotificationFeed {
  start(onSummary: (s: NotificationSummary) => void, onStop: (reason: 'unauthorized') => void): () => void;
  refresh(): Promise<void>;     // pedir ya (tras marcar, al volver visible, «Reintentar»)
}
export function createPollingFeed(deps: { fetchSummary; intervalMs; visibility: VisibilityPort; timers }): NotificationFeed;
```

`NotificationsProvider` se monta en el layout privado ~~**solo si** el usuario tiene
`notificaciones.consultar` efectivo~~ **para toda sesión** (enmienda 2026-10-19, E1; así se hizo en
la tanda 3). `onStop` recibe hoy `'unauthorized' | 'forbidden'` (§16, D-T3-6); tras T24 vuelve a
`'unauthorized'`, porque `forbidden` deja de existir. Recibe un `NotificationFeed` y una función `fetchBatch`
(la Server Action del lote), y expone por contexto:

```ts
{
  summary: { status: 'loading' | 'ready' | 'error'; unreadCount: number },
  list: {
    status: 'idle' | 'loading' | 'ready' | 'error';    // primer lote (R33)
    items: NotificationView[];
    tail: 'more' | 'loading' | 'error' | 'end';         // final de la lista (R25–R27)
  },
  open(), loadMore(), retryFirst(), retryMore(), markRead(id), markAllRead(), refresh(),
}
```

La campana y el panel leen **solo** ese contexto (R22) y no saben cómo llega el dato. Cambiar de
mecanismo es cambiar `createPollingFeed` por otra implementación (§12.3). La lógica de la lista es
un **reductor puro** (`notification-list-state.ts`) para probar R25–R28 sin DOM.

### 9.2 La consulta periódica

- **Intervalo: 30 s** (`NOTIFICATION_POLL_INTERVAL_MS`). La espera media es de 15 s y la peor de
  30. El primer evento es asíncrono (una tanda de PDFs tarda decenas de segundos en la cola), así
  que 15 s de media no cambian la experiencia. Bajar a 20 s multiplica las invocaciones por 1,5
  sin una necesidad que lo pida: el plan de Vercel y su cupo de invocaciones no están en `docs/`
  (desconocido, regla 6), así que se elige la cota alta del rango.
- **Solo con la pestaña visible** (`document.visibilityState`, R38). Al volver a `visible` se pide
  en el acto y se reanuda el ciclo.
- **Sin solapes:** el siguiente `setTimeout` se programa al terminar la consulta, nunca con
  `setInterval`. Es el patrón de `use-batch-status.ts`.
- Con `ok: false` por sesión (`unauthorized`), se para (R40). *(Enmienda 2026-10-19, E1: el caso
  `forbidden` se quita en T24.)* Con otro
  error, `summary.status = 'error'` y el ciclo sigue.
- **Lo que hace el resumen con la lista (R37, R28):** si `summary.newest.id` no es el primer aviso
  de `list.items` y la lista ya está cargada, el proveedor pide el **primer lote** (sin cursor) y
  lo mezcla arriba por `id`, sin tocar el cursor del final. Si ese primer lote no comparte ningún
  `id` con la lista (llegaron más de 10 entre dos consultas), la lista se **sustituye** por él y su
  cursor: es la única forma de no dejar un hueco. Con la lista sin cargar (panel nunca abierto) no
  se pide nada: solo se actualiza el conteo.
- **Sin estirar la sesión:** la sesión no tiene renovación deslizante
  (`identity/domain/session.ts`), así que consultar no la alarga. Cuando caduca, la consulta
  responde `unauthorized` y se para.
- **Lectura desde el cliente sin librería:** son Server Actions llamadas desde efectos, igual
  que `getBatchStatusAction`. Queda declarado aquí, como pide `docs/architecture.md >
  Anti-patrones` («Fetch de datos desde el cliente sin libreria aprobada en el `design.md`»).
- **No en el render del layout:** el conteo **no** se lee en el Server Component del layout, que
  por QC-75 R19 no añade consultas. El estado inicial es «cargando» hasta la primera respuesta,
  que se pide al montar.

### 9.3 Varias pestañas: conteo y tono una vez por navegador (R39, R43)

Solo con APIs del navegador, sin librería:

- **Bus entre pestañas:** un `BroadcastChannel('qc-notificaciones')`. Cada pestaña publica
  `{ type: 'summary', userId, summary }` al recibir un resumen y `{ type: 'read', userId, ids | 'all' }`
  al marcar. Las demás aplican el resumen, marcan como leídos los `ids` que tengan cargados y piden
  `refresh()` (R39). **Tanda 3 (§16, D-T3-5, pendiente de validar por el reviewer):** un resumen que
  llega por el bus se aplica **sin** `refresh()`, para que las pestañas no se reboten el resumen sin
  fin; un «leído» sí pide `refresh()`. Si `BroadcastChannel` no existe, se usa el evento `storage` de `localStorage`
  como respaldo.
- **Tono una sola vez (R41–R43):**
  - `localStorage['qc-notificaciones:ultimo:<userId>']` guarda `{ createdAt, id }` del aviso más
    reciente que **este navegador** ya conoce.
  - La **primera** respuesta de cada pestaña solo adelanta esa marca, en silencio (R42).
  - En las siguientes, si `summary.newest` es posterior a la marca **y** hay no leídos, la pestaña
    pide `navigator.locks.request('qc-notificaciones-tono', …)`. Dentro del candado vuelve a leer
    la marca, la adelanta y suena. La segunda pestaña, al entrar, ya ve la marca adelantada y no
    suena.
  - Web Locks es lo que hace atómico el «leer, comparar y escribir» entre pestañas;
    `localStorage` solo no lo es.
  - Sin `navigator.locks`, se hace el mismo «leer, comparar y escribir» sin candado. Riesgo
    aceptado: dos pestañas que reciben el mismo aviso en el mismo milisegundo sonarían dos veces.
- Las APIs del navegador (`BroadcastChannel`, `navigator.locks`, `localStorage`, `AudioContext`,
  `document.visibilityState`) entran por **puertos inyectables**. jsdom no tiene varias de ellas,
  y los tests usan dobles. El `IntersectionObserver` lo envuelve la librería y se simula con sus
  `test-utils` (§10.2).

### 9.4 Tono (R44, R45)

- `chime.ts` genera el sonido con **Web Audio API**: dos osciladores senoidales cortos
  (≈ 880 Hz y 1320 Hz, unos 120 ms cada uno) con envolvente de ganancia. No hay archivo de audio
  ni licencia que revisar (decisión cerrada «¿Qué sonido?»). No existe ningún control para
  silenciarlo.
- **Desbloqueo:** los navegadores no dejan sonar sin un gesto previo. El `AudioContext` se crea y
  se reanuda en el primer `pointerdown` o `keydown` de la página, con un escuchador de una sola
  vez.
- **Sin audio:** si al tocar sonar no hay `AudioContext`, o su `state` no es `running` tras
  `resume()`, no se lanza error. Se muestra `toast.info('Notificaciones sin sonido', { description:
  'Tu navegador no permite reproducir audio en esta página. Los avisos siguen llegando.',
  closeButton: true })` **una vez por sesión**, recordada en
  `sessionStorage['qc-notificaciones:sin-sonido']`, y el conteo se actualiza igual (R45). El toast
  solo sale cuando de verdad tocaba sonar.
- Consecuencia que conviene saber: sin ningún clic o tecla en la página desde que se cargó, el
  navegador no deja sonar y sale el toast. Es lo que la decisión cerrada pide.

### 9.5 Animación (R36)

- Campana: `@keyframes` de balanceo de 700 ms.
- Conteo: pulso de 360 ms.
- Fila nueva que llega con el panel abierto: entra desde arriba con fundido.
- Filas de un lote cargado por scroll: fundido.
- Todo dentro de `motion-safe:`, así que con movimiento reducido no hay animación.
- Panel: 200/150 ms (la animación del `Popover`).

`tests/guards/guard-movimiento.test.ts` ya vigila el respeto al movimiento reducido.

**Enmienda 2026-10-19 (E5, decisión del humano).** La guardia de movimiento (QC-228 R1) prohíbe
toda duración de más de 400 ms en `app/` y `components/`, y el balanceo de la campana dura 700 ms
(R36). La tanda 3 lo dejó sin hacer. Se queda en 700 ms con una **excepción con nombre** en la
guardia (T27):

- **Dónde vive el balanceo:** `@keyframes notification-bell-swing` en `app/globals.css` (junto a
  `notification-count-bump`, el pulso de la tanda 3) y su uso, bajo `motion-safe:`, en
  `app/(private)/components/notifications/notification-bell.tsx`. Una sola vez por llegada: sin
  `infinite` ni repetición (R23 de QC-228 sigue vigente). La curva sale de un token
  `--ease-*` (R2 de QC-228 sigue vigente). Solo se exime la **duración**.
- **La excepción en la guardia:** una constante `EXCEPCIONES_DE_DURACION`, lista cerrada de una
  entrada: `{ nombre: 'notification-bell-swing', ms: 700, archivos: ['app/globals.css',
  'app/(private)/components/notifications/notification-bell.tsx'], motivo: 'QC-137 R36: balanceo
  de la campana al llegar un aviso, 700 ms por decisión del humano del 2026-10-19' }`. La guardia
  solo deja pasar una duración de más de 400 ms si es **exactamente** esos ms, en una declaración
  que nombra esa animación y en uno de esos archivos. Cualquier otra cosa sigue roja.
- **Casos negativos de la excepción**, como los demás detectores de la guardia: 700 ms con otro
  nombre de animación, el mismo nombre en otro archivo y el mismo nombre a 701 ms siguen rojos.
  El caso «el bloque del login … es lo único que la guardia deja fuera» se ajusta para nombrar
  también esta excepción.
- El comentario de cabecera de la guardia cita la excepción y su motivo, junto a la del login.

### 9.6 Hora relativa (R30)

Con `Intl.DateTimeFormat('es')` y aritmética propia en `relative-time.ts`, en la zona horaria del
navegador (decisión del 2026-10-19):

| Antigüedad | Texto |
| --- | --- |
| < 1 min | ahora |
| < 60 min | hace N min |
| < 24 h | hace N h |
| de 24 h a 7 días (incluido el día 7) | hace N días («hace 1 día» con 1) |
| > 7 días | DD/MM/AAAA HH:MM |

N es la parte entera. Se pinta **en el cliente** (`'use client'`) para que el servidor y el
navegador no discrepen de hora y no haya desajuste de hidratación. Se recalcula con cada resumen.
No hace falta librería de fechas: son cinco ramas.

`{hora}` del cuerpo (R47) se sustituye en el mismo componente por `HH:MM` de `bodyTime` con
`Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })`. Si un
cuerpo trae `{hora}` sin `bodyTime` (no debería: lo impide el `CHECK` de §3), se quita la marca
junto con « a las ».

## 10. UI

### 10.1 Campana (`app/(private)/components/notifications/notification-bell.tsx`)

- Se monta en la cabecera del layout a la izquierda de `ThemeToggle`, dentro del `TooltipProvider`
  existente. En el teléfono se ve junto a «Alternar barra lateral», como en el tablero.
- `aria-label` del botón: «Notificaciones, N sin leer» o «Notificaciones, ninguna sin leer» (R22).
  La insignia es `aria-hidden`: el número ya va en el nombre.
- Panel (`role="dialog"`, `aria-label="Notificaciones"`): cabecera «Notificaciones» +
  «Marcar todas como leídas» (solo con conteo mayor que 0, R23), y debajo el área con scroll con la
  lista y su final (§10.2).
- Al abrir: `open()` del proveedor. La primera vez pide el primer lote (esqueletos, R33); las
  siguientes enseña lo cargado y refresca arriba (§9.2).
- Escritorio y tablet: `w-[400px]`, área con scroll de `h-[520px]` (R34), anclado bajo la campana
  como hoy.
- Clic en un aviso: `markRead(id)` (local en el acto, luego la acción) y ~~`router.push(href)`~~
  navegación con **`next/link`** cuyo `onSelect` marca y cierra el panel; con `href = null` la
  fila es un `<button>` (tanda 3, §16, D-T3-8, pendiente de validar por el reviewer). Si el
  marcado falla, se navega igual y el siguiente resumen corrige el conteo (R31).
- «Marcar todas»: todos los `items` cargados pasan a `read: true` y el conteo a 0 en el acto;
  luego la acción y la publicación en el bus (R32, R39).

### 10.2 Lista y carga al hacer scroll (R25–R28, R33)

- **Centinela con `react-intersection-observer`** (decisión del 2026-10-19):
  `NotificationListTail` pinta un `div` de 1 px al final de la lista con el `ref` de
  `useInView({ root: <área con scroll del panel>, rootMargin: '0px 0px 120px 0px', skip: tail !==
  'more', onChange: (inView) => inView && loadMore() })`. Es el mismo patrón que
  `ShowcaseLoadTrigger`. Los 120 px son «acercarse al final»: el siguiente lote se pide antes de
  tocar fondo. Con `skip` el observador solo vive con `tail === 'more'`, así que nunca hay dos
  peticiones a la vez (R25) y tras un error no se reintenta solo (R26).
- `root` es el elemento del área con scroll, guardado en estado con un `ref` de callback: hasta que
  existe, `skip` sigue en `true`.
- **Sin `IntersectionObserver`** (navegador antiguo): `fallbackInView: true`. El centinela cuenta
  como visible y el panel va pidiendo lotes uno tras otro hasta el final. Como mucho son 90 días
  de avisos, y no hace falta escuchar `scroll` a mano.
- **Aislamiento de la librería:** `notification-list-tail.tsx` es el **único** archivo de
  notificaciones que la importa. La guardia de QC-140
  (`tests/unit/proveedores-ui/guard-convenciones-showcase.test.ts`, caso R18) pasa de «solo la
  importa `showcase-load-trigger.tsx`» a una **lista cerrada** de dos archivos:
  `ARCHIVOS_AUTORIZADOS = [showcase-load-trigger.tsx, notification-list-tail.tsx]`, con
  `expect(importadores).toEqual(ARCHIVOS_AUTORIZADOS)`. Cualquier tercer importador, o la falta de
  uno de los dos, la pone en rojo. Se renombra el caso a «R18 (ampliada por QC-137)» y se comenta
  por qué. El caso D8 (sin observador a mano ni `scroll` en la vista de proveedores) no cambia.
- **Tests:** `mockAllIsIntersecting` de `react-intersection-observer/test-utils`, como en
  `tests/unit/proveedores-ui/`.
- **Lista corta:** si el primer lote no llena el área, el centinela ya está a la vista y pide el
  siguiente; con `nextCursor = null` no hay nada que pedir y se pinta el final.
- **Final de la lista**, según `tail`:
  - `loading`: `role="status"`, icono de giro y «Cargando más avisos…» (estado 5);
  - `error`: `role="alert"`, «No se pudieron cargar más avisos.» y `Button` «Reintentar», que llama a
    `retryMore()` con el **mismo** cursor (estado 6, R26);
  - `end` con al menos un aviso: «No hay más avisos. Se conservan 90 días.» (estado 7, R27).
- **Primer lote** (`list.status`): `loading` → cinco `Skeleton` de fila (estado 9); `error` →
  ~~`ErrorState`~~ `EmptyState` + `Button` dentro de `role="alert"` (tanda 3, §16, D-T3-10)
  «No se pudieron cargar las notificaciones.» + «Reintentar» → `retryFirst()`
  (estado 10); `ready` sin avisos → `EmptyState` «No tienes notificaciones.» (estado 8).
- **Teclado:** el foco por tabulación recorre las filas; al llegar a la última, el área se desplaza
  y el centinela entra, como con el ratón.

### 10.3 Teléfono: panel anclado a la pantalla (R35)

Por debajo del punto de corte de teléfono ~~(`sm`, el mismo que usa la cabecera)~~ **768 px,
con `useIsMobile()`**, el que usa de verdad la cabecera (`md:hidden`); la tablet (820 px) se
comporta como escritorio (tanda 3, §16, D-T3-11, pendiente de validar por el reviewer):

- `PopoverContent` recibe `anchor` = la cabecera del layout, no la campana. ~~(un `ref` al
  `<header>`)~~ Se resuelve con `() => trigger.closest('header')`, para que el `<header>` del layout
  siga siendo Server Component (§16, D-T3-12); `collisionPadding={{ top: 8, right: 8, bottom: 16, left: 8 }}`, `sideOffset={8}` y en
  el `Positioner` `w-[calc(100vw-16px)]`. Así el panel ocupa el ancho con 8 px por lado, empieza
  bajo la cabecera y se queda a 16 px del borde inferior (decisión del 2026-10-19).
- Alto: `max-h-(--available-height)` sobre el panel, la variable que el `Positioner`
  de Base UI expone con el espacio libre hasta el borde de la pantalla menos el `collisionPadding`.
  El área de la lista es `flex-1 min-h-0 overflow-y-auto`: el scroll queda dentro (R35) y el
  panel nunca sale de la pantalla.
- Filas con `min-h-11` (44 px, `touchTarget`) y la hora bajo el texto, como el tablero.
- **A verificar en T16 contra la versión instalada de `@base-ui/react`:** que `Positioner` acepte
  `anchor` y `collisionPadding` y exponga `--available-height`. Si alguna falta, el plan B es
  `positionMethod="fixed"` con `inset-x-2`, `top` = alto de la cabecera + 8 px y
  `max-h-[calc(100dvh-<top>-16px)]`, mismo resultado visible. No cambia ningún requisito.

### 10.4 Lo que no se toca (R24)

- `lib/shared/navigation/private-nav.ts`, `components/private/app-sidebar.tsx`,
  `firstVisibleNavHref` y sus tests quedan como en `dev`. `NavLink.badge` sigue sin uso.
- No hay `app/(private)/notificaciones/`, ni `NOTIFICATIONS_ROUTE`, ni entrada en
  `PRIVATE_ROUTE_PREFIXES`.
- Un test (`tests/unit/notificaciones-ui/solo-campana.test.ts`) lo fija: no existe la carpeta de la
  ruta, ningún `NavLink` apunta a `/notificaciones`, ninguno lleva `badge` y
  `firstVisibleNavHref` no cambia para ningún rol.

### 10.5 Multiplataforma

- Áreas táctiles de 44 px (`touchTarget`).
- `dvh` y no `vh`.
- Nada que dependa de `:hover`: el tooltip «Notificaciones» es un extra y no la única vía.
- Web Audio, `BroadcastChannel`, Web Locks, Page Visibility e `IntersectionObserver` con `root`
  propio: soporte en Safari/WebKit y Chrome Android **sin verificar en este spec** (sin red para
  consultar tablas de compatibilidad; regla 6). Por eso cada una tiene su degradación (§9.3, §9.4,
  §10.2) y la tarea de QA lo comprueba en un iPhone y un Android reales.

## 11. Retención de 90 días (R17)

- **En lectura:** todas las consultas filtran `created_at >= now() - 90 días`. Un aviso vencido
  deja de verse aunque el borrado no haya pasado todavía.
- **Borrado:** `app/api/cron/purgar-notificaciones/route.ts`, declarado en `vercel.json` una vez
  al día:
  - exige `Authorization: Bearer <CRON_SECRET>` (401 si no casa, 500 si falta la variable), como
    `caducar-pedidos`;
  - recorre las empresas **una a una** y, en cada una, ejecuta
    `DELETE FROM notifications WHERE company_id = $1 AND created_at < $cutoff`; las lecturas caen
    por la cascada.
  - **Enmienda 2026-10-19 (E4, decisión del humano):** recorre **todas** las empresas, también las
    dadas de baja. Hoy `listCompanyIds` de la fachada es `listActiveCompanyIds` (la lista del cron
    de pedidos, `deletedAt: null`), así que los avisos de una empresa dada de baja no se borraban
    nunca. `company-directory-prisma.ts` gana `listAllCompanyIds()` (mismo `findMany` sin el
    filtro de baja, `orderBy: { id: 'asc' }`) y la fachada `notificaciones` lo usa. El cron de
    pedidos sigue con `listActiveCompanyIds`. Una empresa borrada físicamente ya se lleva sus
    avisos por la FK `ON DELETE CASCADE` (§3).
  - Horario `30 7 * * *` en `vercel.json` (media hora después del de pedidos), sin `maxDuration`;
    responde `{ deleted }`, o 500 con `{ deleted, failedCount }` si falla alguna empresa, sin cortar
    las demás. La puerta (`verifyCronSecret`, el mismo de pedidos) y la lista de empresas están en
    la fachada; el recorrido, en `purge-route.ts` (tanda 2, §16, D-T2-9 y D-T2-10, pendientes de
    validar por el reviewer).
- Es **núcleo**: borra con el añadido apagado. Entra en `RUTAS_FUERA_DE_SESION` de
  `tests/guards/guard-rutas-fuera-de-sesion.test.ts`, con su prueba.
- **Borrado físico, a propósito:** `docs/architecture.md` prohíbe el `DELETE` en tablas
  **transaccionales**. Un aviso no mueve existencias ni dinero, es una copia efímera de un hecho
  que ya consta en su módulo. Y la decisión cerrada dice «se borra a los 90 días».
- `tests/unit/pedidos/vercel-cron.test.ts` (QC-141 R23) afirma hoy que `vercel.json` tiene **una
  sola** tarea. Se reescribe para afirmar que existe la de `caducar-pedidos` con su horario, sin
  fijar el total. Su intención no cambia.
- **Desconocido:** el plan de Vercel (y su límite de crons) no está en `docs/`. Si el plan no
  admitiera un segundo cron, la alternativa es la de §13 A7.

## 12. Tiempo real: comparación, escala y camino de migración

Decisión del humano (2026-10-16): **consulta periódica**. Esto es el razonamiento que la sostiene
y lo que hay que vigilar.

### 12.1 Carga de hoy

Hay 3-4 empresas cliente. El número de usuarios conectados no está en `docs/` (desconocido): la
tabla da la carga por cada N usuarios con la pestaña visible, a 1 consulta cada 30 s. Los lotes
del panel no entran: solo se piden al abrirlo, al hacer scroll o cuando llega un aviso con la
lista cargada.

| Usuarios visibles a la vez | Consultas/s | Consultas a la base/s (sesión + conteo + más reciente) | Invocaciones en 8 h |
| --- | --- | --- | --- |
| 20 | 0,7 | ~2 | ~19.000 |
| 50 | 1,7 | ~5 | ~48.000 |
| 100 | 3,3 | ~10 | ~96.000 |
| 500 | 16,7 | ~50 | ~480.000 |

Son lecturas por índice (§3). Hasta 100 usuarios a la vez es carga baja para el pooler, y el coste
real es el número de invocaciones de Vercel, que crece en línea con usuarios × horas con la pestaña
visible.

### 12.2 Comparación

| | Consulta periódica (elegida) | Supabase Realtime Broadcast, canal privado |
| --- | --- | --- |
| Retraso | 15 s de media, 30 s como máximo | Menos de 1 s |
| Coste que crece | Invocaciones y lecturas, aunque no haya avisos | Conexiones abiertas a la vez; mensajes solo cuando hay avisos |
| Dependencia | Ninguna | `@supabase/supabase-js` en el cliente (regla 7, hoy no instalada a propósito) |
| Autorización | La de siempre: permiso en el caso de uso, Prisma | Un JWT que firmamos con el secreto del proyecto, con `company_id` y `user_id`, y **policies en `realtime.messages`**. Esas policies sí serían frontera, lo que exige enmendar `docs/architecture.md > Acceso a datos y autorizacion` por `/afinar-regla` |
| Piezas nuevas | Ninguna en infraestructura | Emisión del token, renovación al caducar, reconexión, topics por empresa/usuario/rol |
| Límites del proveedor | Los de Vercel (plan desconocido) | Conexiones a la vez y mensajes por segundo según el plan de Supabase (sin verificar aquí: hay que mirarlo al migrar) |

### 12.3 Qué cambia al escalar y camino de migración

- **Umbral orientativo para revisar la decisión:** unos **100 usuarios con la pestaña visible a la
  vez**, o una **queja real por el retraso**, lo que llegue antes. Antes de eso, la consulta es más
  barata en piezas y en riesgo de autorización.
- **Señal medible:** las invocaciones de `getNotificationSummaryAction` en los registros de Vercel.
  La acción registra con el logger del módulo, sin datos personales.
- **Primer ajuste, sin migrar:** subir el intervalo o elegir una pestaña líder por
  `BroadcastChannel` (§13 A4). Las dos cosas caben dentro de `createPollingFeed`.
- **Qué se reemplaza al migrar a Broadcast:**
  1. **Servidor:** el adaptador `in_app-channel.ts` (§5) pasa de «no hace nada» a publicar en el
     topic `company:<id>:user:<id>` o `company:<id>:role:<name>`. El motor, el catálogo, la
     bandeja y los emisores no cambian.
  2. **Cliente:** `createPollingFeed` se sustituye por `createBroadcastFeed`, que se suscribe y,
     con cada mensaje, llama a `refresh()`. El resumen y los lotes se siguen leyendo por Server
     Action, así que el mensaje no lleva datos. Conviene dejar una consulta lenta de respaldo, de
     unos 5 min. El proveedor, la campana, el panel y el tono no cambian.
  3. **Lo nuevo:** la acción que emite el token firmado, las policies de `realtime.messages`, la
     dependencia aprobada y la enmienda a `docs/architecture.md`.

## 13. Alternativas descartadas

- **A1. Supabase Realtime Broadcast hoy.** Ver §12. Descartada **hoy**, no para siempre: añade una
  dependencia, una segunda frontera de autorización (las policies de Realtime) y piezas de
  conexión, para ganar segundos en un aviso que ya es asíncrono, con 3-4 empresas.
- **A2. Realtime Postgres Changes con la anon key.** Ya descartada en QC-107: no puede acotar por
  empresa, y la sesión es la cookie de `identity`, no Supabase Auth.
- **A3. Server-Sent Events desde un route handler.** Mantiene una función de Vercel viva por
  usuario conectado, que se paga por tiempo y se corta por duración máxima. Es peor que la consulta
  en coste y no evita la reconexión.
- **A4. Una sola pestaña «líder» que consulta y reparte por `BroadcastChannel`.** Ahorra consultas
  con muchas pestañas visibles, pero obliga a traspasar el liderazgo al cerrar u ocultar la
  pestaña. Como solo consultan las pestañas visibles, lo normal es una por ventana y la ganancia es
  pequeña. Queda como primer ajuste al escalar (§12.3).
- **A5. Leer el conteo en el render del layout.** Rompería QC-75 R19 (el layout no añade
  consultas), y el número quedaría viejo en cuanto llegara un aviso.
- **A6. Guardar la URL del destino en el aviso.** Un cambio de ruta dejaría enlaces rotos durante
  90 días, y el dominio tendría que conocer `lib/shared/routes`. Se guarda el destino abstracto
  (§4.3).
- **A7. Borrar los vencidos al escribir uno nuevo, sin cron.** Una empresa sin avisos nuevos
  conservaría los viejos para siempre. Solo sirve de plan B si el plan de Vercel no admite el
  segundo cron, junto con el filtro de lectura, que ya garantiza que no se ven.
- **A8. Un aviso por archivo fallido, además del de fin de tanda.** Daría dos avisos por la misma
  tanda. Ver A17.
- **A9. Guardar el rol por `role_id`.** Ver §3.3.
- **A10. Que la bandeja sea un canal más (`in_app` escribe la fila).** Un fallo del canal se
  llevaría la bandeja por delante, contra la decisión cerrada. La bandeja va antes y aparte (§5).
- **A11. `IntersectionObserver` del navegador a mano, sin librería.** Lo propuso el leader en el
  tablero. Habría dejado la guardia de QC-140 intacta, pero reescribe lo que ya resuelve una
  librería aprobada y probada en el repo: el alta y la baja del observador, el `skip`, el respaldo
  sin soporte y los dobles de test. Descartada por el humano el 2026-10-19.
- **A12. Paginación por desplazamiento (`OFFSET`, `toOffsetLimit`/`buildPage`).** Ya existe y es
  más corta, pero un aviso nuevo que entra arriba empuja todo una posición: el lote siguiente
  repetiría el último aviso visto, y uno que vence entre lotes haría saltar otro. Rompe R28. Además
  el `OFFSET` recorre las filas saltadas en cada lote.
- **A13. Botón «Cargar más» en vez de carga automática.** Más simple de probar, pero la decisión
  cerrada pide carga automática y el tablero no lo dibuja. Tampoco se usa como respaldo sin
  `IntersectionObserver`: el respaldo es `fallbackInView`, que no añade UI (§10.2).
- **A14. Volver a pedir la lista entera desde el principio al llegar un aviso.** Perdería la
  posición del scroll y lo ya cargado. Se mezcla arriba el primer lote (§9.2).
- **A15. Reutilizar `ShowcaseLoadTrigger` subiéndolo a `shared`.** No admite `root` ni
  `rootMargin`, y el panel los necesita: el scroll es del panel, no de la página. Extenderlo y
  moverlo tocaría la vista de proveedores y sus guardias D8/R18 más de lo necesario. Se compone un
  centinela propio con el mismo patrón.
- **A16. Guardar `document_batches.supplier_id` para llevar al detalle del proveedor.** Descartada
  por el humano el 2026-10-19: el enlace va a la lista de proveedores (R49).
- **A17. Un aviso por cada archivo fallido.** Descartada por el humano el 2026-10-19 (R46). Lo
  sustituye nombrar los fallidos en el aviso de la tanda (R51).
- **A18. Formatear «a las HH:MM» en el servidor al crear el aviso.** No hay zona horaria de
  empresa ni de usuario en el código, y el servidor de Vercel corre en UTC: la hora saldría mal.
  Se guarda el instante (`body_time`) y se pinta en el navegador (§3, §9.6).
- **A19. Nombrar todos los archivos fallidos, sin tope.** Una tanda puede traer hasta
  `MAX_FILES_PER_BATCH`: el texto no cabría en la fila del panel. Tope de 3 y «y N más» (R51).

Añadidas por la enmienda del 2026-10-19:

- **A20. Quitar el añadido borrando o editando la migración `20261019120100_notifications_addon`.**
  Más corto y sin migración nueva, pero esa migración ya está commiteada y en push: pudo aplicarse
  en otra base (la de test de otra persona, una de vista previa), y `prisma migrate` detectaría el
  cambio de huella o dejaría filas huérfanas que nadie borra. Se deshace con una migración nueva
  (§3.2.4, R54).
- **A21. Dejar el permiso y el añadido y solo dejar de comprobarlos.** No toca tests de otras
  fichas, pero deja en la base y en el catálogo de añadidos un permiso y un añadido que no hacen
  nada, y que cualquier pantalla de añadidos pintaría como un interruptor que no apaga nada.
  Contradice R18 (E1).
- **A22. Borrar los vencidos con un solo `DELETE … WHERE created_at < $cutoff`, sin recorrer
  empresas.** Cubriría también las dadas de baja sin lista nueva, pero es una consulta de negocio
  sin `company_id`, contra la regla de aislamiento y contra R17 («una a una»). Se añade
  `listAllCompanyIds` (§11).
- **A23. Bajar el balanceo de la campana a 400 ms o menos.** No toca la guardia de QC-228, pero
  cambia R36, que el humano mantiene en 700 ms (E5). Se exime solo esa animación, con nombre (§9.5).
- **A24. Excepción de la guardia de movimiento por archivo entero** (`notification-bell.tsx` libre de
  la regla de 400 ms). Más simple, pero dejaría pasar cualquier otra animación larga que alguien
  añada a ese archivo. La excepción va por nombre de animación, archivo y ms exactos.

## 14. Dependencias

**Ninguna nueva.** Web Audio API, `BroadcastChannel`, Web Locks API, Page Visibility API,
`IntersectionObserver`, `localStorage`/`sessionStorage` e `Intl` son APIs del navegador.
`lucide-react` (`Bell`, `FileCheck`, `FileWarning`, `FileX`, `VolumeX`, `Loader2`), `sonner`,
`@base-ui/react`, `zod` y `react-intersection-observer` ya están aprobados (filas en
`docs/dependencias.md`). Esta decisión no enmienda `docs/architecture.md`.

## 15. Lo que toca de otras fichas

- **QC-277 — enmienda 2026-10-19 (E1):** lo de abajo **se deshace**. QC-277 R2 vuelve a «cinco
  añadidos» y sus tests vuelven a su versión anterior a la tanda 1 (T24).
- **QC-228 — enmienda 2026-10-19 (E5):** `tests/guards/guard-movimiento.test.ts` gana una excepción
  de duración con nombre, solo para `notification-bell-swing` a 700 ms (§9.5). La intención de su
  R1 no cambia para nada más.
- **Pedidos (cron) — enmienda 2026-10-19 (E4):** `listActiveCompanyIds` no cambia; el cron de
  notificaciones usa la lista nueva `listAllCompanyIds` (§11).
- **QC-277 (texto original):**
  - R2 (cinco añadidos) pasa a seis (§7);
  - se actualizan `tests/unit/identity/addons/company-addons.test.ts`,
    `tests/unit/identity/companies/set-all-company-addons.test.ts` y
    `tests/integration/identity/company-addons.int.test.ts`;
  - si existe la pantalla del Maestro que pinta un interruptor por añadido, necesita la etiqueta
    del sexto. No está en esta rama (buscado `ADDONS` en `app/`: nada).
- **QC-141:** el test de `vercel.json` (§11).
- **QC-107:** `document_files` gana `original_name`, `enqueueBatchSchema` gana `names` opcional y
  `DocumentUpload` manda el nombre de cada archivo al encolar (§6.3). `run-document-job` y
  `get-batch-status` ganan un listener opcional (§6.2). Su R16 («NO emitir avisos») era una frontera
  de alcance de aquella ficha, que dejaba el aviso en manos de esta: los avisos los emite
  `notificaciones`, no la pantalla.
- **QC-140:** el caso R18 de `tests/unit/proveedores-ui/guard-convenciones-showcase.test.ts` pasa
  de un importador autorizado a una lista cerrada de dos (§10.2). Su intención no cambia: la
  librería sigue aislada en un archivo por pantalla, y sustituirla es reescribir esos dos archivos.
  Su test: el propio caso, en verde con los dos archivos y en rojo si aparece un tercer importador
  o falta uno de los dos. El caso D8 no cambia.
- **QC-75 / QC-13:** **ya no se tocan** (revisión del 2026-10-16): ni `private-nav.ts`, ni
  `AppSidebar`, ni `firstVisibleNavHref`.
- **`components/ui/popover.tsx`:** tres props opcionales en `PopoverContent` (§10.3), sin cambio
  para los usos actuales.

## 16. Decisiones de las tandas 1–3 fuera del spec (enmienda del 2026-10-19)

Fuente: `progress/impl_QC-137-sistema-de-notificaciones-por-rol.md`. Las marcadas **Humano** son
las E1–E5 de `requirements.md > Enmiendas` y no se reabren. Las demás quedan **pendientes de
validar por el reviewer**: si alguna se rechaza, la corrección es una tarea nueva, no un cambio
silencioso. El id es `D-T<tanda>-<n.º en la bitácora>`.

| Id | Decisión | Dónde | Estado |
| --- | --- | --- | --- |
| D-T1-2 | `isUserInCompany` en un puerto propio, `identity/ports/company-membership-reader.ts`, y no en `CompanyRepository` | §7 | **Humano (E2)** |
| D-T1-3 | Un usuario dado de baja no es miembro (`deletedAt: null`) | §7, R55 | **Humano (E2)** |
| D-T1-4 | Descripción del permiso «Consultar los avisos propios y marcarlos como leídos.» | — | Sin objeto tras E1 (T24 quita el permiso) |
| D-T1-5 | ~55 asserts de permisos por rol de otras fichas ajustados con filtros «sin X» | §7 | **Humano (E1): se deshacen en T24** |
| D-T1-B1 | Sin códigos nuevos en el catálogo de errores; `markNotificationRead` devuelve `'marked' \| 'not_found'`; `forbidden` y `not_found` solo como `code` de la respuesta de las acciones | §8 | Pendiente de validar por el reviewer (tras E1, `forbidden` desaparece) |
| D-T1-B2 | Orden de cortes en las acciones: sesión → forma → permiso en el caso de uso | §8 | Sin objeto tras E1 (no hay permiso) |
| D-T1-B3 | Reloj inyectado (`now`) en los casos de uso; el corte de 90 días se calcula en el dominio y viaja en `InboxScope.cutoff` | §8, §11 | Pendiente de validar por el reviewer |
| D-T1-B4 | Nombres no fijados: `NotifyDeps.addon`, `InboxScope`, `InboxCursor`, `StoredTarget`, `notificationHref` | §4, §8 | Pendiente de validar por el reviewer (`NotifyDeps.addon` sale en T24) |
| D-T1-B5 | `getNotificationSummaryAction` registra cada lectura (`notification_summary_read`, solo `companyId`): una línea cada 30 s por pestaña visible | §12.3 | Pendiente de validar por el reviewer |
| D-T1-B6 | `summary.newest` es el más reciente visible, leído o no; el tono exige además `unreadCount > 0` | §9.3 | Pendiente de validar por el reviewer |
| D-T2-1 | `readBatchNotice` en un puerto aparte, `BatchNoticeReader` (tipo `BatchNotice`), en `ports/document-batch-repository.ts` | §6.2 | Pendiente de validar por el reviewer |
| D-T2-2 | `NewBatch` con `paths` + `originalNames?` por posición, no `files[]` | §6.3 | **Humano (E3)** |
| D-T2-3 | `createBatch` escribe `createdAt = ahora + i ms` por archivo | §6.3 | **Humano (E3)** |
| D-T2-4 | `lib/modules/documentos/index.ts` no se toca (`module-contract.test.ts` congela sus tipos); la composición tipa el listener con `NonNullable<Parameters<typeof createRunDocumentJob>[0]['batchFinished']>` | §6.1 | Pendiente de validar por el reviewer |
| D-T2-5 | `batchFinishedDeps` se declara junto a `runDocumentJob` y lee `notificaciones.notify` al llamar; log de R48 `forModule('documentos')`, `batch_notice_without_author` | §6.1 | Pendiente de validar por el reviewer |
| D-T2-6 | `bodyTime = uploadedAt` solo cuando el cuerpo lleva `{hora}` (las filas «con errores» no la llevan y el CHECK exige marca y hora juntas) | §3, §6.4 | Pendiente de validar por el reviewer |
| D-T2-7 | Esquema del payload: `strictObject`, `recipientUserId` uuid, `strategy` con los dos literales, `done + failed = total`, `failedNames.length ≤ failed`, máximo 3 | §6.4 | Pendiente de validar por el reviewer |
| D-T2-8 | El cron recorre solo `listActiveCompanyIds` | §11 | **Humano (E4): se cambia en T26** |
| D-T2-9 | Puerta (`verifyCronSecret`) y lista de empresas en la fachada; recorrido en `purge-route.ts`; respuesta `{ deleted }` / 500 `{ deleted, failedCount }` | §11 | Pendiente de validar por el reviewer |
| D-T2-10 | Horario del cron `30 7 * * *`, sin `maxDuration` | §11 | Pendiente de validar por el reviewer |
| D-T2-11 | `getBatchStatus` avisa en cada consulta de una tanda ya cerrada; el `UNIQUE (company_id, dedupe_key)` deja el resto en `notification_duplicate` | §6.2 | Pendiente de validar por el reviewer |
| D-T3-H | La campana, el panel y el feed se montan para toda sesión, sin permiso ni añadido; el caso de T18 «R19: sin permiso, el layout no monta la campana» se sustituye por dos casos de `notification-bell.test.tsx` | §9.1, R19 | **Humano (E1)** |
| D-T3-1 | T10: cinco tests existentes de `documentos-ui` cambiados (añaden `names` al payload esperado; la comparación sigue exacta), contra «sin cambios» | §6.3 | Pendiente de validar por el reviewer |
| D-T3-2 | T17 por el plan A: `@base-ui/react` 1.7.0 tiene `anchor`, `collisionPadding` y `--available-height` | §10.3 | Pendiente de validar por el reviewer |
| D-T3-3 | `app/globals.css` gana `@keyframes notification-count-bump` (pulso de 360 ms); no estaba en «Archivos esperados» | §9.5 | Pendiente de validar por el reviewer (el archivo entra en «Archivos esperados» con esta enmienda) |
| D-T3-4 | Contexto ampliado: `summary.arrivals`, `summary.checkedAt`; `list` expone el estado completo del reductor | §9.1 | Pendiente de validar por el reviewer |
| D-T3-5 | Un resumen que llega por el bus se aplica sin `refresh()`; un «leído» sí lo pide | §9.3 | Pendiente de validar por el reviewer |
| D-T3-6 | `onStop` del feed es `'unauthorized' \| 'forbidden'` | §9.1 | Pendiente de validar por el reviewer; tras T24 vuelve a `'unauthorized'` |
| D-T3-7 | `NotificationsProvider` solo exige `userId`; `feed`, `actions`, `bus` y `chime` opcionales (con `null`, desactivados) | §9.1 | Pendiente de validar por el reviewer |
| D-T3-8 | `NotificationItem` navega con `next/link` (su `onSelect` marca y cierra); con `href = null` pinta un `<button>` | §10.1 | Pendiente de validar por el reviewer |
| D-T3-9 | Textos de interfaz como constantes exportadas de cada archivo, sin archivo de textos nuevo | §10 | Pendiente de validar por el reviewer |
| D-T3-10 | Error del primer lote con `EmptyState` + `Button` en `role="alert"`, no `ErrorState` | «Lo que ya existe», §10.2 | Pendiente de validar por el reviewer |
| D-T3-11 | Punto de corte del teléfono: `useIsMobile()` (768 px), no `sm`; la tablet de 820 px va como escritorio | §10.3 | Pendiente de validar por el reviewer |
| D-T3-12 | Ancla del teléfono `() => trigger.closest('header')`, para que el `<header>` siga siendo Server Component | §10.3 | Pendiente de validar por el reviewer |
| D-T3-13 | Hora relativa con `now = max(summary.checkedAt, instante de apertura)`, sin leer el reloj en el render | §9.6 | Pendiente de validar por el reviewer |
| D-T3-14 | `private-layout.test.tsx` y `navegacion/private-layout-menu.test.tsx` ganan un `vi.mock` de `notification-actions` (sin cambiar aserciones), contra el «sin cambios» de T19 | §10.4 | Pendiente de validar por el reviewer |
| D-T3-R36 | El balanceo de 700 ms quedó sin hacer por la guardia de movimiento | §9.5 | **Humano (E5): se hace en T27** |
