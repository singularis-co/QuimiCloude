# QC-245 — contactos-whatsapp-backend · tasks.md

> Requisitos R1–R63 (`requirements.md`; R44–R59 y T10–T17 son la Enmienda 1 del 2026-10-23,
> `design.md > 15`; R60–R63, de D12–D14 del mismo día, `design.md > 15.8`, se reparten en T11, T13,
> T15 y T17), diseño en `design.md`. `[P]` = puede ir en paralelo con las
> otras `[P]` de su tanda. Cada tarea cierra con `pnpm run typecheck`, `pnpm run lint` y
> `pnpm exec vitest related --run <archivos tocados>`; las que tocan módulos, además
> `pnpm exec vitest run guard`. Nadie corre `pnpm test`.
>
> Antes de T1: si el humano respondió alguna de P1–P13 con otra cosa que el default, se corrigen el
> requisito, el §«Contrato para la pantalla» de `design.md` y esta lista antes de empezar.

## Tanda 1 — base (sin dependencias entre sí)

- [x] **T1 [P] Permiso `whatsapp.consultar`** (R1–R3, D1).
  - Migración de datos `20261024120000_whatsapp_read_permission` (`migration.sql` + `down.sql`),
    copia de la de QC-240 (design §2.2).
  - `permissions.ts`: entrada y `SEED_ROLE_PERMISSIONS[ROLE_ADMINISTRADOR]`.
  - `company-addons.ts`: en `ADDON_PERMISSIONS.integraciones`.
  - Tests: `whatsapp-read-permission-migration.test.ts` (estático) y `.int.test.ts`; tensar
    `permissions.test.ts`, `company-addons.test.ts`, `identity-seed.int.test.ts` y los que encuentre
    `vitest related` contando permisos.
  - **Hecho:** los tests nombrados en verde; solo el Administrador tiene el permiso en el seed y en la
    migración; aplicar dos veces no duplica; `down.sql` deja las tablas como antes.

- [x] **T2 [P] Migración de esquema `last_read_at`** (R14, R42).
  - `schema.prisma`: `lastReadAt DateTime? @map("last_read_at") @db.Timestamptz(6)` en
    `WhatsappContact`.
  - `20261024130000_whatsapp_contacts_last_read` (`migration.sql` + `down.sql`, design §2.3).
  - Test `whatsapp-contacts-last-read-migration.int.test.ts` (patrón de
    `whatsapp-outbound-messages-migration.int.test.ts`) + entrada en `aislamiento.json`.
  - **Hecho:** down + up dejan el mismo esquema; `prisma validate` sin cambios inesperados.

- [x] **T3 [P] `clientes`: `CustomerCatalog.findAliveIdsMatchingName`** (R10).
  - `customer-catalog.ts` (interfaz) y `customer-catalog-prisma.ts` (con `searchCondition`,
    `deletedAt: null`, ámbito, `id IN ids`); `buildCustomerCatalog` en la composición.
  - Ampliar `tests/integration/clientes/customer-catalog.int.test.ts` y tensar
    `tests/unit/clientes/customer-catalog.test.ts`.
  - **Hecho:** devuelve solo vivos, solo de los `ids` pedidos, de la empresa; «perez» casa con
    «Pérez»; un id de otra empresa no vuelve.

## Tanda 2 — dominio puro y adaptador (dependen de T2/T3)

- [x] **T4 [P] Dominio puro** (R8, R10, R12, R25, R26, R28, R31).
  - `whatsapp-conversation.ts` (tipos del §B del contrato, `previewOf`, `attachmentOf`,
    `failureReasonOf`, `windowOf`, `customerNameOf`), `whatsapp-conversation-input.ts`.
  - `whatsapp-send-failure.ts`: exportar `sendFailureReasonOf` (antes `reasonOf`), sin cambiar textos.
  - Tests `whatsapp-conversation.test.ts`, `whatsapp-conversation-input.test.ts`; tensar
    `whatsapp-send-failure.test.ts`.
  - **Hecho:** sin imports de `ports`, `next/*`, Prisma ni `lib/shared`; los casos de §4.2 en verde;
    los tipos coinciden con el §B del contrato.

