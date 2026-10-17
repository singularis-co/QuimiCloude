# Review QC-263 — rediseno-inventario (F2.2, vuelta 1)

Rama `feature/QC-263-rediseno-inventario` (HEAD `774a293c`), diff contra `origin/dev` (`0f71d5af`,
merge-base `27fdd133`). Spec enmendado 2026-10-16 (§ 12, P17–P22). Tableros: `Inventario*`,
`InventarioImportar*`, `ModalesInventario`, `InventarioColumnasLotes*`.

MCP del grafo: no se usó; bastaron Grep/Read sobre el worktree.

## Verificación ejecutada (salida propia, no la de la bitácora)

| Qué | Resultado |
| --- | --- |
| `pnpm run typecheck` | sin errores |
| `pnpm run lint` | 0 errores, 10 warnings en 4 archivos ajenos al diff |
| `pnpm exec vitest related --run <app/ y tests/ del diff>` | 60 archivos, 1145 passed, 3 skipped |
| `pnpm exec vitest run guard` | 81 archivos, 1106 passed, 20 skipped |
| Tests que leen del disco y nombran inventario o e2e (136 archivos fuera de guardias; `vitest related` no los selecciona) | 129 en verde y 7 rojos por timeout bajo carga (barridos de 30 a 73 s). Corridos en serie (`--no-file-parallelism`) salen los 7 en verde (112 passed). No son regresión del diff |
| `git merge-tree HEAD origin/dev` | **6 conflictos** (ver B1) |

Respuesta al punto (1) del implementer: no aparecen más tests de disco rotos por el diff, aparte
de `product-route-contract.test.ts` y `scope.test.ts`, que ya estaban arreglados. Los 7 rojos
de arriba son tiempos de espera de barridos de todo el repo cuando corren en paralelo. No dependen
del contenido del diff (entre ellos están `pdf-converter`, `pedidos-convenciones` y `recipe-route-contract`).

## Checklist

### CHECKPOINTS.md
- [x] requirements.md con EARS numerados (R1–R53).
- [x] design.md con alternativas descartadas (A1–A11).
- [ ] tasks.md todo `[x]`: **T7c abierta**, solo porque falta `./init.sh --completo`. Según `AGENTS.md > Quién corre qué`, eso lo corre el CI. Las deudas ya están en el diff (D41 resuelta, D53 y D56 ampliadas, D61 y D62 nuevas) → m6.
- [x] `## Lo que ya existe` presente y completo. El diff no re-crea nada de la lista: `ImportSteps` es paso 4 justificado, `ProductRowDialogs` y `product-batch-columns` son internos de la ruta y solo componen piezas.
- [x] Equipo: tomada por ArqDev (`d51af8fe`).
- [x] Cada R<n> mapea a un test concreto: lo comprobé por título de test en el archivo mapeado de `tasks.md > Trazabilidad`. R44 es condicional (no se extendió ninguna pieza compartida) y R14 queda cubierto por el test de QC-262 más `product-row-actions.test.tsx`.
- [x] Mapa R→test en `progress/impl_QC-263.md`, por tanda.
- [x] typecheck / lint.
- [ ] `gate-completo` en CI: pendiente (no hay PR).
- [x] Flujo crítico (movimientos de inventario): E2E de Playwright con salida local en la bitácora (`ajuste-de-inventario`, `inventario-rediseno` y el resto de T7b).
- [x] Sin dependencias nuevas (no toca `package.json`).
- [x] Sin secretos, webhooks ni configuración hardcodeada.
- [ ] `./init.sh` y `gate-completo`: `init.sh` rápido en verde según la bitácora; yo corrí sus piezas (arriba). El CI está pendiente.

