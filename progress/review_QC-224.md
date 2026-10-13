# Review QC-224 — anular-entrega

- **Vuelta:** 1 (completa) · **Rama:** `feature/QC-224-anular-entrega` · **Head revisado:** `57708e7b`
- **Diff:** `origin/dev...HEAD` (80 archivos) · **PR:** #196
- **Grafo:** no usado en esta revisión; todo con Grep/Read y ejecución.

## Veredicto: RECHAZADO

1 mayor (bloqueante), 4 menores. El código de la feature es correcto y está bien probado. El rechazo
es por un rojo **nuevo** que la rama mete en un censo que no está en `tests/baseline-rojos.json`.
`gate-completo` lo va a dar rojo en CI.

## Verificación ejecutada (por el reviewer)

| Comando | Resultado |
|---|---|
| `pnpm run typecheck` | exit 0 |
| `pnpm run lint` | 0 errores, 7 avisos ajenos (preexistentes) |
| `pnpm exec vitest run guard` | 65 archivos, 893 pass, 18 skip, 0 fail |
| `vitest run` unit/ui afectados (void-delivery, list-order-deliveries, order-actions-delivery-void, append-only, pedidos/schema, qc91, qc121, finished-goods-return-prisma, batch-history, identity, errores, pedidos-ui ×4, module-contract, order-actions, qc75, clientes, scope ×2) | 169 archivos: **1 fail**, 3047 pass, 39 skip |
| `vitest run --project integration` (las 10 suites `.int` afectadas: void, void-concurrency, void-constraints, void-repository, finished-goods-return, ledger-cuadre, order-delivery-repository, delivery-void-permission-migration, identity-seed, customers-migration) | 10 archivos, 107 pass, base efímera borrada |
| `git diff origin/dev...HEAD -- package.json pnpm-lock.yaml` | vacío (R37) |
| grep de `QC-`/`R<n>`/`D<n>`/`design.md` en líneas `+` de `app/ lib/ db/` | 0 |
| grep de `100vh` y `hover:` en líneas `+` de `app/` | 0 |

No corrí la suite completa ni el E2E (lo hace CI; el E2E pasó en local en chromium y webkit, según la bitácora TI).

## Checklist

- [x] `requirements.md` EARS R1–R37; `design.md` con `## Lo que ya existe` completo y 9 alternativas
      descartadas (A1–A9); el diff no re-crea nada de esa lista (reutiliza `withOrderTransaction`,
      `lockAliveById`/`setStatus`, `writeMovement`, `recalculateProductStock`, catálogos de nombres).
- [x] `tasks.md`: todas `[x]`, salvo la casilla de TZ «`./init.sh` y `gate-completo` en verde», que
      confirma el leader.
- [x] Mapa R→test en `progress/impl_QC-224-anular-entrega.md > TZ`. Abrí los tests: cada R tiene
      aserciones reales (ver «Trazabilidad»).
- [x] typecheck / lint sin errores.
- [ ] **Sin rojos nuevos: FALLA** (`tests/unit/clientes/scope.test.ts`, hallazgo M1).
- [x] Migraciones con `down.sql` (las tres). El down de 120000 aborta con `RAISE EXCEPTION` si hay
      asientos `delivery_void`; el de 120100 repone los dos CHECK con su texto previo; el de 120200 hace
      DELETE en orden de FK. La bitácora B1 documenta up/down/up y el diff de objetos vacío.
- [x] RLS `ENABLE` + `FORCE` en `order_delivery_voids` y `order_delivery_void_lines` (con test estático).
- [x] Columna de empresa en los dos modelos nuevos; FK compuestas `(…, company_id)` contra entrega,
      usuario y anulación. Toda consulta nueva filtra por empresa (`companyScopeColumns`/
      `batchCompanyScope`). El acceso cruzado tiene test: R6 (empresa B → `order_not_found`), R18
      (empresa B → `delivery_not_found`), R29/findLots (lote de B), constraints `.int`.
- [x] Permisos en `domain/` como primera sentencia: `entregas.anular` (void) y `pedidos.consultar`
      (lista). Tests: R2 (null/undefined/sin permiso/solo `entregas.modificar`, también con entrada
      basura, y ningún puerto se llama), R3 (otro rol con permiso aceptado; Administrador sin el
      permiso rechazado), R4.
