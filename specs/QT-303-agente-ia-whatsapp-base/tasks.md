# QT-303 — agente-ia-whatsapp-base · tasks.md

> Implementa `backend_dev`. Cada tanda cierra con `pnpm run typecheck`, `pnpm run lint`,
> `pnpm exec vitest related --run <archivos tocados>` y `pnpm exec vitest run guard`.
> Las preguntas P1–P9 están cerradas (D6–D14 de `requirements.md`, 2026-10-30).

## Tanda 1 — Añadido y permisos (identity) `[P]` con la tanda 2

- [x] **T1.1** `company-addons.ts`: `agente_ia_whatsapp` en `ADDONS` (al final), `ADDON_REQUIRES`
  (`['integraciones']`) y `ADDON_PERMISSIONS` (`agente_ia.consultar`, `agente_ia.modificar`).
  *Hecho:* tests de `company-addons.test.ts` actualizados y nuevos casos verdes para R1 (catálogo),
  R2 (sin `integraciones` no es activo) y R4 (permisos quitados con el añadido apagado).
- [x] **T1.2** `permissions.ts`: las dos entradas en `PERMISSIONS` y en
  `SEED_ROLE_PERMISSIONS[ROLE_ADMINISTRADOR]` (D8). *Hecho:* `permissions.test.ts` verde con casos
  R3 y R5 (solo el Administrador las tiene).
- [x] **T1.3** Migración `20261030120100_whatsapp_agent_permissions` (`migration.sql` + `down.sql`)
  según `design.md > Migración 2`: `addons`, permisos, `role_permissions` del Administrador y
  excepción prendida de `agente_ia_whatsapp` para cada empresa con la excepción de
  `integraciones` prendida (D9).
  *Hecho:* `guard-catalogo-de-anadidos` y `guard-permisos-sembrados` verdes; test estático de la
  migración (literales = constantes, R1, R3, R5; el INSERT de excepciones filtra por
  `integraciones` prendido y usa `ON CONFLICT DO NOTHING`, R6) y test de integración que la aplica
  y la revierte con tres empresas sembradas antes (R6): A con `integraciones` prendido → queda con
  `agente_ia_whatsapp` prendido; B con `integraciones` en `false` y C sin excepción → sin
  excepción del agente; ninguna otra excepción cambia; una empresa de baja con `integraciones`
  prendido también lo recibe; aplicar dos veces no duplica; el `down.sql` quita las excepciones
  del agente y deja las demás. Además, A sigue sin configuración del agente (lectura = defaults
  con activo `false`, R8).
  Depende de T1.1, T1.2 y de que la migración de la tanda 2 tenga timestamp anterior.
- [x] **T1.4** `[P]` `addon-names.ts` y `addon-details.ts` con la entrada nueva (D10); filas de
  `CATALOGO.md` a «seis añadidos»; listas `ORDEN` de los tests del Maestro. *Hecho:* typecheck
  verde, `addon-names.test.ts` (R7: nombre, descripción e icono exactos) y tests de
  `tests/ui/maestro/` verdes.

## Tanda 2 — Esquema `[P]` con la tanda 1

- [x] **T2.1** `db/schema.prisma`: enums `WhatsappConversationMode` y
  `WhatsappConversationModeReason` (con `COMPLAINT`, `NEGATIVE_SENTIMENT`, `UNSUPPORTED_MEDIA`,
  D14), cuatro campos en `WhatsappContact`, modelo `WhatsappAgentSettings`
  (`/// @module integraciones`, con `assistantName` opcional) y `AGENT` en
  `WhatsappMessageOrigin` (D6). *Hecho:* `prisma validate` y `guard-arquitectura-modulos` /
  `guard-empresa-en-esquema` verdes.
- [x] **T2.2** Migración `20261030120000_whatsapp_agent` (`migration.sql` + `down.sql`) según
  `design.md > Migración 1`. *Hecho:* test de integración que comprueba: contactos existentes en
  `AGENT` con motivo y fecha nulos (R19), CHECK que rechaza `HUMAN` sin motivo/fecha y motivo sin
  fecha (R31), los tres motivos nuevos admitidos en `HUMAN` (R21), CHECK de rangos, mensajes y
  nombre del asistente (vacío, con espacios en los extremos, 61 caracteres → rechazo; `NULL` y 60
  → admitido), una sola fila por empresa (R17), RLS activada y forzada (R32), `AGENT` admitido
  como origen sin tocar mensajes existentes (R33), y que `down.sql` deja el esquema como estaba.
  Depende de T2.1.
