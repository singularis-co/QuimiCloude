# QC-137 — sistema-de-notificaciones-por-rol · design.md

> Requisitos en `requirements.md` (R1–R49). Tableros aprobados el 2026-10-16 y revisados el mismo
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

## Lo que ya existe

**Búsqueda** (`docs/specs.md > Antes de especificar`). Términos: `notificaci`, `aviso`, `campana`,
`bell`, `badge`, `realtime`, `tono`, `cursor`, `IntersectionObserver`.

| Dónde | Qué apareció | Qué se hace |
| --- | --- | --- |
| Board (`feature_list.json`) | QC-247/QC-248: WhatsApp al cliente final. QC-292…QC-298: fichas hijas de esta (eventos y canales) | Ya en «Lo que NO entra» y pregunta abierta 2. Nada que choque |
| `specs/` | QC-11/QC-8: ítem «Notificaciones» de relleno, retirado en QC-13. QC-107 D5/D6: el tiempo real y el aviso de fin de tanda son encargo de QC-137. QC-277 D3: notificaciones como añadido futuro | Se cumple el encargo de QC-107 (R46–R49) y se crea el añadido de QC-277 D3 (R18–R20). El ítem del menú **no** vuelve (R24) |
| Código | `lib/shared/navigation/private-nav.ts`: `NavLink.badge?: number`, fijo y sin uso; `NavIconName` ya incluye `'bell'` | **No se toca** (R24). `private-nav.ts`, `AppSidebar` y `firstVisibleNavHref` quedan como en `dev` |
| Código | `lib/modules/inventario/domain/stock-increase-listener.ts` y su cableado en `lib/composition/index.ts` | **Patrón que se copia** para el emisor de `documentos` (§6) |
| Código | `components/shared/document-upload/use-batch-status.ts`: sondeo por Server Action (`getBatchStatusAction`) cada 2 s | **Precedente** de lectura desde el cliente por Server Action, sin librería de fetch (§9) |
| Código | `identity.isCompanyAddonActive(companyId, addon)`, ya usado por `documentos` fuera de sesión | Se reutiliza para no crear avisos con el añadido apagado (R19) |
| Código | `lib/shared/pagination.ts`: `DEFAULT_PAGE_SIZE = 10`, `toOffsetLimit`, `buildPage` | Se reutiliza **solo** `DEFAULT_PAGE_SIZE` como tamaño de lote. `toOffsetLimit` y `buildPage` no: son por desplazamiento y repetirían o saltarían avisos al llegar uno nuevo (R28, A12) |
| Código | `app/(private)/proveedores/components/showcase-load-trigger.tsx` usa `react-intersection-observer` (aprobada en `docs/dependencias.md`), y `tests/unit/proveedores-ui/guard-convenciones-showcase.test.ts` (QC-140 R18) exige que sea su **único** importador | La decisión cerrada pide el `IntersectionObserver` del navegador **sin librería**: no se importa la librería y la guardia de QC-140 sigue verde sin cambios. Pregunta abierta 11 y A11 |
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
| `ErrorState` | 1. Reutiliza | Error del primer lote con «Reintentar» (R33) |
| `Skeleton` | 1. Reutiliza | Carga del primer lote (R33). `TableSkeleton` se descarta: la lista no es una tabla |
| `Toaster` (`components/ui/sonner.tsx`) + `toast` de `sonner` | 1. Reutiliza | «Notificaciones sin sonido» |
| `DataTable` | Descartada | Es una tabla con orden y columnas: la bandeja es una lista |
| `Notice` | Descartada | Aviso en línea; el tablero pide toast |
| `UrlTabs`, `PageShell`, `PageHeader` | Descartadas en la revisión | Eran de la página `/notificaciones`, que ya no existe |
| `DocumentUpload`, `DocumentUploadDialog`, `DocumentUploadRow` | 2. Extiende | Prop opcional `supplierId` que viaja al encolar (§6.3). Los consumidores actuales no cambian |

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
| Final de la lista (`NotificationListTail`: centinela + «Cargando más avisos…» / error con «Reintentar» / «No hay más avisos…») | 3. Compón (`Button` + icono de giro) | Estados 5, 6 y 7 del tablero |
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
    notification-event.ts                    NotificationEvent { key, companyId, dedupeKey, payload }
    notify.ts                                createNotify: el motor (R2–R4, R7, R8, R11, R19)
    channel-factory.ts                       createChannelFactory (R8–R10)
    notification-cursor.ts                   cursor opaco: codificar/decodificar con zod (R28, §8.1)
    list-notifications.ts                    un lote por cursor (R13, R15, R23, R25, R27, R28)
    get-notification-summary.ts              conteo + aviso más reciente (R13, R22, R37)
    mark-notification-read.ts                (R14, R16, R31)
    mark-all-notifications-read.ts          (R32)
    purge-expired-notifications.ts          (R17)
    retention.ts                             RETENTION_DAYS = 90, cutoff(now)
    actor.ts                                 NOTIFICATIONS_READ_PERMISSION, requirePermission
    errors.ts
  ports/
    notification-channel.ts                  NotificationChannel (el puerto único de canal)
    notification-inbox.ts                    la bandeja (persistencia)
    notifications-switch.ts                  isOn(companyId): añadido activo
    recipient-directory.ts                   el usuario destinatario es de esa empresa
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
| `title`, `body`, `link_label` | `text` NOT NULL | Texto ya resuelto por el catálogo al crear: cambiar un texto del catálogo no reescribe el historial (máx. 90 días) |
| `target_kind` | `text` NULL | Destino abstracto (§4.3), nunca una URL |
| `target_params` | `jsonb` NULL | Parámetros del destino (p. ej. `{ "supplierId": "…" }`) |
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
2. `db/migrations/<ts>_notifications_addon/`, **de datos**:
   - permiso `notificaciones.consultar` (módulo `notificaciones`, acción `consultar`);
   - `role_permissions` para Administrador, Operador, Empacador y Acondicionamiento, resueltos
     por nombre (R21);
   - fila `notificaciones` en `addons`;
   - si se confirma la pregunta abierta 5, una excepción `enabled = true` por cada empresa
     existente.

   Todo idempotente con `ON CONFLICT DO NOTHING`, como
   `20261009120200_delivery_void_permission`. El `down.sql` borra exactamente esas filas.
