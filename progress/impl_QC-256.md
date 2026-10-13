# QC-256 — bitácora de implementación

## Tanda 1 — T1 (tokens) y T2 (Button) · frontend_dev

### Archivos
- `app/globals.css`: tokens `--status-neutral-*`, `--status-progress-*`, `--{success,warning,destructive,info}-border`, `--avatar-1…6` y `-text` en `:root` y `.dark`, con su `--color-*` en `@theme inline`; `@keyframes status-pulse`.
- `components/ui/button.tsx`: `default` h-9 px-3.5, `sm` h-8 px-3 text-[13px], `icon` size-9, `icon-sm` size-8, `xl` nueva, `touch: 'mobile'` (`max-md:min-h-11`).
- `components/shared/CATALOGO.md`: fila `Button` (tallas, `touch="mobile"`, `Diseño` `Botones.dc.html`).
- `tests/unit/shared-ui/tokens-rediseno.test.ts` (nuevo), `tests/unit/shared-ui/button-tallas.test.tsx` (nuevo).
- `tests/unit/shared-ui/button-touch.test.tsx` y `tests/unit/login-skin.test.tsx`: enmienda (h-8→h-9, size-8→size-9).

### R → test
| R | Test |
| --- | --- |
| R1, R2, R4, R5 | `tests/unit/shared-ui/button-tallas.test.tsx` |
| R3 | `button-tallas.test.tsx` y `button-touch.test.tsx` |
| R6, R15, R41 (tokens) | `tests/unit/shared-ui/tokens-rediseno.test.ts` |

### Salida de los comandos
- `tsc --noEmit`: exit 0 (antes hubo que correr `next typegen`: el worktree no tenía `.next/types`).
- `eslint`: 0 errores, 7 avisos previos ajenos.
- `vitest run` de los 4 tests de T1/T2: 4 archivos, 113 tests en verde.
- `vitest run guard`: 71 archivos, 977 en verde, 18 omitidos.
- `vitest related --run` de los archivos tocados: 283 archivos; 17 en rojo, todos de `tests/unit/paridad/`, 228 snapshots que no coinciden. La diferencia es solo la clase de talla del botón (h-8→h-9, px-2.5→px-3.5, size-8→size-9, h-7→h-8).

### Snapshots de paridad (resuelto, decisión del leader 2026-10-10)
- El cambio de talla lo aprobó el humano (D7). Los 17 `tests/unit/paridad/__snapshots__/*.snap` se
  regeneran con `vitest -u` (21 archivos, 376 tests en verde, 228 snapshots actualizados) en un
  commit propio, solo con los snapshots. Así se cumple la regla de `login-paridad` («el cambio de
  talla se aplica sobre el snapshot en su propio commit»), aunque con `-u` y no a mano, y con el
  control que sigue.
- Control: un script sobre `git diff -U0` compara cada línea quitada con la añadida. Fuera de
  `class` deben ser iguales, y dentro de `class` solo valen los cambios de § 2: `default`
  h-8 px-2.5→h-9 px-3.5; `sm` h-7 px-2.5 text-[0.8rem]→h-8 px-3 text-[13px]; `icon` size-8→size-9;
  `icon-sm` size-7→size-8. Resultado: 721 líneas correctas y 0 fuera del mapa.
- Enmienda a QC-231, QC-232 y QC-233 (las fichas que crearon esos snapshots) añadida en `design.md > 10`.

### Notas (desviaciones aceptadas por el leader)
- En `qc.css`, `--d-b` se declara dos veces en el tema claro (borde `oklch(0.86 0.06 27)` y, más abajo, la duración `200ms`). Se usa el color de design.md; el test toma la primera declaración. Aceptado.
- `gap-2` en `xl` (el `gap` de 8 px de `.b` en `qc.css`), que design.md no menciona. Aceptado.

## Tanda 2 · T3, T4, T5 (frontend_dev)

### Archivos
- Nuevos: `components/shared/status-badge.tsx`, `components/shared/order-status.ts`,
  `components/shared/priority-mark.tsx`, `tests/unit/shared-ui/status-badge.test.tsx`,
  `tests/unit/shared-ui/order-status.test.ts`, `tests/unit/shared-ui/priority-mark.test.tsx`.
