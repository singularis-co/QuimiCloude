# impl QC-224 — anular-entrega

## T0 — contrato (backend_dev, 2026-10-09)

### Archivos
Nuevos:
- `lib/modules/inventario/domain/finished-goods-return.ts`
- `lib/modules/pedidos/ports/order-delivery-void-repository.ts`
- `lib/modules/pedidos/ports/order-delivery-void-unit-of-work.ts`
- `lib/modules/pedidos/domain/list-order-deliveries.ts` (stub: `pedidos.consultar` y luego `ActionNotAllowedError`)
- `lib/modules/pedidos/domain/void-delivery.ts` (stub: `entregas.anular` y luego `ActionNotAllowedError`)
- `tests/fixtures/order-delivery-void.ts`

Modificados:
- `lib/modules/inventario/index.ts`, `domain/inventory-movement.ts`, `domain/reservation.ts`
- `app/(private)/inventario/components/batch-history.tsx` (solo `KIND_LABELS.delivery_void`)
- `lib/modules/pedidos/domain/errors.ts`, `index.ts`, `adapters/driving/order-actions.ts`
- `lib/modules/identity/domain/permissions.ts`
- `lib/modules/errores/domain/error-codes.ts`, `error-catalog.ts`
- `lib/composition/index.ts` (dobles provisionales; B5 los sustituye)
- Censos con nota fechada 2026-10-09: `tests/unit/identity/permissions.test.ts`,
  `tests/unit/errores/catalogo.test.ts`, `tests/unit/pedidos/order-actions.test.ts`,
  `tests/unit/navegacion/qc75-convenciones.test.ts`,
  `tests/unit/asignaciones/schema/order-assignments-migration.test.ts`

### Desvio respecto de tasks.md
- `NewInventoryMovement['kind']` NO gana `'delivery_void'` en T0: `writeMovement` pasa `kind` al enum
  de Prisma, que no tiene el valor hasta B1, y `typecheck` cae. Si ganan el valor
  `InventoryMovementView['kind']` y `BatchHistoryEntry['kind']`, y `NewInventoryMovement` gana
  `orderDeliveryVoidId?`. Lo amplia B1/B2 junto con el enum de `db/schema.prisma`.

### Verificacion de design.md > 4.2
Ningun producto terminado puede ser ingrediente: `isIngredientType` excluye `FINISHED_PRODUCT`
y la usan todos los caminos que escriben lineas de receta (`create-recipe`, `update-recipe`,
`update-recipe-version`, `create-recipe-version` -que ademas rechaza `FINISHED_PRODUCT` explicito-
y `confirm-formula-import`); `updateAliveProduct` devuelve `type_locked` ante un cambio de tipo a o
desde `FINISHED_PRODUCT`, y el alta manual no lo ofrece. Se cumple.

### R -> test (T0)
- R1 (base): `tests/unit/identity/permissions.test.ts > QC-224 — el permiso entregas.anular` (6 casos)

### Gate
- `pnpm run typecheck`: 0 errores.
- `pnpm run lint`: 0 errores, 7 avisos ajenos (tests de documentos y order-service).
- `vitest related --run --project node --project ui <archivos tocados>`: 587 archivos, 9950 pass, 41 skip, 0 fail.
- `vitest run guard`: 62 archivos, 834 pass, 15 skip, 0 fail.
- Unicidad del catalogo (`tests/unit/errores/catalogo.test.ts`): verde.
- Proyecto `integration` no corrido: el worktree no tiene `.env` (`DATABASE_URL`).

Veredicto: T0 listo para commit.

## B4 — casos de uso reales (backend_dev, 2026-10-09)

### Archivos
Modificados (solo el cuerpo; firmas, `…Deps` y puertos de T0 intactos):
- `lib/modules/pedidos/domain/void-delivery.ts`: `design.md > 2.3` y § 4 (permiso, zod estricto con
  refine de repetidos, clave previa, entrega, transaccion: bloqueo → clave → estado → lineas →
  `create` → `addLines` → `returnForDeliveryVoid` → `setStatus` si `ENTREGADO`; senal de clave ya
  registrada resuelta fuera con relectura). No llama a `assertTransition`.
- `lib/modules/pedidos/domain/list-order-deliveries.ts`: permiso → uuid → `findAliveById` →
  `listByOrder` → reparto+presentaciones, clientes, personas (incluidos autores de anulacion) y
  lotes en un `Promise.all` → agrupa por `presentationLineId` en orden de aparicion. Sin entregas
  no consulta catalogos. Nombre ausente → primeros 8 caracteres del id, sin lanzar.

Nuevos:
- `tests/unit/pedidos/void-delivery.test.ts` (49 casos)
- `tests/unit/pedidos/list-order-deliveries.test.ts` (16 casos)

### Decisiones de implementacion donde el spec no fija el detalle
- `batch_not_found` → `Error` interno (§ 4 paso 5), no `DeliveryBatchNotFoundError`.
- Identificador corto = `id.slice(0, 8)`: el spec dice «identificador corto» sin longitud y el repo no
  tenia convencion previa.
- Orden de presentaciones dentro de una entrega: el de la primera linea de cada una que entrega el
  lector.

### R -> test (B4)
`void-delivery.test.ts`:
- R2: `R2: sin entregas.anular responde unauthorized antes de validar, y ningun puerto se llama`
- R3: `R3: un actor con entregas.anular y otro rol es aceptado`; `R3: un Administrador sin entregas.anular en su conjunto es rechazado`
- R17: `R17: <caso> responde invalid_input sin leer ni escribir nada` (15 formas) y `R17: el motivo de 500 caracteres con espacios alrededor se acepta y se guarda recortado`
- R18: `R18: la entrega ausente o de otra empresa responde delivery_not_found sin abrir la transaccion`
- R19: `R19: bloquea el pedido de la entrega; si ya no existe o esta borrado responde order_not_found sin escribir`; `R19: un pedido CANCELADO responde action_not_allowed sin escribir`; `R19: un pedido <estado> responde action_not_allowed sin escribir` (resto de estados); `R19: el estado se comprueba sobre la fila bloqueada, despues del bloqueo`
- R20: `R20: una presentacion que no es de esa entrega responde invalid_input sin escribir`
- R21: `R21: una presentacion ya anulada responde delivery_already_voided y no anula las otras pedidas`; `R21: basta con una linea anulada de la presentacion para rechazarla entera`; `R21: addLines con already_voided (respaldo de la base) se traduce a delivery_already_voided y deshace`
- R22: `R22: guarda la anulacion con la entrega, el motivo recortado, el autor y el instante`; `R22: addLines recibe todas las lineas de las presentaciones pedidas, en todos sus lotes, y ninguna otra`; `R22: con dos presentaciones pedidas anula las lineas de las dos y deja la no pedida`
- R23, R24 (parte de dominio): `R23, R24: devuelve a cada lote la cantidad que desconto su linea de entrega, con el pedido y la anulacion`
- R27: `R27: un pedido ENTREGADO pasa a TERMINADO en la misma transaccion`; `R27: un pedido TERMINADO sigue TERMINADO y no se llama a setStatus`; `R27, R29: setStatus distinto de ok con el pedido bloqueado lanza dentro de la transaccion`
- R28: `R28: clave ya registrada antes de abrir la transaccion: already_registered con el estado leido, sin escribir`; `R28: la clave ya registrada responde aunque la entrega pedida no exista`; `R28: clave vista ya con el pedido bloqueado: deshace y responde already_registered con el estado leido`; `R28: la clave vista con el pedido bloqueado gana al estado: …`; `R28: duplicate_key al crear: deshace y responde already_registered con el estado leido`; `R28: si el pedido de la anulacion registrada ya no se lee, responde order_not_found`
- R29 (parte de dominio): `R29: batch_not_found en la devolucion lanza dentro de la transaccion y no cambia el estado`

`list-order-deliveries.test.ts`:
- R4: `R4: sin pedidos.consultar responde unauthorized antes de leer nada`; `R4: decide por el permiso: un actor de otro rol con pedidos.consultar lee la lista`; `R4: un Administrador sin pedidos.consultar en su conjunto es rechazado`
- R6: `R6: un id sin forma de uuid responde order_not_found sin leer nada`; `R6: el pedido que no existe | esta borrado | es de otra empresa (el puerto devuelve null) responde order_not_found sin devolver datos`; `R6: lee con el ambito de la empresa del actor`
- R7: `R7, R9: compone la vista entera: …`; `R7: conserva el orden del lector, de la mas reciente a la mas antigua`; `R7: agrupa por presentacion las lineas de una entrega, aunque lleguen intercaladas, y suma sus lotes`; `R7: muestra el cliente y el autor aunque esten dados de baja`; `R7: un nombre que no vuelve de su catalogo se muestra como identificador corto, sin lanzar`
- R8: `R8: un pedido sin entregas devuelve la lista vacia sin consultar catalogos`
- R9: `R9: la presentacion anulada lleva motivo, autor y fecha de su anulacion, junto a sus envases y lotes`; `R9: el autor de la anulacion se resuelve aunque solo aparezca como autor de una anulacion`

### Gate
- `pnpm run typecheck`: 0 errores.
- `pnpm run lint`: 0 errores, 7 avisos ajenos (los mismos de T0).
- `vitest run` de los dos archivos nuevos: 2 archivos, 65 pass.
- `vitest related --run --project node --project ui <4 archivos>`: 316 archivos, 5291 pass, 1 skip, 0 fail.
  Proyecto `integration` no corrido: el worktree no tiene `.env` (`DATABASE_URL`).
- `vitest run guard`: 62 archivos, 833 pass, 15 skip, **1 fail ajeno a B4**:
  `guard-aislamiento-integracion > ninguna entrada del censo nombra un archivo que ya no existe`, por
  `pedidos/order-delivery-void-constraints.int.test.ts`, que B1 ya anoto en `aislamiento.json` y
  aun no ha creado (B1 en curso).

Veredicto: B4 (parte unitaria) lista para commit; se cierra tras B3, como pide `tasks.md`.

## B1 — migraciones, esquema y permiso sembrado (backend_dev, 2026-10-09)

### Timestamps
- Ultima de `origin/dev`: `20261008150200_delivery_permission`.
- `origin/feature/QC-218-acondicionar-con-equipo`: ultima `20261008150000_order_conditioning_team`.
- `origin/feature/QC-222-menu-de-integraciones`: ultima `20261008120843_integrations_permission`.
- Las tres nuevas (`20261009120000/…100/…200`) quedan detras de todas; sin choque.
- Texto vigente de los dos CHECK que se reescriben: el de `20261008150100_order_deliveries` (ninguna
  migracion posterior los toca). `users (id, company_id)` existe (la usa `order_deliveries_created_by_fkey`).

### Archivos
Nuevos:
- `db/migrations/20261009120000_inventory_movement_kind_delivery_void/{migration,down}.sql`
- `db/migrations/20261009120100_order_delivery_voids/{migration,down}.sql`
- `db/migrations/20261009120200_delivery_void_permission/{migration,down}.sql`
- `tests/unit/pedidos/schema/order-delivery-voids-migration.test.ts` (20 casos)
- `tests/unit/identity/schema/delivery-void-permission-migration.test.ts` (8 casos)
- `tests/integration/identity/delivery-void-permission-migration.int.test.ts` (6 casos)
- `tests/integration/pedidos/order-delivery-void-constraints.int.test.ts` (12 casos)

