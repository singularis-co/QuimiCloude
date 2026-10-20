# impl QC-239 — vincular-whatsapp-con-clientes

Implementer, 2026-10-20. Todo lo hizo `backend_dev`; no hay UI nueva. En el formulario solo se
quitó el `case` del duplicado.

## Commits (rama `feature/QC-239-vincular-whatsapp-con-clientes`)

| Commit | Tasks |
|---|---|
| 66551ec9 | T1, T2: esquema, migración `20261020120000_customer_phone_numbers` con `down.sql`, `waIdCandidates`, `parseWaIdPhone` |
| 812345d3 | T3, T4 (parciales): puertos y adaptadores de teléfonos y contactos |
| e962a5c3 | T3, T4, T5: decisiones del humano en el spec, unidades de trabajo con exención estricta, `CUSTOMER_MODIFY_PERMISSION`, alta y edición sin duplicado |
| a16e81f8 | T6: relleno sin duplicados y reconversión de `duplicate` |
| 5a3fe1a6 | T7: vincular, desvincular, bloquear |
| 8d74ea2b | T8, T10: recepción con bloqueo y vínculo; restricciones de contactos |
| 5950edee | T9: Server Actions |
| 4a7c0e45 | T12: bitácora |
| (vuelta 1) | `fix(QC-239)`: M1, m1, m2, m4; T11 verde |

## Decisiones del humano tomadas durante la implementación (ya en requirements.md y design.md)

1. **Exención estricta por nombre** para `customer-unit-of-work-prisma.ts` (guardia de `clientes`)
   y `whatsapp-contact-unit-of-work-prisma.ts` (guardia de `integraciones`).
   - Tienen la misma forma que `order-unit-of-work-prisma.ts` (QC-141 D21).
   - En la guardia de `integraciones`, el caso R32 pasa de una entrada a dos, con nota fechada.
   - Cada guardia tiene casos de sensibilidad.
2. **La constante del permiso sale del barrel.** `clientes` exporta `CUSTOMER_MODIFY_PERMISSION`
   y `integraciones/domain/actor.ts` la importa. La lista cerrada de R26 en `scope.test.ts` no se
   amplió.

## Archivos

**Producción**
- Base de datos:
  - `db/schema.prisma`
  - `db/migrations/20261020120000_customer_phone_numbers/{migration,down}.sql`
- `lib/modules/clientes/`:
  - `domain/`: `phone-matches-wa-id.ts`, `customer-phone.ts`, `customer-phone-links.ts` (nuevo),
    `create-customer.ts`, `update-customer.ts`, `errors.ts`, `actor.ts`,
    `legacy-phone-backfill.ts`, `backfill-legacy-phones.ts`
  - `ports/`: `customer-phone-repository.ts`, `customer-write-repository.ts` y
    `customer-unit-of-work.ts` (los tres nuevos); `customer-repository.ts` y
    `legacy-phone-repository.ts` (modificados)
  - `adapters/driven/persistence/`: `customer-phone-prisma.ts` y
    `customer-unit-of-work-prisma.ts` (nuevos); `customer-prisma.ts`, `company-scope.ts` y
    `legacy-phone-prisma.ts` (modificados)
  - `index.ts`
- `lib/modules/integraciones/`:
  - `domain/`: `whatsapp-contact-link.ts`, `refresh-whatsapp-contact-links.ts`,
    `whatsapp-contact-input.ts`, `link-whatsapp-contact.ts`, `unlink-whatsapp-contact.ts` y
    `set-whatsapp-contact-blocked.ts` (nuevos); `actor.ts`, `errors.ts` y
    `receive-whatsapp-webhook.ts` (modificados)
  - `ports/`: `whatsapp-contact-repository.ts`, `customer-phone-owners.ts`,
    `customer-phone-links.ts` y `whatsapp-contact-unit-of-work.ts` (nuevos);
    `whatsapp-inbox-repository.ts` (modificado)
  - `adapters/driven/persistence/`: `whatsapp-contact-prisma.ts` y
    `whatsapp-contact-unit-of-work-prisma.ts` (nuevos); `whatsapp-inbox-prisma.ts` (modificado)
  - `adapters/driving/whatsapp-contact-actions.ts` (nuevo)
  - `index.ts`