- Modificados: `app/(private)/pedidos/components/order-status-badge.tsx`,
  `app/(private)/asignacion/components/company-orders-columns.tsx`,
  `app/(private)/asignacion/components/assigned-orders-columns.tsx`,
  `app/(private)/dashboard/components/execution-trace-format.ts`, `components/shared/CATALOGO.md`
  (filas nuevas: mapa de pedido, `PriorityMark`, `StatusBadge`).

### R → test
| R | Test |
| --- | --- |
| R6–R9 | `tests/unit/shared-ui/status-badge.test.tsx` |
| R10, R11 | `tests/unit/shared-ui/order-status.test.ts` |
| R12–R14 | `tests/unit/shared-ui/priority-mark.test.tsx` |
| R47 | `tests/unit/marca/badges-estado.test.tsx` (sin tocar, en verde dentro de `vitest related`) |

### Salida de los comandos
- `pnpm run typecheck`: exit 0.
- `pnpm run lint`: 0 errores, 7 avisos previos ajenos (exit 0).
- `vitest run` de los 3 tests nuevos: 3 archivos, 30 tests en verde.
- `vitest related --run` de los archivos de T3/T4: 91 archivos, 1523 en verde, 17 en rojo, todos
  snapshots de `tests/unit/paridad/` por cambios de T10 (no de T3/T4): 16 en
  `buscadores-paridad` (`animate-spin` → `animate-[spin_0.9s_linear_infinite]` en `Spinner`) y 1 en
  `asignacion-paridad` («mis asignados, con filas»: `AvatarFallback` gana las clases
  `group-data-[tone=N]/avatar:*`). No se actualizaron.
- `vitest run guard`: 71 archivos, 977 en verde, 18 omitidos.

### T5: BLOQUEO
- `pnpm exec shadcn add alert` añadió la dependencia `cn@^0.4.0` a `package.json` y
  `pnpm-lock.yaml`, y el `components/ui/alert.tsx` generado importaba `cn` de `"cn"` en vez de
  `@/lib/utils` (alias de `components.json` mal resuelto por la CLI). Revertidos `package.json` y
  `pnpm-lock.yaml` con `git restore` y borrado `alert.tsx`. `node_modules/cn` quedó instalado
  (enlace de pnpm); no está en `package.json`. `Notice`, su test y las filas `Alert`/`Notice`, sin
  hacer.

### Veredicto
T3 y T4 hechos y en verde; T5 bloqueado por la CLI de shadcn (pide decisión del leader).

## Tanda 2 · T6, T7, T8 (frontend_dev)

### Archivos
- Nuevos: `components/shared/password-field.tsx`, `components/shared/page-shell.tsx`,
  `components/shared/page-header.tsx`, `components/shared/url-tabs.tsx`,
  `tests/unit/shared-ui/password-field.test.tsx`, `tests/unit/shared-ui/password-field-requisitos.test.tsx`
  (migrado de `tests/unit/credential-field.test.tsx`), `tests/unit/shared-ui/page-header.test.tsx`,
  `tests/unit/shared-ui/url-tabs.test.tsx`.
- Modificados: `components/shared/credential-requirements.tsx` (estilo de regla cumplida),
  `components/ui/tabs.tsx` (`TabsIndicator`), `tests/unit/credential-help-contract.test.ts`
  (`password-field.tsx` sustituye a `credential-field.tsx` en `NEW_FILES`),
  `components/shared/CATALOGO.md` (filas `Tabs`, `CredentialRequirements`, `TextField` [solo la
  referencia «ver `PasswordField`»], nuevas `PageHeader`, `PageShell`, `PasswordField`, `UrlTabs`;
  borrada `CredentialField`).
- Borrados: `components/shared/credential-field.tsx`, `tests/unit/credential-field.test.tsx`.
- Fuera de «Archivos esperados», obligados por el borrado: `tests/guards/guard-catalogo-de-componentes.test.ts`
  (quita `credential-field.tsx` de `PIEZAS_PREVIAS_AL_REDISENO`, lo exige la regla `previa-muerta`) y
  `app/(public)/establecer-contrasena/[token]/components/credential-input.tsx` (solo el comentario que
  nombraba el componente borrado, para que el Grep de «Hecho» de T6 quede vacío).
