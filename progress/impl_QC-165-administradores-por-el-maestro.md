# QC-165 — administradores-por-el-maestro · bitácora de backend_dev

## Tanda 1 (2026-10-16): T1, T2, T3, T4

### Archivos

Creados:
- `lib/modules/identity/domain/administrator-input.ts` (T2)
- `lib/modules/identity/domain/administrator-view.ts` (T2)
- `lib/modules/identity/domain/administrator-queryable.ts` (T2)
- `lib/modules/identity/domain/credential-setup-mail.ts` (T3)
- `lib/modules/identity/ports/administrator-repository.ts` (T4)
- `tests/unit/identity/administradores/administrator-input.test.ts` (T2)

Modificados:
- `lib/modules/identity/domain/errors.ts`: `CompanyLastAdministratorError` (T1)
- `lib/modules/errores/domain/error-codes.ts`: código, línea «Distinto de `last_administrator`» y enmienda fechada 2026-10-16 (T1)
- `lib/modules/errores/domain/error-catalog.ts`: clave y texto (T1)
- `lib/modules/identity/domain/create-company.ts`: importa `sendCredentialSetupLink` (T3)
- `lib/modules/identity/domain/issue-credential-setup-link.ts`: llama a `resendCredentialSetupLinkTo` tras permiso y `parse` (T3)
- `tests/unit/errores/catalogo.test.ts`: recuento 101 → 102 y bloque de `company_last_administrator` (T1)
- `tests/unit/identity/usuarios/errors.test.ts`: bloque de `CompanyLastAdministratorError` (T1)

`create-company.test.ts` y `resend-link.test.ts` sin tocar y verdes (T3).

### Mapa parcial R<n> → test (esta tanda)

| R | Test |
|---|---|
| R8 | `administrator-input.test.ts` › «R8: declara los siete ordenes, el filtro por empresa y la busqueda» (lista blanca; el resto de R8 va en T5/T9) |
| R12 | `administrator-input.test.ts` › bloque «los ocho datos» (mismas reglas y topes que `createUserSchema`) |
| R13 | `administrator-input.test.ts` › bloque «alta» (`roleId`, `credential`, `accountStatus`, faltantes, empresa no uuid) |
| R19 | `administrator-input.test.ts` › bloque «edicion» (`companyId`, `roleId`, `credential`, `accountStatus`, faltantes) |
| R23 | `catalogo.test.ts` › «company_last_administrator…» y `usuarios/errors.test.ts` › «CompanyLastAdministratorError» |
| R29 | `administrator-input.test.ts` › «R29: solo admite el identificador del Administrador» (esquema; el caso de uso va en T5) |

### Verificación

- `pnpm run typecheck`: exit 0, sin errores.
- `pnpm run lint`: exit 0; 0 errores, 10 avisos `no-unused-vars` en 4 archivos ajenos a la tanda.
- `pnpm exec vitest related --run <13 archivos de la tanda>`: 954 archivos pasaron (954), 15615 tests pasaron y 34 se saltaron (15649), 1451 s. Arrastra casi toda la suite porque `errors.ts` y el catálogo los importa casi todo.
- Confirmación dirigida (`create-company`, `resend-link`, `administrator-input`, `usuarios/errors`, `catalogo`): 5 archivos, 158 tests verdes.
- `pnpm exec vitest run guard`: 80 archivos pasaron (80), 1096 tests pasaron y 20 se saltaron.

MCP del grafo: no se usó; el worktree no está indexado (`design.md > Lo que ya existe`), así que se trabajó con Grep/Read.

Veredicto: T1–T4 hechas, todo verde, sin bloqueos.

## Corrección de guardias de lista cerrada (rojo en `./init.sh` tras T1–T4)

