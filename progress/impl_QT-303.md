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

## Fix 2026-10-30: `messages_not_blank` rechaza blancos (D15)

- Archivos: `db/migrations/20261030120000_whatsapp_agent/migration.sql` (CHECK con `btrim(x, E' \t\n\r')`;
  `down.sql` sin cambios: borra la tabla entera), `specs/QT-303-agente-ia-whatsapp-base/design.md > Migración 1`,
  `requirements.md > Decisiones cerradas` (D15), `tests/integration/integraciones/whatsapp-agent-schema.int.test.ts`
  (casos `\t\t`, `\n\n`, `\t`, `\n`, `\r\n`, ` \t\r\n ` rechazados; el test pasa a nombrar R14).
- Abierto: `assistant_name_valid` sigue con `btrim(x) = x` (solo espacios); no se cambia sin decisión del humano.
- `pnpm exec vitest run --project integration tests/integration/integraciones/whatsapp-agent-schema.int.test.ts`:
  plantilla reconstruida `qct_tpl_483e168a5880` (huella nueva por la migración editada); 1 archivo, 19/19 pasados.
- `pnpm run typecheck`: 0 errores. `pnpm run lint`: 0 errores, 10 warnings (ninguno en archivos tocados).

Veredicto: CHECK corregido y probado contra la base; verde.

## Tanda 3 — Configuración del agente (T3.1–T3.4)

### Archivos

Creados:
- `lib/modules/integraciones/domain/whatsapp-agent-settings.ts`: tipo, `WHATSAPP_AGENT_DEFAULTS`
  (congelado), `WHATSAPP_ASSISTANT_NAME_MAX_LENGTH = 60`, `GREETING_NAME_PLACEHOLDER`,
  `renderGreeting`, `saveWhatsappAgentSettingsSchema` (zod; sin `strict`: una clave de más, como una
  empresa, se descarta) y `SaveWhatsappAgentSettingsInput`.
- `lib/modules/integraciones/domain/get-whatsapp-agent-settings.ts`, `save-whatsapp-agent-settings.ts`.
- `lib/modules/integraciones/ports/whatsapp-agent-settings-repository.ts`.
- `lib/modules/integraciones/adapters/driven/persistence/whatsapp-agent-settings-prisma.ts` (upsert
  por `company_id`; umbral a `Decimal` por texto con `toFixed(2)` y de vuelta con `toNumber()`).
- `lib/modules/integraciones/adapters/driving/whatsapp-agent-actions.ts`
  (`getWhatsappAgentSettingsAction`, `saveWhatsappAgentSettingsAction`).
- `tests/unit/integraciones/agente/whatsapp-agent-settings.test.ts`, `render-greeting.test.ts`,
  `save-whatsapp-agent-settings.test.ts`, `whatsapp-agent-actions.test.ts`.
- `tests/integration/integraciones/whatsapp-agent-settings-prisma.int.test.ts`.

Modificados:
- `lib/modules/integraciones/domain/actor.ts`: `AGENT_READ_PERMISSION`, `AGENT_CONFIGURE_PERMISSION`,
  `requireAgentReadPermission`, `requireAgentConfigurePermission`.
- `lib/modules/integraciones/index.ts`: reexporta tipos, defaults, `renderGreeting` y las dos fábricas
  (adelanta el reexporte de `renderGreeting` que T4.4 pedía).
- `lib/composition/index.ts`: repositorio de configuración y `getWhatsappAgentSettings` /
  `saveWhatsappAgentSettings` en la fachada `integraciones`.
- `tests/integration/aislamiento.json`: el `.int` nuevo en `commit` con su motivo (lo exige
  `guard-aislamiento-integracion`).
- `tests/unit/identity/session-once-per-request-actions.test.ts`: lista a mano `ACCIONES` (una
  entrada por archivo de acciones) con `whatsapp-agent-actions.ts` → `getWhatsappAgentSettingsAction`.
- `tests/unit/composition/integraciones-graph-doubles.test.ts` y
  `tests/unit/integraciones/encryption-keys-env.test.ts`: listas a mano (ordenadas) de las claves de
  la fachada `integraciones`; se añaden `getWhatsappAgentSettings` y `saveWhatsappAgentSettings`.
- `specs/QT-303-agente-ia-whatsapp-base/tasks.md`: T3.1–T3.4 en `[x]`.

Desvío del design: el puerto es `save(settings, by, at, scope)` (el design decía
`save(settings, by, scope)`). La fecha la pone el caso de uso con su reloj inyectable, como
`set-whatsapp-contact-blocked`, para que el *Hecho* de T3.2 («guarda autor y fecha») se pruebe con
el puerto simulado; el adaptador la escribe en `updated_at`.

### Mapa R -> test (tanda 3)

