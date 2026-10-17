# QC-166 — Área del Maestro · design

> Zona: `frontend` · `depends_on`: QC-162 (`done`), QC-235 (`done`), QC-165 (`pending`, en
> especificación en paralelo). Tableros aprobados: § 2.

## Lo que ya existe

Términos buscados: «maestro», «empresas», «administradores», «companies», «Plataforma»,
«homeHrefFor», «CompanyModulesTab», «ADDON_LABELS», «user-form».

| Dónde | Qué apareció | Qué se hace |
|---|---|---|
| Board (`feature_list.json`) | QC-162 (servidor de empresas, `done`), QC-235 (país, `done`), QC-165 (servidor de Administradores, `pending`), QC-278 (pestaña Módulos, `pending`, depende de esta), QC-267 (rediseño de Configuración, `spec_ready`, toca `configuracion/usuarios/components/user-form.tsx`). Ninguna otra ficha con pantallas del Maestro. | Nada se duplica. QC-278 monta su pestaña en el hueco de § 6.4; QC-165 entrega las acciones de § 5. `user-form.tsx` no se toca (§ 7.2). |
| `specs/` | QC-161 R33 deja el aterrizaje del Maestro en «el destino que resulta de filtrar el menú con sus permisos» y prevé que un enlace con `empresas.consultar` lo cambie. QC-162 R3 y QC-235 § 5.2 dejan sus acciones sin `revalidatePath` «porque la pantalla es de QC-166». QC-235 § 5.2 fija el contrato de `CountrySelect` con QC-166 (`<input type="hidden" name="country">` con `value ?? ''`). QC-278 `design.md > 3` y `> 10` proponen el montaje de `CompanyModulesTab` y piden reutilizar `ADDON_LABELS`. | Se siguen los tres contratos. El de QC-278 se adopta tal cual salvo lo de § 6.5, declarado como contrato para QC-278. |
| Código: rutas y menú | `lib/shared/routes.ts` (sin ninguna ruta `/maestro`), `PRIVATE_ROUTE_PREFIXES`, `lib/shared/navigation/private-nav.ts` (`PRIVATE_NAV_ITEMS`, `filterNavItemsByPermissions`, `homeHrefFor`), `nav-icons.ts`, `app/(private)/layout.tsx`, `components/private/app-sidebar.tsx`, `nav-user.tsx`, `app/(private)/not-found.tsx`. Callers de `homeHrefFor`: `login-action.ts`, `home-route.ts` (`/inicio`), `e2e/helpers/landing.ts`. | Se reutilizan sin cambiar su código salvo añadir datos (§ 3). |
| Código: servidor | `lib/modules/identity/adapters/driving/company-actions.ts`: `listCompaniesAction`, `getCompanyAction`, `getCompanyDeletionImpactAction`, `listCompanyEventsAction`, `createCompanyAction`, `updateCompanyAction`, `deleteCompanyAction`, `reactivateCompanyAction`, `setCompanyCountryAction` (y las de añadidos, de QC-278). `requirePagePermission`, `assertPermission`. Códigos `company_*` y `last_administrator` ya en `lib/modules/errores`. `COMPANY_FIELDS`, `COMPANY_EVENT_KINDS`, `ADDONS`. | Se consumen tal cual: esta ficha no cambia el servidor (§ 4). |
| Código: pantallas parecidas | `app/(private)/clientes/page.tsx` y `configuracion/usuarios/page.tsx` (corte por permiso, `canModify` por `assertPermission`, lista en la dirección, `Suspense`); `user-sheet.tsx` (lee la ficha con una acción al abrir); `whatsapp-connection-actions.tsx` (acción llamada con `FormData` dentro de `startTransition`). | Se copia el patrón, no el código. |

### Catálogo consultado (`components/shared/CATALOGO.md`)

Filas consultadas y uso:

| Pieza | Uso aquí |
|---|---|
| `DataTable` (con `card`, `actionsColumn({ menu })`, `withFilter`, `withSearch`, `withSort`, `withPage`) | Listas de empresas y de Administradores, sus tarjetas en teléfono, filtros «Estado» y «Empresa», búsqueda, orden, paginación y estados internos. |
| `RowActionsMenu` | Menú de cada fila (vía `actionsColumn`), centrado en tarjetas. |
| `FormSheet`, `SaveButton`, `useEntitySheet` | Paneles «Nueva empresa», «Editar empresa», «Nuevo administrador», «Editar administrador»; cierre, toast y `router.refresh()` al guardar. |
| `TextField`, `SelectField`, `DatePicker` (`single`) | Campos de empresa y de persona (`DatePicker` para la fecha de nacimiento, como pide la ficha del tablero). |
| `CountrySelect` | País en «Editar empresa». |
| `ConfirmDialog`, `ConfirmDialogFrame`, `ConfirmDialogBody` | Baja y reactivación de empresa, baja de Administrador. |
| `Notice` | Aviso del correo (`info`), aviso del último Administrador (`warning`), rechazo de la reactivación (`danger`). |
| `ErrorAlert`, `UnexpectedErrorNotice`, `FieldError` | Región de error de paneles y diálogos; error junto a campo. |
| `StatusBadge` | Estado de empresa («Activa» `success`, «De baja» `muted`) y de Administrador. |
| `PageHeader`, `PageShell` | Cabecera con miga y acciones, contenedor de página. |
| `UrlTabs` | Pestañas Datos, Módulos e Historial como enlaces. |
| `EmptyState`, `ErrorState`, `TableSkeleton`, `Skeleton`, `Spinner` | Vacío, error con «Reintentar», esqueletos y «Calculando el impacto…». |
| `Card` | Caja de la pestaña Datos. |
| `Toaster` + `toast` de `sonner` | Avisos de éxito; el `<Toaster />` ya lo monta `app/(private)/layout.tsx`. |
| `EMPTY_MARK`, `countryOptionLabel` | Marca de vacío; «Colombia (+57)». |
| `SidebarProvider`, `Sidebar`, `SidebarMenuButton` | Sin cambios: la barra lateral del área es la misma `AppSidebar` con otros datos (§ 3.2). |

### Componentes nuevos y el paso de la regla que los justifica

