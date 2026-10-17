# QC-263 — rediseno-inventario · bitácora de implementación

## Tanda 0 (+ comprobación de la tanda 1) — 2026-10-16 · frontend_dev

Rama `feature/QC-263-rediseno-inventario` en `d8b82a1d` (merge de `origin/dev` de hoy). No se ha
tocado código de producción ni tests.

### Archivos creados / modificados

- `progress/impl_QC-263.md` (creado)
- `specs/QC-263-rediseno-inventario/tasks.md`: T0a, T0b, T1a y T1b marcadas; nuevas entradas en
  `## Archivos esperados`

### Mapa R → test

Esta tanda no cubre ningún requisito. R14 (separador) y R44 (catálogo) ya los cubren los tests que
dejó QC-262: `tests/unit/shared-ui/row-actions-menu-separator.test.tsx` y
`tests/guards/guard-catalogo-de-componentes.test.ts` + `tests/unit/shared-ui/catalogo-qc256.test.ts`
(salida abajo).

---

## T0a — Censo con grep

Barrido con `grep -rlF` de los 25 términos de `tasks.md > T0a` en `tests/unit`, `tests/guards`,
`tests/integration` y `e2e`, más `routerMock.push` y `text-destructive` acotados a inventario.
Los términos `product-batch-` y `product-stock` también casan con nombres de módulos y de archivos
(`product-batch-repository`, `domain/product-stock.ts`…); se miró cada caso en su línea.

**Sin resultados en ningún test:** `ProductTypeTabs`, `onNavigate`, `Elegi un motivo`,
`Conteo fisico`, `inventory-import-back-link`, `ImportStatusLabel`, `Todas (`. Los tests de
importación nombran el back link y la plantilla por constante (`IMPORT_BACK_LINK_TESTID`…), y
ninguno la afirma hoy. `Mostrando todos los tipos` y `Filtrando por` solo salen en el snapshot de
`inventario-paridad`.

### Tabla archivo → qué nombra → qué le pasa

**Afectados (cambian en alguna tanda):**

| Archivo | Qué nombra | Qué le pasa |
| --- | --- | --- |
| `tests/unit/inventario/product-page.test.tsx` | `product-row-actions`, `product-stock`, `data-table-cell-name`, `data-alert`, `routerMock.push` (R5 de la pestaña) | T2b: R5 pasa a afirmar el `href`. T2c: R17 «en rojo» pasa a ámbar. T3: menú de cinco ítems y celdas duplicadas por la tarjeta (se acota al cuerpo visible). |
| `tests/unit/inventario/finished-stock-table.test.tsx` | `product-row-actions`, `product-stock` | T3b/T3c: menú por línea, `card`, aviso ámbar |
| `tests/unit/inventario/product-batches-panel.test.tsx` | `ProductBatchesPanel`, `renderBatchDetail`, `renderBatchActions`, `product-batch-*` (incluidos `-line-lot`, `-line-amounts`, `-line-dates`, `-expiry-relative` y `-expired`, nuevos de dev), `text-destructive` | T4a: pasa a tabla con `batchMenu`. Las aserciones de las tres líneas (ccde16f7) y del vencimiento relativo (08b69744) son posteriores al spec: ver la sección de cambios de dev. |
| `tests/unit/inventario/product-batches-sheet.test.tsx` | `product-row-actions`, `product-batch-lot/-quantity/-purchase-date`, `adjust-batch-open` | T4a: etiqueta «Lotes», ancho, menú del lote |
| `tests/unit/inventario/batch-history.test.tsx` | `batch-history-trigger`, `movementReasonLabel` | T4b: diálogo controlado. «Conteo físico» ya lo tiene desde QC-281 (ded3d3d8). |
| `tests/unit/inventario/adjust-batch-dialog.test.tsx` | `ProductBatchesPanel`, `renderBatchActions`, `adjust-batch-open`, `adjust-batch-recorded-stock`, `adjust-batch-reason-error` | T4c: «Elige un motivo.» bajo el campo, campo deshabilitado, modo controlado. La ranura `renderBatchActions` desaparece (T4a). Las tildes de motivo ya las cambió QC-281. |
| `tests/unit/inventario-ui/envase-en-inventario.test.tsx` | `ProductBatchesPanel`, `product-batch-available/-quantity/-reserved`, `adjust-batch-open` | T4a: lee la tabla de lotes |
| `tests/unit/inventario/product-batch-rows.test.tsx` | `data-table-cell-name`, `product-batch-row-*`, `text-destructive` | **No estaba en el spec** (archivo de dev, f978ef29/08b69744/b0eaa866). Monta `ProductTable` con sub-filas de lote. Con `card` (T3c) sus celdas salen dos veces y con `actionsColumn({ menu })` (T3b) cambia la columna de acciones. Se añade a `Archivos esperados`. |
| `tests/unit/inventario/importar/import-preview.test.tsx` | `statusFilterTestId` | T5c: contador sin paréntesis, `StatusBadge` |
| `tests/unit/marca/tablas-marca.test.tsx` | `ProductBatchesPanel`, `product-batch-*` | T4a: R12 de QC-227 enmendado (deja de ser `dd`) |
| `tests/unit/marca/badges-estado.test.tsx` | `ProductBatchesPanel`, `product-batch-over-reserved`, `text-destructive` | T4a: R7 de QC-227 enmendado (`StatusBadge` `danger`) |
| `tests/unit/paridad/inventario-paridad.test.tsx` + `.snap` | `Mostrando todos los tipos`, `Filtrando por`, `product-row-actions`, `product-stock`, `data-table-cell-name` | T2/T3: fila de `design.md > 6`. dev la ha regenerado tres veces desde el spec (c2ac0e65, f978ef29, 08b69744, b0eaa866). |
| `tests/unit/paridad/campos-paridad.test.tsx` + `.snap` | `product-batch-date-field`, `product-batch-date-value` | Ninguno esperado (`design.md > 6`). Solo nombra el campo de fecha del formulario. |
| `tests/unit/shared-ui/confirm-dialog-montado.test.tsx` | `product-row-actions` (monta `ProductTable` y abre el borrado) | **No estaba en el spec.** T3b mueve el diálogo al anfitrión y T3c duplica el disparador: `getByTestId('product-row-actions')` encontraría dos. Se añade a `Archivos esperados`. |
| `tests/unit/inventario/producto-terminado/finished-product-route-contract.test.ts` | `movementReasonLabel` (origen en el barrel de `inventario/components`) | **No estaba en el spec.** Lee de dónde exporta el barrel `movementReasonLabel`. D9 debe dejar ese export donde está (`movement-reason-label.ts`). Se añade a `Archivos esperados` para comprobarlo. |
| `tests/unit/shared/data-table-alcance.test.ts` | `product-stock`, `data-table-cell-name` | T7a: alta de `e2e/inventario-rediseno.spec.ts` (y de `ajuste-de-inventario.spec.ts` si pasa a nombrar `data-table-row-…`) |
| `e2e/inventario.spec.ts` | `product-stock`, `data-table-cell-name` | T7b: acotar a `data-table-row-<id>` |
| `e2e/inventario-importar.spec.ts` | `product-stock`, `data-table-cell-name` | T7b: plantilla en la cabecera, pasos, contador. También busca en `/inventario` tras importar. |
| `e2e/ajuste-de-inventario.spec.ts` | `product-row-actions`, `product-stock`, `product-batch-${id}`, `product-batch-quantity`, `batch-history-trigger`, `adjust-batch-open`, `adjust-batch-recorded-stock` | T7b: menú del lote, `data-table-row-<id>`. Su mapa local ya dice `conteo_fisico: 'Conteo físico'` (QC-281): esa parte de `design.md > 7` ya está hecha. |
| `e2e/reserva-de-material.spec.ts` | `product-row-actions`, `product-stock`, `product-batch-${batch…}`, `batch-history-trigger` | T7b: `data-table-row-<id>`, historial desde el menú del lote |
| `e2e/producto-terminado.spec.ts` | `product-row-actions`, `data-table-cell-name`, `product-batch-*`, `adjust-batch-open` | T7b: fila de la tabla de lotes, ajuste desde el menú del lote |
| `e2e/insumo-por-unidad.spec.ts` | `product-row-actions`, `product-stock`, `data-table-cell-name`, `product-batch-quantity` | T7b: acotar a la fila visible del panel |
| `e2e/datos-de-lote-en-acondicionamiento.spec.ts` | `product-row-actions`, `data-table-cell-name`, `product-batch-${id}`, `-expiry-date`, `-lot` | T7b: `data-table-row-<id>` |
| `e2e/aislamiento-inventario.spec.ts` | `product-row-actions`, `data-table-cell-name` | T7b: acotar a la fila visible |
| `e2e/pedido-bloqueado.spec.ts` | `product-stock` dentro de una fila de `/inventario` (líneas 161 y 192) | **El spec lo daba como «solo espera `inventario-title`»: no es así.** Busca con `has: getByTestId('product-stock')` en filas `data-table-row-`, así que la tarjeta no le afecta a 1440. Revisar en T7b. Se añade a `Archivos esperados`. |

**Sin cambio (falsos positivos o fuera de la ficha):**

| Archivo | Qué nombra | Por qué no cambia |
| --- | --- | --- |
| `e2e/aislamiento-recetas`, `grupos-de-trabajo`, `presentaciones`, `proveedores`, `recetas-pasos`, `recetas`, `unidades` (`.spec.ts`) | `data-table-cell-name` | Otras rutas; su `DataTable` no gana `card` |
| `e2e/consulta-de-evidencia.spec.ts`, `e2e/detalle-de-producto-terminado.spec.ts` | `product-batch-evidence`, `-row`, `-order` | Ficha de producto terminado (QC-225/QC-271), fuera |
| `tests/unit/inventario-ui/finished-product-tables.test.tsx`, `finished-product-batches-evidence.test.tsx`, `finished-product-page.test.tsx` | `product-batch-*`, `routerMock.push`, `finished-product-stock-*` | Ficha de producto terminado, fuera |
| `tests/unit/inventario/product-batch-date-field.test.tsx`, `tests/unit/shared-ui/campos.test.tsx`, `tests/unit/paridad/__snapshots__/formularios-paridad.test.tsx.snap` | `product-batch-date-field` / `-date-value` | Campo de fecha del formulario de producto, que no cambia |
| `tests/unit/inventario/importar/inventory-import-addon.test.ts` | ruta del módulo `get-inventory-import-template` | Falso positivo |
| `tests/unit/inventario/{adjust-batch-stock,adjust-batch-stock-prisma,authorization,batch-movement-prisma,create-product,product-batch-lot-retry,product-stock,qc91-alcance}.test.ts`, `tests/unit/inventario/schema/*`, `tests/unit/identity/schema/companies-country-migration.test.ts` | nombres de módulos o de tests (`product-batch-view`, `domain/product-stock.ts`…) | Falsos positivos de dominio |
| `tests/integration/aislamiento.json`, `tests/integration/inventario/{company-scope-queries,ledger-cuadre,list-query-products,reservation}.int.test.ts`, `tests/integration/pedidos/{order-reservation-concurrency,order-sequence-race}.int.test.ts` | nombres de archivos de test | Falsos positivos |
| `tests/unit/paridad/__snapshots__/{catalogo,grupos,presentaciones,recetas,unidades}-paridad.test.tsx.snap`, `tests/unit/proveedores-ui/supplier-detail-page.test.tsx`, `tests/unit/recetas-ui/recipe-page.test.tsx` | `data-table-cell-name` | Otras rutas |
| `tests/unit/paridad/__snapshots__/{asignacion-acondicionamiento,buscadores,confirmaciones,error-alert,formularios}-paridad…`, `tests/unit/marca/botones-y-campos.test.tsx` | `text-destructive` | Otras piezas (`ProductForm`, `ProductNamePicker`, `DeleteProductDialog`) que la ficha no cambia. `confirmaciones-paridad` ya está listado (sin cambio esperado). |
| `tests/unit/shared-ui/row-actions-menu-centrado.test.tsx`, `row-actions-menu-href.test.tsx`, `row-actions-menu-separator.test.tsx` | `RowActionMenuItem` | T1a no aplica: los dejó QC-262 y esta ficha no los toca |

**Fuera del barrido, pero los toca la misma causa** (no se añaden: no salen en el grep; los anoto
para T3): `tests/unit/inventario/product-type-column.test.tsx` (monta `ProductTable`) y
`e2e/helpers/product-name-cell.ts` (`[data-testid^="data-table-row-"]`, que ahora también casa con las
sub-filas `data-table-row-<id>--batch-<lote>`).

### Spec de origen de los R5 y R17 de `product-page.test.tsx`

- **R5 de la pestaña** («ofrece una pestaña «Producto terminado» que filtra el listado…», «con el
  filtro de tipo en la URL…»): es el **R5 de QC-150** (`specs/QC-150-producto-terminado/requirements.md`:
  «… DEBE permitir filtrar el listado por ese tipo `[D1]`»), que entró con 45f2ca6c (QC-150 T6). La
  cabecera del archivo dice «R1, R5, R6-R17… de QC-22», pero el R5 de QC-22 es otro («La pantalla NO
  DEBE tomar ninguna decisión de autorización») y también tiene caso propio en el archivo (línea ~1204).
- **R17 «en rojo»**: la regla de la alarma la decidió el humano el 2026-09-03 (b4822de8, sin ficha). La
  etiqueta `R17` la puso **QC-121** (48c46ca0, su R17: «… el listado DEBE marcarlo en alerta…»). Los
  dos casos de al lado son el R17 de **QC-91** (sin lotes y con alerta → en alerta, 0c28c46b/99220d76)
  y el mismo R17 de QC-121 (sin alerta → no se marca). Lo que enmienda QC-263 es solo el **color**: la
  regla y `data-alert` se quedan. En la misma pantalla, el R17 de QC-22 (panel lateral, línea ~1297)
  no cambia.

### T1a / T1b

- **T1a — no aplica (a6a224e5).** QC-262 mergeó `separatorBefore` en `dev`:
  `components/shared/row-actions-menu.tsx` (`separatorBefore?: boolean` en la línea 54, regla de
  «nunca el primero» en la 84) y su test `tests/unit/shared-ui/row-actions-menu-separator.test.tsx`.
- **T1b — no aplica.** La fila de `RowActionsMenu` en `components/shared/CATALOGO.md` (línea 86) ya
  lo cubre: «línea divisoria opcional delante de un ítem, en las dos presentaciones y nunca delante del
  primero», y en los puntos de extensión `separatorBefore` por ítem. Salida real:

```
$ pnpm exec vitest run guard-catalogo-de-componentes catalogo-qc256
 RUN  v4.1.10 R:/job/singularis/projects/QuimiCloude/.worktrees/QC-263-rediseno-inventario
 Test Files  2 passed (2)
      Tests  65 passed (65)
   Start at  12:21:10
   Duration  3.41s (transform 193ms, setup 0ms, import 594ms, tests 2.67s, environment 0ms)
```

- De paso, para D4: `RowActionsSpec` (`components/shared/data-table/data-table-types.ts:65`) es
  `Pick<RowActionsMenuProps, 'items' | 'triggerLabel' | 'triggerTestId' | 'title'>`, **sin
  `triggerDataAttributes`**. Para conservar `data-product-id` hará falta añadirlo al `Pick` (la rama
  condicional de D4; el archivo ya está en `Archivos esperados`).

---

## Cambios de dev posteriores al spec

El spec se escribió sobre `f7cc5be2` (2026-10-13 14:31). La rama no volvió a mezclar `dev` hasta hoy
(`d8b82a1d`), y ese merge trajo **muchos más cambios en inventario que los dos que se anunciaban**.
Solo se describe lo que choca; aquí no se decide nada.