Modificados:
- `db/schema.prisma`: `InventoryMovementKind.delivery_void` (al final); `InventoryMovement.orderDeliveryVoidId`
  + su `@@index`; `OrderDelivery.voids`; `OrderDeliveryLine.voidLine` y `@@unique([id, deliveryId])`
  (`order_delivery_lines_id_delivery_id_key`, igual que QC-223 declaro la de `order_presentation_lines`);
  modelos nuevos `OrderDeliveryVoid` y `OrderDeliveryVoidLine` (`/// @module pedidos`). Bloques añadidos, nada reordenado.
- `lib/modules/inventario/domain/inventory-movement.ts`: `NewInventoryMovement['kind']` gana `'delivery_void'`
  (pendiente heredado de T0). Cliente regenerado con `prisma generate`.
- Censos con nota fechada 2026-10-09, aserciones previas conservadas:
  - `tests/guards/guard-identificador-de-request.test.ts` (`MIGRACIONES_ESPERADAS` + 3);
  - `tests/unit/pedidos/schema/pedidos-schema.test.ts` (2 sitios: la lista previa queda como
    `arrayContaining`, la exacta gana `OrderDeliveryVoid` y `OrderDeliveryVoidLine`);
  - `tests/unit/inventario/schema/finished-product-enum-values-migration.test.ts` (+ `delivery_void`);
  - `inventario-schema.test.ts`, `inventario-migration.test.ts` y `proveedores-migration.test.ts` no
    enumeran el tipo entero: sin cambios.
- `tests/integration/identity/identity-seed.int.test.ts`: caso `QC-224 R1` (copia del de QC-223 para `entregas.anular`).
- `tests/integration/aislamiento.json`: las dos suites nuevas en `transaccion`.

### R -> test (B1)
- R1: `tests/unit/identity/schema/delivery-void-permission-migration.test.ts` (8);
  `tests/integration/identity/delivery-void-permission-migration.int.test.ts` (6);
  `tests/integration/identity/identity-seed.int.test.ts > QC-224 R1: …`.
- R24: `order-delivery-voids-migration.test.ts > inventory_movement_kind_delivery_void` (UP, guarda del DOWN,
  tipo recreado, CHECK repuestos) y `> R24, R32: delivery_void entra en los CHECK…`;
  `order-delivery-void-constraints.int.test.ts > R24, R32: …` (2 casos).
- R32: `order-delivery-void-constraints.int.test.ts` (control positivo + un INSERT crudo por restriccion:
  entrega/empresa/usuario ajenos, clave por empresa, motivo vacio/espacios/>500, linea anulada dos veces,
  linea de otra entrega, empresa de la linea, asiento sin anulacion/pedido/cantidad<=0/con motivo, anulacion en
  asiento ajeno, uno por lote y anulacion, anulacion y lote de otra empresa, RLS); estatico en
  `order-delivery-voids-migration.test.ts` (RLS ENABLE+FORCE, FK compuestas, `::text`, indice parcial `IS NOT NULL`, DOWN inverso).
- R33 (parte de esquema): `order-delivery-voids-migration.test.ts > R33: ninguna de las dos tablas tiene updated_at ni deleted_at`.
- R34: `order-delivery-voids-migration.test.ts > R34: tablas, columnas y valor de enum nuevos estan en ingles…`.

### Base de la feature
`qc224_anular_entrega` en `localhost:5432` (receta: migrar → sembrar → `resolve --rolled-back` → migrar;
el primer `migrate deploy` ya termino en verde sobre la base vacia y el `resolve` respondio «not in a failed
state»; tras el seed, `No pending migrations`). `DATABASE_URL`/`DIRECT_URL` solo en el entorno de los
comandos; ningun `.env` escrito.

### Migrate / rollback (contra `qc224_anular_entrega`)
```
pnpm run db:migrate   -> Applying 20261009120000…, 20261009120100…, 20261009120200… All migrations have been successfully applied.
pnpm run db:rollback  -> 20261009120200_delivery_void_permission revertida.
  (carpeta apartada)
pnpm run db:rollback  -> 20261009120100_order_delivery_voids revertida.
  (carpeta apartada)
pnpm run db:rollback  -> 20261009120000_inventory_movement_kind_delivery_void revertida.
  estado: enum sin delivery_void = 0, order_delivery_voids = null, permiso = 0, filas _prisma_migrations 20261009* = 0
segundo ciclo up/down: CHECK e indices de inventory_movements identicos a los previos (19 objetos, diff vacio)
pnpm run db:migrate   -> All migrations have been successfully applied.
prisma migrate status -> 84 migrations found … Database schema is up to date!
prisma migrate diff (BD -> schema): en las tablas tocadas solo FK escritas a mano (drift esperado, como QC-223).
```
DOWN de `delivery_void` con asiento presente, en `BEGIN … ROLLBACK` (cadena empresa→…→anulacion→asiento):
```
asiento delivery_void insertado
down.sql abortado: 23514 inventory_movement_kind_delivery_void_in_use: hay asientos con kind = delivery_void; revertir el tipo los dejaria sin representar.
ROLLBACK hecho
```

### Gate
- `pnpm run typecheck`: 0 errores.
- `pnpm run lint`: 0 errores, 7 avisos ajenos (los mismos de T0).
- `vitest related --run --project node --project ui <archivos tocados>`: 5 archivos, 91 pass.
- `vitest run guard`: 62 archivos, 834 pass, 15 skip, 0 fail.
- `vitest run --project node tests/unit/pedidos/schema tests/unit/identity/schema/delivery-void-permission-migration.test.ts tests/unit/inventario/schema`: 33 archivos, 446 pass.
- `vitest run --project integration` (las 3 suites de B1 + `order-delivery-constraints` y
  `delivery-permission-migration` de QC-223): 5 archivos, 66 pass, base efimera borrada al final.
- Rojos ajenos vistos en `vitest run --project node tests/unit` (2), ambos de los archivos de B4 en curso
  (`list-order-deliveries.ts`, `void-delivery.ts`): `clientes/scope.test.ts` (import de clientes desde
  `list-order-deliveries.ts`) y `pedidos/order-delivery-append-only.test.ts` (TC lo enmienda). No son de B1.

### Observacion
- `btrim("reason")` sin segundo argumento solo quita espacios: un motivo de solo tabuladores o saltos de linea
  pasa el CHECK. R32 dice «solo con espacios» y design §3.2 fija ese SQL, asi que se dejo tal cual y el test no
  cubre blancos que no son espacio; la validacion del dominio (trim) es quien los rechaza. Si se quiere cerrar en
  la base: `btrim("reason", E' \t\r\n')`. Decision del leader/humano.

Veredicto: B1 listo para commit; migraciones verificadas up/down/up contra `qc224_anular_entrega`.

## B3 — persistencia de la anulacion en `pedidos` (backend_dev, 2026-10-09)

### Archivos
Nuevos:
- `lib/modules/pedidos/adapters/driven/persistence/order-delivery-void-prisma.ts`:
  `createOrderDeliveryVoidRepository(tx)` (`findByKey`, `findDelivery`, `findDeliveryLines` con
  `quantity.toFixed(4)` y `voided` por `voidLine`, `create` con P2002 → `duplicate_key`, `addLines`
  con `createMany` y P2002 → `already_voided`) y `createOrderDeliveryHistoryReader(tx)` (`listByOrder`:
  `createdAt desc, id asc`, lineas con su `voidLine.void`). Todo filtra con `companyScopeColumns`; sin
  `update`, `delete` ni `upsert`.
- `tests/integration/pedidos/order-delivery-void-repository.int.test.ts` (13 casos).

Modificados:
- `order-delivery-prisma.ts`: `sumOrderDeliveredPackages` añade `voidLine: null` al `where`.
- `tests/integration/pedidos/order-delivery-repository.int.test.ts`: caso R26 con nota fechada.
- `tests/integration/aislamiento.json`: `pedidos/order-delivery-void-repository.int.test.ts` en `transaccion`.
- `tests/unit/pedidos/module-contract.test.ts` (censo, nota fechada 2026-10-09): el adaptador nuevo entra en
  `DUENOS_DE_PRISMA` y `DUENOS_DEL_CLIENTE`; listas cerradas y aserciones previas intactas.
- Arreglo heredado de B4: `lib/modules/pedidos/domain/list-order-deliveries.ts` renombra `customers` →
  `customerNames` (tipo interno `Names` y destructuring); sin cambio de contrato. Ya no queda `customers` en
  `lib/modules/pedidos/`; `tests/unit/clientes/scope.test.ts` en verde. El test unitario no lo usaba.

### R -> test (B3)
`order-delivery-void-repository.int.test.ts`:
- R18: `R18: create con el ambito de B no puede apuntar a la entrega de A`; `R18: findDelivery … la de otra empresa y la que no existe salen null`; `R18: addLines con el ambito de B no puede colgar lineas de la anulacion de A`
- R21, R22: `R21, R22: findDeliveryLines trae todas las lineas con su cantidad y su marca de anulada; con el ambito de B, ninguna`
- R21, R30: `R21, R30: addLines sobre una linea ya anulada responde already_voided y no escribe ninguna de las pedidas`
- R22: `R22: create guarda la anulacion …`; `R22: addLines guarda una linea por linea de entrega …`
- R28: `R28: la misma clave … duplicate_key …`; `R28: la clave es unica por empresa …`; `R28: findByKey …`
- R6, R7, R8, R9: `R7, R9: listByOrder ordena … y trae la anulacion de cada linea`; `R7: dos entregas en el mismo instante salen ordenadas por id`; `R6, R8: listByOrder solo ve las entregas del pedido y la empresa; con el ambito de B, ninguna`
`order-delivery-repository.int.test.ts`:
- R26: `R26: sumDeliveredPackages no suma las lineas anuladas, y una linea con todo anulado no aparece`

### Gate
- `pnpm run typecheck`: 0 errores.
- `pnpm run lint`: 0 errores, 7 avisos ajenos (los mismos de T0).
- `vitest related --run --project node --project ui` (3 archivos de produccion): 315 archivos, 5241 pass, 1 skip,
  1 fail (`module-contract` por el adaptador nuevo) → enmendado; rerun de `module-contract`, `clientes/scope`,
  `pedidos/company-scope` y `guard-ambito-empresa-pedidos`: 4 archivos, 103 pass.
- `vitest run guard` (+ los anteriores): 65 archivos, 890 pass, 15 skip, **1 fail ajeno a B3**:
  `guard-aislamiento-integracion > ningun archivo del arbol se queda fuera del censo`, por
  `inventario/finished-goods-return.int.test.ts` (B2 en curso, aun sin su entrada).
- `vitest run --project integration` contra `qc224_anular_entrega` (copia efimera): `order-delivery-void-repository`,
  `order-delivery-repository`, `company-scope`, `company-scope-queries`, `order-delivery`: 5 archivos, 72 pass.
- No corrido: `order-delivery-append-only.test.ts` (lo enmienda TC).

Veredicto: B3 listo para commit; la guardia de aislamiento queda verde cuando B2 anote su suite.

## B2 — devolucion fisica en `inventario` (backend_dev, 2026-10-09)

