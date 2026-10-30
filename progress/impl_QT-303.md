# impl QT-303 — agente-ia-whatsapp-base

## Tanda 2 — Esquema (T2.1, T2.2, T2.3) · backend_dev · 2026-10-30

### Archivos
- `db/schema.prisma` (mod): `AGENT` en `WhatsappMessageOrigin`; enums `WhatsappConversationMode`
  y `WhatsappConversationModeReason` (11 motivos); 4 campos `conversationMode*` + índice en
  `WhatsappContact`; modelo `WhatsappAgentSettings` (`/// @module integraciones`, PK `company_id`,
  `assistantName` opcional, sin `@default` en campos de negocio).
- `db/migrations/20261030120000_whatsapp_agent/migration.sql` (nuevo): según `design.md > Migración 1`;
  FK a mano (companies/users RESTRICT), índices, RLS ENABLE + FORCE, `ADD VALUE 'AGENT'` al final.
- `db/migrations/20261030120000_whatsapp_agent/down.sql` (nuevo): recrea `whatsapp_message_origin`
  sin `AGENT` (el cast falla si hay mensajes `AGENT`), quita tabla, restricciones, índice, columnas y tipos.
- `lib/modules/integraciones/domain/whatsapp-message.ts` (mod): `WHATSAPP_MESSAGE_ORIGINS` gana `'AGENT'`.
- `tests/unit/integraciones/whatsapp/whatsapp-message.test.ts` (nuevo).
- `tests/integration/integraciones/whatsapp-agent-schema.int.test.ts` (nuevo, modo `transaccion`).
- `tests/integration/aislamiento.json` (mod): censo del archivo nuevo.
- `tests/guards/guard-identificador-de-request.test.ts` (mod): la migración nueva en `MIGRACIONES_ESPERADAS`
  (la guardia pide que cada ficha que añade migración la anote ahí). La de la tanda 1
  (`20261030120100_whatsapp_agent_permissions`) tendrá que anotarse igual.

### Mapa R → test (tanda 2)
| R | Archivo | Caso |
|---|---|---|
| R17 | whatsapp-agent-schema.int.test.ts | «R17: una sola fila de configuracion por empresa»; «R8 y R17: la tabla de configuracion tiene clave por empresa y ningun DEFAULT en los campos de negocio» |
| R19 | whatsapp-agent-schema.int.test.ts | «R19: los contactos que ya existian al migrar quedan en AGENT con motivo, fecha y autor nulos»; «R19: un contacto nuevo nace en AGENT sin motivo ni fecha» |
| R20 (base) | whatsapp-agent-schema.int.test.ts | «R31 y R20: la base admite HUMAN y AGENT con motivo y fecha, con usuario o sin el (el sistema)»; «R20: el autor del cambio debe ser un usuario existente» |
| R21 (base) | whatsapp-agent-schema.int.test.ts | «R21: la base admite en HUMAN cada motivo de paso a humano, tambien reclamo, sentimiento negativo y medio no soportado» |
| R31 | whatsapp-agent-schema.int.test.ts | «R31: la base rechaza HUMAN sin motivo ni fecha, motivo sin fecha y fecha sin motivo» |
| R32 | whatsapp-agent-schema.int.test.ts | «R32: la tabla de configuracion tiene RLS activada y forzada, sin policies» |
| R33 | whatsapp-agent-schema.int.test.ts | «R33: AGENT es un origen admitido de mensaje, ademas de USER y SYSTEM»; «R33: aplicar la migracion no cambia el origen de ningun mensaje existente» |
| R33 | whatsapp-message.test.ts | «R33: el dominio admite AGENT ademas de USER y SYSTEM»; «R33: el dominio y el enum del esquema tienen los mismos origenes» |
| R34 (base) | whatsapp-agent-schema.int.test.ts | «R34: la base rechaza un nombre del asistente vacio, con espacios en los extremos o de 61 caracteres y admite NULL y 60» |
| CHECK rangos/mensajes | whatsapp-agent-schema.int.test.ts | «la base rechaza un umbral fuera de [0, 1] y admite los bordes»; «la base rechaza limites y horas menores que 1 y admite 1»; «la base rechaza mensajes vacios, solo con espacios o de mas de 4096 caracteres y admite 4096» |
| down.sql | whatsapp-agent-schema.int.test.ts | «el DOWN quita tabla, columnas, restricciones, indice y tipos, y deja el origen sin AGENT»; «ida y vuelta: DOWN y UP dejan exactamente el mismo esquema»; «el DOWN se para si algun mensaje tiene origen AGENT» |

### Verificación (salida real)
- `pnpm exec prisma validate`: «The schema at db\schema.prisma is valid». `prisma generate` OK.
- `pnpm run typecheck`: primero rojo `app/layout.tsx: Cannot find name 'LayoutProps'` (tipos de ruta
  sin generar en el worktree, `docs/verification.md`); tras `pnpm exec next typegen`: verde, 0 errores.
