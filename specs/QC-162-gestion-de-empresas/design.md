# QC-162 — Gestión de empresas por el Maestro · design

Requisitos: `specs/QC-162-gestion-de-empresas/requirements.md` (R1–R44). Sin UI: no hay
componentes ni pase `/design` (la pantalla es de QC-166).

## Lo que ya existe

Términos buscados: «empresa», «company», «companies», «baja», «reactivar», «historial»,
«company_events», «tax_id», «seedInitialAccess», «PlatformActor», «issueForPendingUser»,
«pedidos en curso».

| Dónde | Qué apareció | Qué se hace |
|---|---|---|
| Board (`feature_list.json`) | QC-165 (Administradores por el Maestro, `pending`), QC-166 (pantallas, `pending`, depende de esta), QC-277 (módulos por empresa, reutiliza el historial), QC-235 (país, `done`), QC-182 (moneda). Ninguna otra ficha da de alta, baja o reactiva empresas. | Nada se duplica. Lo de QC-165 (más Administradores, reenvío del enlace, último Administrador) queda fuera (alcance sembrado). |
| `specs/` | QC-235 crea el camino de plataforma. QC-47 crea `companies` y `companies_name_unique`. QC-79 crea el enlace. QC-161 hace el nombre de usuario único en todo el sistema. Ningún spec crea un historial genérico. | Se reutilizan los cuatro (abajo). |
| Código: actor de plataforma | `lib/modules/identity/domain/platform-actor.ts` (`PlatformActor`, `requirePlatformPermission`), `adapters/driving/company-actions.ts` (`currentPlatformActor`, solo `getSessionUser()`), cableado en `lib/composition/index.ts:480-481`. | Se reutiliza tal cual: todos los casos de uso nuevos reciben `PlatformActor` y las acciones nuevas van en `company-actions.ts`. |
| Código: `Company` | `db/schema.prisma:151-164`; RLS activado y forzado sin policies (`20260904180600_companies_and_user_company`); `companies_name_unique` sobre `lower(name_normalized) WHERE deleted_at IS NULL`; `normalizeCompanyName` (`domain/company-name.ts`, cuerpo en `normalize-key.ts`). | Se amplía con cuatro columnas. La unicidad del nombre se reutiliza; la de la identificación copia su forma. |
| Código: errores | `CompanyNotFoundError` (`company_not_found`) en `domain/errors.ts:399`. No hay error de nombre duplicado de empresa. | Se reutiliza `company_not_found`; se añaden cuatro códigos (§ 3.6). |
| Código: baja que expulsa | `session-user-prisma.ts` lee `company.deletedAt`; `resolve-session.ts:101-104` corta la sesión; `verify-credentials.ts:221-232` rechaza el login. | Nada nuevo: R24 se cumple con escribir `deleted_at`. |
| Código: alta de usuario | `createUserSchema` (`domain/user-input.ts:76`), `toBirthDate`, `NO_CREDENTIAL_SENTINEL`, `credentialSetupLinkExpiresAt`, `issueForPendingUser` (`credential-setup-link-prisma.ts:80`), `credentialSetupSecrets` y `credentialSetupMailer` (composición). `users.create` del puerto `UserAdminRepository` **rechaza el rol Administrador** (`'action_not_allowed'`, `user-admin-prisma.ts:298`) y no abre transacción. | Se reutilizan el esquema (sin `roleId` ni `credential`), la conversión de fecha, el centinela, el plazo, la emisión del enlace y el correo. El `INSERT` del Administrador va en el adaptador nuevo, dentro de la transacción del alta (§ 5.1, alternativa 2). |
| Código: lista | `domain/list-query.ts` (contrato QC-57, copia de `identity`), `user-queryable.ts`, `list-users.ts`, `identityListQueryLog`. | Se reutiliza el contrato; `COMPANY_QUERYABLE` nuevo. |
| Código: empresas activas | `company-directory-prisma.ts` (`listActiveCompanyIds`, la usa el cron de caducidad). | No cambia: una empresa de baja sale del cron y una reactivada vuelve a entrar. |
| Código: seed | `seed-initial-access.ts` crea QuimiCloud + Administrador inicial + Maestro; `scripts/build.mjs` corre `tsx scripts/seed.ts` en production, preview y fuera de Vercel; `scripts/seed-demo/gateway.ts:106` busca QuimiCloud por nombre. | Se añade un alcance del seed que lee `VERCEL_ENV` (§ 7). `build.mjs` no cambia: `tests/unit/identity/seed/deploy-hook.test.ts:64` fija el comando literal. |
| Código: pedidos | `enum OrderStatus` (`db/schema.prisma:657`), `ORDER_STATUS_VALUES` (`pedidos/domain/order-classification.ts`). No existe «pedido en curso». | Constante nueva en `pedidos` y un contador (§ 5.2). |
| Código: historial | Ninguna tabla genérica de eventos. Hay historiales propios (`inventory_movements`, `reservation_movements`), atados a su dominio. | Tabla nueva `company_events` (§ 2.3). |
| Permisos | `empresas.consultar` y `empresas.modificar` en `permissions.ts`, solo para el Maestro. | No se toca el catálogo. Se abren rutas en `maestro-rol.test.ts` R17 (§ 8). |

## 1. Resumen técnico

- Una migración: cuatro columnas en `companies` (identificación fiscal y su forma normalizada,
  correo y teléfono de contacto), un índice único parcial de la identificación, dos `CHECK` y la
  tabla `company_events` con RLS forzada.
- Ocho casos de uso en `identity/domain/`, todos con `PlatformActor` y el permiso en la primera
  línea: alta, edición, baja, reactivación, lista, ficha, impacto de la baja e historial.
- Un adaptador driven nuevo, `company-prisma.ts`, dueño de todas las escrituras de empresa con su
  evento en la misma transacción. QC-235 pasa por él para el evento del país.
- Un contador de pedidos en curso en `pedidos`, atado a un puerto de `identity` en la composición
  (mismo patrón que `listActiveCompanyIds` → `pedidos`).
