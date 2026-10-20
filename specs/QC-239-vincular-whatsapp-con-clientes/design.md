# QC-239 — vincular-whatsapp-con-clientes · design.md

> Zona: `backend` · Complejidad: `high` · depends_on: QC-236, QC-238 · Rama:
> `feature/QC-239-vincular-whatsapp-con-clientes`
>
> El **qué** está en `requirements.md` (R1–R49). Aquí va el **cómo**. Precedentes que se copian:
>
> - **QC-236** (`specs/QC-236-*/design.md`): columnas `phone*` de `customers`, `phoneMatchesWaId`,
>   el relleno `backfill-legacy-phones`, `isPhoneUniqueViolation` y el patrón de dos `UPDATE` sin
>   `FOR UPDATE` (D21).
> - **QC-238** (`specs/QC-238-*/design.md`): `whatsapp_contacts`, la transacción de
>   `whatsapp-inbox-prisma.ts` y su `INSERT … ON CONFLICT`.
> - **`pedidos`** (`OrderUnitOfWork`, `order-unit-of-work-prisma.ts`, `orderTransactionScopeOn` en
>   `lib/composition/index.ts`): una transacción que escribe en dos módulos, con un puerto de unidad
>   de trabajo en el dominio y los adaptadores de los dos módulos atados al mismo `tx` en la
>   composición.
> - **`inventario`** (`createMaterialReservations(db: PrismaLike = prisma)`): adaptador driven que
>   recibe el cliente transaccional.
> - **`documentos`** (`requireAddon`): corte por añadido en el caso de uso.
>
> **Regla transversal.** Manda `docs/conventions.md > Comentarios`: ningún comentario nuevo cita
> `QC-<n>`, `R<n>`, `design.md` ni «decisión cerrada». En los tests, `R<n>` va en el nombre del caso.

---

## Lo que ya existe

Buscado (2026-10-20) `customer_phones`, «teléfonos de cliente», `phone_numbers`, `vincular`,
`bloquear`/`blocked_at`, `customer_linked`, `link_source`, `phoneMatchesWaId` y `WhatsappContact`:

- en el board (`feature_list.json`, `name` y `description`, todos los estados);
- en `specs/` con Grep;
- en el código con Grep/Read sobre `lib/`, `db/`, `app/`, `tests/`, `e2e/`. **El MCP del grafo no
  tiene indexado este worktree** (`list_projects` no lo lista): se usó Grep/Read.

| Dónde | Qué apareció | Qué se hace |
|---|---|---|
| Board | QC-119 (`cancelled`, recepción antigua). QC-245, QC-246, QC-240, QC-302 y QC-303 nombran a QC-239 como **proveedora** (contactos vinculados, botones, responder a desconocidos, teléfonos en el formulario). Ninguna ficha crea una tabla de teléfonos ni el bloqueo. | Nada que reutilizar. Las fronteras están en § 11. |
| `specs/QC-236-*` | `customers.phone`, `phone_country`, `phone_e164`, `phone_issue`; índice `customers_company_phone_e164_key`; `CustomerDuplicatePhoneError`; relleno con `duplicate`; `phoneMatchesWaId`. | **Se reutiliza** `phoneMatchesWaId` y se extiende su archivo (§ 5.1). Se retiran el índice y el error (R7). El relleno deja de marcar `duplicate`, reconvierte a los ya marcados y crea el vínculo principal (R13, R49). |
| `specs/QC-238-*` | `WhatsappContact.customerId` sin FK, con índice; §11 deja a QC-239 la FK y el cruce con `clientes`. `recordWhatsappInbound` con su transacción. | **Se reutiliza**: la FK nace aquí (§ 2.3) y la transacción se amplía (§ 6.6). |
| Código `clientes` | `CustomerRepository`, `customer-prisma.ts` (`create`, `updateAlive`, `updateKeepingLegacyPhone`), `legacy-phone-prisma.ts`, `company-scope.ts`, `requirePermission(actor, permiso)`. | Se amplían (§ 5). |
| Código `integraciones` | `Actor` sin `addons`, `requirePermission` fijo a `integraciones.modificar`, `company-scope.ts` con `whatsappContactCompanyScope` ya creada. | Se amplían (§ 6). |
| Código `pedidos` / `inventario` | Unidad de trabajo entre módulos y adaptadores con `db: PrismaLike`. | Se copia la forma (§ 7). |
| Ningún modelo de teléfonos, ninguna marca de bloqueo ni de vínculo manual | — | Nacen aquí. |

Conclusión: no existe nada que resuelva parte del alcance. Se sigue. **La feature no crea UI**:
solo retira un código de error que el formulario de clientes ya mapeaba (§ 9). No se consulta
`components/shared/CATALOGO.md` y no hace falta pase `/design`.

---

## 1. Qué cambia (resumen)

```
db/schema.prisma                         ← 2 modelos nuevos (clientes) + 3 columnas en WhatsappContact
db/migrations/20261020120000_customer_phone_numbers/{migration,down}.sql
lib/modules/clientes/
  index.ts                               ← + waIdCandidates, parseWaIdPhone, fábricas de teléfonos
  domain/phone-matches-wa-id.ts          ← + waIdCandidates
  domain/customer-phone.ts               ← + parseWaIdPhone
  domain/customer-phone-links.ts         ← nuevo: syncMainPhone, addWaIdToCustomer, removeWaIdFromCustomer
  domain/create-customer.ts, update-customer.ts   ← por la unidad de trabajo
  domain/errors.ts                       ← − CustomerDuplicatePhoneError
  domain/legacy-phone-backfill.ts, backfill-legacy-phones.ts   ← sin `duplicate`; reconvierte los `duplicate`
  ports/customer-repository.ts           ← − create/updateAlive (pasan a la escritura transaccional)
  ports/customer-write-repository.ts     ← nuevo
  ports/customer-phone-repository.ts     ← nuevo
  ports/customer-unit-of-work.ts         ← nuevo
  ports/legacy-phone-repository.ts       ← resumen sin `duplicate`
  adapters/driven/persistence/company-scope.ts          ← + 2 envolturas
  adapters/driven/persistence/customer-prisma.ts        ← `db`, sin unicidad
  adapters/driven/persistence/customer-phone-prisma.ts  ← nuevo
  adapters/driven/persistence/customer-unit-of-work-prisma.ts ← nuevo
  adapters/driven/persistence/legacy-phone-prisma.ts    ← crea el principal, sin reintento
lib/modules/integraciones/
  index.ts                               ← + 5 fábricas y la regla
  domain/actor.ts                        ← + addons, requireCustomerLinkPermission
  domain/errors.ts                       ← + 3 errores
  domain/whatsapp-contact-link.ts        ← nuevo: resolveContactLink (la regla)
  domain/whatsapp-contact-input.ts       ← nuevo: zod de las acciones
  domain/refresh-whatsapp-contact-links.ts ← nuevo
  domain/link-whatsapp-contact.ts        ← nuevo
  domain/unlink-whatsapp-contact.ts      ← nuevo
  domain/set-whatsapp-contact-blocked.ts ← nuevo (bloquear y desbloquear)
  domain/receive-whatsapp-webhook.ts     ← conteo sin los descartados
  ports/whatsapp-contact-repository.ts   ← nuevo
  ports/customer-phone-owners.ts         ← nuevo
  ports/customer-phone-links.ts          ← nuevo
  ports/whatsapp-contact-unit-of-work.ts ← nuevo
  ports/whatsapp-inbox-repository.ts     ← `record` devuelve los descartados
  adapters/driven/persistence/whatsapp-contact-prisma.ts      ← nuevo
  adapters/driven/persistence/whatsapp-contact-unit-of-work-prisma.ts ← nuevo
  adapters/driven/persistence/whatsapp-inbox-prisma.ts        ← bloqueo + regla de vínculo
  adapters/driving/whatsapp-contact-actions.ts                ← nuevo: 4 Server Actions
lib/modules/errores/domain/{error-codes,error-catalog}.ts     ← − 1 código, + 3
lib/composition/index.ts                 ← unidades de trabajo y cableado
app/(private)/clientes/components/customer-form.tsx           ← − mapeo de `customer_duplicate_phone`
scripts/backfill-customer-phones.ts      ← resumen sin `duplicate`
tests/**                                 ← § 12
```

