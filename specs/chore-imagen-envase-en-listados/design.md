# Imagen del envase en las pantallas del empacador y de acondicionamiento: propuesta de diseño

> Cambio menor autorizado por el humano **sin SDD completo**: este archivo es la única pieza del
> spec. No hay `requirements.md` ni `tasks.md`. Se aprueba (o se corrige) antes de tocar código.
> Los puntos para aprobar están marcados **[P1]…[P7]** y reunidos al final.

## Lo que ya existe

- **`EntityImage`** (`components/shared/entity-image.tsx`, fila de `components/shared/CATALOGO.md`).
  Recibe una URL servible en `path` (o `null`). Tiene dos tamaños: `thumbnail` (cuadrada de **80 px**,
  fijada por decisión humana del 2026-10-14, con zoom al hacer clic) y `fill` (hueco cuadrado de ancho
  completo). Si no hay imagen, o si falla la carga, muestra el marcador
  `/inv_not_found.png` con el zoom deshabilitado. Hoy se usa en `inventario`, `proveedores`,
  `produccion/formulas` y en la ficha de `pedidos` (`order-recipe-image.tsx`, tamaño `fill`).
  **Se reutiliza tal cual (paso 1 de la regla de decisión de componentes).**
- **`ProductImageStorage.publicUrl(path)`** (`lib/modules/inventario/ports/product-image-storage.ts`),
  ya cableado en `lib/composition/index.ts:1079` como `productImageStorage`. Construye la URL a partir
  de la ruta guardada. Lee el entorno solo cuando se le llama con una ruta.
  `withImageUrl` (`inventario/domain/product-image-url.ts`) es el precedente: sin almacenamiento
  cableado no inventa ninguna URL.
- **`PackagingCatalog.findRefs`** (`inventario/domain/packaging-catalog.ts`) es el contrato público por
  el que `pedidos` y `asignaciones` resuelven los envases. Hoy no devuelve imagen.
- **`OrderDistributionLabel` / `orderDistributionLineText`** (`components/shared/order-distribution-label.tsx`,
  fila del catálogo). Es un formateador **de texto** compartido. Lo consumen:
  `pedidos/components/order-columns.tsx:278`, `pedidos/components/order-produced-presentations.tsx`,
  `asignacion/[id]/components/order-execution-screen.tsx:146` (pantalla del operario),
  `asignacion/components/assignment-list-parts.tsx:160` (`presentationColumn`, que usan **cuatro** tablas:
  empresa, asignados, por empacar y terminados/acondicionados),
  `asignacion/empaque/[id]/components/packing-order-screen.tsx:368` y
  `asignacion/components/order-distribution-full.tsx`. **No se toca** [P5].
- **`OrderDistributionFull`** (`app/(private)/asignacion/components/order-distribution-full.tsx`).
  Muestra el texto del reparto completo, sin hooks. La usan `conditioning-order-screen.tsx:102`,
  `conditioning-orders-columns.tsx:58` y, para el texto, `conditioning-order-screen.tsx:168`
  (etiquetas del formulario de datos de lote).

Comprobé en el código los puntos de la decisión técnica. Cuadran, con estos matices:

| Punto citado | Estado real |
|---|---|
| `get-order.ts:70 findPackagingNames` | Existe. Devuelve `Map<id, name>`. Lo importan también `list-orders.ts:26` y `list-order-summaries.ts:1` |
| `findPackagingRefs`, select en `packaging-catalog-prisma.ts` | El `select` está en `findAlivePackaging` (línea 25) y lo comparte `findPackagingCostingBatches`. Ahí se añade `imagePath` |
| `PackagingRef` | `inventario/domain/packaging-catalog.ts:4` |
| `composition/index.ts:~1225` | `packagingCatalog` en la línea 1225. `productImageStorage` ya está declarado antes (1079) |
| `order-view.ts:54` | Es `OrderPresentationLineView`, de la ficha y el listado de **pedidos**. **Ninguna de las vistas de este cambio lo consume** [P6] |
| `order-catalog.ts:265` | `AssignedOrderPresentationLine.packagingName`. Es la línea que llega a `asignaciones` |
| `list-order-summaries.ts:41` | `withPackagingNames`. Desde aquí reciben `packagingName` todas las vistas de `asignaciones` |
| `get-order.ts:131` | `toOrderView`, de **pedidos**. Mismo caso que `order-view.ts` [P6] |
| `PackingFinishLineView.packaging` | `asignaciones/domain/packing-order-view.ts:55`. Se arma con su **propia** llamada a `findRefs` (línea 145). Esa llamada ya trae el `PackagingRef` completo, así que la imagen sale de ahí sin tocar nada más |
| (no citado) | `asignaciones/domain/order-distribution-view.ts`: `OrderDistributionLineView` y `toDistributionLines` copian `packagingName` línea a línea. **También hay que tocarlo.** Si no se toca, la imagen se pierde entre `pedidos` y las pantallas |

