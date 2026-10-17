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

## T8 · E2E de acceso y de empresas (2026-10-16)

Commits: `a2563b66` fix(QC-166) tipo de documento del alta · `365353be` test(QC-166) T8.

### Archivos
- `e2e/maestro-acceso.spec.ts` (nuevo, R43)
- `e2e/maestro-empresas.spec.ts` (nuevo, R44)
- `e2e/helpers/maestro.ts` (nuevo): `maestroCredentials()` (`SEED_MAESTRO_*`) y `deleteFixtureCompanies()`
- `tests/guards/guard-identificador-de-request.test.ts`: alta de los dos specs en la lista cerrada `E2E_ESPERADOS` (design.md > 10)
- Fix aparte: `app/(private)/maestro/empresas/components/company-create-sheet.tsx` + `tests/ui/maestro/company-create-sheet.test.tsx` (caso nuevo R17)

### Mapa R → caso
| R | Caso |
|---|---|
| R43 (login → `/maestro/empresas`, solo «Plataforma») | `maestro-acceso.spec.ts` › el login del Maestro aterriza en Empresas con solo «Plataforma» en el menú |
| R43 (ERP → 404 privado) | `maestro-acceso.spec.ts` › una pantalla del ERP le responde al Maestro el 404 de la zona privada |
| R43 (usuario de empresa → 404, sin «Plataforma») | `maestro-acceso.spec.ts` › un usuario de empresa recibe el 404 en Empresas y no ve «Plataforma» |
| R43 (cierre de sesión) | `maestro-acceso.spec.ts` › el Maestro cierra sesión como cualquiera |
| R44 (alta, edición de país en la columna País, baja con nombre erróneo y correcto, sin filtro / «De baja», reactivación, Historial alta + «País» + baja, sesión cortada) | `maestro-empresas.spec.ts` › el Maestro da de alta, edita el país, da de baja, reactiva y ve el Historial; la sesión de la empresa dada de baja se corta (R44) |

### Salida de la verificación
- `pnpm exec playwright test e2e/maestro-acceso.spec.ts e2e/maestro-empresas.spec.ts` (ejecución final):
  ```
  ok  2 [chromium] maestro-acceso › el login del Maestro aterriza en Empresas con solo «Plataforma» en el menú (32.0s)
  ok  5 [chromium] maestro-acceso › una pantalla del ERP le responde al Maestro el 404 de la zona privada (36.1s)
  ok  3 [chromium] maestro-acceso › un usuario de empresa recibe el 404 en Empresas y no ve «Plataforma» (37.4s)
  ok  1 [chromium] maestro-acceso › el Maestro cierra sesión como cualquiera (37.6s)
  ok  4 [webkit]   maestro-acceso › el login del Maestro aterriza en Empresas con solo «Plataforma» en el menú (39.3s)
  ok  8 [webkit]   maestro-acceso › una pantalla del ERP le responde al Maestro el 404 de la zona privada (14.3s)
  ok  7 [webkit]   maestro-acceso › un usuario de empresa recibe el 404 en Empresas y no ve «Plataforma» (17.5s)
  ok  9 [webkit]   maestro-acceso › el Maestro cierra sesión como cualquiera (19.0s)
  ok  6 [chromium] maestro-empresas › el Maestro da de alta, edita el país, ... la sesión ... se corta (R44) (1.2m)
  ok 10 [webkit]   maestro-empresas › el Maestro da de alta, edita el país, ... la sesión ... se corta (R44) (45.8s)
  10 passed (2.1m)
  ```
  Tras la ejecución, 0 empresas y 0 usuarios `qc166_%` en la base.
- `pnpm run typecheck`: sin errores.
- `pnpm run lint`: 0 errores, 10 warnings previos en archivos ajenos a T8.
- `pnpm exec vitest run guard`: 80 archivos, 1096 passed, 20 skipped.
- `pnpm exec vitest run tests/ui/maestro/company-create-sheet.test.tsx`: 15 passed (el caso nuevo falla sin el fix).
- Tests que recorren `e2e/` (scope de módulos, data-table-alcance, etc.): 11 archivos, 155 passed.