- Siete Server Actions nuevas en `company-actions.ts`.
- El seed lee su alcance de `VERCEL_ENV`: en `production`, solo roles, permisos y Maestro.
- Sin dependencias nuevas.

## 2. Modelo de datos

### 2.1 Prisma (`db/schema.prisma`)

```prisma
model Company {
  ...                                       // lo de hoy, sin cambios
  taxId           String?   @map("tax_id")
  taxIdNormalized String?   @map("tax_id_normalized")
  contactEmail    String?   @map("contact_email")
  contactPhone    String?   @map("contact_phone")

  users      User[]
  workGroups WorkGroup[]
  events     CompanyEvent[]
}

/// Sin `updatedAt` ni `deletedAt`: un evento no se corrige ni se borra. `kind` es texto con forma
/// `<ambito>.<accion>` y no un enum, para admitir tipos nuevos sin migrar.
/// @module identity
model CompanyEvent {
  id         String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  companyId  String   @map("company_id") @db.Uuid
  kind       String
  actorId    String   @map("actor_id") @db.Uuid
  occurredAt DateTime @map("occurred_at") @db.Timestamptz(6)
  details    Json?
  createdAt  DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  company Company @relation(fields: [companyId], references: [id], onDelete: Restrict, onUpdate: Cascade)
  actor   User    @relation(fields: [actorId], references: [id], onDelete: Restrict, onUpdate: Cascade)

  @@index([companyId, occurredAt(sort: Desc), id(sort: Desc)], map: "company_events_company_id_occurred_at_idx")
  @@index([actorId], map: "company_events_actor_id_idx")
  @@map("company_events")
}
```

- `User` gana `companyEvents CompanyEvent[]` (lado inverso). `@relation` vale porque las tres
  tablas son de `identity` (como `User.company`).
- Columnas en inglés (heredado de QC-4). Sin longitud en la base: los topes son de `zod`, como en
  `users` (`user-input.ts:31-34`).
- Los comentarios `///` no citan fichas ni requisitos (`docs/perfil-agentes.md > Comentarios`).

### 2.2 Migración `db/migrations/20261014120000_companies_management/`

`migration.sql` (orden obligatorio: columnas, restricciones, índice, tabla, RLS al final):

```sql
ALTER TABLE "companies"
  ADD COLUMN "tax_id" TEXT,
  ADD COLUMN "tax_id_normalized" TEXT,
  ADD COLUMN "contact_email" TEXT,
  ADD COLUMN "contact_phone" TEXT;

ALTER TABLE "companies" ADD CONSTRAINT "companies_tax_id_pair"
  CHECK (("tax_id" IS NULL) = ("tax_id_normalized" IS NULL));
ALTER TABLE "companies" ADD CONSTRAINT "companies_tax_id_normalized_format"
  CHECK ("tax_id_normalized" IS NULL OR "tax_id_normalized" ~ '^[a-z0-9]+$');

CREATE UNIQUE INDEX "companies_tax_id_unique" ON "companies" ("tax_id_normalized")
  WHERE "deleted_at" IS NULL AND "tax_id_normalized" IS NOT NULL;

CREATE TABLE "company_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "kind" TEXT NOT NULL,
  "actor_id" UUID NOT NULL,
  "occurred_at" TIMESTAMPTZ(6) NOT NULL,
  "details" JSONB,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "company_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "company_events_kind_format" CHECK ("kind" ~ '^[a-z][a-z_]*\.[a-z][a-z_]*$')
);
CREATE INDEX "company_events_company_id_occurred_at_idx"
  ON "company_events" ("company_id", "occurred_at" DESC, "id" DESC);
CREATE INDEX "company_events_actor_id_idx" ON "company_events" ("actor_id");
ALTER TABLE "company_events" ADD CONSTRAINT "company_events_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "company_events" ADD CONSTRAINT "company_events_actor_id_fkey"
  FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "company_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "company_events" FORCE ROW LEVEL SECURITY;
```

`down.sql` (orden inverso, exacto):

```sql
DROP TABLE "company_events";
DROP INDEX "companies_tax_id_unique";
ALTER TABLE "companies" DROP CONSTRAINT "companies_tax_id_normalized_format";
ALTER TABLE "companies" DROP CONSTRAINT "companies_tax_id_pair";
ALTER TABLE "companies"
  DROP COLUMN "contact_phone",
  DROP COLUMN "contact_email",
  DROP COLUMN "tax_id_normalized",
  DROP COLUMN "tax_id";
```

- Sin backfill: las empresas existentes quedan sin identificación ni contacto y sin eventos. El
  historial empieza con esta ficha.
- `companies_tax_id_unique` copia la forma de `companies_name_unique` (parcial sobre vivas, R10,
  R25). Sin `lower(...)`: el `CHECK` de formato ya obliga a minúsculas, porque la forma
  normalizada sale de `normalizeKey`.
- `companies_tax_id_pair` impide una identificación sin su forma normalizada o al revés (R10).
- `company_events_kind_format` vigila la **forma** del tipo y no la lista (R39). La lista cerrada
  la valida el dominio (§ 3.3); QC-277 añade sus tipos ahí sin migrar.
- **RLS:** `company_events` nace con `ENABLE` + `FORCE`, sin policies, al final de la migración
  (R44; guardia `guard-rls-force`). `companies` ya la tiene y no se toca. La autorización vive en
  el caso de uso (`docs/architecture.md > Acceso a datos y autorizacion`).
- **Empresa en el esquema:** `company_events` lleva `company_id`, así que no entra en `EXENTAS` de
  `guard-empresa-en-esquema` ni en el bullet de `docs/architecture.md > Dominio`.
- El generador de Prisma emitirá `DROP CONSTRAINT` de las FK escritas a mano (drift conocido,
  `db/schema.prisma:187-189`); se borran a mano antes de aplicar, como en QC-47.

### 2.3 Por qué `details` en JSON

