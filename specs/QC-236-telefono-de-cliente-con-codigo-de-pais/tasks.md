# QC-236 — Teléfono de cliente con código de país · tasks

## Cómo leer esta lista

- **Dependencias:** cada tarea dice de cuál depende.
- **`[P]`:** se puede hacer en paralelo con las demás `[P]` de su mismo bloque.
- **«Hecho»:** cada tarea dice qué hay que demostrar. En tests, el `R<n>` va en el nombre del caso.
- **Comprobaciones de cada tanda:**
  - `pnpm run typecheck`
  - `pnpm run lint`
  - `pnpm exec vitest related --run <archivos>`
  - `pnpm exec vitest run guard`
- **Preguntas abiertas:** ninguna. P1–P3 quedaron cerradas el 2026-10-19 como D11–D13.

## Bloque A — Datos

- [ ] **T1 · Esquema y migración** (R15, R16, R23). Depende de: nada.
  - **Qué se hace:**
    - en `db/schema.prisma`, las tres columnas de `design.md § 2.1`;
    - se reescribe el comentario `///` del modelo `Customer`;
    - `db/migrations/20261019120000_customers_phone_e164/migration.sql` y su `down.sql` (§ 2.2,
      § 2.4).
  - **Hecho cuando:**
    - un test de texto del SQL comprueba que hay tres `ADD COLUMN` nulos, los cuatro CHECK, un único
      `CREATE UNIQUE INDEX` parcial con `WHERE deleted_at IS NULL AND phone_e164 IS NOT NULL`, ningún
      `UPDATE`, y que `phone` no se nombra;
    - un test de integración aplica UP, DOWN y UP sobre la base de test;
    - otro test de integración demuestra que la base rechaza `phone_country='col'`,
      `phone_e164='+573001234567'` y `phone_e164` sin `phone_country`;
    - `customers-schema.test.ts` y los demás tests de esquema de QC-154 siguen verdes, o se ajustan
      solo en lo que toca al teléfono, declarado en el `impl_`.

## Bloque B — Dominio (depende de T1 solo por los tipos de Prisma en el adaptador)

- [ ] **T2 [P] · `phoneMatchesWaId`** (R18–R22). Depende de: nada.
  - **Qué se hace:** `lib/modules/clientes/domain/phone-matches-wa-id.ts`, exportado en el barrel.
  - **Hecho cuando:** hay unit tests por requisito con estos casos:
    - igualdad;
    - México en los dos sentidos;
    - Argentina en los dos sentidos;
    - Brasil en los dos sentidos;
    - números distintos;
    - vacío y caracteres que no son dígitos;
    - `57`/`571` y `55` sin el `9` en la posición 5 dan `false`.

- [ ] **T3 [P] · Teléfono del cliente: interpretar y formatear** (R6, R7, R9, R10, R11, R15).
  Depende de: nada.
  - **Qué se hace:** `domain/customer-phone.ts` (§ 4.1) con `libphonenumber-js/max`.
  - **Guardia de capas:** confirma si la de módulos acepta el subpath. Si no, añade
    `'libphonenumber-js/max'` a `PURE_PACKAGES` y a la tabla de `docs/architecture.md > La regla de
    dependencias`.
  - **Hecho cuando** hay unit tests que comprueban:
    - `CO` + `300 123 4567` → `573001234567` y `+57 300 123 4567`;
    - `CO` + `300 12` → `invalid_number`;
    - un número de longitud correcta pero dígitos no válidos para el país → `invalid_number` (el
      motivo de usar `max`);
    - número sin país → `country_required`;
    - blanco → `none`;
    - `ZZ` → `invalid_country`;
    - `countryFromInternationalInput('+593 99 123 4567')` → `EC`, y un prefijo ambiguo → `null`;
    - `formatPhoneNational` y `formatPhoneInternational`;
    - `describeCustomerPhone` en sus tres casos (R29, R30).