---

## 2. Modelo de datos

### 2.1 `phone_numbers` (modelo `PhoneNumber`, `/// @module clientes`)

```prisma
/// Un numero por empresa. Nunca se borra: un numero sin clientes es una fila sin uso.
/// @module clientes
model PhoneNumber {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  companyId String   @map("company_id") @db.Uuid
  e164      String   @db.VarChar(15)
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)

  @@unique([companyId, e164], map: "phone_numbers_company_id_e164_key")
  @@unique([companyId, id], map: "phone_numbers_company_id_id_key")
  @@map("phone_numbers")
}
```

- `CHECK (e164 ~ '^[1-9][0-9]{6,14}$')`, el mismo que `customers_phone_e164_format_check` (R1).
- **Sin `deleted_at` y sin país.** La fila es solo el número: nunca cambia y nunca se borra, porque
  lo que se quita es el **vínculo** (R4). El país se deriva del número cuando hace falta
  (`parseWaIdPhone`, § 5.2). El país que eligió el usuario en el formulario sigue en
  `customers.phone_country` (§ 3).
- La unicidad `(company_id, e164)` es la del **catálogo de números**, no la del cliente: dos
  clientes comparten la misma fila de número a través de dos vínculos (R2).

### 2.2 `customer_phone_numbers` (modelo `CustomerPhoneNumber`, `/// @module clientes`)

```prisma
/// FK compuestas con company_id escritas a mano en la migracion; los indices unicos son parciales
/// y viven solo en la migracion.
/// @module clientes
model CustomerPhoneNumber {
  id            String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  companyId     String    @map("company_id") @db.Uuid
  customerId    String    @map("customer_id") @db.Uuid
  phoneNumberId String    @map("phone_number_id") @db.Uuid
  main          Boolean   @default(false)
  createdAt     DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt     DateTime  @updatedAt @map("updated_at") @db.Timestamptz(6)
  deletedAt     DateTime? @map("deleted_at") @db.Timestamptz(6)

  @@index([companyId, phoneNumberId], map: "customer_phone_numbers_company_phone_idx")
  @@map("customer_phone_numbers")
}
```

Solo en la migración:

```sql
CREATE UNIQUE INDEX "customer_phone_numbers_customer_phone_key"
  ON "customer_phone_numbers" ("customer_id", "phone_number_id") WHERE "deleted_at" IS NULL;
CREATE UNIQUE INDEX "customer_phone_numbers_customer_main_key"
  ON "customer_phone_numbers" ("customer_id") WHERE "main" AND "deleted_at" IS NULL;
```

- Son los dos rechazos de R3.
- **FK (R47):**
  - `(company_id, customer_id) → customers (company_id, id)`, con la clave candidata
    `customers_company_id_id_key` que ya usan `orders` y `order_deliveries`;
  - `(company_id, phone_number_id) → phone_numbers (company_id, id)`;
  - `company_id → companies (id)`.
  - Todas `ON DELETE RESTRICT ON UPDATE CASCADE`.
- **Sin `@relation`**, como `Customer` y `WhatsappContact`: un `include` no puede cruzar de empresa.
- **Sin `created_by`/`updated_by`.** Ningún criterio pide auditar quién añadió un teléfono. Cuando el
  cambio es una edición de negocio, el cliente ya guarda `updated_by` (§ 3).

### 2.3 `whatsapp_contacts`: tres columnas y la FK (`/// @module integraciones`)

| Columna | Prisma | SQL |
|---|---|---|
| `customer_linked_by` | `customerLinkedBy String? @map("customer_linked_by") @db.Uuid` | `UUID NULL` |
| `blocked_at` | `blockedAt DateTime? @map("blocked_at") @db.Timestamptz(6)` | `TIMESTAMPTZ NULL` |
| `blocked_by` | `blockedBy String? @map("blocked_by") @db.Uuid` | `UUID NULL` |

- `CHECK whatsapp_contacts_customer_link_check`: `customer_linked_by IS NULL OR customer_id IS NOT NULL`.
- `CHECK whatsapp_contacts_blocked_check`: `(blocked_at IS NULL) = (blocked_by IS NULL)`.
- **FK `(company_id, customer_id) → customers (company_id, id) ON DELETE RESTRICT ON UPDATE CASCADE`**
  (R47). QC-238 la dejó a esta ficha. `RESTRICT` porque los clientes nunca se borran físicamente y
  la decisión sobre el chat de un cliente dado de baja es de QC-245 (D5). Hoy todas las filas tienen
  `customer_id` nulo (QC-238 R16), así que la FK se crea sin validar nada.
- `customer_linked_by` y `blocked_by` van **sin FK a `users`**, como `whatsapp_messages.sent_by` en
  QC-238: el usuario sale de la sesión, nunca de la entrada.
- `customer_linked_by` es a la vez la **marca de vínculo manual** y su auditoría (§ 4).

### 2.4 Migración `20261020120000_customer_phone_numbers`

Escrita a mano (FK compuestas e índices parciales), en este orden:

1. `CREATE TABLE phone_numbers`, `CREATE TABLE customer_phone_numbers`, sus CHECK, índices y FK.
2. **Copia (R5)**, con el paréntesis de RLS del precedente `20261016120000_products_last_batch_at`:
   `ALTER TABLE "customers" NO FORCE ROW LEVEL SECURITY;` y después:
   ```sql
   INSERT INTO phone_numbers (company_id, e164, updated_at)
     SELECT DISTINCT company_id, phone_e164, now() FROM customers
     WHERE deleted_at IS NULL AND phone_e164 IS NOT NULL;
   INSERT INTO customer_phone_numbers (company_id, customer_id, phone_number_id, main, updated_at)
     SELECT c.company_id, c.id, p.id, true, now()
     FROM customers c JOIN phone_numbers p
       ON p.company_id = c.company_id AND p.e164 = c.phone_e164
     WHERE c.deleted_at IS NULL AND c.phone_e164 IS NOT NULL;
   ```
   y `ALTER TABLE "customers" FORCE ROW LEVEL SECURITY;`. Las tablas nuevas aún no fuerzan RLS en
   este punto.
3. `DROP INDEX "customers_company_phone_e164_key";` (R7).
4. `ALTER TABLE whatsapp_contacts ADD COLUMN` × 3, los dos CHECK y la FK de § 2.3.
5. `ENABLE` y `FORCE ROW LEVEL SECURITY` en `phone_numbers` y `customer_phone_numbers`, sin
   policies (R48).

**`down.sql`** (R6), en orden inverso:

1. FK, CHECK y columnas de `whatsapp_contacts`.
2. **Antes de recrear el índice único**, deshace los repetidos que el UP permitió, con el criterio
   D11 de QC-236 (se queda el número el más reciente por `created_at DESC, id DESC`). Dentro del
   mismo paréntesis `NO FORCE`/`FORCE` de `customers`:
   ```sql
   UPDATE customers c SET phone_e164 = NULL, phone_issue = 'duplicate'
   FROM (SELECT id, row_number() OVER (PARTITION BY company_id, phone_e164
                                       ORDER BY created_at DESC, id DESC) AS rn
         FROM customers WHERE deleted_at IS NULL AND phone_e164 IS NOT NULL) d
   WHERE c.id = d.id AND d.rn > 1;
   ```
   El CHECK `customers_phone_coherence_check` lo admite: `phone` se conserva, porque toda fila con
   `phone_e164` tiene `phone` (QC-236 R11).