- `lib/modules/errores/domain/error-codes.ts` y `error-catalog.ts`: salen
  `customer_duplicate_phone` y entran `whatsapp_contact_not_found` y
  `whatsapp_contact_number_invalid`.
- `lib/composition/index.ts`
- `app/(private)/clientes/components/customer-form.tsx`: solo se quita el `case` del duplicado.
- `scripts/backfill-customer-phones.ts`

**Tests nuevos**
- `tests/unit/clientes/`: `customer-phone-links.test.ts` y
  `schema/customer-phone-numbers-migration.test.ts`
- `tests/integration/clientes/`: `customer-phone-numbers.int.test.ts`,
  `customer-phone-numbers-migration.int.test.ts` y `customer-phone-shared.int.test.ts` (este
  último es `customer-phone-uniqueness.int.test.ts` renombrado y reescrito)
- `tests/unit/integraciones/whatsapp/`: `whatsapp-contact-link.test.ts`,
  `refresh-whatsapp-contact-links.test.ts`, `link-whatsapp-contact.test.ts`,
  `unlink-whatsapp-contact.test.ts`, `set-whatsapp-contact-blocked.test.ts` y
  `whatsapp-contact-actions.test.ts`
- `tests/integration/integraciones/whatsapp-contact-links.int.test.ts`

**Tests ajustados (de QC-236 y otros)**
- `tests/unit/clientes/`: `phone-matches-wa-id.test.ts`, `customer-phone.test.ts`,
  `customer-service.test.ts` (sale R12 de QC-236, entra R7), `authorization.test.ts`,
  `customer-actions.test.ts`, `list-customers.test.ts`, `legacy-phone-backfill.test.ts`,
  `legacy-phone-prisma.test.ts`, `schema/customers-phone-migration.test.ts`,
  `schema/customers-schema.test.ts` y `scope.test.ts`
- `tests/integration/clientes/`: `customers-phone-migration.int.test.ts` (el R14 de QC-236 se
  comprueba tras el DOWN nuevo), `customers-migration.int.test.ts`,
  `customer-repository.int.test.ts`, `list-query-customers.int.test.ts` y
  `legacy-phone-backfill.int.test.ts`
- `tests/integration/integraciones/`: `whatsapp-messages-migration.int.test.ts`,
  `whatsapp-inbox-prisma.int.test.ts`, `whatsapp-webhook-route.int.test.ts` y
  `whatsapp-messages-constraints.int.test.ts`
- `tests/ui/clientes/customer-phone-field.test.tsx`
- `tests/unit/errores/catalogo.test.ts` (107 códigos)
- `tests/unit/integraciones/`: `module-shape.test.ts`, `whatsapp/authorization.test.ts`,
  `whatsapp/receive-whatsapp-webhook.test.ts` y `whatsapp/whatsapp-doubles.ts`
- `tests/unit/identity/session-once-per-request-actions.test.ts`
- `e2e/clientes-telefono.spec.ts` (R7: el duplicado «se guarda»)

**Guardias y listas cerradas tocadas** (todas tensadas o ampliadas con nota fechada; ninguna se
relajó, salvo la exención aprobada en el punto 1)
- `tests/guards/guard-ambito-empresa-clientes.test.ts`: puertos nuevos, `db.`, 4 envolturas y la
  exención estricta.
- `tests/guards/guard-ambito-empresa-integraciones.test.ts`:
  - `WhatsappContactRepository`;
  - el inbox se lee de su fábrica, con `findBlockedWaIds` vigilada;
  - la segunda exención.
- `tests/guards/guard-identificador-de-request.test.ts`: lista de migraciones.
- `tests/integration/aislamiento.json`
- `tests/unit/clientes/scope.test.ts`: migraciones y archivos del módulo.

## Mapa R<n> -> test

