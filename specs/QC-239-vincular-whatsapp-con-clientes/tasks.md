# QC-239 — vincular-whatsapp-con-clientes · tasks.md

> Orden: T1 → T2 → (T3 ∥ T4) → T5 → T6 → T7 → (T8 ∥ T9) → T10 → T11 → T12.
> `[P]` = puede ir en paralelo con las otras `[P]` de su mismo nivel.
> Cada tanda cierra con `pnpm run typecheck`, `pnpm run lint`,
> `pnpm exec vitest related --run <archivos tocados>` y `pnpm exec vitest run guard`.
> Las decisiones del humano del 2026-10-20 (principal anterior a secundario, desvincular quita el
> número, reconversión de `duplicate`, acciones de teléfonos en QC-303, vincular reemplaza el
> teléfono antiguo) ya están en `requirements.md` y en `design.md`.

## [x] T1 — Esquema y migración
- `db/schema.prisma`: `PhoneNumber`, `CustomerPhoneNumber` (`/// @module clientes`) y las tres
  columnas de `WhatsappContact` (design § 2). Reescribir el `///` de `Customer`: ya no hay índice
  único de teléfono.
- `db/migrations/20261020120000_customer_phone_numbers/migration.sql` y `down.sql` (design § 2.4).
- Tests: `tests/unit/clientes/schema/customer-phone-numbers-migration.test.ts` y
  `tests/integration/clientes/customer-phone-numbers-migration.int.test.ts` (R1, R3, R5, R6, R47,
  R48). Ajustar `customers-phone-migration.test.ts`/`.int.test.ts` al índice retirado.
- **Hecho:** UP → DOWN → UP verde en la base de test. El caso de duplicados del DOWN, verde.
  `guard-empresa-en-esquema` y `guard-rls-force`, verdes.

## [x] T2 — Dominio puro de números (depende de T1)
- `waIdCandidates` en `phone-matches-wa-id.ts`, `parseWaIdPhone` en `customer-phone.ts`, y sus
  exportaciones en el barrel.
- Tests: `phone-matches-wa-id.test.ts` (propiedad, R19) y `customer-phone.test.ts` (R30).
- **Hecho:** tests verdes; `guard-arquitectura-modulos` verde.

## [x] T3 [P] — `clientes`: puertos, teléfonos y unidad de trabajo (depende de T2)
- Puertos `customer-phone-repository.ts`, `customer-write-repository.ts` y
  `customer-unit-of-work.ts`. `customer-repository.ts` pierde `create`/`updateAlive` y
  `'duplicate_phone'`.
- `domain/customer-phone-links.ts` (design § 5.4) y su fábrica en el barrel.
- Adaptadores: `customer-phone-prisma.ts`, `customer-unit-of-work-prisma.ts`, `company-scope.ts`
  (+2 envolturas) y `customer-prisma.ts` (con `db`, sin unicidad, `before`/`after`).
- Tests: `customer-phone-links.test.ts` (R10 con el anterior degradado a secundario, R11, R12,
  R27–R31, R34, R35) y
  `customer-phone-numbers.int.test.ts` (R2–R4, R17, R45).
- **Hecho:** tests verdes; `guard-ambito-empresa-clientes` tensada y verde, con sus casos de
  sensibilidad.

## [x] T4 [P] — `integraciones`: regla, puertos y adaptador de contactos (depende de T2)
- `domain/whatsapp-contact-link.ts`, `domain/refresh-whatsapp-contact-links.ts` y
  `domain/whatsapp-contact-input.ts`; `actor.ts` (`addons`, `requireCustomerLinkPermission`);
  `errors.ts` (+3).
- Puertos `whatsapp-contact-repository.ts`, `customer-phone-owners.ts`, `customer-phone-links.ts` y
  `whatsapp-contact-unit-of-work.ts`.
- Adaptadores `whatsapp-contact-prisma.ts` y `whatsapp-contact-unit-of-work-prisma.ts`.
- Tests: `whatsapp-contact-link.test.ts` y `refresh-whatsapp-contact-links.test.ts` (R15–R18,
  R21–R25); dobles en `whatsapp-doubles.ts`.
- **Hecho:** tests verdes; `guard-ambito-empresa-integraciones` tensada y verde.

## [x] T5 — Alta y edición por la unidad de trabajo; retirar el duplicado (depende de T3 y T4)
- `create-customer.ts`, `update-customer.ts` (design § 5.5); `errors.ts` y barrel sin
  `CustomerDuplicatePhoneError`.
- `error-codes.ts`/`error-catalog.ts` sin `customer_duplicate_phone`, con su nota fechada.
- `customer-form.tsx` sin el `case` del duplicado.
- Composición: `customerUnitOfWork` y `whatsappLinkRefreshOn` (design § 7).
- Tests ajustados (design § 12.2), `customer-service.test.ts` (R7, R9, R11, R21) y el invariante R8
  en `customer-phone-numbers.int.test.ts`.
