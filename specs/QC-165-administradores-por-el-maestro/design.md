# QC-165 — administradores-por-el-maestro · design.md

> Backend puro: ni pantalla, ni componentes, ni pase `/design` (las pantallas son de QC-166). Sin
> migración, sin tabla nueva y sin dependencia nueva.

## Lo que ya existe

Buscado: `administrador`, `Maestro`, `createWithAdministrator`, `PlatformActor`,
`last_administrator`, `listAliveInCompany`, `alta de usuario` en el board (`feature_list.json`), en
`specs/` y en el código. El grafo de `codebase-memory-mcp` **no tiene indexado este worktree**
(`list_projects` no lo lista), así que el código se buscó con Grep/Read sobre el worktree.

| Dónde | Qué apareció | Qué se hace con ello |
|---|---|---|
| Board | QC-162 (gestión de empresas, crea el primer Administrador), QC-166 (pantallas, depende de esta), QC-161 (rol Maestro, `done`), QC-54 (constante del rol). Ninguna otra ficha gestiona Administradores desde la plataforma. | Nada se duplica. QC-162 dejó aquí «más Administradores, reenvío, último Administrador» (alcance sembrado). El reenvío no está en el alcance de esta ficha: `requirements.md > P1`. |
| `specs/QC-162-gestion-de-empresas/` | Alta de empresa con primer Administrador, `PlatformActor`, `company_not_found`, eventos. | Se reutiliza el patrón entero: actor de plataforma, acciones sin `revalidatePath`, emisión del enlace tras el alta. |
| `specs/QC-66-crud-de-usuarios/` | CRUD de usuarios de **una** empresa, guarda del «último administrador en `active`», unicidad por índices, baja lógica. | Se reutilizan los esquemas, la traducción de duplicados y el sello de sesiones. La guarda del último **no** se reutiliza (ver § 9.2). |
| `lib/modules/identity/domain/platform-actor.ts` | `PlatformActor`, `requirePlatformPermission`. | Primera línea de los cinco casos de uso nuevos (R1, R2). |
| `lib/modules/identity/domain/company-input.ts` | `companyAdministratorSchema` = `createUserSchema` sin `roleId` ni `credential`, `strictObject`. | Base de los esquemas de alta y edición (R12, R13, R19). No se escribe ninguna validación nueva de los ocho datos. |
| `lib/modules/identity/domain/create-company.ts` | `sendCredentialSetupLink` privado: emite el enlace con empresa y manda el correo, `sent \| failed`. | Se **extrae** a un archivo propio sin cambiar su comportamiento y lo usan los dos altas (R17). |
| `lib/modules/identity/domain/list-query.ts` | `createListQuerySchema`, `sanitizeListQuery`, `ListQueryable`. | Contrato de la lista (R4, R8). |
| `lib/modules/identity/domain/session-revocation.ts` | `changeRevokesSessions`, `floorToSecond`. | La baja sube el sello «sesiones válidas desde» en el mismo `UPDATE` (R22). |
| `lib/modules/identity/domain/errors.ts` | `UnauthorizedError`, `ValidationError`, `UserNotFoundError`, `CompanyNotFoundError`, los tres duplicados, `throwDuplicate` (en `create-user.ts`). | Se reutilizan todos. Solo nace `CompanyLastAdministratorError` (R23). |
| `adapters/driven/persistence/user-admin-prisma.ts` | `duplicateKeyOf` (por columna), `listAliveInCompany`, bloqueo `FOR UPDATE` del conjunto de administradores. | `duplicateKeyOf` se importa (driven del mismo módulo, ya lo hace `company-prisma.ts`). El patrón del bloqueo se copia **sobre otro conjunto** (§ 9.2). |
| `adapters/driven/persistence/list-query-sql.ts` | `insensitiveContainsCondition`, `selectCondition`. | Búsqueda y filtro de la lista (R6, R7). |
| `adapters/driven/persistence/company-prisma.ts` | `atomically(db, fn)`, repositorio con `db` inyectable (tests en transacción). | El repositorio nuevo sigue la misma forma. |
| `adapters/driving/company-actions.ts` | `currentPlatformActor()` privado, `toErrorState`, estados `{ status }`. | `currentPlatformActor` se extrae a un helper de `driving/` y lo usan los dos archivos de acciones (R3). |
| `lib/modules/errores/domain/error-codes.ts` | `last_administrator` («La empresa quedaría sin ningún administrador activo.»). | No sirve: dice «activo» y la regla de aquí cuenta vivos. Nace `company_last_administrator` (R23, decisión «error propio»). |