### Archivos
Nuevos:
- `lib/modules/inventario/adapters/driven/persistence/finished-goods-return-prisma.ts`: `createFinishedGoodsReturn(tx)`
  (molde de `createFinishedGoodsDispatch`) y `batchLotDirectoryPrisma` (`findLots`: id + empresa, sin filtrar producto vivo).
- `tests/unit/inventario/finished-goods-return-prisma.test.ts` (9 casos, tx doblado)
- `tests/integration/inventario/finished-goods-return.int.test.ts` (5 casos)

Modificados:
- `lib/modules/inventario/adapters/driven/persistence/product-prisma.ts`: `returnFinishedGoods` (octavo camino,
  design § 4.2): lee lotes (id IN, empresa) → `batch_not_found` sin escribir → bloquea productos `FOR NO KEY UPDATE`
  `ORDER BY "id"` sin `deleted_at` → por linea `productBatch.update` (`stock increment`, clave `(id, companyId)`) +
  `writeMovement(delivery_void)` → `recalculateProductStock` una vez por producto (en orden de id). Sin aviso a
  `StockIncreaseListener`.
- `lib/modules/inventario/adapters/driven/persistence/batch-movement-prisma.ts`: `writeMovement` escribe
  `orderDeliveryVoidId` cuando llega. La lectura del historial ya admitia `delivery_void` (cast de T0; sin filtro por kind).
- Censos con nota fechada 2026-10-09, aserciones previas conservadas:
  `tests/guards/guard-libro-de-inventario.test.ts` (`CAMINOS_ESPERADOS` + titulo) y
  `tests/unit/inventario/qc121-alcance.test.ts` (`CAMINOS_ESPERADOS`, fuente fabricada con el octavo camino, titulos siete→ocho, noveno fabricado).
- `tests/integration/inventario/ledger-cuadre.int.test.ts`: caso `QC-224 R23, R24` (entrega + anulacion, cuadra antes y despues).
- `tests/integration/aislamiento.json`: `inventario/finished-goods-return.int.test.ts` en `commit` (motivo: `findLots` y
  `findBatchMovements` leen con el cliente global; el resto de casos usa ROLLBACK).
- `lib/composition/index.ts` NO se toca (B5 cablea).

### BLOQUEO: `qc91-alcance.test.ts` rojo
`tasks.md` B2 pide verificar que `qc91-alcance.test.ts` sigue verde sin cambios, y design § 4.2 dice que el incremento es
un `update` porque «el censo de qc91 limita `updateMany`». Pero qc91 tambien limita `update`:
`R21: el alta y el agregado de lote siguen creando; el unico update vive en adjustBatchStock`
(`llamaAUpdateFueraDe(fuente, 'adjustBatchStock')` debe ser `false`) cae con `returnFinishedGoods`. Cualquier
alternativa tambien rompe qc91 (`updateMany` fuera de los dos decrementos; `UPDATE "product_batches"` crudo lo caza
`escrituraDestructivaDeLotes`). No se enmendo por la instruccion explicita «sin cambios». Propuesta (decision del
leader/humano): enmendar qc91 con nota fechada, admitiendo `update` tambien en `returnFinishedGoods` (mismo
mecanismo de lista que QC-223 uso para `updateMany`), conservando la asercion con `'adjustBatchStock'` solo como `true`.

### R -> test (B2)
`finished-goods-return-prisma.test.ts`:
- R23: `R23: lotes -> bloqueo de productos -> (incremento -> asiento) por linea -> un recalculo por producto`;
  `R23: el recalculo va una vez por producto afectado, en orden de id`; `R23: los lotes se leen por id y empresa, sin filtrar por producto vivo`;
  `R23: el incremento suma la cantidad de la linea al lote por su clave (id, empresa), sin condicion de stock`
- R24: `R24: writeMovement recibe delivery_void, cantidad positiva, pedido, anulacion y reason null`;
  `R24: returnForDeliveryVoid acota por la empresa de la entrada y delega en la misma tx`
- R29: `R29: un lote que no vuelve (ausente o de otra empresa) da batch_not_found con ese lote y no escribe nada`
- R30, R31: `R30, R31: bloquea los productos de la empresa ordenados por id, FOR NO KEY UPDATE y sin filtrar por deleted_at`
`finished-goods-return.int.test.ts`:
- R23: `R23: cada lote queda en antes + cantidad y products.stock es la suma de todos sus lotes`
- R24: `R24: un asiento delivery_void por lote, en positivo, con pedido, anulacion, autor y sin motivo`
- R31: `R31: el producto dado de baja recupera igual sus envases y su existencia se recalcula`
- R29 (empresa B no se toca): `R29: un lote de la empresa B pedido con el ambito de A da batch_not_found y no toca nada`
- R7, R24 (`findLots` + historial): `R7, R24: findLots devuelve solo los lotes de la empresa y el historial muestra el asiento delivery_void`
`ledger-cuadre.int.test.ts`: `QC-224 R23, R24: cuadra con un lote del que sale una entrega y vuelve con su anulacion`

### Gate
- `pnpm run typecheck`: 0 errores.
- `pnpm run lint`: 0 errores, 7 avisos ajenos (los mismos de T0).
- `vitest related --run --project node --project ui <6 archivos>`: 292 archivos, 4536 pass, 1 skip, 1 fail por timeout
  (`ui` `inventario/product-page.test.tsx`, 20 s con otra corrida en paralelo); solo, en verde.
- `vitest run guard`: 62 archivos, 838 pass, 15 skip, 0 fail.
- `vitest run tests/unit/inventario/qc121-alcance.test.ts tests/unit/inventario/qc91-alcance.test.ts`: qc121 verde;
  **qc91 1 fail (el bloqueo de arriba)**.
- `vitest run --project integration` contra `qc224_anular_entrega` (copia efimera): `finished-goods-return`,
  `ledger-cuadre`, `finished-goods-dispatch`: 3 archivos, 16 pass, base efimera borrada.

Veredicto: B2 implementado y verde salvo `qc91-alcance` R21, que exige decidir la enmienda (spec contradictorio).

## Estado de la tanda 1 (implementer, 2026-10-09)

- Cerradas: T0, B1, B3, B4. B2 implementada pero NO cerrada; B5 no empezada.
- Bloqueo B2: `tests/unit/inventario/qc91-alcance.test.ts` «R21: el alta y el agregado de lote siguen
  creando; el unico update vive en adjustBatchStock» prohibe todo `productBatch.update` fuera de
  `adjustBatchStock`. `design.md > 4.2` (linea ~524) manda un `update` en `returnFinishedGoods` y
  `design.md > 8` / `tasks.md > B2` dicen que qc91 queda «sin cambio». Contradiccion del spec: pendiente
  de decision (propuesta de backend_dev: enmendar qc91 con nota fechada para admitir `update` tambien en
  `returnFinishedGoods`, conservando las aserciones previas).
- Decisiones de B4 a validar: id corto de 8 caracteres cuando falta un nombre; orden de presentaciones
  dentro de una entrega; `batch_not_found` -> `Error` interno (design § 4 paso 5).
- Decision de B1 a validar: el CHECK `btrim("reason")` acepta un motivo de solo tabs/saltos de linea
  (R32 dice «solo con espacios»); el dominio si lo rechaza.

## B2 — cierre tras la enmienda de qc91 (implementer, 2026-10-09)

Decision humana 2026-10-09: enmendar qc91, como la enmienda del 2026-09-17.
- `tests/unit/inventario/qc91-alcance.test.ts`: `llamaAUpdateFueraDe` acepta lista de nombres;
  `UPDATE_PERMITIDO = ['adjustBatchStock', 'returnFinishedGoods']`; nota fechada 2026-10-09 (QC-224
  D12/R31) junto a la del 2026-09-17; el caso R21 del archivo real exige ningun `update` fuera de las
  dos, que solo `adjustBatchStock` ya no baste, y exactamente UN `update` en `returnFinishedGoods`;
  caso sintetico nuevo: un `update` en una tercera funcion sigue en rojo. `delete`, `deleteMany`,
  `upsert`, SQL crudo y `updateMany` sin cambios; nada reordenado.
- Spec: `design.md > 8` (fila qc91 = enmienda), `tasks.md > B2` (enmienda), `requirements.md >
  Decisiones cerradas` (fila nueva). qc91 ya estaba en `## Archivos esperados`.
- `vitest run qc91-alcance qc121-alcance guard-libro-de-inventario`: 3 archivos, 90 pass, 0 fail.

Veredicto: B2 cerrada.

## B5 — cableado real, actions e integracion (backend_dev, 2026-10-09)

### Archivos
Modificados:
- `lib/composition/index.ts`: fuera los dobles de T0 (`orderDeliveryHistoryReader`, `batchLotDirectory`,
  `orderDeliveryVoidReads` y el `orderDeliveryVoidUnitOfWork` que lanzaba) y sus `import type`.
  `orderDeliveryVoidUnitOfWork` real sobre `withOrderTransaction` con `createOrderWriteRepository(tx)`,
  `createOrderDeliveryVoidRepository(tx)` y `createFinishedGoodsReturn(tx)` (molde de `orderDeliveryUnitOfWork`).
  `listOrderDeliveries`: `history: createOrderDeliveryHistoryReader()`, `batchLots: batchLotDirectoryPrisma`,
  `presentationCatalog`, `customerCatalog` y `assignmentDirectoryPrisma` (el mismo objeto que `peopleDirectory`,
  que se declara mas abajo; se conserva la nota de T0). `voidDelivery`: `voids: createOrderDeliveryVoidRepository()`
  (cliente global) y `orders: orderRepository`. Solo se tocaron los bloques de esta feature.
- `tests/unit/identity/session-once-per-request-actions.test.ts`: `ACCIONES` + `listOrderDeliveriesAction` y
  `voidDeliveryAction`, con nota fechada 2026-10-09; filas previas intactas.
- `tests/integration/aislamiento.json`: las dos suites nuevas en `commit`, con motivo y `desde` 2026-10-09
  (mismo modo y motivo que `order-delivery` y `order-delivery-concurrency` de QC-223).

Nuevos:
- `tests/unit/pedidos/order-actions-delivery-void.test.ts` (25 casos).
- `tests/integration/pedidos/order-delivery-void.int.test.ts` (12 casos).
- `tests/integration/pedidos/order-delivery-void-concurrency.int.test.ts` (4 casos).

Sin cambio: `lib/modules/pedidos/adapters/driving/order-actions.ts`. T0 ya dejo `listOrderDeliveriesAction` y
`voidDeliveryAction` con su cuerpo definitivo (`currentActor()` → caso de uso → `success`/`toErrorState`, igual que
`getOrderDeliveryAction`/`deliverOrderAction`); con el cableado real ya no hay nada provisional en ellas.

### Decisiones donde el spec no fija el detalle
- R19 «pedido en otro estado» en la integracion: un pedido con entregas solo puede estar `TERMINADO`/`ENTREGADO` por
  la aplicacion, asi que el caso lo fabrica con `prisma.order.update` a `EN_ACONDICIONAMIENTO` (con `finished_at`
  `null` para cumplir los CHECK). El pedido borrado de R19 no se puede fabricar con entregas
  (`orders_delivered_not_deleted`): queda en el unit de B4. R6 «borrado» si se cubre en la lista (pedido `PENDIENTE`
  con `deleted_at`).
- R29 en la integracion: `createVoidDelivery` cableado a mano con los adaptadores reales y una pieza que falla
  (a) despues de que `returnForDeliveryVoid` real devolviera `returned` y (b) en `setStatus`. Molde: el
  cableado manual de `order-delivery-concurrency.int.test.ts`.
