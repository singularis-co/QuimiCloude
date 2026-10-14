# QC-267 — rediseno-configuracion · design.md

## Lo que ya existe

**Términos buscados.** En el board (`feature_list.json`, todos los estados): «usuario», «grupo»,
«presentación», «unidad», «integración», «configuración», «toast», «tilde». En `specs/` y `progress/`:
`QC-267`, `IntegrationPlaceholder`, `UsuariosTabsSwitch`, `separatorBefore`, `triggerDataAttributes`,
`DataTableCardLayout`, «tarjetas», «Cerrar todas las sesiones», «Usuario actualizado». En el código
(grafo `codebase-memory-mcp` del worktree, que respondió; Grep para tests, e2e y textos):
`UserTable`, `UserRowActions`, `UserStatusBadge`, `UsuariosTabsSwitch`, `WorkGroupRowActions`,
`WorkGroupTable`, `PresentationRowActions`, `UnitRowActions`, `IntegrationPlaceholder`,
`useEntitySheet`, `toast.success` en `app/(private)/configuracion/`, `RowActionsSpec`, textos sin
tilde en las dos rutas.

| Qué apareció | Dónde | Qué se hace |
| --- | --- | --- |
| QC-67, QC-85, QC-101, QC-39, QC-45, QC-80 (`done`): las cuatro pantallas de Configuración ya existen con su comportamiento | `app/(private)/configuracion/**` | Cambio visual sobre ellas; nada se re-crea |
| Los dieciséis toasts del tablero ya existen con su texto exacto, «Usuario actualizado.» incluido | `user-sheet.tsx:62`, `user-status-dialog.tsx:68`, `end-user-sessions-dialog.tsx` (`user-labels.ts:96`), `delete-user-dialog.tsx:48`, `work-group-sheet.tsx:53-54`, `delete-work-group-dialog.tsx:50`, `work-group-members.tsx:105-106`, `presentation-sheet.tsx:59-60`, `delete-presentation-dialog.tsx:69`, `unit-sheet.tsx:45-46`, `delete-unit-dialog.tsx:65` | No se añade ninguno; un test los fija (D12, P15). Ningún test de `tests/` ni de `e2e/` afirma hoy esos textos |
| `UserTable` y `WorkGroupTable` ya son dueñas del estado (un panel y un diálogo por página) | `user-table.tsx:259`, `work-group-table.tsx` | Se conserva; solo cambia cómo se declara el menú (D4) |
| `PresentationRowActions` y `UnitRowActions` montan su panel y su diálogo **por fila** | `presentation-row-actions.tsx:63-113`, `unit-row-actions.tsx:64-110` | Con tarjetas cada fila se pinta dos veces: pasan a anfitrión de la fila activa (D5), patrón de QC-262 D5 / QC-266 D6 |
| QC-222 (`done`) fija el contrato de la página cascarón: título del menú, vacío exacto, ni `form` ni `button` ni `a`, imports cerrados de `page.tsx` | `tests/unit/integraciones-ui/integration-pages.test.tsx:105-152` | El rediseño vive solo en `integration-placeholder.tsx` (D11) |
| QC-237 (en `dev`): la página de WhatsApp ya no es cascarón; pinta sus pestañas, tarjeta, webhook y acciones, con su propio `h1` (`integration-title`) | `app/(private)/integraciones/whatsapp/**`, `lib/modules/integraciones/**` | No se toca (R24, D13); la guardia lo vigila (D13 de este diseño) |
| QC-101 R8: la fila de usuarios no gana acciones; el cierre de sesiones vive en el panel | `specs/QC-101-…/requirements.md:78`, `user-sheet.tsx:147` | Se conserva (P2) |
| QC-100 (`pending`): conteo de miembros | `feature_list.json` | La tarjeta del grupo no pinta número (P3) |
| QC-256 (`done`): `PageShell`, `PageHeader`, `UrlTabs`, `StatusBadge`, `RowActionsMenu` centrado, `DataTable` con `card` y `actionsColumn({ menu })`, `EmptyState` con `icon` | `components/shared/` | Se reutilizan |
| QC-257 (`done`): cabecera, menú lateral, `ThemeToggle` | `app/(private)/layout.tsx` | Nada que hacer |
| QC-270 (`done`): la cabecera de `DataTable` se alinea con su columna (`align: 'end'`) | `components/shared/data-table/` | «Contenido» de Presentaciones ya sale alineada al final |
| QC-262 (`spec_ready`, sin implementar): `separatorBefore` en `RowActionMenuItem` y «menú como datos + un anfitrión por tabla» | `.worktrees/QC-262-rediseno-pedidos/specs/QC-262-rediseno-pedidos/design.md > D5, D7` | Se usa su contrato tal cual (R33, P1) y su patrón (D4, D5) |
| QC-263, QC-264, QC-266 (`spec_ready`): `RowActionsSpec` no lleva `triggerDataAttributes`; las tres lo añaden «solo si falta» | `components/shared/data-table/data-table-types.ts:65` | Igual aquí (R34, D7) |
| QC-266 P7 / QC-263: `primary` de la tarjeta en monoespaciada; criterio para nombres | `.worktrees/QC-266-…/requirements.md > P7` | Mismo criterio (P5) |
| QC-265 (`done`): pestañas con `UrlTabs`, altas en las listas cerradas `E2E_ESPERADOS` y `data-table-alcance` | `specs/QC-265-rediseno-operario/` | Se imita |
| Textos visibles sin tilde en `configuracion/` e `integraciones/` | Grep | Ninguno (solo comentarios): D9 no aplica |
| QC-98, QC-126, QC-206 (`pending`) tocan Usuarios y Unidades | `feature_list.json` | No se solapan; riesgo de choque en § 9 |

