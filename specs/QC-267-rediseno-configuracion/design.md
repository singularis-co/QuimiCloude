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
| *Enmienda E1:* QC-275 (en `dev`): la página de Proveedor IA tampoco es cascarón; pinta `PageShell`, `PageHeader` con miga y su formulario o su tarjeta | `app/(private)/integraciones/proveedor-ia/**`; `tests/unit/integraciones-ui/integration-pages.test.tsx:171-176` («solo inventarios sigue siendo cascarón») | No se toca (R24); el cascarón queda solo para inventarios (R23, R25) |
| QC-101 R8: la fila de usuarios no gana acciones; el cierre de sesiones vive en el panel | `specs/QC-101-…/requirements.md:78`, `user-sheet.tsx:147` | Se conserva (P2) |
| QC-100 (`pending`): conteo de miembros | `feature_list.json` | La tarjeta del grupo no pinta número (P3) |
| QC-256 (`done`): `PageShell`, `PageHeader`, `UrlTabs`, `StatusBadge`, `RowActionsMenu` centrado, `DataTable` con `card` y `actionsColumn({ menu })`, `EmptyState` con `icon` | `components/shared/` | Se reutilizan |
| QC-257 (`done`): cabecera, menú lateral, `ThemeToggle` | `app/(private)/layout.tsx` | Nada que hacer |
| QC-270 (`done`): la cabecera de `DataTable` se alinea con su columna (`align: 'end'`) | `components/shared/data-table/` | «Contenido» de Presentaciones ya sale alineada al final |
| QC-262 (`spec_ready`, sin implementar): `separatorBefore` en `RowActionMenuItem` y «menú como datos + un anfitrión por tabla» | `.worktrees/QC-262-rediseno-pedidos/specs/QC-262-rediseno-pedidos/design.md > D5, D7` | Se usa su contrato tal cual (R33, P1) y su patrón (D4, D5). *Enmienda E4, E14:* QC-262 está en `dev` (`done`); `separatorBefore` en `components/shared/row-actions-menu.tsx:53-54, 82-85`; spec en `specs/QC-262-rediseno-pedidos/` |
| QC-263, QC-264, QC-266 (`spec_ready`): `RowActionsSpec` no lleva `triggerDataAttributes`; las tres lo añaden «solo si falta» | `components/shared/data-table/data-table-types.ts:65` | Igual aquí (R34, D7). *Enmienda E5:* QC-263 y QC-264 están en `dev` y no lo añadieron: tipo local en la ruta (`app/(private)/inventario/components/product-row-actions.tsx:41-43`); aquí igual, `data-table-types.ts` no se toca |
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
| Separador del menú | `RowActionsMenu` | ~~2 · el punto de extensión `separatorBefore` de QC-262 (P1)~~ *Enmienda E4:* 1 · reutiliza (ya está en `dev`) | — | `Tabla.dc.html` |
| Atributos `data-*` del disparador en el menú declarado | `DataTable` (`RowActionsSpec`), `RowActionsMenu` (`triggerDataAttributes`) | ~~2 · extiende `RowActionsSpec` solo si falta~~ *Enmienda E5:* 1 · reutiliza: tipo local `RowActionsSpec & Pick<RowActionsMenuProps, 'triggerDataAttributes'>` en la ruta, como QC-263/264 | — | `Tabla.dc.html` |
| Paneles, diálogos y toasts | `FormSheet`, `Sheet`, `ConfirmDialog`, `DeleteConfirmDialog`, `Toaster`, `useEntitySheet` | 1 · reutiliza (*Enmienda E7:* con `icon` de `ConfirmDialog`, R39) | — | `ModalesConfiguracion.dc.html` |
| Vacío de la integración | `EmptyState` (`icon`) | 1 · reutiliza (*Enmienda E3:* dentro de un `div role="status"`, porque `EmptyState` no admite `role`) | — | `Integraciones.dc.html` |
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

*Enmienda E10, E11:* el archivo nuevo sube a 26 la cuenta de componentes de
`tests/unit/configuracion-ui/usuarios-convenciones.test.ts:86` y entra en el barrel con su nombre
público. La columna «Usuario» pasa a `tabular: true` (es como la tabla pinta Plex Mono, R4) y la lista
cerrada de `tests/unit/marca/tablas-marca.test.tsx` gana `user-columns.tsx` con `['Usuario']`.

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
- *Enmienda E5:* cada `*RowActionsSpec(...)` de la ficha devuelve un tipo local de su archivo,
  `RowActionsSpec & Pick<RowActionsMenuProps, 'triggerDataAttributes'>` (precedente
  `ProductRowActionsSpec`, `app/(private)/inventario/components/product-row-actions.tsx:41-43`).
  `actionsColumn` (`components/shared/data-table/actions-column.tsx:27-28`) y la tarjeta
  (`data-table-cards.tsx:73`) esparcen el objeto entero, así que el atributo llega a los dos
  disparadores sin tocar `data-table-types.ts`.