- Verificado en `node_modules/@base-ui/react` 1.7.0: `Tabs.Indicator` publica `--active-tab-left`,
  `-right`, `-top`, `-bottom`, `-width` y `-height`, relativas a la lista.

### R → test
| R | Test |
| --- | --- |
| R19–R24, R26 | `tests/unit/shared-ui/password-field.test.tsx` |
| R25 | `tests/unit/shared-ui/password-field-requisitos.test.tsx` |
| R27–R30 | `tests/unit/shared-ui/page-header.test.tsx` |
| R31 | `tests/unit/shared-ui/url-tabs.test.tsx` |

### Salida de los comandos
- `pnpm run typecheck`: exit 0.
- `pnpm run lint`: 0 errores, 7 avisos previos ajenos.
- Tests propios + `credential-requirements` + `credential-help-contract`: 6 archivos en verde.
- `vitest related --run` de los archivos de T6–T8: 118 archivos, 1914 en verde, 2 en rojo, ambos
  snapshots de T10 (`AvatarFallback` gana `group-data-[tone=N]/avatar:*`):
  `asignacion-paridad` «R1 — mis asignados, con filas» y `grupos-paridad` «R1 R16-R18 — con filas».
  No se actualizaron. Tres tests de `order-form`, `order-form-quote` y `campos-paridad` cayeron por
  tiempo con la máquina cargada; relanzados solos: 111 en verde.
- `vitest run guard`: 71 archivos, 977 en verde, 18 omitidos.

### Veredicto
T6, T7 y T8 hechos y en verde; solo quedan rojos dos snapshots de paridad ajenos (T10).

## Tanda 2 — cierre del implementer

### Snapshots de paridad de T10 (decisión del leader 2026-10-10)
- 18 snapshots regenerados con `vitest -u` (21 archivos, 376 tests en verde): `buscadores-paridad` (16),
  `asignacion-paridad` (1) y `grupos-paridad` (1). Van en un commit propio.
- Control con script sobre `git diff -U0`: fuera de `class` todo igual; dentro, solo
  `animate-spin`→`animate-[spin_0.9s_linear_infinite]` (Spinner, R43) o la adición de
  `group-data-[tone=1..6]/avatar:{bg-avatar-N,text-avatar-N-text}` en `AvatarFallback` (R41).
  Resultado: 18 líneas correctas, 0 fuera. Enmienda en `design.md > 10`.

### T5 y el CLI de shadcn (R48)
- `pnpm exec shadcn add alert` añadió `"cn": "^0.4.0"` a package.json y al lockfile, y generó
  `alert.tsx` con `import { cn } from "cn"`: resolvió mal el alias `utils: @/lib/utils` de
  components.json. Se descartó porque mete una dependencia nueva sin aprobar (regla 7, R48) y además
  es incorrecta. Se revirtió con `git restore` y se purgó node_modules con `pnpm install --frozen-lockfile`.
- Decisión del leader: `components/ui/alert.tsx` se escribe a mano a partir del fuente de shadcn para
  Base UI, con `import { cn } from "@/lib/utils"`, sin volver a ejecutar el CLI.

### Desviaciones aceptadas por el leader (tanda 2)
- `credential-field.tsx` sale de `PIEZAS_PREVIAS_AL_REDISENO` (guard-catalogo, regla `previa-muerta`).
- Comentario de `credential-input.tsx` reescrito para que no nombre `CredentialField`.
- `StatusBadge` con `border-0 py-0` y `data-tone`; `ArrowLink` saca sus tipos con `VariantProps`.

## Ajuste T3/T4 — piezas compartidas sin dominio (opción 2)

