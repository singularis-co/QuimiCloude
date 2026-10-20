# Módulo `notificaciones`

Código en `lib/modules/notificaciones/`. Guarda avisos por empresa, dirigidos a un rol o a un usuario, y los entrega por canales. El motor
es `lib/modules/notificaciones/domain/notify.ts`: valida el evento contra el catálogo, descarta las empresas dadas de baja,
comprueba que el usuario destinatario es de la empresa, escribe la bandeja una sola vez por
`dedupeKey` y entrega por cada canal del evento. Nunca lanza al módulo que emite.

Leer y marcar los avisos propios no pide permiso ni añadido: el alcance (empresa, usuario, rol y
corte de 90 días) sale de la sesión del servidor (`lib/modules/notificaciones/adapters/driving/notification-actions.ts`).

## Cómo se agrega un evento

1. **Entrada en el catálogo.** Añade la clave y su `CatalogEntry` a `NOTIFICATION_CATALOG` en
   `lib/modules/notificaciones/domain/catalog.ts`: `schema` (zod) del payload, `tone`, `title`, `body`, `bodyTime`,
   `linkLabel`, `target` (`NotificationTarget`), `audience` (`{ kind: 'role', role }` con las
   constantes `ROLE_*` de `@/lib/modules/identity`, o `{ kind: 'user', userIdFrom }`) y
   `channels` (hoy `['in_app']`). Si el aviso lleva a una pantalla nueva, amplía
   `NotificationTarget` y su `href` en `lib/modules/notificaciones/adapters/driving/notification-links.ts`.
2. **Emisión desde el módulo de origen, por su puerto.** El módulo de origen no importa
   `notificaciones` (lo vigila `tests/guards/guard-notificaciones-desacople.test.ts`). Emite por un
   puerto propio, como `BatchFinishedListener` de
   `lib/modules/documentos/domain/batch-finished-listener.ts`.
3. **Solo si el módulo emite por primera vez:** declara su puerto y añade en
   `lib/composition/index.ts` el adaptador que lo ata a `notificaciones.notify({ key, companyId,
   dedupeKey, payload })`. El ejemplo es `batchFinishedDeps.listener`, que emite
   `documentos.tanda_terminada`.

No se toca `lib/modules/notificaciones/domain/notify.ts` ni `lib/modules/notificaciones/domain/channel-factory.ts`. Lo demuestra
`tests/unit/notificaciones/add-event.test.ts` › «R6: un evento nuevo en el catálogo crea su aviso
con el mismo motor y la misma factory», que registra un evento de prueba en un catálogo propio y
lo emite con el motor real. El cableado del primer emisor lo prueba
`tests/unit/composition/documentos-batch-notice.test.ts`.

## Cómo se agrega un canal

1. **Clave del canal.** Amplía la unión `ChannelKey` de `lib/modules/notificaciones/ports/notification-channel.ts` (por
   ejemplo `'email'`).
2. **Adaptador.** Crea en `lib/modules/notificaciones/adapters/driven/channels/` un `NotificationChannel` con esa `key` y un
   `deliver(notification)`, como `lib/modules/notificaciones/adapters/driven/channels/in-app-channel.ts`. Un fallo de
   `deliver` no corta los demás canales ni toca la bandeja: el motor lo registra y sigue.
3. **Registro en composición.** Añade el adaptador a `notificationChannels` en
   `lib/composition/index.ts`; `createChannelFactory` (`lib/modules/notificaciones/domain/channel-factory.ts`) lo resuelve por
   clave. Hoy solo está `in_app`, y `tests/unit/composition/notificaciones-wiring.test.ts` › «R9: el
   único canal registrado en la factory es el de la aplicación» lo fija: ese test cambia con el
   canal nuevo.
4. **Eventos que lo usan.** Añade la clave a `channels` de cada entrada del catálogo que deba
   salir por él.

No se toca `lib/modules/notificaciones/domain/notify.ts`. Lo demuestra `tests/unit/notificaciones/channel-factory.test.ts` ›
«R10: un canal ficticio registrado recibe los eventos que el catálogo le asigna, y no los demás»,
y «R11: si el ficticio lanza, los demás canales reciben el aviso y la bandeja ya estaba escrita».