- [x] **T5 [P] `WhatsappConversationRepository` y adaptador Prisma** (R6, R9–R12, R15–R18, R22, R23,
  R39). Depende de T2.
  - `ports/whatsapp-conversation-repository.ts`,
    `adapters/driven/persistence/whatsapp-conversation-prisma.ts` (funciones con nombre, ámbito por
    las envolturas de `company-scope.ts`; hora y marca calculadas en SQL, design §5.2).
  - Test `whatsapp-conversation-prisma.int.test.ts` + entrada en `aislamiento.json`.
  - Tensar `guard-ambito-empresa-integraciones.test.ts` con el puerto nuevo (7 métodos) y casos de
    sensibilidad.
  - **Hecho:** fila de otra empresa u otra conexión invisible; orden y empate; búsqueda por nombre o
    dígitos; no leídos con marca nula y con microsegundos; la marca no retrocede; cursor con dos
    mensajes a la misma hora no salta ni repite; guardia verde.

## Tanda 3 — casos de uso (dependen de T1, T3–T5)

- [x] **T6 Casos de uso de consulta** (R4–R7, R10, R11, R13, R16–R24, R27–R33).
  - `actor.ts` (`requireReadPermission`), `list-whatsapp-conversations.ts`, `get-whatsapp-chat.ts`,
    `mark-whatsapp-chat-read.ts`, `list-sendable-whatsapp-templates.ts`.
  - Doble en `whatsapp-doubles.ts`; tests `list-whatsapp-conversations.test.ts`,
    `get-whatsapp-chat.test.ts`, `mark-whatsapp-chat-read.test.ts`,
    `list-sendable-whatsapp-templates.test.ts`.
  - **Hecho:** sin permiso ningún puerto se toca (espías); leer el chat no llama a
    `advanceLastRead`; cliente dado de baja ⇒ `whatsapp_contact_not_found` / `customer_not_found`;
    chat vacío por cliente sin conversación; plantilla no enviable fuera de la lista.

## Tanda 4 — borde y cableado (depende de T6)

- [x] **T7 Composición, contrato y Server Actions** (R34, R40, R41).
  - `lib/composition/index.ts`, `integraciones/index.ts`,
    `adapters/driving/whatsapp-conversation-actions.ts` (las cuatro acciones del §A del contrato).
  - Test `whatsapp-conversation-actions.test.ts` (éxito, `ErrorState`, copia campo a campo, logs sin
    cuerpo, número ni nombre).
  - Tensar `module-shape.test.ts` (archivos, contrato, cableado, importadores; el archivo de acciones
    exporta exactamente las cuatro).
  - **Hecho:** guardias verdes; firmas y tipos idénticos al §A/§B del contrato.

- [x] **T8 Test de integración del flujo** (R5, R6, R14, R16, R34–R39, R43). Depende de T7.
  - `tests/integration/integraciones/whatsapp-conversations-flow.int.test.ts` sobre la composición
    real con el doble de Graph inyectado; entrada en `aislamiento.json` (`commit`, `motivo`, `desde`).
  - Casos: listado solo con vinculados a clientes activos y no leídos correctos; marcar leído ⇒ 0;
    chat paginado con ventana; plantilla no enviable y constante faltante rechazadas sin llamar al
    doble; baja del cliente (oculto, no se escribe, contactos y mensajes intactos; el número vuelve a
    escribir y queda sin cliente y fuera del listado); `whatsapp.enviar` sin `whatsapp.consultar`
    envía y no consulta, y al revés.
  - **Hecho:** los criterios de aceptación de la ficha, uno por caso, en verde contra la base de test.

## Tanda 5 — cierre

- [x] **T9 Verificación y trazabilidad.**
  - `pnpm run typecheck`, `pnpm run lint`, `pnpm exec vitest run guard`, `vitest related` sobre todo
    el diff; `./init.sh`.
  - `progress/impl_QC-245.md` con el mapa `R<n> → test` (abajo) actualizado a los nombres reales de
    los casos.
  - **Hecho:** todo verde; ningún `R<n>` sin test.

## Enmienda 1 (2026-10-23) — archivo de medios, reacciones y contexto del chat

