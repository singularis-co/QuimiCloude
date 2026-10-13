# QC-225 — detalle-de-producto-terminado · tasks.md

> **Orden:** T0 (contrato, secuencial) → bloques B (backend) y F (frontend). B y F van en paralelo
> entre sí donde se marca `[P]` → TC (barrido de censos) → TI (E2E) → TZ (cierre).
>
> **Reglas para todas las tasks:**
> - Ningún comentario de producción cita la ficha, un `R<n>` ni el spec. En los tests, el `R<n>` va en
>   el nombre del caso (`docs/perfil-agentes.md > backend_dev > Comentarios`).
> - Cada tanda cierra con `pnpm run typecheck`, `pnpm run lint`,
>   `pnpm exec vitest related --run <archivos tocados>` y `pnpm exec vitest run guard`.
> - Nada de `pnpm test` (`docs/perfil-agentes.md > Todos los agentes`).
> - Sin migraciones, sin tablas y sin dependencias nuevas (R32). Si alguna task parece necesitarlas,
>   para y avisa al leader.
> - **Enmienda 2026-10-13:** QC-224 ya está en esta rama. Cambian T0, B1, B2, B3, F1, F2 y TZ para
>   R33–R36 (entregas anuladas). Las cifras de los censos se toman de la rama al editar.

## [x] T0 — Contrato publicado (secuencial; lo hace `backend_dev`)

Archivos:
- `lib/modules/inventario/domain/finished-product-detail.ts` (nuevo). Lleva los tipos de
  `design.md > 2.1` y `FinishedDeliveryDirectory` con sus dos métodos (`findDeliveryDetails` con
  `linesByBatch` y `void`, y `summarizeDelivered`). También `DeliveredTotal` y
  `FinishedProductDeliveriesPage`, y `FinishedProductMovementKind` derivado de
  `InventoryMovementView['kind']`, con `delivery_void` incluido. Las tres funciones puras
  (`packagedQuantityOf`, `summarizeFinishedStock`, `productionCostTotal`) quedan **reales**, no stub.
- `lib/modules/inventario/ports/finished-product-detail-repository.ts` (nuevo), según
  `design.md > 2.2`.
- Los seis casos de uso de `design.md > 2.3`, con su firma y su `…Deps`. El permiso va como primera
  sentencia, y el cuerpo es un stub que lanza `ProductNotFoundError`:
  - `lib/modules/inventario/domain/get-finished-product.ts`
  - `lib/modules/inventario/domain/list-finished-product-batches.ts`
  - `lib/modules/inventario/domain/list-finished-product-movements.ts`
  - `lib/modules/inventario/domain/list-finished-product-deliveries.ts`
  - `lib/modules/inventario/domain/list-finished-product-costs.ts`
  - `lib/modules/inventario/domain/list-produced-products.ts`
- `lib/modules/inventario/index.ts`:
  - los tipos y las funciones puras, en una sentencia propia sin `…Deps`;
  - las seis factorías, cada una con su `type …Deps`.
- `lib/modules/inventario/adapters/driving/finished-product-actions.ts` (nuevo): las seis actions de
  `design.md > 2.4`, cableadas a la fachada.
- `lib/composition/index.ts`: la fachada `inventario` gana las seis claves al final. Las dependencias
  son reales donde ya existen (`orderNumberDirectory`, `units`, `customers`) y dobles mínimos donde
  aún no (el repositorio y `finishedDeliveryDirectory`, que devuelven vacío y
  `{ quantity: '0.0000', packages: 0 }`).
- `lib/shared/routes.ts`: `finishedProductDetailRoute(id)` (R30).
- `tests/fixtures/finished-product-detail.ts` (nuevo), según `design.md > 2.6`, con el movimiento
  `delivery_void`, la fila de entrega anulada y `finishedProductDeliveriesPage`.
- `tests/unit/inventario/finished-product-detail.test.ts` (nuevo). Casos:
  - R11, R12: `summarizeFinishedStock` con dos contenidos, un lote sin contenido, un lote agotado y
    restos exactos;
  - R21: `productionCostTotal` con redondeo mitad arriba (`x.xxxx5`) y con cantidades de cuatro
    decimales;
  - `packagedQuantityOf` con contenido `null` y con contenido `0`.