**Filas de `components/shared/CATALOGO.md` consultadas y paso de la regla de decisión**
(`docs/perfil-agentes.md > Regla de decisión para componentes`):

| Pieza | Filas consultadas | Paso | Por qué no bastaba el anterior | Tablero |
| --- | --- | --- | --- | --- |
| Contenedor, título y acciones | `PageShell`, `PageHeader` | 1 · reutiliza | — | `Superficies.dc.html`, `Usuarios.dc.html`, `Presentaciones.dc.html`, `Unidades.dc.html`, `Integraciones.dc.html` |
| Pestañas Personas / Grupos | `UrlTabs`, `Tabs` | 1 · reutiliza | — | `Superficies.dc.html`, `Usuarios.dc.html` |
| Estado de cuenta | `StatusBadge`, `STATUS_TONES` | 1 · reutiliza | — | `Estados.dc.html` |
| Avatar de la persona (fila, buscador, miembros) | `Avatar`, `avatarTone`, `getInitials` | 3 · compone en la ruta (`UserAvatarName`, interno) | Ninguna fila pinta «avatar + nombre» de una sola persona (`ResponsibleAvatars` es para varias) | `Usuarios.dc.html`, `ModalesConfiguracion.dc.html` |
| Miembros del grupo en la fila | `ResponsibleAvatars` | 1 · reutiliza | — | `Dominio.dc.html` |
| Menú ⋯ y tarjetas | `RowActionsMenu`, `DataTable` (`card`, `actionsColumn({ menu })`) | 1 · reutiliza | — | `Tabla.dc.html` |
| Separador del menú | `RowActionsMenu` | 2 · el punto de extensión `separatorBefore` de QC-262 (P1) | No separa grupos hoy | `Tabla.dc.html` |
| Atributos `data-*` del disparador en el menú declarado | `DataTable` (`RowActionsSpec`), `RowActionsMenu` (`triggerDataAttributes`) | 2 · extiende `RowActionsSpec` solo si falta (mismo cambio que QC-263/264/266) | `RowActionsSpec` hace `Pick` sin `triggerDataAttributes` | `Tabla.dc.html` |
| Paneles, diálogos y toasts | `FormSheet`, `Sheet`, `ConfirmDialog`, `DeleteConfirmDialog`, `Toaster`, `useEntitySheet` | 1 · reutiliza | — | `ModalesConfiguracion.dc.html` |
| Vacío de la integración | `EmptyState` (`icon`) | 1 · reutiliza | — | `Integraciones.dc.html` |
| Carga del panel de usuario | `Spinner`, `Skeleton` | 1 · reutiliza | — | `Usuarios.dc.html` |

No se crea ningún componente compartido. `UserAvatarName` y los anfitriones de paneles por tabla
(D4, D5) son subcomponentes internos de la ruta que solo componen piezas ya catalogadas y cuya forma
dibuja el tablero aprobado (excepción del pase `/design`). `UserAvatarName` lo usan dos tablas de la
misma ruta (`/configuracion/usuarios`): no sube a `components/shared`.

## 1. Principio

Cambio visual con tablero aprobado (D14). El comportamiento no cambia: mismas Server Actions, mismos
campos, mismos permisos de página, mismas direcciones, misma búsqueda, mismos filtros (R36). Lo único
que cambia por dentro es **dónde se declara el menú de fila** (como datos, para que la tarjeta lo
pinte) y, en Presentaciones y Unidades, **dónde viven el panel de edición y el diálogo de borrado**
(D5): con tarjetas, cada fila se pinta dos veces.

## 2. Modelo de datos

No aplica: sin tablas, sin RLS, sin migraciones, sin cambios en `lib/modules/`. Ningún contrato de
módulo cambia (P3, P4 y P10 lo dejan fuera a propósito).

## 3. Rutas

Ninguna ruta nueva ni distinta. `/configuracion/usuarios`, `/configuracion/presentaciones`,
`/configuracion/unidades`, `/integraciones/proveedor-ia` e `/integraciones/inventarios` siguen en sus
`page.tsx`, con su `requirePagePermission` en la primera línea y sus direcciones de
`lib/shared/routes.ts`. Las pestañas siguen saliendo de `usuariosTabHref`.

