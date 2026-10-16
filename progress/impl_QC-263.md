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
