# QC-166 — bitácora de implementación (frontend_dev)

## Tanda T1 + T2 (2026-10-16)

Commits: `73f91e5a` (T1), `ade70204` (T2). Sin dependencias nuevas.

### Archivos

T1:
- `lib/shared/routes.ts`: `MAESTRO_COMPANIES_ROUTE`, `maestroCompanyRoute`, `MAESTRO_ADMINISTRATORS_ROUTE`; los dos prefijos al final de `PRIVATE_ROUTE_PREFIXES`.
- `lib/shared/navigation/private-nav.ts`: `NAV_SECTION_PLATFORM`, `COMPANIES_LABEL`, `ADMINISTRATORS_LABEL`, iconos `building-2` y `shield-user`, dos `NavLink` al final con `empresas.consultar`.
- `lib/shared/navigation/nav-icons.ts`: `Building2`, `ShieldUser`.
- `app/(private)/maestro/empresas/page.tsx`, `app/(private)/maestro/administradores/page.tsx`: páginas mínimas (`requirePagePermission('empresas.consultar')`, `PageShell`, `PageHeader` con miga «Plataforma»).
- Tests nuevos: `tests/unit/navegacion/private-nav-maestro.test.ts`.
- Tests ampliados (fijaban el menú o las rutas exactas): `tests/unit/navegacion/orden-secciones.test.ts`, `orden-secciones-dom.test.tsx`, `private-layout-menu.test.tsx`, `tests/unit/app-sidebar.test.tsx`, `tests/unit/shell/nav-iconos.test.ts`, `tests/unit/integraciones-ui/private-nav-integraciones.test.ts`, `tests/unit/identity/login-action.test.ts`, `tests/unit/recetas-ui/recipe-route-contract.test.ts`, `tests/guards/guard-nav-permisos-declarados.test.ts`, `tests/guards/guard-pantallas-exigen-permiso.test.ts`.

T2:
- `components/shared/administrator-fields.tsx` + fila en `components/shared/CATALOGO.md`.
- `lib/shared/ui/addon-names.ts` + fila («sin UI»).
- Tests: `tests/ui/shared/administrator-fields.test.tsx`, `tests/unit/shared/addon-names.test.ts`.

### Mapa R<n> → test (de esta tanda)

| R | Test |
|---|---|
| R2 | `tests/unit/navegacion/private-nav-maestro.test.ts` (orden, permiso = el de la página, ausencia sin permiso, prefijos); `private-layout-menu.test.tsx` («R2: sin empresas.consultar…»); `orden-secciones.test.ts`, `orden-secciones-dom.test.tsx` |
| R3 | `private-nav-maestro.test.ts` («R3: … exactamente Plataforma»); `private-layout-menu.test.tsx` («R2, R3: con los permisos del Maestro…») |
| R4 | `private-nav-maestro.test.ts`, `orden-secciones.test.ts`, `login-action.test.ts` («R4: con solo empresas.*…») |
| R5 | `private-nav-maestro.test.ts` (cada rol del seed sin `empresas.*` aterriza igual que sin «Plataforma»), `orden-secciones.test.ts` |
| R17 | `tests/ui/shared/administrator-fields.test.tsx` (campos y orden, nombres con y sin prefijo, valores, obligatorios, 44 px / 16 px, etiquetas) |
| R19 (parte de campo) | `administrator-fields.test.tsx` (error junto al campo, enlazado por `aria-describedby`) |
| R32, R33 (parte de nombres) | `tests/unit/shared/addon-names.test.ts` (tipo = `Addon`, claves = `ADDONS`, nombres del tablero) |

### Salida de la verificación

- `pnpm run typecheck`: sin errores (tras T1 y tras T2).
- `pnpm run lint`: 0 errores, 10 avisos, todos preexistentes en archivos que no toca esta tanda.
- `pnpm exec vitest related --run` (T1: routes, private-nav, nav-icons, páginas, tests): 445 archivos, 7183 pass / 11 fail / 47 skip. Los 11 eran tests que fijaban el menú o las rutas exactas; ajustados y vueltos a correr: 10 archivos, 161/161 pass.
- `pnpm exec vitest related --run` (T2): 2 archivos, 13/13 pass.
- `pnpm exec vitest run guard`: 80 archivos, 1096 pass / 20 skip / 0 fail.

### Notas

- Placeholder de la fecha de nacimiento: `aaaa-mm-dd`, porque `DatePicker` muestra el día elegido como `YYYY-MM-DD`; el tablero dibuja `dd/mm/aaaa`. Ligado a la pregunta abierta 2 (formato de fechas).
- Marca de obligatorio: Nombres, Apellidos, Fecha de nacimiento (desvío declarado en `design.md > 2.1`), Correo y Nombre de usuario; con `aria-required` en los campos de texto. Sin `required` nativo, para que el rechazo lo pinte el servidor.

Veredicto: T1 y T2 hechas, todo en verde.