## 4. Decisiones

**D1 — Usuarios: cabecera y pestañas (R1–R3).**

- `usuarios/page.tsx`: `PageShell` > `PageHeader` (`title={USERS_LABEL}`,
  `titleTestId={USERS_TITLE_TESTID}`, `actions` = `WorkGroupCreateAction` o `UserCreateAction` según
  `tab`, como hoy), luego `UsuariosTabsSwitch` y la sección de la pestaña. Las dos acciones de alta
  pasan a `Button` primario con `PlusIcon` y `touch` (44 px).
- `usuarios-tabs-switch.tsx` **conserva su nombre y sus exports** (`USUARIOS_TABS_TESTID`,
  `USUARIOS_TAB_TESTIDS`) y pasa a componer `UrlTabs` con `label={USUARIOS_TABS_LABEL}`,
  `testId={USUARIOS_TABS_TESTID}` y por pestaña `{ value, href: usuariosTabHref(value), label, icon,
  testId }` (`UserIcon` en Personas, `UsersIcon` en Grupos). Deja de usar `useRouter`: la pestaña es un
  enlace real (como QC-265 D4). El `href` sigue llevando solo `tab` (QC-85 R7).

**D2 — Estado de cuenta (R5, R38).** `user-labels.ts` gana, al lado de `USER_ACCOUNT_STATUS_LABELS`,
el único mapa `USER_ACCOUNT_STATUS_TONES: Readonly<Record<UserAccountStatus, StatusTone>>`
(`active: 'success'`, `pending: 'neutral'`, `inactive: 'muted'`, `blocked: 'danger'`).
`UserStatusBadge` conserva su nombre y su export y pinta `StatusBadge tone label
data-testid="user-status" data-status`. `STATUS_VARIANTS` y la importación de `Badge` salen de
`user-columns.tsx`. Enmienda a QC-227: `tests/unit/marca/badges-estado.test.tsx > R6` pasa a afirmar
el tono de `StatusBadge` (`design.md > 10`).

**D3 — Avatar y nombre (R4, R28, R29).** Subcomponente interno
`app/(private)/configuracion/usuarios/components/user-avatar-name.tsx`:

```ts
export type UserAvatarNameProps = {
  readonly userId: string;       // para el tono estable (avatarTone)
  readonly displayName: string;  // iniciales con getInitials y texto visible
  readonly testId?: string;      // el data-testid de la celda de hoy, si lo hay
};
```

`Avatar size="sm" tone={avatarTone(userId)}` con `AvatarFallback` (iniciales, `aria-hidden`) y el
nombre en peso 600. Lo usan la columna «Nombre» de personas, el buscador de candidatas del panel de
grupo y la lista de miembros. Los `data-testid` de las celdas de nombre de hoy se conservan.

**D4 — Personas y Grupos: menú como datos (R6–R8, R10–R12; P2).** La tabla ya es dueña del estado;
solo cambia la declaración:

- `user-row-actions.tsx` gana
  ```ts
  export type UserRowAction = 'edit' | 'status' | 'delete';
  export function userRowActionsSpec(
    user: UserRow,
    canModify: boolean,
    onAction: (action: UserRowAction, user: UserRow) => void,
  ): RowActionsSpec;
  ```
  con «Editar», «Cambiar estado» y «Eliminar» (`separatorBefore: true`, `destructive: true`), los
  `testId` de hoy, `triggerLabel` «Acciones de <nombre>», `triggerTestId=USER_ROW_ACTIONS_TESTID`,
  `title=user.displayName`, `triggerDataAttributes={ 'data-user-id': user.id }` e `items: []` sin
  permiso. `UserRowActions` **conserva nombre, props y export** y pinta `<RowActionsMenu
  {...userRowActionsSpec(...)} />` (sus tests de hoy siguen valiendo). No hay cuarto ítem (P2).
- `user-columns.tsx`: la columna de acciones pasa a `actionsColumn({ id, label, menu: (user) =>
  userRowActionsSpec(user, canModify, onAction) })`. `UserColumnsDeps` conserva `onEdit`, `onDelete`,
  `onStatusChange` (la tabla no cambia) y la función los reparte por `action`.
- `user-table.tsx`: `card={{ primary: USERNAME_COLUMN_ID, status: ACCOUNT_STATUS_COLUMN_ID, title:
  DISPLAY_NAME_COLUMN_ID, meta: [EMAIL_COLUMN_ID, ROLE_NAME_COLUMN_ID] }}` (P5) y `USER_TABLE_TEXTS`
  gana `cardActions: 'Acciones'` y `closeMenu: 'Cerrar'`.
- Grupos, igual: `workGroupRowActionsSpec(group, canModify, onAction)` con «Abrir» y «Eliminar»
  (`separatorBefore`, `destructive`), `title=group.name`,
  `triggerDataAttributes={ 'data-work-group-id': group.id }`; `WorkGroupRowActions` conserva su
  nombre; `createWorkGroupColumns` usa `menu`; `work-group-table.tsx` pasa `card={{ primary:
  WORK_GROUP_NAME_COLUMN_ID, meta: [WORK_GROUP_MEMBERS_COLUMN_ID] }}` y los dos textos. El icono de
  «Abrir» pasa a `ArrowRightIcon` (tablero). Ningún número de miembros (P3).

