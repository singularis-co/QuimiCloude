# QC-282 — entrega-a-varios-clientes · bitácora de implementación (F2.1)

> Consolidada por el implementer el 2026-10-15. Debajo, las secciones de cada subagente con su
> detalle (archivos, casos por nombre y salida real de los comandos).

## Estado de las tasks

| Task | Estado | Commit |
|---|---|---|
| T0 contrato | hecha | 41772bb5 |
| B1 migración y esquema | hecha | cf5e8fe3 |
| B2 inventario por lote | hecha | 72d38532 |
| B3 entrega con varios clientes | hecha | 1feabc34 |
| B4 anulación y lecturas | hecha | 4491635f |
| F1 sheet «Entregar» | hecha (comprobación visual en 1440/820/390 px) | 1cf6d8a4 |
| F2 lista y diálogo | hecha | f5c74f57 |
| F3 Checkbox indeterminado | hecha (+ arreglo de regresión de clases por defecto 76610e49) | 3b387ce6 |
| F4 tab Entregas | hecha | 9697f8cf |
| TC censos | **abierta**: 2 rojos en `tests/unit/clientes/scope.test.ts` (R38/R40) pendientes de decisión; test de R20 «del barrel» sin escribir | 7e095e04, fff684f9 |
| TI E2E | **abierta**: specs escritos y con typecheck; la corrida local no llegó a probar nada (disco C: lleno → Postgres en recuperación) | 1081a9d0 |
| TZ cierre | pendiente | — |

## T0 (backend_dev)
- Producción: `pedidos/domain/order-delivery.ts` (`DeliveryCustomerBlock`, `DeliveryBlockIssue`,
  `checkDeliveryBlocks`, `flattenBlocks`, `packagesLeftInBatch`), puertos de entrega y anulación,
  `deliver-order.ts`, `void-delivery.ts`, `list-order-deliveries.ts`, `order-actions.ts`,
  `inventario/domain/finished-product-detail.ts`, barrels de `pedidos` e `inventario`.
- Fixtures: `tests/fixtures/order-delivery.ts`, `order-delivery-void.ts`, `finished-product-detail.ts`.
- Test: `tests/unit/pedidos/order-delivery.test.ts` (15 casos nuevos: R13–R18, R20).

## B1 (backend_dev)
- Migración `db/migrations/20261015130000_order_delivery_lines_customer/` (`migration.sql`,
  `down.sql`), `db/schema.prisma`, `order-delivery-prisma.ts`, `tests/helpers/order-delivery-seed.ts`.
- Diferencia con el SQL de design §1.1: UP y DOWN hacen `NO FORCE`/`FORCE` de RLS alrededor de la
  copia de datos, como las demás migraciones de datos del repo.
- Comprobaciones previas hechas contra la plantilla de test `qct_tpl_4a9ce03acc6c`.
- Tests: `order-delivery-lines-customer-migration.int.test.ts` (R31, R32: up con anulaciones, up
  abortado sin líneas, down con un cliente y reaplicación, down abortado con dos clientes y sin
  líneas), `tests/unit/pedidos/schema/order-delivery-lines-customer-migration.test.ts` (R30–R32,
  texto del SQL), `order-delivery-constraints.int.test.ts` (R30), `order-delivery-repository.int.test.ts` (R30).
- Salida: los 3 int de B1 32/32 en verde; guardias 76 archivos, 1066 passed, 20 skipped.

## Mapa R<n> → test (resumen; el detalle por caso está en cada sección)

| R | Test(s) |
|---|---|
| R1 | `tests/unit/identity/permissions.test.ts` (sin cambios, verde; TC) |
| R2 | `tests/unit/pedidos/deliver-order.test.ts` |
| R3 | `tests/unit/pedidos/void-delivery.test.ts` |
| R4–R9 | `tests/unit/pedidos-ui/order-delivery-sheet.test.tsx` (+ R4, R5, R8, R9 en `order-delivery-draft.test.ts`) |
| R10 | `order-delivery-sheet.test.tsx` (purpose `deliver`) |
| R11, R12 | `order-delivery-sheet.test.tsx`, `order-delivery-summary.test.tsx` |
| R13–R18 | `tests/unit/pedidos/order-delivery.test.ts`, `order-delivery-sheet.test.tsx` |
| R19 | `order-delivery-sheet.test.tsx` (envío igual a `deliverInput()`) |
| R20 | `tests/unit/pedidos/order-delivery.test.ts`: funciones puras + «QC-282 R20: $ruta importa $nombres de $desde» (sheet: las tres del barrel; `deliver-order.ts`: dos de `./order-delivery`, design §12 enmendado 2026-10-15) + caso sintético del detector |
| R21–R29 | `tests/unit/pedidos/deliver-order.test.ts`, `tests/integration/pedidos/order-delivery.int.test.ts`, `order-delivery-concurrency.int.test.ts`; R24, R26 también en `tests/unit/inventario/finished-goods-dispatch-prisma.test.ts`, `tests/integration/inventario/finished-goods-dispatch.int.test.ts`, `ledger-cuadre.int.test.ts` |
| R30 | `order-delivery-constraints.int.test.ts`, `order-delivery-repository.int.test.ts`, unit del SQL, `pedidos-schema.test.ts` |
| R31, R32 | `tests/integration/pedidos/order-delivery-lines-customer-migration.int.test.ts`, `tests/unit/pedidos/schema/order-delivery-lines-customer-migration.test.ts` |
| R33, R34 | `tests/unit/pedidos/list-order-deliveries.test.ts`, `order-delivery-void-repository.int.test.ts`, `order-delivery-void.int.test.ts`, `tests/unit/pedidos-ui/order-delivery-list.test.tsx` |
| R35 | `order-delivery-list.test.tsx`, `order-deliveries-sheet.test.tsx` |
| R36–R38 | `tests/unit/pedidos-ui/delivery-void-dialog.test.tsx` (+ R37 en `tests/unit/shared-ui/checkbox-indeterminate.test.tsx`) |
| R39–R41 | `void-delivery.test.ts`, `order-delivery-void.int.test.ts` |
| R42 | `order-delivery-void.int.test.ts`, `finished-goods-return-prisma.test.ts`, `finished-goods-return.int.test.ts`, `ledger-cuadre.int.test.ts` |
| R43, R44 | `tests/unit/inventario/list-finished-product-deliveries.test.ts`, `order-delivery-directory.int.test.ts`, `finished-product-detail.int.test.ts`, `tests/unit/inventario-ui/finished-product-tables.test.tsx` |
| R45, R46 | `tests/unit/pedidos-ui/order-delivery-draft.test.ts`, `order-delivery-sheet.test.tsx` |
| R47 | `e2e/entrega-a-varios-clientes.spec.ts` (escrito; **sin corrida en verde**) |
| R48 | sin cambios en dependencias; `guard-dependencias-aprobadas` verde (TC) |

