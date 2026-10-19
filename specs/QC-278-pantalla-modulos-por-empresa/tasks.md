# QC-278 — pantalla-modulos-por-empresa · tasks.md

> Orden: T1–T3 en paralelo; T4 tras T1–T3; T5 tras T4; T6 tras T5; T7 al final. Cada task cierra
> con `pnpm run typecheck`, `pnpm run lint` y `pnpm exec vitest related --run <archivos de la
> task>` (`docs/perfil-agentes.md > Todos los agentes`). Un commit por task (`feat(QC-278): …` /
> `test(QC-278): …`).
>
> **Enmienda contra dev (2026-10-19).** QC-166 ya está en la rama (merge `a01b5c11`): T1 y T6 no
> esperan a nadie; los tests van a las carpetas de QC-166 (`tests/ui/maestro/`,
> `tests/unit/maestro/`); T6 pone siempre el montaje, reescribe dos casos de QC-166 R30 y da de
> alta el E2E en su guardia. Detalle y citas: `design.md > 0` (E1–E16).

## Tasks

- [x] **T1 [P] — Etiquetas y textos puros** (R5, R10, R12, R15, R19)
  - `addon-labels.ts`: `ADDON_LABELS` como `Record<Addon, …>` con `name` tomado de `ADDON_NAMES`
    (`lib/shared/ui/addon-names.ts`, ya en `dev`; sin repetir nombres), descripciones de la
    pregunta 1 (cerrada) e iconos de `lucide-react`; `changedAddons(prev, next)` y
    `successMessage(changed, enabled)` (singular y plural, pregunta 4 cerrada).
  - `addon-off-consequences.ts`: `offConsequences(addons, view)` (design § 4.3, pregunta 3 cerrada).
  - `core-modules.ts`: `CORE_MODULE_NAMES`, los 11 del tablero (pregunta 2 cerrada).
  - Test: `tests/unit/maestro/addon-labels.test.ts`.
  - **Hecho:** los casos R5, R10, R12 y R15 del mapa (design § 7.1) pasan; quitar una clave de
    `ADDON_LABELS` rompe el typecheck; `addon-labels.ts` no contiene ningún nombre de añadido
    literal (el test R5 compara `ADDON_LABELS[a].name` con `ADDON_NAMES[a]`).

- [x] **T2 [P] — `CoreModuleChips`** (R19)
  - `core-module-chips.tsx` (Server): `h2` «Núcleo», subtítulo, una `Badge` `outline` con `Lock`
    por cada `CORE_MODULE_NAMES`. Depende de `core-modules.ts` (si T1 no ha terminado, se crea aquí
    y T1 lo completa).
  - Test: `tests/ui/maestro/core-module-chips.test.tsx`.
  - **Hecho:** «R19: once fichas…» pasa; ningún `role="switch"` ni `button` en la sección.

- [x] **T3 [P] — `ModulesSkeleton`** (R3)
  - `modules-skeleton.tsx`: `role="status"`, `aria-busy="true"`, `aria-label` «Cargando los
    módulos…», `data-testid="company-modules-skeleton"`, `Spinner` + el texto, cuatro `Skeleton`
    de 68 px (patrón de `CompanyHistorySkeleton`, `company-history-panel.tsx:207-224`).
  - **Hecho:** cubierto por el caso R3 de T5.

- [x] **T4 — `AddonSwitchList`** (R5–R18, R20–R24) · depende de T1
  - `addon-switch-list.tsx` (`'use client'`), según design § 4.2–4.4: vista local inicializada con
    `initialView`, escritura única en vuelo, diálogo `ConfirmDialog` controlado con sus `testIds`,
    `ErrorAlert` por fila o bajo los botones, `toast.success`, aviso `Notice` de baja, rejilla
    mobile-first.
  - Test: `tests/ui/maestro/addon-switch-list.test.tsx` (acciones con `vi.mock` de
    `@/lib/modules/identity/adapters/driving/company-actions`, como
    `tests/ui/maestro/company-detail-page.test.tsx:51-64`; `sonner` simulado).
  - **Hecho:** todos los casos R5–R18 y R20–R24 del mapa pasan, incluido el estático de R22 (no
    importa `effectiveAddons` ni `ADDON_REQUIRES`).

- [ ] **T5 — `ModulesSection`, `CompanyModulesTab` y barrel** (R1–R4, R20) · depende de T2, T3, T4
  - `modules-section.tsx` (Server async): una llamada a `getCompanyAddonsAction`; error →
    `ErrorState` «No pudimos cargar los módulos» con `testId="company-modules-error"`,
    `retry={{ kind: 'refresh' }}` y `retryTestId="company-modules-retry"`; éxito →
    `AddonSwitchList` + `CoreModuleChips`.
  - `company-modules-tab.tsx`: `Suspense` con `ModulesSkeleton`; props de design § 3; sin
    `tabpanel` propio.
  - `index.ts` de `components/modulos/` (sin `'use client'`).
  - Test: `tests/ui/maestro/company-modules-tab.test.tsx`.
  - **Hecho:** casos R1–R4 y R20 (tab) pasan, con el estático de R1 de design § 7 (ningún archivo
    de `components/modulos/` importa `@/lib/composition`, `next/headers`, `assertPermission` ni
    `requirePagePermission`); el barrel solo exporta `CompanyModulesTab` y su tipo.

