# Review QT-303 — agente-ia-whatsapp-base

## Vuelta 1 (origin/dev..d1b0f03a0)

Revisado contra `specs/QT-303-agente-ia-whatsapp-base/{requirements,design,tasks}.md`,
`progress/impl_QT-303.md`, `CHECKPOINTS.md`, `docs/checkpoints-proyecto.md` y
`docs/perfil-agentes.md > reviewer` (puntos 5–11). El MCP del grafo no se usó: bastaron Grep/Read
sobre un diff acotado.

### Verificación ejecutada por el reviewer

| Qué | Resultado |
|---|---|
| `pnpm run typecheck` | verde |
| `pnpm exec eslint` sobre los `.ts/.tsx` del diff | verde, 0 avisos |
| `pnpm exec vitest run guard` | 87 archivos, 1327 verdes, 22 omitidos, 0 rojos |
| unit/ui/guards del diff (27 archivos) | **3 rojos** en `tests/unit/integraciones/module-shape.test.ts` (ver B1) |
| `tests/unit/{identity,integraciones,maestro,composition,integraciones-ui,clientes-ui}` + `tests/ui/maestro` (311 archivos) | los mismos 3 rojos de B1. `session-once-per-request-render.test.tsx` se cortó por timeout del hook con la máquina cargada; corrido solo, 13/13 verdes: no es hallazgo |
| `.int` del diff (5 archivos, base efímera con todas las migraciones) | 66/66 verdes. Cubre UP, DOWN, ida y vuelta, idempotencia del UP de datos y DOWN parado por un mensaje `AGENT` |
| `tests/baseline-rojos.json` | `module-shape.test.ts` **no** está: los 3 rojos son nuevos |

### Checklist

**Especificación**
- [x] `requirements.md` con R1–R36 en EARS, sin preguntas abiertas.
- [x] `design.md` con 8 alternativas descartadas y su porqué.
- [x] `tasks.md`: 34 tareas, todas `[x]`.
- [x] `design.md` abre con `## Lo que ya existe`. El diff reutiliza `ADDONS`/`ADDON_REQUIRES`/`effectiveAddons`/`assertAddon`, `WhatsappContactRepository`, `WHATSAPP_TEXT_MAX_LENGTH`, `contactInputError` y `ADDON_NAMES`/`ADDON_DETAILS`; no re-crea nada de la lista.

**Equipo**
- [x] Feature tomada (`498a4dac9`, `progress/features/QT-303.md`).

**Trazabilidad**
- [x] Mapa R→test en `progress/impl_QT-303.md > T5.1`. Comprobé contra los tests reales R6, R17, R18, R21, R23, R26, R27, R31–R34: son casos con aserciones de verdad, no vacíos. Ejemplos: R26 recorre ocho actores sin acceso (`conversation-mode-use-cases.test.ts:145-170`) y comprueba que el puerto no se llama; R23 lanza ocho `setMode` a la vez contra Postgres (`whatsapp-conversation-mode-prisma.int.test.ts:230`); R27 prueba la otra empresa en el puerto y en el caso de uso (`:249`, `:296`).
- [x] Ningún R sin test.

**Calidad de código**
- [x] typecheck y lint verdes.
- [ ] **Suite sin rojos nuevos: NO.** Hay 3 rojos nuevos (B1); `gate-completo` saldrá rojo.
- [~] E2E de un flujo crítico (permisos): no hay ninguno nuevo; ver m3.
- [x] Sin dependencias nuevas (`package.json` no cambia; `BotIcon` sale de `lucide-react`, que ya estaba).
- [x] `CATALOGO.md`: las filas de `ADDON_NAMES`/`ADDON_DETAILS` pasan a «seis añadidos». Es un cambio de datos, no de pieza, así que no pide `/design`.

**Seguridad / Configuración**
- [x] Sin secretos. No hay webhook nuevo.
- [x] Los valores por defecto del negocio viven en el dominio (`WHATSAPP_AGENT_DEFAULTS`) y no cambian entre entornos.

