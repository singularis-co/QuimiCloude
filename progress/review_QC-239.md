# review QC-239 — vincular-whatsapp-con-clientes

Reviewer, 2026-10-20. Vuelta 1. Rama `feature/QC-239-vincular-whatsapp-con-clientes`, HEAD `4a7c0e45`,
base `origin/dev`. El MCP del grafo no se usó: este worktree no está indexado (design § Lo que ya
existe lo dice). Todo se hizo con Grep/Read.

## Verificación ejecutada (en serie, por decisión del humano no se corrió `./init.sh` ni la suite)

| Comando | Resultado |
|---|---|
| `pnpm run typecheck` | sin errores |
| `pnpm run lint` | 0 errores, 10 avisos (todos en archivos que el diff no toca) |
| `pnpm exec vitest run guard` | 83 archivos, 1199 passed, 21 skipped |
| `vitest run tests/unit/clientes tests/unit/integraciones tests/unit/errores tests/unit/identity/session-once-per-request-actions.test.ts` | **1 failed** / 1642 passed: `tests/unit/integraciones/encryption-keys-env.test.ts` |
| `vitest run tests/unit/composition` | **1 failed** / 69 passed: `tests/unit/composition/integraciones-graph-doubles.test.ts` |
| `vitest run tests/ui/clientes` | 37 passed |
| `.int`: `whatsapp-contact-links`, `customer-phone-numbers` | 41 passed |
| `.int`: `whatsapp-inbox-prisma`, `whatsapp-webhook-route`, `whatsapp-messages-constraints`, `legacy-phone-backfill`, `customer-phone-numbers-migration`, `customer-phone-shared` | 87 passed |
| `.int` ajustados: `customers-migration`, `whatsapp-messages-migration`, `customers-phone-migration`, `customer-repository`, `list-query-customers` | 37 passed |
| `.int` de otras migraciones con DOWN/UP sobre tablas que esta migración referencia (`customers-search-migration`, `whatsapp-connection-migration`, `order-delivery-lines-customer-migration`, `direct-deliveries-migration`, `orders-customer-constraints`, `ai-provider-migration`, `pedidos/company-scope`) | 49 passed |
| `.int` y unit sin tocar del área (`customers-constraints`, `whatsapp-webhook-route.test`, `clientes-ui/customer-form.test`) | 60 passed |

`tests/baseline-rojos.json` está vacío (`"archivos": {}`): los dos rojos no son deuda heredada.

## Checklist

### CHECKPOINTS.md
- [x] `requirements.md` con R1–R49 en EARS.
- [x] `design.md` con alternativas descartadas (§ 14, once).
- [ ] Todas las tasks en `[x]`: T11 y T12 sin marcar. **No se cuenta como hallazgo del código**
  (instrucción del leader): T12 espera el gate de CI por decisión del humano y T11, una base con la
  migración aplicada.
- [x] `## Lo que ya existe` presente y con búsqueda real; el diff no re-crea nada de esa lista
  (reutiliza `phoneMatchesWaId`, la transacción de QC-238 y la forma de la unidad de trabajo de `pedidos`).
- [x] Equipo: rama del candado (`chore(QC-239): feature tomada por usuario`).
- [x] Trazabilidad: `progress/impl_QC-239.md` tiene el mapa R1–R49. R14, indirecto (ver m1).
- [x] Typecheck. [x] Lint.
- [ ] `gate-completo` en verde: **saldría rojo** por B1.
- [~] Flujo crítico (webhooks, permisos) con E2E: design § 12.3 declara «sin E2E nuevo», con el
  webhook cubierto por `whatsapp-webhook-route.int.test.ts` sobre la composición, como en QC-238. Ver m5.
- [x] Sin dependencias nuevas (`package.json` no cambia).
- [x] Sin secretos ni hardcode de entorno. El webhook conserva firma e idempotencia (`skipDuplicates`, `ON CONFLICT`).
- [ ] `./init.sh` y `gate-completo`: pendientes de CI (decisión del humano).

### docs/checkpoints-proyecto.md
- [x] La UI solo pierde un `case` del formulario; no hay cambio visual ni componente nuevo. No aplican la regla multiplataforma, el catálogo ni `/design`.
- [x] Las dos tablas nuevas llevan `company_id`; toda consulta nueva filtra por empresa (envolturas
  `phoneNumberCompanyScope`, `customerPhoneNumberCompanyScope`, `whatsappContactCompanyScope`) y
  tiene test de acceso cruzado (cpn R45, links R45, cons R47).