- `tests/unit/inventario/schema/inventario-schema.test.ts`: el censo de factorías pasa de 18 a 24,
  con una nota fechada.

**Hecho cuando:**
- `typecheck` está en verde;
- `finished-product-detail.test.ts` está en verde;
- la guardia de fábricas está en verde con 24;
- `pnpm exec vitest run guard` está en verde;
- `frontend_dev` puede importar las actions y las fixtures.

## Bloque B — backend (`backend_dev`)

### [x] B1 [P] — Adaptador de lectura de `inventario` (depende de T0)

Archivos:
- `lib/modules/inventario/adapters/driven/persistence/finished-product-detail-prisma.ts` (nuevo),
  según `design.md > 4.1`. Usa solo los envoltorios de `company-scope.ts`.
- `lib/composition/index.ts`: sustituye el doble del repositorio por el adaptador real.
- `tests/integration/inventario/finished-product-detail.int.test.ts` (nuevo), con datos de empresa
  A y B:
  - R5: `findAliveFinished` devuelve `null` para un producto borrado, un insumo, uno de B y uno
    inexistente;
  - R13, R14: lotes con y sin asiento `production`, uno agotado, y pedido de origen borrado (el
    `orderId` sigue saliendo);
  - R15–R18: apertura, producción, ajuste que suma, ajuste que resta y entrega. Cada una sale en el
    lado de su signo, y solo en ese;
  - R35: una entrega anulada sembrada en la base (la fila de `order_delivery_voids`, su línea en
    `order_delivery_void_lines` y el asiento `delivery_void` con `orderDeliveryVoidId`, que exigen los
    CHECK). El `delivery_void` sale en `in` con su `orderId`, y la `delivery` de esa entrega sigue en
    `out`;
  - `findAliveFinished` trae el `id` de cada lote;
  - R19: los asientos `delivery` traen `orderDeliveryId`;
  - R21, R22: solo los lotes con asiento `production`, con su `unitCost` y su `packageContent`;
  - R23: orden `createdAt desc, id desc`, 10 por defecto, tope 25 y `total` correcto;
  - R25: nada de B aparece en ningún método, aunque se pase un id de B;
  - R27, R28: `findProducedProducts` devuelve `(orderId, presentationId, productId)` por los asientos
    `production`. Un producto borrado no sale, y un pedido de B no sale.
- `tests/integration/aislamiento.json`: + la suite nueva.

**Hecho cuando:** la suite de integración está en verde contra la base de test, y
`tests/unit/inventario/company-scope.test.ts` está en verde.

### [x] B2 [P] — Directorio de entregas en `pedidos` (depende de T0)

Archivos:
- `lib/modules/pedidos/adapters/driven/persistence/order-delivery-directory-prisma.ts` (nuevo),
  según `design.md > 4.2`.
- `lib/composition/index.ts`: `finishedDeliveryDirectory` real, declarado antes de la fachada de
  `inventario`.
- `tests/integration/pedidos/order-delivery-directory.int.test.ts` (nuevo). Casos:
  - R19: cliente y envases por lote de una entrega con dos lotes;
  - R33: una entrega con dos presentaciones, una anulada. Las líneas anuladas traen `void.reason` y
    las otras `void: null`;
  - R34: `summarizeDeliveredByBatchIds` suma cantidad y envases solo de las líneas sin anulación;
    con todas anuladas da cero; con lotes vacíos devuelve cero sin consultar;
  - R25: una entrega de B no vuelve con la empresa A, y sus líneas no suman en el total de A;
  - con ids vacíos, `findDeliveryDetailsByIds` no consulta.
- `tests/integration/aislamiento.json`: + la suite nueva.

**Hecho cuando:** la suite está en verde y `pnpm exec vitest run guard` también (el ámbito de
`pedidos` y la arquitectura de módulos).

### [x] B3 — Cuerpos de los casos de uso y actions (depende de T0; usa dobles de puerto, no espera a B1/B2)

