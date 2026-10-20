# QC-236 — Teléfono de cliente con código de país · design

## Lo que ya existe

**Lo que se buscó** (2026-10-19):

- **Términos:** `phoneMatchesWaId`, `phone_e164`, `E164`, `wa_id`, «normalizar teléfono»,
  `CountrySelect`, `libphonenumber`.
- **Dónde:** el board (`feature_list.json`, `name` y `description`), `specs/` y el grafo
  (`search_graph`).

| Dónde | Qué apareció | Qué se hace |
| --- | --- | --- |
| Board | QC-239 y QC-240 nombran `phoneMatchesWaId` y `phone_e164` como **consumidores**. Ninguna otra ficha los crea. | Nada: este spec no fija nada de ellas. |
| `specs/QC-235-pais-de-la-empresa` | Entregado en `dev`: <br>• `companies.country` (`VarChar(2)`, CHECK `^[A-Z]{2}$`) <br>• `setCompanyCountrySchema` (valida con `getCountries()`) <br>• `CompanyCountryRepository.setCountryOfAlive` <br>• `CountrySelect` <br>• `components/shared/country-options.ts` | Se reutiliza: <br>• el mismo formato y la misma validación de código de país (D5); <br>• se amplía el puerto `CompanyCountryRepository` con una lectura (§ 6); <br>• se extiende `CountrySelect` (§ 8.2). |
| `specs/QC-154-crud-de-clientes` | **R17** (teléfono sin formato), **R19** y la **decisión 2** («Nada es único»). En el código: <br>• el comentario «Sin resultado 'duplicate'» de `ports/customer-repository.ts`; <br>• los tests `customer-input.test.ts` (R17) y `customer-service.test.ts` (R19, «mismos seis datos»). | **Quedan sin efecto solo para el teléfono** (D3, D1): <br>• se ajustan los dos tests y el comentario (T4, T6); <br>• correo, ciudad y los demás campos siguen sin unicidad ni formato. |
| `docs/dependencias.md`, `package.json` | `libphonenumber-js@1.13.15` instalada y aprobada (fila en la línea 63). Ya está en `PURE_PACKAGES` de `guard-arquitectura-modulos`. | No hay dependencia nueva (§ 11). |
| Grafo | Ninguna función normaliza ni compara teléfonos. `fetchPhoneNumber` y `WhatsappPhoneNumberTakenError` (`integraciones`) son el número de la cuenta de WhatsApp de la empresa, no el de un cliente. | Nada que reutilizar. |
| `SessionContext` (`identity`) | Solo trae `userId`, `companyId` y `roleName`, no el país. `identity` no expone ninguna lectura del país. | Se añade (§ 6). |

**Componentes** (`components/shared/CATALOGO.md`, filas consultadas):

| Pieza | Fila del catálogo | Paso de la regla de decisión |
| --- | --- | --- |
| `CountrySelect` | `components/shared/country-select.tsx` | **2. Extender**: props opcionales nuevas, `pinned`, `hideLabel`, `compactOnMobile`, `errorId` y `triggerClassName` (§ 8.2; `errorId` por D20). Sin ellas, sus usos de hoy (`company-edit-sheet.tsx`) no cambian. |
| `listCountryOptions`, `countryOptionLabel` | `components/shared/country-options.ts` | 1. Reutilizar. |
| `TextField` | `components/shared/text-field.tsx` | **2. Extender**, para el número (`type="tel"`, `inputMode`, `onBlur`, `error`, `errorId`): props opcionales nuevas `placeholder` y `errorOutside` (§ 8.2). Sin ellas, sus usos de hoy no cambian. |
| `FieldError` | `components/shared/field-error.tsx` | 1. Reutilizar, para el error del país enlazado al disparador. |
| `StatusBadge` | `components/shared/status-badge.tsx` | 1. Reutilizar, tono `waiting` (el `sb t-waiting` del tablero) para las etiquetas de D9. |
| `FormSheet`, `ErrorAlert` | sus filas | 1. Reutilizar, sin cambios. |
| `CustomerPhoneField` (nueva) | — (componente de ruta, sin fila) | **3. Componer**: `CountrySelect` + `TextField` + `FieldError` + `StatusBadge` bajo un `role="group"`. Vive en `app/(private)/clientes/components/` porque solo la usa una ruta. El pase de diseño está aprobado (D7, § 1). |

## 1. Referencias de diseño (tableros aprobados)

| Tablero | Qué fija |
| --- | --- |
| `docs/diseno/canvas/TelefonoCliente.dc.html` (aprobado por el humano el 2026-10-19, commit `e5e74534`) | Todo el campo: <br>• alta con y sin país de empresa; <br>• lleno y formateado al salir del campo; <br>• los tres errores (sin país, no válido, duplicado); <br>• la edición de un migrado (inválido y duplicado); <br>• la lista abierta con el grupo «País de la empresa»; <br>• tablet (48 px) y teléfono (`CO +57`, hoja «País del teléfono»); <br>• la columna y la tarjeta de la lista. <br>Su ficha `<dl>` lista Componente, Datos, Reglas, Librerías, Animación, Escritorio/tablet/teléfono y Decidido. |
| `docs/diseno/canvas/CountrySelect.dc.html` | El selector en sí: popup, hoja y búsqueda. Su «Por confirmar» lo cierra D8. |

En lo visual manda el tablero. Las desviaciones están declaradas en § 8.5.

**Enmienda al tablero (humano, 2026-10-19, D12 y D13).** El dibujo no se toca; donde choque, manda
esta nota.

- **Texto de ayuda de la edición de un migrado.** Las tarjetas «Edición · teléfono antiguo…» dicen
  «Escribe el número o déjalo vacío». Con D12, dejarlo vacío **conserva** el teléfono antiguo, así
  que el texto pasa a ser:
  - inválido: «Antes: <phone>. Escribe un número válido para reemplazarlo; si lo dejas vacío, se
    conserva.»;
  - duplicado: «Antes: <phone>, que ya tiene otro cliente. Escribe otro número para reemplazarlo;
    si lo dejas vacío, se conserva.».
