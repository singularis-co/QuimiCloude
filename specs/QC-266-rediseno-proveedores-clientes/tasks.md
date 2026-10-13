# QC-266 — rediseno-proveedores-clientes · tasks.md

Verificación de cada tanda (`docs/perfil-agentes.md > Todos los agentes`): `pnpm run typecheck`,
`pnpm run lint`, `pnpm exec vitest related --run <archivos de la tanda>` y
`pnpm exec vitest run guard`. Los E2E se corren por spec (`pnpm exec playwright test <spec>`) en la
tanda 7, que cierra con `./init.sh --completo` (lección de QC-261 y QC-265: el gate rápido no ve las
listas cerradas sin relación con el diff).

`[P]` = puede ir en paralelo con las otras `[P]` de su tanda. Antes de la tanda 1, el humano cierra
P1–P15 de `requirements.md` (o acepta los valores por defecto) y, con P1 por defecto, QC-262 y QC-264
están en `dev` y esta rama está rebasada sobre ellas.

## Tanda 0 — Censo y medidas (antes de tocar producción)

- [ ] **T0a. Censo con grep.** En `tests/unit`, `tests/ui`, `tests/guards`, `tests/integration` y `e2e`,
  cada símbolo, texto o testid que la ficha cambia o duplica: `supplier-detail-link`, «Ver el detalle
  de», «Ver ficha del proveedor», `supplier-showcase-row-empty`, `supplier-showcase-row-load-more`,
  `showcase-line-card`, `proveedores-title`, `supplier-edit-open`, `supplier-delete-open`,
  `delete-supplier-cascade`, `catalog-line-create-open`, `catalog-line-row-actions`,
  `data-catalog-line-id`, `CatalogLineRowActions`, `rowActions`, `catalog-import-row-kind`,
  `catalog-import-row-included`, «Incluir», `catalog-import-row-change-image`, «Cambiar»,
  `catalog-import-summary-back-link`, `customer-create-open`, `customer-row-actions`,
  `data-customer-id`, `CustomerRowActions`, `toolbarActions`, `data-table-row-`, `data-table-card`.
  Marcar los localizadores de página entera que con tarjetas encuentran dos elementos. Comprobar si
  `separatorBefore` (QC-262) y `triggerDataAttributes` en `RowActionsSpec` ya están en `dev`.
  *Hecho:* `progress/impl_QC-266.md` tiene la tabla «archivo → qué nombra → qué le pasa» y el estado
  de las dos piezas; todo archivo que salga y no esté en `## Archivos esperados` se añade a esa
  sección en el mismo commit.
- [ ] **T0b. Medidas.** Con el servidor de desarrollo, a 390 × 844: los tres paneles y los cuatro
  diálogos de la ficha (¿enteros?, ¿pie visible?) y el ancho del contenedor de las listas a 820 px
  (¿cae bajo 760 px?, P8). *Hecho:* lo medido queda en el impl; si difiere de `design.md > D11`, se
  anota como desviación antes de la tanda 5.

## Tanda 1 — Piezas compartidas (depende de T0a)

- [ ] **T1a. Separador** (R38). Con P1 por defecto: solo verificar que `separatorBefore` está y que su
  test (`row-actions-menu-separator.test.tsx`) pasa. Si P1 cambia: implementarlo con el contrato de
  QC-262 D7 y ese mismo test (con la prop hay `role="separator"` antes del ítem en las dos
  presentaciones; nunca delante del primero; sin la prop, `row-actions-menu-centrado.test.tsx` y
  `row-actions-menu-href.test.tsx` sin cambios).
- [ ] **T1b [P]. `triggerDataAttributes` en `RowActionsSpec`** (D6), solo si T0a dice que falta.
  *Hecho:* `typecheck` verde y los consumidores de hoy sin cambios.
- [ ] **T1c [P]. Disparador de edición de `SupplierSheet`** (D10, R39). Test en
  `tests/unit/shared/supplier-sheet.test.tsx`: en edición, contorno con lápiz y «Editar», `aria-label`
  y testid de hoy; el alta igual. Snapshot de `formularios-paridad` (fila de `design.md > 6`).