Archivos:
- Los seis archivos de dominio de T0, con el cuerpo de `design.md > 2.3`.
- `lib/modules/inventario/adapters/driving/finished-product-actions.ts`: el traductor de errores.
- Tests unitarios nuevos, con puertos doblados:
  - `tests/unit/inventario/get-finished-product.test.ts`: R2, R3, R5 (id sin uuid y `null`), R10
    (unidad y presentación resueltas) y R11, R12 (stock a través de la vista);
  - `tests/unit/inventario/list-finished-product-batches.test.ts`: R2, R3, R5, R13, R14 (pedido sin
    número en el directorio → `null`, la fila sigue) y R23 (`invalid_input`);
  - `tests/unit/inventario/list-finished-product-movements.test.ts`: R2, R3, R5, R15–R18
    (`direction` llega al puerto; cantidad en valor absoluto; motivo y pedido), R35 (un
    `delivery_void` en `in` sale con su número de pedido) y R23 (`direction` desconocida →
    `invalid_input`);
  - `tests/unit/inventario/list-finished-product-deliveries.test.ts`: R2, R3, R4 (solo
    `inventario.consultar`), R5, R19, R20 (cliente dado de baja; cliente que no vuelve → `null`;
    envases que no vuelven → `null`), R23 y:
    - R33: el `void` de `linesByBatch` llega a su fila; la fila anulada no se filtra ni cambia de
      sitio; la línea que no vuelve deja `void: null`;
    - R34: `summarizeDelivered` se llama una vez con los ids de TODOS los lotes del producto, también
      en la página 2; `delivered` es lo que devuelve; sin filas no se llama y vale cero;
    - R36: un actor con solo `inventario.consultar` recibe `void` y `delivered`;
  - `tests/unit/inventario/list-finished-product-costs.test.ts`: R2, R3, R4, R5, R21, R22 (el total
    sale de `unitCost` × cantidad; ningún puerto de recetas ni de costos) y R23;
  - `tests/unit/inventario/list-produced-products.test.ts`: R2, R3, R27, R28 (un par con dos
    productos se omite) y más de 25 ids → `invalid_input`;
  - `tests/unit/inventario/finished-product-actions.test.ts`: cada action traduce `unauthorized`,
    `product_not_found` e `invalid_input` a `ErrorState`, y lee la sesión una vez.
- `tests/unit/identity/session-once-per-request-actions.test.ts`: + la fila de
  `finished-product-actions.ts`.

En cada test de caso de uso, el caso de R2 afirma que ningún puerto se llamó, y el de R3 usa un actor
sintético con el permiso y otro rol (aceptado) y un Administrador sin él (rechazado).

**Hecho cuando:** los siete archivos de test están en verde, cada caso lleva su `R<n>`, y
`session-once-per-request-actions` está en verde.

## Bloque F — frontend (`frontend_dev`)

### F1 [P] — Ruta, página, tabs y estados (depende de T0; trabaja contra actions mockeadas y fixtures)

Archivos:
- `app/(private)/inventario/producto-terminado/[id]/page.tsx` (nuevo), según `design.md > 6.1`.
- `app/(private)/inventario/producto-terminado/[id]/components/` (nuevos, `design.md > 6.2`):
  - `finished-product-not-found.tsx`
  - `finished-product-header.tsx`
  - `finished-product-tabs.tsx`
  - `finished-product-general.tsx`
  - `finished-product-stock.tsx`
  - `finished-product-list-section.tsx`
  - `finished-product-params.ts`
  - `index.ts`
- `tests/unit/inventario/product-route-contract.test.ts`: excluye el prefijo `producto-terminado/`
  igual que `importar/`, con una nota fechada. Las aserciones previas no cambian.
- `tests/unit/inventario/producto-terminado/finished-product-route-contract.test.ts` (nuevo). Casos:
  - R1: `requirePagePermission('inventario.consultar')` es la primera línea de la página;
  - R7, R36: ningún archivo de la ruta importa `product-actions`, `batch-actions`,
    `inventory-import-actions`, `pedidos/adapters/driving/order-actions` (`voidDeliveryAction`) ni
    ninguna action que no sea de lectura;
  - R30: ningún archivo de la ruta incrusta `/producto-terminado`;
  - sin `main`, sin `layout.tsx` propio y componentes solo por el barrel.
- `tests/guards/guard-pantallas-exigen-permiso.test.ts`: + `/inventario/producto-terminado/[id]` en
  `RUTAS_ESPERADAS_HOY` (25 → 26), con una nota fechada.