- **Etiquetas (D13).** En la lista, la forma corta del tablero («Sin formato válido» / «Duplicado:
  revisar»). En el formulario, la larga del tablero («Teléfono sin formato válido» / «Teléfono
  duplicado: revisar»). Coincide con lo que ya dibuja el tablero.
- **Consecuencia aceptada de D12:** desde el formulario no se puede dejar sin teléfono a un cliente
  migrado; solo se reemplaza por un número válido.

**Enmienda al tablero (humano y leader, 2026-10-19, tras la implementación, D14 y D18).** El dibujo
tampoco se toca; donde choque, manda esta nota.

- **Formato del número (D14).** El tablero escribe `+57 300 123 4567` en la lista y `300 123 4567`
  en el campo (y en el placeholder). Manda el formato de `libphonenumber-js`, sin formato propio: en
  Colombia, `+57 300 1234567` en la lista y `300 1234567` en el campo. Los tests derivan el texto
  esperado de `formatPhoneNational` / `formatPhoneInternational`, no de un literal del tablero.
- **Tarjeta de la lista en teléfono (D18).** La tarjeta (`rm-meta`) del tablero queda fuera de esta
  ficha, como deuda. A ≤ 640 px la lista es la misma tabla que en escritorio (§ 8.4).

**Enmienda al tablero (leader y humano, 2026-10-19, vuelta 2 de revisión, D22 y D23).** El tablero
no dibuja la fila pendiente de relleno (con `phone`, sin `phone_e164` ni `phone_issue`). Se
presenta como un teléfono antiguo sin aviso (R36):

- **Lista:** el `phone` en gris y mono, sin `StatusBadge` (§ 8.4).
- **Edición:** el número vacío y, sin etiqueta, la ayuda «Antes: <phone>. Escribe un número para
  reemplazarlo; si lo dejas vacío, se conserva.» (D23, § 8.1).

## 2. Modelo de datos

### 2.1 Columnas nuevas en `customers` (modelo `Customer`, `/// @module clientes`)

| Columna | Prisma | Tipo SQL | Restricción |
| --- | --- | --- | --- |
| `phone_country` | `phoneCountry String? @map("phone_country") @db.VarChar(2)` | `VARCHAR(2) NULL` | `customers_phone_country_format_check`: `phone_country IS NULL OR phone_country ~ '^[A-Z]{2}$'` (como `companies.country`) |
| `phone_e164` | `phoneE164 String? @map("phone_e164") @db.VarChar(15)` | `VARCHAR(15) NULL` | `customers_phone_e164_format_check`: `phone_e164 IS NULL OR phone_e164 ~ '^[1-9][0-9]{6,14}$'` |
| `phone_issue` | `phoneIssue String? @map("phone_issue") @db.VarChar(20)` | `VARCHAR(20) NULL` | `customers_phone_issue_check`: `phone_issue IS NULL OR phone_issue IN ('invalid_format','duplicate')` |

**Coherencia entre columnas**, en el CHECK `customers_phone_coherence_check`:

- `phone_e164 IS NULL OR (phone_country IS NOT NULL AND phone_issue IS NULL)`: un número
  internacional siempre lleva país y nunca lleva aviso (R16).
- `phone_issue IS NULL OR (phone IS NOT NULL AND phone_e164 IS NULL)`: el aviso solo existe sobre un
  texto antiguo sin número internacional.

**Por qué `phone_issue`, que la ficha no nombra.** La ficha pide «el aviso» y D9 pide dos etiquetas
distintas. El aviso es estado guardado, y así no depende de volver a interpretar números en cada
lectura. La alternativa sin columna está descartada en § 10.

`phone` sigue igual, `TEXT NULL`. No se toca ni en la migración ni en el relleno (D6).

### 2.2 Índice único parcial (R12, R14)

```sql
CREATE UNIQUE INDEX "customers_company_phone_e164_key"
  ON "customers" ("company_id", "phone_e164")
  WHERE "deleted_at" IS NULL AND "phone_e164" IS NOT NULL;
```

- Prisma no sabe expresar un `WHERE` en un índice, así que el índice vive **solo en la migración**.
  Es la misma deriva aceptada que ya tienen los índices de trigramas de `customers` (comentario
  `///` del modelo).
- El comentario `///` del modelo se reescribe: hoy dice «Nada es unico». Pasa a decir que el teléfono
  internacional es único entre los vivos de la empresa y que su índice vive en la migración.

### 2.3 RLS

No se crea ninguna tabla. `customers` ya tiene RLS activada y forzada desde QC-154 (test
`customers-migration.test.ts`, R17 de aquella ficha). No se añade ninguna policy.

La autorización sigue en el caso de uso: `requirePermission(actor, 'clientes.modificar')` es la
primera línea y la empresa sale del actor (R17).

### 2.4 Migración de esquema `db/migrations/20261019130000_customers_phone_e164/`

**Sello `130000` y no `120000` (D15).** `20261019120000_whatsapp_connections_drop_meta_app_id` ya
está en `dev`. Con el mismo sello, la nuestra ordenaría antes que ella y `db:rollback`, que revierte
la última por orden de nombre, revertiría la de WhatsApp.

- **`migration.sql` (UP):** `ALTER TABLE customers ADD COLUMN` × 3, nulas y sin `DEFAULT`; los cuatro
  CHECK; el índice de § 2.2. Sin `UPDATE`.
  - Toda fila existente cumple los CHECK porque las tres columnas nacen nulas.
  - Aplica igual sobre una tabla vacía.