**D5 — Presentaciones y Unidades: anfitrión por tabla (R15–R17, R20–R22).** Patrón de QC-262 D5 /
QC-266 D6:

- `presentation-row-actions.tsx` gana `presentationRowActionsSpec(presentation, onAction)` («Editar»,
  separador, «Eliminar» destructivo, testids de hoy, `title=presentation.name`,
  `triggerDataAttributes={ 'data-presentation-id': presentation.id }`). `PresentationRowActions`
  **conserva su nombre** y pasa a anfitrión: recibe `presentation`, `units`, `action`, `open`,
  `onOpenChange` y monta el `PresentationSheet` controlado o el `DeletePresentationDialog` de esa
  presentación. `editPresentationLabel` y `deletePresentationLabel` siguen exportadas.
- `presentation-columns.tsx`: la columna recibe `onAction` en vez de montar el componente en la celda;
  «Contenido» gana `tabular: true`; «Sin contenido» lleva `text-muted-foreground`.
- `presentation-table.tsx` guarda `active: { presentation, action, open } | null` y monta **una vez**
  el anfitrión; al cerrar deja `open: false` sin soltar la fila para que la salida anime. `card={{
  primary: 'name', status: 'content' }}` (P5); envoltorio `max-w-[760px]` (P6).
- Unidades, igual: `unitRowActionsSpec(unit, onAction)`, `UnitRowActions` como anfitrión (conserva el
  contador de sesión del diálogo de borrado que hoy remonta su contenido en cada apertura),
  `unit-columns.tsx` con `onAction`, «Símbolo» con `tabular: true` y la marca de vacío atenuada,
  `unit-table.tsx` con `card={{ primary: 'symbol', title: 'name', meta: ['equivalence'] }}` (ids reales
  en T0) y envoltorio `max-w-[880px]`. `NO_EQUIVALENCE_LABEL` y `formatFactor` no cambian (P10).
- `presentaciones/page.tsx` y `unidades/page.tsx`: `PageShell` > `PageHeader` con `title`,
  `titleTestId` de hoy y `actions={<PresentationSheet units={units} />}` /
  `actions={<UnitSheet baseUnits={baseUnits} />}`; los disparadores de alta pasan a primario con
  `PlusIcon` y `touch`. La rama de error de Presentaciones sigue sin cabecera (R13).

**D6 — Umbral y tablet.** El de `DataTable` (contenedor < 760 px; QC-261 P5, QC-262 P2). Con el
envoltorio de 760 px de Presentaciones el contenedor queda justo en el borde: la tanda 0 lo mide a
1440 px y, si salen tarjetas, el envoltorio sube a `max-w-[800px]` y se anota como desviación (P6).

**D7 — Piezas compartidas (R33–R35).**

- `separatorBefore`: con P1 por defecto, llega con QC-262 y aquí solo se verifica. Si P1 cambia, se
  implementa con su contrato (`DropdownMenuSeparator` en el desplegable, `Separator` en el diálogo
  centrado, nunca delante del primer ítem pintado) y su test.
- `triggerDataAttributes` en `RowActionsSpec`: si cuando se implemente sigue faltando, se añade al
  `Pick` de `components/shared/data-table/data-table-types.ts`; `actions-column.tsx` y
  `data-table-cards.tsx` ya esparcen el `spec` entero, así que no cambian. Como el disparador de la
  tarjeta ya repite hoy el `triggerTestId`, también repetirá el atributo: los E2E que lo buscan en toda
  la página se acotan al cuerpo visible (`data-table-row-<id>`, § 7). Mismo cambio que QC-263/264/266:
  el primero que llegue lo hace.
- `CATALOGO.md`: filas de `RowActionsMenu` (si P1 cambia) y `DataTable` (si se añade
  `triggerDataAttributes`).

**D8 — Paneles (R26, R31; P7, P8).** El ancho se pone en cada formulario de la ruta, sobre la
`className` de `FormSheet` / `SheetContent`: `data-[side=right]:w-full sm:max-w-[600px]` en
`user-form.tsx`, `user-sheet.tsx` (estado de carga y de error) y `work-group-form.tsx`;
`sm:max-w-[460px]` en `presentation-form.tsx` y `unit-form.tsx`. Por debajo de 640 px ya ocupan todo
el ancho (`w-full`). La rejilla del formulario de usuario (`sm:grid-cols-12`) no cambia (P8); en
teléfono ya es de una columna. La tanda 0 mide a 390 × 844 los cinco paneles y anota lo que no cabe.

