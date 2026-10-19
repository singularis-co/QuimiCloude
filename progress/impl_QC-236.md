# QC-236 — impl (bitácora)

## T1–T4 · backend_dev (datos, `phoneMatchesWaId`, teléfono del cliente, esquema/errores/casos de uso)

### Archivos

- **Creados**
  - `db/migrations/20261019130000_customers_phone_e164/{migration.sql,down.sql}` (ver Desviaciones 1)
  - `lib/modules/clientes/domain/customer-phone.ts`
  - `lib/modules/clientes/domain/phone-matches-wa-id.ts`
  - `tests/unit/clientes/schema/customers-phone-migration.test.ts`
  - `tests/unit/clientes/phone-matches-wa-id.test.ts`
  - `tests/unit/clientes/customer-phone.test.ts`
  - `tests/integration/clientes/customers-phone-migration.int.test.ts` (escrito, NO corrido: no hay `DATABASE_URL`)
- **Modificados (producción)**
  - `db/schema.prisma` (3 columnas + comentario `///` reescrito)
  - `lib/modules/clientes/{index.ts, domain/customer.ts, domain/customer-view.ts, domain/customer-input.ts, domain/errors.ts, domain/create-customer.ts, domain/update-customer.ts, ports/customer-repository.ts}`
  - `lib/modules/clientes/adapters/driven/persistence/customer-prisma.ts` (ajuste mínimo para compilar; ver Desviaciones 4)
  - `lib/modules/errores/domain/{error-codes.ts, error-catalog.ts}`
  - `docs/architecture.md` (`libphonenumber-js/max` en la regla de dependencias)
- **Modificados (tests)**
  - `tests/guards/guard-arquitectura-modulos.test.ts` (`PURE_PACKAGES` + `libphonenumber-js/max`: la guardia decide por `target.name`, que conserva el subpath)
  - `tests/guards/guard-identificador-de-request.test.ts` (censo de migraciones)
  - `tests/integration/aislamiento.json` (+ `clientes/customers-phone-migration.int.test.ts` en `transaccion`)
  - Ajustes de QC-154 solo en lo que toca al teléfono: `tests/unit/clientes/{customer-input,customer-service,scope}.test.ts`, `tests/unit/clientes/schema/customers-schema.test.ts`, `tests/unit/errores/catalogo.test.ts` (102 → 105)
  - Solo tipado (fixtures `CustomerView` con los 3 campos nuevos a `null`): `tests/unit/clientes-ui/{clientes-page,clientes-viewport,customer-columns,customer-form,customer-list-section,customer-sheet,customer-table,delete-customer-dialog}.test.tsx`, `tests/unit/paridad/{acciones-por-fila,campos-paridad,clientes-paridad,confirmaciones-paridad,formularios-paridad}.test.tsx`, `tests/unit/shared-ui/confirm-dialog-montado.test.tsx`, `tests/integration/clientes/{customer-repository,list-query-customers}.int.test.ts`

### Mapa R → test (T1–T4)

| R | Test |
| --- | --- |
| R8 | `customer-phone.test.ts` «R8 — numero sin pais es country_required»; `customer-input.test.ts` «R8 — numero sin pais: issue en phoneCountry…»; `customer-service.test.ts` «R8 — alta/edicion: numero sin pais lanza customer_phone_country_required…» |
| R9 | `customer-phone.test.ts` «R9 — …invalid_number» (×4, incluido el de `max` frente a `min`); `customer-input.test.ts` «R9 — numero no valido…»; `customer-service.test.ts` «R9 — alta/edicion: …customer_phone_invalid…» |
| R10 | `customer-phone.test.ts` «R10 — numero en blanco es none…»; `customer-input.test.ts` «R10 — numero vacio o en blanco…»; `customer-service.test.ts` «R10 — alta con el numero vacio y pais marcado…» |
| R11 | `customer-phone.test.ts` «R11 — CO + 300 123 4567…»; `customer-input.test.ts` «R11 — un numero valido sale…»; `customer-service.test.ts` «R11 — alta/edicion: un numero valido llega al puerto…» |
| R12 | `customer-service.test.ts` «R12 — alta/edicion: 'duplicate_phone' del puerto se traduce…» (la base: T5) |
| R14 | `customers-phone-migration.test.ts` «R14: el indice es UNIQUE…»; int (no corrido) «R14: el indice parcial rechaza…» |
| R15 | `customers-phone-migration.test.ts` «R15: …»; `customer-phone.test.ts` «R15 — …invalid_country»; `customer-input.test.ts` «R15 — un pais fuera de la lista…»; `customer-service.test.ts` «R15 — …invalid_input…»; int (no corrido) «R15: la base rechaza…» |
| R16 | `customers-phone-migration.test.ts` «R16: …»; int (no corrido) «R16: la base rechaza un phone_e164 con +…» y «…sin phone_country» |
| R17 | `customer-service.test.ts` «R17 — alta/edicion: sin permiso lanza unauthorized antes de validar el telefono…» y «R17 — …la empresa que llega al puerto es la del actor…» |
| R18–R22 | `phone-matches-wa-id.test.ts` (un caso por requisito; R22 en tres) |
| R23 | `customers-phone-migration.test.ts` (UP exacto, sin UPDATE, `phone` intacta, detector, modelo Prisma, DOWN exacto); int (no corrido) «R23: UP, DOWN y UP otra vez…» y «R23: …phone_issue…» |
| R24, R25 | `customer-phone.test.ts` «R24 —…» / «R25 —…» (solo `parseCustomerPhoneText`; el relleno es T5) |
| R29, R30 | `customer-phone.test.ts` «describeCustomerPhone» (3 casos) y «R29 — formatPhoneInternational…» |
| R32 | `customer-service.test.ts` «R32 — edicion con un numero valido: …phoneIssue nulo, no la variante» |
| R34 | `customer-service.test.ts` «R34 — edicion con el numero vacio: al puerto llega keep_legacy_or_clear…» |
| R4, R6, R7 | `customer-phone.test.ts` «R4, R6 — formatPhoneNational…», «R7 — …» (×3) (la UI es T9) |

