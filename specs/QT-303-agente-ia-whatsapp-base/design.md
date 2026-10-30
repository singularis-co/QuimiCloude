# QT-303 — agente-ia-whatsapp-base · design.md

## Lo que ya existe

Buscado en el board (`feature_list.json`, todos los estados), `specs/` y el grafo del worktree con
`agente de IA`, `agente_ia`, `asistente virtual`, `bot`, `modo humano`, `paso a humano`,
`respuesta automática`, `handoff`, `conversationMode`, `autoReply`.

| Dónde | Qué apareció | Qué se hace |
|---|---|---|
| Board | QT-304…QT-310: la cadena del agente (las siguientes de esta). | Nada que duplicar: esta es la base. |
| Board | QC-119 `webhook-whatsapp-recepcion` (`cancelled`): «responder con el bot va aparte». | Solo lo menciona; nada que reutilizar. |
| Board | QC-241 `envio-whatsapp-sistema`, QC-247 notificaciones (`pending`). | Fuera de alcance; justifican el origen `AGENT` (D6). |
| `specs/` | Nada sobre agente, modo de conversación ni paso a humano. | — |
| Código | Ningún símbolo de agente, modo de conversación ni respuesta automática (`search_code` en `lib/`, `app/`, `db/`: 0 coincidencias). | Se crea. |

Se reutiliza:

- `lib/modules/identity/domain/company-addons.ts`: `ADDONS`, `ADDON_REQUIRES`, `ADDON_PERMISSIONS`,
  `effectiveAddons`, `effectivePermissions`, `assertAddon`. Con la entrada nueva, R2 y R4 salen
  solos de las funciones existentes.
- `lib/modules/identity/domain/permissions.ts`: `PERMISSIONS`, `SEED_ROLE_PERMISSIONS`.
- Patrón de migración de datos de `20261024120000_whatsapp_read_permission` y
  `20261019120100_notifications_addon` (INSERT idempotente en `permissions`, `role_permissions`,
  `addons`, y excepciones `company_addon_overrides` sembradas con `source = 'manual'` y
  `created_by` nulo = «sembrado»); patrón de tabla de una fila por empresa con FK a mano y RLS forzada de
  `20261013150000_ai_providers`.
- `lib/modules/integraciones/domain/actor.ts`: `Actor`, `requireReadPermission`,
  `requireSendPermission`; `scopeOf` de `integraciones-scope.ts`.
- Errores existentes: `ValidationError`, `UnauthorizedError`, `WhatsappContactNotFoundError`. No
  hace falta código de error nuevo en `lib/modules/errores`.
- `WhatsappContactRepository` (`ports/whatsapp-contact-repository.ts`) y su adaptador Prisma: se
  amplían, no se duplican. El patrón de `setBlocked` (`'ok' | 'not_found'`, volver a bloquear
  conserva la marca) es el que siguen pasar/devolver.
- `whatsapp_contacts.last_message_at`: ya lo mueven la entrada (`whatsapp-inbox-prisma.ts`) y la
  salida (`whatsapp-outbox-prisma.ts`) con `GREATEST`. Es la fecha del último mensaje de R29.
- `WHATSAPP_TEXT_MAX_LENGTH = 4096` de `domain/whatsapp-send-input.ts` para R14.
- UI (solo datos, ningún componente): filas `ADDON_NAMES` y `ADDON_DETAILS` de
  `components/shared/CATALOGO.md` («un añadido nuevo se añade aquí, nunca en la ruta»). La lista de
  interruptores del Maestro ya pinta cualquier añadido del catálogo: **paso 1 (reutiliza)**, sin
  componente nuevo ni cambio visual, así que no hace falta pase `/design`.

## Modelo de datos

### Migración 1 — `db/migrations/20261030120000_whatsapp_agent/` (esquema)

`migration.sql`, base con `prisma migrate diff` y completada a mano:

```sql
CREATE TYPE "whatsapp_conversation_mode" AS ENUM ('AGENT', 'HUMAN');
CREATE TYPE "whatsapp_conversation_mode_reason" AS ENUM (
  'MANUAL', 'CUSTOMER_REQUEST', 'MISSING_DATA', 'LOW_CONFIDENCE',
  'AI_ERROR', 'USAGE_LIMIT', 'USER_REPLY', 'COMPLAINT', 'NEGATIVE_SENTIMENT',
  'UNSUPPORTED_MEDIA', 'INACTIVITY');

ALTER TABLE "whatsapp_contacts"
  ADD COLUMN "conversation_mode" "whatsapp_conversation_mode" NOT NULL DEFAULT 'AGENT',
  ADD COLUMN "conversation_mode_reason" "whatsapp_conversation_mode_reason",
  ADD COLUMN "conversation_mode_changed_at" TIMESTAMPTZ(6),
  ADD COLUMN "conversation_mode_changed_by" UUID,
  ADD CONSTRAINT "whatsapp_contacts_mode_change_consistent"
    CHECK (("conversation_mode_reason" IS NULL) = ("conversation_mode_changed_at" IS NULL)),
  ADD CONSTRAINT "whatsapp_contacts_human_mode_has_reason"
    CHECK ("conversation_mode" = 'AGENT' OR "conversation_mode_reason" IS NOT NULL);
ALTER TABLE "whatsapp_contacts" ADD CONSTRAINT "whatsapp_contacts_conversation_mode_changed_by_fkey"
  FOREIGN KEY ("conversation_mode_changed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "whatsapp_contacts_conversation_mode_changed_by_idx"
  ON "whatsapp_contacts"("conversation_mode_changed_by");

CREATE TABLE "whatsapp_agent_settings" (
  "company_id" UUID NOT NULL,
  "enabled" BOOLEAN NOT NULL,
  "confidence_threshold" DECIMAL(3, 2) NOT NULL,
  "daily_reply_limit" INTEGER NOT NULL,
  "contact_hourly_reply_limit" INTEGER NOT NULL,
  "inactivity_hours" INTEGER NOT NULL,
  "handoff_message" TEXT NOT NULL,
  "greeting_message" TEXT NOT NULL,   -- plantilla: guarda `{nombre}` sin resolver
  "assistant_name" TEXT,               -- NULL = sin nombre
  "updated_by" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "whatsapp_agent_settings_pkey" PRIMARY KEY ("company_id"),
  CONSTRAINT "whatsapp_agent_settings_threshold_range" CHECK ("confidence_threshold" BETWEEN 0 AND 1),
  CONSTRAINT "whatsapp_agent_settings_limits_positive"
    CHECK ("daily_reply_limit" >= 1 AND "contact_hourly_reply_limit" >= 1 AND "inactivity_hours" >= 1),
  CONSTRAINT "whatsapp_agent_settings_messages_not_blank"
    CHECK (btrim("handoff_message", E' \t\n\r') <> '' AND btrim("greeting_message", E' \t\n\r') <> ''
       AND char_length("handoff_message") <= 4096 AND char_length("greeting_message") <= 4096),
  CONSTRAINT "whatsapp_agent_settings_assistant_name_valid"
    CHECK ("assistant_name" IS NULL
       OR (btrim("assistant_name") = "assistant_name" AND "assistant_name" <> ''
           AND char_length("assistant_name") <= 60))
);
-- FK a mano (drift, como ai_provider_connections): companies RESTRICT, users RESTRICT.
-- índice de updated_by; RLS ENABLE + FORCE al final, sin policies.

-- D6 (P1):
ALTER TYPE "whatsapp_message_origin" ADD VALUE 'AGENT';
```

- **Una por empresa (R17):** la clave primaria es `company_id`; el guardado es un `upsert`, así
  dos guardados concurrentes no crean dos filas.
- **Sin fila = defaults (R8):** la fila nace en el primer guardado. Los defaults viven **solo** en
  el dominio (`WHATSAPP_AGENT_DEFAULTS`); la tabla no lleva `DEFAULT` en los campos de negocio,
  para que no haya dos fuentes que diverjan.
- **CHECK en la base** repiten los rangos de D12 y los límites de texto de R14/R34: defensa en
  profundidad; la frontera es el zod del caso de uso. R31 solo se prueba contra la base. La
  longitud del saludo **resuelto** (R36) no se repite en la base: depende de la regla de render,
  que vive solo en el dominio.
- **Blancos en `messages_not_blank` (D15, 2026-10-30):** `btrim(x)` a secas solo quita espacios,
  y un mensaje hecho solo de `\t`, `\n` o `\r` pasaba el CHECK. Se usa `btrim(x, E' \t\n\r') <> ''`
  y no la regex `x ~ '\S'`: el conjunto de caracteres queda escrito en el CHECK y no depende de la
  clase `\S` del motor de regex ni del locale de la base. Es defensa en profundidad: la frontera
  sigue siendo el zod del caso de uso (R14). `assistant_name_valid` no cambia (ver D15 en requirements).
