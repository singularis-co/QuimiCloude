# review QT-314 — pedido-con-varias-recetas-frontend

## Vuelta 1 (revisión completa)

- **HEAD revisado:** `6a0889d79792a0ef3ac5b9852b4979d3387ac5a2`
- **Rango:** `origin/dev...HEAD`, con merge-base `1a830ee4e`. Son 164 archivos.
- **Spec:** R1–R52, T1–T20 y T16b, con la enmienda F2.1 del 2026-11-09.
- **Grafo:** no se usó. El proyecto del worktree no está indexado (design § Lo que ya existe), así que todo se hizo con Grep/Read.

### Veredicto: **RECHAZADO**

Hay un hallazgo bloqueante, el punto 9 de `docs/perfil-agentes.md > reviewer` (comentarios de producción con referencias R/QT/QC). Por lo demás la feature está bien:
- la trazabilidad se cumple;
- las tasks están cerradas;
- las capas están limpias;
- la autorización está en el caso de uso, con su test;
- no hay dependencias nuevas;
- el catálogo está al día.

La vuelta 2 se puede acotar al arreglo de los comentarios.

### Verificación ejecutada por el reviewer (salida real)

| Comando | Resultado |
|---|---|
| `pnpm run typecheck` | `tsc --noEmit`, exit 0 |
| `pnpm run lint` | `✖ 11 problems (0 errors, 11 warnings)` |
| `eslint` sobre los 149 `.ts/.tsx` del diff | 0 errores. 2 warnings (`no-unused-vars`) en `tests/unit/pedidos/order-service.test.ts:17-18`, sobre imports que ya estaban en la base |
| `pnpm exec vitest run guard` | `Test Files 87 passed (87)`, `Tests 1333 passed \| 22 skipped (1355)` |
| `vitest run` de 12 archivos de `tests/unit/pedidos/`: acciones, cancelar receta, posiciones, esquemas, `OrderView`, entregas, predicados, `cancel-order-line`, `order-service` y `module-contract` | `12 passed`, `261 passed` |
| `vitest run` de 8 archivos de la UI del panel, el sub-panel, el detalle y las columnas | `8 passed`, `195 passed` |
| `vitest run` de 21 archivos: menú, selector, diálogos, responsables, entregas, tarjetas, avance, convenciones, viewport y `shared-ui` (`notice-actions`, `row-actions-menu-group`, `catalogo-qc256`) | `21 passed`, `426 passed \| 3 skipped`. Los 3 saltados son los casos de diff de QC-35. Los dos R47 de QT-314 corren y pasan (comprobado con `--reporter=verbose`) |

Qué no se corrió y por qué:
- **`vitest related`.** Se lanzó y se paró: desde `index.ts`, `order-actions.ts` y `lib/composition` arrastra la suite entera, como ya anotó el implementer, y aquí está prohibida. Se verificó archivo a archivo.
- **E2E y `.int`.** No se volvieron a correr, por instrucción del leader. Las salidas están en `progress/impl_QT-314.md` (Cierre de la Tanda 4).

### Checklist

**`.claude/agents/reviewer.md`**
- [x] 1. Trazabilidad: R1–R52 tienen un test concreto que los prueba (tabla abajo). Hay tres coberturas parciales; se aceptan, ver menores 1 y 2.
- [x] 2. Tasks: las 21 de `tasks.md` (T1–T20 y T16b) están en `[x]`, ninguna en `[ ]`.
- [x] 3. `design.md` abre con `## Lo que ya existe`, que no está vacía, y el diff no re-crea nada de esa lista. Reutiliza `cancelOrderLine`, `updateOrderPresentationLines`, `quoteOrderCostSchema`, `deliverOrder`/`voidDelivery` y `orderTotals`. Borra `list-order-line-ids.ts` como pide § 3.2.
- [x] 4. Verificación ejecutable: la tabla de arriba.