### Verificación (salida real, 2026-10-19)

- `pnpm run typecheck` → sin errores (exit 0).
- `pnpm run lint` → `✖ 10 problems (0 errors, 10 warnings)`; los 10 avisos son de archivos que esta tanda no toca.
- `pnpm exec vitest related --run --project ui --project node <archivos de clientes de T1–T4>` →
  `Test Files 1 failed | 388 passed (389)`, `Tests 1 failed | 6644 passed | 1 skipped (6646)`.
  - El rojo: `tests/unit/clientes-ui/customer-form.test.tsx > … > el maximo de los tres opcionales tambien se acota con la constante del contrato`. El formulario todavía manda `phone`, que el esquema nuevo ya no lee; lo rehace T9 (frontend). No se toca aquí.
  - `error-codes.ts` y `error-catalog.ts` no entraron en `related` (arrastran casi toda la suite); sus tests corren aparte: `vitest run --project node tests/unit/errores tests/unit/clientes/…` → `12 passed`, `195 passed`.
- `pnpm exec vitest run guard` → `Test Files 1 failed | 80 passed (81)` en la primera pasada (`guard-identificador-de-request`: censo de migraciones); corregido y vuelto a correr ese archivo → `23 passed`.
- Integración: escrita, **no corrida** (sin `DATABASE_URL`): `tests/integration/clientes/customers-phone-migration.int.test.ts`. Los dos `.int` existentes de `clientes` se ajustaron solo para compilar.

### Desviaciones y bloqueos

1. **Carpeta de la migración `20261019130000_…` y no `20261019120000_…`.** `20261019120000_whatsapp_connections_drop_meta_app_id` ya existe en `dev`; con el mismo sello la nuestra ordenaría **antes** y `db:rollback` (que revierte la última por orden de nombre) revertiría la de WhatsApp. Se usa el siguiente sello libre. Pendiente de confirmar por el leader.
2. **Formato de Colombia.** `libphonenumber-js` 1.13.15 formatea los móviles de CO como `+57 300 1234567` / `300 1234567`, no `+57 300 123 4567` / `300 123 4567` como dicen R6, R11, R29 y el tablero. Se implementa `formatInternational()`/`formatNational()` como manda `design.md § 4.1` y los tests fijan la salida real. **Decisión humana**: aceptar el formato de la librería o pedir uno propio (sería código nuevo fuera del diseño).
3. **«`phone` no se nombra» (T1)** choca con el CHECK de coherencia de `design.md § 2.1`, que usa `phone IS NOT NULL`. El test comprueba que ninguna sentencia altera, borra, renombra, añade o reescribe `phone` ni filas.
4. **`customer-prisma.ts` (ajuste mínimo, T5 pendiente):** mapea las tres columnas y escribe las del teléfono; **no** traduce la violación del índice a `'duplicate_phone'` y, con `keep_legacy_or_clear`, por ahora **no toca** las columnas del teléfono (no borra el de un cliente sin aviso: R10 en edición queda para T5 con el `SELECT … FOR UPDATE`).
5. **Forma de `NewCustomer`:** el teléfono va anidado en `phone: NewCustomerPhone` = `CustomerPhoneColumns` (`phone`, `phoneCountry`, `phoneE164`, `phoneIssue: null`) | `{ kind: 'keep_legacy_or_clear' }`. `create` del puerto exige la primera forma.
6. **Esquema:** `transform` con `ctx.addIssue` en lugar de `superRefine` + `transform` (mismo efecto, una sola interpretación). Las issues llevan `params.reason`; `phoneIssueReason(error)` la lee. `phoneCountry` se acota a 2 caracteres en zod.
7. **`describeCustomerPhone`** devuelve también la etiqueta corta (D13). Un cliente con `phone` y sin `phone_e164` ni aviso (estado previo al relleno) sale como `none`.
8. **Interinos hasta T7/T9:** `customer-actions.ts` y `customer-form.tsx` siguen mandando `phone`; el esquema lo ignora, así que el teléfono no se guarda desde la UI hasta esas tareas.

### Veredicto

