# QC-265 — rediseno-operario · bitácora del implementer

Worktree `.worktrees/QC-265-rediseno-operario`, rama `feature/QC-265-rediseno-operario`.
Spec: `specs/QC-265-rediseno-operario/`. P1–P16 con la opción por defecto (F1.4).

**Nombre de la bitácora.** `tasks.md` la llamaba `progress/impl_QC-265-rediseno-operario.md`; el
leader pidió `progress/impl_QC-265.md` (la forma de QC-260 y QC-261). Se usa la del leader y se
corrige la línea de `tasks.md > ## Archivos esperados` en el commit de la tanda 0.

## Tanda 0 — Censo y comprobaciones

Gate de partida: `./init.sh` → `== init OK ==` (2 min 8 s) antes de tocar nada.

### T0a. Censo (grep en `tests/unit`, `tests/guards`, `tests/integration`, `e2e`)

Los archivos que el grep encuentra y **ya** están en `## Archivos esperados` se tocan en la tanda
que dice `design.md > 7`. La tabla recoge los que salen y **no** están en la lista:

| Archivo | Qué nombra | Qué le pasa |
| --- | --- | --- |
| `e2e/ejecucion-receta.spec.ts` | comentario «el `data-testid` que exporta `AssignedOrderDeliveredNotice`» + literal `assigned-order-delivered-notice` | Nada: el testid se conserva (D8) y no importa el componente. Se corre en T8 (R45). |
| `e2e/producto-terminado.spec.ts`, `e2e/reserva-de-material.spec.ts` | literal `assigned-order-delivered-notice` | Nada: testid conservado, sin `import`. |
| `e2e/envases-del-pedido.spec.ts`, `e2e/pedidos-cotizacion.spec.ts` | constante local `MISSING_VALUE_MARK = '—'` | Nada: es local, no del barrel de asignación. |
| `tests/unit/shared-ui/responsible-avatars.test.tsx`, `tests/unit/pedidos-ui/*`, `tests/guards/guard-pantalla-pedidos-se-amplia.test.ts` | `MISSING_VALUE_MARK` de `pedidos/components` | Nada: otro barrel (R43 es solo el de asignación). |
| `tests/unit/shared/data-table-alcance.test.ts` | comentario sobre `packing-order-link` | Nada en el comentario. Si el e2e nuevo referencia `data-table`, se da de alta en su lista cerrada (T8) y entonces se añade a la lista. |
| `tests/unit/shared-ui/url-tabs.test.tsx` | `'Terminados'` como dato de prueba | Nada (ya lo dice `design.md > 7`). |
| `e2e/marca-componentes.spec.ts`, `e2e/movimiento.spec.ts`, `tests/unit/sidebar-desktop.test.tsx`, `tests/unit/theme/sidebar-panel.test.tsx`, `tests/unit/shell/control-barra.test.tsx`, `tests/unit/theme/private-header.test.tsx` | `data-slot="sidebar"` / `private-header` | Nada: el layout y `sidebar.tsx` no cambian; la regla CSS solo actúa con `[data-operator-screen]` en la página. |
| `tests/unit/identity/*`, `tests/integration/identity/login.int.test.ts`, `tests/unit/pedidos/*`, `tests/unit/proveedores/*`, `tests/unit/paridad/__snapshots__/formularios-paridad.test.tsx.snap` | «esta dada de baja» de otros módulos | Nada: R39 solo cubre las tres constantes del operario. |
| `tests/guards/guard-despliegue-preview.test.ts`, `tests/unit/recetas/*`, `tests/unit/scripts/build.test.ts` | «ningun paso» de otros contextos | Nada (mismo motivo). |

Ningún archivo nuevo entra en `## Archivos esperados` por el censo.

### T0b. Selector de D2

`components/ui/sidebar.tsx:219-260`: en escritorio el envoltorio `div[data-slot="sidebar"]`
(`group peer hidden md:block`) contiene a `sidebar-gap` (el hueco) y a `sidebar-container`
(`fixed`). Ocultarlo con `display: none` quita el hueco y la barra fija, y `SidebarInset` (hermano
siguiente dentro de `sidebar-wrapper`) arranca en x = 0. En móvil la barra es un `Sheet` cerrado
(portal) que tampoco ocupa sitio. **Selector = el de `design.md > D2`**, sin desviación. La
comprobación en navegador la cubre el e2e de R1 (T8a: x de `private-content` = 0).