3. `CREATE UNIQUE INDEX "customers_company_phone_e164_key" …` igual que en QC-236 § 2.2.
4. `DROP TABLE customer_phone_numbers`, `DROP TABLE phone_numbers`.

Se verifica con UP → DOWN → UP sobre la base de test y con el caso «dos clientes con el mismo
número tras el UP: el DOWN deja uno con número y el otro `duplicate`» (§ 12).

### 2.5 Guardias de esquema

- `guard-empresa-en-esquema`: las dos tablas nuevas tienen `company_id`; la lista de exentas no
  cambia.
- `guard-rls-force`: las ve por la migración.
- `guard-arquitectura-modulos` (R13 de `module-shape` de integraciones y la regla `prisma.<modelo>`):
  `PhoneNumber` y `CustomerPhoneNumber` solo se tocan desde `clientes/adapters/driven`, y
  `WhatsappContact` solo desde `integraciones/adapters/driven`.
- Sin filas de permisos: `clientes.modificar` ya existe.

---

## 3. Convivencia con las columnas `phone*` de QC-236: espejo del principal

**Decisión.** `customers.phone`, `phone_country`, `phone_e164` y `phone_issue` **se quedan** y
siguen siendo lo que leen la lista, el formulario, `describeCustomerPhone` y los migrados con aviso
(R14). La tabla puente es la fuente de los **números** (dueños, vincular, recálculo).

Las dos se mantienen coherentes con un **invariante** (R8): para todo cliente vivo,

> `phone_e164` no nulo ⇔ hay exactamente un vínculo vivo con `main = true`, y su número es
> `phone_e164`.

Quién escribe y cómo se respeta el invariante, siempre **dentro de la misma transacción**:

| Escritor | Columnas de `customers` | Tabla puente |
|---|---|---|
| Alta con número (R9) | las escribe `createCustomer`, como hoy | `syncMainPhone` crea el principal |
| Edición que cambia el número (R10) | las escribe `updateAlive`, como hoy | `syncMainPhone` deja el principal anterior como secundario y el nuevo como principal (o promueve el secundario) |
| Edición con el número vacío (R11) | regla D12/D22 de QC-236, sin cambios | si la fila tenía `phone_e164`, `syncMainPhone(null)` quita el principal; si no, nada |
| Edición con el mismo número (R12) | sin cambio real | `syncMainPhone` no hace nada |
| Vincular sin principal (R27, R28) | `writeMainMirror`: `phone = formatPhoneInternational(e164)`, `phone_country` = el país derivado, `phone_e164`, `phone_issue = null`, `updated_at`, `updated_by` = actor | crea el vínculo principal |
| Vincular con principal (R27) | nada | crea el vínculo secundario |
| Desvincular el principal (R35) | `writeMainMirror(null)`: las cuatro a nulo, con `updated_at`/`updated_by` | quita el vínculo |
| Relleno (R13, R49) | lo de QC-236, y además reconvierte los `duplicate` | crea el principal de cada fila convertida o reconvertida |

- **Los `invalid_format` y los pendientes no tienen vínculo**, porque no tienen `phone_e164`. El
  texto antiguo y su etiqueta siguen igual (R14, D12, D22 de QC-236). Los `duplicate` dejan de
  existir tras la primera pasada del relleno (R49, § 5.7).
- **`phoneMatchesWaId` no cambia**: se aplica a los números de la tabla puente (§ 5.1).
- **Lo que gana el espejo:** la lista, el formulario, los tests de QC-236 sobre la lista y el
  formulario, `CustomerCatalog` y el relleno no cambian de forma. QC-302 podrá leer los
  secundarios de la tabla puente sin romper nada de lo de hoy.
- **Lo que cuesta:** dos sitios que escriben el principal. El riesgo de que diverjan se cierra con
  la transacción única y con un test de invariante que recorre los seis escritores (§ 12, R8).

---

## 4. La regla de vínculo y la marca manual

### 4.1 La regla (`integraciones/domain/whatsapp-contact-link.ts`, pura)

```ts
export type ContactLink = { readonly customerId: string | null; readonly linkedBy: string | null };

/** owners: ids de los clientes vivos de la empresa con un telefono vivo que coincide. */
export function resolveContactLink(current: ContactLink, owners: readonly string[]): ContactLink {
  if (current.customerId !== null && current.linkedBy !== null && owners.includes(current.customerId)) {
    return current;
  }
  if (owners.length === 1) return { customerId: owners[0], linkedBy: null };
  return { customerId: null, linkedBy: null };
}
```

Es la «regla de vínculo» del requirements. La aplican **los dos** caminos: la recepción (§ 6.6,
R15–R18) y el recálculo (§ 6.2, R21–R25). Así, los dos no pueden divergir y el próximo mensaje
entrante corrige lo que una carrera haya dejado mal (§ 13).

Consecuencias, cada una con su test:

- sin cliente + un dueño → automático (R22);
- automático con X + X sigue siendo el único dueño → igual;
- automático con X + aparece otro dueño → sin cliente (R18, R24);
- manual con X + X sigue siendo dueño, aunque haya otros → igual (R18, R24);
- manual con X + X deja de ser dueño → un dueño único o ninguno (R23);
- cliente dado de baja: no está en `owners` (R17), así que su vínculo cae aunque sea manual. Es lo
  que QC-245 espera: «si ese número vuelve a escribir, queda no vinculado».

### 4.2 Cómo se marca el vínculo manual

**`whatsapp_contacts.customer_linked_by`**: el id del usuario que eligió el cliente. Nulo cuando el
vínculo es automático o no hay vínculo.

- Vincular (§ 6.3) lo escribe con `actor.id` (R26).
- La regla escribe siempre `linkedBy: null` cuando vincula sola, y lo conserva cuando mantiene un
  vínculo manual.
- Un único dato da la marca y la auditoría («quién eligió este cliente»). La alternativa con una
  columna de origen está descartada en § 14.

---

## 5. Módulo `clientes`

### 5.1 `domain/phone-matches-wa-id.ts`: `waIdCandidates`

```ts
/** Todos los numeros que `phoneMatchesWaId` da por iguales a `digits`, incluido el mismo. */
export function waIdCandidates(digits: string): readonly string[];
```

- Si `digits` no es de solo dígitos → `[]`.
- `c = canonical(digits)`. Resultado: `{digits, c}` y, si `c` mide 12 dígitos:
  - empieza por `52` → `'521' + c.slice(2)`;
  - empieza por `54` → `'549' + c.slice(2)`;
  - empieza por `55` → `c.slice(0, 4) + '9' + c.slice(4)`.
- Sirve para buscar por índice (`e164 IN (…)`) en lugar de recorrer todos los números. Después de
  leer, el adaptador vuelve a filtrar con `phoneMatchesWaId` (la función de QC-236 sigue siendo la
  única verdad).
- **Test de propiedad (R19):** para una muestra de números de MX, AR, BR, CO y US, todo candidato
  cumple `phoneMatchesWaId(candidato, digits)`, y todo número de 7–15 dígitos que cumple
  `phoneMatchesWaId(x, digits)` está entre los candidatos.

### 5.2 `domain/customer-phone.ts`: `parseWaIdPhone`

```ts
/** El primer candidato que `libphonenumber-js/max` da por valido, con su pais; o null. */
export function parseWaIdPhone(waId: string): { e164: string; country: CountryCode } | null;
```