- **Hecho:** tests de `clientes`, `catalogo.test.ts` y `customer-phone-field.test.tsx` verdes.

## T6 — Relleno sin duplicados, reconversión de `duplicate` y principal (depende de T5)
- `legacy-phone-backfill.ts` (sin `taken`; `LegacyPhoneRow.phoneCountry`), `backfill-legacy-phones.ts`,
  `ports/legacy-phone-repository.ts` (resumen con `reconverted`), `legacy-phone-prisma.ts`
  (candidatas con `phone_issue` nulo o `duplicate`) y `scripts/backfill-customer-phones.ts`
  (design § 5.6, § 5.7).
- Tests: `legacy-phone-backfill.test.ts`, `legacy-phone-prisma.test.ts` y
  `legacy-phone-backfill.int.test.ts` (R13, R49, R8).
- **Hecho:** verdes. Tras una pasada no queda ningún `duplicate` vivo y la segunda pasada no cambia
  nada (R49; R27 de QC-236 sigue verde). Las `invalid_format` siguen intactas.

## T7 — Vincular, desvincular, bloquear (depende de T5)
- `link-whatsapp-contact.ts`, `unlink-whatsapp-contact.ts` y `set-whatsapp-contact-blocked.ts`;
  barrel de `integraciones`; composición (`whatsappContactUnitOfWork`, tres miembros nuevos).
- Tests unitarios (R26, R30–R38, R43, R44) y `whatsapp-contact-links.int.test.ts` (R10 de punta
  a punta, R21–R24, R26–R29, R33–R35, R42, R45).
- **Hecho:** verdes; `module-shape.test.ts` actualizado y verde.

## T8 [P] — Recepción con bloqueo y vínculo (depende de T7)
- `whatsapp-inbox-prisma.ts` (`createWhatsappInboxRecorder`), `ports/whatsapp-inbox-repository.ts`,
  `receive-whatsapp-webhook.ts` y su cableado.
- Tests: `whatsapp-inbox-prisma.int.test.ts` (R15–R20, R39–R41), `receive-whatsapp-webhook.test.ts`
  y `whatsapp-webhook-route.int.test.ts` (R39, R15).
- **Hecho:** verdes; los tests de QC-238 siguen verdes sin relajarse.

## T9 [P] — Server Actions (depende de T7)
- `adapters/driving/whatsapp-contact-actions.ts` (design § 8).
- Tests: `whatsapp-contact-actions.test.ts` (R46) y `authorization.test.ts` de integraciones (R43,
  R44).
- **Hecho:** verdes; el test del conteo de lecturas de sesión, verde.

## T10 — Restricciones de contactos y aislamiento (depende de T8)
- `whatsapp-messages-constraints.int.test.ts` (R47, CHECK). Entradas nuevas en
  `tests/integration/aislamiento.json` con su forma y su motivo.
- **Hecho:** verdes.

## T11 — E2E de teléfono de cliente (depende de T5)
- `e2e/clientes-telefono.spec.ts`: el caso de duplicado pasa a «se guarda» (R7).
- **Hecho:** `pnpm exec playwright test e2e/clientes-telefono.spec.ts` verde.

## T12 — Cierre
- `progress/impl_QC-239.md` con el mapa `R<n> -> test` (R1–R49) y la lista de tests de QC-236
  ajustados.
- `./init.sh` en verde.
- **Hecho:** cada `R<n>` tiene su test; ninguna guardia se relajó.

## Archivos esperados

