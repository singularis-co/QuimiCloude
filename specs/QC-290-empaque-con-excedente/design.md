# QC-290 — empaque-con-excedente · design.md

> Zona fullstack · Complejidad high · Requisitos en `requirements.md` (R1–R29). Preguntas abiertas:
> Sin preguntas abiertas: P2 (pase `/design` aprobado), P3 y P4 cerradas el 2026-10-20.
> Sin dependencias nuevas (R28).

## Lo que ya existe

Busqué `excedente`, `supera la cantidad`, `packed_exceeds_quantity`, `effectivePackages`,
`maxPackagesForLine` en el board, en `specs/` y en el código. **El grafo (MCP) no se consultó en
esta tanda**: Grep y Read sobre el worktree.

- **Board** (`feature_list.json`): QC-304 era un duplicado de esta ficha; está cancelada y sus
  decisiones absorbidas aquí (fila «QC-304» de la tabla). No hay otra ficha que haga esto.
- **Specs** que esta ficha toca (enmiendas en §8):
  - QC-281: D1/R8/R15 (tope de lo envasado) se sustituyen; R24 (entrega con envases reales) pasa a
    «envases que espera el pedido».
  - QC-223 D3 (R16, R18, R28): el tope por presentación usa los envases que espera el pedido.
  - QC-288 `design.md > §12`: dejó a esta ficha decidir si el excedente de empaque cuenta para lo que
    esperan los pedidos. Se cierra con R17.
  - QC-170 Q3: el reparto antes de Comenzar no cambia (R25).
- **Código** (verificado con Read):
  - Bloqueo de hoy: `assertPackedWithinQuantity` en `lib/modules/pedidos/domain/order-packing.ts`
    (L165-175). Además de `exceeds_quantity` detecta `incompatible_units` y
    `presentation_without_content`: esas dos comprobaciones se conservan (R3).
  - El coste ya se reparte sobre lo envasado real (`unitCostByPresentationUnit`, L184): con excedente
    sale más bajo por unidad y la suma sigue siendo el coste del pedido. R10 no cambia código, solo
    gana test.
  - Dominio puro compartido por servidor y diálogo: `lib/modules/pedidos/domain/packing-count.ts`
    (`checkPackingCounts`, `effectivePackages`, `packedTotalInOrderUnit`, `maxPackagesForLine`).
    `maxPackagesForLine` solo lo usan el diálogo y su test.
  - `effectivePackages` (plan si no hay conteo) se usa en dos familias:
    - **entrega** (cambia a «lo que espera el pedido»): `deliver-order.ts` L138,
      `get-order-delivery.ts` L76, `order-pending-delivery.ts` L54 y
      `adapters/driven/persistence/direct-delivery-prisma.ts` L139 (QC-288);
    - **acondicionamiento y consulta** (no cambia, R18): `asignaciones/domain/conditioning-order-view.ts`,
      `conditioning-batch-data.ts`, la tab «Reparto».
  - Lectura de líneas al terminar y al entregar: `findPresentationLinesForFinishOrder` y
    `recordPackedCountsForOrder` en `order-prisma.ts` (L1187-1230), en orden `created_at, id`.
  - Diálogo: `app/(private)/asignacion/empaque/[id]/components/packing-finish-dialog.tsx`:
    `TEXTS.exceeds` (L79), flag `exceeds` (L232-245), `overQuantity` pinta el total en
    `text-destructive` (L349, L422).
  - Error `packed_exceeds_quantity`: `errores/domain/error-codes.ts` L226, `error-catalog.ts` L107 y
    L272, `asignaciones/domain/errors.ts` L255 (`PackedExceedsQuantityError`), su export en
    `asignaciones/index.ts` L61, el mapeo en `asignaciones/domain/finish-packing.ts` L139 y la unión
    de `OrderCatalog['finishPackingAliveById']` en `pedidos/domain/order-catalog.ts` L228.
  - Excedente sin pedido (QC-288): `surplusPackages(stock, waiting)` = stock − Σ lo que falta a los
    pedidos `TERMINADO`; lo que falta sale de `orderedPackages` de cada línea, hoy `effectivePackages`.
    Cambiando esa entrada, los libres suman solos al excedente (R17).

### UI: catálogo consultado y regla de decisión

Filas consultadas de `components/shared/CATALOGO.md`: `Notice` (aviso en línea con tono de
información), `Alert` (sin tono de información, `role="alert"` fijo), `StatusBadge` (insignia «+N»,
ya en uso) y `FieldError` (ya en uso para errores de línea).

