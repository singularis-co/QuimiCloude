# QC-235 — País de la empresa · tasks

Spec: `requirements.md` (R1–R26) y `design.md`. Tablero: `docs/diseno/canvas/CountrySelect.dc.html`.
Cada task cierra con `pnpm run typecheck`, `pnpm run lint`, `pnpm exec vitest related --run <archivos>`
y, si toca capas o catálogo, `pnpm exec vitest run guard`. Un commit por task.

## Orden

```
T1 ─┬─ T2 ── T3 ── T4 ── T5 ── T6
    └─ T7 [P] ── T8 [P] ── T9
                              └── T10 (cierre; espera a T6 y T9)
```

Cuando T1 está hecha, la rama de servidor (T2–T6) y la de componente (T7–T9) son independientes.

## Tasks

- [ ] **T1 · Dependencia `libphonenumber-js`** (R12). Bloquea al resto.
  - Verificar los cuatro checks con datos reales (`npm view libphonenumber-js deprecated
    time.modified license version` y descargas semanales de la API de npm). **Si alguno falla,
    parar y devolver al leader. No instalar.**
  - Verificar en el paquete que exporta `getCountries`, `getCountryCallingCode` y el tipo
    `CountryCode` desde la raíz, y ver sus `peerDependencies`. Anotar el tamaño de la metadata
    importada.
  - Escribir la fila en `docs/dependencias.md` (`design.md > 6.3`) con los datos reales e instalar.
  - Añadir `'libphonenumber-js'` a `PURE_PACKAGES` (`tests/guards/guard-arquitectura-modulos.test.ts`).
    Actualizar las dos menciones de paquetes puros en `docs/architecture.md`.
  - Enmendar `tests/unit/identity/usuarios/scope.test.ts`: quitar `libphonenumber-js` de
    `CANDIDATAS_DESCARTADAS` y del JSDoc (`design.md > 6.3`).
  - **Hecho:** la guardia de dependencias aprobadas, la de arquitectura y `scope.test.ts` en verde;
    la fila tiene los cuatro checks con fecha y fuente.

- [ ] **T2 · Columna `companies.country`** (R1, R10, R11). Depende de T1 (solo por el orden de
  commits; no importa la librería).
  - `db/schema.prisma`: `country String? @db.VarChar(2)` en `Company`, sin comentario de ficha.
  - `db/migrations/20261013120000_companies_country/migration.sql` y `down.sql` (`design.md > 2.2`).
  - `tests/unit/identity/schema/companies-country-migration.test.ts`: la columna es nullable, sin
    `DEFAULT` ni backfill; existe el `CHECK` con `^[A-Z]{2}$`; `down.sql` quita exactamente la
    restricción y la columna.
  - **Hecho:** `pnpm run db:migrate` aplica sobre la base de test; el rollback deja `companies` como
    antes; el test está en verde.

- [ ] **T3 · Error `company_not_found`** (R8). Depende de T2.
  - `lib/modules/errores/domain/error-codes.ts` (código y línea de enmienda) y `error-catalog.ts`
    (`'errors.company_not_found': 'La empresa solicitada no existe.'`).
  - `lib/modules/identity/domain/errors.ts`: `CompanyNotFoundError`.
  - **Hecho:** `tests/unit/errores/catalogo.test.ts` en verde sin cambios en sus aserciones.

- [ ] **T4 · Dominio: actor de plataforma, entrada y caso de uso** (R2–R8). Depende de T3.
  - `domain/platform-actor.ts`, `domain/company-country-input.ts`, `domain/set-company-country.ts`,
    `ports/company-country-repository.ts` (`design.md > 3, 4`).
  - Reexportar desde `lib/modules/identity/index.ts` lo que lista `design.md > 5.1`.
  - `tests/unit/identity/set-company-country.test.ts`, con puerto simulado. Un caso por requisito y
    `R<n>` en el nombre:
    - R2: llega `CO` al puerto.
    - R3: `''` → `null` al puerto.
    - R4: actor `null`, sin permisos, solo `empresas.consultar` → `unauthorized`, sin llamar al
      puerto y sin validar.
    - R5: actor sin empresa con `empresas.modificar` → ok.
    - R6: `co`, ` CO`, `COL`, `ZZ` → `invalid_input`.
    - R7: país `null` o ausente, `companyId` no UUID → `invalid_input`.
    - R8: el puerto devuelve `not_found` → `company_not_found`.
  - **Hecho:** test verde; `pnpm exec vitest run guard` verde, con el dominio importando
    `libphonenumber-js` y `zod` solamente.