- [ ] **T1d. Catálogo** (R40; depende de T1a–T1c). Filas de `SupplierSheet` (`Diseño` +
  `ProveedorDetalle.dc.html`) y, si T1a/T1b tocaron algo, de `RowActionsMenu` y `DataTable`. *Hecho:*
  `pnpm exec vitest run guard-catalogo-de-componentes catalogo-qc256` en verde.

## Tanda 2 — Vitrina (depende de T0a) [P con 1]

- [ ] **T2a [P]. Cabecera y barra** (D1, R1, R2). `proveedores/page.tsx`,
  `supplier-showcase-filters.tsx`. Si `TOUCH_TARGET` sale, su fila de `guard-piezas-base` sale en el
  mismo commit.
- [ ] **T2b [P]. Tarjeta de proveedor, tira y vacíos** (D2, R3–R5, R7, R8, R10). `supplier-showcase-row.tsx`,
  `supplier-showcase-section.tsx`, `supplier-showcase-params.ts` (`showcaseCountLabel`).
- [ ] **T2c [P]. Tarjeta de producto** (D3, R5, R6). `showcase-line-card.tsx`.
- [ ] **T2d. Lista general** (D2, R9; depende de T2b). `supplier-showcase-list.tsx`,
  `supplier-showcase-skeleton.tsx`; `showcase-load-trigger.tsx` sin tocar.
- [ ] **T2e. Tests** (depende de T2a–T2d). Nuevo `tests/unit/proveedores-ui/supplier-showcase-rediseno.test.tsx`:
  un `h1`, alta en la cabecera, barra con nombre y campos por etiqueta, `article` por proveedor con `h2`,
  «Ver ficha del proveedor <nombre>» con `href` del detalle y sin enlace en el nombre, cuenta
  («1 producto», «N+ productos»), «Cargar más» al final de la tira con su nombre y tooltip, vacío sin
  enlace, «Cargar más» visible que pide la página siguiente una sola vez aunque el centinela dispare a
  la vez, esqueleto con `aria-busy`, caja de error con «Reintentar», los dos vacíos con icono; clases
  `hover:` en la tarjeta de producto y ningún hijo condicionado por hover. Tests de `design.md > 7`
  actualizados; `guard-convenciones-showcase` en verde; snapshot de `proveedores-paridad`.

## Tanda 3 — Detalle del proveedor (depende de T1)

- [ ] **T3a. Cabecera, vuelta y no encontrado** (D4, D5, R11–R13, R17–R19). `[id]/page.tsx`,
  `supplier-detail-header.tsx`, `delete-supplier-dialog.tsx`, `supplier-not-found.tsx`,
  `catalog-list-section.tsx` (sin el alta de encima), `catalog-table.tsx` (vacío sin alta). Test nuevo
  `tests/unit/proveedores-ui/supplier-detail-header.test.tsx`: vuelta con flecha a la lista, un `h1`,
  contacto con sus testids y la marca de vacío, las cuatro acciones en orden con «Subir PDFs» solo con
  permiso, «Dar de baja <nombre>», `Notice` `warning` en el diálogo, no encontrado con `role="alert"` y
  su vuelta con flecha. `supplier-detail-page.test.tsx`, `catalog-pdf-upload.test.tsx` y
  `supplier-detail-upload.test.tsx` actualizados.
- [ ] **T3b. Menú como datos y anfitrión** (D6, R14, R16; depende de T3a). `catalog-line-row-actions.tsx`,
  `catalog-columns.tsx`, `catalog-table.tsx`, `index.ts`. Test nuevo
  `tests/unit/proveedores-ui/catalog-row-actions.test.tsx`: orden «Editar», separador, «Dar de baja»
  destructivo, `triggerLabel`, `title`, testids de hoy y `data-catalog-line-id` en la fila; cada ítem
  abre su panel o diálogo para su línea, nunca dos, el cerrado sigue montado para animar.
  `catalog-columns.test.tsx`, `catalog-line-sheet.test.tsx`, `delete-catalog-line-dialog.test.tsx`,
  `confirm-dialog-montado.test.tsx` actualizados.