- [x] **T2.3** `WHATSAPP_MESSAGE_ORIGINS` gana `'AGENT'` en `domain/whatsapp-message.ts` (D6).
  *Hecho:* typecheck verde; test unitario de R33 (el dominio admite `AGENT`).

## Tanda 3 — Configuración del agente (depende de 1 y 2)

- [x] **T3.1** `domain/whatsapp-agent-settings.ts`: tipo, `WHATSAPP_AGENT_DEFAULTS` (D11),
  `WHATSAPP_ASSISTANT_NAME_MAX_LENGTH`, `renderGreeting` y esquema zod (D12). *Hecho:* tests
  unitarios:
  - R8: defaults exactos, `assistantName` nulo y el saludo con `{nombre}` literal;
  - R11–R15: bordes 0, 1, 0.6, 1.01, -0.01, 0.655; enteros 0, 1, 1.5; mensajes vacíos, solo
    espacios, 4096 y 4097 caracteres; campo ausente; `enabled` no booleano; `assistantName`
    ausente no rechaza;
  - R34: `assistantName` ausente, `null`, `''` y `'   '` → `null`; `'  Ana  '` → `'Ana'`; `'\tAna'`,
    `'Ana\n'`, `'\r\nAna'` → `'Ana'` (D15); 60 caracteres pasa, 61 rechaza; número → rechaza;
  - R35: saludo por defecto con `'Ana'` → «Hola, soy el asistente virtual Ana. Si prefieres…»;
    sin nombre → «Hola, soy el asistente virtual. Si prefieres hablar con una persona, escribe
    "asesor".»; `{nombre}` al inicio sin nombre quita el espacio siguiente; dos `{nombre}` se
    resuelven los dos; saludo propio sin `{nombre}` queda igual; nombre `'{nombre}'` no se
    vuelve a resolver;
  - R36: saludo `'{nombre}'` sin nombre → rechaza; saludo de 4090 caracteres con `{nombre}` y un
    nombre que lo lleva a más de 4096 → rechaza.
- [x] **T3.2** `actor.ts`: `requireAgentReadPermission`, `requireAgentConfigurePermission`. Casos de
  uso `get-whatsapp-agent-settings.ts` y `save-whatsapp-agent-settings.ts`; puerto
  `whatsapp-agent-settings-repository.ts`. *Hecho:* tests unitarios con puerto simulado: R8 (sin
  fila → defaults), R9 y R10 (sin permiso o sin empresa: rechaza y el doble no registra llamadas),
  R16 (reemplaza todo, recorta mensajes y nombre, guarda autor y fecha), R18 (empresa del actor
  aunque la entrada traiga otra).
- [x] **T3.3** Adaptador `whatsapp-agent-settings-prisma.ts` y cableado en `lib/composition/index.ts`.
  *Hecho:* test de integración: guardar y leer, también con nombre y sin él (R16, R34), dos
  guardados concurrentes → una fila (R17), aislamiento entre dos empresas (R18), el umbral vuelve
  exacto.
- [x] **T3.4** Acciones de configuración en `adapters/driving/whatsapp-agent-actions.ts`.
  *Hecho:* test de acciones (traducción de errores, una sola lectura de sesión) verde.

## Tanda 4 — Modo de la conversación (depende de 1 y 2; después de la 3 por `composition` y `actor.ts`)

- [x] **T4.1** `domain/whatsapp-conversation-mode.ts`: `planModeChange` e `isDueForAgentReturn`.
  *Hecho:* tests unitarios puros: R21 (cada uno de los once motivos contra cada destino), R29
  (justo en N horas vuelve, un milisegundo antes no; la referencia es la más reciente de las dos
  fechas; mensaje posterior al cambio reinicia la cuenta), R30 (`AGENT` nunca; `HUMAN` sin fechas
  no).
- [x] **T4.2** Puerto `whatsapp-contact-repository.ts` (`findMode`, `setMode`) y adaptador
  `whatsapp-contact-prisma.ts`; dobles de `tests/unit/integraciones/whatsapp/whatsapp-doubles.ts`.
  *Hecho:* test de integración: `setMode` cambia, devuelve `unchanged` sin tocar motivo/fecha/autor
  si ya está en el destino (también con dos llamadas concurrentes), `not_found` para otra empresa;
  guarda autor nulo cuando `by` es `null` (R20).
