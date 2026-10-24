# impl QC-245 — contactos-whatsapp-backend

> Bitácora del implementer. Spec: `specs/QC-245-contactos-whatsapp-backend/` (R1–R63, T1–T17,
> enmienda 1 aprobada el 2026-10-23). Gate completo: `gate-completo` en CI (decisión del humano);
> por tarea se corre typecheck, lint, los tests de la tarea, integración por ruta y guardias.

## Preparación del worktree

`.env` y `.env.local` copiados de la raíz; `pnpm install --frozen-lockfile`, `prisma generate`,
`next typegen`. Sin dependencias nuevas. Línea base: typecheck 0, lint 0 errores (10 avisos ajenos).

## T1 — Permiso `whatsapp.consultar` (R1–R3)

Código en `b71376c4` (WIP), cerrado en el commit de esta entrada.

Archivos:
- `db/migrations/20261024120000_whatsapp_read_permission/{migration,down}.sql` (nuevo)
- `lib/modules/identity/domain/permissions.ts`, `lib/modules/identity/domain/company-addons.ts`
- `tests/unit/identity/schema/whatsapp-read-permission-migration.test.ts` (nuevo)
- `tests/integration/identity/whatsapp-read-permission-migration.int.test.ts` (nuevo) + `tests/integration/aislamiento.json`
- tensados: `tests/unit/identity/permissions.test.ts`, `tests/unit/identity/addons/company-addons.test.ts`,
  `tests/integration/identity/identity-seed.int.test.ts`
- fuera de la lista de archivos del spec, exigidos por la guardia de la lista de migraciones (listas
  escritas a mano de permisos o migraciones): `tests/guards/guard-identificador-de-request.test.ts`,
  `tests/unit/asignaciones/schema/order-assignments-migration.test.ts`,
  `tests/unit/navegacion/qc75-convenciones.test.ts`

Salida (informe de backend_dev, tras verificar el WIP):
- `pnpm run typecheck`: 0 errores
- `pnpm run lint`: 0 errores
- los 9 archivos de test de la tarea: 252 passed, 3 skipped
- `vitest related` sobre lo tocado: 1037 archivos, 17771 passed
- `pnpm exec vitest run guard`: 87/87

## T2 — Migración de esquema `last_read_at` (R14, R42)

Archivos:
- `db/schema.prisma` (una línea en `WhatsappContact`, tras `lastMessageAt`)
- `db/migrations/20261024130000_whatsapp_contacts_last_read/{migration,down}.sql` (nuevo)
- `tests/integration/integraciones/whatsapp-contacts-last-read-migration.int.test.ts` (nuevo) + `tests/integration/aislamiento.json`
- lista a mano de migraciones: `tests/guards/guard-identificador-de-request.test.ts` (las otras dos
  listas que tocó T1 son de permisos, no de migraciones: no cambian)

Salida (backend_dev):
- `pnpm exec prisma validate`: válido; la plantilla de test-db confirma «esquema al día» tras migrar
- `pnpm run typecheck`: 0 errores · `pnpm run lint`: 0 errores (10 avisos ajenos)
- test de la tarea: 6/6 · `vitest related` (schema + test): 1 archivo, 6 passed
- `pnpm exec vitest run guard`: 87/87 (1303 passed, 22 skipped)

## T3 — `CustomerCatalog.findAliveIdsMatchingName` (R10)

Archivos:
- `lib/modules/clientes/domain/customer-catalog.ts` (método al final)
- `lib/modules/clientes/adapters/driven/persistence/customer-catalog-prisma.ts` (`findAliveCustomerIdsMatchingName`)
- `lib/composition/index.ts` (import + una entrada en `buildCustomerCatalog`)
- tests: `tests/integration/clientes/customer-catalog.int.test.ts`, `tests/unit/clientes/customer-catalog.test.ts`,
  `tests/helpers/customer-catalog-double.ts`, `tests/unit/pedidos/order-customer-contract.test-d.ts`
  (lista exacta de claves del contrato: se amplía con la firma nueva)

