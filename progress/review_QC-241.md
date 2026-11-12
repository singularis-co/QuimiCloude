# Review QC-241 — envio-whatsapp-sistema

## Vuelta 1 (revisión completa, `origin/dev...HEAD` en `5180a56d1`)

Fecha: 2026-11-11. Reviewer. MCP del grafo no consultado: el diff se revisó con Grep, Read y git.

### Verificación ejecutable (corrida por el reviewer)

| Comando | Resultado |
|---|---|
| `pnpm run typecheck` | exit 0 |
| `pnpm run lint` | 0 errores, 11 warnings, todos en archivos fuera del diff |
| `pnpm exec vitest run guard` | 88 archivos, 1359 pass, 22 skipped, 0 fail |
| `pnpm exec vitest run tests/unit/integraciones/whatsapp/queue tests/unit/integraciones/whatsapp/send/send-whatsapp-message.test.ts tests/unit/integraciones/module-shape.test.ts tests/unit/documentos` | 115 archivos, 1474 pass, 31 skipped, 0 fail |
| `.int` afectados (`whatsapp-send-queue-prisma`, `whatsapp-system-send-flow`, `whatsapp-system-send-migration`, `whatsapp-agent-schema`, `whatsapp-messages-migration`), base efímera `qct_qc241_…` y borrada al terminar | 5 archivos, 50 pass |

`vitest related` da 127 en este worktree, así que los tests se corrieron directamente. No se corrió la suite completa ni el E2E: los corre `gate-completo`.

### Checklist

**Especificación**
- [x] `requirements.md` en EARS con R1–R41 y D1–D15 cerradas; sin preguntas abiertas.
- [x] `design.md` tiene 7 alternativas descartadas, cada una con su porqué (§11).
- [x] `tasks.md`: T1–T10 marcadas `[x]`.
- [x] `design.md` abre con `## Lo que ya existe` y la sección tiene contenido. El diff no re-crea nada de esa lista. Reutiliza `recipientByCustomer`, `buildTemplateMessage`, `isSendable`, `sendFailureOf`, `WhatsappOutboxRepository`, `verifyCronSecret`, `listActiveCompanyIds`, `syncFailureCodeOf` y `readPublicBaseUrl`. El diagnóstico se extrae a `sendDiagnosticOf` en lugar de duplicarse. El lector de configuración propio está justificado en §5.2, porque un módulo no importa adaptadores de otro.

**Trazabilidad**
- [x] Cada R1–R41 tiene al menos un caso con aserciones reales. Se leyeron los casos de `enqueue`, consumidor, barrido, rutas, guardia de QStash y flujo `.int`; ninguno está vacío. R39 lo cubre `guard-dependencias-aprobadas`: `package.json` no cambia.
- [x] `progress/impl_QC-241-…md` contiene el mapa R1–R41 → test.

**Calidad de código**
- [x] Typecheck y lint sin errores.
- [ ] `gate-completo` en CI: pendiente del PR.
- [~] Flujo crítico «webhooks» sin E2E de Playwright. Ver m5.
- [x] Sin dependencias nuevas. `docs/dependencias.md` solo amplía la nota de aislamiento de `@upstash/qstash`.

**Seguridad y configuración**
- [x] Sin secretos en el código. `QSTASH_*`, `APP_BASE_URL` y `WHATSAPP_SEND_MAX_RETRIES` se leen del entorno en cada llamada.
- [x] El webhook nuevo valida la firma sobre el cuerpo crudo antes de parsearlo. Es idempotente: el reclamo atómico `QUEUED→SENDING` está probado con concurrencia real en `.int`.
- [~] `SWEEP_BATCH = 100` está fijado en el código y en design §4.4 sigue marcado **[POR CONFIRMAR]**. Ver m4.