- R30 «anulacion y entrega a la vez»: dos casos. Uno donde cualquier orden admite las dos (se exige que se apliquen
  las dos y que el pedido acabe `TERMINADO`), y otro donde la entrega solo cabe si la anulacion va primero (se acepta
  `aplicada` o `delivery_exceeds_remaining`, y el resto de aserciones se ajusta al orden que ocurrio). Mas el de la
  misma clave con la lectura previa sincronizada (R28, molde de QC-223).
- La limpieza de cada caso borra antes asientos, `order_delivery_void_lines` y `order_delivery_voids`, y despues
  llama a `borrarEmpresaDeEntrega`; el helper compartido `tests/helpers/order-delivery-seed.ts` no se toco
  (no esta en `## Archivos esperados`).
- El orden de presentaciones y lotes que espera el caso de `listOrderDeliveries` se calcula por id: el lector
  ordena las lineas por `orderPresentationLineId, batchId` (B3).

### R -> test (B5)
`order-actions-delivery-void.test.ts`:
- R4, R7: `listOrderDeliveriesAction entrega el id y el actor de la sesion, y devuelve la vista tal cual`
- R8: `una lista sin entregas vuelve como success con la lista vacia`
- R17: `voidDeliveryAction pasa la entrada tal cual al caso de uso, sin quitar ni anadir campos`; `… no recorta el motivo ni deduplica`
- R27, R28: `success lleva el VoidDeliveryResult del caso de uso (voided | alreadyRegistered)`
- R2, R4: `<action> lee cada cara de la sesion una sola vez por invocacion`; `<action> sin sesion entrega actor null y el rechazo vuelve como unauthorized`
- R2, R3: `ninguna de las dos actions repite la comprobacion de permiso`
- R6, R16, R18, R19, R21: `<action> traduce <code> al ErrorState del catalogo` (los seis codigos de design § 2.5, en las dos actions)
- R29: `<action> devuelve un error ajeno como unexpected, sin su detalle`
`session-once-per-request-actions.test.ts`: las dos filas nuevas de `ACCIONES` (R15 de QC-101, una lectura de sesion por peticion).
`order-delivery-void.int.test.ts`:
- R18: `la entrega de la empresa B y una que no existe son delivery_not_found, sin escribir nada`
- R19: `un pedido que ya no esta TERMINADO ni ENTREGADO es action_not_allowed, sin escribir nada`
- R20, R21: `una presentacion que no es de la entrega es invalid_input, y una ya anulada es delivery_already_voided sin anular las otras`
- R22, R23, R24, R25: `guarda la anulacion y sus lineas, devuelve a cada lote lo que salio, asienta delivery_void y deja la entrega identica`
- R27: `un pedido ENTREGADO pasa a TERMINADO con finished_at, packed_by y conditioned_by intactos; uno TERMINADO sigue TERMINADO`
- R26: `tras anular, getOrderDelivery vuelve a ofrecer lo anulado y deliverOrder lo entrega de nuevo y deja el pedido ENTREGADO`
- R28: `la misma clave dos veces deja un solo juego de filas y un solo asiento por lote, y la segunda es already_registered con el estado actual`
- R29: `un fallo forzado (despues-de-devolver | set-status) no deja nada escrito: …` (2 casos)
- R7, R9 (`listOrderDeliveries` de punta a punta): `lista las entregas de la mas reciente a la mas antigua, con cliente dado de baja, autor, presentaciones, lotes y la anulacion`
- R8: `un pedido sin entregas devuelve la lista vacia`
- R4, R6: `sin pedidos.consultar es unauthorized; el pedido de la empresa B, uno que no existe y uno borrado son order_not_found`
`order-delivery-void-concurrency.int.test.ts`:
- R30: `dos anulaciones a la vez de la misma presentacion: una aplicada y la otra delivery_already_voided, y los envases vuelven una sola vez`
- R28, R30: `dos envios a la vez con la misma clave: uno voided y el otro already_registered, y una sola anulacion escrita`
- R27, R30: `una anulacion y la entrega que completaria el pedido, a la vez: se aplican las dos una detras de otra, el pedido acaba TERMINADO y el libro cuadra`
- R30: `una anulacion y una entrega que solo cabe si la anulacion va primero: o se aplican las dos o la entrega es delivery_exceeds_remaining, y el libro cuadra`
  (los cuatro comprueban que cada lote = suma de sus asientos, ningun lote negativo y producto = suma de lotes).

### Gate
- `pnpm run typecheck`: 0 errores.
- `pnpm run lint`: 0 errores, 7 avisos ajenos (los mismos de T0).
- `vitest related --run --project node --project ui lib/composition/index.ts` (unico archivo de produccion tocado):
  280 archivos, 4372 pass, 1 skip, 0 fail (391 s). Una primera corrida la corto mi `timeout 590` (exit 124) con
  rojos `ui` por timeout de 20 s y duraciones de ~9.2e6 ms (maquina suspendida); el rerun sin limite, verde.
- `vitest run guard`: 62 archivos, 838 pass, 15 skip, 0 fail.
- Unit tocados y censos (`order-actions-delivery-void`, `session-once-per-request-actions`, `order-actions`,
  `order-actions-delivery`, `module-contract`, `tests/unit/composition/*`, `order-delivery-append-only`): 10 archivos,
  214 pass, **1 fail aceptado**: `order-delivery-append-only.test.ts > R32: ningun camino … modifica o borra una entrega`
  (lo enmienda TC). `order-actions-delivery-void`: 25 pass; `session-once-per-request-actions`: 76 pass.
- `vitest run --project integration` contra copias efimeras de `qc224_anular_entrega` (plantilla `qct_tpl_2b5200f46f51`
  reutilizada; cada copia borrada al terminar, `db:test list` solo muestra la base de la feature):
  - `order-delivery-void` + `order-delivery-void-concurrency`: 2 archivos, 16 pass.
  - QC-223 y B2/B3 afectados por el cableado (`order-delivery`, `order-delivery-concurrency`, `order-delivery-repository`,
    `order-delivery-void-repository`, `finished-goods-return`, `finished-goods-dispatch`): 6 archivos, 46 pass.
  - `order-delivery-void-concurrency` repetido 3 veces mas: 4/4 pass cada vez.
- MCP del grafo no usado en esta tanda (Grep/Read sobre archivos ya conocidos por la bitacora).

Veredicto: B5 lista para commit; el unico rojo es `order-delivery-append-only` (TC).

## Cierre de la continuacion de la tanda 1 (implementer, 2026-10-09)

- Cerradas: B2 (tras la enmienda de qc91) y B5. Sin empezar: F1–F4, TC, TI, TZ.
- Verificacion del implementer: `vitest run guard` + qc91-alcance + order-actions-delivery-void +
  session-once-per-request-actions + order-delivery-append-only: 66 archivos, 976 pass, 15 skip,
  **1 fail** = `tests/unit/pedidos/order-delivery-append-only.test.ts > R32: ningun camino de lib/ ni
  app/ modifica o borra una entrega…` (rojo aceptado; lo enmienda TC).
- `pnpm run typecheck`: 0 errores.

## F2.3 — merge de origin/dev (implementer, 2026-10-09)

Trae QC-219 (dia de produccion / etiqueta del lote) y QC-234 (secretos de integraciones). 7
conflictos de contenido; ambos lados se conservan, dev primero y QC-224 encima:

- `error-codes.ts` / `error-catalog.ts`: dev (`integration_secret_unreadable`, comentario de
  QC-219) + QC-224 (`delivery_not_found`, `delivery_already_voided`) al final.
- `catalogo.test.ts`: conteo **recalculado a 84** (78 + 1 QC-234 + 3 QC-219 + 2 QC-224).
- `guard-identificador-de-request.test.ts`: las cuatro migraciones del 2026-10-09 en orden de
  nombre de carpeta. Nota: `20261009120000_inventory_movement_kind_delivery_void` (QC-224) y
  `20261009120000_product_batches_production_date` (QC-219) comparten timestamp; Prisma las ordena
  por nombre y son independientes (enum vs columna). La guardia pasa.
- `guard-libro-de-inventario.test.ts`: titulo del censo con los nueve nombres
  (+ `writeFinishedBatchLabels` de QC-219, + `returnFinishedGoods` de QC-224).
- `qc121-alcance.test.ts`: "ocho" -> **nueve** caminos, el fabricado de mas pasa a ser el decimo.
- `qc91-alcance.test.ts` (no trivial): las dos enmiendas ampliaban la misma asercion R21 del
  `update` permitido (dev: `UPDATES_PERMITIDOS = [adjustBatchStock, writeFinishedBatchLabels]`
  con `llamaAUpdateFueraDeLas`; QC-224: `UPDATE_PERMITIDO = [adjustBatchStock, returnFinishedGoods]`
  con `llamaAUpdateFueraDe`). Resolucion: la asercion sobre el `product-prisma.ts` real usa la
  union `[...UPDATES_PERMITIDOS, ...UPDATE_PERMITIDO]`, y se mantienen las comprobaciones de QC-224
  (adjustBatchStock solo ya no basta; exactamente un `update` en `returnFinishedGoods`). Las dos
  constantes y los tests de mutacion de cada lado quedan sin tocar.

Migracion nueva aplicada a `qc224_anular_entrega`: `20261009120000_product_batches_production_date`.

Verificacion: `tsc --noEmit` 0 errores; `vitest run tests/guards` + catalogo + qc121 + qc91:
60 archivos, 925 pass, 12 skip, 0 fail.

## Tanda 2 — frontend F1–F4 y arreglo de customers-migration (implementer, 2026-10-13)

Commits (frontend_dev para F1–F4; implementer para el commit):
- `308260a4` F1 acción «Entregas» en la fila (`order-row-actions`, `order-list-section`, `order-table`,
  `order-columns`, `order-sheet`; test `order-row-actions.test.tsx`, R5).
- `c1d9a3fb` F2 lista reutilizable (`order-delivery-list.tsx` + test; R7–R10).
- `7dc46822` F4 historial del lote (`batch-history.test.tsx`, R35).
- `81324c77` arreglo del rojo de CI en el PR #196: `tests/integration/clientes/customers-migration.int.test.ts`
  sigue de forma transitiva las dependientes de `customers` (entra `20261009120100_order_delivery_voids`).
  Ya está en `## Archivos esperados`.
- `bf485392` F3 sheet y diálogo (`order-deliveries-sheet.tsx`, `delivery-void-dialog.tsx`, `index.ts`,
  `order-sheet.tsx` monta el sheet solo cuando está abierto). frontend_dev corrigió solo el test R14: esperaba a
  que el botón se rehabilitara antes del segundo clic; el componente no cambió.

Mapa R → test (F3):
- R11–R16: `tests/unit/pedidos-ui/delivery-void-dialog.test.tsx` («R11: lista solo las presentaciones sin
  anular, todas marcadas y sin campos de cantidad», «R12: sin ninguna marcada avisa y no envia», «R13: con el
  motivo vacio…», «R13: con mas de 500 caracteres…», «R14: dos confirmaciones del mismo dialogo envian la misma
  clave», «R14: cerrarlo y reabrirlo envia otra clave», «R15: tras voided / already_registered cierra, avisa,
  relee la lista y refresca», «R16: con delivery_already_voided muestra el rechazo y relee la lista», «R16: con
  delivery_not_found / action_not_allowed / unauthorized sigue abierto… conserva lo marcado y el motivo»).