- `tests/unit/inventario-ui/finished-product-page.test.tsx` (nuevo). Casos:
  - R6: `product_not_found` → estado «no encontrado» con enlace a la pestaña de terminados y sin
    tabs; otro error → `ErrorState` sin datos;
  - R10: General;
  - R11, R12: Stock, con dos contenidos y la entrada «sin envase».
- `tests/unit/inventario-ui/finished-product-tabs.test.tsx` (nuevo): R8 (siete tabs en orden) y R9
  (cambiar de tab cambia `tab` en la dirección y quita `page`).
- `tests/unit/inventario-ui/finished-product-params.test.ts` (nuevo): R9 (tab desconocido →
  `general`; `page`/`pageSize` no enteros → defecto).

**Hecho cuando:**
- los tests de F1 están en verde;
- `guard-pantallas-exigen-permiso` está en verde con 26;
- `product-route-contract` está en verde sin perder ninguna aserción;
- la página pinta con las fixtures.

### F2 [P] — Tablas de los cinco listados (depende de F1)

Archivos:
- `app/(private)/inventario/producto-terminado/[id]/components/`:
  - `finished-product-batches-table.tsx`
  - `finished-product-movements-table.tsx`
  - `finished-product-deliveries-table.tsx`
  - `finished-product-costs-table.tsx`
  - el barrel `index.ts`
- `finished-product-list-section.tsx`: despacha el tab activo a su tabla, a su vacío o a su error.
- `tests/unit/inventario-ui/finished-product-tables.test.tsx` (nuevo). Casos:
  - R13: columnas de Lotes y «Sin pedido»;
  - R15, R16: Entradas con su origen (producción con pedido, apertura, ajuste con motivo);
  - R35: Entradas con un `delivery_void` etiquetado «Anulación de entrega» y su pedido;
  - R17: Salidas con entrega y ajuste que resta, cantidad sin signo;
  - R19, R20: Entregas con cliente, cliente dado de baja y cliente ausente;
  - R33: Entregas con una fila anulada (marca «Anulada», motivo, `data-voided="true"`) y otra de la
    misma entrega sin marca;
  - R34: el total entregado (`finished-product-deliveries-total`) muestra `delivered` en unidad base
    y en envases, y no la suma de la página;
  - R36: ninguna fila de Entregas lleva un botón o enlace para anular;
  - R21: Costo con unitario y total;
  - R23: la paginación navega cambiando `page`;
  - R24: estado vacío propio de cada tab, distinto del error.

**Hecho cuando:** el test está en verde y cada caso lleva su `R<n>`.

### F3 [P] — Enlace desde /inventario (depende de T0)

Archivos:
- `app/(private)/inventario/components/finished-stock-columns.tsx`: el nombre de la línea pasa a ser
  `Link` a `finishedProductDetailRoute(id)` (`finished-stock-line-link`), según `design.md > 6.3`.
- `tests/unit/inventario/finished-stock-table.test.tsx`: R26, el `href` de cada línea apunta a la
  ficha de su producto, y la fila de grupo no lleva enlace.

**Hecho cuando:** `finished-stock-table.test.tsx` y `product-route-contract.test.ts` están en
verde.

### F4 [P] — Enlace desde /pedidos (depende de T0)

Archivos:
- `app/(private)/pedidos/components/order-produced-presentations.tsx` (nuevo), según
  `design.md > 6.4`.
- `app/(private)/pedidos/components/order-columns.tsx`: el prop `producedProductsByOrder`; la celda
  de «Presentación» elige entre `OrderProducedPresentations` y `OrderDistributionLabel`.
- `app/(private)/pedidos/components/order-table.tsx`: pasa el prop.
- `app/(private)/pedidos/components/order-list-section.tsx`: `loadProducedProducts` en el
  `Promise.all`, solo con los pedidos `TERMINADO`/`ENTREGADO` de la página.
- `app/(private)/pedidos/components/index.ts`: exporta el componente nuevo.
- `tests/unit/pedidos-ui/order-produced-presentations.test.tsx` (nuevo). Casos:
  - R27: un enlace por presentación con producto, también dentro del «+N»;
  - R28: presentación sin producto → texto sin enlace.