**Datos y seguridad**
- [x] `whatsapp_agent_settings` lleva `company_id` como PK y FK a `companies`; el guard de empresa en el esquema está verde.
- [x] RLS `ENABLE` + `FORCE` (`20261030120000_whatsapp_agent/migration.sql:62-63`), probado (R32).
- [x] Aislamiento en el adaptador: `findWhatsappContactMode`/`setWhatsappContactMode` filtran por `whatsappContactCompanyScope(scope)` en el UPDATE y en el SELECT de desempate (`whatsapp-contact-prisma.ts:90-131`). La configuración usa `companyScopeColumns(scope)` en `findUnique` y en el `upsert`, y en `create` (`whatsapp-agent-settings-prisma.ts:55-78`). Hay test del rechazo cruzado en unit y en `.int`.
- [x] Permisos en el caso de uso: D7 con `requireAgentOperatePermission` (`whatsapp.enviar` + `assertAddon('agente_ia_whatsapp')`) y `requireAgentModeReadPermission` (`whatsapp.consultar` + añadido). Ambos se comprueban antes de parsear la entrada. D8: el seed y la migración dan los dos permisos solo al Administrador, y el Maestro no los recibe. `sessionUser.addons` sale de `effectiveAddons`, así que R2 se cumple también en las acciones.
- [x] Sin cliente de Supabase. Todo pasa por adaptadores `driven` de Prisma.
- [x] Las dos migraciones tienen `down.sql`. El DOWN del esquema recrea el enum sin `AGENT` y se para si existe un mensaje `AGENT` (probado). El UP de datos es idempotente: los cuatro `INSERT ... ON CONFLICT DO NOTHING` están probados aplicándolo dos veces, y el UP no pisa una excepción del agente que ya existía apagada. Los CHECK de D15 usan `btrim(x, E' \t\n\r')`. El zod recorta un superconjunto de esos blancos (`String.prototype.trim`), así que nada que pase el zod choca con la base.
- [x] Concurrencia de `setMode`: es un `UPDATE ... WHERE conversation_mode <> $destino`. En READ COMMITTED, el segundo UPDATE espera el bloqueo de fila y vuelve a evaluar el WHERE sobre la versión nueva, así que cuenta 0 filas y el `SELECT` posterior devuelve `unchanged`. Está probado con 8 llamadas simultáneas y con dos `handOff` a la vez sobre Postgres.

**Módulos hexagonales**
- [x] `domain/` y `ports/` solo importan zod y contratos de otros módulos (`@/lib/modules/identity`, `clientes`).
- [x] La acción `'use server'` no se reexporta desde el barrel, y la composición ata el adaptador.
- [x] El modelo nuevo lleva `/// @module integraciones`.
- [x] La lógica vive en el dominio (`planModeChange`, `isDueForAgentReturn`, `renderGreeting`, el esquema); las acciones solo traducen.

**Reglas del proyecto (perfil reviewer 5–11)**
- [x] 5 Calidad/seguridad: RLS, sin hardcode de empresa y capas separadas.
- [x] 6 Multiplataforma: no hay UI.
- [x] 7 Dependencias: ninguna.
- [x] 8 Aislamiento: ver arriba.
- [x] 9 Comentarios: ninguna línea añadida en producción (`lib/`, `app/`, `components/`, `db/`) cita `QC-`, `QT-`, `R<n>`, `D<n>`, `design.md` ni «decisión cerrada» (grep sobre el diff).
- [x] 10 Duplicados / 11 Diseño: no hay componentes nuevos.

### Hallazgos

**BLOQUEANTE**