## Preguntas abiertas para el leader / humano
1. **[RESUELTA 2026-10-15: se afinan los detectores; ver «backend_dev — cierre TC». Queda un rojo NUEVO por `'Clientes'`, pregunta 7]** **`tests/unit/clientes/scope.test.ts`, 2 rojos (detectores R38 de QC-154 y R40 de QC-156).** El
   campo `customers` del contrato de design §2 dispara el detector de la palabra `customers` en
   `app/(private)/pedidos/components/{delivery-void-dialog,order-delivery-list,order-delivery-sheet}.tsx`
   y en `lib/modules/pedidos/{domain/deliver-order,domain/list-order-deliveries,adapters/driving/order-actions}.ts`.
   design §9 no lo prevé. Salidas: (A) afinar los detectores para que no cuenten un nombre de
   propiedad (solo `scope.test.ts`, con casos sintéticos); (B) renombrar el campo del contrato
   (p. ej. `customerBlocks`), enmendando design §2.4/§2.5/§7.1 y ~6 archivos + tests + e2e.
2. **[RESUELTA 2026-10-15: caso «QC-282 R20» y design §12 enmendado]** **Test de R20 de design §12** («deliver-order.ts y el sheet importan del barrel»): importar el
   barrel desde `deliver-order.ts` crea un ciclo; el caso R16 de QC-223 (decisión del 2026-10-08)
   exige `./order-delivery`; y `deliver-order.ts` no usa `packagesLeftInBatch` (el tope por lote lo
   aplica inventario con el lote bloqueado). Propuesta: el sheet importa las tres del barrel y
   `deliver-order.ts` dos de `./order-delivery`, ampliando el caso R16 existente.
3. **Descripción del panel del sheet**: el tablero dice «Reparte la entrega entre uno o más
   clientes…», pero QC-262 R20 (vigente, no enmendado) fija «Elige el cliente y, por presentación,
   de qué lotes salen los envases.». Se dejó la de QC-262.
4. **B4 añadió `lot` a `FinishedProductRecord.batches`** (puerto y `findAliveFinishedProduct`): el
   diseño saca el lote de `record.batches`, pero ese tipo no traía el código. Ajuste con nota en
   `get-finished-product.test.ts`.
5. **E2E sin corrida verde**: la base de desarrollo compartida va una migración atrás y no se migró
   (rompería otros worktrees). Se corrió contra una copia de la plantilla de test; el disco C: lleno
   tumbó Postgres. Hace falta liberar disco y repetir contra una copia de la plantilla.
6. **`./init.sh` se corta en el paso 3** por el cupo fullstack (5 de 3), la excepción ya aceptada. El
   gate no tiene forma de saltarlo, así que los pasos siguientes se corrieron a mano (ver Tandas en
   la ficha).
7. **[RESUELTA 2026-10-15: decisión humana opción A; ver P7 al final de «backend_dev — cierre TC»]** **(nueva, 2026-10-15) `scope.test.ts` R38 sigue rojo por `order-delivery-list.tsx`**, ya no por
   `customers` sino por el literal `'Clientes'` (`const CUSTOMERS_LABEL = 'Clientes'`, etiqueta de la
   tarjeta «Fecha · Clientes · Envases · Entregó» de design §7.2). El marcador `['"]Clientes['"]` de R38
   (pensado para la entrada de menú de QC-155) lo caza; antes quedaba tapado por `customers`. La
   decisión del humano solo cubría `customers`, así que no lo toqué. Salidas: (A) afinar también
   ese marcador (p. ej. solo en `private-nav`/títulos, o excluir etiquetas de `pedidos`); (B) cambiar
   la etiqueta en producción (p. ej. sacarla de un literal compartido); (C) excepción nombrada para
   ese archivo en R38.

## frontend_dev — F3 y F4

**F3 — Checkbox indeterminado**
- `components/ui/checkbox.tsx` (prop `indeterminate`, guion `MinusIcon`, relleno en `data-indeterminate`)
- `components/shared/CATALOGO.md` (fila de `Checkbox`: alcance, punto de extensión, tablero)
- `tests/unit/shared-ui/checkbox-indeterminate.test.tsx` (nuevo)

**F4 — Tab Entregas con «Presentación»**
- `app/(private)/inventario/producto-terminado/[id]/components/finished-product-deliveries-table.tsx`
- `tests/unit/inventario-ui/finished-product-tables.test.tsx`

**R → test**
- R37 (base) → checkbox-indeterminate.test.tsx (4 casos «R37 — …»)
- R43 → finished-product-tables.test.tsx «R43 — columnas en orden…», «R43 — una fila por linea de entrega…»
- R44 → finished-product-tables.test.tsx «R44 — solo la fila de la presentacion anulada…», «R44 — el total viene de delivered y la paginacion…»

**Salida**
- `pnpm run typecheck` → exit 0
- `pnpm run lint` → 0 errors, 7 warnings (preexistentes, ajenos)
- vitest de mis tests + 11 tests que usan Checkbox → 13 archivos, 347 passed, 8 failed; los 8 en
  `tests/unit/pedidos-ui/delivery-void-dialog.test.tsx` fallan igual con el `checkbox.tsx` de HEAD
  (no los causa F3; es el diálogo de anular, F2)
- `pnpm exec vitest run guard` → 75/76 archivos, 1065 passed, 1 failed:
  `guard-identificador-de-request` «db/ no gana ni una migracion…» (cambio de `db/` del backend_dev)

**Veredicto:** F3 y F4 hechos y en verde en sus tests; rojos ajenos anotados.

## frontend_dev — F2