- `tests/unit/pedidos-ui/order-columns.test.tsx`: R27, R28. Un pedido `TERMINADO` y uno `ENTREGADO`
  con mapa → enlaces; un pedido `EN_EMPAQUE` y uno `CANCELADO` con mapa → sin enlace; sin
  mapa → igual que hoy.
- `tests/unit/pedidos-ui/order-list-section-produced.test.tsx` (nuevo). Casos:
  - R29: la action en error → ningún enlace, y la lista se pinta;
  - sin pedidos `TERMINADO`/`ENTREGADO` en la página → la action no se llama;
  - con ellos → una sola llamada con esos ids.

**Hecho cuando:** los tres tests están en verde y `guard-pantalla-pedidos-se-amplia` está en verde.

## TC — Barrido de censos (depende de B1–B3 y F1–F4)

- Repasa la tabla de `design.md > 7` fila a fila y confirma cada «sin cambio (verificar)»:
  - `guard-arquitectura-modulos` (sin ciclo con la arista `inventario → clientes`);
  - `guard-pantalla-pedidos-se-amplia`;
  - `guard-dependencias-aprobadas`;
  - `MIGRACIONES_ESPERADAS` sin cambios (R32).
- `pnpm run typecheck`, `pnpm run lint`, `pnpm exec vitest related --run <todo el diff>` y
  `pnpm exec vitest run guard`.

**Hecho cuando:** todo lo anterior está en verde y `./init.sh` termina en verde.

## TI — E2E (depende de TC)

Archivos:
- `e2e/detalle-de-producto-terminado.spec.ts` (nuevo). Reutiliza los helpers de
  `e2e/entregar-producto-terminado.spec.ts` (`loginAndLand`, `openOrderRowMenu`) y su preparación del
  pedido. Casos:
  - R31, recorrido: finalizar una orden, entregar parte de su producto terminado, abrir la ficha desde
    el enlace de /pedidos (R27) y comprobar:
    - en Lotes, el lote con su pedido;
    - en Entradas, la producción;
    - en Salidas, la entrega;
    - en Entregas, el cliente, el pedido, el lote y los envases;

    Después, volver a /inventario y abrir la misma ficha desde la pestaña de terminados (R26).
  - R31 y R1, acceso sin permiso: un usuario sin `inventario.consultar` (p. ej. `empacadorUser` o
    `noAccessUser`, ya usados en `e2e/empaque.spec.ts` y `e2e/ejecucion-receta.spec.ts`) abre la URL
    de la ficha y recibe la página 404.
- `tests/guards/guard-identificador-de-request.test.ts`: + `detalle-de-producto-terminado.spec.ts` en
  `E2E_ESPERADOS`.

**Hecho cuando:** `pnpm exec playwright test e2e/detalle-de-producto-terminado.spec.ts` está en verde
en local y la guardia también.

## TZ — Cierre (depende de TI)

- `progress/impl_QC-225-detalle-de-producto-terminado.md`: el mapa `R<n> → test` completo, de R1 a
  R36, con la ruta y el nombre de cada caso (`design.md > 10`).
- `./init.sh` en verde.

**Hecho cuando:** ningún `R<n>` queda sin test y `./init.sh` está en verde.

## Archivos esperados

> Enmienda 2026-10-13: R33–R36 no añaden rutas. Caben en archivos que ya estaban en esta lista: el
> contrato del dominio, el caso de uso de entregas, el directorio de entregas de pedidos, las tablas de
> entregas y de movimientos, la composición y sus tests. QC-224 ya no está en vuelo, así que los
> archivos que compartía con esta feature dejan de ser choque.

