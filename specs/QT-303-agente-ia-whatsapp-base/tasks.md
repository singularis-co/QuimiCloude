# QT-303 — agente-ia-whatsapp-base · tasks.md

> Implementa `backend_dev`. Cada tanda cierra con `pnpm run typecheck`, `pnpm run lint`,
> `pnpm exec vitest related --run <archivos tocados>` y `pnpm exec vitest run guard`.
> Las tareas que dependen de una pregunta abierta usan su propuesta por defecto salvo que el humano
> la cambie en F1.4.

## Tanda 1 — Añadido y permisos (identity) `[P]` con la tanda 2

- [ ] **T1.1** `company-addons.ts`: `agente_ia_whatsapp` en `ADDONS` (al final), `ADDON_REQUIRES`
  (`['integraciones']`) y `ADDON_PERMISSIONS` (`agente_ia.consultar`, `agente_ia.modificar`).
  *Hecho:* tests de `company-addons.test.ts` actualizados y nuevos casos verdes para R1 (catálogo),
  R2 (sin `integraciones` no es activo) y R4 (permisos quitados con el añadido apagado).
- [ ] **T1.2** `permissions.ts`: las dos entradas en `PERMISSIONS` y en
  `SEED_ROLE_PERMISSIONS[ROLE_ADMINISTRADOR]` (P3). *Hecho:* `permissions.test.ts` verde con casos
  R3 y R5 (solo el Administrador las tiene).
- [ ] **T1.3** Migración `20261030120100_whatsapp_agent_permissions` (`migration.sql` + `down.sql`):
  permisos, `role_permissions` del Administrador, `addons`; sin `company_addon_overrides`.
  *Hecho:* `guard-catalogo-de-anadidos` y `guard-permisos-sembrados` verdes; test estático de la
  migración (literales = constantes, R1, R3, R5, R6) y test de integración que la aplica y la
  revierte (R6: ninguna empresa con el añadido prendido).
  Depende de T1.1, T1.2 y de que la migración de la tanda 2 tenga timestamp anterior.
- [ ] **T1.4** `[P]` `addon-names.ts` y `addon-details.ts` con la entrada nueva (P5); filas de
  `CATALOGO.md` a «seis añadidos»; listas `ORDEN` de los tests del Maestro. *Hecho:* typecheck
  verde, `addon-names.test.ts` (R7) y tests de `tests/ui/maestro/` verdes.

## Tanda 2 — Esquema `[P]` con la tanda 1

- [ ] **T2.1** `db/schema.prisma`: enums `WhatsappConversationMode` y
  `WhatsappConversationModeReason`, cuatro campos en `WhatsappContact`, modelo
  `WhatsappAgentSettings` (`/// @module integraciones`); `AGENT` en `WhatsappMessageOrigin` si P1 =
  AGENT. *Hecho:* `prisma validate` y `guard-arquitectura-modulos` / `guard-empresa-en-esquema`
  verdes.
- [ ] **T2.2** Migración `20261030120000_whatsapp_agent` (`migration.sql` + `down.sql`) según
  `design.md > Migración 1`. *Hecho:* test de integración que comprueba: contactos existentes en
  `AGENT` con motivo y fecha nulos (R19), CHECK que rechaza `HUMAN` sin motivo/fecha y motivo sin
  fecha (R31), CHECK de rangos y mensajes de la configuración, una sola fila por empresa (R17),
  RLS activada y forzada (R32), `AGENT` admitido como origen sin tocar mensajes (R33, si P1), y que
  `down.sql` deja el esquema como estaba. Depende de T2.1.
- [ ] **T2.3** Si P1 = AGENT: `WHATSAPP_MESSAGE_ORIGINS` gana `'AGENT'` en
  `domain/whatsapp-message.ts`. *Hecho:* typecheck verde.

## Tanda 3 — Configuración del agente (depende de 1 y 2)

- [ ] **T3.1** `domain/whatsapp-agent-settings.ts`: tipo, `WHATSAPP_AGENT_DEFAULTS` (P6) y esquema
  zod (P7). *Hecho:* tests unitarios R8 (defaults), R11–R15 (bordes: 0, 1, 0.6, 1.01, -0.01, 0.655,
  0, 1, 1.5, mensajes vacíos, solo espacios, 4096 y 4097 caracteres, campo ausente, `enabled` no
  booleano).