| Commit | Qué toca | ¿Choca? |
| --- | --- | --- |
| **b0eaa866** columna Costo (promedio ponderado) | `product-columns.tsx` (columna `averageUnitCost`, `align: 'center'`, celda de producto y de sub-fila de lote), `product-columns-skeleton.ts` (de 8 a 9), `product-batch-rows.test.tsx`, `product-page.test.tsx`, `tablas-marca.test.tsx`, snapshot de `inventario-paridad` | **Sí, con R6/D3:** el commit centra la columna adrede («centrada… como el resto de la tabla»). R6 pasa a la derecha las otras cuatro cifras y no nombra «Costo», así que «Costo» quedaría como la única cifra centrada. **D6/R13:** la tarjeta (`meta: ['stock','qtyAlert','available']`) no lo incluye y no se dice si sale. **Esqueleto:** ver T0b. |
| **da435d96** «Cantidad» en la plantilla + toasts del resultado | `import-texts.ts`, `inventory-import-screen.tsx` (ahora `toast.success` al importar con totales, `toast.error` si no se importó nada o el archivo se rechaza, `toast.info` si ya estaba importado, `toast.error` en error del servidor), contrato y fixtures de importación, `inventory-import-screen.test.tsx` (+110) | **Con R27/R28/D11 no choca**: son otros eventos. Pero el test de T6a («un único `toast.success`… ninguno con error») tiene que contar con ellos: tras crear una unidad, la nueva revisión puede lanzar el `toast.error` del rechazo. El paso 3 (R41) y estos toasts dicen lo mismo dos veces. Ningún R de QC-263 los cubre. Con D13 y el paso 1 no choca: la cabecera «Cantidad» es de la plantilla, no de la pantalla. |
| **f978ef29** lotes vivos desplegables por producto | `product-table.tsx` (las filas pasan a ser `ProductTableRow` = producto \| lote \| estado; `getRowId` da `<id>--batch-<lote>`; chevron `product-batches-toggle` en la celda `name`; `listAliveProductBatchesAction`), `product-columns.tsx`, `expiry-warning.ts`, `product-batch-rows.test.tsx` | **Sí, el choque mayor, con D5/D6/R13:** con `card`, las sub-filas de lote y de estado también salen como tarjeta (sin imagen; título = el `dl` del lote; meta = cifras del lote). El spec no lo prevé. Además `menu` tiene que devolver un spec vacío en las sub-filas, y D5 solo lo dice de la fila de grupo de «Producto terminado». **R11:** hay dos lecturas de lotes (la de «Lotes», `listProductBatchesAction`, y la de las sub-filas, solo vivos). R11 dice «la misma que Lotes», así que no es un choque, pero es fácil confundirlas. **D53:** ver T0b. |
| **08b69744** vencimiento relativo y chip «Vencido» | `expiry-date.tsx` (`EXPIRING_CLASS = 'font-semibold text-destructive'`, rojo a menos de 30 días), `product-batches-panel.tsx`, columna Tipo antes de Presentación, tests | **Sí, con P9:** el spec da por hecho que no hay regla de «por vencer», y ahora la hay (de UI, en `expiry-warning.ts`, en rojo). **Con R15/D7:** los testids `product-batch-expiry-relative` y `product-batch-expired` no están en la lista del R15 y el spec no dice si la tabla los conserva. **Con D16:** `product-columns.tsx` ya tiene `text-destructive` fuera de la existencia (error de la sub-fila, línea 401, y el nombre resaltado vía `EXPIRING_CLASS`). La guardia tiene que ceñirse a `stockAmountCell`/`packagedStockCell`; una prohibición de `text-destructive` en todo el archivo saldría roja. |
| **ccde16f7** panel de lotes en tres líneas | `product-batches-panel.tsx` (testids `product-batch-line-lot/-amounts/-dates`), `product-batches-panel.test.tsx` (+59) | **Sí, con D7/R15:** D7 cambia ese `<ul>` por una tabla, así que las tres líneas desaparecen. Son tests de un commit sin ficha y `design.md > 10` no los recoge como enmienda. |
| **6f08e379** columna Tipo con chip (pestaña «Todos») | `product-columns.tsx` (`showType`), `product-table.tsx`, `product-type-label.ts`, `product-type-tabs.tsx` (las etiquetas salen a `product-type-label.ts`), `product-type-column.test.tsx` | **Leve, con D6/R13:** la tarjeta no incluye Tipo y no se dice si sale. Con D2 no choca: `ProductTypeTabs` sigue con `onNavigate` y los dos textos de R4. |
| **c2ac0e65** Nombre sin unidad, columna Presentación | `product-columns.tsx`, `finished-stock-columns.tsx`, `product-base-name.ts`, varios E2E, `e2e/helpers/product-name-cell.ts` | **Leve:** R9 pide el disparador «Acciones de <nombre · unidad>». La celda ya no pinta la unidad, pero `productRowActionsLabel` sí la lleva, así que no hay choque. Tampoco se dice si «Presentación» sale en la tarjeta. |
| **ded3d3d8** (QC-281) «Conteo físico» con tilde | `movementReasonLabel` se muda a `components/movement-reason-label.ts`, con un mapa parcial de tildes; `batch-history.tsx` deja de exportarla; tests y `e2e/ajuste-de-inventario.spec.ts` ya dicen «Conteo físico» | **Sí, con D8/D9:** D8 dice que `BatchHistory` «conserva exports (`movementKindLabel`, `movementReasonLabel`)», y la segunda ya no vive ahí. D9 (mapa exhaustivo) sigue pendiente, pero se aplica en `movement-reason-label.ts`, que no estaba en `Archivos esperados` (se añade). R46: «Conteo fisico» ya no sale en producción; queda «Elegi un motivo» (`adjust-batch-dialog.tsx:67`). |
| **05f0d0af** (QC-277) cortes de añadido | `inventario/page.tsx` (`canImport` exige además el añadido `importacion_excel`), `importar/page.tsx` (`requirePageAddon` en la segunda línea) | No choca: R1 dice «solo para quien hoy lo ve», y hoy eso incluye el añadido. D3 de rutas sigue en pie: `requirePagePermission` va en la primera línea. |
| **c4f824fe / 6cc59959** guía de importación | `import-guide.tsx`, `import-guide-descriptions.tsx`, `importar/page.tsx` (monta `<ImportGuide>` debajo de la pantalla), `import-preview-summary.tsx` (aviso de columnas ignoradas), `import-preview-table.tsx` | **Sí, con D13:** la composición de D13 (`PageShell` > `ArrowLink` > `PageHeader` > `p` > `InventoryImportScreen`) no tiene la guía. **Con D15/R35-R40:** el aviso de columnas ignoradas del paso 2 no tiene sitio en el orden de D15 («cifras, faltantes, tabla, botones»). |
| **325aa378** plantilla `.xlsx` | `import-template-button.tsx`, `download-file.ts` | No choca con D13: el botón sigue siendo uno y solo cambia de sitio |
| **f34f8bb7** (QC-225) enlace a la ficha de producto terminado | `finished-stock-columns.tsx` (la celda `name` enlaza a la ficha) | Leve, con D6: en la tarjeta de «Producto terminado» el título lleva el enlace y el conmutador de despliegue |
| **4714563e / af613689 / 17978345** imagen, vencimiento y costo en el formulario | `product-form.tsx`, `product-field.tsx`, `product-cost-fields.tsx`, `product-batch-date-field.tsx` | No choca: el formulario está fuera de la ficha |
| **e002f8b9** (QC-289) orden por defecto por último lote | persistencia | No choca: D2 conserva el orden de la URL |

---

## T0b — Medidas

**No se pudo medir en el navegador.** Arranqué Docker Desktop: `quimicloude-pg17` se levantó solo,
por su política de reinicio. También arranqué `next dev` en el puerto 3118 con un script de
Playwright en el scratchpad. El login con el administrador del seed vuelve a `/login?sesion=fin`,
porque la base local no tiene las migraciones de dev. El servidor registra
`relation "company_addon_overrides" does not exist`, y `prisma migrate status` lista 8 sin aplicar,
de `20261014180000_admin_without_assigned_orders_view` a `20261016120000_products_last_batch_at`.
Migrar la base compartida queda fuera del alcance de frontend, así que lo dejé así. El servidor está
parado y Docker Desktop sigue arrancado. **Todas las cifras de abajo salen del código y no están
medidas.** T7a las medirá con `boundingBox`.

Fuentes: `components/ui/sidebar.tsx` (`SIDEBAR_WIDTH` 16rem = 256 px; en icono y con
`variant="floating"`, 3rem + 1rem = 64 px; por debajo de 768 px, `useIsMobile`, la barra sale del
flujo), `components/private/app-sidebar.tsx` (`collapsible="icon" variant="floating"`),
`lib/shared/ui/sidebar-state.ts` (sin cookie, abierta), `app/(private)/inventario/page.tsx` (hoy
`p-4 md:p-6`), `components/shared/page-shell.tsx` (tras D1, `px-4 md:px-7`) y
`components/shared/data-table/data-table.tsx` (con `card`, `@container` en `data-testid="data-table"`
y la tabla `@max-[760px]:hidden`). No se descuenta la barra de desplazamiento vertical (±15 px en
Chromium de escritorio).

### Contenedor de la tabla de `/inventario` (`data-testid="data-table"`)

| Ventana | Barra lateral | Hoy (`p-4 md:p-6`) | Tras D1 (`PageShell`) | ¿Tarjetas con `card`? |
| --- | --- | --- | --- | --- |
| 1440 | abierta (256) | 1136 | 1128 | no |
| 1440 | icono (64) | 1328 | 1320 | no |
| 820 | abierta (256) | 516 | 508 | **sí** |
| 820 | icono (64) | 708 | 700 | **sí** |
| 390 | fuera del flujo | 358 | 358 | sí |

**¿Tarjetas a 820?** Sí, con la barra abierta **y** con la barra en icono. P12 dice «con la barra
lateral en icono el contenedor queda bajo 760 px». Es cierto, pero con la barra abierta queda aún más
abajo, así que a 820 salen tarjetas en los dos casos. Hoy no salen porque la tabla no tiene `card`;
la tabla hace scroll horizontal. No es una desviación de D6, porque el umbral es el de `DataTable`,
pero la aserción del E2E a 820 no depende del estado de la barra.

### `DataTable` dentro del panel «Lotes»

- **Selector real del ancho de `SheetContent`** (`components/ui/sheet.tsx:123`, no se edita):
  `data-[side=right]:w-3/4` y `data-[side=right]:sm:max-w-sm` (384 px), con `border-l` y **sin
  relleno horizontal**. `SheetHeader` tiene `p-4`, y el panel de lotes de hoy va pegado al borde.
  `ProductBatchesSheet` no pasa `className` hoy. El selector de D7
  (`data-[side=right]:w-full data-[side=right]:sm:max-w-[900px]`) usa las mismas variantes y en el
  mismo orden, así que `cn` sustituye las dos. **No hay desviación.**
- Hoy, a cualquier ventana ≥ 640, el panel mide 384 px y una tabla dentro saldría siempre en
  tarjetas. Por eso D7 necesita el `className`.
- Con D7, a **900 px de ventana**: panel de 900 px, contenido de unos 899 px (menos el `border-l`), o
  867 px si la implementación añade `px-4`. Supera 760, así que **sale la tabla**. A 1440 también da
  900 (tabla). A 820 da unos 819 o 787 px (tabla). Las tarjetas aparecen con ventanas por debajo de
  unos 761 px (unos 793 px con `px-4`). A 390 es todo el ancho, 390 px (tarjetas).

### Diálogo de historial a 1000 px

- `DialogContent` (`components/ui/dialog.tsx:58`): `w-full max-w-[calc(100%-2rem)] p-4 sm:max-w-sm`.
- **D8 dice «hasta 1000 px» pero no da la clase**, y el resultado cambia según cuál sea:
  - con `sm:max-w-[1000px]`, la de `sm` gana a `max-w-[calc(100%-2rem)]` desde 640 px. A 1000 de
    ventana el diálogo mide 1000 px **sin margen lateral** y el contenido 968 (tabla). A 820 mide
    820, también pegado a los bordes, y el contenido 788 (**tabla**);
  - con `sm:max-w-[min(1000px,calc(100%-2rem))]`, que es el patrón del repo
    (`sm:max-w-[min(90vw,64rem)]` ya existe): a 1000 el diálogo mide 968 y el contenido 936 (tabla).
    A 820 mide 788 y el contenido 756 (**tarjetas**, que es el riesgo que anota `design.md > 9`).
    A 1440 mide 1000 y el contenido 968.
- **Desviación a anotar respecto a D8 y § 9:** que a 820 salgan tarjetas en el historial depende de
  la clase. Con la literal `sm:max-w-[1000px]` el diálogo toca los bordes entre 640 y 1000 px, y eso
  choca con R42 a partir de 640.

### Esqueleto contra tarjetas (D53)

- El esqueleto de la lista es `productTableStates().loading` (`product-table.tsx:146`), un
  `TableSkeleton` de `PRODUCT_SKELETON_COLUMN_COUNT = 9` columnas. Lo comparte «Producto terminado»
  (`finished-stock-table.tsx:115`).
- Las columnas reales son 9 con un tipo filtrado (imagen, nombre, presentación, existencia, costo,
  alerta, reservado, disponible, acciones), **10 en «Todos»** (más «Tipo», 6f08e379) y **7 en
  «Producto terminado»** (imagen, pedido, nombre, presentación, existencia, alerta, acciones). El
  test ata el 9 a `buildProductColumns` sin `showType`.
- El esqueleto no tiene modo tarjeta. Con `card` (D6), a 820 y a 390 la lista llega en tarjetas y el
  esqueleto sigue siendo una tabla.
- **D53 se cumple en `/inventario`**: un esqueleto que no pasa a tarjeta y que no tiene el mismo
  número de columnas en «Todos» y en «Producto terminado». Según `design.md > 11`, se amplía D53 en T7c.

### Desviaciones respecto a `design.md > D6–D8` (para antes de la tanda 2)

1. **D6:** la tabla de productos ya no tiene una fila por producto, sino filas de lote y de estado
   desplegables (f978ef29). `card` las convertiría también en tarjetas, y D6 no lo prevé. Tampoco
   dice si las columnas nuevas (Tipo, Presentación, Costo) salen en la tarjeta.
2. **D6:** a 820 hay tarjetas también con la barra abierta (508 px), no solo con la barra en icono.
3. **D7:** el selector se confirma tal cual. La lista de tres líneas y el vencimiento relativo
   (ccde16f7, 08b69744) que D7 reemplaza son posteriores al spec.
4. **D8:** la clase del tope de 1000 px decide si el historial sale en tarjetas a 820 y si el diálogo
   toca los bordes. Además `movementReasonLabel` ya no se exporta desde `batch-history.tsx`.

### Comandos

- `pnpm exec vitest run guard-catalogo-de-componentes catalogo-qc256`: verde (salida arriba).
- `pnpm exec vitest run guard`: `Test Files 80 passed (80)`, `Tests 1096 passed | 20 skipped (1116)`,
  con `tasks.md` ya editado.
- Typecheck, lint y `vitest related`: no aplican, porque la tanda no toca código.

## Veredicto

T0a y T0b hechas, T1a y T1b no aplican (a6a224e5). Antes de la tanda 2 hay que resolver los choques
con dev (sub-filas de lote, Costo centrado, panel de tres líneas, `movementReasonLabel` mudado, guía
de importación) y la clase de D8.

---

## Tanda 2 (T2a, T2b, T2d) — 2026-10-16 · frontend_dev

T2c no se ha tocado: sigue bloqueada por el tablero de P17/P18. Las columnas «Tipo»,
«Presentación» y «Costo» y las sub-filas de lote se quedan como las dejó `dev`. Ninguna de las tres
tareas obligaba a cambiarlas.

### Archivos creados / modificados

Producción:
- `app/(private)/inventario/page.tsx` (T2a): `PageShell` > `PageHeader` (`title`, `titleTestId`,
  `actions`); «Importar» lleva el `UploadIcon` `aria-hidden` y sigue con contorno, `touchTarget` y
  la misma condición `canImport`.
- `app/(private)/inventario/components/product-list-params.ts` (T2b): nuevo `productTypeTabHref`.
- `app/(private)/inventario/components/product-type-tabs.tsx` (T2b): compone `UrlTabs`. Ya no lleva
  `onNavigate`, `TabsContent` ni los dos textos. Constantes `PRODUCT_TYPE_TABS_LABEL`,
  `PRODUCT_TYPE_TABS_TESTID` (`product-type-tabs`) y `ALL_TYPES_TAB_LABEL`. Sin `'use client'`,
  como `UrlTabs`.
- `app/(private)/inventario/components/product-table.tsx`, `finished-stock-table.tsx` (T2b):
  `<ProductTypeTabs params={params} />`. El contenedor `product-table` pasa a `flex flex-col gap-4`
  para recuperar el aire que antes daba el `pt-4` del `TabsContent`.
- `app/(private)/inventario/components/index.ts`: exporta `productTypeTabHref` y las tres
  constantes de las pestañas.
- `app/(private)/inventario/components/expiry-date.tsx` (T2d): `EXPIRING_CLASS = 'font-semibold
  text-warning-text'`, y el comentario de la prop que decía «en rojo».

Tests:
- `tests/unit/inventario/product-type-tabs.test.tsx` (nuevo).
- `tests/unit/inventario/product-list-params.test.ts`: tres casos de `productTypeTabHref`.
- `tests/unit/inventario/product-page.test.tsx`: nuevo `describe` «cabecera» (R1 ×3, R2). El R5 de
  QC-150 ahora afirma el `href` del enlace y que no se llama a `router.push`. El otro R5 cambia la
  aserción del `strong` «Filtrando por» por su ausencia.
- `tests/unit/inventario/product-batch-rows.test.tsx`, `product-batches-panel.test.tsx` (T2d):
  ámbar en vez de rojo y sin `text-destructive`. Casos nuevos: el nombre del producto con lote
  vencido y a 30 días exactos, y el panel a 30 días exactos.
- `tests/unit/paridad/__snapshots__/inventario-paridad.test.tsx.snap`: regenerado (13 snapshots).

### Diff del snapshot de `inventario-paridad` (fila de `design.md > 6`)

Cambian los 13 snapshots y solo en tres zonas. Todas caben en la fila (R1, R3, R4):

1. **Cabecera (R1), ×13:** el `div` `p-4 md:p-6` pasa a `PageShell` (`@container … md:px-7`). La
   fila `h1` + `div` de acciones pasa a `PageHeader`: `h1` `text-[30px] @max-[760px]:text-2xl` y
   acciones `@max-[760px]:w-full @max-[760px]:*:flex-1`. «Importar» gana `svg.lucide-upload`.
2. **Pestañas (R3, R4), en los 5 estados con tabla** (los de error y carga no pintan pestañas,
   igual que antes): los `button role=tab` pasan a `a role=tab href="/inventario?page=1&pageSize=10[&q=…][&type=…]"`,
   con su `span` de etiqueta y el indicador `TabsIndicator`. La lista gana
   `data-testid="product-type-tabs"`, y desaparecen el `tabpanel` y los textos «Mostrando todos los
   tipos» / «Filtrando por: <strong>».
3. **Contenedor `product-table`:** pasa de `transition-opacity` a `flex flex-col gap-4 transition-opacity`.

No cambia ninguna celda ni ninguna columna (T2c). T2d no toca el snapshot, porque ningún fixture de
paridad trae un vencimiento cercano (ya antes no había ningún `text-destructive`).

### Mapa R → test

| R | Test |
| --- | --- |
| R1 | `product-page.test.tsx` > «cabecera»: único `h1` con `inventario-title` en `PageHeader` dentro de `PageShell`; «Importar» (contorno, icono, `href`) antes de «Nuevo producto»; sin `inventario.modificar`, solo «Nuevo producto». También el snapshot de `inventario-paridad` |
| R2 | `product-page.test.tsx` > «R2 — con 760 px o menos…» (clases `@max-[760px]:w-full` y `*:flex-1`, `min-h-11` en las dos). La medida real es del E2E (T7a) |
| R3 | `product-type-tabs.test.tsx` (orden, lista «Filtrar por tipo de producto», `href` = el de antes, vigente `aria-selected`); `product-list-params.test.ts` > `productTypeTabHref` ×3; `product-page.test.tsx` > R5 (QC-150) ×2 |
| R4 | `product-type-tabs.test.tsx` > «R4 — no pinta…»; `product-page.test.tsx` > R5 (QC-150) con filtro (sin «Filtrando por») |
| R5 | `product-type-tabs.test.tsx` > «R5 — … sin saltar de línea» (clases `overflow-x-auto flex-nowrap max-w-full`). La medida real es del E2E (T7a) |
| R48 | `product-batch-rows.test.tsx`: «R48 — pinta en ámbar…» (sub-fila), «R48 — el vencido lleva el chip «Vencido» en danger…», «R48 — resalta en ámbar el nombre del producto…»; `product-batches-panel.test.tsx`: «R48 — ámbar bajo 30 dias…» (panel). La guardia (T6b) y el E2E (T7a) quedan pendientes |

### Salida real

```
$ pnpm run typecheck
> tsc --noEmit
(sin errores)

$ pnpm run lint
ESLint: 0 errors, 10 warnings in 4 files
  (no-unused-vars en confirm-catalog-import.test.ts, list-execution-traces.test.ts,
   order-service.test.ts y step-evidence.tsx: ninguno de esta tanda)

$ pnpm exec vitest run tests/unit/inventario/product-page.test.tsx tests/unit/inventario/product-type-tabs.test.tsx tests/unit/inventario/product-list-params.test.ts
 Test Files  3 passed (3)
      Tests  115 passed (115)

$ pnpm exec vitest run tests/unit/inventario/product-batch-rows.test.tsx tests/unit/inventario/product-batches-panel.test.tsx
 Test Files  2 passed (2)
      Tests  39 passed (39)

$ pnpm exec vitest run tests/unit/paridad/inventario-paridad.test.tsx -u
  Snapshots  13 updated
 Test Files  1 passed (1)
      Tests  13 passed (13)

$ pnpm exec vitest related --run <los 7 de producción y los 6 de test de arriba>
 FAIL  tests/unit/inventario/importar/importar-page.test.tsx > enlace «Importar» en /inventario > R2 aparece con inventario.modificar…
 Test Files  1 failed | 32 passed (33)
      Tests  1 failed | 565 passed (566)
$ pnpm exec vitest run tests/unit/inventario/importar/importar-page.test.tsx   (reintento)
 Test Files  1 passed (1)
      Tests  9 passed (9)

$ pnpm exec vitest run guard
 Test Files  80 passed (80)
      Tests  1096 passed | 20 skipped (1116)
```

