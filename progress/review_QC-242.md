# QC-242 — plantillas-whatsapp-backend · informe del reviewer

## Vuelta 1 (completa, origin/dev...ddde1367)

Leído: `requirements.md` (R1–R52), `design.md`, `tasks.md`, `progress/impl_QC-242.md`,
`docs/perfil-agentes.md` (reviewer y todos los agentes), `CHECKPOINTS.md`,
`docs/checkpoints-proyecto.md`, el diff completo de producción y los tests nuevos o tocados.
El grafo no se usó: el worktree no está indexado (lo dice también `design.md > Lo que ya existe`).
Se usaron Grep y Read.

### Verificación ejecutada por el reviewer

```
pnpm run typecheck                                  -> tsc --noEmit sin errores
pnpm run lint                                       -> 0 errors, 10 warnings (preexistentes)
vitest run --project node --project ui tests/unit/integraciones tests/unit/pedidos/vercel-cron.test.ts
  tests/unit/errores/catalogo.test.ts tests/unit/composition
  tests/unit/identity/session-once-per-request-actions.test.ts
                                                    -> Test Files 68 passed; Tests 1364 passed | 1 skipped
vitest run guard                                    -> Test Files 84 passed; Tests 1166 passed | 21 skipped
```

No se corrieron: los `.int` (no hay base en el worktree), `./init.sh` ni la suite completa, por
instrucción del leader (la máquina va justa de memoria). La migración y los `.int` se revisaron a
mano (ver abajo).

### Checklist — CHECKPOINTS.md

- [x] `requirements.md` con R1–R52 en EARS.
- [x] `design.md` con alternativas descartadas (§16, 10).
- [x] `tasks.md`: 34 tasks, todas `[x]`, ninguna sin marcar.
- [x] `design.md` abre con `## Lo que ya existe`, con búsqueda hecha. El diff no re-crea nada de lo
  listado: reutiliza `decryptStoredSecret`, `readStoredSecret`, `metaMessageOf`,
  `resolveWebhookConnection`, `verifyCronSecret` y `listActiveCompanyIds` (cableados en la
  composición) y no los duplica.
- [x] Assignee y rama de la ficha (`progress/features/QC-242.md > F1.0`).
- [x] Cada R<n> mapea a al menos un test con contenido (ver «Trazabilidad»).
- [x] `progress/impl_QC-242.md` trae el mapa R<n> -> test, por tanda y consolidado.
- [x] Typecheck y lint, corridos por el reviewer.
- [ ] `gate-completo` en verde: pendiente de CI. Es la primera vez que corren los `.int`.
- [~] E2E de flujo crítico (webhooks): no hay Playwright. La excepción está en `design.md > 14.1`
  (sin pantalla; el E2E lo hace QC-243). La sustituye `whatsapp-template-flow.int.test.ts`, que
  pasa por el `POST` firmado de la ruta real. Mismo criterio que QC-238 (m2 de su informe). Ver m6.
- [x] Sin dependencias nuevas (`package.json` y `pnpm-lock.yaml` sin tocar; lo fija la guardia R52).
- [x] Sin secretos hardcodeados. El token va solo en `Authorization: Bearer`; ningún log lleva URL,
  cabecera, cuerpo ni mensaje de Meta.
- [x] Webhook: la firma y la idempotencia son las de QC-238, sin cambios. Los cambios de plantilla
  son `UPDATE` idempotentes. La resincronización corre en `after` y no cambia la respuesta.
- [x] Nada que cambie entre entornos va hardcodeado (`CRON_SECRET`, la versión de Graph y las
  claves de cifrado salen de variables que ya existían).
- [ ] `./init.sh` rápido en verde: no se corrió aquí, por instrucción del leader. La bitácora lo
  cortó a 295 s en `test:rapido`. Lo cubre `gate-completo`.
- [x] Este informe existe; veredicto abajo.
- [ ] `Cierre` de la ficha y desmontar el worktree: los hace el leader después.

### Checklist — docs/checkpoints-proyecto.md

- [x] typecheck / lint.
- [~] E2E de Playwright en un flujo crítico: ver arriba y m6.
- [x] UI: el único cambio es una cadena más en `WHATSAPP_SETUP_GUIDE_STEPS`, sin componente nuevo ni
  cambio visual. [P8] lo aprueba sin pase `/design`. No toca el catálogo.