**Archivos**
- `app/(private)/pedidos/components/order-delivery-list.tsx`: tarjeta con Fecha · Clientes · Envases ·
  Entregó y un `section` por cliente (`order-delivery-entry-customer`, `aria-label` = nombre,
  `data-customer-id`); «Anulada» por presentación dentro del subbloque. El testid
  `order-delivery-entry-customer` pasa del `dd` de nombres a la sección; nuevos
  `order-delivery-entry-customers` (número) y `order-delivery-entry-packages` (total).
- `app/(private)/pedidos/components/delivery-void-dialog.tsx`: abre sin nada marcado; un `fieldset`
  por cliente con pares sin anular (sin clientes vacíos), casilla de grupo
  (`delivery-void-group-toggle`, `checked` = todos, `indeterminate` = algunos) y casillas por par con
  `data-customer-id`; nombres accesibles del tablero («Anular todo lo de X», «P de X · N envases»).
- `app/(private)/pedidos/components/index.ts`: solo exporta los testids nuevos
  (`ORDER_DELIVERY_ENTRY_CUSTOMER_TESTID`, `DELIVERY_VOID_GROUP_TESTID`, `DELIVERY_VOID_GROUP_TOGGLE_TESTID`).
- `order-deliveries-sheet.tsx`: sin cambios (el tipo ya cuadraba tras T0).
- Tests: `tests/unit/pedidos-ui/order-delivery-list.test.tsx`, `delivery-void-dialog.test.tsx`,
  `order-deliveries-sheet.test.tsx` (enmiendas con nota 2026-10-15).

**R → test**
- R33 → order-delivery-list.test.tsx «R33: pinta cada entrega… fecha, numero de clientes, total de
  envases y autor», «R33: … un subbloque por cliente…», «R33: por presentacion de cada cliente…»,
  «R33: … aunque el cliente este dado de baja»
- R34 → order-delivery-list.test.tsx «R34: el par anulado queda marcado «Anulada»…», «R34: la misma
  presentacion en el subbloque de otro cliente no sale anulada…», «R34: un par sin anular no lleva la marca»
- R35 → order-delivery-list.test.tsx «R35: con canVoid y el pedido %s…», «R35: sin canVoid…», «R35: una
  entrega con todos sus pares anulados…», «R35: con todo lo de un cliente anulado… sigue ofreciendo»,
  «R35: con el pedido %s no ofrece…»
- R36 → delivery-void-dialog.test.tsx «R36: lista por cliente solo los pares sin anular, todos sin
  marcar…», «R36: no lista a un cliente al que no le queda ningun par…»; order-deliveries-sheet.test.tsx
  «R36: «Anular» abre el dialogo con los pares sin anular… sin marcar»
- R37 → delivery-void-dialog.test.tsx «R37: la casilla de grupo sale sin marcar, a medias… y marcada…»,
  «R37: pulsar la casilla de grupo a medias o sin marcar marca todos…, y con todos marcados los desmarca»
- R38 → delivery-void-dialog.test.tsx «R38: envia la entrega, la clave, el motivo y solo los pares
  marcados…», «R38: con un solo par marcado envia solo ese…»

**Salida (2026-10-15)**
- `pnpm exec vitest run` de los tres tests → 3 archivos, 54 passed (antes 8 + 1 + 2 rojos)
- `pnpm exec vitest related --run` order-delivery-list/delivery-void-dialog/order-deliveries-sheet →
  67 archivos, 1443 passed
- `pnpm exec vitest run guard` → 76 archivos, 1066 passed, 20 skipped
- `pnpm run typecheck` → exit 2, 29 errores, ninguno mío: `lib/.../order-delivery-void-prisma.ts` (7),
  `order-delivery-directory-prisma.ts` (3), `e2e/anular-entrega.spec.ts` (5),
  `e2e/entregar-producto-terminado.spec.ts` (5), `tests/integration/**` (9) — schema a medias del
  backend_dev y E2E de TI
- `pnpm run lint` → 1 error ajeno (`order-delivery-sheet.tsx:265` `react-hooks/set-state-in-effect`,
  F1), 7 warnings preexistentes; `eslint` sobre mis 7 archivos → exit 0
- Pendiente de TI: `e2e/anular-entrega.spec.ts` asume el diálogo con todo marcado.

**Veredicto:** F2 hecho; sus tres tests y las guardias en verde; rojos de typecheck y lint ajenos.

## frontend_dev — F1 (sheet «Entregar» con bloques y borrador v2)

**Archivos**
- `app/(private)/pedidos/components/order-delivery-sheet.tsx` (bloques, resumen, topes, envío `customers`)
- `app/(private)/pedidos/components/order-delivery-customer-block.tsx` (nuevo, paso 3: compone `OrderCustomerPicker purpose="deliver"`, `Button`, `FieldError`, `Input`)
- `app/(private)/pedidos/components/order-delivery-summary.tsx` (nuevo, paso 3: `StatusBadge`)
- `app/(private)/pedidos/components/order-delivery-draft.ts` (v2 con bloques; lee v1 como un bloque)
- `app/(private)/pedidos/components/use-order-delivery-draft.ts` (estado + `addBlock`/`removeBlock`/`setCustomer`/`setPackages`, guarda en cada cambio)
- `app/(private)/pedidos/components/index.ts` (barrel)
- `tests/unit/pedidos-ui/order-delivery-sheet.test.tsx`, `order-delivery-summary.test.tsx` (nuevo), `order-delivery-draft.test.ts`

**R → test**
- R4, R5, R6, R7, R10 → order-delivery-sheet «lectura»
- R8, R9 → order-delivery-sheet «bloques por cliente»; order-delivery-draft «cambios de los bloques»
- R11, R12 → order-delivery-summary.test.tsx + order-delivery-sheet («R11: el resumen…», «R12: …no envia»)
- R13, R14, R15, R16, R17, R18, R19 → order-delivery-sheet «topes y validacion»
- R45, R46 → order-delivery-draft.test.ts (v2, lectura de v1, ajuste) + order-delivery-sheet «borrador»

**Salida**
- `pnpm run typecheck` → 0 errores en archivos de F1; 25 en archivos ajenos (backend en curso: `order-delivery-void-prisma.ts`, `order-delivery-directory-prisma.ts`, `.int` de inventario/pedidos, e2e de QC-223/224)
- `pnpm run lint` → 0 errors, 7 warnings (preexistentes, ajenos)
- `pnpm exec vitest run` de los tres tests → 3 files, 67 passed
- `pnpm exec vitest related --run <6 archivos de producción>` → 67 files, 1443 passed
- `pnpm exec vitest run guard` → 76 files, 1066 passed, 20 skipped
- Visual: Playwright Chromium contra el dev server del worktree (spec temporal, borrado) a 1440, 820 y 390 px; corregido un desborde de la columna «Entrada» con códigos de lote largos.