Todos son de ruta (paso 4 de la regla de decisión, o paso 3 cuando solo componen piezas del
catálogo) y viven en `components/` de su ruta con barrel; ninguno entra en `components/shared`
salvo `AdministratorFields` y `ADDON_NAMES` (§ 7.2, § 6.5).

| Pieza | Ruta | Paso | Por qué no basta lo que hay |
|---|---|---|---|
| `CompanyTable`, `CompanyListSection`, `companyColumns`, `parseCompanyListParams` | `maestro/empresas/components/` | 3 (compone `DataTable`, `StatusBadge`, `RowActionsMenu`) | `DataTable` no conoce empresas: columnas, menú por estado y vacío de «De baja» son de la ruta. |
| `CompanyCreateSheet` | `maestro/empresas/components/` | 3 (`FormSheet`, `TextField`, `AdministratorFields`, `Notice`) | No existe formulario de empresa. |
| `CompanyEditSheet` | `maestro/empresas/components/` | 3 (`FormSheet`, `TextField`, `CountrySelect`) | Ídem; se usa desde la lista y desde el detalle (§ 7.3). |
| `CompanyDeleteDialog`, `CompanyReactivateDialog` | `maestro/empresas/components/` | 3 (`ConfirmDialog`, `TextField`, `Notice`, `Spinner`) | `DeleteConfirmDialog` trae «Eliminar», no la confirmación por nombre ni el impacto. |
| `CompanyDetailHeader`, `CompanyDataPanel`, `CompanyHistoryPanel`, `companyEventText` | `maestro/empresas/[id]/components/` | 3 (`PageHeader`, `UrlTabs`, `Card`, `StatusBadge`) | Contenido propio del detalle. La línea de tiempo del Historial es UI visible nueva: tablero `MaestroEmpresa.dc.html` (`pestana="historial"`) y `MaestroEmpresaHistorial.dc.html`. |
| `AdministratorTable`, `AdministratorListSection`, `AdministratorSheet`, `AdministratorDeleteDialog` | `maestro/administradores/components/` | 3 | No hay pantalla de Administradores por empresa. |
| `AdministratorResendLinkDialog` | `maestro/administradores/components/` | 3 (`ConfirmDialog`, `ErrorAlert`) | Confirmación del reenvío (§ 5.4); `ConfirmDialog` no trae textos. |
| `AdministratorFields` | `components/shared/administrator-fields.tsx` | 3, subida declarada | La necesitan dos rutas en esta misma ficha (alta de empresa y alta/edición de Administrador). `UserForm` no sirve: es un `FormSheet` completo atado a `createUserAction` y lo está cambiando QC-267. |

Las dos piezas compartidas ganan su fila en el catálogo en el mismo commit, con `Diseño` =
`docs/diseno/canvas/ModalesMaestro.dc.html`, `docs/diseno/canvas/MaestroEmpresas.dc.html` (y
`MaestroAdministradores.dc.html` para `AdministratorFields`).

## 1. Resumen técnico

- **Sin cambios de servidor ni de base.** Todo lo que lee y escribe la pantalla existe ya
  (QC-162, QC-235) o lo trae QC-165 (§ 5).
- **El área vive dentro de `app/(private)/`**, con el mismo layout, cabecera, `<Toaster />` y
  barra lateral. Lo que la separa del ERP son los **permisos**: los enlaces de «Plataforma» exigen
  `empresas.consultar`, que solo tiene el Maestro, y el Maestro no tiene ningún permiso del ERP,
  así que su menú filtrado es exactamente «Plataforma» (R2, R3) y `homeHrefFor` lo aterriza en
  Empresas sin cambiar su código (R4, R5).
- Tres páginas Server Component: lista de empresas, detalle con pestañas por dirección y lista de
  Administradores. El estado de lista y la pestaña viven en la dirección.
- Las mutaciones van por las Server Actions existentes desde componentes de cliente, y al terminar
  se refresca con `router.refresh()` (`useEntitySheet`), no con `revalidatePath` (§ 9.C).

## 2. Referencias de diseño (tableros aprobados)

| Tablero | Qué fija |
|---|---|
| `docs/diseno/canvas/MaestroEmpresas.dc.html` | Lista: columnas, búsqueda, chip «Estado», menú por estado, vacío de «De baja», panel «Nueva empresa», panel «Editar empresa», diálogos de baja y reactivación, toasts. |
| `docs/diseno/canvas/MaestroEmpresasTablet.dc.html` | Barra lateral en modo icono, tabla con scroll horizontal en su caja, paneles de 600 px. |
| `docs/diseno/canvas/MaestroEmpresasMovil.dc.html` | Tarjetas, «Acciones» centrado con objetivos de 48 px, paneles a pantalla completa con una columna. Ficha: Reutiliza, Librerías, Escritorio, Tablet, Teléfono, Animación, Por confirmar. |
| `docs/diseno/canvas/MaestroEmpresa.dc.html` | Detalle: miga, título, estado, acciones de cabecera, pestañas, pestaña Datos (lista clave-valor), pestaña Historial (línea de tiempo con autor e instante, paginación). |
| `docs/diseno/canvas/MaestroEmpresaTablet.dc.html`, `MaestroEmpresaMovil.dc.html` | Pestañas con scroll horizontal, botones de cabecera a todo el ancho; ficha del detalle. |
| `docs/diseno/canvas/MaestroEmpresaHistorial.dc.html` | El detalle con `pestana="historial"`. |
| `docs/diseno/canvas/MaestroAdministradores.dc.html`, `MaestroAdministradoresTablet.dc.html`, `MaestroAdministradoresMovil.dc.html` | Lista única, filtro «Empresa», menú Editar/Dar de baja, panel «Nuevo administrador», tarjetas en teléfono; ficha. |
| `docs/diseno/canvas/ModalesMaestro.dc.html` | Todos los paneles y diálogos abiertos con sus errores: nombre repetido, País con buscador, nombre que no coincide, identificación ocupada al reactivar, último Administrador. |
| `docs/diseno/canvas/Sidebar.dc.html` (prop `area="maestro"`) | Sección «Plataforma» con Empresas e Administradores; pie con el nombre del Maestro y «Maestro». |

### 2.1 Lo que las fichas dejaban «Por confirmar» y cómo queda