T1–T4 hechos y en verde salvo el test de formulario que rehace T9; quedan dos decisiones para el leader (sello de la migración y formato de CO).

## T5 y T7 · backend_dev (persistencia, relleno, composición, action, script y build)

### Archivos

- **Creados (producción)**
  - `lib/modules/clientes/domain/legacy-phone-backfill.ts` (`planLegacyPhoneBackfill`, puro)
  - `lib/modules/clientes/domain/backfill-legacy-phones.ts` (`createBackfillLegacyPhones`, sin actor)
  - `lib/modules/clientes/ports/legacy-phone-repository.ts`, `lib/modules/clientes/ports/company-country-lookup.ts`
  - `lib/modules/clientes/adapters/driven/persistence/legacy-phone-prisma.ts`
  - `scripts/backfill-customer-phones.ts`
- **Modificados (producción)**
  - `customer-prisma.ts`: `isPhoneUniqueViolation` (P2002 que nombra `customers_company_phone_e164_key` o `phone_e164`) → `'duplicate_phone'` en `create` y `updateAlive`; con `keep_legacy_or_clear`, transacción de dos `UPDATE` (ver Desviaciones 3).
  - `lib/modules/clientes/index.ts` (barrel: plan, caso de uso y tipos)
  - `lib/composition/index.ts`: `identity.getCompanyCountry`, `clientes.backfillLegacyPhones`, `legacyPhoneRepository`, `companyCountryLookup = identity.getCompanyCountry`
  - `customer-actions.ts`: `phoneCountry` y `phoneNumber` en lugar de `phone`
  - `scripts/build.mjs` (paso `RELLENAR_TELEFONOS`), `package.json` (`db:backfill:customer-phones`; sin dependencias), `scripts/seed-demo/gateway.ts` (`phoneCountry: 'CO'`, `phoneNumber`)
- **Tests**
  - Nuevo: `tests/unit/clientes/legacy-phone-backfill.test.ts`
  - Nuevos, **escritos y NO corridos** (no hay base ni `.env`): `tests/integration/clientes/customer-phone-uniqueness.int.test.ts`, `tests/integration/clientes/legacy-phone-backfill.int.test.ts`; los dos en `aislamiento.json` como `commit` con motivo y `desde`.
  - Ajustados: `tests/unit/clientes/customer-actions.test.ts` (campos nuevos + bloque QC-236), `tests/unit/clientes/scope.test.ts` (lista cerrada de archivos del módulo: +5), `tests/unit/scripts/build.test.ts`, `tests/unit/identity/seed/deploy-hook.test.ts`, `tests/guards/guard-despliegue-produccion.test.ts` (bloque nuevo del relleno).

### Mapa R → test (T5, T7)

| R | Test |
| --- | --- |
| R10 | int (no corrido) `customer-phone-uniqueness` «R10 — sin aviso y con el numero vacio el cliente queda sin telefono» y «R10 — …otra empresa sigue siendo not_found…»; `customer-actions.test.ts` «R3, R10 (QC-236) — sin campos de telefono…» |
| R12 | int (no corrido) «R12 — un alta con el phone_e164 de otro cliente vivo…» y «R12 — una edicion que pone el numero de otro…»; `customer-actions.test.ts` «R8, R9, R12 (QC-236) — los tres errores del telefono salen con su code estable» |
| R13 | int (no corrido) «R13 — …otra empresa», «R13 — …dado de baja…», «R13 — editar … conservando su propio numero…» |
| R14 | int (no corrido) «R14 — dos altas simultaneas con el mismo numero dejan un solo cliente vivo» |
| R24 | `legacy-phone-backfill.test.ts` «R24 — …» (×4, plan y caso de uso); int (no corrido) `legacy-phone-backfill` «R24, R25, R26 — convierte…» y «R24 — usa CO cuando la empresa no tiene pais…» |
| R25 | `legacy-phone-backfill.test.ts` «R25 — lo que no se puede interpretar…»; int (no corrido) «R24, R25, R26 —…» |
| R26 | `legacy-phone-backfill.test.ts` «R26 —…» (×4: más reciente por `createdAt`, empate por `id`, grupo entero si está en `taken`, nunca dos asignaciones); int (no corrido) «R24, R25, R26 —…» |
| R27 | `legacy-phone-backfill.test.ts` «R27 — sin filas…», «R27 — sin empresas…»; int (no corrido) «R27 — deja phone, updated_at y updated_by byte a byte iguales…», «R27 — una segunda pasada no cambia ninguna fila…», «R27 — con cero clientes termina sin error» |
| R28 | `build.test.ts` bloque «R28 (QC-236)…» (×3 entornos con base, ×3 sin base, fallo del relleno tumba el build); `deploy-hook.test.ts` «…los cinco pasos… (R19; R28 de QC-236)»; `guard-despliegue-produccion.test.ts` «R28 (QC-236) — en local, production y preview…» y «…el script npm del relleno…»; `legacy-phone-backfill.test.ts` «R28 — un fallo de una empresa se propaga» |
| R32 | int (no corrido) «R32 — con aviso y un numero valido se reemplaza el phone antiguo…» |
| R34 | int (no corrido) «R34 — con %s y el numero vacio se conservan…» (×2: `invalid_format`, `duplicate`) |
| R1, R11 (action) | `customer-actions.test.ts` «R1, R11 (QC-236) — alta y edicion mandan phoneCountry y phoneNumber tal cual y ya no leen phone» |