**D5 — Presentaciones y Unidades: anfitrión por tabla (R15–R17, R20–R22).** Patrón de QC-262 D5 /
QC-266 D6:

- `presentation-row-actions.tsx` gana `presentationRowActionsSpec(presentation, onAction)` («Editar»,
  separador, «Eliminar» destructivo, testids de hoy, `title=presentation.name`,
  `triggerDataAttributes={ 'data-presentation-id': presentation.id }`). `PresentationRowActions`
  **conserva su nombre** y pasa a anfitrión: recibe `presentation`, `units`, `action`, `open`,
  `onOpenChange` y monta el `PresentationSheet` controlado o el `DeletePresentationDialog` de esa
  presentación. `editPresentationLabel` y `deletePresentationLabel` siguen exportadas.
- `presentation-columns.tsx`: la columna recibe `onAction` en vez de montar el componente en la celda;
  «Contenido» gana `tabular: true`; «Sin contenido» lleva `text-muted-foreground`. *Enmienda E10:*
  «Contenido» ya es `tabular` y `align: 'end'` en `dev` (`presentation-columns.tsx:89-97`); solo
  cambian la celda de «Sin contenido» y la firma de `buildPresentationColumns`, que
  `tests/unit/marca/tablas-marca.test.tsx:278-281` llama con `([])`.
- `presentation-table.tsx` guarda `active: { presentation, action, open } | null` y monta **una vez**
  el anfitrión; al cerrar deja `open: false` sin soltar la fila para que la salida anime. `card={{
  primary: 'name', status: 'content' }}` (P5); envoltorio `max-w-[760px]` (P6).
- Unidades, igual: `unitRowActionsSpec(unit, onAction)`, `UnitRowActions` como anfitrión (conserva el
  contador de sesión del diálogo de borrado que hoy remonta su contenido en cada apertura),
  `unit-columns.tsx` con `onAction`, «Símbolo» con `tabular: true` y la marca de vacío atenuada,
  `unit-table.tsx` con `card={{ primary: 'symbol', title: 'name', meta: ['equivalence'] }}` (ids reales
  en T0) y envoltorio `max-w-[880px]`. `NO_EQUIVALENCE_LABEL` y `formatFactor` no cambian (P10).
  *Enmienda E10:* los ids son `name`, `symbol` y `equivalence` (`unit-columns.tsx:44-46`), así que el
  `card` queda `{ primary: 'symbol', title: 'name', meta: ['equivalence'] }`; «Símbolo» con `tabular`
  hace que la lista cerrada de `tablas-marca.test.tsx` gane `unit-columns.tsx` con `['Símbolo']`.
- `presentaciones/page.tsx` y `unidades/page.tsx`: `PageShell` > `PageHeader` con `title`,
  `titleTestId` de hoy y `actions={<PresentationSheet units={units} />}` /
  `actions={<UnitSheet baseUnits={baseUnits} />}`; los disparadores de alta pasan a primario con
  `PlusIcon` y `touch`. La rama de error de Presentaciones sigue sin cabecera (R13).

**D6 — Umbral y tablet.** El de `DataTable` (contenedor < 760 px; QC-261 P5, QC-262 P2). Con el
envoltorio de 760 px de Presentaciones el contenedor queda justo en el borde: la tanda 0 lo mide a
1440 px y, si salen tarjetas, el envoltorio sube a `max-w-[800px]` y se anota como desviación (P6).
*Enmienda E19:* con `card`, la raíz de `DataTable` es el contenedor (`data-table.tsx:292`) y la tabla
se oculta con `@max-[760px]` (`:311`), que en Tailwind 4 es «menos de 760 px»: con un envoltorio de
exactamente 760 px sale tabla. T0b lo confirma; el riesgo es solo un borde o relleno del envoltorio.

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
- *Enmienda E4, E5, E6:* las tres viñetas anteriores no aplican. `separatorBefore` está en `dev`
  (`row-actions-menu.tsx:53-54, 82-85`, test `tests/unit/shared-ui/row-actions-menu-separator.test.tsx`);
  `triggerDataAttributes` va en tipos locales (D4); ninguna pieza de `components/shared/` cambia y
  `CATALOGO.md` no se toca. R33 y R35 se verifican, no se implementan.