- `tests/unit/identity/account-status-scope.test.ts`: `SITIOS_PERMITIDOS` gana `administrator-view.ts` (R5, R10, `design.md > 3.2`) y `administrator-queryable.ts` (R8, `> 3.3`). Antes se comprobó que los dos nombran el estado solo donde el design lo pide.
- `tests/unit/identity/credencial/scope.test.ts` (QC-79 R39): `EMISORES_LEGITIMOS` = `create-user.ts` + `credential-setup-mail.ts`; caso nuevo de lista cerrada `USUARIOS_DEL_ENVIO` = `create-company.ts` + `issue-credential-setup-link.ts` (quien importa `credential-setup-mail` o llama `resendCredentialSetupLinkTo`), con su ancla y sus disparos. `resend-administrator-link.ts` queda anotado como PENDIENTE de la tanda siguiente. `credential-setup-mail.ts` entra en `DOMINIO`: lo extraído sigue sin `console.*` (R5/R13) y bajo R31/R40.
- Verificación: los dos archivos 121 pasan / 3 se saltan; unit de identity, errores, composition y alcances: 243 archivos, 3910 pasan / 82 se saltan; `vitest run guard`: 80 archivos, 1096 pasan / 20 se saltan; typecheck exit 0; lint 0 errores (10 avisos ajenos).

Veredicto: las dos guardias en verde sin aflojar su criterio.

## Tanda 2 — T6 (2026-10-16): adaptador Prisma

### Archivos
- Nuevo: `lib/modules/identity/adapters/driven/persistence/administrator-prisma.ts` — `createAdministratorRepository(db: PrismaLike = prisma)` (`design.md > 5`). Condición `MANAGEABLE` única (vivo, rol por `ROLE_ADMINISTRADOR`, empresa viva) en las cinco operaciones. `findMany`/`findFirst` con `select` enumerado (`ROW_SELECT`, `DETAIL_SELECT`, `{ companyId }`); ningún `delete`/`deleteMany`. Lista: mismo `where` en `findMany` y `count`, filtro `companyId` acotado a uuid (`selectCondition`), búsqueda en 4 columnas, orden de las 6 columnas + `companyName` → `{ company: { name } }`, defecto `createdAt desc`, siempre `id asc`; `isLastAdministrator` con un `groupBy` por página. Alta en `atomically` con `FOR SHARE` sobre la empresa, rol por nombre, `pending` + centinela + `mustChangeCredential`, sin autor. Edición: localiza con `MANAGEABLE` y `updateMany` de los 8 datos + `updatedAt`, sin sello. Baja: `FOR UPDATE` del conjunto de Administradores vivos de la empresa, `not_found` si el objetivo ya no está, `last_administrator` si es el único, `updateMany` con `deletedAt`, `updatedAt` y el sello de `changeRevokesSessions({ kind: 'delete' })` + `floorToSecond`. `P2002` → `duplicateKeyOf` (sin marca conocida se relanza), `P2003` → `invalid_document_type`, traducidos fuera de la transacción.
- `tests/unit/identity/account-status-scope.test.ts`: `SITIOS_PERMITIDOS` gana `administrator-prisma.ts` (enumera `accountStatus` en el `select`, ordena por él y escribe `pending` al nacer).

### Mapa R<n> → test
Sin tests nuevos en esta tanda: R4–R11, R14–R16, R18, R20–R23, R25 y R24 se prueban en T9/T10 (`administrator.int.test.ts`, `administrator-concurrency.int.test.ts`).

### Verificación
- `pnpm run typecheck`: exit 0 (incluidos los archivos de T5 presentes en el árbol).
- `pnpm run lint`: 0 errores, 10 avisos en 4 archivos ajenos.
- `pnpm exec vitest related --run <adaptador> account-status-scope.test.ts`: 1 archivo, 9 pasan / 3 se saltan.
- `pnpm exec vitest run guard`: 80 archivos, 1096 pasan / 20 se saltan.
- Alcances de identity (`usuarios/`, `credencial/`, `roles/`, `grupos/` scope y `company-events-append-only`): 5 archivos, 160 pasan / 14 se saltan.