El evento de edición nombra los campos cambiados (`{ "fields": ["name", "taxId"] }`, R35) y los
de alta, baja y reactivación no llevan detalle (`NULL`). QC-277 podrá guardar
`{ "module": "<clave>" }` sin migrar. Nunca se guardan valores: ni nombre viejo ni identificación
(R35). Quién y cuándo van en columnas propias, porque son lo que el historial promete y lo que se
consulta.

## 3. Dominio (`lib/modules/identity/domain/`)

### 3.1 Entradas — `company-input.ts` (nuevo)

```ts
export const COMPANY_NAME_MAX_LENGTH = 80;             // el de WORK_GROUP_NAME_MAX_LENGTH
export const COMPANY_TAX_ID_MAX_LENGTH = 40;           // USER_DOCUMENT_NUMBER_MAX_LENGTH
export const COMPANY_CONTACT_EMAIL_MAX_LENGTH = 160;   // USER_EMAIL_MAX_LENGTH
export const COMPANY_CONTACT_PHONE_MAX_LENGTH = 40;    // USER_PHONE_MAX_LENGTH

// requerido, recortado, 1..max
const requiredText = (max) => z.string().trim().min(1).max(max);
// presente siempre; '' o solo espacios -> null
const optionalText = (max) => z.string().trim().max(max).transform((v) => (v === '' ? null : v));

export const companyDataSchema = z.strictObject({
  name: requiredText(COMPANY_NAME_MAX_LENGTH),
  taxId: optionalText(COMPANY_TAX_ID_MAX_LENGTH),
  contactEmail: optionalText(COMPANY_CONTACT_EMAIL_MAX_LENGTH),
  contactPhone: optionalText(COMPANY_CONTACT_PHONE_MAX_LENGTH),
});

export const companyAdministratorSchema = createUserSchema.omit({ roleId: true, credential: true });

export const createCompanySchema = z.strictObject({
  company: companyDataSchema,
  administrator: companyAdministratorSchema,
});
export const updateCompanySchema = companyDataSchema.extend({ companyId: z.string().uuid() });
export const deleteCompanySchema = z.strictObject({
  companyId: z.string().uuid(),
  confirmationName: z.string().trim().min(1),
});
export const companyIdSchema = z.strictObject({ companyId: z.string().uuid() });
export const listCompanyEventsSchema = z.strictObject({
  companyId: z.string().uuid(),
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).optional(),
});

export function normalizeTaxId(taxId: string): string;   // = normalizeKey (R7, R9)
```

- Un campo **ausente** no pasa (`z.string()` lo exige); un campo vacío es «sin valor» (R5). Es el
  criterio de QC-235 R7: un formulario que olvida un campo no borra un dato por accidente.
- `strictObject` rechaza `country`, `companyId` dentro de `company`, `deletedAt`, y en el
  Administrador `roleId`, `credential`, `companyId` (R5, R12). `updateCompanySchema` con
  `extend` sigue siendo estricto.
- El correo de contacto copia la regla del correo de usuario: recorte y largo, sin formato ni
  minúsculas (R6, `user-input.ts:24-29`).
- `normalizeTaxId` reutiliza `normalizeKey`, la misma regla que el nombre: «900.123.456-7» y
  «9001234567» chocan. Si queda vacía con un `taxId` no vacío → `ValidationError` (R7). Lo
  comprueba el caso de uso tras el `parse`, porque la forma normalizada no es parte de la entrada.
- `page`/`pageSize` de `listCompanyEventsSchema`: el defecto (10) y el tope (25) los aplica el
  adaptador con `lib/shared/pagination`, como el listado de usuarios.
- El `uuid` se valida igual que en `company-country-input.ts`; el implementer usa el mismo
  validador para los dos.

### 3.2 Lista — `company-queryable.ts` (nuevo)

```ts
export const COMPANY_QUERYABLE: ListQueryable = {
  sortable: ['name', 'createdAt'],
  filterable: { status: 'select' },
  searchable: true,
};
export const COMPANY_STATUSES = ['active', 'deleted'] as const;
```

- `status` es un nombre de filtro y no una columna: `deletedAt` sigue prohibido por
  `NEVER_QUERYABLE`. El adaptador traduce `active` → `deleted_at IS NULL` y `deleted` →
  `deleted_at IS NOT NULL`. Valores desconocidos se ignoran; si no queda ninguno, se aplica el
  defecto, solo vivas (R30, R32).
- `name` ordena por `name_normalized` y desempata por `id` (R32). La búsqueda (R31) es
  `name_normalized LIKE '%' || $q || '%' OR tax_id_normalized LIKE ...`, con `$q =
  normalizeKey(texto)`. Como la forma normalizada solo tiene `[a-z0-9]`, no hay comodines que
  escapar. Si el texto normaliza a vacío, no filtra.

### 3.3 Historial — `company-event.ts` (nuevo)

```ts
export const COMPANY_EVENT_KINDS = [
  'company.created', 'company.updated', 'company.deleted', 'company.reactivated',
] as const;
export type CompanyEventKind = (typeof COMPANY_EVENT_KINDS)[number];
export const EVENT_KIND_FORMAT = /^[a-z][a-z_]*\.[a-z][a-z_]*$/;   // misma regla que el CHECK

export const COMPANY_FIELDS = ['name', 'taxId', 'contactEmail', 'contactPhone', 'country'] as const;
export type CompanyField = (typeof COMPANY_FIELDS)[number];

export function changedCompanyFields(before: CompanyEditable, after: CompanyEditable): CompanyField[];
```

- `changedCompanyFields` compara campo a campo, por valor exacto (con `null`). El orden de salida
  es el de `COMPANY_FIELDS` y no depende de la entrada.
- QC-277 añade sus tipos a una lista suya en su módulo o aquí; la forma ya la admite la base.

### 3.4 Vistas — `company-view.ts` (nuevo)

