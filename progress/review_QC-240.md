# QC-240 — envio-whatsapp-usuario · review

## Vuelta 1 (diff completo `origin/dev...5aabc5c6`)

MCP del grafo no consultado: la revisión se hizo con Grep/Read y `git diff`.

### Verificación ejecutada por el reviewer (salida real)

- `pnpm run typecheck` → `tsc --noEmit`, exit 0.
- `pnpm run lint` → `✖ 10 problems (0 errors, 10 warnings)`, exit 0. `eslint` sobre los `.ts` añadidos o
  modificados por el diff: sin salida, exit 0. Los 10 avisos son de archivos que el diff no toca.
- `pnpm exec vitest run guard` → `Test Files 87 passed (87)` / `Tests 1303 passed | 22 skipped (1325)`.
- Unit de la feature (15 archivos: `whatsapp/send/*`, `whatsapp-graph-client-send`, `customer-phone-links-main-phone`,
  `module-shape`, `catalogo`, `permissions`, `company-addons`, `whatsapp-send-permission-migration`,
  `integraciones-graph-doubles`) → `Test Files 15 passed (15)` / `Tests 502 passed | 1 skipped (503)`.
- Integración afectada (`whatsapp-send-flow`, `whatsapp-outbox-prisma`, `whatsapp-outbound-messages-migration`,
  `whatsapp-send-permission-migration`) → `Test Files 4 passed (4)` / `Tests 48 passed (48)`.
- No se corrió `./init.sh` ni la suite completa (lo corre `gate-completo` en CI).

### Checklist

**CHECKPOINTS.md**

- [x] `requirements.md` con R1–R48 en EARS.
- [x] `design.md` con alternativas descartadas (§12, ocho).
- [x] `tasks.md`: T1–T11 marcadas `[x]`.
- [x] `design.md` abre con `## Lo que ya existe`, con búsqueda y tabla. El diff no re-crea nada de esa lista:
  amplía `WhatsappGraphClient` (`sendMessage`) y `CustomerPhoneLinksService` (`mainPhoneOf`, `isCustomerAlive`),
  y reutiliza modelo, statuses, `contentOf`, `variableSlotsOf`, `waIdCandidates`, `decryptStoredSecret` y `templateFailureOf`.
- [x] Equipo: rama publicada (`chore(QC-240): feature tomada por usuario`).
- [x] Trazabilidad: cada R1–R48 tiene al menos un test con contenido (ver abajo). El mapa está en `progress/impl_QC-240.md`.
- [x] Typecheck y lint sin errores.
- [ ] `gate-completo` en verde: pendiente del PR (fuera del alcance del reviewer).
- [~] Flujo crítico «permisos» con E2E: la feature añade `whatsapp.enviar` y no trae E2E. Lo cubre la decisión cerrada A6
  del humano (R48): el E2E de navegador va en la ficha de Contactos. No es bloqueante; ver hallazgo 3.
- [x] Dependencias: `package.json` no cambia.
- [x] Sin secretos hardcodeados. El token se descifra en tiempo de ejecución y no se registra.
- [x] Sin webhooks nuevos.
- [x] Configuración: la URL de Graph y la versión siguen saliendo de `callGraph`/`readGraphApiVersion`. 4096 es el límite de Meta, no un valor de entorno.
- [ ] `./init.sh` y `gate-completo`: CI.
- [x] `progress/review_QC-240.md`: este archivo.
- [ ] `progress/features/QC-240.md > Cierre` y desmontar el worktree: F3, todavía no.

**docs/checkpoints-proyecto.md**

- [x] Typecheck/lint.
- [n/a] UI, multiplataforma, catálogo y pase `/design`: la feature no toca UI.
- [x] Tabla nueva con columna de empresa: no hay modelos nuevos. `whatsapp_messages` gana una columna y una FK.
  Las consultas nuevas del adaptador outbox filtran por empresa con `whatsappContactCompanyScope`/`whatsappMessageCompanyScope`/`companyScopeColumns`.
  El rechazo cruzado se prueba en `whatsapp-outbox-prisma.int.test.ts` (casos R43), `whatsapp-send-flow.int.test.ts`
  («R43: un contacto, un cliente, una plantilla o un mensaje de otra empresa…») y en la guardia de ámbito (9 métodos).
- [x] El permiso se valida en el dominio (`requireSendPermission`, primera línea de los dos casos de uso) y tiene tests
  (S/Rt «R4: …», flujo «R4: sin whatsapp.enviar…»).