| R | Archivo | Casos |
|---|---|---|
| R8 | whatsapp-agent-settings.test.ts | «R8 — activo false, umbral 0.6, …textos exactos»; «R8 — el saludo por defecto guarda `{nombre}` literal…»; «R8 — los valores por defecto pasan el propio esquema»; «R8 — …no se pueden mutar» |
| R8 | save-whatsapp-agent-settings.test.ts | «R8 — una empresa sin configuración guardada recibe los valores por defecto» |
| R8 | whatsapp-agent-settings-prisma.int.test.ts | «R8 — una empresa sin fila lee null y el caso de uso devuelve los valores por defecto» |
| R8 | whatsapp-agent-actions.test.ts | «R8 — leer devuelve `success` con la configuración del caso de uso» |
| R9 | save-whatsapp-agent-settings.test.ts | «R9 — sin agente_ia.consultar / sin empresa / sin actor / actor indefinido: rechaza con unauthorized y no lee» |
| R10 | save-whatsapp-agent-settings.test.ts | «R10 — sin agente_ia.modificar / sin empresa / sin actor: rechaza … antes de leer la entrada y sin escribir» |
| R9, R10 | whatsapp-agent-actions.test.ts | «R9, R10 — sin sesión el actor baja nulo y el `unauthorized`…»; «R9, R10, R11 — cada error de dominio se traduce…» |
| R11 | whatsapp-agent-settings.test.ts | «R11 — umbral 0, 1, 0.6, 0.01, 0.29, 0.99: acepta»; «R11 — umbral 1.01, -0.01, 0.655, 2, NaN, Infinity, '0.6', null: rechaza» |
| R12 | whatsapp-agent-settings.test.ts | «R12 — dailyReplyLimit / contactHourlyReplyLimit: 1 acepta; 0, 1.5, -3 y texto rechazan» |
| R13 | whatsapp-agent-settings.test.ts | «R13 — horas de inactividad: 1 acepta; 0, 1.5, -1 y texto rechazan» |
| R14 | whatsapp-agent-settings.test.ts | «R14 — handoffMessage / greetingMessage vacío, solo espacios o solo blancos rechaza; 4096 acepta y 4097 rechaza»; «R14 — el tope de 4096 se cuenta después de recortar» |
| R15 | whatsapp-agent-settings.test.ts | «R15 — sin el campo X rechaza» (los siete); «R15 — `enabled` no booleano rechaza»; «R15 — sin nombre del asistente no rechaza»; «R15 — una entrada que no es un objeto rechaza» |
| R11–R15, R34, R36 | save-whatsapp-agent-settings.test.ts | «R11–R15, R34, R36 — …: rechaza con invalid_input y no escribe» (diez casos); «R15 — sin un campo obligatorio rechaza y no escribe» |
| R16 | save-whatsapp-agent-settings.test.ts | «R16 — reemplaza todos los campos, recorta mensajes y nombre y registra autor y fecha»; «R16 — con configuración guardada devuelve la guardada» |
| R16 | whatsapp-agent-settings-prisma.int.test.ts | «R16, R34 — guardar y leer con nombre…, con autor y fecha»; «R16 — un segundo guardado reemplaza todos los campos, el autor y la fecha»; «R16 — el umbral X vuelve exacto» (0, 1, 0.6, 0.29, 0.07, 0.99) |
| R16 | whatsapp-agent-actions.test.ts | «R16 — guardar baja la entrada tal cual con el actor y devuelve `success`» |
| R17 | whatsapp-agent-settings-prisma.int.test.ts | «R17 — guardados concurrentes de la misma empresa dejan una sola fila» (ocho a la vez, ninguno falla) |
| R18 | save-whatsapp-agent-settings.test.ts | «R18 — lee siempre la empresa del actor»; «R18 — escribe en la empresa del actor aunque la entrada traiga otra, y no guarda esa clave» |
| R18 | whatsapp-agent-settings-prisma.int.test.ts | «R18 — una empresa no lee ni pisa la configuración de otra»; «R16, R18 — el caso de uso guarda recortado en la empresa del actor aunque la entrada traiga otra» |
| R34 | whatsapp-agent-settings.test.ts | «R34 — ausente, null, vacío o solo espacios se guarda sin nombre»; «R34 — …sin los espacios de los extremos»; «R34 — 60 pasan y 61 rechazan»; «R34 — un nombre que no es texto rechaza» |
| R34 | save-whatsapp-agent-settings.test.ts / int | «R16, R34 — sin nombre del asistente guarda el nombre nulo»; «R16, R34 — guardar sin nombre… lo deja nulo en la base y en la lectura» |
| R35 | render-greeting.test.ts | «R35 — …con nombre «Ana»…»; «R35 — …sin nombre quita `{nombre}` con el espacio que lo precede»; «R35 — `{nombre}` al inicio…»; «R35 — `{nombre}` pegado…»; «R35 — dos `{nombre}`…»; «R35 — un saludo propio sin `{nombre}` queda igual»; «R35 — un nombre que contiene `{nombre}` no se vuelve a resolver»; «R35 — no recorta ni colapsa otros espacios» |
| R36 | whatsapp-agent-settings.test.ts | «R36 — un saludo que es solo `{nombre}` sin nombre rechaza»; «R36 — el mismo saludo con nombre acepta»; «R36 — un saludo de 4090 caracteres con `{nombre}` que el nombre lleva a más de 4096 rechaza» |
| T3.4 | whatsapp-agent-actions.test.ts | «cada acción lee la sesión una sola vez y no revalida ninguna ruta»; «un error ajeno al dominio sale como `unexpected`…»; «el borde no decide…» |

### Verificación (salida real)

Verificado 2026-10-31 (backend_dev, retoma tras un agente colgado):

- `pnpm run typecheck` → `tsc --noEmit` sin errores.
- `pnpm run lint` → `✖ 10 problems (0 errors, 10 warnings)`; los 10 avisos son previos y en
  archivos ajenos a la tanda.
- `pnpm exec vitest run guard` → `Test Files 87 passed (87)`, `Tests 1325 passed | 22 skipped (1347)`.
- `pnpm exec vitest related --run <archivos de la tanda>` (primera corrida) →
  `Test Files 2 failed | 527 passed (529)`, `Tests 2 failed | 9394 passed | 3 skipped (9399)`.
  Los dos rojos eran las listas a mano de la fachada (`integraciones-graph-doubles.test.ts`,
  `encryption-keys-env.test.ts`: «expected […(47)] to deeply equal […(45)]»). Tras añadir las dos
  claves: `pnpm exec vitest run` de esos dos archivos → `Test Files 2 passed (2)`, `Tests 34 passed (34)`.
- Integración, con `.env` cargado: `pnpm exec vitest run --project integration
  tests/integration/integraciones/whatsapp-agent-settings-prisma.int.test.ts` →
  `Test Files 1 passed (1)`, `Tests 13 passed (13)`; base efímera
  `qct_qt303agentei_96508dfe_mvwewngl_32g` borrada al terminar.

### Observaciones

- Los enteros (R12, R13) no tienen tope superior (D12), pero las columnas son `INTEGER`: un valor
  mayor que 2 147 483 647 pasa el zod y la base lo rechaza como error inesperado. No se pone tope
  sin decisión del humano.
