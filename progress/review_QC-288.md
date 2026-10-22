# Review QC-288 — entrega-sin-pedido (F2.2, vuelta 1, alcance completo)

> Reviewer · 2026-10-19 · HEAD `f8c5101e` contra `origin/dev` (merge-base tras `593450fc`).
> Grafo: no usado; esta ronda va por Grep/Read y git (no se mide nada con él).

## Verificación ejecutable (salida real, en el worktree)

- `pnpm run typecheck` → exit 0.
- `pnpm run lint` → `✖ 10 problems (0 errors, 10 warnings)`, exit 0. Los warnings son previos (`order-actions`
  imports sin uso de antes de la rama).
- `pnpm exec vitest run guard` → `Test Files 81 passed (81)`, `Tests 1109 passed | 20 skipped (1129)`.
- Tests que la rama añade o toca (unit e int, sin guardias): ver «Tests de la rama» abajo.
- Comentarios: `git diff -U0 origin/dev...HEAD -- app lib components db` → 0 líneas añadidas con `QC-<n>`,
  `R<n>`, `design.md` o «decisión cerrada».
- `git diff origin/dev...HEAD -- package.json pnpm-lock.yaml lib/modules/identity` → vacío.
- El mapa R → test de `progress/impl_QC-288.md`: los 57 casos citados existen literalmente en su archivo
  (comprobado por script, 0 ausentes).

## Checklist

### CHECKPOINTS.md
- [x] `requirements.md` con EARS R1–R57 (pero ver H1: archivo duplicado).
- [x] `design.md` con alternativas descartadas (§10, A1–A9).
- [x] `tasks.md`: las 14 tasks `## [x]` (T0, B1–B5, F1–F5, TC, TI, TZ).
- [x] `design.md` abre con `## Lo que ya existe`, no vacía; el diff no re-crea nada de lo listado (reutiliza
      `order_deliveries`/`order_delivery_voids`, `checkDeliveryBlocks`, `dispatchFinishedGoods`,
      `returnFinishedGoods`, `OrderDeliveryVoidRepository`, el directorio del tab Entregas).
- [x] Cada R mapea a un test concreto; el mapa está en `progress/impl_QC-288.md`.
- [x] Typecheck y lint sin errores.
- [ ] `gate-completo` en CI: no corre aquí (CI).
- [x] Flujo crítico (movimientos de inventario): E2E Playwright `e2e/entrega-sin-pedido.spec.ts`, salida local en la
      bitácora (`4 passed`, chromium + webkit).
- [x] Sin dependencias nuevas.
- [x] Sin secretos ni configuración hardcodeada; sin webhooks.
- [ ] Verificación final (`./init.sh` TZ, cierre, worktree): del leader.

### docs/checkpoints-proyecto.md
- [x] Multiplataforma: tres tableros (escritorio, tablet, teléfono); `summary` con `min-h-11`, casillas con
      `touchTarget`, campos de texto con `Textarea`/`Input` del sistema; sin `100vh` ni `:hover` como única vía.
- [x] `CATALOGO.md`: tres filas nuevas para las piezas subidas, con `Diseño` = `EntregaSinPedido.dc.html`.
- [x] Pase `/design` aprobado y citado (`design.md > UI`, decisión D15).
- [x] Empresa: no hay tabla nueva; las columnas nuevas van en tablas con `company_id`; la FK
      `order_deliveries(company_id, product_id) → products(company_id, id)` es compuesta; las consultas nuevas filtran
      por empresa y hay test de rechazo cruzado (R30, R31, R32, R48, R9, R52/R53/R54 «con el ámbito de B»).
- [x] Permisos en `domain/`: `requirePermission` es la primera sentencia de los cinco casos de uso
      (`deliverDirect`, `getDirectDelivery`, `listDirectDeliverySurplus` con `entregas.modificar`;
      `getDirectDeliveryForVoid`, `voidDirectDelivery` con `entregas.anular`), con tests R2/R3/R4.
- [x] RLS: sin tabla nueva; el `down.sql` hace el paréntesis `NO FORCE`/`FORCE` y R41 comprueba RLS forzada.
- [x] Acceso a datos solo por adaptadores driven (Prisma).
- [x] Migraciones con `down.sql`; `db:rollback` probado en la base de test (bitácora B1).
- [x] Hexagonal: `domain/` y `ports/` importan solo `zod` y contratos `@/lib/modules/<otro>` (tipos); las actions
      piden `pedidos` a `lib/composition`.
