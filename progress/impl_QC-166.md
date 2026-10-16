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

## Tanda T3 + T4 + T5 (2026-10-16)

Commits: `8af2bfec` (T3), `eeaee8e3` (T4), `f99c342f` (T5). Sin dependencias nuevas, sin tocar servidor.

### Archivos

T3:
- `app/(private)/maestro/empresas/page.tsx`: corte `requirePagePermission('empresas.consultar')`, `canModify` por `assertPermission`, `Suspense` con `CompanyListSection`.
- `app/(private)/maestro/empresas/components/`: `index.ts`, `company-list-params.ts`, `company-list-section.tsx`, `company-table.tsx`, `company-columns.tsx`, `company-labels.ts`.
- Tests: `tests/ui/maestro/company-table.test.tsx`, `tests/unit/maestro/company-list-params.test.ts`, `tests/ui/maestro/maestro-pages-permission.test.tsx` (parte de empresas).

T4:
- `company-create-sheet.tsx`, `company-create-action.tsx`, `company-data-fields.tsx` (subcomponente interno de la ruta, solo compone `TextField`; lo comparten alta y edición); textos en `company-labels.ts`; «Nueva empresa» en la cabecera de `page.tsx`.
- Tests: `tests/ui/maestro/company-create-sheet.test.tsx`; ampliado `maestro-pages-permission.test.tsx`.

T5:
- `company-edit-sheet.tsx`, `company-delete-dialog.tsx`, `company-reactivate-dialog.tsx`; montados desde el menú de `company-table.tsx`.
- Tests: `tests/ui/maestro/company-edit-sheet.test.tsx`, `company-delete-dialog.test.tsx`, `company-reactivate-dialog.test.tsx`; ampliado `company-table.test.tsx`.

### Mapa R<n> → test (de esta tanda)

| R | Test |
|---|---|
| R1 | `maestro-pages-permission.test.tsx` (sin sesión → login; sin `empresas.consultar` → 404 sin pedir la lista; el corte es la primera línea; la sección pide la lista con los parámetros de la dirección) |
| R6 | `company-table.test.tsx` («R6: sin empresas.modificar…»); `company-create-sheet.test.tsx` («R6: sin empresas.modificar no hay disparador»); `maestro-pages-permission.test.tsx` (`canModify` falso/verdadero, «Nueva empresa» solo con modificar) |
| R7 | `company-create-sheet.test.tsx`, `company-delete-dialog.test.tsx`, `company-reactivate-dialog.test.tsx` («R7: unauthorized…»); `company-edit-sheet.test.tsx` («R19: un rechazo sin campo…» con `unauthorized`) |
| R8 | `company-table.test.tsx` (columnas, país, marca de vacío, estado, fecha dd/mm/aaaa UTC); `maestro-pages-permission.test.tsx` (miga y título) |
| R9 | `company-list-params.test.ts` (sin filtro por defecto, valores, desconocido); `company-table.test.tsx` (opciones «Activa»/«De baja», una y las dos a la dirección) |
| R10 | `company-list-params.test.ts`; `company-table.test.tsx` (búsqueda con `q` y vuelta a la página 1) |
| R11 | `company-list-params.test.ts` (orden, defaults, ida y vuelta de la dirección); `company-table.test.tsx` (orden por Creada, paginación «Página N de M · T en total»); `maestro-pages-permission.test.tsx` |
| R12 | `company-table.test.tsx` («R12: QuimiCloud se lista como cualquier otra») |
| R13 | `company-table.test.tsx` («R13: el nombre enlaza al detalle») |
| R14 | `company-table.test.tsx` (menú de activa y de baja, `href` de Abrir y Módulos) |
| R15 | `company-table.test.tsx` (esqueleto, error con referencia y «Reintentar» → `router.refresh`, vacío de «De baja» con «Quitar el filtro», vacío de búsqueda con su enlace); `company-list-params.test.ts` |
| R16 | `company-table.test.tsx` (tarjeta con sus seis datos; «Acciones» ≥ 44 px abre el menú centrado) |
| R17 | `company-create-sheet.test.tsx` (secciones, campos, aviso, botones; sin país ni rol; `FormData` con los doce nombres) |
| R18 | `company-create-sheet.test.tsx` (`mail: 'sent'` → toast de éxito, cierre y refresco; `mail: 'failed'` → `toast.warning` con el texto de la pregunta 1) |
| R19 | `company-create-sheet.test.tsx` (cinco códigos junto a su campo con lo escrito, región para el resto, inesperado con referencia); `company-edit-sheet.test.tsx` (`company_duplicate_name` junto a Nombre, sin mandar país) |
| R20 | `company-edit-sheet.test.tsx` (carga la ficha desde la lista, valores actuales, empresa de baja, sin recarga con `detail`, País con «Sin país» y todos); `company-table.test.tsx` («R20: Editar abre…») |
| R21 | `company-edit-sheet.test.tsx` (orden de las dos llamadas, `FormData` de cada una, país sin cambio y «Sin país» vacío, toast y refresco) |
| R22 | `company-edit-sheet.test.tsx` (error junto a País, refresco, lo escrito se queda; inesperado con referencia) |
| R23 | `company-delete-dialog.test.tsx` («Calculando el impacto…», cifras, aviso, campo); `company-table.test.tsx` («R23: Dar de baja abre…») |
| R24 | `company-delete-dialog.test.tsx` (deshabilitado sin impacto, con campo vacío, con impacto fallido y referencia) |
| R25 | `company-delete-dialog.test.tsx` (éxito: toast, cierre, refresco, `FormData`; `company_name_mismatch` junto al campo) |
| R26 | `company-reactivate-dialog.test.tsx` (textos, éxito, rechazo como `Notice` `danger` dentro, inesperado con referencia); `company-table.test.tsx` («R26: Reactivar abre…») |