**El fallo de `importar-page.test.tsx` lo causa T2a.** Su ayudante `contieneEnlaceA` recorría solo
`children`, y el enlace «Importar» vive ahora en la prop `actions` de `PageHeader`. El otro
frontend_dev (T5a), que trabaja en paralelo en ese archivo, ya ha añadido el recorrido de
`props.actions`, y con esa edición suya el archivo pasa (reintento de arriba). Yo no lo he tocado.
**Hay que hacer el commit de las dos cosas juntas.** Si T2a entra sin ese cambio del ayudante, ese
caso sale rojo.

### Veredicto

T2a, T2b y T2d hechas y en verde. El diff del snapshot casa con la fila de `design.md > 6`. T2c y la
tanda 3 siguen bloqueadas por el tablero.

---

## Tanda 5 (T5a-T5c) — 2026-10-16 · frontend_dev

Tablero: `docs/diseno/canvas/InventarioImportar.dc.html`. `ImportSteps` se crea en la ruta (paso 4
de la regla de decisión, justificado en `design.md > Lo que ya existe`). No sube a
`components/shared`, así que no lleva fila en el catálogo. No se ha tocado ningún snapshot de
`tests/unit/paridad`: `campos-paridad` monta `import-dialog-parts.tsx`, que no cambia.

### Archivos creados / modificados

Producción (`app/(private)/inventario/importar/`):
- `page.tsx` (T5a): `PageShell` > [`ArrowLink` back `touch` «Volver a inventario», `PageHeader`
  con `actions={<ImportTemplateButton />}`, descripción] > `InventoryImportScreen` > `ImportGuide`.
  `requirePagePermission` sigue en la primera línea y `requirePageAddon` en la segunda. Ya no
  importa `next/link` ni `buttonVariants`.
- `components/import-steps.tsx` (T5b, nuevo): `ImportStep`, `importStepOf` e `ImportSteps`
  (`ol` «Pasos» con `aria-current="step"`, sin controles y con `overflow-x-auto flex-nowrap`).
- `components/inventory-import-screen.tsx` (T5b, T5c): pinta la barra con `importStepOf(outcome)`.
  Cada paso entra con `motion-safe:animate-in` (`key={step}`). El paso 1 es una `Card` con la zona y
  «Revisar archivo» (con `ArrowRightIcon`, y `Spinner` + `aria-busy` mientras revisa); la plantilla
  sale de aquí. En el paso 2, el error y «Revisando…» van entre la tabla y los botones. Se quita
  `isFinished`.
- `components/import-upload-field.tsx` (T5c): la zona discontinua. Sin archivo: icono, «.xlsx ·
  .csv» y «Elegir archivo». Con archivo: nombre `font-mono tabular-nums`, tamaño y «Elegir otro
  archivo». La ayuda, el aviso de tamaño y el input son los de hoy.
- `components/import-preview-summary.tsx` (T5c): `ImportTotals` gana `tones?`, pinta un `dd`
  `font-mono tabular-nums` con su tono y `data-tone` y usa la rejilla `auto-fit,minmax(130px,1fr)`.
  `ImportPreviewSummary` pinta, en este orden: la `Card` «Vista previa» (h2, archivo, descripción
  y cifras), los avisos de hoy sin cambio, `children` (faltantes, tabla, error) y los botones
  apilados con 760 px o menos («Descargar filas con error» y luego «Importar N filas válidas», con
  N en `span` tabular). Exporta `PREVIEW_TOTAL_TONES` y `STACKED_ACTIONS_CLASS`.
- `components/import-preview-table.tsx` (T5c): `ImportStatusLabel` compone `StatusBadge` (pasan
  `data-testid` y `data-status`). `ImportStatusPresentation` pasa a `{ label, tone }`. Nuevos
  `PREVIEW_STATUS_TONES`, el filtro «Todas <n>» sin paréntesis (con `span` `font-mono
  tabular-nums`, `rounded-full`), la columna «Fila» `tabular` y
  `card={{ primary: 'row', status: 'status', title: 'product', meta: ['detail'] }}`.
- `components/import-result-summary.tsx` (T5c): `RESULT_STATUS_TONES`. El paso 3 se pinta como
  tarjeta centrada (`OutcomeCard`): icono de éxito, de error o de información, título, archivo,
  descripción de hoy, cifras con tono, aviso de fila de ejemplo y botones. «Importar otro archivo»
  pasa a `default` con `UploadIcon`. Debajo va la tabla. `ImportAlreadyDoneNotice` usa la misma
  tarjeta, con su texto y su `data-testid`.
- `components/import-missing-catalog.tsx` (T5c): `Card` con `border-warning-border`, icono
  `TriangleAlert` y columnas `grid-cols-2 @max-[760px]:grid-cols-1`. Se conservan los testids y
  las altas.
- `components/import-texts.ts`: `IMPORT_STEPS_LABEL`, `IMPORT_STEP_LABELS`, `IMPORT_STEPS_TESTID`,
  `importStepTestId`, `UPLOAD_FORMATS_LABEL`, `UPLOAD_FILE_SIZE_TESTID`, `UPLOAD_EMPTY_TESTID`,
  `PREVIEW_CARD_TESTID`, `PREVIEW_ACTIONS_TESTID`, `IMPORT_FILE_NAME_TESTID`,
  `RESULT_CARD_TESTID` y `confirmLabelParts` (`confirmLabel` da el mismo texto). Sale
  `UPLOAD_NO_FILE`, que ya no se usa.
- `components/index.ts`: exporta `ImportSteps`, `importStepOf`, `ImportStep`,
  `PREVIEW_TOTAL_TONES`, `PREVIEW_STATUS_TONES` y `RESULT_STATUS_TONES`.

Tests (`tests/unit/inventario/importar/`):
- `import-steps.test.tsx` (nuevo).
- `importar-page.test.tsx`: casos R29, R30 y R49. Las lecturas de la guía pasan a un mock
  `hoisted`. `contieneEnlaceA` recorre también `props.actions`, que es el arreglo del fallo que
  trajo T2a.
- `importar-route-contract.test.ts`: los permisos van en la primera y la segunda línea (R29), y la
  página usa `ArrowLink` y no `Link` (R30).
- `inventory-import-screen.test.tsx`: `describe` «barra de pasos» y «composición de los pasos».
  En dos casos de confirmación, el conteo de estados y motivos se acota a la `table`, porque la
  tarjeta duplica las celdas. «sin decir que se importó» se acota a `nada`, porque la barra de
  pasos dice «Importación terminada». Los casos de «avisos flotantes» (da435d96) no cambian.
- `import-preview.test.tsx`: el R9 «icono» pasa a R38 `StatusBadge` con tono, y el contador «(2)»
  pasa a R39 sin paréntesis. Casos nuevos para R35, R36, R38 (resultado), R39 (tarjetas y «Todas
  48»), R40 y R50.
- `import-upload.test.tsx`: `describe` «zona del archivo (paso 1)» con R34 ×5 (la pantalla con
  `previewInventoryImportAction` doblado).
- `import-missing-catalog.test.tsx`: R37 ×2.
- `import-guide.test.tsx`: sin cambio, y en verde.

### Mapa R → test

| R | Test |
| --- | --- |
| R29 | `importar-page.test.tsx` > «R29 pinta «Volver a inventario» con flecha…», «R29 … único h1…», «R29 R30 «Descargar plantilla» va en las acciones…»; `importar-route-contract.test.ts` > «R29 … primera linea … segunda»; `inventory-import-screen.test.tsx` > «R29 el paso 1 no ofrece la plantilla» |
| R30 | `importar-page.test.tsx` > «R30 … no es un enlace de texto», «R29 R30 …»; `importar-route-contract.test.ts` > «R30 … ArrowLink y no con un Link». La guardia de T6b queda pendiente |
| R31 | `import-steps.test.tsx` > «R31 es una lista ordenada…», «R31 con el paso N vigente…» ×3, «R31 los pasos no son controles…»; `inventory-import-screen.test.tsx` > «R31 R32 … del 1 al 2 y al 3…» |
| R32 | `import-steps.test.tsx` > `importStepOf` ×4 (null, rejected, preview, los tres finales); `inventory-import-screen.test.tsx` > «R31 R32 …», «R32 con el archivo rechazado…», «R32 con un error del servidor…», «R32 sin nada importado…», «R32 con la importación ya hecha…» |
| R33 | `import-steps.test.tsx` > «R33 se desplaza en horizontal…» (clases). La medida es del E2E (T7a) |
| R34 | `import-upload.test.tsx` > «R34 sin archivo…», «R34 con archivo…», «R34 la ayuda de límites…», «R34 «Revisar archivo» lleva flecha…», «R34 mientras se revisa… aria-busy» |
| R35 | `import-preview.test.tsx` > «R35 pinta la tarjeta «Vista previa»…» (más los R9 de las cifras y sus testids); `inventory-import-screen.test.tsx` > «R35 R40 R50 … en ese orden» |
| R36 | `import-preview.test.tsx` > «R36 cada cifra se pinta en el tono de su estado…» |
| R37 | `import-missing-catalog.test.tsx` > «R37 … tarjeta con borde e icono…», «R37 … dos columnas…» |
| R38 | `import-preview.test.tsx` > «R38 cada estado de la vista previa…», «R38 cada estado del resultado…» |
| R39 | `import-preview.test.tsx` > «R39 con tarjetas…», «R39 … sin paréntesis», «R39 «Todas 48»…» |
| R40 | `import-preview.test.tsx` > «R40 los botones van al final…»; `inventory-import-screen.test.tsx` > «R35 R40 R50 …», «R40 mientras importa…» (y el caso de hoy «mientras confirma…») |
| R41 | `inventory-import-screen.test.tsx` > «R41 el paso 3 pinta la tarjeta…», «R41 «Importar otro archivo» es la acción principal…», «R41 la importación ya hecha…» |
| R49 | `importar-page.test.tsx` > «R49 la guía va debajo…», «R49 … valores de la empresa en su pestaña», «R49 si los valores no se pueden leer…»; `import-guide.test.tsx` sin cambio |
| R50 | `import-preview.test.tsx` > «R50 los avisos van entre las cifras…»; `inventory-import-screen.test.tsx` > «R35 R40 R50 …», «R50 el aviso de columnas ignoradas… en la tabla y en la tarjeta», «R50 el paso 3 conserva el aviso de fila de ejemplo» |
| R51 | `inventory-import-screen.test.tsx` > «avisos flotantes» (los siete casos de da435d96, sin cambio) y «R51 al llegar al paso 3 se avisa una sola vez…» |

### Salida real

```
$ pnpm run typecheck
> tsc --noEmit
(sin errores)

$ pnpm run lint
ESLint: 0 errors, 10 warnings in 4 files
  (no-unused-vars en confirm-catalog-import.test.ts, list-execution-traces.test.ts,
   order-service.test.ts y step-evidence.tsx: ninguno de esta tanda)

$ pnpm exec vitest related --run <los 10 de producción y los 7 de test de arriba>
 Test Files  9 passed (9)
      Tests  183 passed (183)

$ pnpm exec vitest run guard
 Test Files  80 passed (80)
      Tests  1096 passed | 20 skipped (1116)
```

### Para el leader

- **El paso 2 ya no ofrece elegir otro archivo.** Hoy la zona de subida seguía visible en la vista
  previa. El tablero del paso 2 no la dibuja, y R31 no deja que los pasos sean controles. Para
  cambiar de archivo desde la vista previa hay que recargar la página. No he añadido nada fuera
  del tablero. Si se quiere conservar, hace falta decidir dónde va (por ejemplo, en la cabecera de
  la tarjeta «Vista previa»).
- El E2E `e2e/inventario-importar.spec.ts` no se ha tocado: es de T7b.

### Veredicto

T5a, T5b y T5c hechas. Typecheck, los tests relacionados y las guardias pasan; lint da 0 errores y
solo los 10 avisos que ya había.

---

## Tanda 2c (T2c) — 2026-10-16 · frontend_dev

Solo presentación. La lógica de datos sigue como en `dev`: «Costo» es el costo unitario (promedio
ponderado en el producto, su costo en el lote) e `isBelowAlert` no cambia. No toca tarjetas (`card`)
ni menú, que son de la tanda 3.

### Archivos creados / modificados

Producción:
- `app/(private)/inventario/components/product-columns.tsx`:
  - `align: 'end'` en `stock`, `averageUnitCost`, `qtyAlert`, `reserved` y `available`; `type` y
    `presentationName` siguen en `start`. Las sub-filas de lote comparten columna, así que heredan
    la alineación sin código propio.
  - «Disponible» de la fila `product` en `font-semibold` (el lote no).
  - Exporta `BELOW_ALERT_LABEL`, `BELOW_ALERT_CLASS` (`font-semibold text-warning-text`) y
    `BelowAlertMark` (`TriangleAlert` `aria-hidden` + `sr-only`).
  - En alarma, `stockAmountCell` pinta `BELOW_ALERT_CLASS` y `BelowAlertMark` delante de la cifra, y
    conserva `data-testid`, `data-alert="true"` y el `aria-label` de la cifra exacta. Ya no lleva
    `text-destructive`.
- `app/(private)/inventario/components/finished-stock-columns.tsx`: `align: 'end'` en `stock` y
  `qtyAlert`. `packagedStockCell` en alarma lleva la misma clase y la misma marca.
- `app/(private)/inventario/components/index.ts`: exporta `BELOW_ALERT_LABEL`.

Tests:
- `tests/unit/inventario/product-stock-alert.test.tsx` (nuevo, 7 casos).
- `tests/unit/inventario/product-batch-rows.test.tsx`: tres casos nuevos en «columna «Costo»»:
  «Costo» a la derecha; sub-fila de lote alineada como su columna, con «Tipo», «Presentación» y
  «Costo» conservados con sus testids; «Disponible» en negrita solo en el producto.
- `tests/unit/inventario/product-page.test.tsx`: el R17 de hoy pasa de «en rojo» a «en ámbar».
  Afirma `text-warning-text`, el `title` del aviso y que no hay `text-destructive`. Caso nuevo de R6
  con cifras a la derecha y «Tipo» y «Presentación» a la izquierda, en cabecera y celda.
- `tests/unit/marca/tablas-marca.test.tsx`: `describe` nuevo «alineación de las cifras de
  inventario» para las dos declaraciones de columnas.
- `tests/unit/paridad/__snapshots__/inventario-paridad.test.tsx.snap`: regenerado (2 snapshots).

### Una decisión de colocación (sin cambio de spec)

D3 pide el `title` «Por debajo de la alerta de cantidad» en la celda. Pero la celda ya usa su
`title` para la cifra exacta cuando la redondea, y eso lo afirma el R6 de `product-page.test.tsx`
(«con la cifra exacta en el title»). En `packagedStockCell` el `title` es el rótulo, que la celda
trunca. Si se pisaba, ese caso fallaba. Por eso el `title` del aviso va en la marca
(`<span title>` con el icono y el `sr-only`), dentro de la celda. La celda conserva su `title` de
siempre. R7 se cumple igual: hay un `title` y un texto oculto con el aviso. Lo cubre el caso «R7 —
con la cifra redondeada…».

### Columna «Costo»: orden

El tablero `InventarioColumnasLotes.dc.html` pinta «Costo» después de «Disponible». `dev` la pone
justo después de «Existencia», y lo fija `product-batch-rows.test.tsx` («pinta la cabecera «Costo»
justo despues de la existencia»). T2c no reordena columnas, así que se conserva el orden de `dev`. Si
el humano quiere el orden del tablero, es un cambio aparte.

### Diff del snapshot de `inventario-paridad` (fila de `design.md > 6`)

Cambian 2 de 13 snapshots: «productos — con filas» y «producto terminado — con filas». Los otros
estados no pintan cifras. Solo cambia la alineación, que es la parte «columnas a la derecha
(también «Costo»)» de la fila:
- `th` y `td` de `stock`, `averageUnitCost`, `qtyAlert`, `reserved` y `available` (productos) y de
  `stock` y `qtyAlert` (producto terminado) pasan de `text-center` a `text-right`;
- el `div` interior de esas 7 cabeceras pasa de `justify-center` a `justify-end`.

Ningún fixture de paridad está en alarma, y «Disponible» sale como «—» (sin `span`). Por eso no
aparecen ni el aviso ámbar ni la negrita: los cubren los tests unitarios.

### Mapa R → test

| R | Test |
| --- | --- |
| R6 | `product-batch-rows.test.tsx`: «R6 — «Costo» va a la derecha…», «R6, R47, R53 — la sub-fila de lote alinea sus cifras…», «R6 — «Disponible» va en negrita…»; `product-page.test.tsx`: «R6 — las cifras, «Costo» incluido, van a la derecha…»; `tablas-marca.test.tsx`: «R6: en product-columns.tsx…», «R6: en finished-stock-columns.tsx…»; snapshot de `inventario-paridad` |
| R7 | `product-stock-alert.test.tsx`: «R7 — por debajo de la alerta…», «R7 — en la alerta exacta y por encima…», «R7 — con la cifra redondeada…», «R7 — la existencia de un lote nunca lleva el aviso…»; `product-page.test.tsx`: «R17, R7 — la existencia se pinta en ámbar…» |
| R8 | `product-stock-alert.test.tsx`: «R8 — la línea de producto…en cifra suelta», «R8 — la línea en envases…», «R8 — en la alerta exacta y por encima…». La tarjeta (R13) es de T3c |
| R47 | `product-batch-rows.test.tsx`: «R6, R47, R53 — la sub-fila de lote alinea sus cifras como su columna…» (solo la alineación; las tarjetas son de T3c) |
| R53 | `product-batch-rows.test.tsx`: «R6, R47, R53 — …«Tipo», «Presentación» y «Costo» se conservan» (más los casos de costo que ya había) |

La guardia D16 (`guard-inventario-rediseno.test.ts`, T6b) no existe todavía. Esta tanda deja
`stockAmountCell` y `packagedStockCell` sin `text-destructive`, que es lo que esa guardia afirmará.

### Salida real