## Contexto y decisión (cerrada por el humano)

**Se resuelve con consultas separadas, sin join entre módulos.** `pedidos` sigue resolviendo los
envases con `packaging.findRefs(ids, companyId)` y una sola llamada por página. Lo que cambia es que
`inventario` ahora devuelve también la URL de la imagen.

Por qué no un join (`Order` → `Product`):
- `docs/architecture.md:51`: los módulos comparten **servicios vía interfaz**, nunca repositorios ni
  tablas.
- `docs/architecture.md:951`: es antipatrón que el adaptador de `pedidos` acceda con Prisma a un
  modelo de otro módulo (`Product` es de `inventario`).
- Además, la URL pública la compone el puerto de almacenamiento de `inventario`. Con un join,
  `pedidos` tendría que conocer el bucket.

### Alternativas descartadas

1. **Join SQL desde `order-catalog-prisma`**: descartado por las dos reglas de arriba.
2. **Exponer `imagePath` en `PackagingRef` y que cada consumidor llame a `publicUrl`**: obligaría a
   `pedidos` y `asignaciones` a depender de `ProductImageStorage` y a conocer la ruta interna del
   bucket. La URL se compone una sola vez, dentro de `inventario`.
3. **Pasar `ProductImageStorage` al caso de uso que pinta (getPackingOrder, etc.)**: el mismo
   problema que la alternativa 2, repetido en N casos de uso.

## Cómo se compone la URL

- `findAlivePackaging` añade `imagePath: true` al `select`. El tipo `PackagingRow` gana `imagePath`.
- `findPackagingRefs` se queda como está para quien no tenga almacenamiento (tests de integración)
  y devuelve `imageUrl: null`, siguiendo el criterio de `withImageUrl`. Se añade
  `createFindPackagingRefs(images: Pick<ProductImageStorage, 'publicUrl'>)`, que compone
  `imageUrl = imagePath === null ? null : images.publicUrl(imagePath)`.
- `lib/composition/index.ts`: `packagingCatalog.findRefs = createFindPackagingRefs(productImageStorage)`.
- `PackagingRef` gana `readonly imageUrl: string | null`. La ruta del bucket **no** sale del módulo.

> Alternativa al factory: un 4.º parámetro opcional `images` en `findPackagingRefs`. Se descarta
> porque mezcla una dependencia con las opciones de la consulta, y los ~15 tests de integración que
> la pasan tal cual como `findRefs` dejarían de mostrar la diferencia.

## Vistas: antes, después y cuándo se ven

Tamaño: **`thumbnail` de 80 px en todas**, el mismo que el resto de listados (`product-columns`,
`recipe-columns`, `catalog-columns`). No se crea un tamaño nuevo, porque el de 80 px es decisión humana
reciente. `fill` (el que usa `order-recipe-image.tsx`) no encaja: ocupa el ancho completo y aquí cada
línea es una fila. La única excepción posible es el diálogo [P3].

### 1. Pantalla del pedido del empacador: bloque «Reparto»

`app/(private)/asignacion/empaque/[id]/components/packing-order-screen.tsx:361-371`.

Tablero: `docs/diseno/canvas/Empaque.dc.html` (+ `EmpaqueMovil.dc.html`, `EmpaqueTablet.dc.html`).

**Quién y cuándo:** el **empacador**, en `/asignacion/empaque/<id>`. Llega desde la pestaña
«Por empacar» con «Entrar» en el menú de la fila. Se ve en **todos** los estados que abre esa pantalla
(`POR_EMPACAR`, `EN_EMPAQUE` y lo que muestre después). El bloque está en la tarjeta izquierda, de
300 px, bajo «Cantidad».