| Punto | Resuelto por |
|---|---|
| Qué pasa con usuarios y pedidos de una empresa de baja | Decisión cerrada «¿Qué dice la baja?» (R23) |
| Toast si falla el correo al Administrador inicial | Pregunta abierta 1 (R18) |
| Nombre del Maestro en la barra lateral | `NavUser` ya pinta `displayName` y `roleName` de la sesión: sin cambio |
| Si QuimiCloud se lista | Decisión cerrada: sí (R12) |
| Si el Historial nombra al Maestro | Decisión cerrada: nombre y apellidos del autor (R31) |
| Contenido de la pestaña Módulos | QC-278 (§ 6.4) |
| Último Administrador, mover de empresa, agrupar o filtrar | Decisiones cerradas; filtrar (R35, R38, R40) |

### 2.2 Desvíos del tablero, declarados

- **Menú de una empresa de baja:** el tablero de la lista ya trae «Abrir», «Editar», «Reactivar»;
  la ficha escrita dice «solo Abrir y Reactivar». Gana la decisión cerrada (Editar sí).
- **Cabecera del detalle de una empresa de baja:** pregunta abierta 5 (por defecto, «Editar» y
  «Reactivar»).
- **Pestaña por defecto:** «Datos», no «Módulos» (pregunta abierta 3).
- **Fecha de nacimiento:** el tablero no la marca obligatoria; el servidor la exige (QC-162 R12 =
  reglas del alta de usuario). El campo lleva la marca de obligatorio para no prometer lo que el
  servidor rechaza.
- **Teléfono y número de documento del Administrador** (decisión cerrada del 2026-10-16): también
  llevan la marca de obligatorio, por el mismo motivo; el servidor los exige (QC-165). Los seis
  obligatorios de texto de `AdministratorFields` son Nombres, Apellidos, Correo, Teléfono, Número
  de documento y Nombre de usuario, más la Fecha de nacimiento.
- **Fechas:** pregunta abierta 2.
- **Placeholder de Fecha de nacimiento** (aceptado en la revisión, 2026-10-16): `aaaa-mm-dd`, lo
  que pinta `DatePicker`, no el `dd/mm/aaaa` del tablero. Las fechas de lista e Historial sí van
  en `dd/mm/aaaa`.
- **Esqueleto del detalle** (decisión cerrada del 2026-10-16, enmienda R34): el detalle no lleva
  esqueleto; lee la empresa antes de pintar para que R27 responda un 404 real. El Historial sí.
- **Iconos de los diálogos** (revisión, 2026-10-16; en lo visual manda el tablero): la baja de
  empresa, la de Administrador y el reenvío del enlace llevan el icono del tablero.
  `ConfirmDialog` gana una prop opcional `icon` que se pinta en `AlertDialogMedia` (paso 2 de la
  regla de decisión: extensión aditiva, sin cambio para los consumidores actuales).
- **Orden del diálogo de baja de empresa** (revisión, 2026-10-16): cifras de impacto → aviso →
  campo de confirmación, como el tablero; el aviso va en `children` de `ConfirmDialog`, antes del
  campo.

### 2.3 Listas cerradas que amplía la ficha

Las guardias que fijan con igualdad exacta quién puede hacer algo se amplían con su bloque
fechado, sin aflojar el `toEqual`:

| Test | Qué entra |
|---|---|
| `tests/unit/identity/roles/maestro-rol.test.ts` (R17, `RUTAS_ABIERTAS_EMPRESAS`) | Bloque «Enmienda QC-166»: `lib/shared/navigation/private-nav.ts` (el menú declara `empresas.consultar` en sus enlaces) y las páginas `maestro/empresas/page.tsx`, `maestro/empresas/[id]/page.tsx` y `maestro/administradores/page.tsx` (cortan con él). |
| `tests/unit/shared/data-table-alcance.test.ts` (R34) | `/maestro/empresas` y `/maestro/administradores` como consumidoras de `DataTable`. |
| `tests/guards/guard-pantallas-exigen-permiso.test.ts` | Las tres pantallas del área. |
| `tests/guards/guard-identificador-de-request.test.ts` | Los tres specs E2E de § 10. |
| `tests/unit/identity/account-status-scope.test.ts` (R19) | `administrator-columns.tsx` (columna Estado y «Reenviar enlace» solo en `pending`). |

## 3. Rutas y navegación

### 3.1 `lib/shared/routes.ts`

```ts
export const MAESTRO_COMPANIES_ROUTE = '/maestro/empresas';
export function maestroCompanyRoute(id: string, tab?: 'datos' | 'modulos' | 'historial'): string;
export const MAESTRO_ADMINISTRATORS_ROUTE = '/maestro/administradores';
```

`PRIVATE_ROUTE_PREFIXES` gana `MAESTRO_COMPANIES_ROUTE` (cubre también `[id]`, por segmentos) y
`MAESTRO_ADMINISTRATORS_ROUTE`. No se declara `'/maestro'`: no hay pantalla en esa dirección
(mismo criterio que `/configuracion`). `guard-rutas-privadas-cubiertas` exige que prefijos y
`page.tsx` entren juntos.

### 3.2 Menú: `private-nav.ts` y `nav-icons.ts`

- `NAV_SECTION_PLATFORM = 'Plataforma'`, `COMPANIES_LABEL = 'Empresas'`,
  `ADMINISTRATORS_LABEL = 'Administradores'`.
- Dos `NavLink` **al final** de `PRIVATE_NAV_ITEMS`, sección «Plataforma», `permission:
  'empresas.consultar'`, `testId` `nav-empresas` y `nav-administradores`, iconos `building-2` y
  `shield-user` (los trazos del tablero de `Sidebar` son `Building2` y `ShieldUser` de
  `lucide-react`, ya instalado; ambos existen en la versión del repo).
- `NavIconName` y `NAV_ICONS` ganan esas dos filas.
- **Por qué al final:** `firstVisibleNavHref` recorre en orden. Ningún rol de empresa tiene
  `empresas.*` (`permissions.ts:275-276`), así que para ellos el array filtrado no cambia (R5);
  para el Maestro el primer enlace visible es Empresas (R4). `homeHrefFor`, el login, `/inicio`, el
  logo y `e2e/helpers/landing.ts` no se tocan: derivan de aquí (QC-161 R33 lo preveía).