```
$ pnpm exec vitest run tests/unit/inventario/product-stock-alert.test.tsx
 Test Files  1 passed (1)
      Tests  6 passed (6)          (antes de añadir el 7.º caso; luego, en el run de abajo)

$ pnpm exec vitest run tests/unit/inventario/product-batch-rows.test.tsx
 Test Files  1 passed (1)
      Tests  22 passed (22)

$ pnpm exec vitest run tests/unit/inventario/product-page.test.tsx   (primera pasada)
 FAIL  … > R6 — la existencia se pinta a dos decimales, con la cifra exacta en el title y el aria-label
   expect(element).toHaveAttribute("title", "0.0001")
      Tests  1 failed | 92 passed (93)
   → motivo de la decisión de colocación de arriba; tras moverla:

$ pnpm exec vitest run tests/unit/inventario/product-page.test.tsx tests/unit/inventario/product-stock-alert.test.tsx tests/unit/inventario/finished-stock-table.test.tsx
 Test Files  3 passed (3)
      Tests  120 passed (120)

$ pnpm exec vitest run tests/unit/marca/tablas-marca.test.tsx
 Test Files  1 passed (1)
      Tests  21 passed (21)

$ pnpm exec vitest run tests/unit/paridad/inventario-paridad.test.tsx
  Snapshots  2 failed
      Tests  2 failed | 11 passed (13)      (diff: solo text-center→text-right y justify-center→justify-end)
$ pnpm exec vitest run tests/unit/paridad/inventario-paridad.test.tsx -u
  Snapshots  2 updated
      Tests  13 passed (13)

$ pnpm exec vitest run tests/unit/inventario/product-stock-alert.test.tsx tests/unit/inventario/product-batch-rows.test.tsx   (final)
 Test Files  2 passed (2)
      Tests  29 passed (29)          (7 + 22)

$ pnpm run typecheck
> tsc --noEmit
(sin errores)

$ pnpm run lint
✖ 10 problems (0 errors, 10 warnings)   (los 10 no-unused-vars de siempre, ninguno de esta tanda)

$ pnpm exec vitest related --run <3 de producción + 5 de test de arriba>
 Test Files  34 passed (34)
      Tests  586 passed (586)

$ pnpm exec vitest run guard
 Test Files  80 passed (80)
      Tests  1096 passed | 20 skipped (1116)
```

### Veredicto

T2c hecha y en verde. El diff del snapshot casa con la fila de `design.md > 6`. Quedan dos notas
para el leader: el `title` del aviso va en la marca, y «Costo» sigue en el orden de `dev`.

---

## Tanda 3 (T3a-T3c) — 2026-10-16 · frontend_dev

Tableros: `docs/diseno/canvas/InventarioColumnasLotes*.dc.html`, `Inventario*.dc.html` y
`Tabla.dc.html`. Se sigue lo que ya hace `dev`: «Costo» es el costo unitario; todos los productos
llevan el chevrón «Mostrar lotes de X» con sus estados de carga, error y «Sin lotes con
existencia.». No se ha tocado `components/shared` (ni `data-table-types.ts`): `data-product-id`
llega al disparador por propagación del spec, igual que `data-order-id` en pedidos
(`ProductRowActionsSpec = RowActionsSpec & Pick<RowActionsMenuProps, 'triggerDataAttributes'>`).
Tampoco el catálogo: `ProductRowDialogs` es subcomponente interno de la ruta (excepción declarada en
`design.md > Lo que ya existe`).

### Archivos creados / modificados

Producción (`app/(private)/inventario/components/`):
- `product-row-actions.tsx` (T3a): `ProductRowAction`, `productRowActionsSpec` (Lotes, Historial,
  Ajustar existencia solo con `canAdjust`, Editar, separador y Borrar destructivo; iconos `Layers`,
  `History`, `Scale`, `Pencil`, `Trash2`; testids de hoy más `product-history-open` y
  `product-adjust-open`; `triggerLabel` de `productRowActionsLabel`; `title` = nombre sin la
  presentación). `ProductRowActions` pasa a envoltorio de `RowActionsMenu` con `onAction`,
  `presentation` y `texts`; ya no monta paneles.
- `product-row-dialogs.tsx` (T3b, nuevo): `batchTarget` y `ProductRowDialogs`. Para `history` y
  `adjust` pide `loadBatches ?? listProductBatchesAction` (E12); un lote → historial o ajuste de ese
  lote; ninguno, varios o error → «Lotes» (que vuelve a pedir y pinta su error). Mientras se piden no
  abre nada. Edición y borrado llevan `key` = producto (conservan su estado entre aperturas, como
  cuando vivían en la fila: el caso «heredado» de `confirm-dialog-montado` sigue igual); lotes,
  historial y ajuste se remontan en cada elección (en producto terminado dependen de la línea).
- `product-columns.tsx` (T3b): `ProductColumnsDeps.rowActions` → `menu: (product) => RowActionsSpec`;
  columna con `actionsColumn({ menu })` y spec sin ítems para `batch` y `batchesStatus` (E2).
- `finished-stock-columns.tsx` (T3b): `lineActions` → `menu: (parent, line) => RowActionsSpec`; la
  fila de grupo devuelve spec sin ítems.
- `product-table.tsx` (T3b, T3c): un `ProductRowDialogs` con `active`/`open` (cerrar no suelta
  `active`); `PRODUCT_TABLE_TEXTS` gana `cardActions` y `closeMenu`; `card` de E1 con
  `productTableCard(showType)` en `useMemo` (`status: 'type'` solo en «Todos»; `meta`: presentación,
  existencia, costo, alerta, disponible).
- `finished-stock-table.tsx` (T3b, T3c): un `ProductRowDialogs`; cada línea pasa su
  `loadLineBatches`; `card` = `{ primary: image, status: orderNumber, title: name, meta:
  [presentationName, stock, qtyAlert] }` (E11: el título lleva el enlace a la ficha y, en el grupo,
  el conmutador).
- `batch-history.tsx` (para T3b; **prop mínima, sin cambio de aspecto**): `open?`/`onOpenChange?`
  opcionales. Con `open` pide los asientos tras pintar (estado `queued`, el patrón de
  `ProductBatchesSheet`). Sigue siendo el `Collapsible` de hoy con su disparador: T4b lo pasa a
  diálogo.
- `adjust-batch-dialog.tsx` (para T3b; **prop mínima, sin cambio de aspecto**): `open?`/`onOpenChange?`
  opcionales. Con `open` no pinta disparador, reinicia el formulario al abrirse como al pulsarlo y
  avisa `onOpenChange(false)` tras un ajuste sin sobre-reserva. Sin ellos, igual que hoy. Lo demás de
  D10 (`productName`, campo deshabilitado, «Elige un motivo.») es de T4c.
- `index.ts`: exporta `productRowActionsSpec`, `ProductRowAction`, `ProductRowActionsSpec`,
  `ProductRowActionsSpecInput`, `PRODUCT_ACTION_HISTORY_TESTID`, `PRODUCT_ACTION_ADJUST_TESTID`,
  `PRODUCT_ROW_ACTION_LABELS`, `ProductRowDialogs`, `batchTarget` y sus tipos
  (`product-route-contract.test.ts` exige que el barrel reexporte todo componente de la ruta).

Tests:
- Nuevos: `tests/unit/inventario/product-row-actions.test.tsx` (9), `product-row-dialogs.test.tsx`
  (15), `product-cards.test.tsx` (19).
- `finished-stock-table.test.tsx`: el conmutador se busca en la tabla; el menú de la línea afirma
  los cinco ítems en orden; casos nuevos R12 («Historial» de una línea pide los lotes de ese pedido y
  producto y abre su historial) y R12 (la fila del pedido no pinta menú ni en fila ni en tarjeta).
- Acotados al cuerpo visible (la tabla: `enLaTabla()` o el primer disparador) por los duplicados de
  la tarjeta: `product-page.test.tsx`, `product-batch-rows.test.tsx`, `product-batches-sheet.test.tsx`,
  `product-stock-alert.test.tsx`, `product-type-column.test.tsx` y `confirm-dialog-montado.test.tsx`
  (`disparadorDeLaFila`; el borrado ya vive en el anfitrión). `product-page`, `product-type-column`
  y `tablas-marca` pasan `menu` en vez de `rowActions`/`lineActions` a los constructores de columnas.
- `tests/unit/paridad/acciones-por-fila.test.tsx`: al desplegar producto terminado solo pulsa los
  conmutadores de las filas (el de la tarjeta lo volvía a plegar y la línea desaparecía del
  inventario).
- Snapshots regenerados: `acciones-por-fila` (4) e `inventario-paridad` (5).
- `e2e/helpers/product-name-cell.ts`: revisado, **sin cambio**. Filtra filas `data-table-row-` que
  tengan la celda de nombre pedida **y** la de presentación con ese texto exacto; la sub-fila de lote
  tiene la celda de presentación vacía y su nombre es el `dl` del lote, así que no casa. Las tarjetas
  (`data-table-card-…`) no casan con el prefijo.

### Diff de los snapshots (fila de `design.md > 6`)

- **`acciones-por-fila`** (4 snapshots, +36 −0): «productos» y «producto terminado» ganan
  `product-history-open` (abre `product-batches-sheet`, porque el doble devuelve cero lotes) y, solo
  con permiso, `product-adjust-open` (igual). Nada más cambia; la fila de grupo sigue `[]`. Casa con
  «ganan «Historial» y, con permiso, «Ajustar existencia»» (R9, R10).
- **`inventario-paridad`** (5 de 13): el contenedor `data-table` gana `@container` y la tabla
  `@max-[760px]:hidden` (también en los estados vacío y sin resultados, que montan `card`); con filas
  aparece `ul data-testid="data-table-cards"` con la tarjeta (imagen, «Tipo» en «Todos», nombre con
  el conmutador, cifras y «Acciones» con `aria-haspopup="dialog"`). El disparador de la fila es el
  mismo árbol. Casa con «`actionsColumn`, tarjetas» (R9, R13).

### Mapa R → test

| R | Test |
| --- | --- |
| R9 | `product-row-actions.test.tsx`: «R9 — ofrece Lotes, Historial…», «R9, R14 — solo «Borrar» lleva separador…», «R9 — el disparador se llama…», «R9 — cada item avisa…», «R9, R14 — el desplegable pinta los cinco items…», «R9 — elegir un item…»; `finished-stock-table.test.tsx` > «muestra una sub-fila…» (cinco ítems en orden); snapshot `acciones-por-fila` |
| R10 | `product-row-actions.test.tsx` > «R10 — sin permiso de ajuste…»; snapshot `acciones-por-fila` (R22, solo consulta) |
| R11 | `product-row-dialogs.test.tsx`: `batchTarget`, «R11 — «Historial» con un lote…», «R11 — «Ajustar existencia» con un lote…», «R11 — «Historial» sin lotes / con varios lotes…», «R11 — «Ajustar existencia» con varios…», «R11 — con un error…», «R11 — lee todos los lotes, no solo los vivos…», «R11 — mientras se piden…» |
| R12 | `product-row-dialogs.test.tsx`: «R12 — «Lotes»…», «R12 — «Editar»…», «R12 — «Borrar»…», «R12 — un solo panel montado…», «R12, R47 — desplegado, ni las sub-filas…», «R12, R47 — la sub-fila de estado…»; `finished-stock-table.test.tsx`: «R12 — «Historial» de una linea…», «R12 — la fila del pedido no pinta menu…» y los de hoy (lotes, baja y edición desde la línea); `product-cards.test.tsx` > «R12, R13 — elegir «Lotes»…», «R12, R13 — la linea tiene su «Acciones»…» |
| R13 | `product-cards.test.tsx`: «cada producto en su tarjeta» (×7), ««Acciones» abre el menu…» (×4), «producto terminado en tarjetas» (×4); `product-row-actions.test.tsx` > «R13 — el titulo…», «R13, R14 — centrado…»; snapshot `inventario-paridad`. La medida real (44/48 px, umbral de 760) es del E2E (T7a) |
| R14 | `product-row-actions.test.tsx` > «R9, R14 …» (desplegable) y «R13, R14 — centrado…»; `product-cards.test.tsx` > «R13, R14 — el dialogo se titula…» |
| R8 (tarjeta) | `product-cards.test.tsx` > «R8, R13 — por debajo de la alerta…» y «R8, R13 — la linea por debajo de la alerta…» |
| R47 | `product-cards.test.tsx` > «las sub-filas de lote salen como tarjetas…» (lote, cargando, vacío y error con «Reintentar»); `product-row-dialogs.test.tsx` > «R12, R47 …» ×2 |
| R53 | `product-cards.test.tsx` > «R13, R53 — en «Todos», «Tipo»…», «R13, R53 — con un tipo filtrado…», «R13, R53 — las cifras…», «R13, R53 — la linea es una tarjeta con el enlace a la ficha…» |

### Salida real

```
$ pnpm run typecheck
> tsc --noEmit
(sin errores)

$ pnpm run lint
ESLint: 0 errors, 10 warnings in 4 files
  (no-unused-vars en confirm-catalog-import.test.ts, list-execution-traces.test.ts,
   order-service.test.ts y step-evidence.tsx: ninguno de esta tanda)

$ pnpm exec vitest run tests/unit/inventario/product-row-actions.test.tsx
      Tests  9 passed (9)
$ pnpm exec vitest run tests/unit/inventario/product-row-dialogs.test.tsx
      Tests  15 passed (15)
$ pnpm exec vitest run tests/unit/inventario/product-cards.test.tsx      (primera pasada)
     × R8, R13 — la linea por debajo de la alerta lleva el aviso tambien en la tarjeta
      Tests  1 failed | 18 passed (19)
   → el fixture tenía la existencia del producto por encima de la alerta; con stock 1.5:
      Tests  19 passed (19)

$ pnpm exec vitest run tests/unit/paridad/inventario-paridad.test.tsx tests/unit/paridad/acciones-por-fila.test.tsx -u
  Snapshots  9 updated      (el de producto terminado perdía la línea: arreglado el despliegue
                             del test, snapshot restaurado con git y regenerado)
$ pnpm exec vitest run tests/unit/paridad/acciones-por-fila.test.tsx -u
  Snapshots  4 updated
 Test Files  1 passed (1)
      Tests  16 passed (16)

$ pnpm exec vitest related --run <los 8 de producción + 11 de test modificados + 3 nuevos>
 Test Files  37 passed (37)
      Tests  631 passed (631)

$ pnpm exec vitest run tests/unit/inventario/adjust-batch-dialog.test.tsx tests/unit/inventario/batch-history.test.tsx tests/unit/inventario/product-batches-panel.test.tsx tests/unit/inventario-ui/envase-en-inventario.test.tsx
 Test Files  4 passed (4)
      Tests  79 passed (79)

$ pnpm exec vitest run guard
 Test Files  80 passed (80)
      Tests  1096 passed | 20 skipped (1116)
```

### Para el leader

1. **Historial con un lote, interino hasta T4b.** `BatchHistory` sigue siendo el desplegable en
   línea de hoy (con su disparador); el anfitrión lo pinta **debajo de la tabla** solo mientras está
   abierto. Funciona y se cierra con su propio disparador, pero no es el diálogo del tablero: T4b lo
   convierte en `Dialog` y el anfitrión no cambia de props.
2. **Tablero contra spec, sin decidir nada:** la ficha del tablero dice que en tablet (820) la tabla
   con sub-filas hace scroll; R13/P12 y T0b dicen que a 820 el contenedor queda bajo 760 y salen
   tarjetas. Se ha seguido el spec (umbral de `DataTable`). El tablero de teléfono pinta las cifras
   con rótulo («Existencia 12»), el chevrón como botón «Mostrar lotes» al pie y las tarjetas de lote
   con fondo suave y animación de subida; E1 dice «tarjeta de `DataTable` sin extensión», así que
   salen sin rótulos, con el chevrón en el título, con la sangría `pl-12` de hoy y sin fondo propio.
3. **`title` del menú centrado** = nombre sin la presentación (lo que pinta la celda, R53); el
   disparador conserva «Acciones de <nombre · unidad>» con el nombre guardado.

### Veredicto

T3a, T3b y T3c hechas y en verde (typecheck, lint sin errores, 37 archivos relacionados y guardias);
los diffs de `acciones-por-fila` e `inventario-paridad` casan con su fila de `design.md > 6`.

## Tanda 4 (T4b, T4c) — 2026-10-16 · frontend_dev

Tablero: `docs/diseno/canvas/ModalesInventario.dc.html` («Dialog · Historial del lote», «Dialog ·
Ajustar existencia» en disminución y en aumento sin motivo). En paralelo con T4a (otro frontend_dev,
mismo worktree): no se han tocado sus archivos ni `index.ts`.

### Archivos creados / modificados

Producción (`app/(private)/inventario/components/`):
- `movement-reason-label.ts` (T4b, D9/E6): `Record<MovementReason, string>` exhaustivo (Merma,
  Rotura, Conteo físico, Error de carga) en vez de derivar + `ACCENTED_LABELS`. El barrel no cambia.
- `batch-history.tsx` (T4b, D8/E7): de `Collapsible` a `Dialog` controlado con las props de D8
  (`batchLot`, `open` y `onOpenChange` obligatorias: los dos consumidores, el anfitrión y el panel
  de T4a, ya lo abren controlado). Título «Historial del lote <lote>» con el lote en
  `font-mono tabular-nums`; `DialogContent` con `sm:max-w-[min(1000px,calc(100%-2rem))]` (más
  `max-h-[calc(100dvh-2rem)] overflow-y-auto` para que un historial largo quede entero, R42). Asientos en
  un `DataTable` local con las ocho columnas, paginado en cliente como `ImportRowsTable`, `card` =
  `{ primary: 'kind', status: 'quantity', meta: resto }`; testids de hoy dentro de cada celda y
  `batch-history-list` envolviendo la tabla; nulo → `EMPTY_MARK` sin testid. Sin disparador ni
  `TOUCH_TARGET`. Pide la primera vez que `open` pasa a `true` y nunca más.
- `adjust-batch-dialog.tsx` (T4c, D10): `productName?`; descripción «<producto> · Lote <lote>» (sin
  nombre, «Lote <lote>»; lote en mono); «Existencia registrada» como `Input disabled` sin `name`
  (`adjust-batch-recorded-stock` sobre el campo) junto a «Total contado» en rejilla de dos columnas
  desde `sm`; diferencia en panel con `ArrowDownToLine`/`ArrowUpFromLine`; «Elige un motivo.» en
  `FieldError` bajo el selector con icono, `aria-invalid` y `aria-describedby` en el disparador;
  ayuda «Para aumentar solo valen Conteo físico y Error de carga.» solo con aumento (también en el
  `aria-describedby`). Envío, resto de avisos y sobre-reserva sin cambio.
- `product-row-dialogs.tsx` (anfitrión): pasa `productName={productNameWithoutPresentation(product)}`
  al ajuste y monta el historial siempre (ya no `open ? … : null`; el diálogo se cierra solo). Se
  quita el comentario «desplegable en línea», que dejó de ser cierto.

Tests:
- `tests/unit/inventario/batch-history.test.tsx`: reescrito para el diálogo (24 casos).
- `tests/unit/inventario/adjust-batch-dialog.test.tsx`: existencia registrada por `toHaveValue`; R25
  ampliado; describe nuevo «aspecto del rediseño» (7 casos); los dos casos R21 de QC-92 ya no montan
  `ProductBatchesPanel` (T4a le quita `renderBatchActions`) y prueban `AdjustBatchDialog` solo, también
  abierto desde fuera.