- **Motivo en enum** inglés, como los demás enums del esquema (`IN/OUT`, `USER/SYSTEM`). Mapeo a
  la ficha: `AGENT`=`AGENTE`, `HUMAN`=`HUMANO`; `MANUAL` vale en los dos sentidos;
  `COMPLAINT`=reclamo, `NEGATIVE_SENTIMENT`=sentimiento negativo, `UNSUPPORTED_MEDIA`=medio no
  soportado (D14, los usará QT-306). Motivos por destino (R21), en el dominio: `HUMAN` ← `MANUAL`,
  `CUSTOMER_REQUEST`, `MISSING_DATA`, `LOW_CONFIDENCE`, `AI_ERROR`, `USAGE_LIMIT`, `USER_REPLY`,
  `COMPLAINT`, `NEGATIVE_SENTIMENT`, `UNSUPPORTED_MEDIA`; `AGENT` ← `MANUAL`, `INACTIVITY`.
- **El modo vive en `whatsapp_contacts`**: es la única entidad de conversación del esquema (una
  fila por número y conexión). Las filas existentes quedan en `AGENT` con motivo y fecha nulos
  (R19, D13). El upsert de entrada (`whatsapp-inbox-prisma.ts`) no lista estas columnas, así que
  un contacto nuevo nace con el default y uno existente conserva su modo.
- `db/schema.prisma`: dos `enum` nuevos, cuatro campos en `WhatsappContact` sin `@relation` (como
  el resto del modelo), el modelo `WhatsappAgentSettings` con `/// @module integraciones` (con
  `assistantName String? @map("assistant_name")`) y el valor `AGENT` en `WhatsappMessageOrigin`
  (D6).

`down.sql`: quita la tabla, las columnas, las restricciones y los dos tipos. Postgres no permite
quitar un valor de un enum: el down recrea `whatsapp_message_origin` sin `AGENT` (renombrar tipo,
crear el nuevo, `ALTER COLUMN ... TYPE ... USING origin::text::...`, borrar el viejo), y falla a
propósito si existe algún mensaje con origen `AGENT`.

### Migración 2 — `db/migrations/20261030120100_whatsapp_agent_permissions/` (datos)

Como `20261024120000_whatsapp_read_permission` y `20261019120100_notifications_addon`:

```sql
-- 1. Catálogo (forma que lee guard-catalogo-de-anadidos).
INSERT INTO "addons" ("key") VALUES ('agente_ia_whatsapp') ON CONFLICT ("key") DO NOTHING;
-- 2. Permisos y rol Administrador (D8): INSERT ... ON CONFLICT DO NOTHING, como QC-263.
-- 3. D9: las empresas existentes con `integraciones` prendido (también las de baja) nacen con el
--    agente prendido; las demás, sin excepción, o sea apagadas. Autor vacío = sembrado.
INSERT INTO "company_addon_overrides" ("company_id", "addon_key", "enabled", "source")
SELECT o."company_id", 'agente_ia_whatsapp', true, 'manual'
FROM "company_addon_overrides" AS o
WHERE o."addon_key" = 'integraciones' AND o."enabled"
ON CONFLICT ("company_id", "addon_key") DO NOTHING;
```

**Por qué una excepción y nada en `plan_addons`.** Hoy «prendido» se lee **solo** de
`company_addon_overrides` con `enabled = true` (`session-user-prisma.ts`, `company-prisma.ts`,
`company-addons-prisma.ts`); `plan_addons` existe (QC-182) pero ninguna lectura lo usa: la regla
«plan + excepciones» es de QC-188. Por tanto «`integraciones` efectivo, por plan o excepción» es
hoy exactamente «tiene la excepción de `integraciones` prendida», y como `integraciones` no
requiere nada, prendida es efectiva. La excepción sembrada:

- usa la misma forma que el precedente de `notificaciones` (`source = 'manual'`, `created_by`
  nulo), así que la pantalla del Maestro (QC-278) la muestra y la deja apagar como cualquier otra;
- respeta `ADDON_REQUIRES`: solo se siembra donde `integraciones` está prendido, y si después se
  apaga `integraciones`, `effectiveAddons` apaga el agente (R2) sin tocar la excepción;
- es idempotente (`ON CONFLICT DO NOTHING`) y no toca ninguna fila existente (R6);
- seguirá valiendo cuando QC-188 sume los módulos del plan: una excepción prendida suma.