- **B1 — Una lista escrita a mano sin actualizar deja 3 rojos nuevos en `tests/unit/integraciones/module-shape.test.ts`.**
  El archivo no está en `tests/baseline-rojos.json`, así que `gate-completo` saldrá rojo y la regla 5 impide mergear. En `progress/impl_QT-303.md:322-323` se razonó que «`module-shape.test.ts` no cambia: no hay modelo nuevo», pero ese archivo también fija con igualdad exacta:
  - `:449` R20, las reexportaciones del barrel `lib/modules/integraciones/index.ts`. Faltan `AgentReturnCandidate`, `CONVERSATION_MODES`, `CONVERSATION_MODE_REASONS`, `ConversationMode`, `ConversationModeInput`, `ConversationModeReason`, `ConversationModeView`, `GREETING_NAME_PLACEHOLDER`, `REASONS_BY_TARGET`, `SaveWhatsappAgentSettingsInput`, `WHATSAPP_AGENT_DEFAULTS`, `WHATSAPP_ASSISTANT_NAME_MAX_LENGTH`, `WhatsappAgentSettings`, `isDueForAgentReturn`, `planModeChange`, `renderGreeting` y las cinco fábricas `create*`.
  - `:646` R18, los archivos del módulo. Faltan los 12 nuevos: `whatsapp-agent-settings-prisma.ts`, `whatsapp-agent-actions.ts`, los 7 de `domain/` y `ports/whatsapp-agent-settings-repository.ts`.
  - `:811` R19, las claves de la fachada `integraciones` en `lib/composition`. Faltan `getWhatsappAgentSettings`, `saveWhatsappAgentSettings`, `handOffWhatsappConversation`, `returnWhatsappConversationToAgent` y `getWhatsappConversationMode`.

  **Qué falta:** añadir esas entradas a las tres listas esperadas y ajustar los títulos de los `it`, como se hizo con R13 en el mismo archivo. Después correr `pnpm exec vitest run tests/unit/integraciones/module-shape.test.ts` en verde y dejar su salida en la bitácora. Conviene buscar otras listas exactas del mismo tipo con `vitest related` sobre `lib/modules/integraciones/index.ts` y `lib/composition/index.ts`, por partes si la memoria no da. Yo corrí `tests/unit/{identity,integraciones,maestro,composition}` y las guardias completas, y no aparecieron más.

**menor**

- **m1 — `db/migrations/20261030120100_whatsapp_agent_permissions/down.sql:6`.** El `DELETE FROM "addons"` falla con la FK RESTRICT de `plan_addons_addon_key_fkey` (`20261028120000_plans/migration.sql:36`) si algún plan llegó a incluir `agente_ia_whatsapp`. El DOWN no borra filas de `plan_addons`. Falla ruidosamente y sin perder datos, pero el rollback deja de ser automático. Se arregla con un `DELETE FROM "plan_addons" WHERE "addon_key" = 'agente_ia_whatsapp'` antes de borrar la clave, o al menos dejándolo anotado.
- **m2 — Diferencia entre `design.md` y el código en el puerto de configuración.** El design (`## Integraciones — dominio > Puerto`) firma `save(settings, by, scope)`. El código firma `save(settings, by, at, scope)` (`ports/whatsapp-agent-settings-repository.ts:11`), que es mejor porque el dominio inyecta la fecha. Falta alinear el design.
- **m3 — Ningún E2E cubre los permisos nuevos (flujo crítico «permisos», `CHECKPOINTS.md > Calidad de código`).** Está justificado porque no hay pantalla hasta QT-308 y la frontera está probada en unit y `.int`. Aun así, conviene anotarlo en `progress/features/QT-303.md > Cierre` o en `progress/deudas.md` como cubierto por QT-308, para que no se pierda.
- **m4 (informativo) — `tests/integration/aislamiento.json`.** Los `motivo` nuevos citan «QT-303 T3.3 (R16…)». Es un archivo de test, así que no aplica la regla 9; solo se anota por consistencia con las entradas vecinas.

### Veredicto

**RECHAZADO**: 1 bloqueante (B1), 0 mayores y 4 menores.

Lo que falta para OK: actualizar las tres listas exactas de `tests/unit/integraciones/module-shape.test.ts` (R18 `:646`, R19 `:811`, R20 `:449`) con los archivos, las claves de la fachada y las reexportaciones nuevas, dejar ese archivo en verde y anotar la salida en `progress/impl_QT-303.md`. La vuelta 2 puede acotarse a ese diff. Los menores no bloquean.