- `tests/unit/inventario/product-row-dialogs.test.tsx`: el historial con un lote se busca como diálogo
  «Historial del lote L-001» sin disparador; el ajuste afirma «Acido citrico · Lote L-777».

### Mapa R → test

| R | Test |
| --- | --- |
| R21 | `batch-history.test.tsx`: «R21 — se titula…», «R21 — la tabla tiene las ocho columnas…», «R21 — los asientos salen en el orden…», «R21 — un dato ausente pinta «—»…», «R21 — sin autor…» («Sistema»), «R21 — la cantidad…», «R21 — un ajuste con existencia anterior…», «R21 — las fixtures…», «R21 — un asiento de entrega…», «R21 — cada tipo…», «R21 — un mismo id en los dos libros…», «R21 — controlado, no pinta disparador»; `product-row-dialogs.test.tsx` > «R11 — «Historial» con un lote…» |
| R22 | `batch-history.test.tsx`: «R22 — mientras llegan…», «R22 — sin ningun asiento…», «R22 — el error de carga…», «R22 — cerrado no pide nada; pide la primera vez…» (una sola llamada) |
| R23 | `batch-history.test.tsx`: «R23 — cerrar el historial con Escape no cierra el panel», «R23 — cada asiento tiene también su tarjeta…». El umbral de 760 px es del E2E (T7) |
| R52 | `batch-history.test.tsx` > «R52 — el diálogo llega a 1000 px…» (clase); la medida es del E2E |
| R24 | `adjust-batch-dialog.test.tsx`: «R24 — debajo del título…», «R24 — sin el nombre…», «R24 — «Existencia registrada» es un campo deshabilitado…», «R24 — la diferencia lleva una flecha…», «R24 — los motivos se leen con tilde…», «R24 — en modo controlado no pinta disparador…», R4 (motivos por sentido, con tilde) y R8–R11 de hoy (envío y avisos); `batch-history.test.tsx` > «R24, R46 — «%s» se lee «%s»» ×4 |
| R25 | `adjust-batch-dialog.test.tsx` > «R25 — sin motivo, «Elige un motivo.» sale bajo el campo…» |
| R26 | `adjust-batch-dialog.test.tsx` > «R26 — la ayuda de aumento sale solo mientras…» |
| R46 | `batch-history.test.tsx` > «R24, R46 …» ×4 y «R46 — hay un caso por cada motivo del dominio»; el mapa es `Record<MovementReason, string>` (no compila sin un texto); `grep "Elegi un motivo\|Conteo fisico" app/(private)/inventario` vacío; `batch-history.tsx` sin `TOUCH_TARGET` |

### Salida real

```
$ pnpm exec vitest run tests/unit/inventario/batch-history.test.tsx
 Test Files  1 passed (1)
      Tests  24 passed (24)

$ pnpm exec vitest run tests/unit/inventario/adjust-batch-dialog.test.tsx tests/unit/inventario/product-row-dialogs.test.tsx
 Test Files  2 passed (2)
      Tests  52 passed (52)

$ pnpm run typecheck
> tsc --noEmit
(sin errores; una pasada intermedia falló solo en product-batches-panel.test.tsx de T4a, en curso)

$ pnpm run lint
✖ 10 problems (0 errors, 10 warnings)
  (no-unused-vars en confirm-catalog-import.test.ts, list-execution-traces.test.ts,
   order-service.test.ts y step-evidence.tsx: ninguno de esta tanda. Una pasada intermedia dio
   react-hooks/set-state-in-effect en batch-history.tsx: corregido, el estado «queued» ya pinta
   la carga y no hace falta pasar a «loading» dentro del efecto)

$ pnpm exec vitest related --run <batch-history.tsx, movement-reason-label.ts, adjust-batch-dialog.tsx, product-row-dialogs.tsx y sus 3 tests>
 Test Files  44 passed (44)
      Tests  823 passed (823)

$ pnpm exec vitest run guard
 Test Files  80 passed (80)
      Tests  1096 passed | 20 skipped (1116)
```

### Para el leader

1. **Fila del historial: `data-table-row-<kind>-<id>`** (y `data-table-card-<kind>-<id>`). El dominio
   dice que solo `kind` + `id` es único en la unión de los dos libros (`reservation.ts`), así que
   `getRowId` usa el par, como la `key` de hoy. El contenedor por asiento `batch-history-entry-<id>`
   desaparece (las celdas conservan `batch-history-entry-kind|quantity|…` y la tabla va dentro de
   `batch-history-list`). Para T7b: `ajuste-de-inventario.spec.ts` (líneas 394, 403, 518) pasa a
   `data-table-row-adjustment-<id>` / `data-table-row-opening-<id>`, y `reserva-de-material.spec.ts`
   (764–771) filtra `li` dentro de `batch-history-list`: ahora son las tarjetas (ocultas por encima
   de 760 px); debe filtrar `tr` o `data-table-row-`. Con un nulo, la celda ya no omite el campo:
   pinta «—» sin el testid, así que los `toHaveCount(0)` de 405–406 siguen valiendo.
2. **La tarjeta del historial sale sin rótulos** («Existencia anterior 0,00» del tablero de teléfono):
   la tarjeta de `DataTable` solo pinta el contenido de la celda (E1, sin extensión), y los nulos salen
   como «—» sueltos en `meta`. Es lo que D8 pide; el tablero muestra rótulos y omite los nulos.
3. **`productName` del ajuste** = nombre sin la presentación (lo que pinta la celda y el `title` del
   menú), sin unidad, como en el tablero. El panel «Lotes» de T4a aún no lo pasa a su
   `AdjustBatchDialog`: falta `productName={productNameWithoutPresentation(product)}` allí.
4. **`guard-piezas-base`: la exclusión de `batch-history.tsx` (`ARCHIVOS_D11`) ya se puede quitar.**
   El archivo no declara el par táctil ni una constante «—» (usa `EMPTY_MARK`), no compara el código
   inesperado ni usa locales borrados. No se ha quitado (es T6b) ni probado sin ella.
5. El tablero pinta la cantidad con signo (`+120,00`) y fechas `dd/mm/aaaa`; R21 manda los de hoy
   (`20`, `2026-09-15 10:00`), y así sale.

### Veredicto

T4b y T4c hechas y en verde (typecheck, lint sin errores, 44 archivos relacionados y guardias); sin
tocar archivos de T4a.

- **Arreglo T4c (contrato «sin busqueda ni orden»):** `adjust-batch-dialog.tsx` componía `aria-describedby` con `.filter((id) => id !== '')`, texto que `product-route-contract.test.ts` prohíbe en la ruta; ahora se arma con spreads condicionales (`[...(reasonError ? [reasonErrorId] : []), ...(isIncrease ? [increaseHintId] : [])].join(' ')`), mismo resultado, test sin tocar. Ningún otro archivo cambiado de la ruta rompe el contrato (`importar/` está fuera de su alcance). Salida: `vitest run product-route-contract.test.ts adjust-batch-dialog.test.tsx` → `Test Files 2 passed (2) · Tests 61 passed (61)`; `pnpm run typecheck` → `tsc --noEmit` sin salida (exit 0); `pnpm run lint` → `✖ 10 problems (0 errors, 10 warnings)` (exit 0, avisos ajenos).

## Tanda 4 (T4a) — 2026-10-16 · frontend_dev

Tablero: `docs/diseno/canvas/ModalesInventario.dc.html` («Sheet · Lotes»: etiqueta, tabla a 900 px y
tarjetas). En paralelo con T4b/T4c (otro frontend_dev): no se han tocado `batch-history.tsx`,
`movement-reason-label.ts`, `adjust-batch-dialog.tsx` ni sus tests; el panel usa `BatchHistory` y
`AdjustBatchDialog` por su API controlada.

### Archivos creados / modificados

Producción (`app/(private)/inventario/components/`):
- `product-batch-columns.tsx` (nuevo, D7): `buildProductBatchColumns({ units, product, menu })` con
  `lot` (con «Sobre-reservado» como `StatusBadge` `danger`), `quantity` (envases debajo),
  `purchaseDate`, `expiryDate` (`ExpiryDate as="span"`, con relativo y chip; sin fecha, «—» sin
  testid), `reserved`, `available` (en negrita, como el tablero) y `actionsColumn({ menu })` si hay
  menú. Todas `tabular`; las cifras `align: 'end'`. Sin apartado/disponible, «—» sin testid. Las
  funciones de cantidad (`formattedQuantity`, `exactQuantity`, `packageCountLabel`, unidad del
  envase) se mudan aquí sin cambiar. También `PRODUCT_BATCHES_CARD`, `PRODUCT_BATCHES_TABLE_ID`
  (`inventario-lotes`) y `PRODUCT_BATCHES_TABLE_TEXTS`.
- `product-batches-panel.tsx` (D7): `DataTable` local (patrón `ImportRowsTable`: `createDefaultParams`,
  `searchable={false}`, paginación en cliente), `getRowId = batch.id`, `card` de D7. Ranura
  `batchMenu`; salen `renderBatchDetail` y `renderBatchActions`. Conserva `product-batches-panel`, la
  línea de presentación y el vacío.
- `product-batches-sheet.tsx` (D7): «Lotes» encima del `SheetTitle` (`product-batches-label`, estilo
  `.lab` del tablero), `SheetContent` con `data-[side=right]:w-full data-[side=right]:sm:max-w-[900px]`,
  cuerpo con `px-4 pb-4` y scroll vertical. Menú de cada lote: «Historial» (`batch-history-trigger`) y,
  con `canAdjust`, «Ajustar existencia» (`adjust-batch-open`); disparador «Acciones del lote <lote>»,
  `title` = lote. Abre `BatchHistory` o `AdjustBatchDialog` de ese lote en modo controlado (remontados
  en cada elección), con `productName` = nombre sin presentación (nota 3 de T4b/T4c). Tras un ajuste se
  vuelven a pedir los lotes: `fetchBatches` pasa a `useCallback`, porque el ajuste ya no vive dentro
  del panel (que se desmonta al recargar) y su efecto de éxito depende de `onAdjusted`; con una función
  nueva por render pedía los lotes en bucle.
- `expiry-date.tsx` (E5): `as?: 'dd' | 'span'`, por defecto `'dd'` (la sub-fila no cambia).
- `index.ts`: exporta lo nuevo de `product-batch-columns.tsx` y `BATCH_HISTORY_ITEM_TESTID`,
  `BATCH_ADJUST_ITEM_TESTID`, `batchActionsLabel`.

Tests:
- `tests/unit/inventario/product-batches-panel.test.tsx`: reescrito (25 casos). Las tres líneas
  (`product-batch-line-*`) se sustituyen por columnas, testids en su celda, sin `dd`/`dl`; las de
  vencimiento relativo y «Vencido» se conservan dentro de la celda (y en la tarjeta).
- `tests/unit/inventario/product-batches-sheet.test.tsx`: acotado a `data-table-row-<id>`; casos
  nuevos de etiqueta, ancho, estados, menú con y sin permiso, historial y ajuste con recarga única.
- `tests/unit/inventario-ui/envase-en-inventario.test.tsx`: lee la fila de la tabla (duplicado de la
  tarjeta).
- `tests/unit/marca/tablas-marca.test.tsx` (R12 de QC-227, enmienda § 10): el valor no es `DD` y su
  celda lleva `font-mono tabular-nums`; seis cabeceras sin mono; ningún `dl/dt/dd`.
- `tests/unit/marca/badges-estado.test.tsx` (R7 de QC-227, enmienda § 10): `data-tone="danger"`, con
  las clases del tono error de hoy.
- `tests/unit/inventario/decimal-quantity-convenciones.test.ts`: vigila también
  `product-batch-columns.tsx`, adonde se mudan las cuentas de cantidad (siete → ocho archivos).

Snapshots: ninguno cambia (`tests/unit/paridad`, 22 archivos, en verde sin `-u`).

### Mapa R → test

| R | Test |
| --- | --- |
| R15 | `product-batches-panel.test.tsx`: «R15 — columnas…», «R15 — lote, cifras y fechas en cifras tabulares…», «R15 — cada lote es una fila…», «R15 — la disposicion en tres lineas desaparece…», «R15 — sin vencimiento…», «R15, R48 — ámbar bajo 30 dias…», «R15 — la tarjeta conserva el relativo…»; `product-batches-sheet.test.tsx` > «R15 — pinta «Lotes» encima del titulo…»; `tablas-marca.test.tsx` > «R12: lote, cantidades y fechas del panel van en celdas Mono…» |
| R16 | `product-batches-panel.test.tsx`: «R16 — division exacta…», «R16 — un solo envase…», «R16 — division no entera…», «R16 — la linea de presentacion…», «R16 — lista vacia…»; `product-batches-sheet.test.tsx`: «R16 — mientras se piden…», «R16 — sin lotes…», «el estado de error se distingue…»; `envase-en-inventario.test.tsx` > «R6: un lote de envase…», «R6: el lote de un envase legado…» |
| R17 | `product-batches-panel.test.tsx` > «R17 — un lote sobre-reservado…», «R17 — sin sobre-reserva…»; `badges-estado.test.tsx` > «R7: «Sobre-reservado» del panel de lotes es un StatusBadge…» |
| R18 | `product-batches-panel.test.tsx` > «R18 — `batchMenu` se pide por lote…», «R18 — sin `batchMenu`…»; `product-batches-sheet.test.tsx` > «R18 — con permiso…», «R18 — sin permiso…», «R18 — «Historial» abre…», «R18 — «Ajustar existencia» abre… se vuelven a pedir los lotes», «con canAdjust el control de ajuste SI existe, en el menu del lote» |
| R19 | `product-batches-panel.test.tsx` > «R19 — la tarjeta lleva lote, «Cantidad»…», «R19 — la tarjeta tiene el boton «Acciones» de 44 px…», «R19 — sin `batchMenu`…». El umbral de 760 px es del E2E (T7) |
| R20 | `product-batches-sheet.test.tsx` > «R20 — mide hasta 900 px…» (clase); la medida es del E2E (T7) |
| R48 | `product-batches-panel.test.tsx` > «R15, R48 — ámbar bajo 30 dias…» |

### Salida real

```
$ pnpm run typecheck
> tsc --noEmit
(sin errores)

$ pnpm run lint
ESLint: 0 errors, 10 warnings in 4 files
  (no-unused-vars en confirm-catalog-import.test.ts, list-execution-traces.test.ts,
   order-service.test.ts y step-evidence.tsx: ninguno de esta tanda)

$ pnpm exec vitest run tests/unit/inventario/product-batches-sheet.test.tsx   (primera pasada)
      Tests  1 failed | 14 passed (15)
   → «R18 — Ajustar existencia…»: los lotes se pedían en bucle (ver `useCallback` arriba). Después:
      Tests  15 passed (15)

$ pnpm exec vitest run tests/unit/paridad
 Test Files  22 passed (22)
      Tests  415 passed (415)

$ pnpm exec vitest related --run <product-batch-columns.tsx, product-batches-panel.tsx, product-batches-sheet.tsx, expiry-date.tsx, index.ts y los 6 tests tocados>
 Test Files  38 passed (38)
      Tests  662 passed (662)

$ pnpm exec vitest run guard
 Test Files  80 passed (80)
      Tests  1096 passed | 20 skipped (1116)

$ pnpm exec vitest run tests/unit/inventario/product-route-contract.test.ts
     × la pantalla no ofrece busqueda ni control de orden
   AssertionError: app/(private)/inventario/components/adjust-batch-dialog.tsx no debe contener «filter(»
   (archivo de T4c, no de esta tanda; los cuatro de T4a no contienen ninguno de los patrones)
```

### Para el leader

1. **Rojo de T4c en `product-route-contract.test.ts`** (no es guardia ni lo saca `vitest related`, que
   no sigue lecturas de `fs`): `adjust-batch-dialog.tsx` contiene `filter(`. No se ha tocado.
2. **La tarjeta del lote sale sin rótulos**: el tablero de teléfono pinta «Cantidad 120,00»,
   «Apartado …» y R19 nombra esos campos; la tarjeta de `DataTable` solo pinta el contenido de la
   celda (igual que en T3 y en el historial de T4b). Sale el orden de D7 sin rótulos.
3. **Fechas a la izquierda**: el tablero alinea a la derecha también «Fecha de compra» y
   «Vencimiento» (clase `num`); R15 y D7 dicen «las cifras a la derecha» y el repo alinea las fechas a
   la izquierda (`finished-product-batches-table.tsx`). Se sigue el spec: solo las cantidades a la
   derecha.
4. Los textos de las tres líneas desaparecen con ellas; para T7b, `e2e/insumo-por-unidad.spec.ts`
   (264, 305) lee `product-batch-quantity` dentro del panel, que ahora sale dos veces (fila y
   tarjeta): hay que acotarlo a `data-table-row-<id>`, como dice `design.md > 7`.

### Veredicto

T4a hecha y en verde (typecheck, lint sin errores, 38 archivos relacionados, paridad sin cambios y
guardias); el único rojo visto es de T4c.

## Tanda 6 (T6a-T6c) — 2026-10-16 · frontend_dev

### Archivos creados / modificados

- `app/(private)/inventario/importar/components/import-texts.ts`: `UNIT_CREATED_TOAST` («Unidad
  creada.») y `PRESENTATION_CREATED_TOAST` («Presentación creada.»); salen por el barrel (`export *`).
- `app/(private)/inventario/importar/components/import-create-unit-dialog.tsx` y
  `import-create-presentation-dialog.tsx`: `toast.success(<texto>)` antes de `onCreated()` cuando el
  resultado es `success` (D11). Los toasts del desenlace de `inventory-import-screen.tsx` (da435d96)
  no se tocan (E10).
- `tests/unit/inventario/inventario-toasts.test.tsx` (nuevo): `sonner` simulado; los seis éxitos de
  la ruta (alta y edición con `ProductForm` sustituido por un botón que llama a `onSaved`, porque el
  aviso lo lanza `ProductSheet`; ajuste; borrado; alta de unidad y de presentación desde «Faltan en
  el catálogo»), un caso con la revisión siguiente rechazada (éxito del alta + `toast.error` del
  rechazo, R51) y un alta con error sin aviso de éxito.