**D8 — Paneles (R26, R31; P7, P8).** El ancho se pone en cada formulario de la ruta, sobre la
`className` de `FormSheet` / `SheetContent`: `data-[side=right]:w-full sm:max-w-[600px]` en
`user-form.tsx`, `user-sheet.tsx` (estado de carga y de error) y `work-group-form.tsx`;
`sm:max-w-[460px]` en `presentation-form.tsx` y `unit-form.tsx`. Por debajo de 640 px ya ocupan todo
el ancho (`w-full`). La rejilla del formulario de usuario (`sm:grid-cols-12`) no cambia (P8); en
teléfono ya es de una columna. La tanda 0 mide a 390 × 844 los cinco paneles y anota lo que no cabe.
*Enmienda E8 (supuesto P18):* hoy los paneles de usuario y de grupo no miden 448 px sino 70vw:
`user-form.tsx:399` y `work-group-form.tsx:366` pasan `minScreenWidth={70}`, y ese `min-width` gana
al `max-width` (`components/ui/sheet.tsx:88-97`). Para que valga el 600 px del tablero, los dos dejan
de pasarlo; el estado de carga y de error de `user-sheet.tsx:169` pasa a la misma clase, y el panel ya
no salta de ancho al cargar. Presentación y unidad no pasan `minScreenWidth`.

**D9 — Carga del panel de usuario (R27).** `user-sheet.tsx`: la cabecera del estado de carga y de
error pasa a `SheetDescription` «Cambia los datos de la persona.» (el `EDIT_DESCRIPTION` de
`user-form.tsx`); el cuerpo pinta la región `user-sheet-loading` con `Spinner` y el texto «Cargando los
datos de la persona…» encima de los nueve `Skeleton` de hoy.

**D10 — Buscador y miembros del grupo (R28, R29).** `work-group-form.tsx`: la celda de nombre del
buscador usa `UserAvatarName`; la columna «Rol» gana la clase `@max-[760px]:hidden` (cabecera y
celda) (*Enmienda E9:* `max-[760px]:hidden`, de ventana: el `DataTable` del buscador no lleva `card`
y no es contenedor, y el panel vive en un portal sin contenedor; el tablero pinta el rol en el panel
de 600 px, `ModalesConfiguracion.dc.html:68`); el botón usa `variant="secondary"` con `CheckIcon` cuando está «Agregado» y `outline` cuando
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
- *Enmienda E1, E2, E3:* el cascarón solo lo monta `inventarios/page.tsx`; Proveedor IA es pantalla de
  QC-275 y todo `integraciones/proveedor-ia/` queda fuera (R24). La miga copia la de
  `proveedor-ia/page.tsx:37-44` (`label: 'Ruta'`, `[{ label: INTEGRATIONS_LABEL }, { label: title }]`).
  `EmptyState` no admite `role` (`empty-state.tsx:14-26`): el recuadro es un `div role="status"
  data-testid="integration-empty"` que envuelve `EmptyState` con `icon` y `message`, sin enlaces de
  salida; su texto sigue siendo solo el mensaje (el icono es `aria-hidden`).

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
  `data-table-intacta-usuarios.test.ts`) (*Enmienda E1:* ni `app/(private)/integraciones/proveedor-ia/`);
- un caso con fuente fabricada que demuestra que muerde.

**D14 — Icono de los diálogos (R39; P17; *Enmienda E7*).** Cada diálogo pasa `icon` a la pieza que ya
monta, sin tocarla: `user-status-dialog.tsx` (`ConfirmDialogBody`) `{ glyph: LockIcon, tone: 'info' }`;
`end-user-sessions-dialog.tsx` (`ConfirmDialog`) `{ glyph: LogOutIcon, tone: 'warning' }`;
`delete-user-dialog.tsx`, `delete-work-group-dialog.tsx`, `delete-presentation-dialog.tsx`
(`DeleteConfirmDialogBody`) y `delete-unit-dialog.tsx` (`DeleteConfirmDialog`)
`{ glyph: TrashIcon, tone: 'danger' }`. Cada uno con un `testId` exportado junto a los de su diálogo
(precedente `DELETE_RECIPE_ICON_TESTID`, `COMPANY_DELETE_ICON_TESTID`). Títulos, textos, envío y
errores no cambian (R31).

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
| ~~`RowActionMenuItem`~~ | — | ~~`separatorBefore?`~~ *Enmienda E4:* ya está en `dev`; no cambia |
| ~~`RowActionsSpec`~~ | sin `triggerDataAttributes` | ~~+ `triggerDataAttributes`~~ *Enmienda E5:* no cambia; tipos locales `UserRowActionsSpec`, `WorkGroupRowActionsSpec`, `PresentationRowActionsSpec`, `UnitRowActionsSpec` en la ruta |
| Los seis diálogos de la ficha | sin icono | *Enmienda E7:* `icon` con su glifo, tono y `testId` (D14) |
| `UserForm`, `WorkGroupForm` | `minScreenWidth={70}` | *Enmienda E8:* sin `minScreenWidth`; ancho por clase (D8) |

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
| `tests/unit/paridad/confirmaciones-paridad.test.tsx` (+ `.snap`) | ~~ninguno esperado (los diálogos no cambian)~~ *Enmienda E7:* el icono de cabecera de los seis diálogos | R39 |
| `tests/unit/paridad/campos-paridad.test.tsx`, `error-alert-paridad.test.tsx` (+ `.snap`) | ninguno esperado; se listan porque montan piezas de la ruta | — |