**Datos y módulos (`docs/checkpoints-proyecto.md`)**
- [x] No hay tabla nueva: solo la columna `template_components` y un índice parcial. La RLS de `whatsapp_messages` ya existía.
- [x] Cada consulta lleva ámbito de empresa (`companyScopeColumns` o `whatsappMessageCompanyScope`) y filtra `origin = 'SYSTEM'`. El puerto entra sin exención en `guard-ambito-empresa-integraciones`. El rechazo cruzado está probado en `whatsapp-send-queue-prisma.int` y en `whatsapp-system-send-flow.int` (R36).
- [x] `down.sql` revierte exactamente la migración. Lo prueba `whatsapp-system-send-migration.int`, y el timestamp es posterior a la última migración de `dev`.
- [x] `domain/` y `ports/` no importan framework, Prisma ni QStash (guardia de arquitectura en verde). Los adaptadores driving piden todo a `lib/composition`.
- [x] Sin permisos de usuario: la única puerta es la firma o el `CRON_SECRET`, y está declarado en R16 y R27.
- [n/a] UI, catálogo y pase `/design`: la feature no toca UI.

**Reglas del reviewer (perfil 5–11)**
- [x] 5. Firma e idempotencia correctas, capas separadas, sin contexto fijado en el código.
- [n/a] 6. Multiplataforma: no hay UI.
- [x] 7. `package.json` sin cambios.
- [x] 8. Ningún modelo nuevo. Hay rechazo cruzado probado.
- [x] 9. Comentarios: ninguna línea añadida en producción cita `QC-<n>`, `R<n>`, `design.md` ni «decisión cerrada» (comprobado por grep sobre el diff).
- [n/a] 10 y 11. No hay componentes.

### Desviaciones declaradas por el implementer

| # | Desviación | Veredicto |
|---|---|---|
| 1 | `enqueue` resuelve la plantilla antes que el destinatario | **Aceptable.** Con el orden de design §4.2, una plantilla inexistente dejaba creado o vinculado el contacto, y eso va contra R6 («NO DEBE escribir… nada»). Los tests R6 con `contacts: []` y `expectNoWrites` lo prueban. El requisito manda sobre el diseño. Queda pendiente actualizar el texto de §4.2 (m1). |
| 2 | Claves de firma vacías ⇒ `401` sin línea de log | **Menor (m2).** Cumple R14, que no pide log. Tiene una consecuencia que la bitácora no menciona, descrita en m2. |
| 3 | Fila de `WHATSAPP_SEND_MAX_RETRIES` en `docs/architecture.md` | **Menor (m3).** La guardia `guard-variables-por-entorno` exige la fila. Los valores copian `DOCUMENT_PROCESSING_MAX_RETRIES` y el defecto de D6, que el humano ya aceptó. Falta su confirmación explícita de las columnas. |
| 4 | El barrido devuelve `500` si fallan `listCompanyIds` o `maxRetries()` | **Aceptable.** R28 aísla el fallo **por empresa**; un fallo antes de recorrer ninguna no tiene a quién aislar. R25 pide que una variable inválida haga fallar la lectura. Es el mismo comportamiento que el cron de plantillas, y Next registra la excepción. |
| 5 | El doble de `publish` vive dentro de `lib/composition/index.ts` | **Aceptable.** Design §5.5 no fija dónde va, y sigue el patrón del doble de Graph (elección en cada llamada). `guard-dobles-e2e` está en verde, y `whatsapp-system-send-flow.int` lo ejercita con `INTEGRATIONS_E2E_DOUBLES=1` (`queueMessageId = e2e-<id>`). |
| 6 | `d7a0c12f3` cambia `whatsapp-agent-schema.int.test.ts` (QT-303) | **Aceptable.** El humano ya lo aceptó. El test endurece el DOWN/UP con el patrón de `whatsapp-messages-migration.int` y no relaja ninguna aserción; pasa en verde. |

### Hallazgos

Ninguno es BLOQUEANTE.