### Salida de la verificación

- `pnpm run typecheck`: sin errores (tras T3, T4 y T5).
- `pnpm run lint`: `✖ 10 problems (0 errors, 10 warnings)`, todos preexistentes (`step-evidence.tsx` y tres tests ajenos); ninguno en `maestro`.
- `pnpm exec vitest related --run` (T3): 3 archivos, 36/36 pass.
- `pnpm exec vitest related --run` (T4): 3 archivos, 40/40 pass.
- `pnpm exec vitest related --run` (T5): 6 archivos, 66/66 pass.
- `pnpm exec vitest run guard`: 80 archivos, 1096 pass / 20 skip / 0 fail. En T5 salió rojo una vez `guard-piezas-base` R12 (comparar con `UNEXPECTED_ERROR_CODE` fuera de `ErrorAlert`); corregido con `ErrorAlert` en el aviso de reactivación y junto a País, y vuelto a verde.

### Notas

- `<Suspense>` de la lista **sin** `key={query}` (`design.md > 3.3` lo pide con `key`): remontar el límite en cada búsqueda desmonta la caja y le quita el foco a quien escribe; es el mismo criterio de `clientes/page.tsx`. Las navegaciones van en `startTransition`, con `aria-busy` en la tabla.
- Estado en la dirección: `sort` y `dir` separados, `estado=activa|de-baja|activa,de-baja` (`design.md > 3.4`); navegación con `router.replace`.
- Vacío: con el filtro solo «De baja» sale el vacío del tablero (con «Limpiar la búsqueda» además si hay búsqueda); con búsqueda, «No hay empresas que coincidan con la búsqueda.» y su enlace. Los dos textos de enlace («Limpiar la búsqueda», «Volver a la primera página») y el del vacío genérico no están en el tablero: se tomaron de `clientes`.
- Tarjeta: `meta` = identificación, país, creada; `footer` = usuarios. «N usuarios» y «creada …» llevan su palabra solo en la tarjeta (consulta de contenedor), porque en la tabla la cabecera ya la da.
- Alta: el aviso del correo fallido es `toast.warning` (no `success`), con el texto de la pregunta abierta 1. Etiqueta pendiente del botón: la de `FormSheet` («Guardando…»), el tablero no da otra.
- Edición: un error del país va junto a País (`CountrySelect.error`) y, si es inesperado, su referencia justo debajo; un error de datos sin campo va a la región del panel.
- Baja: el aviso del tablero es la `description` del diálogo, así que queda encima de las cifras (el tablero lo pone debajo); `ConfirmDialog` no deja otro orden sin extenderlo.
- Archivo fuera de `tasks.md > Archivos esperados`: `app/(private)/maestro/empresas/components/company-data-fields.tsx`.