Abreviaturas:
- **U-** = `tests/unit/`
- **I-** = `tests/integration/`
- **mig** = `clientes/schema/customer-phone-numbers-migration.test.ts`
- **migI** = `clientes/customer-phone-numbers-migration.int.test.ts`
- **cpl** = `clientes/customer-phone-links.test.ts`
- **cpn** = `clientes/customer-phone-numbers.int.test.ts`
- **svc** = `clientes/customer-service.test.ts`
- **lbf** = `legacy-phone-backfill`
- **wcl** = `integraciones/whatsapp/whatsapp-contact-link.test.ts`
- **rfr** = `integraciones/whatsapp/refresh-whatsapp-contact-links.test.ts`
- **lnk / unl / blk** = los tests unitarios de vincular, desvincular y bloquear
- **links** = `integraciones/whatsapp-contact-links.int.test.ts`
- **inbox** = `integraciones/whatsapp-inbox-prisma.int.test.ts`
- **route** = `integraciones/whatsapp-webhook-route.int.test.ts`
- **cons** = `integraciones/whatsapp-messages-constraints.int.test.ts`
- **act** = `integraciones/whatsapp/whatsapp-contact-actions.test.ts`
- **auth** = `integraciones/whatsapp/authorization.test.ts`

| R | Test |
|---|---|
| R1 | U-mig «R1: phone_numbers guarda solo digitos…», «R1: la tabla puente une cliente y numero…», «R1, R48: …company_id», «R1, R48: …@module clientes»; I-migI «R1: phone_numbers solo admite digitos…» |
| R2 | I-cpn «R2: un cliente guarda un principal y un secundario…», «R2: dos clientes vivos … UNA sola fila de phone_numbers» |
| R3 | U-mig «R3: los dos indices unicos parciales…» (+ sensibilidad); I-migI «R3: la base rechaza el mismo numero vivo dos veces…»; I-cpn «R3: un segundo principal vivo…», «R3: los indices son parciales…», «R3, R9 — un choque … se reintenta una vez», «R3 — si el reintento vuelve a chocar, el error sube…» |
| R4 | I-cpn «R4: removeLinks marca deleted_at…» |
| R5 | U-mig «R5: copia vivos con phone_e164 como principal…», «R5, R7: el indice unico … se retira despues de la copia»; I-migI «R5: la copia crea el numero y el vinculo principal…» |
| R6 | U-mig «R6: deshace los repetidos…», «R6: recrea el indice unico…», «R6: revierte en orden inverso…»; I-migI «R6, R48: UP, DOWN y UP otra vez…», «R6: tras el UP dos clientes vivos comparten numero; el DOWN…», «R6: empate de fecha…» |
| R7 | U-svc «R7 (QC-239) — dos altas con el mismo numero se guardan…»; I-`clientes/customer-phone-shared.int.test.ts` «R7 (QC-239) — dos altas … UNA sola fila…», «R7 (QC-239) — editar un cliente al numero que ya tiene otro…»; E2E `clientes-telefono.spec.ts` «R2, R11, R29, R7 (QC-239) — … la misma alta otra vez también se guarda» |
| R8 | I-cpn describe «R8 — el espejo y la tabla puente no divergen tras ningun escritor» (alta, edición, vincular, desvincular, anti-placebo); I-`clientes/lbf.int.test.ts` `esperarInvariante` en «R13, R8 …» y «R49, R8 …»; U-`clientes/legacy-phone-prisma.test.ts` «R8, R13, R49 — cada fila escrita con numero recibe su vinculo main…» |
| R9 | U-svc «R9 (QC-239) — el alta con numero crea el cliente y su vinculo principal en la MISMA unidad…», «…sin numero…»; I-cpn «R9 — un fallo dentro de la unidad … no deja ni el cliente ni el vinculo» |
| R10 | U-cpl «cambiar el numero deja el anterior como secundario…», «si el numero nuevo ya era un secundario, se promueve…», «un cliente sin principal que recibe numero…»; U-svc «R21, R10 (QC-239) …»; I-links «R10, R21, R22: el contacto del numero anterior sigue vinculado…» |
| R11 | U-cpl «vaciar el numero quita el principal…», «vaciar el numero de un cliente sin principal…»; U-svc «R11, R21 (QC-239) — la edicion que vacia el numero…», «R11 (QC-239) — los telefonos se sincronizan con el `after`…» |
| R12 | U-cpl «guardar el mismo numero no cambia ningun vinculo»; U-svc «R21, R12 (QC-239) …» |
| R13 | U-`clientes/lbf.test.ts` «R13 — varias filas con el mismo numero salen TODAS con su phone_e164…», «R13 — ningun resultado sale con phone_issue duplicate»; U-`legacy-phone-prisma.test.ts` «R13, R49 — … cuenta convertidas, invalidas y reconvertidas»; I-lbf «R13, R8 — convierte las validas aunque compartan numero…» |
| R14 | I-cpn describe «R14 — …» (2 casos, vuelta 1 de review): en cada paso (alta, edición que cambia, vincular secundario, desvincular el principal, editar y vaciar; migrado con aviso y pendiente sin aviso, con vincular/desvincular) lo que leen la lista (`clientes.listCustomers`) y el formulario (`clientes.getCustomer`) —las cuatro columnas `phone*` y `describeCustomerPhone`— coincide con el principal de la tabla puente o, sin él, con el teléfono antiguo y su aviso. Además E2E «R30 — …» y `customer-phone-field.test.tsx` |
| R15 | U-wcl «R15, R22: un contacto sin cliente cuyo numero tiene un solo dueno…», «R15: un vinculo automatico cuyo cliente sigue siendo el unico dueno no cambia»; I-inbox «R15: con un unico dueno…»; I-route «R15: un texto de un numero con un unico cliente…» |
| R16 | U-wcl «R16: … no tiene dueno…», «R16: … tiene varios duenos…»; I-inbox «R16: sin duenos o con varios…» |
| R17 | U-wcl «R17: un cliente dado de baja no esta entre los duenos…»; I-cpn «R17: excluye al cliente dado de baja, al vinculo quitado y al cliente de otra empresa», «R17, R19 — …variante de Mexico»; I-inbox «R17: …» |
| R18 | U-wcl «R18, R24: un vinculo automatico se pierde…», «R18, R24: un vinculo manual se conserva…», «R18: un vinculo manual … no se convierte en automatico»; I-inbox «R18: con varios duenos…» |
| R19 | U-`clientes/phone-matches-wa-id.test.ts` «QC-239 R19 — propiedad: todo candidato coincide…», «QC-239 R19 — propiedad: todo numero … que coincide esta entre los candidatos»; I-inbox «R19: un wa_id mexicano con 521…» |
| R20 | I-inbox «R20: si la busqueda de duenos falla no queda nada del lote…» |
| R21 | U-rfr «R21, R22: …», «R21: busca los contactos por todas las variantes…», «R21: solo toca los contactos cuyo numero coincide…», «R21: un contacto cuyo vinculo ya es el que da la regla no se escribe», «R21: los duenos se piden con la empresa del ambito…»; U-svc «R21 (QC-239) — el alta recalcula…», «…un fallo del recalculo sube…»; I-links «R10, R21, R22», «R21, R23: la edicion que vacia el numero desvincula sus contactos» |
| R22 | U-rfr «R21, R22: un contacto sin cliente cuyo numero pasa a tener un unico dueno…»; U-wcl «R15, R22»; I-links «R22: un contacto sin cliente queda vinculado como automatico…» |
| R23 | U-rfr «R23: al quitar un numero de un cliente, su contacto con vinculo manual pasa al unico dueno…», «R23: al quitar el numero de su unico dueno…»; U-wcl, los tres casos «R23»; I-links «R23: …» |
| R24 | U-rfr «R24: cuando otro cliente anade el numero…»; U-wcl «R18, R24»; I-links «R24: cuando otro cliente anade el numero, el contacto automatico queda sin cliente y el manual se conserva» |
| R25 | U-rfr «R25: sin numeros anadidos ni quitados no lee ni modifica ningun contacto» |
| R26 | U-lnk «R26: deja el contacto con el cliente como vinculo manual…», «R26: un contacto con vinculo automatico a otro cliente pasa a manual…»; I-links «R26, R27, R28: vincular a un cliente sin telefono…» |
| R27 | U-cpl «R27, R28: sin principal, el numero entra como principal…», «R27: con principal, el numero entra como secundario…»; I-links «R26, R27, R28», «R27, R28: … telefono antiguo con aviso…», «R27: … ya tiene principal anade el numero como secundario…» |
| R28 | U-cpl «R27, R28»; I-links «R26, R27, R28» y «R27, R28: … telefono antiguo con aviso…» (reemplaza el texto antiguo, decisión del humano) |
| R29 | U-cpl «…coincide (variante de Mexico)…»; U-lnk «R29: si el cliente ya tenia el numero, no se recalcula…»; I-links «R29: … Mexico sin el 1 frente al wa_id con el 1…» |
| R30 | U-`clientes/customer-phone.test.ts` «QC-239 R30 — …» (6 casos); U-cpl «R30: un wa_id que no es telefono valido…»; U-lnk «R30: … whatsapp_contact_number_invalid y no vincula» |
| R31 | U-cpl «R31: un cliente que no esta vivo en la empresa responde customer_not_found…»; U-lnk «R31: si el cliente no existe…», «R31: un customerId sin forma de uuid, o ausente…»; I-links «R45, R31: un cliente de otra empresa responde customer_not_found…» |
| R32 | U-lnk, U-unl, U-blk: contacto inexistente y contacto de otra empresa responden igual; un id que no es uuid, también |
| R33 | U-lnk «R33: recalcula con los numeros anadidos…»; I-links «R33: un fallo despues de escribir el vinculo deshace el vinculo, el numero anadido y el telefono mostrado» |
| R34 | U-cpl «quita todos los telefonos que coinciden…», «sin ningun telefono que coincida…»; U-unl, tres casos «R34: …»; I-links «R34, R35: quita el numero del cliente con borrado logico…», «R34: si el numero tiene otro dueno unico…» |
| R35 | U-cpl «si el telefono quitado era el principal…»; I-links «R34, R35: … ningun secundario ocupa su lugar» |
| R36 | U-unl «R36: un contacto sin cliente no cambia nada y responde exito»; un caso en I-links |
| R37 | U-blk, cuatro casos de bloquear y desbloquear; I-links «R37, R38, R42: bloquear marca fecha y usuario…» |
| R38 | U-blk; I-links «R37, R38, R42» |
| R39 | I-inbox «R39: el mensaje de un contacto bloqueado no se guarda…»; I-route «R39: un texto de un contacto bloqueado responde 200 sin cuerpo…»; U-`receive-whatsapp-webhook.test.ts` «R39, R41: los mensajes que el inbox descarta por bloqueo no cuentan…» |
| R40 | I-inbox «R40: con un contacto bloqueado los statuses de sus salientes se aplican y lastWebhookAt se anota»; U-receive «R40: con todo el lote descartado por bloqueo los statuses se siguen contando» |
| R41 | I-inbox «R41: en un lote con un contacto bloqueado y otro que no lo esta solo se guardan los del no bloqueado» |
| R42 | I-links «R37, R38, R42» (contacto y mensaje siguen tras bloquear, desbloquear y desvincular); U-blk «R42: bloquear y desbloquear no tocan el vinculo» |
| R43 | U-auth, bloque QC-239 «R43: {vincular\|desvincular\|bloquear\|desbloquear} con {actor nulo\|indefinido\|sin empresa\|sin permisos\|solo integraciones.modificar} rechaza…», «R43: con clientes.modificar y el anadido activo pasa…»; U-lnk, U-unl, U-blk (Proxy: no lee la entrada ni llama a ningún puerto) |
| R44 | U-auth «R44: {operación} con {anadido apagado\|otro anadido\|sin lista} rechaza…», «R44: sin el anadido la respuesta es identica a la de sin permiso»; U-act «R46, R44 — el actor lleva … los añadidos de la sesion»; U-lnk, U-unl, U-blk |
| R45 | I-cpn «R45: con el ambito de otra empresa el cliente no esta vivo…», «R45: quitar, cambiar el principal y escribir el espejo con el ambito de otra empresa no tocan nada», «R45, R47 — anadir un telefono con el ambito de otra empresa lo rechaza la FK compuesta…»; I-links, los dos casos «R45: …»; U-cpl «la empresa que recibe como cadena llega al puerto…»; las guardias de ámbito de `clientes` e `integraciones` |
| R46 | U-act: «cada accion con exito devuelve `success` y no revalida ninguna ruta», «la entrada baja tal cual al caso de uso…», «el actor lleva usuario, empresa, permisos y los añadidos», «sin sesion el actor baja nulo…», «cada error de dominio se traduce por su codigo…», «un error ajeno al dominio sale como `unexpected`…», «el borde no decide ni tiene pantalla…» |
| R47 | U-mig «R47: FK compuestas con company_id…», «R47: ninguna FK … es simple»; I-migI, los dos casos «R47: …»; I-cons «R47: un contacto de A con un cliente de B lo rechaza la FK compuesta…», «R47: mover un contacto de A a un cliente de B…», «R47 (control)…» |
| R48 | U-mig «R48: el detector muerde -sin FORCE…», «R48: identificadores en ingles…», «R48: whatsapp_contacts gana customer_linked_by, blocked_at y blocked_by…»; I-migI «R48: las dos tablas nuevas tienen RLS activada y forzada…», «R48: los CHECK del contacto…»; I-cons, casos `whatsapp_contacts_customer_link_check` y `whatsapp_contacts_blocked_check` |
| R49 | U-lbf «R49 — una fila con su propio pais se lee con el suyo…», «R49 — … ya no es valido sale invalid_format…», «R49 — suma los reconvertidos…»; U-`legacy-phone-prisma.test.ts`, cuatro casos «R49 — …»; I-lbf «R49, R8 — la duplicate valida queda con su numero y su principal…» (0 vivas en `duplicate`; las `invalid_format`, byte a byte iguales), «R49 — la segunda pasada no cambia ninguna fila ni ningun vinculo…». El R27 de QC-236 sigue verde en el mismo archivo |