### Verificación (salida real, 2026-10-19)

- `pnpm run typecheck` → sin errores.
- `pnpm run lint` → `✖ 10 problems (0 errors, 10 warnings)`; los 10 en archivos que esta tanda no toca.
- `pnpm exec vitest run guard` → `Test Files 1 failed | 80 passed (81)`, `Tests 2 failed | 1108 passed | 20 skipped`. Los 2 rojos son *timeouts* de 20 s de `guard-asignacion-componentizada` (ajena) con la máquina cargada; sola → `22 passed`.
- `pnpm exec vitest related --run --project ui --project node <archivos de T5/T7>` → 32 rojos, todos en `tests/unit/clientes-ui/{customer-form,customer-sheet}` y paridad, que el frontend_dev estaba reescribiendo (T9) durante la corrida. Repetidos al terminar: `vitest run --project ui tests/unit/clientes-ui tests/unit/paridad tests/ui/clientes` → `35 passed`, `583 passed`.
- Mis tests y las guardias que tocan lo mío, directos: `vitest run --project node tests/unit/clientes tests/unit/scripts/build.test.ts tests/unit/identity/seed/deploy-hook.test.ts tests/unit/shared/qc289-orden-por-defecto.test.ts tests/guards/{guard-despliegue-produccion,guard-ambito-empresa-clientes,guard-aislamiento-integracion,guard-arquitectura-modulos}.test.ts` → `Test Files 28 passed`, `Tests 455 passed | 5 skipped`.
- **No corrido:** los dos `.int` nuevos (sin `DATABASE_URL`), las migraciones y `pnpm db:seed:demo` (no hay base). Los cuatro teléfonos demo (`+57 310 000 300x`) se comprobaron válidos con `libphonenumber-js/max` por `node -e`.

### Desviaciones y bloqueos

1. **Orden del paso en el build (R28 dice «justo después de `migrate deploy`»).** El relleno va en `[migrate, generate, relleno, seed, …]`, no antes de `generate`: lee las columnas nuevas con el cliente Prisma, y `build.mjs`/`deploy-hook.test.ts` ya documentan que Vercel cachea `node_modules` con el cliente viejo (por eso el seed va tras `generate`). Antes de `generate` fallaría en Vercel. Sigue siendo el primer paso que usa la base tras migrar, y su fallo tumba el build. **Confirmar con el humano**; si no se acepta, es mover una constante.
2. **`listCompaniesWithPending` del puerto no existe.** Una consulta de `customers` que cruce empresas la prohíbe `guard-ambito-empresa-clientes` («`clientes` NO tiene ninguna consulta sin ámbito aprobada», sin lista de excepciones). Se usa el precedente de `expireStaleOrders`: el caso de uso recibe `listCompanyIds` = `listActiveCompanyIds` de `identity` y procesa cada empresa con `processCompany(plan, scope)`. Consecuencia: los clientes de una empresa **dada de baja** no se rellenan (no se ven en ninguna pantalla).
3. **Sin `SELECT … FOR UPDATE`.** Lo exigiría SQL crudo con `company_id`, que la misma guardia prohíbe leer fuera de `company-scope.ts`. Equivalente sin crudo:
   - edición con `keep_legacy_or_clear`: transacción con un `UPDATE` de los datos (bloquea la fila) y un segundo `UPDATE` que vacía el teléfono con `phone_issue IS NULL` en el `where`; Postgres decide con la fila bloqueada;
   - relleno: cada `UPDATE` repite la condición de pendiente en el `where`, así que una fila editada entre la lectura y la escritura se salta. El choque con el índice (alta concurrente) deshace la empresa y se reintenta una vez, como dice el diseño.
4. **`isPhoneUniqueViolation` reconoce el nombre del índice o la columna `phone_e164`.** En este repo, con `@prisma/client@6.19.3`, `meta.target` de un índice parcial llega como columnas (medido en `user-admin-prisma.ts`); el nombre solo no bastaría. `phone_e164` no está en ningún otro índice único de `customers`.
5. **`phone_country` de un duplicado** es el país del número interpretado (igual al por defecto salvo que el texto traiga `+` de otro país); el de un `invalid_format`, el país por defecto usado.
6. **`pnpm db:seed:demo` no se corrió** (T7 «Hecho cuando»): no hay base.

### Veredicto

T5 y T7 implementados, typecheck/lint/guardias/tests unitarios en verde; los dos `.int` están escritos sin correr y quedan dos puntos para el humano (orden del paso del build y no rellenar empresas dadas de baja).

## T9 · frontend_dev (`CustomerPhoneField` y `CustomerForm`)

### Archivos

- **Creados**
  - `app/(private)/clientes/components/customer-phone-field.tsx` (en el barrel `index.ts`)
  - `tests/ui/clientes/customer-phone-field.test.tsx`