- [x] Tabla nueva con `company_id`; `guard-empresa-en-esquema` en verde. Cada consulta del adaptador
  filtra con `whatsappTemplateCompanyScope(scope)` o escribe con `companyScopeColumns(scope)`.
  El rechazo cruzado está probado en `whatsapp-template-prisma.int` (`describe R3`, 3 casos más
  `R1 — el alta con el ambito de otra empresa…`) y en la guardia de ámbito (tercer puerto, 8
  métodos, sensibilidad).
- [x] El permiso se valida en `domain/` (`requirePermission`, primera línea), con tests R5 por caso
  de uso y por acción.
- [x] RLS `ENABLE` + `FORCE`, sin policies; `guard-rls-force` en verde. El `.int` de la migración
  lo fija, con un caso de sensibilidad.
- [x] El acceso a datos pasa solo por el adaptador Prisma `driven`.
- [~] Migración versionada con `down.sql`. Revisada a mano (abajo). `pnpm run db:rollback` no se
  ejercitó: no hay base.
- [x] Módulos hexagonales: `domain/` y `ports/` sin framework. El validador solo importa `zod` y
  `./` (lo fija `module-shape` R6). De otros módulos solo se importa el contrato. Los adaptadores
  `driving` piden a `lib/composition`. El `'use server'` no se reexporta del barrel. El modelo
  lleva `/// @module integraciones`.
- [x] La lógica está en `domain/`. Las acciones solo resuelven el actor, delegan, traducen y
  revalidan.
- [x] Las mutaciones son Server Actions; no se añaden `fetch` a rutas internas.

### Puntos 5–11 de `docs/perfil-agentes.md > reviewer`

- 5 Calidad y seguridad: [x] (RLS, webhook, sin hardcode ni secretos, capas).
- 6 Multiplataforma: no aplica (sin UI nueva).
- 7 Dependencias: [x] ninguna.
- 8 Aislamiento por empresa: [x] (ver arriba).
- 9 Comentarios: [x]. Grep sobre las líneas añadidas en `lib/`, `app/`, `db/` y `vercel.json`:
  ninguna cita `QC-<n>`, `R<n>`, `design.md` ni «decisión cerrada». Las citas que hay están en
  tests y en `aislamiento.json`, fuera de la regla.
- 10 Duplicados: no aplica (sin componentes).
- 11 Diseño: no aplica ([P8]).

### Migración (revisada a mano; nunca se aplicó en local)

`db/migrations/20261020120000_whatsapp_templates/{migration,down}.sql`:

- El UP sigue `design.md > 2.2` en orden: los dos enums con todos sus valores; la tabla con las
  columnas de §2.1 (`updated_at` sin default, `components` `DEFAULT '[]'` como `@default("[]")`);
  4 CHECK, entre ellos `(status = 'OTHER') = (status_raw IS NOT NULL)` (R4); el único total
  `(connection_id, meta_template_id)` (mismo nombre que el `@@unique` de Prisma); el único parcial
  `… WHERE deleted_at IS NULL` (P1/R2); el índice de `created_by`.
- FK: la compuesta `(company_id, connection_id) -> whatsapp_connections(company_id, id)`, que se apoya
  en `whatsapp_connections_company_id_id_key` (existe desde `20261009130000`). Además
  `company_id -> companies` y `created_by -> users`, todas `RESTRICT/CASCADE`. Después
  `templates_synced_at` en la conexión y, al final, `ENABLE` + `FORCE`.
- DOWN: primero `DROP COLUMN templates_synced_at`, luego `DROP TABLE` (se lleva índices, FK, CHECK y
  RLS) y por último los dos `DROP TYPE`. Va sin `CASCADE`, a propósito. Revierte exactamente el UP.
- `statementsOf` del `.int` se puede usar con este SQL: no hay `;` dentro de literales ni de
  comentarios en línea.
- **Efecto sobre un `.int` ajeno, revisado:** la migración nueva tiene `REFERENCES
  "whatsapp_connections"`. Por eso `whatsapp-connection-migration.int.test.ts` la detecta sola
  como dependiente posterior: aplica su DOWN antes que el de la conexión y su UP después.
  `templates_synced_at` vuelve a quedar al final de `ordinal_position`, como en la base migrada, y
  el snapshot de «ida, vuelta e ida» no debería cambiar. `whatsapp-messages-migration` no la toma:
  la tabla no referencia contactos ni mensajes.
- No hay comprobación de drift Prisma↔migración en CI. Que el parcial y las FK compuestas estén
  fuera del esquema Prisma sigue el precedente de QC-237 y QC-238.

### Los `.int` que nunca corrieron

