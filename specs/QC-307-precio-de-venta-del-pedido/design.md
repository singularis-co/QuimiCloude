# QC-307 — precio-de-venta-del-pedido · design.md

> Diseño técnico de `requirements.md` R1–R23. El Alcance y las decisiones cerradas vienen de
> `/afinar-feature` (2026-10-22) y aquí no se reabren. Este archivo decide el nombre, la migración,
> dónde entra el dato en los casos de uso, qué pasa con el atajo de «solo cambia el cliente» y cómo
> se pinta.

## Lo que ya existe

Buscado el 2026-10-22, con `precio de venta`, `salePrice`, `sale_price`, `sellingPrice`,
`unitPrice`, `unit_price` y `price`:

- en el board (`feature_list.json`, todos los estados);
- en `specs/` (`grep -ril`);
- en el código, con el grafo (`search_code` sobre el proyecto de este worktree) y Grep.

| Qué apareció | Dónde | Qué se hace |
|---|---|---|
| QC-307 (esta) y QC-308 `margen-del-pedido` (`pending`, `depends_on: QC-307`) | board | QC-308 queda fuera (Alcance). No es duplicado: depende de esta |
| QC-123 (`done`), `[D1]` «no existe ningún precio de venta» | `specs/QC-123-…/requirements.md:34` | **Se deroga** por la decisión cerrada 1. La fila `[D1]` no se reescribe: se **anota** (T9) |
| QC-33 R9 / QC-35bis: `orders.unit_price`, precio **unitario**, retirado el 2026-09-07 | `db/migrations/20260907120000_orders_drop_unit_and_unit_price/` | **No vuelve.** Era por unidad de cantidad; esta ficha guarda un importe del pedido entero (decisión 2). Se reutiliza su **forma**: `DECIMAL(14,4)` + CHECK de no negativo |
| Coste estimado y real del pedido (`ingredientsCost`, `packagingCost`, `actualCost`) | `db/schema.prisma:777-787`, `order-view.ts`, `order-prisma.ts` | **No se tocan** (Alcance). Son el patrón para declarar la columna, leerla (`fromDecimal`) y pintarla (`CostCell`) |
| Celda de importe del listado | `order-columns.tsx > CostCell`, con `formatMoneyDisplay` y `exactDecimalTitle` (`lib/shared/ui/decimal-display.ts`), `MissingValue` y `withCardFieldLabel` | **Se reutiliza**, ampliando su mapa de `testid` (§6.2) |
| Campo decimal del formulario | `app/(private)/pedidos/components/order-field.tsx > OrderField`; su comentario ya habla del «cero admitido en el precio» (era el del precio unitario) | **Se reutiliza** sin cambios |
| Las salidas de `asignaciones` ya prueban que no llevan importes | `tests/unit/asignaciones/list-assigned-orders.test.ts:677` y `get-assigned-order-execution.test.ts:969` (`CLAVE_DE_IMPORTE = /cost|coste|importe|price|precio|amount/i`) | **Se reutilizan**: se les cuela `salePrice` en el resumen (R17) |
| Test de QC-123 que afirma que `OrderView` **no** declara `salePrice` | `tests/unit/pedidos/order-view.test.ts:145-151` | **Se invierte** solo en `salePrice`, por la derogación de `[D1]`. `price`, `unitPrice` y `total` siguen en negativo |

Nada en el board ni en `specs/` resuelve un precio de venta del pedido: no es duplicado.

### UI: catálogo consultado y regla de decisión

Filas de `components/shared/CATALOGO.md` consultadas:

- `DataTable` (fila 65);
- `cardFieldLabel`, `withCardFieldLabel` (fila 55);
- `FormSheet` (fila 77);
- `formatDecimalDisplay` y hermanas (fila 120, `lib/shared/ui/decimal-display.ts`, donde viven
  `formatMoneyDisplay` y `exactDecimalTitle`);
- `EMPTY_MARK` (fila 121).

| Pieza | Paso de la regla | Por qué |
|---|---|---|
| Columna «Precio de venta» del listado y de la tarjeta | 1 · reutiliza | Una entrada más de `buildOrderColumns` con `CostCell`. Sin componente nuevo |
| Campo «Precio de venta (opcional)» del formulario | 1 · reutiliza | `OrderField`, el mismo control de la cantidad. Sin componente nuevo |