### docs/checkpoints-proyecto.md
- [x] Calidad: typecheck, lint, E2E Playwright.
- [~] Multiplataforma: sin `100vh`, sin `:hover` como única vía, inputs a `text-base` y disparadores a 44 px (conmutador de lotes `touch`, «Acciones» `min-h-11`, cierre propio de 44 px en historial y ajuste). Queda la X de 32 px del `Sheet` «Lotes»: es preexistente, el diff no la añade y ya es la deuda D55 → m3.
- [x] Catálogo: no se toca ninguna pieza de `components/ui`, `components/shared`, `lib/shared/ui` ni `hooks`.
- [x] Pase `/design`: `ImportSteps` cita `InventarioImportar.dc.html` y P17/P18 citan `InventarioColumnasLotes*` (aprobado el 2026-10-16).
- [x] Datos, módulos y permisos: no aplica (sin cambios en `lib/modules`, esquema ni actions). Permisos de página intactos (`requirePagePermission` en la primera línea y `requirePageAddon` en la segunda).

### docs/perfil-agentes.md > reviewer
- [x] 5 Calidad y seguridad: capas intactas, sin hardcode.
- [~] 6 Multiplataforma: ver m3.
- [x] 7 Dependencias: ninguna.
- [x] 8 Aislamiento: sin modelos ni consultas nuevas.
- [x] 9 Comentarios: 65 líneas de comentario añadidas en producción y ninguna cita `QC-`, `R<n>`, `design.md` ni «decisión cerrada».
- [x] 10 Duplicados: el diff no añade nada que ya cubra una fila del catálogo sin justificar.
- [x] 11 Diseño: referencias citadas.

## Hallazgos

### BLOQUEANTE

- **B1 — La rama está desfasada de `origin/dev` y el spec, otra vez desfasado de lo que trajo dev.**
  `origin/dev` avanzó 22 commits desde el merge-base. `git merge-tree` da conflicto en
  `product-columns.tsx`, `product-table.tsx`, `product-batch-rows.test.tsx`, `product-page.test.tsx`,
  `tablas-marca.test.tsx` y `inventario-paridad.test.tsx.snap`. Esos commits de dev cambian lo que fijan R6, R13 y R53:
  - `6a665e3f`: «Costo» solo para el Administrador (`canViewUnitCosts`; el servidor ni lo envía), en moneda redondeada con el valor exacto en `title`, y sin «Presentación» en la pestaña «Producto». R53 dice «sin redondear» y R13/E1 pinta «Costo» para todos.
  - `5496bd16`: «Costo unitario» con la unidad del producto («$2,500.00 / L»).
  - `fb140780`: nuevo orden de columnas, con «Costo» al final, antes de las acciones.

  Ya está anotado como enmienda en `InventarioMovil.dc.html` (`070a8c71`). Por la regla de la
  enmienda («lo que dev trajo se conserva»), hay que integrar `origin/dev` en la rama y re-enmendar R6,
  R13 y R53 (y E1/E3 de `design.md > 12`) antes de resolver los conflictos. Con el spec actual, resolverlos
  obliga a elegir entre el spec y dev. Para cumplirlo: spec_author enmienda (y el humano aprueba), el
  implementer integra dev y adapta tests y snapshot, y `vitest related` y las guardias vuelven a verde. Es una vuelta 2 acotada.

### menor

- **m1 — Panel «Lotes»: las fechas quedan a la izquierda y el tablero las alinea a la derecha.**
  `ModalesInventario.dc.html` (l. 80) marca «Fecha de compra» y «Vencimiento» con `class="num"`. R15
  pide «cifras a la derecha», pero no prohíbe alinear también las fechas, y el spec dice que el diseño
  manda sobre lo visual. Es un incumplimiento del tablero, no un requisito del spec: falta `align: 'end'`
  en `purchaseDate` y `expiryDate` de `product-batch-columns.tsx`.
- **m2 — Orden de «Costo».** En la tabla no hay requisito de orden («columnas de hoy»). El tablero
  aprobado (`InventarioColumnasLotes`) la pone detrás de «Disponible» y dev (`fb140780`) ya la pone al
  final: se resuelve solo al integrar dev (B1). En la tarjeta, E1 fija `stock, averageUnitCost,
  qtyAlert, available`, pero el tablero de teléfono dibuja «Existencia, Alerta, Disponible, Costo».
  Recomiendo seguir el tablero y a dev en la re-enmienda de B1 (ver decisión H4).