- `whatsapp-template-migration.int`: copia el patrón de `whatsapp-connection-migration.int` y de
  `ai-provider-migration.int` (las cadenas de `pg_get_constraintdef` son idénticas a las de ese
  precedente). Entra en la lista `transaccion` de `aislamiento.json`.
- `whatsapp-template-prisma.int` y `whatsapp-template-flow.int`: en la lista `commit`, con motivo y
  limpieza en `afterAll` (plantillas → … → empresa, en el orden de las FK RESTRICT). Typecheck
  verde. La lógica de los casos es coherente con el adaptador: el R22 fuerza el choque del parcial
  dentro de `applySync` y verifica que no queda nada, ni siquiera `templatesSyncedAt`; la carrera
  del alta se apoya en el `ON CONFLICT`.
- `whatsapp-connection-prisma.int`: el alta del R9 recibe ahora el repositorio real de plantillas
  y el doble `canned`. La lista del doble está vacía para esa WABA, así que no se inserta ninguna
  plantilla y el `afterAll` (sin borrar plantillas) no choca con la FK RESTRICT.
- Si alguno sale rojo en `gate-completo`, vuelve al implementer; ninguno está en
  `tests/baseline-rojos.json`.

### Cambios a tests de otras fichas

- `tests/unit/pedidos/vercel-cron.test.ts`: ya no exige «exactamente un cron en total», que es lo
  que pide `design.md > 8.3`. Cada cron se busca por `path` y sigue exigiendo una tarea para esa
  ruta y una ejecución diaria con los cinco campos. Se añade «ningún path dos veces» y el caso R34
  con `0 8 * * *`. Lo que exigía QC-141 a su cron no se relaja. Aceptado.
- R14 de QC-238 (`whatsapp-webhook-payload.test.ts`): el campo ajeno pasa de
  `message_template_status_update` a `account_update`, porque el de plantillas ya no se ignora
  (`design.md > Lo que ya existe`). Los `toEqual` del lote se tensan con `templateUpdates: []` y
  `templates: 0`. Hay un caso nuevo: los cambios de plantillas no cuentan como `changes` saltados.
  Se tensa, no se relaja. Aceptado.

### Trazabilidad R<n> -> test

Los 52 tienen al menos un caso con su `R<n>` en el nombre, en archivos que toca esta rama. Se
leyeron de muestra los de riesgo y verifican lo que dicen:

- R1/R2/R3/R22–R25/R36/R37 en `whatsapp-template-prisma.int`;
- R50 en `whatsapp-template-migration.int` (5 casos, incluida la sensibilidad sin `FORCE`);
- R14/R17/R36–R38/R42 en `whatsapp-template-flow.int`;
- R31/R33/R35 en `whatsapp-template-cron-route.test.ts` y en la guardia de rutas;
- R34 en `vercel-cron.test.ts`;
- R49 en `whatsapp-page.test.tsx`;
- R51 en `catalogo.test.ts`;
- R52 en `guard-qc242-limites-de-la-ficha.test.ts`.

Las cifras por R coinciden con las de la bitácora. Ningún requisito queda sin test.

### Decisiones de los subagentes que el spec no cubría (juicio)

| Decisión | Juicio |
|---|---|
| `insertCreated` con `prisma.$queryRaw` y no `tx.$queryRaw` | Aceptada. Es una sola sentencia atómica; el `WHERE company_id = EXCLUDED.company_id` del `DO UPDATE` y la FK compuesta cierran el cruce de empresa |
| `applySync` como `$transaction([...])` por lotes | Aceptada. Una transacción, en el orden de §5.2 |
| `paging.next` sin `cursors.after` ⇒ `rejected` | Aceptada. Es lo coherente con R22 (no escribir con una lista a medias) |
| `syncConnectionTemplates` recibe `cipher` | Aceptada. Lo exige R21 (tachar también el App Secret) |
| `markDeleted` `false` tras el `ok` de Meta ⇒ `{ id }` | Aceptada. Meta ya la borró |
| Cron con `isOn`/`findLive` dentro del `try` por empresa | Aceptada. Cumple mejor R33 |
| U+0000 rechazado en el validador (`invalid_chars`) | Aceptada. Es más estricto que R7–R13, la base no lo guardaría y no contradice ningún requisito |
| Lista de idiomas de 111 en vez de 71 | Aceptada en el fondo (P3 + contraste con Meta), pero ver m2 |
| `deleted` del resumen sale del plan (puede pasarse en 1 en una carrera) | Aceptada como menor (m3) |
| Doble `canned`: no refleja un `APPROVED` llegado por webhook | No bloquea QC-242, pero tiene que llegar a QC-243 (m1) |

