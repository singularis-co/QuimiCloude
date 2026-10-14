# QC-267 — rediseno-configuracion · tasks.md

Verificación de cada tanda (`docs/perfil-agentes.md > Todos los agentes`): `pnpm run typecheck`,
`pnpm run lint`, `pnpm exec vitest related --run <archivos de la tanda>` y
`pnpm exec vitest run guard`. Los E2E se corren por spec (`pnpm exec playwright test <spec>`) en la
tanda 8, que cierra con `./init.sh --completo` (lección de QC-261 y QC-265: el gate rápido no ve las
listas cerradas sin relación con el diff).

`[P]` = puede ir en paralelo con las otras `[P]` de su tanda. Antes de la tanda 1, el humano cierra
P1–P16 de `requirements.md` (o acepta los valores por defecto) y, con P1 por defecto, QC-262 está en
`dev` y esta rama está sincronizada con él.

## Tanda 0 — Censo y medidas (antes de tocar producción)

- [ ] **T0a. Censo con grep.** En `tests/unit`, `tests/ui`, `tests/guards`, `tests/integration` y `e2e`,
  cada símbolo, texto o testid que la ficha cambia o duplica: `usuarios-title`, `usuarios-tabs`,
  `usuarios-tab-`, `UsuariosTabsSwitch`, `router.push`, `user-status`, `UserStatusBadge`,
  `STATUS_VARIANTS`, `user-row-actions`, `user-action-`, `data-user-id`, `work-group-row-actions`,
  `work-group-action-`, `data-work-group-id`, `presentaciones-title`, `presentation-row-actions`,
  `presentation-action-`, `data-presentation-id`, `PresentationRowActions`, `unidades-title`,
  `unit-row-actions`, `unit-action-`, `data-unit-id`, `UnitRowActions`, `integration-title`,
  `integration-empty`, `IntegrationPlaceholder`, `user-sheet-loading`, `Cargando los datos de la
  persona`, `Agregado`, `Quitar del grupo`, `data-table-row-`, `data-table-card`, `sm:max-w-md`.
  Marcar los localizadores de página entera que con tarjetas encuentran dos elementos y las reglas de
  `*-convenciones.test.ts` sin precondición de rama que muerdan el cambio. Comprobar si
  `separatorBefore` (QC-262) y `triggerDataAttributes` en `RowActionsSpec` ya están en `dev`, y los
  ids reales de las columnas de `unit-columns.tsx` y `presentation-columns.tsx`. *Hecho:*
  `progress/impl_QC-267.md` tiene la tabla «archivo → qué nombra → qué le pasa» y el estado de las dos
  piezas; todo archivo que salga y no esté en `## Archivos esperados` se añade a esa sección en el
  mismo commit.
- [ ] **T0b. Medidas.** Con el servidor de desarrollo: a 1440 × 900, el ancho del contenedor de la
  tabla de Presentaciones con el envoltorio de 760 px (¿sale en tabla?, P6); a 820 px, el contenedor
  de las cuatro listas (¿cae bajo 760?); a 390 × 844, los cinco paneles y los seis diálogos (¿enteros?,
  ¿pie visible?). *Hecho:* lo medido queda en el impl; si difiere de `design.md > D6` o `> D8`, se
  anota como desviación antes de la tanda 2.

## Tanda 1 — Piezas compartidas (depende de T0a)

- [ ] **T1a. Separador** (R33). Con P1 por defecto: solo verificar que `separatorBefore` está y que su
  test (`row-actions-menu-separator.test.tsx`) pasa. Si P1 cambia: implementarlo con el contrato de
  QC-262 D7 y ese mismo test (con la prop hay `role="separator"` antes del ítem en las dos
  presentaciones; nunca delante del primero; sin la prop, `row-actions-menu-centrado.test.tsx` sin
  cambios).
- [ ] **T1b [P]. `triggerDataAttributes` en `RowActionsSpec`** (D7, R34), solo si T0a dice que falta.
  *Hecho:* `typecheck` verde y los consumidores de hoy sin cambios.
- [ ] **T1c. Catálogo** (R35; depende de T1a–T1b). Filas de `RowActionsMenu` y `DataTable` solo si
  T1a/T1b tocaron algo. *Hecho:* `pnpm exec vitest run guard-catalogo-de-componentes catalogo-qc256` en
  verde.

## Tanda 2 — Usuarios: cabecera, pestañas y Personas (depende de T1)