**`CHECKPOINTS.md`**
- [x] Están `requirements.md` (EARS, R1–R52), `design.md` (§ 6, con las alternativas A–I) y `tasks.md` con todo en `[x]`.
- [x] `## Lo que ya existe`, ver el punto 3.
- [x] `progress/impl_QT-314.md` contiene el mapa R→test (T20).
- [x] Typecheck y lint sin errores.
- [ ] `gate-completo` del CI: pendiente del PR. No lo valida esta revisión.
- [x] Flujo crítico (importes y movimientos de inventario): lo cubre el E2E `e2e/pedidos-varias-recetas.spec.ts` (R48), con su salida local en la bitácora.
- [x] Sin dependencias nuevas: `package.json` y `pnpm-lock.yaml` no salen en el diff.
- [x] Sin secretos ni configuración hardcodeada. No hay webhooks.

**`docs/checkpoints-proyecto.md`**
- [x] El E2E es de Playwright.
- [x] Multiplataforma, revisado contra la regla:
  - el diff no añade `100vh`/`h-screen`, ni `:hover` como única vía, ni `onMouseEnter`;
  - targets de 44 px en el pie del sub-panel y de 52 px en el selector, con test;
  - los inputs reutilizados y el `Textarea` de shadcn mantienen 16 px.
- [x] Catálogo: las filas `RowActionsMenu` (`groupLabel`) y `Notice` (`actions`) tienen el punto de extensión y citan en `Diseño` los tres tableros `PedidosVariasRecetas*`.
- [x] Pase `/design` citado en `design.md`. R44 se aparta del tablero por decisión escrita (F2.1), y P3 en el listado también.
- [x] Sin tablas, columnas ni migraciones nuevas, así que no aplican RLS ni la columna de empresa.
- [x] Permiso en el caso de uso, con su test:
  - `cancelOrderLine`, `createOrder` y `updateOrder` llaman a `requirePermission(actor, 'pedidos.modificar')`;
  - `getOrderDelivery` exige `entregas.modificar` y `listOrderDeliveries` exige `pedidos.consultar`;
  - tests: `cancel-order-line.test.ts` «R30: sin pedidos.modificar…», `get-order-delivery.test.ts:503` y `list-order-deliveries.test.ts:197`.
- [x] Aislamiento por empresa en las lecturas por receta: `get-order-delivery.test.ts:469,477` y `list-order-deliveries.test.ts:494` cubren el rechazo cruzado, y hay entrada nueva en `tests/integration/aislamiento.json`.
- [x] Módulos hexagonales: guardias en verde. `domain/` no importa framework, la UI importa solo el barrel `@/lib/modules/pedidos` y no se reexporta ningún `'use server'`.
- [x] La lógica de negocio está en `domain/`: las posiciones (`withLinePositions` y `linePositionsOf`) y los predicados publicados. La acción solo compone el `ErrorState`.
- [x] Las mutaciones van por Server Actions y los componentes reciben los datos por props (lo cubre R43 de `pedidos-convenciones`).

**`docs/perfil-agentes.md > reviewer`**
- [x] 5. Calidad y seguridad: capas separadas, sin hardcode de contexto.
- [x] 6. Multiplataforma: ver arriba.
- [x] 7. Dependencias: ninguna.
- [x] 8. Aislamiento por empresa: ver arriba.
- [ ] **9. Comentarios: FALLA**, ver el bloqueante B1.
- [x] 10. Duplicados: no hay pieza nueva en `components/shared`. Las nuevas de la ruta tienen su paso de la regla de decisión en el design (tabla «Componentes nuevos o con cambio»). `CancelOrderLineDialog` justifica por qué no extiende `CancelOrderDialog`.
- [x] 11. Diseño: las piezas nuevas y las que cambian citan los tableros, y las dos filas del catálogo los llevan en `Diseño`.

### Hallazgos

#### BLOQUEANTES (1)