### Notas y desvíos
- **Bug destapado (fix aparte, `a2563b66`):** `adminValues` del alta rellenaba con `''` los campos
  vacíos, y ese `''` tapaba el `?? DOCUMENT_TYPE_CODES[0]` de `AdministratorFields`. El alta llegaba sin
  `adminDocumentTypeCode` y el servidor respondía `invalid_input`. Ahora se omiten las claves vacías.
- **Para el leader:** el servidor exige teléfono y número de documento del Administrador (reglas del
  alta de usuario), pero `AdministratorFields` no les pone la marca de obligatorio. design.md > 2.2
  solo declara el desvío de la fecha de nacimiento. No lo he cambiado (afecta a T2 y al tablero).
  El E2E rellena los dos campos.
- La búsqueda y el filtro «De baja» se ponen por la URL (`?q=`, `?estado=de-baja`), que es el estado
  de la lista. Así el spec no nombra los testids de la tabla compartida y no entra en la lista cerrada
  R36 de `data-table-alcance`.
- Durante el streaming, la lista sale un instante dos veces (la copia oculta fuera de
  `private-content`). Los localizadores se acotan a `private-content`. En WebKit, el `router.refresh()`
  de la reactivación chocaba con el `goto` siguiente, así que se espera a que la fila salga de «De baja».
- El toast del alta acepta las dos variantes (enviado o fallido), según design.md > 10.

## T9, T10, T10b · Administradores (2026-10-16)

Commits: `acd1c04d` (T9), `14a7aeb1` (T10), `9eab5853` (T10b). Sin dependencias nuevas. El grafo no
tiene proyecto para este worktree: exploración con Grep/Read.

### Alineación con QC-165 (mergeado en `dev`, PR #264)

Comparado `lib/modules/identity/adapters/driving/administrator-actions.ts`, `domain/administrator-view.ts`,
`administrator-queryable.ts`, `administrator-input.ts`, `delete-administrator.ts`,
`resend-administrator-link.ts`, `credential-setup-mail.ts` y el catálogo de errores contra design.md > 5.1–5.5.
**Coincide en todo: no hubo que realinear nada y ningún requisito cambia.**
- Seis acciones con los nombres y firmas de 5.1. `createAdministratorAction` → `{ administratorId, mail }`.
  `updateAdministratorAction` lee `id` + ocho datos, sin `companyId` (`strictObject` lo rechazaría).
  `deleteAdministratorAction` y `resendAdministratorLinkAction` leen solo `id`.
  `ResendAdministratorLinkFormState` = `{ status: 'success', mail: 'sent' | 'failed' }` o `ErrorState`.
- `AdministratorRow` y `AdministratorDetail` traen `company: { id, name }`, `accountStatus`
  (`UserAccountStatus`: active, pending, inactive, blocked) e `isLastAdministrator`.
- Lista: filtro `companyId` (`select`), orden en las siete columnas de 5.1, `searchable: true`.
- `company_last_administrator` («Es el único Administrador de la empresa: crea otro antes de darlo de
  baja.») y `user_not_pending` están en el catálogo. `UserNotPendingError` sale de `credential-setup-mail.ts`.
- **Teléfono y número de documento:** QC-165 lo confirma. `companyAdministratorSchema` es `createUserSchema`
  sin rol ni credencial, y `phone` / `documentNumber` son `trim().min(1)` (obligatorios). `AdministratorFields`
  sigue sin marcarlos: no lo he cambiado, está pendiente de decisión del leader.

### Archivos
T9:
- `app/(private)/maestro/administradores/page.tsx`: lista, `canModify` y empresas activas. Si las empresas
  no cargan, la tabla queda en su error.
- `app/(private)/maestro/administradores/components/`: `index.ts`, `load-active-companies.ts`,
  `administrator-list-params.ts`, `administrator-list-section.tsx`, `administrator-table.tsx`,
  `administrator-columns.tsx`, `administrator-labels.ts`
- `tests/ui/maestro/administrator-table.test.tsx` (nuevo), `tests/ui/maestro/maestro-pages-permission.test.tsx`
  (parte de Administradores), `tests/unit/shared/data-table-alcance.test.ts`: `MAESTRO_ADMINISTRATORS_ROUTE`
  entra en la lista cerrada como la DUODÉCIMA, citando design.md > 7.4, y el ancla pasa de 11 a 12.