- `db/schema.prisma`
- `db/migrations/20261020120000_customer_phone_numbers/migration.sql`
- `db/migrations/20261020120000_customer_phone_numbers/down.sql`
- `lib/modules/clientes/index.ts`
- `lib/modules/clientes/domain/phone-matches-wa-id.ts`
- `lib/modules/clientes/domain/customer-phone.ts`
- `lib/modules/clientes/domain/customer-phone-links.ts`
- `lib/modules/clientes/domain/create-customer.ts`
- `lib/modules/clientes/domain/update-customer.ts`
- `lib/modules/clientes/domain/customer-view.ts`
- `lib/modules/clientes/domain/errors.ts`
- `lib/modules/clientes/domain/legacy-phone-backfill.ts`
- `lib/modules/clientes/domain/backfill-legacy-phones.ts`
- `lib/modules/clientes/ports/customer-repository.ts`
- `lib/modules/clientes/ports/customer-write-repository.ts`
- `lib/modules/clientes/ports/customer-phone-repository.ts`
- `lib/modules/clientes/ports/customer-unit-of-work.ts`
- `lib/modules/clientes/ports/legacy-phone-repository.ts`
- `lib/modules/clientes/adapters/driven/persistence/company-scope.ts`
- `lib/modules/clientes/adapters/driven/persistence/customer-prisma.ts`
- `lib/modules/clientes/adapters/driven/persistence/customer-phone-prisma.ts`
- `lib/modules/clientes/adapters/driven/persistence/customer-unit-of-work-prisma.ts`
- `lib/modules/clientes/adapters/driven/persistence/legacy-phone-prisma.ts`
- `lib/modules/integraciones/index.ts`
- `lib/modules/integraciones/domain/actor.ts`
- `lib/modules/integraciones/domain/errors.ts`
- `lib/modules/integraciones/domain/whatsapp-contact-link.ts`
- `lib/modules/integraciones/domain/whatsapp-contact-input.ts`
- `lib/modules/integraciones/domain/refresh-whatsapp-contact-links.ts`
- `lib/modules/integraciones/domain/link-whatsapp-contact.ts`
- `lib/modules/integraciones/domain/unlink-whatsapp-contact.ts`
- `lib/modules/integraciones/domain/set-whatsapp-contact-blocked.ts`
- `lib/modules/integraciones/domain/receive-whatsapp-webhook.ts`
- `lib/modules/integraciones/ports/whatsapp-contact-repository.ts`
- `lib/modules/integraciones/ports/customer-phone-owners.ts`
- `lib/modules/integraciones/ports/customer-phone-links.ts`
- `lib/modules/integraciones/ports/whatsapp-contact-unit-of-work.ts`
- `lib/modules/integraciones/ports/whatsapp-inbox-repository.ts`
- `lib/modules/integraciones/adapters/driven/persistence/whatsapp-contact-prisma.ts`
- `lib/modules/integraciones/adapters/driven/persistence/whatsapp-contact-unit-of-work-prisma.ts`
- `lib/modules/integraciones/adapters/driven/persistence/whatsapp-inbox-prisma.ts`
- `lib/modules/integraciones/adapters/driving/whatsapp-contact-actions.ts`
- `lib/modules/errores/domain/error-codes.ts`
- `lib/modules/errores/domain/error-catalog.ts`
- `lib/composition/index.ts`
- `app/(private)/clientes/components/customer-form.tsx`
- `scripts/backfill-customer-phones.ts`
- `tests/unit/clientes/phone-matches-wa-id.test.ts`
- `tests/unit/clientes/customer-phone.test.ts`
- `tests/unit/clientes/customer-phone-links.test.ts`
- `tests/unit/clientes/customer-service.test.ts`
- `tests/unit/clientes/customer-actions.test.ts`
- `tests/unit/clientes/authorization.test.ts`
- `tests/unit/clientes/legacy-phone-backfill.test.ts`
- `tests/unit/clientes/legacy-phone-prisma.test.ts`
- `tests/unit/clientes/schema/customer-phone-numbers-migration.test.ts`
- `tests/unit/clientes/schema/customers-phone-migration.test.ts`
- `tests/unit/clientes/schema/customers-schema.test.ts`
- `tests/integration/clientes/customer-phone-numbers.int.test.ts`
- `tests/integration/clientes/customer-phone-numbers-migration.int.test.ts`
- `tests/integration/clientes/customer-phone-uniqueness.int.test.ts`
- `tests/integration/clientes/customer-phone-shared.int.test.ts`
- `tests/integration/clientes/customer-repository.int.test.ts`
- `tests/integration/clientes/list-query-customers.int.test.ts`
- `tests/integration/clientes/legacy-phone-backfill.int.test.ts`
- `tests/integration/clientes/customers-phone-migration.int.test.ts`
- `tests/unit/integraciones/module-shape.test.ts`
- `tests/unit/integraciones/whatsapp/whatsapp-doubles.ts`
- `tests/unit/integraciones/whatsapp/whatsapp-contact-link.test.ts`
- `tests/unit/integraciones/whatsapp/refresh-whatsapp-contact-links.test.ts`
- `tests/unit/integraciones/whatsapp/link-whatsapp-contact.test.ts`
- `tests/unit/integraciones/whatsapp/unlink-whatsapp-contact.test.ts`
- `tests/unit/integraciones/whatsapp/set-whatsapp-contact-blocked.test.ts`
- `tests/unit/integraciones/whatsapp/whatsapp-contact-actions.test.ts`
- `tests/unit/integraciones/whatsapp/authorization.test.ts`
- `tests/unit/integraciones/whatsapp/receive-whatsapp-webhook.test.ts`
- `tests/integration/integraciones/whatsapp-contact-links.int.test.ts`
- `tests/integration/integraciones/whatsapp-inbox-prisma.int.test.ts`
- `tests/integration/integraciones/whatsapp-webhook-route.int.test.ts`
- `tests/integration/integraciones/whatsapp-messages-constraints.int.test.ts`
- `tests/integration/aislamiento.json`
- `tests/guards/guard-ambito-empresa-clientes.test.ts`
- `tests/guards/guard-ambito-empresa-integraciones.test.ts`
- `tests/unit/errores/catalogo.test.ts`
- `tests/ui/clientes/customer-phone-field.test.tsx`
- `e2e/clientes-telefono.spec.ts`
- `progress/impl_QC-239.md`
