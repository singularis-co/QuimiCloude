# QC-238 — recepcion-webhook-whatsapp · tasks.md

> Orden por dependencias. `[P]` = puede ir en paralelo con las otras `[P]` de su bloque una vez
> cumplidas sus dependencias. Cada task cierra con `pnpm run typecheck`, `pnpm run lint` y
> `pnpm exec vitest related --run <archivos tocados>` en verde, y un commit
> `feat(QC-238): …` / `test(QC-238): …`. Nada de comentarios con `QC-<n>`, `R<n>` ni `design.md`
> en producción; en tests, `R<n>` va en el nombre del caso.
>
> Antes de T1: contrastar las formas de §4.3 de `design.md` con la documentación vigente de la
> Cloud API de WhatsApp (webhooks `messages`), y anotar en `progress/impl_QC-238.md` la versión
> consultada y cualquier diferencia. Si hay una que cambie un requisito, se para y se pregunta.

## Bloque A — Base

- [ ] **T1 — Esquema y migración** (R28, R29, R30). Depende de: —
  - `db/schema.prisma`: 4 enums y los modelos `WhatsappContact` y `WhatsappMessage` de §2.1, cada
    uno con `/// @module integraciones`, al final del bloque de `integraciones`.
  - `db/migrations/20261019140000_whatsapp_contacts_and_messages/migration.sql` y `down.sql`
    escritos a mano en el orden de §2.2 (FK compuestas, RLS activada y forzada al final).
  - **Hecho:** la migración se aplica sobre la base de test; `down.sql` la revierte y se vuelve a
    aplicar; `pnpm exec prisma validate` y `generate` en verde; `guard-empresa-en-esquema` y
    `guard-rls-force` en verde.

## Bloque B — Dominio y adaptadores sin base (tras T1)

- [ ] **T2 [P] — Tipos y orden de statuses** (R17, R21). Depende de: T1
  - `domain/whatsapp-message.ts` (constantes de dirección, tipo, estado, origen) y
    `domain/whatsapp-message-status.ts` (`STATUS_PREDECESSORS`, §4.4).
  - Test `tests/unit/integraciones/whatsapp/whatsapp-message-status.test.ts`: la tabla completa
    estado actual × status entrante.
  - **Hecho:** test verde; `RECEIVED` y `FAILED` no aparecen como predecesores de nada que los saque.

- [ ] **T3 [P] — Firma de Meta** (R10, R11). Depende de: —
  - `ports/webhook-signature.ts` y `adapters/driven/security/webhook-signature-hmac.ts` (§5.4).
  - Test `tests/unit/integraciones/whatsapp/webhook-signature-hmac.test.ts` con los casos de §10.1.
  - **Hecho:** test verde; `node:crypto` solo en el adaptador.

- [ ] **T4 — Lectura del cuerpo de Meta** (R14, R15, R16, R17, R19, R20, R22). Depende de: T2
  - `domain/whatsapp-inbound-message.ts` (tabla de §4.3) y `domain/whatsapp-webhook-payload.ts`
    (`parseWhatsappWebhook` → `InboundBatch`).
  - `tests/unit/integraciones/whatsapp/whatsapp-webhook-fixtures.ts` (constructores de cuerpos, sin
    datos reales) y `tests/unit/integraciones/whatsapp/whatsapp-webhook-payload.test.ts`.
  - **Hecho:** un caso por fila de la tabla de §4.3, más tipo desconocido, subtipo interactivo
    desconocido, adjunto sin `id`, cabecera rota, `field` distinto de `messages`, teléfono ajeno y
    status desconocido; reacción sin `emoji` y con `emoji` vacío; `from` ≠ `contacts[].wa_id` con un
    solo contacto; varios contactos y ninguno (manda `from`); `from` en el `payload`.

- [ ] **T5 — Puertos y repositorio de conexión** (R6). Depende de: T1
  - `ports/whatsapp-connection-repository.ts`: `lastWebhookAt` en el `patch` y
    `recordWebhookHandshake` (§5.2). `ports/whatsapp-webhook-directory.ts`,
    `ports/whatsapp-inbox-repository.ts`, `ports/integrations-switch.ts`.
  - `adapters/driven/persistence/whatsapp-connection-prisma.ts`: `recordWhatsappWebhookHandshake`
    (dos `updateMany` condicionados) y `lastWebhookAt` en `updateLiveWhatsappConnection`.
  - `tests/unit/integraciones/whatsapp/whatsapp-doubles.ts`: el doble gana el método y aplica
    `lastWebhookAt`.
  - **Hecho:** los tests de QC-237 que usan el doble siguen verdes sin cambiar sus casos.

## Bloque C — Persistencia (tras T1, T2, T5)

- [ ] **T6 [P] — Resolutor de empresa** (R32). Depende de: T5
  - `adapters/driven/persistence/whatsapp-webhook-directory-prisma.ts` con la función única de §5.1.
  - **Hecho:** compila; lo prueban T12 (forma) y T15 (comportamiento).