- Creados: `lib/shared/ui/status-tone.ts`, `lib/shared/ui/order-status.ts`. Borrado: `components/shared/order-status.ts`.
- Modificados: `components/shared/status-badge.tsx` (reexporta `StatusTone`/`STATUS_TONES`; props `tone` + `label` + `children?`, que mandan sobre `label`), `components/shared/priority-mark.tsx` (props `level: PriorityLevel` 1–4 + `label`; `data-level` en vez de `data-priority`), las 4 rutas (importan de `@/lib/shared/ui/order-status`), `components/shared/CATALOGO.md` (fila del mapa movida a Apoyos, fila nueva `STATUS_TONES` de `status-tone.ts`), tests `status-badge`, `priority-mark`, `order-status`.
- R6 → status-badge.test (reexport de la lista); R7 → status-badge.test (children mandan sobre label); R10 → order-status.test (`ORDER_PRIORITY_LEVELS`; `expectTypeOf` en los dos sentidos contra `OrderStatus`/`OrderPriority`/`OrderCoverage`; `tsc` incluye `tests/`); R12–R14 → priority-mark.test por nivel.
- Salida: typecheck limpio; lint 0 errores (7 avisos previos en tests ajenos); `vitest related` 91 archivos / 1544 tests verdes; `vitest run guard` 71 / 977 (+18 skipped) verdes; `scope.test` + `module-contract.test` 2 / 19 verdes.
- Veredicto: piezas compartidas sin imports de `lib/modules/*`; todo en verde.

## T5 — Alert y Notice (R15–R18, R48)
- Creados: `components/ui/alert.tsx` (fuente de shadcn base-nova copiado a mano desde el registro, sin CLI; solo cambia el import a `@/lib/utils`; variantes `default`/`destructive` intactas), `components/shared/notice.tsx`, `tests/unit/shared-ui/notice.test.tsx`. Modificado: `components/shared/CATALOGO.md` (filas `Alert` en Primitivos, tras `AlertDialog` por orden de archivo, y `Notice` en Compuestos; Diseño `Avisos.dc.html`).
- R15 → notice.test (tokens bg/text/border por tono; el fuente sin `#hex`, `oklch(`, `rgb(`, `hsl(`); R16 → notice.test (icono distinto por tono con `aria-hidden`; título `font-semibold` opcional); R17 → notice.test (`alert` en danger, `status` en los otros tres); R18 → notice.test (clases de entrada y `--dur-slow: 300ms`); R48 → `git diff --stat -- package.json pnpm-lock.yaml` vacío.
- Salida: typecheck limpio; lint 0 errores (7 avisos previos ajenos); `vitest related` 1 archivo / 13 tests verdes; `vitest run guard` 71 / 977 (+18 skipped) verdes.
- Veredicto: Alert y Notice listos, sin dependencias nuevas; todo en verde.
- Corrección de T5 (regla 1 de frontend_dev; alternativa descartada A5 de design.md § 12): la primera versión de `Notice` era un `div` propio que no usaba `Alert`. Se rehízo para que **componga** `Alert`, `AlertTitle` y `AlertDescription` de `components/ui/alert.tsx`, sin tocar `alert.tsx`. El layout del tablero (flex, gap 12 px, padding 12/14 px, radio 10 px) sustituye al grid base por `className` vía tailwind-merge (más `has-[>svg]:gap-x-3` y `*:[svg]:translate-y-0` para anular las reglas del icono del base); los tonos sustituyen `bg-card`/`text-card-foreground`; la descripción toma `text-current` en vez de `text-muted-foreground`. `role` se sobrescribe por props (`{...props}` va después del `role="alert"` fijo en `alert.tsx`): `alert` en danger, `status` en el resto (R17). Test: el slot del título pasa de `notice-title` a `alert-title`, y un test nuevo comprueba que la raíz es `data-slot="alert"` con el layout del tablero y sin `grid`/`bg-card`. CATALOGO: `Base de` de `Notice` = `Alert`, `AlertTitle`, `AlertDescription`.
  - Salida: typecheck limpio; lint 0 errores (7 avisos previos ajenos); `vitest related` 1 archivo / 14 tests verdes; `vitest run guard` 71 archivos / 977 (+18 skipped) verdes.