Veredicto: T3, T4 y T5 hechas, todo en verde.

## Tanda T6 + T7 (2026-10-16)

Commits: `a4f2b6c9` (T6), `8d032205` (T7). Sin dependencias nuevas, sin tocar servidor.

### Archivos

T6:
- `app/(private)/maestro/empresas/[id]/page.tsx`: corte `requirePagePermission('empresas.consultar')`; id no UUID → `notFound()` sin pedir nada; `company_not_found` → `notFound()`; otro error → `ErrorState` con «Reintentar»; `canModify` por `assertPermission`; `UrlTabs`; un `role="tabpanel"` con el panel vigente; Módulos vacío.
- `app/(private)/maestro/empresas/[id]/components/`: `index.ts`, `company-detail-tabs.ts`, `company-detail-header.tsx`, `company-data-panel.tsx`. La cabecera importa `CompanyEditSheet`, `CompanyDeleteDialog` y `CompanyReactivateDialog` del barrel del padre.
- Tests: `tests/ui/maestro/company-detail-page.test.tsx`, `company-detail-header.test.tsx`, `company-data-panel.test.tsx`; ampliado `maestro-pages-permission.test.tsx` (bloque `/maestro/empresas/[id]`).
- Guardia: `tests/guards/guard-pantallas-exigen-permiso.test.ts` pasa de 28 a 29 pantallas con `/maestro/empresas/[id]` (`design.md > 3.3`). `data-table-alcance` no cambia: el detalle no usa `DataTable`.

T7:
- `company-event-text.ts` (`companyEventText`, `formatCompanyEventInstant`), `company-history-panel.tsx` (`CompanyHistoryPanel` servidor, `CompanyHistoryTimeline`, `CompanyHistorySkeleton`); `company-detail-tabs.ts` gana `page` del historial y `companyHistoryPageHref`; `page.tsx` monta el historial en `<Suspense key={historyPage}>`.
- Tests: `tests/unit/maestro/company-event-text.test.ts`, `tests/ui/maestro/company-history-panel.test.tsx`; ampliado `company-detail-page.test.tsx`.

### Mapa R<n> → test (de esta tanda)