No hay UI: no se consultó `components/shared/CATALOGO.md` y no se propone ningún componente.

## 1. Resumen

Cinco operaciones de plataforma en el módulo `identity`, todas con `PlatformActor`:

| Operación | Permiso | Caso de uso | Acción de servidor |
|---|---|---|---|
| Lista | `empresas.consultar` | `list-administrators.ts` | `listAdministratorsAction(query)` |
| Ficha | `empresas.consultar` | `get-administrator.ts` | `getAdministratorAction(id)` |
| Alta | `empresas.modificar` | `create-administrator.ts` | `createAdministratorAction(prev, formData)` |
| Edición | `empresas.modificar` | `update-administrator.ts` | `updateAdministratorAction(prev, formData)` |
| Baja | `empresas.modificar` | `delete-administrator.ts` | `deleteAdministratorAction(prev, formData)` |

Un puerto nuevo, `AdministratorRepository`, con su adaptador Prisma. Ningún cambio de esquema.

## 2. Modelo de datos

**Sin cambios.** Todo cabe en `users`, `roles` y `companies` tal como están:

- El rol es `roles.name = ROLE_ADMINISTRADOR` (constante de `domain/roles.ts`, QC-54); nunca un literal.
- La unicidad la dan los índices parciales de QC-47/QC-161 sobre filas vivas: correo y documento por
  empresa, nombre de usuario en todo el sistema. Sin `SELECT` previo (sería una carrera).
- La baja es `deleted_at` + `updated_at` + `sessions_valid_from`, en un solo `UPDATE`.
- **RLS:** ninguna tabla nueva, así que ninguna policy nueva. La frontera es el caso de uso
  (`requirePlatformPermission`), como en QC-162.
- **Migraciones:** ninguna, así que ningún `down.sql`.

**Ámbito de empresa.** Estas lecturas cruzan empresas a propósito: el actor es la plataforma, no
una empresa, y `users` es identidad, no dato de operación (`docs/architecture.md > Dominio`, n.º 1).
Es el mismo caso que la lista de empresas de QC-162. Lo que sí se mantiene es que **ningún
Administrador de empresa** puede llegar aquí: le falta `empresas.*` (`ADMIN_EXCLUDED_PERMISSIONS`).

## 3. Dominio (`lib/modules/identity/domain/`)

### 3.1 Entrada — `administrator-input.ts` (nuevo)

```ts
export const createAdministratorSchema = companyAdministratorSchema.extend({
  companyId: z.string().uuid(),
});
export const updateAdministratorSchema = companyAdministratorSchema.extend({
  id: z.string().uuid(),
});
export const administratorIdSchema = z.strictObject({ id: z.string().uuid() });
```

`companyAdministratorSchema` es `strictObject`, y `extend` lo conserva: `roleId`, `credential`,
`accountStatus` o cualquier otra clave fallan con `invalid_input` (R13, R19). En la edición,
`companyId` **es** una clave no prevista: así se cumple que la empresa no se cambia (R19), sin una
regla aparte. Las validaciones de los ocho datos son las de `createUserSchema` sin una línea nueva
(R12, R18).

### 3.2 Salida — `administrator-view.ts` (nuevo)

```ts
export type AdministratorCompany = { readonly id: string; readonly name: string };

export type AdministratorRow = {
  readonly id: string;
  readonly firstNames: string;
  readonly lastNames: string;
  readonly username: string;
  readonly email: string;
  readonly company: AdministratorCompany;
  readonly accountStatus: UserAccountStatus;
  readonly createdAt: Date;
  readonly isLastAdministrator: boolean;
};

export type AdministratorDetail = {
  readonly id: string;
  readonly firstNames: string;
  readonly lastNames: string;
  readonly birthDate: Date;
  readonly email: string;
  readonly phone: string;
  readonly documentTypeCode: string;
  readonly documentNumber: string;
  readonly username: string;
  readonly company: AdministratorCompany;
  readonly accountStatus: UserAccountStatus;
  readonly accountStatusChangedAt: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly isLastAdministrator: boolean;
};
```