```ts
export type CompanyStatus = 'active' | 'deleted';
export type CompanyRow = { id; name; taxId: string | null; country: string | null;
  liveUserCount: number; createdAt: Date; status: CompanyStatus };
export type CompanyDetail = { id; name; taxId; contactEmail; contactPhone; country;
  createdAt: Date; status: CompanyStatus; deletedAt: Date | null };
export type CompanyDeletionImpact = { liveUsers: number; openOrders: number };
export type CompanyEventView = { id; kind: string; occurredAt: Date;
  actor: { id: string; firstNames: string; lastNames: string }; fields: readonly CompanyField[] };
```

`kind` en la vista es `string` y no `CompanyEventKind`: el historial de QC-277 traerá tipos que
esta lista no conoce y la lectura no debe fallar por ellos.

### 3.5 Casos de uso

Todos siguen el orden de `set-company-country.ts`: (1) `requirePlatformPermission` con su
permiso, antes de nada (R1, R2); (2) `safeParse` → `ValidationError`; (3) puerto; (4) traducción
del resultado discriminado a error. El instante entra por `now?: () => Date` inyectable (patrón de
`create-user.ts`).

| Archivo | Permiso | Puerto y resultado | Errores |
|---|---|---|---|
| `create-company.ts` | `empresas.modificar` | `companies.createWithAdministrator(...)` → `{ companyId, administratorId }` \| `'duplicate_name'` \| `'duplicate_tax_id'` \| `DuplicateKey` \| `'invalid_document_type'`; después `links.issueForPendingUser` y `mailer` | `company_duplicate_name`, `company_duplicate_tax_id`, `duplicate_username` (y `duplicate_email`/`duplicate_document` por `throwDuplicate`, aunque en una empresa nueva no pueden darse), `invalid_input` |
| `update-company.ts` | `empresas.modificar` | `companies.update(...)` → `'ok'` \| `'unchanged'` \| `'not_found'` \| `'duplicate_name'` \| `'duplicate_tax_id'` | `company_not_found`, los dos duplicados |
| `delete-company.ts` | `empresas.modificar` | `companies.softDelete(...)` → `'ok'` \| `'not_found'` \| `'name_mismatch'` | `company_not_found`, `company_name_mismatch` |
| `reactivate-company.ts` | `empresas.modificar` | `companies.reactivate(...)` → `'ok'` \| `'not_found'` \| `'not_deleted'` \| duplicados | `company_not_found`, `company_not_deleted`, los dos duplicados |
| `list-companies.ts` | `empresas.consultar` | `sanitizeListQuery(…, COMPANY_QUERYABLE)` → `log.ignoredFields('companies', …)` → `companies.list(query)` → `Page<CompanyRow>` | — |
| `get-company.ts` | `empresas.consultar` | `companies.findById(id)` → `CompanyDetail \| null` | `company_not_found` |
| `get-company-deletion-impact.ts` | `empresas.consultar` | `companies.countLiveUsersOfAlive(id)` → `number \| 'not_found'`; después `openOrders.countOpenOrders(id)` | `company_not_found` |
| `list-company-events.ts` | `empresas.consultar` | `companies.listEvents(id, { page, pageSize })` → `Page<CompanyEventView> \| 'not_found'` | `company_not_found` |

Detalle del alta (`create-company.ts`, R11–R15):

1. Permiso, `parse`, `normalizeTaxId` (R7) y `toBirthDate` (la misma de `create-user.ts`).
2. `createWithAdministrator({ company: { name, nameNormalized, taxId, taxIdNormalized,
   contactEmail, contactPhone }, administrator: NewAdministrator, actorId: actor.id, now })`. Una
   transacción: empresa, Administrador y evento `company.created` (R11, R14, R34).
3. `secrets.create()` → `links.issueForPendingUser({ userId: administratorId, companyId,
   digest, expiresAt: credentialSetupLinkExpiresAt(now), now })` → `mailer.sendCredentialSetupLink`.
   Las ramas son las de `create-user.ts:215-230`: objeto → resultado del correo; `'superseded'` →
   `'sent'`; cualquier otra → `'failed'`. El alta **no** falla por el correo (R15).
4. Devuelve `{ companyId, administratorId, mail }`. El secreto no sale del caso de uso.

La ventana entre el `COMMIT` del paso 2 y la emisión del paso 3 es la misma que QC-79 aceptó por
escrito (`specs/QC-79-alta-sin-contrasena-y-enlace/design.md > 10.2`). Su remedio es el reenvío,
que para el Maestro es de QC-165 (riesgo 1).

Baja (`delete-company.ts`, R21–R23): la confirmación se compara en forma normalizada
(`normalizeCompanyName(confirmationName)` contra `name_normalized`), la misma regla que hace
únicos los nombres: si dos nombres no pueden convivir, escribir uno por el otro no es un error de
confirmación. La comparación la hace el adaptador dentro de la transacción, contra la fila
bloqueada, sin carrera con una edición simultánea.

País (`set-company-country.ts`, R36, enmienda a QC-235): el puerto pasa a
`setCountryOfAlive(companyId, country, actorId, now)`. Orden y errores no cambian.

### 3.6 Errores (`errors.ts` y catálogo único)

| Clase | `code` | Texto (`error-catalog.ts`) |
|---|---|---|
| `CompanyDuplicateNameError` | `company_duplicate_name` | «Ya existe una empresa activa con ese nombre.» |
| `CompanyDuplicateTaxIdError` | `company_duplicate_tax_id` | «Ya existe una empresa activa con esa identificación fiscal.» |
| `CompanyNameMismatchError` | `company_name_mismatch` | «El nombre escrito no coincide con el de la empresa.» |
| `CompanyNotDeletedError` | `company_not_deleted` | «La empresa ya está activa.» |

Enmienda al catálogo único (`error-codes.ts` con su línea de enmienda del 2026-10-14 y
`error-catalog.ts`), aprobada con este spec como en QC-235. `company_not_found` se reutiliza:
«no existe» y «de baja» comparten código en baja e impacto (el Maestro ve todas las empresas, no
hay oráculo entre empresas).

## 4. Puertos (`lib/modules/identity/ports/`)

`company-repository.ts` (nuevo):