**Veredicto:** F1 hecha; pendiente TI para los E2E que usaban los test ids retirados.

## backend_dev — B2 (inventario: salida y devolución agregadas por lote)

**Archivos**
- `lib/modules/inventario/adapters/driven/persistence/product-prisma.ts`: `dispatchFinishedGoods`
  suma envases por lote (un decremento condicional, un asiento `delivery` con la suma, `insufficient`
  con los envases enteros del lote) y devuelve una línea por asignación en el orden de entrada;
  `returnFinishedGoods` suma cantidades por lote (`addQuantities`) con un incremento y un asiento
  `delivery_void` por lote.
- `lib/modules/inventario/domain/finished-goods-dispatch.ts`, `finished-goods-return.ts`: solo JSDoc.
- Tests (enmiendas con nota 2026-10-15, aserciones previas intactas):
  `tests/unit/inventario/finished-goods-dispatch-prisma.test.ts`,
  `tests/unit/inventario/finished-goods-return-prisma.test.ts`,
  `tests/integration/inventario/finished-goods-dispatch.int.test.ts`,
  `tests/integration/inventario/finished-goods-return.int.test.ts`,
  `tests/integration/inventario/ledger-cuadre.int.test.ts` (fixtures sin `orderDelivery.customerId`
  + caso nuevo de dos clientes en un lote).

**R → test**
- R24 → dispatch-prisma «R24: si la suma de un lote repetido no cabe, insufficient…»;
  dispatch.int «R24: si la suma de un lote repetido supera su existencia…»
- R26 → dispatch-prisma «R26: un decremento y un asiento por lote con la suma…»; dispatch.int
  «R26: un lote repetido entre dos asignaciones da un decremento…»; ledger-cuadre «R26, R42: con dos
  clientes en un lote…»
- R42 → return-prisma «R42: un incremento y un asiento delivery_void por lote con la suma…»;
  return.int «R42: un lote repetido entre lineas de dos clientes…»; ledger-cuadre «R26, R42: …»

**Salida (2026-10-15)**
- `pnpm exec vitest run` de los 5 tests → 5 archivos, 43 passed
- `pnpm exec vitest run guard` → 76 archivos, 1066 passed, 20 skipped
- `pnpm run typecheck` → errores solo ajenos: `order-delivery-void-prisma.ts` (7),
  `order-delivery-directory-prisma.ts` (3), `e2e/anular-entrega.spec.ts` (5),
  `e2e/entregar-producto-terminado.spec.ts` (5), `finished-product-detail.int` (3),
  `order-delivery-directory.int` (2) — B4 / TI; ninguno en archivos de B2
- `pnpm run lint` → 0 errores, 19 warnings, ninguno en archivos de B2
- `pnpm exec vitest related --run` (product-prisma + 2 de dominio) → 595 archivos: 588 passed,
  7 failed (34 tests): `pedidos/order-delivery.int`, `order-delivery-concurrency.int` (B3),
  `order-delivery-void.int`, `order-delivery-void-concurrency.int` (B4), `pedidos/module-contract`
  y `pedidos/order-delivery.test` R16 (`deliver-order.ts`, B3), `paridad/asignacion-acondicionamiento-
  paridad` (snapshot del `Checkbox` tras 3b387ce6, fuera de B2)

**Veredicto:** B2 hecho; sus 5 tests y las guardias en verde; rojos restantes de B3/B4 y del snapshot del Checkbox.

## backend_dev — B3 (entrega con varios clientes)

**Archivos**
- `lib/modules/pedidos/domain/deliver-order.ts`: cuerpo recuperado de `41772bb5^` con la entrada
  `customers` (§2.4): permiso → `safeParse` + `checkDeliveryBlocks` → `findByKey` (already_registered)
  → `requireAliveCustomer` por cliente en orden → `assertTransition` → transacción. Dentro: líneas de
  todos los clientes contra el reparto (`flattenBlocks`), `create` sin cliente, `checkDelivery` sobre
  la suma, un `dispatchForDelivery` por línea del reparto con las asignaciones de todos los clientes
  (cliente → asignación) y `addLines` con el `customerId` y la `quantity` de la misma posición. Si
  inventario no devuelve una línea por asignación, lanza (se deshace todo).
- `tests/unit/pedidos/deliver-order.test.ts`: casos QC-223 pasados a un cliente (`entradaDeUnCliente`,
  nota 2026-10-15; `create` sin cliente y líneas con `customerId`); bloque nuevo `QC-282`.
- `tests/integration/pedidos/order-delivery.int.test.ts`: entradas QC-223 a `customers` (nota
  2026-10-15; el cliente de la entrega se mira en sus líneas con `clientesDeEntrega`); bloque `QC-282`.
- `tests/integration/pedidos/order-delivery-concurrency.int.test.ts`: entradas a `customers` (nota) +
  caso de dos clientes sobre el mismo lote.

**R → test** (prefijo `QC-282` en el nombre)
- R2 → u «R2: sin entregas.modificar una entrega con varios clientes es unauthorized…»
- R21 → u «R21: <12 formas> es invalid_input…», «exactamente 200 asignaciones…», «la misma presentacion y
  lote en dos clientes distintos es valido», «una linea del reparto que no es del pedido en el segundo
  cliente…»; int «R21: el mismo cliente dos veces, un cliente sin envases, una linea de otro pedido o la
  forma de QC-223…»
- R22 → u «R22: si el segundo cliente no vuelve del catalogo…», «si falla el primer cliente…», «un
  segundo cliente sin forma de uuid…»; int «R22: un segundo cliente de la empresa B, dado de baja o sin
  forma de uuid…»
- R23 → u «R23: dos clientes que por separado caben…», «la suma igual a lo que falta se acepta»; int
  «R23: dos clientes que por separado caben…»
- R24 → u «R24: insufficient en el lote compartido…»; int «R24: dos clientes que juntos superan los
  envases de un lote…»; concurrency «R24: dos pedidos que reparten a la vez entre dos clientes el mismo
  lote…»