> Al enmendar, ninguna tarea estaba marcada como hecha (T1 a medias, sin commit): **ninguna tarea
> hecha cambia de comportamiento**. T10–T17 van después de las existentes. T13, T14 y T16 modifican
> lo que producen T4, T5 y T7: si al llegar a ellas esas tareas aún no están cerradas, se pueden
> hacer en el mismo commit, pero cada tarea se marca por separado. T9 se repite al final como T17.

### Tanda 6 — servicios de otros módulos y Graph (sin dependencias entre sí)

- [x] **T10 [P] `identity`: `getCompanyName`** (R56; design §15.5).
  - `domain/get-company-name.ts`, `ports/company-name-reader.ts`,
    `adapters/driven/persistence/company-name-prisma.ts`, barril, composición
    (`identity.getCompanyName`).
  - Tests `tests/unit/identity/get-company-name.test.ts` y
    `tests/integration/identity/company-name-read.int.test.ts` (+ `aislamiento.json`).
  - **Hecho:** devuelve el nombre de la empresa viva; dada de baja o inexistente ⇒ `null`; patrón
    idéntico a `getCompanyCountry`.

- [x] **T11 [P] `pedidos`: `CustomerOrderDirectory`** (R51, R54, D12; design §15.4, §15.8).
  - `domain/customer-order-directory.ts`, `adapters/driven/persistence/customer-order-directory-prisma.ts`
    (archivo nuevo, no `order-catalog-prisma.ts`), barril (+ `ORDER_STATUSES_NOT_IN_PROGRESS`),
    composición.
  - Tests `tests/integration/pedidos/customer-order-directory.int.test.ts` (+ `aislamiento.json`);
    tensar `tests/unit/pedidos/module-contract.test.ts`.
  - **Hecho:** solo vivos de ese cliente y empresa; con `ORDER_STATUSES_NOT_IN_PROGRESS` no vuelve
    ningún entregado ni cancelado; orden `created_at` DESC, `id` DESC; respeta `limit`; un cliente de
    otra empresa da `[]`. `OrderCatalog` sin cambios.

- [x] **T12 [P] Graph: `downloadMedia`** (R45–R47; design §15.1).
  - `ports/whatsapp-graph-client.ts` (+ `GraphMediaDownload`), `whatsapp-graph-client-fetch.ts`
    (dos pasos, host `.fbsbx.com`, tope por `file_size`, `Content-Length` y stream),
    `whatsapp-graph-client-canned.ts` (PNG fijo).
  - Tests `tests/unit/integraciones/whatsapp/whatsapp-graph-client-media.test.ts`; ampliar
    `whatsapp-graph-client-canned.test.ts`.
  - **Hecho:** el token va solo en `Authorization` y nunca a un host que no sea de Meta; 5xx/red ⇒
    `unreachable`, 4xx ⇒ `rejected`; más de `maxBytes` ⇒ `rejected` sin descargar o con el stream
    cortado; nada de la URL ni del token en logs.

### Tanda 7 — dominio y adaptador (dependen de T4 y T5)

- [x] **T13 Dominio puro de la enmienda** (R25, R48, R49, R52, R53, R55, R56, R60–R62). Depende de T4.
  - `domain/whatsapp-media.ts` (constantes, `mediaUrlOf`, `mediaIdOf`, `isViewableMedia`).
  - `domain/whatsapp-conversation.ts`: `attachmentOf` con `mediaUrl` y reacción por
    `reactedMessageId`; tipos del §B v2.
  - `domain/whatsapp-chat-context.ts` (`WHATSAPP_SYSTEM_CONSTANT_KEYS` con las siete claves,
    `CUSTOMER_ORDER_STAGE`, `customerDateOf`, `orderDetailTextOf`, `customerOrderOf`,
    `contextValuesOf`, tipos; design §15.8), `whatsapp-conversation-input.ts` (+ `CUSTOMER_ORDERS_LIMIT`,
    `getWhatsappChatContextSchema`, `getWhatsappMediaSchema`), `errors.ts`
    (+ `WhatsappOrderNotFoundError`).
  - Tests `whatsapp-media.test.ts`, `whatsapp-chat-context.test.ts`; ampliar
    `whatsapp-conversation.test.ts` y `whatsapp-conversation-input.test.ts`.
  - **Hecho:** sin imports prohibidos en `domain/`; `media_id` y `wamid` no salen en ningún tipo;
    envases iguales a `orderedPackages`/`remainingPackages`; valores nulos, nunca `''` ni ausentes;
    sin pedido elegido, las cinco `pedido.*` nulas; los diez estados con una de las cuatro
    etiquetas, leídas solo de `CUSTOMER_ORDER_STAGE` (ningún otro texto de estado en el código, D15); fecha `DD/MM/AAAA` del día UTC; `pedido.detalle` con «falta» en singular, «presentación
    sin nombre», `null` sin líneas y sin `\n` ni `\t`; tipos idénticos al §B v2 del contrato.