La tanda 0 no regenera nada; cada snapshot se actualiza en la tanda que cambia la pantalla y el commit
cita la fila. `acciones-por-fila.snap` y `formularios-paridad.snap` los tocan también QC-262, QC-263,
QC-264 y QC-266: el segundo que llegue a `dev` regenera sobre el primero (§ 9). *Enmienda E17:*
QC-262, QC-263 y QC-264 ya están en `dev`; queda QC-266, que va primero y toca además
`confirmaciones-paridad.snap` y `campos-paridad.snap`: esta ficha regenera los cuatro sobre el `dev`
que ya tenga QC-266.

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
| `tests/unit/marca/tablas-marca.test.tsx` | ~~si afirma clases de las tablas de la ruta~~ *Enmienda E10:* seguro: `buildPresentationColumns([])` cambia de firma (l. 279) y la lista cerrada de Mono gana `user-columns.tsx` (`['Usuario']`) y `unit-columns.tsx` (`['Símbolo']`) |
| ~~`tests/unit/shared-ui/catalogo-qc256.test.ts`~~ | ~~fila de `RowActionsMenu` o `DataTable`, solo si D7 las toca~~ *Enmienda E6:* no aplica, D7 no toca piezas |
| `tests/unit/configuracion-ui/configuracion-convenciones.test.ts`, `usuarios-convenciones.test.ts`, `unidades-convenciones.test.ts` | solo si el censo de T0 encuentra una regla sin precondición de rama que muerda el cambio. *Enmienda E11:* `usuarios-convenciones.test.ts` cambia seguro (`COMPONENTES_ESPERADOS = 25` → 26, l. 86); las tres tienen reglas sin precondición que obligan a publicar en el barrel todo nombre exportado y a no consultar por texto visible en `tests/unit/configuracion-ui/` (también `grupos/alcance.test.ts:895-944`) |
| *Enmienda E7:* `tests/unit/configuracion-ui/user-status-dialog.test.tsx`, `end-user-sessions-dialog.test.tsx`, `delete-user-dialog.test.tsx`, `grupos/delete-work-group-dialog.test.tsx`, `delete-presentation-dialog.test.tsx`, `delete-unit-dialog.test.tsx` | el icono de cabecera (R39) |

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
| *Enmienda E1:* `e2e/integraciones-proveedor-ia.spec.ts` | lee `integration-title` en Proveedor IA (l. 55), pantalla que no se toca: pasa sin cambios |
| `e2e/login.spec.ts`, `e2e/aislamiento-inventario.spec.ts` | leen los `*-title`, que se conservan |

**E2E nuevo:** `e2e/configuracion-rediseno.spec.ts` (Chromium y WebKit), a 1440 × 900 y a 390 × 844:

- a 1440: Personas con `PageHeader`, pestañas que navegan por enlace, avatar y `StatusBadge`, menú
  «Editar», «Cambiar estado», separador, «Eliminar»; Grupos con su menú y avatares; Presentaciones y
  Unidades en tabla (no tarjetas) con su ancho máximo y su menú; las dos integraciones con miga, `h1` y
  vacío;
- a 390: ninguna de las seis pantallas desborda en horizontal (R37), pestañas desplazables, tarjetas
  con «Acciones» de 44 px que abre el diálogo centrado con su título e ítems de 48 px, los seis
  diálogos enteros y centrados (R30), los cinco paneles a todo el ancho con su pie visible (R26).
- *Enmienda E1, E13:* son cinco pantallas (una sola integración, inventarios). Una empresa nace sin
  añadidos (`e2e/helpers/addons.ts:3`) y sin el de Integraciones `integraciones.modificar` sale del
  permiso efectivo (`lib/modules/identity/domain/company-addons.ts:11`) y la página responde 404: el
  spec llama `enableAllAddons(companyId)` tras crear su empresa, como `e2e/inventario-rediseno.spec.ts`
  y `e2e/formulas-rediseno.spec.ts`. A 1440 afirma también el panel de usuario a 600 px (R26, P18) y
  el icono de un diálogo (R39).

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
  (`integration-pages.test.tsx:154`). *Enmienda E1:* tampoco Proveedor IA (QC-275, otra persona;
  `integration-pages.test.tsx:159-169`).
