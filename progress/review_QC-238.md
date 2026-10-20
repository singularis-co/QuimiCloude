# QC-238 — recepcion-webhook-whatsapp · review

## Vuelta 1 (HEAD 4391def3, base origin/dev 6e8695b2)

**Veredicto: RECHAZADO** (2 bloqueantes; ver «Hallazgos»).

### Verificación ejecutada por el reviewer (2026-10-19)

- `pnpm run typecheck`: exit 0.
- `pnpm run lint`: exit 0, `0 errors, 10 warnings` (todos preexistentes, ninguno en archivos de la feature).
- `pnpm exec vitest run guard`: `Test Files 81 passed (81)`, `Tests 1130 passed | 20 skipped`.
- `pnpm exec vitest run tests/unit/integraciones/whatsapp tests/unit/integraciones/module-shape.test.ts`:
  `Test Files 20 passed (20)`, `Tests 470 passed | 1 skipped`.
- Integración afectada (con el `.env` del checkout principal, base efímera copiada de la plantilla):
  `whatsapp-webhook-route.int`, `whatsapp-inbox-prisma.int`, `whatsapp-messages-constraints.int`,
  `whatsapp-messages-migration.int`, `whatsapp-connection-migration.int`, `whatsapp-connection-prisma.int`,
  `integraciones-graph-doubles`, `encryption-keys-env` → `Test Files 8 passed (8)`, `Tests 104 passed (104)`.
- `./init.sh` no se corrió: falla en el board (cupos, QC-278), que es del leader y no de la feature.
- MCP del grafo: no usado; la revisión se hizo con Grep/Read y `git diff origin/dev...HEAD`.

### Checklist — `CHECKPOINTS.md`

Especificación
- [x] `requirements.md` con R1–R33 en EARS.
- [x] `design.md` con alternativas descartadas (§12, nueve).
- [ ] Todas las tasks `[x]`: **T16 y T17 sin marcar** (ver B3 y m1).
- [x] `design.md` abre con `## Lo que ya existe`, con búsqueda real; el diff no re-crea nada de esa
  lista (reutiliza `findLiveById`, `decryptStoredSecret`, `SecretDigest`, `SecretCipher`,
  `isCompanyAddonActive`, `isWhatsappConnectionId`).

Equipo
- [x] Rama `feature/QC-238-...` publicada; assignee en `progress/features/QC-238.md`. El cupo backend
  4/3 está autorizado por el humano (2026-10-19) y es asunto del leader.

Trazabilidad
- [ ] Cada `R<n>` mapea a un test: **R33 no tiene test** (B1). R15 tiene test solo de la mitad que
  está implementada (B2).
- [x] `progress/impl_QC-238.md` trae el mapa R1–R33.

Calidad de código
- [x] Typecheck y lint verdes (corridos por mí).
- [ ] `gate-completo` en CI: todavía no hay PR.
- [~] E2E de flujo crítico (webhooks): no hay Playwright. Excepción justificada en `design.md > 8` y
  alternativa 7, con el spec aprobado por el humano en F1.4; mismo criterio que QC-111. Lo sustituyen
  `whatsapp-webhook-route.int.test.ts` (handlers reales + composición real + base) y T16 (m2).
- [x] Sin dependencias nuevas: `package.json` y `pnpm-lock.yaml` fuera del diff.

Seguridad
- [x] Ningún secreto en el código. Los tests generan sus claves.
- [x] El webhook valida token (GET) y firma (POST) y es idempotente (ver «Puntos críticos»).

Configuración
- [x] Nada hardcodeado entre entornos: sin variables nuevas; la ruta base sale de QC-237.

Verificación final
- [ ] `./init.sh` verde: bloqueado por el board (leader).
- [ ] Este review con veredicto OK: no.
- [ ] `progress/features/QC-238.md > Cierre`: vacío; su «Estado» sigue en F1.4 (leader).

### Checklist — `docs/checkpoints-proyecto.md`