- [ ] **T2a [P]. Cabecera y pestañas** (D1, R1–R3). `usuarios/page.tsx`, `usuarios-tabs-switch.tsx`,
  `user-create-action.tsx`, `work-group-create-action.tsx`. Test nuevo
  `tests/unit/configuracion-ui/usuarios-rediseno.test.tsx`: un `h1` con su testid; alta en la cabecera
  según la pestaña y solo con permiso, con «+» y `touch`; dos pestañas como enlaces con su `href` (solo
  `tab`), la vigente seleccionada, iconos y testids de hoy; solo se monta la sección de la pestaña.
  `usuarios-page.test.tsx`, `grupos/usuarios-page.test.tsx` y `grupos/usuarios-tabs-switch.test.tsx`
  actualizados.
- [ ] **T2b [P]. Estado y avatar** (D2, D3, R4, R5). `user-labels.ts` (`USER_ACCOUNT_STATUS_TONES`),
  `user-columns.tsx` (`UserStatusBadge` sobre `StatusBadge`, celda de nombre),
  `user-avatar-name.tsx`. `user-columns.test.tsx` y `badges-estado.test.tsx` (R6 enmendado, § 10)
  actualizados.
- [ ] **T2c. Menú declarado y tarjetas** (D4, R6–R8; depende de T2b). `user-row-actions.tsx`
  (`userRowActionsSpec`), `user-columns.tsx`, `user-table.tsx`, `index.ts`. Test nuevo
  `tests/unit/configuracion-ui/user-cards.test.tsx` (con el helper de viewport heredado): orden
  «Editar», «Cambiar estado», separador, «Eliminar» destructivo; sin permiso ni menú ni «Acciones»;
  ningún ítem de cierre de sesiones; tarjeta con usuario, estado, avatar y nombre, correo y rol;
  «Acciones» abre el diálogo centrado con el nombre e ítems de 48 px; cada ítem abre su panel o diálogo
  para esa persona, nunca dos. `user-row-actions.test.tsx`, `user-table.test.tsx`,
  `user-list-section.test.tsx`, `user-list-empty.test.tsx`, `user-create-action.test.tsx` y
  `usuarios-viewport.test.tsx` acotados al cuerpo visible. Snapshots de `usuarios-paridad` y
  `acciones-por-fila` (filas de `design.md > 6`).

## Tanda 3 — Grupos (depende de T2b) [P con 4 y 5]

- [ ] **T3a. Menú declarado y tarjetas** (D4, R9–R12). `work-group-columns.tsx`
  (`workGroupRowActionsSpec`, «Abrir» con flecha), `work-group-table.tsx`. Test nuevo
  `tests/unit/configuracion-ui/grupos/work-group-cards.test.tsx`: avatares y «+N» con su nombre; menú
  «Abrir», separador, «Eliminar»; sin permiso nada; tarjeta con nombre, avatares y «Acciones», sin
  número de miembros; cada ítem abre su panel o diálogo, nunca dos. `work-group-columns.test.tsx`,
  `work-group-table.test.tsx`, `work-group-list-section.test.tsx`, `work-group-list-empty.test.tsx`,
  `work-group-list-skeleton.test.tsx`, `work-group-create-action.test.tsx` y `work-group-a11y.test.tsx`
  actualizados.
- [ ] **T3b. Panel del grupo** (D3, D10, R28, R29; depende de T3a). `work-group-form.tsx`,
  `work-group-members.tsx`. `work-group-form.test.tsx`: candidata con avatar, nombre y rol (con la
  clase que la oculta en estrecho), «Agregado» con marca, deshabilitado y de ancho fijo.
  `work-group-members.test.tsx`: miembro con avatar, nombre y «Quitar del grupo»; texto de paginación
  de hoy. Snapshot de `grupos-paridad`.

## Tanda 4 — Presentaciones (depende de T1) [P con 3 y 5]

- [ ] **T4a. Cabecera** (D5, R13). `presentaciones/page.tsx`, `presentation-sheet.tsx` (disparador de
  alta con «+» y `touch`). `presentation-page.test.tsx` actualizado (un `h1`, alta en la cabecera, error
  del catálogo sin cabecera).
