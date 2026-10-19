# QC-137 — sistema-de-notificaciones-por-rol · bitácora de implementación (backend_dev)

## Tanda 1 — Bloque A (T1, T2, T3)

Alcance: solo el Bloque A de `specs/QC-137-sistema-de-notificaciones-por-rol/tasks.md`. Bloques
B–G sin tocar. Sin dependencias nuevas. Sin commit (lo hace el leader).

### Archivos creados

| Archivo | Qué es |
| --- | --- |
| `db/migrations/20261019120000_notifications/migration.sql` + `down.sql` | T1: `notifications` y `notification_reads`, CHECK de un destinatario, de `event_key`, de `tone` y de `{hora}`↔`body_time`; `UNIQUE (company_id, dedupe_key)`, `UNIQUE (id, company_id)`, FK compuesta de lecturas en cascada, índices `(…, created_at DESC, id DESC)` y `(company_id, created_at)`, RLS activada y forzada. El down borra las dos tablas, hija primero |
| `db/migrations/20261019120100_notifications_addon/migration.sql` + `down.sql` | T2: migración de datos idempotente: permiso, asignación a los cuatro roles de empresa por nombre, fila en `addons` y excepción `enabled = true` en cada empresa existente (sin `WHERE`, como QC-277). El down borra exactamente esas filas, hijas primero |
| `lib/modules/identity/ports/company-membership-reader.ts` | T3: puerto `CompanyMembershipReader.isUserInCompany` |
| `lib/modules/identity/domain/is-user-in-company.ts` | T3: `createIsUserInCompany`; un id que no es UUID → `false` sin tocar el puerto |
| `tests/unit/identity/is-user-in-company.test.ts` | T3 unit |
| `tests/integration/identity/company-membership.int.test.ts` | T3 integración (otra empresa → `false`) |
| `tests/integration/notificaciones/notifications-schema.int.test.ts` | T1 |
| `tests/integration/identity/notifications-addon-migration.int.test.ts` | T2: R52, constantes, idempotencia y down |

### Archivos modificados

- Producción: `db/schema.prisma` (solo los dos modelos nuevos, al final, `/// @module notificaciones`),
  `lib/modules/identity/domain/permissions.ts` (entrada nueva, cuatro roles, párrafo del JSDoc;
  se quitan dos frases del JSDoc de `SEED_ROLE_PERMISSIONS` que dejaban de ser ciertas),
  `lib/modules/identity/domain/company-addons.ts`, `lib/modules/identity/index.ts`,
  `lib/modules/identity/adapters/driven/persistence/company-prisma.ts`
  (`createCompanyMembershipReader`, `findFirst` con `deletedAt: null`), `lib/composition/index.ts`
  (`identity.isUserInCompany`).
- Tests que fijaban el catálogo, el seed o «cinco añadidos» (actualizados, ver «Bloqueos y notas»):
  `tests/unit/identity/{permissions,company-actions,is-user-in-company}.test.ts`,
  `tests/unit/identity/addons/{company-addons,menu-recortado}.test.ts`,
  `tests/unit/identity/companies/{get-company-addons,set-all-company-addons,set-company-addon}.test.ts`,
  `tests/unit/identity/schema/{company-addons-migration,conditioning-role-migration}.test.ts`,
  `tests/unit/identity/seed/seed-initial-access.test.ts`, `tests/unit/navegacion/qc75-convenciones.test.ts`,
  `tests/unit/pedidos/qc146-alcance.test.ts`, `tests/unit/asignaciones/empacador-authorization.test.ts`,
  `tests/unit/asignaciones/schema/order-assignments-migration.test.ts`,
  `tests/integration/identity/{company-addons,conditioning-role-migration,identity-seed,session-user}.int.test.ts`,
  `tests/guards/guard-identificador-de-request.test.ts` (lista de migraciones esperadas),
  `tests/integration/aislamiento.json` (tres archivos nuevos, `transaccion`),
  `e2e/helpers/addons.ts` y `e2e/modulos-por-empresa.spec.ts` (solo textos «cinco»; no se corrió E2E).

### Mapa R<n> → test

| R | Test |
| --- | --- |
| R3 | `notifications-schema.int.test.ts` › «QC-137 R3: rechaza un dedupe_key repetido en la misma empresa y lo admite en otra» |
| R12 | `notifications-schema.int.test.ts` › «QC-137 R12: rechaza un aviso sin destinatario y uno dirigido a un rol y a un usuario a la vez» (+ admite uno solo; rol inexistente → FK). `is-user-in-company.test.ts` y `company-membership.int.test.ts` › «QC-137 R12: … false si es de otra empresa» |
| R14 | `notifications-schema.int.test.ts` › «QC-137 R14: rechaza una lectura con una empresa distinta a la del aviso» |
| R47 | `notifications-schema.int.test.ts` › «QC-137 R47: rechaza un body con {hora} sin body_time y un body_time sin {hora} en el body» |
| cascada (R17) | `notifications-schema.int.test.ts` › «QC-137 R17: borrar un aviso borra sus lecturas, y no las de otro aviso» |
| R18 | `tests/unit/identity/addons/company-addons.test.ts` › «QC-137 R18 — el permiso efectivo es rol ∩ añadido…»; `company-addons.int.test.ts` › «QC-137 R18: con el añadido prendido, el Administrador lo tiene efectivo; al apagarlo, la siguiente lectura lo pierde»; `permissions.test.ts` › «R18: el catalogo es el previo … mas notificaciones.consultar al final» |
| R20 | `company-addons.int.test.ts` › «QC-137 R20: una empresa dada de alta con createWithAdministrator nace con notificaciones apagado»; `notifications-addon-migration.int.test.ts` › «QC-137 R52, R20: una empresa dada de alta despues de la migracion no tiene el añadido» |
| R21 | `permissions.test.ts` › «R21: los cuatro roles de empresa lo reciben al final…», «R21: el Maestro no lo recibe…», «R21: ningun otro rol tiene el permiso»; `notifications-addon-migration.int.test.ts` › «QC-137 R18, R21: las filas que escribe coinciden con las constantes de la app» |
| R52 | `notifications-addon-migration.int.test.ts` › «QC-137 R52: tras aplicarla, cada empresa que ya existia, viva o de baja, tiene notificaciones prendido y sin autor» (+ idempotencia y down) |
| R53 | `company-addons.test.ts` › «QC-137 R53 — no depende de ningún otro añadido…» y «… ningún añadido depende de él…»; `set-company-addon.test.ts` › «QC-137 R53: prender y apagar notificaciones con integraciones apagada solo pide esa clave al puerto»; `set-all-company-addons.test.ts` › «QC-137 R53: prender todos incluye notificaciones…»; `company-addons.int.test.ts` › «QC-137 R53: prender y apagar notificaciones con integraciones apagada no exige ni cambia ningun otro añadido» |