- Prueba en orden: `waId` tal cual y después el resto de `waIdCandidates(waId)`. Para cada uno,
  `parsePhoneNumberFromString('+' + d)` con `isValid()` y `country` definido.
- Si ninguno vale → `null` (R30). Así, un `wa_id` mexicano con el `1` se guarda en la forma que la
  librería da por válida, y `phoneMatchesWaId` lo sigue reconociendo.
- Los ejemplos del test (los cinco países y un `wa_id` sin país válido) se contrastan con la
  versión instalada de `libphonenumber-js`.

### 5.3 Puertos nuevos

```ts
// ports/customer-phone-repository.ts — todos los metodos con `scope: CustomerScope` al final.
export type CustomerPhoneLink = { readonly linkId: string; readonly e164: string; readonly main: boolean };

export interface CustomerPhoneRepository {
  isAlive(customerId: string, scope: CustomerScope): Promise<boolean>;
  listAliveLinks(customerId: string, scope: CustomerScope): Promise<readonly CustomerPhoneLink[]>;
  /** Crea el numero si no existe en la empresa y el vinculo. */
  addLink(customerId: string, e164: string, main: boolean, now: Date, scope: CustomerScope): Promise<void>;
  removeLinks(linkIds: readonly string[], now: Date, scope: CustomerScope): Promise<void>;
  setMain(linkId: string, main: boolean, now: Date, scope: CustomerScope): Promise<void>;
  /** Columnas phone* del cliente vivo; null las deja a nulo. */
  writeMainMirror(customerId: string, mirror: CustomerPhoneColumns | null, actorId: string, now: Date, scope: CustomerScope): Promise<void>;
  /** Clientes vivos con un vinculo vivo a alguno de esos numeros, ya filtrados por phoneMatchesWaId. */
  findAliveOwners(waId: string, scope: CustomerScope): Promise<readonly string[]>;
}

// ports/customer-write-repository.ts — create y updateAlive salen de CustomerRepository.
export interface CustomerWriteRepository {
  create(data: NewCustomer & { readonly phone: CustomerPhoneColumns }, actorId: string, now: Date, scope: CustomerScope): Promise<{ id: string }>;
  /** before/after: el phone_e164 de la fila bloqueada antes y despues de escribir. */
  updateAlive(id: string, data: NewCustomer, actorId: string, now: Date, scope: CustomerScope):
    Promise<{ kind: 'ok'; before: string | null; after: string | null } | 'not_found'>;
}

// ports/customer-unit-of-work.ts
export type WhatsappLinkRefresher = { refresh(numbers: readonly string[], companyId: string): Promise<void> };
export type CustomerTransactionScope = {
  readonly customers: CustomerWriteRepository;
  readonly phones: CustomerPhoneRepository;
  readonly whatsappLinks: WhatsappLinkRefresher;
};
export interface CustomerUnitOfWork { run<T>(work: (scope: CustomerTransactionScope) => Promise<T>): Promise<T> }
```

- `CustomerRepository` se queda con `findAliveById`, `softDeleteAlive` y `listAlive`. Pierde
  `'duplicate_phone'` y su comentario.
- `WhatsappLinkRefresher` es un puerto de `clientes`: `clientes` **no importa** `integraciones`.
  La composición lo ata al recálculo de `integraciones` (§ 7).

### 5.4 Dominio de teléfonos (`domain/customer-phone-links.ts`)

Funciones puras de orquestación sobre `CustomerPhoneRepository`. Ninguna valida permisos: las
llaman casos de uso que ya lo hicieron (los de `clientes` en § 5.5 y los de `integraciones` en
§ 6.3–6.4, a través de la composición).

- **`syncMainPhone(phones, customerId, e164 | null, now, scope) → readonly string[]`**: devuelve los
  números añadidos o quitados (para el recálculo):
  - `main` = el vínculo principal vivo actual.
  - `e164 === main?.e164` → `[]` (R12).
  - `e164 === null`: si hay `main`, `removeLinks([main.linkId])` y devuelve `[main.e164]`; si no,
    `[]` (R11).
  - Si no: si hay `main`, se **degrada** a secundario (`setMain(main.linkId, false)`). El cliente
    sigue siendo dueño del número anterior y sus contactos conservan el vínculo (R10).
    - Si ya hay un vínculo vivo secundario con `e164` → `setMain(…, true)` y devuelve `[]`: los
      dueños no cambian.
    - Si no → `addLink(…, main: true)` y devuelve `[e164]`. El recálculo vincula los contactos de
      ese número que ya tenían mensajes (R21, R22).
  - El orden degradar → promover o crear respeta `customer_phone_numbers_customer_main_key` dentro
    de la transacción.
  - `setMain(linkId, main: boolean, …)`: el puerto de § 5.3 recibe el booleano.
- **`addWaIdToCustomer(phones, { customerId, waId, actorId, now }, scope)`**
  → `'customer_not_found' | 'invalid_number' | { numbers: readonly string[] }`:
  1. `isAlive` falso → `'customer_not_found'` (R31).
  2. `links = listAliveLinks`. Si alguno cumple `phoneMatchesWaId(link.e164, waId)` →
     `{ numbers: [] }` (R29).
  3. `parsed = parseWaIdPhone(waId)`; `null` → `'invalid_number'` (R30).
  4. `isMain = !links.some((l) => l.main)`. `addLink(customerId, parsed.e164, isMain, …)` (R27).
  5. Si `isMain`, `writeMainMirror(customerId, { phone: formatPhoneInternational(parsed.e164),
     phoneCountry: parsed.country, phoneE164: parsed.e164, phoneIssue: null }, actorId, …)` (R28).
     Un cliente con solo un teléfono antiguo con aviso no tiene principal: el texto antiguo y su
     aviso se reemplazan (decisión del 2026-10-20).
  6. `{ numbers: [parsed.e164] }`.
- **`removeWaIdFromCustomer(phones, { customerId, waId, actorId, now }, scope)`**
  → `{ numbers: readonly string[] }`:
  - quita todos los vínculos vivos del cliente que coinciden con `waId` (R34);
  - si uno era el principal, `writeMainMirror(customerId, null, …)` sin promover a otro (R35);
  - devuelve sus números.
- **`ownersOfWaId(phones, waId, scope)`** = `findAliveOwners`.

Se exportan por el barrel como fábricas que reciben `{ phones }`, igual que las demás:
`createCustomerPhoneLinks({ phones })` → `{ addWaId, removeWaId, ownersOf }` con la empresa como
`companyId: string` (el `CustomerScope` se construye dentro, como en `buildCustomerCatalog`).

### 5.5 Alta y edición (`create-customer.ts`, `update-customer.ts`)

- Las dependencias pasan de `{ customers }` a `{ unitOfWork: CustomerUnitOfWork }`. El permiso
  sigue siendo la primera línea (`requirePermission(actor, 'clientes.modificar')`).
- **Alta:** `unitOfWork.run(async ({ customers, phones, whatsappLinks }) => { const { id } = await
  customers.create(…); const numbers = await syncMainPhone(phones, id, phoneE164, now, scope);
  await whatsappLinks.refresh(numbers, scope.companyId); return { id }; })` (R9, R21).
- **Edición:** igual, con `updateAlive` → `'not_found'` lanza `CustomerNotFoundError`; si no,
  `syncMainPhone(phones, id, result.after, …)`.
  - **`syncMainPhone` recibe `after`**, el valor que quedó en la base, y no el de la entrada: con el
    número vacío, la regla D12/D22 la decide el adaptador. Por eso un migrado con aviso no pierde
    nada (R11).
- Ya no existe la traducción de `'duplicate_phone'` (R7).

### 5.6 Adaptadores driven de `clientes`

