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