- **Modificados (producción)**
  - `app/(private)/clientes/components/{customer-form.tsx, customer-sheet.tsx, customer-row-actions.tsx, customer-table.tsx, customer-list-section.tsx, index.ts}`
  - `components/shared/country-select.tsx` + su fila en `components/shared/CATALOGO.md`: prop opcional `errorId` (ver Desviaciones 1)
- **Modificados (tests, solo lo que toca al teléfono)**
  - `tests/unit/clientes-ui/customer-form.test.tsx`: el de «el máximo de los tres opcionales» (rojo heredado) ahora usa `phoneNumber`; los demás casos que leían `phone` pasan a `phoneCountry`/`phoneNumber`; «aceptan texto sin formato» queda solo para el correo (el teléfono ya se valida, D1); el fixture lleva `phoneE164`.
  - `tests/unit/clientes-ui/{customer-form,customer-sheet}.test.tsx`, `tests/unit/paridad/formularios-paridad.test.tsx`: `setViewportWidth`/`resetViewport` (el `CountrySelect` usa `matchMedia`, que jsdom no trae).
  - `tests/unit/clientes-ui/clientes-viewport.test.tsx`: el disparador del país se mide aparte (16 px sin `md:text-sm` y 44 × 44).
  - `tests/unit/paridad/campos-paridad.test.tsx` → `customer-field-phone-number`; instantáneas de cliente regeneradas con `-u -t` (solo `paridad de formularios — cliente` y el campo de teléfono; 8).

### Mapa R → test (T9, `tests/ui/clientes/customer-phone-field.test.tsx`)

| R | Caso |
| --- | --- |
| R1 | «R1 — un grupo «Teléfono» con el selector … y el número …, opcional» |
| R2 | «R2 — en el alta con país de empresa, ese país viene marcado» |
| R3 | «R3 — en el alta sin país de empresa, el selector queda en «Sin país»» |
| R4 | «R4 — la edición de un cliente con phone_e164 muestra su país y el número en formato nacional» |
| R5 | «R5 — con país de empresa, la lista abre con el grupo «País de la empresa» arriba» |
| R6 | «R6 — mientras se escribe no se reformatea; al salir del campo queda en formato nacional» |
| R7 | «R7 — pegar un número con +593 marca Ecuador…», «R7 — escribir un número con + y salir…», «R7 — un prefijo que no identifica un único país…» |
| R8 | «R8 — número sin país: no se guarda y … enlazado al selector», «R8 — el código customer_phone_country_required del servidor…» |
| R9 | «R9 — … al salir del campo, enlazado al número», «R9 — al guardar un número no válido…», «R9 — el código customer_phone_invalid del servidor…» |
| R10 | «R10 — con el número vacío y un país marcado se guarda sin error…» |
| R11 | «R11 — un número válido viaja como phoneCountry y phoneNumber» |
| R12 | «R12 — customer_duplicate_phone del servidor se pinta bajo el número…», «R12 — el duplicado sigue a la vista si se sale del número sin cambiarlo» |
| R31 | «R31 — sin formato válido: …», «R31 — duplicado: …», «R31 — un cliente sin aviso no muestra etiqueta» |
| R32 | «R32 — guardar un migrado con un número válido lo manda…» |
| R33 | «R33 — a 390 px el país es compacto (CO +57…) y el número mide 48 px con letra de 16 px» |
| R34 | «R34 — guardar un migrado con el número vacío manda phoneNumber vacío y no pinta ningún error» |

Los textos con formato se derivan de `formatPhoneNational` (p. ej. `NATIONAL = formatPhoneNational('573001234567', 'CO')`); ninguno fija `300 123 4567` ni `300 1234567`.

### Verificación (salida real, 2026-10-19)

- `pnpm run typecheck` → exit 0.
- `pnpm run lint` → `✖ 10 problems (0 errors, 10 warnings)`, los mismos 10 avisos previos de archivos que T9 no toca.
- `pnpm exec vitest related --run --project ui --project node <7 de la ruta + country-select.tsx + 6 tests>` → `Test Files 33 passed (33)`, `Tests 609 passed (609)`. La primera pasada dio 32 rojos (`matchMedia` ausente en tres archivos y 7 instantáneas de cliente); corregidos como se lista arriba.
- `pnpm exec vitest run guard` → `Test Files 81 passed (81)`, `Tests 1110 passed | 20 skipped (1130)`.

### Desviaciones y puntos abiertos