- [ ] **T3c. Tarjetas** (D7, R13, R15; depende de T3b). `catalog-table.tsx`. Test nuevo
  `tests/unit/proveedores-ui/catalog-cards.test.tsx` (con el helper de viewport heredado): tarjeta con
  imagen, costo, nombre y los datos del R15, «Acciones» que abre el diálogo centrado con el nombre e
  ítems de 48 px; vacío sin segundo «Nueva línea». Snapshots de `catalogo-paridad`,
  `acciones-por-fila` y `confirmaciones-paridad` (filas de `design.md > 6`).

## Tanda 4 — Revisión del catálogo (depende de T0a) [P con 3]

- [ ] **T4a [P]. Cabecera** (D8, R20). `importar/[documentoId]/page.tsx`.
- [ ] **T4b [P]. Filas, tonos y selector** (D8, R21–R23, R27). `catalog-import-row.tsx` (`KIND_TONES`),
  `crop-picker.tsx`, `components/index.ts`.
- [ ] **T4c [P]. Unidades, barra y resumen** (D8, R24–R26). `new-presentation-units.tsx`,
  `catalog-import-review.tsx`, `catalog-import-summary.tsx`.
- [ ] **T4d. Tests** (depende de T4a–T4c). Nuevo `tests/unit/proveedores-ui/catalog-import-rediseno.test.tsx`:
  vuelta con flecha, miga con el proveedor enlazado y el paso actual, un `h1`, «N filas leídas» (y «1
  fila leída»); por fila, casilla «Incluir fila N» de 44 px sin etiqueta visible, «Fila N», tono de cada
  clase (tabla del R22) con `data-kind`, opacidad al excluir y vuelta a incluir; selector con «Elige una
  imagen del archivo», «Fila N», «Recorte del archivo n», el elegido marcado y «Cancelar»; bloque de
  unidades en tarjeta; barra `sticky` con «Confirmando…» y giro; resumen con sus cuatro cifras y vuelta
  con flecha. `catalog-import-review.test.tsx` y `catalog-import-page.test.tsx` actualizados.

## Tanda 5 — Clientes (depende de T1) [P con 3 y 4]

- [ ] **T5a. Cabecera** (D9, R28). `clientes/page.tsx`, `customer-table.tsx` (sin `toolbarActions`).
  Test nuevo `tests/unit/clientes-ui/clientes-page-header.test.tsx`: un `h1` con su testid; «Nuevo
  cliente» dentro de `page-header-actions` solo con permiso y nunca en la barra de la tabla.
- [ ] **T5b. Menú como datos y anfitrión** (D9, R30, R32; depende de T5a). `customer-row-actions.tsx`,
  `customer-columns.tsx`, `customer-table.tsx`, `customer-labels.ts`, `index.ts`. Test nuevo
  `tests/unit/clientes-ui/customer-row-actions.test.tsx`: orden con separador y «Eliminar» destructivo,
  sin permiso ningún ítem ni «Acciones», cada ítem abre su panel o diálogo para su cliente, nunca dos;
  `editCustomerLabel` y `deleteCustomerLabel` siguen exportadas.
- [ ] **T5c. Tarjetas y vacío** (D9, R29, R31, R33; depende de T5b). Test nuevo
  `tests/unit/clientes-ui/customer-cards.test.tsx`: tarjeta con los siete datos y «Acciones» que abre
  el diálogo centrado con el nombre completo; buscador, orden, paginación y los cinco estados como hoy;
  vacío con icono y alta con permiso. Tests de `design.md > 7` de `clientes-ui` acotados al cuerpo
  visible. Snapshots de `clientes-paridad` y `acciones-por-fila`.

## Tanda 6 — Modales y avisos (depende de T3, T4, T5)