### Hallazgos

**m1 — menor (efecto en QC-243). El doble `canned` no refleja un `APPROVED` llegado por webhook.**
El doble guarda cada plantilla con `status: 'PENDING'` y nada lo cambia. Cuando un webhook la
aprueba, solo cambia la fila local: una sincronización posterior (manual o por un id desconocido)
la vuelve a `PENDING`. Para QC-242 no es un defecto: `design.md > 6` define el doble como crear,
listar, borrar y `e2e_repetida`, y R27 impide que la sincronización escriba en Meta. Pero el
E2E de QC-243 («crear, ver pendiente, simular la aprobación por webhook») se rompe si después
sincroniza. Hoy el aviso solo está en la bitácora del implementer. **El leader tiene que llevarlo
a un sitio que QC-243 lea:** `progress/features/QC-242.md > Cierre` (deudas que deja) o
`progress/deudas.md`, y citarlo en el `Lo que ya existe` del spec de QC-243. Allí se decide, por
ejemplo, exportar un `setCannedTemplateStatus` para que el E2E simule la aprobación también en el
doble.

**m2 — menor. `design.md > 3.2` quedó desfasado respecto del código.** R8 remite a «la lista de
`design.md > 3.2`», que tiene 71 códigos. `whatsapp-template-languages.ts` acepta 111, tras el
contraste con Meta anotado en la bitácora. El §3.2 pedía anotar las diferencias y se anotaron,
pero el spec y el código quedan diciendo cosas distintas. Hay que actualizar el bloque de §3.2, o
hacer que remita al archivo de idiomas y a la bitácora del 2026-10-20.

**m3 — menor. El resumen puede contar de más en `deleted`.** Una fila creada entre `startedAt` y
`listForSync` entra en `plan.deletes`. El adaptador no la borra (`createdAt < startedAt`), pero
el resumen la cuenta. R25 pide «cuántas marcó eliminadas». Solo pasa en una carrera, la bitácora
lo declara y arreglarlo cambiaría el puerto (`applySync` devolvería los conteos reales). Puede
quedar como deuda.

**m4 — menor. `createMany({ skipDuplicates: true })` también se salta en silencio un choque con el
único parcial de nombre e idioma.** `ON CONFLICT DO NOTHING` sin destino cubre todos los índices
únicos. Si un snapshot nuevo choca en nombre e idioma con una viva que no se borra en esa vuelta
(protegida por R26 o creada después de `startedAt`), no se inserta pero cuenta en `imported`. La
próxima sincronización lo corrige. Es un caso raro; basta con anotarlo como deuda.

**m5 — menor (pendiente de CI).** Los tres `.int` nuevos y los dos ajustados no se han ejecutado
nunca, y `pnpm run db:rollback` no se ha ejercitado. La revisión estática no encuentra fallos (ver
arriba). Si `gate-completo` sale rojo en alguno de ellos, el merge queda bloqueado y vuelve al
implementer.

**m6 — menor. No hay E2E de Playwright para un flujo crítico (webhooks).** La excepción está en
`design.md > 14.1` y la sustituye un `.int` que pasa por la ruta firmada real. Se acepta, como en
QC-238. El E2E llega con QC-243.

**m7 — menor (cosmético).** El caso `R14 R17: crear con el doble canned…` de
`whatsapp-template-flow.int` no ejercita R17: el doble devuelve la categoría que se pidió. R17 sí
está cubierto en `create-whatsapp-template.test.ts`. Basta con quitar `R17` de ese nombre.

**m8 — menor.** `syncFailureCodeOf` toma como «código del catálogo» cualquier `code` de texto de
la excepción. Un `P2034` de Prisma o un `ECONNRESET` de Node llegarían tal cual a las líneas de
log del cron, del alta y del reintento. No filtra secretos ni mensajes; solo ensucia el código del
log.

**m9 — menor (abierto, no del implementer).** Sigue `[POR CONFIRMAR]` cuántos crons admite el plan
de Vercel (P9). `vercel.json` y `vercel-cron.test.ts` también los toca QC-137, del mismo autor;
se resolverá al integrar.

### Veredicto

**OK.** 0 bloqueantes, 9 menores. El merge sigue condicionado a `gate-completo` en verde (m5) y a
que el leader lleve m1 a un sitio que QC-243 lea.