- [x] **T14 Adaptador de conversaciones** (R44, R49, R57). Depende de T5 y T13.
  - `ports/whatsapp-conversation-repository.ts`: `ChatMessageRow.reactedMessageId`,
    `findMediaMessage` (8 métodos). `whatsapp-conversation-prisma.ts`: `LEFT JOIN` de la reacción
    (§15.2) y `findMediaMessage` con ámbito.
  - Ampliar `whatsapp-conversation-prisma.int.test.ts`; tensar
    `guard-ambito-empresa-integraciones.test.ts` (8 métodos); doble en `whatsapp-doubles.ts`.
  - **Hecho:** reacción a un mensaje del contacto ⇒ su id; a uno de otro contacto o inexistente ⇒
    `null`; `findMediaMessage` de otra empresa u otra conexión ⇒ `null`; guardia verde.

### Tanda 8 — casos de uso (dependen de T6 y T10–T14)

- [x] **T15 Casos de uso `getWhatsappMedia` y `getWhatsappChatContext`** (R44–R46, R50–R57, R63).
  - `domain/get-whatsapp-media.ts`, `domain/get-whatsapp-chat-context.ts`; `resolveChatCustomer`
    compartido con `get-whatsapp-chat.ts` (sin cambiar su comportamiento: los tests de T6 siguen
    verdes sin tocarlos).
  - Tests `get-whatsapp-media.test.ts`, `get-whatsapp-chat-context.test.ts`.
  - **Hecho:** sin permiso ningún puerto se toca; cada rama de «no encontrado» del archivo no llama a
    Graph; token ilegible o Graph fallido ⇒ `unavailable`; `orderId` ajeno, entregado o cancelado ⇒
    `order_not_found`; el directorio se llama con `ORDER_STATUSES_NOT_IN_PROGRESS`; sin pedidos
    abiertos ⇒ `selectedOrderId: null` y todas las `pedido.*` nulas; actor con `whatsapp.consultar`
    y sin permisos de Pedidos recibe pedidos y valores; el contexto no llama a ningún método que
    escriba (espías); tres lecturas por lote para los pedidos.

### Tanda 9 — borde y cableado (depende de T7 y T15)

- [x] **T16 Composición, acción y ruta** (R47, R58).
  - `lib/composition/index.ts` (§15.6), `integraciones/index.ts`,
    `whatsapp-conversation-actions.ts` (+ `getWhatsappChatContextAction`: cinco acciones),
    `adapters/driving/whatsapp-media-route.ts`,
    `app/api/integraciones/whatsapp/media/[mensajeId]/route.ts`.
  - Test `whatsapp-media-route.test.ts` (estados, cabeceras, sin cuerpo en 404/502, logs); ampliar
    `whatsapp-conversation-actions.test.ts`.
  - Tensar `module-shape.test.ts`, `guard-rutas-fuera-de-sesion.test.ts` (la ruta, `anadido:
    'integraciones'`), `session-once-per-request-actions.test.ts` (la acción y el `GET`; si T7 no
    registró `whatsapp-conversation-actions.ts`, se registra aquí).
  - **Hecho:** guardias verdes; firmas y tipos idénticos al §A/§B v2 del contrato; la respuesta 200
    lleva `Cache-Control: private, max-age=3600` y `X-Content-Type-Options: nosniff`.

