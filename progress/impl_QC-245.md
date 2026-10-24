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

Veredicto T2/T3: verdes; sin dependencias nuevas ni preguntas abiertas.