- Abierto heredado (D15): `assistant_name_valid` solo recorta espacios. El zod recorta con
  `String.prototype.trim` (todos los blancos), así que por el caso de uso nunca llega un nombre con
  tabuladores en los extremos.

Veredicto: tanda 3 hecha; configuración del agente leída y guardada por empresa, verde.

## Fix 2026-10-31: `assistant_name_valid` rechaza blancos no espacio (D15, decisión del humano)

- Archivos: `db/migrations/20261030120000_whatsapp_agent/migration.sql` (CHECK
  `btrim("assistant_name", E' \t\n\r') = "assistant_name"`; `down.sql` sin cambios),
  `specs/QT-303-agente-ia-whatsapp-base/requirements.md` (R34 habla de blancos; D15 deja de estar abierto),
  `design.md > Migración 1` (SQL y nota de D15), `tasks.md` (casos de R34),
  `tests/integration/integraciones/whatsapp-agent-schema.int.test.ts` (R34/D15: `'\tAna'`, `'Ana\n'`,
  `'\r\nAna'`, `'\t'` rechazados), `tests/unit/integraciones/agente/whatsapp-agent-settings.test.ts`
  (`'\tAna'`, `'Ana\n'`, `'\r\nAna'` → `'Ana'`; `' \t\r\n '` → `null`).
- `lib/modules/integraciones/domain/whatsapp-agent-settings.ts` sin cambios: el zod usa
  `String.prototype.trim()`, que ya quita `\t \n \r`; los tests nuevos lo fijan.
- Rojo con el CHECK viejo: con `migration.sql` de HEAD restaurado temporalmente,
  `vitest run ...whatsapp-agent-schema.int.test.ts -t R34` → `Tests 1 failed | 18 skipped (19)`.
  Con el CHECK nuevo: `Test Files 1 passed (1)`, `Tests 19 passed (19)` (plantilla `qct_tpl_4bf16c205f06`).
- `pnpm exec vitest run tests/unit/integraciones/agente/whatsapp-agent-settings.test.ts`: 53/53 pasados.
- `pnpm exec vitest related --run lib/modules/integraciones/domain/whatsapp-agent-settings.ts tests/unit/integraciones/agente/whatsapp-agent-settings.test.ts`:
  `Test Files 497 passed (497)`, `Tests 8606 passed | 3 skipped (8609)`.
- `pnpm exec tsc --noEmit`: exit 0. `eslint` sobre los dos tests tocados: sin salida (0 problemas).

Veredicto: nombre del asistente endurecido en base y probado en dominio; verde.

## Textos «cinco añadidos» → seis (2026-10-31)

- Archivos: `e2e/modulos-por-empresa.spec.ts` (comentario de `setAddons` y título del test de la
  línea 226), `e2e/helpers/addons.ts` (comentario de `enableAllAddons`), `tests/unit/e2e-helpers/landing.test.ts`
  (título del `describe` de la línea 200). Solo texto: ambos archivos cuentan con `ADDONS.length` y
  recorren `ADDONS`, que ya trae `agente_ia_whatsapp`; ninguna aserción listaba nombres ni el número 5.
- Nota de proceso: estos cambios entraron por error en el commit `324ebd136` (fix del nombre del
  asistente, `git add -A`) y ya estaba pusheado; no se reescribió la historia sin autorización.
  Este commit `test(QT-303)` solo lleva esta sección.
- `pnpm exec vitest run tests/unit/e2e-helpers/landing.test.ts`: `Test Files 1 passed (1)`, `Tests 14 passed (14)`.
- E2E `pnpm exec playwright test e2e/modulos-por-empresa.spec.ts`: **no viable en local**. 10/10 fallan
  (chromium y webkit) en `setAddons` con `PrismaClientKnownRequestError: Foreign key constraint violated`
  sobre `company_addon_overrides_addon_key_fkey`: la base del `.env` (la que usa el `webServer` del E2E)
  no tiene aplicada `20261030120100_whatsapp_agent_permissions`, así que falta la fila
  `addons.key = 'agente_ia_whatsapp'`. No se migró esa base (no es una base desechable de test). Queda
  para el E2E de CI o tras aplicar las migraciones de QT-303 a esa base.

Veredicto: textos ajustados y unit verde; E2E local bloqueado por base sin migrar.

## Tanda 4 — Modo de la conversación (T4.1–T4.4) · backend_dev · 2026-10-31

### Archivos

Creados:
- `lib/modules/integraciones/domain/whatsapp-conversation-mode.ts`: `CONVERSATION_MODES`,
  `CONVERSATION_MODE_REASONS` (11), `REASONS_BY_TARGET` (congelado; HUMAN ← 10, AGENT ← `MANUAL`,
  `INACTIVITY`), `planModeChange`, `isDueForAgentReturn`, `conversationModeInputSchema`
  (`{ contactId: uuid }`) y `ConversationModeView`.
- `lib/modules/integraciones/domain/hand-off-whatsapp-conversation.ts`,
  `return-whatsapp-conversation-to-agent.ts`, `get-whatsapp-conversation-mode.ts`.
- `tests/unit/integraciones/agente/whatsapp-conversation-mode.test.ts`,
  `conversation-mode-use-cases.test.ts`.
- `tests/integration/integraciones/whatsapp-conversation-mode-prisma.int.test.ts` (modo `commit`).

Modificados:
- `lib/modules/integraciones/domain/actor.ts`: `requireAgentOperatePermission` (`whatsapp.enviar` +
  añadido `agente_ia_whatsapp` + empresa) y `requireAgentModeReadPermission` (`whatsapp.consultar` +
  añadido + empresa), D7.
- `lib/modules/integraciones/ports/whatsapp-contact-repository.ts`: `ConversationModeState`,
  `ConversationModeChange`, `findMode`, `setMode`.
- `lib/modules/integraciones/adapters/driven/persistence/whatsapp-contact-prisma.ts`:
  `findWhatsappContactMode`, `setWhatsappContactMode` (`updateMany` con `conversation_mode <> destino`
  y, si no cambia filas, `findFirst` para distinguir `unchanged` de `not_found`); cableadas en la fábrica.