## Salida de los tests corridos

Por decisión del humano (2026-10-20), cada task corrió solo sus archivos, en serie. El gate
completo lo corre GitHub en el PR. Typecheck y lint, al cierre de cada task:
- `pnpm run typecheck`: `tsc --noEmit` sin errores.
- `pnpm run lint`: `✖ 10 problems (0 errors, 10 warnings)`. Los 10 avisos ya estaban y caen en
  archivos que esta feature no toca.

| Task | Comando | Resultado |
|---|---|---|
| T1 | `vitest run customer-phone-numbers-migration.int.test.ts` | Test Files 1 passed, Tests 10 passed (10) |
| T1 | 5 tests de migración afectados | Test Files 5 passed, Tests 28 passed (28) |
| T1 | unitarios de esquema | 5 passed / 58 passed |
| T2 | `phone-matches-wa-id.test.ts`, `customer-phone.test.ts` | 2 passed / 40 passed |
| T1–T2 | guardias (corrida aislada) | Test Files 83 passed, Tests 1142 passed, 21 skipped |
| T3 | `customer-phone-links`, guardia de clientes y tests unitarios de clientes | guardia 42/42; resto verde, salvo R26 de `scope`, resuelto en T5 |
| T3 | 4 `.int` de clientes | 4 passed / 45 passed |
| T4 | `wcl`, `rfr`, `catalogo`, guardia de integraciones | Test Files 4 passed, Tests 132 passed |
| T5 | 16 archivos: 2 guardias de ámbito, `guard-catalogo-de-errores`, `scope`, `catalogo`, `customer-phone-field`, tests unitarios de clientes, 4 `.int` de clientes y los 2 de T4 | Test Files 16 passed (16), Tests 411 passed (411) |
| T5 | `guard-aislamiento-integracion` | Test Files 1 passed, Tests 6 passed (6) |
| T6 | `lbf.test.ts` / `legacy-phone-prisma.test.ts` / `lbf.int.test.ts` / guardia de clientes | 14/14, 6/6, 8/8, 50/50 |
| T7 | lnk, unl, blk + `module-shape` | Test Files 4 passed, Tests 138 passed, 1 skipped (R22 de `module-shape`, solo corre en la rama de QC-234) |
| T7 | `whatsapp-contact-links.int.test.ts` | Tests 16 passed (16) |
| T7 | guardia de integraciones + aislamiento | 68 passed |
| T8/T10 | receive + `module-shape` + guardia de integraciones | Test Files 3 passed, Tests 192 passed, 1 skipped |
| T8/T10 | inbox / route / cons | 20/20 (11 de QC-238), 20/20, 19/19 |
| T8/T10 | `guard-aislamiento-integracion` | 6/6 |
| T9 | act + auth + `module-shape` + `session-once-per-request-actions` | Test Files 4 passed (4), Tests 284 passed, 1 skipped (285) |