Salida (backend_dev):
- `pnpm run typecheck`: 0 errores · `pnpm run lint`: 0 errores (10 avisos ajenos)
- tests de la tarea (unit + int): 2 archivos, 22 passed
- `vitest related` (interfaz, adaptador, composición, doble): 483 archivos, 8264 passed, 2 skipped
- `pnpm exec vitest run guard`: 87/87

## T4 — Dominio puro (R8, R10, R12, R25, R26, R28, R31)

Archivos:
- `lib/modules/integraciones/domain/whatsapp-conversation.ts` (nuevo: tipos del §B, `previewOf`,
  `attachmentOf`, `failureReasonOf`, `windowOf`, `customerNameOf`)
- `lib/modules/integraciones/domain/whatsapp-conversation-input.ts` (nuevo: esquemas del §3; defecto
  10 y tope 25 del listado copiados en el dominio como en `asignaciones`, con un test que los compara
  con `lib/shared/pagination`)
- `lib/modules/integraciones/domain/whatsapp-send-failure.ts` (`reasonOf` → `sendFailureReasonOf`)
- tests: `tests/unit/integraciones/whatsapp/conversations/whatsapp-conversation.test.ts`,
  `.../whatsapp-conversation-input.test.ts`; tensado `.../send/whatsapp-send-failure.test.ts`

Quedan para T13 (contrato v2): `media.mediaUrl` y `reaction.messageId` en `WhatsappChatAttachment`;
`attachmentOf` pasará a recibir el mensaje entero (necesita `reactedMessageId` de T14).

Salida:
- typecheck 0 · lint 0 errores (10 avisos ajenos)
- tests de la tarea: 3 archivos, 100 passed (corrido también por el implementer: 100/100)
- `vitest related` (3 fuentes): 483 archivos, 8456 passed, 3 skipped
- guardias: 87 archivos, 1320 passed, 22 skipped

## T5 — `WhatsappConversationRepository` y adaptador Prisma (R6, R9–R12, R15–R18, R22, R23, R39)

Archivos:
- `lib/modules/integraciones/ports/whatsapp-conversation-repository.ts` (nuevo, 7 métodos;
  `ConversationPageQuery.search` es `{ nameMatchIds, digits } | null`, para distinguir «sin búsqueda»
  de «búsqueda sin coincidencias»)
- `lib/modules/integraciones/adapters/driven/persistence/whatsapp-conversation-prisma.ts` (nuevo)
- `tests/integration/integraciones/whatsapp-conversation-prisma.int.test.ts` (nuevo, `transaccion`)
  + `tests/integration/aislamiento.json`
- tensado `tests/guards/guard-ambito-empresa-integraciones.test.ts` (puerto nuevo, SQL con empresa,
  sin hora por JS, única escritura la marca; 4 casos de sensibilidad)

Salida:
- typecheck 0 · lint 0 errores
- `whatsapp-conversation-prisma.int.test.ts`: 19/19
- `vitest related` (puerto y adaptador): 1 archivo, 19 passed
- guardias: 87 archivos, 1320 passed, 22 skipped (la de ámbito: 155/155)

Nota del implementer: una corrida mía de `vitest related` sobre las fuentes de T4, simultánea a las
de dos subagentes (36 min), dio 15 rojos sin nombre de archivo en la salida; la corrida aislada del
subagente sobre el mismo conjunto dio 0. Se trata como saturación (`docs/verification.md > Los
flakes de saturación`); la suite completa la corre `gate-completo` en CI.

## T6 — Casos de uso de consulta (R4–R7, R10, R11, R13, R17, R19–R24, R27–R33)

Archivos:
- `lib/modules/integraciones/domain/actor.ts` (`WHATSAPP_READ_PERMISSION`, `requireReadPermission`)
- nuevos en `lib/modules/integraciones/domain/`: `list-whatsapp-conversations.ts`,
  `get-whatsapp-chat.ts` (exporta `resolveChatCustomer` y `requireConversationContact`, para T15),
  `mark-whatsapp-chat-read.ts`, `list-sendable-whatsapp-templates.ts`
- `tests/unit/integraciones/whatsapp/whatsapp-doubles.ts` (doble en memoria del repositorio, catálogo
  y directorio de personas)