- `tests/guards/guard-inventario-rediseno.test.ts` (nuevo): siete reglas con el compilador de TS
  (los comentarios no cuentan) y un caso en negativo por regla sobre fuentes inventados; barrido de
  `app/(private)/inventario/**` (65 archivos, mínimo 50) con la lista de vigilados presente.
  - `texto-retirado` (R4, R46): «Elegi un motivo», «Conteo fisico», «Mostrando todos los tipos»,
    «Filtrando por».
  - `existencia-en-rojo` (R7, E13): `text-destructive` en `stockAmountCell` / `packagedStockCell` y en
    lo que nombran, de forma transitiva en el archivo o en un hermano importado por ruta relativa
    (así `BELOW_ALERT_CLASS`, que `finished-stock-columns.tsx` importa de `product-columns.tsx`, entra);
    el error de la sub-fila no se ve (caso propio que lo comprueba en el archivo real).
  - `vencimiento-en-rojo` (R48, E4/E13): `EXPIRING_CLASS` sin `text-destructive`.
  - `volver-como-enlace` (R30): «Volver a inventario» / `IMPORT_BACK_LABEL` dentro de `Link` o `a`;
    `importar/page.tsx` sin `ArrowLink` con la etiqueta.
  - `plantilla-fuera-de-cabecera` (R30): `<ImportTemplateButton>` fuera de `actions` de `PageHeader`;
    «Descargar plantilla» / `TEMPLATE_BUTTON_LABEL` fuera de `import-texts.ts` e
    `import-template-button.tsx`.
  - `motivo-derivado` (R46, E6): `movementReasonLabel` sin llamadas en su cuerpo, mapa
    `Record<MovementReason, string>` entero (no `Partial`) con las cuatro etiquetas con tilde.
  - `tactil-propia` (R46, D41): `batch-history.tsx` sin el par `min-h-11 min-w-11`.
- `tests/guards/guard-piezas-base.test.ts` (D41): `batch-history.tsx` pasa a `D11_SIN_HALLAZGOS`
  (el mismo camino con el que QC-232/QC-265 retiraron las suyas): deja de estar en `EXCLUSIONES` y
  sigue en `ARCHIVOS_D11` porque R33 de QC-231 vigila esa lista. El caso existente de
  `D11_SIN_HALLAZGOS` comprueba que un par nuevo en él cuenta y que hoy no da hallazgos.
- T6c: sin cambios. La fila de `RowActionsMenu` en `components/shared/CATALOGO.md` ya nombra
  `triggerTestId`, `triggerDataAttributes`, `presentation` (`dropdown`/`centered`), `title`,
  `texts.actions`, `texts.close` y por ítem `disabled`, `destructive`, `testId`, `separatorBefore`,
  `href`/`onSelect`: cubre todo lo que usa `product-row-actions.tsx`. `components/shared` no se toca.

### Mapa R → test

| R | Test |
| --- | --- |
| R4 | `guard-inventario-rediseno.test.ts` > «R4, R46 — un texto retirado…» y el barrido |
| R7 | `guard-inventario-rediseno.test.ts` > «R7 — `text-destructive` en el cuerpo…», «R7 — la celda empaquetada…», «R7 — el error de la sub-fila…» y el barrido |
| R27 | `inventario-toasts.test.tsx` > «R27 — crear…», «R27 — editar…», «R27 — ajustar…», «R27 — borrar…» |
| R28 | `inventario-toasts.test.tsx` > «R28, R51 — crear una unidad…», «R28, R51 — crear una presentación…», «R28 — un alta de unidad con error…» |
| R30 | `guard-inventario-rediseno.test.ts` > «R30 — «Volver a inventario»…», «R30 — «Descargar plantilla»…» y el barrido |
| R44 | `guard-catalogo-de-componentes` (en `vitest run guard`, verde; fila sin cambios) |
| R46 | `guard-inventario-rediseno.test.ts` > «R4, R46 — …», «R46 — `movementReasonLabel`…», «R46 — `batch-history.tsx`…»; `guard-piezas-base.test.ts` (D41, `D11_SIN_HALLAZGOS`) |
| R48 | `guard-inventario-rediseno.test.ts` > «R48 — `EXPIRING_CLASS`…» y el barrido |
| R51 | `inventario-toasts.test.tsx` > «R28, R51 — si la revisión que sigue al alta se rechaza…» (y los dos de alta: la revisión que llega a vista previa no avisa) |

### Salida real

```
$ pnpm exec vitest run tests/unit/inventario/inventario-toasts.test.tsx
 Test Files  1 passed (1)
      Tests  8 passed (8)

$ pnpm exec vitest run tests/guards/guard-inventario-rediseno.test.ts tests/guards/guard-piezas-base.test.ts
 Test Files  2 passed (2)
      Tests  35 passed | 1 skipped (36)

$ pnpm run typecheck
> tsc --noEmit
(sin errores)

$ pnpm run lint
✖ 10 problems (0 errors, 10 warnings)
  (no-unused-vars en confirm-catalog-import.test.ts, list-execution-traces.test.ts,
   order-service.test.ts y step-evidence.tsx: ninguno de esta tanda)

$ pnpm exec vitest related --run <import-texts.ts, import-create-unit-dialog.tsx, import-create-presentation-dialog.tsx, inventario-toasts.test.tsx, guard-inventario-rediseno.test.ts, guard-piezas-base.test.ts>
 Test Files  11 passed (11)
      Tests  214 passed | 1 skipped (215)

$ pnpm exec vitest run guard
 Test Files  81 passed (81)
      Tests  1106 passed | 20 skipped (1126)

$ pnpm exec vitest run tests/unit/inventario tests/unit/inventario-ui tests/unit/paridad tests/unit/marca
 Test Files  170 passed (170)
      Tests  2703 passed | 5 skipped (2708)
```

El rojo de `product-route-contract.test.ts` que anotó T4a ya no sale (170/170).

### Veredicto

T6a, T6b y T6c hechas y en verde: toasts de alta de unidad y presentación, guardia nueva con su
negativo por regla, exclusión de `batch-history.tsx` retirada y fila de `RowActionsMenu` suficiente.

## Tanda 7 (T7b) — 2026-10-16 · frontend_dev

Sin cambios de producción: ningún E2E reveló un bug del rediseño. Solo se cambian selectores y flujo
a la UI nueva; ningún assert de negocio se relaja.

### Archivos creados / modificados

- `e2e/helpers/row-actions-menu.ts`: `batchActionsTrigger(batchRow)` (disparador «Acciones del lote …»
  de la fila del lote). Sin `data-table` dentro, para no entrar en la lista cerrada.
- `e2e/ajuste-de-inventario.spec.ts`: menú de la fila acotado a `data-table-row-<productId>` (la
  tarjeta oculta repite `product-row-actions`); lote por `data-table-row-<batchId>` dentro del panel;
  «Historial» y «Ajustar existencia» desde el menú del lote; asientos por
  `data-table-row-adjustment-<id>` / `data-table-row-opening-<id>` dentro de `batch-history-list`;
  `adjust-batch-recorded-stock` es ahora un campo (`toHaveValue`); `product-stock` acotado a la fila.
  R21 (operador): con el menú del lote abierto, «Historial» está y `adjust-batch-open` no existe.
- `e2e/reserva-de-material.spec.ts`: lote por `data-table-row-<batchId>`, historial desde el menú del
  lote, asientos filtrados por `[data-testid^="data-table-row-"]` en vez de `li` (ahora tarjetas ocultas).
- `e2e/producto-terminado.spec.ts`: el grupo del pedido se cuenta por fila (`finished-stock-name`
  salía 2 veces: fila y tarjeta); lote por `data-table-row-` del panel; ajuste desde el menú del lote.
- `e2e/insumo-por-unidad.spec.ts`: `product-batch-quantity` acotado a las filas del panel.
- `e2e/datos-de-lote-en-acondicionamiento.spec.ts`: lote por `data-table-row-<batchId>`; la fecha de
  vencimiento se compara exacta admitiendo el relativo detrás («2027-10-16 (vence en 365 días)»).
  **Ese rojo no es del rediseño:** el relativo vive dentro de `product-batch-expiry-date` desde
  08b69744 (dev); `expiry-date.tsx` solo ganó `as` en esta rama.
- `e2e/aislamiento-inventario.spec.ts`: los menús se cuentan dentro de las filas.
- `tests/unit/shared/data-table-alcance.test.ts`: alta de `e2e/ajuste-de-inventario.spec.ts` (49 → 50),
  como pedía `design.md > 7`. T7a sumará `inventario-rediseno.spec.ts` sobre este 50.

Sin cambios y en verde: `inventario.spec.ts`, `inventario-importar.spec.ts`, `pedido-bloqueado.spec.ts`
(E15) y los de solo `inventario-title` (`session`, `login`, `cierre-de-sesiones`).

### Salida real (cada spec por separado, `pnpm exec playwright test <spec>`)

```
inventario.spec.ts                          16 passed (1.6m)   chromium 8/8  webkit 8/8
inventario-importar.spec.ts                  2 passed (44.3s)  chromium 1/1  webkit 1/1
pedido-bloqueado.spec.ts                     2 passed (1.2m)   chromium 1/1  webkit 1/1
ajuste-de-inventario.spec.ts                 8 passed (42.9s)  chromium 4/4  webkit 4/4
  (antes: 8 failed, strict mode: getByTestId('product-row-actions') resolved to 2 elements;
   luego 6 failed por adjust-batch-recorded-stock toHaveText "" -> es un input)
reserva-de-material.spec.ts                  2 passed (1.1m)   chromium 1/1  webkit 1/1
producto-terminado.spec.ts                   2 passed (1.1m)   chromium 1/1  webkit 1/1
  (antes: 2 failed, finished-stock-name toHaveCount 1, received 2)
insumo-por-unidad.spec.ts                    2 passed (25.8s)  chromium 1/1  webkit 1/1
datos-de-lote-en-acondicionamiento.spec.ts   2 passed (1.1m)   chromium 1/1  webkit 1/1
  (antes: 2 failed, expiry-date "2027-10-16 (vence en 365 días)")
aislamiento-inventario.spec.ts               2 passed (19.0s)  chromium 1/1  webkit 1/1
session.spec.ts                              6 passed (16.4s)  chromium 3/3  webkit 3/3
login.spec.ts                               10 passed (20.8s)  chromium 5/5  webkit 5/5
cierre-de-sesiones.spec.ts                   2 passed (17.2s)  chromium 1/1  webkit 1/1

$ pnpm run typecheck
> tsc --noEmit
(sin errores)

$ pnpm run lint
✖ 10 problems (0 errors, 10 warnings)   (los mismos 4 archivos ajenos de tandas anteriores)

$ pnpm exec vitest run tests/unit/shared/data-table-alcance.test.ts tests/guards/guard-identificador-de-request.test.ts
 Test Files  2 passed (2)
      Tests  41 passed | 2 skipped (43)

$ pnpm exec vitest run guard
 Test Files  81 passed (81)
      Tests  1106 passed | 20 skipped (1126)
```

### Mapa R → test

| R | Test |
| --- | --- |
| R45 | los seis E2E de la fila R45 de `tasks.md` (arriba, en verde) |

### Veredicto

T7b hecha: los nueve E2E de `design.md > 7` y los de solo `inventario-title` pasan en Chromium y WebKit, sin tocar producción.

---

## Tanda 7 (T7a) — 2026-10-16 · frontend_dev

E2E nuevo con medidas reales (`boundingBox`, estilos calculados) a 1440 × 900, 820 × 1180 y
390 × 844. El tono se compara color con color: un `span` sonda con `var(--warning-text)` /
`var(--destructive)` junto al elemento, sin depender de cómo serializa cada navegador el `oklch`.

**Bug de producción que destapó (R42), arreglado:** el historial del lote y «Ajustar existencia»
usaban la X por defecto de `DialogContent` (`size="icon-sm"`, 32 px de alto medidos en Chromium):
a 390 px R42 pide botones de 44. Los dos diálogos pasan `showCloseButton={false}` y pintan su propio
`DialogClose` (`size="icon"` + `touch`, misma posición y mismo nombre accesible «Close»), como ya hace
`batch-evidence-dialog.tsx`. No cambia `components/ui/dialog.tsx` ni el resto de diálogos del repo.

### Archivos creados / modificados

- `e2e/inventario-rediseno.spec.ts` (nuevo): 8 casos × 2 navegadores. Fixture Prisma propio
  (`qc263_e2e_`, `RUN_ID` por worker, empresa con añadidos prendidos, «alerta» con un lote en
  alarma y «varios» con dos lotes, uno que vence en 10 días). Selectores acotados a
  `data-table-row-<id>` / `data-table-card-<id>`; menú del lote por `batchActionsTrigger`; menús
  centrados por `getByRole('dialog', { name: <título> })`. La importación usa un .csv propio en
  memoria (misma cabecera que `e2e/fixtures/inventario-importar-mixto.csv`) con una unidad y una
  presentación que faltan.
- `app/(private)/inventario/components/batch-history.tsx`: cierre táctil de 44 px (R42).
- `app/(private)/inventario/components/adjust-batch-dialog.tsx`: cierre táctil de 44 px (R42).
- `tests/guards/guard-identificador-de-request.test.ts`: alta de `inventario-rediseno.spec.ts` en
  `E2E_ESPERADOS`, con el comentario literal de `tasks.md > T7a`.
- `tests/unit/shared/data-table-alcance.test.ts`: alta en su sitio alfabético (entre
  `inventario-importar` e `inventario`), nota con el comentario literal; centinela 50 → 51.
- Arreglo 2026-10-16: `tests/unit/inventario/scope.test.ts` («la pantalla del catalogo vive solo donde
  la declara QC-22…») estaba en rojo por `spec E2E de catalogo inesperado: …inventario-rediseno.spec.ts`.
  Alta de `inventario-rediseno.spec.ts` en su lista cerrada (orden alfabético, entre
  `inventario-importar` e `inventario`) con el comentario literal de T7a; el test no se relaja. Grep
  en `tests/` de listas que nombran `inventario-importar.spec.ts` / `ajuste-de-inventario.spec.ts`:
  solo esa, `guard-identificador-de-request.test.ts` y `data-table-alcance.test.ts` (ya dadas de alta).
  `pnpm exec vitest run tests/unit/inventario/scope.test.ts tests/unit/shared/data-table-alcance.test.ts
  tests/guards/guard-identificador-de-request.test.ts` → `Test Files 3 passed (3) · Tests 45 passed | 2
  skipped (47)`. `pnpm exec vitest run guard` → `Test Files 81 passed (81) · Tests 1106 passed | 20
  skipped (1126)`.

### Mapa R → caso del E2E (`e2e/inventario-rediseno.spec.ts`)

| R | Caso |
| --- | --- |
| R1, R3, R6, R7, R9, R14 | `/inventario a 1440 px › R1, R3, R6, R7, R9, R14 — cabecera, pestañas enlace, …` |
| R47, R48, R6, R12 | `/inventario a 1440 px › R47, R48, R6, R12 — los lotes desplegados pintan sub-filas sin menú, …` |
| R11, R15, R20, R21, R23, R25, R52 | `/inventario a 1440 px › R11, R15, R20, R21, R23, R25, R52 — «Historial» abre el lote único o «Lotes»; …` |
| R13, R5, R52 | `/inventario a 820 px › R13, R5, R52 — la lista en tarjetas, …` |
| R2, R13, R14, R42, R47, R5 | `/inventario a 390 px › R2, R13, R14, R42, R47, R5 — acciones de cabecera a todo el ancho, …` |
| R19, R23, R42 (y R20 a 390) | `/inventario a 390 px › R19, R23, R42 — lotes e historial en tarjetas; historial, ajuste y borrado …` |
| R43 | `R43 — /inventario sin desbordamiento horizontal › R43 — a 1440, 820 y 390 px «Todos» y «Producto terminado» …` |
| R31, R32, R33, R38, R28, R42, R43, R49 | `importar inventario › R31, R32, R33, R38, R28, R42, R43, R49 — los pasos 1 → 2 → 3 → 1, …` |

### Salida real

```
$ pnpm exec playwright test e2e/inventario-rediseno.spec.ts --project=chromium   (primera pasada)
  2 failed
    … R2, R13, R14, R42, R47, R5 …   toEqual: la tarjeta de estado «--batches» (cargando) iba delante
                                     -> el caso espera a las tarjetas de lote antes de leer el orden,
                                        y compara el conjunto (el orden es el de la lectura)
    … R19, R23, R42 …                Error: historial: botón «Close» Expected: >= 44 Received: 32
                                     -> bug R42 (arriba); tras arreglar el historial, el mismo rojo
                                        en «ajuste: botón «Close»» -> mismo arreglo
  6 passed (28.9s)

$ pnpm exec playwright test e2e/inventario-rediseno.spec.ts
  16 passed (2.0m)      chromium 8/8  webkit 8/8
  (una pasada intermedia dio 1 failed en webkit por timeout de carga en loginAndLand -waitForURL
   «load», primer compilado tras limpiar .next/dev/types-; repetido solo ese spec: 16 passed)

$ pnpm exec playwright test e2e/ajuste-de-inventario.spec.ts e2e/insumo-por-unidad.spec.ts
  10 passed (1.9m)      (los dos E2E que pasan por los diálogos tocados y por el «Close» del panel)

$ pnpm exec vitest run guard-identificador-de-request data-table-alcance
 Test Files  2 passed (2)
      Tests  41 passed | 2 skipped (43)

$ pnpm exec vitest run guard
 Test Files  81 passed (81)
      Tests  1106 passed | 20 skipped (1126)

$ pnpm exec vitest related --run app/(private)/inventario/components/batch-history.tsx app/(private)/inventario/components/adjust-batch-dialog.tsx
 Test Files  37 passed (37)
      Tests  603 passed (603)

$ pnpm run typecheck
> tsc --noEmit
(sin errores)
  Nota de entorno: tras cada pasada de Playwright en Windows, `next dev` muere a medio escribir
  `.next/dev/types/validator.ts` y `routes.d.ts` (TS1109/TS1128 solo en esos archivos generados).
  Se borra `.next/dev/types` (artefacto, no versionado) y `tsc` sale limpio.

$ pnpm run lint
ESLint: 0 errors, 10 warnings in 4 files   (los mismos 4 archivos ajenos de tandas anteriores)
```

`guard-e2e-presupuesto` no cuenta specs (mira `actionTimeout` y la matriz del workflow): sin cambio.

### Veredicto

T7a hecha: `e2e/inventario-rediseno.spec.ts` pasa en Chromium y WebKit (16/16), dado de alta en
las dos listas cerradas, y un bug de R42 (cierre de 32 px en historial y ajuste) arreglado en sus
componentes.

## Tanda 8 (T8a) — 2026-10-16 · frontend_dev

Integración de `origin/dev` (`0f71d5af`) con las reglas F1 de `design.md > 12 > Enmienda 2`. El
merge lo abrió el leader (`git fetch origin && git merge origin/dev`); aquí se resolvieron los seis
conflictos y se dejaron en el índice, **sin commit**. Lo que trae `dev` en `HEAD..MERGE_HEAD`: 22
commits (QC-165 completo, 5f2cc171 recetas, 7239dcbf mensajes, 0f135128 dashboard, 070a8c71 specs,
6a665e3f, 5496bd16, fb140780, 6939047b, 0f71d5af). Sin migraciones.

### Qué trae 6939047b

