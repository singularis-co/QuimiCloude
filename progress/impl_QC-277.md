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

### Rojos de listas cerradas de permisos: resuelto (opción A, aprobada por el humano 2026-10-14)
- Primera pasada de `vitest related`: 4 rojos ajenos al spec en `maestro-rol.test.ts`, `empacador-rol.test.ts`,
  `acondicionamiento-rol.test.ts` y `integraciones/module-shape.test.ts`. Esos tests solo dejan nombrar
  ciertos permisos en una lista cerrada de archivos, y `company-addons.ts` los nombra (catálogo escrito a mano, design §2.1).
- Arreglo: `lib/modules/identity/domain/company-addons.ts` entra como archivo permitido, igual que `permissions.ts`.
  Las comprobaciones anti-ceguera siguen: igualdad exacta en maestro; recuento 11 -> 12 en acondicionamiento;
  `arrayContaining` + catálogo en empacador; `toContain(ADDONS_CATALOG)` y un vecino `company-addons-extra.ts` -> false en module-shape.
- Salida tras el arreglo:
  - los 4 archivos: 140 pasados, 0 fallidos, 1 saltado (`ctx.skip` condicional que ya existía);
  - `pnpm run typecheck`: exit 0;
  - `pnpm run lint`: 0 errores, 7 avisos ya existentes en archivos que no se tocaron;
  - `pnpm exec vitest related --run` sobre los 8 archivos de producción de la tanda (schema incluido):
    827/827 archivos, 13349 pasados, 0 fallidos, 14 saltados.
- La migración se re-fechó a `20261014190000_company_addons` porque `20261014180000` lo usa `admin_without_assigned_orders_view`.

### Segunda pasada de la opción A: barrido completo (2026-10-14)
- Barrido: 68 tests que nombran códigos de `company-addons.ts` y recorren el árbol (o usan listas cerradas). Fallaban 2: `tests/unit/clientes/scope.test.ts` (R26, 1 test) y `tests/unit/asignaciones/module-contract.test.ts` (R29 y sus mutaciones, 20 tests).
- Arreglo: `company-addons.ts` entra por ruta exacta, igual que `permissions.ts`. En asignaciones, además: el catálogo de añadidos tiene que leerse y nombrar los 3 códigos, y un vecino `company-addons-extra.ts` sigue vigilado.
- Salida: typecheck exit 0; lint 0 errores y 7 avisos que ya estaban; barrido 68/68 archivos, 1252 pasados y 41 saltados; `vitest run guard` 76/76 archivos, 1066 pasados y 20 saltados.

### Gate local tras la segunda pasada (implementer, 2026-10-14)
- Tests ampliados por la opción A, en total: `tests/unit/identity/roles/maestro-rol.test.ts`,
  `empacador-rol.test.ts`, `acondicionamiento-rol.test.ts`, `tests/unit/integraciones/module-shape.test.ts`,
  `tests/unit/clientes/scope.test.ts` y `tests/unit/asignaciones/module-contract.test.ts`.
- `./init.sh` (rápido): `test:rapido` 115/115 archivos, 1623 pasados, 37 saltados; `== init OK ==`, exit 0.