### T11: E2E

Primera corrida, del 2026-10-20: cayó porque la base de desarrollo compartida aún no tenía la
migración (`The table … does not exist`). El humano la migró. Segunda corrida, en vuelta 1 de review:

```
$ pnpm exec playwright test e2e/clientes-telefono.spec.ts --project=chromium --workers=1 --reporter=line
[1/5] … R2, R11, R29, R7 (QC-239) — empresa con CO: … la misma alta otra vez también se guarda
[2/5] … R9 — un número no válido para Colombia se marca en el campo y no se guarda
[3/5] … R3, R8 — empresa sin país: …
[4/5] … R30 — los clientes sembrados con phone_issue muestran su teléfono antiguo y la etiqueta corta en la lista
[5/5] … R33 — a 390 px el disparador dice CO +57 y la hoja se titula «País del teléfono»
  5 passed (1.3m)
```

`e2e/integraciones-whatsapp.spec.ts` no hace POST al webhook. El flujo crítico del webhook lo cubre
`whatsapp-webhook-route.int.test.ts` sobre la composición (design § 12.3).

## Vuelta 1 de review (`progress/review_QC-239.md`)

- **B1/M1:** `tests/unit/integraciones/encryption-keys-env.test.ts` y
  `tests/unit/composition/integraciones-graph-doubles.test.ts` ganan `linkWhatsappContact`,
  `setWhatsappContactBlocked` y `unlinkWhatsappContact`.
  - La lista ordenada pasa a 23 claves y sigue comparándose con `toEqual` exacto. Lleva la nota
    «Enmendado el 2026-10-20 (QC-239)».
  - Se barrieron con grep las enumeraciones de las fachadas y barrels de `clientes` e
    `integraciones` en `tests/`. Solo esas dos fijaban listas exactas. `module-shape.test.ts` ya
    incluía el contrato nuevo. La fachada `clientes` de la composición no cambia de claves.
  - `CustomerDuplicatePhoneError`, `TakenE164` y `customer_duplicate_phone` solo quedan en
    aserciones de ausencia.