1. **`CountrySelect` gana `errorId` (opcional, paso 2 de la regla de decisión).** El tablero pinta «Elige el país del teléfono.» bajo toda la fila, y el `FieldError` interno del selector solo se puede pintar dentro de su columna (112 px en teléfono) y sin `data-testid`. Con `errorId`, el selector marca el disparador `aria-invalid` y lo enlaza por `aria-describedby`, y el error lo pinta `CustomerPhoneField` bajo la fila con `customer-error-phone-country`. Sin la prop no cambia nada; fila del catálogo actualizada.
2. **El error del número va bajo el número**, en su columna (el `FieldError` de `TextField`), no bajo toda la fila como en el tablero: `TextField` no deja pintarlo fuera.
3. **Sin placeholder en el número:** `TextField` no tiene la prop, y el `300 123 4567` del tablero es justo el formato pendiente de decisión.
4. **Sin `qc-err`:** en la app no existe esa animación ni `FieldError` la aplica; el error entra sin animar, como el resto de errores de campo.
5. **El disparador del país mide 44 px en teléfono**, no 48: es el alto de `CountrySelect` (T8). El número sí mide 48 px por debajo de `lg` (`max-lg:min-h-12`); «tablet» se toma como < 1024 px.
6. **Ayudas del alta** del tablero («Opcional. El país viene marcado…» / «Opcional. Elige el país…») y la del migrado van bajo la fila, enlazadas al `role="group"` por `aria-describedby`, no al número.
7. **Los valores tras un fallo** (§ 8.1) no se pasan como prop: el número y el país son estado controlado del campo y React no los borra al resetear el formulario. Los `data-testid` se pasan como objeto `testIds`, no como una base.
8. **Edición de un cliente sin teléfono:** el país sale de su `phone_country` (nulo → «Sin país»), no del de la empresa; el spec solo fija el alta (R2) y el cliente con número (R4). Decisión del humano si se quiere el de la empresa.
9. **`companyCountry` es opcional (`?: CountryCode | null`, por defecto `null`)** en `CustomerListSection`, `CustomerTable`, `CustomerRowActions`, `CustomerSheet` y `CustomerForm` hasta que T10 lo pase desde `page.tsx`. Hasta entonces el alta abre en «Sin país».

### Veredicto

T9 hecho: campo de teléfono con país en alta y edición, errores bajo el campo y `companyCountry` bajando por la ruta; typecheck, lint, tests relacionados y guardias en verde.

## T10 y T11

### Archivos

- **Creados**
  - `tests/ui/clientes/customer-columns-phone.test.tsx`
  - `e2e/clientes-telefono.spec.ts`
- **Modificados (producción)**
  - `app/(private)/clientes/page.tsx`: tras `requirePagePermission('clientes.consultar')` lee `identity.getSessionContext()` → `identity.getCompanyCountry(companyId)` y pasa `companyCountry` a `CustomerListSection` y al `CustomerTable` del `fallback`.
  - `app/(private)/clientes/components/customer-columns.tsx`: la celda «Teléfono» usa `describeCustomerPhone` (internacional en mono; aviso con el `phone` antiguo en gris y mono + `StatusBadge tone="waiting"` con la etiqueta corta, `data-testid="customer-phone-issue-<id>"`; sin teléfono, `MissingValue`).
- **Modificados (tests)**
  - `tests/unit/clientes-ui/clientes-page.test.tsx`: el doble de `identity` gana `getSessionContext` y `getCompanyCountry`; tres casos nuevos (R2, R3 y el orden corte → lectura).
  - `tests/unit/clientes-ui/clientes-viewport.test.tsx`, `tests/unit/paridad/clientes-paridad.test.tsx`, `tests/unit/paridad/acciones-por-fila.test.tsx`: el doble de `identity` gana `getSessionContext` y `getCompanyCountry` (devuelven `null`).
  - `tests/unit/paridad/clientes-paridad.test.tsx` + su instantánea: el cliente del fixture pasa a `phoneCountry: 'CO'`, `phoneE164: '573001234567'`; instantánea regenerada solo para «R1 R16-R18 — con filas» (`-u -t`). La celda queda `+57 300 1234567` (literal de la librería; ver Desviaciones 2).
  - `tests/unit/clientes-ui/customer-columns.test.tsx` (QC-154): el fixture del teléfono pasa a uno coherente con D1 (`phoneE164`); el caso «sin valor» de `phone` anula también `phoneE164` y `phoneCountry`.
  - `tests/unit/identity/session-once-per-request-render.test.tsx`: se añade `/clientes` (layout + página + `CustomerListSection`) a las pantallas contadas; la página lee ahora `getSessionContext` y el conteo sigue en 1.
  - `tests/guards/guard-identificador-de-request.test.ts`: alta de `clientes-telefono.spec.ts` en la lista cerrada de specs E2E (su punto de extensión).
  - `e2e/clientes.spec.ts`: el alta sin número afirma además `phoneCountry`, `phoneE164` y `phoneIssue` nulos (R10); comentario del fixture actualizado.

### Mapa R → test (T10 y T11)