3. `db/migrations/<ts>_document_batches_supplier/`: `ALTER TABLE document_batches ADD COLUMN
   supplier_id uuid NULL` (§6.3, pregunta abierta 9), sin FK porque es otro módulo. El `down.sql`
   quita la columna.

### 3.3 Por qué el rol se guarda por su nombre

`SessionUser` trae `roleName` de la **misma lectura de la base** que resuelve la sesión
(`SessionUserRecord.roleName`), no de la cookie. `roles.name` es `@unique`, así que admite una FK
con `ON UPDATE CASCADE`: renombrar un rol arrastra sus avisos. Con `role_id` habría que añadir
`roleId` a `SessionUser`, que es otro cambio en el contrato más usado de `identity`, o resolver
nombre → id en cada consulta.

**Aviso al reviewer:** `docs/architecture.md` dice que `roleName` «no autoriza nada». Aquí no
autoriza: la autorización es el permiso `notificaciones.consultar` (R15). `roleName` solo **acota**
qué avisos son del usuario (R13), igual que `companyId`.

## 4. Catálogo y motor

### 4.1 Catálogo (`domain/catalog.ts`)

```ts
type Audience<P> = { kind: 'role'; role: string } | { kind: 'user'; userIdFrom: (p: P) => string };
type CatalogEntry<P> = {
  schema: z.ZodType<P>;                    // forma del payload (R4)
  tone: (p: P) => 'success' | 'warning' | 'danger';
  title: (p: P) => string;
  body: (p: P) => string;
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
2. Llama a `switch.isOn(companyId)`. Si el añadido está apagado, termina sin escribir (R19).
3. Si el destinatario es un usuario, `recipients.belongsToCompany(userId, companyId)`. Si no
   pertenece, lo rechaza y lo registra (R12). Lo implementa `identity` (§7).
4. `inbox.insertIfAbsent(nuevoAviso)`. Devuelve `null` si `(company_id, dedupe_key)` ya existía,
   y en ese caso termina sin entregar (R3).
5. Para cada canal de `factory.channelsFor(entry.channels)`, llama a `deliver(aviso)` dentro de su
   propio `try/catch`. Un fallo se registra y se sigue con el siguiente canal (R11).
6. Un `try/catch` exterior registra cualquier otro fallo (R7).

### 4.3 Destino del aviso: abstracto en la base, ruta en el borde

`NotificationTarget` es una unión cerrada:

- `{ kind: 'formulas' }`
- `{ kind: 'supplier'; supplierId: string }`
- `{ kind: 'suppliers' }`

Se guarda en `target_kind`/`target_params`. `adapters/driving/notification-links.ts` lo
convierte en `href` con `FORMULAS_ROUTE`, `supplierDetailRoute` y `SUPPLIERS_ROUTE` de
`lib/shared/routes.ts`. Un `kind` desconocido da un aviso sin enlace, que sigue marcándose como
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
    createdBy: string | null; supplierId: string | null;
    total: number; done: number; failed: number; occurredAt: Date;
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
      payload: { recipientUserId: e.createdBy, strategy: e.strategy, supplierId: e.supplierId,
                 total: e.total, done: e.done, failed: e.failed },
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
  strategy: PdfStrategy; createdBy: string | null; supplierId: string | null;
  total: number; done: number; failed: number; pending: number;
} | null>;
```