- [ ] **T4 · Esquema de entrada, errores y casos de uso** (R8, R9, R10, R11, R12, R17). Depende de:
  T3.
  - **Qué se hace:**
    - `customer-input.ts` con `phoneCountry` y `phoneNumber` (§ 4.3);
    - las tres clases de error y la traducción en `create-customer.ts` y `update-customer.ts`
      (§ 4.4);
    - los tres códigos en `error-codes.ts` y `error-catalog.ts`;
    - los tipos `Customer`, `CustomerView` y `NewCustomer`;
    - el puerto `CustomerRepository` con `'duplicate_phone'` y su comentario reescrito.
  - **Hecho cuando** hay unit tests de los casos de uso con puerto simulado que comprueban:
    - cada error con su `code`;
    - que sin permiso se lanza `unauthorized` **antes** de validar el teléfono y sin llegar al puerto
      (R17);
    - que `'duplicate_phone'` del puerto se traduce a `customer_duplicate_phone` (R12);
    - que el número vacío con país marcado guarda los cuatro campos nulos en el alta (R10);
    - que en la edición, con el número vacío, el caso de uso manda al puerto la variante
      `keep_legacy_or_clear` y no los cuatro nulos (R34).
  - Los tests de QC-154 R17 (`customer-input.test.ts`) y R19 (`customer-service.test.ts`) se
    ajustan para el teléfono y siguen cubriendo el correo y los demás campos.
  - Cualquier guardia que enumere los códigos de error sigue verde.

- [ ] **T5 · Adaptador de persistencia y relleno** (R10, R12, R13, R14, R24–R27, R32, R34).
  Depende de: T1, T4.
  - **Qué se hace:**
    - en `customer-prisma.ts`, las columnas nuevas y la traducción de la violación del índice
      `customers_company_phone_e164_key` (§ 4.5);
    - `domain/legacy-phone-backfill.ts`, `domain/backfill-legacy-phones.ts`,
      `ports/legacy-phone-repository.ts`, `ports/company-country-lookup.ts` y
      `adapters/driven/persistence/legacy-phone-prisma.ts` (§ 3.1–3.3).
  - **Hecho cuando hay unit tests de `planLegacyPhoneBackfill`** que cubren:
    - válidos;
    - no válidos;
    - el grupo duplicado (se lo queda el más reciente por `createdAt`, y por `id` si empatan; D11);
    - un número ya tomado en `taken`, que deja el grupo entero como `duplicate`.
  - **Y hay tests de integración** (con su entrada en `tests/integration/aislamiento.json`) que
    comprueban:
    - un duplicado en la misma empresa da `'duplicate_phone'`;
    - el mismo número en otra empresa o sobre un cliente dado de baja se acepta (R13);
    - editar conservando el propio número pasa;
    - editar un cliente con `phone_issue` cambiando la ciudad y con el número vacío deja `phone`,
      `phone_country`, `phone_e164` y `phone_issue` como estaban y guarda la ciudad (R34);
    - editar ese mismo cliente con un número válido reemplaza `phone` y deja `phone_issue` nulo
      (R32);
    - editar con el número vacío un cliente válido (sin `phone_issue`) lo deja sin teléfono (R10);
    - dos altas simultáneas con el mismo número dejan una sola (R14);
    - el relleno, sobre filas sembradas con texto libre, convierte las válidas y marca
      `invalid_format` y `duplicate`;
    - el relleno usa `CO` cuando la empresa no tiene país;
    - el relleno deja `phone`, `updated_at` y `updated_by` byte a byte iguales (R27);
    - una segunda pasada no cambia ninguna fila (R27);
    - con cero clientes termina sin error.

- [ ] **T6 [P] · País de la empresa en `identity`** (R2, R3, R24). Depende de: nada.
  - **Qué se hace:**
    - `findCountryOf` en `ports/company-country-repository.ts` y en `company-country-prisma.ts`;
    - `domain/get-company-country.ts`, exportado en el barrel.
  - **Hecho cuando** un test de integración comprueba:
    - una empresa con país da su país;
    - una empresa sin país da `null`;
    - una empresa dada de baja o inexistente da `null`.

- [ ] **T7 · Composición, action, script y build** (R28, R12). Depende de: T4, T5, T6.
  - **Qué se hace:**
    - en `lib/composition/index.ts`: `identity.getCompanyCountry`, `clientes.backfillLegacyPhones` y
      el puerto `CompanyCountryLookup` atado a la lectura de `identity`;
    - `customer-actions.ts` lee `phoneCountry` y `phoneNumber` (§ 5);
    - el script `scripts/backfill-customer-phones.ts` y su entrada en `package.json`;
    - el paso en `scripts/build.mjs` justo después de `migrate` (§ 3.4);
    - `scripts/seed-demo/gateway.ts` con la entrada nueva (§ 9).
  - **Hecho cuando:**
    - `tests/unit/scripts/build.test.ts`, `tests/unit/identity/seed/deploy-hook.test.ts` (si fija
      la lista de pasos) y `tests/guards/guard-despliegue-produccion.test.ts` afirman el paso nuevo
      tras `migrate` en local, production y preview, y su ausencia en development o sin
      `VERCEL_ENV`;
    - `customer-actions.test.ts` cubre los dos campos nuevos;
    - `pnpm db:seed:demo` en la base local termina sin error.

