# QC-262 — review

Revisión del 2026-10-13 sobre `origin/dev...HEAD` (rama `feature/QC-262-rediseno-pedidos`, c628ed65).
Lo que leí: spec (requirements, design, tasks), `progress/impl_QC-262.md`, `progress/features/QC-262.md > Decisiones`,
`docs/perfil-agentes.md`, `CHECKPOINTS.md` y `docs/checkpoints-proyecto.md`.
`./init.sh --completo` no lo repetí: lo corre el leader en paralelo.

## Verificación ejecutada (por mí)

- `pnpm run typecheck`: exit 0.
- `pnpm run lint`: 0 errores. Los 7 avisos son ajenos (`order-service.test.ts`, `confirm-catalog-import.test.ts`).
- `pnpm exec vitest run guard`: 76 archivos, 1052 pasan, 20 omitidos, 0 fallan.
- `pnpm exec vitest run` sobre `tests/unit/pedidos-ui`, `tests/unit/paridad`, `tests/unit/marca`, `tests/unit/shared-ui`,
  `data-table-alcance`, `pedidos/scope` y `clientes/scope`: 130 archivos, 2135 pasan, 5 omitidos, 0 fallan.
- Grep de citas en las líneas añadidas de producción (`QC-<n>`, `R<n>`, `design.md`, «decisión cerrada», `T<n>`): ninguna.
- E2E: no los corrí. Me baso en la tabla de salida de la bitácora (T6: el spec nuevo pasa en Chromium y WebKit; los 17 de
  pedidos más anular-entrega y detalle-de-producto-terminado, en Chromium). Los E2E corren en el PR a producción.

## Checklist

### CHECKPOINTS.md
- [x] `requirements.md` con R1–R24 en EARS.
- [x] `design.md` con alternativas descartadas (A1–A6) y su porqué.
- [x] `tasks.md`: todas las tasks `[x]` (T0a–T6c).
- [x] `design.md` abre con `## Lo que ya existe`, que está completa. El diff no re-crea nada de esa lista: no hay componente
  nuevo; `OrderRowSheetActions` cambia de contrato, sin pieza nueva.
- [x] Assignee y rama (Carlos Restrepo, `progress/features/QC-262.md`).
- [x] Cada R<n> tiene un test concreto (tabla de abajo). El mapa R → test está en `impl_QC-262.md`.
- [x] Typecheck y lint sin errores.
- [ ] `gate-completo` en CI: pendiente (PR). El leader corre `--completo`.
- [x] Flujo crítico: no se toca ninguno (sin auth, permisos de dominio, inventario, importes ni webhooks). R23 se cubre
  con los E2E de hoy.
- [x] Sin dependencias nuevas (no toca `package.json`).
- [x] Sin secretos ni configuración hardcodeada.
- [ ] Cierre, `progress/features/QC-262.md > Cierre` y desmontar el worktree: son del leader, después de esta review.

### docs/checkpoints-proyecto.md
- [x] Typecheck y lint.
- [x] Los E2E son de Playwright.
- [x] Multiplataforma:
  - el disparador «Acciones» y el de fila miden 44 px;
  - los ítems del diálogo centrado, 48 px;
  - los botones de los diálogos, 44 px (medido en el E2E a 390 px);
  - sin `100vh` ni `:hover` como única vía, y sin inputs nuevos.
  - La X de 32 px queda fuera por decisión del leader (D55).
- [x] Catálogo: la fila `RowActionsMenu` lleva `separatorBefore` en «Cubre» y en «Puntos de extensión», y `Separator` en
  «Base de». Está en el mismo commit que la pieza (a6a224e5). `Diseño` sigue en `Tabla.dc.html`.
- [x] Pase de diseño: los tableros que cita `design.md` existen en `docs/diseno/canvas/` (`Pedidos`, `PedidosTablet`,
  `PedidosMovil`, `ModalesPedidos`, `Tabla`, `Estados`, `Superficies`, `Avisos`).
- [x] Datos y seguridad, módulos hexagonales: no aplica. Sin cambios en `lib/`, `db/` ni Server Actions.
- [x] Permisos: `page.tsx` conserva `requirePagePermission`. Los permisos de la fila siguen llegando del servidor por props.

