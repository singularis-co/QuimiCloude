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

## Tanda 3 — T9/T10 (2026-10-16): integración

### Archivos
- Nuevo: `tests/integration/identity/administrator.int.test.ts` (T9, modo `transaccion`). Cada `it` en `prisma.$transaction` que termina en `RollbackSignal`; `createAdministratorRepository(tx)` y los seis casos de uso reales cableados sobre él (actor sin empresa con `empresas.*`, reloj inyectado, secreto real `credentialSetupSecretCrypto`, correo doble que registra `to`/`secret`). El adaptador del enlace (`credential-setup-link-prisma.ts`) usa el cliente global y abre su propio `$transaction`: se importa una copia con `@/lib/shared/db/prisma` doblado a un puente cuyo `$transaction` es `atomically(<tx del test>, fn)` (SAVEPOINT). El código de producción del enlace corre tal cual y un caso comprueba que su escritura se ve en la `tx` y no desde el cliente global (lo que confirma el modo `transaccion`).
- Nuevo: `tests/integration/identity/administrator-concurrency.int.test.ts` (T10, modo `commit`). Dos `PrismaClient` (dos pools), `createAdministratorRepository(clientA|clientB)`; pids distintos con transacciones solapadas; empresa y Administradores propios por caso, borrados en `finally`; `afterAll` exige cero empresas propias.
- `tests/integration/aislamiento.json`: `identity/administrator.int.test.ts` en `transaccion`; `identity/administrator-concurrency.int.test.ts` en `commit` con `motivo` y `desde`.
- Producción: sin cambios. Ningún test destapó un bug.

### Mapa R<n> → test (integración)

| R | Caso |
|---|---|
| R4 | `administrator.int.test.ts` › «R4: … 10 por defecto, acota a 25 y el total es el del conjunto filtrado» (27 en 2 empresas) y «R4: una consulta sin la forma del contrato responde invalid_input» |
| R5 | › «R5: cada fila lleva exactamente sus claves … y marca al ultimo» (uno solo, dos, uno vivo + uno de baja) |
| R6 | › «R6: el filtro por empresa con una o varias…; no uuid descartado; sin ninguno se omite» |
| R7 | › «R7: la busqueda … nombres, apellidos, correo y usuario, sin mayusculas» |
| R8 | › «R8: ordena por %s en las dos direcciones» (6 columnas), «…nombre de la empresa…», «sin orden pedido…mas recientes», «…desempata por identificador … ninguna fila en dos paginas», «…no declarado se omite … se registra por su nombre» |
| R9 | › «R9: no salen Operadores, Empacadores, el Maestro, … de baja ni de empresas de baja» |
| R10 | › «R10: devuelve exactamente sus claves …» |
| R11 | › «R11: inexistente, no uuid, de baja, de otro rol, el Maestro o de empresa de baja … user_not_found» |
| R13 | › «R13: un alta con el roleId de Operador responde invalid_input, no escribe ninguna fila…» y «R13: contrasena, estado, faltante, tope, empresa no uuid…» |
| R14 | › «R14: el creado es Administrador, nace en pending, …» |
| R15 | › «R15: empresa inexistente o de baja responde company_not_found…» |
| R16 | › «R16: correo o documento repetidos … usuario repetido en cualquier empresa…» y «R16: el mismo correo y documento en otra empresa se admiten» |
| R18 | › «R18: reemplaza los ocho datos y no cambia empresa, rol, estado, credencial ni contadores» |
| R20 | › «R20: un objetivo que no es un Administrador gestionable … sin escribir» |
| R21 | › «R21: correo o documento … o usuario de cualquier otro…» y «R21: … de otra empresa se admiten» |
| R22 | › «R22: marca la baja conservando la fila, sube el sello de sesiones y libera correo, usuario y documento» |
| R23 | › «R23: el unico Administrador vivo se rechaza con company_last_administrator…» y «R23: con otro … en pending, la baja se admite» |
| R24 | `administrator-concurrency.int.test.ts` › «R24: las dos conexiones son reales y distintas», «R24: corrida %i …» (5 corridas por el caso de uso), «R24: corrida %i en el adaptador …» (3), «R24 (simetrico): con tres…», «R24: dos bajas simultaneas del mismo Administrador…» |
| R25 | `administrator.int.test.ts` › «R25: un objetivo que no es un Administrador gestionable … sin escribir» |
| R26 | › «R26: el adaptador del enlace escribe dentro de la transaccion del test…», «R26: emite un enlace nuevo vivo con plazo desde el reenvio, sustituye el anterior y lo envia al correo guardado», «R26: sin enlace anterior emite uno vivo» |
| R28 | › «R28: a un objetivo no gestionable responde user_not_found sin emitir…», «R28: … que ya no esta en pending responde user_not_pending…», «R28: el rechazo no toca el enlace vivo que ya tenia» |