**Pase `/design`.** No hay componente nuevo ni pieza visual nueva: un campo y una columna más que
componen piezas catalogadas. Es el mismo caso que QC-305 con su columna de coste real. El spec se
acoge a la excepción de `docs/perfil-agentes.md > Pase de diseño`. Queda como **P1** en
`requirements.md` para que el humano lo confirme al aprobar.

---

## 1. Modelo de datos y migración

### 1.1 La columna

```prisma
model Order {
  // ...
  /// Precio de venta del pedido ENTERO, escrito a mano. NULL = sin precio; 0 = se regala, y no es
  /// lo mismo. No es el coste ni se deriva de el. El CHECK `orders_sale_price_non_negative` es
  /// drift, escrito a mano en la migracion.
  salePrice           Decimal?      @map("sale_price") @db.Decimal(14, 4)
}
```

- **Nombre.** `salePrice` / `sale_price`: inglés y `snake_case` en la base (QC-4,
  `docs/conventions.md > Nombres`). No se llama `price` ni `total`: `price` a secas ya nombró al
  precio unitario que salió en 2026-09-07, y `total` es el nombre que QC-34/QC-68 vetaron para
  no confundirlo con un coste.
- **Opcional** (R4, R18). Sin `DEFAULT`. La migración **no** tiene `UPDATE`.
- **Sin moneda** (R3): ninguna columna más.
- **Sin índice**: no se ordena ni se filtra (R20). Mismo criterio que `ingredients_cost`
  (QC-123 `design.md > 3`).
- **Sin RLS nueva ni columna de empresa nueva**: `orders` ya tiene las dos. La columna hereda la
  política y el ámbito de la fila. `tests/guards/guard-empresa-en-esquema.test.ts` no cambia.

### 1.2 Migración `db/migrations/20261022120000_orders_sale_price/`

```sql
-- migration.sql (UP)
ALTER TABLE "orders" ADD COLUMN "sale_price" DECIMAL(14,4);

ALTER TABLE "orders" ADD CONSTRAINT "orders_sale_price_non_negative"
  CHECK ("sale_price" IS NULL OR "sale_price" >= 0);
```

```sql
-- down.sql (DOWN)
ALTER TABLE "orders" DROP CONSTRAINT IF EXISTS "orders_sale_price_non_negative";
ALTER TABLE "orders" DROP COLUMN IF EXISTS "sale_price";
```

- **El CHECK sí entra, a diferencia de `ingredients_cost`** (R9, decisión 4). Aquel lo calcula el
  dominio a partir de costes que ya tienen su CHECK. Este lo **teclea una persona**, y la
  decisión 4 pide la doble barrera. El caso de uso lo rechaza antes (R7), así que el `23514` no
  debería llegar nunca desde la aplicación. Si llega, el adaptador lo **relanza** sin traducir
  (`order-prisma.ts`, «lo que no se sabe traducir se RELANZA»). No hay `catch` nuevo.
- **El DOWN es destructivo, y aquí el dato NO es recalculable.** A diferencia del coste, el
  precio lo escribió una persona: revertir lo pierde. Queda escrito para que nadie lo descubra al
  hacer rollback. Quien revierta en un entorno con datos reales exporta antes la columna.
- El *timestamp* `20261022120000` es posterior a la última migración de la rama
  (`20261021150000_finished_goods_lot_cost_optional`). Si al sincronizar con `dev` (F2.3) aparece
  otra posterior, se renombra la carpeta y nada más.

---

## 2. Contratos del dominio (`lib/modules/pedidos/domain/`)

### 2.1 Entrada — `order-input.ts`

Un esquema nuevo, reutilizando `DECIMAL_14_4`, que ya existe en el archivo y **no admite signo**:

```ts
/** Precio de venta del pedido entero. Ausente, '' o solo espacios = sin precio (`null`); el 0 SI
 *  vale (se regala). El patron no admite signo, asi que un negativo muere aqui (R7). */
const salePriceSchema = z
  .string()
  .optional()
  .transform((value) => (value === undefined || value.trim() === '' ? null : value.trim()))
  .refine((value) => value === null || DECIMAL_14_4.test(value), {
    message: 'El precio debe ser un número decimal mayor o igual que cero.',
  });
```