- *Enmienda E17:* **QC-266** (mía, se enmienda en paralelo y va primero). Ya no se comparten
  `row-actions-menu.tsx` ni `data-table-types.ts` (E4, E5), salvo que QC-266 decida ampliar el `Pick`
  de `RowActionsSpec`: en ese caso los tipos locales de esta ficha siguen compilando (son una
  intersección) y no hace falta tocarlos. Siguen compartidos `acciones-por-fila`,
  `confirmaciones-paridad`, `formularios-paridad` y `campos-paridad` (+ `.snap`),
  `confirm-dialog-montado.test.tsx`, `tablas-marca.test.tsx`, `data-table-alcance.test.ts` y
  `guard-identificador-de-request.test.ts`: con QC-266 en `dev`, esta rama sincroniza antes de la
  tanda que los toca y regenera sobre él.
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
- *Enmienda E7:* con P17 por defecto, D56 no se amplía: Configuración queda con el icono y se anota
  en D56 como resuelta aquí. Solo si P17 cambia, D56 se amplía a los seis diálogos.
- *Enmienda E8:* D55 (la X de 32 px de `Sheet`) sigue en los cinco paneles; no lo cubre ningún R.

## Dependencias de terceros

Ninguna nueva. `@base-ui/react` (Tabs, Menu, Dialog, AlertDialog, Sheet, Select), `sonner`,
`lucide-react` y `@tanstack/react-table` ya están en `docs/dependencias.md`. *Enmienda:* la enmienda
tampoco añade ninguna (`LockIcon`, `LogOutIcon` y `TrashIcon` son de `lucide-react`).

## 12. Enmienda contra dev (2026-10-19)