- **m1 — menor. `design.md` §4.2 contradice el código.** Los pasos 3 y 4 siguen en el orden antiguo (destinatario y después plantilla). El código y el comentario de `createWhatsappNotifier` dicen lo contrario. Hay que cambiar el orden en §4.2 y añadir el motivo (R6) para que el spec no engañe al siguiente lector.
- **m2 — menor. Un consumidor que nunca reclama provoca una republicación horaria sin fin.** Con las claves de firma vacías o equivocadas, el consumidor responde `401` sin dejar rastro. Lo mismo pasa con una `APP_BASE_URL` mal puesta, que lleva la cola a un 404. En ninguno de los dos casos el mensaje se reclama, así que `attempts` no sube y `failExhausted` nunca lo alcanza. Mientras tanto, `listStaleQueued` lo republica en cada pasada, hasta 100 por empresa y hora, y sigue en `QUEUED` indefinidamente. Cumple R14 y R29 al pie de la letra, pero es un fallo de configuración silencioso. Se propone al humano una de dos cosas: una línea `error` cuando faltan las claves (sin valores), o una ficha para acotar las republicaciones. No bloquea porque ningún requisito lo pide.
- **m3 — menor. Variables por entorno sin confirmar.** El humano debe confirmar la fila `WHATSAPP_SEND_MAX_RETRIES`: `opcional | vacia (3) | vacia`. Además, la fila `APP_BASE_URL` dice en Preview «ausentes (solo las lee el correo)», y ya no es cierto: la lee también la cola de envíos. La parte de QC-237 ya existía antes de esta feature; aquí se suma un lector más.
- **m4 — menor. `SWEEP_BATCH = 100` sigue marcado [POR CONFIRMAR] en design §4.4.** Está implementado con ese valor. Hay que cerrarlo con el humano o quitar la marca.
- **m5 — menor. El flujo crítico «webhooks» no tiene E2E.** Design §5.5 dice «No hay E2E en esta ficha», pero no declara la excepción frente a `CHECKPOINTS.md > Calidad de codigo`. Los precedentes QC-111 y QC-238 lo aceptaron como menor con la excepción razonada. La cobertura real está en `whatsapp-send-route.test.ts` (firma, `400`, `200`/`500`) y en el flujo `.int` con la composición real. Conviene que el leader lo anote para el humano.

### Veredicto

**OK**: 0 bloqueantes, 5 menores (m1–m5). Las desviaciones 1, 4, 5 y 6 son aceptables; las 2 y 3 son menores. Antes de pedir el merge, el leader debe llevar m2, m3 y m4 al humano. `gate-completo` sigue pendiente en CI.

## Vuelta 2 (acotada a 5180a56d1..HEAD)

Commits: 5b040f1cd (review vuelta 1), 5c73b1779 (enmienda del spec: R42, D16–D18, T11–T12) y 4f4eeb3ad (arreglo: m2, m3). El alcance es el que fijó el leader: R42, m1/m4/m5 en design.md y T12 en `docs/architecture.md`. No se rehace la trazabilidad de R1–R41.

### Checklist

- [x] **R42 en EARS.** Es un requisito no deseado: «SI … ENTONCES el sistema DEBE … y NO DEBE …». Es testeable: pide `401`, una línea `error` con el flujo y los nombres, y que no salga ningún valor. Cubre D16, y figura en la cobertura de D y en el Mapa R → test de `tasks.md`.
- [x] **R42 tiene un test real.** Está en `whatsapp-queue-signature-qstash.test.ts`, en el bloque `R42`:
  - cuatro casos `it.each`: las dos claves ausentes, las dos vacías o con espacios, falta la actual, la siguiente vacía. Cada caso comprueba `false`, una sola llamada a `error` con el evento, el flujo y los nombres exactos, y que no se construye `Receiver`;
  - el valor centinela de la clave presente no aparece en ninguna llamada;
  - sin firma no hay línea;
  - con firma inválida (`verify` lanza) o que no corresponde (`verify` ⇒ `false`) y las claves puestas, tampoco hay línea.

  El `401` lo sigue cubriendo `whatsapp-send-route.test.ts`.
