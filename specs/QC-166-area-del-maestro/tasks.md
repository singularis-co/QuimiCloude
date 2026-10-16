# QC-166 — Área del Maestro · tasks

Spec: `requirements.md` (R1–R49) y `design.md`. Tableros: `design.md > 2`.
Cada task cierra con `pnpm run typecheck`, `pnpm run lint`,
`pnpm exec vitest related --run <archivos>` y, si toca rutas, menú o catálogo,
`pnpm exec vitest run guard`. Un commit por task. Los nombres de los casos llevan su `R<n>`.

## Orden

```
T1 ── T2 ─┬─ T3 [P] ── T4 ── T5 ── T6 ── T7 ──┐
          │                                   ├── T8 (E2E de acceso y empresas)
          └─ T9 (espera a QC-165 en dev) ── T10 ── T10b (reenvío) ── T11 (E2E de administradores)
                                                                       └── T12 (cierre)
```

T3 puede ir en paralelo con T9 cuando QC-165 esté en `dev`. T9–T11 **no empiezan** sin QC-165
mergeado; `design.md > 5` ya está alineado con su `design.md`, reenvío incluido. El tablero
`MaestroAdministradores.dc.html` ya trae el ítem y el diálogo.

## Tasks

- [ ] **T1 · Rutas y menú** (R2, R3, R4, R5). Sin dependencias.
  - `lib/shared/routes.ts`: `MAESTRO_COMPANIES_ROUTE`, `maestroCompanyRoute`,
    `MAESTRO_ADMINISTRATORS_ROUTE`; los dos prefijos en `PRIVATE_ROUTE_PREFIXES` (`design.md > 3.1`).
  - `lib/shared/navigation/private-nav.ts`: sección «Plataforma», etiquetas y los dos `NavLink` al
    final con `empresas.consultar`; `NavIconName` + `nav-icons.ts` (`Building2`, `ShieldUser`).
  - Páginas mínimas de las dos rutas con su `requirePagePermission` para que la guardia de rutas
    cubiertas quede verde en este mismo commit (el contenido llega en T4 y T9).
  - Tests: `tests/unit/navegacion/private-nav-maestro.test.ts`; ampliar
    `tests/unit/navegacion/orden-secciones.test.ts`.
  - **Hecho:** el menú del Maestro es exactamente «Plataforma»; `homeHrefFor` del Maestro da
    `/maestro/empresas` y el de cada rol del seed no cambia; guardias en verde.

- [ ] **T2 · Piezas compartidas** (R17, R32, R33). Depende de T1 (orden de commits).
  - `components/shared/administrator-fields.tsx` (`design.md > 7.2`) y su fila en el catálogo.
  - `lib/shared/ui/addon-names.ts` (`design.md > 6.5`) y su fila («sin UI»); test de tipos que
    iguala `AddonNameKey` a `Addon`.
  - Tests: `tests/ui/shared/administrator-fields.test.tsx` (nombres de campo con y sin prefijo,
    errores enlazados, 16 px / 44 px), `tests/unit/shared/addon-names.test.ts`.
  - **Hecho:** `guard-catalogo-de-componentes` en verde con las dos filas.

- [ ] **T3 · Lista de empresas** (R1, R6, R8–R16). Depende de T2.
  - `app/(private)/maestro/empresas/page.tsx` y `components/` con barrel: `company-list-params.ts`,
    `company-list-section.tsx`, `company-table.tsx`, `company-columns.tsx`, `company-labels.ts`
    (fechas según la pregunta abierta 2).
  - Tests: `tests/ui/maestro/company-table.test.tsx`, `tests/unit/maestro/company-list-params.test.ts`,
    `tests/ui/maestro/maestro-pages-permission.test.tsx` (parte de empresas).
  - **Hecho:** columnas, filtro, búsqueda, orden, paginación en la dirección, menú por estado,
    tarjetas y los tres estados en verde con `canModify` verdadero y falso.

- [ ] **T4 · Alta de empresa** (R7, R17, R18, R19). Depende de T3.
  - `company-create-sheet.tsx`, `company-create-action.tsx` (disparador de la cabecera).
  - Tests: `tests/ui/maestro/company-create-sheet.test.tsx` (los dos toasts, mapa de errores,
    `unauthorized`, inesperado con referencia, lo escrito se conserva).
  - **Hecho:** el `FormData` lleva exactamente los doce nombres de `company-actions.ts`.

- [ ] **T5 · Edición, baja y reactivación** (R20–R26). Depende de T4.
  - `company-edit-sheet.tsx`, `company-delete-dialog.tsx`, `company-reactivate-dialog.tsx` en
    `maestro/empresas/components/`.
  - Tests: `tests/ui/maestro/company-edit-sheet.test.tsx`, `company-delete-dialog.test.tsx`,
    `company-reactivate-dialog.test.tsx`.
  - **Hecho:** la edición llama a `setCompanyCountryAction` solo tras el éxito de
    `updateCompanyAction`; R22 refresca y deja el error en País; la baja no se puede confirmar sin
    impacto ni texto.