Un solo `SELECT` con conteos agrupados por estado. No reutiliza `readBatch` porque esa función
alimenta la respuesta al cliente, y añadirle `createdBy` lo filtraría a la UI.

### 6.3 Proveedor de la tanda de catálogo (R49, pregunta abierta 9)

- `enqueueBatchSchema` gana `supplierId: z.uuid().optional()`.
- `NewBatch` y `createBatch` lo guardan en `document_batches.supplier_id`.
- `DocumentUpload` y `DocumentUploadDialog` ganan la prop opcional `supplierId`, que se pasa a
  `enqueueBatchAction`. Es el paso 2 de la regla de decisión y se anota en su fila de
  `CATALOGO.md`.
- `CatalogPdfUpload` la pasa. `FormulaPdfUpload` no cambia.

No se valida que el proveedor sea de la empresa: solo sirve para el enlace, y el detalle del
proveedor ya responde 404 con un proveedor ajeno (aislamiento de QC-44).

### 6.4 Textos del evento (R47; definitivos según la pregunta abierta 4)

| Desenlace | `tone` | `title` | `body` |
| --- | --- | --- | --- |
| `failed = 0` | `success` | Tanda de PDFs procesada | Se leyeron los {total} archivos de la tanda. (con 1: «Se leyó el archivo de la tanda.») |
| `done > 0` y `failed > 0` | `warning` | Tanda procesada con errores | Se leyeron {done} de {total} archivos. |
| `done = 0`, `total = 1` | `danger` | Falló la lectura de un archivo | No se pudo leer el archivo. Revisa el archivo y vuelve a subirlo. |
| `done = 0`, `total > 1` | `danger` | No se pudo leer ningún archivo de la tanda | Revisa los archivos y vuelve a subirlos. |

Enlace: `formula` → `{ kind: 'formulas' }`, con el texto «Ver fórmulas». `catalogo` con
proveedor → `{ kind: 'supplier', supplierId }`, con «Ver proveedor». Sin proveedor →
`{ kind: 'suppliers' }`, con «Ver proveedores».

## 7. Añadido, permiso y lo que cambia en `identity`

- `identity/domain/permissions.ts`: permiso `notificaciones.consultar`, que se añade a
  `SEED_ROLE_PERMISSIONS` de los cuatro roles de empresa (R21).
- `identity/domain/company-addons.ts`: `ADDONS` gana `'notificaciones'`;
  `ADDON_PERMISSIONS.notificaciones = ['notificaciones.consultar']`;
  `ADDON_REQUIRES.notificaciones = []` (pregunta abierta 6). El permiso efectivo ya sale de
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

- `NotificationView = { id, tone, title, body, linkLabel, href: string | null, createdAt: string (ISO), read: boolean }`.
- El resumen ya **no** trae avisos: el panel los pide por lotes. Así la consulta de cada 30 s es
  un `COUNT` y un `SELECT … LIMIT 1` por índice.
- **Marcar** es `INSERT INTO notification_reads … SELECT … FROM notifications WHERE <visibles> AND id = $id ON CONFLICT DO NOTHING`.
  Si el aviso no es visible, no inserta nada y responde `not_found`: lo mismo para uno ajeno que
  para uno inexistente (R14). **Marcar todas** es el mismo `INSERT … SELECT` sobre los no leídos,
  estén o no cargados en el panel (R32).