- tests nuevos en `tests/unit/integraciones/whatsapp/conversations/`: `list-whatsapp-conversations`,
  `get-whatsapp-chat`, `mark-whatsapp-chat-read`, `list-sendable-whatsapp-templates`

Decisiones del subagente (sin cambio de contrato): una plantilla cuyo contenido no se puede leer o
una variable sin tipo/clave queda fuera del selector (el contrato no admite `content` nulo); una fila
sin último mensaje o sin cliente vivo se descarta (el repositorio ya lo garantiza).

Salida:
- typecheck 0 · lint 0 errores (10 avisos ajenos)
- `vitest run tests/unit/integraciones/whatsapp`: 61 archivos, 1321 passed (tras un ajuste de lint al
  doble, `conversations/`: 6 archivos, 151 passed)
- guardias: 87 archivos, 1320 passed, 22 skipped

## T7 — Composición, contrato y Server Actions (R34, R40, R41)

Archivos:
- `lib/composition/index.ts` (solo el bloque de WhatsApp de `integraciones`, sin reordenar)
- `lib/modules/integraciones/index.ts` (cuatro fábricas + tipos DTO del §B)
- `lib/modules/integraciones/adapters/driving/whatsapp-conversation-actions.ts` (nuevo, las cuatro acciones del §A)
- `tests/unit/integraciones/whatsapp/conversations/whatsapp-conversation-actions.test.ts` (nuevo, 18 casos)
- tensados: `tests/unit/integraciones/module-shape.test.ts` (también recoge los archivos de T4–T6),
  `tests/unit/identity/session-once-per-request-actions.test.ts` (registra la acción),
  `tests/unit/integraciones/encryption-keys-env.test.ts` (lista cerrada de miembros de `integraciones`)

Pregunta abierta para el leader (no bloquea): `ChatTarget` aparece en línea en el §A y no en el §B,
así que el barril no lo exporta. Exportarlo sería ampliar el contrato.

Salida:
- typecheck: 1 error ajeno a T7 (el `downloadMedia` de T12 aún sin cablear; el árbol commiteado de T7 no lo tiene)
- lint 0 errores · tests de la tarea: 4 archivos, 264 passed, 1 skipped
- `vitest run tests/unit/integraciones`: 100 archivos, 2137 passed, 1 skipped
- guardias: 87 archivos, 1320 passed, 22 skipped

## T8 — Flujo de integración (R5, R6, R14, R16, R34–R39, R43)

Archivos: `tests/integration/integraciones/whatsapp-conversations-flow.int.test.ts` (nuevo, composición
real, doble de Graph por `INTEGRATIONS_E2E_DOUBLES=1` + espía, entrantes por el webhook firmado) y
`tests/integration/aislamiento.json` (entrada `commit`, `motivo`, `desde: 2026-10-23`).

Salida: 1 archivo, 9 passed, sobre su base efímera.

## T12 — Graph `downloadMedia` (R45–R47)

Archivos: `ports/whatsapp-graph-client.ts` (+ `GraphMediaDownload`, `downloadMedia`),
`adapters/driven/graph/whatsapp-graph-client-fetch.ts` (dos pasos, `https:` y host `.fbsbx.com`, tope
por `file_size`, `Content-Length` y stream, sin logs, redirecciones no seguidas),
`whatsapp-graph-client-canned.ts` (PNG 1×1), `tests/unit/integraciones/whatsapp/whatsapp-doubles.ts`,
`whatsapp-graph-client-media.test.ts` (nuevo), `whatsapp-graph-client-canned.test.ts` (ampliado);
cableado en `lib/composition/index.ts` (ver commit de T12).

Decisiones del subagente: un 5xx de la descarga del binario es `unreachable` (como pide el «Hecho» de
T12; el paso 2 del diseño decía `rejected`) — el caso de uso mapea ambos a `unavailable`, así que la
respuesta 502 es la misma. Las redirecciones no se siguen (`redirect: 'manual'` ⇒ `rejected`) para que
el token no viaje a otro host.