```
ANTES                                   DESPUÉS
+------------------------------+        +------------------------------+
| Cantidad: 120 L              |        | Cantidad: 120 L              |
| Reparto                      |        | Reparto                      |
|  3 × Galón 4 L               |        | +------+                     |
|  12 × Botella 1 L            |        | | img  |  3 × Galón 4 L      |
+------------------------------+        | | 80px |                     |
                                        | +------+                     |
                                        | +------+                     |
                                        | | img  |  12 × Botella 1 L   |
                                        | +------+                     |
                                        +------------------------------+
```

Cada `<li>` pasa a `flex items-center gap-3`: `EntityImage` y después el mismo texto de
`orderDistributionLineText` (no cambia). Con 80 px y 300 px de ancho caben bien la imagen y el texto.

### 2. Diálogo «Terminar» del empaque: fila de conteo por línea

`app/(private)/asignacion/empaque/[id]/components/packing-finish-dialog.tsx:528-535`.

Tablero: `docs/diseno/canvas/EmpaqueTerminar.dc.html` (+ `EmpaqueTerminarEstados.dc.html`, estado 8 «Imagen
del envase ampliada»; `EmpaqueTerminarMovil.dc.html`, `EmpaqueTerminarTablet.dc.html`).

**Quién y cuándo:** el **empacador**, con el pedido `EN_EMPAQUE` a su nombre. Lo ve al pulsar
«Terminar» en el pie de la pantalla 1 (solo existe si `finish !== null`). Hay una fila por línea del
reparto, con el contador −/+.

```
ANTES                                                   DESPUÉS
+----+------------------------+-----------------+       +--------+---------------------+-----------------+
|[▣] | Galón 4 L              | [-] [ 3 ] [+]   |       | +----+ | Galón 4 L           | [-] [ 3 ] [+]   |
|40px| Planeados: 3 envases   |                 |       | |img | | Planeados: 3 env.   |                 |
+----+------------------------+-----------------+       | |80px| |                     |                 |
 (PackageIcon genérico, el mismo en todas)              | +----+ |                     |                 |
                                                        +--------+---------------------+-----------------+
```

La rejilla pasa de `grid-cols-[40px_…]` a `grid-cols-[80px_…]` en los dos breakpoints, y `PackageIcon`
desaparece. La imagen sale de `line.packaging.imageUrl`. En una línea antigua (`packaging === null`)
se muestra el marcador [P2].
Riesgo que hay que verificar: el zoom de `EntityImage` abre un `Dialog` **dentro** de otro `Dialog`.
Si da problemas de foco o de capas, la alternativa es desactivar el zoom ahí [P3].

### 3. Pantalla del pedido de acondicionamiento: subtítulo

`app/(private)/asignacion/acondicionamiento/[id]/components/conditioning-order-screen.tsx:101-103`.

Tablero: `docs/diseno/canvas/Acondicionamiento.dc.html` (+ `AcondicionamientoMovil.dc.html`,
`AcondicionamientoTablet.dc.html`).

**Quién y cuándo:** **quien acondiciona**, en `/asignacion/acondicionamiento/<id>`. Llega con «Entrar»
desde «Por acondicionar» (`POR_ACONDICIONAR`, `EN_ACONDICIONAMIENTO`), «Acondicionados» (`TERMINADO`)
o «Entregados» (`ENTREGADO`). Lo ve nada más abrir el detalle, en la cabecera.

```
ANTES
  PED-0042
  Crema hidratante
  Cantidad: 120 L · 3 × Galón 4 L / 12 × Botella 1 L
  Lo acondiciona Ana.

DESPUÉS
  PED-0042
  Crema hidratante
  Cantidad: 120 L
  +------+                  +------+
  | img  |  3 × Galón 4 L   | img  |  12 × Botella 1 L      (flex-wrap, gap-4)
  | 80px |                  | 80px |
  +------+                  +------+
  Lo acondiciona Ana.
```

Hoy el reparto va en línea, separado por « · ». Con imágenes pasa a un bloque propio que se ajusta
en varias filas. `OrderDistributionFull` gana una prop **opcional** `withImages` (paso 2 de la
regla: extender sin romper). Sin la prop, el `<span>` de texto queda idéntico, así que la columna (4)
y `orderDistributionFullText` (formulario de datos de lote, línea 168) no cambian. Con la prop
renderiza la lista imagen + texto. `EntityImage` es `'use client'`. `OrderDistributionFull` sigue sin
hooks y se puede seguir usando desde la pantalla de servidor.