- `lib/modules/integraciones/adapters/driving/whatsapp-agent-actions.ts`:
  `handOffWhatsappConversationAction`, `returnWhatsappConversationToAgentAction`,
  `getWhatsappConversationModeAction` (contratos de `design.md > Contratos`).
- `lib/modules/integraciones/index.ts`: reexporta tipos y reglas del modo y las tres fábricas.
- `lib/composition/index.ts`: los tres casos de uso en la fachada `integraciones`, sobre el
  `whatsappContactRepository` existente.
- `tests/unit/integraciones/whatsapp/whatsapp-doubles.ts`: `ContactDoubleRow.conversation` opcional,
  `ContactModeDouble`, `NEVER_CHANGED_MODE`, `findMode`/`setMode` en `makeContactRepository`.
- `tests/unit/integraciones/agente/whatsapp-agent-actions.test.ts`: las tres acciones nuevas.
- Listas escritas a mano: `tests/unit/composition/integraciones-graph-doubles.test.ts` y
  `tests/unit/integraciones/encryption-keys-env.test.ts` (claves de la fachada:
  `getWhatsappConversationMode`, `handOffWhatsappConversation`, `returnWhatsappConversationToAgent`);
  `tests/guards/guard-ambito-empresa-integraciones.test.ts` (`PUERTO_CONTACTOS.metodosEsperados` 4 → 6);
  `tests/integration/aislamiento.json` (el `.int` nuevo en `commit` con motivo).
  `tests/unit/identity/session-once-per-request-actions.test.ts` no cambia: es una fila por archivo
  de acciones y `whatsapp-agent-actions.ts` ya estaba. `tests/unit/integraciones/module-shape.test.ts`
  no cambia: no hay modelo nuevo.
- `specs/QT-303-agente-ia-whatsapp-base/tasks.md`: T4.1–T4.4 en `[x]`.

Decisiones de implementación (dentro del design):
- Los casos de uso de cambio leen el modo (`findMode`) y aplican `planModeChange`; si ya está en el
  destino vuelven sin llamar a `setMode` (R23/R25 visibles con el puerto simulado). `setMode` sigue
  filtrando por modo en la base, así que dos clics simultáneos no pisan el primer cambio (probado en
  el `.int`).
- `requireAgentModeReadPermission` es un helper nuevo en `actor.ts` para la consulta (D7); el design
  describe la regla sin nombrar el helper.
- `isDueForAgentReturn` recibe `{ mode, modeChangedAt, lastMessageAt }` como dice el design; el
  puerto devuelve `changedAt`. QT-307 mapea uno a otro.

### Mapa R -> test (tanda 4)

| R | Archivo | Casos |
|---|---|---|
| R19 | whatsapp-conversation-mode-prisma.int.test.ts | «R19, R28 — un contacto nuevo se lee en AGENT, sin motivo ni fecha, con su último mensaje» |
| R20 | conversation-mode-use-cases.test.ts | «R22, R20 — …queda en HUMAN con motivo MANUAL, la fecha actual y el usuario»; «R24, R20 — …queda en AGENT…» |
| R20 | whatsapp-conversation-mode-prisma.int.test.ts | «R20, R22 — setMode a HUMAN cambia y guarda motivo, fecha y usuario»; «R20 — un cambio del sistema guarda el usuario nulo» |
| R21 | whatsapp-conversation-mode.test.ts | «R21 — hay once motivos y dos modos…»; «R21 — HUMAN admite los diez de paso a humano (también reclamo, sentimiento negativo y medio no soportado); AGENT, a mano e inactividad»; «R21 — <motivo> hacia <destino>: se admite / rechaza con ValidationError» (22 casos: once motivos × dos destinos, cada uno desde los dos modos actuales); «R21 — un motivo fuera del catálogo rechaza» |
| R22 | conversation-mode-use-cases.test.ts | «R22, R20 — …»; «R22 — una conversación devuelta antes al agente también pasa a HUMAN» |
| R22 | whatsapp-agent-actions.test.ts | «R22 — pasar a humano baja la entrada tal cual con el actor (con sus añadidos) y devuelve `success`» |
| R22, R24, R28 | whatsapp-conversation-mode-prisma.int.test.ts | «R22, R24, R28 — pasar a humano, consultar, devolver al agente y consultar otra vez» |
| R23 | conversation-mode-use-cases.test.ts | «R23 — ya en HUMAN no falla y no reescribe modo, motivo, fecha ni usuario»; «R23 — si otro cambio gana la carrera entre la lectura y la escritura, no falla» |
| R23 | whatsapp-conversation-mode-prisma.int.test.ts | «R23 — ya en el destino devuelve unchanged sin tocar motivo, fecha ni usuario»; «R23 — ocho cambios simultáneos al mismo destino: uno cambia, los demás no pisan su motivo ni su fecha»; «R23 — pasar a humano dos veces a la vez no falla y deja un solo cambio» |
| R23, R25 | whatsapp-conversation-mode.test.ts | «R23, R25 — ya en el destino con un motivo válido no hay cambio» |
| R24 | conversation-mode-use-cases.test.ts | «R24, R20 — una conversación en HUMAN queda en AGENT con motivo MANUAL, la fecha actual y el usuario» |
| R24 | whatsapp-conversation-mode-prisma.int.test.ts | «R24 — de HUMAN a AGENT cambia con el motivo, la fecha y el usuario nuevos» |
| R24 | whatsapp-agent-actions.test.ts | «R24 — devolver al agente baja la entrada tal cual con el actor y devuelve `success`» |
| R25 | conversation-mode-use-cases.test.ts | «R25 — ya en AGENT (nunca cambió) no falla y no escribe»; «R25 — ya en AGENT por un cambio anterior conserva motivo, fecha y usuario de ese cambio» |
| R25 | whatsapp-conversation-mode-prisma.int.test.ts | «R25 — un contacto que nunca cambió ya está en AGENT: unchanged y sigue sin motivo ni fecha» |
| R26 | conversation-mode-use-cases.test.ts | «R26 — <pasar a humano / devolver al agente> <sin actor, actor indefinido, sin empresa, sin whatsapp.enviar, solo con whatsapp.consultar, solo con los permisos de configuración del agente, sin el añadido del agente, sin la lista de añadidos>: rechaza con unauthorized sin llamar al puerto» (16 casos); «R26 — …: el permiso se comprueba antes que la entrada» |
| R26, R27, R28 | whatsapp-agent-actions.test.ts | «R26, R27, R28 — las acciones de modo traducen unauthorized, contacto no encontrado e invalid_input del catálogo» |
| R27 | conversation-mode-use-cases.test.ts | «R27 — <operación> con <un id sin forma de uuid / un id que no existe / un contacto de otra empresa / sin id>: whatsapp_contact_not_found y no escribe» (8); «R27 — consultar el modo con …» (4); «R27 — el contacto de otra empresa se pide con el ámbito del actor, nunca con el de la entrada»; «R27 — si el contacto desaparece entre la lectura y la escritura, responde no encontrado» |
| R27 | whatsapp-conversation-mode-prisma.int.test.ts | «R27 — un contacto de otra empresa no se lee ni se escribe: null y not_found»; «R27 — un id que no existe: null y not_found»; «R27 — el contacto de otra empresa responde no encontrado y queda intacto» |
| R28 | conversation-mode-use-cases.test.ts | «R28 — una conversación que nunca cambió devuelve AGENT con motivo y fecha vacíos»; «R28 — devuelve el modo, el motivo y la fecha del último cambio, sin el autor ni el último mensaje»; «R28 — tras pasar a humano, la consulta devuelve el cambio»; «R28 — <sin actor, sin empresa, sin whatsapp.consultar, solo con agente_ia.consultar, sin el añadido del agente>: rechaza con unauthorized sin leer» (5); «R28 — con whatsapp.enviar pero sin whatsapp.consultar no se consulta: son permisos distintos» |
| R28 | whatsapp-agent-actions.test.ts | «R28 — consultar el modo devuelve `success` con modo, motivo y fecha»; «R28 — una conversación que nunca cambió sale con motivo y fecha nulos» |
| R29 | whatsapp-conversation-mode.test.ts | «R29 — justo a las N horas del cambio vuelve; un milisegundo antes, no»; «R29 — la referencia es la más reciente de las dos fechas: un mensaje posterior al cambio reinicia la cuenta»; «R29 — un mensaje anterior al cambio no adelanta la vuelta: cuenta la fecha del cambio»; «R29 — con solo la fecha del último mensaje, cuenta desde ella»; «R29 — las horas configuradas mandan: 1 hora y 48 horas» |
| R30 | whatsapp-conversation-mode.test.ts | «R30 — una conversación en AGENT nunca vuelve, por vieja que sea»; «R30 — una conversación en HUMAN sin fecha de cambio ni de último mensaje no vuelve» |
| T4.4 | whatsapp-agent-actions.test.ts | «cada acción lee la sesión una sola vez y no revalida ninguna ruta» (ahora las cinco acciones); «el borde no decide…» (ahora también sin `whatsapp.enviar/consultar`, `agente_ia_whatsapp`, `planModeChange`) |