## T9 — RowActionsMenu y DataTable (R32–R39)
- Modificados: `components/shared/row-actions-menu.tsx` (`presentation`, `title`, `texts`; desplegable con `side="bottom"`; centrado = botón `outline` «Acciones» de 44 px + `Dialog` sin su X inglesa, botón «Cerrar» propio e ítems `min-h-12`), `components/shared/data-table/actions-column.tsx` (`cell` o `menu`; reexporta `RowActionsSpec`), `data-table-types.ts` (`RowActionsSpec`, `DataTableColumn.menu?`, `DataTableCardLayout`, `DataTableProps.card?`, `texts.cardActions?`/`closeMenu?`), `data-table.tsx` (con `card`: `@container`, tabla `@max-[760px]:hidden` y tarjetas `hidden @max-[760px]:flex`, solo en estado con filas; sin `card`, nada cambia), `index.ts` (tipos `RowActionsSpec`, `DataTableCardLayout`), `CATALOGO.md` (filas `DataTable` y `RowActionsMenu`, Diseño `Tabla.dc.html`), `tests/guards/guard-identificador-de-request.test.ts` (alta de `piezas-compartidas.spec.ts` en la lista cerrada de E2E; sin ella la guardia se pone roja).
- Creados: `components/shared/data-table/data-table-cards.tsx` (interno, no sale del barrel), `tests/unit/shared-ui/row-actions-menu-centrado.test.tsx`, `data-table-acciones.test.tsx`, `data-table-tarjetas.test.tsx`, `e2e/piezas-compartidas.spec.ts`.
- Volteo (verificado en `node_modules/@base-ui/react` 1.7.0): la prop es `collisionAvoidance` del `Menu.Positioner`; su defecto para un menú desplegable es `DROPDOWN_COLLISION_AVOIDANCE = { fallbackAxisSide: 'none' }` y `useAnchorPositioning` toma `side: 'flip'` y `align: 'flip'` cuando faltan. O sea, el volteo vertical ya viene por defecto: no hace falta pasar la prop ni tocar `components/ui/dropdown-menu.tsx`.
- R32 → data-table-acciones (6 casos); R33 → row-actions-menu-centrado (`data-side="bottom"`) + E2E `piezas-compartidas.spec.ts`; R34 → data-table-tarjetas (clases de contenedor, una tarjeta por fila, huecos y orden, columnas no nombradas fuera); R35 → row-actions-menu-centrado + data-table-tarjetas; R36, R37 → row-actions-menu-centrado (título, Cerrar, ítems 48 px, enlace, elegir cierra, Cerrar/Escape/velo cierran sin ejecutar y el foco vuelve) + data-table-tarjetas; R38 → data-table-tarjetas (sin `card`) y los tests de tablas existentes sin tocar; R39 → data-table-tarjetas (barras una sola vez fuera de los cuerpos; carga, error, vacío y `states` sin tarjetas).
- Salida: typecheck limpio; lint 0 errores (7 avisos previos ajenos); los 3 tests nuevos 31/31 verdes y `row-actions-menu-href` 6/6; `vitest related` sobre los archivos tocados 224 archivos / 3590 tests verdes (+1 skipped), paridad incluida; `vitest run guard` 71 / 977 (+18 skipped) verdes.
- E2E: BLOQUEO. `pnpm exec playwright test e2e/piezas-compartidas.spec.ts` → `PrismaClientInitializationError: Environment variable not found: DATABASE_URL` en el `beforeAll`: el worktree no tiene `.env` y ni `docs/verification.md` ni `docs/worktrees.md` dicen cómo se monta el entorno de un worktree. Spec escrito, sin correr en verde.
- Veredicto: T9a y T9b hechas y en verde; T9c escrita y bloqueada por el entorno.

## Tanda 4 — snapshots de paridad de la barra en chips (decisión del leader 2026-10-10)
- `vitest -u` sobre `tests/unit/paridad/`: 21 archivos y 376 tests en verde, 27 snapshots actualizados en 12 archivos.
- Control mecánico: en cada entrada, antes y después, se quita el subárbol con raíz en
  `data-testid="data-table-filters"`, `data-table-chips` o `data-table-filter-*`, y el resto debe
  ser idéntico. Resultado: 27 de 27 entradas iguales fuera de la barra. Una sola entrada
  (`campos-paridad`, «F2 filtro de fecha de la tabla: cerrado») renderiza el `DataTableFilterDate`
  suelto: su raíz es el propio disparador del filtro, que en la app vive dentro de la barra.