- Aviso informativo (R20): **paso 1, reutiliza `Notice`** con tono de información. Es la propuesta;
  confirmada por el pase `/design` aprobado (P2). `Alert` se descarta: no tiene tono de
  información y anuncia como alerta, que es justo lo que R19 quita.
- No se crea ningún componente. Sí hay **cambio visual** de uno existente (el diálogo deja de pintar
  un estado de error y gana un aviso), así que va pase `/design` sobre los tableros aprobados de
  QC-281: `docs/diseno/canvas/EmpaqueTerminar.dc.html`, `EmpaqueTerminarEstados.dc.html`,
  `EmpaqueTerminarMovil.dc.html` y `EmpaqueTerminarTablet.dc.html`. **Pase aprobado por el humano
  el 2026-10-20**: estado `excedente` en `docs/diseno/canvas/EmpaqueTerminar.dc.html` (caja 5 de
  `EmpaqueTerminarEstados.dc.html`, enmienda en `EmpaqueTerminarMovil.dc.html`), con `Notice` en
  tono de información encima del pie. Textos en `requirements.md > R20`.

## 1. Modelo de datos

### 1.1 Columna nueva en `order_presentation_lines`

Los libres se **guardan** en la línea del reparto al Terminar (R8), igual que el conteo real
(QC-281 D13). Se guardan y no se recalculan al leer: ver A1 en §7.

| Columna | Tipo | Nulo | Default | Significado |
|---|---|---|---|---|
| `packed_surplus_packages` | `integer` | NOT NULL | `0` | Envases reales de la línea que el pedido no espera (R6). 0 en toda línea sin terminar o terminada antes de esta feature (R11). |

`db/schema.prisma`, modelo `OrderPresentationLine`, tras `packedReasonOther`:

```prisma
  /// Envases del conteo real que el pedido no espera: quedan libres en el lote. 0 sin excedente.
  packedSurplusPackages Int @default(0) @map("packed_surplus_packages")
```

### 1.2 Migración `db/migrations/<ts>_order_presentation_lines_packed_surplus/`

`<ts>` lo fija `pnpm run db:migrate:create` (posterior a la última migración de `dev` al crearla).

`migration.sql` (la columna la genera Prisma; los CHECK van a mano):

```sql
ALTER TABLE "order_presentation_lines"
  ADD COLUMN "packed_surplus_packages" INTEGER NOT NULL DEFAULT 0;

-- Solo una linea contada y por encima de su plan puede dejar envases libres, y nunca mas que lo
-- que paso del plan.
ALTER TABLE "order_presentation_lines"
  ADD CONSTRAINT "order_presentation_lines_packed_surplus_within_excess"
  CHECK (
       "packed_surplus_packages" = 0
    OR ("packed_packages" IS NOT NULL
        AND "packed_surplus_packages" > 0
        AND "packed_surplus_packages" <= "packed_packages" - "packages")
  );
```

`down.sql` (revierte exactamente, en orden inverso):

```sql
ALTER TABLE "order_presentation_lines" DROP CONSTRAINT "order_presentation_lines_packed_surplus_within_excess";
ALTER TABLE "order_presentation_lines" DROP COLUMN "packed_surplus_packages";
```

- `NOT NULL DEFAULT 0` rellena las filas existentes con 0 sin reescribir `packages`,
  `packed_packages` ni motivos (R11). En Postgres ≥ 11 un `ADD COLUMN ... DEFAULT` constante no
  reescribe la tabla.
- El CHECK no puede expresar R6(d) (la suma convertida ≤ excedente): necesita la cantidad y la
  unidad del pedido y el contenido. Esa regla vive en el dominio (§2.1) y se prueba allí.

### 1.3 RLS y autorización

No hay tabla nueva: `order_presentation_lines` ya tiene RLS y `FORCE ROW LEVEL SECURITY`. La
autorización sigue en el caso de uso (`asignaciones/domain/finish-packing.ts`, QC-281 R14) sin
cambios (R27). Las lecturas nuevas de la columna van por las mismas consultas con `company_id` de
hoy.

## 2. Dominio

### 2.1 `pedidos/domain/packing-count.ts` (puro; lo usan servidor y diálogo, R22)