- [x] Permiso validado en `domain/` como primera línea (`requireCustomerLinkPermission`, `requirePermission`), con tests (auth, lnk/unl/blk con Proxy).
- [x] RLS `ENABLE` + `FORCE` en `phone_numbers` y `customer_phone_numbers`.
- [x] Sin cliente de Supabase para datos.
- [x] Migración con `down.sql`; UP→DOWN→UP probado en `customer-phone-numbers-migration.int`.
- [x] Capas: `domain/` y `ports/` sin framework; de otro módulo solo el barrel (`integraciones` → `@/lib/modules/clientes`); el driving pide a `lib/composition`; `'use server'` fuera del barrel; modelos con `/// @module clientes`.
- [x] La lógica está en `domain/` (regla, `syncMainPhone`, vincular y desvincular); las Server Actions solo resuelven el actor y traducen el error.
- [x] Mutaciones por Server Actions.

### docs/perfil-agentes.md > reviewer (5–11)
- [x] 5 Calidad y seguridad: RLS, idempotencia del webhook, capas, sin hardcode.
- [x] 6 Multiplataforma: no aplica.
- [x] 7 Dependencias: ninguna.
- [x] 8 Aislamiento: columnas de empresa, FK compuestas (R47) y rechazo cruzado probado.
- [x] 9 Comentarios: ninguna línea de producción añadida cita `QC-<n>`, `R<n>`, `design.md` ni
  «decisión cerrada» (grep sobre `lib app db scripts` del diff: vacío).
- [x] 10 y 11: no hay componentes nuevos.

### Puntos que el implementer marcó
- **Guardia de integraciones cambiada en T8 fuera de § 12.3:** la reviso. Tensa y no relaja nada.
  - El inbox se lee de su fábrica `createWhatsappInboxRecorder(deps: WhatsappInboxRecorderDeps)`.
  - `findBlockedWaIds` entra en los ayudantes vigilados.
  - `lib/composition` tiene que construir el puerto con esa fábrica y no puede nombrar `recordWhatsappInbound`.
  - Los casos de sensibilidad son reales: pérdida del ámbito, `deps` no primero, cuerpo en el miembro, firma distinta y consulta dentro de la fábrica.
  - Solo falta reflejarlo en design § 12.3 (m2).
- **Dos exenciones estrictas:** confirmado. Cada una acepta solo una función con su nombre
  (`withCustomerTransaction` / `withWhatsappContactTransaction`), todo `prisma.` debe ser
  `prisma.$transaction`, ningún `tx.`/`db.`, sin SQL crudo ni alias de `prisma`. Los casos de
  sensibilidad prueban cada caída con fuentes sintéticos que fallan, y un control con la forma
  aprobada y con el fuente real. La exención es por nombre: una copia con otro nombre pasa por el
  barrido general y cae. Las listas están cerradas: una entrada en `clientes` y dos en
  `integraciones`, con nota fechada. Hay una laguna teórica: un alias local (`const t = tx`) no se
  detecta. Es la misma forma que QC-141 D21, así que no es hallazgo.
- **R14 indirecto:** ver m1.
- **Detector de choque duplicado:** ver m3.
- **`customer_not_found` sin customerId; barrel con los tres errores; `parseWaIdPhone` MX sin 1 y BR con 9:**
  - Los tres son coherentes con el spec: un id ausente no tiene forma de uuid (design § 6.3).
  - Exportar los errores es necesario para el traductor y para los tests.
  - La forma normalizada es la misma que guarda el formulario (R28), y `phoneMatchesWaId` la sigue reconociendo (lo prueba R29 en links).
  - No son hallazgos.
- **Tests ajenos ajustados:**
  - `customers-migration.int` y `whatsapp-messages-migration.int` reaplican las migraciones posteriores, y los corrí en verde.
  - Los tests de QC-236 se reescribieron como pide design § 12.2. `customer-phone-uniqueness` pasó a `customer-phone-shared`.
  - Correcto. **Pero faltaron dos** (B1).