```ts
export type CompanyWrite = { name; nameNormalized; taxId: string | null;
  taxIdNormalized: string | null; contactEmail: string | null; contactPhone: string | null };
export type NewAdministrator = Omit<NewUser, 'roleId'>;
export type CompanyDuplicate = 'duplicate_name' | 'duplicate_tax_id';

export interface CompanyRepository {
  createWithAdministrator(input: { company: CompanyWrite; administrator: NewAdministrator;
    actorId: string; now: Date }):
    Promise<{ companyId: string; administratorId: string } | CompanyDuplicate | DuplicateKey | 'invalid_document_type'>;
  update(input: { companyId: string; data: CompanyWrite; actorId: string; now: Date }):
    Promise<'ok' | 'unchanged' | 'not_found' | CompanyDuplicate>;
  softDelete(input: { companyId: string; confirmationNormalized: string; actorId: string; now: Date }):
    Promise<'ok' | 'not_found' | 'name_mismatch'>;
  reactivate(input: { companyId: string; actorId: string; now: Date }):
    Promise<'ok' | 'not_found' | 'not_deleted' | CompanyDuplicate>;
  list(query: ListQuery): Promise<Page<CompanyRow>>;
  findById(companyId: string): Promise<CompanyDetail | null>;
  countLiveUsersOfAlive(companyId: string): Promise<number | 'not_found'>;
  listEvents(companyId: string, page: { page?: number; pageSize?: number }):
    Promise<Page<CompanyEventView> | 'not_found'>;
}
```

`company-open-orders-counter.ts` (nuevo):

```ts
export interface CompanyOpenOrdersCounter { countOpenOrders(companyId: string): Promise<number> }
```

`company-country-repository.ts` (enmienda): `setCountryOfAlive(companyId, country, actorId, now)`.

- No hay método para modificar ni borrar un evento (R38): el único escritor del historial es el
  propio adaptador, dentro de cada operación.
- Un solo puerto para empresas, no uno por caso de uso: las cuatro escrituras comparten la
  transacción con el evento y el mapeo de duplicados, y partirlas repetiría ese código.

## 5. Adaptadores driven

### 5.1 `lib/modules/identity/adapters/driven/persistence/company-prisma.ts` (nuevo)

`createCompanyRepository(db: PrismaClient | Prisma.TransactionClient = prisma): CompanyRepository`,
fábrica sobre el cliente, como `company-country-prisma.ts` e `initial-access-repository-prisma.ts`:
el test de integración la construye sobre la transacción del test.

- **Atomicidad.** Las cuatro escrituras corren con `atomically(db, fn)`: si `db` es el cliente,
  `db.$transaction(fn, { maxWait: 10_000, timeout: 30_000 })`; si ya es una transacción, `fn(db)`.
  El `P2002` se traduce **fuera** de la transacción, después del `ROLLBACK`, porque un `INSERT`
  fallido aborta la transacción en Postgres.
- **Duplicados.** `P2002` → por `meta.target`, como `user-admin-prisma.ts:195-203`:
  `tax_id_normalized` → `'duplicate_tax_id'`; `name_normalized` → `'duplicate_name'`; si no, el
  `duplicateKeyOf` de `user-admin-prisma.ts`, que se **exporta** (driven → driven del mismo
  módulo, permitido). Un `target` sin marca se relanza. El implementer mide el `target` real de
  `companies_tax_id_unique` y lo anota en `progress/impl_QC-162-gestion-de-empresas.md`, como
  hizo QC-38 con los de `users`.
- **`createWithAdministrator`.** Dentro de la transacción: id del rol por `ROLE_ADMINISTRADOR`;
  `company.create`; `user.create` con `companyId`, `roleId`, los datos, `passwordHash:
  NO_CREDENTIAL_SENTINEL`, `mustChangeCredential: true`, `accountStatus: 'pending'`,
  `accountStatusChangedAt: now`, `createdAt/updatedAt: now` y sin `accountStatusChangedBy` (los
  mismos invariantes que `user-admin-prisma.ts:301-323`); `companyEvent.create` con
  `company.created`. `P2003` → `'invalid_document_type'` (el rol se resolvió dentro, así que la
  única FK que la entrada puede romper es la del tipo de documento).
- **`update`.** Bloquea la fila (`SELECT ... FOR UPDATE` con `$queryRaw`, sin filtrar por
  `deleted_at`, R17), `null` → `'not_found'`; `changedCompanyFields` del dominio; sin cambios →
  `'unchanged'` sin escribir (R18); si no, `company.update` de los seis campos y evento
  `company.updated` con `details: { fields }`. Sobre una empresa de baja el índice parcial no
  choca, que es R17.
- **`softDelete`.** `UPDATE companies SET deleted_at = $now, updated_at = $now WHERE id = $id AND
  deleted_at IS NULL AND name_normalized = $conf RETURNING id`. Sin fila: se lee si la empresa
  existe viva → `'name_mismatch'`; si no → `'not_found'`. Con fila: evento `company.deleted`.
- **`reactivate`.** Bloquea la fila; `null` → `'not_found'`; viva → `'not_deleted'`;
  `deleted_at = NULL` (el índice parcial dispara el choque de nombre o identificación, R27) y
  evento `company.reactivated`. Ningún `UPDATE` sobre `users` (R26).
- **`list`.** `$queryRaw` con `Prisma.sql` y parámetros: `companies` + subconsulta
  `count(*) FROM users WHERE company_id = c.id AND deleted_at IS NULL`, filtro de estado,
  búsqueda (§ 3.2), orden y `LIMIT/OFFSET` de `toOffsetLimit`, y el total con `buildPage`
  (`lib/shared/pagination`). Reutiliza `list-query-sql.ts` de `identity` si sus ayudas encajan.
- **`findById`, `countLiveUsersOfAlive`, `listEvents`.** Lecturas simples. `listEvents` comprueba
  que la empresa existe (viva o de baja), ordena por `occurred_at DESC, id DESC` y une `users`
  para el nombre del autor. `fields` sale de `details.fields` y, si falta o no es una lista de
  `CompanyField`, es `[]`.