- `AppSidebar` y `NavUser` no cambian: el tablero `area="maestro"` se materializa como datos
  filtrados por permiso. La marca de «actual» compara la dirección exacta (como hoy en el resto del
  menú), así que en el detalle `/maestro/empresas/[id]` ningún enlace queda marcado; es el mismo
  comportamiento que `/proveedores/[id]` y no se cambia aquí.
- `tests/unit/navegacion/orden-secciones.test.ts` y los tests del menú se amplían con la sección
  nueva; `guard-nav-permisos-declarados` ya acepta `empresas.consultar`.

### 3.3 Páginas

| Archivo | Corte | Lee | Monta |
|---|---|---|---|
| `app/(private)/maestro/empresas/page.tsx` | `requirePagePermission('empresas.consultar')` en la primera línea | `canModify` (`assertPermission(user, 'empresas.modificar', …)`, patrón de `clientes/page.tsx`); `searchParams` después del corte | `PageHeader` («Plataforma» / «Empresas», «Nueva empresa» si `canModify`), `<Suspense>` (sin `key`, ver abajo) con `CompanyListSection` |
| `app/(private)/maestro/empresas/[id]/page.tsx` | Ídem | `params.id` (no UUID → `notFound()`), `getCompanyAction(id)` (`company_not_found` → `notFound()`; otro error → `ErrorState`), `tab`, `page` del historial | `CompanyDetailHeader`, `UrlTabs`, el panel de la pestaña vigente |
| `app/(private)/maestro/administradores/page.tsx` | Ídem | `canModify`, `searchParams`, las empresas activas para el filtro y el panel (§ 5.5) | `PageHeader` («Nuevo administrador» si `canModify`), `<Suspense>` con `AdministratorListSection` |

Cada página: `export const metadata = { title: \`${LABEL} · ${BRAND_LABEL}\` }`, contenedor
`PageShell`, sin landmark `main` propio.

Ajustes aceptados en la revisión (2026-10-16):
- **Lista de empresas:** `<Suspense>` **sin** `key={query}`. Con la clave, cada búsqueda remonta
  la sección y quien escribe pierde el foco. R15 se cumple en la primera carga; en las
  navegaciones la tabla queda con `aria-busy` dentro de `startTransition`, el patrón de
  `clientes/page.tsx`.
- **Detalle:** sin `loading.tsx` ni `Suspense` alrededor de la lectura de la empresa (§ 2.2,
  esqueleto del detalle); el `Suspense` con esqueleto queda solo en el Historial.

### 3.4 Parámetros de la dirección

- Lista de empresas: `page`, `pageSize`, `sort` (`name` | `createdAt`), `dir`, `q`, `estado`
  (`activa`, `de-baja` o los dos separados por coma). Se traducen a la consulta de § 4 con
  `filters.status = { kind: 'select', values: [...] }`; sin `estado`, sin filtro (el servidor da
  solo activas, QC-162 R30). Lo desconocido se ignora.
- Detalle: `tab` (`datos` | `modulos` | `historial`, desconocido → defecto de la pregunta 3),
  `page` del historial (solo con `tab=historial`).
- Administradores: `page`, `pageSize`, `empresa` (UUID) y lo que acepte el contrato de QC-165.

## 4. Contratos con el servidor existente (QC-162, QC-235)

Las acciones se importan por su ruta exacta
(`@/lib/modules/identity/adapters/driving/company-actions`), nunca desde el barrel del módulo. El
estado inicial `{ status: 'idle' }` lo construye cada componente.

| Acción | Entrada que manda la pantalla | Quién la llama | Errores que se pintan |
|---|---|---|---|
| `listCompaniesAction(query)` | `{ page, pageSize, sort: { columnId, direction } \| null, filters: { status? }, search }` | `CompanyListSection` (servidor); `loadActiveCompanies` (§ 5.5) | Cualquiera → `ErrorState` (R15) |
| `getCompanyAction(id)` | UUID | `[id]/page.tsx`; `CompanyEditSheet` desde la lista, al abrir (la fila no trae correo ni teléfono) | `company_not_found` → 404 en la página; en el panel, región de error |
| `getCompanyDeletionImpactAction(id)` | UUID | `CompanyDeleteDialog` al abrir, en `startTransition` | Región de error del diálogo, confirmar deshabilitado (R24) |
| `listCompanyEventsAction({ companyId, page, pageSize })` | — | `CompanyHistoryPanel` (servidor) | `ErrorState` (R34) |
| `createCompanyAction(prev, formData)` | `name`, `taxId`, `contactEmail`, `contactPhone`, `adminFirstNames`, `adminLastNames`, `adminBirthDate`, `adminEmail`, `adminPhone`, `adminDocumentTypeCode`, `adminDocumentNumber`, `adminUsername` | `CompanyCreateSheet` | Mapa de R19; `success.mail` decide el toast (R18) |
| `updateCompanyAction(prev, formData)` | `companyId` + los cuatro datos | `CompanyEditSheet` | Mapa de R19 |
| `setCompanyCountryAction(prev, formData)` | `companyId`, `country` (`<input type="hidden">` = `value ?? ''`, contrato de QC-235) | `CompanyEditSheet`, solo tras el éxito de la anterior (R21, R22) | Error junto a País |
| `deleteCompanyAction(prev, formData)` | `companyId`, `confirmationName` | `CompanyDeleteDialog` | `company_name_mismatch` junto al campo; resto en la región del diálogo |
| `reactivateCompanyAction(prev, formData)` | `companyId` | `CompanyReactivateDialog` | `Notice` `danger` con el mensaje del catálogo (R26) |

**Edición en dos pasos (R21, R22).** El servidor separa datos y país (QC-162 R5 rechaza `country`
en la edición). `CompanyEditSheet` llama a `updateCompanyAction` y, si responde `success`, a
`setCompanyCountryAction` con el país elegido aunque no haya cambiado (QC-162 R36: el mismo país
no deja evento). Si el segundo falla, el panel queda abierto con el error en País y se llama a
`router.refresh()` para que la lista refleje lo ya guardado.

## 5. Contrato con QC-165 (dependencia)

Alineado con `.worktrees/QC-165-administradores-por-el-maestro/specs/QC-165-administradores-por-el-maestro/design.md`
(versión del 2026-10-16, con el reenvío: sus R26–R29). Todo lo que se cita aquí está escrito en
ese spec; nada se inventa. Si QC-165 cambia algo antes de mergear, T9 lo realinea y pasa por el
leader si cambia un requisito.