- Sheet: `tests/unit/pedidos-ui/order-deliveries-sheet.test.tsx` (esqueleto, carga, vacío, sin permiso, error,
  «R15: tras anular… relee», «R16: tras delivery_already_voided relee…», fallo de relectura conserva la lista).

Decisiones de F3 para validar (reviewer):
1. Motivo: se valida recortado y se envía tal cual; el servidor recorta (`z.string().trim()`).
2. Tras un éxito, la relectura no se espera (`void reload()`); tras `delivery_already_voided` sí (`await`).
3. Si falla la relectura con la lista ya pintada, se conserva la lista y se muestra el error encima (el spec no
   lo dice).

Verificación (implementer, 2026-10-13; máquina con poca memoria: sin `vitest related` ni E2E):
- `pnpm exec vitest run --project integration tests/integration/clientes/customers-migration.int.test.ts`,
  DATABASE_URL/DIRECT_URL apuntando a `qc224_anular_entrega` solo en el entorno del comando:
  ```
  test-db: plantilla reutilizada: qct_tpl_f0771a8cdad2 (las migraciones no han cambiado)
  test-db: la corrida de integracion va contra qct_qc224_6f998c06_mv6rfq0w_rn0 (copia de qct_tpl_f0771a8cdad2).
   Test Files  1 passed (1)
        Tests  5 passed (5)
  test-db: borrada la base de la corrida: qct_qc224_6f998c06_mv6rfq0w_rn0.
  ```
- `pnpm run typecheck` (`tsc --noEmit`): exit 0.
- `pnpm exec eslint` sobre los 15 archivos que toca la tanda: exit 0, sin salida.
- `pnpm exec vitest run` de `pedidos-ui/{delivery-void-dialog, order-deliveries-sheet, order-delivery-list,
  order-row-actions, order-columns, order-row-wiring, order-sheet, order-sheet-coverage,
  order-sheet-responsibles, order-table, order-list-section}` + `inventario/batch-history`:
  `Test Files  12 passed (12)` / `Tests  291 passed (291)`.
- Rojo aceptado sin tocar: `tests/unit/pedidos/order-delivery-append-only.test.ts` (lo enmienda TC).

Pendiente: TC, TI, TZ (sin empezar).

## TC — barrido de censos y guardias (backend_dev, 2026-10-13)

Archivos modificados:
- `tests/unit/pedidos/order-delivery-append-only.test.ts` (R33), nota fechada QC-224 2026-10-13 (TC)
  en la cabecera; aserciones R32 previas intactas.
  - `NOMBRE_MUTANTE` filtra por una lista explicita `NOMBRES_ADMITIDOS` = {`createVoidDelivery`,
    `voidDeliveryAction`}; cualquier otro nombre `void…Deliver` sigue en rojo. Motivo: el caso de uso
    y la Server Action de la anulacion caian en el patron `void…Deliver` de QC-223.
  - `PRISMA_MUTANTE` + `orderDeliveryVoid`, `orderDeliveryVoidLine`; `SQL_MUTANTE` +
    `order_delivery_voids`, `order_delivery_void_lines`.
  - Casos nuevos (R33): los dos nombres admitidos existen como export unico en `lib/`
    (`lib/modules/pedidos/domain/void-delivery.ts`, `lib/modules/pedidos/adapters/driving/order-actions.ts`)
    y su archivo no modifica ni borra; el adaptador `order-delivery-void-prisma.ts` solo usa
    `findUnique`/`findFirst`/`findMany`/`create`/`createMany`; sintetico con
    `orderDeliveryVoid.update`, `orderDeliveryVoidLine.deleteMany`, `orderDeliveryVoid.upsert`, SQL
    `UPDATE`/`DELETE` sobre las dos tablas, `voidOrderDeliveryAction` y `voidDeliveries` → 7 rojos;
    legitimo con los dos nombres admitidos, lecturas e INSERT → sin rojo.
- Ningun otro censo necesito enmienda: todos verdes con la rama.
- `void-delivery.ts` no llama a `assertTransition` (grep sin coincidencias); `module-contract` verde sin cambio.

Mapa: R33 → `order-delivery-append-only.test.ts > la anulacion de una entrega es solo de insercion (R33)` (4 casos).

Salidas:
- Censos (`vitest run tests/guards tests/unit/pedidos tests/unit/inventario/{scope,company-scope,schema/inventario-schema} tests/unit/identity/{permissions,session-once-per-request-actions} tests/unit/composition`):
  `Test Files  194 passed (194)` / `Tests  3576 passed | 15 skipped (3591)`
- `pnpm run typecheck` (`tsc --noEmit`): exit 0, sin errores.
- `pnpm exec eslint tests/unit/pedidos/order-delivery-append-only.test.ts`: exit 0, sin avisos.

Veredicto: TC en verde; el unico censo enmendado es el de solo-insercion de la entrega (R33).

## Tanda 3 — rojos de CI del PR #196 (run 38412170723) y TC (implementer, 2026-10-13)

Arreglos (sin tocar las guardias):
- `guard-piezas-base` (QC-231 R7): `order-delivery-list.tsx` quitó la constante local `TOUCH_TARGET`; el botón
  «Anular» usa `Button touch`. Commit `96e1050a`.
- `pedidos-convenciones` (R40): `tests/unit/pedidos-ui/order-delivery-list.test.tsx` importa `OrderDeliveryList`
  por el barril `@/app/(private)/pedidos/components` (ya lo exportaba). Commit `3893ea2e`.
- Revisados sin cambio: `delivery-void-dialog.tsx` (ya usa `touchTarget`), `order-deliveries-sheet.tsx`, y los
  tests de dialogo, sheet y `batch-history` (ya importan por barril). `batch-history.tsx` conserva su
  `TOUCH_TARGET` local: viene de QC-92 y la guardia lo exime (`ARCHIVOS_D11`); queda fuera de esta rama.
- `order-delivery-append-only`: enmendado en TC (seccion de backend_dev arriba).

Verificacion (maquina con poca memoria: sin `vitest related` ni E2E):
- `pnpm run typecheck`: exit 0. `pnpm exec eslint` de los archivos tocados: exit 0.
- `vitest run tests/guards/guard-piezas-base.test.ts tests/unit/pedidos-ui tests/unit/inventario/batch-history.test.tsx`:
  `Test Files  49 passed (49)` / `Tests  857 passed | 4 skipped (861)`.
- Censos de TC (`tests/guards tests/unit/pedidos` + scope/company-scope/schema de inventario, identity
  permissions y session-once-per-request-actions, `tests/unit/composition`), tras los arreglos:
  `Test Files  194 passed (194)` / `Tests  3576 passed | 15 skipped (3591)`.

Pendiente: TI, TZ (TI cerrada abajo).

## TI — E2E (frontend_dev, 2026-10-13)

### Archivos
- `e2e/anular-entrega.spec.ts` (nuevo).
- `tests/guards/guard-identificador-de-request.test.ts`: `anular-entrega.spec.ts` en `E2E_ESPERADOS`.

### Siembra
Prisma, prefijo `qc224_e2e_` + `RUN_ID` del worker, empresa propia: Administrador; rol sintetico con
solo `pedidos.consultar` y su usuario; un cliente; receta con dos presentaciones (contenido 1 y 2);
producto terminado con un lote por presentacion; pedido `ENTREGADO` (3 + 2 envases) con una entrega
de las dos presentaciones desde dos lotes, sus dos asientos `delivery` y el stock del lote ya
descontado. `afterAll` borra solo lo del worker, en orden de FK.

### R -> test (TI)
| R | Test |
|---|---|
| R36 | `e2e/anular-entrega.spec.ts` › «el motivo vacio no envia nada y la anulacion con motivo devuelve el lote, reabre el pedido y deja la presentacion pendiente (R36)» (pasos 1–5: `delivery-void-reason-error` sin escrituras; lote 2 a 6.0000, asiento `delivery_void` +4.0000, fila de `order_delivery_voids` con motivo y actor y solo la linea 2, entrega/lineas/asientos `delivery` identicos antes y despues, pedido `TERMINADO`; lista con la anulada y su motivo, fila `data-status="TERMINADO"`; «Entregar» con la linea 2 pendiente) |
| R36 | `e2e/anular-entrega.spec.ts` › «un usuario sin permiso de anular entregas abre «Entregas» y no ve «Anular» (R36)» (paso 6; 0 botones `order-delivery-void`) |

### Corrida local (base `qc224_anular_entrega`, variables en el entorno del comando, sin `.env`)
`prisma migrate status`: 85 migrations found… Database schema is up to date!
Memoria baja: un proyecto por corrida, `--workers=1`, puerto 3117 libre antes y despues.
```
pnpm exec playwright test e2e/anular-entrega.spec.ts --project=chromium --workers=1
[2/2] [chromium] › e2e\anular-entrega.spec.ts:752:7 › anular una entrega de un pedido › un usuario sin permiso de anular entregas abre «Entregas» y no ve «Anular» (R36)
  2 passed (56.6s)

pnpm exec playwright test e2e/anular-entrega.spec.ts --project=webkit --workers=1
Running 2 tests using 1 worker
[1/2] [webkit] › e2e\anular-entrega.spec.ts:592:7 › anular una entrega de un pedido › el motivo vacio no envia nada y la anulacion con motivo devuelve el lote, reabre el pedido y deja la presentacion pendiente (R36)
[2/2] [webkit] › e2e\anular-entrega.spec.ts:752:7 › anular una entrega de un pedido › un usuario sin permiso de anular entregas abre «Entregas» y no ve «Anular» (R36)
  2 passed (32.1s)
```
Filas con prefijo tras la corrida (psql): 0 en companies, users, roles, role_permissions, customers,
presentations, recipes, products, product_batches, inventory_movements, orders y order_delivery_voids.

### Gate
- `pnpm run typecheck`: exit 0.
- `pnpm run lint`: 0 errores, 7 warnings en archivos ajenos (`tests/unit/pedidos/order-service.test.ts`,
  `tests/unit/documentos/confirm-catalog-import.test.ts`).
- `pnpm exec vitest run guard`: 65 archivos; 893 passed, 18 skipped.
- `pnpm exec vitest related --run e2e/anular-entrega.spec.ts tests/guards/guard-identificador-de-request.test.ts`: 1 archivo, 23 passed.

Pendiente: TZ.

## TZ — cierre (implementer, 2026-10-13)

### Mapa R1–R37 -> test
Generado de los nombres reales de los casos que la rama añade (`git diff origin/dev...HEAD -- tests e2e`,
`it`/`test`/`describe` con `R<n>` en el nombre; un caso por archivo, `archivo:linea`). Rutas relativas a
`tests/` salvo `e2e/`. Los 37 requisitos tienen al menos un test que existe. R37 no tiene caso propio en la
rama: lo cubre la guardia preexistente `tests/guards/guard-dependencias-aprobadas.test.ts` (design.md > 10).