**B1. Comentarios de producción que citan `R<n>`, `QT-<n>` o `QC-<n>` en líneas añadidas o modificadas por el diff** (`docs/perfil-agentes.md > reviewer` n.º 9, `docs/conventions.md > Comentarios`).

- `lib/modules/pedidos/adapters/driving/order-actions.ts:255`, en el JSDoc nuevo de `cancelOrderLineAction`: `Cancelacion de UNA receta del pedido (QT-314 R29).`
- `lib/modules/pedidos/adapters/driving/order-actions.ts:259`, en el mismo bloque: `despues de su comprobacion de \`pedidos.modificar\` (R42).`
- `lib/modules/pedidos/domain/get-order.ts:206`. La línea se reescribió (de «`recipeName` es…» a «El `recipeName` de una linea…») y sigue citando `QC-33`: `…que las FK \`RESTRICT\` de QC-33 hacen casi imposible-…`. Es una línea modificada, así que entra en la regla.

Qué falta: quitar esas referencias y dejar solo el motivo (por ejemplo «Cancelación de UNA receta del pedido.» y «…después de su comprobación de `pedidos.modificar`.»). En `get-order.ts:206`, o se quita `de QC-33`, o se deja la línea como estaba en la base. Es el mismo tipo de hallazgo que bloqueó QT-313.

No son hallazgo:
- El bloque `Cancelacion de pedido (R26, R27, R28)…` de `cancelOrderAction`. Sale como `+` solo porque git reordena el bloque, pero el texto es el de la base, sin cambios.
- Los comentarios de `tests/` y `e2e/`, porque la regla es solo para producción.

En `app/` y `components/` el diff no añade ninguna referencia R/QT/QC (barrido de todas las líneas `+`).

#### Menores (8)

1. **R44: el detalle a pantalla completa en el teléfono no tiene test** (nota 1 del implementer).
   - Hay test para el sub-panel (`order-line-sheet.test.tsx:426`), para el panel de alta y edición y para el de entrega (E2E de 390 px). Para `OrderDetailSheet`, ninguno.
   - El código lo cumple: `order-detail-sheet.tsx:222` lleva `w-full … data-[side=right]:w-full sm:max-w-lg`.
   - Se acepta porque R44 tiene ocho casos y solo falta esta cláusula. Arreglarlo cuesta un caso en `order-detail-sheet.test.tsx` gemelo del de `order-line-sheet.test.tsx:426`. Conviene añadirlo en la vuelta 2.
2. **R45 y R39, coberturas que se aceptan.**
   - **R45.** El desplazamiento horizontal se apoya en `pedidos-viewport.test.tsx:497`, un caso heredado con la etiqueta «(R22)» de QC. Monta la pantalla nueva de Pedidos (`renderPantalla`) y comprueba que el único desplazador es el `table-container`, así que sí verifica R45. Lo que no encaja es la etiqueta. Lo de apilarse a la derecha lo cubre `order-line-sheet.test.tsx:426`.
   - **R39.** El tono de cada receta se comprueba por `data-status` sobre el mismo `OrderStatusBadge` en el detalle, el selector y la ficha. El mapa estado→tono es único (`order-status.test.ts`, QT-313 R53) y `guard-pedidos-rediseno` impide mapas propios, así que es suficiente. El «Parcial»/`progress` del listado tiene su propio caso R39 en `order-columns.test.tsx`.
3. **`responsiblesFrozen` copia en la UI el mapa de estados de `asignaciones`** (`app/(private)/pedidos/components/order-line-actions.ts:62-81`, copiado de `ERROR_POR_ESTADO` en `asignaciones/domain/order-state.ts:61`).
   - El design § 4.6 pide ese comportamiento, y `asignaciones` no publica un predicado. Hoy la copia coincide (PENDIENTE/EN_CURSO/BLOQUEADO escribibles, PARCIAL si alguna activa lo es) y la cubren los tests R38.
   - Va contra el espíritu de § 3.6 («anticipa las reglas del servidor sin copiarlas»). Anotarlo en `progress/deudas.md`: que `asignaciones` publique el predicado y la UI lo consuma.