### Verificación (salida real)

- `pnpm run typecheck` → `tsc --noEmit` sin errores (la primera corrida, antes de ampliar los dobles,
  dio el rojo esperado `whatsapp-doubles.ts(372,9): TS2739 … missing … findMode, setMode`).
- `pnpm run lint` → `✖ 10 problems (0 errors, 10 warnings)`; los 10 avisos son previos y ajenos.
- `pnpm exec vitest run guard` → `Test Files 87 passed (87)`, `Tests 1327 passed | 22 skipped (1349)`.
- `pnpm exec vitest run tests/unit/integraciones/agente tests/unit/composition/integraciones-graph-doubles.test.ts
  tests/unit/integraciones/encryption-keys-env.test.ts tests/unit/integraciones/whatsapp/authorization.test.ts
  tests/unit/integraciones/whatsapp/set-whatsapp-contact-blocked.test.ts` → `Test Files 10 passed (10)`,
  `Tests 298 passed (298)`.
- Integración (con `.env` cargado, base efímera sobre la plantilla `qct_tpl_4bf16c205f06`):
  `whatsapp-conversation-mode-prisma.int.test.ts` → `Tests 12 passed (12)`;
  `whatsapp-contact-links.int.test.ts` (usa el mismo repositorio) → `Tests 17 passed (17)`.
- `pnpm exec vitest related --run <17 archivos TS tocados>`: **no terminó**. Claude Code lo paró
  porque la máquina se quedó sin memoria (no es un fallo de los tests). No se relanzó; queda
  pendiente para `./init.sh` o la CI.

Veredicto: tanda 4 hecha; typecheck, lint, guardias, unit de la tanda e int verdes; `vitest related` sin terminar (se paró por falta de memoria).

## T5.1 — Trazabilidad R1–R36 · backend_dev · 2026-10-31

Revisada contra los nombres reales de los casos en los archivos de las tandas 1–4 (grep de
`it(`/`describe(` con `R<n>`). Rutas abreviadas: `unit/` = `tests/unit/`, `int/` = `tests/integration/`.
Las coincidencias de `R<n>` de otras fichas en archivos compartidos (p. ej. «R32/R33» de
`addon-names.test.ts`, que son de QC-278) no cuentan.

