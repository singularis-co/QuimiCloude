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