Producción:
- `lib/modules/inventario/domain/finished-product-detail.ts`
- `lib/modules/inventario/domain/get-finished-product.ts`
- `lib/modules/inventario/domain/list-finished-product-batches.ts`
- `lib/modules/inventario/domain/list-finished-product-movements.ts`
- `lib/modules/inventario/domain/list-finished-product-deliveries.ts`
- `lib/modules/inventario/domain/list-finished-product-costs.ts`
- `lib/modules/inventario/domain/list-produced-products.ts`
- `lib/modules/inventario/ports/finished-product-detail-repository.ts`
- `lib/modules/inventario/adapters/driven/persistence/finished-product-detail-prisma.ts`
- `lib/modules/inventario/adapters/driving/finished-product-actions.ts`
- `lib/modules/inventario/index.ts`
- `lib/modules/pedidos/adapters/driven/persistence/order-delivery-directory-prisma.ts`
- `lib/composition/index.ts`
- `lib/shared/routes.ts`
- `app/(private)/inventario/producto-terminado/[id]/page.tsx`
- `app/(private)/inventario/producto-terminado/[id]/components/index.ts`
- `app/(private)/inventario/producto-terminado/[id]/components/finished-product-not-found.tsx`
- `app/(private)/inventario/producto-terminado/[id]/components/finished-product-header.tsx`
- `app/(private)/inventario/producto-terminado/[id]/components/finished-product-tabs.tsx`
- `app/(private)/inventario/producto-terminado/[id]/components/finished-product-general.tsx`
- `app/(private)/inventario/producto-terminado/[id]/components/finished-product-stock.tsx`
- `app/(private)/inventario/producto-terminado/[id]/components/finished-product-list-section.tsx`
- `app/(private)/inventario/producto-terminado/[id]/components/finished-product-params.ts`
- `app/(private)/inventario/producto-terminado/[id]/components/finished-product-batches-table.tsx`
- `app/(private)/inventario/producto-terminado/[id]/components/finished-product-movements-table.tsx`
- `app/(private)/inventario/producto-terminado/[id]/components/finished-product-deliveries-table.tsx`
- `app/(private)/inventario/producto-terminado/[id]/components/finished-product-costs-table.tsx`
- `app/(private)/inventario/components/finished-stock-columns.tsx`
- `app/(private)/pedidos/components/order-produced-presentations.tsx`
- `app/(private)/pedidos/components/order-columns.tsx`
- `app/(private)/pedidos/components/order-table.tsx`
- `app/(private)/pedidos/components/order-list-section.tsx`
- `app/(private)/pedidos/components/index.ts`

Tests, fixtures y E2E:
- `tests/fixtures/finished-product-detail.ts`
- `tests/unit/inventario/finished-product-detail.test.ts`
- `tests/unit/inventario/get-finished-product.test.ts`
- `tests/unit/inventario/list-finished-product-batches.test.ts`
- `tests/unit/inventario/list-finished-product-movements.test.ts`
- `tests/unit/inventario/list-finished-product-deliveries.test.ts`
- `tests/unit/inventario/list-finished-product-costs.test.ts`
- `tests/unit/inventario/list-produced-products.test.ts`
- `tests/unit/inventario/finished-product-actions.test.ts`
- `tests/unit/inventario/finished-stock-table.test.tsx`
- `tests/unit/inventario/product-route-contract.test.ts`
- `tests/unit/inventario/producto-terminado/finished-product-route-contract.test.ts`
- `tests/unit/inventario/schema/inventario-schema.test.ts`
- `tests/unit/inventario-ui/finished-product-page.test.tsx`
- `tests/unit/inventario-ui/finished-product-tabs.test.tsx`
- `tests/unit/inventario-ui/finished-product-params.test.ts`
- `tests/unit/inventario-ui/finished-product-tables.test.tsx`
- `tests/unit/pedidos-ui/order-produced-presentations.test.tsx`
- `tests/unit/pedidos-ui/order-columns.test.tsx`
- `tests/unit/pedidos-ui/order-list-section-produced.test.tsx`
- `tests/unit/identity/session-once-per-request-actions.test.ts`
- `tests/unit/pedidos/module-contract.test.ts` (añadido 2026-10-13 en B2: censo cerrado de quién abre el cliente Prisma en `pedidos`)
- `tests/guards/guard-pantallas-exigen-permiso.test.ts`
- `tests/guards/guard-identificador-de-request.test.ts`
- `tests/integration/aislamiento.json`
- `tests/integration/inventario/finished-product-detail.int.test.ts`
- `tests/integration/pedidos/order-delivery-directory.int.test.ts`
- `e2e/detalle-de-producto-terminado.spec.ts`

Progreso:
- `progress/impl_QC-225-detalle-de-producto-terminado.md`