- [x] Hexagonal: `domain/` y `ports/` sin framework ni Prisma; de otro módulo solo el barrel
      (`@/lib/modules/inventario|clientes|identity`); las actions piden a `@/lib/composition`; las
      fábricas se atan en `composition`. Guardias de arquitectura en verde.
- [x] Server Actions en el único archivo `'use server'` de `pedidos`, actor una vez por petición y
      `toErrorState`.
- [x] UI: componentes en `app/(private)/pedidos/components/` con barrel; `'use client'` por componente;
      `touch`/`touchTarget` en botón y casillas; `text-base` (16 px) en el `Textarea`; `safe-area` en el
      sheet; sin `100vh` ni `:hover` como única vía.
- [x] Dependencias: ninguna (R37).
- [x] Comentarios de producción: ninguno cita ficha, R, D ni el spec.

## Hallazgos

### M1 — MAYOR (bloqueante): la rama deja rojo `tests/unit/clientes/scope.test.ts`

- **Dónde:** `e2e/anular-entrega.spec.ts:42` (`import { normalizeCustomerText } from '@/lib/modules/clientes';`)
  contra `tests/unit/clientes/scope.test.ts:298-302` (`E2E_PERMITIDOS`, lista cerrada) y `:317-322`.
- **Qué falla:** `R28 — los UNICOS E2E que nombran clientes … > ningun otro archivo de e2e/ … nombra clientes`:
  `AssertionError: spec E2E ajeno con marca de clientes: anular-entrega.spec.ts`.
- **No es baseline:** `tests/baseline-rojos.json` no lista `clientes/scope.test.ts`, y el archivo que
  dispara la regla es nuevo de esta rama (commit `4481fd4d`). Tampoco lo arrastra `vitest related` (el
  E2E no se importa desde ningún test), por eso no salió en la tanda; `gate-completo` sí lo corre.
- **Qué falta:** que ese censo quede verde. Hay dos caminos y elige el leader:
  (a) enmendar `E2E_PERMITIDOS` con `anular-entrega.spec.ts` y una nota fechada que diga por qué
  (siembra un cliente por Prisma con la normalización del barrel y no recorre la pantalla de
  clientes). Es exactamente lo que hizo QC-223 con `entregar-producto-terminado.spec.ts`, y se
  conservan las aserciones previas y los dos casos sintéticos; o
  (b) sembrar sin importar `@/lib/modules/clientes`.
  Si va (a), es un censo que `design.md > 8` no prevé: hay que añadirlo a esa tabla, o anotarlo en
  la bitácora como desvío.

### m1 — menor: dos migraciones con el mismo timestamp `20261009120000`

- `db/migrations/20261009120000_inventory_movement_kind_delivery_void` (esta rama) y
  `db/migrations/20261009120000_product_batches_production_date` (QC-219, ya en `origin/dev`).
- Son independientes y Prisma las ordena por nombre completo (`inventory…` < `product…`), así que no
  rompe nada. Pero en una base donde ya se aplicó la de QC-219, la nueva entra *antes* en el orden,
  y `scripts/db-rollback.ts` (`.sort()` sobre nombres) revierte primero la de QC-219.
  Cuando la de QC-219 llegó a `dev`, el chequeo de timestamps de B1 ya estaba hecho. No pido cambio
  si la migración ya está aplicada en algún entorno compartido; si no lo está, conviene renombrarla
  a un timestamp único antes del merge.

### m2 — menor: el CHECK `order_delivery_voids_reason_not_blank` admite un motivo de solo tabuladores o saltos de línea

- `db/migrations/20261009120100_order_delivery_voids/migration.sql` (`length(btrim("reason")) BETWEEN 1 AND 500`).
- Se ciñe a la letra de R32 («solo con espacios») y al SQL que fija `design.md §3.2`. El dominio lo
  rechaza (`z.string().trim()`, probado con `'   \t\n '` en `void-delivery.test.ts`), y es el único
  camino de escritura. Es defensa en profundidad incompleta, no un defecto de R32. Propuesta para una
  ficha futura: `btrim("reason", E' \t\r\n')`.

### m3 — menor: las presentaciones de una entrega salen ordenadas por el uuid de su línea, no por la posición de la línea en el pedido