4. **El E2E `pedido-en-varias-presentaciones.spec.ts:696-712` llama al `onClick` de React recorriendo `__reactFiber`.**
   - Conserva la intención original: saltarse el botón deshabilitado y comprobar que el servidor rechaza sin tocar el reparto.
   - Depende de internos de React y se rompe con un cambio de versión o con un `data-testid` movido.
   - Alternativa más estable para una ficha futura: comprobar el rechazo del servidor en el test de la acción, o con una llamada directa a la Server Action.
5. **El R47 de `pedidos-convenciones.test.ts:783` se salta si `origin/dev..HEAD` no tiene commits de QT-314.**
   - En CI no pasa: `gate.yml` hace checkout con `fetch-depth: 0` (líneas 82 y 153).
   - Tras el merge a `dev`, el caso se saltará siempre, incluida la comparación de dependencias con la base. Es un control de la ficha, no permanente. Basta saberlo.
6. **La etiqueta «QT-313 R44» sigue en `tests/integration/asignaciones/order-lines-execution.int.test.ts:411`**, aunque QT-313 R44 dejó de aplicar. Lo que comprueba sigue valiendo (QT-313 R45). Conviene renombrarla a «QT-313 R45» en una limpieza, porque la etiqueta confunde la trazabilidad.
7. **Código muerto.** `e2e/helpers/order-distribution.ts:99 > submitOrderWithLeftover` ya no lo usa ningún spec y se dejó. Borrarlo, o anotarlo.
8. **Proceso.** El leader editó a mano `tests/unit/shared-ui/catalogo-qc256.test.ts` (commit `d4363497b`), y `CLAUDE.md` dice que el leader no escribe en `tests/`.
   - El contenido es correcto: alinea el test con las filas `Notice` y `RowActionsMenu`, que ahora citan los tres tableros. El test pasa.
   - Se anota solo por el rol.

#### Decisiones de los subagentes, revisadas (sin hallazgo)

- **Guardias cambiadas en la Tanda 3.** Las dos son coherentes con el spec y no relajan nada:
  - `guard-identificador-de-request`: alta de `pedidos-varias-recetas.spec.ts` en `E2E_ESPERADOS`, con su motivo. La superficie que aplana pasa de `order-form.tsx` a `order-line-sheet.tsx`, que es donde vive ahora el `set-estado-string`, y su caso sintético se actualizó igual.
  - `guard-pantalla-pedidos-se-amplia`: quita el ancla `isFinalOrderStatus`, que el design § 4.6 manda borrar.
- **`withLinePositions(positions): this`** sobre `PedidosError`. Evita tocar ~30 constructores y deja `linePositionsOf` con el `instanceof` en el dominio, como pide § 3.3. Se acepta.
- **`lineStatus` vale `null` sin `lineId`.** Era provisional (T4). Tras T13, `lineId` es obligatorio y `ListOrderDeliveriesView.lineStatus` es `OrderLineStatus`, sin `null` (`list-order-deliveries.ts:23`). Queda resuelto.
- **`cancelOrderLineAction` no parsea el esquema.** Lo valida el caso de uso después del permiso, así que quien no tiene permiso recibe `unauthorized` y no `invalid_input`. Es lo que pide R42.
- **Snapshots de paridad y `catalogo-qc256`.** Siguen la extensión del catálogo y están en verde.

### Tabla de trazabilidad comprobada

Para cada fila, el reviewer comprobó tres cosas:
- que el archivo existe;
- que el caso está y afirma lo que dice el requisito: leídos los de R39, R44, R45, R47, R29/R42 y R33/R35;
- que el archivo pasa en las corridas de arriba.