**D9 — Carga del panel de usuario (R27).** `user-sheet.tsx`: la cabecera del estado de carga y de
error pasa a `SheetDescription` «Cambia los datos de la persona.» (el `EDIT_DESCRIPTION` de
`user-form.tsx`); el cuerpo pinta la región `user-sheet-loading` con `Spinner` y el texto «Cargando los
datos de la persona…» encima de los nueve `Skeleton` de hoy.

**D10 — Buscador y miembros del grupo (R28, R29).** `work-group-form.tsx`: la celda de nombre del
buscador usa `UserAvatarName`; la columna «Rol» gana la clase `@max-[760px]:hidden` (cabecera y
celda); el botón usa `variant="secondary"` con `CheckIcon` cuando está «Agregado» y `outline` cuando
«Agregar», con un ancho mínimo fijo para que el cambio de texto no mueva la fila.
`work-group-members.tsx`: cada miembro con `UserAvatarName`; «Quitar del grupo» `ghost` `sm`; la
paginación de miembros y su texto no cambian.

**D11 — Integraciones provisionales (R23–R25).** Solo cambia
`app/(private)/integraciones/components/integration-placeholder.tsx`:

- `PageShell` > `PageHeader` con `title={title}`, `titleTestId="integration-title"` y
  `breadcrumb={{ label: 'Ruta', items: [{ label: INTEGRATIONS_LABEL }, { label: title }] }}` (sin
  `href`: no pinta enlaces; P14).
- Debajo, `EmptyState` con `icon` (`PuzzleIcon`, oculto a lectores), `role="status"` en el recuadro,
  `data-testid="integration-empty"` y como único texto `INTEGRATION_EMPTY_MESSAGE`. Si `EmptyState`
  no deja poner `role` o el `data-testid` en su raíz sin añadir texto, se compone a mano el recuadro con
  las mismas clases del tablero (`Integraciones.dc.html` `.box`), sin pieza nueva.
- `proveedor-ia/page.tsx`, `inventarios/page.tsx`, `components/index.ts` y todo
  `integraciones/whatsapp/` no se tocan (R24, R25).

**D12 — Toasts (R32; P15).** Sin cambio de producción. Test nuevo
`tests/unit/configuracion-ui/configuracion-toasts.test.tsx` con `sonner` simulado: por cada operación
del R32, éxito → un único `toast.success` con su texto; fallo → ningún `toast.success`. Cubre también
que el alta de grupo con miembros que fallan sigue lanzando el `toast.error` de hoy.

**D13 — Guardia (R24, R38).** `tests/guards/guard-configuracion-rediseno.test.ts`:

- en los archivos de producción de `app/(private)/configuracion/`, ninguno importa
  `@/components/ui/badge`; solo `user-labels.ts` declara un objeto con las cuatro claves de estado de
  cuenta cuyos valores son tonos; `presentation-row-actions.tsx` y `unit-row-actions.tsx` solo montan
  panel o diálogo desde el anfitrión (ninguna columna importa `PresentationSheet`, `UnitSheet` ni sus
  diálogos);
- el diff de la rama contra el merge-base con `dev` no toca `app/(private)/integraciones/whatsapp/` ni
  `lib/modules/integraciones/` (salta, con el motivo escrito, fuera de la rama de QC-267, como
  `data-table-intacta-usuarios.test.ts`);
- un caso con fuente fabricada que demuestra que muerde.

## 5. Contratos que cambian

| Símbolo | Antes | Después |
| --- | --- | --- |
| `UsuariosTabsSwitch` | `Tabs` + `router.push` | compone `UrlTabs`; mismos exports |
| `USER_ACCOUNT_STATUS_TONES` | — | nuevo en `user-labels.ts` |
| `UserStatusBadge` | `Badge` con variante | `StatusBadge` con tono |
| `UserAvatarName` | — | nuevo, interno de la ruta |
| `userRowActionsSpec`, `UserRowAction` | — | nuevos |
| `UserRowActions` | menú propio | envoltorio de `userRowActionsSpec` |
| `workGroupRowActionsSpec`, `WorkGroupRowAction` | — | nuevos |
| `WorkGroupRowActions` | menú propio | envoltorio de `workGroupRowActionsSpec` |
| `presentationRowActionsSpec`, `PresentationRowAction` | — | nuevos |
| `PresentationRowActions` | menú + panel + diálogo por fila | anfitrión de la presentación activa |
| `unitRowActionsSpec`, `UnitRowAction` | — | nuevos |
| `UnitRowActions` | menú + panel + diálogo por fila | anfitrión de la unidad activa |
| Columnas de presentaciones y unidades | celda con el componente de fila | `actionsColumn({ menu })` con `onAction` |
| `UserTable`, `WorkGroupTable`, `PresentationTable`, `UnitTable` | sin `card` | `card` y textos `cardActions`, `closeMenu`; las dos últimas, fila activa |
| `IntegrationPlaceholder` | `h1` y recuadro punteado | `PageShell`, `PageHeader` con miga, `EmptyState` con icono |
| `RowActionMenuItem` | — | `separatorBefore?` (de QC-262; aquí solo si P1 cambia) |
| `RowActionsSpec` | sin `triggerDataAttributes` | + `triggerDataAttributes` (solo si falta) |