- R25 → u «R25: crea una sola entrega sin cliente propio…», «cada linea guarda la cantidad…», «si
  inventario no devuelve una linea por asignacion…»; int «R25, R26: guarda una sola entrega sin
  cliente propio…»
- R26 → int «R25, R26: …un asiento por lote con la suma…» (además los de B2)
- R27 → u «R27: si la suma de los clientes completa…», «si a una presentacion le siguen faltando…»; int
  ídem
- R28 → u «R28: una entrega con varios clientes cuya clave ya esta registrada…», «si otra peticion
  inserta la misma clave antes del INSERT…»; int «R28: la misma clave dos veces con varios clientes…»
- R29 → u «R29: si la segunda presentacion falla en inventario…»; int «R29: si falla el lote del segundo
  cliente despues de despachar lo del primero…»

**Salida (2026-10-15)**
- `pnpm exec vitest run` deliver-order.test, order-delivery.int, order-delivery-concurrency.int,
  module-contract.test, order-delivery.test → 5 archivos, 148 passed (module-contract y el R16 de
  QC-223 vuelven a verde)
- `pnpm exec vitest run guard` → 76 archivos: 75 passed, 1 failed (1065 passed, 1 failed, 20 skipped):
  `guard-ambito-empresa-pedidos` sobre `order-delivery-directory-prisma.ts` (B4, en curso)
- `pnpm run typecheck` → 17 errores, ninguno en archivos de B3: `e2e/anular-entrega.spec.ts` (5),
  `e2e/entregar-producto-terminado.spec.ts` (5), `finished-product-detail.int` (4),
  `order-delivery-directory.int` (3)
- `pnpm run lint` → 0 errores, 7 warnings (ajenos)

**Abierto (no resuelto, para el leader/humano)**
- R20: `design.md > 12` pide un test que exija que `deliver-order.ts` y el sheet importen
  `checkDelivery`, `checkDeliveryBlocks` y `packagesLeftInBatch` «del barrel». Desde dentro del
  módulo eso crea un ciclo (`index.ts` → `deliver-order.ts` → `index.ts`) y el caso R16 de QC-223 ya
  acepta `./order-delivery`. `deliver-order.ts` importa de `./order-delivery`; el test de R20 del barrel
  no se ha escrito. Además `deliver-order.ts` no usa `packagesLeftInBatch` (el tope por lote lo aplica
  inventario con el lote bloqueado), así que esa parte del test tampoco se cumpliría.

**Veredicto:** B3 hecho; sus tests en verde; rojos restantes de B4 y E2E/TI, y R20 abierto.

## backend_dev — B4 (Anulación y lecturas)

**Archivos (producción)**
- `lib/modules/pedidos/domain/void-delivery.ts`: lógica restaurada de QC-224 con `items` (pares
  cliente-presentación); `linesToVoid` filtra por par; par sin líneas → `ValidationError`; línea del
  par ya anulada → `DeliveryAlreadyVoidedError`.
- `lib/modules/pedidos/domain/list-order-deliveries.ts`: agrupa por cliente (nombre asc, empate por
  `customerId`) y dentro por línea del reparto; `packages` de la entrega suma todas sus líneas.
- `lib/modules/pedidos/adapters/driven/persistence/order-delivery-void-prisma.ts`: `customerId` desde
  cada línea en `findDeliveryLines` y `listByOrder` (orden: presentación, cliente, lote).
- `lib/modules/pedidos/adapters/driven/persistence/order-delivery-directory-prisma.ts`:
  `listDeliveryLinesByBatchIds` (findMany + count sobre `order_delivery_lines`, orden entrega
  `createdAt` desc e `id` desc, defecto 10 / tope 25); se quita `findDeliveryDetailsByIds`.
- `lib/modules/inventario/domain/list-finished-product-deliveries.ts`: pagina con `listDeliveryLines`;
  lote de `record.batches`, presentación de `record.presentation?.name`.
- `lib/modules/inventario/ports/finished-product-detail-repository.ts` y
  `.../finished-product-detail-prisma.ts`: se quitan `listDeliveryMovements` y su tipo;
  `FinishedProductRecord.batches[]` gana `lot` (el diseño saca el lote de `record.batches`, que no lo traía).
- `lib/composition/index.ts`: se quita `listDeliveryMovements` del repositorio.

**Archivos (tests)**: `tests/unit/pedidos/void-delivery.test.ts`, `list-order-deliveries.test.ts`,
`tests/unit/inventario/list-finished-product-deliveries.test.ts`; ajustes mínimos con nota en
`get-finished-product`, `list-finished-product-batches`, `-costs`, `-movements`, `list-produced-products`
(`.test.ts`); `tests/integration/pedidos/order-delivery-void.int`, `-void-repository.int`,
`-void-concurrency.int`, `order-delivery-directory.int`; `tests/integration/inventario/finished-product-detail.int`.

**R → test**
- R3 → u void-delivery «R3: sin entregas.anular, la forma nueva y la vieja responden unauthorized…»
- R33 → u list-order-deliveries «R33: cada entrega trae su total de envases…», «R33: los clientes van
  por nombre ascendente…», «R33: el nombre de un cliente dado de baja…»; int void-repository «R33, R34:
  listByOrder trae el cliente de cada linea…»; int void «R41, R34: …» (lista con dos clientes)
- R34 → u list-order-deliveries «R34: la presentacion anulada de un cliente no sale anulada en el
  subbloque de otro»; int void-repository «R33, R34: …»; int void «R41, R34: …»
- R39 → u void-delivery «R39: ningun par / un par repetido / sin cliente / cliente sin uuid / campo de
  mas / forma vieja / mas pares que el tope…», «R39: un par cuya presentacion es de la entrega pero no de
  ese cliente…», «R39: un cliente que no esta en la entrega…»; int void «R39: un par repetido, un par
  cuya presentacion no lleva ese cliente o un cliente ajeno…»
- R40 → u «R40: un par ya anulado responde delivery_already_voided…», «R40: la presentacion anulada de un
  cliente no impide…»; int void «R40: un par ya anulado es delivery_already_voided…»
- R41 → u «R41: anula todas las lineas del par…», «R41: con dos clientes en el mismo lote…»; int void
  «R41, R34: …»; int void-repository «R39, R41: findDeliveryLines trae el cliente de cada linea…»