- **m3 — Cierre de 44 px: el arreglo está bien, pero D55 no recoge el apaño local.** `showCloseButton={false}`
  más un `DialogClose` propio (`size="icon"` + `touch`) en `batch-history.tsx` y `adjust-batch-dialog.tsx`
  es correcto. Ya hay precedente (`batch-evidence-dialog.tsx`), no toca `components/ui/dialog.tsx` y
  lo destapó R42 en el E2E. Pero D55 dice que se arregla «en la primitiva, una sola vez», y el diff
  no lo amplía. Hay que ampliar D55 con estos dos cierres locales (se retiran cuando se arregle la
  primitiva) y con la X de 32 px del `Sheet` «Lotes», que este diff mantiene. R42 no nombra el panel,
  así que no es bloqueante.
- **m4 — Las tarjetas de producto tampoco tienen rótulos.** La bitácora solo lo dice de las tarjetas
  de lote y de historial, pero `DataTableCards` pinta la `meta` sin rótulo en todas. En teléfono, la
  tarjeta de producto enseña cinco cifras sueltas (presentación, existencia, costo, alerta, disponible),
  y `InventarioColumnasLotes` (teléfono) las rotula. Entra en la decisión H2.
- **m5 — Escritorio: las sub-filas de lote no tienen fondo suave ni animación de entrada.**
  El tablero aprobado `InventarioColumnasLotes` (escritorio) pide `tr.lot td{background:…;animation:qc-rise…}`.
  La bitácora solo lo anota para el teléfono. P17 decía «la ficha no cambia el aspecto de la sub-fila
  en la tabla», pero eso se escribió antes de aprobar el tablero. Entra en la decisión H3.
- **m6 — T7c sigue `[ ]`.** Solo falta `./init.sh --completo`, que según `AGENTS.md` corre el CI.
  Se marca cuando `gate-completo` salga en verde.

### No son hallazgos (el implementer siguió el spec y el spec lo pide)

- **Tarjetas a 820 px.** Lo pide R13 (supuesto P12, aprobado) y T0b lo midió: el contenedor queda
  por debajo de 760 px. La ficha de tablet («tabla con scroll») está en contra, pero P12 ya resolvió
  ese choque de forma explícita. → H1, solo para confirmar.
- **«—» en datos nulos.** R21 lo exige en el historial y es la marca de vacío del repo.
- **Sin botón «Mostrar lotes» al pie de la tarjeta.** D6/E1/E11 ponen el conmutador en la celda `name`,
  es decir, en el título de la tarjeta. Mide 44 px (`touch`), así que no rompe la regla multiplataforma. → H3.
- **Tooltip de existencia baja en la marca de aviso y no en la celda.** R7/D3 piden el `title` y el
  `sr-only` en lo que pinta `stockAmountCell`, y la marca está dentro de esa celda. El `title` de la
  celda ya lo usa la cifra exacta (R6 de un spec anterior). El test lo fija. Cumple.
- **Comentarios, duplicados, dependencias y aislamiento:** limpio.

## Decisiones humanas pendientes (no son hallazgos del implementer)

- **H1 — Tablet:** confirmar P12 (tarjetas a 820 px). Si se confirma, corregir la línea «Tablet» de
  `InventarioColumnasLotesTablet` / `InventarioTablet`; si no, re-especificar R13.
- **H2 — Rótulos en las tarjetas** (producto, lote, historial). D7/D8/E1 eligen la tarjeta de `DataTable`
  sin extensión, que no rotula. `InventarioColumnasLotes` (teléfono) y `ModalesInventario` sí rotulan.
  Se puede hacer en la ruta, con texto visible solo bajo `@max-[760px]` dentro de cada celda, sin
  tocar la pieza compartida, o extendiendo `DataTableCards` (paso 2, con fila y tablero).