## Bloque C — UI (depende de T3 y T4; T8 y T9 en paralelo)

- [ ] **T8 [P] · `CountrySelect`: extensión** (R5, R33). Depende de: nada.
  - **Qué se hace:**
    - props `pinned`, `hideLabel` y `compactOnMobile` (§ 8.2);
    - su fila en `components/shared/CATALOGO.md`: puntos de extensión y `TelefonoCliente.dc.html`
      en «Diseño».
  - **Hecho cuando** hay tests de UI (`*.test.tsx`) que comprueban:
    - el grupo «País de la empresa» arriba, el separador y «Todos» con «Sin país» primero;
    - el país fijado repetido en su sitio;
    - con texto en el buscador, sin rótulos;
    - sin `pinned`, la lista de siempre;
    - con `hideLabel`, la etiqueta es solo para lectores y el disparador conserva su nombre;
    - con `compactOnMobile` a ≤ 640 px, el disparador dice `CO +57` y su `aria-label` lleva el
      nombre.
  - Los tests de QC-235 de `CountrySelect` siguen verdes sin tocarlos, y la guardia del catálogo
    también.

- [ ] **T9 · `CustomerPhoneField` y `CustomerForm`** (R1–R4, R6–R10, R12, R31, R32). Depende de: T3,
  T4, T8.
  - **Qué se hace:**
    - `customer-phone-field.tsx` (§ 8.1), en el barrel de la ruta;
    - `customer-form.tsx` (§ 8.3);
    - `companyCountry` baja por `customer-sheet.tsx`, `customer-row-actions.tsx`,
      `customer-table.tsx` y `customer-list-section.tsx`.
  - **Hecho cuando** hay tests de UI que comprueban:
    - el alta con país de empresa y sin él;
    - la edición de un cliente válido muestra el formato nacional;
    - al salir del número se reformatea y mientras se escribe no;
    - pegar `+593…` cambia el país;
    - número sin país da el error en el país;
    - un número no válido da «Este número no es válido para Colombia (+57).»;
    - `customer_duplicate_phone` del servidor se pinta bajo el número;
    - la edición de un migrado muestra la etiqueta larga y el texto de ayuda de la enmienda
      (`design.md § 1`): «…si lo dejas vacío, se conserva.» (R31);
    - guardar un migrado con el número vacío manda `phoneNumber=''` y no pinta ningún error (R34).

- [ ] **T10 · Página y lista** (R2, R29, R30). Depende de: T6, T7, T9.
  - **Qué se hace:**
    - `page.tsx` lee el país de la empresa tras el corte por permiso (§ 7);
    - `customer-columns.tsx` con `describeCustomerPhone` y `StatusBadge` (§ 8.4).
  - **Hecho cuando:**
    - un test de UI de la columna cubre el número internacional, `invalid_format` («Sin formato
      válido»), `duplicate` («Duplicado: revisar») y sin teléfono (R30, D13);
    - el test de «una sola lectura de sesión por petición» sigue verde.

## Bloque D — Recorrido completo

- [ ] **T11 · E2E** (R2, R3, R8, R9, R11, R12, R29, R30, R33). Depende de: T10.
  - **Qué se hace:** `e2e/clientes.spec.ts` (o un spec nuevo
    `e2e/clientes-telefono.spec.ts`), con estos casos:
    - una empresa con `CO`: el alta abre con Colombia, escribe `300 123 4567`, guarda y la lista
      muestra `+57 300 123 4567`;
    - en la base quedan `CO` y `573001234567`;
    - la misma alta otra vez da el error de duplicado bajo el campo;
    - una empresa sin país: el número sin país da error;
    - un cliente sembrado con `phone_issue` muestra su etiqueta en la lista;
    - a 390 px el disparador dice `CO +57` y la hoja se titula «País del teléfono».
  - **Hecho cuando:** `pnpm exec playwright test <spec>` sale verde y los casos de
    `e2e/clientes.spec.ts` que tocaban `phone` están actualizados.

