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