- Revisión manual (antes → después):
  - Select, `usuarios-paridad` «personas con filas»: el botón «Estado» con su X «Limpiar filtro»
    siempre visible → el chip «Estado» con icono + y `span` de etiqueta, dentro de
    `data-table-chips`, sin X (el filtro está inactivo). El buscador no cambia.
  - Fecha, `pedidos-paridad` «con filas»: Estado, Prioridad y «Fecha de solicitud» tenían cada uno
    su X → tres chips sin X en `data-table-chips`. El chip de fecha conserva `aria-haspopup="dialog"`
    y su testid. `data-table-toolbar-actions` (filtro de cliente) pasa a ser hermano del buscador
    dentro de la barra, con su contenido intacto.
  - Rango numérico, `inventario-paridad` «productos con filas»: «Existencia» y «Alerta de cantidad»
    eran una etiqueta, dos `spinbutton` mín/máx y una X → un chip por filtro
    (`data-table-filter-chip-stock`, `-qtyAlert`, `aria-haspopup="dialog"`); los campos salen de la
    barra y se abren desde el chip.
- Desviaciones de T9d aceptadas por el leader: `trigger` opcional en `DatePicker` (regla 2,
  extender) y `campos.test.tsx`. Ajustes de la tanda 3 anotados en tasks.md: alta del E2E en
  `guard-identificador-de-request`, y el volteo, que Base UI 1.7.0 ya trae por defecto.

## Cierre (T11, T12) — implementer