| R | Test |
| --- | --- |
| R2 | `clientes-page.test.tsx` «R2 — la página pide el país de la empresa de la sesión y el alta abre con él», «R2 — sin el permiso de consulta no se lee el país: el corte va antes»; E2E «R2, R11, R29, R12 — empresa con CO: …» |
| R3 | `clientes-page.test.tsx` «R3 — si la empresa no tiene país, el alta abre sin país»; E2E «R3, R8 — empresa sin país: …» |
| R8 | E2E «R3, R8 — empresa sin país: …» |
| R9 | E2E «R9 — un número no válido para Colombia se marca en el campo y no se guarda» |
| R10 | E2E `clientes.spec.ts` «… lo da de baja (R41; QC-236 R10)» |
| R11 | E2E «R2, R11, R29, R12 — …» (en la base `CO` y `573001234567`) |
| R12 | E2E «R2, R11, R29, R12 — …» (segunda alta → `customer-error-phone-number` con `errorMessage('customer_duplicate_phone')`) |
| R29 | `customer-columns-phone.test.tsx` «R29 — un cliente con phone_e164 muestra el número en formato internacional, en mono», «R29 — un cliente sin teléfono muestra la marca de dato ausente»; E2E «R2, R11, R29, R12 — …» |
| R30 | `customer-columns-phone.test.tsx` «R30 — invalid_format: … «Sin formato válido» …», «R30 — duplicate: … «Duplicado: revisar» …»; E2E «R30 — los clientes sembrados con phone_issue …» |
| R33 | E2E «R33 — a 390 px el disparador dice CO +57 y la hoja se titula «País del teléfono»» |

Una sola lectura de sesión por petición: `session-once-per-request-render.test.tsx` «/clientes lee la ficha de sesion exactamente 1 vez» (nuevo) y los demás casos del archivo, en verde.

### Verificación (salida real, 2026-10-19)

- `pnpm run typecheck` → exit 0 (incluye `e2e/`).
- `pnpm run lint` → `✖ 10 problems (0 errors, 10 warnings)`, los mismos 10 avisos previos.
- `pnpm exec vitest related --run --project ui --project node <page.tsx, customer-columns.tsx y los 7 tests tocados>` → `Test Files 22 passed (22)`, `Tests 445 passed (445)`. Pasadas previas en rojo, corregidas: la instantánea de paridad (celda nueva) y el fixture de `customer-columns.test.tsx` (teléfono sin `phoneE164`). En una pasada intermedia `session-once-per-request-render.test.tsx` cayó entero en el `beforeAll` (carga bajo la ejecución en paralelo); solo y en la pasada final, verde.
- `pnpm exec vitest run --project ui tests/unit/identity/session-once-per-request-render.test.tsx` (con `/clientes` añadido) → `Tests 13 passed (13)`.
- `pnpm exec vitest run guard` → `Test Files 81 passed (81)`, `Tests 1110 passed | 20 skipped (1130)` (antes del alta en la lista, `guard-identificador-de-request` daba 1 rojo por el spec E2E nuevo).
- `pnpm exec playwright test e2e/clientes-telefono.spec.ts e2e/clientes.spec.ts --list` → `Total: 16 tests in 2 files` (5 + 3 por proyecto, chromium y webkit).
- **E2E escrito y SIN correr**: no hay base ni `.env` en este entorno. Lo corre CI o un humano con la base migrada y sembrada.

### Desviaciones y puntos abiertos

1. **La lista de clientes no tiene tarjeta en teléfono.** `CustomerTable` no pasa `card` a `DataTable`, así que a ≤ 640 px se ve la misma tabla, no la tarjeta del tablero (`TelefonoCliente.dc.html`, `rm-meta`). `design.md § 8.4` dice que la tarjeta «no necesita código propio» y que, si lo necesita, se para y se dice: lo necesita (un `card` para `CustomerTable`, cambio visual de la lista). No se ha hecho; decide el humano. R29 en la tabla queda cubierto en todos los anchos.
2. **Formato internacional pendiente de decisión.** `formatPhoneInternational('573001234567')` da `+57 300 1234567`; el spec y el tablero dicen `+57 300 123 4567`. Ni el test de la columna ni el E2E fijan el literal: los dos lo derivan de `formatPhoneInternational`. La instantánea de paridad sí lleva el de la librería y se regenera si cambia.
3. **`companyCountry` sigue opcional** (por defecto `null`) en los componentes de la ruta: volverlo obligatorio obliga a tocar unos 12 archivos de tests que montan esas piezas sueltas. La página lo pasa siempre.
4. **Texto «CO +57» y «Colombia» en el E2E de R33** van escritos: son los que pide T11 y los mismos que el test de UI de T9.
5. **Archivos fuera de «Archivos esperados»:** `tests/guards/guard-identificador-de-request.test.ts` (alta del spec nuevo, obligatoria por la guardia), `tests/unit/identity/session-once-per-request-render.test.tsx`, `tests/unit/clientes-ui/{clientes-page,clientes-viewport,customer-columns}.test.tsx` y `tests/unit/paridad/{clientes-paridad,acciones-por-fila}.test.tsx` (dobles de `identity` y fixtures del teléfono).
6. El `phone` antiguo del aviso va en mono además de gris, como el tablero.

### Veredicto

T10 hecho y en verde; T11 escrito, compila y se enumera, sin correr por falta de base.

## Cierre · implementer (2026-10-19)

### Mapa consolidado R1–R34 → test

Detalle por caso en las secciones de arriba. «[int]» = integración escrita y sin correr (no hay
`DATABASE_URL` en el worktree); «[e2e]» = E2E escrito, enumerado por `playwright --list`, sin correr.