Salida: lint 0 errores · 4 archivos de cliente Graph, 71 passed · guardias 87 archivos, 1320 passed.

## Mapa R → test

| R | Test (caso) |
|---|---|
| R1 | `permissions.test.ts` > «el permiso whatsapp.consultar» (5 casos R1: entrada exacta, catálogo previo + la nueva, Administrador la recibe, ningún otro rol, JSDoc); `whatsapp-read-permission-migration.test.ts` > «R1: ninguna otra migracion nombra whatsapp.consultar», «R1, R2: la fila insertada es exactamente la entrada de PERMISSIONS…», «R1, R2: la asignacion va solo al Administrador…»; `identity-seed.int.test.ts` > «R1, R2: sobre la base ya sembrada salvo whatsapp.consultar…» |
| R2 | `whatsapp-read-permission-migration.int.test.ts` > «R1, R2: … el UP crea la fila del catalogo y una sola asignacion, al Administrador», «R2: aplicar el UP dos veces no falla, no duplica…», «R2: sobre una base que ya tiene el permiso…», «R2: el DOWN … deja la base exactamente como antes del UP»; `whatsapp-read-permission-migration.test.ts` > casos R2 estáticos (orden, ON CONFLICT, sin esquema, DOWN acotado) |
| R3 | `company-addons.test.ts` > «R3 — whatsapp.consultar es de integraciones…», «R3 — con integraciones apagado la sesión pierde whatsapp.consultar…» |
| R10 (catálogo) | `customer-catalog.int.test.ts` > «R10: de los ids pedidos devuelve solo los vivos de la empresa que casan por nombre», «R10: misma normalizacion que la busqueda de Clientes…», «R10: un texto sin palabras utiles no filtra por nombre…»; `customer-catalog.test.ts` > 4 casos R10 (firma del contrato, `where` con la misma `searchCondition`, texto sin palabras, ids vacíos/no uuid) |
| R14 | `whatsapp-contacts-last-read-migration.int.test.ts` > «R14: el contacto tiene una unica columna last_read_at, timestamptz(6) opcional y sin valor por defecto», «R14: un contacto nuevo nace sin marca y la marca guarda microsegundos» |
| R42 | `whatsapp-contacts-last-read-migration.int.test.ts` > «R42: existe exactamente una carpeta de la migracion, con su down.sql», «R42: el DOWN quita exactamente la columna…», «R42: ida, vuelta e ida dejan exactamente el mismo esquema», «R42 (sensibilidad): un DOWN sin el DROP COLUMN…» |

| R6, R39 (adaptador) | `whatsapp-conversation-prisma.int.test.ts` > «R6, R39 — listLinkedCustomerIds devuelve solo clientes…», «R6, R39 — listPage no devuelve contactos sin mensajes…», «R23, R39 — un cursor de otro contacto…», «R39 — findContact y findLatestContactOfCustomer…», «R39 — countUnread de un contacto de otra empresa es 0»; guardia de ámbito > bloques R39 |
| R8 | `whatsapp-conversation.test.ts` > 4 casos R8 (entero, recorte, puntos de código y emoji, nulo) |
| R9 | `whatsapp-conversation-prisma.int.test.ts` > «R9 — ordena por la hora del ultimo mensaje…», «R9 — el ultimo mensaje es el de hora mayor…» |
| R10 (dominio/adaptador) | `whatsapp-conversation-input.test.ts` > «R10: admite una búsqueda de 100 caracteres y rechaza una de 101», «R10: la búsqueda llega sin recortar…»; `whatsapp-conversation-prisma.int.test.ts` > «R10 — la busqueda devuelve los clientes por nombre O los numeros…» |
| R11 | `whatsapp-conversation-prisma.int.test.ts` > «R11 — el filtro de bloqueo…» |
| R12 | `whatsapp-conversation-input.test.ts` > casos R12 (defecto y tope 10/25, acota sin rechazar); `whatsapp-conversation-prisma.int.test.ts` > «R12 — pagina con offset y limit…» |
| R15 | `whatsapp-conversation-prisma.int.test.ts` > «R15 — sin marca cuenta todos los entrantes…», «R15 — con la marca en microsegundos…» |
| R16 | `whatsapp-conversation-prisma.int.test.ts` > «R16 — sin mensaje indicado mueve la marca…» |
| R17 | `whatsapp-conversation-prisma.int.test.ts` > «R17 — con mensaje indicado mueve la marca a su hora…» |
| R18 | `whatsapp-conversation-prisma.int.test.ts` > «R18 — la marca nunca retrocede…», «R18 — un contacto sin mensajes queda como estaba» |
| R22, R23 | `whatsapp-conversation-prisma.int.test.ts` > «R22 — devuelve del mas reciente al mas antiguo…», «R22, R23 — el cursor con varios mensajes a la misma hora…» |
| R25 | `whatsapp-conversation.test.ts` > casos R25 (medios sin `media_id`, documento, ubicación, reacción sin wamid, payload que no casa) |
| R26 | `whatsapp-conversation.test.ts` > casos R26 (por código, sin código, no numérico); `whatsapp-send-failure.test.ts` > «el código %i da el mismo texto que el envío guarda» |
| R28 | `whatsapp-conversation.test.ts` > 3 casos R28 (abierta, 24 h exactas, sin entrante) |
| R31 | `whatsapp-conversation-input.test.ts` > «R31: 30 mensajes por defecto y tope de 50», «R31: un tamaño mayor que el tope no se rechaza» |