- **`customer-prisma.ts`**: `createCustomer` y `updateAliveCustomer` reciben `db: PrismaLike` como
  primer parámetro. Desaparecen `isPhoneUniqueViolation`, `PHONE_UNIQUE_INDEX` y los `try/catch`
  de unicidad.
  - `updateAliveCustomer` hace, sobre `db`:
    1. el `updateMany` de los datos de negocio, que bloquea la fila;
    2. lee `phoneE164` (`before`);
    3. escribe el teléfono: la escritura directa o los dos `UPDATE` de D21, ahora sin abrir su
       propia transacción, porque ya va dentro de la de la unidad de trabajo;
    4. lee `phoneE164` (`after`).
  - `createCustomerWriteRepository(db)` ata las dos al puerto.
- **`customer-phone-prisma.ts`** (nuevo): `createCustomerPhoneRepository(db)`.
  - Sin SQL crudo y sin `@relation`: `findAliveOwners` hace tres lecturas con el ámbito:
    1. `phoneNumber.findMany` por `e164 in waIdCandidates(waId)`;
    2. `customerPhoneNumber.findMany` vivos por esos ids;
    3. `customer.findMany` vivos por esos clientes.

    Después filtra con `phoneMatchesWaId`.
  - `addLink` usa `phoneNumber.upsert` sobre `phone_numbers_company_id_e164_key` y crea el vínculo.
  - Todas las funciones declaran `scope: CustomerScope` y lo pasan a las envolturas.
- **`company-scope.ts`** gana `phoneNumberCompanyScope` y `customerPhoneNumberCompanyScope`, las dos
  `return companyScope(scope)`.
- **`customer-unit-of-work-prisma.ts`** (nuevo): `withCustomerTransaction(run)` =
  `prisma.$transaction(run, { maxWait: 10_000, timeout: 30_000 })`.
  - Si choca contra `customer_phone_numbers_customer_main_key` o `…_customer_phone_key` (dos
    escrituras simultáneas del mismo cliente), reintenta la unidad entera una vez en una
    transacción nueva, como `withOrderTransaction`.
  - Si vuelve a chocar, el error sube.
- **`legacy-phone-prisma.ts`**: por cada fila convertida o reconvertida (`count === 1`), en la
  misma transacción, `addLink(…, main: true)` con el repositorio de teléfonos sobre `tx` (driven →
  driven del mismo módulo, permitido) (R13, R49). Sin reintento por unicidad: ya no hay índice que
  choque. El filtro de pendiente cambia según § 5.7.
  - **No recalcula contactos.** El relleno no está entre los cambios que lo exigen (Alcance), y el
    siguiente mensaje entrante aplica la regla.

### 5.7 Relleno sin `duplicate`, y reconversión de los `duplicate` (R13, R49)

- `planLegacyPhoneBackfill(rows, country)` pierde `taken` y el agrupado: toda fila válida sale con
  su número. `LegacyPhoneOutcome` solo produce `phoneIssue: null | 'invalid_format'`.
- **Una fila es candidata del relleno si está viva, tiene `phone`, no tiene `phone_e164`, y su
  `phone_issue` es nulo o `'duplicate'`.** Las `invalid_format` no se tocan.
- **País con el que se interpreta cada fila:**
  - la pendiente usa el de la empresa (o `CO`), como en QC-236;
  - la `duplicate` usa **su** `phone_country`, que el relleno de QC-236 dejó escrito con el país
    con el que la interpretó.
  - Por eso `LegacyPhoneRow` gana `phoneCountry: CountryCode | null`, y el plan usa
    `row.phoneCountry ?? country`.
- Una `duplicate` cuyo texto sigue siendo válido sale con `phone_e164` y `phoneIssue: null`. Si con
  los metadatos de hoy ya no lo es, sale `invalid_format`, que es lo que es ahora.
- **Idempotencia:** el `where` de cada `UPDATE` repite la condición de candidata y el `updatedAt`
  leído, como en QC-236. Tras una pasada, ninguna fila viva queda en `duplicate`, y una segunda
  pasada no encuentra candidatas (R49).
- Corre en el build tras `migrate` y `generate`, sin pasos nuevos: la reconversión llega a todos los
  entornos donde corre el relleno. Las empresas desactivadas quedan fuera, como en QC-236 (D17).
- El resumen cambia `duplicate` por `reconverted`, que cuenta las `duplicate` convertidas; la
  línea `[backfill-telefonos]` lo muestra.
- `'duplicate'` sigue siendo un valor válido de la columna: el DOWN de § 2.4 puede volver a
  escribirlo.

---

## 6. Módulo `integraciones`

### 6.1 Actor y permiso (R43, R44)

- `Actor` gana `addons?: readonly string[]`, como `documentos`.
- `requireCustomerLinkPermission(actor)`:
  - `assertPermission(actor, 'clientes.modificar', () => new UnauthorizedError())`;
  - `assertAddon(actor, 'integraciones', () => new UnauthorizedError())`;
  - la misma comprobación de `companyId` que `requirePermission`.
  - Es **la primera línea** de las cuatro acciones, antes de zod y de cualquier puerto.
- Por qué no se usa el `requirePermission` de `clientes`: lanzaría un `ClientesError`, y el
  traductor de errores de las acciones de `integraciones` reconoce `IntegracionesError`.

### 6.2 Recálculo (`domain/refresh-whatsapp-contact-links.ts`)

```ts
createRefreshWhatsappContactLinks(deps: { contacts: WhatsappContactRepository; owners: CustomerPhoneOwners })
  : (numbers: readonly string[], scope: IntegracionesScope) => Promise<void>
```

1. `numbers` vacío → no hace nada (R25).
2. `candidates` = unión de `waIdCandidates(n)` (barrel de `clientes`).
3. `contacts.findByWaIds(candidates, scope)`.
4. Por cada contacto: `owners = await deps.owners.ownersOf(contact.waId, scope.companyId)`;
   `next = resolveContactLink(contact.link, owners)`; si cambia → `contacts.setLink(contact.id,
   next, scope)` (R21–R24).

### 6.3 Vincular (`domain/link-whatsapp-contact.ts`)

`createLinkWhatsappContact({ unitOfWork, now? })` → `(input: unknown, actor) => Promise<void>`

1. `requireCustomerLinkPermission(actor)`.
2. `linkWhatsappContactSchema` (zod: `contactId` y `customerId` como uuid). Un id sin forma de uuid
   responde como no encontrado, igual que `clientes`.
3. `unitOfWork.run(async ({ contacts, customerPhones, owners }) => …)`:
   - `contact = contacts.findById(contactId, scope)`; `null` → `WhatsappContactNotFoundError`
     (R32);
   - `r = customerPhones.addWaId(customerId, contact.waId, actor.id, now, companyId)`:
     `'customer_not_found'` → `LinkedCustomerNotFoundError` (código `customer_not_found`, R31);
     `'invalid_number'` → `WhatsappContactNumberInvalidError` (R30);
   - `contacts.setLink(contact.id, { customerId, linkedBy: actor.id }, scope)` (R26);
   - `refresh(r.numbers, scope)` con los mismos `contacts` y `owners`. El contacto recién vinculado
     conserva su vínculo porque es manual y su cliente es dueño (R33).
4. Un error lanzado dentro del `run` deshace todo (R33).

### 6.4 Desvincular (`domain/unlink-whatsapp-contact.ts`)

1. Permiso y zod (`contactId`).
2. En la unidad de trabajo:
   - contacto inexistente → `WhatsappContactNotFoundError`;
   - `customerId === null` → termina sin cambios (R36);
   - `r = customerPhones.removeWaId(contact.customerId, contact.waId, actor.id, now, companyId)`;
   - `contacts.setLink(contact.id, { customerId: null, linkedBy: null }, scope)`;
   - `refresh(r.numbers, scope)` (R34). Si el número tiene otro dueño único, el contacto pasa a él
     como automático: es la regla, y el test lo fija.