- [ ] **T5 · Adaptador driven** (R1, R2, R3, R8, R10). Depende de T4.
  - `adapters/driven/persistence/company-country-prisma.ts` (`updateMany` con `deletedAt: null`).
  - `tests/integration/identity/company-country.int.test.ts` (aislamiento `transaccion`; añadirlo
    a `tests/integration/aislamiento.json`):
    - R1: una empresa creada antes de fijar nada tiene `country` `NULL`.
    - R2: fija `CO` y deja intactos `name`, `nameNormalized`, `createdAt` y `deletedAt`.
    - R3: vacía a `NULL`.
    - R8: empresa inexistente o dada de baja → `not_found` y ninguna fila cambia.
    - R10: `'co'`, `'COL'` y `'C1'` por SQL crudo → `23514`, bajo `SAVEPOINT`.
  - **Hecho:** el `.int` en verde contra la base de test; `guard-aislamiento-integracion` en verde.

- [ ] **T6 · Composición y Server Action** (R5, R9). Depende de T5.
  - `lib/composition/index.ts`: `identity.setCompanyCountry`.
  - `lib/modules/identity/adapters/driving/company-actions.ts` (`design.md > 5.2`): actor solo de
    `getSessionUser()`, sin `revalidatePath`, no reexportada desde `index.ts`.
  - `tests/unit/identity/company-actions.test.ts`, con la composición doble que usa
    `maestro-sin-empresa-actions.test.ts`:
    - R9: el actor sale de la sesión y no de la entrada; `getSessionContext` no se llama;
      responde `{ status: 'success' }`; con error del caso de uso devuelve su `code`;
      `revalidatePath` no se llama.
    - R5: usuario de sesión sin empresa con `empresas.modificar` → `success`.
  - **Hecho:** test verde; `maestro-sin-empresa-actions.test.ts` sigue verde sin cambios.

- [ ] **T7 [P] · Datos de países** (R13, R16, R17, R18). Depende de T1.
  - `components/shared/country-options.ts` (`design.md > 7.4`).
  - `tests/unit/shared-ui/country-options.test.ts`:
    - R13: una opción por código de `getCountries()`, orden `localeCompare('es')`, `+1` como
      opciones separadas (CA, US).
    - R16: `peru` → Perú; `MEXICO` → México.
    - R17: `57` y `+57` → Colombia; `1` → incluye CA y US.
    - R18: un texto sin coincidencias → lista vacía; el texto vacío → todas.
  - Fila «sin UI» en `components/shared/CATALOGO.md`.
  - **Hecho:** test verde; `guard-catalogo-de-componentes` en verde.

- [ ] **T8 [P] · Extensiones de piezas existentes** (soporte de R22 y R23). Depende de T1.
  - `components/ui/autocomplete.tsx`: exportar `AutocompleteTrigger` (`design.md > 7.5`).
  - `hooks/use-mobile.ts`: parámetro opcional `breakpoint = 768` (`design.md > 7.6`).
  - Filas de `Autocomplete` y `useIsMobile` en `components/shared/CATALOGO.md`.
  - **Hecho:** los tests que ya existen de `AsyncAutocomplete`, `async-autocomplete-ampliado` y la
    barra lateral siguen verdes; `guard-catalogo-de-componentes` en verde.