- [ ] **T4b. Menú declarado y anfitrión** (D5, R15, R17; depende de T4a). `presentation-row-actions.tsx`,
  `presentation-columns.tsx`, `presentation-table.tsx`, `index.ts`. Test nuevo
  `tests/unit/configuracion-ui/presentation-row-actions.test.tsx`: orden con separador, testids y
  `data-presentation-id`; cada ítem abre el panel o el diálogo de esa presentación; un solo anfitrión
  montado por tabla; el cerrado sigue montado para animar. `presentation-columns.test.tsx`,
  `presentation-table.test.tsx`, `presentation-sheet.test.tsx`, `delete-presentation-dialog.test.tsx` y
  `confirm-dialog-montado.test.tsx` actualizados.
- [ ] **T4c. Tabla y tarjetas** (D5, D6, R14, R16; depende de T4b). Test nuevo
  `tests/unit/configuracion-ui/presentation-cards.test.tsx`: contenido alineado al final en mono, «Sin
  contenido» atenuado, envoltorio de 760 px (o el medido en T0b), tarjeta con nombre y contenido y
  «Acciones» centrado. Snapshots de `presentaciones-paridad` y `acciones-por-fila`.

## Tanda 5 — Unidades (depende de T1) [P con 3 y 4]

- [ ] **T5a. Cabecera** (D5, R18). `unidades/page.tsx`, `unit-sheet.tsx`. `unit-page.test.tsx`
  actualizado (un `h1`, alta en la cabecera, cabecera también sin catálogo).
- [ ] **T5b. Menú declarado y anfitrión** (D5, R20, R22; depende de T5a). `unit-row-actions.tsx`,
  `unit-columns.tsx`, `unit-table.tsx`, `index.ts`. Test nuevo
  `tests/unit/configuracion-ui/unit-row-actions.test.tsx`: orden con separador, testids y
  `data-unit-id`; cada ítem abre su panel o diálogo; un solo anfitrión; el contenido del diálogo se
  rehace en cada apertura, como hoy. `unit-columns.test.tsx`, `unit-table.test.tsx`,
  `unit-sheet.test.tsx`, `delete-unit-dialog.test.tsx`, `unidades-viewport.test.tsx`,
  `configuracion-viewport.test.tsx` y `confirm-dialog-montado.test.tsx` actualizados.
- [ ] **T5c. Tabla y tarjetas** (D5, R19, R21; depende de T5b). Test nuevo
  `tests/unit/configuracion-ui/unit-cards.test.tsx`: símbolo en mono, marca de vacío atenuada,
  equivalencia con el texto de hoy, envoltorio de 880 px, tarjeta con símbolo, nombre, equivalencia y
  «Acciones». `unit-equivalence.test.ts` sin cambios. Snapshots de `unidades-paridad` y
  `acciones-por-fila`.

## Tanda 6 — Integraciones provisionales (depende de T0a) [P con 2–5]

- [ ] **T6a.** (D11, R23–R25) `integration-placeholder.tsx`. `integration-pages.test.tsx` actualizado:
  miga «Integraciones › <etiqueta>» sin enlaces, un `h1` con `integration-title` igual a la etiqueta
  del menú, recuadro `role="status"` con `integration-empty` cuyo texto es exactamente el acordado,
  icono `aria-hidden`; siguen en verde los casos de R9–R11 de QC-222 (sin `form`, `input`, `button`,
  `a`; imports de `page.tsx`; corte en la primera sentencia; WhatsApp sin el cascarón).
  *Hecho:* ningún archivo de `integraciones/whatsapp/` ni de `lib/modules/integraciones/` en el diff.

## Tanda 7 — Paneles, avisos y guardia (depende de 2–6)

- [ ] **T7a [P]. Paneles** (D8, D9, R26, R27, R31). `user-form.tsx`, `user-sheet.tsx`,
  `work-group-form.tsx`, `presentation-form.tsx`, `unit-form.tsx` (solo la clase de ancho y lo que T0b
  encontró). `user-sheet.test.tsx`: estado de carga con título, «Cambia los datos de la persona.»,
  giro, texto y esqueleto. Tests de los cinco paneles: clase de ancho y textos de hoy (R31). Snapshot
  de `formularios-paridad`.
- [ ] **T7b [P]. Avisos emergentes** (D12, R32). Test nuevo
  `tests/unit/configuracion-ui/configuracion-toasts.test.tsx`: cada éxito del R32 lanza un único
  `toast.success` con su texto; un fallo no lanza ninguno; el alta de grupo con miembros fallidos lanza
  el `toast.error` de hoy.