### 5.1 Lo que QC-165 entrega (su `design.md > 1`, `> 3.2`, `> 3.5`, `> 3.6`, `> 6`, `> 8`)

Archivo `lib/modules/identity/adapters/driving/administrator-actions.ts` (`'use server'`, sin
`revalidatePath`, importado por ruta exacta):

| Acción | Entrada | Salida | Usada por |
|---|---|---|---|
| `listAdministratorsAction(query)` | `ListQuery`; filtro `{ companyId: { kind: 'select', values: [uuid…] } }`; `search`; orden por `lastNames`, `firstNames`, `username`, `email`, `accountStatus`, `createdAt`, `companyName` | `Page<AdministratorRow>` o `ErrorState` | `AdministratorListSection` (R35, R42) |
| `getAdministratorAction(id)` | uuid | `AdministratorDetail` o `ErrorState` | `AdministratorSheet` al editar (R38) |
| `createAdministratorAction(prev, formData)` | `companyId`, `firstNames`, `lastNames`, `birthDate`, `email`, `phone`, `documentTypeCode`, `documentNumber`, `username` | `{ status: 'success', administratorId, mail: 'sent' \| 'failed' }` o `ErrorState` | `AdministratorSheet` alta (R37, pregunta 6) |
| `updateAdministratorAction(prev, formData)` | `id` + los ocho datos; **no** `companyId` | `{ status: 'success' }` o `ErrorState` | `AdministratorSheet` edición (R38) |
| `deleteAdministratorAction(prev, formData)` | `id` | `{ status: 'success' }` o `ErrorState` | `AdministratorDeleteDialog` (R39, R40) |
| `resendAdministratorLinkAction(prev, formData)` | solo `id` (ni correo ni empresa) | `ResendAdministratorLinkFormState` = `{ status: 'success', mail: 'sent' \| 'failed' }` o `ErrorState` | `AdministratorResendLinkDialog` (R46–R49) |

- `AdministratorRow` y `AdministratorDetail` traen `firstNames`, `lastNames`, `username`, `email`,
  `company: { id, name }`, `accountStatus` y **`isLastAdministrator`**: R40 deshabilita la baja con
  esa marca, sin provocar el error.
- Errores (su § 8): `unauthorized`, `invalid_input`, `user_not_found`, `company_not_found`,
  `duplicate_email`, `duplicate_username`, `duplicate_document`, **`user_not_pending`** (reenvío a
  quien no está en `pending`, ya en el catálogo por QC-79) y **`company_last_administrator`**
  (texto del catálogo: «Es el único Administrador de la empresa: crea otro antes de darlo de baja.»),
  que R40 pinta si la baja llega igual al servidor. `CODE_TO_FIELD` de `AdministratorSheet` mapea
  los tres duplicados; `company_not_found` (la empresa se dio de baja mientras el panel estaba
  abierto) va a la región del panel.
- `AdministratorFields` se usa **sin prefijo** aquí: los nombres de campo coinciden con los de la
  acción. La edición no manda `companyId` (su esquema lo rechazaría).
- Para el selector de empresa del alta, QC-165 remite a `listCompaniesAction` (§ 5.5).

### 5.2 Estado de cuenta

`accountStatus` es el almacenado (`UserAccountStatus`). El tablero pinta «Activo» (`success`) y
«Pendiente» (`neutral`); QC-165 sugiere «Pendiente sin contraseña» para `pending`. Gana el tablero
aprobado: «Pendiente». La tabla vive en `maestro/administradores/components/administrator-labels.ts`;
un estado sin fila se pinta con su código y tono `neutral`, sin fallar.

### 5.3 Reenvío del enlace (QC-165 R26–R29, su § 3.5 y § 3.6)

- Caso de uso `resend-administrator-link.ts`, permiso `empresas.modificar`. Entrada: solo `id`
  (clave extra → `invalid_input`; id no uuid o Administrador no gestionable → `user_not_found`).
  Emite con la empresa del Administrador y responde `{ mail }`.
- **Solo para cuentas en `pending`:** a cualquier otra responde `user_not_pending`. Por eso la
  pantalla declara el ítem solo en filas con `accountStatus === 'pending'` (R36); el error sigue
  pintándose en el diálogo si la persona fijó su contraseña entre la carga de la lista y la
  confirmación (R48).
- `mail: 'sent'` → «Enviamos el enlace a <nombre>.»; `mail: 'failed'` → texto de la pregunta
  abierta 8 (R47). Un reenvío que pierde la carrera con otro cuenta como `sent` en el servidor
  (`superseded` → `sent`), sin segundo correo: la pantalla no lo distingue.

### 5.4 Diálogo de reenvío

`AdministratorResendLinkDialog` (`maestro/administradores/components/`, paso 3: compone
`ConfirmDialog` con `onConfirm` dentro de `startTransition`, `isPending`, `error` con `ErrorAlert`).
Se abre desde el ítem «Reenviar enlace» de `actionsColumn({ menu })`, que `RowActionsMenu` pinta en
las dos presentaciones (desplegable y centrada en tarjeta), así que R36 en teléfono sale de la misma
declaración; el ítem solo se añade a la lista de la fila si `accountStatus === 'pending'`. Manda un
`FormData` con solo `id`. Al terminar con éxito: cierra y `toast.success` / `toast.warning` según
`mail` (R47); **sin** `router.refresh()`, porque la fila no cambia. Rechazo: diálogo abierto con el
mensaje (R48).

Referencia de diseño: `docs/diseno/canvas/MaestroAdministradores.dc.html` (ya trae el ítem en el
menú ⋯ y en el de tarjeta, l. 54 y 126, y el diálogo, l. 116-121: icono de correo `info`, título
«¿Reenviar el enlace a <nombre>?», cuerpo con el correo en negrita, «Volver» y «Reenviar enlace»
como primario) y su ficha `MaestroAdministradoresMovil.dc.html` (l. 23, 27). El tablero ofrece el
ítem en todas las filas; esta ficha lo limita a «Pendiente» por el contrato de QC-165 (desvío
declarado, decisión del leader del 2026-10-16). El tablero deja «Por confirmar» el texto de fallo
del correo: pregunta abierta 8.

