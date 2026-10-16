# QC-165 — administradores-por-el-maestro · tasks.md

> Zona backend. Sin migración, sin UI, sin dependencia nueva. E2E en QC-166.
> Verificación de cada tanda: `pnpm run typecheck`, `pnpm run lint`,
> `pnpm exec vitest related --run <archivos>` y `pnpm exec vitest run guard`.
> Los nombres de los casos de test llevan `R<n>`. Ningún comentario de producción cita fichas ni
> requisitos.

## Tasks

- [x] **T1 [P] — Código de error `company_last_administrator`.**
  `CompanyLastAdministratorError` en `identity/domain/errors.ts`; el código en
  `errores/domain/error-codes.ts` (con su línea «Distinto de `last_administrator`…» y la enmienda
  fechada en la cabecera) y su clave y texto en `errores/domain/error-catalog.ts` (`design.md > 3.4`).
  **Hecho:** typecheck verde; `tests/unit/errores/catalogo.test.ts` y el test de errores de identity
  cubren la clase nueva (código estable, texto del catálogo). R23.

- [x] **T2 [P] — Esquemas, vistas y lista blanca.**
  `administrator-input.ts`, `administrator-view.ts`, `administrator-queryable.ts`
  (`design.md > 3.1–3.3`). **Hecho:** `tests/unit/identity/administradores/administrator-input.test.ts`
  verde con R12, R13 (rechaza `roleId`, `credential`, `accountStatus`, faltantes, topes, empresa no
  uuid) y R19 (la edición rechaza `companyId`, `roleId`, `credential`, `accountStatus`).

- [x] **T3 [P] — Extraer el envío del enlace.**
  `sendCredentialSetupLink` de `create-company.ts` a `domain/credential-setup-mail.ts`, sin cambiar
  su comportamiento, y en el mismo archivo `resendCredentialSetupLinkTo`, extraída del cuerpo de
  `issue-credential-setup-link.ts`, que pasa a llamarla (`design.md > 3.5`). **Hecho:**
  `tests/unit/identity/companies/create-company.test.ts` y `tests/unit/identity/credencial/resend-link.test.ts`
  siguen verdes sin tocarlos.

- [x] **T4 — Puerto `AdministratorRepository`.** Depende de T2.
  `ports/administrator-repository.ts` (`design.md > 4`). **Hecho:** typecheck verde; ningún método
  recibe un rol.

- [x] **T5 — Casos de uso.** Depende de T1, T2, T3, T4.
  `list-administrators.ts`, `get-administrator.ts`, `create-administrator.ts`,
  `update-administrator.ts`, `delete-administrator.ts`, `resend-administrator-link.ts`
  (`design.md > 3.6`), y sus reexportaciones en `identity/index.ts`. **Hecho:** verdes, en
  `tests/unit/identity/administradores/`:
  - `authorization.test.ts`: R1, R2 en las seis operaciones, con dobles que fallan si los llaman.
  - `list-administrators.test.ts`: R4 (forma inválida, consulta saneada), R8 (omitido y registrado por
    nombre).
  - `get-administrator.test.ts`: R10, R11.
  - `create-administrator.test.ts`: R13 (ningún puerto llamado), R15, R16, R17.
  - `update-administrator.test.ts`: R18, R20, R21.
  - `delete-administrator.test.ts`: R22, R23, R25.
  - `resend-administrator-link.test.ts`: R26 (emisión con la empresa del Administrador, actor sin
    empresa), R27, R28, R29.

- [x] **T6 — Adaptador Prisma.** Depende de T4.
  `adapters/driven/persistence/administrator-prisma.ts` con `createAdministratorRepository(db)`
  (`design.md > 5`). **Hecho:** typecheck verde; todo `findMany`/`findFirst` con `select` enumerado;
  ningún `delete`/`deleteMany` sobre `users`; `pnpm exec vitest run guard` verde (arquitectura de
  módulos, modelos con dueño).

- [ ] **T7 — Composición.** Depende de T5, T6.
  Las seis claves en `identity` de `lib/composition/index.ts` (`design.md > 7`). **Hecho:**
  typecheck verde y guardia de arquitectura verde.

