# QC-278 — pantalla-modulos-por-empresa · tasks.md

> Orden: T1–T3 en paralelo; T4 tras T1–T3; T5 tras T4; T6 tras T5 **y** tras el merge de la ruta
> de QC-166; T7 al final. Cada task cierra con `pnpm run typecheck`, `pnpm run lint` y
> `pnpm exec vitest related --run <archivos de la task>` (`docs/perfil-agentes.md > Todos los
> agentes`). Un commit por task (`feat(QC-278): …` / `test(QC-278): …`).

## Tasks

- [ ] **T1 [P] — Etiquetas y textos puros** (R5, R10, R12, R15, R19) · depende de
  `lib/shared/ui/addon-names.ts` de QC-166 en la rama (integrar `origin/dev` o la rama de QC-166;
  no crear una copia)
  - `addon-labels.ts`: `ADDON_LABELS` como `Record<Addon, …>` con `name` tomado de `ADDON_NAMES`
    (sin repetir nombres), descripciones de la pregunta abierta 1 e iconos de `lucide-react`;
    `changedAddons(prev, next)` y `successMessage(changed, enabled)` (singular y plural, pregunta
    abierta 4).
  - `addon-off-consequences.ts`: `offConsequences(addons, view)` (design § 4.3, pregunta abierta 3).
  - `core-modules.ts`: `CORE_MODULE_NAMES`, los 11 del tablero.
  - Test: `tests/unit/maestro-ui/addon-labels.test.ts`.
  - **Hecho:** los casos R5, R10, R12 y R15 del mapa (design § 7.1) pasan; quitar una clave de
    `ADDON_LABELS` rompe el typecheck; `addon-labels.ts` no contiene ningún nombre de añadido
    literal (el test R5 compara `ADDON_LABELS[a].name` con `ADDON_NAMES[a]`).

- [ ] **T2 [P] — `CoreModuleChips`** (R19)
  - `core-module-chips.tsx` (Server): `h2` «Núcleo», subtítulo, una `Badge` `outline` con `Lock`
    por cada `CORE_MODULE_NAMES`. Depende de `core-modules.ts` (si T1 no ha terminado, se crea aquí
    y T1 lo completa).
  - Test: `tests/unit/maestro-ui/core-module-chips.test.tsx`.
  - **Hecho:** «R19: once fichas…» pasa; ningún `role="switch"` ni `button` en la sección.

- [ ] **T3 [P] — `ModulesSkeleton`** (R3)
  - `modules-skeleton.tsx`: `role="status"`, `Spinner` + «Cargando los módulos…», cuatro
    `Skeleton` de 68 px.
  - **Hecho:** cubierto por el caso R3 de T5.

- [ ] **T4 — `AddonSwitchList`** (R5–R18, R20–R24) · depende de T1
  - `addon-switch-list.tsx` (`'use client'`), según design § 4.2–4.4: vista local inicializada con
    `initialView`, escritura única en vuelo, diálogo `ConfirmDialog` controlado, `ErrorAlert` por
    fila o bajo los botones, `toast.success`, aviso `Notice` de baja, rejilla mobile-first.
  - Test: `tests/unit/maestro-ui/addon-switch-list.test.tsx` (acciones con `vi.mock` de
    `@/lib/modules/identity/adapters/driving/company-actions`; `sonner` simulado).
  - **Hecho:** todos los casos R5–R18 y R20–R24 del mapa pasan, incluido el estático de R22 (no
    importa `effectiveAddons` ni `ADDON_REQUIRES`).

- [ ] **T5 — `ModulesSection`, `CompanyModulesTab` y barrel** (R1–R4, R20) · depende de T2, T3, T4
  - `modules-section.tsx` (Server async): una llamada a `getCompanyAddonsAction`; error →
    `ErrorState` «No pudimos cargar los módulos» con `retry={{ kind: 'refresh' }}`; éxito →
    `AddonSwitchList` + `CoreModuleChips`.
  - `company-modules-tab.tsx`: `Suspense` con `ModulesSkeleton`; props de design § 3.
  - `index.ts` de `components/modulos/` (sin `'use client'`).
  - Test: `tests/unit/maestro-ui/company-modules-tab.test.tsx`.
  - **Hecho:** casos R1–R4 y R20 (tab) pasan; el barrel solo exporta `CompanyModulesTab` y su
    tipo.

- [ ] **T6 — Montaje en el detalle y E2E** (R25) · depende de T5 y de la ruta de QC-166 en `dev`
  - Integrar `origin/dev`. Si la página de QC-166 no monta ya `CompanyModulesTab`, añadir la línea
    de montaje (design § 3) y `export * from './modulos';` en el barrel de la ruta.
  - `e2e/maestro-modulos.spec.ts` (design § 7.2).
  - Correr `pnpm exec playwright test e2e/maestro-modulos.spec.ts` y pegar la salida en
    `progress/impl_QC-278-pantalla-modulos-por-empresa.md`.
  - **Hecho:** el E2E pasa en Chromium y WebKit; verificación manual en 390 px y 768 px contra
    `MaestroEmpresaMovil.dc.html` y `MaestroEmpresaTablet.dc.html` anotada en el `impl`.

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
- `tests/unit/maestro-ui/addon-labels.test.ts`
- `tests/unit/maestro-ui/core-module-chips.test.tsx`
- `tests/unit/maestro-ui/addon-switch-list.test.tsx`
- `tests/unit/maestro-ui/company-modules-tab.test.tsx`
- `e2e/maestro-modulos.spec.ts`
- `progress/impl_QC-278-pantalla-modulos-por-empresa.md`

Modificados (de QC-166; una línea cada uno, solo si QC-166 no la deja puesta):

- `app/(private)/maestro/empresas/[id]/page.tsx`
- `app/(private)/maestro/empresas/[id]/components/index.ts`

Solo se importan (de QC-166; esta ficha no los edita, se listan para que el detector de
choques vea la dependencia):

- `lib/shared/ui/addon-names.ts`
