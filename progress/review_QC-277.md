# Review QC-277 — modulos-por-empresa (F2.2, vuelta 1, completa)

Rango: `origin/dev...HEAD` (HEAD `c4d6030c`). El merge de dev con QC-285 (955e57be) no es de esta
ficha y no se revisa. Revisado contra `requirements.md` (R1–R38, D1–D16, P2–P7), `design.md`,
`tasks.md`, `progress/impl_QC-277.md`, `progress/features/QC-277.md`, `docs/architecture.md`,
`docs/conventions.md`, `docs/verification.md`, `docs/perfil-agentes.md`, `CHECKPOINTS.md` y
`docs/checkpoints-proyecto.md`.

## Verificación ejecutable (corrida por el reviewer, 2026-10-15)

| Comando | Resultado |
|---|---|
| `pnpm run typecheck` | exit 0 |
| `pnpm run lint` | exit 0, 0 errores, 7 avisos ya existentes (`confirm-catalog-import.test.ts` `_args` y `pedidos/order-service.test.ts`; esta rama no añade ninguno) |
| `pnpm exec vitest run guard` | 79 archivos, 1090 passed, 20 skipped, 0 rojos |
| `vitest run` de los 61 tests unitarios que toca el diff | 61 archivos, 1248 passed, 1 skipped, 0 rojos |
| `vitest run` de los 8 `.int` que toca el diff (pg17 :5433) | 8 archivos, 130 passed, 0 skipped |
| `playwright test e2e/modulos-por-empresa.spec.ts` (base `quimicloude_e2e_qc277`) | 10 passed (Chromium + WebKit), 59.8 s |

No he corrido la suite completa ni el E2E entero: los corre el CI.

## Checklist

### Especificación y tasks
- [x] `requirements.md` en EARS, R1–R38 numerados; D13–D16 con su autor y fecha.
- [x] `design.md` abre con `## Lo que ya existe`, con la búsqueda hecha (board, specs, código) y
  las filas del catálogo consultadas. El diff no re-crea nada de esa lista: reutiliza
  `filterNavItemsByPermissions`/`firstVisibleNavHref` (las une en `homeHrefFor`),
  `requirePagePermission` (nace su hermana), `company_events`, `atomically` y el patrón de
  `ai_providers`.
- [x] Alternativas descartadas con su porqué (§ 13, 11 entradas).
- [x] `tasks.md`: 31/31 `[x]`, ninguna `[ ]`.

### Trazabilidad R → test (comprobada abriendo cada test, no solo la bitácora)
- [x] R1, R2, R3: `tests/unit/identity/addons/company-addons.test.ts` (partición, cinco claves,
  `importacion_excel` vacío, el núcleo no se recorta). R2 (D13):
  `tests/guards/guard-catalogo-de-anadidos.test.ts` + `company-addons.int.test.ts` (tabla = ADDONS;
  clave `futuro` → 23503).
- [x] R4: `company-addons.test.ts` (`effectiveAddons`) + `run-document-job-addon.test.ts` (R4 x2) +
  `company-addons.int.test.ts > R4, R22 isCompanyAddonActive` + E2E caso 5.
- [x] R5: `company-addons.int.test.ts > R5` (cero filas tras `createWithAdministrator`).
- [x] R6, R38: `tests/unit/identity/schema/company-addons-migration.test.ts` (8 casos, con mutantes
  del SQL).
- [x] R7: `seed-initial-access.test.ts` (R7 x2) + `identity-seed.int.test.ts` (R7).
- [x] R8, R10, R11: `resolve-session.test.ts` (6 casos nuevos) + `session-user.int.test.ts` (espía:
  una sola llamada a `user.findFirst` y ninguna a `company`/`companyAddonOverride`).
- [x] R9: `company-addons.int.test.ts > R9` + `session-user.int.test.ts` + E2E caso 4.
- [x] R12: `menu-recortado.test.ts` + E2E caso 1.
- [x] R13: `require-page-addon.test.ts` + `guard-pantallas-de-anadido.test.ts` + las tres páginas
  (`importar-page`, `formula-import-page`, `catalog-import-page`) + E2E caso 2.
- [x] R14, R16: `inventory-import-addon.test.ts` (los cuatro casos de uso con dobles que fallan si se
  llaman) + `importar-page.test.tsx` + `product-page.test.tsx`.
- [x] R14, R15, R23: `import-addon.test.ts` (cuatro casos de uso de PDF) + las dos páginas de
  revisión (404 sin leer) + `formulas-upload.test.tsx` y `supplier-detail-upload.test.tsx`.
- [x] R17: `menu-recortado.test.ts` + `assigned-orders-route-contract.test.ts` (por la página).
- [x] R18, R19, R21: `home-route.test.ts` + `route-guard-middleware.test.ts` + `app-sidebar`,
  `sidebar-carril`, `sidebar-desktop` + E2E casos 1, 3 y 4.