| R | Tests (archivo:linea `nombre`) |
|---|---|
| R1 | integration/identity/delivery-void-permission-migration.int.test.ts:122 `R1: el UP y el DOWN son exactamente dos sentencias cada uno, sin ALTER, DROP, UPDATE ni CASCADE`<br>integration/identity/identity-seed.int.test.ts:1039 `QC-224 R1: sobre la base ya sembrada salvo entregas.anular, el seed crea ese permiso y solo la asignacion del Administra`<br>unit/identity/permissions.test.ts:1383 `R1: el catalogo contiene entregas.anular con su modulo, accion y descripcion exactos, al final y una sola vez`<br>unit/identity/schema/delivery-void-permission-migration.test.ts:129 `R1: es EXACTAMENTE dos INSERT (permiso y asignacion), y cae si se cuela otra sentencia` |
| R2 | unit/pedidos/order-actions-delivery-void.test.ts:125 `R2, R4: ${action.nombre} lee cada cara de la sesion una sola vez por invocacion`<br>unit/pedidos/void-delivery.test.ts:175 `voidDelivery — acceso (R2, R3)` |
| R3 | unit/pedidos/order-actions-delivery-void.test.ts:139 `R2, R3: ninguna de las dos actions repite la comprobacion de permiso`<br>unit/pedidos/void-delivery.test.ts:175 `voidDelivery — acceso (R2, R3)` |
| R4 | integration/pedidos/order-delivery-void.int.test.ts:546 `R4, R6: sin pedidos.consultar es unauthorized; el pedido de la empresa B, uno que no existe y uno borrado son order_not_`<br>unit/pedidos/list-order-deliveries.test.ts:164 `listOrderDeliveries — acceso (R4)`<br>unit/pedidos/order-actions-delivery-void.test.ts:92 `R4, R7: listOrderDeliveriesAction entrega el id y el actor de la sesion, y devuelve la vista tal cual` |
| R5 | unit/pedidos-ui/order-row-actions.test.tsx:535 `R5: los otros ocho estados del contrato no ofrecen la lista de entregas` |
| R6 | integration/pedidos/order-delivery-void-repository.int.test.ts:464 `R6, R8: listByOrder solo ve las entregas del pedido y la empresa; con el ambito de B, ninguna`<br>integration/pedidos/order-delivery-void.int.test.ts:546 `R4, R6: sin pedidos.consultar es unauthorized; el pedido de la empresa B, uno que no existe y uno borrado son order_not_`<br>unit/pedidos/list-order-deliveries.test.ts:193 `listOrderDeliveries — pedido (R6)`<br>unit/pedidos/order-actions-delivery-void.test.ts:153 `R6, R16, R18, R19, R21: ${action.nombre} traduce ${state.code} al ErrorState del catalogo` |
| R7 | integration/inventario/finished-goods-return.int.test.ts:324 `R7, R24: findLots devuelve solo los lotes de la empresa y el historial muestra el asiento delivery_void`<br>integration/pedidos/order-delivery-void-repository.int.test.ts:430 `R7, R9: listByOrder ordena de la mas reciente a la mas antigua y trae la anulacion de cada linea`<br>integration/pedidos/order-delivery-void.int.test.ts:440 `R7, R9: lista las entregas de la mas reciente a la mas antigua, con cliente dado de baja, autor, presentaciones, lotes y`<br>unit/pedidos-ui/order-delivery-list.test.tsx:53 `R7: pinta cada entrega en el orden recibido, de la mas reciente a la mas antigua, con fecha, cliente y autor`<br>unit/pedidos/list-order-deliveries.test.ts:221 `listOrderDeliveries — la lista (R7, R8, R9)`<br>unit/pedidos/order-actions-delivery-void.test.ts:92 `R4, R7: listOrderDeliveriesAction entrega el id y el actor de la sesion, y devuelve la vista tal cual` |
| R8 | integration/pedidos/order-delivery-void-repository.int.test.ts:464 `R6, R8: listByOrder solo ve las entregas del pedido y la empresa; con el ambito de B, ninguna`<br>integration/pedidos/order-delivery-void.int.test.ts:537 `R8: un pedido sin entregas devuelve la lista vacia`<br>unit/pedidos-ui/order-delivery-list.test.tsx:86 `R8: sin ninguna entrega muestra el aviso de pedido sin entregas y ninguna fila`<br>unit/pedidos/list-order-deliveries.test.ts:221 `listOrderDeliveries — la lista (R7, R8, R9)`<br>unit/pedidos/order-actions-delivery-void.test.ts:119 `R8: una lista sin entregas vuelve como success con la lista vacia` |
| R9 | integration/pedidos/order-delivery-void-repository.int.test.ts:430 `R7, R9: listByOrder ordena de la mas reciente a la mas antigua y trae la anulacion de cada linea`<br>integration/pedidos/order-delivery-void.int.test.ts:440 `R7, R9: lista las entregas de la mas reciente a la mas antigua, con cliente dado de baja, autor, presentaciones, lotes y`<br>unit/pedidos-ui/order-delivery-list.test.tsx:96 `R9: la presentacion anulada queda marcada como «Anulada», con motivo, autor y fecha, junto a sus envases y lotes origina`<br>unit/pedidos/list-order-deliveries.test.ts:221 `listOrderDeliveries — la lista (R7, R8, R9)` |
| R10 | unit/pedidos-ui/order-delivery-list.test.tsx:127 `R10: sin canVoid la accion no existe en el DOM` |
| R11 | unit/pedidos-ui/delivery-void-dialog.test.tsx:120 `R11: lista solo las presentaciones sin anular, todas marcadas y sin campos de cantidad` |
| R12 | unit/pedidos-ui/delivery-void-dialog.test.tsx:145 `R12: sin ninguna marcada avisa y no envia` |
| R13 | unit/pedidos-ui/delivery-void-dialog.test.tsx:166 `R13: con mas de 500 caracteres avisa de que es demasiado largo y no envia` |
| R14 | unit/pedidos-ui/delivery-void-dialog.test.tsx:188 `R14: dos confirmaciones del mismo dialogo envian la misma clave` |
| R15 | unit/pedidos-ui/order-deliveries-sheet.test.tsx:177 `R15: tras anular cierra el dialogo, relee la lista con el estado nuevo y refresca` |
| R16 | unit/pedidos-ui/delivery-void-dialog.test.tsx:236 `R16: con delivery_already_voided muestra el rechazo y relee la lista`<br>unit/pedidos-ui/order-deliveries-sheet.test.tsx:195 `R16: tras delivery_already_voided relee la lista con el dialogo abierto y el rechazo a la vista`<br>unit/pedidos/order-actions-delivery-void.test.ts:153 `R6, R16, R18, R19, R21: ${action.nombre} traduce ${state.code} al ErrorState del catalogo` |
| R17 | unit/pedidos/order-actions-delivery-void.test.ts:101 `R17: voidDeliveryAction pasa la entrada tal cual al caso de uso, sin quitar ni anadir campos`<br>unit/pedidos/void-delivery.test.ts:207 `voidDelivery — forma de la entrada (R17)` |
| R18 | integration/pedidos/order-delivery-void-repository.int.test.ts:322 `R18: create con el ambito de B no puede apuntar a la entrega de A`<br>integration/pedidos/order-delivery-void.int.test.ts:182 `R18: la entrega de la empresa B y una que no existe son delivery_not_found, sin escribir nada`<br>unit/pedidos/order-actions-delivery-void.test.ts:153 `R6, R16, R18, R19, R21: ${action.nombre} traduce ${state.code} al ErrorState del catalogo`<br>unit/pedidos/void-delivery.test.ts:249 `voidDelivery — entrega y pedido (R18, R19)` |
| R19 | integration/pedidos/order-delivery-void.int.test.ts:213 `R19: un pedido que ya no esta TERMINADO ni ENTREGADO es action_not_allowed, sin escribir nada`<br>unit/pedidos/order-actions-delivery-void.test.ts:153 `R6, R16, R18, R19, R21: ${action.nombre} traduce ${state.code} al ErrorState del catalogo`<br>unit/pedidos/void-delivery.test.ts:249 `voidDelivery — entrega y pedido (R18, R19)` |
| R20 | integration/pedidos/order-delivery-void.int.test.ts:227 `R20, R21: una presentacion que no es de la entrega es invalid_input, y una ya anulada es delivery_already_voided sin anu`<br>unit/pedidos/void-delivery.test.ts:286 `voidDelivery — presentaciones pedidas (R20, R21)` |
| R21 | integration/pedidos/order-delivery-void-repository.int.test.ts:347 `R21, R22: findDeliveryLines trae todas las lineas con su cantidad y su marca de anulada; con el ambito de B, ninguna`<br>integration/pedidos/order-delivery-void.int.test.ts:227 `R20, R21: una presentacion que no es de la entrega es invalid_input, y una ya anulada es delivery_already_voided sin anu`<br>unit/pedidos/order-actions-delivery-void.test.ts:153 `R6, R16, R18, R19, R21: ${action.nombre} traduce ${state.code} al ErrorState del catalogo`<br>unit/pedidos/void-delivery.test.ts:286 `voidDelivery — presentaciones pedidas (R20, R21)` |
| R22 | integration/pedidos/order-delivery-void-repository.int.test.ts:265 `R22: create guarda la anulacion con su empresa, entrega, clave, motivo, autor e instante`<br>integration/pedidos/order-delivery-void.int.test.ts:242 `R22, R23, R24, R25: guarda la anulacion y sus lineas, devuelve a cada lote lo que salio, asienta delivery_void y deja la`<br>unit/pedidos/void-delivery.test.ts:314 `voidDelivery — registro (R22, R23, R24)` |
| R23 | integration/inventario/finished-goods-return.int.test.ts:216 `R23: cada lote queda en antes + cantidad y products.stock es la suma de todos sus lotes`<br>integration/inventario/ledger-cuadre.int.test.ts:396 `QC-224 R23, R24: cuadra con un lote del que sale una entrega y vuelve con su anulacion`<br>integration/pedidos/order-delivery-void.int.test.ts:242 `R22, R23, R24, R25: guarda la anulacion y sus lineas, devuelve a cada lote lo que salio, asienta delivery_void y deja la`<br>unit/inventario/finished-goods-return-prisma.test.ts:72 `R23: lotes -> bloqueo de productos -> (incremento -> asiento) por linea -> un recalculo por producto`<br>unit/pedidos/void-delivery.test.ts:314 `voidDelivery — registro (R22, R23, R24)` |
| R24 | integration/inventario/finished-goods-return.int.test.ts:236 `R24: un asiento delivery_void por lote, en positivo, con pedido, anulacion, autor y sin motivo`<br>integration/inventario/ledger-cuadre.int.test.ts:396 `QC-224 R23, R24: cuadra con un lote del que sale una entrega y vuelve con su anulacion`<br>integration/pedidos/order-delivery-void-constraints.int.test.ts:423 `R24, R32: delivery_void exige su anulacion, su pedido, cantidad positiva y ningun motivo`<br>integration/pedidos/order-delivery-void.int.test.ts:242 `R22, R23, R24, R25: guarda la anulacion y sus lineas, devuelve a cada lote lo que salio, asienta delivery_void y deja la`<br>unit/inventario/finished-goods-return-prisma.test.ts:126 `R24: writeMovement recibe delivery_void, cantidad positiva, pedido, anulacion y reason null`<br>unit/pedidos/schema/order-delivery-voids-migration.test.ts:255 `R24: el UP solo anade el valor delivery_void al tipo`<br>unit/pedidos/void-delivery.test.ts:314 `voidDelivery — registro (R22, R23, R24)` |
| R25 | integration/pedidos/order-delivery-void.int.test.ts:242 `R22, R23, R24, R25: guarda la anulacion y sus lineas, devuelve a cada lote lo que salio, asienta delivery_void y deja la` |
| R26 | integration/pedidos/order-delivery-repository.int.test.ts:426 `R26: sumDeliveredPackages no suma las lineas anuladas, y una linea con todo anulado no aparece`<br>integration/pedidos/order-delivery-void.int.test.ts:303 `R26: tras anular, getOrderDelivery vuelve a ofrecer lo anulado y deliverOrder lo entrega de nuevo y deja el pedido ENTRE` |
| R27 | integration/pedidos/order-delivery-void-concurrency.int.test.ts:208 `R27, R30: una anulacion y la entrega que completaria el pedido, a la vez: se aplican las dos una detras de otra, el pedi`<br>integration/pedidos/order-delivery-void.int.test.ts:284 `R27: un pedido ENTREGADO pasa a TERMINADO con finished_at, packed_by y conditioned_by intactos; uno TERMINADO sigue TERM`<br>unit/pedidos/order-actions-delivery-void.test.ts:114 `R27, R28: success lleva el VoidDeliveryResult del caso de uso (${nombre})`<br>unit/pedidos/void-delivery.test.ts:357 `voidDelivery — estado del pedido (R27)` |
| R28 | integration/pedidos/order-delivery-void-concurrency.int.test.ts:188 `R28, R30: dos envios a la vez con la misma clave: uno voided y el otro already_registered, y una sola anulacion escrita`<br>integration/pedidos/order-delivery-void-repository.int.test.ts:284 `R28: la misma clave en la misma empresa da duplicate_key y no deja una segunda fila`<br>integration/pedidos/order-delivery-void.int.test.ts:342 `R28: la misma clave dos veces deja un solo juego de filas y un solo asiento por lote, y la segunda es already_registered`<br>unit/pedidos/order-actions-delivery-void.test.ts:114 `R27, R28: success lleva el VoidDeliveryResult del caso de uso (${nombre})`<br>unit/pedidos/void-delivery.test.ts:382 `voidDelivery — idempotencia (R28)` |
| R29 | integration/inventario/finished-goods-return.int.test.ts:302 `R29: un lote de la empresa B pedido con el ambito de A da batch_not_found y no toca nada`<br>integration/pedidos/order-delivery-void.int.test.ts:414 `R29: un fallo forzado (${donde}) no deja nada escrito: ni anulacion, ni lineas, ni asientos, ni existencia, ni estado`<br>unit/inventario/finished-goods-return-prisma.test.ts:162 `R29: un lote que no vuelve (ausente o de otra empresa) da batch_not_found con ese lote y no escribe nada`<br>unit/pedidos/order-actions-delivery-void.test.ts:160 `R29: ${action.nombre} devuelve un error ajeno como unexpected, sin su detalle`<br>unit/pedidos/void-delivery.test.ts:350 `R29: batch_not_found en la devolucion lanza dentro de la transaccion y no cambia el estado` |
| R30 | integration/pedidos/order-delivery-void-concurrency.int.test.ts:161 `R30: anulaciones simultaneas`<br>integration/pedidos/order-delivery-void-repository.int.test.ts:397 `R21, R30: addLines sobre una linea ya anulada responde already_voided y no escribe ninguna de las pedidas`<br>unit/inventario/finished-goods-return-prisma.test.ts:91 `R30, R31: bloquea los productos de la empresa ordenados por id, FOR NO KEY UPDATE y sin filtrar por deleted_at` |
| R31 | integration/inventario/finished-goods-return.int.test.ts:285 `R31: el producto dado de baja recupera igual sus envases y su existencia se recalcula`<br>unit/inventario/finished-goods-return-prisma.test.ts:91 `R30, R31: bloquea los productos de la empresa ordenados por id, FOR NO KEY UPDATE y sin filtrar por deleted_at` |
| R32 | integration/pedidos/order-delivery-void-constraints.int.test.ts:264 `R32: control positivo: una anulacion de la empresa con su linea y su asiento delivery_void se acepta`<br>unit/pedidos/schema/order-delivery-voids-migration.test.ts:278 `R32: las dos tablas nuevas nacen con RLS ENABLE y FORCE, y cae si falta el FORCE` |
| R33 | unit/pedidos/order-delivery-append-only.test.ts:112 `la anulacion de una entrega es solo de insercion (R33)`<br>unit/pedidos/schema/order-delivery-voids-migration.test.ts:284 `R33: ninguna de las dos tablas tiene updated_at ni deleted_at` |
| R34 | unit/pedidos/schema/order-delivery-voids-migration.test.ts:423 `R34: tablas, columnas y valor de enum nuevos estan en ingles y son exactamente los esperados` |
| R35 | unit/inventario/batch-history.test.tsx:336 `R35 — un asiento de anulacion de entrega se pinta como «Anulación de entrega», con la cantidad en positivo, el pedido, e` |
| R36 | e2e/anular-entrega.spec.ts:540 `el motivo vacio no envia nada y la anulacion con motivo devuelve el lote, reabre el pedido y deja la presentacion pendie` |
| R37 | guards/guard-dependencias-aprobadas.test.ts (preexistente, 2 casos) + `git diff origin/dev -- package.json pnpm-lock.yaml` vacio |