La única excepción son los E2E y los `.int`, que se aceptan por la salida de la bitácora.

| R | Test que lo verifica | Estado |
|---|---|---|
| R1 | `pedidos-ui/order-form.test.tsx` › «R1: cliente, prioridad, tabla vacía…» | OK |
| R2 | `order-form.test.tsx` › «R2: una fila por receta…», «R2: debajo, el total…»; `order-lines-table.test.tsx` › «R2: cabeceras…» | OK |
| R3 | `order-form.test.tsx` › «R3: «Añadir receta» abre…», «R3: el «Editar»…»; `order-line-sheet.test.tsx` › «R3: al editar…» | OK |
| R4 | `order-form.test.tsx` › «R4: nueva al final», «R4: editada en su sitio», «R4: campo que no pasa el esquema» | OK |
| R5 | `order-form.test.tsx` › «R5: «Descartar»…», «R5: «Volver al pedido»…» | OK |
| R6 | `order-form.test.tsx` › «R6: … no llama a ninguna acción de guardado», «R6: cerrar sin guardar…» | OK |
| R7 | `order-form.test.tsx` › R7 (×3); `order-line-draft.test.ts` › R7; E2E `pedidos-varias-recetas.spec.ts` | OK |
| R8 | `order-line-sheet.test.tsx` › «R8: no deja aplicar…», «R8: sí deja … cancelada» | OK |
| R9 | `order-row-actions.test.tsx`, `order-detail-sheet.test.tsx` (PARCIAL, ENTREGADO, CANCELADO), `order-line-actions.test.ts` | OK |
| R10 | `order-form.test.tsx` › R10 (×2); `order-lines-table.test.tsx` › R10; `pedidos/order-line-predicates.test.ts` › R10 | OK |
| R11 | `order-line-sheet.test.tsx` › R11 (×2); `order-line-predicates.test.ts` › R11 | OK |
| R12 | `order-form.test.tsx` › R12 (×2); `order-line-draft.test.ts` › R12 | OK |
| R13 | `order-line-sheet.test.tsx` › R13 (×3); `order-line-draft.test.ts` › R13; `order-line-predicates.test.ts` › R13 | OK |
| R14 | `order-form-quote.test.tsx` › R14 (×2); `pedidos/order-actions.test.ts` › R14 | OK |
| R15 | `pedidos/order-line-positions.test.ts` (8 casos por regla); `order-actions.test.ts` › R15 (×2) | OK |
| R16 | `order-line-positions.test.ts` › R16 (×2); `guard-catalogo-de-errores` en verde y sin tocar | OK |
| R17 | `order-form-lines-error.test.tsx` › R17 (×3); `shared-ui/notice-actions.test.tsx` › R17 | OK |
| R18 | `order-detail-sheet.test.tsx` › R18 (×4); `order-row-wiring.test.tsx` › R18 (×2) | OK |
| R19 | `order-detail-sheet.test.tsx` › «R19: no ofrece ningún control…» | OK |
| R20 | `order-columns.test.tsx` › R20 (×3) | OK |
| R21 | `order-columns.test.tsx`, `order-progress.test.tsx`, `order-cards.test.tsx` › R21 | OK |
| R22 | `order-columns.test.tsx` › R22 (×3) | OK |
| R23 | `order-columns.test.tsx` › R23; `order-cards.test.tsx` › «R15, R23…» | OK |
| R24 | `pedidos/order-view.test.ts` › R24 (tipo); `order-columns.test.tsx` › R24; `order-form.test.tsx`; `order-sheet-responsibles.test.tsx` › «R51, R24» | OK |
| R25 | `order-row-actions.test.tsx` › R25 (×2); `shared-ui/row-actions-menu-group.test.tsx` › R25 | OK |
| R26 | `order-row-actions.test.tsx`, `order-line-actions.test.ts`, `order-row-wiring.test.tsx`, `order-list-section.test.tsx` | OK |
| R27 | `order-line-picker-dialog.test.tsx` › R27 (×3); `order-row-wiring.test.tsx` › R27 | OK |
| R28 | `cancel-order-line-dialog.test.tsx` › R28 (×4); `order-row-wiring.test.tsx` › «R26, R27, R28» | OK |
| R29 | `pedidos/order-actions-cancel-line.test.ts` › R29 (éxito, `not_cancellable`, `order_not_found`, 500 caracteres; sin `id`/`lineId` responde `invalid_input` sin llamar) | OK |
| R30 | `order-distribution-dialog.test.tsx` › R30 (×2) | OK |
| R31 | `pedidos/order-actions-distribution.test.ts` › R31 (×2) | OK |
| R32 | `order-delivery-sheet.test.tsx` › R32 (×2) | OK |
| R33 | `pedidos/get-order-delivery.test.ts` › R33 (TERMINADO con PARCIAL, otra receta, `action_not_allowed`, otra empresa, obligatoria, permiso); `.int` `order-delivery-by-line` | OK |
| R34 | `order-deliveries-sheet.test.tsx` › R34 (×2); `order-delivery-list.test.tsx` › R34 por estado | OK |
| R35 | `pedidos/list-order-deliveries.test.ts` › R35 (×6, otra empresa incluida) | OK |
| R36 | `cancel-order-dialog.test.tsx`, `order-row-actions.test.tsx`, `order-whole-actions.test.tsx` › R36 | OK |
| R37 | `order-row-actions.test.tsx`, `order-whole-actions.test.tsx`, `order-line-predicates.test.ts` › R37 | OK |
| R38 | `order-sheet-responsibles.test.tsx` › R38 (×2); `order-row-actions.test.tsx` › R38 (×2) | OK |
| R39 | `order-columns.test.tsx` › R39; `shared-ui/order-status.test.ts` (mapa único); `data-status` en el detalle, el selector y la ficha | OK, parcial aceptada (menor 2) |
| R40 | `pedidos/order-input-lines.test.ts` › R40 (×2) | OK |
| R41 | `pedidos/order-actions.test.ts` › R41 (×3) | OK |
| R42 | `order-actions-cancel-line.test.ts` › R42 (×2); `cancel-order-line.test.ts` › permiso en el caso de uso; `order-list-section.test.tsx` › «R26, R42» (×2) | OK |
| R43 | `pedidos-convenciones.test.ts` › R43 (×2, con su caso rojo) | OK |
| R44 | `order-cards.test.tsx` › R44 (×4); `order-lines-table.test.tsx` › R44; `order-line-sheet.test.tsx:426,441`; `order-line-picker-dialog.test.tsx` › R44 (×2); E2E de 390 px | OK, parcial aceptada (menor 1: falta el detalle) |
| R45 | `order-line-sheet.test.tsx:426`; `pedidos-viewport.test.tsx:497` | OK, parcial aceptada (menor 2: etiqueta heredada) |
| R46 | `order-line-sheet.test.tsx:433`; `order-form-lines-error.test.tsx` › R46; `order-progress.test.tsx` › R46 | OK |
| R47 | `pedidos-convenciones.test.ts:783,805` (corre, no se salta) | OK |
| R48 | E2E `pedidos-varias-recetas.spec.ts` (salida en la bitácora, T18) | OK |
| R49 | Los 26 E2E de T19, lotes A y B (salida en la bitácora) | OK |
| R50 | `order-form.test.tsx` › R50 (×2) | OK |
| R51 | `order-sheet-responsibles.test.tsx` › R51 (×4) | OK |
| R52 | `order-delivery-draft.test.ts` › R52 (×3); `order-delivery-sheet.test.tsx` › R52 | OK |

Para la vuelta 2 basta B1. Se recomienda añadir también el caso del menor 1. Los demás menores pueden ir a `progress/deudas.md`.