- [x] R20: `login-action.test.ts` (3 casos) + `e2e-helpers/landing.test.ts` + E2E.
- [x] R22: `run-document-job-addon.test.ts` (terminar `unauthorized` definitivo; sin tanda, lector,
  descarga ni cadena; nunca `requeue`) + `documentos-facade.test.ts` (atado a `lectura_pdf`).
- [x] R24: `company-addons.int.test.ts > R24` (recetas, proveedores, líneas, lotes y conexión IA
  intactos).
- [x] R25: `company-directory-addons.int.test.ts`.
- [x] R26: `guard-rutas-fuera-de-sesion.test.ts` (con autocomprobación y prueba existente por ruta).
- [x] R27–R32: `get-company-addons`, `set-company-addon`, `set-all-company-addons` (permiso primero,
  `consultar`/`modificar` cruzados, `not_found`, claves del núcleo e inventadas → `invalid_input`) +
  `company-actions.test.ts` + `company-addons.int.test.ts` (baja: lectura sí, escritura
  `not_found`).
- [x] R33, R34: `company-addons.int.test.ts` (evento por cambio con `details.addon`; sin cambios no
  escribe; apagar = `enabled=false` sin borrar; «apagar todos» = cinco filas y cinco eventos; fallo
  del 5.º evento deshace las cinco filas y `updated_at`) + `company-event.test.ts`,
  `list-company-events.test.ts`, `company-actions.test.ts > R34`.
- [x] R35: suma de lo anterior + `sin-decision-en-cliente.test.ts`. Comprobado a mano además: ningún
  archivo `'use client'` lee `addons` de la sesión ni lo recibe como prop.
- [x] R36: `e2e/modulos-por-empresa.spec.ts` (5 casos × 2 navegadores, verde en mi corrida).
- [x] R37: `architecture-doc.test.ts`.
- [x] `progress/impl_QC-277.md` contiene el mapa R1–R38 → test.

### Puntos de especial atención del leader
- [x] **RLS:** `addons` y `company_addon_overrides` con `ENABLE` + `FORCE`, al final de la
  migración (`migration.sql:38-41`); `guard-rls-force` verde.
- [x] **Aislamiento:** `company_addon_overrides` lleva `company_id` y **no** está exenta (lo afirma
  el caso nuevo de `guard-empresa-en-esquema`); `addons` exenta con motivo y en el bullet de
  `docs/architecture.md` (once tablas). Sin FK compuesta por el motivo de design § 2.3 (ningún padre
  es tabla de empresa). Ver menor m3.
- [x] **Migración y `down.sql` (R38):** `down.sql` = `DROP TABLE "company_addon_overrides"; DROP
  TABLE "addons";`, hija antes que padre; índices, FK, CHECK y filas caen con las tablas. El UP no
  toca `companies` (ya no hay `ALTER TABLE companies`). Coincide literalmente con design § 2.3.
- [x] **Ninguna decisión en el cliente (R35):** `hasAddon` solo en `inventario/page.tsx` (Server
  Component); `requirePageAddon` en servidor; `AppSidebar` solo cambia el `href` a `HOME_ROUTE`.
- [x] **Permiso primero (R30):** los tres casos de uso llaman a `requirePlatformPermission` antes de
  `safeParse` y del puerto; las acciones solo resuelven el actor de la sesión y delegan.
- [x] **Transaccionalidad (R29/R33):** `apply` corre en `atomically` (transacción raíz o savepoint),
  bloquea `companies ... FOR UPDATE`, hace los `upsert`, el `updated_at` y los eventos dentro; «todos
  a la vez» es una sola llamada al puerto. El test del fallo del 5.º evento lo prueba contra la base.
- [x] **Procesos sin sesión (R22/R26):** el interruptor va tras `claim` y antes de `readBatch` y
  `readerFor` (`run-document-job.ts:155-164`); la clave `lectura_pdf` vive en la composición; el
  cron no cambia y R25 lo fija. La guardia clasifica las dos rutas de `app/api`.
- [x] **Listas cerradas ajenas:** solo los nombres decididos, sin relajar igualdades:
  `addonOverridesCreated` (credential-policy-contract), `CompanyAddonOverride`
  (proveedores/module-contract x2, account-status-schema, exclusión nombrada en identity-schema R12),
  `company-addons.ts` por ruta exacta en maestro/empacador/acondicionamiento/integraciones y en
  clientes/scope y asignaciones/module-contract (decisión «A» tanda 1; las dos últimas están en la
  bitácora, l. 77-84), los tres casos de uso en `RUTAS_ABIERTAS_EMPRESAS`, la migración en
  `MIGRACIONES_ESPERADAS`/`MIGRACION_QC277`, el spec en `E2E_ESPERADOS`, `HOME_ROUTE` en la lista de
  exportaciones de recipe-route-contract. Cada exclusión por ruta lleva su caso de vecino
  (`company-addons-extra.ts`) que sigue vigilado.