### 4. Tabla «Por acondicionar»: columna «Envases»

`app/(private)/asignacion/components/conditioning-orders-columns.tsx:58`.

**Quién y cuándo:** **quien acondiciona**, en la pestaña «Por acondicionar» de `/asignacion`, al
abrir la lista (tabla en escritorio, tarjetas en móvil: la columna es `meta` de la tarjeta).

```
ANTES                                         OPCIÓN B (si se aprueba)
| Nº  | Receta | Envases                  |   | Nº  | Receta | Envases                            |
| 042 | Crema  | 3 × Galón 4 L / 12 × B…  |   | 042 | Crema  | [80px] 3 × Galón  [80px] 12 × Bot… |
                                              |     |        |  (fila de ≥ 80 px de alto)         |
```

**Recomendación [P1]: opción A, la tabla no cambia** (solo texto). Motivos:
- La pestaña equivalente del empacador («Por empacar») usa `presentationColumn`, compartida con otras
  tres tablas. Para ser coherentes habría que tocarla también, y eso cambiaría tablas de producción
  y de toda la empresa que nadie pidió.
- Un pedido con 3–4 líneas haría filas de más de 80 px y, en móvil, tarjetas muy altas.
- La imagen aparece justo un clic después, en el detalle (vista 3).

### 5. `components/shared/order-distribution-label.tsx`

**No se toca** [P5]. Es texto, y lo consumen `pedidos`, la pantalla del operario y cuatro tablas de
`asignacion` (lista de arriba). Meter ahí la imagen la pondría en todas a la vez.

### Otras pantallas del empacador o de acondicionamiento que listan envases (fuera de alcance salvo que se pidan)

- **«Terminados» del empacador y «Acondicionados» / «Entregados»** (`finished-orders-columns.tsx`, que
  reutiliza `conditioned-orders-columns.tsx`): usan `presentationColumn`, texto. Mismo criterio que [P1].
- **Formulario «Datos de lote»** (`conditioning-batch-data-form.tsx:147`): muestra la etiqueta de texto
  de una línea divergente dentro de un mensaje. Sin imagen.
- **Pantalla del operario** (`asignacion/[id]/components/order-execution-screen.tsx:146`): no es del
  empacador ni de acondicionamiento. Sin imagen.

## Comportamiento sin imagen [P2]

Recomendación: **marcador `/inv_not_found.png`**, el comportamiento por defecto de `EntityImage`
(`path === null` o carga fallida). El zoom queda deshabilitado. Así todas las líneas quedan alineadas
y se ve igual que en inventario y fórmulas, donde un producto sin foto ya muestra ese marcador.
Aplica a tres casos:
1. Envase sin `imagePath`.
2. Envase dado de baja o sin presentación fija: `findRefs` no lo devuelve, así que `imageUrl` es `null`
   (igual que hoy `packagingName`).
3. Línea antigua sin `packagingProductId`.
Alternativa: no mostrar nada en esos casos. Se descarta porque desalinea las filas del diálogo y de la
lista.

## Cambios de datos por capa

No hay tablas nuevas, ni migración, ni cambios de RLS. `Product.imagePath` ya existe y se lee con el
mismo filtro por empresa (`productCompanyScope`) que ya aplica `findAlivePackaging`.