- [ ] **T3.2** `actor.ts`: `requireAgentReadPermission`, `requireAgentConfigurePermission`. Casos de
  uso `get-whatsapp-agent-settings.ts` y `save-whatsapp-agent-settings.ts`; puerto
  `whatsapp-agent-settings-repository.ts`. *Hecho:* tests unitarios con puerto simulado: R8 (sin
  fila → defaults), R9 y R10 (sin permiso o sin empresa: rechaza y el doble no registra llamadas),
  R16 (reemplaza todo, recorta mensajes, guarda autor y fecha), R18 (empresa del actor aunque la
  entrada traiga otra).
- [ ] **T3.3** Adaptador `whatsapp-agent-settings-prisma.ts` y cableado en `lib/composition/index.ts`.
  *Hecho:* test de integración: guardar y leer (R16), dos guardados concurrentes → una fila (R17),
  aislamiento entre dos empresas (R18), el umbral vuelve exacto.
- [ ] **T3.4** Acciones de configuración en `adapters/driving/whatsapp-agent-actions.ts`.
  *Hecho:* test de acciones (traducción de errores, una sola lectura de sesión) verde.

## Tanda 4 — Modo de la conversación (depende de 1 y 2; después de la 3 por `composition` y `actor.ts`)

- [ ] **T4.1** `domain/whatsapp-conversation-mode.ts`: `planModeChange` e `isDueForAgentReturn`.
  *Hecho:* tests unitarios puros: R21 (cada motivo contra cada destino), R29 (justo en N horas
  vuelve, un milisegundo antes no; la referencia es la más reciente de las dos fechas; mensaje
  posterior al cambio reinicia la cuenta), R30 (`AGENT` nunca; `HUMAN` sin fechas no).
- [ ] **T4.2** Puerto `whatsapp-contact-repository.ts` (`findMode`, `setMode`) y adaptador
  `whatsapp-contact-prisma.ts`; dobles de `tests/unit/integraciones/whatsapp/whatsapp-doubles.ts`.
  *Hecho:* test de integración: `setMode` cambia, devuelve `unchanged` sin tocar motivo/fecha/autor
  si ya está en el destino (también con dos llamadas concurrentes), `not_found` para otra empresa;
  guarda autor nulo cuando `by` es `null` (R20).
- [ ] **T4.3** `actor.ts`: `requireAgentOperatePermission` (P2). Casos de uso
  `hand-off-whatsapp-conversation.ts`, `return-whatsapp-conversation-to-agent.ts`,
  `get-whatsapp-conversation-mode.ts`. *Hecho:* tests unitarios R20, R22–R28 (sin permiso, sin
  añadido activo, sin empresa → rechaza sin llamar al puerto; id no uuid, inexistente o de otra
  empresa → no encontrado; ya en el destino → no falla y no reescribe).
- [ ] **T4.4** Acciones de modo en `whatsapp-agent-actions.ts`, cableado en `composition`,
  reexportes en `lib/modules/integraciones/index.ts`. *Hecho:* test de acciones verde; guardias
  verdes.

## Cierre

- [ ] **T5.1** Mapa `R<n> -> test` (R1–R33) en `progress/impl_QT-303.md`; `./init.sh` verde.

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
- `tests/unit/integraciones/agente/whatsapp-agent-settings.test.ts`
- `tests/unit/integraciones/agente/save-whatsapp-agent-settings.test.ts`
- `tests/unit/integraciones/agente/whatsapp-conversation-mode.test.ts`
- `tests/unit/integraciones/agente/conversation-mode-use-cases.test.ts`
- `tests/unit/integraciones/agente/whatsapp-agent-actions.test.ts`
- `tests/unit/integraciones/whatsapp/whatsapp-doubles.ts`
- `tests/integration/integraciones/whatsapp-agent-settings-prisma.int.test.ts`
- `tests/integration/integraciones/whatsapp-conversation-mode-prisma.int.test.ts`
- `progress/impl_QT-303.md`