- Con el añadido apagado, el permiso efectivo no está, y las cuatro acciones responden
  `{ ok: false, code: 'forbidden' }` antes de tocar la bandeja (R19, R15).

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

`NotificationsProvider` se monta en el layout privado **solo si** el usuario tiene
`notificaciones.consultar` efectivo. Recibe un `NotificationFeed` y una función `fetchBatch`
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
- Con `ok: false` por sesión o permiso (`unauthorized`/`forbidden`), se para (R40). Con otro
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
  `refresh()` (R39). Si `BroadcastChannel` no existe, se usa el evento `storage` de `localStorage`
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
  `document.visibilityState`, `IntersectionObserver`) entran por **puertos inyectables**. jsdom no
  tiene varias de ellas, y los tests usan dobles.

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

### 9.6 Hora relativa (R30)

Con `Intl.DateTimeFormat('es')` y aritmética propia en `relative-time.ts`. Se pinta **en el
cliente** (`'use client'`) para que el servidor y el navegador no discrepen de hora y no haya
desajuste de hidratación. Se recalcula con cada resumen. No hace falta librería de fechas: son
cinco ramas.

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
- Clic en un aviso: `markRead(id)` (local en el acto, luego la acción) y `router.push(href)`. Si el
  marcado falla, se navega igual y el siguiente resumen corrige el conteo (R31).
- «Marcar todas»: todos los `items` cargados pasan a `read: true` y el conteo a 0 en el acto;
  luego la acción y la publicación en el bus (R32, R39).

### 10.2 Lista y carga al hacer scroll (R25–R28, R33)

- **Centinela:** `NotificationListTail` pinta un `div` de 1 px al final de la lista y lo observa
  con `new IntersectionObserver(cb, { root: <área con scroll del panel>, rootMargin: '0px 0px 120px
  0px' })`. Los 120 px son «acercarse al final»: el siguiente lote se pide antes de tocar fondo. El
  observador se crea **solo** con `tail === 'more'` y se desconecta al salir de ese estado, así que
  nunca hay dos peticiones a la vez (R25) y tras un error no se reintenta solo (R26).
- **Sin `IntersectionObserver`** (navegador antiguo): el mismo componente escucha `scroll` del área
  y compara `scrollHeight - scrollTop - clientHeight <= 120`. No añade UI. Entra por el puerto del
  §9.3, así que el test cubre las dos ramas.
- **Lista corta:** si el primer lote no llena el área, el centinela ya está a la vista y pide el
  siguiente; con `nextCursor = null` no hay nada que pedir y se pinta el final.
- **Final de la lista**, según `tail`:
  - `loading`: `role="status"`, icono de giro y «Cargando más avisos…» (estado 5);
  - `error`: `role="alert"`, «No se pudieron cargar más avisos.» y `Button` «Reintentar», que llama a
    `retryMore()` con el **mismo** cursor (estado 6, R26);
  - `end` con al menos un aviso: «No hay más avisos. Se conservan 90 días.» (estado 7, R27).
- **Primer lote** (`list.status`): `loading` → cinco `Skeleton` de fila (estado 9); `error` →
  `ErrorState` «No se pudieron cargar las notificaciones.» + «Reintentar» → `retryFirst()`
  (estado 10); `ready` sin avisos → `EmptyState` «No tienes notificaciones.» (estado 8).
- **Teclado:** el foco por tabulación recorre las filas; al llegar a la última, el área se desplaza
  y el centinela entra, como con el ratón.

### 10.3 Teléfono: panel anclado a la pantalla (R35)

Por debajo del punto de corte de teléfono (`sm`, el mismo que usa la cabecera):

- `PopoverContent` recibe `anchor` = la cabecera del layout (un `ref` al `<header>`), no la
  campana; `collisionPadding={8}`, `sideOffset={8}` y en el `Positioner`
  `w-[calc(100vw-16px)]`. Así el panel ocupa el ancho con 8 px por lado y empieza bajo la cabecera.
- Alto: `max-h-(--available-height)` sobre el panel, la variable que el `Positioner`
  de Base UI expone con el espacio libre hasta el borde de la pantalla menos el `collisionPadding`.
  El área de la lista es `flex-1 min-h-0 overflow-y-auto`: el scroll queda dentro (R35) y el
  panel nunca sale de la pantalla.