| Capa | Archivo | Cambio |
|---|---|---|
| inventario · dominio | `lib/modules/inventario/domain/packaging-catalog.ts` | `PackagingRef.imageUrl: string \| null` |
| inventario · adaptador | `lib/modules/inventario/adapters/driven/persistence/packaging-catalog-prisma.ts` | `imagePath` en el `select` de `findAlivePackaging`; `createFindPackagingRefs(images)`; `findPackagingRefs` devuelve `imageUrl: null` |
| inventario · barrel | `lib/modules/inventario/index.ts` (si exporta el adaptador o el tipo) | Exportar lo que haga falta, sin rutas profundas |
| composición | `lib/composition/index.ts` | `packagingCatalog.findRefs = createFindPackagingRefs(productImageStorage)` |
| pedidos · dominio | `lib/modules/pedidos/domain/get-order.ts` | `findPackagingNames` → devuelve `{ name, imageUrl }` por id (renombrar a `findPackagingInfo`). `toOrderView` lo adapta, solo si [P6] |
| pedidos · dominio | `lib/modules/pedidos/domain/list-order-summaries.ts` | `withPackagingNames` añade `packagingImageUrl` |
| pedidos · dominio | `lib/modules/pedidos/domain/order-catalog.ts` | `AssignedOrderPresentationLine.packagingImageUrl: string \| null` |
| pedidos · dominio | `lib/modules/pedidos/domain/list-orders.ts` | Adaptarse al nuevo retorno de `findPackagingNames` |
| pedidos · dominio | `lib/modules/pedidos/domain/order-view.ts` | `OrderPresentationLineView.packagingImageUrl`, **solo si [P6]** |
| asignaciones · dominio | `lib/modules/asignaciones/domain/order-distribution-view.ts` | `OrderDistributionLineView.packagingImageUrl`; `toDistributionLines` lo copia |
| asignaciones · dominio | `lib/modules/asignaciones/domain/packing-order-view.ts` | `PackingFinishLineView.packaging.imageUrl` desde `packagingRef?.imageUrl ?? line.packagingImageUrl ?? null` |
| asignaciones · dominio | `lib/modules/asignaciones/domain/conditioning-order-view.ts` | Nada si `ConditioningBatchLineView` no necesita imagen. Las filas ya heredan el campo con `...line` |
| UI | `app/(private)/asignacion/empaque/[id]/components/packing-order-screen.tsx` | Vista 1 |
| UI | `app/(private)/asignacion/empaque/[id]/components/packing-finish-dialog.tsx` | Vista 2 |
| UI | `app/(private)/asignacion/components/order-distribution-full.tsx` | Prop opcional `withImages`; `OrderDistributionFullLine.packagingImageUrl?` |
| UI | `app/(private)/asignacion/acondicionamiento/[id]/components/conditioning-order-screen.tsx` | Vista 3: `<OrderDistributionFull withImages …/>` fuera del texto en línea |
| catálogo | `components/shared/CATALOGO.md` | Nada si no se toca `components/shared` (`OrderDistributionFull` vive en la ruta) |

Requerido u opcional [P4]: propongo `packagingImageUrl: string | null` **requerido** en los tipos de
dominio (`AssignedOrderPresentationLine`, `OrderDistributionLineView`, `PackingFinishLineView.packaging`).
Así el `typecheck` obliga a propagarlo y no se pierde por el camino. Coste: hay unos **45 archivos de
`tests/`** que construyen líneas con `packagingName:` y ~13 con `PackagingRef`/`packaging: {`, y
tendrán que añadir el campo (cambio mecánico). En los tipos de props de UI (`OrderDistributionFullLine`)
sería opcional, como ya lo es `packagingName?`.

## Tests que habría que ajustar o añadir

Para añadir (nuevos casos):
- `tests/integration/inventario/qc195-packaging-catalog.int.test.ts`: `findPackagingRefs` devuelve
  `imageUrl: null`; `createFindPackagingRefs` con un doble de `publicUrl` compone la URL de un envase
  con `imagePath` y deja `null` el que no tiene; un envase de otra empresa no vuelve (ya cubierto).
- `tests/unit/pedidos/order-catalog.test.ts` (fake de `findRefs`, ~46 y ~664-706): la línea del
  resumen lleva `packagingImageUrl`; sigue siendo **una** llamada por página.
- `tests/unit/asignaciones/order-distribution-view.test.ts`: `toDistributionLines` copia
  `packagingImageUrl`.
- `tests/unit/asignaciones/get-packing-order.test.ts` (~71, ~521): `finish.lines[i].packaging.imageUrl`
  sale del `PackagingRef`; `null` en una línea antigua.
- `tests/unit/asignaciones-ui/packing-order-screen.test.tsx`: una `EntityImage` por línea, con `alt` del
  nombre del envase; marcador (`data-missing="true"`) sin imagen.
- `tests/unit/asignaciones-ui/packing-finish-dialog.test.tsx`: la fila usa la imagen del envase y
  ya no el icono; marcador en una línea antigua.