- R42 → int void «R42: dos clientes del mismo lote en una anulacion dan un solo asiento por lote…»
  (además `finished-goods-return.int` de B2)
- R43 → u list-finished-product-deliveries «R19, R43: cada linea de entrega sale con…», «R43: con la
  presentacion del producto ausente…», «R43: dos clientes del mismo lote…»; int directory «R19, R43: una
  fila por linea…», «R43, R44: dos clientes del mismo lote…»; int finished-product-detail «R19, R43, R44:
  una fila por linea de entrega…» (fachada con cableado real)
- R44 → u «R33, R44: el void de la linea…», «R44: solo sale Anulada la fila de un par anulado…», «R44: la
  paginacion y el orden son los del directorio…», «R34, R44: summarizeDelivered…»; int directory «R44: las
  anuladas tambien salen, en orden…», «R44: pagina sobre las filas…», «R44: tope 25», «R34, R44: con dos
  clientes en un lote solo suma…»

**Salida (2026-10-15)**
- `pnpm exec vitest run` 8 unit (void-delivery, list-order-deliveries, 6 de inventario) + 4 UI
  (order-delivery-list, delivery-void-dialog, order-deliveries-sheet, finished-product-tables) → 12
  archivos, 221 passed
- `pnpm exec vitest run` 5 int (void, void-repository, void-concurrency, directory,
  finished-product-detail) → 5 archivos, 62 passed (void-concurrency vuelve a verde)
- `pnpm exec vitest run tests/unit/inventario` → 122 archivos, 1858 passed, 5 skipped
- `pnpm exec vitest run guard` → 76 archivos passed (1066 passed, 20 skipped)
- `pnpm run typecheck` → 10 errores, todos en `e2e/anular-entrega.spec.ts` (5) y
  `e2e/entregar-producto-terminado.spec.ts` (5), de TI
- `pnpm run lint` → 0 errores, 7 warnings (ajenos)

**Veredicto:** B4 hecho; R3, R33, R34, R39–R44 con test y en verde; quedan solo los errores de tipo de e2e (TI).

## backend_dev — TC (2026-10-15)

**Archivos modificados**
- `tests/unit/pedidos/order-delivery-append-only.test.ts`: solo una nota fechada en la cabecera; las aserciones no cambian.

**design §9, fila a fila**
- `guard-identificador-de-request` `MIGRACIONES_ESPERADAS`: verificada; ya tiene `20261015130000_order_delivery_lines_customer` con su nota (B1). `E2E_ESPERADOS` es de TI y no lo toqué.
- `clientes/scope.test.ts:540` (migraciones que tocan `customers`): verificada; tiene la migración y su nota (B1) y está en verde.
- `pedidos/schema/pedidos-schema.test.ts` (referencias sin `@relation`): verificada; está en verde.
- `order-delivery-append-only.test.ts`: verificada. `CARPETAS = ['lib','app']`, así que no recorre `db/migrations`, donde está el `UPDATE "order_delivery_lines"` (migration.sql:30). Le añadí la nota fechada.
- `order-delivery-constraints.int.test.ts` (unicidad entrega+cliente+lote, R30): verificada; notas en las líneas 298 y 441 y en verde.
- `ledger-cuadre.int.test.ts` (caso de dos clientes en un lote, línea 525): verificada y en verde.
- `tests/helpers/order-delivery-seed.ts` (`customer_id` en las líneas): verificada; nota en la línea 243.
- `aislamiento.json`: verificada. La única suite `.int` nueva, `order-delivery-lines-customer-migration`, está registrada; B3 no creó ninguna suite nueva, solo modificó.
- `e2e/*` (3 specs): fila de TI, no la toqué. Esos specs dan 10 errores de tipo (`customerId`/`lines` en la entrega).
- `components/shared/CATALOGO.md` `Checkbox` `indeterminate`: verificada en la línea 26.
- `lib/composition/index.ts` `listDeliveryLines`: verificada en la línea 1021.
- Fixtures (`order-delivery.ts`, `order-delivery-void.ts`, `finished-product-detail.ts`): typecheck no da errores fuera de `e2e/`.
- Los puntos «sin cambio» (permisos, `InventoryMovementKind`, `guard-libro-de-inventario` y `guard-pantallas-exigen-permiso`) se confirman: el enum no aparece en el diff y las guardias están en verde.

**R1 / R48**
- La base de la rama es `8ffb1b3f`, merge-base con `origin/dev`, la rama de integración según `arnes.config.json`. El `master` local es el commit inicial de create-next-app y no sirve para comparar.
- Ni `tests/unit/identity/permissions.test.ts` ni `lib/modules/identity` tienen diff contra esa base ni contra `origin/dev`. `package.json`, `pnpm-lock.yaml` y `docs/dependencias.md` tampoco tienen diff, así que no entró ninguna dependencia.
- En verde: `permissions.test`, `guard-permisos-sembrados`, `guard-dependencias-aprobadas`.

**Rojos pendientes de decisión (no los resolví)**
1. `tests/unit/clientes/scope.test.ts` tiene 2 rojos, causados por el campo `customers` del contrato de design §2:
   - R38 (QC-154, `\bcustomers\b` bajo app/) dispara exactamente en `app/(private)/pedidos/components/delivery-void-dialog.tsx:86`, `order-delivery-list.tsx` (líneas 10, 56, 100 y 120) y `order-delivery-sheet.tsx:213`.
   - R40 (pedidos nombra la tabla `customers`) dispara exactamente en `lib/modules/pedidos/domain/deliver-order.ts`, `domain/list-order-deliveries.ts` y `adapters/driving/order-actions.ts:566`. No hay más.
   - Salida A, afinar los detectores. Por ejemplo, ignorar `customers` cuando es nombre de propiedad: `.customers`, `customers:`, `{ customers }` o `['customers']`. También vale limitar la «tabla» a contextos SQL o Prisma, como una cadena entre comillas dobles o `prisma.customer`. Cambia solo `scope.test.ts`, con una nota fechada y casos sintéticos. El riesgo es debilitar la guardia de QC-154/156; cada nueva excepción debe ir con un caso que siga en rojo, por ejemplo `"customers"` en SQL crudo.
   - Salida B, renombrar el campo del contrato, por ejemplo a `blocks` (como `checkDeliveryBlocks(blocks)`) o `customerBlocks`. Exige enmendar design §2.4, §2.5 y §7.1 con aprobación humana. Afecta a deliver-order, list-order-deliveries, order-actions, el sheet, la lista y el diálogo, y además a unos 10 tests unit, ui e int de pedidos/inventario, los fixtures y los specs e2e de TI. Hay que mirar si `\bcustomerBlocks\b` deja de disparar (sí deja, por el `\b`). El rango de cambios es mayor, pero los detectores siguen tal como están.