- [ ] **T7 [P] — Guardado del lote** (R16, R17, R18, R21, R22, R23, R24, R25, R2). Depende de: T2, T5
  - `adapters/driven/persistence/company-scope.ts`: `whatsappContactCompanyScope` y
    `whatsappMessageCompanyScope`.
  - `adapters/driven/persistence/whatsapp-inbox-prisma.ts`: `recordWhatsappInbound` con los cuatro
    pasos de §5.3 en una transacción.
  - `tests/integration/integraciones/whatsapp-inbox-prisma.int.test.ts` y su entrada en
    `tests/integration/aislamiento.json`.
  - **Hecho:** los casos de §10.1 para este archivo en verde, incluido el de dos `record`
    concurrentes del mismo número.

## Bloque D — Casos de uso (tras B y C)

- [ ] **T8 — Conexión de la URL y handshake** (R2, R3, R4, R5, R6, R7). Depende de: T5
  - `domain/webhook-connection.ts` (`resolveWebhookConnection`, §4.1) y
    `domain/verify-whatsapp-webhook.ts` (§4.2).
  - `tests/unit/integraciones/whatsapp/verify-whatsapp-webhook.test.ts`.
  - **Hecho:** cada causa de `forbidden` probada sin `recordWebhookHandshake`; un id sin forma de
    UUID no llama a ningún puerto; el ámbito pasado a `findLiveById` es el que devolvió `directory`.

- [ ] **T9 — Recepción** (R4, R9, R10, R11, R12, R13, R23, R26). Depende de: T3, T4, T8
  - `domain/receive-whatsapp-webhook.ts` (§4.2).
  - `tests/unit/integraciones/whatsapp/receive-whatsapp-webhook.test.ts`.
  - **Hecho:** el orden «resolver → descifrar → firma → parsear → guardar» queda fijado por
    espías; con firma mala no se parsea; `SecretUnreadableError` deja `ERROR` y devuelve
    `secret_unreadable`; una excepción del `inbox` se propaga.

## Bloque E — Cableado y borde (tras D)

- [ ] **T10 — Contrato y composición**. Depende de: T3, T6, T7, T8, T9
  - `lib/modules/integraciones/index.ts`: las dos fábricas.
  - `lib/composition/index.ts`: el bloque de §6, sin reordenar nada.
  - **Hecho:** `typecheck` verde; importar la composición no lee ninguna variable de entorno (el
    test de QC-234/QC-237 que lo vigila sigue verde).

- [ ] **T11 — Route handler** (R1, R8, R27). Depende de: T10
  - `lib/modules/integraciones/adapters/driving/whatsapp-webhook-route.ts` (§3.2).
  - `app/api/integraciones/whatsapp/webhook/[conexionId]/route.ts` (§3.1).
  - `tests/unit/integraciones/whatsapp/whatsapp-webhook-route.test.ts`.
  - **Hecho:** cada resultado traducido a su código; `text/plain` y cuerpo exacto del challenge;
    solo `hub_*` ⇒ `403`; logs espiados sin datos sensibles; `decideRouteAccess` deja pasar la ruta
    sin sesión.

## Bloque F — Guardias y tests de forma (tras E)

- [ ] **T12 [P] — Guardias** (R2, R31, R32). Depende de: T6, T7, T10, T11
  - `tests/guards/guard-rutas-fuera-de-sesion.test.ts`: la ruta nueva como añadido
    `integraciones`, con la prueba de T9; el ancla anti-vacuidad la incluye.
  - `tests/guards/guard-ambito-empresa-integraciones.test.ts`: 5 métodos en el puerto de conexión,
    el puerto `WhatsappInboxRepository`, 4 envolturas, la exención única de §5.1 con su forma
    vigilada y sus casos de sensibilidad (segundo campo en el `select`, segunda función, otro nombre
    de archivo).
  - **Hecho:** `pnpm exec vitest run guard` en verde, y cada caso de sensibilidad nuevo falla si se
    quita la regla que prueba.

- [ ] **T13 [P] — Forma del módulo**. Depende de: T10, T11
  - `tests/unit/integraciones/module-shape.test.ts`: R13 (cinco modelos), R18 (archivos), R19
    (importadores y cableado), R20 (contrato), según §10.2.
  - **Hecho:** verde, con las listas exactas (sin `toContain` donde hoy hay `toEqual`).

## Bloque G — Integración contra la base (tras E)

- [ ] **T14 — Recorrido real de la ruta** (R4, R5, R6, R7, R9, R11, R12, R16, R17, R18, R20, R21,
  R23, R24, R25). Depende de: T11
  - `tests/integration/integraciones/whatsapp-webhook-route.int.test.ts` (§8 y §10.1), con
    empresa efímera, añadido `integraciones` prendido (y apagado en su caso), conexión sembrada
    con App Secret cifrado y verify token resumido, firma calculada en el test.
  - Entrada en `tests/integration/aislamiento.json` (`commit`, con `motivo` y `desde`).
  - **Hecho:** verde contra la base de test; el caso de la transacción que falla deja cero filas y
    el reintento deja una.

