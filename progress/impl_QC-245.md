# impl QC-245 — contactos-whatsapp-backend

> Bitácora del implementer. Spec: `specs/QC-245-contactos-whatsapp-backend/` (R1–R63, T1–T17,
> enmienda 1 aprobada el 2026-10-23). Gate completo: `gate-completo` en CI (decisión del humano);
> por tarea se corre typecheck, lint, los tests de la tarea, integración por ruta y guardias.

## Preparación del worktree

`.env` y `.env.local` copiados de la raíz; `pnpm install --frozen-lockfile`, `prisma generate`,
`next typegen`. Sin dependencias nuevas. Línea base: typecheck 0, lint 0 errores (10 avisos ajenos).

## T1 — Permiso `whatsapp.consultar` (R1–R3)

Código en `b71376c4` (WIP), cerrado en el commit de esta entrada.

Archivos:
- `db/migrations/20261024120000_whatsapp_read_permission/{migration,down}.sql` (nuevo)
- `lib/modules/identity/domain/permissions.ts`, `lib/modules/identity/domain/company-addons.ts`
- `tests/unit/identity/schema/whatsapp-read-permission-migration.test.ts` (nuevo)
- `tests/integration/identity/whatsapp-read-permission-migration.int.test.ts` (nuevo) + `tests/integration/aislamiento.json`
- tensados: `tests/unit/identity/permissions.test.ts`, `tests/unit/identity/addons/company-addons.test.ts`,
  `tests/integration/identity/identity-seed.int.test.ts`
- fuera de la lista de archivos del spec, exigidos por la guardia de la lista de migraciones (listas
  escritas a mano de permisos o migraciones): `tests/guards/guard-identificador-de-request.test.ts`,
  `tests/unit/asignaciones/schema/order-assignments-migration.test.ts`,
  `tests/unit/navegacion/qc75-convenciones.test.ts`

Salida (informe de backend_dev, tras verificar el WIP):
- `pnpm run typecheck`: 0 errores
- `pnpm run lint`: 0 errores
- los 9 archivos de test de la tarea: 252 passed, 3 skipped
- `vitest related` sobre lo tocado: 1037 archivos, 17771 passed
- `pnpm exec vitest run guard`: 87/87

## T2 — Migración de esquema `last_read_at` (R14, R42)

Archivos:
- `db/schema.prisma` (una línea en `WhatsappContact`, tras `lastMessageAt`)
- `db/migrations/20261024130000_whatsapp_contacts_last_read/{migration,down}.sql` (nuevo)
- `tests/integration/integraciones/whatsapp-contacts-last-read-migration.int.test.ts` (nuevo) + `tests/integration/aislamiento.json`
- lista a mano de migraciones: `tests/guards/guard-identificador-de-request.test.ts` (las otras dos
  listas que tocó T1 son de permisos, no de migraciones: no cambian)

Salida (backend_dev):
- `pnpm exec prisma validate`: válido; la plantilla de test-db confirma «esquema al día» tras migrar
- `pnpm run typecheck`: 0 errores · `pnpm run lint`: 0 errores (10 avisos ajenos)
- test de la tarea: 6/6 · `vitest related` (schema + test): 1 archivo, 6 passed
- `pnpm exec vitest run guard`: 87/87 (1303 passed, 22 skipped)

## T3 — `CustomerCatalog.findAliveIdsMatchingName` (R10)

Archivos:
- `lib/modules/clientes/domain/customer-catalog.ts` (método al final)
- `lib/modules/clientes/adapters/driven/persistence/customer-catalog-prisma.ts` (`findAliveCustomerIdsMatchingName`)
- `lib/composition/index.ts` (import + una entrada en `buildCustomerCatalog`)
- tests: `tests/integration/clientes/customer-catalog.int.test.ts`, `tests/unit/clientes/customer-catalog.test.ts`,
  `tests/helpers/customer-catalog-double.ts`, `tests/unit/pedidos/order-customer-contract.test-d.ts`
  (lista exacta de claves del contrato: se amplía con la firma nueva)

Salida (backend_dev):
- `pnpm run typecheck`: 0 errores · `pnpm run lint`: 0 errores (10 avisos ajenos)
- tests de la tarea (unit + int): 2 archivos, 22 passed
- `vitest related` (interfaz, adaptador, composición, doble): 483 archivos, 8264 passed, 2 skipped
- `pnpm exec vitest run guard`: 87/87

## Mapa R → test

| R | Test (caso) |
|---|---|
| R1 | `permissions.test.ts` > «el permiso whatsapp.consultar» (5 casos R1: entrada exacta, catálogo previo + la nueva, Administrador la recibe, ningún otro rol, JSDoc); `whatsapp-read-permission-migration.test.ts` > «R1: ninguna otra migracion nombra whatsapp.consultar», «R1, R2: la fila insertada es exactamente la entrada de PERMISSIONS…», «R1, R2: la asignacion va solo al Administrador…»; `identity-seed.int.test.ts` > «R1, R2: sobre la base ya sembrada salvo whatsapp.consultar…» |
| R2 | `whatsapp-read-permission-migration.int.test.ts` > «R1, R2: … el UP crea la fila del catalogo y una sola asignacion, al Administrador», «R2: aplicar el UP dos veces no falla, no duplica…», «R2: sobre una base que ya tiene el permiso…», «R2: el DOWN … deja la base exactamente como antes del UP»; `whatsapp-read-permission-migration.test.ts` > casos R2 estáticos (orden, ON CONFLICT, sin esquema, DOWN acotado) |
| R3 | `company-addons.test.ts` > «R3 — whatsapp.consultar es de integraciones…», «R3 — con integraciones apagado la sesión pierde whatsapp.consultar…» |
| R10 (catálogo) | `customer-catalog.int.test.ts` > «R10: de los ids pedidos devuelve solo los vivos de la empresa que casan por nombre», «R10: misma normalizacion que la busqueda de Clientes…», «R10: un texto sin palabras utiles no filtra por nombre…»; `customer-catalog.test.ts` > 4 casos R10 (firma del contrato, `where` con la misma `searchCondition`, texto sin palabras, ids vacíos/no uuid) |
| R14 | `whatsapp-contacts-last-read-migration.int.test.ts` > «R14: el contacto tiene una unica columna last_read_at, timestamptz(6) opcional y sin valor por defecto», «R14: un contacto nuevo nace sin marca y la marca guarda microsegundos» |
| R42 | `whatsapp-contacts-last-read-migration.int.test.ts` > «R42: existe exactamente una carpeta de la migracion, con su down.sql», «R42: el DOWN quita exactamente la columna…», «R42: ida, vuelta e ida dejan exactamente el mismo esquema», «R42 (sensibilidad): un DOWN sin el DROP COLUMN…» |

Veredicto T2/T3: verdes; sin dependencias nuevas ni preguntas abiertas.