- [ ] **T6a [P]. Paneles y diálogos en teléfono** (D11, R34, R35). Solo si T0b encontró algo: la clase
  del panel en la ruta. Tests de los paneles y diálogos con sus textos de hoy (R35) en
  `catalog-line-sheet.test.tsx`, `customer-sheet.test.tsx`, `delete-catalog-line-dialog.test.tsx`,
  `delete-customer-dialog.test.tsx`, `supplier-sheet.test.tsx`.
- [ ] **T6b [P]. Avisos emergentes** (D12, R36, R37). Tests nuevos
  `tests/unit/proveedores-ui/proveedores-toasts.test.tsx` y `tests/unit/clientes-ui/clientes-toasts.test.tsx`:
  cada éxito lanza un único `toast.success` con su texto; un error no lanza ninguno; confirmar una
  importación no lanza ninguno.
- [ ] **T6c [P]. Guardia** (D13, R43). `tests/guards/guard-proveedores-clientes-rediseno.test.ts`, con
  un caso sobre fuente fabricada que demuestra que muerde.

## Tanda 7 — E2E y cierre (depende de todas)

- [ ] **T7a. E2E nuevo** `e2e/proveedores-clientes-rediseno.spec.ts` con los casos de `design.md > 7`
  (R3, R6, R7, R11, R12, R14, R15, R20, R23, R25, R28, R30, R31, R34, R42) a 1440 × 900 y 390 × 844, y
  sus altas en `E2E_ESPERADOS` de `tests/guards/guard-identificador-de-request.test.ts` y en la lista
  cerrada de `tests/unit/shared/data-table-alcance.test.ts`, con el comentario «Alta el <fecha>
  (QC-266) por el MISMO motivo y en el MISMO sitio que las demas: la lista es CERRADA y darse de alta
  en ella es su punto de extension por diseno. El ancla NO se relaja -el archivo se nombra, uno a uno-.
  Lo que ejercita: …». *Hecho:* pasa en Chromium y WebKit; las dos guardias en verde.
- [ ] **T7b. E2E existentes** (R41). Acotar a `data-table-row-<id>` los localizadores de página que T0a
  marcó en `e2e/clientes.spec.ts`, `movimiento.spec.ts`, `pedido-con-cliente.spec.ts` y los que salgan;
  `proveedores.spec.ts`, `aislamiento-proveedores.spec.ts`, `catalogo-desde-pdf.spec.ts` y
  `documentos.spec.ts` pasan con los testids conservados. *Hecho:* cada spec tocado pasa por separado.
- [ ] **T7c. Deudas y cierre.** `progress/deudas.md`: D53 ampliada al catálogo y a Clientes; nuevas de
  P2, P9, P10 y P14 si quedan por defecto. `./init.sh --completo` en verde.

## Trazabilidad R → test