- [x] Typecheck y lint.
- [~] E2E de Playwright: ver arriba (m2).
- [x] Sin UI: no aplican multiplataforma, catálogo ni pase `/design`.
- [x] Tablas nuevas con `company_id` (`guard-empresa-en-esquema` verde); toda consulta filtra por la
  empresa de la conexión, y el cruce se rechaza con test: `whatsapp-inbox-prisma.int.test.ts > R2`,
  `verify-whatsapp-webhook.test.ts > R2`, y las FK compuestas de R30 en
  `whatsapp-messages-constraints.int.test.ts`.
- [x] Permisos: no hay usuario; la autorización (token, firma, añadido) vive en `domain/`
  (`webhook-connection.ts`, `verify-…`, `receive-…`) con sus tests.
- [x] RLS `ENABLE` + `FORCE` en las dos tablas (`guard-rls-force` verde; `pg_class` en el `.int`).
- [x] Acceso a datos solo por adaptadores `driven` con Prisma.
- [x] Migración con `down.sql`; ida-vuelta-ida probada en `whatsapp-messages-migration.int.test.ts`. El
  `.int` de la migración de QC-237 se adaptó para revertir antes sus dependientes (ver m6).
- [x] Hexagonal: `domain/` y `ports/` sin framework ni base; `node:crypto` solo en
  `adapters/driven/security`; el driving pide todo a `lib/composition`; los modelos llevan
  `/// @module integraciones`; `module-shape` y `guard-arquitectura-modulos` verdes.
- [x] La lógica está en `domain/`, no en el route handler (el handler solo lee la entrada y traduce
  resultados).
- [x] Permisos de páginas, props y Server Actions: no aplica (route handler externo).

### Reglas del reviewer 5–11 (`docs/perfil-agentes.md > reviewer`)

- 5 Calidad y seguridad: RLS, firma e idempotencia correctas; sin contexto ni secretos hardcodeados;
  capas separadas. Pero falta el log de R15 (B2).
- 6 Multiplataforma: no aplica (sin UI).
- 7 Dependencias: `package.json` intacto.
- 8 Aislamiento por empresa: cumplido (ver arriba).
- 9 Comentarios: ninguna línea añadida en `lib/`, `app/` o `db/` cita `QC-<n>`, `R<n>`, `design.md` ni
  «decisión cerrada» (grep sobre el diff). Las citas de QC-238 están solo en tests, que es lo permitido.
- 10 y 11 (duplicados, diseño): no aplican.

### Puntos críticos que pidió el leader

- **HMAC (R10, R11).** `webhook-signature-hmac.ts`: `createHmac('sha256', appSecret).update(rawBody)`
  sobre los **bytes** (`request.arrayBuffer()` → `Uint8Array` en el driving; no hay `text()`), cabecera
  validada con `/^sha256=([0-9a-f]{64})$/i` antes de comparar, y `timingSafeEqual` con 32 bytes en los dos
  lados, así que no puede lanzar por longitud. La firma se comprueba antes de decodificar o parsear: lo fija
  `receive-whatsapp-webhook.test.ts > R10: el orden es …` (`invocationCallOrder`) y el caso de cuerpo no
  UTF-8 con firma mala. Correcto.
- **Handshake (R5–R8).** Se exige `hub.mode === 'subscribe'` y que token y challenge no estén vacíos
  antes de tocar la base; el token se compara con `SecretDigest.matches` (SHA-256 + `timingSafeEqual`, de
  QC-234); el `403` es idéntico en todos los casos y el motivo solo va al log. `recordWebhookHandshake`
  hace dos `updateMany` con la condición en el `where` (`status != DISABLED`, `status = PENDING`), así
  que un `DISABLED` concurrente no se reactiva. Se leen solo los nombres con punto (R8). El challenge solo
  se devuelve después de verificar el token, como `text/plain` y con `no-store`. Correcto.
- **Ámbito y aislamiento (R2, R30, R32).** La única lectura sin ámbito es
  `companyOfWhatsappConnection` (devuelve solo `company_id` de una fila viva); su forma la vigila
  `guard-ambito-empresa-integraciones` con casos de sensibilidad. El ámbito nace de la fila
  (`resolveWebhookConnection`) y la fila completa se relee con `findLiveById(id, scope)`. Contactos,
  mensajes, statuses y `lastWebhookAt` se escriben o filtran con `companyScopeColumns`/las envolturas. En
  la base, las FK compuestas `(company_id, connection_id)` → conexión y
  `(company_id, connection_id, contact_id)` → contacto rechazan el cruce, y lo prueban cinco casos R30.
  Correcto.