- [x] RLS: no hay tabla nueva. La tabla ya tenía `ENABLE` + `FORCE`.
- [x] Acceso a datos solo por un adaptador driven de Prisma.
- [x] Las dos migraciones tienen `down.sql`. La reversibilidad se prueba (`whatsapp-outbound-messages-migration.int` R47 y `whatsapp-send-permission-migration.int` R2).
- [x] `domain/` y `ports/` sin framework ni Prisma. `whatsapp-send-recipient.ts` importa `waIdCandidates` del contrato `@/lib/modules/clientes`, con el precedente de QC-239.
- [x] Lo que viene de otro módulo entra solo por su contrato.
- [x] La Server Action pide sus dependencias a `lib/composition` y no instancia nada driven.
- [x] El `'use server'` no se reexporta desde el barrel (`index.ts` solo exporta las fábricas, el error y el tipo).
- [x] Sin carpetas nuevas en la raíz de `lib/`.
- [x] La lógica de negocio está en `domain/`. La acción solo resuelve el actor y traduce.
- [x] Mutación por Server Action.

**docs/perfil-agentes.md > reviewer**

- [x] 5. Calidad y seguridad. Sin RLS nueva necesaria y sin webhooks. Sin hardcode de contexto. Capas separadas.
  El texto de Meta no se guarda ni se devuelve: `sendFailureOf` lo ignora y `diagnosticOf` usa solo `kind`/`code`/`subcode`.
- [n/a] 6. Multiplataforma: no hay UI.
- [x] 7. Dependencias: ninguna.
- [x] 8. Aislamiento por empresa: ver arriba.
- [ ] 9. **Comentarios: FALLA** (hallazgo 1).
- [n/a] 10, 11. No hay componentes.

### Trazabilidad (muestreo con lectura del test)

Cada R1–R48 aparece en el nombre de algún caso de los tests nuevos o tensados. Leí el cuerpo de estos y las aserciones
miden lo que el requisito pide: R4 (orden de llamadas), R11 (`ensureContact` concurrente real en `.int` y en el flujo),
R14, R30 (incluido `markSent` nulo), R31, R33 (conexión `ERROR` + `lastError` leídos de la base), R38 (sin `sendMessage`
ni `touchContact`), R43 y R46 (el puerto recibe solo `messageId` y `diagnostic`). No encontré ningún test vacío.

### Desvíos del implementer

- **Fábrica `createWhatsappOutboxRepository()` en lugar del objeto inline de §5.3: justificado.** Sigue la forma de
  `createConditioningTeamRepository(db = prisma)` y del resto de los adaptadores. La guardia de ámbito lee el cableado
  desde el adaptador. Las funciones con nombre son las de §5.3 y declaran `scope`.
- **`createCustomerPhoneRepository(db = prisma)`: justificado.** La composición no importa `@/lib/shared/db/prisma`
  (comprobado con grep) y un valor por defecto es el patrón establecido. Es aditivo: los llamadores que ya pasaban `tx` no cambian.
- **c23e8705 mezcla T8 y T9**: solo afecta a la historia. No se pide reescribirla.
- Decisiones del humano (puerto de log; `markSent`/`markFailed` nulos): implementadas tal como están en `design.md` §7 y §9.

### Hallazgos

1. **BLOQUEANTE (perfil reviewer n.º 9).** Hay comentarios nuevos en código de producción que citan `QC-<n>`, `R<n>` o `design.md`:
   - `lib/modules/integraciones/ports/whatsapp-send-log.ts:2`: «(QC-240 R46, `design.md > 7`)». Y en la línea 4: «R46 solo se prueba si…».
   - `lib/modules/integraciones/adapters/driven/observability/whatsapp-send-log-console.ts:2`: «(QC-240 R46, `design.md > 7`)».
   - `lib/modules/integraciones/domain/send-whatsapp-message.ts`, comentario de `WhatsappSendOutcome`: «(`design.md > 7`)».

   Para cerrarlo hay que quitar esas citas y dejar solo el porqué, por ejemplo: «el diagnóstico de un fallo de Meta va al
   puerto de log, no en el resultado». Las tres entraron en c1a2e5da (T9). El resto de comentarios añadidos está limpio.
2. **menor.** No hay test para `markFailed` devolviendo `null`. La decisión del humano cubre los dos métodos, pero solo
   `markSent` nulo tiene caso («R30: si el mensaje ya no esta en SENDING…»). Falta el equivalente con fallo de Meta: la vista sale
   `FAILED` con su `errorReason` y la fila no se toca.