- [x] Lógica de negocio en `domain/` (tope, reglas de bloque, idempotencia); las actions solo traducen errores.
- [x] Mutaciones por Server Actions.

### Reglas del reviewer (perfil, 5–11)
- [x] 5 Calidad/seguridad: ver arriba.
- [x] 6 Multiplataforma: ver arriba.
- [x] 7 Dependencias: ninguna.
- [x] 8 Aislamiento por empresa: ver arriba.
- [x] 9 Comentarios: 0 citas en producción.
- [x] 10 Duplicados: `design.md > UI` justifica el paso de cada pieza (A8, A9 descartan extender los de `/pedidos`).
- [x] 11 Diseño: referencias en `design.md` y en las filas del catálogo.

## Puntos que pidió el leader

### Migraciones
- `20261016130000_inventory_movement_kind_direct_delivery`: solo dos `ADD VALUE`, sola por la restricción de
  Postgres. El `down.sql` aborta con `23514` si hay asientos de los tipos nuevos; si no, recrea el enum soltando y
  reponiendo los dos CHECK y el índice parcial que comparan con literal del tipo. Correcto.
- `20261016130100_direct_deliveries`: aditiva. Relaja `NOT NULL` de `order_id` y `order_presentation_line_id`
  pero lo compensa con `order_deliveries_order_xor_product` y el disparador de líneas. Los cinco CHECK de
  `inventory_movements` se reescriben ampliando la lista; `order_id_matches_kind` no se toca, así que los tipos
  nuevos quedan obligados a `order_id NULL`. El `down.sql` aborta entero si hay entregas sin pedido o asientos
  nuevos, y si no deja los textos previos.
- Disparadores: `order_delivery_lines_check_origin` (línea sin pedido: sin línea del reparto y lote del producto
  de la entrega; con pedido: exige línea del reparto) e `inventory_movements_check_delivery_origin` (el tipo del
  asiento coincide con la entrega o anulación apuntada). Los dos, `BEFORE INSERT OR UPDATE`, delegan el «no
  encontrado» en la FK. R40 los cubre en `direct-delivery-constraints.int.test.ts`.
- R42 (aplicar no cambia lo existente; revertir aborta o deja el esquema): `direct-deliveries-migration.int.test.ts`
  aplica los `.sql` reales en un esquema desechable.

### Tope bajo el bloqueo del producto (paso 0) y su test de concurrencia
- `deliverInTransaction`: paso 0 `lockWaitingCandidates` (`FOR SHARE OF o`, por `id`, pedidos vivos de la receta
  en `TERMINADO`/`EN_ACONDICIONAMIENTO` con línea de la presentación), luego `lockForDirectDelivery`
  (`FOR NO KEY UPDATE` del producto y lectura de lotes ya bloqueado), clave, lectura de lo que esperan en el
  mismo `tx`, `checkDirectDelivery` y después la salida. Orden pedidos → producto → lote, como la entrega de
  pedido. Si la receta o la presentación cambian entre la lectura previa y el bloqueo, aborta.
- `direct-delivery-concurrency.int.test.ts`: tres casos reales con `commit` (dos sin pedido 7+7 sobre 12;
  sin pedido + de pedido; acondicionamiento con la transacción abierta a mano y espera comprobada en
  `pg_stat_activity` sobre `FOR SHARE OF o`). El tercero demuestra que el paso 0 hace falta. Bien.

### Autorización en el servicio
- Permiso primero, antes de parsear y de leer (R2/R3), en los cinco casos de uso. Ámbito: `scope.companyId` del
  actor en todas las consultas. Otra empresa responde `product_not_found` / `customer_not_found` /
  `batch_not_found` / `delivery_not_found` (404, no 403), con tests int. La anulación de pedido (`voidDelivery`)
  responde `delivery_not_found` ante una entrega sin pedido (R48).

### Componentes subidos a `components/shared`
- Ningún import a la ruta vieja en `app`, `components`, `lib`, `tests` ni `e2e` (grep). Los consumidores de
  `/pedidos` (nueve archivos y el barrel) importan de `@/components/shared/...`.
- `guard-buscadores.test.ts`: solo notas fechadas; las rutas viejas de `NO_SE_TOCAN_R21` y del caso sintético
  son el registro histórico de QC-233, que solo corre en la rama de esa ficha. El recorrido real
  (`app`, `components`, `hooks`) ya ve la pieza nueva. Correcto.