- **E2E `clientes-telefono.spec.ts` (leído, sin correr):** cubre lo que el spec le pide (T11, R7).
  - La segunda alta con el mismo número cierra el panel y deja `count = 2`.
  - La limpieza borra antes `customer_phone_numbers` y `phone_numbers`, que ahora tienen FK `RESTRICT` a `customers`/`companies`.
  - El caso R30 (teléfono antiguo con su etiqueta) sigue intacto y es parte de la cobertura indirecta de R14.

## Hallazgos

### B1 — BLOQUEANTE: dos tests sin tocar quedan en rojo por el diff
`lib/composition/index.ts` añade a la fachada `integraciones` tres miembros: `linkWhatsappContact`,
`unlinkWhatsappContact` y `setWhatsappContactBlocked`. Hay dos tests que fijan la lista exacta de
claves de esa fachada y no se actualizaron:

- `tests/unit/integraciones/encryption-keys-env.test.ts` › «R10/R19: importar @/lib/composition sin
  ninguna de las dos variables resuelve y expone integraciones»: espera 20 claves y recibe 23. Falla
  también corrido solo.
- `tests/unit/composition/integraciones-graph-doubles.test.ts` › «la fachada expone exactamente el
  cifrado y los casos de uso de las dos conexiones»: mismo motivo.

Ninguno está en `tests/baseline-rojos.json`. Con ellos, `gate-completo` sale rojo, y la bitácora no
los menciona. **Qué falta:** añadir las tres claves a las dos listas cerradas, con nota fechada, sin
relajar el `toEqual` exacto. Después, correr los dos archivos y anotar su salida en `impl_QC-239.md`.
Conviene además barrer `tests/` buscando otras enumeraciones de la fachada `integraciones` o `clientes`.
Encontré solo estas dos más `customer-service.test.ts`, que está en verde.

### m1 — menor: R14 no tiene un caso propio
La cobertura indirecta es real:
- la lista y el formulario leen las mismas columnas `phone*`, y `customer-view.ts` no cambia;
- el invariante R8 fija el espejo;
- `customer-phone-field.test.tsx` y el E2E R30 fijan el texto antiguo con su aviso.

Basta para no bloquear. Aun así, un caso con prefijo `R14` haría la traza explícita. Por ejemplo, en
`customer-phone-numbers.int`: tras alta, edición, vincular y desvincular, `findAliveById` devuelve lo
que pinta la lista.

### m2 — menor: design § 12.3 no recoge el cambio de la guardia de integraciones
Falta la fila de la lectura por fábrica del inbox y de `findBlockedWaIds`. Es documentación: el cambio
tensa la guardia. Lo actualiza el leader o el spec_author.

### m3 — menor: `isCustomerPhoneLinkConflict` está duplicado
Vive en `clientes/.../customer-phone-prisma.ts` y en `integraciones/.../whatsapp-contact-prisma.ts`. La
causa está justificada: `integraciones` no puede importar un adaptador de `clientes`, y el exento solo
admite una función. Hay que anotarlo como deuda o moverlo a una función de `lib/composition` que se pase
a las dos unidades de trabajo. Si una copia cambia y la otra no, el reintento diverge en silencio.

### m4 — menor: el upsert de `phone_numbers` puede chocar entre dos altas simultáneas
Dos altas simultáneas de clientes distintos con el mismo número nuevo pueden chocar en
`phone_numbers_company_id_e164_key` si Prisma no usa el upsert nativo. Ese P2002 (`modelName:
PhoneNumber`) no lo reconoce `isCustomerPhoneLinkConflict` y llegaría al usuario como error inesperado.
No está verificado. Hay que confirmar si el `upsert` con `update: {}` sale como `ON CONFLICT` nativo
o, si no, incluir ese índice en el reintento.

### m5 — menor: el flujo crítico se cubre sin E2E
La feature toca webhooks y permisos (flujos críticos), y design § 12.3 declara «sin E2E nuevo»: el
recorrido real lo cubren `whatsapp-webhook-route.int` y los `.int` sobre la composición, como QC-238.
El design está aprobado, así que no bloqueo. El leader debe confirmar con el humano que esa
declaración vale como excepción al checkpoint E2E.

## Veredicto

**RECHAZADO** — 1 bloqueante (B1) y 5 menores.

Lo que vuelve al implementer: B1, actualizar las dos listas cerradas de claves de la fachada
`integraciones` y dejar su salida verde en la bitácora. Los menores no impiden el OK. m1 y m3 son
baratos y conviene cerrarlos en la misma vuelta.