## Tandas

| Tanda | Commit | Gate |
| --- | --- | --- |
| 0 | `63f89d15` | init OK |
| 1 y 2 | ver `git log` (un commit por tanda) | init OK (un solo `./init.sh` tras las dos, corridas en paralelo) |

## Tanda 1 — Piezas compartidas (frontend_dev)

Archivos:
- creados `components/shared/countdown-ring.tsx`, `tests/unit/shared/countdown-ring.test.tsx`,
  `tests/unit/shared-ui/notice-dismiss.test.tsx`
- modificados `components/shared/step-reader/step-reader.tsx` (usa `CountdownRing` con
  `testId="step-reader-wait-ring"`; `WaitRing` borrado), `components/shared/countdown-gated-button.tsx`,
  `components/shared/notice.tsx` (`'use client'`, `dismissible?`),
  `tests/unit/shared/countdown-gated-button.test.tsx`, `components/shared/CATALOGO.md`
- snapshot `tests/unit/paridad/__snapshots__/asignacion-acondicionamiento-paridad.test.tsx.snap`:
  una línea, el `svg` del anillo en el diálogo de terminar (fila de `design.md > 6`, R37).
  `confirmaciones-paridad` no cambió.

Mapa R → test: R15 → `notice-dismiss.test.tsx` (3 casos) · R37 → `countdown-gated-button.test.tsx`
(3 casos `R37:`) · R38 → `countdown-ring.test.tsx` (6 casos) y `step-reader.test.tsx` · R44 →
`guard-catalogo-de-componentes`.

Verificación: typecheck OK; lint 0 errores (7 avisos ajenos); `vitest related` 912 pasan + el
snapshot de arriba actualizado (36/36); `vitest run guard` 74 archivos OK; `step-reader` +
`order-execution-screen` + `notice` OK.

Desvíos: (1) el anillo del botón no lleva `key` propia: `CountdownTimer` tampoco la lleva y la `key`
del botón reinicia los dos; (2) `size-5` en el anillo porque `Button` fuerza los `svg` a 16 px;
(3) catálogo: `StepReader` gana `CountdownRing` en `Base de` y `Notice` gana `Button`.

## Tanda 2 — Marco del operario (frontend_dev)

### T2a. `OperatorScreenFrame` y regla de CSS

Archivos:
- creado `app/(private)/asignacion/components/operator-screen-frame.tsx` (sin `'use client'`; fuera del barrel `index.ts`, D3)
- modificado `app/(private)/components/theme-toggle.tsx` (`className?` opcional vía `cn`; sin cambio de salida para los usos de hoy)
- modificado `app/globals.css` (regla `body:has([data-operator-screen])` sobre `[data-slot="sidebar"]` y `[data-testid="private-header"]`)
- creado `tests/unit/asignaciones-ui/operator-screen-frame.test.tsx`
- creado `tests/unit/theme/operator-chrome-css.test.ts`

Mapa R → test:
- R1 → `operator-chrome-css.test.ts` (dos casos R1) + `operator-screen-frame.test.tsx` «R1: la raíz lleva data-operator-screen…»
- R2 → `operator-screen-frame.test.tsx` «R2: la cabecera es pegajosa…», «R2, R3: … Cambiar tema …», «R2, R3: el pie es fijo…»
- R3 → `operator-screen-frame.test.tsx` «R3: con back pinta un ArrowLink…» y los dos «R2, R3»
- R4 → `operator-screen-frame.test.tsx` «R4: la raíz es contenedor de consultas» (las columnas las pinta cada pantalla en T4–T6)
- R6 → `operator-chrome-css.test.ts` «R6: la regla depende de la marca del operario»

Verificación:
- `pnpm run typecheck` → sin errores
- `pnpm run lint` → 0 errors, 7 warnings (preexistentes, en `confirm-catalog-import.test.ts` y `order-service.test.ts`)
- `pnpm exec vitest related --run <archivos>` → 22 files, 325 passed
- `pnpm exec vitest run guard` → 74 files, 1007 passed, 20 skipped

Desvíos: ninguno. El pie reserva 132 px + margen seguro (alto del pie del tablero). Ningún snapshot cambió.

Veredicto: T2a hecha, en verde; ninguna pantalla usa el marco todavía.