Ningún tipo tiene hueco para credencial, contadores o `deletedAt` (R5, R10). `accountStatus` es el
almacenado, como en `UserRow`: QC-166 pinta `pending` como «Pendiente sin contraseña» y `active`
como «Activo».

### 3.3 Lista blanca — `administrator-queryable.ts` (nuevo)

```ts
export const ADMINISTRATOR_QUERYABLE: ListQueryable = {
  sortable: ['lastNames', 'firstNames', 'username', 'email', 'accountStatus', 'createdAt', 'companyName'],
  filterable: { companyId: 'select' },
  searchable: true,
};
```

### 3.4 Error — `errors.ts`

```ts
export class CompanyLastAdministratorError extends IdentityError {
  readonly code = 'company_last_administrator';
}
```

Y en `lib/modules/errores/domain/`: `company_last_administrator` en `ERROR_CODES` (con su línea
«Distinto de `last_administrator`: …») y en `error-catalog.ts` la clave y el texto
**«Es el único Administrador de la empresa: crea otro antes de darlo de baja.»**

### 3.5 Envío del enlace — `credential-setup-mail.ts` (nuevo, extraído)

`sendCredentialSetupLink(deps, companyId, userId, now): Promise<'sent' | 'failed'>` sale tal cual de
`create-company.ts` (`secrets.create()` → `links.issueForPendingUser({ userId, companyId, … })` →
`mailer.sendCredentialSetupLink`; `'superseded'` → `'sent'`; cualquier otra → `'failed'`).
`create-company.ts` pasa a importarla; sus tests no cambian.

### 3.6 Casos de uso

Todos empiezan por `requirePlatformPermission(actor, <permiso>)`, **antes** del `parse` y de tocar
cualquier puerto (R1). El reloj es `deps.now ?? (() => new Date())`.

| Caso de uso | Pasos | Errores |
|---|---|---|
| `list-administrators.ts` | `empresas.consultar` → `createListQuerySchema().safeParse` → `sanitizeListQuery(…, ADMINISTRATOR_QUERYABLE)` → `log.ignoredFields('administrators', ignored)` → `administrators.list(query)` | `invalid_input` |
| `get-administrator.ts` | `empresas.consultar` → `administratorIdSchema` (id no uuid → `user_not_found`, no `invalid_input`: R11 pide la misma respuesta) → `administrators.findManageable(id)`; `null` → error | `user_not_found` |
| `create-administrator.ts` | `empresas.modificar` → `createAdministratorSchema` → `toBirthDate` → `administrators.create({ companyId, administrator, now })` → traduce → `sendCredentialSetupLink(deps, companyId, id, now)` → `{ administratorId, mail }` | `invalid_input`, `company_not_found`, duplicados |
| `update-administrator.ts` | `empresas.modificar` → `updateAdministratorSchema` → `toBirthDate` → `administrators.update({ id, data, now })` → traduce | `invalid_input`, `user_not_found`, duplicados |
| `delete-administrator.ts` | `empresas.modificar` → `administratorIdSchema` (no uuid → `user_not_found`) → `administrators.softDelete({ id, now })` → traduce | `user_not_found`, `company_last_administrator` |

Traducción de resultados del puerto: `'company_not_found'` → `CompanyNotFoundError`;
`'not_found'` → `UserNotFoundError`; `'last_administrator'` → `CompanyLastAdministratorError`;
`'invalid_document_type'` → `ValidationError`; `DuplicateKey` → `throwDuplicate` (el de
`create-user.ts`).

El resultado del alta es `{ administratorId: string; mail: 'sent' | 'failed' }`: sin campo de texto
libre, el secreto no tiene por dónde salir (R17).

## 4. Puerto — `ports/administrator-repository.ts` (nuevo)