T10:
- `administrator-sheet.tsx`, `administrator-create-action.tsx`, `administrator-delete-dialog.tsx`.
  Ampliados: `administrator-table.tsx`, `administrator-labels.ts`, `index.ts`, `page.tsx`.
- `tests/ui/maestro/administrator-sheet.test.tsx` y `administrator-delete-dialog.test.tsx` (nuevos).
  Ampliados: `administrator-table.test.tsx`, `maestro-pages-permission.test.tsx`.

T10b:
- `administrator-resend-link-dialog.tsx`. Ampliados: `administrator-columns.tsx`, `administrator-table.tsx`,
  `administrator-labels.ts`, `index.ts`.
- `tests/ui/maestro/administrator-resend-link-dialog.test.tsx` (nuevo). Ampliado: `administrator-table.test.tsx`.

### Mapa R<n> → test
| R | Test |
|---|---|
| R1 | `maestro-pages-permission.test.tsx` › /maestro/administradores: «R1: sin sesion…», «R1: una sesion sin empresas.consultar…», «R1: el corte… es la primera linea» |
| R6 | `administrator-table.test.tsx` «R6: sin empresas.modificar no hay menu…»; `administrator-sheet.test.tsx` «R6: sin empresas.modificar no hay disparador ni panel»; `maestro-pages-permission.test.tsx` «R6: …canModify falso / verdadero» |
| R7 | `administrator-sheet.test.tsx` «R7: unauthorized…»; `administrator-delete-dialog.test.tsx` «R7: unauthorized…» |
| R35 | `administrator-table.test.tsx`: columnas, lista única, enlace a la empresa, estados, sin búsqueda ni orden, filtro «Empresa» llevado a la dirección, lectura de `empresa`, paginación. `maestro-pages-permission.test.tsx`: miga y título, consulta con filtro y página, empresas activas página a página |
| R36 | `administrator-table.test.tsx` «R36: … activo ofrece Editar y Dar de baja», «… Pendiente ofrece Reenviar enlace entre…», «… en cualquier otro estado no…», tarjeta pendiente y tarjeta activa |
| R37 | `administrator-sheet.test.tsx` «R37: empieza por Empresa…», «solo las empresas activas», «FormData… sin prefijo», «con exito y el correo enviado…», «con exito pero sin correo…» (pregunta 6) |
| R38 | `administrator-sheet.test.tsx` «R38: carga la ficha… empresa fija», «FormData… nunca la empresa», «al guardar con exito…», «si la ficha no carga…»; `administrator-table.test.tsx` «R38: Editar abre el panel…» |
| R39 | `administrator-delete-dialog.test.tsx` «R39: se titula…», «R39: confirmar manda solo el id…»; `administrator-table.test.tsx` «R39: Dar de baja abre…» |
| R40 | `administrator-delete-dialog.test.tsx` «R40: el ultimo… no deja confirmar», «R40: si el servidor rechaza… sin cerrar»; `administrator-table.test.tsx` «R40: … sin poder confirmar» |
| R41 | `administrator-sheet.test.tsx` «R41: duplicate_* junto a su campo…» (×3), «company_not_found… region», «error inesperado… referencia», «un duplicado en la edicion…» |
| R42 | `administrator-table.test.tsx`: esqueleto, error con «Reintentar», vacío, vacío con filtro, tarjeta, «Acciones» de al menos 44 px. `maestro-pages-permission.test.tsx` «R42: si las empresas no cargan…», «R42: si la lista falla…» |
| R46 | `administrator-resend-link-dialog.test.tsx` «R46: pregunta…», «R46: … solo el id»; `administrator-table.test.tsx` «R46: Reenviar enlace abre…» |
| R47 | `administrator-resend-link-dialog.test.tsx` «R47: si el correo salio…», «R47: si el correo no salio…» (pregunta 8) |
| R48 | `administrator-resend-link-dialog.test.tsx` «R48: user_not_pending / user_not_found / unauthorized…», «R48: un error inesperado…» |
| R49 | `administrator-resend-link-dialog.test.tsx` «R49: … Reenviando…, deshabilitado y no envia dos veces» |