- **Idempotencia (R18, R21, R22, R25).** Mensajes: `createMany(..., skipDuplicates: true)` sobre el único
  `wamid`. Contactos: un solo `INSERT … ON CONFLICT (connection_id, wa_id) DO UPDATE` con `GREATEST`
  (fechas que no retroceden) y el nombre solo pisado por uno más reciente. Statuses: `updateMany` con
  `status IN STATUS_PREDECESSORS[s]` en el `where`, así que no retroceden ni con concurrencia, y `FAILED`
  es final. Todo en una `prisma.$transaction`. El reenvío tras `500` y tras `200` lo prueban
  `whatsapp-webhook-route.int.test.ts > R18 R25` y `> R23 R25`, y los concurrentes
  `whatsapp-inbox-prisma.int.test.ts > R16 R25`. Correcto.

### Puntos que señaló el implementer

- **R33 sin test:** es bloqueante (B1).
- **Dos `throw new Error` en `whatsapp-inbox-prisma.ts`:** aceptado (m3).
- **Tests de fuera de la feature tocados:** aceptados (m6).
- **`aislamiento.json` con la migración en `transaccion`:** correcto. `whatsapp-messages-migration.int.test.ts`
  corre dentro de un `$transaction` que termina en `RollbackSignal`, igual que
  `whatsapp-connection-migration.int.test.ts`, que está en la misma lista. Los otros tres `.int` van a
  `commit` con `motivo` y `desde`. `guard-aislamiento-integracion` verde.

### Hallazgos

**B1 — BLOQUEANTE. R33 no tiene ningún test.** El mapa de la bitácora lo reconoce («sin test propio»)
y lo apoya en una comprobación manual de `git diff`. Las guardias que existen no lo cubren: comprueban
coherencia, no ausencia. `guard-dependencias-aprobadas` deja pasar una dependencia con su fila,
`guard-variables-por-entorno` una variable con su fila de tabla, `guard-permisos-sembrados` un permiso
sembrado, y `guard-catalogo-de-errores` un código del catálogo. Ninguna se pone roja si esta ficha añade
algo de eso. Regla 4 de `CLAUDE.md` y punto 1 del reviewer.
*Qué falta:* una guardia de límites de la ficha con el patrón de
`tests/guards/guard-qc261-limites-de-la-ficha.test.ts` / `guard-qc260-…`. Debe hacer un censo del diff
de rama contra el merge-base con `origin/dev`, acotado a `feature/QC-238-…` y con `ctx.skip` ruidoso
fuera de ella. Tiene que fallar si el diff toca `package.json`/`pnpm-lock.yaml`, `.env.example`, el
catálogo de permisos (`lib/modules/identity/domain/permissions.ts`), el menú
(`lib/shared/navigation/private-nav.ts`) o el catálogo de errores, y debe llevar un caso de sensibilidad
con una lista sintética. Después hay que actualizar el mapa R33 en `progress/impl_QC-238.md`.

**B2 — BLOQUEANTE. R15 exige «con una línea de log» y no hay ninguna.** `parseWhatsappWebhook` cuenta
el cambio saltado en `skipped.changes`, pero `receiveWhatsappWebhook` devuelve solo
`counts: { messages, statuses }` (`domain/receive-whatsapp-webhook.ts`). `skipped` se pierde, y el
driving no escribe nada en `stored` (`adapters/driving/whatsapp-webhook-route.ts`, `case 'stored'`). Un
`change` de otro `phone_number_id` se ignora en silencio. Es justo la señal que necesita quien tiene una
URL mal pegada o un número cambiado en Meta. `design.md > 4.3` lo preveía («el conteo de saltados vuelve
al driving para su log, sin el número»); la tabla de §3.2 («`stored` → ninguno») lo contradice y manda
el requisito. El test de R15 (`whatsapp-webhook-payload.test.ts`) solo prueba el conteo, y
`whatsapp-webhook-route.test.ts > 'R16: stored ⇒ 200 sin cuerpo y sin log'` fija lo contrario.
*Qué falta:*
- que el resultado `stored` lleve los conteos de saltados, solo números;
- que el driving escriba una línea `console.warn` cuando haya cambios saltados (p. ej.
  `whatsapp_webhook_changes_skipped`, con `{ connectionId, changes, messages, statuses }`), sin el
  `phone_number_id` ni nada de R27;