- [ ] **T6 — Montaje en el detalle, test de QC-166 y E2E** (R1, R25) · depende de T5
  - `app/(private)/maestro/empresas/[id]/page.tsx`: sustituir el comentario de la l. 120 por la
    línea de montaje de design § 3 (`isDeleted={company.status === 'deleted'}`,
    `canModify={canModify}`) y añadir `CompanyModulesTab` al import de `'./components'`
    (l. 17-31). Nada más de la página cambia.
  - `app/(private)/maestro/empresas/[id]/components/index.ts`: `export * from './modulos';`.
  - `tests/ui/maestro/company-detail-page.test.tsx`: reescribir los dos casos de QC-166 R30
    (l. 240-246 y 248-253) según design § 7 (enmienda E5): el panel «Módulos» monta la pestaña con
    las cuatro props, y `page.tsx` no importa ni llama a `getCompanyAddonsAction`. Los demás casos
    del archivo no se tocan.
  - `e2e/maestro-modulos.spec.ts` (design § 7.2), con `maestroCredentials`,
    `deleteFixtureCompanies`, `createFixtureUser`, `loginAndLand` y `maestroCompanyRoute`.
  - `tests/guards/guard-identificador-de-request.test.ts`: alta de `'maestro-modulos.spec.ts'` en
    `E2E_ESPERADOS` con su comentario de motivo, como las entradas de QC-166 (l. 480-502).
  - Correr `pnpm exec playwright test e2e/maestro-modulos.spec.ts` y pegar la salida en
    `progress/impl_QC-278-pantalla-modulos-por-empresa.md`.
  - **Hecho:** `company-detail-page.test.tsx` entero en verde; `pnpm exec vitest run guard` en
    verde (incluida `guard-identificador-de-request`); el E2E pasa en Chromium y WebKit;
    verificación manual en 390 px y 768 px contra `MaestroEmpresaMovil.dc.html` y
    `MaestroEmpresaTablet.dc.html` anotada en el `impl`.

- [ ] **T7 — Cierre** · depende de T6
  - Mapa `R<n> → test` en `progress/impl_QC-278-pantalla-modulos-por-empresa.md`.
  - Guardias (`pnpm exec vitest run guard`) y `./init.sh` en verde.
  - **Hecho:** las 25 filas del mapa tienen test que pasa; ningún componente de esta ficha en
    `components/shared` ni en el catálogo (design > Lo que ya existe).

## Archivos esperados

Nuevos:

- `app/(private)/maestro/empresas/[id]/components/modulos/index.ts`
- `app/(private)/maestro/empresas/[id]/components/modulos/company-modules-tab.tsx`
- `app/(private)/maestro/empresas/[id]/components/modulos/modules-section.tsx`
- `app/(private)/maestro/empresas/[id]/components/modulos/modules-skeleton.tsx`
- `app/(private)/maestro/empresas/[id]/components/modulos/addon-switch-list.tsx`
- `app/(private)/maestro/empresas/[id]/components/modulos/core-module-chips.tsx`
- `app/(private)/maestro/empresas/[id]/components/modulos/addon-labels.ts`
- `app/(private)/maestro/empresas/[id]/components/modulos/addon-off-consequences.ts`
- `app/(private)/maestro/empresas/[id]/components/modulos/core-modules.ts`
- `tests/unit/maestro/addon-labels.test.ts`
- `tests/ui/maestro/core-module-chips.test.tsx`
- `tests/ui/maestro/addon-switch-list.test.tsx`
- `tests/ui/maestro/company-modules-tab.test.tsx`
- `e2e/maestro-modulos.spec.ts`
- `progress/impl_QC-278-pantalla-modulos-por-empresa.md`

Modificados (de QC-166, ya en `dev`; los pone esta ficha en T6):

- `app/(private)/maestro/empresas/[id]/page.tsx`
- `app/(private)/maestro/empresas/[id]/components/index.ts`
- `tests/ui/maestro/company-detail-page.test.tsx`

Modificados (guardia compartida, una entrada):

- `tests/guards/guard-identificador-de-request.test.ts`

Solo se importan (de QC-166; esta ficha no los edita, se listan para que el detector de
choques vea la dependencia):

- `lib/shared/ui/addon-names.ts`
- `e2e/helpers/maestro.ts`