### Salida de la verificación
- `pnpm run typecheck`: sin errores tras T9, T10 y T10b.
- `pnpm run lint`: 0 errores y 10 warnings, todos previos y en archivos ajenos.
- `pnpm exec vitest related --run <archivos de T9>`: 3 archivos, 54 passed / 2 skipped.
- `pnpm exec vitest related --run <archivos de T10>`: 4 archivos, 61 passed.
- `pnpm exec vitest related --run <archivos de T10b>`: 5 archivos, 75 passed.
- `pnpm exec vitest run guard`: 80 archivos, 1096 passed / 20 skipped tras cada task. En T10, la guardia
  `guard-rol-administrador-unico` cazó el literal «Administrador» en `administrator-labels.ts`. Lo arreglé
  antes del commit: ahora se usa `ROLE_ADMINISTRADOR` del barrel de `identity`.

### Notas y desvíos
- La lista no tiene caja de búsqueda ni orden: R35 y el tablero solo piden el filtro «Empresa» y la
  paginación. QC-165 sí los admite; si se quieren, basta con añadirlos a las columnas y a
  `administrator-list-params.ts`.
- `empresa` admite varias empresas separadas por coma, porque el filtro `select` es múltiple. Lo que no es
  uuid se ignora.
- Si `loadActiveCompanies` falla, la página pinta la tabla en error con «Reintentar» y sin
  «Nuevo administrador».
- El reenvío usa `ConfirmDialog` con `submit: { kind: 'action' }` + `useActionState`, el patrón de los
  diálogos de empresa, en vez de `onConfirm` dentro de `startTransition` (design.md > 5.4). Lo que se ve no
  cambia: `FormData` con solo `id`, botón en pendiente y sin doble envío.
- El tablero pinta un icono de correo en el diálogo de reenvío. `ConfirmDialog` no tiene hueco para icono y
  no lo he extendido. «Rol» se muestra fijo en el alta y en la edición; el aviso del correo, solo en el alta.
- Están aplicados los textos por defecto de las preguntas abiertas 6 y 8.

## T11 · E2E de Administradores (R45) — frontend_dev, 2026-10-16

Commit `7cfad454` `test(QC-166): T11 E2E de Administradores del Maestro`.

### Archivos
- `e2e/maestro-administradores.spec.ts` (nuevo).
- `tests/guards/guard-identificador-de-request.test.ts`: alta de `maestro-administradores.spec.ts` en la
  lista cerrada, con la cita de `design.md > 10`. No usa los testids de la tabla compartida, así que la
  R36 de `tests/unit/shared/data-table-alcance.test.ts` no se toca.

### Mapa R45 -> caso
| R | Caso |
|---|---|
| R45 | `e2e/maestro-administradores.spec.ts` «el Maestro da de alta un Administrador eligiendo empresa, lo edita, le reenvía el enlace, no puede dar de baja al último y da de baja al que no lo es (R45)», pasos 1 (alta eligiendo empresa en el panel, fila «Pendiente», empresa en la base), 2 (edición con empresa fija, apellido nuevo en la lista), 3 (sin «Reenviar enlace» en la fila activa; reenvío a la pendiente con aviso `sent` o `failed`), 4 (baja del que no es el último) y 5 (el último: aviso y «Dar de baja» deshabilitado; sigue vivo en la base) |

Fixture: empresa `qc166_adm_<run>_c` y su primer Administrador activo sembrados con `prisma.company.create`
y `createFixtureUser`; limpieza con `deleteFixtureCompanies('qc166_adm_')` (huérfanos de más de una hora en
`beforeAll`, los de la ejecución en `afterAll`).

### Salida
- `pnpm exec playwright test e2e/maestro-administradores.spec.ts` (segunda corrida verde):
  ```
  Running 2 tests using 2 workers
    ok 2 [chromium] › e2e\maestro-administradores.spec.ts:140:5 › el Maestro da de alta un Administrador eligiendo empresa, lo edita, le reenvía el enlace, no puede dar de baja al último y da de baja al que no lo es (R45) (21.7s)
    ok 1 [webkit] › e2e\maestro-administradores.spec.ts:140:5 › el Maestro da de alta un Administrador eligiendo empresa, lo edita, le reenvía el enlace, no puede dar de baja al último y da de baja al que no lo es (R45) (35.6s)
    2 passed (50.1s)
  ```