| R | Test |
|---|---|
| R1 (detalle) | `maestro-pages-permission.test.tsx` (sin sesión → login; sin `empresas.consultar` → 404 sin pedir la empresa; el corte es la primera línea) |
| R6 (detalle) | `company-detail-header.test.tsx` («R6: sin empresas.modificar…», activa y de baja); `company-detail-page.test.tsx` («R6: con solo empresas.consultar…») |
| R27 | `company-detail-page.test.tsx` (miga, título, estado, tres pestañas con sus `href`, defecto «Datos» sin tab y con tab desconocido, Historial seleccionada, empresa de baja, 404 por id no UUID y por `company_not_found`); `company-detail-header.test.tsx` («R27: miga…») |
| R28 | `company-detail-header.test.tsx` (activa: Editar y Dar de baja; de baja: Editar y Reactivar; 44 px; Editar abre el panel con la ficha sin volver a pedirla; Dar de baja abre el diálogo y pide el impacto; Reactivar refresca con éxito); `company-detail-page.test.tsx` |
| R29 | `company-data-panel.test.tsx` (orden de los siete, valores, país con prefijo, fecha UTC, marca de vacío, fecha de baja, solo lectura) |
| R30 | `company-detail-page.test.tsx` (panel «Módulos» vacío y `getCompanyAddonsAction` sin llamar; ningún archivo del detalle importa añadidos ni tiene `components/modulos/`) |
| R31 | `company-history-panel.test.tsx` (pide con la página de la dirección, orden del servidor, autor e instante con `<time>`, «Página N de M · T en total», anterior/siguiente con su `href` y deshabilitados en los bordes, 44 px, fuera de rango, `page` en la dirección); `company-detail-page.test.tsx` («R31, R34: con tab=historial y page=2…», «fuera de la pestaña Historial no se pide»); `company-event-text.test.ts` (instante) |
| R32 | `company-event-text.test.ts` (alta, baja, reactivación, uno, dos y cinco campos con «y», cada añadido con `ADDON_NAMES`); `company-history-panel.test.tsx` (ningún valor en el DOM) |
| R33 | `company-event-text.test.ts` (tipos desconocidos sin lanzar, campo desconocido, edición sin campos, añadido desconocido y sin añadido); `company-history-panel.test.tsx` (evento desconocido pintado) |
| R34 | `company-detail-page.test.tsx` (error del detalle con referencia y «Reintentar» → `router.refresh`; esqueleto del historial como `fallback`); `company-history-panel.test.tsx` (esqueleto `status`, error con referencia y «Reintentar») |

### Salida de la verificación

- `pnpm run typecheck`: sin errores (tras T6 y tras T7).
- `pnpm run lint`: `✖ 10 problems (0 errors, 10 warnings)`, los mismos preexistentes; ninguno en `maestro`. En T7 salió una vez `react-hooks/static-components` (icono elegido en el render); corregido con elementos estáticos.
- `pnpm exec vitest related --run` (T6): 5 archivos, 48/48 pass.
- `pnpm exec vitest related --run` (T7): 6 archivos, 80/80 pass.
- `pnpm exec vitest run guard`: 80 archivos, 1096 pass / 20 skip / 0 fail (tras T6 y tras T7).

### Notas y desvíos

- **Esqueleto del detalle (R34):** la ficha se lee en la página antes de pintar, sin `loading.tsx` ni `Suspense` alrededor: con un límite de carga la respuesta ya sale con 200 y el `notFound()` de R27 dejaría de ser un 404 (los E2E del repo comprueban el 404 por estado). El esqueleto cubre el Historial; el detalle muestra error con «Reintentar».
- **Miga:** «Empresas» (enlace) › nombre de la empresa; `PageHeader` siempre marca el último paso como actual, así que el nombre se repite en la miga (el tablero solo pinta «Empresas ›»). El `StatusBadge` va dentro del `h1`, junto al nombre, como en el tablero.
- **Pregunta 4, campo o añadido desconocido:** «Registró un cambio (<nombres>)», con la etiqueta de los campos conocidos y el nombre técnico de los desconocidos (p. ej. «Registró un cambio (Nombre y billingCode)»). Es una lectura de «y el nombre técnico…»; si se quiere otra forma, es un texto.
- Textos que no trae el tablero: «No se pudo cargar la empresa.», «No se pudo cargar el historial.», «Todavía no hay eventos en el historial.», «No hay eventos en esta página.», «Páginas del historial», «Página anterior», «Página siguiente», «Cargando el historial…».
- Iconos del Historial (lucide, del tablero): alta `Building2`, edición `Pencil`, prender `Plus`, apagar `Power`; baja `Trash2` y reactivación `RotateCcw` (los de los botones de cabecera del tablero); desconocido `History`. Todos en tono neutro: el tablero no fija qué tono va con cada tipo.
- `canModifyCompanies` se repite en `[id]/page.tsx`: no puede vivir en el barrel del padre porque la cabecera (cliente) lo importa y arrastraría `@/lib/composition` al cliente.

Veredicto: T6 y T7 hechas, todo en verde.