```ts
export type SurplusLine = PackedDistributionLine & { readonly plan: number };

export type PackingSurplus =
  | {
      readonly kind: 'ok';
      /** Envasado − cantidad en la unidad del pedido; '0' si no la supera. */
      readonly excess: string;
      /** Envases libres por lineId; toda línea presente, 0 si no deja libres. */
      readonly byLine: ReadonlyMap<string, number>;
    }
  | { readonly kind: 'presentation_without_content'; readonly presentationId: string }
  | { readonly kind: 'incompatible_units'; readonly presentationId: string };

/** R5–R7. `lines` en el orden del reparto. */
export function packingSurplusByLine(
  quantity: string,
  orderUnit: UnitConversion,
  lines: readonly SurplusLine[],
): PackingSurplus;

/** Lo que espera el pedido de una línea para entregar (R12): reales (o plan) − libres. */
export function orderedPackages(line: {
  readonly packages: number;
  readonly packedPackages: number | null;
  readonly packedSurplusPackages: number;
}): number;
```

Algoritmo de `packingSurplusByLine`, sin aritmética nueva (reutiliza `validateDistribution` de
`order-distribution.ts`, la conversión del reparto):

1. `validateDistribution(quantity, orderUnit, reales)`. `presentation_without_content` /
   `incompatible_units` se devuelven tal cual (R3). `ok` → todas las líneas a 0 (R5),
   `excess = '0'`. `exceeds_quantity` → `excess = −available`.
2. Candidatas: líneas con `packedPackages > plan` (R6a). Se ordenan por contenido de **un** envase en
   la unidad del pedido, de mayor a menor (`sumInOrderUnit` con `packages: 1`), y a igual contenido
   por su posición en `lines` (R7). Para comparar hace falta `compareDecimals(a, b): -1 | 0 | 1`,
   que se añade a `order-distribution.ts` junto a `sameDecimal`, con los mismos `parseDecimal` y
   `rescale`.
3. `remaining = excess`. Por cada candidata, el mayor `f` en `[0, packed − plan]` (R6b) con
   `validateDistribution(remaining, orderUnit, [{ ...línea, packages: f }]).kind === 'ok'` (R6c,
   R6d), por búsqueda binaria como hace hoy `maxPackagesForLine`; `remaining` pasa a ser el
   `available` de ese `f`.
4. Las no candidatas quedan en 0.

`maxPackagesForLine` se **borra** cuando el diálogo deja de usarla (T7, tras el pase `/design`), con
su bloque de tests en `packing-count.test.ts`. Se publican
`packingSurplusByLine`, `orderedPackages` y los tipos en `lib/modules/pedidos/index.ts`.

### 2.2 Terminar: `pedidos/domain/order-packing.ts` (R1–R10)

- `assertPackedWithinQuantity` se sustituye por `resolveSurplus(quantity, orderUnit, unitById,
  resolvedLines)`, que llama a `packingSurplusByLine` y lanza `IncompatibleUnitsError` /
  `PresentationWithoutContentError` como hoy (R3). Nunca rechaza por exceso (R1).
- `RejectedFinish` pierde `'packed_exceeds_quantity'`.
- `recordPackedCounts` recibe también los libres (R8). Mismo punto del flujo: después de resolver y
  antes de `settlePackaging`, dentro de la misma unidad de trabajo, así que un rechazo posterior
  (stock del envase, R4) deshace también los libres.
- `settlePackaging`, el alta de lotes y el coste no cambian: ya trabajan con los envases reales (R4,
  R9, R10).

### 2.3 Contrato `OrderCatalog` (`pedidos/domain/order-catalog.ts`)

- La unión de `finishPackingAliveById` pierde `'packed_exceeds_quantity'` y su párrafo de doc.
- `OrderDeliveryProgressLine` gana `readonly packedSurplusPackages: number`.

### 2.4 Entrega (R12–R15, R17)

`effectivePackages(line)` → `orderedPackages(line)` en:

| Archivo | Para qué | Requisito |
|---|---|---|
| `pedidos/domain/deliver-order.ts` | tope por presentación al registrar, paso a `ENTREGADO` | R13, R14 |
| `pedidos/domain/get-order-delivery.ts` | «pedidos» y «faltan» del sheet | R12, R15 |
| `pedidos/domain/order-pending-delivery.ts` | estado de entrega del listado | R12 |
| `pedidos/adapters/driven/persistence/direct-delivery-prisma.ts` | lo que esperan los pedidos `TERMINADO` en el excedente sin pedido | R17 |

`effectivePackages` sigue para acondicionamiento y la tab «Reparto» (R18). El comentario de
`WaitingOrderLine.orderedPackages` en `pedidos/domain/direct-delivery.ts` pasa a citar
`orderedPackages`.