### CHECKPOINTS.md
- [x] Especificación completa; tasks `[x]`; `## Lo que ya existe` presente y respetado.
- [x] Equipo: assignee Carlos Restrepo; choques con QC-203/271/275 aceptados en la ficha.
- [x] Trazabilidad completa (arriba).
- [x] Typecheck y lint sin errores.
- [ ] `gate-completo` en CI: pendiente del PR (no es de esta vuelta).
- [x] Flujo crítico (permisos, autenticación/aterrizaje, webhook): E2E de la ficha verde y su salida
  en la bitácora (l. 377). Ver menor m4 sobre el webhook.
- [x] Sin dependencias nuevas (`package.json` y lockfile sin cambios).
- [x] Sin secretos ni valores de entorno hardcodeados.
- [x] El webhook no cambia de firma ni de idempotencia: solo gana un corte tras `claim`.
- [x] `progress/review_QC-277.md`: este archivo.

### docs/checkpoints-proyecto.md
- [x] TypeScript strict y lint.
- [x] E2E de Playwright para el flujo crítico.
- [x] UI: sin componente nuevo ni cambio visual (solo `href` del logo y una condición más del botón
  «Importar»); design.md lo declara y no hace falta pase `/design` ni fila de catálogo.
- [x] Tabla nueva de empresa con `company_id`; catálogo compartido exento con motivo.
- [x] Cada permiso/corte se valida en `domain/` (`requirePlatformPermission`, `requireAddon`) y tiene
  su test.
- [x] RLS `ENABLE` + `FORCE` en las dos tablas nuevas.
- [x] Datos solo por adaptador `driven` Prisma; nada de cliente Supabase.
- [x] Migración versionada con `down.sql`.
- [x] Hexagonal: guardias de arquitectura verdes; `documentos`/`inventario` importan solo el
  contrato de `identity`; la composición ata `companyAddonRepository`; `lib/shared` sigue siendo
  hoja; los dos modelos con `/// @module identity`.
- [x] Permisos en servidor; mutaciones por Server Actions.

### Reglas del perfil (reviewer 5–11)
- [x] 5 Calidad y seguridad: RLS, capas, sin hardcode ni secretos.
- [x] 6 Multiplataforma: no aplica (sin UI nueva).
- [x] 7 Dependencias: ninguna.
- [x] 8 Aislamiento: columna de empresa presente; ver m3.
- [x] 9 Comentarios: ninguna línea de producción añadida cita `QC-<n>`, `R<n>`, `design.md` ni
  «decisión cerrada» (barrido de `app/ lib/ components/ db/`). Ver m1 y m2.
- [x] 10 Duplicados: no hay componente nuevo.
- [x] 11 Diseño: no aplica.

## Hallazgos

Ningún BLOQUEANTE.

- **m1 — menor.** Comentarios de test y de helpers E2E que citan la ficha o el requisito, cuando
  `docs/conventions.md > Comentarios` dice que en `tests/` y `e2e/` vale la misma regla (el `R<n>`
  va en el nombre del caso, no en el comentario). Ejemplos: `e2e/helpers/addons.ts` («QC-277 —
  … (R20, design.md > 10.2)»), `e2e/helpers/landing.ts` (3 líneas con «QC-277 R20»),
  `tests/unit/identity/roles/maestro-rol.test.ts` («Enmienda QC-277 (design §10.3.1)»),
  `tests/unit/identity/schema/account-status-schema.test.ts` («QC-277 `design.md > 2.2`»),
  `tests/unit/identity/credential-policy-contract.test.ts`,
  `tests/unit/proveedores/module-contract.test.ts`, `tests/unit/identity/schema/identity-schema.test.ts`,
  `tests/guards/guard-identificador-de-request.test.ts`, `tests/unit/recetas-ui/recipe-route-contract.test.ts`
  y `tests/unit/asignaciones/module-contract.test.ts`. Imita el estilo «RETENSADO …» de esos archivos.
  No es producción: no bloquea.
- **m2 — menor.** El bloque que se añade al docblock de `session-user-prisma.ts` (l. 71-76) tiene
  6 líneas y repite el coste que ya explica design § 3.1. La regla pide unas 5 como mucho.
- **m3 — menor.** No hay un caso explícito de dos empresas para la lectura de excepciones en la
  sesión: que un usuario de la empresa A no reciba los añadidos prendidos de la B. Hoy es
  estructural, porque la relación sale de `users.company_id` → `companies` → overrides por FK, y
  las operaciones del Maestro son de plataforma a propósito. Por eso no lo marco como bloqueante
  del punto 8. Aun así, un caso en `session-user.int.test.ts` con una segunda empresa con los cinco
  prendidos lo dejaría probado y no solo implícito.