- [ ] **T7c [P]. Guardia** (D13, R24, R38). `tests/guards/guard-configuracion-rediseno.test.ts`, con un
  caso sobre fuente fabricada que demuestra que muerde.

## Tanda 8 — E2E y cierre (depende de todas)

- [ ] **T8a. E2E nuevo** `e2e/configuracion-rediseno.spec.ts` con los casos de `design.md > 7` (R2,
  R5–R7, R10, R11, R14–R16, R19–R21, R23, R26, R30, R37) a 1440 × 900 y 390 × 844, y sus altas en
  `E2E_ESPERADOS` de `tests/guards/guard-identificador-de-request.test.ts` y en la lista cerrada de
  `tests/unit/shared/data-table-alcance.test.ts`, con el comentario «Alta el <fecha> (QC-267) por el
  MISMO motivo y en el MISMO sitio que las demas: la lista es CERRADA y darse de alta en ella es su
  punto de extension por diseno. El ancla NO se relaja -el archivo se nombra, uno a uno-. Lo que
  ejercita: …». *Hecho:* pasa en Chromium y WebKit; las dos guardias en verde.
- [ ] **T8b. E2E existentes** (R36). Acotar a `data-table-row-<id>` los localizadores de página que
  T0a marcó en `e2e/usuarios.spec.ts`, `cierre-de-sesiones.spec.ts`, `unidades.spec.ts`,
  `piezas-compartidas.spec.ts`, `producto-terminado.spec.ts` y los que salgan;
  `grupos-de-trabajo.spec.ts`, `presentaciones.spec.ts`, `integraciones.spec.ts`, `login.spec.ts` y
  `aislamiento-inventario.spec.ts` pasan con los testids conservados. *Hecho:* cada spec tocado pasa
  por separado.
- [ ] **T8c. Deudas y cierre.** `progress/deudas.md`: D53 ampliada a Configuración; nuevas de P4, P9,
  P10, P12, P13 y P16 si quedan por defecto. `./init.sh --completo` en verde.

## Trazabilidad R → test