2. design §12 pide para R20 un test que exija importar `checkDelivery`, `checkDeliveryBlocks` y `packagesLeftInBatch` «del barrel» en el sheet y en `deliver-order.ts`. No se puede tal cual:
   - `deliver-order.ts` importa de `./order-delivery`, porque el barrel reexporta `createDeliverOrder` e importarlo crearía un ciclo.
   - El caso R16 de QC-223 (`order-delivery.test.ts:278`, decisión humana del 2026-10-08) ya acepta y exige `./order-delivery` para ese archivo.
   - `deliver-order.ts` no usa `packagesLeftInBatch`, que es solo del sheet.
   - El sheet sí importa las tres del barrel `@/lib/modules/pedidos`.
   - Lo coherente sería enmendar §12 de R20: el sheet importa las tres del barrel; `deliver-order.ts` importa `checkDelivery` y `checkDeliveryBlocks` de `./order-delivery`. Bastaría con ampliar el caso R16 existente. No escribí el test.

**Salida**
- `pnpm exec vitest run guard`: 76 archivos, 1066 passed y 20 skipped.
- `pnpm exec vitest run` sobre permissions, append-only, pedidos-schema, clientes/scope, guard-dependencias-aprobadas y guard-permisos-sembrados: 6 archivos, 163 passed y 2 failed (los dos de scope del punto 1).
- `order-delivery-append-only` tras la nota: 7 passed.
- `pnpm exec vitest run` sobre constraints.int y ledger-cuadre.int: 2 archivos, 21 passed.
- `pnpm run lint`: 0 errores y 7 warnings, todos en archivos ajenos a la rama (`documentos/confirm-catalog-import.test.ts`, `pedidos/order-service.test.ts`). Los archivos de la rama pasan limpios.
- `pnpm run typecheck`: 10 errores, solo en `e2e/anular-entrega.spec.ts` (5) y `e2e/entregar-producto-terminado.spec.ts` (5), de TI.

**Veredicto:** §9 verificada en mi alcance y guardias en verde. TC no se puede cerrar hasta decidir los 2 rojos de `clientes/scope.test.ts` (afinar detector o renombrar `customers`) y cómo queda el test de R20 en §12.

## frontend_dev — TI (E2E, 2026-10-15)

**Archivos**
- `e2e/entrega-a-varios-clientes.spec.ts` (nuevo, R47). Prefijo `qc282_e2e_`, un `test()` con el recorrido entero. No contiene el literal `data-table`, así que no entra en el censo de `tests/unit/shared/data-table-alcance.test.ts`, que sigue verde.
- `e2e/entregar-producto-terminado.spec.ts`: el cliente se lee de `lines[].customerId` (pasos 4 y 5). Lleva la nota «ENMIENDA 2026-10-15».
- `e2e/anular-entrega.spec.ts`:
  - la siembra pone `customerId` en las líneas, no en la entrega;
  - «la entrega queda intacta» lee `customerId` de las líneas;
  - el diálogo abre sin nada marcado: el paso 2 marca la presentación 2;
  - el paso 5 lee «Completa» del resumen (`order-delivery-summary-line`) y comprueba que la presentación completa no pinta `order-delivery-line`.
  - Lleva la nota «ENMIENDA 2026-10-15».
- `e2e/detalle-de-producto-terminado.spec.ts`: el paso 3d afirma la columna «Presentación» (`finished-product-delivery-presentation`). No siembra entregas por Prisma, así que no había SQL que mover. Lleva la nota «ENMIENDA 2026-10-15».
- `tests/guards/guard-identificador-de-request.test.ts`: `E2E_ESPERADOS` + `entrega-a-varios-clientes.spec.ts`, con su nota fechada.

**Mapa R → test**
- R47 → `e2e/entrega-a-varios-clientes.spec.ts` › «R47: entrega a dos clientes que comparten un lote, cliente repetido que no envia nada, anulacion de una sola presentacion de un cliente y lecturas por cliente». Afirma además R4, R8, R9, R11, R17, R25–R27, R33, R34, R36, R37, R41–R43.

**Salida**
- `pnpm run typecheck`: 0 errores (antes había 10).
- `pnpm run lint`: 0 errores y 7 warnings, todos en archivos ajenos (`documentos/confirm-catalog-import.test.ts`, `pedidos/order-service.test.ts`).
- `pnpm exec vitest run guard`: 76 archivos; 1066 passed y 20 skipped.
- `tests/unit/clientes/scope.test.ts` (fuera de mi alcance; se cita porque esta task añade un hallazgo): 3 rojos.
  - R28: «spec E2E ajeno con marca de clientes: entrega-a-varios-clientes.spec.ts». Lo dispara el nombre del archivo, que fija el spec, así que necesita su alta en `E2E_PERMITIDOS`.
  - R38/R37 y R40: los dos que ya había, ajenos a TI.
- `tests/unit/shared/data-table-alcance.test.ts`: verde.

**Playwright — NO CORRIÓ EN VERDE: bloqueo de entorno**
- **Contra qué base corre:** `webServer` levanta `pnpm run dev`, que carga el `.env`. En él, `DATABASE_URL` apunta a `localhost:5432/QuimiCloude`, la base de desarrollo compartida. `pnpm run db:test status` dice: «va 1 migracion(es) atras; la mas antigua que falta es 20261015130000_order_delivery_lines_customer». No la migré.
- **Base aparte:** la plantilla de la rama (`pnpm run db:test template` → `qct_tpl_cb171d256e4b`, 93 migraciones, ya existía) más una copia efímera creada con `createRunDatabase` de `tests/helpers/test-database.ts`, la misma maquinaria que el `globalSetup` de integración. Playwright corrió con `DATABASE_URL` y `DIRECT_URL` apuntando a la copia (`qct_qc282_cd53f584_mv9qk0v0_lws`); Next no pisa variables ya presentes en el entorno.
- **Resultado:** `Running 14 tests using 6 workers` → `14 failed`. Ninguna aserción de los specs llegó a evaluarse; todos los fallos son de entorno:
  - el disco C: estaba al 100 % (1,3 GB libres);
  - el Postgres local entró en recuperación: `FATAL 57P03 «el sistema de base de datos está en modo de recuperación»`, `PrismaClientInitializationError` y `PrismaClientUnknownRequestError` en los `beforeAll`/`afterAll`;
  - dos workers murieron (`worker process exited unexpectedly (code=3221226505)`);
  - el resto son `page.goto` o `locator.click` agotados contra un servidor sin base.