- [ ] **T6 · Detalle: cabecera, pestañas, Datos y hueco de Módulos** (R27–R30, R34). Depende de T5.
  - `app/(private)/maestro/empresas/[id]/page.tsx` y `[id]/components/` con barrel:
    `company-detail-header.tsx`, `company-detail-tabs.ts`, `company-data-panel.tsx`; panel vacío de
    Módulos según `design.md > 6.4` (sin `components/modulos/`).
  - Tests: `tests/ui/maestro/company-detail-page.test.tsx`, `company-detail-header.test.tsx`,
    `company-data-panel.test.tsx`.
  - **Hecho:** 404 para id inexistente o no UUID; pestaña por defecto de la pregunta 3; con
    `tab=modulos` no se llama a `getCompanyAddonsAction`.

- [ ] **T7 · Historial** (R31–R34). Depende de T6. [P] con T9 si QC-165 ya está.
  - `company-history-panel.tsx`, `company-event-text.ts`.
  - Tests: `tests/unit/maestro/company-event-text.test.ts` (cada tipo, campos en orden con «y»,
    añadidos con `ADDON_NAMES`, desconocidos sin lanzar), `tests/ui/maestro/company-history-panel.test.tsx`.
  - **Hecho:** ningún valor de campo en el DOM; paginación en la dirección.

- [ ] **T8 · E2E de acceso y de empresas** (R43, R44). Depende de T7.
  - `e2e/maestro-acceso.spec.ts`, `e2e/maestro-empresas.spec.ts` (`design.md > 10`). Si hace falta
    un helper, en `e2e/helpers/maestro.ts`.
  - Correr solo esos dos: `pnpm exec playwright test e2e/maestro-acceso.spec.ts e2e/maestro-empresas.spec.ts`.
  - **Hecho:** los dos en verde en local; salida anotada en `progress/impl_QC-166.md`.

- [ ] **T9 · Alineación con QC-165 y lista de Administradores** (R1, R6, R35, R36, R42). Depende de
  T2 y de QC-165 en `dev`.
  - Comprobar que lo mergeado de QC-165 coincide con `design.md > 5.1` (acciones, campos,
    `isLastAdministrator`, `company_last_administrator`); si difiere, realinear y pasar por el
    leader si cambia un requisito.
  - El menú de la fila declara «Editar» y «Dar de baja»; «Reenviar enlace» (solo en filas
    `pending`) entra con T10b, para no dejar un ítem que no haga nada.
  - `app/(private)/maestro/administradores/page.tsx` y `components/` con barrel:
    `load-active-companies.ts`, `administrator-list-params.ts`, `administrator-list-section.tsx`,
    `administrator-table.tsx`, `administrator-columns.tsx`, `administrator-labels.ts`.
  - Tests: `tests/ui/maestro/administrator-table.test.tsx`, parte de administradores de
    `maestro-pages-permission.test.tsx`.
  - **Hecho:** lista, filtro «Empresa», tarjetas y estados en verde.

- [ ] **T10 · Alta, edición y baja de Administradores** (R37–R41). Depende de T9.
  - `administrator-sheet.tsx`, `administrator-create-action.tsx`, `administrator-delete-dialog.tsx`.
  - Tests: `tests/ui/maestro/administrator-sheet.test.tsx`, `administrator-delete-dialog.test.tsx`.
  - **Hecho:** la empresa no se puede cambiar al editar; el último no se puede confirmar
    (`isLastAdministrator`) y `company_last_administrator` se pinta sin cerrar.

- [ ] **T10b · Reenviar enlace** (R36, R46–R49). Depende de T10 y de QC-165 en `dev`
  (`resendAdministratorLinkAction`).
  - `administrator-resend-link-dialog.tsx` (`design.md > 5.4`); el ítem «Reenviar enlace» en el
    menú de la fila, solo si `accountStatus === 'pending'`.
  - Tests: `tests/ui/maestro/administrator-resend-link-dialog.test.tsx`; ampliar
    `administrator-table.test.tsx` (ítem en desplegable y en tarjeta para `pending`; ausente en el
    resto).
  - **Hecho:** los dos toasts, `user_not_pending` dentro del diálogo, sin refresco de la lista, sin
    doble envío.

- [ ] **T11 · E2E de Administradores** (R45). Depende de T10b.
  - `e2e/maestro-administradores.spec.ts`; correr solo ese. El aviso del reenvío se acepta en sus
    dos variantes (el transporte de correo del entorno decide).
  - **Hecho:** en verde en local; salida en `progress/impl_QC-166.md`.