### 5.5 Empresas activas para el filtro y el panel

`administradores/page.tsx` pide las empresas activas con `listCompaniesAction` recorriendo las
páginas de 25 hasta `totalPages` (`loadActiveCompanies`, en la ruta). Alimenta el `SelectField`
«Empresa» del panel y las opciones del filtro. Es una lectura acotada por el número de empresas de
la plataforma; si un día pesa, se cambia por búsqueda (§ 9.B).

## 6. Detalle de empresa (`/maestro/empresas/[id]`)

### 6.1 Cabecera

`CompanyDetailHeader` (cliente): `PageHeader` con migas «Empresas» (`MAESTRO_COMPANIES_ROUTE`,
enlazada) › nombre de la empresa (último paso, el actual; el tablero pinta solo «Empresas ›», se
acepta la convención del repo, como `producto-terminado/[id]`), título = nombre, `StatusBadge`, y acciones según estado y `canModify` (R28, pregunta 5). Abre
`CompanyEditSheet`, `CompanyDeleteDialog` y `CompanyReactivateDialog`, los mismos de la lista.

### 6.2 Pestañas

`UrlTabs` con tres `href` de `maestroCompanyRoute(id, tab)`. La página decide la vigente y monta
solo su panel.

### 6.3 Datos e Historial

- `CompanyDataPanel`: `Card` con lista clave-valor de `CompanyDetail` (R29). Una columna con
  contenedor de 760 px o menos (tablero).
- `CompanyHistoryPanel` (servidor, con su `Suspense`): `listCompanyEventsAction` con `page` de la
  dirección y `pageSize` por defecto. Línea de tiempo `<ol>` con icono por tipo (los trazos del
  tablero: alta, edición, prender, apagar), texto de `companyEventText(event)`, autor
  `${firstNames} ${lastNames}` e instante. Paginación «Página N de M · T en total» con anterior y
  siguiente como enlaces.
- `companyEventText` (puro, en la ruta): por `kind` (`COMPANY_EVENT_KINDS`), campos por
  `COMPANY_FIELDS` → etiqueta, unidos con `Intl.ListFormat('es', { type: 'conjunction' })`
  («País y Teléfono de contacto»); añadido por `ADDON_NAMES` (§ 6.5). Desconocido → texto de la
  pregunta 4, sin lanzar (R33).

### 6.4 Pestaña Módulos: el hueco para QC-278 (contrato adoptado)

Se adopta el contrato de `QC-278 design.md > 3` sin cambios de forma:

- Esta ficha crea `app/(private)/maestro/empresas/[id]/components/index.ts` (el barrel de la ruta,
  suyo) y deja en `page.tsx`, para `tab === 'modulos'`, un panel `role="tabpanel"` vacío con el
  comentario de montaje fuera (sin citar fichas). **No crea** `components/modulos/` ni importa
  `CompanyModulesTab`, que no existe hasta QC-278.
- La página ya resuelve los cuatro valores que pide el contrato: `companyId = company.id`,
  `companyName = company.name`, `isDeleted = company.status === 'deleted'` (equivale a
  `deletedAt !== null`) y `canModify`. QC-278 añade en F2.3 `export * from './modulos';` al barrel
  y la línea `<CompanyModulesTab … />` en el panel.
- **`<Toaster />`:** el área no tiene layout propio; vive en `app/(private)/` y usa el
  `<Toaster />` de `app/(private)/layout.tsx`. El aviso de QC-278 § 3 no aplica.
- La pestaña Módulos no llama a `getCompanyAddonsAction` (R30).

### 6.5 Nombres de los añadidos: cambio declarado como contrato para QC-278

QC-278 propone `ADDON_LABELS` en `components/modulos/` y subirlo a `lib/shared/ui/` cuando lo pida
una segunda ruta. El Historial de esta ficha necesita **solo los nombres** y se puede mergear antes
que QC-278, así que **esta ficha crea la fuente de los nombres**:

```ts
// lib/shared/ui/addon-names.ts  ('sin UI', fila en el catálogo)
export type AddonNameKey = 'dashboard' | 'proveedores' | 'lectura_pdf' | 'importacion_excel' | 'integraciones';
export const ADDON_NAMES: Readonly<Record<AddonNameKey, string>> = {
  dashboard: 'Dashboard y recorrido',
  proveedores: 'Proveedores',
  lectura_pdf: 'Lectura de PDF con IA',
  importacion_excel: 'Importación desde Excel',
  integraciones: 'Integraciones',
};
```

- `lib/shared/**` no importa módulos, así que la clave es una unión propia; un test de tipos la
  iguala a `Addon` de `identity` (mismo patrón que `OrderStatusKey` en `lib/shared/ui/order-status.ts`).
- Los nombres son los del tablero (`MaestroEmpresa.dc.html`, l. 163-167).
- **Contrato para QC-278:** su `ADDON_LABELS` toma `name` de `ADDON_NAMES` (y conserva en su
  carpeta `description` e `icon`), en vez de escribir los nombres otra vez. Se anota en
  `progress/features/QC-166.md` para el leader.

## 7. Componentes

### 7.1 Lista de empresas

- `CompanyListSection` (servidor) pide la página y pinta `CompanyTable`; con error, la tabla en
  estado `error` (`ErrorState` con «Reintentar» = `router.refresh()`).
- `CompanyTable` (cliente) sobre `DataTable`: columnas de R8 (`Usuarios` = `liveUserCount`,
  `tabular`; `Creada` con el formato de la pregunta 2), `searchable` con el texto del tablero
  «Buscar empresas por nombre o identificación fiscal», filtro `select` en `status`, `sortable` en
  Nombre y Creada, `card` con `primary` = nombre, `status` = insignia, `meta` = identificación y
  país, `footer` = usuarios y fecha (R16). `onParamsChange` navega con `router.replace` a la
  dirección nueva.
- Menú por fila con `actionsColumn({ menu })` (R14): «Abrir» y «Módulos» son `href`; «Editar»,
  «Dar de baja», «Reactivar» abren el panel o diálogo, solo si `canModify` (R6).
- Vacío (R15): `EmptyState` con icono y encabezado «No hay empresas de baja» y el botón «Quitar el
  filtro» si el filtro es solo `deleted`; si no, `EmptyState` con `clearSearch`.

