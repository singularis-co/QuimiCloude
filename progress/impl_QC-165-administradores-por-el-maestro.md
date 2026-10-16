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