- `pnpm run lint`: 0 errores, 10 warnings, ninguno en archivos tocados; `eslint` sobre los 4 TS tocados: limpio.
- `pnpm exec vitest related --run lib/modules/integraciones/domain/whatsapp-message.ts tests/unit/integraciones/whatsapp/whatsapp-message.test.ts`: 477 archivos, 8145 pasados, 2 skipped, 0 fallidos.
- `pnpm exec vitest run guard`: 87 archivos, 1324 pasados, 22 skipped, 0 fallidos (antes de anotar la
  migración en `guard-identificador-de-request`: 1 fallido, ese).
- Integración por archivo (base efímera, plantilla reconstruida con la migración):
  `whatsapp-agent-schema` 19/19; `whatsapp-contacts-last-read-migration` 6/6;
  `whatsapp-messages-migration` 5/5; `whatsapp-messages-constraints` 19/19;
  `whatsapp-conversation-prisma` 23/23; `whatsapp-connection-migration` 9/9;
  `clientes/customer-phone-numbers-migration` 10/10. Unit `customer-phone-numbers-migration` 20/20.

### Observación
- El CHECK `messages_not_blank` del design usa `btrim`, que solo quita espacios: un mensaje solo con
  tabuladores o saltos de línea pasa la base. La frontera (zod `trim()`, tanda 3) sí lo rechaza. Se
  dejó el CHECK como lo fija el design; el test usa solo espacios.

Veredicto: tanda 2 hecha y verde (schema, migración con down, dominio `AGENT`).

## Tanda 1 — Añadido y permisos (T1.1, T1.2, T1.3, T1.4) · backend_dev · 2026-10-30

### Archivos
- `lib/modules/identity/domain/company-addons.ts` (mod): `agente_ia_whatsapp` al final de `ADDONS`;
  `ADDON_PERMISSIONS` (`agente_ia.consultar`, `agente_ia.modificar`); `ADDON_REQUIRES` (`['integraciones']`).
- `lib/modules/identity/domain/permissions.ts` (mod): dos entradas `agente_ia.*` al final de `PERMISSIONS`
  (descripciones: «Ver/Cambiar la configuración del agente de IA de WhatsApp de la empresa.»), párrafo del
  JSDoc, y las dos al final del Administrador en `SEED_ROLE_PERMISSIONS`. No van en `CORE_PERMISSIONS`.
- `db/migrations/20261030120100_whatsapp_agent_permissions/migration.sql` + `down.sql` (nuevos): según
  `design.md > Migración 2` (addons, permissions, role_permissions solo Administrador con CROSS JOIN,
  excepciones desde `integraciones` prendido, `ON CONFLICT DO NOTHING`). DOWN: excepciones → asignaciones →
  permisos → clave.
- `lib/shared/ui/addon-names.ts`, `lib/shared/ui/addon-details.ts` (mod): entrada de D10 con `BotIcon`.
- `components/shared/CATALOGO.md` (mod): filas `ADDON_DETAILS` y `ADDON_NAMES` a «seis añadidos».
- Tests nuevos: `tests/unit/identity/schema/whatsapp-agent-permissions-migration.test.ts`,
  `tests/integration/identity/whatsapp-agent-permissions-migration.int.test.ts` (modo `transaccion`, censado
  en `tests/integration/aislamiento.json`).
- Tests actualizados (listas escritas a mano que crecen con el añadido/permisos):
  `tests/unit/identity/addons/company-addons.test.ts`, `tests/unit/identity/permissions.test.ts` (catálogo,
  módulo `agente_ia`, regex del código admite `_` en el módulo, helpers `sinAgente`),
  `tests/unit/shared/addon-names.test.ts`, `tests/ui/maestro/addon-switch-list.test.tsx` (ORDEN, NOMBRES,
  vistas con seis filas, «de 6», toast de «Prender todos» pasa a «2 módulos»),
  `tests/ui/maestro/company-modules-tab.test.tsx` (ORDEN), `tests/ui/maestro/company-addon-avatars.test.tsx`
  (límite visible 5 < 6 añadidos: el caso pasa el límite explícito), `tests/unit/maestro/addon-labels.test.ts`,
  `tests/unit/identity/company-actions.test.ts`, `tests/unit/identity/companies/get-company-addons.test.ts`,
  `tests/unit/identity/schema/company-addons-migration.test.ts` (la migración original no siembra el agente),
  `tests/unit/navegacion/qc75-convenciones.test.ts`, `tests/unit/asignaciones/schema/order-assignments-migration.test.ts`,
  `tests/integration/identity/company-addons.int.test.ts` (cuenta `ADDONS.length` en vez de 5),
  `tests/unit/integraciones/module-shape.test.ts` (rojo heredado de la tanda 2: faltaba `WhatsappAgentSettings`
  en la lista de modelos de integraciones), `tests/guards/guard-identificador-de-request.test.ts`
  (`MIGRACIONES_ESPERADAS`).

