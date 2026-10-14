# QC-162 — Gestión de empresas por el Maestro · tasks

Spec: `requirements.md` (R1–R44) y `design.md`. Sin UI ni E2E.
Cada task cierra con `pnpm run typecheck`, `pnpm run lint`,
`pnpm exec vitest related --run <archivos>` y, si toca capas, esquema, errores o seed,
`pnpm exec vitest run guard`. Un commit por task. Los casos de test llevan `R<n>` en el nombre.

## Tandas y orden

```
Tanda A (esquema y errores):   T1 ── T2
Tanda B (dominio):             T3 ── T4 ──┬── T5 [P]
                                          └── T6 [P]
Tanda C (adaptadores):         T7 ──┬── T8 [P]
                                    └── T9 [P]   (T9 solo si P4 sigue en «sí»)
Tanda D (borde y seed):        T10 ── T11 [P con T10]
Cierre:                        T12
```

- B depende de A; C depende de B (T7 necesita los puertos de T4 y el dominio de T5/T6); D
  depende de C.
- T8 es de `pedidos` y no toca ningún archivo de T7.
- T11 (seed) solo depende de T3 (tipo `SeedScope`) y puede ir en paralelo con T10.

## Tasks

### Tanda A

- [x] **T1 · Migración y esquema** (R4, R10, R39, R43, R44).
  - `db/schema.prisma`: cuatro columnas en `Company`, modelo `CompanyEvent` con `/// @module
    identity`, lado inverso en `User` y `Company` (`design.md > 2.1`). Sin citas de fichas en los
    comentarios.
  - `db/migrations/20261014120000_companies_management/migration.sql` y `down.sql`
    (`design.md > 2.2`). Quitar a mano los `DROP CONSTRAINT` de drift que genere Prisma.
  - `tests/unit/identity/schema/companies-management-migration.test.ts`: columnas anulables sin
    `DEFAULT`; los dos `CHECK`; el índice parcial; la tabla con sus FK `RESTRICT`, sin
    `updated_at` ni `deleted_at`; `ENABLE` y `FORCE` al final; `down.sql` deshace exactamente lo
    anterior.
  - **Hecho:** `pnpm run db:migrate` aplica en la base de test; `pnpm run db:rollback` la deja
    como antes; el test, `guard-rls-force`, `guard-empresa-en-esquema` y
    `guard-arquitectura-modulos` en verde.

- [x] **T2 · Errores** (R8, R9, R22, R28). Depende de T1 solo por orden de commits.
  - `lib/modules/errores/domain/error-codes.ts` (cuatro códigos y su línea de enmienda) y
    `error-catalog.ts` (textos de `design.md > 3.6`).
  - `lib/modules/identity/domain/errors.ts`: las cuatro clases.
  - **Hecho:** `guard-catalogo-de-errores` y `tests/unit/errores/catalogo.test.ts` en verde sin
    cambiar sus aserciones.

### Tanda B

- [x] **T3 · Dominio puro: entradas, lista, historial, vistas y alcance del seed** (R4–R7, R30,
  R32, R35, R39, R40).
  - `domain/company-input.ts`, `domain/company-queryable.ts`, `domain/company-event.ts`,
    `domain/company-view.ts`, `domain/seed-scope.ts` (`design.md > 3.1–3.4`, `> 7`).
  - `tests/unit/identity/companies/company-input.test.ts`: topes, recorte, `''` → `null`, campo
    ausente y claves extra → error, correo sin formato aceptado, Administrador con `roleId`,
    `credential` o `companyId` → error, `normalizeTaxId('900.123.456-7') === '9001234567'`.
  - `tests/unit/identity/companies/company-event.test.ts`: `changedCompanyFields` (orden fijo,
    `null` frente a texto, sin cambios → `[]`); los cuatro tipos cumplen `EVENT_KIND_FORMAT`.
  - **Hecho:** tests verdes; `guard-arquitectura-modulos` y `guard-contrato-listados` en verde.

- [x] **T4 · Puertos** (soporte de R11–R38). Depende de T3.
  - `ports/company-repository.ts`, `ports/company-open-orders-counter.ts` (`design.md > 4`).
  - **Hecho:** typecheck verde; ningún puerto importa fuera de `domain/`.