## 6. Snapshots y árboles que cambian (aceptados)

Toda diferencia de paridad que no esté aquí es un fallo de la tanda:

| Archivo | Cambio | Requisito |
| --- | --- | --- |
| `tests/unit/paridad/usuarios-paridad.test.tsx` (+ `.snap`) | `PageHeader`, `UrlTabs`, avatar en el nombre, `StatusBadge`, columna de acciones de `actionsColumn({ menu })`, tarjetas | R1, R2, R4–R7 |
| `tests/unit/paridad/grupos-paridad.test.tsx` (+ `.snap`) | columna de acciones, tarjetas, buscador y miembros con avatar | R9–R11, R28, R29 |
| `tests/unit/paridad/presentaciones-paridad.test.tsx` (+ `.snap`) | `PageHeader`, columna de acciones, contenido en mono, ancho, tarjetas | R13–R16 |
| `tests/unit/paridad/unidades-paridad.test.tsx` (+ `.snap`) | `PageHeader`, columna de acciones, símbolo en mono, ancho, tarjetas | R18–R21 |
| `tests/unit/paridad/acciones-por-fila.test.tsx` (+ `.snap`) | los cuatro menús con separador | R6, R10, R15, R20 |
| `tests/unit/paridad/formularios-paridad.test.tsx` (+ `.snap`) | ancho de los paneles; disparadores de alta con «+» | R1, R13, R18, R26 |
| `tests/unit/paridad/confirmaciones-paridad.test.tsx` (+ `.snap`) | ninguno esperado (los diálogos no cambian); se lista porque monta los seis diálogos | — |
| `tests/unit/paridad/campos-paridad.test.tsx`, `error-alert-paridad.test.tsx` (+ `.snap`) | ninguno esperado; se listan porque montan piezas de la ruta | — |

La tanda 0 no regenera nada; cada snapshot se actualiza en la tanda que cambia la pantalla y el commit
cita la fila. `acciones-por-fila.snap` y `formularios-paridad.snap` los tocan también QC-262, QC-263,
QC-264 y QC-266: el segundo que llegue a `dev` regenera sobre el primero (§ 9).

## 7. Tests y E2E que se tocan (barrido con grep, 2026-10-13)

**Unitarios que cambian aserciones** (T0 repite el grep y lo deja en `progress/impl_QC-267.md`):

| Test | Por qué |
| --- | --- |
| `tests/unit/configuracion-ui/usuarios-page.test.tsx`, `grupos/usuarios-page.test.tsx` | `PageHeader`, un `h1`, alta en la cabecera |
| `tests/unit/configuracion-ui/grupos/usuarios-tabs-switch.test.tsx` | `UrlTabs` con enlaces reales en vez de `router.push` |
| `tests/unit/configuracion-ui/user-columns.test.tsx`, `user-row-actions.test.tsx`, `user-table.test.tsx`, `user-list-section.test.tsx`, `user-list-empty.test.tsx`, `user-create-action.test.tsx`, `usuarios-viewport.test.tsx` | avatar, `StatusBadge`, menú declarado, separador, tarjetas (los que cuentan disparadores o celdas en toda la página se acotan al cuerpo visible) |
| `tests/unit/configuracion-ui/user-sheet.test.tsx`, `user-form.test.tsx` | ancho del panel, descripción y giro del estado de carga |
| `tests/unit/configuracion-ui/grupos/work-group-columns.test.tsx`, `work-group-table.test.tsx`, `work-group-list-section.test.tsx`, `work-group-list-empty.test.tsx`, `work-group-list-skeleton.test.tsx`, `work-group-create-action.test.tsx`, `work-group-a11y.test.tsx` | menú declarado, separador, icono de «Abrir», tarjetas |
| `tests/unit/configuracion-ui/grupos/work-group-form.test.tsx`, `work-group-members.test.tsx`, `work-group-sheet.test.tsx` | avatar, rol oculto en estrecho, «Agregado» con marca, ancho del panel |
| `tests/unit/configuracion-ui/presentation-columns.test.tsx`, `presentation-table.test.tsx`, `presentation-page.test.tsx`, `presentation-sheet.test.tsx`, `delete-presentation-dialog.test.tsx` | `PageHeader`, columna con `menu`, anfitrión, tarjetas, ancho |
| `tests/unit/configuracion-ui/unit-columns.test.tsx`, `unit-table.test.tsx`, `unit-page.test.tsx`, `unit-sheet.test.tsx`, `delete-unit-dialog.test.tsx`, `unidades-viewport.test.tsx`, `configuracion-viewport.test.tsx` | ídem para unidades |
| `tests/unit/shared-ui/confirm-dialog-montado.test.tsx` | monta los diálogos de borrado de presentación y unidad: el diálogo sigue montado tras cerrar, ahora desde el anfitrión |
| `tests/unit/integraciones-ui/integration-pages.test.tsx` | `PageHeader` con miga; las aserciones de R9–R11 de QC-222 siguen igual |
| `tests/unit/marca/badges-estado.test.tsx` | R6 de QC-227: tono de `StatusBadge` en vez de variante de `Badge` (enmienda, § 10) |
| `tests/unit/marca/tablas-marca.test.tsx` | si afirma clases de las tablas de la ruta |
| `tests/unit/shared-ui/catalogo-qc256.test.ts` | fila de `RowActionsMenu` o `DataTable`, solo si D7 las toca |
| `tests/unit/configuracion-ui/configuracion-convenciones.test.ts`, `usuarios-convenciones.test.ts`, `unidades-convenciones.test.ts` | solo si el censo de T0 encuentra una regla sin precondición de rama que muerda el cambio |