- tests de ese log en `receive-…test.ts` (el conteo llega) y en `whatsapp-webhook-route.test.ts` (la
  línea existe y no lleva datos sensibles), con el caso R27 ampliado;
- ajustar el test «stored ⇒ sin log» al caso sin saltados;
- corregir la fila de §3.2 en `design.md`.

**B3 — BLOQUEANTE (consecuencia). T17 sin marcar.** Su «Hecho» exige «ningún `R<n>` sin test» (B1). La
parte de `./init.sh` está bloqueada por el board, que es del leader. Cuando B1 y B2 estén cerrados, el
implementer marca T17 con los pasos de código del gate corridos a mano. El rojo del board queda anotado
como del leader.

**m1 — menor. T16 (verificación manual con Meta) sin marcar.** `tasks.md` lo permite: «se anota y lo
hace el humano antes del merge a producción», y la bitácora trae los pasos. El leader lo deja anotado en
`progress/features/QC-238.md` como condición del PR a producción, para que no se pierda.

**m2 — menor. Sin E2E de Playwright en un flujo crítico.** Aceptado: la excepción está razonada en
`design.md > 8` y en la alternativa 7, y el spec la aprobó el humano. Mismo criterio que QC-111. Se
anota aquí para que conste que el checkpoint se cumple por excepción declarada.

**m3 — menor. Los dos `throw new Error` de `whatsapp-inbox-prisma.ts`.** Son invariantes que hoy no se
pueden alcanzar:
- `RETURNING` vacío solo ocurriría si el contacto de `(connection_id, wa_id)` fuera de otra empresa, y
  la FK compuesta contra la conexión lo impide;
- un mensaje sin contacto no puede salir de `parseWhatsappWebhook`, que acumula un contacto por cada
  remitente.

Si saltaran, deshacen la transacción y dan `500`, que es el comportamiento de R23. Hay precedentes del
mismo patrón en otros adaptadores (`inventory-import-prisma.ts`, `administrator-prisma.ts`). No piden
código de catálogo (R33 lo prohíbe). Sin cambio.

**m4 — menor (fuera del spec). Un mensaje «veneno» firmado se reintenta en bucle.** Dos casos:
- un `timestamp` con demasiados dígitos da `Invalid Date`;
- un `\u0000` en un texto lo rechazan `text`/`jsonb` de Postgres.

En los dos, Prisma lanza, la ruta responde `500` y Meta reintenta hasta rendirse, tapando el resto del
lote. Necesita la firma de Meta, así que el riesgo es bajo. Propuesta para `progress/deudas.md` o para
QC-239: acotar `timestamp` en el zod de la cabecera y limpiar `\u0000`, o mandar a `UNSUPPORTED`.

**m5 — menor. `progress/features/QC-238.md` desactualizado.** «Estado» sigue en «F1.4 … Siguiente:
F2.1», el estado de la tabla es `pending` y `## Tandas` está vacío. Es del leader.

**m6 — no es hallazgo, consta.** Los tests de fuera de la feature solo se tensan:
- `encryption-keys-env` y `integraciones-graph-doubles`: + 2 claves en listas exactas, más el `vi.mock`
  del método nuevo;
- `whatsapp-connection-prisma.int`: + 1 línea del puerto;
- `guard-identificador-de-request`: + la migración.

`whatsapp-connection-migration.int.test.ts` conserva todas sus aserciones. Solo revierte antes las
migraciones posteriores que dependen de la tabla (detección transitiva por `REFERENCES`, patrón de
`customers-migration.int.test.ts`), y tiene un ancla que exige encontrar la de esta ficha. Ningún caso
se relajó.

### Para la vuelta 2

Cerrar B1 y B2 (y con ellos B3). La revisión se acota al rango nuevo, contra B1–B3 y sus regresiones.