| R | Test |
| --- | --- |
| R1, R2, R3 | `tests/unit/configuracion-ui/usuarios-rediseno.test.tsx`, `tests/unit/configuracion-ui/grupos/usuarios-tabs-switch.test.tsx` (R2), `e2e/configuracion-rediseno.spec.ts` (R2) |
| R4, R5, R7 | `tests/unit/configuracion-ui/user-cards.test.tsx`, `tests/unit/configuracion-ui/user-columns.test.tsx` (R4, R5), `tests/unit/marca/badges-estado.test.tsx` (R5), `e2e/configuracion-rediseno.spec.ts` (R5, R7) |
| R6, R8 | `tests/unit/configuracion-ui/user-cards.test.tsx`, `tests/unit/configuracion-ui/user-row-actions.test.tsx`, `e2e/configuracion-rediseno.spec.ts` (R6) |
| R9, R10, R11, R12 | `tests/unit/configuracion-ui/grupos/work-group-cards.test.tsx`, `tests/unit/configuracion-ui/grupos/work-group-columns.test.tsx` (R9, R10), `e2e/configuracion-rediseno.spec.ts` (R10, R11) |
| R13 | `tests/unit/configuracion-ui/presentation-page.test.tsx` |
| R14, R16 | `tests/unit/configuracion-ui/presentation-cards.test.tsx`, `e2e/configuracion-rediseno.spec.ts` |
| R15, R17 | `tests/unit/configuracion-ui/presentation-row-actions.test.tsx`, `e2e/configuracion-rediseno.spec.ts` (R15) |
| R18 | `tests/unit/configuracion-ui/unit-page.test.tsx` |
| R19, R21 | `tests/unit/configuracion-ui/unit-cards.test.tsx`, `e2e/configuracion-rediseno.spec.ts` |
| R20, R22 | `tests/unit/configuracion-ui/unit-row-actions.test.tsx`, `e2e/configuracion-rediseno.spec.ts` (R20) |
| R23, R25 | `tests/unit/integraciones-ui/integration-pages.test.tsx`, `e2e/configuracion-rediseno.spec.ts` (R23), `e2e/integraciones.spec.ts` (R23) |
| R24 | `tests/guards/guard-configuracion-rediseno.test.ts`, `tests/unit/integraciones-ui/integration-pages.test.tsx` |
| R26 | `tests/unit/configuracion-ui/user-sheet.test.tsx`, `tests/unit/configuracion-ui/user-form.test.tsx`, `tests/unit/configuracion-ui/grupos/work-group-sheet.test.tsx`, `tests/unit/configuracion-ui/presentation-sheet.test.tsx`, `tests/unit/configuracion-ui/unit-sheet.test.tsx`, `e2e/configuracion-rediseno.spec.ts` |
| R27 | `tests/unit/configuracion-ui/user-sheet.test.tsx` |
| R28 | `tests/unit/configuracion-ui/grupos/work-group-form.test.tsx` |
| R29 | `tests/unit/configuracion-ui/grupos/work-group-members.test.tsx` |
| R30 | `e2e/configuracion-rediseno.spec.ts` |
| R31 | `tests/unit/configuracion-ui/user-form.test.tsx`, `tests/unit/configuracion-ui/user-status-dialog.test.tsx`, `tests/unit/configuracion-ui/end-user-sessions-dialog.test.tsx`, `tests/unit/configuracion-ui/delete-user-dialog.test.tsx`, `tests/unit/configuracion-ui/grupos/delete-work-group-dialog.test.tsx`, `tests/unit/configuracion-ui/delete-presentation-dialog.test.tsx`, `tests/unit/configuracion-ui/delete-unit-dialog.test.tsx`, `tests/unit/paridad/confirmaciones-paridad.test.tsx` |
| R32 | `tests/unit/configuracion-ui/configuracion-toasts.test.tsx` |
| R33 | `tests/unit/shared-ui/row-actions-menu-separator.test.tsx` |
| R34 | `tests/unit/configuracion-ui/user-cards.test.tsx`, `tests/unit/configuracion-ui/presentation-row-actions.test.tsx`, `tests/unit/configuracion-ui/unit-row-actions.test.tsx`, `tests/unit/configuracion-ui/grupos/work-group-cards.test.tsx` |
| R35 | `tests/guards/guard-catalogo-de-componentes.test.ts`, `tests/unit/shared-ui/catalogo-qc256.test.ts` |
| R36 | `tests/unit/paridad/usuarios-paridad.test.tsx`, `tests/unit/paridad/grupos-paridad.test.tsx`, `tests/unit/paridad/presentaciones-paridad.test.tsx`, `tests/unit/paridad/unidades-paridad.test.tsx`, `tests/unit/configuracion-ui/usuarios-route-contract.test.ts`, `tests/unit/configuracion-ui/presentations-route-contract.test.ts`, `tests/unit/configuracion-ui/units-route-contract.test.ts`, `e2e/usuarios.spec.ts`, `e2e/grupos-de-trabajo.spec.ts`, `e2e/cierre-de-sesiones.spec.ts`, `e2e/presentaciones.spec.ts`, `e2e/unidades.spec.ts` |
| R37 | `e2e/configuracion-rediseno.spec.ts` |
| R38 | `tests/guards/guard-configuracion-rediseno.test.ts` |

## Archivos esperados

Producción:

- `app/(private)/configuracion/usuarios/page.tsx`
- `app/(private)/configuracion/usuarios/components/index.ts`
- `app/(private)/configuracion/usuarios/components/usuarios-tabs-switch.tsx`
- `app/(private)/configuracion/usuarios/components/user-create-action.tsx`
- `app/(private)/configuracion/usuarios/components/work-group-create-action.tsx`
- `app/(private)/configuracion/usuarios/components/user-labels.ts`
- `app/(private)/configuracion/usuarios/components/user-avatar-name.tsx`
- `app/(private)/configuracion/usuarios/components/user-columns.tsx`
- `app/(private)/configuracion/usuarios/components/user-row-actions.tsx`
- `app/(private)/configuracion/usuarios/components/user-table.tsx`
- `app/(private)/configuracion/usuarios/components/user-sheet.tsx`
- `app/(private)/configuracion/usuarios/components/user-form.tsx`
- `app/(private)/configuracion/usuarios/components/work-group-columns.tsx`
- `app/(private)/configuracion/usuarios/components/work-group-table.tsx`
- `app/(private)/configuracion/usuarios/components/work-group-form.tsx`
- `app/(private)/configuracion/usuarios/components/work-group-members.tsx`
- `app/(private)/configuracion/presentaciones/page.tsx`
- `app/(private)/configuracion/presentaciones/components/index.ts`
- `app/(private)/configuracion/presentaciones/components/presentation-columns.tsx`
- `app/(private)/configuracion/presentaciones/components/presentation-row-actions.tsx`
- `app/(private)/configuracion/presentaciones/components/presentation-table.tsx`
- `app/(private)/configuracion/presentaciones/components/presentation-sheet.tsx`
- `app/(private)/configuracion/presentaciones/components/presentation-form.tsx`
- `app/(private)/configuracion/unidades/page.tsx`
- `app/(private)/configuracion/unidades/components/index.ts`
- `app/(private)/configuracion/unidades/components/unit-columns.tsx`
- `app/(private)/configuracion/unidades/components/unit-row-actions.tsx`
- `app/(private)/configuracion/unidades/components/unit-table.tsx`
- `app/(private)/configuracion/unidades/components/unit-sheet.tsx`
- `app/(private)/configuracion/unidades/components/unit-form.tsx`
- `app/(private)/integraciones/components/integration-placeholder.tsx`
- `components/shared/row-actions-menu.tsx` (solo si P1 cambia y QC-262 no está en `dev`)
- `components/shared/data-table/data-table-types.ts` (solo si falta `triggerDataAttributes` en `RowActionsSpec`)
- `components/shared/CATALOGO.md`