**Tests nuevos:** `tests/unit/configuracion-ui/usuarios-rediseno.test.tsx` (R1–R3),
`user-cards.test.tsx` (R4, R5, R7), `grupos/work-group-cards.test.tsx` (R9, R11),
`presentation-row-actions.test.tsx` (R15, R17), `presentation-cards.test.tsx` (R14, R16),
`unit-row-actions.test.tsx` (R20, R22), `unit-cards.test.tsx` (R19, R21),
`configuracion-toasts.test.tsx` (R32); `tests/guards/guard-configuracion-rediseno.test.ts` (R24, R38);
y, solo si P1 cambia, `tests/unit/shared-ui/row-actions-menu-separator.test.tsx` (R33).

**E2E que pueden cambiar** (corren en el PR a producción; T8 los corre por spec):

| E2E | Qué cambia |
| --- | --- |
| `e2e/usuarios.spec.ts` | `user-status` dentro de `data-table-row-<id>` sigue valiendo; localizadores de página entera de `user-row-actions` se acotan a la fila |
| `e2e/grupos-de-trabajo.spec.ts` | `usuarios-tab-grupos` pasa a enlace: el clic navega igual; `work-group-row-actions` ya se busca dentro de la fila |
| `e2e/cierre-de-sesiones.spec.ts` | `user-row-actions` / `user-action-edit`: acotar a la fila si busca en toda la página |
| `e2e/presentaciones.spec.ts`, `e2e/producto-terminado.spec.ts` | `[data-testid="presentation-row-actions"][data-presentation-id=…]` encuentra también el de la tarjeta (oculto a 1440): se acota a `data-table-row-<id>` (R34) |
| `e2e/unidades.spec.ts`, `e2e/piezas-compartidas.spec.ts` | `page.getByTestId('unit-row-actions')` cuenta disparadores de toda la página: con tarjetas se acota al cuerpo visible |
| `e2e/integraciones.spec.ts` | `integration-title` e `integration-empty` se conservan; pasa sin cambios salvo que afirme el árbol |
| `e2e/login.spec.ts`, `e2e/aislamiento-inventario.spec.ts` | leen los `*-title`, que se conservan |

**E2E nuevo:** `e2e/configuracion-rediseno.spec.ts` (Chromium y WebKit), a 1440 × 900 y a 390 × 844:

- a 1440: Personas con `PageHeader`, pestañas que navegan por enlace, avatar y `StatusBadge`, menú
  «Editar», «Cambiar estado», separador, «Eliminar»; Grupos con su menú y avatares; Presentaciones y
  Unidades en tabla (no tarjetas) con su ancho máximo y su menú; las dos integraciones con miga, `h1` y
  vacío;
- a 390: ninguna de las seis pantallas desborda en horizontal (R37), pestañas desplazables, tarjetas
  con «Acciones» de 44 px que abre el diálogo centrado con su título e ítems de 48 px, los seis
  diálogos enteros y centrados (R30), los cinco paneles a todo el ancho con su pie visible (R26).

Se da de alta en `E2E_ESPERADOS` de `tests/guards/guard-identificador-de-request.test.ts` y en la lista
cerrada de `tests/unit/shared/data-table-alcance.test.ts`, en su sitio por orden alfabético, con el
comentario «Alta el <fecha> (QC-267) por el MISMO motivo y en el MISMO sitio que las demas: …», como
las de QC-265.

## 8. Alternativas descartadas

- **A1 — Dejar el menú en la celda (`cell`) y pintar la tarjeta con el pie = acciones.** Cero cambio
  en las columnas, pero la tarjeta pintaría el desplegable de tabla en vez de «Acciones» con el diálogo
  centrado (D2), y Presentaciones y Unidades montarían su panel y su diálogo dos veces por fila.
- **A2 — Añadir «Cerrar todas las sesiones» al menú de la fila, como el tablero** (P2). Contradice
  QC-101 R8, decisión cerrada del humano con su motivo (la acción expulsa a alguien), y su test de
  alcance.
- **A3 — Rediseñar también la página de WhatsApp** para que las tres integraciones se vean iguales. Es
  código de QC-237 (otra persona) y D13 lo deja fuera; tocarla choca en archivos con su dueño.