```ts
export type AdministratorWrite = Omit<NewUser, 'roleId'>; // = NewAdministrator de company-repository

export interface AdministratorRepository {
  list(query: ListQuery): Promise<Page<AdministratorRow>>;

  /** Administrador vivo de empresa viva; cualquier otro caso es `null`. */
  findManageable(id: string): Promise<AdministratorDetail | null>;

  create(input: {
    readonly companyId: string;
    readonly administrator: AdministratorWrite;
    readonly now: Date;
  }): Promise<{ readonly administratorId: string } | 'company_not_found' | DuplicateKey | 'invalid_document_type'>;

  update(input: {
    readonly id: string;
    readonly data: AdministratorWrite;
    readonly now: Date;
  }): Promise<'ok' | 'not_found' | DuplicateKey | 'invalid_document_type'>;

  softDelete(input: {
    readonly id: string;
    readonly now: Date;
  }): Promise<'ok' | 'not_found' | 'last_administrator'>;
}
```

Ningún método recibe un rol: el rol Administrador lo resuelve el adaptador por nombre, y por eso no
existe forma de crear ni de editar a otro rol desde aquí (R13, R14, R19).

## 5. Adaptador — `adapters/driven/persistence/administrator-prisma.ts` (nuevo)

`createAdministratorRepository(db: PrismaLike = prisma): AdministratorRepository`, misma forma que
`createCompanyRepository` (el `db` inyectable deja correr los tests de integración dentro de una
transacción revertida). Toca `prisma.user`, `prisma.role` y `prisma.company`, los tres
`/// @module identity`.

**Condición de «gestionable»**, la misma en las cinco operaciones (un solo `where` con nombre):
`deletedAt: null`, `role: { name: ROLE_ADMINISTRADOR }`, `company: { deletedAt: null }`. El Maestro
queda fuera por rol y por no tener empresa (R9, R11).

### 5.1 `list`

- `findMany` + `count` con el **mismo** `where`: condición de gestionable + filtro `companyId`
  (`select`, valores acotados a los que son uuid, si no queda ninguno se omite, R6) + búsqueda
  `insensitiveContainsCondition` en `OR` sobre `firstNames`, `lastNames`, `email`, `username` (R7).
- `select` enumerado: `id, firstNames, lastNames, username, email, accountStatus, createdAt,
  company: { select: { id, name } }`. Ningún `findMany` sin `select` (R5).
- Orden: las seis columnas de `USER_QUERYABLE` + `companyName` → `{ company: { name: dir } }`; por
  defecto `createdAt desc`; siempre `id asc` al final (R8). `toOffsetLimit`/`buildPage` de
  `lib/shared/pagination` (defecto 10, tope 25, R4).
- `isLastAdministrator`: un `groupBy({ by: ['companyId'], where: gestionable ∧ companyId ∈ empresas
  de la página, _count })` después de la página; la marca es `count === 1`. Una consulta más por
  página, no una por fila.

### 5.2 `findManageable`

`findFirst({ where: { id, ...gestionable }, select: … })` + el mismo `count` de Administradores vivos
de su empresa para `isLastAdministrator` (R10). Antes, si `id` no es uuid, el caso de uso ya
respondió `user_not_found`: Prisma lanzaría con un uuid mal formado.

### 5.3 `create`

En `atomically(db, tx => …)`:

1. `SELECT id FROM companies WHERE id = $1 AND deleted_at IS NULL FOR SHARE`. Sin fila →
   `'company_not_found'` (R15). El `FOR SHARE` hace esperar a una baja de empresa simultánea
   (`softDelete` de QC-162 es un `UPDATE` de esa fila): no se crea un Administrador en una empresa
   que se está dando de baja.
2. Rol por nombre (`ROLE_ADMINISTRADOR`); si no existe, se lanza (es un error del seed, no de negocio,
   igual que `createWithAdministrator`).
3. `tx.user.create` con los ocho datos, `passwordHash: NO_CREDENTIAL_SENTINEL`,
   `mustChangeCredential: true`, `accountStatus: 'pending'`, `accountStatusChangedAt: now`,
   `createdAt`/`updatedAt: now`, sin `accountStatusChangedBy` (R14).

`P2002` → `duplicateKeyOf` (R16); `P2003` → `'invalid_document_type'`; lo demás se relanza.