- `createOrderSchema` gana `salePrice: salePriceSchema`. `updateOrderSchema` es el mismo objeto
  (reemplazo completo), así que la edición lo hereda.
- **`updateOrderDistributionSchema` no lo declara** y es `.strict()`: una clave `salePrice`
  rechaza la entrada entera (R14) sin una línea de código nueva.
- `quoteOrderCostSchema` y `orderPresentationAvailabilitySchema` usan `.pick(...)`: no lo heredan.
- Una clave `currency` (o cualquier otra) la descarta `z.object` (R3).
- El `refine` con `.test` y no `Number(...)`: `pedidos-convenciones.test.ts` prohíbe `Number(` en
  una línea que nombre un precio.

### 2.2 Escritura — `order-view.ts`

```ts
export type NewOrder = {
  // ...los de hoy
  /** `null` = sin precio. Cadena decimal(14,4). */
  readonly salePrice: string | null;
};
```

**El precio va en `NewOrder`, no como parámetro aparte del puerto.** El coste (`ingredientsCost`)
viaja aparte porque **no es un dato de entrada**: lo calcula el caso de uso, y `NewOrder` no debe
poder expresarlo. El precio es lo contrario: lo **escribe el usuario**, como `customerId`, que ya
vive en `NewOrder`. `OrderEdit = Omit<NewOrder, 'status'>` lo hereda solo.

### 2.3 Lectura — `order-view.ts`

`OrderRow` y `OrderView` ganan `readonly salePrice: string | null` (R16). `OrderSummary` es
`OrderView & {...}`, así que el listado lo devuelve por construcción. El campo es **obligatorio**
en el tipo, no `?:` (ver §8, alternativa 4).

`AssignedOrderSummary` (`order-catalog.ts:289`) **no** lo gana (R17). Tampoco `OrderSummaryRecord`
(`ports/order-summary-reader.ts`), que deriva de él. Esa es la barrera de tipo: `asignaciones` solo
recibe del módulo `pedidos` ese contrato y `OrderCatalog`.

Comentarios que se ajustan (T3):

- `order-view.ts:20-21`, `:108-109` y `:152-155` dicen «No es un precio de venta» y «esta salida
  no tiene ningún otro campo de precio». Pasan a decir que `ingredientsCost` es el coste y que el
  precio es `salePrice`, aparte, y que no se deriva de él.
- `order-input.ts:18-24` («el precio sigue fuera») pasa a decir «el precio **unitario** sigue
  fuera; el precio del pedido entero es `salePrice` (QC-307)».

---

## 3. Casos de uso

### 3.1 `createOrder` — sin cambios de flujo

`requirePermission(actor, 'pedidos.modificar')` sigue siendo la primera línea (R15). Después vienen
el `safeParse` y el resto. El único cambio es pasar `salePrice: data.salePrice` en el `NewOrder`
que construye (`create-order.ts:~180`).

### 3.2 `updateOrder` — el atajo «solo cambia el cliente»

`update-order.ts:104-121` tiene un atajo: si **solo** cambia el cliente, escribe solo el cliente
con `setCustomerAlive` y vuelve. Decide «solo» con `isCustomerOnlyEdit`
(`order-edit-change.ts:37`), que compara receta, cantidad, prioridad, unidad y reparto. **No mira
el precio.**

**Riesgo concreto.** Si no se toca, una edición que cambia el cliente **y** el precio entra por el
atajo, y el precio nuevo se pierde sin error. R12 lo prohíbe.

**Decisión.** `ComparableEdit` gana `salePrice` e `isCustomerOnlyEdit` lo compara:

```ts
function sameSalePrice(edit: string | null, saved: string | null): boolean {
  if (edit === null || saved === null) return edit === saved;   // null y '0' NO son iguales
  return sameDecimal(edit, saved);                               // '12.5' === '12.5000'
}
```

Consecuencias:

- Cambiar **solo el cliente** sigue yendo por el atajo y conserva el precio, porque no lo escribe
  (R13).
- Cambiar el **precio**, solo o con el cliente, va por el **camino completo**: escribe todos los
  campos de negocio, precio y cliente incluidos (R10, R12). Es la regla de la decisión 5 («igual
  que el resto del pedido»), y es lo que ya pasa hoy con la prioridad. El camino completo
  **recalcula el coste estimado** con los lotes de hoy (si el pedido no empezó) y **resincroniza
  lo apartado**. Es el mismo efecto que tiene hoy una edición que solo cambia la prioridad
  (`update-order.ts:140-144`). Se acepta así, sin abrir un tercer camino (§8, alternativa 3).