- [ ] **T17 Integración del flujo y cierre de la enmienda** (R44, R45, R49, R51–R57, R59–R63).
  Depende de T8 y T16.
  - `tests/integration/integraciones/whatsapp-chat-context-flow.int.test.ts` sobre la composición
    real con Graph doble (+ `aislamiento.json`): imagen entrante servida; otra empresa, cliente dado
    de baja y audio ⇒ 404; reacción casada con su mensaje; contexto con pedidos, envases, número y
    las siete constantes; un pedido entregado y uno cancelado fuera de `orders`; cliente con solo
    pedidos cerrados ⇒ `orders: []` y `pedido.*` nulas; `orderId` ajeno rechazado; marca de lectura
    intacta tras pedir el contexto.
  - Repetir T9 sobre todo el diff y actualizar el mapa `R<n> → test` de `progress/impl_QC-245.md`
    con R44–R63.
  - **Hecho:** todo verde; ningún R44–R63 sin test. El leader republica el §«Contrato para la
    pantalla» en QC-246, cuya ficha ya incluye el catálogo de constantes del front (D17, design §11).

## Mapa R → test (previsto)

| R | Test |
|---|---|
| R1 | `whatsapp-read-permission-migration.test.ts`, `permissions.test.ts` |
| R2 | `whatsapp-read-permission-migration.int.test.ts` |
| R3 | `company-addons.test.ts` |
| R4 | `list-whatsapp-conversations.test.ts`, `get-whatsapp-chat.test.ts`, `mark-whatsapp-chat-read.test.ts`, `list-sendable-whatsapp-templates.test.ts` |
| R5 | `whatsapp-conversations-flow.int.test.ts` |
| R6 | `list-whatsapp-conversations.test.ts`, `whatsapp-conversation-prisma.int.test.ts`, `whatsapp-conversations-flow.int.test.ts` |
| R7 | `list-whatsapp-conversations.test.ts` |
| R8 | `whatsapp-conversation.test.ts` |
| R9 | `whatsapp-conversation-prisma.int.test.ts` |
| R10 | `whatsapp-conversation-input.test.ts`, `list-whatsapp-conversations.test.ts`, `whatsapp-conversation-prisma.int.test.ts`, `customer-catalog.int.test.ts` |
| R11 | `list-whatsapp-conversations.test.ts`, `whatsapp-conversation-prisma.int.test.ts` |
| R12 | `whatsapp-conversation-input.test.ts`, `whatsapp-conversation-prisma.int.test.ts` |
| R13 | `list-whatsapp-conversations.test.ts` |
| R14 | `whatsapp-contacts-last-read-migration.int.test.ts`, `whatsapp-conversations-flow.int.test.ts` |
| R15 | `whatsapp-conversation-prisma.int.test.ts` |
| R16 | `whatsapp-conversation-prisma.int.test.ts`, `whatsapp-conversations-flow.int.test.ts` |
| R17 | `mark-whatsapp-chat-read.test.ts`, `whatsapp-conversation-prisma.int.test.ts` |
| R18 | `whatsapp-conversation-prisma.int.test.ts` |
| R19, R20 | `mark-whatsapp-chat-read.test.ts`; R20 también en `get-whatsapp-chat.test.ts` |
| R21 | `get-whatsapp-chat.test.ts` |
| R22, R23 | `get-whatsapp-chat.test.ts`, `whatsapp-conversation-prisma.int.test.ts` |
| R24 | `get-whatsapp-chat.test.ts` |
| R25, R26 | `whatsapp-conversation.test.ts` |
| R27 | `get-whatsapp-chat.test.ts` |
| R28 | `whatsapp-conversation.test.ts`, `get-whatsapp-chat.test.ts` |
| R29–R31 | `get-whatsapp-chat.test.ts`; R31 también en `whatsapp-conversation-input.test.ts` |
| R32, R33 | `list-sendable-whatsapp-templates.test.ts` |
| R34 | `module-shape.test.ts`, `whatsapp-conversations-flow.int.test.ts` |
| R35–R38 | `whatsapp-conversations-flow.int.test.ts` |
| R39 | `whatsapp-conversation-prisma.int.test.ts`, `whatsapp-conversations-flow.int.test.ts` |
| R40, R41 | `whatsapp-conversation-actions.test.ts` |
| R42 | `whatsapp-contacts-last-read-migration.int.test.ts` |
| R43 | `whatsapp-conversations-flow.int.test.ts` (y los unitarios de T6) |
| R44 | `get-whatsapp-media.test.ts`, `whatsapp-media-route.test.ts`, `whatsapp-conversation-prisma.int.test.ts`, `whatsapp-chat-context-flow.int.test.ts` |
| R45 | `get-whatsapp-media.test.ts`, `whatsapp-graph-client-media.test.ts`, `whatsapp-chat-context-flow.int.test.ts` |
| R46 | `get-whatsapp-media.test.ts`, `whatsapp-graph-client-media.test.ts`, `whatsapp-media-route.test.ts` |
| R47 | `whatsapp-media-route.test.ts`, `whatsapp-graph-client-media.test.ts` |
| R48 | `whatsapp-media.test.ts`, `whatsapp-conversation.test.ts` |
| R49 | `whatsapp-conversation.test.ts`, `whatsapp-conversation-prisma.int.test.ts`, `whatsapp-chat-context-flow.int.test.ts` |
| R50 | `get-whatsapp-chat-context.test.ts` |
| R51 | `get-whatsapp-chat-context.test.ts`, `customer-order-directory.int.test.ts` (sin entregados ni cancelados), `whatsapp-chat-context-flow.int.test.ts` |
| R52, R53 | `whatsapp-chat-context.test.ts`, `whatsapp-chat-context-flow.int.test.ts` |
| R54 | `get-whatsapp-chat-context.test.ts`, `customer-order-directory.int.test.ts`, `whatsapp-chat-context-flow.int.test.ts` |
| R55, R56 | `whatsapp-chat-context.test.ts`, `get-company-name.test.ts`, `company-name-read.int.test.ts`, `whatsapp-chat-context-flow.int.test.ts` |
| R57 | `get-whatsapp-chat-context.test.ts`, `whatsapp-chat-context-flow.int.test.ts` |
| R58 | `whatsapp-conversation-actions.test.ts`, `whatsapp-media-route.test.ts`, `module-shape.test.ts` |
| R59 | `whatsapp-chat-context-flow.int.test.ts` (y los unitarios de T12–T15) |
| R60–R62 | `whatsapp-chat-context.test.ts`, `whatsapp-chat-context-flow.int.test.ts` |
| R63 | `get-whatsapp-chat-context.test.ts`, `whatsapp-chat-context-flow.int.test.ts` |