### 5.4 `update`

En `atomically`: localiza al objetivo con la condición de gestionable (sin fila → `'not_found'`,
R20), y `updateMany({ where: { id, companyId: <la suya>, deletedAt: null }, data: { ocho datos,
updatedAt: now } })`. `data` no tiene `companyId`, `roleId`, `accountStatus`, `passwordHash`,
`mustChangeCredential` ni contadores (R18). Sin sello de sesiones: el rol no cambia
(`changeRevokesSessions` solo corta por rol, estado o baja). Duplicados como en § 5.3 (R21).

### 5.5 `softDelete` — la guarda del último

En `atomically`:

1. `SELECT company_id FROM users WHERE id = $1 AND <gestionable>`. Sin fila → `'not_found'` (R25).
2. `SELECT id FROM users WHERE company_id = $c AND role_id = (admin) AND deleted_at IS NULL FOR
   UPDATE`: el conjunto de **Administradores vivos** de la empresa, bloqueado.
3. Si el objetivo ya no está en el conjunto (otra transacción lo dio de baja mientras se esperaba el
   bloqueo) → `'not_found'`. Si el conjunto tiene un solo elemento → `'last_administrator'`, sin
   escribir (R23).
4. `updateMany({ where: { id, companyId, deletedAt: null }, data: { deletedAt: now, updatedAt: now,
   ...sello } })` con el sello de `changeRevokesSessions({ kind: 'delete' })` + `floorToSecond(now)`
   (R22). Los índices parciales liberan correo, usuario y documento.

**Por qué `FOR UPDATE` sobre el conjunto** (R24): con dos Administradores {A, B} y las dos bajas a la
vez, T1 bloquea {A, B}; T2 espera; T1 confirma la baja de A; T2 relee el conjunto, ve {B}, y como
el objetivo es B y es el único, responde `'last_administrator'`. Es el mismo razonamiento que QC-66
§ 9.2, sobre otro conjunto. Un `INSERT` concurrente solo añade Administradores y no puede romper la
regla.

**Convivencia con la guarda de QC-66.** QC-66 bloquea el subconjunto de Administradores **en
`active`**; aquí se bloquea el de **vivos**, que lo contiene. Las dos operaciones sobre la misma
empresa comparten filas bloqueadas y se serializan. La consecuencia, aceptada por la decisión del
2026-10-16: con A en `active` y B en `pending`, el Maestro **puede** dar de baja a A, y la empresa se
queda sin Administrador activo hasta que B fije su contraseña. La guarda de QC-66 sigue intacta para
lo que hace el Administrador de la empresa.

## 6. Acciones de servidor — `adapters/driving/administrator-actions.ts` (nuevo)

`'use server'`. No se reexportan por el barrel. Sin `revalidatePath` (R3). El actor sale de
`currentPlatformActor()`, extraído de `company-actions.ts` a `adapters/driving/platform-session.ts`
(sin `'use server'`: exporta una función normal, no una acción) y usado por los dos archivos. Una
sola lectura de sesión por invocación (`runInRequestScope`, QC-104).

```ts
export type AdministratorListResult = { status: 'success'; data: Page<AdministratorRow> } | ErrorState;
export type AdministratorDetailResult = { status: 'success'; data: AdministratorDetail } | ErrorState;
export type CreateAdministratorFormState =
  | { status: 'idle' }
  | { status: 'success'; administratorId: string; mail: 'sent' | 'failed' }
  | ErrorState;
export type AdministratorMutationFormState = { status: 'idle' } | { status: 'success' } | ErrorState;

export async function listAdministratorsAction(query: unknown): Promise<AdministratorListResult>;
export async function getAdministratorAction(id: string): Promise<AdministratorDetailResult>;
export async function createAdministratorAction(prev, formData): Promise<CreateAdministratorFormState>;
export async function updateAdministratorAction(prev, formData): Promise<AdministratorMutationFormState>;
export async function deleteAdministratorAction(prev, formData): Promise<AdministratorMutationFormState>;
```

Campos del formulario, crudos (un ausente llega `null` y lo rechaza el esquema del dominio):