- `assertTransition(row.status, row.status)` corre **antes** del atajo y antes del camino completo.
  Un pedido no editable rechaza el cambio de precio con el mismo `invalid_transition` que el resto
  (R11).

El `updateAlive` del camino completo pasa `salePrice: data.salePrice` en `OrderEdit`.

### 3.3 Lo que no cambia

| Caso de uso | Por qué conserva el precio (R13) |
|---|---|
| `setOrderCustomer` | Su puerto `setCustomerAlive` solo escribe `customer_id`, `updated_by` y `updated_at` |
| `updateOrderDistribution` | `updatePresentationLinesAlive` solo escribe `unit_id` y el reparto. Su esquema `.strict()` rechaza la clave (R14) |
| `cancelOrder`, `deleteOrder` | No tocan columnas de negocio. El borrado es lógico (QC-4): la fila y su precio se quedan |
| `getOrder`, `listOrders` | Solo mapean `row.salePrice` a la vista. Ya exigen `pedidos.consultar` como primera línea (R16) |
| Cotización y coste (`quote-order-cost`, `resolve-ingredients-cost`, `actual-order-cost`) | No reciben el precio: el coste no puede depender de él (R23) |
| `lib/modules/identity/domain/permissions.ts` | No se toca (R15) |
| `ORDER_QUERYABLE` (`order-queryable.ts`) | No gana `salePrice` (R20). Un `sort` o `filter` por él se poda y se anota, como cualquier campo no declarado |
| `lib/composition/index.ts` | Ninguna dependencia nueva que cablear |

---

## 4. Adaptadores

### 4.1 Driven — `order-prisma.ts`

- `ORDER_SELECT` gana `salePrice: true`. `toOrderRow` hace
  `salePrice: row.salePrice === null ? null : fromDecimal(row.salePrice)`: `null` **nunca** pasa a
  `'0.0000'` (R6).
- `insertAliveOrder` (SQL crudo): `"sale_price"` en la lista de columnas y `${data.salePrice}::numeric`
  en `VALUES`. La fila que devuelve lleva
  `salePrice: data.salePrice === null ? null : fromDecimal(toDecimalInput(data.salePrice))`, igual
  que hoy `quantity`.
- `updateAliveOrder`: `salePrice: data.salePrice === null ? null : toDecimalInput(data.salePrice)`
  en `data`. Se sustituye siempre, también a `null` (R10).
- `setAliveOrderCustomer` y `updatePresentationLinesAlive` **no se tocan**: su tipo no puede
  expresar el precio.
- `order-catalog-prisma.ts` (lo que lee `asignaciones`) **no se toca**. Su `select` es explícito y
  no gana la columna. La prueba de integración de R17 lo confirma contra la base.

### 4.2 Driving — `order-actions.ts`

`buildCreateCandidate` (que `buildUpdateCandidate` reutiliza) gana
`salePrice: readOptionalFormString(formData, 'salePrice')`. Qué hacer con un blanco lo decide el
esquema, no el borde.

**No nace ninguna ruta, ningún endpoint y ninguna Server Action.**

---

## 5. Aritmética y dependencias

No hay aritmética: el precio se valida por forma, se guarda y se pinta. La comparación de la edición
usa `sameDecimal`, que ya existe (`order-distribution.ts:56`).

**Dependencias nuevas: ninguna** (decisión 10). No entra `decimal.js`, no se dispara
`docs/architecture.md > Dependencias de terceros` y `package.json` no cambia.

---

## 6. Pantalla (`app/(private)/pedidos/components/`)

### 6.1 Formulario — `order-form.tsx`

- `ORDER_BUSINESS_FIELDS` gana `'salePrice'`. Es la fuente única que `readValues` recorre, así que
  un fallo de validación devuelve lo escrito (R21).
- `FIELD_MESSAGES.salePrice = 'Ingresa un número mayor o igual a 0, con hasta 4 decimales.'`.
  `FIELD_LABELS.salePrice = 'Precio de venta (opcional)'`.