- `order-delivery-void-prisma.ts:143` (`orderBy: [{ orderPresentationLineId: 'asc' }, …]`) y
  `list-order-deliveries.ts:96-108` (se agrupan en ese orden).
- R7 no fija el orden de las presentaciones, así que cumple. Pero el orden que ve el usuario es
  arbitrario y puede no coincidir con el del pedido ni con el sheet de entrega. Lo anoto para QC-225,
  que reutiliza la lista.

### m4 — menor: el mapa R→test de la bitácora mezcla etiquetas de otras fichas

- `progress/impl_QC-224-anular-entrega.md:662,668`: en R21 y R27 aparecen casos de `qc91-alcance`
  cuyas etiquetas `R21`/`R27` son de QC-91. La propia bitácora lo advierte (`:687`). No falta
  cobertura: R21 y R27 tienen sus casos propios. Es solo ruido en el mapa.

## Trazabilidad (abrí los tests, no me fié del mapa)

| R | Test que de verdad lo afirma |
|---|---|
| R1 | `unit/identity/permissions.test.ts` (catálogo y seed); `unit/identity/schema/delivery-void-permission-migration.test.ts`; `.int` delivery-void-permission-migration e identity-seed (verdes) |
| R2, R3 | `unit/pedidos/void-delivery.test.ts:191-226`: unauthorized con 4 actores y entrada basura, `ningunPuerto`; otro rol aceptado; Administrador sin el permiso rechazado |
| R4, R6 | `unit/pedidos/list-order-deliveries.test.ts`; `.int` order-delivery-void (`:546`, empresa B, inexistente, borrado) |
| R5 | `pedidos-ui/order-row-actions.test.tsx:530-590` (los diez estados, en el DOM o no) |
| R7–R9 | `list-order-deliveries.test.ts` (cliente y autor dados de baja); `order-delivery-list.test.tsx:62-140`; `.int` `:440` |
| R10 | `order-delivery-list.test.tsx:142-183`: sin `canVoid` no está en el DOM; todo anulado; los 8 estados restantes |
| R11–R14 | `delivery-void-dialog.test.tsx:137-258` (la action no se llama en R12 y R13; la misma clave en dos confirmaciones; otra al reabrir) |
| R15 | `order-deliveries-sheet.test.tsx:209` (cierra, toast, relee con la vista nueva, `router.refresh`); la fila «Terminado», en el E2E `anular-entrega.spec.ts:731-733` |
| R16 | `delivery-void-dialog.test.tsx:280-330`; `order-deliveries-sheet.test.tsx:228` |
| R17 | `void-delivery.test.ts:228-268`: los 15 casos de forma, todos con `ningunPuerto`, más el borde de 500 recortado |
| R18–R21 | `void-delivery.test.ts:270-330`; `.int` `:182`, `:213`, `:227` (sin escribir nada, comprobado contando filas) |
| R22–R25 | `.int` `:251`: fila de la anulación con motivo recortado; las 2 líneas de la presentación y ninguna más; asientos `delivery_void` con lote, pedido, anulación, autor y `reason` null; foto de la entrega idéntica; `finished-goods-return.int`; `ledger-cuadre.int` |
| R26 | `.int` order-delivery-repository `:426`; `.int` order-delivery-void `:303` (`getOrderDelivery` y una nueva `deliverOrder`) |
| R27 | `.int` `:284` (`finished_at`, `packed_by` y `conditioned_by` intactos); concurrencia `:208` |
| R28 | `void-delivery.test.ts:382`; `.int` `:342`; concurrencia `:188` (lectura previa sincronizada) |
| R29 | `.int` `:414` (fallo forzado tras devolver y en `setStatus`: nada escrito); `void-delivery.test.ts:350` |
| R30 | concurrencia `:174`, `:188`, `:208`, con `expectExistenciaCuadra` (lote = suma de asientos, ningún negativo) |
| R31 | `finished-goods-return.int.test.ts:285` |
| R32 | `order-delivery-void-constraints.int.test.ts`: un INSERT crudo por restricción, más el control positivo |
| R33 | `order-delivery-append-only.test.ts:112-166` |
| R34 | `order-delivery-voids-migration.test.ts:423` |
| R35 | `batch-history.test.tsx:336` |
| R36 | `e2e/anular-entrega.spec.ts:592` (motivo vacío sin escritura; lotes, asientos, anulación, entrega intacta, pedido TERMINADO; lista y sheet de entrega) y `:752` (sin permiso, «Anular» no existe) |
| R37 | diff vacío de `package.json` y `pnpm-lock.yaml`; `guard-dependencias-aprobadas` en verde |