### 5.2 `lib/modules/pedidos/adapters/driven/persistence/order-company-stats-prisma.ts` (nuevo)

```ts
export async function countOpenOrdersInCompany(companyId: string, db = prisma): Promise<number> {
  return db.order.count({
    where: { companyId, deletedAt: null, status: { notIn: [...ORDER_STATUSES_NOT_IN_PROGRESS] } },
  });
}
```

`ORDER_STATUSES_NOT_IN_PROGRESS = ['ENTREGADO', 'CANCELADO']` se declara en
`pedidos/domain/order-classification.ts`, junto a `ORDER_STATUS_VALUES` (P3). Filtra por
`company_id`: cumple la regla de ámbito y `guard-ambito-empresa-pedidos`. `pedidos` es dueño de
`orders`, así que la consulta vive en su módulo (`docs/architecture.md > Migraciones up/down`:
solo el módulo propietario consulta su modelo).

### 5.3 `company-country-prisma.ts` (enmienda, R36)

Pasa a una transacción con `atomically`: bloquea la fila viva; `null` → `'not_found'`; mismo
país → `'ok'` sin escribir; si cambia, `update` de `country` y evento `company.updated` con
`{ fields: ['country'] }`.

## 6. Composición y Server Actions

### 6.1 `lib/composition/index.ts`

```ts
const companyRepository = createCompanyRepository();
const companyOpenOrdersCounter: CompanyOpenOrdersCounter = { countOpenOrders: countOpenOrdersInCompany };
// en `identity`, claves nuevas al final:
createCompany: createCreateCompany({ companies: companyRepository, secrets: credentialSetupSecrets,
  links: credentialSetupLinkRepository, mailer: credentialSetupMailer }),
updateCompany, deleteCompany, reactivateCompany,           // { companies: companyRepository }
listCompanies: createListCompanies({ companies: companyRepository, log: identityListQueryLog }),
getCompany, listCompanyEvents,                             // { companies: companyRepository }
getCompanyDeletionImpact: createGetCompanyDeletionImpact({ companies: companyRepository,
  openOrders: companyOpenOrdersCounter }),
```

`setCompanyCountry` no cambia de clave. El barrel `identity/index.ts` reexporta las ocho
fábricas, sus `Deps`, los tipos de § 3.4, `COMPANY_EVENT_KINDS`, `CompanyEventKind`,
`CompanyField` y los cuatro errores nuevos.

### 6.2 `lib/modules/identity/adapters/driving/company-actions.ts` (amplía el de QC-235)

Mismo `currentPlatformActor()` (solo `getSessionUser()`), mismo `toErrorState`, sin
`revalidatePath` y sin reexportar desde `index.ts` (R3). Campos crudos de `FormData`: un campo
ausente llega como `null` y lo rechaza el esquema.

| Acción | Entrada | Éxito |
|---|---|---|
| `createCompanyAction(prev, formData)` | `name`, `taxId`, `contactEmail`, `contactPhone`, `adminFirstNames`, `adminLastNames`, `adminBirthDate`, `adminEmail`, `adminPhone`, `adminDocumentTypeCode`, `adminDocumentNumber`, `adminUsername` → `{ company: {...}, administrator: {...} }` | `{ status: 'success', companyId, administratorId, mail }` |
| `updateCompanyAction(prev, formData)` | `companyId`, `name`, `taxId`, `contactEmail`, `contactPhone` | `{ status: 'success' }` |
| `deleteCompanyAction(prev, formData)` | `companyId`, `confirmationName` | `{ status: 'success' }` |
| `reactivateCompanyAction(prev, formData)` | `companyId` | `{ status: 'success' }` |
| `listCompaniesAction(query: unknown)` | `ListQuery` de QC-57 | `{ status: 'success', data: Page<CompanyRow> }` |
| `getCompanyAction(companyId: string)` | — | `{ status: 'success', data: CompanyDetail }` |
| `getCompanyDeletionImpactAction(companyId: string)` | — | `{ status: 'success', data: CompanyDeletionImpact }` |
| `listCompanyEventsAction(input: unknown)` | `{ companyId, page?, pageSize? }` | `{ status: 'success', data: Page<CompanyEventView> }` |

Error: `ErrorState` con su `code` en todas. Los tipos de estado se exportan como tipos; no hay
constantes exportadas (un archivo `'use server'` solo exporta funciones async).

## 7. Seed (R40–R42)

- **Dominio** (`seed-initial-access.ts`): `SeedInitialAccessDeps` gana `scope: SeedScope`
  (`'full' | 'platform-only'`, en `domain/seed-scope.ts`). Con `'platform-only'`, `needsAdmin` es
  `false` sin consultar: no se llama a `credentials()`, no se lee ni se crea la empresa inicial y
  no se crea el Administrador inicial. Roles, permisos y Maestro siguen igual. `SeedOutcome` no
  cambia de forma (`createdAdmin: false`, `createdCompany: null`).
- **Cómo se sabe que es producción**: `adapters/driven/config/seed-scope-env.ts` (nuevo),
  `readSeedScopeFromEnv(env = process.env)`: `(env.VERCEL_ENV ?? '').trim() === 'production'` →
  `'platform-only'`; cualquier otro caso → `'full'`. Es la misma variable y el mismo recorte que
  ya usan `scripts/build.mjs` y `scripts/seed-demo/guard.ts`.
  - **Preview** (`VERCEL_ENV=preview`): `'full'`. El seed de demostración sigue encontrando
    QuimiCloud (`scripts/seed-demo/gateway.ts:106`).
  - **Local, CI y E2E** (`VERCEL_ENV` ausente): `'full'`. Nada cambia en `playwright.config.ts` ni
    en los helpers de test.
  - No depende de `VERCEL`: un `VERCEL_ENV=production` puesto a mano contra la base de producción
    también siembra solo el Maestro, que es el lado seguro.
- **Composición**: `scope: readSeedScopeFromEnv()` dentro de la flecha de `seedInitialAccess`, en
  la invocación y no al importar (mismo criterio que el correo, `lib/composition/index.ts:714-724`).