No se escribe `company_events`: el precedente de `notificaciones` tampoco lo hace al sembrar.

La configuración del agente **no** se siembra: con el añadido prendido, la empresa lee los
defaults del dominio, con activo = `false` (R8, D9), así que nada responde hasta que la prenda.

Empresas nuevas: el alta del Maestro no crea excepciones (nace con todo apagado) y el acceso
inicial fuera de producción (`initial-access-repository-prisma.ts`) prende todo `ADDONS`, que
incluirá `agente_ia_whatsapp` junto con `integraciones`. Las dos cosas ya son coherentes con D9 y
no se tocan.

`down.sql`, en orden inverso: borra las excepciones de `agente_ia_whatsapp` (todas: la FK
`addon_key → addons` impide borrar la clave del catálogo con filas colgando, y antes de la
migración no podía existir ninguna), luego `role_permissions`, `permissions` y `addons`.

## Identity (código)

- `company-addons.ts`: `ADDONS` gana `'agente_ia_whatsapp'` al final;
  `ADDON_REQUIRES.agente_ia_whatsapp = ['integraciones']`;
  `ADDON_PERMISSIONS.agente_ia_whatsapp = ['agente_ia.consultar', 'agente_ia.modificar']`.
- `permissions.ts`: dos entradas en `PERMISSIONS` (`module: 'agente_ia'`, descripciones de R3) y
  las dos en `SEED_ROLE_PERMISSIONS[ROLE_ADMINISTRADOR]` (D8). Forma `<modulo>.<accion>` verificada
  en el catálogo. No entran en `CORE_PERMISSIONS` (son de un añadido).
- `lib/shared/ui/addon-names.ts` y `addon-details.ts`: entrada nueva con los textos e icono de D10. Los `Record` obligan a
  ello por typecheck. Las filas de `CATALOGO.md` pasan de «los cinco» a «los seis añadidos».

## Integraciones — dominio

Archivos nuevos en `lib/modules/integraciones/domain/`:

- `whatsapp-agent-settings.ts`: tipo `WhatsappAgentSettings` (con
  `assistantName: string | null`), `WHATSAPP_AGENT_DEFAULTS` (R8, D11: `assistantName: null` y el
  saludo **plantilla** con `{nombre}`), `WHATSAPP_ASSISTANT_NAME_MAX_LENGTH = 60` (supuesto, ver
  R34), `GREETING_NAME_PLACEHOLDER = '{nombre}'` y el esquema zod `saveWhatsappAgentSettingsSchema`
  (R11–R15, R34, R36): `enabled: z.boolean()`,
  `confidenceThreshold: z.number().min(0).max(1)` + refinamiento de dos decimales
  (`Math.round(x*100) === x*100` con tolerancia de coma flotante), enteros `z.number().int().min(1)`,
  mensajes `z.string().trim().min(1).max(WHATSAPP_TEXT_MAX_LENGTH)`,
  `assistantName: z.string().nullable().optional()` transformado con `trim()` y `'' → null`, luego
  `max(60)`; y un `superRefine` del objeto que rechaza si
  `renderGreeting(greetingMessage, assistantName)` queda en blanco o pasa de 4096 (R36).
- `renderGreeting(template, assistantName)` (pura, en el mismo archivo; R35):
  - con nombre: `template.split('{nombre}').join(name)`. Una sola pasada: un `{nombre}` dentro del
    nombre no se vuelve a resolver.
  - sin nombre (`null`, o vacío tras recortar): `template.replace(/ \{nombre\}|\{nombre\} ?/g, '')`,
    o sea quita cada `{nombre}` con el espacio que lo precede o, si no lo hay, con el que lo sigue.
  - No toca nada más del texto (ni recorta, ni colapsa otros espacios).
  - La guarda en la base es la **plantilla**; quien envía (QT-307) llama a `renderGreeting` con la
    configuración. Así, cambiar el nombre no obliga a reescribir el saludo.
- `get-whatsapp-agent-settings.ts` / `save-whatsapp-agent-settings.ts`: fábricas
  `createGet…`/`createSave…` con `(input, actor)`. Primera línea, el permiso
  (`agente_ia.consultar` / `agente_ia.modificar`) y la empresa vía helpers nuevos en `actor.ts`
  (`requireAgentReadPermission`, `requireAgentConfigurePermission`); el añadido no se comprueba
  aparte porque el permiso ya llega quitado si está apagado (mismo criterio que
  `requireSendPermission`). Inválido → `ValidationError`.