### Verificación (salida real)

Ver la sección «Salidas» al final.

### Bloqueos y notas

1. **Sin bloqueos.**
2. **Puerto nuevo no listado en `Archivos esperados`:** `lib/modules/identity/ports/company-membership-reader.ts`.
   Añadir `isUserInCompany` a `CompanyRepository` obligaba a tocar los ~10 dobles de test de ese
   puerto. El adaptador sí vive en `company-prisma.ts`, como dice el design.
3. **Decisión de implementación a validar:** `isUserInCompany` responde `false` para un usuario
   dado de baja (`deletedAt` no nulo). El design solo dice «es de esa empresa»; se siguió el
   patrón de los `findFirst` de `identity` (`user-admin-prisma`, `work-group-prisma`).
4. **Texto no dado por el spec:** descripción del permiso, «Consultar los avisos propios y marcarlos
   como leídos.» (columna NOT NULL de `permissions`).
5. **Radio de la enmienda de R21:** sumar `notificaciones.consultar` a Operador, Empacador y
   Administrador de acondicionamiento rompe ~55 asserts de tests de fichas previas que fijan el
   conjunto exacto de cada rol o el catálogo. Se actualizaron con el patrón ya usado por
   `entregas.anular` (filtros «sin X» para los casos previos; asserts nuevos sobre los reales).
6. **`tests/unit/marca/tablas-marca.test.tsx` en rojo, ajeno:** compara el texto de
   `product-columns.tsx` (columna «Costo»), que este diff no toca. Sale por `vitest related` porque
   el diff toca `lib/composition/index.ts`. No está en `tests/baseline-rojos.json`.
7. Grafo de código: no se usó; exploración con Grep/Read.

### Salidas

```
$ pnpm run typecheck
> tsc --noEmit                     (sin errores)

$ pnpm run lint
✖ 10 problems (0 errors, 10 warnings)   (los 10 en archivos que este diff no toca)

$ pnpm exec vitest related --run --project node --project ui <23 archivos tocados>
 Test Files  1 failed | 690 passed (691)
      Tests  1 failed | 12540 passed | 22 skipped (12563)
 FAIL |ui| tests/unit/marca/tablas-marca.test.tsx > R11, R13: en 'product-columns.tsx' … (ajeno, nota 6)

$ pnpm exec vitest run --project integration tests/integration/notificaciones tests/integration/identity
test-db: plantilla lista: qct_tpl_a49a8f287bf6
test-db: la corrida de integracion va contra qct_qc137_f77f0a50_mvffz1mm_5xg (copia de qct_tpl_a49a8f287bf6).
 Test Files  32 passed (32)
      Tests  496 passed (496)

$ pnpm exec vitest run guard
 Test Files  80 passed (80)
      Tests  1096 passed | 20 skipped (1116)
```

**db:migrate / db:rollback** sobre una base desechable `qct_qc137_migcheck` (copia de la plantilla
de test ya migrada; borrada al terminar; la de desarrollo no se tocó):

- `db:rollback` → «20261019120100_notifications_addon revertida»: permiso, asignaciones, añadido y
  excepciones a 0; tablas siguen.
- `db:rollback` sobre la siguiente: el script elige la última carpeta del disco, no la última
  aplicada, así que vuelve a aplicar el down del añadido (sin efecto, avisa que no había fila).
  El down de `20261019120000_notifications` se aplicó con los mismos dos pasos que el script, en
  una transacción: tablas fuera, fila de `_prisma_migrations` borrada. `prisma migrate status`:
  «Following migrations have not yet been applied: 20261019120000_notifications,
  20261019120100_notifications_addon».
- `db:migrate` → «Applying migration 20261019120000_notifications», «Applying migration
  20261019120100_notifications_addon», «All migrations have been successfully applied». Segunda
  corrida: «No pending migrations to apply».
- `prisma migrate diff` base → esquema: de las tablas nuevas solo salen los `DROP CONSTRAINT` de las
  cinco FK escritas a mano (drift esperado, igual que `document_files`).

### Veredicto

Bloque A (T1, T2, T3) hecho: typecheck, lint, integración y guardias en verde; el único rojo de
`vitest related` es ajeno.