### Verificación
- `pnpm exec vitest run --project integration <los dos archivos>`: 2 archivos, 49 pasan / 0 fallan (T9 38, T10 11). Base efímera `qct_qc165_…` copia de `qct_tpl_b2687cf7fda6`, borrada al terminar.
- T10 repetido 6 veces seguidas: 11/11 verde las 6.
- Prueba de mordida de T10: quitando temporalmente el `FOR UPDATE` de `softDelete`, 8 de los 8 casos de carrera fallan (los 3 restantes no dependen del bloqueo); restaurado byte a byte (`git diff` vacío en el adaptador).
- `pnpm exec vitest run tests/guards/guard-aislamiento-integracion.test.ts`: 6/6 verde.
- `pnpm run typecheck`: exit 0.
- `pnpm run lint`: 0 errores; 10 avisos en 4 archivos ajenos (los mismos de antes); `eslint` de los dos archivos nuevos: sin avisos.

MCP del grafo: no se usó (worktree sin indexar); Grep/Read.

Veredicto: T9 y T10 hechas, en verde, sin cambios de producción ni bloqueos.

## Tanda 3 — T7/T8 (2026-10-16): composición y acciones de servidor

### Archivos
- `lib/composition/index.ts` (T7): `administratorRepository = createAdministratorRepository()` y las seis claves al final de `identity` (`listAdministrators`, `getAdministrator`, `createAdministrator`, `updateAdministrator`, `deleteAdministrator`, `resendAdministratorLink`), con `identityListQueryLog`, `credentialSetupSecrets`, `credentialSetupLinkRepository` y `credentialSetupMailer` como pide `design.md > 7`. Las fábricas salen del contrato `@/lib/modules/identity`; el adaptador, por su ruta.
- Nuevo `lib/modules/identity/adapters/driving/platform-session.ts` (T8): `currentPlatformActor()` extraído tal cual de `company-actions.ts`, sin `'use server'` (función normal, no acción).
- `lib/modules/identity/adapters/driving/company-actions.ts` (T8): importa `currentPlatformActor` de `./platform-session`; se quitan la función privada y los imports de `PlatformActor` y `runInRequestScope`. Sin cambio de comportamiento.
- Nuevo `lib/modules/identity/adapters/driving/administrator-actions.ts` (T8): `'use server'`, las seis acciones y sus cinco tipos de estado (`design.md > 6`), sin `revalidatePath`. Alta: `companyId` + los ocho datos crudos; edición: `id` + los ocho (no lee `companyId`); baja y reenvío: solo `id`.
- Nuevo `tests/unit/identity/administradores/administrator-actions.test.ts`: composición doblada con los casos de uso reales sobre puertos espía (patrón de `company-actions.test.ts`), reutiliza `administrator-doubles.ts`.

Guardias de lista cerrada revisadas, **ninguna tocada**: `session-once-per-request-actions` solo censa archivos con las dos caras (`getSessionUser` + `getSessionContext`) y `platform-session.ts` usa una; `maestro-rol` (`RUTAS_ABIERTAS_EMPRESAS`) mira quien nombra `empresas.*` y las acciones no lo nombran; `account-status-scope` y `credencial/scope` no se ven afectadas (las acciones no nombran el estado ni el envío). `company-actions.test.ts` y los dos `session-once-per-request-*.test.ts` siguen verdes sin tocarlos.

### Mapa R<n> → test (esta tanda, `administrator-actions.test.ts`)
| R | Test |
|---|---|
| R3 | por cada una de las seis acciones: «R3: el actor sale de la sesion, una sola lectura, sin contexto de empresa ni revalidar», «R3: lo colado en la entrada no llega al caso de uso», «R3: sin sesion el actor es null y responde unauthorized sin tocar ningun puerto», «R3: unos permisos de la entrada no autorizan…»; más éxito y error por `code` en cada acción (`invalid_input`, `user_not_found`, `duplicate_email`, `company_last_administrator`, `user_not_pending`, correo `failed`) |
| R19 | «R19: la accion no lee companyId; el caso de uso recibe solo el id y los ocho datos» (con `companyId` de otra empresa en el formulario: success, entrada sin `companyId`, el puerto no la ve) |
| R29 | «R29: la accion solo lee id; correo y empresa de la entrada no llegan al caso de uso» (`email`, `companyId`, `to` en el formulario: emisión con la empresa de la ficha, nada de lo colado en emisión ni correo, sin secreto) |

### Verificación
- `pnpm run typecheck`: exit 0.
- `pnpm run lint`: 0 errores; 10 avisos en 4 archivos ajenos (los de siempre). `eslint` de los cinco archivos de la tanda: sin avisos.
- `pnpm exec vitest run tests/unit/identity tests/unit/composition`: 149 archivos pasaron (149); 2810 tests pasaron, 31 se saltaron (2841). `administrator-actions.test.ts`: 39/39.
- `pnpm exec vitest run guard`: 80 archivos pasaron (80); 1096 pasan / 20 se saltan. (Una corrida intermedia dio rojo en `guard-aislamiento-integracion` por `administrator.int.test.ts` aún sin censar, trabajo en curso del otro agente; en la corrida final, verde.)

MCP del grafo: no se usó (worktree sin indexar); Grep/Read.

Veredicto: T7 y T8 hechas, en verde, sin bloqueos.