- **A4 — Editar `proveedor-ia/page.tsx` e `inventarios/page.tsx`** para montar `PageShell` y
  `PageHeader` allí. Rompe la lista cerrada de imports de QC-222 (`integration-pages.test.tsx:149`);
  el cascarón compartido es el sitio.
- **A5 — Umbral propio de tarjetas** para que tablet siga en tabla o para que el ancho de 760 px no
  dispare tarjetas. Obliga a extender `DataTable` por consumidor y contradice QC-261 P5 y QC-262 P2.
- **A6 — Extender `DataTableCardLayout`** para que el nombre del grupo y de la presentación no salga en
  monoespaciada (P5). Toca `data-table`, que QC-262/263/264/266 también abren, por la tipografía de
  una ranura.
- **A7 — Subir `UserAvatarName` a `components/shared`.** Solo la usa una ruta; la regla de la segunda
  ruta no se cumple.
- **A8 — Leer el rol de cada miembro o el conteo del grupo** (P3, P4). Cambia lecturas de
  `lib/modules/identity` en una ficha de zona `frontend` y pisa QC-100.

## 9. Riesgos y coordinación

- **Orden con QC-262** (P1): esta ficha se implementa con QC-262 en `dev`. Comparte con QC-262
  `components/shared/row-actions-menu.tsx` (solo si P1 cambia); con QC-262, QC-263, QC-264 y QC-266
  `components/shared/CATALOGO.md`, `components/shared/data-table/data-table-types.ts` (solo si falta
  `triggerDataAttributes`), `tests/unit/paridad/acciones-por-fila.test.tsx`,
  `formularios-paridad.test.tsx`, `tests/unit/marca/badges-estado.test.tsx`,
  `tests/unit/marca/tablas-marca.test.tsx`, `tests/unit/shared/data-table-alcance.test.ts` y
  `guard-identificador-de-request.test.ts` (listas cerradas que crecen por apéndice).
  `scripts/archivos-en-vuelo.mjs` lo comprueba con `## Archivos esperados`.
- **QC-237** (otra persona, en `dev`): R24 y la guardia impiden tocar su código; el único archivo
  compartido de `/integraciones` es `integration-placeholder.tsx`, que WhatsApp ya no importa
  (`integration-pages.test.tsx:154`).
- **Duplicados de tabla y tarjeta**: los localizadores de página por `data-testid` de disparador o de
  celda encuentran dos (también el de `producto-terminado.spec.ts`, que busca por
  `data-presentation-id`). T0 los censa antes de tocar nada y T8 los acota al cuerpo visible.
- **Ancho de 760 px de Presentaciones** frente al umbral de tarjetas (D6, P6): se mide en T0.
- **QC-98, QC-126 y QC-206** (`pending`) tocarán `user-table.tsx`, `user-row-actions.tsx` o
  `unit-form.tsx`: si entran antes, se rebasa.
- **Gate rápido y listas cerradas:** lección de QC-261 y QC-265; T8 cierra con `./init.sh --completo`.

## 10. Enmiendas a specs cerrados

| Spec | Qué cambia | Por qué |
| --- | --- | --- |
| QC-67 (Usuarios) | El estado de cuenta pasa de `Badge` con variante a `StatusBadge` con tono; el nombre lleva avatar; el menú gana separador | D2, D3, D14 |
| QC-85 (Grupos) | El conmutador de pestañas pasa de `router.push` a enlaces reales (`UrlTabs`); el `href` sigue llevando solo `tab` | D14; QC-85 R7 se mantiene |
| QC-45 / QC-80 (Presentaciones), QC-39 (Unidades) | El panel de edición y el diálogo de borrado los monta un anfitrión por tabla, no cada fila | D2 (tarjetas) |
| QC-222 (Integraciones) | El cascarón gana `PageShell`, miga e icono; el texto, los testids, el corte y los imports de `page.tsx` no cambian | D14 |
| QC-227 (`tests/unit/marca/badges-estado.test.tsx > R6`) | El tono del estado de cuenta se afirma sobre `StatusBadge` | D3 del humano |
| QC-55 (`tests/unit/shared/data-table-alcance.test.ts`) | La lista cerrada de E2E gana `e2e/configuracion-rediseno.spec.ts` | § 7 |

## 11. Deudas

- **D53** (esqueletos sin tarjeta) se amplía a las cuatro listas de Configuración.
- **Nuevas, si se confirman por defecto:** rol bajo cada miembro (P4), «Factor» deshabilitado sin base
  (P9), coma decimal en la equivalencia (P10), insignias en el selector de estado (P12), icono en los
  diálogos (P13, compartida con QC-262 P5), animaciones de entrada y fundidos (P16).

## Dependencias de terceros

Ninguna nueva. `@base-ui/react` (Tabs, Menu, Dialog, AlertDialog, Sheet, Select), `sonner`,
`lucide-react` y `@tanstack/react-table` ya están en `docs/dependencias.md`.
