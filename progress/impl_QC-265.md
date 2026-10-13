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
| 0 | (este) | init OK |