### 7.2 `AdministratorFields` (`components/shared/administrator-fields.tsx`)

Bloque de campos de persona sin `<form>` propio, para meter dentro de un `FormSheet`:

```ts
type AdministratorFieldsProps = {
  readonly namePrefix?: string;            // 'admin' en el alta de empresa → adminFirstNames…
  readonly defaultValues?: Partial<Record<AdministratorFieldName, string>>;
  readonly errors?: Partial<Record<AdministratorFieldName, string>>;
  readonly testIdPrefix: string;
};
```

- Campos y orden del tablero: Nombres y Apellidos (fila), Fecha de nacimiento (`DatePicker`
  `single`, `YYYY-MM-DD` oculto), Correo y Teléfono (fila), Tipo de documento (`SelectField` con
  `DOCUMENT_TYPE_CODES`) y Número de documento (fila), Nombre de usuario. Una columna con
  contenedor estrecho.
- Los nombres de campo con prefijo: `namePrefix + Capitalizado` (`adminFirstNames`, …) para el alta
  de empresa (contrato de `company-actions.ts`); sin prefijo para Administradores, o lo que pida
  QC-165.
- Sin rol, sin empresa, sin contraseña. Los valores viajan tal cual; el servidor normaliza.
- **Por qué no `UserForm`:** es un panel completo atado a `createUserAction`/`updateUserAction`
  con el campo Rol, y QC-267 (`spec_ready`) lo está rediseñando: extraer de él choca en archivos con
  esa ficha. Se compone de cero con `TextField`, `SelectField` y `DatePicker`.

### 7.3 Paneles y diálogos de empresa

- `CompanyCreateSheet`: `FormSheet` ancho (tablero: «Sheet ancho»), secciones «Empresa» y
  «Administrador inicial», `Notice` `info` del correo, `useActionState` con
  `createCompanyAction`, `useEntitySheet` con mensaje según `mail` (R18). Errores por código
  (R19) con un `CODE_TO_FIELD` tipado con `ErrorCode`.
- `CompanyEditSheet`: carga la ficha al abrir si no la tiene (lista) o la recibe (detalle);
  `CountrySelect` controlado + `<input type="hidden" name="country">`; envío en dos pasos (§ 4).
- **Dónde viven los tres que comparten lista y detalle.** `CompanyEditSheet`,
  `CompanyDeleteDialog` y `CompanyReactivateDialog` viven en
  `app/(private)/maestro/empresas/components/` (la lista es la dueña) y el detalle, ruta hija, los
  importa del barrel del padre (`from '../components'`), nunca por archivo. No suben a
  `components/shared`: son de la misma rama de rutas y nadie fuera de ella los necesita.
- `CompanyDeleteDialog`: `ConfirmDialog` `destructive`; al abrir pide el impacto
  (`Spinner` + «Calculando el impacto…»), dos cifras en `<dl>`, aviso, `TextField` de
  confirmación; `confirmDisabled` mientras no hay impacto o el campo está vacío (R24).
- `CompanyReactivateDialog`: `ConfirmDialog`; rechazo como `Notice` `danger` (R26).
- Toasts con `toast` de `sonner` tras el éxito; `router.refresh()` después.

### 7.4 Administradores

`AdministratorListSection` (servidor) + `AdministratorTable` (cliente, `DataTable` con filtro
`select` «Empresa» y `card`); `AdministratorSheet` (alta: `SelectField` «Empresa» primero +
`AdministratorFields` + rol fijo como `StatusBadge` `neutral` «Administrador» + `Notice` del
correo; edición: empresa como texto fijo); `AdministratorDeleteDialog` con `Notice` `warning` y
`confirmDisabled` si `row.isLastAdministrator` (R40); `AdministratorResendLinkDialog` (§ 5.4). El
menú de la fila declara, en este orden, «Editar», «Reenviar enlace» (solo con `accountStatus ===
'pending'`) y «Dar de baja» (este con `destructive` y `separatorBefore`), todos solo si
`canModify` (R6, R36).

### 7.5 Multiplataforma (del tablero)

Todo sale de piezas del catálogo que ya cumplen la regla: botones y menú de 44 px (48 px en el
menú centrado), inputs de 16 px (`TextField`), paneles a pantalla completa en teléfono
(`FormSheet` lado `bottom`/ancho completo según su `minScreenWidth`), pestañas con scroll
horizontal (`UrlTabs`), tablas con scroll en su caja. Nada solo de escritorio: sin excepción que
declarar.

### 7.6 Animación (del tablero)

La entrada escalonada la da `ScreenEnter` del layout; el fundido al cambiar de filtro y de pestaña
y los 300/150 ms del panel los traen `DataTable`, `UrlTabs` y `Sheet`. No se añade animación
propia.

## 8. Modelo de datos

**Ninguno nuevo.** Sin tablas, columnas, migraciones ni RLS: la ficha solo consume
`companies`, `company_events` y `users` a través de las acciones de QC-162, QC-235 y QC-165. La
autorización sigue en los casos de uso (`requirePlatformPermission`); la página solo corta la
vista (`requirePagePermission`) y oculta disparadores (R6), sin sustituir al servidor.

## 9. Alternativas descartadas

**A. Un route group propio `app/(maestro)/` con su layout.** Daría un área separada también en el
árbol, pero duplica el armazón (sesión, cabecera, tema, cierre de sesión, `<Toaster />`,
`ScreenEnter`), obliga a un segundo `AppSidebar` o a parametrizarlo, deja fuera a
`guard-rutas-privadas-cubiertas` (mira `app/(private)/`) y separa el 404 privado. La separación que
pide el alcance ya la dan los permisos (R1–R3), sin código nuevo de armazón.

**B. `AsyncAutocomplete` para elegir la empresa del Administrador.** Escala a muchas empresas, pero
el tablero dibuja un selector de lista (`select-field` en su ficha). Con el número de empresas de
una plataforma B2B, traerlas todas (§ 5.5) es más simple y respeta el tablero.

**C. Añadir `revalidatePath` a las acciones de `company-actions.ts`.** Es código de servidor de
QC-162 y QC-235, ya cerrado, y la pantalla ya refresca con `router.refresh()` (`useEntitySheet`),
como el resto de pantallas del repo.