- **`down.sql`:** `DROP INDEX`, `DROP CONSTRAINT` × 4 y `DROP COLUMN` × 3, en orden inverso.
  - Lo que el relleno escribió se pierde con las columnas, pero `phone` sigue intacto. Por eso el
    DOWN no destruye ningún dato que existiera antes del UP (D6).
- Se verifica aplicando UP, DOWN y UP sobre la base de test (`docs/verification.md > Datos`) y con
  un test de texto del SQL (T2).

## 3. Relleno de los datos existentes (R24–R28)

La conversión necesita `libphonenumber-js`, y una migración SQL no puede usarla. Por eso va en dos
fases: la migración de esquema (§ 2.4) y un **relleno en TypeScript** idempotente que corre después.

### 3.1 Dominio puro: `lib/modules/clientes/domain/legacy-phone-backfill.ts`

```ts
type LegacyPhoneRow = { id: string; phone: string; createdAt: Date };
type TakenE164 = ReadonlySet<string>; // phone_e164 ya asignados a vivos de la empresa
type LegacyPhoneOutcome =
  | { id: string; phoneCountry: CountryCode; phoneE164: string; phoneIssue: null }
  | { id: string; phoneCountry: CountryCode; phoneE164: null; phoneIssue: 'invalid_format' | 'duplicate' };

planLegacyPhoneBackfill(rows, country: CountryCode, taken: TakenE164): LegacyPhoneOutcome[]
```

1. Interpreta cada fila con `parseCustomerPhoneText(phone, country)` (§ 4.1). Si no es válida, sale
   `invalid_format` (R25).
2. Agrupa las válidas por e164.
   - Si el e164 está en `taken`, todo el grupo sale `duplicate`.
   - Si no, el más reciente se queda el número y el resto sale `duplicate` (R26). «Más reciente» es
     `createdAt` desc y, si empatan, `id` desc (D11).
3. Es determinista y no tiene E/S: se prueba entera con unit tests.

### 3.2 Caso de uso `createBackfillLegacyPhones`, en `domain/backfill-legacy-phones.ts`

- **Dependencias:**
  - `legacyPhones: LegacyPhoneRepository`, un puerto nuevo;
  - `companyCountryOf: CompanyCountryLookup`, un puerto nuevo de `clientes` con la forma
    `(companyId) => Promise<CountryCode | null>`;
  - `listCompanyIds`: los ids de las empresas activas. La composición lo ata a
    `listActiveCompanyIds` de `identity`, el mismo precedente que `expireStaleOrders` (D17).
- **Sin actor:** corre fuera de sesión, como los crons (`docs/architecture.md > Server Actions vs
  Route Handlers`). Tampoco lee varias empresas a la vez: recorre **las empresas activas** una por
  una y procesa cada una en su propia transacción (D17).
- **Los clientes de una empresa desactivada no se rellenan.** No hay forma de alcanzarlos sin una
  consulta que cruce empresas, y esa la prohíbe `guard-ambito-empresa-clientes`. Quedan como deuda
  (§ 13).
- **Por cada empresa:**
  1. `country = (await companyCountryOf(id)) ?? 'CO'`.
  2. `legacyPhones.processCompany(companyId, (rows, taken) => planLegacyPhoneBackfill(rows, country, taken))`.
- **Devuelve un resumen** `{ companies, converted, invalid, duplicate }` para el log del build.

### 3.3 Puerto y adaptador

- **Puerto** `ports/legacy-phone-repository.ts`:
  - `processCompany(companyId, plan)`.
  - **No hay `listCompaniesWithPending`** (D17): sería una consulta de `customers` que cruza
    empresas, y `guard-ambito-empresa-clientes` no admite ninguna en `clientes`. La lista de empresas
    la da `listCompanyIds` (§ 3.2).
- **Adaptador** `adapters/driven/persistence/legacy-phone-prisma.ts`, con el ámbito de empresa de
  `company-scope.ts` y sin SQL crudo. Dentro de una transacción por empresa:
  1. Lee los clientes pendientes de la empresa (vivos, con `phone`, `phone_e164` y `phone_issue`
     nulos), **sin `FOR UPDATE`** (D17: exigiría SQL crudo con `company_id`, que la misma guardia
     prohíbe fuera de `company-scope.ts`).
  2. Lee los `phone_e164` vivos ya asignados en la empresa.
  3. Llama a `plan`.
  4. Hace un `UPDATE` por fila que toca **solo** `phone_country`, `phone_e164` y `phone_issue`
     (R27). Sin `updated_at` ni `updated_by`: no es una edición de negocio.
     - Cada `UPDATE` repite en su `where` la condición de pendiente. Así, una fila que alguien editó
       entre la lectura y la escritura ya no es pendiente y se salta: es lo que sustituye al
       `FOR UPDATE`.
- **Si una fila choca con el índice** (un alta concurrente con el mismo número entre el `SELECT` y
  el `UPDATE`), se reintenta la empresa una vez. En la segunda vuelta ese número ya está en `taken` y
  la fila sale `duplicate`.
- **Pendiente = `phone_e164 IS NULL AND phone_issue IS NULL AND phone IS NOT NULL` y vivo.**
  - Ningún guardado **crea** una fila pendiente: el alta y la edición con número válido dejan
    `phone_e164` (R11) y, con el número vacío, una fila que no era pendiente queda sin teléfono
    (R10).
  - Una fila que **ya era** pendiente y se edita con el número vacío sigue pendiente: conserva
    `phone` (D22, R36, § 4.5). La convierte la siguiente pasada del relleno, como a cualquier otra.
  - Por eso el relleno es idempotente: tras una pasada, la siguiente no encuentra filas nuevas que
    procesar y no cambia ninguna de las ya procesadas (R27).
- **Los dados de baja no se rellenan:** no se ven en ninguna pantalla, el índice los excluye y no hay
  restauración. Si algún día se restauran, la ficha que lo haga decide.
