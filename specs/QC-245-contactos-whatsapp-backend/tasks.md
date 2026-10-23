# QC-245 — contactos-whatsapp-backend · tasks.md

> Requisitos R1–R43 (`requirements.md`), diseño en `design.md`. `[P]` = puede ir en paralelo con las
> otras `[P]` de su tanda. Cada tarea cierra con `pnpm run typecheck`, `pnpm run lint` y
> `pnpm exec vitest related --run <archivos tocados>`; las que tocan módulos, además
> `pnpm exec vitest run guard`. Nadie corre `pnpm test`.
>
> Antes de T1: si el humano respondió alguna de P1–P13 con otra cosa que el default, se corrigen el
> requisito, el §«Contrato para la pantalla» de `design.md` y esta lista antes de empezar.

## Tanda 1 — base (sin dependencias entre sí)

- [ ] **T1 [P] Permiso `whatsapp.consultar`** (R1–R3, D1).
  - Migración de datos `20261024120000_whatsapp_read_permission` (`migration.sql` + `down.sql`),
    copia de la de QC-240 (design §2.2).
  - `permissions.ts`: entrada y `SEED_ROLE_PERMISSIONS[ROLE_ADMINISTRADOR]`.
  - `company-addons.ts`: en `ADDON_PERMISSIONS.integraciones`.
  - Tests: `whatsapp-read-permission-migration.test.ts` (estático) y `.int.test.ts`; tensar
    `permissions.test.ts`, `company-addons.test.ts`, `identity-seed.int.test.ts` y los que encuentre
    `vitest related` contando permisos.
  - **Hecho:** los tests nombrados en verde; solo el Administrador tiene el permiso en el seed y en la
    migración; aplicar dos veces no duplica; `down.sql` deja las tablas como antes.

- [ ] **T2 [P] Migración de esquema `last_read_at`** (R14, R42).
  - `schema.prisma`: `lastReadAt DateTime? @map("last_read_at") @db.Timestamptz(6)` en
    `WhatsappContact`.
  - `20261024130000_whatsapp_contacts_last_read` (`migration.sql` + `down.sql`, design §2.3).
  - Test `whatsapp-contacts-last-read-migration.int.test.ts` (patrón de
    `whatsapp-outbound-messages-migration.int.test.ts`) + entrada en `aislamiento.json`.
  - **Hecho:** down + up dejan el mismo esquema; `prisma validate` sin cambios inesperados.

- [ ] **T3 [P] `clientes`: `CustomerCatalog.findAliveIdsMatchingName`** (R10).
  - `customer-catalog.ts` (interfaz) y `customer-catalog-prisma.ts` (con `searchCondition`,
    `deletedAt: null`, ámbito, `id IN ids`); `buildCustomerCatalog` en la composición.
  - Ampliar `tests/integration/clientes/customer-catalog.int.test.ts` y tensar
    `tests/unit/clientes/customer-catalog.test.ts`.
  - **Hecho:** devuelve solo vivos, solo de los `ids` pedidos, de la empresa; «perez» casa con
    «Pérez»; un id de otra empresa no vuelve.

## Tanda 2 — dominio puro y adaptador (dependen de T2/T3)

- [ ] **T4 [P] Dominio puro** (R8, R10, R12, R25, R26, R28, R31).
  - `whatsapp-conversation.ts` (tipos del §B del contrato, `previewOf`, `attachmentOf`,
    `failureReasonOf`, `windowOf`, `customerNameOf`), `whatsapp-conversation-input.ts`.
  - `whatsapp-send-failure.ts`: exportar `sendFailureReasonOf` (antes `reasonOf`), sin cambiar textos.
  - Tests `whatsapp-conversation.test.ts`, `whatsapp-conversation-input.test.ts`; tensar
    `whatsapp-send-failure.test.ts`.
  - **Hecho:** sin imports de `ports`, `next/*`, Prisma ni `lib/shared`; los casos de §4.2 en verde;
    los tipos coinciden con el §B del contrato.

- [ ] **T5 [P] `WhatsappConversationRepository` y adaptador Prisma** (R6, R9–R12, R15–R18, R22, R23,
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

- [ ] **T6 Casos de uso de consulta** (R4–R7, R10, R11, R13, R16–R24, R27–R33).
  - `actor.ts` (`requireReadPermission`), `list-whatsapp-conversations.ts`, `get-whatsapp-chat.ts`,
    `mark-whatsapp-chat-read.ts`, `list-sendable-whatsapp-templates.ts`.
  - Doble en `whatsapp-doubles.ts`; tests `list-whatsapp-conversations.test.ts`,
    `get-whatsapp-chat.test.ts`, `mark-whatsapp-chat-read.test.ts`,
    `list-sendable-whatsapp-templates.test.ts`.
  - **Hecho:** sin permiso ningún puerto se toca (espías); leer el chat no llama a
    `advanceLastRead`; cliente dado de baja ⇒ `whatsapp_contact_not_found` / `customer_not_found`;
    chat vacío por cliente sin conversación; plantilla no enviable fuera de la lista.

## Tanda 4 — borde y cableado (depende de T6)

- [ ] **T7 Composición, contrato y Server Actions** (R34, R40, R41).
  - `lib/composition/index.ts`, `integraciones/index.ts`,
    `adapters/driving/whatsapp-conversation-actions.ts` (las cuatro acciones del §A del contrato).
  - Test `whatsapp-conversation-actions.test.ts` (éxito, `ErrorState`, copia campo a campo, logs sin
    cuerpo, número ni nombre).
  - Tensar `module-shape.test.ts` (archivos, contrato, cableado, importadores; el archivo de acciones
    exporta exactamente las cuatro).
  - **Hecho:** guardias verdes; firmas y tipos idénticos al §A/§B del contrato.

- [ ] **T8 Test de integración del flujo** (R5, R6, R14, R16, R34–R39, R43). Depende de T7.
  - `tests/integration/integraciones/whatsapp-conversations-flow.int.test.ts` sobre la composición
    real con el doble de Graph inyectado; entrada en `aislamiento.json` (`commit`, `motivo`, `desde`).
  - Casos: listado solo con vinculados a clientes activos y no leídos correctos; marcar leído ⇒ 0;
    chat paginado con ventana; plantilla no enviable y constante faltante rechazadas sin llamar al
    doble; baja del cliente (oculto, no se escribe, contactos y mensajes intactos; el número vuelve a
    escribir y queda sin cliente y fuera del listado); `whatsapp.enviar` sin `whatsapp.consultar`
    envía y no consulta, y al revés.
  - **Hecho:** los criterios de aceptación de la ficha, uno por caso, en verde contra la base de test.

## Tanda 5 — cierre

- [ ] **T9 Verificación y trazabilidad.**
  - `pnpm run typecheck`, `pnpm run lint`, `pnpm exec vitest run guard`, `vitest related` sobre todo
    el diff; `./init.sh`.
  - `progress/impl_QC-245.md` con el mapa `R<n> → test` (abajo) actualizado a los nombres reales de
    los casos.
  - **Hecho:** todo verde; ningún `R<n>` sin test.

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