Concurrencia: la columna solo se escribe al Terminar, en `EN_EMPAQUE`, y la entrega solo lee pedidos
`TERMINADO`; ninguna entrega puede leerla a medio escribir. Los bloqueos de QC-223 (pedido) y QC-288
(producto) no cambian.

### 2.5 Errores (R26)

Se retira `packed_exceeds_quantity` entero, para que la guardia `guard-catalogo-de-errores`
(caso 5, entradas huérfanas) siga verde:

- `errores/domain/error-codes.ts`: fuera de `ERROR_CODES` (y la mención en la cabecera de fechas).
- `errores/domain/error-catalog.ts`: fuera la clave y el texto.
- `asignaciones/domain/errors.ts`: fuera `PackedExceedsQuantityError`; `asignaciones/index.ts`: fuera
  su export; `asignaciones/domain/finish-packing.ts`: fuera su rama de mapeo.
- `tests/unit/errores/catalogo.test.ts`: 106 → 105, con su línea de comentario de fecha.

## 3. Puertos y adaptadores

- `pedidos/ports/order-write-repository.ts`:
  - `FinishPackingLine` gana `readonly packedSurplusPackages: number`.
  - `recordPackedCounts(id, counts: readonly RecordedPackedLine[], scope)` con
    `RecordedPackedLine = PackedLineCount & { readonly packedSurplusPackages: number }`.
- `pedidos/adapters/driven/persistence/order-prisma.ts`: `findPresentationLinesForFinishOrder`
  selecciona `"packed_surplus_packages"`; `recordPackedCountsForOrder` lo escribe en el mismo
  `UPDATE`.
- `pedidos/adapters/driven/persistence/order-catalog-prisma.ts`: el progreso de entrega
  (`OrderDeliveryProgressLine`) selecciona `packedSurplusPackages`.
- `pedidos/adapters/driven/persistence/direct-delivery-prisma.ts`: selecciona
  `packedSurplusPackages` y usa `orderedPackages`.
- Sin cambios en `lib/composition/index.ts`: no hay puerto nuevo.

## 4. Server Action

`asignaciones` (Terminar) no cambia su entrada: el conteo ya viaja (QC-281). Solo pierde el mapeo
del error retirado. No hay acción nueva.

## 5. UI: diálogo «¿Terminar el empaque?» (R19–R24)

En `packing-finish-dialog.tsx`, **después** del pase `/design` aprobado (T1):

- Fuera `maxPackagesForLine`, `TEXTS.exceeds`, el campo `exceeds` de `LineView` y `overQuantity`:
  el total del pie ya no se pinta en `text-destructive` (R19, R24).
- El error de stock del envase (R9 de QC-281) se evalúa igual que hoy para toda línea por encima de
  su plan: sigue bloqueando (R23).
- `describeLines` calcula `packingSurplusByLine(finish.orderQuantity, finish.orderUnit, …)` con los
  mismos datos que ya arma para el total (`content`, `unit`, `plan`) y devuelve el excedente y los
  libres para el aviso (R20–R22). Con `incompatible_units` o sin contenido, sin aviso (el servidor
  rechaza como hoy, R3).
- El aviso: `Notice` en tono de información encima del pie (tablero aprobado, §UI). Textos: R20.

No cambia `PackingFinishView` ni su lector: ya trae cantidad, unidad, plan, contenido y unidad por
línea.

## 6. Seguridad, aislamiento y rendimiento

- Sin permiso nuevo (R27). Las lecturas y la escritura nuevas viajan en las consultas existentes,
  filtradas por `company_id`.
- `packingSurplusByLine` hace a lo sumo `líneas × log2(exceso)` llamadas a `validateDistribution`
  sobre una línea: un reparto tiene pocas líneas (una por presentación). Sin consultas extra.

## 7. Alternativas descartadas

- **A1 — Calcular los libres al leer, sin columna.** Cada lector de entrega (cuatro, uno de ellos un
  adaptador Prisma de QC-288 que agrega por producto) tendría que traer cantidad y unidad del pedido,
  contenido y unidades de cada línea y repetir R6–R7. Además el contenido «vigente» de una
  presentación puede cambiar después de Terminar y movería lo que espera un pedido ya terminado.
  Guardarlo lo congela en el instante de Terminar, igual que el conteo real (QC-281 D13).