| R4 | los cuatro tests de casos de uso > «R4: sin whatsapp.consultar / sin empresa / sin actor responde unauthorized sin validar ni tocar un puerto», «R4: una entrada inválida con permiso da invalid_input sin tocar un puerto» |
| R6 (caso de uso) | `list-whatsapp-conversations.test.ts` > «R6: contactos sin cliente, con el cliente dado de baja, sin mensajes…», «R6: si todos los clientes vinculados están dados de baja la página sale vacía…» |
| R7 | `list-whatsapp-conversations.test.ts` > «R7: cada conversación trae contacto, cliente, nombre, número internacional…»; `whatsapp-conversation.test.ts` > 2 casos R7 de `customerNameOf` |
| R10 (caso de uso) | `list-whatsapp-conversations.test.ts` > «R10: casa por nombre del cliente», «R10: casa por los dígitos del número…», «R10: el texto ""/"   " equivale a no buscar» |
| R11 (caso de uso) | `list-whatsapp-conversations.test.ts` > «R11: blocked=…» (4 casos) |
| R12 (caso de uso) | `list-whatsapp-conversations.test.ts` > «R12: pasa offset y límite de la página y calcula el total de páginas…» |
| R13 | `list-whatsapp-conversations.test.ts` > «R13: sin conexión viva da página vacía y estado nulo…», «R13: con conexión devuelve su estado…» |
| R17 (caso de uso) | `mark-whatsapp-chat-read.test.ts` > «R17, R20: con un mensaje del contacto marca hasta él…», «R17: un mensaje inexistente/de otro contacto da whatsapp_message_not_found…» |
| R19 | `mark-whatsapp-chat-read.test.ts` > «R19: un contacto inexistente/…/sin conexión viva da whatsapp_contact_not_found sin escribir» |
| R20 | `mark-whatsapp-chat-read.test.ts` > «R20: sin mensaje indicado marca hasta el último…»; `get-whatsapp-chat.test.ts` > «R20: leer el chat no mueve la marca de lectura» |
| R21 | `get-whatsapp-chat.test.ts` > «R21: un contacto … da whatsapp_contact_not_found sin leer mensajes» |
| R22, R23 (caso de uso) | `get-whatsapp-chat.test.ts` > «R22, R31: sin before trae los 30 más recientes…», «R23: indica que quedan anteriores y el cursor…», «R23: un cursor que no es un mensaje del contacto da whatsapp_message_not_found» |
| R24, R29 | `get-whatsapp-chat.test.ts` > «R24, R29: devuelve la cabecera del contacto y cada mensaje con todos sus campos» |
| R27 | `get-whatsapp-chat.test.ts` > «R27: el autor dado de baja sale con su nombre…», «R27: sin autores no consulta el directorio de personas» |
| R28 (caso de uso) | `get-whatsapp-chat.test.ts` > «R28: la ventana sale abierta…/cerrada pasadas 24 h/cerrada sin entrantes» |
| R30 | `get-whatsapp-chat.test.ts` > «R30: un cliente dado de baja, inexistente o de otra empresa da customer_not_found», «R30: con conversaciones devuelve la de último mensaje más reciente», «R30: sin conversación / sin conexión viva devuelve un chat vacío…» |
| R31 (caso de uso) | `get-whatsapp-chat.test.ts` > «R31: el tamaño de página se acota a 50» |
| R32 | `list-sendable-whatsapp-templates.test.ts` > «R32: sin conexión viva devuelve una lista vacía…», «R32: solo las enviables de la conexión…» |
| R33 | `list-sendable-whatsapp-templates.test.ts` > «R33: cada plantilla trae id, nombre, idioma, categoría, contenido y variables…» |