- **m4 — menor.** El corte del webhook con el añadido apagado (R22) tiene cobertura unitaria y de
  composición, pero no E2E. Los E2E de documentos recorren el webhook con el añadido prendido (con
  `enableAllAddons`), y con eso se cumple el checkpoint de flujo crítico. Anotarlo como deuda si se
  quiere el camino «descartado» de punta a punta.
- **m5 — menor (para F2.3).** `origin/dev` ya trae migraciones posteriores (`20261015120200_…` y
  `20261015130000_…`), así que `20261014190000_company_addons` queda fechada antes que ellas. Design
  § 2.3 prevé re-fecharla en F2.3. Al hacerlo, hay que actualizar también las listas que nombran la
  carpeta: `company-addons-migration.test.ts`, `MIGRACIONES_ESPERADAS` en
  `guard-identificador-de-request` y `MIGRACION_QC277` en `recipe-route-contract`.

## Veredicto

**OK (APROBADO).** 0 bloqueantes, 5 menores. Los menores no hace falta corregirlos para pasar a
F2.3. m5 hay que tenerlo en cuenta al sincronizar con `dev`.

## Vuelta 2 (acotada a cae5a7ad..fcd85793)

Solo lo que QC-277 cambia respecto a `origin/dev` (`git diff origin/dev...fcd85793`). El conjunto
de archivos de QC-277 es el mismo que en la vuelta 1, más `progress/deudas.md`. Lo comprobé
comparando los nombres de archivo con el re-fechado aplicado.

### Checklist

- [x] **Conflicto en `session-user-prisma.ts`.** El diff contra dev son +10 líneas: el campo
  `company_addons` en `FilaSesion`, un docblock de 3 líneas (m2) y
  `ARRAY(SELECT o.addon_key FROM company_addon_overrides o WHERE o.company_id = u.company_id AND o.enabled)`
  dentro del mismo `$queryRaw` etiquetado.
  - Aislamiento: el subselect se ata a `u.company_id` del propio usuario. Las tablas tienen RLS
    forzada y sin policies, igual que el resto del proyecto (`docs/architecture.md`: la frontera
    es el `WHERE`, no la RLS).
  - Sin empresa: `NULL = …` no casa ninguna fila y el resultado es `{}`, o sea `[]`.
  - Solo cuenta `enabled = true` (D14).
  - El SQL no interpola nada nuevo.
  - R8 se cumple: es la misma sentencia.
- [x] **Test R8/R9 reescrito.** No relaja nada. Antes espiaba los `findFirst`/`findMany` de
  Prisma, que tras el `$queryRaw` de dev ya no se llaman. Ahora `medir()` captura **todas** las
  sentencias SQL del lector y exige que sea exactamente una, con `FROM users u` y
  `company_addon_overrides`. Es más estricto: cualquier consulta aparte, sea por Prisma o por SQL
  crudo, la rompe.
- [x] **m2:** el docblock queda en 3 líneas.
- [x] **m3:** caso nuevo «con dos empresas». Prueba A con uno y B con cinco, y luego al revés,
  con B en `[]` por tener todo apagado. Comprueba que el `companyId` de cada uno es el suyo y
  deshace los datos en `finally`.
- [x] **m5:** la carpeta `db/migrations/20261015190000_company_addons` queda después de
  `20261015130000_…`, la última de dev. Las referencias en `guard-identificador-de-request`,
  `recipe-route-contract`, `design.md` y `tasks.md` están actualizadas. `git grep 20261014190000`
  solo da historia en `progress/` (impl, ficha y review).
- [x] **D59 (m1) y D60 (m4)** están en `progress/deudas.md`, con origen y qué falta.
- [x] **`guard-identificador-de-request.test.ts`:** contra dev son solo +14 líneas y 0 borradas.
  Entran el alta de `modulos-por-empresa.spec.ts` en `E2E_ESPERADOS` y
  `20261015190000_company_addons` al final de `MIGRACIONES_ESPERADAS`. Se conservan todas las
  entradas de dev (QC-281/282).

### Verificación ejecutada

- `vitest run session-user.int + guard-identificador-de-request + recipe-route-contract`:
  `Test Files 3 passed (3)`, `Tests 71 passed (71)`.
- `playwright test e2e/modulos-por-empresa.spec.ts` (base `quimicloude_e2e_qc277`, pg17 :5433,
  chromium + webkit): `10 passed (29.2s)`.

### Hallazgos

Ninguno nuevo. Los menores de la vuelta 1 están resueltos (m2, m3, m5) o pasados a deuda (m1 en
D59, m4 en D60).

### Veredicto vuelta 2

**OK.** 0 bloqueantes, 0 menores nuevos.