- **RLS forzada:** el `UPDATE` corre como dueño de la tabla y `customers` no tiene policies.
  - Hay precedente de un relleno que necesitó apagar `FORCE` (`20261016120000_products_last_batch_at`),
    pero aquel corría **dentro** de una migración.
  - Este corre por el cliente Prisma normal, igual que todas las escrituras de la app sobre
    `customers`, que hoy funcionan con FORCE activo.
  - El implementer lo confirma en el test de integración (T5). Si fallara, es un hallazgo y se para.

### 3.4 Dónde corre (R28)

- **Script:** `scripts/backfill-customer-phones.ts`. Pide `clientes.backfillLegacyPhones` a
  `@/lib/composition` e imprime una línea `[backfill-telefonos] …` con el resumen. `scripts/**` está
  exento de las guardias de capa.
- **`package.json`:** `"db:backfill:customer-phones": "tsx scripts/backfill-customer-phones.ts"`.
- **`scripts/build.mjs`:**
  - un paso nuevo, `RELLENAR_TELEFONOS = 'tsx scripts/backfill-customer-phones.ts'`, después de
    `MIGRAR` **y de `prisma generate`** (orden `[migrate, generate, relleno, seed, …]`), en `CON_TODO`
    y en `CON_TODO_Y_DEMO`, y añadido a `DE_BASE` (D16);
  - va tras `generate` porque el relleno lee las columnas nuevas con el cliente Prisma, y Vercel
    cachea `node_modules` con el cliente viejo: antes de `generate` fallaría. Es el mismo motivo por el
    que el seed ya va tras `generate`. Sigue siendo el primer paso que usa la base tras migrar;
  - mismo criterio de entornos que `migrate`: local/CI, production y preview sí; development, vacío
    o sin `VERCEL_ENV`, no.
  - Si falla, el build falla (como `migrate`).
  - `tests/unit/scripts/build.test.ts` y `tests/guards/guard-despliegue-produccion.test.ts` se
    ajustan a la lista nueva de pasos.
- **Seed:** `seed.ts` no se toca. Su alcance en producción es «nunca modifica», y el relleno sí
  modifica.

## 4. Dominio `clientes`

### 4.1 `domain/customer-phone.ts` (nuevo; importa `libphonenumber-js/max`)

- **`libphonenumber-js/max` y no el `min` por defecto:** con `min`, `isValid()` solo comprueba la
  longitud (README del paquete, § `isValid()`). R9 pide validar los dígitos. Es el mismo paquete:
  solo cambia el punto de entrada.
- **`parseCustomerPhone(country: string | null, number: string | null)`**:
  - `{ kind: 'none' }` si el número está en blanco (R10);
  - `{ kind: 'country_required' }` si hay número y no hay país (R8);
  - `{ kind: 'invalid_country' }` si el código no está en `getCountries()` (R15);
  - `{ kind: 'invalid_number' }` si no es `isValid()` para ese país (R9);
  - `{ kind: 'ok', phoneCountry, phoneE164, phone }` en otro caso:
    - `phoneE164` = `number.number` sin el `+`;
    - `phone` = `formatInternational()` (R11).
  - Un número con `+` y otro prefijo distinto del país elegido es `invalid_number`: el servidor no
    cambia el país por su cuenta. Eso lo hace solo la UI (R7).
- **`parseCustomerPhoneText(text, country)`**: la variante que usa el relleno. Interpreta el texto
  libre antiguo con `country` como país por defecto y devuelve el país del número si el texto trae
  `+`.
- **`formatPhoneNational(e164, country)`** para el formulario (R4, R6).
- **`formatPhoneInternational(e164)`** para la lista (R29).
- **Formato (D14):** `formatInternational()` y `formatNational()` de la librería tal cual, sin
  formato propio. Con `libphonenumber-js` 1.13.15, un móvil de Colombia sale `+57 300 1234567` y
  `300 1234567`. Si una versión nueva de los metadatos lo cambia, cambia con ella.
- **`countryFromInternationalInput(text)`** para R7: devuelve un `CountryCode`, o `null` si el
  prefijo no da un país único.
- **`describeCustomerPhone(customer)`** para la celda de la lista (§ 8.4), sobre `phone`,
  `phoneE164` y `phoneIssue`. Devuelve, en este orden de prioridad:
  - `{ kind: 'international', text }` si hay `phoneE164`, con `formatPhoneInternational` (R29);
  - `{ kind: 'issue', legacyPhone, issue, label }` si hay `phoneIssue` y `phone`, con la etiqueta
    corta (D13, R30);
  - `{ kind: 'legacy', legacyPhone }` si hay `phone` sin `phoneE164` ni `phoneIssue`: la fila
    pendiente de relleno (D22, R36);
  - `{ kind: 'none' }` en otro caso.
  - El formulario usa la misma función para saber si la fila es pendiente (§ 8.1).

### 4.2 `domain/phone-matches-wa-id.ts` (nuevo, puro, sin `libphonenumber-js`)

`phoneMatchesWaId(phoneE164: string, waId: string): boolean`:

1. Si alguno no cumple `^[0-9]+$`, devuelve `false` (R22).
2. `canonical(x)`:
   - 13 dígitos que empiezan por `521` → `52` + resto (MX);
   - 13 dígitos que empiezan por `549` → `54` + resto (AR);
   - 13 dígitos que empiezan por `55` con un `9` en la posición 5 (tras el área) → se quita ese
     `9` (BR);
   - cualquier otro → igual.
3. Devuelve `canonical(a) === canonical(b)` (R18–R21).

Se exporta desde el barrel. Este spec no fija qué hace con él QC-239.

### 4.3 Esquema de entrada (`domain/customer-input.ts`)

- **Cambio de forma:** el campo `phone` de entrada se sustituye por `phoneCountry` (`''` = sin país)
  y `phoneNumber` (texto de hasta `CUSTOMER_PHONE_MAX_LENGTH` = 40).