Contraste con `design.md > 10` (archivo previsto -> aparece en la fila):
- R15: el plan decía `delivery-void-dialog.test.tsx`; el caso real está en `pedidos-ui/order-deliveries-sheet.test.tsx`
  (cerrar, releer y refrescar es del sheet, no del diálogo).
- R17: el plan pedía también `order-delivery-void.int.test.ts`; ningún caso de integración lleva `R17` en el
  nombre. Lo cubren `void-delivery.test.ts` y `order-actions-delivery-void.test.ts`.
- Archivos no previstos que también mapean: `unit/pedidos/order-actions-delivery-void.test.ts` (actions),
  `integration/pedidos/order-delivery-void-repository.int.test.ts` (adaptador).
- Corregido 2026-10-13 (review vuelta 1, m4): las filas R21 y R27 ya no listan los casos de
  `unit/inventario/qc91-alcance.test.ts` (`:515` y `:606`), cuyas etiquetas `R21`/`R27` son de otra ficha. El
  censo enmendado respalda R31 (el único `update` admitido en `returnFinishedGoods`); R21 y R27 conservan sus
  casos propios.
- El resto de archivos previstos aparece en su fila.

### Censos y guardias enmendados (cada uno conserva sus aserciones previas, nota fechada 2026-10-09 o 2026-10-13)
- `tests/guards/guard-identificador-de-request.test.ts`: valor de enum, tablas, permiso y `e2e/anular-entrega.spec.ts` en `E2E_ESPERADOS`.
- `tests/guards/guard-libro-de-inventario.test.ts`: `returnFinishedGoods`, octavo camino del libro.
- `tests/unit/inventario/qc121-alcance.test.ts`: caminos de existencias siete/ocho -> nueve.
- `tests/unit/inventario/qc91-alcance.test.ts`: un `update` de `productBatch` admitido en `returnFinishedGoods`; una tercera funcion sigue en rojo.
- `tests/unit/inventario/schema/finished-product-enum-values-migration.test.ts`: `delivery_void` al final del enum.
- `tests/unit/identity/permissions.test.ts`, `tests/unit/navegacion/qc75-convenciones.test.ts`, `tests/integration/identity/identity-seed.int.test.ts`: `entregas.anular`.
- `tests/unit/identity/session-once-per-request-actions.test.ts`, `tests/unit/pedidos/order-actions.test.ts`: las dos actions nuevas.
- `tests/unit/errores/catalogo.test.ts`: `delivery_not_found` y `delivery_already_voided` (84).
- `tests/unit/pedidos/module-contract.test.ts`, `tests/unit/pedidos/schema/pedidos-schema.test.ts`, `tests/unit/asignaciones/schema/order-assignments-migration.test.ts`: tablas y adaptador nuevos.
- `tests/unit/pedidos/order-delivery-append-only.test.ts` (TC, R33): la anulacion solo inserta.
- `tests/unit/pedidos-ui/order-row-actions.test.tsx`: «Entregas» en TERMINADO.
- `tests/integration/inventario/ledger-cuadre.int.test.ts`: caso con anulacion; `tests/integration/pedidos/order-delivery-repository.int.test.ts`: linea anulada no suma; `tests/integration/clientes/customers-migration.int.test.ts` (tanda 2); `tests/integration/aislamiento.json`: tres entradas de B2/B5.

### E2E (R36)
`e2e/anular-entrega.spec.ts`, 2 casos, verde en chromium (2 passed, 56.6s) y webkit (2 passed, 32.1s);
salida completa en la seccion TI. La suite E2E entera corre en CI en el PR a produccion.

### R37
- `git diff origin/dev -- package.json pnpm-lock.yaml`: vacio (0 lineas; tambien `origin/dev...HEAD`).
- `pnpm exec vitest run tests/guards/guard-dependencias-aprobadas.test.ts`: `Test Files 1 passed (1)` / `Tests 2 passed (2)`.

### Comentarios
- Produccion (`app/`, `lib/`, `db/`): ninguna linea añadida por la rama cita `QC-`, `R<n>`, `D<n>` ni el spec (grep sobre `git diff -U0 origin/dev...HEAD`, 0 coincidencias). Sin cambios.
- Tests (`docs/conventions.md > Comentarios`: misma regla, `R<n>` solo en el nombre del caso): 39 lineas de
  comentario en 17 archivos citaban `QC-224`/`QC-219`/`QC-223`/`D12`/`R31`. Reescritas conservando la fecha y el
  motivo, sin la cita (`// QC-224 2026-10-09: X` -> `// 2026-10-09: X`). Solo comentarios: ninguna linea de codigo,
  nombre de caso, literal ni `aislamiento.json` tocado. Archivos: los 16 de la lista de censos (salvo
  `customers-migration`, `order-delivery-repository.int` y `aislamiento.json`) + `pedidos-ui/order-row-actions.test.tsx`.
- Tras la limpieza: 0 lineas de comentario añadidas por la rama en `tests/` y `e2e/` con esas citas.

### Verificacion de TZ
- `pnpm run typecheck`: exit 0.
- `pnpm exec eslint` de los 17 archivos tocados: exit 0, sin salida.
- `pnpm exec vitest run` de los 14 unit/guard tocados por backend_dev: 14 files passed, 485 passed, 3 skipped.
- `pnpm exec vitest run tests/unit/pedidos-ui/order-row-actions.test.tsx`: 1 file, 82 passed.
- `identity-seed.int.test.ts` y `ledger-cuadre.int.test.ts`: no corridos en local (sin base configurada en esta
  sesion); cambio solo de comentarios, los corre CI.
- `./init.sh` y `gate-completo`: los confirma el leader.

## Vuelta 1 del review — correcciones (implementer, 2026-10-13)

Decisiones humanas del 2026-10-13 sobre `progress/review_QC-224.md`.

### M1 — `tests/unit/clientes/scope.test.ts` rojo por el E2E (commit `27101518`)
- Desviación: `e2e/anular-entrega.spec.ts` importa `normalizeCustomerText` del barrel de `clientes` para
  sembrar el cliente que exige la entrega. `E2E_PERMITIDOS` admite `anular-entrega.spec.ts` con nota fechada
  2026-10-13 (sin citas de ficha), igual que entró `entregar-producto-terminado.spec.ts`. La lista sigue cerrada.