## Inventario y concurrencia

- **Lo que vuelve al lote:** `returnFinishedGoods` suma a cada lote la `quantity` guardada en su línea
  de entrega, que es justo lo que descontó `dispatchFinishedGoods`. Escribe un asiento por línea y
  recalcula una vez por producto.
- **Por qué no puede chocar el único de la base:** `(void_id, batch_id)` no se viola, porque
  `order_delivery_lines_delivery_batch_unique` ya impide dos líneas del mismo lote en una entrega.
- **Doble anulación imposible por tres vías:**
  - bloqueo del pedido, y dentro de él la comprobación de `voided`;
  - `UNIQUE(delivery_line_id)` como respaldo, que devuelve `already_voided`;
  - el índice parcial por lote y anulación.
- **Orden de bloqueo:** pedido, productos ordenados por `id` con `FOR NO KEY UPDATE`, lotes. Es el
  de la entrega, así que no abre ningún ciclo nuevo.
- **Producto dado de baja (R31):** el bloqueo y el recálculo no filtran por `deleted_at`.

## Enmiendas de guardias

- **`qc91-alcance`:** mínima. Admite exactamente un `update` más, dentro de `returnFinishedGoods`, y
  cuenta que haya uno solo en ese cuerpo. Sigue exigiendo el de `adjustBatchStock`. El caso
  sintético de una tercera función sigue en rojo. `delete`, `upsert`, el SQL crudo y `updateMany`
  no cambian. Las aserciones previas se conservan.
- **`order-delivery-append-only`:**
  - admite solo `createVoidDelivery` y `voidDeliveryAction`, y comprueba que existan una sola vez y
    en `lib/`;
  - amplía `PRISMA_MUTANTE` y `SQL_MUTANTE` a las tablas nuevas;
  - un sintético con un tercer nombre `void…Deliver` sigue en rojo.

  El bloque R32 anterior está intacto.
- **`customers-migration.int`:** la dependencia pasa a seguirse de forma transitiva. Conserva la
  aserción de `20261006160000_orders_customer` y añade la de la anulación. Verde.

## Veredicto sobre las decisiones que los agentes tomaron solos

1. **Identificador corto de 8, orden de las presentaciones, `batch_not_found` como `Error`.**
   - Id corto: aceptado. `design.md §2.3` lo pide («identificador corto, nunca se lanza»).
   - Orden: aceptado, pero queda anotado en m3.
   - `Error` interno: aceptado. Es lo que dice `design.md §4` paso 5, y lo cubre R29.
2. **El CHECK con `btrim` y solo espacios.** Aceptado, se ciñe al spec. Endurecerlo queda como
   propuesta en m2.
3. **Las suites en `commit`.** Aceptado.
   - Los motivos son ciertos: `withOrderTransaction`, la lista y `findLots` usan el cliente global.
   - Cada caso limpia su empresa efímera.
   - `commit` es la declaración conservadora para un archivo que mezcla los dos modos.
4. **UI: motivo, relectura y error.** Aceptado.
   - El motivo se envía tal cual: el dominio lo recorta y lo guarda recortado (probado en `.int`).
   - Tras el éxito no se espera la relectura: el diálogo ya cerró, así que no hace falta.
   - Tras `delivery_already_voided` sí se espera, y es necesario: el diálogo sigue abierto y debe ver
     la entrega actualizada.
   - Si la relectura falla, se conserva la lista con el aviso encima. Está probado
     (`order-deliveries-sheet.test.tsx:239`).
5. **R15 y R17.** Aceptado.
   - R15: el cierre, la relectura y el refresco son del sheet, y la fila «Terminado» la cubre el E2E.
   - R17: se valida en el dominio antes de cualquier puerto, y el unit lo comprueba con `ningunPuerto`
     en los 15 casos. Un `.int` no añadiría nada.

## Para la vuelta 2

Corregir M1 y volver a correr `tests/unit/clientes/scope.test.ts` y `vitest run guard`. Los menores
no bloquean.