- [x] **T5 [P] · Casos de uso de escritura** (R1, R2, R5, R7–R9, R11–R19, R21–R23, R26–R28).
  Depende de T4.
  - `domain/create-company.ts`, `domain/update-company.ts`, `domain/delete-company.ts`,
    `domain/reactivate-company.ts` (`design.md > 3.5`).
  - Un test por archivo en `tests/unit/identity/companies/`, con dobles que fallan si los llaman:
    - R1/R2 en los cuatro: `null`, sin permisos, solo `empresas.consultar` → `unauthorized` sin
      tocar ningún puerto; actor sin empresa con `empresas.modificar` → pasa.
    - `create-company.test.ts`: R7, R8, R9, R11, R12, R13 (`'username'`, `'invalid_document_type'`),
      R15 (enlace con `administratorId`, 7 días desde `now`, `sent`/`failed`/`superseded`, el
      alta no lanza si el correo falla, el secreto no sale en el resultado).
    - `update-company.test.ts`: R16, R18 (`'unchanged'` → éxito), R19, R8, R9.
    - `delete-company.test.ts`: R21 (llega la confirmación normalizada), R22 (`name_mismatch`,
      confirmación vacía → `invalid_input`), R23.
    - `reactivate-company.test.ts`: R26, R27, R28.
  - Reexportar desde `lib/modules/identity/index.ts` (`design.md > 6.1`).
  - **Hecho:** tests verdes; el dominio solo importa `zod`, su `domain/` y sus `ports/`.

- [x] **T6 [P] · Casos de uso de lectura** (R1, R2, R20, R29–R33, R37). Depende de T4.
  - `domain/list-companies.ts`, `domain/get-company.ts`, `domain/get-company-deletion-impact.ts`,
    `domain/list-company-events.ts`.
  - Tests en `tests/unit/identity/companies/`: R1/R2 (solo `empresas.modificar` →
    `unauthorized`), saneado y log con `'companies'` (R32), `not_found` → `company_not_found`
    (R20, R33, R37), impacto con los dos contadores (R20).
  - Reexportar desde `lib/modules/identity/index.ts`.
  - **Hecho:** tests verdes.

### Tanda C

- [x] **T7 · Adaptador driven de empresas** (R8–R14, R16–R35, R37, R39). Depende de T5 y T6.
  - `adapters/driven/persistence/company-prisma.ts` (`design.md > 5.1`).
  - `adapters/driven/persistence/user-admin-prisma.ts`: exportar `duplicateKeyOf`, sin cambiar su
    cuerpo.
  - Medir el `meta.target` de `companies_tax_id_unique` y anotarlo en
    `progress/impl_QC-162-gestion-de-empresas.md`.
  - `tests/integration/identity/company.int.test.ts` (aislamiento `transaccion`, declararlo en
    `tests/integration/aislamiento.json`; los casos que esperan un fallo de la base van bajo
    `SAVEPOINT`): todos los casos de `design.md > 9` marcados con `company.int.test.ts`.
  - `tests/unit/identity/companies/company-events-append-only.test.ts` (R38).
  - **Hecho:** el `.int` verde contra la base de test; `guard-aislamiento-integracion`,
    `guard-sesiones-cortadas` y `guard-password-never-plaintext` en verde.

- [x] **T8 [P] · Pedidos en curso** (R20). Depende de T4.
  - `lib/modules/pedidos/domain/order-classification.ts`: `ORDER_STATUSES_NOT_IN_PROGRESS`.
  - `lib/modules/pedidos/adapters/driven/persistence/order-company-stats-prisma.ts`
    (`design.md > 5.2`).
  - `tests/integration/pedidos/order-company-stats.int.test.ts` (aislamiento `transaccion`):
    cuenta `PENDIENTE`, `TERMINADO` y `BLOQUEADO`; no cuenta `ENTREGADO`, `CANCELADO`, borrados ni
    pedidos de otra empresa.
  - **Hecho:** `.int` verde; `guard-ambito-empresa-pedidos` y `tests/unit/pedidos/module-contract.test.ts`
    en verde.