- [x] **T4.3** `actor.ts`: `requireAgentOperatePermission` (D7). Casos de uso
  `hand-off-whatsapp-conversation.ts`, `return-whatsapp-conversation-to-agent.ts`,
  `get-whatsapp-conversation-mode.ts`. *Hecho:* tests unitarios R20, R22–R28 (sin permiso, sin
  añadido activo, sin empresa → rechaza sin llamar al puerto; id no uuid, inexistente o de otra
  empresa → no encontrado; ya en el destino → no falla y no reescribe).
- [x] **T4.4** Acciones de modo en `whatsapp-agent-actions.ts`, cableado en `composition`,
  reexportes en `lib/modules/integraciones/index.ts` (incluido `renderGreeting`). *Hecho:* test de
  acciones verde; guardias verdes.

## Cierre

- [x] **T5.1** Mapa `R<n> -> test` (R1–R36) en `progress/impl_QT-303.md`; `./init.sh` verde.

## Archivos esperados

- `lib/modules/identity/domain/company-addons.ts`
- `lib/modules/identity/domain/permissions.ts`
- `lib/shared/ui/addon-names.ts`
- `lib/shared/ui/addon-details.ts`
- `components/shared/CATALOGO.md`
- `db/schema.prisma`
- `db/migrations/20261030120000_whatsapp_agent/migration.sql`
- `db/migrations/20261030120000_whatsapp_agent/down.sql`
- `db/migrations/20261030120100_whatsapp_agent_permissions/migration.sql`
- `db/migrations/20261030120100_whatsapp_agent_permissions/down.sql`
- `lib/modules/integraciones/domain/actor.ts`
- `lib/modules/integraciones/domain/whatsapp-message.ts`
- `lib/modules/integraciones/domain/whatsapp-agent-settings.ts`
- `lib/modules/integraciones/domain/get-whatsapp-agent-settings.ts`
- `lib/modules/integraciones/domain/save-whatsapp-agent-settings.ts`
- `lib/modules/integraciones/domain/whatsapp-conversation-mode.ts`
- `lib/modules/integraciones/domain/hand-off-whatsapp-conversation.ts`
- `lib/modules/integraciones/domain/return-whatsapp-conversation-to-agent.ts`
- `lib/modules/integraciones/domain/get-whatsapp-conversation-mode.ts`
- `lib/modules/integraciones/ports/whatsapp-agent-settings-repository.ts`
- `lib/modules/integraciones/ports/whatsapp-contact-repository.ts`
- `lib/modules/integraciones/adapters/driven/persistence/whatsapp-agent-settings-prisma.ts`
- `lib/modules/integraciones/adapters/driven/persistence/whatsapp-contact-prisma.ts`
- `lib/modules/integraciones/adapters/driving/whatsapp-agent-actions.ts`
- `lib/modules/integraciones/index.ts`
- `lib/composition/index.ts`
- `tests/unit/identity/addons/company-addons.test.ts`
- `tests/unit/identity/permissions.test.ts`
- `tests/unit/shared/addon-names.test.ts`
- `tests/ui/maestro/company-modules-tab.test.tsx`
- `tests/ui/maestro/addon-switch-list.test.tsx`
- `tests/unit/identity/schema/whatsapp-agent-permissions-migration.test.ts`
- `tests/integration/identity/whatsapp-agent-permissions-migration.int.test.ts`
- `tests/integration/integraciones/whatsapp-agent-schema.int.test.ts`
- `tests/unit/integraciones/whatsapp/whatsapp-message.test.ts`
- `tests/unit/integraciones/agente/whatsapp-agent-settings.test.ts`
- `tests/unit/integraciones/agente/render-greeting.test.ts`
- `tests/unit/integraciones/agente/save-whatsapp-agent-settings.test.ts`
- `tests/unit/integraciones/agente/whatsapp-conversation-mode.test.ts`
- `tests/unit/integraciones/agente/conversation-mode-use-cases.test.ts`
- `tests/unit/integraciones/agente/whatsapp-agent-actions.test.ts`
- `tests/unit/integraciones/whatsapp/whatsapp-doubles.ts`
- `tests/integration/integraciones/whatsapp-agent-settings-prisma.int.test.ts`
- `tests/integration/integraciones/whatsapp-conversation-mode-prisma.int.test.ts`
- `progress/impl_QT-303.md`