- `whatsapp-conversation-mode.ts` (puro, sin puertos):
  - `ConversationMode = 'AGENT' | 'HUMAN'`, `ConversationModeReason`, `REASONS_BY_TARGET`.
  - `planModeChange(current, target, reason)` → `'unchanged' | 'change'`; lanza `ValidationError`
    si el motivo no vale para el destino (R21).
  - `isDueForAgentReturn({ mode, modeChangedAt, lastMessageAt }, inactivityHours, now)` → boolean
    (R29, R30). Referencia = máximo de las dos fechas no nulas; `now - ref >= horas * 3_600_000`.
    No lee configuración ni base: QT-307 le pasa `inactivityHours` de la configuración.
- `hand-off-whatsapp-conversation.ts`, `return-whatsapp-conversation-to-agent.ts`: actor →
  `requireAgentOperatePermission` (nuevo en `actor.ts`: `whatsapp.enviar` + `assertAddon(actor,
  'agente_ia_whatsapp')` + empresa, D7) → zod `{ contactId: uuid }` (no uuid → no encontrado, como
  `contactInputError`) → `planModeChange` → `contacts.setMode(...)`. `'not_found'` →
  `WhatsappContactNotFoundError` (R27).
- `get-whatsapp-conversation-mode.ts`: `whatsapp.consultar` + añadido activo (D7) →
  `contacts.findMode(id, scope)` (R28).

### Puerto

`ports/whatsapp-contact-repository.ts` gana:

```ts
export type ConversationModeState = {
  readonly mode: ConversationMode;
  readonly reason: ConversationModeReason | null;
  readonly changedAt: Date | null;
  readonly lastMessageAt: Date | null;
};
export type ConversationModeChange = {
  readonly mode: ConversationMode; readonly reason: ConversationModeReason;
  readonly at: Date; readonly by: string | null;   // null = el sistema (QT-307)
};
findMode(id: string, scope: IntegracionesScope): Promise<ConversationModeState | null>;
/** Solo escribe si el modo actual es distinto del de destino; si ya lo es, no toca nada. */
setMode(id: string, change: ConversationModeChange, scope: IntegracionesScope):
  Promise<'changed' | 'unchanged' | 'not_found'>;
```

`setMode` es un `UPDATE ... WHERE id AND company_id AND conversation_mode <> $mode` y, si no
actualiza filas, un `SELECT` para distinguir `unchanged` de `not_found`. Así R23/R25 se cumplen
también con dos clics concurrentes: el segundo no pisa motivo ni fecha.

Puerto nuevo `ports/whatsapp-agent-settings-repository.ts`:

```ts
find(scope): Promise<WhatsappAgentSettings | null>;
save(settings: WhatsappAgentSettings, by: string, scope): Promise<void>; // upsert por company_id
```

## Adaptadores

- `adapters/driven/persistence/whatsapp-agent-settings-prisma.ts`: `upsert` por `companyId`;
  `confidenceThreshold` sale de `Decimal` a `number` con `toNumber()` (dos decimales, sin pérdida).
- `adapters/driven/persistence/whatsapp-contact-prisma.ts`: `findMode`, `setMode`, filtrando
  siempre por `company_id`.
- `adapters/driving/whatsapp-agent-actions.ts` (`'use server'`, objeto y no `FormData`, mismo
  `currentActor` con `addons` que `whatsapp-contact-actions.ts`): `getWhatsappAgentSettingsAction`,
  `saveWhatsappAgentSettingsAction`, `handOffWhatsappConversationAction`,
  `returnWhatsappConversationToAgentAction`, `getWhatsappConversationModeAction`. No revalidan
  rutas: aún no hay pantalla (QT-308).
- `lib/composition/index.ts`: ata el repositorio de configuración y añade los cinco casos de uso a
  la fachada `integraciones`.
- `lib/modules/integraciones/index.ts`: reexporta los tipos, `WHATSAPP_AGENT_DEFAULTS`,
  `renderGreeting` e `isDueForAgentReturn` para QT-306/QT-307.

## Contratos