- **H3 — Aspecto de las sub-filas de lote del tablero:** fondo suave, sangría y animación de 300 ms en
  escritorio y teléfono, más el botón de texto «Mostrar lotes» de 44 px al pie de la tarjeta. El spec
  (E1, D6, A8) eligió «sin extensión» y el conmutador en el título; el tablero se aprobó después y
  pide lo otro. Hay que decir cuál manda. El propio tablero dice «sin cambiar el componente
  compartido», y el fondo de la fila entera probablemente no se puede pintar sin extender `DataTable`.
- **H4 — Re-enmienda por dev (B1):** «Costo» solo para el Administrador, en moneda, con unidad y al
  final; «Presentación» fuera de la pestaña «Producto». Decidir también el orden de las cifras en la
  tarjeta (E1 o el tablero; recomiendo el tablero).
- **H5 — Paso 2 de la importación:** ya no hay forma de elegir otro archivo sin recargar (bitácora,
  tanda 5). El tablero no dibuja la zona en la vista previa y R31 prohíbe pasos clicables. Decidir si
  se añade «Elegir otro archivo» (por ejemplo, en la cabecera de «Vista previa») o se acepta.
- **H6 (menor) — Chip «Tipo»:** el tablero dice «ficha neutra» y R53 «chip con su tono» (lo de dev).
  Se siguió R53. Confirmar.

## Veredicto

**RECHAZADO** por B1. El trabajo de la rama está bien: trazabilidad completa, verificación en verde
y ninguna regla del perfil rota. Pero no se puede mergear sobre `origin/dev` sin conflictos, y el
spec contradice lo que dev ya trajo sobre «Costo» y «Presentación». Para la vuelta 2: re-enmienda
del spec (H4), integración de dev y m1 a m3. H1 a H3, H5 y H6 las decide el humano.

## Vuelta 2 (acotada a 774a293c..37ebaca5)

Rama `feature/QC-263-rediseno-inventario`, HEAD `37ebaca5`. Tras `git fetch`, `origin/dev` es
`aa1ed9d7`, que es también el merge-base: la rama está **0 commits por detrás** y 29 por delante.
Lo revisado: la enmienda 2 del spec (`cef9ba32`: R54–R59 nuevos; R6, R13, R15, R21, R32, R47, R53 y
R57 cambiados; H1–H6 y P23–P27), el merge T8a (`9f7e7b07`) y T8b–T8h (`82340ef4`, `7c085b7a`,
`cba2eb6e`, `e8c41a4b`, `197f7f57`, `37ebaca5`). MCP del grafo: no se usó; bastaron Grep/Read y `git show`.

### Verificación ejecutada (salida propia)

| Qué | Resultado |
| --- | --- |
| `git rev-list --count HEAD..origin/dev` | 0 (merge-base = `origin/dev`): no puede haber conflictos |
| `pnpm run typecheck` | sin errores |
| `pnpm run lint` | 0 errores; 10 warnings ajenos al diff, los mismos de la vuelta 1 |
| `pnpm exec vitest related --run <63 archivos de app/ y tests/ del diff>` | 60 archivos: 59 en verde y 1 rojo de archivo, `tests/unit/identity/session-once-per-request-render.test.tsx`, que solo sale con carga. Solo, pasa 12/12. 1187 passed, 15 skipped. No es del diff |
| `pnpm exec vitest run guard` | 81 archivos, 1106 passed, 20 skipped |
| Barrido de tests que leen del disco y nombran inventario o `e2e/` (135 archivos fuera de guardias) | 134 archivos en verde, 2814 passed, 92 skipped, 0 rojos. `tablas-marca`, `product-route-contract` y `scope` incluidos. El rojo de `order-columns` que anotó T8a ya no aparece |
| `pnpm exec playwright test e2e/inventario-rediseno.spec.ts --project=chromium` | **15 passed** (50 s) |

### Checklist

- [x] **B1 resuelto.** La rama está al día con `origin/dev`. Los seis conflictos de T8a se
  resolvieron según F1, como se lista en la bitácora. El spec se re-enmendó contra lo que trajo dev
  (H4: «Costo unitario» solo con `canViewUnitCosts`, en moneda con unidad, exacto en `title`, al final;
  sin «Presentación» en «Producto»).