- Alta: `companyId`, `firstNames`, `lastNames`, `birthDate`, `email`, `phone`, `documentTypeCode`,
  `documentNumber`, `username`.
- Edición: `id` + los ocho datos. **No lee `companyId`**: si el cliente lo manda, no llega al dominio
  (y si llegara, el esquema lo rechaza).
- Baja: `id`.

Contrato de la lista que QC-166 usa con el `DataTable`: el mismo `ListQuery` que
`listCompaniesAction`; filtro `{ companyId: { kind: 'select', values: [<uuid>…] } }`; búsqueda en
`search`; orden por `columnId` de § 3.3. Para el selector de empresa del alta, QC-166 usa
`listCompaniesAction` (solo vivas por defecto).

## 7. Composición — `lib/composition/index.ts`

```ts
const administratorRepository = createAdministratorRepository();
// dentro de `identity`:
listAdministrators: createListAdministrators({ administrators: administratorRepository, log: identityListQueryLog }),
getAdministrator: createGetAdministrator({ administrators: administratorRepository }),
createAdministrator: createCreateAdministrator({
  administrators: administratorRepository,
  secrets: credentialSetupSecrets,
  links: credentialSetupLinkRepository,
  mailer: credentialSetupMailer,
}),
updateAdministrator: createUpdateAdministrator({ administrators: administratorRepository }),
deleteAdministrator: createDeleteAdministrator({ administrators: administratorRepository }),
```

`lib/modules/identity/index.ts` reexporta las cinco fábricas, los tres esquemas, los tipos de vista,
`ADMINISTRATOR_QUERYABLE` y `CompanyLastAdministratorError`.

## 8. Errores que ve QC-166

| Código | Cuándo |
|---|---|
| `unauthorized` | R1 |
| `invalid_input` | R4, R13, R19 |
| `user_not_found` | R11, R20, R25 |
| `company_not_found` | R15 |
| `duplicate_email`, `duplicate_username`, `duplicate_document` | R16, R21 |
| `company_last_administrator` | R23, R24 |

La pantalla no necesita provocar el error para saber cuál es el último: lo trae `isLastAdministrator`
en la fila y en la ficha.

## 9. Alternativas descartadas

### 9.1 Reutilizar `UserAdminRepository` (el CRUD de QC-66) — descartada

Es el puerto de la gestión **dentro de una empresa**: cada método lleva `…AliveInCompany` y recibe
la empresa del actor, y su `create` y su `update` responden `action_not_allowed` cuando el rol es el
de Administrador, a propósito (fix del 2026-09-22). Abrirle un camino para el Maestro obligaría a
debilitar esa garantía con un parámetro «salta la regla», que es justo lo que un llamante nuevo
acabaría usando por descuido. Un puerto aparte para la plataforma deja los dos contratos limpios.

### 9.2 Reutilizar `applyGuardedChange` para la baja — descartada

Su guarda protege «al menos un Administrador **en `active`**». La decisión del 2026-10-16 dice
«primero hay que crear otro», y un Administrador recién creado nace en `pending`: con esa guarda, el
Maestro crearía el segundo Administrador y seguiría sin poder dar de baja al primero. La regla de
aquí cuenta **vivos**. Tampoco se cambia la de QC-66, que es de otra ficha y protege otra cosa.

### 9.3 Meter las operaciones en `CompanyRepository` — descartada

`createWithAdministrator` ya crea un usuario desde ahí, pero ese repositorio deja un evento de
historial en cada escritura y su objeto es la empresa. Mezclar el CRUD de usuarios lo haría crecer
en dos sentidos; además, si P2 se responde «sí», el evento se añade en el adaptador nuevo sin tocar
el de empresas.

### 9.4 Reutilizar el código `last_administrator` — descartada

Su texto dice «sin ningún administrador **activo**» y la pantalla de usuarios de QC-67 ya lo pinta
con ese sentido. La decisión pide un error propio.

## 10. Tests y trazabilidad

E2E diferido a QC-166 (decisión cerrada). Unitarios con dobles del puerto (los de autorización
**fallan si los llaman**) e integración contra la base de test.