- [ ] **T12 · Cierre**. Depende de T8 y T11.
  - `progress/impl_QC-166.md` con el mapa `R<n> -> test` completo (R1–R49) y la salida de los E2E.
  - Anotar en `progress/features/QC-166.md` el contrato para QC-278 (`design.md > 6.4`, `> 6.5`).
  - `./init.sh` en verde.
  - **Hecho:** todo `[x]`, mapa sin huecos.

## Archivos esperados

- `lib/shared/routes.ts`
- `lib/shared/navigation/private-nav.ts`
- `lib/shared/navigation/nav-icons.ts`
- `lib/shared/ui/addon-names.ts`
- `components/shared/administrator-fields.tsx`
- `components/shared/CATALOGO.md`
- `app/(private)/maestro/empresas/page.tsx`
- `app/(private)/maestro/empresas/components/index.ts`
- `app/(private)/maestro/empresas/components/company-list-params.ts`
- `app/(private)/maestro/empresas/components/company-list-section.tsx`
- `app/(private)/maestro/empresas/components/company-table.tsx`
- `app/(private)/maestro/empresas/components/company-columns.tsx`
- `app/(private)/maestro/empresas/components/company-labels.ts`
- `app/(private)/maestro/empresas/components/company-create-sheet.tsx`
- `app/(private)/maestro/empresas/components/company-create-action.tsx`
- `app/(private)/maestro/empresas/components/company-edit-sheet.tsx`
- `app/(private)/maestro/empresas/components/company-delete-dialog.tsx`
- `app/(private)/maestro/empresas/components/company-reactivate-dialog.tsx`
- `app/(private)/maestro/empresas/[id]/page.tsx`
- `app/(private)/maestro/empresas/[id]/components/index.ts`
- `app/(private)/maestro/empresas/[id]/components/company-detail-header.tsx`
- `app/(private)/maestro/empresas/[id]/components/company-detail-tabs.ts`
- `app/(private)/maestro/empresas/[id]/components/company-data-panel.tsx`
- `app/(private)/maestro/empresas/[id]/components/company-history-panel.tsx`
- `app/(private)/maestro/empresas/[id]/components/company-event-text.ts`
- `app/(private)/maestro/administradores/page.tsx`
- `app/(private)/maestro/administradores/components/index.ts`
- `app/(private)/maestro/administradores/components/load-active-companies.ts`
- `app/(private)/maestro/administradores/components/administrator-list-params.ts`
- `app/(private)/maestro/administradores/components/administrator-list-section.tsx`
- `app/(private)/maestro/administradores/components/administrator-table.tsx`
- `app/(private)/maestro/administradores/components/administrator-columns.tsx`
- `app/(private)/maestro/administradores/components/administrator-labels.ts`
- `app/(private)/maestro/administradores/components/administrator-sheet.tsx`
- `app/(private)/maestro/administradores/components/administrator-create-action.tsx`
- `app/(private)/maestro/administradores/components/administrator-delete-dialog.tsx`
- `app/(private)/maestro/administradores/components/administrator-resend-link-dialog.tsx`
- `tests/unit/navegacion/private-nav-maestro.test.ts`
- `tests/unit/navegacion/orden-secciones.test.ts`
- `tests/unit/shared/addon-names.test.ts`
- `tests/unit/maestro/company-list-params.test.ts`
- `tests/unit/maestro/company-event-text.test.ts`
- `tests/ui/shared/administrator-fields.test.tsx`
- `tests/ui/maestro/maestro-pages-permission.test.tsx`
- `tests/ui/maestro/company-table.test.tsx`
- `tests/ui/maestro/company-create-sheet.test.tsx`
- `tests/ui/maestro/company-edit-sheet.test.tsx`
- `tests/ui/maestro/company-delete-dialog.test.tsx`
- `tests/ui/maestro/company-reactivate-dialog.test.tsx`
- `tests/ui/maestro/company-detail-page.test.tsx`
- `tests/ui/maestro/company-detail-header.test.tsx`
- `tests/ui/maestro/company-data-panel.test.tsx`
- `tests/ui/maestro/company-history-panel.test.tsx`
- `tests/ui/maestro/administrator-table.test.tsx`
- `tests/ui/maestro/administrator-sheet.test.tsx`
- `tests/ui/maestro/administrator-delete-dialog.test.tsx`
- `tests/ui/maestro/administrator-resend-link-dialog.test.tsx`
- `e2e/maestro-acceso.spec.ts`
- `e2e/maestro-empresas.spec.ts`
- `e2e/maestro-administradores.spec.ts`
- `e2e/helpers/maestro.ts`
- `progress/impl_QC-166.md`
- `progress/features/QC-166.md`