## Archivos esperados

- `db/schema.prisma`
- `db/migrations/20261024120000_whatsapp_read_permission/migration.sql`
- `db/migrations/20261024120000_whatsapp_read_permission/down.sql`
- `db/migrations/20261024130000_whatsapp_contacts_last_read/migration.sql`
- `db/migrations/20261024130000_whatsapp_contacts_last_read/down.sql`
- `lib/modules/identity/domain/permissions.ts`
- `lib/modules/identity/domain/company-addons.ts`
- `lib/modules/clientes/domain/customer-catalog.ts`
- `lib/modules/clientes/adapters/driven/persistence/customer-catalog-prisma.ts`
- `lib/modules/integraciones/index.ts`
- `lib/modules/integraciones/domain/actor.ts`
- `lib/modules/integraciones/domain/whatsapp-send-failure.ts`
- `lib/modules/integraciones/domain/whatsapp-conversation.ts`
- `lib/modules/integraciones/domain/whatsapp-conversation-input.ts`
- `lib/modules/integraciones/domain/list-whatsapp-conversations.ts`
- `lib/modules/integraciones/domain/get-whatsapp-chat.ts`
- `lib/modules/integraciones/domain/mark-whatsapp-chat-read.ts`
- `lib/modules/integraciones/domain/list-sendable-whatsapp-templates.ts`
- `lib/modules/integraciones/ports/whatsapp-conversation-repository.ts`
- `lib/modules/integraciones/adapters/driven/persistence/whatsapp-conversation-prisma.ts`
- `lib/modules/integraciones/adapters/driving/whatsapp-conversation-actions.ts`
- `lib/composition/index.ts`
- `tests/unit/identity/schema/whatsapp-read-permission-migration.test.ts`
- `tests/integration/identity/whatsapp-read-permission-migration.int.test.ts`
- `tests/unit/identity/permissions.test.ts`
- `tests/unit/identity/addons/company-addons.test.ts`
- `tests/integration/identity/identity-seed.int.test.ts`
- `tests/unit/clientes/customer-catalog.test.ts`
- `tests/integration/clientes/customer-catalog.int.test.ts`
- `tests/unit/integraciones/whatsapp/send/whatsapp-send-failure.test.ts`
- `tests/unit/integraciones/whatsapp/conversations/whatsapp-conversation.test.ts`
- `tests/unit/integraciones/whatsapp/conversations/whatsapp-conversation-input.test.ts`
- `tests/unit/integraciones/whatsapp/conversations/list-whatsapp-conversations.test.ts`
- `tests/unit/integraciones/whatsapp/conversations/get-whatsapp-chat.test.ts`
- `tests/unit/integraciones/whatsapp/conversations/mark-whatsapp-chat-read.test.ts`
- `tests/unit/integraciones/whatsapp/conversations/list-sendable-whatsapp-templates.test.ts`
- `tests/unit/integraciones/whatsapp/conversations/whatsapp-conversation-actions.test.ts`
- `tests/unit/integraciones/whatsapp/whatsapp-doubles.ts`
- `tests/unit/integraciones/module-shape.test.ts`
- `tests/guards/guard-ambito-empresa-integraciones.test.ts`
- `tests/integration/integraciones/whatsapp-conversation-prisma.int.test.ts`
- `tests/integration/integraciones/whatsapp-contacts-last-read-migration.int.test.ts`
- `tests/integration/integraciones/whatsapp-conversations-flow.int.test.ts`
- `tests/integration/aislamiento.json`
- `progress/impl_QC-245.md`
- `app/api/integraciones/whatsapp/media/[mensajeId]/route.ts`
- `lib/modules/identity/index.ts`
- `lib/modules/identity/domain/get-company-name.ts`
- `lib/modules/identity/ports/company-name-reader.ts`
- `lib/modules/identity/adapters/driven/persistence/company-name-prisma.ts`
- `lib/modules/pedidos/index.ts`
- `lib/modules/pedidos/domain/customer-order-directory.ts`
- `lib/modules/pedidos/adapters/driven/persistence/customer-order-directory-prisma.ts`
- `lib/modules/integraciones/domain/errors.ts`
- `lib/modules/integraciones/domain/whatsapp-media.ts`
- `lib/modules/integraciones/domain/get-whatsapp-media.ts`
- `lib/modules/integraciones/domain/whatsapp-chat-context.ts`
- `lib/modules/integraciones/domain/get-whatsapp-chat-context.ts`
- `lib/modules/integraciones/ports/whatsapp-graph-client.ts`
- `lib/modules/integraciones/ports/company-name-lookup.ts`
- `lib/modules/integraciones/adapters/driven/graph/whatsapp-graph-client-fetch.ts`
- `lib/modules/integraciones/adapters/driven/graph/whatsapp-graph-client-canned.ts`
- `lib/modules/integraciones/adapters/driving/whatsapp-media-route.ts`
- `tests/unit/identity/get-company-name.test.ts`
- `tests/integration/identity/company-name-read.int.test.ts`
- `tests/unit/identity/session-once-per-request-actions.test.ts`
- `tests/unit/pedidos/module-contract.test.ts`
- `tests/integration/pedidos/customer-order-directory.int.test.ts`
- `tests/unit/integraciones/whatsapp/whatsapp-graph-client-media.test.ts`
- `tests/unit/integraciones/whatsapp/whatsapp-graph-client-canned.test.ts`
- `tests/unit/integraciones/whatsapp/conversations/whatsapp-media.test.ts`
- `tests/unit/integraciones/whatsapp/conversations/whatsapp-chat-context.test.ts`
- `tests/unit/integraciones/whatsapp/conversations/get-whatsapp-media.test.ts`
- `tests/unit/integraciones/whatsapp/conversations/get-whatsapp-chat-context.test.ts`
- `tests/unit/integraciones/whatsapp/conversations/whatsapp-media-route.test.ts`
- `tests/guards/guard-rutas-fuera-de-sesion.test.ts`
- `tests/integration/integraciones/whatsapp-chat-context-flow.int.test.ts`
