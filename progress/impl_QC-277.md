# QC-277 — Módulos por empresa · bitácora de implementación

## Tanda 1 (T1–T5) — backend_dev, 2026-10-14

### Archivos creados
- `lib/modules/identity/domain/company-addons.ts` (T1)
- `db/migrations/20261014190000_company_addons/migration.sql` y `down.sql` (T2; re-fechada: `20261014180000` ya lo usa `admin_without_assigned_orders_view`)
- `tests/unit/identity/addons/company-addons.test.ts` (T1)
- `tests/unit/identity/schema/company-addons-migration.test.ts` (T2)

### Archivos modificados
- `lib/modules/identity/index.ts` (barril del catálogo)
- `db/schema.prisma` (`Company.addons String[] @default([])`)
- `lib/modules/identity/adapters/driven/persistence/initial-access-repository-prisma.ts` (T3)
- `lib/modules/identity/ports/session-user-reader.ts`, `adapters/driven/persistence/session-user-prisma.ts` (T4)
- `lib/modules/identity/domain/resolve-session.ts`, `domain/session-user.ts` (T5)
- Tests ampliados: `tests/unit/identity/seed/seed-initial-access.test.ts`,
  `tests/integration/identity/identity-seed.int.test.ts`, `tests/integration/identity/session-user.int.test.ts`,
  `tests/unit/identity/resolve-session.test.ts`
- Fixtures de `SessionUserRecord` (typecheck; `companyAddons: [...ADDONS]` para no cambiar su comportamiento):
  `tests/unit/composition/identity-facade.test.ts`, `tests/unit/identity/end-other-sessions.test.ts`,
  `tests/unit/identity/end-session.test.ts`, `tests/unit/identity/resolve-session-user.test.ts`,
  `tests/unit/identity/session-once-per-request-actions.test.ts`, `tests/unit/identity/session-once-per-request-render.test.tsx`
- Proyección con `addons` en las aserciones `toEqual` de `resolve-session.test.ts` y `resolve-session-user.test.ts`
- `tests/guards/guard-identificador-de-request.test.ts`: `MIGRACIONES_ESPERADAS` gana la migración nueva (lo pide la propia guardia)

### Mapa R → test (tanda 1)
| R | Test |
|---|---|
| R1, R2, R3 | `tests/unit/identity/addons/company-addons.test.ts` |
| R4 | `company-addons.test.ts` (`effectiveAddons`) |
| R5, R6, R38 | `tests/unit/identity/schema/company-addons-migration.test.ts` (+ aplicar/revertir manual, abajo) |
| R7 | `seed-initial-access.test.ts` (dos casos R7) + `identity-seed.int.test.ts` (QC-277 R7) |
| R8 | `resolve-session.test.ts` (bloque «recorte por añadidos») + `session-user.int.test.ts` (QC-277 R8, dos casos) |
| R10, R11 | `resolve-session.test.ts` |
| R14 (fallo cerrado de `assertAddon`/`hasAddon`) | `company-addons.test.ts` |

### Migración: aplicar / revertir
Base desechable `qc277_scratch` (copia de una plantilla de test, ya borrada): `prisma migrate deploy`
aplica las dos pendientes; `companies.addons` = `text[] NOT NULL DEFAULT ARRAY[]::text[]` y QuimiCloud
queda con los cinco; `prisma migrate diff` no muestra diferencia en `addons`; `down.sql` quita la
columna; `pnpm run db:rollback` revierte; `migrate deploy` la reaplica. La base de desarrollo
`QuimiCloude` no se tocó (compartida; ya va atrasada en `20261014180000`, que trae `dev`).

### Verificación
- `pnpm run typecheck`: verde.
- `pnpm run lint`: 0 errores, 7 avisos en archivos ajenos.
- Tests tocados (12 archivos, unit + integración): 305 pasados, 0 fallidos.
- `pnpm exec vitest run guard`: 76 archivos, 1066 pasados, 20 omitidos, 0 fallidos.
- `pnpm exec vitest related --run <7 archivos de producción>`: 827 archivos, 13345 pasados, **4 fallidos**:
  `tests/unit/identity/roles/{maestro,empacador,acondicionamiento}-rol.test.ts` y
  `tests/unit/integraciones/module-shape.test.ts`. Son barridos que solo permiten nombrar
  `empresas.*`, `terminados.consultar`, `acondicionamiento.modificar` e `integraciones.modificar` en
  rutas exactas; `CORE_PERMISSIONS`/`ADDON_PERMISSIONS` (escritos a mano según design § 2.1) los
  nombran en `company-addons.ts`. `design.md > 10.3` no prevé esta enmienda. Ninguno está en
  `tests/baseline-rojos.json`. **Bloqueado a la espera de decisión.**

### Veredicto
T1–T5 implementados y verdes en lo suyo; 4 barridos de otras fichas en rojo por un hueco del spec, pendiente de decisión humana.

### Pendiente de decisión humana (implementer)
- `vitest related` da 4 rojos ajenos al spec: `tests/unit/identity/roles/maestro-rol.test.ts`,
  `empacador-rol.test.ts`, `acondicionamiento-rol.test.ts` y `tests/unit/integraciones/module-shape.test.ts`.
  Solo dejan nombrar `empresas.*`, `terminados.consultar`, `acondicionamiento.modificar` e
  `integraciones.modificar` en una lista cerrada de archivos; `company-addons.ts` los nombra
  (CORE_PERMISSIONS/ADDON_PERMISSIONS escritos a mano, design §2.1). No están en `tests/baseline-rojos.json`.
  Propuesta: añadir `lib/modules/identity/domain/company-addons.ts` a la lista permitida de los cuatro,
  como `permissions.ts`. design §10.3 solo enmienda `maestro-rol` (para T15). T1 queda sin `[x]` hasta decidir.
- Migración re-fechada a `20261014190000_company_addons` (`20261014180000` lo usa `admin_without_assigned_orders_view`).