- [ ] **T15 [P] — Restricciones y migración** (R28, R29, R30, R32). Depende de: T1, T6
  - `tests/integration/integraciones/whatsapp-messages-constraints.int.test.ts` y
    `tests/integration/integraciones/whatsapp-messages-migration.int.test.ts`, con sus entradas en
    `tests/integration/aislamiento.json`.
  - **Hecho:** verde contra la base de test.

## Bloque H — Cierre

- [ ] **T16 — Verificación manual con Meta (fuera del gate)**. Depende de: T14
  - Con cloudflared apuntando al servidor local: en la app de Meta, «Verificar y guardar» la URL
    del webhook con el verify token; suscribir el campo `messages`; mandar un texto y una imagen
    desde un teléfono.
  - **Hecho:** en `progress/impl_QC-238.md`, sin números ni textos reales: el `GET` respondió
    `200`, la conexión quedó `ACTIVE` con `lastWebhookAt`, y hay dos filas `IN` (`TEXT`, `IMAGE`)
    con su contacto. Si no se puede hacer (sin app de Meta a mano), se anota y lo hace el humano
    antes del merge a producción.

- [ ] **T17 — Trazabilidad y gate local**. Depende de: T1–T15
  - `progress/impl_QC-238.md` con el mapa `R1`…`R33` → test concreto.
  - `./init.sh` en verde.
  - **Hecho:** ningún `R<n>` sin test; las guardias en verde; el diff no toca `package.json`,
    permisos, menú, `.env.example` ni el catálogo de errores (R33).

## Archivos esperados

- `db/schema.prisma`
- `db/migrations/20261019140000_whatsapp_contacts_and_messages/migration.sql`
- `db/migrations/20261019140000_whatsapp_contacts_and_messages/down.sql`
- `app/api/integraciones/whatsapp/webhook/[conexionId]/route.ts`
- `lib/modules/integraciones/index.ts`
- `lib/modules/integraciones/domain/whatsapp-message.ts`
- `lib/modules/integraciones/domain/whatsapp-message-status.ts`
- `lib/modules/integraciones/domain/whatsapp-inbound-message.ts`
- `lib/modules/integraciones/domain/whatsapp-webhook-payload.ts`
- `lib/modules/integraciones/domain/webhook-connection.ts`
- `lib/modules/integraciones/domain/verify-whatsapp-webhook.ts`
- `lib/modules/integraciones/domain/receive-whatsapp-webhook.ts`
- `lib/modules/integraciones/ports/whatsapp-connection-repository.ts`
- `lib/modules/integraciones/ports/whatsapp-webhook-directory.ts`
- `lib/modules/integraciones/ports/whatsapp-inbox-repository.ts`
- `lib/modules/integraciones/ports/webhook-signature.ts`
- `lib/modules/integraciones/ports/integrations-switch.ts`
- `lib/modules/integraciones/adapters/driven/persistence/company-scope.ts`
- `lib/modules/integraciones/adapters/driven/persistence/whatsapp-connection-prisma.ts`
- `lib/modules/integraciones/adapters/driven/persistence/whatsapp-webhook-directory-prisma.ts`
- `lib/modules/integraciones/adapters/driven/persistence/whatsapp-inbox-prisma.ts`
- `lib/modules/integraciones/adapters/driven/security/webhook-signature-hmac.ts`
- `lib/modules/integraciones/adapters/driving/whatsapp-webhook-route.ts`
- `lib/composition/index.ts`
- `tests/unit/integraciones/whatsapp/whatsapp-message-status.test.ts`
- `tests/unit/integraciones/whatsapp/webhook-signature-hmac.test.ts`
- `tests/unit/integraciones/whatsapp/whatsapp-webhook-fixtures.ts`
- `tests/unit/integraciones/whatsapp/whatsapp-webhook-payload.test.ts`
- `tests/unit/integraciones/whatsapp/whatsapp-doubles.ts`
- `tests/unit/integraciones/whatsapp/verify-whatsapp-webhook.test.ts`
- `tests/unit/integraciones/whatsapp/receive-whatsapp-webhook.test.ts`
- `tests/unit/integraciones/whatsapp/whatsapp-webhook-route.test.ts`
- `tests/unit/integraciones/module-shape.test.ts`
- `tests/guards/guard-rutas-fuera-de-sesion.test.ts`
- `tests/guards/guard-ambito-empresa-integraciones.test.ts`
- `tests/integration/integraciones/whatsapp-webhook-route.int.test.ts`
- `tests/integration/integraciones/whatsapp-inbox-prisma.int.test.ts`
- `tests/integration/integraciones/whatsapp-messages-constraints.int.test.ts`
- `tests/integration/integraciones/whatsapp-messages-migration.int.test.ts`
- `tests/integration/aislamiento.json`
- `progress/impl_QC-238.md`