- **`scripts/seed.ts`**: la línea de resumen dice `empresa inicial: no se siembra en produccion`
  cuando el alcance es `'platform-only'`. Para eso `SeedOutcome` gana `scope` (solo lo lee el
  script).
- **R42**: el seed nunca borra ni modifica; con `'platform-only'` ni siquiera lee `companies`. La
  QuimiCloud ya creada en producción se queda (P5).
- **Docs**: `docs/architecture.md > Variables por entorno`, fila `SEED_ADMIN_*`: en Production
  pasa a «no se leen: en producción el seed solo crea al Maestro». Y una nota en `## Despliegue a
  produccion`.

## 8. Enmiendas a tests y archivos de otras fichas

Todas explícitas y aprobadas con este spec:

1. **`tests/unit/identity/roles/maestro-rol.test.ts` R17.** `RUTAS_ABIERTAS_EMPRESAS` gana las
   ocho rutas exactas de `domain/` que exigen `empresas.*` (`create-company.ts`,
   `update-company.ts`, `delete-company.ts`, `reactivate-company.ts`, `list-companies.ts`,
   `get-company.ts`, `get-company-deletion-impact.ts`, `list-company-events.ts`), con el
   anti-cegado intacto. Es lo que pide el propio test a «QC-162».
2. **QC-235**: `set-company-country.ts`, `ports/company-country-repository.ts`,
   `company-country-prisma.ts`, `tests/unit/identity/set-company-country.test.ts` y
   `tests/integration/identity/company-country.int.test.ts` cambian por R36 (P4). Si el humano
   responde «no» a P4, esta enmienda y T9 se caen.
3. **`user-admin-prisma.ts`**: se exporta `duplicateKeyOf`, sin cambiar su cuerpo.
4. **Catálogo de errores**: cuatro códigos (§ 3.6).

## 9. Pruebas y trazabilidad

No hay E2E (decisión cerrada, va en QC-166). Los nombres de los casos llevan `R<n>`.
`tests/integration/identity/company.int.test.ts` y
`tests/integration/pedidos/order-company-stats.int.test.ts` se declaran en
`tests/integration/aislamiento.json > transaccion`.

| R | Test |
|---|---|
| R1, R2 | Un archivo unitario por caso de uso (`tests/unit/identity/companies/*.test.ts`): actor `null`, sin permisos, con el permiso equivocado (`consultar` en escrituras, `modificar` en lecturas) → `unauthorized` con dobles que fallan si los llaman; actor sin empresa con el permiso → pasa |
| R3 | `tests/unit/identity/company-actions.test.ts` (ampliado): actor solo de `getSessionUser`, `getSessionContext` no se llama, `revalidatePath` no se llama, éxito con datos y error con `code`, para las ocho acciones |
| R4–R7 | `tests/unit/identity/companies/company-input.test.ts`: topes, recorte, `''` → `null`, campo ausente, claves extra (`country`, `deletedAt`), correo sin formato aceptado, `---` como identificación → `invalid_input` en `create-company.test.ts` |
| R8, R9 | `create-company.test.ts`, `update-company.test.ts`, `reactivate-company.test.ts` (puerto devuelve el duplicado → código) + `company.int.test.ts` (nombre «QUIMI-cloud» frente a «QuimiCloud», «900.123.456-7» frente a «9001234567», dos sin identificación conviven) |
| R10, R39 | `company.int.test.ts`: por SQL crudo bajo `SAVEPOINT`: segunda viva con la misma normalizada → `23505`; `tax_id` sin normalizada → `23514`; misma en viva y de baja → pasa; `kind` `'module.enabled'` pasa, `'Bad Kind'` → `23514` |
| R11, R12 | `create-company.test.ts` (dobles: entrada al puerto, `roleId`/`credential`/`companyId` → `invalid_input`) + `company.int.test.ts` (fila del Administrador: rol, empresa, `pending`, centinela, `must_change_credential`, `account_status_changed_by` nulo; empresa sin país) |
| R13 | `create-company.test.ts` (`'username'` → `duplicate_username`; tipo de documento inexistente → `invalid_input`) + `company.int.test.ts` (usuario del Maestro → `'username'`) |
| R14 | `company.int.test.ts`: tras cada choque no hay empresa, usuario ni evento nuevos |
| R15 | `create-company.test.ts`: `issueForPendingUser` con el `administratorId`, plazo de 7 días desde `now`, correo `sent`/`failed`, `'superseded'` → `sent`, el alta no lanza si el correo falla |
| R16–R19 | `update-company.test.ts` + `company.int.test.ts` (país, `created_at`, `deleted_at` y usuarios intactos; empresa de baja editable sin choque; sin cambios → ni `updated_at` ni evento; inexistente → `not_found`) |
| R20 | `get-company-deletion-impact.test.ts` + `company.int.test.ts` (usuarios vivos, sin los de baja ni los de otra empresa) + `order-company-stats.int.test.ts` (cuenta `PENDIENTE`, `TERMINADO`, `BLOQUEADO`; no `ENTREGADO`, `CANCELADO`, borrados ni de otra empresa) |
| R21–R23 | `delete-company.test.ts` + `company.int.test.ts` (confirmación «quimi cloud» vale; «otra» → `name_mismatch` sin escribir; ya de baja → `not_found`; usuarios y pedidos intactos) |
| R24 | `company.int.test.ts` (tras la baja, un usuario de esa empresa leído con la misma selección que `session-user-prisma.ts:78-90`, `company: { select: { deletedAt: true } }`, trae la marca no nula; `session-user-prisma` usa el cliente compartido y no ve la transacción del test, por eso se repite la selección) + los existentes `tests/unit/identity/resolve-session.test.ts` (QC-48 R15) y `tests/unit/identity/verify-credentials.test.ts` (QC-48 R3), sin cambios |
| R25 | `company.int.test.ts`: con una empresa de baja, otra viva toma su nombre e identificación |
| R26–R28 | `reactivate-company.test.ts` + `company.int.test.ts` (usuarios con su estado de cuenta intacto; nombre tomado → `duplicate_name`; viva → `not_deleted`) |
| R29–R32 | `list-companies.test.ts` (permiso, saneado, log) + `company.int.test.ts` (columnas, conteo de usuarios vivos, filtro por defecto y con `deleted`, búsqueda por nombre e identificación sin acentos, orden y desempate, tope 25) |
| R33 | `get-company.test.ts` + `company.int.test.ts` (viva y de baja) |
| R34, R35 | los cuatro unitarios de escritura no ven el evento (es del adaptador); `company.int.test.ts`: un evento por operación con tipo, `actor_id` y `occurred_at = now`; edición con `{ fields }` sin valores; un fallo del evento (FK de actor inexistente) deshace el cambio |
| R36 | `set-company-country.test.ts` (el puerto recibe `actorId` y `now`) + `company-country.int.test.ts` (evento con `country`; mismo país → sin evento) |
| R37 | `list-company-events.test.ts` + `company.int.test.ts` (orden, autor, paginación, tipo desconocido escrito por SQL se devuelve tal cual) |
| R38 | `tests/unit/identity/companies/company-events-append-only.test.ts`: lee los fuentes de `lib/` y falla si alguno llama a `companyEvent.update*`, `companyEvent.delete*` o un `UPDATE`/`DELETE` crudo sobre `company_events`; se autocomprueba con un fuente sintético |
| R40–R42 | `tests/unit/identity/seed/seed-initial-access.test.ts` (alcance `platform-only`: `credentials` no se llama, ni empresa ni Administrador; `full` igual que hoy) + `tests/unit/identity/seed/seed-scope-env.test.ts` (`production`, ` production `, `preview`, vacío, ausente) + `tests/integration/identity/identity-seed.int.test.ts` (dos corridas `platform-only` sobre una base con QuimiCloud: nada borrado ni cambiado) |
| R43 | `tests/unit/identity/schema/companies-management-migration.test.ts`: `down.sql` deshace exactamente lo de `migration.sql`; el `CHECK` del tipo coincide con `EVENT_KIND_FORMAT` |
| R44 | `companies-management-migration.test.ts` + `guard-rls-force` (existente) |