- Filas con `min-h-11` (44 px, `touchTarget`) y la hora bajo el texto, como el tablero.
- **A verificar en T16 contra la versión instalada de `@base-ui/react`:** que `Positioner` acepte
  `anchor` y `collisionPadding` y exponga `--available-height`. Si alguna falta, el plan B es
  `positionMethod="fixed"` con `inset-x-2`, `top` = alto de la cabecera + 8 px y
  `max-h-[calc(100dvh-<top>-8px)]`, mismo resultado visible. No cambia ningún requisito.
- El margen inferior de 8 px está pendiente de la pregunta abierta 10.

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
  tanda. Pregunta abierta 7.
- **A9. Guardar el rol por `role_id`.** Ver §3.3.
- **A10. Que la bandeja sea un canal más (`in_app` escribe la fila).** Un fallo del canal se
  llevaría la bandeja por delante, contra la decisión cerrada. La bandeja va antes y aparte (§5).
- **A11. Reutilizar `react-intersection-observer` (ya aprobada) o subir `ShowcaseLoadTrigger` a
  `shared`.** Ahorraría unas 15 líneas de alta y baja del observador. Se descarta porque la
  decisión cerrada pide el observador del navegador sin librería, y porque la guardia de QC-140
  (R18) fija un único importador de esa librería: usarla obligaría a reabrir una regla de otra
  ficha. Si el humano lo prefiere, es la pregunta abierta 11.
- **A12. Paginación por desplazamiento (`OFFSET`, `toOffsetLimit`/`buildPage`).** Ya existe y es
  más corta, pero un aviso nuevo que entra arriba empuja todo una posición: el lote siguiente
  repetiría el último aviso visto, y uno que vence entre lotes haría saltar otro. Rompe R28. Además
  el `OFFSET` recorre las filas saltadas en cada lote.
- **A13. Botón «Cargar más» en vez de carga automática.** Más simple de probar, pero la decisión
  cerrada pide carga automática y el tablero no lo dibuja. Tampoco se usa como respaldo sin
  `IntersectionObserver`: el respaldo es escuchar `scroll`, que no añade UI (§10.2).
- **A14. Volver a pedir la lista entera desde el principio al llegar un aviso.** Perdería la
  posición del scroll y lo ya cargado. Se mezcla arriba el primer lote (§9.2).

## 14. Dependencias

**Ninguna nueva.** Web Audio API, `BroadcastChannel`, Web Locks API, Page Visibility API,
`IntersectionObserver`, `localStorage`/`sessionStorage` e `Intl` son APIs del navegador.
`lucide-react` (`Bell`, `FileCheck`, `FileWarning`, `FileX`, `VolumeX`, `Loader2`), `sonner`,
`@base-ui/react` y `zod` ya están aprobados. `react-intersection-observer` está aprobada pero **no
se usa** (A11). Esta decisión no enmienda `docs/architecture.md`.

## 15. Lo que toca de otras fichas

- **QC-277:**
  - R2 (cinco añadidos) pasa a seis (§7);
  - se actualizan `tests/unit/identity/addons/company-addons.test.ts`,
    `tests/unit/identity/companies/set-all-company-addons.test.ts` y
    `tests/integration/identity/company-addons.int.test.ts`;
  - si existe la pantalla del Maestro que pinta un interruptor por añadido, necesita la etiqueta
    del sexto. No está en esta rama (buscado `ADDONS` en `app/`: nada).
- **QC-141:** el test de `vercel.json` (§11).
- **QC-107:** `DocumentUpload` gana `supplierId` opcional (§6.3). `run-document-job` y
  `get-batch-status` ganan un listener opcional (§6.2). Su R16 («NO emitir avisos») era una frontera
  de alcance de aquella ficha, que dejaba el aviso en manos de esta: los avisos los emite
  `notificaciones`, no la pantalla.
- **QC-140:** su guardia de `react-intersection-observer` no cambia (A11).
- **QC-75 / QC-13:** **ya no se tocan** (revisión del 2026-10-16): ni `private-nav.ts`, ni
  `AppSidebar`, ni `firstVisibleNavHref`.
- **`components/ui/popover.tsx`:** tres props opcionales en `PopoverContent` (§10.3), sin cambio
  para los usos actuales.