- [x] **Trazabilidad R1–R59.** Comprobado por título de test en cada archivo de `tasks.md > Trazabilidad`.
  - Cada R nuevo o cambiado tiene al menos un test unitario y un caso E2E con su número: R54 (`product-batch-rows`,
    `product-cards`, `product-type-column`, E2E con Operador), R55 (`product-cards`,
    `finished-stock-table`, E2E), R56 (`product-batches-panel`, `batch-history`, E2E), R57
    (`product-batch-rows`, E2E con fondo, sangría, animación y movimiento reducido), R58 (`product-cards`,
    E2E con 44 px) y R59 (`import-preview`, `inventory-import-screen`, E2E con marcador en `window`).
  - Los tests de R55 que leí comparan texto, posición y contención del rótulo frente a la cifra:
    no son tests vacíos.
  - R1–R53 siguen como en la vuelta 1.
- [~] **Tasks.** T8a–T8h están `[x]`. T7c sigue `[ ]` («se cierra dentro de T8h»), y T8h está `[x]` aunque su
  *Hecho* pide `gate-completo` en verde en el PR, que aún no existe → m10.
- [x] **`## Lo que ya existe`.** Presente. El diff no re-crea nada: `card-field-label.tsx` es interno de la
  ruta y no existe ningún rótulo de tarjeta en `components/shared` ni en `CATALOGO.md`. Queda
  justificado en A12 y como deuda D63.
- [x] **Dependencias.** El diff contra `origin/dev` no toca `package.json`, `components/`, `lib/`,
  `hooks/` ni `db/`.
- [x] **Multiplataforma.** Ni `100vh`, ni `:hover` como única vía. Botones nuevos a 44 px:
  `product-batches-card-toggle` e `inventory-import-choose-another`, los dos `touch`, medidos en el E2E.
  Animación detrás de `motion-safe`.
- [x] **Catálogo y diseño.** `DataTable` y `DataTableCards` sin cambios. Los tableros
  `InventarioColumnasLotes*` y `ModalesInventario` están citados en F3–F6.
- [x] **Aislamiento y seguridad.** Sin modelos ni consultas nuevas. El no-envío del costo es el de dev
  (`unit-cost-visibility.test.ts`, en verde).
- [ ] **Comentarios (punto 9):** un comentario nuevo cita un `R<n>` → B2.
- [x] **Menores de la vuelta 1.**
  - m1 resuelto (T8e: fechas `align: 'end'`).
  - m2 resuelto (orden de dev en la tabla y del tablero en la tarjeta).
  - m3 resuelto (D55 ampliada con los dos cierres locales y la X del `Sheet`).
  - m4 resuelto (R55 y R56).
  - m5 resuelto (R57).
  - m6 sigue → m10.
- [ ] `gate-completo` en CI: pendiente, no hay PR.

### Desvíos anotados por el implementer

| # | Desvío | Clasificación |
| --- | --- | --- |
| d1 | Clave `unitCost` en vez de `cost` en `PRODUCT_CARD_LABELS` | **Aceptado.** `product-route-contract.test.ts` prohíbe `.cost` en la ruta (el producto no tiene ese campo) y el texto visible es el mismo. Menor documental: F3 de `design.md` sigue diciendo `cost` → m7 |
| d2 | `some` en vez de `filter(` para contar las columnas del esqueleto | **No es hallazgo.** El diseño no fija la forma y lo exige la misma guardia de ruta |
| d3 | Columna `batchesToggle` justo después de la imagen, oculta en la tabla | **Aceptado.** F4 no fija la posición. Con `display:none` en `th` y `td`, su botón sale del orden de tabulación y su menú de cabecera no se ve. `pinnable: false`, y el divisor de la última columna no cambia. Así se respetan la caída fijada a la derecha y el caso de dev «Costo unitario justo antes de las acciones» |
| d4 | «—» con rótulo en la tarjeta (alerta, costo, motivo, pedido…) | **Aceptado**, coincide con F3 («donde la celda devuelve `null` no hay rótulo»). Una raya sin rótulo no se entendería en la tarjeta. Pero el texto de R55 («sin rótulo donde la celda no pinta cifra») se puede leer al revés → m8, aclaración del spec |
| d5 | Fondo `color-mix(in oklch, var(--muted) 55%, var(--card))` en vez de `bg-muted/55` en las celdas de sub-fila, solo en `PRODUCT_TABLE_SCOPE_CLASS` | **Aceptado, y es un arreglo correcto.** Es el valor del tablero y lo destapó el E2E: con `/55`, las celdas fijadas eran translúcidas al desplazar. R57 se cumple y `DataTable` no cambia. Menores: F5 de `design.md` sigue diciendo `bg-muted/55` → m7; el arreglo de producción va en un commit `test(...)` (`e8c41a4b`) → m9 |