| Acción | Entrada | Salida | Errores |
|---|---|---|---|
| `getWhatsappAgentSettingsAction()` | — | `{ status: 'success', settings }` | `unauthorized` |
| `saveWhatsappAgentSettingsAction(input)` | `{ enabled, confidenceThreshold, dailyReplyLimit, contactHourlyReplyLimit, inactivityHours, handoffMessage, greetingMessage, assistantName? }` (`assistantName`: texto, `null` o ausente) | `{ status: 'success' }` | `unauthorized`, `invalid_input` |
| `handOffWhatsappConversationAction({ contactId })` | uuid | `{ status: 'success' }` (también si ya estaba en HUMANO) | `unauthorized`, `whatsapp_contact_not_found`, `invalid_input` |
| `returnWhatsappConversationToAgentAction({ contactId })` | uuid | ídem | ídem |
| `getWhatsappConversationModeAction({ contactId })` | uuid | `{ status: 'success', mode, reason, changedAt }` | `unauthorized`, `whatsapp_contact_not_found` |

## Autorización y RLS

- La frontera es el caso de uso (`docs/architecture.md > Acceso a datos y autorizacion`): permiso
  y empresa antes de validar la entrada y de tocar un puerto. La empresa sale del actor (R18).
- `whatsapp_agent_settings`: RLS `ENABLE` + `FORCE`, sin policies (R32). `whatsapp_contacts` ya
  la tiene.

## Alternativas descartadas

1. **Columnas de configuración en `companies`.** `companies` es de `identity`; la configuración
   es de `integraciones` y solo existe con el añadido. Mezclarla rompe la propiedad de modelos
   (`/// @module`) y obligaría a `integraciones` a escribir en un modelo ajeno.
2. **Sembrar una fila de configuración por empresa** (en la migración y al dar de alta una
   empresa). Toca el alta de empresas de `identity` y duplica los defaults en SQL. Sin fila =
   defaults del dominio es una sola fuente y no toca otro módulo.
3. **Tabla aparte de historial de cambios de modo.** La ficha pide «motivo y fecha del último
   cambio», no historial. El registro por turno (herramientas, motivo) es de QT-307. Se puede
   añadir después sin migrar los datos actuales.
4. **Motivo como texto libre** (como `CompanyEvent.kind`). Pierde la validación por destino de
   R21 en la base y deja escribir motivos que la UI de QT-308 no sabe pintar. Un valor nuevo es
   un `ALTER TYPE ... ADD VALUE`, barato.
5. **Una tabla `whatsapp_conversations` aparte del contacto.** Hoy contacto y conversación son
   uno a uno (único por `connection_id, wa_id`); una tabla nueva solo añadiría un join.
6. **D9 por `plan_addons`: añadir `agente_ia_whatsapp` a cada plan que ya incluye
   `integraciones`** (sola o junto con la excepción). Descartada: (a) hoy ninguna lectura de
   «prendido» usa `plan_addons` (la suma plan + excepciones es de QC-188), así que no prendería el
   agente en ninguna empresa y D9 no se cumpliría; (b) cambiar la composición de un plan es una
   decisión comercial (el plan tiene precio) que D9 no toma; (c) si QC-188 llega a leer los
   planes, la excepción sembrada sigue prendiendo el agente sin depender de ellos.
7. **D9 en código: que `effectiveAddons` prenda `agente_ia_whatsapp` cuando `integraciones` lo
   está.** Descartada: rompe la regla «nunca añade nada» de `effectiveAddons`/`effectivePermissions`
   y dejaría el agente imposible de apagar desde el Maestro sin apagar `integraciones`.
8. **Guardar el saludo ya resuelto con el nombre.** Descartada: cambiar el nombre del asistente
   obligaría a reescribir el saludo, y con nombre vacío se perdería dónde volver a ponerlo. Se
   guarda la plantilla y se resuelve al usarla (R35).

## Dependencias

Ninguna nueva: zod, Prisma y `lucide-react` (`BotIcon`) ya están aprobados.

## Riesgos

- `app/(private)/clientes/contactos/components/chat-view.ts` no sabe pintar un
  mensaje `AGENT`; nadie lo escribe hasta QT-307, y su texto es de QT-308.
- QT-306 debe incluir «asesor» en su lista de palabras de pedir asesor: el saludo por defecto la
  anuncia (D11).
- Con D9, las empresas con `integraciones` ven el agente prendido en el Maestro desde la
  migración; no responde nada mientras su configuración siga en activo = `false` (R8).
- `addon-off-consequences.ts` (Maestro) no avisa de que apagar `integraciones` apaga el agente;
  queda para QT-308 (no se toca aquí).