| R | Test |
|---|---|
| R1 | `tests/unit/identity/administradores/authorization.test.ts` (sin actor, sin permisos, permiso cruzado, Administrador de empresa con `usuarios.*`: `unauthorized` y ningún puerto llamado, en las cinco) |
| R2 | `authorization.test.ts` (actor sin empresa con el permiso pasa) |
| R3 | `tests/unit/identity/administradores/administrator-actions.test.ts` (actor de la sesión, no de la entrada; éxito y error por `code`; sin `revalidatePath`) |
| R4 | `list-administrators.test.ts` (forma inválida → `invalid_input`; consulta saneada al puerto) + `tests/integration/identity/administrator.int.test.ts` (varias empresas, defecto 10, tope 25, total filtrado) |
| R5 | `administrator.int.test.ts` (claves exactas de la fila, marca de último) |
| R6 | `administrator.int.test.ts` (filtro por una y varias empresas; valor no uuid descartado) |
| R7 | `administrator.int.test.ts` (búsqueda por cada columna, sin mayúsculas) |
| R8 | `list-administrators.test.ts` (campo no declarado omitido y registrado por nombre) + `administrator.int.test.ts` (cada orden, defecto, desempate) |
| R9 | `administrator.int.test.ts` (Operador, Empacador, Maestro, Administrador de baja y de empresa de baja no salen) |
| R10 | `get-administrator.test.ts` + `administrator.int.test.ts` (claves exactas de la ficha) |
| R11 | `get-administrator.test.ts` (id no uuid) + `administrator.int.test.ts` (los demás casos) |
| R12 | `tests/unit/identity/administradores/administrator-input.test.ts` (mismas reglas que `createUserSchema`) |
| R13 | `administrator-input.test.ts` (`roleId`, `credential`, `accountStatus`, faltantes, topes) + `create-administrator.test.ts` (ningún puerto llamado) + `administrator.int.test.ts` (alta con `roleId` de Operador: `invalid_input`, ninguna fila) |
| R14 | `administrator.int.test.ts` (rol, `pending`, centinela, `must_change_credential`, autor nulo) |
| R15 | `create-administrator.test.ts` + `administrator.int.test.ts` (empresa inexistente y de baja) |
| R16 | `create-administrator.test.ts` (traducción) + `administrator.int.test.ts` (los tres duplicados; mismo correo y documento en otra empresa sí) |
| R17 | `create-administrator.test.ts` (`sent`, `failed`, `superseded`→`sent`; el alta no falla; sin secreto) |
| R18 | `update-administrator.test.ts` + `administrator.int.test.ts` (ocho datos cambian; empresa, rol, estado, hash y contadores no) |
| R19 | `administrator-input.test.ts` (`companyId`, `roleId`, `credential`, `accountStatus` en la edición) + `administrator-actions.test.ts` (la acción no lee `companyId`) |
| R20 | `update-administrator.test.ts` + `administrator.int.test.ts` |
| R21 | `update-administrator.test.ts` + `administrator.int.test.ts` |
| R22 | `delete-administrator.test.ts` + `administrator.int.test.ts` (fila conservada, claves libres, sello subido) |
| R23 | `delete-administrator.test.ts` (traducción) + `administrator.int.test.ts` (único vivo rechazado y sin escribir; con otro en `pending`, admitida) |
| R24 | `tests/integration/identity/administrator-concurrency.int.test.ts` (dos conexiones, varias corridas, `commit`) |
| R25 | `delete-administrator.test.ts` + `administrator.int.test.ts` |

`tests/integration/aislamiento.json` gana las dos entradas (`transaccion` y `commit`).

## 11. Riesgos

1. **P1 sin responder deja el hueco de QC-162**: el Administrador cuyo correo de alta falló no tiene
   cómo entrar si es el único de su empresa. En preview el correo siempre devuelve `failed`.
2. **Empresa sin Administrador activo** tras una baja permitida (§ 5.5): aceptado por la decisión.
3. **`updateMany`/`findMany` con filtro de relación** (`company: { deletedAt: null }`): Prisma lo
   admite en `where`; si el `updateMany` no lo aceptara, la condición ya se comprobó en el paso 1 de
   § 5.4 dentro de la misma transacción.