### 6.5 Bloquear y desbloquear (`domain/set-whatsapp-contact-blocked.ts`)

`createSetWhatsappContactBlocked({ contacts, now? })` → `(input: unknown, actor) => Promise<void>`,
con `{ contactId, blocked: boolean }`:

- Permiso, zod y después `contacts.setBlocked(contactId, blocked ? { at: now(), by: actor.id } :
  null, scope)` → `'ok' | 'not_found'`.
- El adaptador hace un `updateMany` con la condición en el `where`:
  - bloquear: `blockedAt: null`;
  - desbloquear: `blockedAt: { not: null }`.

  Si `count` sale 0, comprueba si el contacto existe para distinguir «sin cambios» (R37) de «no
  existe».
- No necesita la unidad de trabajo: es una sola tabla.
- Desbloquear no toca mensajes: lo descartado nunca se guardó (R38).

### 6.6 Recepción (`whatsapp-inbox-prisma.ts`, `receive-whatsapp-webhook.ts`)

`recordWhatsappInbound` pasa a ser `createWhatsappInboxRecorder({ ownersOn })`, donde
`ownersOn(tx): CustomerPhoneOwners` lo da la composición sobre el mismo `tx`. Dentro de la
transacción de QC-238, en orden:

1. **Bloqueados (R39, R41):** `tx.whatsappContact.findMany({ where: { connectionId, waId: { in:
   waIds del lote }, blockedAt: { not: null }, ...whatsappContactCompanyScope(scope) }, select: {
   waId: true } })`. Sus contactos y mensajes salen del lote.
2. **Contactos no bloqueados:** el mismo `INSERT … ON CONFLICT` de QC-238, con
   `RETURNING id, customer_id, customer_linked_by`. Después:
   - `owners = await ownersOn(tx).ownersOf(waId, companyId)`;
   - `next = resolveContactLink(current, owners)`;
   - si cambia, `updateMany` del contacto con el ámbito (R15–R18).
3. Mensajes de los no bloqueados (`createMany … skipDuplicates`).
4. **Statuses, todos** (R40).
5. `last_webhook_at` de la conexión (R40).

- `record` devuelve `{ discardedBlocked: number }`. El caso de uso resta los descartados de
  `counts.messages`. La respuesta sigue siendo `200` (R39) y nada de R27 de QC-238 entra en el log.
- Un fallo de la búsqueda de dueños es una excepción dentro de la transacción: se deshace el lote y
  la ruta responde `500` (R20).
- La carrera «se bloquea mientras llega un mensaje» se acepta: lo que ya estaba en vuelo se guarda,
  y los siguientes se descartan.

### 6.7 Puertos nuevos de `integraciones`

```ts
// ports/whatsapp-contact-repository.ts — `scope: IntegracionesScope` al final de cada metodo.
export type WhatsappContactLinkRow = { readonly id: string; readonly waId: string; readonly link: ContactLink };
export interface WhatsappContactRepository {
  findById(id: string, scope: IntegracionesScope): Promise<WhatsappContactLinkRow | null>;
  findByWaIds(waIds: readonly string[], scope: IntegracionesScope): Promise<readonly WhatsappContactLinkRow[]>;
  setLink(id: string, link: ContactLink, scope: IntegracionesScope): Promise<void>;
  setBlocked(id: string, blocked: { at: Date; by: string } | null, scope: IntegracionesScope): Promise<'ok' | 'not_found'>;
}
// ports/customer-phone-owners.ts
export interface CustomerPhoneOwners { ownersOf(waId: string, companyId: string): Promise<readonly string[]> }
// ports/customer-phone-links.ts
export interface CustomerPhoneLinks {
  addWaId(customerId: string, waId: string, actorId: string, now: Date, companyId: string):
    Promise<'customer_not_found' | 'invalid_number' | { numbers: readonly string[] }>;
  removeWaId(customerId: string, waId: string, actorId: string, now: Date, companyId: string):
    Promise<{ numbers: readonly string[] }>;
}
// ports/whatsapp-contact-unit-of-work.ts
export type WhatsappContactTransactionScope = {
  readonly contacts: WhatsappContactRepository;
  readonly customerPhones: CustomerPhoneLinks;
  readonly owners: CustomerPhoneOwners;
};
export interface WhatsappContactUnitOfWork { run<T>(work: (s: WhatsappContactTransactionScope) => Promise<T>): Promise<T> }
```

- `CustomerPhoneOwners` y `CustomerPhoneLinks` reciben `companyId: string` y no un scope: son
  servicios de otro módulo, como `CustomerCatalog` para `pedidos`.
- `whatsapp-contact-prisma.ts`: `createWhatsappContactRepository(db)`, con funciones con nombre que
  declaran `scope: IntegracionesScope` y usan `whatsappContactCompanyScope`.
- `whatsapp-contact-unit-of-work-prisma.ts`: `withWhatsappContactTransaction(run)`, con el mismo
  reintento único de § 5.6.

---

## 7. Composición (`lib/composition/index.ts`)

```ts
type Tx = Parameters<Parameters<typeof withCustomerTransaction>[0]>[0];

function customerPhoneLinksOn(tx: Tx) {               // servicio de clientes sobre tx
  return createCustomerPhoneLinks({ phones: createCustomerPhoneRepository(tx) });
}
function whatsappLinkRefreshOn(tx: Tx): WhatsappLinkRefresher {
  const refresh = createRefreshWhatsappContactLinks({
    contacts: createWhatsappContactRepository(tx),
    owners: { ownersOf: customerPhoneLinksOn(tx).ownersOf },
  });
  return { refresh: (numbers, companyId) => refresh(numbers, { companyId }) };
}
const customerUnitOfWork: CustomerUnitOfWork = {
  run: (work) => withCustomerTransaction((tx) => work({
    customers: createCustomerWriteRepository(tx),
    phones: createCustomerPhoneRepository(tx),
    whatsappLinks: whatsappLinkRefreshOn(tx),
  })),
};
const whatsappContactUnitOfWork: WhatsappContactUnitOfWork = {
  run: (work) => withWhatsappContactTransaction((tx) => {
    const links = customerPhoneLinksOn(tx);
    return work({ contacts: createWhatsappContactRepository(tx), customerPhones: links, owners: links });
  }),
};
// integraciones: inbox con los duenos sobre el mismo tx de la recepcion
const whatsappInboxRepository = { record: createWhatsappInboxRecorder({ ownersOn: (tx) => customerPhoneLinksOn(tx) }) };
```

- `clientes.createCustomer`/`updateCustomer` pasan a `{ unitOfWork: customerUnitOfWork }`.
- `integraciones` gana `linkWhatsappContact`, `unlinkWhatsappContact` y `setWhatsappContactBlocked`.
- **Orden del archivo:** el bloque de `clientes` está antes del de `integraciones`. Lo que cruza
  bloques son **declaraciones de función** (como `buildCustomerCatalog`) e imports, que se elevan.
  Ningún `const` se lee antes de declararse.
- **Los dos tipos de `tx` son el mismo** (`Prisma.TransactionClient`). La composición es el único
  sitio que lo nombra.

---

## 8. Server Actions (`integraciones/adapters/driving/whatsapp-contact-actions.ts`)

```ts
'use server';
export type WhatsappContactActionResult = { status: 'success' } | ErrorState;
export async function linkWhatsappContactAction(input: { contactId: string; customerId: string }): Promise<WhatsappContactActionResult>;
export async function unlinkWhatsappContactAction(input: { contactId: string }): Promise<WhatsappContactActionResult>;
export async function blockWhatsappContactAction(input: { contactId: string }): Promise<WhatsappContactActionResult>;
export async function unblockWhatsappContactAction(input: { contactId: string }): Promise<WhatsappContactActionResult>;
```