| R5 | `whatsapp-conversations-flow.int.test.ts` > «R5: whatsapp.enviar sin whatsapp.consultar envia pero no consulta», «R5: whatsapp.consultar sin whatsapp.enviar consulta pero no envia» |
| R6, R14, R39, R43 (flujo) | `whatsapp-conversations-flow.int.test.ts` > «R6, R14, R39, R43: el listado trae solo la conversacion con cliente vivo y mensajes, con sus no leidos», «R39: un contacto, un cliente o un mensaje de otra empresa se tratan como inexistentes» |
| R14, R16 (flujo) | `whatsapp-conversations-flow.int.test.ts` > «R14, R16, R43: marcar leido sin mensaje deja los no leidos en 0…» |
| R34 | `module-shape.test.ts` > «R34, R40: whatsapp-conversation-actions.ts exporta exactamente las cuatro consultas y ninguna accion de envio»; `whatsapp-conversations-flow.int.test.ts` > «R34, R43: el envio de texto de siempre llega al chat como saliente del usuario» |
| R35 | `whatsapp-conversations-flow.int.test.ts` > «R35: una plantilla no enviable y una constante faltante se rechazan sin escribir nada y sin llamar a Meta» |
| R36–R38 | `whatsapp-conversations-flow.int.test.ts` > «R36, R37, R38: la baja oculta la conversacion y bloquea el envio…» |
| R40 | `whatsapp-conversation-actions.test.ts` > casos R40 (exactamente cuatro, success, actor null, ErrorState por código, `unexpected`, copia campo a campo, el borde no decide) |
| R41 | `whatsapp-conversation-actions.test.ts` > «R41: la accion no lee el diagnostico ni escribe en la consola», «R41: una consulta correcta no escribe nada en el log», «R41: con el cuerpo, el numero y el nombre … ningun log los lleva» |
| R43 | `whatsapp-conversations-flow.int.test.ts` > «R43: el chat se pagina hacia atras con el cursor…» y los casos R43 de arriba; unitarios de T6 |
| R45 | `whatsapp-graph-client-media.test.ts` > «R45: primero pide los datos del medio a Graph y luego descarga el binario…», «R45: el id del medio va codificado…», «R45: el tipo es la cabecera sin parametros…», «R45: sin `Content-Length`…»; `whatsapp-graph-client-canned.test.ts` > «R45: devuelve siempre el mismo PNG de 1x1…» |
| R46 (Graph) | `whatsapp-graph-client-media.test.ts` > casos R46 (sin red, 5xx, 4xx, datos inválidos, `file_size`, `Content-Length`, stream cortado, tope exacto); canned > «R46: un tope menor que el PNG es un rechazo» |
| R47 (Graph) | `whatsapp-graph-client-media.test.ts` > «R47: el token va solo en `Authorization: Bearer`…», «R47: una redireccion no se sigue…», «R47: una URL de %s es un rechazo…», «R47: nada de la URL de Meta ni del token acaba en la consola», «R47: el resultado no lleva la URL de Meta ni el token» |

Veredicto T2/T3: verdes; sin dependencias nuevas ni preguntas abiertas.