Veredicto: T6 hecho, en verde; falta la integración (T9/T10).

## Tanda 2 — T5 (2026-10-16): casos de uso

### Archivos

Creados (`lib/modules/identity/domain/`, `design.md > 3.6`):
- `list-administrators.ts`: `empresas.consultar` → `createListQuerySchema` → `sanitizeListQuery(ADMINISTRATOR_QUERYABLE)` → `log.ignoredFields('administrators', …)` → `administrators.list`.
- `get-administrator.ts`: `empresas.consultar` → `administratorIdSchema`; cualquier fallo del esquema → `user_not_found` (nunca `invalid_input`) → `findManageable`; `null` → `user_not_found`.
- `create-administrator.ts`: `empresas.modificar` → `createAdministratorSchema` → `toBirthDate` → `administrators.create` → traduce (`company_not_found`, `invalid_document_type` → `invalid_input`, duplicados con `throwDuplicate`) → `sendCredentialSetupLink` → `{ administratorId, mail }`.
- `update-administrator.ts`: `empresas.modificar` → `updateAdministratorSchema` → `toBirthDate` → `administrators.update` → traduce (`not_found` → `user_not_found`, `invalid_document_type`, duplicados).
- `delete-administrator.ts`: `empresas.modificar` → `administratorIdSchema` (fallo → `user_not_found`) → `softDelete` → `not_found` → `user_not_found`, `last_administrator` → `CompanyLastAdministratorError`.
- `resend-administrator-link.ts`: `empresas.modificar` → `administratorIdSchema`; si el único fallo es el formato del `id` → `user_not_found`, cualquier otro (clave de más, sin `id`, `id` no texto, no objeto) → `invalid_input` → `findManageable`; `null` → `user_not_found` → `resendCredentialSetupLinkTo(deps, { userId, companyId: detail.company.id, now })` → `{ mail }`.
- `tests/unit/identity/administradores/administrator-doubles.ts` (dobles compartidos que lanzan si se les llama).
- Los siete tests de T5 en `tests/unit/identity/administradores/`.

Modificados:
- `lib/modules/identity/index.ts`: reexporta las seis fábricas con sus `Deps`/`Result`, los tres esquemas y sus tipos, `AdministratorCompany/Row/Detail`, `ADMINISTRATOR_QUERYABLE` y `CompanyLastAdministratorError` (`design.md > 7`).
- `tests/unit/identity/credencial/scope.test.ts`: `USUARIOS_DEL_ENVIO` gana `resend-administrator-link.ts` (sustituye el comentario PENDIENTE) **y `create-administrator.ts`**, que también importa `credential-setup-mail` (`sendCredentialSetupLink`, `design.md > 3.5`: «lo usan los dos altas»); título y mensaje del caso actualizados.
- `tests/unit/identity/roles/maestro-rol.test.ts`: `RUTAS_ABIERTAS_EMPRESAS` (R17 de QC-161) gana las seis rutas exactas de los casos de uso, que nombran `empresas.*` en su primera línea.
- `account-status-scope.test.ts`: sin cambio por T5; ningún caso de uso nombra el estado de cuenta.

Interpretación anotada: para la ficha y la baja, `design.md > 3.6` y `> 8` solo prevén `user_not_found` (no `invalid_input`), así que cualquier entrada que no cumpla `administratorIdSchema` responde `user_not_found`. En el reenvío se distingue como pide la tabla: formato del `id` → `user_not_found`; el resto → `invalid_input` (R29).

### Mapa R<n> → test (esta tanda, `tests/unit/identity/administradores/`)