- `currentActor()` como en `whatsapp-connection-actions.ts`, dentro de `runInRequestScope`, y
  añade `addons: sessionUser.addons`. El test del conteo de lecturas de sesión (lee el disco) la
  encuentra sola y debe seguir verde.
- `toErrorState = createErrorStateTranslator(IntegracionesError, …)`.
- La entrada viaja tal cual al caso de uso, que la valida con zod.
- **Sin `revalidatePath`:** no hay pantalla. Las pantallas que lleguen (QC-245/246) revalidan lo
  suyo (R46).
- Argumento objeto y no `FormData`, porque QC-246 las llamará desde botones del chat, no desde un
  formulario.

---

## 9. Errores y catálogo

| Clase (`integraciones`) | `code` | Mensaje |
|---|---|---|
| `WhatsappContactNotFoundError` | `whatsapp_contact_not_found` | «La conversación no existe.» |
| `WhatsappContactNumberInvalidError` | `whatsapp_contact_number_invalid` | «El número de esta conversación no es un teléfono válido.» |
| `LinkedCustomerNotFoundError` | `customer_not_found` (ya existe) | el del catálogo |

- Se **retira** `customer_duplicate_phone` de `error-codes.ts` (con su nota de enmienda fechada) y de
  `error-catalog.ts`.
- Se retira `CustomerDuplicatePhoneError` de `clientes` y del barrel.
- En `customer-form.tsx` desaparecen `DUPLICATE_PHONE_CODE` y su `case`. No es un cambio visual: el
  error ya no puede llegar.
- La etiqueta «Teléfono duplicado: revisar» de `customer-phone-field.tsx` es de `phone_issue` y
  **se queda**. Tras el relleno ningún cliente vivo la muestra (R49), pero el valor sigue siendo
  posible después de un DOWN (§ 2.4). Retirarla es cosa de quien retire el valor de la columna.

---

## 10. Server Actions de teléfonos: van en QC-303

**Decisión (humano, 2026-10-20).** Las acciones para listar, agregar, quitar y marcar como
principal un teléfono **no entran** en esta ficha. Van en **QC-303**
(`telefonos-de-cliente-backend`), que está bloqueada por QC-239 y bloquea a QC-302 (el formulario,
frontend).

Por qué encaja:

- **No tienen consumidor aquí.** Nada de esta ficha las llama, así que su contrato no lo probaría
  nadie de verdad.
- **Su forma depende del pase `/design` de QC-302.** El formulario puede guardar la lista entera de
  teléfonos con el cliente o usar acciones sueltas.
- **Lo que QC-303 encuentra hecho y probado:**
  - la tabla puente y el invariante del espejo (§ 3);
  - `CustomerPhoneRepository` (`listAliveLinks`, `addLink`, `removeLinks`, `setMain`,
    `writeMainMirror`), `syncMainPhone`;
  - `CustomerUnitOfWork` con el recálculo de contactos (`whatsappLinks.refresh`).

  Sobre eso solo añade casos de uso con permiso y sus acciones. Toda escritura de teléfonos que
  añada tiene que llamar a `refresh` con los números añadidos o quitados (R21).

Descartado: entregarlas ya (ver § 14, alternativa 5).

---

## 11. Fronteras con otras fichas

- **QC-245** lista conversaciones (con el número como nombre si no hay cliente), filtra bloqueados y
  decide qué pasa con el chat de un cliente borrado. Lee `customer_id`, `customer_linked_by` y
  `blocked_at`.
- **QC-246** pone los botones y llama a las cuatro acciones de § 8.
- **QC-240** responde a contactos con o sin cliente. Esta ficha no le impone nada.
- **QC-303** entrega los casos de uso y las acciones de teléfonos (§ 10). **QC-302** los muestra y
  gestiona en el formulario.

| Archivo compartido | Cómo se resuelve |
|---|---|
| `db/schema.prisma`, `db/migrations/` | Bloque nuevo; el sello se re-fecha en F2.3 si `dev` trae uno posterior |
| `lib/composition/index.ts` | Solo los bloques de `clientes` e `integraciones`, añadiendo |
| `error-codes.ts`, `error-catalog.ts`, `tests/integration/aislamiento.json` | Solo añadir o retirar las entradas propias |

---

## 12. Tests

### 12.1 Nuevos

| Archivo | Cubre |
|---|---|
| `tests/unit/clientes/phone-matches-wa-id.test.ts` (amplía) | R19: propiedad de `waIdCandidates` |
| `tests/unit/clientes/customer-phone.test.ts` (amplía) | R30: `parseWaIdPhone` con MX con y sin `1`, AR, BR, CO, y uno inválido |
| `tests/unit/clientes/customer-phone-links.test.ts` | R10 (`syncMainPhone`: el anterior queda secundario; devuelve solo el número nuevo; promover un secundario devuelve `[]`), R11, R12 (vacía, igual); R27–R29, R30, R31 (`addWaIdToCustomer`); R34, R35 (`removeWaIdFromCustomer`, sin promover) |
| `tests/unit/clientes/customer-service.test.ts` (ajusta) | R9, R21 (alta y edición llaman a `refresh` con los números devueltos; `refresh` con `[]` cuando no cambia), R7 (sin duplicado), R11 (`syncMainPhone` recibe `after`) |
| `tests/unit/clientes/schema/customer-phone-numbers-migration.test.ts` | R1, R3, R5, R6, R47, R48: texto del SQL (índices parciales por nombre, FK, paréntesis RLS, orden del DOWN) |
| `tests/integration/clientes/customer-phone-numbers.int.test.ts` | R2, R3 (los dos índices rechazan), R4 (borrado lógico), R8 (invariante tras cada escritor de § 3), R9–R13, R17 (`findAliveOwners` excluye bajas, vínculos quitados y otra empresa), R45 |
| `tests/unit/clientes/legacy-phone-backfill.test.ts` (amplía) | R13, R49: el plan sin `taken`; una `duplicate` válida sale con número; una que ya no es válida sale `invalid_format`; usa `row.phoneCountry` antes que el país de la empresa |
| `tests/integration/clientes/legacy-phone-backfill.int.test.ts` (amplía) | R13, R49: tras una pasada, cero `duplicate` vivos, cada reconvertido con su principal (R8), sin recalcular contactos; la segunda pasada no cambia nada; las `invalid_format` siguen igual |
| `tests/integration/integraciones/whatsapp-contact-links.int.test.ts` (caso de R10) | Contacto vinculado al número A; el formulario cambia A por B: el contacto de A sigue vinculado y el contacto previo de B, sin cliente, queda vinculado |
| `tests/integration/clientes/customer-phone-numbers-migration.int.test.ts` | R5 (copia: vivo con número → principal; con aviso, pendiente y baja → nada), R6 (UP → dos clientes con el mismo número → DOWN deja uno `duplicate` → UP) |
| `tests/unit/integraciones/whatsapp/whatsapp-contact-link.test.ts` | La regla, caso por caso de § 4.1 (R15–R18, R22–R24) |
| `tests/unit/integraciones/whatsapp/refresh-whatsapp-contact-links.test.ts` | R21–R25 con dobles |
| `tests/unit/integraciones/whatsapp/link-whatsapp-contact.test.ts` | R26, R30–R33, R43, R44 (sin permiso o sin añadido: ningún puerto llamado) |
| `tests/unit/integraciones/whatsapp/unlink-whatsapp-contact.test.ts` | R34, R36, R43, R44 |
| `tests/unit/integraciones/whatsapp/set-whatsapp-contact-blocked.test.ts` | R37, R38, R43, R44, R32 |
| `tests/unit/integraciones/whatsapp/whatsapp-contact-actions.test.ts` | R46: traducción a `success`/`ErrorState`, actor con `addons` |
| `tests/unit/integraciones/whatsapp/receive-whatsapp-webhook.test.ts` (amplía) | R39 (conteo sin descartados, respuesta `stored`) |
| `tests/integration/integraciones/whatsapp-contact-links.int.test.ts` | Recorrido real con la composición: R21–R24, R26–R29, R33 (fallo forzado después de `setLink` → nada escrito), R34, R35, R42, R45 (contacto o cliente de otra empresa → no encontrado) |
| `tests/integration/integraciones/whatsapp-inbox-prisma.int.test.ts` (amplía) | R15–R19 en la transacción, R20 (dueños que lanzan → nada guardado), R39–R41 |
| `tests/integration/integraciones/whatsapp-webhook-route.int.test.ts` (amplía) | R39: `POST` de un bloqueado → `200`, cero mensajes, contacto igual; R15 de punta a punta |
| `tests/integration/integraciones/whatsapp-messages-constraints.int.test.ts` (amplía) | R47 (contacto con cliente de otra empresa → rechazo de FK), CHECK de § 2.3 |