- [ ] **T8 — Acciones de servidor.** Depende de T7.
  Extraer `currentPlatformActor` a `adapters/driving/platform-session.ts` y usarlo desde
  `company-actions.ts`; crear `adapters/driving/administrator-actions.ts` (`design.md > 6`).
  **Hecho:** `tests/unit/identity/administradores/administrator-actions.test.ts` verde con R3, R19
  (la edición no lee `companyId`) y R29 (el reenvío solo lee `id`); `tests/unit/identity/company-actions.test.ts` y los dos
  `session-once-per-request-*.test.ts` siguen verdes.

- [ ] **T9 — Integración.** Depende de T6.
  `tests/integration/identity/administrator.int.test.ts` (modo `transaccion`, con el repositorio
  sobre `tx`) y sus entradas en `tests/integration/aislamiento.json`. **Hecho:** verde contra la base
  de test con R4–R11, R13 (alta con un `roleId` de Operador: `invalid_input`, ninguna fila), R14–R16,
  R18, R20–R23, R25, R26 (enlace nuevo vivo, anterior sustituido, plazo desde el reenvío) y R28
  (ningún enlace nuevo en los rechazos).

- [ ] **T10 — Concurrencia de la baja.** Depende de T6.
  `tests/integration/identity/administrator-concurrency.int.test.ts` (modo `commit`, dos
  conexiones, varias corridas, limpieza propia), con su entrada en `aislamiento.json`. **Hecho:** R24
  verde: como máximo una baja pasa y la empresa conserva ≥ 1 Administrador vivo, leído de la base.

- [ ] **T11 — Cierre.** Depende de todas.
  `./init.sh` verde en el worktree; mapa `R<n> -> test` completo en
  `progress/impl_QC-165-administradores-por-el-maestro.md` (29 requisitos, `design.md > 10`).

## Archivos esperados

- `lib/modules/identity/domain/administrator-input.ts`
- `lib/modules/identity/domain/administrator-view.ts`
- `lib/modules/identity/domain/administrator-queryable.ts`
- `lib/modules/identity/domain/credential-setup-mail.ts`
- `lib/modules/identity/domain/create-company.ts`
- `lib/modules/identity/domain/list-administrators.ts`
- `lib/modules/identity/domain/get-administrator.ts`
- `lib/modules/identity/domain/create-administrator.ts`
- `lib/modules/identity/domain/update-administrator.ts`
- `lib/modules/identity/domain/delete-administrator.ts`
- `lib/modules/identity/domain/resend-administrator-link.ts`
- `lib/modules/identity/domain/issue-credential-setup-link.ts`
- `lib/modules/identity/domain/errors.ts`
- `lib/modules/identity/ports/administrator-repository.ts`
- `lib/modules/identity/adapters/driven/persistence/administrator-prisma.ts`
- `lib/modules/identity/adapters/driving/platform-session.ts`
- `lib/modules/identity/adapters/driving/company-actions.ts`
- `lib/modules/identity/adapters/driving/administrator-actions.ts`
- `lib/modules/identity/index.ts`
- `lib/composition/index.ts`
- `lib/modules/errores/domain/error-codes.ts`
- `lib/modules/errores/domain/error-catalog.ts`
- `tests/unit/errores/catalogo.test.ts`
- `tests/unit/identity/usuarios/errors.test.ts`
- `tests/unit/identity/administradores/administrator-input.test.ts`
- `tests/unit/identity/administradores/authorization.test.ts`
- `tests/unit/identity/administradores/list-administrators.test.ts`
- `tests/unit/identity/administradores/get-administrator.test.ts`
- `tests/unit/identity/administradores/create-administrator.test.ts`
- `tests/unit/identity/administradores/update-administrator.test.ts`
- `tests/unit/identity/administradores/delete-administrator.test.ts`
- `tests/unit/identity/administradores/administrator-actions.test.ts`
- `tests/unit/identity/administradores/resend-administrator-link.test.ts`
- `tests/integration/identity/administrator.int.test.ts`
- `tests/integration/identity/administrator-concurrency.int.test.ts`
- `tests/integration/aislamiento.json`