- **A2 — Partir el lote en dos (uno del pedido y otro libre).** Duplica lotes con el mismo coste,
  la misma fecha y los mismos datos de acondicionamiento; el acondicionamiento (QC-219) pediría datos
  de lote para los dos. QC-288 ya calcula el excedente por producto, no por lote, así que separar el
  lote no aporta nada a R17. Contradice además «un lote por línea» (R9).
- **A3 — Guardar el excedente en el pedido como cantidad decimal.** No dice de qué presentación es
  (la fila «¿De qué presentación?» lo exige por línea) y la entrega y QC-288 trabajan en envases por
  presentación, no en cantidad.
- **A4 — Reparto de los libres que maximice la cantidad libre (búsqueda exhaustiva).** Da el óptimo
  en casos raros donde el orden «mayor contenido primero» no lo da, pero es combinatorio y difícil de
  explicar al Empacador. Descartada: el humano cerró P3 con «mayor contenido primero» (2026-10-20).
- **A5 — Mantener `maxPackagesForLine` como umbral del aviso.** El aviso no depende de una línea sino
  del total del pedido; el máximo por línea solo tenía sentido como tope.

## 8. Enmiendas a specs anteriores

No se editan esos specs: queda escrito aquí y en `requirements.md`.

- QC-281 D1, R8 y R15: sustituidos por R1, R19 y R26 de esta ficha.
- QC-281 R24: «envases reales como envases pedidos» pasa a «envases que espera el pedido» (R12).
- QC-223 D3 (R16, R18, R28): los envases pedidos de una presentación son los que espera el pedido
  (R12, R13).
- QC-288 `design.md > §12`: cerrado por R17.

## 9. Dependencias

Ninguna nueva (R28). Todo sale de `order-distribution.ts`, Prisma y las piezas de UI ya catalogadas.

## 10. Trazabilidad prevista (R → test)

| R | Test |
|---|---|
| R1 | `tests/unit/pedidos/order-packing.test.ts` (acepta envasado > cantidad); `tests/integration/pedidos/finish-with-finished-goods.int.test.ts` (sustituye el caso «R15, R22» de L1567) |
| R2 | `tests/unit/pedidos/packing-count.test.ts` (`checkPackingCounts` con excedente); `tests/unit/asignaciones/finish-packing.test.ts` |
| R3 | `tests/unit/pedidos/packing-count.test.ts` (`packingSurplusByLine` sin contenido / unidades); `tests/unit/pedidos/order-packing.test.ts` |
| R4 | `tests/integration/pedidos/finish-with-finished-goods.int.test.ts` (stock insuficiente con excedente) |
| R5, R6, R7 | `tests/unit/pedidos/packing-count.test.ts` (los ejemplos de requirements y P3) |
| R8 | `tests/integration/pedidos/order-packed-counts.int.test.ts` (guardado y rechazo); `tests/integration/pedidos/finish-with-finished-goods.int.test.ts` |
| R9, R10 | `tests/integration/pedidos/finish-with-finished-goods.int.test.ts` (lote 12×1 L, coste repartido sobre 12) |
| R11 | `tests/unit/pedidos/schema/order-presentation-lines-packed-surplus-migration.test.ts`; CHECK en `order-packed-counts.int.test.ts` |
| R12, R15 | `tests/unit/pedidos/get-order-delivery.test.ts`; `tests/unit/pedidos/list-orders.test.ts` (estado de entrega) |
| R13, R14 | `tests/unit/pedidos/deliver-order.test.ts`; `tests/integration/pedidos/order-delivery.int.test.ts` |
| R16, R17 | `tests/integration/pedidos/direct-delivery-repository.int.test.ts`; E2E (R29) |
| R18 | `tests/unit/asignaciones/get-conditioning-order.test.ts`, `tests/unit/asignaciones/conditioning-batch-data.test.ts` (siguen con reales) |
| R19–R24 | `tests/unit/asignaciones-ui/packing-finish-dialog.test.tsx` (sustituye los casos de L412-438 y L541) |
| R25 | test existente de QC-170 sin tocar (`order_distribution_exceeds_quantity`), citado en el mapa |
| R26 | `tests/unit/errores/catalogo.test.ts`; `tests/unit/asignaciones/order-packing-actions.test.ts` (fuera L207) |
| R27 | `tests/unit/asignaciones/finish-packing.test.ts` (sin cambios de permiso, caso con excedente) |
| R28 | gate (`docs/dependencias.md` sin filas nuevas) |
| R29 | `e2e/envases-reales-empaque.spec.ts` (caso nuevo) |