| R | Test(s) |
| --- | --- |
| R1 | `tests/ui/clientes/customer-phone-field.test.tsx`, `tests/ui/shared/country-select-pinned.test.tsx`, `tests/unit/clientes/customer-actions.test.ts` |
| R2 | `tests/unit/clientes-ui/clientes-page.test.tsx`, `customer-phone-field.test.tsx`, `tests/integration/identity/company-country-read.int.test.ts` [int], `e2e/clientes-telefono.spec.ts` [e2e] |
| R3 | `clientes-page.test.tsx`, `customer-phone-field.test.tsx`, `company-country-read.int.test.ts` [int], [e2e] |
| R4 | `customer-phone-field.test.tsx`, `tests/unit/clientes/customer-phone.test.ts` |
| R5 | `country-select-pinned.test.tsx`, `customer-phone-field.test.tsx` |
| R6, R7 | `customer-phone.test.ts`, `customer-phone-field.test.tsx` |
| R8, R9 | `customer-phone.test.ts`, `customer-input.test.ts`, `customer-service.test.ts`, `customer-actions.test.ts`, `customer-phone-field.test.tsx`, [e2e] |
| R10 | `customer-service.test.ts`, `customer-phone-field.test.tsx`, `customer-phone-uniqueness.int.test.ts` [int], `e2e/clientes.spec.ts` [e2e] |
| R11 | `customer-phone.test.ts`, `customer-phone-field.test.tsx`, [e2e] |
| R12 | `customer-service.test.ts`, `customer-actions.test.ts`, `customer-phone-field.test.tsx`, `customer-phone-uniqueness.int.test.ts` [int], [e2e] |
| R13 | `customer-phone-uniqueness.int.test.ts` [int] |
| R14 | `tests/unit/clientes/schema/customers-phone-migration.test.ts`, `customers-phone-migration.int.test.ts` [int], `customer-phone-uniqueness.int.test.ts` [int] |
| R15, R16 | `customers-phone-migration.test.ts`, `customer-phone.test.ts`, `customer-input.test.ts`, `customers-phone-migration.int.test.ts` [int] |
| R17 | `customer-service.test.ts` |
| R18–R22 | `tests/unit/clientes/phone-matches-wa-id.test.ts` |
| R23 | `customers-phone-migration.test.ts`, `customers-phone-migration.int.test.ts` [int] |
| R24–R26 | `tests/unit/clientes/legacy-phone-backfill.test.ts`, `customer-phone.test.ts`, `legacy-phone-backfill.int.test.ts` [int], `company-country-read.int.test.ts` [int] (R24, parte identity) |
| R27 | `legacy-phone-backfill.test.ts`, `legacy-phone-backfill.int.test.ts` [int] |
| R28 | `tests/unit/scripts/build.test.ts`, `tests/unit/identity/seed/deploy-hook.test.ts`, `tests/guards/guard-despliegue-produccion.test.ts` |
| R29, R30 | `tests/ui/clientes/customer-columns-phone.test.tsx`, `customer-phone.test.ts`, [e2e] |
| R31 | `customer-phone-field.test.tsx` |
| R32 | `customer-service.test.ts`, `customer-phone-field.test.tsx`, `customer-phone-uniqueness.int.test.ts` [int] |
| R33 | `country-select-pinned.test.tsx`, `customer-phone-field.test.tsx`, [e2e] |
| R34 | `customer-service.test.ts`, `customer-phone-field.test.tsx`, `customer-phone-uniqueness.int.test.ts` [int] |

### Sin correr

- Integración: `customers-phone-migration`, `customer-phone-uniqueness`, `legacy-phone-backfill`
  (clientes) y `company-country-read` (identity). Sin `.env` en el worktree.
- E2E: `e2e/clientes-telefono.spec.ts` y `e2e/clientes.spec.ts` (T11 abierta por eso).
- `pnpm db:seed:demo` (T7), revisión visual a 1440/820/375 y `./init.sh` (T12): pendientes.

### Decisiones abiertas para el humano

1. **Formato colombiano.** `libphonenumber-js` 1.13.15 da `+57 300 1234567` / `300 1234567`; el
   spec, R6/R11/R29 y el tablero dicen `300 123 4567`. Se usó la librería sin formato propio;
   los tests derivan el esperado de `formatPhone*`, salvo la instantánea de
   `clientes-paridad.test.tsx`, que hay que regenerar si cambia.
2. **Nombre de la migración:** `20261019130000_customers_phone_e164` (el `120000` del spec choca
   con `20261019120000_whatsapp_connections_drop_meta_app_id` y rompería `db:rollback`).
3. **Orden en el build (R28):** el relleno va tras `migrate` y `generate`, no justo tras `migrate`.
4. **Relleno por empresa activa:** sin `listCompaniesWithPending` ni `FOR UPDATE` (la guardia de
   ámbito los prohíbe); las empresas dadas de baja no se rellenan.
5. **Lista en teléfono:** `CustomerTable` no tiene tarjeta; la del tablero necesita código nuevo
   (§ 8.4 dice parar). R29 queda cubierto en la tabla a cualquier ancho.
6. **País al editar un cliente sin teléfono:** sale de su `phone_country` (Sin país), no del de la
   empresa. El spec no lo fija.
7. `CountrySelect` ganó también la prop opcional `errorId` (T9), con su fila del catálogo.