### Cabecera «Acciones» visible (impl) frente a «solo para lectores» (design §7.5) → H3.

### R57 y el choque de nombre en `scope.test.ts`
- Los casos «R57» de `tests/unit/pedidos/scope.test.ts` son el R57 de QC-35, no este. El R57 de QC-288 se
  comprueba con el diff vacío de `package.json`/`pnpm-lock.yaml` (verificado) y `guard-dependencias-aprobadas`
  en verde, el mismo criterio que en reviews anteriores (QC-104, QC-121…). No es hallazgo.

### Rojo E2E en `e2e/detalle-de-producto-terminado.spec.ts:548` → H5 (no es de QC-288).
- `git diff origin/dev HEAD -- e2e/detalle-de-producto-terminado.spec.ts` → vacío. Último cambio en `origin/dev`:
  `1081a9d0` (QC-282), anterior a QC-263.
- `finished-stock-columns.tsx` (único sitio con `data-testid="finished-stock-name"`) y
  `components/shared/data-table/` son idénticos a `origin/dev`.
- La causa: QC-263 (`c09844b7`, «tarjetas») pasa `card={FINISHED_STOCK_CARD}` al `DataTable`, que pinta la tabla
  (`@max-[760px]:hidden`) **y** las tarjetas a la vez. `getByTestId(...).filter(...)` cuenta los dos → 2.
- El diff de QC-288 en `finished-stock-table.tsx` solo añade `surplusByProduct` → `directDelivery` en el menú
  de la fila; no toca la celda del nombre ni las tarjetas. QC-288 **ni lo causa ni lo empeora**. Su E2E nuevo
  acota la fila con `[data-testid^="table-row"]` y no cae en el mismo selector.
- El rojo no está en `progress/deudas.md` ni en `tests/baseline-rojos.json`.

## Hallazgos

- **BLOQUEANTE H2 — Faltan las notas fechadas de las enmiendas de `design.md §11` en los specs dueños.**
  `design.md §11` enmienda, con aprobación del humano en F1.4: QC-223 R25, R29, R31; QC-224 R18, R32; QC-225 R7,
  R16, R17, R19, R36. El diff solo añade nota en `specs/QC-225-detalle-de-producto-terminado/requirements.md`
  bajo **R7** (que además es la nota del contrato de ruta de F2.1). No hay nota en
  `specs/QC-223-entregar-producto-terminado/requirements.md` ni en
  `specs/QC-224-anular-entrega/requirements.md` (`grep QC-288` → 0), y en QC-225 faltan R16/R17 (orígenes
  nuevos), R19 («Sin pedido» en lugar del número) y R36 (la ficha sí ofrece anular en filas sin pedido). Hoy esos
  requisitos dicen lo contrario de lo que hace el código: por ejemplo, QC-225 R36 y QC-223 R25 («guardarla con el
  pedido»). **Para cumplirlo:** una nota fechada «Enmienda 2026-10-16 (QC-288, aprobada por el humano en F1.4)»
  bajo cada uno de esos requisitos, con el texto de la columna «Queda así» de §11. Las de QC-263 R21/R23 sí están.