## 10. Alternativas descartadas

1. **Crear el Administrador con el `create` de `UserAdminRepository`.** Rechaza el rol
   Administrador (`'action_not_allowed'`, fix del 2026-09-22) y abre su propia escritura fuera de
   cualquier transacción: la empresa podría quedar sin Administrador si el segundo paso falla, en
   contra de la decisión «una empresa nunca nace sin Administrador». Ablandar esa regla en el
   puerto compartido abriría a cualquier Administrador la vía de crear otros. Se reutilizan el
   esquema, el centinela y los invariantes; el `INSERT` va en la transacción del alta.
2. **Emitir el enlace dentro de la misma transacción del alta.** `issueForPendingUser` abre su
   propia transacción sobre el cliente compartido; meterlo dentro obligaría a duplicarlo. QC-79 ya
   aceptó la ventana con el mismo remedio (el reenvío).
3. **El tipo del evento como `enum` de Postgres o `CHECK ... IN (...)`.** Cada tipo nuevo de
   QC-277 sería una migración, y la decisión pide reutilizar el historial sin migrar. Se queda el
   `CHECK` de forma y la lista en el dominio, el mismo reparto que el país en QC-235.
4. **Un historial genérico en `lib/shared` o en un módulo nuevo `auditoria`.** El evento tiene que
   escribirse en la misma transacción que el cambio de `companies`, y solo `identity` puede tocar
   `companies`. Un módulo aparte obligaría a una transacción entre módulos que la arquitectura no
   tiene.
5. **Que la baja pida el nombre exacto (sin normalizar).** Dos nombres que solo difieren en
   mayúsculas o acentos no pueden convivir, así que distinguirlos al confirmar no protege de
   nada y solo hace fallar al Maestro.
6. **Decidir producción con un argumento `--solo-maestro` en `build.mjs`.** El test de despliegue
   fija el comando literal del seed, y un `pnpm db:seed` lanzado a mano contra producción no lo
   llevaría. Leer `VERCEL_ENV` en el seed cubre las dos vías.
7. **Contar los pedidos desde `identity` con SQL crudo sobre `orders`.** `orders` es de `pedidos`
   y la guardia de arquitectura lo prohíbe; se usa el patrón ya existente de un puerto atado en la
   composición.
8. **`actor_id` anulable con `NULL` = «el sistema».** Todos los eventos de esta ficha y de QC-277
   tienen autor (el Maestro). Un autor anulable dejaría un hueco que nadie usa y que los tests no
   podrían cubrir.

## 11. Riesgos y desconocidos

1. **Reenvío del enlace al primer Administrador.** Si el correo del alta falla, el reenvío que
   existe (`issueCredentialSetupLink`) exige un actor con empresa y `usuarios.modificar`; el
   Maestro no lo tiene. Hasta QC-165, el Administrador de una empresa nueva cuyo correo falló no
   tiene cómo entrar. Hay que decírselo a QC-165 al acotarla. En preview el correo está
   `desactivado` y siempre devuelve `failed`.
2. **`meta.target` de `companies_tax_id_unique`** no está medido; si Prisma no lo anuncia, el
   duplicado se relanzaría como error inesperado. Se mide en T7 (§ 5.1).
3. **P2 a P5 abiertas** con su defecto. P4 toca código cerrado de QC-235.
4. **Permisos de la sesión envejecen** (hasta 8 h, `docs/architecture.md > Permisos y
   autenticacion`): no afecta, porque el Maestro no pierde permisos con estas operaciones.
5. **El historial no tiene eventos previos**: las empresas existentes empiezan sin rastro de su
   alta.
6. **QC-277 en otro módulo.** Si QC-277 vive fuera de `identity`, no podrá escribir en
   `company_events` directamente (solo `identity` toca su modelo). Tendrá que pedirlo por el
   contrato de `identity`; se dice en su acotado.