- [ ] **T12 · Cierre**. Depende de: todo.
  - **Qué se hace:**
    - el mapa `R1…R34 → test` en `progress/impl_QC-236.md`, con la salida real de los tests;
    - la revisión visual contra `TelefonoCliente.dc.html` a 1440, 820 y 375 px;
    - `./init.sh` en verde (el gate completo lo corre CI en el PR).
  - **Hecho cuando:** ningún `R<n>` queda sin test y se declaran las desviaciones de
    `design.md § 8.5`.

## Archivos esperados

- `db/schema.prisma`
- `db/migrations/20261019120000_customers_phone_e164/migration.sql`
- `db/migrations/20261019120000_customers_phone_e164/down.sql`
- `lib/modules/clientes/index.ts`
- `lib/modules/clientes/domain/customer.ts`
- `lib/modules/clientes/domain/customer-view.ts`
- `lib/modules/clientes/domain/customer-input.ts`
- `lib/modules/clientes/domain/customer-phone.ts`
- `lib/modules/clientes/domain/phone-matches-wa-id.ts`
- `lib/modules/clientes/domain/legacy-phone-backfill.ts`
- `lib/modules/clientes/domain/backfill-legacy-phones.ts`
- `lib/modules/clientes/domain/create-customer.ts`
- `lib/modules/clientes/domain/update-customer.ts`
- `lib/modules/clientes/domain/errors.ts`
- `lib/modules/clientes/ports/customer-repository.ts`
- `lib/modules/clientes/ports/legacy-phone-repository.ts`
- `lib/modules/clientes/ports/company-country-lookup.ts`
- `lib/modules/clientes/adapters/driven/persistence/customer-prisma.ts`
- `lib/modules/clientes/adapters/driven/persistence/legacy-phone-prisma.ts`
- `lib/modules/clientes/adapters/driving/customer-actions.ts`
- `lib/modules/identity/index.ts`
- `lib/modules/identity/domain/get-company-country.ts`
- `lib/modules/identity/ports/company-country-repository.ts`
- `lib/modules/identity/adapters/driven/persistence/company-country-prisma.ts`
- `lib/modules/errores/domain/error-codes.ts`
- `lib/modules/errores/domain/error-catalog.ts`
- `lib/composition/index.ts`
- `components/shared/country-select.tsx`
- `components/shared/CATALOGO.md`
- `app/(private)/clientes/page.tsx`
- `app/(private)/clientes/components/index.ts`
- `app/(private)/clientes/components/customer-phone-field.tsx`
- `app/(private)/clientes/components/customer-form.tsx`
- `app/(private)/clientes/components/customer-columns.tsx`
- `app/(private)/clientes/components/customer-sheet.tsx`
- `app/(private)/clientes/components/customer-row-actions.tsx`
- `app/(private)/clientes/components/customer-table.tsx`
- `app/(private)/clientes/components/customer-list-section.tsx`
- `scripts/backfill-customer-phones.ts`
- `scripts/build.mjs`
- `scripts/seed-demo/gateway.ts`
- `package.json`
- `docs/architecture.md`
- `tests/guards/guard-arquitectura-modulos.test.ts`
- `tests/guards/guard-despliegue-produccion.test.ts`
- `tests/unit/scripts/build.test.ts`
- `tests/unit/identity/seed/deploy-hook.test.ts`
- `tests/unit/clientes/phone-matches-wa-id.test.ts`
- `tests/unit/clientes/customer-phone.test.ts`
- `tests/unit/clientes/legacy-phone-backfill.test.ts`
- `tests/unit/clientes/customer-input.test.ts`
- `tests/unit/clientes/customer-service.test.ts`
- `tests/unit/clientes/customer-actions.test.ts`
- `tests/unit/clientes/schema/customers-schema.test.ts`
- `tests/unit/clientes/schema/customers-phone-migration.test.ts`
- `tests/integration/clientes/customers-phone-migration.int.test.ts`
- `tests/integration/clientes/customer-phone-uniqueness.int.test.ts`
- `tests/integration/clientes/legacy-phone-backfill.int.test.ts`
- `tests/integration/identity/company-country-read.int.test.ts`
- `tests/integration/aislamiento.json`
- `tests/ui/clientes/customer-phone-field.test.tsx`
- `tests/ui/clientes/customer-columns-phone.test.tsx`
- `tests/ui/shared/country-select-pinned.test.tsx`
- `e2e/clientes.spec.ts`
- `e2e/clientes-telefono.spec.ts`
- `progress/impl_QC-236.md`