### Puntos 5–11 de `docs/perfil-agentes.md > reviewer`
- [x] 5 Calidad y seguridad: sin hallazgos.
- [x] 6 Multiplataforma: ver arriba.
- [x] 7 Dependencias: ninguna nueva.
- [x] 8 Aislamiento: no aplica.
- [x] 9 Comentarios: ninguna cita en las líneas añadidas o modificadas. Las citas que el diff tocaba (QC-170, T10–T12,
  `design.md > 6.1`, QC-102 R24) se limpiaron.
- [x] 10 Duplicados: no hay componente nuevo. `separatorBefore` es el paso 2 (extender), declarado en `design.md`.
- [x] 11 Diseño: cambio visual de `RowActionsMenu`, con su tablero en `design.md` y en la fila del catálogo.

## Trazabilidad R → test (verificada leyendo los casos)

| R | Test |
| --- | --- |
| R1 | `pedidos-page-header.test.tsx`: 3 casos (PageShell > PageHeader, h1 único, «Nuevo pedido» de 44 px que abre el alta) |
| R2 | `order-table.test.tsx`, los dos «R2» (orden de la barra, nada fuera); E2E a 1440 |
| R3 | `order-customer-filter.test.tsx`, «R3» (`w-64 max-w-full`); E2E a 390 (sin desbordar, debajo del buscador) |
| R4 | `order-customer-filter.test.tsx`, «R4», más los casos R34, R15 y R17 de hoy en `order-table.test.tsx` |
| R5–R7 | `order-status-badges.test.tsx` (`it.each` por estado, prioridad y cobertura; Crítica = icono); `badges-estado.test.tsx` enmendado; `order-sheet-coverage.test.tsx` (panel) |
| R8 | `guard-pedidos-rediseno.test.ts`: tiene un caso que demuestra que muerde, más el barrido con un mínimo de archivos |
| R9 | `recipe-version-select.test.tsx`, dos casos «R9» (`waiting` / `muted`, el valor enviado no cambia) |
| R10 | `order-row-actions.test.tsx`, bloque «R10»; `order-columns.test.tsx`, tres casos «R10»; el tamaño de 44 px, en el caso de hoy |
| R11 | `order-row-actions.test.tsx`, bloque «R11»: orden, separador solo en Cancelar, destructivos y testids. También el E2E a 1440 |
| R12 | `order-row-actions.test.tsx`, «R12»: tabla escrita a mano (`esperado`), 10 estados × 8 permisos |
| R13 | `order-row-wiring.test.tsx`, bloques «R13» (8 casos); `order-table.test.tsx`, «R13» |
| R14 | `row-actions-menu-separator.test.tsx`: 6 casos (dropdown y centered × con prop, primer ítem, sin prop); E2E |
| R15 | `order-cards.test.tsx`, 9 casos «R15»; E2E a 820 y a 390 |
| R16 | E2E a 1440 (doce cabeceras en orden, `data-pinned`, `overflow-x` dentro y documento sin desbordar); `pedidos-viewport.test.tsx` (desbordamiento dentro de la tabla) |
| R17 | `order-cards.test.tsx`, 3 casos «R17». El aviso en vuelo y el error están en `order-table.test.tsx` y `order-list-section.test.tsx`, que en jsdom montan tabla y tarjetas |
| R18 | E2E a 390, dos casos (cuatro diálogos, más «Material insuficiente» con recuento de la base) |
| R19 | `order-form.test.tsx` y `order-sheet.test.tsx` (clases de ancho); E2E a 390 (390 × 844, pie en 828) |
| R20 | Un caso «R20» en cada diálogo o panel: cancel, delete, blocked, customer, distribution, delivery, y el alta y la edición en `order-form` |
| R21 | `pedidos-toasts.test.tsx`: 13 éxitos y 13 errores, con las Server Actions como dobles y `sonner` simulado |
| R22 | `order-columns.test.tsx` (casos de hoy); snapshot `pedidos-paridad` |
| R23 | Los E2E de hoy (bitácora T6); los tests de componentes de cada diálogo siguen en verde |
| R24 | `guard-catalogo-de-componentes`, `catalogo-qc256` (en verde) |

## Puntos que pidió mirar el leader