- `pnpm run typecheck`: sin errores.
- `pnpm run lint`: 0 errores y 10 warnings, todos previos y en archivos ajenos.
- `pnpm exec vitest run guard`: 80 archivos, 1096 passed / 20 skipped.

### Notas
- Las dos primeras corridas fallaron por el spec, no por la app. (1) `administrator-email` y
  `administrator-username` son a la vez testids de las celdas de la lista y de los campos del panel, así
  que los campos se buscan dentro de `administrator-form`. (2) `administrator-name` lleva delante las
  iniciales del avatar, así que se usa `toContainText`. No hay bug en T9–T10b.

Veredicto: T11 en verde en chromium y webkit; R45 cubierto.

## T12 · Mapa consolidado R<n> -> test (R1–R49, 2026-10-16)

Rutas: `tests/ui/maestro/`, `tests/unit/maestro/`, `tests/unit/navegacion/`, `tests/unit/identity/login-action.test.ts`, `tests/ui/shared/administrator-fields.test.tsx`, `tests/unit/shared/addon-names.test.ts` y `e2e/`. Sin huecos: cada R tiene al menos un caso que lo nombra.

| R | Test(s) |
|---|---|
| R1 | maestro-pages-permission.test.tsx, maestro-acceso.spec.ts |
| R2 | private-nav-maestro.test.ts, orden-secciones.test.ts, private-layout-menu.test.tsx, maestro-acceso.spec.ts |
| R3 | private-nav-maestro.test.ts, private-layout-menu.test.tsx, maestro-acceso.spec.ts |
| R4 | private-nav-maestro.test.ts, orden-secciones.test.ts, login-action.test.ts, maestro-acceso.spec.ts |
| R5 | private-nav-maestro.test.ts, orden-secciones.test.ts |
| R6 | administrator-sheet.test.tsx, administrator-table.test.tsx, company-create-sheet.test.tsx, company-detail-header.test.tsx, company-detail-page.test.tsx, company-table.test.tsx, maestro-pages-permission.test.tsx |
| R7 | administrator-delete-dialog.test.tsx, administrator-sheet.test.tsx, company-create-sheet.test.tsx, company-delete-dialog.test.tsx, company-reactivate-dialog.test.tsx |
| R8 | company-table.test.tsx, maestro-pages-permission.test.tsx |
| R9 | company-table.test.tsx, company-list-params.test.ts |
| R10 | company-table.test.tsx, company-list-params.test.ts |
| R11 | company-table.test.tsx, maestro-pages-permission.test.tsx, company-list-params.test.ts |
| R12 | company-table.test.tsx |
| R13 | company-table.test.tsx |
| R14 | company-table.test.tsx |
| R15 | company-table.test.tsx, company-list-params.test.ts |
| R16 | company-table.test.tsx |
| R17 | company-create-sheet.test.tsx, administrator-fields.test.tsx |
| R18 | company-create-sheet.test.tsx |
| R19 | company-create-sheet.test.tsx, company-edit-sheet.test.tsx, administrator-fields.test.tsx |
| R20 | company-edit-sheet.test.tsx, company-table.test.tsx |
| R21 | company-edit-sheet.test.tsx |
| R22 | company-edit-sheet.test.tsx |
| R23 | company-delete-dialog.test.tsx, company-table.test.tsx |
| R24 | company-delete-dialog.test.tsx |
| R25 | company-delete-dialog.test.tsx |
| R26 | company-reactivate-dialog.test.tsx, company-table.test.tsx |
| R27 | company-detail-header.test.tsx, company-detail-page.test.tsx |
| R28 | company-detail-header.test.tsx, company-detail-page.test.tsx |
| R29 | company-data-panel.test.tsx |
| R30 | company-detail-page.test.tsx |
| R31 | company-detail-page.test.tsx, company-history-panel.test.tsx, company-event-text.test.ts |
| R32 | company-history-panel.test.tsx, company-event-text.test.ts, addon-names.test.ts |
| R33 | company-history-panel.test.tsx, company-event-text.test.ts, addon-names.test.ts |
| R34 | company-detail-page.test.tsx, company-history-panel.test.tsx |
| R35 | administrator-table.test.tsx, maestro-pages-permission.test.tsx |
| R36 | administrator-table.test.tsx |
| R37 | administrator-sheet.test.tsx |
| R38 | administrator-sheet.test.tsx, administrator-table.test.tsx |
| R39 | administrator-delete-dialog.test.tsx, administrator-table.test.tsx |
| R40 | administrator-delete-dialog.test.tsx, administrator-table.test.tsx |
| R41 | administrator-sheet.test.tsx |
| R42 | administrator-table.test.tsx, maestro-pages-permission.test.tsx |
| R43 | maestro-acceso.spec.ts |
| R44 | maestro-empresas.spec.ts |
| R45 | maestro-administradores.spec.ts |
| R46 | administrator-resend-link-dialog.test.tsx, administrator-table.test.tsx |
| R47 | administrator-resend-link-dialog.test.tsx |
| R48 | administrator-resend-link-dialog.test.tsx |
| R49 | administrator-resend-link-dialog.test.tsx |