- **`superRefine`** con `parseCustomerPhone`:
  - `country_required` → issue en `['phoneCountry']`;
  - `invalid_number` → issue en `['phoneNumber']`;
  - `invalid_country` → issue en `['phoneCountry']`.
  - Cada issue lleva `params.reason`.
- **El `transform` devuelve** `phone`, `phoneCountry`, `phoneE164` y `phoneIssue: null` ya resueltos.
- El formulario sigue usando **el mismo esquema** para la validación previa (patrón actual de
  `customer-form.tsx`).
- El comentario «sin `refine` cruzado entre opcionales» deja de ser cierto y se reescribe.

### 4.4 Errores (`domain/errors.ts`) y catálogo (`lib/modules/errores`)

| Clase | `code` | Mensaje del catálogo |
| --- | --- | --- |
| `CustomerPhoneCountryRequiredError` | `customer_phone_country_required` | «Elige el país del teléfono.» |
| `CustomerPhoneInvalidError` | `customer_phone_invalid` | «Este número no es válido para el país elegido.» |
| `CustomerDuplicatePhoneError` | `customer_duplicate_phone` | «Este teléfono ya está registrado en otro cliente.» |

- En `create-customer.ts` y `update-customer.ts`, el fallo de `safeParse` se traduce por la
  `reason` del primer issue de teléfono a la clase que toca. El resto sigue siendo `ValidationError`.
- El mensaje del servidor para un número no válido es genérico. El que nombra el país («…para
  Colombia (+57).», R9) lo compone la UI con `countryOptionLabel`, porque el catálogo no lleva
  parámetros.
- Los tres códigos se añaden a `error-codes.ts` con su nota de enmienda fechada, como las anteriores,
  y a `error-catalog.ts`.

### 4.5 Tipos y puerto

- **`Customer` / `CustomerView`:** ganan `phoneCountry: string | null`, `phoneE164: string | null` y
  `phoneIssue: 'invalid_format' | 'duplicate' | null`.
- **`NewCustomer`:** gana `phoneCountry`, `phoneE164` y `phoneIssue`.
- **`CustomerRepository`:**
  - `create` devuelve `{ id } | 'duplicate_phone'`;
  - `updateAlive` devuelve `'ok' | 'not_found' | 'duplicate_phone'`.
  - Se reescribe el comentario «Sin resultado 'duplicate'».
- **El adaptador** `customer-prisma.ts`:
  - mapea las tres columnas;
  - traduce el error de unicidad de Prisma (`P2002`, o el `23505` de Postgres) **cuando nombra
    `customers_company_phone_e164_key`** a `'duplicate_phone'`. Cualquier otro error se relanza.
  - No hay `SELECT` previo: el índice es la garantía (R14; alternativa descartada en § 10).
- **Los casos de uso** traducen `'duplicate_phone'` a `CustomerDuplicatePhoneError` (R12).
- **Conservar el teléfono antiguo al editar (R34, R36; D12, D22).** Cuando el número llega vacío,
  `update-customer.ts` manda en `NewCustomer` el teléfono como `{ kind: 'keep_legacy_or_clear' }`
  en vez de los cuatro nulos. Dentro de la transacción de `updateAlive`, el adaptador decide con lo
  que hay en la base, no con lo que dice la UI, con dos `UPDATE` y sin `SELECT … FOR UPDATE` (D21):
  1. un `UPDATE` de los demás datos del cliente, que bloquea la fila hasta el final de la
     transacción;
  2. un segundo `UPDATE` que pone a nulo `phone`, `phone_country`, `phone_e164` y `phone_issue`,
     con el ámbito de empresa, `deleted_at IS NULL` y esta condición en su `where`:
     `phone_issue IS NULL AND (phone IS NULL OR phone_e164 IS NOT NULL)` (en Prisma,
     `phoneIssue: null, OR: [{ phone: null }, { phoneE164: { not: null } }]`).
  - El segundo `UPDATE` solo vacía el teléfono de una fila **convertida** (con `phone_e164`) o ya
    sin teléfono (sin efecto). Caso por caso:

    | Fila en la base | El segundo `UPDATE` | Resultado |
    | --- | --- | --- |
    | Migrada con `phone_issue` | no la encuentra | se conserva el teléfono antiguo (R34) |
    | Pendiente de relleno (`phone`, sin `phone_e164` ni `phone_issue`) | no la encuentra | se conserva `phone` (R36, D22) |
    | Convertida (`phone_e164`) | la vacía | queda sin teléfono (R10) |
    | Sin teléfono | la vacía, sin cambio real | sigue sin teléfono (R10) |

  - Postgres lo decide sobre la fila ya bloqueada por el primer `UPDATE`.
  - Los demás datos del cliente se guardan igual en los dos casos.
  - **Por qué no `FOR UPDATE`:** exigiría SQL crudo con `company_id`, que `guard-ambito-empresa-clientes`
    prohíbe fuera de `company-scope.ts` (la misma razón que D17; alternativa descartada en § 10).
  - El alta no usa esta variante: con el número vacío guarda los nulos.
- **Editar conservando el propio número** no choca (R13): el índice compara con las demás filas.
- **`CustomerCatalog`** (lo consume `pedidos`) no cambia de forma.

## 5. Adaptador driving `customer-actions.ts`

`buildCustomerCandidate` lee `phoneCountry` y `phoneNumber` del `FormData` en lugar de `phone`. Nada
más cambia.

**Contrato del formulario:**

| Campo de `FormData` | Valor |
| --- | --- |
| `phoneCountry` | código ISO alfa-2 o `''` |
| `phoneNumber` | texto tal cual lo escribió el usuario |

**Respuestas nuevas de error** (`ErrorState.code`): `customer_phone_country_required`,
`customer_phone_invalid` y `customer_duplicate_phone`.