Solo tests, sin código: `product-batch-rows.test.tsx` (7 líneas), `product-page.test.tsx` (6),
`tablas-marca.test.tsx` (2) y el `.snap` de `inventario-paridad` (48). Siguen el orden nuevo de
fb140780 (`Existencia, Disponible, Reservado, Alerta de cantidad, Costo unitario`, costo justo
antes de acciones). Toca Inventario, pero coincide con H4 / R53 de la enmienda 2: **no cambia nada
de este spec**, no hubo que parar.

### Conflictos y resolución

| Archivo | Rama (HEAD) | `dev` | Resolución |
| --- | --- | --- | --- |
| `product-columns.tsx` (2 trozos) | Orden viejo (Costo tras Existencia), todas las cifras `align: 'end'`, `menu` | Orden de fb140780, `align: 'center'`, `rowActions` | Orden, `showType`/`showPresentation`/`showCost`, `costColumn(units)`, `unitCostCell` con moneda y unidad, `COST_COLUMN_LABEL` de `dev`; `align: 'end'` en `available`, `qtyAlert` y también en `costColumn` (`averageUnitCost`, que `dev` dejó `center` fuera del trozo en conflicto); `menu` y `stockAmountCell` ámbar de la rama (auto-fusionados) |
| `product-table.tsx` (3 trozos) | `card` (`productTableCard(showType)`), `handleAction` en deps | `typeFilter`/`showPresentation`, `canSeeCost`, `columns: columns.length` del esqueleto | Los dos: `showPresentation` de `dev` + `card` de la rama; deps `[units, canAdjust, canSeeCost, showType, showPresentation, batches, handleAction]`; `states` con `columns.length` y `card={card}`. Anfitrión único (`ProductRowDialogs`) de la rama, intacto |
| `product-batch-rows.test.tsx` | Casos R6 / R47 / R53 de derecha y negrita | Casos de moneda, unidad, «—», orden y sin `canSeeCost` | Todos. A los de la rama: `canSeeCost` y cifras en moneda (`$9.00 / kg`, `$3.13 / kg`). Al de `dev` «sin `canSeeCost`…»: `screen.findByTestId('product-batch-row')` → `enLaTabla().findByTestId(...)` (la tarjeta duplica el testid) |
| `product-page.test.tsx` | `buildProductColumns({ menu })` | `({ rowActions, showCost: true })` | `({ menu, showCost: true })`. Fuera del trozo, `rowActions: () => null` → `menu` (l. 639). Los dos casos de `dev` de costo (`getByTestId('product-cost')`) acotados a la fila visible (`within(getAllByTestId(testId.fila)[0])`): la tarjeta duplicaba el testid |
| `tablas-marca.test.tsx` | `({ menu: sinMenu })`, esperadas del orden viejo | `({ rowActions, showCost: true })`, esperadas de fb140780 | `({ menu: sinMenu, showCost: true })` con las esperadas de `dev`. Caso de la rama «R6: … a la derecha»: `showCost: true` (sin él no hay `averageUnitCost`). El caso de `order-columns` se deja como lo trae `dev` |
| `inventario-paridad.test.tsx.snap` | — | — | `git checkout --theirs` y `vitest run tests/unit/paridad/inventario-paridad -u` (13 actualizados) |

Fuera de los seis conflictos, por la API `menu` de la rama o por la visibilidad de `dev`:

- `product-type-column.test.tsx` (caso nuevo de `dev`): `rowActions: () => null` → `menu: () => ({ items: [], triggerLabel: '' })` en dos llamadas. **Sin cambio de aserciones.**
- `product-cards.test.tsx` (rama): `montar` pasa `canSeeCost` (Administrador); sin él la tarjeta ya no tiene costo y R13 / R47 fallaban. Las aserciones no cambian. Los casos «Costo solo con `canSeeCost`» de la tarjeta son de T8b.
- `card` de la tarjeta: se queda el de E1 con `useMemo([showType])`. `DataTableCards` salta en `meta` la columna que no existe (`byId.get` → `null`), así que sin `canSeeCost` o en «Producto» no pinta costo ni «Presentación». El `card` de F3 con sus deps (`showPresentation`, `canSeeCost`) es T8c.

**Snapshot contra el de `dev`:** las filas (`tr name=…`) son idénticas a las de `dev`, incluido
el orden y «Costo unitario»; las únicas líneas con «Costo» que cambian son la cabecera
`averageUnitCost` (`text-center` → `text-right`). El resto del diff es de la rama: `PageHeader`
(título 30 px, contenedor `@container`, botón con icono `upload`), `UrlTabs` sin el párrafo de
filtro, `justify-center` → `justify-end` en cabeceras de cifras, aviso ámbar y tarjetas.
**Contra el de `HEAD`:** solo lo de `dev` (orden de fb140780, «Costo» → «Costo unitario», esqueleto
con `columns.length` celdas). 70 líneas (+46 −24).

### Rojo conocido (no se arregla aquí)

`tablas-marca.test.tsx > lista cerrada … > R11, R13: en 'order-columns.tsx'` espera
`['Cantidad', 'Fecha de solicitud']`; 0f71d5af quitó «Cantidad» de Pedidos y no actualizó este
test (en `MERGE_HEAD` la l. 243 sigue esperando «Cantidad»). Es de Pedidos, no de Inventario; lo
arregla el PR #265.

### Salida real

```
$ git diff --check            → sin salida (exit 0)
$ grep '^<<<<<<<|^>>>>>>>|^=======$' app components lib tests e2e → sin coincidencias
$ pnpm run typecheck          → tsc --noEmit, sin errores
$ pnpm run lint               → ✖ 10 problems (0 errors, 10 warnings) — todos no-unused-vars en
                                confirm-catalog-import.test.ts, list-execution-traces.test.ts,
                                order-service.test.ts y step-evidence.tsx (ninguno de este merge)
$ pnpm exec vitest run tests/unit/paridad/inventario-paridad -u
  Snapshots  13 updated · Test Files 1 passed (1) · Tests 13 passed (13)
$ pnpm exec vitest related --run <12 archivos de app/(private)/inventario del merge>
  FAIL tests/unit/marca/tablas-marca.test.tsx > … 'order-columns.tsx' (rojo conocido)
  Test Files  1 failed | 40 passed (41) · Tests  1 failed | 808 passed (809)
$ pnpm exec vitest run guard
  Test Files  81 passed (81) · Tests  1106 passed | 20 skipped (1126)
$ pnpm exec vitest run product-cards product-page tablas-marca product-batch-rows
    product-type-column unit-cost-visibility product-route-contract scope
  FAIL tablas-marca > … 'order-columns.tsx' (rojo conocido)
  Test Files  1 failed | 7 passed (8) · Tests  1 failed | 207 passed (208)
$ pnpm exec vitest run tests/unit/inventario tests/unit/inventario-ui tests/unit/paridad tests/unit/marca
  FAIL tablas-marca > … 'order-columns.tsx' (rojo conocido)
  Test Files  1 failed | 170 passed (171) · Tests  1 failed | 2738 passed | 5 skipped (2744)
```

`unit-cost-visibility.test.ts`, `product-type-column.test.tsx`, `product-route-contract.test.ts`
y `scope.test.ts`: en verde.

### Veredicto