- [x] **El test pasa.** `vitest run` sobre signature, route, config-env y queue-qstash: 4 archivos, 45/45 en verde.
- [x] **Código de T11.** `missingWhatsappQueueSigningKeys()` usa el mismo `isBlank` que `readRequired`, así que no hay divergencia entre «falta» y «lanza». El adaptador registra con `forModule('integraciones')`: un adaptador driven que importa `lib/shared`, lo que está permitido. `missing` lleva solo los nombres. El puerto no cambia y la firma se comprueba antes que las claves, como dice el design §5.1.
- [x] **m1 resuelto.** En §4.2 el paso 3 es la plantilla y el 4 el destinatario, con el motivo: R6 y que el destinatario puede escribir por R9. `tasks.md` T6 se corrige a «paso 4».
- [x] **m4 resuelto.** §4.4 queda en `SWEEP_BATCH = 100 (D18, confirmado por el humano el 2026-11-11)` y ya no lleva `[POR CONFIRMAR]`.
- [x] **m5 resuelto.** §5.5 declara la excepción de E2E frente a `CHECKPOINTS.md > Calidad de codigo`. Da el motivo, cita los precedentes QC-111 y QC-238 y nombra la cobertura que lo sustituye: `whatsapp-send-route.test.ts` y el flujo `.int`.
- [x] **m2 llevado al design.** §8 lo recoge como límite conocido (D16), con los tres casos, y deja escrito que no hay tope.
- [x] **T12 aplicada en `docs/architecture.md`.** `APP_BASE_URL` sale de la fila del correo, que conserva el resto de sus variables y su texto, y pasa a una fila propia con el texto literal de T12. La fila `WHATSAPP_SEND_MAX_RETRIES` queda `opcional | vacia (valor por defecto, 3) | vacia (valor por defecto, 3)`. Ninguna fila dice ya que `APP_BASE_URL` solo la lee el correo.
- [x] **Guardias.** `vitest run guard`: 88 archivos, 1359 tests en verde y 22 skipped; incluye `guard-variables-por-entorno` y `guard-dependencias-aprobadas`.
- [x] **eslint y tsc.** `eslint` sobre los 3 archivos tocados, limpio. `tsc --noEmit`, sin errores.
- [x] Las tasks T11 y T12 están marcadas `[x]`. `docs/architecture.md` figura en «Archivos esperados» y en el design §2.

### Hallazgos

Ninguno es BLOQUEANTE.

- **m6 — menor. `docs/architecture.md` sigue siendo incoherente sobre `APP_BASE_URL` en Preview.** T12 está aplicada al pie de la letra (D17), pero hay dos problemas que el leader debe llevar al humano. No hace falta otra vuelta de código:
  1. «Lo que hace el humano (fuera del codigo)» (línea ~813) sigue mandando **borrar** `APP_BASE_URL` en Preview. Eso contradice la fila nueva («necesaria si se prueba WhatsApp»).
  2. En Preview, `QSTASH_TOKEN` tiene que estar ausente: `scripts/entorno-de-preview.mjs`, `SIN_VALOR`, hace fallar el build si tiene valor. Sin ese token la publicación falla siempre (R11). Por eso «probar WhatsApp en Preview» con la cola no es posible hoy, y poner `APP_BASE_URL` no cambia nada.

  La forma más simple de corregirlo sería dejar Preview en «ausente (sin `QSTASH_TOKEN` la cola no publica)». También vale ajustar la viñeta de «borrar». Decide el humano, porque D17 es suyo.

### Veredicto

**OK**: 0 bloqueantes, 1 menor (m6). m1–m5 de la vuelta 1 quedan resueltos: m1, m4 y m5 en el design; m2 con R42 y su test; m3 con T12. `gate-completo` sigue pendiente en CI.