## 6. `identity`: leer el país de una empresa (D2, § 3.2)

- **Puerto:** `CompanyCountryRepository` gana
  `findCountryOf(companyId: string): Promise<CountryCode | null>`. Una empresa inexistente, dada de
  baja o sin país responde `null`.
- **Adaptador:** `company-country-prisma.ts` lo implementa (`SELECT country FROM companies WHERE id = $1 AND deleted_at IS NULL`).
- **Caso de uso:** `domain/get-company-country.ts` → `createGetCompanyCountry({ companies })`
  devuelve `(companyId) => Promise<CountryCode | null>`. No lleva actor: es un dato de presentación
  de la propia empresa, sin autorización propia.
  - La pantalla que lo pide ya cortó por `clientes.consultar`.
  - El `companyId` sale de la sesión firmada, nunca de la entrada.
- **Barrel y composición:**
  - se exporta en `identity/index.ts`;
  - se cablea como `identity.getCompanyCountry`;
  - en `clientes`, como `companyCountryOf` del relleno, sin que `clientes` importe tripas de
    `identity`: la composición ata el puerto `CompanyCountryLookup` de `clientes` a la función de
    `identity`.

## 7. Pantalla `app/(private)/clientes/page.tsx`

Tras el corte por permiso, la página lee
`identity.getCompanyCountry((await identity.getSessionContext()).companyId)`, dentro de la misma
lectura de sesión por petición (QC-104).

El valor `companyCountry: CountryCode | null` baja por props:

`CustomerListSection` → `CustomerTable` → (`CustomerSheet` de la barra) y (`CustomerRowActions` →
`CustomerSheet`) → `CustomerForm` → `CustomerPhoneField`

El test del conteo de lecturas de sesión (`docs/architecture.md > Permisos y autenticacion`, «Una
sola lectura de sesión por petición») debe seguir verde.

## 8. UI

### 8.1 `CustomerPhoneField` (nuevo, `app/(private)/clientes/components/customer-phone-field.tsx`)

- **Props:**
  - `companyCountry: CountryCode | null`;
  - `customer?: CustomerView`;
  - `countryError?` y `numberError?`;
  - los valores devueltos tras un fallo;
  - `testId` base.
- **Estructura:** un rótulo visible «Teléfono» y, debajo, un `div role="group"` que lo referencia
  con `aria-labelledby`. Dentro van:
  - `CountrySelect` con `label="País del teléfono"` oculto a la vista (`hideLabel`), `pinned`,
    `compactOnMobile`, `errorId` y `triggerClassName="max-lg:h-12"` (48 px por debajo de escritorio,
    como el número; R33);
  - un `<input type="hidden" name="phoneCountry">` con su valor. `CountrySelect` no pone `name`, así
    que lo pone el consumidor, como dice su fila;
  - `TextField name="phoneNumber" type="tel" inputMode="tel" autoComplete="tel-national"`, con
    `aria-label` «Número de teléfono», `errorId` y `errorOutside`.
  - **Placeholder del número:** el número de ejemplo de móvil del país marcado, en su formato
    nacional: `getExampleNumber(country, examples)?.formatNational()`, con `examples` de
    `libphonenumber-js/mobile/examples` (§ 11). Es el formato de la librería (D14), no el del
    tablero. Sin país marcado, no hay placeholder.
- **Valor inicial:**
  - **Alta:** país = `companyCountry` (R2, R3), número vacío.
  - **Edición sin `phoneCountry`:** país = `companyCountry`, igual que el alta (R35, D19), número
    vacío.
  - **Edición con `phoneE164`:** país = `phoneCountry`, número =
    `formatPhoneNational(phoneE164, phoneCountry)` (R4).
  - **Edición con `phoneIssue`:** país = `phoneCountry`, número vacío, y bajo el campo la
    `StatusBadge` `waiting` con la etiqueta larga (D13) y el texto de ayuda de la enmienda de § 1
    (R31).
  - **Edición de una fila pendiente de relleno** (`describeCustomerPhone` da `legacy`; D22): país =
    `companyCountry`, como cualquier edición sin `phoneCountry` (R35); número vacío; y bajo el
    campo, **sin** `StatusBadge`, un párrafo de ayuda enlazado al grupo por `aria-describedby`
    (R36, D23):
    «Antes: <phone>. Escribe un número para reemplazarlo; si lo dejas vacío, se conserva.», con
    `<phone>` en mono.
- **Al salir del número** (`onBlur`):
  1. Si empieza por `+`, `countryFromInternationalInput` y, si da país, se cambia el selector (R7).
  2. Si es válido para el país, se reescribe con `formatPhoneNational` (R6).
  3. Si no está vacío y no es válido, se pinta el error de número con el país en el texto (R9).
  - **Al pegar** (`onPaste`) se hace el paso 1 en cuanto se lee el texto pegado.
  - No se reformatea en `onChange` (D10).
- **Errores:** los dos los pinta `CustomerPhoneField` con `FieldError` bajo toda la fila, como el
  tablero, cada uno con su `id`:
  - el del país (`customer-error-phone-country`) se enlaza a `CountrySelect` por `errorId` (D20),
    que marca el disparador con `aria-invalid` y `aria-describedby`;
  - el del número y el de duplicado (`customer-error-phone-number`) se enlazan a `TextField` por
    `errorId` con `errorOutside`: el `input` queda con `aria-invalid` y `aria-describedby`, y el
    campo no pinta su propio `FieldError`.
  - La entrada de error usa `qc-err`, como dice el tablero.

### 8.2 Extensión de `CountrySelect` (props opcionales; sin ellas, nada cambia)