### 12.2 Tests de QC-236 que cambian (se ajustan en lo que toca al duplicado; el `impl_` lo declara)

- `tests/integration/clientes/customer-phone-uniqueness.int.test.ts`: pasa a afirmar R7 (dos clientes
  con el mismo número se guardan) y se renombra a `customer-phone-shared.int.test.ts`.
- `customer-service.test.ts`, `customer-actions.test.ts`, `customer-repository.int.test.ts`,
  `list-query-customers.int.test.ts`, `legacy-phone-backfill.test.ts`, `legacy-phone-prisma.test.ts`,
  `legacy-phone-backfill.int.test.ts`, `customers-phone-migration.test.ts`/`.int.test.ts`,
  `tests/unit/errores/catalogo.test.ts`, `tests/ui/clientes/customer-phone-field.test.tsx` y
  `e2e/clientes-telefono.spec.ts`: quitan o invierten lo que afirmaba el duplicado. Lo demás se queda.
- `tests/unit/clientes/authorization.test.ts`: las dependencias de alta y edición pasan a ser la
  unidad de trabajo.

### 12.3 Guardias y tests de forma que se tensan (nunca se relajan)

| Archivo | Cambio |
|---|---|
| `tests/guards/guard-ambito-empresa-clientes.test.ts` | + `CustomerPhoneRepository` (7 métodos) y `CustomerWriteRepository` (2) en el barrido. Las funciones con `db` primero y `scope` al final cuentan como cableadas a través de su fábrica `create…(db)`. 4 envolturas. Casos de sensibilidad: un método sin `scope` y una fábrica con un miembro sin función con nombre ⇒ hallazgo |
| `tests/guards/guard-ambito-empresa-integraciones.test.ts` | + `WhatsappContactRepository` (4 métodos) con el mismo barrido. La exención única de QC-238 no cambia |
| `tests/unit/integraciones/module-shape.test.ts` | Lista de archivos, contrato, cableado y quién importa el módulo, con lo nuevo de § 1 |
| `tests/unit/integraciones/whatsapp/whatsapp-doubles.ts` | Dobles de los puertos nuevos |

**Sin E2E nuevo.** No hay pantalla. El recorrido real se cubre con los `.int.test.ts` sobre la
composición, como el webhook en QC-238 § 8.

---

## 13. Riesgos y concurrencia

- **Carrera entre recepción y recálculo.** Los dos leen los dueños en su transacción. Uno puede
  decidir con una lectura que el otro deja vieja al confirmar. Se acepta:
  - la regla es la misma en los dos caminos;
  - el siguiente mensaje entrante la vuelve a aplicar y corrige un vínculo automático;
  - un vínculo manual solo lo escribe un usuario.

  Bloquear filas exigiría SQL crudo con `company_id` que la guardia de `clientes` prohíbe (mismo
  motivo que D17/D21 de QC-236).
- **Dos escrituras del mismo cliente a la vez** (formulario y vincular): los índices de § 2.2 las
  serializan; la unidad de trabajo reintenta una vez (§ 5.6).
- **E2E y semillas que crean clientes por Prisma directo** (lista en `e2e/*.spec.ts`,
  `tests/helpers/order-delivery-seed.ts`): sus clientes no tienen vínculos. No afecta a nada de lo
  que esos specs prueban. `scripts/seed-demo` pasa por `clientes.createCustomer` y sí los crea.
- **Choque de archivos:** § 11.

---

## 14. Alternativas descartadas

1. **Mover las columnas `phone*` a las tablas nuevas y borrarlas de `customers`.** El teléfono queda
   en un solo sitio, pero rompe la lista, el formulario, `describeCustomerPhone`, `CustomerCatalog`,
   el relleno y sus tests. Además, el aviso de los migrados (`phone_issue`) no tiene sitio en una
   tabla de números válidos. Y QC-302 rehará el formulario igualmente. El espejo (§ 3) cumple la
   condición «siguen funcionando igual» sin tocar nada de eso.
2. **Un disparador de Postgres que copie `customers.phone_e164` a la tabla puente.** Cubriría a todos
   los escritores, incluso Prisma directo. Pero esconde lógica de negocio en la base, no puede hacer
   el recálculo de contactos (es otro módulo) y no es probable con unit tests del dominio.
3. **Una columna `customer_link` (`'auto' | 'manual'`) para la marca.** Da lo mismo que
   `customer_linked_by` pero sin saber quién eligió el cliente, y con un estado más que mantener
   coherente.
4. **Buscar los dueños fuera de la transacción de recepción**, en el caso de uso antes de
   `inbox.record`. Evita pasar un `tx` entre módulos, pero el Alcance pide la vinculación en la
   transacción de QC-238 y abre una ventana más entre leer y escribir.
5. **Entregar aquí las Server Actions de teléfonos (hoy QC-303).** Se descarta por § 10: sin consumidor ni pase de
   diseño, el contrato sería una apuesta.
6. **Una sola tabla `customer_phones` (cliente, número, `main`) sin catálogo de números.** Es más
   simple, pero el Alcance fija dos tablas (teléfonos de la empresa y puente), y buscar dueños por
   número sería un barrido de todos los vínculos.
7. **Que «desvincular» solo quite el vínculo y deje el número** (la otra lectura de H2). Necesita una
   tercera marca, «sin cliente por decisión de un usuario». Sin ella, la regla volvería a vincular
   al mismo dueño en el siguiente mensaje.
8. **Conservar `taken` y `duplicate` en el relleno.** Marcaría como duplicado un número válido que
   ahora puede ser de varios clientes, contra la decisión n:m.
9. **Quitar el principal anterior al cambiar el número en el formulario.** Es lo que proponía la
   primera versión del spec. Desvinculaba los chats del número anterior sin que el usuario lo
   viera. El humano eligió degradarlo a secundario (2026-10-20).
10. **Dejar como estaban los migrados con `duplicate`.** Era la propuesta inicial. El humano pidió
    reconvertirlos (2026-10-20). Una migración SQL no puede hacerlo porque no tiene
    `libphonenumber`, así que se amplía el relleno, que ya corre en cada build (§ 5.7).
11. **Reconvertir los `duplicate` con un script aparte, a mano.** Mismo motivo que la alternativa 2
    de QC-236: es fácil olvidarlo. El relleno del build es mecánico e idempotente.

---

## 15. Dependencias de terceros

**Ninguna.** `libphonenumber-js` (y su subpath `/max`) ya está aprobada y en `PURE_PACKAGES`;
`zod` ya está. `package.json` no cambia.