| R | Test |
|---|---|
| R1 | `authorization.test.ts` › por cada una de las seis operaciones: null, undefined, sin permisos, vacío, permiso cruzado, Administrador de empresa con `usuarios.*` → `unauthorized`, ningún doble llamado; y entrada rota sin permiso → `unauthorized` |
| R2 | `authorization.test.ts` › «R2: un actor sin empresa con <permiso> queda autorizado» (seis) |
| R4 | `list-administrators.test.ts` › página tal cual, defectos, tamaño 25 sin rechazo, filtro/búsqueda/orden saneados, cinco formas inválidas → `invalid_input` |
| R8 | `list-administrators.test.ts` › 14 órdenes declarados (7 × 2) y «orden y filtro no declarados se omiten y se registran por nombre» (sin el valor) |
| R10 | `get-administrator.test.ts` › ficha del puerto y claves exactas |
| R11 | `get-administrator.test.ts` › `null` → `user_not_found`; tres ids mal formados → `user_not_found` sin puerto; misma respuesta |
| R12, R14 | `create-administrator.test.ts` › el puerto recibe empresa, ocho datos con fecha civil e instante, sin `roleId` |
| R13 | `create-administrator.test.ts` › nueve entradas inválidas → `invalid_input` sin ningún puerto; `invalid_document_type` → `invalid_input` |
| R15 | `create-administrator.test.ts` › `company_not_found` sin secreto, enlace ni correo |
| R16 | `create-administrator.test.ts` › tres duplicados traducidos, sin enlace ni correo |
| R17 | `create-administrator.test.ts` › emisión con la empresa y 7 días; `sent`; `failed` sin lanzar; `superseded` → `sent` sin correo; `not_found`/`user_not_pending`/`issued` → `failed`; sin secreto en resultado ni error |
| R18 | `update-administrator.test.ts` › exactamente los ocho datos al puerto; recortados; `invalid_document_type` |
| R19 | `update-administrator.test.ts` › `companyId`, `roleId`, `credential`, `accountStatus` y faltante → `invalid_input` sin puerto |
| R20 | `update-administrator.test.ts` › `not_found` → `user_not_found` |
| R21 | `update-administrator.test.ts` › tres duplicados |
| R22 | `delete-administrator.test.ts` › `softDelete({ id, now })` una vez, sin resultado |
| R23 | `delete-administrator.test.ts` › `last_administrator` → `company_last_administrator`, distinto de `LastAdministratorError` |
| R25 | `delete-administrator.test.ts` › `not_found` → `user_not_found`; tres ids inválidos sin puerto |
| R26 | `resend-administrator-link.test.ts` › emisión con la empresa del Administrador (también otra), 7 días desde el reenvío, actor sin empresa, correo a lo que resuelve la emisión |
| R27 | `resend-administrator-link.test.ts` › `sent`, `failed` sin lanzar, `superseded` → `sent` sin segundo correo, resultado solo `mail` sin secreto ni correo |
| R28 | `resend-administrator-link.test.ts` › `null` → `user_not_found` sin secreto/enlace/correo; emisión `not_found` → `user_not_found`; `user_not_pending`; errores sin secreto ni correo; ids mal formados → `user_not_found` sin puertos |
| R29 | `resend-administrator-link.test.ts` › `email`, `companyId`, `to`, sin `id`, `id` no texto, no objeto → `invalid_input` sin ningún puerto |

### Verificación

- `pnpm run typecheck`: exit 0, sin errores (incluido `administrator-prisma.ts` de T6).
- `pnpm run lint`: exit 0; 0 errores, 10 avisos `no-unused-vars` en archivos ajenos a la tanda (los mismos de la tanda 1).
- `pnpm exec vitest run tests/unit/identity`: 142 archivos pasaron (142); 2701 tests pasaron, 31 se saltaron (2732).
  - De ellos, `tests/unit/identity/administradores`: 8 archivos, 164 tests verdes.
- `pnpm exec vitest run guard`: 80 archivos pasaron (80); 1096 tests pasaron, 20 se saltaron.

MCP del grafo: no se usó; el worktree no está indexado. Se trabajó con Grep/Read.

Veredicto: T5 hecha, todo verde, sin bloqueos.