| Prop | Efecto | Requisito |
| --- | --- | --- |
| `pinned?: { code: CountryCode; label: string }` | Con el buscador vacío y `pinned` presente, pinta un grupo arriba con el rótulo `label` (aquí «País de la empresa») y la opción de ese país, un separador y el grupo «Todos» con «Sin país» primero y la lista completa (el país fijado se repite en su sitio). Con texto en el buscador: una sola lista filtrada, sin rótulos. | R5 |
| `hideLabel?: boolean` | La etiqueta queda solo para lectores de pantalla (`sr-only`). Sigue siendo el nombre del disparador y el título de la hoja en teléfono («País del teléfono»). | R1, R33 |
| `compactOnMobile?: boolean` | A ≤ 640 px el disparador muestra `CO +57` en mono y su `aria-label` lleva el nombre completo. | R33 |
| `errorId?: string` (D20) | El error lo pinta el consumidor fuera del selector, con ese `id`. El disparador queda con `aria-invalid` y `aria-describedby={errorId}`. Hace falta porque el `FieldError` interno solo se puede pintar dentro de la columna del selector (112 px en teléfono) y el tablero pone «Elige el país del teléfono.» bajo toda la fila. | R8 |
| `triggerClassName?: string` | Clases extra del disparador, unidas con `cn` a las suyas; p. ej. otra altura para alinearlo con los controles vecinos. Aquí, `max-lg:h-12`. Sin ella, el disparador no cambia. | R33 |

Su fila del catálogo se actualiza en el mismo commit: los puntos de extensión y
`TelefonoCliente.dc.html` en «Diseño».

**Extensión de `TextField`** (`components/shared/text-field.tsx`; props opcionales, sin ellas nada
cambia):

| Prop | Efecto | Requisito |
| --- | --- | --- |
| `placeholder?: string` | Se pasa tal cual al `input`. `TextField` no tenía rest props, así que ningún uso de hoy podía pasarlo ya. | R6 (el ejemplo en el formato de D14) |
| `errorOutside?: boolean` (por defecto `false`) | El error lo pinta el consumidor fuera del campo, p. ej. bajo una fila de controles. Con ella, `error` solo marca el `input` con `aria-invalid` y lo enlaza con `aria-describedby={errorId}`; el campo no pinta su `FieldError`. | R9, R12 |

Su fila del catálogo nombra las dos props, con «sin ellas no cambia nada». Ninguna de las dos es
un cambio visual por defecto.

### 8.3 `CustomerForm`

- `phone` sale de `CUSTOMER_BUSINESS_FIELDS` como campo de texto suelto y entra
  `CustomerPhoneField`.
- La validación previa mapea las issues `['phoneCountry']` y `['phoneNumber']` a sus mensajes (R8,
  R9).
- Del resultado del servidor, `customer_phone_country_required`, `customer_phone_invalid` y
  `customer_duplicate_phone` se pintan **bajo el campo**, no en la región general (R12). El resto
  sigue yendo a la región general.
- El comentario «ningún código de este módulo identifica un campo» deja de ser cierto y se reescribe.
- Los `data-testid` de hoy (`customer-field-phone`, `customer-error-phone`) pasan a:
  - `customer-field-phone-country`, `customer-field-phone-number`;
  - `customer-error-phone-country`, `customer-error-phone-number`;
  - `customer-phone-issue`.

### 8.4 Lista (`customer-columns.tsx`)

La celda «Teléfono» usa `describeCustomerPhone(view)`, de dominio y exportada por el barrel:

- **`phoneE164`:** `formatPhoneInternational`, en mono (R29).
- **`phoneIssue`:** el `phone` antiguo en `text-muted-foreground` + `StatusBadge tone="waiting"`
  con la etiqueta corta (D13: «Sin formato válido» / «Duplicado: revisar», R30). El `data-testid` es `customer-phone-issue-<id>`.
- **`legacy`, fila pendiente de relleno (D22, R36):** el `phone` antiguo en `font-mono
  text-muted-foreground`, **sin** `StatusBadge`. El `data-testid` es `customer-phone-legacy-<id>`.
- **Sin teléfono:** `MissingValue`, como hoy.

**Sin tarjeta en teléfono (D18).** `CustomerTable` no pasa `card` a `DataTable`, así que a ≤ 640 px
se ve la misma tabla. La tarjeta del tablero necesitaría código nuevo (un `card` para
`CustomerTable`, un cambio visual de la lista) y queda fuera de esta ficha, como deuda (§ 13). R29 se
cumple en la tabla, a cualquier ancho.

### 8.5 Desviaciones del tablero, declaradas

- **Texto de ayuda de la edición de un migrado:** cambia por D12 (enmienda de § 1).
- **El tablero dice «`CountrySelect` sin cambios de forma»**, pero el disparador compacto `CO +57`
  del mismo tablero necesita `compactOnMobile` (§ 8.2). Es una extensión opcional, no un cambio de
  los usos existentes. Lo mismo vale para `errorId` (D20).
- **Formato del número:** el de `libphonenumber-js`, no el del tablero (D14, enmienda de § 1).
- **Sin tarjeta de la lista en teléfono:** deuda (D18, § 8.4).
- **Fila pendiente de relleno:** el tablero no la dibuja. Se pinta como dice la enmienda de § 1
  (D22, D23).

## 9. Datos de demostración y otros consumidores de `createCustomer`

- **`scripts/seed-demo/gateway.ts`** llama a `clientes.createCustomer` con `phone`. Pasa a mandar
  `phoneCountry: 'CO'` y `phoneNumber: customer.phone`.
  - Los cuatro números demo (`+57 310 000 300x`) deben ser válidos con `max`. Si alguno no lo es,
    el seed fallaría y se corrige el dato demo.
- **Los specs E2E** que crean clientes por Prisma directo no pasan por el esquema y no cambian.
- **`e2e/clientes.spec.ts`** sí cambia (T11).

## 10. Alternativas descartadas