### Hallazgos

#### BLOQUEANTE

- **B2 — Comentario que cita un requisito en código de producción (perfil, punto 9).**
  `app/(private)/inventario/importar/components/import-preview-summary.tsx:125`, añadido en `82340ef4`:
  `/** «Elegir otro archivo»: vuelve al paso 1 sin importar nada (R59). */`. Para cumplirlo, quitar
  «(R59)» (el resto del comentario puede quedarse). Es el único caso: busqué `QC-<n>`, `R<n>`,
  `design.md` y «decisión cerrada» en todas las líneas de comentario añadidas en `app/`.

#### menor

- **m7 — `design.md` desfasado de lo implementado en dos puntos.** F3 nombra la clave `cost` (es
  `unitCost`, d1) y F5 el fondo `bg-muted/55` (es el `color-mix` opaco, d5). Que spec_author corrija el texto.
- **m8 — R55 dice dos cosas que el diseño y el tablero no hacen.**
  - Incluye «Reservado» entre los rótulos de la tarjeta de sub-fila. Ni F3 («"Reservado" no sale en
    su tarjeta; el tablero tampoco lo pinta») ni `InventarioColumnasLotesMovil` lo pintan, y la `meta`
    no lo incluye. El implementer siguió el diseño y el tablero. Por eso `PRODUCT_CARD_LABELS.reserved`
    no se usa en producción (solo lo afirma un test).
  - «Sin rótulo donde la celda no pinta cifra» admite la lectura de d4.
  - Para cumplirlo: spec_author ajusta el texto de R55 (quitar «Reservado» de la sub-fila y precisar
    «donde la celda no pinta nada»), y el implementer quita la clave `reserved` sin uso o la deja si
    el humano quiere «Reservado» en la tarjeta del lote.
- **m9 — Commit con el tipo equivocado.** `e8c41a4b` es `test(QC-263)` pero cambia producción
  (`product-table.tsx`, fondo opaco). Se anota; no hace falta reescribir la historia.
- **m10 — T7c sigue `[ ]` y T8h está `[x]` sin su *Hecho*.** El *Hecho* de T8h es «`gate-completo` en
  verde en el PR». Cerrar las dos cuando el CI salga verde, o desmarcar T8h hasta entonces.

### Decisiones humanas pendientes

- Ninguna nueva que bloquee. H1–H6 quedaron cerradas en la enmienda 2.
- Solo m8 pide una palabra del humano: ¿«Reservado» va en la tarjeta del lote en teléfono? El
  tablero y F3 dicen que no; R55, que sí. Si no va, es una corrección de texto del spec.

### Veredicto (vuelta 2)

**RECHAZADO** solo por B2: hay que quitar «(R59)» de un comentario. B1 está resuelto. Trazabilidad
R1–R59 completa y verificación en verde: typecheck, lint, `vitest related`, guardias, barrido de
disco y el E2E `inventario-rediseno` en Chromium (15/15). Los cinco desvíos del implementer quedan
aceptados. La vuelta 3 puede limitarse al diff que arregle B2, con m7, m8 y m10 recogidos en el
spec y en `tasks.md`.