- **m1:** hay un caso directo de R14 (ver el mapa).
- **m2:** design § 12.3 recoge el cambio de T8 en la guardia de `integraciones`: la lectura del
  inbox por fábrica y `findBlockedWaIds`.
- **m3, deuda conocida:** `isCustomerPhoneLinkConflict` está duplicado en
  `clientes/.../customer-phone-prisma.ts` y en `integraciones/.../whatsapp-contact-prisma.ts`.
  - Está justificado: `integraciones` no puede importar un adaptador de `clientes`, y el archivo
    exento solo admite una función.
  - Riesgo: si una copia cambia y la otra no, el reintento diverge.
  - Salida futura: una función en `lib/composition` que se pase a las dos unidades de trabajo.
- **m4, el choque es real y está arreglado:**
  - Con Prisma 6.19.3, el `phoneNumber.upsert` de `addLink` **no** sale como `ON CONFLICT` nativo.
    El log de queries muestra `SELECT … WHERE company_id = $1 AND e164 = $2` y luego
    `INSERT INTO phone_numbers …`.
  - Dos altas simultáneas con el mismo número nuevo chocaban en
    `phone_numbers_company_id_e164_key`. La segunda fallaba con `P2002 (company_id, e164)`, sin
    reintento.
  - El arreglo: los dos detectores reconocen también `P2002` con `modelName: 'PhoneNumber'` y la
    columna `e164`, así que la unidad de trabajo reintenta una vez. Releer el existente dentro de
    `addLink` no sirve: tras el `P2002` la transacción queda abortada.
  - Tests de concurrencia, con el orden forzado esperando el `Lock` en `pg_stat_activity`:
    - `customer-phone-numbers.int.test.ts` y `whatsapp-contact-links.int.test.ts` (prefijo R33);
    - en los dos, la segunda unidad reintenta una vez (2 intentos), queda una sola fila en
      `phone_numbers` y los dos clientes son dueños;
    - contraprueba: con el detector de `integraciones` revertido, el test falla.
  - **El relleno, resuelto (decisión del humano, 2026-10-20):** `legacy-phone-prisma.ts`
    reconoce el mismo `P2002` (reutiliza `isCustomerPhoneLinkConflict` del mismo módulo) y
    reintenta la transacción **una vez**. El reintento relee las candidatas y repite la condición
    de candidata y el `updatedAt`. Si vuelve a chocar, el error sube; cualquier otro error sube sin
    reintentar. Design § 5.6 y requirements («Decisiones cerradas») ya lo recogen.
    - Unitarios en `legacy-phone-prisma.test.ts`:
      - «R13, R49 — un choque en phone_numbers reintenta UNA vez en una transaccion nueva que relee las candidatas»
      - «R13, R49 — si el reintento vuelve a chocar, el error sube sin un tercer intento»
      - «R13, R49 — cualquier otro error sube sin reintentar»
    - Integración en `legacy-phone-backfill.int.test.ts`: «R13, R49 — el relleno espera al alta,
      choca en phone_numbers_company_id_e164_key y su unico reintento reutiliza el numero».
      - Hay 2 intentos y el resumen es `{converted:1, invalid:0, reconverted:0}`.
      - Queda una fila en `phone_numbers` y los dos clientes son dueños.
      - El `updatedAt` se conserva y el espejo se cumple.
      - Contraprueba: sin el reintento el caso falla con `Unique constraint failed on the fields:
        (company_id,e164)`.
    - Resultados: `legacy-phone-prisma.test.ts` 9/9, `legacy-phone-backfill.int.test.ts` 9/9 y
      `guard-ambito-empresa-clientes` 50/50. Typecheck limpio después de regenerar
      `.next/dev/types`, que el `next dev` del E2E dejó corrupto. Lint con 0 errores.