**Por qué.** El spec se escribió y aprobó el 2026-10-13 (P1–P16 por defecto). El 2026-10-19 la rama
recibió `origin/dev` (`47df7fb9`): QC-262, QC-263, QC-264 (#274), QC-275/QC-280, QC-277, QC-278 (#268),
QC-165/QC-166 y cambios directos a `dev`. **Regla:** en lo visual manda el tablero
(`docs/diseno/canvas/`); en columnas, costos y datos, lo mergeado. No se cambia conducta aprobada
salvo que `dev` la haga imposible o la haya resuelto distinto; en ese caso queda una pregunta nueva con
su defecto (P17, P18, `requirements.md`).

**Cómo se leyó `dev`.** Sin shell ni git: se leyó el árbol del worktree tras el merge (código, tests,
guardias, tableros, `components/shared/CATALOGO.md`, `progress/` y `feature_list.json`). Ninguna ficha
mergeada desde el 2026-10-13 tocó `app/(private)/configuracion/` (ningún `progress/impl_QC-26*`,
`QC-27*` ni `QC-28*` la nombra; los componentes de fila, columnas, tablas y diálogos siguen como los
describe este diseño). Lo que cambió es lo de alrededor. Las citas son `archivo:línea` del árbol tras
`47df7fb9`.

| # | Qué decía el spec | Qué hay en `dev` (cita) | Qué cambia aquí | R / P / T |
| --- | --- | --- | --- | --- |
| E1 | Alcance, R23, R25, R37, D11: dos páginas cascarón, `/integraciones/proveedor-ia` e `/integraciones/inventarios` | Proveedor IA es pantalla de QC-275: `PageShell`, `PageHeader`, `ErrorState`, `AiProviderForm` o `AiProviderCard` (`app/(private)/integraciones/proveedor-ia/page.tsx:29-62`); el test de QC-222 ya lo fija: «solo inventarios sigue siendo cascarón» (`tests/unit/integraciones-ui/integration-pages.test.tsx:159-176`). `Integraciones.dc.html:80` sigue pintando las tres como vacío; el tablero propio es `ProveedorIA.dc.html` | El cascarón queda para inventarios. R23, R25 y R37 nombran una sola integración; R24 añade `app/(private)/integraciones/proveedor-ia/` a lo que no se toca y la guardia D13 lo vigila | R23, R24, R25, R37; T6a, T7c, T8a |
| E2 | P14: miga de dos pasos sin enlaces, por defecto | La misma forma ya está en `dev`: `breadcrumb={{ label: 'Ruta', items: [{ label: INTEGRATIONS_LABEL }, { label: AI_PROVIDER_INTEGRATION_LABEL }] }}` (`proveedor-ia/page.tsx:37-44`) | P14 resuelta por precedente; D11 copia la forma con `title` | R23; P14; T6a |
| E3 | D11: `EmptyState` con `role` y `data-testid` en la raíz «si lo deja» | `EmptyState` tiene `testId` en la raíz y `messageTestId`, pero no `role` (`components/shared/empty-state.tsx:14-26, 109-113`) | Un `div role="status" data-testid="integration-empty"` envuelve `EmptyState` (`icon`, `message`, sin enlaces); el texto del recuadro sigue siendo solo el mensaje y QC-222 R10 (ni `a` ni `button`) sigue en verde | R23; T6a |
| E4 | P1, T1a, D7: `separatorBefore` lo trae QC-262; si no, se implementa aquí | Está en `dev`: `components/shared/row-actions-menu.tsx:53-54, 82-85, 137, 211-213`, test `tests/unit/shared-ui/row-actions-menu-separator.test.tsx`, fila de `CATALOGO.md:91` | P1 resuelta. T1a solo verifica; `row-actions-menu.tsx`, `row-actions-menu-separator.test.tsx`, `row-actions-menu-centrado.test.tsx` y `catalogo-qc256.test.ts` salen de `Archivos esperados` | R33; P1; T1a, T1c |
| E5 | D7, T1b: añadir `triggerDataAttributes` al `Pick` de `RowActionsSpec` | No está (`components/shared/data-table/data-table-types.ts:65`); QC-263 y QC-264 usan un tipo local (`app/(private)/inventario/components/product-row-actions.tsx:41-43`) y la propagación de `actionsColumn` (`actions-column.tsx:27-28`) y de la tarjeta (`data-table-cards.tsx:73`) | Tipo local en cada `*-row-actions.tsx` / `work-group-columns.tsx` de la ficha (D4); `data-table-types.ts` sale de `Archivos esperados` | R34; T1b, T2c, T3a, T4b, T5b |
| E6 | R35, T1c: fila del catálogo al día si una pieza gana un punto de extensión | Con E4 y E5, ninguna pieza de `components/shared/` cambia | `CATALOGO.md` no se toca; R35 se verifica con `guard-catalogo-de-componentes` en verde (sin cambios); `guard-catalogo-de-componentes.test.ts` sale de `Archivos esperados` | R35; T1c |
| E7 | P13 y «Lo que NO entra»: icono de los diálogos fuera porque `ConfirmDialog` no lo tiene | Lo tiene: `icon` con `glyph`, `tone` y `testId` (`components/shared/confirm-dialog.tsx:80-97, 182, 233-239`; `CATALOGO.md:57`), lo reenvían `ConfirmDialogBaseProps` (`:362-363`) y `DeleteConfirmDialog(Body)` (`delete-confirm-dialog.tsx:23, 44`); lo usan `company-delete-dialog.tsx:134`, `administrator-delete-dialog.tsx:69` y `delete-recipe-dialog.tsx:173`; D56 «en parte resuelta» (`progress/deudas.md:450-456`). Tablero: `ModalesConfiguracion.dc.html:169, 182, 192, 202, 212, 222` | P13 obsoleta; P17 (defecto: los seis con icono). R39 y D14 nuevos; `confirmaciones-paridad.snap` pasa a cambiar; los seis diálogos y sus tests entran en `Archivos esperados` | R31, R39; P13, P17; T7d |
| E8 | P7, D8: los paneles miden hoy `sm:max-w-md` (448 px) | Usuario y grupo pasan `minScreenWidth={70}` (`user-form.tsx:399`, `work-group-form.tsx:366`), que pone `min-width: 70vw` y gana al `max-width` (`components/ui/sheet.tsx:88-97, 126-130`): ~1008 px a 1440. El estado de carga del panel de usuario mide 448 (`user-sheet.tsx:169`, `form-sheet.tsx:20-21`) | P18 (defecto: tablero, 600 px; los dos formularios dejan de pasar `minScreenWidth`). R26 no cambia de texto; D8 lo dice | R26; P7, P18; T0b, T7a |
| E9 | R28, D10: rol del buscador oculto con `@max-[760px]:hidden` (contenedor) | El `DataTable` del buscador no lleva `card` (`work-group-form.tsx:641`), así que su raíz no es `@container` (`data-table.tsx:292`), y el panel se pinta en un portal sin contenedor. El tablero pinta el rol en el panel de escritorio (`ModalesConfiguracion.dc.html:68`) | R28 dice «ventana»; D10 usa `max-[760px]:hidden` | R28; T3b |
| E10 | D5: «Contenido» gana `tabular`; ids de unidades «en T0»; `tablas-marca` «si afirma clases» | «Contenido» ya es `tabular` y `align: 'end'` (`presentation-columns.tsx:89-97`); ids `name`, `symbol`, `equivalence` (`unit-columns.tsx:44-46`); `tablas-marca.test.tsx:278-281, 320-327` es una lista cerrada por archivo de las columnas en Mono y llama `buildPresentationColumns([])` | D5 solo atenúa «Sin contenido»; el `card` de unidades queda con ids reales; «Usuario» y «Símbolo» pasan a `tabular`, y la lista cerrada gana `user-columns.tsx` `['Usuario']` y `unit-columns.tsx` `['Símbolo']`; `tablas-marca.test.tsx` cambia seguro | R4, R14, R19; T2b, T4b, T5c |
| E11 | § 7: las `*-convenciones.test.ts` cambian «solo si» el censo encuentra una regla que muerda | Reglas sin precondición de rama: cuenta de componentes de la ruta de usuarios (`usuarios-convenciones.test.ts:86, 562-582`: 25); todo nombre exportado de un componente debe salir del barrel (`usuarios-convenciones.test.ts:584-594`, `configuracion-convenciones.test.ts:460`, `unidades-convenciones.test.ts:478`); nadie importa por ruta profunda (`:605`, `:481`, `:499`); los tests de `tests/unit/configuracion-ui/` no consultan por texto visible (`configuracion-convenciones.test.ts:708-722`, `unidades-convenciones.test.ts:791-812`, `grupos/alcance.test.ts:895-944`) | `user-avatar-name.tsx` sube la cuenta a 26 (`usuarios-convenciones.test.ts` entra fijo en `Archivos esperados`); `userRowActionsSpec`, `UserRowAction`, `UserRowActionsSpec`, `USER_ACCOUNT_STATUS_TONES`, `UserAvatarName`, `workGroupRowActionsSpec`, `presentationRowActionsSpec`, `unitRowActionsSpec` y sus tipos salen de su barrel; los tests nuevos importan por el barrel y consultan por rol, testid o constante (los textos de R32 y R39 se fijan con `expect(CONSTANTE).toBe('…')`, no con `getByText`) | R36; T0a, T2–T7 |
| E12 | — | `tests/unit/proveedores/module-contract.test.ts:370-376` prohíbe `/proveedores\|supplier/i` en el contenido sin comentarios de todo `app/` fuera de `app/(private)/proveedores`. Hoy ningún archivo de `configuracion/` ni de `integraciones/` la contiene | Restricción para todo archivo nuevo o tocado de la ficha bajo `app/`; un texto que necesitara la palabra iría a `lib/shared/ui/` con su fila en el catálogo (precedente QC-278 E17, `lib/shared/ui/addon-details.ts`). Ningún texto de la ficha la necesita | R36 |
| E13 | § 7: el E2E nuevo abre las integraciones con el permiso | QC-277: `integraciones` es un añadido; sin él, `integraciones.modificar` sale del permiso efectivo (`lib/modules/identity/domain/company-addons.ts:11`) y la página responde 404; una empresa nace sin añadidos (`e2e/helpers/addons.ts:3-15`). La pestaña Módulos del Maestro (QC-278) es la que los prende | El E2E llama `enableAllAddons(companyId)` tras crear su empresa (precedente `e2e/inventario-rediseno.spec.ts`, `e2e/formulas-rediseno.spec.ts`). R25 no cambia: el corte por añadido pasa por el mismo `requirePagePermission` y ya lo cubre `e2e/modulos-por-empresa.spec.ts` | R23, R25, R37; T8a |
| E14 | «Lo que ya existe»: QC-262/263/264 «aprobados, sin implementar», specs en `.worktrees/` | En `dev` (`done`); specs en `specs/QC-262-rediseno-pedidos/`, `specs/QC-263-rediseno-inventario/`, `specs/QC-264-rediseno-formulas/`. Patrón «menú como datos + envoltorio» en `product-row-actions.tsx:55-138`; apoyos de test `tests/helpers/row-actions-menu.ts` (`openRowActionsMenu`) y `tests/helpers/viewport.ts` | Citas corregidas; D4 y D5 siguen ese patrón; los tests nuevos usan los dos apoyos | R6–R22 |
| E15 | — (piezas nuevas de `dev`) | `cardFieldLabel` (`CATALOGO.md:55`), `FormFooterBar` (interno de Fórmulas, `app/(private)/produccion/formulas/components/form-footer-bar.tsx`), `ArrowLink` (`CATALOGO.md:52`), tonos de `DocumentUpload` (`CATALOGO.md:69`), `TabsIndicator` (`CATALOGO.md:41`) | No aplican: las tarjetas de `UsuariosMovil`, `PresentacionesMovil` y `UnidadesMovil` no rotulan campos; los paneles de la ficha son `FormSheet`; no hay «Volver» ni «Ir a»; no hay subida de documentos; `UrlTabs` ya trae su indicador | — |
| E16 | — | `docs/conventions.md:22-36`: ningún comentario de producción cita ficha ni requisito; el review de QC-264 lo marcó (commit `4de481b4`, «comentarios sin cita de requisito y con tildes») | Los comentarios que la ficha escribe o reescribe no citan `R<n>`, `QC-<n>` ni `design.md` y llevan tildes; los heredados de bloques que no se tocan se quedan (no es alcance) | T2–T7 |
| E17 | § 9: orden con QC-262, QC-263, QC-264 y QC-266 | QC-262/263/264 en `dev`. QC-266 (mía) se enmienda en paralelo y va primero; su `tasks.md > Archivos esperados` comparte con esta `acciones-por-fila`, `confirmaciones-paridad`, `formularios-paridad`, `campos-paridad` (+ `.snap`), `confirm-dialog-montado.test.tsx`, `data-table-alcance.test.ts`, `guard-identificador-de-request.test.ts` y, «solo si», `row-actions-menu.tsx` y `data-table-types.ts` | Esta ficha ya no toca esos dos (E4, E5). Las tandas 2–5, 7 y 8 se implementan con QC-266 en `dev` y esta rama sincronizada; si QC-266 amplía el `Pick` de `RowActionsSpec`, los tipos locales siguen valiendo | § 9; T0a, T2c, T4c, T5c, T7a, T7d, T8a |
| E18 | «Lo que ya existe»: citas de los dieciséis toasts | Las constantes siguen y con el mismo texto; cambiaron las líneas: `user-sheet.tsx:130`, `user-status-dialog.tsx:103`, `end-user-sessions-dialog.tsx:77`, `delete-user-dialog.tsx:82`, `work-group-sheet.tsx:67`, `delete-work-group-dialog.tsx:85`, `work-group-members.tsx:184, 202`, `presentation-sheet.tsx:82`, `delete-presentation-dialog.tsx:110`, `unit-sheet.tsx:63`, `delete-unit-dialog.tsx:86`; el aviso de miembros fallidos, `work-group-form.tsx:281` | R32 y D12 sin cambio | R32; T7b |
| E19 | D6, P6: con 760 px de envoltorio «el contenedor queda justo en el borde» | Con `card`, la raíz de `DataTable` es `@container` (`data-table.tsx:292`) y la tabla se oculta con `@max-[760px]:hidden` (`:311`), que es «menos de 760 px» | A exactamente 760 px sale tabla; T0b lo confirma y la desviación de P6 solo aplica si un borde o relleno lo baja | R14; P6; T0b |
| E20 | Comprobado sin cambios | `PageHeader` con `title`, `titleTestId`, `actions`, `breadcrumb`; `UrlTabs` con `current` e `items` (`icon`, `count`, `testId`; `url-tabs.tsx:11-23`); `StatusBadge` y `StatusTone` de siete tonos (`CATALOGO.md:95, 126`); `DataTableCardLayout` y `cardActions`/`closeMenu` (`data-table-types.ts:114-120, 184-187`); `WorkGroupMemberRow` con dos claves (`lib/modules/identity/domain/work-group-view.ts:59-62`, P4); `SelectField` solo texto (P12, D57); `badges-estado.test.tsx:145-151` sigue sobre `UserStatusBadge` (R6 de QC-227, enmienda § 10); rejilla del formulario de usuario (`user-form.tsx:455-456`, P8). QC-165/QC-166 trajeron `AdministratorFields` (`CATALOGO.md:50`) para el Maestro: el formulario de usuario no lo adopta (R31) | Sin cambio | — |

**Requisitos antes de la enmienda** (para el reviewer):

- R23 decía: «CUANDO alguien con `integraciones.modificar` abre `/integraciones/proveedor-ia` o
  `/integraciones/inventarios`, el sistema DEBE pintar dentro de `PageShell` un `PageHeader` […]
  *(supuesto P14)*».
- R24 no nombraba `app/(private)/integraciones/proveedor-ia/` ni la pantalla de Proveedor IA.
- R25 decía «Las dos páginas cascarón DEBEN conservar su `requirePagePermission(...)` […], sus
  `metadata` y sus importaciones de hoy».
- R26 llevaba solo *(supuesto P7)*.
- R28 decía «su rol (oculto MIENTRAS el contenedor mide 760 px o menos)».
- R31 decía «salvo lo que dicen R26–R29. *(supuestos P8, P9, P11, P12, P13)*».
- R37 decía «y las dos integraciones provisionales».
- R39 es nuevo.