- **Snapshot `pedidos-paridad`.** Repasé todas las líneas +/−. Solo cambia lo que dice `design.md > 6`:
  - la cabecera, que pasa de `div`+`h1` a `PageShell`/`PageHeader`;
  - `order-status` y `order-priority` con `StatusBadge` y `PriorityMark`;
  - `ul data-table-cards` con una tarjeta por pedido, y `@container` / `@max-[760px]:hidden` en la caja;
  - el filtro de cliente pasa a `max-w-full w-64`.

  La columna de acciones no cambia en el árbol (mismo desplegable). Nada inesperado.
- **Duplicados tabla/tarjeta.**
  - Unitarios: los localizadores de página entera que marcó el censo (22 en 10 archivos) están acotados a
    `data-table-row-<id>`.
  - E2E: el grep de `order-row-actions`, `data-order-id` y `order-status` fuera del spec nuevo da solo usos acotados a la
    fila (`orderRow`, `rowA`, `ordersRow`, `listedRow`) o los dos helpers ya acotados.
  - `entregar-producto-terminado:622` sigue valiendo. Si la fila desaparece, la cuenta da 0; si siguiera, el disparador
    de la fila daría 1.
- **Piezas compartidas.**
  - `RowActionsMenu`: sin la prop el árbol es el de hoy (`Fragment` sin separador), y `row-actions-menu-centrado` y
    `-href` siguen en verde sin cambios.
  - El separador nunca va delante del primer ítem (`index > 0`).
  - Catálogo al día y en el mismo commit.
- **Accesibilidad.**
  - Tamaños de 44 y 48 px afirmados en unitarios y en el E2E.
  - El separador lleva `role="separator"` en las dos presentaciones.
  - El foco: ver m1.

## Hallazgos

Ninguno BLOQUEANTE.

- **m1 (menor). Foco al abrir desde la tarjeta.** Ningún test afirma a dónde va el foco cuando un ítem del diálogo
  centrado de la tarjeta abre un panel o un diálogo de pedido. En ese camino, `CenteredRowActions` hace
  `onSelect` + `setOpen(false)`, y su cierre devuelve el foco a «Acciones» mientras el anfitrión abre el panel o el
  diálogo nuevo. Si ese retorno llega después del foco inicial del modal nuevo, el foco queda fuera de él.
  - `order-cards.test.tsx` solo comprueba que se abre lo que toca.
  - `asignaciones-ui/order-cancel-dialog.test.tsx` sí tiene el patrón para el desplegable.
  - Sugerencia: un caso en `order-cards.test.tsx` que afirme que `document.activeElement` queda dentro del diálogo
    abierto. Si falla, el arreglo es de `RowActionsMenu` y sirve para todas las listas con tarjetas.
- **m2 (menor). Contrato que no está en la tabla.** `OrderColumnsDeps` pierde `canVoidDelivery`, que ya no usa ninguna
  columna. Es un cambio de contrato que `design.md > 5` no recoge. Typecheck en verde; solo es documentación.
- **m3 (menor, aceptado por el leader). `triggerDataAttributes` fuera del tipo compartido.** Viaja como subtipo
  (`OrderRowActionsSpec`) y llega a la tarjeta porque `actionsColumn` y `DataTableCards` propagan el objeto entero. Si
  alguno pasara a elegir campos, `data-order-id` se perdería sin error de tipos. Hoy lo protegen `order-cards` y el E2E a
  390. Conviene declararlo en `RowActionsSpec` en QC-263+, como dice la decisión.
- **m4 (menor, aceptado por el leader). Palabra larga en la tarjeta (D58).** A 390 px, una palabra larga sin espacios
  desborda el documento en la tarjeta. La pantalla de pedidos la estrena con esta ficha. Está anotada como deuda en la
  pieza compartida.
- **m5 (menor). Al cambiar de tipo de acción no hay animación de salida.** El anfitrión es un `switch` sobre `action`.
  Si se cierra un panel y enseguida se elige otro tipo de acción, lo montado se desmonta sin terminar su animación.
  No pasa nada funcional y el velo modal impide el caso con el panel abierto. Solo se anota.
- **m6 (menor). Comentario que repite el código.** En `row-actions-menu.tsx`, el comentario de `hasSeparatorBefore`
  repite lo que hace la función (punto 9, `menor`).

## Veredicto

**OK.** Ningún bloqueante. Los menores no impiden el merge. Queda pendiente `gate-completo`, en el `--completo` del
leader y en el CI del PR.