- **Después:** Postgres volvió a aceptar conexiones unos minutos más tarde. Borré la copia efímera y su rastro `.qc-test-db/*.json`. El disco quedó en 98 % (11 GB libres).
- **No reintenté:** otra corrida con el disco casi lleno puede volver a tumbar el Postgres compartido y romper a los demás worktrees.
- **Qué hace falta:** liberar disco en C: y repetir la misma corrida sobre una copia de la plantilla, sin tocar `QuimiCloude`:
  `DATABASE_URL=<url de la copia> DIRECT_URL=<url de la copia> pnpm exec playwright test e2e/entrega-a-varios-clientes.spec.ts e2e/entregar-producto-terminado.spec.ts e2e/anular-entrega.spec.ts e2e/detalle-de-producto-terminado.spec.ts`

**Veredicto:** specs escritos y censo E2E de la guardia al día. Typecheck en 0 y guardias en verde. El E2E no se ha visto en verde: la corrida falló por disco lleno y Postgres en recuperación, sin evaluar ninguna aserción. Queda pendiente repetirla y dar de alta el spec en `E2E_PERMITIDOS` de `clientes/scope.test.ts`.

## backend_dev — cierre TC (2026-10-15)

Sin código de producción. Sin dependencias nuevas.

**Archivos**
- `tests/unit/clientes/scope.test.ts`: `usaTablaCustomers` (compartido por R38 y R40) sustituye a la
  palabra `customers`. Cuenta el literal entre comillas `'customers'`/`"customers"`/`` `customers` ``
  salvo acceso indexado (`View['customers']`, `x?.['customers']`) y el nombre tras `FROM|JOIN|INTO|UPDATE|TABLE|REFERENCES`
  (con esquema y comillas opcionales). R38 conserva `/clientes`, el permiso y `'Clientes'`; R40 conserva
  `prisma.customer`, el import profundo y, del lado de clientes, `prisma.order`/`orders` sin cambios.
  Casos previos intactos. Nuevos (4): en R38 y en R40, 8 nombres de propiedad (`.customers`, `?.customers`,
  `customers:`, `customers?:`, `{ customers }` + su variable, `View['customers']`, `?.['customers']`,
  desestructuración `const { customers } =`) **no** disparan; y los usos reales (`'customers'`,
  `['customers']`, `FROM "customers"`, `FROM customers c JOIN …`, `FROM public.customers`, más `/clientes`
  e import profundo en R38, y `prisma.customer` e import profundo en R40) **sí** disparan, todos.
- `tests/unit/pedidos/order-delivery.test.ts`: junto al R16 de QC-223, `it.each` «QC-282 R20: $ruta importa
  $nombres de $desde» (sheet: `checkDelivery`, `checkDeliveryBlocks`, `packagesLeftInBatch` de
  `@/lib/modules/pedidos`; `deliver-order.ts`: `checkDelivery`, `checkDeliveryBlocks` de `./order-delivery`)
  y un caso sintético del detector (alias, `type`, comentario, otra ruta). Aserciones previas intactas.
- `specs/QC-282-entrega-a-varios-clientes/design.md` §12, fila R20: línea de decisión fechada 2026-10-15.

**Salida**
- `pnpm exec vitest run tests/unit/clientes/scope.test.ts tests/unit/pedidos/order-delivery.test.ts`:
  `Test Files 1 failed | 1 passed (2)`, `Tests 1 failed | 69 passed (70)`. El rojo: R38, «ningun archivo de
  app/ … nombra …», `(private)/pedidos/components/order-delivery-list.tsx` por `'Clientes'` (pregunta 7).
  R40 en verde; los 6 archivos de `customers` ya no disparan.
- `pnpm exec vitest run guard`: `Test Files 76 passed (76)`, `Tests 1066 passed | 20 skipped (1086)`.
- `pnpm run lint`: `0 errors, 7 warnings` (todas en `tests/unit/documentos/confirm-catalog-import.test.ts`
  y `tests/unit/pedidos/order-service.test.ts`, ajenas a este cambio).
- `pnpm run typecheck`: `tsc --noEmit` sin errores.

**Veredicto:** preguntas 1 y 2 cerradas; R20 trazado; R38 queda rojo por un marcador distinto (`'Clientes'`) que necesita decisión (pregunta 7).

**P7 (2026-10-15, decisión humana opción A).** El marcador `['"]Clientes['"]` (QC-153, menor 5) protegía el nombre visible del módulo: la entrada del sidebar y el título de su pantalla (`CUSTOMERS_LABEL` de `private-nav.ts`). En R38 se sustituye por: `CUSTOMERS_ROUTE`, `CUSTOMERS_LABEL` importada de `private-nav`, una entrada de menú `{ label: 'Clientes', href }` y un enlace `<Link|a>Clientes</…>`. La etiqueta visible (constante local, texto JSX, prop de etiqueta) ya no cuenta. El detector de e2e (R28) no cambia.
Casos sintéticos nuevos: 6 etiquetas que no disparan y 10 usos reales que sí (ruta, permiso, import profundo, tabla, constante de ruta, etiqueta del sidebar importada, 2 entradas de menú, 2 enlaces). Se conservan todos los casos anteriores.
Salida: `vitest run tests/unit/clientes/scope.test.ts` → `Tests 34 passed (34)`; `vitest run guard` → `76 passed (76)`, `1066 passed | 20 skipped`; `pnpm run lint` → `0 errors, 7 warnings` (las mismas, ajenas).
**Veredicto P7:** R38 en verde, sin perder sensibilidad al nombre del módulo como enlace o entrada de menú.