## m10 · Revisión visual de CountrySelect (2026-10-16)

Cierra la revisión que pedía el «Hecho» de QC-235 T9 (m4 de `progress/review_QC-235.md`), contra el
tablero `docs/diseno/canvas/CountrySelect.dc.html`.

**Cómo se hizo.** Script Playwright de un solo uso fuera del repo (scratchpad de la sesión; no está en
`e2e/` ni se versiona), con su propia config que levanta `pnpm run dev --port 3117` en este worktree
igual que `playwright.config.ts` y lo cierra al terminar. Chromium. Entra con el Maestro sembrado
(`SEED_MAESTRO_*` del `.env`), abre `/maestro/empresas`, «Editar» en la única empresa existente
(QuimiCloud, sin país: no se creó ni modificó ningún dato) y en cada ancho captura y mide (posición y
tamaño de disparador, popup, lista y opciones; recorte por `scrollWidth`; desborde horizontal de la
página; `document.activeElement`). Anchos: 1440×900 (ratón), 820×1180 y 375×812 (táctiles,
`hasTouch` + `isMobile`). DPR 1. El botón «N» abajo a la izquierda es el indicador de `next dev`, no
la app.

**Capturas** (`progress/qc166-revision-visual/`), por ancho 1440, 820 y 375:
- `country-select-<ancho>-cerrado.png`: panel «Editar empresa» con País cerrado.
- `country-select-<ancho>-abierto.png`: selector recién abierto.
- `country-select-<ancho>-filtrado.png`: tras escribir `rep` (3 resultados).
- `country-select-<ancho>-sin-resultados.png`: tras escribir `zzz`.
- `country-select-<ancho>-tras-escape.png`: tras Escape.
El filtro por prefijo (`+1`, 25 resultados) se midió pero no se capturó.

**1440 px** (panel de 384 px a la derecha).
- Disparador 351×44, «Sin país» en gris, chevron gira al abrir. Sin recorte.
- Popup anclado bajo el campo, mismo ancho que el disparador (351), buscador arriba y lista con
  `max-height` 264 px y scroll, como el tablero. Dentro de la pantalla (borde inferior en y=847 de 900).
- Opciones de 44 px también con ratón. El tablero solo pide 44 en táctil; no es un defecto, es más
  generoso.
- Nombre más largo («República Democrática del Congo») cabe sin recorte; el prefijo va en mono y gris.
- «Sin país» primero, marcado con el check y a la vista. «Ningún país coincide con «zzz».» sale bien.
- Foco: al abrir va al buscador (`combobox` «Buscar país por nombre o prefijo»); Escape lo devuelve al
  disparador y cierra sin cambiar el valor.
- Observación menor: con la lista completa, el borde inferior del popup (y=847) tapa unos 6 px del
  borde superior de «Cancelar»/«Guardar» del pie del panel (botones desde y≈841). Es una capa
  flotante encima del pie, y se cierra antes de usarlos. No afecta al uso.

**820 px** (panel de 384 px a la derecha, táctil).
- Igual que escritorio: popup anclado (no hoja), 351 px, lista de 264 px, opciones de 44 px. Coincide
  con «Tablet · popup anclado, igual que escritorio» y «Opciones de 44 px en táctil».
- Sin recorte ni desborde horizontal; popup dentro de la pantalla. Foco igual que en 1440.