- **m5, excepción aceptada (decisión del humano, 2026-10-20):** la ficha no tiene E2E propio del
  webhook. Lo cubre `whatsapp-webhook-route.int.test.ts`, que va sobre la composición y contra
  Postgres. El E2E completo llega con QC-246. Está anotado en requirements («Decisiones
  cerradas»).

| Comando (en serie) | Resultado |
|---|---|
| `pnpm run typecheck` | `tsc --noEmit` sin errores |
| `pnpm run lint` | `✖ 10 problems (0 errors, 10 warnings)`, los mismos avisos ajenos |
| `vitest run encryption-keys-env.test.ts` | 1 passed / 28 passed |
| `vitest run integraciones-graph-doubles.test.ts` | 1 passed / 5 passed |
| `vitest run customer-phone-numbers.int.test.ts` | 1 passed / 28 passed (25 + 2 de R14 + 1 de concurrencia) |
| `vitest run whatsapp-contact-links.int.test.ts` | 1 passed / 17 passed |
| `vitest run guard-ambito-empresa-clientes.test.ts` | 1 passed / 50 passed |
| `vitest run guard-ambito-empresa-integraciones.test.ts` | 1 passed / 67 passed |

## Rojos conocidos y pendientes para el reviewer

- **Lo que cambió en las guardias de integraciones (T8):** el inbox se cablea por fábrica
  (`createWhatsappInboxRecorder({ ownersOn })`), como pide design § 7. Para que eso encaje, la
  guardia lee ahora `PUERTO_INBOX` de esa fábrica, vigila `findBlockedWaIds` y suma casos de
  sensibilidad. No quita ningún control, pero el cambio no estaba listado en § 12.3.
- El detector del choque de índice único (`P2002` + `CustomerPhoneNumber` + `customer_id`) está
  duplicado en `customer-phone-prisma.ts` y en `whatsapp-contact-prisma.ts`. `integraciones` no
  puede importar un adaptador de `clientes`, y el archivo exento solo admite una función.
- `contactInputError`:
  - si `customerId` falta o no tiene forma de uuid, responde `customer_not_found`;
  - si `contactId` no la tiene, responde `whatsapp_contact_not_found`.
  - El spec solo fija el caso del uuid sin forma.
- El barrel de `integraciones` exporta también los tres errores de contacto (design § 1 solo
  nombra las fábricas y la regla).
- Desde T2, `parseWaIdPhone` devuelve la forma que normaliza `libphonenumber-js`: México sin el 1
  y Brasil con el 9.
- Se ajustaron tests ajenos de ciclo DOWN/UP (`customers-migration.int`,
  `whatsapp-messages-migration.int`). Ahora reaplican las migraciones posteriores que hacen
  `ALTER TABLE … ADD COLUMN`.
- `./init.sh` no se corrió (decisión del humano: el gate lo corre GitHub en el PR).