- [x] **T9 [P] · País con historial** (R36; enmienda a QC-235). Depende de T7. Se cae si el
  humano responde «no» a P4.
  - `ports/company-country-repository.ts`, `domain/set-company-country.ts`,
    `adapters/driven/persistence/company-country-prisma.ts` (`design.md > 3.5`, `> 5.3`).
  - `tests/unit/identity/set-company-country.test.ts`: el puerto recibe `actorId` y `now`; los
    casos de QC-235 siguen.
  - `tests/integration/identity/company-country.int.test.ts`: evento con `country`; mismo país →
    sin evento ni `updated_at`; los casos de QC-235 siguen.
  - **Hecho:** los dos tests verdes, sin quitar ningún caso de QC-235.

### Tanda D

- [x] **T10 · Composición y Server Actions** (R1–R3). Depende de T7, T8 y T9.
  - `lib/composition/index.ts` (`design.md > 6.1`).
  - `lib/modules/identity/adapters/driving/company-actions.ts`: las ocho acciones
    (`design.md > 6.2`).
  - `tests/unit/identity/company-actions.test.ts` (ampliado): R3 para las ocho; `FormData` del
    alta armado en `{ company, administrator }`; campo ausente → `invalid_input`.
  - `tests/unit/identity/roles/maestro-rol.test.ts`: abrir las ocho rutas de `design.md > 8`, punto 1.
  - **Hecho:** tests verdes; `maestro-sin-empresa-actions.test.ts` y
    `session-once-per-request-actions.test.ts` siguen verdes sin cambios.

- [x] **T11 [P] · Seed por entorno** (R40–R42). Depende de T3.
  - `domain/seed-initial-access.ts` (`scope` en `deps`, `scope` en `SeedOutcome`),
    `adapters/driven/config/seed-scope-env.ts`, el cableado de `seedInitialAccess` en
    `lib/composition/index.ts` y la línea de resumen de `scripts/seed.ts` (`design.md > 7`).
    Si T10 está en curso, este cambio de la composición va en un commit propio para no pisarse.
  - `tests/unit/identity/seed/seed-initial-access.test.ts`: `platform-only` no llama a
    `credentials`, no lee ni crea empresa ni Administrador y sí crea roles, permisos y Maestro;
    `full` igual que hoy.
  - `tests/unit/identity/seed/seed-scope-env.test.ts`: `production`, ` production `, `preview`,
    `development`, vacío y ausente.
  - `tests/integration/identity/identity-seed.int.test.ts`: dos corridas `platform-only` sobre una
    base con QuimiCloud y su Administrador; nada se borra ni cambia.
  - `docs/architecture.md`: fila `SEED_ADMIN_*` de `Variables por entorno` y nota en `## Despliegue
    a produccion`.
  - **Hecho:** los tres tests verdes; `tests/unit/identity/seed/deploy-hook.test.ts`,
    `tests/unit/scripts/build.test.ts`, `guard-variables-por-entorno` y
    `guard-despliegue-produccion` siguen verdes sin cambios.

### Cierre

- [ ] **T12 · Cierre.** Depende de T10 y T11.
  - Mapa `R<n> → test` completo en `progress/impl_QC-162-gestion-de-empresas.md`
    (`design.md > 9`).
  - Repetir `node scripts/archivos-en-vuelo.mjs --candidata QC-162`.
  - **Hecho:** `./init.sh` en verde; ningún `R<n>` sin test.

## Archivos esperados

Añadidos por el leader el 2026-10-13 (bloqueo de la Tanda A, enmiendas mecánicas a tests cerrados):

- `tests/unit/errores/catalogo.test.ts` (recuento 88 → 92, con comentario)
- `tests/guards/guard-identificador-de-request.test.ts` (`20261014120000_companies_management` al final de `MIGRACIONES_ESPERADAS`)
- `tests/unit/proveedores/module-contract.test.ts` (relaciones de `User`: + `companyEvents`)
- `tests/unit/identity/schema/account-status-schema.test.ts` (ídem)
- `tests/unit/identity/credential-policy-contract.test.ts` (ídem)
- `tests/unit/identity/schema/identity-schema.test.ts` (ídem; `CompanyEvent` fuera del caso R12: un historial no es tabla intermedia)
- `tests/unit/identity/credencial/scope.test.ts` (`create-company.ts` en `EMISORES_LEGITIMOS`, con comentario)