**375 px** (panel a pantalla completa, táctil).
- Disparador 342×44, sin recorte.
- Al abrir monta la hoja inferior (≤ 640 px) con asa, título «País», botón «Cerrar» (X), buscador de
  ~48 px y opciones de 48 px a lo ancho (351 px): coincide con el tablero. El foco va al buscador.
- Sin desborde horizontal ni recortes.
- **Hallazgo (a decidir por el leader):** la hoja no tiene altura fija; se ajusta al número de
  resultados. Con la lista completa ocupa de y=122 al final (690 px); al escribir `rep` encoge a
  301 px (arranca en y=511) y con `zzz` a 197 px (y=615). Es decir, el título y el buscador saltan
  hacia abajo mientras se escribe, y el formulario de detrás vuelve a verse. En un teléfono real, con el
  teclado abierto, el campo en el que se está escribiendo se mueve bajo el dedo en cada letra que cambia
  el número de resultados. El tablero de teléfono muestra la hoja con lista llena y no dice nada del
  caso filtrado; lo esperable sería altura estable (p. ej. la de la lista completa o un `min-height`).
- Diferencia de rol (sin impacto visible): en escritorio/tablet el disparador es `role="combobox"`
  con `aria-haspopup="dialog"`; en teléfono es un `button` con `aria-haspopup="dialog"`. Ambos son
  correctos para lo que abren.
- Escape cierra la hoja y el foco vuelve al disparador.

**No cubierto:** el estado «Con país» (lista que arranca en el país elegido, m5 de QC-235) porque la
única empresa no tiene país y no se cambiaron datos; ese caso lo ejercita `e2e/maestro-empresas.spec.ts`
al editar a Colombia. Tampoco WebKit.

Veredicto: CountrySelect coincide con el tablero en los tres anchos (popup anclado de 264 px en 1440 y
820, hoja con 48 px en 375, foco y Escape correctos, sin recortes ni desbordes); un hallazgo de diseño
en teléfono (la hoja cambia de altura al filtrar) queda para el leader.

## m11 · Capturas de los diálogos con icono (2026-10-17)

Chromium, 1440x900, `deviceScaleFactor` 1, `next dev` en el puerto 3117, Maestro sembrado.
Fixtures `qc166_vis_` sembradas por la base (una empresa activa con un Administrador activo y uno
pendiente, y una empresa de baja), borradas al final (`deleteFixtureCompanies`, quedan 0). Ningún
diálogo se confirmó: se cerraron con «Volver» o Escape. Script de un solo uso fuera del repo.

- `progress/qc166-revision-visual/dialogo-1440-baja-empresa.png` — icono `trash` de 44 px, tono
  `danger` (fondo `destructive-subtle`, glifo `destructive-text`); orden correcto: cifras («Usuarios
  activos» 2, «Pedidos abiertos» 0) → aviso → campo «Escribe … para confirmar»; «Dar de baja»
  deshabilitado con el campo vacío. Defecto: el título queda centrado en su columna (x=637 px frente a
  x=604 px de los otros tres diálogos), separado del icono en vez de alineado a la izquierda junto a
  él; y el aviso, que empieza bajo el icono (x=544), corta las líneas hacia x≈820 y no usa todo el
  ancho del cuerpo (hasta x=896).
- `progress/qc166-revision-visual/dialogo-1440-baja-administrador.png` — icono `trash` de 44 px, tono
  `danger`; título y descripción alineados a la izquierda junto al icono; «Dar de baja» en rojo. Al
  abrir, «Volver» muestra el anillo de foco (foco inicial en cancelar); en los otros tres no se ve
  anillo en la captura.
- `progress/qc166-revision-visual/dialogo-1440-reenvio.png` — icono `mail` de 44 px, tono `info`
  (fondo `accent`, glifo `accent-foreground`); título, correo en negrita y descripción alineados junto
  al icono; sin defectos a la vista.
- `progress/qc166-revision-visual/dialogo-1440-reactivar.png` — icono `rotate-ccw` de 44 px, tono `info`
  (mismo `accent` que el reenvío); título y descripción junto al icono; sin defectos a la vista.

Veredicto: los cuatro diálogos pintan el icono de 44 px con el tono esperado; la baja de empresa
respeta el orden cifras→aviso→campo pero desalinea el título (centrado) y estrecha el aviso.