- Anotada en `design.md > 8` (fila nueva) y en `tasks.md > ## Archivos esperados`.
- `pnpm exec vitest run tests/unit/clientes/scope.test.ts`: `Test Files 1 passed (1)` / `Tests 28 passed (28)`.

### m1 — timestamp compartido con `20261009120000_product_batches_production_date` (commit `ee1a68cf`)
- `20261009120000_inventory_movement_kind_delivery_void` -> **`20261009120050_inventory_movement_kind_delivery_void`**
  (`git mv`, contenido intacto). Orden relativo propio conservado: 120050 < `20261009120100_order_delivery_voids`
  < `20261009120200_delivery_void_permission`; queda detrás de la de dev (120000).
- Referencias: `guard-identificador-de-request.test.ts` (`MIGRACIONES_ESPERADAS`, reordenada por nombre),
  `design.md > 3.1`, `tasks.md` (3 líneas). `order-delivery-voids-migration.test.ts` busca por sufijo: sin cambio.
- Base `qc224_anular_entrega` (DATABASE_URL/DIRECT_URL en el entorno del comando; nunca `QuimiCloude`):
  1. `pnpm run db:rollback` -> `20261009120200_delivery_void_permission revertida` (down + fila borrada).
     Una segunda llamada volvió a elegir la misma carpeta (el script toma la última del directorio) y reaplicó
     su `down.sql` sin fila que borrar (aviso del script; el DOWN es idempotente). Sin efecto.
  2. `prisma db execute --schema db/schema.prisma --file .../20261009120100_order_delivery_voids/down.sql` y
     `DELETE FROM _prisma_migrations WHERE migration_name='20261009120100_order_delivery_voids'`: `Script executed successfully.` x2.
  3. Igual con `20261009120000_inventory_movement_kind_delivery_void/down.sql` y su fila: `Script executed successfully.` x2.
  4. `migrate status`: las tres de la anulación pendientes. Renombrado de la carpeta.
  5. `prisma migrate deploy`: aplica `20261009120050_…`, `20261009120100_…`, `20261009120200_…`;
     `All migrations have been successfully applied.`
  6. `prisma migrate status`: `Database schema is up to date!`
- `vitest run` guard-identificador-de-request, order-delivery-voids-migration, finished-product-enum-values-migration,
  order-assignments-migration: `Test Files 4 passed (4)` / `Tests 96 passed (96)`.

### m2, m3: sin cambio de código (decisión humana). m4: corregido en el mapa de TZ (arriba).

## F2.3 — merge de origin/dev, vuelta 2 (implementer, 2026-10-13)

`git fetch origin dev` (`e8c58c61..a864f26b`) y `git merge origin/dev`, sin rebase. Merge `ff6eca8c`.
Seis conflictos de contenido, todos con ambos lados conservados:
- `error-codes.ts` / `error-catalog.ts`: dev (`whatsapp_connection_not_found`, `whatsapp_connection_exists`,
  `whatsapp_phone_number_taken`) primero, y `delivery_not_found`, `delivery_already_voided` detrás.
- `tests/unit/errores/catalogo.test.ts`: conteo **recalculado a 87** (85 de dev + 2 de la anulación).
- `guard-identificador-de-request.test.ts`: `E2E_ESPERADOS` con los siete de dev y `anular-entrega.spec.ts`
  al final; `MIGRACIONES_ESPERADAS` en orden de nombre: `…120000_product_batches_production_date`,
  `…120050_inventory_movement_kind_delivery_void`, `…120100_…`, `…120200_…`, `…130000_whatsapp_connections`.
- `tests/integration/aislamiento.json`: las dos suites de la anulación y `integraciones/whatsapp-connection-prisma.int.test.ts`.
- `tests/unit/clientes/scope.test.ts`: `E2E_PERMITIDOS` = los tres previos + `movimiento.spec.ts`,
  `marca-componentes.spec.ts` (dev) + `anular-entrega.spec.ts`; las notas de ambos lados.

Efecto semántico del merge (sin conflicto textual): dev trae `tests/guards/guard-e2e-fixture-user.test.ts`,
que exige crear los usuarios de `e2e/` con `createFixtureUser`. Salía rojo en `e2e/anular-entrega.spec.ts:243`
(`prisma.user.create`). Commit `45b7eeb3`: import del helper y `createFixtureUser({...})` con los mismos
argumentos, como `entregar-producto-terminado.spec.ts`. El E2E no se ha vuelto a correr (sin E2E por memoria);
typecheck y lint del archivo, verdes.

Migración de dev aplicada a `qc224_anular_entrega`: `20261009130000_whatsapp_connections`
(`migrate deploy`: `All migrations have been successfully applied.`; `migrate status`: `Database schema is up to date!`).
`prisma generate` tras el merge (el cliente no tenía `whatsappConnection`).

Verificación:
- `pnpm exec tsc --noEmit -p .`: 0 errores.
- `eslint` de los archivos tocados y en conflicto: 0 problemas.
- `vitest run tests/guards tests/unit/clientes/scope.test.ts tests/unit/errores` + las tres pruebas de migración:
  `Test Files 74 passed (74)` / `Tests 1125 passed | 14 skipped (1139)`.

## E2E tras merge (implementer, 2026-10-13)

Corrida local de `e2e/anular-entrega.spec.ts` sobre el head `c60151df` (incluye `45b7eeb3`, `createFixtureUser`).
Base `qc224_anular_entrega` (`DATABASE_URL`/`DIRECT_URL` en el entorno del comando, sin comillas; nunca
`QuimiCloude`). `prisma migrate status`: 86 migrations found… `Database schema is up to date!`
Memoria baja: un navegador por corrida, `--workers=1`, puerto 3117 libre antes y despues de cada una.

Primer intento en chromium: 2 failed en `loginAndLand` (`page.waitForURL` timeout 60s). Causa de entorno, no
del test: el worktree no tiene `.env` y el servidor del E2E lanzaba
`SESSION_SECRET ausente o mas corto de 32 caracteres: no se emite sesion.`. Repetido con un `SESSION_SECRET`
aleatorio de un solo uso (48 bytes, base64) en el entorno del comando, junto a las dos URLs. Sin cambios en el spec.

```
pnpm exec playwright test e2e/anular-entrega.spec.ts --project=chromium --workers=1
Running 2 tests using 1 worker
  ✓  1 [chromium] › e2e\anular-entrega.spec.ts:593:7 › anular una entrega de un pedido › el motivo vacio no envia nada y la anulacion con motivo devuelve el lote, reabre el pedido y deja la presentacion pendiente (R36) (10.1s)
  ✓  2 [chromium] › e2e\anular-entrega.spec.ts:753:7 › anular una entrega de un pedido › un usuario sin permiso de anular entregas abre «Entregas» y no ve «Anular» (R36) (4.1s)
  2 passed (21.3s)

pnpm exec playwright test e2e/anular-entrega.spec.ts --project=webkit --workers=1
Running 2 tests using 1 worker
  ✓  1 [webkit] › e2e\anular-entrega.spec.ts:593:7 › anular una entrega de un pedido › el motivo vacio no envia nada y la anulacion con motivo devuelve el lote, reabre el pedido y deja la presentacion pendiente (R36) (16.1s)
  ✓  2 [webkit] › e2e\anular-entrega.spec.ts:753:7 › anular una entrega de un pedido › un usuario sin permiso de anular entregas abre «Entregas» y no ve «Anular» (R36) (5.9s)
  2 passed (27.8s)
```

Filas con prefijo tras las dos corridas (psql contra `qc224_anular_entrega`, todas las columnas de texto de todas
las tablas de `public`, `LIKE 'qc224_e2e_%'`): `TOTAL qc224_e2e_ filas: 0`.

Los numeros de linea de los casos pasan de `:592`/`:752` (TI) a `:593`/`:753` por el import de `createFixtureUser`.
La fila R36 del mapa de TZ (`e2e/anular-entrega.spec.ts:540`) no se toca aqui.

## Correcciones tras CI de `c60151df` (implementer, 2026-10-13)

### 1. Se deshace el renombre de m1 (decisión humana, 2026-10-13)
- Motivo: el deploy de preview falló; la base de preview compartida (Supabase) ya tenía aplicada
  `20261009120000_inventory_movement_kind_delivery_void` de un preview anterior del PR, y `20261009120050_…`
  rompía con `ERROR: enum label "delivery_void" already exists`.
- `git mv db/migrations/20261009120050_inventory_movement_kind_delivery_void -> 20261009120000_inventory_movement_kind_delivery_void`
  (contenido intacto). Revertidas las referencias de `ee1a68cf`: `guard-identificador-de-request.test.ts`
  (`MIGRACIONES_ESPERADAS`, la guardia compara como conjunto: el nombre compartido de timestamp es aceptado),
  `design.md > 3.1`, `tasks.md` (3 líneas). Orden: Prisma ordena por nombre completo,
  `20261009120000_inventory_…` < `20261009120000_product_batches_production_date` < `20261009120100_…` < `20261009120200_…`.
- Base `qc224_anular_entrega` (DATABASE_URL/DIRECT_URL en el entorno del comando, sin comillas; nunca `QuimiCloude`,
  ni preview ni producción). Opción elegida: actualizar la fila, sin rollback (el contenido y el checksum no cambian):
  `UPDATE _prisma_migrations SET migration_name='20261009120000_inventory_movement_kind_delivery_void' WHERE migration_name='20261009120050_inventory_movement_kind_delivery_void';`
  vía `prisma db execute` -> `Script executed successfully.`; `prisma migrate status` -> `86 migrations found` /
  `Database schema is up to date!`.
- **m1 queda como deuda aceptada** (fila 2026-10-13 en `requirements.md > Decisiones cerradas`): el timestamp
  compartido se queda porque preview ya lo aplicó.
- `vitest run tests/guards`: `Test Files 67 passed (67)` / `Tests 946 passed | 14 skipped (960)`.

### 2. Rojo de CI en `tests/unit/shared/data-table-alcance.test.ts` (40 esperados, 41 reales)
- `e2e/anular-entrega.spec.ts` referencia `data-table` (`DATA_TABLE_TESTID`, `data-table-row-<id>`). Mismo trato que
  `clientes/scope` (M1): alta en la lista cerrada (ordenada, tras `aislamiento-recetas`), titulo y mensaje de
  `cuarenta` a `cuarenta y uno`, nota fechada 2026-10-13 sin citas de ficha. Anotado en `design.md > 8` y en
  `tasks.md > ## Archivos esperados`.
- Barrido de otros censos cerrados de specs E2E en `tests/` (grep de `'<nombre>.spec.ts'`): 23 archivos. Solo
  `guard-identificador-de-request` (`E2E_ESPERADOS`), `clientes/scope` y `data-table-alcance` nombran el spec nuevo; los
  demas no lo exigen. Corrida de los 18 de `tests/unit` del barrido: `Test Files 18 passed (18)` /
  `Tests 238 passed | 69 skipped (307)`; los 5 de `tests/guards` ya estaban en la corrida de guardias (67 passed).
- `vitest run tests/unit/shared/data-table-alcance.test.ts`: `Tests 18 passed | 2 skipped (20)`.