Añadidos por backend_dev en la Tanda C (enmiendas mecánicas autorizadas por el leader, solo añaden a una lista cerrada):

- `tests/unit/identity/account-status-scope.test.ts` (`company-prisma.ts` en `SITIOS_PERMITIDOS`: el Administrador nace `pending`)
- `tests/unit/pedidos/module-contract.test.ts` (`order-company-stats-prisma.ts` en `DUENOS_DE_ORDERS` y `DUENOS_DEL_CLIENTE`)


- `db/schema.prisma`
- `db/migrations/20261014120000_companies_management/migration.sql`
- `db/migrations/20261014120000_companies_management/down.sql`
- `tests/unit/identity/schema/companies-management-migration.test.ts`
- `lib/modules/errores/domain/error-codes.ts`
- `lib/modules/errores/domain/error-catalog.ts`
- `lib/modules/identity/domain/errors.ts`
- `lib/modules/identity/domain/company-input.ts`
- `lib/modules/identity/domain/company-queryable.ts`
- `lib/modules/identity/domain/company-event.ts`
- `lib/modules/identity/domain/company-view.ts`
- `lib/modules/identity/domain/seed-scope.ts`
- `tests/unit/identity/companies/company-input.test.ts`
- `tests/unit/identity/companies/company-event.test.ts`
- `lib/modules/identity/ports/company-repository.ts`
- `lib/modules/identity/ports/company-open-orders-counter.ts`
- `lib/modules/identity/domain/create-company.ts`
- `lib/modules/identity/domain/update-company.ts`
- `lib/modules/identity/domain/delete-company.ts`
- `lib/modules/identity/domain/reactivate-company.ts`
- `lib/modules/identity/domain/list-companies.ts`
- `lib/modules/identity/domain/get-company.ts`
- `lib/modules/identity/domain/get-company-deletion-impact.ts`
- `lib/modules/identity/domain/list-company-events.ts`
- `lib/modules/identity/index.ts`
- `tests/unit/identity/companies/create-company.test.ts`
- `tests/unit/identity/companies/update-company.test.ts`
- `tests/unit/identity/companies/delete-company.test.ts`
- `tests/unit/identity/companies/reactivate-company.test.ts`
- `tests/unit/identity/companies/list-companies.test.ts`
- `tests/unit/identity/companies/get-company.test.ts`
- `tests/unit/identity/companies/get-company-deletion-impact.test.ts`
- `tests/unit/identity/companies/list-company-events.test.ts`
- `lib/modules/identity/adapters/driven/persistence/company-prisma.ts`
- `lib/modules/identity/adapters/driven/persistence/user-admin-prisma.ts`
- `tests/integration/identity/company.int.test.ts`
- `tests/unit/identity/companies/company-events-append-only.test.ts`
- `tests/integration/aislamiento.json`
- `lib/modules/pedidos/domain/order-classification.ts`
- `lib/modules/pedidos/adapters/driven/persistence/order-company-stats-prisma.ts`
- `tests/integration/pedidos/order-company-stats.int.test.ts`
- `lib/modules/identity/ports/company-country-repository.ts`
- `lib/modules/identity/domain/set-company-country.ts`
- `lib/modules/identity/adapters/driven/persistence/company-country-prisma.ts`
- `tests/unit/identity/set-company-country.test.ts`
- `tests/integration/identity/company-country.int.test.ts`
- `lib/composition/index.ts`
- `lib/modules/identity/adapters/driving/company-actions.ts`
- `tests/unit/identity/company-actions.test.ts`
- `tests/unit/identity/roles/maestro-rol.test.ts`
- `lib/modules/identity/domain/seed-initial-access.ts`
- `lib/modules/identity/adapters/driven/config/seed-scope-env.ts`
- `scripts/seed.ts`
- `tests/unit/identity/seed/seed-initial-access.test.ts`
- `tests/unit/identity/seed/seed-scope-env.test.ts`
- `tests/integration/identity/identity-seed.int.test.ts`
- `docs/architecture.md`
- `progress/impl_QC-162-gestion-de-empresas.md`