- **menor H1 — `specs/QC-288-entrega-sin-pedido/requirements.md` duplicado y con tablas mezcladas.** Desde
  `934d845f` (F1.4) el archivo tiene dos copias idénticas de R1–R57 (líneas 49–300 y 357–608; `diff` vacío). El
  encabezado de la primera `## Decisiones cerradas` está roto (línea 331, «`, contando desde arriba:»). Las cinco
  filas de F2.1 y del 2026-10-19 (columna «Cliente») están en la tabla «Cobertura de las decisiones cerradas» de
  la primera copia (321–325), no en la tabla de decisiones (línea 646). La segunda `## Preguntas abiertas`
  (línea 630) sigue con P1–P4 abiertas. El contenido normativo coincide. Hay que dejar una sola copia y mover las
  cinco filas a la tabla de decisiones.

- **menor H3 — Cabecera «Acciones» visible en el tab Entregas, contra `design.md §7.5` y el tablero.** §7.5 pide la
  cabecera de la columna de acciones «solo para lectores de pantalla», y el tablero la pinta
  `<span class="sr">Acciones</span>`. La implementación usa `actionsColumn` con cabecera visible y retiró la
  extensión `srOnlyLabel` (bitácora F4). La decisión de F2.1 cambió el botón suelto por el menú, pero no la
  cabecera. Es coherente con las demás tablas con `actionsColumn` (clientes, presentaciones…), pero se aparta de
  un diseño aprobado sin decisión registrada. **Para cumplirlo:** o una fila en «Decisiones cerradas» aprobada
  por el humano y §7.5 corregido, o la cabecera oculta.

- **menor H4 — La rama ya no se integra limpia con `origin/dev`.** `origin/dev` avanzó (QC-278, `d4822ee2`) y
  `git merge-tree HEAD origin/dev` da conflicto en `tests/guards/guard-identificador-de-request.test.ts` (los dos
  añaden a los censos). Hay que resolverlo con un merge de `origin/dev` antes del PR.

- **menor H5 — Rojo E2E ajeno sin registrar.** `detalle-de-producto-terminado.spec.ts:548` es de QC-263 (ver
  arriba), pero no está en `progress/deudas.md` ni hay ficha. El leader debe registrarlo (deuda o ficha). No
  bloquea QC-288.

## Tests de la rama

`pnpm exec vitest run <los 53 .test.ts(x) que la rama añade o toca, fuera de tests/guards>`, que incluye los
15 `.int` de `inventario` y `pedidos` (migración, restricciones, concurrencia, anulación, directorio):
`Test Files 53 passed (53)`, `Tests 1219 passed (1219)`, exit 0.

## Veredicto

**RECHAZADO**: 1 bloqueante (H2) y 4 menores (H1, H3, H4, H5).

El código, las migraciones, la concurrencia, la autorización y la trazabilidad R1–R57 están bien y verificados.
Lo que vuelve al implementer:
- **H2:** las notas fechadas de las enmiendas de §11 en QC-223 (R25, R29, R31), QC-224 (R18, R32) y QC-225
  (R16, R17, R19, R36).
- **H1:** dejar una sola copia en `requirements.md` y mover las cinco filas a la tabla de decisiones.
- **H4:** merge de `origin/dev`.

**H3** necesita una decisión del humano, que el leader debe traer. **H5** es del leader: registrar el rojo de
QC-263.

## Vuelta 2 (acotada a f8c5101e..f3ef6ce2)

Alcance: los arreglos de H1–H4 y, por `docs/gate.md > La vuelta 2 del reviewer`, la extensión de
`components/shared/data-table` que trae H3 (componente compartido). No se rehace la trazabilidad.
Conocido y fuera de hallazgos: `scripts/validate-features.mjs` falla en local porque
`feature_list.json` no tiene QC-278 (F0 del leader).

### Verificación ejecutable (salida real, en el worktree)

- `pnpm exec vitest run tests/unit/shared-ui tests/unit/shared/data-table-header-menu.test.tsx
  tests/unit/shared/data-table.test.tsx tests/unit/clientes-ui/data-table-intacta-clientes.test.ts
  tests/unit/configuracion-ui tests/unit/inventario-ui/finished-product-tables.test.tsx
  tests/unit/inventario-ui/finished-product-page.test.tsx tests/guards/guard-catalogo-de-componentes.test.ts
  tests/guards/guard-formularios-y-acciones.test.ts tests/guards/guard-identificador-de-request.test.ts`
  → `Test Files 121 passed (121)`, `Tests 1798 passed | 38 skipped`. Hubo un aviso de cierre de un worker
  (`Timeout terminating forks worker`), no un fallo.
- `pnpm exec tsc --noEmit -p .` → sin errores.
- `pnpm exec eslint` sobre los archivos tocados por H3 y H4 → sin errores.
- `git merge-base --is-ancestor origin/dev HEAD` → sí; `git merge-tree --write-tree HEAD origin/dev` → limpio.

### Checklist de la vuelta

- [x] **H1** — `specs/QC-288-entrega-sin-pedido/requirements.md` tiene una sola copia: 57 requisitos R1–R57.
  Las líneas 1–320 son idénticas a las de `f8c5101e` (`diff` vacío). Las líneas `R<n>` coinciden una a una con
  la versión anterior, deduplicada. La segunda copia, la de 357–630, también es idéntica, línea a línea,
  a la que queda. Se van el encabezado roto y la segunda «Preguntas abiertas» con P1–P4 abiertas. Las
  cinco filas (cuatro del 2026-10-16 F2.1 y una del 2026-10-19, «Cliente») pasan de la tabla «Cobertura»
  a «Decisiones cerradas (no reabrir)», al final, sin cambio de texto. Ningún requisito cambia.
- [x] **H2** — Las notas fechadas «Enmienda 2026-10-19 (enmienda QC-288, aprobada por el humano en F1.4;
  design.md §11)» están, cada una bajo su requisito: QC-223 R25, R29 y R31; QC-224 R18 y R32; QC-225
  R16, R17, R19 y R36. El diff de los tres specs solo añade líneas: ningún texto original cambia. La
  nota de QC-225 R36 admite «Anular» en el tab Entregas para las entregas sin pedido no anuladas: menú
  de la fila con un único elemento, solo con `entregas.anular` y fuera del DOM sin él. Para las
  entregas de pedido mantiene «sin control de anular» y para la marca y el total, `inventario.consultar`.
  Cuadra con QC-288 R43/R53 y con la decisión F2.1. `tasks.md > Lo que se enmienda` lo registra.
- [x] **H3** — `finished-product-deliveries-table.tsx` pasa `srOnlyLabel: true` a `actionsColumn`. El test nuevo
  (`finished-product-tables.test.tsx`, «R43 — la cabecera … solo la ve el lector de pantalla») prueba
  tres cosas: `columnheader` con nombre «Acciones», que es `data-table-head-actions`, y el texto con
  `sr-only`. Cumple `design.md §7.5` y el tablero.
- [x] **H4** — `4be2b22c` integra `origin/dev` (QC-278, `d4822ee2`). En
  `tests/guards/guard-identificador-de-request.test.ts` quedan las dos altas de `E2E_ESPERADOS`, una
  sola vez cada una y en este orden: `'entrega-sin-pedido.spec.ts'` y `'maestro-modulos.spec.ts'`. Los
  dos archivos existen en `e2e/`. No quedan marcadores de conflicto. El lado de QC-288 del merge
  (`4be2b22c^2..4be2b22c`) solo trae QC-278. La guardia pasa.

### Alcance ampliado: `srOnlyLabel` en `components/shared/data-table`

- [x] **Aditiva.** La prop es opcional en `DataTableColumn` y en `ActionsColumnOptions`. `actionsColumn`
  solo la copia si es `true`; si falta, la columna sale igual que antes, sin la clave. El test lo
  comprueba con `col.srOnlyLabel` `undefined`.
- [x] **Las demás tablas no cambian.** `DataTableHeaderCell` pone `className={undefined}` cuando falta la
  prop, y React no pinta el atributo. El único consumidor es la tab Entregas (`grep srOnlyLabel` en
  `app/`, `components/` y `lib/`). Los `data-table-intacta-*` (clientes, configuración, unidades,
  usuarios), `data-table.test.tsx`, `data-table-header-menu.test.tsx` y `data-table-acciones` /
  `-tarjetas` pasan sin cambios. Las tarjetas usan `texts.cardActions`, no `column.label`.
- [x] **CATALOGO.md.** La fila `DataTable` añade `srOnlyLabel` a las props por columna («cabecera solo para
  lector; ausente = visible») y a `actionsColumn` («`srOnlyLabel` opcional»). La guardia del catálogo pasa.
- [x] **Tests.** `actions-column.test.tsx` cubre los dos casos en el componente real de la cabecera: por
  defecto, visible y sin `sr-only`; con la prop, nombre accesible intacto y `sr-only`. A eso se suma el
  test de pantalla de la tab Entregas.

### Hallazgos de la vuelta 2

- **menor H6 — `srOnlyLabel` no hace nada en una columna ordenable, y nada lo avisa.**
  `DataTableHeaderCell` solo la aplica en la rama sin orden (`data-table-header-menu.tsx`, el
  `<span>` de la rama `else`). En una columna con `sortable`, el `<span>` del botón la ignora sin
  avisar. El tipo (`data-table-types.ts`) y la fila de `CATALOGO.md` la ofrecen «por columna» sin esa
  salvedad. Hoy no afecta a nadie: el único uso es `actionsColumn`, que nunca es ordenable. Basta con
  una línea en el JSDoc y en el catálogo («solo en columnas sin orden»), o con aplicarla también al
  botón. No bloquea.

Sin regresiones en el rango revisado. H5 sigue siendo del leader (rojo E2E de QC-263); no se re-evalúa aquí.

### Veredicto de la vuelta 2

**OK** — 0 bloqueantes, 1 menor (H6). H1, H2, H3 y H4 quedan resueltos.