| R | Test |
| --- | --- |
| R1, R2 | `tests/unit/proveedores-ui/supplier-showcase-rediseno.test.tsx`, `tests/unit/proveedores-ui/supplier-showcase-filters.test.tsx` (R2) |
| R3, R4, R5 | `tests/unit/proveedores-ui/supplier-showcase-rediseno.test.tsx`, `e2e/proveedores-clientes-rediseno.spec.ts` |
| R6 | `tests/unit/proveedores-ui/supplier-showcase-rediseno.test.tsx`, `e2e/proveedores-clientes-rediseno.spec.ts` |
| R7, R8 | `tests/unit/proveedores-ui/supplier-showcase-rediseno.test.tsx`, `tests/unit/proveedores-ui/supplier-showcase-row.test.tsx` |
| R9 | `tests/unit/proveedores-ui/supplier-showcase-rediseno.test.tsx`, `tests/unit/proveedores-ui/supplier-showcase-list.test.tsx`, `tests/unit/proveedores-ui/guard-convenciones-showcase.test.ts` |
| R10 | `tests/unit/proveedores-ui/supplier-showcase-rediseno.test.tsx`, `tests/unit/proveedores-ui/supplier-showcase-page.test.tsx` |
| R11, R12, R17, R18, R19 | `tests/unit/proveedores-ui/supplier-detail-header.test.tsx`, `tests/unit/documentos-ui/supplier-detail-upload.test.tsx` (R19), `e2e/proveedores-clientes-rediseno.spec.ts` (R11, R12) |
| R13, R15 | `tests/unit/proveedores-ui/catalog-cards.test.tsx`, `e2e/proveedores-clientes-rediseno.spec.ts` (R15) |
| R14, R16 | `tests/unit/proveedores-ui/catalog-row-actions.test.tsx`, `e2e/proveedores-clientes-rediseno.spec.ts` (R14) |
| R20–R27 | `tests/unit/proveedores-ui/catalog-import-rediseno.test.tsx`, `e2e/proveedores-clientes-rediseno.spec.ts` (R20, R23, R25), `e2e/catalogo-desde-pdf.spec.ts` (R22) |
| R28 | `tests/unit/clientes-ui/clientes-page-header.test.tsx`, `e2e/proveedores-clientes-rediseno.spec.ts` |
| R29, R31, R33 | `tests/unit/clientes-ui/customer-cards.test.tsx`, `e2e/proveedores-clientes-rediseno.spec.ts` (R31) |
| R30, R32 | `tests/unit/clientes-ui/customer-row-actions.test.tsx`, `e2e/proveedores-clientes-rediseno.spec.ts` (R30) |
| R34 | `e2e/proveedores-clientes-rediseno.spec.ts` |
| R35 | `tests/unit/proveedores-ui/catalog-line-sheet.test.tsx`, `tests/unit/proveedores-ui/delete-catalog-line-dialog.test.tsx`, `tests/unit/clientes-ui/customer-sheet.test.tsx`, `tests/unit/clientes-ui/delete-customer-dialog.test.tsx`, `tests/unit/shared/supplier-sheet.test.tsx` |
| R36, R37 | `tests/unit/proveedores-ui/proveedores-toasts.test.tsx`, `tests/unit/clientes-ui/clientes-toasts.test.tsx` (R36) |
| R38 | `tests/unit/shared-ui/row-actions-menu-separator.test.tsx` |
| R39 | `tests/unit/shared/supplier-sheet.test.tsx` |
| R40 | `tests/guards/guard-catalogo-de-componentes.test.ts`, `tests/unit/shared-ui/catalogo-qc256.test.ts` |
| R41 | `tests/unit/paridad/proveedores-paridad.test.tsx`, `tests/unit/paridad/catalogo-paridad.test.tsx`, `tests/unit/paridad/clientes-paridad.test.tsx`, `tests/unit/proveedores-ui/supplier-route-contract.test.ts`, `tests/unit/proveedores-ui/catalog-route-contract.test.ts`, `tests/unit/clientes-ui/customers-route-contract.test.ts`, `e2e/proveedores.spec.ts`, `e2e/catalogo-desde-pdf.spec.ts`, `e2e/clientes.spec.ts` |
| R42 | `e2e/proveedores-clientes-rediseno.spec.ts` |
| R43 | `tests/guards/guard-proveedores-clientes-rediseno.test.ts` |

## Archivos esperados

Producción:

- `app/(private)/proveedores/page.tsx`
- `app/(private)/proveedores/components/index.ts`
- `app/(private)/proveedores/components/supplier-showcase-filters.tsx`
- `app/(private)/proveedores/components/supplier-showcase-section.tsx`
- `app/(private)/proveedores/components/supplier-showcase-list.tsx`
- `app/(private)/proveedores/components/supplier-showcase-row.tsx`
- `app/(private)/proveedores/components/supplier-showcase-params.ts`
- `app/(private)/proveedores/components/supplier-showcase-skeleton.tsx`
- `app/(private)/proveedores/components/showcase-line-card.tsx`
- `app/(private)/proveedores/[id]/page.tsx`
- `app/(private)/proveedores/[id]/components/index.ts`
- `app/(private)/proveedores/[id]/components/supplier-detail-header.tsx`
- `app/(private)/proveedores/[id]/components/supplier-not-found.tsx`
- `app/(private)/proveedores/[id]/components/delete-supplier-dialog.tsx`
- `app/(private)/proveedores/[id]/components/catalog-list-section.tsx`
- `app/(private)/proveedores/[id]/components/catalog-table.tsx`
- `app/(private)/proveedores/[id]/components/catalog-columns.tsx`
- `app/(private)/proveedores/[id]/components/catalog-line-row-actions.tsx`
- `app/(private)/proveedores/[id]/components/catalog-line-sheet.tsx`
- `app/(private)/proveedores/[id]/components/delete-catalog-line-dialog.tsx`
- `app/(private)/proveedores/[id]/components/catalog-pdf-upload.tsx`
- `app/(private)/proveedores/[id]/importar/[documentoId]/page.tsx`
- `app/(private)/proveedores/[id]/importar/[documentoId]/components/index.ts`
- `app/(private)/proveedores/[id]/importar/[documentoId]/components/catalog-import-review.tsx`
- `app/(private)/proveedores/[id]/importar/[documentoId]/components/catalog-import-row.tsx`
- `app/(private)/proveedores/[id]/importar/[documentoId]/components/catalog-import-summary.tsx`
- `app/(private)/proveedores/[id]/importar/[documentoId]/components/crop-picker.tsx`
- `app/(private)/proveedores/[id]/importar/[documentoId]/components/new-presentation-units.tsx`
- `app/(private)/clientes/page.tsx`
- `app/(private)/clientes/components/index.ts`
- `app/(private)/clientes/components/customer-table.tsx`
- `app/(private)/clientes/components/customer-columns.tsx`
- `app/(private)/clientes/components/customer-row-actions.tsx`
- `app/(private)/clientes/components/customer-labels.ts`
- `app/(private)/clientes/components/customer-sheet.tsx`
- `app/(private)/clientes/components/delete-customer-dialog.tsx`
- `app/(private)/clientes/components/customer-list-section.tsx`
- `components/shared/supplier/supplier-sheet.tsx`
- `components/shared/row-actions-menu.tsx` (solo si P1 cambia y QC-262 no está en `dev`)
- `components/shared/data-table/data-table-types.ts` (solo si falta `triggerDataAttributes` en `RowActionsSpec`)
- `components/shared/CATALOGO.md`

Tests y guardias:

- `tests/unit/proveedores-ui/supplier-showcase-rediseno.test.tsx`
- `tests/unit/proveedores-ui/supplier-detail-header.test.tsx`
- `tests/unit/proveedores-ui/catalog-row-actions.test.tsx`
- `tests/unit/proveedores-ui/catalog-cards.test.tsx`
- `tests/unit/proveedores-ui/catalog-import-rediseno.test.tsx`
- `tests/unit/proveedores-ui/proveedores-toasts.test.tsx`
- `tests/unit/proveedores-ui/supplier-showcase-row.test.tsx`
- `tests/unit/proveedores-ui/supplier-showcase-page.test.tsx`
- `tests/unit/proveedores-ui/supplier-showcase-list.test.tsx`
- `tests/unit/proveedores-ui/supplier-showcase-filters.test.tsx`
- `tests/unit/proveedores-ui/supplier-showcase-params.test.ts`
- `tests/unit/proveedores-ui/showcase-line-card.test.tsx`
- `tests/unit/proveedores-ui/supplier-detail-page.test.tsx`
- `tests/unit/proveedores-ui/catalog-columns.test.tsx`
- `tests/unit/proveedores-ui/catalog-line-sheet.test.tsx`
- `tests/unit/proveedores-ui/delete-catalog-line-dialog.test.tsx`
- `tests/unit/proveedores-ui/catalog-pdf-upload.test.tsx`
- `tests/unit/proveedores-ui/catalog-import-review.test.tsx`
- `tests/unit/proveedores-ui/catalog-import-page.test.tsx`
- `tests/unit/proveedores-ui/supplier-route-contract.test.ts`
- `tests/unit/proveedores-ui/catalog-route-contract.test.ts`
- `tests/unit/proveedores-ui/guard-convenciones-showcase.test.ts`
- `tests/unit/documentos-ui/supplier-detail-upload.test.tsx`
- `tests/unit/clientes-ui/clientes-page-header.test.tsx`
- `tests/unit/clientes-ui/customer-row-actions.test.tsx`
- `tests/unit/clientes-ui/customer-cards.test.tsx`
- `tests/unit/clientes-ui/clientes-toasts.test.tsx`
- `tests/unit/clientes-ui/clientes-page.test.tsx`
- `tests/unit/clientes-ui/customer-table.test.tsx`
- `tests/unit/clientes-ui/customer-columns.test.tsx`
- `tests/unit/clientes-ui/customer-list-section.test.tsx`
- `tests/unit/clientes-ui/customer-list-empty.test.tsx`
- `tests/unit/clientes-ui/customer-list-error.test.tsx`
- `tests/unit/clientes-ui/customer-list-skeleton.test.tsx`
- `tests/unit/clientes-ui/clientes-viewport.test.tsx`
- `tests/unit/clientes-ui/customer-sheet.test.tsx`
- `tests/unit/clientes-ui/delete-customer-dialog.test.tsx`
- `tests/unit/clientes-ui/clientes-convenciones.test.ts`
- `tests/unit/clientes-ui/customers-route-contract.test.ts`
- `tests/unit/shared/supplier-sheet.test.tsx`
- `tests/unit/shared-ui/confirm-dialog-montado.test.tsx`
- `tests/unit/shared-ui/catalogo-qc256.test.ts`
- `tests/unit/shared-ui/row-actions-menu-separator.test.tsx` (solo si P1 cambia)
- `tests/unit/shared-ui/row-actions-menu-centrado.test.tsx` (solo si P1 cambia)
- `tests/unit/paridad/proveedores-paridad.test.tsx`
- `tests/unit/paridad/__snapshots__/proveedores-paridad.test.tsx.snap`
- `tests/unit/paridad/catalogo-paridad.test.tsx`
- `tests/unit/paridad/__snapshots__/catalogo-paridad.test.tsx.snap`
- `tests/unit/paridad/clientes-paridad.test.tsx`
- `tests/unit/paridad/__snapshots__/clientes-paridad.test.tsx.snap`
- `tests/unit/paridad/acciones-por-fila.test.tsx`
- `tests/unit/paridad/__snapshots__/acciones-por-fila.test.tsx.snap`
- `tests/unit/paridad/confirmaciones-paridad.test.tsx`
- `tests/unit/paridad/__snapshots__/confirmaciones-paridad.test.tsx.snap`
- `tests/unit/paridad/formularios-paridad.test.tsx`
- `tests/unit/paridad/__snapshots__/formularios-paridad.test.tsx.snap`
- `tests/unit/paridad/campos-paridad.test.tsx`
- `tests/unit/paridad/__snapshots__/campos-paridad.test.tsx.snap`
- `tests/unit/paridad/buscadores-paridad.test.tsx`
- `tests/unit/paridad/__snapshots__/buscadores-paridad.test.tsx.snap`
- `tests/guards/guard-proveedores-clientes-rediseno.test.ts`
- `tests/guards/guard-piezas-base.test.ts`
- `tests/guards/guard-catalogo-de-componentes.test.ts`
- `tests/guards/guard-identificador-de-request.test.ts`
- `tests/unit/shared/data-table-alcance.test.ts` (lista cerrada de E2E que nombran `data-table`; alta de QC-266)

E2E:

- `e2e/proveedores-clientes-rediseno.spec.ts`
- `e2e/proveedores.spec.ts`
- `e2e/aislamiento-proveedores.spec.ts`
- `e2e/catalogo-desde-pdf.spec.ts`
- `e2e/documentos.spec.ts`
- `e2e/clientes.spec.ts`
- `e2e/movimiento.spec.ts`
- `e2e/pedido-con-cliente.spec.ts`
- `e2e/entregar-producto-terminado.spec.ts`
- `e2e/anular-entrega.spec.ts`
- `e2e/marca-componentes.spec.ts`

Estado:

- `progress/impl_QC-266.md`
- `progress/deudas.md`
- `progress/features/QC-266.md`