T8a hecha: merge sin marcadores y en el índice sin commit, columnas de `dev` con la alineación,
`menu`, ámbar, `card` y anfitrión de la rama; único rojo, el conocido de Pedidos (PR #265).

## Tanda 8 (T8f) — 2026-10-16 · frontend_dev

### Archivos modificados

- `app/(private)/inventario/importar/components/import-preview-summary.tsx`: prop `onChooseAnother`;
  la cabecera de la tarjeta «Vista previa» pasa a fila (título, archivo y descripción a la
  izquierda; a la derecha `<Button variant="outline" touch disabled={confirming}
  data-testid="inventory-import-choose-another">` con `UPLOAD_CHANGE_LABEL`); con 760 px o menos se
  apila a todo el ancho (`@max-[760px]:flex-col @max-[760px]:items-stretch`, como `STACKED_ACTIONS_CLASS`).
- `app/(private)/inventario/importar/components/inventory-import-screen.tsx`: `onChooseAnother={restart}`
  (el mismo `restart` de «Importar otro archivo»: archivo, resultado y error a `null`; no llama a
  ninguna action ni a `toast`).
- `app/(private)/inventario/importar/components/import-texts.ts`: `CHOOSE_ANOTHER_TESTID`. El literal
  «Elegir otro archivo» no se duplica (se reusa `UPLOAD_CHANGE_LABEL`).
- `tests/unit/inventario/importar/import-preview.test.tsx`: `onChooseAnother` en los renders y 2 tests.
- `tests/unit/inventario/importar/inventory-import-screen.test.tsx`: 3 tests.
- `import-steps.test.tsx`: sin cambio.

### Mapa R → test

| R | Test |
| --- | --- |
| R59 | `import-preview.test.tsx` › «R59 «Elegir otro archivo» va en la cabecera de la tarjeta, junto al título y el archivo, con talla touch»; «R59 … queda deshabilitado mientras se importa» |
| R32, R59 | `inventory-import-screen.test.tsx` › «R32 R59 «Elegir otro archivo» del paso 2 vuelve al paso 1 sin archivo, sin vista previa, sin importar ni avisar» |
| R59 | `inventory-import-screen.test.tsx` › «R59 tras un error al confirmar, «Elegir otro archivo» también limpia el error»; «R59 mientras importa, «Elegir otro archivo» queda deshabilitado» |

«Sin recargar la página» lo prueba el E2E de T8g (marcador en `window`); en unidad se ve que el
paso 1 se pinta en el mismo render.

### Salida real

- `pnpm run typecheck` → `tsc --noEmit` sin errores.
- `pnpm run lint` → `✖ 10 problems (0 errors, 10 warnings)` (avisos previos en tests de otros módulos).
- `pnpm exec vitest related --run <3 componentes + 2 tests>` → `Test Files 9 passed (9)`, `Tests 184 passed (184)`.
- `pnpm exec vitest run guard` → `Test Files 81 passed (81)`, `Tests 1106 passed | 20 skipped (1126)`.
- `pnpm exec vitest run tests/unit/inventario/importar tests/unit/inventario/scope.test.ts tests/unit/inventario/product-route-contract.test.ts`
  → `Test Files 1 failed | 10 passed (11)`. Importar y `scope` en verde. Los rojos están en
  `product-route-contract.test.ts` y vienen de archivos de T8b–T8d, que otro frontend_dev está
  editando en paralelo (no son de T8f): «`product-columns.tsx` no debe contener «.cost»» y
  «`product-table.tsx` no debe contener «filter(»». En la primera pasada salió además un tercero,
  «los componentes de ruta se exponen por el barrel…», que en la siguiente pasada ya estaba verde
  (era una edición a medias del otro agente).

### Veredicto

T8f hecha: «Elegir otro archivo» en la cabecera del paso 2 vuelve al paso 1 limpio sin importar ni
avisar; importar en verde. Los rojos de `product-route-contract` son de T8b–T8d, que van en paralelo.

## Tanda 8 (T8b-T8d) — 2026-10-16 · frontend_dev

Sobre `9f7e7b07` (T8a). Sin commit. `components/shared/**` sin cambios (`git diff --stat components/`
vacío): `DataTable` y `DataTableCards` no se tocan; el `footer` de `DataTableCardLayout` ya existía.

### Archivos

- `app/(private)/inventario/components/card-field-label.tsx` (nuevo): `cardFieldLabel(text)` →
  `<span data-card-label className="text-muted-foreground [table_&]:hidden">` y
  `withCardFieldLabel(text, value)` (el rótulo delante de la celda; `null` sin rótulo). Sin
  `'use client'`, exportados por el barrel, listos para T8e (`product-batch-columns.tsx`, `batch-history.tsx`).
- `product-columns.tsx`: `BATCHES_TOGGLE_COLUMN_ID` (en `ProductColumnId`), `PRODUCT_CARD_LABELS`,
  `PRODUCT_BATCH_ROW_TEXTS.cardToggle(expanded)` / `cardToggleColumn` («Lotes»); columna
  `batchesToggle` (`align: 'start'`, `pinnable: false`, `Button ghost touch` con `ChevronRight` que
  gira, `aria-expanded`, `product-batches-card-toggle`; `null` en sub-filas), solo con `onToggle`
  (así `PRODUCT_SKELETON_COLUMN_COUNT` sigue en 8); rótulos en `stock`, `available`, `qtyAlert` y
  `averageUnitCost` (sub-fila: `stock`, `available`, `averageUnitCost`); `data-batch-subrow` y
  `@max-[760px]:pl-0` en la raíz de las celdas `name` de `batch` y de los tres `batchesStatus`.
  `averageUnitCost` ya estaba en `align: 'end'` y con el orden de `dev` desde T8a.
- `product-table.tsx`: `productTableCard({ showType, showPresentation, canSeeCost })` = `card` de F3
  con `footer: BATCHES_TOGGLE_COLUMN_ID`; `useMemo` sobre `[showType, showPresentation, canSeeCost]`
  (cierra el pendiente de T8a); `PRODUCT_TABLE_SCOPE_CLASS` (F4 + F5) en un `div` que envuelve al
  `DataTable` **solo en la vista con filas**: en cargando / vacío / error el `DataTable` sale sin
  envoltorio (no hay sub-filas ni tarjetas que alcanzar, y el snapshot de esos estados no cambia);
  el esqueleto cuenta las columnas sin `batchesToggle`.
- `finished-stock-columns.tsx`: rótulos «Existencia» y «Alerta» en `stock` y `qtyAlert`.
- `index.ts`: `cardFieldLabel`, `withCardFieldLabel`, `BATCHES_TOGGLE_COLUMN_ID`,
  `PRODUCT_CARD_LABELS`, `PRODUCT_TABLE_SCOPE_CLASS`, `productTableCard`, `ProductTableCardOptions`.
- Tests: `product-cards.test.tsx`, `product-batch-rows.test.tsx`, `product-type-column.test.tsx`,
  `finished-stock-table.test.tsx`; `.snap` de `inventario-paridad` (3 actualizados).

**DOM comprobado antes de la clase:** `th` lleva `data-testid="data-table-head-<id>"`
(`data-table-header-menu.tsx` l. 212) y `td` `data-testid="data-table-cell-<id>"` (`data-table.tsx`
l. 362); el test «R13, R58 — la clase de ambito … alcanza la cabecera y las celdas» lo fija (`TH`, `TD`).

**Desvíos y decisiones de esta tanda (para el reviewer):**

1. `PRODUCT_CARD_LABELS` usa la clave `unitCost` y no `cost` (F3): `product-route-contract.test.ts`
   prohíbe `.cost` en la ruta (QC-52 R5/R6: el producto no tiene campo `cost`). Mismo texto «Costo».
2. La columna `batchesToggle` va **justo después de la imagen**: oculta en la tabla, su posición no
   se ve; detrás de las acciones rompería la caída fijada a la derecha y delante de ellas el caso de
   `dev` «Costo unitario justo antes de las acciones» (que cuenta `columnheader` en jsdom, sin CSS).
3. `withCardFieldLabel` añadido a `card-field-label.tsx` junto a `cardFieldLabel` (el «sin rótulo
   donde la celda devuelve `null`» en un solo sitio). «—» de alerta o de costo sí lleva rótulo
   (la celda pinta algo).
4. `product-route-contract` prohíbe `filter(` en la ruta: el recuento del esqueleto usa `some`.
5. Observación, sin cambiar el diseño: `bg-muted/55` es translúcido y alcanza también las celdas
   fijadas (imagen, acciones), que por debajo llevan `bg-background`; con scroll horizontal la
   sub-fila dejaría entrever lo que pasa por debajo de esas dos celdas. El tablero usa un
   `color-mix(... var(--muted) 55%, var(--card))` opaco. Lo mide el E2E de T8g; si molesta, se
   cambia el valor en la clase de ámbito, sin tocar `DataTable`.

### Mapa R → test

| R | Test |
| --- | --- |
| R6, R53, R54 | `product-batch-rows.test.tsx` › «R6, R53, R54 — con `canSeeCost`, al final antes de acciones y a la derecha, en moneda con unidad, exacto en `title` y el costo del lote en su sub-fila» («$2,500.00 / L», `title` 2500.004, «—», «$2,400.01 / L») y los de `dev` (sin `canSeeCost` ni columna ni costo de sub-fila) |
| R6, R53, R54 | `product-type-column.test.tsx` › «R6, R53, R54 — en «Todos», con `canSeeCost`, el orden completo de cabeceras es el de hoy»; «R53 — en «Producto» el orden es el mismo sin «Tipo» ni «Presentación»»; «R54 — sin `canSeeCost` no hay «Costo unitario»…» |
| R13, R53 | `product-cards.test.tsx` › «R13, R53 — las cifras son Presentacion, Existencia, Alerta, Disponible y Costo…»; «R13, R53 — en «Producto» la tarjeta no pinta «Presentación», tambien al cambiar de pestana» (dep. `showPresentation` del `useMemo`) |
| R13, R54 | `product-cards.test.tsx` › «R13, R54 — la cifra «Costo» de la tarjeta sale solo con `canSeeCost`» (dep. `canSeeCost`); «R13, R53 — la linea es una tarjeta … sin «Disponible» ni «Costo»» (producto terminado) |
| R55 | `product-cards.test.tsx` › «R55 — cada cifra lleva delante su rotulo…»; «R55 — el rotulo lleva `[table_&]:hidden`…»; «R55 — la tarjeta del lote rotula existencia, disponible y costo…»; «R55 — la tarjeta de estado de lotes no lleva ningun rotulo»; `finished-stock-table.test.tsx` › «R55 — la tarjeta de la linea rotula «Existencia» y «Alerta»…»; «R55 — la tarjeta del pedido rotula su existencia y no la alerta…» |
| R13, R47, R58 | `product-cards.test.tsx` › «R58 — el pie pinta «Mostrar lotes» a la izquierda de «Acciones», de 44 px, que despliega los lotes y pasa a «Ocultar lotes»»; «R58 — el chevron del titulo lo oculta en la tarjeta la clase de ambito…»; «R13, R58 — la clase de ambito va en el envoltorio y alcanza la cabecera y las celdas…»; los R47 de tarjetas de lote despliegan ahora con `product-batches-card-toggle` |
| R57 | `product-batch-rows.test.tsx` › «R57 — `data-batch-subrow` marca la sub-fila de lote, la de cargando, la vacia y la de error, y no la del producto»; «R57 — mientras carga…»; «R57 — la clase de ambito pone fondo y entrada (solo con movimiento)…» |

Los computados (fondo, sangría, animación, rótulos invisibles a 1440, 44 px) son de T8g (jsdom no
aplica Tailwind). **Aviso para T8g:** `e2e/inventario-rediseno.spec.ts` l. 747 y l. 850 usan
`product-batches-toggle` dentro de la tarjeta (a 390 ahora oculto): pasan a `product-batches-card-toggle`.

### Salida real

```
$ pnpm run typecheck   → tsc --noEmit, sin errores
$ pnpm run lint        → ESLint: 0 errors, 10 warnings in 4 files (no-unused-vars en
                         confirm-catalog-import.test.ts, list-execution-traces.test.ts,
                         order-service.test.ts, step-evidence.tsx; ninguno de esta tanda)
$ pnpm exec vitest run tests/unit/paridad/inventario-paridad -u
  Snapshots 3 updated · Test Files 1 passed (1) · Tests 13 passed (13)
$ pnpm exec vitest related --run <5 de la ruta + 4 tests>
  FAIL tablas-marca > … 'order-columns.tsx' (rojo conocido, PR #265)
  Test Files 1 failed | 37 passed (38) · Tests 1 failed | 708 passed (709)
$ pnpm exec vitest run guard
  Test Files 81 passed (81) · Tests 1106 passed | 20 skipped (1126)
$ pnpm exec vitest run product-route-contract.test.ts scope.test.ts unit-cost-visibility.test.ts
    product-type-column.test.tsx
  Test Files 4 passed (4) · Tests 51 passed (51)
$ pnpm exec vitest run tests/unit/inventario tests/unit/inventario-ui tests/unit/paridad tests/unit/marca
  FAIL tablas-marca > … 'order-columns.tsx' (rojo conocido)
  Test Files 1 failed | 170 passed (171) · Tests 1 failed | 2760 passed | 5 skipped (2766)
```

**Snapshot contra el de T8a (design.md > 6):** solo cambia la vista con filas de productos y la de
producto terminado: el envoltorio con `PRODUCT_TABLE_SCOPE_CLASS` (sangría de un nivel), la
cabecera y las celdas `batchesToggle` con «Mostrar lotes», los `span[data-card-label]`
(«Existencia», «Alerta», «Disponible») y la tarjeta con su pie. Cargando, vacío y error, intactos.

### Veredicto

T8b–T8d hechas: tarjeta de F3 con rótulos y «Mostrar lotes» al pie, clase de ámbito con columna
oculta y sub-filas marcadas, `DataTable` sin cambios; único rojo, el conocido de Pedidos (PR #265).

## Tanda 8 (T8e) — 2026-10-16 · frontend_dev

Sobre `7c085b7a`. Sin commit. `components/shared/**` sin cambios.

### Archivos

- `app/(private)/inventario/components/product-batch-columns.tsx`: `align: 'end'` en `purchaseDate`
  y `expiryDate` (F6); rótulos de tarjeta con `withCardFieldLabel` (de `card-field-label.tsx`, T8b)
  en `quantity`, `reserved`, `available`, `purchaseDate`, `expiryDate` (F3). Los textos son los de
  `PRODUCT_BATCH_COLUMN_LABELS` (mismo texto que la cabecera; sin literal duplicado). En `quantity`
  el rótulo va delante del `span` en columna (cantidad + envases), no dentro, para no apilarse.
- `app/(private)/inventario/components/batch-history.tsx`: `align: 'end'` en `date` (P27); rótulos
  en `previousStock`, `countedStock`, `reason`, `order` con los textos de
  `BATCH_HISTORY_COLUMN_LABELS`; `author` y `date` sin rótulo.
- `tests/unit/inventario/product-batches-panel.test.tsx`: el caso de alineación pasa las dos fechas a
  `end`; nuevos «R15 — la cabecera y la celda…» y `describe('R56 — rotulos de la tarjeta del lote')`.
- `tests/unit/inventario/batch-history.test.tsx`: nuevo `describe('R21, R56 — fecha a la derecha y
  rotulos de la tarjeta del asiento')`.
- Snapshots: ninguno cambia (los de `inventario-paridad` no pintan el panel ni el historial).

**Decisiones (para el reviewer):**

1. El «—» de una celda vacía (sin vencimiento, sin motivo, sin pedido, sin existencias) **lleva**
   rótulo, como en T8b: la celda pinta algo y `withCardFieldLabel` solo se lo quita a `null`.
2. `product-batch-expiry-date` ya contenía su relativo («vence en … días», 08b69744); el test de
   R56 afirma que empieza por la fecha y no contiene el rótulo, no que sea solo la fecha.

### Mapa R → test

| R | Test |
| --- | --- |
| R15 | `product-batches-panel.test.tsx` › «R15 — lote, cifras y fechas en cifras tabulares; las cifras y las dos fechas a la derecha»; «R15 — la cabecera y la celda de «Fecha de compra» y «Vencimiento» van a la derecha» (`text-right` en `data-table-head-*` y `data-table-cell-*`) |
| R21 | `batch-history.test.tsx` › «R21 — la cabecera y la celda de «Fecha» van a la derecha» |
| R56 | `product-batches-panel.test.tsx` › «R56 — «Cantidad», «Apartado», «Disponible», «Fecha de compra» y «Vencimiento» van delante de su cifra; el lote, sin rotulo»; «R56 — el texto de cada `product-batch-*` sigue siendo solo su valor»; «R56 — en la fila de la tabla el rotulo lleva `[table_&]:hidden`…» |
| R56 | `batch-history.test.tsx` › «R56 — «Existencia anterior», «Total contado», «Motivo» y «Pedido» van delante de su valor; autor y fecha, sin rotulo»; «R56 — el texto de cada `batch-history-entry-*` sigue siendo solo su valor»; «R56 — sin dato, el «—» lleva su rotulo y en la tabla el rotulo se oculta» |

### Salida real

```
$ pnpm run typecheck
> tsc --noEmit
(exit 0)

$ pnpm run lint
✖ 10 problems (0 errors, 10 warnings)        # avisos previos, ninguno en archivos de esta tanda
$ pnpm exec eslint <los 4 archivos>
ESLint: No issues found

$ pnpm exec vitest related --run <2 componentes + 2 tests>
 Test Files  1 failed | 36 passed (37)
      Tests  1 failed | 651 passed (652)
 × tablas-marca › R11, R13: en 'order-columns.tsx' …   # rojo conocido de dev

$ pnpm exec vitest run guard
 Test Files  81 passed (81)
      Tests  1106 passed | 20 skipped (1126)

$ pnpm exec vitest run tests/unit/inventario/product-route-contract.test.ts tests/unit/inventario/scope.test.ts
 Test Files  2 passed (2)
      Tests  28 passed (28)

$ pnpm exec vitest run tests/unit/inventario tests/unit/inventario-ui tests/unit/paridad tests/unit/marca
 Test Files  1 failed | 170 passed (171)
      Tests  1 failed | 2768 passed | 5 skipped (2774)
 × tablas-marca › R11, R13: en 'order-columns.tsx' …   # el mismo rojo conocido
```

### Veredicto

T8e hecha: fechas del panel y «Fecha» del historial a la derecha, rótulos de tarjeta de R56 con los
testids intactos; único rojo, el conocido de Pedidos.

## Tanda 8 (T8g) — 2026-10-16 · frontend_dev

Sobre `cba2eb6e` (T8e). Sin commit. `components/shared/**` sin cambios.

### Archivos

- `e2e/inventario-rediseno.spec.ts`: 7 casos nuevos (15 × 2 navegadores) y ajustes a los de T7a:
  - fixture: un Operador (`inventario.consultar` sin `inventario.modificar`, no cumple `canViewUnitCosts`)
    con `createUser` / `roleId`; `openInventory` acepta credenciales.
  - helpers: `visibleHeadIds`, `expectCardLabelsHidden`, `expectCardLabel`, `cellStyles`, `alphaOf`,
    `boxStyle`. `expectRightAligned` mide el primer hijo que **no** es `[data-card-label]` (en la tabla
    el rótulo no tiene caja).
  - casos de T7a: a 820 y 390 el conmutador de la tarjeta es `product-batches-card-toggle` (el chevrón
    se afirma oculto); la cifra de costo de la sub-fila pasa de «3.5» a moneda con unidad
    (`/^\$3\.50 \/ \S+$/`, de `dev`); «Disponible» en negrita y `reason`/`order` del historial se leen
    sin el rótulo (`:not([data-card-label])`, `useInnerText`).
- `app/(private)/inventario/components/product-table.tsx` (**bug de producción, R57**): en
  `PRODUCT_TABLE_SCOPE_CLASS`, `[&_tr:has([data-batch-subrow])>td]:bg-muted/55` →
  `bg-[color-mix(in_oklch,var(--muted)_55%,var(--card))]` (el del tablero, opaco). Medido en Chromium a
  1440: el scroll de la tabla es 1780 / 1112 px (ya se desplaza en horizontal) y el fondo de las celdas
  fijadas de la sub-fila (`image`, `actions`) era `oklab(… / 0.55)`: con scroll, las celdas que pasan
  por debajo se veían a través. Solo cambia la clase de ámbito; `DataTable` no se toca.
- `tests/unit/inventario/product-batch-rows.test.tsx`: la clase esperada del caso «R57 — la clase de
  ambito…» sigue al cambio (misma aserción).
- `tests/unit/paridad/__snapshots__/inventario-paridad.test.tsx.snap`: 2 actualizados; el único cambio
  es esa clase en el envoltorio.

Ningún otro E2E nombra `product-batches-toggle`, `product-batch-row-cost` ni `product-cost` (grep en
`e2e/`): no se toca otro spec.

### Mapa R → caso E2E (`e2e/inventario-rediseno.spec.ts`)

| R | Caso |
| --- | --- |
| R54, R6 | `/inventario a 1440 px › R54, R6 — como Administrador «Costo unitario» es la última cabecera antes de las acciones, a la derecha y en moneda con unidad` |
| R54 | `/inventario a 1440 px › R54 — sin permiso de costos no hay «Costo unitario» en la tabla, ni «Costo» en la tarjeta ni en las sub-filas` (Operador) |
| R15, R21, R55 | `/inventario a 1440 px › R15, R21, R55 — las fechas del panel «Lotes» y la «Fecha» del historial a la derecha, sin rótulos de tarjeta en la tabla` |
| R47, R55, R57 | `/inventario a 1440 px › R47, R55, R57 — la sub-fila con fondo propio en todas sus celdas, «Nombre» sangrado, animada salvo con movimiento reducido y sin rótulos en la tabla` (fondo distinto celda a celda, celdas fijadas opacas con una celda debajo al desplazar, `padding-left` ≥ 40 px y lote a la derecha del nombre, `animation-name: screen-enter` y `none` con `emulateMedia({ reducedMotion: 'reduce' })`) |
| R13, R47, R55, R57, R58 | `/inventario a 390 px › R13, R47, R55, R57, R58 — rótulos en la tarjeta, «Mostrar lotes» al pie de 44 px que despliega, sin chevrón en el título, y tarjetas de lote con fondo propio, desplazadas y animadas salvo con movimiento reducido` |
| R13, R58 | `/inventario a 820 px › R13, R5, R52 …` (conmutador de tarjeta visible, chevrón oculto) |
| R56 (y R55 en lotes) | `/inventario a 390 px › R56 — rótulos visibles en las tarjetas de lote del panel y de asiento del historial; cada celda lee solo su valor` |
| R59, R32 | `importar inventario › R59, R32 — del paso 2, «Elegir otro archivo» vuelve al paso 1 sin recargar, sin archivo ni vista previa, sin importar y sin avisos` (marcador en `window`, sin `[data-sonner-toast]`, `inventoryImport` y productos `_im` sin cambio, botón de 44 px en la cabecera de la vista previa) |

### Salida real

```
$ pnpm exec playwright test e2e/inventario-rediseno.spec.ts   (línea base, antes de tocar nada)
  --project=chromium: 5 failed, 3 passed (2.5m)
    R1…R14  Error: el elemento no tiene caja (expectRightAligned: el primer span es el rótulo oculto)
    R47…R12 Error: el elemento no tiene caja (ídem)
    R11…R52 Expected "—" Received "Motivo —" (textContent incluye el rótulo oculto)
    R13…820 Expected visible Received hidden (product-batches-toggle en la tarjeta, l. 747)
    R2…390  locator.click: Timeout 30000ms (product-batches-toggle en la tarjeta, l. 850)

$ pnpm exec playwright test e2e/inventario-rediseno.spec.ts --project=chromium   (con los casos nuevos)
  3 failed, 12 passed (39.3s)
    «Disponible» en negrita Expected >= 600 Received 400 (medía el rótulo) -> arreglado en el test
    el valor exacto en title: Received "" (3.70 es exacto: exactDecimalTitle no pone title)
                                -> aserción retirada; el title lo cubre product-batch-rows.test.tsx
    fondo opaco en la celda fijada data-table-cell-image Expected 1 Received 0.55 -> bug R57 (arriba)
  sonda: scroll 1780/1112 a 1440, 1780/952 a 1280, 1780/772 a 1100; a 1024 ya son tarjetas;
         image y actions: oklab(0.964998 -0.00492409 -0.00341874 / 0.55)

$ pnpm exec playwright test e2e/inventario-rediseno.spec.ts --project=chromium   (tras el arreglo)
  15 passed (44.6s)

$ pnpm exec playwright test e2e/inventario-rediseno.spec.ts
  30 passed (1.8m)      chromium 15/15  webkit 15/15

$ pnpm run typecheck
> tsc --noEmit
(sin errores)

$ pnpm run lint
✖ 10 problems (0 errors, 10 warnings)   (los mismos 4 archivos ajenos de tandas anteriores)

$ pnpm exec vitest run tests/unit/paridad/inventario-paridad -u
  Snapshots 2 updated · Test Files 1 passed (1) · Tests 13 passed (13)

$ pnpm exec vitest related --run app/(private)/inventario/components/product-table.tsx tests/unit/inventario/product-batch-rows.test.tsx
  FAIL tablas-marca > … R11, R13: en 'order-columns.tsx' … (rojo conocido de dev)
  Test Files 1 failed | 36 passed (37) · Tests 1 failed | 651 passed (652)

$ pnpm exec vitest run tests/unit/inventario/product-route-contract.test.ts tests/unit/inventario/scope.test.ts
  Test Files 2 passed (2) · Tests 28 passed (28)

$ pnpm exec vitest run guard
  Test Files 81 passed (81) · Tests 1106 passed | 20 skipped (1126)
```

### Veredicto

T8g hecha: `inventario-rediseno.spec.ts` pasa en Chromium y WebKit (30/30) con los casos de R13, R15,
R47, R54, R55, R57, R58, R59, y el fondo translúcido de las celdas fijadas de la sub-fila (R57)
arreglado a opaco en la clase de ámbito; único rojo, el conocido de Pedidos.

## Tanda 8 (regresion E2E y medida D53)

Tras el merge de dev y los rotulos/pie de tarjeta, sub-filas, fechas a la derecha y «Elegir otro
archivo». Sin cambios de codigo en esta tanda: ningun spec fallo por la UI nueva.

### Archivos creados/modificados

- `progress/impl_QC-263.md` (esta seccion).

### Regresion E2E (cada spec por separado, Chromium + WebKit, puerto 3117)

```
$ pnpm exec playwright test e2e/inventario.spec.ts                         16 passed (2.6m)
$ pnpm exec playwright test e2e/inventario-importar.spec.ts                 2 passed (41.5s)
$ pnpm exec playwright test e2e/ajuste-de-inventario.spec.ts                8 passed (1.7m)
$ pnpm exec playwright test e2e/producto-terminado.spec.ts                  2 passed (2.0m)
$ pnpm exec playwright test e2e/reserva-de-material.spec.ts                 1 failed | 1 passed (3.0m)
    [webkit] R48 … reserva-de-material.spec.ts:717 — getByTestId('order-execution-start-button')
    no visible en 60 s (pantalla del Operador en /asignacion, no /inventario)
  reintento:                                                                 2 passed (1.1m)
$ pnpm exec playwright test e2e/aislamiento-inventario.spec.ts              2 passed (40.7s)
$ pnpm exec playwright test e2e/insumo-por-unidad.spec.ts                   2 passed (51.9s)
$ pnpm exec playwright test e2e/datos-de-lote-en-acondicionamiento.spec.ts  2 passed (1.1m)
$ pnpm exec playwright test e2e/pedido-bloqueado.spec.ts                    1 failed | 1 passed (24.9s)
    [webkit] R40 … pedido-bloqueado.spec.ts:488 — ancho del boton «Entrar» de /asignacion:
    Expected >= 44, Received 43.99998474121094 (redondeo subpixel de WebKit)
  reintento:                                                                 2 passed (51.7s)
```

Los dos rojos son de WebKit, en pantallas de Pedidos/Asignacion, y pasan al reintentar: ajenos a
QC-263. El de `pedido-bloqueado` es una fragilidad real del assert (compara un `boundingBox`
subpixel con `>= 44` exacto); se reporta, no se toca aqui.

### Medida D53 — celdas del esqueleto frente a columnas visibles (DERIVADO del codigo)

Derivado de `buildProductColumns` (`product-columns.tsx`), `ProductTable` (`tableColumnCount =
columns.length - 1` por el conmutador de pie, oculto en tabla), el `fallback` del `<Suspense>` de
`page.tsx` (un `ProductTable status="loading"` con los `params` y `canSeeCost` de la pagina),
`buildFinishedStockColumns` y `DataTable`/`TableSkeleton`. No se midio en el navegador: el
`fallback` solo vive durante la primera carga y las navegaciones posteriores no lo pintan (la tabla
se atenua con `aria-busy`, sin esqueleto).

| Vista | Admin (con Costo): esqueleto / real | Sin permiso de costos: esqueleto / real |
|---|---|---|
| «Todos» (con Tipo y Presentación) | 10 / 10 | 9 / 9 |
| Tipo filtrado (Materia prima, Envase, …) | 9 / 9 | 8 / 8 |
| Tipo «Producto» (sin Presentación) | 8 / 8 | 7 / 7 |
| «Producto terminado» | **9 / 7** | **8 / 7** |

- «Producto terminado»: el `fallback` es un `ProductTable` (columnas de producto: Disponible,
  Reservado y Costo), pero la tabla real es `FinishedStockTable` (Imagen, Pedido, Nombre,
  Presentación, Existencia, Alerta, Acciones = 7, sin Costo). Descuadra en 2 (admin) o 1.
  `PRODUCT_SKELETON_COLUMN_COUNT = 8` solo lo usa `FinishedStockTable` en su estado de error, nunca
  en carga.
- Bajo 760 px el esqueleto NO pasa a tarjeta: `DataTable` devuelve `<TableSkeleton>` antes del
  envoltorio `@container`, y `TableSkeleton` siempre pinta `<table>`; las filas reales si pasan a
  tarjeta (`@max-[760px]`).

### Verificacion

```
$ pnpm run typecheck
> tsc --noEmit
(sin errores)

$ pnpm run lint
✖ 10 problems (0 errors, 10 warnings)   (los mismos archivos ajenos de tandas anteriores)
```

### Veredicto

Regresion E2E en verde (9 specs, Chromium y WebKit; dos rojos ajenos de WebKit que pasan al
reintentar) y D53 medida: el esqueleto casa en todas las vistas salvo «Producto terminado» (9/8
frente a 7) y nunca pasa a tarjeta bajo 760 px.