- El campo es un `OrderField`:
  - `name="salePrice"`, `type="number"`, `step="any"`, `min="0"`, `inputMode="decimal"`;
  - **sin** `required` y **sin** `roundDecimals`. El esquema admite 4 decimales y el formulario no
    los recorta: redondear a 2 al soltar el foco cambiaría en silencio un precio escrito con 4;
  - `defaultValue={initialValue('salePrice', trimDecimal(order?.salePrice ?? ''))}`.
- **Dónde va.** Justo **encima** del bloque de coste (`OrderCostQuote`), en su propia fila y a 4 de
  12 columnas desde `sm`. Precio y coste quedan juntos sin compararse: el margen es QC-308.
- La validación previa ya usa `createOrderSchema` / `updateOrderSchema`, así que el campo se valida
  con la **misma** regla que el servidor sin copiar el patrón (R21).

### 6.2 Columna — `order-columns.tsx`

- Constantes nuevas:
  - `SALE_PRICE_COLUMN_ID = 'salePrice'`;
  - `SALE_PRICE_TESTID = 'order-sale-price'`;
  - `SALE_PRICE_LABEL = 'Precio de venta'`.
- `CostCell` se renombra a `AmountCell`, una función interna sin exportar. Su mapa `COST_TESTIDS`
  pasa a `AMOUNT_TESTIDS` y gana la entrada del precio. El rótulo sale del mismo mapa, en lugar
  del ternario de dos ramas de hoy. Los `testid` y los ids de las dos columnas de coste **no
  cambian**.
- La columna va **justo antes de «Costo estimado»**: `align: 'end'`, `tabular: true`, sin
  `sortable` y sin `filter` (R20). Son 15 columnas.
- `order-list-skeleton.tsx`: `ORDER_SKELETON_COLUMN_COUNT` pasa de 14 a 15. El test
  `order-list-skeleton.test.tsx` ya exige que coincida con `ORDER_COLUMNS.length`.
- **Tarjeta del teléfono**: la compone la misma declaración de columnas, con `withCardFieldLabel`
  dentro de la celda. No hay archivo aparte que tocar (R19).
- El comentario de cabecera de `order-columns.tsx:82-83` («Son costes guardados, no precios de
  venta») se completa: la columna del precio es otra, y va aparte.

### 6.3 Ficha / detalle

En esta pantalla el detalle del pedido **es** el panel de edición (`order-sheet.tsx` → `OrderForm`
precargado). No hay vista de detalle aparte: `getOrderAction` no tiene llamador en `app/`. «Verlo
en el detalle» es verlo precargado en ese panel (R21, R22), que es lo que pide la decisión 6
(«detalle/formulario»).

---

## 7. Pruebas y E2E

| Nivel | Qué cubre | Dónde |
|---|---|---|
| Unidad, esquema | R3–R8, R14 | `tests/unit/pedidos/order-input.test.ts` |
| Unidad, casos de uso | R10–R13, R15, R16, R23 | `create-order.test.ts`, `update-order.test.ts`, `order-edit-change.test.ts`, `get-order.test.ts`, `list-orders.test.ts`, `set-order-customer.test.ts`, `update-order-presentation-lines.test.ts` |
| Unidad, tipos | R1, R2, R17 | `order-view.test.ts` (positivo `salePrice` en `OrderRow` / `OrderView` / `NewOrder`; negativo en `AssignedOrderSummary`) |
| Unidad, `asignaciones` | R17 | `list-assigned-orders.test.ts`, `get-assigned-order-execution.test.ts`: `salePrice` colado en el resumen, y `CLAVE_DE_IMPORTE` ya lo caza |
| Estático, SQL | R2, R9, R18 | `tests/unit/pedidos/schema/orders-sale-price-migration.test.ts` (patrón de `orders-actual-cost-migration.test.ts`) |
| Integración, base real | R2, R6, R9, R10, R13, R17, R18 | `tests/integration/pedidos/order-sale-price.int.test.ts` |
| Unidad, UI | R19–R21 | `order-columns.test.tsx`, `order-cards.test.tsx`, `order-form-sale-price.test.tsx` |
| E2E | R22 | `e2e/pedido-precio-de-venta.spec.ts` |

**E2E (decisión 12).** Un recorrido:

1. Entrar como un usuario con `pedidos.modificar`.
2. Abrir «Nuevo pedido» y elegir receta, cantidad y unidad.
3. Escribir `1250.5` en «Precio de venta» y guardar.
4. Ver `$ 1,250.50` en la celda `order-sale-price` de la fila nueva.
5. Abrir la edición de esa fila y ver `1250.5` en el campo.

Se apoya en el sembrado y los helpers que ya usa `e2e/pedido-con-cliente.spec.ts`. No ejercita la
validación: eso es de unidad.

**Un fixture más por test que construye un pedido a mano.** `salePrice` es obligatorio en
`OrderRow` / `OrderView`, así que cada test que monta un literal de esos tipos gana
`salePrice: null`. Es el mismo barrido que hizo QC-305 con `actualCost`. La lista va en
`tasks.md > Archivos esperados`.

---

## 8. Alternativas descartadas

1. **Precio por unidad de cantidad o por línea de presentación** (volver a `unit_price`, o una
   columna en `order_presentation_lines`). Descartada por la decisión 2: el humano pidió un
   importe del pedido entero y se apartó de QC-33 a propósito. Además, una columna por línea
   obligaría a definir el total de un pedido sin reparto, que hoy es legal (`[]`).
2. **Pasar el precio como parámetro aparte del puerto**, como `ingredientsCost`. Descartada: ese
   patrón existe para que `NewOrder` **no pueda** expresar un dato que el usuario no escribe. El
   precio sí lo escribe el usuario: su sitio es `NewOrder`, junto a `customerId`. Sacarlo dejaría
   dos firmas de puerto creciendo por el final sin motivo.
3. **Un caso de uso propio `setOrderSalePrice`** (con su método `setSalePriceAlive`), como el del
   cliente, editable en cualquier estado y sin recalcular el coste. Descartada por la decisión 5:
   el precio se edita «en el mismo formulario, con las mismas reglas de edición». Un camino propio
   tendría otras reglas de estado y abriría un tercer camino de escritura que el atajo de
   `isCustomerOnlyEdit` tendría que conocer. Si un día hace falta, es una ficha.
4. **`salePrice?: string | null` opcional en `OrderRow` / `OrderView`**, para no tocar los
   fixtures de unos cincuenta tests. Descartada: un campo opcional en una **salida** deja que un
   mapeo olvidado compile y devuelva `undefined`, y la UI lo pintaría igual que «sin precio».
   QC-305 pagó el mismo barrido con `actualCost` por la misma razón.
5. **Sin CHECK en la base, como `ingredients_cost`.** Descartada por la decisión 4, que pide las
   dos barreras. La razón de QC-123 para no ponerlo (un error de cálculo que se vuelve un `23514` a
   mitad de un alta) no aplica: aquí no hay cálculo, y el caso de uso rechaza antes.
6. **Redondear el campo a 2 decimales al soltar el foco**, como la cantidad. Descartada: la
   columna guarda 4 y el esquema admite 4. Recortar en el cliente cambiaría un dato tecleado sin
   avisar. La tabla ya redondea a 2 **solo para mostrar**, con el valor exacto en el `title`.

---

## 9. Enmiendas de documentación

- **`docs/architecture.md > Preguntas abiertas del dominio`, punto 4** (T9). El título pasa a
  «CERRADA (QC-33, corregida en QC-123 y en QC-307)». La viñeta «No existe ningún precio de venta,
  ni en el pedido ni en la receta» se sustituye por:
  > Existe un **precio de venta** del **pedido entero**, opcional, escrito a mano al registrarlo o
  > editarlo (`orders.sale_price`, `decimal(14,4)`, nunca negativo; 0 vale y no es lo mismo que
  > vacío). **No sustituye al coste** ni se deriva de él: el margen es QC-308. La receta sigue sin
  > precio. La moneda sigue implícita (punto 5).

  En `### Por qué` se añade una línea fechada (2026-10-22) con el motivo: decisión humana de
  QC-307, que deroga QC-123 `[D1]`.
- **`specs/QC-123-…/requirements.md`**: la fila `[D1]` **no se reescribe**. Se le añade debajo una
  nota fechada «Derogada por QC-307 (2026-10-22): el pedido tiene precio de venta del pedido
  entero; el coste no cambia». Es el mismo criterio con que QC-170 anotó `design.md > 5.3` de
  QC-123.