3. **menor / nota para el humano.** El flujo crítico «permisos» (`whatsapp.enviar`) queda sin E2E en esta ficha, por la decisión A6.
   Conviene apuntarlo como deuda en `Cierre`, con destino QC-245/QC-246, para que no se pierda.
4. **menor.** `ports/whatsapp-send-log.ts` abre con un bloque de 8 líneas. Es largo para un puerto de un método
   (`docs/conventions.md > Comentarios`), y se puede recortar al arreglar el hallazgo 1.

### Nota para el humano: contraste con la documentación de Meta

No pude abrir la documentación vigente de Meta en esta revisión. Lo implementado coincide con lo que conozco de la WhatsApp Cloud API:
- Cuerpo de texto: `messaging_product: 'whatsapp'`, `recipient_type: 'individual'`, `to`, `type: 'text'`, `text: { body, preview_url }`.
- Plantilla: `template: { name, language: { code }, components }`. Los componentes son `header`/`body` con `parameters: [{ type: 'text', text }]`
  y `button` con `sub_type: 'url'`, `index` como cadena y un parámetro de texto.
- Respuesta correcta: `messages[0].id` es el `wamid`.
- Códigos: `190` (token OAuth vencido o inválido), `131047` (más de 24 h desde el último mensaje del cliente), `130429` (límite de
  rendimiento de la Cloud API) y `131056` (límite por par emisor-destinatario).
- Largo máximo del texto: 4096 caracteres.

Esto no sustituye la confirmación contra la documentación oficial: queda como nota (P9 y T5 «[POR CONFIRMAR]»), no como bloqueante.

### Veredicto

**RECHAZADO.** Lo único que bloquea es el hallazgo 1 (perfil reviewer n.º 9): hay que quitar las citas a `QC-240`, `R46`
y `design.md` de los tres archivos de producción. Lo demás está bien: funcionalidad, trazabilidad, ámbito por empresa, migraciones,
verificación ejecutable y desvíos. Los hallazgos 2–4 son menores y conviene resolverlos en la misma vuelta. En la vuelta 2 basta
revisar el rango del arreglo.

## Vuelta 2 (acotada a 5fed67ee..c6573610)

Solo se revisan los hallazgos de la vuelta 1 y posibles regresiones en ese rango. El commit 42a3e419, posterior y solo con la
nota de deuda E2E, queda fuera del rango por indicación del leader.

### Verificación (salida real)

- `pnpm run typecheck` → exit 0.
- `eslint` sobre los 4 archivos de código y test tocados → `No issues found`.
- `vitest run` sobre `send-whatsapp-message.test.ts`, `whatsapp-send-log-console.test.ts` y `module-shape.test.ts` →
  `Tests 172 passed | 1 skipped (173)`.
- `pnpm exec vitest run guard` → `Test Files 87 passed (87)` / `Tests 1303 passed | 22 skipped (1325)`.

### Hallazgos de la vuelta 1

- [x] **1 (BLOQUEANTE) resuelto.** El commit 01f8fb50 quita las citas en los tres archivos: `ports/whatsapp-send-log.ts`,
  `adapters/driven/observability/whatsapp-send-log-console.ts` y el comentario de `WhatsappSendOutcome` en
  `domain/send-whatsapp-message.ts`. Los comentarios que quedan explican el porqué y no citan nada. Repetí el barrido de
  `origin/dev...c6573610` sobre `lib/` y `db/`: ninguna línea añadida cita `QC-<n>`, `R<n>`, `design.md` ni «decisión cerrada».
- [x] **2 (menor) resuelto.** c6573610 añade el caso S «R31: si el mensaje ya no esta en SENDING, markFailed no cambia nada y el
  envio igual responde con el fallo de Meta». Es un caso con contenido: Meta rechaza con 131026 y `markFailed` devuelve `null`.
  El test comprueba que la vista sale `FAILED` con `errorCode` `'131026'` y el `errorReason` traducido, que `markSent` no se llama
  y que la fila sigue en `SENDING` sin código ni motivo. Así queda cubierta la decisión del humano (design §9). La fila R31 del
  mapa en `progress/impl_QC-240.md` lo incluye.
- [x] **4 (menor) resuelto.** El bloque de `ports/whatsapp-send-log.ts` pasó de 8 a 3 líneas.
- **3 (nota):** la deuda de E2E se registra en 42a3e419, fuera del rango.

No hay regresiones en el rango.

### Veredicto vuelta 2

**OK.**