1. **Convertir los datos dentro de la migración SQL.** Postgres no tiene `libphonenumber`. Un remedo
   con expresiones regulares no sabe qué números son válidos en cada país y contradiría D1.
   Descartada: por eso hay relleno en TypeScript (§ 3).
2. **Relleno a mano, un comando que el humano corre una vez por entorno.** Es fácil olvidarlo: el
   índice y la lista funcionarían, pero los migrados quedarían sin número ni aviso hasta que alguien
   se acordara. En el build es mecánico, idempotente y sale en el log.
3. **Derivar el aviso al leer, sin columna `phone_issue`** (si hay `phone` y no `phone_e164`, se
   reinterpreta: válido = duplicado, no válido = sin formato). Ahorra una columna, pero:
   - la etiqueta cambiaría sola al actualizar los metadatos de la librería o al borrar al otro
     cliente;
   - la lista tendría que reinterpretar en cada fila;
   - y el estado «revisado» no se podría probar contra la base.
4. **Comprobar el duplicado con un `SELECT` previo en vez del índice.** Dos guardados simultáneos
   pasarían los dos (R14). El índice hace falta igual; el `SELECT` solo duplicaría la regla.
5. **Guardar `phone_e164` con `+` (E.164 canónico).** El `wa_id` llega sin `+`, y D4 exige igualdad
   directa con índice.
6. **Metadatos `min` (el punto de entrada por defecto).** Solo validan la longitud, así que `300 12`
   de más longitud pasaría. Contradice R9.
7. **Llevar el país de la empresa en la sesión firmada.** Cambiaría el formato de la cookie (QC-48)
   por un dato que solo usa una pantalla, y un cambio de país no se vería hasta el siguiente inicio
   de sesión. La lectura en la página (§ 7) es una consulta corta.
8. **Relleno con `listCompaniesWithPending` y `SELECT … FOR UPDATE`** (el diseño original de § 3.3).
   Alcanzaba también a las empresas desactivadas, pero necesita una consulta de `customers` que
   cruza empresas y SQL crudo con `company_id`, y `guard-ambito-empresa-clientes` prohíbe las dos.
   Descartada por D17: se recorren las empresas activas y el `where` de cada `UPDATE` sustituye al
   bloqueo.
9. **Un formato propio para Colombia (`300 123 4567`)**, como dibuja el tablero. Sería código nuevo
   que mantener por país. Descartada por D14.
10. **`SELECT … FOR UPDATE` en la edición que conserva el teléfono antiguo** (el diseño original de
    § 4.5). Bloqueaba la fila antes de decidir, pero necesita SQL crudo con `company_id`, que
    `guard-ambito-empresa-clientes` prohíbe. Descartada por D21: el primer `UPDATE` ya bloquea la
    fila y el `where` del segundo decide.
11. **Vaciar el teléfono de una fila pendiente de relleno al guardarla con el número vacío** (el
    segundo `UPDATE` solo con `phone_issue IS NULL`, como decía antes § 4.5). Es más simple, pero
    borra un `phone` que el relleno aún no ha convertido solo por editar otro dato del cliente.
    Contradice D6 y D12. Descartada por D22.

## 11. Dependencias

No entra ninguna. `libphonenumber-js` ya está aprobada (D1, `docs/dependencias.md`).
`libphonenumber-js/max` es un subpath del mismo paquete.

- **A comprobar en T3:** la guardia `guard-arquitectura-modulos` decide por `target.name`. Si ese
  nombre conserva el subpath, se añade `'libphonenumber-js/max'` a `PURE_PACKAGES` y la tabla de
  `docs/architecture.md > La regla de dependencias` lo nombra.
- **Coste:** unos 65 kB más de metadatos en el bundle del cliente para la pantalla de clientes
  (README del paquete).

**`libphonenumber-js/mobile/examples`** (V2-m2). Otro subpath del mismo paquete aprobado: no es una
dependencia nueva y `package.json` no cambia.

- **Uso:** solo el placeholder del número (§ 8.1). `getExampleNumber(country, examples)` da el
  móvil de ejemplo de cada país (es el uso que documenta el README del paquete, § `getExampleNumber`).
- **Dónde:** solo en `app/` (`app/(private)/clientes/components/customer-phone-field.tsx`), nunca
  en el dominio. Por eso no entra en `PURE_PACKAGES` ni lo mira `guard-arquitectura-modulos`.
- **`getExampleNumber`** sale del punto de entrada por defecto (`min`), que ya cargaba
  `components/shared/country-options.ts`. Para un número de ejemplo, el `formatNational()` es el
  mismo con `min` que con `max` (comprobado en los 245 países en la revisión).
- **Coste:** el JSON de ejemplos (un número por país) en el bundle de la pantalla de clientes.
- **Ahorra:** una tabla propia de números de ejemplo por país, que habría que mantener a mano.

## 12. Riesgos

- **Choque de archivos:** `lib/composition/index.ts`, `error-codes.ts`, `error-catalog.ts`,
  `db/schema.prisma`, `components/shared/CATALOGO.md` y `tests/integration/aislamiento.json` son
  registros de apéndice compartidos con otras fichas. Se editan solo añadiendo.
- **Tests heredados de QC-154** que afirman lo contrario de D3 o D1 (`customer-input.test.ts` R17,
  `customer-service.test.ts` R19 y, si resulta que afirma algo sobre el comentario `///` del modelo,
  `customers-schema.test.ts`; no se ha comprobado que lo haga): se ajustan **en lo que toca al
  teléfono**, y el `impl_` lo declara.

## 13. Deuda que deja esta ficha (D17, D18)

- **Clientes de empresas desactivadas sin convertir (D17).** El relleno no los alcanza: siguen con
  `phone_e164` y `phone_issue` nulos. No se ven en ninguna pantalla mientras su empresa siga
  desactivada.
- **Tarjeta de la lista en teléfono (D18).** El tablero la dibuja; la lista usa la misma tabla en
  todos los anchos.