**D. Una acción nueva que guarde datos y país a la vez.** Evitaría el guardado en dos pasos, pero
es cambio de servidor en una ficha `frontend`, y QC-162 R5 decidió a propósito que la edición no
acepte el país. El fallo parcial queda cubierto por R22.

**E. Sacar el formulario de persona de `UserForm` a `components/shared`.** Reutilización máxima,
pero choca con QC-267, que está rediseñando ese archivo (§ 7.2).

## 10. Pruebas y trazabilidad

| R | Test |
|---|---|
| R1 | `tests/ui/maestro/maestro-pages-permission.test.tsx` (las tres páginas llaman a `requirePagePermission('empresas.consultar')` antes de leer nada) + R43 |
| R2, R3 | `tests/unit/navegacion/private-nav-maestro.test.ts` (filtrar con los permisos del Maestro da exactamente «Plataforma» → Empresas, Administradores; sin `empresas.consultar` no aparecen) |
| R4, R5 | `tests/unit/navegacion/private-nav-maestro.test.ts` (`homeHrefFor` del Maestro = `/maestro/empresas`; para cada rol del seed sin `empresas.*`, el destino es el de antes) + `orden-secciones.test.ts` + R43 |
| R6 | `tests/ui/maestro/company-table.test.tsx`, `company-detail-header.test.tsx`, `administrator-table.test.tsx` (con `canModify=false`, ningún disparador de escritura) |
| R7 | `tests/ui/maestro/company-create-sheet.test.tsx` (`unauthorized` → región de error, panel abierto) |
| R8–R14, R16 | `tests/ui/maestro/company-table.test.tsx` y `tests/unit/maestro/company-list-params.test.ts` |
| R15 | `tests/ui/maestro/company-table.test.tsx` (cargando, error con «Reintentar», vacío de «De baja», vacío de búsqueda) |
| R17–R19 | `tests/ui/maestro/company-create-sheet.test.tsx` + `tests/ui/shared/administrator-fields.test.tsx` |
| R20–R22 | `tests/ui/maestro/company-edit-sheet.test.tsx` (orden de las dos llamadas, sin país si falla la primera, error en País y refresco si falla la segunda) |
| R23–R25 | `tests/ui/maestro/company-delete-dialog.test.tsx` |
| R26 | `tests/ui/maestro/company-reactivate-dialog.test.tsx` |
| R27, R28 | `tests/ui/maestro/company-detail-page.test.tsx` (pestañas, defecto, 404) + `company-detail-header.test.tsx` |
| R29 | `tests/ui/maestro/company-data-panel.test.tsx` |
| R30 | `tests/ui/maestro/company-detail-page.test.tsx` (con `tab=modulos` no se llama a `getCompanyAddonsAction`) |
| R31, R34 | `tests/ui/maestro/company-history-panel.test.tsx` |
| R32, R33 | `tests/unit/maestro/company-event-text.test.ts` + `tests/unit/shared/addon-names.test.ts` (claves = `ADDONS`) |
| R35, R36, R42 | `tests/ui/maestro/administrator-table.test.tsx` |
| R37, R38, R41 | `tests/ui/maestro/administrator-sheet.test.tsx` |
| R39, R40 | `tests/ui/maestro/administrator-delete-dialog.test.tsx` (marca `isLastAdministrator`; `company_last_administrator` pintado sin cerrar) |
| R36 | `tests/ui/maestro/administrator-table.test.tsx` («Reenviar enlace» en desplegable y en tarjeta para una fila `pending`; ausente para `active` y para cualquier otro estado) |
| R46–R49 | `tests/ui/maestro/administrator-resend-link-dialog.test.tsx` (textos del tablero con nombre y correo; `FormData` con solo `id`; toast de `sent` y de `failed`; lista sin refrescar; `user_not_pending`, `user_not_found` y error inesperado dentro del diálogo; botón pendiente sin doble envío) |
| R43 | `e2e/maestro-acceso.spec.ts` |
| R44 | `e2e/maestro-empresas.spec.ts` |
| R45 | `e2e/maestro-administradores.spec.ts` |

Los E2E entran con el Maestro de `SEED_MAESTRO_*` (en CI: `gate.yml`, l. 191-193). El usuario que
pierde la sesión en R44 se siembra con `createFixtureUser` en la empresa creada por el test. El
toast del alta en E2E se acepta en sus dos variantes (sent/failed): el transporte de correo del
servidor de E2E no lo controla el spec; las dos ramas se fijan en el test de componente.

## 11. Dependencias de terceros

Ninguna nueva. `lucide-react` (`Building2`, `ShieldUser`), `sonner`, `@base-ui/react`,
`@tanstack/react-table` y `libphonenumber-js` (vía `CountrySelect`) ya están en
`docs/dependencias.md`. `Intl.ListFormat` es del navegador y de Node.

## 12. Choques con otras features

| Archivo | Con quién | Cómo |
|---|---|---|
| `app/(private)/maestro/empresas/[id]/page.tsx`, `[id]/components/index.ts` | QC-278 | Dueño QC-166; QC-278 añade dos líneas en F2.3 (§ 6.4) |
| `lib/shared/ui/addon-names.ts` | QC-278 | Lo crea QC-166; QC-278 lo consume (§ 6.5) |
| `lib/shared/navigation/private-nav.ts`, `nav-icons.ts`, `lib/shared/routes.ts` | Cualquier ficha que añada menú o ruta | Solo se añade al final de cada lista |
| `components/shared/CATALOGO.md` | Todas las fichas con UI | Dos filas nuevas en su sitio |

## 13. Riesgos y desconocidos

- **QC-165 en `dev` (pregunta 7).** La parte de Administradores (T9–T11, R35–R42, R45–R49) no
  se implementa hasta que QC-165 esté mergeado. Su contrato completo, reenvío incluido, está en
  § 5.1 y § 5.3.
- **Guardado de edición en dos pasos:** un fallo entre los dos deja los datos guardados y el país
  no; está a la vista (R22), no es silencioso.
- **`loadActiveCompanies`** hace `ceil(n/25)` lecturas por carga de la pantalla de Administradores.
- **Formato y huso de las fechas** (pregunta 2).
- **El índice del grafo** no tiene proyecto para este worktree; se consultó el de `dev` (misma base)
  y se verificó en disco lo citado.