- `tests/unit/asignaciones-ui/conditioning-order-screen.test.tsx`: el subtítulo muestra las imágenes.
- `tests/unit/asignaciones-ui/conditioning-orders-columns.test.tsx`: **sin** imágenes en la columna
  (fija [P1]-A) y el texto no cambia.

Para ajustar (fixtures o snapshots, sin cambio de intención):
- `tests/helpers/packaging-catalog-double.ts`: `packagingRef()` con `imageUrl: null` por defecto.
- Fixtures con `packagingName:` en `tests/unit/asignaciones/*` (`list-assigned-orders`,
  `list-packing-orders`, `list-conditioning-orders`, `list-conditioned-orders`,
  `list-delivered-conditioned-orders`, `get-conditioning-order`, `get-assigned-order-execution`,
  `finish-conditioning`) y `tests/unit/pedidos/{get-order,list-orders,order-service,qc195-contrato-tipos}.test.ts`.
  Las de `pedidos-ui` solo si [P6].
- `tests/unit/paridad/__snapshots__/asignacion-acondicionamiento-paridad.test.tsx.snap`: el snapshot
  de la pantalla 3 cambia. Hay que regenerarlo y revisar el diff.
- E2E `e2e/envases-reales-empaque.spec.ts` y `e2e/acondicionamiento.spec.ts`: comprueban el texto
  del reparto. El `alt` no cambia el `textContent`, así que no deberían romperse, pero conviene
  correrlos.
- Guardias `tests/guards/guard-piezas-base.test.ts` y `guard-formularios-y-acciones.test.ts`: citan
  `OrderDistributionFull`. Hay que comprobar que la prop nueva no viola nada.

## Puntos para aprobar

- **[P1]** Columna «Envases» de «Por acondicionar»: **recomiendo A, sin imágenes** (solo en detalle y diálogo).
- **[P2]** Sin imagen, envase de baja o línea antigua: **recomiendo el marcador** `inv_not_found.png`.
- **[P3]** En el diálogo «Terminar», ¿80 px con zoom (recomendado) o sin zoom si el `Dialog` anidado da problemas?
- **[P4]** `packagingImageUrl` **requerido** en los tipos de dominio (recomendado), con unos 45 fixtures que retocar.
- **[P5]** `OrderDistributionLabel` y `presentationColumn` no se tocan (recomendado).
- **[P6]** ¿Propagar también a `pedidos` (`order-view.ts`, `toOrderView`)? Ninguna vista de este cambio lo
  usa. **Recomiendo no hacerlo** y propagar solo por `AssignedOrderPresentationLine`.
- **[P7]** Pase `/design` **hecho, pendiente de aprobación humana**. Se actualizaron los tableros
  existentes en el canvas (versión 69) y su copia en `docs/diseno/canvas/`:
  `Empaque.dc.html`, `EmpaqueMovil.dc.html`, `EmpaqueTerminar.dc.html`,
  `EmpaqueTerminarEstados.dc.html`, `EmpaqueTerminarMovil.dc.html`, `Acondicionamiento.dc.html` y
  `AcondicionamientoMovil.dc.html`. Los `…Tablet` no cambian: importan la pantalla. En cada pantalla
  hay una línea con imagen (Galón, se amplía al tocarla) y otra sin imagen (Botella, marcador). En el
  canvas, el marcador es un icono de imagen tachada; en la app es `inv_not_found.png` de `EntityImage`.

## Decisión del humano (2026-10-15)

Aprobado: tableros del pase `/design` (canvas v69) y las recomendaciones del leader:
- P1: la tabla «Por acondicionar» no cambia.
- P2: sin imagen, marcador `inv_not_found.png` de `EntityImage`.
- P3: miniatura con zoom también en el diálogo «Terminar»; si el `Dialog` anidado falla, se quita el zoom solo ahí.
- P4: `imageUrl` / `packagingImageUrl` **opcionales** en los tipos de dominio (no se retocan los ~45 fixtures).
- P5: `OrderDistributionLabel` y `presentationColumn` no se tocan.
- P6: no se propaga a `pedidos` (`order-view.ts`, `toOrderView`).
- P7: pase `/design` hecho y aprobado.

Cambio menor autorizado sin SDD completo (sin `requirements.md` ni `tasks.md`).