Tests y guardias:

- `tests/unit/configuracion-ui/usuarios-rediseno.test.tsx`
- `tests/unit/configuracion-ui/user-cards.test.tsx`
- `tests/unit/configuracion-ui/grupos/work-group-cards.test.tsx`
- `tests/unit/configuracion-ui/presentation-row-actions.test.tsx`
- `tests/unit/configuracion-ui/presentation-cards.test.tsx`
- `tests/unit/configuracion-ui/unit-row-actions.test.tsx`
- `tests/unit/configuracion-ui/unit-cards.test.tsx`
- `tests/unit/configuracion-ui/configuracion-toasts.test.tsx`
- `tests/unit/configuracion-ui/usuarios-page.test.tsx`
- `tests/unit/configuracion-ui/usuarios-viewport.test.tsx`
- `tests/unit/configuracion-ui/usuarios-route-contract.test.ts`
- `tests/unit/configuracion-ui/user-columns.test.tsx`
- `tests/unit/configuracion-ui/user-row-actions.test.tsx`
- `tests/unit/configuracion-ui/user-table.test.tsx`
- `tests/unit/configuracion-ui/user-list-section.test.tsx`
- `tests/unit/configuracion-ui/user-list-empty.test.tsx`
- `tests/unit/configuracion-ui/user-create-action.test.tsx`
- `tests/unit/configuracion-ui/user-sheet.test.tsx`
- `tests/unit/configuracion-ui/user-form.test.tsx`
- `tests/unit/configuracion-ui/user-status-dialog.test.tsx`
- `tests/unit/configuracion-ui/end-user-sessions-dialog.test.tsx`
- `tests/unit/configuracion-ui/delete-user-dialog.test.tsx`
- `tests/unit/configuracion-ui/grupos/usuarios-page.test.tsx`
- `tests/unit/configuracion-ui/grupos/usuarios-tabs-switch.test.tsx`
- `tests/unit/configuracion-ui/grupos/work-group-columns.test.tsx`
- `tests/unit/configuracion-ui/grupos/work-group-table.test.tsx`
- `tests/unit/configuracion-ui/grupos/work-group-list-section.test.tsx`
- `tests/unit/configuracion-ui/grupos/work-group-list-empty.test.tsx`
- `tests/unit/configuracion-ui/grupos/work-group-list-skeleton.test.tsx`
- `tests/unit/configuracion-ui/grupos/work-group-create-action.test.tsx`
- `tests/unit/configuracion-ui/grupos/work-group-a11y.test.tsx`
- `tests/unit/configuracion-ui/grupos/work-group-form.test.tsx`
- `tests/unit/configuracion-ui/grupos/work-group-members.test.tsx`
- `tests/unit/configuracion-ui/grupos/work-group-sheet.test.tsx`
- `tests/unit/configuracion-ui/grupos/delete-work-group-dialog.test.tsx`
- `tests/unit/configuracion-ui/presentation-columns.test.tsx`
- `tests/unit/configuracion-ui/presentation-table.test.tsx`
- `tests/unit/configuracion-ui/presentation-page.test.tsx`
- `tests/unit/configuracion-ui/presentation-sheet.test.tsx`
- `tests/unit/configuracion-ui/presentations-route-contract.test.ts`
- `tests/unit/configuracion-ui/delete-presentation-dialog.test.tsx`
- `tests/unit/configuracion-ui/unit-columns.test.tsx`
- `tests/unit/configuracion-ui/unit-table.test.tsx`
- `tests/unit/configuracion-ui/unit-page.test.tsx`
- `tests/unit/configuracion-ui/unit-sheet.test.tsx`
- `tests/unit/configuracion-ui/units-route-contract.test.ts`
- `tests/unit/configuracion-ui/delete-unit-dialog.test.tsx`
- `tests/unit/configuracion-ui/unidades-viewport.test.tsx`
- `tests/unit/configuracion-ui/configuracion-viewport.test.tsx`
- `tests/unit/configuracion-ui/configuracion-convenciones.test.ts` (solo si T0a encuentra una regla sin precondición de rama que muerda)
- `tests/unit/configuracion-ui/usuarios-convenciones.test.ts` (ídem)
- `tests/unit/configuracion-ui/unidades-convenciones.test.ts` (ídem)
- `tests/unit/integraciones-ui/integration-pages.test.tsx`
- `tests/unit/shared-ui/confirm-dialog-montado.test.tsx`
- `tests/unit/shared-ui/catalogo-qc256.test.ts` (solo si T1a o T1b tocan las filas de `RowActionsMenu` o `DataTable`)
- `tests/unit/shared-ui/row-actions-menu-separator.test.tsx` (solo si P1 cambia)
- `tests/unit/shared-ui/row-actions-menu-centrado.test.tsx` (solo si P1 cambia)
- `tests/unit/marca/badges-estado.test.tsx` (enmienda de R6 de QC-227)
- `tests/unit/marca/tablas-marca.test.tsx` (si afirma clases de las tablas de la ruta)
- `tests/unit/paridad/usuarios-paridad.test.tsx`
- `tests/unit/paridad/__snapshots__/usuarios-paridad.test.tsx.snap`
- `tests/unit/paridad/grupos-paridad.test.tsx`
- `tests/unit/paridad/__snapshots__/grupos-paridad.test.tsx.snap`
- `tests/unit/paridad/presentaciones-paridad.test.tsx`
- `tests/unit/paridad/__snapshots__/presentaciones-paridad.test.tsx.snap`
- `tests/unit/paridad/unidades-paridad.test.tsx`
- `tests/unit/paridad/__snapshots__/unidades-paridad.test.tsx.snap`
- `tests/unit/paridad/acciones-por-fila.test.tsx`
- `tests/unit/paridad/__snapshots__/acciones-por-fila.test.tsx.snap`
- `tests/unit/paridad/formularios-paridad.test.tsx`
- `tests/unit/paridad/__snapshots__/formularios-paridad.test.tsx.snap`
- `tests/unit/paridad/confirmaciones-paridad.test.tsx`
- `tests/unit/paridad/__snapshots__/confirmaciones-paridad.test.tsx.snap`
- `tests/unit/paridad/campos-paridad.test.tsx`
- `tests/unit/paridad/__snapshots__/campos-paridad.test.tsx.snap`
- `tests/unit/paridad/error-alert-paridad.test.tsx`
- `tests/unit/paridad/__snapshots__/error-alert-paridad.test.tsx.snap`
- `tests/guards/guard-configuracion-rediseno.test.ts`
- `tests/guards/guard-catalogo-de-componentes.test.ts`
- `tests/guards/guard-identificador-de-request.test.ts`
- `tests/unit/shared/data-table-alcance.test.ts` (lista cerrada de E2E que nombran `data-table`; alta de QC-267)

E2E:

- `e2e/configuracion-rediseno.spec.ts`
- `e2e/usuarios.spec.ts`
- `e2e/grupos-de-trabajo.spec.ts`
- `e2e/cierre-de-sesiones.spec.ts`
- `e2e/presentaciones.spec.ts`
- `e2e/producto-terminado.spec.ts`
- `e2e/unidades.spec.ts`
- `e2e/piezas-compartidas.spec.ts`
- `e2e/integraciones.spec.ts`
- `e2e/login.spec.ts`
- `e2e/aislamiento-inventario.spec.ts`

Estado:

- `progress/impl_QC-267.md`
- `progress/deudas.md`
- `progress/features/QC-267.md`