### Mapa R → test (tanda 1)
| R | Archivo | Caso |
|---|---|---|
| R1 | company-addons.test.ts | «R1 — está en el catálogo de añadidos, al final, y isAddon lo reconoce solo con su clave exacta» |
| R1 | whatsapp-agent-permissions-migration.test.ts | «R1: siembra en addons exactamente la clave del catalogo del codigo, que es la ultima de ADDONS»; «R1, R3: ninguna otra migracion nombra …» |
| R1, R3, R5 | whatsapp-agent-permissions-migration.int.test.ts | «R1, R3, R5: tras las migraciones existen el añadido, los dos permisos y solo el Administrador los tiene» |
| R1 | guard-catalogo-de-anadidos | «R2: las migraciones reales siembran exactamente ADDONS» (verde) |
| R2 | company-addons.test.ts | «R2 — requiere integraciones: prendido sin integraciones no es activo; con integraciones, sí» |
| R3 | permissions.test.ts | «R3: el catalogo contiene agente_ia.consultar y agente_ia.modificar con sus campos exactos…»; «R3: el catalogo es el previo … mas los dos del agente»; «R3: el JSDoc del catalogo tiene el parrafo del agente…» |
| R3 | whatsapp-agent-permissions-migration.test.ts | «R3: las filas de permissions son exactamente las dos entradas agente_ia de PERMISSIONS…» |
| R3, R4 | company-addons.test.ts | «R3, R4 — sus permisos son solo suyos, no del núcleo ni de otro añadido» |
| R4 | company-addons.test.ts | «R4 — con el añadido no activo se quitan agente_ia.consultar y agente_ia.modificar; activo, se conservan» |
| R5 | permissions.test.ts | «R5: el Administrador recibe los dos al final…»; «R5: ningun rol que no sea el Administrador recibe …» |
| R5 | whatsapp-agent-permissions-migration.test.ts | «R5: la asignacion reparte los dos codigos que el seed da al Administrador…»; «R5: la asignacion va solo al Administrador, por nombre y sin heredar…» |
| R5 | guard-permisos-sembrados | verde |
| R6 | whatsapp-agent-permissions-migration.int.test.ts | «R6: prende el agente en las empresas con integraciones prendido, también las de baja, y en ninguna otra»; «R6: aplicar el UP dos veces no duplica ni cambia nada»; «R6: el UP no pisa una excepción del agente que ya existía apagada»; «R6: el DOWN quita todas las excepciones del agente, sus permisos y su clave, y deja las demás» |
| R6 | whatsapp-agent-permissions-migration.test.ts | «R6: las excepciones salen solo de integraciones prendido…»; «R6: los cuatro INSERT llevan ON CONFLICT … DO NOTHING…»; «R6: el UP son cuatro INSERT…»; «R6: el UP no toca el esquema…»; tres casos del DOWN; «R6: la migracion va despues de la del esquema del agente» |
| R6, R8 | whatsapp-agent-permissions-migration.int.test.ts | «R6, R8: la empresa con el agente prendido sigue sin configuración guardada del agente» (sin fila en `whatsapp_agent_settings`; la lectura de defaults se cubre en la tanda 3) |
| R7 | addon-names.test.ts | «R7: nombre «Agente de IA para WhatsApp»»; «R7: descripción exacta e icono BotIcon»; «R7: hay detalle por cada añadido del catálogo…» |

### Verificación (salida real)
- `pnpm run typecheck`: verde (`tsc --noEmit`, 0 errores), también tras los últimos cambios de tests.
- `pnpm run lint`: 0 errores, 10 warnings, ninguno en archivos tocados; `eslint` sobre los TS tocados: exit 0.
- `pnpm exec vitest related --run <todos los TS tocados + los dos tests nuevos>`: primera corrida 7 fallidos
  (listas escritas a mano: module-shape, company-actions, qc75-convenciones, order-assignments-migration,
  get-company-addons, company-addons-migration) → corregidos; segunda corrida: 1078 archivos, 18459 pasados,
  23 skipped, 0 fallidos.
- `pnpm exec vitest run guard`: 87 archivos, 1324 pasados, 22 skipped, 0 fallidos.
- Integración por archivo (base efímera; plantilla reconstruida `qct_tpl_2ae16be5d1db` con la migración nueva):
  `whatsapp-agent-permissions-migration` 6/6; `company-addons` 16/16 (tras cambiar 5 → `ADDONS.length`);
  `identity-seed` 40/40; `role-catalog` 11/11; `company-directory-addons` 2/2; `notifications-addon-migration` 3/3;
  `plans-permissions-migration` 4/4; `whatsapp-read-permission-migration` 4/4; `whatsapp-send-permission-migration` 4/4;
  `integrations-permission-migration` 4/4; `session-user` 20/20; `documents-permissions-migration` 8/8.

### Observaciones
- `e2e/modulos-por-empresa.spec.ts` y `tests/unit/e2e-helpers/landing.test.ts` hablan de «los cinco añadidos»
  en nombres/comentarios; no se corrieron (E2E fuera del encargo). El E2E podría necesitar ajuste si cuenta
  interruptores; queda para el cierre / CI.
- `docs/diseno/canvas/MaestroEmpresaMovil.dc.html` dice «5 añadidos»; es tablero de diseño, no se toca.

Veredicto: tanda 1 hecha y verde (catálogo de añadidos y permisos, migración de datos con down, textos D10).