- [ ] **T9 · `CountrySelect`** (R13–R26). Depende de T7 y T8.
  - `components/shared/country-select.tsx` según `design.md > 7.3, 7.5, 7.7`, contra el tablero.
  - Verificar en `@base-ui/react` instalado cómo queda `aria-selected` y si el resaltado inicial
    puede ir a la opción elegida. Anotarlo en `progress/impl_QC-235-pais-de-la-empresa.md`
    (`design.md > 7.5`, R21).
  - `tests/unit/shared-ui/country-select.test.tsx` (proyecto `ui`, `matchMedia` simulado a 1024 y
    375 px, `scrollIntoView` espiado). Un caso por requisito:
    - R14: «Sin país» primero con el buscador vacío.
    - R15: disparador `Colombia (+57)` / «Sin país», con `aria-labelledby`, `aria-haspopup` y
      `aria-expanded`.
    - R16 a R18: filtrado en el DOM.
    - R19: elegir llama a `onChange('CO')` o `onChange(null)`, cierra y vacía.
    - R20: las flechas mueven el resaltado; Escape cierra sin `onChange`.
    - R21: el elegido está marcado y desplazado.
    - R22: popup con buscador arriba a 1024 px.
    - R23: hoja con título, «Cerrar» y foco en el buscador a 375 px; cerrar no notifica.
    - R24: deshabilitado no abre.
    - R25: `aria-invalid` y `aria-describedby` → `FieldError`.
    - R26: se monta sin providers ni mocks de servidor, y su fuente no importa `@/lib/modules`,
      `@/lib/composition` ni `'use server'`.
  - Fila `CountrySelect` en `components/shared/CATALOGO.md` con el tablero en «Diseño».
  - **Hecho:** test verde; `guard-catalogo-de-componentes` verde; revisión visual contra el tablero
    a 1440, 820 y 375 px anotada en el `impl`.

- [ ] **T10 · Cierre**. Depende de T6 y T9.
  - Mapa `R<n> → test` completo en `progress/impl_QC-235-pais-de-la-empresa.md`
    (`design.md > 8`).
  - Repetir `node scripts/archivos-en-vuelo.mjs --candidata QC-235`.
  - **Hecho:** `./init.sh` en verde; ningún `R<n>` sin test.

## Archivos esperados

- `package.json`
- `pnpm-lock.yaml`
- `docs/dependencias.md`
- `docs/architecture.md`
- `tests/guards/guard-arquitectura-modulos.test.ts`
- `tests/unit/identity/usuarios/scope.test.ts`
- `db/schema.prisma`
- `db/migrations/20261013120000_companies_country/migration.sql`
- `db/migrations/20261013120000_companies_country/down.sql`
- `tests/unit/identity/schema/companies-country-migration.test.ts`
- `lib/modules/errores/domain/error-codes.ts`
- `lib/modules/errores/domain/error-catalog.ts`
- `lib/modules/identity/domain/errors.ts`
- `lib/modules/identity/domain/platform-actor.ts`
- `lib/modules/identity/domain/company-country-input.ts`
- `lib/modules/identity/domain/set-company-country.ts`
- `lib/modules/identity/ports/company-country-repository.ts`
- `lib/modules/identity/index.ts`
- `tests/unit/identity/set-company-country.test.ts`
- `lib/modules/identity/adapters/driven/persistence/company-country-prisma.ts`
- `tests/integration/identity/company-country.int.test.ts`
- `tests/integration/aislamiento.json`
- `lib/composition/index.ts`
- `lib/modules/identity/adapters/driving/company-actions.ts`
- `tests/unit/identity/company-actions.test.ts`
- `components/shared/country-options.ts`
- `tests/unit/shared-ui/country-options.test.ts`
- `components/ui/autocomplete.tsx`
- `hooks/use-mobile.ts`
- `components/shared/country-select.tsx`
- `tests/unit/shared-ui/country-select.test.tsx`
- `components/shared/CATALOGO.md`
- `progress/impl_QC-235-pais-de-la-empresa.md`