| R | Archivo | Caso(s) |
|---|---|---|
| R1 | unit/identity/addons/company-addons.test.ts | «R1 — está en el catálogo de añadidos, al final, y isAddon lo reconoce solo con su clave exacta» |
| R1 | unit/identity/schema/whatsapp-agent-permissions-migration.test.ts | «R1: siembra en addons exactamente la clave del catalogo del codigo, que es la ultima de ADDONS»; «R1, R3: ninguna otra migracion nombra …» |
| R1, R3, R5 | int/identity/whatsapp-agent-permissions-migration.int.test.ts | «R1, R3, R5: tras las migraciones existen el añadido, los dos permisos y solo el Administrador los tiene» |
| R2 | unit/identity/addons/company-addons.test.ts | «R2 — requiere integraciones: prendido sin integraciones no es activo; con integraciones, sí» |
| R3 | unit/identity/permissions.test.ts | «R3: el catalogo contiene agente_ia.consultar y agente_ia.modificar con sus campos exactos, al final y una sola vez cada uno»; «R3: el catalogo es el previo, en el mismo orden y con los mismos campos, mas los dos del agente» |
| R3 | unit/identity/schema/whatsapp-agent-permissions-migration.test.ts | «R3: las filas de permissions son exactamente las dos entradas agente_ia de PERMISSIONS…» |
| R3, R4 | unit/identity/addons/company-addons.test.ts | «R3, R4 — sus permisos son solo suyos, no del núcleo ni de otro añadido» |
| R4 | unit/identity/addons/company-addons.test.ts | «R4 — con el añadido no activo se quitan agente_ia.consultar y agente_ia.modificar; activo, se conservan» |
| R5 | unit/identity/permissions.test.ts | «R5: el Administrador recibe los dos al final, una vez cada uno, y no figuran entre sus excluidos»; «R5: ningun rol que no sea el Administrador recibe agente_ia.consultar ni agente_ia.modificar» |
| R5 | unit/identity/schema/whatsapp-agent-permissions-migration.test.ts | «R5: la asignacion reparte los dos codigos que el seed da al Administrador, y cae si falta uno»; «R5: la asignacion va solo al Administrador, por nombre y sin heredar de otro permiso» |
| R6 | int/identity/whatsapp-agent-permissions-migration.int.test.ts | «R6: prende el agente en las empresas con integraciones prendido, también las de baja, y en ninguna otra»; «R6: aplicar el UP dos veces no duplica ni cambia nada»; «R6: el UP no pisa una excepción del agente que ya existía apagada»; «R6: el DOWN quita todas las excepciones del agente, sus permisos y su clave, y deja las demás» |
| R6 | unit/identity/schema/whatsapp-agent-permissions-migration.test.ts | «R6: las excepciones salen solo de integraciones prendido, nacen prendidas y no tocan otras filas»; «R6: los cuatro INSERT llevan ON CONFLICT ... DO NOTHING…»; «R6: el UP no toca el esquema…»; «R6: borra excepciones, asignaciones, permisos y la clave del añadido, en ese orden»; «R6: cada DELETE va acotado…»; «R6: no lleva CASCADE…» |
| R7 | unit/shared/addon-names.test.ts | «R7: nombre «Agente de IA para WhatsApp»»; «R7: descripción exacta e icono BotIcon»; «R7: hay detalle por cada añadido del catálogo…» |
| R8 | unit/integraciones/agente/whatsapp-agent-settings.test.ts | «R8 — activo false, umbral 0.6, 500 por día, 20 por contacto por hora, 12 horas y los textos exactos»; «R8 — el saludo por defecto guarda `{nombre}` literal…»; «R8 — los valores por defecto pasan el propio esquema del guardado»; «R8 — los valores por defecto no se pueden mutar» |
| R8 | unit/integraciones/agente/save-whatsapp-agent-settings.test.ts | «R8 — una empresa sin configuración guardada recibe los valores por defecto» |
| R8 | int/integraciones/whatsapp-agent-settings-prisma.int.test.ts | «R8 — una empresa sin fila lee null y el caso de uso devuelve los valores por defecto» |
| R8 | int/identity/whatsapp-agent-permissions-migration.int.test.ts | «R6, R8: la empresa con el agente prendido sigue sin configuración guardada del agente» |
| R9 | unit/integraciones/agente/save-whatsapp-agent-settings.test.ts | «R9 — sin agente_ia.consultar / sin empresa / sin actor / actor indefinido: rechaza con unauthorized y no lee» |
| R10 | unit/integraciones/agente/save-whatsapp-agent-settings.test.ts | «R10 — sin agente_ia.modificar / sin empresa / sin actor: rechaza … antes de leer la entrada y sin escribir» |
| R9, R10 | unit/integraciones/agente/whatsapp-agent-actions.test.ts | «R9, R10 — sin sesión el actor baja nulo y el `unauthorized` del caso de uso sale del catálogo»; «R9, R10, R11 — cada error de dominio se traduce…» |
| R11 | unit/integraciones/agente/whatsapp-agent-settings.test.ts | «R11 — umbral %s dentro de [0, 1] con hasta dos decimales: acepta» (0, 1, 0.6, 0.01, 0.29, 0.99); «R11 — umbral … rechaza» (1.01, -0.01, 0.655, 2, NaN, Infinity, '0.6', null) |
| R12 | unit/integraciones/agente/whatsapp-agent-settings.test.ts | «R12 — %s: 1 acepta; 0, 1.5, -3 y texto rechazan» (dailyReplyLimit, contactHourlyReplyLimit) |
| R13 | unit/integraciones/agente/whatsapp-agent-settings.test.ts | «R13 — horas de inactividad: 1 acepta; 0, 1.5, -1 y texto rechazan» |
| R14 | unit/integraciones/agente/whatsapp-agent-settings.test.ts | «R14 — handoffMessage / greetingMessage vacío, solo espacios o solo blancos rechaza; 4096 acepta y 4097 rechaza»; «R14 — el tope de 4096 se cuenta después de quitar los espacios de los extremos» |
| R14 | int/integraciones/whatsapp-agent-schema.int.test.ts | «R14: la base rechaza mensajes vacios, solo con blancos (espacio, tab, salto de linea) o de mas de 4096 caracteres y admite 4096» |
| R15 | unit/integraciones/agente/whatsapp-agent-settings.test.ts | «R15 — sin el campo X rechaza» (los siete); «R15 — `enabled` no booleano rechaza»; «R15 — sin nombre del asistente no rechaza»; «R15 — una entrada que no es un objeto rechaza» |
| R11–R15, R34, R36 | unit/integraciones/agente/save-whatsapp-agent-settings.test.ts | «R11–R15, R34, R36 — …: rechaza con invalid_input y no escribe» (diez casos); «R15 — sin un campo obligatorio rechaza y no escribe» |
| R16 | unit/integraciones/agente/save-whatsapp-agent-settings.test.ts | «R16 — reemplaza todos los campos, recorta mensajes y nombre y registra autor y fecha»; «R16 — con configuración guardada devuelve la guardada» |
| R16 | int/integraciones/whatsapp-agent-settings-prisma.int.test.ts | «R16, R34 — guardar y leer con nombre del asistente devuelve lo guardado, con autor y fecha»; «R16 — un segundo guardado reemplaza todos los campos, el autor y la fecha»; «R16 — el umbral %s vuelve exacto» |
| R16 | unit/integraciones/agente/whatsapp-agent-actions.test.ts | «R16 — guardar baja la entrada tal cual con el actor y devuelve `success`» |
| R17 | int/integraciones/whatsapp-agent-settings-prisma.int.test.ts | «R17 — guardados concurrentes de la misma empresa dejan una sola fila, con uno de los valores» |
| R17 | int/integraciones/whatsapp-agent-schema.int.test.ts | «R17: una sola fila de configuracion por empresa»; «R8 y R17: la tabla de configuracion tiene clave por empresa y ningun DEFAULT en los campos de negocio» |
| R18 | unit/integraciones/agente/save-whatsapp-agent-settings.test.ts | «R18 — lee siempre la empresa del actor»; «R18 — escribe en la empresa del actor aunque la entrada traiga otra, y no guarda esa clave» |
| R18 | int/integraciones/whatsapp-agent-settings-prisma.int.test.ts | «R18 — una empresa no lee ni pisa la configuración de otra»; «R16, R18 — el caso de uso guarda recortado en la empresa del actor aunque la entrada traiga otra» |
| R19 | int/integraciones/whatsapp-agent-schema.int.test.ts | «R19: los contactos que ya existian al migrar quedan en AGENT con motivo, fecha y autor nulos»; «R19: un contacto nuevo nace en AGENT sin motivo ni fecha» |
| R19 | int/integraciones/whatsapp-conversation-mode-prisma.int.test.ts | «R19, R28 — un contacto nuevo se lee en AGENT, sin motivo ni fecha, con su último mensaje» |
| R20 | int/integraciones/whatsapp-agent-schema.int.test.ts | «R31 y R20: la base admite HUMAN y AGENT con motivo y fecha, con usuario o sin el (el sistema)»; «R20: el autor del cambio debe ser un usuario existente» |
| R20 | int/integraciones/whatsapp-conversation-mode-prisma.int.test.ts | «R20, R22 — setMode a HUMAN cambia y guarda motivo, fecha y usuario»; «R20 — un cambio del sistema guarda el usuario nulo» |
| R20 | unit/integraciones/agente/conversation-mode-use-cases.test.ts | «R22, R20 — …»; «R24, R20 — …» |
| R21 | unit/integraciones/agente/whatsapp-conversation-mode.test.ts | «R21 — hay once motivos y dos modos…»; «R21 — HUMAN admite los diez de paso a humano…; AGENT, a mano e inactividad»; «R21 — <motivo> hacia <destino>: se admite / rechaza con ValidationError» (22); «R21 — un motivo fuera del catálogo rechaza» |
| R21 | int/integraciones/whatsapp-agent-schema.int.test.ts | «R21: la base admite en HUMAN cada motivo de paso a humano, tambien reclamo, sentimiento negativo y medio no soportado» |
| R22 | unit/integraciones/agente/conversation-mode-use-cases.test.ts | «R22, R20 — una conversación en AGENT queda en HUMAN con motivo MANUAL, la fecha actual y el usuario»; «R22 — una conversación devuelta antes al agente también pasa a HUMAN» |
| R22 | unit/integraciones/agente/whatsapp-agent-actions.test.ts | «R22 — pasar a humano baja la entrada tal cual con el actor (con sus añadidos) y devuelve `success`» |
| R22, R24, R28 | int/integraciones/whatsapp-conversation-mode-prisma.int.test.ts | «R22, R24, R28 — pasar a humano, consultar, devolver al agente y consultar otra vez» |
| R23 | unit/integraciones/agente/conversation-mode-use-cases.test.ts | «R23 — ya en HUMAN no falla y no reescribe modo, motivo, fecha ni usuario»; «R23 — si otro cambio gana la carrera entre la lectura y la escritura, no falla» |
| R23 | int/integraciones/whatsapp-conversation-mode-prisma.int.test.ts | «R23 — ya en el destino devuelve unchanged sin tocar motivo, fecha ni usuario»; «R23 — ocho cambios simultáneos al mismo destino…»; «R23 — pasar a humano dos veces a la vez no falla y deja un solo cambio» |
| R24 | unit/integraciones/agente/conversation-mode-use-cases.test.ts | «R24, R20 — una conversación en HUMAN queda en AGENT con motivo MANUAL, la fecha actual y el usuario» |
| R24 | int/integraciones/whatsapp-conversation-mode-prisma.int.test.ts | «R24 — de HUMAN a AGENT cambia con el motivo, la fecha y el usuario nuevos» |
| R24 | unit/integraciones/agente/whatsapp-agent-actions.test.ts | «R24 — devolver al agente baja la entrada tal cual con el actor y devuelve `success`» |
| R25 | unit/integraciones/agente/conversation-mode-use-cases.test.ts | «R25 — ya en AGENT (nunca cambió) no falla y no escribe»; «R25 — ya en AGENT por un cambio anterior conserva motivo, fecha y usuario de ese cambio» |
| R25 | int/integraciones/whatsapp-conversation-mode-prisma.int.test.ts | «R25 — un contacto que nunca cambió ya está en AGENT: unchanged y sigue sin motivo ni fecha» |
| R23, R25 | unit/integraciones/agente/whatsapp-conversation-mode.test.ts | «R23, R25 — ya en el destino con un motivo válido no hay cambio» |
| R26 | unit/integraciones/agente/conversation-mode-use-cases.test.ts | «R26 — <operación> <ocho actores sin acceso>: rechaza con unauthorized sin llamar al puerto» (16); «R26 — <operación>: el permiso se comprueba antes que la entrada» |
| R26, R27, R28 | unit/integraciones/agente/whatsapp-agent-actions.test.ts | «R26, R27, R28 — las acciones de modo traducen unauthorized, contacto no encontrado e invalid_input del catálogo» |
| R27 | unit/integraciones/agente/conversation-mode-use-cases.test.ts | «R27 — <operación> con <id sin forma de uuid / que no existe / de otra empresa / sin id>: whatsapp_contact_not_found y no escribe» (8); «R27 — consultar el modo con …» (4); «R27 — el contacto de otra empresa se pide con el ámbito del actor…»; «R27 — si el contacto desaparece entre la lectura y la escritura…» |
| R27 | int/integraciones/whatsapp-conversation-mode-prisma.int.test.ts | «R27 — un contacto de otra empresa no se lee ni se escribe: null y not_found»; «R27 — un id que no existe: null y not_found»; «R27 — el contacto de otra empresa responde no encontrado y queda intacto» |
| R28 | unit/integraciones/agente/conversation-mode-use-cases.test.ts | «R28 — una conversación que nunca cambió devuelve AGENT con motivo y fecha vacíos»; «R28 — devuelve el modo, el motivo y la fecha del último cambio…»; «R28 — tras pasar a humano, la consulta devuelve el cambio»; «R28 — <cinco actores sin acceso>: rechaza con unauthorized sin leer»; «R28 — con whatsapp.enviar pero sin whatsapp.consultar no se consulta…» |
| R28 | unit/integraciones/agente/whatsapp-agent-actions.test.ts | «R28 — consultar el modo devuelve `success` con modo, motivo y fecha»; «R28 — una conversación que nunca cambió sale con motivo y fecha nulos» |
| R29 | unit/integraciones/agente/whatsapp-conversation-mode.test.ts | «R29 — justo a las N horas del cambio vuelve; un milisegundo antes, no»; «R29 — la referencia es la más reciente de las dos fechas…»; «R29 — un mensaje anterior al cambio no adelanta la vuelta…»; «R29 — con solo la fecha del último mensaje, cuenta desde ella»; «R29 — las horas configuradas mandan: 1 hora y 48 horas» |
| R30 | unit/integraciones/agente/whatsapp-conversation-mode.test.ts | «R30 — una conversación en AGENT nunca vuelve, por vieja que sea»; «R30 — una conversación en HUMAN sin fecha de cambio ni de último mensaje no vuelve» |
| R31 | int/integraciones/whatsapp-agent-schema.int.test.ts | «R31: la base rechaza HUMAN sin motivo ni fecha, motivo sin fecha y fecha sin motivo»; «R31 y R20: la base admite HUMAN y AGENT con motivo y fecha…» |
| R32 | int/integraciones/whatsapp-agent-schema.int.test.ts | «R32: la tabla de configuracion tiene RLS activada y forzada, sin policies» |
| R33 | int/integraciones/whatsapp-agent-schema.int.test.ts | «R33: AGENT es un origen admitido de mensaje, ademas de USER y SYSTEM»; «R33: aplicar la migracion no cambia el origen de ningun mensaje existente» |
| R33 | unit/integraciones/whatsapp/whatsapp-message.test.ts | «R33: el dominio admite AGENT ademas de USER y SYSTEM»; «R33: el dominio y el enum del esquema tienen los mismos origenes» |
| R34 | unit/integraciones/agente/whatsapp-agent-settings.test.ts | «R34 — ausente, null, vacío o solo espacios se guarda sin nombre»; «R34 — se guarda sin los espacios de los extremos»; «R34/D15 — un nombre hecho solo de blancos (\t \n \r) se guarda sin nombre»; «R34 — 60 caracteres recortados pasan y 61 rechazan»; «R34 — un nombre que no es texto (%s) rechaza» |
| R34 | int/integraciones/whatsapp-agent-settings-prisma.int.test.ts | «R16, R34 — guardar y leer con nombre…»; «R16, R34 — guardar sin nombre del asistente lo deja nulo en la base y en la lectura» |
| R34 | int/integraciones/whatsapp-agent-schema.int.test.ts | «R34/D15: la base rechaza un nombre del asistente vacio, con blancos (espacio, \t, \n, \r) en los extremos o de 61 caracteres y admite NULL y 60» |
| R35 | unit/integraciones/agente/render-greeting.test.ts | «R35 — …con nombre «Ana»…»; «R35 — …sin nombre quita `{nombre}` con el espacio que lo precede»; «R35 — `{nombre}` al inicio…»; «R35 — `{nombre}` pegado…»; «R35 — dos `{nombre}`…»; «R35 — un saludo propio sin `{nombre}` queda igual»; «R35 — un nombre que contiene `{nombre}` no se vuelve a resolver»; «R35 — no recorta ni colapsa otros espacios del texto» |
| R36 | unit/integraciones/agente/whatsapp-agent-settings.test.ts | «R36 — un saludo que es solo `{nombre}` sin nombre rechaza»; «R36 — el mismo saludo con nombre acepta»; «R36 — un saludo de 4090 caracteres con `{nombre}` que el nombre lleva a más de 4096 rechaza» |
| R36 | unit/integraciones/agente/save-whatsapp-agent-settings.test.ts | «R11–R15, R34, R36 — …: rechaza con invalid_input y no escribe» |

**R sin test: ninguno.** Los 36 requisitos tienen al menos un caso con su `R<n>` en el nombre.

Pendiente del *Hecho* de T5.1: `./init.sh` verde no se corrió (el leader lo reserva; tampoco terminó
el `vitest related` de la tanda 4, que se paró por falta de memoria).

Veredicto: trazabilidad R1–R36 completa, sin huecos.