### Integración
`origin/dev` (QC-257, #207) integrado en 1e69acf3. Conflicto trivial en
`tests/guards/guard-identificador-de-request.test.ts`: se conservan las dos altas
(`piezas-compartidas.spec.ts` y `shell-rediseno.spec.ts`). `CATALOGO.md` se mezcló solo; la fila
`SidebarProvider…` de QC-257 sigue presente. Sin migraciones.

### Mapa R → test (design.md § 14, con D17)
| R | Test |
| --- | --- |
| R1–R5 | `tests/unit/shared-ui/button-tallas.test.tsx` (+ `button-touch.test.tsx`, R3) |
| R6–R9 | `tests/unit/shared-ui/status-badge.test.tsx` |
| R10, R11 | `tests/unit/shared-ui/order-status.test.ts` (mapa en `lib/shared/ui/order-status.ts`, `expectTypeOf` en los dos sentidos) |
| R12–R14 | `tests/unit/shared-ui/priority-mark.test.tsx` (`level` 1–4 + `label`) |
| R15–R18 | `tests/unit/shared-ui/notice.test.tsx` |
| R19–R24, R26 | `tests/unit/shared-ui/password-field.test.tsx` |
| R25 | `tests/unit/shared-ui/password-field-requisitos.test.tsx` |
| R27–R30 | `tests/unit/shared-ui/page-header.test.tsx` |
| R31 | `tests/unit/shared-ui/url-tabs.test.tsx` |
| R32, R38 | `tests/unit/shared-ui/data-table-acciones.test.tsx` |
| R33 | `e2e/piezas-compartidas.spec.ts` (**escrito, SIN CORRER**; ver abajo) |
| R34, R35, R39 | `tests/unit/shared-ui/data-table-tarjetas.test.tsx` |
| R36, R37 | `tests/unit/shared-ui/row-actions-menu-centrado.test.tsx` |
| R40, R41 | `tests/unit/shared-ui/avatar-tone.test.ts` (+ `tokens-rediseno.test.ts`) |
| R42 | `tests/unit/shared-ui/responsible-avatars.test.tsx` |
| R43, R44 | `tests/unit/shared-ui/spinner.test.tsx` |
| R6, R15, R41 (tokens) | `tests/unit/shared-ui/tokens-rediseno.test.ts` |
| R45, R46 | `tests/guards/guard-catalogo-de-componentes.test.ts` y `tests/unit/shared-ui/catalogo-qc256.test.ts` |
| R47 | `tests/unit/marca/badges-estado.test.tsx` (sin cambios) |
| R48 | `tests/guards/guard-dependencias-aprobadas.test.ts` |
| R49–R51 | `tests/unit/shared-ui/arrow-link.test.tsx` |
| R52–R55, R57, R58 | `tests/unit/shared/data-table-filters.test.tsx` y `tests/unit/shared-ui/data-table-filter-chip.test.ts` |
| R56 | `tests/unit/shared/data-table-filters.test.tsx` y `tests/unit/shared/data-table-params.test.ts` |

Salida real (`pnpm exec vitest run` de los 25 archivos de la tabla, 2026-10-10):
```
 Test Files  25 passed (25)
      Tests  371 passed (371)
```

### Enmiendas a specs cerrados (design.md § 10)
- QC-21: `CredentialField` desaparece y pasa a `PasswordField`; sale de `PIEZAS_PREVIAS_AL_REDISENO`.
- QC-30: `login-skin` pasa de `h-8` a `h-9`.
- QC-55: barra de filtros en chips. Los filtros `text`/`numberRange` se abren desde su chip, la X
  solo aparece con el filtro activo y nace «Limpiar filtros». Un `numberRange` vacío ya no emite
  `{min:null,max:null}`, sino que quita la clave (R53).
- QC-232: `RowActionsMenu` y `actionsColumn` ganan props opcionales.
- QC-231/232/233: snapshots de paridad regenerados en tres commits propios con control (Button D7,
  Spinner/Avatar R41/R43, barra en chips D14).
- QC-33/34/35: no se enmiendan. Ante su choque, el humano eligió la opción 2 (D17): las piezas
  compartidas no conocen el dominio.

### Avisos para las fichas de módulo
- **DOM doble de las tarjetas:** con `card`, `DataTable` pinta la tabla y las tarjetas a la vez y
  las alterna por `@container` (≤ 760 px). Los tests de pantalla que busquen por texto o testid
  dentro de una tabla con `card` encontrarán dos coincidencias: deben acotar al cuerpo visible.
  Sin `card` no cambia nada (R38).
- **Filtros que se abren desde su chip:** los filtros `text` y `numberRange` ya no están en la
  barra. Un test o E2E que escriba en ellos tiene que abrir antes el chip
  (`data-table-filter-chip-<columna>`). La X de cada filtro solo existe con el filtro activo.

### E2E de R33 (autorizado por el leader 2026-10-10)
- Marcador comprobado antes de correr: empresa, unidades y usuario llevan `qc256_e2e_` + RUN_ID. El
  afterAll borra por los nombres exactos de la ejecución y el barrido de huérfanos solo toca
  `qc256_e2e_*` con más de 1 h de antigüedad.
- El `.env` del principal se copió al worktree para cada ejecución, se exportó al proceso
  (`set -a; . ./.env`, como hace el CI con `$GITHUB_ENV`) y se borró al terminar. No se commiteó.
- Dos ajustes del montaje del spec. Primero: `UNIT_COUNT` pasa de 4 a 15 para que la lista desborde
  los 420 px. Segundo: la paginación `sticky` tapaba el último ⋯ y `locator.click()` bajaba la
  página antes de pulsar (scrollY 736→848), así que el menú cabía debajo y salía `bottom`. Ahora el
  test asoma el disparador sobre la paginación, comprueba con `elementFromPoint` que el punto de clic
  es suyo y pulsa con `page.mouse.click`. Además afirma que abrir no mueve el disparador (< 4 px).
  Las aserciones de R33 no cambian.
- Base UI 1.7.0 voltea por defecto (`side: 'flip'`); no se tocó `row-actions-menu.tsx`.
- Salida real (`pnpm exec playwright test e2e/piezas-compartidas.spec.ts --project=chromium --project=webkit`):
```
[1/2] [chromium] › e2e\piezas-compartidas.spec.ts:123:7 › menú de fila › R33: ... queda entero dentro de la ventana
[2/2] [webkit] › e2e\piezas-compartidas.spec.ts:123:7 › menú de fila › R33: ... queda entero dentro de la ventana
  2 passed (8.7s)
```
- Después de la ejecución, la base tiene 0 unidades, 0 usuarios y 0 empresas con prefijo `qc256_e2e_`.
